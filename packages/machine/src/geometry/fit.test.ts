/**
 * What fits where: the disc-in-a-plane solver against closed forms, and the plates and openings
 * of the owner's Bosch against the manufacturer's printed limits (manual [B1 p. 19-21], quoted
 * in docs/research/machine-bosch-smv4hax40g.md sections 2.2, 2.3 and 5.1) and the owner update
 * (docs/research/machine-bosch-owner-update.md section 4.3).
 */

import { describe, expect, it, vi } from 'vitest';
import { getBasket } from '../config.ts';
import { BOSCH_SMV4HAX40G as B } from '../machines.ts';
import { expectNear, must } from '../test-util.ts';
import type { MachineConfig } from '../types.ts';
import { buildMachineGeometry, getMachinePart } from './build.ts';
import type { PlaneObstacle } from './fit.ts';
import {
  baseGridOpenings,
  discRests,
  maxStandingPlate,
  planeObstacles,
  slotPlane,
  standingPlates,
} from './fit.ts';

// These tests search whole baskets and turn whole arms: slow when the machine is busy with
// the other packages' suites.
vi.setConfig({ testTimeout: 120_000 });

const mm = (m: number): number => m * 1000;
const atLevel = (level: string): MachineConfig => ({
  ...B.defaultConfig,
  basketHeights: { upper: level },
});
const LEVELS = ['1', '2', '3'] as const;
const geometries = new Map(LEVELS.map((level) => [level, buildMachineGeometry(B, atLevel(level))]));
const g1 = must(geometries.get('1'));

describe('a disc among obstacles in a plane', () => {
  it('cradles a disc on two supports at the height geometry gives', () => {
    // Supports of radius 2 mm, 99 mm apart; a 260 mm disc. Its centre is (R + r) from both.
    const supports: PlaneObstacle[] = [
      { q: -0.0495, s: 0, r: 0.002 },
      { q: 0.0495, s: 0, r: 0.002 },
    ];
    const rests = discRests(supports, 0.13, [-0.3, 0.3]);
    expect(rests).toHaveLength(1);
    const rest = must(rests[0]);
    expect(rest.kind).toBe('cradle');
    expectNear(rest.q, 0, 0.00026, 'midway');
    expectNear(rest.s, Math.sqrt(0.132 ** 2 - 0.0495 ** 2), 1e-6, 'height');
  });

  it('cradles it lower between supports of different height, touching both', () => {
    const supports: PlaneObstacle[] = [
      { q: 0, s: 0, r: 0.002 },
      { q: 0.08, s: 0.03, r: 0.002 },
    ];
    const radius = 0.1;
    const step = 0.0001;
    const rest = must(discRests(supports, radius, [-0.3, 0.4], step)[0]);
    // The position is found on a grid of `step`: the disc is within about one step of both.
    for (const o of supports) {
      const gap = Math.hypot(rest.q - o.q, rest.s - o.s) - (radius + o.r);
      expect(gap, 'does not enter the support').toBeGreaterThanOrEqual(-1e-9);
      expect(gap, 'touches the support').toBeLessThan(1.5 * step);
    }
    // Closed form: the centre is the upper intersection of two circles of radius R + r.
    const d = Math.hypot(0.08, 0.03);
    const h = Math.sqrt(0.102 ** 2 - (d / 2) ** 2);
    expectNear(rest.q, 0.04 - (h * 0.03) / d, step, 'q');
    expectNear(rest.s, 0.015 + (h * 0.08) / d, step, 's');
    expect(rest.q).toBeGreaterThan(0);
    expect(rest.q).toBeLessThan(0.08);
  });

  it('leans a disc that is too large for its two rails against a wall beyond them', () => {
    // A rail at the origin, a wall wire 185 mm away and 160 mm up, and a 300 mm disc: it rests
    // on the rail and against the wire, with its centre below the wire's height.
    const obstacles: PlaneObstacle[] = [
      { q: 0, s: 0, r: 0.002 },
      { q: 0.185, s: 0.16, r: 0.002 },
    ];
    const rest = must(
      discRests(obstacles, 0.15, [-0.3, 0.3], 0.0001).find((r) => r.kind === 'leaning'),
    );
    expectNear(Math.hypot(rest.q, rest.s), 0.152, 2e-5, 'on the rail');
    // The disc is lowered from above, so it stops where its widest point can just pass the
    // wire: its centre is R + r in front of the wire, q = 0.185 - 0.152.
    expectNear(rest.q, 0.033, 1.5e-4, 'where it stops');
    expect(rest.s).toBeLessThan(0.16);
    // That leaves it within half a millimetre of the wire (0.44 mm in closed form).
    const gap = Math.hypot(rest.q - 0.185, rest.s - 0.16) - 0.152;
    expect(gap).toBeGreaterThanOrEqual(0);
    expectNear(gap, Math.hypot(0.152, Math.sqrt(0.152 ** 2 - 0.033 ** 2) - 0.16) - 0.152, 1.5e-4);
  });

  it('lets a disc with nothing under it, or only one support, fall', () => {
    expect(discRests([], 0.1, [-0.3, 0.3])).toHaveLength(0);
    expect(discRests([{ q: 0, s: 0, r: 0.002 }], 0.1, [-0.3, 0.3])).toHaveLength(0);
  });

  it('finds where a plane cuts a wire and how wide the cut is', () => {
    // The plane of a slot whose rail runs along x: x = 0.1. A 4 mm wire crosses it at y = 0.2,
    // z = 0.05; another runs parallel to it 1.5 mm away, and a third 3 mm away is not cut.
    const plane = slotPlane({
      index: 0,
      centre: [0.1, 0, 0],
      centreTub: [0.1, 0, 0],
      pitch: 0.02,
      clearWidth: 0.016,
      lean: 0,
      leanToward: '+x',
      plateNormal: [1, 0, 0],
      vGap: false,
      blockedBy: null,
    });
    expect(plane.across).toEqual([0, 1, 0]);
    expect(plane.up).toEqual([0, 0, 1]);
    const identity = { p: [0, 0, 0] as const, q: [0, 0, 0, 1] as const };
    const wire = (
      id: string,
      a: readonly [number, number, number],
      b: readonly [number, number, number],
    ) => ({
      shape: {
        parts: [
          {
            id,
            prim: { kind: 'capsule' as const, a, b, radius: 0.002 },
            pose: identity,
            material: 'm',
          },
        ],
        regions: [],
      },
      pose: identity,
    });
    const crossing = planeObstacles([wire('w', [0, 0.2, 0.05], [0.3, 0.2, 0.05])], plane);
    expect(crossing.length).toBeGreaterThan(0);
    for (const o of crossing) {
      expectNear(o.q, 0.2, 1e-9);
      expectNear(o.s, 0.05, 1e-9);
    }
    expectNear(Math.max(...crossing.map((o) => o.r)), 0.002, 1e-4, 'full section at the crossing');
    const beside = planeObstacles([wire('w', [0.1015, 0.1, 0.02], [0.1015, 0.3, 0.02])], plane);
    // Cut 1.5 mm off its axis: a strip of half width sqrt(2^2 - 1.5^2) mm along its length.
    expectNear(must(beside[0]).r, Math.sqrt(0.002 ** 2 - 0.0015 ** 2), 1e-9);
    expectNear(must(beside[0]).q, 0.1, 1e-9);
    expectNear(must(beside[beside.length - 1]).q, 0.3, 1e-9);
    expect(planeObstacles([wire('w', [0.103, 0.1, 0.02], [0.103, 0.3, 0.02])], plane)).toHaveLength(
      0,
    );
  });
});

describe('Bosch: plates in the lower basket', () => {
  it('stands a 26 cm plate on both rear rails, its lowest point 7.4 mm under the rail centres', () => {
    // Dossier 2.3: "a plate up to about 26 to 27 cm is held by R1 and R2 together". Closed
    // form: rails 99 mm apart, 4 mm wire, a 260 mm disc leaning 15 degrees: its edge dips
    // 130 - sqrt(132^2 - 49.5^2) = 7.63 mm below the rail centres along its own plane.
    const plates = standingPlates(B, g1, 'lower', 0.26, { rows: ['r1'] }).filter(
      (p) => p.slotIndex === 4,
    );
    const plate = must(plates.find((p) => p.rest === 'cradle'));
    const railZ = 84; // tub frame, mm: rails 13 mm above the cross wires at 71 mm.
    const dip = (130 - Math.sqrt(132 ** 2 - 49.5 ** 2)) * Math.cos((15 * Math.PI) / 180);
    expectNear(mm(plate.bottomZ), railZ - dip, 0.05, 'lowest point');
    expectNear(
      mm(plate.topZ - plate.bottomZ),
      260 * Math.cos((15 * Math.PI) / 180),
      0.1,
      'leaning 15 degrees',
    );
    // Midway between the rails: dossier-frame y = +167 and +68, the basket 6 mm forward.
    expectNear(mm(plate.centreTub[1]), (167 + 68) / 2 - 6, 0.5);
  });

  it('holds plates on both rear rails up to about 26 to 27 cm, and leans larger ones on the rear wall', () => {
    // Dossier 2.2 item 6 and the seating limit of its specification (265 mm).
    const midway = (167 + 68) / 2 - 6;
    let largest = 0;
    for (let d = 250; d <= 285; d++) {
      const onBoth = standingPlates(B, g1, 'lower', d / 1000, { rows: ['r1'] }).some(
        (p) =>
          p.slotIndex === 4 && p.rest === 'cradle' && Math.abs(mm(p.centreTub[1]) - midway) < 1,
      );
      if (onBoth) largest = d;
    }
    const printed = mm(must(must(getBasket(B, 'lower').limits).seating[0]).maxDiameter);
    expect(printed).toBe(265);
    expectNear(largest, printed, 6, 'largest plate on both rear rails');
    // A 30 cm plate there leans against the rear wall, further forward and higher.
    const big = must(
      standingPlates(B, g1, 'lower', 0.3, { rows: ['r1'] }).find((p) => p.slotIndex === 4),
    );
    expect(big.rest).toBe('leaning');
    expect(mm(big.centreTub[1])).toBeLessThan(midway - 10);
  });

  it('tops a 30 cm plate in the rear rows out near 372 mm, 14 mm under the blades of the upper arm', () => {
    // Owner update 4.3: "A 30 cm plate in the rear rows of the lower basket tops out ... near
    // 368 mm: 18 mm clear of the blades (386 mm) but 3 mm above the lowest point of the hub
    // (365 mm), which the rear rows do not pass under." The update had the floor wires in one
    // layer at 65 / 67 / 69 mm; with those taken as the lowest wires the rails the plate
    // stands on are 4 mm higher (84 mm), and so is the plate.
    const plate = must(
      standingPlates(B, g1, 'lower', 0.3, { rows: ['r1'] }).find((p) => p.slotIndex === 4),
    );
    expectNear(mm(plate.topZ), 368 + 4, 1.5, 'top of the plate');
    expectNear(386 - mm(plate.topZ), 18 - 4, 1.5, 'under the blades');
    expect(plate.clearance).toBeGreaterThan(0.01);
    expect(mm(plate.topZ)).toBeGreaterThan(365);
  });

  it("admits the printed limits in the rear rows at every level (the dossier's constraint)", () => {
    // Dossier 5.1: "if a 30 cm plate in the rear rows, a 27.5 cm plate at level 2 or a 25 cm
    // plate at level 3 touches the upper arm, the geometry is wrong, not the plate."
    const printed = must(getBasket(B, 'lower').limits).maxDiameterByPosition;
    for (const level of LEVELS) {
      const d = must(printed[level]);
      const plates = standingPlates(B, must(geometries.get(level)), 'lower', d, {
        rows: ['r1', 'r2'],
      });
      const clear = plates.filter((p) => p.clearance > 0);
      expect(clear.length, `level ${level}: a ${mm(d)} mm plate`).toBeGreaterThan(20);
    }
  });

  it('computes the largest plate that is safe wherever it stands in the rear rows: 30, 27.5, 25 cm', () => {
    // The manual prints one figure per level for the whole basket, so it has to hold under the
    // lowest point of the upper arm (its hub): a flat ceiling there. Tolerance: the owner's tape
    // reading of the gap between the floor wires and that hub (5 mm, and 2 mm for the face of
    // the wire), 7.5 mm on the diameter of a plate leaning 15 degrees.
    const printed = must(getBasket(B, 'lower').limits).maxDiameterByPosition;
    const lines: string[] = [];
    for (const level of LEVELS) {
      const g = must(geometries.get(level));
      const safe = must(maxStandingPlate(B, g, 'lower', { ceiling: 'lowest', rows: ['r1'] }));
      const anywhere = must(maxStandingPlate(B, g, 'lower'));
      lines.push(
        `level ${level}: largest plate in the rear rows under a ceiling at the hub ${mm(safe.diameter).toFixed(0)} mm (printed ${mm(must(printed[level])).toFixed(0)}); largest that stands anywhere ${mm(anywhere.diameter).toFixed(0)} mm (row ${anywhere.rowId}, slot ${anywhere.slotIndex}, limited by ${anywhere.nearest})`,
      );
      expectNear(mm(safe.diameter), mm(must(printed[level])), 7.5, `level ${level}`);
      expect(safe.rowId).toBe('r1');
      // What actually stands is larger: beside the hub the blades are 21 mm higher, and a
      // plate leaning towards a side wall passes outside the arm altogether.
      expect(anywhere.diameter).toBeGreaterThanOrEqual(must(printed[level]));
      expect(anywhere.clearance).toBeGreaterThanOrEqual(0);
    }
    console.log(lines.join('\n'));
  }, 60_000);

  it('stands the 31 cm plates "as shown": astride ML and R2 on the floor cross wires', () => {
    // Dossier 2.2: at level 1 a 31 cm plate fits astride the left middle row and the second
    // rear row, on the two cross wires between them, about 8 mm lower than on the rear rails,
    // 74 mm behind the rail of the middle row.
    const shown = must(must(getBasket(B, 'lower').limits).maxDiameterAsShown);
    expect(mm(shown.diameter)).toBe(310);
    const plates = standingPlates(B, g1, 'lower', shown.diameter, { rows: ['ml'] });
    const mlRailY = -80 - 6;
    // In the slots away from the left wall (a plate in the outermost slot leans into it).
    const candidates = plates.filter(
      (p) => p.rest === 'cradle' && Math.abs(mm(p.centreTub[1]) - (mlRailY + 74)) < 3,
    );
    expect(candidates.length).toBeGreaterThanOrEqual(4);
    const astride = must([...candidates].sort((a, b) => b.clearance - a.clearance)[0]);
    expect(astride.clearance).toBeGreaterThan(0.005);
    const onRails = must(
      standingPlates(B, g1, 'lower', 0.26, { rows: ['r1'] }).find(
        (p) => p.slotIndex === 4 && p.rest === 'cradle',
      ),
    );
    expectNear(mm(onRails.bottomZ - astride.bottomZ), 8, 1.5, 'lower than on the rear rails');
    // Under a ceiling at the hub the largest plate of the whole basket is one standing so, and
    // it is the manual's 31 cm.
    const safe = must(maxStandingPlate(B, g1, 'lower', { ceiling: 'lowest' }));
    expectNear(mm(safe.diameter), 310, 7.5, 'largest plate anywhere under the hub');
    expectNear(mm(safe.centreTub[1]), mlRailY + 74, 3, 'astride the middle row and R2');
  }, 60_000);

  it('bounds the plate from above: none leans out over the basket, and under the blades of the upper arm it stands at most 31 to 32 cm tall', () => {
    // Manual [B1 p. 19-21], dossier 2.3 and 5.1: 30 cm in the bottom basket at level 1, and
    // 31 cm "as shown". Two things bound a plate from above.
    const lower = getBasket(B, 'lower');
    const origin = must(g1.affordances.baskets.find((b) => b.basketId === 'lower')).originTub;
    const upperArm = must(g1.affordances.armSweeps.find((a) => a.levelId === 'upper'));
    const overhang = (p: { topTub: readonly number[] }): number =>
      Math.max(
        origin[0] - must(p.topTub[0]),
        must(p.topTub[0]) - (origin[0] + lower.outline.size[0]),
      );
    // (1) A plate stays inside the plan outline of its basket. The case the review found, a
    // 361 mm plate in row MR leaning 17 degrees out over the right wall (top at x = 267 mm, 6 mm
    // from the tub wall), no longer stands: wherever a plate of that size is clear of the upper
    // basket and the arm, it leans out over the rim.
    const huge = standingPlates(B, g1, 'lower', 0.361);
    expect(huge.length).toBeGreaterThan(0);
    expect(huge.filter((p) => p.clearance >= 0)).toEqual([]);
    const leaningOut = huge.filter((p) => p.nearest === 'basket outline');
    expect(leaningOut.length).toBeGreaterThan(0);
    for (const p of leaningOut) expect(mm(overhang(p))).toBeGreaterThan(0);
    // And every plate that does stand, of any size, is inside the outline.
    for (const d of [0.25, 0.3, 0.33, 0.35]) {
      for (const p of standingPlates(B, g1, 'lower', d).filter((q) => q.clearance >= 0)) {
        expect(mm(overhang(p)), `${mm(d)} mm in ${p.rowId}`).toBeLessThanOrEqual(1e-6);
      }
    }
    // (2) Under the sweep of the upper arm its blades bound the plate: their undersides are at
    // 386 mm, and no plate goes lower than the underside of the lowest floor wires at 65 mm, so
    // 321 mm of height at most; the top of the grid is at 73 mm, 313 mm under the blades. That
    // is the manual's 31 cm for a plate that stands upright. The thin disc of this model leans
    // with the tines, 15 to 17 degrees, which lets it be 1 / cos(17 deg) larger: 335 mm at most.
    // "Under the sweep": its highest point is within 200 mm of the arm's axis.
    const underArm = (d: number) =>
      standingPlates(B, g1, 'lower', d).filter(
        (p) =>
          p.clearance >= 0 &&
          Math.hypot(must(p.topTub[0]) - upperArm.axis[0], must(p.topTub[1]) - upperArm.axis[1]) <
            0.2,
      );
    let largest = 0;
    let tallest = 0;
    for (let d = 290; d <= 345; d++) {
      const plates = underArm(d / 1000);
      if (plates.length === 0) continue;
      largest = d;
      tallest = Math.max(tallest, ...plates.map((p) => mm(p.topZ - p.bottomZ)));
      for (const p of plates) expect(mm(p.topZ), `${d} mm in ${p.rowId}`).toBeLessThan(386);
    }
    console.log(
      `level 1: largest plate that stands under the sweep of the upper arm ${largest} mm, standing ${tallest.toFixed(0)} mm tall`,
    );
    expect(largest).toBeGreaterThanOrEqual(310);
    expect(largest).toBeLessThanOrEqual(Math.floor((386 - 65) / Math.cos((17 * Math.PI) / 180)));
    expect(tallest).toBeLessThanOrEqual(386 - 65);
    expectNear(tallest, 313, 8, 'height of the largest plate under the blades');
    // What is larger than that stands only in the strips beside the arm's sweep, towards the
    // side walls, and is stopped by the underside of the upper basket (413 mm): a 35 cm plate
    // does, a 36 cm one does not.
    const beside = standingPlates(B, g1, 'lower', 0.35).filter((p) => p.clearance >= 0);
    expect(beside.length).toBeGreaterThan(0);
    for (const p of beside) {
      const r = Math.hypot(
        must(p.topTub[0]) - upperArm.axis[0],
        must(p.topTub[1]) - upperArm.axis[1],
      );
      expect(mm(r), `${p.rowId} slot ${p.slotIndex}`).toBeGreaterThan(200);
      expect(mm(p.topZ)).toBeLessThanOrEqual(413);
    }
    expect(standingPlates(B, g1, 'lower', 0.36).filter((p) => p.clearance >= 0)).toEqual([]);
  }, 120_000);

  it('does not count a plate whose edge is inside the sweep of the upper arm as clear', () => {
    // A 34 cm plate in the middle of the rear rows leans 15 degrees and tops out near 410 mm,
    // inside the ring the blades of the upper arm sweep (386 to 399 mm, out to 230 mm). Its
    // clearance is negative, by about how far it reaches in, not zero.
    const plates = standingPlates(B, g1, 'lower', 0.34, { rows: ['r1'] }).filter(
      (p) => p.slotIndex >= 8 && p.slotIndex <= 12,
    );
    expect(plates.length).toBeGreaterThan(0);
    for (const plate of plates) {
      expect(mm(plate.topZ)).toBeGreaterThan(386);
      expect(plate.clearance).toBeLessThan(-0.003);
      expect(plate.nearest).toBe('upper arm');
    }
  });

  it('holds plates on both side rails up to about 24 cm (dossier 2.3)', () => {
    const printed = mm(must(must(getBasket(B, 'lower').limits).seating[1]).maxDiameter);
    expect(printed).toBe(240);
    // Midway between the rails of FL (y = -186) and ML (y = -80).
    const midway = (-186 - 80) / 2 - 6;
    let largest = 0;
    for (let d = 220; d <= 260; d++) {
      const onBoth = standingPlates(B, g1, 'lower', d / 1000, { rows: ['fl'] }).some(
        (p) =>
          p.slotIndex === 2 && p.rest === 'cradle' && Math.abs(mm(p.centreTub[1]) - midway) < 1,
      );
      if (onBoth) largest = d;
    }
    expectNear(largest, printed, 8, 'largest plate on both side rails');
  });
});

describe('Bosch: items in the upper basket', () => {
  it('computes the largest plate that stands under the roof: 22, 24.5, 27 cm', () => {
    // Manual [B1 p. 21]. Tolerance 10 mm: the owner's tape (5 mm) and the dip of a thin disc
    // between two floor wires up to 67 mm apart (up to 5 mm at this size). Before the centre
    // wire of IMG_9083 was drawn a plate dipped up to 9 mm into the 88 mm gap over the feed
    // tube and the printed sizes stood with room to spare; now the largest that stands is 1 to
    // 4 mm under the printed size, inside the +-7 mm of the taped floor height.
    const printed = must(getBasket(B, 'upper').limits).maxDiameterByPosition;
    const lines: string[] = [];
    for (const level of LEVELS) {
      const plate = must(maxStandingPlate(B, must(geometries.get(level)), 'upper'));
      lines.push(
        `level ${level}: largest plate standing in the upper basket ${mm(plate.diameter).toFixed(0)} mm (printed ${mm(must(printed[level])).toFixed(0)}), row ${plate.rowId}, limited by ${plate.nearest}`,
      );
      expectNear(mm(plate.diameter), mm(must(printed[level])), 10, `level ${level}`);
      expect(plate.diameter).toBeGreaterThanOrEqual(must(printed[level]) - 0.005);
      expect(plate.nearest).toMatch(/roof/);
      expect(mm(plate.topZ)).toBeLessThanOrEqual(640);
    }
    console.log(lines.join('\n'));
  }, 60_000);
});

describe('openings of the base grids', () => {
  it('finds the largest opening of the Bosch lower basket: about 115 x 100 mm between rows', () => {
    // Dossier 2.3, centre to centre of the wires, positions good to 10 mm.
    const basket = getBasket(B, 'lower');
    const openings = baseGridOpenings(basket, getMachinePart(g1, 'lower_rack').shape);
    const wire = mm(basket.wires.floor.coated);
    expectNear(mm(openings.largestRectangle.size[0]) + wire, 115, 10, 'along x');
    expectNear(mm(openings.largestRectangle.size[1]) + wire, 100, 10, 'along y');
    // Between the front-back wires at x = -19 and +98 and the rails of the front and middle
    // rows (rack frame: 243.5 to 360.5 mm, 70 to 176 mm).
    expect(mm(openings.largestRectangle.x[0])).toBeGreaterThan(243.5);
    expect(mm(openings.largestRectangle.x[1])).toBeLessThan(360.5);
    // "anything smaller than a saucer can fall through": a ball of about 10 cm does.
    expectNear(mm(openings.largestBallDiameter), 102, 4);
    console.log(
      `lower basket: largest ball through the base grid ${mm(openings.largestBallDiameter).toFixed(0)} mm, largest clear rectangle ${openings.largestRectangle.size.map((v) => mm(v).toFixed(0)).join(' x ')} mm`,
    );
  });

  it('finds the largest opening of the Bosch upper basket: the 67 mm gap between rows A and B', () => {
    // Dossier 2.5: front-back wires at x = -108 and -41, cross wires at 36.5 mm pitch; 3.5 mm
    // wire. The dossier's 88 mm gap over the arm hub is halved by the centre wire of IMG_9083.
    const basket = getBasket(B, 'upper');
    const openings = baseGridOpenings(basket, getMachinePart(g1, 'upper_rack').shape);
    expectNear(mm(openings.largestRectangle.size[0]) + 3.5, 67, 1.5, 'along x');
    expectNear(mm(openings.largestRectangle.size[1]) + 3.5, 36.5, 4, 'along y');
    expectNear(mm(openings.largestRectangle.x[0]), 136 + 1.75, 1.01);
    // What falls through is smaller than the pitch of the cross wires.
    expect(mm(openings.largestBallDiameter)).toBeLessThan(40);
    expect(mm(openings.largestBallDiameter)).toBeGreaterThan(30);
    console.log(
      `upper basket: largest ball through the base grid ${mm(openings.largestBallDiameter).toFixed(0)} mm, largest clear rectangle ${openings.largestRectangle.size.map((v) => mm(v).toFixed(0)).join(' x ')} mm`,
    );
  });
});
