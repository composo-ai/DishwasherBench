/**
 * The SPOT-60 data against docs/research/machine.md: the machine description of section 12.1,
 * the rack table of section 2.4.2, the stack-up of section 2.6 and the nozzle tables of section
 * 3.2. Expected values are typed from the dossier in its units.
 */

import { radToDeg } from '@spotless/core';
import { describe, expect, it } from 'vitest';
import { basketOrigin, getBasket, getBranch, getSprayArm, getSprayLevel } from './config.ts';
import { tabletDrop } from './dispenser.ts';
import { sprayLevelCdA } from './hydraulics.ts';
import { SPOT_60 as S } from './machines.ts';
import { expectNear, must, toLitres, toMm } from './test-util.ts';
import type { MachineConfig } from './types.ts';

function expectList(
  actual: readonly number[],
  expected: readonly number[],
  tolerance: number,
  what: string,
): void {
  expect(actual, what).toHaveLength(expected.length);
  expected.forEach((v, i) => expectNear(must(actual[i]), v, tolerance, `${what}[${i}]`));
}

function upperAt(position: string): MachineConfig {
  return { ...S.defaultConfig, basketHeights: { upper: position } };
}

describe('SPOT-60 frame (machine.md section 12.1)', () => {
  it('has the tub, door, sump, filter and dispenser of the description block', () => {
    expect(S.id).toBe('spot60');
    expect(S.identity.placeSettings).toBe(13);
    expectList(S.tub.x.map(toMm), [-273, 273], 1e-9, 'tub x');
    expectList(S.tub.y.map(toMm), [-250, 250], 1e-9, 'tub y');
    expectList(S.tub.z.map(toMm), [0, 650], 1e-9, 'tub z');
    expectNear(toMm(S.tub.verticalCornerRadius), 30, 1e-9);
    expectNear(radToDeg(S.tub.floorSlope), 4, 1e-9);
    expectNear(toMm(S.door.linerPlaneY), -250, 1e-9);
    expectNear(toMm(S.door.hingeAxis.y), -262, 1e-9);
    expectNear(toMm(S.door.hingeAxis.z), -20, 1e-9);
    expectList(S.sump.centre.map(toMm), [0, -40], 1e-9, 'sump');
    expectNear(toMm(S.sump.diameter), 150, 1e-9);
    expectNear(toMm(S.sump.depth), 85, 1e-9);
    expectNear(toLitres(S.sump.workingVolume), 1.2, 1e-9);
    // flat_plate: {size_xy: [260, 220], hole_d: 0.8, open_fraction: 0.15}, centred on the sump.
    const plate = S.filter.flatPlate;
    expectNear(toMm(plate.x[1] - plate.x[0]), 260, 1e-9);
    expectNear(toMm(plate.y[1] - plate.y[0]), 220, 1e-9);
    expectNear(toMm((plate.y[0] + plate.y[1]) / 2), -40, 1e-9);
    expectNear(toMm(plate.holeDiameter), 0.8, 1e-9);
    expect(plate.openFraction).toBe(0.15);
    // coarse_cup: {diameter: 60, height: 105, opening: 5.0}; micro: {mesh: 0.20, area_cm2: 190, open_fraction: 0.40}.
    expectNear(toMm(S.filter.coarse.diameter), 60, 1e-9);
    expectNear(toMm(S.filter.coarse.length), 105, 1e-9);
    expectNear(toMm(S.filter.coarse.opening), 5.0, 1e-9);
    expectNear(toMm(S.filter.micro.mesh), 0.2, 1e-9);
    expectNear(S.filter.micro.area * 1e4, 190, 1e-9);
    expect(S.filter.micro.openFraction).toBe(0.4);
    expect(S.filter.sumpCover).toBeNull();
    expect(S.saltCap).toBeNull();
  });

  it('has a hinged dispenser lid swinging 110 deg into the tub, the tablet falling into the lower rack', () => {
    const d = S.dispenser;
    expectList(d.chamberCentre.map(toMm), [-70, -250, 300], 1e-9, 'lid centre');
    expectList(d.chamberSize.map(toMm), [95, 60], 1e-9, 'lid size');
    if (d.lid.kind !== 'swings') throw new Error('the baseline lid swings');
    expect(d.lid.hingeEdge).toBe('bottom');
    expectNear(radToDeg(d.lid.angle), 110, 1e-9);
    expectNear(toMm(d.keepOutDepth), 62, 1e-9);
    expectList(d.rinseAidOutlet.map(toMm), [10, -250, 300], 1e-9, 'rinse-aid outlet');
    expect(d.tabletTarget).toEqual({ kind: 'basket', basketId: 'lower' });
    // "falls 250 to 300 mm into the front row of the lower rack" (section 7.4): from the lid's
    // bottom edge at 270 mm to the grid at 50 mm is 220 mm; a tablet lying on the load falls less.
    const drop = tabletDrop(S);
    expect(drop.caughtBy).toBe('basket');
    expectNear(toMm(drop.height), 220, 1e-9);
    // The exit is on the liner plane (y = -250), 2.5 mm in front of the 495 mm rack centred in
    // the 500 mm tub; the swinging lid carries the tablet further in than this vertical drop.
    expectNear(toMm(drop.miss), 2.5, 1e-9);
  });

  it('leaves 30 % of the floor outside the lower-arm disc (section 2.6)', () => {
    // "1 - pi 0.247^2 / (0.546 x 0.5) = 0.30".
    const plan = (S.tub.x[1] - S.tub.x[0]) * (S.tub.y[1] - S.tub.y[0]);
    expectNear(1 - (Math.PI * getSprayArm(S, 'lower').tipRadius ** 2) / plan, 0.3, 0.005);
  });
});

describe('SPOT-60 racks (sections 2.4.2, 2.6, 12.1)', () => {
  const lower = getBasket(S, 'lower');
  const upper = getBasket(S, 'upper');
  const third = getBasket(S, 'third');

  it('has three levels: lower, upper and a cutlery tray', () => {
    expect(S.baskets.map((b) => [b.id, b.kind, b.frame])).toEqual([
      ['lower', 'wire', 'lower_rack'],
      ['upper', 'wire', 'upper_rack'],
      ['third', 'cutlery_tray', 'third_rack'],
    ]);
  });

  it('lower rack: 525 x 495 x 160 mm, grid top at 50 mm, grid pitch 35 x 100 mm', () => {
    expectList(lower.outline.size.map(toMm), [525, 495], 1e-9, 'size');
    expectNear(toMm(basketOrigin(S, 'lower')[2]), 50, 1e-9);
    const rim = must(lower.walls.find((w) => w.side === 'left'));
    expectNear(toMm(must(rim.horizontalWireZ[rim.horizontalWireZ.length - 1])), 160, 1e-9);
    expectNear(toMm(must(lower.floor.alongY.pitch)), 35, 1e-9);
    expectNear(toMm(must(lower.floor.alongX.pitch)), 100, 1e-9);
    // Evenly spaced at the stated pitches.
    const x = lower.floor.alongY.positions.map(toMm);
    x.slice(1).forEach((v, i) => expectNear(v - must(x[i]), 35, 1e-9));
    const y = lower.floor.alongX.positions.map(toMm);
    y.slice(1).forEach((v, i) => expectNear(v - must(y[i]), 100, 1e-9));
    // Wires: 5.0 / 3.4 / 3.4 mm steel with a 0.4 mm coating; "4.2 mm finished" tines.
    expectNear(toMm(lower.wires.rim.steel), 5.0, 1e-9);
    expectNear(toMm(lower.wires.floor.steel), 3.4, 1e-9);
    expectNear(toMm(lower.wires.tine.steel), 3.4, 1e-9);
    expectNear(toMm(lower.wires.coating), 0.4, 1e-9);
    expectNear(toMm(lower.wires.tine.coated), 4.2, 1e-9);
    // "opening about 31 x 96 mm".
    expectNear(35 - toMm(lower.wires.floor.coated), 31, 0.5);
    expectNear(100 - toMm(lower.wires.floor.coated), 96, 0.5);
    expectList(lower.floor.largestOpening.map(toMm), [31, 96], 1e-9, 'opening');
    expect(must(lower.wheels).count).toBe(8);
    expectNear(toMm(must(lower.wheels).diameter), 40, 1e-9);
  });

  it('lower rack: 8 front-back tine rows at 25 mm pitch, 62 / 75 mm high, leaning 8 deg, the rear 4 foldable', () => {
    expect(lower.tineRows).toHaveLength(8);
    expect(lower.tineRows.every((r) => r.runs === 'y')).toBe(true);
    for (const row of lower.tineRows) {
      expectNear(toMm(row.pitch), 25, 1e-9);
      expectNear(radToDeg(row.lean), 8, 1e-9);
      const p = row.tinePositions.map(toMm);
      p.slice(1).forEach((v, i) => expectNear(v - must(p[i]), 25, 1e-9));
    }
    const rear = lower.tineRows.filter((r) => r.hinge !== null);
    expect(rear.map((r) => r.id)).toEqual(['row_5', 'row_6', 'row_7', 'row_8']);
    // Tip heights above the grid: 62 mm front rows, 75 mm rear rows.
    for (const row of lower.tineRows) {
      expectNear(toMm(row.railZ + row.height), row.hinge === null ? 62 : 75, 1e-9, row.id);
    }
    // Two per quadrant; "lean toward the tub centre".
    const depth = lower.outline.size[1];
    const width = lower.outline.size[0];
    for (const quadrant of [
      [false, false],
      [false, true],
      [true, false],
      [true, true],
    ] as const) {
      const rows = lower.tineRows.filter(
        (r) =>
          r.railAt > width / 2 === quadrant[0] &&
          must(r.tinePositions[0]) > depth / 2 === quadrant[1],
      );
      expect(rows).toHaveLength(2);
      for (const row of rows)
        expect(row.leanToward.every((d) => d === (quadrant[1] ? '-y' : '+y'))).toBe(true);
    }
  });

  it('upper rack: 505 x 480 x 125 mm at 350 / 375 / 400 mm, grid 30 x 85 mm, 40 mm tines at 22 mm', () => {
    expectList(upper.outline.size.map(toMm), [505, 480], 1e-9, 'size');
    expectList(
      upper.pose.heightPositions.map((p) => toMm(p.originZ)),
      [400, 375, 350],
      1e-9,
      'positions',
    );
    expectNear(toMm(must(upper.floor.alongY.pitch)), 30, 1e-9);
    expectNear(toMm(must(upper.floor.alongX.pitch)), 85, 1e-9);
    expectNear(toMm(upper.wires.floor.steel), 3.2, 1e-9);
    expectNear(toMm(upper.wires.tine.steel), 3.0, 1e-9);
    // "2 rows per side", 40 mm tall, 22 mm pitch, leaning 10 to 20 deg outward.
    expect(upper.tineRows).toHaveLength(4);
    const width = upper.outline.size[0];
    for (const row of upper.tineRows) {
      expectNear(toMm(row.railZ + row.height), 40, 1e-9);
      expectNear(toMm(row.pitch), 22, 1e-9);
      expect(radToDeg(row.lean)).toBeGreaterThanOrEqual(10);
      expect(radToDeg(row.lean)).toBeLessThanOrEqual(20);
      expect(row.leanToward.every((d) => d === (row.railAt < width / 2 ? '-x' : '+x'))).toBe(true);
    }
    expect(upper.tineRows.filter((r) => r.railAt < width / 2)).toHaveLength(2);
    // cup_shelves: {count: 4, size: [225, 85], height_above_grid: 75}, two per side.
    expect(upper.cupShelves).toHaveLength(4);
    expect(upper.cupShelves.filter((s) => s.side === 'left')).toHaveLength(2);
    for (const shelf of upper.cupShelves) {
      expectNear(toMm(shelf.size[0]), 225, 1e-9);
      expectNear(toMm(shelf.size[1]), 85, 1e-9);
      expectNear(toMm(shelf.heightAboveGrid), 75, 1e-9);
    }
  });

  it('third rack: 500 x 470 mm, top edge 10 mm and deepest point 81 mm below the ceiling', () => {
    expectList(third.outline.size.map(toMm), [500, 470], 1e-9, 'size');
    const tray = must(third.tray);
    const originZ = basketOrigin(S, 'third')[2];
    const rim = must(third.walls.find((w) => w.side === 'left'));
    const topEdge = originZ + must(rim.horizontalWireZ[rim.horizontalWireZ.length - 1]);
    expectNear(toMm(S.tub.z[1] - topEdge), 10, 1e-9);
    expectNear(toMm(tray.sideDepth), 45, 1e-9);
    expectNear(toMm(S.tub.z[1] - (topEdge - tray.centreDepth)), 81, 1e-9);
    expectNear(radToDeg(tray.centreTilt), 4, 1e-9);
    expectList(tray.combGaps.map(toMm), [10, 7, 3], 1e-9, 'comb gaps');
    expectNear(toMm(must(third.floor.alongX.pitch)), 19, 1e-9);
    expectNear(toMm(must(third.floor.alongY.pitch)), 19, 1e-9);
  });

  it('reproduces the item heights of the stack-up: 260 / 285 / 310 mm below and 215 / 190 / 165 mm above', () => {
    // Section 2.6: the tallest lower-rack item clears the mid arm's underside by 7 mm, and the
    // tallest upper-rack item the deepest point of the third rack (569 mm) by 4 mm.
    const mid = getSprayArm(S, 'mid');
    const lowerZ = basketOrigin(S, 'lower')[2];
    const tray = must(third.tray);
    const deepest = basketOrigin(S, 'third')[2] - (tray.centreDepth - tray.sideDepth);
    expectNear(toMm(deepest), 569, 1e-9);
    for (const [position, below, above] of [
      ['low', 260, 215],
      ['mid', 285, 190],
      ['high', 310, 165],
    ] as const) {
      const upperZ = basketOrigin(S, 'upper', upperAt(position))[2];
      expectNear(
        toMm(upperZ + mid.bladeUndersideZ - 0.007 - lowerZ),
        below,
        1e-9,
        `${position}: lower item`,
      );
      expectNear(toMm(deepest - 0.004 - upperZ), above, 1e-9, `${position}: upper item`);
    }
  });

  it('cutlery basket: 240 x 135 x 215 mm, 7 cells, 3.5 x 14 mm floor slots, 9 / 26 mm lid openings', () => {
    const cutlery = must(S.cutleryBasket);
    expectList(cutlery.size.map(toMm), [240, 135, 215], 1e-9, 'size');
    expect(cutlery.cells).toBe(7);
    expectList(cutlery.floorSlot.map(toMm), [3.5, 14], 1e-9, 'floor slot');
    expectList(must(cutlery.lid).openings.map(toMm), [9, 26], 1e-9, 'lid openings');
    expectNear(toMm(cutlery.heightWithHandle), 245, 1e-9);
    expect(cutlery.base).toBe('flat');
    expect(cutlery.tunnels).toBeNull();
    // It stands between the two inner front tine rows.
    const placement = cutlery.defaultPlacement;
    const inner = lower.tineRows
      .filter((r) => r.hinge === null)
      .map((r) => r.railAt)
      .sort((a, b) => Math.abs(a - placement.centre[0]) - Math.abs(b - placement.centre[0]))
      .slice(0, 2);
    for (const rail of inner) {
      expect(Math.abs(rail - placement.centre[0])).toBeGreaterThan(
        cutlery.size[1] / 2 + lower.wires.tine.coated / 2,
      );
    }
  });
});

describe('SPOT-60 arms and nozzle tables (sections 3.2, 12.1)', () => {
  it('has the three arms of the description block', () => {
    // [id, axis mm, tip radius mm, hub mm, wet inertia, weight N, sense, k_f, c_v, thrust sign, design rpm].
    const arms = [
      ['lower', [0, 0], 247, 21, 6.3e-3, 1.8, 'ccw', 0.0093, 0.002, -1, 35],
      ['mid', [0, 0], 232, 18, 4.5e-3, 1.5, 'cw', 0.0038, 0.002, 1, 30],
      ['top', [0, 20], 135, 12, 0.5e-3, 0.6, 'cw', 0.005, 0.0005, -1, 60],
    ] as const;
    expect(S.sprayLevels.map((l) => l.id)).toEqual(arms.map(([id]) => id));
    for (const [id, axis, tip, hub, inertia, weight, sense, kf, cv, sign, rpm] of arms) {
      const arm = getSprayArm(S, id);
      expectList(arm.axis.map(toMm), axis, 1e-9, `${id} axis`);
      expectNear(toMm(arm.tipRadius), tip, 1e-9);
      expectNear(toMm(arm.bearing.hubBore), hub, 1e-9);
      expect(arm.inertiaWet).toBe(inertia);
      expect(arm.weight).toBe(weight);
      expect(arm.sense).toBe(sense);
      expectNear(arm.bearing.frictionRadius, kf, 1e-12);
      expect(arm.bearing.viscous).toBe(cv);
      expect(arm.bearing.thrustSign).toBe(sign);
      expectNear((must(arm.designSpeed) * 30) / Math.PI, rpm, 1e-9);
    }
    // nozzle_z_up: 30, nozzle_z_down: 8; "UR_grid_z - 10" and "UR_grid_z - 33"; nozzle_z_down: 632.
    const lower = getSprayArm(S, 'lower');
    expectNear(toMm(must(lower.nozzleUpZ)), 30, 1e-9);
    expectNear(toMm(must(lower.nozzleDownZ)), 8, 1e-9);
    const mid = getSprayArm(S, 'mid');
    expect(mid.mount).toEqual({ kind: 'basket', basketId: 'upper' });
    expectNear(toMm(must(mid.nozzleUpZ)), -10, 1e-9);
    expectNear(toMm(must(mid.nozzleDownZ)), -33, 1e-9);
    const top = getSprayArm(S, 'top');
    expect(top.nozzleUpZ).toBeNull();
    expectNear(toMm(must(top.nozzleDownZ)), 632, 1e-9);
  });

  // Sums of the tables of section 3.2: nozzle count, sum of A (mm2), sum of C_d A (mm2).
  it.each([
    ['lower', 12, 75.3, 61.2],
    ['mid', 10, 49.6, 40.4],
    ['top', 6, 18.8, 15.1],
  ] as const)('%s arm: %i nozzles, sum A %f mm2, C_d A %f mm2', (id, count, sumA, sumCdA) => {
    const level = getSprayLevel(S, id);
    expect(level.nozzles).toHaveLength(count);
    expectNear(level.nozzles.reduce((sum, n) => sum + n.area, 0) * 1e6, sumA, 0.06);
    expectNear(sprayLevelCdA(level) * 1e6, sumCdA, 0.06);
    expectNear(getBranch(S, id).statedCdA * 1e6, sumCdA, 1e-9);
  });

  it('carries the DU750 positions and angles on L1 to L10 (S1 Table 5.7)', () => {
    // [R mm, theta deg, rho deg], verbatim.
    const du750 = [
      [238, 90, 55],
      [226, 359, 89],
      [182, 160, 60],
      [145, 305, 70],
      [114, 90, 89],
      [89, 179, 89],
      [162, 65, 70],
      [194, 43, 62],
      [223, 90, 89],
      [238, 60, 55],
    ] as const;
    const lower = getSprayArm(S, 'lower');
    du750.forEach(([r, theta, rho], i) => {
      const nozzle = must(lower.nozzles[i]);
      expect(nozzle.label).toBe(`L${i + 1}`);
      expectNear(toMm(nozzle.radius), r, 1e-9);
      expectNear(radToDeg(nozzle.theta), theta, 1e-9);
      expectNear(radToDeg(nozzle.rho), rho, 1e-9);
    });
    // Areas of the table: 3.0 mm round 7.07, 2.4 mm round 4.52, 1.8 x 5.0 slot 8.30, 2.5 mm 4.91 mm2.
    const area = (label: string) => must(lower.nozzles.find((n) => n.label === label)).area * 1e6;
    expectNear(area('L1'), 7.07, 0.006);
    expectNear(area('L3'), 4.52, 0.006);
    expectNear(area('L2'), 8.3, 0.006);
    expectNear(area('L11'), 4.91, 0.006);
    // "L1 + L10 carry 20 % of the lower-arm flow".
    const drive = lower.nozzles.filter((n) => n.drives).reduce((sum, n) => sum + n.cd * n.area, 0);
    expect(lower.nozzles.filter((n) => n.drives).map((n) => n.label)).toEqual(['L1', 'L10']);
    expectNear(drive / sprayLevelCdA(lower), 0.2, 0.005);
  });
});

describe('SPOT-60 hydraulics, thermal and dosing (section 12.1)', () => {
  it('has the pump, branches, diverter, inventory, fill and drain of the description block', () => {
    const h = S.hydraulics;
    expect(h.pump.ratedSpeedRpm).toBe(3000);
    expect(h.pump.shutOffHead).toBe(5.5);
    expectNear(h.pump.curveCoefficient / 3.6e9, 1.333e-3, 1e-15);
    expect(h.pump.speedRangeRpm).toEqual([1400, 3400]);
    expect(h.pump.hydraulicEfficiency).toBe(0.4);
    expect(h.pump.motorEfficiency).toBe(0.72);
    expect(h.pump.idlePower).toBe(8);
    const branches = [
      ['lower', 0.15, 2.0e10, 0.25],
      ['mid', 0.52, 5.6e10, 0.4],
      ['top', 0.8, 1.07e12, 0.05],
    ] as const;
    for (const [id, lift, k, volume] of branches) {
      const branch = getBranch(S, id);
      expect(branch.staticLift).toBe(lift);
      expect(branch.lossCoefficient).toBe(k);
      expectNear(toLitres(branch.pipeVolume), volume, 1e-9);
    }
    // states: {L: [lower], U: [mid, top], A: [lower, mid, top]}, transition_s: 1.5.
    expect(h.diverter.positions.map((p) => [p.label, p.feeds])).toEqual([
      ['L', ['lower']],
      ['U', ['mid', 'top']],
      ['A', ['lower', 'mid', 'top']],
    ]);
    expect(h.diverter.transitionTime).toBe(1.5);
    expect(h.diverter.defaultPattern.phases).toEqual([
      { position: 'l', duration: 60 },
      { position: 'u', duration: 60 },
    ]);
    expectNear(toLitres(h.inventory.minSumpVolume), 0.5, 1e-9);
    expect(h.inventory.flightTime).toBe(0.5);
    expect(h.inventory.returnTime).toBe(1.5);
    expectNear(toLitres(h.inventory.carryOver), 0.4, 1e-9);
    expectNear(toLitres(h.inventory.topUpVolume), 0.5, 1e-9);
    expect(h.inventory.maxTopUpsPerPhase).toBe(1);
    expectNear(h.fill.inletFlow * 60000, 3.0, 1e-9);
    expect(h.fill.prestoreVolume).toBeNull();
    expectNear(h.drain.flow * 60000, 16, 1e-9);
    expect(h.drain.pattern).toEqual([35, 10, 10]);
  });

  it('has the thermal, dosing and drying defaults', () => {
    const t = S.thermal;
    expect(t.heaterPower).toBe(2000);
    expect(t.heaterDuty).toBe(0.7);
    expect(t.machineHeatCapacity).toBe(14000);
    expect(t.liquorLoadConductance).toBe(600);
    expect(t.liquorMachineConductance).toBe(250);
    expect(t.cabinetConductance).toBe(2.6);
    expect(t.inletTemperature).toBe(15);
    expect(t.ambientTemperature).toBe(23);
    expectNear(S.dosing.detergentMass, 0.02, 1e-12);
    expect(S.dosing.detergentReleaseDelay).toBe(60);
    expectNear(S.dosing.rinseAidVolume * 1e6, 3, 1e-9);
    expect(S.dosing.rinseAidMinTemperature).toBe(40);
    expect(S.drying.method).toBe('heat_exchanger_plus_auto_open');
    expectNear(must(S.drying.autoOpen).after / 60, 25, 1e-9);
    expectNear(toMm(must(S.drying.autoOpen).gap), 100, 1e-9);
    expect(S.softener).toBeNull();
  });

  it('is tagged as the generic baseline throughout', () => {
    expect(S.tub.provenance.tag).toBe('generic');
    expect(S.hydraulics.pump.provenance.tag).toBe('generic');
    expect(S.thermal.provenance.tag).toBe('generic');
    expect(getSprayArm(S, 'lower').nozzleProvenance.fields).toEqual({
      radius: 'verified',
      theta: 'verified',
      rho: 'verified',
    });
    expect(S.tub.provenance.source).toMatch(/^machine\.md /);
    // Positions this package had to choose are marked as estimates.
    expect(must(getBasket(S, 'lower').tineRows[0]).provenance.fields).toMatchObject({
      tinePositions: 'estimated',
      railAt: 'estimated',
    });
  });
});
