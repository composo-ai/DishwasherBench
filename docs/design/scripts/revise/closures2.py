# Throwaway: numbers quoted in M5 of sim-core.md: transition cap of the boundary-layer zone, hand-over speed cap, rim rule, pre-wet factor.
import math
def props(T):
    return {20:(998.2,1.004e-6,0.0728),50:(988.0,0.554e-6,0.0679),55:(985.7,0.511e-6,0.0672)}[T]
def ray(d,V,T,phi_deg,psi_deg=0.0,ReXt=3e5,xi=0.0):
    rho,nu,gam=props(T); r0=d/2; phi=math.radians(phi_deg); psi=math.radians(psi_deg)
    q=(V*r0*r0/2)*math.sin(phi)**3/(1-math.cos(psi)*math.cos(phi))**2
    deq=math.sqrt(8*q/V); Re=V*deq/nu; rb=0.24*Re**(1/3)*deq; rt=0.2964*Re**(1/3)*deq; rx=ReXt*nu/V
    Rj=0.289*(2*math.pi*q*(1-xi))**0.75*(rho/(nu*gam))**0.25
    def bl(r):
        x=r/deq; h=deq*(0.125/x+1.06*Re**-0.5*x**0.5); U=V*deq/(8*r*(h/deq)); tau=0.472*rho*V*V*Re**-0.5*x**-0.5; return h,U,tau
    def base(r):
        x=r/deq
        if r<rb: return bl(r)
        if r<rt: h=deq*(3.792*x*x/Re+0.1975/x); U=V/(8*x*(h/deq)); return h,U,rho*nu*V/(4*r*(h/deq)**2)
        U=V/(0.167*Re**-0.25*x**2.25+2.37-0.0108*Re**0.5); h=deq*(0.0209*Re**-0.25*x**1.25+(0.296-0.001356*Re**0.5)/x); return h,U,0.0478*rho*Re**-0.25*U*U*x**0.25
    def capped(r):
        if rb<=rx or r<=rx: return base(r)
        hx,Ux,_=bl(rx); qpsi=Ux*hx*rx; cM=1.2
        Ct=0.06*(4*qpsi/nu)**-0.4/(cM*qpsi)
        U=1/(1/Ux+Ct*(r**2.4-rx**2.4)); h=qpsi/(U*r); Rel=4*U*h/nu; f=max(24/Rel,0.288*Rel**-0.4); return h,U,0.5*f*rho*U*U
    return dict(q=q,deq=deq,Re=Re,rb=rb,rt=rt,rx=rx,Rj=Rj,base=base,capped=capped,rho=rho,nu=nu,gam=gam)
print("A. grazing forward ray, d 2.25 mm, 8.1 m/s, 55 C: dossier closure against the capped boundary-layer zone (Re_x,t = 3e5)")
for phi in (5,15,30):
    R=ray(2.25e-3,8.1,55,phi)
    print(f"  phi {phi:2d}: d_eq {R['deq']*1e3:.1f} mm, Re_eq {R['Re']:.0f}, r_b {R['rb']*1e3:.0f} mm, r_x {R['rx']*1e3:.1f} mm")
    for r in (0.03,0.05,0.10,0.15):
        h,U,t=R['base'](r); hc,Uc,tc=R['capped'](r); Rel=4*U*h/R['nu']; ff=max(24/Rel,0.288*Rel**-0.4)
        print(f"     r {r*1e3:3.0f} mm: closure h {h*1e6:4.0f} um U {U:4.2f} m/s tau {t:5.1f} Pa (film friction law on that state {0.5*ff*R['rho']*U*U:5.1f} Pa) | capped: h {hc*1e6:4.0f} um U {Uc:4.2f} m/s tau {tc:5.1f} Pa, M {1.2*R['rho']*Uc*Uc*hc:.2f} N/m")
print("B. normal incidence J2-8 at 50 C is unchanged by the cap: r_b %.1f mm < r_x %.1f mm" % (ray(2e-3,8.0,50,90)['rb']*1e3, ray(2e-3,8.0,50,90)['rx']*1e3))
R=ray(2e-3,8.0,50,90)
print("C. hand-over speed against radius, J2-8 at 50 C:", ", ".join(f"{r} mm: {R['base'](r*1e-3)[1]:.2f} m/s" for r in (10,15,20,23,25,30,41)))
sig=0.040
for dx in (1e-3,2e-3):
    for l in (3,4,5):
        dt=2e-3/2**l; h=1e-4; c=math.sqrt(4*sig*h/(988*dx*dx)); print(f"   level {l} on {dx*1e3:.0f} mm cells: dt {dt*1e6:.1f} us, largest speed 0.3 dx/dt - c = {0.3*dx/dt-c:.2f} m/s")
print("D. rim rule (films 12.5) at the end of a fan sector: d 2.25 mm, 8.1 m/s, 55 C, 15 deg, rim 150 mm ahead")
R=ray(2.25e-3,8.1,55,15); h,U,t=R['capped'](0.15); hb,Ub,_=R['base'](0.15)
for name,hh,UU in (("closure",hb,Ub),("capped",h,U)):
    for re_,nm in ((2e-3,'plate rim r_e 2 mm'),(0.5e-3,'sharp rim 0.5 mm'),(0.1e-3,'edge 0.1 mm')):
        for gamma,gn in ((R['gam'],'gamma_w'),(0.040,'liquor 40 mN/m')):
            We=R['rho']*UU*UU*hh/gamma; Wc=max(2,1.0*(re_/hh)*(1+math.cos(math.radians(20)))); f=max(0,min(1,0.882-1.908*math.exp(-(We/Wc)/1.264))) if We>Wc else 0.0
            print(f"   {name}: h {hh*1e6:.0f} um U {UU:.2f} m/s; {nm}, {gn}: We_e {We:.1f}, We_c {Wc:.1f}, separated fraction {f:.2f}; M/gamma {1.2*R['rho']*UU*UU*hh/gamma:.1f}")
print("E. pre-wet front-speed factor U_f/U = (sqrt(1 + 4 e k) - 1) / (2 e k), e = 1:", ", ".join(f"k {k}: {(math.sqrt(1+4*k)-1)/(2*k):.2f}" for k in (0.1,0.3,0.5,1.0,2.0)))
print("F. sub-jet of a slot (N_sub 7): Q 3.25 L/min, V 8.11 m/s")
Q=3.25e-3/60; V=8.11
for N in (5,7,9):
    d=math.sqrt(4*(Q/N)/(math.pi*V)); print(f"   N_sub {N}: d_sub {d*1e3:.2f} mm; sheet thickness at 100 mm for a 40 deg fan: {Q/(V*(5e-3+2*0.1*math.tan(math.radians(20))))*1e6:.0f} um")
