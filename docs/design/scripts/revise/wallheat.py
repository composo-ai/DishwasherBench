# Throwaway: supply-limited wall conductance of sim-core.md M10 against a one-dimensional film energy balance (numbers quoted in M10).
import math
# Supply-limited conductance U_e = (1/alpha + A_up/(cp Gamma W))^-1 (design M10) versus a 1-D film energy balance down a cold plate.
cp=4180.0; Gam=0.035; L=0.25; C=6500.0   # C'' per wetted face (half of 13 kJ/m2K porcelain), J/m2K
rho=985.7; mu=5.04e-4; k=0.645; g=9.81
h=(3*mu*Gam/(rho*rho*g))**(1/3); alpha=1.88*k/h
Tl=55.0; T0=20.0
n=250; dx=L/n; dt=0.01
Ts_ex=[T0]*n; Ts_de=[T0]*n
probe={ 'top (x=5 mm)':int(0.005/dx), 'middle':n//2, 'bottom':n-1 }
out={}
t=0.0; maxdiff={k_:0.0 for k_ in probe}; E_ex=E_de=0.0
first=True
while t<60.0:
    # exact: march film temperature down the plate (quasi-steady film, wall node per cell)
    Tf=Tl; q_ex=0.0
    for i in range(n):
        # analytic within the cell for fixed Ts
        e=math.exp(-alpha*dx/(cp*Gam)); Tf_out=Ts_ex[i]+(Tf-Ts_ex[i])*e
        qcell=cp*Gam*(Tf-Tf_out)/dx    # W/m2 into wall
        q_ex+=qcell*dx
        Ts_ex[i]+=dt*qcell/C; Tf=Tf_out
    q_de=0.0
    for i in range(n):
        x=(i+0.5)*dx
        Ue=1/(1/alpha+x/(cp*Gam))
        qcell=Ue*(Tl-Ts_de[i]); q_de+=qcell*dx
        Ts_de[i]+=dt*qcell/C
    if first:
        print(f"h {h*1e6:.0f} um, alpha_fw {alpha:.0f} W/m2K, cp*Gamma {cp*Gam:.0f} W/(m K); heat the film can give up at t=0: {cp*Gam*(Tl-T0):.0f} W per m width")
        print(f"t=0 heat extracted per m width: 1-D film balance {q_ex:.0f} W, design U_e closure {q_de:.0f} W  (ratio {q_de/q_ex:.2f}; ratio to film capacity {q_de/(cp*Gam*(Tl-T0)):.2f})")
        first=False
    for k_,i in probe.items():
        d=abs(Ts_ex[i]-Ts_de[i])
        if d>maxdiff[k_]: maxdiff[k_]=d; out[k_]=(t,Ts_ex[i],Ts_de[i])
    t+=dt
for k_ in probe:
    t_,a,b=out[k_]; print(f"{k_:14s}: max |T_exact - T_design| = {maxdiff[k_]:.1f} K at t = {t_:.1f} s (exact {a:.1f} C, design {b:.1f} C)")
