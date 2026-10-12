/**
 * Records made by the program: test-tile loads laid out from a few numbers
 * ({@link tileRecord}), and synthetic records, in which the observations of a planned record
 * are drawn from the simulator at stated parameters with observation noise
 * ({@link synthesiseRecord}). Both feed the recovery studies, the tests and experiment ranking
 * (docs/calibration/fitting.md sections 6 and 7).
 *
 * Randomness comes only from the counter-based generator of `@spotless/core`, keyed by the
 * seed, the record and the observation.
 */

import { quatFromTo, randomNormal, randomUniform, type Quat, type Vec3 } from '@spotless/core';
import { boundingBox } from '@spotless/geometry';
import type { ParamSet } from '@spotless/sim-core';
import { EvaluatorPool } from './evaluator.ts';
import { outlierSpan, sampleObservation } from './observation.ts';
import {
  customShapeOf,
  WASH_RECORD_FORMAT,
  WASH_RECORD_VERSION,
  type CustomShape,
  type ObservationKind,
  type RecordItem,
  type RecordObservation,
  type RecordSoil,
  type WashRecord,
} from './record.ts';
import { stringKey } from './util.ts';

/** One test tile of {@link tileRecord}. */
export interface TileSpec {
  /** Item id. */
  readonly id: string;
  /** `lower_rack` or `upper_rack`. */
  readonly rack: 'lower_rack' | 'upper_rack';
  /** Where the middle of the tile stands in the rack frame, millimetres. */
  readonly x_mm: number;
  readonly y_mm: number;
  /**
   * Which way the soiled face looks: a horizontal direction (`+x`, `-x`, `+y`, `-y`) for a
   * tile on edge, `down` or `up` for one lying flat.
   */
  readonly facing: '+x' | '-x' | '+y' | '-y' | 'down' | 'up';
  /** Lean of a tile on edge from the vertical, degrees, soiled face tilted downwards; default 10. */
  readonly lean_deg?: number;
  /** Height of the lowest point of the tile above the base grid of the rack, millimetres; default 4. */
  readonly lift_mm?: number;
  /** Catalogue soil id or model class on its soiled face. */
  readonly soil: string;
  /** Wet amount applied, grams. */
  readonly amount_g: number;
  /** Diameter of the soiled disc at the middle of the face, millimetres; absent: the whole face. */
  readonly disc_mm?: number;
  /** Hours of drying and the heat history; defaults 2 h and none. */
  readonly drying_h?: number;
  readonly heat?: RecordSoil['heat'];
}

/** What {@link tileRecord} is given. */
export interface TileRecordOptions {
  readonly id: string;
  readonly title?: string;
  readonly tiles: readonly TileSpec[];
  /** Size and material of the tiles; default 100 x 100 x 6 mm glazed porcelain. */
  readonly tile?: { length_mm: number; width_mm: number; thickness_mm: number; material: string };
  /** Kinds observed on every tile at the end; default the soiled-area fraction. */
  readonly kinds?: readonly ObservationKind[];
  /** Times of interrupted observations, seconds from the start; default none. */
  readonly at_s?: readonly number[];
  /** Kinds observed at those times; default those of the end without `retained_water`. */
  readonly interruptedKinds?: readonly ObservationKind[];
  /** Stated standard uncertainty per kind; defaults: area 0.05, mass 2 mg, mass fraction 0.03, score 0, water 0.5 mL. */
  readonly sd?: Partial<Record<ObservationKind, number>>;
  readonly machine?: string;
  readonly programme?: string;
  readonly tier?: 'official' | 'fast';
  readonly levelSeed?: number;
  readonly simSeed?: number;
}

const DEFAULT_SD: Record<ObservationKind, number> = {
  score: 0,
  area_fraction: 0.05,
  visible_area: 0.4,
  residual_mass: 2,
  mass_fraction: 0.03,
  specks: 0,
  clean: 0,
  retained_water: 0.5,
};

const METHOD_OF_KIND: Record<ObservationKind, string> = {
  score: 'eye',
  area_fraction: 'photo',
  visible_area: 'photo',
  residual_mass: 'scale',
  mass_fraction: 'scale',
  specks: 'eye',
  clean: 'eye',
  retained_water: 'scale',
};

/** The pose of a tile in its rack frame: position of its frame origin (mm) and quaternion. */
function tilePose(
  custom: CustomShape,
  spec: TileSpec,
): { position_mm: [number, number, number]; quat_wxyz: [number, number, number, number] } {
  const lean = ((spec.lean_deg ?? 10) * Math.PI) / 180;
  let normal: Vec3;
  switch (spec.facing) {
    case '+x':
      normal = [Math.cos(lean), 0, -Math.sin(lean)];
      break;
    case '-x':
      normal = [-Math.cos(lean), 0, -Math.sin(lean)];
      break;
    case '+y':
      normal = [0, Math.cos(lean), -Math.sin(lean)];
      break;
    case '-y':
      normal = [0, -Math.cos(lean), -Math.sin(lean)];
      break;
    case 'down':
      normal = [0, 0, -1];
      break;
    case 'up':
      normal = [0, 0, 1];
      break;
  }
  // The soiled face is the `top` of the slab, whose outward normal is +z of the item frame.
  const q: Quat = spec.facing === 'down' ? [1, 0, 0, 0] : quatFromTo([0, 0, 1], normal);
  const box = boundingBox(customShapeOf(custom), { p: [0, 0, 0], q });
  const lift = (spec.lift_mm ?? 4) / 1000;
  return {
    position_mm: [
      spec.x_mm - 500 * (box.min[0] + box.max[0]),
      spec.y_mm - 500 * (box.min[1] + box.max[1]),
      1000 * (lift - box.min[2]),
    ],
    quat_wxyz: [q[3], q[0], q[1], q[2]],
  };
}

/**
 * A planned record of test tiles: each a flat tile with one soil on its `top` face, standing
 * on edge or lying in a rack, with the same observation plan for every tile. Tiles are placed
 * by rule, not by the loading physics: keep them clear of each other and of the tines.
 */
export function tileRecord(options: TileRecordOptions): WashRecord {
  const size = options.tile ?? {
    length_mm: 100,
    width_mm: 100,
    thickness_mm: 6,
    material: 'porcelain_glazed',
  };
  const custom: CustomShape = { tile: size };
  const kinds = options.kinds ?? ['area_fraction'];
  const interrupted = options.interruptedKinds ?? kinds.filter((k) => k !== 'retained_water');
  const sd = { ...DEFAULT_SD, ...(options.sd ?? {}) };
  const items: RecordItem[] = [];
  const observations: RecordObservation[] = [];
  const observe = (item: string, kind: ObservationKind, at?: number): void => {
    observations.push({
      item,
      target: { soil: 'soil_1' },
      ...(at === undefined ? {} : { at_s: at }),
      kind,
      method: METHOD_OF_KIND[kind],
      ...(sd[kind] > 0 ? { sd: sd[kind] } : {}),
    });
  };
  for (const tile of options.tiles) {
    const pose = tilePose(custom, tile);
    const soil: RecordSoil = {
      id: 'soil_1',
      type: tile.soil,
      amount_g: tile.amount_g,
      amount_method: 'scale',
      where:
        tile.disc_mm === undefined
          ? { regions: [{ region: 'top', coverage: 1 }] }
          : {
              patch: {
                region: 'top',
                shape: 'disc',
                centre_mm: [0, 0, size.thickness_mm],
                diameter_mm: tile.disc_mm,
                description: `${tile.disc_mm} mm disc at the middle of the face`,
              },
            },
      drying: { time_h: tile.drying_h ?? 2 },
      heat: tile.heat ?? { history: 'none' },
    };
    items.push({
      id: tile.id,
      type: `test_tile_${size.length_mm}x${size.width_mm}`,
      custom,
      frame: tile.rack,
      position_mm: pose.position_mm,
      quat_wxyz: pose.quat_wxyz,
      soils: [soil],
    });
    for (const at of options.at_s ?? []) for (const kind of interrupted) observe(tile.id, kind, at);
    for (const kind of kinds) observe(tile.id, kind);
  }
  return {
    format: WASH_RECORD_FORMAT,
    version: WASH_RECORD_VERSION,
    id: options.id,
    kind: 'planned',
    title: options.title ?? `Test tiles ${options.id}`,
    provenance: {
      methods: {
        scale: {
          description:
            'balance, 0.001 g; tile weighed dry before soiling, after drying and after the wash',
        },
        photo: {
          description: 'photograph under diffuse light, soiled pixels over the pixels of the patch',
        },
        eye: { description: 'visual inspection, 10 s per item, 1000 to 1500 lux' },
      },
    },
    machine: { id: options.machine ?? 'bosch_smv4hax40g' },
    programme: { id: options.programme ?? 'auto_145' },
    load: { items },
    observations,
    interruptions: (options.at_s ?? []).map((t) => ({ t_s: t })),
    sim: {
      tier: options.tier ?? 'fast',
      level_seed: options.levelSeed ?? 1,
      sim_seed: options.simSeed ?? 1,
    },
  };
}

/** Options of {@link synthesiseRecord}. */
export interface SynthesiseOptions {
  /** Seed of the observation noise (u32). */
  readonly seed: number;
  /** False to write the noise-free predictions (the mean of each observation model); default true. */
  readonly noise?: boolean;
  /** The pool to evaluate with; default a new one. */
  readonly pool?: EvaluatorPool;
  /** Id of the synthetic record; default `<id>-synthetic-s<seed>`. */
  readonly id?: string;
}

/**
 * A synthetic record: the observations of `plan` drawn from the simulator at `truth` (a set on
 * the calibration registry) with the noise of each observation model. A whole-number or
 * true/false observation is drawn as such; values keep the plan's stated uncertainties. With
 * `obs.outlierShare` above 0 in `truth`, a weighed, photographed or measured value is a gross
 * error with that probability, as the observation models say (set it to 0 for clean data).
 */
export async function synthesiseRecord(
  plan: WashRecord,
  truth: ParamSet,
  options: SynthesiseOptions,
): Promise<WashRecord> {
  const pool = options.pool ?? new EvaluatorPool();
  const prepared = await pool.get(plan, truth);
  const prediction = await prepared.evaluate(truth);
  const seed = options.seed >>> 0;
  const key = stringKey(plan.id);
  const observations: RecordObservation[] = plan.observations.map((observation, i) => {
    const spec = prepared.observations[i];
    if (spec === undefined) return observation;
    const eta = prediction.eta[i] as number;
    let counter = 0;
    const uniform = (): number => randomUniform(seed, key, i, counter++);
    const normal = (): number => randomNormal(seed, key, i, counter++);
    let value: number | boolean;
    if (options.noise === false) {
      value =
        observation.kind === 'clean'
          ? eta >= 0
          : observation.kind === 'score' || observation.kind === 'specks'
            ? Math.min(observation.kind === 'score' ? 5 : Infinity, Math.max(0, Math.round(eta)))
            : eta;
    } else {
      const state = prediction.states[i];
      value = sampleObservation(
        observation.kind,
        eta,
        spec.sd,
        prediction.constants,
        uniform,
        normal,
        state === undefined ? 0 : outlierSpan(observation.kind, state, prediction.constants),
      );
    }
    return { ...observation, value };
  });
  return {
    ...plan,
    id: options.id ?? `${plan.id}-synthetic-s${seed}`,
    kind: 'synthetic',
    provenance: {
      ...plan.provenance,
      notes: `Synthetic: drawn from the simulator at parameter overrides ${JSON.stringify(truth.overrides)} with noise seed ${seed}.`,
    },
    observations,
  };
}
