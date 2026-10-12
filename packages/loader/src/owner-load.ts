/**
 * The owner's own load of 2026-10-10, placed by hand through the session: a fixed list of moves
 * that reproduces his photograph of the loaded lower basket as closely as the catalogue allows
 * (docs/reference/owner-photos/2026-10-10-lower-basket-loaded-by-owner.jpg; the level and what
 * stands in for his ware are in `standard-levels.ts`, `ownerLoadLevel` and
 * `OWNER_LOAD_STAND_INS`).
 *
 * What the photograph shows and what is done here, in the order of the moves:
 *  - the cutlery basket at the front right: `set_rack cutlery_basket position front_right`;
 *  - a dark baking tray on its long edge at the left wall, face to the middle;
 *  - two wide-rimmed plates on edge in the hinged rear rows, the left one in the third gap from
 *    the left (the machine engineer's reading), the right one near the right end, each seated
 *    where `list_slots` says and left to lean with the tines of its half of the row;
 *  - a thin brown board on its long edge across the back, a white one at the right wall beside
 *    the cutlery basket;
 *  - in the middle the deep pieces leaning on one another: a pasta bowl on edge beside the left
 *    plate, the frying pan lying tilted against the right-hand plate with its handle to the
 *    front, a second pasta bowl and the serving bowl on edge at the front left, the cereal bowl
 *    tilted in front of them;
 *  - forks, knives and spoons heads up in the cutlery basket with the tongs and a small tool;
 *  - in the upper basket, of which only the front can be seen: a mug, two glasses and two
 *    plastic containers mouth down.
 *
 * Each move is a list of poses to try in order: the first the session accepts is used (the
 * photograph fixes where a piece is to within a few centimetres, not to the millimetre, and a
 * pose a few millimetres off may overlap a wire). Nothing here looks inside the session. What
 * each piece did (how far it moved from where it was let go, what it rests against, whether it
 * stayed through the push of the baskets) is returned as notes: this load exists to show how
 * real loading behaves in the model, items resting on items included.
 *
 * Deterministic: the same level gives the same action log.
 */

import type {
  DropAccepted,
  LoadCheck,
  Orientation,
  PlaceRequest,
  Session,
  SlotCard,
} from '@spotless/session';
import type { LeftOut } from './loading.ts';
import { Player, angleDeg, axisAt } from './player.ts';
import type { PolicyResult } from './policy.ts';
import { resultOf } from './policy.ts';

/** One pose of a piece: frame position in millimetres and an orientation. */
type Pose = readonly [
  frame: 'lower_rack' | 'upper_rack' | 'cutlery_basket',
  x: number,
  y: number,
  z: number,
  orientation: Orientation,
];

/** A piece placed by pose: the poses to try, in order. */
interface ByPose {
  readonly kind: 'pose';
  readonly item: string;
  /** What the photograph shows for it. */
  readonly seen: string;
  readonly poses: readonly Pose[];
}

/** A piece seated in a slot between tines where `list_slots` suggests. */
interface BySlot {
  readonly kind: 'slot';
  readonly item: string;
  readonly seen: string;
  /** Slot ids to try, in order. */
  readonly slots: readonly string[];
}

/** A piece of cutlery let down into a cell of the cutlery basket where `list_slots` suggests. */
interface ByCell {
  readonly kind: 'cell';
  readonly item: string;
  readonly cells: readonly string[];
}

/**
 * A cup, mug or glass set mouth down on a sloped rest along a side wall, leaning towards the
 * wall, where `list_slots` suggests across the rest, at the place `y` along it (millimetres).
 */
interface ByRest {
  readonly kind: 'rest';
  readonly item: string;
  readonly seen: string;
  /** The slot id of the rest, for example `'rest_right'`. */
  readonly rest: string;
  /** Places along the rest to try, in order. */
  readonly ys: readonly number[];
}

type Move = ByPose | BySlot | ByCell | ByRest;

const edge = (yaw: number, roll: number, preset = 'on_long_edge'): Orientation => ({
  preset,
  yaw_deg: yaw,
  roll_deg: roll,
});

/** The moves of the lower basket, in the order a hand makes them. */
const LOWER: readonly Move[] = [
  {
    kind: 'pose',
    item: 'baking_tray_01',
    seen: 'on its long edge against the left wall, its inside to the middle',
    // Long edge along y, the inside to +x: the tips of the outermost tines stand in its hollow.
    poses: [
      ['lower_rack', 36, 256, 182, edge(90, 0)],
      ['lower_rack', 38, 256, 184, edge(90, 0)],
      ['lower_rack', 34, 256, 186, edge(90, -4)],
    ],
  },
  {
    kind: 'slot',
    item: 'plate_01',
    seen: 'on edge in the third gap of the rear rows from the left, leaning 3 degrees outwards',
    // The second gap, not the third: the catalogue's board, which stands between the two
    // plates, is 340 mm long and leaves the left plate no room in the third.
    slots: ['tine_row_r1.slot_01', 'tine_row_r1.slot_00', 'tine_row_r1.slot_02'],
  },
  {
    kind: 'slot',
    item: 'plate_02',
    seen: 'on edge near the right end of the rear rows, leaning outwards',
    slots: ['tine_row_r1.slot_21', 'tine_row_r1.slot_20'],
  },
  {
    kind: 'pose',
    item: 'board_brown_01',
    seen: 'on its long edge across the back, between the two plates',
    // Long edge along x, face to the front, the top laid back to the rear wall.
    poses: [
      ['lower_rack', 272, 482, 124, edge(0, -6)],
      ['lower_rack', 274, 476, 124, edge(0, -6)],
      ['lower_rack', 272, 488, 124, edge(0, 0)],
    ],
  },
  {
    kind: 'pose',
    item: 'board_white_01',
    seen: 'on its long edge against the right wall, beside the cutlery basket',
    // Long edge along y, face to -x, the top laid to the wall.
    poses: [
      ['lower_rack', 508, 240, 146, edge(-90, -4)],
      ['lower_rack', 506, 240, 146, edge(-90, -4)],
      ['lower_rack', 508, 260, 146, edge(-90, 0)],
    ],
  },
  {
    kind: 'pose',
    item: 'frying_pan_01',
    seen: 'lying tilted against the right-hand plate, its inside up and to the left, handle to the front',
    // The handle to the front (the reference point is the middle of pan and handle together,
    // 108 mm from the middle of the pan), tipped 50 degrees about the handle.
    poses: [
      ['lower_rack', 345, 258, 208, { preset: 'upright', yaw_deg: -95, roll_deg: 50 }],
      ['lower_rack', 340, 260, 210, { preset: 'upright', yaw_deg: -90, roll_deg: 45 }],
      ['lower_rack', 320, 260, 210, { preset: 'upright', yaw_deg: -90, roll_deg: 45 }],
    ],
  },
  {
    kind: 'pose',
    item: 'pasta_bowl_01',
    seen: 'on edge in the middle of the rear rows, leaning on the pan',
    poses: [
      ['lower_rack', 230, 370, 170, { preset: 'on_edge', yaw_deg: 90, roll_deg: 25 }],
      ['lower_rack', 220, 340, 170, { preset: 'on_edge', yaw_deg: 90, roll_deg: 25 }],
    ],
  },
  {
    kind: 'pose',
    item: 'pasta_bowl_02',
    seen: 'on edge to the left of the middle, leaning outwards',
    poses: [
      ['lower_rack', 140, 240, 170, { preset: 'on_edge', yaw_deg: 90, roll_deg: -10 }],
      ['lower_rack', 150, 240, 170, { preset: 'on_edge', yaw_deg: 90, roll_deg: 10 }],
    ],
  },
  {
    kind: 'pose',
    item: 'serving_bowl_01',
    seen: 'on edge at the front left, large, leaning',
    poses: [
      ['lower_rack', 220, 150, 130, { preset: 'on_edge', yaw_deg: 90, roll_deg: -20 }],
      ['lower_rack', 230, 150, 130, { preset: 'on_edge', yaw_deg: 90, roll_deg: -10 }],
      ['lower_rack', 220, 180, 170, { preset: 'on_edge', yaw_deg: 90, roll_deg: -10 }],
    ],
  },
  {
    kind: 'pose',
    item: 'cereal_bowl_01',
    seen: 'tilted in front of the serving bowl, beside the cutlery basket',
    poses: [
      ['lower_rack', 250, 90, 110, { preset: 'on_edge', yaw_deg: 90, roll_deg: -10 }],
      ['lower_rack', 240, 110, 110, { preset: 'on_edge', yaw_deg: 90, roll_deg: -10 }],
      ['lower_rack', 255, 80, 130, { preset: 'on_edge', yaw_deg: 90, roll_deg: 0 }],
      ['lower_rack', 250, 100, 150, { preset: 'on_edge', yaw_deg: 90, roll_deg: 0 }],
    ],
  },
  ...['fork_01', 'fork_02', 'fork_03'].map((item): Move => ({
    kind: 'cell',
    item,
    cells: ['cell_c12', 'cell_c13', 'cell_c11'],
  })),
  ...['fork_04', 'fork_05', 'fork_06'].map((item): Move => ({
    kind: 'cell',
    item,
    cells: ['cell_c13', 'cell_c12', 'cell_c11'],
  })),
  ...['knife_01', 'knife_02', 'knife_03', 'knife_04'].map((item): Move => ({
    kind: 'cell',
    item,
    cells: ['cell_c11', 'cell_c10', 'cell_c12'],
  })),
  ...['spoon_01', 'spoon_02', 'spoon_03', 'spoon_04'].map((item): Move => ({
    kind: 'cell',
    item,
    cells: ['cell_c03', 'cell_c02', 'cell_c13'],
  })),
  ...['teaspoon_01', 'teaspoon_02'].map((item): Move => ({
    kind: 'cell',
    item,
    cells: ['cell_c02', 'cell_c03', 'cell_c01'],
  })),
  { kind: 'cell', item: 'peeler_01', cells: ['cell_c00', 'cell_c01', 'cell_c02'] },
  { kind: 'cell', item: 'tongs_01', cells: ['cell_c01', 'cell_c00', 'cell_c02'] },
];

const down: Orientation = { preset: 'inverted' };

/**
 * The moves of the upper basket: what can be seen of it over the lower one. The floor of the
 * upper basket is ridged and set with tine rows: what is let down mouth down comes to lean on a
 * row, as in the photograph.
 */
const UPPER: readonly Move[] = [
  {
    // The front right of the upper basket is the front end of the rest along its right wall
    // (IMG_9131): the mug stands on it leaning towards the wall, as it leans in the photograph.
    kind: 'rest',
    item: 'mug_01',
    seen: 'a patterned mug at the front right of the upper basket',
    rest: 'rest_right',
    ys: [92, 100, 84],
  },
  {
    // (175 mm from the left: clear of the knife shelf, which reaches 101 mm in from the wall
    // at 149.5 mm above the floor. Until IMG_9131 it was drawn lower and narrower in height,
    // and the containers were let go at 160.)
    kind: 'pose',
    item: 'container_01',
    seen: 'a clear plastic container at the left',
    poses: [
      ['upper_rack', 185, 330, 150, down],
      ['upper_rack', 175, 330, 150, down],
    ],
  },
  {
    kind: 'pose',
    item: 'container_02',
    seen: 'a second container in front of the first',
    poses: [
      ['upper_rack', 175, 150, 150, down],
      ['upper_rack', 180, 160, 150, down],
    ],
  },
  {
    kind: 'pose',
    item: 'glass_01',
    seen: 'a glass to the right of the middle',
    // (Let down beside the tines of row C, on which it comes to lean 20 degrees: scanned on
    // the floor of IMG_9131 from x = 300 to 340. At 345, where it was let go on the floor
    // drawn before, it now meets the tips of those tines and falls over.)
    poses: [
      ['upper_rack', 325, 150, 170, down],
      ['upper_rack', 315, 150, 170, down],
    ],
  },
  {
    kind: 'pose',
    item: 'glass_02',
    seen: 'a second glass behind it',
    poses: [
      ['upper_rack', 305, 330, 170, down],
      ['upper_rack', 300, 320, 170, down],
    ],
  },
];

/** Options of {@link playOwnerLoad}. */
export interface OwnerLoadOptions {
  /** A stopwatch in milliseconds for the measurements; default none. */
  readonly now?: () => number;
  /** Receives one line per move. */
  readonly trace?: (line: string) => void;
}

/** What one piece did, for the notes. */
function describe(item: string, seen: string, drop: DropAccepted): string {
  const tilt = angleDeg(
    axisAt(drop.requested_pose, [0, 0, 1]),
    axisAt(drop.settled_pose, [0, 0, 1]),
  );
  const against = drop.contacts.map((c) => c.with).join(', ');
  return (
    `${item} (in the photograph: ${seen}): let go at ${drop.requested_pose.position_mm.join(', ')} mm, ` +
    `came to rest ${drop.displacement_mm} mm and ${Math.round(tilt)} degrees from there, ` +
    `${drop.stable ? 'stable' : 'not stable'}, on ${against || 'nothing'}`
  );
}

/**
 * Loads the owner's load on a session of `ownerLoadLevel()` that stands at its start, and
 * leaves both baskets pushed in. Returns what a policy returns: what was placed, what was not
 * and why, the action log, and as notes what each piece did.
 */
export function playOwnerLoad(session: Session, options: OwnerLoadOptions = {}): PolicyResult {
  const now = options.now ?? ((): number => 0);
  const started = now();
  const player = new Player(session, now);
  const trace = options.trace ?? ((): void => undefined);
  const notes: string[] = [];
  const leftOut: LeftOut[] = [];
  const letGo = new Map<string, DropAccepted>();

  const attempt = (move: Move, requests: readonly PlaceRequest[]): void => {
    let why = 'no pose was tried';
    for (const request of requests) {
      const result = player.place(request);
      if (result.accepted) {
        letGo.set(move.item, result);
        if (move.kind !== 'cell') notes.push(describe(move.item, move.seen, result));
        trace(
          `${move.item}: at ${request.position_mm.join(',')} -> ${result.settled_pose.position_mm.join(',')}, moved ${result.displacement_mm} mm ${result.rotation_deg} deg, stable ${result.stable}; touches ${result.contacts.map((c) => c.with).join(' ')}; moved others: ${result.moved_items.map((m) => `${m.item_id} ${m.displacement_mm} mm`).join(', ') || 'none'}`,
        );
        return;
      }
      why = `${result.reason}${result.colliding_with === undefined ? '' : ` with ${result.colliding_with.join(', ')}`}${result.blocked_by === undefined ? '' : ` by ${result.blocked_by}`}`;
      trace(`${move.item}: at ${request.position_mm.join(',')} refused: ${why}`);
    }
    leftOut.push({ item_id: move.item, reason: `every pose tried was refused (the last: ${why})` });
  };

  const play = (moves: readonly Move[], rack: 'lower_rack' | 'upper_rack'): void => {
    for (const move of moves) {
      if (!player.items.has(move.item)) continue;
      if (move.kind === 'pose') {
        attempt(
          move,
          move.poses.map(([frame, x, y, z, orientation]) => ({
            item_id: move.item,
            frame,
            position_mm: [x, y, z],
            orientation,
          })),
        );
        continue;
      }
      const frame = move.kind === 'cell' ? 'cutlery_basket' : rack;
      const listed = session.listSlots({ rack: frame, item_id: move.item });
      const slots: readonly SlotCard[] = listed.accepted ? listed.slots : [];
      if (move.kind === 'rest') {
        // Where the item stands across the rest and how it is tilted is `list_slots`'s seat;
        // along the rest it is put where the photograph has it. (A millimetre higher too:
        // the wires that cross the rest are not at the same height everywhere along it.)
        const seat = slots.find((s) => s.id === move.rest)?.suggested_drop;
        const requests: PlaceRequest[] = [];
        for (const y of seat === undefined ? [] : move.ys) {
          for (const lift of [0, 1, 2]) {
            requests.push({
              item_id: move.item,
              frame,
              position_mm: [seat?.position_mm[0] ?? 0, y, (seat?.position_mm[2] ?? 0) + lift],
              orientation: seat?.orientation ?? down,
            });
          }
        }
        attempt(move, requests);
        continue;
      }
      const wanted = move.kind === 'cell' ? move.cells : move.slots;
      const requests: PlaceRequest[] = [];
      for (const id of wanted) {
        const slot = slots.find((s) => s.id === id);
        if (slot?.suggested_drop === undefined || slot.drop_free !== true) continue;
        requests.push({ item_id: move.item, frame, ...slot.suggested_drop });
      }
      attempt(move, requests);
    }
  };

  // The cutlery basket to the front right, where the owner stands it.
  const moved = player.setRack('cutlery_basket', 'position', 'front_right');
  if (!moved.accepted) notes.push('the cutlery basket could not be stood at the front right');
  player.moveRack('lower_rack', 'out');
  play(LOWER, 'lower_rack');
  const beforePush = new Map(player.scene().placed.map((p) => [p.item_id, p]));
  // The lower basket goes in under the upper one. What stops it comes out again, and is
  // said: the owner ran this load, so a piece that does not go in here shows a place where
  // the model of the machine (or the stand-in for the piece) is out.
  for (let round = 0; round < 3; round++) {
    const pushed = player.setRack('lower_rack', 'position', 'in');
    if (pushed.accepted || player.scene().racks.lower_rack === 'in') break;
    const blockers = ('blocked_by' in pushed ? (pushed.blocked_by ?? []) : []).filter((id) =>
      player.isPlaced(id),
    );
    if (blockers.length === 0) break;
    for (const id of blockers) {
      if (!player.remove(id).accepted) continue;
      leftOut.push({
        item_id: id,
        reason:
          'taken out again: where the photograph has it, it stopped the lower basket from sliding in under the upper one',
      });
      notes.push(
        `${id} stopped the lower basket from sliding in under the upper basket and was taken out; in the owner's machine it went in`,
      );
    }
  }
  player.moveRack('upper_rack', 'out');
  play(UPPER, 'upper_rack');
  player.moveRack('upper_rack', 'in');

  // What the push of the baskets did to each piece.
  const after = player.refresh();
  for (const item of after.placed) {
    const was = beforePush.get(item.item_id);
    if (was === undefined || was.frame !== item.frame) continue;
    const shift = Math.hypot(
      item.position_mm[0] - was.position_mm[0],
      item.position_mm[1] - was.position_mm[1],
      item.position_mm[2] - was.position_mm[2],
    );
    const turn = angleDeg(axisAt(was, [0, 0, 1]), axisAt(item, [0, 0, 1]));
    if (shift > 5 || turn > 5) {
      notes.push(
        `${item.item_id} did not stay where it was when the lower basket was pushed in: it moved ${Math.round(shift)} mm and turned ${Math.round(turn)} degrees`,
      );
    }
  }
  for (const item of after.placed) {
    if (!item.stable) notes.push(`${item.item_id} is not stable where it lies`);
  }
  const checked = player.checkLoad();
  const check: LoadCheck | null = checked.accepted ? checked : null;
  const offered = [...player.card.items].map((item) => item.item_id);
  const placed = offered.filter((id) => player.isPlaced(id));
  for (const id of offered) {
    if (!player.isPlaced(id) && !leftOut.some((l) => l.item_id === id)) {
      leftOut.push({
        item_id: id,
        reason: letGo.has(id)
          ? 'it fell out of the machine after it was let go'
          : 'it is not among the moves',
      });
    }
  }
  return resultOf(session, player, {
    policy: 'careful',
    seed: 0,
    offered,
    report: { placed, leftOut, mistakes: [], check, notes },
    started,
    now,
  });
}
