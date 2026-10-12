// MuJoCo adapter using the official WebAssembly bindings (@mujoco/mujoco, single-threaded build).
// The scene is converted to MJCF: static capsules/boxes are world geoms; each dynamic body is a free
// body whose convex pieces are mesh geoms (vertex-only meshes -> MuJoCo builds the convex hulls).
import { qRot, qConj, sub, cross } from '../math.mjs';

export const PRESETS = {
  // MuJoCo defaults: Euler integrator, pyramidal cone, impratio 1, solref (0.02, 1), no sleeping.
  default: { sleep: false },
  // Tuned for stiff, non-creeping contact (see RESULTS.md).
  tuned: {
    integrator: 'implicitfast',
    cone: 'elliptic',
    impratio: 10,
    solrefTimeconstSteps: 2, // contact time constant = 2 * dt (the stiffest MuJoCo considers safe)
    solimp: '0.95 0.99 0.0005 0.5 2',
    noslip: 0,
    multiccd: true,
    sleep: true,
  },
};
PRESETS['tuned-noslip'] = { ...PRESETS.tuned, noslip: 5 };
// MuJoCo has no continuous collision detection (its "CCD" is *convex* collision detection); geom
// `margin` only widens contact detection and either inflates the shape or does nothing for tunnelling.
export const CCD_VARIANTS = [{ label: 'noCCD(only mode)', over: {} }];

let cached = null;
export async function load() {
  if (!cached) {
    const t0 = performance.now();
    const loadMujoco = (await import('@mujoco/mujoco')).default;
    const mujoco = await loadMujoco();
    cached = { mujoco, loadMs: performance.now() - t0 };
  }
  return cached;
}

const f = (x) => (Math.abs(x) < 1e-15 ? '0' : x.toPrecision(12));
const v = (a) => a.map(f).join(' ');
const wxyz = (q) => `${f(q[3])} ${f(q[0])} ${f(q[1])} ${f(q[2])}`;

export function toMJCF(scene, cfg) {
  const dt = cfg.dt;
  const solref = cfg.solref ?? (cfg.solrefTimeconstSteps ? `${f(cfg.solrefTimeconstSteps * dt)} 1` : null);
  const flags = [];
  if (cfg.multiccd) flags.push('multiccd="enable"');
  if (cfg.sleep) flags.push('sleep="enable"');
  const optAttrs = [`timestep="${f(dt)}"`, `gravity="${v(scene.gravity)}"`];
  if (cfg.integrator) optAttrs.push(`integrator="${cfg.integrator}"`);
  if (cfg.cone) optAttrs.push(`cone="${cfg.cone}"`);
  if (cfg.impratio) optAttrs.push(`impratio="${cfg.impratio}"`);
  if (cfg.noslip) optAttrs.push(`noslip_iterations="${cfg.noslip}"`);
  if (cfg.iterations) optAttrs.push(`iterations="${cfg.iterations}"`);
  if (cfg.tolerance != null) optAttrs.push(`tolerance="${cfg.tolerance}"`);
  if (cfg.solver) optAttrs.push(`solver="${cfg.solver}"`);
  if (cfg.sleepTolerance != null) optAttrs.push(`sleep_tolerance="${cfg.sleepTolerance}"`);
  const geomDef = [`friction="${f(scene.friction)} ${cfg.torsional ?? 0.005} ${cfg.rolling ?? 0.0001}"`];
  if (solref) geomDef.push(`solref="${solref}"`);
  if (cfg.solimp) geomDef.push(`solimp="${cfg.solimp}"`);
  if (cfg.margin != null) geomDef.push(`margin="${cfg.margin}"`);
  if (cfg.condim) geomDef.push(`condim="${cfg.condim}"`);
  const out = [];
  out.push('<mujoco model="spotless-spike">');
  out.push('<compiler angle="radian" inertiafromgeom="true"/>');
  out.push(`<option ${optAttrs.join(' ')}>${flags.length ? `<flag ${flags.join(' ')}/>` : ''}</option>`);
  out.push(`<size memory="${cfg.memory ?? '256M'}"/>`);
  out.push(`<default><geom ${geomDef.join(' ')}/></default>`);
  out.push('<asset>');
  for (const [key, sh] of Object.entries(scene.shapes)) {
    sh.pieces.forEach((pts, i) => out.push(`<mesh name="${key}_${i}" vertex="${Array.from(pts, f).join(' ')}"/>`));
  }
  out.push('</asset>');
  out.push('<worldbody>');
  for (const s of scene.statics) {
    if (s.type === 'capsule') out.push(`<geom type="capsule" fromto="${v(s.a)} ${v(s.b)}" size="${f(s.r)}"/>`);
    else out.push(`<geom type="box" pos="${v(s.c)}" quat="${wxyz(s.q)}" size="${v(s.h)}"/>`);
  }
  scene.bodies.forEach((b, i) => {
    const sh = scene.shapes[b.shape];
    out.push(`<body name="b${i}" pos="${v(b.pos)}" quat="${wxyz(b.quat)}"><freejoint/>`);
    sh.pieces.forEach((_, k) => out.push(`<geom type="mesh" mesh="${b.shape}_${k}" density="${f(sh.density)}"/>`));
    out.push('</body>');
  });
  out.push('</worldbody></mujoco>');
  return out.join('\n');
}

export async function create(scene, cfg) {
  const { mujoco, loadMs } = await load();
  const xml = toMJCF(scene, cfg);
  const model = mujoco.MjModel.from_xml_string(xml);
  const data = new mujoco.MjData(model);
  const n = scene.bodies.length;
  // Initial velocities: free-joint qvel = [linear (world), angular (body frame)].
  {
    const qvel = data.qvel;
    scene.bodies.forEach((b, i) => {
      const wl = qRot(qConj(b.quat), b.angvel);
      qvel.set([b.linvel[0], b.linvel[1], b.linvel[2], wl[0], wl[1], wl[2]], i * 6);
    });
  }
  mujoco.mj_forward(model, data);
  const opt = model.opt;
  const params = {
    dt: opt.timestep,
    integrator: opt.integrator,
    cone: opt.cone,
    impratio: opt.impratio,
    solver: opt.solver,
    iterations: opt.iterations,
    tolerance: opt.tolerance,
    noslip_iterations: opt.noslip_iterations,
    enableflags: opt.enableflags,
    disableflags: opt.disableflags,
    solref: cfg.solref ?? (cfg.solrefTimeconstSteps ? `${cfg.solrefTimeconstSteps * cfg.dt} 1` : 'default(0.02 1)'),
    solimp: cfg.solimp ?? 'default(0.9 0.95 0.001 0.5 2)',
    margin: cfg.margin ?? 0,
    ngeom: model.ngeom,
    nmesh: model.nmesh,
    xmlBytes: xml.length,
  };
  const stateSig = mujoco.mjtState.mjSTATE_INTEGRATION.value;
  const stateSize = mujoco.mj_stateSize(model, stateSig);
  const pending = [];
  const persistent = new Map();

  const applyXfrc = () => {
    const x = data.xfrc_applied;
    x.fill(0);
    const com = data.xipos;
    const addWrench = (i, F, point) => {
      const b = i + 1;
      const c = [com[3 * b], com[3 * b + 1], com[3 * b + 2]];
      const tq = cross(sub(point, c), F);
      for (let k = 0; k < 3; k++) {
        x[6 * b + k] += F[k];
        x[6 * b + 3 + k] += tq[k];
      }
    };
    for (const p of pending) addWrench(p.i, p.F, p.point);
    for (const [i, p] of persistent) addWrench(i, p.F, p.point);
  };

  return {
    engine: 'mujoco-wasm',
    version: mujoco.mj_versionString(),
    loadMs,
    n,
    params,
    masses: () => Array.from(model.body_mass).slice(1, n + 1),
    step() {
      const dirty = pending.length || persistent.size;
      if (dirty) applyXfrc();
      mujoco.mj_step(model, data);
      if (pending.length) {
        pending.length = 0;
        data.xfrc_applied.fill(0);
      }
    },
    read(out) {
      const qpos = data.qpos;
      const qvel = data.qvel;
      for (let i = 0; i < n; i++) {
        const o = i * 13;
        const p = i * 7;
        const d = i * 6;
        out[o] = qpos[p]; out[o + 1] = qpos[p + 1]; out[o + 2] = qpos[p + 2];
        const q = [qpos[p + 4], qpos[p + 5], qpos[p + 6], qpos[p + 3]];
        out[o + 3] = q[0]; out[o + 4] = q[1]; out[o + 5] = q[2]; out[o + 6] = q[3];
        out[o + 7] = qvel[d]; out[o + 8] = qvel[d + 1]; out[o + 9] = qvel[d + 2];
        const w = qRot(q, [qvel[d + 3], qvel[d + 4], qvel[d + 5]]);
        out[o + 10] = w[0]; out[o + 11] = w[1]; out[o + 12] = w[2];
      }
      return out;
    },
    sleeping: (i) => (cfg.sleep ? data.body_awake[i + 1] === 0 : false),
    applyImpulse(i, J, point) {
      // MuJoCo has no impulse API: apply J/dt as an external force for exactly one step.
      pending.push({ i, F: [J[0] / cfg.dt, J[1] / cfg.dt, J[2] / cfg.dt], point });
    },
    addForce(i, F, point) {
      persistent.set(i, { F, point });
    },
    resetForces(i) {
      persistent.delete(i);
      data.xfrc_applied.fill(0);
    },
    snapshot() {
      const buf = new mujoco.DoubleBuffer(stateSize);
      mujoco.mj_getState(model, data, buf, stateSig);
      const copy = Float64Array.from(buf.GetView()); // NB: the README says getView(); the 3.15.0 binding exports GetView()
      buf.delete();
      return copy;
    },
    restore(snap) {
      mujoco.mj_setState(model, data, Array.from(snap), stateSig);
      mujoco.mj_forward(model, data);
    },
    snapshotBytes: (snap) => snap.byteLength,
    contactCount: () => data.ncon,
    memory: () => ({ narenaMB: data.narena / 1048576, maxuseArenaMB: data.maxuse_arena / 1048576 }),
    free() {
      data.delete();
      model.delete();
    },
  };
}
