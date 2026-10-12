/**
 * Writes the literature wash record of STD-EU-13 (`anchors/records/`) and checks it with the
 * calibration tool: validation of the record, the machine it gives, and the programme adapted
 * to the stated course.
 *
 *   pnpm --filter @spotless/calibration exec tsx anchors/scripts/make-records.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { machineOfRecord, programmeOfRecord, validateWashRecord } from '../../src/index.ts';
import { stdEu13LiteratureRecord } from '../src/literature.ts';
import { ANCHORS_DIR } from '../src/scenario.ts';

const record = stdEu13LiteratureRecord();
const directory = join(ANCHORS_DIR, 'records');
mkdirSync(directory, { recursive: true });
const file = join(directory, `${record.id}.literature.json`);
writeFileSync(file, `${JSON.stringify(record, null, 1)}\n`);

const checked = validateWashRecord(JSON.parse(JSON.stringify(record)) as unknown);
if (!checked.ok) {
  for (const issue of checked.error) console.error(`${issue.path}: ${issue.message}`);
  throw new Error(`${file} is not a valid wash record`);
}
const machine = machineOfRecord(checked.value);
const programme = programmeOfRecord(checked.value, machine.spec, machine.config);
console.log(`wrote ${file}`);
console.log(
  `valid wash record: ${checked.value.load.items.length} items, ${checked.value.observations.length} observations, ${record.aggregates.length} aggregates`,
);
for (const change of machine.changes) console.log(`machine: ${change}`);
for (const change of programme.changes) {
  console.log(
    `programme: ${change.step} ${change.field} ${change.from} -> ${change.to} (${change.source})`,
  );
}
for (const note of programme.notes) console.log(`programme note: ${note}`);
for (const aggregate of record.aggregates) console.log(JSON.stringify(aggregate));
