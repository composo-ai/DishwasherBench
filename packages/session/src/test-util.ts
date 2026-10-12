/**
 * Helpers for this package's tests (not exported from the package entry point).
 */

import type { Level } from '@spotless/levels';
import { afterEach, expect } from 'vitest';
import type { GameSession, SessionOptions } from './session.ts';
import { createSession } from './session.ts';
import type { DropAccepted, DropResult, PlaceRequest, SetRackResult, SlotCard } from './types.ts';

/**
 * Registers an `afterEach` hook that disposes every session made by the returned factory, and
 * returns the factory. Call it once at the top of a test file.
 */
export function useSessions(): (
  level: Level,
  options?: Omit<SessionOptions, 'level'>,
) => Promise<GameSession> {
  const live: GameSession[] = [];
  afterEach(() => {
    for (const session of live.splice(0)) session.dispose();
  });
  return async (level, options = {}) => {
    const session = await createSession({ level, ...options });
    live.push(session);
    return session;
  };
}

/** Places an item and requires the call to be accepted. */
export function mustPlace(session: GameSession, request: PlaceRequest): DropAccepted {
  const result: DropResult = session.place(request);
  if (!result.accepted) {
    throw new Error(`place ${request.item_id} was rejected: ${JSON.stringify(result)}`);
  }
  return result;
}

/** Sets a rack option and requires the call to be accepted. */
export function mustSetRack(
  session: GameSession,
  rack: 'lower_rack' | 'upper_rack' | 'cutlery_basket',
  name: string,
  value: string,
): Extract<SetRackResult, { accepted: true }> {
  const result = session.setRack({ rack, option: { name, value } });
  if (!result.accepted)
    throw new Error(`set_rack ${rack} ${name}=${value}: ${JSON.stringify(result)}`);
  return result;
}

/** A slot of a rack by id. */
export function slotOf(
  session: GameSession,
  rack: 'lower_rack' | 'upper_rack',
  id: string,
): SlotCard {
  const slots = session.listSlots({ rack });
  if (!slots.accepted) throw new Error('list_slots was rejected');
  const slot = slots.slots.find((s) => s.id === id);
  expect(slot, `slot ${id}`).toBeDefined();
  return slot as SlotCard;
}

/**
 * Where `list_slots` suggests dropping an item into a slot between tines: the position and
 * orientation of a `place` request.
 */
export function slotDrop(
  session: GameSession,
  rack: 'lower_rack' | 'upper_rack',
  slotId: string,
  itemId: string,
): Pick<PlaceRequest, 'position_mm' | 'orientation'> {
  const slots = session.listSlots({ rack, item_id: itemId });
  if (!slots.accepted) throw new Error(`list_slots was rejected: ${JSON.stringify(slots)}`);
  const drop = slots.slots.find((s) => s.id === slotId)?.suggested_drop;
  if (drop === undefined) throw new Error(`slot ${slotId} has no suggested drop for ${itemId}`);
  return drop;
}

/** Direction of an item's +z axis in the frame of a wire pose (for a plate: its face). */
export function itemAxisZ(
  quatWxyz: readonly [number, number, number, number],
): [number, number, number] {
  const [w, x, y, z] = quatWxyz;
  return [2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y)];
}

/** Puts the lower basket in and pulls the upper one out, as for loading the upper basket. */
export function openUpperBasket(session: GameSession): void {
  mustSetRack(session, 'lower_rack', 'position', 'in');
  mustSetRack(session, 'upper_rack', 'position', 'out');
}
