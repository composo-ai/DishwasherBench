# Throwaway 1-D reference of the S flux form written in sim-core.md M7.4 (the version the document quotes).
#  State per cell: h, q, wet flag.
#  1. Face depth from the minmod reconstruction of h. Face surface potential etaHat blended between the bed-following value B_f + G_f h_face
#     (film form) and the limited reconstruction of eta = B + G h (lake form) by w = smoothstep(G h / bed-potential range of the cell; lakeLo, lakeHi).
#  2. Face bed potential b = etaHat - G_f h_face; a cell that is not solid presents the analytic face bed B_f. Hydrostatic reconstruction with
#     b* = max of the two sides; HLL; each cell subtracts its own starred pressure and adds -(1/2)(h_face + h)(etaHat - eta) n L / A.
#  3. Contact line, all decisions from start-of-stage cell-centre states:
#     thrust at a face towards a dry cell  T = rho (G+ h^2/2 + beta_m h (u.n)+^2 + h (A/L)(g_t.n)+);  R_a = beta_cl sigma (1 - cos theta_a),
#     R_r = beta_cl sigma (1 - cos theta_r).  A wet cell with such a face and T < R_r is retracting; other wet cells are solid.
#     solid | dry or retracting : advance flux phi HLL(h*, u; 0, 0), phi = clamp((T - R_a)/T, 0, 1)
#     retracting | solid        : the retracting cell's outflow h ((u.n)+ + V_ret), V_ret = V_dw (1 - T/R_r), V_dw = min(viscous, inertial)
#     a solid cell at a front face loses outward momentum to F_cl = min(F_hold+, F_a); a retracting cell flows in film form without F_cl.
#  4. Pointwise-implicit friction; two-stage SSP Runge-Kutta; wet flag set above delta_wet, cleared below delta_dry.
import numpy as np, math
rho=988.0; nu=5.5e-7; g=9.81; sigma=0.040; bm=1.2; ddry=2e-6; dwet=1.0e-4
LAKE_LO, LAKE_HI = 0.25, 0.75
def minmod(a,b): return np.where(a*b>0, np.where(np.abs(a)<np.abs(b),a,b), 0.0)
def smoothstep(x,a,b):
    t=np.clip((x-a)/(b-a),0,1); return t*t*(3-2*t)
class Bed:
    def __init__(s, n, dx, kind, beta=None, R=None, s0=0.0):
        s.n=n; s.dx=dx; sc=(np.arange(n)+0.5)*dx+s0; sf=np.arange(n+1)*dx+s0
        if kind=='incline':
            b=math.radians(beta); s.Bc=-g*math.sin(b)*sc; s.Bf=-g*math.sin(b)*sf; s.Gc=np.full(n,g*math.cos(b)); s.Gf=np.full(n+1,g*math.cos(b)); s.gt=np.full(n,g*math.sin(b))
        else:
            s.Bc=g*R*(1-np.cos(sc/R)); s.Bf=g*R*(1-np.cos(sf/R)); s.Gc=g*np.cos(sc/R); s.Gf=g*np.cos(sf/R); s.gt=-g*np.sin(sc/R)
def hll(hL,uL,hR,uR,Gf,dx):
    cc=lambda hh: np.sqrt(np.maximum(Gf,0)*hh+4*sigma*hh/(rho*dx*dx))
    cL=cc(hL); cR=cc(hR)
    sLm=np.minimum(bm*uL-np.sqrt(bm*(bm-1)*uL**2+cL**2), bm*uR-np.sqrt(bm*(bm-1)*uR**2+cR**2))
    sRp=np.maximum(bm*uL+np.sqrt(bm*(bm-1)*uL**2+cL**2), bm*uR+np.sqrt(bm*(bm-1)*uR**2+cR**2))
    den=np.where(sRp-sLm>1e-12,sRp-sLm,1e-12)
    PL=0.5*Gf*hL**2; PR=0.5*Gf*hR**2; FhL=hL*uL; FhR=hR*uR; FqL=bm*hL*uL**2+PL; FqR=bm*hR*uR**2+PR
    Fh=np.where(sLm>=0,FhL,np.where(sRp<=0,FhR,(sRp*FhL-sLm*FhR+sLm*sRp*(hR-hL))/den))
    Fq=np.where(sLm>=0,FqL,np.where(sRp<=0,FqR,(sRp*FqL-sLm*FqR+sLm*sRp*(hR*uR-hL*uL))/den))
    return Fh,Fq,PL,PR
def stage(h,q,wet,bed,dt,order=2,inflow=None,fric=True,thA=45.0,thR=15.0,walls=False,mode='regime',diag=None):
    n=bed.n; dx=bed.dx; Bc,Bf,Gc,Gf=bed.Bc,bed.Bf,bed.Gc,bed.Gf; eps=1e-6
    u=np.where(wet,np.sqrt(2)*h*q/np.sqrt(h**4+np.maximum(h**4,eps**4)),0.0)
    Ra=sigma*(1-math.cos(math.radians(thA))); Rr=sigma*(1-math.cos(math.radians(thR)))
    Vvis=5e-3*(sigma/(rho*nu))*math.radians(thR)**3
    # thrust of every cell towards its + and - neighbour, from cell-centre states
    Tp=rho*(0.5*np.maximum(Gc,0)*h**2+bm*h*np.maximum(u,0)**2+h*dx*np.maximum(bed.gt,0))
    Tm=rho*(0.5*np.maximum(Gc,0)*h**2+bm*h*np.maximum(-u,0)**2+h*dx*np.maximum(-bed.gt,0))
    dryP=np.zeros(n,bool); dryP[:-1]=wet[:-1]&~wet[1:]; dryM=np.zeros(n,bool); dryM[1:]=wet[1:]&~wet[:-1]      # front faces of a wet cell
    retr=(dryP&(Tp<Rr))|(dryM&(Tm<Rr)); solid=wet&~retr
    Tfront=np.where(dryP&(Tp<Rr),Tp,np.where(dryM&(Tm<Rr),Tm,0.0))
    Vret=np.where(retr,np.minimum(Vvis,np.sqrt(Rr/(rho*np.maximum(h,1e-7))))*(1-Tfront/max(Rr,1e-30)),0.0)
    eta=Bc+Gc*h
    def slope(a):
        sl=np.zeros_like(a)
        if order==2: d=np.diff(a); sl[1:-1]=minmod(d[:-1],d[1:])
        return sl
    sh=slope(np.where(solid,h,0.0)); su=slope(u); se=slope(eta)
    hm=np.maximum(0,h-0.5*sh); hp=np.maximum(0,h+0.5*sh); um=u-0.5*su; up=u+0.5*su
    dB=np.abs(Bf[1:]-Bf[:-1])+1e-30
    w=np.where(Gc>0, smoothstep(Gc*h/dB,LAKE_LO,LAKE_HI), 0.0)
    if mode=='lake': w=np.where(Gc>0,1.0,0.0)
    if mode=='film': w=np.zeros(n)
    w=np.where(retr,0.0,w)
    ehm=(1-w)*(Bf[:-1]+Gf[:-1]*hm)+w*(eta-0.5*se); ehp=(1-w)*(Bf[1:]+Gf[1:]*hp)+w*(eta+0.5*se)
    GfI=Gf[1:-1]; pos=GfI>0; Gs=np.where(pos,GfI,1.0)
    sl_=solid[:-1]; sr_=solid[1:]; ww=sl_&sr_; fr=sl_&~sr_; fl=~sl_&sr_
    bL=np.where(sl_,(ehp-Gf[1:]*hp)[:-1],Bf[1:-1]); bR=np.where(sr_,(ehm-Gf[:-1]*hm)[1:],Bf[1:-1])
    hL=np.where(sl_,hp[:-1],0.0); hR=np.where(sr_,hm[1:],0.0); uL=np.where(sl_,up[:-1],0.0); uR=np.where(sr_,um[1:],0.0)
    bs=np.maximum(bL,bR)
    hLs=np.where(pos,np.maximum(0,hL-(bs-bL)/Gs),hL); hRs=np.where(pos,np.maximum(0,hR-(bs-bR)/Gs),hR)
    Fh,Fq,PL,PR=hll(hLs,uL,hRs,uR,GfI,dx)
    phR=np.clip((Tp[:-1]-Ra)/np.maximum(Tp[:-1],1e-30),0,1); phL=np.clip((Tm[1:]-Ra)/np.maximum(Tm[1:],1e-30),0,1)
    Fh=np.where(ww,Fh,np.where(fr,phR*Fh,np.where(fl,phL*Fh,0.0)))
    FqmL=np.where(ww,Fq-PL,np.where(fr,phR*(Fq-PL),np.where(fl,phL*(Fq-PL),0.0)))
    FqmR=np.where(ww,Fq-PR,np.where(fr,phR*(Fq-PR),np.where(fl,phL*(Fq-PR),0.0)))
    # a retracting cell hands its liquid to a solid neighbour: own velocity plus the retraction sweep
    rl=retr[:-1]&sr_; rr=retr[1:]&sl_
    outL=np.where(rl,h[:-1]*(np.maximum(u[:-1],0)+Vret[:-1]),0.0); outR=np.where(rr,h[1:]*(np.maximum(-u[1:],0)+Vret[1:]),0.0)
    Fh=Fh+outL-outR
    Fqr=bm*np.where(rl,h[:-1]*np.maximum(u[:-1],0)**2,0.0)+bm*np.where(rr,h[1:]*np.maximum(-u[1:],0)**2,0.0)   # h u^2 carried across the face
    FqmL=FqmL+Fqr; FqmR=FqmR+Fqr
    out=np.zeros(n); out[:-1]+=np.maximum(Fh,0); out[1:]+=np.maximum(-Fh,0)
    lim=np.where(out*dt/dx>h, h/(out*dt/dx+1e-300), 1.0)
    Fh=np.where(Fh>0,Fh*lim[:-1],Fh*lim[1:])
    hn=h.copy(); qn=q.copy()
    hn[:-1]-=dt/dx*Fh; hn[1:]+=dt/dx*Fh
    qn[:-1]-=dt/dx*FqmL; qn[1:]+=dt/dx*FqmR
    # path-conservative potential term; towards a cell that is not solid the surface meets the face bed: etaHat = min(B_f, eta), face depth 0
    nsP=np.zeros(n,bool); nsP[:-1]=wet[:-1]&~sr_; nsM=np.zeros(n,bool); nsM[1:]=wet[1:]&~sl_
    ehp2=np.where(nsP,np.minimum(Bf[1:],eta),ehp); hp2=np.where(nsP,0.0,hp)
    ehm2=np.where(nsM,np.minimum(Bf[:-1],eta),ehm); hm2=np.where(nsM,0.0,hm)
    pot=dt/dx*(0.5*(hp2+h)*(ehp2-eta)-0.5*(hm2+h)*(ehm2-eta))
    potfilm=dt*h*(Bf[1:]-Bf[:-1])/dx                                     # retracting cells: gravity along the surface only
    qn-=np.where(solid,pot,np.where(retr,potfilm,0.0))
    if inflow is not None:
        hin,uin=inflow; hn[0]+=dt/dx*hin*uin; qn[0]+=dt/dx*bm*hin*uin**2
    if not walls:
        hn[-1]-=dt/dx*max(h[-1]*u[-1],0); qn[-1]-=dt/dx*bm*h[-1]*max(u[-1],0)*u[-1]
    hn=np.maximum(hn,0.0)
    Fa=Ra/dx
    for mask,sgn in ((nsP&solid,1.0),(nsM&solid,-1.0)):
        qo=sgn*qn; Fhold=rho*np.maximum(qo,0)/dt; Fcl=np.minimum(Fhold,Fa); qn=np.where(mask, sgn*(qo-Fcl*dt/rho), qn)
    if fric:
        un=np.sqrt(2)*hn*qn/np.sqrt(hn**4+np.maximum(hn**4,eps**4))
        Re=4*np.abs(qn)/nu+1e-12; f=np.maximum(24/Re,0.288*Re**-0.4)
        qn=qn/(1+dt*f*np.abs(un)/(2*np.maximum(hn,1e-9)))
    if diag is not None: diag['retr']=retr
    return hn,qn
def flags(h,wet): return (wet|(h>dwet))&(h>ddry)
def step(h,q,wet,bed,dt,**kw):
    h1,q1=stage(h,q,wet,bed,dt,**kw); w1=flags(h1,wet); h2,q2=stage(h1,np.where(w1,q1,0.0),w1,bed,dt,**kw)
    hn=0.5*(h+h2); qn=0.5*(q+q2); wn=flags(hn,wet); return hn,np.where(wn,qn,0.0),wn
def cfl_dt(h,q,bed,hmin=1e-4):
    hh=np.maximum(h,hmin); u=q/hh; c=np.sqrt(np.maximum(bed.Gc,0)*hh+4*sigma*hh/(rho*bed.dx**2)); return min(0.3*bed.dx/max(np.max(1.69*np.abs(u)+c),1e-6),2e-3)
