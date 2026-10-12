// Engine-neutral test scenes. A scene is plain data:
//   { name, gravity, friction, restitution, statics[], shapes{}, bodies[], meta{} }
// bodies: { name, shape (key into shapes), mass, pos, quat [x,y,z,w], linvel, angvel }
// Body frames are COM-centred (see shapes.mjs), so `pos` is the centre of mass.
// `node src/check-initial.mjs` verifies that no scene starts with interpenetration.
import { qAxisAngle, qMul, qRot, add, rng, transformPoints } from './math.mjs';
import { makePlate, makeBowl, makeTumbler, makeMug, makeKnife, makeFork, makeSpoon, bowlNestSpacing } from './shapes.mjs';
import { makeRack, makeCupShelf, makeBasket, RACK, BASKET } from './rack.mjs';

const DEG = Math.PI / 180;
const X = [1, 0, 0];
const Y = [0, 1, 0];
const Z = [0, 0, 1];

function base(name, opts = {}) {
  return {
    name,
    gravity: [0, -9.81, 0],
    friction: opts.friction ?? 0.4,
    restitution: opts.restitution ?? 0.1,
    statics: [],
    shapes: {},
    bodies: [],
    meta: {},
  };
}
function addBody(scene, shape, name, pos, quat, linvel = [0, 0, 0], angvel = [0, 0, 0]) {
  scene.shapes[shape.name] = shape;
  scene.bodies.push({ name, shape: shape.name, mass: shape.mass, pos, quat, linvel, angvel });
  return scene.bodies.length - 1;
}
/** Extent of a rotated shape along a world direction: {min, max} of dot(p, dir). */
function extent(shape, q, dir, filter = null) {
  let min = Infinity;
  let max = -Infinity;
  for (const piece of shape.pieces) {
    const w = transformPoints(piece, [0, 0, 0], q);
    for (let i = 0; i < w.length; i += 3) {
      if (filter && !filter(w[i], w[i + 1], w[i + 2])) continue;
      const d = w[i] * dir[0] + w[i + 1] * dir[1] + w[i + 2] * dir[2];
      if (d < min) min = d;
      if (d > max) max = d;
    }
  }
  return { min, max };
}

/** Pose of a plate standing in slot `k` (between tine rows k and k+1), leaning back by tiltDeg. */
function plateInSlot(shape, k, { tiltDeg = 10, x = 0.005, gap = 0.02 } = {}) {
  const q = qAxisAngle(X, (90 - tiltDeg) * DEG); // plate axis -> +Z, eating side tilted upward
  const ey = extent(shape, q, Y);
  // Part of the plate that is inside the tine zone at the start pose (below the tine tips).
  const ez = extent(shape, q, Z, (px, py) => py < ey.min + (RACK.tineTip - RACK.baseTop - gap) + 0.002);
  const slotCentre = -0.24 + k * RACK.rowPitch + RACK.rowPitch / 2;
  return { pos: [x, RACK.baseTop + gap - ey.min, slotCentre - (ez.min + ez.max) / 2], quat: q, slotSpan: ez.max - ez.min };
}

// T1: one plate dropped from 20 mm above a slot at ~10 degrees from vertical.
export function sceneT1(o = {}) {
  const s = base('T1-single-plate', o);
  s.statics = makeRack({ tineLean: (o.tineLeanDeg ?? 0) * DEG });
  const plate = makePlate(o.plateN ?? 24);
  const p = plateInSlot(plate, 6, { tiltDeg: o.tiltDeg ?? 10 });
  addBody(s, plate, 'plate', p.pos, p.quat);
  s.meta = { duration: 5, slotSpan: p.slotSpan, plateRadius: plate.radius };
  return s;
}

// T2: twelve plates in adjacent slots, slightly varied tilt and lateral position.
export function sceneT2(o = {}) {
  const s = base('T2-twelve-plates', o);
  s.statics = makeRack({ tineLean: (o.tineLeanDeg ?? 0) * DEG, segments: o.segments });
  const plate = makePlate(o.plateN ?? 24);
  const r = rng(12345);
  for (let k = 0; k < 12; k++) {
    // Tilt 6.5..9.5 degrees. Kept below 10 degrees on purpose: the part of a 24 mm deep plate that is
    // inside the 63 mm tine zone spans 23.6 mm + 65 mm * tan(tilt), which exceeds the 36 mm clear slot
    // above ~10.8 degrees, and such a plate geometrically wedges on the way down (engines then
    // disagree on whether it jams, and there is no ground truth for that). The spread is also small
    // enough that the upper halves of neighbouring plates do not start interpenetrating.
    const p = plateInSlot(plate, k, { tiltDeg: 6.5 + 3 * r(), x: (r() - 0.5) * 0.012, gap: 0.02 });
    addBody(s, plate, `plate${k}`, p.pos, p.quat);
  }
  s.meta = { duration: 10 };
  return s;
}

// T3: four bowls nested in a stack on the (tine-free) rack, each slightly offset laterally.
export function sceneT3(o = {}) {
  const s = base('T3-nested-bowls', o);
  s.statics = makeRack({ tines: false });
  const bowl = makeBowl(o.bowlN ?? 24, o.bowlK ?? 5);
  const ideal = bowlNestSpacing();
  const footToCom = -extent(bowl, [0, 0, 0, 1], Y).min;
  // Relative lateral offsets of 2-3 mm: the walls are ~80 degrees steep, so 25 mm of extra axial
  // spacing only opens ~4 mm of radial clearance.
  const offs = [[0.004, 0.003], [0.006, 0.002], [0.004, 0.004], [0.0055, 0.0025]];
  for (let i = 0; i < 4; i++) {
    const q = qAxisAngle(Y, (o.alignFacets ? 0 : i * 0.37) + 0.1);
    const y = RACK.baseTop + 0.002 + footToCom + i * (ideal + 0.025);
    addBody(s, bowl, `bowl${i}`, [offs[i][0], y, offs[i][1]], q);
  }
  s.meta = { duration: 8, idealNestSpacing: ideal };
  return s;
}

// Glass zone: every other tine row removed (80 mm row pitch), otherwise a 70 mm glass cannot lean.
const GLASS_ZONE = (x, z) => Math.round((z + 0.24) / RACK.rowPitch) % 2 === 0;

/** Pose of a tumbler inverted over the two tines at x = cx -+ 0.016 of the row at z = cz. */
function tumblerOverTines(tumbler, cx, cz, tiltDeg) {
  const q = qMul(qAxisAngle(X, tiltDeg * DEG), qAxisAngle(X, Math.PI));
  const ey = extent(tumbler, q, Y);
  const mc = qRot(q, [0, tumbler.height - tumbler.comOffset[1], 0]); // mouth centre relative to COM
  return { pos: [cx - mc[0], RACK.baseTop + 0.01 - ey.min, cz - mc[2]], quat: q };
}

// T4a: tumbler inverted over two tines, leaning 15 degrees.
export function sceneT4a(o = {}) {
  const s = base('T4a-tumbler-over-tines', o);
  s.statics = makeRack({ tineFilter: GLASS_ZONE });
  const tumbler = makeTumbler(o.tumblerN ?? 16);
  const p = tumblerOverTines(tumbler, 0.016, 0, o.tiltDeg ?? 15);
  addBody(s, tumbler, 'tumbler', p.pos, p.quat);
  s.meta = { duration: 6 };
  return s;
}

// T4b: mug resting inverted on a 12-degree cup shelf. tan(12 deg) = 0.213 < mu, so it must not slide.
export function sceneT4b(o = {}) {
  const s = base('T4b-mug-on-shelf', o);
  const shelf = makeCupShelf((o.shelfTiltDeg ?? 12) * DEG);
  s.statics = shelf.statics;
  const mug = makeMug(o.mugN ?? 16);
  const q = qMul(shelf.q, qAxisAngle(X, Math.PI));
  const en = extent(mug, q, shelf.normal);
  const along = add(shelf.origin, qRot(shelf.q, [0.005, 0, -0.02]));
  const h = 0.002 + 0.003 - en.min;
  addBody(s, mug, 'mug', add(along, [shelf.normal[0] * h, shelf.normal[1] * h, shelf.normal[2] * h]), q);
  s.meta = { duration: 10, downhill: shelf.downhill, normal: shelf.normal, shelfTiltDeg: o.shelfTiltDeg ?? 12 };
  return s;
}

/**
 * Two pieces per cell, handles down. Piece A sits at (-7,-7) mm from the cell centre and starts 30 mm
 * above the floor; piece B at (+7,+7) mm starts 110 mm above the floor (its handle end just inside the
 * cell mouth), so that heads of neighbouring pieces do not start interpenetrating. Flat sides face the
 * cell diagonal, curved sides face away from each other; +-10 deg yaw and +-2 deg tilt jitter.
 */
function fillBasket(s, basket, kinds, r, salt) {
  const owner = [];
  for (let c = 0; c < basket.cells.length; c++) {
    const cell = basket.cells[c];
    for (let j = 0; j < 2; j++) {
      const shape = kinds[(c + j * 2 + (c >> 1) + salt) % 3];
      const yaw = (j === 0 ? 225 : 45) * DEG + (r() - 0.5) * 20 * DEG;
      const tilt = qMul(qAxisAngle(Z, (r() - 0.5) * 4 * DEG), qAxisAngle(X, (r() - 0.5) * 4 * DEG));
      const q = qMul(tilt, qAxisAngle(Y, yaw));
      const ey = extent(shape, q, Y);
      const off = j === 0 ? -0.007 : 0.007;
      const drop = j === 0 ? 0.03 : 0.11;
      addBody(s, shape, `${shape.name}${s.bodies.length}`, [cell.cx + off, basket.floorY + drop - ey.min, cell.cz + off], q);
      owner.push(c);
    }
  }
  return owner;
}

// T5: twenty mixed cutlery pieces dropped into ten basket cells (two per cell), handles down.
export function sceneT5(o = {}) {
  const s = base('T5-cutlery-basket', o);
  const basket = makeBasket([0, 0, 0]);
  s.statics = basket.statics;
  const owner = fillBasket(s, basket, [makeFork(), makeSpoon(), makeKnife()], rng(o.seed ?? 777), 0);
  s.meta = { duration: 6, cells: basket.cells, owner, rimY: basket.rimY, floorY: basket.floorY };
  return s;
}

// T6a: knife dropped onto two parallel wires (x = +-0.05) at a given speed, edge-on or flat.
export function sceneT6knife(o = {}) {
  const speed = o.speed ?? 2;
  const mode = o.mode ?? 'edge';
  const s = base(`T6-knife-${mode}-${speed}`, o);
  for (const x of [-0.05, 0.05]) s.statics.push({ type: 'capsule', a: [x, 0, -0.25], b: [x, 0, 0.25], r: RACK.wireR, tag: 'wire' });
  const knife = makeKnife();
  const edgeOn = qAxisAngle(Z, 90 * DEG); // long axis along -X, cutting edge facing down
  const q = mode === 'edge' ? edgeOn : qMul(qAxisAngle(X, 90 * DEG), edgeOn);
  const ey = extent(knife, q, Y);
  addBody(s, knife, 'knife', [0, RACK.wireR + (o.gap ?? 0.007) - ey.min, 0.01], q, [0, -speed, 0]);
  s.meta = { duration: 1.0, speed, mode, passY: -0.03 };
  return s;
}

// T6b: plate dropped flat onto the tine tips at a given speed.
export function sceneT6plate(o = {}) {
  const speed = o.speed ?? 2;
  const s = base(`T6-plate-flat-${speed}`, o);
  s.statics = makeRack();
  const plate = makePlate(o.plateN ?? 24);
  const q = qAxisAngle(Y, 0.05);
  const ey = extent(plate, q, Y);
  addBody(s, plate, 'plate', [0.005, RACK.tineTip + (o.gap ?? 0.011) - ey.min, 0.003], q, [0, -speed, 0]);
  s.meta = { duration: 2.0, speed, restY: RACK.tineTip - ey.min, tineTip: RACK.tineTip };
  return s;
}

// Full load for the scaling measurement: ~120 bodies, ~3000 convex pieces, ~1400 static capsules.
// Four racks (two plate racks, one flat rack with bowls and mugs, one glass rack) and three baskets.
export function sceneFull(o = {}) {
  const s = base('FULL-load', o);
  const seg = 7;
  const oA = [0, 0, 0];
  const oB = [0, 0.4, 0];
  const oC = [0.6, 0, 0];
  const oD = [0.6, 0.4, 0];
  s.statics.push(...makeRack({ origin: oA, segments: seg }), ...makeRack({ origin: oB, tines: false, segments: seg }));
  s.statics.push(...makeRack({ origin: oC, segments: seg }), ...makeRack({ origin: oD, segments: seg, tineFilter: GLASS_ZONE }));
  const r = rng(o.seed ?? 4245);
  const plate = makePlate(16);
  for (const [tag, org] of [['a', oA], ['c', oC]]) {
    for (let k = 0; k < 12; k++) {
      const p = plateInSlot(plate, k, { tiltDeg: 6.5 + 3 * r(), x: (r() - 0.5) * 0.012 });
      addBody(s, plate, `plate-${tag}${k}`, add(p.pos, org), p.quat);
    }
  }
  const bowl = makeBowl(16, 4);
  const ideal = bowlNestSpacing();
  const footToCom = -extent(bowl, [0, 0, 0, 1], Y).min;
  let n = 0;
  for (const [bx, bz] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) {
    for (let i = 0; i < 3; i++) {
      const y = RACK.baseTop + 0.002 + footToCom + i * (ideal + 0.025);
      addBody(s, bowl, `bowl${n++}`, add([bx + (r() - 0.5) * 0.003, y, bz + (r() - 0.5) * 0.003], oB), qAxisAngle(Y, r() * 6.28));
    }
  }
  const mug = makeMug(16);
  const mq = qAxisAngle(X, Math.PI);
  const mugY = RACK.baseTop + 0.003 - extent(mug, mq, Y).min;
  for (const [mx, mz, turn] of [[-0.19, 0, 0], [-0.06, 0, 0], [0.07, 0, 0], [0.2, 0.03, Math.PI]]) addBody(s, mug, `mug${n++}`, add([mx, mugY, mz], oB), qMul(qAxisAngle(Y, turn), mq));
  for (const mz of [-0.17, 0.17]) addBody(s, mug, `mug${n++}`, add([0, mugY, mz], oB), qMul(qAxisAngle(Y, mz > 0 ? -Math.PI / 2 : Math.PI / 2), mq));
  const tumbler = makeTumbler(16);
  for (let iz = 0; iz < 4; iz++) {
    for (let ix = 0; ix < 5; ix++) {
      const p = tumblerOverTines(tumbler, -0.176 + ix * 0.096, -0.16 + iz * 0.08, 15);
      addBody(s, tumbler, `tumbler${n++}`, add(p.pos, oD), p.quat);
    }
  }
  const kinds = [makeFork(), makeSpoon(), makeKnife()];
  for (let b = 0; b < 3; b++) {
    const basket = makeBasket([-0.5, 0, -0.2 + b * 0.2]);
    s.statics.push(...basket.statics);
    fillBasket(s, basket, kinds, r, b);
  }
  s.meta = { duration: 4 };
  return s;
}

export function sceneCounts(scene) {
  let pieces = 0;
  let verts = 0;
  for (const b of scene.bodies) {
    const sh = scene.shapes[b.shape];
    pieces += sh.pieces.length;
    for (const p of sh.pieces) verts += p.length / 3;
  }
  return {
    bodies: scene.bodies.length,
    pieces,
    vertices: verts,
    staticCapsules: scene.statics.filter((x) => x.type === 'capsule').length,
    staticBoxes: scene.statics.filter((x) => x.type === 'box').length,
  };
}

export const SCENES = {
  T1: sceneT1,
  T2: sceneT2,
  T3: sceneT3,
  T4a: sceneT4a,
  T4b: sceneT4b,
  T5: sceneT5,
  T6knife: sceneT6knife,
  T6plate: sceneT6plate,
  FULL: sceneFull,
};
export { BASKET, RACK };
