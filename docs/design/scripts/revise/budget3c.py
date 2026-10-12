from budget3 import *
import budget3
def b2(load, variant, **kw):
    # variant 'S-mainwash': S solves only in class D; classes W and R run K on every block
    if variant!='S-mainwash': return budget(load, variant=variant, **kw)
    full=budget(load, variant='S-split', **kw); konly=budget(load, variant='K-only', **kw)
    P=plan(kw.get('transients',('D',)))
    frac=sum(REV[(st,p)][0]*n for cls,st,p,n,_ in P if cls=='D')/sum(REV[(st,p)][0]*n for _,st,p,n,_ in P)
    t=dict(full['t'])
    for k in ('G1 film S, stage updates','G1b film S, apply, clear, statistics','G2 film K, periodic'):
        t[k]=frac*full['t'][k]+(1-frac)*konly['t'][k]
    tot=sum(t.values()); gpu=sum(v for k,v in t.items() if k[0] in 'CDEFGH')-27
    return dict(t=t,total=tot,gpu=gpu)
for variant,sc in (('S-all',dict(S=1.2e9)),('S-all',dict(S=1.0e9)),('S-all',dict(S=0.8e9)),('S-split',dict(S=1.0e9)),('S-split',dict()),('S-split',dict(S=0.45e9)),('S-mainwash',dict(S=0.45e9)),('S-mainwash',dict(S=0.35e9)),('S-mainwash',dict(S=0.25e9)),('K-only',dict())):
    a=b2('typical',variant,sc=sc); b=b2('design',variant,sc=sc)
    print(f"{variant:11s} S rate {sc.get('S',0.6e9)/1e9:.2f} G/s: {a['total']/0.9/60:5.1f} / {b['total']/0.9/60:5.1f} min; GPU {a['gpu']/0.9/60:5.1f} / {b['gpu']/0.9/60:5.1f} min")
# cut list at the plan rates, design load
base=budget('design'); print("design plan", round(base['total']/0.9/60,1))
for name,kw in (("parcels x 0.5",dict(parcels=(1.5e8,0.75e8))),("no transient label",dict(transients=())),("rivulet-prone items at 2 mm",dict(fine_classes=())),("all three",dict(parcels=(1.5e8,0.75e8),transients=(),fine_classes=()))):
    b=budget('design',**kw); print(f"   cut: {name:30s} design {b['total']/0.9/60:5.1f} min (saves {(base['total']-b['total'])/0.9:4.0f} s); GPU {b['gpu']/0.9/60:5.1f}")
# share table
a=budget('typical'); t=a['t']; tot=a['total']
film=sum(v for k,v in t.items() if k.startswith('G')); print("shares typical: film %.0f %%, Monte Carlo %.0f %%, jets+gather+pilots %.0f %%, replay %.0f %%, rest %.0f %%"%(film/tot*100,t['F Monte Carlo']/tot*100,(t['C primary jets']+t['D gather, sector walks, emitter tables']+t['E pilots'])/tot*100,t['H replay']/tot*100,(t['A set-up']+t['B hydraulics, shake-down']+t['I end passes, drying, outputs']+t['J checkpoints, cache, progress'])/tot*100))
b=budget('design'); t=b['t']; tot=b['total']; film=sum(v for k,v in t.items() if k.startswith('G'))
print("shares design: film %.0f %%, MC %.0f %%"%(film/tot*100,t['F Monte Carlo']/tot*100))
# work counts
for l in ('typical','design'):
    x=budget(l); c=x['c']
    su=x['t']['G1 film S, stage updates']*rate(48,1000)
    print(l,"S stage-updates %.2e; K block-steps periodic %.2e; drain-down %.2e; soil cell-ticks %.2e; gather pairs %.2e"%(su, c['kper']*x['steps'], 6*3129*c['blocks'], c['soil']*3430*0.8, 12*0.2*c['soil']*150*3*1.5))
