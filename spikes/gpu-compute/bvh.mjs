// CPU BVH builder (binned SAH, 16 bins, all three axes) over a triangle soup, typed arrays only.
// Node layout (32 bytes): f32 min.xyz, u32 leftFirst, f32 max.xyz, u32 count.  count>0 => leaf (leftFirst = first triangle),
// count==0 => interior (children at leftFirst and leftFirst+1).
// Triangle layout for the GPU (48 bytes): v0.xyz, primId(u32), e1.xyz, 0, e2.xyz, 0  (edges precomputed for Moller-Trumbore).

export function buildBVH(verts, nTri, { maxLeaf = 4, bins = 16 } = {}) {
  const t0 = performance.now();
  const cx = new Float32Array(nTri), cy = new Float32Array(nTri), cz = new Float32Array(nTri);
  const bmin = new Float32Array(nTri * 3), bmax = new Float32Array(nTri * 3);
  for (let i = 0; i < nTri; i++) {
    const b = i * 9;
    const x0 = verts[b], y0 = verts[b + 1], z0 = verts[b + 2], x1 = verts[b + 3], y1 = verts[b + 4], z1 = verts[b + 5], x2 = verts[b + 6], y2 = verts[b + 7], z2 = verts[b + 8];
    const mnx = Math.min(x0, x1, x2), mny = Math.min(y0, y1, y2), mnz = Math.min(z0, z1, z2);
    const mxx = Math.max(x0, x1, x2), mxy = Math.max(y0, y1, y2), mxz = Math.max(z0, z1, z2);
    bmin[i * 3] = mnx; bmin[i * 3 + 1] = mny; bmin[i * 3 + 2] = mnz; bmax[i * 3] = mxx; bmax[i * 3 + 1] = mxy; bmax[i * 3 + 2] = mxz;
    cx[i] = 0.5 * (mnx + mxx); cy[i] = 0.5 * (mny + mxy); cz[i] = 0.5 * (mnz + mxz);
  }
  const cen = [cx, cy, cz];
  const idx = new Uint32Array(nTri); for (let i = 0; i < nTri; i++) idx[i] = i;
  const nodeBuf = new ArrayBuffer(2 * nTri * 32);
  const nf = new Float32Array(nodeBuf), nu = new Uint32Array(nodeBuf);
  let used = 2; // node 0 = root, node 1 unused so sibling pairs share a 64-byte line
  const stack = new Int32Array(3 * 256), depthStack = new Int32Array(256); let sp = 1;
  stack[0] = 0; stack[1] = 0; stack[2] = nTri; depthStack[0] = 1;
  const bc = new Uint32Array(3 * bins), bb = new Float32Array(3 * bins * 6);
  const la = new Float32Array(bins), lc = new Uint32Array(bins);
  let maxDepth = 0, leaves = 0;
  while (sp > 0) {
    sp--;
    const node = stack[sp * 3], first = stack[sp * 3 + 1], count = stack[sp * 3 + 2], depth = depthStack[sp];
    if (depth > maxDepth) maxDepth = depth;
    let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
    let cmnx = Infinity, cmny = Infinity, cmnz = Infinity, cmxx = -Infinity, cmxy = -Infinity, cmxz = -Infinity;
    for (let k = first; k < first + count; k++) {
      const t = idx[k], t3 = t * 3;
      if (bmin[t3] < mnx) mnx = bmin[t3]; if (bmin[t3 + 1] < mny) mny = bmin[t3 + 1]; if (bmin[t3 + 2] < mnz) mnz = bmin[t3 + 2];
      if (bmax[t3] > mxx) mxx = bmax[t3]; if (bmax[t3 + 1] > mxy) mxy = bmax[t3 + 1]; if (bmax[t3 + 2] > mxz) mxz = bmax[t3 + 2];
      const x = cx[t], y = cy[t], z = cz[t];
      if (x < cmnx) cmnx = x; if (x > cmxx) cmxx = x; if (y < cmny) cmny = y; if (y > cmxy) cmxy = y; if (z < cmnz) cmnz = z; if (z > cmxz) cmxz = z;
    }
    const o = node * 8;
    nf[o] = mnx; nf[o + 1] = mny; nf[o + 2] = mnz; nf[o + 4] = mxx; nf[o + 5] = mxy; nf[o + 6] = mxz;
    if (count <= maxLeaf) { nu[o + 3] = first; nu[o + 7] = count; leaves++; continue; }
    bc.fill(0);
    for (let j = 0; j < bb.length; j += 6) { bb[j] = bb[j + 1] = bb[j + 2] = Infinity; bb[j + 3] = bb[j + 4] = bb[j + 5] = -Infinity; }
    const cmn = [cmnx, cmny, cmnz], ext = [cmxx - cmnx, cmxy - cmny, cmxz - cmnz];
    const sc = [ext[0] > 0 ? bins / ext[0] : 0, ext[1] > 0 ? bins / ext[1] : 0, ext[2] > 0 ? bins / ext[2] : 0];
    for (let k = first; k < first + count; k++) {
      const t = idx[k], t3 = t * 3;
      for (let a = 0; a < 3; a++) {
        if (sc[a] === 0) continue;
        let bi = ((cen[a][t] - cmn[a]) * sc[a]) | 0; if (bi >= bins) bi = bins - 1;
        const q = a * bins + bi;
        bc[q]++;
        const j = q * 6;
        if (bmin[t3] < bb[j]) bb[j] = bmin[t3]; if (bmin[t3 + 1] < bb[j + 1]) bb[j + 1] = bmin[t3 + 1]; if (bmin[t3 + 2] < bb[j + 2]) bb[j + 2] = bmin[t3 + 2];
        if (bmax[t3] > bb[j + 3]) bb[j + 3] = bmax[t3]; if (bmax[t3 + 1] > bb[j + 4]) bb[j + 4] = bmax[t3 + 1]; if (bmax[t3 + 2] > bb[j + 5]) bb[j + 5] = bmax[t3 + 2];
      }
    }
    let bestCost = Infinity, bestAxis = -1, bestBin = -1;
    for (let a = 0; a < 3; a++) {
      if (sc[a] === 0) continue;
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity, c = 0;
      for (let b = 0; b < bins - 1; b++) {
        const j = (a * bins + b) * 6; c += bc[a * bins + b];
        if (bb[j] < x0) x0 = bb[j]; if (bb[j + 1] < y0) y0 = bb[j + 1]; if (bb[j + 2] < z0) z0 = bb[j + 2];
        if (bb[j + 3] > x1) x1 = bb[j + 3]; if (bb[j + 4] > y1) y1 = bb[j + 4]; if (bb[j + 5] > z1) z1 = bb[j + 5];
        const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
        la[b] = c > 0 ? dx * dy + dy * dz + dz * dx : 0; lc[b] = c;
      }
      x0 = y0 = z0 = Infinity; x1 = y1 = z1 = -Infinity; c = 0;
      for (let b = bins - 1; b > 0; b--) {
        const j = (a * bins + b) * 6; c += bc[a * bins + b];
        if (bb[j] < x0) x0 = bb[j]; if (bb[j + 1] < y0) y0 = bb[j + 1]; if (bb[j + 2] < z0) z0 = bb[j + 2];
        if (bb[j + 3] > x1) x1 = bb[j + 3]; if (bb[j + 4] > y1) y1 = bb[j + 4]; if (bb[j + 5] > z1) z1 = bb[j + 5];
        const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
        const ra = c > 0 ? dx * dy + dy * dz + dz * dx : 0;
        if (lc[b - 1] > 0 && c > 0) {
          const cost = la[b - 1] * lc[b - 1] + ra * c;
          if (cost < bestCost) { bestCost = cost; bestAxis = a; bestBin = b; }
        }
      }
    }
    let mid;
    if (bestAxis < 0) {
      mid = first + (count >> 1); // all centroids coincide
    } else {
      const ca = cen[bestAxis], mn = cmn[bestAxis], s = sc[bestAxis];
      let i = first, j = first + count - 1;
      while (i <= j) {
        let bi = ((ca[idx[i]] - mn) * s) | 0; if (bi >= bins) bi = bins - 1;
        if (bi < bestBin) i++; else { const t = idx[i]; idx[i] = idx[j]; idx[j] = t; j--; }
      }
      mid = i;
      if (mid === first || mid === first + count) mid = first + (count >> 1);
    }
    const left = used; used += 2;
    nu[o + 3] = left; nu[o + 7] = 0;
    stack[sp * 3] = left + 1; stack[sp * 3 + 1] = mid; stack[sp * 3 + 2] = first + count - mid; depthStack[sp] = depth + 1; sp++;
    stack[sp * 3] = left; stack[sp * 3 + 1] = first; stack[sp * 3 + 2] = mid - first; depthStack[sp] = depth + 1; sp++;
  }
  const triBuf = new ArrayBuffer(nTri * 48);
  const tf = new Float32Array(triBuf), tu = new Uint32Array(triBuf);
  for (let k = 0; k < nTri; k++) {
    const t = idx[k], b = t * 9, o = k * 12;
    tf[o] = verts[b]; tf[o + 1] = verts[b + 1]; tf[o + 2] = verts[b + 2]; tu[o + 3] = t;
    tf[o + 4] = verts[b + 3] - verts[b]; tf[o + 5] = verts[b + 4] - verts[b + 1]; tf[o + 6] = verts[b + 5] - verts[b + 2];
    tf[o + 8] = verts[b + 6] - verts[b]; tf[o + 9] = verts[b + 7] - verts[b + 1]; tf[o + 10] = verts[b + 8] - verts[b + 2];
  }
  return {
    nodes: new Uint8Array(nodeBuf, 0, used * 32), nodeCount: used, nodeF32: nf, nodeU32: nu,
    tris: new Uint8Array(triBuf), triF32: tf, triU32: tu, nTri, maxDepth, leaves, buildMs: performance.now() - t0,
  };
}

/** JS reference closest-hit traversal (same algorithm as the WGSL kernel, float32 rounding aside). Returns [t, primId]. */
export function traceJS(bvh, ox, oy, oz, dx, dy, dz, tmin, tmax) {
  const nf = bvh.nodeF32, nu = bvh.nodeU32, tf = bvh.triF32, tu = bvh.triU32;
  const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
  const stack = new Uint32Array(64); let sp = 0, node = 0, best = tmax, prim = 0xffffffff;
  const slab = (n) => {
    const o = n * 8;
    let t0 = (nf[o] - ox) * ix, t1 = (nf[o + 4] - ox) * ix; let tn = Math.min(t0, t1), tfar = Math.max(t0, t1);
    t0 = (nf[o + 1] - oy) * iy; t1 = (nf[o + 5] - oy) * iy; tn = Math.max(tn, Math.min(t0, t1)); tfar = Math.min(tfar, Math.max(t0, t1));
    t0 = (nf[o + 2] - oz) * iz; t1 = (nf[o + 6] - oz) * iz; tn = Math.max(tn, Math.min(t0, t1)); tfar = Math.min(tfar, Math.max(t0, t1));
    tn = Math.max(tn, tmin); tfar = Math.min(tfar, best);
    return tn <= tfar ? tn : 1e30;
  };
  if (slab(0) === 1e30) return [tmax, prim];
  for (;;) {
    const o = node * 8, count = nu[o + 7];
    if (count > 0) {
      const first = nu[o + 3];
      for (let k = first; k < first + count; k++) {
        const q = k * 12;
        const e1x = tf[q + 4], e1y = tf[q + 5], e1z = tf[q + 6], e2x = tf[q + 8], e2y = tf[q + 9], e2z = tf[q + 10];
        const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
        const det = e1x * px + e1y * py + e1z * pz;
        if (Math.abs(det) < 1e-20) continue;
        const inv = 1 / det;
        const sx = ox - tf[q], sy = oy - tf[q + 1], sz = oz - tf[q + 2];
        const u = (sx * px + sy * py + sz * pz) * inv; if (u < 0 || u > 1) continue;
        const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
        const v = (dx * qx + dy * qy + dz * qz) * inv; if (v < 0 || u + v > 1) continue;
        const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (t > tmin && t < best) { best = t; prim = tu[q + 3]; }
      }
      if (sp === 0) break; node = stack[--sp];
    } else {
      const c1 = nu[o + 3], c2 = c1 + 1;
      const d1 = slab(c1), d2 = slab(c2);
      let near = c1, far = c2, dn = d1, df = d2;
      if (d2 < d1) { near = c2; far = c1; dn = d2; df = d1; }
      if (dn === 1e30) { if (sp === 0) break; node = stack[--sp]; }
      else { node = near; if (df !== 1e30) stack[sp++] = far; }
    }
  }
  return [best, prim];
}
