import math, numpy as np
rho=988.0; nu=5.54e-7; mu=rho*nu; g=9.81; sigma=0.040; gam=0.0679
print("== A. Remnant film frozen into the 'steady' record of the second diverter state (M7.7 + M10 merge h_eff = max(h_rec, h_dd)) ==")
def jeff(s,t,beta=90): return math.sqrt(mu*s/(rho*g*math.sin(math.radians(beta))*t))
for s in (0.05,0.10,0.20):
    for Trev,name in ((2.0,'U at 30 rpm'),(2.4,'U at 25 rpm')):
        t0=2*Trev; t1=4*Trev              # recorded steady revolutions are revolutions 3 and 4 after the switch
        ts=np.linspace(t0,t1,2001); hrec=np.mean([jeff(s,t) for t in ts])
        td=np.linspace(t1,60,4001); htrue=np.mean([jeff(s,t) for t in td])
        gr1=np.mean([jeff(s,t)**3 for t in np.linspace(t0,t0+Trev,500)]); gr2=np.mean([jeff(s,t)**3 for t in np.linspace(t0+Trev,t1,500)])
        print(f"  s = {s*1e3:.0f} mm below the top edge, {name}: record (t = {t0:.1f}..{t1:.1f} s) h = {hrec*1e6:.1f} um; true mean over {t1:.1f}..60 s = {htrue*1e6:.1f} um; ratio {hrec/htrue:.2f}; "
              f"flux ratio {(hrec/htrue)**3:.1f}; h at 60 s {jeff(s,60)*1e6:.1f} um; time at which h falls below the 30 um flow threshold {mu*s/(rho*g*(30e-6)**2):.1f} s; Gamma(rev 4)/Gamma(rev 3) = {gr2/gr1:.2f}")

print("== B. Tier grids are not nested in s: N_rows = max(2, round(S / D_B)) at D_B = 2 and 4 mm ==")
rng=np.random.default_rng(0); S=rng.uniform(0.02,0.6,200000)
n2=np.maximum(2,np.round(S/2e-3)); n4=np.maximum(2,np.round(S/4e-3))
print(f"  meridian lengths 20..600 mm: N_rows(2 mm) == 2 N_rows(4 mm) for {np.mean(n2==2*n4)*100:.1f} % of patches")

print("== C. Ring emitter: 32 azimuth sectors, one film cell per entry ==")
for rl in (41.3,30,20,10):
    arc=2*math.pi*rl/32
    ys=sorted(set(round(rl*math.sin(2*math.pi*k/32),3) for k in range(32)))
    gaps=np.diff(ys)
    print(f"  r_lim {rl:5.1f} mm: arc per sector {arc:.1f} mm = {arc/2:.1f} cells (2 mm) / {arc:.1f} cells (1 mm); distinct lateral lines {len(ys)} across a swath of {2*rl:.0f} mm = {2*rl/2:.0f} / {2*rl:.0f} cells; largest gap between lines {gaps.max():.1f} mm")

print("== D. Jet gather: samples per (soil cell, sub-jet) if the kernel loops over every phase k0..k1 as written ==")
T=60/35.0
for R in (0.075,0.114,0.150,0.194,0.238):
    step=2*math.pi*R/16384
    for a in (20e-3,41e-3):
        chord=math.pi/2*a+8e-3      # mean chord through a disc of radius a, plus the 8 mm tile the range is built for
        print(f"  nozzle radius {R*1e3:.0f} mm, normal incidence: footprint step {step*1e3:.3f} mm/phase ({step/0.5e-3:.2f} of the 0.25 d = 0.5 mm quadrature spacing); reach {a*1e3:.0f} mm -> {chord/step:6.0f} phases per pass (budget2.py assumes 150)")
print("   grazing incidence 5..10 deg (lighthouse factor 1/tan(phi) = 11.4..5.7): step 0.37..0.75 mm/phase at R = 150 mm; forward reach ~85 mm -> 110..230 phases")

print("== E. Fixed-point and f16 ranges ==")
Q=math.pi*(2e-3)**2/4*8.0*rho     # J2-8 mass flow kg/s
print(f"  J2-8 mass flow {Q*1e3:.1f} g/s")
print(f"  i32 limit: mass {2**31*1e-12*1e3:.2f} g, momentum {2**31*1e-12:.2e} kg m/s; u32 mass per bin {2**32*1e-12*1e3:.2f} g")
for R in (0.075,0.150,0.238):
    vs=2*math.pi*R/T; dwell=(2e-3+2e-3)/vs; m=Q*dwell
    print(f"  drop-train footprint crossing one 2 mm block at R = {R*1e3:.0f} mm: v_s {vs:.2f} m/s, dwell {dwell*1e3:.1f} ms, mass up to {m*1e3:.3f} g, momentum {m*8.0:.2e} kg m/s = {m*8.0/(2**31*1e-12)*100:.0f} % of the i32 range per pass;"
          f" bin-mean flux {m/4e-6/(T/64)*1e3:.2e} g/(m2 s) against f16 max 6.55e4")
print(f"  f16 flux ceiling 65504 g/(m2 s) on a 4 mm2 block = {65504e-3*4e-6*1e3:.3f} g/s; on a 1 mm2 cell {65504e-3*1e-6*1e3:.4f} g/s")
print(f"  one 3.3 l_c drop (0.34 g at 55 C) per phase bin (27 ms) spread over r_dep = 3 D_B (113 mm2, 28 blocks): {0.34e-3/113e-6/0.027*1e3:.2e} g/(m2 s)")
print(f"  curtain: half of J2-8 over 60 mm x 12 mm: {0.5*Q/(0.06*0.012)*1e3:.2e} g/(m2 s);  full jet on its own 3.1 mm2: {Q/3.14e-6*1e3:.2e} g/(m2 s)")

print("== F. Thin capsules as REV patches: N_th has a minimum of 8 ==")
def level(u,h,dx):
    c=math.sqrt(4*sigma*h/(rho*dx*dx)); lam=(abs(u)+c)/dx; dt=0.3/lam
    return max(0,math.ceil(math.log2(2e-3/dt))),dt
for r,name in ((1.0e-3,'fork tine r = 1.0 mm'),(1.5e-3,'r = 1.5 mm'),(2.5e-3,'thin handle r = 2.5 mm'),(5e-3,'handle r = 5 mm')):
    nth=max(8,8*2**round(math.log2(2*math.pi*r/(8*2e-3)))); w=2*math.pi*r/nth
    for cls,dx in (('S1 sub-cell',w/2),('S2 block',w)):
        l1,dt1=level(0.4,200e-6,dx); l2,dt2=level(0.2,1e-3,dx)
        print(f"  {name}: N_th {nth}, block width {w*1e3:.2f} mm; {cls} {dx*1e3:.2f} mm: ordinary wet film (0.4 m/s, 0.2 mm) needs level {l1} (dt {dt1*1e6:.0f} us); 1 mm bead/ridge needs level {l2} (dt {dt2*1e6:.0f} us)   [ladder ends at level 5 = 62.5 us]")

print("== G. Emitter hand-over speed against the level ladder (J2-8 at 50 C, closures of M5) ==")
d=2e-3; V=8.0; Re=V*d/nu; rb=0.24*Re**(1/3)*d; rt=0.2964*Re**(1/3)*d
def film(r):
    x=r/d
    if r<rb: h=d*(0.125/x+1.06*Re**-0.5*x**0.5); U=V*d/(8*r*(h/d))
    elif r<rt: h=d*(3.792*x*x/Re+0.1975/x); U=V/(8*x*(h/d))
    else: U=V/(0.167*Re**-0.25*x**2.25+2.37-0.0108*Re**0.5); h=d*(0.0209*Re**-0.25*x**1.25+(0.296-0.001356*Re**0.5)/x)
    return h,U
for rl in (5,10,15,20,25,30,35,41):
    h,U=film(rl*1e-3)
    out=[]
    for dx in (1e-3,2e-3):
        c=math.sqrt(4*sigma*h/(rho*dx*dx)); dtm=0.3*dx/(U+c); lv=math.ceil(math.log2(2e-3/dtm))
        cour=(1.69*U+c)*(2e-3/2**min(lv,5))/dx
        out.append(f"{dx*1e3:.0f} mm: level {lv}{' (> 5: clamped, Courant on the fast wave %.2f)' % cour if lv>5 else ''}")
    print(f"  fan cut at r_lim = {rl:2d} mm: U_av {U:.2f} m/s, h {h*1e6:.0f} um -> " + "; ".join(out))
print("   curvature bound |kappa| r < 0.5: cup or glass wall R = 35..40 mm -> r_lim <= 17..20 mm; stem R = 4 mm -> 2 mm; mug handle R = 6 mm -> 3 mm")
