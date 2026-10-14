/**
 * What the water side gives every soil of a settled standard load: per soil and item type, the
 * distribution over the deposits of the wet share, the renewal and the exchange of the water
 * (the inverse of its age) and the supply factor the exchange gives, the film shear, the time a film outlasts the spray, and the jets.
 *
 *   pnpm --filter @spotless/calibration exec tsx anchors/scripts/diagnose.ts
 *        [--load iec-13-careful] [--tier official|fast] [--cache <dir>]
 *
 * The wash is run once for the keys of its exposure sets (read back from the cache), and the
 * scene is built again here as `wash()` builds it, so that every deposit can be looked up in the
 * tables of each spray state. Read-only: nothing is fitted or written.
 */

import { isAbsolute, join } from 'node:path';
import { instantiate } from '@spotless/catalogue';
import { buildMachineGeometry } from '@spotless/machine';
import {
  buildWashScene,
  canonicalPose,
  createWashParams,
  decodeExposureSet,
  initSoil,
  JET_FIELD,
  JET_FIELD_COUNT,
  sceneChamber,
  sceneMachineParts,
  sceneMaterialOf,
  soilTypeInfo,
  TIERS,
  washInputFromDescription,
  WATER_FIELD,
  WATER_FIELD_COUNT,
  type ExposureCache,
  type ExposureSet,
  type ItemSoilRecord,
} from '@spotless/sim-core';
import { createDiskExposureCache, washWithSource } from '@spotless/sim-core/node';
import { stdEu13Description } from '../src/scenario.ts';
import { anchorCacheDir, waterSide, waterTag } from '../src/water.ts';

const origin = process.env['INIT_CWD'] ?? process.cwd();
const fromOrigin = (path: string): string => (isAbsolute(path) ? path : join(origin, path));
const args = process.argv.slice(2).filter((a) => a !== '--');
const option = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};

const load = option('--load') ?? 'iec-13-careful';
/** Eco 50, the only programme the simulation washes on. */
const programme = 'eco_50';
const tier = option('--tier') === 'fast' ? 'fast' : 'official';
const disk = createDiskExposureCache(
  option('--cache') === undefined ? anchorCacheDir() : fromOrigin(option('--cache') as string),
);
console.log(
  `water side: ${waterSide().simVersion}, sources ${waterTag()} (${waterSide().files} files); exposure cache ${anchorCacheDir()}`,
);
const seen = new Map<string, Uint8Array>();
const cache: ExposureCache = {
  async get(key) {
    const bytes = await disk.get(key);
    if (bytes !== undefined) seen.set(key, bytes);
    return bytes;
  },
  async put(key, bytes) {
    seen.set(key, bytes);
    await disk.put(key, bytes);
  },
};

const description = stdEu13Description({ load, programme, tier });
const input = washInputFromDescription(description);
const result = await washWithSource(input, { cache, keepScene: false });
const sets = new Map<string, ExposureSet>();
for (const state of result.machine.states) {
  const bytes = seen.get(state.exposureKey);
  if (bytes !== undefined) sets.set(state.id, decodeExposureSet(bytes));
}

// The scene as wash() builds it: soil cells on every region of every item.
const params = createWashParams(input.params ?? {});
const config = input.config ?? input.machine.defaultConfig;
const geometry = buildMachineGeometry(input.machine, config);
const items = input.items.map((item) => ({
  itemId: item.itemId,
  typeId: item.typeId,
  shape: item.shape ?? instantiate(item.typeId).shape,
  pose: canonicalPose(item.pose),
  soils: item.soils,
}));
const scene = buildWashScene({
  items: items.map((item) => {
    const regions: string[] = [];
    for (const region of item.shape.regions)
      if (!regions.includes(region.id)) regions.push(region.id);
    return {
      itemId: item.itemId,
      typeId: item.typeId,
      shape: item.shape,
      pose: item.pose,
      soils: [
        {
          type: 'any',
          regions: regions.map((region) => ({ region, coverage: 1 })),
          amount_g: 0,
          age_h: 0,
          heat_history: 'none',
        } satisfies ItemSoilRecord,
      ],
    };
  }),
  machine: sceneMachineParts(geometry),
  blockSize: TIERS[input.tier].block_m,
  materials: sceneMaterialOf,
  params,
  chamber: sceneChamber(input.machine),
});
const state = initSoil(scene, items, soilTypeInfo, params, input.levelSeed);
const typeOf = new Map(items.map((item) => [item.itemId, item.typeId]));

const supplyHalf = params.get('soil.supplyExchange');
const levels = params.getVector('jets.shearLevels');
console.log(
  `# Exposure of the deposits: ${load}, ${programme}, tier ${tier}; ${state.count} deposits on ${scene.blocks.count} blocks; shear levels ${levels.join(', ')} Pa; soil.supplyExchange ${supplyHalf} 1/s`,
);
console.log('');
console.log(
  `States: ${result.machine.states.map((s) => `${s.id} ${s.duration_s.toFixed(0)} s, ${s.period_s.toFixed(2)} s per revolution`).join('; ')}`,
);
console.log('');

function quantiles(values: number[], weights: number[]): string {
  const order = values
    .map((_v, i) => i)
    .sort((a, b) => (values[a] as number) - (values[b] as number));
  let total = 0;
  for (const w of weights) total += w;
  const at = (q: number): number => {
    let run = 0;
    for (const i of order) {
      run += weights[i] as number;
      if (run >= q * total) return values[i] as number;
    }
    return values[order[order.length - 1] as number] ?? Number.NaN;
  };
  const fmt = (v: number): string =>
    !Number.isFinite(v)
      ? 'n/a'
      : Math.abs(v) >= 100
        ? v.toFixed(0)
        : Math.abs(v) >= 1
          ? v.toFixed(2)
          : v.toPrecision(2);
  return [0.05, 0.25, 0.5, 0.75, 0.95].map((q) => fmt(at(q))).join(' / ');
}

interface Group {
  key: string;
  deposits: number[];
}
const groups = new Map<string, Group>();
state.records.forEach((record) => {
  const key = `${record.soilType} on ${typeOf.get(record.itemId) ?? '?'}`;
  let group = groups.get(key);
  if (group === undefined) {
    group = { key, deposits: [] };
    groups.set(key, group);
  }
  for (let d = record.firstDeposit; d < record.firstDeposit + record.depositCount; d++) {
    group.deposits.push(d);
  }
});

const mainStates = result.machine.states.filter((s) => s.id.endsWith('@3000')).map((s) => s.id);
const jetOf = new Map<string, Int32Array>();
for (const [id, set] of sets) {
  const rows = new Int32Array(scene.soilCells.count).fill(-1);
  for (let i = 0; i < set.jets.cell.length; i++) rows[set.jets.cell[i] as number] = i;
  jetOf.set(id, rows);
}

for (const group of [...groups.values()].sort((a, b) => (a.key < b.key ? -1 : 1))) {
  const weights = group.deposits.map((d) => state.area[d] as number);
  let area = 0;
  for (const w of weights) area += w;
  let mass = 0;
  for (const d of group.deposits) mass += (state.mass0[d] as number) * (state.area[d] as number);
  console.log(
    `## ${group.key}: ${group.deposits.length} deposits, ${(area * 1e4).toFixed(1)} cm2, ${(mass * 1e6).toFixed(1)} mg dry (${((mass / area) * 100).toFixed(2)} mg/cm2 mean)`,
  );
  console.log('');
  console.log('| Quantity | State | 5 % / 25 % / median / 75 % / 95 % (by area) | zero share |');
  console.log('|---|---|---|---|');
  const neverWet = new Uint8Array(group.deposits.length).fill(1);
  const neverJet = new Uint8Array(group.deposits.length).fill(1);
  const effective = group.deposits.map(() => 0);
  for (const id of mainStates) {
    const set = sets.get(id);
    if (set === undefined) continue;
    const w = set.water.values;
    const rows = jetOf.get(id) as Int32Array;
    const column = (field: number): number[] =>
      group.deposits.map(
        (d) => w[WATER_FIELD_COUNT * (state.block[d] as number) + field] as number,
      );
    const wet = group.deposits.map((d) => {
      const o = WATER_FIELD_COUNT * (state.block[d] as number);
      return Math.max(
        w[o + WATER_FIELD.wetTime] as number,
        w[o + WATER_FIELD.wetFraction] as number,
      );
    });
    const renewal = column(WATER_FIELD.renewal);
    const exchange = column(WATER_FIELD.exchange);
    const supply = exchange.map((x, i) =>
      (wet[i] as number) > 0 && x > 0 ? x / (x + supplyHalf) : 0,
    );
    const share = (below: number): string => {
      let a = 0;
      exchange.forEach((x, i) => {
        if ((wet[i] as number) > 0 && x < below) a += weights[i] as number;
      });
      return `${((100 * a) / area).toFixed(1)} %`;
    };
    const jetWet = group.deposits.map((d) => {
      const row = rows[state.cell[d] as number] as number;
      return row >= 0 ? (set.jets.values[JET_FIELD_COUNT * row + JET_FIELD.wetDuty] as number) : 0;
    });
    const jetDuty = group.deposits.map((d) => {
      const row = rows[state.cell[d] as number] as number;
      return row >= 0 ? (set.jets.values[JET_FIELD_COUNT * row + JET_FIELD.duty] as number) : 0;
    });
    const jetPeak = group.deposits.map((d) => {
      const row = rows[state.cell[d] as number] as number;
      return row >= 0
        ? (set.jets.values[JET_FIELD_COUNT * row + JET_FIELD.shearPeak] as number)
        : 0;
    });
    const zero = (values: number[]): string => {
      let z = 0;
      values.forEach((v, i) => {
        if (!(v > 0)) z += weights[i] as number;
      });
      return `${((100 * z) / area).toFixed(1)} %`;
    };
    wet.forEach((v, i) => {
      if (v > 0 || (jetWet[i] as number) > 0) neverWet[i] = 0;
      if ((jetDuty[i] as number) > 0) neverJet[i] = 0;
      effective[i] =
        (effective[i] as number) +
        (Math.max(v, jetWet[i] as number) * (supply[i] as number)) / mainStates.length;
    });
    console.log(`| wet share | ${id} | ${quantiles(wet, weights)} | ${zero(wet)} |`);
    console.log(`| renewal (1/s) | ${id} | ${quantiles(renewal, weights)} | ${zero(renewal)} |`);
    console.log(`| exchange (1/s) | ${id} | ${quantiles(exchange, weights)} | ${zero(exchange)} |`);
    console.log(
      `| wet area with exchange below 1, 0.3, 0.1, 0.03 1/s | ${id} | ${share(1)} / ${share(0.3)} / ${share(0.1)} / ${share(0.03)} | |`,
    );
    console.log(`| supply factor | ${id} | ${quantiles(supply, weights)} | ${zero(supply)} |`);
    console.log(
      `| film shear (Pa) | ${id} | ${quantiles(column(WATER_FIELD.shear), weights)} | ${zero(column(WATER_FIELD.shear))} |`,
    );
    console.log(
      `| film thickness (um) | ${id} | ${quantiles(
        column(WATER_FIELD.thickness).map((v) => v * 1e6),
        weights,
      )} | |`,
    );
    console.log(
      `| hold time (s) | ${id} | ${quantiles(column(WATER_FIELD.holdTime), weights)} | ${zero(column(WATER_FIELD.holdTime))} |`,
    );
    console.log(`| time in a jet film | ${id} | ${quantiles(jetWet, weights)} | ${zero(jetWet)} |`);
    console.log(
      `| time above ${levels[0]} Pa | ${id} | ${quantiles(jetDuty, weights)} | ${zero(jetDuty)} |`,
    );
    console.log(
      `| peak jet shear (Pa) | ${id} | ${quantiles(jetPeak, weights)} | ${zero(jetPeak)} |`,
    );
  }
  let never = 0;
  let noJet = 0;
  neverWet.forEach((v, i) => {
    if (v === 1) never += weights[i] as number;
    if (neverJet[i] === 1) noJet += weights[i] as number;
  });
  console.log(
    `| wet share x supply, mean of the main-wash states (no residual film) | all | ${quantiles(effective, weights)} | |`,
  );
  console.log('');
  console.log(
    `Never wet in the main wash: ${((100 * never) / area).toFixed(1)} % of the area; no jet above ${levels[0]} Pa in either state: ${((100 * noJet) / area).toFixed(1)} %.`,
  );
  console.log('');
}
process.exit(0);
