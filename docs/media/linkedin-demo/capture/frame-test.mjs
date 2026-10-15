import { openPage, manual, step, setCam, getCam, shoot, outDir, newSession } from './lib.mjs';
const sid = process.argv[2] || await newSession('tutorial');
const dir = outDir(process.argv[3]);
const { browser, page } = await openPage({ sid });
await manual(page);
const vc = async (v) => { await page.evaluate((v) => window.spotless.setView(v), v); return getCam(page); };
const L = await vc('iso_lower'), U = await vc('iso_upper'), O = await vc('orbit');
console.log(JSON.stringify({ L, U, O }));
const tries = JSON.parse(process.argv[4]);
for (const [name, c] of Object.entries(tries)) {
  const base = { L, U, O }[c.base];
  await setCam(page, { ...base, ...c, target: c.target ?? base.target.map((v, i) => v + (c.shift?.[i] ?? 0)), dist: base.dist * (c.zoom ?? 1) });
  await step(page, 1);
  await shoot(page, `${dir}/${name}.jpg`);
}
await browser.close();
