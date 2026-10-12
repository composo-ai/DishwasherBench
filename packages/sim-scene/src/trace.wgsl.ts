/**
 * The ray kernel of the scene in WGSL: for every ray or segment of a batch the closest hit on
 * the triangle hierarchy, corrected to the analytic surface and mapped to its block and soil
 * cell (docs/design/sim-core.md sections 3.5 and 3.6, in the first-build form of
 * docs/design/scope.md). It performs in f32 the steps that `trace-cpu.ts` defines in f64; read
 * that file for the method.
 *
 * Bindings (group 0): 0 the uniform block {@link TRACE_PARAMS_BYTES} bytes long, 1 the hierarchy
 * nodes, 2 the triangles, 3 the packed tables (surfs, frames, patches, rows, cells, soil), 4 the
 * rays, 5 the hits. One invocation per ray; ray `gid.y * row + gid.x`.
 *
 * The traversal is the stack-based closest-hit kernel measured in the GPU spike
 * (spikes/gpu-compute/b3a_bvh.mjs) with four changes: the triangle test is the watertight one
 * of Woop, Benthin and Wald (in f32 the spike's test lets about one ray in 10^5 slip between two
 * triangles of one surface), triangles are struck from outside only, a triangle of a porous part
 * is skipped by the counter-based hash, and several roots are traversed in turn, each with the
 * ray in the root's frame.
 *
 * Every tolerance comes in through the uniform block; the literals left here are structural
 * (record sizes, bit positions, the stack depth) and are marked for the literal lint of
 * `@spotless/sim-params`.
 */

import { MAX_TRACE_ROOTS, PATCH_WORDS, SURF_WORDS } from './trace-data.ts';

/** Invocations per workgroup of the kernel. */
export const TRACE_WORKGROUP = 64; // literal-ok: invocations per workgroup

/** Words of the uniform block before the roots. */
export const TRACE_PARAMS_HEADER_WORDS = 20; // literal-ok: size of the header in words

/** Size of the uniform block of the kernel, bytes: the header and {@link MAX_TRACE_ROOTS} roots. */
export const TRACE_PARAMS_BYTES = 4 * TRACE_PARAMS_HEADER_WORDS + 64 * MAX_TRACE_ROOTS; // literal-ok: sizes in bytes

/** The WGSL source of the kernel, before `#include` lines are resolved. */
export const TRACE_WGSL = /* wgsl */ `
#include "rng"

struct Node { mn: vec3f, leftFirst: u32, mx: vec3f, count: u32 };
struct Tri { v0: vec3f, surf: u32, v1: vec3f, grid: u32, v2: vec3f, porous: u32 };
struct Ray { o: vec3f, tMax: f32, d: vec3f, key: u32 };
struct Hit { t: f32, block: u32, soil: u32, tri: u32, n: vec3f, cosInc: f32 };
struct Root { r0: vec4f, r1: vec4f, r2: vec4f, node: u32, pad0: u32, pad1: u32, pad2: u32 };
struct Params {
  count: u32, row: u32, seed: u32, keyBase: u32,
  rootCount: u32, patchBase: u32, rowBase: u32, cellBase: u32,
  soilBase: u32, newtonSteps: u32, maxSwitches: u32, backStep: f32,
  detMin: f32, acceptResidual: f32, maxStep: f32, minSlope: f32,
  quarterBase: u32, pad0: u32, pad1: u32, pad2: u32,
  roots: array<Root, ${MAX_TRACE_ROOTS}>,
};
struct Found { t: f32, tri: u32 };
struct Eval { f: f32, g: vec3f, param: f32 };

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> nodes: array<Node>;
@group(0) @binding(2) var<storage, read> tris: array<Tri>;
@group(0) @binding(3) var<storage, read> T: array<u32>;
@group(0) @binding(4) var<storage, read> rays: array<Ray>;
@group(0) @binding(5) var<storage, read_write> hits: array<Hit>;

const NONE = 0xffffffffu;
const FAR = 1e30; // literal-ok: sentinel of "no intersection", larger than any distance
const TINY = 1e-30; // literal-ok: stands in for a zero direction component before it is inverted
const TWO_PI = 6.283185307179586;
const SURF_WORDS = ${SURF_WORDS}u;
const PATCH_WORDS = ${PATCH_WORDS}u;

fn tf(i: u32) -> f32 {
  return bitcast<f32>(T[i]);
}

fn frameRow(o: u32, k: u32) -> vec4f {
  let b = o + 4u * k;
  return vec4f(tf(b), tf(b + 1u), tf(b + 2u), tf(b + 3u));
}

fn slab(i: u32, o: vec3f, inv: vec3f, tmax: f32) -> f32 {
  let t0 = (nodes[i].mn - o) * inv;
  let t1 = (nodes[i].mx - o) * inv;
  let a = min(t0, t1);
  let b = max(t0, t1);
  let tn = max(max(a.x, a.y), max(a.z, 0.0));
  let tfar = min(min(b.x, b.y), min(b.z, tmax));
  return select(FAR, tn, tn <= tfar);
}

// The components of v in the order (kx, ky, kz) of the sheared frame of a ray.
fn permute(v: vec3f, kz: u32, flip: bool) -> vec3f {
  var p = v;
  if (kz == 0u) {
    p = v.yzx;
  } else if (kz == 1u) {
    p = v.zxy;
  }
  if (flip) { p = p.yxz; }
  return p;
}

// Closest triangle of one hierarchy struck from outside within tmax, with the ray in its frame.
fn traverse(root: u32, o: vec3f, d: vec3f, tmax: f32, key: u32) -> Found {
  let safe = select(d, select(vec3f(TINY), vec3f(-TINY), d < vec3f(0.0)), abs(d) < vec3f(TINY));
  let inv = 1.0 / safe;
  // The sheared frame of the watertight triangle test (Woop, Benthin and Wald 2013).
  let ad = abs(d);
  var kz = 2u;
  if (ad.x >= ad.y && ad.x >= ad.z) {
    kz = 0u;
  } else if (ad.y >= ad.z) {
    kz = 1u;
  }
  let flip = d[kz] < 0.0;
  let dp = permute(d, kz, flip);
  let op = permute(o, kz, flip);
  let shear = vec3f(dp.x / dp.z, dp.y / dp.z, 1.0 / dp.z);
  var best = tmax;
  var prim = NONE;
  var stack: array<u32, 64>; // literal-ok: traversal stack, deeper than any hierarchy built
  var sp = 0u;
  var node = root;
  if (slab(root, o, inv, best) < FAR) {
    loop {
      let cnt = nodes[node].count;
      let lf = nodes[node].leftFirst;
      if (cnt > 0u) {
        for (var k = lf; k < lf + cnt; k++) {
          let tri = tris[k];
          // Vertices relative to the origin, sheared so that the ray runs along z. A vertex two
          // triangles share is sheared to the same point for both, so no ray slips between them.
          let a = permute(tri.v0, kz, flip) - op;
          let b = permute(tri.v1, kz, flip) - op;
          let c = permute(tri.v2, kz, flip) - op;
          let ax = a.x - shear.x * a.z;
          let ay = a.y - shear.y * a.z;
          let bx = b.x - shear.x * b.z;
          let by = b.y - shear.y * b.z;
          let cx = c.x - shear.x * c.z;
          let cy = c.y - shear.y * c.z;
          let eu = cx * by - cy * bx;
          let ev = ax * cy - ay * cx;
          let ew = bx * ay - by * ax;
          let det = eu + ev + ew;
          if (eu >= 0.0 && ev >= 0.0 && ew >= 0.0 && det > P.detMin) {
            let t = shear.z * (eu * a.z + ev * b.z + ew * c.z) / det;
            if (t >= 0.0 && t < best) {
              var passes = false;
              if (tri.porous != 0u) {
                let open = tri.porous >> 24u; // literal-ok: bit position of the open fraction
                let draw = rng_hash2(P.seed, key, tri.porous & 0xffffffu) >> 24u; // literal-ok: top byte of the hash
                passes = draw < open;
              }
              if (!passes) {
                best = t;
                prim = k;
              }
            }
          }
        }
        if (sp == 0u) { break; }
        sp--;
        node = stack[sp];
      } else {
        let d1 = slab(lf, o, inv, best);
        let d2 = slab(lf + 1u, o, inv, best);
        var near = lf;
        var far = lf + 1u;
        var dn = d1;
        var df = d2;
        if (d2 < d1) {
          near = lf + 1u;
          far = lf;
          dn = d2;
          df = d1;
        }
        if (dn >= FAR) {
          if (sp == 0u) { break; }
          sp--;
          node = stack[sp];
        } else {
          node = near;
          if (df < FAR) {
            stack[sp] = far;
            sp++;
          }
        }
      }
    }
  }
  return Found(best, prim);
}

// Implicit function, gradient and parameter of an analytic piece at a point of its frame.
fn evalSurf(surf: u32, x: vec3f) -> Eval {
  let o = SURF_WORDS * surf;
  let kind = T[o];
  if (kind == 0u) {
    return Eval(x.z, vec3f(0.0, 0.0, 1.0), 0.0);
  }
  if (kind == 3u) {
    let zc = clamp(x.z, 0.0, tf(o + 5u));
    let v = vec3f(x.x, x.y, x.z - zc);
    let q = length(v);
    var g = vec3f(0.0);
    if (q > 0.0) { g = v / q; }
    return Eval(q - tf(o + 4u), g, zc);
  }
  let r = length(x.xy);
  var c = vec2f(1.0, 0.0);
  if (r > 0.0) { c = x.xy / r; }
  if (kind == 1u) {
    let nr = tf(o + 4u);
    let nz = tf(o + 5u);
    let f = nr * r + nz * x.z - tf(o + 6u);
    let param = (r - tf(o + 7u)) * (-nz) + (x.z - tf(o + 8u)) * nr;
    return Eval(f, vec3f(nr * c.x, nr * c.y, nz), param);
  }
  let dr = r - tf(o + 4u);
  let dz = x.z - tf(o + 5u);
  let q = length(vec2f(dr, dz));
  var gr = 0.0;
  var gz = 0.0;
  if (q > 0.0) {
    gr = dr / q;
    gz = dz / q;
  }
  let width = tf(o + 13u) - tf(o + 12u);
  var da = atan2(dz, dr) - tf(o + 7u);
  da = da - TWO_PI * floor(da / TWO_PI);
  if (da > width + 0.5 * (TWO_PI - width)) { da = da - TWO_PI; }
  return Eval(q - tf(o + 6u), vec3f(gr * c.x, gr * c.y, gz), da);
}

@compute @workgroup_size(${TRACE_WORKGROUP})
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.y * P.row + gid.x;
  if (i >= P.count) { return; }
  let ray = rays[i];
  let key = ray.key + P.keyBase;

  // Closest triangle over every root.
  var best = ray.tMax;
  var tri = NONE;
  var rootHit = 0u;
  for (var k = 0u; k < P.rootCount; k++) {
    let R = P.roots[k];
    let ro = vec3f(dot(R.r0.xyz, ray.o) + R.r0.w, dot(R.r1.xyz, ray.o) + R.r1.w, dot(R.r2.xyz, ray.o) + R.r2.w);
    let rd = vec3f(dot(R.r0.xyz, ray.d), dot(R.r1.xyz, ray.d), dot(R.r2.xyz, ray.d));
    let found = traverse(R.node, ro, rd, best, key);
    if (found.tri != NONE) {
      best = found.t;
      tri = found.tri;
      rootHit = k;
    }
  }
  if (tri == NONE) {
    hits[i] = Hit(ray.tMax, NONE, NONE, NONE, vec3f(0.0), 0.0);
    return;
  }

  // Correction on the analytic piece, in the frame of the piece.
  let R = P.roots[rootHit];
  let ro = vec3f(dot(R.r0.xyz, ray.o) + R.r0.w, dot(R.r1.xyz, ray.o) + R.r1.w, dot(R.r2.xyz, ray.o) + R.r2.w);
  let rd = vec3f(dot(R.r0.xyz, ray.d), dot(R.r1.xyz, ray.d), dot(R.r2.xyz, ray.d));
  let surf0 = tris[tri].surf;
  var surf = surf0;
  var t = best;
  // The correction never leaves this window about the triangle hit.
  let tLo = best - P.maxStep;
  let tHi = best + P.maxStep;
  var ev = Eval(0.0, vec3f(0.0, 0.0, 1.0), 0.0);
  var xl = vec3f(0.0);
  var ol = vec3f(0.0);
  var dl = vec3f(0.0);
  var fo = 0u;
  var inRange = true;
  for (var sw = 0u; sw <= P.maxSwitches; sw++) {
    let so = SURF_WORDS * surf;
    fo = T[so + 1u];
    let f0 = frameRow(fo, 0u);
    let f1 = frameRow(fo, 1u);
    let f2 = frameRow(fo, 2u);
    ol = vec3f(dot(f0.xyz, ro) + f0.w, dot(f1.xyz, ro) + f1.w, dot(f2.xyz, ro) + f2.w);
    dl = vec3f(dot(f0.xyz, rd), dot(f1.xyz, rd), dot(f2.xyz, rd));
    let slope = -P.minSlope * length(dl);
    var back = P.backStep;
    for (var it = 0u; it < P.newtonSteps; it++) {
      let e = evalSurf(surf, ol + t * dl);
      let denom = dot(e.g, dl);
      if (denom < slope) {
        t = clamp(t + clamp(-e.f / denom, -P.maxStep, P.maxStep), tLo, tHi);
      } else if (e.f < 0.0) {
        // Inside the solid where the piece no longer faces the ray: retreat, further each time,
        // but never out of the window.
        t = clamp(t - back, tLo, tHi);
        back = back * 2.0;
      } else {
        break;
      }
    }
    xl = ol + t * dl;
    ev = evalSurf(surf, xl);
    let slack = tf(so + 9u);
    let prev = T[so + 2u];
    let next = T[so + 3u];
    let below = ev.param < tf(so + 12u) - slack && prev != NONE;
    let above = ev.param > tf(so + 13u) + slack && next != NONE;
    inRange = !(below || above);
    if (inRange || sw == P.maxSwitches) { break; }
    if (below) { surf = prev; } else { surf = next; }
  }
  // The corrected hit stands only if it is on the piece, within its range and facing the ray;
  // otherwise the hit is the one on the triangle, with the normal of the triangle.
  let corrected = inRange && abs(ev.f) <= P.acceptResidual && dot(ev.g, dl) < 0.0;
  var gr = vec3f(0.0);
  if (corrected) {
    let g0 = frameRow(fo, 0u);
    let g1 = frameRow(fo, 1u);
    let g2 = frameRow(fo, 2u);
    gr = g0.xyz * ev.g.x + g1.xyz * ev.g.y + g2.xyz * ev.g.z;
  } else {
    surf = surf0;
    t = best;
    let so = SURF_WORDS * surf;
    fo = T[so + 1u];
    let f0 = frameRow(fo, 0u);
    let f1 = frameRow(fo, 1u);
    let f2 = frameRow(fo, 2u);
    ol = vec3f(dot(f0.xyz, ro) + f0.w, dot(f1.xyz, ro) + f1.w, dot(f2.xyz, ro) + f2.w);
    dl = vec3f(dot(f0.xyz, rd), dot(f1.xyz, rd), dot(f2.xyz, rd));
    ev = evalSurf(surf, ol + t * dl);
    let hitTri = tris[tri];
    gr = cross(hitTri.v1 - hitTri.v0, hitTri.v2 - hitTri.v0);
  }

  t = clamp(t, 0.0, ray.tMax);
  xl = ol + t * dl;

  // Normal: from the root frame to the tub frame.
  var n = R.r0.xyz * gr.x + R.r1.xyz * gr.y + R.r2.xyz * gr.z;
  let nl = length(n);
  if (nl > 0.0) { n = n / nl; }

  // Patch coordinates, cell, block and soil cell.
  let grid = tris[tri].grid;
  let po = P.patchBase + PATCH_WORDS * grid;
  let rowCount = T[po + 3u];
  let isRev = T[po] == 0u;
  var a = 0.0;
  var u = 0.0;
  var turn = 0.0;
  if (isRev) {
    let so = SURF_WORDS * surf;
    a = tf(so + 10u) + tf(so + 11u) * ev.param;
    turn = (atan2(xl.y, xl.x) - tf(po + 6u)) / TWO_PI;
    turn = turn - floor(turn);
  } else {
    // A planar face: a hit on the face is mapped where it is, a hit on a rounded edge to its
    // foot on the axis of the edge, a hit on a rounded corner to the centre of the corner.
    var h = ro + t * rd;
    let so = SURF_WORDS * surf;
    let surfKind = T[so];
    if (surfKind != 0u) {
      var along = 0.0;
      if (surfKind == 1u) { along = clamp(xl.z, 0.0, tf(so + 13u)); }
      let s0 = frameRow(fo, 0u);
      let s1 = frameRow(fo, 1u);
      let s2 = frameRow(fo, 2u);
      let q = vec3f(-s0.w, -s1.w, along - s2.w);
      h = s0.xyz * q.x + s1.xyz * q.y + s2.xyz * q.z;
    }
    let pf = T[po + 1u];
    let p0 = frameRow(pf, 0u);
    let p1 = frameRow(pf, 1u);
    u = dot(p0.xyz, h) + p0.w;
    a = dot(p1.xyz, h) + p1.w;
  }
  let ra = (a - tf(po + 4u)) / tf(po + 5u);
  let rowF = clamp(floor(ra), 0.0, f32(rowCount - 1u));
  let ri = P.rowBase + 2u * (T[po + 2u] + u32(rowF));
  let first = T[ri];
  let cols = T[ri + 1u];
  var cb = 0.0;
  if (isRev) {
    let span = tf(po + 7u) / TWO_PI;
    var f = 0.0;
    if (turn <= span) {
      f = turn / span;
    } else if (turn - span < 0.5 * (1.0 - span)) {
      f = 1.0;
    }
    cb = f * f32(cols);
  } else {
    cb = (u - tf(po + 6u)) / tf(po + 7u);
  }
  let colF = clamp(floor(cb), 0.0, f32(cols - 1u));
  let cell = first + u32(colF);
  let block = T[P.cellBase + cell];
  var soil = NONE;
  if (block != NONE) {
    let base = T[P.soilBase + block];
    if (base != NONE) {
      // The quarter of the block: by where the hit lies in its cell, or as the cell says when it
      // is not the block's own (4 bits per cell, eight cells per word).
      let code = (T[P.quarterBase + (cell >> 3u)] >> (4u * (cell & 7u))) & 15u; // literal-ok: bit layout
      let fa = clamp(ra - rowF, 0.0, 1.0);
      let fb = clamp(cb - colF, 0.0, 1.0);
      var ha = select(0u, 1u, fa >= 0.5);
      var hb = select(0u, 1u, fb >= 0.5);
      if ((code & 3u) != 0u) { ha = (code & 3u) - 1u; }
      if ((code >> 2u) != 0u) { hb = (code >> 2u) - 1u; }
      soil = base + 2u * ha + hb;
    }
  }
  hits[i] = Hit(t, block, soil, tri, n, max(0.0, -dot(ray.d, n)));
}
`;
