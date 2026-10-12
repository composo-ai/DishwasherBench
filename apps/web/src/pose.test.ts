// The ghost's arithmetic against the session's own (`packages/session/src/wire.ts`): what the
// client sends is what the session would make of the raw input, and what the client draws is
// where the session will take the item to be.
import { instantiate } from '@spotless/catalogue';
import type { Quat } from '@spotless/core';
import { quantiseQuatGrid, quatFromAxisAngle, quatToWire } from '@spotless/core';
import type { OrientationPresetCard } from '@spotless/session';
import { describe, expect, it } from 'vitest';
import {
  bodyPoseInTub,
  finePosition,
  quantisePosition,
  resolveOrientation,
  toWirePose,
} from '../../../packages/session/src/wire.ts';
import type { DrawPose, GhostPose } from './pose.ts';
import {
  bodyDrawPose,
  clampToEnvelope,
  ghostDrawPose,
  ghostOrientation,
  ghostQuat,
  heightUnderMm,
  holdHeightMm,
  insertDirectionFromDrag,
  parseNumber,
  parseQuat,
  placeRequest,
  pointFromFrame,
  pointInFrame,
  previewRequest,
  quantiseGhost,
  quantiseMm,
  rayOnFramePlane,
  reachAlongMm,
  reachBelowMm,
  stepAngleDeg,
  wirePoseDrawPose,
  wrapAngleDeg,
} from './pose.ts';

const plate = instantiate('dinner_plate_porcelain_270');
/** The session's presets: exact quaternions by name. */
const exactPresets = new Map<string, Quat>(plate.stablePoses.map((p) => [p.name, p.q]));
/** The same presets as the item record carries them: rounded to 1e-4, (w, x, y, z). */
const cardPresets: OrientationPresetCard[] = plate.stablePoses.map((p) => ({
  name: p.name,
  quat_wxyz: quatToWire(quantiseQuatGrid(p.q) as Quat),
}));
const referenceMm = [
  plate.referencePoint[0] * 1000,
  plate.referencePoint[1] * 1000,
  plate.referencePoint[2] * 1000,
] as const;

/** Deterministic pseudo-random numbers in [0, 1) (a linear congruential sequence). */
function sequence(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function rawGhost(next: () => number): GhostPose {
  const names = [...exactPresets.keys()];
  return {
    frame: 'lower_rack',
    position_mm: [next() * 525, next() * 512, next() * 300 - 20],
    preset: names[Math.floor(next() * names.length)] as string,
    yaw_deg: next() * 720 - 360,
    pitch_deg: next() * 360 - 180,
    roll_deg: next() * 360 - 180,
  };
}

describe('quantisation identical to the session', () => {
  it('sends the position the session would quantise the raw position to', () => {
    const next = sequence(7);
    for (let i = 0; i < 300; i++) {
      const raw = rawGhost(next);
      const sent = placeRequest('plate_01', raw).position_mm;
      expect(sent).toEqual(quantisePosition(raw.position_mm).mm);
      // What is sent is already on the grid: the session leaves it alone.
      expect(quantisePosition(sent).mm).toEqual([sent[0], sent[1], sent[2]]);
    }
    // Ties go away from zero, as in the session.
    expect(quantiseMm([0.5, -0.5, 2.5])).toEqual([1, -1, 3]);
    expect(quantiseMm([0.5, -0.5, 2.5])).toEqual(quantisePosition([0.5, -0.5, 2.5]).mm);
  });

  it('sends an orientation the session resolves exactly as it would the raw angles', () => {
    const next = sequence(11);
    for (let i = 0; i < 300; i++) {
      const raw = rawGhost(next);
      const fromRaw = resolveOrientation(
        {
          preset: raw.preset,
          yaw_deg: raw.yaw_deg,
          pitch_deg: raw.pitch_deg,
          roll_deg: raw.roll_deg,
        },
        exactPresets,
      );
      const fromSent = resolveOrientation(placeRequest('plate_01', raw).orientation, exactPresets);
      expect(fromSent).not.toBeNull();
      // Wrapping an angle into (-180, 180] turns the item to the same orientation; the grid
      // point is the same up to the last quantum, where sin and cos of angles 360 degrees
      // apart differ in the last bit and can round to either side.
      for (let c = 0; c < 4; c++) {
        expect(fromSent?.grid[c]).toBeCloseTo(fromRaw?.grid[c] as number, 3);
      }
    }
  });

  it('whole angles within range are sent untouched and the session agrees to the bit', () => {
    const ghost: GhostPose = {
      frame: 'lower_rack',
      position_mm: [125, 355, 250],
      preset: 'on_edge',
      yaw_deg: 90,
      pitch_deg: 0,
      roll_deg: -15,
    };
    expect(ghostOrientation(ghost)).toEqual({ preset: 'on_edge', yaw_deg: 90, roll_deg: -15 });
    expect(previewRequest('plate_01', ghost)).toEqual({
      item_id: 'plate_01',
      frame: 'lower_rack',
      position_mm: [125, 355, 250],
      orientation: { preset: 'on_edge', yaw_deg: 90, roll_deg: -15 },
    });
    expect(placeRequest('plate_01', ghost)).toEqual(previewRequest('plate_01', ghost));
    expect(placeRequest('plate_01', ghost, 'insert', [0, 1, 0])).toEqual({
      ...previewRequest('plate_01', ghost),
      mode: 'insert',
      insert_dir: [0, 1, 0],
    });
    // A drop never carries an insert direction.
    expect(placeRequest('plate_01', ghost, 'drop', [0, 1, 0])).toEqual(
      previewRequest('plate_01', ghost),
    );
  });
});

describe('where the ghost is drawn', () => {
  // The lower basket pulled out, as the server draws it.
  const frame: DrawPose = { position_mm: [-262.5, -762, 73], quat_wxyz: [1, 0, 0, 0] };
  const framePose = { p: [-0.2625, -0.762, 0.073] as const, q: [0, 0, 0, 1] as const };

  it('is where the session puts the body for the same request: within 0.05 mm and 0.02 degrees', () => {
    const next = sequence(23);
    let worstMm = 0;
    let worstAngle = 0;
    for (let i = 0; i < 300; i++) {
      const raw = rawGhost(next);
      const request = placeRequest('plate_01', raw);
      const orientation = resolveOrientation(request.orientation, exactPresets);
      if (orientation === null) throw new Error('the session refused the orientation');
      const body = bodyPoseInTub(
        { p: [...framePose.p], q: [...framePose.q] },
        quantisePosition(request.position_mm).m,
        orientation.unit,
        plate.referencePoint,
      );
      const drawn = ghostDrawPose(frame, raw, cardPresets, referenceMm);
      if (drawn === null) throw new Error('no ghost');
      worstMm = Math.max(
        worstMm,
        Math.hypot(
          drawn.position_mm[0] - body.p[0] * 1000,
          drawn.position_mm[1] - body.p[1] * 1000,
          drawn.position_mm[2] - body.p[2] * 1000,
        ),
      );
      const [w, x, y, z] = drawn.quat_wxyz;
      const dot = Math.abs(x * body.q[0] + y * body.q[1] + z * body.q[2] + w * body.q[3]);
      worstAngle = Math.max(worstAngle, (2 * Math.acos(Math.min(1, dot)) * 180) / Math.PI);
    }
    // The only difference is the item record's presets being rounded to 1e-4 (about 0.01
    // degrees), which moves the origin of a 270 mm plate by a few hundredths of a millimetre.
    expect(worstMm).toBeLessThan(0.05);
    expect(worstAngle).toBeLessThan(0.02);
  });

  it('agrees with the session exactly when the frame is turned and the preset is exact', () => {
    // A frame turned 30 degrees about z, and the identity preset (exact after rounding).
    const q = quatFromAxisAngle([0, 0, 1], Math.PI / 6);
    const turned: DrawPose = { position_mm: [100, -200, 50], quat_wxyz: quatToWire(q) };
    const body = bodyPoseInTub(
      { p: [0.1, -0.2, 0.05], q },
      [0.02, 0.03, 0.04],
      [0, 0, 0, 1],
      [0.001, 0.002, 0.015],
    );
    const drawn = bodyDrawPose(turned, [20, 30, 40], [0, 0, 0, 1], [1, 2, 15]);
    for (let i = 0; i < 3; i++) {
      expect(drawn.position_mm[i]).toBeCloseTo((body.p[i] as number) * 1000, 9);
    }
    expect(drawn.quat_wxyz[0]).toBeCloseTo(body.q[3], 12);
    expect(drawn.quat_wxyz[3]).toBeCloseTo(body.q[2], 12);
  });

  it('draws a wire pose of the session back where the body is (0.06 mm: the wire rounds to 0.1 mm)', () => {
    const q = quatFromAxisAngle([1, 0, 0], 1.1);
    const body = { p: [0.03, -0.41, 0.2] as [number, number, number], q };
    const wire = toWirePose(
      'lower_rack',
      { p: [...framePose.p], q: [...framePose.q] },
      body,
      plate.referencePoint,
    );
    const drawn = wirePoseDrawPose(frame, wire, referenceMm);
    const error = Math.hypot(
      drawn.position_mm[0] - 30,
      drawn.position_mm[1] + 410,
      drawn.position_mm[2] - 200,
    );
    expect(error).toBeLessThan(0.06 * Math.sqrt(3) + 0.03);
  });

  it('returns no ghost for a preset the item does not have', () => {
    const ghost: GhostPose = {
      frame: 'lower_rack',
      position_mm: [0, 0, 0],
      preset: 'sideways_on_a_unicycle',
      yaw_deg: 0,
      pitch_deg: 0,
      roll_deg: 0,
    };
    expect(ghostQuat(ghost, cardPresets)).toBeNull();
    expect(ghostDrawPose(frame, ghost, cardPresets, referenceMm)).toBeNull();
  });
});

describe('steps and snapping', () => {
  it('an angle moved by steps wraps into (-180, 180]', () => {
    expect(stepAngleDeg(0, 1, 15)).toBe(15);
    expect(stepAngleDeg(170, 1, 15)).toBe(-175);
    expect(stepAngleDeg(-170, -1, 15)).toBe(175);
    expect(stepAngleDeg(165, 1, 15)).toBe(180);
    expect(stepAngleDeg(180, 1, 1)).toBe(-179);
    // Twenty-four steps of 15 degrees are a full turn.
    let yaw = 30;
    for (let i = 0; i < 24; i++) yaw = stepAngleDeg(yaw, 1, 15);
    expect(yaw).toBe(30);
  });

  it('wraps and rounds typed angles', () => {
    expect(wrapAngleDeg(270)).toBe(-90);
    expect(wrapAngleDeg(-180)).toBe(180);
    expect(wrapAngleDeg(540)).toBe(180);
    expect(wrapAngleDeg(14.5)).toBe(15);
    expect(wrapAngleDeg(-14.5)).toBe(-15);
    expect(Object.is(wrapAngleDeg(360), 0)).toBe(true);
  });

  it('quantiseGhost is idempotent', () => {
    const next = sequence(5);
    for (let i = 0; i < 50; i++) {
      const once = quantiseGhost(rawGhost(next));
      expect(quantiseGhost(once)).toEqual(once);
      expect(Number.isInteger(once.position_mm[0])).toBe(true);
      expect(Number.isInteger(once.yaw_deg)).toBe(true);
    }
  });

  it('keeps the ghost inside the plan of the envelope and leaves its height alone', () => {
    expect(clampToEnvelope([-30, 600, 250], [525, 512, 292])).toEqual([0, 512, 250]);
    expect(clampToEnvelope([100, 100, 900], [525, 512, 292])).toEqual([100, 100, 900]);
    // An envelope that is not a whole number of millimetres: the last grid point inside it.
    expect(clampToEnvelope([999, 999, 0], [128.5, 230.2, 127])).toEqual([128, 230, 0]);
  });

  it('reads typed numbers and refuses anything else', () => {
    expect(parseNumber(' 125 ')).toBe(125);
    expect(parseNumber('-15')).toBe(-15);
    expect(parseNumber('12,5')).toBe(12.5);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('1e999')).toBeNull();
  });
});

describe('the mouse', () => {
  const frame: DrawPose = { position_mm: [-262.5, -762, 73], quat_wxyz: [1, 0, 0, 0] };

  it('puts the ghost where the ray meets the plane of its height, on the 1 mm grid', () => {
    // Straight down onto tub point (0, -500): frame point (262.5, 262), which rounds to
    // (263, 262) with ties away from zero.
    expect(rayOnFramePlane(frame, [0, -500, 2000], [0, 0, -1], 250)).toEqual([263, 262]);
    // An oblique ray: from (0, -1500, 1073) along (0, 1, -1) it reaches frame height 250
    // (tub z = 323) after 750 mm of fall, at tub y = -750: frame y = 12.
    const d = Math.SQRT1_2;
    expect(rayOnFramePlane(frame, [-262.5, -1500, 1073], [0, d, -d], 250)).toEqual([0, 12]);
  });

  it('has no answer for a ray along the plane or one that meets it behind the camera', () => {
    expect(rayOnFramePlane(frame, [0, -500, 500], [1, 0, 0], 250)).toBeNull();
    expect(rayOnFramePlane(frame, [0, -500, 2000], [0, 0, 1], 250)).toBeNull();
  });

  it('frame conversions are inverse to one another, also for a turned frame', () => {
    const turned: DrawPose = {
      position_mm: [10, 20, 30],
      quat_wxyz: quatToWire(quatFromAxisAngle([0, 0, 1], 0.7)),
    };
    const back = pointInFrame(turned, pointFromFrame(turned, [5, -7, 11]));
    expect(back[0]).toBeCloseTo(5, 9);
    expect(back[1]).toBeCloseTo(-7, 9);
    expect(back[2]).toBeCloseTo(11, 9);
  });

  it('reads the insert direction off a drag: the candidate the drag follows most closely', () => {
    // Candidates as they appear on a screen (pixels per 100 mm, y down): down, back, front,
    // right, left, up in a three-quarter view.
    const candidates = [
      [0, 60],
      [35, -25],
      [-35, 25],
      [45, 20],
      [-45, -20],
      [0, -60],
    ] as const;
    expect(insertDirectionFromDrag([2, 80], candidates)).toBe(0);
    expect(insertDirectionFromDrag([0, -50], candidates)).toBe(5);
    expect(insertDirectionFromDrag([40, -30], candidates)).toBe(1);
    expect(insertDirectionFromDrag([50, 25], candidates)).toBe(3);
    // Too short to mean anything.
    expect(insertDirectionFromDrag([3, 4], candidates)).toBeNull();
    // A direction seen end on (no length on the screen) is never chosen.
    expect(
      insertDirectionFromDrag(
        [0, 40],
        [
          [0, 1],
          [0, -60],
        ],
      ),
    ).toBeNull();
  });
});

describe('holding height', () => {
  it('holds an item with its lowest point 15 mm above the basket', () => {
    // An upright plate, 30 mm high, reaches 15 mm below its reference point (the box centre).
    expect(reachBelowMm([270, 270, 30], [0, 0, 0, 1])).toBeCloseTo(15, 9);
    expect(holdHeightMm(173, [270, 270, 30], [0, 0, 0, 1])).toBe(203);
    // On edge (turned a quarter about x) it reaches half its diameter: 135 mm.
    const onEdge = quatFromAxisAngle([1, 0, 0], Math.PI / 2);
    expect(reachBelowMm([270, 270, 30], onEdge)).toBeCloseTo(135, 6);
    expect(holdHeightMm(173, [270, 270, 30], onEdge)).toBe(323);
  });
});

describe('a pose read from the machine, typed back in', () => {
  const frame: DrawPose = { position_mm: [-262.5, -762, 73], quat_wxyz: [1, 0, 0, 0] };
  // A settled pose as the Selected panel shows it: 0.1 mm and a quaternion on the 1e-4 grid.
  const settled = {
    position_mm: [186.1, 372.1, 174.7] as const,
    quat_wxyz: [0.6415, 0.3433, 0.3978, 0.5589] as const,
  };
  const ghost: GhostPose = {
    frame: 'lower_rack',
    position_mm: settled.position_mm,
    preset: 'on_edge',
    yaw_deg: 90,
    pitch_deg: 0,
    roll_deg: -29,
    quat_wxyz: settled.quat_wxyz,
    fine: true,
  };

  it('is sent as the quaternion and the 0.1 mm position the session takes for a set', () => {
    const request = placeRequest('plate_03', ghost, 'set');
    expect(request).toEqual({
      item_id: 'plate_03',
      frame: 'lower_rack',
      position_mm: [186.1, 372.1, 174.7],
      orientation: { quat_wxyz: [0.6415, 0.3433, 0.3978, 0.5589] },
      mode: 'set',
    });
    // The session resolves the same request to the same grid point and the same position.
    const resolved = resolveOrientation(request.orientation, exactPresets);
    expect(resolved).not.toBeNull();
    expect(quatToWire(resolved?.grid as Quat)).toEqual([0.6415, 0.3433, 0.3978, 0.5589]);
    expect(finePosition(request.position_mm).mm).toEqual([186.1, 372.1, 174.7]);
    // And the ghost is drawn where the session will take the body to be.
    const drawn = ghostDrawPose(frame, ghost, cardPresets, referenceMm);
    const body = bodyPoseInTub(
      { p: [-0.2625, -0.762, 0.073], q: [0, 0, 0, 1] },
      finePosition(request.position_mm).m,
      resolved?.unit as Quat,
      plate.referencePoint,
    );
    for (let axis = 0; axis < 3; axis++) {
      expect(Math.abs((drawn?.position_mm[axis] ?? 0) - (body.p[axis] ?? 0) * 1000)).toBeLessThan(
        0.001,
      );
    }
  });

  it('keeps the quaternion on the game grid too: whole millimetres, the same orientation', () => {
    const { fine: _fine, ...coarse } = ghost;
    const request = previewRequest('plate_03', coarse);
    expect(request.position_mm).toEqual([186, 372, 175]);
    expect(request.orientation).toEqual({ quat_wxyz: [0.6415, 0.3433, 0.3978, 0.5589] });
    expect(quantiseGhost(coarse).quat_wxyz).toEqual([0.6415, 0.3433, 0.3978, 0.5589]);
  });

  it('reads a typed quaternion, whatever separates the numbers, and refuses nonsense', () => {
    expect(parseQuat('0.6415, 0.3433, 0.3978, 0.5589')).toEqual([0.6415, 0.3433, 0.3978, 0.5589]);
    expect(parseQuat('(1 0 0 0)')).toEqual([1, 0, 0, 0]);
    expect(parseQuat('[0.70711; 0,70711; 0; 0]')).toBeNull();
    expect(parseQuat('0.70711 0.70711 0 0')).toEqual([0.7071, 0.7071, 0, 0]);
    // The canonical sign has w >= 0.
    expect(parseQuat('-1, 0, 0, 0')).toEqual([1, 0, 0, 0]);
    expect(parseQuat('0, 0, 0, 0')).toBeNull();
    expect(parseQuat('1, 0, 0')).toBeNull();
    expect(parseQuat('a, b, c, d')).toBeNull();
  });
});

describe('the holding height under the roof', () => {
  const upright: Quat = [0, 0, 0, 1];
  it('is the usual one in the open and lower where the item would reach a ceiling', () => {
    const bbox = [270, 270, 30] as const;
    const wanted = holdHeightMm(172, bbox, upright);
    expect(heightUnderMm(wanted, 1000, bbox, upright)).toBe(wanted);
    // On edge the plate is 270 mm tall: under a ceiling at 340 mm its middle is held at 197.
    const onEdge = quatFromAxisAngle([1, 0, 0], Math.PI / 2);
    expect(reachBelowMm(bbox, onEdge)).toBeCloseTo(135, 6);
    expect(heightUnderMm(holdHeightMm(172, bbox, onEdge), 340, bbox, onEdge)).toBe(197);
    expect(reachAlongMm(bbox, onEdge, 0)).toBeCloseTo(135, 6);
    expect(reachAlongMm(bbox, onEdge, 1)).toBeCloseTo(15, 6);
  });

  it('keeps an item whose reference point is not at its middle under the ceiling by its true reach', () => {
    // A mug 100 mm tall whose reference point is 40 mm from its mouth: held mouth down it
    // reaches 60 mm up, not half its height. (A mug picked up in the upper basket was held 2 mm
    // into the roof of the tub wherever it was moved to, and could not be put down.)
    const mug = [120, 90, 100] as const;
    const wanted = holdHeightMm(130, mug, upright);
    expect(heightUnderMm(wanted, 250, mug, upright)).toBe(192);
    expect(heightUnderMm(wanted, 250, mug, upright, undefined, 60)).toBe(182);
    // In the open the reach does not matter.
    expect(heightUnderMm(wanted, 1000, mug, upright, undefined, 60)).toBe(wanted);
  });
});
