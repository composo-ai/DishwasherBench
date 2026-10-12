/**
 * Where the loose cutlery basket can stand in a basket of the machine.
 *
 * The cutlery basket is not fixed: it is stood on the base grid of a basket wherever the tine
 * rows let it. Over a row it stands astride: the rail and the tines pass through one of its
 * tunnels, which cross its width and are open below and at both ends. So along a pair of rows
 * whose rails are as far apart as its tunnels it can be slid anywhere from wall to wall, and
 * elsewhere it stands only where no rail and no tine is under its feet. These functions decide
 * that from the specification, with the same tine lines the shapes are built from.
 *
 * Rack frame of the basket it stands in, metres.
 */

import { cutleryFeet } from './geometry/cutlery.ts';
import { TINE_BALL_RATIO } from './geometry/assumptions.ts';
import { insideRim, rimLoop } from './geometry/rim.ts';
import { tineLine } from './geometry/tines.ts';
import type { MachineProblem } from './problems.ts';
import { problem } from './problems.ts';
import type {
  BasketSpec,
  CutleryBasketPlacement,
  CutleryBasketSpec,
  MachineConfig,
  Range,
} from './types.ts';

/** Slack allowed where a rail or a tine just touches the side of a tunnel, metres. */
const FIT_SLACK = 0.0005;
/** Spacing of the points a tine is tested at, metres. */
const TINE_SAMPLE = 0.002;
/** Two placements whose centres are closer than this are the same placement, metres. */
export const SAME_PLACEMENT = 0.0005;

/** What a cutlery basket covers in plan where a placement stands it. Rack frame, metres. */
export interface CutleryBasketFootprint {
  /** Its body with the lid grids where they hang outside its long walls. */
  readonly x: Range;
  readonly y: Range;
  /** Its body alone: what stands on the base grid. */
  readonly body: { readonly x: Range; readonly y: Range };
}

/** Half the width a cutlery basket takes across its long side, lids included when they hang out. */
function halfWidthOverLids(cutlery: CutleryBasketSpec): number {
  const hanging = cutlery.lid !== null && !cutlery.lid.inUse;
  return (hanging ? Math.max(cutlery.widthOverLids, cutlery.size[1]) : cutlery.size[1]) / 2;
}

/** The plan rectangles a cutlery basket covers at a placement. */
export function cutleryBasketFootprint(
  cutlery: CutleryBasketSpec,
  placement: CutleryBasketPlacement,
): CutleryBasketFootprint {
  const along = cutlery.size[0] / 2;
  const across = cutlery.size[1] / 2;
  const overLids = halfWidthOverLids(cutlery);
  const [cx, cy] = placement.centre;
  const lengthwise = placement.longAxis === 'x';
  const bodyX: Range = lengthwise ? [cx - along, cx + along] : [cx - across, cx + across];
  const bodyY: Range = lengthwise ? [cy - across, cy + across] : [cy - along, cy + along];
  return {
    x: lengthwise ? bodyX : [cx - overLids, cx + overLids],
    y: lengthwise ? [cy - overLids, cy + overLids] : bodyY,
    body: { x: bodyX, y: bodyY },
  };
}

/**
 * The tunnels of a cutlery basket at a placement, as stretches of the rack-frame coordinate
 * along its long side (`placement.longAxis`): `[from, to]` between the inner faces of each
 * tunnel. Empty for a flat-based basket.
 */
export function cutleryTunnelStretches(
  cutlery: CutleryBasketSpec,
  placement: CutleryBasketPlacement,
): Range[] {
  const feet = cutleryFeet(cutlery);
  const centre = placement.longAxis === 'x' ? placement.centre[0] : placement.centre[1];
  const start = centre - cutlery.size[0] / 2;
  const stretches: Range[] = [];
  for (let j = 0; j + 1 < feet.length; j++) {
    const a = (feet[j] as [number, number])[1];
    const b = (feet[j + 1] as [number, number])[0];
    // The cutlery frame's +y runs along +y of the rack for a basket standing lengthwise front
    // to back, and along +x for one turned a quarter turn (see `cutleryBasketPoseInRack`).
    stretches.push([start + a, start + b]);
  }
  return stretches;
}

/**
 * Why the cutlery basket cannot stand at a placement in a basket, as problems; an empty list
 * when it can. It must stand inside the basket's rim (`config_cutlery_basket_outside`), and no
 * rail or tine of the basket's rows may be under its feet or in its walls: each must pass
 * through a tunnel or miss it altogether (`config_cutlery_basket_on_tines`). A folded row counts
 * with its tines lying down. The lid grids that hang outside its long walls do not count: they
 * hang on hinges, and a tine that comes out of a tunnel beside one pushes it aside.
 */
export function cutleryBasketPlacementProblems(
  basket: BasketSpec,
  cutlery: CutleryBasketSpec,
  config: Pick<MachineConfig, 'foldedTineRows'>,
  placement: CutleryBasketPlacement,
): MachineProblem[] {
  const problems: MachineProblem[] = [];
  const footprint = cutleryBasketFootprint(cutlery, placement);
  const mmOf = (v: number): string => (v * 1000).toFixed(0);
  const where = `(${mmOf(placement.centre[0])}, ${mmOf(placement.centre[1])}) mm`;

  // Inside the rim, with the rim wire's own thickness to spare.
  const loop = rimLoop(basket);
  const r = basket.wires.rim.coated / 2;
  const [x0, x1] = [footprint.x[0] - r, footprint.x[1] + r];
  const [y0, y1] = [footprint.y[0] - r, footprint.y[1] + r];
  const xm = (x0 + x1) / 2;
  const ym = (y0 + y1) / 2;
  const outline: [number, number][] = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
    [xm, y0],
    [xm, y1],
    [x0, ym],
    [x1, ym],
  ];
  if (outline.some(([x, y]) => !insideRim(loop, x, y))) {
    const [width, depth] = basket.outline.size;
    problems.push(
      problem(
        'config_cutlery_basket_outside',
        'cutleryBasket',
        `the cutlery basket at ${where} does not fit inside basket "${basket.id}" (${mmOf(width)} x ${mmOf(depth)} mm)`,
      ),
    );
    return problems;
  }

  // Rails and tines: through a tunnel, or clear of the basket.
  const tunnels = cutleryTunnelStretches(cutlery, placement);
  const tunnelHeight = cutlery.tunnels?.height ?? 0;
  const bodyHeight = cutlery.size[2];
  const long: 0 | 1 = placement.longAxis === 'x' ? 0 : 1;
  const railRadius = basket.wires.floor.coated / 2;
  const inTunnel = (at: number, radius: number, top: number): boolean =>
    top <= tunnelHeight + FIT_SLACK &&
    tunnels.some(([a, b]) => at - radius >= a - FIT_SLACK && at + radius <= b + FIT_SLACK);
  const inBody = (x: number, y: number, radius: number): boolean =>
    x + radius > footprint.body.x[0] &&
    x - radius < footprint.body.x[1] &&
    y + radius > footprint.body.y[0] &&
    y - radius < footprint.body.y[1];
  for (const row of basket.tineRows) {
    const folded =
      row.hinge !== null &&
      config.foldedTineRows.some((ref) => ref.basketId === basket.id && ref.rowId === row.id);
    let reason: string | null = null;
    // The rail.
    const runs: 0 | 1 = row.runs === 'x' ? 0 : 1;
    const railLow: [number, number] = [0, 0];
    const railHigh: [number, number] = [0, 0];
    railLow[runs] = row.railSpan[0];
    railHigh[runs] = row.railSpan[1];
    railLow[1 - runs] = row.railAt - railRadius;
    railHigh[1 - runs] = row.railAt + railRadius;
    const railUnder =
      railHigh[0] > footprint.body.x[0] &&
      railLow[0] < footprint.body.x[1] &&
      railHigh[1] > footprint.body.y[0] &&
      railLow[1] < footprint.body.y[1];
    if (railUnder) {
      if (runs === long) reason = 'its rail runs lengthwise under the cutlery basket';
      else if (!inTunnel(row.railAt, railRadius, row.railZ + railRadius)) {
        reason = 'its rail is under a foot of the cutlery basket, not in a tunnel';
      }
    }
    // The tines.
    const wire = row.wireDiameter / 2;
    const tip = row.tip === 'ball' ? wire * TINE_BALL_RATIO : wire;
    for (let i = 0; i < row.tinePositions.length && reason === null; i++) {
      const tine = tineLine(row, i, folded);
      const reach = Math.max(tine.length - tip, 0);
      const steps = Math.max(1, Math.ceil(reach / TINE_SAMPLE));
      for (let k = 0; k <= steps && reason === null; k++) {
        const s = (reach * k) / steps;
        const radius = k === steps ? tip : wire;
        const x = tine.base[0] + tine.direction[0] * s;
        const y = tine.base[1] + tine.direction[1] * s;
        const z = tine.base[2] + tine.direction[2] * s;
        if (z - radius < bodyHeight && inBody(x, y, radius)) {
          const at = long === 1 ? y : x;
          if (!inTunnel(at, radius, z + radius)) {
            reason = `tine ${i} stands in the cutlery basket outside its tunnels`;
          }
        }
      }
    }
    if (reason !== null) {
      problems.push(
        problem(
          'config_cutlery_basket_on_tines',
          'cutleryBasket',
          `the cutlery basket cannot stand at ${where} in basket "${basket.id}": of tine row "${row.id}" ${reason}`,
        ),
      );
    }
  }
  return problems;
}
