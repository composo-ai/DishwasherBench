# Budget arithmetic quoted in sim-core.md section 7 (per-pass table, one derating convention). Throwaway.
import math, sys
BW = 110e9            # net buffer traffic of memory-bound kernels, measured 110 to 130 GB/s: lower end
FLOOR = 0.6e12        # arithmetic rate demonstrated without becoming the bound (160 flops x 3.94 G/s), flops/s
def rate(bytes_, flops, f=0.6, cap=1.0):
    r = f*BW/bytes_
    if flops > 300: r = min(r, cap*FLOOR/flops)
    return r
TRACE = 60e6          # segment queries/s: one third of the measured rate of the matching ray class on triangles (150 to 190 M/s)
LOADS = {  # m2 of surface by film class
 'typical': dict(flat=2.20, s2=2.41, s1=0.00, cut=0.45),          # IEC 13 place settings from the catalogue (areas.ts) plus two steel pots
 'design':  dict(flat=3.48, s2=3.81, s1=0.50, cut=0.71),          # 8.5 m2
}
AUX = 0.20e6
SOILFRAC = dict(flat=0.40, s2=0.37, s1=0.40, cut=0.50)
# time base (M4, M7.7): steps per revolution and period by (state, pump class)
REV = {('L',3000):(896,1.714), ('U',3000):(1024,2.0), ('L',2700):(960,1.818), ('U',2700):(1216,2.4)}
def plan(transients=('D',), settle=2, steady=2):
    out=[]   # (class, state, pump, revs total, revs recorded)
    for cls,pump in (('W',2700),('D',3000),('R',2700)):
        for st in ('L','U'):
            tr = 2 if cls in transients else 0
            out.append((cls,st,pump,settle+steady+tr,steady+tr))
    return out
def counts(load):
    a=LOADS[load]; blocks=sum(a.values())/4e-6+AUX
    c=dict(blocks=blocks, s2=a['s2']/4e-6, s1_fine=a['s1']/1e-6, s1_coarse=a['s1']/4e-6, kper=(a['flat']+a['cut'])/4e-6+AUX,
           soil=sum(a[k]*SOILFRAC[k] for k in a)/1e-6)
    c['film_D']=c['kper']+c['s2']+c['s1_fine']; c['film_W']=c['kper']+c['s2']+c['s1_coarse']
    return c
MIX = dict(quiet=0.40, default=0.35, jet=0.25)
def su_per_step(cell_mm, mix=MIX, jet_level=None):
    lv = {2:(0,1,3), 1:(0,2,4)}[cell_mm]
    if jet_level is not None: lv=(lv[0],lv[1],jet_level)
    return 2*(mix['quiet']*2**lv[0]+mix['default']*2**lv[1]+mix['jet']*2**lv[2])
def budget(load, variant='S-split', sc=None, parcels=(3e8,1.5e8), transients=('D',), fine_classes=('D',), verbose=False, mix=MIX, jetlv=None):
    sc = sc or {}
    rS=sc.get('S',rate(48,1000)); rK=sc.get('K',rate(84,400)); rTr=sc.get('trace',TRACE); rSoil=sc.get('soil',rate(340,1100)); f=sc.get('mem',0.6)
    c=counts(load); P=plan(transients)
    steps=sum(REV[(st,p)][0]*n for _,st,p,n,_ in P); rec=sum(REV[(st,p)][0]*r for _,st,p,_,r in P); sim=sum(REV[(st,p)][1]*n for _,st,p,n,_ in P); revs=sum(n for *_,n,_ in P)
    t={}
    t['A set-up']=25+8*c['blocks']/1e6+2*c['soil']/1e6
    t['B hydraulics, shake-down']=30
    t['C primary jets']=4*2.0e8/rTr
    t['D gather, sector walks, emitter tables']=12*(0.2*c['soil']*150*3*1.5)/0.2e9+6
    t['E pilots']=6*(400*c['blocks']/rate(40,50,f)+1e7*12/rTr+2.0)
    t['F Monte Carlo']=(2*parcels[0]+2*parcels[1])*12/rTr
    g1=0; ap=0; st_=0; g2=0; kst=0
    for cls,stt,p,n,r in P:
        ns,_=REV[(stt,p)]
        if variant=='K-only': s2=s1=0; k=c['blocks']
        elif variant=='S-all': s2=c['s2']+LOADS[load]['flat']/4e-6; k=c['kper']-LOADS[load]['flat']/4e-6
        else: s2=c['s2']; k=c['kper']
        if variant!='K-only':
            fine = cls in fine_classes
            s1=c['s1_fine'] if fine else c['s1_coarse']
            g1+=n*ns*(s2*su_per_step(2,mix,jetlv[0] if jetlv else None)+s1*su_per_step(1 if fine else 2,mix,(jetlv[1] if fine else jetlv[0]) if jetlv else None))/rS
            ap+=n*ns*(s2+s1)*(76/(f*BW)+20/BW)
            st_+=r*ns*(s2+s1)*(176/2)/(f*BW)
        g2+=n*ns*k/rK; kst+=r*ns*k*(176/2)/(f*BW)+n*ns*k*8/BW
    t['G1 film S, stage updates']=g1
    t['G1b film S, apply, clear, statistics']=ap+st_
    t['G2 film K, periodic']=g2+kst
    t['G3 film K, drain-down']=6*3129*c['blocks']/rK
    t['G4 time-coupled parcels']=3.0e9*(sum(LOADS[load].values())/5.06)**0.5/rTr
    t['H replay']=c['soil']*3430*0.8/rSoil+c['film_D']*3430*100/(f*BW)+c['blocks']*3430*200/(f*BW)+15
    t['I end passes, drying, outputs']=20
    t['J checkpoints, cache, progress']=45
    tot=sum(t.values()); gpu=sum(v for k,v in t.items() if k[0] in 'CDEFGH')-15-12
    return dict(t=t,total=tot,gpu=gpu,c=c,steps=steps,rec=rec,sim=sim,revs=revs,per=t['G1 film S, stage updates']+t['G1b film S, apply, clear, statistics']+t['G2 film K, periodic']+t['G4 time-coupled parcels'])
def show(title, **kw):
    a=budget('typical',**kw); b=budget('design',**kw)
    print(f"--- {title}: revolutions {a['revs']}, simulated {a['sim']:.1f} s, base steps {a['steps']}, recorded {a['rec']}")
    for k in a['t']: print(f"     {k:42s} {a['t'][k]:6.0f} / {b['t'][k]:6.0f} s")
    print(f"     SUM {a['total']:.0f} / {b['total']:.0f} s; with 0.9: {a['total']/0.9:.0f} s ({a['total']/0.9/60:.1f} min) / {b['total']/0.9:.0f} s ({b['total']/0.9/60:.1f} min); GPU kernel time {a['gpu']/0.9:.0f} s ({a['gpu']/0.9/60:.1f} min) / {b['gpu']/0.9:.0f} s ({b['gpu']/0.9/60:.1f} min)")
    return a,b
if __name__=='__main__':
    print(f"planning rates: S {rate(48,1000)/1e9:.2f} G stage-updates/s (traffic bound {BW/48/1e9:.2f}); K {rate(84,400)/1e9:.2f} G block-steps/s (bound {BW/84/1e9:.2f}); soil {rate(340,1100)/1e9:.3f} G cell-ticks/s (bound {BW/340/1e9:.2f}); "
          f"apply {rate(76,50)/1e9:.2f} G/s; statistics {rate(176,50)/1e9:.2f} G samples/s; block pass T {rate(200,50)/1e9:.2f} G/s; pass W {rate(100,50)/1e9:.2f} G/s; R0 sweep {rate(40,50)/1e9:.2f} G/s")
    print(f"stage-updates per cell and base step: 2 mm {su_per_step(2):.1f}, 1 mm {su_per_step(1):.1f}")
    for l in LOADS:
        c=counts(l); print(f"counts {l}: blocks {c['blocks']/1e6:.2f} M; S2 cells {c['s2']/1e6:.2f} M; S1 cells {c['s1_fine']/1e6:.2f} M at 1 mm ({c['s1_coarse']/1e6:.3f} M blocks); K blocks in periodic solves {c['kper']/1e6:.2f} M; film cells class D {c['film_D']/1e6:.2f} M, classes W and R {c['film_W']/1e6:.2f} M; soil cells {c['soil']/1e6:.2f} M")
    a,b=show("PLAN: S-split, parcels 3e8/1.5e8 per table, transient label in class D")
    show("option: parcels 4e8/2e8", parcels=(4e8,2e8))
    show("option: transient label in every class", transients=('W','D','R'))
    show("option: 1 mm cells in every class", fine_classes=('W','D','R'))
    show("variant S-all (flat ware on S at 2 mm)", variant='S-all')
    show("variant K-only", variant='K-only')
    print("--- sensitivity (typical / design minutes; GPU design minutes)")
    for name,kw in (("plan",{}),("S at 1.0 G/s",dict(sc=dict(S=1.0e9))),("S at 0.4 G/s",dict(sc=dict(S=0.4e9))),("S at 0.3 G/s",dict(sc=dict(S=0.3e9))),
                    ("K at 0.4 G/s",dict(sc=dict(K=0.4e9))),("tracing at 36 M/s",dict(sc=dict(trace=36e6))),("tracing at 100 M/s",dict(sc=dict(trace=100e6))),
                    ("jet-active share 0.15",dict(mix=dict(quiet=0.45,default=0.40,jet=0.15))),("jet-active share 0.40",dict(mix=dict(quiet=0.30,default=0.30,jet=0.40))),
                    ("hand-over cap raised: jet levels 4 (2 mm) and 5 (1 mm)",dict(jetlv=(4,5))),
                    ("pessimistic: S 0.4, K 0.5, tracing 36 M/s, soil 0.12, jet share 0.40",dict(sc=dict(S=0.4e9,K=0.5e9,trace=36e6,soil=0.12e9),mix=dict(quiet=0.30,default=0.30,jet=0.40))),
                    ("optimistic: S 1.0, K 1.0, tracing 100 M/s",dict(sc=dict(S=1.0e9,K=1.0e9,trace=100e6)))):
        a2=budget('typical',**kw); b2=budget('design',**kw); print(f"     {name:70s} {a2['total']/0.9/60:5.1f} / {b2['total']/0.9/60:5.1f} min (GPU {b2['gpu']/0.9/60:5.1f})")
    # reserves, in simulated terms
    print("--- reserves (seconds, typical / design)")
    res={}
    for l,x in (('typical',a),('design',b)):
        t=x['t']; per=x['per']; revs=x['revs']; c=x['c']
        conv=per*4/revs                                              # at most 4 extension revolutions per run
        shake=100.0
        # reduced re-exposure of one class (both diverter states): trace 2 x 2e8, 2 pilots, gather 6 record sets, half the parcels of the two tables,
        # film 1 settle + 2 steady revolutions per state (6 of the 12 that class D gets), drain-down on the fast schedule (0.46 of the steps)
        reA=2*2.0e8/TRACE+2*t['E pilots']/6+t['D gather, sector walks, emitter tables']/2+0.5*2*3e8*12/TRACE+per*6/revs+t['G3 film K, drain-down']/6*2*0.46+8
        # fast re-exposure of one class on the same grid: 4,096 phases, a tenth of the parcels, 1 settle + 1 steady revolution per state, drain-down by Jeffreys' law per block
        reB=2*0.5e8/TRACE+2*t['E pilots']/6+t['D gather, sector walks, emitter tables']/8+0.1*2*3e8*12/TRACE+per*4/revs+6
        res[l]=dict(conv=conv,shake=shake,reA=reA,reB=reB)
    for k,nm in (('conv','convergence extension, 4 revolutions'),('shake','extended shake-down'),('reA','reduced re-exposure of the class in use'),('reB','fast re-exposure of one more class')):
        print(f"     {nm:44s} {res['typical'][k]:5.0f} / {res['design'][k]:5.0f}")
    for l,x in (('typical',a),('design',b)):
        r=res[l]; base=x['total']
        wA=(base+r['conv']+r['shake']+r['reA']+r['reB'])/0.9/60; wB=(base+r['conv']+r['shake']+2*r['reB'])/0.9/60; wC=(base+r['conv']+r['shake'])/0.9/60
        print(f"     worst case {l}: policy A {wA:.1f} min; policy B {wB:.1f} min; policy C {wC:.1f} min   (base {base/0.9/60:.1f} min)")
