// Engine-neutral simulation driver and metric collection.
import { createMeasurer } from './measure.mjs';
import { hashF64, qRot, qAngleBetween, stats, transformPoints } from './math.mjs';

export const ENGINES = {
  rapier: () => import('./engines/rapier.mjs'),
  jolt: () => import('./engines/jolt.mjs'),
  mujoco: () => import('./engines/mujoco.mjs'),
  physx: () => import('./engines/physx.mjs'),
};

export const REST_LIN = 0.005; // m/s   "at rest" thresholds used for time-to-rest
export const REST_ANG = 0.05; // rad/s

export function memSnapshot() {
  const m = process.memoryUsage();
  return { rssMB: m.rss / 1048576, heapUsedMB: m.heapUsed / 1048576, externalMB: m.external / 1048576, arrayBuffersMB: m.arrayBuffers / 1048576 };
}

/**
 * Build the scene in the given engine and simulate it.
 * @param opts.duration   simulated seconds
 * @param opts.measureHz  penetration sampling rate (0 disables), default 60
 * @param opts.events     [{ t, run(world, state, ctx) }] fired once when sim time >= t (before the step)
 * @param opts.sample     optional (t, state, world) => void called after every step
 * @param opts.keepWorld  return the live world instead of freeing it
 */
export async function simulate(engineName, scene, cfg, opts = {}) {
  const mod = await ENGINES[engineName]();
  const duration = opts.duration ?? scene.meta.duration ?? 5;
  const dt = cfg.dt;
  const memBefore = memSnapshot();
  const tBuild0 = performance.now();
  const world = await mod.create(scene, cfg);
  const buildMs = performance.now() - tBuild0;
  const meas = opts.measureHz === 0 ? null : await createMeasurer(scene);
  const n = world.n;
  const state = new Float64Array(n * 13);
  world.read(state);
  const initial = Float64Array.from(state);
  const initialPen = meas ? meas.measure(state) : null;
  const steps = Math.round(duration / dt);
  const measEvery = meas ? Math.max(1, Math.round(1 / ((opts.measureHz ?? 60) * dt))) : 0;
  const stepMs = new Float64Array(steps);
  const events = (opts.events ?? []).map((e) => ({ ...e, done: false }));
  const masses = scene.bodies.map((b) => b.mass);
  const radii = scene.bodies.map((b) => scene.shapes[b.shape].boundingRadius);

  let lastUnrest = 0;
  let maxSpeed = 0;
  let exploded = null;
  let penStaticMax = 0;
  let penDynMax = 0;
  let penStaticMaxAt = 0;
  let penDynMaxAt = 0;
  let sumV2 = 0;
  let sumW2 = 0;
  let sumKE = 0;
  let cnt = 0;
  let cntSteps = 0;
  let mid = null;
  let allAsleepAt = null;
  let everAwakeAfterSleep = false;
  const ctx = { marks: {} };
  const lastWindow = opts.lastWindow ?? 1.0;

  for (let i = 0; i < steps; i++) {
    const t = i * dt;
    for (const e of events) {
      if (!e.done && t >= e.t - 1e-12) {
        e.done = true;
        e.run(world, state, ctx, t);
      }
    }
    const t0 = performance.now();
    world.step();
    stepMs[i] = performance.now() - t0;
    world.read(state);
    const tNow = (i + 1) * dt;
    let unrest = false;
    for (let b = 0; b < n; b++) {
      const o = b * 13;
      const v = Math.hypot(state[o + 7], state[o + 8], state[o + 9]);
      const w = Math.hypot(state[o + 10], state[o + 11], state[o + 12]);
      if (!(v < 1e6) || !Number.isFinite(state[o]) || !Number.isFinite(state[o + 1]) || !Number.isFinite(state[o + 2])) {
        exploded = exploded ?? { t: tNow, body: b, reason: 'non-finite' };
        continue;
      }
      if (v > REST_LIN || w > REST_ANG) unrest = true;
      if (v > maxSpeed) maxSpeed = v;
      if (v > (opts.explodeSpeed ?? 15) && !exploded) exploded = { t: tNow, body: b, reason: `speed ${v.toFixed(1)} m/s` };
      if (tNow > duration - lastWindow) {
        sumV2 += v * v;
        sumW2 += w * w;
        sumKE += 0.5 * masses[b] * (v * v + (0.5 * radii[b] * w) ** 2);
        cnt++;
      }
    }
    if (tNow > duration - lastWindow) cntSteps++;
    if (unrest) lastUnrest = tNow;
    if (!mid && tNow >= duration / 2) mid = Float64Array.from(state);
    let asleep = 0;
    for (let b = 0; b < n; b++) if (world.sleeping(b)) asleep++;
    if (asleep === n) {
      if (allAsleepAt == null) allAsleepAt = tNow;
    } else if (allAsleepAt != null) {
      everAwakeAfterSleep = true;
      allAsleepAt = null;
    }
    if (meas && (i % measEvery === 0 || i === steps - 1)) {
      const m = meas.measure(state, { dynamic: opts.measureDynamic !== false });
      if (m.penStatic > penStaticMax) {
        penStaticMax = m.penStatic;
        penStaticMaxAt = tNow;
      }
      if (m.penDynamic > penDynMax) {
        penDynMax = m.penDynamic;
        penDynMaxAt = tNow;
      }
    }
    if (opts.sample) opts.sample(tNow, state, world, ctx);
    if (exploded && opts.stopOnExplode !== false && tNow > exploded.t + 0.2) break;
  }
  const finalPen = meas ? meas.measure(state) : null;
  let asleepEnd = 0;
  for (let b = 0; b < n; b++) if (world.sleeping(b)) asleepEnd++;

  // Drift between t = duration/2 and the end (creep of a supposedly settled scene).
  let driftPos = 0;
  let driftAng = 0;
  if (mid) {
    for (let b = 0; b < n; b++) {
      const o = b * 13;
      driftPos = Math.max(driftPos, Math.hypot(state[o] - mid[o], state[o + 1] - mid[o + 1], state[o + 2] - mid[o + 2]));
      driftAng = Math.max(driftAng, qAngleBetween([state[o + 3], state[o + 4], state[o + 5], state[o + 6]], [mid[o + 3], mid[o + 4], mid[o + 5], mid[o + 6]]));
    }
  }
  const bodies = scene.bodies.map((b, i) => {
    const o = i * 13;
    const q = [state[o + 3], state[o + 4], state[o + 5], state[o + 6]];
    const axis = qRot(q, [0, 1, 0]);
    return {
      name: b.name,
      pos: [state[o], state[o + 1], state[o + 2]],
      quat: q,
      axis,
      leanFromVerticalDeg: (Math.asin(Math.min(1, Math.abs(axis[1]))) * 180) / Math.PI, // for standing plates
      axisFromVerticalDeg: (Math.acos(Math.min(1, Math.abs(axis[1]))) * 180) / Math.PI, // for upright items
      asleep: world.sleeping(i),
    };
  });
  const st = stats(stepMs.subarray(0, steps));
  const sa = stats(stepMs.subarray(0, Math.min(steps, Math.round(1 / dt)))); // first simulated second: everything awake
  const result = {
    engine: world.engine,
    version: world.version,
    scene: scene.name,
    cfg,
    params: world.params,
    dt,
    steps,
    duration,
    buildMs,
    loadMs: world.loadMs,
    step: { meanMs: st.mean, p50Ms: st.p50, p99Ms: st.p99, maxMs: st.max, totalMs: st.mean * st.n },
    stepActive: { meanMs: sa.mean, p50Ms: sa.p50, p99Ms: sa.p99, maxMs: sa.max },
    realTimeFactor: duration / ((st.mean * st.n) / 1000),
    restTime: lastUnrest >= duration - dt * 1.5 ? null : lastUnrest,
    rmsLin_mm_s: Math.sqrt(sumV2 / (cnt || 1)) * 1000,
    rmsAng_rad_s: Math.sqrt(sumW2 / (cnt || 1)),
    residualKE_uJ: (sumKE / (cntSteps || 1)) * 1e6,
    maxSpeed,
    exploded,
    pen: {
      initialStatic_mm: initialPen ? initialPen.penStatic * 1000 : null,
      initialDynamic_mm: initialPen ? initialPen.penDynamic * 1000 : null,
      maxStatic_mm: penStaticMax * 1000,
      maxStaticAt: penStaticMaxAt,
      maxDynamic_mm: penDynMax * 1000,
      maxDynamicAt: penDynMaxAt,
      finalStatic_mm: finalPen ? finalPen.penStatic * 1000 : null,
      finalDynamic_mm: finalPen ? finalPen.penDynamic * 1000 : null,
      finalWorstStatic: finalPen?.worstStatic ?? null,
    },
    sleep: { asleepAtEnd: asleepEnd, of: n, allAsleepAt, wokeAgain: everAwakeAfterSleep },
    drift: { pos_mm: driftPos * 1000, ang_deg: (driftAng * 180) / Math.PI, window: [duration / 2, duration] },
    bodies,
    hash: hashF64(state),
    hashPose: hashF64(poseOnly(state, n)),
    marks: ctx.marks,
    mem: { before: memBefore, after: memSnapshot(), engine: world.memory ? world.memory() : null },
    masses: world.masses ? world.masses() : null,
  };
  if (meas) meas.free();
  if (opts.keepWorld) return { result, world, state, initial };
  world.free();
  return { result, state, initial };
}

function poseOnly(state, n) {
  const out = new Float64Array(n * 7);
  for (let b = 0; b < n; b++) for (let k = 0; k < 7; k++) out[b * 7 + k] = state[b * 13 + k];
  return out;
}

/** World-space vertices of body i (all pieces) for geometric checks. */
export function bodyVertices(scene, state, i) {
  const o = i * 13;
  const pos = [state[o], state[o + 1], state[o + 2]];
  const q = [state[o + 3], state[o + 4], state[o + 5], state[o + 6]];
  return scene.shapes[scene.bodies[i].shape].pieces.map((p) => transformPoints(p, pos, q));
}

export function fmt(x, d = 2) {
  if (x == null) return 'n/a';
  if (typeof x !== 'number') return String(x);
  if (!Number.isFinite(x)) return String(x);
  return x.toFixed(d);
}
