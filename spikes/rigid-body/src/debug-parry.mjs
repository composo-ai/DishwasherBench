// Investigate a suspicious penetration report: compare Parry's contact distance with a brute-force
// lower bound (minimum distance between the capsule axis and densely sampled points of the piece).
import RAPIER from '@dimforge/rapier3d-compat';
import { SCENES } from './scenes.mjs';
import { transformPoints, qFromYTo, sub, add, scale, len } from './math.mjs';
await RAPIER.init();
const [seed = '4245', bodyI = '24', pieceI = '3', statI = '432'] = process.argv.slice(2);
const scene = SCENES.FULL({ seed: +seed });
const b = scene.bodies[+bodyI];
const pts = scene.shapes[b.shape].pieces[+pieceI];
const w = transformPoints(pts, b.pos, b.quat);
const st = scene.statics[+statI];
console.log('static', st, 'body', b.name, b.pos, 'piece verts(world):');
for (let i = 0; i < w.length; i += 3) console.log('  ', w[i].toFixed(5), w[i + 1].toFixed(5), w[i + 2].toFixed(5));
// brute force: sample convex combos of vertex pairs & triples
const V = [];
for (let i = 0; i < w.length; i += 3) V.push([w[i], w[i + 1], w[i + 2]]);
const dSeg = (p) => { const ab = sub(st.b, st.a); const t = Math.max(0, Math.min(1, ((p[0]-st.a[0])*ab[0]+(p[1]-st.a[1])*ab[1]+(p[2]-st.a[2])*ab[2]) / (ab[0]**2+ab[1]**2+ab[2]**2))); return len(sub(p, add(st.a, scale(ab, t)))); };
let best = Infinity;
for (let i = 0; i < V.length; i++) for (let j = i; j < V.length; j++) for (let k = j; k < V.length; k++) for (let u = 0; u <= 10; u++) for (let v2 = 0; v2 <= 10 - u; v2++) {
  const a = u / 10, c = v2 / 10, e = 1 - a - c;
  const p = [V[i][0]*a+V[j][0]*c+V[k][0]*e, V[i][1]*a+V[j][1]*c+V[k][1]*e, V[i][2]*a+V[j][2]*c+V[k][2]*e];
  best = Math.min(best, dSeg(p));
}
console.log('brute-force min distance axis->piece (mm):', (best * 1000).toFixed(4), ' => surface gap (mm):', ((best - st.r) * 1000).toFixed(4));
const d = sub(st.b, st.a); const mid = scale(add(st.a, st.b), 0.5); const q = qFromYTo(d);
const capsule = new RAPIER.Capsule(len(d) / 2, st.r);
const hull = new RAPIER.ConvexPolyhedron(new Float32Array(pts));
const Q = (x) => ({ x: x[0], y: x[1], z: x[2], w: x[3] }); const P = (x) => ({ x: x[0], y: x[1], z: x[2] });
for (const pred of [0, 0.01]) {
  const c = hull.contactShape(P(b.pos), Q(b.quat), capsule, P(mid), Q(q), pred);
  console.log('parry hull-vs-capsule prediction', pred, c ? { dist_mm: c.distance * 1000, p1: c.point1, p2: c.point2, n1: c.normal1 } : null);
  const c2 = capsule.contactShape(P(mid), Q(q), hull, P(b.pos), Q(b.quat), pred);
  console.log('parry capsule-vs-hull prediction', pred, c2 ? { dist_mm: c2.distance * 1000 } : null);
}
// Same with the world origin shifted so the pair sits near (0,0,0): tests f32 cancellation at y = 0.4
const sh = [-b.pos[0], -b.pos[1], -b.pos[2]];
const c3 = hull.contactShape(P([0, 0, 0]), Q(b.quat), capsule, P(add(mid, sh)), Q(q), 0.01);
console.log('parry (recentred)', c3 ? { dist_mm: c3.distance * 1000 } : null);
