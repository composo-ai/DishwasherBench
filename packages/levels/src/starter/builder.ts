/**
 * Authoring helpers for the hand-written starter levels. They only assemble plain level data:
 * ids are numbered, and the amount of a soil, when the author does not state it, is the
 * catalogue's typical loading of that soil times the area it covers on the item.
 */

import type { SoilHeatHistory } from '@spotless/catalogue';
import { getSoil, instantiate } from '@spotless/catalogue';
import { PRIMARY_MACHINE } from '@spotless/machine';
import { GAME_PROGRAMME_ID } from '../programmes.ts';
import type { Level, LevelItem, LevelRules, LevelSoil } from '../types.ts';

/** A soil before it is attached to an item type: `soil(...)` returns one. */
export interface SoilDraft {
  readonly type: string;
  /** Region id to coverage. */
  readonly regions: Readonly<Record<string, number>>;
  readonly ageH: number;
  readonly heatHistory?: SoilHeatHistory;
  readonly description?: string;
  readonly amountG?: number;
  /**
   * Thickness of the layer against the soil's working loading, when no amount is stated:
   * 0.5 for a thin film, 2 for a thick one. The amount stays inside the range of the soil's
   * data. Default 1.
   */
  readonly relative?: number;
}

/**
 * A soil of a starter level: catalogue soil id, the regions it covers with the covered fraction
 * of each, hours since the meal, how it was heated (default: the soil's usual history) and how
 * the card describes it.
 */
export function soil(
  type: string,
  regions: Readonly<Record<string, number>>,
  ageH: number,
  description: string,
  heatHistory?: SoilHeatHistory,
  amountG?: number,
): SoilDraft {
  return {
    type,
    regions,
    ageH,
    description,
    ...(heatHistory === undefined ? {} : { heatHistory }),
    ...(amountG === undefined ? {} : { amountG }),
  };
}

/** Area of an item type a soil covers, m^2: the named regions times the covered share of each. */
export function coveredAreaM2(itemType: string, regions: Readonly<Record<string, number>>): number {
  const areas = instantiate(itemType).regionAreas;
  let area = 0;
  for (const region of Object.keys(regions).sort()) {
    area += (areas[region] ?? 0) * (regions[region] ?? 0);
  }
  return area;
}

/** A positive number to three significant figures (0.001876 -> 0.00188). */
export function threeFigures(x: number): number {
  return x > 0 ? Number(x.toPrecision(3)) : 0;
}

/**
 * Grams of a soil on an item type: the soil's working loading (`SoilType.working`,
 * docs/calibration/soil-quantities.md) times the area it covers, to three significant
 * figures. `relative` scales it inside the range the soil's data allow (a thick or a thin
 * layer); the result never leaves that range.
 *
 * Until 2026-10-10 the amount was rounded to 0.01 g with a floor of 0.01 g, which put nine
 * times a working film of coffee into a mug and 68 times one onto a teaspoon.
 */
export function typicalAmountG(itemType: string, draft: SoilDraft, relative = 1): number {
  const working = getSoil(draft.type).working;
  const area = coveredAreaM2(itemType, draft.regions);
  const loading = Math.min(
    working.rangeGPerM2[1],
    Math.max(working.rangeGPerM2[0], working.gPerM2 * relative),
  );
  return threeFigures(loading * area);
}

/** How a soil has usually been heated when it reaches the machine (`SoilType.working`). */
export function usualHeatHistory(soilType: string): SoilHeatHistory {
  return getSoil(soilType).working.heatHistory;
}

/** The same soil in a thinner or thicker layer: `relative` times the working loading. */
export function layer(draft: SoilDraft, relative: number): SoilDraft {
  return { ...draft, relative };
}

function finishSoil(itemType: string, draft: SoilDraft): LevelSoil {
  return {
    type: draft.type,
    regions: Object.keys(draft.regions).map((region) => ({
      region,
      coverage: draft.regions[region] as number,
    })),
    amountG: draft.amountG ?? typicalAmountG(itemType, draft, draft.relative ?? 1),
    ageH: draft.ageH,
    heatHistory: draft.heatHistory ?? getSoil(draft.type).working.heatHistory,
    ...(draft.description === undefined ? {} : { description: draft.description }),
  };
}

/**
 * `count` items of one type with the same soils, numbered `<prefix>_01`, `<prefix>_02`, ...
 * (a single item is called `<prefix>_01` too, so ids keep one pattern).
 */
export function items(
  prefix: string,
  count: number,
  itemType: string,
  points: number,
  soils: readonly SoilDraft[],
): LevelItem[] {
  const out: LevelItem[] = [];
  for (let i = 1; i <= count; i++) {
    out.push({
      id: `${prefix}_${String(i).padStart(2, '0')}`,
      itemType,
      points,
      soils: soils.map((draft) => finishSoil(itemType, draft)),
    });
  }
  return out;
}

/**
 * How the game is played, shown with every starter level. It describes the interface only:
 * nothing in it says where an item washes well.
 */
export const INTERFACE_MANUAL = [
  "Frames. All frames are right-handed with z up. In the tub frame the origin is on the lower spray-arm axis at the tub floor, +x is to the right as you face the open machine and +y towards the back. Each basket has its own frame with the origin at its front-left corner on top of its base grid; the cutlery basket has one too. A position is that of the item's reference point (the centre of its bounding box), in millimetres.",
  'Baskets. A basket can be loaded only while it is pulled out (set_rack with option position); pushed in, it is closed to place. The upper basket, when pulled out, hangs over the lower one, so push it in before reaching the lower basket from above. Items travel with their basket and may shift when it moves.',
  'Placing. place puts an item at a pose: the pose must not overlap anything, and the item must be able to reach it straight down from above (mode drop), or along insert_dir pushed with a limited force (mode insert, which can nudge neighbours aside). The item is lowered until it touches, let go, and then does whatever gravity and friction make it do. Orientation is a preset of the item plus yaw, pitch and roll in whole degrees, or a quaternion. remove takes an item out again; what leaned on it may fall. An item that ends on the kitchen floor goes back to the counter at once (the action is still charged); one that ends on the open door stays there, and is left out of the wash if it is still neither in a basket nor inside the tub when the cycle starts.',
  'Looking. list_slots with an item_id gives the places suggested for that item in a basket, most useful first and a screenful at a time: for each place the position and orientation in which a hand seats the item there (a plate or a lid with its lower edge between two tines, laid back the way they lean; a piece of cutlery let down by its lower end into a cell of the cutlery basket; a piece that leans on a rest or stands on a shelf, where the basket has one for it) and whether the place is free now. Without an item_id it gives the basket as geometry: its rows of tines and its slots, cells, rests and shelves. A piece that has no places of its own goes wherever a pose is free. preview tests a pose without placing and costs no query, get_state gives every settled pose and contact, check_load pushes the baskets in, turns the spray arms by hand and tests the door and the detergent dispenser. None of these says anything about how well an item will wash.',
  'Washing. start_cycle pushes the baskets in and washes what is loaded on the programme the level card names. Rejected calls cost nothing.',
].join('\n\n');

/**
 * Fewest state-changing actions a starter level allows: the provisional figure of
 * `docs/research/benchmark.md` section 4.4 for the time before human medians exist ("about 30
 * placed items x 3 state changes each (place, remove, place again) is 90; a factor of 4 to 5 on
 * top"). [ESTIMATED] there.
 */
export const STARTER_ACTIONS_MIN = 400;

/**
 * Actions a starter level allows per item on offer, where that is more than the floor: the
 * dossier's arithmetic (3 state changes per placed item, a factor of 4 to 5 on top: about 13
 * per placed item) for a level of which about six tenths fits. [ESTIMATED]. Until 2026-10-10
 * the rule was 4 per item with a floor of 60: a level of 57 items allowed 228 actions, which
 * the careful scripted loader used up before it had tried every item (it tries a pot in several
 * places and takes it out again where it does not rest properly: 2.3 to 4.8 accepted places per
 * item it keeps), and which left the careless one, which makes its mistakes on the finished
 * careful load, none to make them with.
 */
export const STARTER_ACTIONS_PER_ITEM = 8;

/** Budgets of a starter level: see {@link STARTER_ACTIONS_MIN}, {@link STARTER_ACTIONS_PER_ITEM}. */
export function starterRules(itemCount: number): LevelRules {
  return {
    track: 'one_shot',
    actionsMax: Math.max(STARTER_ACTIONS_MIN, STARTER_ACTIONS_PER_ITEM * itemCount),
    queriesMax: Math.max(300, 15 * itemCount),
    washesMax: 1,
    mechanicalChecks: true,
  };
}

/**
 * A starter level on the owner's machine in its default set-up, scored on Eco 50 and offering
 * no other programme (`programmes.ts`). `newHere` is what the level adds to the course
 * (`Level.newHere`); it is also the last sentence of the summary a player reads.
 */
export function starterLevel(
  id: string,
  title: string,
  summary: string,
  seed: number,
  groups: readonly (readonly LevelItem[])[],
  newHere?: string,
): Level {
  const all = groups.flat();
  return {
    id,
    title,
    summary: newHere === undefined ? summary : `${summary} ${newHere}`,
    machineId: PRIMARY_MACHINE.id,
    config: null,
    racks: {},
    programmeId: GAME_PROGRAMME_ID,
    items: all,
    rules: starterRules(all.length),
    seed,
    manual: INTERFACE_MANUAL,
    ...(newHere === undefined ? {} : { newHere }),
  };
}
