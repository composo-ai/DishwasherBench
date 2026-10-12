import { describe, expect, it } from 'vitest';
import { getBasket } from './config.ts';
import { BOSCH_SMV4HAX40G, SPOT_60 } from './machines.ts';
import {
  basketRimInset,
  basketRimPath,
  basketSideRecess,
  basketSideRecessOver,
  directionVector,
  polygonArea,
} from './outline.ts';
import { expectNear, expectWithin, must, toMm } from './test-util.ts';

const lower = getBasket(BOSCH_SMV4HAX40G, 'lower');
const upper = getBasket(BOSCH_SMV4HAX40G, 'upper');

describe('the rim path of a basket', () => {
  it('a plain basket is the rectangle of its rim centre lines', () => {
    const rack = getBasket(SPOT_60, 'lower');
    const path = basketRimPath(rack);
    // 525 x 495 mm outside, 5.8 mm rim wire: centre lines 2.9 mm in.
    expect(basketRimInset(rack).map((v) => Math.round(toMm(v) * 1e6) / 1e6)).toEqual([2.9, 2.9]);
    expect(
      path.map(([x, y]) => [Math.round(toMm(x) * 1e6) / 1e6, Math.round(toMm(y) * 1e6) / 1e6]),
    ).toEqual([
      [2.9, 2.9],
      [522.1, 2.9],
      [522.1, 492.1],
      [2.9, 492.1],
    ]);
    expectWithin(polygonArea(path), 0.5192 * 0.4892, 1e-12);
  });

  it('the Bosch lower basket has chamfered front corners and a rear recess for the riser', () => {
    const path = basketRimPath(lower, 4);
    const mm = path.map(([x, y]) => [toMm(x), toMm(y)] as const);
    // Rim centre lines 3 mm and 2.5 mm inside the 525 x 512 mm outline: x 3 to 522, y 2.5 to 509.5.
    // Walked counter-clockwise from the front-left corner: the left side ends 59 mm from the
    // front, and the outline joins the front edge 41 mm from the side.
    expectNear(must(mm[0])[0], 3, 1e-9);
    expectNear(must(mm[0])[1], 2.5 + 59, 1e-9);
    expectNear(must(mm[1])[0], 3 + 41, 1e-9);
    expectNear(must(mm[1])[1], 2.5, 1e-9);
    expectNear(must(mm[2])[0], 522 - 41, 1e-9);
    expectNear(must(mm[2])[1], 2.5, 1e-9);
    expectNear(must(mm[3])[0], 522, 1e-9);
    expectNear(must(mm[3])[1], 2.5 + 59, 1e-9);
    // The rear recess: 60 mm wide about the centre line (x = 262.5), 6 mm deep, 10 mm ramps.
    const recess = mm.filter(([, y]) => Math.abs(y - (509.5 - 6)) < 1e-9);
    expect(recess.map(([x]) => Math.round(x * 1e6) / 1e6)).toEqual([292.5, 232.5]);
    // Counter-clockwise, and the area is the rectangle less the two chamfers, the recess and the
    // two rounded rear corners: 519 x 507 - 2 (41 x 59 / 2) - (60 + 10) x 6 - 2 x 25^2 (1 - pi/4).
    const exact = 519 * 507 - 41 * 59 - 70 * 6 - 2 * 625 * (1 - Math.PI / 4);
    const fine = polygonArea(basketRimPath(lower, 64)) * 1e6;
    expect(fine).toBeGreaterThan(0);
    expectNear(fine, exact, 0.5);
    // Four chords per rounded corner cut a little more off than the true arc: a quarter disc
    // of radius 25 mm is 490.87 mm2, its four-chord polygon 4 x (25^2 / 2) sin(22.5 deg).
    const chordLoss = (Math.PI * 625) / 4 - 4 * (625 / 2) * Math.sin(Math.PI / 8);
    expectNear(polygonArea(path) * 1e6, exact - 2 * chordLoss, 1e-6);
  });

  it('stays inside the outer plan rectangle', () => {
    for (const basket of [...BOSCH_SMV4HAX40G.baskets, ...SPOT_60.baskets]) {
      for (const [x, y] of basketRimPath(basket)) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(basket.outline.size[0]);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(basket.outline.size[1]);
      }
      expect(polygonArea(basketRimPath(basket))).toBeGreaterThan(0);
    }
  });

  it('the Bosch upper basket has its front wall set back in the middle for the tray', () => {
    const recess = must(upper.outline.recesses[0]);
    expect(recess.side).toBe('front');
    const tray = must(upper.tabletTray);
    // The set-back stretch lies behind the tray, which is wider than it.
    expect(recess.span[0]).toBeGreaterThan(tray.centre[0] - tray.size[0] / 2);
    expect(recess.span[1]).toBeLessThan(tray.centre[0] + tray.size[0] / 2);
    // The tray is centred 2 mm right of the arm axis (IMG_9131); the set-back stretch, read
    // from O83 (+-15 mm), 6 mm right of it.
    expectNear((recess.span[0] + recess.span[1]) / 2, tray.centre[0], 0.004 + 1e-12);
    const path = basketRimPath(upper);
    // Among the points of the front half of the rim (the rear wall has a recess of its own).
    const deepest = Math.max(
      ...path
        .filter(([x, y]) => Math.abs(x - tray.centre[0]) < 0.08 && y < upper.outline.size[1] / 2)
        .map(([, y]) => y),
    );
    // Half the 5.1 mm rim wire (IMG_9131; it was 3.5) and the 40 mm of the set-back.
    expectNear(toMm(deepest), 2.55 + 40, 1e-9);
  });
});

describe('the recess of a side', () => {
  it('is full over the span, ramps to nothing, and is zero elsewhere', () => {
    // Rear recess of the lower basket: x = 232.5 to 292.5 mm in the rack frame.
    expectNear(basketSideRecess(lower, 'rear', 0.2625), 0.006, 1e-12);
    expectNear(basketSideRecess(lower, 'rear', 0.2325), 0.006, 1e-12);
    expectNear(basketSideRecess(lower, 'rear', 0.2275), 0.003, 1e-12);
    expectNear(basketSideRecess(lower, 'rear', 0.2975), 0.003, 1e-12);
    expect(basketSideRecess(lower, 'rear', 0.2225)).toBe(0);
    expect(basketSideRecess(lower, 'rear', 0.1)).toBe(0);
    expect(basketSideRecess(lower, 'front', 0.2625)).toBe(0);
    expect(basketSideRecess(lower, 'left', 0.2625)).toBe(0);
  });

  it('over a stretch is what the whole stretch clears', () => {
    // The 60 mm riser fits the recess exactly; a 70 mm one reaches the ramps; an 80 mm one the rim.
    expectNear(basketSideRecessOver(lower, 'rear', [0.2325, 0.2925]), 0.006, 1e-12);
    expectNear(basketSideRecessOver(lower, 'rear', [0.2275, 0.2975]), 0.003, 1e-12);
    expect(basketSideRecessOver(lower, 'rear', [0.2225, 0.3025])).toBe(0);
    expect(basketSideRecessOver(lower, 'rear', [0.0, 0.5])).toBe(0);
  });
});

describe('direction names', () => {
  it('are unit vectors along the axes', () => {
    expect(directionVector('+x')).toEqual([1, 0]);
    expect(directionVector('-x')).toEqual([-1, 0]);
    expect(directionVector('+y')).toEqual([0, 1]);
    expect(directionVector('-y')).toEqual([0, -1]);
  });
});
