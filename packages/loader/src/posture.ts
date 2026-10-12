/**
 * How the items of a settled load stand, read from the poses: which plates lean against the
 * tines of their row instead of with them, and which glasses, cups and bowls lean far over
 * with nothing to hold them (a tine, a folded shelf, a sloped side rest). A careful load has neither: the first is a plate that was let
 * go upright and fell the wrong way, the second is the beginning of a pile. The pictures of a
 * load cannot show this reliably; the numbers do.
 */

import type { MachineGeometry } from '@spotless/machine';
import type { PlacedItemState } from '@spotless/session';
import type { ItemView } from './families.ts';
import { mouthUpDeg } from './mistakes.ts';

/**
 * A plate may lean this far against the tines of its slot, degrees. The catalogue's 27 cm
 * plates, 30 mm deep, stand 3.5 to 5.5 degrees against them when seated by a hand
 * (`packages/machine/src/geometry/plate-rows.test.ts`, `packages/session/scripts/row-seats.ts`).
 */
export const PLATE_AGAINST_ROW_LIMIT = 6;
/**
 * The same for deep plates (soup plates, pasta bowls stood in a row): the tines reach below
 * their rim and tip them forward, 8 to 13 degrees in the rear rows. No photograph settles it.
 */
export const DEEP_PLATE_AGAINST_ROW_LIMIT = 15;
/**
 * A glass, cup, mug or bowl standing mouth down may lean this far from the vertical with
 * nothing to hold it (`vesselHeld`), degrees. The ramp of the upper basket's floor falls 14
 * degrees and the tines of row C lean 11: a vessel resting on both leans up to about 25.
 * [ESTIMATED]
 */
export const VESSEL_LEAN_LIMIT = 25;

/**
 * Beyond this lean from mouth down a glass, cup or mug lies on its side, whatever holds it,
 * degrees. [ESTIMATED]
 */
export const VESSEL_ON_SIDE_LIMIT = 45;

/**
 * A vessel that leans towards the wall of a side rest within this angle in plan of the way the
 * rest falls stands on the rest as it is made to, degrees. [ESTIMATED]
 */
export const REST_LEAN_DIRECTION = 30;
/**
 * How far beyond the ridge of a side rest, towards the middle of the basket, the middle of a
 * vessel that stands on the rest may be, millimetres (a mug leaning 20 degrees has its rim
 * over the ridge by 30 mm and its middle 20 mm short of it). [ESTIMATED]
 */
export const REST_BEYOND_RIDGE = 10;

/**
 * Whether a vessel is held where it leans, by what the basket has for it: a tine it rests on,
 * a folded cup shelf it leans against from the side rest in front of it, or a sloped side rest it stands on, leaning towards the
 * wall with the slope (the rests of the Bosch's upper basket fall 33 and 35 degrees: a cup set
 * down there leans 20 to 38 degrees by design, its opening towards the spray arm and the
 * hollow of its base drained; IMG_9131). `rows` are the tine rows of its basket it touches.
 */
export function vesselHeld(
  item: PlacedItemState,
  rows: readonly string[],
  geometry: MachineGeometry,
): boolean {
  if (rows.length > 0) return true;
  const touches = item.contacts.map((contact) => contact.with);
  // A folded cup shelf stands behind a side rest: a vessel on that rest which touches it is held
  // by it whichever way along the wall it leans, as long as it leans to the wall at all. No
  // other fitting holds a vessel (touching the knife shelf or a lowered shelf from below does
  // not), and a shelf does not hold one that stands elsewhere. [Narrowed 2026-10-11, review of
  // the loading: touching any fitting of the basket used to count.]
  const onShelf = touches.some((name) => name.startsWith(`${item.frame}_fittings.shelf.`));
  if (!onShelf && !touches.some((name) => name.startsWith(`${item.frame}.`))) return false;
  const axis = axisZ(item.quat_wxyz);
  // Mouth down, the base is where -z of the item points: the way it leans, in plan.
  const lean: readonly [number, number] = [-axis[0], -axis[1]];
  const size = Math.hypot(lean[0], lean[1]);
  if (size < 1e-6) return false;
  const x = item.position_mm[0] / 1000;
  for (const rest of geometry.affordances.sideRests) {
    if (rest.frame !== item.frame) continue;
    const toward = rest.fallsToward === '-x' ? -1 : 1;
    const beyond = REST_BEYOND_RIDGE / 1000;
    const onIt =
      toward < 0
        ? x <= rest.peakX + beyond && x >= 0
        : x >= rest.peakX - beyond && x <= rest.wallX + (rest.wallX - rest.footX);
    const along = (toward * lean[0]) / size;
    if (onIt && along >= Math.cos((REST_LEAN_DIRECTION * Math.PI) / 180)) return true;
    if (onIt && onShelf && along > 0) return true;
  }
  return false;
}

/** One item that does not stand as a careful hand leaves it. */
export interface PostureFinding {
  readonly item_id: string;
  readonly kind: 'plate_against_row' | 'vessel_leaning';
  /** The lean against the tines, or the lean from mouth down, degrees. */
  readonly deg: number;
  /** The row of the plate, when it is a plate. */
  readonly row?: string;
}

function axisZ(q: readonly [number, number, number, number]): [number, number, number] {
  const [w, x, y, z] = q;
  return [2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y)];
}

/**
 * The lean of a plate standing on edge in a slot, degrees: positive with the tines of the
 * slot, negative against them, whichever way its eating face looks. `face` is the plate's axis
 * in the rack frame.
 */
export function leanWithTines(face: readonly [number, number, number], leanToward: string): number {
  const sign = leanToward.startsWith('-') ? -1 : 1;
  const along = leanToward.endsWith('x') ? 0 : 1;
  // The axis taken pointing away from the side the tines lean to.
  const flip = sign * (face[along] as number) > 0 ? -1 : 1;
  return (Math.atan2(flip * face[2], -sign * flip * (face[along] as number)) * 180) / Math.PI;
}

/**
 * The posture findings of a settled load: `placed` as the scene state gives it, the views of
 * the level's items and the geometry of the machine as configured.
 */
export function postureFindings(
  placed: readonly PlacedItemState[],
  views: ReadonlyMap<string, ItemView>,
  geometry: MachineGeometry,
): PostureFinding[] {
  const out: PostureFinding[] = [];
  for (const item of placed) {
    const view = views.get(item.item_id);
    if (view === undefined || item.frame === 'cutlery_basket' || item.frame === 'tub') continue;
    const rows = item.contacts
      .map((contact) => /^(\w+)\.tine_row_(\w+)$/.exec(contact.with))
      .filter((m): m is RegExpExecArray => m !== null && m[1] === item.frame)
      .map((m) => m[2] as string)
      .sort();
    const face = axisZ(item.quat_wxyz);
    const deep = view.record.class === 'soup_plate' || view.family === 'bowl';
    if ((view.family === 'flat' || deep) && Math.abs(face[2]) < Math.SQRT1_2 && rows.length > 0) {
      // On edge and touching a row: the slot of that row nearest along the rail. Only an item
      // that stands across its row, its axis within 20 degrees of the rail in plan, has a lean
      // with or against the tines; a bowl turned in its row is judged as a vessel below.
      const row = geometry.affordances.tineRows.find(
        (r) => r.frame === item.frame && r.rowId === rows[0] && r.state === 'up',
      );
      const along = row?.runs === 'x' ? 0 : 1;
      const at = (item.position_mm[along] as number) / 1000;
      const slot = [...(row?.slots ?? [])].sort(
        (a, b) =>
          Math.abs((a.centre[along] as number) - at) - Math.abs((b.centre[along] as number) - at),
      )[0];
      // The gap where the lean of a row changes holds a plate upright either way.
      const across = Math.abs(face[1 - along] as number);
      const inPlan = Math.hypot(face[0], face[1]);
      const square = inPlan > 0 && across / inPlan < Math.sin((20 * Math.PI) / 180);
      if (row !== undefined && slot !== undefined && !slot.vGap && slot.lean > 0 && square) {
        const lean = leanWithTines(face, slot.leanToward);
        const limit = deep ? DEEP_PLATE_AGAINST_ROW_LIMIT : PLATE_AGAINST_ROW_LIMIT;
        if (lean < -limit) {
          out.push({
            item_id: item.item_id,
            kind: 'plate_against_row',
            deg: Math.round(-lean * 10) / 10,
            row: row.rowId,
          });
        }
      }
      if (square || view.family === 'flat') continue;
    }
    if (view.family === 'vessel' || view.family === 'stemware' || view.family === 'bowl') {
      const lean = 180 - mouthUpDeg(item);
      // A tine, a folded shelf or a side rest holds a leaning glass or mug, but not one that
      // lies on its side there; a bowl stood on edge between tines is meant to stand so.
      const held =
        (rows.length > 0 && view.family === 'bowl') ||
        (lean <= VESSEL_ON_SIDE_LIMIT && vesselHeld(item, rows, geometry));
      if (lean > VESSEL_LEAN_LIMIT && !held) {
        out.push({
          item_id: item.item_id,
          kind: 'vessel_leaning',
          deg: Math.round(lean * 10) / 10,
        });
      }
    }
  }
  return out.sort((a, b) => (a.item_id < b.item_id ? -1 : a.item_id > b.item_id ? 1 : 0));
}
