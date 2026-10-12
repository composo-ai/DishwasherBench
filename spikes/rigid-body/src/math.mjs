// Minimal vector / quaternion helpers. Quaternions are [x, y, z, w]. SI units, Y up.
import { createHash } from 'node:crypto';

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => scale(a, 1 / len(a));

export const qIdentity = () => [0, 0, 0, 1];
export function qAxisAngle(axis, angle) {
  const n = norm(axis);
  const s = Math.sin(angle / 2);
  return [n[0] * s, n[1] * s, n[2] * s, Math.cos(angle / 2)];
}
export function qMul(a, b) {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}
export const qConj = (q) => [-q[0], -q[1], -q[2], q[3]];
export function qNorm(q) {
  const l = Math.hypot(q[0], q[1], q[2], q[3]);
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}
export function qRot(q, v) {
  // v' = v + 2*w*(u x v) + 2*u x (u x v)
  const u = [q[0], q[1], q[2]];
  const w = q[3];
  const t = scale(cross(u, v), 2);
  return add(add(v, scale(t, w)), cross(u, t));
}
/** Angle (rad) of the relative rotation between two (nearly unit) quaternions; accurate near zero. */
export function qAngleBetween(a, b) {
  const r = qMul(qConj(qNorm(a)), qNorm(b));
  const s = Math.hypot(r[0], r[1], r[2]);
  return 2 * Math.atan2(s, Math.abs(r[3]));
}
/** Rotation taking the Y axis to the given direction (capsule alignment). */
export function qFromYTo(dir) {
  const d = norm(dir);
  const c = d[1];
  if (c > 1 - 1e-12) return [0, 0, 0, 1];
  if (c < -1 + 1e-12) return [1, 0, 0, 0];
  const ax = cross([0, 1, 0], d);
  return qAxisAngle(ax, Math.acos(c));
}

/** Transform a flat xyz array by (pos, quat) and return a new Float64Array. */
export function transformPoints(pts, pos, q) {
  const out = new Float64Array(pts.length);
  for (let i = 0; i < pts.length; i += 3) {
    const p = qRot(q, [pts[i], pts[i + 1], pts[i + 2]]);
    out[i] = p[0] + pos[0];
    out[i + 1] = p[1] + pos[1];
    out[i + 2] = p[2] + pos[2];
  }
  return out;
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** SHA-256 of the raw bytes of a Float64Array (bitwise determinism check). */
export function hashF64(arr) {
  const u8 = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  return createHash('sha256').update(u8).digest('hex').slice(0, 16);
}

export function quantile(sorted, q) {
  if (!sorted.length) return NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[i];
}
export function stats(xs) {
  const s = Float64Array.from(xs).sort();
  const mean = s.reduce((a, b) => a + b, 0) / (s.length || 1);
  return { n: s.length, mean, min: s[0], p50: quantile(s, 0.5), p99: quantile(s, 0.99), max: s[s.length - 1] };
}
