/**
 * Replays the action log of a saved standard load in this (fresh) process and verifies every
 * scene hash and the final one; then rebuilds the load once more and checks that both baskets
 * can be pulled out and pushed in again and that every recorded mistake is what the settled
 * poses show.
 *
 *   node --import tsx scripts/replay-load.ts loads/iec-13-careful.json
 *
 * Prints the result as one line of JSON. Exit status 0 when the load was reproduced, its
 * mistakes hold, its baskets travel and (for a load of the careful policy) nothing lies on
 * other items without touching a basket, no plate touches another item, no plate leans
 * against the tines of its row and no vessel leans far over unheld; 1 otherwise.
 */

import { readFileSync } from 'node:fs';
import { auditStandardLoad } from '../src/audit.ts';
import type { StandardLoad } from '../src/standard-loads.ts';
import { replayStandardLoad } from '../src/standard-loads.ts';

const file = process.argv[2];
if (file === undefined) {
  console.error('usage: replay-load.ts <load.json>');
  process.exit(2);
}
const load = JSON.parse(readFileSync(file, 'utf8')) as StandardLoad;
const result = await replayStandardLoad(load);
const audit = await auditStandardLoad(load);
// (A load placed by hand after a photograph has items resting on items on purpose.)
const careful = load.policy.name === 'careful' && load.policy.by_hand === undefined;
const ok =
  result.ok &&
  audit.rebuilt &&
  audit.mistakes_hold &&
  (!careful ||
    (audit.laid_over.length === 0 &&
      audit.plates_touching.length === 0 &&
      audit.posture.length === 0)) &&
  // Every load must be one that can be unloaded: both baskets go out and in again.
  audit.baskets_travel;
console.log(
  JSON.stringify({
    name: load.name,
    ok,
    expected: load.final_state_hash,
    replay: result,
    rebuilt: audit.rebuilt,
    baskets_travel: audit.baskets_travel,
    blocked: audit.travel.filter((step) => !step.accepted),
    thrown: [...new Set(audit.travel.flatMap((step) => step.thrown))],
    mistakes: audit.mistakes.length,
    mistakes_wrong: audit.mistakes.filter((entry) => !entry.holds),
    touching: audit.touching,
    laid_over: audit.laid_over,
    plates_touching: audit.plates_touching,
    posture: audit.posture,
    shifted_most: audit.shifted_most,
    shifted_worst: audit.shifted_worst,
  }),
);
process.exit(ok ? 0 : 1);
