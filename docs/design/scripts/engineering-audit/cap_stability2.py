src = open("cap_stability.py").read().split('print("relative rms')[0]
exec(src)
print("vertical wall, friction, 2nd order, h0 = 200 um (Nusselt u0 = %.2f m/s), dx = 1 mm: rms perturbation after the same simulated time (2 s)" % (9.81*4e-8/(3*5.5e-7)))
for cfl in (0.3, 0.15, 0.075):
    # same simulated time: steps scale with 1/cfl
    a0,a1,ns,dt = run(2e-4, 1e-3, 9.81, 2, True, cfl=cfl, nsteps=int(2.0/(cfl*1e-3/(0.24+0.18))), amp=0.01)
    print(f"   CFL {cfl}: dt {dt*1e3:.3f} ms, steps {ns}: rms {a1:.3f}")
for dx in (2e-3, 1e-3, 0.5e-3):
    a0,a1,ns,dt = run(2e-4, dx, 9.81, 2, True, cfl=0.3, nsteps=int(2.0/(0.3*dx/(0.24+0.36e-3/dx))), n=int(48e-3/dx), amp=0.01)
    print(f"   dx {dx*1e3:.1f} mm (domain 48 mm): dt {dt*1e3:.3f} ms, steps {ns}: rms {a1:.3f}")
