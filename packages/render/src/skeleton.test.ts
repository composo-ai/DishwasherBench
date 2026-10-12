// Workspace wiring smoke test created by the platform scaffold. The package owner may replace it
// with real tests; keep at least one test in the package so `pnpm test` exercises it.
import {
  poseTransformPoint,
  quatFromEulerXYZ,
  quatSlerp,
  quatToMat3,
  v3Length,
  type Quat,
} from '@spotless/core';
import * as geometry from '@spotless/geometry';
import { PNG } from 'pngjs';
import { launch } from 'puppeteer-core';
import { Euler, Matrix3, Matrix4, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import * as api from './index.ts';

describe('@spotless/render skeleton', () => {
  it('loads its entry point and workspace dependencies', () => {
    expect(typeof api).toBe('object');
    // 0.1 mm, platform.md section 4.2.
    expect(geometry.RENDER_CHORD_ERROR).toBe(0.0001);
  });

  it('loads three and agrees with @spotless/core on a vector length', () => {
    // |(1, 2, 3)| = sqrt(14); both compute in f64, tolerance 1e-12.
    expect(new Vector3(1, 2, 3).length()).toBeCloseTo(v3Length([1, 2, 3]), 12);
    // Three.js quaternions are (x, y, z, w), the same order as the internal Quat.
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI);
    expect(q.z).toBeCloseTo(1, 12);
    expect(q.w).toBeCloseTo(0, 12);
  });

  it('core rotations follow the Three.js conventions: Euler order XYZ, slerp, poses (1e-14)', () => {
    // Deterministic inputs from a 32-bit linear congruential sequence (unrelated to core's rng).
    let state = 2026;
    const next = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const unitQuat = (): Quat => {
      const q = new Quaternion(next() - 0.5, next() - 0.5, next() - 0.5, next() - 0.5).normalize();
      return [q.x, q.y, q.z, q.w];
    };
    let worst = 0;
    for (let i = 0; i < 200; i++) {
      // quatFromEulerXYZ(rx, ry, rz) is Three's Euler(rx, ry, rz, 'XYZ').
      const [rx, ry, rz] = [6 * (next() - 0.5), 3 * (next() - 0.5), 6 * (next() - 0.5)];
      const e = new Quaternion().setFromEuler(new Euler(rx, ry, rz, 'XYZ'));
      const c = quatFromEulerXYZ(rx, ry, rz);
      worst = Math.max(worst, Math.hypot(e.x - c[0], e.y - c[1], e.z - c[2], e.w - c[3]));

      // Slerp agrees component by component (both take the shorter arc).
      const [a, b, t] = [unitQuat(), unitQuat(), next()];
      const s = new Quaternion(...a).slerp(new Quaternion(...b), t);
      const cs = quatSlerp(a, b, t);
      worst = Math.max(worst, Math.hypot(s.x - cs[0], s.y - cs[1], s.z - cs[2], s.w - cs[3]));

      // A core Pose is Three's Matrix4.compose(p, q, unit scale) applied to a point.
      const p: [number, number, number] = [next(), next(), next()];
      const x = new Vector3(next(), next(), next());
      const m = new Matrix4().compose(
        new Vector3(...p),
        new Quaternion(...a),
        new Vector3(1, 1, 1),
      );
      const viaThree = x.clone().applyMatrix4(m);
      const viaCore = poseTransformPoint({ p, q: a }, [x.x, x.y, x.z]);
      worst = Math.max(
        worst,
        Math.hypot(viaThree.x - viaCore[0], viaThree.y - viaCore[1], viaThree.z - viaCore[2]),
      );
    }
    expect(worst).toBeLessThanOrEqual(1e-14);
  });

  it('core Mat3 is row-major and Three.js Matrix3.elements column-major: transpose to convert', () => {
    // A quarter turn about +z maps +x to +y: element (row 1, column 0) is 1.
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2);
    const three = new Matrix3().setFromMatrix4(new Matrix4().makeRotationFromQuaternion(q));
    const core = quatToMat3([q.x, q.y, q.z, q.w]);
    expect(core[3]).toBeCloseTo(1, 15);
    expect(three.elements[1]).toBeCloseTo(1, 15);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        expect(three.elements[3 * col + row]).toBeCloseTo(core[3 * row + col] as number, 15);
      }
    }
  });

  it('round-trips a PNG through pngjs', () => {
    const png = new PNG({ width: 2, height: 1 });
    png.data.set([255, 0, 0, 255, 0, 128, 255, 255]);
    const decoded = PNG.sync.read(PNG.sync.write(png));
    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(1);
    expect([...decoded.data]).toEqual([255, 0, 0, 255, 0, 128, 255, 255]);
  });

  it('loads puppeteer-core', () => {
    expect(typeof launch).toBe('function');
  });
});
