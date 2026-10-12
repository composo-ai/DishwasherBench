/**
 * The Bosch SMV4HAX40G data against docs/research/machine-bosch-smv4hax40g.md (the dossier) and
 * docs/research/machine-bosch-owner-update.md (the owner update: the owner's own tape
 * measurements and photographs of 2026-10-09, which outrank the dossier). Every expected value
 * here is typed from one of the two: the dossier's evidence tables of section 2 and its
 * specification block of section 3.1 where the owner measured nothing, and the update's
 * sections 2 to 4 and 7 for both nozzle tables, the rotation senses and the vertical stack. The
 * values are in the documents' units and frames; the test converts the loaded SI specification
 * back to them. Where an expectation was changed from the dossier's value to the update's, the
 * test says so.
 */

import { radToDeg } from '@spotless/core';
import { describe, expect, it } from 'vitest';
import {
  basketHeightPosition,
  basketOrigin,
  getBasket,
  getBranch,
  getSprayArm,
  getSprayLevel,
  getTineRow,
  sprayLevelDatumZ,
} from './config.ts';
import { tabletDrop } from './dispenser.ts';
import { floorRiseAt } from './outline.ts';
import { sprayLevelCdA } from './hydraulics.ts';
import { BOSCH_SMV4HAX40G as B, BOSCH_SMV4HAX40G_DRILL_BORE, findMachine } from './machines.ts';
import { PROVENANCE_TAGS, provenanceTagOf } from './provenance.ts';
import { expectNear, must, toLitres, toMm } from './test-util.ts';
import type { BasketSpec, MachineConfig, TineRowSpec } from './types.ts';

const lower = getBasket(B, 'lower');
const upper = getBasket(B, 'upper');

/**
 * The lower basket's rack frame to the dossier's frame (origin at the rim centre, heights from
 * the plane of the floor cross-wire centres): the outer plan is 525 x 512 mm and the cross
 * wires, 4.0 mm over the coating, have their tops 2.0 mm above their centres.
 */
const lowerX = (x: number) => toMm(x) - 525 / 2;
const lowerY = (y: number) => toMm(y) - 512 / 2;
const lowerZ = (z: number) => toMm(z) + 2.0;

/**
 * The upper basket's rack frame to the dossier's frame (origin on the upper spray-arm axis,
 * heights from the tops of the floor wires): the rim spans x = -244 to +256 and y = -228 to +248.
 */
const upperX = (x: number) => toMm(x) - 244;
const upperY = (y: number) => toMm(y) - 228;

function expectList(
  actual: readonly number[],
  expected: readonly number[],
  tolerance: number,
  what: string,
): void {
  expect(actual, what).toHaveLength(expected.length);
  expected.forEach((v, i) => expectNear(must(actual[i]), v, tolerance, `${what}[${i}]`));
}

/** Level `level` of the Rackmatic. */
function atLevel(level: string): MachineConfig {
  return { ...B.defaultConfig, basketHeights: { upper: level } };
}

describe('identity, tub and door (sections 1.1, 2.1, 3.1 frame)', () => {
  it('is the SMV4HAX40G/13 with its rating-plate figures', () => {
    expect(B.id).toBe('bosch_smv4hax40g');
    expect(B.identity.model).toBe('SMV4HAX40G/13');
    expect(B.identity.maker).toBe('Robert Bosch Hausgeraete GmbH');
    expect(B.identity.placeSettings).toBe(13);
    // "815 x 598 x 550 mm" (H x W x D); stored as width, depth, height.
    expect(B.identity.outerSize.map(toMm)).toEqual([598, 550, 815]);
    expect(B.identity.ratedPower).toEqual([2000, 2400]);
    expect(B.identity.ratedVoltage).toEqual([220, 240]);
    expect(B.identity.variant).toContain('SD6PW1B');
    expect(B.identity.variant).toContain('GV640');
  });

  it('has the tub box x [-272, 273], y [-235, 265], z [0, 640] mm: the roof as the owner measured it', () => {
    expectList(B.tub.x.map(toMm), [-272, 273], 1e-9, 'tub x');
    expectList(B.tub.y.map(toMm), [-235, 265], 1e-9, 'tub y');
    // Owner's tape: "Filter plate to roof 64 cm" (owner update 4.1, reading d); the dossier's
    // stack-up had estimated 675 mm.
    expectList(B.tub.z.map(toMm), [0, 640], 1e-9, 'tub z');
    expect(provenanceTagOf(B.tub.provenance, 'z')).toBe('measured');
    // Interior 545 x 500 x 640 mm; the lower-arm axis 265 mm in front of the rear wall.
    expectNear(toMm(B.tub.x[1] - B.tub.x[0]), 545, 1e-9);
    expectNear(toMm(B.tub.y[1] - B.tub.y[0]), 500, 1e-9);
    expectNear(toMm(B.tub.verticalCornerRadius), 30, 1e-9);
    expectNear(radToDeg(B.tub.floorSlope), 4, 1e-9);
    expect(B.tub.material).toBe('stainless_steel');
    expect(B.tub.floorDatum).toContain('flat fine filter');
  });

  it('covers 61 % of the plan with a 230 mm arm disc; 39 % lies outside', () => {
    const plan = (B.tub.x[1] - B.tub.x[0]) * (B.tub.y[1] - B.tub.y[0]);
    const disc = Math.PI * getSprayArm(B, 'lower').tipRadius ** 2;
    expectNear(1 - disc / plan, 0.39, 0.005);
  });

  it('has the door liner 40 mm beyond the flange plane and the hinge at (y -250, z 45)', () => {
    expectNear(toMm(B.door.flangePlaneY), -235, 1e-9);
    expectNear(toMm(B.door.linerPlaneY), -275, 1e-9);
    expectNear(toMm(B.door.hingeAxis.y), -250, 1e-9);
    expectNear(toMm(B.door.hingeAxis.z), 45, 1e-9);
    expectNear(radToDeg(B.door.openAngle), 90, 1e-9);
    // Inner door pressing 625 x 575 mm [P10].
    expect(must(B.door.linerSize).map(toMm)).toEqual([575, 625]);
    // Rear wall to liner 540 mm in an appliance 550 mm deep.
    expectNear(toMm(B.tub.y[1] - B.door.linerPlaneY), 540, 1e-9);
  });
});

describe('sump, filters and floor (sections 2.10, 3.1 frame)', () => {
  it('has the sump and the three-part filter of the specification block', () => {
    expectList(B.sump.centre.map(toMm), [0, -85], 1e-9, 'filter axis');
    expectNear(toMm(B.sump.diameter), 200, 1e-9);
    expectNear(toMm(B.sump.depth), 85, 1e-9);
    expectNear(toLitres(B.sump.workingVolume), 1.2, 1e-9);
    expectNear(toLitres(B.sump.residueAfterDrain), 0.17, 1e-9);
    const { flatPlate, sumpCover, coarse, micro } = B.filter;
    // Flat fine filter: 260 mm wide with a 54 mm opening (published). Front to back the mesh
    // seen in IMG_9082 runs from 59 to 62 mm behind the filter axis (y = -85) to 94 to 99 mm
    // in front of it, +-12 mm, not the published 130 mm.
    expectList(flatPlate.x.map(toMm), [-130, 130], 1e-9, 'plate x');
    expectNear(toMm(must(flatPlate.y[1])) - -85, 60.5, 12, 'mesh behind the filter axis');
    expectNear(-85 - toMm(must(flatPlate.y[0])), 96.5, 12, 'mesh in front of the filter axis');
    expect(provenanceTagOf(flatPlate.provenance, 'y')).toBe('photo');
    expectNear(toMm(must(flatPlate.openingDiameter)), 54, 1e-9);
    expectNear(toMm(flatPlate.holeDiameter), 0.85, 1e-9);
    expectNear(toMm(must(flatPlate.holePitch)), 1.47, 1e-9);
    expect(flatPlate.lattice).toBe('hex');
    expect(flatPlate.openFraction).toBe(0.3);
    expectNear(flatPlate.openArea * 1e4, 88, 1e-9);
    // Sump cover 259 x 95 mm, y = -20 to +75.
    const cover = must(sumpCover);
    expectList(cover.size.map(toMm), [259, 95], 1e-9, 'cover size');
    expectList(cover.y.map(toMm), [-20, 75], 1e-9, 'cover y');
    expectNear(toMm(cover.holeDiameter), 1.25, 1e-9);
    expectNear(toMm(cover.holePitch), 2.1, 1e-9);
    expectNear(cover.openArea * 1e4, 26, 1e-9);
    // Coarse filter 79 x 131 mm, crown 71 mm, its top 28 mm above the plate.
    expectNear(toMm(coarse.diameter), 79, 1e-9);
    expectNear(toMm(coarse.length), 131, 1e-9);
    expectNear(toMm(must(coarse.crownDiameter)), 71, 1e-9);
    expectNear(toMm(must(coarse.crownTopZ)), 28, 1e-9);
    expectNear(toMm(coarse.opening), 5.0, 1e-9);
    // Micro filter 71 x 92 mm, pleated 1.5 times, 0.20 mm mesh, 230 cm2, 0.37 open.
    expectNear(toMm(must(micro.diameter)), 71, 1e-9);
    expectNear(toMm(must(micro.height)), 92, 1e-9);
    expect(micro.pleatFactor).toBe(1.5);
    expectNear(toMm(micro.mesh), 0.2, 1e-9);
    expectNear(micro.area * 1e4, 230, 1e-9);
    expect(micro.openFraction).toBe(0.37);
  });

  it('has the salt cap, the floor pressings and the feed pipe', () => {
    const cap = must(B.saltCap);
    // IMG_9082: the cap's right edge is 35 mm from the left edge of the filter plate, and the
    // foot of its centre about 13 mm in front of the filter axis (+-12 mm).
    expectNear(
      toMm(must(B.filter.flatPlate.x[0]) - (must(cap.centre[0]) + cap.diameter / 2)),
      35,
      12,
    );
    expectNear(toMm(must(B.filter.axis[1]) - must(cap.centre[1])), 13, 15, 'in front of the axis');
    // It stands on the floor inside the wheel ledge (22 mm wide, on the left wall).
    expect(must(cap.centre[0]) - cap.diameter / 2).toBeGreaterThanOrEqual(B.tub.x[0] + 0.022);
    expectNear(toMm(cap.diameter), 92, 1e-9);
    expectNear(toMm(cap.topZ), 25, 1e-9);
    const beads = B.floorFeatures.filter((f) => f.kind === 'beads');
    expect(beads).toHaveLength(2);
    for (const group of beads) {
      if (group.kind !== 'beads') continue;
      expect(group.count).toBe(3);
      expectNear(toMm(group.length), 51, 1e-9);
      expectNear(toMm(group.pitch), 13, 1e-9);
      expectList(group.y.map(toMm), [-185, -155], 1e-9, 'beads y');
    }
    const dish = must(B.floorFeatures.find((f) => f.kind === 'dish'));
    if (dish.kind !== 'dish') throw new Error('not a dish');
    expectList(dish.centre.map(toMm), [185, 160], 1e-9, 'rear dish');
    expectNear(toMm(dish.diameter), 75, 1e-9);
    const duct = must(B.feedDuct);
    expect(duct.part).toBe('11003118');
    expectList(duct.riserX.map(toMm), [-30, 30], 1e-9, 'riser');
    expectNear(toMm(duct.riserProud), 21, 1e-9);
    expectNear(toMm(duct.portBlockProud), 34, 1e-9);
    expect(duct.channels).toBe(2);
    // Ports 345 / 371 / 398 mm and the top 680 mm above the lower ends of the floor stubs.
    // The 680 mm part ends at the measured roof, which puts its stub ends 40 mm below the
    // filter plate (owner update 4.3: "at least 40 mm").
    expectNear(toMm(duct.topZ), 640, 1e-9);
    expectNear(toMm(duct.stubEndZ), -40, 1e-9);
    expectList(
      duct.portZ.map((z) => toMm(z - duct.stubEndZ)),
      [345, 371, 398],
      1e-9,
      'ports',
    );
    expectNear(toMm(duct.topZ - duct.stubEndZ), 680, 1e-9);
    // Three ports, 25 to 27 mm apart, one per Rackmatic level.
    expect(duct.portZ).toHaveLength(upper.pose.heightPositions.length);
  });

  it('the crown and the salt cap stand under the lower arm with about 10 mm to spare (section 5.5)', () => {
    const arm = getSprayArm(B, 'lower');
    const cap = must(B.saltCap);
    // "the salt cap (top at about 25 mm ...)": where IMG_9082 puts it, it lies 174 to 266 mm
    // from the axis, so the tip of the arm (230 mm) passes over it.
    const capDistance = Math.hypot(cap.centre[0], cap.centre[1]);
    expect(capDistance - cap.diameter / 2).toBeLessThan(arm.tipRadius);
    expect(capDistance + cap.diameter / 2).toBeGreaterThan(arm.tipRadius);
    expectNear(toMm(arm.bladeUndersideZ - cap.topZ), 11, 1e-9);
    // "the coarse-filter crown (top at about 28 mm, 47 to 123 mm from the axis)".
    const crownDistance = Math.hypot(B.filter.axis[0], B.filter.axis[1]);
    expectNear(toMm(crownDistance - B.filter.coarse.diameter / 2), 47, 2);
    expectNear(toMm(crownDistance + B.filter.coarse.diameter / 2), 123, 2);
    expectNear(toMm(arm.bladeUndersideZ - must(B.filter.coarse.crownTopZ)), 8, 1e-9);
  });
});

describe('the vertical stack-up as the owner measured it (owner update 4.1 to 4.3, z above the filter plate)', () => {
  const lowerOriginZ = basketOrigin(B, 'lower')[2];

  it("lower arm: underside 36 mm, top face 50 mm, nozzle exits 52 mm (not measured: the dossier's values kept)", () => {
    const arm = getSprayArm(B, 'lower');
    expect(arm.mount).toEqual({ kind: 'tub' });
    expectNear(toMm(arm.bladeUndersideZ), 36, 1e-9);
    expectNear(toMm(arm.topFaceZ), 50, 1e-9);
    expectNear(toMm(must(arm.nozzleUpZ)), 52, 1e-9);
    expectNear(toMm(must(arm.nozzleDownZ)), 36, 1e-9);
    expectNear(toMm(arm.shape.bladeThickness), 14, 1e-9);
    // "Filter plate to top of lower arm: not measured": still an estimate.
    expect(provenanceTagOf(arm.provenance, 'topFaceZ')).toBe('estimated');
  });

  it("closes the owner's tape readings: 50 + 15 + 300 + 55 + 220 = 640 mm (owner update 4.2)", () => {
    const arm = getSprayArm(B, 'lower');
    const upperArm = getSprayArm(B, 'upper');
    const upperFloor = basketOrigin(B, 'upper', atLevel('1'))[2];
    // The lowest floor wires: whichever family lies lower, at its underside. The arm passes
    // under them, and a tape held between arm and basket shows the gap to them.
    const wireUnderside =
      lowerOriginZ +
      Math.min(lower.floor.alongX.z, lower.floor.alongY.z) -
      lower.wires.floor.coated / 2;
    const hub = upperFloor + upperArm.hubUndersideZ;
    // a: top of the lower arm to the lower-basket floor wire, 1.5 cm.
    expectNear(toMm(wireUnderside - arm.topFaceZ), 15, 1e-9, 'reading a');
    // b: lower-basket floor wire to the underside of the upper arm (its hub), 30 cm.
    expectNear(toMm(hub - wireUnderside), 300, 1e-9, 'reading b');
    // c: top-basket floor to the roof, 22 cm.
    expectNear(toMm(B.tub.z[1] - upperFloor), 220, 1e-9, 'reading c');
    // d: filter plate to the roof, 64 cm.
    expectNear(toMm(B.tub.z[1] - B.tub.z[0]), 640, 1e-9, 'reading d');
    // e: filter plate to the underside of an upper-arm blade, 390 +-7 mm on the tape standing
    // in the tub in IMG_9109.
    expectNear(toMm(upperFloor + upperArm.bladeUndersideZ), 390, 7, 'reading e');
    // The hub is 30 mm deep and the blade 11 mm thick: blade underside 19 to 21 mm above the
    // lowest point of the hub (update: 384 from the hub, 386 adopted).
    expectNear(toMm(upperArm.bladeUndersideZ - upperArm.hubUndersideZ), 21, 1e-9);
    expectNear(toMm(upperArm.topFaceZ - upperArm.bladeUndersideZ), 11, 1e-9);
    expectNear(toMm(upperArm.shape.bladeThickness), 11, 1e-9);
    // The stack was taken with the upper basket at level 1, the default.
    expect(B.defaultConfig.basketHeights).toEqual({ upper: '1' });
  });

  it('lower rack: the lowest floor wires at 65 / 67 / 69, the cross wires 4 mm above them, rails 84, tine tips 150 / 166, rim 243 / 216 mm', () => {
    // Table of section 4.3 of the update: "Lower-basket floor wires: underside / centre / top
    // 65 / 67 / 69", 15 mm above the lower arm. The floor has two layers (IMG_9081: the two
    // left-right cross wires pass over the five front-back wires), and the 15 mm is taken to
    // the lowest, the front-back wires. The rack frame's z = 0 is the top of the cross wires.
    expect(lower.floor.upperLayer).toBe('alongX');
    const lowest = lowerOriginZ + lower.floor.alongY.z;
    const radius = lower.wires.floor.coated / 2;
    expectList(
      [lowest - radius, lowest, lowest + radius].map(toMm),
      [65, 67, 69],
      1e-9,
      'front-back wires',
    );
    expectNear(toMm(lower.floor.alongX.z - lower.floor.alongY.z), 4, 1e-9, 'one wire higher');
    expectNear(toMm(lowerOriginZ + lower.floor.alongX.z), 71, 1e-9, 'cross-wire centres');
    expectNear(toMm(lowerOriginZ), 73, 1e-9, 'top of the grid');
    // The owner's tape, +-5 mm: no floor wire is nearer than 15 mm to the top of the lower arm.
    expectNear(toMm(lowest - radius - getSprayArm(B, 'lower').topFaceZ), 15, 5);
    const r1 = getTineRow(lower, 'r1');
    const ml = getTineRow(lower, 'ml');
    // The dossier gives rails, tine tips and rims relative to the cross wires, whose centres are
    // at its own 71 mm: 84 mm, 150 and 166 mm, 243 and 216 mm.
    expectNear(toMm(lowerOriginZ + r1.railZ), 84, 1e-9, 'rails');
    expectNear(toMm(lowerOriginZ + ml.railZ), 84, 1e-9, 'rails');
    expectNear(toMm(lowerOriginZ + r1.railZ + r1.height), 150, 1e-9, 'rear tine tips');
    expectNear(toMm(lowerOriginZ + ml.railZ + ml.height), 166, 1.5, 'side tine tips');
    const rim = (side: string) => {
      const wall = must(lower.walls.find((w) => w.side === side));
      return toMm(lowerOriginZ + must(wall.horizontalWireZ[wall.horizontalWireZ.length - 1]));
    };
    expectNear(rim('left'), 243, 1e-9);
    expectNear(rim('right'), 243, 1e-9);
    expectNear(rim('rear'), 243, 1e-9);
    expectNear(rim('front'), 216, 1e-9);
    // The wheels still stand on their ledges: axle at the cross-wire centres, 35 mm wheels.
    const wheels = must(lower.wheels);
    expectNear(
      toMm(lowerOriginZ + wheels.axleZ - wheels.diameter / 2),
      toMm(must(B.tub.wheelLedgeZ)),
      1e-9,
    );
  });

  it("cutlery basket: rim about 198 mm, top of its handle about 290 mm (the dossier's heights)", () => {
    const cutlery = must(B.cutleryBasket);
    expectNear(toMm(lowerOriginZ + cutlery.size[2]), 198, 3);
    expectNear(toMm(lowerOriginZ + cutlery.heightWithHandle), 290, 4);
  });

  // [level, lowest point of the hub, blade underside, top face, floor wire tops] from the
  // table of section 4.3 (the dossier had the floor at 410 / 385 / 360).
  it.each([
    ['1', 365, 386, 397, 420],
    ['2', 340, 361, 372, 395],
    ['3', 315, 336, 347, 370],
  ] as const)(
    'Rackmatic level %s: hub %i, blade underside %i, top face %i, floor wire tops %i mm',
    (level, hub, underside, top, floor) => {
      const config = atLevel(level);
      const arm = getSprayArm(B, 'upper');
      const datum = sprayLevelDatumZ(B, arm, config.basketHeights);
      expectNear(toMm(basketOrigin(B, 'upper', config)[2]), floor, 1e-9);
      expectNear(toMm(datum + arm.hubUndersideZ), hub, 1e-9);
      expectNear(toMm(datum + arm.bladeUndersideZ), underside, 1e-9);
      expectNear(toMm(datum + arm.topFaceZ), top, 1e-9);
      // Section 7: hub_underside_z floor - 55; nozzle exits at floor - 21; the underside hole
      // U8 leaves from the blade underside at floor - 34.
      expectNear(toMm(datum + arm.hubUndersideZ), floor - 55, 1e-9);
      expectNear(toMm(datum + must(arm.nozzleUpZ)), floor - 21, 1e-9);
      expectNear(toMm(datum + must(arm.nozzleDownZ)), floor - 34, 1e-9);
    },
  );

  it('level 1 is the highest and the default; the levels are 25 mm apart: 420 / 395 / 370 mm', () => {
    expect(upper.pose.heightPositions.map((p) => p.id)).toEqual(['1', '2', '3']);
    const z = upper.pose.heightPositions.map((p) => toMm(p.originZ));
    expectList(z, [420, 395, 370], 1e-9, 'floor heights');
    expect(upper.pose.provenance.tag).toBe('measured');
    expect(B.defaultConfig.basketHeights).toEqual({ upper: '1' });
    expect(basketHeightPosition(B, 'upper').id).toBe('1');
    expect(upper.pose.canTilt).toBe(true);
    expect(lower.pose.heightPositions).toHaveLength(1);
  });

  it('roof 640 mm, roof spinner outlet 625 and lower face 610 mm (dossier: 675, 660, 645)', () => {
    const roof = getSprayLevel(B, 'roof');
    if (roof.kind !== 'fixed') throw new Error('the roof spinner is not an arm');
    expectNear(toMm(B.tub.z[1]), 640, 1e-9);
    // "Roof spinner, lower face 610: roof - 30, as the dossier"; outlet "roof less 15".
    expectNear(toMm(roof.lowerFaceZ), 610, 1e-9);
    expectNear(toMm(roof.outletZ), 625, 1e-9);
    // Static lift of the roof branch: the outlet plus the 60 mm to the sump level, 0.69 m.
    expectNear(roof.outletZ + B.hydraulics.sumpLevelBelowDatum, 0.685, 1e-9);
    expectNear(getBranch(B, 'roof').staticLift, 0.69, 1e-12);
  });

  // Clear heights by Rackmatic level, from the heights of section 4.3: above the upper floor
  // (its troughs) to the spinner (610) and the roof (640); above the top of the lower grid (73)
  // to the upper arm's blades and to the lowest point of its hub. The dossier's section 5.1 had
  // 235 / 265 and 301 / 282 at level 1.
  it.each([
    ['1', 190, 220, 313, 292],
    ['2', 215, 245, 288, 267],
    ['3', 240, 270, 263, 242],
  ] as const)(
    'level %s clear heights: %i / %i above the upper floor, %i / %i above the lower floor',
    (level, toSpinner, toRoof, toBlades, toHub) => {
      const config = atLevel(level);
      const upperZ = basketOrigin(B, 'upper', config)[2];
      const roof = getSprayLevel(B, 'roof');
      if (roof.kind !== 'fixed') throw new Error('the roof spinner is not an arm');
      const arm = getSprayArm(B, 'upper');
      expectNear(toMm(roof.lowerFaceZ - upperZ), toSpinner, 1e-9);
      expectNear(toMm(B.tub.z[1] - upperZ), toRoof, 1e-9);
      expectNear(toMm(upperZ + arm.bladeUndersideZ - lowerOriginZ), toBlades, 1e-9);
      expectNear(toMm(upperZ + arm.hubUndersideZ - lowerOriginZ), toHub, 1e-9);
    },
  );
});

describe('lower basket (section 2.3; racks.lower)', () => {
  it('is 525 x 512 mm outside, 519 x 507 mm between rim wire centres, with chamfered front corners', () => {
    expect(lower.frame).toBe('lower_rack');
    expect(lower.part).toContain('20001979');
    expectList(lower.outline.size.map(toMm), [525, 512], 1e-9, 'outer size');
    expectList(lower.outline.rimCentres.map(toMm), [519, 507], 1e-9, 'rim centres');
    for (const corner of [lower.outline.corners.frontLeft, lower.outline.corners.frontRight]) {
      if (corner.kind !== 'chamfer') throw new Error('front corners are chamfered');
      expectNear(toMm(corner.dx), 41, 1e-9);
      expectNear(toMm(corner.dy), 59, 1e-9);
    }
    expect(lower.mass).toBe(1.9);
  });

  it('has the rear wall of 4 wires and 5 uprights, set forward 6 mm over 60 mm for the riser', () => {
    const rear = must(lower.walls.find((w) => w.side === 'rear'));
    expect(rear.horizontalWireZ).toHaveLength(4);
    expect(rear.uprights).toHaveLength(5);
    // Rim 172 mm above the floor cross wires at the sides and back, 145 mm at the front.
    expectNear(lowerZ(must(rear.horizontalWireZ[3])), 172, 1e-9);
    const front = must(lower.walls.find((w) => w.side === 'front'));
    expectNear(lowerZ(must(front.horizontalWireZ[front.horizontalWireZ.length - 1])), 145, 1e-9);
    const recess = must(lower.outline.recesses[0]);
    expect(recess.side).toBe('rear');
    expectList(recess.span.map(lowerX), [-30, 30], 1e-9, 'recess');
    expectNear(toMm(recess.depth), 6, 1e-9);
    // "about 60 mm in the middle (80 mm with the two ramps)".
    expectNear(toMm(recess.span[1] - recess.span[0] + 2 * recess.ramp), 80, 1e-9);
  });

  it('has 5 front-back floor wires at x = -199, -86, -19, +98, +179 and 2 cross wires at y = +32, -43', () => {
    expectList(
      lower.floor.alongY.positions.map(lowerX),
      [-199, -86, -19, 98, 179],
      1e-9,
      'front-back wires',
    );
    expectList(lower.floor.alongX.positions.map(lowerY), [-43, 32], 1e-9, 'cross wires');
    // "gaps 113, 67, 117, 81 mm".
    const x = lower.floor.alongY.positions.map(toMm);
    expectList(
      x.slice(1).map((v, i) => v - must(x[i])),
      [113, 67, 117, 81],
      1e-9,
      'gaps',
    );
    expectList(lower.floor.largestOpening.map(toMm), [115, 100], 1e-9, 'largest opening');
    expectNear(toMm(lower.floor.alongY.crank), 20, 1e-9);
  });

  it('has wires of 5.5 mm (rim) and 4.0 mm (floor and tines) over the coating', () => {
    expectNear(toMm(lower.wires.rim.coated), 5.5, 1e-9);
    expectNear(toMm(lower.wires.floor.coated), 4.0, 1e-9);
    expectNear(toMm(lower.wires.tine.coated), 4.0, 1e-9);
    expectNear(toMm(lower.wires.rim.steel), 5.0, 1e-9);
    expectNear(toMm(lower.wires.floor.steel), 3.4, 1e-9);
    expectNear(toMm(lower.wires.coating), 0.4, 1e-9);
  });

  it('has 6 tine rows, all running left-right: 23, 23, 7, 7, 6, 6 tines', () => {
    expect(lower.tineRows.map((r) => [r.label, r.tinePositions.length])).toEqual([
      ['R1', 23],
      ['R2', 23],
      ['ML', 7],
      ['MR', 7],
      ['FL', 6],
      ['FR', 6],
    ]);
    expect(lower.tineRows.every((r) => r.runs === 'x')).toBe(true);
    // Two hinged rows (R1, R2), four fixed.
    expect(lower.tineRows.filter((r) => r.hinge !== null).map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(lower.tineRows.every((r) => r.defaultState === 'up')).toBe(true);
    expect(lower.tineRows.every((r) => r.tip === 'ball')).toBe(true);
    // Rails 13 mm above the floor cross wires, hinged and fixed alike.
    for (const row of lower.tineRows) expectNear(lowerZ(row.railZ), 13, 1e-9, row.id);
  });

  it.each(['r1', 'r2'] as const)(
    'rear row %s: 15 tines leaning left then 8 leaning right at 18.25 mm',
    (id) => {
      const row = getTineRow(lower, id);
      expectNear(lowerY(row.railAt), id === 'r1' ? 167 : 68, 1e-9);
      // "tine bases at x = -208 + 18.25 k (k = 0 to 21) and +202".
      const expected = [...Array.from({ length: 22 }, (_, k) => -208 + 18.25 * k), 202];
      expectList(row.tinePositions.map(lowerX), expected, 1e-9, 'tine bases');
      expect(row.leanToward.slice(0, 15).every((d) => d === '-x')).toBe(true);
      expect(row.leanToward.slice(15).every((d) => d === '+x')).toBe(true);
      expect(row.leanToward).toHaveLength(23);
      expectNear(toMm(row.pitch), 18.25, 1e-9);
      expectNear(toMm(row.height), 66, 1e-9);
      expectNear(radToDeg(row.lean), 15, 1e-9);
      // "66 mm high above the rail (68 mm long)".
      expectNear(toMm(row.height / Math.cos(row.lean)), 68, 0.5);
      // "the last tine on the right 27 mm from its neighbour".
      const x = row.tinePositions.map(toMm);
      expectNear(must(x[22]) - must(x[21]), 27, 0.3);
      // V gap: the 15th and 16th tine (x = +48 and +66) have their tips 53 mm apart.
      expectNear(lowerX(must(row.tinePositions[14])), 48, 0.6);
      expectNear(lowerX(must(row.tinePositions[15])), 66, 0.6);
      const reach = toMm(row.height * Math.tan(row.lean));
      expectNear(must(x[15]) + reach - (must(x[14]) - reach), 53, 1.0);
      // 21 usable gaps of 18.2 mm.
      const gaps = x
        .slice(1)
        .map((v, i) => v - must(x[i]))
        .filter((g) => Math.abs(g - 18.25) < 1e-6);
      expect(gaps).toHaveLength(21);
    },
  );

  it('the rear rails are 99 mm apart and 86 mm in front of the rear wall', () => {
    const r1 = getTineRow(lower, 'r1');
    const r2 = getTineRow(lower, 'r2');
    expectNear(toMm(r1.railAt - r2.railAt), 99, 1e-9);
    // "The basket's rear wall is 86 mm behind rail R1 and its front wall 68 mm in front of rail FL."
    const rimInset = (512 - 507) / 2;
    expectNear(512 - rimInset - toMm(r1.railAt), 86, 1);
    expectNear(toMm(getTineRow(lower, 'fl').railAt) - rimInset, 68, 1);
    // "A 31 cm plate ... astride ML and R2 (rails 148 mm apart)".
    expectNear(toMm(r2.railAt - getTineRow(lower, 'ml').railAt), 148, 1e-9);
  });

  it('side rows: 7 tines at 26.0 mm (ML, MR), 6 at 25.4 mm (FL, FR), 81 mm high, leaning 17 deg outward', () => {
    const rows: readonly (readonly [string, number, readonly number[], '-x' | '+x', number])[] = [
      ['ml', -80, [-206, -179, -152, -127, -101, -75, -50], '-x', 26.0],
      ['mr', -80, [50, 75, 101, 127, 152, 179, 206], '+x', 26.0],
      ['fl', -186, [-201, -177, -150, -125, -98, -73], '-x', 25.4],
      ['fr', -186, [73, 98, 125, 150, 177, 201], '+x', 25.4],
    ];
    for (const [id, y, x, lean, pitch] of rows) {
      const row = getTineRow(lower, id);
      expectNear(lowerY(row.railAt), y, 1e-9, id);
      expectList(row.tinePositions.map(lowerX), x, 1e-9, `${id} bases`);
      expect(row.leanToward.every((d) => d === lean)).toBe(true);
      expectNear(toMm(row.pitch), pitch, 1e-9);
      expectNear(toMm(row.height), 81, 1e-9);
      expectNear(radToDeg(row.lean), 17, 1e-9);
      expect(row.hinge).toBeNull();
    }
    // The right-hand rows mirror the left-hand ones.
    const mirror = (a: TineRowSpec, b: TineRowSpec) =>
      expectList(
        a.tinePositions.map(lowerX),
        b.tinePositions.map((p) => -lowerX(p)).reverse(),
        1e-9,
        'mirror',
      );
    mirror(getTineRow(lower, 'ml'), getTineRow(lower, 'mr'));
    mirror(getTineRow(lower, 'fl'), getTineRow(lower, 'fr'));
  });

  it('has 8 wheels of 35 mm at y = +221, +125, -63, -159 on a 534 mm track, and the handle', () => {
    const wheels = must(lower.wheels);
    expect(wheels.count).toBe(8);
    expectNear(toMm(wheels.diameter), 35, 1e-9);
    expectList(wheels.stationsY.map(lowerY), [-159, -63, 125, 221], 1e-9, 'wheel stations');
    expectNear(toMm(wheels.track), 534, 1e-9);
    const handle = must(lower.handle);
    // 215 mm long as the part page; depth and height read from O80 and O81 (a bar in front of
    // the rim, not the 52 x 47 mm moulding with the tablet trough of the upper basket).
    expectList(handle.size.map(toMm), [215, 20, 24], 1e-9, 'handle');
    expectNear(lowerX(handle.centreX), 0, 1e-9);
    expect(handle.part).toBe('12033368');
  });

  it('carries the printed plate limits: 30 / 27.5 / 25 cm by upper-basket level, 31 cm "as shown"', () => {
    const limits = must(lower.limits);
    expect(limits.positionOfBasket).toBe('upper');
    expectNear(toMm(must(limits.maxDiameterByPosition['1'])), 300, 1e-9);
    expectNear(toMm(must(limits.maxDiameterByPosition['2'])), 275, 1e-9);
    expectNear(toMm(must(limits.maxDiameterByPosition['3'])), 250, 1e-9);
    const shown = must(limits.maxDiameterAsShown);
    expectNear(toMm(shown.diameter), 310, 1e-9);
    expect(shown.positionId).toBe('1');
    expect(shown.where).toContain('ML');
    expect(shown.where).toContain('R2');
    expectList(
      limits.seating.map((s) => toMm(s.maxDiameter)),
      [265, 240],
      1e-9,
      'seating',
    );
  });

  it('a 30 cm plate in the rear rows tops out near 372 mm: 14 mm clear of the blades, 7 mm above the hub (owner update 4.3, with the grid top at 73 mm)', () => {
    // Dossier 5.1: "A larger plate ... rests on one rail and leans on the wall, and needs ...
    // D cos 15 + 9 mm at 30 cm", 299 mm above the tops of the floor wires. The dossier had 301 mm
    // available under the blades, a 2 mm margin. Owner update: "tops out ... near 368 mm: 18 mm
    // clear of the blades (386 mm) but 3 mm above the lowest point of the hub (365 mm), which
    // the rear rows do not pass under." The update counted from wire tops at 69 mm; with the
    // owner's 15 mm taken to the lowest wires the top of the grid is at 73 mm and the plate
    // stands 4 mm higher.
    const needed = 300 * Math.cos(getTineRow(lower, 'r1').lean) + 9;
    expectNear(needed, 299, 0.5);
    const lowerZ = toMm(basketOrigin(B, 'lower')[2]);
    const arm = getSprayArm(B, 'upper');
    const upperZ = toMm(basketOrigin(B, 'upper', atLevel('1'))[2]);
    const top = lowerZ + needed;
    expectNear(top, 368 + 4, 0.5);
    expectNear(upperZ + toMm(arm.bladeUndersideZ) - top, 18 - 4, 0.5);
    expectNear(upperZ + toMm(arm.hubUndersideZ) - top, -3 - 4, 0.5);
    // The hub (49 mm across, on the upper-arm axis) is more than a plate radius in front of
    // the rail of the rearmost row, on which such a plate rests.
    const railY = toMm(basketOrigin(B, 'lower')[1] + getTineRow(lower, 'r1').railAt);
    const hubRear = toMm(arm.axis[1] + must(arm.shape.hubDiameter) / 2);
    expect(railY - hubRear).toBeGreaterThan(150);
  });
});

describe('upper basket (section 2.5; racks.upper)', () => {
  it('is 500 mm wide and about 500 mm deep, with a 120 mm wall and a front wall of two rails at 38.5 and 91 mm, on the upper-arm axis', () => {
    expect(upper.frame).toBe('upper_rack');
    expectNear(toMm(upper.outline.size[0]), 500, 1e-9, 'outer width');
    // The dossier took the depth from a sister basket (476 +-25, "spanning y = -228 to +248
    // from the arm axis", the rear rim being outside the photograph). The fittings at their
    // published lengths need more: the knife shelf (389 mm) starts at y = -119 and the cup
    // shelves (200 + 252 mm) at -200 in IMG_9083, +-10 mm, so both end near +268.
    const knife = must(upper.holders.find((h) => h.kind === 'knife_shelf'));
    const rear = upperY(upper.outline.size[1]);
    expectNear(rear, -119 + 389, 15, 'rear rim against the knife shelf');
    expectNear(rear, -200 + 200 + 252, 20, 'rear rim against the cup shelves');
    expect(upperY(knife.y[1])).toBeLessThanOrEqual(rear + 1e-9);
    for (const shelf of upper.cupShelves) expect(upperY(shelf.y[1])).toBeLessThanOrEqual(rear);
    expectNear(toMm(upper.outline.size[1]), 476, 25, 'still inside the dossier range');
    // The arm axis is 30 mm in front of the lower-arm axis; the front edge is 228 mm in front
    // of it.
    const origin = basketOrigin(B, 'upper');
    expectNear(toMm(origin[0]), -244, 1e-9);
    expectNear(toMm(origin[1]), -30 - 228, 1e-9);
    const rim = (side: string) => {
      const wall = must(upper.walls.find((w) => w.side === side));
      return toMm(must(wall.horizontalWireZ[wall.horizontalWireZ.length - 1]));
    };
    expectNear(rim('left'), 120, 1e-9);
    expectNear(rim('rear'), 120, 1e-9);
    // IMG_9131 (the basket end-on at floor height, 2026-10-11): the front wall has two rails,
    // 42 and 94.5 mm above the tops of the left-right floor wires (+-1.5 and +-2.5), which lie
    // one 3.5 mm wire under the frame's zero. The upper one is the rim; the lower one is what
    // the dossier took for a front wall of 55 mm. Both were one wire at 55 before.
    const front = must(upper.walls.find((w) => w.side === 'front'));
    expectList(front.horizontalWireZ.map(toMm), [42 - 3.5, 94.5 - 3.5], 1e-9, 'front rails');
    expectNear(rim('front'), 91, 1e-9);
    // Its uprights as that picture shows them: none at the dossier's -108, one at -130.
    expectList(
      front.uprights.map(upperX),
      [-161, -130, -41, 47, 89, 128, 163],
      1e-9,
      'front uprights',
    );
    expect(upper.mass).toBe(2.3);
    // Wire gauges, IMG_9131 at 10.9 px/mm: the rails 5.1 mm (+-0.3), so the rim is 5.1 (it was
    // 3.5); the floor wire 3.6 (+-0.15), which confirms 3.5.
    expectNear(toMm(upper.wires.floor.coated), 3.5, 1e-9);
    expectNear(toMm(upper.wires.rim.coated), 5.1, 1e-9);
    expectNear(toMm(upper.wires.floor.coated), 3.6, 0.15);
    // The rim centre lines keep the outer size: 500 x 498 less one rim wire.
    expectList(upper.outline.rimCentres.map(toMm), [500 - 5.1, 498 - 5.1], 1e-9, 'rim centres');
  });

  it('has 12 left-right floor wires at 36.5 mm, the bottom wire of the front wall, one assumed at the rear, and 12 front-back wires', () => {
    // The dossier's twelve; the bottom wire of the front wall, which IMG_9083 shows about
    // 41 mm in front of the first of them and the perspective of IMG_9131 puts 37.2 mm in front
    // of it (+-0.5); and one more at the same pitch behind the last, where the photograph ends
    // and the deeper basket would have no floor.
    const y = upper.floor.alongX.positions.map(upperY);
    expectList(
      y.slice(1, 13),
      [-187, -149, -112, -76, -40, -3, 36, 69, 105, 142, 178, 215],
      1e-9,
      'left-right wires',
    );
    expect(y).toHaveLength(14);
    expectNear(must(y[1]) - must(y[0]), 41, 10, 'the front wire, IMG_9083');
    expectNear(must(y[1]) - must(y[0]), 37.2, 0.5, 'the front wire, IMG_9131');
    expect(must(y[0])).toBeGreaterThan(-228);
    expectNear(must(y[13]) - must(y[12]), 36.5, 1e-9, 'the assumed rear wire');
    expect(must(y[13])).toBeLessThan(upperY(upper.outline.size[1]));
    expect(provenanceTagOf(upper.floor.provenance, 'alongX.positions')).toBe('estimated');
    expectNear(toMm(must(upper.floor.alongX.pitch)), 36.5, 1e-9);
    expectList(
      upper.floor.alongY.positions.map(upperX),
      [-212, -195, -161, -108, -41, 0, 47, 89, 128, 163, 196, 214],
      1e-9,
      'front-back wires',
    );
    // "an 88 mm gap over the arm hub and feed tube, about 34 mm pitch in the right-hand cup zone":
    // the dossier's gap between -41 and +47 is halved by the centre wire IMG_9083 shows at x = 0
    // (image x = 2790 against the hub at 2793, 8.2 px/mm), the wire the feed tube hangs from.
    const x = upper.floor.alongY.positions.map(upperX);
    expectNear(must(x[6]) - must(x[4]), 88, 1e-9);
    expectNear(must(x[5]), (2790 - 2793) / 8.2, 5, 'centre wire');
    // The dossier had "about 34 mm pitch in the right-hand cup zone" (89, 123, 158, 191).
    // IMG_9131 moves the three outer wires outwards: +128 (the upright right of the handle,
    // +-5), +163 (the wire that runs back from the hooked upright, +-3) and +196 (the wire that
    // ends in a ball at the front wall, +-3), and shows one more at +214, the foot of the inner
    // upright of the front right corner (+-6).
    expectList(x.slice(7), [89, 128, 163, 196, 214], 1e-9, 'right-hand wires');
    for (const gap of [must(x[9]) - must(x[8]), must(x[10]) - must(x[9])]) expectNear(gap, 34, 1.5);
    // On the left the hooked wire is at -161 (it reads -161.8 at the second floor wire; the
    // dossier had -159).
    expectNear(must(x[2]), -161.8, 3, 'left hooked wire');
    // The two wires by the left wall: image x = 1190 and 1055 of IMG_9083 on the floor scale.
    // They were brought in by 820 / 850 for a raised strip that IMG_9131 shows is not there
    // (the floor is low from x = -200 to the wall); that picture has the ball of the inner one
    // at -195.2.
    expectNear(must(x[1]), (1190 - 2793) / 8.2, 1, 'by the left wall, inner wire');
    expectNear(must(x[0]), (1055 - 2793) / 8.2, 1, 'by the left wall, outer wire');
    expectNear(must(x[1]), -195.2, 3, 'the ball-ended wire of IMG_9131');
    // The wires at -195 and +196 are all but mirror images about the arm axis.
    expectNear(must(x[1]) + must(x[10]), 0, 3);
    // The dossier's twelve span 402 mm front to back.
    expectNear(must(y[12]) - must(y[1]), 402, 1e-9);
  });

  it('has the floor relief measured on IMG_9131: two triangular ridges falling outwards, a level trough, a centre ridge and a ramp', () => {
    // IMG_9131 (2026-10-11): the basket end-on at floor height; the bottom wire of the front
    // wall in true profile at 10.9 px/mm, the next four wires the same within 0.5 mm. The
    // points are the corners of the centre lines of the straight runs, x from the arm axis,
    // rise above the level of the left trough (docs/reference/owner-measurements.md has the
    // readings). They replace the profile read from IMG_9083 by parallax:
    // [-155, 30], [-140, 0], [-27, 0], [-9, 30], [118, 0], [132, 32], [178, 0].
    const relief = must(upper.floor.relief);
    expect(relief.axis).toBe('x');
    const expected: readonly (readonly [number, number, string])[] = [
      [-199.6, -1.0, 'the left slope meets the low run by the wall'],
      [-152.3, 30.1, 'left peak'],
      [-137.3, 0, 'foot of the left steep face'],
      [-30, 0, 'base of the centre ridge'],
      [-10, 33.4, 'centre ridge (hidden by the handle: where the two visible lines cross)'],
      [138.4, -2.9, 'foot of the right steep face'],
      [143.8, 37.6, 'right peak'],
      [198.9, -1.5, 'the right slope meets the low run by the wall'],
    ];
    expect(relief.points).toHaveLength(expected.length);
    expected.forEach(([x, riseMm, what], i) => {
      const point = must(relief.points[i]);
      expectNear(upperX(point.at), x, 1e-9, `${what}: x`);
      expectNear(toMm(point.rise), riseMm, 1e-9, `${what}: rise`);
    });
    const rise = (xMm: number) => toMm(floorRiseAt(upper.floor, (xMm + 244) / 1000, 0.2));
    const angle = (a: number, b: number) =>
      radToDeg(Math.atan(Math.abs(rise(b) - rise(a)) / Math.abs(b - a)));
    // The measured angles of the straight runs (+-1 degree): the two outward slopes, the two
    // steep inner faces, and the ramp from the centre ridge to the foot of the right ridge.
    expectNear(angle(-199.6, -152.3), 33.2, 0.5, 'left slope');
    expectNear(angle(143.8, 198.9), 35.3, 0.5, 'right slope');
    expectNear(angle(-152.3, -137.3), 63.5, 0.5, 'left steep face');
    expectNear(angle(138.4, 143.8), 82.5, 0.5, 'right steep face');
    expectNear(angle(-10, 138.4), 13.6, 0.5, 'ramp');
    // The left trough is the datum: level from the foot of the left ridge to the centre ridge.
    for (const x of [-137, -112, -80, -52, -31]) expectNear(rise(x), 0, 0.1, `trough at ${x}`);
    // NOT a raised strip under the knife shelf (the profile before had 30 mm from -155 to the
    // wall): the slope reaches floor level 198 mm from the axis and the floor is low from there
    // to both walls, 1 to 1.5 mm under the trough level.
    expectNear(rise(-198), 0, 0.2, 'left slope at floor level');
    for (const x of [-240, -220, -200]) expectNear(rise(x), -1.0, 1e-9, `by the left wall at ${x}`);
    for (const x of [200, 220, 250]) expectNear(rise(x), -1.5, 1e-9, `by the right wall at ${x}`);
    // The right ridge above its own foot, and the left one: 35.9 and 27.7 mm seen at the tops
    // of the bends; the corners given here stand 4.6 and 2.4 mm above that, which is what the
    // rounded bends take off them (the geometry test pins the built tops).
    expectNear(rise(143.8) - rise(138.4), 35.9 + 4.6, 0.5, 'right corner above its foot');
    expectNear(rise(-152.3) - rise(-137.3), 27.7 + 2.4, 0.5, 'left corner above its foot');
    // No flat trough on the right: the ramp runs down to the foot of the steep face.
    expect(rise(120)).toBeGreaterThan(rise(138.4) + 4);
    // The centre ridge is over the feed tube of the arm (x = 0), as IMG_9083 has it (the ridge
    // at image x = 2700 with the hub at 2793 and 8.2 px/mm: -11).
    expectNear(
      upperX(must(relief.points[4]).at),
      (2700 - 2793) / 8.2,
      3,
      'centre ridge from above',
    );
    expect(rise(0)).toBeGreaterThan(25);
    // WHERE THE RIGHT RIDGE IS. The earlier profile had it at +132 and another reading at +172.
    // IMG_9083 has the foot of its steep face 90 px outside the front-back wire that IMG_9131
    // puts at +128, on cross wires 300 mm behind the front where that oblique picture has about
    // 7.4 px/mm, not the 8.2 it has near the front: +128 + 90 / 7.4 = +140.
    expectNear(upperX(must(relief.points[5]).at), 128 + (3780 - 3690) / 7.4, 3, 'foot from above');
    // +172 is the middle of the outer slope.
    expectNear((143.8 + 198.9) / 2, 172, 2);
    expect(provenanceTagOf(upper.floor.provenance, 'relief')).toBe('photo');
    // No hump is left on top of the relief.
    expect(upper.floor.alongX.humps).toHaveLength(0);
  });

  it("has 5 tine lines (A, B, A', B', C), all running front-back, C hinged in two halves", () => {
    expect(upper.tineRows.every((r) => r.runs === 'y')).toBe(true);
    expect(upper.tineRows.map((r) => [r.id, r.tinePositions.length])).toEqual([
      ['a', 6],
      ['b', 6],
      ['a2', 9],
      ['b2', 9],
      ['c_rear', 6],
      ['c_front', 5],
    ]);
    // Only the right-hand line folds: "rechts, hinten" and "rechts, vorn".
    expect(upper.tineRows.filter((r) => r.hinge !== null).map((r) => r.id)).toEqual([
      'c_rear',
      'c_front',
    ]);
    const rows: readonly (readonly [string, number, readonly number[], number])[] = [
      ['a', -112, [31, 68, 103, 139, 175, 210], 95],
      ['b', -52, [34, 70, 101, 137, 174, 207], 95],
      // Hairpin rows: 57 mm. IMG_9131 has the tip of the nearest tine of row A' 57.5 mm (+-3)
      // above the tops of the floor wires; the dossier's estimate was about 45. Row B' is
      // hidden by the tablet tray in that picture and is given the same height.
      ['a2', -112, [-161, -141, -122, -104, -86, -68, -49, -31, -12], 57],
      ['b2', -51, [-163, -143, -121, -104, -86, -68, -50, -32, -14], 57],
      // Row C: 76 mm. In IMG_9131 the tips of three of its tines are 93.5 mm above the tops of
      // the floor wires, 75.5 mm above the rail, and none shows above the upper front rail; the
      // dossier had 88 +-6 mm.
      ['c_rear', 60, [19, 56, 93, 130, 166, 205], 76],
      ['c_front', 60, [-165, -127, -91, -52, -17], 76],
    ];
    for (const [id, x, y, height] of rows) {
      const row = getTineRow(upper, id);
      expectNear(upperX(row.railAt), x, 1e-9, id);
      expectList(row.tinePositions.map(upperY), y, 1e-9, `${id} tines`);
      // Tip height above the tops of the floor wires where the row stands (the hinged row C
      // stands on the ramp of the floor relief, 16.3 mm above the left trough).
      const floor = floorRiseAt(upper.floor, row.railAt, 0.2);
      expectNear(toMm(row.railZ + row.height - floor), height, 2, `${id} height`);
    }
    // Tall rows at 36 mm pitch, hairpin rows at 18.6 mm, the hinged row at 37 mm leaning 11 deg right.
    expectNear(toMm(getTineRow(upper, 'a').pitch), 36, 1e-9);
    expectNear(toMm(getTineRow(upper, 'a2').pitch), 18.6, 1e-9);
    expect(getTineRow(upper, 'a2').form).toBe('hairpin');
    expect(getTineRow(upper, 'b2').form).toBe('hairpin');
    for (const id of ['c_rear', 'c_front']) {
      const row = getTineRow(upper, id);
      expectNear(toMm(row.pitch), 37, 1e-9);
      expectNear(radToDeg(row.lean), 11, 1e-9);
      expect(row.leanToward.every((d) => d === '+x')).toBe(true);
    }
    // "6 behind the latch at y = 0 and 5 in front".
    expect(getTineRow(upper, 'c_rear').tinePositions.every((p) => upperY(p) > 0)).toBe(true);
    expect(getTineRow(upper, 'c_front').tinePositions.every((p) => upperY(p) < 0)).toBe(true);
    // Saucers are "held by both rows 61 mm apart".
    expectNear(toMm(getTineRow(upper, 'b2').railAt - getTineRow(upper, 'a2').railAt), 61, 1e-9);
  });

  it('has the knife shelf on the left and two cup shelves on the right, folded up', () => {
    const knife = must(upper.holders.find((h) => h.kind === 'knife_shelf'));
    expect(knife.side).toBe('left');
    expectList(knife.size.map(toMm), [389, 119, 57], 1e-9, 'knife shelf');
    expectNear(knife.mass, 0.15, 1e-12);
    // IMG_9131: its front lip runs from x = -242 to -144 and the underside behind it to -148;
    // IMG_9083 has the inner edge at about -141 and the tray about 102 mm wide. It was [-254, -135], the
    // published 119 mm, which must include what holds it on the wall.
    expectNear(upperX(knife.x[1]), -143, 1e-9, 'inner edge');
    expectNear(upperX(knife.x[1]), (-144 + -148 + -141) / 3, 2, 'inner edge, three readings');
    expectNear(upperX(knife.x[0]), -242, 1e-9, 'outer edge');
    // Its height, which was not recorded (the geometry hung it 20 mm under the rim, with its
    // underside at 97.75 mm): IMG_9131 has the underside at its front edge 151 to 155 mm above
    // the tops of the left-right floor wires, 147.5 to 151.5 above the frame's zero (+-7). The
    // floor is 4 mm thick in the geometry.
    expectNear(toMm(must(knife.floorZ)) - 4, (147.5 + 151.5) / 2, 1e-9, 'underside');
    expect(provenanceTagOf(knife.provenance, 'floorZ')).toBe('photo');
    // It stands above the side wall, whose rim is at 120 mm.
    expect(toMm(must(knife.floorZ)) - 4).toBeGreaterThan(120 + 2.55);
    expect(knife.folds).toBe(true);
    // Folded up it is stood on the top of the side wall's rim wire (a choice, not seen): turned
    // up at its own height it would reach 249 mm, through the roof 220 mm above the floor.
    expectNear(toMm(must(knife.foldHingeZ)), 120 + 2.5, 1e-9, 'fold hinge');
    expect(provenanceTagOf(knife.provenance, 'foldHingeZ')).toBe('estimated');
    expect(upper.cupShelves).toHaveLength(2);
    expect(upper.cupShelves.every((s) => s.side === 'right')).toBe(true);
    const sizes = upper.cupShelves
      .map((s) => s.size.map(toMm))
      .sort((a, b) => must(a[0]) - must(b[0]));
    expectList(must(sizes[0]), [200, 100, 18], 1e-9, 'short shelf');
    expectList(must(sizes[1]), [252, 97, 22], 1e-9, 'long shelf');
    for (const shelf of upper.cupShelves) {
      // IMG_9131 shows the front shelf folded up: its pins 79 mm above the tops of the
      // left-right wires (75.5 above the frame's zero, +-4) on its underside, which faces the
      // inside of the basket, its thickness between the pins and the wall, and its front end
      // from 48.5 to 138.5 mm, 27 mm of it below the pins. Lowered about those pins the shelf
      // lies above them: underside at 75.5 mm, top one thickness higher (inferred, +12 -6 mm;
      // it was a generic 75 mm for the top, which left 57 and 53 mm under the two shelves).
      const thickness = toMm(must(shelf.size[2]));
      expectNear(toMm(shelf.heightAboveGrid) - thickness, 79 - 3.5, 1e-9, 'underside');
      expect(provenanceTagOf(shelf.provenance, 'heightAboveGrid')).toBe('estimated');
      expectNear(toMm(must(shelf.pivotInset)), 75.5 - 48.5, 1e-9, 'pins from the wall-side edge');
      expect(shelf.defaultState).toBe('up');
      expect(shelf.stemwareNotches).toBe(5);
      expectNear(toMm(shelf.y[1] - shelf.y[0]), toMm(shelf.size[0]), 1e-9);
    }
    // The two pieces lie in line and do not overlap.
    const [front, rear] = [...upper.cupShelves].sort((a, b) => a.y[0] - b.y[0]);
    expect(must(rear).y[0]).toBeGreaterThanOrEqual(must(front).y[1]);
    // Where they are along the walls, from IMG_9083 (+-10 mm). The front lip of the knife shelf
    // is at image y = 2940 at a height of about 120 mm: (2940 - 3600) / 1.164 + 3600 = 3033 on
    // the floor, where the cross wires at y = -187 and -149 are at image y = 3590 and 3270
    // (8.2 px/mm).
    const lipOnFloor = 3600 + (2940 - 3600) / (850 / (850 - 120));
    expectNear(upperY(knife.y[0]), -187 + (3590 - lipOnFloor) / 8.2, 10, 'knife shelf lip');
    // The cross wire at -112 lies under the lip and the one at -149 in front of it.
    expect(upperY(knife.y[0])).toBeGreaterThan(-149);
    expect(upperY(knife.y[0])).toBeLessThan(-112 + 10);
    // The front end of the cup shelves is at image y = 3700, near the nadir.
    expectNear(upperY(must(front).y[0]), -187 - (3700 - 3590) / 8.2, 10, 'cup shelf front end');
  });

  it('has the tablet collecting tray at the front centre, its rim 55 mm above the floor and its front bar 42.5 mm', () => {
    const tray = must(upper.tabletTray);
    expectList(tray.size.map(toMm), [215, 52, 47], 1e-9, 'tray');
    expectNear(toMm(tray.rimZ), 55, 1e-9);
    // IMG_9131: the bar in front, which is the handle, is 34 mm high; its red top edge is 46 mm
    // above the tops of the left-right floor wires (42.5 above the frame's zero, +-2) and its
    // lower edge 10.5 (7.0). The trough behind it stands higher: its rear wall is seen over the
    // bar at about 58 mm, which the rim of 55 and the bottom of 8 already fit.
    expectNear(toMm(must(tray.frontRimZ)), 46 - 3.5, 1e-9, 'top of the bar');
    expectNear(toMm(tray.rimZ - tray.size[2]), 10.5 - 3.5, 2, 'bottom');
    expectNear(toMm(must(tray.frontRimZ) - (tray.rimZ - tray.size[2])), 34, 1, 'front face');
    expect(tray.slotted).toBe(true);
    // x from IMG_9131: the bar runs from -105.5 to +110.2 from the arm axis, centre +2 (+-2; it
    // was +6, "centred on the basket"). Its front face on the basket's front line.
    expectNear(upperX(tray.centre[0]), (-105.5 + 110.2) / 2, 0.5);
    expectNear(toMm(tray.centre[0]), 246, 1e-9);
    expectNear(toMm(tray.centre[1] - tray.size[1] / 2), 0, 1e-9);
  });

  it('carries the printed limits: 22 / 24.5 / 27 cm at level 1 / 2 / 3', () => {
    const limits = must(upper.limits);
    expectNear(toMm(must(limits.maxDiameterByPosition['1'])), 220, 1e-9);
    expectNear(toMm(must(limits.maxDiameterByPosition['2'])), 245, 1e-9);
    expectNear(toMm(must(limits.maxDiameterByPosition['3'])), 270, 1e-9);
    // The dossier had these items reach 630 mm at every level, 15 mm under its roof spinner.
    // With the measured floor and roof they reach the roof itself at every level (owner update
    // 4.3: "A 22 cm item standing upright in the top basket at level 1 reaches the roof (420 +
    // 220 = 640) ... Under the spinner (lower face about 610 mm) only 19 cm fits"): the printed
    // 22 cm is exactly the owner's own reading from the basket floor to the roof.
    const roof = getSprayLevel(B, 'roof');
    if (roof.kind !== 'fixed') throw new Error('the roof spinner is not an arm');
    for (const position of upper.pose.heightPositions) {
      const top = toMm(position.originZ + must(limits.maxDiameterByPosition[position.id]));
      expectNear(top, 640, 1e-9);
      expectNear(top, toMm(B.tub.z[1]), 1e-9);
    }
    const level1 = must(upper.pose.heightPositions.find((p) => p.id === '1'));
    expectNear(toMm(roof.lowerFaceZ - level1.originZ), 190, 1e-9);
  });
});

describe('cutlery basket (section 2.4)', () => {
  const cutlery = must(B.cutleryBasket);

  it('is 230 x 128 x 127 mm, 220 mm with its handle, 338 g, with 6 compartments', () => {
    expectList(cutlery.size.map(toMm), [230, 128, 127], 1e-9, 'body');
    expectNear(toMm(cutlery.widthOverLids), 149, 1e-9);
    expectNear(toMm(cutlery.heightWithHandle), 220, 1e-9);
    expectNear(cutlery.mass, 0.338, 1e-12);
    expect(cutlery.cells).toBe(6);
    expect(cutlery.cellGrid).toEqual([2, 3]);
    expectList(cutlery.sectionsAlongLength.map(toMm), [59, 46, 51, 70], 1e-9, 'sections');
    // The four sections make up the published length within the scale error.
    expectNear(
      cutlery.sectionsAlongLength.reduce((a, b) => a + toMm(b), 0),
      230,
      5,
    );
    expect(cutlery.part).toBe('11057829');
    expect(must(cutlery.lid).inUse).toBe(false);
    expectList(cutlery.floorSlot.map(toMm), [3.5, 14], 1e-9, 'floor slot');
  });

  it('stands with its two tunnels over the rail lines y = -80 and y = -186', () => {
    expect(cutlery.base).toBe('feet');
    const tunnels = must(cutlery.tunnels);
    expect(tunnels.count).toBe(2);
    expectList(tunnels.centresFromMid.map(toMm), [-53, 53], 1e-9, 'tunnels');
    expectNear(toMm(tunnels.clearWidth), 14, 1e-9);
    expectNear(toMm(tunnels.height), 100, 1e-9);
    const placement = cutlery.defaultPlacement;
    expect(placement.basketId).toBe('lower');
    expect(placement.longAxis).toBe('y');
    // "centre at rack-local (8, -133)".
    expectNear(lowerX(placement.centre[0]), 8, 1e-9);
    expectNear(lowerY(placement.centre[1]), -133, 1e-9);
    const tunnelY = tunnels.centresFromMid.map((c) => lowerY(placement.centre[1] + c));
    expectList(tunnelY, [-186, -80], 1e-9, 'tunnel lines');
    expectNear(lowerY(getTineRow(lower, 'fl').railAt), must(tunnelY[0]), 1e-9);
    expectNear(lowerY(getTineRow(lower, 'ml').railAt), must(tunnelY[1]), 1e-9);
    // The tunnels clear the 81 mm tines by a few millimetres: tips about 93 mm above the feet.
    const ml = getTineRow(lower, 'ml');
    expect(toMm(tunnels.height)).toBeGreaterThan(toMm(ml.railZ + ml.height));
    expect(B.defaultConfig.cutleryBasket).toEqual(placement);
  });
});

describe("spray arms and nozzle tables as measured on the owner's arms (owner update sections 2, 3 and 7)", () => {
  // [id, half, R mm, theta deg, rho deg, shape, size mm, A mm2, C_d]. Lower and upper arm: the
  // tables of section 7 of the owner update, which replace those of the dossier's section 3.2
  // (L4 is a round hole, not a slot; L7 and L8 are the angled round holes that drive the arm;
  // the upper arm's slots are rectangular, its tip outlets face backward, and it has an
  // underside hole, U8). Roof spinner: the dossier's table, unchanged.
  type Row = readonly [
    string,
    '+' | '-' | 'axis',
    number,
    number,
    number,
    string,
    readonly number[],
    number,
    number,
  ];
  const lowerTable: readonly Row[] = [
    ['L1', '+', 45, 0, 90, 'round', [3.3], 8.55, 0.85],
    ['L2', '-', 69, 0, 90, 'round', [3.3], 8.55, 0.85],
    ['L3', '+', 91, 0, 90, 'round', [3.3], 8.55, 0.85],
    ['L4', '+', 114, 0, 90, 'round', [3.3], 8.55, 0.85],
    ['L5', '+', 138, 0, 90, 'round', [3.3], 8.55, 0.85],
    ['L6', '-', 161, 0, 90, 'round', [3.3], 8.55, 0.85],
    ['L7', '+', 183, 90, 45, 'round', [3.3], 8.55, 0.85],
    ['L8', '-', 207, 90, 45, 'round', [3.3], 8.55, 0.85],
    ['L9', '+', 225, 0, 75, 'slot', [5.0, 1.8], 8.3, 0.78],
    ['L10', '-', 225, 90, 75, 'slot', [5.0, 1.8], 8.3, 0.78],
    ['L11', '+', 207, 180, -70, 'rect', [3.0, 2.2], 6.6, 0.8],
  ];
  const upperTable: readonly Row[] = [
    ['U1', '+', 41, 0, 90, 'round', [2.5], 4.91, 0.85],
    ['U2', '-', 85, 0, 90, 'rect', [4.8, 2.2], 10.56, 0.78],
    ['U3', '+', 130, 0, 90, 'rect', [4.8, 2.2], 10.56, 0.78],
    ['U4', '+', 160, 90, 78, 'rect', [4.8, 2.2], 10.56, 0.78],
    ['U5', '-', 193, 70, 70, 'rect', [4.8, 2.2], 10.56, 0.78],
    ['U6', '+', 219, 90, 45, 'rect', [4.3, 2.3], 9.89, 0.78],
    ['U7', '-', 223, 60, 50, 'rect', [4.3, 2.3], 9.89, 0.78],
    ['U8', '+', 38, 0, -90, 'round', [2.7], 5.73, 0.8],
  ];
  const roofTable: readonly Row[] = [['R1', 'axis', 0, 0, -90, 'round', [6.0], 28.3, 0.8]];

  // Sums: "Sum 91.6 ... C_d A = 76.4" and "Sum 72.7 ... C_d A = 57.1" (dossier: 80.2 and 66.0,
  // 52.3 and 41.0); roof 28.3 and 22.6 as the dossier.
  it.each([
    ['lower', lowerTable, 91.6, 76.4],
    ['upper', upperTable, 72.7, 57.1],
    ['roof', roofTable, 28.3, 22.6],
  ] as const)('%s: every row of the nozzle table, and its sums', (levelId, table, sumA, sumCdA) => {
    const level = getSprayLevel(B, levelId);
    expect(level.nozzles.map((n) => n.label)).toEqual(table.map(([id]) => id));
    for (const [label, half, radius, theta, rho, shape, size, area, cd] of table) {
      const nozzle = must(
        level.nozzles.find((n) => n.label === label),
        label,
      );
      expect(nozzle.id).toBe(label.toLowerCase());
      expect(nozzle.blade).toBe(half);
      expectNear(toMm(nozzle.radius), radius, 1e-9, `${label} R`);
      expectNear(radToDeg(nozzle.theta), theta, 1e-9, `${label} theta`);
      expectNear(radToDeg(nozzle.rho), rho, 1e-9, `${label} rho`);
      expect(nozzle.shape).toBe(shape);
      expectList(nozzle.size.map(toMm), size, 1e-9, `${label} size`);
      // The table prints the area to 0.01 mm2 (0.1 for the roof outlet).
      expectNear(nozzle.area * 1e6, area, levelId === 'roof' ? 0.05 : 0.006, `${label} area`);
      expect(nozzle.cd).toBe(cd);
      // "nozzle: {C_v: 1.0}".
      expect(nozzle.cv).toBe(1.0);
      expect(nozzle.face).toBe(rho > 0 ? 'top' : 'underside');
    }
    expectNear(level.nozzles.reduce((sum, n) => sum + n.area, 0) * 1e6, sumA, 0.06, 'sum of areas');
    expectNear(sprayLevelCdA(level) * 1e6, sumCdA, 0.06, 'sum of C_d A');
    expectNear(getBranch(B, levelId).statedCdA * 1e6, sumCdA, 1e-9, 'stated C_d A');
  });

  it('lower arm: 8 round holes and 2 tip slots on top (5 holes on one blade, 3 on the other) and 1 outlet underneath', () => {
    const arm = getSprayArm(B, 'lower');
    expect(arm.part).toBe('00668148');
    expectNear(toMm(arm.tipRadius), 230, 1e-9);
    expect(arm.axis).toEqual([0, 0]);
    const top = arm.nozzles.filter((n) => n.face === 'top');
    // Owner update 2.1: "8 round holes and 2 slots on top, 1 outlet underneath"; the owner's "7
    // holes" is a miscount, his "5 on one wing, 3 on the other" is right.
    expect(top).toHaveLength(10);
    expect(top.filter((n) => n.shape === 'round')).toHaveLength(8);
    expect(top.filter((n) => n.shape === 'slot')).toHaveLength(2);
    expect(top.filter((n) => n.shape === 'round' && n.blade === '+')).toHaveLength(5);
    expect(top.filter((n) => n.shape === 'round' && n.blade === '-')).toHaveLength(3);
    expect(arm.nozzles.filter((n) => n.face === 'underside')).toHaveLength(1);
    // "Two of the holes are angled backwards (one on each wing), the other[s] are directed
    // vertically": six vertical, two trailing at 45 deg, one per blade.
    const round = top.filter((n) => n.shape === 'round');
    const vertical = round.filter((n) => Math.abs(radToDeg(n.rho) - 90) < 1e-9);
    const angled = round.filter((n) => Math.abs(radToDeg(n.rho) - 45) < 1e-9);
    expect(vertical).toHaveLength(6);
    expect(angled.map((n) => [n.label, n.blade, Math.round(radToDeg(n.theta))])).toEqual([
      ['L7', '+', 90],
      ['L8', '-', 90],
    ]);
    // Tip slots: on the five-hole blade "angled slightly radially outward" (theta 0), on the
    // three-hole blade "slightly backward" (theta 90); both long axis across the blade.
    const l9 = must(arm.nozzles.find((n) => n.id === 'l9'));
    const l10 = must(arm.nozzles.find((n) => n.id === 'l10'));
    expect([l9.blade, radToDeg(l9.theta), l9.slotAxis]).toEqual(['+', 0, 'tangential']);
    expect(l10.blade).toBe('-');
    expectNear(radToDeg(l10.theta), 90, 1e-9);
    expect(l10.slotAxis).toBe('tangential');
    // Underside outlet: "slightly radially inward facing": theta 180, pointing down.
    const l11 = must(arm.nozzles.find((n) => n.id === 'l11'));
    expectNear(radToDeg(l11.theta), 180, 1e-9);
    expect(l11.rho).toBeLessThan(0);
    expect(l11.drives).toBe(false);
    expectList(
      top.filter((n) => n.blade === '+').map((n) => toMm(n.radius)),
      [45, 91, 114, 138, 183, 225],
      1e-9,
      'five-hole blade',
    );
    expectList(
      top.filter((n) => n.blade === '-').map((n) => toMm(n.radius)),
      [69, 161, 207, 225],
      1e-9,
      'three-hole blade',
    );
    // The tape in IMG_9086, zero at the tip of the three-hole blade (owner update 2.2):
    // L8 at 21.9 mm, L6 at 66.5 mm, L2 at 159.3 mm, the tip slot of the other blade at 454.3 mm
    // and its tip end at 457.6 mm. With the axis midway between the tips (228.8 mm) the radii
    // follow to within the +-4 mm by which the axis may lie off the middle, and the spacing
    // along the blade to within +-2 mm.
    const mid = 457.6 / 2;
    const r = (id: string) => toMm(must(arm.nozzles.find((n) => n.id === id)).radius);
    expectNear(r('l8'), mid - 21.9, 4);
    expectNear(r('l6'), mid - 66.5, 4);
    expectNear(r('l2'), mid - 159.3, 4);
    expectNear(r('l9'), 454.3 - mid, 4);
    expectNear(r('l8') - r('l6'), 66.5 - 21.9, 2);
    expectNear(r('l6') - r('l2'), 159.3 - 66.5, 2);
    expectNear(457.6, 2 * toMm(arm.tipRadius), 0.006 * 460);
    // Sorted together the radii step by 22 to 24 mm from 45 to 207 mm, one opening per ring,
    // up to the two tip slots at 225 mm.
    const sorted = [...top].sort((a, b) => a.radius - b.radius);
    for (let i = 1; i < sorted.length - 2; i++) {
      const step = toMm(must(sorted[i]).radius - must(sorted[i - 1]).radius);
      expect(step).toBeGreaterThan(21.5);
      expect(step).toBeLessThan(24.5);
    }
    // Clockwise seen from above: read off IMG_9094, IMG_9110 and IMG_9111.
    expect(arm.sense).toBe('cw');
    expect(provenanceTagOf(arm.provenance, 'sense')).toBe('verified');
    expectNear(arm.mass, 0.069, 1e-12);
    expect(arm.weight).toBe(0.68);
    expect(arm.inertiaWet).toBe(3.5e-3);
    expect(arm.bearing.viscous).toBe(0.002);
    expect(arm.bearing.thrustSign).toBe(-1);
    // Section 7: "hub_d: 18, stem_od: 28.5" (were 21 and 27.5); section 6: cap about 35 mm,
    // blade about 39 mm wide near the hub and 30 mm at the tip.
    expectNear(toMm(arm.bearing.hubBore), 18, 1e-9);
    expectNear(toMm(must(arm.shape.stemDiameter)), 28.5, 1e-9);
    expectNear(toMm(must(arm.shape.hubDiameter)), 35, 1e-9);
    expectList(must(arm.shape.bladeWidth).map(toMm), [39, 30], 1e-9, 'blade width');
    // The friction radius is a placeholder for the recommended speed (see arm.test.ts).
    expect(provenanceTagOf(arm.provenance, 'bearing.frictionRadius')).toBe('estimated');
    // The drive: "two angled round holes ... and one slightly tilted tip slot".
    expect(arm.nozzles.filter((n) => n.drives).map((n) => n.label)).toEqual(['L7', 'L8', 'L10']);
  });

  it('upper arm: 1 round hole and 6 rectangular openings on top (4 on wing A, 3 on wing B), 1 hole underneath', () => {
    const arm = getSprayArm(B, 'upper');
    expect(arm.part).toBe('11010054');
    expectNear(toMm(arm.tipRadius), 230, 1e-9);
    expectList(arm.axis.map(toMm), [0, -30], 1e-9, 'axis');
    expect(arm.mount).toEqual({ kind: 'basket', basketId: 'upper' });
    // Owner update 3.1: "1 hole and 6 slots on top, 1 hole underneath"; the owner's "four
    // horizontal slots" should be five.
    const top = arm.nozzles.filter((n) => n.face === 'top');
    expect(top).toHaveLength(7);
    expect(top.filter((n) => n.shape === 'round').map((n) => n.label)).toEqual(['U1']);
    expect(top.filter((n) => n.shape === 'rect')).toHaveLength(6);
    expect(arm.nozzles.filter((n) => n.face === 'underside').map((n) => n.label)).toEqual(['U8']);
    expect(arm.nozzleDownZ).not.toBeNull();
    // "wing A has the hole, two slots and the side-facing tip slot; wing B has three slots".
    expect(top.filter((n) => n.blade === '+').map((n) => n.label)).toEqual([
      'U1',
      'U3',
      'U4',
      'U6',
    ]);
    expect(top.filter((n) => n.blade === '-').map((n) => n.label)).toEqual(['U2', 'U5', 'U7']);
    // The tape in IMG_9099, read from the tip of wing A; the hub socket is at 23.51 cm
    // (owner update 3.1). Readings in cm: U1 19.32 to 19.40, U3 10.52, U4 7.54, U6 1.54 to 1.72,
    // U2 32.03, U5 42.84, U7 45.87. Radii are the distances from the hub, to the millimetre.
    const hub = 235.1;
    const tape: readonly (readonly [string, number])[] = [
      ['u1', 193.6],
      ['u3', 105.2],
      ['u4', 75.4],
      ['u6', 16.3],
      ['u2', 320.3],
      ['u5', 428.4],
      ['u7', 458.7],
    ];
    for (const [id, reading] of tape) {
      const nozzle = must(arm.nozzles.find((n) => n.id === id));
      expectNear(toMm(nozzle.radius), Math.abs(hub - reading), 0.7, `${id} on the tape`);
      // Wing A is the side of the tape below the hub reading.
      expect(nozzle.blade).toBe(reading < hub ? '+' : '-');
    }
    // Directions, in the owner's words: wing A "the hole is vertical, the second slot is
    // facing backwards slightly and the vertical slot is facing backwards significantly maybe 45
    // degrees"; wing B "the first slot is vertical, the second slot is facing backwards and
    // slightly outwards, and the final slot ... in the same directions but to a greater degree".
    const dir = (id: string) => {
      const n = must(arm.nozzles.find((x) => x.id === id));
      // (radially outward, trailing, up).
      return [
        Math.cos(n.rho) * Math.cos(n.theta),
        Math.cos(n.rho) * Math.sin(n.theta),
        Math.sin(n.rho),
      ] as const;
    };
    for (const id of ['u1', 'u2', 'u3']) expectNear(dir(id)[2], 1, 1e-12, `${id} vertical`);
    expect(dir('u4')[1]).toBeGreaterThan(0.1); // backwards slightly
    expect(dir('u4')[1]).toBeLessThan(0.3);
    expectNear(dir('u4')[0], 0, 1e-12);
    expectNear(dir('u6')[1], Math.SQRT1_2, 1e-12); // backwards at 45 degrees
    expectNear(dir('u6')[0], 0, 1e-12);
    expect(dir('u5')[1]).toBeGreaterThan(dir('u5')[0]); // backwards and slightly outwards
    expect(dir('u5')[0]).toBeGreaterThan(0);
    expect(dir('u7')[1]).toBeGreaterThan(dir('u5')[1]); // the same, to a greater degree
    expect(dir('u7')[0]).toBeGreaterThan(dir('u5')[0]);
    expectNear(dir('u8')[2], -1, 1e-12);
    // The slots in the bosses have their long axis along the arm.
    for (const id of ['u2', 'u3', 'u4', 'u5']) {
      expect(must(arm.nozzles.find((n) => n.id === id)).slotAxis).toBe('radial');
    }
    expect(must(arm.feedTube)).toEqual({ length: 0.27, diameter: 0.017 });
    expectNear(toMm(must(arm.shape.hubHeight)), 30, 1e-9);
    expectNear(radToDeg(arm.shape.tipSweep), 7, 1e-9);
    // Counter-clockwise seen from above: read off IMG_9100, IMG_9104 and IMG_9106.
    expect(arm.sense).toBe('ccw');
    expect(provenanceTagOf(arm.provenance, 'sense')).toBe('verified');
    expectNear(arm.mass, 0.065, 1e-12);
    expect(arm.weight).toBe(0.64);
    expect(arm.inertiaWet).toBe(2.7e-3);
    expect(arm.bearing.thrustSign).toBe(1);
    // Section 7: "hub_d: 15" (was 18); section 6: 49 mm across the hub, blade about 37 mm wide
    // at mid-length and 21 to 25 mm at the tips.
    expectNear(toMm(arm.bearing.hubBore), 15, 1e-9);
    expectNear(toMm(must(arm.shape.hubDiameter)), 49, 1e-9);
    expectList(must(arm.shape.bladeWidth).map(toMm), [37, 23], 1e-9, 'blade width');
    // The drive: "the two tip outlets and the two outer slots", not the dossier's four slots.
    expect(arm.nozzles.filter((n) => n.drives).map((n) => n.label)).toEqual([
      'U4',
      'U5',
      'U6',
      'U7',
    ]);
    // It sweeps to y = -260, 25 mm beyond the flange plane, inside the door recess.
    expectNear(toMm(arm.axis[1] - arm.tipRadius), -260, 1e-9);
    expectNear(toMm(B.door.flangePlaneY - (arm.axis[1] - arm.tipRadius)), 25, 1e-9);
  });

  it('carries the drill-test bore as a named alternative: 4.5 mm, C_d A 126.4 mm2 (owner update 5.2, 5.4)', () => {
    // "Holes are 4mm drill bit fairly loose, 5mm does not fit. Probably 4.5mm": not reconciled
    // with the 3.3 mm on the tape photograph; "Keep case D ... as a named alternative".
    const D = BOSCH_SMV4HAX40G_DRILL_BORE;
    expect(findMachine(D.id)).toBe(D);
    expect(findMachine(B.id)).toBe(B);
    const arm = getSprayArm(D, 'lower');
    const table = lowerTable.map((row) =>
      row[5] === 'round' ? ([...row.slice(0, 6), [4.5], 15.9, row[8]] as unknown as Row) : row,
    );
    for (const [label, half, radius, theta, rho, shape, size, area] of table) {
      const nozzle = must(arm.nozzles.find((n) => n.label === label));
      expect(nozzle.blade).toBe(half);
      expectNear(toMm(nozzle.radius), radius, 1e-9);
      expectNear(radToDeg(nozzle.theta), theta, 1e-9);
      expectNear(radToDeg(nozzle.rho), rho, 1e-9);
      expect(nozzle.shape).toBe(shape);
      expectList(nozzle.size.map(toMm), size, 1e-9, `${label} size`);
      expectNear(nozzle.area * 1e6, area, 0.006, `${label} area`);
    }
    // "Sum ... [150.4] C_d A = ... [126.4]".
    expectNear(arm.nozzles.reduce((sum, n) => sum + n.area, 0) * 1e6, 150.4, 0.06);
    expectNear(sprayLevelCdA(arm) * 1e6, 126.4, 0.06);
    // Nothing else differs.
    expect({
      ...D,
      id: '',
      name: '',
      sprayLevels: [],
      hydraulics: null,
      defaultConfig: null,
    }).toEqual({ ...B, id: '', name: '', sprayLevels: [], hydraulics: null, defaultConfig: null });
    expect(D.hydraulics.branches.filter((b) => b.id !== 'lower')).toEqual(
      B.hydraulics.branches.filter((b) => b.id !== 'lower'),
    );
  });

  it('roof spinner: a free-spinning 5-vane rotor of 52 mm, 245 mm in front of the rear wall', () => {
    const roof = getSprayLevel(B, 'roof');
    if (roof.kind !== 'fixed') throw new Error('the roof spinner is not an arm');
    expect(roof.type).toBe('free_spinning_rotor');
    expect(roof.part).toBe('00611388');
    expectNear(toMm(roof.diameter), 52, 1e-9);
    expectNear(toMm(roof.height), 21, 1e-9);
    expect(roof.vanes).toBe(5);
    expectNear(toMm(B.tub.y[1] - roof.axis[1]), 245, 1e-9);
    expect(roof.spray.pattern).toBe('rotating_shower');
    expectNear(radToDeg(roof.spray.coneHalfAngle), 65, 1e-9);
    expect(roof.spray.dropletSpeed).toBe(2.5);
    expect(B.sprayLevels.map((l) => [l.id, l.kind])).toEqual([
      ['lower', 'arm'],
      ['upper', 'arm'],
      ['roof', 'fixed'],
    ]);
  });
});

describe('hydraulics, thermal, dosing (section 3.1)', () => {
  it('has the pump curve and the branches of the specification block', () => {
    const { pump, branches } = B.hydraulics;
    expect(pump.part).toBe('12014980');
    expect(pump.ratedSpeedRpm).toBe(3000);
    expect(pump.shutOffHead).toBe(4.0);
    expectNear(pump.curveCoefficient / 3.6e9, 1.19e-3, 1e-15);
    expect(pump.speedRangeRpm).toEqual([2000, 3500]);
    expect(pump.hydraulicEfficiency).toBe(0.4);
    expect(pump.motorEfficiency).toBe(0.72);
    expect(pump.idlePower).toBe(8);
    // [branch, static lift m, K Pa s2/m6, pipe volume L].
    const expected = [
      ['lower', 0.11, 2.0e10, 0.25],
      ['upper', 0.43, 8.0e10, 0.4],
      // Roof: 0.69 m with the outlet 15 mm under the measured roof (owner update 7; was 0.72).
      ['roof', 0.69, 1.4e11, 0.1],
    ] as const;
    expect(branches.map((b) => b.id)).toEqual(expected.map(([id]) => id));
    for (const [id, lift, k, volume] of expected) {
      const branch = getBranch(B, id);
      expect(branch.staticLift).toBe(lift);
      expect(branch.lossCoefficient).toBe(k);
      expectNear(toLitres(branch.pipeVolume), volume, 1e-9);
    }
    // "Static lifts above a sump level 60 mm below the filter plate": the lower arm's 0.11 m is
    // its 50 mm top face plus those 60 mm.
    expectNear(toMm(B.hydraulics.sumpLevelBelowDatum), 60, 1e-9);
    expectNear(getSprayArm(B, 'lower').topFaceZ + B.hydraulics.sumpLevelBelowDatum, 0.11, 1e-9);
  });

  it('has the six diverter positions of the patent embodiment and alternates L 60 s / UR 60 s', () => {
    const { diverter } = B.hydraulics;
    expect(diverter.positions.map((p) => [p.label, p.feeds])).toEqual([
      ['CLOSED', []],
      ['LU', ['lower', 'upper']],
      ['R', ['roof']],
      ['U', ['upper']],
      ['L', ['lower']],
      ['UR', ['upper', 'roof']],
    ]);
    // Nothing feeds all three levels.
    expect(diverter.positions.every((p) => p.feeds.length < 3)).toBe(true);
    expect(diverter.transitionTime).toBe(2.5);
    expect(diverter.defaultPattern.phases).toEqual([
      { position: 'l', duration: 60 },
      { position: 'ur', duration: 60 },
    ]);
  });

  it('has the inventory, fill and drain figures', () => {
    const { inventory, fill, drain } = B.hydraulics;
    expectNear(toLitres(inventory.minSumpVolume), 0.5, 1e-9);
    expect(inventory.flightTime).toBe(0.5);
    expect(inventory.returnTime).toBe(1.5);
    expectNear(toLitres(inventory.carryOver), 0.4, 1e-9);
    expectNear(toLitres(inventory.topUpVolume), 0.5, 1e-9);
    expect(inventory.maxTopUpsPerPhase).toBe(1);
    expect(inventory.levelCheckIn).toEqual(['pre_rinse', 'main_wash']);
    expectNear(fill.inletFlow * 60000, 2.5, 1e-9);
    expectNear(toLitres(fill.firstBathVolume), 4.0, 1e-9);
    expectNear(toLitres(fill.laterBathVolume), 2.5, 1e-9);
    expectNear(toLitres(fill.flushVolume), 0.5, 1e-9);
    expectNear(toLitres(must(fill.prestoreVolume)), 3.1, 1e-9);
    expectNear(drain.flow * 60000, 16, 1e-9);
    expect(drain.pattern).toEqual([35, 10, 10]);
  });

  it('has the thermal constants: 2100 W at full duty, 14 kJ/K, 600 and 250 W/K, UA 3.0 W/K', () => {
    const t = B.thermal;
    expect(t.heaterPower).toBe(2100);
    expect(t.heaterDuty).toBe(1.0);
    expect(t.machineHeatCapacity).toBe(14000);
    expect(t.liquorLoadConductance).toBe(600);
    expect(t.liquorMachineConductance).toBe(250);
    expect(t.cabinetConductance).toBe(3.0);
    expect(t.inletTemperature).toBe(15);
    expect(t.ambientTemperature).toBe(23);
    expect(t.referenceLoadHeatCapacity).toBe(23000);
    expect(t.heaterCutOut).toBe(75);
  });

  it('has the heat exchanger on the left wall: 435 x 670 x 42 mm, 3.1 L, 25 W/K; door closed', () => {
    const tank = must(B.drying.heatExchanger);
    expect(tank.wall).toBe('left');
    expectList(must(tank.size).map(toMm), [435, 670], 1e-9, 'size');
    expectNear(toMm(must(tank.thickness)), 42, 1e-9);
    expectNear(toLitres(must(tank.volume)), 3.1, 1e-9);
    expect(tank.wallConductance).toBe(25);
    expect(B.drying.method).toBe('heat_exchanger_condensation');
    expect(B.drying.autoOpen).toBeNull();
    expect(B.drying.fan).toBe(false);
    expectNear(B.drying.defaultDuration / 60, 40, 1e-9);
  });

  it('has the dispenser: sliding lid, chamber 22 mm left of centre at z = 510 on the liner', () => {
    const d = B.dispenser;
    expect(d.lid).toEqual({ kind: 'slides', direction: 'up' });
    expect(d.keepOutDepth).toBe(0);
    expectList(must(d.unitSize).map(toMm), [120, 105, 65], 1e-9, 'unit');
    expectList(d.chamberCentre.map(toMm), [-22, -275, 510], 1e-9, 'chamber');
    expectList(d.chamberSize.map(toMm), [50, 35], 1e-9, 'chamber opening');
    expectList(
      d.fillMarks.map((v) => v * 1e6),
      [15, 25, 50],
      1e-9,
      'marks',
    );
    expect(d.tabletTarget).toEqual({ kind: 'basket_tray', basketId: 'upper' });
    expectList(d.rinseAidOutlet.map(toMm), [25, -275, 510], 1e-9, 'rinse-aid outlet');
    expectNear(must(d.rinseAidReservoir) * 1e6, 80, 1e-9);
    expectNear(must(d.rinseAidPerPulse) * 1e6, 1, 1e-9);
  });

  it("drops the tablet 17 to 68 mm from the chamber's lip into the tray: 10 mm less than the dossier's stack gave", () => {
    // Dossier 2.12: the tray rim 55 mm above the basket floor, "at about 465 / 440 / 415 mm
    // above the filter at level 1 / 2 / 3; a tablet falls about 30 to 80 mm from the chamber's
    // lower lip (at about 492) to the rim ... the rim must be below the lip at level 1, which
    // holds here by 27 mm". With the floor the owner measured (420 / 395 / 370 mm) the rim is
    // 10 mm higher at every level and the fall 10 mm shorter; it still holds, by 17 mm, which
    // is less than the +-30 mm on the dispenser's height.
    expectNear(toMm(B.dispenser.tabletExit[2]), 492, 1);
    const drops = (['1', '2', '3'] as const).map((level) => tabletDrop(B, atLevel(level)));
    expectList(
      drops.map((d) => toMm(d.landing[2])),
      [420 + 55, 395 + 55, 370 + 55],
      1e-9,
      'tray rim',
    );
    for (const drop of drops) {
      expect(drop.caughtBy).toBe('tray');
      expect(toMm(drop.height)).toBeGreaterThan(15);
      expect(toMm(drop.height)).toBeLessThan(70);
    }
    expectNear(toMm(must(drops[0]).height), 27 - 10, 1);
    // The chamber is over the tray in x; in y the liner plane is 17 mm in front of the tray.
    const drop = must(drops[0]);
    expect(drop.exit[0]).toBeGreaterThan(drop.target.x[0]);
    expect(drop.exit[0]).toBeLessThan(drop.target.x[1]);
    expectNear(toMm(drop.miss), 17, 1e-9);
  });

  it('has the dosing, softener and sensor data', () => {
    expectNear(B.dosing.detergentMass, 0.02, 1e-12);
    expect(B.dosing.detergentReleaseDelay).toBe(60);
    expectNear(B.dosing.rinseAidVolume * 1e6, 5, 1e-9);
    const softener = must(B.softener);
    expect(softener.setting).toBe('H04');
    expect(softener.regenerateEveryCycles).toBe(6);
    expectNear(toLitres(softener.extraWater), 5, 1e-9);
    expectNear(softener.extraDuration / 60, 7, 1e-9);
    expectNear(softener.extraEnergy / 3.6e6, 0.05, 1e-12);
    expect(must(B.sensors.turbidity).part).toBe('00611323');
    expect(B.sensors.waterLevel).toBe('pump_motor_current');
    expect(B.sensors.waterQuantity).toBe('impeller_pulses');
  });

  it('lists the programmes of the control panel that the dossier reconstructs', () => {
    expect(B.programmes.map((p) => p.id)).toEqual([
      'auto_145',
      'auto_145_keep',
      'auto_100_light',
      'auto_165_heavy',
      'eco_50',
      'intensive_70',
      'express_65',
      'silence_50',
      'pre_rinse',
    ]);
    // The printed table of section 4.1: duration (min), energy (kWh), water (L).
    const printed: readonly (readonly [
      string,
      readonly [number, number],
      readonly [number, number],
      readonly [number, number],
    ])[] = [
      ['auto_145', [100, 165], [0.9, 1.5], [7.0, 15.5]],
      ['eco_50', [295, 295], [0.836, 0.836], [9.5, 9.5]],
      ['intensive_70', [125, 135], [1.3, 1.4], [11.5, 14.0]],
      ['express_65', [60, 60], [1.3, 1.3], [10.5, 10.5]],
      ['silence_50', [240, 240], [1.05, 1.05], [11.0, 11.0]],
      ['pre_rinse', [15, 15], [0.05, 0.05], [4.0, 4.0]],
    ];
    for (const [id, duration, energy, water] of printed) {
      const p = must(must(B.programmes.find((x) => x.id === id)).declared.printed, id);
      expectList(
        must(p.duration).map((s) => s / 60),
        duration,
        1e-9,
        `${id} duration`,
      );
      expectList(
        must(p.energy).map((j) => j / 3.6e6),
        energy,
        1e-9,
        `${id} energy`,
      );
      expectList(must(p.mainsWater).map(toLitres), water, 1e-9, `${id} water`);
    }
  });
});

describe('provenance (dossier section 3: V, S, P, E, G; owner update section 0: M, C, P, E)', () => {
  it('does not overclaim: estimates are tagged as estimates', () => {
    const lowerArm = getSprayArm(B, 'lower');
    expect(provenanceTagOf(lowerArm.provenance, 'tipRadius')).toBe('verified');
    // The owner did not measure the height of the lower arm, nor any friction or speed.
    expect(provenanceTagOf(lowerArm.provenance, 'topFaceZ')).toBe('estimated');
    expect(provenanceTagOf(lowerArm.provenance, 'bearing')).toBe('estimated');
    expect(provenanceTagOf(lowerArm.provenance, 'designSpeed')).toBe('estimated');
    expect(provenanceTagOf(lowerArm.nozzleProvenance, 'rho')).toBe('estimated');
    const upperArm = getSprayArm(B, 'upper');
    expect(provenanceTagOf(upperArm.provenance, 'bearing')).toBe('estimated');
    expect(provenanceTagOf(upperArm.provenance, 'designSpeed')).toBe('estimated');
    expect(provenanceTagOf(upperArm.nozzleProvenance, 'rho')).toBe('estimated');
    expect(provenanceTagOf(upperArm.nozzleProvenance, 'size')).toBe('photo');
    expect(provenanceTagOf(B.hydraulics.pump.provenance, 'shutOffHead')).toBe('estimated');
    expect(provenanceTagOf(B.hydraulics.pump.provenance, 'speedRangeRpm')).toBe('sister');
    expect(provenanceTagOf(B.hydraulics.diverter.provenance, 'positions')).toBe('sister');
    expect(provenanceTagOf(B.thermal.provenance, 'heaterPower')).toBe('sister');
    expect(provenanceTagOf(B.thermal.provenance, 'machineHeatCapacity')).toBe('generic');
    expect(provenanceTagOf(B.thermal.provenance, 'cabinetConductance')).toBe('estimated');
    expect(provenanceTagOf(B.tub.provenance, 'x')).toBe('photo');
    expect(provenanceTagOf(B.tub.provenance, 'floorSlope')).toBe('generic');
    expect(provenanceTagOf(B.door.provenance, 'linerPlaneY')).toBe('estimated');
    expect(provenanceTagOf(getTineRow(lower, 'r1').provenance, 'hinge')).toBe('estimated');
    expect(provenanceTagOf(getTineRow(lower, 'mr').provenance, 'tinePositions')).toBe('estimated');
    expect(provenanceTagOf(must(B.softener).provenance, 'extraWater')).toBe('verified');
    for (const programme of B.programmes) expect(programme.provenance.tag).toBe('estimated');
    // The lower basket's height is a measured 15 mm on an estimated 50 mm: not "measured".
    expect(lower.pose.provenance.tag).toBe('estimated');
    // The same chain puts the upper arm's hub 55 mm under its basket (owner update: "M on E").
    expect(provenanceTagOf(getSprayArm(B, 'upper').provenance, 'hubUndersideZ')).toBe('estimated');
    // The upper arm's nozzle table is not "measured" as a whole: its sizes and the underside
    // hole are scaled from photographs, and the angle numbers put on the owner's direction
    // words are estimates on both arms (70 deg for U5, 60 deg for U7).
    for (const id of ['lower', 'upper']) {
      const arm = getSprayArm(B, id);
      expect(arm.nozzleProvenance.tag, id).toBe('photo');
      expect(provenanceTagOf(arm.nozzleProvenance, 'theta'), id).toBe('estimated');
      expect(provenanceTagOf(arm.nozzleProvenance, 'rho'), id).toBe('estimated');
    }
    // The blade of the two underside openings was not determined: they are flagged, and no
    // other nozzle is.
    const assumed = ['lower', 'upper'].flatMap((id) =>
      getSprayArm(B, id)
        .nozzles.filter((n) => n.bladeAssumed)
        .map((n) => n.id),
    );
    expect(assumed).toEqual(['l11', 'u8']);
    expect(getSprayArm(B, 'lower').nozzles.filter((n) => n.face === 'underside')).toHaveLength(1);
    // The roof spinner was not seen in any photograph.
    expect(getSprayLevel(B, 'roof').provenance.tag).toBe('estimated');
    expect(getSprayLevel(B, 'roof').nozzleProvenance.tag).toBe('estimated');
    // Every record names the dossier and a section.
    expect(B.tub.provenance.source).toMatch(/machine-bosch-smv4hax40g\.md \d/);
  });

  it('says what the owner measured and what was read from his photographs', () => {
    // "measured" is the strongest tag: the owner's tape and drill.
    expect(PROVENANCE_TAGS[0]).toBe('measured');
    const lowerArm = getSprayArm(B, 'lower');
    const upperArm = getSprayArm(B, 'upper');
    // Tape: the roof, the upper basket's floor, the upper arm's hub; the upper arm's radii.
    expect(provenanceTagOf(B.tub.provenance, 'z')).toBe('measured');
    expect(provenanceTagOf(upper.pose.provenance, 'heightPositions')).toBe('measured');
    expect(provenanceTagOf(upperArm.nozzleProvenance, 'radius')).toBe('measured');
    // Counted or observed on his photographs: counts, shapes, blades, senses, what drives.
    for (const arm of [lowerArm, upperArm]) {
      expect(provenanceTagOf(arm.provenance, 'sense')).toBe('verified');
      for (const field of ['shape', 'blade', 'face', 'drives']) {
        expect(provenanceTagOf(arm.nozzleProvenance, field), field).toBe('verified');
      }
    }
    // Scaled from his photographs: the lower arm's radii and bores, the hub bores.
    expect(provenanceTagOf(lowerArm.nozzleProvenance, 'radius')).toBe('photo');
    expect(provenanceTagOf(lowerArm.nozzleProvenance, 'size')).toBe('photo');
    expect(provenanceTagOf(lowerArm.provenance, 'bearing.hubBore')).toBe('photo');
    expect(provenanceTagOf(upperArm.provenance, 'bearing.hubBore')).toBe('photo');
    expect(provenanceTagOf(getBranch(B, 'lower').provenance, 'statedCdA')).toBe('photo');
    expect(provenanceTagOf(getBranch(B, 'upper').provenance, 'statedCdA')).toBe('photo');
    // Every changed group names the owner update, and the nozzle tables his photographs.
    const changed = [
      B.tub.provenance,
      lower.pose.provenance,
      upper.pose.provenance,
      lowerArm.provenance,
      lowerArm.nozzleProvenance,
      upperArm.provenance,
      upperArm.nozzleProvenance,
      getSprayLevel(B, 'roof').provenance,
      getBranch(B, 'lower').provenance,
      getBranch(B, 'upper').provenance,
      getBranch(B, 'roof').provenance,
      must(B.feedDuct).provenance,
    ];
    for (const record of changed) expect(record.source).toContain('machine-bosch-owner-update.md');
    expect(lowerArm.nozzleProvenance.source).toContain('IMG_9086');
    expect(upperArm.nozzleProvenance.source).toContain('IMG_9099');
    // The bore conflict is stated where the bore is.
    expect(lowerArm.nozzleProvenance.note ?? '').toContain('4.5 mm');
    expect(lowerArm.nozzleProvenance.note ?? '').toContain('not reconciled');
  });

  it('marks what this package chose where the dossier is silent', () => {
    const chosen: readonly BasketSpec['provenance'][] = [
      getTineRow(lower, 'r1').provenance,
      getTineRow(upper, 'c_rear').provenance,
      lower.pose.provenance,
      B.hydraulics.fill.provenance,
    ];
    for (const record of chosen) expect(record.note ?? '').toMatch(/CHOICE|this engineer/);
    expect(provenanceTagOf(B.hydraulics.fill.provenance, 'prestoreDischargeFlow')).toBe(
      'estimated',
    );
    expect(provenanceTagOf(B.thermal.provenance, 'liquorMachineConductanceIdle')).toBe('estimated');
  });
});
