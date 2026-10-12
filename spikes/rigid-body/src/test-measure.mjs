// Sanity tests for the SAT measurer against analytically known configurations.
import { createMeasurer } from './measure.mjs';
import { qAxisAngle } from './math.mjs';
const boxPts = (hx, hy, hz) => new Float64Array([-hx,-hy,-hz, hx,-hy,-hz, hx,-hy,hz, -hx,-hy,hz, -hx,hy,-hz, hx,hy,-hz, hx,hy,hz, -hx,hy,hz]);
const shape = { name: 'box', pieces: [boxPts(0.01, 0.002, 0.03)], boundingRadius: 0.04 };
let fails = 0;
async function expect(label, statics, bodies, wantStatic, wantDyn) {
  const scene = { statics, shapes: { box: shape }, bodies: bodies.map((b) => ({ shape: 'box', ...b })) };
  const m = await createMeasurer(scene);
  const st = new Float64Array(bodies.length * 13);
  bodies.forEach((b, i) => st.set([...b.pos, ...b.quat], i * 13));
  const r = m.measure(st);
  const ok = Math.abs(r.penStatic - wantStatic) < 1e-9 && Math.abs(r.penDynamic - wantDyn) < 1e-9;
  if (!ok) fails++;
  console.log(ok ? 'ok ' : 'BAD', label, 'static', (r.penStatic * 1000).toFixed(6), 'want', (wantStatic * 1000).toFixed(6), '| dyn', (r.penDynamic * 1000).toFixed(6), 'want', (wantDyn * 1000).toFixed(6));
}
const I = [0, 0, 0, 1];
const wire = (y) => [{ type: 'capsule', a: [0, y, -0.1], b: [0, y, 0.1], r: 0.002 }];
// Box (4 mm thick slab, bottom face at y = -0.002) above a wire along Z whose top is at y = yWire + 0.002.
await expect('face-on, 1 mm gap', wire(-0.005), [{ pos: [0, 0, 0], quat: I }], 0, 0);
await expect('face-on, touching', wire(-0.004), [{ pos: [0, 0, 0], quat: I }], 0, 0);
await expect('face-on, 0.5 mm deep', wire(-0.0035), [{ pos: [0, 0, 0], quat: I }], 0.0005, 0);
await expect('face-on, 1.9 mm deep', wire(-0.0021), [{ pos: [0, 0, 0], quat: I }], 0.0019, 0);
await expect('axis inside slab (wire centre 1 mm inside): depth = r + 1 mm', wire(-0.001), [{ pos: [0, 0, 0], quat: I }], 0.003, 0);
await expect('wire fully through slab centre: depth = r + 2 mm', wire(0), [{ pos: [0, 0, 0], quat: I }], 0.004, 0);
// Edge case: wire beside the slab's long edge (x = 0.01), diagonal approach: closest feature is the edge.
{
  const d = 0.0015; // distance from the edge (0.01, -0.002) to the wire axis, at 45 degrees
  const s = d / Math.SQRT2;
  await expect('edge-on diagonal, 0.5 mm deep', [{ type: 'capsule', a: [0.01 + s, -0.002 - s, -0.1], b: [0.01 + s, -0.002 - s, 0.1], r: 0.002 }], [{ pos: [0, 0, 0], quat: I }], 0.0005, 0);
  const d2 = 0.0025; const s2 = d2 / Math.SQRT2;
  await expect('edge-on diagonal, 0.5 mm gap', [{ type: 'capsule', a: [0.01 + s2, -0.002 - s2, -0.1], b: [0.01 + s2, -0.002 - s2, 0.1], r: 0.002 }], [{ pos: [0, 0, 0], quat: I }], 0, 0);
}
// Vertex case: capsule end pointing at the slab corner (0.01, 0.002, 0.03) along the (1,1,1) diagonal.
{
  const u = 1 / Math.sqrt(3);
  const mk = (dist) => [{ type: 'capsule', a: [0.01 + dist * u, 0.002 + dist * u, 0.03 + dist * u], b: [0.01 + (dist + 0.05) * u, 0.002 + (dist + 0.05) * u, 0.03 + (dist + 0.05) * u], r: 0.002 }];
  await expect('corner vs capsule end, 0.7 mm deep', mk(0.0013), [{ pos: [0, 0, 0], quat: I }], 0.0007, 0);
  await expect('corner vs capsule end, 0.3 mm gap', mk(0.0023), [{ pos: [0, 0, 0], quat: I }], 0, 0);
}
// Tine tip (vertical capsule end) under the slab: tip top at y = yEnd + r.
await expect('tine tip 0.4 mm into slab underside', [{ type: 'capsule', a: [0, -0.06, 0], b: [0, -0.0036, 0], r: 0.002 }], [{ pos: [0, 0, 0], quat: I }], 0.0004, 0);
// Box vs box: two slabs stacked with 1 mm overlap; then rotated 90 degrees about Y (still 1 mm overlap).
await expect('slab on slab, 1 mm overlap', [], [{ pos: [0, 0, 0], quat: I }, { pos: [0.001, 0.003, 0.002], quat: I }], 0, 0.001);
await expect('slab on rotated slab, 1 mm overlap', [], [{ pos: [0, 0, 0], quat: I }, { pos: [0, 0.003, 0], quat: qAxisAngle([0, 1, 0], 1.0) }], 0, 0.001);
await expect('slab over slab, 0.2 mm gap', [], [{ pos: [0, 0, 0], quat: I }, { pos: [0, 0.0042, 0], quat: qAxisAngle([0, 1, 0], 1.0) }], 0, 0);
// Edge-edge: upper slab rolled 45 deg about Z, its lower long edge pressed 0.3 mm into the lower slab's top face.
{
  const q = qAxisAngle([0, 0, 1], Math.PI / 4);
  const lowest = (0.01 + 0.002) / Math.SQRT2; // lowest point of rolled slab below its centre
  await expect('rolled slab edge 0.3 mm into slab face', [], [{ pos: [0, 0, 0], quat: I }, { pos: [0, 0.002 + lowest - 0.0003, 0], quat: q }], 0, 0.0003);
}
// Static box (basket wall) vs slab.
await expect('slab 0.6 mm into static box', [{ type: 'box', c: [0.02, 0, 0], h: [0.001, 0.05, 0.05], q: I }], [{ pos: [0.0096, 0, 0], quat: I }], 0.0006, 0);
console.log(fails ? `${fails} FAILED` : 'all measurer sanity tests passed');
process.exit(fails ? 1 : 0);
