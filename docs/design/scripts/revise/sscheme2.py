# Throwaway: 1-D check of the S flux form of sim-core.md M7.4, second version: regime weight thresholds (wlo, whi) on depth / bed step,
# wet-dry faces carry only the wet cell's upwind advective flux, contact-line force clamp(F_hold, F_r, F_a) on the front cell's momentum.
import numpy as np, math, sys
rho=988.0; nu=5.5e-7; g=9.81; sigma=0.040; bm=1.2; ddry=2e-6
def minmod(a,b): return np.where(a*b>0, np.where(np.abs(a)<np.abs(b),a,b), 0.0)
def smoothstep(x,a,b):
    t=np.clip((x-a)/(b-a),0,1); return t*t*(3-2*t)
class Bed:
    def __init__(s, n, dx, kind, beta=None, R=None, s0=0.0):
        s.n=n; s.dx=dx; sc=(np.arange(n)+0.5)*dx+s0; sf=np.arange(n+1)*dx+s0
        if kind=='incline':
            b=math.radians(beta); s.Bc=-g*math.sin(b)*sc; s.Bf=-g*math.sin(b)*sf; s.Gc=np.full(n,g*math.cos(b)); s.Gf=np.full(n+1,g*math.cos(b))
        else:
            s.Bc=g*R*(1-np.cos(sc/R)); s.Bf=g*R*(1-np.cos(sf/R)); s.Gc=g*np.cos(sc/R); s.Gf=g*np.cos(sf/R)
def stage(h,q,bed,dt,order,wlo,whi,inflow=None,fric=True,thA=None,thR=None,walls=False):
    n=bed.n; dx=bed.dx; Bc,Bf,Gc,Gf=bed.Bc,bed.Bf,bed.Gc,bed.Gf; eps=1e-6
    wet=h>ddry
    u=np.sqrt(2)*h*q/np.sqrt(h**4+np.maximum(h**4,eps**4)); u=np.where(wet,u,0.0)
    eta=Bc+Gc*h
    def slope(a):
        sl=np.zeros_like(a)
        if order==2: d=np.diff(a); sl[1:-1]=minmod(d[:-1],d[1:])
        return sl
    sh=slope(h); su=slope(u); se=slope(eta)
    hm=np.maximum(0,h-0.5*sh); hp=np.maximum(0,h+0.5*sh); um=u-0.5*su; up=u+0.5*su; em=eta-0.5*se; ep=eta+0.5*se
    dB=np.abs(Bf[1:]-Bf[:-1])+1e-30
    w=np.where(Gc>0, smoothstep(Gc*h/dB,wlo,whi), 0.0)
    ehm=(1-w)*(Bf[:-1]+Gf[:-1]*hm)+w*em; ehp=(1-w)*(Bf[1:]+Gf[1:]*hp)+w*ep
    bm_=ehm-Gf[:-1]*hm; bp_=ehp-Gf[1:]*hp
    GfI=Gf[1:-1]; bL=bp_[:-1]; bR=bm_[1:]; hL=hp[:-1]; hR=hm[1:]; uL=up[:-1]; uR=um[1:]
    bs=np.maximum(bL,bR); pos=GfI>0; Gs=np.where(pos,GfI,1)
    hLs=np.where(pos,np.maximum(0,hL-(bs-bL)/Gs),hL); hRs=np.where(pos,np.maximum(0,hR-(bs-bR)/Gs),hR)
    cc=lambda hh: np.sqrt(np.maximum(GfI,0)*hh+4*sigma*hh/(rho*dx*dx))
    cL=cc(hLs); cR=cc(hRs)
    sLm=np.minimum(bm*uL-np.sqrt(bm*(bm-1)*uL**2+cL**2), bm*uR-np.sqrt(bm*(bm-1)*uR**2+cR**2))
    sRp=np.maximum(bm*uL+np.sqrt(bm*(bm-1)*uL**2+cL**2), bm*uR+np.sqrt(bm*(bm-1)*uR**2+cR**2))
    den=np.where(sRp-sLm>1e-12,sRp-sLm,1e-12)
    FhL=hLs*uL; FhR=hRs*uR; PL=0.5*GfI*hLs**2; PR=0.5*GfI*hRs**2
    FqL=bm*hLs*uL**2+PL; FqR=bm*hRs*uR**2+PR
    Fh=np.where(sLm>=0,FhL,np.where(sRp<=0,FhR,(sRp*FhL-sLm*FhR+sLm*sRp*(hRs-hLs))/den))
    Fq=np.where(sLm>=0,FqL,np.where(sRp<=0,FqR,(sRp*FqL-sLm*FqR+sLm*sRp*(hRs*uR-hLs*uL))/den))
    # wet-dry faces: only the wet cell's start-of-stage outward advective flux; no pressure jump
    wl=wet[:-1]; wr=wet[1:]; fr=wl&~wr; fl=~wl&wr; dd=~wl&~wr
    Fh=np.where(fr,h[:-1]*np.maximum(u[:-1],0),Fh); Fq_L=np.where(fr,bm*h[:-1]*np.maximum(u[:-1],0)*u[:-1],Fq-PL); Fq_R=np.where(fr,bm*h[:-1]*np.maximum(u[:-1],0)*u[:-1],Fq-PR)
    Fh=np.where(fl,h[1:]*np.minimum(u[1:],0),Fh); Fq_L=np.where(fl,bm*h[1:]*np.minimum(u[1:],0)*u[1:],Fq_L); Fq_R=np.where(fl,bm*h[1:]*np.minimum(u[1:],0)*u[1:],Fq_R)
    Fh=np.where(dd,0,Fh); Fq_L=np.where(dd,0,Fq_L); Fq_R=np.where(dd,0,Fq_R)
    out=np.zeros(n); out[:-1]+=np.maximum(Fh,0); out[1:]+=np.maximum(-Fh,0)
    lim=np.where(out*dt/dx>h, h/(out*dt/dx+1e-300), 1.0)
    Fh=np.where(Fh>0,Fh*lim[:-1],Fh*lim[1:])
    hn=h.copy(); qn=q.copy()
    hn[:-1]-=dt/dx*Fh; hn[1:]+=dt/dx*Fh
    qn[:-1]-=dt/dx*Fq_L; qn[1:]+=dt/dx*Fq_R
    qn-=np.where(wet,dt/dx*(0.5*(hp+h)*(ehp-eta)-0.5*(hm+h)*(ehm-eta)),0.0)
    if inflow is not None:
        hin,uin=inflow; hn[0]+=dt/dx*hin*uin; qn[0]+=dt/dx*bm*hin*uin**2
    if not walls:
        hn[-1]-=dt/dx*max(h[-1]*u[-1],0); qn[-1]-=dt/dx*bm*h[-1]*max(u[-1],0)*u[-1]
    hn=np.maximum(hn,0.0)
    # contact-line force on front cells (wet cell with a dry neighbour), acting on momentum only
    if thA is not None:
        Fa=sigma*(1-math.cos(math.radians(thA)))/dx; Fr=sigma*(1-math.cos(math.radians(thR)))/dx
        dryR=np.zeros(n,bool); dryR[:-1]=wet[:-1]&~wet[1:]; dryL=np.zeros(n,bool); dryL[1:]=wet[1:]&~wet[:-1]
        for mask,sgn in ((dryR,1.0),(dryL,-1.0)):
            qo=sgn*qn; Fhold=rho*qo/dt                      # per unit area, along n_in, to cancel the outward momentum
            Fcl=np.clip(Fhold,Fr,Fa); qn=np.where(mask, sgn*(qo-Fcl*dt/rho), qn)
    if fric:
        un=np.sqrt(2)*hn*qn/np.sqrt(hn**4+np.maximum(hn**4,eps**4))
        Re=4*np.abs(qn)/nu+1e-12; f=np.maximum(24/Re,0.288*Re**-0.4)
        qn=qn/(1+dt*f*np.abs(un)/(2*np.maximum(hn,1e-9)))
    return hn,qn
def step(h,q,bed,dt,order,wlo,whi,**kw):
    h1,q1=stage(h,q,bed,dt,order,wlo,whi,**kw); h2,q2=stage(h1,q1,bed,dt,order,wlo,whi,**kw)
    return 0.5*(h+h2),0.5*(q+q2)
def cfl_dt(h,q,bed):
    u=q/np.maximum(h,1e-9); c=np.sqrt(np.maximum(bed.Gc,0)*h+4*sigma*h/(rho*bed.dx**2)); return 0.3*bed.dx/max(np.max(1.69*np.abs(u)+c),1e-6)
def incline(beta,dx,Gam,order,wlo,whi,L=0.20,tend=8.0,dry=False,thA=None,thR=None):
    b=math.radians(beta); gs=g*math.sin(b); n=int(round(L/dx)); bed=Bed(n,dx,'incline',beta=beta)
    hN=(3*nu*Gam/(rho*gs))**(1/3); uN=Gam/(rho*hN)
    h=np.full(n,0.0 if dry else hN); q=h*uN; t=0.0
    while t<tend:
        dt=min(cfl_dt(np.maximum(h,hN*0.5),q,bed),2e-3); h,q=step(h,q,bed,dt,order,wlo,whi,inflow=(hN,uN),thA=thA,thR=thR); t+=dt
    m=slice(n//2-5,n//2+5); return h[m].mean()/hN, (q[m]/np.maximum(h[m],1e-12)).mean()/uN, np.std(h[m])/hN, bed.dx*math.tan(b)/hN
which=sys.argv[1] if len(sys.argv)>1 else 'all'; wlo,whi=0.25,0.75
if which in ('all','incline'):
    print(f"steady film on an incline, weight thresholds {wlo}..{whi}: h/h_N, u/u_N at mid-plate (rms of h)")
    worst=0
    for beta in (5,10,45,80):
        for dx in (2e-3,1e-3):
            for Gam in (0.005,0.02,0.2):
                a=incline(beta,dx,Gam,2,wlo,whi); b=incline(beta,dx,Gam,1,wlo,whi); c=incline(beta,dx,Gam,2,wlo,whi,dry=True,thA=45,thR=15)
                worst=max(worst,abs(a[0]-1),abs(a[1]-1),abs(c[0]-1),abs(c[1]-1))
                print(f"  beta {beta:2d} dx {dx*1e3:.0f} mm Gamma {Gam:5.3f} bed step/h {a[3]:5.1f} | 2nd order h x{a[0]:.3f} u x{a[1]:.3f} (rms {a[2]:.3f}) | no slopes h x{b[0]:.3f} u x{b[1]:.3f} | dry start with contact line 45/15 deg h x{c[0]:.3f} u x{c[1]:.3f}")
    print(f"  worst second-order deviation {worst:.4f}")
if which in ('all','lake'):
    print("lake at rest, circular trough R = 40 mm; (a) fully submerged section with end walls; (b) puddle with shorelines, contact angles 45/15 deg")
    for dx in (2e-3,1e-3):
        R=0.04
        n=int(round(0.02/dx)); bed=Bed(n,dx,'trough',R=R,s0=-0.01); eta0=g*0.004; h=np.maximum(0,(eta0-bed.Bc)/bed.Gc); q=np.zeros(n); m0=h.sum()
        for k in range(20000):
            dt=min(cfl_dt(h,q,bed),1e-3); h,q=step(h,q,bed,dt,2,wlo,whi,walls=True)
        lev=(bed.Bc+bed.Gc*h)/g
        print(f"  (a) dx {dx*1e3:.0f} mm: max |u| {np.abs(q/h).max():.2e} m/s, level spread {1e6*(lev.max()-lev.min()):.2e} um, mass drift {(h.sum()-m0)/m0:+.1e}")
        for lvl in (0.002,0.003):
            n=int(round(0.06/dx)); bed=Bed(n,dx,'trough',R=R,s0=-0.03); eta0=g*lvl; h=np.maximum(0,(eta0-bed.Bc)/bed.Gc); q=np.zeros(n); m0=h.sum()
            for k in range(40000):
                dt=min(cfl_dt(np.maximum(h,1e-4),q,bed),1e-3); h,q=step(h,q,bed,dt,2,wlo,whi,walls=True,thA=45,thR=15)
            wet=h>ddry; lev=(bed.Bc+bed.Gc*h)/g; deep=h*bed.Gc>whi*np.abs(bed.Bf[1:]-bed.Bf[:-1])
            print(f"  (b) dx {dx*1e3:.0f} mm level {lvl*1e3:.0f} mm: wet cells {wet.sum()}, lake-form cells {deep.sum()}; max |u| all wet {np.abs(q[wet]/h[wet]).max():.2e}, lake-form {np.abs(q[deep]/h[deep]).max():.2e} m/s; level spread lake-form {1e6*(lev[deep].max()-lev[deep].min()):.3f} um; mean level change {1e6*(lev[deep].mean()-lvl):+.1f} um; mass drift {(h.sum()-m0)/m0:+.1e}")
if which in ('all','fill'):
    print("film running down the wall of a closed circular trough for 4 s, then 8 s of rest (contact angles 45/15 deg)")
    for dx in (2e-3,1e-3):
        R=0.04; n=int(round(0.12/dx)); bed=Bed(n,dx,'trough',R=R,s0=-0.06)
        h=np.zeros(n); q=np.zeros(n); t=0.0; fed=0.0
        while t<12.0:
            dt=min(cfl_dt(np.maximum(h,1e-4),q,bed),1e-3); Gam=0.02 if t<4.0 else 0.0; hin=1.5e-4; uin=Gam/(rho*hin)
            h,q=step(h,q,bed,dt,2,wlo,whi,inflow=(hin,uin),walls=True,thA=45,thR=15); fed+=dt*Gam/rho; t+=dt
        wet=h>ddry; lev=(bed.Bc+bed.Gc*h)/g; deep=h*bed.Gc>whi*np.abs(bed.Bf[1:]-bed.Bf[:-1])
        print(f"  dx {dx*1e3:.0f} mm: fed {fed*1e6:.3f} mm2, held {h.sum()*dx*1e6:.3f} mm2 (ratio {h.sum()*dx/fed:.6f}); min h {h.min():.1e}; lake-form cells {deep.sum()}, level spread {1e6*(lev[deep].max()-lev[deep].min()):.2f} um, max |u| {np.abs(q[deep]/h[deep]).max():.2e} m/s")
