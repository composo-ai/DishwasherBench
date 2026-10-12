// Worker for the B6 multi-threaded JS baseline: persistent thread, woken through Atomics, steps a horizontal band of the grid.
import { workerData } from 'node:worker_threads';
import { jsStepF32, jsStepF64 } from './stencil_js.mjs';

const { sabA, sabB, sabCtl, w, h, y0, y1, variant } = workerData;
const a = new Float32Array(sabA), b = new Float32Array(sabB), ctl = new Int32Array(sabCtl);
const step = variant === 'f32' ? jsStepF32 : jsStepF64;
let gen = 0;
for (;;) {
  Atomics.wait(ctl, 0, gen);
  gen = Atomics.load(ctl, 0);
  if (Atomics.load(ctl, 2)) break;
  if (gen & 1) step(a, b, w, h, y0, y1); else step(b, a, w, h, y0, y1);
  Atomics.add(ctl, 1, 1);
  Atomics.notify(ctl, 1);
}
