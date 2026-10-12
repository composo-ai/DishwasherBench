/**
 * episode-cost: what an episode of a model would cost, estimated before a single call is made
 * to a model's API.
 *
 *   pnpm --filter @spotless/bench episode-cost --level tutorial [--level weeknight-dinner]
 *        [--from <measure-episode.json>]... [--price <model>=<in>,<cached in>,<out>]...
 *        [--out <dir>] [--json <file>] [--md <file>]
 *
 * It prices a measured episode (`measure-episode`, `src/measure.ts`): the calls of the level's
 * careful reference load with a look after every tenth placement, played through the real
 * MCP tools by the standard loop, with every request sized as the loop sends it and split
 * into what the provider's prompt cache has seen before and what is new. `--level` measures
 * here (minutes for a full level: the loading physics runs); `--from` takes the JSON a
 * `measure-episode --json` run wrote and measures nothing.
 *
 * Tokens are the estimate of `src/measure.ts`, fitted to what the endpoint of the first real
 * episodes counted (about 4.7 characters a token for prose and about 3 for the JSON of a
 * result; until 2026-10-11 this script reckoned 3.2 for everything).
 *
 * Prices are US dollars per million tokens:
 *
 *  - for Anthropic's models, what this script assumed on 6 October 2026 (`PRICES`): they may
 *    be wrong or out of date, no Anthropic model has been run, and the table says so at its
 *    head (`headNote`);
 *  - for the deployments of the OpenAI-compatible endpoint, whatever is given: `--price
 *    gpt-6.1-sol=<input>,<cached input>,<output>` (once per deployment), or the environment
 *    (`SPOTLESS_OPENAI_PRICE_<NAME>_INPUT`, `_CACHED_INPUT`, `_OUTPUT` for a deployment named
 *    in `SPOTLESS_OPENAI_MODEL_ITERATE` or `SPOTLESS_OPENAI_MODEL_EXPENSIVE`, with the name
 *    written as in `SPOTLESS_OPENAI_PRICE_GPT_6_1_SOL_INPUT`; the repository's `.env` is
 *    read). A deployment without prices is listed with its tokens and no dollars.
 *
 * What a scripted rehearsal cannot know is how a model plays: how often it looks, how many
 * placements it tries again, how long it thinks. The table gives the rehearsal as it is and
 * two scenarios on top (`SCENARIOS`). Under the context policy a conversation no longer
 * grows with the episode, so twice the turns cost twice the input, not four times.
 */

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { REPOSITORY_ENV_FILE, parseEnvFile } from '../src/env.ts';
import type { Measurement } from '../src/measure.ts';
import { TOKEN_MODEL } from '../src/measure.ts';
import { openaiPricesFor } from '../src/openai.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const origin = process.env['INIT_CWD'] ?? process.cwd();
const fromOrigin = (path: string): string => (isAbsolute(path) ? path : join(origin, path));

/** Prices of a model, US dollars per million tokens. */
interface Price {
  /** Input the cache has not seen and does not keep. */
  readonly input: number;
  /** Input read from the cache. */
  readonly cacheRead: number;
  /** Input written to the cache (where the provider charges for that; else the input price). */
  readonly cacheWrite: number;
  readonly output: number;
  readonly note?: string;
}

/**
 * Prices of Anthropic's models as this script assumed them on 6 October 2026. Not checked
 * since: they may be wrong or out of date. Check the provider's price list.
 */
const PRICES: { readonly [model: string]: Price } = {
  'claude-haiku-5-5': {
    input: 0.1,
    output: 0.5,
    cacheRead: 0.01,
    cacheWrite: 0.125,
    note: 'prompts up to 100,000 tokens; no request of a rehearsal is larger',
  },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
};

/** How a model might differ from the rehearsal. */
const SCENARIOS: readonly { name: string; turns: number; outputPerTurn: number }[] = [
  { name: 'as rehearsed, terse', turns: 1, outputPerTurn: 60 },
  { name: 'twice the turns, thinking', turns: 2, outputPerTurn: 400 },
  { name: 'four times the turns, thinking hard', turns: 4, outputPerTurn: 1500 },
];

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    level: { type: 'string', multiple: true },
    from: { type: 'string', multiple: true },
    price: { type: 'string', multiple: true },
    out: { type: 'string' },
    json: { type: 'string' },
    md: { type: 'string' },
  },
});

/** What is priced: a measured episode. */
interface Episode {
  readonly load: string;
  readonly items: number;
  readonly measurement: Measurement;
}

const episodes: Episode[] = [];
for (const file of values.from ?? []) {
  const read = JSON.parse(readFileSync(fromOrigin(file), 'utf8')) as { episodes: Episode[] };
  episodes.push(...read.episodes);
}
const levels = values.level ?? (episodes.length === 0 ? ['tutorial'] : []);
if (levels.length > 0) {
  // Measured by the measuring script itself, so that there is one way of measuring.
  const outDir =
    values.out === undefined
      ? mkdtempSync(join(tmpdir(), 'spotless-episode-cost-'))
      : fromOrigin(values.out);
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, 'measurement.json');
  console.error(`measuring ${levels.join(', ')} ...`);
  execFileSync(
    process.execPath,
    [
      '--import',
      'tsx',
      join(HERE, 'measure-episode.ts'),
      ...levels.flatMap((level) => ['--load', `${level}-careful`]),
      '--out',
      outDir,
      '--json',
      file,
    ],
    { cwd: join(HERE, '..'), stdio: ['ignore', 'ignore', 'inherit'] },
  );
  episodes.push(...(JSON.parse(readFileSync(file, 'utf8')) as { episodes: Episode[] }).episodes);
}

// The models priced: Anthropic's by list, the endpoint's deployments by what is given.
const env: { [name: string]: string | undefined } = { ...process.env };
try {
  for (const [name, value] of Object.entries(
    parseEnvFile(readFileSync(REPOSITORY_ENV_FILE, 'utf8')),
  )) {
    if (env[name] === undefined || env[name] === '') env[name] = value;
  }
} catch {
  // No environment file: prices come from the options or not at all.
}
const prices = new Map<string, Price | null>(Object.entries(PRICES));
for (const name of [env['SPOTLESS_OPENAI_MODEL_ITERATE'], env['SPOTLESS_OPENAI_MODEL_EXPENSIVE']]) {
  if (name === undefined || name.trim() === '') continue;
  const given = openaiPricesFor(name, env);
  prices.set(
    name,
    given === null
      ? null
      : {
          input: given.input,
          cacheRead: given.cachedInput ?? given.input,
          cacheWrite: given.input,
          output: given.output,
        },
  );
}
for (const text of values.price ?? []) {
  const match = /^([^=]+)=([0-9.]+),([0-9.]+),([0-9.]+)$/.exec(text.trim());
  if (match === null) {
    console.error(`--price takes <model>=<input>,<cached input>,<output>, not '${text}'`);
    process.exit(2);
  }
  prices.set(match[1] as string, {
    input: Number(match[2]),
    cacheRead: Number(match[3]),
    cacheWrite: Number(match[2]),
    output: Number(match[4]),
  });
}

/** Dollars of one episode of a model under a scenario. */
function costOf(
  price: Price,
  measurement: Measurement,
  scenario: (typeof SCENARIOS)[number],
): number {
  const input =
    (measurement.cached_tokens * price.cacheRead + measurement.written_tokens * price.cacheWrite) /
    1e6;
  const output = (measurement.requests * scenario.outputPerTurn * price.output) / 1e6;
  // The conversation is bounded, so more turns are more requests of the same size.
  return scenario.turns * (input + output);
}

const k = (n: number): string =>
  n >= 1e6 ? `${(n / 1e6).toFixed(2)} M` : n >= 10_000 ? `${Math.round(n / 1000)} k` : String(n);

/**
 * The note at the head of the table (and in the JSON): what the figures are and are not.
 * Its last sentence is there only when a model is listed without prices.
 */
function headNote(unpriced: number): string {
  const counted = ['', 'one', 'two', 'three', 'four', 'five'][unpriced] ?? String(unpriced);
  const others =
    unpriced === 0
      ? ''
      : ` No prices were supplied for the other ${unpriced === 1 ? 'model' : `${counted} models`}, so no comparison of cost can be read from this table.`;
  return `Estimates, not measurements. No Anthropic model was run. The prices are what the script assumed on 6 October 2026 and may be wrong or out of date; check the provider's price list.${others}`;
}
const note = headNote([...prices.values()].filter((price) => price === null).length);

const lines: string[] = [
  `> ${note}`,
  '',
  '| Load | Items | Requests | System prompt and tools | Largest request | Input tokens | Read from the cache | New |',
  '|---|---|---|---|---|---|---|---|',
];
for (const episode of episodes) {
  const m = episode.measurement;
  lines.push(
    `| ${episode.load} | ${episode.items} | ${m.requests} | ${k(m.system_tokens + m.tools_tokens)} tokens | ${k(m.largest_request_tokens)} tokens | ${k(m.input_tokens)} | ${k(m.cached_tokens)} | ${k(m.written_tokens)} |`,
  );
}
lines.push(
  '',
  `| Load | Model | ${SCENARIOS.map((s) => `${s.name} (${s.outputPerTurn} tokens out a turn)`).join(' | ')} |`,
  `|---|---|${SCENARIOS.map(() => '---').join('|')}|`,
);
const estimates: { load: string; model: string; scenario: string; usd: number | null }[] = [];
for (const episode of episodes) {
  for (const [model, price] of prices) {
    const cells = SCENARIOS.map((scenario) => {
      const usd = price === null ? null : costOf(price, episode.measurement, scenario);
      estimates.push({
        load: episode.load,
        model,
        scenario: scenario.name,
        usd: usd === null ? null : Math.round(usd * 1000) / 1000,
      });
      if (usd === null) {
        return `no price given (${k(scenario.turns * episode.measurement.input_tokens)} tokens in, ${k(scenario.turns * episode.measurement.requests * scenario.outputPerTurn)} out)`;
      }
      return `$${usd.toFixed(usd < 1 ? 3 : 2)}`;
    });
    lines.push(`| ${episode.load} | ${model} | ${cells.join(' | ')} |`);
  }
}
lines.push(
  '',
  `Tokens are estimated (${TOKEN_MODEL.perLetter} a letter, ${TOKEN_MODEL.perDigit} a digit, ${TOKEN_MODEL.perOther} a character of anything else, ${TOKEN_MODEL.perPicture768} a picture of 768 pixels square: the fit of packages/bench/src/measure.ts to the first real episodes). The prices assumed are US dollars per million tokens: ${[
    ...prices,
  ]
    .map(([model, p]) =>
      p === null
        ? `${model}: none given`
        : `${model}: ${p.input} in, ${p.cacheRead} read from the cache, ${p.cacheWrite} written to it, ${p.output} out`,
    )
    .join('; ')}.`,
);
const text = `${lines.join('\n')}\n`;
console.log(text);
if (values.md !== undefined) writeFileSync(fromOrigin(values.md), text);
if (values.json !== undefined) {
  writeFileSync(
    fromOrigin(values.json),
    `${JSON.stringify(
      {
        note,
        token_model: TOKEN_MODEL,
        prices_usd_per_million_tokens: Object.fromEntries(prices),
        scenarios: SCENARIOS,
        episodes: episodes.map((episode) => {
          const { per_call: _calls, per_request: _requests, ...measurement } = episode.measurement;
          return { load: episode.load, items: episode.items, measurement };
        }),
        estimates,
      },
      null,
      1,
    )}\n`,
  );
}
process.exit(0);
