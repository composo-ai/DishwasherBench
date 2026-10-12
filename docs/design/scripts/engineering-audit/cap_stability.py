# Throwaway audit: is the S scheme of M7.4 (form B: HLL without pressure, centred capillary source with 5-point Laplacian,
# MUSCL-minmod, two-stage SSP-RK2, pointwise-implicit friction) stable at CFL 0.3 on (|u| + c), c^2 = 4 sigma h/(rho dx^2)?
# 2-D periodic patch, G_n = 0 (vertical wall, gravity along x optional), random perturbation of a uniform film.
import numpy as np, sys
rho=988.0; nu=5.5e-7; sigma=0.040; bm=1.2
def minmod(a,b): return np.where(a*b>0, np.where(np.abs(a)<np.abs(b),a,b), 0.0)
def rhs(h,qx,qy,dx,gx,order):
    eps=1e-6
    u=np.sqrt(2)*h*qx/np.sqrt(h**4+np.maximum(h**4,eps**4)); v=np.sqrt(2)*h*qy/np.sqrt(h**4+np.maximum(h**4,eps**4))
    dh=np.zeros_like(h); dqx=np.zeros_like(h); dqy=np.zeros_like(h)
    for ax,(un,ut) in enumerate(((u,v),(v,u))):
        def sl(a):
            if order==1: return np.zeros_like(a)
            return minmod(a-np.roll(a,1,ax), np.roll(a,-1,ax)-a)
        sh,sn,st=sl(h),sl(un),sl(ut)
        hL=h+0.5*sh; nL=un+0.5*sn; tL=ut+0.5*st
        hR=np.roll(h-0.5*sh,-1,ax); nR=np.roll(un-0.5*sn,-1,ax); tR=np.roll(ut-0.5*st,-1,ax)
        cL=np.sqrt(4*sigma*hL/(rho*dx*dx)); cR=np.sqrt(4*sigma*hR/(rho*dx*dx))
        sLm=np.minimum(bm*nL-np.sqrt(bm*(bm-1)*nL**2+cL**2), bm*nR-np.sqrt(bm*(bm-1)*nR**2+cR**2))
        sRp=np.maximum(bm*nL+np.sqrt(bm*(bm-1)*nL**2+cL**2), bm*nR+np.sqrt(bm*(bm-1)*nR**2+cR**2))
        den=np.maximum(sRp-sLm,1e-12)
        def hll(FL,FR,UL,UR): return np.where(sLm>=0,FL,np.where(sRp<=0,FR,(sRp*FL-sLm*FR+sLm*sRp*(UR-UL))/den))
        Fh=hll(hL*nL,hR*nR,hL,hR); Fn=hll(bm*hL*nL*nL,bm*hR*nR*nR,hL*nL,hR*nR); Ft=hll(bm*hL*nL*tL,bm*hR*nR*tR,hL*tL,hR*tR)
        dh-=(Fh-np.roll(Fh,1,ax))/dx
        if ax==0: dqx-=(Fn-np.roll(Fn,1,ax))/dx; dqy-=(Ft-np.roll(Ft,1,ax))/dx
        else:     dqy-=(Fn-np.roll(Fn,1,ax))/dx; dqx-=(Ft-np.roll(Ft,1,ax))/dx
    lap=(np.roll(h,1,0)+np.roll(h,-1,0)+np.roll(h,1,1)+np.roll(h,-1,1)-4*h)/dx**2
    dqx+=(sigma*h/rho)*(np.roll(lap,-1,0)-np.roll(lap,1,0))/(2*dx)+gx*h
    dqy+=(sigma*h/rho)*(np.roll(lap,-1,1)-np.roll(lap,1,1))/(2*dx)
    return dh,dqx,dqy
def fe(h,qx,qy,dt,dx,gx,order,fric):
    dh,dqx,dqy=rhs(h,qx,qy,dx,gx,order)
    hn=np.maximum(h+dt*dh,0); qxn=qx+dt*dqx; qyn=qy+dt*dqy
    if fric:
        sp=np.sqrt(qxn**2+qyn**2)/np.maximum(hn,1e-9); Re=4*np.sqrt(qxn**2+qyn**2)/nu+1e-12
        f=np.maximum(24/Re,0.288*Re**-0.4); d=1+dt*f*sp/(2*np.maximum(hn,1e-9)); qxn/=d; qyn/=d
    return hn,qxn,qyn
def run(h0,dx,gx,order,fric,cfl=0.3,nsteps=4000,n=48,seed=0,amp=0.01):
    rng=np.random.default_rng(seed); h=h0*(1+amp*rng.standard_normal((n,n))); 
    u0=gx*h0*h0/(3*nu) if fric else 0.0
    qx=h*u0; qy=np.zeros((n,n)); a0=np.std(h)/h0; hist=[]
    for s in range(nsteps):
        u=np.sqrt(qx**2+qy**2)/np.maximum(h,1e-9); c=np.sqrt(4*sigma*h/(rho*dx*dx)); dt=cfl*dx/np.max(u+c)
        h1,qx1,qy1=fe(h,qx,qy,dt,dx,gx,order,fric); h2,qx2,qy2=fe(h1,qx1,qy1,dt,dx,gx,order,fric)
        h=0.5*(h+h2); qx=0.5*(qx+qx2); qy=0.5*(qy+qy2)
        if not np.all(np.isfinite(h)): return a0,float('inf'),s,dt
        if s%500==0: hist.append(np.std(h)/h0)
    return a0,np.std(h)/h0,nsteps,dt
print("relative rms thickness perturbation after 4,000 steps (start 0.01); 'inf' = blow-up")
for h0 in (1e-4,3e-4,1e-3,3e-3):
    for dx in (1e-3,2e-3):
        out=[]
        for label,gx,order,fric in (("no gravity, no friction, 2nd order",0.0,2,False),("no gravity, friction, 2nd order",0.0,2,True),("vertical wall g, friction, 2nd order",9.81,2,True),("vertical wall, friction, 1st order",9.81,1,True)):
            a0,a1,ns,dt=run(h0,dx,gx,order,fric)
            out.append(f"{label}: {a1:.2e}")
        print(f" h0 {h0*1e6:5.0f} um, dx {dx*1e3:.0f} mm, dt ~{dt*1e3:.3f} ms: " + "; ".join(out))
