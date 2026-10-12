/**
 * The lumped hydraulic operating point (docs/research/machine.md sections 4.2, 4.3 and 12.2
 * item 1).
 *
 *   pump      H(Q, N) = H_0 (N / N_0)^2 f_H - b Q^2,          p_pump = rho g H
 *   branch j  p_pump = rho g z_j + K_j Q_j^2 + p_arm,j,        Q_j = (C_d A)_j sqrt(2 p_arm,j / rho)
 *   so        Q_j(p) = sqrt( max(p - rho g z_j, 0) / (K_j + rho / (2 (C_d A)_j^2)) )
 *   and       Q_pump(p) = sqrt( max(H_0 (N/N_0)^2 f_H - p / (rho g), 0) / b )
 *
 * The pump pressure p is the root of sum_j Q_j(p) = Q_pump(p), found by bisection on
 * [0, rho g H_0 (N/N_0)^2 f_H]: the left side rises with p and the right side falls, so the
 * root is unique. Then p_arm,j = p - rho g z_j - K_j Q_j^2, nozzle flow
 * Q_i = C_d,i A_i sqrt(2 p_arm / rho) and jet speed v_i = C_v,i sqrt(2 p_arm / rho).
 *
 * Everything is a pure function of its arguments; branches and nozzles are visited in the order
 * of the specification. Units: SI (Pa, m^3/s, m/s, kg/s, N, W); pump speed in rev/min.
 */

import { STANDARD_GRAVITY } from '@spotless/core';
import { branchStaticLift, getDiverterPosition } from './config.ts';
import type { MachineSpec, NozzleSpec, PumpSpec, SprayLevelSpec } from './types.ts';
import { WATER_DENSITY } from './water.ts';

/** Number of bisection steps: the bracket shrinks by 2^-80, far below double precision. */
export const BISECTION_ITERATIONS = 80;

/** Slope of the head derating with the air fraction at the pump inlet (machine.md 4.5). */
export const HEAD_LOSS_PER_AIR_FRACTION = 2.5;

/**
 * Head multiplier f_H of a pump that ingests air: 1 - 2.5 alpha, zero above alpha = 0.4
 * (machine.md section 4.5, [ESTIMATED] there: a rule of thumb to be calibrated).
 */
export function headFactorFromAirFraction(airFraction: number): number {
  return Math.min(1, Math.max(1 - HEAD_LOSS_PER_AIR_FRACTION * Math.max(airFraction, 0), 0));
}

/** Blocked fraction of the area of individual nozzles: spray level id, then nozzle id, 0 to 1. */
export type NozzleBlockage = Readonly<Record<string, Readonly<Record<string, number>>>>;

/** What an operating point is solved for besides the diverter position and the pump speed. */
export interface OperatingPointOptions {
  /** Blocked fraction of nozzle areas; a nozzle not listed is clear. */
  readonly blockage?: NozzleBlockage;
  /** Air volume fraction alpha at the pump inlet; default 0 (full prime). */
  readonly airFraction?: number;
  /**
   * Opening fraction of each fed branch, 0 to 1, by branch id; default 1. During a diverter
   * transition the (C_d A) of a branch is scaled by its opening fraction.
   */
  readonly branchOpening?: Readonly<Record<string, number>>;
  /** Height position of each adjustable basket; default: the machine's default configuration. */
  readonly basketHeights?: Readonly<Record<string, string>>;
  /** Density of the liquor, kg/m^3; default `WATER_DENSITY`. */
  readonly density?: number;
  /** Acceleration of gravity, m/s^2; default `STANDARD_GRAVITY`. */
  readonly gravity?: number;
}

/** Flow and jet of one nozzle at an operating point. */
export interface NozzleOperatingPoint {
  /** Id of the nozzle. */
  readonly id: string;
  /** Volume flow, m^3/s. */
  readonly flow: number;
  /** Mass flow, kg/s. */
  readonly massFlow: number;
  /** Speed of the jet relative to the nozzle, m/s. */
  readonly jetSpeed: number;
  /** Momentum flux of the jet, rho Q v, newtons. */
  readonly thrust: number;
}

/** One fed branch at an operating point. */
export interface BranchOperatingPoint {
  /** Id of the branch and of the spray level it feeds. */
  readonly id: string;
  /** Volume flow through the branch, m^3/s. */
  readonly flow: number;
  /** Gauge pressure inside the arm or at the outlet, Pa. */
  readonly armPressure: number;
  /** sqrt(2 p_arm / rho): the jet speed of a nozzle with C_v = 1, m/s. */
  readonly idealJetSpeed: number;
  /** Static lift used, metres. */
  readonly staticLift: number;
  /** Pressure lost in the feed, K Q^2, Pa. */
  readonly lossPressure: number;
  /** Sum of C_d A over the nozzles after blockage and opening fraction, m^2. */
  readonly cdA: number;
  readonly nozzles: readonly NozzleOperatingPoint[];
}

/** The state of the hydraulic circuit for one diverter position and pump speed. */
export interface OperatingPoint {
  /** Id of the diverter position. */
  readonly position: string;
  /** Pump speed, revolutions per minute. */
  readonly pumpRpm: number;
  /** Head multiplier f_H applied for air ingestion. */
  readonly headFactor: number;
  /** Pressure rise across the pump, Pa. */
  readonly pumpPressure: number;
  /** The same as a head, metres of liquor. */
  readonly pumpHead: number;
  /** Total circulated flow, m^3/s. */
  readonly flow: number;
  /** Hydraulic power p Q, W. */
  readonly hydraulicPower: number;
  /** Electrical power of the pump, W; 0 when it is stopped. */
  readonly electricalPower: number;
  /** The fed branches, in the order of the specification. */
  readonly branches: readonly BranchOperatingPoint[];
}

/** One branch as the network solver sees it. SI. */
export interface NetworkBranch {
  readonly id: string;
  /** Static lift z, metres. */
  readonly staticLift: number;
  /** Loss coefficient K, Pa s^2 / m^6. */
  readonly lossCoefficient: number;
  /** Sum of C_d A of its open nozzles, m^2. */
  readonly cdA: number;
}

/** Result of {@link solveNetwork}. */
export interface NetworkSolution {
  /** Pump pressure, Pa. */
  readonly pumpPressure: number;
  /** Total flow, the sum of the branch flows, m^3/s; the pump delivers it at that pressure. */
  readonly flow: number;
  /** Flow of each branch, in the order given, m^3/s. */
  readonly branchFlows: readonly number[];
}

/** Geometric area of a nozzle opening that is still open, m^2. */
function openArea(level: SprayLevelSpec, nozzle: NozzleSpec, blockage?: NozzleBlockage): number {
  const blocked = blockage?.[level.id]?.[nozzle.id] ?? 0;
  return nozzle.area * Math.min(1, Math.max(1 - blocked, 0));
}

/**
 * Sum of C_d A over the nozzles of a spray level, m^2, with the blocked fraction of each
 * nozzle's area taken out.
 */
export function sprayLevelCdA(level: SprayLevelSpec, blockage?: NozzleBlockage): number {
  let sum = 0;
  for (const nozzle of level.nozzles) sum += nozzle.cd * openArea(level, nozzle, blockage);
  return sum;
}

/**
 * Flow a branch passes at pump pressure `p`, m^3/s: zero until the pressure exceeds its static
 * lift, and zero for a branch with no open nozzle area.
 */
export function branchFlowAt(
  branch: NetworkBranch,
  pumpPressure: number,
  density: number = WATER_DENSITY,
  gravity: number = STANDARD_GRAVITY,
): number {
  if (!(branch.cdA > 0)) return 0;
  const driving = pumpPressure - density * gravity * branch.staticLift;
  if (!(driving > 0)) return 0;
  return Math.sqrt(driving / (branch.lossCoefficient + density / (2 * branch.cdA * branch.cdA)));
}

/**
 * Flow the pump delivers against pressure `p` at speed `pumpRpm`, m^3/s (zero beyond its
 * shut-off pressure).
 */
export function pumpFlowAt(
  pump: PumpSpec,
  pumpPressure: number,
  pumpRpm: number,
  headFactor = 1,
  density: number = WATER_DENSITY,
  gravity: number = STANDARD_GRAVITY,
): number {
  const speedRatio = pumpRpm / pump.ratedSpeedRpm;
  const head =
    pump.shutOffHead * speedRatio * speedRatio * headFactor - pumpPressure / (density * gravity);
  return head > 0 ? Math.sqrt(head / pump.curveCoefficient) : 0;
}

/** Head the pump develops at flow `flow` and speed `pumpRpm`, metres: H_0 (N/N_0)^2 f_H - b Q^2. */
export function pumpHeadAt(pump: PumpSpec, flow: number, pumpRpm: number, headFactor = 1): number {
  const speedRatio = pumpRpm / pump.ratedSpeedRpm;
  return (
    pump.shutOffHead * speedRatio * speedRatio * headFactor - pump.curveCoefficient * flow * flow
  );
}

/**
 * Electrical power of the pump for a hydraulic power, W: P_hyd / (eta_h eta_m) + P_0
 * (machine.md section 4.2).
 */
export function pumpElectricalPower(pump: PumpSpec, hydraulicPower: number): number {
  return hydraulicPower / (pump.hydraulicEfficiency * pump.motorEfficiency) + pump.idlePower;
}

/**
 * Solves the pump against a set of parallel branches: the pump pressure at which the branch
 * flows add up to the pump flow, by bisection ({@link BISECTION_ITERATIONS} steps). With no
 * branch that can pass water the pump runs against a closed valve: its shut-off pressure and
 * zero flow.
 */
export function solveNetwork(
  pump: PumpSpec,
  branches: readonly NetworkBranch[],
  pumpRpm: number,
  headFactor = 1,
  density: number = WATER_DENSITY,
  gravity: number = STANDARD_GRAVITY,
): NetworkSolution {
  const speedRatio = pumpRpm / pump.ratedSpeedRpm;
  const shutOff =
    density * gravity * pump.shutOffHead * speedRatio * speedRatio * Math.max(headFactor, 0);
  if (!(pumpRpm > 0) || !(shutOff > 0)) {
    return { pumpPressure: 0, flow: 0, branchFlows: branches.map(() => 0) };
  }
  const demand = (p: number): number => {
    let sum = 0;
    for (const branch of branches) sum += branchFlowAt(branch, p, density, gravity);
    return sum;
  };
  // Nothing can flow even at shut-off pressure: the pump runs against a closed valve.
  if (!(demand(shutOff) > 0)) {
    return { pumpPressure: shutOff, flow: 0, branchFlows: branches.map(() => 0) };
  }
  let lo = 0;
  let hi = shutOff;
  for (let i = 0; i < BISECTION_ITERATIONS; i++) {
    const mid = 0.5 * (lo + hi);
    if (demand(mid) > pumpFlowAt(pump, mid, pumpRpm, headFactor, density, gravity)) hi = mid;
    else lo = mid;
  }
  const pumpPressure = 0.5 * (lo + hi);
  // The total is the sum of the branch flows, so that the flows of a point add up exactly; at
  // the root it equals the pump flow to within the bisection tolerance.
  const branchFlows = branches.map((b) => branchFlowAt(b, pumpPressure, density, gravity));
  let flow = 0;
  for (const q of branchFlows) flow += q;
  return { pumpPressure, flow, branchFlows };
}

/**
 * The hydraulic operating point of a machine for one diverter position and pump speed: pump
 * pressure and total flow, and for every fed branch its flow, the pressure in the arm, and the
 * flow and jet speed of each nozzle.
 *
 * `positionId` is the id of a diverter position of the machine (a RangeError for an unknown
 * id). A stopped pump (`pumpRpm` <= 0) or a closed position gives zero flows.
 */
export function hydraulicOperatingPoint(
  spec: MachineSpec,
  positionId: string,
  pumpRpm: number,
  options: OperatingPointOptions = {},
): OperatingPoint {
  const density = options.density ?? WATER_DENSITY;
  const gravity = options.gravity ?? STANDARD_GRAVITY;
  const headFactor = headFactorFromAirFraction(options.airFraction ?? 0);
  const position = getDiverterPosition(spec, positionId);
  const pump = spec.hydraulics.pump;

  const fed: { level: SprayLevelSpec; opening: number; network: NetworkBranch }[] = [];
  for (const branch of spec.hydraulics.branches) {
    if (!position.feeds.includes(branch.id)) continue;
    const level = spec.sprayLevels.find((l) => l.id === branch.id);
    if (level === undefined) {
      throw new RangeError(
        `hydraulicOperatingPoint: branch "${branch.id}" of ${spec.id} feeds no spray level`,
      );
    }
    const opening = Math.min(1, Math.max(options.branchOpening?.[branch.id] ?? 1, 0));
    fed.push({
      level,
      opening,
      network: {
        id: branch.id,
        staticLift: branchStaticLift(spec, branch, options.basketHeights),
        lossCoefficient: branch.lossCoefficient,
        cdA: sprayLevelCdA(level, options.blockage) * opening,
      },
    });
  }

  const solution = solveNetwork(
    pump,
    fed.map((f) => f.network),
    pumpRpm,
    headFactor,
    density,
    gravity,
  );

  const branches: BranchOperatingPoint[] = fed.map((f, j) => {
    const flow = solution.branchFlows[j] ?? 0;
    const lossPressure = f.network.lossCoefficient * flow * flow;
    const armPressure =
      flow > 0
        ? Math.max(
            solution.pumpPressure - density * gravity * f.network.staticLift - lossPressure,
            0,
          )
        : 0;
    const idealJetSpeed = Math.sqrt((2 * armPressure) / density);
    const nozzles: NozzleOperatingPoint[] = f.level.nozzles.map((nozzle) => {
      const nozzleFlow =
        nozzle.cd * openArea(f.level, nozzle, options.blockage) * f.opening * idealJetSpeed;
      const jetSpeed = nozzle.cv * idealJetSpeed;
      const massFlow = density * nozzleFlow;
      return { id: nozzle.id, flow: nozzleFlow, massFlow, jetSpeed, thrust: massFlow * jetSpeed };
    });
    return {
      id: f.network.id,
      flow,
      armPressure,
      idealJetSpeed,
      staticLift: f.network.staticLift,
      lossPressure,
      cdA: f.network.cdA,
      nozzles,
    };
  });

  const hydraulicPower = solution.pumpPressure * solution.flow;
  return {
    position: position.id,
    pumpRpm,
    headFactor,
    pumpPressure: solution.pumpPressure,
    pumpHead: solution.pumpPressure / (density * gravity),
    flow: solution.flow,
    hydraulicPower,
    electricalPower: pumpRpm > 0 ? pumpElectricalPower(pump, hydraulicPower) : 0,
    branches,
  };
}

/**
 * The branch of an operating point that feeds the given spray level, or undefined if the
 * diverter position does not feed it.
 */
export function branchOperatingPoint(
  point: OperatingPoint,
  levelId: string,
): BranchOperatingPoint | undefined {
  return point.branches.find((b) => b.id === levelId);
}
