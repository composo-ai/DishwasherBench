/**
 * Checks the anchored parameter set without washing anything: that the file reads against the
 * registry of the wash simulation with its hashes, that every override is inside its
 * registered range and is either a mechanism correction or a fitted key of
 * `src/anchored.ts`, that the literature record is a valid wash record, and that the
 * bench-scale anchors hold under the set (`src/bench.ts`), and that the set was made on the
 * water side that is on disk now: the simulator version and the fingerprint of the exposure
 * sources it records (`anchoredOn`) against `SIM_VERSION` and `src/water.ts`. An anchoring is only valid
 * for the water code it was fitted on.
 *
 *   pnpm --filter @spotless/calibration exec tsx anchors/scripts/check.ts
 *        [--params anchors/<current set>.json] [--allow-water-drift]
 *
 * Exits with 1 when a check fails. With `--allow-water-drift` a change of the water sources
 * under an unchanged version string is reported and does not fail.
 *
 * The last line this script prints says whether all checks pass. Started through `pnpm exec`
 * as above, a failure is followed by two lines that are pnpm's own: pnpm 9.4.0 prints
 * `undefined` and then `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL` after any command that exits
 * with 1.
 */

import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { SIM_VERSION, washRegistry } from '@spotless/sim-core';
import { readParamSet } from '@spotless/sim-params';
import { validateWashRecord } from '../../src/index.ts';
import { FITTED_KEYS, MECHANISM_CORRECTIONS, OWNER_CALIBRATED } from '../src/anchored.ts';
import { eggYolkRates, ikwResidues } from '../src/bench.ts';
import { ANCHORS_DIR, CURRENT_ANCHORED } from '../src/scenario.ts';
import { waterSide } from '../src/water.ts';

const origin = process.env['INIT_CWD'] ?? process.cwd();
const args = process.argv.slice(2).filter((a) => a !== '--');
const at = args.indexOf('--params');
const given = at >= 0 ? (args[at + 1] as string) : join(ANCHORS_DIR, `${CURRENT_ANCHORED}.json`);
const file = isAbsolute(given) ? given : join(origin, given);

let failures = 0;
const check = (ok: boolean, what: string): void => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures++;
};

const registry = washRegistry();
const document = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
const read = readParamSet(registry, document);
check(
  read.ok,
  `${file} reads against the registry with its hydro and soil hashes${read.ok ? '' : `: ${read.error.map((i) => `${i.key} ${i.message}`).join('; ')}`}`,
);
const anchoredOn = document['anchoredOn'] as
  { simVersion?: string; exposureSource?: string; machineSource?: string } | undefined;
check(
  anchoredOn?.simVersion === SIM_VERSION,
  `the set was made on the simulator version on disk (${SIM_VERSION}): it records ${anchoredOn?.simVersion ?? 'no version'}`,
);
const water = waterSide();
check(
  anchoredOn?.machineSource === water.machineSource,
  `the set was made on the machine data on disk (${water.machineSource.slice(0, 12)}...): it records ${anchoredOn?.machineSource?.slice(0, 12) ?? 'no hash'}...`,
);
const sameSources = anchoredOn?.exposureSource === water.exposureSource;
if (sameSources || !args.includes('--allow-water-drift')) {
  check(
    sameSources,
    `the set was made on the water sources on disk (${water.exposureSource.slice(0, 12)}...): it records ${anchoredOn?.exposureSource?.slice(0, 12) ?? 'no hash'}...${sameSources ? '' : ' Its numbers are those of other water code: refit (anchors/scripts/fit.ts)'}`,
  );
} else {
  console.log(
    `note the water sources on disk (${water.exposureSource.slice(0, 12)}...) are not those the set was made on (${anchoredOn?.exposureSource?.slice(0, 12) ?? 'no hash'}...), under one version string`,
  );
}
if (read.ok) {
  const set = read.value;
  check(
    Object.keys(set.overrides).every((key) => registry.def(key).group !== 'hydro'),
    'no override is in the hydro group: cached exposure is reused',
  );
  const known = new Set([
    ...MECHANISM_CORRECTIONS.map((o) => o.key),
    ...FITTED_KEYS.map((k) => k.key),
    ...OWNER_CALIBRATED.map((o) => o.key),
    // Follows soil.egg_yolk.rateRef: the milk class has no rate data of its own.
    'soil.milk.rateRef',
  ]);
  for (const [key, value] of Object.entries(set.overrides)) {
    const def = registry.def(key) as { min?: number; max?: number; default?: unknown };
    const inside =
      typeof value !== 'number' ||
      def.min === undefined ||
      def.max === undefined ||
      (value >= def.min && value <= def.max);
    check(
      inside && known.has(key),
      `${key} = ${JSON.stringify(value)} (default ${JSON.stringify(def.default)}, range ${def.min} to ${def.max}; ${MECHANISM_CORRECTIONS.some((o) => o.key === key) ? 'read off bench data' : FITTED_KEYS.some((k) => k.key === key) ? 'fitted' : OWNER_CALIBRATED.some((o) => o.key === key) ? "fixed by a wash of the owner's machine" : 'NOT LISTED'})`,
    );
  }
  for (const calibrated of OWNER_CALIBRATED) {
    check(
      set.overrides[calibrated.key] === calibrated.value,
      `${calibrated.key}, fixed by a wash of the owner's machine, is in the set at ${String(calibrated.value)}`,
    );
  }
  for (const correction of MECHANISM_CORRECTIONS) {
    check(
      set.overrides[correction.key] === correction.value,
      `${correction.key}, read off bench data, is in the set`,
    );
  }
  for (const c of eggYolkRates(set)) {
    check(
      c.within,
      `egg-yolk tile (dried) at ${c.temperature} C, pH ${c.pH}, ${c.protease} g/L: ${c.simulated.toFixed(2)} against ${c.rate} +- ${c.tolerance.toFixed(2)} % per minute`,
    );
  }
  for (const s of ikwResidues(set)) {
    check(
      s.residue,
      `IKW programme leaves ${(100 * s.left).toFixed(0)} % of the ${s.soil}${s.untouched ? ' (hardly touched)' : ''}`,
    );
  }
}
const record = JSON.parse(
  readFileSync(
    join(ANCHORS_DIR, 'records', 'std-eu-13.round-robin-ta.detergent-d.literature.json'),
    'utf8',
  ),
) as unknown;
const valid = validateWashRecord(record);
check(
  valid.ok,
  `the literature record is a valid wash record${valid.ok ? '' : `: ${valid.error.map((i) => `${i.path} ${i.message}`).join('; ')}`}`,
);
console.log(
  failures === 0 ? 'anchored set: all checks pass' : `anchored set: ${failures} checks FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
