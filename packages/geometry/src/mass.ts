/**
 * Mass properties (docs/design/platform.md section 4.2, docs/research/items.md section 2.3).
 *
 * Every primitive is integrated in closed form over its actual solid, not over a thin-shell
 * idealisation:
 *  - sor: Green's theorem over the exact cross-section boundary (lines and arcs), which gives the
 *    volume, first and second moments of the revolved, stretched and possibly partial solid. As
 *    `t / r` tends to zero this reduces to the thin-shell formulas of the items dossier
 *    (`m = rho t pi (r1 + r2) L` per segment); for a real plate it differs from them by the
 *    rounded rim, about 2 % of the mass.
 *  - capsule: cylinder plus two hemispheres.
 *  - rbox and hull: the Steiner decomposition of `polytope + ball` into the polytope, a prism on
 *    every face, a cylinder wedge on every edge and a ball sector at every vertex.
 * A shape is the sum of its parts (parallel-axis composition). Parts that overlap are counted
 * twice where they overlap, exactly as the dossier's estimator adds a foot ring or a handle on
 * top of the shell; parametric expansion keeps such overlaps to the joints. That is not
 * nothing: over the catalogue the parts weigh up to 6.6 % more than the solid they make
 * together (above 3 % for sixteen item types: the joints of cutlery and utensils, the corner
 * fillets of box shells; `countedTwice` of the catalogue package measures it, and a test there
 * bounds it per item). There is no mass of the union in the kernel yet.
 *
 * A part with a porosity (perforated sheet, mesh) is weighed at `1 - porosity` of the density of
 * its material: the holes are taken to be spread evenly, so only the amount of material changes,
 * not where its centre lies.
 *
 * Units: metres, kilograms, kg/m^3; inertia in kg m^2.
 */

import type { Mat3, Vec3 } from '@spotless/core';
import { inertiaShiftToCom, quatToMat3 } from '@spotless/core';
import type { PolyEdge, PolyFace, Polytope } from './convex.ts';
import { preparePrimitive, type PreparedPrimitive, type PreparedSor } from './prepared.ts';
import { sectionMoment } from './sor-section.ts';
import type { DensityLookup, MassProperties, Primitive, Shape } from './types.ts';

/**
 * Moments of a solid of unit density about the origin of the frame it is expressed in: the
 * volume (m^3), the first moment `integral of x dV` (m^4) and the second-moment tensor
 * `integral of x x^T dV` (m^5, symmetric, row-major).
 */
export interface SolidMoments {
  readonly volume: number;
  readonly first: Vec3;
  readonly second: Mat3;
}

/** Mutable accumulator: volume, first moment, and second moment as xx, yy, zz, xy, xz, yz. */
interface Accumulator {
  v: number;
  f: [number, number, number];
  s: [number, number, number, number, number, number];
}

function newAccumulator(): Accumulator {
  return { v: 0, f: [0, 0, 0], s: [0, 0, 0, 0, 0, 0] };
}

/** Adds `weight * (a b^T + b a^T) / 2` to a symmetric tensor accumulator. */
function addSymOuter(acc: Accumulator, a: Vec3, b: Vec3, weight: number): void {
  const s = acc.s;
  s[0] += weight * a[0] * b[0];
  s[1] += weight * a[1] * b[1];
  s[2] += weight * a[2] * b[2];
  s[3] += 0.5 * weight * (a[0] * b[1] + a[1] * b[0]);
  s[4] += 0.5 * weight * (a[0] * b[2] + a[2] * b[0]);
  s[5] += 0.5 * weight * (a[1] * b[2] + a[2] * b[1]);
}

function addFirst(acc: Accumulator, a: Vec3, weight: number): void {
  acc.f[0] += weight * a[0];
  acc.f[1] += weight * a[1];
  acc.f[2] += weight * a[2];
}

function finish(acc: Accumulator): SolidMoments {
  const s = acc.s;
  return {
    volume: acc.v,
    first: [acc.f[0], acc.f[1], acc.f[2]],
    second: [s[0], s[3], s[4], s[3], s[1], s[5], s[4], s[5], s[2]],
  };
}

// ---------------------------------------------------------------------------------------------
// Shell of revolution
// ---------------------------------------------------------------------------------------------

function sorMoments(s: PreparedSor): SolidMoments {
  const loops = s.section().loops;
  // Planar moments M_ab = integral of r^a z^b over the cross-section.
  const m10 = sectionMoment(loops, 1, 0);
  const m11 = sectionMoment(loops, 1, 1);
  const m12 = sectionMoment(loops, 1, 2);
  const m20 = sectionMoment(loops, 2, 0);
  const m21 = sectionMoment(loops, 2, 1);
  const m30 = sectionMoment(loops, 3, 0);
  let volume: number;
  let fx = 0;
  let fy = 0;
  let fz: number;
  let xx: number;
  let yy: number;
  let zz: number;
  let xy = 0;
  let xz = 0;
  let yz = 0;
  const arc = s.arc;
  if (arc === null) {
    volume = 2 * Math.PI * m10;
    fz = 2 * Math.PI * m11;
    xx = Math.PI * m30;
    yy = xx;
    zz = 2 * Math.PI * m12;
  } else {
    // x = r cos(phi), y = r sin(phi), dV = r dr dz dphi, phi from phi0 to phi1.
    const span = arc.phi1 - arc.phi0;
    const ds = Math.sin(arc.phi1) - Math.sin(arc.phi0);
    const dc = Math.cos(arc.phi0) - Math.cos(arc.phi1);
    const d2 = 0.25 * (Math.sin(2 * arc.phi1) - Math.sin(2 * arc.phi0));
    volume = span * m10;
    fx = m20 * ds;
    fy = m20 * dc;
    fz = span * m11;
    xx = m30 * (0.5 * span + d2);
    yy = m30 * (0.5 * span - d2);
    zz = span * m12;
    xy = 0.5 * m30 * (Math.sin(arc.phi1) ** 2 - Math.sin(arc.phi0) ** 2);
    xz = m21 * ds;
    yz = m21 * dc;
  }
  // Stretch by (sx, sy): volume elements scale by sx sy, coordinates by sx and sy.
  const { sx, sy } = s;
  const j = sx * sy;
  return {
    volume: j * volume,
    first: [j * sx * fx, j * sy * fy, j * fz],
    second: [
      j * sx * sx * xx,
      j * sx * sy * xy,
      j * sx * xz,
      j * sx * sy * xy,
      j * sy * sy * yy,
      j * sy * yz,
      j * sx * xz,
      j * sy * yz,
      j * zz,
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Capsule
// ---------------------------------------------------------------------------------------------

function addCapsule(acc: Accumulator, a: Vec3, b: Vec3, radius: number): void {
  const ex = b[0] - a[0];
  const ey = b[1] - a[1];
  const ez = b[2] - a[2];
  const length = Math.hypot(ex, ey, ez);
  const e: Vec3 = length > 0 ? [ex / length, ey / length, ez / length] : [0, 0, 1];
  const c: Vec3 = [0.5 * (a[0] + b[0]), 0.5 * (a[1] + b[1]), 0.5 * (a[2] + b[2])];
  const r2 = radius * radius;
  const r3 = r2 * radius;
  const r5 = r3 * r2;
  const volume = Math.PI * r2 * length + (4 / 3) * Math.PI * r3;
  // Second moments about the centre: across the axis and along it.
  const across = Math.PI * r2 * length * (r2 / 4) + (4 * Math.PI * r5) / 15;
  const along =
    (Math.PI * r2 * length ** 3) / 12 +
    2 *
      (((length * length) / 4) * ((2 * Math.PI * r3) / 3) +
        length * ((Math.PI * r2 * r2) / 4) +
        (2 * Math.PI * r5) / 15);
  acc.v += volume;
  addFirst(acc, c, volume);
  // across * (1 - e e^T) + along * e e^T + volume * c c^T
  acc.s[0] += across;
  acc.s[1] += across;
  acc.s[2] += across;
  addSymOuter(acc, e, e, along - across);
  addSymOuter(acc, c, c, volume);
}

// ---------------------------------------------------------------------------------------------
// Polytope + ball
// ---------------------------------------------------------------------------------------------

function addPolytopeCore(acc: Accumulator, core: Polytope): void {
  // Tetrahedra from the mean of the vertices to a fan of every face.
  let ox = 0;
  let oy = 0;
  let oz = 0;
  for (const v of core.vertices) {
    ox += v[0];
    oy += v[1];
    oz += v[2];
  }
  const n = core.vertices.length;
  const o: Vec3 = [ox / n, oy / n, oz / n];
  for (const face of core.faces) {
    const p0 = core.vertices[face.loop[0] as number] as Vec3;
    for (let i = 1; i + 1 < face.loop.length; i++) {
      const p1 = core.vertices[face.loop[i] as number] as Vec3;
      const p2 = core.vertices[face.loop[i + 1] as number] as Vec3;
      const ax = p0[0] - o[0];
      const ay = p0[1] - o[1];
      const az = p0[2] - o[2];
      const bx = p1[0] - o[0];
      const by = p1[1] - o[1];
      const bz = p1[2] - o[2];
      const cx = p2[0] - o[0];
      const cy = p2[1] - o[1];
      const cz = p2[2] - o[2];
      const vol =
        (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6;
      const sum: Vec3 = [
        o[0] + p0[0] + p1[0] + p2[0],
        o[1] + p0[1] + p1[1] + p2[1],
        o[2] + p0[2] + p1[2] + p2[2],
      ];
      acc.v += vol;
      addFirst(acc, sum, vol / 4);
      // Integral of x x^T over a tetrahedron: V / 20 * (sum of p p^T + s s^T).
      for (const p of [o, p0, p1, p2]) addSymOuter(acc, p, p, vol / 20);
      addSymOuter(acc, sum, sum, vol / 20);
    }
  }
}

function addFacePrism(acc: Accumulator, core: Polytope, face: PolyFace, r: number): void {
  let area = 0;
  const first: [number, number, number] = [0, 0, 0];
  const flat = newAccumulator();
  const p0 = core.vertices[face.loop[0] as number] as Vec3;
  for (let i = 1; i + 1 < face.loop.length; i++) {
    const p1 = core.vertices[face.loop[i] as number] as Vec3;
    const p2 = core.vertices[face.loop[i + 1] as number] as Vec3;
    const ux = p1[0] - p0[0];
    const uy = p1[1] - p0[1];
    const uz = p1[2] - p0[2];
    const vx = p2[0] - p0[0];
    const vy = p2[1] - p0[1];
    const vz = p2[2] - p0[2];
    const a = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    const sum: Vec3 = [p0[0] + p1[0] + p2[0], p0[1] + p1[1] + p2[1], p0[2] + p1[2] + p2[2]];
    area += a;
    first[0] += (a * sum[0]) / 3;
    first[1] += (a * sum[1]) / 3;
    first[2] += (a * sum[2]) / 3;
    // Integral of x x^T over a triangle: A / 12 * (sum of p p^T + s s^T).
    for (const p of [p0, p1, p2]) addSymOuter(flat, p, p, a / 12);
    addSymOuter(flat, sum, sum, a / 12);
  }
  const n = face.normal;
  acc.v += area * r;
  addFirst(acc, first, r);
  addFirst(acc, n, 0.5 * r * r * area);
  for (let k = 0; k < 6; k++) acc.s[k] = (acc.s[k] as number) + r * (flat.s[k] as number);
  addSymOuter(acc, first, n, r * r);
  addSymOuter(acc, n, n, (r * r * r * area) / 3);
}

/** Integral of the unit direction along the normal arc of an edge. */
function arcIntegral(edge: PolyEdge): Vec3 {
  const s = Math.sin(edge.angle);
  const c = 1 - Math.cos(edge.angle);
  return [
    s * edge.u0[0] + c * edge.w[0],
    s * edge.u0[1] + c * edge.w[1],
    s * edge.u0[2] + c * edge.w[2],
  ];
}

function addEdgeWedge(acc: Accumulator, core: Polytope, edge: PolyEdge, r: number): void {
  const a = core.vertices[edge.a] as Vec3;
  const b = core.vertices[edge.b] as Vec3;
  const theta = edge.angle;
  const length = edge.length;
  const volume = 0.5 * length * theta * r * r;
  const mid: Vec3 = [0.5 * (a[0] + b[0]), 0.5 * (a[1] + b[1]), 0.5 * (a[2] + b[2])];
  const m = arcIntegral(edge);
  const gScale = (length * r * r * r) / 3;
  const g: Vec3 = [gScale * m[0], gScale * m[1], gScale * m[2]];
  acc.v += volume;
  addFirst(acc, mid, volume);
  addFirst(acc, g, 1);
  // Along the edge: integral of c c^T = (a a^T + b b^T) / 3 + (a b^T + b a^T) / 6.
  addSymOuter(acc, a, a, volume / 3);
  addSymOuter(acc, b, b, volume / 3);
  addSymOuter(acc, a, b, volume / 3);
  addSymOuter(acc, mid, g, 2);
  const q = (length * r ** 4) / 4;
  const s2 = 0.25 * Math.sin(2 * theta);
  addSymOuter(acc, edge.u0, edge.u0, q * (0.5 * theta + s2));
  addSymOuter(acc, edge.w, edge.w, q * (0.5 * theta - s2));
  addSymOuter(acc, edge.u0, edge.w, q * Math.sin(theta) ** 2);
}

function addVertexSector(acc: Accumulator, core: Polytope, v: number, r: number): void {
  const at = core.vertices[v] as Vec3;
  // Solid angle of the normal cone: the angular defect of the vertex.
  const omega = 2 * Math.PI - (core.angleSums[v] as number);
  // g = integral of u over the cone = -1/2 * sum of (arc angle) * (unit vector along the edge),
  // T = integral of u u^T = (omega 1 - sum of e (x) m) / 3 with m the arc integral of u.
  const g: [number, number, number] = [0, 0, 0];
  const t = newAccumulator();
  t.s[0] = omega / 3;
  t.s[1] = omega / 3;
  t.s[2] = omega / 3;
  for (const step of core.fans[v] as readonly { edge: number }[]) {
    const edge = core.edges[step.edge] as PolyEdge;
    const sign = edge.a === v ? 1 : -1;
    const e: Vec3 = [sign * edge.dir[0], sign * edge.dir[1], sign * edge.dir[2]];
    g[0] -= 0.5 * edge.angle * e[0];
    g[1] -= 0.5 * edge.angle * e[1];
    g[2] -= 0.5 * edge.angle * e[2];
    addSymOuter(t, e, arcIntegral(edge), -1 / 3);
  }
  const volume = (omega * r * r * r) / 3;
  acc.v += volume;
  addFirst(acc, at, volume);
  addFirst(acc, g, r ** 4 / 4);
  addSymOuter(acc, at, at, volume);
  addSymOuter(acc, at, g, r ** 4 / 2);
  for (let k = 0; k < 6; k++) acc.s[k] = (acc.s[k] as number) + (r ** 5 / 5) * (t.s[k] as number);
}

function addRoundedPolytope(acc: Accumulator, core: Polytope, r: number): void {
  if (core.dim === 3) addPolytopeCore(acc, core);
  if (!(r > 0)) return;
  for (const face of core.faces) addFacePrism(acc, core, face, r);
  for (const edge of core.edges) addEdgeWedge(acc, core, edge, r);
  for (let v = 0; v < core.vertices.length; v++) addVertexSector(acc, core, v, r);
}

function preparedMoments(prep: PreparedPrimitive): SolidMoments {
  if (prep.kind === 'sor') return sorMoments(prep);
  const acc = newAccumulator();
  if (prep.kind === 'capsule') {
    addCapsule(acc, prep.a, prep.b, prep.radius);
  } else {
    const core = prep.kind === 'rbox' ? prep.core() : prep.core;
    if (core.dim === 0) addCapsule(acc, core.centre, core.centre, prep.radius);
    else if (core.dim === 1) addCapsule(acc, core.a, core.b, prep.radius);
    else addRoundedPolytope(acc, core, prep.radius);
  }
  return finish(acc);
}

const momentCache = new WeakMap<Primitive, SolidMoments>();

/**
 * Volume, first moment and second-moment tensor of one primitive at unit density, about the
 * origin of its part frame (closed form; cached per primitive object).
 */
export function primitiveMoments(prim: Primitive): SolidMoments {
  let out = momentCache.get(prim);
  if (out === undefined) {
    out = preparedMoments(preparePrimitive(prim));
    momentCache.set(prim, out);
  }
  return out;
}

/** Volume of one primitive, m^3. */
export function primitiveVolume(prim: Primitive): number {
  return primitiveMoments(prim).volume;
}

/**
 * Sum of the volumes of the solid primitives of a shape, m^3: the space its parts take up,
 * perforations filled in. Overlaps between parts are counted once per part. See
 * {@link materialVolume} for the volume of material.
 */
export function shapeVolume(shape: Shape): number {
  let v = 0;
  for (const part of shape.parts) v += primitiveMoments(part.prim).volume;
  return v;
}

/** The share of a part's solid primitive that is material: `1 - porosity`. */
function solidFraction(part: Shape['parts'][number]): number {
  const porosity = part.porosity ?? 0;
  if (!(porosity >= 0 && porosity < 1)) {
    throw new RangeError(`geometry: part '${part.id}' has a porosity outside [0, 1)`);
  }
  return 1 - porosity;
}

/**
 * Volume of material of a shape, m^3: the sum over its parts of the volume of the primitive
 * times `1 - porosity` (the open-area fraction of perforated sheet and mesh taken out).
 * Overlaps between parts are counted once per part. The mass of a shape of one material is its
 * density times this. Throws a RangeError for a porosity outside [0, 1).
 */
export function materialVolume(shape: Shape): number {
  let v = 0;
  for (const part of shape.parts) v += primitiveMoments(part.prim).volume * solidFraction(part);
  return v;
}

/**
 * `computeMassProperties(shape, densityOf)`: total mass (kg), centre of mass (item frame, metres)
 * and inertia tensor about the centre of mass in item-frame axes (kg m^2). `densityOf` maps each
 * part's material id to the density of the bulk material in kg/m^3. A part with a porosity
 * counts with `density * (1 - porosity)`, spread evenly over its primitive: a perforated wall
 * weighs less by its open-area fraction and keeps its centre of mass. Throws a RangeError when
 * a density is not a positive finite number, a porosity is outside [0, 1) or the shape has no
 * parts.
 */
export function computeMassProperties(shape: Shape, densityOf: DensityLookup): MassProperties {
  if (shape.parts.length === 0) throw new RangeError('geometry: a shape needs at least one part');
  let mass = 0;
  let fx = 0;
  let fy = 0;
  let fz = 0;
  // Second-moment tensor of the mass distribution about the item-frame origin.
  const c = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const part of shape.parts) {
    const bulk = densityOf(part.material);
    if (!(bulk > 0) || !Number.isFinite(bulk)) {
      throw new RangeError(`geometry: material '${part.material}' has no positive finite density`);
    }
    const density = bulk * solidFraction(part);
    const m = primitiveMoments(part.prim);
    const rot = quatToMat3(part.pose.q);
    const p = part.pose.p;
    // x_item = p + R x: transform the three moments.
    const f = m.first;
    const rf: Vec3 = [
      rot[0] * f[0] + rot[1] * f[1] + rot[2] * f[2],
      rot[3] * f[0] + rot[4] * f[1] + rot[5] * f[2],
      rot[6] * f[0] + rot[7] * f[1] + rot[8] * f[2],
    ];
    mass += density * m.volume;
    fx += density * (m.volume * p[0] + rf[0]);
    fy += density * (m.volume * p[1] + rf[1]);
    fz += density * (m.volume * p[2] + rf[2]);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        // (R S R^T)_ij
        let rsr = 0;
        for (let a = 0; a < 3; a++) {
          for (let b = 0; b < 3; b++) {
            rsr +=
              (rot[3 * i + a] as number) *
              (m.second[3 * a + b] as number) *
              (rot[3 * j + b] as number);
          }
        }
        c[3 * i + j] =
          (c[3 * i + j] as number) +
          density *
            (rsr +
              m.volume * (p[i] as number) * (p[j] as number) +
              (p[i] as number) * (rf[j] as number) +
              (rf[i] as number) * (p[j] as number));
      }
    }
  }
  const com: Vec3 = [fx / mass, fy / mass, fz / mass];
  const trace = (c[0] as number) + (c[4] as number) + (c[8] as number);
  // Inertia about the origin: trace(C) 1 - C, with C symmetrised against rounding.
  const offXy = 0.5 * ((c[1] as number) + (c[3] as number));
  const offXz = 0.5 * ((c[2] as number) + (c[6] as number));
  const offYz = 0.5 * ((c[5] as number) + (c[7] as number));
  const aboutOrigin: Mat3 = [
    trace - (c[0] as number),
    -offXy,
    -offXz,
    -offXy,
    trace - (c[4] as number),
    -offYz,
    -offXz,
    -offYz,
    trace - (c[8] as number),
  ];
  return { mass, com, inertia: inertiaShiftToCom(aboutOrigin, mass, com) };
}
