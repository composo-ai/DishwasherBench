#!/usr/bin/env node
// CLI: node src/run.mjs <engine> <preset> <test[,test...]> [dt=240] [tag=name] [cfgKey=value ...] [s.sceneKey=value ...]
//   engine: rapier | jolt | mujoco | physx        preset: see PRESETS in src/engines/<engine>.mjs
//   tests : T1 T2 T3 T4 T5 T6 T7 T8 T9 (or "all")
// Results are written to results/<engine>__<preset>__<test>__dt<hz>[__tag].json
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TESTS } from './tests.mjs';
import { ENGINES } from './harness.mjs';

const [engine, preset, testArg, ...tail] = process.argv.slice(2);
if (!engine || !preset || !testArg) {
  console.error('usage: node src/run.mjs <engine> <preset> <tests> [dt=240] [tag=x] [key=value] [s.key=value]');
  process.exit(2);
}
const parse = (v) => (v === 'true' ? true : v === 'false' ? false : v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v);
const kv = Object.fromEntries(tail.map((s) => { const i = s.indexOf('='); return [s.slice(0, i), parse(s.slice(i + 1))]; }));
const hz = kv.dt ?? 240;
const tag = kv.tag;
const so = Object.fromEntries(Object.entries(kv).filter(([k]) => k.startsWith('s.')).map(([k, v]) => [k.slice(2), v]));
const over = Object.fromEntries(Object.entries(kv).filter(([k]) => !k.startsWith('s.') && k !== 'dt' && k !== 'tag'));
const mod = await ENGINES[engine]();
if (!mod.PRESETS[preset]) throw new Error(`unknown preset ${preset} for ${engine}: ${Object.keys(mod.PRESETS)}`);
const cfg = { ...mod.PRESETS[preset], ...over, dt: 1 / hz };
const tests = testArg === 'all' ? ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9'] : testArg.split(',');
const outDir = fileURLToPath(new URL('../results/', import.meta.url));
mkdirSync(outDir, { recursive: true });
for (const t of tests) {
  const t0 = performance.now();
  const res = await TESTS[t]({ engine, preset, cfg, so, argvTail: tail, ccdVariants: mod.CCD_VARIANTS });
  const wallS = (performance.now() - t0) / 1000;
  if (res.printLast) {
    console.log(JSON.stringify(res.printLast));
    continue;
  }
  const doc = { engine, preset, test: t, hz, tag: tag ?? null, cfg, sceneOpts: so, wallSeconds: wallS, node: process.version, when: new Date().toISOString(), summary: res.summary, runs: res.runs };
  const file = `${outDir}${engine}__${preset}__${t}__dt${hz}${tag ? `__${tag}` : ''}.json`;
  writeFileSync(file, JSON.stringify(doc, null, 1));
  console.log(`### ${engine}/${preset} ${t} dt=1/${hz}${tag ? ` [${tag}]` : ''}  (${wallS.toFixed(1)} s wall)`);
  console.log(JSON.stringify(res.summary, (k, v) => (typeof v === 'number' ? +v.toPrecision(5) : k === 'detail' ? undefined : v), 1));
}
