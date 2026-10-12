// Compact console view of result JSON files: node src/show.mjs <test> [filter]
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const dir = fileURLToPath(new URL('../results/', import.meta.url));
const [test, filter = ''] = process.argv.slice(2);
const f = (x, d = 3) => (x == null ? 'n/a' : typeof x === 'number' ? (Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(d)) : Array.isArray(x) ? '[' + x.map((y) => f(y, 2)).join(',') + ']' : typeof x === 'object' ? JSON.stringify(x) : String(x));
for (const file of readdirSync(dir).sort()) {
  if (!file.includes(`__${test}__`) || !file.includes(filter)) continue;
  const d = JSON.parse(readFileSync(dir + file, 'utf8'));
  const flat = d.summary.restTime_s !== undefined || d.summary.sameProcessIdentical !== undefined ? { '': d.summary } : d.summary;
  for (const [k, s] of Object.entries(flat)) {
    const { counts, detail, hash, ...rest } = s;
    console.log(`${file.replace('.json', '')} ${k}\n   ` + Object.entries(rest).map(([a, b]) => `${a}=${f(b)}`).join(' '));
  }
}
