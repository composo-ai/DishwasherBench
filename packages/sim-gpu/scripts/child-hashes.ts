// Prints, as one line of JSON, hashes of GPU results computed in this process: the spike's B1
// stencil and every determinism probe. The test `second-process.gpu.test.ts` runs it as a child
// and compares the line with what the test process computed (docs/design/sim-core.md section 6,
// acceptance test `second-process`).
import { OP_CLASSES } from '../src/index.ts';
import { createNodeGpuContext } from '../src/node/index.ts';
import { spikeHashHex } from '../src/hash.ts';
import { runProbes } from '../src/probes.ts';
import { runStencil } from '../src/testing/index.ts';

const ctx = await createNodeGpuContext();
const stencil = spikeHashHex(await runStencil(ctx, { w: 1024, h: 1024, steps: 200 }));
const record = await runProbes(ctx);
ctx.destroy();
console.log(
  JSON.stringify({
    stencil,
    probes: Object.fromEntries(OP_CLASSES.map((op) => [op, record.probes[op].hash])),
  }),
);
process.exit(0);
