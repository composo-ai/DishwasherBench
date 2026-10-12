# Throwaway audit: "form A" of sim-core.md M7.4 exactly as written (hydrostatic reconstruction with bed z = (Phi_g - G_n h)/G_f,
# HLL flux, pointwise-implicit friction, forward Euler; steady state so the time integrator does not matter) on a uniform incline.
# Question: does a face treated at first order (band boundary, pole, stitched faces; every face if S_grav is not defined) reproduce Nusselt?
import numpy as np, math, sys
rho=988.0; nu=5.5e-7; g=9.81; sigma=0.040; bm=1.2
def run(beta_deg, dx, Gam, order, L=0.20, capcel=True, sgrav=False, tend=6.0):
    b=math.radians(beta_deg); Gn=g*math.cos(b); gs=g*math.sin(b)
    n=int(round(L/dx)); s=(np.arange(n)+0.5)*dx
    pot=-gs*s                      # -g.x_s  (m2/s2): decreases downslope
    hN=(3*nu*Gam/(rho*gs))**(1/3); uN=Gam/(rho*hN)
    h=np.full(n,hN); q=np.full(n,hN*uN)
    t=0.0
    def mm(a,b_): return np.where(a*b_>0, np.where(np.abs(a)<np.abs(b_),a,b_), 0.0)
    while t<tend:
        u=q/np.maximum(h,1e-9)
        c=np.sqrt(Gn*h+(4*sigma*h/(rho*dx*dx) if capcel else 0.0))
        dt=0.3*dx/np.max(np.abs(u)*1.69+c); 
        Phi=pot+Gn*h
        if order==2:
            def slope(a):
                d=np.diff(a); sl=np.zeros_like(a); sl[1:-1]=mm(d[:-1],d[1:]); return sl
            sh=slope(h); su=slope(u); sP=slope(Phi)
        else:
            sh=np.zeros(n); su=np.zeros(n); sP=np.zeros(n)
        # face i+1/2 between cell i (L) and i+1 (R)
        hL=h[:-1]+0.5*sh[:-1]; hR=h[1:]-0.5*sh[1:]
        uL=u[:-1]+0.5*su[:-1]; uR=u[1:]-0.5*su[1:]
        PL=Phi[:-1]+0.5*sP[:-1]; PR=Phi[1:]-0.5*sP[1:]
        zL=(PL-Gn*hL)/Gn; zR=(PR-Gn*hR)/Gn
        zs=np.maximum(zL,zR); hLs=np.maximum(0,hL+zL-zs); hRs=np.maximum(0,hR+zR-zs)
        cL=np.sqrt(Gn*hLs+(4*sigma*hLs/(rho*dx*dx) if capcel else 0)); cR=np.sqrt(Gn*hRs+(4*sigma*hRs/(rho*dx*dx) if capcel else 0))
        sLm=np.minimum(bm*uL-np.sqrt(bm*(bm-1)*uL**2+cL**2), bm*uR-np.sqrt(bm*(bm-1)*uR**2+cR**2))
        sRp=np.maximum(bm*uL+np.sqrt(bm*(bm-1)*uL**2+cL**2), bm*uR+np.sqrt(bm*(bm-1)*uR**2+cR**2))
        FhL=hLs*uL; FhR=hRs*uR; FqL=bm*hLs*uL**2+0.5*Gn*hLs**2; FqR=bm*hRs*uR**2+0.5*Gn*hRs**2
        den=np.where(sRp-sLm>1e-12,sRp-sLm,1e-12)
        Fh=np.where(sLm>=0,FhL,np.where(sRp<=0,FhR,(sRp*FhL-sLm*FhR+sLm*sRp*(hRs-hLs))/den))
        Fq=np.where(sLm>=0,FqL,np.where(sRp<=0,FqR,(sRp*FqL-sLm*FqR+sLm*sRp*(hRs*uR-hLs*uL))/den))
        corrL=0.5*Gn*(hL**2-hLs**2)       # added to the left cell's flux at its right face
        corrR=0.5*Gn*(hR**2-hRs**2)       # added to the right cell's flux at its left face
        hn=h.copy(); qn=q.copy()
        hn[:-1]-=dt/dx*Fh; hn[1:]+=dt/dx*Fh
        qn[:-1]-=dt/dx*(Fq+corrL); qn[1:]+=dt/dx*(Fq+corrR)
        if order==2 and sgrav=='incell':    # Audusse second-order centred in-cell term: G (hl+hr)/2 (zl - zr)/dx on each cell
            hl=h-0.5*sh; hr=h+0.5*sh; zl=((Phi-0.5*sP)-Gn*hl)/Gn; zr=((Phi+0.5*sP)-Gn*hr)/Gn
            qn+=dt*Gn*0.5*(hl+hr)*(zl-zr)/dx
        if sgrav=='tangential': qn+=dt*gs*h
        # inflow at the top (cell 0): prescribed Nusselt flux; outflow free at the bottom
        hn[0]+=dt/dx*(hN*uN); qn[0]+=dt/dx*(bm*hN*uN**2+0.5*Gn*hN**2)
        hn[-1]-=dt/dx*(h[-1]*u[-1]); qn[-1]-=dt/dx*(bm*h[-1]*u[-1]**2+0.5*Gn*h[-1]**2)
        hn=np.maximum(hn,1e-9); un=qn/hn
        Re=4*np.abs(qn)/nu+1e-12; f=np.maximum(24/Re,0.288*Re**-0.4)
        qn=qn/(1+dt*f*np.abs(un)/(2*hn))
        h,q=hn,qn; t+=dt
    m=slice(n//2-5,n//2+5)
    return hN,uN,h[m].mean(),(q[m]/h[m]).mean()
print("uniform incline, steady supply; h, u at mid-plate against Nusselt")
print(" beta  dx(mm) Gamma  | Nusselt h(um) u(m/s) | form A, first order   | 2nd order, no S_grav  | 2nd order + in-cell term | 1st order + S_grav = h g_t")
for beta in (10,45,80):
    for dx in (2e-3,1e-3):
        for Gam in (0.02,0.2):
            hN,uN,h1,u1=run(beta,dx,Gam,1)
            _,_,h2,u2=run(beta,dx,Gam,2)
            _,_,h3,u3=run(beta,dx,Gam,2,sgrav='incell')
            _,_,h4,u4=run(beta,dx,Gam,1,sgrav='tangential')
            print(f"  {beta:3d}   {dx*1e3:3.0f}   {Gam:5.2f} | {hN*1e6:6.0f} {uN:6.3f}      | h x{h1/hN:5.2f} u x{u1/uN:5.2f}  | h x{h2/hN:5.2f} u x{u2/uN:5.2f}  | h x{h3/hN:5.2f} u x{u3/uN:5.2f}    | h x{h4/hN:5.2f} u x{u4/uN:5.2f}   dz/h = {dx*math.tan(math.radians(beta))/hN:5.1f}")
