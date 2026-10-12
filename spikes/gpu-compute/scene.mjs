// Procedural "loaded dishwasher" stand-in: thin shells (spheres, bowls, discs) and tori scattered in a 0.5 m box.
// Provides: analytic object list (for GPU SDF voxelisation), triangle tessellation (for the BVH) and ray generators.
import { mulberry32 } from './lib.mjs';

export const BOX = 0.5;

/** Object record: 16 floats = (c.xyz, kind), (r0.xyz, R), (r1.xyz, r), (r2.xyz, pad). Rows r0..r2 = world->local rotation. */
export function makeObjects(count = 400, seed = 7) {
  const rnd = mulberry32(seed);
  const data = new Float32Array(count * 16);
  for (let i = 0; i < count; i++) {
    const kind = i % 4; // 0 sphere shell, 1 torus, 2 bowl (open hemisphere), 3 disc (plate)
    const R = 0.02 + 0.04 * rnd();
    const r = kind === 1 ? R * (0.15 + 0.2 * rnd()) : 0.0015; // torus tube radius, or shell half-thickness
    const m = R + 0.005;
    const c = [m + (BOX - 2 * m) * rnd(), m + (BOX - 2 * m) * rnd(), m + (BOX - 2 * m) * rnd()];
    // random rotation from a unit quaternion
    let q = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, rnd() - 0.5];
    const ql = Math.hypot(...q) || 1; q = q.map((v) => v / ql);
    const [x, y, z, w] = q;
    const rot = [
      1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
      2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
      2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
    data.set([c[0], c[1], c[2], kind, rot[0], rot[1], rot[2], R, rot[3], rot[4], rot[5], r, rot[6], rot[7], rot[8], 0], i * 16);
  }
  return { count, data };
}

/** Tessellate every object into triangles: Float32Array with 9 floats per triangle. nu x nv quads per object. */
export function tessellate(objs, nu = 48, nv = 27) {
  const trisPer = nu * nv * 2;
  const out = new Float32Array(objs.count * trisPer * 9);
  let o = 0;
  const P = new Float64Array((nu + 1) * (nv + 1) * 3);
  for (let i = 0; i < objs.count; i++) {
    const d = objs.data, b = i * 16;
    const cx = d[b], cy = d[b + 1], cz = d[b + 2], kind = d[b + 3], R = d[b + 7], r = d[b + 11];
    // local->world = transpose of rows
    const r0 = [d[b + 4], d[b + 5], d[b + 6]], r1 = [d[b + 8], d[b + 9], d[b + 10]], r2 = [d[b + 12], d[b + 13], d[b + 14]];
    for (let a = 0; a <= nu; a++) {
      const u = (a / nu) * 2 * Math.PI, cu = Math.cos(u), su = Math.sin(u);
      for (let c = 0; c <= nv; c++) {
        const t = c / nv;
        let lx, ly, lz;
        if (kind === 0) { const ph = t * Math.PI; lx = R * Math.sin(ph) * cu; ly = R * Math.sin(ph) * su; lz = R * Math.cos(ph); }
        else if (kind === 1) { const ph = t * 2 * Math.PI; const rr = R + r * Math.cos(ph); lx = rr * cu; ly = rr * su; lz = r * Math.sin(ph); }
        else if (kind === 2) { const ph = Math.PI / 2 + t * Math.PI / 2; lx = R * Math.sin(ph) * cu; ly = R * Math.sin(ph) * su; lz = R * Math.cos(ph); }
        else { const rr = R * t; lx = rr * cu; ly = rr * su; lz = 0; }
        const k = (a * (nv + 1) + c) * 3;
        P[k] = cx + r0[0] * lx + r1[0] * ly + r2[0] * lz;
        P[k + 1] = cy + r0[1] * lx + r1[1] * ly + r2[1] * lz;
        P[k + 2] = cz + r0[2] * lx + r1[2] * ly + r2[2] * lz;
      }
    }
    for (let a = 0; a < nu; a++) for (let c = 0; c < nv; c++) {
      const i00 = (a * (nv + 1) + c) * 3, i10 = ((a + 1) * (nv + 1) + c) * 3, i01 = i00 + 3, i11 = i10 + 3;
      out[o++] = P[i00]; out[o++] = P[i00 + 1]; out[o++] = P[i00 + 2];
      out[o++] = P[i10]; out[o++] = P[i10 + 1]; out[o++] = P[i10 + 2];
      out[o++] = P[i11]; out[o++] = P[i11 + 1]; out[o++] = P[i11 + 2];
      out[o++] = P[i00]; out[o++] = P[i00 + 1]; out[o++] = P[i00 + 2];
      out[o++] = P[i11]; out[o++] = P[i11 + 1]; out[o++] = P[i11 + 2];
      out[o++] = P[i01]; out[o++] = P[i01 + 1]; out[o++] = P[i01 + 2];
    }
  }
  return { nTri: objs.count * trisPer, verts: out };
}

/** WGSL: signed distance to the object list (bound as `objs: array<Obj>`, count in `nObj`). */
export const SDF_WGSL = /* wgsl */ `
struct Obj { c: vec3f, kind: f32, r0: vec3f, R: f32, r1: vec3f, r: f32, r2: vec3f, pad: f32 };
fn sdObj(o: Obj, p: vec3f) -> f32 {
  let w = p - o.c;
  let q = vec3f(dot(o.r0, w), dot(o.r1, w), dot(o.r2, w));
  let k = u32(o.kind);
  if (k == 0u) { return abs(length(q) - o.R) - o.r; }
  if (k == 1u) { return length(vec2f(length(q.xy) - o.R, q.z)) - o.r; }
  if (k == 2u) {
    if (q.z <= 0.0) { return abs(length(q) - o.R) - o.r; }
    return length(vec2f(length(q.xy) - o.R, q.z)) - o.r;
  }
  let d = vec2f(length(q.xy) - o.R, abs(q.z) - o.r);
  return min(max(d.x, d.y), 0.0) + length(max(d, vec2f(0.0)));
}`;

// ---- rays: 8 floats each = (origin.xyz, tmin, dir.xyz, tmax) ----
function setRay(a, i, ox, oy, oz, dx, dy, dz, tmax) {
  const l = Math.hypot(dx, dy, dz) || 1;
  a[i * 8] = ox; a[i * 8 + 1] = oy; a[i * 8 + 2] = oz; a[i * 8 + 3] = 1e-5;
  a[i * 8 + 4] = dx / l; a[i * 8 + 5] = dy / l; a[i * 8 + 6] = dz / l; a[i * 8 + 7] = tmax;
}
/** Coherent: 16 nozzles near the floor, each a stratified upward cone (like spray-arm jets). Buffer order follows the strata. */
export function raysCoherent(n, a = new Float32Array(n * 8), off = 0, tmax = 1e30) {
  const nozzles = 16, per = Math.ceil(n / nozzles), side = Math.ceil(Math.sqrt(per));
  const tanHalf = Math.tan((35 * Math.PI) / 180);
  for (let i = 0; i < n; i++) {
    const nz = Math.floor(i / per), j = i % per;
    const u = ((j % side) + 0.5) / side * 2 - 1, v = (Math.floor(j / side) + 0.5) / side * 2 - 1;
    const ox = 0.05 + 0.4 * ((nz % 8) + 0.5) / 8, oy = nz < 8 ? 0.2 : 0.3, oz = 0.012;
    setRay(a, off + i, ox, oy, oz, u * tanHalf, v * tanHalf, 1, tmax);
  }
  return a;
}
/** Incoherent: uniformly random origins inside the box and uniformly random directions, random buffer order. */
export function raysIncoherent(n, a = new Float32Array(n * 8), off = 0, tmax = 1e30, seed = 99) {
  const rnd = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const z = 2 * rnd() - 1, ph = 2 * Math.PI * rnd(), s = Math.sqrt(1 - z * z);
    setRay(a, off + i, 0.002 + 0.496 * rnd(), 0.002 + 0.496 * rnd(), 0.002 + 0.496 * rnd(), s * Math.cos(ph), s * Math.sin(ph), z, tmax);
  }
  return a;
}
/** Mixed: first half coherent jets, second half incoherent. */
export function raysMixed(n, tmax = 1e30) {
  const a = new Float32Array(n * 8);
  const h = n >> 1;
  raysCoherent(h, a, 0, tmax);
  raysIncoherent(n - h, a, h, tmax);
  return a;
}
