// Verify that no scene starts with interpenetration (neutral Parry measurement, no engine involved).
import { SCENES } from './scenes.mjs';
import { createMeasurer } from './measure.mjs';
const variants = { T1: [{}], T2: [{}], T3: [{}, { alignFacets: true }], T4a: [{}], T4b: [{}], T5: [{}], FULL: [{}],
  T6knife: [0.007, 0.011, 0.016, 0.02].flatMap((gap) => ['edge', 'flat'].map((mode) => ({ gap, mode }))), T6plate: [0.011, 0.014, 0.017, 0.02].map((gap) => ({ gap })) };
let bad = 0;
for (const [name, list] of Object.entries(variants)) {
  for (const o of list) {
    const scene = SCENES[name](o);
    const m = await createMeasurer(scene);
    const st = new Float64Array(scene.bodies.length * 13);
    scene.bodies.forEach((b, i) => st.set([...b.pos, ...b.quat, ...b.linvel, ...b.angvel], i * 13));
    const r = m.measure(st);
    const ok = r.penStatic < 1e-6 && r.penDynamic < 1e-6;
    if (!ok) bad++;
    console.log(`${ok ? 'ok ' : 'BAD'} ${scene.name} ${JSON.stringify(o)} static=${(r.penStatic * 1000).toFixed(4)}mm dynamic=${(r.penDynamic * 1000).toFixed(4)}mm pairs=${r.pairsTested}`, ok ? '' : JSON.stringify([r.worstStatic, r.worstDynamic]));
    m.free();
  }
}
process.exit(bad ? 1 : 0);
