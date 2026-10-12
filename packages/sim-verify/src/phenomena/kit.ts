/**
 * What the scenarios are written with: the soils of the checklist as the IEC load applies
 * them, ways of putting soils on the items of a load, and custom bands.
 *
 * "Oven-dried 2 h at 80 C" is the heat history `warm` of the soil model (80 C for 2 h) with an
 * age of 2 hours. Amounts are those of the IEC load (docs/research/standards.md section 13.3)
 * on a piece of that kind.
 */

import type { Expected, LoadItem, SoilSpec } from './types.ts';

/** Share of a region a soil covers, as the IEC load is soiled. */
const COVER = 0.6;

/** Egg yolk, oven-dried (protein: swells, then enzymatic). */
export const egg = (region: string, amount_g = 2): SoilSpec => ({
  type: 'iec_egg_yolk',
  regions: { [region]: COVER },
  amount_g,
});

/** Oat-flake porridge, oven-dried (starch). */
export const oats = (region: string, amount_g = 2): SoilSpec => ({
  type: 'iec_oat_flakes',
  regions: { [region]: COVER },
  amount_g,
});

/** Tea film, oven-dried (bleachable stain). */
export const tea = (region: string): SoilSpec => ({
  type: 'iec_tea',
  regions: { [region]: COVER },
});

/** Milk, 10 mL dried on in a microwave oven (baked protein film on glass). */
export const milk = (region: string, amount_g = 10): SoilSpec => ({
  type: 'iec_milk',
  regions: { [region]: 0.5 },
  amount_g,
  heat: 'baked',
});

/** Margarine, fresh (fat). */
export const margarine = (region: string, amount_g = 2): SoilSpec => ({
  type: 'iec_margarine',
  regions: { [region]: COVER },
  amount_g,
  age_h: 0,
  heat: 'none',
});

/** Soils by item id; an item that is not named is clean. */
export function byId(
  map: Readonly<Record<string, readonly SoilSpec[]>>,
): (item: LoadItem) => readonly SoilSpec[] {
  return (item) => map[item.itemId] ?? [];
}

/** The same soils on every item whose id starts with a prefix; the others are clean. */
export function byPrefix(
  prefix: string,
  soils: readonly SoilSpec[],
): (item: LoadItem) => readonly SoilSpec[] {
  return (item) => (item.itemId.startsWith(prefix) ? soils : []);
}

/** A band given directly: a sign and the accepted magnitudes, with the reason for them. */
export function band(
  sign: -1 | 0 | 1,
  min: number,
  max: number,
  stated: string,
  tolerance: string,
): Expected {
  return { stated, sign, min, max, tolerance };
}
