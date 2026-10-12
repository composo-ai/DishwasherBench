# Spotless research dossier: JETS

Jet and droplet fluid mechanics from nozzle exit to first wall contact and the immediate impingement region.

- Author: "jets" research specialist
- Date: 2026-10-08
- Status: literature and first-principles synthesis, uncalibrated. Every number carries a source and one confidence tag.

Confidence tags used throughout:

- **[VERIFIED]** the value or equation was seen in source text fetched this session (source named next to it).
- **[RECALLED]** from memory; the source was not opened this session. Treat as needing a check before it becomes load-bearing.
- **[ESTIMATED]** my own derivation or arithmetic, shown or reproducible from the equations given. Values computed by inserting numbers into VERIFIED equations are tagged ESTIMATED because the arithmetic is mine.

Research limitation to know about: the literature search stopped about two thirds of the way through. Items 6 (wires, edges, tines), 7 (concave vessels), the oblique-jet primary papers (Kate et al. 2007, Wang et al. 2013), the moving-surface jet literature (Gradeck 2006, Keshavarz 2011) and the CFD-code splash models other than Bai-Gosman (Stanton-Rutland, O'Rourke-Amsden 2000, Kuhnke) could therefore only be covered through secondary sources already downloaded, or from memory. These gaps are flagged where they occur.

---

## 0. Notation, reference properties, reference jet

### 0.1 Symbols (SI units unless stated)

| Symbol | Meaning |
|---|---|
| d_n | nozzle (orifice) diameter, m |
| d, r0 = d/2 | contracted jet diameter and radius, m |
| V | jet bulk speed, m/s (lab frame unless stated) |
| Q = pi d^2 V / 4 | jet volume flow, m^3/s |
| rho, mu, nu = mu/rho | liquid density, dynamic and kinematic viscosity |
| gamma | liquid-air surface tension, N/m (sources often write sigma) |
| rho_g, mu_g | air density (1.2 kg/m^3) and viscosity (1.8e-5 Pa s) [RECALLED standard values] |
| Re = V d / nu | jet Reynolds number |
| We = rho V^2 d / gamma | jet (liquid) Weber number |
| We_g = rho_g V^2 d / gamma | gas Weber number |
| Oh = mu / sqrt(rho gamma d) = sqrt(We)/Re | Ohnesorge number |
| La = rho gamma D / mu^2 = Oh^-2 | Laplace number of a droplet of diameter D |
| Tu | turbulence intensity at nozzle exit, Tu = sqrt(2k/3)/V |
| l or s | free-flight distance nozzle to wall, m |
| phi | impingement angle between jet axis and wall plane (90 deg = normal incidence) |
| psi | azimuth on the wall about the impingement source point, measured from the forward direction (direction of the jet's wall-parallel velocity component) |
| r | radial distance on the wall from the stagnation or source point, m |
| h | local film thickness, m |
| U_av, U_s | depth-averaged and free-surface film speed, m/s |
| tau_w | wall shear stress, Pa |
| p_s = rho V^2 / 2 | stagnation (dynamic) pressure, Pa |
| R_j | radius of the film jump (edge of the fast "radial flow zone", RFZ), m |
| v_s | sweep speed of the impingement point over the wall, m/s |
| xi or S | splattered mass fraction (fraction of jet flow that leaves the wall film as droplets) |
| D | droplet diameter, m |
| Omega | spray-arm angular speed, rad/s |

### 0.2 Reference liquid properties (water)

| T (deg C) | rho (kg/m^3) | mu (Pa s) | nu (m^2/s) | gamma (N/m) |
|---|---|---|---|---|
| 20 | 998.2 | 1.002e-3 | 1.004e-6 | 0.0728 |
| 50 | 988.0 | 0.547e-3 | 0.554e-6 | 0.0679 |
| 65 | 980.6 | 0.433e-3 | 0.442e-6 | 0.0653 |

[RECALLED] standard property tables; replace with the "chemistry" dossier's wash-liquor properties when available. Surface tension to use is discussed in section 4.5 (use the pure-water value for jets, splatter and the fast radial film; the surfactant-lowered equilibrium value applies only to slow, aged films).

### 0.3 Reference jets

"J2-8" = d = 2 mm, V = 8 m/s, the default dishwasher jet used for worked numbers. Derived quantities from the equations in sections 2 to 4 (all [ESTIMATED], computed from VERIFIED equations unless noted):

| d (mm) | V (m/s) | T (C) | Re | We | Q (L/min) | p_s (kPa) | peak tau_w (Pa) | r_b (mm) | r_t (mm) | R_j (mm) | t_E (ms) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2 | 6 | 20 | 12,000 | 990 | 1.13 | 18.0 | 207 | 11.0 | 13.6 | 28 | 12 |
| 2 | 8 | 20 | 15,900 | 1,760 | 1.51 | 31.9 | 319 | 12.1 | 14.9 | 35 | 16 |
| 3 | 8 | 20 | 23,900 | 2,630 | 3.39 | 31.9 | 260 | 20.7 | 25.6 | 64 | 37 |
| 1.5 | 10 | 50 | 27,100 | 2,180 | 1.06 | 49.4 | 378 | 10.8 | 13.4 | 32 | 12 |
| 2 | 6 | 50 | 21,700 | 1,050 | 1.13 | 17.8 | 152 | 13.4 | 16.5 | 33 | 13 |
| 2 | 8 | 50 | 28,900 | 1,860 | 1.51 | 31.6 | 234 | 14.7 | 18.2 | 41 | 17 |
| 2 | 10 | 50 | 36,100 | 2,910 | 1.88 | 49.4 | 327 | 15.9 | 19.6 | 49 | 22 |
| 3 | 6 | 50 | 32,500 | 1,570 | 2.54 | 17.8 | 124 | 23.0 | 28.4 | 61 | 29 |
| 3 | 8 | 50 | 43,300 | 2,790 | 3.39 | 31.6 | 191 | 25.3 | 31.2 | 76 | 39 |
| 4 | 6 | 50 | 43,300 | 2,100 | 4.52 | 17.8 | 108 | 33.7 | 41.6 | 94 | 52 |

Columns: peak tau_w from eq. (3.7); r_b, r_t from eqs. (3.9), (3.12); R_j from eq. (3.17); t_E from eq. (3.20). Jet momentum flux (the force a jet exerts when fully deflected) is F = rho Q V: 0.20 N for J2-8, 0.45 N for d = 3 mm at 8 m/s [ESTIMATED].

---

## 1. Headline findings for the architects

1. Dishwasher jets (d = 1.5 to 4 mm, V = 4 to 12 m/s, Re about 1e4 to 6e4 at wash temperature, We about 5e2 to 6e3) sit in the "turbulent Rayleigh / turbulent surface breakup" part of the regime map, not in atomisation (We_g = 0.5 to 10, far below the roughly 40 needed). Whether they arrive coherent at 50 to 500 mm depends almost entirely on nozzle quality: reported breakup lengths range from about 100 d (fully turbulent pipe jets) to about 500 d (sharp-edged orifices). See section 3.3.
2. In a real dishwasher, PEPT and high-speed imaging show jets leaving the lower arm as coherent, straight streams with a mean ejection speed of 7.7 m/s (std 3.2) at medium pump speed; arm rotation of 30 to 35 rpm; most common nozzle diameter 2 mm (Perez-Mohedano thesis, section 9) [VERIFIED].
3. For a coherent jet, everything the soil model needs under the footprint is available in closed form with no fitted constants: stagnation pressure, wall shear in the stagnation zone, film thickness/velocity/shear in the radial film (Bhagat and Wilson 2016), and the edge of the fast film (film jump, R = 0.29 Q^(3/4) (rho/(nu gamma))^(1/4), orientation independent; Bhagat et al. 2018). Peak wall shear under J2-8 is about 230 to 320 Pa at r about 0.55 d, falling to about 50 Pa at r = 10 d and under 5 Pa at the film jump (r about 20 d). Stagnation pressure is about 32 kPa, two orders of magnitude above the shear.
4. The published moving-jet cleaning work covers nozzle speeds up to 0.25 m/s only, in the limit V >> v_s. Dishwasher footprints sweep at 0.3 to 5 m/s (faster at grazing incidence), and the time to establish the radial flow zone (17 ms front arrival, 0.1 to 0.5 s for the steady jump and rope) is longer than the dwell time. The steady "film jump and rope" picture therefore never forms; the film is always in its transient spreading-front stage. Section 4.9 gives a first-principles treatment; it is a calibration priority.
5. Plates in a rack are struck at grazing incidence (phi about 5 to 30 deg). At phi = 15 deg, 99.6 percent of the jet flow goes into the forward half-plane and the normal stagnation pressure drops to sin^2(phi) = 7 percent of p_s, but the forward film keeps close to the full jet speed and so keeps the high shear. The cleaned region is a narrow stripe along the jet track, as observed in the thesis' full-scale tiles.
6. Splatter (fraction of jet liquid thrown off the wall as droplets within about 5 d of the impact point) is the least certain first-order quantity: Bhunia and Lienhard's pipe-jet correlation gives 0 to 30 percent at 100 to 200 mm for J2-8, whereas Wang et al. and Chee et al. measured up to 37 to 40 percent for short convergent nozzles on vertical walls at Re above 12,000 to 20,000. Splattered droplets (about 0.05 to 0.1 d, leaving at about 20 deg from the wall at near jet speed) are the main "indirect wetting" source.
7. Droplet impact outcomes for dishwasher droplets: primary fragments and drips (1 to 4 mm at 1.5 to 8 m/s) are above every splash threshold; splatter and splash secondaries (0.1 to 0.3 mm, a few m/s) are below them and deposit. A single generation of secondary droplets is therefore enough.
8. Very little quantitative literature exists for jets hitting rack wires, rims and fork tines, or for the flow inside inverted vessels at dishwasher conditions. Models for these are given as reasoned estimates with wide calibration ranges, and are the best candidates for offline resolved simulation (architecture candidate (c)).

---

## 2. Nozzle flow and jet launch (task item 1)

### 2.1 Dimensionless groups for the design space

For d = 1.5 to 4 mm and V = 4 to 12 m/s at 20 C: Re = 6.0e3 to 4.8e4, We = 330 to 7,900, We_g = 0.4 to 9.5, Oh = 1.9e-3 to 3.0e-3. At 50 C: Re = 1.1e4 to 8.7e4, We = 350 to 8,400 [ESTIMATED from section 0.2 properties]. Raising temperature from 20 to 50 C almost doubles Re at fixed d and V and leaves We nearly unchanged.

### 2.2 Discharge, contraction and velocity coefficients

Definitions: Q = C_d A_n sqrt(2 dp / rho), with C_d = C_c C_v; jet area A_j = C_c A_n so d = d_n sqrt(C_c); jet speed V = C_v sqrt(2 dp / rho). Here dp is the total head upstream of the orifice minus ambient.

| Nozzle type | C_c | C_v | C_d | Jet state | Tag and source |
|---|---|---|---|---|---|
| Sharp-edged orifice in a thin wall (t/d_n below about 0.3) | 0.61 | 0.97 to 0.99 | 0.60 to 0.62 | uniform velocity profile, glassy surface | C_c = 0.611 "typical value for a sharp orifice" [VERIFIED] Wikipedia, Vena contracta; C_v and C_d [RECALLED] hydraulics texts |
| Thin wall with rounded or chamfered inlet (moulded "volcano" boss, inlet radius above about 0.15 d_n) | 0.9 to 1.0 | 0.95 to 0.98 | 0.85 to 0.97 | near-uniform profile | [RECALLED] |
| Short tube, L/d_n = 2 to 4, flow reattached | 1.0 | 0.80 to 0.82 | 0.80 to 0.82 | turbulent, rough surface | [RECALLED]; Lichtarowicz et al. (1965) asymptote C_du = 0.827 - 0.0085 L/d_n for 2 <= L/d_n <= 10 [RECALLED] |
| Intermediate wall thickness, L/d_n = 0.5 to 1.5 | 0.61 to 1.0 | - | 0.61 to 0.8, bistable ("hydraulic flip") | unsteady | [RECALLED] |
| Long pipe, fully developed turbulent | about 1 | - | - | rough surface, Tu about 5 percent | "The contraction coefficient for turbulent jets leaving pipe nozzles is nearly unity" [VERIFIED] Bhunia and Lienhard 1994a, footnote 1 |

Supporting statements: Lienhard and Day (1970) computed the jet diameter of their sharp-edged-orifice water jets as "the orifice diameter [multiplied] by the square root of the coefficient of contraction" [VERIFIED]. Lienhard (2006) states that jets of uniform profile "are typical of those created by a sharp-edged orifice several diameters downstream of the outlet" [VERIFIED]. Contraction completes within roughly 0.5 to 1 d_n of the exit [RECALLED].

Default for a moulded thin-walled arm with unknown hole detailing: C_d = 0.70 (range 0.60 to 0.90), C_v = 0.97, C_c = C_d / C_v [ESTIMATED; calibration parameter]. The "machine" dossier should supply measured arm pressure and per-nozzle flow; jet speed then follows from V = C_v sqrt(2 dp / rho). For orientation: V = 8 m/s needs dp = rho V^2 / (2 C_v^2) = 34 kPa (0.34 bar) at the nozzle [ESTIMATED].

Arm-internal flow: PEPT gave mean liquid speeds inside the lower arm of 1.67, 1.17 to 1.18 and 0.71 to 0.79 m/s at high, medium and low pump speed (Perez-Mohedano thesis, Table 4.2) [VERIFIED]; the arm duct was treated as a 10 mm by 35 mm rectangle (hydraulic diameter 15.6 mm) [VERIFIED, thesis section 3.4.2]. Hence duct Re about 1.1e4 to 2.6e4 at 20 C [ESTIMATED]: the feed to every nozzle is turbulent with a strong cross-flow, which rules out the idealised glassy sharp-edged-orifice jet as a safe default.

### 2.3 Jet exit direction with internal cross-flow

No dishwasher-specific data were found. First-principles estimate [ESTIMATED]: a thin-walled hole in a duct carrying cross-flow U_c passes liquid that keeps most of its duct-wise momentum, so the jet leaves inclined downstream of the hole axis by

    alpha_x = asin( eta_x * U_c / V ),   eta_x = 1 for t/d_n << 1, falling to about 0 for a guiding bore with L/d_n >= 1.5        (2.1)

With U_c / V = 1.2 / 7.7 = 0.16 this is up to 9 deg for a thin wall. Because production nozzles are aimed by their moulded geometry, the recommended implementation is to treat the jet direction as a design input per nozzle (two angles, exactly as in Perez-Mohedano's parameterisation theta_jet, rho_jet, which were measured externally on the Whirlpool DU750 arm, section 9) and to keep alpha_x only as a calibration correction (default 0).

### 2.4 Velocity profile, turbulence and the stagnation velocity gradient

- Uniform-profile (sharp-edged orifice) jets: dimensionless stagnation velocity gradient B = 2 (d/V) (du_e/dr) = 1.831 at infinite Weber number (1.881 at We = 50) (Liu, Gabour and Lienhard, as tabulated in Lienhard 2006, Table 1 and eq. 7) [VERIFIED].
- Turbulent contoured converging nozzle at l/d = 1: B about 2.3; fully developed pipe nozzle at l/d = 1: B = 3.6 (Stevens et al., quoted in Lienhard 2006 section 4.1) [VERIFIED].
- "All jets will approach a uniform velocity profile at the bulk velocity when l/d increases ... bulk velocity was typically reached within about five diameters downstream of the nozzle"; for long jets B tends to 1.83 (Lienhard 2006) [VERIFIED]. Dishwasher flight distances are 15 to 250 d, so use B = 1.83 unless a nozzle sits within 5 d of the target.
- Turbulence intensity of fully developed pipe flow is 4 to 5 percent in the core (Lienhard 2006) [VERIFIED]; total intensity q'/u_f about 0.08 at Re = 5e4, varying roughly as Re^(-1/8) (Lienhard, Liu and Gabour 1992) [VERIFIED]; Trettel's regression for fully developed pipes is Tu = 0.366 f^0.459 with f the Darcy friction factor [VERIFIED] (Trettel 2020, section 4.1). "If a nozzle has flow separation within it, the turbulence level could be significantly higher than for a pipe nozzle" (Lienhard 2006) [VERIFIED].
- Default: Tu = 0.05 (range 0.03 to 0.12) [ESTIMATED; calibration parameter].

### 2.5 Slot and fan nozzles

No dishwasher-specific correlations were found; the following is an estimate framework [ESTIMATED unless tagged].

- A slot of length L_s and width w_s (L_s >> w_s) issues a flat sheet. With a fan (included) angle theta_f in radians, sheet width grows as W(s) = L_s + 2 s tan(theta_f / 2) and thickness thins as h_sh(s) = Q / (V W(s)). Example: Q = 1.5 L/min, V = 8 m/s, theta_f = 40 deg gives h_sh about 45 micrometres at s = 100 mm.
- The free edges retract at the Taylor-Culick speed u_c = sqrt(2 gamma / (rho h_sh)) [RECALLED]; 1.75 m/s for the example, so the sheet narrows at half-angle atan(u_c / V) about 12 deg per edge and collects liquid into two thick rims.
- Sheet break-up: taken as occurring where h_sh falls to a critical value; default break-up distance 50 to 150 mm, drop size D about 2 to 4 times the sheet thickness at break-up, with the rims shedding drops of the order of the slot width. All three numbers are calibration parameters.
- Impingement of an intact sheet: use the plane-jet analogue of section 3. Stagnation gradient of an inviscid plane jet of thickness b: du_e/dx = (pi/4) V / b [RECALLED]; wall shear tau_w = 1.2326 mu a x sqrt(a/nu) with a = du_e/dx (Hiemenz) [RECALLED]; pressure footprint width about 2 b; total normal force rho Q V sin(phi).
- Implementation shortcut: represent a fan nozzle by N_sub = 5 to 9 round sub-jets spread uniformly over theta_f, each with flow Q / N_sub and the same V, until measurements justify a sheet model.

### 2.6 Jets from a rotating arm: lab-frame velocity, trajectory, footprint sweep speed

All of this section is kinematics [ESTIMATED], using arm data from the thesis.

Let the arm rotate about the vertical z axis at Omega (rad/s). Nozzle i sits at arm-frame position p_i = (R_i cos a_i, R_i sin a_i, z_i) and aims along the arm-frame unit vector

    n_i = (cos(rho_jet) cos(theta_jet), cos(rho_jet) sin(theta_jet), sin(rho_jet))        (2.2)

with theta_jet the plan-view azimuth and rho_jet the elevation above the horizontal plane, the convention of Perez-Mohedano's Table 5.1 [VERIFIED convention]. At time t the arm angle is Theta = Omega t and Rz(Theta) is the rotation about z.

    Nozzle position (lab):        P(t)  = Rz(Theta) p_i
    Parcel exit velocity (lab):   u0(t) = V_rel Rz(Theta) n_i + Omega z_hat x P(t)                 (2.3)
    Parcel path (emitted at t0):  x(t)  = P(t0) + u0(t0) (t - t0) + (1/2) g (t - t0)^2              (2.4)

V_rel is the jet speed relative to the arm (from section 2.2). The tangential addition |Omega x P| = Omega R_i is 0.28 to 0.87 m/s for R_i = 89 to 238 mm at 30 to 35 rpm, i.e. it tilts the lab-frame velocity by atan(Omega R_i / V) = 2 to 6 deg at V = 8 m/s.

Consequences:

- Each parcel flies an essentially straight line (a parabola with small curvature, section 3.1 of flight below). This matches PEPT: "once water was ejected, the tracer moved in a straight line, with no effect on its trajectory from the rotation of the spray arm", with most line-fit errors below 2 mm and concentrated around 1 mm [VERIFIED] (thesis section 4.3).
- The instantaneous jet (locus of parcels emitted at earlier times) is not straight; it is a slightly swept-back curve. For a vertical jet (rho_jet = 90 deg) a parcel that has flown for tau = H / V is at radius R_i sqrt(1 + (Omega tau)^2) and lags the nozzle azimuth by Omega tau - atan(Omega tau) about (Omega tau)^3 / 3. For Omega = 3.67 rad/s and tau = 0.05 s this is 0.002 rad: negligible. For jets with a large horizontal component the lag at the wall is Omega tau times the horizontal throw and must be included (use eq. 2.4 directly).
- Footprint (impingement point) velocity on a wall element with unit normal n_w, for a jet treated as a ray of length s from a nozzle moving at v_n = Omega z_hat x P with direction n rotating at n_dot = Omega z_hat x n:

      v_s = ( I - n n_w^T / (n . n_w) ) ( v_n + s n_dot )                                            (2.5)

  The projection operator diverges as n . n_w tends to 0: at grazing incidence the footprint moves much faster than the nozzle ("lighthouse" effect). For a nozzle moving at speed v_n perpendicular to a plate that the jet meets at angle phi, |v_s| = v_n / tan(phi): with v_n = 0.6 m/s, phi = 20 deg gives 1.6 m/s and phi = 5 deg gives 6.9 m/s.
- Check against the thesis' geometric model for the DU750 lower arm at 35 rpm (Table 5.8: impact time and impact length per revolution on a 250 mm plate) [VERIFIED table values]; dividing length by time gives footprint speeds [ESTIMATED]: jets with rho_jet = 60 to 70 deg: 1.8, 1.8 and 3.9 m/s (jets 4, 7, 3); jets with rho_jet = 89 deg: 25, 52, about 1,100 and about 2,700 m/s (jets 5, 9, 6, 2). The last four are artefacts of a zero-width jet grazing a perfectly vertical plate, but they make the point that near-vertical jets between near-vertical plates produce an almost instantaneous grazing streak, not a moving normal-incidence spot.
- Dwell time of the stagnation footprint at a wall point on the track: t_dw = d_fp / |v_s| with d_fp between d and d / sin(phi) (footprint chord along the sweep direction). For J2-8 at v_s = 1 m/s and normal incidence, t_dw = 2 ms; the radial flow zone (radius about 40 mm) passes in about 80 ms.
- Because the forcing is periodic in arm angle, all per-surface statistics (peak stress, stress-time integral, delivered flux) can be accumulated over one revolution (or over the beat period of two arms) and multiplied by the number of revolutions; see section 11.

---

## 3. Jet in flight (task item 2)

### 3.1 Gravity and air drag on a coherent jet

- Gravity: ballistic. An upward jet slows as V(z) = sqrt(V0^2 - 2 g z): from 8.0 m/s to 7.62 m/s at z = 0.3 m and 7.36 m/s at 0.5 m; from 6.0 to 5.49 m/s at 0.3 m [ESTIMATED]. Continuity thickens the jet as d(z) = d0 sqrt(V0 / V(z)) (about 2.5 percent at 0.3 m for 8 m/s).
- Air drag on an intact liquid column is negligible: with a skin-friction coefficient of order 0.007 on the jet surface, deceleration = 4 tau_air / (rho d) = 4 (0.5 rho_g V^2 C_f) / (rho d) about 0.5 m/s^2 for J2-8, about 5 percent of g [ESTIMATED]. Neglect it for coherent jets.
- PEPT observation: decelerations in the ejection stage were "higher than the expected by only gravity action", attributed to air resistance [VERIFIED] (thesis section 4.5.2). Tracer Stokes numbers in the ejection stage were 13 to 39, so the tracer does not follow the liquid exactly [VERIFIED] (thesis Table 3.2). This excess deceleration is consistent with part of the liquid travelling as droplets (section 3.6), not with drag on a coherent column.

### 3.2 Break-up regimes

Classical regime sequence with increasing speed: dripping, Rayleigh, first wind-induced, second wind-induced, atomisation. Trettel (2020) re-evaluated the regime diagram from a large break-up-length database and renames the turbulent-nozzle regimes "turbulent Rayleigh", "turbulent surface breakup" and "atomisation" [VERIFIED]. Boundaries:

| Boundary | Criterion | Value for dishwasher jets | Tag and source |
|---|---|---|---|
| Onset of gas-phase influence (old "first wind-induced") | We_g,crit = 1.2 + 3.41 Oh^0.9 | We_g = 0.4 to 10, so marginal to exceeded | [VERIFIED] Reitz regression quoted in Trettel 2020 eq. 13 |
| Turbulent Rayleigh to turbulent surface breakup | We_crit = 8 Tu^-2 (high-Re limit) | 3,200 at Tu = 5 percent; 800 at 10 percent; 8,900 at 3 percent | [VERIFIED] Trettel 2020 eq. 18 ("fits the limited available data") |
| Turbulent surface breakup to atomisation | We_g,crit = 3.17 Tu^-0.876 | 44 at Tu = 5 percent (versus the traditional 40.3); never reached in a dishwasher | [VERIFIED] Trettel 2020 eqs. 25, 26 |

So dishwasher jets (We = 500 to 6,000) straddle the turbulent-Rayleigh / turbulent-surface-breakup boundary. In both regimes the liquid core survives for of order 100 diameters and the break-up is driven by liquid turbulence and capillarity, not by aerodynamic shear. Chee et al. (2019) classify their 2 to 4 mm water jets (Re 5,300 to 39,000, We 95 to 9,300) as first wind-assisted (Lin and Reitz map) while warning that correlations for long cylindrical nozzles have limited applicability to short convergent nozzles [VERIFIED].

### 3.3 Break-up length correlations

All have the form L_b / d = function(We, Re, nozzle).

| Correlation | Equation | Applies to | Tag and source |
|---|---|---|---|
| Weber (1931) capillary | L_b / d = C_b ( sqrt(We) + 3 We / Re ) | any regime where varicose capillary break-up of the core dominates; C_b = ln(d / (2 delta_0)) encodes the initial disturbance | [VERIFIED] form in Trettel 2020 eq. 12, Lienhard and Day 1970 eq. 1, Bhunia and Lienhard 1994a eq. 7 |
| C_b, laminar jets | 12 (Weber); 13.4 (Grant and Middleman); "about 12 +/- 1 for most cases of jet efflux" | laminar Rayleigh | [VERIFIED] Trettel 2020 section 4.4; Lienhard and Day 1970 |
| C_b, cold water from sharp-edged orifices (1/64 to 1/8 inch) | 11.5 +/- 0.5 for Re below 35,000; transition near Re = 48,000; aerodynamic decrease above | sharp-edged orifice, quiet plenum | [VERIFIED] Lienhard and Day 1970, text below eq. 32 |
| C_b, turbulent pipe jets | 3.27 (Phinney), about 4.0 (van de Sande and Smith), about 4.8 (Mansour and Chigier) | turbulent Rayleigh | [VERIFIED] values as quoted in Trettel 2020 section 4.8 |
| Trettel regression | L_b / d = 3.61 Tu^-0.275 We^0.334 | turbulent surface breakup; 194 points, R^2 = 0.959, 5.4 to 12.7 percent Tu (rough pipes, Kusui data) | [VERIFIED] Trettel 2020 eq. 19 |
| Grant and Middleman (1966), turbulent | L_b / d = 8.51 We^0.32 | turbulent pipe jets | [RECALLED]; could not be opened. Numerically equal to the Trettel regression at Tu = 5 percent (8.2 We^0.334), which supports the recollection |
| Miesse (1955) | L_b / d = 540 sqrt(We) Re^(-5/8) | converging-orifice industrial nozzles with strong aerodynamic effects | [VERIFIED] as quoted in Bhunia and Lienhard 1994a eq. 10 and Lienhard and Day eq. 2 |
| Sallam, Dai and Faeth (2002) | L_c / d = 2.1 We^0.5 (turbulent break-up); 11.0 (rho/rho_g)^0.5 (aerodynamic) | long-pipe turbulent jets | [RECALLED]; the University of Michigan repository blocked download and no other copy was searched for. Do not use without checking |
| Atomisation plateau | L_b / d = 5.31 Tu^-0.568 (rho/rho_g)^0.335 | not reached in dishwashers | [VERIFIED] Trettel 2020 eq. 24 |

Worked break-up lengths in mm at 20 C [ESTIMATED from the equations above]:

| Jet | We | Weber, C_b = 3.3 | C_b = 4 | C_b = 6 | C_b = 11.5 | Trettel, Tu = 5 percent | Trettel, Tu = 10 percent |
|---|---|---|---|---|---|---|---|
| d = 1.5 mm, 10 m/s | 2,060 | 227 | 275 | 412 | 790 | 158 | 130 |
| d = 2 mm, 6 m/s | 990 | 209 | 253 | 380 | 728 | 165 | 136 |
| d = 2 mm, 8 m/s | 1,760 | 279 | 338 | 507 | 973 | 199 | 165 |
| d = 2 mm, 10 m/s | 2,740 | 348 | 422 | 633 | 1,214 | 232 | 192 |
| d = 3 mm, 8 m/s | 2,630 | 511 | 620 | 929 | 1,780 | 343 | 283 |
| d = 4 mm, 6 m/s | 1,970 | 589 | 715 | 1,072 | 2,054 | 415 | 343 |

Reading: a dishwasher tub offers 30 to 150 mm of flight to lower-rack items and roughly 250 to 500 mm to upper-rack items and the tub roof [ESTIMATED from the 620 mm tub height and 30 mm arm height in the thesis; exact values belong to the "machine" dossier]. With a pessimistic (fully turbulent) nozzle the 2 mm jets start to break up between 150 and 350 mm; with a quiet sharp-edged orifice they never break up inside the tub. Independent evidence for short convergent industrial nozzles of 2 to 4 mm: jets with L <= 70 mm were coherent, "surface fluctuations were evident on all longer jets, and breakup was observed at lower Reynolds numbers with L >= 350 mm" (Chee et al. 2019) [VERIFIED]. Bhagat and Wilson (2016) describe their 2.667 mm jet at 200 mm stand-off as coherent but varicose (measured diameter varying between 2.66 and 2.86 mm) [VERIFIED].

Recommended default: Weber form with C_b = 6 (range 3.3 to 12) [ESTIMATED; first-rank calibration parameter], with L_b treated as a random variable (see 3.6).

### 3.4 Growth of surface disturbances and onset of droplet shedding

- Measured rms surface roughness of turbulent pipe jets grows quickly near the nozzle and then saturates; the maximum delta_rms / d is of order 0.1 (rms scatter 0.009 was "about 9 percent of the maximum rms disturbance") and "at higher Weber number the turbulent disturbances grow to be as large as the jet radius, effectively breaking up the jet" (Bhunia and Lienhard 1994a, b) [VERIFIED]. Growth is non-exponential, the spectrum is broadband with a k^(-19/3) high-wavenumber decay, and surfactant does not change the roughness evolution [VERIFIED] (Lienhard 2006 sections 6.3 to 6.6).
- Onset location of turbulent surface break-up (first droplets shed from the jet surface): x_i / d = 13.0 (Tu^3 We)^(-0.915), 52 points, R^2 = 0.758 [VERIFIED] (Trettel 2020 eq. 21). For J2-8 at 20 C: 104 mm at Tu = 5 percent, 16 mm at Tu = 10 percent [ESTIMATED]. The strong Tu^-2.7 dependence is another reason nozzle quality dominates.
- Spray (halo) half-angle in this regime: tan(theta_i / 2) = 5.32e-5 We^0.605 (5 points, Faeth-group data) [VERIFIED] (Trettel 2020 eq. 20), i.e. about 0.3 deg at We = 1,800 and 0.5 deg at We = 5,000 [ESTIMATED]; the droplet halo stays within a few mm of the axis over 300 mm. Treat as extrapolated (the fitted data are at higher We).

### 3.5 Droplet sizes after break-up

| Mechanism | Size | Tag and source |
|---|---|---|
| Capillary (Rayleigh) break-up of the core | Fastest-growing wavelength lambda = 9.02 r0 = 4.51 d [VERIFIED] (Wikipedia Plateau-Rayleigh; Lienhard, Liu and Gabour 1992). Volume conservation gives D = (1.5 lambda d^2)^(1/3) = 1.89 d [ESTIMATED]. Turbulent Rayleigh break-up is "less regular, but large droplets are still being produced" [VERIFIED] (Trettel 2020 section 4.8) | default main-drop size D = 1.9 d with a log-normal spread (geometric std 1.3 [ESTIMATED]) plus satellites of about 0.3 to 0.5 d carrying under 10 percent of the mass [RECALLED] |
| Turbulent surface break-up (droplets shed from the jet surface before the core breaks) | D_32 / d = 0.649 (Tu^2 We)^(-0.657), at the onset location; 23 points, R^2 = 0.752 [VERIFIED] (Trettel 2020 eq. 22). J2-8: 0.49 mm at Tu = 5 percent, 0.20 mm at 10 percent [ESTIMATED] | size distribution: Simmons root-normal with MMD / SMD = 1.2 is the Faeth-group standard for break-up products [VERIFIED for secondary break-up] (Faeth, ILASS-Europe 2002) |
| Radial velocity of shed droplets | v_d / v' = 0.0582 (Tu^2 We)^0.0322 with v' the rms turbulent velocity; R^2 about 0, i.e. essentially v_d about 0.06 v' and uncorrelated [VERIFIED] (Trettel 2020 eq. 23) | shed droplets keep the jet's axial speed and drift outwards at only a few mm/s |

Secondary (aerodynamic) break-up of these drops does not occur: a 4 mm drop at 8 m/s has We_g = rho_g V^2 D / gamma = 4.6, below the bag-break-up threshold of about 12 [RECALLED].

### 3.6 Coherent column or droplet train at 50 to 500 mm

Recommended model [ESTIMATED]:

    L_b = C_b d ( sqrt(We) + 3 We / Re ),  C_b default 6                                              (3.1)
    f_c(s) = 1                                   for s <= 0.6 L_b
           = 1 - (s - 0.6 L_b) / (0.8 L_b)       for 0.6 L_b < s < 1.4 L_b                            (3.2)
           = 0                                   for s >= 1.4 L_b

f_c is the probability that a parcel arriving at flight distance s is still part of a continuous column; 1 - f_c arrives as a train of drops of diameter 1.9 d spaced 4.5 d apart, with the same velocity (minus drag accumulated since break-up). The +/- 40 percent window reflects the observed run-to-run variability of break-up length (Lienhard and Day treat L_b as a random variable [VERIFIED]); the window width is a calibration parameter. Independently of f_c, the surface-shed fraction f_sh(s) grows from 0 at x_i (section 3.4) and is small; default f_sh = 0.05 (s - x_i) / L_b clipped to [0, 0.1] [ESTIMATED].

Practical reading with the defaults: lower-rack items (s = 30 to 150 mm) always see coherent jets; upper-rack items fed from the lower arm (s = 250 to 450 mm) see coherent jets for d >= 2 mm if C_b >= 6 and partly broken jets if C_b is 3 to 4.

### 3.7 Droplet flight

Use a sphere-drag law [RECALLED, Schiller-Naumann]:

    Re_p = rho_g |u_rel| D / mu_g
    C_D  = (24 / Re_p) (1 + 0.15 Re_p^0.687)   for Re_p < 1000;   C_D = 0.44 otherwise                (3.3)
    du/dt = g - (3/4) C_D (rho_g / rho) |u_rel| u_rel / D                                            (3.4)

Drag decelerations at 50 C properties [ESTIMATED]: D = 2 mm at 8 m/s: 13 m/s^2; 1 mm at 8 m/s: 32 m/s^2; 0.3 mm at 4 m/s: 59 m/s^2; 0.1 mm at 4 m/s: 320 m/s^2. Jet-size fragments are nearly ballistic over tub distances; splatter-size droplets (0.1 to 0.3 mm) stop within roughly 5 to 15 cm and then settle. Air inside the tub is not still (the arms and jets drive a recirculation) but no measurements were found; default still air.

---

## 4. Impingement of a coherent jet (task item 3)

### 4.1 Structure of the flow

For a round jet striking a wall, in order of increasing r (Bhagat and Wilson 2016; Lienhard 2006; Chee et al. 2019) [VERIFIED structure]:

1. Stagnation zone, r below about 0.5 to 0.7 d: pressure near p_s, wall shear rising linearly from zero.
2. Boundary-layer formation zone (BLFZ), up to r_b: thin film, free surface still at jet speed, boundary layer growing from the wall.
3. Laminar film zone (LZ), r_b to r_t: viscosity acts through the whole film, surface speed falls.
4. Turbulent film zone (TZ), r_t outward.
5. Film jump at R_j: the film thickens abruptly where the outward momentum flux per unit width falls to about the surface tension; beyond it a thick slow "rope" collects the liquid and gravity-driven drainage takes over (handed to the "films" dossier).

Zones 1 to 4 are the "radial flow zone" (RFZ). "The RFZ is important for cleaning applications as the wall shear stress and momentum in the film are greatest in this region" (Bhagat and Wilson 2016) [VERIFIED].

### 4.2 Stagnation zone: velocity gradient and pressure

Inviscid wall velocity just outside the boundary layer for a uniform-profile jet (Liu, Gabour and Lienhard, reproduced in Lienhard 2006 eqs. 5 to 8 and Table 1) [VERIFIED]:

    u_e(r) / V = (B/2) (r/d) = 0.916 (r/d)            (accurate near r = 0)                           (3.5)
    p_w(r) = p_s - (rho/2) u_e(r)^2,   p_s = rho V^2 / 2

"The pressure distribution can be estimated using this result ... to within about 10 percent for r/d < 0.5. Heat transfer data suggest that the stagnation zone can reasonably be approximated to extend as far as r/d about 0.7" [VERIFIED]. The series coefficients A_2 = -1.831, A_4 = 2.365, A_6 = 0.5906, A_8 = -14.81 (We = infinity) [VERIFIED] give u_e/V = 0.916 x + 0.443 x^3 - 0.035 x^5 - 0.253 x^7 + ... with x = r/d [ESTIMATED expansion of the VERIFIED series], which is 0.510 at x = 0.5 and 0.766 at x = 0.7 but diverges near x = 1.

Recommended closed form [ESTIMATED: fitted to the series for x <= 0.7 and constrained so that the integrated wall pressure equals the jet momentum flux rho Q V]:

    u_e(r) / V = tanh( 0.916 x + 0.95 x^3 ),   x = r/d
    p_w(r)     = p_s sech^2( 0.916 x + 0.95 x^3 )                                                     (3.6)

Values: p_w / p_s = 0.94, 0.73, 0.44, 0.09, 0.01 at x = 0.25, 0.5, 0.7, 1.0, 1.25. A Gaussian of the same integral, p_w = p_s exp(-(r / 0.707 d)^2), is an acceptable cheaper alternative [ESTIMATED]. Surface-tension correction to p_s is 4 gamma / d about 140 Pa, negligible [ESTIMATED].

### 4.3 Wall shear in the stagnation zone

"The wall shear stress close to the stagnation point is insensitive to the level of turbulence in the free stream" and the impingement boundary layer behaves as laminar (Phares, Smedley and Flagan 2000, section 2.3, citing Kataoka) [VERIFIED]. Using the axisymmetric (Homann) stagnation-point boundary layer, tau_w = 1.312 mu u_e sqrt(a / nu) with a = du_e/dr [RECALLED classical result], and eq. (3.5):

    tau_w(r) = 1.312 (B/2)^(3/2) rho V^2 Re^(-1/2) (r/d) = 1.150 rho V^2 Re^(-1/2) (r/d)   for r <= 0.55 d   (3.7a)

Matching this to the BLFZ result (3.10) below gives a peak at the crossover [ESTIMATED]:

    tau_w,max = 0.63 rho V^2 Re^(-1/2)   at r = 0.55 d                                                (3.7)

For J2-8: 319 Pa at 20 C, 234 Pa at 50 C. Scaling: tau_w,max proportional to rho V^(3/2) nu^(1/2) d^(-1/2); hotter water lowers the peak shear, smaller nozzles raise it.

Corrections and their sizes:

- Non-uniform velocity profile at short stand-off raises B and hence tau_w by (B / 1.831)^(3/2): 1.4 for B = 2.3, 2.8 for B = 3.6 [ESTIMATED from VERIFIED B values]. Only relevant within about 5 d of the nozzle.
- Wall roughness: for turbulent jets, roughness of only 4.7 to 28 micrometres rms raised stagnation heat transfer by up to 50 percent; the threshold for a 10 percent effect is k / d = 5.95 Re^(-0.713) (Gabour and Lienhard, in Lienhard 2006 eq. 21) [VERIFIED], i.e. k about 10 micrometres for d = 2 mm at Re = 20,000 [ESTIMATED]. Food-soil layers are rougher than this, so the smooth-wall laminar value is a lower bound on the stress at asperities. Default roughness factor 1.0 (range 1.0 to 1.5) [ESTIMATED; calibration].

Do not use the Phares et al. peak-shear formula tau_m = 44.6 rho u_o^2 Re_o^(-1/2) (H/D)^(-2) at r = 0.09 H [VERIFIED, their eq. 2.33] or the Beltaos and Rajaratnam form tau_m = 0.16 rho u_o^2 / (H/D)^2 [VERIFIED as quoted and criticised in Phares et al. eq. 3.2] for dishwasher jets: both are for submerged jets (gas in gas, liquid in liquid) with H/D > 8, where entrainment spreads the jet and the footprint scales with stand-off H. A liquid jet in air does not entrain or spread, so its footprint scales with d. Lienhard (2006) makes the same point: unsubmerged jets "are only similar to submerged jets in the stagnation region, and then only when the submerged jet is less than about five diameters in length" [VERIFIED]. The Phares scaling would apply to a nozzle submerged in a pooled vessel or the sump.

### 4.4 Radial film: thickness, velocity and wall shear (Bhagat and Wilson 2016)

Model: momentum-integral solution with a quartic velocity profile f(eta) = eta - 1.5 eta^2 + 4 eta^3 - 2.5 eta^4 in the boundary layer and laminar film, and a 1/7th-power profile with the Blasius wall law in the turbulent film. Validated with no adjustable parameters against (i) LDV film-thickness data of Stevens and Webb at Re = 36,100 to 53,100, (ii) the authors' film-front velocities for 2 and 2.667 mm nozzles, Q = 0.6 to 4.0 L/min, Re = 6,300 to 32,000, water at 18 to 23 C on vertical Perspex and glass, and (iii) film-jump locations for normal and oblique jets (30 to 120 deg). All equations below are [VERIFIED] from the accepted manuscript (equation numbers in brackets are theirs) and are for directions in which gravity has no component along the ray; the paper's general forms include a -g cos(theta) term that is small at these flow rates.

Boundary-layer formation zone, 0.55 d < r < r_b:

    delta   = 2.12 sqrt( nu r / V )                                               [23]               (3.8)
    h / d   = 0.125 (d/r) + 1.06 Re^(-1/2) (r/d)^(1/2)                            [24]
    U_s     = V  (free surface still at jet speed)
    U_av    = V d / ( 8 r (h/d) )                                                 [25, 26]
    r_b / d = 0.24 Re^(1/3)                                                       [27]               (3.9)
    tau_w   = mu V / delta = 0.472 rho V^2 Re^(-1/2) (r/d)^(-1/2)                 [73]               (3.10)

Laminar film zone, r_b < r < r_t:

    h / d   = 3.792 Re^(-1) (r/d)^2 + 0.1975 (d/r)                                [34]               (3.11)
    U_av    = V / ( 8 (r/d) (h/d) ),   U_s = 2 U_av                               [31]
    tau_w   = mu V / ( 4 r (h/d)^2 )                                              [75]
    r_t / d = 0.2964 Re^(1/3)                                                     [40]               (3.12)

Turbulent film zone, r > r_t:

    U_av    = V / [ 0.167 Re^(-1/4) (r/d)^(9/4) + ( 2.37 - 0.0108 Re^(1/2) ) ]    [48]               (3.13)
    h / d   = 0.0209 Re^(-1/4) (r/d)^(5/4) + ( 0.296 - 0.001356 Re^(1/2) ) (d/r)  [49]               (3.14)
    U_s     = (8/7) U_av
    tau_w   = 0.0478 rho Re^(-1/4) U_av^2 (r/d)^(1/4)                             [76]               (3.15)
    momentum flux per unit width  M = (64/63) rho (Q / (2 pi r)) U_av             [51]               (3.16)

Volume conservation ties them together: r h U_av = Q / (2 pi) = d^2 V / 8 [25].

Profile for J2-8 at 50 C (Re = 28,900; r_b = 7.4 d, r_t = 9.1 d) [ESTIMATED from the equations above]:

| r/d | r (mm) | zone | h (micrometres) | U_av (m/s) | tau_w (Pa) | rho U_av^2 h (N/m) |
|---|---|---|---|---|---|---|
| 0.25 | 0.5 | stagnation | - | - | 107 | - |
| 0.55 | 1.1 | peak | 464 | 7.8 | 237 | 28 |
| 1 | 2 | BLFZ | 263 | 7.6 | 176 | 15 |
| 2 | 4 | BLFZ | 143 | 7.0 | 124 | 6.9 |
| 3 | 6 | BLFZ | 105 | 6.4 | 101 | 4.2 |
| 5 | 10 | BLFZ | 78 | 5.1 | 79 | 2.0 |
| 7 | 14 | BLFZ | 69 | 4.2 | 66 | 1.2 |
| 8 | 16 | LZ | 66 | 3.8 | 63 | 0.93 |
| 10 | 20 | TZ | 70 | 2.9 | 52 | 0.56 |
| 12 | 24 | TZ | 83 | 2.0 | 27 | 0.33 |
| 15 | 30 | TZ | 103 | 1.3 | 12 | 0.17 |
| 20 | 40 | TZ (jump near here) | 142 | 0.70 | 3.8 | 0.070 |

Boundary-layer thickness at r = 2 mm is 25 micrometres [ESTIMATED from 3.8]. These are the length scales any resolved simulation would have to capture (section 10).

Model-form uncertainty to carry:

- Alternative laminar solution (Watson; Liu and Lienhard, as summarised in Lienhard 2006 eqs. 22 to 31) [VERIFIED]: delta = 2.679 (r d / Re)^(1/2); r_o = 0.1773 Re^(1/3) d; beyond r_o, h = 0.1713 d^2 / r + 5.147 r^2 / (Re d) and U_s = (1/5) V d^2 / (h r); turbulent film C_f = 0.073 ((r/d) / Re)^(1/4) and h/d = 0.02091 Re^(-1/4) (r/d)^(5/4) + C (d/r), with C fixed by continuity of h at r_t (the exponents inside C were garbled in text extraction; reconstruct from continuity). These differ from Bhagat and Wilson by under 30 percent in h and U.
- Transition radius is the main disagreement: Bhagat and Wilson's r_t = 0.2964 Re^(1/3) d (8 d at Re = 20,000, rising with Re) versus Azuma and Hoshino r_t/d = 730 Re^(-0.315) (32 d), Liu et al. visual 1200 Re^(-0.422) (18 d) and heat-transfer 28600 Re^(-0.68) (34 d) [VERIFIED equations, Bhagat and Wilson eqs. 65 to 67; numbers ESTIMATED]. With the older correlations the film would stay laminar all the way to the jump at dishwasher conditions. The effect on tau_w is within a factor of 2 beyond r = 10 d (for J2-8 at r = 12 d: 27 Pa turbulent versus 37 Pa laminar; at 20 d: 3.8 versus 7.0 Pa) [ESTIMATED]. Default: Bhagat and Wilson.
- Turbulent incoming jets disturb the film earlier: "the liquid surface speed begins to drop at r about 2.5 d, sooner than predicted by laminar flow theory" (Stevens and Webb, quoted in Lienhard 2006 section 6) [VERIFIED]. Surface waves were observed in the RFZ for all jets above 2.6 m/s (Re 5,200) (Aouad et al.) [VERIFIED].
- Yeckel and Middleman's all-turbulent model predicts noticeably larger shear than the above for r/d < 7 (Bhagat and Wilson Fig. 14 discussion) [VERIFIED statement]. Calibration factor on RFZ shear: default 1.0, range 0.7 to 2.
- Validated range is Re <= 32,000 (film velocity) and <= 53,100 (film thickness); 3 to 4 mm jets at wash temperature reach Re = 4e4 to 9e4 and are extrapolations.

### 4.5 Edge of the radial flow zone (film or hydraulic jump)

| Model | Equation | Notes | Tag and source |
|---|---|---|---|
| Wilson et al. (2012), laminar Nusselt film | R = 0.276 [ rho^2 Q^3 / ( mu gamma (1 - cos beta) ) ]^(1/4) | beta = contact angle; at high flow use beta = 90 deg | [VERIFIED] as reproduced in Chee et al. 2019 eq. 1 |
| Bhagat et al. (2018), all orientations | R = (0.289 +/- 0.015) Q^(3/4) rho^(1/4) / ( nu^(1/4) gamma^(1/4) ) | data for jets striking horizontal surfaces from above and below and vertical surfaces collapse on this; "gravity plays no significant role" | [VERIFIED] arXiv 1712.04255 eq. 4 and Fig. 2 |
| Bhagat et al. (2018), local criterion | jump where We^-1 + Fr^-2 = 1 (film Weber and Froude numbers) | includes gravity for thicker films | [VERIFIED] eq. 10; the exact definitions of We and Fr were not legible in the extracted text: We = rho u^2 h / gamma and Fr = u / sqrt(g h) [RECALLED] |
| Bhagat and Wilson (2016) | jump where M = gamma, with M from (3.16) | at high flow the contact angle drops out; correction factor (1 + H/R_j) for small jumps | [VERIFIED] eqs. 50, 51, 56 |
| Button et al. (2010), jet on the underside of a horizontal plate | laminar: R = 0.3025 ( rho Q^3 / (nu gamma) )^(1/4); turbulent: R / a = 1.0621 (Re_a We_a^4)^(1/13) with a the jet radius, Re_a = Q/(a nu), We_a = rho Q^2 / (a^3 gamma); turbulent film when Re_a > 2.57e4 | departure criterion gamma = integral of rho u^2 over the film; departure radius "constant to within 10 percent" over all departure angles and independent of the surface, although the local contact angle is not | [VERIFIED] JFM 649 Part 2 eqs. 2.22, 2.30, 2.40 |

Recommended:

    R_j = 0.289 Q^(3/4) ( rho / (nu gamma) )^(1/4)                                                    (3.17)

J2-8: 35 mm at 20 C, 41 mm at 50 C; Button's laminar and turbulent forms give 43 and 40 mm at 50 C [ESTIMATED], so the three independent models agree within 8 percent.

Related verified facts for hand-over to the films model: on a vertical wall the RFZ is slightly flattened by gravity, height above the impingement point Z about 4R/5; the outer edge of the rope at impingement level is R_c = 4R/3; below the impingement level the jump gives way to a draining film bounded by ropes (Chee et al. 2019; Wang et al. 2013 as quoted there) [VERIFIED]. On glass (hydrophilic) the model under-predicted R_j by 2 to 4 mm and the jump position fluctuated (Bhagat and Wilson) [VERIFIED].

Surface tension to use: the jump and the splatter involve surfaces only milliseconds old. Bhunia and Lienhard found that a saturated surfactant solution (static gamma = 0.027 N/m) splattered exactly like pure water at the same V, d and l, "the surface tension of the surfactant-jet is effectively the surface tension of the pure liquid" [VERIFIED]. PEPT showed no significant effect of detergent on water motion in the dishwasher [VERIFIED] (thesis section 4.4.1). Default: gamma = gamma_water(T) for sections 3 to 5; a dynamic-surface-tension factor (range 0.6 to 1.0) is a calibration parameter.

### 4.6 Time to establish the flow

- Front-arrival estimate from the film model: t_E = 0.0477 rho Q / gamma for beta = 90 deg (Chee et al. 2019 eq. B5, from the Wilson 2012 velocity field) [VERIFIED]; 17 ms for J2-8 [ESTIMATED]. Integrating dr / U_av from eqs. (3.8) to (3.13) gives 22 ms to reach R_j [ESTIMATED].                                                     (3.20)
- Observed: for d_n = 2 mm, Q = 2 L/min, L = 70 mm on an initially dry wall, rapid radial growth stops after about 0.1 s, the rope is established over the next 0.2 s, and the outer wetted width stabilises about 0.5 s after first impact; the authors quote t_E "between 0.1 and 0.2 s" for this case and note that the simple estimate gives 20 ms and "a reasonable estimate of the magnitude" only (Chee et al. 2019) [VERIFIED]. So the thin fast film reaches the jump radius in about 20 ms, but the steady jump, rope and drainage pattern needs 0.1 to 0.5 s.

### 4.7 Oblique impingement: footprint, flow split, film

Geometry (Kate, Das and Chakraborty 2007, as used by Wang et al. 2013 and Bhagat and Wilson 2016) [VERIFIED via Bhagat and Wilson 2016 eqs. 57, 58 and Bhagat, Perera and Wilson 2017]: the jet cross-section projects onto the wall as an ellipse with semi-minor axis r0 and semi-major axis r0 / sin(phi). The flow spreads radially from the rear focus S of the ellipse, which lies r0 cot(phi) behind the point O where the jet axis meets the wall. With psi measured about S from the forward direction:

    r_e(psi) = r0 sin(phi) / ( 1 - cos(psi) cos(phi) )            edge of the footprint                (3.21)
    q(psi)   = (1/2) V r_e(psi)^2 sin(phi)                         volume flow per radian of azimuth   (3.22)
             = (V r0^2 / 2) sin^3(phi) / ( 1 - cos(psi) cos(phi) )^2

(The sources write these with the azimuth measured from the opposite direction, i.e. 1 + cos(theta) cos(phi).) Checks [ESTIMATED]: the integral of q over psi equals pi r0^2 V exactly; the flow-weighted mean of cos(psi) equals cos(phi), so the distribution conserves wall-parallel momentum exactly if the film leaves the footprint at speed V.

Flow split (fraction of Q entering the forward half-plane, numerically integrated from 3.22) [ESTIMATED]:

| phi (deg) | 90 | 75 | 60 | 45 | 30 | 20 | 15 | 10 |
|---|---|---|---|---|---|---|---|---|
| forward fraction | 0.50 | 0.66 | 0.80 | 0.91 | 0.97 | 0.991 | 0.996 | 0.999 |
| q(forward) / q(backward) = ((1+cos phi)/(1-cos phi))^2 | 1 | 2.9 | 9 | 34 | 194 | 1.0e3 | 3.3e3 | 1.7e4 |

Film along each ray: Bhagat and Wilson's oblique equations [59 to 64] are the normal-incidence equations with Q / (2 pi) replaced by q(psi) [VERIFIED by inspection of their eqs. 58 to 64]. Implementation-ready statement [ESTIMATED restatement]: along ray psi, use eqs. (3.8) to (3.17) with an equivalent jet

    Q_eq(psi) = 2 pi q(psi),   d_eq(psi) = sqrt( 8 q(psi) / V ) = 2 r_e(psi) sqrt( sin(phi) ),   Re_eq = V d_eq / nu      (3.23)

and r measured from S, starting at r = r_e(psi). The ray-wise jump radius is R_j(psi) = 0.289 Q_eq(psi)^(3/4) (rho / (nu gamma))^(1/4). Example, J2-8 at phi = 15 deg: forward Q_eq = 14.9 Q so the forward film would run about 7.6 R_j (about 300 mm, i.e. the whole plate); sideways (psi = 90 deg) Q_eq = 0.017 Q and the film reaches only about 2 mm [ESTIMATED]. A grazing jet therefore paints a stripe a few jet diameters wide.

Validation range: the model reproduced measured film-front speeds and jump locations for phi = 30 to 120 deg (Bhagat and Wilson 2016, section 4.4.2) [VERIFIED]. Grazing angles below 30 deg are extrapolation.

Wall stresses under an oblique jet [ESTIMATED; no primary data found]:

- Normal force is exactly rho Q V sin(phi). Distribute it over the elliptical footprint with the shape of eq. (3.6) stretched by 1 / sin(phi) along the forward axis and peak value p_s sin^2(phi). This conserves the normal force identically. The true stagnation streamline still reaches p_s over a small region displaced towards the rear of the footprint; the sin^2 form is a deliberately smooth approximation and is a calibration item.
- Wall shear: stagnation-zone formula (3.7a) with V replaced by V sin(phi) and d by d_eq(psi), blended at r_e(psi) into the BLFZ formula (3.10) evaluated with the full V and distance from S. For grazing incidence the forward film is a boundary layer under an essentially undisturbed stream, tau_w = 0.472 rho V^2 (V r / nu)^(-1/2) from (3.10); the flat-plate (Blasius) constant 0.332 [RECALLED] gives a 30 percent lower bound.

### 4.8 Effect of wall curvature

Concave cylinders of 10 to 29 cm diameter (curvature 6.9 to 20 per metre), d_n = 2 and 4 mm, Q = 0.4 to 7 L/min, Re = 4,200 to 21,000: "the curvature of the impinged wall did not affect the shape of the radial flow zone until higher flow rates (> 1.5 dm3/min)"; at higher flow R decreased with curvature, attributed to more splatter, with "noticeable spray observed within the cylinders", stronger for horizontal than vertical cylinders; no appreciable effect on cleaning (Chee et al. 2019) [VERIFIED]. Convex walls were not studied [VERIFIED statement]. Default: apply the flat-wall film solution on the unrolled surface for |curvature| R_j < 0.5; curvature factor on splatter is a calibration parameter (default 1).

### 4.9 Moving impingement point

What the literature covers: Wilson et al. (2015) and Glover et al. (2016) treat a nozzle traversing at v_jet by moving to the nozzle frame and assuming the film is the stationary-jet film; their experiments span 2.1 to 126 mm/s (horizontal plates) and up to 233 to 250 mm/s (vertical walls), with d_n = 0.84 to 2.66 mm [VERIFIED: Glover et al. 2016 text; Wilson 2015 via its abstract]. Glover et al. state the assumption explicitly: "Here, U_o >> v_jet, so the film velocity in the RFZ was assumed to be the same as for a stationary jet ... If [v_jet] was comparable with U_o, a new RFZ analysis would be needed" [VERIFIED]. With d_n = 2 mm, Q = 35 mL/s (Re 21,700) the static R was 46 mm; R "increased a little" when the footprint moved onto already-wetted wall and "decreased a little" when it moved onto dry wall, at speeds up to 233 mm/s [VERIFIED]. Nothing was found for footprint speeds of 0.5 to 5 m/s. (Keshavarz et al. 2011 studied liquid jets on fast-moving surfaces for rail lubrication, with splash governed mainly by Re and surface roughness; only a search-result summary was seen, and those liquids were much more viscous.)

First-principles treatment for dishwasher sweep speeds [ESTIMATED]:

1. Work in the wall frame. Each parcel arriving at the wall starts a radial outflow from its own impact point with the oblique-jet distribution (3.22) for its own incidence angle phi (which already includes the nozzle's tangential velocity through eq. 2.3). The footprint translation v_s (eq. 2.5) is a separate quantity that says how fast successive parcels land on fresh wall.
2. Film front kinematics: liquid emitted at time t0 reaches radius r at t0 + T(r), with T(r) = integral from 0 to r of dr' / U_av(r'). Ahead of the footprint the film leads by at most

       a_lead = r* - v_s T(r*),   where U_av(r*) = v_s  (r* capped at R_j)                              (3.24)

   because the film cannot outrun the footprint once it has slowed below v_s. For J2-8 at 50 C: a_lead = 30, 21, 12, 8, 2 and 0 mm at v_s = 0.5, 1, 2, 3, 5 and 8 m/s; r* = 34, 24 and 19 mm at 1, 2 and 3 m/s.
3. Laterally and behind, the film keeps spreading after the footprint has passed, reaching R_j about 20 ms later, i.e. v_s times 20 ms (20 to 60 mm) behind the footprint. The wetted pattern is a comet: blunt nose a_lead ahead, widening to a wake of half-width up to R_j, then draining.
4. Stress history at a wall point with lateral offset b from the footprint track: because T(b) v_s << b inside r*, the quasi-steady assumption holds there, so

       peak:      tau_peak(b) = tau_w( r = max(b, 0.55 d) ),   p_peak(b) = p_w(b)
       exposure:  E_tau(b) = integral of tau_w dt = (1 / v_s) * integral over s of tau_w( sqrt(b^2 + s^2) ) ds     (3.25)

   with the s-integration limited to the region where the fast film exists (r < min(R_j, r*) ahead, r < R_j behind). For J2-8 at 50 C:

   | offset b (mm) | 0 | 2 | 5 | 10 | 20 | 30 |
   |---|---|---|---|---|---|---|
   | peak tau_w (Pa) | 236 | 175 | 111 | 79 | 52 | 12 |
   | E_tau per pass at v_s = 1 m/s (Pa s) | 4.3 | 4.3 | 3.8 | 3.1 | 1.6 | 0.45 |

   E_tau scales as 1 / v_s (8.7 Pa s on the track at 0.5 m/s, 1.4 at 3 m/s). The stagnation pressure dwell is d / v_s (2 ms at 1 m/s) and the high-shear dwell about 2 R_j / v_s (80 ms at 1 m/s), i.e. roughly 0.1 and 5 percent of a 1.7 s revolution for a point on a track; this brackets the "frequency factors" of 0.07 to 1.6 percent that the thesis computed for jets crossing a soil tile [VERIFIED thesis values].
5. Pre-wetted wall (residual film of thickness h_res from the previous pass or from drainage): the advancing fast film must accelerate the residual liquid. A snow-plough momentum balance rho h U (U - U_f) = rho h_res U_f^2 gives a front speed U_f about 0.62 U when h_res = h, so residual films of 50 to 200 micrometres (comparable to h in the RFZ) slow the front noticeably beyond r about 5 d and shrink the effective r*. Glover's observation that R changes only "a little" between dry and wetted walls at low speed suggests the effect is modest; default: no correction for h_res < 0.3 h, front-speed factor 1 / (1 + sqrt(h_res / h)) otherwise. Calibration item.
6. When v_s exceeds V (possible only for grazing streaks), no film leads the footprint; treat the event as an oblique "paint stripe" using 4.7 with exposure time d_fp / v_s.

---

## 5. Splatter of impinging turbulent jets (task item 4)

### 5.1 Mechanism

"Splattering is driven by the disturbances on the surface of the impinging jet. Thus, undisturbed laminar jets do not splatter, unless they are long enough to have significant capillary instability. Turbulent jets ... develop surface roughness as a result of liquid-side turbulent pressure fluctuations, and they are highly susceptible to splattering" (Lienhard 2006) [VERIFIED]. The disturbances are carried into the thinning radial film as outward-travelling waves that steepen and break into droplets within a narrow radial band; the film is stable to small disturbances and unstable to large ones [VERIFIED].

### 5.2 Splattered mass fraction: pipe-jet correlations (MIT)

Data: water, isopropanol-water and surfactant-water jets from long tubes (70 to 100 d, fully developed turbulent flow), d = 0.8 to 5.8 mm, We = 130 to 31,000, Re = 2,700 to 98,000, l/d = 0.2 to 125, horizontal target with the unsplattered film collected (Bhunia and Lienhard 1994a) [VERIFIED].

    omega = We exp( 0.971 (l/d) / sqrt(We) )                                                          (5.1)
    xi    = -0.258 + 7.85e-5 omega - 2.51e-9 omega^2      for 4,400 < omega < 10,000                   (5.2)
            valid for 1,000 < We < 5,000 and l/d < 50; outside this "We and l/d should be treated as independent parameters"
    onset (5 percent splatter):  l_o / d = 130 / ( 1 + 5e-7 We^2 )                                    (5.3)

[VERIFIED] eqs. (5.1) from Lienhard, Liu and Gabour 1992 eq. 11; (5.2), (5.3) from Bhunia and Lienhard 1994a eqs. 5, 6. The earlier form xi = -0.0935 + 3.41e-5 omega + 2.25e-9 omega^2 (2,120 < omega < 8,000) is superseded [VERIFIED].

Other verified findings:

- Only We and l/d matter; no discernible Re effect (a factor 1.5 in Re at fixed We changed nothing; a factor 1.3 in We raised xi by about 25 percent).
- Very little splatter near the nozzle (under 5 percent); xi then rises with l/d and reaches a plateau at l_c / d of about 18 to 25 for We = 5,400 to 8,000, which is 0.32 to 0.45 of the Miesse break-up length (their Table 1). The plateau value at We about 5,500 is about 0.3. Up to 75 percent was splattered at We = 31,000, l/d = 34; "strong splattering can result in atomization of 30 to 70 percent of the incoming liquid".
- For low-We jets the onset length is close to the capillary break-up length and "splattering is essentially of drop impingement type"; once the jet has broken up xi is constant with l/d.
- Surfactant has no effect when We is computed with the pure-liquid surface tension.

Worked values at 20 C (gamma = 0.072) [ESTIMATED from 5.1 to 5.3; "onset" = l_o]:

| Jet | We | l_o (mm) | xi at 100 mm | xi at 150 mm | xi at 200 mm |
|---|---|---|---|---|---|
| d = 2 mm, 6 m/s | 1,000 | 175 | 0.05 | 0.28 | 0.30 (capped) |
| d = 2 mm, 8 m/s | 1,775 | 102 | 0.10 | 0.28 | 0.30 (capped) |
| d = 2 mm, 10 m/s | 2,770 | 55 | 0.17 | 0.30 (capped) | 0.30 (capped) |
| d = 3 mm, 6 m/s | 1,500 | 186 | 0 | 0.09 | 0.21 |
| d = 3 mm, 8 m/s | 2,660 | 87 | 0.07 | 0.16 | 0.26 |

Equation (5.2) is a parabola that peaks at 0.356 (omega = 15,600) and then falls, which is unphysical. Cap it by evaluating it at min(omega, 11,000), which holds xi at 0.30, the plateau level reported for We about 5,500 [ESTIMATED cap]. The true plateau for We = 1,000 to 3,000 could not be read from the figures and may be lower.

### 5.3 Splattered fraction: short convergent nozzles on vertical walls (Cambridge)

- Wang et al. (2013), L = 50 mm, 2, 3 and 4 mm convergent nozzles, vertical wall, S defined by Q_film = Q (1 - S) measured in the falling film: "S was small until the jet Reynolds number ... exceeded 12,000. Above this value S increased linearly with Re reaching S = 0.37 at Re = 20,000. The value of S also depended on the angle of impingement" [VERIFIED as quoted in Chee et al. 2019].
- Chee et al. (2019), d_n = 2 to 4 mm, L = 0.06 to 1 m, Re = 5,300 to 39,000, We = 95 to 9,300: for L < 300 mm S rises almost linearly with Re above 13,000, nearly independent of d_n; for L > 300 mm S becomes independent of Re and strongly dependent on L, approaching 0.4 at 1 m; S did not change appreciably when the jet was visibly breaking into droplets; flow patterns still obeyed the film model when Q was replaced by Q (1 - S) [VERIFIED].
- Feldung Damkjaer et al. (2017), industrial nozzles 2.0 to 5.5 mm, jet lengths 80 to 2,490 mm: inferred S up to 0.7 [VERIFIED as quoted in Chee et al.].

These S values are much larger than (5.2) predicts at l/d = 12 to 25 (which gives under 5 percent). Possible reasons: S on a vertical wall also counts liquid shed from the rope and film edges; convergent nozzles fed by pipework are not fully developed pipe flows; and Re versus We cannot be separated in single-temperature data. This is the largest unresolved discrepancy in the dossier.

### 5.4 Properties of splattered droplets

From phase-Doppler measurements (Lienhard, Liu and Gabour 1992; Re = 19,000 to 69,000, d about 4.8 mm) [VERIFIED]:

- Departure radius r_s about 4.5 to 5.1 d from the stagnation point ("within a fairly narrow radial band"; the model uses 4.51 d); beyond this band no further splatter occurs.
- Trajectory: "about 20 deg off horizontal", i.e. 20 deg above the wall plane, directed radially outwards.
- Speed: "the droplets travel at a low angle with nearly the speed of the incoming jet"; measured radial velocity profile above the plate spans roughly 0 to 0.8 of the jet speed, larger drops faster.
- Size: "typically ranges from a few microns to almost a millimeter"; plotted mean D/d near the plate 0.055 to 0.10 (d = 4.76 mm), decreasing with height above the plate.
- The splattered liquid "remains airborne" and does not return to the film at an appreciable rate over the measurement radii (15 to 24 d).
- After splatter the remaining film carries (1 - xi) of the mass and correspondingly less momentum; scale Q in the film equations by (1 - xi) for r > r_s.

### 5.5 Oblique incidence, wetness, roughness

- Angle: Wang et al. report a dependence of S on impingement angle [VERIFIED statement only; the functional form was not accessible]. Estimate: splatter is driven by the wall-normal disturbance amplitude and the radial thinning of the film; scale the splattered flux per ray with q(psi) and reduce the total as sin(phi) [ESTIMATED], so grazing jets splatter little but throw what they do splatter forwards.
- Pre-wetted wall: no data found. A residual film thicker than the RFZ film should damp the wave steepening; default no effect.
- Roughness: no splatter-specific data found. In the related problem of jets on fast-moving surfaces, larger roughness-to-jet-diameter ratio lowers the splash threshold (Keshavarz et al., search summary only). Default no effect; calibration factor 1.0 to 1.5 for soiled walls.

### 5.6 Recommended splatter model

    xi_BL = max( 0 , -0.258 + 7.85e-5 w - 2.51e-9 w^2 ),  w = min(omega, 11,000),  omega from (5.1), We with gamma_water(T)
    S_W   = clamp( 4.6e-5 ( V d / nu_20 - 12,000 ) , 0 , 0.40 ),          nu_20 = 1.0e-6 m^2/s                       (5.4)
    xi    = k_S max( xi_BL , S_W ) sin(phi),      k_S default 0.5 (range 0 to 1)

[ESTIMATED synthesis]. S_W is a straight line through Wang's two quoted points; it is written with the 20 C viscosity because the data were taken near 20 C and the mechanism (surface disturbance versus capillarity) is not viscous, so applying it with hot-water Re would double the prediction without evidence. k_S = 0.5 splits the difference between the two data families pending calibration. Emit the splattered mass as droplet parcels at r_s = 4.5 d_eq, elevation 20 deg (uniform 10 to 30), speed 0.7 V (uniform 0.4 to 0.9), log-normal diameter with median 0.08 d and geometric std 1.8, truncated to [0.01, 0.4] d [ESTIMATED distribution parameters around the VERIFIED ranges].

---

## 6. Droplet and droplet-train impact on dry and wetted walls (task item 5)

### 6.1 Where dishwasher droplets sit

Normal-impact groups: We_n = rho V_n^2 D / gamma, Re_n = V_n D / nu, Oh = sqrt(We)/Re, La = rho gamma D / mu^2, K = We sqrt(Re). At 50 C [ESTIMATED]:

| Droplet | D (mm) | V_n (m/s) | We_n | Re_n | K = We sqrt(Re) | Outcome on a wetted wall (6.3) |
|---|---|---|---|---|---|---|
| splatter or splash secondary, slow | 0.1 | 1 | 1.5 | 180 | 20 | stick |
| splatter secondary | 0.2 | 2 | 12 | 720 | 310 | rebound |
| splatter secondary, fast | 0.3 | 4 | 70 | 2,200 | 3,300 | spread (deposit) |
| surface-shed droplet | 0.5 | 8 | 470 | 7,200 | 40,000 | splash |
| drip from the rack above | 4 | 2 | 230 | 14,000 | 28,000 | splash |
| jet fragment | 2 | 4 | 470 | 14,000 | 56,000 | splash |
| jet fragment | 4 | 8 | 3,700 | 58,000 | 900,000 | splash |

### 6.2 Regime thresholds

| Criterion | Equation | Conditions | Tag and source |
|---|---|---|---|
| Splash on a dry solid (Stow and Hadfield; Mundo et al. 1995) | K = We sqrt(Re) greater than about 3,000 | "For impacts at K >~ 3,000, one can expect a splash"; does not separate prompt from corona splash; ignores gas pressure, wettability and roughness | [VERIFIED] Josserand and Thoroddsen 2016 eq. 7 |
| Mundo et al. 1995, original form | K_M = Oh Re^1.25 > 57.7 (identical to We sqrt(Re) > 3,330) | from small water droplets on relatively rough surfaces | [VERIFIED] value as quoted by Zhou (ICLASS 2012) and in search summaries of the literature; identity [ESTIMATED] |
| Riboux and Gordillo 2014 | lamella lift-off parameter beta about 0.14 | theory including the gas; smooth, partially wetting surfaces; no roughness or wettability dependence | [VERIFIED] arXiv 1401.6943 (not reduced to a closed form here) |
| Rough or porous dry surface | We_c = 1,770 for 2 to 4 mm water drops on dry corrugated cardboard, where K_M = 57.7 failed in 3 conditions | shows the scatter between surfaces | [VERIFIED] Zhou, ICLASS 2012 |
| Bai and Gosman, dry wall | splash if We_n > A_dry La^(-0.183), A_dry = 2,630 (1,300 to 5,200, decreasing with roughness) | fuel-spray model | [VERIFIED] OpenFOAM-8 ThermoSurfaceFilm.C and .H |
| Bai and Gosman, wetted wall | We_n < 2 stick; 2 to 20 rebound; 20 to We_c spread; We_n > We_c = A_wet La^(-0.183) splash, A_wet = 1,320 | fuel-spray model | [VERIFIED] same source |
| Cossali et al. 1997, thin film | We Oh^(-0.4) > K_c(delta), delta = h_film / D | "K depends on the non-dimensional film thickness" [VERIFIED form] (Rajendran et al., arXiv 2310.02526). K_c = 2,100 + 5,880 delta^1.44 for 0.1 < delta < 1 [RECALLED constants] | |
| O'Rourke and Amsden 2000 (KIVA, Forte) | E^2 = We_n / ( min(h/D, 1) + Re_n^(-1/2) ) > 57.7^2; splashed mass fraction rising to a plateau of about 0.7 to 0.75 | plateau "increases rapidly from zero to a value around 0.75, and then remains constant", tunable default 0.75 [VERIFIED] Ansys Forte theory manual 6.6.1; E^2 formula and 57.7 [RECALLED]. For a dry wall this reduces to We sqrt(Re) > 3,330, the Mundo value [ESTIMATED] | |
| Yarin and Weiss 1995, drop trains | V > 17 to 18 (gamma/rho)^(1/4) nu^(1/8) f^(3/8), f = impact frequency | each drop lands on the film left by its predecessors | [RECALLED] |
| Stanton and Rutland; Kuhnke | stick/rebound/spread/splash maps with frequency or temperature dependence | not opened | [RECALLED, no constants given] |

Minimum normal speed for splash implied by three of these, 50 C water [ESTIMATED]:

| D (mm) | 0.1 | 0.3 | 1 | 2 | 4 |
|---|---|---|---|---|---|
| K = 3,000 (dry, smooth) | 7.5 | 3.9 | 1.9 | 1.2 | 0.8 |
| Bai and Gosman, wetted | 12 | 6.3 | 3.1 | 2.1 | 1.4 |
| Bai and Gosman, dry | 17 | 8.9 | 4.4 | 2.9 | 1.9 |
| Cossali (recalled), delta = 0.1 / 1.0, D = 1 mm | | | 3.7 / 6.8 | | |

The criteria agree within a factor of about 2 in speed. Thick residual films (delta near 1) suppress splashing; thin ones promote it relative to a dry smooth wall in the Bai-Gosman model.

Oblique impact: CFD models use the normal velocity component in We (the OpenFOAM implementation computes We from U_n only) [VERIFIED]. Strong asymmetry and splashing even at low We appear when the impact direction is more than 85 deg from the normal, and tangential velocity can both trigger and suppress the corona splash (Chou et al. 2009 and Bird et al. 2009, as reviewed by Josserand and Thoroddsen) [VERIFIED]. On an inclined dry surface (up to 30 deg) the splashed fraction was "generally larger than that on a flat surface" (Zhou) [VERIFIED].

### 6.3 Secondary droplets: the Bai-Gosman model as coded in OpenFOAM

[VERIFIED] against OpenFOAM-8 source (ThermoSurfaceFilm.C), which cites Bai and Gosman SAE 960626 and Bai, Rusche and Gosman, Atomization and Sprays 12 (2002):

    We_c    = A La^(-0.183),  A = A_dry (2,630) or A_wet (1,320);  wall is "wet" if film thickness > deltaWet (user input)
    rebound (wet, 2 <= We < 20):  u_n' = -e u_n,  u_t' = (5/7) u_t,
                                  e = 0.993 - 1.76 th + 1.56 th^2 - 0.49 th^3,  th = incidence angle from the wall plane, rad
    splash:   mass ratio  r_m = m_splashed / m_incident = 0.2 + 0.6 U[0,1]  (dry);   0.2 + 0.9 U[0,1]  (wet; may exceed 1 by film entrainment)
              number of secondary droplets per incident droplet  N_s = 5 ( We / We_c - 1 )
              mean secondary diameter  D_bar = D ( r_m / (6 N_s) )^(1/3)
              diameters sampled from an exponential distribution with scale D_bar truncated to [0.1 D_max, D_max],  D_max = 0.9 r_m^(1/3) D
              ejection direction: polar angle uniform 5 to 50 deg from the wall normal (as coded), azimuth uniform
              energy: E_k,s = E_k,in(normal) + E_surf,in - E_surf,sec - E_d,   E_d = max( 0.8 E_k,in , (We_c / 12) pi gamma D^2 ); no splash if E_k,s <= 0
              speed of each secondary = C_f |u_t| + a size-dependent normal part set by E_k,s;  C_f = 0.6 to 0.8 ("skin friction")
    the remainder m (1 - r_m) is added to the wall film

Caveats for Spotless: (i) the model was built for 10 to 300 micrometre fuel droplets, not mm-scale water drops; (ii) the 5 to 50 deg ejection cone is measured from the wall normal in the code, while crown-splash photographs of large water drops show most secondaries leaving at small angles to the surface (Zhou: "many secondary droplets are splashing from the center at a small angle relative to the horizontal surface" [VERIFIED]); (iii) splashed fractions of 0.2 to 0.8 are far above direct measurements for mm drops, below.

### 6.4 Measured splash products for mm-scale water drops

Zhou (FM Global, ICLASS 2012), single water drops of 2 to 4.3 mm at 1.5 to 3.7 m/s on dry corrugated cardboard, We = 300 to 1,200, impact angles 0 to 30 deg [VERIFIED]:

- Splashed mass fraction "is small (< 14 percent)", scattered, larger on inclined surfaces.
- Secondary droplets from a 4.3 mm, 3.7 m/s drop: at 4 ms, 26 droplets of 0.09 to 0.33 mm moving at 2.1 to 6.8 m/s ("most ... have a speed higher than that of the primary droplet"); at 10 ms, 16 droplets of 0.11 to 0.64 mm at 0.5 to 2.3 m/s. Two populations: early, small, fast (prompt splash) and late, larger, slow (corona break-up).
- Sizes follow a Rosin-Rammler distribution in D / D_v50 (constants are in an equation image that could not be extracted).

Recommended defaults for Spotless [ESTIMATED]: keep the Bai-Gosman thresholds but replace the splashed mass ratio by r_m = clamp( 0.1 (We / We_c - 1), 0, 0.3 ) on dry or thinly wetted walls and up to 0.5 where the residual film is thicker than 0.1 D; eject secondaries at 10 to 40 deg above the wall plane; sizes log-normal with median 0.08 D (geometric std 1.8, truncated at 0.02 and 0.3 D); speeds 0.3 to 1.2 times the incident normal speed plus 0.7 of the incident tangential velocity. One generation only: secondaries are below all splash thresholds (6.1).

### 6.5 Droplet trains from a broken jet

Rayleigh train from a jet of diameter d: drop diameter 1.9 d, spacing 4.51 d, frequency f = V / (4.51 d): 890 Hz for J2-8 [ESTIMATED]. The dimensionless train speed V (rho/gamma)^(1/4) nu^(-1/8) f^(-3/8) is about 42 for J2-8 at 50 C, above the recalled Yarin-Weiss threshold of 17 to 18, so each drop produces a crown on the film left by its predecessors [ESTIMATED from a RECALLED criterion]. A broken jet is therefore always in the "splashing drop train" regime: expect a splashed fraction comparable with, or above, the coherent-jet splatter. Bhunia and Lienhard's statement that splatter becomes "essentially of drop impingement type" and constant with distance once the jet has broken up [VERIFIED] supports using the plateau splatter fraction (0.3, section 5.2) for the fully broken state.

### 6.6 Impact pressure and shear from droplets, and relevance to cleaning

- Pressure. The inertial (stagnation) scale is rho V^2 / 2, the same as for a jet of the same speed. The compressible "water-hammer" pressure rho c V (c about 1,480 m/s; 11.7 MPa at 8 m/s) exists only while the contact line outruns the pressure wave: for a time of order D V / (4 c^2), about 2 ns, over a radius of order D V / (2 c), about 5 micrometres, for a 2 mm drop at 8 m/s [ESTIMATED from RECALLED scalings]. Josserand and Thoroddsen list water-hammer effects as relevant to "high-pressure fuel injectors", not low-speed impacts [VERIFIED]. Neglect water hammer in Spotless.
- Peak force of one drop: about 0.85 rho V^2 D^2, reached at t about 0.1 to 0.2 D / V [RECALLED]. For D = 3.8 mm at 8 m/s: 0.78 N for about 0.1 ms; time-averaged over the train it equals the jet momentum flux rho Q V.
- Spreading: maximum spread factor beta_max = D_max / D = 0.61 (Re^2 Oh)^(1/6) (Scheller and Bousfield) or proportional to We^(1/4) (Clanet et al.) [VERIFIED, Josserand and Thoroddsen Table 1]; both give about 5.7 for a 2 mm drop at 6 m/s at 50 C [ESTIMATED]. The lamella velocity field at early times is v_r = r / t [VERIFIED, their eq. 3].
- Wall shear. No measurement or validated closed form was found for mm drops at 1 to 10 m/s. Scaling [ESTIMATED]: the drop behaves as a jet pulse of diameter D and duration about D / V, so the stagnation-flow shear scale is the same as eq. (3.7), tau about 0.6 rho V^2 Re_D^(-1/2) (150 Pa for D = 2 mm at 6 m/s, 50 C), acting for about 2 D / V (0.7 ms) over a disc of radius 0.5 beta_max D (about 6 mm). The edge of the lamella moves faster than V at early times and gives a brief higher shear ring.
- Cleaning relevance. Per unit of delivered liquid, a droplet train delivers a similar stress-time integral to a coherent jet of the same speed, spread over a wider and less repeatable area, with more liquid lost to splash and with intermittent cushioning by the residual film. Experimental pointer: with long, breaking jets "the cleaning rate constant extracted from tests with longer jets was smaller than that expected from tests with coherent jet tests. The difference could not be explained simply in terms of adjusting the flow rate" (Chee et al. 2019, reporting Feldung Damkjaer et al.) [VERIFIED]. Default: apply a droplet-train efficiency factor k_drop = 0.7 (range 0.3 to 1.5) to the coherent-jet stress exposure [ESTIMATED; calibration].

---

## 7. Jets and droplets on rack wires, edges, rims and fork tines (task item 6)

### 7.1 What was found

- Vertical water jet on a horizontal cylinder at low speed: d = 6 and 10 mm, V = 1.15 and 1.95 m/s (Fr = 4.74, 6.23), cylinder D = 15 to 55 mm, d/D = 0.11 to 2.0. For d/D <= 0.40 the round jet becomes a planar sheet that follows the surface (Coanda) and is deflected towards the cylinder; for d/D = 0.60 and 0.83 the deflection is away from the cylinder ("bouncing"); deflection and wrap ("Coanda") angles increase with deeper penetration and smaller d/D; wrap angles from 64 deg up to 142 deg (the latter at d/D = 0.18, Fr = 6.23) are reported; intermittent side-switching occurs for some ratios (Nausin, Seerwani and Alam 2023) [VERIFIED].
- Inclined capillary jet (30 deg) on a 3 mm vertical glass cylinder: above about 1 mL/s the cylinder hardly affects the jet; near 0.5 mL/s the jet clings and coils helically (Jambon-Puillet et al., PRL 2019) [VERIFIED only through a search-result summary of the APS synopsis]. A 2 mm dishwasher jet carries 25 mL/s, far into the "little effect" regime.
- Free-sheet criterion: a radially expanding liquid sheet disintegrates where 2 gamma = rho h U^2 (Taylor 1959, as quoted by Button et al. 2010 eq. 2.1) [VERIFIED].
- Drop impact on inclined fibres is a known topic (Piroird, Clanet, Lorenceau and Quere 2009, cited in Josserand and Thoroddsen) [VERIFIED citation only]; capture thresholds on thin fibres are of order 1 m/s or less for mm drops [RECALLED].
- No measurements were found for 1.5 to 4 mm jets at 4 to 12 m/s on 3 to 5 mm coated wires, on plate rims or on cutlery. This is a genuine literature gap (and a dedicated search was not completed).

### 7.2 Physical reasoning used to fill the gap [ESTIMATED throughout]

Attachment versus fling-off. A film of thickness h and speed U following a convex surface of radius R_w feels a centrifugal acceleration U^2 / R_w directed from the wall towards the free surface. Surface tension can hold the free surface only if the centrifugal Bond number

    Bo_c = rho U^2 h^2 / ( gamma R_w )                                                                (7.1)

is of order 1 or less. Check against the two data points above: Nausin's low-speed jets (U about 1.5 m/s, h about 0.5 mm, R_w = 10 mm) give Bo_c about 0.8 and the film does wrap; a dishwasher jet film on a 4 mm wire (U = 7 m/s, h = 0.15 mm, R_w = 2 mm) gives Bo_c about 8 and the film is flung off within a fraction of a turn. So at wash speeds, Coanda wrapping around rack wires is weak: the liquid leaves the wire as two thin sheets or sprays. At the low speeds of draining films (U below about 1 m/s), wrapping and teapot-style attachment dominate; that regime belongs to the "films" dossier.

Momentum flux versus surface tension at an edge. Where a wall film reaches a sharp edge or rim with M = rho U_av^2 h > 2 gamma (0.14 N/m), it cannot turn the corner and leaves as a free sheet at speed U_av, tangent to the surface. From the table in section 4.4 this holds within about 15 d (30 mm) of the impact point for J2-8. Further out the film wraps the edge and drains.

### 7.3 Recommended model

Discretise each jet into a bundle of sub-rays (7 or 19 on a hexagonal pattern across the jet cross-section) so that partial hits are captured.

Wire or tine of width D_w, struck by a fraction f_hit of the jet's sub-rays:

1. Passing part: the (1 - f_hit) Q that misses continues along the original direction as a jet of the same speed and equivalent diameter d sqrt(1 - f_hit), deflected away from the wire by a small angle delta_pass = 5 deg f_hit (range 0 to 15 deg) and with its remaining coherent length shortened (set C_b to 3.3 from the wire onward).
2. Intercepted part: stress on the wire itself from section 4 (stagnation pressure and shear on a footprint limited to the wire width). The liquid leaves as two fan sheets, one on each side of the wire, in the plane normal to the wire axis. Each fan is centred at theta_sep = 40 deg (range 20 to 80) from the incoming direction, with in-plane spread +/- 20 deg and out-of-plane (along-wire) spread +/- 15 deg; speed 0.8 V (range 0.6 to 0.95). The fans break up within 10 to 30 mm into droplets with median diameter 0.25 d (range 0.1 to 0.5 d). A retained fraction f_ret = 0.05 (0 to 0.15) stays on the wire as a film and drips.
3. A wire fully blocking the jet (D_w >= d, centred hit) casts a geometric shadow for coherent momentum; the region behind receives only the fan droplets.

Line-of-sight blockage by a rack is not small: wires of 3 to 5 mm at 20 to 30 mm pitch block 10 to 25 percent of jet directions per wire family (geometry from the "items" dossier). Fork tines and knife edges: same model with D_w equal to the projected width facing the jet.

Edges and rims of plates, bowls and glasses: split the sub-ray bundle geometrically at the edge. The part that lands on a face is an oblique partial jet (section 4.7) with flow f_hit Q; the part that misses continues as in step 1. A film reaching an edge with M > 2 gamma becomes a free sheet or spray continuing in the film direction with median droplet size 2 to 4 h; otherwise pass the mass to the films model at the edge.

Droplets on wires: droplets with D >= 0.5 D_w and We_n > 20 split into two fragments carrying (1 - f_ret) of the mass, each deflected by +/- 20 to 40 deg; smaller or slower droplets are captured.

All constants in this section are calibration parameters with wide ranges; this sub-model is the first candidate for replacement by an offline resolved-simulation lookup table (section 10).

---

## 8. Jets entering concave vessels (task item 7)

### 8.1 What was found

- Jet striking the underside of a horizontal plate (Jameson et al. 2010, Button et al. 2010; nozzles of 3, 4 and 5.5 mm radius; stable bells at 2 to 20 L/min for 70 percent glycerol and 3 to 20 L/min for a Triton X-100 solution): the liquid spreads radially along the plate "to an unspecified abrupt departure point, from whence it falls away from the plate of its own accord", either in threads or as a continuous curtain enclosing air (a water bell), with strong hysteresis in bell shape. The departure radius increases with flow rate, decreases with viscosity (a factor 100 in viscosity changed it by a factor of about 4), increased by roughly 3 percent when surface tension was lowered by about 10 percent (consistent with gamma^(-1/4)), and is independent of jet radius and of the plate material; the local contact angle at the rim does depend on the material (34 deg on glass, 116 deg on Teflon for 70 percent glycerol) [VERIFIED]. Departure radius: R = 0.3025 (rho Q^3 / (nu gamma))^(1/4) for a laminar film; R/a = 1.0621 (Re_a We_a^4)^(1/13) for a turbulent film [VERIFIED] (section 4.5).
- The jump radius is the same for jets hitting a wall from above, from below or horizontally (Bhagat et al. 2018) [VERIFIED].
- Concave cylinders of 10 to 29 cm diameter: flat-wall film behaviour up to 1.5 L/min, extra spray inside the cylinder above that (Chee et al. 2019) [VERIFIED] (section 4.8).
- Jet filling a vial only slightly wider than the jet (X = vial/jet diameter about 1): four regimes (pre-sheet, puffing, steady upward umbrella sheet, downward bell) set by X, Ca, We and Fr (Mohd, Yadav and Das 2024) [VERIFIED abstract]. Relevant to narrow-necked items held full of liquid, i.e. items loaded opening-up, not to inverted vessels.
- Commercial SPH dishwasher simulations report puddles on cup bases and "wetting time" maps but publish no quantitative interior-flow data (FIFTY2 PreonLab page) [VERIFIED].
- No bottle-washer, keg-washer or glass-washer correlations were found (the search was not completed). Tank-cleaning work by the Cambridge group concerns large vessels with small curvature.

### 8.2 Interior flow model for an inverted vessel [ESTIMATED]

Geometry: opening radius R_o, base (now the ceiling) radius R_base, wall height H_v, wall half-angle from vertical.

1. Entry. A jet sub-ray enters if it passes through the opening; the rim clips the bundle (section 7.3). For a nozzle track passing under the opening at nozzle speed v_n, the entry window per revolution is about (chord length) / v_n, e.g. 70 mm / 0.6 m/s = 0.12 s. Only the few nozzles whose tracks pass under a given vessel contribute.
2. Jet reaches the ceiling (base) at incidence phi_b, usually 60 to 90 deg: radial film from section 4.4 and 4.7. Along each ray psi compare the jump or departure radius R_j(psi) (eq. 3.17 with Q_eq(psi), reduced by (1 - xi)) with the distance L_c(psi) to the base-wall corner.
   - L_c < R_j: the fast film reaches the corner, turns onto the side wall (the corner is concave to the flow, so centrifugal force presses the film against the wall) and runs down the wall as an attached film with initial speed U_av(L_c) and thickness h(L_c). Hand over to the films model as a line source around the corner. This is the "ceiling film plus falling wall curtain" pattern.
   - L_c > R_j: the film detaches from the ceiling at R_j and falls as threads or a curtain (water bell) inside the vessel, wetting the side walls only where they taper inwards into its path, or by splash. The side walls then rely on step 3.
   For J2-8 (1.5 L/min), R_j is 35 to 41 mm: the film reaches the wall in glasses and mugs (R_base 25 to 40 mm) but not in bowls, pans and large containers; a 3 mm jet at 8 m/s (R_j about 64 to 76 mm) reaches the wall of cereal bowls.
3. Jet strikes the interior side wall directly at a grazing angle (off-centre or inclined jets): from 4.7 almost all the flow goes forward as a film that climbs the wall, crosses the ceiling and descends the opposite side. Film speed along the way from eqs. (3.8) to (3.15) with the equivalent jet of eq. (3.23), with gravity deceleration U^2 = U0^2 - 2 g z applied to the inviscid part (small: 0.2 m/s lost over 150 mm at 8 m/s).
4. Splatter and splash droplets generated inside the vessel (sections 5 and 6) are traced like any others; most hit the interior within a few cm and deposit, giving a diffuse wetting of interior areas the films miss.
5. Drainage, the liquid ring at the lower rim, pooling in the concave outer base (punt) of the inverted vessel and bridging to neighbours are film phenomena: see the "films" dossier.

Narrow-necked bottles (neck 20 to 30 mm): entry probability per revolution scales as (neck diameter - d) / (radial spacing of nozzle tracks) times the angular window; once inside, R_j exceeds the body radius, so the whole interior is wetted by the ceiling film and a falling annular wall film, which exits through the neck around the incoming jet. At 1.5 L/min in a 20 mm neck no flooding is expected.

Model-form uncertainty is large here: transient entry (the footprint sweeps across the ceiling during the entry window), interaction of the returning curtain with the incoming jet, and air circulation inside the vessel are all unquantified.

---

## 9. Measured flow in real dishwashers (task item 8)

### 9.1 PEPT study (Perez-Mohedano EngD thesis 2016, University of Birmingham; journal version Perez-Mohedano, Letzelter, Amador, VanderRoest and Bakalis, Chem. Eng. J. 2015)

All [VERIFIED] from the thesis text unless noted.

| Item | Value |
|---|---|
| Machine | customised Whirlpool DU750; internal loading volume 560 x 500 x 620 mm (W x D x H); two baskets, three spray arms (lower, medium, upper); software modified for selectable pump speed and arm |
| Method | positron emission particle tracking (location rate up to 250 Hz according to the journal-abstract summary); tracers up to 400 micrometres, density about 1,100 kg/m^3; field of view up to 400 mm height |
| Tracer cycle | pump and arm, ejection, impact on wall or crockery, downfall (over crockery, walls or free fall), bulk water at the bottom; "the time scale of the process was typically less than 3 seconds and the highest velocity values were found upon ejection"; the downfall over a plate "happened within tenths of a second" |
| Jet paths | straight lines; average line-fit error mostly below 2 mm, peaking near 1 mm; a high-speed photograph through a Perspex side window shows the same; "jets trajectories can be considered as fixed vectors" |
| Coverage | "a complete and continuous coverage of all areas with direct impingement jets was also impossible"; a gap in jet coverage near radial position 100 mm (arm design) where water arrived only by splashing or downfall; CFD showed a second gap near 150 mm |
| Velocities, medium pump speed, no load (PEPT mean +/- std; CFD mean +/- std), m/s | spray arm 1.60 +/- 0.43 (1.43 +/- 0.45); ejection 7.69 +/- 3.16 (7.24 +/- 2.30); downfall 5.05 +/- 2.12 (3.31 +/- 0.97) |
| Arm internal velocity versus pump speed | high 1.67, medium 1.17 to 1.18, low 0.71 to 0.79 m/s; detergent made no difference (0.75 m/s at low speed with detergent) |
| Ejection velocity field | "highly homogeneous over the whole ejection area (above 30 mm)" and not a function of radial distance; increases with pump speed; pump speed had no effect on the downfall stage |
| Stokes numbers of the tracer | arm 0.63 to 1.1; ejection 13 to 39; downflow over walls and plates 10.3 (so ejection-stage tracer velocities lag the liquid) |
| Deceleration in flight | larger than gravity alone, attributed to air resistance |
| Residence and stagnant zones | longest residence at lower wall areas (z < 100 mm), at the edges of the bottom pool, and in densely packed crockery regions (10 to 100 mm height); with load the downfall velocity distribution collapses towards zero |
| Mean film estimate | if all airborne and surface water were spread uniformly over walls and plates the film would be about 0.9 mm thick (used only for a Stokes-number estimate) |
| Detergent | no significant effect on water motion |
| CFD comparison | good agreement for arm and ejection; poor for free-fall downfall (tracer rebound from the roof suspected) |

Arm and nozzle data for the DU750 lower arm (thesis Tables 5.4, 5.7, section 7.3.1) [VERIFIED]: rotation measured at 35 rpm (1.71 s per revolution); 30 rpm described as "within the values typically found in commercially available ADWs"; arm height 30 mm above the tub floor, 20 mm gap to the plate bottoms; most common nozzle diameter 2 mm; ten nozzles at radii 89 to 238 mm with elevation angles rho_jet of 55, 89, 60, 70, 89, 89, 70, 62, 89 and 55 deg and assorted azimuths.

Direct-impingement statistics from the thesis' geometric jet model (zero-width straight jets, flat circular plates):

- For two 250 mm plates placed symmetrically at x = +/- 125 mm with 20 mm plate spacing, only 2 of 10 jets could reach the left plate and 5 the right; per-revolution impact times ranged from 5e-5 to 0.027 s and impact lengths from 40 to 249 mm; no jet achieved an overall efficiency above 0.3 (Table 5.8) [VERIFIED].
- For the soil tile used in full-scale tests, only jets 2 and 4 could hit it: impact times 0.0013 s and 0.0272 s per 1.71 s revolution, i.e. 0.07 and 1.59 percent of the time; the full-scale cleaning simulations used 1.59 percent as the shear "frequency factor" (section 7.3.1.1) [VERIFIED].
- A straight cleaned stripe was observed on one tile along a jet track ("jet impact pattern") [VERIFIED], direct evidence that cleaning by direct impingement is track-like.
- The thesis' scanning fluid-dynamic-gauge experiments imposed 12 to 65 Pa at frequency factors of 8.5 to 100 percent [VERIFIED]; the wall shear predicted in section 4.4 for the outer half of the RFZ (10 to 80 Pa) is of the same order, and the stagnation-zone values (150 to 320 Pa) are above that range.

Journal-paper abstract (via search summary): jets follow straight lines; higher pump speed raises ejection velocity but hardly affects downfall; dense loading slows the tracer and increases residence time; detergent has no visible effect; CFD agrees for arm and ejection but not free fall [VERIFIED, summary only].

### 9.2 Derived estimate: how much surface sees direct impingement [ESTIMATED]

Per jet and per pass, the area that feels the stagnation footprint is a stripe about 2 d wide (4 mm) and the area inside the fast film is a stripe up to 2 R_j wide for near-normal incidence, shrinking to a few d for grazing incidence (section 4.7). For a dinner plate (250 mm, about 490 cm^2 per face) crossed by two grazing tracks of 200 mm, the stagnation stripes cover about 3 percent of the face and the fast-film stripes about 5 to 15 percent. Because the arm geometry is deterministic, the same stripes are hit every revolution. The remaining 85 to 95 percent of the surface is reached only by draining films, splatter and droplets. This is consistent with the thesis' conclusion that the low, homogeneous velocities in crockery regions "suggested a small coverage from the high velocity water films (before film jump)" [VERIFIED statement].

### 9.3 CFD and particle simulations of dishwashers

- The thesis' CFD of the empty tub applied Bernoulli at the nozzle exits and matched PEPT ejection velocities (7.24 versus 7.69 m/s) [VERIFIED].
- CFD Support (OpenFOAM): interFoam-based VOF solver with two superposed rotations, dynamic mesh refinement and a modified cyclicAMI; no quantitative results or validation published on the page [VERIFIED].
- FIFTY2 PreonLab (SPH): evaluates "wetting time" (time each surface point has been in contact with liquid) and shear-force sensors on dishware, cup-base puddles, and a conjugate-heat-transfer case with 60 C jets on 20 C dishware; states that "simulating for only a single full rotation of the spray arm might suffice" for nozzle-placement studies; no particle counts, run times or validation given [VERIFIED].
- A patent on sink-type dishwashers describes a two-stage workflow: a VOF run to obtain arm speed and per-nozzle flow, then a rotating-nozzle run for wash pressure [VERIFIED, search summary only].
- A CFD-forum thread quotes jet velocities "around 5-10 m/s" for a dishwasher model [VERIFIED, search summary; low reliability].

No published dishwasher simulation was found that resolves the impingement film or validates wall shear.

---

## 10. Evidence on the architecture candidates

(a) Hybrid multi-scale (lumped hydraulics, Lagrangian jet and droplet parcels, thin-film solver, per-element soil model, time-homogenised forcing). Evidence for:

- Jets are discrete, straight and repeatable; a ray or parcel description reproduces PEPT trajectories to within 1 to 2 mm, and the published geometric jet model already predicts which jets hit which item [VERIFIED].
- The impingement region has validated closed-form solutions with no fitted constants for h, U and tau_w, and three independent models agree on the RFZ radius to within 8 percent (sections 4.4, 4.5).
- The scales that set the wall stress are tiny: boundary layer 10 to 50 micrometres, film 50 to 200 micrometres, footprint 2 mm, inside a 0.5 m tub. They can be evaluated analytically at any surface point at negligible cost, but cannot be resolved by a tub-scale simulation (next item).
- The forcing is periodic (1.7 to 2 s per revolution), so stress and wetting statistics per surface element can be accumulated over one revolution per arm phase and reused for the whole wash phase.
- Industrial jet-cleaning models (Wilson group) are built exactly this way: film hydrodynamics from correlations plus a local removal law, with splatter handled by an effective flow rate Q (1 - S) [VERIFIED].

Evidence against, or risks: the closed forms assume a steady jet on a flat, static, initially dry wall. Dishwasher reality is a sweeping footprint (section 4.9), pre-wetted and curved surfaces, wires and edges, and partly broken jets; the corrections for these are estimates. Splatter, the main source of indirect wetting, is uncertain by a factor of several.

(b) Fully resolved free-surface simulation of the tub. Evidence against, as the primary method [ESTIMATED]:

- Resolving a 2 mm jet needs spacing of about 0.25 mm (d/8). The tub volume (0.15 m^3) would need about 1e10 cells; a particle method that only fills the liquid (about 1 percent of the volume airborne or on surfaces) still needs of order 1e8 particles.
- With weakly compressible SPH at 0.25 mm and a numerical sound speed of 10 V, the time step is about 3e-6 s, so one 1.7 s revolution is about 5e5 steps, or 5e13 particle-updates; at an optimistic 1e8 to 1e9 particle-updates per second on the target GPU that is 15 to 150 hours for one revolution, against a 30 minute budget for a whole cycle with hundreds to thousands of revolutions. (The "numerics" dossier should replace these throughput guesses with measured figures.)
- Even at that resolution the film (70 micrometres) and boundary layer (25 micrometres) are 3 to 10 times below the particle size, so wall shear would still come from a sub-grid wall model, i.e. from the correlations of section 4. Published SPH dishwasher simulations simulate about one revolution and report wetting time and coarse shear sensors without validation [VERIFIED].

Evidence for: it handles geometry-specific events (wires, rims, vessel interiors, bridging between items, splash redistribution) without bespoke sub-models, and gives the airborne droplet field directly.

(c) Mixture. Recommended reading of the evidence: use (a) for all jet-to-wall physics in the wash loop, and use resolved simulation offline, on small domains, to build and tune the sub-models that the literature cannot supply: jet on wire and rim (section 7), jet entering a cup or bowl (section 8), sweeping-footprint film development at v_s = 0.5 to 5 m/s (section 4.9), and splatter redistribution kernels. A local domain of 60 mm with 50 micrometre resolution around one impingement event for 50 ms is affordable offline and could also serve as a regression test for the analytic chain. A coarse particle simulation of the tub (2 to 3 mm particles) could be considered for the slow gravity-driven part (drainage, dripping, pooling), which is the "films" dossier's territory.

---

## Known gaps (read before trusting the defaults)

1. Nozzle state of real moulded spray-arm nozzles: C_d, C_c, turbulence intensity, break-up constant C_b. No dishwasher-specific measurements found.
2. Splatter fraction at dishwasher conditions, and its dependence on incidence angle, wall wetness and temperature (two conflicting data families).
3. Film development under a footprint sweeping at 0.5 to 5 m/s, especially at grazing incidence on pre-wetted plates.
4. Pressure and shear distribution under oblique jets below 30 deg.
5. Jets and droplets on wires, rims and tines; flow inside inverted vessels.
6. Wall shear under mm-scale droplet impact at 1 to 10 m/s, and the cleaning efficiency of droplet trains relative to coherent jets.
7. Constants recalled but not re-opened: Grant and Middleman turbulent break-up length; Sallam, Dai and Faeth break-up lengths; Cossali thin-film threshold constants; O'Rourke and Amsden splash energy formula; Yarin and Weiss drop-train threshold; Homann constant 1.312; Schiller-Naumann drag; Lichtarowicz discharge coefficients; plane-jet stagnation gradient.
8. Aeration: if the pump ingests air (low sump level, foam), jets are bubbly, less dense and break up early. Nothing was found on this; flagged for the "machine" and "chemistry" dossiers.
9. Air motion inside the tub and its effect on fine droplets.

---

## 11. Recommended model and defaults

This is exactly what I would implement for the nozzle-to-wall stage. It is a Lagrangian ray and parcel model whose wall interaction is evaluated from closed-form film solutions; it produces (i) per-surface-element stress and wetting statistics for the soil model, (ii) mass and momentum sources for the thin-film solver, (iii) airborne droplet parcels, (iv) forces on items.

### 11.1 Inputs

- From "machine": per arm, the angular speed Omega(t) and supply head or per-nozzle flow; per nozzle, the position p_i, aim n_i (eq. 2.2), orifice diameter d_n, type (thin-wall, rounded, short tube, slot).
- From "chemistry": liquor temperature, rho, mu; gamma_water(T) and equilibrium gamma.
- From "items" and the rigid-body stage: triangulated geometry of items, racks and tub with a feature tag (smooth face, wire or tine of width D_w, sharp edge or rim).
- From "films": current residual film thickness h_res per surface element (for wet/dry decisions).

### 11.2 Sub-model chain

Step 1, nozzle.

    V_rel = C_v sqrt( 2 dp / rho )        (or V_rel = Q_i / (C_c A_n) if Q_i is prescribed)
    d     = d_n sqrt( C_c ),  C_c = C_d / C_v,  Q = pi d^2 V_rel / 4
    Re = V_rel d / nu,  We = rho V_rel^2 d / gamma_water,  nozzle state (Tu, C_b)

Step 2, launch and flight. For each arm angle step (0.25 deg default) and each nozzle, emit a bundle of N_ray = 7 sub-rays (centre plus six at 0.74 r0, equal flow weights) with lab-frame velocity from eq. (2.3). Trace ballistically (eq. 2.4, gravity only) to the first intersection with geometry; record flight distance s, time of flight, impact velocity u_imp and the hit feature.

Step 3, state on arrival.

    L_b from eq. (3.1); coherent probability f_c(s) from eq. (3.2)
    surface-shed fraction f_sh = clamp( 0.05 (s - x_i) / L_b , 0 , 0.1 ),  x_i = 13 d (Tu^3 We)^(-0.915)
    droplets from core break-up: D log-normal, median 1.9 d, geometric std 1.3; shed droplets: D_32 = 0.649 d (Tu^2 We)^(-0.657)
    droplets are created at the sampled break-up location with the jet velocity and then follow eqs. (3.3), (3.4)

Step 4, classify the hit. Feature width below 3 d (wire, tine, rim, edge): section 7.3 rules. Otherwise wall impact: sub-rays of one nozzle landing on the same smooth face are merged into one footprint with flow Q_hit = (number of sub-rays hitting / N_ray) Q, centroid O, incidence phi = asin( |u_imp . n_w| / |u_imp| ), forward direction e_t = unit vector of u_imp - (u_imp . n_w) n_w, source point S = O - r0 cot(phi) e_t, and footprint velocity v_s from the displacement of O between consecutive arm steps (or eq. 2.5).

Step 5, coherent-jet wall impact (probability f_c).

    5a  splatter:   xi from eq. (5.4);  droplet parcels emitted per section 5.6;  film flow Q_film = Q_hit (1 - xi)
    5b  pressure:   p_w = p_s sin^2(phi) sech^2( 0.916 X + 0.95 X^3 ),  X = sqrt( (x_f sin(phi))^2 + x_l^2 ) / d
                    (x_f, x_l = forward and lateral wall coordinates from O)
    5c  shear and film along each ray psi about S:
          q(psi) from eq. (3.22) scaled by Q_hit / Q;  d_eq = sqrt(8 q / V),  Re_eq = V d_eq / nu,  r_e(psi) from eq. (3.21)
          r <= r_e + 0.05 d_eq :  tau_w = k_stag 1.150 rho (V sin(phi))^2 Re_n^(-1/2) (X),  Re_n = V sin(phi) d / nu, capped by the next line
          r_e < r < r_b :         tau_w = k_film 0.472 rho V^2 Re_eq^(-1/2) (r / d_eq)^(-1/2);  h, U_av from eq. (3.8)
          r_b < r < r_t :         eqs. (3.11), (3.12) with d_eq, Re_eq
          r > r_t :               eqs. (3.13) to (3.15) with d_eq, Re_eq;  beyond r_s = 4.5 d_eq use q (1 - xi)
          direction of tau_w: radially away from S
          outer limit r_lim(psi) = min( R_j(psi) from eq. (3.17) with Q_eq = 2 pi q (1 - xi),
                                        r*(psi) where U_av = v_s . e_r for rays with a forward component (eq. 3.24),
                                        distance to the nearest edge of the face )
    5d  exposure:   for every surface element whose distance from the footprint track is below max r_lim, accumulate along the
                    track segment (analytically, eq. 3.25, not by point sampling):
                    p_max, integral p dt, tau_max, integral tau dt, time with tau above {10, 30, 100, 300} Pa,
                    M_max and integral M dt with M = rho U_av^2 h (momentum flux per unit width, for peeling-type soil laws),
                    wet time, mean shear direction
    5e  film hand-over ("films" dossier): along the curve r_lim(psi), a line source of volume flux q(psi)(1 - xi) per radian with
                    speed U_av(r_lim) directed radially; inside it, the fast film thickness h(r, psi) for wetting and heat transfer
    5f  force on the item: F_n = rho Q_hit V sin(phi) along -n_w at O;  F_t = c_t rho Q_hit V cos(phi) along e_t,  c_t = 0.2

Step 6, droplet wall impact (probability 1 - f_c for jet-fragment drops, and all shed, splattered, fan and secondary droplets).

    We_n = rho V_n^2 D / gamma_water,  La = rho gamma_water D / mu^2,  wall wet if h_res > 20 micrometres
    wet:  We_n < 2 stick;  2 to 20 rebound (e from 6.3, tangential 5/7);  20 to 1,320 La^(-0.183) deposit;  above: splash
    dry:  We_n < 2,630 La^(-0.183) deposit (use K = We sqrt(Re) < 3,000 instead on smooth clean glass or glaze);  above: splash
    splash:  r_m = clamp( 0.1 (We_n / We_c - 1) , 0 , 0.3 )  (0.5 if h_res > 0.1 D);  secondaries per section 6.4;  no second generation
    deposited mass: point source to the film solver at the impact element with the droplet's tangential momentum
    stress pulse on elements within 0.5 beta_max D, beta_max = 0.61 (Re_n^2 Oh)^(1/6):
          p = rho V_n^2 / 2 for D / V_n;   tau = k_drop 0.63 rho V_n^2 Re_n^(-1/2) for 2 D / V_n

Step 7, time homogenisation. Accumulate step 5d and step 6 statistics per surface element over one arm revolution per distinct forcing state (which arms are active, pump speed). Multiply by the number of revolutions in that state. Recompute only when the geometry changes (an item moved by jet forces) or the forcing state changes. Stochastic elements (break-up location, splatter and splash droplets) use fixed seeds per revolution and are averaged over 4 to 8 revolutions.

### 11.3 Default constants

| Quantity | Default | Range | Basis |
|---|---|---|---|
| Discharge coefficient C_d (moulded thin wall) | 0.70 | 0.60 to 0.90 | section 2.2 [ESTIMATED] |
| Velocity coefficient C_v | 0.97 | 0.95 to 0.99 | [RECALLED] |
| Cross-flow exit-angle factor eta_x | 0 | 0 to 1 | eq. (2.1) [ESTIMATED] |
| Stagnation gradient B | 1.831 | 1.83 to 3.6 (only within 5 d of the nozzle) | [VERIFIED] Lienhard 2006 |
| Nozzle turbulence intensity Tu | 0.05 | 0.03 to 0.12 | [VERIFIED] pipe value; [ESTIMATED] range |
| Break-up constant C_b in eq. (3.1) | 6 | 3.3 to 12 | [VERIFIED] bounds, [ESTIMATED] default |
| Break-up window in eq. (3.2) | 0.6 to 1.4 L_b | +/- 0.2 on each end | [ESTIMATED] |
| Core-break-up drop size | 1.9 d, geometric std 1.3 | 1.5 to 2.2 d | [ESTIMATED] from [VERIFIED] wavelength |
| Air drag on coherent jet | none | - | [ESTIMATED] |
| Droplet drag | Schiller-Naumann, still air | - | [RECALLED] |
| Pressure footprint | eq. (3.6), peak p_s sin^2(phi) | exponent 1 to 2 | [ESTIMATED] from [VERIFIED] series |
| Stagnation shear constant | 1.150 rho V^2 Re^(-1/2) (r/d), peak 0.63 at 0.55 d | k_stag 1.0 to 2.8 | eq. (3.7) [ESTIMATED] from [VERIFIED] B and [RECALLED] Homann constant |
| Radial film | Bhagat and Wilson 2016, eqs. (3.8) to (3.16) | k_film 0.7 to 2 | [VERIFIED] |
| RFZ radius constant in eq. (3.17) | 0.289 | 0.25 to 0.32 | [VERIFIED] 0.276, 0.289, 0.3025 from three sources |
| Surface tension for jets, splatter, RFZ | gamma_water(T) | 0.6 to 1.0 of it | [VERIFIED] basis, section 4.5 |
| Oblique flow split | eq. (3.22) | - | [VERIFIED] |
| Splatter | eq. (5.4), k_S = 0.5 | k_S 0 to 1 | [ESTIMATED] synthesis of [VERIFIED] data |
| Splatter droplets | leave at 4.5 d_eq, 20 deg above wall (10 to 30), speed 0.7 V (0.4 to 0.9), median 0.08 d, geometric std 1.8 | median 0.03 to 0.15 d | [VERIFIED] ranges, [ESTIMATED] distribution |
| Wet-wall threshold film thickness | 20 micrometres | 5 to 100 | [ESTIMATED] |
| Droplet splash thresholds | A_wet = 1,320, A_dry = 2,630, exponent -0.183 on La; K = 3,000 on smooth dry | A_dry 1,300 to 5,200 | [VERIFIED] OpenFOAM, Josserand and Thoroddsen |
| Splash mass ratio r_m | 0.1 (We/We_c - 1), max 0.3 (0.5 on thick film) | max 0.14 to 0.8 | [ESTIMATED] between [VERIFIED] Zhou data and Bai-Gosman |
| Secondary droplets | median 0.08 D, geometric std 1.8; 10 to 40 deg above wall; 0.3 to 1.2 V_n | - | [ESTIMATED] from [VERIFIED] Zhou ranges |
| Droplet-train stress efficiency k_drop | 0.7 | 0.3 to 1.5 | [ESTIMATED] |
| Wire fan: theta_sep, spreads, speed, drop size, retained fraction | 40 deg; +/- 20 and +/- 15 deg; 0.8 V; 0.25 d; 0.05 | see section 7.3 | [ESTIMATED] |
| Edge shedding threshold | M > 2 gamma | 1 to 4 gamma | [VERIFIED] Taylor criterion as quoted by Button et al.; application [ESTIMATED] |
| Tangential force coefficient c_t | 0.2 | 0.1 to 0.4 | [ESTIMATED] from film momentum loss in section 4.4 |
| Sub-rays per jet, arm step | 7; 0.25 deg | 7 or 19; 0.1 to 0.5 deg | [ESTIMATED] |

### 11.4 Worked example (J2-8 at 50 C, normal incidence, footprint sweeping at 1 m/s, 35 rpm)

[ESTIMATED] A surface element on the track sees, per pass: stagnation pressure up to 31.6 kPa for about 2 ms; peak wall shear 236 Pa; shear above 100 Pa for about 12 ms and above 30 Pa for about 45 ms; stress-time integral 4.3 Pa s; fast film present for about 60 to 80 ms (21 mm lead plus up to 41 mm wake); then drainage. An element 20 mm off the track sees no stagnation pressure, peak shear 52 Pa and 1.6 Pa s. Over a 30 minute main wash (1,050 revolutions) the on-track element accumulates about 4,500 Pa s of shear exposure and about 2 s of stagnation pressure. With splatter at the default (S_W = 0.18 for V d / nu_20 = 15,900, so xi = 0.09), about 2.3 mL/s per jet becomes airborne droplets of about 0.16 mm. The jet pushes on the item with 0.20 N.

### 11.5 Cost

[ESTIMATED] About 30 nozzles x 1,440 arm steps x 7 sub-rays = 3e5 primary rays per revolution, plus of order 1e6 to 1e7 droplet parcels; the wall evaluation is closed-form with precomputed one-dimensional tables for the track integrals. This is seconds of GPU time per revolution state, leaving essentially the whole 30 minute budget for the film solver and soil integration.

---

## 12. Calibration parameters

What future real-world tests should measure, in priority order. Ranges are the expected outcomes.

| # | Parameter | Default | Expected range | How to measure |
|---|---|---|---|---|
| 1 | Jet speed and flow per nozzle (C_d, C_v, C_c) | C_d 0.70, C_v 0.97 | V 4 to 12 m/s; C_d 0.6 to 0.9 | catch-and-weigh per nozzle against arm pressure; jet diameter and speed by high-speed imaging or PIV; compare with PEPT mean 7.7 m/s |
| 2 | Break-up constant C_b and its scatter; onset of surface roughness | 6 | 3.3 to 12 | high-speed shadowgraphy of single jets from a production arm (rotating and stationary) at 50 to 500 mm; record break-up length distribution, drop sizes |
| 3 | Splatter fraction xi (k_S), including temperature, detergent, incidence angle and wall wetness | k_S 0.5 | xi 0 to 0.4 | collect film run-off versus delivered flow for a single nozzle at 20 and 55 C, phi = 90, 45, 15 deg, dry and pre-wetted glass and ceramic; repeat with detergent |
| 4 | Splatter droplet size, speed, angle | 0.08 d, 0.7 V, 20 deg | 0.03 to 0.15 d; 0.4 to 0.9 V; 10 to 30 deg | shadow imaging or phase-Doppler near the impact point |
| 5 | Sweeping-footprint film: lead distance, wake width, effect of residual film | eq. (3.24), no pre-wet correction | a_lead within a factor 2; pre-wet factor 0.5 to 1 | high-speed imaging (dye or fluorescence) of a jet swept at 0.5, 1, 2, 5 m/s across dry and wet plates at phi = 90 and 15 deg |
| 6 | Wall shear and pressure under the footprint: k_stag, k_film, oblique pressure exponent | 1, 1, 2 | 1 to 2.8; 0.7 to 2; 1 to 2 | flush-mounted pressure taps and hot-film or electrochemical shear probes on a plate; or back-calibration from removal of a reference soil with a known threshold |
| 7 | RFZ radius constant and effective surface tension | 0.289, gamma_water | 0.25 to 0.32; 0.6 to 1.0 gamma_water | static-jet film-jump radius on vertical and overhead plates with wash liquor at temperature |
| 8 | Droplet-train efficiency k_drop | 0.7 | 0.3 to 1.5 | cleaning-rate comparison of the same nozzle at stand-offs below and beyond L_b |
| 9 | Droplet splash: thresholds and splashed mass ratio for 1 to 4 mm drops at 1 to 8 m/s on dry, wet and soiled tableware | A_wet 1,320; r_m max 0.3 | A 700 to 5,000; r_m max 0.1 to 0.8 | drop-on-demand tests with high-speed imaging and weighing |
| 10 | Wire and rim interaction: pass fraction, fan angles, drop sizes, retained fraction, shadow | section 7.3 | each within a factor 2 to 3 | jet traversed across a rack wire and a plate rim; imaging plus patternator behind the wire |
| 11 | Inverted-vessel interior: wetted-area map versus nozzle offset; curtain or attached film | section 8.2 | - | transparent cup, glass and bowl over a single traversing nozzle; fluorescence wetting maps |
| 12 | Nozzle exit direction correction and its dependence on pump speed | 0 deg | 0 to 10 deg | imaging of jet angle versus pump speed |
| 13 | Fan or slot nozzle representation: sheet break-up distance, drop size | 5 to 9 sub-jets | break-up 50 to 150 mm | imaging |
| 14 | Force on items (c_t, and normal force) | c_t 0.2 | 0.1 to 0.4 | load cell under a plate or cup struck by a single jet |
| 15 | Tub-scale validation: per-item direct-impingement duty and stripe locations | - | time fractions 0.05 to 5 percent | repeat of the thesis' tile experiment with pressure-sensitive or soil-coated tiles at several rack positions |
| 16 | Aeration of jets, air motion in the tub | none | unknown | void-fraction probe at the arm inlet; smoke or fine-mist visualisation |

---

## 13. Sources

Opened and read this session (text extracted from the PDF or page; quotations and equations above come from these):

1. Bhagat, R.K. and Wilson, D.I. (2016). Flow in the thin film created by a coherent turbulent water jet impinging on a vertical wall. Chem. Eng. Sci. 152, 606-623. Accepted manuscript: https://www.repository.cam.ac.uk/handle/1810/256605 (PDF https://www.repository.cam.ac.uk/bitstream/1810/256605/1/Bhagat_et_al-2016-Chemical_Engineering_Science-AM.pdf). Equations 23 to 79, sections 2 to 4.
2. Bhagat, R.K., Jha, N.K., Linden, P.F. and Wilson, D.I. (2018). On the origin of the circular hydraulic jump in a thin liquid film. J. Fluid Mech. 851, R5. Preprint: https://arxiv.org/pdf/1712.04255
3. Aouad, W., Landel, J.R., Dalziel, S.B., Davidson, J.F. and Wilson, D.I. Particle image velocimetry and modelling of horizontal coherent liquid jets impinging on and draining down a vertical wall. Preprint: https://arxiv.org/pdf/2407.14555
4. Chee, M.W.L., Ahuja, T.V., Bhagat, R.K., Taesopapong, N., Wan, S.A., Wigmore, R.L. and Wilson, D.I. Impinging jet cleaning of tank walls: effect of jet length, wall curvature and related phenomena. Food and Bioproducts Processing (accepted manuscript): https://www.repository.cam.ac.uk/handle/1810/286347 . Source for the Wilson et al. (2012) jump formula, the Wang et al. (2013) splatter data and the Feldung Damkjaer et al. (2017) findings as quoted.
5. Glover, H.W. et al. (2016). Cleaning of complex soil layers on vertical walls by fixed and moving impinging liquid jets. J. Food Eng. 178. Accepted manuscript: https://www.repository.cam.ac.uk/handle/1810/253141
6. Bhagat, R.K., Perera, A.M. and Wilson, D.I. (2017). Cleaning vessel walls by moving water jets: simple models and supporting experiments. Food and Bioproducts Processing 102. Accepted manuscript: https://www.repository.cam.ac.uk/handle/1810/262542 (equations did not survive text extraction; prose used).
7. Wilson, D.I. et al. (2014). Cleaning of soft-solid soil layers on vertical and horizontal surfaces by stationary coherent impinging liquid jets. Chem. Eng. Sci. 109. Accepted manuscript: https://www.repository.cam.ac.uk/handle/1810/245880 (prose only).
8. Perez-Mohedano, R. (2016). Cleaning principles in automatic dishwashers. EngD thesis, University of Birmingham. https://etheses.bham.ac.uk/id/eprint/6590/ (PDF http://etheses.bham.ac.uk//id/eprint/6590/9/PerezMohedano16EngD_sizereduced.pdf). Chapters 2 to 5 and 7.
9. Lienhard V, J.H. (2006). Heat transfer by impingement of circular free-surface liquid jets. 18th National and 7th ISHMT-ASME Heat and Mass Transfer Conference. http://web.mit.edu/lienhard/www/papers/conf/LIENHARD-Jets-ISHMT-2006.pdf
10. Lienhard V, J.H., Liu, X. and Gabour, L.A. (1992). Splattering and heat transfer during impingement of a turbulent liquid jet. J. Heat Transfer 114, 362-372. http://web.mit.edu/lienhard/www/papers//journal/Splattering_and_Heat_Transfer_During_Impingement_of_a_Turbulent_Liquid%20Jet.pdf
11. Bhunia, S.K. and Lienhard V, J.H. (1994a). Splattering during turbulent liquid jet impingement on solid targets. J. Fluids Eng. 116, 338-344. http://web.mit.edu/lienhard/www/splattering_during_turbulent_liquid_jet_impingement.pdf
12. Bhunia, S.K. and Lienhard V, J.H. (1994b). Surface disturbance evolution and the splattering of turbulent liquid jets. J. Fluids Eng. 116, 721-727. http://web.mit.edu/lienhard/www/surface_disturbance_evolution_turbulent_liquid_jets.pdf
13. Lienhard, J.H. and Day, J.B. (1970). The breakup of superheated liquid jets. J. Basic Eng. 92, 515-521. https://engines.egr.uh.edu/sites/engines/files/files/TheBreakupOfSuperheatedJets.pdf (cold-water break-up from sharp-edged orifices; Weber and Miesse formulas).
14. Trettel, B. (2020). Reevaluating the jet breakup regime diagram. Preprint for Atomization and Sprays 30. https://engrxiv.org/nqhs5 (PDF https://engrxiv.org/preprint/download/740/version/1128/1657/1115). Equations 12 to 26.
15. Faeth, G.M. (2002). Dynamics of secondary drop breakup: a rate controlling process in dense sprays. ILASS-Europe 2002. https://ilasseurope.org/ICLASS/ilass2002/papers/201.pdf
16. Phares, D.J., Smedley, G.T. and Flagan, R.C. (2000). The wall shear stress produced by the normal impingement of a jet on a flat surface. J. Fluid Mech. 418, 351-375. https://authors.library.caltech.edu/records/spw2r-3pe55 (equations 2.32, 2.33, 2.37, 3.1, 3.2).
17. OpenFOAM-8 source, ThermoSurfaceFilm.C and ThermoSurfaceFilm.H (Bai-Gosman splash model implementation). https://github.com/OpenFOAM/OpenFOAM-8/tree/master/src/lagrangian/intermediate/submodels/Thermodynamic/SurfaceFilmModel/ThermoSurfaceFilm
18. Josserand, C. and Thoroddsen, S.T. (2016). Drop impact on a solid surface. Annu. Rev. Fluid Mech. 48, 365-391. https://yakari.polytechnique.fr/people/josserand/papier/annrev.pdf
19. Riboux, G. and Gordillo, J.M. (2014). The critical impact speed for the splash of a drop. https://arxiv.org/pdf/1401.6943
20. Rajendran, S., Jog, M.A. and Manglik, R.M. Predicting splash of a drop impacting a thin liquid film. https://arxiv.org/pdf/2310.02526 (source for the form of the Cossali, Rioboo, Vander Wal thresholds).
21. Zhou, X. (2012). Experimental measurements of a liquid droplet impinging on a corrugated cardboard surface. ICLASS 2012. https://www.ilasseurope.org/ICLASS/iclass2012_Heidelberg/Contributions/Paper-pdfs/Contribution1217_b.pdf
22. Jameson, G.J., Jenkins, C.E., Button, E.C. and Sader, J.E. (2010). Water bells formed on the underside of a horizontal plate. Part 1. Experimental investigation. J. Fluid Mech. 649, 19-43. https://authors.library.caltech.edu/records/rjpc6-2sj62
23. Button, E.C., Davidson, J.F., Jameson, G.J. and Sader, J.E. (2010). Water bells formed on the underside of a horizontal plate. Part 2. Theory. J. Fluid Mech. 649, 45-68. https://authors.library.caltech.edu/records/scm2h-r6541
24. Mohd, J., Yadav, A. and Das, D. (2024). Classifications and scaling of generic shaped, steady and unsteady water bells formed by a jet impinging onto a vial. J. Fluid Mech. 999, A96. https://doi.org/10.1017/jfm.2024.928 (abstract and introduction).
25. Nausin, M., Seerwani, M. and Alam, M.M. (2023). Influence of surface curvature on Coanda effect for vertical jet impacting horizontal cylinder. J. Applied Fluid Mechanics 16(4), 717-723. https://www.jafmonline.net/article_2175_77325f57a6ef1d16d1a66e5a69fcaa7f.pdf
26. O'Rourke, P.J. and Amsden, A.A. (1996). A particle numerical model for wall film dynamics in port-injected engines. Los Alamos report submitted to the SAE Fuels and Lubricants Meeting, October 1996. https://digital.library.unt.edu/ark:/67531/metadc687967/ (confirms that this 1996 model has no splash sub-model).
27. Ansys Forte Theory Manual, section 6.6.1, Mass fraction of secondary droplets. https://ansyshelp.ansys.com/public/Views/Secured/corp/v242/en/forte_th/pgfId-1139266.html (text only; the equation is an image).
28. FIFTY2 Technology, Dishwasher simulation in PreonLab. https://www.fifty2.eu/innovation/dishwasher-simulation-in-preonlab/
29. CFD Support, Dishwasher OpenFOAM study. https://www.cfdsupport.com/dishwasher-openfoam-study/
30. Wikipedia, Vena contracta (C_c = 0.611). https://en.wikipedia.org/wiki/Vena_contracta ; Plateau-Rayleigh instability (lambda = 9.02 a). https://en.wikipedia.org/wiki/Plateau%E2%80%93Rayleigh_instability

Seen only through search-result summaries or abstracts (treat as pointers):

31. Perez-Mohedano, R., Letzelter, N., Amador, C., VanderRoest, C.T. and Bakalis, S. (2015). Positron Emission Particle Tracking (PEPT) for the analysis of water motion in a domestic dishwasher. Chem. Eng. J. 259, 724-736. https://research.birmingham.ac.uk/en/publications/positron-emission-particle-tracking-pept-for-the-analysis-of-wate
32. Wilson, D.I., Kohler, H., Cai, L., Majschak, J.-P. and Davidson, J.F. (2015). Cleaning of a model food soil from horizontal plates by a moving vertical water jet. Chem. Eng. Sci. 123, 450-459. Abstract via https://core.ac.uk/works/24692539
33. Jambon-Puillet, E. et al. (2019). Study of capillary jets clinging to and coiling around vertical cylinders (exact title not checked). Phys. Rev. Lett. 122, 184501. Synopsis: https://physics.aps.org/synopsis-for/10.1103/PhysRevLett.122.184501
34. Keshavarz, B., Green, S.I., Davy, M.H. and Eadie, D.T. (2011). Newtonian liquid jet impaction on a high-speed moving surface. Int. J. Heat Fluid Flow. Summary via https://pure.uj.ac.za/en/publications/investigation-of-newtonian-liquid-jets-impacting-on-a-moving-smoo/ and UBC theses at https://open.library.ubc.ca/collections/24/items/1.0072835 (blocked when fetched).
35. US 8,905,053 B2, Variable speed and multi-angle nozzle spray arm assembly for a dishwasher. https://patents.google.com/patent/US8905053B2/en (no numerical data).

Cited from memory or through the secondary sources above; not opened this session (all values taken from them are tagged [RECALLED] or attributed to the quoting source):

36. Watson, E.J. (1964). The radial spread of a liquid jet over a horizontal plane. J. Fluid Mech. 20, 481-499.
37. Azuma, T. and Hoshino, T. (1984). The radial flow of a thin liquid film, parts 1 to 4. Bull. JSME 27.
38. Liu, X., Lienhard V, J.H. and Lombara, J.S. (1991). Convective heat transfer by impingement of circular liquid jets. J. Heat Transfer 113, 571-582; Liu, Gabour and Lienhard (1993). Stagnation-point heat transfer during impingement of laminar liquid jets. J. Heat Transfer 115, 99-105.
39. Wilson, D.I., Le, B.L., Dao, H.D.A., Lai, K.Y., Morison, K.R. and Davidson, J.F. (2012). Surface flow and drainage films created by horizontal impinging liquid jets. Chem. Eng. Sci. 68, 449-460.
40. Wang, T., Davidson, J.F. and Wilson, D.I. (2013). Effect of surfactant on flow patterns and draining films created by a static horizontal liquid jet impinging on a vertical surface at low flow rates. Chem. Eng. Sci. 88; Wang, T., Faria, D., Stevens, L.J., Tan, J.S.C., Davidson, J.F. and Wilson, D.I. (2013). Flow patterns and draining films created by horizontal and inclined coherent water jets impinging on vertical walls. Chem. Eng. Sci. 102, 585-601.
41. Kate, R.P., Das, P.K. and Chakraborty, S. (2007). Hydraulic jumps due to oblique impingement of circular liquid jets on a flat horizontal surface. J. Fluid Mech. 573, 247-263.
42. Beltaos, S. and Rajaratnam, N. (1974). Impinging circular turbulent jets. J. Hydraulics Div. ASCE 100, 1313-1328.
43. Grant, R.P. and Middleman, S. (1966). Newtonian jet stability. AIChE J. 12, 669-678.
44. Sallam, K.A., Dai, Z. and Faeth, G.M. (2002). Liquid breakup at the surface of turbulent round liquid jets in still gases. Int. J. Multiphase Flow 28, 427-449. (Repository copy of the related AIAA paper: http://deepblue.lib.umich.edu/bitstream/2027.42/76929/1/AIAA-2002-1115-390.pdf, download blocked.)
45. Mundo, C., Sommerfeld, M. and Tropea, C. (1995). Droplet-wall collisions: experimental studies of the deformation and breakup process. Int. J. Multiphase Flow 21, 151-173.
46. Bai, C. and Gosman, A.D. (1995). Development of methodology for spray impingement simulation. SAE 950283; Bai, C.X., Rusche, H. and Gosman, A.D. (2002). Modeling of gasoline spray impingement. Atomization and Sprays 12, 1-27.
47. Stanton, D.W. and Rutland, C.J. (1996, 1998). Modeling fuel film formation and wall interaction in diesel engines. SAE 960628; SAE 980132.
48. Cossali, G.E., Coghe, A. and Marengo, M. (1997). The impact of a single drop on a wetted solid surface. Exp. Fluids 22, 463-472.
49. Yarin, A.L. and Weiss, D.A. (1995). Impact of drops on solid surfaces: self-similar capillary waves, and splashing as a new type of kinematic discontinuity. J. Fluid Mech. 283, 141-173; Yarin, A.L. (2006). Drop impact dynamics. Annu. Rev. Fluid Mech. 38, 159-192.
50. O'Rourke, P.J. and Amsden, A.A. (2000). A spray/wall interaction submodel for the KIVA-3 wall film model. SAE 2000-01-0271.
51. Lichtarowicz, A., Duggins, R.K. and Markland, E. (1965). Discharge coefficients for incompressible non-cavitating flow through long orifices. J. Mech. Eng. Sci. 7, 210-219.
52. Clanet, C. and Villermaux, E. (2002). Life of a smooth liquid sheet. J. Fluid Mech. 462, 307-340.
53. Gradeck, M., Kouachi, A., Dani, A., Arnoult, D. and Borean, J.L. (2006). Experimental and numerical study of the hydraulic jump of an impinging jet on a moving surface. Exp. Thermal Fluid Sci. 30, 193-201.
54. Stevens, J. and Webb, B.W. (1993). Measurements of flow structure in the radial layer of impinging free-surface liquid jets. Int. J. Heat Mass Transfer 36, 3751-3758.


