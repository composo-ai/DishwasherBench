/**
 * Washes named cases of a settled standard load and writes one row per case: class means,
 * what is left of every soil, and the course of the main wash. The tool behind the tables of
 * the anchoring note (docs/calibration/anchoring.md).
 *
 *   cd packages/calibration
 *   pnpm exec tsx anchors/scripts/study.ts <cases.json> <out.json> [cacheDir]
 *
 * cases.json: [{ name, load?, programme?, tier?, levelSeed?, simSeed?, set?, extra?,
 *                dose_g?, milk?, liquorOut? }]
 *   load       a load of `anchors/loads` (default `iec-13-careful`)
 *   programme  `eco_50` (the default), or `eco_record` for Eco 50 on the course of the
 *              literature record (main wash 54 C, final rinse 48 C, as measured on the round
 *              robin's machine)
 *   set        a parameter-set file of `anchors/` or `detergents/` by name, or a list of them
 *              laid over one another in order; `defaults` or absent: the registry defaults
 *   extra      overrides laid on top
 *   dose_g     mass of detergent (a machine value; default 20 g)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  composeParamLayers,
  washInputFromDescription,
  washRegistry,
  type ComposedParams,
  type ParamValue,
} from '@spotless/sim-core';
import {
  createDiskExposureCache,
  readParamLayerFile,
  washWithSource,
} from '@spotless/sim-core/node';
import { programmeOfRecord, type WashRecord } from '../../src/index.ts';
import { STANDARD_COMPOSITION } from '../src/literature.ts';
import { classMeans } from '../src/objective.ts';
import { ANCHORS_DIR, stdEu13Description, type MilkCase } from '../src/scenario.ts';
import { summariseWash } from '../src/summary.ts';
import { anchorCacheDir } from '../src/water.ts';

interface Case {
  readonly name: string;
  readonly load?: string;
  readonly programme?: string;
  readonly tier?: 'official' | 'fast';
  readonly levelSeed?: number;
  readonly simSeed?: number;
  readonly set?: string | readonly string[];
  readonly extra?: Record<string, ParamValue>;
  readonly dose_g?: number;
  readonly milk?: MilkCase;
  /** A file to write the liquor table of the wash to (for `auto-soils.ts`). */
  readonly liquorOut?: string;
}

const [casesFile, outFile, cacheArg] = process.argv.slice(2).filter((a) => a !== '--');
if (casesFile === undefined || outFile === undefined) {
  throw new RangeError('usage: study.ts <cases.json> <out.json> [cacheDir]');
}
const cases = JSON.parse(readFileSync(casesFile, 'utf8')) as Case[];
const cache = createDiskExposureCache(cacheArg ?? anchorCacheDir());

function fileOfSet(name: string): string {
  if (name.includes('/')) return name;
  return name.startsWith('finish')
    ? join(ANCHORS_DIR, '..', 'detergents', `${name}.json`)
    : join(ANCHORS_DIR, `${name}.json`);
}

/**
 * The named sets of a case laid over one another as every wash reads them (a set that is
 * stale is read all the same and recorded as stale in the result and in the row), with the
 * `extra` overrides on top.
 */
function setsOf(c: Case): {
  params: Record<string, ParamValue>;
  records: ComposedParams['records'];
} {
  const names = c.set === undefined ? [] : typeof c.set === 'string' ? [c.set] : c.set;
  const composed = composeParamLayers(
    washRegistry(),
    names
      .filter((name) => name !== 'defaults')
      .map((name) => readParamLayerFile(fileOfSet(name), { acceptStale: true })),
  );
  return { params: { ...composed.params, ...(c.extra ?? {}) }, records: composed.records };
}

const literature = JSON.parse(
  readFileSync(
    join(ANCHORS_DIR, 'records', 'std-eu-13.round-robin-ta.detergent-d.literature.json'),
    'utf8',
  ),
) as WashRecord;

const rows: unknown[] = [];
for (const c of cases) {
  const { params, records } = setsOf(c);
  const description = stdEu13Description({
    load: c.load ?? 'iec-13-careful',
    programme: c.programme === 'eco_record' ? 'eco_50' : (c.programme ?? 'eco_50'),
    tier: c.tier ?? 'official',
    params,
    workingSoils: true,
    ...(c.milk === undefined ? {} : { milk: c.milk }),
    ...(c.levelSeed === undefined ? {} : { levelSeed: c.levelSeed }),
    ...(c.simSeed === undefined ? {} : { simSeed: c.simSeed }),
  });
  let input = washInputFromDescription(description);
  if (c.programme === 'eco_record') {
    input = {
      ...input,
      programme: programmeOfRecord(
        literature,
        input.machine,
        input.config ?? input.machine.defaultConfig,
      ).programme,
    };
  }
  const dose = c.dose_g ?? 20;
  // The dose is the detergent of the wash (it does not enter the key of the exposure).
  if (dose !== 20)
    input = { ...input, detergent: { name: 'as the set describes', dose: dose / 1000 } };
  if (records.length > 0) input = { ...input, paramSets: records };
  const t0 = performance.now();
  const result = await washWithSource(input, { cache });
  const s = summariseWash(result);
  const m = classMeans(result.items, STANDARD_COMPOSITION);
  const { fields, tickTime_s, values } = result.machine.liquor;
  const n = fields.length;
  const col = (name: string): number => fields.indexOf(name);
  let first = -1;
  let last = -1;
  let peak = 0;
  let proteasePeak = 0;
  let peracidPeak = 0;
  const above: Record<number, number> = { 45: 0, 55: 0, 60: 0 };
  for (let t = 0; t < tickTime_s.length; t++) {
    const v = (name: string): number => values[n * t + col(name)] as number;
    if (!(v('detergent') > 0.5 && v('volume') > 0.003 && v('rinseAid') === 0)) continue;
    const dt =
      t + 1 < tickTime_s.length ? (tickTime_s[t + 1] as number) - (tickTime_s[t] as number) : 0;
    if (first < 0) first = t;
    last = t;
    const temperature = v('temperature');
    peak = Math.max(peak, temperature);
    for (const k of Object.keys(above)) {
      if (temperature >= Number(k)) above[Number(k)] = (above[Number(k)] ?? 0) + dt / 60;
    }
    proteasePeak = Math.max(proteasePeak, v('protease'));
    peracidPeak = Math.max(peracidPeak, v('peracid'));
  }
  const at = (t: number, name: string): number => values[n * t + col(name)] as number;
  const endTick = Math.max(first, last - 180);
  const row = {
    name: c.name,
    load: c.load ?? 'iec-13-careful',
    programme: c.programme ?? 'eco_50',
    tier: c.tier ?? 'official',
    seeds: [description.levelSeed, description.simSeed],
    dose_g: dose,
    sets: records.map((r) => `${r.name}${r.stale ? ' (stale)' : ''}`),
    source: result.provenance.sourceFingerprint,
    // Soiled items whose verdict differs between the two ends of the band of visibility.
    edge: result.items.filter(
      (item) => item.initialMass_mg > 0 && item.band !== undefined && !item.band.decided,
    ).length,
    edgeItems: result.items
      .filter((item) => item.band !== undefined && !item.band.decided)
      .map((item) => item.itemId),
    soiledCleanStrict: result.items.filter(
      (item) => item.initialMass_mg > 0 && (item.band?.strictClean ?? item.clean),
    ).length,
    soiledCleanLenient: result.items.filter(
      (item) => item.initialMass_mg > 0 && (item.band?.lenientClean ?? item.clean),
    ).length,
    duration_min: result.machine.duration_s / 60,
    energy_kWh: result.machine.energy_kWh,
    mainWash: {
      minutes: ((tickTime_s[last] as number) - (tickTime_s[first] as number)) / 60,
      peak_C: peak,
      end_C: at(endTick, 'temperature'),
      pH_peak: at(Math.min(last, first + 600), 'pH'),
      pH_end: at(endTick, 'pH'),
      minAbove: above,
      proteasePeak_mgL: proteasePeak * 1000,
      proteaseEnd_mgL: at(endTick, 'protease') * 1000,
      peracidPeak_mmolL: peracidPeak,
    },
    items: s.items,
    score: m.score,
    soiled: m.soiled,
    raw: m.raw,
    milkGlasses: m.milkGlasses,
    teaItems: m.teaItems,
    crockeryWithoutTea: m.crockeryWithoutTea,
    cleanShare: m.cleanShare,
    clean: s.all.clean,
    soiledItems: s.soiledOnly.items,
    soiledClean: s.soiledOnly.clean,
    histogram: s.soiledOnly.histogram,
    bySoil: s.bySoil.map((b) => ({
      type: b.type,
      modelClass: b.modelClass,
      records: b.records,
      left_pct: (100 * b.residual_mg) / b.initial_mg,
      meanScore: b.meanScore,
      clean: b.clean,
      medianVisibleMm2: b.medianVisibleMm2,
    })),
    byType: Object.fromEntries(
      Object.entries(s.byType).map(([type, g]) => [type, [g.items, g.meanScore, g.clean]]),
    ),
    // Every soiled item: score, clean (1 or 0), share of its soil left.
    perItem: Object.fromEntries(
      result.items
        .filter((item) => item.initialMass_mg > 0)
        .map((item) => [
          item.itemId,
          [
            item.score,
            item.clean ? 1 : 0,
            Number((item.residualMass_mg / item.initialMass_mg).toFixed(4)),
          ],
        ]),
    ),
    timings_ms: result.run.timings_ms,
    blocks: result.run.blocks,
    drySoilLeft_pct: (100 * s.soil.remaining_mg) / s.soil.initial_mg,
    heldWater_mL: s.heldWater_mL,
    exposure: [result.run.exposureCacheHits, result.run.exposureComputed],
    seconds: (performance.now() - t0) / 1000,
  };
  rows.push(row);
  if (c.liquorOut !== undefined) {
    writeFileSync(
      c.liquorOut,
      JSON.stringify({ fields, tickTime_s: Array.from(tickTime_s), values: Array.from(values) }),
    );
  }
  const soils = row.bySoil
    .map(
      (b) =>
        `${b.type.replace('iec_', '')} ${b.left_pct.toFixed(1)}%/${b.meanScore.toFixed(1)}/${b.clean}of${b.records}`,
    )
    .join(' ');
  console.log(
    `${c.name} | all ${m.score.all.toFixed(2)} cro ${m.score.crockery.toFixed(2)} (plates ${m.crockeryWithoutTea.toFixed(2)} tea ${m.teaItems.toFixed(2)}) cut ${m.score.cutlery.toFixed(2)} gla ${m.score.glass.toFixed(2)} (milk ${m.milkGlasses.toFixed(2)}) mel ${m.score.melamine.toFixed(2)} | clean ${s.all.clean}/${s.items} soiled ${s.soiledOnly.clean}/${s.soiledOnly.items} | ${soils} | wash ${row.mainWash.minutes.toFixed(0)} min peak ${peak.toFixed(1)} C, protease ${row.mainWash.proteasePeak_mgL.toFixed(0)}->${row.mainWash.proteaseEnd_mgL.toFixed(0)} mg/L, pH ${row.mainWash.pH_end.toFixed(2)} | exposure ${row.exposure.join('/')} | ${row.seconds.toFixed(0)} s`,
  );
  writeFileSync(outFile, `${JSON.stringify(rows, null, 1)}\n`);
}
