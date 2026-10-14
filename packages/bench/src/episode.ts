/**
 * One episode from start to record: the harness creates the episode on the game server for
 * (level, player), connects the MCP server of that episode, lets the policy play through its
 * tools, starts the cycle if the policy stopped without doing so, waits for the wash,
 * verifies the episode by replaying its action log, and writes the episode record with what
 * only the harness knows (the policy and its settings, the tool calls, the pictures, the
 * tokens, the verification).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { GameClient, createSpotlessMcpServer, serveMcpHttp } from '@spotless/mcp';
import type { EpisodeRecord, EpisodeReplay } from '@spotless/server';
import type { HarnessGame } from './game.ts';
import type { Policy, PolicyOutcome } from './policy.ts';
import { EpisodeTools } from './tools.ts';
import { verifyAgainstPolicySession, verifyByReplay } from './verify.ts';

/**
 * Name and version of this harness, as records state it. 0.2.0 (2026-10-11): the tools'
 * results are shaped (MCP server 0.2.0), the model's conversation is kept under context
 * policy `standard-2`, and the record names the tool interface (`versions.interface`). The
 * results table never puts episodes of different harness versions, tool interfaces, prompt
 * versions or context policies on one line.
 */
export const HARNESS_ID = 'spotless-bench/0.2.0';

/** How the agent's MCP client reaches the MCP server of the episode. */
export type McpTransportKind = 'memory' | 'stdio' | 'http';

/**
 * How an episode is verified: `replay` applies its log to a fresh session; `policy_session`
 * compares it with the scripted policy's own session; `auto` is `policy_session` for a
 * scripted policy (whose session has already made every call once) and `replay` otherwise;
 * `none` skips it.
 */
export type VerifyMode = 'auto' | 'replay' | 'policy_session' | 'none';

/** Options of {@link runEpisode}. */
export interface RunEpisodeOptions {
  readonly game: HarnessGame;
  readonly levelId: string;
  readonly policy: Policy;
  /** Seed of the policy's own random choices; default 1. */
  readonly seed?: number;
  /** Directory the episode's own directory is made in. */
  readonly outDir: string;
  /** Default `memory`: the MCP server runs in this process. */
  readonly transport?: McpTransportKind;
  /** Default `auto`. */
  readonly verify?: VerifyMode;
  /** Give up waiting for the wash after this many seconds; default 2 hours. */
  readonly washTimeoutS?: number;
  /** Save the pictures the tools return; default true. */
  readonly saveImages?: boolean;
  /** Receives progress lines; default none. */
  readonly log?: (line: string) => void;
}

/** Times a wash is started again after the simulation's source changed under it. */
const SOURCE_CHANGE_RETRIES = 4;

/** An episode that was run. */
export interface EpisodeResult {
  readonly record: EpisodeRecord;
  /** The episode's directory. */
  readonly dir: string;
  /** The record file in it. */
  readonly file: string;
}

function safeName(name: string): string {
  return name.replace(/[^A-Za-z0-9_.-]+/g, '-');
}

function pause(ms: number): Promise<void> {
  return new Promise<void>((next) => {
    setTimeout(next, ms);
  });
}

interface Connected {
  readonly client: Client;
  close(): Promise<void>;
}

const MCP_PACKAGE = fileURLToPath(new URL('../../mcp/', import.meta.url));

/** Connects an MCP client to the MCP server of an episode over the transport asked for. */
async function connect(
  game: HarnessGame,
  episodeId: string,
  kind: McpTransportKind,
): Promise<Connected> {
  const client = new Client({ name: 'spotless-bench', version: '0.2.0' });
  if (kind === 'stdio') {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        '--import',
        'tsx',
        join(MCP_PACKAGE, 'src', 'cli.ts'),
        '--server',
        game.url,
        '--session',
        episodeId,
      ],
      cwd: MCP_PACKAGE,
      stderr: 'inherit',
    });
    await client.connect(transport as unknown as Transport);
    return { client, close: () => client.close() };
  }
  const gameClient = new GameClient({ server: game.url, sessionId: episodeId });
  if (kind === 'http') {
    const served = await serveMcpHttp({ game: gameClient, port: 0 });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(served.url)) as unknown as Transport,
    );
    return {
      client,
      close: async () => {
        await client.close();
        await served.close();
      },
    };
  }
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const server = createSpotlessMcpServer({ game: gameClient });
  await server.connect(serverSide as unknown as Transport);
  await client.connect(clientSide as unknown as Transport);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

/**
 * Why an episode has no result, in a sentence, or null when it has one: its wash failed, no
 * cycle was started, or there is no score. A batch with such an episode did not succeed, and
 * the command line exits with 1 (a failed wash is an infrastructure failure, never a score of
 * zero: docs/research/benchmark.md section 4.6).
 */
export function episodeProblem(record: EpisodeRecord): string | null {
  if (record.wash?.status === 'failed') {
    return `the wash failed: ${(record.wash.error ?? 'no reason given').split('\n')[0] ?? ''}`;
  }
  if (record.wash === null) return 'no cycle was started: there is nothing to score';
  if (record.score === null) return 'the episode has no score';
  return null;
}

/** Waits until the episode's wash has ended (or there is none). Returns the last job status. */
async function waitForWash(
  game: HarnessGame,
  episodeId: string,
  timeoutS: number,
  log: (line: string) => void,
): Promise<string | null> {
  const deadline = performance.now() + timeoutS * 1000;
  let said = -1;
  for (;;) {
    const summary = await game.summary(episodeId);
    const job = summary.job;
    if (job === null) return null;
    if (job.status !== 'queued' && job.status !== 'running') return job.status;
    const tenth = Math.floor(job.progress * 10);
    if (tenth !== said) {
      said = tenth;
      log(`wash ${job.status}, ${Math.round(job.progress * 100)}%`);
    }
    if (performance.now() > deadline) throw new Error(`the wash did not end within ${timeoutS} s`);
    await pause(500);
  }
}

/** Runs one episode and writes its record. */
export async function runEpisode(options: RunEpisodeOptions): Promise<EpisodeResult> {
  const { game, policy } = options;
  const log = options.log ?? ((): void => undefined);
  const seed = options.seed ?? 1;
  const transport = options.transport ?? 'memory';
  const level = game.levels.get(options.levelId);
  if (level === undefined) throw new Error(`no level '${options.levelId}'`);

  const episodeId = await game.createEpisode(options.levelId, {
    kind: policy.kind,
    name: policy.name,
    interface: `mcp/${transport}`,
  });
  const dir = join(
    options.outDir,
    `${safeName(options.levelId)}__${safeName(policy.name)}__s${seed}__${episodeId.slice(0, 8)}`,
  );
  mkdirSync(dir, { recursive: true });
  log(`episode ${episodeId}: ${options.levelId}, ${policy.name}, seed ${seed}`);

  const connected = await connect(game, episodeId, transport);
  const tools = new EpisodeTools({
    client: connected.client,
    imagesDir: options.saveImages === false ? null : join(dir, 'images'),
  });
  let outcome: PolicyOutcome;
  let toolInterface: Awaited<ReturnType<EpisodeTools['identity']>>;
  try {
    toolInterface = await tools.identity();
    outcome = await policy.play({ tools, level, seed, log });
  } finally {
    await connected.close();
  }
  log(
    `${policy.name} stopped: ${outcome.stopped}${outcome.detail === undefined ? '' : ` (${outcome.detail})`} after ${tools.calls.length} calls`,
  );

  // Whatever is loaded is washed; a failure of the model's API leaves the episode without a result.
  let startedByHarness = false;
  const notes: string[] = [];
  if (!outcome.failed) {
    const startIfLoading = async (): Promise<void> => {
      const summary = await game.summary(episodeId);
      if (summary.phase !== 'loading' || summary.budget.washes_used >= summary.budget.washes_max)
        return;
      const started = await game.startCycle(episodeId);
      if (started.accepted) startedByHarness = true;
      else
        notes.push(
          `start_cycle by the harness was refused: ${started.reason ?? ''} ${started.detail ?? ''}`.trim(),
        );
    };
    await startIfLoading();
    let status = await waitForWash(game, episodeId, options.washTimeoutS ?? 7200, log);
    // An infrastructure failure is retried once (benchmark.md section 4.6). A wash that was
    // refused because the simulation's source changed while it ran (benchmark mode gives no
    // result then) is no fault of the wash and is started again up to four more times: on a
    // checkout that is being worked on that happens, on a pinned one never.
    let ordinary = 0;
    let sourceChanged = 0;
    while (status === 'failed') {
      const error = (await game.record(episodeId)).wash?.error ?? '';
      const moved = error.includes('source of the simulation changed');
      if (moved ? sourceChanged >= SOURCE_CHANGE_RETRIES : ordinary >= 1) break;
      if (moved) sourceChanged += 1;
      else ordinary += 1;
      log(`the wash failed (${error.split('\n')[0] ?? ''}); starting it again`);
      notes.push(`a wash failed and was started again: ${error.split('\n')[0] ?? 'failed'}`);
      await startIfLoading();
      status = await waitForWash(game, episodeId, options.washTimeoutS ?? 7200, log);
    }
  }

  const served = await game.record(episodeId);
  let replay: EpisodeReplay | undefined;
  const mode = options.verify ?? 'auto';
  if (mode === 'policy_session' || (mode === 'auto' && outcome.plannedLog !== undefined)) {
    if (outcome.plannedLog === undefined)
      throw new Error('verify policy_session: the policy has no session of its own');
    replay = verifyAgainstPolicySession(served, outcome.plannedLog);
  } else if (mode === 'replay' || mode === 'auto') {
    log('verifying by replay');
    replay = await verifyByReplay(served, level);
  }
  if (replay !== undefined && !replay.verified) {
    log(`NOT VERIFIED: ${replay.mismatches[0] ?? 'the replay differs'}`);
  }

  const hasImages = tools.calls.some((call) => call.images.length > 0);
  const record: EpisodeRecord = {
    ...served,
    policy: {
      name: policy.name,
      settings: {
        seed,
        ...(policy.settings() as { [key: string]: never }),
        ...(notes.length === 0 ? {} : { notes }),
      },
    },
    versions: { ...served.versions, harness: HARNESS_ID, interface: toolInterface },
    agent: {
      interface: `mcp/${transport}`,
      tool_calls: tools.calls,
      images_dir: hasImages ? 'images' : null,
      turns: outcome.turns,
      usage: outcome.usage,
      stopped:
        outcome.detail === undefined ? outcome.stopped : `${outcome.stopped}: ${outcome.detail}`,
      cycle_started_by_harness: startedByHarness,
      transcript: outcome.transcript === undefined ? null : 'transcript.json',
    },
    ...(replay === undefined ? {} : { replay }),
  };
  if (outcome.transcript !== undefined) {
    writeFileSync(join(dir, 'transcript.json'), `${JSON.stringify(outcome.transcript, null, 1)}\n`);
  }
  const file = join(dir, 'record.json');
  writeFileSync(file, `${JSON.stringify(record)}\n`);
  log(
    record.score === null
      ? 'no score'
      : `score ${record.score.points} of ${record.score.points_available} points, ${record.score.items_clean} of ${record.score.items_loaded} loaded items clean`,
  );
  return { record, dir, file };
}
