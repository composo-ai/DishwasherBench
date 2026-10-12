/**
 * The replay of the first build (docs/design/scope.md, "Whole cycle"; docs/design/sim-core.md
 * sections 5.5 and M10): the whole programme in ticks, against cached exposure.
 *
 *   for each span of the schedule, in ticks of one revolution of the master arm of its spray
 *   state (`tl.offTick` with the pump off, `tl.dryTick` in drying):
 *     events of the tick      fills, drains (with the carry-over), detergent and rinse-aid release
 *     liquor                  volume and temperature from the machine's timeline; chemistry stepped
 *     exposure                that of the active spray state (computed or fetched when the state
 *                             is first needed, in programme order); with the pump off, what the
 *                             last spray left: a residual film that keeps a block wet for its
 *                             hold time
 *     pools                   every basin takes in water at the rate of the active state until
 *                             it is full, mixes with what enters afterwards, and is never drained;
 *                             its water holds the soil that dissolved under it and the soil of
 *                             the liquor that entered it, both leaving with the water that
 *                             spills as its detergent does (sim-core.md M10, "Pools and gaps":
 *                             V dc/dt = eta_mix Q_in (c_in - c) + S_p)
 *     soil                    one step of every deposit with the effective exposure of the tick
 *
 * There is no cycle jumping: every revolution of the programme is a tick of the liquor and the
 * pools. The soil is stepped once per `tl.soilStride` ticks with the exposure of the spray
 * state and the liquor at the end of the step (sooner at every change of state, water or
 * dose, pool level, or when the liquor moves by `tl.soilTemperatureStep` or `tl.soilPHStep`).
 *
 * What a deposit sees in a tick (the wetness contract of section M8, reduced to what the
 * exposure of the first build provides): under a pool, that pool's liquor all the time; where
 * the active spray state wets its block, the sump liquor for the wet fraction with the film's
 * shear and the jets of that state; elsewhere the liquor that last wetted it, while its
 * residual film lasts; otherwise nothing.
 *
 * Simplifications (each ignores something calibration may ask for): the liquor on a block is
 * the sump liquor as it is now (no film composition lagging behind, no local stores; the
 * supply limit is one factor per block from its `exchange` column, the inverse of the age of the
 * water on it, see `soil.ts`); a residual film keeps the composition of the liquor at the moment
 * the pump stopped, does not thin and is not renewed: it removes what it can take up
 * (`soil.heldFilmCapacity`) and no more; surfaces
 * are at the temperature of the liquor that wets them (no wall temperatures); in a pool the
 * enzymes and oxidants decay as in the sump but no peracid is made there, and its soil cells
 * see no jets; water in pools is taken
 * out of the machine's inventory once, by the caller (`heldWater`), not tick by tick; a basin
 * fills at its inflow rate whether or not the machine has that water to spare; the soil of the
 * liquor that a pool takes in is a copy (it is not taken out of the sump, as its detergent is
 * not), while the soil that dissolved under a pool is in the ledger and reaches the sump only
 * with the water that spills; nothing settles in a pool while it is being stirred (no particle
 * classes) and nothing is redeposited on a surface that is not under standing water at the
 * end (what a pool holds at the end is left on its footprint: the caller lays it down, see
 * `PoolResult`); drying only lets residual films expire, and what is reported as retained is
 * the film and the pools at the end of the last rinse.
 *
 * Deterministic: f64, one thread, a fixed order; no clock is read.
 *
 * Units: SI; temperatures in degrees Celsius.
 */

import {
  JET_FIELD,
  JET_FIELD_COUNT,
  WATER_FIELD,
  WATER_FIELD_COUNT,
  bindSharedClosures,
  type ExposureSet,
  type ParamSet,
  type WashScene,
} from '@spotless/sim-film';
import {
  spanAt,
  washInstantAt,
  type WashHydraulics,
  type WashSpan,
} from '@spotless/sim-hydraulics';
import {
  LIQUOR_FIELD_COUNT,
  liquorLossRates,
  liquorPH,
  perhydroxylFraction,
  resolveLiquorParams,
  writeLiquorRow,
  type LiquorLossRates,
  type LiquorSample,
  type WashLiquor,
} from '@spotless/sim-liquor';
import type { SoilChemistry, SoilForcing, WashSoil } from '@spotless/sim-soil';
import { resolveTimelineParams } from './params.ts';

/** What {@link replayWash} is given. */
export interface ReplayInput {
  readonly scene: WashScene;
  readonly hydraulics: WashHydraulics;
  /**
   * The exposure set of a spray state, by its index in `hydraulics.states`. Called once per
   * state, when the programme first needs it.
   */
  readonly exposure: (stateIndex: number) => Promise<ExposureSet>;
  readonly liquor: WashLiquor;
  readonly soil: WashSoil;
  /** Parameter set built on the registry of the simulation. */
  readonly params: ParamSet;
  /** Called with the share of the programme replayed, 0 to 1, about once per simulated minute. */
  readonly onProgress?: (fraction: number) => void;
}

/** A pool at the end of the wash. */
export interface PoolResult {
  /** Index into `scene.basins`, and the instance that holds it. */
  readonly basin: number;
  readonly instance: number;
  /** Water in it at the end, m3, and what it holds when full, m3. */
  readonly volume: number;
  readonly capacity: number;
  /** Its temperature at the end, degrees Celsius. */
  readonly temperature: number;
  /**
   * Detergent in it, kg/m3, and the soil that dissolved under it and is still in it, kg (what
   * the water that spilled carried away has gone to the sump liquor).
   */
  readonly detergent: number;
  readonly dissolvedSoil: number;
  /**
   * Soil of the sump liquor that came in with the water and is still in it, kg (dissolved,
   * fat and particles together, as the liquor counts them).
   */
  readonly carriedSoil: number;
  /**
   * Depth below the spill level down to which the blocks of the basin are dry at the end, m
   * (0 when it is full): a block of the basin lies under `depth - dry` of water.
   */
  readonly dry: number;
}

/** One water change of the programme. */
export interface CarryOver {
  /** Time of the drain, seconds from the start of the programme. */
  readonly time: number;
  /** Left in the sump and the hydraulics, on the surfaces as film, and standing in pools, m3. */
  readonly sump: number;
  readonly film: number;
  readonly pools: number;
  /** Share of every dissolved amount that stays in the liquor (sump and film over the volume before). */
  readonly fraction: number;
}

/** What {@link replayWash} returns. The soil state itself is in `input.soil.state`. */
export interface ReplayResult {
  /** Number of ticks. */
  readonly ticks: number;
  /** Start of every tick, seconds, its length, seconds, and the spray state active (-1 pump off). */
  readonly tickTime: Float64Array;
  readonly tickLength: Float32Array;
  readonly tickState: Int16Array;
  /** The liquor at the end of every tick: `LIQUOR_FIELD_COUNT` numbers per tick (`LIQUOR_FIELDS`). */
  readonly liquor: Float64Array;
  /** The pools that hold water at the end, in basin order. */
  readonly pools: readonly PoolResult[];
  /** Per block: water left on the surface as film after the last spray, kg/m2 (pools excluded). */
  readonly retainedFilm: Float32Array;
  readonly carryOver: readonly CarryOver[];
  /**
   * Dry soil of the load, kg: on it at the start and at the end, gone into the liquor (with
   * what spilled out of pools), and still in the pools it dissolved under at the end.
   */
  readonly soilLedger: {
    readonly initial: number;
    readonly remaining: number;
    readonly toLiquor: number;
    readonly toPools: number;
  };
  /** Detergent released by the dispenser and dissolved by the end, kg. */
  readonly detergent: { readonly dosed: number; readonly dissolved: number };
}

/** What a spray state does to the deposits: the exposure set gathered once per state. */
interface StateForcing {
  readonly wet: Float32Array;
  readonly supply: Float32Array;
  readonly filmShear: Float32Array;
  readonly hold: Float32Array;
  /** Row of each deposit's soil cell in the jet table of the set, -1 where there is none. */
  readonly jetRow: Int32Array;
  readonly set: ExposureSet;
}

/** Where the soil model finds its columns in the jet table. */
const JET_COLUMNS = {
  stride: JET_FIELD_COUNT,
  wetDuty: JET_FIELD.wetDuty,
  duty: JET_FIELD.duty,
  level1: JET_FIELD.shearDuty1,
  level2: JET_FIELD.shearDuty2,
  level3: JET_FIELD.shearDuty3,
  shearPeak: JET_FIELD.shearPeak,
} as const;

interface Pool {
  readonly basin: number;
  readonly capacity: number;
  readonly spillDepth: number;
  readonly levelTable: Float32Array;
  /** The deposits on its blocks, and the depth of water over each when it is full. */
  readonly deposits: Uint32Array;
  readonly depth: Float32Array;
  volume: number;
  temperature: number;
  /** Concentrations: alkalinity, carbonate, protease, amylase, peracid, peroxide, surfactant, detergent. */
  readonly c: Float64Array;
  /** Soil in its water, kg: what dissolved under it, and what the liquor brought in. */
  dissolvedSoil: number;
  carriedSoil: number;
  chemistryIndex: number;
  /** Depth below the spill level down to which its blocks are dry, m, and the index before. */
  dry: number;
  chemistryWas: number;
}

const POOL_SPECIES = 8;

/** A remainder of a span shorter than this joins the tick before it, seconds (arithmetic only). */
// literal-ok-begin: named arithmetic control, documented where it is declared
const TICK_SLIVER = 1e-6;
// literal-ok-end

function poolInflowConcentrations(sample: LiquorSample, out: Float64Array): void {
  out[0] = sample.alkalinity;
  out[1] = sample.carbonate;
  out[2] = sample.protease;
  out[3] = sample.amylase;
  out[4] = sample.peracid;
  out[5] = sample.peroxide;
  out[6] = sample.surfactant;
  out[7] = sample.detergent;
}

/** Depth of water in a basin that holds `volume`, by its level table (depth, volume pairs). */
function poolDepth(table: Float32Array, volume: number): number {
  const n = table.length / 2;
  if (n === 0) return 0;
  for (let i = 1; i < n; i++) {
    const v1 = table[2 * i + 1] as number;
    if (volume <= v1) {
      const v0 = table[2 * i - 1] as number;
      const d0 = table[2 * i - 2] as number;
      const d1 = table[2 * i] as number;
      return v1 > v0 ? d0 + ((d1 - d0) * (volume - v0)) / (v1 - v0) : d1;
    }
  }
  return table[2 * n - 2] as number;
}

/**
 * Replays the whole programme. Updates `input.soil.state` and `input.liquor` in place and
 * returns the history of the liquor, the pools and the water left on the load.
 */
export async function replayWash(input: ReplayInput): Promise<ReplayResult> {
  const { scene, hydraulics, liquor, soil } = input;
  const { schedule, states } = hydraulics;
  const tp = resolveTimelineParams(input.params);
  const lp = resolveLiquorParams(input.params);
  const closures = bindSharedClosures(input.params);
  const solveNu = closures.water(input.params.get('jets.solveTemperature')).nu;
  const rho = closures.water(input.params.get('jets.solveTemperature')).rho;
  const state = soil.state;
  const n = state.count;
  const blocks = scene.blocks;

  // ---- exposure of each spray state, gathered on the deposits when first needed
  const forcings: (StateForcing | undefined)[] = states.map(() => undefined);
  const forcingOf = async (index: number): Promise<StateForcing> => {
    const known = forcings[index];
    if (known !== undefined) return known;
    const set = await input.exposure(index);
    if (set.water.blockCount !== blocks.count || set.jets.soilCellCount !== scene.soilCells.count) {
      throw new RangeError(
        `replayWash: the exposure of ${states[index]?.id} belongs to another scene`,
      );
    }
    if (
      set.jets.cell.length > 0 &&
      set.jets.values.length !== JET_FIELD_COUNT * set.jets.cell.length
    ) {
      throw new RangeError(
        `replayWash: the jet table of ${states[index]?.id} has other columns than this build reads`,
      );
    }
    const wet = new Float32Array(n);
    const supply = new Float32Array(n);
    const filmShear = new Float32Array(n);
    const hold = new Float32Array(n);
    const jetRow = new Int32Array(n).fill(-1);
    const jetOf = new Int32Array(scene.soilCells.count).fill(-1);
    for (let i = 0; i < set.jets.cell.length; i++) jetOf[set.jets.cell[i] as number] = i;
    const w = set.water.values;
    // A set without the `wetTime` column (a stand-in of an older layout) is wet by its area share.
    const fields = blocks.count > 0 ? w.length / blocks.count : WATER_FIELD_COUNT;
    const wetColumn = fields > WATER_FIELD.wetTime ? WATER_FIELD.wetTime : WATER_FIELD.wetFraction;
    for (let d = 0; d < n; d++) {
      const o = fields * (state.block[d] as number);
      // A deposit is wet whenever there is water on its block (film, rivulet or drops): it is
      // hydrophilic, whatever the bare substrate does with the water.
      const wetTime = Math.max(
        w[o + wetColumn] as number,
        w[o + WATER_FIELD.wetFraction] as number,
      );
      wet[d] = wetTime;
      // The supply of fresh liquor: by the age of the water on the block (the exchange
      // column), not by how fast it moves locally. A set of an older layout without that
      // column is taken as fresh.
      const exchange = fields > WATER_FIELD.exchange ? (w[o + WATER_FIELD.exchange] as number) : Infinity;
      supply[d] =
        wetTime > 0
          ? exchange === Infinity
            ? 1
            : exchange > 0
              ? exchange / (exchange + tp.supplyExchange)
              : 0
          : 0;
      // The shear column is that of the stream where the bare substrate lets it run (a
      // rivulet of width share f). On the deposit, which it wets, the same flow spreads over
      // the whole width as a film thinner by f^(1/3) (laminar: the flow goes as h^3), and so
      // is its shear.
      const share =
        wetTime > 0 ? Math.min(1, (w[o + WATER_FIELD.wetFraction] as number) / wetTime) : 0;
      filmShear[d] = (w[o + WATER_FIELD.shear] as number) * Math.cbrt(share);
      hold[d] = w[o + WATER_FIELD.holdTime] as number;
      jetRow[d] = jetOf[state.cell[d] as number] as number;
    }
    const made: StateForcing = { wet, supply, filmShear, hold, jetRow, set };
    forcings[index] = made;
    return made;
  };

  // ---- pools: one per basin, with the deposits on its blocks
  const inBasin = new Uint8Array(blocks.count);
  for (const basin of scene.basins) for (const b of basin.blocks) inBasin[b] = 1;
  const depositsOfBlock = new Map<number, number[]>();
  for (let d = 0; d < n; d++) {
    const b = state.block[d] as number;
    if (inBasin[b] === 0) continue;
    const list = depositsOfBlock.get(b);
    if (list === undefined) depositsOfBlock.set(b, [d]);
    else list.push(d);
  }
  const pools: Pool[] = scene.basins.map((basin, index) => {
    const deposits: number[] = [];
    const depth: number[] = [];
    for (let i = 0; i < basin.blocks.length; i++) {
      for (const d of depositsOfBlock.get(basin.blocks[i] as number) ?? []) {
        deposits.push(d);
        depth.push(basin.depth[i] as number);
      }
    }
    return {
      basin: index,
      capacity: basin.volume,
      spillDepth: basin.spillLevel - basin.floorLevel,
      levelTable: basin.levelTable,
      deposits: Uint32Array.from(deposits),
      depth: Float32Array.from(depth),
      volume: 0,
      temperature: 0,
      c: new Float64Array(POOL_SPECIES),
      dissolvedSoil: 0,
      carriedSoil: 0,
      chemistryIndex: 0,
      dry: Infinity,
      chemistryWas: 0,
    };
  });

  // ---- per-deposit exposure of the tick
  const zeros = new Float32Array(n);
  const noJets = new Int32Array(n).fill(-1);
  const noJetValues = new Float32Array(0);
  const shearLevels = input.params.getVector('jets.shearLevels');
  const wetUntil = new Float64Array(n);
  const wetHeld = new Float32Array(n);
  // What the residual film on each deposit can still take up, kg/m2 of dry soil
  // (`soil.heldFilmCapacity` times the film the spray left; nothing renews it).
  const heldCapacity = new Float64Array(n);
  const liquorIndex = new Uint16Array(n);
  const retainedFilm = new Float32Array(blocks.count);
  const filmOfBath = new Float32Array(blocks.count);
  let filmVolume = 0;
  const inflow = new Float64Array(POOL_SPECIES);
  const loss: LiquorLossRates = { peracid: 0, peroxide: 0, protease: 0, amylase: 0 };

  // ---- tick records
  const tickTime: number[] = [];
  const tickLength: number[] = [];
  const tickState: number[] = [];
  const liquorRows: number[] = [];
  const row = new Float64Array(LIQUOR_FIELD_COUNT);
  const carryOver: CarryOver[] = [];
  const initialSoil = soil.totalMass();
  let toLiquor = 0;
  let toPools = 0;

  const events = schedule.timeline.events;
  let nextEvent = 0;
  let filmChem: SoilChemistry = {
    temperature: tp.initialFilmTemperature,
    pH: tp.initialFilmPH,
    protease: 0,
    amylase: 0,
    peracid: 0,
    perhydroxyl: 0,
    surfactant: 0,
  };
  let lastProgress = -Infinity;
  let activeIndex = -1;
  let active: StateForcing | undefined;

  /** The spray of `from` has stopped at `time`: its wet blocks keep a residual film. */
  const stopSpray = (from: StateForcing, time: number): void => {
    const water = from.set.water.values;
    for (let d = 0; d < n; d++) {
      if (!((from.wet[d] as number) > 0)) continue;
      // The film the spray leaves is the liquor that was on the block: as fresh as the supply
      // of that spray state says, and it can take up that share of its capacity again.
      heldCapacity[d] =
        tp.heldFilmCapacity *
        (from.supply[d] as number) *
        (water[WATER_FIELD_COUNT * (state.block[d] as number) + WATER_FIELD.retained] as number);
      const until = time + (from.hold[d] as number);
      if (until > (wetUntil[d] as number)) {
        // The residual film covers what the spray wetted, and no more.
        wetUntil[d] = until;
        wetHeld[d] = from.wet[d] as number;
      }
    }
    const w = from.set.water.values;
    for (let b = 0; b < blocks.count; b++) {
      const o = WATER_FIELD_COUNT * b;
      if (!((w[o + WATER_FIELD.wetFraction] as number) > 0)) continue;
      const kept = w[o + WATER_FIELD.retained] as number;
      if (kept > (filmOfBath[b] as number)) {
        filmVolume += ((kept - (filmOfBath[b] as number)) * (blocks.area[b] as number)) / rho;
        filmOfBath[b] = kept;
      }
    }
  };

  // The soil is stepped once per `tl.soilStride` ticks (its laws are linear or exponential in
  // the step, and the exposure of a spray state does not change from one revolution to the
  // next), with the liquor of the last tick of the step; sooner when the spray state changes,
  // when water is changed or dosed, and when the liquor has moved by more than the tolerances.
  let pendingStart = 0;
  let pendingTicks = 0;
  let pendingPeriod = 0;
  let pendingActive: StateForcing | undefined;
  let pendingTemperature = 0;
  let pendingPH = 0;
  const flushSoil = (end: number, chemistry: readonly SoilChemistry[]): void => {
    if (pendingTicks === 0) return;
    const forcing: SoilForcing = {
      time: pendingStart,
      dt: end - pendingStart,
      period: pendingPeriod,
      wet: pendingActive?.wet ?? zeros,
      supply: pendingActive?.supply ?? zeros,
      wetUntil,
      wetHeld,
      heldCapacity,
      filmShear: pendingActive?.filmShear ?? zeros,
      jetRow: pendingActive?.jetRow ?? noJets,
      jetValues: pendingActive?.set.jets.values ?? noJetValues,
      jetColumns: JET_COLUMNS,
      jetShearLevels: shearLevels,
      jetShearScale: Math.sqrt(closures.water(filmChem.temperature).nu / solveNu),
      liquor: liquorIndex,
      chemistry,
    };
    const removed = soil.step(forcing);
    const intoLiquor = removed[0] as number;
    if (intoLiquor > 0) {
      liquor.addSoil(intoLiquor);
      toLiquor += intoLiquor;
    }
    for (const pool of pools) {
      if (pool.chemistryIndex === 0) continue;
      const mass = removed[pool.chemistryIndex] as number;
      pool.dissolvedSoil += mass;
      toPools += mass;
    }
    pendingTicks = 0;
  };
  let lastChemistry: SoilChemistry[] = [filmChem];

  let time = 0;
  let spanIndex = -1;
  let span: WashSpan = spanAt(schedule, 0);
  while (time < schedule.duration) {
    if (time >= span.end || spanIndex < 0) {
      span = spanAt(schedule, time);
      spanIndex = span.index;
      if (span.state !== activeIndex) {
        // What is pending belongs to the state that ends here.
        flushSoil(time, lastChemistry);
        if (active !== undefined) stopSpray(active, time);
        activeIndex = span.state;
        active = span.state >= 0 ? await forcingOf(span.state) : undefined;
      }
    }
    const sprayState = span.state >= 0 ? states[span.state] : undefined;
    const nominal =
      sprayState !== undefined ? sprayState.period : span.kind === 'dry' ? tp.dryTick : tp.offTick;
    // The last tick of a span ends with the span; a sliver of a tick joins the one before.
    let end = time + nominal;
    if (end > span.end - TICK_SLIVER) end = span.end;
    const dt = end - time;

    // Events of the tick.
    if (nextEvent < events.length && (events[nextEvent] as { time: number }).time < end) {
      // Water is changed or dosed in this tick: the soil is brought up to it first.
      flushSoil(time, lastChemistry);
    }
    while (nextEvent < events.length && (events[nextEvent] as { time: number }).time < end) {
      const event = events[nextEvent++];
      if (event === undefined) break;
      if (event.kind === 'fill') {
        liquor.apply({ kind: 'fill', volume: event.volume });
      } else if (event.kind === 'top_up') {
        liquor.apply({ kind: 'fill', volume: event.volume });
      } else if (event.kind === 'drain') {
        const before = event.volume + event.remaining;
        const fraction = before > 0 ? Math.min(1, (event.remaining + filmVolume) / before) : 0;
        let standing = 0;
        for (const pool of pools) standing += pool.volume;
        carryOver.push({
          time: event.time,
          sump: event.remaining,
          film: filmVolume,
          pools: standing,
          fraction,
        });
        liquor.apply({ kind: 'drain', carryFraction: fraction });
        // The film of the bath that ends here is what is on the load until the next spray.
        retainedFilm.set(filmOfBath);
        filmOfBath.fill(0);
        filmVolume = 0;
      } else if (event.kind === 'detergent_release') {
        liquor.apply({ kind: 'detergent', mass: event.mass });
      } else if (event.kind === 'rinse_aid_release') {
        liquor.apply({ kind: 'rinseAid', volume: event.volume });
      }
    }

    // Liquor: volume and temperature of the machine at the middle of the tick.
    const instant = washInstantAt(schedule, time + 0.5 * dt);
    const sample = liquor.step(
      end,
      dt,
      instant.liquorVolume,
      instant.liquorTemperature,
      sprayState !== undefined,
    );
    if (sprayState !== undefined && instant.liquorVolume > 0) {
      filmChem = sample;
    }

    // Pools: inflow of the active state, mixing, temperature, level.
    const chemistry: SoilChemistry[] = [filmChem];
    let levelMoved = false;
    for (const pool of pools) {
      const rate = active !== undefined ? (active.set.poolInflow[pool.basin] as number) : 0;
      if (rate > 0 && pool.capacity > 0) {
        const added = (rate * dt) / rho;
        poolInflowConcentrations(sample, inflow);
        const room = Math.max(0, pool.capacity - pool.volume);
        const fills = Math.min(added, room);
        if (fills > 0) {
          const total = pool.volume + fills;
          for (let s = 0; s < POOL_SPECIES; s++) {
            pool.c[s] =
              ((pool.c[s] as number) * pool.volume + (inflow[s] as number) * fills) / total;
          }
          pool.temperature = (pool.temperature * pool.volume + sample.temperature * fills) / total;
          pool.volume = total;
          // The water that fills it is the liquor, with the soil the liquor carries.
          pool.carriedSoil += sample.suspendedSoil * fills;
        }
        const through = added - fills;
        if (through > 0 && pool.volume > 0) {
          const share = 1 - Math.exp((-tp.poolMixing * through) / pool.volume);
          for (let s = 0; s < POOL_SPECIES; s++) {
            pool.c[s] =
              (pool.c[s] as number) + ((inflow[s] as number) - (pool.c[s] as number)) * share;
          }
          pool.temperature += (sample.temperature - pool.temperature) * share;
          // Soil mixes as every other species does: the soil of the liquor comes in, and what
          // the pool holds leaves with the water that spills. What dissolved under the pool
          // is the load's own soil and goes to the sump liquor when it leaves.
          pool.carriedSoil += (sample.suspendedSoil * pool.volume - pool.carriedSoil) * share;
          if (pool.dissolvedSoil > 0) {
            const spilled = pool.dissolvedSoil * share;
            pool.dissolvedSoil -= spilled;
            liquor.addSoil(spilled);
            toLiquor += spilled;
            toPools -= spilled;
          }
        }
      }
      if (pool.volume > 0) {
        pool.temperature +=
          (instant.loadTemperature - pool.temperature) * (1 - Math.exp(-dt / tp.poolThermalTime));
        // What decays in the sump decays in standing water too, at the pool's own temperature.
        liquorLossRates(
          lp,
          pool.temperature,
          pool.c[4] as number,
          pool.c[5] as number,
          (pool.dissolvedSoil + pool.carriedSoil) / pool.volume,
          loss,
        );
        pool.c[2] = (pool.c[2] as number) * Math.exp(-loss.protease * dt);
        pool.c[3] = (pool.c[3] as number) * Math.exp(-loss.amylase * dt);
        pool.c[4] = (pool.c[4] as number) * Math.exp(-loss.peracid * dt);
        pool.c[5] = (pool.c[5] as number) * Math.exp(-loss.peroxide * dt);
      }
      // Which of its deposits are under water now.
      if (pool.deposits.length === 0) continue;
      if (!(pool.volume > 0)) {
        if (pool.chemistryIndex !== 0) {
          for (const d of pool.deposits) liquorIndex[d] = 0;
          pool.chemistryIndex = 0;
        }
        continue;
      }
      const pH = liquorPH(lp, pool.c[0] as number, pool.c[1] as number, pool.temperature);
      chemistry.push({
        temperature: pool.temperature,
        pH,
        protease: pool.c[2] as number,
        amylase: pool.c[3] as number,
        peracid: pool.c[4] as number,
        perhydroxyl: perhydroxylFraction(lp, pH, pool.temperature) * (pool.c[5] as number),
        surfactant: pool.c[6] as number,
      });
      pool.chemistryIndex = chemistry.length - 1;
      const dry = pool.spillDepth - poolDepth(pool.levelTable, pool.volume);
      if (dry !== pool.dry || pool.chemistryIndex !== pool.chemistryWas) {
        // The level has moved: what was pending saw the old one.
        if (pendingTicks > 0) levelMoved = true;
        pool.dry = dry;
        pool.chemistryWas = pool.chemistryIndex;
      }
    }
    if (levelMoved) flushSoil(time, lastChemistry);
    for (const pool of pools) {
      if (pool.deposits.length === 0 || !(pool.volume > 0)) continue;
      for (let i = 0; i < pool.deposits.length; i++) {
        liquorIndex[pool.deposits[i] as number] =
          (pool.depth[i] as number) > pool.dry ? pool.chemistryIndex : 0;
      }
    }

    // Soil: this tick joins the pending step, which is taken when it is long enough or the
    // liquor has moved.
    if (pendingTicks === 0) {
      pendingStart = time;
      pendingPeriod = sprayState !== undefined ? sprayState.period : 0;
      pendingActive = active;
      pendingTemperature = filmChem.temperature;
      pendingPH = filmChem.pH;
    }
    pendingTicks++;
    lastChemistry = chemistry;
    if (
      pendingTicks >= tp.soilStride ||
      Math.abs(filmChem.temperature - pendingTemperature) > tp.soilTemperatureStep ||
      Math.abs(filmChem.pH - pendingPH) > tp.soilPHStep
    ) {
      flushSoil(end, chemistry);
    }

    tickTime.push(time);
    tickLength.push(dt);
    tickState.push(span.state);
    writeLiquorRow(row, 0, sample);
    for (let i = 0; i < LIQUOR_FIELD_COUNT; i++) liquorRows.push(row[i] as number);

    time = end;
    // literal-ok-begin: unit conversion (seconds per hour or minute, grams per kilogram, litres per cubic metre)
    if (input.onProgress !== undefined && time - lastProgress >= 60) {
      // literal-ok-end
      lastProgress = time;
      input.onProgress(Math.min(1, time / schedule.duration));
    }
  }
  flushSoil(time, lastChemistry);
  // A programme that ends while spraying leaves its film too.
  if (active !== undefined) stopSpray(active, time);
  for (let b = 0; b < blocks.count; b++) {
    if ((filmOfBath[b] as number) > (retainedFilm[b] as number))
      retainedFilm[b] = filmOfBath[b] as number;
  }
  input.onProgress?.(1);

  return {
    ticks: tickTime.length,
    tickTime: Float64Array.from(tickTime),
    tickLength: Float32Array.from(tickLength),
    tickState: Int16Array.from(tickState),
    liquor: Float64Array.from(liquorRows),
    pools: pools
      .filter((pool) => pool.volume > 0)
      .map((pool) => ({
        basin: pool.basin,
        instance: (scene.basins[pool.basin] as { instance: number }).instance,
        volume: pool.volume,
        capacity: pool.capacity,
        temperature: pool.temperature,
        detergent: pool.c[7] as number,
        dissolvedSoil: pool.dissolvedSoil,
        carriedSoil: pool.carriedSoil,
        dry: Math.max(0, pool.spillDepth - poolDepth(pool.levelTable, pool.volume)),
      })),
    retainedFilm,
    carryOver,
    soilLedger: { initial: initialSoil, remaining: soil.totalMass(), toLiquor, toPools },
    detergent: { dosed: liquor.dosed, dissolved: liquor.dissolved },
  };
}
