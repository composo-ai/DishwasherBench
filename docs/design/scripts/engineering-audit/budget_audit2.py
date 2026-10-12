# Three-scenario recount of section 7.2 (see budget_audit.py for the reasoning behind each line).
BW = 120e9
ksteps = 6*896 + 8*960 + 4*1024 + 8*1216; simS = 6*1.714 + 8*1.818 + 4*2.0 + 8*2.4
def base(scale):
    A = {k: v*scale for k, v in dict(flatH=3.8, hollowH=1.3, partial=0.6, mesh=0.4).items()}
    aux = 0.20e6; S2 = A['hollowH']/4e-6; S1 = A['partial']/1e-6
    blocks = sum(A.values())/4e-6 + aux
    soil = (A['flatH']*0.40 + A['hollowH']*0.35 + A['partial']*0.40 + A['mesh']*0.50)/1e-6
    film = A['flatH']/4e-6 + S2 + S1 + A['mesh']/3e-6 + aux
    return S2, S1, blocks, soil, film
def lines(scale, sc):
    S2, S1, blocks, soil, film = base(scale)
    p = dict(doc=dict(D=1, rp=90e6, lv=None, fr=0.175, xb=0, rk=0.30e9, H='doc'),
             low=dict(D=2, rp=64e6, lv=(8000, 16000), fr=0.175, xb=120, rk=BW/336*0.8, H='aud'),
             mid=dict(D=3, rp=50e6, lv=(16000, 32000), fr=0.175, xb=180, rk=BW/336*0.65, H='aud'),
             high=dict(D=5, rp=36e6, lv=(16000, 32000), fr=0.25, xb=236, rk=BW/336*0.5, H='aud'))[sc]
    t = {}
    t['A'] = 25 + 8*blocks/1e6 + 2*soil/1e6; t['B'] = 30; t['C'] = 4*2.0e8/60e6
    t['D'] = p['D']*12*(0.2*soil*150*3*1.5)/0.2e9
    t['E'] = 6*(400*blocks/1.0e9 + 1e7*12/90e6 + (blocks/4)*448*2/0.3e9 + (blocks/4)*1434/0.3e9) + 6
    t['F'] = 1.2e9*12/p['rp']
    if p['lv'] is None: su2, su1 = 2700.0, 5225.0
    else: su2 = 2000 + p['fr']*(p['lv'][0]-2000); su1 = 4000 + p['fr']*(p['lv'][1]-4000)
    t['G1'] = (S2*su2 + S1*su1)*simS/1e9 + (S2+S1)*ksteps*p['xb']/BW
    t['G2'] = (blocks - S2 - S1/4)*ksteps/p['rk']
    t['G3'] = blocks*3129*6/0.30e9
    t['G4'] = 3.0e9*scale**0.5/p['rp']
    t['H'] = soil*3430*0.8/0.20e9 + (blocks*3430/0.8e9 if p['H']=='doc' else film*3430*100/(0.67*BW) + blocks*3430*240/(0.67*BW)) + 15
    t['I'] = 20; t['J'] = 45
    return t
for scale, name in ((1.0, 'typical'), (8.5/6.1, 'design')):
    print(f"--- {name}:  line: doc / low / mid / high (s)")
    T = {sc: lines(scale, sc) for sc in ('doc','low','mid','high')}
    for k in ('A','B','C','D','E','F','G1','G2','G3','G4','H','I','J'):
        print(f"   {k:3s} " + " / ".join(f"{T[sc][k]:5.0f}" for sc in T))
    gpu = lambda t: (sum(t[k] for k in ('C','D','E','F','G1','G2','G3','G4','H')) - 16)/0.9/60
    print("   total /0.9, min: " + " / ".join(f"{sum(T[sc].values())/0.9/60:5.1f}" for sc in T))
    print("   GPU C..H /0.9, min: " + " / ".join(f"{gpu(T[sc]):5.1f}" for sc in T))
