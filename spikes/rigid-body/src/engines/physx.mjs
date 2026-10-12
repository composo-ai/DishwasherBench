// PhysX 5 adapter (physx-js-webidl, single-threaded WASM). Optional fourth candidate.
import { sub, len, scale, add, norm, cross, qAxisAngle } from '../math.mjs';

export const PRESETS = {
  // Out of the box: PxTolerancesScale(length 1, speed 10), PGS solver, 4/1 iterations, contact offset 20 mm.
  default: { ccd: false, sleep: true },
  // Tuned for millimetre-scale tableware (see RESULTS.md).
  tuned: {
    ccd: false,
    sleep: true,
    tolLength: 0.1,
    tolSpeed: 1,
    solver: 'tgs',
    posIters: 8,
    velIters: 2,
    contactOffset: 0.002,
    restOffset: 0,
    bounceThreshold: 0.2,
    enhancedDeterminism: true,
  },
};
PRESETS['tuned-ccd'] = { ...PRESETS.tuned, ccd: true };
export const CCD_VARIANTS = [
  { label: 'noCCD', over: { ccd: false } },
  { label: 'CCD', over: { ccd: true } },
  { label: 'speculativeCCD', over: { ccd: false, speculativeCcd: true } },
];

let cached = null;
export async function load() {
  if (!cached) {
    const t0 = performance.now();
    // physx-js-webidl 2.8.0 is an Emscripten build for ENVIRONMENT=web,worker only: its preamble throws
    // "not compiled for this environment" under Node. Workaround for this spike: hide `process` and
    // pretend to be a window while the module initialises, and hand it the .wasm bytes directly.
    const { readFileSync } = await import('node:fs');
    const { createRequire } = await import('node:module');
    const wasmPath = createRequire(import.meta.url).resolve('physx-js-webidl/physx-js-webidl.wasm');
    const wasmBinary = readFileSync(wasmPath);
    const realProcess = globalThis.process;
    let px;
    try {
      globalThis.process = undefined;
      globalThis.window = globalThis;
      const PhysX = (await import('physx-js-webidl')).default;
      px = await PhysX({ wasmBinary, locateFile: (f) => f });
    } finally {
      globalThis.process = realProcess;
      delete globalThis.window;
    }
    const version = px.PxTopLevelFunctions.prototype.PHYSICS_VERSION;
    const allocator = new px.PxDefaultAllocator();
    const errorCb = new px.PxDefaultErrorCallback();
    const foundation = px.PxTopLevelFunctions.prototype.CreateFoundation(version, allocator, errorCb);
    cached = { px, version, foundation, loadMs: performance.now() - t0, physics: {} };
  }
  return cached;
}

/** Quaternion rotating +X onto `dir` (PhysX capsules are aligned with the local X axis). */
function qFromXTo(dir) {
  const d = norm(dir);
  const c = d[0];
  if (c > 1 - 1e-12) return [0, 0, 0, 1];
  if (c < -1 + 1e-12) return [0, 0, 1, 0];
  return qAxisAngle(cross([1, 0, 0], d), Math.acos(c));
}

export async function create(scene, cfg) {
  const L = await load();
  const { px, version, foundation, loadMs } = L;
  const F = px.PxTopLevelFunctions.prototype;
  const tol = new px.PxTolerancesScale();
  if (cfg.tolLength != null) tol.length = cfg.tolLength;
  if (cfg.tolSpeed != null) tol.speed = cfg.tolSpeed;
  // One PxPhysics per tolerance scale (PhysX allows a single PxPhysics instance at a time).
  const key = `${tol.length}/${tol.speed}`;
  if (L.physicsKey !== key) {
    if (L.physicsObj) L.physicsObj.release();
    L.physicsObj = F.CreatePhysics(version, foundation, tol);
    L.physicsKey = key;
  }
  const physics = L.physicsObj;
  const E = (name, member) => px[name]?.[member] ?? px[member] ?? px[`_emscripten_enum_${name}_${member}`]();

  const sceneDesc = new px.PxSceneDesc(tol);
  sceneDesc.gravity = new px.PxVec3(scene.gravity[0], scene.gravity[1], scene.gravity[2]);
  sceneDesc.cpuDispatcher = F.DefaultCpuDispatcherCreate(0);
  sceneDesc.filterShader = F.DefaultFilterShader();
  if (cfg.solver === 'tgs') sceneDesc.solverType = E('PxSolverTypeEnum', 'eTGS');
  if (cfg.bounceThreshold != null) sceneDesc.bounceThresholdVelocity = cfg.bounceThreshold;
  const anyCcd = true; // scene-level CCD is always enabled; bodies opt in
  if (anyCcd) sceneDesc.flags.raise(E('PxSceneFlagEnum', 'eENABLE_CCD'));
  if (cfg.enhancedDeterminism) sceneDesc.flags.raise(E('PxSceneFlagEnum', 'eENABLE_ENHANCED_DETERMINISM'));
  if (cfg.sleep === false) sceneDesc.flags.raise(E('PxSceneFlagEnum', 'eDISABLE_SLEEPING'));
  const pxScene = physics.createScene(sceneDesc);

  const material = physics.createMaterial(scene.friction, scene.friction, scene.restitution);
  const shapeFlags = new px.PxShapeFlags(E('PxShapeFlagEnum', 'eSIMULATION_SHAPE'));
  // fabmax's default filter shader: collide if (a.word0 & b.word1) or (b.word0 & a.word1); word2 = extra PxPairFlags.
  const ccdPair = E('PxPairFlagEnum', 'eDETECT_CCD_CONTACT');
  const filterStatic = new px.PxFilterData(1, 2, 0, 0);
  const filterDyn = new px.PxFilterData(2, 3, cfg.ccd ? ccdPair : 0, 0);
  const tuneShape = (shape, filter) => {
    if (cfg.contactOffset != null) shape.setContactOffset(cfg.contactOffset);
    if (cfg.restOffset != null) shape.setRestOffset(cfg.restOffset);
    shape.setSimulationFilterData(filter);
    return shape;
  };
  const pose = (p, q) => new px.PxTransform(new px.PxVec3(p[0], p[1], p[2]), new px.PxQuat(q[0], q[1], q[2], q[3]));
  const identity = pose([0, 0, 0], [0, 0, 0, 1]);

  // Static geometry: a single PxRigidStatic with one shape per capsule / box.
  const ground = physics.createRigidStatic(identity);
  for (const s of scene.statics) {
    let geom;
    let lp;
    if (s.type === 'capsule') {
      const d = sub(s.b, s.a);
      geom = new px.PxCapsuleGeometry(s.r, len(d) / 2);
      lp = pose(scale(add(s.a, s.b), 0.5), qFromXTo(d));
    } else {
      geom = new px.PxBoxGeometry(s.h[0], s.h[1], s.h[2]);
      lp = pose(s.c, s.q);
    }
    const shape = tuneShape(physics.createShape(geom, material, true, shapeFlags), filterStatic);
    shape.setLocalPose(lp);
    ground.attachShape(shape);
  }
  pxScene.addActor(ground);

  // Convex pieces: cooked once per unique piece and shared (non-exclusive shapes) across bodies.
  const cooking = new px.PxCookingParams(tol);
  if (cfg.planeTolerance != null) cooking.planeTolerance = cfg.planeTolerance;
  if (cfg.areaTestEpsilon != null) cooking.areaTestEpsilon = cfg.areaTestEpsilon;
  const shapeCache = {};
  const getShapes = (keyName) => {
    if (shapeCache[keyName]) return shapeCache[keyName];
    const out = [];
    for (const pts of scene.shapes[keyName].pieces) {
      const arr = new px.PxArray_PxVec3(pts.length / 3);
      for (let i = 0; i < pts.length / 3; i++) arr.set(i, new px.PxVec3(pts[3 * i], pts[3 * i + 1], pts[3 * i + 2]));
      const desc = new px.PxConvexMeshDesc();
      desc.flags = new px.PxConvexFlags(E('PxConvexFlagEnum', 'eCOMPUTE_CONVEX'));
      desc.points.count = pts.length / 3;
      desc.points.stride = 12;
      desc.points.data = arr.begin();
      const mesh = F.CreateConvexMesh(cooking, desc);
      if (!mesh || px.getPointer?.(mesh) === 0) throw new Error(`physx: convex cooking failed for a piece of ${keyName}`);
      const geom = new px.PxConvexMeshGeometry(mesh);
      out.push(tuneShape(physics.createShape(geom, material, false, shapeFlags), filterDyn));
    }
    shapeCache[keyName] = out;
    return out;
  };
  const bodies = [];
  for (const b of scene.bodies) {
    const body = physics.createRigidDynamic(pose(b.pos, b.quat));
    for (const sh of getShapes(b.shape)) body.attachShape(sh);
    px.PxRigidBodyExt.prototype.setMassAndUpdateInertia(body, b.mass);
    body.setLinearDamping(0);
    body.setAngularDamping(0);
    body.setLinearVelocity(new px.PxVec3(b.linvel[0], b.linvel[1], b.linvel[2]));
    body.setAngularVelocity(new px.PxVec3(b.angvel[0], b.angvel[1], b.angvel[2]));
    if (cfg.posIters != null) body.setSolverIterationCounts(cfg.posIters, cfg.velIters ?? 1);
    if (cfg.ccd) body.setRigidBodyFlag(E('PxRigidBodyFlagEnum', 'eENABLE_CCD'), true);
    if (cfg.speculativeCcd) body.setRigidBodyFlag(E('PxRigidBodyFlagEnum', 'eENABLE_SPECULATIVE_CCD'), true);
    if (cfg.sleepThreshold != null) body.setSleepThreshold(cfg.sleepThreshold);
    if (cfg.maxDepenetrationVelocity != null) body.setMaxDepenetrationVelocity(cfg.maxDepenetrationVelocity);
    pxScene.addActor(body);
    bodies.push(body);
  }
  const impulseMode = E('PxForceModeEnum', 'eIMPULSE');
  const forceMode = E('PxForceModeEnum', 'eFORCE');
  const vtmp = (a) => new px.PxVec3(a[0], a[1], a[2]);

  return {
    engine: 'physx',
    version: '5.11.0 (physx-js-webidl 2.8.0)',
    loadMs,
    n: bodies.length,
    params: {
      dt: cfg.dt,
      tolerancesLength: tol.length,
      tolerancesSpeed: tol.speed,
      solver: cfg.solver ?? 'pgs(default)',
      posIters: cfg.posIters ?? 4,
      velIters: cfg.velIters ?? 1,
      contactOffset: cfg.contactOffset ?? `default(${0.02 * tol.length})`,
      restOffset: cfg.restOffset ?? 0,
      bounceThresholdVelocity: sceneDesc.bounceThresholdVelocity,
    },
    masses: () => bodies.map((b) => b.getMass()),
    step() {
      pxScene.simulate(cfg.dt);
      pxScene.fetchResults(true);
    },
    read(out) {
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        const o = i * 13;
        const t = b.getGlobalPose();
        out[o] = t.p.x; out[o + 1] = t.p.y; out[o + 2] = t.p.z;
        out[o + 3] = t.q.x; out[o + 4] = t.q.y; out[o + 5] = t.q.z; out[o + 6] = t.q.w;
        const v = b.getLinearVelocity();
        out[o + 7] = v.x; out[o + 8] = v.y; out[o + 9] = v.z;
        const w = b.getAngularVelocity();
        out[o + 10] = w.x; out[o + 11] = w.y; out[o + 12] = w.z;
      }
      return out;
    },
    sleeping: (i) => bodies[i].isSleeping(),
    applyImpulse(i, J, point) {
      px.PxRigidBodyExt.prototype.addForceAtPos(bodies[i], vtmp(J), vtmp(point), impulseMode, true);
    },
    addForce(i, Fv, point) {
      // PhysX clears forces after every simulate(): call before each step while the force acts.
      px.PxRigidBodyExt.prototype.addForceAtPos(bodies[i], vtmp(Fv), vtmp(point), forceMode, true);
    },
    resetForces() {},
    // No whole-scene state snapshot in these bindings: poses and velocities only (solver caches are lost).
    snapshot() {
      const st = new Float64Array(bodies.length * 13);
      this.read(st);
      return st;
    },
    restore(st) {
      for (let i = 0; i < bodies.length; i++) {
        const o = i * 13;
        bodies[i].setGlobalPose(pose([st[o], st[o + 1], st[o + 2]], [st[o + 3], st[o + 4], st[o + 5], st[o + 6]]), true);
        bodies[i].setLinearVelocity(vtmp([st[o + 7], st[o + 8], st[o + 9]]), true);
        bodies[i].setAngularVelocity(vtmp([st[o + 10], st[o + 11], st[o + 12]]), true);
      }
    },
    snapshotBytes: (st) => st.byteLength,
    memory: () => ({ wasmHeapMB: px.HEAPU8 ? px.HEAPU8.length / 1048576 : null }),
    free() {
      pxScene.release();
    },
  };
}
