import numpy as np, math, sys
from s1d import *
which=sys.argv[1] if len(sys.argv)>1 else 'all'
def incline(beta,dx,Gam,order=2,dry=False,rough=0.0,tend=8.0,L=0.3,mode='regime',thA=45.0,thR=15.0):
    b=math.radians(beta); gs=g*math.sin(b); n=int(round(L/dx)); bed=Bed(n,dx,'incline',beta=beta)
    hN=(3*nu*Gam/(rho*gs))**(1/3); uN=Gam/(rho*hN); rng=np.random.default_rng(1)
    h=np.full(n,0.0 if dry else hN)*(1+rough*rng.uniform(-1,1,n)); q=h*uN; wet=h>ddry; t=0.0; ah=0; aq=0; c=0; front=[]
    marks=[2.0,4.0,8.0]
    while t<tend:
        dt=cfl_dt(h,q,bed,hN*0.5); h,q,wet=step(h,q,wet,bed,dt,order=order,inflow=(hN,uN),mode=mode,thA=thA,thR=thR); t+=dt
        if t>tend-2: ah=ah+h; aq=aq+q; c+=1
        if marks and t>=marks[0]:
            wt=np.where(wet)[0]; front.append(((wt.max()+1)*dx*1e3 if len(wt) else 0.0, h.max()*1e3)); marks.pop(0)
    m=slice(n//2-5,n//2+5)
    return (ah/c)[m].mean()/hN,(aq/c)[m].mean()/(hN*uN),np.std(h[m])/hN,dx*math.tan(b)/hN,front,h
if which in ('all','incline'):
    print("A. steady film on an incline, time-mean over the last 2 s at mid-plate: h/h_N, flux/flux_N (instantaneous rms of h)")
    worst=0
    for beta in (5,10,45,80):
        for dx in (2e-3,1e-3):
            for Gam in (0.005,0.02,0.2):
                a=incline(beta,dx,Gam); r=incline(beta,dx,Gam,rough=0.3)
                worst=max(worst,abs(a[0]-1),abs(a[1]-1),abs(r[0]-1),abs(r[1]-1))
                print(f"  beta {beta:2d} dx {dx*1e3:.0f} mm Gamma {Gam:5.3f} bed step/h {a[3]:6.1f} | smooth h x{a[0]:.4f} q x{a[1]:.4f} rms {a[2]:.4f} | rough start h x{r[0]:.4f} q x{r[1]:.4f} rms {r[2]:.4f}")
    print(f"  worst deviation {worst:.5f}")
if which in ('all','front'):
    print("B. dry start: front position (mm) at 2, 4, 8 s and ridge at 2 s, advancing angle 45 and 5 deg")
    for beta,dx,Gam in ((10,2e-3,0.02),(45,2e-3,0.02),(45,1e-3,0.02),(45,2e-3,0.005),(80,2e-3,0.02),(80,1e-3,0.02),(45,2e-3,0.2),(45,1e-3,0.2)):
        a=incline(beta,dx,Gam,dry=True); c=incline(beta,dx,Gam,dry=True,thA=5.0,thR=2.0)
        b=math.radians(beta); hN=(3*nu*Gam/(rho*g*math.sin(b)))**(1/3); uN=Gam/(rho*hN)
        print(f"  beta {beta:2d} dx {dx*1e3:.0f} mm Gamma {Gam:5.3f} (u_N {uN*1e3:.0f} mm/s): 45 deg front {a[4][0][0]:.0f}, {a[4][1][0]:.0f}, {a[4][2][0]:.0f} mm, ridge {a[4][0][1]:.2f} mm, ridge area {a[4][0][1]*dx*1e3:.2f} mm2 (l_c^2 (1 - cos 45) = {sigma/(rho*g)*(1-math.cos(math.radians(45)))*1e6:.2f}); mid h x{a[0]:.3f} q x{a[1]:.3f} | 5 deg front {c[4][0][0]:.0f}, {c[4][1][0]:.0f}, {c[4][2][0]:.0f} mm, ridge {c[4][0][1]:.2f} mm")
if which in ('all','lake'):
    print("C1. lake at rest, fully submerged section of a circular trough R = 40 mm, 20,000 steps")
    R=0.04
    for dx in (2e-3,1e-3):
        n=int(round(0.02/dx)); bed=Bed(n,dx,'trough',R=R,s0=-0.01); h=np.maximum(0,(g*0.004-bed.Bc)/bed.Gc); q=np.zeros(n); wet=h>ddry; m0=h.sum()
        for k in range(20000): h,q,wet=step(h,q,wet,bed,cfl_dt(h,q,bed),walls=True)
        lev=(bed.Bc+bed.Gc*h)/g
        print(f"  dx {dx*1e3:.0f} mm: max |u| {np.abs(q/h).max():.1e} m/s; level spread {1e6*(lev.max()-lev.min()):.1e} um; mass drift {(h.sum()-m0)/m0:+.1e}")
if which in ('all','fill'):
    print("D. film down the wall of a closed trough for 4 s, then 8 s of rest (angles 45/15)")
    R=0.04
    for dx in (2e-3,1e-3):
        n=int(round(0.12/dx)); bed=Bed(n,dx,'trough',R=R,s0=-0.06); h=np.zeros(n); q=np.zeros(n); wet=h>ddry; t=0.0; fed=0.0
        while t<12.0:
            dt=cfl_dt(h,q,bed); Gam=0.02 if t<4.0 else 0.0; hin=1.5e-4; uin=Gam/(rho*hin)
            h,q,wet=step(h,q,wet,bed,dt,inflow=(hin,uin),walls=True); fed+=dt*Gam/rho; t+=dt
        lev=(bed.Bc+bed.Gc*h)/g; pool=wet&(h>5e-4)
        A=h[pool].sum()*dx; lo,hi=0.0,1.0
        for _ in range(60):
            a=(lo+hi)/2
            if R*R*(a-math.sin(a)*math.cos(a))<A: lo=a
            else: hi=a
        print(f"  dx {dx*1e3:.0f} mm: held/fed {h.sum()*dx/fed:.6f}; min h {h.min():.1e}; pool cells {pool.sum()}; pool level {1e3*lev[pool].mean():.3f} mm against {1e3*R*(1-math.cos(a)):.3f} mm for a level surface holding the pooled volume; spread {1e6*(lev[pool].max()-lev[pool].min()):.1f} um; max |u| in the pool {np.abs(q[pool]/h[pool]).max():.1e} m/s; outside the pool {h[~pool].sum()*dx/fed*100:.1f} % of the volume")
if which in ('all','drain'):
    print("E. drainage of a wetted 0.25 m plate at 80 deg after the supply stops; Jeffreys h = sqrt(nu s / (g sin(beta) t)) at s = 0.2 m; position of the upper contact line")
    for thA,thR in ((20,3),(45,15),(50,25)):
        Vdw=5e-3*(sigma/(rho*nu))*math.radians(thR)**3
        for dx in (2e-3,1e-3):
            beta=80; b=math.radians(beta); gs=g*math.sin(b); n=int(round(0.25/dx)); bed=Bed(n,dx,'incline',beta=beta)
            hN=(3*nu*0.03/(rho*gs))**(1/3); h=np.full(n,hN); q=h*0.03/(rho*hN); wet=h>ddry; t=0.0; out=[]; marks=[2.0,10.0,30.0]
            while t<30.0:
                dt=cfl_dt(h,q,bed,5e-5); h,q,wet=step(h,q,wet,bed,dt,thA=thA,thR=thR); t+=dt
                if marks and t>=marks[0]:
                    i=int(0.2/dx); wt=np.where(wet)[0]; top=(wt.min()*dx*1e3 if len(wt) else 250.0)
                    hj=math.sqrt(nu*0.2/(gs*t)); out.append(f"t {marks[0]:.0f} s: h {h[i]*1e6:.1f} um (Jeffreys {hj*1e6:.1f}, x{h[i]/hj:.3f}), contact line at {top:.0f} mm"); marks.pop(0)
            print(f"  angles {thA}/{thR} (V_dw {Vdw*1e3:.2f} mm/s) dx {dx*1e3:.0f} mm: "+"; ".join(out))
