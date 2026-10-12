/**
 * Lists the saved reference loads that were made for another definition of their level than
 * the one in the repository now (an item, a soil, a point, the manual or the programme
 * changed since), or that are missing: the loads to generate again.
 *
 *   pnpm --filter @spotless/loader exec tsx scripts/stale-loads.ts          one name per line
 *   pnpm --filter @spotless/loader generate-loads --jobs 6 $(pnpm --silent --filter @spotless/loader exec tsx scripts/stale-loads.ts)
 *
 * Exits 0 whether or not any is stale; prints nothing when every load is current.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { allLevels } from '@spotless/levels';
import type { StandardLoad } from '../src/standard-loads.ts';

for (const level of allLevels()) {
  const now = JSON.stringify(level);
  for (const policy of ['careful', 'careless', 'random']) {
    const name = `${level.id}-${policy}`;
    const file = fileURLToPath(new URL(`../loads/${name}.json`, import.meta.url));
    if (!existsSync(file)) {
      console.log(name);
      continue;
    }
    const load = JSON.parse(readFileSync(file, 'utf8')) as StandardLoad;
    if (JSON.stringify(load.level) !== now) console.log(name);
  }
}
