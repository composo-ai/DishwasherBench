# Throwaway: release of a tablet behind a blocked lid under the shrinking-core law of chemistry 10.3 (numbers quoted in sim-core.md M9).
import math
R=8.314
# ---------- 1. Tablet release with a "blocked lid" w_tab = 0.05 ----------
def tau_tab(TC, tau_ref=480.0, E=25e3):
    T=TC+273.15
    return tau_ref*math.exp((E/R)*(1/T-1/313.15))
def release(profile, w, t_open=60.0, dt=1.0):
    # profile: list of (duration_s, T_start, T_end); returns released fraction history at segment ends
    x=1.0  # (m/m0)^(1/3)
    t=0.0; out=[]
    for dur,T0,T1 in profile:
        n=int(dur/dt)
        for i in range(n):
            TC=T0+(T1-T0)*(i+0.5)/n
            if t>=t_open:
                x=max(0.0,x-w*dt/tau_tab(TC))
            t+=dt
        out.append((t/60.0,1-x**3))
    return out
auto145=[(24*60,20,55),(30*60,55,55)]       # P2 heat-up, P3 hold (design section M4 table)
eco50=[(20*60,17,50),(70*60,50,50)]          # chemistry 10.12: heat 17->50 in ~20 min, hold, 90 min total
for name,prof in (("AUTO-145 main wash (P2+P3, 54 min)",auto145),("ECO-50 main wash (90 min)",eco50)):
    for w in (1.0,0.3,0.05,0.01,0.006,0.004):
        r=release(prof,w)
        print(f"{name:38s} w_tab={w:5.3f}: released "+", ".join(f"{f*100:5.1f}% @ {t:4.0f} min" for t,f in r))
# w needed for 15 % and 30 % release
def w_for(prof,target):
    lo,hi=0.0,1.0
    for _ in range(60):
        mid=(lo+hi)/2
        if release(prof,mid)[-1][1]<target: lo=mid
        else: hi=mid
    return hi
for name,prof in (("AUTO-145",auto145),("ECO-50",eco50)):
    print(f"{name}: w_tab giving 5/15/30 % released over the main wash: {w_for(prof,0.05):.4f} / {w_for(prof,0.15):.4f} / {w_for(prof,0.30):.4f}")
# Hill response to the delayed dose (soils set n=3, K=0.82 ref; design default), dose 20 g type D in 4.0 L => c/c_ref = 0.05/0.06
def hill(c,n=3,K=0.82): return (c**n/(K**n+c**n))/(1.0/(K**n+1.0))
r=release(auto145,0.05,dt=1.0)
# time-average of Hill factor during the hold (24..54 min), ignoring deactivation
x=1.0;t=0.0;acc=0;accn=0;cnt=0
for dur,T0,T1 in auto145:
    n=int(dur)
    for i in range(n):
        TC=T0+(T1-T0)*(i+0.5)/n
        if t>=60: x=max(0,x-0.05/tau_tab(TC))
        xn=1.0
        if t>=24*60:
            acc+=hill((1-x**3)*0.05/0.06); accn+=hill(0.05/0.06); cnt+=1
        t+=1
print(f"AUTO-145 hold: mean Hill factor blocked {acc/cnt:.3f} vs unblocked {accn/cnt:.3f} -> ratio {acc/accn:.2f}")
