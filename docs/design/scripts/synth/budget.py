# Throwaway budget arithmetic for docs/design/sim-core.md (official tier, AUTO-145 sizing programme).
# Two loads: typical 6.1 m2 (IEC 13 place settings) and design 8.5 m2. All rates are planning rates (unmeasured kernels).
import json
def run(scale, variant, rateS=1.0e9, label=""):
    A = dict(flatH=3.8, hollowH=1.3, partial=0.6, mesh=0.4)           # m2 of item surface by class at 6.1 m2
    A = {k: v*scale for k, v in A.items()}
    aux_blocks = 0.20e6                                                # tub 4 mm, racks (LINE), basket, arms; not scaled
    cells = dict(flatH=A['flatH']/4e-6, hollowH=A['hollowH']/4e-6, partial=A['partial']/1e-6, mesh=A['mesh']/3e-6)
    blocks = (A['flatH']+A['hollowH']+A['partial']+A['mesh'])/4e-6 + aux_blocks
    soil = (A['flatH']*0.40 + A['hollowH']*0.35 + A['partial']*0.40 + A['mesh']*0.50)/1e-6
    film_cells = sum(cells.values()) + aux_blocks
    # simulated seconds: 6 combos (W,D,R x L,U); D: 2 transient + 1 discarded + 2 steady; W,R: 2 + 2
    revL = 5*1.714 + 8*1.82; revU = 5*2.0 + 8*2.4; simS = revL + revU; nrev = 26
    # S solver: stage-updates per cell-second (level mix of sec. 12)
    su2, su1 = 2700.0, 5225.0
    S_cells2 = cells['hollowH'] + (cells['flatH'] if variant == 'S-all' else 0.0); S_cells1 = cells['partial']
    S_work = (S_cells2*su2 + S_cells1*su1)*simS
    if variant == 'K-only': S_work = 0.0; S_cells2 = S_cells1 = 0.0
    # K periodic: 896 steps per revolution, on K-solved cells (as 2 mm blocks)
    K_cells = aux_blocks + cells['mesh'] + (cells['flatH'] if variant != 'S-all' else 0.0)
    if variant == 'K-only': K_cells = blocks
    K_per = K_cells*896*nrev
    K_dd = blocks*3129*6
    t = {}
    t['A set-up'] = 20 + 8*blocks/1e6 + 2*soil/1e6 + 5
    t['B hydraulics, shake-down'] = 30
    t['C primary jets (2 pump classes x 2 states)'] = 4*2.0e8/60e6
    t['D jet gather (12 record sets)'] = 12*(0.2*soil*150*3*1.5)/1e0/0.2e9
    t['E pilots (6 combos, preview tier)'] = 6*(400*blocks/1.0e9 + 1e7*12/90e6 + (blocks/4)*448*2/0.3e9 + (blocks/4)*1434/0.3e9) + 6
    t['F Monte Carlo (1.2e9 parcels x 12 segments)'] = 1.2e9*12/90e6
    t['G1 film S (SSP-RK2)'] = S_work/rateS
    t['G2 film K periodic'] = K_per/0.30e9
    t['G3 film K drain-down (6 x 60 s)'] = K_dd/0.30e9
    t['G4 time-coupled parcels'] = 3.0e9*scale**0.5/90e6
    ticks = 3450
    t['H replay (soil, blocks, reductions, liquor)'] = soil*ticks*0.8/0.20e9 + blocks*ticks/0.8e9 + 5 + 10
    t['I end-of-phase passes, outputs'] = 20
    t['J checkpoints, I/O'] = 45
    gpu = sum(v for k, v in t.items() if k[0] in 'CDEFGH') - 10 - 6
    tot = sum(t.values())
    return dict(label=label, blocks=blocks, soil=soil, film_cells=film_cells, S_cells=S_cells1+S_cells2, simS=simS, t=t, total=tot, total09=tot/0.9, gpu=gpu, gpu09=gpu/0.9, S_work=S_work, K_per=K_per, K_dd=K_dd)
for variant in ('S-split', 'S-all', 'K-only'):
    for scale, name in ((1.0, 'typical 6.1 m2'), (8.5/6.1, 'design 8.5 m2')):
        r = run(scale, variant)
        print(f"--- {variant} / {name}: blocks {r['blocks']/1e6:.2f} M, film cells {r['film_cells']/1e6:.2f} M, S cells {r['S_cells']/1e6:.2f} M, soil cells {r['soil']/1e6:.2f} M, sim {r['simS']:.1f} s")
        for k, v in r['t'].items(): print(f"     {k:48s} {v:7.0f} s")
        print(f"     TOTAL {r['total']:.0f} s; with 0.9 sustained factor {r['total09']:.0f} s = {r['total09']/60:.1f} min; GPU kernel {r['gpu']:.0f} s -> {r['gpu09']/60:.1f} min; S work {r['S_work']:.2e}, K per {r['K_per']:.2e}, K dd {r['K_dd']:.2e}")
print("--- sensitivity of S kernel rate (design load)")
for variant in ('S-split', 'S-all'):
    for rate in (2.0e9, 1.0e9, 0.8e9, 0.6e9, 0.45e9, 0.3e9):
        r = run(8.5/6.1, variant, rate); r2 = run(1.0, variant, rate)
        print(f"     {variant:8s} rate {rate/1e9:.2f} G/s: typical {r2['total09']/60:.1f} min, design {r['total09']/60:.1f} min (GPU {r['gpu09']/60:.1f} min)")
# reserves
for scale, name in ((1.0, 'typical'), (8.5/6.1, 'design')):
    r = run(scale, 'S-split')
    reexp_off = (r['t']['G1 film S (SSP-RK2)'] + r['t']['G2 film K periodic'])*(2*4/26.0)*1.0 + r['t']['G3 film K drain-down (6 x 60 s)']/6*2*0.46 + 0.5*4e8*2*12/90e6/2 + 10
    reexp_fast = 45*scale**0.5
    conv = (r['t']['G1 film S (SSP-RK2)'] + r['t']['G2 film K periodic'])*(4/26.0)
    shake = 70
    print(f"--- reserves {name}: official re-exposure {reexp_off:.0f} s, fast re-exposure {reexp_fast:.0f} s, convergence extension {conv:.0f} s, extended shake-down {shake} s; worst case policy A {(r['total']+reexp_off+reexp_fast+conv+shake)/0.9/60:.1f} min, policy B {(r['total']+reexp_fast+conv+shake)/0.9/60:.1f} min")
# fast tier (same solver allocation, doubled cells, half the revolutions, 1/10 parcels, 8 layers)
def fast(scale):
    A = dict(flatH=3.8, hollowH=1.3, partial=0.6, mesh=0.4); A = {k: v*scale for k, v in A.items()}
    blocks = sum(A.values())/16e-6 + 0.05e6; soil = (A['flatH']*0.40 + A['hollowH']*0.35 + A['partial']*0.40 + A['mesh']*0.50)/4e-6
    simS = (3*1.714+6*1.82) + (3*2.0+6*2.4)   # 3 revolutions per combo
    S = (A['hollowH']/16e-6*1350 + A['partial']/4e-6*2700)*simS/1.0e9
    K = (A['flatH']/16e-6 + A['mesh']/12e-6 + 0.05e6)*448*18/0.3e9 + blocks*1434*6/0.3e9
    t = 12 + 15 + 3 + 6 + 1.2e8*12/90e6 + S + K + 5 + soil*3450*0.8*(8/12)/0.2e9 + blocks*3450/0.8e9 + 8 + 6 + 10
    return t/0.9, S, K
for scale, name in ((1.0, 'typical'), (8.5/6.1, 'design')):
    t, S, K = fast(scale); print(f"--- fast tier {name}: {t:.0f} s = {t/60:.1f} min (S {S:.0f} s, K {K:.0f} s)")
# memory, design load, S-split and S-all
for variant in ('S-split', 'S-all'):
    r = run(8.5/6.1, variant)
    b = r['blocks']; fc = r['film_cells']; sc = r['S_cells']; so = r['soil']
    mem = {
      'primitives, BVH, row tables, MESH triangles': 30e6,
      'block static (centre, normal, K links, twin, flags) 96 B': 96*b,
      'S state 2 x 16 B + static 8 B + deposit accumulators 20 B + statistics 32 B': 92*sc,
      'K hot 2 x 16 B + statistics 32 B': 64*b,
      'MC accumulator 288 B per block (MC stage only)': 288*b,
      'deposition table packed 144 B per block (film stage)': 144*b,
      'parcels 48 B x 2 M': 96e6,
      'footprint tables (2 sets resident)': 147e6,
      'FilmExposure 32 B x 4 resident': 128*fc,
      'DrainDown 8 B x 2 resident': 16*b,
      'JetExposure 56 B x 4 resident on 20 % of soil cells': 56*4*0.2*so,
      'soil cells 136 B (replay stage)': 136*so,
      'timeline block state 48 B (replay stage)': 48*b,
      'tile lists, monitors, staging, miscellaneous': 150e6 }
    mc = sum(mem[k] for k in mem if not any(s in k for s in ('S state','K hot','packed','parcels','FilmExposure','DrainDown','JetExposure','soil cells','timeline')))
    film = sum(mem[k] for k in mem if not any(s in k for s in ('MC accumulator','JetExposure','soil cells','timeline'))) - 128*fc + 64*fc
    rep = sum(mem[k] for k in mem if not any(s in k for s in ('MC accumulator','S state','K hot','packed','parcels','footprint')))
    print(f"--- memory {variant} design load: " + "; ".join(f"{k}: {v/1e6:.0f} MB" for k, v in mem.items()))
    print(f"    peaks: MC stage {mc/1e9:.2f} GB, film stage {film/1e9:.2f} GB, replay stage {rep/1e9:.2f} GB")
