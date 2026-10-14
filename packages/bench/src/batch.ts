/**
 * A batch: every level with every policy and every seed, one episode after another on one
 * game server, with the results table written at the end.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EpisodeRecord } from '@spotless/server';
import type { McpTransportKind, VerifyMode } from './episode.ts';
import { episodeProblem, runEpisode } from './episode.ts';
import type { HarnessGame } from './game.ts';
import type { Policy } from './policy.ts';
import type { ResultsTable } from './results.ts';
import { resultsMarkdown, resultsTable } from './results.ts';

/** Options of {@link runBatch}. */
export interface RunBatchOptions {
  readonly game: HarnessGame;
  readonly levels: readonly string[];
  /** One factory per policy: a policy is made anew for every episode. */
  readonly policies: readonly (() => Policy)[];
  /** Seeds of the policies' own random choices; one episode per seed. Default `[1]`. */
  readonly seeds?: readonly number[];
  /** Directory for the episodes and the table; created if missing. */
  readonly outDir: string;
  readonly transport?: McpTransportKind;
  readonly verify?: VerifyMode;
  readonly washTimeoutS?: number;
  readonly saveImages?: boolean;
  readonly log?: (line: string) => void;
}

/** What a batch produced. */
export interface BatchResult {
  readonly records: readonly EpisodeRecord[];
  /** Episodes that could not be run, with why. */
  readonly failures: readonly {
    readonly level: string;
    readonly policy: string;
    readonly seed: number;
    readonly error: string;
  }[];
  /** Episodes that were run and have no result (a failed wash, no cycle), with why. */
  readonly unscored: readonly { readonly episode_id: string; readonly problem: string }[];
  readonly table: ResultsTable;
  /** Paths of `results.md` and `results.json`. */
  readonly files: { readonly markdown: string; readonly json: string };
}

/** Writes the table of a set of records into a directory, as `results.md` and `results.json`. */
export function writeResults(
  records: readonly EpisodeRecord[],
  outDir: string,
): { table: ResultsTable; markdown: string; json: string } {
  mkdirSync(outDir, { recursive: true });
  const table = resultsTable(records);
  const markdown = join(outDir, 'results.md');
  const json = join(outDir, 'results.json');
  writeFileSync(markdown, resultsMarkdown(table));
  writeFileSync(json, `${JSON.stringify(table, null, 1)}\n`);
  return { table, markdown, json };
}

/**
 * Runs the episodes of a batch one after another. An episode that fails for a reason of the
 * harness or the infrastructure is noted and the batch goes on.
 */
export async function runBatch(options: RunBatchOptions): Promise<BatchResult> {
  const log = options.log ?? ((): void => undefined);
  const records: EpisodeRecord[] = [];
  const failures: { level: string; policy: string; seed: number; error: string }[] = [];
  for (const levelId of options.levels) {
    for (const make of options.policies) {
      for (const seed of options.seeds ?? [1]) {
        const policy = make();
        try {
          const result = await runEpisode({
            game: options.game,
            levelId,
            policy,
            seed,
            outDir: options.outDir,
            ...(options.transport === undefined ? {} : { transport: options.transport }),
            ...(options.verify === undefined ? {} : { verify: options.verify }),
            ...(options.washTimeoutS === undefined ? {} : { washTimeoutS: options.washTimeoutS }),
            ...(options.saveImages === undefined ? {} : { saveImages: options.saveImages }),
            log,
          });
          records.push(result.record);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          log(`FAILED ${levelId} ${policy.name} seed ${seed}: ${message}`);
          failures.push({ level: levelId, policy: policy.name, seed, error: message });
        }
        // A table after every episode: a batch that is stopped leaves what it has.
        writeResults(records, options.outDir);
      }
    }
  }
  const written = writeResults(records, options.outDir);
  const unscored = records.flatMap((record) => {
    const problem = episodeProblem(record);
    return problem === null ? [] : [{ episode_id: record.episode_id, problem }];
  });
  return {
    records,
    failures,
    unscored,
    table: written.table,
    files: { markdown: written.markdown, json: written.json },
  };
}
