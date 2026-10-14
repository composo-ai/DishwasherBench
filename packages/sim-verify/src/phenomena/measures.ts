/**
 * The quantities the checks compare, read from a wash as run, and the ways two washes are
 * compared. Everything here reads results; nothing computes physics.
 *
 * Also {@link hasCapability}: whether a wash result carries what a mechanism that is out of
 * scope (docs/design/scope.md) would report; no wash result does. The field names are those of
 * the result contract of docs/design/sim-core.md section 5.6.
 */

import { poseTransformPoint, type Vec3 } from '@spotless/core';
import type { ItemWashResult, WashResult } from '@spotless/sim-core';
import type { Capability, CaseRun, Check, Expected, Measured, Runs } from './types.ts';

/** Where each out-of-scope mechanism would report, as a probe of a wash result. */
const CAPABILITY_PROBES: Readonly<Record<Capability, (result: WashResult) => boolean>> = {
  // `ItemWashResult.drying`: the drying score of the item (0, 1 or 2) and its wet marks.
  drying: (result) => result.items.some((item) => 'drying' in item),
  // `ItemWashResult.redeposited`: specks of circulating soil that settled on the item.
  redeposition: (result) => result.items.some((item) => 'redeposited' in item),
  // `ItemWashResult.moved`: the item's pose after the wash where the jets moved it.
  item_motion: (result) => result.items.some((item) => 'moved' in item),
  // `MachineWashResult.soil.flaked_mg`: soil that left as flakes.
  flaking: (result) => 'flaked_mg' in result.machine.soil,
  // `ItemWashResult.spots`: spots and film left by evaporated water.
  spotting: (result) => result.items.some((item) => 'spots' in item),
  // `MachineWashResult.tablet`: where the tablet landed and how it dissolved there.
  tablet_transport: (result) => 'tablet' in result.machine,
};

/** True when the result of a wash carries what the mechanism would report. */
export function hasCapability(result: WashResult, capability: Capability): boolean {
  return CAPABILITY_PROBES[capability](result);
}

/** What each out-of-scope mechanism is, in words, for a report. */
export const CAPABILITY_NAMES: Readonly<Record<Capability, string>> = {
  drying: 'drying (evaporation of the retained film, the drying score, drips after the last drain)',
  redeposition:
    'redeposition of particles (soil carried by the liquor and settled on other surfaces)',
  item_motion:
    'items moved by the jets (the load is washed where it was placed; only a lift ratio is reported)',
  flaking: 'detachment of thick layers as flakes',
  spotting: 'spots and film from evaporated water, and marks at contacts',
  tablet_transport:
    'where the tablet lands and how it dissolves there (the wash only knows whether the dispenser is blocked)',
};

/** An out-of-scope field the result contract does not have, read without a type: NaN. */
export function absentField(item: ItemWashResult, field: string, member: string): number {
  const record = (item as unknown as Record<string, unknown>)[field];
  if (typeof record === 'number') return record;
  if (typeof record === 'object' && record !== null) {
    const value = (record as Record<string, unknown>)[member];
    if (typeof value === 'number') return value;
  }
  return Number.NaN;
}

// ---------------------------------------------------------------------------------------------
// Quantities of one wash
// ---------------------------------------------------------------------------------------------

/** IEC score of an item. */
export const score = (run: CaseRun, itemId: string): number => run.item(itemId).score;

/** Mean IEC score of some items (of all soiled items of the wash when none are named). */
export function meanScore(run: CaseRun, itemIds?: readonly string[]): number {
  const items =
    itemIds === undefined
      ? run.result.items.filter((item) => item.initialMass_mg > 0)
      : itemIds.map((id) => run.item(id));
  if (items.length === 0) return Number.NaN;
  return items.reduce((sum, item) => sum + item.score, 0) / items.length;
}

/** Share of the dry soil of an item (of one catalogue soil when named) that is still on it. */
export function residualFraction(run: CaseRun, itemId: string, soilType?: string): number {
  const item = run.item(itemId);
  let initial = 0;
  let left = 0;
  for (const soil of item.soils) {
    if (soilType !== undefined && soil.type !== soilType) continue;
    initial += soil.initialMass_mg;
    left += soil.residualMass_mg;
  }
  return initial > 0 ? left / initial : Number.NaN;
}

/** Share of the dry soil of a region of an item that is still on it. */
export function regionResidual(run: CaseRun, itemId: string, region: string): number {
  const found = run.item(itemId).regions.find((r) => r.regionId === region);
  if (found === undefined || !(found.initialMass_mg > 0)) return Number.NaN;
  return found.residualMass_mg / found.initialMass_mg;
}

/** Mean of a quantity over some items. */
export function meanOver(
  run: CaseRun,
  itemIds: readonly string[],
  of: (run: CaseRun, itemId: string) => number,
): number {
  if (itemIds.length === 0) return Number.NaN;
  return itemIds.reduce((sum, id) => sum + of(run, id), 0) / itemIds.length;
}

/** Water standing in the cavities of an item at the end, mL. */
export const pooled = (run: CaseRun, itemId: string): number => run.item(itemId).water.pooled_mL;

/** Water left as film on an item at the end of the last rinse, grams. */
export const film = (run: CaseRun, itemId: string): number => run.item(itemId).water.film_g;

/** Fraction of the circulation time the named regions of an item are under a direct jet. */
export const fJet = (run: CaseRun, itemId: string, regions?: readonly string[]): number =>
  run.exposure(itemId, regions).fJet;

/** IEC score for a visibly soiled area, with the bands of `inspect.areaBandsMm2` (defaults). */
export function scoreOfArea(
  areaMm2: number,
  bands: readonly number[] = [0, 4, 20, 50, 200],
): number {
  for (let i = 0; i < bands.length; i++) if (areaMm2 <= (bands[i] as number)) return 5 - i;
  return Math.max(0, 5 - bands.length);
}

/**
 * The soil of the part of an item that lies in a zone: the soil elements whose centre, in the
 * tub frame, satisfies `inZone`. Needs the per-cell arrays (`CaseSpec.cells`). Returns the
 * visibly soiled area (mm2), the IEC score of that area alone, and the residual share of the
 * dry soil that lay in the zone.
 */
export function zone(
  run: CaseRun,
  itemId: string,
  inZone: (point: Vec3) => boolean,
): { visibleArea_mm2: number; score: number; residual: number } {
  const item = run.item(itemId);
  const cells = item.cells;
  const pose = run.items.find((i) => i.itemId === itemId)?.pose;
  if (cells === undefined || pose === undefined) {
    throw new Error(`the wash of ${run.load.name} carries no per-cell arrays for ${itemId}`);
  }
  const classes = cells.count > 0 ? cells.initial_mg_cm2.length / cells.count : 0;
  let visible = 0;
  let initial = 0;
  let left = 0;
  for (let e = 0; e < cells.count; e++) {
    const point = poseTransformPoint(pose, [
      cells.centre[3 * e] as number,
      cells.centre[3 * e + 1] as number,
      cells.centre[3 * e + 2] as number,
    ]);
    if (!inZone(point)) continue;
    const area = cells.areaMm2[e] as number;
    if (cells.visible[e] === 1) visible += area;
    for (let k = 0; k < classes; k++) {
      initial += (cells.initial_mg_cm2[classes * e + k] as number) * area;
      left += (cells.residual_mg_cm2[classes * e + k] as number) * area;
    }
  }
  return {
    visibleArea_mm2: visible,
    score: scoreOfArea(visible),
    residual: initial > 0 ? left / initial : Number.NaN,
  };
}

/** Standard deviation of some numbers (population form; 0 for fewer than two). */
export function spread(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / values.length);
}

// ---------------------------------------------------------------------------------------------
// Comparisons
// ---------------------------------------------------------------------------------------------

function runOf(runs: Runs, label: string): CaseRun {
  const run = runs[label];
  if (run === undefined) throw new Error(`the scenario has no wash '${label}'`);
  return run;
}

/** The difference of a quantity between two washes, second minus first. */
export function difference(
  first: string,
  second: string,
  of: (run: CaseRun) => number,
): (runs: Runs) => Measured {
  return (runs) => {
    const a = of(runOf(runs, first));
    const b = of(runOf(runs, second));
    return { a, b, value: b - a };
  };
}

/** The relative change of a quantity between two washes: second over first, minus one. */
export function relative(
  first: string,
  second: string,
  of: (run: CaseRun) => number,
): (runs: Runs) => Measured {
  return (runs) => {
    const a = of(runOf(runs, first));
    const b = of(runOf(runs, second));
    return { a, b, value: a !== 0 ? b / a - 1 : b === 0 ? 0 : Number.POSITIVE_INFINITY };
  };
}

/** A quantity of two washes as a ratio, second over first. */
export function ratio(
  first: string,
  second: string,
  of: (run: CaseRun) => number,
): (runs: Runs) => Measured {
  return (runs) => {
    const a = of(runOf(runs, first));
    const b = of(runOf(runs, second));
    return { a, b, value: a !== 0 ? b / a : b === 0 ? 0 : Number.POSITIVE_INFINITY };
  };
}

/** A quantity of one wash. */
export function single(label: string, of: (run: CaseRun) => number): (runs: Runs) => Measured {
  return (runs) => ({ value: of(runOf(runs, label)) });
}

/** A check, written in one line. */
export function check(
  id: string,
  quantity: string,
  unit: string,
  decides: boolean,
  expected: Expected,
  measure: (runs: Runs) => Measured,
  requires?: readonly Capability[],
): Check {
  return {
    id,
    quantity,
    unit,
    decides,
    expected,
    measure,
    ...(requires === undefined ? {} : { requires }),
  };
}
