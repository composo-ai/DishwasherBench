/**
 * What every policy does with its finished load before it calls it finished, so that the load a
 * policy leaves is the load that is washed and can be unloaded again.
 *
 *  - A careful load has no plate leaning against the tines of its row and no vessel leaning far
 *    over unheld (`posture.ts`): what settled so is taken out again, as a careful hand takes it
 *    out, and listed with the angle.
 *  - A careless or a random load is one a person could have put into a real machine: each
 *    basket is pulled out and pushed in once, and what stops a basket comes out. What the moves
 *    only shift stays where it ends.
 *
 * Until 2026-10-10 both were done after the policy, when a standard load was generated, so a
 * policy played by the benchmark harness left another load than the saved one of its name: a
 * careful load with plates against their rows, a random pile that jammed its basket. They are
 * part of the policy now (`runPolicy`), and the saved loads are what the harness plays.
 */

import type { MachineGeometry } from '@spotless/machine';
import type { LoadCheck } from '@spotless/session';
import { viewOf } from './families.ts';
import type { LeftOut } from './loading.ts';
import type { Player } from './player.ts';
import { postureFindings } from './posture.ts';

/** Actions a tidying pass leaves untouched: a policy must always be able to end its turn. */
const RESERVE = 2;

/**
 * Takes out of a careful load what leans against its row or far over unheld, in up to three
 * rounds (taking one piece out can let its neighbour lean). Returns what was taken out.
 */
export function tidyPosture(player: Player, geometry: () => MachineGeometry): LeftOut[] {
  const out: LeftOut[] = [];
  const views = new Map(player.card.items.map((item) => [item.item_id, viewOf(item)]));
  for (let round = 0; round < 3; round++) {
    // The geometry is asked for anew: taking a piece out does not change it, a folded row does.
    const findings = postureFindings(player.scene().placed, views, geometry());
    if (findings.length === 0) break;
    let removed = 0;
    for (const finding of findings) {
      if (player.actionsLeft() <= RESERVE) return out;
      if (!player.remove(finding.item_id).accepted) continue;
      removed += 1;
      out.push({
        item_id: finding.item_id,
        reason:
          finding.kind === 'plate_against_row'
            ? `taken out again: it leaned ${finding.deg} degrees against the tines of its row`
            : `taken out again: it leaned ${finding.deg} degrees with nothing to hold it`,
      });
    }
    if (removed === 0) break;
  }
  return out;
}

/**
 * Pulls each basket out and pushes it in once and takes out what stops it. Both baskets are
 * left pushed in. Returns what was taken out; `travelled` is false when a basket could not be
 * moved even so, or the actions ran out first.
 */
export function travelBaskets(player: Player): { removed: LeftOut[]; travelled: boolean } {
  const removed: LeftOut[] = [];
  let travelled = true;
  const move = (rack: 'lower_rack' | 'upper_rack', position: 'in' | 'out'): boolean => {
    for (let round = 0; round < 4; round++) {
      if (player.isOut(rack) === (position === 'out')) return true;
      if (player.actionsLeft() <= RESERVE) return false;
      const moved = player.setRack(rack, 'position', position);
      if (moved.accepted) return true;
      if (moved.reason !== 'blocked') return false;
      let taken = 0;
      for (const id of moved.blocked_by ?? []) {
        if (!player.isPlaced(id) || player.actionsLeft() <= RESERVE) continue;
        if (!player.remove(id).accepted) continue;
        taken += 1;
        removed.push({
          item_id: id,
          reason: `taken out: it kept the ${rack.replace('_', ' ')} from being ${position === 'in' ? 'pushed in' : 'pulled out'}`,
        });
      }
      if (taken === 0) return false;
    }
    return false;
  };
  for (const rack of ['lower_rack', 'upper_rack'] as const) {
    if (!player.hasRack(rack)) continue;
    const other = rack === 'lower_rack' ? 'upper_rack' : 'lower_rack';
    if (player.hasRack(other) && !move(other, 'in')) travelled = false;
    // A basket that stands out goes in first: the test is of a whole pull and a whole push.
    for (const position of player.isOut(rack)
      ? (['in', 'out', 'in'] as const)
      : (['out', 'in'] as const)) {
      if (!move(rack, position)) travelled = false;
    }
  }
  return { removed, travelled };
}

/** Rounds of check and removal {@link clearMechanical} makes before it gives up. */
const CLEAR_ROUNDS = 6;

/**
 * The last thing a policy does: the mechanical check, and out comes whatever stops a spray
 * arm, the door or a basket. It runs after everything that can move an item (the travel of the
 * baskets) or free one (an item taken out from under its neighbour), so that the load a policy
 * calls finished is the load that is washed.
 *
 * Until 2026-10-11 01:30 the travel of the baskets came after the policy's own last check and
 * nothing looked again: in the random load of the dinner party the second push of the lower
 * basket slid a fork into the path of the lower arm, and the load was saved, and would have
 * been washed, with that arm stopped, although the random policy takes out what stops an arm.
 *
 * `keep` are items that are in the way on purpose (a careless load asked to stop an arm or to
 * block the tablet): they stay. The tablet's path and the dispenser lid are never cleared here:
 * the random policy leaves them as they fell, and the careless one blocks them only when asked.
 * With `loose`, what fell out of a basket or lies on the tub floor comes out too, as the random
 * policy has it; a careless load is washed as it lies.
 *
 * Returns what was taken out and the last check seen (null when no check could be had).
 */
export function clearMechanical(
  player: Player,
  keep: ReadonlySet<string>,
  loose: boolean,
): { removed: LeftOut[]; check: LoadCheck | null } {
  const removed: LeftOut[] = [];
  let check: LoadCheck | null = null;
  for (let round = 0; round < CLEAR_ROUNDS; round++) {
    if (player.queriesLeft() < 1) break;
    const answer = player.checkLoad();
    if (!answer.accepted) break;
    check = answer;
    const culprits = new Set<string>();
    for (const arm of answer.spray_arms) {
      if (!arm.full_rotation && arm.blocked_by !== undefined) culprits.add(arm.blocked_by);
    }
    for (const id of answer.door_blocked_by) culprits.add(id);
    for (const rack of answer.racks) {
      if (rack.blocked_by !== undefined) culprits.add(rack.blocked_by);
    }
    if (loose) {
      for (const id of answer.fell_out) culprits.add(id);
      for (const id of answer.on_tub_floor) culprits.add(id);
    }
    const items = [...culprits].filter((id) => player.isPlaced(id) && !keep.has(id)).sort();
    if (items.length === 0) break;
    let taken = 0;
    for (const id of items) {
      if (player.actionsLeft() <= RESERVE) break;
      if (!player.remove(id).accepted) continue;
      taken += 1;
      removed.push({
        item_id: id,
        reason:
          'taken out at the end: after the baskets had been moved it was in the way of an arm, the door or a basket',
      });
    }
    if (taken === 0) break;
  }
  return { removed, check };
}
