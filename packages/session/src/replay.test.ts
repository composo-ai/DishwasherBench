// Determinism: the same calls give the same hashes, and an action log replays to identical
// hashes, in this process and in a fresh one.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ActionLogEvent, GameSession, ReplayResult } from './index.ts';
import { applyLoggedEvent, placeholderWashRunner, replayActionLog } from './index.ts';
import { testLevel } from './test-level.ts';
import { slotDrop, slotOf, useSessions } from './test-util.ts';

const session = useSessions();

/** An episode with accepted and rejected actions of every kind and queries in between. */
async function playEpisode(s: GameSession): Promise<readonly ActionLogEvent[]> {
  s.getLevel();
  const slot = slotOf(s, 'lower_rack', 'tine_row_r1.slot_07');
  const orientation = slot.suggested_orientation ?? { preset: 'on_edge' };
  s.place({
    item_id: 'soup_plate_01',
    frame: 'lower_rack',
    ...slotDrop(s, 'lower_rack', 'tine_row_r1.slot_07', 'soup_plate_01'),
  });
  s.preview({
    item_id: 'soup_plate_02',
    frame: 'lower_rack',
    position_mm: [slot.centre_mm[0] + 25, 360, 240],
    orientation,
  });
  s.place({
    item_id: 'soup_plate_02',
    frame: 'lower_rack',
    position_mm: [slot.centre_mm[0] + 25, 360, 240],
    orientation,
  });
  s.place({
    item_id: 'soup_plate_02',
    frame: 'lower_rack',
    position_mm: [slot.centre_mm[0] + 25, 360, 240],
    orientation,
  });
  s.place({
    item_id: 'fork_01',
    frame: 'cutlery_basket',
    position_mm: [32, 28, 120],
    orientation: { preset: 'handle_down' },
  });
  s.place({
    item_id: 'teaspoon_01',
    frame: 'lower_rack',
    position_mm: [130, 250, 100],
    orientation: { preset: 'handle_down' },
  });
  s.place({
    item_id: 'bowl_01',
    frame: 'lower_rack',
    position_mm: [420, 270, 10],
    orientation: { preset: 'inverted' },
  });
  s.checkLoad();
  s.remove({ item_id: 'soup_plate_01' });
  s.remove({ item_id: 'soup_plate_01' });
  s.setRack({ rack: 'lower_rack', option: { name: 'position', value: 'in' } });
  s.setRack({ rack: 'upper_rack', option: { name: 'position', value: 'out' } });
  s.place({
    item_id: 'mug_01',
    frame: 'upper_rack',
    position_mm: [250, 380, 130],
    orientation: { preset: 'inverted' },
  });
  s.place({
    item_id: 'glass_01',
    frame: 'upper_rack',
    position_mm: [430, 300, 130],
    orientation: { preset: 'inverted' },
  });
  s.setRack({ rack: 'upper_rack', option: { name: 'shelf_cup_rear', value: 'down' } });
  s.setRack({ rack: 'upper_rack', option: { name: 'height', value: '2' } });
  s.getState();
  s.place({
    item_id: 'glass_02',
    frame: 'upper_rack',
    position_mm: [160, 440, 130],
    orientation: { preset: 'inverted', yaw_deg: 17 },
  });
  s.place({
    item_id: 'bowl_02',
    frame: 'upper_rack',
    position_mm: [250, 200, 140],
    orientation: { preset: 'inverted' },
    mode: 'insert',
    insert_dir: [0, 1, -1],
  });
  s.checkLoad();
  s.startCycle();
  await s.washSettled();
  s.getReport();
  return s.actionLog();
}

describe('the action log', () => {
  it('records every call with the scene hash after it, and replays to identical hashes', async () => {
    const s = await session(testLevel());
    const log = await playEpisode(s);
    expect(log.map((e) => e.seq)).toEqual(log.map((_, i) => i));
    const actions = log.filter((e) => e.kind === 'action');
    expect(actions.map((e) => e.name)).toEqual(
      expect.arrayContaining(['place', 'remove', 'set_rack', 'start_cycle']),
    );
    expect(actions.some((e) => !e.accepted)).toBe(true);
    expect(actions.filter((e) => e.accepted).length).toBeGreaterThanOrEqual(12);
    expect(log[log.length - 1]).toMatchObject({
      kind: 'query',
      name: 'get_report',
      accepted: true,
    });
    for (let i = 0; i < log.length; i++) {
      const event = log[i] as ActionLogEvent;
      expect(event.state_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(event.result_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
      // Queries and rejected actions leave the scene alone; accepted actions change it.
      const before = i === 0 ? undefined : (log[i - 1] as ActionLogEvent).state_hash;
      if (before === undefined) continue;
      if (event.kind === 'query' || !event.accepted) expect(event.state_hash).toBe(before);
      else if (event.name !== 'start_cycle') expect(event.state_hash).not.toBe(before);
    }
    // The log is plain JSON.
    expect(JSON.parse(JSON.stringify(log))).toEqual(log);

    // Actions alone: the queries of the log (two check_loads among them) change nothing.
    const actionsOnly = await replayActionLog(testLevel(), log);
    expect(actionsOnly.mismatches).toEqual([]);
    expect(actionsOnly.ok).toBe(true);
    expect(actionsOnly.replayed).toBe(actions.length);
    expect(actionsOnly.final_state_hash).toBe(s.stateHash());

    // With the queries, every result is reproduced too.
    const everything = await replayActionLog(testLevel(), log, { queries: true });
    expect(everything.mismatches).toEqual([]);
    expect(everything.replayed).toBe(log.length);

    // A second session given the same calls logs the same thing.
    const twin = await session(testLevel());
    const again = await playEpisode(twin);
    expect(again.map((e) => [e.name, e.accepted, e.state_hash, e.result_digest])).toEqual(
      log.map((e) => [e.name, e.accepted, e.state_hash, e.result_digest]),
    );
  });

  it('a log that was tampered with does not verify', async () => {
    const s = await session(testLevel());
    s.place({
      item_id: 'bowl_01',
      frame: 'lower_rack',
      position_mm: [420, 270, 200],
      orientation: { preset: 'inverted' },
    });
    s.place({
      item_id: 'fork_01',
      frame: 'cutlery_basket',
      position_mm: [32, 28, 120],
      orientation: { preset: 'handle_down' },
    });
    const log = s.actionLog();
    expect((await replayActionLog(testLevel(), log)).ok).toBe(true);
    // The bowl one millimetre to the side: every hash from there on differs.
    const first = log[0] as ActionLogEvent;
    const moved: ActionLogEvent = {
      ...first,
      args: { ...(first.args as object), position_mm: [421, 270, 200] },
    };
    const result = await replayActionLog(testLevel(), [moved, ...log.slice(1)]);
    expect(result.ok).toBe(false);
    expect(result.mismatches.map((m) => [m.seq, m.field])).toEqual([
      [0, 'state_hash'],
      [1, 'state_hash'],
    ]);
    // An accepted action recorded as rejected.
    const flipped = await replayActionLog(testLevel(), [{ ...first, accepted: false }]);
    expect(flipped.mismatches).toEqual([
      { seq: 0, name: 'place', field: 'accepted', expected: 'false', actual: 'true' },
    ]);
  });

  it('does not pass over an event whose name is no call of the game', async () => {
    const s = await session(testLevel());
    const log = await playEpisode(s);
    const first = log[0] as ActionLogEvent;
    const forged = [{ ...first, name: 'teleport' as never }, ...log.slice(1)];
    const result = await replayActionLog(testLevel(), forged);
    expect(result.ok).toBe(false);
    expect(result.mismatches[0]).toMatchObject({ seq: first.seq, field: 'name' });
  });

  it('returns the manifest of the load it replayed, and replays through a wash that failed', async () => {
    let calls = 0;
    const s = await session(testLevel(), {
      washRunner: (manifest, onProgress) => {
        calls += 1;
        if (calls === 1) return Promise.reject(new Error('the GPU was lost'));
        return placeholderWashRunner(manifest, onProgress);
      },
    });
    const bowl = {
      item_id: 'bowl_01',
      frame: 'lower_rack' as const,
      position_mm: [420, 270, 200] as [number, number, number],
      orientation: { preset: 'inverted' },
    };
    expect(s.place(bowl).accepted).toBe(true);
    expect(s.startCycle().accepted).toBe(true);
    await s.washSettled();
    // The wash was given back: the cycle is started again on the same load.
    expect(s.phase()).toBe('loading');
    expect(s.startCycle().accepted).toBe(true);
    await s.washSettled();
    const log = s.actionLog();
    // Without the outcomes the second start_cycle meets a finished episode.
    expect((await replayActionLog(testLevel(), log)).ok).toBe(false);
    const result = await replayActionLog(testLevel(), log, { washOutcomes: ['failed', 'done'] });
    expect(result.mismatches).toEqual([]);
    expect(result.final_state_hash).toBe(s.stateHash());
    expect(result.manifest?.load).toEqual(s.washManifest()?.load);
    expect(result.manifest?.items.map((item) => item.item_id)).toEqual(['bowl_01']);
    // No cycle, no manifest.
    expect((await replayActionLog(testLevel(), log.slice(0, 1))).manifest).toBeNull();
  });

  it('applies a logged event to a running session', async () => {
    const s = await session(testLevel());
    const event = applyLoggedEvent(s, {
      kind: 'action',
      name: 'place',
      args: {
        item_id: 'bowl_01',
        frame: 'lower_rack',
        position_mm: [420, 270, 200],
        orientation: { preset: 'inverted' },
      },
    });
    expect(event).toMatchObject({ seq: 0, name: 'place', accepted: true });
    expect(s.getState().placed.map((p) => p.item_id)).toEqual(['bowl_01']);
  });

  it('replays to identical hashes in a fresh process', async () => {
    const s = await session(testLevel());
    const log = await playEpisode(s);
    const directory = mkdtempSync(join(tmpdir(), 'spotless-replay-'));
    try {
      const file = join(directory, 'episode.json');
      writeFileSync(file, JSON.stringify({ level: testLevel(), log }));
      const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
      const output = execFileSync(
        process.execPath,
        ['--import', 'tsx', join(packageRoot, 'scripts', 'replay-log.ts'), file, '--queries'],
        { cwd: packageRoot, encoding: 'utf8', timeout: 100_000 },
      );
      const result = JSON.parse(output.trim().split('\n').pop() ?? '{}') as ReplayResult;
      expect(result.mismatches).toEqual([]);
      expect(result.ok).toBe(true);
      expect(result.replayed).toBe(log.length);
      expect(result.final_state_hash).toBe(s.stateHash());
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
