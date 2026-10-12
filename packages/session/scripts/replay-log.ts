/**
 * Replays an action log in a fresh process and verifies every scene hash.
 *
 *   node --import tsx scripts/replay-log.ts <file.json> [--queries]
 *
 * The file holds `{ "level": <Level>, "log": <ActionLogEvent[]> }`. Prints the replay result as
 * one line of JSON and exits with status 0 when every hash was reproduced, 1 otherwise.
 */

import { readFileSync } from 'node:fs';
import type { Level } from '@spotless/levels';
import type { ActionLogEvent } from '../src/index.ts';
import { replayActionLog } from '../src/index.ts';

const file = process.argv[2];
if (file === undefined) {
  console.error('usage: replay-log.ts <file.json> [--queries]');
  process.exit(2);
}
const saved = JSON.parse(readFileSync(file, 'utf8')) as { level: Level; log: ActionLogEvent[] };
const result = await replayActionLog(saved.level, saved.log, {
  queries: process.argv.includes('--queries'),
});
// The manifest is not printed: it holds the level and its seed, and the hashes are the answer.
const { manifest: _manifest, ...summary } = result;
console.log(JSON.stringify(summary));
process.exit(result.ok ? 0 : 1);
