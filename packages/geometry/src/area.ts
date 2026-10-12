/**
 * Surface area of a shape, in total and per surface region (docs/design/platform.md section 4.2).
 *
 * Areas are those of the exact surface, in closed form:
 *  - sor: Pappus' theorem on every line and arc of the cross-section boundary; a partial shell
 *    adds its two flat end faces. A stretched shell has no closed form and is integrated
 *    numerically (Gauss-Legendre panels, accurate to about 1e-12 relative).
 *  - capsule: `2 pi r L + 4 pi r^2`.
 *  - rbox and hull: the Steiner formula `S + r * sum(L_e * theta_e) + 4 pi r^2` (face area,
 *    edge strips, vertex patches). The split between the `'in'` and `'out'` sides is exact too:
 *    the vertex patches of either side add up to a hemisphere whatever the polytope.
 * The area of a shape is the sum over its parts: surface hidden where parts overlap or touch is
 * counted. A region's area is the area of the patches the region rules assign to it (see
 * `regions.ts`), which is what the triangles tagged with that region in the render mesh converge
 * to.
 *
 * Units: m^2.
 */

import type { ConvexCore, Polytope } from './convex.ts';
import { preparePrimitive, type PreparedPrimitive, type PreparedSor } from './prepared.ts';
import {
  shapeRegionRules,
  sideOfNormalZ,
  SIDE_NORMAL_TOLERANCE,
  type PatchSide,
} from './regions.ts';
import {
  pieceRadiusIntegral,
  sectionMoment,
  splitLoopAtArcLengths,
  type SectionPiece,
} from './sor-section.ts';
import type { Primitive, Shape } from './types.ts';

const TWO_PI = 2 * Math.PI;

/** Receives one patch of surface: its area, its side and (sor only) its arc length. */
type PatchSink = (area: number, side: PatchSide, s: number | undefined) => void;

// Eight-point Gauss-Legendre rule on [-1, 1] (exact to degree 15).
const GAUSS8_X: readonly number[] = [
  -0.9602898564975363, -0.7966664774136267, -0.525532409916329, -0.1834346424956498,
  0.1834346424956498, 0.525532409916329, 0.7966664774136267, 0.9602898564975363,
];
const GAUSS8_W: readonly number[] = [
  0.1012285362903763, 0.2223810344533745, 0.3137066458778873, 0.362683783378362, 0.362683783378362,
  0.3137066458778873, 0.2223810344533745, 0.1012285362903763,
];

/** Integral of `f` over `[a, b]` with `panels` Gauss-Legendre panels of eight points. */
function integrate(f: (x: number) => number, a: number, b: number, panels: number): number {
  let sum = 0;
  const h = (b - a) / panels;
  for (let p = 0; p < panels; p++) {
    const mid = a + (p + 0.5) * h;
    for (let g = 0; g < 8; g++) {
      sum += (GAUSS8_W[g] as number) * f(mid + 0.5 * h * (GAUSS8_X[g] as number));
    }
  }
  return 0.5 * h * sum;
}

/** Area swept by one boundary piece of a stretched shell between two azimuths. */
function stretchedPieceArea(
  p: SectionPiece,
  sx: number,
  sy: number,
  phi0: number,
  phi1: number,
): number {
  // A surface element with unit normal n maps under the stretch A to an element of area
  // det(A) |A^-1 n| times as large, with n = (nr cos(phi), nr sin(phi), nz).
  const azimuthal = (nr: number, nz: number): number =>
    integrate(
      (phi) => Math.hypot((nr * Math.cos(phi)) / sx, (nr * Math.sin(phi)) / sy, nz),
      phi0,
      phi1,
      Math.max(4, Math.ceil((16 * (phi1 - phi0)) / TWO_PI)),
    );
  if (p.kind === 'line') {
    return sx * sy * azimuthal(p.nr, p.nz) * pieceRadiusIntegral(p);
  }
  const panels = Math.max(1, Math.ceil((p.th1 - p.th0) / (Math.PI / 8)));
  return (
    sx *
    sy *
    integrate(
      (th) => azimuthal(Math.cos(th), Math.sin(th)) * (p.cr + p.rho * Math.cos(th)) * p.rho,
      p.th0,
      p.th1,
      panels,
    )
  );
}

function sorPatches(s: PreparedSor, cuts: readonly number[], sink: PatchSink): void {
  const section = s.section();
  const phi0 = s.arc?.phi0 ?? 0;
  const phi1 = s.arc?.phi1 ?? TWO_PI;
  const stretched = s.sx !== 1 || s.sy !== 1;
  for (const loop of section.loops) {
    for (const piece of splitLoopAtArcLengths(loop, cuts).pieces) {
      const area = stretched
        ? stretchedPieceArea(piece, s.sx, s.sy, phi0, phi1)
        : (phi1 - phi0) * pieceRadiusIntegral(piece);
      sink(area, piece.side, 0.5 * (piece.s0 + piece.s1));
    }
  }
  if (s.arc !== null) {
    // The two flat end faces: the cross-section area, stretched along its radial direction.
    const flat = sectionMoment(section.loops, 0, 0);
    for (const phi of [phi0, phi1]) {
      sink(flat * Math.hypot(s.sx * Math.cos(phi), s.sy * Math.sin(phi)), 'none', undefined);
    }
  }
}

function polytopePatches(core: Polytope, r: number, sink: PatchSink): void {
  for (const face of core.faces) {
    let area = 0;
    const p0 = core.vertices[face.loop[0] as number] as readonly number[];
    for (let i = 1; i + 1 < face.loop.length; i++) {
      const p1 = core.vertices[face.loop[i] as number] as readonly number[];
      const p2 = core.vertices[face.loop[i + 1] as number] as readonly number[];
      const ux = (p1[0] as number) - (p0[0] as number);
      const uy = (p1[1] as number) - (p0[1] as number);
      const uz = (p1[2] as number) - (p0[2] as number);
      const vx = (p2[0] as number) - (p0[0] as number);
      const vy = (p2[1] as number) - (p0[1] as number);
      const vz = (p2[2] as number) - (p0[2] as number);
      area += 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    }
    sink(area, sideOfNormalZ(face.normal[2]), undefined);
  }
  if (!(r > 0)) return;
  for (const edge of core.edges) {
    // Along the arc the normal's z component is a cos(alpha) + b sin(alpha).
    const a = edge.u0[2];
    const b = edge.w[2];
    const amplitude = Math.hypot(a, b);
    const strip = edge.length * r;
    if (amplitude <= SIDE_NORMAL_TOLERANCE) {
      sink(strip * edge.angle, 'none', undefined);
      continue;
    }
    // Positive on the open half turn centred on alpha0.
    const alpha0 = Math.atan2(b, a);
    let positive = 0;
    for (const k of [-1, 0, 1]) {
      const lo = Math.max(0, alpha0 - Math.PI / 2 + k * TWO_PI);
      const hi = Math.min(edge.angle, alpha0 + Math.PI / 2 + k * TWO_PI);
      if (hi > lo) positive += hi - lo;
    }
    sink(strip * positive, 'in', undefined);
    sink(strip * (edge.angle - positive), 'out', undefined);
  }
  // The normal cones of the vertices tile the sphere: a hemisphere of patches on either side.
  sink(TWO_PI * r * r, 'in', undefined);
  sink(TWO_PI * r * r, 'out', undefined);
}

function corePatches(core: ConvexCore, r: number, sink: PatchSink): void {
  if (core.dim === 0) {
    sink(4 * Math.PI * r * r, 'none', undefined);
  } else if (core.dim === 1) {
    const length = Math.hypot(core.b[0] - core.a[0], core.b[1] - core.a[1], core.b[2] - core.a[2]);
    sink(TWO_PI * r * length + 4 * Math.PI * r * r, 'none', undefined);
  } else {
    polytopePatches(core, r, sink);
  }
}

function patches(prep: PreparedPrimitive, cuts: readonly number[], sink: PatchSink): void {
  switch (prep.kind) {
    case 'sor':
      sorPatches(prep, cuts, sink);
      break;
    case 'capsule':
      sink(
        TWO_PI * prep.radius * prep.length + 4 * Math.PI * prep.radius * prep.radius,
        'none',
        undefined,
      );
      break;
    case 'rbox':
      corePatches(prep.core(), prep.radius, sink);
      break;
    case 'hull':
      corePatches(prep.core, prep.radius, sink);
      break;
  }
}

/** Surface area of one primitive, m^2. */
export function primitiveSurfaceArea(prim: Primitive): number {
  let total = 0;
  patches(preparePrimitive(prim), [], (area) => {
    total += area;
  });
  return total;
}

/**
 * `surfaceArea(shape, regionId?)`: area in m^2 of the whole surface of the shape (the sum over
 * its parts) or of the patches assigned to the regions with the given id. Throws a RangeError
 * when the shape has no region with that id.
 */
export function surfaceArea(shape: Shape, regionId?: string): number {
  const rules = shapeRegionRules(shape);
  if (regionId !== undefined && !shape.regions.some((region) => region.id === regionId)) {
    throw new RangeError(`geometry: the shape has no region '${regionId}'`);
  }
  let total = 0;
  shape.parts.forEach((part, partIndex) => {
    const prep = preparePrimitive(part.prim);
    const cuts = regionId === undefined ? [] : rules.arcLengthCuts(partIndex);
    patches(prep, cuts, (area, side, s) => {
      if (regionId !== undefined) {
        const index = rules.regionOf(partIndex, side, s);
        if (index < 0 || shape.regions[index]?.id !== regionId) return;
      }
      total += area;
    });
  });
  return total;
}
