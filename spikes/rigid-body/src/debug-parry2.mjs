// Does the spurious one-shot Parry contact also appear in Rapier's simulation narrow phase?
import RAPIER from '@dimforge/rapier3d-compat';
import { SCENES } from './scenes.mjs';
import { qFromYTo, sub, add, scale, len } from './math.mjs';
await RAPIER.init();
const [seed = '4245', bodyI = '24', pieceI = '3', statI = '432', scaleS = '1'] = process.argv.slice(2);
const S = +scaleS;
const scene = SCENES.FULL({ seed: +seed });
const b = scene.bodies[+bodyI];
const pts = scene.shapes[b.shape].pieces[+pieceI];
const st = scene.statics[+statI];
const P = (x) => ({ x: x[0] * S, y: x[1] * S, z: x[2] * S });
const Q = (x) => ({ x: x[0], y: x[1], z: x[2], w: x[3] });
for (const lengthUnit of [1, 0.1]) {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.lengthUnit = lengthUnit * S;
  world.timestep = 1 / 240;
  const d = sub(st.b, st.a); const mid = scale(add(st.a, st.b), 0.5);
  const sc = world.createCollider(RAPIER.ColliderDesc.capsule((len(d) / 2) * S, st.r * S).setTranslation(mid[0] * S, mid[1] * S, mid[2] * S).setRotation(Q(qFromYTo(d))));
  const rb = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(b.pos[0] * S, b.pos[1] * S, b.pos[2] * S).setRotation(Q(b.quat)).setCanSleep(false));
  const dc = world.createCollider(RAPIER.ColliderDesc.convexHull(new Float32Array(pts).map((x) => x * S)), rb);
  const oneShot = dc.contactCollider(sc, 0.01 * S);
  for (let i = 0; i < 3; i++) world.step();
  const v = rb.linvel();
  let manifolds = [];
  world.contactPair(dc, sc, (m, flipped) => { for (let k = 0; k < m.numContacts(); k++) manifolds.push(m.contactDist(k) / S * 1000); });
  console.log(`scale=${S} lengthUnit=${world.lengthUnit}: one-shot contact dist=${oneShot ? (oneShot.distance / S * 1000).toFixed(3) + 'mm' : 'null'}; after 3 zero-gravity steps |v|=${(Math.hypot(v.x, v.y, v.z) / S).toExponential(2)} m/s; manifold dists(mm)=${JSON.stringify(manifolds.map((x) => +x.toFixed(3)))}`);
}
