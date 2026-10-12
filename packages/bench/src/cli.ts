/**
 * Command line of the benchmark harness.
 *
 *   spotless-bench run --levels tutorial,weeknight-dinner
 *                      --policies empty,careful,careless,random,anthropic:claude-opus-5-5,
 *                                 openai:gpt-6.1-sol
 *                      [--seeds 1,2,3] [--tier official|fast] [--out bench-results/<time>]
 *                      [--wash-params <set.json>]... [--detergent <set.json> --dose-g <grams>
 *                      [--detergent-name <name>]] [--registry-defaults] [--accept-stale-params]
 *                      [--programme <id>]
 *                      [--data <dir>] [--transport memory|stdio|http]
 *                      [--verify auto|replay|policy_session|none] [--no-render] [--no-images]
 *                      [--effort low|medium|high|xhigh|max] [--max-tokens 64000]
 *                      [--max-turns n] [--keep-images 4] [--image-slack 4]
 *                      [--fold-above 12000] [--keep-recent 5000]
 *                      [--max-input-tokens n] [--api responses|chat] [--base-url <url>] [--api-key-env <NAME>]
 *                      [--request-timeout-s 600]
 *                      [--server http://host:port --admin-token <t>]
 *   spotless-bench table <dir> [--json <file>] [--md <file>]
 *   spotless-bench verify <record.json> [--rewash [--cache <dir>]]
 *   spotless-bench link --level <id> --player <name> [--agent] [--server <url>] [--admin-token <t>]
 *
 * `run` starts a game server in benchmark mode (or uses the one named with `--server`),
 * plays every level with every policy and seed, washes at the tier asked for (official by
 * default: the tier scores are published at; a fast wash is a preview and the table says so),
 * verifies every episode, and writes one directory per episode and the results table into
 * `--out`. The parameters of the washes are the machine's own unless the options of the game
 * server's command line name others (`--wash-params`, `--detergent` with `--dose-g`,
 * `--registry-defaults`; `--accept-stale-params` washes with a parameter set made for another
 * state of the simulator, and every report then says so). `--programme` starts the cycles the
 * harness starts on a secondary programme of the level, where a level offers one (no level of
 * the game does: they are washed on Eco 50 only): an uncalibrated result. A programme a level
 * does not offer is refused before the first episode.
 * The command exits with 1 when an episode could not be run, was not verified, or has no
 * result because its wash failed: a failed wash is never a score. A policy `anthropic:<model>` is
 * a model of Anthropic's played by the standard harness; its API key is read from the
 * environment (`ANTHROPIC_API_KEY`), and running it costs money. A policy `openai:<deployment>`
 * is a model behind an OpenAI-compatible endpoint (OpenAI, an Azure deployment, ...), spoken
 * to through the Responses API unless `--api chat` asks for chat completions: its address and key are read from `SPOTLESS_OPENAI_BASE_URL` and
 * `SPOTLESS_OPENAI_API_KEY` (or the variable named with `--api-key-env`), which the command
 * line takes from the repository's `.env` when the environment does not set them.
 * `--max-input-tokens` ends an episode of a model, with its load as it stands, before its
 * requests add up to more input tokens than that: a guard on what a run can spend.
 *
 * `table` makes the results table from every episode record under a directory: the
 * harness's own and the ones the game server writes for people (`<data>/episodes`).
 *
 * Run it with `pnpm --filter @spotless/bench bench <command>`.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { allLevels } from '@spotless/levels';
import {
  createEpisodeLink,
  isEpisodeRecord,
  WASH_OPTION_FLAGS,
  WASH_OPTIONS_USAGE,
  WASH_RUNNER,
  washOptionsOf,
} from '@spotless/server';
import type { AnthropicEffort } from './anthropic.ts';
import { anthropicProvider } from './anthropic.ts';
import { runBatch } from './batch.ts';
import { STANDARD_CONTEXT_POLICY } from './context.ts';
import { REPOSITORY_ENV_FILE, loadEnvFile } from './env.ts';
import type { McpTransportKind, VerifyMode } from './episode.ts';
import { connectGame, startGame } from './game.ts';
import { llmPolicy } from './llm.ts';
import { openaiProvider } from './openai.ts';
import type { Policy } from './policy.ts';
import { readEpisodeRecords, resultsMarkdown, resultsTable } from './results.ts';
import type { ScriptedPolicyName } from './scripted.ts';
import { SCRIPTED_POLICY_NAMES, scriptedPolicy } from './scripted.ts';
import { verifyByReplay } from './verify.ts';

/** Where the command line writes. */
export interface BenchIo {
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}

const USAGE = [
  'usage:',
  `  spotless-bench run --levels <id,...> --policies <name,...> [--seeds 1] [--tier official|fast] ${WASH_OPTIONS_USAGE} [--programme <id>] [--out <dir>] [--data <dir>] [--transport memory|stdio|http] [--verify auto|replay|policy_session|none] [--no-render] [--no-images] [--effort <level>] [--max-tokens n] [--max-turns n] [--keep-images n] [--image-slack n] [--fold-above n] [--keep-recent n] [--max-input-tokens n] [--api responses|chat] [--base-url <url>] [--api-key-env <NAME>] [--request-timeout-s n] [--server <url> --admin-token <token>]`,
  '  spotless-bench table <dir> [--json <file>] [--md <file>]',
  '  spotless-bench verify <record.json> [--rewash [--cache <dir>]]',
  '  spotless-bench link --level <id> --player <name> [--agent] [--server <url>] [--admin-token <token>]',
  `policies: ${SCRIPTED_POLICY_NAMES.join(', ')}, anthropic:<model id>, openai:<model or deployment>`,
].join('\n');

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

/** Options that shape a model policy, from the command line. */
interface ModelOptions {
  /** Anthropic: `output_config.effort`. OpenAI-compatible: `reasoning_effort`. */
  readonly effort?: string;
  readonly maxTokens?: number;
  readonly maxTurns?: number;
  readonly keepImages?: number;
  readonly imageSlack?: number;
  /** The context policy's room for recent turns, estimated tokens: when to fold, and down to what. */
  readonly foldAbove?: number;
  readonly keepRecent?: number;
  readonly maxInputTokens?: number;
  /** OpenAI-compatible endpoint: its address, the variable of its key, the time limit of a request. */
  readonly baseURL?: string;
  readonly api?: 'responses' | 'chat';
  readonly apiKeyEnv?: string;
  readonly requestTimeoutS?: number;
}

const ANTHROPIC_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];

/** The factory of a policy named on the command line, or an error message. */
export function policyFactory(name: string, model: ModelOptions = {}): (() => Policy) | string {
  if ((SCRIPTED_POLICY_NAMES as readonly string[]).includes(name)) {
    return () => scriptedPolicy(name as ScriptedPolicyName);
  }
  const loop = {
    ...(model.maxTurns === undefined ? {} : { maxTurns: model.maxTurns }),
    ...(model.keepImages === undefined && model.imageSlack === undefined
      ? {}
      : { images: { keep: model.keepImages ?? 4, slack: model.imageSlack ?? 4 } }),
    ...(model.foldAbove === undefined && model.keepRecent === undefined
      ? {}
      : {
          context: {
            ...STANDARD_CONTEXT_POLICY,
            ...(model.foldAbove === undefined ? {} : { foldAbove: model.foldAbove }),
            ...(model.keepRecent === undefined ? {} : { keepRecent: model.keepRecent }),
          },
        }),
    ...(model.maxInputTokens === undefined ? {} : { maxInputTokens: model.maxInputTokens }),
  };
  if (name.startsWith('anthropic:')) {
    const id = name.slice('anthropic:'.length);
    if (id === '') return 'anthropic: a model id is needed, for example anthropic:claude-opus-5-5';
    if (model.effort !== undefined && !ANTHROPIC_EFFORTS.includes(model.effort)) {
      return `'${model.effort}' is not an effort (${ANTHROPIC_EFFORTS.join(', ')})`;
    }
    return () =>
      llmPolicy({
        provider: anthropicProvider({
          model: id,
          ...(model.effort === undefined ? {} : { effort: model.effort as AnthropicEffort }),
          ...(model.maxTokens === undefined ? {} : { maxTokens: model.maxTokens }),
        }),
        ...loop,
      });
  }
  if (name.startsWith('openai:')) {
    const id = name.slice('openai:'.length);
    if (id === '')
      return 'openai: a model or deployment name is needed, for example openai:gpt-6.1-sol';
    if (model.effort !== undefined && !/^[a-z]+$/.test(model.effort)) {
      return `'${model.effort}' is not a reasoning effort`;
    }
    return () =>
      llmPolicy({
        provider: openaiProvider({
          model: id,
          ...(model.effort === undefined ? {} : { reasoningEffort: model.effort }),
          ...(model.maxTokens === undefined ? {} : { maxTokens: model.maxTokens }),
          ...(model.baseURL === undefined ? {} : { baseURL: model.baseURL }),
          ...(model.api === undefined ? {} : { api: model.api }),
          ...(model.apiKeyEnv === undefined ? {} : { apiKeyEnv: model.apiKeyEnv }),
          ...(model.requestTimeoutS === undefined
            ? {}
            : { timeoutMs: model.requestTimeoutS * 1000 }),
        }),
        ...loop,
      });
  }
  return `no policy '${name}' (${SCRIPTED_POLICY_NAMES.join(', ')}, anthropic:<model id>, openai:<model or deployment>)`;
}

/** How the command line is run. */
export interface MainOptions {
  /**
   * An environment file to read when a run starts: the address and the key of a model's API,
   * for the variables the environment does not set. The command says which names it set,
   * never a value, and only then: `table`, `verify` and `link` read no key and say nothing.
   * Not read when absent (the tests).
   */
  readonly envFile?: string;
}

/** Runs the command line with the arguments after the program name; resolves with the exit status. */
export async function main(
  argv: readonly string[],
  io: BenchIo,
  options: MainOptions = {},
): Promise<number> {
  const [command, ...rest] = argv;

  if (command === 'table') {
    const { values, positionals } = parseArgs({
      args: rest,
      options: { json: { type: 'string' }, md: { type: 'string' } },
      allowPositionals: true,
    });
    const dir = positionals[0];
    if (dir === undefined) {
      io.err(USAGE);
      return 2;
    }
    const records = readEpisodeRecords(resolve(dir));
    const table = resultsTable(records);
    const markdown = resultsMarkdown(table);
    if (values.json !== undefined)
      writeFileSync(resolve(values.json), `${JSON.stringify(table, null, 1)}\n`);
    if (values.md !== undefined) writeFileSync(resolve(values.md), markdown);
    io.out(markdown.trimEnd());
    io.out(
      `${records.length} episode record${records.length === 1 ? '' : 's'} under ${resolve(dir)}`,
    );
    return 0;
  }

  if (command === 'verify') {
    const { values, positionals } = parseArgs({
      args: rest,
      allowPositionals: true,
      options: { rewash: { type: 'boolean' }, cache: { type: 'string' } },
    });
    const file = positionals[0];
    if (file === undefined) {
      io.err(USAGE);
      return 2;
    }
    const record = JSON.parse(readFileSync(resolve(file), 'utf8')) as unknown;
    if (!isEpisodeRecord(record)) {
      io.err(`verify: ${file} is not an episode record`);
      return 2;
    }
    const level = allLevels().find((candidate) => candidate.id === record.level.id);
    if (level === undefined) {
      io.err(`verify: no level '${record.level.id}' in this repository`);
      return 2;
    }
    // With --rewash the replayed load is washed again with the simulation of this checkout,
    // at the tier of the record: the only check that covers the score itself.
    const replay = await verifyByReplay(
      record,
      level,
      values.rewash === true
        ? {
            rewash: async (manifest, tier) => {
              const { runWash } = await import('@spotless/wash-runner');
              // With --cache the exposure of the load is read from, or kept in, that
              // directory; the result is the same either way.
              const { report } = await runWash(manifest, {
                tier,
                ...(values.cache === undefined ? {} : { exposureCacheDir: resolve(values.cache) }),
              });
              return {
                ...report,
                job: { ...report.job, runner_version: WASH_RUNNER.version },
              };
            },
          }
        : {},
    );
    io.out(JSON.stringify(replay));
    if (replay.checks?.score === null) {
      io.err(
        'verify: the log and the load were checked; the score was not (it needs a wash: --rewash)',
      );
    }
    return replay.verified ? 0 : 1;
  }

  if (command === 'link') {
    const { values } = parseArgs({
      args: rest,
      options: {
        server: { type: 'string', default: 'http://127.0.0.1:8787' },
        level: { type: 'string' },
        player: { type: 'string' },
        agent: { type: 'boolean' },
        'admin-token': { type: 'string' },
      },
    });
    const adminToken = values['admin-token'] ?? process.env['SPOTLESS_ADMIN_TOKEN'];
    if (values.level === undefined || values.player === undefined || adminToken === undefined) {
      io.err(
        'link: --level, --player and the admin token (--admin-token or SPOTLESS_ADMIN_TOKEN) are needed',
      );
      return 2;
    }
    try {
      const link = await createEpisodeLink({
        server: values.server,
        adminToken,
        levelId: values.level,
        player: values.player,
        ...(values.agent === true ? { kind: 'agent' as const } : {}),
      });
      io.out(link.url);
      io.out(`  episode: ${link.session_id}  level: ${values.level}  player: ${values.player}`);
      return 0;
    } catch (error) {
      io.err(`link: ${error instanceof Error ? error.message : String(error)}`);
      return 1;
    }
  }

  if (command === 'run') {
    const { values } = parseArgs({
      args: rest,
      options: {
        levels: { type: 'string' },
        policies: { type: 'string' },
        seeds: { type: 'string', default: '1' },
        tier: { type: 'string' },
        programme: { type: 'string' },
        ...WASH_OPTION_FLAGS,
        out: { type: 'string' },
        data: { type: 'string' },
        transport: { type: 'string', default: 'memory' },
        verify: { type: 'string', default: 'auto' },
        'no-render': { type: 'boolean' },
        'no-images': { type: 'boolean' },
        effort: { type: 'string' },
        'max-tokens': { type: 'string' },
        'max-turns': { type: 'string' },
        'keep-images': { type: 'string' },
        'image-slack': { type: 'string' },
        'fold-above': { type: 'string' },
        'keep-recent': { type: 'string' },
        'max-input-tokens': { type: 'string' },
        'base-url': { type: 'string' },
        api: { type: 'string' },
        'api-key-env': { type: 'string' },
        'request-timeout-s': { type: 'string' },
        server: { type: 'string' },
        'admin-token': { type: 'string' },
      },
    });
    const levels = list(values.levels);
    const names = list(values.policies);
    const seeds = list(values.seeds).map(Number);
    if (
      levels.length === 0 ||
      names.length === 0 ||
      seeds.some((seed) => !Number.isInteger(seed) || seed < 0)
    ) {
      io.err(USAGE);
      return 2;
    }
    // The address and the key of a model's API, from the repository's own `.env` when the
    // environment does not set them. Names only are said, never values.
    if (options.envFile !== undefined) {
      const fromFile = loadEnvFile(options.envFile);
      if (fromFile.length > 0) io.err(`.env: set ${fromFile.join(', ')}`);
    }
    // The tier and the parameters of the washes: `--tier` (or `--wash-tier`), and the same
    // options the game server takes, passed through to the server this command starts.
    const wash = washOptionsOf(values, values.tier);
    if (typeof wash === 'string') {
      io.err(`run: ${wash}`);
      return 2;
    }
    const tier = wash.washTier ?? 'official';
    if (
      values.server !== undefined &&
      (values.tier !== undefined ||
        wash.washTier !== undefined ||
        wash.washParams !== undefined ||
        wash.acceptStaleParams === true)
    ) {
      io.err(
        'run: the tier and the parameters of the washes are those of the server named with --server; start that server with them',
      );
      return 2;
    }
    if (!['memory', 'stdio', 'http'].includes(values.transport)) {
      io.err(`run: '${values.transport}' is not a transport (memory, stdio, http)`);
      return 2;
    }
    if (!['auto', 'replay', 'policy_session', 'none'].includes(values.verify)) {
      io.err(`run: '${values.verify}' is not a way to verify (auto, replay, policy_session, none)`);
      return 2;
    }
    const effort = values.effort;
    if (values.api !== undefined && values.api !== 'responses' && values.api !== 'chat') {
      io.err(
        `run: '${values.api}' is not an API of an OpenAI-compatible endpoint (responses, chat)`,
      );
      return 2;
    }
    const whole = (text: string | undefined): number | undefined =>
      text === undefined ? undefined : Number.parseInt(text, 10);
    const model: ModelOptions = {
      ...(effort === undefined ? {} : { effort }),
      ...(values['max-tokens'] === undefined
        ? {}
        : { maxTokens: whole(values['max-tokens']) as number }),
      ...(values['max-turns'] === undefined
        ? {}
        : { maxTurns: whole(values['max-turns']) as number }),
      ...(values['keep-images'] === undefined
        ? {}
        : { keepImages: whole(values['keep-images']) as number }),
      ...(values['image-slack'] === undefined
        ? {}
        : { imageSlack: whole(values['image-slack']) as number }),
      ...(values['fold-above'] === undefined
        ? {}
        : { foldAbove: whole(values['fold-above']) as number }),
      ...(values['keep-recent'] === undefined
        ? {}
        : { keepRecent: whole(values['keep-recent']) as number }),
      ...(values['max-input-tokens'] === undefined
        ? {}
        : { maxInputTokens: whole(values['max-input-tokens']) as number }),
      ...(values['base-url'] === undefined ? {} : { baseURL: values['base-url'] }),
      ...(values.api === undefined ? {} : { api: values.api as 'responses' | 'chat' }),
      ...(values['api-key-env'] === undefined ? {} : { apiKeyEnv: values['api-key-env'] }),
      ...(values['request-timeout-s'] === undefined
        ? {}
        : { requestTimeoutS: whole(values['request-timeout-s']) as number }),
    };
    for (const [flag, value] of [
      ['--max-tokens', model.maxTokens],
      ['--max-turns', model.maxTurns],
      ['--fold-above', model.foldAbove],
      ['--keep-recent', model.keepRecent],
      ['--max-input-tokens', model.maxInputTokens],
      ['--request-timeout-s', model.requestTimeoutS],
    ] as const) {
      if (value !== undefined && !(Number.isInteger(value) && value > 0)) {
        io.err(`run: ${flag} takes a whole number above zero`);
        return 2;
      }
    }
    const policies: (() => Policy)[] = [];
    for (const name of names) {
      const factory = policyFactory(name, model);
      if (typeof factory === 'string') {
        io.err(`run: ${factory}`);
        return 2;
      }
      policies.push(factory);
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outDir = resolve(values.out ?? `bench-results/${stamp}`);
    const adminToken = values['admin-token'] ?? process.env['SPOTLESS_ADMIN_TOKEN'];
    if (values.server !== undefined && adminToken === undefined) {
      io.err(
        'run: --server needs the admin token of that server (--admin-token or SPOTLESS_ADMIN_TOKEN)',
      );
      return 2;
    }
    const game =
      values.server !== undefined
        ? connectGame(values.server, adminToken as string)
        : await startGame({
            dataDir: resolve(values.data ?? `${outDir}/server-data`),
            washTier: tier,
            render: values['no-render'] !== true,
            server: {
              ...(wash.washParams === undefined ? {} : { washParams: wash.washParams }),
              ...(wash.acceptStaleParams === true ? { acceptStaleParams: true } : {}),
            },
          });
    for (const level of levels) {
      if (!game.levels.has(level)) {
        io.err(`run: no level '${level}' (${[...game.levels.keys()].join(', ')})`);
        await game.close();
        return 2;
      }
    }
    // A programme the level card does not offer is refused by start_cycle, at the end of an
    // episode that has by then been played (and, for a model, paid for): refuse it here.
    if (values.programme !== undefined) {
      for (const id of levels) {
        const level = game.levels.get(id);
        if (level === undefined) continue;
        const offered = [level.programmeId, ...(level.secondaryProgrammes ?? [])];
        if (offered.includes(values.programme)) continue;
        io.err(
          `run: level '${id}' is washed on ${offered.join(' or ')}; it does not offer ` +
            `--programme ${values.programme}, and an episode played for it would end with no ` +
            `cycle to score. Nothing was played.`,
        );
        await game.close();
        return 2;
      }
    }
    io.out(
      `game server: ${game.url}${values.server === undefined ? ` (started here, ${tier} tier${tier === 'fast' ? ': a preview, not a result' : ''}${wash.washParams === undefined ? '' : ', parameters as named'}${wash.acceptStaleParams === true ? ', stale parameter sets accepted' : ''})` : ''}`,
    );
    if (values.programme !== undefined) {
      io.out(
        `programme: ${values.programme} (where it is not the one a level is scored on, the result is uncalibrated)`,
      );
    }
    io.out(`output: ${outDir}`);
    try {
      const started = performance.now();
      const batch = await runBatch({
        game,
        levels,
        policies,
        seeds,
        outDir,
        transport: values.transport as McpTransportKind,
        verify: values.verify as VerifyMode,
        saveImages: values['no-images'] !== true,
        ...(values.programme === undefined ? {} : { programme: values.programme }),
        log: (line) => io.out(`  ${line}`),
      });
      io.out('');
      io.out(resultsMarkdown(batch.table).trimEnd());
      io.out('');
      io.out(
        `${batch.records.length} episode${batch.records.length === 1 ? '' : 's'} in ${((performance.now() - started) / 1000).toFixed(0)} s; table in ${batch.files.markdown}`,
      );
      for (const failure of batch.failures) {
        io.err(`failed: ${failure.level} ${failure.policy} seed ${failure.seed}: ${failure.error}`);
      }
      const unverified = batch.records.filter((record) => record.replay?.verified === false);
      for (const record of unverified) io.err(`not verified: ${record.episode_id}`);
      // An episode without a result (its wash failed, or no cycle could be started) is a
      // failure of the run: the table says "not scored", and the command says so too.
      for (const entry of batch.unscored)
        io.err(`no result: ${entry.episode_id}: ${entry.problem}`);
      return batch.failures.length === 0 && unverified.length === 0 && batch.unscored.length === 0
        ? 0
        : 1;
    } finally {
      await game.close();
    }
  }

  io.err(USAGE);
  return command === undefined || command === 'help' || command === '--help' ? 0 : 2;
}

const invoked = process.argv[1];
if (invoked !== undefined && import.meta.url === pathToFileURL(invoked).href) {
  main(
    process.argv.slice(2),
    {
      out: (line) => {
        console.log(line);
      },
      err: (line) => {
        console.error(line);
      },
    },
    { envFile: REPOSITORY_ENV_FILE },
  ).then(
    (status) => {
      process.exit(status);
    },
    (error: unknown) => {
      console.error(error);
      process.exit(1);
    },
  );
}
