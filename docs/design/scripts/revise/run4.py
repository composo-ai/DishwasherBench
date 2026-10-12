import numpy as np, math, sys
src=open('sscheme4.py').read().split("which=sys.argv")[0]
MODE=sys.argv[1]
exec(src)
wlo,whi=0.25,0.75
def incl(beta,dx,Gam,order,rough=0.0,dry=False,tend=8.0,L=0.2,thA=None,thR=None,seed=0):
    b=math.radians(beta); gs=g*math.sin(b); n=int(round(L/dx)); bed=Bed(n,dx,'incline',beta=beta)
    hN=(3*nu*Gam/(rho*gs))**(1/3); uN=Gam/(rho*hN); rng=np.random.default_rng(seed)
    h=np.full(n,0.0 if dry else hN)*(1+rough*rng.uniform(-1,1,n)); q=h*uN; t=0.0; acc_h=0; acc_q=0; cnt=0
    while t<tend:
        dt=min(cfl_dt(np.maximum(h,hN*0.5),q,bed),2e-3); h,q=step(h,q,bed,dt,order,wlo,whi,inflow=(hN,uN),thA=thA,thR=thR); t+=dt
        if t>tend-2.0: acc_h=acc_h+h; acc_q=acc_q+q; cnt+=1
    m=slice(n//2-5,n//2+5); hm=(acc_h/cnt)[m].mean(); qm=(acc_q/cnt)[m].mean()
    return hm/hN, qm/(hN*uN), np.std(h[m])/hN, dx*math.tan(b)/hN
print(f"MODE {MODE}: time-mean h/h_N and flux/flux_N over the last 2 s at mid-plate (instantaneous rms of h)")
worst=0
for beta in (5,10,45,80):
    for dx in (2e-3,1e-3):
        for Gam in (0.005,0.02,0.2):
            a=incl(beta,dx,Gam,2); r=incl(beta,dx,Gam,2,rough=0.3); d=incl(beta,dx,Gam,2,dry=True,thA=45,thR=15); o1=incl(beta,dx,Gam,1)
            worst=max(worst,abs(a[0]-1),abs(a[1]-1),abs(d[0]-1),abs(r[0]-1))
            print(f"  beta {beta:2d} dx {dx*1e3:.0f} Gamma {Gam:5.3f} step/h {a[3]:5.1f} | smooth h x{a[0]:.3f} q x{a[1]:.3f} (rms {a[2]:.3f}) | rough start h x{r[0]:.3f} q x{r[1]:.3f} (rms {r[2]:.3f}) | dry start h x{d[0]:.3f} q x{d[1]:.3f} (rms {d[2]:.3f}) | no slopes h x{o1[0]:.3f} q x{o1[1]:.3f}")
print(f"  worst deviation of time-mean h or flux, second order: {worst:.4f}")
R=0.04
for thA,thR in ((45,0),(45,15)):
    for dx in (2e-3,1e-3):
        lvl=0.003; n=int(round(0.06/dx)); bed=Bed(n,dx,'trough',R=R,s0=-0.03); eta0=g*lvl; h=np.maximum(0,(eta0-bed.Bc)/bed.Gc); q=np.zeros(n)
        for k in range(30000):
            dt=min(cfl_dt(np.maximum(h,1e-4),q,bed),1e-3); h,q=step(h,q,bed,dt,2,wlo,whi,walls=True,thA=thA,thR=thR)
        wet=h>ddry; lev=(bed.Bc+bed.Gc*h)/g; inner=wet.copy(); idx=np.where(wet)[0]; inner[idx[:2]]=False; inner[idx[-2:]]=False
        print(f"  puddle, angles {thA}/{thR}, dx {dx*1e3:.0f} mm: wet {wet.sum()}; max |u| all {np.abs(q[wet]/h[wet]).max():.2e}, two cells in from the shore {np.abs(q[inner]/h[inner]).max():.2e} m/s; level spread inner {1e6*(lev[inner].max()-lev[inner].min()):.3f} um; edge depth {h[wet][0]*1e3:.2f} mm")
for dx in (2e-3,1e-3):
    n=int(round(0.12/dx)); bed=Bed(n,dx,'trough',R=R,s0=-0.06); h=np.zeros(n); q=np.zeros(n); t=0.0; fed=0.0
    while t<12.0:
        dt=min(cfl_dt(np.maximum(h,1e-4),q,bed),1e-3); Gam=0.02 if t<4.0 else 0.0; hin=1.5e-4; uin=Gam/(rho*hin)
        h,q=step(h,q,bed,dt,2,wlo,whi,inflow=(hin,uin),walls=True,thA=45,thR=15); fed+=dt*Gam/rho; t+=dt
    wet=h>ddry; lev=(bed.Bc+bed.Gc*h)/g; idx=np.where(h>5e-4)[0]; pool=np.zeros(n,bool); pool[idx]=True
    print(f"  fill then rest, dx {dx*1e3:.0f} mm: held/fed {h.sum()*dx/fed:.6f}; pool cells (h > 0.5 mm) {pool.sum()}, level spread {1e6*(lev[pool].max()-lev[pool].min()):.2f} um, max |u| {np.abs(q[pool]/h[pool]).max():.2e} m/s")
