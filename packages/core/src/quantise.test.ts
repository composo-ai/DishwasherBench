import { describe, expect, it } from 'vitest';
import {
  quatAngleBetween,
  quatFromAxisAngle,
  quatLength,
  quatNeg,
  quatNormalise,
} from './math/quat.ts';
import type { Quat, Vec3 } from './math/types.ts';
import {
  ANGLE_QUANTUM_DEG,
  POSITION_QUANTUM_MM,
  QUAT_QUANTUM,
  quantiseAngle,
  quantiseAngleDeg,
  quantisePosition,
  quantisePositionMm,
  quantiseQuat,
  quantiseQuatGrid,
  quatFromWire,
  quatToWire,
  roundHalfAwayFromZero,
  roundToGrid,
} from './quantise.ts';
import { maxAbsDiff, testRandom } from './test-util.ts';
import { degToRad, mmToM } from './units.ts';

describe('rounding', () => {
  it('rounds halves away from zero, symmetrically', () => {
    expect(roundHalfAwayFromZero(0.5)).toBe(1);
    expect(roundHalfAwayFromZero(-0.5)).toBe(-1);
    expect(roundHalfAwayFromZero(1.5)).toBe(2);
    expect(roundHalfAwayFromZero(-1.5)).toBe(-2);
    expect(roundHalfAwayFromZero(2.5)).toBe(3);
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3);
    expect(roundHalfAwayFromZero(2.4)).toBe(2);
    expect(roundHalfAwayFromZero(-2.4)).toBe(-2);
    expect(roundHalfAwayFromZero(7)).toBe(7);
  });

  it('never returns negative zero and does not round 0.49999999999999994 up', () => {
    expect(Object.is(roundHalfAwayFromZero(-0.2), 0)).toBe(true);
    expect(Object.is(roundHalfAwayFromZero(-0), 0)).toBe(true);
    expect(roundHalfAwayFromZero(0.49999999999999994)).toBe(0);
    expect(roundHalfAwayFromZero(-0.49999999999999994)).toBe(0);
  });

  it('is odd: round(-x) = -round(x) for random x', () => {
    const rnd = testRandom(401);
    for (let i = 0; i < 2000; i++) {
      const x = rnd.range(-1000, 1000);
      expect(roundHalfAwayFromZero(-x)).toBe(-roundHalfAwayFromZero(x) + 0);
    }
  });

  it('roundToGrid(x, 10) rounds millimetres to 0.1 mm, giving the decimal literal exactly', () => {
    expect(roundToGrid(212.449, 10)).toBe(212.4);
    expect(roundToGrid(212.46, 10)).toBe(212.5);
    expect(roundToGrid(-0.07, 10)).toBe(-0.1);
    expect(roundToGrid(0.70710678, 10000)).toBe(0.7071);
    // Exact ties (representable in binary) go away from zero.
    expect(roundToGrid(0.25, 2)).toBe(0.5);
    expect(roundToGrid(-0.25, 2)).toBe(-0.5);
  });
});

describe('position and angle quantisation', () => {
  it('uses the quanta of platform.md section 2: 1 mm, 1 degree, 1e-4', () => {
    expect(POSITION_QUANTUM_MM).toBe(1);
    expect(ANGLE_QUANTUM_DEG).toBe(1);
    expect(QUAT_QUANTUM).toBe(1e-4);
  });

  it('rounds wire positions to whole millimetres', () => {
    expect(quantisePositionMm([212.4, -0.5, 61.5])).toEqual([212, -1, 62]);
    expect(quantisePositionMm([0.2, -0.2, 1e-9])).toEqual([0, 0, 0]);
  });

  it('snaps SI positions to the millimetre grid: the result is exactly mmToM(k)', () => {
    expect(quantisePosition([0.2124, 0.1476, -0.0606])).toEqual([0.212, 0.148, -0.061]);
    const rnd = testRandom(402);
    for (let i = 0; i < 2000; i++) {
      const p: Vec3 = rnd.vec3(0.6);
      const q = quantisePosition(p);
      for (let k = 0; k < 3; k++) {
        const mm = Math.round((q[k] as number) * 1000);
        expect(q[k]).toBe(mmToM(mm));
        // Never more than half a millimetre (plus rounding of the product) from the input.
        expect(Math.abs((q[k] as number) - (p[k] as number))).toBeLessThanOrEqual(0.0005 + 1e-15);
      }
    }
  });

  it('position quantisation is mirror-symmetric and idempotent', () => {
    const rnd = testRandom(403);
    for (let i = 0; i < 1000; i++) {
      const p = rnd.vec3(0.6);
      const q = quantisePosition(p);
      const mirrored = quantisePosition([-p[0], -p[1], -p[2]]);
      expect(mirrored).toEqual([-q[0] + 0, -q[1] + 0, -q[2] + 0]);
      expect(quantisePosition(q)).toEqual(q);
    }
  });

  it('rounds angles to whole degrees, and SI angles to exactly degToRad(k)', () => {
    expect(quantiseAngleDeg(14.5)).toBe(15);
    expect(quantiseAngleDeg(-14.5)).toBe(-15);
    expect(quantiseAngleDeg(359.6)).toBe(360);
    expect(quantiseAngle(Math.PI / 2 + 0.004)).toBe(degToRad(90));
    const rnd = testRandom(404);
    for (let i = 0; i < 1000; i++) {
      const a = rnd.range(-7, 7);
      const q = quantiseAngle(a);
      const k = Math.round(q / degToRad(1));
      expect(q).toBe(degToRad(k));
      expect(Math.abs(q - a)).toBeLessThanOrEqual(degToRad(0.5) + 1e-15);
    }
  });
});

describe('wire order', () => {
  it('moves w between last (internal) and first (wire) position', () => {
    expect(quatToWire([0.1, 0.2, 0.3, 0.9])).toEqual([0.9, 0.1, 0.2, 0.3]);
    expect(quatFromWire([0.9, 0.1, 0.2, 0.3])).toEqual([0.1, 0.2, 0.3, 0.9]);
    expect(quatToWire([0, 0, 0, 1])).toEqual([1, 0, 0, 0]);
  });

  it('the benchmark example quat_wxyz [0.707, 0.707, 0, 0] is a quarter turn about +x', () => {
    const q = quantiseQuat(quatFromWire([0.707, 0.707, 0, 0]));
    expect(q).not.toBeNull();
    expect(
      quatAngleBetween(q as Quat, quatFromAxisAngle([1, 0, 0], Math.PI / 2)),
    ).toBeLessThanOrEqual(1e-4);
  });

  it('round-trips', () => {
    const rnd = testRandom(405);
    for (let i = 0; i < 100; i++) {
      const q = rnd.unitQuat();
      expect(quatFromWire(quatToWire(q))).toEqual(q);
    }
  });
});

describe('quaternion quantisation', () => {
  it('rounds an eighth turn about z to (0.3827, 0.9239) and renormalises (1e-15)', () => {
    const raw: Quat = [0, 0, Math.sin(Math.PI / 8), Math.cos(Math.PI / 8)];
    expect(quantiseQuatGrid(raw)).toEqual([0, 0, 0.3827, 0.9239]);
    const h = Math.hypot(0.3827, 0.9239);
    expect(
      maxAbsDiff(quantiseQuat(raw) as Quat, [0, 0, 0.3827 / h, 0.9239 / h]),
    ).toBeLessThanOrEqual(1e-15);
  });

  it('grid values are multiples of 1e-4, written as four-decimal literals', () => {
    const rnd = testRandom(406);
    for (let i = 0; i < 2000; i++) {
      const g = quantiseQuatGrid(rnd.unitQuat()) as Quat;
      for (const c of g) {
        expect(c).toBe(Number(c.toFixed(4)));
        expect(Object.is(c, -0)).toBe(false);
      }
      // A rounded unit quaternion is within 1e-4 of unit norm.
      expect(Math.abs(quatLength(g) - 1)).toBeLessThanOrEqual(1e-4 + 1e-12);
    }
  });

  it('the engine quaternion is unit (1e-15), has w >= 0 and is within 2.1e-4 rad of the input', () => {
    // Component errors of at most 0.5e-4 give a 4-vector error of at most 1e-4. The angle
    // between the two unit 4-vectors is then at most asin(1e-4), and the rotation angle is
    // twice that: 2e-4 rad (2.1e-4 allows for rounding).
    const rnd = testRandom(407);
    let worst = 0;
    for (let i = 0; i < 5000; i++) {
      const raw = rnd.unitQuat();
      const q = quantiseQuat(raw) as Quat;
      expect(Math.abs(quatLength(q) - 1)).toBeLessThanOrEqual(1e-15);
      expect(q[3]).toBeGreaterThanOrEqual(0);
      worst = Math.max(worst, quatAngleBetween(raw, q));
    }
    expect(worst).toBeLessThanOrEqual(2.1e-4);
    // And the quantisation is not a no-op: typical error is a good fraction of the bound.
    expect(worst).toBeGreaterThan(0.5e-4);
  });

  it('q and -q quantise to the same value, including half turns where w is zero', () => {
    const rnd = testRandom(408);
    for (let i = 0; i < 2000; i++) {
      const q = rnd.unitQuat();
      expect(quantiseQuat(quatNeg(q))).toEqual(quantiseQuat(q));
      expect(quantiseQuatGrid(quatNeg(q))).toEqual(quantiseQuatGrid(q));
    }
    const halfTurns: Quat[] = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [Math.SQRT1_2, -Math.SQRT1_2, 0, 0],
      [0.6, 0, -0.8, 1e-9],
      [0.6, 0, -0.8, -1e-9],
    ];
    for (const q of halfTurns) {
      const a = quantiseQuatGrid(q) as Quat;
      expect(quantiseQuatGrid(quatNeg(q))).toEqual(a);
      const lead = a[3] !== 0 ? a[3] : a[0] !== 0 ? a[0] : a[1] !== 0 ? a[1] : a[2];
      expect(lead).toBeGreaterThan(0);
    }
    expect(quantiseQuatGrid([-1, 0, 0, 0])).toEqual([1, 0, 0, 0]);
  });

  it('is idempotent on the grid: feeding a grid point back returns the same grid point', () => {
    const rnd = testRandom(409);
    for (let i = 0; i < 20000; i++) {
      const scale = i % 3 === 0 ? 1 : 10 ** rnd.range(-3, 3);
      const u = rnd.unitQuat();
      const raw: Quat = [u[0] * scale, u[1] * scale, u[2] * scale, u[3] * scale];
      const g = quantiseQuatGrid(raw) as Quat;
      expect(quantiseQuatGrid(g)).toEqual(g);
      expect(quantiseQuat(g)).toEqual(quantiseQuat(raw));
    }
  });

  it('the wire round trip is exact through the grid point, but not through the unit quaternion', () => {
    // Reporting the grid point and receiving it back gives the same engine quaternion, bit for
    // bit. Re-quantising the renormalised (unit) quaternion instead may land on a neighbouring
    // grid point: |g| is within 1e-4 of 1, so k / |g| differs from the integer k by at most
    // 1e4 * 1e-4 = 1 step per component. This test pins both facts.
    const rnd = testRandom(411);
    let moved = 0;
    let worstSteps = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const raw = rnd.unitQuat();
      const grid = quantiseQuatGrid(raw) as Quat;
      const engine = quantiseQuat(raw) as Quat;
      expect(quantiseQuat(quatFromWire(quatToWire(grid)))).toEqual(engine);
      const again = quantiseQuatGrid(engine) as Quat;
      const steps = maxAbsDiff(again, grid) * 10000;
      worstSteps = Math.max(worstSteps, steps);
      if (steps > 0.5) moved++;
    }
    expect(worstSteps).toBeLessThanOrEqual(1 + 1e-9);
    // The hazard is real (so the rule "put the grid point on the wire" matters) but uncommon.
    expect(moved).toBeGreaterThan(0);
    expect(moved / n).toBeLessThan(0.05);
  });

  it('a long quaternion cannot buy finer angular resolution than the quantum', () => {
    // w = 10000, x = 1 is a turn of 2e-4 rad about x: it survives as one quantum.
    expect(quantiseQuatGrid([1, 0, 0, 10000])).toEqual([0.0001, 0, 0, 1]);
    // w = 10000, x = 0.4 would be 0.8e-4 rad: below half a quantum, it rounds to the identity.
    expect(quantiseQuatGrid([0.4, 0, 0, 10000])).toEqual([0, 0, 0, 1]);
    expect(quantiseQuat([0.4, 0, 0, 10000])).toEqual([0, 0, 0, 1]);
    // Any positive multiple of a quaternion far from unit norm gives the same result.
    const rnd = testRandom(410);
    for (let i = 0; i < 500; i++) {
      const u = rnd.unitQuat();
      const s = rnd.range(1.5, 400);
      expect(quantiseQuatGrid([u[0] * s, u[1] * s, u[2] * s, u[3] * s])).toEqual(
        quantiseQuatGrid([u[0] * 3, u[1] * 3, u[2] * 3, u[3] * 3]),
      );
    }
  });

  it('accepts sloppy human input: three-decimal and unnormalised quaternions', () => {
    // (0.707, 0, 0, 0.707) has norm 0.99985: normalised first, giving the 0.7071 grid point.
    expect(quantiseQuatGrid([0.707, 0, 0, 0.707])).toEqual([0.7071, 0, 0, 0.7071]);
    expect(quantiseQuatGrid([1, 0, 0, 1])).toEqual([0.7071, 0, 0, 0.7071]);
    expect(quantiseQuatGrid([0, 0, 0, 2])).toEqual([0, 0, 0, 1]);
    expect(quantiseQuatGrid([0, 0, 0, -3])).toEqual([0, 0, 0, 1]);
    // A four-decimal grid point is kept exactly as sent.
    expect(quantiseQuatGrid([0.7071, 0, 0, 0.7071])).toEqual([0.7071, 0, 0, 0.7071]);
    expect(quantiseQuatGrid([0.5, 0.5, 0.5, 0.5])).toEqual([0.5, 0.5, 0.5, 0.5]);
  });

  it('removes rounding noise from quaternions built with trigonometry', () => {
    // Half a turn about x built from degrees: cos(pi/2) is 6e-17, not 0.
    const noisy = quatFromAxisAngle([1, 0, 0], degToRad(180));
    expect(noisy[3]).not.toBe(0);
    expect(quantiseQuat(noisy)).toEqual([1, 0, 0, 0]);
    expect(quantiseQuat(quatNormalise([1e-9, 0, 0, 1]))).toEqual([0, 0, 0, 1]);
  });

  it('returns null for input that is not a rotation', () => {
    expect(quantiseQuat([0, 0, 0, 0])).toBeNull();
    expect(quantiseQuatGrid([0, 0, 0, 0])).toBeNull();
    expect(quantiseQuat([Number.NaN, 0, 0, 1])).toBeNull();
    expect(quantiseQuat([0, Number.POSITIVE_INFINITY, 0, 1])).toBeNull();
    expect(quantiseQuat([1e-320, 0, 0, 0])).toEqual([1, 0, 0, 0]);
    expect(quantiseQuat([1e200, 0, 0, 1e200])).toEqual(quantiseQuat([1, 0, 0, 1]));
  });
});
