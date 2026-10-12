/**
 * Writes `tiers.<set>.json`: how far the fast tier agrees with the official tier under a
 * parameter set, per class of item and per programme, from the lines of the variance study
 * (`packages/sim-core/scripts/variance-study.ts`: one line per wash, the same level and
 * simulation seeds at both tiers).
 *
 *   cd packages/calibration
 *   pnpm exec tsx anchors/scripts/tier-agreement.ts --set <name of the set>
 *        [--out anchors/tiers.<set>.json] [--basis <what was washed>]
 *        <programme id>=<official.jsonl>,<fast.jsonl> [<programme id>=...]
 *
 * A verdict is that of a soiled item (clean or not); a pair of washes is one official and one
 * fast wash with the same seeds. The report of every fast wash quotes the file
 * (`fastTierNote` of `@spotless/sim-core/tier-agreement`).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { SIM_VERSION } from '@spotless/sim-core';
import {
  tierAgreementFileOf,
  type TierAgreementCount,
  type TierAgreementFile,
  type TierAgreementOfProgramme,
} from '@spotless/sim-core/tier-agreement';
import { ANCHORS_DIR } from '../src/scenario.ts';
import { itemClassOf } from '../src/summary.ts';

interface StudyLine {
  readonly tier: 'official' | 'fast';
  readonly levelSeed: number;
  readonly simSeed: number;
  /** Per item id: catalogue type, clean, initial soil (mg). */
  readonly items: Readonly<
    Record<string, { readonly t: string; readonly c: boolean; readonly i: number }>
  >;
}

const origin = process.env['INIT_CWD'] ?? process.cwd();
const fromOrigin = (path: string): string => (isAbsolute(path) ? path : join(origin, path));
const args = process.argv.slice(2).filter((a) => a !== '--');
const option = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const setName = option('--set');
if (setName === undefined) throw new Error('--set <name of the parameter set> is required');
const basis =
  option('--basis') ?? 'the careful standard load, level seeds 1 and 2, simulation seeds 1 to 4';
const out = fromOrigin(
  option('--out') ?? tierAgreementFileOf(join(ANCHORS_DIR, `${setName}.json`)),
);
const lines = (file: string): StudyLine[] =>
  readFileSync(fromOrigin(file), 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as StudyLine);

const programmes: Record<string, TierAgreementOfProgramme> = {};
for (const arg of args) {
  const match = /^([a-z0-9_]+)=([^,]+),(.+)$/.exec(arg);
  if (match === null) continue;
  const [, programme, officialFile, fastFile] = match as unknown as [
    string,
    string,
    string,
    string,
  ];
  const official = new Map(
    lines(officialFile)
      .filter((line) => line.tier === 'official')
      .map((line) => [`${line.levelSeed}/${line.simSeed}`, line]),
  );
  const all = { agree: 0, of: 0 };
  const byClass: Record<string, { agree: number; of: number }> = {};
  let washes = 0;
  for (const fast of lines(fastFile)) {
    if (fast.tier !== 'fast') continue;
    const reference = official.get(`${fast.levelSeed}/${fast.simSeed}`);
    if (reference === undefined) continue;
    washes++;
    for (const [id, item] of Object.entries(reference.items)) {
      const other = fast.items[id];
      if (!(item.i > 0) || other === undefined) continue;
      const cls = itemClassOf(item.t) ?? 'other';
      const count = (byClass[cls] ??= { agree: 0, of: 0 });
      count.of++;
      all.of++;
      if (item.c === other.c) {
        count.agree++;
        all.agree++;
      }
    }
  }
  if (washes === 0) throw new Error(`${programme}: no pair of washes with the same seeds`);
  const sorted: Record<string, TierAgreementCount> = {};
  for (const cls of Object.keys(byClass).sort()) sorted[cls] = byClass[cls] as TierAgreementCount;
  programmes[programme] = { basis, washes, all, byClass: sorted };
  console.log(
    `${programme}: ${washes} pairs; verdicts agreeing ${all.agree} of ${all.of} (${((100 * all.agree) / all.of).toFixed(1)} %); ` +
      Object.entries(sorted)
        .map(([cls, c]) => `${cls} ${c.agree}/${c.of}`)
        .join(', '),
  );
}
if (Object.keys(programmes).length === 0) {
  throw new Error('name at least one <programme id>=<official.jsonl>,<fast.jsonl>');
}
const file: TierAgreementFile = {
  format: 'spotless.tier-agreement',
  paramSet: setName,
  simVersion: SIM_VERSION,
  createdAt: new Date().toISOString(),
  programmes,
};
writeFileSync(out, `${JSON.stringify(file, null, 1)}\n`);
console.log(`wrote ${out}`);
