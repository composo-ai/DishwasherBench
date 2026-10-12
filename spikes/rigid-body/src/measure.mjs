// Engine-neutral penetration measurement (pure JS, float64, no physics library involved).
//
// Every dynamic piece is a prismatoid (two vertex loops of equal length, see shapes.mjs), so its faces
// and edges are known. Penetration depth is evaluated exactly with the separating-axis theorem:
//   signed distance = max over candidate axes n of  max(minA - maxB, minB - maxA)
// - polytope vs polytope (piece vs piece, piece vs basket wall): face normals of both + edge x edge.
//   Negative result = exact minimum-translation penetration depth; positive = separated.
// - polytope vs capsule (piece vs wire): the capsule is a segment inflated by r. Axes: face normals,
//   edge x segment, vertex -> closest point on segment, segment end -> closest point on each edge.
//   That set contains the true closest-feature direction, so the segment distance is exact and the
//   capsule's signed distance is (segment signed distance - r).
//
// (An earlier version used Rapier/Parry's one-shot `contactCollider` query. At SI scale it returned a
// spurious -9.0 mm for a pair that is really 2.0 mm apart - see src/debug-parry.mjs - so it was replaced.)
import { qRot, sub, len, scale, add, cross, dot } from './math.mjs';

function unit(v) {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l > 1e-12 ? [v[0] / l, v[1] / l, v[2] / l] : null;
}
function pushUnique(list, v) {
  const u = unit(v);
  if (!u) return;
  for (const w of list) if (Math.abs(w[0] * u[0] + w[1] * u[1] + w[2] * u[2]) > 1 - 1e-10) return;
  list.push(u);
}
function newell(loop) {
  const n = [0, 0, 0];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return n;
}

/** Local-frame topology of a prismatoid piece given as flat [loopA..., loopB...] vertices. */
function pieceTopology(pts) {
  const n = pts.length / 3;
  const k = n / 2;
  const V = [];
  for (let i = 0; i < n; i++) V.push([pts[3 * i], pts[3 * i + 1], pts[3 * i + 2]]);
  const A = V.slice(0, k);
  const B = V.slice(k);
  const normals = [];
  const edgeDirs = [];
  const edges = [];
  pushUnique(normals, newell(A));
  pushUnique(normals, newell(B));
  for (let i = 0; i < k; i++) {
    const j = (i + 1) % k;
    pushUnique(normals, newell([A[i], A[j], B[j], B[i]]));
    for (const [p, q] of [[i, j], [k + i, k + j], [i, k + i]]) {
      edges.push([p, q]);
      pushUnique(edgeDirs, sub(V[q], V[p]));
    }
  }
  let c = [0, 0, 0];
  for (const v of V) c = add(c, v);
  c = scale(c, 1 / n);
  let r = 0;
  for (const v of V) r = Math.max(r, len(sub(v, c)));
  return { V, normals, edgeDirs, edges, bs: { c, r } };
}

function boxTopology(s) {
  const V = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) V.push(add(s.c, qRot(s.q, [sx * s.h[0], sy * s.h[1], sz * s.h[2]])));
  const ax = [qRot(s.q, [1, 0, 0]), qRot(s.q, [0, 1, 0]), qRot(s.q, [0, 0, 1])];
  return { V, normals: ax, edgeDirs: ax, c: s.c, r: len(s.h) };
}

function interval(V, n) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < V.length; i++) {
    const d = V[i][0] * n[0] + V[i][1] * n[1] + V[i][2] * n[2];
    if (d < lo) lo = d;
    if (d > hi) hi = d;
  }
  return [lo, hi];
}

/** Signed distance between two convex polytopes (exact when negative). Early-outs once separated. */
function polyPoly(a, b) {
  let best = -Infinity;
  const test = (n) => {
    const [la, ha] = interval(a.V, n);
    const [lb, hb] = interval(b.V, n);
    const sep = Math.max(la - hb, lb - ha);
    if (sep > best) best = sep;
    return sep > 0;
  };
  for (const n of a.normals) if (test(n)) return best;
  for (const n of b.normals) if (test(n)) return best;
  for (const e of a.edgeDirs) {
    for (const f of b.edgeDirs) {
      const n = unit(cross(e, f));
      if (n && test(n)) return best;
    }
  }
  return best;
}

function closestOnSeg(p, a, b) {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  let t = l2 > 0 ? dot(sub(p, a), ab) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
}

/** Signed distance between a convex polytope and a segment (exact). Stops once it exceeds `cut`. */
function polySegment(p, a, b, cut) {
  let best = -Infinity;
  const test = (n) => {
    const [lp, hp] = interval(p.V, n);
    const da = dot(a, n);
    const db = dot(b, n);
    const sep = Math.max(lp - Math.max(da, db), Math.min(da, db) - hp);
    if (sep > best) best = sep;
    return sep > cut;
  };
  const d = unit(sub(b, a));
  for (const n of p.normals) if (test(n)) return best;
  if (d) {
    for (const e of p.edgeDirs) {
      const n = unit(cross(e, d));
      if (n && test(n)) return best;
    }
  }
  for (const v of p.V) {
    const n = unit(sub(v, closestOnSeg(v, a, b)));
    if (n && test(n)) return best;
  }
  for (const e of [a, b]) {
    for (const [i, j] of p.edges) {
      const n = unit(sub(e, closestOnSeg(e, p.V[i], p.V[j])));
      if (n && test(n)) return best;
    }
  }
  return best;
}

export async function createMeasurer(scene) {
  const topoCache = new Map();
  const shapeTopo = (key) => {
    if (!topoCache.has(key)) topoCache.set(key, scene.shapes[key].pieces.map(pieceTopology));
    return topoCache.get(key);
  };
  const statics = scene.statics.map((s, idx) => (s.type === 'capsule' ? { idx, s } : { idx, s, box: boxTopology(s) }));
  const bodies = scene.bodies.map((b) => ({ topo: shapeTopo(b.shape), R: scene.shapes[b.shape].boundingRadius }));

  /**
   * @param state Float64Array, 13 per body: pos(3) quat(4 xyzw) linvel(3) angvel(3)
   * @returns penetration depths in metres (0 if no overlap) and the worst pairs.
   */
  function measure(state, { dynamic = true } = {}) {
    const P = [];
    const Q = [];
    const world = []; // lazily built world-space polytopes per body piece
    for (let i = 0; i < bodies.length; i++) {
      const o = i * 13;
      P.push([state[o], state[o + 1], state[o + 2]]);
      Q.push([state[o + 3], state[o + 4], state[o + 5], state[o + 6]]);
      world.push(new Array(bodies[i].topo.length));
    }
    const centre = (i, k) => add(P[i], qRot(Q[i], bodies[i].topo[k].bs.c));
    const piece = (i, k) => {
      let w = world[i][k];
      if (!w) {
        const t = bodies[i].topo[k];
        w = {
          V: t.V.map((v) => add(P[i], qRot(Q[i], v))),
          normals: t.normals.map((n) => qRot(Q[i], n)),
          edgeDirs: t.edgeDirs.map((n) => qRot(Q[i], n)),
          edges: t.edges,
        };
        world[i][k] = w;
      }
      return w;
    };
    let penStatic = 0;
    let penDynamic = 0;
    let worstStatic = null;
    let worstDynamic = null;
    let pairsTested = 0;
    const centres = bodies.map((B, i) => B.topo.map((_, k) => centre(i, k)));
    for (let i = 0; i < bodies.length; i++) {
      const B = bodies[i];
      for (const st of statics) {
        const s = st.s;
        if (s.type === 'capsule') {
          if (len(sub(P[i], closestOnSeg(P[i], s.a, s.b))) > B.R + s.r) continue;
        } else if (len(sub(P[i], st.box.c)) > B.R + st.box.r) continue;
        for (let k = 0; k < B.topo.length; k++) {
          const c = centres[i][k];
          const br = B.topo[k].bs.r;
          let sd;
          if (s.type === 'capsule') {
            if (len(sub(c, closestOnSeg(c, s.a, s.b))) > br + s.r) continue;
            pairsTested++;
            sd = polySegment(piece(i, k), s.a, s.b, s.r) - s.r;
          } else {
            if (len(sub(c, st.box.c)) > br + st.box.r) continue;
            pairsTested++;
            sd = polyPoly(piece(i, k), st.box);
          }
          if (-sd > penStatic) {
            penStatic = -sd;
            worstStatic = { body: i, piece: k, static: st.idx, tag: s.tag };
          }
        }
      }
      if (!dynamic) continue;
      for (let j = i + 1; j < bodies.length; j++) {
        const C = bodies[j];
        if (len(sub(P[i], P[j])) > B.R + C.R) continue;
        for (let k = 0; k < B.topo.length; k++) {
          const ca = centres[i][k];
          const ra = B.topo[k].bs.r;
          if (len(sub(ca, P[j])) > ra + C.R) continue;
          for (let m = 0; m < C.topo.length; m++) {
            const cb = centres[j][m];
            const rr = ra + C.topo[m].bs.r;
            const dx = ca[0] - cb[0];
            const dy = ca[1] - cb[1];
            const dz = ca[2] - cb[2];
            if (dx * dx + dy * dy + dz * dz > rr * rr) continue;
            pairsTested++;
            const sd = polyPoly(piece(i, k), piece(j, m));
            if (-sd > penDynamic) {
              penDynamic = -sd;
              worstDynamic = { bodyA: i, pieceA: k, bodyB: j, pieceB: m };
            }
          }
        }
      }
    }
    return { penStatic, penDynamic, worstStatic, worstDynamic, pairsTested };
  }
  return { measure, free: () => {} };
}

/**
 * Diagnostic: for every body, the minimum signed distance (m) to the static shapes of each tag
 * (negative = penetrating, positive = air gap). Used to tell "resting on" from "hovering above".
 * Only capsule statics are considered; pairs further apart than `band` are ignored.
 */
export function clearances(scene, state, band = 0.01) {
  const out = [];
  scene.bodies.forEach((b, i) => {
    const o = i * 13;
    const P = [state[o], state[o + 1], state[o + 2]];
    const Q = [state[o + 3], state[o + 4], state[o + 5], state[o + 6]];
    const topo = scene.shapes[b.shape].pieces.map(pieceTopology);
    const res = {};
    topo.forEach((t) => {
      const w = { V: t.V.map((v) => add(P, qRot(Q, v))), normals: t.normals.map((n) => qRot(Q, n)), edgeDirs: t.edgeDirs.map((n) => qRot(Q, n)), edges: t.edges };
      const c = add(P, qRot(Q, t.bs.c));
      for (const s of scene.statics) {
        if (s.type !== 'capsule') continue;
        if (len(sub(c, closestOnSeg(c, s.a, s.b))) > t.bs.r + s.r + band) continue;
        const sd = polySegment(w, s.a, s.b, Infinity) - s.r;
        if (res[s.tag] == null || sd < res[s.tag]) res[s.tag] = sd;
      }
    });
    out.push(res);
  });
  return out;
}

/**
 * Diagnostic: lower bound (m) on the air gap between consecutive bodies i and i+1 (negative = exact
 * penetration depth). SAT without early-out gives max-over-axes separation per piece pair, which never
 * exceeds the true distance, so a positive result proves the two bodies are NOT touching.
 */
export function bodyGapLowerBound(scene, state) {
  const world = scene.bodies.map((b, i) => {
    const o = i * 13;
    const P = [state[o], state[o + 1], state[o + 2]];
    const Q = [state[o + 3], state[o + 4], state[o + 5], state[o + 6]];
    return scene.shapes[b.shape].pieces.map(pieceTopology).map((t) => ({ V: t.V.map((v) => add(P, qRot(Q, v))), normals: t.normals.map((n) => qRot(Q, n)), edgeDirs: t.edgeDirs.map((n) => qRot(Q, n)), c: add(P, qRot(Q, t.bs.c)), r: t.bs.r }));
  });
  const sepFull = (a, b) => {
    let best = -Infinity;
    const test = (n) => {
      const [la, ha] = interval(a.V, n);
      const [lb, hb] = interval(b.V, n);
      best = Math.max(best, la - hb, lb - ha);
    };
    a.normals.forEach(test);
    b.normals.forEach(test);
    for (const e of a.edgeDirs) for (const f of b.edgeDirs) { const n = unit(cross(e, f)); if (n) test(n); }
    return best;
  };
  const out = [];
  for (let i = 0; i + 1 < world.length; i++) {
    let min = Infinity;
    for (const a of world[i]) for (const b of world[i + 1]) {
      if (len(sub(a.c, b.c)) > a.r + b.r + 0.02) continue;
      min = Math.min(min, sepFull(a, b));
    }
    out.push(min);
  }
  return out;
}
