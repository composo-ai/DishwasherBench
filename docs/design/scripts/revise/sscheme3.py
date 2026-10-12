import numpy as np, math
exec(open('sscheme2.py').read().split("which=sys.argv")[0])
R=0.04
for label,wlo,whi,thA,thR in (("regime 0.25..0.75, angles 45/15",0.25,0.75,45,15),("lake weight 1 everywhere, angles 45/15",-2,-1,45,15),("regime, angles 45/5",0.25,0.75,45,5),("regime, angles 45/0 (no retraction drive)",0.25,0.75,45,0),("lake weight, angles 45/0",-2,-1,45,0)):
    for dx in (2e-3,1e-3):
        lvl=0.003; n=int(round(0.06/dx)); bed=Bed(n,dx,'trough',R=R,s0=-0.03); eta0=g*lvl; h=np.maximum(0,(eta0-bed.Bc)/bed.Gc); q=np.zeros(n); m0=h.sum()
        hist=[]
        for k in range(60000):
            dt=min(cfl_dt(np.maximum(h,1e-4),q,bed),1e-3); h,q=step(h,q,bed,dt,2,wlo,whi,walls=True,thA=thA,thR=thR)
            if k%10000==9999:
                wet=h>ddry; hist.append(np.abs(q[wet]/h[wet]).max())
        wet=h>ddry; lev=(bed.Bc+bed.Gc*h)/g; deep=h*bed.Gc>0.75*np.abs(bed.Bf[1:]-bed.Bf[:-1])
        print(f"{label:42s} dx {dx*1e3:.0f} mm: wet {wet.sum()}; max|u| history {' '.join('%.1e'%x for x in hist)}; level spread deep {1e6*(lev[deep].max()-lev[deep].min()):.2f} um; edge depths {h[wet][0]*1e3:.2f}/{h[wet][-1]*1e3:.2f} mm")
