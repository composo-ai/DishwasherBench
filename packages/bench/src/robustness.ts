/**
 * How far the score of a level's careful and careless reference loads moves when the wash is
 * repeated with another seed or with other values of the parameters the anchoring has not
 * settled: the numbers behind "a level whose ranking of careful against careless can flip is
 * not fit for the benchmark".
 *
 * Pure functions of reference washes (`reference.ts`); the washes are run by
 * `scripts/robustness.ts`.
 */

import type { ReferenceWash } from './reference.ts';

/** One case of the study: the game's own wash, another seed, or other parameters. */
export interface RobustnessCase {
  readonly name: string;
  /** What the case is, in words. */
  readonly what: string;
  readonly kind: 'base' | 'seed' | 'params';
}

/** A case with the washes of the two loads; null where a wash is missing. */
export interface RobustnessInput extends RobustnessCase {
  readonly careful: ReferenceWash | null;
  readonly careless: ReferenceWash | null;
}

/** What one load did in one case, against the same load in the base case. */
export interface LoadMovement {
  readonly points: number;
  readonly clean: number;
  readonly loaded: number;
  /** Loaded items whose verdict differs from the base case, and the points they are worth. */
  readonly verdicts_moved: number;
  readonly points_moved: number;
  /** The items, each with the verdict it has in this case. */
  readonly moved: readonly { readonly item_id: string; readonly clean: boolean }[];
}

/** One line of the study. */
export interface RobustnessLine extends RobustnessCase {
  readonly careful: LoadMovement | null;
  readonly careless: LoadMovement | null;
  /** Careful less careless, points; null when a wash is missing. */
  readonly margin: number | null;
  /** The margin as a share of the points the level offers. */
  readonly margin_of_level: number | null;
}

/** The study of one level. */
export interface LevelRobustness {
  readonly level: string;
  readonly points_available: number;
  readonly lines: readonly RobustnessLine[];
  /** Cases in which the careful load does not score more than the careless one. */
  readonly flips: readonly string[];
  /** Smallest and largest margin over the cases that were washed, points. */
  readonly margin_min: number | null;
  readonly margin_max: number | null;
  /** Most verdicts of one load that moved with the seed alone, and with a parameter case. */
  readonly seed_verdicts_max: number;
  readonly params_verdicts_max: number;
  /** Cases a wash is missing for. */
  readonly missing: readonly string[];
}

function movement(wash: ReferenceWash, base: ReferenceWash | null): LoadMovement {
  const before = new Map((base?.items ?? []).map((item) => [item.item_id, item]));
  const moved: { item_id: string; clean: boolean }[] = [];
  let points = 0;
  let clean = 0;
  let loaded = 0;
  let pointsMoved = 0;
  for (const item of wash.items) {
    if (!item.loaded) continue;
    loaded += 1;
    const isClean = item.clean === true;
    if (isClean) {
      clean += 1;
      points += item.points;
    }
    const was = before.get(item.item_id);
    if (was !== undefined && was.loaded && (was.clean === true) !== isClean) {
      moved.push({ item_id: item.item_id, clean: isClean });
      pointsMoved += item.points;
    }
  }
  return {
    points,
    clean,
    loaded,
    verdicts_moved: moved.length,
    points_moved: pointsMoved,
    moved,
  };
}

/**
 * The study of one level from its cases. The first case of kind `base` is what every other is
 * compared with. The ranking flips in a case when the careful load does not score strictly
 * more than the careless one there.
 */
export function robustnessOfLevel(
  level: string,
  cases: readonly RobustnessInput[],
): LevelRobustness {
  const base = cases.find((entry) => entry.kind === 'base');
  const available = (
    cases.find((entry) => entry.careful !== null)?.careful ??
    cases.find((entry) => entry.careless !== null)?.careless
  )?.items.reduce((sum, item) => sum + item.points, 0);
  const lines: RobustnessLine[] = cases.map((entry) => {
    const careful = entry.careful === null ? null : movement(entry.careful, base?.careful ?? null);
    const careless =
      entry.careless === null ? null : movement(entry.careless, base?.careless ?? null);
    const margin = careful === null || careless === null ? null : careful.points - careless.points;
    return {
      name: entry.name,
      what: entry.what,
      kind: entry.kind,
      careful,
      careless,
      margin,
      margin_of_level:
        margin === null || available === undefined || available === 0 ? null : margin / available,
    };
  });
  const margins = lines.flatMap((line) => (line.margin === null ? [] : [line.margin]));
  const most = (kind: RobustnessCase['kind']): number =>
    Math.max(
      0,
      ...lines
        .filter((line) => line.kind === kind)
        .flatMap((line) => [line.careful?.verdicts_moved ?? 0, line.careless?.verdicts_moved ?? 0]),
    );
  return {
    level,
    points_available: available ?? 0,
    lines,
    flips: lines
      .filter((line) => line.margin !== null && line.margin <= 0)
      .map((line) => line.name),
    margin_min: margins.length === 0 ? null : Math.min(...margins),
    margin_max: margins.length === 0 ? null : Math.max(...margins),
    seed_verdicts_max: most('seed'),
    params_verdicts_max: most('params'),
    missing: lines.filter((line) => line.margin === null).map((line) => line.name),
  };
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)} %`;
}

/** The study as Markdown: one table per level, then one line per level of what it shows. */
export function robustnessMarkdown(levels: readonly LevelRobustness[]): string {
  const out: string[] = [];
  for (const level of levels) {
    out.push(`Level ${level.level} (${level.points_available} points offered):\n`);
    out.push(
      '| Case | What | Careful | Careless | Margin | of the level | Careful: verdicts moved (points) | Careless: verdicts moved (points) |',
      '|---|---|---|---|---|---|---|---|',
    );
    for (const line of level.lines) {
      const load = (entry: LoadMovement | null): string =>
        entry === null ? 'not washed' : `${entry.points} (${entry.clean} of ${entry.loaded} clean)`;
      const moved = (entry: LoadMovement | null): string =>
        entry === null
          ? '-'
          : line.kind === 'base'
            ? 'reference'
            : `${entry.verdicts_moved} (${entry.points_moved})`;
      out.push(
        `| ${line.name} | ${line.what} | ${load(line.careful)} | ${load(line.careless)} | ${line.margin ?? '-'} | ${line.margin_of_level === null ? '-' : pct(line.margin_of_level)} | ${moved(line.careful)} | ${moved(line.careless)} |`,
      );
    }
    out.push('');
  }
  out.push(
    '| Level | Margin, smallest to largest | Most verdicts of a load moved by the seed | by a parameter | Ranking of careful over careless |',
    '|---|---|---|---|---|',
  );
  for (const level of levels) {
    const ranking =
      level.flips.length > 0
        ? `flips in ${level.flips.join(', ')}`
        : level.missing.length > 0
          ? `holds in every case washed (missing: ${level.missing.join(', ')})`
          : 'holds in every case';
    out.push(
      `| ${level.level} | ${level.margin_min ?? '-'} to ${level.margin_max ?? '-'} | ${level.seed_verdicts_max} | ${level.params_verdicts_max} | ${ranking} |`,
    );
  }
  return `${out.join('\n')}\n`;
}
