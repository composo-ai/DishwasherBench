# Fast tier, memory table, and small numeric facts quoted in sim-core.md. Throwaway.
import math
from budget3 import *
# ---- fast tier: 4 mm blocks, S2 at 4 mm, S1 at 2 mm in class D, soil cells 2 mm, 8 layers; 4,096 phases; parcels a tenth; 1 settle + 2 steady per state, no transient
def fast(load):
    a=LOADS[load]; blocks=sum(a.values())/16e-6+0.05e6; s2=a['s2']/16e-6; s1f=a['s1']/4e-6; s1c=a['s1']/16e-6; kper=(a['flat']+a['cut'])/16e-6+0.05e6
    soil=sum(a[k]*SOILFRAC[k] for k in a)/4e-6
    rS=rate(48,1000); rK=rate(84,400); f=0.6
    su4=2*(MIX['quiet']*1+MIX['default']*1+MIX['jet']*4); su2=su_per_step(2)
    t={}; g1=0; ap=0; g2=0
    for cls,pump in (('W',2700),('D',3000),('R',2700)):
        for st in ('L','U'):
            ns,_=REV[(st,pump)]; n=3; r=2
            s1=s1f if cls=='D' else s1c
            g1+=n*ns*(s2*su4+s1*(su2 if cls=='D' else su4))/rS
            ap+=n*ns*(s2+s1)*(76/(f*BW)+20/BW)+r*ns*(s2+s1)*88/(f*BW)
            g2+=n*ns*kper/rK+r*ns*kper*88/(f*BW)
    t['A set-up; B shake-down']=(12+8*blocks/1e6+2*soil/1e6, 15)
    t['C, D jets, walks, gather']=4*2.0e8/4*(7/19)/TRACE+12*(0.2*soil*40*3*1.5)/0.2e9+3
    t['E pilots']=6*(400*blocks/rate(40,50)+1e7*12/TRACE*0.5+1.0)
    t['F Monte Carlo']=0.1*(2*3e8+2*1.5e8)*12/TRACE
    t['G1 film S']=g1+ap
    t['G2, G3 film K periodic and drain-down']=g2+6*1434*blocks/rK
    t['G4 time-coupled parcels']=3.0e9*0.25*(sum(a.values())/5.06)**0.5/TRACE
    t['H replay']=soil*3430*0.8*(8/12)/rate(340,1100)+(blocks+s1f)*3430*100/(f*BW)+blocks*3430*200/(f*BW)+8
    t['I, J end passes and I/O']=14
    tot=sum(sum(v) if isinstance(v,tuple) else v for v in t.values())
    return t,tot,blocks,soil
ta,sa,ba,soa=fast('typical'); tb,sb,bb,sob=fast('design')
print(f"FAST TIER: blocks {ba/1e6:.2f} / {bb/1e6:.2f} M; soil cells {soa/1e6:.2f} / {sob/1e6:.2f} M")
for k in ta:
    va,vb=ta[k],tb[k]
    if isinstance(va,tuple): print(f"   {k:40s} {va[0]:.0f}; {va[1]:.0f} / {vb[0]:.0f}; {vb[1]:.0f}")
    else: print(f"   {k:40s} {va:5.0f} / {vb:5.0f}")
print(f"   SUM {sa:.0f} / {sb:.0f} s; with 0.9: {sa/0.9:.0f} s ({sa/0.9/60:.1f} min) / {sb/0.9:.0f} s ({sb/0.9/60:.1f} min)")
# ---- memory, design load
c=counts('design'); MB=1e6
blocks=c['blocks']; scells=c['s2']+c['s1_fine']; kblocks=c['kper']; film=c['film_D']; soil=c['soil']
rows=[('Primitives, trees, patch and row tables',None,30),
 ('BlockStatic + BlockAux','112 per block',112*blocks/MB),
 ('KParams (one liquor class)','32 per K block',32*blocks/MB),
 ('KHot, two copies (all blocks, for drain-down)','32 per block',32*blocks/MB),
 ('SFilm x 2, SStatic, SSlow','48 per S cell',48*scells/MB),
 ('Deposit accumulators, current and next','40 per S cell, 16 per K block',(40*scells+16*kblocks)/MB),
 ('Film statistics (recorded revolutions)','80 per film cell',80*film/MB),
 ('Monte Carlo accumulator (stage F)','288 per block',288*blocks/MB),
 ('Deposition table, packed, per arm','144 per block',144*blocks/MB),
 ('Jet-wet table, per arm','8 per block',8*blocks/MB),
 ('Parcels, 2 M slots','48',96),
 ('Footprint records, one diverter state','96 per (sub-jet, phase)',96*16384*44/MB),
 ('Emitter entries, one diverter state','16 per entry',100),
 ('FilmExposure, one record','32 per film cell',32*film/MB),
 ('DrainDown, one record','8 per block',8*blocks/MB),
 ('JetExposure, one record set (tiles near tracks, 20 % of soil cells)','56 per soil cell',56*0.2*soil/MB),
 ('SoilCell + SoilStatic','136 + 8 per soil cell',144*soil/MB),
 ('TimelineBlock','64 per block',64*blocks/MB),
 ('EffectiveExposure','40 per film cell',40*film/MB),
 ('Tile lists, monitors, link tables, staging',None,150)]
print("MEMORY (design load), MB:")
d={}
for n,b,v in rows: d[n]=v; print(f"   {n:70s} {b or '':34s} {v:6.0f}")
g=lambda *ks: sum(d[k] for k in ks)
scene=g('Primitives, trees, patch and row tables','BlockStatic + BlockAux')
run=g('SoilCell + SoilStatic','TimelineBlock','EffectiveExposure')+4*d['FilmExposure, one record']+2*d['DrainDown, one record']+4*d['JetExposure, one record set (tiles near tracks, 20 % of soil cells)']
stF=scene+g('Monte Carlo accumulator (stage F)','Parcels, 2 M slots','Footprint records, one diverter state','Tile lists, monitors, link tables, staging')+2*d['Jet-wet table, per arm']
stG=scene+g('KParams (one liquor class)','KHot, two copies (all blocks, for drain-down)','SFilm x 2, SStatic, SSlow','Deposit accumulators, current and next','Film statistics (recorded revolutions)','Parcels, 2 M slots','Footprint records, one diverter state','Emitter entries, one diverter state','Tile lists, monitors, link tables, staging')+2*d['Deposition table, packed, per arm']+2*d['FilmExposure, one record']+d['DrainDown, one record']
stH=scene+run+d['Tile lists, monitors, link tables, staging']
print(f"   scene {scene:.0f}; run-scoped replay state incl. resident records {run:.0f}; stage F {stF:.0f}; stage G {stG:.0f}; stage H {stH:.0f}; stage G with replay state left resident {stG+run:.0f}")
cpu_map=6*(2*d['FilmExposure, one record']+d['DrainDown, one record']+3*d['JetExposure, one record set (tiles near tracks, 20 % of soil cells)']+3*8*blocks/MB)+6*d['Deposition table, packed, per arm']+4*(d['Footprint records, one diverter state']+100)
print(f"   memory-mapped cache files (6 combos of records, 6 deposition tables, 4 footprint and emitter sets): {cpu_map:.0f} MB; largest binding {max(v for _,_,v in rows):.0f} MB")
# ---- small facts
rho=985.7; mu=5.04e-4; g=9.81; D=1e-10; xL=0.02
def nuss(G): h=(3*mu*G/(rho*rho*g))**(1/3); return h,rho*g*h
def Gx(tau,h,vren):
    lev=0.538*(D*D*tau/(mu*xL))**(1/3) if tau>0 else 0.0; km=max(lev,D/h) if h>0 else float('inf')
    return 1/((0 if km==float('inf') else 1/km)+1/vren) if vren>0 else 0.0
def hill(c,n=3,K=0.82): return (c**n/(K**n+c**n))/(1/(K**n+1))
h,t=nuss(0.02); Gref=Gx(t,h,0.02/(rho*0.1)); ku=0.3*Gref
chi=lambda G: max(1e-3,min(1,(G/(G+ku))/(Gref/(Gref+ku))))
print(f"SUPPLY: reference film 0.02 kg/(m s), catchment 0.1 m: h {h*1e6:.0f} um, tau {t:.2f} Pa, G_ref {Gref:.2e} m/s")
for name,Gam,dep,L in (("film 0.002 kg/(m s) below a 0.1 m catchment",0.002,0,0.1),("mist only, 1.4 g/(m2 s), film drains over 0.1 m",1.4e-3*0.1,1.4e-3,0.1),("mist only, 0.14 g/(m2 s)",1.4e-4*0.1,1.4e-4,0.1)):
    h,t=nuss(Gam); G=Gx(t,h,Gam/(rho*L)); c=chi(G); print(f"   {name:50s}: h {h*1e6:.0f} um, tau {t:.2f} Pa, v_ren {Gam/(rho*L):.2e}, G {G:.2e}, chi_E {c:.2f}, enzyme rate factor {hill(c):.2f}")
G=Gx(0,0,1.4e-3/rho); c=chi(G); print(f"   absorbed rain on soil, 1.4 g/(m2 s) (no film, G = v_ren): G {G:.2e}, chi_E {c:.2f}, rate factor {hill(c):.2f}")
G=Gx(0,30e-6,1.4e-3/rho); c=chi(G); print(f"   residual film 30 um fed at 1.4 g/(m2 s): G {G:.2e}, chi_E {c:.2f}, rate factor {hill(c):.2f}")
# onset masses
def lc(sig,r=998): return math.sqrt(sig/(r*9.81))
for name,sig,mu_,ta,tr in (("glass, wash liquor 55 C",0.040,5.04e-4,15,3),("glazed ceramic, wash liquor",0.040,5.04e-4,20,5),("steel, wash liquor",0.040,5.04e-4,45,10),("polypropylene, wash liquor",0.040,5.04e-4,50,25),("glass, water 20 C",0.060,1.0e-3,35,10),("polypropylene, water 20 C",0.060,1.0e-3,95,60)):
    bmax=0.03*lc(sig)*(math.cos(math.radians(tr))-math.cos(math.radians(ta)))
    dst=(15*mu_**2*sig*(1-math.cos(math.radians(ta)))/(990**3*9.81**2))**0.2
    mon=min(0.5*dst,bmax)*990
    print(f"ONSET {name:28s}: b_max {bmax*1e6:5.1f} um, delta_wet {0.5*dst*1e6:5.0f} um, onset mass {mon*1e3:5.1f} g/m2; wet within 3,240 s above {mon/3240:.1e} kg/(m2 s); at 1e-3 kg/(m2 s) after {mon/1e-3:.0f} s; at 1e-4 after {mon/1e-4:.0f} s")
# reference fluxes and parcel statistics
jref=0.51/5.06; jmc=0.15*jref; Mrev=jmc*5.06*0.5*1.9
for N in (3e8,1.5e8):
    mp=Mrev/N
    print(f"SAMPLING N {N:.1e}: reference flux {jref:.3f} kg/(m2 s), Monte Carlo mean {jmc:.4f}; parcel mass {mp:.2e} kg per revolution; parcels per block at 1e-4 / 1e-5 / 1e-6 kg/(m2 s): {1e-4*4e-6*1.9/mp:.2f} / {1e-5*4e-6*1.9/mp:.3f} / {1e-6*4e-6*1.9/mp:.4f}; windows of 28 / 254 / 2290 blocks hold 16 parcels down to {16*mp/(28*4e-6*1.9):.1e} / {16*mp/(254*4e-6*1.9):.1e} / {16*mp/(2290*4e-6*1.9):.1e} kg/(m2 s)")
# alkaline path and submerged jets
R=8.314
print("ALK: chemistry f_alk at 55 C pH 10.5:",round(0.10*math.exp(-(60e3/R)*(1/328.15-1/323.15))*10**0,3),"; soils-form factor (10^(pH-11.5)-0.1)/0.9 at pH 10.5, 11.0, 11.5:",[round(max(0,10**(p-11.5)-0.1)/0.9,3) for p in (10.5,11.0,11.5)])
for H in (0.017,0.04,0.08): print(f"SUB: depth {H*1e3:.0f} mm under a 2 mm jet: attenuation min(1, 70.8 (d/H)^2) = {min(1,70.8*(2e-3/H)**2):.3f}")
