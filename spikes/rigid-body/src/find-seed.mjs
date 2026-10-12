// Helper used once to pick an RNG seed for the FULL scene that starts without any interpenetration.
import { SCENES } from './scenes.mjs';
import { createMeasurer } from './measure.mjs';
for (let seed = 4242; seed < 4262; seed++) {
  const scene = SCENES.FULL({ seed });
  const m = await createMeasurer(scene);
  const st = new Float64Array(scene.bodies.length * 13);
  scene.bodies.forEach((b, i) => st.set([...b.pos, ...b.quat, ...b.linvel, ...b.angvel], i * 13));
  const r = m.measure(st);
  console.log(seed, (r.penStatic * 1000).toFixed(4), (r.penDynamic * 1000).toFixed(4), JSON.stringify(r.worstStatic), JSON.stringify(r.worstDynamic));
  m.free();
  if (r.penStatic < 1e-6 && r.penDynamic < 1e-6) break;
}
