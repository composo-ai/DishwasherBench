/**
 * Study: which test wash to run first (docs/calibration/fitting.md section 9.3).
 *
 *   pnpm --filter @spotless/calibration study:rank [known] [unknown] [--draws n] [--seed n]
 *
 * Candidate washes of test tiles are ranked by the information they are expected to add about
 * the first calibration targets: the enzyme's life and dose, the enzyme response of the protein
 * soil, its rate, and the temperature Auto chooses for the main wash (which a record without a
 * measured course does not know, and which is counted as a nuisance in the second table).
 *
 * The gain of a wash depends on the parameters it is meant to find, so it is averaged over
 * parameter sets drawn from their priors (8 by default, and the registry defaults); the table
 * of the defaults alone is printed after it for comparison, marked as local. `known` and
 * `unknown` pick one of the two tables.
 */

import { rankExperiments, sensitivity, tileRecord, type WashRecord } from '../src/index.ts';
import { diskExposureCache } from '../src/node/index.ts';
import { STUDY_CACHE, TEN_PLACES, tenTiles } from './study-loads.ts';

const cache = diskExposureCache(STUDY_CACHE);
const args = process.argv.slice(2);
const numberOf = (name: string, fallback: number): number => {
  const at = args.indexOf(name);
  return at >= 0 ? Number(args[at + 1]) : fallback;
};
const draws = numberOf('--draws', 8);
const seed = numberOf('--seed', 1);
const both = !args.includes('known') && !args.includes('unknown');
/** 30 mm discs: the same washes as 50 mm ones at under half the cost of a replay. */
const DISC = { disc_mm: 30, amount_g: 0.076 };
const MIXED = ['egg_yolk_dried', 'porridge', 'tea_tannin', 'tomato_sauce', 'butter_margarine'];
const titled = (record: WashRecord, title: string): WashRecord => ({ ...record, title });

/**
 * Ten tiles of which each is taken out once, dried and weighed: three at 25 min, three at
 * 40 min, two at 60 min and two at the end (a tile that has been taken out is not observed
 * again; a wet tile cannot be weighed for its dry soil and put back).
 */
function staggered(id: string, soils?: string[]): WashRecord {
  const times = [1500, 2400, 3600];
  const base = tenTiles({
    id,
    ...DISC,
    ...(soils === undefined ? {} : { soils }),
    kinds: ['mass_fraction'],
    at_s: times,
  });
  const when = (item: string): number | undefined => {
    const n = Number(item.slice(-2)) - 1;
    // Spread the times over the places: 0 3 6 at 25 min, 1 4 7 at 40 min, 2 5 at 60 min, 8 9 at the end.
    return n >= 8 ? undefined : times[n % 3];
  };
  return { ...base, observations: base.observations.filter((o) => o.at_s === when(o.item)) };
}

const candidates: WashRecord[] = [
  titled(
    tenTiles({ id: 'egg-end', ...DISC, kinds: ['area_fraction', 'mass_fraction'] }),
    'ten egg-yolk tiles, weighed and photographed at the end',
  ),
  titled(
    tenTiles({ id: 'egg-eye', ...DISC, kinds: ['score'] }),
    'ten egg-yolk tiles, scored by eye at the end',
  ),
  titled(
    tenTiles({
      id: 'egg-3-openings',
      ...DISC,
      kinds: ['area_fraction', 'mass_fraction'],
      at_s: [1500, 2400, 3600],
      interruptedKinds: ['area_fraction'],
    }),
    'ten egg-yolk tiles, photographed at 25, 40 and 60 min, weighed at the end',
  ),
  titled(
    tenTiles({
      id: 'egg-6-openings',
      ...DISC,
      kinds: ['area_fraction', 'mass_fraction'],
      at_s: [1200, 1800, 2400, 3000, 3600, 4200],
      interruptedKinds: ['area_fraction'],
    }),
    'ten egg-yolk tiles, photographed every 10 min from 20 to 70 min, weighed at the end',
  ),
  titled(
    tenTiles({ id: 'mixed-end', ...DISC, soils: MIXED, kinds: ['area_fraction', 'mass_fraction'] }),
    'ten tiles of five soils, weighed and photographed at the end',
  ),
  titled(
    tenTiles({
      id: 'mixed-3-openings',
      ...DISC,
      soils: MIXED,
      kinds: ['area_fraction', 'mass_fraction'],
      at_s: [1500, 2400, 3600],
      interruptedKinds: ['area_fraction'],
    }),
    'ten tiles of five soils, photographed at 25, 40 and 60 min, weighed at the end',
  ),
  titled(
    {
      ...tenTiles({ id: 'egg-end-half-dose', ...DISC, kinds: ['area_fraction', 'mass_fraction'] }),
      consumables: { detergent: { product: 'half a tablet', form: 'tablet', dose_g: 10 } },
    },
    'ten egg-yolk tiles with half the detergent (10 g), weighed and photographed at the end',
  ),
  titled(
    {
      ...tenTiles({
        id: 'egg-end-double-dose',
        ...DISC,
        kinds: ['area_fraction', 'mass_fraction'],
      }),
      consumables: { detergent: { product: 'two tablets', form: 'tablet', dose_g: 40 } },
    },
    'ten egg-yolk tiles with twice the detergent (40 g), weighed and photographed at the end',
  ),
  titled(
    staggered('egg-staggered'),
    'ten egg-yolk tiles, taken out and weighed dry: 3 at 25 min, 3 at 40 min, 2 at 60 min, 2 at the end',
  ),
  titled(
    staggered('mixed-staggered', MIXED),
    'ten tiles of five soils, taken out and weighed dry: 3 at 25 min, 3 at 40 min, 2 at 60 min, 2 at the end',
  ),
  titled(
    tileRecord({
      id: 'one-tile-3-openings',
      tiles: [
        {
          id: 'tile_01',
          rack: TEN_PLACES[0]![3],
          x_mm: TEN_PLACES[0]![0],
          y_mm: TEN_PLACES[0]![1],
          facing: TEN_PLACES[0]![2],
          soil: 'egg_yolk_dried',
          amount_g: DISC.amount_g,
          disc_mm: DISC.disc_mm,
        },
      ],
      kinds: ['area_fraction', 'mass_fraction'],
      at_s: [1500, 2400, 3600],
      interruptedKinds: ['area_fraction'],
    }),
    'one egg-yolk tile, photographed at 25, 40 and 60 min, weighed at the end',
  ),
];

const targets = [
  'liq.proteaseHalfLife',
  'liq.xProtease',
  'soil.hillN',
  'soil.KE',
  'soil.egg_yolk.rateRef',
];
const progress = (message: string): void => console.error(`  ${message}`);
const options = { evaluator: { cache }, draws, seed, onProgress: progress };

for (const candidate of candidates) console.log(`  ${candidate.id}: ${candidate.title}`);
console.log(`targets: ${targets.join(', ')}\n`);

if (both || args.includes('known')) {
  console.log(
    '===== candidates ranked for the five first calibration targets, the course of the run known =====',
  );
  const known = await rankExperiments(candidates, targets, options);
  console.log(known.table);
  console.log('\ngain of each candidate at each parameter set (bits):');
  console.log(`  parameter sets (${targets.join(', ')}):`);
  known.points.forEach((point, k) =>
    console.log(`    ${k}: ${point.map((v) => v.toPrecision(3)).join('  ')}`),
  );
  for (const r of known.ranking) {
    console.log(
      `  ${r.recordId}: ${(known.gains_bits[r.recordId] ?? []).map((g) => g.toFixed(2)).join('  ')}`,
    );
  }
  console.log('\n===== the same at the registry defaults alone (what a local ranking says) =====');
  const local = await rankExperiments(candidates, targets, { ...options, draws: 0 });
  console.log(local.table);

  const best = known.ranking[0];
  if (best !== undefined) {
    const record = candidates.find((c) => c.id === best.recordId) as WashRecord;
    console.log(
      `\n===== what the best candidate (${best.recordId}) can and cannot identify, at the defaults =====`,
    );
    const detail = await sensitivity([record], targets, { evaluator: { cache } });
    console.log(detail.report.table);
  }
}

if (both || args.includes('unknown')) {
  console.log(
    '\n===== the same with the main-wash temperature of the run unknown (no measured course) =====',
  );
  const unknown = await rankExperiments(candidates, [...targets, 'prog.mainWashTargetShift'], {
    ...options,
    interest: targets,
  });
  console.log(unknown.table);
}
