import math, importlib.util, sys
spec = importlib.util.spec_from_file_location("hr", "hr_slope.py")
src = open("hr_slope.py").read().split('print("uniform incline')[0]
exec(src)
rho=988.0; nu=5.5e-7; g=9.81
print("first-order form A run to steady state (60 s); prediction when dz > h: h = (6 nu dx Gamma/(rho G_n))^(1/4)")
for beta,dx,Gam in ((45,2e-3,0.02),(45,1e-3,0.02),(80,2e-3,0.02),(45,2e-3,0.2),(20,2e-3,0.02)):
    hN,uN,h1,u1 = run(beta,dx,Gam,1,tend=60.0)
    Gn=g*math.cos(math.radians(beta)); hp=(6*nu*dx*Gam/(rho*Gn))**0.25
    print(f"  beta {beta} dx {dx*1e3:.0f} mm Gamma {Gam}: Nusselt h {hN*1e6:.0f} um; simulated h x{h1/hN:.2f}, u x{u1/uN:.2f}, flux x{h1*u1/(hN*uN):.2f}; predicted h x{hp/hN:.2f}; wall shear 3 mu u/h x{(u1/uN)/(h1/hN):.2f}")
print("second order with the Audusse in-cell term, 60 s")
for beta,dx,Gam in ((45,2e-3,0.02),(80,2e-3,0.02)):
    hN,uN,h1,u1 = run(beta,dx,Gam,2,sgrav='incell',tend=60.0)
    print(f"  beta {beta} dx {dx*1e3:.0f} mm Gamma {Gam}: h x{h1/hN:.3f}, u x{u1/uN:.3f}, flux x{h1*u1/(hN*uN):.3f}")
