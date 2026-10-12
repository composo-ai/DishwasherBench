/**
 * Dispatch sizes for kernels that run one invocation per item of a long list
 * (docs/design/sim-core.md section M1). A dimension of a dispatch holds at most 65,535
 * workgroups, so a list longer than that many workgroups is laid out in rows: the kernel
 * computes its item index as `gid.y * row + gid.x` and returns if the index is past the end.
 */

/** Widest row used, in workgroups; below the WebGPU default limit of 65,535 per dimension. */
const MAX_ROW_WORKGROUPS = 32768;

/** A two-dimensional dispatch that covers a list of invocations. */
export interface DispatchGrid {
  /** Workgroup counts for `Dispatch.workgroups`. */
  readonly workgroups: readonly [x: number, y: number, z: number];
  /** Invocations per row: the factor of `gid.y` in the kernel's item index. */
  readonly row: number;
}

/**
 * The dispatch that gives at least `invocations` invocations to a kernel declared with
 * `@workgroup_size(workgroupSize)` (one-dimensional workgroups). Zero invocations give an empty
 * dispatch.
 */
export function dispatchGrid(invocations: number, workgroupSize: number): DispatchGrid {
  if (!Number.isInteger(invocations) || invocations < 0) {
    throw new RangeError(`${invocations} invocations cannot be dispatched`);
  }
  if (!Number.isInteger(workgroupSize) || workgroupSize < 1) {
    throw new RangeError(`workgroup size ${workgroupSize}`);
  }
  const groups = Math.ceil(invocations / workgroupSize);
  const x = Math.min(Math.max(groups, 1), MAX_ROW_WORKGROUPS);
  const y = Math.ceil(groups / x);
  if (y > 65535) throw new RangeError(`${invocations} invocations exceed one dispatch`);
  return { workgroups: [groups === 0 ? 0 : x, y, groups === 0 ? 0 : 1], row: x * workgroupSize };
}
