/**
 * Writes `docs/calibration/soil-quantities.md`: the soil side's data for every soil the
 * catalogue and the levels of the course use (`SOIL_DATA` of `@spotless/sim-soil`: model class,
 * appearance, how the soil is laid on, solids fraction, working loading, coverage, ageing), and
 * every soil record of the starter levels that disagrees with it, with by how much, for
 * whoever maintains the levels to apply.
 *
 *   cd packages/calibration && pnpm exec tsx scripts/soil-quantities.ts [--out <file>]
 *
 * A level record states an amount in grams; the wash multiplies it by a solids fraction and
 * spreads it over the covered share of the named regions. Three dry loadings are compared per
 * record: what the first build made of it (the catalogue's solids fraction, or the default of
 * the first build's class where the catalogue has none), what the wash makes of it now (the
 * solids fraction of the soil data), and the working quantity of the soil data on the same
 * covered area. A record is listed when the wash's loading is outside the range of the soil
 * data, when its coverage is far from the usual one, or when its heat history is read as
 * another heat step.
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSoil, instantiate, listSoils } from '@spotless/catalogue';
import { starterLevels } from '@spotless/levels';
import {
  createWashParams,
  heatStepOf,
  SOIL_CLASS_OF_MECHANISM,
  SOIL_DATA,
  soilData,
} from '@spotless/sim-core';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2).filter((a) => a !== '--');
const outAt = args.indexOf('--out');
const outFile =
  outAt >= 0 && args[outAt + 1] !== undefined
    ? (args[outAt + 1] as string)
    : join(here, '..', '..', '..', 'docs', 'calibration', 'soil-quantities.md');

const params = createWashParams();
const f = (v: number, digits = 2): string =>
  !Number.isFinite(v) ? 'n/a' : Math.abs(v) >= 100 ? v.toFixed(0) : v.toPrecision(digits + 1);

const lines: string[] = [];
lines.push("# Soil quantities: the soil side's data per soil, and the level records that disagree");
lines.push('');
lines.push(
  'Written by `packages/calibration/scripts/soil-quantities.ts` from `SOIL_DATA` (`packages/sim-soil/src/soil-data.ts`), the catalogue and the levels of the course. Do not edit by hand. Sources of the numbers: `docs/research/standards.md` sections 4.1, 4.3, 4.4, 10.3 and 13.3, `docs/research/soils.md` sections 5, 7.7 and 8.1, `docs/research/chemistry.md` sections 4.2, 7 and 8.6; the note of each row says which.',
);
lines.push('');
lines.push('## 1. What the wash does with a soil record now');
lines.push('');
lines.push(
  "- **Model class, solids fraction and scatter come from the soil id** (`SOIL_DATA`), for every soil of the catalogue. The catalogue's mechanism class and solids fraction are used only for an id the table does not know.",
);
lines.push(
  '- **An amount is on the basis the catalogue states for the soil**: wet (as applied) or dry. A soil stated dry (tea, coffee, tomato sauce, pasta film, burnt soils) is all dry matter; the first build multiplied it by the solids fraction of its class (a tea film by 0.01).',
);
lines.push(
  '- **Heated milk is the protein and fat that has to be digested** (5 % of UHT milk with 1.5 % fat, 7 % of whole milk), not all its solids and not the 50 % of the egg-yolk class.',
);
lines.push(
  '- **Microwaved milk is read as cooked dry (125 C, 30 min), not as "baked" (160 C, 1 h)**, which is the only heat history the catalogue allows it.',
);
lines.push('');
lines.push('## 2. The data per catalogue soil');
lines.push('');
lines.push(
  '| Soil | Catalogue class | Model class | Appearance (standards 10.3) | Visible above (mg/cm2) | Laid on | Basis | Solids | Source of solids | Working loading (g/m2) | Range | Dry (mg/cm2) | Usual coverage | Usual ageing | Note |',
);
lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const missing: string[] = [];
for (const soil of listSoils()) {
  const d = soilData(soil.id);
  if (d === undefined) {
    missing.push(soil.id);
    continue;
  }
  const visible = params.soilClass(d.modelClass, 'visibleMass') * 100;
  const heat = heatStepOf(d.id, d.heatHistory);
  lines.push(
    `| ${d.id} | ${soil.soilClass} | ${d.modelClass} | ${d.appearance} | ${f(visible)} | ${d.application} | ${d.basis} | ${d.solidsFraction} | ${d.solidsSource}${d.solidsSource === 'catalogue' && soil.loading.solidsFraction !== d.solidsFraction ? ' (**differs**)' : ''} | ${d.loading} | ${d.loadingRange[0]} to ${d.loadingRange[1]} | ${f((d.loading * d.solidsFraction) / 10)} | ${d.coverage} | ${d.heatHistory}${heat === d.heatHistory ? '' : ` (read as ${heat})`}, ${d.ageH} h | ${d.note} |`,
  );
}
lines.push('');
lines.push(
  missing.length === 0
    ? `Every one of the ${listSoils().length} catalogue soils has an entry.`
    : `**Catalogue soils without an entry: ${missing.join(', ')}.**`,
);
const extra = Object.keys(SOIL_DATA).filter((id) => !listSoils().some((s) => s.id === id));
if (extra.length > 0)
  lines.push(`Entries for ids the catalogue does not hold: ${extra.join(', ')}.`);

// ---- the records of the starter levels
interface Row {
  level: string;
  item: string;
  itemType: string;
  soil: string;
  amountG: number;
  areaCm2: number;
  coverage: string;
  firstBuild: number;
  now: number;
  working: number;
  why: string[];
}
const rows: Row[] = [];
let records = 0;
const used = new Set<string>();
for (const level of starterLevels()) {
  for (const item of level.items) {
    const areas = instantiate(item.itemType).regionAreas;
    for (const soil of item.soils) {
      records++;
      used.add(soil.type);
      const d = soilData(soil.type);
      const catalogue = getSoil(soil.type);
      let area = 0;
      for (const r of soil.regions) area += (areas[r.region] ?? 0) * r.coverage;
      const firstClass = SOIL_CLASS_OF_MECHANISM[catalogue.soilClass];
      const firstSolids =
        catalogue.loading.solidsFraction ?? params.soilClass(firstClass, 'solidsFraction');
      const nowSolids = d?.solidsFraction ?? firstSolids;
      // mg/cm2 of dry soil on the covered area.
      const loading = (solids: number): number =>
        area > 0 ? (soil.amountG * solids * 1000) / (area * 1e4) : Number.NaN;
      const working = d === undefined ? Number.NaN : (d.loading * d.solidsFraction) / 10;
      const why: string[] = [];
      if (d === undefined) why.push('no entry in the soil data');
      else {
        const wet = area > 0 ? soil.amountG / area : Number.NaN;
        if (wet < d.loadingRange[0] * 0.999 || wet > d.loadingRange[1] * 1.001) {
          why.push(
            `stated ${f(wet)} g/m2 on its ${d.basis} basis, outside ${d.loadingRange[0]} to ${d.loadingRange[1]} (working ${d.loading}): amount x ${f(d.loading / wet)} to reach the working quantity`,
          );
        }
        const coverage = soil.regions.reduce((sum, r) => sum + r.coverage, 0) / soil.regions.length;
        if (coverage < 0.5 * d.coverage || coverage > 2 * d.coverage) {
          why.push(`mean coverage ${f(coverage)} against the usual ${d.coverage}`);
        }
        const heat = heatStepOf(soil.type, soil.heatHistory);
        if (heat !== soil.heatHistory)
          why.push(`heat history ${soil.heatHistory} is read as ${heat}`);
        if (Math.abs(firstSolids - nowSolids) > 1e-9) {
          why.push(
            `solids fraction ${f(firstSolids)} in the first build, ${f(nowSolids)} now: the dry mass changes by x ${f(nowSolids / firstSolids)} without any change of the record`,
          );
        }
      }
      if (why.length > 0) {
        rows.push({
          level: level.id,
          item: item.id,
          itemType: item.itemType,
          soil: soil.type,
          amountG: soil.amountG,
          areaCm2: area * 1e4,
          coverage: soil.regions.map((r) => `${r.region} ${r.coverage}`).join(', '),
          firstBuild: loading(firstSolids),
          now: loading(nowSolids),
          working,
          why,
        });
      }
    }
  }
}
lines.push('');
lines.push('## 3. Soil records of the starter levels that disagree');
lines.push('');
lines.push(
  `${records} soil records in ${starterLevels().length} levels use ${used.size} soils (${[...used].sort().join(', ')}). ${rows.length} records are listed; identical records of one level (the same item type, soil, amount and coverage) are merged into one row.`,
);
lines.push('');
lines.push(
  '| Level | Items | Item type | Soil | Amount (g) | Covered (cm2) | Regions and coverage | Dry loading, first build (mg/cm2) | Dry loading as the wash reads it now | Working quantity (mg/cm2) | Now / working | What disagrees |',
);
lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
const merged = new Map<string, { row: Row; items: string[] }>();
for (const row of rows) {
  const key = [row.level, row.itemType, row.soil, row.amountG, row.coverage].join('|');
  const entry = merged.get(key);
  if (entry === undefined) merged.set(key, { row, items: [row.item] });
  else entry.items.push(row.item);
}
for (const { row, items } of merged.values()) {
  lines.push(
    `| ${row.level} | ${items.length === 1 ? items[0] : `${items.length} (${items[0]} ...)`} | ${row.itemType} | ${row.soil} | ${f(row.amountG)} | ${f(row.areaCm2)} | ${row.coverage} | ${f(row.firstBuild)} | ${f(row.now)} | ${f(row.working)} | ${f(row.now / row.working)} | ${row.why.join('; ')} |`,
  );
}
lines.push('');
lines.push('## 4. What to do about a row');
lines.push('');
lines.push(
  '1. Where a row says "amount x k to reach the working quantity", the record lies outside the range of the soil data on the area it covers: multiply its amount by k, or change the coverage, or leave it and say why (a level may want a heavier or lighter soil than the usual one; the range is what the dossiers support).',
);
lines.push(
  '2. A row that only says the solids fraction changed needs no edit: the wash now reads the record as the catalogue\'s basis says. Check that the dry loading in the column "as the wash reads it now" is what the level meant.',
);
lines.push(
  '3. The standard soils on the standard items have fixed working quantities (standards 13.3): `STD_EU_13_SOILS` in `packages/calibration/anchors/src/scenario.ts`. The settled standard loads should carry those.',
);
lines.push(
  '4. Open points for the catalogue: a solids fraction for every soil stated wet (22 have none), the basis respected for soils stated dry (`tomato_sauce` has both a dry basis and a solids fraction of 0.3), an appearance class per soil (standards 10.3), a heat history "cooked" for `iec_milk` and `ikw_milk_microwaved`, and separate ids for butter and margarine and for lard and tallow, which melt differently (chemistry 4.2).',
);
writeFileSync(outFile, `${lines.join('\n')}\n`);
console.log(
  `${outFile}: ${listSoils().length} soils, ${records} level records, ${rows.length} listed (${merged.size} rows)`,
);
