// Parameter sweep helper: node src/tune.mjs <engine> <tests,comma> <hz> '<json cfg>' ['<json cfg>' ...]
// Prints one compact line per (config, test). Used to arrive at the "tuned" presets.
import { simulate } from './harness.mjs';
import { SCENES } from './scenes.mjs';
const [engine, tests, hz, ...cfgs] = process.argv.slice(2);
const mod = await import(`./engines/${engine}.mjs`);
for (const c of cfgs) {
  const over = JSON.parse(c);
  const { preset = 'default', ...rest } = over;
  const cfg = { ...mod.PRESETS[preset], ...rest, dt: 1 / +hz };
  for (const t of tests.split(',')) {
    try {
      const { result: r } = await simulate(engine, SCENES[t]({}), cfg, { measureHz: 30 });
      const p = r.pen;
      console.log(`${engine} ${c} ${t}@${hz}: rest=${r.restTime?.toFixed(2) ?? 'NEVER'} rmsV=${r.rmsLin_mm_s.toFixed(2)}mm/s penS max/final=${p.maxStatic_mm.toFixed(2)}/${p.finalStatic_mm.toFixed(3)} penD max/final=${p.maxDynamic_mm.toFixed(2)}/${p.finalDynamic_mm.toFixed(3)} drift=${r.drift.pos_mm.toFixed(3)}mm/${r.drift.ang_deg.toFixed(3)}deg asleep=${r.sleep.asleepAtEnd}/${r.sleep.of} step=${r.step.meanMs.toFixed(3)}/${r.step.p99Ms.toFixed(2)}/${r.step.maxMs.toFixed(0)}ms${r.exploded ? ' EXPLODED ' + JSON.stringify(r.exploded) : ''}`);
    } catch (e) {
      console.log(`${engine} ${c} ${t}@${hz}: ERROR ${String(e).slice(0, 200)}`);
    }
  }
}
