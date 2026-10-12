import type { DropResult, LoadCheck, SceneState, WirePose } from '@spotless/session';
import { describe, expect, it } from 'vitest';
import {
  clock,
  describeBudget,
  describeDrop,
  describeLoadCheck,
  describeMoved,
  describePlaced,
  describeRejection,
  listOf,
  locationText,
  phaseTitle,
  tidy,
  aboutDuration,
  washTimeText,
  difficultyText,
} from './format.ts';

const pose: WirePose = {
  frame: 'lower_rack',
  position_mm: [115, 372, 174.9],
  quat_wxyz: [1, 0, 0, 0],
};
const state: SceneState = {
  state_hash: 'sha256:00',
  phase: 'loading',
  racks: { lower_rack: 'out', upper_rack: 'in' },
  rack_options: {},
  placed: [],
  unplaced: [],
  budget: {
    actions_max: 60,
    queries_max: 300,
    washes_max: 1,
    actions_used: 48,
    queries_used: 300,
    washes_used: 0,
  },
};

describe('feedback after a drop', () => {
  const accepted: Extract<DropResult, { accepted: true }> = {
    accepted: true,
    returned: [],
    item_id: 'plate_01',
    requested_pose: pose,
    release_pose: pose,
    settled_pose: pose,
    displacement_mm: 30.42,
    rotation_deg: 13.5,
    settle_time_s: 2,
    stable: true,
    fell_through: false,
    fell_out: false,
    contacts: [
      { with: 'lower_rack.tine_row_r1', points: 2, normal_force_N: 3 },
      { with: 'lower_rack.tine_row_r2', points: 2, normal_force_N: 4 },
    ],
    moved_items: [],
    state_hash: 'sha256:00',
    state,
  };

  it('says where the item came to rest, that it is stable and what it touches', () => {
    const lines = describeDrop(accepted);
    expect(lines.map((l) => l.level)).toEqual(['info', 'ok']);
    expect(lines[0]?.text).toBe(
      'plate_01 came to rest after 2 s at (115, 372, 174.9) mm in lower_rack, 30.4 mm and 13.5° from where it was let go.',
    );
    expect(lines[1]?.text).toBe(
      'It is at rest and stable, touching lower_rack.tine_row_r1 and lower_rack.tine_row_r2.',
    );
  });

  it('warns about an unstable item and about neighbours it moved', () => {
    const lines = describeDrop({
      ...accepted,
      stable: false,
      moved_items: [{ item_id: 'bowl_01', displacement_mm: 4.26, rotation_deg: 1 }],
    });
    expect(lines.map((l) => l.level)).toEqual(['info', 'warn', 'warn']);
    expect(lines[1]?.text).toContain('not stable');
    expect(lines[2]?.text).toBe('It moved bowl_01 (4.3 mm, 1°).');
  });

  it('reports an item that fell through or out as a problem', () => {
    const through = describeDrop({
      ...accepted,
      fell_through: true,
      contacts: [{ with: 'door.liner', points: 4, normal_force_N: 1 }],
    })[1];
    expect(through?.level).toBe('bad');
    expect(through?.text).toContain('fell through the basket and is touching door.liner');
    expect(through?.text).toContain('left out of the wash');
    expect(describeDrop({ ...accepted, fell_out: true })[1]?.level).toBe('bad');
  });

  it('says that an item that reached the kitchen floor is back on the counter', () => {
    const own = describeDrop({
      ...accepted,
      fell_out: true,
      stable: false,
      returned: ['plate_01'],
    });
    expect(own.map((l) => l.level)).toEqual(['info', 'bad']);
    expect(own[1]?.text).toContain('back on the counter');
    expect(own[1]?.text).toContain('charged');
    const other = describeDrop({ ...accepted, returned: ['mug_01'] });
    expect(other[other.length - 1]).toEqual({
      level: 'bad',
      text: 'Knocked out of the machine onto the kitchen floor and back on the counter: mug_01.',
    });
    expect(
      describeMoved('Lower basket: position set to in.', [], ['mug_01']).map((l) => l.level),
    ).toEqual(['info', 'bad']);
  });

  it('says where a placed item lies, and that one on the door will not be washed', () => {
    const placed = {
      ...pose,
      item_id: 'fork_01',
      stable: true,
      contacts: [{ with: 'door.liner', points: 3 }],
      location: 'outside' as const,
    };
    expect(describePlaced(placed)[0]?.level).toBe('bad');
    expect(describePlaced(placed)[0]?.text).toContain('left out of the wash');
    expect(describePlaced({ ...placed, location: 'lower_rack' })[0]).toEqual({
      level: 'ok',
      text: 'At rest and stable.',
    });
    expect(locationText('outside')).toBe('On the door: will not be washed');
    expect(locationText('upper_rack')).toBe('Upper basket');
    expect(locationText('tub_floor')).toBe('On the tub floor');
  });

  it('explains a rejection, names what is in the way and says that it was free', () => {
    const lines = describeDrop({
      accepted: false,
      reason: 'collision_at_pose',
      penetration_mm: 15,
      colliding_with: ['bowl_01', 'lower_rack.floor'],
    });
    expect(lines[0]).toEqual({
      level: 'bad',
      text: 'The item would overlap something at that pose.',
    });
    expect(lines[1]?.text).toBe('Overlaps bowl_01 and the wires of the lower basket by 15 mm.');
    expect(lines[lines.length - 1]?.text).toBe('Nothing changed and nothing was charged.');
    const blocked = describeRejection({
      accepted: false,
      reason: 'not_insertable',
      blocked_by: 'upper_rack',
      detail: 'nothing can come straight down to this pose',
    });
    expect(blocked.map((l) => l.text)).toEqual([
      'The item cannot get there in a straight line.',
      'In the way: the wires of the upper basket.',
      'nothing can come straight down to this pose',
      'Nothing changed and nothing was charged.',
    ]);
    // A reason this client does not know is still shown.
    expect(describeRejection({ accepted: false, reason: 'cosmic_rays' })[0]?.text).toBe(
      'Refused: cosmic_rays.',
    );
  });

  it('describes what a basket move shifted', () => {
    expect(describeMoved('Pushed in.', [])).toEqual([
      { level: 'ok', text: 'Pushed in. Nothing else moved.' },
    ]);
    const lines = describeMoved('Pushed in.', [
      { item_id: 'mug_01', displacement_mm: 7.6, rotation_deg: 3.7 },
      { item_id: 'plate_01', displacement_mm: 1.3, rotation_deg: 0.6 },
    ]);
    expect(lines[1]).toEqual({
      level: 'warn',
      text: 'Moved: mug_01 (7.6 mm, 3.7°) and plate_01 (1.3 mm, 0.6°).',
    });
  });
});

describe('the mechanical check, readable', () => {
  const clear: LoadCheck = {
    shifted: [],
    fell_out: [],
    on_tub_floor: [],
    protruding: [],
    racks: [
      { rack: 'lower_rack', slides_in: true },
      { rack: 'upper_rack', slides_in: true },
    ],
    spray_arms: [
      { arm: 'lower_arm', full_rotation: true },
      { arm: 'upper_arm', full_rotation: true },
    ],
    door_closes: true,
    door_blocked_by: [],
    dispenser_opens: true,
    dispenser_blocked_by: [],
    tablet_path_clear: true,
    tablet_blocked_by: [],
  };

  it('a clear load is all good news, one line per fact', () => {
    const lines = describeLoadCheck(clear);
    expect(lines.every((l) => l.level === 'ok')).toBe(true);
    expect(lines.map((l) => l.text)).toEqual([
      'lower_rack slides in.',
      'upper_rack slides in.',
      'lower_arm turns freely.',
      'upper_arm turns freely.',
      'The door closes.',
      'The detergent dispenser opens.',
      'The tablet can fall into its tray.',
      'Nothing shifted when the baskets went in.',
    ]);
  });

  it('names every problem and what causes it', () => {
    const lines = describeLoadCheck({
      ...clear,
      racks: [
        { rack: 'lower_rack', slides_in: false, blocked_by: 'pan_01' },
        { rack: 'upper_rack', slides_in: true },
      ],
      spray_arms: [
        { arm: 'lower_arm', full_rotation: true },
        {
          arm: 'upper_arm',
          full_rotation: false,
          first_contact_angle_deg: 118.24,
          blocked_by: 'plate_02',
        },
      ],
      door_closes: false,
      door_blocked_by: ['pan_01'],
      dispenser_opens: false,
      dispenser_blocked_by: ['tray_01'],
      tablet_path_clear: false,
      tablet_blocked_by: ['tray_01', 'plate_02'],
      fell_out: ['spoon_01'],
      on_tub_floor: ['spoon_01'],
      protruding: [
        { item_id: 'plate_01', rack: 'lower_rack', beyond_mm: 12.2, over: 'top', touching: [] },
      ],
      shifted: [{ item_id: 'mug_01', displacement_mm: 2, rotation_deg: 0 }],
    });
    const bad = lines.filter((l) => l.level === 'bad').map((l) => l.text);
    expect(bad).toEqual([
      'lower_rack does not slide in: pan_01 is in the way.',
      'upper_arm is stopped after 118.2° by plate_02.',
      'The door does not close: pan_01 in the way.',
      'The detergent dispenser is blocked by tray_01.',
      "The tablet's path is blocked by tray_01 and plate_02.",
      'Not in a basket or the tub once the baskets are in (will not be washed): spoon_01.',
      'On the tub floor, or standing on it through a basket: spoon_01.',
    ]);
    // What reaches out of a basket and what shifted are facts, not warnings: the problems
    // they cause, if any, are the lines above.
    expect(lines.filter((l) => l.level === 'warn')).toEqual([]);
    expect(lines.filter((l) => l.level === 'info').map((l) => l.text)).toEqual([
      'plate_01 stands 12.2 mm above the height that is clear over lower_rack and touches nothing outside the basket.',
      'Shifted when the baskets went in: mug_01 (2 mm, 0°).',
    ]);
  });

  it('says in plain words what a piece that leans out of a basket did when the basket went in', () => {
    // Found in play on 11 October 2026: a chopping board on edge along the side of the lower basket,
    // leaning out, read "board_01 sticks 7.7 mm out of lower_rack" in amber although the
    // basket slid in with it.
    const lines = describeLoadCheck({
      ...clear,
      protruding: [
        { item_id: 'board_01', rack: 'lower_rack', beyond_mm: 7.7, over: 'left', touching: [] },
        {
          item_id: 'board_02',
          rack: 'lower_rack',
          beyond_mm: 10.5,
          over: 'right',
          touching: ['tub.wall'],
        },
        { item_id: 'tray_01', rack: 'lower_rack', beyond_mm: 3, over: 'front', touching: ['door'] },
      ],
      shifted: [
        { item_id: 'board_01', displacement_mm: 2.4, rotation_deg: 0.7 },
        { item_id: 'board_02', displacement_mm: 6.8, rotation_deg: 2.1, pushed_by: ['tub.wall'] },
        { item_id: 'tray_01', displacement_mm: 4, rotation_deg: 0.2, pushed_by: ['door'] },
      ],
    });
    expect(lines.filter((l) => l.level === 'warn' || l.level === 'bad')).toEqual([]);
    expect(lines.filter((l) => l.level === 'info').map((l) => l.text)).toEqual([
      'board_01 leans 7.7 mm out over the left side of lower_rack and touches nothing outside the basket.',
      'board_02 leans 10.5 mm out over the right side of lower_rack and rests against the wall of the tub.',
      'tray_01 reaches 3 mm out over the front of lower_rack and rests against the door.',
      'The wall of the tub pushed board_02 in as the baskets went in (6.8 mm, 2.1°).',
      'The door pushed tray_01 in as the baskets went in (4 mm, 0.2°).',
      'Shifted when the baskets went in: board_01 (2.4 mm, 0.7°).',
    ]);
  });

  it('says that a basket is in the way when the door is blocked by nothing in the load', () => {
    const lines = describeLoadCheck({ ...clear, door_closes: false });
    expect(lines.find((l) => l.level === 'bad')?.text).toBe(
      'The door does not close while a basket is not in.',
    );
  });
});

describe('budgets and small formats', () => {
  it('shows used over allowed and how full each budget is', () => {
    expect(describeBudget(state.budget)).toEqual([
      { label: 'Actions', text: '48 / 60', fraction: 0.8 },
      { label: 'Queries', text: '300 / 300', fraction: 1 },
      { label: 'Washes', text: '0 / 1', fraction: 0 },
    ]);
  });

  it('formats lists, numbers, clocks and phase names', () => {
    expect(listOf([])).toBe('');
    expect(listOf(['a'])).toBe('a');
    expect(listOf(['a', 'b', 'c'])).toBe('a, b and c');
    expect(tidy(12.25)).toBe('12.3');
    expect(tidy(3)).toBe('3');
    expect(clock(8700)).toBe('2:25:00');
    expect(clock(245)).toBe('4:05');
    expect(clock(-5)).toBe('0:00');
    expect(phaseTitle('intermediate_rinse')).toBe('Intermediate rinse');
  });
});

describe('estimates and difficulty in words', () => {
  it('says how long a wash takes the way a person would', () => {
    expect(aboutDuration(26)).toBe('under a minute');
    expect(aboutDuration(60)).toBe('about a minute');
    expect(aboutDuration(172)).toBe('about 3 minutes');
    expect(aboutDuration(1500)).toBe('about 25 minutes');
    expect(aboutDuration(Number.NaN)).toBe('a while');
    // Timed on this machine: minutes. From another machine's figures: words only.
    expect(washTimeText({ tier: 'official', seconds: 398, basis: 'history' })).toBe(
      'about 7 minutes',
    );
    expect(washTimeText({ tier: 'official', seconds: 83, basis: 'built-in' })).toMatch(
      /several minutes/,
    );
    expect(washTimeText({ tier: 'fast', seconds: 12, basis: 'built-in' })).toBe('a minute or so');
  });

  it('words the difficulty of a level when its listing carries one', () => {
    expect(difficultyText(2)).toBe('difficulty 2');
    expect(difficultyText(3.25)).toBe('difficulty 3.3');
    expect(difficultyText('hard')).toBe('hard');
    expect(difficultyText(undefined)).toBeNull();
    expect(difficultyText('  ')).toBeNull();
  });
});

describe('the names of basket options on the page', () => {
  it('are words, not the ids the level card gives', async () => {
    const { optionLabel, optionValueLabel } = await import('./format.ts');
    expect(optionLabel('position')).toBe('position');
    expect(optionLabel('height')).toBe('height');
    expect(optionLabel('tine_row_r1')).toBe('tine row R1');
    expect(optionLabel('tine_row_c_rear')).toBe('tine row C, rear');
    expect(optionLabel('shelf_cup_front')).toBe('cup shelf, front');
    expect(optionLabel('shelf_knife_shelf')).toBe('knife shelf');
    expect(optionValueLabel('front_centre')).toBe('front centre');
    expect(optionValueLabel('out')).toBe('out');
  });
});
