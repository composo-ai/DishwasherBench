/**
 * The reference policies on a level, as numbers: what each of them loaded, what came out clean,
 * and what each mistake of the careless load cost.
 *
 * A reference wash is a saved standard load of `@spotless/loader` washed by the wash runner. It
 * is summarised item by item with the verdict at both ends of the band in which a residue
 * becomes visible (`ItemWashResult.band` of the simulation), so that a level can be judged by
 * what does not depend on the eye of the inspector, and with whether the parameters of the wash
 * vouch for the verdict on this programme.
 *
 * The cost of a mistake is read from a pair of loads that hold the same items: the careless load
 * is the careful one with the mistakes made on it (`@spotless/loader`), so an item that is clean
 * in the careful load and not in the careless one lost its points to what was done to it or
 * around it. A mistake made on an item (a cup stood mouth up, a bowl nested in another) is
 * charged the points of that item and of its partner; what the rest of the load lost goes to
 * the mistakes that act on the whole machine (a blocked tablet, a stopped arm) when the load
 * has one, and is otherwise listed as lost with no mistake on the item.
 *
 * Everything here is a pure function of its arguments: the washes themselves are run by
 * `scripts/reference-table.ts`.
 */

import type { MistakeKind, MistakeMade } from '@spotless/loader';
import { MACHINE_MISTAKE_KINDS } from '@spotless/loader';

/** One item of a reference wash. */
export interface ReferenceItem {
  readonly item_id: string;
  readonly points: number;
  readonly loaded: boolean;
  /** The verdict that decides the points. Absent for an item that was not loaded. */
  readonly clean?: boolean;
  /** IEC score, 0 to 5. */
  readonly score?: number;
  /** The verdict of the strictest and of the most lenient inspector the dossiers allow. */
  readonly strict_clean?: boolean;
  readonly lenient_clean?: boolean;
  /** False when the two differ: the item is at the edge of clean. */
  readonly decided?: boolean;
  /** True when the parameters of the wash do not vouch for the verdict on this programme. */
  readonly provisional?: boolean;
  /** Each soil with the share of its dry mass that is left. */
  readonly soils?: readonly {
    readonly type: string;
    readonly model_class: string;
    readonly left: number;
  }[];
  /** Water standing in the item at the end, millilitres. */
  readonly water_ml?: number;
}

/** A reference wash: one saved load washed once. */
export interface ReferenceWash {
  /** Name of the saved load (`tutorial-careful`). */
  readonly load: string;
  readonly level: string;
  readonly policy: string;
  readonly tier: string;
  readonly programme: string;
  /** What computed it (`WashReport.job.sim_version`) and the hash of the result. */
  readonly sim_version: string;
  readonly result_hash: string;
  /** Scene hash of the load that was washed. */
  readonly load_state: string;
  readonly offered: number;
  readonly items: readonly ReferenceItem[];
  /** The mistakes the saved load records (careless loads). */
  readonly mistakes: readonly MistakeMade[];
  /** The notes of the wash report. */
  readonly notes: readonly string[];
  /** Wall-clock seconds of the wash. */
  readonly seconds: number;
}

/** One line of the reference table: a level and a policy. */
export interface ReferenceRow {
  readonly level: string;
  readonly policy: string;
  readonly tier: string;
  readonly programme: string;
  /** Points by the verdict, and what the level offers. */
  readonly points: number;
  readonly points_available: number;
  /** `points / points_available`. */
  readonly share: number;
  /** Points if every item at the edge of clean is read by the strictest eye, and by the most lenient. */
  readonly points_strict: number;
  readonly points_lenient: number;
  readonly clean: number;
  readonly loaded: number;
  readonly offered: number;
  /** Points of the loaded items. */
  readonly points_loaded: number;
  /** Loaded items at the edge of clean, and their points. */
  readonly edge: number;
  readonly edge_points: number;
  /** Loaded items whose verdict the parameters do not vouch for, and their points. */
  readonly provisional: number;
  readonly provisional_points: number;
}

/** The table row of a reference wash. */
export function referenceRow(wash: ReferenceWash): ReferenceRow {
  let points = 0;
  let strict = 0;
  let lenient = 0;
  let clean = 0;
  let loaded = 0;
  let pointsLoaded = 0;
  let edge = 0;
  let edgePoints = 0;
  let provisional = 0;
  let provisionalPoints = 0;
  let available = 0;
  for (const item of wash.items) {
    available += item.points;
    if (!item.loaded) continue;
    loaded += 1;
    pointsLoaded += item.points;
    if (item.clean === true) {
      clean += 1;
      points += item.points;
    }
    if ((item.strict_clean ?? item.clean) === true) strict += item.points;
    if ((item.lenient_clean ?? item.clean) === true) lenient += item.points;
    if (item.decided === false) {
      edge += 1;
      edgePoints += item.points;
    }
    if (item.provisional === true) {
      provisional += 1;
      provisionalPoints += item.points;
    }
  }
  return {
    level: wash.level,
    policy: wash.policy,
    tier: wash.tier,
    programme: wash.programme,
    points,
    points_available: available,
    share: available > 0 ? points / available : 0,
    points_strict: strict,
    points_lenient: lenient,
    clean,
    loaded,
    offered: wash.offered,
    points_loaded: pointsLoaded,
    edge,
    edge_points: edgePoints,
    provisional,
    provisional_points: provisionalPoints,
  };
}

/** The mistakes that act on the whole machine and not on the item they are made with. */
export const MACHINE_MISTAKES: readonly MistakeKind[] = MACHINE_MISTAKE_KINDS;

/** What one kind of mistake cost in a careless load. */
export interface MistakeCost {
  /** The kind, or `no_mistake_on_item` for points lost by items no mistake was made with. */
  readonly kind: MistakeKind | 'no_mistake_on_item' | 'left_out';
  /** How many mistakes of the kind the load holds. */
  readonly made: number;
  /** Items the kind is charged with: those it was made on and their partners. */
  readonly items: readonly string[];
  /** Of those, the ones that were clean in the careful load and are not in the careless one. */
  readonly lost_items: readonly string[];
  /** Points those lost, and points gained by items of the kind that came clean only here. */
  readonly points_lost: number;
  readonly points_gained: number;
}

/**
 * What each kind of mistake of a careless load cost, against the careful load of the same
 * level. Items are matched by id. An item with mistakes of several kinds is charged to the
 * first kind in the order the load records them.
 */
export function mistakeCosts(careful: ReferenceWash, careless: ReferenceWash): MistakeCost[] {
  const before = new Map(careful.items.map((item) => [item.item_id, item]));
  const after = new Map(careless.items.map((item) => [item.item_id, item]));
  const owner = new Map<string, MistakeKind>();
  const made = new Map<MistakeKind, number>();
  const itemsOf = new Map<MistakeKind, string[]>();
  for (const mistake of careless.mistakes) {
    made.set(mistake.kind, (made.get(mistake.kind) ?? 0) + 1);
    if (MACHINE_MISTAKES.includes(mistake.kind)) continue;
    for (const id of [mistake.item_id, ...(mistake.with === undefined ? [] : [mistake.with])]) {
      if (owner.has(id) || !after.has(id)) continue;
      owner.set(id, mistake.kind);
      itemsOf.set(mistake.kind, [...(itemsOf.get(mistake.kind) ?? []), id]);
    }
  }
  const machineKinds = MACHINE_MISTAKES.filter((kind) => made.has(kind));
  const lost = new Map<string, { items: string[]; points: number; gained: number }>();
  const charge = (kind: string, id: string, points: number): void => {
    const entry = lost.get(kind) ?? { items: [], points: 0, gained: 0 };
    if (points > 0) {
      entry.items.push(id);
      entry.points += points;
    } else entry.gained -= points;
    lost.set(kind, entry);
  };
  for (const [id, was] of before) {
    const now = after.get(id);
    const wasPoints = was.loaded && was.clean === true ? was.points : 0;
    const nowPoints = now?.loaded === true && now.clean === true ? now.points : 0;
    if (wasPoints === nowPoints) continue;
    let kind: string;
    if (was.loaded && now?.loaded !== true) kind = 'left_out';
    else if (!was.loaded) kind = owner.get(id) ?? 'no_mistake_on_item';
    else kind = owner.get(id) ?? machineKinds[0] ?? 'no_mistake_on_item';
    charge(kind, id, wasPoints - nowPoints);
  }
  const kinds: string[] = [...made.keys()];
  for (const kind of lost.keys()) if (!kinds.includes(kind)) kinds.push(kind);
  return kinds.map((kind) => {
    const entry = lost.get(kind);
    const charged = MACHINE_MISTAKES.includes(kind as MistakeKind)
      ? careless.items
          .filter((item) => item.loaded && !owner.has(item.item_id))
          .map((item) => item.item_id)
      : (itemsOf.get(kind as MistakeKind) ?? entry?.items ?? []);
    return {
      kind: kind as MistakeCost['kind'],
      made: made.get(kind as MistakeKind) ?? 0,
      items: charged,
      lost_items: entry?.items ?? [],
      points_lost: entry?.points ?? 0,
      points_gained: entry?.gained ?? 0,
    };
  });
}

/** The gates a level is held to on its reference washes. */
export interface ReferenceGates {
  /** Careful must score at least this share of the points it loaded. */
  readonly carefulYieldMin: number;
  /** Careful must beat careless by at least this share of the points the level offers. */
  readonly carefulOverCareless: number;
  /**
   * Careless must beat random by more than this share of the points the level offers, unless
   * the two loads are of different kinds ({@link ReferenceGates.differentInKind}).
   */
  readonly carelessOverRandom: number;
  /**
   * A careless load that does not beat the random one still passes when it is a different kind
   * of load: it holds at least this many times the points the random load holds (a full
   * machine loaded badly against a small pile).
   */
  readonly differentInKind: number;
  /** At most this share of the level's points may ride on loaded items at the edge of clean. */
  readonly edgeShareMax: number;
  /**
   * A careful load must leave at least this share of the level's points on the counter: more
   * is offered than fits. Not asked of a level that is meant to fit whole (the tutorial).
   */
  readonly leftOnCounterMin: number;
}

/**
 * The gates of a level, the same for a hand-written level and a generated one, judged on the
 * official tier (the fast tier's table is held to them too, as a preview).
 *
 * Since 11 October 2026 they are the lead's for the first measurements on Eco 50:
 *  - careful beats careless by at least a fifth of the points the level offers;
 *  - careless beats random, or is clearly different in kind;
 *  - a careful load cleans at least two thirds of what it loads;
 *  - no more than a tenth of the level's points rest on verdicts at the edge of clean.
 * Before that the margins were shares of the careful load's score (10 % and 5 %), the yield
 * 60 % and the edge 5 %; `referenceMargins` still reports every margin on both bases.
 *
 * "Different in kind" is made a number so that it cannot be argued level by level: the careless
 * load holds at least 1.2 times the points of the random one [ESTIMATED: a fifth more in the
 * machine is a different load, not the same pile]. The table gives the points each load holds.
 *
 * That more is offered than fits (benchmark.md 5.7: candidate items of 1.3 to 2.0 times the
 * capacity) is the designer's gate and stays as it was.
 */
export const REFERENCE_GATES: ReferenceGates = {
  carefulYieldMin: 2 / 3,
  carefulOverCareless: 0.2,
  carelessOverRandom: 0,
  differentInKind: 1.2,
  edgeShareMax: 0.1,
  leftOnCounterMin: 0.15,
};

/** Levels that are meant to fit whole: they teach the interface, not the choosing. */
export const MEANT_TO_FIT: readonly string[] = ['tutorial'];

/** One finding of {@link referenceFindings}. */
export interface ReferenceFinding {
  readonly level: string;
  readonly gate: string;
  readonly message: string;
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)} %`;
}

/** How far apart two policies are on a level, on both bases. */
export interface PolicyMargin {
  /** The better policy read by the strictest eye less the worse one read by the most lenient, points. */
  readonly points: number;
  /** That as a share of the careful load's score (strict). */
  readonly of_careful: number;
  /** That as a share of the points the level offers: what the gates judge. */
  readonly of_level: number;
}

/** The figures the gates of a level are judged by. */
export interface ReferenceMargins {
  readonly level: string;
  /** Share of the points the careful load holds that it scores. */
  readonly careful_yield: number;
  /** Share of the level's points the careful load leaves on the counter. */
  readonly left_on_counter: number;
  /** Null when the level has no careless, or no random, reference wash. */
  readonly careful_over_careless: PolicyMargin | null;
  readonly careless_over_random: PolicyMargin | null;
  /**
   * Points the careless load holds over points the random load holds (what "different in
   * kind" is read from); null without the two washes or when the random load holds nothing.
   */
  readonly careless_to_random_loaded: number | null;
}

/**
 * The margins of one level from its reference rows; null when it has no careful row. Two
 * policies are compared the hard way round: the better read by the strictest eye, the worse by
 * the most lenient. A careful load that scores nothing gives margins of zero.
 */
export function referenceMargins(rows: readonly ReferenceRow[]): ReferenceMargins | null {
  const by = new Map(rows.map((row) => [row.policy, row]));
  const careful = by.get('careful');
  if (careful === undefined) return null;
  const careless = by.get('careless');
  const random = by.get('random');
  const margin = (better: ReferenceRow, worse: ReferenceRow): PolicyMargin => {
    const points = better.points_strict - worse.points_lenient;
    return {
      points,
      of_careful: careful.points_strict > 0 ? points / careful.points_strict : 0,
      of_level: careful.points_available > 0 ? points / careful.points_available : 0,
    };
  };
  return {
    level: careful.level,
    careful_yield: careful.points_loaded > 0 ? careful.points / careful.points_loaded : 0,
    left_on_counter:
      careful.points_available > 0 ? 1 - careful.points_loaded / careful.points_available : 0,
    careful_over_careless: careless === undefined ? null : margin(careful, careless),
    careless_over_random:
      careless === undefined || random === undefined ? null : margin(careless, random),
    careless_to_random_loaded:
      careless === undefined || random === undefined || random.points_loaded === 0
        ? null
        : careless.points_loaded / random.points_loaded,
  };
}

/**
 * What the reference rows of one level say against the gates: empty when the level passes. The
 * comparison of two policies is made the hard way round: the better policy read by the
 * strictest eye against the worse one read by the most lenient, so that no gate is passed on
 * the strength of an item at the edge of clean.
 */
export function referenceFindings(
  rows: readonly ReferenceRow[],
  gates: ReferenceGates = REFERENCE_GATES,
): ReferenceFinding[] {
  const out: ReferenceFinding[] = [];
  const by = new Map(rows.map((row) => [row.policy, row]));
  const level = rows[0]?.level ?? '';
  const add = (gate: string, message: string): void => {
    out.push({ level, gate, message });
  };
  const careful = by.get('careful');
  const careless = by.get('careless');
  const random = by.get('random');
  const empty = by.get('empty');
  if (careful === undefined) {
    add('careful', 'no careful reference wash');
    return out;
  }
  const available = careful.points_available;
  const left = 1 - careful.points_loaded / available;
  if (!MEANT_TO_FIT.includes(level) && left < gates.leftOnCounterMin) {
    add(
      'more_than_fits',
      `careful loading leaves ${pct(left)} of the points on the counter, under ${pct(gates.leftOnCounterMin)}: the level does not offer clearly more than fits`,
    );
  }
  if (careful.points_loaded > 0 && careful.points / careful.points_loaded < gates.carefulYieldMin) {
    add(
      'careful_yield',
      `careful loading gets ${careful.points} of the ${careful.points_loaded} points it loads (${pct(careful.points / careful.points_loaded)}); a careful load must get most items clean (at least ${pct(gates.carefulYieldMin)})`,
    );
  }
  for (const row of rows) {
    if (row.edge_points / available > gates.edgeShareMax) {
      add(
        'edge',
        `${row.policy}: ${row.edge} items worth ${row.edge_points} points (${pct(row.edge_points / available)}) are at the edge of clean`,
      );
    }
    if (row.provisional > 0) {
      add(
        'provisional',
        `${row.policy}: ${row.provisional} items worth ${row.provisional_points} points carry a verdict the parameters of the wash do not vouch for`,
      );
    }
  }
  const margins = referenceMargins(rows);
  const over = margins?.careful_over_careless ?? null;
  if (careless === undefined) add('careless', 'no careless reference wash');
  else if (over !== null && over.of_level < gates.carefulOverCareless) {
    add(
      'careful_over_careless',
      `careful ${careful.points_strict} (strict) against careless ${careless.points_lenient} (lenient): apart by ${over.points} points, ${pct(over.of_level)} of the level's ${available} (${pct(over.of_careful)} of the careful score), under ${pct(gates.carefulOverCareless)}`,
    );
  }
  const under = margins?.careless_over_random ?? null;
  if (random === undefined) add('random', 'no random reference wash');
  else if (careless !== undefined && under !== null && under.of_level <= gates.carelessOverRandom) {
    const ratio = margins?.careless_to_random_loaded ?? null;
    // Not ahead of the random pile: it still passes when it is another kind of load.
    if (ratio === null || ratio < gates.differentInKind) {
      add(
        'careless_over_random',
        `careless ${careless.points_strict} (strict) does not beat random ${random.points_lenient} (lenient), and the two loads are of a kind: careless holds ${careless.points_loaded} points, random ${random.points_loaded}${ratio === null ? '' : ` (${ratio.toFixed(2)} times; different in kind from ${gates.differentInKind})`}`,
      );
    }
  }
  if (empty !== undefined && empty.points !== 0) {
    add('empty', `the empty machine scores ${empty.points}`);
  }
  return out;
}

/**
 * How much of a careful score two washes of one load differ by at the fast tier when only the
 * simulation's seed changes: about 2 verdicts of 88 (docs/calibration/anchoring-v4.md, the
 * table of seed flips on Eco 50), which at 5 points an item is some 6 % of a careful score of
 * 170. [ESTIMATED from those figures; `scripts/robustness.ts` measures it on three levels.] It
 * takes no part in any gate: `marginsMarkdown` marks a lead of careless over random smaller
 * than this, so that a level is not read as separating the two on the strength of a
 * difference a second seed could undo.
 */
export const FAST_TIER_NOISE_OF_CAREFUL = 0.06;

/** The margins of the levels as Markdown: one line per level, both bases, and the verdict of each gate. */
export function marginsMarkdown(
  margins: readonly ReferenceMargins[],
  gates: ReferenceGates = REFERENCE_GATES,
): string {
  const over = (margin: PolicyMargin | null): string => {
    if (margin === null) return 'not measured | - | - | -';
    const verdict = margin.of_level < gates.carefulOverCareless ? 'does not pass' : 'passes';
    return `${margin.points} | ${pct(margin.of_level)} | ${pct(margin.of_careful)} | ${verdict}`;
  };
  const under = (entry: ReferenceMargins): string => {
    const margin = entry.careless_over_random;
    if (margin === null) return 'not measured | - | - | -';
    const ratio = entry.careless_to_random_loaded;
    const held = ratio === null ? '-' : `${ratio.toFixed(2)} times`;
    const verdict =
      margin.of_level > gates.carelessOverRandom
        ? margin.of_careful < FAST_TIER_NOISE_OF_CAREFUL
          ? 'passes, within noise'
          : 'passes'
        : ratio !== null && ratio >= gates.differentInKind
          ? 'passes as different in kind'
          : 'does not pass';
    return `${margin.points} | ${pct(margin.of_level)} | ${held} | ${verdict}`;
  };
  const lines = [
    `| Level | Careful yield (gate ${pct(gates.carefulYieldMin)}) | Left on the counter | Careful over careless, points | of the level (gate ${pct(gates.carefulOverCareless)}) | of the careful score | Gate | Careless over random, points | of the level | Careless holds, against random | Gate |`,
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const entry of margins) {
    lines.push(
      `| ${entry.level} | ${pct(entry.careful_yield)}${entry.careful_yield < gates.carefulYieldMin ? ' (does not pass)' : ''} | ${pct(entry.left_on_counter)} | ${over(entry.careful_over_careless)} | ${under(entry)} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

/** The reference table as Markdown, one line per level and policy. */
export function referenceMarkdown(rows: readonly ReferenceRow[]): string {
  const lines = [
    '| Level | Policy | Tier | Programme | Points | Share | Strict to lenient | Clean of loaded | Loaded of offered | At the edge of clean | Provisional |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.level} | ${row.policy} | ${row.tier} | ${row.programme} | ${row.points} of ${row.points_available} | ${pct(row.share)} | ${row.points_strict} to ${row.points_lenient} | ${row.clean} of ${row.loaded} | ${row.loaded} of ${row.offered} | ${row.edge} (${row.edge_points} pt) | ${row.provisional} (${row.provisional_points} pt) |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

/** The costs of the mistakes of one level as Markdown lines. */
export function mistakeCostMarkdown(level: string, costs: readonly MistakeCost[]): string {
  const lines = [
    `| Level | Mistake | Made | Items it is charged with | Items that lost their points | Points lost | Points gained |`,
    '|---|---|---|---|---|---|---|',
  ];
  for (const cost of costs) {
    lines.push(
      `| ${level} | ${cost.kind} | ${cost.made} | ${cost.items.length} | ${cost.lost_items.join(', ') || '-'} | ${cost.points_lost} | ${cost.points_gained} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}
