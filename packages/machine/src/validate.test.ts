import { describe, expect, it } from 'vitest';
import { BOSCH_SMV4HAX40G, MACHINE_VARIANTS, MACHINES, SPOT_60 } from './machines.ts';
import { errorsOf } from './problems.ts';
import type { Mutable } from './test-util.ts';
import { must, mutableCopy } from './test-util.ts';
import type { BasketSpec, MachineSpec, SprayArmSpec } from './types.ts';
import { validateMachineSpec } from './validate.ts';

type Spec = Mutable<MachineSpec>;

function basket(spec: Spec, id: string): Mutable<BasketSpec> {
  return must(
    spec.baskets.find((b) => b.id === id),
    `basket ${id}`,
  );
}

function arm(spec: Spec, id: string): Mutable<SprayArmSpec> {
  const level = must(
    spec.sprayLevels.find((l) => l.id === id),
    `spray level ${id}`,
  );
  if (level.kind !== 'arm') throw new Error(`${id} is not an arm`);
  return level;
}

function programme(spec: Spec, id: string) {
  return must(
    spec.programmes.find((p) => p.id === id),
    `programme ${id}`,
  );
}

/** The codes of the problems of a copy of `base` damaged by `damage`. */
function codesAfter(base: MachineSpec, damage: (spec: Spec) => void): string[] {
  const copy = mutableCopy(base);
  damage(copy);
  return validateMachineSpec(copy).map((p) => p.code);
}

/**
 * What the validator has to say about SPOT-60: three warnings, each a disagreement of the
 * generic dossier with itself that this package carries rather than hides (machine.md 3.3:
 * the top arm at "about 60 rpm", where its own parameters give 44; 12.1 against 7.3: baths of
 * 3.8 and 2.9 L in the specification block, 3.4 and 3.0 L in the programme table).
 */
const SPOT_60_WARNINGS: readonly (readonly [string, string])[] = [
  ['arm_speed_off_design', 'sprayLevels.top.designSpeed'],
  ['bath_volume_differs', 'hydraulics.fill.firstBathVolume'],
  ['bath_volume_differs', 'hydraulics.fill.laterBathVolume'],
];

describe('validateMachineSpec on the shipped machines', () => {
  it("the owner's Bosch has no problems at all", () => {
    expect(validateMachineSpec(BOSCH_SMV4HAX40G)).toEqual([]);
  });

  it('SPOT-60 has no errors, and three warnings where the generic dossier disagrees with itself', () => {
    const problems = validateMachineSpec(SPOT_60);
    expect(errorsOf(problems)).toEqual([]);
    expect(problems.map((p) => [p.code, p.path])).toEqual(SPOT_60_WARNINGS);
    expect(problems.every((p) => p.severity === 'warning')).toBe(true);
    // The top arm: 44 rpm by the torque balance against a design speed of 60 rpm.
    expect(must(problems[0]).message).toMatch(/44\.0 rpm .* 60\.0 rpm/);
    expect(MACHINES).toHaveLength(2);
  });

  it('the named alternative of the Bosch (4.5 mm lower-arm bores) has no problems either', () => {
    expect(MACHINE_VARIANTS.map((m) => m.id)).toEqual(['bosch_smv4hax40g_drill_bore']);
    for (const spec of MACHINE_VARIANTS) expect(validateMachineSpec(spec)).toEqual([]);
  });

  it('the stack the owner measured touches nothing: the clearances it leaves', () => {
    // Owner update 4.3, heights above the filter plate in mm. Nothing that the estimated stack
    // kept apart is brought into contact by the measured one; these are the smallest gaps.
    const B = BOSCH_SMV4HAX40G;
    expect(validateMachineSpec(B)).toEqual([]);
    const mm = (m: number) => m * 1000;
    const lowerArm = must(B.sprayLevels.find((l) => l.id === 'lower'));
    const upperArm = must(B.sprayLevels.find((l) => l.id === 'upper'));
    const roof = must(B.sprayLevels.find((l) => l.id === 'roof'));
    if (lowerArm.kind !== 'arm' || upperArm.kind !== 'arm' || roof.kind !== 'fixed') {
      throw new Error('unexpected spray levels');
    }
    const lower = must(B.baskets.find((b) => b.id === 'lower'));
    const upper = must(B.baskets.find((b) => b.id === 'upper'));
    const lowerZ = must(lower.pose.heightPositions[0]).originZ;
    // Lower arm (top face 50, hoods 4 to 5 mm high) under the lower basket: the lowest floor
    // wires, the front-back ones, have their undersides at 65 mm, the owner's 15 mm above the
    // arm's top face; the cross wires lie one wire higher.
    const lowestWire =
      lowerZ + Math.min(lower.floor.alongX.z, lower.floor.alongY.z) - lower.wires.floor.coated / 2;
    expect(mm(lowestWire - lowerArm.topFaceZ)).toBeCloseTo(15, 6);
    // Upper arm over the lower basket, at the lowest Rackmatic level: the hub at 315 mm is 22 mm
    // above the handle of the cutlery basket (73 + 220 = 293 mm).
    const level3 = must(upper.pose.heightPositions.find((p) => p.id === '3')).originZ;
    const handleTop = lowerZ + must(B.cutleryBasket).heightWithHandle;
    expect(mm(level3 + upperArm.hubUndersideZ - handleTop)).toBeCloseTo(22, 6);
    // Upper basket under the roof spinner, at the highest level: its walls end at 540 mm, 70 mm
    // under the rotor at 610 mm and 100 mm under the roof at 640 mm.
    const level1 = must(upper.pose.heightPositions.find((p) => p.id === '1')).originZ;
    const wallTop = level1 + Math.max(...upper.walls.flatMap((w) => w.horizontalWireZ));
    expect(mm(roof.lowerFaceZ - wallTop)).toBeCloseTo(70, 6);
    expect(mm(B.tub.z[1] - wallTop)).toBeCloseTo(100, 6);
    // The feed duct ends at the roof.
    expect(mm(must(B.feedDuct).topZ)).toBeCloseTo(640, 6);
  });

  it('a copy that has been through JSON validates the same', () => {
    for (const spec of MACHINES) {
      expect(validateMachineSpec(JSON.parse(JSON.stringify(spec)) as MachineSpec)).toEqual(
        validateMachineSpec(spec),
      );
    }
  });
});

describe('validateMachineSpec finds geometry that cannot be', () => {
  // [what is wrong, how the Bosch is damaged, a code the validator must report].
  const cases: readonly (readonly [string, (spec: Spec) => void, string])[] = [
    [
      "the lower basket centred on the arm axis, as the dossier's block has it: 6 mm inside the riser",
      (s) => {
        basket(s, 'lower').pose.originXY[1] += 0.006;
      },
      'basket_hits_feed_duct',
    ],
    [
      'the lower basket 30 mm to the left: through the left wall',
      (s) => {
        basket(s, 'lower').pose.originXY[0] -= 0.03;
      },
      'basket_outside_tub',
    ],
    [
      'the lower basket 20 mm forward: through the door liner',
      (s) => {
        basket(s, 'lower').pose.originXY[1] -= 0.02;
      },
      'basket_outside_tub',
    ],
    [
      "the upper basket's top position 300 mm higher: through the roof",
      (s) => {
        must(basket(s, 'upper').pose.heightPositions[0]).originZ += 0.3;
      },
      'basket_outside_tub',
    ],
    [
      "the upper basket's lowest position at 200 mm: inside the lower basket",
      (s) => {
        must(basket(s, 'upper').pose.heightPositions[2]).originZ = 0.2;
      },
      'baskets_overlap',
    ],
    [
      "the upper basket's lowest position at 300 mm: its arm sweeps through the cutlery basket's handle",
      (s) => {
        must(basket(s, 'upper').pose.heightPositions[2]).originZ = 0.3;
      },
      'arm_hits_basket',
    ],
    [
      'the lower arm 20 mm higher: into the floor of the lower basket',
      (s) => {
        const a = arm(s, 'lower');
        a.topFaceZ = 0.07;
        a.nozzleUpZ = 0.072;
      },
      'arm_hits_basket',
    ],
    [
      "the upper arm only 5 mm below its basket's floor wires",
      (s) => {
        const a = arm(s, 'upper');
        a.topFaceZ = -0.005;
        a.nozzleUpZ = -0.005;
      },
      'arm_hits_basket',
    ],
    [
      'a 260 mm upper arm: through the door liner',
      (s) => {
        arm(s, 'upper').tipRadius = 0.26;
      },
      'arm_outside_tub',
    ],
    [
      'a 280 mm lower arm: through the side walls',
      (s) => {
        arm(s, 'lower').tipRadius = 0.28;
      },
      'arm_outside_tub',
    ],
    [
      'the upper arm 50 mm further back: into the docking ports of the feed duct',
      (s) => {
        arm(s, 'upper').axis[1] = 0.02;
      },
      'arm_hits_feed_duct',
    ],
    [
      'a salt cap 40 mm high under the lower arm, whose underside is at 36 mm',
      (s) => {
        must(s.saltCap).topZ = 0.04;
      },
      'fixture_under_arm',
    ],
    [
      'a filter crown 36 mm high',
      (s) => {
        s.filter.coarse.crownTopZ = 0.036;
      },
      'fixture_under_arm',
    ],
    [
      "a feed duct that ends above the roof (the dossier's 680 mm from stub ends at the filter plate)",
      (s) => {
        must(s.feedDuct).topZ = 0.68;
      },
      'duct_above_roof',
    ],
    [
      'a nozzle beyond the tip of its arm',
      (s) => {
        must(arm(s, 'lower').nozzles.find((n) => n.id === 'l9')).radius = 0.24;
      },
      'nozzle_beyond_arm',
    ],
    [
      'a top-face nozzle pointing down',
      (s) => {
        must(arm(s, 'lower').nozzles.find((n) => n.id === 'l5')).rho = -1;
      },
      'nozzle_face_direction',
    ],
    [
      'a downward nozzle on an upper arm that is given no lower nozzle plane',
      (s) => {
        // The measured arm has one underside hole, U8, and a plane for it; take the plane away.
        arm(s, 'upper').nozzleDownZ = null;
      },
      'nozzle_plane_missing',
    ],
    [
      'a tine outside its basket',
      (s) => {
        must(basket(s, 'lower').tineRows.find((r) => r.id === 'r1')).tinePositions[22] = 0.6;
      },
      'tine_outside_basket',
    ],
    [
      'a tine row with one lean direction too few',
      (s) => {
        must(basket(s, 'lower').tineRows.find((r) => r.id === 'ml')).leanToward.pop();
      },
      'tine_row_bad_lean',
    ],
    [
      'a fixed row folded by default',
      (s) => {
        must(basket(s, 'lower').tineRows.find((r) => r.id === 'fl')).defaultState = 'folded';
      },
      'fixed_row_folded',
    ],
    [
      'a floor wire outside its basket',
      (s) => {
        basket(s, 'upper').floor.alongY.positions[7] = 0.52;
      },
      'floor_wire_outside_basket',
    ],
    [
      'a tub with its roof below its floor',
      (s) => {
        s.tub.z = [0.675, 0];
      },
      'tub_bad_extent',
    ],
    [
      'a door liner behind the flange plane',
      (s) => {
        s.door.linerPlaneY = -0.2;
      },
      'door_liner_inside_tub',
    ],
    [
      'a detergent chamber that is not on the door liner',
      (s) => {
        s.dispenser.chamberCentre[1] = -0.235;
      },
      'dispenser_off_liner',
    ],
    [
      "a tablet tray whose rim is above the chamber's lip",
      (s) => {
        must(basket(s, 'upper').tabletTray).rimZ = 0.1;
      },
      'tablet_tray_above_chamber',
    ],
    [
      'a dispenser that drops its tablet into a tray the basket has not',
      (s) => {
        basket(s, 'upper').tabletTray = null;
      },
      'tablet_target_missing',
    ],
    [
      'an upper arm hanging under a basket the machine has not',
      (s) => {
        arm(s, 'upper').mount = { kind: 'basket', basketId: 'third' };
      },
      'level_unknown_basket',
    ],
  ];

  it.each(cases)('%s', (_what, damage, code) => {
    const copy = mutableCopy(BOSCH_SMV4HAX40G);
    damage(copy);
    const problems = validateMachineSpec(copy);
    expect(errorsOf(problems).map((p) => p.code)).toContain(code);
  });

  it('says where and by how much', () => {
    const copy = mutableCopy(BOSCH_SMV4HAX40G);
    basket(copy, 'lower').pose.originXY[1] += 0.006;
    const problem = must(validateMachineSpec(copy).find((p) => p.code === 'basket_hits_feed_duct'));
    expect(problem.path).toBe('baskets.lower.pose.originXY');
    expect(problem.severity).toBe('error');
    // The riser's face is at 265 - 21 = 244 mm; the recessed rear rim would be at 250 mm.
    expect(problem.message).toContain('244.0');
    expect(problem.message).toContain('250.0');
  });

  it('reports once what does not depend on the basket heights, and per position what does', () => {
    // The salt cap stands under the lower arm whatever the level of the upper basket.
    const cap = mutableCopy(BOSCH_SMV4HAX40G);
    must(cap.saltCap).topZ = 0.04;
    const capProblems = validateMachineSpec(cap);
    expect(capProblems.map((p) => p.code)).toEqual(['fixture_under_arm']);
    expect(must(capProblems[0]).message).not.toContain('position');

    // The upper arm travels with its basket: three Rackmatic levels, three collisions, 25 mm apart.
    const low = mutableCopy(BOSCH_SMV4HAX40G);
    arm(low, 'upper').topFaceZ = -0.005;
    arm(low, 'upper').nozzleUpZ = -0.005;
    const lowProblems = validateMachineSpec(low);
    expect(lowProblems.map((p) => p.code)).toEqual([
      'arm_hits_basket',
      'arm_hits_basket',
      'arm_hits_basket',
    ]);
    expect(lowProblems.map((p) => /at position "(\d)"/.exec(p.message)?.[1])).toEqual([
      '1',
      '2',
      '3',
    ]);
    expect(lowProblems.map((p) => /\(z = [\d.]+ to ([\d.]+) mm\)/.exec(p.message)?.[1])).toEqual([
      // 5 mm below the floor wire tops the owner measured: 420 / 395 / 370 mm.
      '415.0',
      '390.0',
      '365.0',
    ]);

    // Only the lowest level brings the upper arm down onto the handle of the cutlery basket.
    const deep = mutableCopy(BOSCH_SMV4HAX40G);
    must(basket(deep, 'upper').pose.heightPositions[2]).originZ = 0.3;
    const deepProblems = validateMachineSpec(deep);
    expect(deepProblems.map((p) => p.code)).toEqual(['arm_hits_basket']);
    expect(must(deepProblems[0]).message).toContain('the cutlery basket');
    expect(must(deepProblems[0]).message).toContain('at position "3"');
  });

  it('checks SPOT-60 the same way', () => {
    expect(
      codesAfter(SPOT_60, (s) => {
        // The mid arm's nozzle plane inside the upper rack's base grid.
        arm(s, 'mid').nozzleUpZ = -0.004;
        arm(s, 'mid').topFaceZ = -0.004;
      }),
    ).toContain('arm_hits_basket');
    expect(
      codesAfter(SPOT_60, (s) => {
        // The cutlery tray 100 mm higher: through the roof.
        must(basket(s, 'third').pose.heightPositions[0]).originZ += 0.1;
      }),
    ).toContain('basket_outside_tub');
    expect(
      codesAfter(SPOT_60, (s) => {
        // The top arm lowered into the tray's floor.
        const top = arm(s, 'top');
        top.nozzleDownZ = 0.59;
        top.bladeUndersideZ = 0.59;
        top.hubUndersideZ = 0.59;
        top.topFaceZ = 0.6;
      }),
    ).toContain('arm_hits_basket');
  });
});

describe('validateMachineSpec finds hydraulics and thermal data that cannot be', () => {
  const cases: readonly (readonly [string, (spec: Spec) => void, string])[] = [
    [
      'a pump with no shut-off head',
      (s) => void (s.hydraulics.pump.shutOffHead = 0),
      'pump_bad_curve',
    ],
    [
      'a pump with a negative curve coefficient',
      (s) => void (s.hydraulics.pump.curveCoefficient = -1),
      'pump_bad_curve',
    ],
    [
      'a motor efficiency above 1',
      (s) => void (s.hydraulics.pump.motorEfficiency = 1.2),
      'pump_bad_curve',
    ],
    [
      'an inlet valve that passes nothing',
      (s) => void (s.hydraulics.fill.inletFlow = 0),
      'non_positive_flow',
    ],
    [
      'a drain pump that pumps backwards',
      (s) => void (s.hydraulics.drain.flow = -1e-4),
      'non_positive_flow',
    ],
    [
      "an upper branch lifted 5 m, above the pump's 4 m shut-off head",
      (s) => void (must(s.hydraulics.branches.find((b) => b.id === 'upper')).staticLift = 5),
      'non_positive_flow',
    ],
    [
      'a nozzle with no area',
      (s) => void (must(arm(s, 'lower').nozzles.find((n) => n.id === 'l1')).area = 0),
      'nozzle_bad_area',
    ],
    [
      'a discharge coefficient above 1',
      (s) => void (must(arm(s, 'lower').nozzles.find((n) => n.id === 'l1')).cd = 1.4),
      'nozzle_bad_coefficient',
    ],
    [
      'a branch whose stated C_d A is not what its nozzles add up to',
      (s) => void (must(s.hydraulics.branches.find((b) => b.id === 'lower')).statedCdA = 61.2e-6),
      'cda_mismatch',
    ],
    [
      'a nozzle table that turns the arm against its declared sense',
      (s) => {
        for (const n of arm(s, 'lower').nozzles) if (n.drives) n.theta = -n.theta;
      },
      'arm_drive_reversed',
    ],
    [
      'an upper arm whose slots are cut square: nothing drives it',
      (s) => {
        for (const n of arm(s, 'upper').nozzles) {
          if (n.drives) {
            n.rho = (88 * Math.PI) / 180;
            n.theta = 0;
            n.drives = false;
          }
        }
      },
      'arm_does_not_turn',
    ],
    [
      'a nozzle marked as driving whose jet is radial',
      (s) => void (must(arm(s, 'lower').nozzles.find((n) => n.id === 'l9')).drives = true),
      'drive_flag_inconsistent',
    ],
    [
      'a diverter position that feeds a branch the machine has not',
      (s) =>
        void must(s.hydraulics.diverter.positions.find((p) => p.id === 'ur')).feeds.push('third'),
      'diverter_unknown_branch',
    ],
    [
      'a spray level without a branch',
      (s) => void (s.hydraulics.branches = s.hydraulics.branches.filter((b) => b.id !== 'roof')),
      'level_without_branch',
    ],
    [
      'a default diverter pattern that names a position the machine has not',
      (s) => void (must(s.hydraulics.diverter.defaultPattern.phases[1]).position = 'u2'),
      'pattern_unknown_position',
    ],
    [
      'a pre-store tank that is not the heat exchanger',
      (s) => void (s.hydraulics.fill.prestoreVolume = 2.0e-3),
      'prestore_tank_mismatch',
    ],
    ['a heater of no power', (s) => void (s.thermal.heaterPower = 0), 'thermal_bad_value'],
    ['a heater duty of 1.5', (s) => void (s.thermal.heaterDuty = 1.5), 'thermal_bad_value'],
    [
      'a machine of no heat capacity',
      (s) => void (s.thermal.machineHeatCapacity = 0),
      'thermal_bad_value',
    ],
    [
      'a minimum sump volume of zero',
      (s) => void (s.hydraulics.inventory.minSumpVolume = 0),
      'inventory_bad_value',
    ],
  ];

  it.each(cases)('%s', (_what, damage, code) => {
    expect(codesAfter(BOSCH_SMV4HAX40G, damage)).toContain(code);
  });
});

describe('validateMachineSpec finds programmes that do not add up', () => {
  const hold = (s: Spec) => {
    const step = must(programme(s, 'auto_145').steps.find((x) => x.id === 'a5_hold'));
    if (step.kind !== 'hold') throw new Error('not a hold');
    return step;
  };
  /** The first phase of the pattern of the intermediate rinse, a step that fixes its own. */
  const rinsePhase = (s: Spec) => {
    const step = must(programme(s, 'auto_145').steps.find((x) => x.id === 'a7_rinse'));
    if (step.kind !== 'circulate' || step.diverter === null) throw new Error('no pattern');
    return must(step.diverter.phases[0]);
  };
  const moveStep = (s: Spec, id: string, afterId: string, phase?: 'final_rinse') => {
    const p = programme(s, 'auto_145');
    const step = must(p.steps.find((x) => x.id === id));
    if (phase !== undefined) step.phase = phase;
    p.steps = p.steps.filter((x) => x !== step);
    p.steps.splice(p.steps.findIndex((x) => x.id === afterId) + 1, 0, step);
  };
  const cases: readonly (readonly [string, (spec: Spec) => void, string])[] = [
    [
      'a hold 10 min longer than the declared total allows',
      (s) => void (hold(s).duration += 600),
      'programme_duration_mismatch',
    ],
    [
      'the tank not refilled for the final rinse: nothing to fill it from',
      (s) => {
        const rinse = must(programme(s, 'auto_145').steps.find((x) => x.id === 'a7_rinse'));
        if (rinse.kind !== 'circulate') throw new Error('not a circulation');
        rinse.prestoreFills = [];
      },
      'programme_prestore_underflow',
    ],
    [
      'the same, seen in the water total',
      (s) => {
        const rinse = must(programme(s, 'auto_145').steps.find((x) => x.id === 'a7_rinse'));
        if (rinse.kind !== 'circulate') throw new Error('not a circulation');
        rinse.prestoreFills = [];
      },
      'programme_water_mismatch',
    ],
    [
      '3.5 L let into the 3.1 L tank',
      (s) => void (must(hold(s).prestoreFills[0]).volume = 3.5e-3),
      'programme_prestore_overflow',
    ],
    [
      'a declared water total of 13 L for an 11.5 L programme',
      (s) => void (programme(s, 'auto_145').declared.mainsWater = 13e-3),
      'programme_water_mismatch',
    ],
    [
      'a declared energy 20 % above the model',
      (s) => void (programme(s, 'auto_145').declared.energy = 1.25 * 3.6e6),
      'programme_energy_mismatch',
    ],
    [
      'a heater too weak to reach 65 C in two hours',
      (s) => void (s.thermal.heaterPower = 150),
      'programme_heat_timeout',
    ],
    [
      'a first bath of 0.6 L: the pump runs dry',
      (s) => {
        const fill = must(programme(s, 'auto_145').steps.find((x) => x.id === 'a1_fill'));
        if (fill.kind !== 'fill') throw new Error('not a fill');
        must(fill.sources[0]).volume = 0.3e-3;
        must(fill.sources[1]).volume = 0.3e-3;
      },
      'programme_pump_starved',
    ],
    [
      'a wash without detergent',
      (s) => {
        const p = programme(s, 'auto_145');
        p.steps = p.steps.filter((x) => x.kind !== 'dose_detergent');
      },
      'programme_detergent_count',
    ],
    [
      'a programme that ends with the last bath still in the tub',
      (s) => {
        const p = programme(s, 'auto_145');
        p.steps = p.steps.filter((x) => x.id !== 'a12_drain');
      },
      'programme_ends_with_water',
    ],
    [
      'a step at a pump speed the pump cannot run at',
      (s) => void (hold(s).pumpRpm = 5000),
      'step_pump_speed_out_of_range',
    ],
    [
      'a step in a diverter position the machine has not',
      (s) => void (rinsePhase(s).position = 'x'),
      'pattern_unknown_position',
    ],
    [
      'a step that holds the diverter closed',
      (s) => void (rinsePhase(s).position = 'closed'),
      'pattern_closed_position',
    ],
    [
      'a rinse pattern that dwells 2 s where the diverter takes 2.5 s to move',
      (s) => void (rinsePhase(s).duration = 2),
      'diverter_transition_too_long',
    ],
    [
      'a wash target of 70 C on a machine whose heater goes off at 60 C',
      (s) => void (s.thermal.heaterCutOut = 60),
      'programme_target_above_cut_out',
    ],
    [
      'the detergent dosed in the final rinse (the step moved, its phase left as it was)',
      (s) => moveStep(s, 'a4_dose', 'a9_fill'),
      'step_phase_out_of_order',
    ],
    [
      'the detergent step given the phase of the final rinse',
      (s) => moveStep(s, 'a4_dose', 'a9_fill', 'final_rinse'),
      'dose_in_wrong_phase',
    ],
    [
      'the detergent armed after the last circulation of the wash: the bath is drained first',
      (s) => moveStep(s, 'a4_dose', 'a5_hold'),
      'programme_dose_not_released',
    ],
    [
      'rinse aid that waits for a temperature the final rinse never reaches',
      (s) => void (s.dosing.rinseAidMinTemperature = 72),
      'programme_dose_not_released',
    ],
    ['a negative duration', (s) => void (hold(s).duration = -5), 'step_bad_duration'],
    [
      'a heating target of 95 C',
      (s) => {
        const heat = must(programme(s, 'auto_145').steps.find((x) => x.id === 'a10_heat'));
        if (heat.kind !== 'heat') throw new Error('not a heat step');
        heat.target = 95;
      },
      'step_bad_target',
    ],
    [
      'a tank fill after the end of its step',
      (s) => void (must(hold(s).prestoreFills[0]).at = 5000),
      'step_bad_fill_time',
    ],
    [
      'two steps with one id',
      (s) => void (must(programme(s, 'auto_145').steps[3]).id = 'a2_pre_rinse'),
      'duplicate_id',
    ],
    [
      'a primary programme the machine has not',
      (s) => void (s.primaryProgramme = 'auto_200'),
      'primary_programme_missing',
    ],
    [
      'more water in the tank at the start than it holds',
      (s) => void (programme(s, 'eco_50').conditions.prestoreInitialVolume = 4e-3),
      'programme_bad_conditions',
    ],
  ];

  it.each(cases)('%s', (_what, damage, code) => {
    expect(codesAfter(BOSCH_SMV4HAX40G, damage)).toContain(code);
  });

  it('names the programme and the step', () => {
    const copy = mutableCopy(BOSCH_SMV4HAX40G);
    hold(copy).duration += 600;
    const problems = validateMachineSpec(copy);
    expect(problems).toHaveLength(1);
    const problem = must(problems[0]);
    expect(problem.path).toBe('programmes.auto_145.declared.duration');
    // Ten minutes more than the 144.9 min the programme takes, against the declared 145.0 min.
    expect(problem.message).toContain('154.9 min');
    expect(problem.message).toContain('145.0 min');
  });

  it('warns, without failing, when a programme leaves the tank emptier than it found it', () => {
    const copy = mutableCopy(BOSCH_SMV4HAX40G);
    const p = programme(copy, 'pre_rinse');
    const dry = must(p.steps.find((x) => x.kind === 'dry'));
    if (dry.kind !== 'dry') throw new Error('not a dry step');
    dry.prestoreFills = [];
    p.declared.mainsWater = 0.9e-3;
    const problems = validateMachineSpec(copy);
    expect(problems.map((x) => [x.severity, x.code])).toEqual([
      ['warning', 'programme_prestore_not_restored'],
    ]);
    expect(errorsOf(problems)).toEqual([]);
  });
});

describe('validateMachineSpec finds missing provenance, bad ids and bad defaults', () => {
  const cases: readonly (readonly [string, (spec: Spec) => void, string])[] = [
    [
      'a group without a provenance record',
      (s) => void Reflect.deleteProperty(s.tub, 'provenance'),
      'missing_provenance',
    ],
    [
      'a nozzle table without a provenance record',
      (s) => void Reflect.deleteProperty(arm(s, 'lower'), 'nozzleProvenance'),
      'missing_provenance',
    ],
    [
      'a tine row without a provenance record',
      (s) => void Reflect.deleteProperty(must(basket(s, 'upper').tineRows[2]), 'provenance'),
      'missing_provenance',
    ],
    [
      'a programme without a provenance record',
      (s) => void Reflect.deleteProperty(programme(s, 'eco_50'), 'provenance'),
      'missing_provenance',
    ],
    [
      'a provenance record without a source',
      (s) => void (s.dosing.provenance.source = '  '),
      'missing_provenance',
    ],
    [
      'a tag that is not one of the six',
      (s) => void Reflect.set(s.thermal.provenance, 'tag', 'guessed'),
      'bad_provenance_tag',
    ],
    [
      'a per-field tag that is not one of the six',
      (s) => void Reflect.set(s.sump.provenance, 'fields', { depth: 'guess' }),
      'bad_provenance_tag',
    ],
    [
      'a per-field tag for a field the group has not',
      (s) => void Reflect.set(s.sump.provenance, 'fields', { depthMm: 'generic' }),
      'provenance_unknown_field',
    ],
    [
      'a per-field tag for a nozzle field the table has not',
      (s) => void Reflect.set(arm(s, 'upper').nozzleProvenance, 'fields', { diameter: 'photo' }),
      'provenance_unknown_field',
    ],
    ['an upper-case machine id', (s) => void (s.id = 'BOSCH-SMV4HAX40G'), 'bad_id'],
    ['an upper-case nozzle id', (s) => void (must(arm(s, 'lower').nozzles[0]).id = 'L1'), 'bad_id'],
    [
      'two nozzles with one id',
      (s) => void (must(arm(s, 'lower').nozzles[1]).id = 'l1'),
      'duplicate_id',
    ],
    ['two baskets with one id', (s) => void (basket(s, 'upper').id = 'lower'), 'duplicate_id'],
    [
      'two diverter positions with one id',
      (s) => void (must(s.hydraulics.diverter.positions[1]).id = 'l'),
      'duplicate_id',
    ],
    [
      'a default height position the basket has not',
      (s) => void (s.defaultConfig.basketHeights = { upper: '9' }),
      'config_unknown_height_position',
    ],
    [
      'a default configuration that folds a fixed row',
      (s) => void s.defaultConfig.foldedTineRows.push({ basketId: 'lower', rowId: 'ml' }),
      'config_row_not_hinged',
    ],
    [
      'a default configuration that disagrees with the default state of a row',
      (s) => void s.defaultConfig.foldedTineRows.push({ basketId: 'lower', rowId: 'r1' }),
      'default_config_inconsistent',
    ],
    [
      'a default configuration that disagrees with the default state of a shelf',
      (s) => void (must(s.defaultConfig.shelves[0]).state = 'down'),
      'default_config_inconsistent',
    ],
    [
      'a cutlery basket whose default place is half outside the lower basket',
      (s) => {
        must(s.cutleryBasket).defaultPlacement.centre = [0.02, 0.123];
        must(s.defaultConfig.cutleryBasket).centre = [0.02, 0.123];
      },
      'config_cutlery_basket_outside',
    ],
    [
      'plate limits keyed by a height position the upper basket has not',
      (s) => void (must(basket(s, 'lower').limits).maxDiameterByPosition = { '4': 0.3 }),
      'limits_unknown_position',
    ],
  ];

  it.each(cases)('%s', (_what, damage, code) => {
    expect(codesAfter(BOSCH_SMV4HAX40G, damage)).toContain(code);
  });

  it('reports the path of a missing provenance record', () => {
    const copy = mutableCopy(SPOT_60);
    Reflect.deleteProperty(must(copy.hydraulics.branches[1]), 'provenance');
    const problems = validateMachineSpec(copy);
    expect(errorsOf(problems).map((p) => [p.code, p.path])).toEqual([
      ['missing_provenance', 'hydraulics.branches.mid.provenance'],
    ]);
  });
});

describe('validateMachineSpec never throws', () => {
  it('reports a problem when a whole part of the description is missing', () => {
    const keys = Object.keys(BOSCH_SMV4HAX40G).sort() as (keyof MachineSpec)[];
    for (const key of keys) {
      if (key === 'name' || key === 'description') continue;
      const copy = mutableCopy(BOSCH_SMV4HAX40G);
      Reflect.deleteProperty(copy, key);
      let problems: ReturnType<typeof validateMachineSpec> = [];
      expect(() => {
        problems = validateMachineSpec(copy);
      }, `without ${key}`).not.toThrow();
      expect(problems.length, `without ${key}`).toBeGreaterThan(0);
    }
  });

  it('tells a part the machine may lack from a part that is missing', () => {
    // SPOT-60 has no softener and no feed duct on the rear wall: null, and no problem.
    expect(SPOT_60.softener).toBeNull();
    expect(SPOT_60.feedDuct).toBeNull();
    expect(errorsOf(validateMachineSpec(SPOT_60))).toEqual([]);
    // No machine is without sensors or a thermal description.
    const withoutSensors = mutableCopy(SPOT_60);
    Reflect.set(withoutSensors, 'sensors', null);
    expect(errorsOf(validateMachineSpec(withoutSensors)).map((p) => [p.code, p.path])).toEqual([
      ['missing_group', 'sensors'],
    ]);
    // An optional part that is not there at all (not even null) is not a complete description.
    const withoutSoftener = mutableCopy(BOSCH_SMV4HAX40G);
    Reflect.deleteProperty(withoutSoftener, 'softener');
    expect(validateMachineSpec(withoutSoftener).map((p) => [p.code, p.path])).toEqual([
      ['missing_group', 'softener'],
    ]);
  });

  it('reports a problem for numbers that are not numbers', () => {
    expect(
      codesAfter(BOSCH_SMV4HAX40G, (s) => void (s.tub.x = [Number.NaN, 0.273])).length,
    ).toBeGreaterThan(0);
    expect(
      codesAfter(
        BOSCH_SMV4HAX40G,
        (s) => void (s.hydraulics.pump.ratedSpeedRpm = Number.POSITIVE_INFINITY),
      ).length,
    ).toBeGreaterThan(0);
    expect(
      codesAfter(SPOT_60, (s) => void (arm(s, 'mid').tipRadius = Number.NaN)).length,
    ).toBeGreaterThan(0);
  });
});

describe('validateMachineSpec finds values left in the wrong unit or outside any plausible range', () => {
  const deg = (radians: number) => (radians * 180) / Math.PI;
  const eachNozzle = (s: Spec, edit: (n: Mutable<SprayArmSpec>['nozzles'][number]) => void) => {
    for (const level of s.sprayLevels) for (const nozzle of level.nozzles) edit(nozzle);
  };
  const cases: readonly (readonly [string, (spec: Spec) => void, string, string])[] = [
    [
      'every nozzle elevation rho left in degrees, on all three spray levels',
      (s) => eachNozzle(s, (n) => void (n.rho = deg(n.rho))),
      'angle_out_of_range',
      'sprayLevels.lower.nozzles.l1.rho',
    ],
    [
      'every nozzle azimuth theta left in degrees',
      (s) => eachNozzle(s, (n) => void (n.theta = deg(n.theta))),
      'angle_out_of_range',
      'sprayLevels.lower.nozzles.l7.theta',
    ],
    [
      'one elevation in degrees (L8 at 45)',
      (s) => void (must(arm(s, 'lower').nozzles.find((n) => n.id === 'l8')).rho = 45),
      'angle_out_of_range',
      'sprayLevels.lower.nozzles.l8.rho',
    ],
    [
      'one azimuth in degrees (U5 at 70)',
      (s) => void (must(arm(s, 'upper').nozzles.find((n) => n.id === 'u5')).theta = 70),
      'angle_out_of_range',
      'sprayLevels.upper.nozzles.u5.theta',
    ],
    [
      'the floor slope in degrees (4)',
      (s) => void (s.tub.floorSlope = 4),
      'angle_out_of_range',
      'tub.floorSlope',
    ],
    [
      'the door opening angle in degrees (90)',
      (s) => void (s.door.openAngle = 90),
      'angle_out_of_range',
      'door.openAngle',
    ],
    [
      "the roof spinner's cone half-angle in degrees (65)",
      (s) => {
        const roof = must(s.sprayLevels.find((l) => l.id === 'roof'));
        if (roof.kind !== 'fixed') throw new Error('not a fixed sprayer');
        roof.spray.coneHalfAngle = 65;
      },
      'angle_out_of_range',
      'sprayLevels.roof.spray.coneHalfAngle',
    ],
    [
      'the fold angle of a hinged row in degrees (90)',
      (s) => {
        must(must(basket(s, 'lower').tineRows.find((r) => r.id === 'r1')).hinge).foldAngle = 90;
      },
      'angle_out_of_range',
      'baskets.lower.tineRows.r1.hinge.foldAngle',
    ],
    [
      'the height positions of the upper basket in reversed order (level 1 the lowest)',
      (s) => {
        const positions = basket(s, 'upper').pose.heightPositions;
        must(positions[0]).originZ = 0.37;
        must(positions[2]).originZ = 0.42;
      },
      'height_positions_not_descending',
      'baskets.upper.pose.heightPositions.2',
    ],
    [
      'a filter open fraction of 30 (per cent)',
      (s) => void (s.filter.flatPlate.openFraction = 30),
      'filter_bad_value',
      'filter.flatPlate.openFraction',
    ],
    [
      'a detergent dose of 20 kg (grams left as they were)',
      (s) => void (s.dosing.detergentMass = 20),
      'dosing_bad_value',
      'dosing.detergentMass',
    ],
    [
      'a rinse-aid dose of 5 m^3',
      (s) => void (s.dosing.rinseAidVolume = 5),
      'dosing_bad_value',
      'dosing.rinseAidVolume',
    ],
    [
      'an inlet flow of 2.5 m^3/s (litres per minute left as they were)',
      (s) => void (s.hydraulics.fill.inletFlow = 2.5),
      'flow_out_of_range',
      'hydraulics.fill.inletFlow',
    ],
    [
      'a drain flow of 16 m^3/s',
      (s) => void (s.hydraulics.drain.flow = 16),
      'flow_out_of_range',
      'hydraulics.drain.flow',
    ],
    [
      'a diverter that takes 70 s to move against dwells of 60 s',
      (s) => void (s.hydraulics.diverter.transitionTime = 70),
      'diverter_transition_too_long',
      'hydraulics.diverter.defaultPattern',
    ],
    [
      'a level check in a phase that does not exist ("wash")',
      (s) => void (s.hydraulics.inventory.levelCheckIn = ['pre_rinse', 'wash']),
      'inventory_bad_value',
      'hydraulics.inventory.levelCheckIn',
    ],
    [
      'half a top-up per phase',
      (s) => void (s.hydraulics.inventory.maxTopUpsPerPhase = 0.5),
      'inventory_bad_value',
      'hydraulics.inventory.topUpVolume',
    ],
    [
      'a floor relief whose lowest point is not zero',
      (s) => {
        for (const point of must(basket(s, 'upper').floor.relief).points) point.rise += 0.01;
      },
      'floor_relief_bad',
      'baskets.upper.floor.relief',
    ],
    [
      'a heater cut-out below the inlet temperature',
      (s) => void (s.thermal.heaterCutOut = 10),
      'thermal_bad_value',
      'thermal.heaterCutOut',
    ],
  ];

  it.each(cases)('%s', (_what, damage, code, path) => {
    const copy = mutableCopy(BOSCH_SMV4HAX40G);
    damage(copy);
    const found = validateMachineSpec(copy).filter((p) => p.code === code);
    expect(found.map((p) => p.path)).toContain(path);
    expect(found.every((p) => p.severity === 'error')).toBe(true);
  });

  it('says that an angle looks like degrees', () => {
    const copy = mutableCopy(BOSCH_SMV4HAX40G);
    must(arm(copy, 'lower').nozzles.find((n) => n.id === 'l8')).rho = 45;
    const found = must(validateMachineSpec(copy).find((p) => p.code === 'angle_out_of_range'));
    expect(found.message).toMatch(/45 rad/);
    expect(found.message).toMatch(/degrees/);
  });

  it('accepts every angle of the shipped machines, a full turn of azimuth included', () => {
    for (const spec of MACHINES) {
      expect(validateMachineSpec(spec).filter((p) => p.code === 'angle_out_of_range')).toEqual([]);
    }
    // 270 degrees (a leading jet) is a legitimate azimuth.
    const copy = mutableCopy(BOSCH_SMV4HAX40G);
    must(arm(copy, 'lower').nozzles.find((n) => n.id === 'l9')).theta = (3 * Math.PI) / 2;
    expect(validateMachineSpec(copy).filter((p) => p.code === 'angle_out_of_range')).toEqual([]);
  });
});

describe('validateMachineSpec holds an arm to its design speed and a programme to its machine', () => {
  const warnings = (damage: (spec: Spec) => void): string[] => {
    const copy = mutableCopy(BOSCH_SMV4HAX40G);
    damage(copy);
    const problems = validateMachineSpec(copy);
    return problems.filter((p) => p.severity === 'warning').map((p) => `${p.code} ${p.path}`);
  };

  it('warns when the bearing friction no longer gives the design speed', () => {
    // With no dry friction the lower arm runs at its frictionless 77 rpm less the viscous
    // term (owner update 5.1: "42, 77"), far from the 42 rpm the friction was tuned to.
    const copy = mutableCopy(BOSCH_SMV4HAX40G);
    arm(copy, 'lower').bearing.frictionRadius = 0;
    const found = must(validateMachineSpec(copy).find((p) => p.code === 'arm_speed_off_design'));
    expect(found.severity).toBe('warning');
    expect(found.path).toBe('sprayLevels.lower.designSpeed');
    const rpm = Number(must(/turns at ([0-9.]+) rpm/.exec(found.message))[1]);
    expect(rpm).toBeGreaterThan(60);
    expect(rpm).toBeLessThan(77);
    expect(found.message).toMatch(/design speed is 42\.0 rpm/);
  });

  it('warns when the design speed is entered in rev/min where rad/s is meant', () => {
    expect(warnings((s) => void (arm(s, 'lower').designSpeed = 42))).toContain(
      'arm_speed_off_design sprayLevels.lower.designSpeed',
    );
    expect(warnings((s) => void (arm(s, 'upper').designSpeed = 31))).toContain(
      'arm_speed_off_design sprayLevels.upper.designSpeed',
    );
  });

  it('accepts the tuned speeds of the Bosch: 42 rpm (position L) and 31 rpm (position UR)', () => {
    expect(warnings(() => undefined)).toEqual([]);
    // Within the tolerance of 15 %: 10 % more friction changes the speed by less.
    expect(
      warnings((s) => void (arm(s, 'lower').bearing.frictionRadius *= 1.1)).filter((w) =>
        w.startsWith('arm_speed_off_design'),
      ),
    ).toEqual([]);
  });

  it("warns when the machine's nominal baths are not those of its primary programme", () => {
    expect(warnings((s) => void (s.hydraulics.fill.firstBathVolume = 4.5e-3))).toEqual([
      'bath_volume_differs hydraulics.fill.firstBathVolume',
    ]);
    expect(warnings((s) => void (s.hydraulics.fill.laterBathVolume = 2.9e-3))).toEqual([
      'bath_volume_differs hydraulics.fill.laterBathVolume',
    ]);
  });

  it('warns when a fill takes longer than its row allows, and the totals no longer add up', () => {
    // 1 L/min: row A3's 2.5 L take 150 s where 90 s are allowed, and the first fill's 0.9 L of
    // mains water 54 s (inside its minute).
    const copy = mutableCopy(BOSCH_SMV4HAX40G);
    copy.hydraulics.fill.inletFlow = 1 / 60000;
    const problems = validateMachineSpec(copy).filter((p) =>
      p.path.startsWith('programmes.auto_145.'),
    );
    expect(problems.map((p) => `${p.severity} ${p.code} ${p.path}`)).toContain(
      'warning programme_fill_exceeds_row programmes.auto_145.steps.a3_fill',
    );
    expect(must(problems.find((p) => p.code === 'programme_fill_exceeds_row')).message).toMatch(
      /150 s .* 90 s/,
    );
    // One minute over: at the edge of AUTO's tolerance, so the slower valve of 0.5 L/min is
    // what trips the duration check.
    expect(
      codesAfter(BOSCH_SMV4HAX40G, (s) => void (s.hydraulics.fill.inletFlow = 0.5 / 60000)),
    ).toContain('programme_duration_mismatch');
  });
});

describe('the drill-bore variant keeps the arm speed (owner update 5.5)', () => {
  it('has the lower arm at its design speed with the viscous term re-fitted, and validates clean', () => {
    const variant = must(MACHINE_VARIANTS[0]);
    expect(validateMachineSpec(variant)).toEqual([]);
    // Undo the re-fit: the variant then runs away to 58 rpm and the validator says so.
    const unfitted = mutableCopy(variant);
    arm(unfitted, 'lower').bearing.viscous = arm(
      mutableCopy(BOSCH_SMV4HAX40G),
      'lower',
    ).bearing.viscous;
    const found = validateMachineSpec(unfitted).filter((p) => p.code === 'arm_speed_off_design');
    expect(found).toHaveLength(1);
    expect(must(found[0]).message).toMatch(/58\.\d rpm/);
  });
});
