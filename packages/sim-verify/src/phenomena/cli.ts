/**
 * The command of the phenomena suite.
 *
 *   pnpm --filter @spotless/sim-verify exec tsx src/phenomena/cli.ts [P02 P25 ...]
 *        [--tier fast|official] [--params <parameter-set.json>] [--accept-stale-params]
 *        [--dose-g <grams>] [--detergent-name <name>] [--programme <id>] [--seed <n>]
 *        [--resolution] [--quick] [--cache <dir>] [--out <dir>] [--name <name>] [--list]
 *
 *   pnpm --filter @spotless/sim-verify exec tsx src/phenomena/cli.ts
 *        --compare <title> <label>=<report.json> <label>=<report.json> ... [--out <dir>] [--name <name>]
 *
 * Runs the named phenomena (all 48 without names; `--resolution` those whose result could
 * depend on the block size; `--quick` the six of the unit test) at a tier with a parameter
 * set (the registry defaults, or a file: `ParamSet.toJSON` or a plain map of key to value)
 * with the machine's own dose of the reference detergent or `--dose-g` grams of the product
 * the set describes (the owner's capsule: 12.9), and writes `<name>.md` and `<name>.json`
 * under `phenomena/reports/`. Every wash whose case names no programme runs on the scored
 * programme, Eco 50; `--programme` puts another programme of the machine in its place
 * (`auto_145`: the owner's Auto 45-65, the secondary report). A `spotless.params` file that is stale (written against another
 * registry or calibrated on another water side) stops the command with what to do, unless
 * `--accept-stale-params` is given; the head of the report then says so (default name
 * `phenomena-<tier>-<defaults or the file's base name>`). `--compare` reads reports and
 * writes their check-by-check comparison (two tiers, or several seeds).
 *
 * The loads must have been built (`phenomena/builder/build-loads.ts`); a phenomenon whose
 * load is missing reports `error` and says which.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, join } from 'node:path';
import {
  fastTierNote,
  readTierAgreement,
  tierAgreementFileOf,
} from '@spotless/sim-core/tier-agreement';
import { SCORED_PROGRAMME } from './programmes.ts';
import { comparisonMarkdown, reportJson, reportMarkdown } from './report.ts';
import {
  PHENOMENA,
  QUICK_IDS,
  readParamSetFile,
  REGISTRY_DEFAULTS,
  REPORTS_DIR,
  runPhenomena,
} from './runner.ts';
import type { SuiteReport, Tier } from './types.ts';

// pnpm runs a package script in the package directory and keeps the caller's in INIT_CWD.
const origin = process.env['INIT_CWD'] ?? process.cwd();
const fromOrigin = (path: string): string => (isAbsolute(path) ? path : join(origin, path));

const args = process.argv.slice(2).filter((a) => a !== '--');
const ids: string[] = [];
let tier: Tier = 'fast';
let paramsFile: string | undefined;
let cacheDir: string | undefined;
let outDir = REPORTS_DIR;
let name: string | undefined;
let seed: number | undefined;
let acceptStale = false;
let dose: number | undefined;
let detergentName: string | undefined;
let programme: string | undefined;
let compare: string | undefined;
const compared: string[] = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i] as string;
  if (arg === '--tier') tier = args[++i] === 'official' ? 'official' : 'fast';
  else if (arg === '--params') paramsFile = fromOrigin(args[++i] ?? '');
  else if (arg === '--cache') cacheDir = fromOrigin(args[++i] ?? '');
  else if (arg === '--out') outDir = fromOrigin(args[++i] ?? '');
  else if (arg === '--name') name = args[++i];
  else if (arg === '--seed') seed = Number(args[++i]);
  else if (arg === '--accept-stale-params') acceptStale = true;
  else if (arg === '--dose-g') dose = Number(args[++i]);
  else if (arg === '--programme') programme = args[++i];
  else if (arg === '--detergent-name') detergentName = args[++i];
  else if (arg === '--resolution')
    ids.push(...PHENOMENA.filter((s) => s.resolutionSensitive).map((s) => s.id));
  else if (arg === '--quick') ids.push(...QUICK_IDS);
  else if (arg === '--compare') compare = args[++i] ?? 'Comparison';
  else if (arg === '--list') {
    for (const s of PHENOMENA) {
      console.log(
        `${s.id} ${s.title}${s.requires === undefined ? '' : ` [needs ${s.requires.join(', ')}]`}${s.resolutionSensitive ? ' [both tiers]' : ''}`,
      );
    }
    process.exit(0);
  } else if (arg.startsWith('--')) {
    console.error(`phenomena: unknown option ${arg}`);
    process.exit(2);
  } else if (compare !== undefined) compared.push(arg);
  else ids.push(arg.toUpperCase());
}

mkdirSync(outDir, { recursive: true });

if (compare !== undefined) {
  const labels: string[] = [];
  const reports: SuiteReport[] = [];
  for (const entry of compared) {
    const at = entry.indexOf('=');
    labels.push(at > 0 ? entry.slice(0, at) : basename(entry, '.json'));
    reports.push(
      JSON.parse(
        readFileSync(fromOrigin(at > 0 ? entry.slice(at + 1) : entry), 'utf8'),
      ) as SuiteReport,
    );
  }
  const file = join(outDir, `${name ?? 'comparison'}.md`);
  writeFileSync(file, comparisonMarkdown(compare, labels, reports));
  console.log(file);
  process.exit(0);
}

if (dose !== undefined && !(dose > 0)) {
  console.error(`phenomena: --dose-g ${String(dose)} is not a mass in grams`);
  process.exit(2);
}
let chosen;
try {
  chosen = paramsFile === undefined ? REGISTRY_DEFAULTS : readParamSetFile(paramsFile, acceptStale);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
const paramSet =
  dose === undefined
    ? chosen
    : {
        ...chosen,
        detergent: { name: detergentName ?? 'as the parameter set describes', dose_g: dose },
      };
const run = await runPhenomena({
  ...(ids.length === 0 ? {} : { ids: [...new Set(ids)] }),
  tier,
  paramSet,
  ...(cacheDir === undefined ? {} : { cacheDir }),
  ...(seed === undefined ? {} : { seed }),
  ...(programme === undefined ? {} : { programme }),
  log: (line) => console.error(line),
});
// A fast run says what the fast tier costs, as measured for the set it ran with.
const report: SuiteReport =
  tier === 'fast'
    ? {
        ...run,
        tierNote: fastTierNote(
          paramsFile === undefined
            ? null
            : readTierAgreement(tierAgreementFileOf(fromOrigin(paramsFile))),
          programme ?? SCORED_PROGRAMME,
        ),
      }
    : run;
const base =
  name ??
  `phenomena-${tier}-${paramsFile === undefined ? 'defaults' : basename(paramsFile, '.json')}`;
writeFileSync(join(outDir, `${base}.md`), reportMarkdown(report));
writeFileSync(join(outDir, `${base}.json`), reportJson(report));
console.error(
  `${report.scenarios.length} phenomena in ${report.seconds} s: ` +
    Object.entries(report.counts)
      .filter(([, n]) => n > 0)
      .map(([verdict, n]) => `${n} ${verdict}`)
      .join(', '),
);
console.log(join(outDir, `${base}.md`));
process.exit(0);
