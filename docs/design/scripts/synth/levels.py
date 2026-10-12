# Throwaway: S-solver time-step levels (SSP-RK2, CFL 0.3, wave speed |u| + sqrt(max(Gn,0) h + 4 sigma h/(rho dx^2))).
import math
rho=988.0; sigma=0.040; dt0=2.0e-3; CFL=0.3
def level(u,h,dx,Gn=0.0):
    c=math.sqrt(max(Gn,0)*h+4*sigma*h/(rho*dx*dx)); lam=(abs(u)+c)/dx; dt=CFL/lam
    l=max(0,min(5,math.ceil(math.log2(dt0/dt)))); return c,dt,l
cases=[("quiet draining film",0.05,50e-6),("thin wet film",0.15,100e-6),("ordinary wet film",0.40,200e-6),("pulse",0.80,300e-6),
       ("ring emitter 0.7 m/s (at R_j)",0.70,140e-6),("ring emitter 1.5 m/s",1.5,150e-6),("cut-short emitter 3 m/s",3.0,80e-6),("3 mm ridge",0.2,3e-3)]
for dx in (1e-3,2e-3,4e-3):
    print(f"dx = {dx*1e3:.0f} mm")
    for name,u,h in cases:
        c,dt,l=level(u,h,dx)
        print(f"   {name:32s} u {u:4.2f} h {h*1e6:6.0f} um  c {c:5.3f} m/s  dt_max {dt*1e3:6.3f} ms  level {l} (dt {dt0/2**l*1e3:.4f} ms, {2*2**l*500:.0f} stage-updates/s)")
