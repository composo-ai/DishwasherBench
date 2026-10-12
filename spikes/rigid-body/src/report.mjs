// Build Markdown tables (results/tables.md) from the JSON files in results/.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../results/', import.meta.url));
const docs = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({ file: f, ...JSON.parse(readFileSync(dir + f, 'utf8')) }));
const ENG = ['jolt', 'mujoco', 'physx', 'rapier'];
const get = (engine, preset, test, hz = 240, tag = null) => docs.find((d) => d.engine === engine && d.preset === preset && d.test === test && d.hz === hz && (d.tag ?? null) === tag);
const n = (x, d = 2) => (x == null || Number.isNaN(x) ? 'n/a' : typeof x !== 'number' ? String(x) : x === 0 ? '0' : Math.abs(x) < 0.5 * 10 ** -d ? `<${(10 ** -d).toFixed(d)}` : x.toFixed(d));
const rest = (x) => (x == null ? '**never**' : x.toFixed(2));
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const out = [];
const H = (s) => out.push(`\n### ${s}\n`);
const PRESETS = { jolt: ['default', 'tuned', 'tuned-ccd'], mujoco: ['default', 'tuned', 'tuned-noslip'], physx: ['default', 'tuned'], rapier: ['default', 'tuned', 'small', 'scaled'] };
const each = (fn) => {
  const rows = [];
  for (const e of ENG) for (const p of PRESETS[e]) { const r = fn(e, p); if (r) rows.push(...(Array.isArray(r[0]) ? r : [r])); }
  return rows;
};

// ---- T1
H('T1 single plate (dt = 1/240 s, 5 s)');
out.push(table(
  ['engine / preset', 'time to rest s', 'lean from vertical deg', 'COM y mm', 'rms v last 1 s mm/s', 'rms w rad/s', 'residual KE uJ', 'max pen mm', 'final pen mm', 'asleep at s', 'step mean ms'],
  each((e, p) => { const d = get(e, p, 'T1'); if (!d) return null; const s = d.summary; return [`${e} / ${p}`, rest(s.restTime_s), n(s.lean_deg), n(s.pos_mm[1]), n(s.rmsLin_mm_s, 3), n(s.rmsAng_rad_s, 4), n(s.residualKE_uJ, 3), n(s.penMaxStatic_mm, 3), n(s.penFinalStatic_mm, 3), s.allAsleepAt_s == null ? 'no' : n(s.allAsleepAt_s), n(s.stepMean_ms, 3)]; }),
));

// ---- T2
H('T2 twelve plates (dt = 1/240 s, 10 s)');
out.push(table(
  ['engine / preset', 'exploded', 'time to rest s', 'lean min..max deg', 'max pen wires mm', 'final pen wires mm', 'max pen plate-plate mm', 'drift 5-10 s mm / deg (sleep on)', 'drift 5-10 s mm / deg (sleep off)', 'rms v mm/s (sleep off)', 'sum of step time ms (2400 steps)'],
  each((e, p) => { const d = get(e, p, 'T2'); if (!d) return null; const s = d.summary; const ns = get(e, p, 'T2', 240, 'nosleep')?.summary; return [`${e} / ${p}`, s.exploded ? 'YES' : 'no', rest(s.restTime_s), `${n(s.leanMin_deg)}..${n(s.leanMax_deg)}`, n(s.penMaxStatic_mm, 3), n(s.penFinalStatic_mm, 3), n(s.penMaxDynamic_mm, 3), `${n(s.driftPos_mm, 3)} / ${n(s.driftAng_deg, 3)}`, ns ? `${n(ns.driftPos_mm, 3)} / ${n(ns.driftAng_deg, 3)}` : 'not run', ns ? n(ns.rmsLin_mm_s, 3) : 'not run', n(s.stepTotal_ms, 0)]; }),
));

// ---- T3
H('T3 four nested bowls (dt = 1/240 s, 8 s); ideal smooth-surface nest spacing 19.40 mm');
out.push(table(
  ['engine / preset', 'facets', 'time to rest s', 'spacing 1-2-3 mm', 'sink vs ideal mm (+ = sunk)', 'max bowl-bowl pen mm', 'final bowl-bowl pen mm', 'final pen wires mm', 'max tilt deg', 'rms v mm/s', 'drift 4-8 s mm', 'asleep'],
  each((e, p) => { const d = get(e, p, 'T3'); if (!d) return null; return ['facetsMisaligned', 'facetsAligned'].map((k) => { const s = d.summary[k]; return [`${e} / ${p}`, k === 'facetsAligned' ? 'aligned' : 'rotated', rest(s.restTime_s), s.spacing_mm.map((x) => n(x)).join(' / '), s.sink_mm.map((x) => n(x)).join(' / '), n(s.penMaxDynamic_mm, 3), n(s.penFinalDynamic_mm, 3), n(s.penFinalStatic_mm, 3), n(s.maxTilt_deg), n(s.rmsLin_mm_s, 3), n(s.driftPos_mm, 3), s.asleep]; }); }),
));

// ---- T4
H('T4a tumbler inverted over two tines, started at 15 deg (dt = 1/240 s, 6 s)');
out.push(table(
  ['engine / preset', 'time to rest s', 'final axis from vertical deg', 'max pen mm', 'final pen mm', 'rms v mm/s', 'drift 3-6 s mm / deg', 'drift, sleep off mm / deg', 'asleep'],
  each((e, p) => { const d = get(e, p, 'T4'); if (!d) return null; const s = d.summary.tumbler; const ns = get(e, p, 'T4', 240, 'nosleep')?.summary.tumbler; return [`${e} / ${p}`, rest(s.restTime_s), n(s.axisFromVertical_deg), n(s.penMaxStatic_mm, 3), n(s.penFinalStatic_mm, 3), n(s.rmsLin_mm_s, 3), `${n(s.driftPos_mm, 3)} / ${n(s.driftAng_deg, 3)}`, ns ? `${n(ns.driftPos_mm, 3)} / ${n(ns.driftAng_deg, 3)}` : 'not run', s.asleep]; }),
));
H('T4b mug inverted on a 12 deg wire shelf (tan 12 deg = 0.213; must not slide for mu = 0.4 or 0.3); 10 s');
out.push(table(
  ['engine / preset', 'mu', 'time to rest s', 'slide 1-10 s mm (sleep on)', 'slide 1-10 s mm (sleep off)', 'slide rate mm/s (sleep off)', 'final pen mm', 'asleep'],
  each((e, p) => { const d = get(e, p, 'T4'); if (!d) return null; return ['mug_mu0.4', 'mug_mu0.3'].map((k) => { const s = d.summary[k]; const ns = get(e, p, 'T4', 240, 'nosleep')?.summary[k]; return [`${e} / ${p}`, k.slice(6), rest(s.restTime_s), n(s.slideDownhill_1s_to_10s_mm, 3), ns ? n(ns.slideDownhill_1s_to_10s_mm, 3) : 'not run', ns ? n(ns.slideRate_mm_s, 4) : 'not run', n(s.penFinalStatic_mm, 3), s.asleep]; }); }),
));

// ---- T5
H('T5 twenty cutlery pieces into ten basket cells (dt = 1/240 s, 6 s)');
out.push(table(
  ['engine / preset', 'exploded', 'time to rest s', 'pieces outside own cell / below floor: ever', 'at end', 'worst excursion mm', 'max pen walls mm', 'final pen walls mm', 'max pen piece-piece mm', 'final pen piece-piece mm', 'lean from vertical min / median / max deg', 'max speed m/s'],
  each((e, p) => { const d = get(e, p, 'T5'); if (!d) return null; const s = d.summary; return [`${e} / ${p}`, s.exploded ? 'YES' : 'no', rest(s.restTime_s), s.tunnelledDuring, s.tunnelledFinal, n(s.worstExcursion_mm), n(s.penMaxStatic_mm, 3), n(s.penFinalStatic_mm, 3), n(s.penMaxDynamic_mm, 3), n(s.penFinalDynamic_mm, 3), `${n(s.leanFromVertical_deg.min, 1)} / ${n(s.leanFromVertical_deg.median, 1)} / ${n(s.leanFromVertical_deg.max, 1)}`, n(s.maxSpeed_m_s)]; }),
));

// ---- T6
H('T6 thin-feature tunnelling: "x/4" = runs (of 4 start heights) in which the object went straight through; (max penetration mm); "+k fell off" = bounced and later dropped off the two wires (not a tunnelling event)');
{
  const rows = [];
  for (const e of ENG) for (const p of ['default', 'tuned', 'scaled']) for (const tag of [null, 'dtsweep']) {
    const d = get(e, p, 'T6', 240, tag);
    if (!d) continue;
    const groups = {};
    for (const [k, v] of Object.entries(d.summary)) {
      const m = k.match(/^(.*)@1\/(\d+)-(.*)$/);
      const key = `${m[2]}|${m[3]}`;
      (groups[key] ??= {})[m[1]] = v;
    }
    for (const [key, g] of Object.entries(groups)) {
      const [hz, mode] = key.split('|');
      const c = (k) => (g[k] ? `${g[k].passedThrough} (${n(g[k].penMax_mm, 1)})${g[k].fellOffLater ? ` +${g[k].fellOffLater} fell off` : ''}` : 'n/a');
      const pl = g['plate-flat-2mps'];
      rows.push([`${e} / ${p}`, `1/${hz}`, mode, c('knife-edge-2mps'), c('knife-edge-5mps'), c('knife-flat-2mps'), c('knife-flat-5mps'), pl ? `${pl.passedThrough} through, ${pl.impaled} impaled (${n(pl.penMax_mm, 1)})` : 'n/a']);
    }
  }
  out.push(table(['engine / preset', 'dt', 'CCD mode', 'knife edge-on 2 m/s', 'knife edge-on 5 m/s', 'knife flat 2 m/s', 'knife flat 5 m/s', 'plate flat on tine tips 2 m/s'], rows));
}

// ---- T7
H('T7 determinism (T2 scene, 10 s, hash of all positions, rotations and velocities)');
{
  const rows = [];
  for (const d of docs.filter((x) => x.test === 'T7')) {
    const s = d.summary;
    const r = s.snapshotReplay ?? {};
    rows.push([`${d.engine} / ${d.preset}${d.tag ? ` [${d.tag}]` : ''}`, s.sameProcessIdentical ? 'identical' : '**DIFFERENT**', s.freshProcessIdentical == null ? 'n/a' : s.freshProcessIdentical ? 'identical' : '**DIFFERENT**', s.hashA, r.error ? `error: ${r.error.slice(0, 60)}` : r.identical ? 'identical' : '**DIFFERENT**', r.snapshotBytes == null ? 'n/a' : `${(r.snapshotBytes / 1024).toFixed(1)} kB`, n(r.saveMs), n(r.restoreMs)]);
  }
  out.push(table(['engine / preset', 'two runs, same process', 'fresh process', 'hash', 'snapshot at 1 s, replay 2 s', 'snapshot size', 'save ms', 'restore ms'], rows));
}

// ---- T8
H('T8 performance: step time in ms, best / median of 3 fresh-process repeats (single thread)');
{
  const rows = [];
  for (const d of docs.filter((x) => x.test === 'T8').sort((a, b) => (a.engine + a.preset + (a.tag ?? '')).localeCompare(b.engine + b.preset + (b.tag ?? '')))) {
    for (const [k, s] of Object.entries(d.summary)) {
      const bm = (o, dd = 3) => `${n(o.best, dd)} / ${n(o.median, dd)}`;
      rows.push([`${d.engine} / ${d.preset}${d.tag ? ` [${d.tag}]` : ''}`, k, `${s.counts.bodies} / ${s.counts.pieces} / ${s.counts.staticCapsules}`, bm(s.stepMean_ms), bm(s.stepActiveMean_ms), bm(s.stepP99_ms, 2), bm(s.stepMax_ms, 1), bm(s.build_ms, 0), n(s.rssAfter_MB, 0), s.stability.exploded ? 'EXPLODED' : `${s.stability.asleep} asleep, rest ${rest(s.stability.restTime_s)}`]);
    }
  }
  out.push(table(['engine / preset', 'scene @ dt', 'bodies / pieces / static capsules', 'mean step (whole run)', 'mean step (first 1 s, all awake)', 'p99 step', 'max step', 'scene build', 'RSS MB', 'outcome'], rows));
}

// ---- T9
H('T9 disturbance of plate 5 in the settled T2 rack (applied at t = 5 s, observed 5 s)');
{
  const rows = [];
  for (const e of ENG) for (const p of ['default', 'tuned', 'scaled']) {
    const d = get(e, p, 'T9');
    if (!d) continue;
    for (const [k, s] of Object.entries(d.summary)) rows.push([`${e} / ${p}`, k, s.responded ? 'yes' : '**NO**', n(s.maxDisp_mm), n(s.finalDisp_mm, 3), n(s.neighbourMaxDisp_mm, 3), s.resettleTime_s == null ? '**never**' : n(s.resettleTime_s), s.exploded ? 'YES' : 'no', n(s.penMaxStatic_mm, 3), n(s.penMaxDynamic_mm, 3), n(s.finalLean_deg), s.asleep]);
  }
  out.push(table(['engine / preset', 'disturbance', 'responded', 'max displacement mm', 'final displacement mm', 'max neighbour displacement mm', 're-settle time s', 'exploded', 'max pen wires mm', 'max pen plate-plate mm', 'final lean deg', 'asleep at end'], rows));
}

// ---- Sensitivity
H('Sensitivity (tuned presets): friction, restitution, time step, decomposition granularity');
{
  const rows = [];
  const tagged = docs.filter((d) => (d.preset === 'tuned' || d.preset === 'scaled') && ((d.tag && /^(mu|e|plateN|bowlN)/.test(d.tag)) || d.hz !== 240) && ['T1', 'T2', 'T3', 'T5'].includes(d.test));
  tagged.sort((a, b) => (a.engine + a.preset + (a.tag ?? `dt${String(a.hz).padStart(4, '0')}`) + a.test).localeCompare(b.engine + b.preset + (b.tag ?? `dt${String(b.hz).padStart(4, '0')}`) + b.test));
  for (const d of tagged) {
    const s = d.test === 'T3' ? d.summary.facetsMisaligned : d.summary;
    const extra = d.test === 'T1' ? `lean ${n(s.lean_deg)} deg, y ${n(s.pos_mm[1])} mm` : d.test === 'T2' ? `lean ${n(s.leanMin_deg)}..${n(s.leanMax_deg)} deg` : d.test === 'T3' ? `spacing ${s.spacing_mm.map((x) => n(x)).join('/')} mm` : `escaped ${s.tunnelledDuring}/${s.tunnelledFinal}`;
    rows.push([`${d.engine} / ${d.preset}`, d.tag ?? `dt=1/${d.hz}`, d.test, s.exploded ? 'EXPLODED' : rest(s.restTime_s), n(Math.max(s.penMaxStatic_mm, s.penMaxDynamic_mm), 3), n(Math.max(s.penFinalStatic_mm, s.penFinalDynamic_mm), 3), extra]);
  }
  out.push(table(['engine / preset', 'variation', 'test', 'time to rest s', 'max pen mm', 'final pen mm', 'outcome'], rows));
}

writeFileSync(dir + 'tables.md', out.join('\n') + '\n');
console.log(`wrote ${dir}tables.md (${docs.length} result files)`);
