# Throwaway audit: M3 test "GPU tracer against the f64 reference, 10^8 rays: hit point within 2 um".
# Ray against a cylinder band (frustum with constant radius) in item-local f32, stable quadratic root + one Newton step on g(t) = r(t) - R,
# compared with the same algorithm in f64. Random rays aimed to pass at impact parameter b = R (1 - eps) from the axis.
import numpy as np
rng = np.random.default_rng(1)
def hit(o, d, R, dtype):
    o = o.astype(dtype); d = d.astype(dtype); R = dtype(R)
    a = d[:,0]*d[:,0] + d[:,1]*d[:,1]
    b = o[:,0]*d[:,0] + o[:,1]*d[:,1]
    c = o[:,0]*o[:,0] + o[:,1]*o[:,1] - R*R
    disc = b*b - a*c
    ok = disc > 0
    sq = np.sqrt(np.where(ok, disc, dtype(0)))
    qv = -(b + np.sign(b)*sq)
    t0 = qv/a; t1 = c/np.where(qv != 0, qv, dtype(1))
    t = np.minimum(t0, t1)                      # first (entry) root
    # one Newton step on g(t) = r(t) - R
    x = o[:,0] + t*d[:,0]; y = o[:,1] + t*d[:,1]; r = np.sqrt(x*x + y*y)
    gp = (x*d[:,0] + y*d[:,1])/r
    t = t - (r - R)/np.where(gp != 0, gp, dtype(1))
    return ok, t
N = 2_000_000
for R in (0.040, 0.004, 0.0015):          # glass wall, stem, rack wire (m)
    print(f"cylinder radius {R*1e3:.1f} mm")
    for eps in (1e-1, 1e-2, 1e-3, 1e-4, 1e-5):
        ang = rng.uniform(0, 2*np.pi, N)
        dirv = np.stack([np.cos(ang), np.sin(ang), rng.uniform(-0.5, 0.5, N)], 1); dirv /= np.linalg.norm(dirv, axis=1)[:,None]
        nperp = np.stack([-np.sin(ang), np.cos(ang), np.zeros(N)], 1)
        bimp = R*(1 - eps*rng.uniform(0.5, 1.5, N))
        foot = nperp*bimp[:,None]
        o = foot - dirv*rng.uniform(0.05, 0.25, N)[:,None]; o[:,2] += rng.uniform(-0.05, 0.05, N)
        ok64, t64 = hit(o, dirv, R, np.float64)
        ok32, t32 = hit(o, dirv, R, np.float32)
        both = ok64 & ok32
        dpos = np.abs(t32[both].astype(np.float64) - t64[both])     # distance along the ray = hit-point error
        cosinc = np.sqrt(2*eps)                                      # |cos(incidence)| at the hit, approx
        print(f"   grazing depth eps {eps:.0e} (|cos inc| ~ {cosinc:.3f}): hit/miss disagreement {np.mean(ok64 != ok32)*100:6.3f} %;"
              f" hit-point error median {np.median(dpos)*1e6:8.3f} um, 99th pct {np.percentile(dpos,99)*1e6:8.2f} um, share above 2 um {np.mean(dpos>2e-6)*100:6.2f} %")
