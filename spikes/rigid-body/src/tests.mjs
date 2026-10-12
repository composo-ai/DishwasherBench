// Test definitions T1..T9. Every test is engine-neutral: it builds a scene, calls simulate() and
// derives its metrics from the returned body states (never from engine-internal diagnostics).
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { simulate, bodyVertices, memSnapshot, ENGINES } from './harness.mjs';
import { SCENES, sceneCounts } from './scenes.mjs';
import { stats, hashF64 } from './math.mjs';

const RUN = fileURLToPath(new URL('./run.mjs', import.meta.url));

function core(r) {
  return {
    restTime_s: r.restTime,
    rmsLin_mm_s: r.rmsLin_mm_s,
    rmsAng_rad_s: r.rmsAng_rad_s,
    residualKE_uJ: r.residualKE_uJ,
    maxSpeed_m_s: r.maxSpeed,
    exploded: r.exploded,
    penInit_mm: Math.max(r.pen.initialStatic_mm ?? 0, r.pen.initialDynamic_mm ?? 0),
    penMaxStatic_mm: r.pen.maxStatic_mm,
    penMaxDynamic_mm: r.pen.maxDynamic_mm,
    penFinalStatic_mm: r.pen.finalStatic_mm,
    penFinalDynamic_mm: r.pen.finalDynamic_mm,
    asleep: `${r.sleep.asleepAtEnd}/${r.sleep.of}`,
    allAsleepAt_s: r.sleep.allAsleepAt,
    driftPos_mm: r.drift.pos_mm,
    driftAng_deg: r.drift.ang_deg,
    stepMean_ms: r.step.meanMs,
    stepP99_ms: r.step.p99Ms,
    stepTotal_ms: r.step.totalMs,
    hash: r.hash,
  };
}
const slim = (r) => ({ ...r, bodies: r.bodies.map((b) => ({ name: b.name, pos: b.pos, quat: b.quat, lean: b.leanFromVerticalDeg, axisV: b.axisFromVerticalDeg, asleep: b.asleep })) });

export const TESTS = {
  // ------------------------------------------------------------------ T1
  async T1({ engine, cfg, so }) {
    const scene = SCENES.T1(so);
    const { result: r } = await simulate(engine, scene, cfg, { duration: 5 });
    const b = r.bodies[0];
    return {
      summary: { ...core(r), pos_mm: b.pos.map((x) => x * 1000), lean_deg: b.leanFromVerticalDeg, counts: sceneCounts(scene) },
      runs: [slim(r)],
    };
  },
  // ------------------------------------------------------------------ T2
  async T2({ engine, cfg, so }) {
    const scene = SCENES.T2(so);
    const { result: r } = await simulate(engine, scene, cfg, { duration: 10 });
    const leans = r.bodies.map((b) => b.leanFromVerticalDeg);
    return {
      summary: { ...core(r), leanMin_deg: Math.min(...leans), leanMax_deg: Math.max(...leans), counts: sceneCounts(scene) },
      runs: [slim(r)],
    };
  },
  // ------------------------------------------------------------------ T3
  async T3({ engine, cfg, so }) {
    const out = { summary: {}, runs: [] };
    for (const align of [false, true]) {
      const scene = SCENES.T3({ ...so, alignFacets: align });
      const { result: r } = await simulate(engine, scene, cfg, { duration: 8 });
      const ys = r.bodies.map((b) => b.pos[1]);
      const spacing = [1, 2, 3].map((i) => (ys[i] - ys[i - 1]) * 1000);
      const lateral = [1, 2, 3].map((i) => Math.hypot(r.bodies[i].pos[0] - r.bodies[i - 1].pos[0], r.bodies[i].pos[2] - r.bodies[i - 1].pos[2]) * 1000);
      const tilt = r.bodies.map((b) => b.axisFromVerticalDeg);
      const s = {
        ...core(r),
        idealSpacing_mm: scene.meta.idealNestSpacing * 1000,
        spacing_mm: spacing,
        sink_mm: spacing.map((x) => scene.meta.idealNestSpacing * 1000 - x),
        lateralOffset_mm: lateral,
        maxTilt_deg: Math.max(...tilt),
        bottomBowlY_mm: ys[0] * 1000,
        counts: sceneCounts(scene),
      };
      out.summary[align ? 'facetsAligned' : 'facetsMisaligned'] = s;
      out.runs.push(slim(r));
    }
    return out;
  },
  // ------------------------------------------------------------------ T4
  async T4({ engine, cfg, so }) {
    const out = { summary: {}, runs: [] };
    {
      const scene = SCENES.T4a(so);
      const { result: r } = await simulate(engine, scene, cfg, { duration: 6 });
      out.summary.tumbler = { ...core(r), axisFromVertical_deg: r.bodies[0].axisFromVerticalDeg, pos_mm: r.bodies[0].pos.map((x) => x * 1000) };
      out.runs.push(slim(r));
    }
    for (const mu of [0.4, 0.3]) {
      const scene = SCENES.T4b({ ...so, friction: mu });
      const d = scene.meta.downhill;
      let p1 = null;
      const { result: r, state } = await simulate(engine, scene, cfg, {
        duration: 10,
        sample: (t, st) => {
          if (!p1 && t >= 1.0) p1 = [st[0], st[1], st[2]];
        },
      });
      const slide = ((state[0] - p1[0]) * d[0] + (state[1] - p1[1]) * d[1] + (state[2] - p1[2]) * d[2]) * 1000;
      out.summary[`mug_mu${mu}`] = {
        ...core(r),
        slideDownhill_1s_to_10s_mm: slide,
        slideRate_mm_s: slide / 9,
        axisFromShelfNormal_deg: (Math.acos(Math.min(1, Math.abs(r.bodies[0].axis[0] * scene.meta.normal[0] + r.bodies[0].axis[1] * scene.meta.normal[1] + r.bodies[0].axis[2] * scene.meta.normal[2]))) * 180) / Math.PI,
        tanTilt: Math.tan((scene.meta.shelfTiltDeg * Math.PI) / 180),
      };
      out.runs.push(slim(r));
    }
    return out;
  },
  // ------------------------------------------------------------------ T5
  async T5({ engine, cfg, so }) {
    const scene = SCENES.T5(so);
    const m = scene.meta;
    const tol = 0.0005;
    const escaped = () => new Set();
    const everOut = escaped();
    const check = (state, sink) => {
      for (let i = 0; i < scene.bodies.length; i++) {
        const cell = m.cells[m.owner[i]];
        let bad = 0;
        for (const w of bodyVertices(scene, state, i)) {
          for (let k = 0; k < w.length; k += 3) {
            const y = w[k + 1];
            if (y < m.floorY - tol) bad = Math.max(bad, m.floorY - y);
            if (y < m.rimY - 0.002) {
              bad = Math.max(bad, Math.abs(w[k] - cell.cx) - cell.half, Math.abs(w[k + 2] - cell.cz) - cell.half);
            }
          }
        }
        if (bad > tol) sink.set(i, Math.max(sink.get(i) ?? 0, bad));
      }
    };
    const during = new Map();
    let k = 0;
    const { result: r, state } = await simulate(engine, scene, cfg, {
      duration: 6,
      sample: (t, st) => {
        if (k++ % 4 === 0) check(st, during);
      },
    });
    const final = new Map();
    check(state, final);
    const ys = r.bodies.map((b) => b.pos[1]);
    const tilts = r.bodies.map((b) => b.axisFromVerticalDeg);
    return {
      summary: {
        ...core(r),
        tunnelledDuring: during.size,
        tunnelledFinal: final.size,
        worstExcursion_mm: Math.max(0, ...during.values(), ...final.values()) * 1000,
        tunnelledNames: [...final.keys()].map((i) => scene.bodies[i].name),
        comY_mm: { min: Math.min(...ys) * 1000, max: Math.max(...ys) * 1000 },
        leanFromVertical_deg: { min: Math.min(...tilts), median: stats(tilts).p50, max: Math.max(...tilts) },
        counts: sceneCounts(scene),
      },
      runs: [slim(r)],
    };
  },
  // ------------------------------------------------------------------ T6
  async T6({ engine, cfg, so, ccdVariants }) {
    const out = { summary: {}, runs: [] };
    const ccdModes = ccdVariants ?? [{ label: 'noCCD', over: { ccd: false } }, { label: 'CCD', over: { ccd: true } }];
    const dts = so.t6hz ? String(so.t6hz).split(',').map((h) => 1 / Number(h)) : [cfg.dt];
    for (const dt of dts) {
      for (const cm of ccdModes) {
        const c = { ...cfg, ...cm.over, dt, sleep: false };
        for (const [mode, speed] of [['edge', 2], ['edge', 5], ['flat', 2], ['flat', 5]]) {
          // "tunnelled" = the knife's COM got 30 mm below the wires within 2.5x the free-flight time,
          // i.e. it went straight through. Dropping below later means it bounced and legitimately fell
          // off the two wires ("fellOff"), which is not a collision failure.
          let through = 0;
          let fell = 0;
          let maxPen = 0;
          const detail = [];
          const gaps = [0.007, 0.011, 0.016, 0.02];
          for (const gap of gaps) {
            const scene = SCENES.T6knife({ ...so, speed, mode, gap });
            let tPass = null;
            const { result: r, state } = await simulate(engine, scene, c, {
              duration: 1.0,
              measureHz: 100000,
              explodeSpeed: 50,
              stopOnExplode: false,
              sample: (t, st) => {
                if (tPass == null && st[1] < scene.meta.passY) tPass = t;
              },
            });
            const flight = (gap + Math.abs(scene.meta.passY) + 0.012) / speed;
            const tunnelled = tPass != null && tPass <= 2.5 * flight;
            const fellOff = tPass != null && !tunnelled;
            if (tunnelled) through++;
            if (fellOff) fell++;
            maxPen = Math.max(maxPen, r.pen.maxStatic_mm);
            detail.push({ gap_mm: gap * 1000, tunnelled, fellOff, tPass, finalY_mm: state[1] * 1000, penMax_mm: r.pen.maxStatic_mm, penFinal_mm: r.pen.finalStatic_mm, maxSpeed: r.maxSpeed });
          }
          out.summary[`knife-${mode}-${speed}mps@1/${Math.round(1 / dt)}-${cm.label}`] = { passedThrough: `${through}/${gaps.length}`, fellOffLater: fell, penMax_mm: maxPen, detail };
        }
        {
          let through = 0;
          let impaled = 0;
          let maxPen = 0;
          const detail = [];
          const gaps = [0.011, 0.014, 0.017, 0.02];
          for (const gap of gaps) {
            const scene = SCENES.T6plate({ ...so, speed: 2, gap });
            let minY = Infinity;
            const { result: r, state } = await simulate(engine, scene, c, {
              duration: 2.0,
              measureHz: 100000,
              explodeSpeed: 50,
              stopOnExplode: false,
              sample: (t, st) => {
                minY = Math.min(minY, st[1]);
              },
            });
            // The plate should end up lying on the tine tips: COM at restY (+- a few mm for tilt).
            const finalDrop = (scene.meta.restY - state[1]) * 1000;
            const passed = finalDrop > 15; // well below the tips: tines went through the plate
            const stuck = !passed && r.pen.finalStatic_mm > 1.0;
            if (passed) through++;
            if (stuck) impaled++;
            maxPen = Math.max(maxPen, r.pen.maxStatic_mm);
            detail.push({ gap_mm: gap * 1000, passedThrough: passed, impaled: stuck, comBelowRest_mm: finalDrop, penMax_mm: r.pen.maxStatic_mm, penFinal_mm: r.pen.finalStatic_mm, restTime: r.restTime, maxSpeed: r.maxSpeed });
          }
          out.summary[`plate-flat-2mps@1/${Math.round(1 / dt)}-${cm.label}`] = { passedThrough: `${through}/${gaps.length}`, impaled: `${impaled}/${gaps.length}`, penMax_mm: maxPen, detail };
        }
      }
    }
    return out;
  },
  // ------------------------------------------------------------------ T7
  async T7({ engine, cfg, so, preset, argvTail }) {
    const scene = () => SCENES.T2(so);
    const opts = { duration: 10, measureHz: 0 };
    const a = (await simulate(engine, scene(), cfg, opts)).result;
    const b = (await simulate(engine, scene(), cfg, opts)).result;
    let child = null;
    try {
      const txt = execFileSync(process.execPath, [RUN, engine, preset, 'T7child', ...argvTail], { encoding: 'utf8', maxBuffer: 1 << 26 });
      child = JSON.parse(txt.trim().split('\n').pop());
    } catch (e) {
      child = { error: String(e).slice(0, 300) };
    }
    // Snapshot / restore replay: save at t = 1 s, run to t = 3 s, restore, run again, compare.
    let replay = null;
    try {
      const mod = await ENGINES[engine]();
      const w = await mod.create(scene(), cfg);
      const st = new Float64Array(w.n * 13);
      const n1 = Math.round(1 / cfg.dt);
      const n2 = Math.round(2 / cfg.dt);
      for (let i = 0; i < n1; i++) w.step();
      const t0 = performance.now();
      const snap = w.snapshot();
      const saveMs = performance.now() - t0;
      for (let i = 0; i < n2; i++) w.step();
      const h1 = hashF64(w.read(st));
      const t1 = performance.now();
      w.restore(snap);
      const restoreMs = performance.now() - t1;
      for (let i = 0; i < n2; i++) w.step();
      const h2 = hashF64(w.read(st));
      replay = { identical: h1 === h2, h1, h2, saveMs, restoreMs, snapshotBytes: w.snapshotBytes(snap) };
      w.free();
    } catch (e) {
      replay = { error: String(e).slice(0, 300) };
    }
    return {
      summary: {
        sameProcessIdentical: a.hash === b.hash,
        freshProcessIdentical: child.hash ? child.hash === a.hash : null,
        hashA: a.hash,
        hashB: b.hash,
        hashChild: child.hash ?? child.error,
        snapshotReplay: replay,
      },
      runs: [],
    };
  },
  async T7child({ engine, cfg, so }) {
    const r = (await simulate(engine, SCENES.T2(so), cfg, { duration: 10, measureHz: 0 })).result;
    return { summary: { hash: r.hash }, runs: [], printLast: { hash: r.hash } };
  },
  // ------------------------------------------------------------------ T8
  async T8({ engine, cfg, so, preset, argvTail }) {
    const out = { summary: {}, runs: [] };
    const reps = so.reps ?? 3;
    const scenes = (so.t8scenes ?? 'T2,T5,FULL').split(',');
    const hzs = String(so.t8hz ?? '120,240,480').split(',').map(Number);
    for (const name of scenes) {
      for (const hz of hzs) {
        const rows = [];
        for (let k = 0; k < reps; k++) {
          const txt = execFileSync(process.execPath, [RUN, engine, preset, 'T8child', ...argvTail.filter((a) => !a.startsWith('dt=')), `dt=${hz}`, `s.scene=${name}`], { encoding: 'utf8', maxBuffer: 1 << 26 });
          rows.push(JSON.parse(txt.trim().split('\n').pop()));
        }
        const pick = (key) => rows.map((r) => r[key]).sort((a, b) => a - b);
        const med = (xs) => xs[Math.floor(xs.length / 2)];
        const first = rows[0];
        out.summary[`${name}@1/${hz}`] = {
          counts: first.counts,
          stepMean_ms: { best: pick('stepMean_ms')[0], median: med(pick('stepMean_ms')), worst: pick('stepMean_ms').at(-1) },
          stepActiveMean_ms: { best: pick('stepActiveMean_ms')[0], median: med(pick('stepActiveMean_ms')), worst: pick('stepActiveMean_ms').at(-1) },
          stepP99_ms: { best: pick('stepP99_ms')[0], median: med(pick('stepP99_ms')), worst: pick('stepP99_ms').at(-1) },
          stepMax_ms: { best: pick('stepMax_ms')[0], median: med(pick('stepMax_ms')) },
          total_ms: { best: pick('total_ms')[0], median: med(pick('total_ms')) },
          build_ms: { best: pick('build_ms')[0], median: med(pick('build_ms')) },
          rssAfter_MB: med(pick('rssAfter_MB')),
          rssDelta_MB: med(pick('rssDelta_MB')),
          engineMem: first.engineMem,
          simSeconds: first.simSeconds,
          stability: first.stability,
        };
      }
    }
    return out;
  },
  async T8child({ engine, cfg, so }) {
    const scene = SCENES[so.scene ?? 'T2']({});
    const duration = so.scene === 'FULL' ? 4 : 5;
    global.gc?.();
    const memBefore = memSnapshot();
    // Timing run: no penetration sampling, nothing else in the loop.
    const actSteps = Math.round(1 / cfg.dt);
    const act = [];
    let k = 0;
    const { result: r } = await simulate(engine, scene, cfg, { duration, measureHz: 0, sample: () => k++ });
    const memAfter = memSnapshot();
    const o = {
      counts: sceneCounts(scene),
      stepMean_ms: r.step.meanMs,
      stepP99_ms: r.step.p99Ms,
      stepMax_ms: r.step.maxMs,
      stepActiveMean_ms: r.stepActive.meanMs,
      total_ms: r.step.totalMs,
      build_ms: r.buildMs,
      rssAfter_MB: memAfter.rssMB,
      rssDelta_MB: memAfter.rssMB - memBefore.rssMB,
      engineMem: r.mem.engine,
      simSeconds: duration,
      stability: { restTime_s: r.restTime, exploded: r.exploded, asleep: `${r.sleep.asleepAtEnd}/${r.sleep.of}`, rmsLin_mm_s: r.rmsLin_mm_s, maxSpeed: r.maxSpeed },
    };
    return { summary: o, runs: [], printLast: o };
  },
  // ------------------------------------------------------------------ T9
  async T9({ engine, cfg, so }) {
    const out = { summary: {}, runs: [] };
    const cases = [
      { label: 'rock-z-0.02Ns-top', J: [0, 0, 0.02], at: [0, 0.12, 0] },
      { label: 'rock-z-0.05Ns-top', J: [0, 0, 0.05], at: [0, 0.12, 0] },
      { label: 'roll-x-0.03Ns-centre', J: [0.03, 0, 0], at: [0, 0, 0] },
      { label: 'jet-2N-z-0.25s-centre', F: [0, 0, 2], at: [0, 0, 0], forceFor: 0.25 },
    ];
    for (const cs of cases) {
      const scene = SCENES.T2(so);
      const target = 5;
      let before = null;
      let maxDisp = 0;
      let maxNeighbour = 0;
      let lastUnrest = 5;
      let forcing = false;
      const tImp = 5;
      const { result: r, state } = await simulate(engine, scene, cfg, {
        duration: 10,
        events: [
          {
            t: tImp,
            run: (world, st) => {
              before = Float64Array.from(st);
              const o = target * 13;
              const p = [st[o] + cs.at[0], st[o + 1] + cs.at[1], st[o + 2] + cs.at[2]];
              if (cs.J) world.applyImpulse(target, cs.J, p);
              else {
                world.addForce(target, cs.F, p);
                forcing = true;
              }
            },
          },
        ],
        sample: (t, st, world) => {
          if (!before) return;
          if (forcing) {
            const o = target * 13;
            if (t >= tImp + cs.forceFor) {
              world.resetForces(target);
              forcing = false;
            } else if (world.engine === 'jolt' || world.engine === 'physx') {
              world.addForce(target, cs.F, [st[o] + cs.at[0], st[o + 1] + cs.at[1], st[o + 2] + cs.at[2]]);
            }
          }
          for (let b = 0; b < scene.bodies.length; b++) {
            const o = b * 13;
            const d = Math.hypot(st[o] - before[o], st[o + 1] - before[o + 1], st[o + 2] - before[o + 2]);
            if (b === target) maxDisp = Math.max(maxDisp, d);
            else maxNeighbour = Math.max(maxNeighbour, d);
            const v = Math.hypot(st[o + 7], st[o + 8], st[o + 9]);
            const w = Math.hypot(st[o + 10], st[o + 11], st[o + 12]);
            if (v > 0.005 || w > 0.05) lastUnrest = t;
          }
        },
      });
      const o = target * 13;
      const finalDisp = Math.hypot(state[o] - before[o], state[o + 1] - before[o + 1], state[o + 2] - before[o + 2]);
      const lean0 = null;
      out.summary[cs.label] = {
        responded: maxDisp > 1e-5,
        maxDisp_mm: maxDisp * 1000,
        finalDisp_mm: finalDisp * 1000,
        neighbourMaxDisp_mm: maxNeighbour * 1000,
        resettleTime_s: lastUnrest >= 10 - 2 * cfg.dt ? null : lastUnrest - tImp,
        exploded: r.exploded,
        penMaxStatic_mm: r.pen.maxStatic_mm,
        penFinalStatic_mm: r.pen.finalStatic_mm,
        penMaxDynamic_mm: r.pen.maxDynamic_mm,
        asleep: `${r.sleep.asleepAtEnd}/${r.sleep.of}`,
        finalLean_deg: r.bodies[target].leanFromVerticalDeg,
        maxSpeed: r.maxSpeed,
        lean0,
      };
      out.runs.push(slim(r));
    }
    return out;
  },
};
