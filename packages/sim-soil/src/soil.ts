/**
 * The soil of the first build (docs/design/scope.md, "Soil response"; docs/research/soils.md
 * sections 7.4, 7.7 and 8.4; docs/design/sim-core.md section M8): the state of the soil on the
 * soil cells of a scene, how it is laid down from the soil records of the items, and how one
 * tick of the replay changes it.
 *
 * **State.** One row per DEPOSIT: a soil cell that carries one soil. A cell no soil covers has
 * no row; a cell under two soils has two, which do not interact. Per deposit: dry mass per area
 * (now and at the start) and a hydration state `hyd`, the progress of the class's lag (0 dry,
 * 1 the lag is over, removal fully under way from 1 + `soil.lagRamp` = 1.5).
 *
 * **Initial state** from `ItemSoilRecord {type, regions, amount_g, age_h, heat_history}`:
 *
 *   covered cells    per region, the cells where a smooth seeded field is lowest, up to the
 *                    covered share of the region's area (so a soil is a coherent smear)
 *   class            by soil id from `soil-data.ts` (a model class split by appearance and by
 *                    melting), else the class the caller's lookup gives
 *   amount           the amount stated, times a log-normal factor of coefficient of variation
 *                    `soil.amountCv` drawn per item and record (0: exactly the amount stated)
 *   dry loading      m_d = x_s amount / covered area (x_s the solids fraction of the soil id in
 *                    `soil-data.ts`, 1 for a soil stated dry; else the caller's or the
 *                    class's), times a log-normal multiplier whose coefficient of variation is
 *                    that of how the soil was laid on (`soil.applicationCv`; `soil.loadCv` for
 *                    a soil without an entry), scaled so that the record's dry
 *                    mass is exact; the multiplier is drawn per deposit, or, with
 *                    `soil.loadScale` > 0, per cube of a lattice of that pitch in the frame of
 *                    the item (the same field whatever the size of the soil cells)
 *   drying           the share of its water a soil still holds after age_h at `soil.evapFlux`,
 *                    and after the heat step of its heat history at `soil.heatDryingFactor`
 *                    times that flux, is the share of the lag it need not pay:
 *                    hyd(0) = 1.5 w(t) / w(0)
 *   bake index       B = 1 - exp(-sum k_B(T_i) t_i),  k_B(T) = k_B,ref exp[-(E_B / R)(1/T - 1/T_ref)],
 *                    over the time at room temperature and the heat step of the heat history
 *
 * **One step** ({@link WashSoil.step}), per deposit, with the class rates of its liquor
 * (`kinetics.ts`), its wet share f_w, the supply factor s of the liquor on it, the film shear
 * tau_f, and the exceedance curve D(tau) of the jet film on its cell (fraction of the time
 * the jet shear is above tau, from the jet table's time in the film, times above four shear
 * levels, and peak):
 *
 *   wetness    under a pool: f_w = 1, s = 1, no shear, no jets, the pool's liquor;
 *              else f_w = the fraction of the time there is water on the deposit under the
 *              spray, or, when the spray does not wet it, the share of the step before its
 *              residual film has gone times the wet share of the spray that left the film
 *              (so a deposit is never wetter with the spray off than with it on)
 *   held film  where only a residual film wets the deposit, nothing renews the liquor: the
 *              chemical laws below remove at most what that film can still take up
 *              (`heldCapacity`, kg/m2: the replay gives `soil.heldFilmCapacity` times the
 *              film the spray left, each time a spray stops); the lag is not limited
 *   supply     s = x / (x + x_half), x the exchange of the water on the block (the inverse of
 *              the age of the water on it, from the water table) and x_half =
 *              `soil.supplyExchange`: old water (a long run over soiled surfaces, a gap, a
 *              puddle) soaks the soil but its agents are spent. s multiplies the chemical
 *              rates below (reaction, melt, dissolve, bleach), not the lag and not the
 *              detachment of an adhesive soil, which is mechanical
 *   bake       b_r = (1 - k_r B) / (1 - k_r B_ref),  b_l = (1 + k_l B_ref) / (1 + k_l B), with
 *              B_ref the bake index of the soil the rates of the class were measured on
 *              (`soil.bakeReference`): a soil aged like the reference runs at the reference rate
 *   lag        hyd += f_w lag b_l dt;   g = clamp((hyd - 1) / ramp, 0, 1)
 *   reaction   the depth taken in the step, kg/m2:
 *              dR = g [ f_w s (J b_r + J_OH) + f_j (r - 1) J b_r ] dt,  f_j = min(1, G_pass D(tau*))
 *              with a spread of the loading inside the deposit (`soil.subCellCv` > 0, spread.ts)
 *              the depth is taken everywhere and the thin places are bare first:
 *                R += dR,  m = m_0 G(R / m_0)        (the rate falls with the share still covered)
 *              without one (the lumped element of the first build) the flux falls with the mass:
 *                dm = dR with J D_m in place of J,  D_m = min(1, m / (d m_0)) (decay stage)
 *   detach     strength = tau_a0 (1 + k_a B) x exp(-b beta_max min(hyd, 1)) h(T) / C_ad, with
 *              a log-normal scatter x per deposit (`soil.adhesionCv`) and h(T) the fall of
 *              the bond strength with the temperature of the liquor (`soil.adhesionHotFactor`)
 *              dm = m_0 [ f_w E(tau_f) + p_jet sum over bands of dD E(tau) ] dt / t_det,
 *              E(tau) = clamp(tau / strength - 1, 0, E_cap): the rate grows with the excess
 *              of the shear over the strength, in the film and in every band of the jet's
 *              exceedance curve (the stress-time above strength)
 *   melt       dm = m (1 - exp(-k f_w s a_sub dt));   jets as for detach, against tau_y(T)
 *   dissolve   dR = J f_w s dt, taken as for the reaction law
 *   bleach     dm = m (1 - exp(-k f_w s g dt))
 *
 * A cell that is never wet keeps its soil: every term carries f_w or a jet time, and a
 * jet-struck cell is wet.
 *
 * Simplifications against section M8 (each ignores something calibration may ask for): one
 * layer per deposit with a lag in place of the 12 hydration layers and the diffusion
 * solve (so no swelling profile, no water-supply limit, no thickness dependence of the lag);
 * the spread of the loading inside a deposit is one log-normal for every soil and law;
 * no cover fraction, bond integrity or edge peeling (the `detach` law is all or nothing per
 * deposit, spread over `soil.detachTime`); jet action is the exceedance curve of shear only (no
 * momentum-flux term); the supply factor is one number per block from the age of its
 * water (no film composition, no depletion of an agent by name, no wall temperature); no cohesive erosion of swollen starch; particles, composite
 * soils and redeposition are absent; baked and burnt soils use the protein law with a bake
 * factor; the surface is at the temperature of the liquor that wets it.
 *
 * Deterministic: f64, one thread, deposits in index order; the seeded fields use the
 * counter-based generator keyed by (seed, item, record, lattice point or deposit).
 *
 * Units: SI; mass per area in kg/m2, areas in m2, temperatures in degrees Celsius.
 */

import { hashU32, poseInverseTransformPoint, randomNormal, u32ToUnitFloat } from '@spotless/core';
import type { ParamSet } from '@spotless/sim-params';
import { SCENE_NONE, type ItemSoilRecord, type WashScene } from '@spotless/sim-scene';
import {
  adhesiveStrength,
  classRates,
  createClassRates,
  resolveSoilConstants,
  SOIL_LAWS,
  soilArrhenius,
  type ClassRates,
  type SoilChemistry,
  type SoilConstants,
} from './kinetics.ts';
import {
  SOIL_APPLICATIONS,
  SOIL_HEAT_STEPS,
  SOIL_MODEL_CLASSES,
  SOIL_SUBSTRATE_CLASSES,
  type SoilModelClass,
} from './params.ts';
import { heatStepOf, soilData } from './soil-data.ts';
import { createSpreadTable, sigmaOfCv } from './spread.ts';

/** What the soil model needs to know about a catalogue soil. */
export interface SoilTypeInfo {
  /** The model class that stands for it. */
  readonly modelClass: SoilModelClass;
  /** Solids mass fraction of the soil as applied, or null to use the class default. */
  readonly solidsFraction: number | null;
}

/** Returns what the soil model needs to know about a catalogue soil id. Throws for an unknown id. */
export type SoilTypeLookup = (soilTypeId: string) => SoilTypeInfo;

/** The soils of one item, as the level describes them. */
export interface SoiledItem {
  readonly itemId: string;
  readonly soils: readonly ItemSoilRecord[];
}

/** One soil record of one item as it was laid down. */
export interface SoilRecordState {
  /** Instance index of the item in the scene, and its id. */
  readonly instance: number;
  readonly itemId: string;
  /** Position of the record in the item's `soils`. */
  readonly recordIndex: number;
  /** Catalogue soil id, and the code of the model class that stands for it. */
  readonly soilType: string;
  readonly classCode: number;
  /** Bake index B, 0 to 1. */
  readonly bake: number;
  /** Its deposits: `firstDeposit .. firstDeposit + depositCount - 1`. */
  readonly firstDeposit: number;
  readonly depositCount: number;
  /** Dry mass laid down, kg, and the area it covers, m2. */
  readonly dryMass: number;
  readonly coveredArea: number;
}

/** The state of the soil on a scene: one entry per deposit in every array. */
export interface SoilState {
  /** The model classes; the position of a class is its code. */
  readonly classes: readonly string[];
  /** Number of deposits. */
  readonly count: number;
  /** Soil cell and block of the scene each deposit lies on. */
  readonly cell: Uint32Array;
  readonly block: Uint32Array;
  /** Index into `records`. */
  readonly record: Uint32Array;
  /** Class code. */
  readonly classCode: Uint8Array;
  /** Area of the deposit (that of its soil cell), m2. */
  readonly area: Float32Array;
  /** Dry mass per area at the start, kg/m2. */
  readonly mass0: Float64Array;
  /** Dry mass per area now, kg/m2. */
  readonly mass: Float64Array;
  /** Hydration state: progress of the lag, 0 to 1 + `soil.lagRamp`. */
  readonly hydration: Float64Array;
  /**
   * Depth a zero-order law has taken from the deposit so far, kg/m2; kept only with a spread
   * of the loading inside a deposit (`soil.subCellCv` > 0), where `mass` follows from it.
   */
  readonly eroded: Float64Array;
  /** The soil records, items in scene order (sorted by id), records in the order given. */
  readonly records: readonly SoilRecordState[];
  /** Soil records or regions that could not be laid down, in words. */
  readonly problems: readonly string[];
}

/** RNG domains of the seeded fields. */
const COVER_DOMAIN = 0x636f7672;
const LOAD_DOMAIN = 0x6c6f6164;
const AMOUNT_DOMAIN = 0x616d6e74;
const LOAD_LATTICE_DOMAIN = 0x6c6c6174;

/** A u32 key of a string (an item id), by folding its characters through the generator. */
export function stringKey(text: string): number {
  let key = text.length >>> 0;
  for (let i = 0; i < text.length; i++) key = hashU32(key, text.charCodeAt(i));
  return key;
}

/**
 * A smooth field in [0, 1): trilinear interpolation of hashed values on a cubic lattice of
 * pitch `scale` (metres) in the item frame. Keyed by lattice point, so it does not depend on
 * how the surface is gridded.
 */
function smoothField(
  seed: number,
  itemKey: number,
  record: number,
  p: readonly number[],
  scale: number,
): number {
  const x = (p[0] as number) / scale;
  const y = (p[1] as number) / scale;
  const z = (p[2] as number) / scale;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const at = (dx: number, dy: number, dz: number): number =>
    u32ToUnitFloat(
      hashU32(
        seed,
        COVER_DOMAIN,
        itemKey,
        record,
        (ix + dx) >>> 0,
        (iy + dy) >>> 0,
        (iz + dz) >>> 0,
      ),
    );
  const lerp = (a: number, b: number, f: number): number => a + (b - a) * f;
  return lerp(
    lerp(lerp(at(0, 0, 0), at(1, 0, 0), fx), lerp(at(0, 1, 0), at(1, 1, 0), fx), fy),
    lerp(lerp(at(0, 0, 1), at(1, 0, 1), fx), lerp(at(0, 1, 1), at(1, 1, 1), fx), fy),
    fz,
  );
}

/**
 * The bake index of a soil record: B = 1 - exp(-sum k_B(T_i) t_i) over its time at room
 * temperature and the heat step of its heat history (soils 7.4, 8.3).
 */
export function bakeIndex(params: ParamSet, record: ItemSoilRecord): number {
  const rate = params.get('soil.bakeRate');
  const ea = params.get('soil.bakeEa');
  const r = params.get('soil.gasConstant');
  const ref = params.get('soil.bakeRefTemperature');
  let exposure =
    rate *
    soilArrhenius(ea, r, params.get('soil.roomTemperature'), ref) *
    Math.max(record.age_h, 0) *
    // literal-ok-begin: unit conversion (seconds per hour or minute, grams per kilogram, litres per cubic metre)
    3600;
  // literal-ok-end
  const step = (SOIL_HEAT_STEPS as readonly string[]).indexOf(
    heatStepOf(record.type, record.heat_history),
  );
  if (step >= 0) {
    const temperature = params.getVector('soil.heatTemperature')[step] ?? ref;
    const duration = params.getVector('soil.heatDuration')[step] ?? 0;
    exposure += rate * soilArrhenius(ea, r, temperature, ref) * duration;
  }
  return 1 - Math.exp(-exposure);
}

/**
 * Lays the soil records of the items down on the soil cells of a scene. `levelSeed` (u32) keys
 * the seeded fields: which part of a region is covered, and the loading of each deposit.
 *
 * The scene must carry soil cells on every region a record names (the orchestrator builds it
 * with soil cells on every region of every item, so that the scene, and with it the cached
 * exposure, does not depend on the soils). A record or region that cannot be laid down is
 * reported in `problems` and left out.
 */
export function initSoil(
  scene: WashScene,
  items: readonly SoiledItem[],
  lookup: SoilTypeLookup,
  params: ParamSet,
  levelSeed: number,
): SoilState {
  const seed = levelSeed >>> 0;
  const classes = SOIL_MODEL_CLASSES as readonly string[];
  const constants = resolveSoilConstants(params);
  const evap = params.get('soil.evapFlux');
  const heatDrying = params.get('soil.heatDryingFactor');
  const heatDurations = params.getVector('soil.heatDuration');
  // The hydration state at which removal runs at its full rate: the lag and its ramp.
  const full = 1 + constants.lagRamp;
  const defaultCv = params.get('soil.loadCv');
  const applicationCv = params.getVector('soil.applicationCv');
  const amountCv = params.get('soil.amountCv');
  const amountSigma = Math.sqrt(Math.log(1 + amountCv * amountCv));
  const scale = params.get('soil.patchScale');
  const loadScale = params.get('soil.loadScale');
  const blocks = scene.blocks;
  const cells = scene.soilCells;
  const problems: string[] = [];

  const cellOut: number[] = [];
  const recordOut: number[] = [];
  const classOut: number[] = [];
  const massOut: number[] = [];
  const hydOut: number[] = [];
  const records: SoilRecordState[] = [];

  const byId = [...items].sort((a, b) => (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0));
  for (const item of byId) {
    const instanceIndex = scene.itemInstance.get(item.itemId);
    const instance = instanceIndex === undefined ? undefined : scene.instances[instanceIndex];
    if (instance === undefined || instanceIndex === undefined) {
      if (item.soils.length > 0) problems.push(`${item.itemId}: not in the scene`);
      continue;
    }
    const itemKey = stringKey(item.itemId);
    const regions = instance.shape.regions;
    item.soils.forEach((record, recordIndex) => {
      let info: SoilTypeInfo;
      try {
        info = lookup(record.type);
      } catch {
        problems.push(`${item.itemId}: unknown soil "${record.type}"`);
        return;
      }
      // What the soil side knows about the soil by its id (soil-data.ts) comes first: the
      // model class (split by appearance and melting), the solids fraction (1 for a soil
      // stated dry) and how it was laid on. For an id it does not know: the caller's class,
      // the caller's solids fraction or that of the class, and the scatter of a smear.
      const datum = soilData(record.type);
      const modelClass: SoilModelClass = datum?.modelClass ?? info.modelClass;
      const classCode = classes.indexOf(modelClass);
      const solids = Math.min(
        1,
        Math.max(
          datum?.solidsFraction ??
            info.solidsFraction ??
            params.soilClass(modelClass, 'solidsFraction'),
          0,
        ),
      );
      const cv =
        datum === undefined
          ? defaultCv
          : (applicationCv[SOIL_APPLICATIONS.indexOf(datum.application)] ?? defaultCv);
      const sigma = Math.sqrt(Math.log(1 + cv * cv));

      // The covered cells, region by region.
      const chosen: number[] = [];
      const latticeOf = new Map<number, number>();
      let coveredArea = 0;
      for (const entry of record.regions) {
        if (!(entry.coverage > 0)) continue;
        const candidates: { cell: number; field: number; lattice: number }[] = [];
        let regionArea = 0;
        for (let b = instance.firstBlock; b < instance.firstBlock + instance.blockCount; b++) {
          const regionIndex = blocks.region[b] as number;
          if (regionIndex < 0 || regions[regionIndex]?.id !== entry.region) continue;
          const first = blocks.soilFirst[b] as number;
          if (first === SCENE_NONE) continue;
          for (let q = 0; q < 4; q++) {
            const c = first + q;
            regionArea += cells.area[c] as number;
            const local = poseInverseTransformPoint(instance.pose, [
              cells.centre[3 * c] as number,
              cells.centre[3 * c + 1] as number,
              cells.centre[3 * c + 2] as number,
            ]);
            candidates.push({
              cell: c,
              field: smoothField(seed, itemKey, recordIndex, local, scale),
              // The cube of the loading lattice the cell lies in, as one u32 key.
              lattice:
                loadScale > 0
                  ? hashU32(
                      Math.floor((local[0] as number) / loadScale) >>> 0,
                      Math.floor((local[1] as number) / loadScale) >>> 0,
                      Math.floor((local[2] as number) / loadScale) >>> 0,
                    )
                  : 0,
            });
          }
        }
        if (candidates.length === 0) {
          problems.push(
            `${item.itemId}: no soil cells on region "${entry.region}" for ${record.type}`,
          );
          continue;
        }
        candidates.sort((a, b) => a.field - b.field || a.cell - b.cell);
        const target = Math.min(1, entry.coverage) * regionArea;
        let area = 0;
        for (const candidate of candidates) {
          // Take the cell if that brings the covered area nearer the target.
          const a = cells.area[candidate.cell] as number;
          if (area + 0.5 * a > target && area > 0) break;
          chosen.push(candidate.cell);
          latticeOf.set(candidate.cell, candidate.lattice);
          area += a;
        }
        coveredArea += area;
      }
      if (chosen.length === 0 || !(coveredArea > 0)) {
        problems.push(`${item.itemId}: soil ${record.type} covers nothing`);
        return;
      }
      chosen.sort((a, b) => a - b);

      // Loading: log-normal about the mean, scaled so that the dry mass of the record is exact.
      // The amount applied scatters from one soiling to the next about the amount stated.
      const applied =
        amountSigma > 0
          ? Math.exp(
              amountSigma * randomNormal(seed, AMOUNT_DOMAIN, itemKey, recordIndex) -
                0.5 * amountSigma * amountSigma,
            )
          : 1;
      // literal-ok-begin: unit conversion (seconds per hour or minute, grams per kilogram, litres per cubic metre)
      const dryMass = (applied * solids * Math.max(record.amount_g, 0)) / 1000;
      const wetLoading = (applied * Math.max(record.amount_g, 0)) / 1000 / coveredArea;
      // literal-ok-end
      const water = (1 - solids) * wetLoading;
      // Water lost before the wash: at room conditions over its age, and in the heat step of
      // its heat history at the flux of the heat step.
      const heatStep = (SOIL_HEAT_STEPS as readonly string[]).indexOf(
        heatStepOf(record.type, record.heat_history),
      );
      const evaporated =
        // literal-ok-begin: unit conversion (seconds per hour or minute, grams per kilogram, litres per cubic metre)
        evap * Math.max(record.age_h, 0) * 3600 +
        // literal-ok-end
        (heatStep >= 0 ? evap * heatDrying * (heatDurations[heatStep] ?? 0) : 0);
      const left = water > 0 ? Math.max(0, water - evaporated) / water : 0;
      const hasLag = (constants.tLag[classCode] as number) > 0;
      const hyd0 = hasLag ? full * left : full;
      const multipliers = chosen.map((c, i) =>
        sigma > 0
          ? Math.exp(
              sigma *
                (loadScale > 0
                  ? randomNormal(
                      seed,
                      LOAD_LATTICE_DOMAIN,
                      itemKey,
                      recordIndex,
                      latticeOf.get(c) ?? 0,
                    )
                  : randomNormal(seed, LOAD_DOMAIN, itemKey, recordIndex, i)) -
                0.5 * sigma * sigma,
            )
          : 1,
      );
      let weighted = 0;
      chosen.forEach((c, i) => {
        weighted += (multipliers[i] as number) * (cells.area[c] as number);
      });
      const firstDeposit = cellOut.length;
      chosen.forEach((c, i) => {
        cellOut.push(c);
        recordOut.push(records.length);
        classOut.push(classCode);
        massOut.push(weighted > 0 ? (dryMass * (multipliers[i] as number)) / weighted : 0);
        hydOut.push(hyd0);
      });
      records.push({
        instance: instanceIndex,
        itemId: item.itemId,
        recordIndex,
        soilType: record.type,
        classCode,
        bake: bakeIndex(params, record),
        firstDeposit,
        depositCount: chosen.length,
        dryMass,
        coveredArea,
      });
    });
  }

  const count = cellOut.length;
  const cell = Uint32Array.from(cellOut);
  const block = new Uint32Array(count);
  const area = new Float32Array(count);
  for (let d = 0; d < count; d++) {
    const c = cell[d] as number;
    block[d] = cells.block[c] as number;
    area[d] = cells.area[c] as number;
  }
  return {
    classes,
    count,
    cell,
    block,
    record: Uint32Array.from(recordOut),
    classCode: Uint8Array.from(classOut),
    area,
    mass0: Float64Array.from(massOut),
    mass: Float64Array.from(massOut),
    hydration: Float64Array.from(hydOut),
    eroded: new Float64Array(count),
    records,
    problems,
  };
}

/**
 * Where the columns of a jet table are (`JET_FIELD` of `@spotless/sim-jets`, which this
 * package does not depend on): numbers per row, and the position in a row of the time inside
 * the fast film, the times above the four shear levels, and the peak shear.
 */
export interface SoilJetColumns {
  readonly stride: number;
  readonly wetDuty: number;
  /** Time above the first shear level; `level1` to `level3` above the next three. */
  readonly duty: number;
  readonly level1: number;
  readonly level2: number;
  readonly level3: number;
  readonly shearPeak: number;
}

/**
 * What the replay tells the soil about one step: the effective exposure of every deposit and
 * the liquors there are. Arrays have one entry per deposit of the `SoilState`. The replay owns
 * the arrays and rewrites them only when something changes (a new spray state, a pool level),
 * which is why a draining film is given as an expiry time and not as a share per step. A step
 * may span several revolutions of the arm: every law is linear or exponential in `dt`.
 */
export interface SoilForcing {
  /** Start of the step, seconds from the start of the programme, and its length, seconds. */
  readonly time: number;
  readonly dt: number;
  /**
   * Time of one revolution of the master arm of the active spray state, seconds; 0 with the
   * pump off (jets then do nothing).
   */
  readonly period: number;
  /**
   * Fraction of the time there is water on the deposit under the active spray state, 0 to 1
   * (the `wetTime` of the surface water: film, rivulet or drops; a deposit is hydrophilic and
   * is wetted by any of them, whatever the bare substrate does).
   */
  readonly wet: Float32Array;
  /**
   * Supply factor of the liquor on the deposit under the active spray state, 0 to 1: how far
   * the water on it is fresh enough to count as the bulk liquor (1) and not as old water whose
   * agents are spent (0): x / (x + `soil.supplyExchange`) of the exchange x of the water on
   * its block. Multiplies every chemical rate, not the soaking.
   */
  readonly supply: Float32Array;
  /**
   * Time (seconds from the start of the programme) until which a residual film keeps the
   * deposit wet where the active spray state does not, and the wet share of the spray state
   * that left that film: the deposit counts as wet over `wetHeld` for the part of the step
   * before that time. Nothing renews a residual film: it has no supply of its own, only what
   * it held when the spray stopped (`heldCapacity`).
   */
  readonly wetUntil: Float64Array;
  readonly wetHeld: Float32Array;
  /**
   * Dry soil (kg/m2) the residual film on each deposit can still take up before it is spent
   * (`soil.heldFilmCapacity` times the film the spray left). The soil model lowers it by what
   * the chemical laws remove while a deposit is wet by its residual film only, and removes no
   * more than is left; the replay sets it anew each time a spray stops. Absent (a bench
   * calculation without a film balance): no limit.
   */
  readonly heldCapacity?: Float64Array;
  /** Wall shear of the flowing film on the deposit while it is wet under the spray, Pa. */
  readonly filmShear: Float32Array;
  /**
   * Row of the deposit's soil cell in the jet table of the active spray state, or -1 where no
   * jet film reaches it; the table (`jetColumns.stride` numbers per row), where its columns
   * are, and the four shear levels (Pa, ascending) its `duty` and `level` columns count time
   * above.
   */
  readonly jetRow: Int32Array;
  readonly jetValues: Float32Array;
  readonly jetColumns: SoilJetColumns;
  readonly jetShearLevels: readonly number[];
  /**
   * Factor on jet shear for the liquor of this step: sqrt(nu(T) / nu(T_solve)), because the
   * exposure was computed for water at the solve temperature.
   */
  readonly jetShearScale: number;
  /**
   * Which liquor the deposit sees: 0 the sump liquor (under a film); k > 0 the pool
   * `chemistry[k]` it is under at this step (immersed: wet all the time, no shear, no jets).
   */
  readonly liquor: Uint16Array;
  /** The liquors: entry 0 the sump liquor, the others the pools. */
  readonly chemistry: readonly SoilChemistry[];
}

/** The soil of one wash: steps in, state out. */
export interface WashSoil {
  readonly state: SoilState;
  /**
   * Advances every deposit by one step. Returns the dry mass removed in the step, kg, per
   * liquor of `forcing.chemistry` (the sump liquor first): where the removed soil went. The
   * returned array is reused by the next call.
   */
  step(forcing: SoilForcing): Float64Array;
  /** Dry mass on the load now, kg. */
  totalMass(): number;
}

/** RNG domain of the strength scatter of the `detach` law. */
const STRENGTH_DOMAIN = 0x73747267;

/**
 * The soil stage of one wash over a soil state, which it updates in place. `params` is a set
 * built on a registry that holds `SOIL_PARAM_DEFS`.
 */
export function createWashSoil(state: SoilState, scene: WashScene, params: ParamSet): WashSoil {
  const c: SoilConstants = resolveSoilConstants(params);
  const n = state.count;
  const law = new Uint8Array(n);
  const rateScale = new Float32Array(n);
  const lagScale = new Float32Array(n);
  const adhesion = new Float32Array(n);
  const substrate = new Float32Array(n);
  const LAW_REACTION = SOIL_LAWS.indexOf('reaction');
  const LAW_DETACH = SOIL_LAWS.indexOf('detach');
  const LAW_MELT = SOIL_LAWS.indexOf('melt');
  const LAW_DISSOLVE = SOIL_LAWS.indexOf('dissolve');
  // The first soil cell of every instance: the scatter of a deposit is keyed by its cell
  // within its item, so it does not depend on what else is loaded or on which deposits a
  // caller kept.
  const firstCell = new Map<number, number>();
  const firstCellOf = (instanceIndex: number): number => {
    let first = firstCell.get(instanceIndex);
    if (first === undefined) {
      first = 0;
      const instance = scene.instances[instanceIndex];
      if (instance !== undefined) {
        for (let b = instance.firstBlock; b < instance.firstBlock + instance.blockCount; b++) {
          const f = scene.blocks.soilFirst[b] as number;
          if (f !== SCENE_NONE) {
            first = f;
            break;
          }
        }
      }
      firstCell.set(instanceIndex, first);
    }
    return first;
  };
  const sigma = Math.sqrt(Math.log(1 + c.adhesionCv * c.adhesionCv));
  for (let d = 0; d < n; d++) {
    const record = state.records[state.record[d] as number];
    const bake = record?.bake ?? 0;
    law[d] = c.law[state.classCode[d] as number] as number;
    // Relative to the bake index of the soil the class's rates were measured on (0: the whole
    // bake index counts).
    const reference = c.bakeReference[state.classCode[d] as number] as number;
    const atReference = 1 - c.bakeRateFactor * reference;
    rateScale[d] = atReference > 0 ? Math.max(0, 1 - c.bakeRateFactor * bake) / atReference : 0;
    lagScale[d] = (1 + c.bakeLagFactor * reference) / (1 + c.bakeLagFactor * bake);
    let strength = 1 + c.bakeAdhesionFactor * bake;
    if (law[d] === LAW_DETACH && sigma > 0 && record !== undefined) {
      // The bond strength of a dried deposit scatters from place to place (log-normal about
      // its mean), which is what makes the removed share a smooth function of the strength.
      const z = randomNormal(
        STRENGTH_DOMAIN,
        stringKey(record.itemId),
        record.recordIndex,
        ((state.cell[d] as number) - firstCellOf(record.instance)) >>> 0,
      );
      strength *= Math.exp(sigma * z - 0.5 * sigma * sigma);
    }
    adhesion[d] = strength;
    const material = scene.materials[scene.blocks.material[state.block[d] as number] as number];
    const wetting = (SOIL_SUBSTRATE_CLASSES as readonly string[]).indexOf(
      material?.wettingClass ?? '',
    );
    substrate[d] = c.fatRollUp[wetting < 0 ? 0 : wetting] ?? 1;
  }
  const full = 1 + c.lagRamp;
  let rates: ClassRates[] = [];
  let removed = new Float64Array(1);
  const { mass, mass0, hydration, classCode, area, eroded } = state;
  // The spread of the loading inside a deposit: with it a zero-order law takes a depth and the
  // mass follows; without it the deposit is lumped.
  const spreadSigma = sigmaOfCv(c.subCellCv);
  const spread = spreadSigma > 0 ? createSpreadTable(spreadSigma) : undefined;
  // The deposits that still carry soil, ascending; compacted as they empty.
  const active = new Uint32Array(n);
  let activeCount = 0;
  for (let d = 0; d < n; d++) if ((mass[d] as number) > 0) active[activeCount++] = d;

  // The jet row of the deposit in hand (set by the loop before `exceed` and `erosion` run).
  let J: Float32Array = new Float32Array(0);
  let jo = 0;
  let jc: SoilJetColumns = {
    stride: 1,
    wetDuty: 0,
    duty: 0,
    level1: 0,
    level2: 0,
    level3: 0,
    shearPeak: 0,
  };
  let jl0 = Infinity;
  let jl1 = Infinity;
  let jl2 = Infinity;
  let jl3 = Infinity;
  let jetScale = 1;
  /**
   * Fraction of the time the jet film stresses the deposit above `threshold` (Pa, at the
   * liquor's temperature): the exceedance curve through (0, time in the film), the four shear
   * levels and (peak, 0), linear between them.
   */
  const exceed = (threshold: number): number => {
    const t = threshold / jetScale;
    const peak = J[jo + jc.shearPeak] as number;
    if (!(t < peak)) return 0;
    let x0 = 0;
    let y0 = J[jo + jc.wetDuty] as number;
    for (let k = 0; k < 4; k++) {
      const level = k === 0 ? jl0 : k === 1 ? jl1 : k === 2 ? jl2 : jl3;
      if (!(level < peak)) break;
      const y = J[
        jo + (k === 0 ? jc.duty : k === 1 ? jc.level1 : k === 2 ? jc.level2 : jc.level3)
      ] as number;
      if (t < level) return y0 + ((y - y0) * (t - x0)) / (level - x0);
      x0 = level;
      y0 = y;
    }
    return (y0 * (peak - t)) / (peak - x0);
  };
  /**
   * Erosion integral of the jet film against a deposit of the given strength (Pa): the time
   * fraction in each band of the exceedance curve times the excess of its mid shear over the
   * strength, (tau / strength - 1) capped at `soil.detachExcessCap`.
   */
  const erosion = (strength: number): number => {
    const peak = (J[jo + jc.shearPeak] as number) * jetScale;
    if (!(peak > strength)) return 0;
    let total = 0;
    let x0 = 0;
    let y0 = J[jo + jc.wetDuty] as number;
    for (let k = 0; k <= 4; k++) {
      let x1 = peak;
      let y1 = 0;
      if (k < 4) {
        const level = (k === 0 ? jl0 : k === 1 ? jl1 : k === 2 ? jl2 : jl3) * jetScale;
        if (level < peak) {
          x1 = level;
          y1 = J[
            jo + (k === 0 ? jc.duty : k === 1 ? jc.level1 : k === 2 ? jc.level2 : jc.level3)
          ] as number;
        }
      }
      const share = y0 - y1;
      if (share > 0) {
        const excess = strength > 0 ? (0.5 * (x0 + x1)) / strength - 1 : c.detachExcessCap;
        if (excess > 0) total += share * Math.min(c.detachExcessCap, excess);
      }
      if (x1 >= peak) break;
      x0 = x1;
      y0 = y1;
    }
    return total;
  };

  return {
    state,
    step(forcing) {
      const liquors = forcing.chemistry.length;
      while (rates.length < liquors) rates.push(createClassRates(c.classCount));
      if (removed.length !== liquors) removed = new Float64Array(liquors);
      else removed.fill(0);
      for (let l = 0; l < liquors; l++) {
        classRates(c, forcing.chemistry[l] as SoilChemistry, rates[l] as ClassRates);
      }
      const { dt, time, wet, supply, wetUntil, wetHeld, filmShear, jetRow, liquor } = forcing;
      const capacity = forcing.heldCapacity;
      J = forcing.jetValues;
      jc = forcing.jetColumns;
      jl0 = forcing.jetShearLevels[0] ?? Infinity;
      jl1 = forcing.jetShearLevels[1] ?? Infinity;
      jl2 = forcing.jetShearLevels[2] ?? Infinity;
      jl3 = forcing.jetShearLevels[3] ?? Infinity;
      jetScale = forcing.jetShearScale;
      const jets = forcing.period > 0;
      const perDetach = dt / c.detachTime;
      const count = activeCount;
      let kept = 0;
      for (let i = 0; i < count; i++) {
        const d = active[i] as number;
        const m = mass[d] as number;
        if (!(m > 0)) continue;
        active[kept++] = d;
        const l = liquor[d] as number;
        let fw: number;
        let sup = 1;
        let tauF = 0;
        let jet = false;
        // Dry soil the chemical laws may remove in this step, kg/m2: what a residual film
        // that nothing renews can still take up; no limit under a spray or a pool.
        let limit = Infinity;
        let held = false;
        if (l > 0) {
          fw = 1;
        } else {
          fw = wet[d] as number;
          if (fw > 0) {
            tauF = filmShear[d] as number;
            sup = supply[d] as number;
          } else {
            const remaining = (wetUntil[d] as number) - time;
            if (remaining > 0) {
              fw = (remaining >= dt ? 1 : remaining / dt) * (wetHeld[d] as number);
              // Fresh liquor when the spray left it, and nothing since: full rate until
              // what it can take up is used.
              sup = 1;
              if (capacity !== undefined) {
                held = true;
                limit = capacity[d] as number;
              }
            }
          }
          const row = jets ? (jetRow[d] as number) : -1;
          if (row >= 0) {
            jo = row * jc.stride;
            const inFilm = J[jo + jc.wetDuty] as number;
            if (inFilm > 0) {
              jet = true;
              // A cell under a jet film is wet, and supplied, at least while the film is on it.
              if (fw < inFilm) {
                fw = inFilm;
                sup = 1;
                held = false;
                limit = Infinity;
              }
            }
          }
        }
        if (!(fw > 0)) continue;
        const k = classCode[d] as number;
        const r = rates[l] as ClassRates;
        let hyd = hydration[d] as number;
        if (hyd < full) {
          hyd = Math.min(full, hyd + fw * (r.lag[k] as number) * (lagScale[d] as number) * dt);
          hydration[d] = hyd;
        }
        const gate = hyd <= 1 ? 0 : hyd >= full ? 1 : (hyd - 1) / c.lagRamp;
        const m0 = mass0[d] as number;
        const kind = law[d] as number;
        let dm = 0;
        if (kind === LAW_REACTION) {
          if (gate > 0) {
            // Lumped element: the flux falls with the mass left (the decay stage). With a
            // spread inside the deposit the fall comes from the share still covered.
            const decay = spread === undefined ? Math.min(1, m / (c.decayOnset * m0)) : 1;
            const flux = (r.flux[k] as number) * (rateScale[d] as number) * decay;
            let assist = 0;
            if (jet) {
              const f = c.jetPassGain * exceed(c.tauStar[k] as number);
              assist = (f < 1 ? f : 1) * ((c.jetRatio[k] as number) - 1);
            }
            dm = gate * (fw * sup * (flux + (r.alkaline[k] as number)) + assist * flux) * dt;
            if (dm > limit) dm = limit;
            if (spread !== undefined && dm > 0) {
              const depth = (eroded[d] as number) + dm;
              eroded[d] = depth;
              dm = m - m0 * spread.left(depth / m0);
            }
          }
        } else if (kind === LAW_DETACH) {
          // The bond at the temperature of the liquor that wets it (soils 2.4).
          const strength =
            adhesiveStrength(c, hyd, adhesion[d] as number) * (r.strength[k] as number);
          let rate = 0;
          if (tauF > strength) rate = fw * Math.min(c.detachExcessCap, tauF / strength - 1);
          if (jet) rate += c.jetDetach * erosion(strength);
          dm = m0 * rate * perDetach;
        } else if (kind === LAW_MELT) {
          dm =
            m * (1 - Math.exp(-(r.first[k] as number) * fw * sup * (substrate[d] as number) * dt));
          if (dm > limit) dm = limit;
          if (jet) dm += m0 * c.jetDetach * erosion(r.strength[k] as number) * perDetach;
        } else if (kind === LAW_DISSOLVE) {
          dm = (r.flux[k] as number) * fw * sup * dt;
          if (dm > limit) dm = limit;
          if (spread !== undefined && dm > 0) {
            const depth = (eroded[d] as number) + dm;
            eroded[d] = depth;
            dm = m - m0 * spread.left(depth / m0);
          }
        } else {
          dm = m * (1 - Math.exp(-(r.first[k] as number) * fw * sup * gate * dt));
          if (dm > limit) dm = limit;
        }
        if (!(dm > 0)) continue;
        const next = dm >= m ? 0 : m - dm;
        if (held && capacity !== undefined) {
          const left = limit - (m - next);
          capacity[d] = left > 0 ? left : 0;
        }
        mass[d] = next;
        removed[l] = (removed[l] as number) + (m - next) * (area[d] as number);
      }
      activeCount = kept;
      return removed;
    },
    totalMass() {
      let total = 0;
      for (let d = 0; d < n; d++) total += (mass[d] as number) * (area[d] as number);
      return total;
    },
  };
}
