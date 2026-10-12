/**
 * Checks that a call of the game survives a long stall of this process: a scripted policy
 * plans synchronously for minutes while the game server (in the same process) cannot answer,
 * and the server closes idle kept-alive connections after 72 s. A request on a connection
 * that was kept alive across the stall fails; the game client opens one per call.
 *
 *   pnpm --filter @spotless/bench exec tsx scripts/blocked-loop.ts [--seconds 80]
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { GameClient } from '@spotless/mcp';
import { placeholderWashRunner } from '@spotless/session';
import { startGame } from '../src/game.ts';

const { values } = parseArgs({ options: { seconds: { type: 'string', default: '80' } } });
const dataDir = mkdtempSync(join(tmpdir(), 'spotless-blocked-'));
const game = await startGame({
  dataDir,
  render: false,
  server: { washRunner: placeholderWashRunner },
});
const id = await game.createEpisode('tutorial', { kind: 'scripted', name: 'stall-test' });
const client = new GameClient({ server: game.url, sessionId: id });

// A kept-alive connection, as a plain fetch leaves it.
await (await fetch(`${game.url}/api/health`)).json();
await client.call('get_state', {});

const until = Date.now() + Number(values.seconds) * 1000;
let spins = 0;
while (Date.now() < until) spins += 1;
console.log(`stalled for ${values.seconds} s (${spins} spins)`);

const viaClient = await client.call('get_state', {}).then(
  (answer) => `answered (HTTP ${answer.status})`,
  (error: unknown) => `FAILED: ${error instanceof Error ? error.message : String(error)}`,
);
const viaKeptAlive = await fetch(`${game.url}/api/health`).then(
  (response) => `answered (HTTP ${response.status})`,
  (error: unknown) => `failed: ${error instanceof Error ? error.message : String(error)}`,
);
console.log(`game client, one connection per call: ${viaClient}`);
console.log(`plain fetch on the connection kept alive across the stall: ${viaKeptAlive}`);
await game.close();
rmSync(dataDir, { recursive: true, force: true });
process.exit(viaClient.startsWith('answered') ? 0 : 1);
