/**
 * What the panels say: the feedback after an action, the mechanical check and the budgets, each
 * as plain data for the page to show (the progress of the wash and the report are in
 * `report.ts`). Pure functions of the session's results; nothing here predicts a wash.
 */

import type {
  BudgetState,
  ContactSummary,
  DropResult,
  LoadCheck,
  MovedItem,
  PlacedItemState,
} from '@spotless/session';

/** One line of a panel. `ok` is good news, `warn` worth a look, `bad` a problem, `info` neutral. */
export interface Line {
  readonly level: 'ok' | 'info' | 'warn' | 'bad';
  readonly text: string;
}

function line(level: Line['level'], text: string): Line {
  return { level, text };
}

/** `plate_01, plate_02 and bowl_01`. */
export function listOf(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1] as string}`;
}

/** The parts of the machine a result may name, in words. */
const PART_WORDS: { readonly [id: string]: string } = {
  tub: 'the wall or floor of the tub',
  door: 'the door',
  lower_rack: 'the wires of the lower basket',
  upper_rack: 'the wires of the upper basket',
  third_rack: 'the third rack',
  upper_rack_fittings: 'a shelf of the upper basket (the cup shelves or the knife shelf)',
  cutlery_basket: 'the cutlery basket',
  tablet_tray: 'the tablet tray of the upper basket',
  filter: 'the filter',
  lower_arm: 'the lower spray arm',
  upper_arm: 'the upper spray arm',
  roof_spinner: 'the spray head in the roof',
  feed_duct: 'the feed duct at the back',
  dispenser: 'the detergent dispenser',
};

/**
 * What a result names as being in the way, in words: a part of the machine by what it is, an
 * item of the level by its id (which is what the lists of the page call it).
 */
export function thingWords(id: string): string {
  const known = PART_WORDS[id] ?? PART_WORDS[id.split('.')[0] as string];
  return known ?? id;
}

/** `plate_01, the cutlery basket and bowl_01`. */
export function thingsText(ids: readonly string[]): string {
  return listOf([...new Set(ids.map(thingWords))]);
}

/** A number with at most one decimal, without a trailing `.0`. */
export function tidy(x: number): string {
  return String(Math.round(x * 10) / 10);
}

/** Every rejection reason of the contract, in words. */
const REASONS: { readonly [reason: string]: string } = {
  invalid_argument: 'The request was malformed.',
  budget_exhausted: 'The action budget is used up. You can still start the cycle.',
  episode_over: 'The cycle has been started: the load can no longer be changed or checked.',
  physics_limit:
    'The load is too crowded there for the physics engine to simulate reliably. Nothing changed.',
  unknown_item: 'There is no such item in this level.',
  already_placed: 'That item is already in the machine. Take it out first.',
  collision_at_pose: 'The item would overlap something at that pose.',
  not_insertable: 'The item cannot get there in a straight line.',
  forbidden: 'This server only lets its harness do that.',
  out_of_bounds: 'That position is outside the basket.',
  not_placed: 'That item is not in the machine.',
  unknown_option: 'This basket has no such setting.',
  blocked: 'Something in the load is in the way.',
  unknown_programme: 'The machine has no such programme.',
  no_washes_left: 'No wash is left in this level.',
  door_blocked:
    'A basket will not go in or the door will not close on the load. Run the mechanical check to see what is in the way.',
  query_budget_exhausted: 'The query budget is used up.',
  not_available: 'This is not available in this level.',
  unknown_rack: 'The machine has no such basket.',
  no_cycle_started: 'No cycle has been started.',
  no_report: 'There is no report yet.',
};

/** A rejection as returned by the session or the server. */
export interface RejectionLike {
  readonly accepted: false;
  readonly reason: string;
  readonly detail?: string;
  readonly penetration_mm?: number;
  readonly colliding_with?: readonly string[];
  readonly blocked_by?: string | readonly string[];
}

/** Why a call was refused, in words, with what the result says is in the way. */
export function describeRejection(result: RejectionLike): Line[] {
  const lines = [line('bad', REASONS[result.reason] ?? `Refused: ${result.reason}.`)];
  if (result.colliding_with !== undefined && result.colliding_with.length > 0) {
    const depth =
      result.penetration_mm === undefined ? '' : ` by ${tidy(result.penetration_mm)} mm`;
    lines.push(line('info', `Overlaps ${thingsText(result.colliding_with)}${depth}.`));
  }
  const blockers =
    result.blocked_by === undefined
      ? []
      : typeof result.blocked_by === 'string'
        ? [result.blocked_by]
        : result.blocked_by;
  if (blockers.length > 0) lines.push(line('info', `In the way: ${thingsText(blockers)}.`));
  if (result.detail !== undefined && result.detail !== '') lines.push(line('info', result.detail));
  lines.push(line('info', 'Nothing changed and nothing was charged.'));
  return lines;
}

function contactsText(contacts: readonly ContactSummary[]): string {
  if (contacts.length === 0) return 'touching nothing';
  return `touching ${listOf(contacts.map((c) => c.with))}`;
}

function movedText(moved: readonly MovedItem[]): string {
  return listOf(
    moved.map((m) => `${m.item_id} (${tidy(m.displacement_mm)} mm, ${tidy(m.rotation_deg)}°)`),
  );
}

/** What happened to an item that was placed: physical facts only. */
export function describeDrop(result: DropResult): Line[] {
  if (!result.accepted) return describeRejection(result);
  const lines: Line[] = [];
  const p = result.settled_pose.position_mm;
  lines.push(
    line(
      'info',
      `${result.item_id} came to rest after ${tidy(result.settle_time_s)} s at ` +
        `(${tidy(p[0])}, ${tidy(p[1])}, ${tidy(p[2])}) mm in ${result.settled_pose.frame}, ` +
        `${tidy(result.displacement_mm)} mm and ${tidy(result.rotation_deg)}° from where it was let go.`,
    ),
  );
  const returned = result.returned.includes(result.item_id);
  if (returned) {
    lines.push(
      line(
        'bad',
        'It fell out of the machine onto the kitchen floor. It is back on the counter; the action was charged.',
      ),
    );
  } else if (result.fell_through) {
    lines.push(
      line(
        'bad',
        `It fell through the basket and is ${contactsText(result.contacts)}. Unless it ends up in a basket or inside the tub it will be left out of the wash.`,
      ),
    );
  } else if (result.fell_out) {
    lines.push(line('bad', 'It fell out of the basket.'));
  } else if (result.stable) {
    lines.push(line('ok', `It is at rest and stable, ${contactsText(result.contacts)}.`));
  } else {
    lines.push(
      line(
        'warn',
        `It is not stable: a nudge moves it by more than a few millimetres. It is ${contactsText(result.contacts)}.`,
      ),
    );
  }
  if (result.moved_items.length > 0) {
    lines.push(line('warn', `It moved ${movedText(result.moved_items)}.`));
  }
  const others = result.returned.filter((id) => id !== result.item_id);
  if (others.length > 0) lines.push(returnedLine(others));
  return lines;
}

function returnedLine(returned: readonly string[]): Line {
  return line(
    'bad',
    `Knocked out of the machine onto the kitchen floor and back on the counter: ${listOf(returned)}.`,
  );
}

/** What moved as a consequence of an action that is not a `place`. */
export function describeMoved(
  what: string,
  moved: readonly MovedItem[],
  returned: readonly string[] = [],
): Line[] {
  const fell = returned.length === 0 ? [] : [returnedLine(returned)];
  if (moved.length === 0 && fell.length === 0) return [line('ok', `${what} Nothing else moved.`)];
  return [
    line('info', what),
    ...(moved.length === 0 ? [] : [line('warn', `Moved: ${movedText(moved)}.`)]),
    ...fell,
  ];
}

/** Where a placed item lies, for the tray and the selection panel. */
export function locationText(location: PlacedItemState['location']): string {
  switch (location) {
    case 'lower_rack':
      return 'Lower basket';
    case 'upper_rack':
      return 'Upper basket';
    case 'tub_floor':
      return 'On the tub floor';
    case 'outside':
      return 'On the door: will not be washed';
  }
}

/** A placed item in words, for the selection panel. */
export function describePlaced(item: PlacedItemState): Line[] {
  if (item.location === 'outside') {
    return [
      line(
        'bad',
        'It lies on the door, not in a basket: it will be left out of the wash unless you take it out and load it.',
      ),
      line('info', `It is ${contactsText(item.contacts)}.`),
    ];
  }
  return [
    ...(item.location === 'tub_floor' ? [line('warn', 'It lies on the floor of the tub.')] : []),
    item.stable
      ? line('ok', 'At rest and stable.')
      : line('warn', 'Not stable: a nudge moves it by more than a few millimetres.'),
    line('info', `It is ${contactsText(item.contacts)}.`),
  ];
}

/** The mechanical check, readable: one line per fact, problems first within each group. */
export function describeLoadCheck(check: LoadCheck): Line[] {
  const lines: Line[] = [];
  for (const rack of check.racks) {
    lines.push(
      rack.slides_in
        ? line('ok', `${rack.rack} slides in.`)
        : line(
            'bad',
            `${rack.rack} does not slide in${rack.blocked_by === undefined ? '' : `: ${rack.blocked_by} is in the way`}.`,
          ),
    );
  }
  for (const arm of check.spray_arms) {
    if (arm.full_rotation) {
      lines.push(line('ok', `${arm.arm} turns freely.`));
    } else {
      const at =
        arm.first_contact_angle_deg === undefined
          ? ''
          : ` after ${tidy(arm.first_contact_angle_deg)}°`;
      const by = arm.blocked_by === undefined ? '' : ` by ${arm.blocked_by}`;
      lines.push(line('bad', `${arm.arm} is stopped${at}${by}.`));
    }
  }
  lines.push(
    check.door_closes
      ? line('ok', 'The door closes.')
      : line(
          'bad',
          check.door_blocked_by.length > 0
            ? `The door does not close: ${listOf(check.door_blocked_by)} in the way.`
            : 'The door does not close while a basket is not in.',
        ),
  );
  lines.push(
    check.dispenser_opens
      ? line('ok', 'The detergent dispenser opens.')
      : line('bad', `The detergent dispenser is blocked by ${listOf(check.dispenser_blocked_by)}.`),
  );
  lines.push(
    check.tablet_path_clear
      ? line('ok', 'The tablet can fall into its tray.')
      : line('bad', `The tablet's path is blocked by ${listOf(check.tablet_blocked_by)}.`),
  );
  if (check.fell_out.length > 0) {
    lines.push(
      line(
        'bad',
        `Not in a basket or the tub once the baskets are in (will not be washed): ${listOf(check.fell_out)}.`,
      ),
    );
  }
  if (check.on_tub_floor.length > 0) {
    lines.push(
      line(
        'bad',
        `On the tub floor, or standing on it through a basket: ${listOf(check.on_tub_floor)}.`,
      ),
    );
  }
  // What reaches out of a basket that went in with it, and what moved on the way, are facts and
  // no faults: whether they matter is said above (a basket that does not slide in, an arm that
  // is stopped, a door that does not close, an item that is no longer in a basket).
  for (const p of check.protruding) lines.push(line('info', protrudingText(p)));
  const pushed = check.shifted.filter((m) => (m.pushed_by ?? []).length > 0);
  const carried = check.shifted.filter((m) => (m.pushed_by ?? []).length === 0);
  for (const m of pushed) {
    const by = listOf((m.pushed_by ?? []).map(partWords));
    lines.push(
      line(
        'info',
        `${by.charAt(0).toUpperCase()}${by.slice(1)} pushed ${m.item_id} in as the baskets went in ` +
          `(${tidy(m.displacement_mm)} mm, ${tidy(m.rotation_deg)}°).`,
      ),
    );
  }
  if (carried.length > 0) {
    lines.push(line('info', `Shifted when the baskets went in: ${movedText(carried)}.`));
  } else if (pushed.length === 0) {
    lines.push(line('ok', 'Nothing shifted when the baskets went in.'));
  }
  return lines;
}

/** A part of the machine as a check names it, in words: `tub.wall` is "the wall of the tub". */
function partWords(name: string): string {
  if (name === 'door') return 'the door';
  if (name === 'tub') return 'the tub';
  const [body, ...part] = name.split('.');
  if (body === 'tub' && part.length > 0)
    return `the ${part.join(' ').replace(/_/g, ' ')} of the tub`;
  return name;
}

/**
 * An item that reaches out of the envelope of its basket, as a person would say it: how far,
 * over which side, and whether it touches anything outside the basket.
 */
function protrudingText(p: LoadCheck['protruding'][number]): string {
  const by = `${tidy(p.beyond_mm)} mm`;
  const reach =
    p.over === 'top'
      ? `stands ${by} above the height that is clear over ${p.rack}`
      : p.over === 'left' || p.over === 'right'
        ? `leans ${by} out over the ${p.over} side of ${p.rack}`
        : p.over === 'front' || p.over === 'rear'
          ? `reaches ${by} out over the ${p.over} of ${p.rack}`
          : `reaches ${by} out of ${p.rack}`;
  const touching = p.touching ?? [];
  return touching.length > 0
    ? `${p.item_id} ${reach} and rests against ${listOf(touching.map(partWords))}.`
    : `${p.item_id} ${reach} and touches nothing outside the basket.`;
}

/**
 * The name of a basket option as a person reads it on a button row: `tine_row_c_rear` is
 * "tine row C, rear", `shelf_cup_front` "cup shelf, front", `shelf_knife_shelf` "knife shelf".
 * The call behind the button takes the name as the level card gives it.
 */
export function optionLabel(name: string): string {
  const row = /^tine_row_([a-z]+\d*)(?:_(.+))?$/.exec(name);
  if (row !== null) {
    const which = (row[1] as string).toUpperCase();
    return `tine row ${which}${row[2] === undefined ? '' : `, ${row[2].replaceAll('_', ' ')}`}`;
  }
  const shelf = /^shelf_(.+)$/.exec(name);
  if (shelf !== null) {
    const rest = shelf[1] as string;
    if (rest.endsWith('_shelf')) return rest.replaceAll('_', ' ');
    const [kind, ...where] = rest.split('_');
    return `${kind} shelf${where.length === 0 ? '' : `, ${where.join(' ')}`}`;
  }
  return name.replaceAll('_', ' ');
}

/** A value of a basket option as a person reads it: `front_centre` is "front centre". */
export function optionValueLabel(value: string): string {
  return value.replaceAll('_', ' ');
}

/** The budgets as short texts and how full each is (0 to 1). */
export function describeBudget(budget: BudgetState): {
  readonly label: string;
  readonly text: string;
  readonly fraction: number;
}[] {
  const entry = (label: string, used: number, max: number) => ({
    label,
    text: `${used} / ${max}`,
    fraction: max > 0 ? Math.min(1, used / max) : 1,
  });
  return [
    entry('Actions', budget.actions_used, budget.actions_max),
    entry('Queries', budget.queries_used, budget.queries_max),
    entry('Washes', budget.washes_used, budget.washes_max),
  ];
}

/**
 * The difficulty of a level as the list of levels words it: a number as "difficulty 2", a word
 * as it is; null when the level carries none.
 */
export function difficultyText(difficulty: number | string | undefined | null): string | null {
  if (typeof difficulty === 'number' && Number.isFinite(difficulty)) {
    return `difficulty ${Math.round(difficulty * 10) / 10}`;
  }
  if (typeof difficulty === 'string' && difficulty.trim() !== '') return difficulty.trim();
  return null;
}

/**
 * A length of time as a person says it, for what is only an estimate: "under a minute",
 * "about a minute", "about 4 minutes".
 */
export function aboutDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return 'a while';
  if (seconds < 45) return 'under a minute';
  if (seconds < 90) return 'about a minute';
  return `about ${Math.round(seconds / 60)} minutes`;
}

/**
 * The expected time of a wash as the page says it. An estimate from washes this machine has
 * run is given in minutes; one from the built-in figures of another machine is not good to
 * the minute (a shared laptop ran the full wash four times slower than they say), so it is
 * given in words only.
 */
export function washTimeText(option: {
  readonly tier: string;
  readonly seconds: number;
  readonly basis?: string;
}): string {
  if (option.basis === 'history') return aboutDuration(option.seconds);
  return option.tier === 'official'
    ? 'several minutes; not yet timed on this machine'
    : 'a minute or so';
}

/** `2:25:00` or `4:05`. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (x: number): string => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** A phase id as a title: `main_wash` becomes `Main wash`. */
export function phaseTitle(name: string): string {
  const words = name.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
