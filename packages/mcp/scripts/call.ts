/**
 * One call to an MCP server of the game that is already running over streamable HTTP: for
 * playing an episode by hand from a terminal, one call at a time, seeing exactly what an agent
 * is given (the text of every result and the pictures).
 *
 *   # 1. a game server in benchmark mode and an episode (docs/benchmark/README.md section 3)
 *   pnpm --filter @spotless/server exec tsx src/cli.ts serve --admin-token <token> --port 8787
 *   pnpm --filter @spotless/server exec tsx src/cli.ts link --admin-token <token> \
 *        --server http://127.0.0.1:8787 --level tutorial --player by-hand --agent
 *   # 2. the MCP server of that episode
 *   pnpm --filter @spotless/mcp exec tsx src/cli.ts --server http://127.0.0.1:8787 \
 *        --session <episode id> --http --port 8788
 *   # 3. calls
 *   pnpm --filter @spotless/mcp exec tsx scripts/call.ts --url http://127.0.0.1:8788/mcp --tools
 *   ... call.ts --url ... --resource spotless://level/manual
 *   ... call.ts --url ... get_level
 *   ... call.ts --url ... render '{"view":"iso_lower","labels":true}' --out <dir>
 *
 * The text of the result is printed as the server sent it; every picture is written to `--out`
 * (default the system's temporary directory) and its path printed. `--max <n>` cuts the
 * printed text after n characters and says how long it was.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

const { values, positionals } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://127.0.0.1:8788/mcp' },
    out: { type: 'string' },
    tools: { type: 'boolean' },
    resource: { type: 'string' },
    max: { type: 'string' },
    name: { type: 'string' },
  },
  allowPositionals: true,
});
const out = resolve(values.out ?? join(tmpdir(), 'spotless-mcp-call'));
const max = values.max === undefined ? Infinity : Number(values.max);
const cut = (text: string): string =>
  text.length > max ? `${text.slice(0, max)}\n... (${text.length} characters in all)` : text;

const client = new Client({ name: 'spotless-call-script', version: '0.1.0' });
await client.connect(
  new StreamableHTTPClientTransport(new URL(values.url)) as unknown as Transport,
);
try {
  if (values.tools === true) {
    for (const tool of (await client.listTools()).tools) {
      console.log(
        `## ${tool.name}\n${tool.description ?? ''}\n${JSON.stringify(tool.inputSchema)}\n`,
      );
    }
  } else if (values.resource !== undefined) {
    const read = await client.readResource({ uri: values.resource });
    console.log(cut(read.contents.map((c) => ('text' in c ? String(c.text) : '')).join('\n')));
  } else {
    const [tool, json] = positionals;
    if (tool === undefined) throw new Error('name a tool, or give --tools or --resource <uri>');
    const started = performance.now();
    const result = await client.callTool(
      {
        name: tool,
        arguments: json === undefined ? {} : (JSON.parse(json) as Record<string, unknown>),
      },
      undefined,
      { timeout: 30 * 60 * 1000 },
    );
    const content = (result.content ?? []) as (
      { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }
    )[];
    let pictures = 0;
    for (const block of content) {
      if (block.type === 'text') console.log(cut(block.text));
      else if (block.type === 'image') {
        mkdirSync(out, { recursive: true });
        const file = join(
          out,
          `${values.name ?? `${tool}-${Date.now()}`}${pictures === 0 ? '' : `-${pictures}`}.png`,
        );
        writeFileSync(file, Buffer.from(block.data, 'base64'));
        console.log(
          `[picture ${block.mimeType}, ${Math.round((block.data.length * 3) / 4 / 1024)} kB: ${file}]`,
        );
        pictures += 1;
      }
    }
    console.log(
      `(${result.isError === true ? 'error, ' : ''}${Math.round(performance.now() - started)} ms)`,
    );
  }
} finally {
  await client.close();
}
