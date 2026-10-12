/**
 * Which `SurfaceRegion` a patch of surface belongs to: the rules of docs/design/platform.md
 * section 4.1, as `@spotless/geometry` applies them to its render mesh and its areas (the
 * kernel's own resolver is not exported; `surfaceRegionAt` is, and the tests of this package
 * hold the two to each other).
 *
 * A region selects parts by id or prefix and, within them, a side and a stretch of the profile.
 * The first region in `shape.regions` that selects a patch wins.
 */

import { partSelectorMatches, type Shape } from '@spotless/geometry';

/** Side of a patch as the region rules see it. */
export type RuleSide = 'in' | 'out' | 'none';

/** Outward normals with a |z| component below this are on neither side of an rbox or hull. */
export const SIDE_NORMAL_TOLERANCE = 1e-9;

/** Side of a patch of an rbox or hull part from the z component of its part-frame normal. */
export function sideOfNormalZ(nz: number): RuleSide {
  return nz > SIDE_NORMAL_TOLERANCE ? 'in' : nz < -SIDE_NORMAL_TOLERANCE ? 'out' : 'none';
}

/**
 * Returns the resolver of a shape: `(partIndex, side, s)` to the index into `shape.regions` of
 * the region the patch belongs to, or -1. `s` is the normalised mid-surface arc length for the
 * revolved surface of a shell, `undefined` for the end faces of a partial shell and for every
 * other kind of part.
 */
export function regionResolver(
  shape: Shape,
): (partIndex: number, side: RuleSide, s: number | undefined) => number {
  const perPart: { index: number; side: string; lo: number; hi: number }[][] = shape.parts.map(
    () => [],
  );
  shape.regions.forEach((region, index) => {
    shape.parts.forEach((part, p) => {
      if (!partSelectorMatches(region.part, part.id)) return;
      (perPart[p] as (typeof perPart)[number]).push({
        index,
        side: region.side ?? 'both',
        lo: region.sRange?.[0] ?? 0,
        hi: region.sRange?.[1] ?? 1,
      });
    });
  });
  const isSor = shape.parts.map((part) => part.prim.kind === 'sor');
  return (partIndex, side, s) => {
    for (const entry of perPart[partIndex] ?? []) {
      if (entry.side !== 'both' && entry.side !== side) continue;
      if (s !== undefined) {
        if (s < entry.lo || s > entry.hi) continue;
      } else if (isSor[partIndex] === true && (entry.lo > 0 || entry.hi < 1)) {
        continue;
      }
      return entry.index;
    }
    return -1;
  };
}

/** The resolver of {@link regionSetResolver}. */
export interface RegionSetResolver {
  /**
   * `(partIndex, side, s)` (as for {@link regionResolver}) to the index into `sets` of the set of
   * every region that holds the patch.
   */
  readonly resolve: (partIndex: number, side: RuleSide, s: number | undefined) => number;
  /** The distinct sets met so far, each a list of ascending indices into `shape.regions`; set 0 is empty. */
  readonly sets: number[][];
}

/**
 * Like {@link regionResolver}, but for every region that selects a patch, not the first alone:
 * the regions of a shape may overlap (a region `all` over the regions `inside` and `outside`),
 * and soil placed on any of them lies on the patch.
 */
export function regionSetResolver(shape: Shape): RegionSetResolver {
  const perPart: { index: number; side: string; lo: number; hi: number }[][] = shape.parts.map(
    () => [],
  );
  shape.regions.forEach((region, index) => {
    shape.parts.forEach((part, p) => {
      if (!partSelectorMatches(region.part, part.id)) return;
      (perPart[p] as (typeof perPart)[number]).push({
        index,
        side: region.side ?? 'both',
        lo: region.sRange?.[0] ?? 0,
        hi: region.sRange?.[1] ?? 1,
      });
    });
  });
  const isSor = shape.parts.map((part) => part.prim.kind === 'sor');
  const sets: number[][] = [[]];
  const known = new Map<string, number>([['', 0]]);
  return {
    sets,
    resolve: (partIndex, side, s) => {
      const members: number[] = [];
      for (const entry of perPart[partIndex] ?? []) {
        if (entry.side !== 'both' && entry.side !== side) continue;
        if (s !== undefined) {
          if (s < entry.lo || s > entry.hi) continue;
        } else if (isSor[partIndex] === true && (entry.lo > 0 || entry.hi < 1)) {
          continue;
        }
        members.push(entry.index);
      }
      const key = members.join(',');
      let index = known.get(key);
      if (index === undefined) {
        index = sets.length;
        sets.push(members);
        known.set(key, index);
      }
      return index;
    },
  };
}
