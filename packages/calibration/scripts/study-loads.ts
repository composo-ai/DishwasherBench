/**
 * The loads the studies run on (not part of the package's interface).
 *
 *  - {@link tenTiles}: ten test tiles at ten places in both baskets;
 *  - {@link fullLoadRecord}: the 114-item lattice of `packages/sim-scene/src/testing/full-load.ts`
 *    (about 13 place settings set on a regular lattice WITHOUT the loading physics: it describes
 *    a realistically crowded machine, not a valid placement) with every item carrying the
 *    catalogue's typical soils on half of each typical region. The physically settled standard
 *    loads of `packages/loader` did not exist when these studies were written; when they do,
 *    `recordFromManifest` turns one into a record and the studies run on it unchanged.
 */

import { join } from 'node:path';
import { getSoil, instantiate } from '@spotless/catalogue';
import { fullLoad } from '../../sim-scene/src/testing/full-load.ts';
import {
  tileRecord,
  WASH_RECORD_FORMAT,
  WASH_RECORD_VERSION,
  type ObservationKind,
  type RecordItem,
  type RecordObservation,
  type RecordSoil,
  type TileSpec,
  type WashRecord,
} from '../src/index.ts';

/**
 * Where the studies keep exposure between runs: under the repository's `.spotless`, or the
 * directory named by SPOTLESS_STUDY_CACHE. The keys of the exposure cache do not change with
 * the exposure code: use a fresh directory after the exposure stages have changed.
 */
export const STUDY_CACHE =
  process.env['SPOTLESS_STUDY_CACHE'] ??
  join(import.meta.dirname, '..', '..', '..', '.spotless', 'calibration-cache');

/** Ten places for a test tile: seven in the lower basket, three in the upper. */
export const TEN_PLACES: readonly [number, number, TileSpec['facing'], TileSpec['rack']][] = [
  [80, 100, '+x', 'lower_rack'],
  [180, 100, '-x', 'lower_rack'],
  [300, 100, '+x', 'lower_rack'],
  [440, 100, '-x', 'lower_rack'],
  [80, 380, '+y', 'lower_rack'],
  [260, 380, '-y', 'lower_rack'],
  [440, 380, '+y', 'lower_rack'],
  [120, 150, 'down', 'upper_rack'],
  [260, 330, 'down', 'upper_rack'],
  [400, 150, '+x', 'upper_rack'],
];

/** A planned record of ten tiles of one soil, the same plan for each. */
export function tenTiles(options: {
  id: string;
  soil?: string;
  amount_g?: number;
  disc_mm?: number;
  kinds?: ObservationKind[];
  at_s?: number[];
  interruptedKinds?: ObservationKind[];
  heat?: RecordSoil['heat'];
  count?: number;
  soils?: readonly string[];
  sd?: Partial<Record<ObservationKind, number>>;
}): WashRecord {
  const tiles: TileSpec[] = TEN_PLACES.slice(0, options.count ?? 10).map(
    ([x, y, facing, rack], i) => ({
      id: `tile_${String(i + 1).padStart(2, '0')}`,
      rack,
      x_mm: x,
      y_mm: y,
      facing,
      soil: options.soils?.[i % options.soils.length] ?? options.soil ?? 'egg_yolk_dried',
      amount_g: options.amount_g ?? 0.21,
      disc_mm: options.disc_mm ?? 50,
      ...(options.heat === undefined ? {} : { heat: options.heat }),
    }),
  );
  return tileRecord({
    id: options.id,
    tiles,
    kinds: options.kinds ?? ['area_fraction', 'mass_fraction'],
    at_s: options.at_s ?? [],
    ...(options.interruptedKinds === undefined
      ? {}
      : { interruptedKinds: options.interruptedKinds }),
    ...(options.sd === undefined ? {} : { sd: options.sd }),
  });
}

/**
 * The 114-item lattice as a planned record. `observe` picks the items that are observed (all
 * by default) and `kinds` what is observed on each.
 */
export function fullLoadRecord(options: {
  id: string;
  kinds?: ObservationKind[];
  observe?: (itemId: string, index: number) => boolean;
  tier?: 'fast' | 'official';
  /**
   * `all` (default): every item carries every one of its typical soils on half of each typical
   * region, as the simulator's own full-load benchmark has it (a very dirty load). `one`: every
   * item carries one of its typical soils (they take turns down the load) on 30 % of its
   * region, which is nearer to what a meal leaves.
   */
  soiling?: 'all' | 'one';
}): WashRecord {
  const lattice = fullLoad();
  const kinds = options.kinds ?? ['clean'];
  const coverage = options.soiling === 'one' ? 0.3 : 0.5;
  const items: RecordItem[] = [];
  const observations: RecordObservation[] = [];
  lattice.input.items.forEach((item, index) => {
    const instance = instantiate(item.typeId);
    const bySoil = new Map<string, string[]>();
    for (const typical of instance.type.typicalSoils) {
      const regions = bySoil.get(typical.soil) ?? [];
      if (!regions.includes(typical.region)) regions.push(typical.region);
      bySoil.set(typical.soil, regions);
    }
    const typical = [...bySoil.entries()];
    const chosen =
      options.soiling === 'one'
        ? typical.slice(index % typical.length, (index % typical.length) + 1)
        : typical;
    const soils: RecordSoil[] = chosen.map(([soilId, regions], k) => {
      const area = regions.reduce((sum, region) => sum + (instance.regionAreas[region] ?? 0), 0);
      const soil = getSoil(soilId);
      return {
        id: `soil_${k + 1}`,
        type: soilId,
        amount_g: Math.max(soil.loading.typicalGPerM2 * area * coverage, 1e-4),
        where: { regions: regions.map((region) => ({ region, coverage })) },
        drying: { time_h: 2 },
        heat: { history: soil.heatHistories[0] ?? 'none' },
      };
    });
    items.push({
      id: item.itemId,
      type: item.typeId,
      frame: 'tub',
      position_mm: [item.pose.p[0] * 1000, item.pose.p[1] * 1000, item.pose.p[2] * 1000],
      quat_wxyz: [item.pose.q[3], item.pose.q[0], item.pose.q[1], item.pose.q[2]],
      soils,
    });
    if (options.observe === undefined || options.observe(item.itemId, index)) {
      for (const kind of kinds) {
        observations.push({
          item: item.itemId,
          kind,
          method: kind === 'area_fraction' ? 'photo' : kind === 'mass_fraction' ? 'scale' : 'eye',
          ...(kind === 'area_fraction'
            ? { sd: 0.05 }
            : kind === 'mass_fraction'
              ? { sd: 0.03 }
              : {}),
        });
      }
    }
  });
  return {
    format: WASH_RECORD_FORMAT,
    version: WASH_RECORD_VERSION,
    id: options.id,
    kind: 'planned',
    title:
      options.soiling === 'one'
        ? 'The 114-item lattice with one typical soil on every item'
        : 'The 114-item lattice with every typical soil of every item',
    provenance: {
      methods: {
        eye: { description: 'visual inspection, 10 s per item' },
        photo: { description: 'photograph before and after' },
        scale: { description: 'balance, 0.01 g' },
      },
      notes:
        'Items stand on a regular lattice without the loading physics (packages/sim-scene/src/testing/full-load.ts): good for cost and sensitivity, not a valid placement.',
    },
    machine: { id: 'bosch_smv4hax40g' },
    programme: { id: 'eco_50' },
    load: { items },
    observations,
    sim: { tier: options.tier ?? 'fast', level_seed: 1, sim_seed: 1 },
  };
}

/** Best of `n` timings of `run`, milliseconds, with the last result. */
export async function bestOf<T>(
  n: number,
  run: (i: number) => Promise<T>,
): Promise<{ ms: number; all: number[]; value: T }> {
  const all: number[] = [];
  let value: T | undefined;
  for (let i = 0; i < n; i++) {
    const start = performance.now();
    value = await run(i);
    all.push(performance.now() - start);
  }
  return { ms: Math.min(...all), all, value: value as T };
}
