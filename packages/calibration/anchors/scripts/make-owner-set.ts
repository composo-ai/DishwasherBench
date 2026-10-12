/**
 * Writes the owner-capsule layer of an anchored set: the anchored set with the owner's
 * detergent laid over it, for washes on his machine (the game's default set).
 *
 *   cd packages/calibration
 *   pnpm exec tsx anchors/scripts/make-owner-set.ts [--params anchors/<current set>.json]
 *        [--detergent detergents/finish-powerball-ultimate.json]
 *
 * `<name>.owner-capsule.json` holds the overrides of the anchored set without the protease
 * level fitted for reference detergent D, the composition of the detergent file (desk research,
 * `docs/research/detergent-finish-ultimate.md`) and the protease level of a premium unit dose
 * (`OWNER_CAPSULE` of `src/anchored.ts`). Its protease is as stable as the registry says
 * (30 min at 60 C and pH 10.5, longer in the capsule's milder liquor).
 * `<name>.owner-capsule.stable.json` adds the upper end of the bracket for the half-life, an
 * ASSUMPTION (`OWNER_CAPSULE_STABLE`). The dose of the capsule (12.9 g) is a value of the
 * machine, not a parameter: a wash with either set must be given it (`study.ts`, `dose_g`).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { createWashParams, washRegistry, type ParamValue } from '@spotless/sim-core';
import { readParamSet } from '@spotless/sim-params';
import {
  OWNER_CALIBRATED,
  OWNER_CAPSULE,
  OWNER_CAPSULE_STABLE,
  OWNER_TABLET_DOSE,
} from '../src/anchored.ts';
import { ANCHORS_DIR, CURRENT_ANCHORED } from '../src/scenario.ts';
import { readOverrides } from '../src/sets.ts';

const origin = process.env['INIT_CWD'] ?? process.cwd();
const fromOrigin = (path: string): string => (isAbsolute(path) ? path : join(origin, path));
const args = process.argv.slice(2).filter((a) => a !== '--');
const option = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const anchoredFile = fromOrigin(
  option('--params') ?? join(ANCHORS_DIR, `${CURRENT_ANCHORED}.json`),
);
const detergentFile = fromOrigin(
  option('--detergent') ?? join(ANCHORS_DIR, '..', 'detergents', 'finish-powerball-ultimate.json'),
);
const anchoredDocument = JSON.parse(readFileSync(anchoredFile, 'utf8')) as {
  provenance: { name: string; washRecords?: string[] };
  anchoredOn?: unknown;
};
const anchored = readOverrides(anchoredFile);
// A detergent file is a composition, not a fit: it is read leniently, so that a change of the
// registry elsewhere does not stop it (regenerate-detergents.ts writes it again).
const detergent = readOverrides(detergentFile, true);
const asRecord = (list: typeof OWNER_CAPSULE): Record<string, ParamValue> =>
  Object.fromEntries(list.map((o) => [o.key, o.value]));
// The protease level fitted for reference detergent D is a property of that product: the
// capsule has its own (OWNER_CAPSULE), over the composition of the detergent file.
const composition: Record<string, ParamValue> = {
  ...anchored,
  ...detergent,
  ...asRecord(OWNER_CAPSULE),
};

function write(suffix: string, overrides: Record<string, ParamValue>, note: string): void {
  const name = `${anchoredDocument.provenance.name}.${suffix}`;
  const set = createWashParams(overrides, {
    name,
    origin: 'calibration',
    note,
    washRecords: anchoredDocument.provenance.washRecords ?? [],
    createdAt: new Date().toISOString(),
  });
  const document = { ...set.toJSON(), anchoredOn: anchoredDocument.anchoredOn };
  const back = readParamSet(washRegistry(), JSON.parse(JSON.stringify(document)) as unknown);
  if (!back.ok) throw new Error(`${name} does not read back: ${JSON.stringify(back.error)}`);
  writeFileSync(join(ANCHORS_DIR, `${name}.json`), `${JSON.stringify(document, null, 1)}\n`);
  console.log(`wrote ${name}.json (${Object.keys(overrides).length} overrides)`);
}

const basis = `The anchored set ${anchoredDocument.provenance.name} (docs/calibration/anchoring.md) with the owner's capsule laid over it: the composition of detergents/finish-powerball-ultimate.json (Finish Powerball Ultimate, desk research, nothing measured: docs/research/detergent-finish-ultimate.md) and the protease level of a premium unit dose (${OWNER_CAPSULE.map((o) => `${o.key} = ${String(o.value)}`).join(', ')}; estimated from the active protease of a premium unit dose in its maker's patents, not this product's). Wash with a dose of ${OWNER_TABLET_DOSE * 1000} g (dosing.detergentMass, a machine value).${
  OWNER_CALIBRATED.length > 0
    ? ` Calibrated on the owner's own machine (docs/calibration/owner-wash-01-calibration.md; wash record owner-wash-01-egg-yolk-eco50, one wash of four plates): ${OWNER_CALIBRATED.map((o) => `${o.key} = ${String(o.value)}`).join(', ')}, held in the anchored set this layer is laid over.`
    : ''
}`;
write(
  'owner-capsule',
  composition,
  `${basis} The protease is as stable as the registry says (liq.proteaseHalfLife 30 min at 60 C and pH 10.5, 1.7 times as long at the capsule's pH 10.1). No measurement of the capsule's protease exists: this is the lower end of a bracket whose upper end is the set with the suffix "stable".`,
);
write(
  'owner-capsule.stable',
  { ...composition, ...asRecord(OWNER_CAPSULE_STABLE) },
  `${basis} ASSUMPTION, labelled as one: a heat-stable protease (${OWNER_CAPSULE_STABLE.map((o) => `${o.key} = ${String(o.value)}`).join(', ')}). No source gives the number; the upper end of the bracket.`,
);
