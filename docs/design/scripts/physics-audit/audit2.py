import math
# ---------- 2. Enzyme supply factor: document numbers vs registry defaults and record definitions ----------
D=1e-10
def hill(chi,n=3,K=0.82): return (chi**n/(K**n+chi**n))/(1/(K**n+1))
def km(tau,mu,xL,h):
    lev=0.538*(D*D*(tau/mu)/xL)**(1/3) if tau>0 else 0.0
    dif=D/h if h>0 else float('inf')
    return max(lev,dif)
def Gof(k,v): 
    if v<=0 or k<=0: return 0.0
    return 1/((1/k if k!=float('inf') else 0.0)+1/v)
rho=985.7; mu55=5.04e-4; g=9.81
def nusselt(Gam,mu=mu55):
    h=(3*mu*Gam/(rho*rho*g))**(1/3); return h, rho*g*h, Gam/(rho*h)
print("reference film Gamma=0.02: h %.0f um tau %.2f Pa u %.3f m/s"%(nusselt(0.02)[0]*1e6,nusselt(0.02)[1],nusselt(0.02)[2]))
cases={}
for label,xL,vdef,muu in (("doc script (x_L=50 mm, v_ren=Gamma/(rho*0.1 m), mu(50C))",0.05,'plate',5.47e-4),
                          ("registry x_L=20 mm, v_ren=Gamma/(rho*0.1 m)",0.02,'plate',mu55),
                          ("registry x_L=20 mm, v_ren=rho*h*renew/rho with renew=u/cell, cell 2 mm",0.02,2e-3,mu55),
                          ("same, cell 1 mm",0.02,1e-3,mu55),
                          ("same, cell 4 mm",0.02,4e-3,mu55)):
    def G_film(Gam):
        h,tau,u=nusselt(Gam,muu)
        v=Gam/(rho*0.1) if vdef=='plate' else h*u/vdef
        return Gof(km(tau,muu,xL,h),v),v
    Gref,vref=G_film(0.02)
    ku=0.3*Gref
    def chi(G): return min(1.0,(G/(G+ku))/(Gref/(Gref+ku)))
    Gw,vw=G_film(0.002)
    # mist-only: depFlux 1.4 g/m2/s; h_f either 100 um (script) or undefined (0 -> k_m infinite)
    Gm100=Gof(km(0,muu,xL,100e-6),1.4e-3/rho)
    Gm0=Gof(float('inf'),1.4e-3/rho)
    Gm50=Gof(km(0,muu,xL,50e-6),1.4e-3/rho)
    print(f"{label}\n   G_ref {Gref:.2e} (v_ren {vref:.2e}); weak film 0.002: chi {chi(Gw):.2f} Hill {hill(chi(Gw)):.2f}; "
          f"mist 1%: h_f=100um chi {chi(Gm100):.2f} Hill {hill(chi(Gm100)):.2f} | h_f=50um Hill {hill(chi(Gm50)):.2f} | h_f undefined(0) chi {chi(Gm0):.2f} Hill {hill(chi(Gm0)):.2f}")
# ---------- 3. Pressure footprint integral: sech^2(0.916x+0.95x^3) should integrate to rho Q V ----------
N=200000; s=0.0; dx=5.0/N
for i in range(N):
    x=(i+0.5)*dx; s+=x/math.cosh(0.916*x+0.95*x**3)**2*dx
print(f"integral of sech^2(0.916x+0.95x^3) x dx = {s:.4f} (rho Q V requires 0.2500) -> force ratio {s/0.25:.3f}")
# ---------- 4. Mug base recess wedge: approximate formula (standards P37) vs exact circular-segment quadrature ----------
Rr=25.0; h=3.0
for th in (7,15,30):
    t=math.tan(math.radians(th)); L=h/t
    approx=(8/15)*math.sqrt(2*Rr)*h**2.5/t**1.5
    n=200000; V=0.0; dxx=min(L,2*Rr)/n
    for i in range(n):
        x=(i+0.5)*dxx
        V+=2*math.sqrt(max(x*(2*Rr-x),0))*(L-x)*t*dxx
    print(f"tilt {th:2d} deg: L/R {L/Rr:.2f}  approx {approx/1000:.3f} mL  exact segment {V/1000:.3f} mL  ratio {V/approx:.3f}")
# ---------- 5. Friction-branch crossover ----------
Re=(24/0.288)**(1/0.6); Re2=(24/0.28797)**(1/0.599)
print(f"crossover with f=max(24/Re,0.288 Re^-0.40): Re = {Re:.0f}; with unrounded Brauer (0.28797, -0.401): {Re2:.0f}")
