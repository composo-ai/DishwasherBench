// Static geometry: lower rack (wire grid + tines + frame), tilted cup shelf, cutlery basket.
// Wires are capsules {type:'capsule', a, b, r}; basket walls are boxes {type:'box', c, h, q}.
import { add, qAxisAngle, qRot } from './math.mjs';

export const RACK = {
  half: 0.25, // footprint 0.50 x 0.50 m
  wireR: 0.002, // 4 mm coated steel wire
  frameR: 0.003,
  zWirePitch: 0.032, // wires running front-back (along Z), top layer, centre y = 0
  xWirePitch: 0.04, // wires running left-right (along X), lower layer, centre y = -0.004; carry the tines
  tinePitch: 0.032, // spacing along a row (X)
  rowPitch: 0.04, // rows 40 mm apart (Z)
  tineTip: 0.065, // top of tine above wire-plane origin (tine height ~63 mm above the base-wire tops)
  baseTop: 0.002, // top surface of the upper base wires
};

const cap = (a, b, r, tag) => ({ type: 'capsule', a, b, r, tag });

/**
 * @param opts.tines     include tines (default true)
 * @param opts.tineLean  lean of tines from vertical towards +Z, radians (default 0)
 * @param opts.tineFilter optional (x, z) => boolean to keep only some tines
 * @param opts.origin    translation applied to everything
 */
export function makeRack(opts = {}) {
  const { tines = true, tineLean = 0, tineFilter = null, origin = [0, 0, 0], segments = 1 } = opts;
  const R = RACK;
  const out = [];
  // A long wire may be split into `segments` collinear capsules (same union shape, more primitives).
  const wire = (a, b, r, tag) => {
    for (let i = 0; i < segments; i++) {
      const f0 = i / segments;
      const f1 = (i + 1) / segments;
      const lerp = (f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
      out.push(cap(lerp(f0), lerp(f1), r, tag));
    }
  };
  // Top layer: Z-running wires at x = +-0.016, +-0.048, ...
  for (let i = 0; i < 16; i++) {
    const x = (i - 7.5) * R.zWirePitch;
    wire([x, 0, -R.half], [x, 0, R.half], R.wireR, 'base-z');
  }
  // Lower layer: X-running wires at z = -0.24 .. 0.24, one per tine row.
  const rows = [];
  for (let k = 0; k < 13; k++) rows.push(-0.24 + k * R.rowPitch);
  for (const z of rows) wire([-R.half, -0.004, z], [R.half, -0.004, z], R.wireR, 'base-x');
  if (tines) {
    const tipY = R.tineTip - R.wireR;
    for (const z of rows) {
      for (let j = 0; j < 15; j++) {
        const x = -0.224 + j * R.tinePitch;
        if (tineFilter && !tineFilter(x, z)) continue;
        const h = tipY + 0.004;
        out.push(cap([x, -0.004, z], [x, -0.004 + h * Math.cos(tineLean), z + h * Math.sin(tineLean)], R.wireR, 'tine'));
      }
    }
  }
  // Perimeter frame: lower rail at the wire field edge, upper rail flared 20 mm outwards (so that a
  // plate leaning back in the last slot does not touch it), and four corner posts.
  for (const [y, H] of [[-0.004, R.half], [0.09, R.half + 0.02]]) {
    out.push(cap([-H, y, -H], [H, y, -H], R.frameR, 'frame'));
    out.push(cap([-H, y, H], [H, y, H], R.frameR, 'frame'));
    out.push(cap([-H, y, -H], [-H, y, H], R.frameR, 'frame'));
    out.push(cap([H, y, -H], [H, y, H], R.frameR, 'frame'));
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    out.push(cap([sx * R.half, -0.004, sz * R.half], [sx * (R.half + 0.02), 0.09, sz * (R.half + 0.02)], R.frameR, 'frame'));
  }
  return out.map((c) => ({ ...c, a: add(c.a, origin), b: add(c.b, origin) }));
}

export const SHELF = { tilt: (12 * Math.PI) / 180, origin: [0, 0.1, 0], wireR: 0.002 };
/** Tilted cup shelf: slope wires along local Z, cross wires below, a raised stop wire at the low end. */
export function makeCupShelf(tilt = SHELF.tilt, origin = SHELF.origin) {
  const q = qAxisAngle([1, 0, 0], tilt); // +Z_local points downhill
  const T = (p) => add(qRot(q, p), origin);
  const out = [];
  for (let i = 0; i < 10; i++) {
    const x = (i - 4.5) * 0.02;
    out.push(cap(T([x, 0, -0.1]), T([x, 0, 0.1]), SHELF.wireR, 'shelf-slope'));
  }
  for (const z of [-0.1, 0, 0.1]) out.push(cap(T([-0.1, -0.004, z]), T([0.1, -0.004, z]), SHELF.wireR, 'shelf-cross'));
  out.push(cap(T([-0.1, 0.006, 0.1]), T([0.1, 0.006, 0.1]), SHELF.wireR, 'shelf-stop'));
  return { statics: out, q, origin, normal: qRot(q, [0, 1, 0]), downhill: qRot(q, [0, 0, 1]) };
}

export const BASKET = { cell: 0.04, wall: 0.002, depth: 0.12, nx: 5, nz: 2, floorTop: 0.0 };
/** Cutlery basket: nx x nz cells of 40 x 40 x 120 mm, 2 mm static walls and floor. Floor top at y = 0. */
export function makeBasket(origin = [0, 0, 0]) {
  const { cell, wall, depth, nx, nz } = BASKET;
  const W = nx * cell + (nx + 1) * wall;
  const D = nz * cell + (nz + 1) * wall;
  const out = [];
  const bx = (c, h, tag) => out.push({ type: 'box', c: add(c, origin), h, q: [0, 0, 0, 1], tag });
  bx([0, -wall / 2, 0], [W / 2, wall / 2, D / 2], 'basket-floor');
  for (let i = 0; i <= nx; i++) {
    const x = -W / 2 + wall / 2 + i * (cell + wall);
    bx([x, depth / 2, 0], [wall / 2, depth / 2, D / 2], 'basket-wall');
  }
  for (let k = 0; k <= nz; k++) {
    const z = -D / 2 + wall / 2 + k * (cell + wall);
    bx([0, depth / 2, z], [W / 2, depth / 2, wall / 2], 'basket-wall');
  }
  const cells = [];
  for (let k = 0; k < nz; k++) {
    for (let i = 0; i < nx; i++) {
      cells.push({
        cx: origin[0] - W / 2 + wall + cell / 2 + i * (cell + wall),
        cz: origin[2] - D / 2 + wall + cell / 2 + k * (cell + wall),
        half: cell / 2,
      });
    }
  }
  return { statics: out, cells, rimY: origin[1] + depth, floorY: origin[1], W, D };
}
