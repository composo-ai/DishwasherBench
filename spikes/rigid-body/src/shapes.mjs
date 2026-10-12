// Engine-neutral tableware shapes as compounds of convex pieces.
// Every piece is a "prismatoid": two vertex loops of equal length joined by planar side quads, so
// its convex hull is known by construction and volume / centroid can be integrated exactly.
// Local frame convention for bodies of revolution: axis = +Y ("a" coordinate), a = 0 at the foot.
// After construction every shape is re-centred so that its centre of mass is the local origin.
import { add, sub, scale, cross, dot } from './math.mjs';

function tetVol(o, a, b, c) {
  return dot(sub(a, o), cross(sub(b, o), sub(c, o))) / 6;
}

/** Build a piece from two loops (arrays of [x,y,z]) with matching vertex order. */
export function prismatoid(loopA, loopB) {
  const k = loopA.length;
  if (loopB.length !== k) throw new Error('loop size mismatch');
  const pts = [...loopA, ...loopB];
  const o = scale(pts.reduce(add, [0, 0, 0]), 1 / pts.length);
  let vol = 0;
  let com = [0, 0, 0];
  const tri = (a, b, c) => {
    const v = Math.abs(tetVol(o, a, b, c));
    vol += v;
    com = add(com, scale(add(add(o, a), add(b, c)), v / 4));
  };
  for (let i = 1; i < k - 1; i++) {
    tri(loopA[0], loopA[i], loopA[i + 1]);
    tri(loopB[0], loopB[i], loopB[i + 1]);
  }
  for (let i = 0; i < k; i++) {
    const j = (i + 1) % k;
    tri(loopA[i], loopA[j], loopB[j]);
    tri(loopA[i], loopB[j], loopB[i]);
  }
  return { pts, vol, com: scale(com, 1 / vol) };
}

const polar = (r, a, phi) => [r * Math.cos(phi), a, r * Math.sin(phi)];

/** Sweep a convex profile polygon [[r,a],...] through angular sectors -> n pieces. */
function revolve(profile, n, phase = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const p0 = phase + (2 * Math.PI * i) / n;
    const p1 = phase + (2 * Math.PI * (i + 1)) / n;
    out.push(
      prismatoid(
        profile.map(([r, a]) => polar(r, a, p0)),
        profile.map(([r, a]) => polar(r, a, p1)),
      ),
    );
  }
  return out;
}

/** Solid n-gon disc of radius r between a0 and a1. */
function disc(r, a0, a1, n, phase = 0) {
  const lo = [];
  const hi = [];
  for (let i = 0; i < n; i++) {
    const p = phase + (2 * Math.PI * i) / n;
    lo.push(polar(r, a0, p));
    hi.push(polar(r, a1, p));
  }
  return prismatoid(lo, hi);
}

/** Axis-aligned box piece from min/max corners. */
function box(min, max) {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  return prismatoid(
    [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
    [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]],
  );
}

function finish(name, pieces, mass, meta = {}) {
  const volume = pieces.reduce((s, p) => s + p.vol, 0);
  const com = scale(pieces.reduce((s, p) => add(s, scale(p.com, p.vol)), [0, 0, 0]), 1 / volume);
  const out = pieces.map((p) => {
    const f = new Float64Array(p.pts.length * 3);
    p.pts.forEach((v, i) => {
      f[3 * i] = v[0] - com[0];
      f[3 * i + 1] = v[1] - com[1];
      f[3 * i + 2] = v[2] - com[2];
    });
    return f;
  });
  let rmax = 0;
  for (const f of out) for (let i = 0; i < f.length; i += 3) rmax = Math.max(rmax, Math.hypot(f[i], f[i + 1], f[i + 2]));
  return {
    name,
    pieces: out,
    pieceVolumes: pieces.map((p) => p.vol),
    volume,
    mass,
    density: mass / volume,
    comOffset: com, // where the modelling-frame origin sits relative to COM is -comOffset
    boundingRadius: rmax,
    ...meta,
  };
}

// ---------------------------------------------------------------------------------------------
// Dinner plate: diameter 0.26 m, 0.65 kg. Profile: foot ring, flat well, cavetto, sloped lip.
export function makePlate(n = 24) {
  const pieces = [
    disc(0.085, 0.003, 0.008, n),
    ...revolve([[0.076, 0.0], [0.082, 0.0], [0.082, 0.003], [0.076, 0.003]], n),
    ...revolve([[0.085, 0.003], [0.1, 0.012], [0.1, 0.017], [0.085, 0.008]], n),
    ...revolve([[0.1, 0.012], [0.13, 0.02], [0.13, 0.024], [0.1, 0.017]], n),
  ];
  return finish(`plate${n}`, pieces, 0.65, { radius: 0.13, height: 0.024, segments: n });
}

// Soup bowl: diameter 0.16 m, depth ~0.06 m, 0.35 kg. Elliptic wall in `k` profile segments.
export const BOWL = { r0: 0.038, a0: 0.003, rTop: 0.08, aTop: 0.065, thetaMax: (75 * Math.PI) / 180, t: 0.004 };
export function bowlProfile(k = 5) {
  const { r0, a0, rTop, aTop, thetaMax, t } = BOWL;
  const A = (rTop - r0) / Math.sin(thetaMax);
  const B = (aTop - a0) / (1 - Math.cos(thetaMax));
  const outer = [];
  const inner = [];
  for (let i = 0; i <= k; i++) {
    const th = (thetaMax * i) / k;
    const P = [r0 + A * Math.sin(th), a0 + B * (1 - Math.cos(th))];
    const T = [A * Math.cos(th), B * Math.sin(th)];
    const tl = Math.hypot(T[0], T[1]);
    const nrm = [-T[1] / tl, T[0] / tl];
    outer.push(P);
    inner.push([P[0] + nrm[0] * t, P[1] + nrm[1] * t]);
  }
  return { outer, inner };
}
export function makeBowl(n = 24, k = 5) {
  const { outer, inner } = bowlProfile(k);
  const pieces = [
    disc(BOWL.r0, 0.003, 0.007, n),
    ...revolve([[0.03, 0.0], [0.036, 0.0], [0.036, 0.003], [0.03, 0.003]], n),
  ];
  for (let i = 0; i < k; i++) pieces.push(...revolve([outer[i], outer[i + 1], inner[i + 1], inner[i]], n));
  return finish(`bowl${n}x${k}`, pieces, 0.35, { radius: 0.08, height: 0.065, segments: n, profileSegments: k });
}
/** Ideal (smooth surface of revolution) axial spacing of two nested bowls. */
export function bowlNestSpacing(k = 200) {
  const { outer, inner } = bowlProfile(k);
  const interp = (curve, r) => {
    for (let i = 0; i < curve.length - 1; i++) {
      const [r1, a1] = curve[i];
      const [r2, a2] = curve[i + 1];
      if (r >= r1 && r <= r2) return a1 + ((a2 - a1) * (r - r1)) / (r2 - r1 || 1);
    }
    return null;
  };
  let s = 0.007; // foot (a=0) of the upper bowl must clear the lower bowl's inner base (a=0.007)
  for (let i = 0; i <= 2000; i++) {
    const r = BOWL.r0 + ((BOWL.rTop - BOWL.r0) * i) / 2000;
    const ai = interp(inner, r);
    const ao = interp(outer, r);
    if (ai != null && ao != null) s = Math.max(s, ai - ao);
  }
  return s;
}

// Tumbler: thin-walled open cylinder, diameter 0.07, height 0.13, wall 2 mm, 0.15 kg.
export function makeTumbler(n = 16) {
  const pieces = [
    disc(0.035, 0.0, 0.005, n),
    ...revolve([[0.033, 0.005], [0.035, 0.005], [0.035, 0.13], [0.033, 0.13]], n),
  ];
  return finish(`tumbler${n}`, pieces, 0.15, { radius: 0.035, height: 0.13, segments: n });
}

// Mug with handle: outer radius 0.041, height 0.095, wall 4 mm, 0.32 kg. Handle in the +X half-plane.
export function makeMug(n = 16) {
  const pieces = [
    disc(0.041, 0.0, 0.006, n),
    ...revolve([[0.037, 0.006], [0.041, 0.006], [0.041, 0.095], [0.037, 0.095]], n, Math.PI / n),
    box([0.039, 0.018, -0.005], [0.07, 0.025, 0.005]),
    box([0.039, 0.07, -0.005], [0.07, 0.077, 0.005]),
    box([0.063, 0.025, -0.005], [0.07, 0.07, 0.005]),
  ];
  return finish(`mug${n}`, pieces, 0.32, { radius: 0.041, height: 0.095, segments: n });
}

// ---------------------------------------------------------------------------------------------
// Cutlery. Local frame: long axis +Y (handle end at -Y), width X, thickness Z.
/** Slab whose cross-section at y0 is (w0 x t0) and at y1 is (w1 x t1), optionally offset in z. */
function slab(y0, w0, t0, y1, w1, t1, x0 = 0, x1 = 0, z0 = 0, z1 = 0) {
  return prismatoid(
    [[x0 - w0 / 2, y0, z0 - t0 / 2], [x0 + w0 / 2, y0, z0 - t0 / 2], [x0 + w0 / 2, y0, z0 + t0 / 2], [x0 - w0 / 2, y0, z0 + t0 / 2]],
    [[x1 - w1 / 2, y1, z1 - t1 / 2], [x1 + w1 / 2, y1, z1 - t1 / 2], [x1 + w1 / 2, y1, z1 + t1 / 2], [x1 - w1 / 2, y1, z1 + t1 / 2]],
  );
}

export function makeKnife() {
  // Blade: wedge cross-section, spine (+X) 2.0 mm thick, cutting edge (-X) 0.5 mm thick.
  // Half-thickness follows the wedge plane so that every face of every piece is exactly planar.
  const half = (x) => 0.00025 + ((x + 0.01) * (0.001 - 0.00025)) / 0.02;
  const bladeLoop = (y, xEdge, xSpine) => [
    [xEdge, y, -half(xEdge)], [xSpine, y, -half(xSpine)], [xSpine, y, half(xSpine)], [xEdge, y, half(xEdge)],
  ];
  const pieces = [
    slab(-0.11, 0.016, 0.008, -0.01, 0.018, 0.009), // handle
    prismatoid(bladeLoop(-0.01, -0.01, 0.01), bladeLoop(0.08, -0.01, 0.01)), // blade
    prismatoid(bladeLoop(0.08, -0.01, 0.01), bladeLoop(0.11, 0.004, 0.01)), // tapered tip
  ];
  return finish('knife', pieces, 0.08, { length: 0.22 });
}

export function makeFork() {
  const pieces = [
    slab(-0.1, 0.012, 0.003, -0.02, 0.009, 0.003), // handle (wide end)
    slab(-0.02, 0.009, 0.003, 0.025, 0.007, 0.0028, 0, 0, 0, 0.002), // handle (neck end, slight rise)
    slab(0.025, 0.007, 0.0028, 0.05, 0.024, 0.0022, 0, 0, 0.002, 0.004), // shoulder
  ];
  const tw = 0.004;
  const gap = (0.024 - 4 * tw) / 3;
  for (let i = 0; i < 4; i++) {
    const x = -0.012 + tw / 2 + i * (tw + gap);
    pieces.push(slab(0.05, tw, 0.0022, 0.1, tw * 0.7, 0.0012, x, x, 0.004, 0.009)); // separate tines
  }
  return finish("fork", pieces, 0.045, { length: 0.2 });
}

export function makeSpoon() {
  const pieces = [
    slab(-0.095, 0.012, 0.003, -0.02, 0.009, 0.003),
    slab(-0.02, 0.009, 0.003, 0.03, 0.007, 0.0028, 0, 0, 0, 0.003),
  ];
  // Spoon bowl: elliptic dish (42 x 60 mm, 8 mm deep, 1.6 mm thick) = flat centre + 8 tilted rim panels.
  const cy = 0.06;
  const m = 8;
  const t = 0.0016;
  const ring = (fx, fy, z) => {
    const out = [];
    for (let i = 0; i < m; i++) {
      const p = (2 * Math.PI * (i + 0.5)) / m;
      out.push([fx * Math.cos(p), cy + fy * Math.sin(p), z]);
    }
    return out;
  };
  const inLo = ring(0.0112, 0.016, 0.003 - 0.004);
  const inHi = ring(0.0112, 0.016, 0.003 - 0.004 + t);
  const outLo = ring(0.021, 0.03, 0.003 + 0.004);
  const outHi = ring(0.021, 0.03, 0.003 + 0.004 + t);
  pieces.push(prismatoid(inLo, inHi));
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m;
    pieces.push(prismatoid([inLo[i], inLo[j], inHi[j], inHi[i]], [outLo[i], outLo[j], outHi[j], outHi[i]]));
  }
  return finish('spoon', pieces, 0.045, { length: 0.19 });
}

export function shapeStats(shape) {
  let nv = 0;
  for (const p of shape.pieces) nv += p.length / 3;
  return { name: shape.name, pieces: shape.pieces.length, vertices: nv, volume_cm3: shape.volume * 1e6, mass: shape.mass, density: shape.density };
}
