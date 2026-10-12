# Throwaway numeric checks quoted in sim-core.md.
import math
# 1. Reference jet J2-8 at 50 C: closures of jets 4.4, R_j, momentum flux with shape factor
rho=988.0; nu=0.554e-6; mu=rho*nu; gam=0.0679; d=2e-3; V=8.0
Q=math.pi*d*d/4*V; Re=V*d/nu
rb=0.24*Re**(1/3)*d; rt=0.2964*Re**(1/3)*d
Rj=0.289*Q**0.75*(rho/(nu*gam))**0.25
def film(r):
    x=r/d
    if r<rb:
        h=d*(0.125/x+1.06*Re**-0.5*x**0.5); U=V*d/(8*r*(h/d)); tau=0.472*rho*V*V*Re**-0.5*x**-0.5; cM=1.2
    elif r<rt:
        h=d*(3.792*x*x/Re+0.1975/x); U=V/(8*x*(h/d)); tau=mu*V/(4*r*(h/d)**2); cM=1.2
    else:
        U=V/(0.167*Re**-0.25*x**2.25+2.37-0.0108*Re**0.5); h=d*(0.0209*Re**-0.25*x**1.25+(0.296-0.001356*Re**0.5)/x); tau=0.0478*rho*Re**-0.25*U*U*x**0.25; cM=64/63
    return h,U,tau,cM*rho*U*U*h
print(f"J2-8: Q {Q*6e4:.2f} L/min Re {Re:.0f} r_b {rb*1e3:.1f} r_t {rt*1e3:.1f} R_j {Rj*1e3:.1f} mm; R_j with (1-xi), xi=0.09: {0.289*(Q*0.91)**0.75*(rho/(nu*gam))**0.25*1e3:.1f} mm")
for x in (0.55,1,2,5,10,15,20):
    h,U,tau,M=film(x*d); print(f"   r/d {x:5.2f}: h {h*1e6:5.0f} um U {U:4.2f} tau {tau:6.1f} Pa M {M:6.2f} N/m")
# 2. Peel impulse per pass on the track at v_s = 1 m/s: integral of (M - M_Y)+ dt, M ramped linearly inside 0.55 d
def M_of(r):
    r0=0.55*d
    if r<r0: return film(r0)[3]*r/r0
    if r>Rj: return 0.0
    return film(r)[3]
def tau_of(r):
    r0=0.55*d
    if r<r0: return film(r0)[2]*r/r0
    if r>Rj: return 0.0
    return film(r)[2]
vs=1.0; ds=1e-5
for MY in (2,8,10,20):
    I=0.0; tM=0.0; s=-Rj
    while s<Rj:
        M=M_of(abs(s)); I+=max(M-MY,0)*ds/vs; tM+=(M>MY)*ds/vs; s+=ds
    Mpk=M_of(0.55*d)
    print(f"   M_Y {MY:3d} N/m: per-pass integral {I*1e3:6.1f} mN s/m, time above {tM*1e3:5.2f} ms, rectangle (Mpk-MY)*t_above {max(Mpk-MY,0)*tM*1e3:6.1f}")
I=0.0; t10=0; t30=0; t100=0; s=-Rj
while s<Rj:
    t=tau_of(abs(s)); I+=t*ds/vs; t10+=(t>10)*ds/vs; t30+=(t>30)*ds/vs; t100+=(t>100)*ds/vs; s+=ds
print(f"   shear impulse on track {I:.2f} Pa s; time above 10/30/100 Pa: {t10*1e3:.0f}/{t30*1e3:.0f}/{t100*1e3:.0f} ms")
# 3. Enzyme supply conductance: reference film and mist-fed film
D=1.0e-10; x_L=0.05; mu55=5.47e-4
def G(tau_f,h_f,vren):
    km=max(0.538*(D*D*(tau_f/mu55)/x_L)**(1/3), D/h_f)
    return 1/(1/km+1/vren), km
Gref,kmref=G(1.42,147e-6,0.02/988/0.1)
print(f"enzyme supply: G_ref {Gref:.2e} m/s (k_m {kmref:.2e})")
for name,tau,h,vren in (("well-wetted reference",1.42,147e-6,0.02/988/0.1),("weak film 0.002 kg/(m s)",0.66,68e-6,0.002/988/0.1),("mist only, 1 % of mean flux",0.0,100e-6,1.4e-3/988),("mist only, 0.1 %",0.0,100e-6,1.4e-4/988)):
    g,km=G(tau,h,vren)
    for ku_rel in (0.3,1.0):
        ku=ku_rel*Gref; chi=min(1.0,(g/(g+ku))*((Gref+ku)/Gref))
        K=0.82; th=(chi**3/(K**3+chi**3))/(1/(K**3+1))
        print(f"   {name:30s} G {g:.2e} k_u {ku_rel:.1f} G_ref: chi_E {chi:.2f}, Hill rate factor {th:.2f}")
# 4. Hartley-Murgatroyd wetting rates in wash liquor at 55 C and dewetting speeds
rho55=985.7; sig=0.040; g=9.81
for th in (5,10,25,45):
    dstar=(15*mu55**2*sig*(1-math.cos(math.radians(th)))/(rho55**3*g*g))**0.2
    Gs=rho55**2*g*dstar**3/(3*mu55)
    Vv=5e-3*(sig/mu55)*math.radians(th)**3; Vi=math.sqrt(sig*(1-math.cos(math.radians(th)))/(rho55*200e-6))
    print(f"   theta {th:2d} deg: delta* {dstar*1e6:4.0f} um, Gamma* {Gs:.4f} kg/(m s), V_dw viscous {Vv*1e3:7.2f} mm/s, inertial(200 um) {Vi*1e3:6.1f} mm/s")
# 5. beta_cl tilt law from Meredith's two values
n=math.log(0.4)/math.log(math.sin(math.radians(5)))
print(f"beta_cl tilt exponent n = {n:.3f}; at 45 deg {math.sin(math.radians(45))**n:.2f}, at 90 deg 1.00, at 5 deg {math.sin(math.radians(5))**n:.2f}")
# 6. K steps per revolution: N_rev = 64*ceil(T/(64*2 ms))
for rpm in (35,33,32,30,26.5,25,23):
    T=60/rpm; nb=math.ceil(T/(64*2e-3)); print(f"   {rpm:5.1f} rpm: T {T:.3f} s, N_rev {64*nb}, dt0 {T/(64*nb)*1e3:.3f} ms")
# 7. erosion bookkeeping: thickness-based on unswollen layer vs mass-based
ur=6e-6/60; rhod=1100.0
print(f"thickness-based erosion on an unswollen layer: {ur*rhod:.2e} kg/m2/s; dossier mass flux 3e-5; ratio {ur*rhod/3e-5:.1f}")
# 8. Brun threshold vs rope thickness: tilt from horizontal at which h* = 4.5 mm for l_c = 2.6 mm
lc=2.6e-3
for tilt in (20,30,35,40,45,50,60):
    al=math.radians(90-tilt); hs=3*lc*math.cos(al)/(1.62208*math.sin(al)**1.5)
    print(f"   underside tilt {tilt} deg from horizontal: h* {hs*1e3:.2f} mm, curtain fraction {min(1,max(0,(4.5e-3/hs-0.8)/0.4)):.2f}")
