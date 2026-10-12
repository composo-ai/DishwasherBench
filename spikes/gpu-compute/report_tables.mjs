// Prints Markdown tables from out/*.json so the numbers in RESULTS.md are generated, not retyped.
// Usage: node report_tables.mjs > out/tables.md
import { readFileSync, existsSync } from 'node:fs';
const J = (n) => { const p = new URL('./out/' + n, import.meta.url); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null; };
const f = (x, d = 2) => (x == null || Number.isNaN(x) ? 'n/a' : Math.abs(x) >= 1e9 ? (x / 1e9).toFixed(d) + ' G' : Math.abs(x) >= 1e6 ? (x / 1e6).toFixed(d > 1 ? 1 : d) + ' M' : Math.abs(x) >= 1e3 ? (x / 1e3).toFixed(1) + ' k' : x.toFixed(d));
const p = console.log;

const b1 = J('b1_stencil.json');
if (b1) {
  p('### B1 dispatches-per-submit sweep (storage buffers, 8x8 workgroups; cell-updates/s, best / median of 5)\n');
  p('| dispatches per submit | 1024^2 separate passes | 1024^2 one pass | 2048^2 separate passes | 2048^2 one pass | 4096^2 separate passes | 4096^2 one pass |');
  p('|---|---|---|---|---|---|---|');
  const ks = [...new Set(b1.grids[0].sweep.map((s) => s.k))];
  for (const k of ks) {
    const cells = b1.grids.map((g) => [false, true].map((op) => { const s = g.sweep.find((x) => x.k === k && !!x.onePass === op); return s ? `${f(s.cellUpdatesPerSec.best)} / ${f(s.cellUpdatesPerSec.median)}` : '-'; }).join(' | '));
    p(`| ${k} | ${cells.join(' | ')} |`);
  }
  p('\n### B1 steps/s and spread at the chosen batching (k=32, separate passes)\n');
  p('| grid | cells | steps/s best | steps/s median | spread | cell-updates/s median | GPU-only time per step (timestamp-query) | implied by timestamps |');
  p('|---|---|---|---|---|---|---|---|');
  for (const g of b1.grids) { const s = g.sweep.find((x) => x.k === 32 && !x.onePass); p(`| ${g.w}x${g.h} | ${f(g.cells)} | ${s.stepsPerSec.best.toFixed(1)} | ${s.stepsPerSec.median.toFixed(1)} | ${s.stepsPerSec.spreadPct.toFixed(1)}% | ${f(s.cellUpdatesPerSec.median)} | ${g.gpuTimestamp?.msPerStepBest.toFixed(3)} ms | ${f(g.gpuTimestamp?.cellUpdatesPerSecBest)} |`); }
  p('\n### B1 variants (cell-updates/s, best / median of 5)\n');
  const names = [...new Set(b1.grids.flatMap((g) => g.variants.filter((v) => v.cellUpdatesPerSec).map((v) => v.name)))];
  p('| variant | ' + b1.grids.map((g) => `${g.w}^2`).join(' | ') + ' |'); p('|---|' + b1.grids.map(() => '---').join('|') + '|');
  for (const n of names) p(`| ${n} | ` + b1.grids.map((g) => { const v = g.variants.find((x) => x.name === n); return v ? `${f(v.cellUpdatesPerSec.best)} / ${f(v.cellUpdatesPerSec.median)}` : '-'; }).join(' | ') + ' |');
}
for (const [file, title] of [['b1x_extras.json', 'B1 extras: arithmetic-bound or memory-bound?'], ['b1x_extras_flags.json', 'B1 extras with Dawn robustness disabled']]) {
  const x = J(file); if (!x) continue;
  p(`\n### ${title}${x.dawnFlags ? ' (' + x.dawnFlags + ')' : ''}\n`);
  p('| grid | variant | bytes/cell | cell-updates/s best | median | spread |'); p('|---|---|---|---|---|---|');
  for (const c of x.cases) p(`| ${c.w}x${c.h} | ${c.name} | ${c.bytesPerCell} | ${f(c.cellUpdatesPerSec.best)} | ${f(c.cellUpdatesPerSec.median)} | ${c.cellUpdatesPerSec.spreadPct.toFixed(1)}% |`);
}
const b2 = J('b2_unstructured.json');
if (b2) {
  p('\n### B2 unstructured finite-volume stencil\n');
  p('| cells | ordering | workgroup | mean abs(i - neighbour) | steps/s best | steps/s median | cell-updates/s best | median | spread |'); p('|---|---|---|---|---|---|---|---|---|');
  for (const c of b2.cases) p(`| ${f(c.cells)} | ${c.ordering} | ${c.workgroup} | ${f(c.meanNeighbourIdDistance, 0)} | ${c.stepsPerSec.best.toFixed(1)} | ${c.stepsPerSec.median.toFixed(1)} | ${f(c.cellUpdatesPerSec.best)} | ${f(c.cellUpdatesPerSec.median)} | ${c.stepsPerSec.spreadPct.toFixed(1)}% |`);
}
const b3a = J('b3a_bvh.json');
if (b3a) {
  const s = b3a.scene;
  p(`\n### B3(i) BVH: ${f(s.triangles)} triangles, ${s.objects} objects; build ${s.bvhBuildMsBest.toFixed(0)} ms best / ${s.bvhBuildMsMedian.toFixed(0)} ms median (JS, 1 thread); ${f(s.nodes)} nodes, depth ${s.maxDepth}, ${(s.nodeBytes / 1e6).toFixed(1)} MB nodes + ${(s.triBytes / 1e6).toFixed(1)} MB triangles\n`);
  p('| rays | ray set | workgroup | rays/s best | rays/s median | spread | ms best | hit % | BVH nodes/ray | triangle tests/ray | GPU vs JS disagreements |'); p('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of b3a.cases) p(`| ${f(c.rays)} | ${c.set} | ${c.workgroup} | ${f(c.raysPerSec.best)} | ${f(c.raysPerSec.median)} | ${c.raysPerSec.spreadPct.toFixed(0)}% | ${c.msBest.toFixed(1)} | ${(100 * c.hitFraction).toFixed(1)} | ${c.meanNodeVisits.toFixed(1)} | ${c.meanTriTests.toFixed(1)} | ${c.validation ? c.validation.disagreements + '/' + c.validation.sampled : '-'} |`);
}
const b3b = J('b3b_voxel.json');
if (b3b) {
  p('\n### B3(ii) voxel grids: GPU voxelisation\n');
  p('| grid | voxel | objects | SDF voxelise (GPU) | voxel-object tests/s | occupancy bit-pack | texture->buffer copy | occupied |'); p('|---|---|---|---|---|---|---|---|');
  for (const g of b3b.grids) p(`| ${g.N}^3 | ${g.voxelMm.toFixed(2)} mm | ${g.objects} | ${g.sdfVoxeliseMs.toFixed(0)} ms | ${f(g.voxelObjectEvalsPerSec)} | ${g.occupancyPackMs.toFixed(0)} ms | ${g.texToBufferCopyMs.toFixed(0)} ms | ${(100 * g.occupiedFraction).toFixed(1)}% |`);
  p('\n### B3(ii) voxel grids: rays/s (best / median of 5)\n');
  p('| grid | rays | ray set | kernel | rays/s best | rays/s median | spread | hit % | steps/ray |'); p('|---|---|---|---|---|---|---|---|---|');
  for (const c of b3b.cases) p(`| ${c.grid}^3 | ${f(c.rays)} | ${c.set} | ${c.kernel} | ${f(c.raysPerSec.best)} | ${f(c.raysPerSec.median)} | ${c.raysPerSec.spreadPct.toFixed(0)}% | ${(100 * c.hitFraction).toFixed(1)} | ${c.meanSteps.toFixed(1)} |`);
}
const b4 = J('b4_mpm.json');
if (b4) {
  p('\n### B4 MLS-MPM-style step on a 256^3 grid\n');
  p('| particles | layout | order | accumulation | step ms best | step ms median | particle-steps/s best | median | spread | P2G ms | grid ms | G2P ms |'); p('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of b4.cases) p(`| ${f(c.np)} | ${c.layout} | ${c.order} | ${c.mode === 'fixed' ? 'i32 fixed-point atomicAdd' : 'f32 compare-exchange loop'} | ${c.msPerStepBest.toFixed(2)} | ${c.msPerStepMedian.toFixed(2)} | ${f(c.particleStepsPerSec.best)} | ${f(c.particleStepsPerSec.median)} | ${c.particleStepsPerSec.spreadPct.toFixed(0)}% | ${c.breakdown?.p2gMs.toFixed(2)} | ${c.breakdown?.gridMs.toFixed(2)} | ${c.breakdown?.g2pMs.toFixed(2)} |`);
}
const b5 = J('b5_overheads.json');
if (b5) {
  p('\n### B5 tiny dispatches\n');
  p('| pattern | dispatches/s best | median | microseconds each | spread |'); p('|---|---|---|---|---|');
  for (const t of b5.tiny) p(`| ${t.name} | ${f(t.dispatchesPerSec.best)} | ${f(t.dispatchesPerSec.median)} | ${t.usEachMedian.toFixed(1)} | ${t.dispatchesPerSec.spreadPct.toFixed(0)}% |`);
  p(`\nScalar round trip (dispatch + 16-byte copy + mapAsync): ${b5.scalarRoundTripMs.best.toFixed(3)} ms best, ${b5.scalarRoundTripMs.median.toFixed(3)} ms median, ${b5.scalarRoundTripMs.worst.toFixed(3)} ms worst of ${b5.scalarRoundTripMs.n}.`);
  p(`Cold pipeline creation (B1 WGSL): ${b5.pipelineCreateMs.best.toFixed(1)} ms best, ${b5.pipelineCreateMs.median.toFixed(1)} ms median; first dispatch ${b5.firstDispatchMs?.median.toFixed(1)} ms.`);
  p('\n### B5 readback (ms, best / median of 5)\n');
  p('| size | staging buffer | GPU copy + mapAsync | getMappedRange + copy to JS | total | MB/s (median) | zero-copy view total | data verified |'); p('|---|---|---|---|---|---|---|---|');
  for (const r of b5.readback) for (const m of ['freshStaging', 'reusedStaging']) p(`| ${r.mb} MB | ${m === 'freshStaging' ? 'new each time' : 'reused'} | ${r[m].copyAndMapMs.best.toFixed(1)} / ${r[m].copyAndMapMs.median.toFixed(1)} | ${r[m].getMappedRangeAndSliceMs.best.toFixed(1)} / ${r[m].getMappedRangeAndSliceMs.median.toFixed(1)} | ${r[m].totalMs.best.toFixed(1)} / ${r[m].totalMs.median.toFixed(1)} | ${r[m].MBperSecMedian.toFixed(0)} | ${m === 'reusedStaging' ? r.zeroCopyViewMs.best.toFixed(1) + ' / ' + r.zeroCopyViewMs.median.toFixed(1) : '-'} | ${r.checksumOK} |`);
  p('\n### B5 upload (ms, best / median of 5)\n');
  p('| size | queue.writeBuffer until GPU done | of which the call itself (median) | MB/s | mappedAtCreation + set + unmap | MB/s |'); p('|---|---|---|---|---|---|');
  for (const u of b5.upload) p(`| ${u.mb} MB | ${u.writeBufferMs.best.toFixed(1)} / ${u.writeBufferMs.median.toFixed(1)} | ${u.writeBufferCallMs.median.toFixed(1)} | ${u.writeBufferMBps.toFixed(0)} | ${u.mappedAtCreationMs.best.toFixed(1)} / ${u.mappedAtCreationMs.median.toFixed(1)} | ${u.mappedAtCreationMBps.toFixed(0)} |`);
}
const b6 = J('b6_cpu_js.json');
if (b6) {
  p('\n### B6 CPU baselines, JavaScript, 2048x2048\n');
  p('| implementation | variant | threads | cell-updates/s best | median | spread | identical to 1-thread result |'); p('|---|---|---|---|---|---|---|');
  for (const c of b6.cases) p(`| ${c.impl} | ${c.variant} | ${c.threads} | ${f(c.cellUpdatesPerSec.best, 1)} | ${f(c.cellUpdatesPerSec.median, 1)} | ${c.spreadPct.toFixed(0)}% | ${c.matchesSingleThread ?? '-'} |`);
}
{
  const p6 = new URL('./out/b6_c.log', import.meta.url);
  if (existsSync(p6)) {
    p('\n### B6 CPU baselines, C (clang 16, -O3 -mcpu=native, GCD dispatch_apply), 2048x2048\n');
    p('| FP mode | threads | cell-updates/s best | median | worst |'); p('|---|---|---|---|---|');
    const label = { strict: '-ffp-contract=off (strict IEEE, no FMA)', default: 'clang default (fp-contract=on)', fast: '-ffast-math (reference only)' };
    for (const line of readFileSync(p6, 'utf8').split('\n')) { const m = line.match(/^(\w+) threads=(\d+) (\{.*\})/); if (!m) continue; const j = JSON.parse(m[3]); p(`| ${label[m[1]]} | ${m[2]} | ${f(j.best, 1)} | ${f(j.median, 1)} | ${f(j.worst, 1)} |`); }
  }
}
const b7 = J('b7_determinism.json');
if (b7) {
  p('\n### B7 determinism\n');
  p(`B1 ${b7.b1.baseline.w}x${b7.b1.baseline.h}, ${b7.b1.baseline.steps} steps, hash ${b7.b1.baseline.hash}\n`);
  p('| B1 comparison against the baseline run | result |'); p('|---|---|');
  for (const c of b7.b1.checks) p(`| ${c.name} | ${c.identical ? 'bitwise identical' : `differs: ${c.differingFloats} of ${c.ofFloats} floats, max abs diff ${c.maxAbsDiff.toExponential(2)}`} |`);
  p(`| a separate node process | ${b7.crossProcess.b1Identical ? 'bitwise identical' : 'differs'} |`);
  p(`\nAfter one step, GPU vs JS f32 reference: ${b7.b1.firstStepVsJS.differingFloats} of ${b7.b1.firstStepVsJS.ofFloats} floats differ, max abs diff ${b7.b1.firstStepVsJS.maxAbsDiff.toExponential(2)}.\n`);
  p('| B4 comparison | result |'); p('|---|---|');
  for (const c of b7.b4.checks) p(`| ${c.name} | ${c.identical ? 'bitwise identical' : `differs: ${c.differingFloats} of ${c.ofFloats} floats, max abs diff ${c.maxAbsDiff.toExponential(2)}`} |`);
  p(`| fixed-point, a separate node process | ${b7.crossProcess.b4Identical ? 'bitwise identical' : 'differs'} |`);
}
for (const file of ['b8_sustained_2048.json', 'b8_sustained_2048_run2.json']) {
  const s = J(file); if (!s) continue;
  const m = s.summary;
  p(`\n### B8 sustained load (${file}): ${s.grid}x${s.grid}, ${m.seconds.toFixed(0)} s, ${s.power}\n`);
  p(`first 10 s ${f(m.first)}, minimum ${f(m.min)} (${m.minOverFirstPct.toFixed(0)}% of first), maximum ${f(m.max)}, mean ${f(m.mean)}, last ${f(m.last)} (${m.lastOverFirstPct.toFixed(0)}% of first); total ${f(m.totalCellUpdates)} cell-updates; rss ${m.rssFirstMB.toFixed(0)} -> ${m.rssLastMB.toFixed(0)} MB; device lost: ${JSON.stringify(m.deviceLost)}; uncaptured errors: ${m.uncapturedErrors}\n`);
  p('| t (s) | steps/s | cell-updates/s | GPU-only ms/step | rss MB | thermal warning | other busy processes |'); p('|---|---|---|---|---|---|---|');
  for (const x of s.samples) p(`| ${x.tSec.toFixed(0)} | ${x.stepsPerSec.toFixed(1)} | ${f(x.cellUpdatesPerSec)} | ${x.gpuMsPerStep?.toFixed(3) ?? 'not logged'} | ${x.rssMB.toFixed(0)} | ${x.therm?.warning ?? 'n/a'} | ${x.otherBusyProcesses ?? 'not logged'} |`);
}
const soak = J('b8d_soak_mpm.json');
if (soak) {
  const m = soak.summary;
  p(`\n### B8 soak of the B4 particle pipeline: ${f(soak.particles)} particles, 256^3 grid, ${m.seconds.toFixed(0)} s, ${soak.power}\n`);
  p(`total ${m.totalSteps} steps = ${f(m.totalParticleSteps)} particle-steps; first 30 s ${f(m.first)}, minimum ${f(m.min)}, maximum ${f(m.max)}, mean ${f(m.mean)}, last ${f(m.last)} particle-steps/s; rss ${m.rssFirstMB.toFixed(0)} -> ${m.rssLastMB.toFixed(0)} MB; all probes finite: ${m.allFinite}; device lost: ${JSON.stringify(m.deviceLost)}; uncaptured errors: ${m.uncapturedErrors}\n`);
  p('| t (s) | steps/s | particle-steps/s | rss MB | probe finite | mean z of probe | other busy processes |'); p('|---|---|---|---|---|---|---|');
  for (const x of soak.samples) p(`| ${x.tSec.toFixed(0)} | ${x.stepsPerSec.toFixed(1)} | ${f(x.particleStepsPerSec)} | ${x.rssMB.toFixed(0)} | ${x.finite} | ${x.meanZ.toFixed(3)} | ${x.otherBusyProcesses} |`);
}
const mem = J('b8_memory.json');
if (mem) {
  p('\n### B8 memory: growing set of 512 MB buffers\n');
  p(`start: available ${mem.start.availableGB?.toFixed(1)} GB, wired ${mem.start.wiredGB?.toFixed(1)} GB, swap used ${mem.start.swapUsedGB?.toFixed(2)} GB, system free ${mem.start.freePct}%\n`);
  p('| total | buffers | alloc + first touch | ring passes (ms) | traffic GB/s per pass | verified | swap used after | available after | wired after | error |'); p('|---|---|---|---|---|---|---|---|---|---|');
  for (const s of mem.stages) p(`| ${s.totalGB} GB | ${s.buffers} | ${s.allocAndFirstTouchMs?.toFixed(0)} ms | ${s.ringPassMs?.map((x) => x.toFixed(0)).join(' / ') ?? '-'} | ${s.trafficGBps?.map((x) => x.toFixed(1)).join(' / ') ?? '-'} | ${s.verified ?? '-'} | ${s.memAfter?.swapUsedGB?.toFixed(2) ?? '-'} GB | ${s.memAfter?.availableGB?.toFixed(1) ?? '-'} GB | ${s.memAfter?.wiredGB?.toFixed(1) ?? '-'} GB | ${s.error ?? ''} |`);
  p(`\nstopped escalating because: ${mem.stoppedBecause ?? 'reached the requested maximum'}; device lost: ${JSON.stringify(mem.deviceLost)}; uncaptured errors: ${mem.uncapturedErrors.length}\n`);
  if (mem.single.length) {
    p('| single buffer | first fill | refill | last-element check | error |'); p('|---|---|---|---|---|');
    for (const s of mem.single) p(`| ${s.sizeGB} GB | ${s.fillMs ? s.fillMs.toFixed(0) + ' ms (' + s.fillGBps.toFixed(1) + ' GB/s)' : '-'} | ${s.refillMs ? s.refillMs.toFixed(0) + ' ms (' + s.refillGBps.toFixed(1) + ' GB/s)' : '-'} | ${s.verified ?? '-'} | ${s.error ?? ''} |`);
  }
}
const big = J('b8_bigbuffer.json');
if (big) {
  p('\n### B8 the 4 GiB boundary (whole-buffer binding as array<u32>)\n');
  p('| buffer size | bytes | arrayLength seen by the shader | expected | probes read back correctly | 64 MB window bound past 4 GiB |'); p('|---|---|---|---|---|---|');
  for (const c of big.cases) p(`| ${c.label} | ${c.bytes} | ${c.arrayLengthSeen ?? '-'} | ${c.arrayLengthExpected ?? '-'} | ${c.createError ? 'create failed: ' + c.createError : c.allOk} | ${c.window ? (c.window.ok ? 'correct' : 'wrong') : '-'} |`);
}
const chash = J('b9b_chrome_hash.json');
if (chash) p(`\n### B9b Chrome against Node bit comparison\n\n${chash.chrome}: hashes ${chash.chromeHashes.join(', ')}; Node/Dawn hash ${chash.nodeDawnHash}; equal: ${chash.chromeEqualsNodeDawn}\n`);
for (const file of ['b9_chrome_headless.json', 'b9_chrome_headful.json']) {
  const c = J(file); if (!c) continue;
  p(`\n### B9 Chrome (${file})\n`);
  for (const a of c.attempts) {
    p(`**${a.label}** - ${a.chromeVersion ?? ''}`);
    if (a.error || a.result?.error) { p(`failed: ${a.error ?? a.result.error}\n`); continue; }
    const r = a.result;
    p(`adapter ${JSON.stringify(r.adapter)}; maxBufferSize ${r.limits.maxBufferSize}; maxStorageBufferBindingSize ${r.limits.maxStorageBufferBindingSize}; features: ${r.features.join(', ')}\n`);
    p('| grid | formulation | cell-updates/s best | median | note |'); p('|---|---|---|---|---|');
    for (const x of r.cases) p(`| ${x.w}x${x.h} | ${x.kind} | ${x.cellUpdatesPerSec ? f(x.cellUpdatesPerSec.best) : '-'} | ${x.cellUpdatesPerSec ? f(x.cellUpdatesPerSec.median) : '-'} | ${x.error ?? x.skipped ?? ''} |`);
    p('');
  }
}
