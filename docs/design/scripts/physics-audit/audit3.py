import math
rho=988.0; rhog=1.2; mug=1.8e-5; g=9.81
def cd(Re):
    return (24/Re)*(1+0.15*Re**0.687) if Re<1000 else 0.44
def flight(D,u0,elev_deg=20.0,dt=1e-5,tmax=3.0):
    # launched from a vertical wall at elev above the wall plane, heading upward along the wall; returns distance from wall when it
    # has lost 95 % of its launch speed, and horizontal reach after falling 0.2 m below launch height
    vx=u0*math.sin(math.radians(elev_deg)); vz=u0*math.cos(math.radians(elev_deg)); x=z=0.0; t=0.0
    stop=None
    while t<tmax:
        v=math.hypot(vx,vz); Re=max(rhog*v*D/mug,1e-9); k=0.75*cd(Re)*(rhog/rho)*v/D
        vx+=-k*vx*dt; vz+=(-g-k*vz)*dt; x+=vx*dt; z+=vz*dt; t+=dt
        if stop is None and math.hypot(vx,vz)<0.05*u0+0: stop=(x,z,t)
        if z<-0.2: break
    return x,z,t,stop
def vterm(D):
    v=1.0
    for _ in range(200):
        Re=rhog*v*D/mug; v=math.sqrt(4*g*D*rho/(3*cd(Re)*rhog))
    return v
print("log-normal, GSD 1.8: mass-median / count-median = exp(3 ln(1.8)^2) = %.2f"%math.exp(3*math.log(1.8)**2))
for D in (0.16e-3,0.45e-3,1.0e-3):
    x,z,t,stop=flight(D,5.6)
    print(f"D {D*1e3:.2f} mm, 5.6 m/s at 20 deg off the wall: terminal velocity {vterm(D):.2f} m/s; horizontal reach from the wall {x*1e3:.0f} mm (after falling back 0.2 m below launch, t={t:.2f} s)")
# slot nozzle sub-jet count: physical consequences
A=8.30e-6; Cd=0.78; Cv=0.97; p=34.9e3; rw=998.2; nu20=1.004e-6; nu50=0.554e-6; gam=0.0728
V=Cv*math.sqrt(2*p/rw); Q=Cd*A*math.sqrt(2*p/rw)
print(f"slot nozzle: Q {Q*6e4:.2f} L/min, V {V:.2f} m/s")
for N in (5,9):
    d=math.sqrt(4*(Q/N)/(math.pi*V)); We=rw*V*V*d/gam; Re=V*d/nu20; Lb=6*d*(math.sqrt(We)+3*We/Re)
    Re50=V*d/nu50; taumax=0.63*988*V*V*Re50**-0.5
    Rj=0.289*(Q/N)**0.75*(988/(nu50*0.0679))**0.25
    fc=lambda s: 1.0 if s<=0.6*Lb else (0.0 if s>=1.4*Lb else 1-(s-0.6*Lb)/(0.8*Lb))
    om=We*math.exp(0.971*(0.15/d)/math.sqrt(We)); w=min(om,11000); xi=max(0,-0.258+7.85e-5*w-2.51e-9*w*w)
    print(f"  N_sub {N}: d {d*1e3:.2f} mm, We {We:.0f}, L_b {Lb*1e3:.0f} mm, f_c at 150/250/350 mm = {fc(0.15):.2f}/{fc(0.25):.2f}/{fc(0.35):.2f}, "
          f"peak tau (50C) {taumax:.0f} Pa, R_j per sub-jet {Rj*1e3:.1f} mm, xi_BL at 150 mm {xi:.2f}")
