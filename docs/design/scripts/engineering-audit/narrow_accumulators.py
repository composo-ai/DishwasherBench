# Throwaway audit: narrow accumulators in the record layouts of sim-core.md against its own rule 7.
import numpy as np, math
f16 = np.float16

print("== 1. TimelineBlock onset progress P (f16), P += dt / t_on per tick, dt = 1.714 s ==")
dt = 1.714
for t_on in (70, 720, 1500, 3000, 5000, 5800, 7200):
    P = f16(0.0); n = 0; inc = dt / t_on
    while P < 1 and n < 20000:
        Pn = f16(np.float32(P) + np.float32(inc))
        if Pn == P: break
        P = Pn; n += 1
    true_ticks = math.ceil(t_on / dt)
    print(f"  t_on {t_on:5d} s: true ticks to wet {true_ticks:5d}; f16 ticks {n:5d} {'(STALLED at P=%.4f)' % float(P) if P < 1 else ''}  ratio {n/true_ticks:.2f}")

print("== 2. KHot dewetting clock (f16 seconds), += dt0 per base step ==")
for dt0 in (1.913e-3, 1.953e-3, 1.974e-3):
    c = f16(0.0); n = 0
    while n < 100000:
        cn = f16(np.float32(c) + np.float32(dt0))
        if cn == c: break
        c = cn; n += 1
    print(f"  dt0 {dt0*1e3:.3f} ms: clock stalls at {float(c):.4f} s after {n} steps (true time {n*dt0:.3f} s)")
print("     t_dw = l_dw / V_dw for l_dw = 10 mm: theta_r 5 deg 0.24 mm/s -> %.1f s; 8 deg -> %.1f s; 10 deg 1.94 mm/s -> %.1f s" % (10/0.24, 10/(5e-3*(0.040/5.47e-4)*math.radians(8)**3*1e3), 10/1.94))

print("== 3. Fill fractions (u8 / 255), phi <- d + (phi - d) exp(-renew dt), dt = 1.714 s; start phi = 0, target d = 1 ==")
for renew in (0.1, 0.03, 0.01, 0.003, 0.001):
    phi = 0; n = 0
    for n in range(1, 4000):
        new = int(round(255 * (1.0 + (phi / 255.0 - 1.0) * math.exp(-renew * dt))))
        if new == phi: break
        phi = new
    exact = 1 - math.exp(-renew * dt * 3430)
    print(f"  renew {renew:6.3f} 1/s: u8 value freezes at {phi}/255 = {phi/255:.3f} after {n} ticks ({n*dt:.0f} s); exact value after the same time {1-math.exp(-renew*dt*n):.3f}, after 3,430 ticks {exact:.3f}")

print("== 4. SoilCell redepFat (f16, g/m2), += j dt per tick ==")
for j_g in (5e-6, 5e-5, 5e-4, 1e-3):       # g/(m2 s)
    acc = f16(0.0); n = 0; inc = j_g * dt
    for n in range(1, 3431):
        an = f16(np.float32(acc) + np.float32(inc))
        if an == acc: break
        acc = an
    print(f"  j {j_g:.0e} g/(m2 s): f16 total {float(acc):.4f} g/m2 after {n} ticks{' (STALLED)' if n < 3430 else ''}; exact after 3,430 ticks {inc*3430:.4f} g/m2 = {inc*3430/10:.4f} mg/cm2")

print("== 5. SFilm bead store: 14 bits in units of 0.25 um; deposit per 2 ms base step ==")
for frac, flux in (("mean flux 0.14 kg/(m2 s)", 0.14), ("10 % of mean", 0.014), ("1 % of mean", 1.4e-3), ("0.1 % of mean", 1.4e-4)):
    dep_um = flux * 2e-3 / 988 * 1e6
    print(f"  {frac:28s}: {dep_um*1e3:8.3f} nm per base step = {dep_um/0.25:.4f} quanta -> {'lost every step unless a remainder is carried' if dep_um/0.25 < 0.5 else 'ok'}")
print("     capacity 16383 quanta = %.2f mm" % (16383*0.25e-3))

print("== 6. SStats / KStats counts: u16 weighted by 2^(5-l), i.e. 32 per base step ==")
for steps in (896, 960, 1024, 1216):
    for revs in (1, 2, 4):
        tot = steps * 32 * revs
        print(f"  {steps} steps/rev x {revs} rev: always-true count = {tot} {'OVERFLOWS u16 (wraps to %d)' % (tot % 65536) if tot > 65535 else ''}")
print("   SStats byte count: 4 x f32 + 2 x f16 + 7 x u16 + u16 =", 4*4 + 2*2 + 7*2 + 2, "bytes (declared 32)")

print("== 7. JetExposure tExc u16 in 2^-16 revolution: a stalled arm (one phase) is above threshold for the whole revolution = 65536 units -> wraps unless saturating")
