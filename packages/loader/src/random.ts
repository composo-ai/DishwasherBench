/**
 * The random policy: uniformly random feasible placements until nothing more fits (every item
 * has had its draws) or the budget ends. It is the floor a loading skill is measured against:
 * no knowledge of rows, faces or drainage, only "does the session take it and does it stay".
 *
 * Each item is given a basket at random, then poses are drawn until one is accepted and holds:
 * a position uniform over the basket's plan, and an orientation that is either one of the
 * item's presets turned by a random yaw or a rotation drawn uniformly from all rotations. An
 * item that falls out, falls through or does not come to a stable rest is taken out and drawn
 * again. When the baskets are pushed in, whatever that shakes loose or leaves in the way of an
 * arm is taken out.
 */

import type { DropResult, Orientation } from '@spotless/session';
import type { ItemView } from './families.ts';
import { viewOf } from './families.ts';
import type { LeftOut, LoadingReport } from './loading.ts';
import { dropAt, dropHeights } from './placing.ts';
import type { LoadFrame, Player, Rng } from './player.ts';
import { outcomeOf } from './player.ts';

/** Poses drawn for one item before it is given up. */
export const RANDOM_DRAWS_PER_ITEM = 16;
/** Accepted placements that did not hold, per item, before it is given up. */
export const RANDOM_BAD_PER_ITEM = 1;

/** A rotation drawn uniformly from all rotations (Shoemake), as `quat_wxyz`. */
function randomRotation(rng: Rng): Orientation {
  const u1 = rng.next();
  const u2 = rng.next() * 2 * Math.PI;
  const u3 = rng.next() * 2 * Math.PI;
  const a = Math.sqrt(1 - u1);
  const b = Math.sqrt(u1);
  const round = (v: number): number => Math.round(v * 1e4) / 1e4;
  return {
    quat_wxyz: [
      round(b * Math.cos(u3)),
      round(a * Math.sin(u2)),
      round(a * Math.cos(u2)),
      round(b * Math.sin(u3)),
    ],
  };
}

/** Plays the random policy on the offered items, in their order. */
export function runRandom(player: Player, rng: Rng, offeredIds: readonly string[]): LoadingReport {
  const offered = offeredIds
    .filter((id) => player.items.has(id))
    .map((id) => viewOf(player.item(id)));
  const leftOut = new Map<string, string>();
  const notes: string[] = [];
  const frames: LoadFrame[] = (['lower_rack', 'cutlery_basket', 'upper_rack'] as const).filter(
    (f) => player.hasRack(f),
  );
  // Every item draws its basket up front, so that the draw does not depend on what fitted.
  const target = new Map<string, LoadFrame>();
  for (const view of offered) target.set(view.id, rng.pick(frames));

  const reserve = 8;
  const tryItem = (view: ItemView, frame: LoadFrame): boolean => {
    const [ex, ey] = player.envelope(frame);
    const longest = view.longest;
    let bad = 0;
    for (let draw = 0; draw < RANDOM_DRAWS_PER_ITEM; draw++) {
      if (player.actionsLeft() < 2 + reserve) {
        leftOut.set(view.id, 'the action budget ran out');
        return false;
      }
      const x = rng.next() * ex;
      const y = rng.next() * ey;
      const preset = rng.pick(view.record.orientation_presets).name;
      const orientation: Orientation = rng.chance(0.5)
        ? { preset, yaw_deg: rng.int(360) }
        : randomRotation(rng);
      const result: DropResult = dropAt(
        player,
        view.id,
        frame,
        x,
        y,
        orientation,
        dropHeights(player, frame, y, longest / 2 + 4, longest / 2),
      );
      if (!result.accepted) continue;
      const outcome = outcomeOf(result);
      const held =
        !result.fell_out && !result.fell_through && result.stable && outcome.disturbedMm <= 20;
      if (held) return true;
      player.remove(view.id);
      player.stats.retries += 1;
      bad += 1;
      if (bad > RANDOM_BAD_PER_ITEM) {
        leftOut.set(view.id, 'every random pose that was accepted fell or did not hold');
        return false;
      }
    }
    leftOut.set(view.id, `none of ${RANDOM_DRAWS_PER_ITEM} random poses was accepted and held`);
    return false;
  };

  /** Pushes a basket in, taking out whatever stops it. */
  const pushIn = (rack: 'lower_rack' | 'upper_rack'): boolean => {
    for (let round = 0; round < 8; round++) {
      if (!player.isOut(rack)) return true;
      const result = player.setRack(rack, 'position', 'in');
      if (result.accepted) return true;
      const blockers = ('blocked_by' in result ? (result.blocked_by ?? []) : []).filter((id) =>
        player.isPlaced(id),
      );
      if (blockers.length === 0) return false;
      for (const id of blockers) {
        if (!player.remove(id).accepted) return false;
        leftOut.set(id, 'taken out again: it stopped the basket from sliding in');
      }
    }
    return false;
  };

  const fill = (open: 'lower_rack' | 'upper_rack', into: readonly LoadFrame[]): void => {
    const other = open === 'lower_rack' ? 'upper_rack' : 'lower_rack';
    if (player.hasRack(other) && !pushIn(other)) return;
    if (!player.moveRack(open, 'out')) return;
    for (const view of offered) {
      const frame = target.get(view.id) as LoadFrame;
      if (!into.includes(frame) || player.isPlaced(view.id)) continue;
      tryItem(view, frame);
    }
    pushIn(open);
    for (const item of [...player.scene().placed]) {
      if (item.stable || player.actionsLeft() < 2) continue;
      if (player.remove(item.item_id).accepted) {
        player.stats.retries += 1;
        leftOut.set(item.item_id, 'taken out again: pushing the basket in left it unstable');
      }
    }
  };

  if (player.hasRack('lower_rack')) fill('lower_rack', ['lower_rack', 'cutlery_basket']);
  if (player.hasRack('upper_rack')) fill('upper_rack', ['upper_rack']);
  if (player.hasRack('lower_rack')) pushIn('lower_rack');
  if (player.hasRack('upper_rack')) pushIn('upper_rack');

  // What stops a basket, the door or an arm comes out again; the tablet's path is left as it
  // fell, since a random loader does not look.
  let check = null;
  for (let round = 0; round < 6; round++) {
    const answer = player.checkLoad();
    if (!answer.accepted) break;
    check = answer;
    const culprits = new Set<string>();
    for (const arm of answer.spray_arms) {
      if (!arm.full_rotation && arm.blocked_by !== undefined) culprits.add(arm.blocked_by);
    }
    for (const id of answer.door_blocked_by) culprits.add(id);
    for (const rack of answer.racks)
      if (rack.blocked_by !== undefined) culprits.add(rack.blocked_by);
    for (const id of answer.fell_out) culprits.add(id);
    for (const id of answer.on_tub_floor) culprits.add(id);
    const items = [...culprits].filter((id) => player.isPlaced(id));
    if (items.length === 0) break;
    for (const id of items) {
      if (player.actionsLeft() < 1) break;
      if (player.remove(id).accepted) {
        leftOut.set(
          id,
          'taken out again: check_load found it in the way of an arm, the door or a basket',
        );
      }
    }
  }

  const placed = offered.filter((view) => player.isPlaced(view.id)).map((view) => view.id);
  const out: LeftOut[] = offered
    .filter((view) => !player.isPlaced(view.id))
    .map((view) => ({
      item_id: view.id,
      reason: leftOut.get(view.id) ?? 'no place was found for it',
    }));
  return { placed, leftOut: out, mistakes: [], check, notes };
}
