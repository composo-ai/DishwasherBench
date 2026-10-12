import math, struct
# (a) u8 fill fractions relaxed "exactly" per tick: phi <- d + (phi - d) exp(-renew dt), stored as u8/255 (TimelineBlock, M10)
dt=1.714; nticks=int(54*60/dt)
print("u8 fill-fraction relaxation over a 54 min main wash (true = 1 - exp(-renew t)):")
for renew in (0.0005,0.001,0.0014,0.003,0.005,0.01,0.014,0.05,0.1):
    q=0  # main-wash fraction in u8 counts
    for n in range(nticks):
        phi=q/255.0
        new=1.0+(phi-1.0)*math.exp(-renew*dt)
        q=int(round(new*255))
    true=1-math.exp(-renew*nticks*dt)
    dep=renew*0.1*1000  # g/m2/s for a 100 um film (0.1 kg/m2)
    print(f"  renew {renew:.4f} 1/s (deposition ~{dep:.2f} g/m2/s on a 100 um film): stored main-wash fraction {q/255:.3f}, true {true:.3f}")
# (b) f16 accumulation of a constant per-tick increment (deposits, condensate, onset progress in TimelineBlock / SoilCell)
def f16(x): return struct.unpack('<e',struct.pack('<e',x))[0]
print("f16 accumulation of a constant increment over N ticks (value reached / exact):")
for inc,N in ((1.0,1900),(1.0,3430),(1/1500.0,1900),(1/2500.0,3430)):
    x=0.0
    for n in range(N): x=f16(x+inc)
    print(f"  increment {inc:.5f} x {N} ticks: f16 sum {x:.4f}, exact {inc*N:.4f}, ratio {x/(inc*N):.2f}")
