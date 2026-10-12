# Throwaway: reproduce machine.md sec 3.3 arm speeds and retune k_f for C_v = 0.97.
import math
rho=1000.0
# id, half, R mm, theta deg, rho deg, A mm2, Cd
L=[(238,90,55,7.07,0.85),(226,359,89,8.30,0.78),(182,160,60,4.52,0.85),(145,305,70,4.52,0.85),(114,90,89,8.30,0.78),
   (89,179,89,8.30,0.78),(162,65,70,4.52,0.85),(194,43,62,4.52,0.85),(223,90,89,8.30,0.78),(238,60,55,7.07,0.85),
   (150,180,-55,4.91,0.80),(75,180,-70,4.91,0.80)]
M=[(222,90,60,5.31,0.85),(205,0,85,6.65,0.78),(170,70,72,3.80,0.85),(140,180,80,3.80,0.85),(105,90,88,6.65,0.78),
   (70,0,88,6.65,0.78),(40,90,80,3.80,0.85),(222,60,58,5.31,0.85),(190,0,-75,3.80,0.80),(110,180,-80,3.80,0.80)]
T=[(35,90,-80,3.14,0.80),(60,90,-80,3.14,0.80),(85,90,-55,3.14,0.80),(48,90,-80,3.14,0.80),(72,90,-80,3.14,0.80),(125,90,-55,3.14,0.80)]
def arm(noz,p,Cv,kf,cv,Ahub,W,s):
    v=Cv*math.sqrt(2*p/rho); drive=0; brake=0; Fjz=0; Q=0
    for R,th,rh,A,Cd in noz:
        md=rho*Cd*A*1e-6*math.sqrt(2*p/rho); r=R*1e-3
        t=math.cos(math.radians(rh))*math.sin(math.radians(th))
        drive+=md*v*r*t; brake+=md*r*r; Fjz+=md*v*math.sin(math.radians(rh)); Q+=md/rho
    Fax=p*Ahub+s*(Fjz+W)
    om=max(0.0,(drive-kf*abs(Fax))/(brake+cv))
    return om*60/(2*math.pi),drive,Fax,brake,v,Q*6e4
def solve_kf(noz,p,Cv,cv,Ahub,W,s,rpm):
    om=rpm*2*math.pi/60
    _,drive,Fax,brake,_,_=arm(noz,p,Cv,0,cv,Ahub,W,s)
    return (drive-om*(brake+cv))/abs(Fax)
for name,noz,p,kf,cv,Ahub,W,s,rpm in (("lower",L,34.9e3,9.3e-3,0.002,346e-6,1.8,-1,35),("mid",M,33.6e3,3.8e-3,0.002,254e-6,1.5,+1,30),("top",T,24.9e3,5.0e-3,0.0005,113e-6,0.6,+1,60)):
    r1=arm(noz,p,1.0,kf,cv,Ahub,W,s); r2=arm(noz,p,0.97,kf,cv,Ahub,W,s)
    kf1=solve_kf(noz,p,1.0,cv,Ahub,W,s,rpm); kf2=solve_kf(noz,p,0.97,cv,Ahub,W,s,rpm)
    print(f"{name}: Cv=1.0 kf={kf*1e3:.1f}mm -> {r1[0]:.1f} rpm (drive {r1[1]:.3f} N m, Fax {r1[2]:.2f} N, v {r1[4]:.2f}, Q {r1[5]:.1f} L/min); Cv=0.97 same kf -> {r2[0]:.1f} rpm; kf for {rpm} rpm: Cv=1 {kf1*1e3:.2f} mm, Cv=0.97 {kf2*1e3:.2f} mm")
