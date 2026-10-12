# Throwaway audit: recompute section 7.2 of sim-core.md line by line. "doc" reproduces budget2.py; "audit" changes one assumption per line,
# each tied to a measured figure or to the document's own tables. Not a prediction: a sensitivity check of the planning numbers.
BW = 120e9          # measured net buffer traffic of memory-bound kernels, 110..130 GB/s (spike section 4)
def base(scale):
    A = {k: v*scale for k, v in dict(flatH=3.8, hollowH=1.3, partial=0.6, mesh=0.4).items()}
    aux = 0.20e6
    c = dict(S2=A['hollowH']/4e-6, S1=A['partial']/1e-6)
    blocks = sum(A.values())/4e-6 + aux
    soil = (A['flatH']*0.40 + A['hollowH']*0.35 + A['partial']*0.40 + A['mesh']*0.50)/1e-6
    film = A['flatH']/4e-6 + c['S2'] + c['S1'] + A['mesh']/3e-6 + aux
    return A, c, blocks, soil, film
ksteps = 6*896 + 8*960 + 4*1024 + 8*1216; simS = 6*1.714 + 8*1.818 + 4*2.0 + 8*2.4
def doc(scale):
    A, c, blocks, soil, film = base(scale)
    t = {}
    t['A'] = 25 + 8*blocks/1e6 + 2*soil/1e6
    t['B'] = 30
    t['C'] = 4*2.0e8/60e6
    t['D'] = 12*(0.2*soil*150*3*1.5)/0.2e9
    t['E'] = 6*(400*blocks/1.0e9 + 1e7*12/90e6 + (blocks/4)*448*2/0.3e9 + (blocks/4)*1434/0.3e9) + 6
    t['F'] = 1.2e9*12/90e6
    t['G1'] = (c['S2']*2700 + c['S1']*5225)*simS/1e9
    Kc = blocks - c['S2'] - c['S1']/4
    t['G2'] = Kc*ksteps/0.30e9
    t['G3'] = blocks*3129*6/0.30e9
    t['G4'] = 3.0e9*scale**0.5/90e6
    t['H'] = soil*3430*0.8/0.20e9 + blocks*3430/0.8e9 + 15
    t['I'] = 20; t['J'] = 45
    return t
def audit(scale, lo=True):
    A, c, blocks, soil, film = base(scale)
    t = dict(doc(scale)); why = {}
    # D: the gather loop visits every phase k0..k1; 150 samples per pass holds at grazing incidence, 430..2,500 at normal incidence (misc_checks.py D)
    f = 2.0 if lo else 5.0
    t['D'] *= f; why['D'] = f"x{f:.0f}: per-phase loop, 150 samples/pass only holds for grazing footprints"
    # F, G4: 90 M/s is 1/3 of the midpoint of 182..362 M/s (triangle BVH). Droplets are incoherent: 182..201 M/s measured -> 61..67 M/s at the same 1/3;
    # with the document's own 0.4 factor for the unmeasured analytic structure on top of 1/3 of 270 M/s: 36 M/s
    r = 64e6 if lo else 36e6
    t['F'] = 1.2e9*12/r; t['G4'] = 3.0e9*scale**0.5/r; why['F'] = why['G4'] = f"{r/1e6:.0f} M segments/s instead of 90"
    # G1: jet-active level from the document's own level table for a fan cut at 15..25 mm (hollow ware: curvature bound R/2): S2 level 4, S1 level 5,
    # keeping the document's 35 % of sprayed-rack items (17.5 % of all S cells); high case: 25 % of all S cells
    fr = 0.175 if lo else 0.25
    su2 = 2000 + fr*(16000 - 2000); su1 = 4000 + fr*(32000 - 4000)
    g1 = (c['S2']*su2 + c['S1']*su1)*simS/1e9
    # per-base-step passes over S cells that are not stage-updates (emit table -> accumulators, apply + clear, statistics): 236 B per cell and base step
    extra = (c['S2'] + c['S1'])*ksteps*(236 if not lo else 120)/BW
    t['G1'] = g1 + extra; why['G1'] = f"levels 4/5 while jet-active for {fr*100:.1f} % of S cell-time ({su2:.0f}/{su1:.0f} stage-updates per s) + {extra:.0f} s of per-base-step passes"
    # G2: bytes per K block and step in a recorded revolution: BlockStatic 96 + WetParams 16 + KHot 16 + 16 + Deposit 20 + 20 (clear) + KStats 32 + 32
    #     + deposition-table line 64 + BlockAux 16 + jetWet 8 = 336 B -> 0.36 G/s traffic bound; the document's 0.5 arithmetic factor -> 0.18; low case 0.8 -> 0.29
    rk = BW/336*(0.8 if lo else 0.5)
    Kc = blocks - c['S2'] - c['S1']/4
    t['G2'] = Kc*ksteps/rk; why['G2'] = f"336 B per block-step, not 190: {rk/1e9:.2f} G/s"
    # H: pass W is per film cell (100 B) and pass T per block (TimelineBlock 48 r + 48 w, BlockStatic 96, BlockAux 16, exposure 32 = 240 B); budget2.py counts blocks once at 0.8 G/s
    t['H'] = soil*3430*0.8/0.20e9 + film*3430*100/(0.67*BW) + blocks*3430*240/(0.67*BW) + 15
    why['H'] = "pass W per film cell + pass T at 240 B per block"
    return t, why
names = dict(A='A set-up', B='B hydraulics, shake-down', C='C primary jets', D='D gather', E='E pilots', F='F Monte Carlo', G1='G1 film S', G2='G2 film K periodic', G3='G3 K drain-down', G4='G4 live parcels', H='H replay', I='I end passes', J='J I/O')
for scale, name in ((1.0, 'typical 6.1 m2'), (8.5/6.1, 'design 8.5 m2')):
    d = doc(scale); (lo, why), (hi, _) = audit(scale, True), audit(scale, False)
    print(f"--- {name}")
    for k in names:
        print(f"   {names[k]:26s} doc {d[k]:6.0f} s   audit {lo[k]:6.0f} .. {hi[k]:6.0f} s   {why.get(k, '')}")
    sd, sl, sh = sum(d.values()), sum(lo.values()), sum(hi.values())
    gpu = lambda t: sum(t[k] for k in ('C','D','E','F','G1','G2','G3','G4','H')) - 16
    print(f"   SUM doc {sd:.0f} s -> /0.9 {sd/0.9/60:.1f} min;  audit {sl:.0f} .. {sh:.0f} s -> /0.9 {sl/0.9/60:.1f} .. {sh/0.9/60:.1f} min")
    print(f"   GPU kernel time C..H /0.9: doc {gpu(d)/0.9/60:.1f} min; audit {gpu(lo)/0.9/60:.1f} .. {gpu(hi)/0.9/60:.1f} min (allowance 20 min)")
    # reserves, as the text of 7.3 and M7.7 states them rather than as budget2.py codes them
    per = d['G1'] + d['G2'] + d['G4']
    conv_doc = (d['G1'] + d['G2'])*4/26; conv_all = per*12/26                      # every one of the 6 states may take 2 more revolutions
    reoff_doc = (d['G1'] + d['G2'])*8/26 + d['G3']/6*2*0.46 + 0.5*4e8*2*12/90e6/2 + 10 + d['D']/3
    reoff_txt = per*8/26 + d['G3']/6*2*0.46 + 0.5*4e8*2*12/90e6 + 2*2.0e8/60e6 + 2*(d['E']-6)/6 + d['D']/2   # half of 4e8 per state, trace, 2 pilots, 6 of 12 gather sets
    later_W = per*8/26 + 2*d['G3']/6 + 2*2e8*12/90e6 + 2*2.0e8/60e6 + 2*(d['E']-6)/6 + d['D']/2             # W-class sets invalidated by the epoch, recomputed on the lazy path
    print(f"   reserves: convergence doc {conv_doc:.0f} s (two states) vs {conv_all:.0f} s if all six states extend; official re-exposure doc {reoff_doc:.0f} s vs {reoff_txt:.0f} s as the text defines it;")
    print(f"             W-class sets invalidated by a main-wash epoch and recomputed when P4 starts (not in 7.3): {later_W:.0f} s")
    refast = 45*scale**0.5
    wA_doc = (sd + reoff_doc + refast + conv_doc + 70)/0.9/60
    wA_txt = (sd + reoff_txt + later_W + refast + conv_all + 70)/0.9/60
    wB_txt = (sd + later_W*0 + refast + conv_all + 70)/0.9/60
    print(f"   worst case policy A: doc {wA_doc:.1f} min; with the text's own definitions {wA_txt:.1f} min (planning rates unchanged); policy B {wB_txt:.1f} min")
