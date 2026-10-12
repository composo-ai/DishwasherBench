// Rapier 3D adapter (compat / deterministic / simd builds share the same JS API).
import { qFromYTo, sub, len, scale, add } from '../math.mjs';

const PKG = {
  compat: '@dimforge/rapier3d-compat',
  deterministic: '@dimforge/rapier3d-deterministic-compat',
  simd: '@dimforge/rapier3d-simd-compat',
};

export const PRESETS = {
  // Out of the box: only the time step is set (lengthUnit 1 => 20 mm prediction, sleeping on, no CCD).
  default: { ccd: false, sleep: true },
  // Best compromise found in ~30 swept configurations (see RESULTS.md): default lengths + a 0.5 mm
  // contact skin. Every Rapier configuration tried still fails T5 (cutlery).
  tuned: { contactSkin: 0.0005, ccd: false, sleep: true },
  // "Scaled for small objects" as the docs suggest; kept because it is the fastest Rapier setup and
  // shows the bowl-nesting failure.
  small: { lengthUnit: 0.1, ccd: false, sleep: true },
};
PRESETS['tuned-ccd'] = { ...PRESETS.tuned, ccd: true };
// The configuration that finally worked (found late in the spike): simulate in DECIMETRES (all lengths
// x10) with tolerances for 0.1 m objects and 5 mm of soft-CCD prediction. At metre scale Parry's absolute
// epsilons are too coarse for millimetre features (see RESULTS.md, pitfalls).
PRESETS.scaled = { worldScale: 10, lengthUnit: 0.1, softCcd: 0.005, ccd: false, sleep: true };
export const CCD_VARIANTS = [
  { label: 'noCCD', over: { ccd: false } },
  { label: 'CCD', over: { ccd: true } },
  { label: 'softCCD10mm', over: { ccd: false, softCcd: 0.01 } },
];

const mods = {};
export async function load(variant = 'compat') {
  if (!mods[variant]) {
    const t0 = performance.now();
    const R = (await import(PKG[variant])).default;
    await R.init();
    mods[variant] = { R, loadMs: performance.now() - t0 };
  }
  return mods[variant];
}

const V = (a) => ({ x: a[0], y: a[1], z: a[2] });
const Qo = (q) => ({ x: q[0], y: q[1], z: q[2], w: q[3] });

export async function create(scene, cfg) {
  const variant = cfg.variant ?? 'compat';
  const { R, loadMs } = await load(variant);
  // Optional world scale: simulate in units of 1/S metres (S = 10 -> decimetres). Lengths, gravity and
  // velocities are multiplied by S, densities divided by S^3 (masses unchanged); results are scaled back.
  const S = cfg.worldScale ?? 1;
  let world = new R.World(V(scene.gravity.map((g) => g * S)));
  const ip = world.integrationParameters;
  world.timestep = cfg.dt;
  if (cfg.lengthUnit != null || S !== 1) world.lengthUnit = (cfg.lengthUnit ?? 1) * S;
  if (cfg.solverIters != null) world.numSolverIterations = cfg.solverIters;
  if (cfg.pgsIters != null) world.numInternalPgsIterations = cfg.pgsIters;
  if (cfg.allowedLinearError != null) ip.normalizedAllowedLinearError = cfg.allowedLinearError;
  if (cfg.predictionDistance != null) ip.normalizedPredictionDistance = cfg.predictionDistance;
  if (cfg.contactFrequency != null) ip.contact_natural_frequency = cfg.contactFrequency;
  if (cfg.maxCcdSubsteps != null) world.maxCcdSubsteps = cfg.maxCcdSubsteps;
  const combine = { average: R.CoefficientCombineRule.Average, min: R.CoefficientCombineRule.Min, multiply: R.CoefficientCombineRule.Multiply, max: R.CoefficientCombineRule.Max };
  const material = (desc) => {
    desc.setFriction(scene.friction).setRestitution(scene.restitution);
    if (cfg.frictionCombine) desc.setFrictionCombineRule(combine[cfg.frictionCombine]);
    if (cfg.contactSkin) desc.setContactSkin(cfg.contactSkin * S);
    return desc;
  };

  const ground = world.createRigidBody(R.RigidBodyDesc.fixed());
  for (const s of scene.statics) {
    if (s.type === 'capsule') {
      const d = sub(s.b, s.a);
      const mid = scale(add(s.a, s.b), 0.5);
      world.createCollider(material(R.ColliderDesc.capsule((len(d) / 2) * S, s.r * S)).setTranslation(mid[0] * S, mid[1] * S, mid[2] * S).setRotation(Qo(qFromYTo(d))), ground);
    } else {
      world.createCollider(material(R.ColliderDesc.cuboid(s.h[0] * S, s.h[1] * S, s.h[2] * S)).setTranslation(s.c[0] * S, s.c[1] * S, s.c[2] * S).setRotation(Qo(s.q)), ground);
    }
  }
  const handles = [];
  for (const b of scene.bodies) {
    const shape = scene.shapes[b.shape];
    const desc = R.RigidBodyDesc.dynamic()
      .setTranslation(b.pos[0] * S, b.pos[1] * S, b.pos[2] * S)
      .setRotation(Qo(b.quat))
      .setLinvel(b.linvel[0] * S, b.linvel[1] * S, b.linvel[2] * S)
      .setAngvel(V(b.angvel))
      .setCcdEnabled(!!cfg.ccd)
      .setCanSleep(cfg.sleep !== false);
    if (cfg.softCcd) desc.setSoftCcdPrediction(cfg.softCcd * S);
    if (cfg.bodySolverIters) desc.setAdditionalSolverIterations(cfg.bodySolverIters);
    const rb = world.createRigidBody(desc);
    if (cfg.compound) {
      // One collider holding a Parry compound shape (internal BVH) instead of one collider per piece.
      const shapes = shape.pieces.map((pts) => new R.ConvexPolyhedron(new Float32Array(pts).map((x) => x * S)));
      const cd = R.ColliderDesc.compound(shapes, shapes.map(() => ({ x: 0, y: 0, z: 0 })), shapes.map(() => ({ x: 0, y: 0, z: 0, w: 1 })));
      world.createCollider(material(cd).setDensity(shape.density / S ** 3), rb);
    } else {
      for (const pts of shape.pieces) {
        const cd = R.ColliderDesc.convexHull(new Float32Array(pts).map((x) => x * S));
        if (!cd) throw new Error(`rapier: convex hull failed for a piece of ${shape.name}`);
        world.createCollider(material(cd).setDensity(shape.density / S ** 3), rb);
      }
    }
    handles.push(rb.handle);
  }
  let bodies = handles.map((h) => world.getRigidBody(h));
  const t = { x: 0, y: 0, z: 0 };
  const r = { x: 0, y: 0, z: 0, w: 1 };

  return {
    engine: `rapier-${variant}`,
    version: R.version(),
    loadMs,
    n: bodies.length,
    params: {
      dt: world.timestep,
      lengthUnit: world.lengthUnit,
      numSolverIterations: world.numSolverIterations,
      numInternalPgsIterations: world.numInternalPgsIterations,
      normalizedAllowedLinearError: ip.normalizedAllowedLinearError,
      normalizedPredictionDistance: ip.normalizedPredictionDistance,
      contact_erp: ip.contact_erp,
      maxCcdSubsteps: world.maxCcdSubsteps,
    },
    masses: () => bodies.map((b) => b.mass()),
    step() {
      world.step();
    },
    read(out) {
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        const o = i * 13;
        b.translation(t);
        out[o] = t.x / S; out[o + 1] = t.y / S; out[o + 2] = t.z / S;
        b.rotation(r);
        out[o + 3] = r.x; out[o + 4] = r.y; out[o + 5] = r.z; out[o + 6] = r.w;
        b.linvel(t);
        out[o + 7] = t.x / S; out[o + 8] = t.y / S; out[o + 9] = t.z / S;
        b.angvel(t);
        out[o + 10] = t.x; out[o + 11] = t.y; out[o + 12] = t.z;
      }
      return out;
    },
    sleeping: (i) => bodies[i].isSleeping(),
    applyImpulse(i, J, point) {
      bodies[i].applyImpulseAtPoint(V(J.map((x) => x * S)), V(point.map((x) => x * S)), true);
    },
    addForce(i, F, point) {
      // Persistent until resetForces; used to demonstrate external (jet) force coupling.
      bodies[i].addForceAtPoint(V(F.map((x) => x * S)), V(point.map((x) => x * S)), true);
    },
    resetForces(i) {
      bodies[i].resetForces(true);
      bodies[i].resetTorques(true);
    },
    snapshot: () => world.takeSnapshot(),
    restore(snap) {
      world.free();
      world = R.World.restoreSnapshot(snap);
      bodies = handles.map((h) => world.getRigidBody(h));
    },
    snapshotBytes: (snap) => snap.byteLength,
    contactCount() {
      let n = 0;
      world.forEachCollider(() => {});
      return n;
    },
    profile() {
      return null;
    },
    free() {
      world.free();
    },
  };
}
