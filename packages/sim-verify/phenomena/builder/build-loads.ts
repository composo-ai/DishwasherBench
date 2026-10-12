/**
 * Builds the settled loads of the phenomena suite by real loading physics.
 *
 *   pnpm --filter @spotless/sim-verify exec tsx phenomena/builder/build-loads.ts [name ...] [--force] [--list]
 *
 * Every recipe of `recipes.ts` is played through a session of `@spotless/session` on the
 * owner's machine (a level of clean items; the soils are put on by the scenarios), with the
 * moves of the scripted loader (`list_slots` suggestions, drops from above, nesting). The
 * baskets are then pushed in and the door is closed on the load by `start_cycle`, and what is
 * saved under `../loads/<name>.json` is what the session hands the wash: every item with its
 * settled pose in the tub frame (SI, item frame to tub frame), and the mechanical check (an
 * arm the load stops and at which angle, a blocked dispenser).
 *
 * A file carries the hash of its recipe; a load whose file is up to date is skipped unless
 * `--force` is given. Building is deterministic: the same recipe gives the same file.
 *
 * This script lives outside `src/` and imports the session and the loader by path, because
 * `@spotless/sim-verify` may depend on the simulation packages and the platform packages
 * below them only (docs/design/sim-core.md section 4): the suite itself reads the saved loads
 * as data, as `scripts/demo-washes.ts` does with the loader's loads.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalHash, quatRotate, type Vec3 } from '../../../core/src/index.ts';
import { PRIMARY_MACHINE } from '../../../machine/src/index.ts';
import {
  Player,
  dropAt,
  dropHeights,
  lanesOf,
  rememberSeat,
  seatOnEdge,
  viewOf,
  wireQuat,
  type ItemView,
  type SeatMemory,
} from '../../../loader/src/index.ts';
import {
  createSession,
  type DropAccepted,
  type DropResult,
  type GameSession,
  type LoadCheck,
  type Orientation,
  type SlotCard,
} from '../../../session/src/index.ts';
import { RECIPES, type Recipe, type RecipeRack, type RecipeStep } from './recipes.ts';

/** Format of a saved load; raise it when the file changes shape. */
const FORMAT = 'spotless-phenomena-load-1';

/** One item of a saved load. */
interface SavedItem {
  readonly item_id: string;
  readonly item_type: string;
  /** Item frame to tub frame after the baskets were pushed in: `p` metres, `q` as [x, y, z, w]. */
  readonly pose: { readonly p: readonly number[]; readonly q: readonly number[] };
  /** How it was placed and what the session said of it. */
  readonly placed: {
    readonly op: string;
    readonly attempt: number;
    readonly stable: boolean;
    readonly displacement_mm: number;
    readonly rotation_deg: number;
    readonly contacts: readonly string[];
  };
}

/** A saved load: what the suite reads. */
interface SavedLoad {
  readonly format: string;
  readonly name: string;
  readonly description: string;
  readonly recipe_hash: string;
  readonly machine_id: string;
  readonly machine_config: unknown;
  readonly items: readonly SavedItem[];
  readonly check: LoadCheck;
  /** Items of the recipe that could not be placed, each with the reason. */
  readonly failed: readonly { readonly item_id: string; readonly reason: string }[];
  readonly notes: readonly string[];
  readonly state_hash: string;
}

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'loads');

function levelOf(recipe: Recipe) {
  return {
    id: `phenomena-${recipe.name}`,
    title: recipe.name,
    summary: recipe.description,
    machineId: PRIMARY_MACHINE.id,
    config: null,
    racks: {},
    programmeId: PRIMARY_MACHINE.primaryProgramme,
    items: recipe.items.map((item) => ({ id: item.id, itemType: item.type, points: 1, soils: [] })),
    rules: {
      track: 'one_shot' as const,
      actionsMax: 5000,
      queriesMax: 100000,
      washesMax: 1,
      mechanicalChecks: true,
      exactPlacement: true,
    },
    seed: 1,
    manual: null,
  };
}

/**
 * How far from the centre of its slot the reference point of an item on edge may come to rest,
 * mm: a leaning plate's centre is up to 30 mm off the foot of its slot. [ESTIMATED]
 */
const SEAT_REACH = 45;
/** A placement that moves another item further than this has shoved it out of its seat, mm. */
const SHOVE_LIMIT = 15;

/** What a judged placement is refused for, or null when it is kept. */
type Judge = (result: DropAccepted) => string | null;

class Builder {
  readonly notes: string[] = [];
  readonly failed: { item_id: string; reason: string }[] = [];
  readonly placed = new Map<string, SavedItem['placed']>();
  private readonly views = new Map<string, ItemView>();
  private readonly memory: SeatMemory = new Map();

  constructor(
    private readonly session: GameSession,
    private readonly player: Player,
  ) {}

  private view(itemId: string): ItemView {
    let view = this.views.get(itemId);
    if (view === undefined) {
      view = viewOf(this.player.item(itemId));
      this.views.set(itemId, view);
    }
    return view;
  }

  /** Pulls out the basket a step places in and pushes the other one in. */
  private open(rack: RecipeRack): void {
    const basket = rack === 'cutlery_basket' ? 'lower_rack' : rack;
    const other = basket === 'lower_rack' ? 'upper_rack' : 'lower_rack';
    if (!this.player.moveRack(other, 'in')) this.notes.push(`${other} could not be pushed in`);
    if (!this.player.moveRack(basket, 'out')) this.notes.push(`${basket} could not be pulled out`);
  }

  /** Tries the attempts in order and keeps the first the judge accepts. */
  private settle(
    itemId: string,
    op: string,
    attempts: readonly (() => DropResult)[],
    judge: Judge,
  ): boolean {
    let last = 'no attempt was accepted';
    for (let i = 0; i < attempts.length; i++) {
      const result = (attempts[i] as () => DropResult)();
      if (!result.accepted) {
        last = `rejected: ${result.reason}${result.detail === undefined ? '' : ` (${result.detail})`}`;
        continue;
      }
      let refused: string | null = null;
      if (result.fell_through || result.fell_out || result.returned.includes(itemId)) {
        refused = 'it fell out of the basket';
      } else refused = judge(result);
      if (refused === null) {
        this.placed.set(itemId, {
          op,
          attempt: i + 1,
          stable: result.stable,
          displacement_mm: Math.round(result.displacement_mm * 10) / 10,
          rotation_deg: Math.round(result.rotation_deg * 10) / 10,
          contacts: result.contacts.map((c) => c.with),
        });
        return true;
      }
      last = refused;
      if (!result.returned.includes(itemId)) this.player.remove(itemId);
    }
    this.failed.push({ item_id: itemId, reason: last });
    return false;
  }

  private touches(result: DropAccepted, other: string | undefined): boolean {
    return other === undefined || result.contacts.some((c) => c.with === other);
  }

  step(step: RecipeStep): void {
    if (step.op === 'option') {
      const rack = step.rack === 'cutlery_basket' ? 'lower_rack' : step.rack;
      const result = this.player.setRack(rack, step.name, step.value);
      if (!result.accepted)
        this.notes.push(`option ${step.name}=${step.value} refused: ${result.reason}`);
      return;
    }
    if (step.op === 'slot') {
      this.open(step.rack);
      const view = this.view(step.item);
      const card: SlotCard | undefined = this.player
        .slots(step.rack)
        .slots.find((s) => s.id === step.slot);
      if (card === undefined) {
        this.failed.push({ item_id: step.item, reason: `the basket has no slot ${step.slot}` });
        return;
      }
      const row = card.tine_row ?? '';
      const lane = lanesOf(this.player, step.rack).find((l) => l.id.split('+').includes(row));
      const railAxis = lane?.railAxis ?? (Math.abs(card.plate_normal?.[0] ?? 1) >= 0.5 ? 0 : 1);
      const judge: Judge = (result) => {
        const axis = quatRotate(wireQuat(result.settled_pose), [0, 0, 1]);
        if (Math.abs(axis[2]) > 0.7) return 'it fell flat';
        if (!result.stable) return 'it did not come to a stable rest';
        // It must stand where it was sent: near its slot along the row, on the rails of its lane.
        const at = result.settled_pose.position_mm;
        if (Math.abs(at[railAxis] - card.centre_mm[railAxis]) > SEAT_REACH) {
          return 'it came to rest away from its slot';
        }
        if (lane !== undefined && Math.abs(at[lane.acrossAxis] - lane.centreAcross) > SEAT_REACH) {
          return 'it came to rest off the rails of its lane';
        }
        if (result.moved_items.some((m) => m.displacement_mm > SHOVE_LIMIT)) {
          return 'it shoved its neighbours';
        }
        return this.touches(result, step.touching) ? null : 'it found a seat of its own';
      };
      const op =
        step.reversed === true
          ? 'slot (reversed)'
          : step.shift === undefined
            ? 'slot'
            : 'slot (crowded)';
      // First the loader's own move: the item is slid in along the tines to a pose found by
      // asking the session, and let go a few millimetres above the rails.
      if (lane !== undefined && view.edgePreset !== null) {
        const along = card.centre_mm[lane.railAxis];
        let laneSlot = lane.slots[0];
        for (const candidate of lane.slots) {
          if (
            laneSlot === undefined ||
            Math.abs(candidate.along - along) < Math.abs(laneSlot.along - along)
          ) {
            laneSlot = candidate;
          }
        }
        const natural: -1 | 1 = (card.plate_normal?.[lane.railAxis] ?? 1) >= 0 ? 1 : -1;
        const face: -1 | 1 = step.reversed === true ? (natural === 1 ? -1 : 1) : natural;
        if (laneSlot !== undefined) {
          const slot = laneSlot;
          const seats: (() => DropResult)[] = (step.shift ?? [0]).map((shift) => () => {
            const seat = seatOnEdge(
              this.player,
              view,
              { lane, slot, face, ...(shift === 0 ? {} : { shift, leanFrom: 0 }) },
              this.memory,
            );
            if (seat === null) return { accepted: false, reason: 'collision_at_pose' };
            if (judge(seat.result) === null && shift === 0) rememberSeat(this.memory, seat);
            return seat.result;
          });
          const before = this.failed.length;
          if (this.settle(step.item, op, seats, judge)) return;
          this.failed.length = before;
        }
      }
      // Otherwise the drop that `list_slots` suggests for the item.
      const drop = this.player
        .slotsFor(step.rack, step.item)
        .find((s) => s.id === step.slot)?.suggested_drop;
      if (drop === undefined) {
        this.failed.push({ item_id: step.item, reason: `no way into slot ${step.slot} was found` });
        return;
      }
      const alongX = Math.abs(card.plate_normal?.[0] ?? 1) >= Math.abs(card.plate_normal?.[1] ?? 0);
      const orientation: Orientation =
        step.reversed === true
          ? {
              preset: drop.orientation.preset,
              roll_deg: drop.orientation.roll_deg ?? 0,
              yaw_deg: (drop.orientation.yaw_deg ?? 0) + 180,
            }
          : drop.orientation;
      const shifts = step.shift ?? [0, 6, -6, 12, -12];
      this.settle(
        step.item,
        `${op}, dropped`,
        shifts.map(
          (shift) => () =>
            this.player.place({
              item_id: step.item,
              frame: step.rack,
              position_mm: [
                drop.position_mm[0] + (alongX ? shift : 0),
                drop.position_mm[1] + (alongX ? 0 : shift),
                drop.position_mm[2],
              ],
              orientation,
            }),
        ),
        judge,
      );
      return;
    }
    if (step.op === 'drop') {
      this.open(step.rack);
      const view = this.view(step.item);
      const half = Math.max(view.size[0], view.size[1], view.size[2]) / 2;
      const attempts: (() => DropResult)[] = [];
      for (const [x, y] of step.at) {
        const heights = step.z ?? dropHeights(this.player, step.rack, y, half + 2, half);
        attempts.push(() =>
          dropAt(this.player, step.item, step.rack, x, y, step.orientation, heights),
        );
      }
      const spots = step.at;
      let tried = -1;
      const counted = attempts.map((attempt, i) => () => {
        tried = i;
        return attempt();
      });
      this.settle(step.item, 'drop', counted, (result) => {
        if (!result.stable && step.allowUnstable !== true)
          return 'it did not come to a stable rest';
        if (result.rotation_deg > (step.maxTurn ?? 45)) return 'it toppled';
        if (step.within !== undefined) {
          const spot = spots[tried] ?? [0, 0];
          const at = result.settled_pose.position_mm;
          if (Math.hypot(at[0] - spot[0], at[1] - spot[1]) > step.within)
            return 'it slid away from the spot';
        }
        if (!this.touches(result, step.touching)) return `it does not touch ${step.touching}`;
        if (step.clearOfArms === true) {
          const check = this.session.checkLoad();
          if (!check.accepted || check.spray_arms.some((a) => !a.full_rotation))
            return 'it stops a spray arm';
        }
        if (step.mustStop !== undefined) {
          const check = this.session.checkLoad();
          if (!check.accepted) return 'the load could not be checked';
          const arm = check.spray_arms.find((a) => a.arm === step.mustStop);
          if (arm === undefined || arm.full_rotation || arm.blocked_by !== step.item) {
            return `it does not stop the ${step.mustStop}`;
          }
        }
        return null;
      });
      return;
    }
    if (step.op === 'nest') {
      const at = this.player.placed(step.into);
      if (at === undefined) {
        this.failed.push({ item_id: step.item, reason: `${step.into} is not in the machine` });
        return;
      }
      this.open(at.frame as RecipeRack);
      const axis = quatRotate(wireQuat(at), [0, 0, 1]);
      const out: Vec3 = [-axis[0], -axis[1], -axis[2]];
      const view = this.view(step.item);
      const lift = Math.max(12, view.size[2] * 0.35);
      const [x, y, z] = at.position_mm;
      this.settle(
        step.item,
        'nest',
        [10, 18, 28, 40].map(
          (more) => () =>
            this.player.place({
              item_id: step.item,
              frame: at.frame,
              position_mm: [
                x + out[0] * (lift + more),
                y + out[1] * (lift + more),
                z + Math.max(out[2], 0.2) * (lift + more) + more,
              ],
              orientation: { quat_wxyz: at.quat_wxyz },
            }),
        ),
        (result) => (this.touches(result, step.into) ? null : 'it slid off the item below'),
      );
      return;
    }
    // nest_spoon
    const at = this.player.placed(step.into);
    if (at === undefined) {
      this.failed.push({ item_id: step.item, reason: `${step.into} is not in the machine` });
      return;
    }
    this.open('cutlery_basket');
    const face = quatRotate(wireQuat(at), [0, 0, 1]);
    const view = this.view(step.item);
    const heights = dropHeights(this.player, 'cutlery_basket', 0, view.longest / 2, 0);
    this.settle(
      step.item,
      'nest_spoon',
      [25, 40, 60].flatMap((up) =>
        [4, 6, 9, -4, -6, -9, 12, -12].map(
          (off) => () =>
            this.player.place({
              item_id: step.item,
              frame: 'cutlery_basket',
              position_mm: [
                at.position_mm[0] + face[0] * off,
                at.position_mm[1] + face[1] * off,
                Math.max(at.position_mm[2] + up, (heights[0] ?? 200) - 60),
              ],
              orientation: { quat_wxyz: at.quat_wxyz },
            }),
        ),
      ),
      (result) => (this.touches(result, step.into) ? null : 'it does not lie in the other spoon'),
    );
  }
}

async function build(recipe: Recipe): Promise<SavedLoad> {
  const session = await createSession({ level: levelOf(recipe) });
  try {
    const player = new Player(session);
    const builder = new Builder(session, player);
    for (const step of recipe.steps) builder.step(step);
    player.moveRack('lower_rack', 'in');
    player.moveRack('upper_rack', 'in');
    const started = session.startCycle();
    if (!started.accepted) {
      throw new Error(`${recipe.name}: start_cycle refused: ${started.reason}`);
    }
    await session.washSettled();
    const manifest = session.washManifest();
    if (manifest === null) throw new Error(`${recipe.name}: no wash manifest`);
    for (const id of started.left_out)
      builder.failed.push({ item_id: id, reason: 'it was not in a basket when the door closed' });
    const items: SavedItem[] = manifest.items.map((item) => ({
      item_id: item.item_id,
      item_type: item.item_type,
      pose: { p: [...item.pose.p], q: [...item.pose.q] },
      placed: builder.placed.get(item.item_id) ?? {
        op: 'unknown',
        attempt: 0,
        stable: false,
        displacement_mm: 0,
        rotation_deg: 0,
        contacts: [],
      },
    }));
    const settledState = session.peekState();
    const notes = [...builder.notes];
    for (const item of settledState.placed) {
      if (!item.stable) notes.push(`${item.item_id} rests but the stability probe flags it`);
    }
    for (const moved of started.prechecks.shifted) {
      notes.push(
        `${moved.item_id} shifted ${moved.displacement_mm.toFixed(1)} mm and ${moved.rotation_deg.toFixed(1)} degrees as the baskets went in`,
      );
    }
    return {
      format: FORMAT,
      name: recipe.name,
      description: recipe.description,
      recipe_hash: canonicalHash(recipe),
      machine_id: manifest.machine_id,
      machine_config: manifest.machine_config,
      items,
      check: started.prechecks,
      failed: builder.failed,
      notes,
      state_hash: started.state_hash,
    };
  } finally {
    session.dispose();
  }
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const names = args.filter((a) => !a.startsWith('--'));
if (args.includes('--list')) {
  for (const recipe of RECIPES) console.log(`${recipe.name}: ${recipe.description}`);
  process.exit(0);
}
mkdirSync(outDir, { recursive: true });
let bad = 0;
for (const recipe of RECIPES) {
  if (names.length > 0 && !names.includes(recipe.name)) continue;
  const file = join(outDir, `${recipe.name}.json`);
  if (!force) {
    try {
      const saved = JSON.parse(readFileSync(file, 'utf8')) as SavedLoad;
      if (saved.format === FORMAT && saved.recipe_hash === canonicalHash(recipe)) {
        console.log(`${recipe.name}: up to date`);
        continue;
      }
    } catch {
      // Not built yet.
    }
  }
  const started = performance.now();
  try {
    const load = await build(recipe);
    writeFileSync(file, `${JSON.stringify(load, null, 1)}\n`);
    const arms = load.check.spray_arms
      .filter((a) => !a.full_rotation)
      .map((a) => `${a.arm} stopped by ${a.blocked_by} at ${a.first_contact_angle_deg} deg`);
    console.log(
      `${recipe.name}: ${load.items.length} of ${recipe.items.length} items in ${((performance.now() - started) / 1000).toFixed(1)} s` +
        (load.failed.length > 0
          ? `; FAILED ${load.failed.map((f) => `${f.item_id} (${f.reason})`).join(', ')}`
          : '') +
        (arms.length > 0 ? `; ${arms.join('; ')}` : '') +
        (load.notes.length > 0 ? `; notes: ${load.notes.join('; ')}` : ''),
    );
    if (load.failed.length > 0) bad += 1;
  } catch (error) {
    bad += 1;
    console.log(`${recipe.name}: ERROR ${error instanceof Error ? error.message : String(error)}`);
  }
}
process.exit(bad > 0 ? 1 : 0);
