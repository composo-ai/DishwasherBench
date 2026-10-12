// node src/gap.mjs <T3 result file> [runIndex] -> lower bound on the air gap between consecutive bowls (mm)
import { readFileSync } from 'node:fs';
import { SCENES } from './scenes.mjs';
import { bodyGapLowerBound } from './measure.mjs';
const [file, runIdx = '0'] = process.argv.slice(2);
const d = JSON.parse(readFileSync(file, 'utf8'));
const run = d.runs[+runIdx];
const scene = SCENES.T3({ ...d.sceneOpts, alignFacets: +runIdx === 1 });
const st = new Float64Array(run.bodies.length * 13);
run.bodies.forEach((b, i) => st.set([...b.pos, ...b.quat], i * 13));
console.log(`${d.engine}/${d.preset} run ${runIdx}: bowl-to-bowl gap lower bound (mm): ${bodyGapLowerBound(scene, st).map((x) => (x * 1000).toFixed(3)).join(' / ')}`);
