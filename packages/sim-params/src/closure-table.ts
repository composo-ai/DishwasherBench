/**
 * Closure tables (docs/design/sim-core.md section M2): regular grids evaluated by clamped
 * multilinear interpolation, on the CPU in f64 (`evalClosureTable`) and in kernels by a WGSL
 * function generated from the same table (`emitClosureTableWgsl`) that reads the grid with
 * explicit loads and interpolates by hand (determinism rule 10: no hardware filtering). They are
 * the plug-in point of the offline closure campaign (section 11.2). The default content of the
 * named tables belongs to the modules that use them.
 *
 * "Clamped": a coordinate outside an axis is moved to the nearest end of it, so the table
 * extends as a constant. An axis with a single coordinate is allowed and contributes nothing.
 * Axis coordinates need not be evenly spaced. A table holds its axis coordinates rounded to f32,
 * the grid the kernel reads, so that both back ends choose the same interval and fraction; the
 * grid values stay f64 on the CPU and are rounded when packed.
 *
 * Packed form (what a kernel binds): one f32 array holding, for each table, the coordinates of
 * each axis in order and then the grid values in row-major order (last axis fastest). The array
 * is bound as a storage buffer, or written row by row into an `r32float` texture.
 */
import { bytesToHex, sha256 } from '@spotless/core';
import { compareKeys } from './registry.ts';
import type { ClosureTable } from './types.ts';

/** Largest number of axes of a closure table. */
export const MAX_CLOSURE_TABLE_AXES = 4;

/** Thrown for a malformed table or a lookup with the wrong number of coordinates. */
export class ClosureTableError extends Error {
  override readonly name = 'ClosureTableError';
}

/**
 * Validates and freezes a closure table: 1 to {@link MAX_CLOSURE_TABLE_AXES} axes, each with at
 * least one finite coordinate, strictly increasing after rounding to f32; as many finite data
 * values as grid points. The table returned holds the rounded coordinates. Throws
 * `ClosureTableError` otherwise.
 */
export function createClosureTable(table: ClosureTable): ClosureTable {
  const fail = (what: string): never => {
    throw new ClosureTableError(`closure table ${table.id}: ${what}`);
  };
  if (table.axes.length < 1 || table.axes.length > MAX_CLOSURE_TABLE_AXES) {
    fail(`1 to ${MAX_CLOSURE_TABLE_AXES} axes are supported`);
  }
  let points = 1;
  for (const axis of table.axes) {
    if (axis.values.length < 1) fail(`axis ${axis.name} is empty`);
    for (let i = 0; i < axis.values.length; i++) {
      const v = Math.fround(axis.values[i] as number);
      if (!Number.isFinite(v)) fail(`axis ${axis.name} has a non-finite coordinate`);
      // Two coordinates that are equal in f32 give the kernel an empty interval (0 / 0).
      if (i > 0 && !(v > Math.fround(axis.values[i - 1] as number))) {
        fail(`axis ${axis.name} is not strictly increasing in f32`);
      }
    }
    points *= axis.values.length;
  }
  if (table.data.length !== points) fail(`expected ${points} values, got ${table.data.length}`);
  if (table.data.some((v) => !Number.isFinite(v))) fail('a value is not finite');
  return Object.freeze({
    id: table.id,
    axes: table.axes.map((a) =>
      Object.freeze({
        name: a.name,
        unit: a.unit,
        values: Float64Array.from(a.values, Math.fround),
      }),
    ),
    data: Float64Array.from(table.data),
    unit: table.unit,
    provenance: table.provenance,
  });
}

/**
 * Builds a table by evaluating `f` at every grid point: how a module states the analytic default
 * of a named table. `f` receives the coordinates in axis order, rounded to f32 as the table
 * holds them.
 */
export function tabulateClosure(
  header: Pick<ClosureTable, 'id' | 'axes' | 'unit' | 'provenance'>,
  f: (...coords: number[]) => number,
): ClosureTable {
  const shape = header.axes.map((a) => a.values.length);
  const total = shape.reduce((p, n) => p * n, 1);
  const data = new Float64Array(total);
  const index = new Array<number>(shape.length).fill(0);
  for (let flat = 0; flat < total; flat++) {
    data[flat] = f(
      ...index.map((i, d) =>
        Math.fround((header.axes[d] as { values: Float64Array }).values[i] as number),
      ),
    );
    for (let d = shape.length - 1; d >= 0; d--) {
      index[d] = (index[d] as number) + 1;
      if ((index[d] as number) < (shape[d] as number)) break;
      index[d] = 0;
    }
  }
  return createClosureTable({ ...header, data });
}

/** Lower grid index and fraction of a clamped coordinate on one axis. */
function locate(values: Float64Array, x: number): { i: number; t: number } {
  const n = values.length;
  if (n === 1) return { i: 0, t: 0 };
  // The largest i in [0, n - 2] with values[i] <= x, or 0: the same rule as the WGSL search.
  let lo = 0;
  let hi = n - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (x >= (values[mid] as number)) lo = mid;
    else hi = mid - 1;
  }
  const a = values[lo] as number;
  const b = values[lo + 1] as number;
  return { i: lo, t: Math.min(Math.max((x - a) / (b - a), 0), 1) };
}

/**
 * Clamped multilinear interpolation of a table at `coords` (one per axis, in the axis units),
 * in f64. This is the reference of the generated WGSL function. Throws `ClosureTableError` when
 * the number of coordinates differs from the number of axes or a coordinate is NaN.
 */
export function evalClosureTable(table: ClosureTable, coords: readonly number[]): number {
  const nAxes = table.axes.length;
  if (coords.length !== nAxes) {
    throw new ClosureTableError(`closure table ${table.id}: expected ${nAxes} coordinates`);
  }
  let size = 1;
  const strides = new Array<number>(nAxes).fill(1);
  for (let d = nAxes - 1; d >= 0; d--) {
    strides[d] = size;
    size *= (table.axes[d] as { values: Float64Array }).values.length;
  }
  let base = 0;
  const fractions: number[] = [];
  const steps: number[] = [];
  for (let d = 0; d < nAxes; d++) {
    const x = coords[d] as number;
    if (Number.isNaN(x)) throw new ClosureTableError(`closure table ${table.id}: NaN coordinate`);
    const values = (table.axes[d] as { values: Float64Array }).values;
    const { i, t } = locate(values, x);
    base += i * (strides[d] as number);
    fractions.push(t);
    steps.push(values.length > 1 ? (strides[d] as number) : 0);
  }
  // Corner values, then reduce the last axis first (the order of the WGSL function).
  let level = new Array<number>(1 << nAxes);
  for (let corner = 0; corner < level.length; corner++) {
    let offset = base;
    for (let d = 0; d < nAxes; d++) {
      if ((corner >> (nAxes - 1 - d)) & 1) offset += steps[d] as number;
    }
    level[corner] = table.data[offset] as number;
  }
  for (let d = nAxes - 1; d >= 0; d--) {
    const t = fractions[d] as number;
    const next = new Array<number>(level.length >> 1);
    for (let k = 0; k < next.length; k++) {
      const a = level[2 * k] as number;
      const b = level[2 * k + 1] as number;
      // This form returns a at t = 0 and b at t = 1 exactly, so knots reproduce the table.
      next[k] = a * (1 - t) + b * t;
    }
    level = next;
  }
  return level[0] as number;
}

/** Where one table sits in a packed array. */
export interface PackedTableEntry {
  /** The table. */
  readonly table: ClosureTable;
  /** Index of the first coordinate of each axis in the packed array. */
  readonly axisOffsets: readonly number[];
  /** Index of the first grid value in the packed array. */
  readonly dataOffset: number;
}

/** Several closure tables packed into one f32 array for a kernel. */
export interface PackedClosureTables {
  /** Axis coordinates and grid values of every table, as f32. */
  readonly data: Float32Array;
  /** Position of each table, by id. */
  readonly entries: Readonly<Record<string, PackedTableEntry>>;
  /** `sha256:` hash of the little-endian bytes of `data` and of the table shapes. */
  readonly hash: string;
}

/**
 * Packs tables into one f32 array, in order of id (so the packing does not depend on the order
 * of the argument). Throws `ClosureTableError` on a duplicate id.
 */
export function packClosureTables(tables: readonly ClosureTable[]): PackedClosureTables {
  const sorted = [...tables].sort((a, b) => compareKeys(a.id, b.id));
  const entries: Record<string, PackedTableEntry> = {};
  const values: number[] = [];
  const shapes: string[] = [];
  for (const table of sorted) {
    if (entries[table.id]) throw new ClosureTableError(`closure table ${table.id} is packed twice`);
    const axisOffsets: number[] = [];
    for (const axis of table.axes) {
      axisOffsets.push(values.length);
      for (const v of axis.values) values.push(v);
    }
    const dataOffset = values.length;
    for (const v of table.data) values.push(v);
    entries[table.id] = { table, axisOffsets, dataOffset };
    shapes.push(`${table.id}:${table.axes.map((a) => a.values.length).join('x')}@${dataOffset}`);
  }
  const data = Float32Array.from(values);
  const head = new TextEncoder().encode(shapes.join(';'));
  const bytes = new Uint8Array(head.length + data.byteLength);
  bytes.set(head, 0);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < data.length; i++)
    view.setFloat32(head.length + 4 * i, data[i] as number, true);
  return { data, entries, hash: `sha256:${bytesToHex(sha256(bytes))}` };
}

/**
 * How generated WGSL loads element i of the packed array: from a storage buffer
 * `var<storage, read> name: array<f32>`, or from an `r32float` `texture_2d<f32>` of the given
 * width in which element i is texel (i mod width, i div width) of mip level 0.
 */
export type ClosureTableAccess =
  | { readonly kind: 'buffer'; readonly name: string }
  | { readonly kind: 'texture'; readonly name: string; readonly width: number };

/**
 * Size of the `r32float` texture that holds a packed array of `length` elements at `width`
 * texels per row, and the array padded with zeros to fill it.
 */
export function closureTableTexture(
  data: Float32Array,
  width: number,
): { readonly width: number; readonly height: number; readonly texels: Float32Array } {
  const height = Math.max(1, Math.ceil(data.length / width));
  const texels = new Float32Array(width * height);
  texels.set(data);
  return { width, height, texels };
}

/**
 * WGSL helpers shared by every table function that uses one access: `<prefix>_fetch(i)` loads an
 * element, `<prefix>_axis(x, base, count)` returns the lower grid index and the fraction of a
 * clamped coordinate. Emit once per access, before the table functions.
 */
export function emitClosureTableHelpersWgsl(access: ClosureTableAccess, prefix: string): string {
  const load =
    access.kind === 'buffer'
      ? `${access.name}[i]`
      : `textureLoad(${access.name}, vec2<u32>(i % ${access.width}u, i / ${access.width}u), 0).x`;
  return `// literal-ok-begin: generated closure-table access (texture width)
fn ${prefix}_fetch(i: u32) -> f32 {
  return ${load};
}
// literal-ok-end

// Lower grid index (as f32) and fraction of x on the axis stored at [base, base + count).
fn ${prefix}_axis(x: f32, base: u32, count: u32) -> vec2<f32> {
  var lo = 0u;
  for (var k = 1u; k + 1u < count; k = k + 1u) {
    if (x >= ${prefix}_fetch(base + k)) {
      lo = k;
    }
  }
  let a = ${prefix}_fetch(base + lo);
  let b = ${prefix}_fetch(base + lo + 1u);
  return vec2<f32>(f32(lo), clamp((x - a) / (b - a), 0.0, 1.0));
}
`;
}

/**
 * WGSL function `fnName(x0: f32, ...) -> f32` that evaluates one packed table by the same
 * clamped multilinear interpolation as {@link evalClosureTable} (brief of M2, item 5). It calls
 * the helpers of {@link emitClosureTableHelpersWgsl} with the same `prefix`. The table shape
 * and offsets are compile-time integers of the generated text.
 */
export function emitClosureTableWgsl(
  entry: PackedTableEntry,
  fnName: string,
  prefix: string,
): string {
  const { table, axisOffsets, dataOffset } = entry;
  const nAxes = table.axes.length;
  const counts = table.axes.map((a) => a.values.length);
  const strides = new Array<number>(nAxes).fill(1);
  for (let d = nAxes - 2; d >= 0; d--) {
    strides[d] = (strides[d + 1] as number) * (counts[d + 1] as number);
  }
  const lines: string[] = [];
  lines.push(
    `// Closure table ${table.id} [${table.unit}] over (${table.axes.map((a) => `${a.name} [${a.unit}]`).join(', ')}).`,
  );
  lines.push(`// literal-ok-begin: generated closure-table shape and offsets`);
  lines.push(`fn ${fnName}(${table.axes.map((_, d) => `x${d}: f32`).join(', ')}) -> f32 {`);
  const baseTerms = [`${dataOffset}u`];
  for (let d = 0; d < nAxes; d++) {
    if ((counts[d] as number) > 1) {
      lines.push(`  let a${d} = ${prefix}_axis(x${d}, ${axisOffsets[d]}u, ${counts[d]}u);`);
      baseTerms.push(`u32(a${d}.x) * ${strides[d]}u`);
    }
  }
  lines.push(`  let base = ${baseTerms.join(' + ')};`);
  let level: string[] = [];
  for (let corner = 0; corner < 1 << nAxes; corner++) {
    let offset = 0;
    for (let d = 0; d < nAxes; d++) {
      if (((corner >> (nAxes - 1 - d)) & 1) === 1 && (counts[d] as number) > 1) {
        offset += strides[d] as number;
      }
    }
    lines.push(`  let c${corner} = ${prefix}_fetch(base + ${offset}u);`);
    level.push(`c${corner}`);
  }
  for (let d = nAxes - 1; d >= 0; d--) {
    const t = (counts[d] as number) > 1 ? `a${d}.y` : '0.0';
    const next: string[] = [];
    for (let k = 0; k < level.length / 2; k++) {
      const name = `m${d}_${k}`;
      lines.push(`  let ${name} = ${level[2 * k]} * (1.0 - ${t}) + ${level[2 * k + 1]} * ${t};`);
      next.push(name);
    }
    level = next;
  }
  lines.push(`  return ${level[0]};`);
  lines.push('}');
  lines.push('// literal-ok-end');
  return `${lines.join('\n')}\n`;
}
