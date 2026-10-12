# Budget arithmetic, final version quoted in sim-core.md section 7 (supersedes budget.py: actual steps per revolution and the M7.7 revolution plan).
def run(scale, variant, rateS=1.0e9):
    A = {k: v*scale for k, v in dict(flatH=3.8, hollowH=1.3, partial=0.6, mesh=0.4).items()}
    aux = 0.20e6
    cells = dict(flatH=A['flatH']/4e-6, hollowH=A['hollowH']/4e-6, partial=A['partial']/1e-6, mesh=A['mesh']/3e-6)
    blocks = sum(A.values())/4e-6 + aux
    soil = (A['flatH']*0.40 + A['hollowH']*0.35 + A['partial']*0.40 + A['mesh']*0.50)/1e-6
    film_cells = sum(cells.values()) + aux
    # revolutions (M7.7): class D: X1 = L: 2 settle + 2 steady + 2 transient; X2 = U: 2 transient + 2 steady.  W, R: 4 + 4 each.
    stepsL = 6*896 + 8*960; stepsU = 4*1024 + 8*1216; ksteps = stepsL + stepsU; nrev = 26
    simS = 6*1.714 + 8*1.818 + 4*2.0 + 8*2.4
    su2, su1 = 2700.0, 5225.0
    S2 = cells['hollowH'] + (cells['flatH'] if variant == 'S-all' else 0.0); S1 = cells['partial']
    if variant == 'K-only': S1 = S2 = 0.0
    if variant == 'S-partial': S2 = 0.0
    S_work = (S2*su2 + S1*su1)*simS
    K_cells = blocks - S2 - S1/4.0
    K_per = K_cells*ksteps
    K_dd = blocks*3129*6
    t = {}
    t['A'] = 25 + 8*blocks/1e6 + 2*soil/1e6
    t['B'] = 30
    t['C'] = 4*2.0e8/60e6
    t['D'] = 12*(0.2*soil*150*3*1.5)/0.2e9
    t['E'] = 6*(400*blocks/1.0e9 + 1e7*12/90e6 + (blocks/4)*448*2/0.3e9 + (blocks/4)*1434/0.3e9) + 6
    t['F'] = 1.2e9*12/90e6
    t['G1'] = S_work/rateS
    t['G2'] = K_per/0.30e9
    t['G3'] = K_dd/0.30e9
    t['G4'] = 3.0e9*scale**0.5/90e6
    t['H'] = soil*3430*0.8/0.20e9 + blocks*3430/0.8e9 + 5 + 10
    t['I'] = 20
    t['J'] = 45
    gpu = sum(t[k] for k in ('C','D','E','F','G1','G2','G3','G4','H')) - 16
    tot = sum(t.values())
    return dict(blocks=blocks, soil=soil, film_cells=film_cells, S_cells=S1+S2, K_cells=K_cells, simS=simS, ksteps=ksteps, t=t, total=tot, gpu=gpu, S_work=S_work, K_per=K_per, K_dd=K_dd)
names = dict(A='A set-up', B='B hydraulics, shake-down', C='C primary jets', D='D gather', E='E pilots', F='F Monte Carlo', G1='G1 film S', G2='G2 film K periodic', G3='G3 K drain-down', G4='G4 live parcels', H='H replay', I='I end passes', J='J I/O')
for variant in ('S-split', 'S-all', 'S-partial', 'K-only'):
    a = run(1.0, variant); b = run(8.5/6.1, variant)
    print(f"--- {variant}: blocks {a['blocks']/1e6:.2f}/{b['blocks']/1e6:.2f} M; film cells {a['film_cells']/1e6:.2f}/{b['film_cells']/1e6:.2f} M; S cells {a['S_cells']/1e6:.2f}/{b['S_cells']/1e6:.2f} M; K blocks {a['K_cells']/1e6:.2f}/{b['K_cells']/1e6:.2f} M; soil {a['soil']/1e6:.2f}/{b['soil']/1e6:.2f} M; sim {a['simS']:.1f} s; K steps {a['ksteps']}")
    for k in names: print(f"     {names[k]:28s} {a['t'][k]:6.0f} / {b['t'][k]:6.0f} s")
    print(f"     SUM {a['total']:.0f} / {b['total']:.0f} s;  /0.9: {a['total']/0.9:.0f} s ({a['total']/0.9/60:.1f} min) / {b['total']/0.9:.0f} s ({b['total']/0.9/60:.1f} min);  GPU {a['gpu']/0.9:.0f} s ({a['gpu']/0.9/60:.1f} min) / {b['gpu']/0.9:.0f} s ({b['gpu']/0.9/60:.1f} min)")
    print(f"     work: S {a['S_work']:.2e}/{b['S_work']:.2e}; K per {a['K_per']:.2e}/{b['K_per']:.2e}; K dd {a['K_dd']:.2e}/{b['K_dd']:.2e}; shares typical: film {(a['t']['G1']+a['t']['G2']+a['t']['G3']+a['t']['G4'])/a['total']*100:.0f} %, MC {a['t']['F']/a['total']*100:.0f} %, jets+gather+pilots {(a['t']['C']+a['t']['D']+a['t']['E'])/a['total']*100:.0f} %, replay {a['t']['H']/a['total']*100:.0f} %")
print('--- sensitivity to the S rate (typical / design minutes, GPU design)')
for variant in ('S-split', 'S-all', 'S-partial'):
    for rate in (2.0e9, 1.0e9, 0.8e9, 0.6e9, 0.45e9, 0.35e9):
        a = run(1.0, variant, rate); b = run(8.5/6.1, variant, rate)
        print(f"     {variant:10s} {rate/1e9:.2f} G/s: {a['total']/0.9/60:.1f} / {b['total']/0.9/60:.1f} min (GPU {b['gpu']/0.9/60:.1f})")
for scale, name in ((1.0, 'typical'), (8.5/6.1, 'design')):
    r = run(scale, 'S-split'); per = r['t']['G1'] + r['t']['G2']
    reoff = per*(8/26.0) + r['t']['G3']/6*2*0.46 + 0.5*4e8*2*12/90e6/2 + 10 + r['t']['D']/3
    refast = 45*scale**0.5; conv = per*(4/26.0); shake = 70
    print(f"--- reserves {name}: conv {conv:.0f}, shake {shake}, official re-exposure {reoff:.0f}, fast re-exposure {refast:.0f}; worst A {(r['total']+reoff+refast+conv+shake)/0.9/60:.1f} min, worst B {(r['total']+refast+conv+shake)/0.9/60:.1f} min")
r = run(8.5/6.1, 'S-all'); per = r['t']['G1'] + r['t']['G2']
print(f"--- S-all design worst case policy B: {(r['total'] + 53 + per*(4/26.0) + 70)/0.9/60:.1f} min")
def fast(scale):
    A = {k: v*scale for k, v in dict(flatH=3.8, hollowH=1.3, partial=0.6, mesh=0.4).items()}
    blocks = sum(A.values())/16e-6 + 0.05e6; soil = (A['flatH']*0.40 + A['hollowH']*0.35 + A['partial']*0.40 + A['mesh']*0.50)/4e-6
    simS = 9*1.80 + 9*2.27; ksteps = 9*448 + 9*576
    t = {}
    t['A set-up'] = 10 + 8*blocks/1e6 + 2*soil/1e6
    t['B shake-down'] = 15
    t['C+D jets, gather'] = 4*2.0e8/16*7/19/60e6*4 + 12*(0.2*soil*40*3)/0.2e9 + 2
    t['E pilots'] = 6
    t['F Monte Carlo'] = 1.2e8*12/90e6
    t['G1 film S'] = (A['hollowH']/16e-6*1350 + A['partial']/4e-6*2700)*simS/1.0e9
    t['G2+G3 film K'] = (A['flatH']/16e-6 + A['mesh']/12e-6 + 0.05e6)*ksteps/0.3e9 + blocks*1434*6/0.3e9
    t['G4 live parcels'] = 5
    t['H replay'] = soil*3430*0.8*(8/12)/0.2e9 + blocks*3430/0.8e9 + 8
    t['I+J end, I/O'] = 14
    return t
for scale, name in ((1.0, 'typical'), (8.5/6.1, 'design')):
    t = fast(scale); tot = sum(t.values())
    print(f"--- fast tier {name}: " + "; ".join(f"{k} {v:.0f}" for k, v in t.items()) + f"; SUM {tot:.0f} s; /0.9 = {tot/0.9:.0f} s ({tot/0.9/60:.1f} min)")
