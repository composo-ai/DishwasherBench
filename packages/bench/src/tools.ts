/**
 * The tools of an episode as a policy holds them: an MCP client connected to the MCP server
 * of the episode. Every call a policy makes goes through here and is recorded: its name and
 * arguments, a digest of its result, the pictures it returned (saved to disk), when it was
 * made and how long it took.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { JsonValue } from '@spotless/core';
import { canonicalHash } from '@spotless/core';
import type { EpisodeToolCall } from '@spotless/server';
import type { ToolSpec } from './provider.ts';

/** What a tool call gave back. */
export interface ToolOutcome {
  /** The structured result (pictures replaced by their size and type); null when there is none. */
  readonly structured: { readonly [key: string]: unknown } | null;
  /** The result as text: the JSON of `structured`, or the error message. */
  readonly text: string;
  /** The pictures, base64 PNG, in order. */
  readonly images: readonly string[];
  readonly isError: boolean;
}

/** Options of {@link EpisodeTools}. */
export interface EpisodeToolsOptions {
  readonly client: Client;
  /** Directory the pictures are saved in; null to save none. */
  readonly imagesDir: string | null;
  /** How `imagesDir` is named in the record (relative to the record's directory). */
  readonly imagesRelative?: string;
  /** Wall-clock source for the times of the calls; default the system clock. */
  readonly now?: () => string;
  /**
   * How long a tool call may take before the client gives up on it, milliseconds; default 30
   * minutes. The MCP client's own default is one minute, and one `place` onto an untidy pile
   * can take longer than that on a busy machine. A call that is given up on may still have
   * been carried out, so the limit is set where it is not reached in practice.
   */
  readonly toolTimeoutMs?: number;
}

/** How long a tool call may take unless the options say otherwise, milliseconds. */
export const TOOL_TIMEOUT_MS = 30 * 60 * 1000;

/** The tools of one episode. */
export class EpisodeTools {
  /** Every call made so far, in order. */
  readonly calls: EpisodeToolCall[] = [];
  private readonly client: Client;
  private readonly imagesDir: string | null;
  private readonly imagesRelative: string;
  private readonly now: () => string;
  private readonly toolTimeoutMs: number;

  constructor(options: EpisodeToolsOptions) {
    this.toolTimeoutMs = options.toolTimeoutMs ?? TOOL_TIMEOUT_MS;
    this.client = options.client;
    this.imagesDir = options.imagesDir;
    this.imagesRelative = options.imagesRelative ?? 'images';
    this.now = options.now ?? ((): string => new Date().toISOString());
    if (this.imagesDir !== null) mkdirSync(this.imagesDir, { recursive: true });
  }

  /** The tools as the MCP server lists them: what a model is told, and nothing more. */
  async list(): Promise<ToolSpec[]> {
    const listed = await this.client.listTools();
    return listed.tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? '',
      input_schema: tool.inputSchema as { [key: string]: unknown },
    }));
  }

  /**
   * What the MCP server is, for the record: its name and version, and a digest of everything
   * it tells a client about its tools (names, titles, descriptions, input and output
   * schemas) and of its instructions.
   */
  async identity(): Promise<{ mcp_server: string; tools: number; tools_digest: string }> {
    const info = this.client.getServerVersion();
    const listed = await this.client.listTools();
    return {
      mcp_server: info === undefined ? 'unknown' : `${info.name}/${info.version}`,
      tools: listed.tools.length,
      tools_digest: canonicalHash(
        JSON.parse(
          JSON.stringify({
            instructions: this.client.getInstructions() ?? null,
            tools: listed.tools.map((tool) => ({
              name: tool.name,
              title: tool.title ?? null,
              description: tool.description ?? null,
              input_schema: tool.inputSchema,
              output_schema: tool.outputSchema ?? null,
            })),
          }),
        ) as JsonValue,
      ),
    };
  }

  /** The text of a resource of the MCP server. */
  async resource(uri: string): Promise<string> {
    const read = await this.client.readResource({ uri });
    return read.contents.map((content) => ('text' in content ? content.text : '')).join('\n');
  }

  /** Calls a tool and records the call. Never rejects: a failure is an error outcome. */
  async call(name: string, args: unknown): Promise<ToolOutcome> {
    const startedAt = this.now();
    const started = performance.now();
    let outcome: ToolOutcome;
    try {
      const result = await this.client.callTool(
        { name, arguments: (args ?? {}) as { [key: string]: unknown } },
        undefined,
        { timeout: this.toolTimeoutMs },
      );
      const content = (result.content ?? []) as {
        type: string;
        text?: string;
        data?: string;
      }[];
      const structured = (result.structuredContent ?? null) as { [key: string]: unknown } | null;
      outcome = {
        structured,
        text:
          content
            .filter((part) => part.type === 'text')
            .map((part) => part.text ?? '')
            .join('\n') || JSON.stringify(structured),
        images: content
          .filter((part) => part.type === 'image' && typeof part.data === 'string')
          .map((part) => part.data as string),
        isError: result.isError === true,
      };
    } catch (error) {
      outcome = {
        structured: null,
        text: error instanceof Error ? error.message : String(error),
        images: [],
        isError: true,
      };
    }
    const index = this.calls.length;
    const files: string[] = [];
    if (this.imagesDir !== null) {
      outcome.images.forEach((data, i) => {
        const file = `${String(index).padStart(4, '0')}-${name}${outcome.images.length > 1 ? `-${i}` : ''}.png`;
        writeFileSync(join(this.imagesDir as string, file), Buffer.from(data, 'base64'));
        files.push(`${this.imagesRelative}/${file}`);
      });
    }
    const accepted = outcome.structured?.['accepted'];
    const reason = outcome.structured?.['reason'];
    this.calls.push({
      index,
      name,
      arguments: JSON.parse(JSON.stringify(args ?? {})) as JsonValue,
      is_error: outcome.isError,
      accepted: typeof accepted === 'boolean' ? accepted : outcome.isError ? false : null,
      ...(accepted === false && typeof reason === 'string' ? { reason } : {}),
      result_digest: canonicalHash(outcome.structured ?? outcome.text),
      images: files,
      started_at: startedAt,
      duration_ms: Math.round(performance.now() - started),
    });
    return outcome;
  }
}
