import { describe, expect, it } from 'vitest';
import {
  basketHeightPosition,
  basketOrigin,
  branchStaticLift,
  defaultsAsConfig,
  getBasket,
  getBranch,
  getDiverterPosition,
  getNozzle,
  getSprayArm,
  getSprayLevel,
  getTineRow,
  isTineRowFolded,
  shelfState,
  sprayLevelDatumZ,
  validateMachineConfig,
} from './config.ts';
import { tabletDrop } from './dispenser.ts';
import {
  BOSCH_SMV4HAX40G as B,
  findMachine,
  findProgramme,
  MACHINES,
  PRIMARY_MACHINE,
  primaryProgramme,
} from './machines.ts';
import { errorsOf } from './problems.ts';
import { expectNear, must, toMm } from './test-util.ts';
import type { MachineConfig } from './types.ts';

describe('the machine registry', () => {
  it('carries the Bosch as the one machine, with Eco 50 as its one programme', () => {
    expect(MACHINES.map((m) => m.id)).toEqual(['bosch_smv4hax40g']);
    expect(PRIMARY_MACHINE).toBe(B);
    expect(findMachine('bosch_smv4hax40g')).toBe(B);
    expect(findMachine('nope')).toBeUndefined();
    expect(primaryProgramme(B).id).toBe('eco_50');
    expect(B.programmes.map((p) => p.id)).toEqual(['eco_50']);
    expect(findProgramme(B, 'eco_50')?.name).toBe('Eco 50');
    expect(findProgramme(B, 'nope')).toBeUndefined();
    expect(() => primaryProgramme({ ...B, primaryProgramme: 'nope' })).toThrow(RangeError);
  });
});

describe('lookups', () => {
  it('find what the machine has and throw a RangeError for what it has not', () => {
    expect(getBasket(B, 'upper').id).toBe('upper');
    expect(getSprayLevel(B, 'roof').kind).toBe('fixed');
    expect(getSprayArm(B, 'lower').kind).toBe('arm');
    expect(getNozzle(getSprayLevel(B, 'lower'), 'l7').label).toBe('L7');
    expect(getBranch(B, 'upper').staticLift).toBe(0.43);
    expect(getDiverterPosition(B, 'ur').feeds).toEqual(['upper', 'roof']);
    expect(getTineRow(getBasket(B, 'lower'), 'fr').label).toBe('FR');
    expect(() => getBasket(B, 'third')).toThrow(RangeError);
    expect(() => getSprayLevel(B, 'mid')).toThrow(RangeError);
    expect(() => getSprayArm(B, 'roof')).toThrow(RangeError);
    expect(() => getNozzle(getSprayLevel(B, 'lower'), 'u1')).toThrow(RangeError);
    expect(() => getBranch(B, 'top')).toThrow(RangeError);
    expect(() => getDiverterPosition(B, 'a')).toThrow(RangeError);
    expect(() => getTineRow(getBasket(B, 'upper'), 'r1')).toThrow(RangeError);
  });
});

describe('applying a configuration', () => {
  const level = (id: string): MachineConfig => ({
    ...B.defaultConfig,
    basketHeights: { upper: id },
  });

  it('places each rack frame in the tub frame', () => {
    // Lower basket: 525 x 512 mm, centred 6 mm in front of the lower-arm axis, grid top at 73 mm:
    // the owner's 15 mm above the lower arm (50 mm) is the underside of the lowest floor wires
    // (65 / 67 / 69 mm), and the cross wires whose top is the grid top lie one 4 mm wire higher.
    const lower = basketOrigin(B, 'lower');
    expectNear(toMm(lower[0]), -262.5, 1e-9);
    expectNear(toMm(lower[1]), -6 - 256, 1e-9);
    expectNear(toMm(lower[2]), 50 + 15 + 4 + 4, 1e-9);
    // Upper basket at level 2: floor wire tops at 395 mm (owner update 4.3; the dossier had 385).
    const upper = basketOrigin(B, 'upper', level('2'));
    expectNear(toMm(upper[0]), -244, 1e-9);
    expectNear(toMm(upper[1]), -258, 1e-9);
    expectNear(toMm(upper[2]), 395, 1e-9);
    // A point of the rack frame maps to the tub frame by adding the origin: the rail of R1 is
    // 167 mm behind the basket centre, which is 6 mm in front of the arm axis.
    const r1 = getTineRow(getBasket(B, 'lower'), 'r1');
    expectNear(toMm(lower[1] + r1.railAt), 161, 1e-9);
  });

  it('resolves the height position: configured, else the default, else the first', () => {
    expect(basketHeightPosition(B, 'upper', { upper: '3' }).id).toBe('3');
    expect(basketHeightPosition(B, 'upper', {}).id).toBe('1');
    expect(basketHeightPosition(B, 'lower', {}).id).toBe('fixed');
    expect(() => basketHeightPosition(B, 'upper', { upper: '4' })).toThrow(RangeError);
  });

  it('moves a carried spray level and its static lift with the basket', () => {
    const upper = getSprayLevel(B, 'upper');
    expect(sprayLevelDatumZ(B, getSprayLevel(B, 'lower'))).toBe(0);
    // Owner update 4.3: the upper basket's floor at 420 / 395 / 370 mm (the dossier: 410 / 385 / 360).
    expectNear(sprayLevelDatumZ(B, upper, { upper: '3' }), 0.37, 1e-12);
    expectNear(sprayLevelDatumZ(B, upper), 0.42, 1e-12);
    const branch = getBranch(B, 'upper');
    expectNear(branchStaticLift(B, branch, { upper: '2' }), 0.43, 1e-12);
    expectNear(branchStaticLift(B, branch, { upper: '3' }), 0.405, 1e-12);
    expectNear(branchStaticLift(B, branch), 0.455, 1e-12);
    // The roof branch does not move with the basket: 0.69 m under the measured roof.
    expect(branchStaticLift(B, getBranch(B, 'roof'), { upper: '3' })).toBe(0.69);
  });

  it('reads rows and shelves from the configuration, defaults otherwise', () => {
    expect(isTineRowFolded(B, B.defaultConfig, 'lower', 'r1')).toBe(false);
    const folded: MachineConfig = {
      ...B.defaultConfig,
      foldedTineRows: [
        { basketId: 'lower', rowId: 'r1' },
        { basketId: 'lower', rowId: 'ml' },
      ],
    };
    expect(isTineRowFolded(B, folded, 'lower', 'r1')).toBe(true);
    expect(isTineRowFolded(B, folded, 'lower', 'r2')).toBe(false);
    // A fixed row is never folded, whatever the configuration says.
    expect(isTineRowFolded(B, folded, 'lower', 'ml')).toBe(false);
    expect(shelfState(B, B.defaultConfig, 'upper', 'cup_rear')).toBe('up');
    expect(
      shelfState(
        B,
        {
          ...B.defaultConfig,
          shelves: [{ basketId: 'upper', shelfId: 'cup_rear', state: 'down' }],
        },
        'upper',
        'cup_rear',
      ),
    ).toBe('down');
    expect(shelfState(B, { ...B.defaultConfig, shelves: [] }, 'upper', 'knife_shelf')).toBe('down');
    expect(() => shelfState(B, B.defaultConfig, 'upper', 'nope')).toThrow(RangeError);
  });

  it('the default configuration is the one the default states imply', () => {
    for (const machine of MACHINES)
      expect(defaultsAsConfig(machine)).toEqual(machine.defaultConfig);
  });

  it('drops the tablet further at a lower Rackmatic level', () => {
    const heights = (['1', '2', '3'] as const).map((id) => tabletDrop(B, level(id)).height);
    expectNear(must(heights[1]) - must(heights[0]), 0.025, 1e-12);
    expectNear(must(heights[2]) - must(heights[1]), 0.025, 1e-12);
    expect(tabletDrop(B).basketId).toBe('upper');
  });
});

describe('validateMachineConfig', () => {
  it('accepts the default configuration of each machine', () => {
    for (const machine of MACHINES)
      expect(validateMachineConfig(machine, machine.defaultConfig)).toEqual([]);
  });

  it('accepts what a player may set', () => {
    const config: MachineConfig = {
      basketHeights: { upper: '3' },
      foldedTineRows: [
        { basketId: 'lower', rowId: 'r1' },
        { basketId: 'lower', rowId: 'r2' },
        { basketId: 'upper', rowId: 'c_front' },
      ],
      shelves: [
        { basketId: 'upper', shelfId: 'cup_front', state: 'down' },
        { basketId: 'upper', shelfId: 'knife_shelf', state: 'up' },
      ],
      cutleryBasket: { basketId: 'lower', centre: [0.15, 0.123], longAxis: 'y' },
    };
    expect(validateMachineConfig(B, config)).toEqual([]);
    expect(validateMachineConfig(B, { ...config, cutleryBasket: null })).toEqual([]);
  });

  // [what is wrong, the configuration, the code expected].
  const bad: readonly (readonly [string, MachineConfig, string])[] = [
    [
      'a basket the machine has not',
      { ...B.defaultConfig, basketHeights: { third: '1' } },
      'config_unknown_basket',
    ],
    [
      'a height position the basket has not',
      { ...B.defaultConfig, basketHeights: { upper: '4' } },
      'config_unknown_height_position',
    ],
    [
      'a tine row the basket has not',
      { ...B.defaultConfig, foldedTineRows: [{ basketId: 'lower', rowId: 'r3' }] },
      'config_unknown_tine_row',
    ],
    [
      'a fixed row folded',
      { ...B.defaultConfig, foldedTineRows: [{ basketId: 'lower', rowId: 'ml' }] },
      'config_row_not_hinged',
    ],
    [
      'a row listed twice',
      {
        ...B.defaultConfig,
        foldedTineRows: [
          { basketId: 'lower', rowId: 'r1' },
          { basketId: 'lower', rowId: 'r1' },
        ],
      },
      'config_duplicate',
    ],
    [
      'a shelf the basket has not',
      { ...B.defaultConfig, shelves: [{ basketId: 'upper', shelfId: 'cup_left', state: 'up' }] },
      'config_unknown_shelf',
    ],
    [
      'a shelf in a basket the machine has not',
      { ...B.defaultConfig, shelves: [{ basketId: 'third', shelfId: 'cup_front', state: 'up' }] },
      'config_unknown_basket',
    ],
    [
      'the cutlery basket hanging over the rim',
      {
        ...B.defaultConfig,
        cutleryBasket: { basketId: 'lower', centre: [0.03, 0.2], longAxis: 'y' },
      },
      'config_cutlery_basket_outside',
    ],
    [
      'the cutlery basket too far back when turned',
      {
        ...B.defaultConfig,
        cutleryBasket: { basketId: 'lower', centre: [0.1, 0.48], longAxis: 'x' },
      },
      'config_cutlery_basket_outside',
    ],
    [
      'the cutlery basket in a basket the machine has not',
      {
        ...B.defaultConfig,
        cutleryBasket: { basketId: 'third', centre: [0.1, 0.1], longAxis: 'y' },
      },
      'config_unknown_basket',
    ],
  ];

  it.each(bad)('rejects %s', (_what, config, code) => {
    const problems = validateMachineConfig(B, config);
    expect(errorsOf(problems).map((p) => p.code)).toContain(code);
  });

  it('rejects a cutlery basket on a machine that has none', () => {
    const none = { ...B, cutleryBasket: null };
    const problems = validateMachineConfig(none, B.defaultConfig);
    expect(problems.map((p) => p.code)).toEqual(['config_no_cutlery_basket']);
  });
});
