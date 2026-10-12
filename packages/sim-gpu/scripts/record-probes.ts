// Records the determinism probes of the current GPU stack into probes/<stack>.json and prints
// what they say about the stack's shader compiler (docs/design/sim-core.md section M1,
// "Determinism probes"; rule 13: re-record after an operating-system or bindings update).
//
//   pnpm --filter @spotless/sim-gpu run record-probes            record (refuses to overwrite a
//                                                                 file whose hashes differ)
//   pnpm --filter @spotless/sim-gpu run record-probes -- --force  overwrite
//   pnpm --filter @spotless/sim-gpu run record-probes -- --check  compare only, write nothing
import { OP_CLASSES } from '../src/index.ts';
import { createNodeGpuContext, readProbeRecord, writeProbeRecord } from '../src/node/index.ts';
import { compareProbeRecords, compilerBehaviour, runProbes } from '../src/probes.ts';
import { gpuStackKey } from '../src/stack.ts';

const force = process.argv.includes('--force');
const check = process.argv.includes('--check');

const ctx = await createNodeGpuContext();
const record = await runProbes(ctx);
await ctx.drain();
ctx.destroy();

console.log(`stack: ${gpuStackKey(record.stack)}`);
for (const op of OP_CLASSES) console.log(`  ${op.padEnd(8)} ${record.probes[op].hash}`);
console.log('\nWhat this stack does:');
for (const sentence of compilerBehaviour(record).sentences) console.log(`  - ${sentence}`);

const recorded = readProbeRecord(record.stack);
let status = 0;
if (recorded === null) {
  if (check) {
    console.log('\nNo probe file exists for this stack.');
    status = 1;
  } else {
    console.log(`\nRecorded: ${writeProbeRecord(record)}`);
  }
} else {
  const { changed, probeEdited } = compareProbeRecords(recorded, record);
  if (changed.length === 0 && probeEdited.length === 0) {
    console.log('\nIdentical to the recorded file for this stack.');
  } else {
    if (changed.length > 0) {
      console.log(`\nBITS CHANGED on an unchanged stack string in: ${changed.join(', ')}`);
      console.log(
        'Kernels that declare these classes are affected (rule 9); for a context with the ' +
          'simulation kernels registered, GpuContext.kernelsUsing(changed) names them.',
      );
    }
    if (probeEdited.length > 0) {
      console.log(`\nProbe source changed since the recording: ${probeEdited.join(', ')}`);
    }
    if (force && !check) console.log(`Overwritten: ${writeProbeRecord(record)}`);
    else {
      console.log('Nothing written (pass --force to overwrite).');
      status = 1;
    }
  }
}
process.exit(status);
