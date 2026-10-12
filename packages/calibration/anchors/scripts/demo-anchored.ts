/**
 * The demonstration washes of `packages/sim-verify/demos/` again, with the anchored parameter
 * set, saved beside the default ones.
 *
 *   pnpm --filter @spotless/calibration exec tsx anchors/scripts/demo-anchored.ts
 *        [name ...] [--params anchors/<current set>.json] [--demos <dir>] [--out <dir>]
 *
 * Each `<name>.wash.json` of the demonstrations (the description the default wash was run
 * from: the owner's machine, Auto 45-65, official tier, the soils of the load file, 20 g of
 * reference detergent) is washed three times on the water side that is on disk:
 *
 *   defaults        the registry defaults (what `<name>.result.json` holds, on today's water
 *                   side; not written over the default files)
 *   anchored        the anchored set, soils of the load file
 *                   -> `<name>.<set>.result.json`, `<name>.<set>.table.md`
 *   working soils   the anchored set with the working soil quantities of `src/scenario.ts`
 *                   in place of those of the load file -> `<name>.<set>.working-soils.result.json`
 *
 * and `SUMMARY.<set>.md` puts them side by side.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import {
  washInputFromDescription,
  washResultToJson,
  type ParamValue,
  type WashDescription,
  type WashResult,
} from '@spotless/sim-core';
import { createDiskExposureCache, washWithSource } from '@spotless/sim-core/node';
import { STANDARD_COMPOSITION } from '../src/literature.ts';
import { classMeans } from '../src/objective.ts';
import {
  ANCHORS_DIR,
  CURRENT_ANCHORED,
  STD_EU_13_SOILS,
  withWorkingSoils,
} from '../src/scenario.ts';
import { readOverrides } from '../src/sets.ts';
import { summariseWash, type WashSummary } from '../src/summary.ts';
import { anchorCacheDir, waterSide } from '../src/water.ts';

const origin = process.env['INIT_CWD'] ?? process.cwd();
const fromOrigin = (path: string): string => (isAbsolute(path) ? path : join(origin, path));
const args = process.argv.slice(2).filter((a) => a !== '--');
const option = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const valueAt = new Set(
  ['--params', '--demos', '--out'].map((n) => args.indexOf(n) + 1).filter((i) => i > 0),
);
const names = args.filter((a, i) => !a.startsWith('--') && !valueAt.has(i));
const wanted =
  names.length > 0
    ? names
    : ['iec-13-careful', 'iec-13-careful-badly', 'half-careful', 'iec-13-careless'];
const paramFile = fromOrigin(option('--params') ?? join(ANCHORS_DIR, `${CURRENT_ANCHORED}.json`));
const overrides = readOverrides(paramFile);
const setName = (JSON.parse(readFileSync(paramFile, 'utf8')) as { provenance: { name: string } })
  .provenance.name;
const demos = fromOrigin(option('--demos') ?? join(ANCHORS_DIR, '..', '..', 'sim-verify', 'demos'));
const out = fromOrigin(option('--out') ?? demos);
mkdirSync(out, { recursive: true });
const cache = createDiskExposureCache(anchorCacheDir());
const water = waterSide();
console.log(`water side: ${water.simVersion}, sources ${water.sourceHash}`);

/** One wash of one load, summarised. */
interface Row {
  readonly load: string;
  readonly variant: string;
  readonly summary: WashSummary;
  readonly weighted: number;
  readonly seconds: number;
}
const rows: Row[] = [];
const f = (v: number, digits = 2): string => (Number.isFinite(v) ? v.toFixed(digits) : 'n/a');

function tableOf(result: WashResult, title: string): string {
  const lines = [
    `# ${title}`,
    '',
    '| Item | Type | Score | Clean | Soil left (mg of mg) | Visibly soiled (mm2) | Specks | Water held (mL) |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const item of result.items) {
    lines.push(
      `| ${item.itemId} | ${item.typeId} | ${item.score} | ${item.clean ? 'yes' : 'no'} | ${item.initialMass_mg > 0 ? `${f(item.residualMass_mg)} of ${f(item.initialMass_mg, 1)}` : '-'} | ${f(item.visibleAreaMm2, 1)} | ${item.specks} | ${f(item.water.pooled_mL, 1)} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

for (const name of wanted) {
  const file = join(demos, `${name}.wash.json`);
  if (!existsSync(file)) {
    console.error(`${file}: not found, skipped`);
    continue;
  }
  const description = JSON.parse(readFileSync(file, 'utf8')) as WashDescription;
  const working = description.items.every((item) =>
    (item.soils ?? []).every((soil) => STD_EU_13_SOILS[item.type]?.[soil.type] !== undefined),
  );
  const variants: [string, WashDescription, string | undefined][] = [
    ['defaults', description, undefined],
    [
      'anchored',
      { ...description, params: { ...description.params, ...overrides } },
      `${name}.${setName}`,
    ],
  ];
  if (working) {
    const params: Record<string, ParamValue> = { ...description.params, ...overrides };
    variants.push([
      'anchored, working soils',
      {
        ...description,
        params,
        items: description.items.map((item) => withWorkingSoils(item, params)),
      },
      `${name}.${setName}.working-soils`,
    ]);
  }
  for (const [variant, d, stem] of variants) {
    const started = performance.now();
    const result = await washWithSource(washInputFromDescription(d), { cache });
    const seconds = (performance.now() - started) / 1000;
    const summary = summariseWash(result);
    rows.push({
      load: name,
      variant,
      summary,
      weighted: classMeans(result.items, STANDARD_COMPOSITION).score.all,
      seconds,
    });
    console.log(
      `${name}, ${variant}: mean ${f(summary.all.meanScore)}, clean ${summary.all.clean} of ${summary.items}, soiled clean ${summary.soiledOnly.clean} of ${summary.soiledOnly.items}, soil left ${f((100 * summary.soil.remaining_mg) / Math.max(summary.soil.initial_mg, 1e-9), 1)} %, ${f(seconds, 0)} s (exposure ${result.run.exposureComputed} computed)`,
    );
    if (stem !== undefined) {
      writeFileSync(
        join(out, `${stem}.result.json`),
        `${JSON.stringify(washResultToJson(result), null, 1)}\n`,
      );
      writeFileSync(
        join(out, `${stem}.table.md`),
        tableOf(
          result,
          `${name}: ${variant} (${setName}), ${summary.programme}, tier ${summary.tier}, ${water.simVersion}`,
        ),
      );
    }
  }
}

const lines: string[] = [];
lines.push(`# The demonstration washes with the parameter set ${setName}`);
lines.push('');
lines.push(
  `Settled standard loads of the owner's Bosch SMV4HAX40G, Auto 45-65, official tier, 20 g of reference detergent D, from the saved \`<name>.wash.json\`. Written by \`packages/calibration/anchors/scripts/demo-anchored.ts\` on the water side ${water.simVersion} (sources ${water.sourceHash.slice(0, 19)}...). "Defaults" is the registry defaults on that same water side; the default files beside this one (\`<name>.result.json\`, \`SUMMARY.md\`) were written on an earlier water side and are not touched. "Working soils" replaces the soil quantities of the load file by those of \`docs/calibration/anchoring.md\` section 2.2 (the load file carries 5 g of dry milk per glass and 0.1 mg of tea per cup).`,
);
lines.push('');
lines.push(
  '| Load | Parameters | Items | Mean score | Mean, standard weights | Clean | Soiled items clean | Crockery | Cutlery | Glass | Melamine | Dry soil left | Water held (mL) |',
);
lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  const s = r.summary;
  lines.push(
    `| ${r.load} | ${r.variant} | ${s.items} | ${f(s.all.meanScore)} | ${f(r.weighted)} | ${s.all.clean} | ${s.soiledOnly.clean} of ${s.soiledOnly.items} | ${f(s.byClass.crockery.meanScore)} | ${f(s.byClass.cutlery.meanScore)} | ${f(s.byClass.glass.meanScore)} | ${f(s.byClass.melamine.meanScore)} | ${f((100 * s.soil.remaining_mg) / Math.max(s.soil.initial_mg, 1e-9), 1)} % | ${f(s.heldWater_mL, 0)} |`,
  );
}
lines.push('');
lines.push('By soil (share of the dry mass left; mean score of the items that carry it):');
lines.push('');
const soils = [...new Set(rows.flatMap((r) => r.summary.bySoil.map((s) => s.type)))].sort();
lines.push(`| Load | Parameters | ${soils.join(' | ')} |`);
lines.push(`|---|---|${soils.map(() => '---').join('|')}|`);
for (const r of rows) {
  lines.push(
    `| ${r.load} | ${r.variant} | ${soils
      .map((type) => {
        const s = r.summary.bySoil.find((x) => x.type === type);
        return s === undefined
          ? '-'
          : `${f((100 * s.residual_mg) / Math.max(s.initial_mg, 1e-12), 1)} %; ${f(s.meanScore, 1)}`;
      })
      .join(' | ')} |`,
  );
}
const text = `${lines.join('\n')}\n`;
writeFileSync(join(out, `SUMMARY.${setName}.md`), text);
console.log(text);
