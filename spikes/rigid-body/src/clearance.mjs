// node src/clearance.mjs <resultFile.json> [runIndex]  -> per-body air gap / penetration to each wire group (mm)
import { readFileSync } from 'node:fs';
import { SCENES } from './scenes.mjs';
import { clearances } from './measure.mjs';
const [file, runIdx = '0', sceneName] = process.argv.slice(2);
const d = JSON.parse(readFileSync(file, 'utf8'));
const run = d.runs[+runIdx];
const name = sceneName ?? { T1: 'T1', T2: 'T2', T3: 'T3', T9: 'T2' }[d.test];
const scene = SCENES[name](d.test === 'T3' ? { ...d.sceneOpts, alignFacets: +runIdx === 1 } : d.sceneOpts);
const st = new Float64Array(run.bodies.length * 13);
run.bodies.forEach((b, i) => st.set([...b.pos, ...b.quat], i * 13));
const cl = clearances(scene, st);
cl.forEach((c, i) => console.log(`${d.engine}/${d.preset} ${run.bodies[i].name}: ` + Object.entries(c).map(([k, v]) => `${k}=${(v * 1000).toFixed(3)}mm`).join(' ')));
