/**
 * measure-episode: what an episode costs in tokens, measured without a model.
 *
 *   pnpm --filter @spotless/bench measure-episode --load tutorial-careful
 *        [--load weeknight-dinner-careful --load iec-13-careful]
 *        [--previews none|all] [--look-every 10] [--label <text>]
 *        [--out <dir>] [--json <file>] [--md <file>] [--per-call]
 *   pnpm --filter @spotless/bench measure-episode --check <transcript.json>...
 *
 * For each saved load (`packages/loader/loads/<name>.json`) the calls of its action log are
 * played, one a turn, through the real MCP tools by the standard loop of the harness: the
 * same system prompt, tools and context policy a model is run with, driven by a scripted
 * provider. On top of the policy's own calls comes a look after every tenth accepted
 * placement (by turns a labelled plan view with its grid and the scene state). The loader's
 * `preview` calls are left out unless `--previews all` is given: they are the thousands of
 * free tests of a search, which no model makes one turn at a time.
 *
 * Reported: for every tool the number of calls and the size of its results (characters and
 * estimated tokens, median, largest, sum); for the episode the requests, the largest request,
 * the conversation at its largest, and the input tokens of all requests together with the
 * share the provider's prompt cache has seen before. With `--per-call`, every call.
 *
 * Tokens are estimated with the fit of `src/measure.ts` to the endpoint of the first real
 * episodes. Nothing is washed (the placeholder wash) and no model is called.
 *
 * `--check` measures nothing: it holds the estimate against the transcripts of real episodes
 * (what each turn added to the request, as the provider counted it), says how far off it is,
 * and prints the fit those transcripts would give.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { requestOnce, shapeState } from '@spotless/mcp';
import type { SceneState } from '@spotless/session';
import { runEpisode } from '../src/episode.ts';
import { startGame } from '../src/game.ts';
import { llmPolicy } from '../src/llm.ts';
import type { CalibrationRow, LoadLike, Measurement, TranscriptLike } from '../src/measure.ts';
import {
  TOKEN_MODEL,
  calibrationRows,
  checkTokenModel,
  fitTokenModel,
  measureRequests,
  sequenceOfLoad,
} from '../src/measure.ts';
import { scriptedProvider } from '../src/scripted-provider.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const LOADS_DIR = join(HERE, '..', '..', 'loader', 'loads');
const origin = process.env['INIT_CWD'] ?? process.cwd();
const fromOrigin = (path: string): string => (isAbsolute(path) ? path : join(origin, path));

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    load: { type: 'string', multiple: true },
    previews: { type: 'string', default: 'none' },
    'look-every': { type: 'string', default: '10' },
    label: { type: 'string', default: '' },
    out: { type: 'string' },
    json: { type: 'string' },
    md: { type: 'string' },
    'per-call': { type: 'boolean' },
    check: { type: 'string', multiple: true },
  },
});
if (values.check !== undefined) {
  const all: CalibrationRow[] = [];
  console.log(
    '| Transcript | Turns | Input tokens, as counted | Read from the cache | Largest request | What the turns added: counted | estimated | estimated over counted | mean error a turn |',
  );
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const file of values.check) {
    const transcript = JSON.parse(readFileSync(fromOrigin(file), 'utf8')) as TranscriptLike;
    const rows = calibrationRows(transcript);
    all.push(...rows);
    const sizes = transcript.turns.map(
      (turn) =>
        turn.usage.input_tokens +
        turn.usage.cache_read_input_tokens +
        turn.usage.cache_creation_input_tokens,
    );
    const check = checkTokenModel(rows);
    console.log(
      `| ${file} | ${transcript.turns.length} | ${sizes.reduce((a, b) => a + b, 0)} | ${transcript.turns.reduce((sum, turn) => sum + turn.usage.cache_read_input_tokens, 0)} | ${Math.max(0, ...sizes)} | ${check.measured_tokens} | ${check.estimated_tokens} | ${check.ratio.toFixed(3)} | ${check.mean_abs_error.toFixed(1)} tokens |`,
    );
  }
  const fit = fitTokenModel(all);
  console.log('');
  console.log(`The estimate in use: ${JSON.stringify(TOKEN_MODEL)}`);
  console.log(
    `The fit of these ${all.length} rows: ${JSON.stringify(fit)} (${JSON.stringify(checkTokenModel(all, fit))})`,
  );
  process.exit(0);
}
const loads = values.load ?? ['tutorial-careful'];
if (values.previews !== 'none' && values.previews !== 'all') {
  console.error(`--previews takes none or all, not '${values.previews}'`);
  process.exit(2);
}
const previews: 'none' | 'all' = values.previews;
const lookEvery = Math.max(0, Number.parseInt(values['look-every'], 10) || 0);
const outDir =
  values.out === undefined
    ? mkdtempSync(join(tmpdir(), 'spotless-measure-'))
    : fromOrigin(values.out);
mkdirSync(outDir, { recursive: true });

interface Measured {
  readonly load: string;
  readonly level: string;
  readonly items: number;
  readonly sequence: {
    readonly previews: string;
    readonly look_every: number;
    readonly from_log: number;
    readonly looks: number;
    readonly left_out: number;
    readonly counts: { readonly [tool: string]: number };
  };
  /** Why the loop stopped, and what the context policy did, as the transcript says. */
  readonly stopped: string;
  readonly context: unknown;
  /**
   * Whether the harness's own copy of the load, kept from the results alone, was the game's
   * scene when the loop ended (placed items with their poses, the counter, the baskets and
   * their options, the budgets); null when it could not be compared.
   */
  readonly tracker_exact: boolean | null;
  readonly seconds: number;
  readonly measurement: Measurement;
}

async function measure(name: string): Promise<Measured> {
  const load = JSON.parse(readFileSync(join(LOADS_DIR, `${name}.json`), 'utf8')) as LoadLike;
  const sequence = sequenceOfLoad(load, { previews, lookEvery });
  const provider = scriptedProvider(
    [...sequence.turns, { say: 'The sequence is played.' }],
    'measure',
  );
  const dataDir = mkdtempSync(join(tmpdir(), 'spotless-measure-data-'));
  const started = performance.now();
  // The level saved with the load: the one its log was made on.
  const game = await startGame({
    dataDir,
    washTier: 'fast',
    levels: [load.level],
    server: {
      // Nothing is simulated: the conversation is what is measured.
      washRunner: {
        module: '@spotless/session',
        exportName: 'placeholderWashRunner',
        version: 'placeholder_not_simulated-1',
      },
    },
  });
  let stopped = '';
  let context: unknown = null;
  let trackerExact: boolean | null = null;
  try {
    const result = await runEpisode({
      game,
      levelId: load.level.id,
      // A sequence may be longer than the standard turn limit: here it is played to its end.
      policy: llmPolicy({ provider, maxTurns: sequence.turns.length + 8, reminders: 0 }),
      outDir: join(outDir, name),
      verify: 'none',
      log: (line) => {
        if (/^turn \d+00:|stopped|episode/.test(line)) console.error(`  ${line}`);
      },
    });
    stopped = result.record.agent?.stopped ?? '';
    const transcript = JSON.parse(readFileSync(join(result.dir, 'transcript.json'), 'utf8')) as {
      context?: unknown;
      load_at_end?: { [key: string]: unknown } | null;
    };
    context = transcript.context ?? null;
    // The game's scene, read without a query, against the harness's copy of it.
    const scene = JSON.parse(
      (await requestOnce('GET', `${game.url}/api/sessions/${result.record.episode_id}/scene`)).text,
    ) as { state?: SceneState };
    if (scene.state !== undefined && transcript.load_at_end != null) {
      const { state_hash: _a, phase: _b, ...truth } = shapeState(scene.state);
      const { state_hash: _c, phase: _d, ...copy } = transcript.load_at_end;
      trackerExact = JSON.stringify(truth) === JSON.stringify(copy);
    }
  } finally {
    await game.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
  return {
    load: name,
    level: load.level.id,
    items: load.level.items.length,
    sequence: {
      previews,
      look_every: lookEvery,
      from_log: sequence.from_log,
      looks: sequence.looks,
      left_out: sequence.left_out,
      counts: sequence.counts,
    },
    stopped,
    context,
    tracker_exact: trackerExact,
    seconds: Math.round((performance.now() - started) / 100) / 10,
    measurement: measureRequests(provider.requests),
  };
}

const k = (n: number): string =>
  n >= 1e6
    ? `${(n / 1e6).toFixed(2)} M`
    : n >= 10_000
      ? `${Math.round(n / 1000)} k`
      : String(Math.round(n));

/** What the context policy did and whether the harness's copy of the load was exact. */
function contextLine(m: Measured): string {
  const context = m.context as {
    version?: string;
    folds?: { forced?: boolean; calls_folded?: number }[];
    picture_prunings?: number;
  } | null;
  const parts: string[] = [];
  if (context !== null && Array.isArray(context.folds)) {
    const folds = context.folds;
    const forced = folds.filter((fold) => fold.forced === true).length;
    parts.push(
      ` Context policy ${context.version ?? ''}: ${folds.length} folds (${forced} forced), ${folds.reduce((sum, fold) => sum + (fold.calls_folded ?? 0), 0)} calls folded, pictures pruned ${context.picture_prunings ?? 0} times.`,
    );
  }
  if (m.tracker_exact !== null) {
    parts.push(
      m.tracker_exact
        ? " The harness's copy of the load, kept from the results alone, was the game's scene at the end."
        : " THE HARNESS'S COPY OF THE LOAD DIFFERED FROM THE GAME'S SCENE AT THE END.",
    );
  }
  return parts.join('');
}

function report(m: Measured): string[] {
  const x = m.measurement;
  const lines: string[] = [];
  lines.push(
    `### ${m.load} (${m.items} items)${values.label === '' ? '' : `, ${values.label}`}`,
    '',
    `${x.calls} calls in ${x.requests} requests: ${m.sequence.from_log} of the policy's own calls` +
      `${m.sequence.left_out === 0 ? '' : ` (its ${m.sequence.left_out} previews left out)`} and ${m.sequence.looks} looks. ` +
      `The loop stopped: ${m.stopped}.` +
      contextLine(m),
    '',
    '| Tool | Calls | Refused | Result, median | Result, largest | All results | Pictures |',
    '|---|---|---|---|---|---|---|',
  );
  for (const tool of x.by_tool) {
    lines.push(
      `| ${tool.tool} | ${tool.calls} | ${tool.refused} | ${k(tool.characters_median)} chars, ${k(tool.tokens_median)} tokens | ${k(tool.characters_max)} chars, ${k(tool.tokens_max)} tokens | ${k(tool.characters_total)} chars, ${k(tool.tokens_total)} tokens | ${tool.pictures} |`,
    );
  }
  lines.push(
    '',
    '| | |',
    '|---|---|',
    `| System prompt and tools, in every request | ${k(x.system_characters + x.tools_characters)} chars, ${k(x.system_tokens + x.tools_tokens)} tokens |`,
    `| Results of all calls | ${k(x.result_characters)} chars, ${k(x.result_tokens)} tokens, ${x.pictures} pictures |`,
    `| Largest request | ${k(x.largest_request_tokens)} tokens (request ${x.largest_request_turn} of ${x.requests}) |`,
    `| Conversation at its largest | ${k(x.largest_conversation_characters)} chars, ${k(x.largest_conversation_tokens)} tokens |`,
    `| Input tokens of the episode | ${k(x.input_tokens)} (${k(x.cached_tokens)} read from the cache, ${k(x.written_tokens)} new) |`,
    `| Mean request | ${k(x.input_tokens / Math.max(1, x.requests))} tokens |`,
    '',
  );
  if (values['per-call'] === true) {
    lines.push(
      '| Call | Request | Tool | Result | Pictures |',
      '|---|---|---|---|---|',
      ...x.per_call.map(
        (call) =>
          `| ${call.index} | ${call.turn} | ${call.tool}${call.is_error ? ' (refused)' : ''} | ${call.result_characters} chars, ${call.result_tokens} tokens | ${call.pictures} |`,
      ),
      '',
    );
  }
  return lines;
}

const measured: Measured[] = [];
for (const name of loads) {
  console.error(`measuring ${name} ...`);
  measured.push(await measure(name));
}
const lines = measured.flatMap(report);
lines.push(
  `Tokens are estimated: ${TOKEN_MODEL.perLetter} a letter, ${TOKEN_MODEL.perDigit} a digit, ${TOKEN_MODEL.perOther} a character of anything else, ${TOKEN_MODEL.perItem} an item of the conversation, ${TOKEN_MODEL.perPicture768} a picture of 768 pixels square (the fit of packages/bench/src/measure.ts to the first real episodes). One call a turn; a model's own words and reasoning are not in the estimate.`,
);
const text = `${lines.join('\n')}\n`;
console.log(text);
if (values.md !== undefined) writeFileSync(fromOrigin(values.md), text);
if (values.json !== undefined) {
  writeFileSync(
    fromOrigin(values.json),
    `${JSON.stringify({ label: values.label, token_model: TOKEN_MODEL, episodes: measured }, null, 1)}\n`,
  );
}
process.exit(0);
