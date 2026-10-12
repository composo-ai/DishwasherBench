/**
 * A bounding-volume hierarchy over a triangle soup, built on the CPU with a binned surface-area
 * heuristic (16 bins on all three axes). Lifted from the GPU spike
 * (spikes/gpu-compute/bvh.mjs), where the same builder and the same traversal were measured.
 *
 * Node layout, 32 bytes, the `BvhNode` of docs/design/sim-core.md section 3.5
 * (`BVH_NODE_LAYOUT`): min xyz (3 x f32), leftOrFirst (u32), max xyz (3 x f32), count (u32).
 * `count > 0` is a leaf holding triangles `leftOrFirst .. leftOrFirst + count - 1` (in the order
 * of {@link Bvh.order}); `count == 0` is an interior node whose children are `leftOrFirst` and
 * `leftOrFirst + 1`. Node 0 is the root; node 1 is unused, so that siblings share a cache line.
 *
 * Boxes are computed from the f32 vertices and widened by {@link BVH_BOX_PAD}, so that neither
 * the f64 reference tracer nor the f32 kernel loses a triangle that lies in the face of its box.
 *
 * Units: metres, the frame of the vertices.
 */

/** Every node box is widened by this on all sides, metres. */
export const BVH_BOX_PAD = 1e-6;

/** Bytes per node. */
export const BVH_NODE_BYTES = 32;

/** Deepest tree the traversal stacks (64 entries) are sized for. */
export const BVH_MAX_DEPTH = 60;

/** A built hierarchy. */
export interface Bvh {
  /** The nodes, {@link BVH_NODE_BYTES} bytes each. */
  readonly nodes: ArrayBuffer;
  readonly nodeCount: number;
  /** Triangle indices in leaf order: leaf triangle `k` is input triangle `order[k]`. */
  readonly order: Uint32Array;
  readonly maxDepth: number;
  readonly leaves: number;
}

/** Options of {@link buildBvh}. */
export interface BvhOptions {
  /** Most triangles in a leaf; default 4. */
  readonly maxLeaf?: number;
  /** Bins per axis of the split search; default 16. */
  readonly bins?: number;
}

/**
 * Builds a hierarchy over `triangleCount` triangles given as nine f32 per triangle. The result
 * depends on the input only (no randomness, no clock). Throws a RangeError for an empty input.
 */
export function buildBvh(
  verts: Float32Array,
  triangleCount: number,
  options: BvhOptions = {},
): Bvh {
  const maxLeaf = options.maxLeaf ?? 4;
  const bins = options.bins ?? 16;
  const nTri = triangleCount;
  // A node without triangles would read as an interior node: there is no empty hierarchy.
  if (!(nTri > 0)) throw new RangeError('sim-scene: a hierarchy needs at least one triangle');
  const cx = new Float32Array(nTri);
  const cy = new Float32Array(nTri);
  const cz = new Float32Array(nTri);
  const bmin = new Float32Array(nTri * 3);
  const bmax = new Float32Array(nTri * 3);
  for (let i = 0; i < nTri; i++) {
    const b = i * 9;
    const x0 = verts[b] as number;
    const y0 = verts[b + 1] as number;
    const z0 = verts[b + 2] as number;
    const x1 = verts[b + 3] as number;
    const y1 = verts[b + 4] as number;
    const z1 = verts[b + 5] as number;
    const x2 = verts[b + 6] as number;
    const y2 = verts[b + 7] as number;
    const z2 = verts[b + 8] as number;
    const mnx = Math.min(x0, x1, x2);
    const mny = Math.min(y0, y1, y2);
    const mnz = Math.min(z0, z1, z2);
    const mxx = Math.max(x0, x1, x2);
    const mxy = Math.max(y0, y1, y2);
    const mxz = Math.max(z0, z1, z2);
    bmin[i * 3] = mnx;
    bmin[i * 3 + 1] = mny;
    bmin[i * 3 + 2] = mnz;
    bmax[i * 3] = mxx;
    bmax[i * 3 + 1] = mxy;
    bmax[i * 3 + 2] = mxz;
    cx[i] = 0.5 * (mnx + mxx);
    cy[i] = 0.5 * (mny + mxy);
    cz[i] = 0.5 * (mnz + mxz);
  }
  const cen = [cx, cy, cz];
  const idx = new Uint32Array(nTri);
  for (let i = 0; i < nTri; i++) idx[i] = i;
  const nodeBuf = new ArrayBuffer(Math.max(2, 2 * nTri + 2) * BVH_NODE_BYTES);
  const nf = new Float32Array(nodeBuf);
  const nu = new Uint32Array(nodeBuf);
  let used = 2;
  const stack: number[] = [0, 0, nTri, 1];
  const bc = new Uint32Array(3 * bins);
  const bb = new Float32Array(3 * bins * 6);
  const la = new Float32Array(bins);
  const lc = new Uint32Array(bins);
  let maxDepth = 0;
  let leaves = 0;
  while (stack.length > 0) {
    const depth = stack.pop() as number;
    const count = stack.pop() as number;
    const first = stack.pop() as number;
    const node = stack.pop() as number;
    if (depth > maxDepth) maxDepth = depth;
    let mnx = Infinity;
    let mny = Infinity;
    let mnz = Infinity;
    let mxx = -Infinity;
    let mxy = -Infinity;
    let mxz = -Infinity;
    let cmnx = Infinity;
    let cmny = Infinity;
    let cmnz = Infinity;
    let cmxx = -Infinity;
    let cmxy = -Infinity;
    let cmxz = -Infinity;
    for (let k = first; k < first + count; k++) {
      const t = idx[k] as number;
      const t3 = t * 3;
      if ((bmin[t3] as number) < mnx) mnx = bmin[t3] as number;
      if ((bmin[t3 + 1] as number) < mny) mny = bmin[t3 + 1] as number;
      if ((bmin[t3 + 2] as number) < mnz) mnz = bmin[t3 + 2] as number;
      if ((bmax[t3] as number) > mxx) mxx = bmax[t3] as number;
      if ((bmax[t3 + 1] as number) > mxy) mxy = bmax[t3 + 1] as number;
      if ((bmax[t3 + 2] as number) > mxz) mxz = bmax[t3 + 2] as number;
      const x = cx[t] as number;
      const y = cy[t] as number;
      const z = cz[t] as number;
      if (x < cmnx) cmnx = x;
      if (x > cmxx) cmxx = x;
      if (y < cmny) cmny = y;
      if (y > cmxy) cmxy = y;
      if (z < cmnz) cmnz = z;
      if (z > cmxz) cmxz = z;
    }
    const o = node * 8;
    nf[o] = mnx - BVH_BOX_PAD;
    nf[o + 1] = mny - BVH_BOX_PAD;
    nf[o + 2] = mnz - BVH_BOX_PAD;
    nf[o + 4] = mxx + BVH_BOX_PAD;
    nf[o + 5] = mxy + BVH_BOX_PAD;
    nf[o + 6] = mxz + BVH_BOX_PAD;
    if (count <= maxLeaf) {
      nu[o + 3] = first;
      nu[o + 7] = count;
      leaves++;
      continue;
    }
    bc.fill(0);
    for (let j = 0; j < bb.length; j += 6) {
      bb[j] = bb[j + 1] = bb[j + 2] = Infinity;
      bb[j + 3] = bb[j + 4] = bb[j + 5] = -Infinity;
    }
    const cmn = [cmnx, cmny, cmnz];
    const ext = [cmxx - cmnx, cmxy - cmny, cmxz - cmnz];
    const sc = ext.map((e) => (e > 0 ? bins / e : 0));
    for (let k = first; k < first + count; k++) {
      const t = idx[k] as number;
      const t3 = t * 3;
      for (let a = 0; a < 3; a++) {
        const s = sc[a] as number;
        if (s === 0) continue;
        let bi = ((((cen[a] as Float32Array)[t] as number) - (cmn[a] as number)) * s) | 0;
        if (bi >= bins) bi = bins - 1;
        const q = a * bins + bi;
        bc[q] = (bc[q] as number) + 1;
        const j = q * 6;
        if ((bmin[t3] as number) < (bb[j] as number)) bb[j] = bmin[t3] as number;
        if ((bmin[t3 + 1] as number) < (bb[j + 1] as number)) bb[j + 1] = bmin[t3 + 1] as number;
        if ((bmin[t3 + 2] as number) < (bb[j + 2] as number)) bb[j + 2] = bmin[t3 + 2] as number;
        if ((bmax[t3] as number) > (bb[j + 3] as number)) bb[j + 3] = bmax[t3] as number;
        if ((bmax[t3 + 1] as number) > (bb[j + 4] as number)) bb[j + 4] = bmax[t3 + 1] as number;
        if ((bmax[t3 + 2] as number) > (bb[j + 5] as number)) bb[j + 5] = bmax[t3 + 2] as number;
      }
    }
    let bestCost = Infinity;
    let bestAxis = -1;
    let bestBin = -1;
    for (let a = 0; a < 3; a++) {
      if ((sc[a] as number) === 0) continue;
      let x0 = Infinity;
      let y0 = Infinity;
      let z0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      let z1 = -Infinity;
      let c = 0;
      for (let b = 0; b < bins - 1; b++) {
        const j = (a * bins + b) * 6;
        c += bc[a * bins + b] as number;
        if ((bb[j] as number) < x0) x0 = bb[j] as number;
        if ((bb[j + 1] as number) < y0) y0 = bb[j + 1] as number;
        if ((bb[j + 2] as number) < z0) z0 = bb[j + 2] as number;
        if ((bb[j + 3] as number) > x1) x1 = bb[j + 3] as number;
        if ((bb[j + 4] as number) > y1) y1 = bb[j + 4] as number;
        if ((bb[j + 5] as number) > z1) z1 = bb[j + 5] as number;
        const dx = x1 - x0;
        const dy = y1 - y0;
        const dz = z1 - z0;
        la[b] = c > 0 ? dx * dy + dy * dz + dz * dx : 0;
        lc[b] = c;
      }
      x0 = y0 = z0 = Infinity;
      x1 = y1 = z1 = -Infinity;
      c = 0;
      for (let b = bins - 1; b > 0; b--) {
        const j = (a * bins + b) * 6;
        c += bc[a * bins + b] as number;
        if ((bb[j] as number) < x0) x0 = bb[j] as number;
        if ((bb[j + 1] as number) < y0) y0 = bb[j + 1] as number;
        if ((bb[j + 2] as number) < z0) z0 = bb[j + 2] as number;
        if ((bb[j + 3] as number) > x1) x1 = bb[j + 3] as number;
        if ((bb[j + 4] as number) > y1) y1 = bb[j + 4] as number;
        if ((bb[j + 5] as number) > z1) z1 = bb[j + 5] as number;
        const dx = x1 - x0;
        const dy = y1 - y0;
        const dz = z1 - z0;
        const ra = c > 0 ? dx * dy + dy * dz + dz * dx : 0;
        if ((lc[b - 1] as number) > 0 && c > 0) {
          const cost = (la[b - 1] as number) * (lc[b - 1] as number) + ra * c;
          if (cost < bestCost) {
            bestCost = cost;
            bestAxis = a;
            bestBin = b;
          }
        }
      }
    }
    let mid: number;
    if (bestAxis < 0) {
      // All centroids coincide.
      mid = first + (count >> 1);
    } else {
      const ca = cen[bestAxis] as Float32Array;
      const mn = cmn[bestAxis] as number;
      const s = sc[bestAxis] as number;
      let i = first;
      let j = first + count - 1;
      while (i <= j) {
        let bi = (((ca[idx[i] as number] as number) - mn) * s) | 0;
        if (bi >= bins) bi = bins - 1;
        if (bi < bestBin) {
          i++;
        } else {
          const t = idx[i] as number;
          idx[i] = idx[j] as number;
          idx[j] = t;
          j--;
        }
      }
      mid = i;
      if (mid === first || mid === first + count) mid = first + (count >> 1);
    }
    const left = used;
    used += 2;
    nu[o + 3] = left;
    nu[o + 7] = 0;
    stack.push(left + 1, mid, first + count - mid, depth + 1);
    stack.push(left, first, mid - first, depth + 1);
  }
  if (maxDepth > BVH_MAX_DEPTH) {
    throw new Error(`sim-scene: hierarchy of depth ${maxDepth} exceeds the traversal stack`);
  }
  return {
    nodes: nodeBuf.slice(0, used * BVH_NODE_BYTES),
    nodeCount: used,
    order: idx,
    maxDepth,
    leaves,
  };
}
