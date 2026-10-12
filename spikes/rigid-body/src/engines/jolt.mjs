// Jolt Physics adapter (jolt-physics npm package, single-threaded WASM build).
import { qFromYTo, sub, len, scale, add } from '../math.mjs';

export const PRESETS = {
  // Out of the box: Jolt's PhysicsSettings and hull settings untouched (tuned for metre-scale games):
  // speculative contact distance 20 mm, penetration slop 20 mm, manifold reduction on.
  default: { ccd: false, sleep: true },
  // Tuned for millimetre-scale tableware (see RESULTS.md).
  tuned: {
    ccd: false,
    sleep: true,
    penetrationSlop: 0.0001,
    speculativeContactDistance: 0.005,
    convexRadius: 0.0002,
    hullTolerance: 1e-5,
    velocitySteps: 10,
    positionSteps: 4,
    manifoldTolerance: 1e-4,
    manifoldReduction: false,
    pointVelocitySleepThreshold: 0.005,
    minVelocityForRestitution: 0.2,
  },
};
PRESETS['tuned-ccd'] = { ...PRESETS.tuned, ccd: true };
export const CCD_VARIANTS = [
  { label: 'noCCD', over: { ccd: false } },
  { label: 'CCD', over: { ccd: true } },
];

let cached = null;
export async function load() {
  if (!cached) {
    const t0 = performance.now();
    const init = (await import('jolt-physics/wasm-compat')).default;
    const Jolt = await init();
    cached = { Jolt, loadMs: performance.now() - t0 };
  }
  return cached;
}

const L_STATIC = 0;
const L_MOVING = 1;

export async function create(scene, cfg) {
  const { Jolt, loadMs } = await load();
  const objectFilter = new Jolt.ObjectLayerPairFilterTable(2);
  objectFilter.EnableCollision(L_STATIC, L_MOVING);
  objectFilter.EnableCollision(L_MOVING, L_MOVING);
  const bpInterface = new Jolt.BroadPhaseLayerInterfaceTable(2, 2);
  const bp0 = new Jolt.BroadPhaseLayer(0);
  const bp1 = new Jolt.BroadPhaseLayer(1);
  bpInterface.MapObjectToBroadPhaseLayer(L_STATIC, bp0);
  bpInterface.MapObjectToBroadPhaseLayer(L_MOVING, bp1);
  const settings = new Jolt.JoltSettings();
  settings.mObjectLayerPairFilter = objectFilter;
  settings.mBroadPhaseLayerInterface = bpInterface;
  settings.mObjectVsBroadPhaseLayerFilter = new Jolt.ObjectVsBroadPhaseLayerFilterTable(bpInterface, 2, objectFilter, 2);
  // NB: the JS build's TempAllocator is a fixed 10 MB arena; mMaxContactConstraints = 65536 needs ~31 MB
  // and aborts on the first Step ("TempAllocator: Out of memory"). 16384 fits.
  const jsDefaults = { mMaxBodies: settings.mMaxBodies, mMaxBodyPairs: settings.mMaxBodyPairs, mMaxContactConstraints: settings.mMaxContactConstraints };
  if (cfg.maxContactConstraints) settings.mMaxContactConstraints = cfg.maxContactConstraints;
  if (cfg.maxBodyPairs) settings.mMaxBodyPairs = cfg.maxBodyPairs;
  const jolt = new Jolt.JoltInterface(settings);
  Jolt.destroy(settings);
  const system = jolt.GetPhysicsSystem();
  const bi = system.GetBodyInterface();
  system.SetGravity(new Jolt.Vec3(scene.gravity[0], scene.gravity[1], scene.gravity[2]));

  const ps = system.GetPhysicsSettings();
  const setIf = (key, v) => {
    if (v != null) ps[key] = v;
  };
  setIf('mPenetrationSlop', cfg.penetrationSlop);
  setIf('mSpeculativeContactDistance', cfg.speculativeContactDistance);
  setIf('mBaumgarte', cfg.baumgarte);
  setIf('mNumVelocitySteps', cfg.velocitySteps);
  setIf('mNumPositionSteps', cfg.positionSteps);
  setIf('mManifoldTolerance', cfg.manifoldTolerance);
  setIf('mPointVelocitySleepThreshold', cfg.pointVelocitySleepThreshold);
  setIf('mTimeBeforeSleep', cfg.timeBeforeSleep);
  setIf('mMinVelocityForRestitution', cfg.minVelocityForRestitution);
  setIf('mLinearCastThreshold', cfg.linearCastThreshold);
  setIf('mLinearCastMaxPenetration', cfg.linearCastMaxPenetration);
  setIf('mUseManifoldReduction', cfg.manifoldReduction);
  setIf('mUseBodyPairContactCache', cfg.bodyPairCache);
  setIf('mAllowSleeping', cfg.sleep === false ? false : null);
  system.SetPhysicsSettings(ps);
  const eff = system.GetPhysicsSettings();
  const params = {
    dt: cfg.dt,
    collisionSteps: cfg.collisionSteps ?? 1,
    jsDefaults,
    mBaumgarte: eff.mBaumgarte,
    mSpeculativeContactDistance: eff.mSpeculativeContactDistance,
    mPenetrationSlop: eff.mPenetrationSlop,
    mNumVelocitySteps: eff.mNumVelocitySteps,
    mNumPositionSteps: eff.mNumPositionSteps,
    mManifoldTolerance: eff.mManifoldTolerance,
    mPointVelocitySleepThreshold: eff.mPointVelocitySleepThreshold,
    mTimeBeforeSleep: eff.mTimeBeforeSleep,
    mMinVelocityForRestitution: eff.mMinVelocityForRestitution,
    mLinearCastThreshold: eff.mLinearCastThreshold,
    mLinearCastMaxPenetration: eff.mLinearCastMaxPenetration,
    mUseManifoldReduction: eff.mUseManifoldReduction,
    mDeterministicSimulation: eff.mDeterministicSimulation,
    hullMaxConvexRadius: cfg.convexRadius ?? 'default(0.05, auto-reduced)',
    hullTolerance: cfg.hullTolerance ?? 'default(1e-3)',
  };

  const v3 = (a) => new Jolt.Vec3(a[0], a[1], a[2]);
  const rv3 = (a) => new Jolt.RVec3(a[0], a[1], a[2]);
  const quat = (q) => new Jolt.Quat(q[0], q[1], q[2], q[3]);
  const check = (res, what) => {
    if (res.HasError()) throw new Error(`jolt: ${what}: ${res.GetError().c_str()}`);
    return res.Get();
  };

  // Static geometry: one static body carrying a compound of capsules / boxes (or one body per shape).
  const separate = cfg.staticBodies === 'separate';
  const staticCompound = new Jolt.StaticCompoundShapeSettings();
  const addStatic = (shapeSettings, pos, q) => {
    if (!separate) {
      staticCompound.AddShape(v3(pos), quat(q), shapeSettings, 0);
      return;
    }
    const shape = check(shapeSettings.Create(), 'static shape');
    const bcs = new Jolt.BodyCreationSettings(shape, rv3(pos), quat(q), Jolt.EMotionType_Static, L_STATIC);
    bcs.mFriction = scene.friction;
    bcs.mRestitution = scene.restitution;
    bi.AddBody(bi.CreateBody(bcs).GetID(), Jolt.EActivation_DontActivate);
    Jolt.destroy(bcs);
  };
  for (const s of scene.statics) {
    if (s.type === 'capsule') {
      const d = sub(s.b, s.a);
      addStatic(new Jolt.CapsuleShapeSettings(len(d) / 2, s.r), scale(add(s.a, s.b), 0.5), qFromYTo(d));
    } else {
      const cr = Math.min(cfg.convexRadius ?? 0.05, 0.25 * Math.min(s.h[0], s.h[1], s.h[2]));
      addStatic(new Jolt.BoxShapeSettings(v3(s.h), cr), s.c, s.q);
    }
  }
  if (!separate && scene.statics.length) {
    const shape = check(staticCompound.Create(), 'static compound');
    const bcs = new Jolt.BodyCreationSettings(shape, rv3([0, 0, 0]), quat([0, 0, 0, 1]), Jolt.EMotionType_Static, L_STATIC);
    bcs.mFriction = scene.friction;
    bcs.mRestitution = scene.restitution;
    bi.AddBody(bi.CreateBody(bcs).GetID(), Jolt.EActivation_DontActivate);
    Jolt.destroy(bcs);
  }

  // Dynamic bodies: one StaticCompoundShape of convex hulls per unique tableware shape (shared).
  const shapeCache = {};
  const hullInfo = {};
  const getShape = (key) => {
    if (shapeCache[key]) return shapeCache[key];
    const sh = scene.shapes[key];
    const comp = new Jolt.StaticCompoundShapeSettings();
    for (const pts of sh.pieces) {
      const hull = new Jolt.ConvexHullShapeSettings();
      for (let i = 0; i < pts.length; i += 3) hull.mPoints.push_back(new Jolt.Vec3(pts[i], pts[i + 1], pts[i + 2]));
      if (cfg.convexRadius != null) hull.mMaxConvexRadius = cfg.convexRadius;
      if (cfg.hullTolerance != null) hull.mHullTolerance = cfg.hullTolerance;
      comp.AddShape(v3([0, 0, 0]), quat([0, 0, 0, 1]), hull, 0);
    }
    const shape = check(comp.Create(), `compound for ${key}`);
    shape.AddRef();
    shapeCache[key] = shape;
    const com = shape.GetCenterOfMass();
    hullInfo[key] = { comOffset: [com.GetX(), com.GetY(), com.GetZ()] };
    return shape;
  };
  const bodies = [];
  for (const b of scene.bodies) {
    const shape = getShape(b.shape);
    const bcs = new Jolt.BodyCreationSettings(shape, rv3(b.pos), quat(b.quat), Jolt.EMotionType_Dynamic, L_MOVING);
    bcs.mOverrideMassProperties = Jolt.EOverrideMassProperties_CalculateInertia;
    bcs.mMassPropertiesOverride.mMass = b.mass;
    bcs.mFriction = scene.friction;
    bcs.mRestitution = scene.restitution;
    bcs.mLinearDamping = cfg.linearDamping ?? 0;
    bcs.mAngularDamping = cfg.angularDamping ?? 0;
    bcs.mLinearVelocity = v3(b.linvel);
    bcs.mAngularVelocity = v3(b.angvel);
    bcs.mMotionQuality = cfg.ccd ? Jolt.EMotionQuality_LinearCast : Jolt.EMotionQuality_Discrete;
    bcs.mAllowSleeping = cfg.sleep !== false;
    if (cfg.bodyManifoldReduction != null) bcs.mUseManifoldReduction = cfg.bodyManifoldReduction;
    if (cfg.maxLinearVelocity != null) bcs.mMaxLinearVelocity = cfg.maxLinearVelocity;
    const body = bi.CreateBody(bcs);
    bi.AddBody(body.GetID(), Jolt.EActivation_Activate);
    Jolt.destroy(bcs);
    bodies.push(body);
  }
  system.OptimizeBroadPhase();
  const collisionSteps = cfg.collisionSteps ?? 1;

  return {
    engine: 'jolt',
    version: '1.1.0',
    loadMs,
    n: bodies.length,
    params,
    hullInfo,
    masses: () => bodies.map((b) => 1 / b.GetMotionProperties().GetInverseMass()),
    step() {
      jolt.Step(cfg.dt, collisionSteps);
    },
    read(out) {
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        const o = i * 13;
        const p = b.GetPosition();
        out[o] = p.GetX(); out[o + 1] = p.GetY(); out[o + 2] = p.GetZ();
        const r = b.GetRotation();
        out[o + 3] = r.GetX(); out[o + 4] = r.GetY(); out[o + 5] = r.GetZ(); out[o + 6] = r.GetW();
        const v = b.GetLinearVelocity();
        out[o + 7] = v.GetX(); out[o + 8] = v.GetY(); out[o + 9] = v.GetZ();
        const w = b.GetAngularVelocity();
        out[o + 10] = w.GetX(); out[o + 11] = w.GetY(); out[o + 12] = w.GetZ();
      }
      return out;
    },
    sleeping: (i) => !bodies[i].IsActive(),
    applyImpulse(i, J, point) {
      const j = v3(J);
      const p = rv3(point);
      bi.ActivateBody(bodies[i].GetID());
      bi.AddImpulse(bodies[i].GetID(), j, p);
      Jolt.destroy(j);
      Jolt.destroy(p);
    },
    addForce(i, F, point) {
      // Jolt clears accumulated forces every step: call before each step while the force acts.
      const f = v3(F);
      const p = rv3(point);
      bi.AddForce(bodies[i].GetID(), f, p, Jolt.EActivation_Activate);
      Jolt.destroy(f);
      Jolt.destroy(p);
    },
    resetForces() {},
    snapshot() {
      const rec = new Jolt.StateRecorderImpl();
      system.SaveState(rec);
      return rec;
    },
    restore(rec) {
      rec.Rewind();
      if (!system.RestoreState(rec)) throw new Error('jolt: RestoreState failed');
    },
    snapshotBytes: () => null,
    memory: () => ({ wasmHeapMB: Jolt.HEAPU8.length / 1048576 }),
    free() {
      Jolt.destroy(jolt);
    },
  };
}
