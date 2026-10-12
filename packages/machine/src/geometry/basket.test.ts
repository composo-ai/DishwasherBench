/**
 * The generated baskets of the owner's Bosch against the numbers of its dossier
 * (docs/research/machine-bosch-smv4hax40g.md sections 2.3 and 2.5) and of the owner update
 * (docs/research/machine-bosch-owner-update.md section 4.3). The expected values are typed in
 * here from those documents, in their frames, and are not read back from the specification.
 */

import type { Vec3 } from '@spotless/core';
import { v3Add, v3Distance } from '@spotless/core';
import type { Part, Shape } from '@spotless/geometry';
import { boundingBox } from '@spotless/geometry';
import { describe, expect, it } from 'vitest';
import { getBasket } from '../config.ts';
import { BOSCH_SMV4HAX40G as B } from '../machines.ts';
import { expectNear, must } from '../test-util.ts';
import type { MachineConfig } from '../types.ts';
import { buildBasketFittings, buildBasketWires, buildTabletTray } from './basket.ts';
import { capsuleLength } from './wire.ts';

const mm = (m: number): number => m * 1000;
const lower = getBasket(B, 'lower');
const upper = getBasket(B, 'upper');
const lowerWires = buildBasketWires(B, lower, B.defaultConfig);
const upperWires = buildBasketWires(B, upper, B.defaultConfig);

/** Rack-frame origins in the tub frame, from the dossier and the update, mm. */
const LOWER_ORIGIN: Vec3 = [-262.5, -262, 73];
const UPPER_ORIGIN: Vec3 = [-244, -258, 420];

function partsWith(shape: Shape, prefix: string): Part[] {
  return shape.parts.filter((p) => p.id.startsWith(prefix));
}

/** End points of a capsule part, in mm, moved by `origin` (mm). */
function ends(part: Part, origin: Vec3 = [0, 0, 0]): [Vec3, Vec3] {
  if (part.prim.kind !== 'capsule') throw new Error(`${part.id} is not a capsule`);
  const a: Vec3 = [mm(part.prim.a[0]), mm(part.prim.a[1]), mm(part.prim.a[2])];
  const b: Vec3 = [mm(part.prim.b[0]), mm(part.prim.b[1]), mm(part.prim.b[2])];
  return [v3Add(a, origin), v3Add(b, origin)];
}

/** Top of some parts above the rack-frame origin, mm. */
function topOf(parts: readonly Part[]): number {
  return mm(boundingBox({ parts, regions: [] }).max[2]);
}

function longest(parts: readonly Part[]): Part {
  let best = must(parts[0]);
  for (const p of parts) if (capsuleLength([p]) > capsuleLength([best])) best = p;
  return best;
}

describe('Bosch lower basket wires', () => {
  it('is made of capsules only', () => {
    expect(lowerWires.parts.every((p) => p.prim.kind === 'capsule')).toBe(true);
    expect(upperWires.parts.every((p) => p.prim.kind === 'capsule')).toBe(true);
  });

  it('has 6 tine rows with 23, 23, 7, 7, 6 and 6 tines (dossier 2.3, counts verified)', () => {
    const count = (row: string): number =>
      lowerWires.parts.filter((p) => p.id.startsWith(`row.${row}.tine.`)).length;
    expect(['r1', 'r2', 'ml', 'mr', 'fl', 'fr'].map(count)).toEqual([23, 23, 7, 7, 6, 6]);
    // Every tine of this basket has a ball end (dossier: "Tine tips: ball ends").
    expect(partsWith(lowerWires, 'row.').filter((p) => p.id.includes('.tip.'))).toHaveLength(72);
    // And each row has its rail.
    expect(new Set(partsWith(lowerWires, 'row.').map((p) => p.id.split('.')[1])).size).toBe(6);
  });

  it('stands the rear tines at x = -208 + 18.25 k and +202 on rails at y = +167 and +68', () => {
    // Dossier frame: origin at the rim centre; the basket stands 6 mm in front of the arm axis.
    const xs = [...Array.from({ length: 22 }, (_, k) => -208 + 18.25 * k), 202];
    for (const [row, y] of [
      ['r1', 167],
      ['r2', 68],
    ] as const) {
      xs.forEach((x, i) => {
        const [base] = ends(
          must(lowerWires.parts.find((p) => p.id === `row.${row}.tine.${i}`)),
          LOWER_ORIGIN,
        );
        expectNear(base[0], x, 1e-6, `${row} tine ${i} x`);
        expectNear(base[1], y - 6, 1e-6, `${row} tine ${i} y`);
        // Rails 13 mm above the floor cross wires, whose centres are at 71 mm: 4 mm above the
        // lowest floor wires at 67 mm, which are what the owner's 15 mm was taken to.
        expectNear(base[2], 50 + 15 + 2 + 4 + 13, 1e-6, `${row} tine ${i} z`);
      });
    }
  });

  it('leans the first 15 rear tines to the left and the last 8 to the right by 15 degrees', () => {
    for (let i = 0; i < 23; i++) {
      const [a, b] = ends(must(lowerWires.parts.find((p) => p.id === `row.r1.tine.${i}`)));
      const lean = (Math.atan2(b[0] - a[0], b[2] - a[2]) * 180) / Math.PI;
      expectNear(lean, i < 15 ? -15 : 15, 1e-6, `tine ${i}`);
      expectNear(b[1] - a[1], 0, 1e-9, 'no front-back lean');
    }
  });

  it('puts every tine tip at the height the dossier gives', () => {
    // Dossier 2.2: rear tine tips 150 mm above the filter plate; side tines 81 mm above rails
    // at 84 mm, so 165 mm (its table rounds the same tips to 166). With the owner's 15 mm taken
    // to the lowest floor wires the cross wires are at the dossier's own 71 mm, and so are the
    // rails and tips that it gives from them. Tolerance 0.5 mm: a leaning ball end stands a little
    // over the nominal tip.
    const expected: Record<string, number> = {
      r1: 150,
      r2: 150,
      ml: 165,
      mr: 165,
      fl: 165,
      fr: 165,
    };
    for (const row of lower.tineRows) {
      row.tinePositions.forEach((_, i) => {
        const parts = lowerWires.parts.filter(
          (p) => p.id === `row.${row.id}.tine.${i}` || p.id === `row.${row.id}.tip.${i}`,
        );
        expectNear(
          topOf(parts) + LOWER_ORIGIN[2],
          must(expected[row.id]),
          0.5,
          `${row.id} tine ${i}`,
        );
      });
    }
  });

  it('leaves the 53 mm V gap between the 15th and 16th rear tines (dossier 2.3)', () => {
    // "their tips are 53 mm apart (18.25 + 2 x 68 sin 15)".
    const tip = (i: number): Vec3 => {
      const part = must(lowerWires.parts.find((p) => p.id === `row.r1.tip.${i}`));
      return ends(part)[0];
    };
    expectNear(v3Distance(tip(14), tip(15)), 53, 1.5, 'V gap');
  });

  it('has 5 front-back floor wires at x = -199, -86, -19, +98, +179 and 2 cross wires', () => {
    const xs = [-199, -86, -19, 98, 179];
    xs.forEach((x, i) => {
      const run = longest(partsWith(lowerWires, `floor.y.${i}.`));
      const [a, b] = ends(run, LOWER_ORIGIN);
      expectNear(a[0], x, 1e-6, `wire ${i} x`);
      expectNear(b[0], x, 1e-6, `wire ${i} x`);
      // The lowest wires of the floor: centres at 67 mm, undersides at 65 mm, the owner's 15 mm
      // above the top of the lower arm. The cross wires lie one wire diameter (4 mm) higher.
      expectNear(a[2], 50 + 15 + 2, 1e-6, `wire ${i} z`);
      expect(Math.abs(b[1] - a[1])).toBeGreaterThan(450);
    });
    expect(partsWith(lowerWires, 'floor.y.5.')).toHaveLength(0);
    // Cross wires between the rear and side rows at y = +32 and -43 (dossier frame).
    const ys = [-43 - 6, 32 - 6];
    ys.forEach((y, i) => {
      const [a, b] = ends(longest(partsWith(lowerWires, `floor.x.${i}.`)), LOWER_ORIGIN);
      expectNear(a[1], y, 1e-6, `cross wire ${i} y`);
      expectNear(a[2], 71, 1e-6, `cross wire ${i} z`);
      expect(Math.abs(b[0] - a[0])).toBeGreaterThan(450);
    });
    expect(partsWith(lowerWires, 'floor.x.2.')).toHaveLength(0);
  });

  it('turns every floor wire up at both walls, to the rim', () => {
    // Front rim 145 mm and side and rear rims 172 mm above the cross wires (dossier 2.3).
    for (let i = 0; i < 5; i++) {
      const top = topOf(partsWith(lowerWires, `floor.y.${i}.`));
      expectNear(top, 172 - 2 + 2, 0.01, 'rear end reaches the rear rim centre, plus its radius');
    }
    for (let i = 0; i < 2; i++) {
      expectNear(topOf(partsWith(lowerWires, `floor.x.${i}.`)), 172, 0.01);
    }
  });

  it('has a closed rim at 172 mm (sides, rear) and 145 mm (front) above the cross wires', () => {
    const rim = partsWith(lowerWires, 'rim.');
    rim.forEach((part, i) => {
      const next = must(rim[(i + 1) % rim.length]);
      expectNear(v3Distance(ends(part)[1], ends(next)[0]), 0, 1e-9, `rim joint ${i}`);
    });
    const zs = rim.flatMap((p) => ends(p, LOWER_ORIGIN).map((e) => e[2]));
    expectNear(Math.max(...zs), 71 + 172, 1e-6, 'side rim');
    expectNear(Math.min(...zs), 71 + 145, 1e-6, 'front rim');
    // Length against the outline computed by hand from the dossier's figures: a 519 x 507 mm
    // rectangle of wire centres, front corners cut 41 x 59 mm (and dropping 27 mm), rear
    // corners rounded at 25 mm, a 6 mm recess 60 mm wide with 10 mm ramps in the rear wall.
    const expected =
      2 * (519 + 507) -
      2 * (41 + 59) +
      2 * Math.hypot(41, 59, 27) -
      2 * (2 * 25) +
      2 * ((Math.PI / 2) * 25) +
      2 * (Math.hypot(10, 6) - 10);
    // Rounding the bends shortens the wire by a few millimetres per corner: 1 %.
    expectNear(mm(capsuleLength(rim)), expected, expected * 0.01, 'rim length');
  });

  it('has 4 horizontal wires and 5 uprights in the rear wall (dossier 2.3, counts verified)', () => {
    // Horizontal wires passing x = 100 mm on the rear rim line (y = 509.5 mm in the rack frame).
    const zs = new Set<number>();
    for (const part of lowerWires.parts) {
      if (!(part.id.startsWith('wall.') || part.id.startsWith('rim.'))) continue;
      const [a, b] = ends(part);
      const alongX =
        Math.abs(a[1] - 509.5) < 1e-6 &&
        Math.abs(b[1] - 509.5) < 1e-6 &&
        Math.abs(a[2] - b[2]) < 1e-6;
      if (alongX && Math.min(a[0], b[0]) <= 100 && Math.max(a[0], b[0]) >= 100)
        zs.add(Math.round(a[2]));
    }
    // The rim, the two hoops and the bottom wire; the rack frame's z = 0 is 2 mm above the plane
    // of the floor cross wires. The hoops by proportion along the front wall of the owner's
    // loaded photograph (rim, wire, wire, feet at image y = 1597, 1672, 1735, 1797), the foot
    // of the wall taken 12 % further from the camera than the rim: with k = 0.12 and u the
    // share of the wall's height below the rim, pixels run as ln(1 + k u).
    const rows = [1597, 1672, 1735, 1797] as const;
    const share = (row: number): number =>
      (Math.exp(((row - rows[0]) / (rows[3] - rows[0])) * Math.log(1.12)) - 1) / 0.12;
    expectNear(145 * (1 - share(rows[1])), 92, 3, 'upper hoop by proportion');
    expectNear(145 * (1 - share(rows[2])), 46, 3, 'lower hoop by proportion');
    expect([...zs].sort((p, q) => p - q)).toEqual([-2, 44, 90, 170]);
    // Uprights: vertical capsules longer than 100 mm on the rear wall line (set forward 6 mm in
    // the middle, where the wall is recessed for the riser).
    const uprights = lowerWires.parts.filter((part) => {
      const [a, b] = ends(part);
      return (
        Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6 && Math.abs(a[2] - b[2]) > 100 && a[1] > 500
      );
    });
    expect(uprights).toHaveLength(5);
    const recessed = uprights.filter((p) => Math.abs(ends(p)[0][1] - 503.5) < 1e-6);
    expect(recessed).toHaveLength(1);
    expectNear(ends(must(recessed[0]), LOWER_ORIGIN)[0][0], -19, 1e-6, 'the wire in the recess');
  });

  it('lays a folded rear row flat towards the front', () => {
    const config: MachineConfig = {
      ...B.defaultConfig,
      foldedTineRows: [{ basketId: 'lower', rowId: 'r1' }],
    };
    const folded = buildBasketWires(B, lower, config);
    for (let i = 0; i < 23; i++) {
      const [base, top] = ends(must(folded.parts.find((p) => p.id === `row.r1.tine.${i}`)));
      const [upBase, upTop] = ends(must(lowerWires.parts.find((p) => p.id === `row.r1.tine.${i}`)));
      expectNear(v3Distance(base, upBase), 0, 1e-9, 'the base stays on the rail');
      expectNear(top[2], base[2], 1e-6, 'flat');
      // The 66 mm of height become 66 mm towards the front; the lean along the rail stays.
      expectNear(top[1] - base[1], -(upTop[2] - upBase[2]), 1e-6, 'towards -y');
      expectNear(top[0] - base[0], upTop[0] - upBase[0], 1e-6, 'x unchanged');
    }
    // R2 is untouched.
    expect(folded.parts.find((p) => p.id === 'row.r2.tine.3')).toEqual(
      lowerWires.parts.find((p) => p.id === 'row.r2.tine.3'),
    );
    expect(folded.parts).toHaveLength(lowerWires.parts.length);
  });
});

describe('Bosch upper basket wires', () => {
  it('has rows of 6, 6, 9, 9, 6 and 5 tines (dossier 2.5, counts verified)', () => {
    const tines = (row: string): number =>
      new Set(
        upperWires.parts
          .filter((p) => p.id.startsWith(`row.${row}.tine.`))
          .map((p) => p.id.split('.')[3]),
      ).size;
    expect(['a', 'b', 'a2', 'b2', 'c_rear', 'c_front'].map(tines)).toEqual([6, 6, 9, 9, 6, 5]);
    // Hairpin tines are two legs and a bow, with a ball on top.
    expect(upperWires.parts.filter((p) => p.id.startsWith('row.a2.tine.0.'))).toHaveLength(3);
    expect(upperWires.parts.filter((p) => p.id === 'row.a2.tip.0')).toHaveLength(1);
  });

  /**
   * Height of the centre line of a wire (its capsules) at x, mm above the rack-frame origin,
   * with x in the dossier frame of the upper basket (origin on the upper-arm axis).
   */
  const wireZAt = (parts: readonly Part[], x: number): number => {
    for (const part of parts) {
      const [a, b] = ends(part, UPPER_ORIGIN);
      const [lo, hi] = a[0] <= b[0] ? [a, b] : [b, a];
      if (x >= lo[0] - 1e-9 && x <= hi[0] + 1e-9 && hi[0] > lo[0]) {
        return lo[2] + ((hi[2] - lo[2]) * (x - lo[0])) / (hi[0] - lo[0]) - UPPER_ORIGIN[2];
      }
    }
    throw new Error(`no capsule at x = ${x}`);
  };

  it('has the 12 left-right floor wires of the dossier, the bottom wire of the front wall and one at the rear, and 12 front-back ones', () => {
    // Dossier frame of the upper basket: origin on the upper-arm axis, 30 mm in front of the
    // lower-arm axis. Wire 0 is the one IMG_9083 shows behind the front wall; wire 13 is assumed.
    const ys = [215, 178, 142, 105, 69, 36, -3, -40, -76, -112, -149, -187].sort((a, b) => a - b);
    ys.forEach((y, i) => {
      const [a] = ends(longest(partsWith(upperWires, `floor.x.${i + 1}.`)), UPPER_ORIGIN);
      expectNear(a[1], y - 30, 1e-6, `cross wire ${i + 1}`);
    });
    expect(partsWith(upperWires, 'floor.x.13.').length).toBeGreaterThan(0);
    expect(partsWith(upperWires, 'floor.x.14.')).toHaveLength(0);
    // The front wire is in two stretches, one on each side of the tablet tray (x = -105 to
    // +110): it is not drawn across the set-back middle of the front wall. In IMG_9131 it
    // turns up behind the two ends of the handle, at x = -101 and about +110.
    const left = partsWith(upperWires, 'floor.x.0.').flatMap((p) => ends(p, UPPER_ORIGIN));
    const right = partsWith(upperWires, 'floor.x.0s1.').flatMap((p) => ends(p, UPPER_ORIGIN));
    expect(left.length).toBeGreaterThan(0);
    expect(right.length).toBeGreaterThan(0);
    expect(Math.max(...left.map((p) => p[0]))).toBeLessThan(-69);
    expect(Math.min(...right.map((p) => p[0]))).toBeGreaterThan(81);
    expect(Math.min(...left.map((p) => p[0]))).toBeLessThan(-200);
    expect(Math.max(...right.map((p) => p[0]))).toBeGreaterThan(210);
    for (const p of [...left, ...right]) expectNear(p[1], -224 - 30, 1e-6, 'front wire');

    // The front-back wires lie on the cross wires, so each is at the height of the floor
    // relief at its x. From the profile measured on IMG_9131 (left slope from -199.6 to the
    // peak at -152.3, trough from -137.3 to -30, centre ridge at -10, ramp down to the foot at
    // 138.4, right peak at 143.8, slope down to 198.9), by hand:
    const leftSlope = (x: number) => -1 + ((30.1 + 1) * (x + 199.6)) / (199.6 - 152.3);
    const ramp = (x: number) => 33.4 - ((33.4 + 2.9) * (x + 10)) / (138.4 + 10);
    const rightSlope = (x: number) => 37.6 - ((37.6 + 1.5) * (x - 143.8)) / (198.9 - 143.8);
    const xs: readonly (readonly [number, number])[] = [
      [-212, -1], // the foot of the inner upright of the front left corner, on the low floor
      [-195, leftSlope(-195)], // ends in a ball on the low end of the left slope: 2.0
      [-161, leftSlope(-161)], // runs back from the hooked upright, high on the slope: 24.4
      [-108, 0],
      [-41, 0],
      [0, ramp(0)], // the centre wire, just right of the ridge: 31.0
      [47, ramp(47)], // on the ramp: 19.5
      [89, ramp(89)], // 9.2
      [128, ramp(128)], // near the foot of the right ridge: -0.4
      [163, rightSlope(163)], // from the hooked upright, high on the right slope: 24.0
      [196, rightSlope(196)], // ends in a ball on the low end of the right slope: 0.6
      [214, -1.5], // the foot of the inner upright of the front right corner
    ];
    expectNear(leftSlope(-195), 2.0, 0.05);
    expectNear(leftSlope(-161), 24.4, 0.05);
    expectNear(ramp(0), 31.0, 0.05);
    expectNear(rightSlope(163), 24.0, 0.05);
    expectNear(rightSlope(196), 0.6, 0.05);
    xs.forEach(([x, rise], i) => {
      const [a, b] = ends(longest(partsWith(upperWires, `floor.y.${i}.`)), UPPER_ORIGIN);
      expectNear(a[0], x, 1e-6, `front-back wire ${i}`);
      // In the left trough their tops are the floor: 420 mm above the filter plate at level 1
      // (the owner's tape).
      expectNear(a[2] + 1.75, 420 + rise, 1e-6, `top of front-back wire ${i}`);
      expect(Math.abs(b[1] - a[1])).toBeGreaterThan(300);
    });
    expect(partsWith(upperWires, 'floor.y.12.')).toHaveLength(0);
    // What IMG_9131 shows of them, heights above the tops of the left-right wires in the left
    // trough (the picture's datum, 3.5 mm under the frame's zero), centre lines: the ball of
    // the wire at -195 at 4.0 and that of +196 at 3.2 (+-1); the wires from the hooked
    // uprights at 25.1 (left) and 24.7 (right). The drawn wires are within 1.5 mm of each.
    const seen: readonly (readonly [number, number])[] = [
      [1, 4.0],
      [2, 25.1],
      [9, 24.7],
      [10, 3.2],
    ];
    for (const [i, zSeen] of seen) {
      const [a] = ends(longest(partsWith(upperWires, `floor.y.${i}.`)), UPPER_ORIGIN);
      expectNear(a[2] - 420 + 3.5, zSeen, 1.5, `front-back wire ${i} against IMG_9131`);
    }
  });

  /** The highest point of the centre line of a wire between two x, as [x, z], dossier frame, mm. */
  const crest = (parts: readonly Part[], from: number, to: number): [number, number] => {
    let best: [number, number] = [Number.NaN, Number.NEGATIVE_INFINITY];
    for (const part of parts) {
      for (const e of ends(part, UPPER_ORIGIN)) {
        const z = e[2] - UPPER_ORIGIN[2];
        if (e[0] >= from && e[0] <= to && z > best[1]) best = [e[0], z];
      }
    }
    return best;
  };

  it('bends every cross wire to the floor relief of IMG_9131, and its built ridges stand where the picture has them', () => {
    // Centre heights of a cross wire in the left trough: 5.25 mm under the floor (one 3.5 mm
    // wire lower than the front-back wires that lie on it).
    for (let i = 1; i <= 13; i++) {
      const wire = partsWith(upperWires, `floor.x.${i}.`);
      const z = (x: number) => wireZAt(wire, x) + 5.25;
      // The level trough under rows A and B, the datum.
      expectNear(z(-80), 0, 1e-6, `wire ${i} in the left trough`);
      expectNear(z(-120), 0, 1e-6, `wire ${i} in the left trough`);
      // Low floor by both walls, where the profile before had a raised strip on the left and a
      // trough at the datum level on the right.
      expectNear(z(-215), -1.0, 1e-6, `wire ${i} by the left wall`);
      expectNear(z(215), -1.5, 1e-6, `wire ${i} by the right wall`);
      // The two straight slopes falling outwards, 33.3 and 35.4 degrees.
      expectNear(z(-180), -1 + (31.1 * 19.6) / 47.3, 1e-6, `wire ${i} on the left slope`);
      expectNear(z(170), 37.6 - (39.1 * 26.2) / 55.1, 1e-6, `wire ${i} on the right slope`);
      // The ramp falls in a straight line from the centre ridge to the foot of the right ridge.
      expectNear(z(20), 33.4 - (36.3 * 30) / 148.4, 1e-6, `wire ${i} on the ramp`);
      expectNear(z(80), 33.4 - (36.3 * 90) / 148.4, 1e-6, `wire ${i} on the ramp`);
      expectNear(z(120), 33.4 - (36.3 * 130) / 148.4, 1e-6, `wire ${i} on the ramp`);

      // THE PIN: the built ridges against the tops of the bends seen in IMG_9131. Heights are
      // of the top of the wire above the top of the same wire in the left trough, which is how
      // the picture was measured (+-1 mm on one side, +-1.5 more between the sides): the left
      // peak 28.0 at x = -153, the right peak 33.0 at +148 and 35.9 above its own foot, whose
      // lowest point is 2.9 below the left trough at +138.5. The centre ridge is hidden in the
      // picture; its corner is where the two visible lines cross.
      const [leftX, leftZ] = crest(wire, -175, -140);
      expectNear(leftZ + 5.25, 28.0, 0.5, `left peak of wire ${i}: height`);
      // (The bend is drawn with chords: its highest chord end is at -155.2, the top of the arc
      // itself at -154.4, the corner of the two straight runs at -152.3.)
      expectNear(leftX, -153, 2.5, `left peak of wire ${i}: x`);
      const [rightX, rightZ] = crest(wire, 140, 175);
      expectNear(rightZ + 5.25, 33.0, 0.6, `right peak of wire ${i}: height`);
      expectNear(rightX, 148, 1.5, `right peak of wire ${i}: x`);
      const [centreX, centreZ] = crest(wire, -30, 20);
      expectNear(centreZ + 5.25, 32.6, 0.3, `centre ridge of wire ${i}: height`);
      expectNear(centreX, -7.5, 2, `centre ridge of wire ${i}: x`);
      // The foot of the right ridge: a V, the lowest point of the floor between the ridges.
      const foot = Math.min(...[134, 136, 137, 138, 139, 140].map(z));
      expectNear(foot, -2.9 + 1.6, 1.0, `foot of the right ridge of wire ${i}`);
      expectNear(rightZ + 5.25 - foot, 35.9, 1.5, `right peak of wire ${i} above its foot`);
      // The rounded bends take 2.4, 0.8 and 4.1 mm off the tops of the corners of the three
      // ridges: the bend radius is 1.5 wire diameters (5.25 mm) and the ridges turn through
      // 96.8, 72.8 and 117.8 degrees. The picture shows about 4.5 mm on the left and 6.6 on the
      // right; one radius serves both within 0.5 mm of height.
      expectNear(30.1 - (leftZ + 5.25), 2.4, 0.2, 'left bend');
      expectNear(33.4 - (centreZ + 5.25), 0.8, 0.2, 'centre bend');
      expectNear(37.6 - (rightZ + 5.25), 4.1, 0.2, 'right bend');
      // The wire is rounded where it bends: three to five capsules a bend, eight bends (the
      // two shallow ones where a slope meets the low floor by a wall are rounded too).
      expect(wire.length).toBeGreaterThanOrEqual(9 + 6 * 2);
    }
  });

  it('gives the bottom wire of the front wall the same relief on both sides of the tablet tray', () => {
    // IMG_9131 measured the relief on this wire.
    const left = partsWith(upperWires, 'floor.x.0.');
    const right = partsWith(upperWires, 'floor.x.0s1.');
    const [leftX, leftZ] = crest(left, -175, -140);
    expectNear(leftZ + 5.25, 28.0, 0.5, 'left peak');
    expectNear(leftX, -153, 2.5);
    const [rightX, rightZ] = crest(right, 140, 175);
    expectNear(rightZ + 5.25, 33.0, 0.6, 'right peak');
    expectNear(rightX, 148, 1.5);
    expectNear(wireZAt(left, -120) + 5.25, 0, 1e-6, 'left trough');
  });

  it('puts the tine tips 95, 57 and 76 mm above their rails', () => {
    // Rows A, B, A' and B' stand in the left trough (the tip of the nearest hairpin of row A'
    // is 57.5 mm above the floor-wire tops in IMG_9131; the estimate was 45). The rail of row
    // C lies on the ramp of the floor at x = +60, 33.4 - 36.3 x 70 / 148.4 = 16.3 mm above the
    // left trough, 1.75 mm above the wires it lies on.
    const onRamp = 33.4 - (36.3 * 70) / 148.4;
    const height: Record<string, number> = {
      a: 95,
      b: 95,
      a2: 57,
      b2: 57,
      // 76 mm above the rail: 94.0 mm above the floor, where IMG_9131 has the tips at 93.5.
      c_rear: 76 + 1.75 + onRamp,
      c_front: 76 + 1.75 + onRamp,
    };
    for (const row of upper.tineRows) {
      row.tinePositions.forEach((_, i) => {
        const parts = upperWires.parts.filter(
          (p) =>
            p.id === `row.${row.id}.tine.${i}` ||
            p.id.startsWith(`row.${row.id}.tine.${i}.`) ||
            p.id === `row.${row.id}.tip.${i}`,
        );
        expectNear(topOf(parts), must(height[row.id]), 0.5, `${row.id} tine ${i}`);
      });
    }
  });

  it('leans row C 11 degrees towards the right wall and folds it flat towards the centre', () => {
    const [a, b] = ends(must(upperWires.parts.find((p) => p.id === 'row.c_rear.tine.2')));
    expectNear((Math.atan2(b[0] - a[0], b[2] - a[2]) * 180) / Math.PI, 11, 1e-6, 'lean');
    const config: MachineConfig = {
      ...B.defaultConfig,
      foldedTineRows: [{ basketId: 'upper', rowId: 'c_rear' }],
    };
    const folded = buildBasketWires(B, upper, config);
    const [fa, fb] = ends(must(folded.parts.find((p) => p.id === 'row.c_rear.tine.2')));
    expectNear(fb[2], fa[2], 1e-6, 'flat');
    // The tine is 76 mm high at 11 degrees (IMG_9131; it was 88): 77.4 mm long, less the
    // 1.75 mm of its rounded tip.
    expectNear(fa[0] - fb[0], 76 / Math.cos((11 * Math.PI) / 180) - 1.75, 1e-6, 'its length');
    // The front half stays up.
    expect(folded.parts.find((p) => p.id === 'row.c_front.tine.2')).toEqual(
      upperWires.parts.find((p) => p.id === 'row.c_front.tine.2'),
    );
  });

  it('has a lower front wall and high side walls joined by a sloping rim, and a lower rail across the front', () => {
    const rim = partsWith(upperWires, 'rim.');
    const zs = rim.flatMap((p) => ends(p).map((e) => e[2]));
    // The upper rail of the front wall, which is the rim there, 91 mm above the floor (94.5 mm
    // above the tops of the left-right floor wires in IMG_9131; the dossier's front wall of
    // 55 mm was the lower rail); sides and back about 120 mm (dossier 2.5).
    expectNear(Math.min(...zs), 91, 1e-6);
    expectNear(Math.max(...zs), 120, 1e-6);
    // The rim is the 5.1 mm wire of the rails (IMG_9131).
    for (const part of rim) {
      if (part.prim.kind === 'capsule') expectNear(part.prim.radius * 1000, 2.55, 1e-9);
    }
    // The lower rail: one wire along the front wall at 38.5 mm, on the front wall only.
    const lower = partsWith(upperWires, 'wall.0.');
    expect(lower.length).toBeGreaterThan(0);
    for (const e of lower.flatMap((p) => ends(p))) expectNear(e[2], 38.5, 1e-6, 'lower rail');
    const ys = lower.flatMap((p) => ends(p).map((e) => e[1]));
    // It follows the front of the rim: at the front line, and round the set-back middle.
    expect(Math.min(...ys)).toBeLessThan(3);
    expect(Math.max(...ys)).toBeLessThan(45);
  });
});

describe('Bosch basket fittings', () => {
  const plastic = 'polypropylene';

  it('has 8 wheels of 35 mm standing on the ledges of the tub', () => {
    const fittings = must(buildBasketFittings(B, lower, B.defaultConfig, plastic));
    const wheels = partsWith(fittings, 'wheel.');
    expect(wheels).toHaveLength(8);
    for (const wheel of wheels) {
      const box = boundingBox({ parts: [wheel], regions: [] });
      expectNear(mm(box.max[2] - box.min[2]), 35, 1e-6, 'diameter');
      expectNear(mm(box.max[1] - box.min[1]), 35, 1e-6, 'diameter');
      // Axles level with the floor cross wires at 71 mm: the wheels stand on z = 53.5 mm.
      expectNear(
        mm(box.min[2]) + LOWER_ORIGIN[2],
        mm(must(B.tub.wheelLedgeZ)),
        1e-6,
        'on the ledge',
      );
    }
    // Wheel mid-planes 534 mm apart (dossier 2.3).
    const xs = wheels.map((w) => mm(w.pose.p[0]));
    expectNear(Math.max(...xs) - Math.min(...xs), 534, 1e-6, 'track');
  });

  it('hangs the cup shelves up against the right wall by default and lowers them on request', () => {
    const up = must(buildBasketFittings(B, upper, B.defaultConfig, plastic));
    const shelfUp = boundingBox({ parts: partsWith(up, 'shelf.cup_front'), regions: [] });
    expectNear(mm(shelfUp.max[2] - shelfUp.min[2]), 100, 1e-6, 'its width stands up');
    expectNear(mm(shelfUp.max[0] - shelfUp.min[0]), 18, 1e-6, 'its thickness');
    const config: MachineConfig = {
      ...B.defaultConfig,
      shelves: [{ basketId: 'upper', shelfId: 'cup_front', state: 'down' }],
    };
    const down = must(buildBasketFittings(B, upper, config, plastic));
    const shelfDown = boundingBox({ parts: partsWith(down, 'shelf.cup_front'), regions: [] });
    // 200 x 100 x 18 mm [P16]. Its underside 75.5 mm above the floor, at the pins the folded
    // shelf is seen to turn about in IMG_9131, and its top 18 mm above that (it was a generic
    // 75 mm for the top).
    expectNear(mm(shelfDown.min[2]), 75.5, 1e-6, 'underside');
    expectNear(mm(shelfDown.max[2]), 93.5, 1e-6, 'surface height');
    // Folded up it stands 27 mm inside the wall with 27 mm of its width below those pins.
    expectNear(mm(shelfUp.min[2]), 75.5 - 27, 1e-6, 'lower edge, folded');
    expectNear(mm(shelfDown.max[0] - shelfUp.min[0]), 27, 1e-6, 'pins from the wall-side edge');
    expectNear(mm(shelfDown.max[0] - shelfDown.min[0]), 100, 1e-6, 'width');
    expectNear(mm(shelfDown.max[1] - shelfDown.min[1]), 200, 1e-6, 'length');
    // The other shelf is still up.
    expect(partsWith(down, 'shelf.cup_rear')).toEqual(partsWith(up, 'shelf.cup_rear'));
    // Lattice parts carry an open fraction for the water model.
    expect(must(partsWith(down, 'shelf.cup_front')[0]).porosity).toBeGreaterThan(0);
  });

  it('builds the tablet tray as an open trough 215 x 52 x 47 mm with its rim 55 mm above the floor', () => {
    const tray = must(buildTabletTray(upper, plastic));
    const box = boundingBox(tray);
    expectNear(mm(box.max[0] - box.min[0]), 215, 1e-6);
    expectNear(mm(box.max[1] - box.min[1]), 52, 1e-6);
    expectNear(mm(box.max[2] - box.min[2]), 47, 1e-6);
    expectNear(mm(box.max[2]), 55, 1e-6);
    // Slotted floor: porous; walls: solid.
    expect(must(tray.parts.find((p) => p.id === 'floor')).porosity).toBeGreaterThan(0);
    expect(
      tray.parts.filter((p) => p.id.startsWith('wall.')).every((p) => p.porosity === undefined),
    ).toBe(true);
    expect(buildTabletTray(lower, plastic)).toBeNull();
  });
});
