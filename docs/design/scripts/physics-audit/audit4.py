import math
# Oblique jet (Kate distribution) with the design's closures: where does the liquid go at grazing incidence?
rho=985.7; nu=0.511e-6; gam=0.0672   # water 55 C
def analyse(d,V,phi_deg,L_edge,xi=0.0):
    r0=d/2; phi=math.radians(phi_deg); Q=math.pi*r0*r0*V
    q0=V*r0*r0/2
    Rj0=0.289*Q**0.75*(rho/(nu*gam))**0.25
    n=20000; tot=0; reach=0; sheet=0; Msum=0; hs=[]
    for i in range(n):
        psi=-math.pi+(i+0.5)*2*math.pi/n
        q=q0*math.sin(phi)**3/(1-math.cos(psi)*math.cos(phi))**2
        dq=q*2*math.pi/n; tot+=dq
        deq=math.sqrt(8*q/V); Re=V*deq/nu
        Rj=0.289*(2*math.pi*q*(1-xi))**0.75*(rho/(nu*gam))**0.25
        # distance to the rim along this ray, plate rim taken as a straight line L_edge ahead of S
        c=math.cos(psi)
        dist=L_edge/c if c>1e-6 else float('inf')
        if Rj>dist:
            reach+=dq
            # film state at the rim (BLFZ / laminar / turbulent by the design's zone limits)
            x=dist/deq; rb=0.24*Re**(1/3); rt=0.2964*Re**(1/3)
            if x<rb: h=deq*(0.125/x+1.06*Re**-0.5*x**0.5); U=V/(8*x*(h/deq)); cM=1.2
            elif x<rt: h=deq*(3.792*x*x/Re+0.1975/x); U=V/(8*x*(h/deq)); cM=1.2
            else:
                U=V/(0.167*Re**-0.25*x**2.25+2.37-0.0108*Re**0.5); h=deq*(0.0209*Re**-0.25*x**1.25+(0.296-0.001356*Re**0.5)/x); cM=64/63
            M=cM*rho*U*U*h
            if M>2*gam: sheet+=dq; hs.append((dq,h,U))
    hm=sum(w*h for w,h,U in hs)/max(sum(w for w,h,U in hs),1e-30); Um=sum(w*U for w,h,U in hs)/max(sum(w for w,h,U in hs),1e-30)
    # forward ray numbers
    q=q0*math.sin(phi)**3/(1-math.cos(phi))**2; deq=math.sqrt(8*q/V); Re=V*deq/nu; rb=0.24*Re**(1/3)*deq
    return tot/Q, reach/Q, sheet/Q, hm, Um, deq, Re, rb, Rj0
for d,V in ((2.25e-3,8.11),(2.81e-3,8.11)):
    for phi in (5,10,15,30):
        for L in (0.10,0.15):
            tot,reach,sheet,hm,Um,deq,Re,rb,Rj0=analyse(d,V,phi,L)
            print(f"d {d*1e3:.2f} mm V {V} m/s phi {phi:2d} deg, rim {L*1e3:.0f} mm ahead: flow check {tot:.3f}; fraction of jet flow whose fan reaches the rim {reach:.2f}, leaving as free sheet (M>2 gamma) {sheet:.2f}; "
                  f"flow-mean sheet h {hm*1e6:.0f} um -> 3h = {3*hm*1e3:.2f} mm at {Um:.1f} m/s | forward ray: d_eq {deq*1e3:.1f} mm, Re_eq {Re:.0f}, r_b {rb*1e3:.0f} mm, Re_x at r_b {V*rb/nu:.2e}")
