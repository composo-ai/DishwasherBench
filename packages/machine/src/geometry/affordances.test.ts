/**
 * Affordances of the owner's Bosch against its dossier (docs/research/machine-bosch-smv4hax40g.md
 * sections 2.3 to 2.5, 2.12 and 5.1) and the owner update (section 4.3).
 */

import type { Vec3 } from '@spotless/core';
import { v3Add, v3Distance, v3Dot, v3Length, v3Normalise, v3Sub } from '@spotless/core';
import { describe, expect, it } from 'vitest';
import { getBasket } from '../config.ts';
import { BOSCH_SMV4HAX40G as B } from '../machines.ts';
import { expectNear, must } from '../test-util.ts';
import type { MachineConfig } from '../types.ts';
import { buildMachineGeometry } from './build.ts';
import { cutleryFloorOpenFraction, cutleryWallOpenFraction } from './cutlery.ts';
import type { TineRowAffordance } from './types.ts';

const mm = (m: number): number => m * 1000;
const deg = (r: number): number => (r * 180) / Math.PI;
const geometry = buildMachineGeometry(B);
const A = geometry.affordances;
const row = (basketId: string, rowId: string, from = A): TineRowAffordance =>
  must(from.tineRows.find((r) => r.basketId === basketId && r.rowId === rowId));
const atLevel = (level: string): MachineConfig => ({
  ...B.defaultConfig,
  basketHeights: { upper: level },
});

describe('tine rows and slots', () => {
  it('lists every row of both baskets with one slot between each pair of tines', () => {
    expect(A.tineRows.map((r) => `${r.basketId}.${r.rowId}`)).toEqual([
      'lower.r1',
      'lower.r2',
      'lower.ml',
      'lower.mr',
      'lower.fl',
      'lower.fr',
      'upper.a',
      'upper.b',
      'upper.a2',
      'upper.b2',
      'upper.c_rear',
      'upper.c_front',
    ]);
    for (const r of A.tineRows) {
      expect(r.state).toBe('up');
      expect(r.slots).toHaveLength(r.tines.length - 1);
      r.slots.forEach((slot, i) => {
        const a = must(r.tines[i]).base;
        const b = must(r.tines[i + 1]).base;
        expectNear(
          v3Distance(slot.centre, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]),
          0,
          1e-12,
        );
        expectNear(slot.pitch, v3Distance(a, b), 1e-12, 'pitch');
        expectNear(v3Length(slot.plateNormal), 1, 1e-12, 'unit normal');
      });
    }
  });

  it('gives the rear rows 21 slots of 18.25 mm and a last one of 27 mm (dossier 2.3)', () => {
    for (const id of ['r1', 'r2']) {
      const r = row('lower', id);
      const pitches = r.slots.map((s) => mm(s.pitch));
      expect(pitches.filter((p) => Math.abs(p - 18.25) < 1e-6)).toHaveLength(21);
      expectNear(must(pitches[21]), 27, 0.5, 'the last tine on the right');
      // Clear width between two 4 mm tines.
      expectNear(mm(must(r.slots[0]).clearWidth), 14.25, 1e-6);
      // 15 tines lean left, then 8 lean right: slots 0 to 13 lean left by 15 degrees, slot 14 is
      // the V gap, slots 15 to 21 lean right.
      r.slots.forEach((slot, i) => {
        expect(slot.vGap, `slot ${i}`).toBe(i === 14);
        expectNear(deg(slot.lean), i === 14 ? 0 : 15, 1e-9, `lean of slot ${i}`);
        if (i !== 14) expect(slot.leanToward).toBe(i < 14 ? '-x' : '+x');
      });
    }
  });

  it('stands a plate parallel to the tines of its slot', () => {
    for (const r of A.tineRows) {
      r.slots.forEach((slot, i) => {
        if (slot.vGap) return;
        const tine = must(r.tines[i]);
        const direction = v3Normalise(v3Sub(tine.tip, tine.base));
        const alongRail: Vec3 = r.runs === 'x' ? [1, 0, 0] : [0, 1, 0];
        if (slot.lean > 0) {
          // Leaning with the tines: the tine lies in the plate's plane.
          expectNear(v3Dot(slot.plateNormal, direction), 0, 1e-12, `${r.rowId} slot ${i}`);
        } else {
          // Upright across the rail.
          expectNear(v3Dot(slot.plateNormal, alongRail), 1, 1e-12, `${r.rowId} slot ${i}`);
        }
      });
    }
    // Row C of the upper basket leans across its rail (towards the right wall), so plates
    // between its tines stand upright.
    expect(row('upper', 'c_rear').slots.every((s) => s.lean === 0 && !s.vGap)).toBe(true);
  });

  it('pairs the rows that hold a plate together: R1 with R2 (99 mm), ML with FL (106 mm)', () => {
    expect(row('lower', 'r1').partner?.rowId).toBe('r2');
    expectNear(mm(must(row('lower', 'r1').partner).railSpacing), 99, 1e-6);
    expect(row('lower', 'ml').partner?.rowId).toBe('fl');
    expectNear(mm(must(row('lower', 'ml').partner).railSpacing), 106, 1e-6);
    expect(row('lower', 'fr').partner?.rowId).toBe('mr');
    // Upper basket: A with B, 60 mm apart; the hairpin rows 61 mm apart (dossier 2.5).
    expect(row('upper', 'a').partner?.rowId).toBe('b');
    expectNear(mm(must(row('upper', 'a').partner).railSpacing), 60, 1e-6);
    expectNear(mm(must(row('upper', 'a2').partner).railSpacing), 61, 1e-6);
  });

  it('gives tub-frame slot centres that follow the upper basket down', () => {
    const slot1 = must(row('upper', 'a').slots[0]);
    const slot3 = must(
      row('upper', 'a', buildMachineGeometry(B, atLevel('3')).affordances).slots[0],
    );
    expectNear(mm(slot1.centreTub[2] - slot3.centreTub[2]), 50, 1e-9);
    expectNear(mm(slot1.centreTub[2]), 420, 1e-9, 'rail of row A in the floor plane at level 1');
    expect(slot1.centre).toEqual(slot3.centre);
  });

  it('offers no slots in a folded row and reports where its tines lie', () => {
    const folded = buildMachineGeometry(B, {
      ...B.defaultConfig,
      foldedTineRows: [{ basketId: 'lower', rowId: 'r2' }],
    });
    const r2 = row('lower', 'r2', folded.affordances);
    expect(r2.state).toBe('folded');
    expect(r2.slots).toHaveLength(0);
    for (const tine of r2.tines) {
      expectNear(tine.tip[2], tine.base[2], 1e-9, 'flat');
      // 66 mm high tines lie 66 mm towards the front.
      expectNear(mm(tine.base[1] - tine.tip[1]), 66, 1e-6);
    }
    // R1 then has no partner within reach on the rear side, and R2 is not offered as one.
    expect(row('lower', 'r1', folded.affordances).partner).toBeNull();
  });
});

describe('shelves, holders and the cutlery basket', () => {
  it('describes the cup shelves up (default) and down', () => {
    expect(A.cupShelves.map((s) => s.shelfId)).toEqual(['cup_front', 'cup_rear']);
    for (const shelf of A.cupShelves) {
      expect(shelf.state).toBe('up');
      expect(shelf.surface).toBeNull();
      expect(shelf.clearBelow).toBeNull();
      expect(shelf.stemwareNotches).toHaveLength(5);
    }
    const down = buildMachineGeometry(B, {
      ...B.defaultConfig,
      shelves: [{ basketId: 'upper', shelfId: 'cup_rear', state: 'down' }],
    }).affordances.cupShelves;
    const rear = must(down.find((s) => s.shelfId === 'cup_rear'));
    const surface = must(rear.surface);
    // 252 x 97 x 22 mm [P16] on the right wall. Its underside 75.5 mm above the floor, at the
    // height of the pins the folded shelf is seen to turn about in IMG_9131, and its top 22 mm
    // above that (inferred from the folded shelf; it was a generic 75 mm for the top, with
    // 53 mm of room under it).
    expectNear(mm(surface.z), 75.5 + 22, 1e-9);
    expectNear(mm(surface.x[1] - surface.x[0]), 97, 1e-9);
    expectNear(mm(surface.y[1] - surface.y[0]), 252, 1e-9);
    expectNear(mm(must(rear.clearBelow)), 75.5, 1e-9, 'room under the shelf');
    // It hangs on the inner face of the right rim wire of a 500 mm wide basket.
    expect(mm(surface.x[1])).toBeGreaterThan(490);
    expect(mm(surface.x[1])).toBeLessThan(500);
    const front = must(down.find((s) => s.shelfId === 'cup_front'));
    expect(front.state).toBe('up');
    // Folded up as IMG_9131 shows it: 27 mm inside the wall, its 18 mm between the pins and
    // the wall, from 48.5 mm above the floor (seen: 48.5 to 138.5 mm at x = +222 to +239 from
    // the arm axis; the lean of the folded shelf, which takes 10 mm off its top, is not drawn).
    expectNear(mm(front.box.min[2]), 48.5, 1e-6, 'lower edge of the folded shelf');
    expectNear(mm(front.box.max[2]), 148.5, 1e-6, 'upper edge of the folded shelf');
    expectNear(mm(front.box.min[0]) - 244, 222, 2.5, 'inner face of the folded shelf');
    expectNear(mm(front.box.max[0]) - 244, 239, 3, 'outer face of the folded shelf');
  });

  it('describes the knife shelf along the left side', () => {
    const knife = must(A.holders[0]);
    expect(knife.kind).toBe('knife_shelf');
    expect(knife.state).toBe('down');
    // 389 mm long [P16]; 99 mm wide where things stand beside and under it (IMG_9131: its
    // front lip from x = -242 to -144; the published 119 mm includes what holds it on the wall).
    expectNear(mm(knife.box.max[1] - knife.box.min[1]), 389, 1e-6);
    expectNear(mm(knife.box.max[0] - knife.box.min[0]), 99, 1e-6);
    // Its height is read from IMG_9131: the underside 149.5 mm above the floor-wire tops, the
    // top of the lip 171.5 (it was the generator's choice, 20 mm under the rim).
    expect(knife.floorZTag).toBe('photo');
    expectNear(mm(knife.box.min[2]), 149.5, 1e-6, 'underside');
    expectNear(mm(knife.box.max[2]), 171.5, 1e-6, 'top of the lip');
    expect(geometry.assumptions.some((a) => a.id === 'holder_floor_below_rim')).toBe(true);
    const up = buildMachineGeometry(B, {
      ...B.defaultConfig,
      shelves: [{ basketId: 'upper', shelfId: 'knife_shelf', state: 'up' }],
    }).affordances.holders;
    expect(must(up[0]).state).toBe('up');
    // Folded up about the inner face of the left rim wire (5.1 mm inside the basket's outline;
    // the shelf reaches from 2 to 101 mm), standing on the top of that wire (122.5 mm: a
    // choice, the folded shelf has not been photographed), it reaches 218.4 mm, under the roof
    // 220 mm above the floor wires at level 1, and takes little room in plan.
    expect(mm(must(up[0]).box.max[0] - must(up[0]).box.min[0])).toBeLessThan(30);
    expectNear(mm(must(up[0]).box.max[2]), 122.5 + 101 - 5.1, 1e-6, 'stands up');
    expect(mm(must(up[0]).box.max[2])).toBeLessThan(220);
  });

  it('gives the cutlery basket 2 x 4 cells in the 6 compartments of its 230 x 128 x 127 mm body', () => {
    // IMG_9081: two columns either side of the wall under the handle; along the length the two
    // thick cross walls over the tunnels and a thin divider half way between them.
    expect(A.cutleryCells.map((c) => c.id)).toEqual([
      'c00',
      'c01',
      'c02',
      'c03',
      'c10',
      'c11',
      'c12',
      'c13',
    ]);
    expect(must(B.cutleryBasket).cells).toBe(6);
    for (const cell of A.cutleryCells) {
      expect(mm(cell.box.min[0])).toBeGreaterThanOrEqual(0);
      expect(mm(cell.box.max[0])).toBeLessThanOrEqual(128);
      expect(mm(cell.box.min[1])).toBeGreaterThanOrEqual(0);
      expect(mm(cell.box.max[1])).toBeLessThanOrEqual(230);
      expectNear(mm(cell.box.max[2]), 127, 1e-9);
      // The top of each floor is 6 mm above the feet, which stand on the base grid of the
      // lower basket (73 mm above the filter plate).
      expectNear(mm(cell.box.min[2]), 6, 1e-9);
      expectNear(mm(cell.floorCentreTub[2]), 73 + 6, 1e-6);
      // The dividers are in place, so no cell has one inside it.
      expect(cell.dividerAt).toBeNull();
      // The opening is the inside of the cell less the strips under the two handles.
      expect(cell.box.min[0]).toBeGreaterThanOrEqual(cell.interior.min[0]);
      expect(cell.box.max[0]).toBeLessThanOrEqual(cell.interior.max[0]);
      expect(cell.box.min[1]).toBeGreaterThanOrEqual(cell.interior.min[1]);
      expect(cell.box.max[1]).toBe(cell.interior.max[1]);
    }
    // The handle of the lower basket, 20 mm deep from the front line, reaches 12 mm over the
    // front cells of the cutlery basket, whose front wall is 8 mm behind that line (IMG_9081:
    // its rear edge is 11 mm behind the cutlery basket's front rim). Their openings start 2 mm
    // behind it; the cells behind are whole.
    for (const cell of A.cutleryCells) {
      const front = cell.id.endsWith('0');
      expectNear(mm(cell.box.min[1] - cell.interior.min[1]), front ? 12 : 0, 1e-6, cell.id);
    }
    // The 22 mm handle stands over x = 53 to 75 mm: the openings stop 2 mm short of it, the
    // insides run on to the 2 mm wall down the middle (63 to 65 mm).
    const c00 = must(A.cutleryCells.find((c) => c.id === 'c00'));
    const c10 = must(A.cutleryCells.find((c) => c.id === 'c10'));
    expectNear(mm(c00.box.max[0]), 53 - 2, 1e-9);
    expectNear(mm(c00.interior.max[0]), 63, 1e-9);
    expectNear(mm(c10.box.min[0]), 75 + 2, 1e-9);
    expectNear(mm(c10.interior.min[0]), 65, 1e-9);
    // The end cells end at the tunnels, whose centres are 106 mm apart, 14 mm clear.
    const c01 = must(A.cutleryCells.find((c) => c.id === 'c01'));
    const c02 = must(A.cutleryCells.find((c) => c.id === 'c02'));
    const c03 = must(A.cutleryCells.find((c) => c.id === 'c03'));
    const tunnel1 = (c00.box.max[1] + c01.box.min[1]) / 2;
    const tunnel2 = (c02.box.max[1] + c03.box.min[1]) / 2;
    expectNear(mm(tunnel2 - tunnel1), 106, 1e-6);
    expectNear(mm(c01.box.min[1] - c00.box.max[1]), 14 + 2 * 2, 1e-6);
    // The thin divider is half way between the tunnels, 2 mm thick.
    expectNear(mm((c01.box.max[1] + c02.box.min[1]) / 2), 115, 1e-6);
    expectNear(mm(c02.box.min[1] - c01.box.max[1]), 2, 1e-6);
    // In the tub the two tunnels stand over the rail lines of the side rows (dossier frame
    // y = -80 and -186, with the basket 6 mm in front of the arm axis).
    const originY = -0.262 + must(B.defaultConfig.cutleryBasket).centre[1] - 0.115;
    expectNear(mm(originY + tunnel2), -80 - 6, 1e-6);
    expectNear(mm(originY + tunnel1), -186 - 6, 1e-6);
  });

  it('records the open fractions of the cutlery basket lattice for the water model', () => {
    const cutlery = must(B.cutleryBasket);
    // Openings 7 x 16 mm (walls) and 3.5 x 14 mm (floor) with bars of 2.5 mm (assumed).
    expectNear(cutleryWallOpenFraction(cutlery), (7 * 16) / (9.5 * 18.5), 1e-12);
    expectNear(cutleryFloorOpenFraction(cutlery), (3.5 * 14) / (6 * 16.5), 1e-12);
    expect(geometry.properties.cutleryBasketWallOpenFraction).toBe(
      cutleryWallOpenFraction(cutlery),
    );
    expect(geometry.properties.cutleryBasketFloorOpenFraction).toBe(
      cutleryFloorOpenFraction(cutlery),
    );
    // The floor slots are the generic ones of machine.md and the bar width is assumed.
    expect(geometry.properties.cutleryBasketOpenFractionTag).toBe('generic');
    // The shape carries them as porosity.
    const shape = must(geometry.parts.find((p) => p.id === 'cutlery_basket')).shape;
    expect(must(shape.parts.find((p) => p.id === 'foot.0.floor')).porosity).toBe(
      cutleryFloorOpenFraction(cutlery),
    );
    expect(must(shape.parts.find((p) => p.id === 'foot.0.left')).porosity).toBe(
      cutleryWallOpenFraction(cutlery),
    );
    expect(must(shape.parts.find((p) => p.id === 'handle.bar')).porosity).toBeUndefined();
  });
});

describe('basket envelopes and what is above them', () => {
  it('measures the clear height over the lower basket as the manual prints it: 30, 27.5, 25 cm', () => {
    // Manual [B1 p. 21]: largest item in the bottom basket at Rackmatic level 1 / 2 / 3. The
    // owner measured the first directly: 30 cm from the floor wire to the underside of the
    // upper arm. Heights here are counted from the top of the base grid (the top of the cross
    // wires), which is two 4 mm wires above the underside of the lowest floor wires that the
    // tape reading is taken to: an item standing on the grid has 292 mm under the hub.
    const printed = must(getBasket(B, 'lower').limits).maxDiameterByPosition;
    for (const level of ['1', '2', '3']) {
      const envelope = must(
        buildMachineGeometry(B, atLevel(level)).affordances.baskets.find(
          (b) => b.basketId === 'lower',
        ),
      );
      expectNear(mm(envelope.maxItemHeight) + 8, mm(must(printed[level])), 0.5, `level ${level}`);
      expect(must(envelope.overhead[0]).id).toBe('upper_arm.hub');
      // Beside the hub the blades are 21 mm higher (owner update 4.3: 386 against 365 mm).
      expectNear(mm(envelope.maxItemHeightClearOfDiscs - envelope.maxItemHeight), 21, 1e-6);
    }
  });

  it('measures the clear height over the upper basket as the manual prints it: 22, 24.5, 27 cm', () => {
    // Manual [B1 p. 21]; the owner's tape: 22 cm from the top-basket floor to the roof.
    const printed = must(getBasket(B, 'upper').limits).maxDiameterByPosition;
    for (const level of ['1', '2', '3']) {
      const envelope = must(
        buildMachineGeometry(B, atLevel(level)).affordances.baskets.find(
          (b) => b.basketId === 'upper',
        ),
      );
      expect(envelope.positionId).toBe(level);
      expectNear(
        mm(envelope.maxItemHeightClearOfDiscs),
        mm(must(printed[level])),
        1e-6,
        `level ${level}`,
      );
      // Under the roof spinner 30 mm less: "only 19 cm fits" at level 1 (owner update 4.3).
      expectNear(mm(envelope.maxItemHeight), mm(must(printed[level])) - 30, 1e-6);
      expect(must(envelope.overhead[0]).id).toBe('roof_sprayer');
    }
  });

  it('gives the interior, the rim heights and the travel of each basket', () => {
    const lower = must(A.baskets.find((b) => b.basketId === 'lower'));
    // Inside the rim wires of a 525 x 512 mm basket (rim centres 519 x 507, wire 5.5 mm).
    expectNear(mm(lower.interior.max[0] - lower.interior.min[0]), 519 - 5.5, 1e-6);
    expectNear(mm(lower.interior.max[1] - lower.interior.min[1]), 507 - 5.5, 1e-6);
    expect(lower.interior.min[2]).toBe(0);
    // Rim centres 172 mm (sides) and 145 mm (front) above the cross-wire centres, which are
    // 2 mm under the top of the grid; the wire is 5.5 mm thick.
    expectNear(mm(lower.rimTopZ.left), 172 - 2 + 2.75, 1e-6);
    expectNear(mm(lower.rimTopZ.front), 145 - 2 + 2.75, 1e-6);
    expect(lower.travel.direction).toEqual([0, -1, 0]);
    expectNear(lower.travel.distance, 0.5, 1e-12);
    expect(lower.frame).toBe('lower_rack');
    expect(lower.originTub).toEqual(must(geometry.parts.find((p) => p.id === 'lower_rack')).pose.p);
  });
});

describe('dispenser lid and tablet path', () => {
  it('sweeps the sliding lid upwards in the plane of the door', () => {
    const lid = A.dispenserLid;
    expect(lid.kind).toBe('slides');
    // Chamber opening 50 x 35 mm centred 22 mm left of the centre line at z = 510 mm.
    expectNear(mm(lid.closed.min[0]), -47, 1e-6);
    expectNear(mm(lid.closed.max[0]), 3, 1e-6);
    expectNear(mm(lid.closed.min[2]), 492.5, 1e-6);
    expectNear(mm(lid.closed.max[2]), 527.5, 1e-6);
    // It slides up by its own height and takes no room in the tub beyond its thickness.
    expectNear(mm(lid.swept.max[2]), 562.5, 1e-6);
    expect(lid.swept.min).toEqual(lid.closed.min);
    expectNear(mm(lid.swept.max[1] - lid.closed.min[1]), 2, 1e-6);
    expect(mm(lid.swept.max[1])).toBeLessThan(-270);
  });

  it('drops the tablet from the lip of the chamber to the rim of the tray', () => {
    const path = A.tabletPath;
    expect(path.caughtBy).toBe('tray');
    expect(path.basketId).toBe('upper');
    expect(path.points).toHaveLength(2);
    const [exit, landing] = [must(path.points[0]), must(path.points[1])];
    // Dossier 2.12: the tablet leaves at about 492 mm; the tray rim is 55 mm above the floor of
    // the upper basket (475 mm at level 1).
    expectNear(mm(exit[2]), 492.5, 1e-6);
    expectNear(mm(landing[2]), 475, 1e-6);
    expect([landing[0], landing[1]]).toEqual([exit[0], exit[1]]);
    // The dossier's liner plane is 17 mm in front of the tray's front edge: the vertical drop
    // misses the tray by that much (a known inconsistency of the dossier, kept visible).
    expectNear(mm(path.miss), 17, 1e-6);
    // At level 3 the tray is 50 mm lower.
    const low = buildMachineGeometry(B, atLevel('3')).affordances.tabletPath;
    expectNear(mm(must(low.points[1])[2]), 425, 1e-6);
    expect(v3Add(must(low.points[0]), [0, 0, 0])).toEqual(exit);
  });
});

describe('side rests of the upper basket', () => {
  it('offers the two outward slopes of IMG_9131 as rests for cups, and nothing else', () => {
    // IMG_9131 (docs/reference/owner-measurements.md): each side of the floor falls straight
    // from a ridge to the low floor by the wall, 33.3 degrees on the left from x = -152.3 to
    // -199.6 mm of the arm axis, 35.4 degrees on the right from +143.8 to +198.9. The arm axis
    // is at x = 244 mm of the rack frame. The 13.7 degree ramp in the middle and the steep
    // inner faces of the ridges (63 and 82 degrees) are no rests.
    const rests = A.sideRests;
    expect(rests.map((r) => `${r.basketId}.${r.restId}`)).toEqual(['upper.left', 'upper.right']);
    const [left, right] = [must(rests[0]), must(rests[1])];
    expect(left.fallsToward).toBe('-x');
    expect(right.fallsToward).toBe('+x');
    expectNear(mm(left.peakX), 244 - 152.3, 1e-6);
    expectNear(mm(left.footX), 244 - 199.6, 1e-6);
    expectNear(mm(left.peakZ), 30.1, 1e-6);
    expectNear(mm(left.footZ), -1.0, 1e-6);
    expectNear(deg(left.slope), deg(Math.atan2(31.1, 47.3)), 1e-6);
    expect(deg(left.slope)).toBeCloseTo(33.3, 1);
    expectNear(mm(right.peakX), 244 + 143.8, 1e-6);
    expectNear(mm(right.footX), 244 + 198.9, 1e-6);
    expectNear(mm(right.peakZ), 37.6, 1e-6);
    expectNear(mm(right.footZ), -1.5, 1e-6);
    expect(deg(right.slope)).toBeCloseTo(35.4, 1);
    // The low floor runs on from the foot to the inside of the basket on that side.
    const upper = must(A.baskets.find((b) => b.basketId === 'upper'));
    expect(left.wallX).toBe(upper.interior.min[0]);
    expect(right.wallX).toBe(upper.interior.max[0]);
    expect(left.wallX).toBeLessThan(left.footX);
    expect(right.wallX).toBeGreaterThan(right.footX);
    expect(left.y).toEqual([upper.interior.min[1], upper.interior.max[1]]);
  });
});
