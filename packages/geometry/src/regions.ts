/**
 * Shape validation and the rules that assign a patch of surface to a `SurfaceRegion`.
 *
 * A region selects parts by id (or by a prefix ending in `'*'`) and, within them, a side and a
 * stretch of the profile:
 *  - sor parts: `side` is the side of the mid-surface (`'in'` is the side of the profile's left
 *    normal when walking from the axis end to the rim end) and `sRange` the normalised
 *    mid-surface arc length. The two flat end faces of a partial shell are on neither side and
 *    have no arc length: they belong only to regions that cover the whole profile.
 *  - rbox and hull parts: `'in'` is the part of the surface whose outward normal has a positive
 *    component along the part frame's +z axis, `'out'` the part with a negative one; surface
 *    whose normal is perpendicular to z (the edge faces of a slab) is on neither side.
 *    `sRange` is ignored.
 *  - capsule parts have no sides; `sRange` is ignored.
 * A patch on neither side belongs only to regions whose side is `'both'` (the default). When
 * several regions match, the first one in `shape.regions` wins, so the order is a priority.
 */

import type { Shape, SurfaceRegion } from './types.ts';

/** Side of a surface patch as seen by the region rules. */
export type PatchSide = 'in' | 'out' | 'none';

/** Outward normals with a |z| component below this are on neither side of an rbox or hull. */
export const SIDE_NORMAL_TOLERANCE = 1e-9;

/** Side of a patch of an rbox or hull part from the z component of its part-frame normal. */
export function sideOfNormalZ(nz: number): PatchSide {
  return nz > SIDE_NORMAL_TOLERANCE ? 'in' : nz < -SIDE_NORMAL_TOLERANCE ? 'out' : 'none';
}

/**
 * True when the part id `id` is selected by `selector`: an exact part id, or a prefix ending in
 * `'*'` that selects every part whose id starts with it (`'*'` alone selects every part). This
 * is the rule of `SurfaceRegion.part`.
 */
export function partSelectorMatches(selector: string, id: string): boolean {
  return selector.endsWith('*') ? id.startsWith(selector.slice(0, -1)) : selector === id;
}

/**
 * True when the region id `id` matches `pattern`, in which every `*` stands for any run of
 * characters, an empty one included. This is the rule of `RegionRename.from`.
 */
export function regionIdMatches(pattern: string, id: string): boolean {
  const pieces = pattern.split('*');
  if (pieces.length === 1) return pattern === id;
  const first = pieces[0] as string;
  const last = pieces[pieces.length - 1] as string;
  if (!id.startsWith(first) || id.length < first.length + last.length) return false;
  // The pieces between the first and the last must occur in order, leftmost first.
  let at = first.length;
  for (let i = 1; i < pieces.length - 1; i++) {
    const found = id.indexOf(pieces[i] as string, at);
    if (found < 0) return false;
    at = found + (pieces[i] as string).length;
  }
  return id.endsWith(last) && id.length - last.length >= at;
}

/**
 * Tolerance, in normalised arc length, within which a patch counts as lying on a region bound.
 * Far above the rounding of an arc length (1e-16) and far below any stretch of a profile.
 */
export const REGION_BOUND_TOLERANCE = 1e-9;

/** Region rules of a shape, resolved against its parts. */
export interface RegionRules {
  /**
   * Index into `shape.regions` of the region a patch belongs to, or -1. `s` is the normalised
   * mid-surface arc length of the patch: a number for the revolved surface of a sor part,
   * `undefined` for the end faces of a partial shell and for every other kind of part.
   */
  regionOf(partIndex: number, side: PatchSide, s: number | undefined): number;
  /**
   * The arc lengths strictly between 0 and 1 at which the regions of a sor part begin or end,
   * ascending and without duplicates.
   */
  arcLengthCuts(partIndex: number): number[];
}

const checked = new WeakMap<Shape, RegionRules>();

/**
 * Validates a shape and resolves its region rules (cached per shape object). Throws a RangeError
 * when the shape has no parts, two parts share an id, a porosity is outside [0, 1), a region has
 * an invalid side or arc-length range, or a region selects no part.
 */
export function shapeRegionRules(shape: Shape): RegionRules {
  const cached = checked.get(shape);
  if (cached !== undefined) return cached;
  if (shape.parts.length === 0) throw new RangeError('geometry: a shape needs at least one part');
  const ids = new Set<string>();
  for (const part of shape.parts) {
    if (part.id.length === 0) throw new RangeError('geometry: a part needs a non-empty id');
    if (ids.has(part.id)) throw new RangeError(`geometry: duplicate part id '${part.id}'`);
    ids.add(part.id);
    if (part.porosity !== undefined && !(part.porosity >= 0 && part.porosity < 1)) {
      throw new RangeError(`geometry: part '${part.id}' has a porosity outside [0, 1)`);
    }
  }
  // Per part: the regions that select it, in priority order.
  const perPart: { index: number; region: SurfaceRegion; lo: number; hi: number }[][] =
    shape.parts.map(() => []);
  shape.regions.forEach((region, index) => {
    const side = region.side ?? 'both';
    if (side !== 'in' && side !== 'out' && side !== 'both') {
      throw new RangeError(`geometry: region '${region.id}' has an invalid side`);
    }
    const lo = region.sRange?.[0] ?? 0;
    const hi = region.sRange?.[1] ?? 1;
    if (!(lo >= 0) || !(hi <= 1) || !(lo < hi)) {
      throw new RangeError(`geometry: region '${region.id}' needs 0 <= sRange[0] < sRange[1] <= 1`);
    }
    let matched = false;
    shape.parts.forEach((part, p) => {
      if (!partSelectorMatches(region.part, part.id)) return;
      matched = true;
      (perPart[p] as (typeof perPart)[number]).push({ index, region, lo, hi });
    });
    if (!matched) {
      throw new RangeError(`geometry: region '${region.id}' selects no part ('${region.part}')`);
    }
  });
  const isSor = shape.parts.map((part) => part.prim.kind === 'sor');
  const rules: RegionRules = {
    regionOf(partIndex, side, s) {
      for (const entry of perPart[partIndex] ?? []) {
        const want = entry.region.side ?? 'both';
        if (want !== 'both' && want !== side) continue;
        if (s !== undefined) {
          // With a tolerance: region bounds normally sit exactly on a profile vertex, where
          // the bound and the kernel's arc length are two different roundings of one number,
          // and the rounded join at that vertex must not change region with the last bit. A
          // patch on a bound belongs to both stretches, so to the first region listed.
          if (s < entry.lo - REGION_BOUND_TOLERANCE || s > entry.hi + REGION_BOUND_TOLERANCE) {
            continue;
          }
        } else if (isSor[partIndex] === true && (entry.lo > 0 || entry.hi < 1)) {
          // An end face of a partial shell: only regions covering the whole profile.
          continue;
        }
        return entry.index;
      }
      return -1;
    },
    arcLengthCuts(partIndex) {
      const cuts = new Set<number>();
      for (const entry of perPart[partIndex] ?? []) {
        if (entry.lo > 0) cuts.add(entry.lo);
        if (entry.hi < 1) cuts.add(entry.hi);
      }
      return [...cuts].sort((a, b) => a - b);
    },
  };
  checked.set(shape, rules);
  return rules;
}
