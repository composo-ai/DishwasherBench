# Throwaway: 1-D check of the S flux form specified in sim-core.md M7.4 (regime-weighted surface potential, analytic face bed,
# hydrostatic reconstruction on the depth only, path-conservative potential term, HLL, pointwise-implicit friction, SSP-RK2).
import numpy as np, math, sys
rho=988.0; nu=5.5e-7; g=9.81; sigma=0.040; bm=1.2
def minmod(a,b): return np.where(a*b>0, np.where(np.abs(a)<np.abs(b),a,b), 0.0)
def smoothstep(x,a,b):
    t=np.clip((x-a)/(b-a),0,1); return t*t*(3-2*t)
class Bed:
    def __init__(s, n, dx, kind, beta=None, R=None, s0=0.0):
        s.n=n; s.dx=dx; sc=(np.arange(n)+0.5)*dx+s0; sf=np.arange(n+1)*dx+s0
        if kind=='incline':
            b=math.radians(beta); s.Bc=-g*math.sin(b)*sc; s.Bf=-g*math.sin(b)*sf; s.Gc=np.full(n,g*math.cos(b)); s.Gf=np.full(n+1,g*math.cos(b))
        else:   # circular trough of radius R, s measured from the bottom
            s.Bc=g*R*(1-np.cos(sc/R)); s.Bf=g*R*(1-np.cos(sf/R)); s.Gc=g*np.cos(sc/R); s.Gf=g*np.cos(sf/R)
def stage(h,q,bed,dt,order,wmode,inflow=None,capcel=True,fric=True):
    n=bed.n; dx=bed.dx; Bc,Bf,Gc,Gf=bed.Bc,bed.Bf,bed.Gc,bed.Gf
    eps=1e-6
    u=np.sqrt(2)*h*q/np.sqrt(h**4+np.maximum(h**4,eps**4))
    eta=Bc+Gc*h
    def slope(a):
        sl=np.zeros_like(a)
        if order==2: d=np.diff(a); sl[1:-1]=minmod(d[:-1],d[1:])
        return sl
    sh=slope(h); su=slope(u); se=slope(eta)
    hm=np.maximum(0,h-0.5*sh); hp=np.maximum(0,h+0.5*sh)          # own face depths at the - and + face
    um=u-0.5*su; up=u+0.5*su
    em=eta-0.5*se; ep=eta+0.5*se
    dB=np.abs(Bf[1:]-Bf[:-1])+1e-30
    if wmode=='regime': w=np.where(Gc>0, smoothstep(Gc*h/dB,1.0,3.0), 0.0)
    elif wmode=='lake': w=np.where(Gc>0,1.0,0.0)
    else: w=np.zeros(n)
    ehm=(1-w)*(Bf[:-1]+Gf[:-1]*hm)+w*em       # face surface potential seen by the cell at its - face
    ehp=(1-w)*(Bf[1:]+Gf[1:]*hp)+w*ep
    bm_=ehm-Gf[:-1]*hm; bp_=ehp-Gf[1:]*hp      # face bed potential seen by the cell
    # interior faces j=1..n-1 between cell j-1 (L) and j (R)
    GfI=Gf[1:-1]; bL=bp_[:-1]; bR=bm_[1:]; hL=hp[:-1]; hR=hm[1:]; uL=up[:-1]; uR=um[1:]
    bs=np.maximum(bL,bR)
    pos=GfI>0
    hLs=np.where(pos,np.maximum(0,hL-(bs-bL)/np.where(pos,GfI,1)),hL); hRs=np.where(pos,np.maximum(0,hR-(bs-bR)/np.where(pos,GfI,1)),hR)
    cc=lambda hh: np.sqrt(np.maximum(GfI,0)*hh+(4*sigma*hh/(rho*dx*dx) if capcel else 0))
    cL=cc(hLs); cR=cc(hRs)
    sLm=np.minimum(bm*uL-np.sqrt(bm*(bm-1)*uL**2+cL**2), bm*uR-np.sqrt(bm*(bm-1)*uR**2+cR**2))
    sRp=np.maximum(bm*uL+np.sqrt(bm*(bm-1)*uL**2+cL**2), bm*uR+np.sqrt(bm*(bm-1)*uR**2+cR**2))
    den=np.where(sRp-sLm>1e-12,sRp-sLm,1e-12)
    FhL=hLs*uL; FhR=hRs*uR; PL=0.5*GfI*hLs**2; PR=0.5*GfI*hRs**2
    FqL=bm*hLs*uL**2+PL; FqR=bm*hRs*uR**2+PR
    Fh=np.where(sLm>=0,FhL,np.where(sRp<=0,FhR,(sRp*FhL-sLm*FhR+sLm*sRp*(hRs-hLs))/den))
    Fq=np.where(sLm>=0,FqL,np.where(sRp<=0,FqR,(sRp*FqL-sLm*FqR+sLm*sRp*(hRs*uR-hLs*uL))/den))
    # positivity cap (donor-local)
    out=np.zeros(n); out[:-1]+=np.maximum(Fh,0); out[1:]+=np.maximum(-Fh,0)
    lim=np.where(out*dt/dx>h, h/(out*dt/dx+1e-300), 1.0)
    Fh=np.where(Fh>0,Fh*lim[:-1],Fh*lim[1:])
    hn=h.copy(); qn=q.copy()
    hn[:-1]-=dt/dx*Fh; hn[1:]+=dt/dx*Fh
    qn[:-1]-=dt/dx*(Fq-PL); qn[1:]+=dt/dx*(Fq-PR)              # flux minus the cell's own starred pressure
    # path-conservative potential term, own reconstruction only
    qn-=dt/dx*(0.5*(hp+h)*(ehp-eta)-0.5*(hm+h)*(ehm-eta))
    if inflow is not None:
        hin,uin=inflow; hn[0]+=dt/dx*hin*uin; qn[0]+=dt/dx*bm*hin*uin**2
    # outflow at the last face: transmissive (own state), no pressure jump
    hn[-1]-=dt/dx*max(h[-1]*u[-1],0); qn[-1]-=dt/dx*bm*h[-1]*max(u[-1],0)*u[-1]
    hn=np.maximum(hn,0.0)
    if fric:
        un=np.sqrt(2)*hn*qn/np.sqrt(hn**4+np.maximum(hn**4,eps**4))
        Re=4*np.abs(qn)/nu+1e-12; f=np.maximum(24/Re,0.288*Re**-0.4)
        qn=qn/(1+dt*f*np.abs(un)/(2*np.maximum(hn,1e-9)))
    return hn,qn
def step(h,q,bed,dt,order,wmode,**kw):
    h1,q1=stage(h,q,bed,dt,order,wmode,**kw); h2,q2=stage(h1,q1,bed,dt,order,wmode,**kw)
    return 0.5*(h+h2),0.5*(q+q2)
def cfl_dt(h,q,bed):
    u=q/np.maximum(h,1e-9); c=np.sqrt(np.maximum(bed.Gc,0)*h+4*sigma*h/(rho*bed.dx**2)); return 0.3*bed.dx/max(np.max(1.69*np.abs(u)+c),1e-6)
def incline(beta,dx,Gam,order,wmode,L=0.20,tend=8.0,dry=False):
    b=math.radians(beta); gs=g*math.sin(b); n=int(round(L/dx)); bed=Bed(n,dx,'incline',beta=beta)
    hN=(3*nu*Gam/(rho*gs))**(1/3); uN=Gam/(rho*hN)
    h=np.full(n,0.0 if dry else hN); q=h*uN; t=0.0
    while t<tend:
        dt=min(cfl_dt(np.maximum(h,hN*0.5),q,bed),2e-3); h,q=step(h,q,bed,dt,order,wmode,inflow=(hN,uN)); t+=dt
    m=slice(n//2-5,n//2+5); hm=h[m].mean(); um=(q[m]/np.maximum(h[m],1e-12)).mean()
    return hm/hN, um/uN, (h[m]*0).std()+np.std(h[m])/hN, bed.dx*math.tan(b)/hN
which=sys.argv[1] if len(sys.argv)>1 else 'all'
if which in ('all','incline'):
    print("steady film on an incline: h/h_N, u/u_N at mid-plate (rms variation of h); wet start; then dry start, 2nd order regime weight")
    for beta in (10,45,80):
        for dx in (2e-3,1e-3):
            for Gam in (0.02,0.2):
                r=[incline(beta,dx,Gam,o,wm) for o,wm in ((2,'regime'),(1,'regime'),(2,'lake'))]
                rd=incline(beta,dx,Gam,2,'regime',dry=True)
                print(f"  beta {beta:2d} dx {dx*1e3:.0f} mm Gamma {Gam:4.2f} bed step/h {r[0][3]:5.1f} | 2nd regime h x{r[0][0]:.3f} u x{r[0][1]:.3f} (rms {r[0][2]:.3f}) | 1st regime h x{r[1][0]:.3f} u x{r[1][1]:.3f} | 2nd lake-weight-1 h x{r[2][0]:.3f} u x{r[2][1]:.3f} (rms {r[2][2]:.3f}) | dry start h x{rd[0]:.3f} u x{rd[1]:.3f}")
if which in ('all','lake'):
    print("lake at rest in a circular trough R = 40 mm (s from -30 to +30 mm), level 2 mm above the lowest point, 20,000 steps")
    for dx in (2e-3,1e-3):
        for wmode in ('regime','lake','film'):
            for order in (2,1):
                R=0.04; n=int(round(0.06/dx)); bed=Bed(n,dx,'trough',R=R,s0=-0.03)
                eta0=g*0.002; h=np.maximum(0,(eta0-bed.Bc)/bed.Gc); q=np.zeros(n); m0=h.sum()
                for k in range(20000):
                    dt=min(cfl_dt(np.maximum(h,1e-4),q,bed),1e-3); h,q=step(h,q,bed,dt,order,wmode,fric=True)
                wet=h>1e-5; u=np.abs(q[wet]/h[wet]); lev=(bed.Bc[wet]+bed.Gc[wet]*h[wet])/g
                deep=h>3*np.abs(bed.Bf[1:]-bed.Bf[:-1])/bed.Gc
                print(f"  dx {dx*1e3:.0f} mm order {order} weight {wmode:6s}: max |u| {u.max():.2e} m/s (deep cells {np.abs(q[deep]/h[deep]).max() if deep.any() else 0:.2e}); level spread over wet cells {1e6*(lev.max()-lev.min()):.2f} um, over deep cells {1e6*(lev[deep[wet]].max()-lev[deep[wet]].min()) if deep.any() else 0:.3f} um; mass drift {(h.sum()-m0)/m0:+.1e}")
if which in ('all','fill'):
    print("film running down a 60 deg wall into a closed circular trough: final state after the supply stops")
    dx=1e-3; R=0.04; n=120; bed=Bed(n,dx,'trough',R=R,s0=-0.06)    # s from -60 mm (wall at 86 deg from the bottom) to +60 mm
    h=np.zeros(n); q=np.zeros(n); t=0.0; fed=0.0
    while t<12.0:
        dt=min(cfl_dt(np.maximum(h,1e-4),q,bed),1e-3)
        Gam=0.02 if t<4.0 else 0.0; hin=1.5e-4; uin=Gam/(rho*hin)
        h,q=step(h,q,bed,dt,2,'regime',inflow=(hin,uin)); fed+=dt*hin*uin/dx*0+dt*Gam/rho; t+=dt
    # the transmissive outflow at the far end is uphill, nothing leaves; mass check per unit width
    wet=h>2e-5; lev=(bed.Bc+bed.Gc*h)/g; deep=h>3*np.abs(bed.Bf[1:]-bed.Bf[:-1])/np.maximum(bed.Gc,1e-9)
    print(f"  volume fed {fed*1e6:.2f} mm2 (per unit width), held {h.sum()*dx*1e6:.2f} mm2, min h {h.min():.1e}; pool level spread over deep cells {1e6*(lev[deep].max()-lev[deep].min()):.2f} um; max |u| in deep cells {np.abs(q[deep]/h[deep]).max():.2e} m/s; wet cells {wet.sum()}, deep cells {deep.sum()}")
