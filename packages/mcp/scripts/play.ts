/**
 * Plays an episode through the MCP server exactly as an agent's client does: it starts a game
 * server in benchmark mode, creates an episode, starts the MCP server of that episode as a
 * child process speaking stdio, connects the SDK's client to it, and makes the tool calls
 * listed in a file, one after another. Every result is written to the output directory as
 * JSON, every picture as PNG, and a short account of each call is printed.
 *
 *   pnpm --filter @spotless/mcp exec tsx scripts/play.ts --steps <steps.json> --out <dir>
 *        [--level tutorial] [--tier fast|official] [--placeholder-wash]
 *
 * `steps.json` is an array of `{ "tool": "<name>", "args": { ... } }`; a step
 * `{ "resource": "<uri>" }` reads a resource. `scripts/tutorial-steps.json` is a played
 * tutorial: look, place a few items where the pictures show room, check, wash, read the report.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { buildServer, createRenderService } from '@spotless/server';

const { values } = parseArgs({
  options: {
    steps: { type: 'string' },
    out: { type: 'string' },
    level: { type: 'string', default: 'tutorial' },
    tier: { type: 'string', default: 'fast' },
    'placeholder-wash': { type: 'boolean' },
  },
});
const here = fileURLToPath(new URL('./', import.meta.url));
const stepsFile = resolve(values.steps ?? join(here, 'tutorial-steps.json'));
const out = resolve(values.out ?? join(tmpdir(), 'spotless-mcp-play'));
mkdirSync(out, { recursive: true });
const steps = JSON.parse(readFileSync(stepsFile, 'utf8')) as (
  { tool: string; args?: Record<string, unknown>; note?: string } | { resource: string }
)[];

const ADMIN = 'play-script-admin-token';
const dataDir = mkdtempSync(join(tmpdir(), 'spotless-mcp-play-data-'));
const server = await buildServer({
  dataDir,
  staticDir: null,
  adminToken: ADMIN,
  washTier: values.tier === 'official' ? 'official' : 'fast',
  renderer: createRenderService(),
  ...(values['placeholder-wash'] === true
    ? {
        washRunner: {
          module: '@spotless/session',
          exportName: 'placeholderWashRunner',
          version: 'placeholder_not_simulated-1',
        },
      }
    : {}),
});
await server.app.listen({ port: 0, host: '127.0.0.1' });
const url = `http://127.0.0.1:${(server.app.server.address() as AddressInfo).port}`;
const created = (await (
  await fetch(`${url}/api/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-spotless-admin': ADMIN },
    body: JSON.stringify({
      level_id: values.level,
      player: { kind: 'agent', name: 'play-script', interface: 'mcp/stdio' },
    }),
  })
).json()) as { session_id: string };

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [
    '--import',
    'tsx',
    join(here, '..', 'src', 'cli.ts'),
    '--server',
    url,
    '--session',
    created.session_id,
  ],
  cwd: join(here, '..'),
  stderr: 'inherit',
});
const client = new Client({ name: 'spotless-play-script', version: '0.1.0' });
await client.connect(transport as unknown as Transport);
console.log(
  `connected over stdio; ${(await client.listTools()).tools.length} tools; output in ${out}`,
);

/** A result in a line or two: what a reader of the log needs to follow the game. */
function brief(tool: string, result: Record<string, unknown>): string {
  if (result['accepted'] === false)
    return `REFUSED ${String(result['reason'])} ${String(result['detail'] ?? '')} ${JSON.stringify({ ...result, accepted: undefined, reason: undefined, detail: undefined })}`;
  if (tool === 'place') {
    // The item's settled entry is among the changes (or, for the first action, in the scene).
    const items =
      (result['changes'] as { items?: { item_id: string; frame: string; position_mm: number[] }[] })
        ?.items ?? [];
    const rows =
      (result['state'] as { placed?: { rows: [string, string, number[]][] } })?.placed?.rows ?? [];
    const mine = items.find((item) => item.item_id === result['item_id']);
    const row = rows.find((entry) => entry[0] === result['item_id']);
    const at =
      mine !== undefined
        ? `${mine.frame} [${mine.position_mm.join(', ')}]`
        : row !== undefined
          ? `${row[1]} [${row[2].join(', ')}]`
          : 'the counter (it did not stay in the machine)';
    const others = items.filter((item) => item.item_id !== result['item_id']);
    return `settled at ${at}, moved ${String(result['displacement_mm'])} mm / ${String(result['rotation_deg'])} deg, stable ${String(result['stable'])}${result['fell_through'] === true ? ', fell through' : ''}${result['fell_out'] === true ? ', fell out' : ''}, touches ${Object.keys((result['contact_forces_N'] ?? {}) as object).join(', ')}; also changed: ${others.length === 0 ? 'nothing' : others.map((item) => item.item_id).join(', ')}`;
  }
  if (tool === 'get_report') {
    if (result['status'] !== 'done') return JSON.stringify(result);
    const report = result['report'] as {
      score: { points: number; points_available: number };
      job: { fidelity: string; runtime_s: number; notes?: string[] };
      items: {
        item_id: string;
        loaded: boolean;
        clean?: boolean;
        points_awarded?: number;
        reason?: string;
      }[];
    };
    return [
      `done: ${report.score.points} of ${report.score.points_available} points (${report.job.fidelity}, ${report.job.runtime_s} s)`,
      ...(report.job.notes ?? []).map((line) => `  note: ${line}`),
      ...report.items.map(
        (item) =>
          `  ${item.item_id}: ${!item.loaded ? 'not loaded' : item.clean === true ? `clean, ${String(item.points_awarded)} points` : `not clean: ${item.reason ?? ''}`}`,
      ),
    ].join('\n');
  }
  const text = JSON.stringify(result);
  return text.length > 700 ? `${text.slice(0, 700)}... (${text.length} characters)` : text;
}

let n = 0;
for (const step of steps) {
  const label = String(n++).padStart(2, '0');
  if ('resource' in step) {
    const read = await client.readResource({ uri: step.resource });
    const text = read.contents.map((c) => ('text' in c ? c.text : '')).join('\n');
    writeFileSync(join(out, `${label}-resource.txt`), text);
    console.log(`\n[${label}] resource ${step.resource}: ${text.length} characters`);
    continue;
  }
  const started = performance.now();
  // The client's default limit for a call is one minute; a slow placement can take longer.
  const result = await client.callTool({ name: step.tool, arguments: step.args ?? {} }, undefined, {
    timeout: 30 * 60 * 1000,
  });
  const ms = performance.now() - started;
  const content = (result.content ?? []) as { type: string; text?: string; data?: string }[];
  const structured = (result.structuredContent ?? {}) as Record<string, unknown>;
  writeFileSync(
    join(out, `${label}-${step.tool}.json`),
    `${JSON.stringify(structured, null, 1)}\n`,
  );
  const images = content.filter((part) => part.type === 'image');
  images.forEach((image, i) => {
    writeFileSync(
      join(out, `${label}-${step.tool}${images.length > 1 ? `-${i}` : ''}.png`),
      Buffer.from(image.data as string, 'base64'),
    );
  });
  console.log(
    `\n[${label}] ${step.tool} ${JSON.stringify(step.args ?? {})}${step.note === undefined ? '' : `   # ${step.note}`}\n  -> ${result.isError === true ? '(tool error) ' : ''}${images.length > 0 ? `${images.length} picture(s); ` : ''}${
      Object.keys(structured).length === 0
        ? (content.find((p) => p.type === 'text')?.text ?? '')
        : brief(step.tool, structured)
    }  [${ms.toFixed(0)} ms]`,
  );
}

await client.close();
await server.close();
rmSync(dataDir, { recursive: true, force: true });
process.exit(0);
