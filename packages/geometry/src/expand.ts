/**
 * Parametric item expansion (docs/design/platform.md section 4.3): `expandGeometry(def)` turns a
 * definition of one of the item classes into a `Shape`, the single description every derived
 * product is computed from.
 *
 * The definitions handled here are in SI units (the `GeometryDef` types of `types.ts`).
 * Catalogue files are authored in millimetres and degrees; `authoring.ts` holds those types and
 * the conversion.
 *
 * Every class supplies default surface regions unless the definition lists its own. Part ids and
 * default regions are documented with each class (`expand-sor.ts`, `expand-box.ts`,
 * `expand-rod.ts`, and below for the three small classes).
 *
 * The item frame is the definition's: z = 0 is the plane the item rests on when upright. A
 * `sor`, `box_shell` or `slab` stands on it by construction; for a `rod`, a `wire` and a
 * `compound` it is up to the author to place the nodes and children accordingly.
 */

import { poseCompose, type Vec3 } from '@spotless/core';
import { expandBoxShell } from './expand-box.ts';
import { expandRod } from './expand-rod.ts';
import { expandSor } from './expand-sor.ts';
import { requireFiniteVec, requireNonNegative, requirePositive } from './expand-util.ts';
import { regionIdMatches, shapeRegionRules } from './regions.ts';
import type {
  CompoundDef,
  GeometryDef,
  Part,
  Primitive,
  RegionRename,
  Shape,
  SlabDef,
  SurfaceRegion,
  WireDef,
} from './types.ts';

/**
 * The solid of a slab about its own centre: a rounded box or, with corners cut, the rounded
 * hull of the polygon that is left, each edge of which is `edgeRadius` inside the outline.
 */
function slabPrimitive(def: SlabDef): Primitive {
  const r = def.edgeRadius;
  const hx = def.length / 2 - r;
  const hy = def.width / 2 - r;
  const hz = def.thickness / 2 - r;
  const cuts = def.cornerCuts;
  if (cuts === undefined || cuts.every((cut) => cut === 0)) {
    return { kind: 'rbox', halfExtents: [hx, hy, hz], radius: r };
  }
  // Corner k is towards (sx, sy). Moving the two edges and the cut line in by r shortens a cut
  // of c to c - (2 - sqrt(2)) r.
  const signs: readonly (readonly [number, number])[] = [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ];
  const outline: [number, number][] = [];
  cuts.forEach((cut, k) => {
    requireNonNegative(cut, 'slab corner cut');
    const [sx, sy] = signs[k] as readonly [number, number];
    const c = cut - (2 - Math.SQRT2) * r;
    if (cut > 0 && !(c > 0)) {
      throw new RangeError('geometry: a slab corner cut must exceed 0.59 times the edge radius');
    }
    if (!(c > 0)) {
      outline.push([sx * hx, sy * hy]);
      return;
    }
    // Counter-clockwise: at the corners towards (+,+) and (-,-) the edge along y comes first.
    const alongY: [number, number] = [sx * hx, sy * (hy - c)];
    const alongX: [number, number] = [sx * (hx - c), sy * hy];
    if (sx * sy > 0) outline.push(alongY, alongX);
    else outline.push(alongX, alongY);
  });
  for (let k = 0; k < 4; k++) {
    // Two cuts that share an edge must leave some of it.
    const a = cuts[k] as number;
    const b = cuts[(k + 1) % 4] as number;
    const edge = k % 2 === 0 ? def.length : def.width;
    if (a + b > edge - 2 * r + 1e-12) {
      throw new RangeError('geometry: the corner cuts of a slab leave nothing of an edge');
    }
  }
  const points: Vec3[] = [];
  for (const [x, y] of outline) {
    if (hz > 0) points.push([x, y, hz], [x, y, -hz]);
    else points.push([x, y, 0]);
  }
  return { kind: 'hull', points, radius: r };
}

/**
 * A slab is one part, `body`: a rounded box lying on z = 0, or a rounded polygon when corners
 * are cut. Default regions: `top` (the +z face with the upper half of the edge rounding),
 * `underside` and `edge` (the upright faces).
 */
function expandSlab(def: SlabDef): Shape {
  requirePositive(def.length, 'slab length');
  requirePositive(def.width, 'slab width');
  requirePositive(def.thickness, 'slab thickness');
  requireNonNegative(def.edgeRadius, 'slab edge radius');
  if (def.porosity !== undefined) requireNonNegative(def.porosity, 'porosity');
  const r = def.edgeRadius;
  if (r > def.thickness / 2 || r > def.length / 2 || r > def.width / 2) {
    throw new RangeError('geometry: slab edge radius exceeds half of its smallest size');
  }
  const part: Part = {
    id: 'body',
    prim: slabPrimitive(def),
    pose: { p: [0, 0, def.thickness / 2], q: [0, 0, 0, 1] },
    material: def.material,
    ...(def.porosity === undefined ? {} : { porosity: def.porosity }),
  };
  const regions: SurfaceRegion[] = [
    { id: 'top', part: 'body', side: 'in' },
    { id: 'underside', part: 'body', side: 'out' },
    { id: 'edge', part: 'body' },
  ];
  return { parts: [part], regions: def.regions ?? regions };
}

/**
 * A wire item is capsule chains: polyline `i` gives parts `wire.i.0`, `wire.i.1`, ..., one per
 * straight run (a closed polyline has one more, back to its start; a polyline of a single point
 * is a ball). Default region: `wire`, everything.
 */
function expandWire(def: WireDef): Shape {
  if (def.wires.length === 0) throw new RangeError('geometry: a wire item needs at least one wire');
  if (def.porosity !== undefined) requireNonNegative(def.porosity, 'porosity');
  const parts: Part[] = [];
  const extra = def.porosity === undefined ? {} : { porosity: def.porosity };
  def.wires.forEach((wire, i) => {
    requirePositive(wire.radius, `radius of wire ${i}`);
    if (wire.points.length === 0) throw new RangeError(`geometry: wire ${i} has no points`);
    wire.points.forEach((p, j) => requireFiniteVec(p, `point ${j} of wire ${i}`));
    const runs: [Vec3, Vec3][] = [];
    for (let j = 0; j + 1 < wire.points.length; j++) {
      runs.push([wire.points[j] as Vec3, wire.points[j + 1] as Vec3]);
    }
    if (wire.closed === true && wire.points.length > 2) {
      runs.push([wire.points[wire.points.length - 1] as Vec3, wire.points[0] as Vec3]);
    }
    if (runs.length === 0) runs.push([wire.points[0] as Vec3, wire.points[0] as Vec3]);
    runs.forEach(([a, b], j) => {
      parts.push({
        id: `wire.${i}.${j}`,
        prim: { kind: 'capsule', a, b, radius: wire.radius },
        pose: { p: [0, 0, 0], q: [0, 0, 0, 1] },
        material: def.material,
        ...extra,
      });
    });
  });
  return { parts, regions: def.regions ?? [{ id: 'wire', part: 'wire*' }] };
}

/**
 * Applies the rename rules of a compound to its regions (see `CompoundDef.regionRenames`): the
 * first rule whose pattern matches a region id renames it; a region no rule matches keeps its
 * id. Throws a RangeError for an empty pattern or name and for a rule that renames nothing.
 */
function renameRegions(
  regions: readonly SurfaceRegion[],
  renames: readonly RegionRename[],
): SurfaceRegion[] {
  const used = renames.map(() => false);
  renames.forEach((rule) => {
    if (rule.from.length === 0 || rule.to.length === 0) {
      throw new RangeError('geometry: a region rename needs a pattern and a name');
    }
  });
  const out = regions.map((region): SurfaceRegion => {
    const index = renames.findIndex((rule) => regionIdMatches(rule.from, region.id));
    if (index < 0) return region;
    used[index] = true;
    return { ...region, id: (renames[index] as RegionRename).to };
  });
  const unused = used.indexOf(false);
  if (unused >= 0) {
    throw new RangeError(
      `geometry: region rename '${(renames[unused] as RegionRename).from}' renames no region`,
    );
  }
  return out;
}

/**
 * A compound joins the shapes of its children rigidly. The parts and regions of the child with
 * id `c` are renamed `c.<id>` (and its region part selectors `c.<selector>`), and its parts are
 * moved by the child's pose. `regionRenames` then gives regions the names of the whole item,
 * which is how a region comes to span several children.
 */
function expandCompound(def: CompoundDef): Shape {
  if (def.children.length === 0)
    throw new RangeError('geometry: a compound needs at least one child');
  const seen = new Set<string>();
  const parts: Part[] = [];
  let regions: SurfaceRegion[] = [];
  for (const child of def.children) {
    if (child.id.length === 0 || child.id.includes('*')) {
      throw new RangeError(`geometry: invalid compound child id '${child.id}'`);
    }
    if (seen.has(child.id))
      throw new RangeError(`geometry: duplicate compound child id '${child.id}'`);
    seen.add(child.id);
    const shape = expandGeometry(child.def);
    for (const part of shape.parts) {
      parts.push({
        ...part,
        id: `${child.id}.${part.id}`,
        pose: poseCompose(child.pose, part.pose),
      });
    }
    for (const region of shape.regions) {
      regions.push({
        ...region,
        id: `${child.id}.${region.id}`,
        part: `${child.id}.${region.part}`,
      });
    }
  }
  if (def.regionRenames !== undefined) regions = renameRegions(regions, def.regionRenames);
  return { parts, regions };
}

/**
 * `expandGeometry(def)`: the shape described by a parametric definition (SI units). Throws a
 * RangeError when the definition is malformed: a size that is not positive, a handle that leaves
 * no opening, a region that selects no part, and so on. These are data errors, never player
 * errors.
 */
export function expandGeometry(def: GeometryDef): Shape {
  let shape: Shape;
  switch (def.class) {
    case 'sor':
      shape = expandSor(def);
      break;
    case 'box_shell':
      shape = expandBoxShell(def);
      break;
    case 'slab':
      shape = expandSlab(def);
      break;
    case 'rod':
      shape = expandRod(def);
      break;
    case 'wire':
      shape = expandWire(def);
      break;
    case 'compound':
      shape = expandCompound(def);
      break;
  }
  shapeRegionRules(shape); // validates ids and regions
  return shape;
}
