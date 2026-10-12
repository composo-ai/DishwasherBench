// Pure-JS parts of the B1 stencil (no WebGPU import, so it is safe to load inside worker_threads).
// Generated from stencil.mjs: parameters, the deterministic initial state and the two CPU reference steppers.

export const PARAMS = { lam: 0.2, g: 1.0, fric: 0.002, eps: 1e-4, decay: 1e-4 };

/** Deterministic initial state with wet and dry regions. */
export function initState(w, h) {
  const a = new Float32Array(w * h * 4);
  const kx = (2 * Math.PI * 3) / w, ky = (2 * Math.PI * 2) / h;
  for (let y = 0; y < h; y++) {
    const sy = Math.sin(y * ky), cy = Math.cos(y * ky * 2.5);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      // integer hash noise in [0,1)
      let n = (x * 374761393 + y * 668265263) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n = (n ^ (n >>> 16)) >>> 0;
      const r = n / 4294967296;
      const hh = Math.max(0, 0.35 + 0.5 * Math.sin(x * kx) * sy + 0.25 * Math.cos(x * kx * 3.7) * cy + 0.05 * r - 0.2);
      a[i] = hh;
      a[i + 1] = 0.1 * hh * cy;
      a[i + 2] = -0.1 * hh * sy;
      a[i + 3] = hh * r;
    }
  }
  return a;
}

// ---- JS reference (float32 semantics via Math.fround, same operation order as the WGSL, no FMA) ----
export function jsStepF32(src, dst, w, h, y0 = 0, y1 = h, P = PARAMS) {
  const f = Math.fround;
  const lam = f(P.lam), g = f(P.g), fric = f(P.fric), eps = f(P.eps), decay = f(P.decay);
  const halfLam = f(f(0.5) * lam), halfG = f(f(0.5) * g);
  for (let y = y0; y < y1; y++) {
    const yd = (y > 0 ? y - 1 : 0) * w, yu = (y < h - 1 ? y + 1 : h - 1) * w, yc = y * w;
    for (let x = 0; x < w; x++) {
      const xl = x > 0 ? x - 1 : 0, xr = x < w - 1 ? x + 1 : w - 1;
      const c = (yc + x) * 4, l = (yc + xl) * 4, r = (yc + xr) * 4, d = (yd + x) * 4, u = (yu + x) * 4;
      // fluxX(R), fluxX(L)
      let ih = f(1 / Math.max(src[r], eps)); let vel = f(src[r + 1] * ih);
      const fr0 = src[r + 1], fr1 = f(f(src[r + 1] * vel) + f(f(halfG * src[r]) * src[r])), fr2 = f(src[r + 2] * vel), fr3 = f(src[r + 3] * vel);
      ih = f(1 / Math.max(src[l], eps)); vel = f(src[l + 1] * ih);
      const fl0 = src[l + 1], fl1 = f(f(src[l + 1] * vel) + f(f(halfG * src[l]) * src[l])), fl2 = f(src[l + 2] * vel), fl3 = f(src[l + 3] * vel);
      // fluxY(U), fluxY(D)
      ih = f(1 / Math.max(src[u], eps)); vel = f(src[u + 2] * ih);
      const gu0 = src[u + 2], gu1 = f(src[u + 1] * vel), gu2 = f(f(src[u + 2] * vel) + f(f(halfG * src[u]) * src[u])), gu3 = f(src[u + 3] * vel);
      ih = f(1 / Math.max(src[d], eps)); vel = f(src[d + 2] * ih);
      const gd0 = src[d + 2], gd1 = f(src[d + 1] * vel), gd2 = f(f(src[d + 2] * vel) + f(f(halfG * src[d]) * src[d])), gd3 = f(src[d + 3] * vel);
      let n0 = f(f(f(f(0.5) * src[c]) + f(f(0.125) * f(f(f(src[l] + src[r]) + src[d]) + src[u]))) - f(halfLam * f(f(f(fr0 - fl0) + gu0) - gd0)));
      let n1 = f(f(f(f(0.5) * src[c + 1]) + f(f(0.125) * f(f(f(src[l + 1] + src[r + 1]) + src[d + 1]) + src[u + 1]))) - f(halfLam * f(f(f(fr1 - fl1) + gu1) - gd1)));
      let n2 = f(f(f(f(0.5) * src[c + 2]) + f(f(0.125) * f(f(f(src[l + 2] + src[r + 2]) + src[d + 2]) + src[u + 2]))) - f(halfLam * f(f(f(fr2 - fl2) + gu2) - gd2)));
      let n3 = f(f(f(f(0.5) * src[c + 3]) + f(f(0.125) * f(f(f(src[l + 3] + src[r + 3]) + src[d + 3]) + src[u + 3]))) - f(halfLam * f(f(f(fr3 - fl3) + gu3) - gd3)));
      if (n0 < eps) {
        n0 = Math.max(n0, 0); n1 = 0; n2 = 0; n3 = Math.max(n3, 0);
      } else {
        const s = f(n0 / f(n0 + fric));
        n1 = f(n1 * s); n2 = f(n2 * s); n3 = Math.max(f(n3 - f(decay * src[c + 3])), 0);
      }
      dst[c] = n0; dst[c + 1] = n1; dst[c + 2] = n2; dst[c + 3] = n3;
    }
  }
}

// Same arithmetic without Math.fround (double intermediates, rounded on store): the idiomatic fast JS form.
export function jsStepF64(src, dst, w, h, y0 = 0, y1 = h, P = PARAMS) {
  const lam = P.lam, g = P.g, fric = P.fric, eps = P.eps, decay = P.decay;
  const halfLam = 0.5 * lam, halfG = 0.5 * g;
  for (let y = y0; y < y1; y++) {
    const yd = (y > 0 ? y - 1 : 0) * w, yu = (y < h - 1 ? y + 1 : h - 1) * w, yc = y * w;
    for (let x = 0; x < w; x++) {
      const xl = x > 0 ? x - 1 : 0, xr = x < w - 1 ? x + 1 : w - 1;
      const c = (yc + x) * 4, l = (yc + xl) * 4, r = (yc + xr) * 4, d = (yd + x) * 4, u = (yu + x) * 4;
      let ih = 1 / Math.max(src[r], eps); let vel = src[r + 1] * ih;
      const fr0 = src[r + 1], fr1 = src[r + 1] * vel + halfG * src[r] * src[r], fr2 = src[r + 2] * vel, fr3 = src[r + 3] * vel;
      ih = 1 / Math.max(src[l], eps); vel = src[l + 1] * ih;
      const fl0 = src[l + 1], fl1 = src[l + 1] * vel + halfG * src[l] * src[l], fl2 = src[l + 2] * vel, fl3 = src[l + 3] * vel;
      ih = 1 / Math.max(src[u], eps); vel = src[u + 2] * ih;
      const gu0 = src[u + 2], gu1 = src[u + 1] * vel, gu2 = src[u + 2] * vel + halfG * src[u] * src[u], gu3 = src[u + 3] * vel;
      ih = 1 / Math.max(src[d], eps); vel = src[d + 2] * ih;
      const gd0 = src[d + 2], gd1 = src[d + 1] * vel, gd2 = src[d + 2] * vel + halfG * src[d] * src[d], gd3 = src[d + 3] * vel;
      let n0 = 0.5 * src[c] + 0.125 * (src[l] + src[r] + src[d] + src[u]) - halfLam * (fr0 - fl0 + gu0 - gd0);
      let n1 = 0.5 * src[c + 1] + 0.125 * (src[l + 1] + src[r + 1] + src[d + 1] + src[u + 1]) - halfLam * (fr1 - fl1 + gu1 - gd1);
      let n2 = 0.5 * src[c + 2] + 0.125 * (src[l + 2] + src[r + 2] + src[d + 2] + src[u + 2]) - halfLam * (fr2 - fl2 + gu2 - gd2);
      let n3 = 0.5 * src[c + 3] + 0.125 * (src[l + 3] + src[r + 3] + src[d + 3] + src[u + 3]) - halfLam * (fr3 - fl3 + gu3 - gd3);
      if (n0 < eps) {
        n0 = Math.max(n0, 0); n1 = 0; n2 = 0; n3 = Math.max(n3, 0);
      } else {
        const s = n0 / (n0 + fric);
        n1 = n1 * s; n2 = n2 * s; n3 = Math.max(n3 - decay * src[c + 3], 0);
      }
      dst[c] = n0; dst[c + 1] = n1; dst[c + 2] = n2; dst[c + 3] = n3;
    }
  }
}
