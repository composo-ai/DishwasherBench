import numpy as np, math, sys
from s1d import *
R=0.04
print("C2. puddle in a circular trough R = 40 mm, started level, 12 s")
for thA,thR in ((45,0),(20,5),(45,10),(45,15),(50,25),(95,60)):
    Vdw=5e-3*(sigma/(rho*nu))*math.radians(thR)**3; lc=math.sqrt(sigma/(rho*g))
    for dx in (2e-3,1e-3):
        for lvl in (0.001,0.003):
            n=int(round(0.06/dx)); bed=Bed(n,dx,'trough',R=R,s0=-0.03); h=np.maximum(0,(g*lvl-bed.Bc)/bed.Gc); q=np.zeros(n); wet=h>ddry; m0=h.sum(); w0=wet.sum(); t=0; ul=0; tl=0
            while t<12.0:
                dt=cfl_dt(h,q,bed); h,q,wet=step(h,q,wet,bed,dt,walls=True,thA=thA,thR=thR); t+=dt
                if t>10.0:
                    u=np.abs(q[wet]/h[wet]); ul=max(ul,u.max()); tl=max(tl,(3*rho*nu*u/h[wet]).max())
            idx=np.where(wet)[0]; lev=(bed.Bc+bed.Gc*h)/g
            print(f"  angles {thA}/{thR} (V_dw {Vdw*1e3:6.2f} mm/s; 2 l_c sin(theta_r/2) = {2*lc*math.sin(math.radians(thR/2))*1e3:.2f} mm) dx {dx*1e3:.0f} mm level {lvl*1e3:.0f} mm: wet cells {w0} -> {wet.sum()}; last 2 s: max |u| {ul*1e3:.3f} mm/s, max wall shear {tl:.4f} Pa; edge depth {h[idx[0]]*1e3:.2f} mm; level spread {1e6*(lev[wet].max()-lev[wet].min()):.1f} um; liquid left outside wet cells {h[~wet].sum()/m0*100:.2f} %; volume {(h.sum()-m0)/m0:+.0e}")
