// Print shape and scene statistics (sanity check of the engine-neutral data).
import { makePlate, makeBowl, makeTumbler, makeMug, makeKnife, makeFork, makeSpoon, shapeStats, bowlNestSpacing } from './shapes.mjs';
import { SCENES, sceneCounts } from './scenes.mjs';
const shapes = [makePlate(12), makePlate(16), makePlate(24), makePlate(36), makeBowl(16, 4), makeBowl(24, 5), makeTumbler(16), makeMug(16), makeKnife(), makeFork(), makeSpoon()];
console.table(shapes.map(shapeStats).map((s) => ({ ...s, volume_cm3: +s.volume_cm3.toFixed(2), density: Math.round(s.density) })));
console.log('ideal bowl nest spacing (mm):', (bowlNestSpacing() * 1000).toFixed(2));
const rows = {};
for (const [k, f] of Object.entries(SCENES)) rows[k] = { ...sceneCounts(f()), ...Object.fromEntries(Object.entries(f().meta).filter(([, v]) => typeof v === 'number').map(([a, b]) => [a, +b.toFixed(4)])) };
console.table(rows);
