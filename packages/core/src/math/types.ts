/**
 * Plain-tuple math types shared by every Spotless package.
 *
 * All values are SI (metres, radians) unless a name says otherwise. All frames are right-handed
 * with z up. The types are read-only tuples so that shared data (catalogue shapes, cached poses)
 * cannot be mutated by accident; every operation in this package returns a new tuple.
 */

/** A 3-vector `[x, y, z]`. Units depend on use (metres for positions). */
export type Vec3 = readonly [x: number, y: number, z: number];

/**
 * A quaternion `[x, y, z, w]` (vector part first, scalar part last). Rotations are unit
 * quaternions. This is the internal order; the wire order is {@link QuatWxyz}.
 */
export type Quat = readonly [x: number, y: number, z: number, w: number];

/**
 * A quaternion in wire order `[w, x, y, z]`, used only in API payloads (fields named
 * `quat_wxyz`). Convert with `quatToWire` / `quatFromWire` at the API boundary and nowhere else.
 */
export type QuatWxyz = readonly [w: number, x: number, y: number, z: number];

/**
 * A rigid transform from a child frame to its parent frame:
 * `x_parent = p + rotate(q, x_child)`. `p` is in metres, `q` is a unit quaternion.
 */
export interface Pose {
  /** Position of the child-frame origin expressed in the parent frame, metres. */
  readonly p: Vec3;
  /** Orientation of the child frame relative to the parent frame: unit quaternion `[x, y, z, w]`. */
  readonly q: Quat;
}

/**
 * A 3x3 matrix in row-major order:
 * `[m00, m01, m02, m10, m11, m12, m20, m21, m22]`, so element (row i, column j) is `m[3 * i + j]`.
 * Note that Three.js stores `Matrix3.elements` column-major; transpose when handing one over.
 */
export type Mat3 = readonly [
  m00: number,
  m01: number,
  m02: number,
  m10: number,
  m11: number,
  m12: number,
  m20: number,
  m21: number,
  m22: number,
];
