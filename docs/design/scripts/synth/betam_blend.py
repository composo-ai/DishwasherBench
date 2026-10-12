# Throwaway check for sim-core.md: does a continuous momentum-flux-factor blend remove the grid dependence the delivery
# judge found with the discontinuous 1.2 / 1.016 switch? 1-D vertical plate, first-order upwind, implicit friction.
import numpy as np, sys
rho=985.0; nu=5.1e-7; g=9.81; T=1.714; L=0.25
def fric(Re, mode, n=4.0):
    lam=24/Re; tur=0.288*Re**-0.4
    if mode=='switch':
        f=np.maximum(lam,tur); beta=np.where(lam>=tur,1.2,1.016)
    elif mode=='const':
        f=np.maximum(lam,tur); beta=np.full_like(Re,1.2)
    else:  # smooth blend, exponent n
        f=(lam**n+tur**n)**(1.0/n); wl=lam**n/(lam**n+tur**n); beta=1.2*wl+1.016*(1-wl)
    return f,beta
def inertial(mean,pulse,mode,dx,dt,nper=3):
    n=int(round(L/dx)); h=np.full(n,2e-6); q=np.zeros(n); steps=int(round(T/dt)); peak=mean*T/pulse
    pr=[int(0.05/dx),int(0.125/dx),int(0.24/dx)]
    H=np.zeros(3); TA=np.zeros(3); PK=np.zeros(3); D1=np.zeros(3)
    for per in range(nper):
        for s in range(steps):
            G=peak if s*dt<pulse else 0.0
            u=q/np.maximum(h,1e-9); Re=4*np.abs(q)/nu+1e-12
            f,beta=fric(Re,mode)
            Fq=beta*q*u
            hn=h.copy(); qn=q+dt*g*h
            hn[1:]+=dt/dx*(q[:-1]-q[1:]); hn[0]-=dt/dx*q[0]
            qn[1:]+=dt/dx*(Fq[:-1]-Fq[1:]); qn[0]-=dt/dx*Fq[0]
            hn[0]+=dt*G/(rho*dx)
            hn=np.maximum(hn,1e-9); un=qn/hn; Ren=4*np.abs(qn)/nu+1e-12
            fn,_=fric(Ren,mode)
            qn=qn/(1+dt*fn*np.abs(un)/(2*hn))
            h,q=hn,qn
            if per==nper-1:
                for k,p in enumerate(pr):
                    uu=q[p]/h[p]; Rr=np.array([4*abs(q[p])/nu+1e-12]); ff,_=fric(Rr,mode); tau=rho*0.5*ff[0]*uu*uu
                    H[k]+=h[p]; TA[k]+=tau; PK[k]=max(PK[k],tau); D1[k]+=(tau>1.0)
    return H/steps,TA/steps,PK,D1/steps
fm=lambda x: " / ".join(f"{v:.2f}" for v in x)
mean,pulse=float(sys.argv[1]),float(sys.argv[2])
print(f"== mean {mean} kg/(m s), pulse {pulse*1e3:.0f} ms, probes at 0.05/0.125/0.24 m ==")
for mode in ('switch','const','blend'):
    for dx in (4e-3,2e-3,1e-3,0.5e-3):
        dt=dx*0.08
        H,TA,PK,D1=inertial(mean,pulse,mode,dx,dt)
        print(f"  {mode:6s} dx {dx*1e3:4.2f} mm: h um", " ".join(f"{v*1e6:5.0f}" for v in H), "| tau mean", fm(TA), "| peak", fm(PK), "| duty>1Pa", fm(D1)); sys.stdout.flush()
