import { describe, expect, it } from 'vitest';
import type { BasketPlan, LetGo } from './landing.ts';
import { bestTry, judgeCellLanding, judgeLanding, landingWords, refused } from './landing.ts';

/** A basket like the lower one: 500 x 480 inside, rim 160 high, the cutlery basket in the middle. */
const basket: BasketPlan = {
  interior: { min: [12, 12, 0], max: [512, 492, 250] },
  rimTop: { front: 150, rear: 165, left: 160, right: 160 },
  cutlery: { box: { min: [196, 30, 0], max: [345, 270, 265] }, rimZ: 130 },
  shelves: [{ x: [350, 500], y: [300, 480], z: 90 }],
};

const glass = (x: number, y: number, bottomZ: number): LetGo => ({
  x,
  y,
  bottomZ,
  reachX: 38,
  reachY: 38,
});

describe('where a piece would be let go', () => {
  it('on the floor of the basket it is seated', () => {
    expect(judgeLanding(basket, glass(100, 300, 1)).verdict).toBe('seated');
    expect(judgeLanding(basket, glass(60, 300, 24)).verdict).toBe('seated');
  });

  it('above the floor it is perched, and the height is said', () => {
    const judged = judgeLanding(basket, glass(100, 300, 77));
    expect(judged.verdict).toBe('perched');
    expect(judged.above_floor_mm).toBe(77);
    expect(landingWords(judged.verdict, judged.above_floor_mm)).toContain('77 mm');
    expect(refused(judged.verdict)).toBe(false);
  });

  it('on a lowered shelf it is seated', () => {
    expect(judgeLanding(basket, glass(420, 400, 92)).verdict).toBe('seated');
    expect(judgeLanding(basket, glass(420, 400, 120)).verdict).toBe('perched');
  });

  it('at the height of the rim with its middle on the wire of a side it is on the rim, and that is refused', () => {
    // The middle of the glass is on the wire of the right-hand side (7 mm inside its face).
    expect(judgeLanding(basket, glass(505, 160, 163)).verdict).toBe('on_rim');
    expect(judgeLanding(basket, glass(100, 18, 150)).verdict).toBe('on_rim');
    expect(refused('on_rim')).toBe(true);
    // Reaching over a side and stopped at the very height of its top, it stands with an edge
    // on the wire (the reviewer's drops at z 208 to 218: a glass 45 mm tall to its middle).
    expect(judgeLanding(basket, glass(480, 160, 163)).verdict).toBe('on_rim');
    expect(judgeLanding(basket, glass(45, 300, 157)).verdict).toBe('on_rim');
    // Stopped well above the rim, it rests on something else: a perch.
    expect(judgeLanding(basket, glass(480, 160, 190)).verdict).toBe('perched');
    // At the height of the rim in the middle of the basket it is a perch too.
    expect(judgeLanding(basket, glass(100, 300, 163)).verdict).toBe('perched');
    // Beside the rim but down inside the basket it is in the basket.
    expect(judgeLanding(basket, glass(505, 300, 1)).verdict).toBe('seated');
    // A plate lying flat on the tine tips of the upper basket reaches over its low front rim
    // with its middle well inside: perched, not lost.
    const upper: BasketPlan = {
      interior: { min: [4, 4, 0], max: [496, 494, 190] },
      rimTop: { front: 57, rear: 122, left: 122, right: 122 },
      cutlery: null,
      shelves: [],
    };
    const plate: LetGo = { x: 250, y: 125, bottomZ: 70, reachX: 135, reachY: 135 };
    expect(judgeLanding(upper, plate).verdict).toBe('perched');
  });

  it('with its middle outside the inside of the basket it is outside', () => {
    expect(judgeLanding(basket, glass(525, 100, 170)).verdict).toBe('outside');
    expect(judgeLanding(basket, glass(300, 0, 220)).verdict).toBe('outside');
    expect(refused('outside')).toBe(true);
  });

  it('over the cutlery basket: on its cells a warning, a small piece on its handle refused', () => {
    expect(judgeLanding(basket, glass(300, 150, 132)).verdict).toBe('on_cutlery_basket');
    expect(refused('on_cutlery_basket')).toBe(false);
    expect(judgeLanding(basket, glass(300, 120, 262)).verdict).toBe('on_handle');
    expect(refused('on_handle')).toBe(true);
    // A dinner plate lying flat bridges from the handle to the tines: a warning, not a refusal.
    const plate: LetGo = { x: 131, y: 256, bottomZ: 262, reachX: 135, reachY: 135 };
    expect(judgeLanding(basket, plate).verdict).toBe('on_cutlery_basket');
    // Beside the cutlery basket on the floor it is seated.
    expect(judgeLanding(basket, glass(150, 150, 1)).verdict).toBe('seated');
  });

  it('every verdict but seated has words', () => {
    expect(landingWords('seated', 0)).toBeNull();
    for (const verdict of [
      'perched',
      'on_cutlery_basket',
      'on_handle',
      'on_rim',
      'outside',
    ] as const) {
      expect(landingWords(verdict, 50)).not.toBeNull();
    }
  });
});

describe('of the heights tried along the ray', () => {
  it('a place in the basket is taken before a nearer one on the rim', () => {
    const best = bestTry([
      { aim: 208, miss: 0.4, refused: true },
      { aim: 45, miss: 31, refused: false },
      { aim: 120, miss: 12, refused: false },
    ]);
    expect(best?.aim).toBe(120);
  });

  it('of equals the nearest, then the lowest', () => {
    expect(
      bestTry([
        { aim: 120, miss: 9, refused: false },
        { aim: 45, miss: 9.2, refused: false },
      ])?.aim,
    ).toBe(45);
    expect(
      bestTry([
        { aim: 208, miss: 3, refused: true },
        { aim: 150, miss: 20, refused: true },
      ])?.aim,
    ).toBe(208);
    expect(bestTry([])).toBeNull();
  });
});

describe('where a piece of cutlery would be let go over the cutlery basket', () => {
  // The cells of the basket: floor at 2 mm, rim at 120 mm, in the frame of the basket.
  it('is in a cell when its lower end is stopped anywhere down in one', () => {
    expect(judgeCellLanding(120, 2, 4).verdict).toBe('seated');
    // On the pieces already in the cell.
    expect(judgeCellLanding(120, 2, 85).verdict).toBe('seated');
    expect(refused(judgeCellLanding(120, 2, 120).verdict)).toBe(false);
  });

  it('is not put down when it is stopped above the rim of the cells, on the handle or on what lies over the basket', () => {
    // The reviewer's fork: let go 230 mm up (the bar of the carrying handle is 220 mm up).
    const judged = judgeCellLanding(120, 2, 232);
    expect(judged.verdict).toBe('above_cells');
    expect(judged.above_floor_mm).toBe(230);
    expect(refused(judged.verdict)).toBe(true);
    const words = landingWords(judged.verdict, judged.above_floor_mm);
    expect(words).toContain('230 mm above the floor of the cutlery basket');
    expect(words).toContain('not put down');
  });
});
