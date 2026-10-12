import numpy as np, math, sys
src=open('sscheme4.py').read().split("which=sys.argv")[0]
wlo,whi=0.25,0.75
for MODE in ('regime','mindev'):
    exec(src)
    print("MODE",MODE,": dry start with contact angles 45/15: front position after 2, 4, 8 s (mm), estimate Gamma t / (rho h_crit) with h_crit = F_a / (rho g sin beta); film thickness behind the front / Nusselt")
    for beta,dx,Gam in ((10,2e-3,0.02),(45,2e-3,0.02),(45,1e-3,0.02),(45,2e-3,0.005),(80,2e-3,0.02),(80,1e-3,0.02),(45,2e-3,0.2)):
        b=math.radians(beta); gs=g*math.sin(b); n=int(round(0.3/dx)); bed=Bed(n,dx,'incline',beta=beta)
        hN=(3*nu*Gam/(rho*gs))**(1/3); uN=Gam/(rho*hN); h=np.zeros(n); q=np.zeros(n); t=0.0; out=[]
        marks=[2.0,4.0,8.0]
        while t<8.0:
            dt=min(cfl_dt(np.maximum(h,hN*0.5),q,bed),2e-3); h,q=step(h,q,bed,dt,2,wlo,whi,inflow=(hN,uN),thA=45,thR=15); t+=dt
            if marks and t>=marks[0]:
                wet=np.where(h>ddry)[0]; out.append(((wet.max()+1)*dx*1e3 if len(wet) else 0.0)); marks.pop(0)
        Fa=sigma*(1-math.cos(math.radians(45)))/dx; hc=Fa/(rho*gs); wet=np.where(h>ddry)[0]; fr=wet.max() if len(wet) else 0
        behind=h[max(fr//2-3,0):fr//2+3].mean()/hN if fr>8 else float('nan')
        print(f"  beta {beta} dx {dx*1e3:.0f} mm Gamma {Gam}: front {out[0]:.0f}, {out[1]:.0f}, {out[2]:.0f} mm; h_crit {hc*1e3:.2f} mm -> estimate {Gam*8/(rho*hc)*1e3:.0f} mm at 8 s; front-cell depth {h[fr]*1e3:.2f} mm, max depth {h.max()*1e3:.2f} mm; mid-film h/h_N {behind:.3f}")
