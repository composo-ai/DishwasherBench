# Throwaway audit: can a flux-form f32 update hold "total mass to 1e-6 over 1e5..1e6 steps" (M7.11 property test and seam test)?
# 1-D film draining down a wall into a closed pocket (thick cells next to thin ones), the same flux number applied to both cells.
import numpy as np
def run(dtype, nsteps, dt=2.5e-4, n=128, dx=1e-3):
    g=dtype(9.81); nu=dtype(5.5e-7); dx=dtype(dx); dt=dtype(dt)
    h=np.full(n, 2e-4, dtype=dtype); h[-8:]=dtype(3e-3)          # 0.2 mm film above a 3 mm deep pocket
    m0=float(np.sum(h.astype(np.float64)))
    for s in range(nsteps):
        q=(g*h*h*h/(dtype(3)*nu)).astype(dtype)                   # m2/s, upwind (downhill = increasing index)
        q[-8:]=dtype(0)                                           # no flow inside or out of the pocket
        F=(q[:-1]*dt/dx).astype(dtype)
        F=np.minimum(F, h[:-1])                                   # positivity cap
        h[:-1]=(h[:-1]-F).astype(dtype); h[1:]=(h[1:]+F).astype(dtype)
    return (float(np.sum(h.astype(np.float64)))-m0)/m0
for nsteps in (100_000, 400_000):
    print(f"steps {nsteps}: relative mass drift f32 {run(np.float32,nsteps):+.2e}   f64 {run(np.float64,nsteps):+.2e}")
