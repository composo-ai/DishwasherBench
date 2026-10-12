// The boundary between the wire and the engine: orientations, quantisation, reference points.
import { quatAngleBetween, quatFromAxisAngle, quatMul, quatRotate } from '@spotless/core';
import type { Pose, Quat } from '@spotless/core';
import { describe, expect, it } from 'vitest';
import { machineContactName } from './machine-bodies.ts';
import {
  bodyPoseInTub,
  isVec3,
  quantisePosition,
  referencePointOf,
  resolveOrientation,
  toWirePose,
} from './wire.ts';

const ON_EDGE: Quat = quatFromAxisAngle([1, 0, 0], Math.PI / 2);
const PRESETS = new Map<string, Quat>([
  ['upright', [0, 0, 0, 1]],
  ['on_edge', ON_EDGE],
]);

describe('resolveOrientation', () => {
  it('applies roll, pitch and yaw about the fixed axes of the frame, in that order', () => {
    const q = resolveOrientation({ preset: 'on_edge', roll_deg: -15, yaw_deg: 90 }, PRESETS);
    expect(q).not.toBeNull();
    if (q === null) return;
    // on_edge turns the face of a plate (item +z) to -y; rolled back 15 degrees and turned a
    // quarter turn it looks along +x and up.
    const face = quatRotate(q.unit, [0, 0, 1]);
    expect(face[0]).toBeCloseTo(Math.cos((15 * Math.PI) / 180), 3);
    expect(face[1]).toBeCloseTo(0, 3);
    expect(face[2]).toBeCloseTo(Math.sin((15 * Math.PI) / 180), 3);
    const expected = quatMul(
      quatFromAxisAngle([0, 0, 1], Math.PI / 2),
      quatMul(quatFromAxisAngle([1, 0, 0], (-15 * Math.PI) / 180), ON_EDGE),
    );
    expect(quatAngleBetween(q.unit, expected)).toBeLessThan(2e-4);
  });

  it('rounds angles to whole degrees and quaternions to the 1e-4 grid', () => {
    const a = resolveOrientation({ preset: 'upright', yaw_deg: 44.6 }, PRESETS);
    const b = resolveOrientation({ preset: 'upright', yaw_deg: 45 }, PRESETS);
    expect(a).toEqual(b);
    const raw = resolveOrientation({ quat_wxyz: [2, 0, 0, 2.00001] }, PRESETS);
    expect(raw?.grid).toEqual([0, 0, 0.7071, 0.7071]);
    expect(Math.hypot(...(raw?.unit ?? [0]))).toBeCloseTo(1, 12);
    // The grid point is a fixed point: sending it back gives the same orientation.
    const back = resolveOrientation({ quat_wxyz: [0.7071, 0, 0, 0.7071] }, PRESETS);
    expect(back).toEqual(raw);
  });

  it('returns null for anything malformed', () => {
    for (const bad of [
      null,
      7,
      {},
      { preset: 'sideways' },
      { preset: 3 },
      { preset: 'upright', yaw_deg: Number.NaN },
      { preset: 'upright', roll_deg: '3' },
      { quat_wxyz: [0, 0, 0, 0] },
      { quat_wxyz: [1, 0, 0] },
      { quat_wxyz: [1, 0, 0, Number.POSITIVE_INFINITY] },
      { quat_wxyz: [1, 0, 0, 0], preset: 'upright' },
    ]) {
      expect(resolveOrientation(bad, PRESETS)).toBeNull();
    }
  });
});

describe('poses', () => {
  it('quantises positions to whole millimetres, ties away from zero', () => {
    expect(quantisePosition([12.5, -12.5, 0.49]).mm).toEqual([13, -13, 0]);
    expect(quantisePosition([212, 148, 61]).m).toEqual([0.212, 0.148, 0.061]);
    expect(isVec3([1, 2, 3])).toBe(true);
    expect(isVec3([1, 2])).toBe(false);
    expect(isVec3([1, 2, Number.NaN])).toBe(false);
    expect(isVec3('1,2,3')).toBe(false);
  });

  it('a position on the wire is that of the reference point, in the named frame', () => {
    // A rack frame 0.3 m to the front and 0.1 m up; an item whose reference point is 20 mm
    // above its own origin, placed on edge.
    const frame: Pose = { p: [0.05, -0.3, 0.1], q: [0, 0, 0, 1] };
    const reference: [number, number, number] = [0, 0, 0.02];
    const body = bodyPoseInTub(frame, [0.2, 0.15, 0.06], ON_EDGE, reference);
    expect(referencePointOf(body, reference)).toEqual([0.25, -0.15, 0.16]);
    // On edge the item's +z points to -y, so its origin is 20 mm behind the reference point.
    expect(body.p[1]).toBeCloseTo(-0.13, 12);
    const wire = toWirePose('lower_rack', frame, body, reference);
    expect(wire.frame).toBe('lower_rack');
    expect(wire.position_mm).toEqual([200, 150, 60]);
    expect(wire.quat_wxyz).toEqual([0.7071, 0.7071, 0, 0]);
    // The same body pose seen from the tub frame.
    expect(
      toWirePose('tub', { p: [0, 0, 0], q: [0, 0, 0, 1] }, body, reference).position_mm,
    ).toEqual([250, -150, 160]);
  });
});

describe('machineContactName', () => {
  it('names a contact by the body and the group of the part', () => {
    expect(machineContactName('lower_rack', 'row.r1.tine.3')).toBe('lower_rack.tine_row_r1');
    expect(machineContactName('lower_rack', 'rim.41')).toBe('lower_rack.rim');
    expect(machineContactName('lower_rack', 'floor.x.12')).toBe('lower_rack.floor.x');
    expect(machineContactName('cutlery_basket', 'foot.0.floor')).toBe(
      'cutlery_basket.foot.0.floor',
    );
    expect(machineContactName('upper_rack_fittings', 'shelf.cup_rear')).toBe(
      'upper_rack_fittings.shelf.cup_rear',
    );
    expect(machineContactName('door', 'liner')).toBe('door.liner');
    expect(machineContactName('tub', '7')).toBe('tub');
  });
});
