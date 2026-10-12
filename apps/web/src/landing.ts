/**
 * What the page can say about the place a piece would be let go at, before it is let go, from
 * what it already has for nothing: the pose the game's free preview lowered the piece to, and
 * the geometry of the basket it is sent to draw the machine (the inside of the basket, the
 * tops of its rim, the cutlery basket standing in it, the lowered cup shelves).
 *
 * It is not a prediction of the physics: it says where the piece is let go (on the floor of
 * the basket; above it, on tine tips or on another piece; on the rim; on the cutlery basket),
 * and that a piece let go on the rim or outside it does not end in the basket.
 *
 * Also the search for the place under the cursor: of the heights tried along the cursor's ray,
 * which one to take. Pure functions; millimetres, in the frame of the basket.
 */

/** A box, millimetres. */
export interface BoxMm {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

/** A basket as the page knows it for judging a landing. */
export interface BasketPlan {
  /** The clear inside of the basket: plan inside its rim wires, floor at `min[2]`. */
  readonly interior: BoxMm;
  /** Height of the top of the rim by side: left and right are low and high x, front and rear low and high y. */
  readonly rimTop: {
    readonly front: number;
    readonly rear: number;
    readonly left: number;
    readonly right: number;
  };
  /** The cutlery basket where it stands in this basket, with the height of the rim of its cells; null when it does not. */
  readonly cutlery: { readonly box: BoxMm; readonly rimZ: number } | null;
  /** Surfaces things properly stand on above the floor (lowered cup shelves): plan and height. */
  readonly shelves: readonly {
    readonly x: readonly [number, number];
    readonly y: readonly [number, number];
    readonly z: number;
  }[];
}

/** A piece where it would be let go. */
export interface LetGo {
  /** Its reference point in plan. */
  readonly x: number;
  readonly y: number;
  /** Its lowest point. */
  readonly bottomZ: number;
  /** How far it reaches from the reference point along x and along y. */
  readonly reachX: number;
  readonly reachY: number;
}

/**
 * Where a piece would be let go:
 *  - `seated`: on the floor of the basket, or on a lowered shelf;
 *  - `perched`: above the floor, on tine tips or on another piece (it may stay; it may tip);
 *  - `on_cutlery_basket`: on top of the cells of the cutlery basket;
 *  - `on_handle`, `on_rim`, `outside`: on the carrying handle of the cutlery basket, on the rim
 *    of the basket, or with its middle outside the basket. It does not end in the basket.
 *  - `above_cells`: a piece sent to the cutlery basket that would be let go with its lower end
 *    above the rim of the cells, on the carrying handle or on something that lies over the
 *    basket. It does not end in a cell ({@link judgeCellLanding}).
 */
export type LandingVerdict =
  'seated' | 'perched' | 'on_cutlery_basket' | 'on_handle' | 'on_rim' | 'outside' | 'above_cells';

/** A landing as judged. */
export interface Landing {
  readonly verdict: LandingVerdict;
  /** How far its lowest point is above the floor of the basket. */
  readonly above_floor_mm: number;
  /** True when it reaches over the cutlery basket in plan, at whatever height. */
  readonly over_cutlery: boolean;
}

/** Higher than this above the floor of the basket a piece stands on something. */
export const PERCHED_MM = 25;

/** A piece with its middle nearer the inner face of a side than this stands on the rim wire. */
export const RIM_MARGIN_MM = 10;

/** A piece let go within this of the height of the top of a side it reaches over stands on it. */
export const RIM_LEVEL_MM = 8;

/** A piece that reaches less than this from its middle balances on the handle of the cutlery basket and falls. */
export const SMALL_REACH_MM = 80;

/** True for a landing the page does not let go at: the piece would not end in the basket. */
export function refused(verdict: LandingVerdict): boolean {
  return (
    verdict === 'on_handle' ||
    verdict === 'on_rim' ||
    verdict === 'outside' ||
    verdict === 'above_cells'
  );
}

/**
 * Where a piece of cutlery sent to the cutlery basket would be let go, in the frame of that
 * basket: `cellRimZ` is the height of the rim of its cells, `floorZ` that of their floor,
 * `bottomZ` the lowest point of the piece at the pose the game's preview lowered it to. A
 * piece whose lower end is stopped above the rim of the cells has not entered a cell: it would
 * be let go on the carrying handle of the basket (its bar is 220 mm above the floor) or on
 * whatever lies over the basket (a plate fallen across it) and fall from there, out of the
 * basket or out of the machine. (Review of 11 October 2026: a fork and a knife let go 220 to
 * 240 mm above the cells, shown as "Free", ended on the kitchen floor.) Stopped anywhere down
 * in a cell, on its floor or on the pieces already in it, it is in the cell.
 */
export function judgeCellLanding(cellRimZ: number, floorZ: number, bottomZ: number): Landing {
  return {
    verdict: bottomZ > cellRimZ ? 'above_cells' : 'seated',
    above_floor_mm: bottomZ - floorZ,
    over_cutlery: true,
  };
}

/** Where a piece would be let go in a basket, and how far above its floor. */
export function judgeLanding(basket: BasketPlan, piece: LetGo): Landing {
  const { interior, rimTop } = basket;
  const above = piece.bottomZ - interior.min[2];
  const box = basket.cutlery?.box ?? null;
  const span = (axis: 0 | 1, at: number, reach: number): number =>
    box === null ? 0 : Math.min(at + reach, box.max[axis]) - Math.max(at - reach, box.min[axis]);
  const overCutlery =
    box !== null && span(0, piece.x, piece.reachX) > 4 && span(1, piece.y, piece.reachY) > 4;
  const done = (verdict: LandingVerdict): Landing => ({
    verdict,
    above_floor_mm: above,
    over_cutlery: overCutlery,
  });
  if (
    piece.x < interior.min[0] ||
    piece.x > interior.max[0] ||
    piece.y < interior.min[1] ||
    piece.y > interior.max[1]
  ) {
    return done('outside');
  }
  // On the rim. Either its middle is on the wire of a side (within `RIM_MARGIN_MM` of its
  // inner face) at the height of the top of that side or above: half of it hangs outside. Or
  // it reaches over a side and is let go at the very height of the top of that side (within
  // `RIM_LEVEL_MM`): it is the rim that stopped it, and it stands with one edge on the wire.
  // (Of nine such drops of a glass and a bowl in the lower basket, seven fell out or onto the
  // door.) A piece that reaches over a side but was stopped higher up rests on something else,
  // and one stopped lower is inside the basket; the game refuses what would cut the rim.
  const sides: readonly [number, number, number][] = [
    [piece.x - interior.min[0], piece.reachX, rimTop.left],
    [interior.max[0] - piece.x, piece.reachX, rimTop.right],
    [piece.y - interior.min[1], piece.reachY, rimTop.front],
    [interior.max[1] - piece.y, piece.reachY, rimTop.rear],
  ];
  if (
    sides.some(
      ([inside, reach, top]) =>
        (inside < RIM_MARGIN_MM && piece.bottomZ >= top - RIM_LEVEL_MM) ||
        (inside < reach && Math.abs(piece.bottomZ - top) <= RIM_LEVEL_MM),
    )
  ) {
    return done('on_rim');
  }
  const level = RIM_LEVEL_MM;
  const cutlery = basket.cutlery;
  if (cutlery !== null && overCutlery && piece.bottomZ >= cutlery.rimZ - level) {
    // On the carrying handle a small piece balances on a bar and falls; a large one (a board,
    // a plate lying flat) bridges from the handle to the tines and stays, badly.
    const small = Math.max(piece.reachX, piece.reachY) < SMALL_REACH_MM;
    return done(
      small && piece.bottomZ >= cutlery.box.max[2] - level ? 'on_handle' : 'on_cutlery_basket',
    );
  }
  if (above <= PERCHED_MM) return done('seated');
  const shelf = basket.shelves.find(
    (s) =>
      piece.x >= s.x[0] &&
      piece.x <= s.x[1] &&
      piece.y >= s.y[0] &&
      piece.y <= s.y[1] &&
      Math.abs(piece.bottomZ - s.z) <= 8,
  );
  return done(shelf !== undefined ? 'seated' : 'perched');
}

/** One height tried along the cursor's ray since the cursor last moved. */
export interface AimTry {
  /** The height aimed at. */
  readonly aim: number;
  /** How far the piece, let go there, is from the line of sight through the cursor. */
  readonly miss: number;
  /** True when it would not end in the basket there. */
  readonly refused: boolean;
}

/** The piece counts as under the cursor within this distance of the line of sight. */
export const AIM_AGREES_MM = 2.5;

/**
 * Of the heights tried, the one to take when none puts the piece exactly under the cursor
 * (over a comb of tines the landing height jumps, and at the edge of a basket the line of sight
 * leaves it): one where the piece ends in the basket before one where it does not, then the
 * nearest to the cursor, then the lowest. Null when nothing was tried.
 */
export function bestTry(tries: readonly AimTry[]): AimTry | null {
  let best: AimTry | null = null;
  for (const t of tries) {
    if (
      best === null ||
      (best.refused && !t.refused) ||
      (best.refused === t.refused &&
        (t.miss < best.miss - 0.5 || (Math.abs(t.miss - best.miss) <= 0.5 && t.aim < best.aim)))
    ) {
      best = t;
    }
  }
  return best;
}

/** What the page says of a landing that is not simply on the floor; null for one that is. */
export function landingWords(verdict: LandingVerdict, aboveFloorMm: number): string | null {
  const up = Math.round(aboveFloorMm);
  switch (verdict) {
    case 'seated':
      return null;
    case 'perched':
      return `Free, but it would be let go ${up} mm above the floor of the basket, on tine tips or on another piece: it may tip or slide from there.`;
    case 'on_cutlery_basket':
      return 'Free, but it would be let go on top of the cutlery basket, not on the floor of the basket: it may slide off.';
    case 'on_handle':
      return 'It would be let go on the handle of the cutlery basket and fall from there: not put down. Point at the floor of the basket.';
    case 'on_rim':
      return 'It would be let go on the rim of the basket and fall out: not put down. Point further inside.';
    case 'outside':
      return 'Its middle would be outside the basket and it would fall out: not put down. Point further inside.';
    case 'above_cells':
      return `It would be let go ${up} mm above the floor of the cutlery basket, on its handle or on something that lies over it, and fall from there: not put down. Point at a cell that is open from above.`;
  }
}
