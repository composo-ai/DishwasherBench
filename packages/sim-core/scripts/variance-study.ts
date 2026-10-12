/**
 * variance-study: how far a verdict of the wash simulation is sampling noise.
 *
 * Washes the settled careful standard load of the anchoring (STD-EU-13 with its working soils,
 * `packages/calibration/anchors/src/scenario.ts`) at every combination of some level seeds (the
 * draw of the soil) and simulation seeds (the sampling of the exposure) and at one or both
 * tiers, optionally with two items turned half a turn about the vertical (the untouched-item
 * test) or an arm held still, and appends one JSON line per wash to a file: every item's
 * verdict, score, residue and, with `--summary`, the exposure of its soiled regions per spray
 * state. `variance-tables.py` beside this file turns the lines into the tables: verdicts that
 * flip between simulation seeds, agreement of the tiers, what an untouched item loses or
 * gains when something else is turned, and the cost by stage.
 *
 *   pnpm --filter @spotless/sim-core exec tsx scripts/variance-study.ts --out <file.jsonl>
 *        [--cache <dir>] [--tiers official,fast] [--level-seeds 1,2,3,4] [--sim-seeds 1,2,3,4]
 *        [--programme eco_50] [--params <set.json>] [--accept-stale-params] [--dose-g <grams>]
 *        [--set key=value,...] [--load <name>]
 *        [--flip-z id,id] [--stall lower=62] [--summary] [--tag name] [--repo <root>]
 *
 * `--params` is a parameter-set file, read as every wash reads one (`composeParamFiles`): a
 * stale file stops the study with what to do unless `--accept-stale-params` is given, and the
 * sets, their staleness and the fingerprint of the source are written into every line (with a
 * `--repo` that has no such reader, a frozen copy of an earlier build, the overrides are used
 * as they are). Default the registry defaults. `--dose-g` doses that many grams of the
 * detergent the set describes in place of the machine's own dose. `--repo` runs the
 * simulation of another copy of the repository (a frozen copy to compare with). Not more
 * than two of these at once on one machine.
 */

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2).filter((a) => a !== '--');
const option = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const here = dirname(fileURLToPath(import.meta.url));
const repo = option('--repo') ?? join(here, '..', '..', '..');

/** One item of a wash result, as far as the study reads it. */
interface StudyItem {
  readonly itemId: string;
  readonly typeId: string;
  readonly clean: boolean;
  readonly score: number;
  readonly initialMass_mg: number;
  readonly residualMass_mg: number;
  readonly visibleAreaMm2: number;
  readonly specks: number;
  readonly water: { readonly film_g: number };
  readonly band?: { readonly decided: boolean };
  readonly regions: readonly { readonly regionId: string }[];
  readonly exposure?: {
    readonly regions: readonly {
      readonly regionId: string;
      readonly areaMm2: number;
      readonly neverWetArea: number;
      readonly states: readonly Readonly<Record<string, number>>[];
    }[];
  };
}

/** A wash result, as far as the study reads it. */
interface StudyResult {
  readonly items: readonly StudyItem[];
  readonly problems: readonly string[];
  readonly provenance: {
    readonly resultHash: string;
    readonly hydroHash: string;
    readonly sourceFingerprint?: string;
  };
  readonly run: {
    readonly timings_ms: Readonly<Record<string, number>>;
    readonly exposureComputed: number;
    readonly blocks: number;
  };
  readonly machine: {
    readonly states: readonly {
      readonly id: string;
      readonly duration_s: number;
      readonly flow_L_min: number;
      readonly exposure: Readonly<Record<string, unknown>>;
    }[];
  };
}

// The simulation and the scenario are loaded from `repo` at run time, so that the same script
// measures this copy of the repository and a frozen one.
const core = (await import(join(repo, 'packages/sim-core/src/index.ts'))) as {
  wash(input: unknown, options: unknown): Promise<StudyResult>;
  washInputFromDescription(description: unknown): unknown;
};
const node = (await import(join(repo, 'packages/sim-core/src/node/index.ts'))) as {
  createDiskExposureCache(directory: string): unknown;
  washWithSource?(input: unknown, options: unknown): Promise<StudyResult>;
  composeParamFiles?(files: { paramSets: string[]; acceptStale?: boolean }): {
    params: Record<string, number | readonly number[]>;
    records: readonly { name: string; stale: boolean }[];
  };
};
const scenario = (await import(join(repo, 'packages/calibration/anchors/src/scenario.ts'))) as {
  stdEu13Description(options: Record<string, unknown>): {
    items: { id: string; quat_wxyz?: readonly number[] }[];
  };
};

const out = option('--out') ?? 'variance-study.jsonl';
mkdirSync(dirname(out), { recursive: true });
const cacheDir = option('--cache');
const tiers = (option('--tiers') ?? 'official').split(',');
const levelSeeds = (option('--level-seeds') ?? '1,2,3,4').split(',').map(Number);
const simSeeds = (option('--sim-seeds') ?? '1,2,3,4').split(',').map(Number);
const programme = option('--programme') ?? 'eco_50';
const tag = option('--tag') ?? 'study';
const flipped = new Set((option('--flip-z') ?? '').split(',').filter((s) => s !== ''));
const stall = option('--stall')?.split('=');
const load = option('--load') ?? 'iec-13-careful';
const withSummary = args.includes('--summary');

const params: Record<string, number | readonly number[]> = {};
const paramFile = option('--params');
let records: readonly { name: string; stale: boolean }[] = [];
if (paramFile !== undefined) {
  if (node.composeParamFiles !== undefined) {
    const composed = node.composeParamFiles({
      paramSets: [paramFile],
      ...(args.includes('--accept-stale-params') ? { acceptStale: true } : {}),
    });
    Object.assign(params, composed.params);
    records = composed.records;
  } else {
    Object.assign(
      params,
      (JSON.parse(readFileSync(paramFile, 'utf8')) as { overrides: Record<string, number> })
        .overrides,
    );
  }
}
const doseG = option('--dose-g') === undefined ? undefined : Number(option('--dose-g'));
for (const part of (option('--set') ?? '').split(',').filter((s) => s !== '')) {
  const at = part.indexOf('=');
  const value = part.slice(at + 1);
  params[part.slice(0, at)] = value.includes('|') ? value.split('|').map(Number) : Number(value);
}
const cache = cacheDir === undefined ? undefined : node.createDiskExposureCache(cacheDir);

/** The area-weighted mean of the exposure of the soiled regions of an item, per spray state. */
function summaryOf(item: StudyItem, result: StudyResult): unknown {
  const soiled = new Set(item.regions.map((r) => r.regionId));
  const regions = (item.exposure?.regions ?? []).filter((r) => soiled.has(r.regionId));
  const area = regions.reduce((sum, r) => sum + r.areaMm2, 0);
  if (!(area > 0)) return undefined;
  const mean = (k: number, field: string): number =>
    regions.reduce((sum, r) => sum + (r.states[k]?.[field] ?? 0) * r.areaMm2, 0) / area;
  return {
    area,
    never: regions.reduce((sum, r) => sum + r.neverWetArea * r.areaMm2, 0) / area,
    states: result.machine.states.map((state, k) => ({
      id: state.id,
      jet: mean(k, 'jetShare'),
      jetFilm: mean(k, 'jetFilmShare'),
      wet: mean(k, 'wetTime'),
      dry: mean(k, 'dryArea'),
      flux: mean(k, 'flux'),
      exch: mean(k, 'exchange'),
      ren: mean(k, 'renewal'),
    })),
  };
}

for (const tier of tiers) {
  for (const simSeed of simSeeds) {
    for (const levelSeed of levelSeeds) {
      const description = scenario.stdEu13Description({
        load,
        programme,
        params,
        levelSeed,
        simSeed,
        tier,
      });
      const edited = {
        ...description,
        ...(stall === undefined
          ? {}
          : { stalledArms_deg: { [stall[0] as string]: Number(stall[1]) } }),
        items: description.items.map((item) => {
          if (!flipped.has(item.id)) return item;
          // Half a turn about the vertical: (w, x, y, z) -> (-z, -y, x, w).
          const q = item.quat_wxyz ?? [1, 0, 0, 0];
          return { ...item, quat_wxyz: [-(q[3] ?? 0), -(q[2] ?? 0), q[1] ?? 0, q[0] ?? 1] };
        }),
      };
      const started = performance.now();
      const input = {
        ...(core.washInputFromDescription(edited) as Record<string, unknown>),
        ...(records.length === 0 ? {} : { paramSets: records }),
        // literal-ok-begin: grams to kilograms
        ...(doseG === undefined
          ? {}
          : { detergent: { name: 'as the set describes', dose: doseG / 1000 } }),
        // literal-ok-end
      };
      const result = await (node.washWithSource ?? core.wash)(input, {
        ...(cache === undefined ? {} : { cache }),
      });
      const seconds = (performance.now() - started) / 1000;
      const items: Record<string, unknown> = {};
      for (const item of result.items) {
        const x = withSummary ? summaryOf(item, result) : undefined;
        items[item.itemId] = {
          ...(x === undefined ? {} : { x }),
          t: item.typeId,
          c: item.clean,
          s: item.score,
          r: Number(item.residualMass_mg.toFixed(4)),
          i: Number(item.initialMass_mg.toFixed(3)),
          a: Number(item.visibleAreaMm2.toFixed(2)),
          k: item.specks,
          f: Number(item.water.film_g.toFixed(4)),
          ...(item.band === undefined ? {} : { d: item.band.decided }),
        };
      }
      const soiled = result.items.filter((i) => i.initialMass_mg > 0);
      const line = {
        tag,
        tier,
        levelSeed,
        simSeed,
        programme,
        flipped: [...flipped],
        seconds: Number(seconds.toFixed(1)),
        timings: result.run.timings_ms,
        computed: result.run.exposureComputed,
        blocks: result.run.blocks,
        rssMb: Math.round(process.resourceUsage().maxRSS / 1024),
        hash: result.provenance.resultHash,
        hydro: result.provenance.hydroHash,
        sets: records.map((r) => `${r.name}${r.stale ? ' (stale)' : ''}`),
        dose_g: doseG ?? null,
        source: result.provenance.sourceFingerprint ?? '',
        edge: soiled.filter((i) => i.band !== undefined && !i.band.decided).length,
        clean: result.items.filter((i) => i.clean).length,
        soiledClean: soiled.filter((i) => i.clean).length,
        soiled: soiled.length,
        problems: result.problems.length,
        states: result.machine.states.map((state) => ({
          id: state.id,
          duration: state.duration_s,
          flow: state.flow_L_min,
          paths: state.exposure['secondaryPaths'],
          settled: state.exposure['secondarySettled'],
        })),
        items,
      };
      appendFileSync(out, `${JSON.stringify(line)}\n`);
      const mean = result.items.reduce((sum, i) => sum + i.score, 0) / result.items.length;
      console.error(
        `${tag} ${tier} L${levelSeed} S${simSeed}: ${seconds.toFixed(0)} s, mean ${mean.toFixed(3)}, soiled clean ${line.soiledClean}/${line.soiled}, computed ${line.computed}`,
      );
    }
  }
}
process.exit(0);
