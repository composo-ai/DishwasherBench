/**
 * The water inventory of the running machine and loss of prime (docs/research/machine.md
 * sections 4.5 and 12.2 item 4).
 *
 *   V_sump = V_total - V_pipes(open branches) - V_air - V_film - V_trap - V_filter - V_absorbed
 *   V_air  = Q t_flight,   V_film = Q t_return       unless the jet and film models supply them
 *   alpha  = clamp(1 - V_sump / V_min, 0, 0.6)       air fraction at the pump inlet
 *   f_H    = max(1 - 2.5 alpha, 0)                   head multiplier of the pump
 *
 * The flow Q itself depends on f_H, so the primed operating point is the fixed point of the
 * two; `primedOperatingPoint` finds it by bisection on f_H (the map is monotone).
 *
 * Also here: how a flow divides between the filter stages by open area (machine.md section
 * 5.2), and the fraction of a bath that the carry-over takes into the next (section 4.6).
 *
 * Units: SI (m^3, m^3/s, seconds).
 */

import { getBranch, getDiverterPosition } from './config.ts';
import type { OperatingPoint, OperatingPointOptions } from './hydraulics.ts';
import {
  BISECTION_ITERATIONS,
  HEAD_LOSS_PER_AIR_FRACTION,
  headFactorFromAirFraction,
  hydraulicOperatingPoint,
} from './hydraulics.ts';
import type { FilterSpec, MachineSpec } from './types.ts';

/** Largest air fraction the inventory model reports (machine.md section 4.5). */
export const MAX_AIR_FRACTION = 0.6;

/** Water held out of the sump by the load and the filter, m^3. All default to zero. */
export interface HeldWater {
  /** Water caught in upward-facing concavities of the load, V_trap. */
  readonly trapped?: number;
  /** Water standing above a partly blinded filter, V_filter. */
  readonly filterHeld?: number;
  /** Water taken up by swelling soils and porous items, V_absorbed. */
  readonly absorbed?: number;
  /** Water in flight, V_air; default: flow times the machine's flight time. */
  readonly inFlight?: number;
  /** Water on the load and the walls, V_film; default: flow times the machine's return time. */
  readonly onSurfaces?: number;
}

/** Where the water of the machine is at one instant. Volumes in m^3. */
export interface InventoryState {
  /** What is left in the sump for the pump (never negative). */
  readonly sump: number;
  /** In the pump housing, the feed and the arms of the open branches. */
  readonly pipes: number;
  readonly inFlight: number;
  readonly onSurfaces: number;
  readonly trapped: number;
  readonly filterHeld: number;
  readonly absorbed: number;
  /** Air fraction alpha at the pump inlet, 0 to {@link MAX_AIR_FRACTION}. */
  readonly airFraction: number;
  /** Head multiplier f_H of the pump, 0 to 1. */
  readonly headFactor: number;
  /** True when the sump holds at least the minimum volume: the pump is fully primed. */
  readonly primed: boolean;
}

/** Air fraction at the pump inlet for a sump volume: clamp(1 - V_sump / V_min, 0, 0.6). */
export function airFractionFromSump(sumpVolume: number, minSumpVolume: number): number {
  if (!(minSumpVolume > 0)) return 0;
  return Math.min(Math.max(1 - sumpVolume / minSumpVolume, 0), MAX_AIR_FRACTION);
}

/**
 * The water inventory of a machine holding `totalVolume` of free water (this bath's fill plus
 * the carry-over) while `flow` circulates through the branches `openBranches`.
 */
export function waterInventory(
  spec: MachineSpec,
  totalVolume: number,
  flow: number,
  openBranches: readonly string[],
  held: HeldWater = {},
): InventoryState {
  const inventory = spec.hydraulics.inventory;
  let pipes = 0;
  for (const branch of spec.hydraulics.branches) {
    if (openBranches.includes(branch.id)) pipes += branch.pipeVolume;
  }
  for (const id of openBranches) getBranch(spec, id);
  const inFlight = held.inFlight ?? flow * inventory.flightTime;
  const onSurfaces = held.onSurfaces ?? flow * inventory.returnTime;
  const trapped = held.trapped ?? 0;
  const filterHeld = held.filterHeld ?? 0;
  const absorbed = held.absorbed ?? 0;
  const balance = totalVolume - pipes - inFlight - onSurfaces - trapped - filterHeld - absorbed;
  const airFraction = airFractionFromSump(balance, inventory.minSumpVolume);
  return {
    sump: Math.max(balance, 0),
    pipes,
    inFlight,
    onSurfaces,
    trapped,
    filterHeld,
    absorbed,
    airFraction,
    headFactor: headFactorFromAirFraction(airFraction),
    primed: airFraction === 0,
  };
}

/** A hydraulic operating point together with the water inventory it is consistent with. */
export interface PrimedOperatingPoint {
  readonly point: OperatingPoint;
  readonly inventory: InventoryState;
}

/**
 * The operating point of a machine that holds `totalVolume` of free water, with the loss of
 * prime fed back: the head multiplier f_H used in the hydraulic solve is the one the resulting
 * sump volume gives. A larger f_H gives more flow, more water in the air and on the load, a
 * lower sump and so a smaller f_H; the fixed point is unique and is found by bisection.
 *
 * `options.airFraction` is ignored: this function determines it.
 */
export function primedOperatingPoint(
  spec: MachineSpec,
  positionId: string,
  pumpRpm: number,
  totalVolume: number,
  held: HeldWater = {},
  options: OperatingPointOptions = {},
): PrimedOperatingPoint {
  const feeds = getDiverterPosition(spec, positionId).feeds;
  const solveAt = (headFactor: number): PrimedOperatingPoint => {
    const airFraction = (1 - headFactor) / HEAD_LOSS_PER_AIR_FRACTION;
    const point = hydraulicOperatingPoint(spec, positionId, pumpRpm, { ...options, airFraction });
    return { point, inventory: waterInventory(spec, totalVolume, point.flow, feeds, held) };
  };
  const full = solveAt(1);
  if (full.inventory.headFactor >= 1) return full;
  // g(f) = f_H(inventory(Q(f))) - f falls from >= 0 at f = 0 to < 0 at f = 1.
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < BISECTION_ITERATIONS; i++) {
    const mid = 0.5 * (lo + hi);
    if (solveAt(mid).inventory.headFactor >= mid) lo = mid;
    else hi = mid;
  }
  return solveAt(0.5 * (lo + hi));
}

/**
 * Fraction of the dissolved contents of one bath that reaches the next: the carry-over diluted
 * by the next fill, V_carry / (V_carry + V_fill) (machine.md section 4.6).
 */
export function carryOverFraction(carryOver: number, nextFillVolume: number): number {
  const total = carryOver + nextFillVolume;
  return total > 0 ? carryOver / total : 0;
}

/** How a returning flow divides between the filter stages. Fractions of the flow, summing to 1. */
export interface FilterFlowSplit {
  /** Through the flat fine filter (and the sump cover) straight to the circulation pump. */
  readonly direct: number;
  /** Through the micro filter: the share from which particles above its mesh are removed. */
  readonly micro: number;
  /** Open area of the direct path, m^2. */
  readonly directOpenArea: number;
  /** Open area of the micro filter, m^2. */
  readonly microOpenArea: number;
}

/**
 * Split of the flow between the flat filter (with the sump cover) and the micro filter when
 * both are clean: parallel paths with equal loss coefficients divide the flow in proportion to
 * their open areas (machine.md section 5.2). The micro share is the per-pass capture efficiency
 * of particles between the micro mesh and the flat-filter hole size.
 */
export function filterFlowSplit(filter: FilterSpec): FilterFlowSplit {
  const directOpenArea = filter.flatPlate.openArea + (filter.sumpCover?.openArea ?? 0);
  const microOpenArea = filter.micro.area * filter.micro.openFraction;
  const total = directOpenArea + microOpenArea;
  return {
    direct: total > 0 ? directOpenArea / total : 0,
    micro: total > 0 ? microOpenArea / total : 0,
    directOpenArea,
    microOpenArea,
  };
}
