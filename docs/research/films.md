# Spotless research dossier: FILMS

Thin-film flow, wetting, drainage, dripping and pooling: everything that happens to water after it lands on a surface until it leaves it.

Specialist: films. Date: 2026-10-08. Sibling topics referenced by name: machine, standards, jets, soils, chemistry, numerics, items, benchmark.

---

## 0. How to read this dossier

### 0.1 Confidence tags

Every quantitative value carries a source key `[S#]` (see section 14) and exactly one tag.

| Tag | Meaning in this dossier |
|---|---|
| `[VERIFIED]` | I read the value in the text of the source during this session (fetched page, or PDF downloaded and text-extracted locally). |
| `[RECALLED]` | From memory, or seen only in a search-engine result summary without opening the source itself. Where it is the latter, the entry says "search summary". |
| `[ESTIMATED]` | My own derivation or calculation. The derivation is shown or the inputs are named. |

Three limits on the research that the reader should know about:

1. No searches were run on (i) water carry-over between cycle phases, (ii) measured residual water mass per item after the final rinse, (iii) pool/cavity exchange coefficients, (iv) advancing/receding angles of water on melamine, SAN and copolyester. Those items are estimates and are listed as calibration parameters.
2. Several equations sit behind images or garbled PDF text (Ansys Fluent theory guide; El-Genk and Saber 2001; Wilson et al. 2012). Where I could re-derive the equation from verified ingredients I did, and say so.
3. Nothing here has been checked against a dishwasher experiment by me. One dishwasher-specific data source was read in full text (Pérez-Mohedano's Birmingham EngD thesis, `[S28]`).

### 0.2 Notation and sign conventions (SI units throughout)

| Symbol | Meaning | Unit |
|---|---|---|
| `x_s` | point on the item surface | m |
| `n` | unit normal of the item surface pointing from the solid into the liquid/gas | - |
| `h` | film thickness measured along `n` | m |
| `u` | depth-averaged tangential film velocity (2-vector in the tangent plane) | m/s |
| `q = h u` | volume flux per unit width | m²/s |
| `Γ = ρ |q|` | mass flow rate per unit width | kg/(m s) |
| `g` | gravity vector, `|g| = 9.81` | m/s² |
| `g_t = g − (g·n) n` | tangential gravity | m/s² |
| `G_n = −g·n` | normal gravity pressing the film onto the wall: `> 0` on upward-facing surfaces, `< 0` on undersides | m/s² |
| `β` | inclination of the surface from horizontal (`β = 90°` is vertical); `|g_t| = g sin β` | rad |
| `ρ, μ, ν = μ/ρ, σ` | liquid density, dynamic and kinematic viscosity, surface tension | kg/m³, Pa s, m²/s, N/m |
| `l_c = sqrt(σ/(ρ g))` | capillary length | m |
| `θ_a, θ_r, θ_e` | advancing, receding, equilibrium contact angle | rad or deg |
| `κ_s` | substrate mean curvature (sum of principal curvatures), positive where the surface is concave seen from the liquid (inside of a bowl), negative on convex surfaces (rims) | 1/m |
| `Re = 4Γ/μ` | film Reynolds number used in this dossier unless stated. Other conventions in the literature: `Re_Γ = Γ/μ = Re/4`; Hu and Jacobi use `2Γ/μ` | - |
| `We = ρ u² h/σ` | film Weber number | - |
| `Ka = ρ σ³/(μ⁴ g)` | Kapitza number in the form used by `[S40]` and (as "Ga") by Hu and Jacobi `[S22]` | - |
| `τ_w` | wall shear stress exerted by the film on the wall (and on the soil) | Pa |

---

## 1. Orientation: what regime are dishwasher films in?

### 1.1 Dishwasher-specific evidence

Pérez-Mohedano tracked a radioactive tracer particle through a running domestic dishwasher (positron emission particle tracking) `[S28]`:

- The water sequence is pump and spray arm, ejection as jets, impact on walls or crockery, "downfall" over crockery or walls or in free fall, and return to the sump. "The time scale of the process was typically less than 3 seconds" `[S28, section 4.2]` `[VERIFIED]`.
- "The 'downfall over plate' stage happened within tenths of a second" `[S28, section 4.2]` `[VERIFIED]`.
- With a load in place, downfall velocities over crockery were low and spatially homogeneous. The author concludes that "the distribution of shear stresses (mechanical energy input) over the crockery was low" and that "high velocity profile areas occurring before the film jump might had been very localised and spaced in time, thus they did not influence averaged results" `[S28, section 4.4.1]` `[VERIFIED]`.
- Pump speed changed ejection velocities but had no visible effect on the downfall stage `[S28, section 4.6.3]` `[VERIFIED]`. Detergent did not measurably change the flow field `[S28, section 4.4.1]` `[VERIFIED]`.
- Longest residence times were on the lower 100 mm of walls and at heights of 10 to 100 mm in the densely packed lower basket `[S28, section 4.4.2]` `[VERIFIED]`.
- If all water in flight or on surfaces were spread evenly over walls and crockery, the film would be 0.9 mm thick `[S28, section 3.4.2]` `[VERIFIED]`. This is the author's bounding estimate used for a Stokes-number check, not a measurement, and it over-states the film because much of that water is airborne.
- Typical lower-arm nozzle diameter 2 mm; mean velocity inside the spray arm 0.7 to 1.7 m/s depending on pump speed `[S28, sections 3.4.2 and 4.6.1]` `[VERIFIED]`.

The consequence for Spotless: most of the tableware area, most of the time, is wetted by gravity-driven film that drains in well under a second to a few seconds, punctuated by brief, local, high-shear wall-jet zones where a jet lands. The film model therefore sets the baseline shear, the wetted area and the chemical and thermal exposure of most of the soil.

### 1.2 Order-of-magnitude regime map

Machine-level inputs are the machine sibling's responsibility; the figures here are only to place the films in a regime. Take one active spray arm delivering about 25 L/min `[RECALLED]` over a 0.5 m by 0.5 m rack holding about 3 m² of item surface (both sides) `[ESTIMATED]`. The time-mean deposition is then about 0.14 kg/(m² s) of item area, and a 0.25 m tall plate accumulates `Γ ≈ 0.035 kg/(m s)` at its lower edge `[ESTIMATED: 0.42 kg/s ÷ 3 m² × 0.25 m]`. When a jet sweeps past, the instantaneous value is 5 to 20 times higher for a fraction of the arm period.

Nusselt-film values for water at 55 °C on a vertical wall (my calculation from section 3.1, properties from section 2.1) `[ESTIMATED]`:

| Γ, kg/(m s) | Re = 4Γ/μ | δ, µm | mean u, m/s | τ_w, Pa | film-to-wall heat transfer 1.88 k/δ, W/(m² K) | time to travel 0.25 m, s |
|---|---|---|---|---|---|---|
| 0.002 | 16 | 68 | 0.030 | 0.66 | 17,800 | 8.4 |
| 0.005 | 40 | 92 | 0.055 | 0.89 | 13,200 | 4.6 |
| 0.01 | 80 | 116 | 0.087 | 1.13 | 10,400 | 2.9 |
| 0.02 | 160 | 147 | 0.14 | 1.42 | 8,300 | 1.8 |
| 0.05 | 400 | 199 | 0.25 | 1.92 | 6,100 | 0.98 |
| 0.1 | 800 | 251 | 0.41 | 2.42 | 4,800 | 0.62 |
| 0.2 | 1,600 | 316 | 0.64 | 3.05 | 3,800 | 0.39 |
| 0.4 | 3,200 | 398 (turbulent correlation: 456) | 1.02 | 3.85 | 3,100 | 0.25 |
| 0.8 | 6,400 | 502 (turbulent correlation: 660) | 1.62 | 4.85 | 2,400 | 0.15 |

Reading the table against the dishwasher evidence:

- Films are 70 to 500 µm thick and move at 0.03 to 1.5 m/s. A plate drains in 0.2 to 5 s, which matches "tenths of a second" for the pulse that follows a jet pass `[S28]`.
- Gravity-driven wall shear stress is bounded: `τ_w = ρ g δ sin β` is 0.7 to 5 Pa over a 400-fold range of flow rate. No amount of extra film flow gives a gravity-driven film much more shear. High shear exists only where jet momentum has not yet been dissipated (section 3.6: 25 to 120 Pa within about 20 mm of a 2 mm, 6 m/s jet).
- The regime is laminar to wavy-laminar for the time-mean flow (`Re` 40 to 800) and transitional to turbulent only inside jet-pass pulses (`Re` above about 1,600).
- Film Weber numbers for gravity-driven films are below 2 up to `Γ ≈ 0.2 kg/(m s)` (section 6.3). Films therefore cling around rims and edges and do not launch off them, except inside wall-jet zones.

---

## 2. Fluid and surface properties

### 2.1 Water: density, viscosity, surface tension, conductivity versus temperature

Correlations (all `[RECALLED]` standard forms `[S41]`; table values computed from them this session and spot-checked against handbook values at 20 °C: 998.2 kg/m³, 1.002 mPa s, 72.7 mN/m):

```
T in K, t = T − 273.15 in °C
ρ(t)  = (999.83952 + 16.945176 t − 7.9870401e-3 t² − 46.170461e-6 t³
         + 105.56302e-9 t⁴ − 280.54253e-12 t⁵) / (1 + 16.879850e-3 t)      [kg/m³]  Kell (1975)
μ(T)  = 2.414e-5 · 10^(247.8/(T − 140))                                     [Pa s]   Vogel-type fit
σ(T)  = 0.2358 · τ^1.256 · (1 − 0.625 τ),   τ = 1 − T/647.096               [N/m]    IAPWS 1994
k(T)  = −0.5752 + 6.397e-3 T − 8.151e-6 T²                                  [W/(m K)] simple fit
c_p   ≈ 4180                                                                [J/(kg K)]
```

| T, °C | ρ, kg/m³ | μ, mPa s | ν, 10⁻⁶ m²/s | σ, mN/m | k, W/(m K) | Pr | l_c, mm | (ν²/g)^(1/3), µm |
|---|---|---|---|---|---|---|---|---|
| 20 | 998.2 | 1.002 | 1.004 | 72.7 | 0.600 | 7.0 | 2.73 | 46.8 |
| 30 | 995.7 | 0.797 | 0.801 | 71.2 | 0.615 | 5.4 | 2.70 | 40.3 |
| 40 | 992.2 | 0.651 | 0.657 | 69.6 | 0.629 | 4.3 | 2.67 | 35.3 |
| 50 | 988.0 | 0.544 | 0.551 | 67.9 | 0.641 | 3.6 | 2.65 | 31.4 |
| 55 | 985.7 | 0.501 | 0.508 | 67.1 | 0.646 | 3.2 | 2.64 | 29.8 |
| 60 | 983.2 | 0.463 | 0.471 | 66.2 | 0.651 | 3.0 | 2.62 | 28.3 |
| 65 | 980.6 | 0.430 | 0.438 | 65.4 | 0.656 | 2.7 | 2.61 | 27.0 |
| 70 | 977.8 | 0.400 | 0.410 | 64.5 | 0.660 | 2.5 | 2.59 | 25.8 |

All table entries `[ESTIMATED]` (computed from the recalled correlations). The viscosity fit is about 0.7% low at 60 °C against the handbook value 0.4665 mPa s `[RECALLED]`. Viscosity halves between 20 and 55 °C; that is the dominant temperature effect on films (thinner, faster, lower minimum wetting rate).

Detergent at 3 to 6 g/L changes density and viscosity by less than 1% `[ESTIMATED]`. Dissolved or dispersed soil (starch, protein) can raise viscosity, which the chemistry and soils siblings should supply; the film model takes `μ` as an input field.

### 2.2 Surface tension of wash liquor and rinse-aid solution

No measured surface tension versus temperature for a real dishwasher wash liquor was found. What was found:

| Liquid | Value | Conditions | Source and tag |
|---|---|---|---|
| Water (reference in the same test) | 72 mN/m | room temperature, bubble-pressure tensiometer | `[S27, Table 3]` `[VERIFIED]` |
| Six commercial rinse aids | 42, 44, 46, 48, 49, 49 mN/m | 1000 ppm nonionic surfactant, room temperature, bubble-pressure (a dynamic method, short surface age) | `[S27, Table 3]` `[VERIFIED]` |
| Rinse aid in use | 90 and 153 ppm nonionic in the final rinse | institutional single-tank machine, 80 °C rinse | `[S27, Table 1]` `[VERIFIED]` |
| Low-foam alcohol alkoxylates, equilibrium | 30 to 32 mN/m | 0.1 to 1 g/L, 20 to 25 °C, ring or plate | supplier data sheets and patent example, search summary `[S45]` `[RECALLED]` |
| Nonionic for machine dishwashing, dynamic | below 50 to 60 mN/m | 0.1 g/L in distilled water at 1 Hz bubble frequency | US 7,026,276, search summary `[S45]` `[RECALLED]` |
| Rinse-aid co-surfactants | 27 to 35 mN/m; contact angle on polypropylene 17 to 35° at 0.3% | 1% solution, 20 °C | patent, search summary `[S45]` `[RECALLED]` |

The distinction between equilibrium and dynamic surface tension matters. A film in a dishwasher is created and destroyed in 0.1 to 3 s, and droplets and fresh film surface are younger still, so the relevant value sits between the dynamic and equilibrium figures.

Recommended defaults `[ESTIMATED]` (calibration parameters):

| Liquor | σ at film time scales, mN/m | Plausible range | Reasoning |
|---|---|---|---|
| Cold pre-rinse, no detergent, some soil | 60 | 50 to 72 | water plus soil-derived surface-active material |
| Main wash liquor, 45 to 65 °C | 40 | 30 to 55 | 50 to 250 ppm low-foam nonionic plus saponified fat and protein; between equilibrium (about 30) and dynamic (about 50) |
| Intermediate rinse | 55 | 45 to 70 | carry-over dilution |
| Final rinse with rinse aid, 50 to 70 °C | 45 | 32 to 50 | 100 to 300 ppm nonionic; dynamic values 42 to 49 `[S27]` |
| Final rinse without rinse aid | 65 | 55 to 70 | water at 60 °C is 66 |

Temperature slope for surfactant solutions: use `dσ/dT ≈ −0.07 mN/(m K)` `[ESTIMATED]`; pure water is −0.17 mN/(m K) between 50 and 70 °C (table above).

### 2.3 Contact angles on tableware materials

#### 2.3.1 Measured values found

| Material | Liquid | Advancing or static | Receding | Source and tag |
|---|---|---|---|---|
| Glass (window-type sheet) | water | 36.1 ± 3.1° | 11.6 ± 6.4° | `[S14, Table 1]` `[VERIFIED]` |
| Glass | water | 39 ± 5° (advancing) | - | Wang et al. 2013a as quoted in `[S14, section 3.3]` `[VERIFIED]` |
| Borosilicate glass slide | artificial saliva | 42.0° | 15.2° | `[S29]` `[VERIFIED]` |
| Fresh or activated glass | water | below 10 to 20°; rising to 30 to 70° after days in room air | - | search summary `[RECALLED]` |
| PMMA (Perspex) | water | 70.7 ± 1.9° | 25.2 ± 5.6° | `[S14, Table 1]` `[VERIFIED]` |
| Polypropylene | water | 90.2 ± 3.6° | 32.3 ± 5.0° | `[S14, Table 1]` `[VERIFIED]` |
| Polypropylene | water | 102.1° (mean of literature equilibrium and advancing values) | 79.7° (Chibowski 2007, as quoted in `[S14]`) | `[S26]`, `[S14]` `[VERIFIED]` |
| Polyethylene | water | 96° | - | `[S26]` `[VERIFIED]` |
| PTFE | water | 109.2° | - | `[S26]` `[VERIFIED]` |
| PTFE sheet (rough, Ra 19 nm) | artificial saliva | 115.2° | 29.5° | `[S29]` `[VERIFIED]` |
| PDMS (silicone) | water | 107.2° | - | `[S26]` `[VERIFIED]` |
| Polystyrene; ABS | water | 87.4°; 80.9° | - | `[S26]` `[VERIFIED]` |
| PET; polycarbonate | water | 72.5°; 82° | - | `[S26]` `[VERIFIED]` |
| Paraffin wax; hexatriacontane (stand-in for a solid fat layer) | water | 108.9°; 108.5° | - | `[S26]` `[VERIFIED]` |
| Stainless steel 304 coupon after 20 min in 50 °C water | water | 92° | - | `[S27, Table 4]` `[VERIFIED]` |
| Same, after 20 min in 1000 ppm polysaccharide solutions | water | 66° to 81° | - | `[S27, Table 4]` `[VERIFIED]` |
| Stainless steel tube, various aqueous liquids | - | 64° to 98° | - | Morison et al. as quoted in `[S15]` `[VERIFIED]` |
| Aluminium, glass, copper, stainless steel, varnish | water | 35.8° to 56.8° | - | Hobler as quoted in `[S15]` `[VERIFIED]` |
| Commercial tile glaze | water | about 52° | - | search summary `[RECALLED]` |
| Melamine, stainless steel, ABS | artificial saliva | intermediate between glass and PTFE; stainless lower than ABS and melamine | - | `[S29]` `[VERIFIED]` (no numbers in text) |

Critical surface tensions (Zisman) from `[S26]` `[VERIFIED]`, in mN/m: PTFE 19.4; PDMS 20.1; paraffin 24.8; PP 30.5; PE 31.6; PS 34; PMMA 37.5; ABS 38.5; PET 39; PC 44.

Three things stand out. First, hysteresis is large on real surfaces: 25° on glass, 45° on PMMA, 58° on polypropylene in one consistent data set `[S14]`. Second, the scatter between laboratories is as large as the differences between materials (polypropylene receding angle 32° versus 80°). Third, metal and glass values depend on cleanliness more than on the material.

#### 2.3.2 Effective contact angle in a flowing film

Aouad et al. fitted a draining-film model to water films on glass, PMMA and polypropylene and found that the effective contact angle lies between the measured receding and advancing angles, at about half the advancing value (PMMA: fitted 35°, advancing 70.7°, receding 25.2°) `[S14, section 4 and abstract]` `[VERIFIED]`. For the outer boundary of a jet's radial flow zone at high flow rate, an effective angle of 90° fits all materials `[S14, S13]` `[VERIFIED]`, because the boundary sits where film momentum flux equals the surface tension (section 3.6).

#### 2.3.3 Effect of surfactant

For a low-energy solid, a two-point Zisman line through (`σ = γ_c`, `θ = 0`) and (`σ_water`, `θ_water`) gives

```
cos θ = 1 − b (σ − γ_c)    for σ > γ_c,   θ = 0 otherwise
b = (1 − cos θ_water) / (σ_water − γ_c)
```

with `b` in m/mN equal to 0.029 (PP), 0.027 (PE), 0.025 (PTFE), 0.025 (PDMS), 0.025 (PS), 0.021 (PET) `[ESTIMATED from S26]`. For polypropylene at `σ = 32 mN/m` this gives 17°, which agrees with the 17° to 35° reported for rinse-aid co-surfactants `[S45]`. Surfactant solutions on fluoropolymers wet less well than the Zisman line predicts; the alternative empirical rule `cos θ = 2 γ_c/σ − 1` `[RECALLED]` gives a higher angle. The default table in section 12.7 spans both.

#### 2.3.4 Soiled surfaces

Until soil is removed, the film sees the soil surface, not the substrate. A solid fat layer behaves like paraffin (about 109° to water `[S26]`), so greasy patches are non-wetting in the pre-rinse and become wettable only once detergent lowers `σ` or the fat melts or emulsifies. Hydrated starch and protein films are hydrophilic (estimated 20° to 60°) `[ESTIMATED]`. The film model should take the contact angle per surface element from the soil state: `cos θ = (1 − c_s) cos θ_substrate + c_s cos θ_soil`, where `c_s` is the soil coverage fraction (Cassie mixing) `[RECALLED]`.

---

## 3. Gravity-driven and momentum-driven film flow

### 3.1 Nusselt solution (smooth laminar film)

For a film on a plane inclined at `β` from horizontal with flow per unit width `q = Γ/ρ`:

```
velocity profile     u(y) = (g sin β / ν)(h y − y²/2)
flux                 q = g sin β h³ / (3 ν)
thickness            h_N = (3 ν q / (g sin β))^(1/3) = (3 μ Γ / (ρ² g sin β))^(1/3)
mean velocity        u_m = g sin β h² / (3 ν);   surface velocity u_s = 1.5 u_m
wall shear stress    τ_w = ρ g h sin β = 3 μ u_m / h
kinematic wave speed c = dq/dh = g sin β h²/ν = 3 u_m
dimensionless        h_N (g/ν²)^(1/3) = (3 Re/4)^(1/3) = 0.909 Re^(1/3)   (vertical, Re = 4Γ/μ)
friction factor      f ≡ τ_w / (½ ρ u_m²) = 24 / Re
```

`[RECALLED]` (textbook). Confirmed against sources read this session: the parabolic profile and `τ_w = 3 μ U/δ` are equations 8 and 9 of `[S1]` `[VERIFIED]`; the dimensionless form reproduces the laminar branch of Wilke's heat-transfer correlation in `[S24]` (section 9.1).

Inclination changes thickness and shear only weakly: at `Γ = 0.05 kg/(m s)`, 55 °C, the thickness is 199 µm at 90°, 223 µm at 45°, 312 µm at 15° and 449 µm at 5°, and the wall shear falls from 1.9 to 1.5, 0.8 and 0.4 Pa `[ESTIMATED]`.

### 3.2 Regimes and correlations beyond Nusselt

| Regime | Boundary (Re = 4Γ/μ) | Source and tag |
|---|---|---|
| Smooth laminar | below about 33 | `[S24, introduction]` `[VERIFIED]` |
| Wavy laminar | about 33 to 1,600 | Mudawar group, search summary `[RECALLED]` |
| Laminar heat-transfer law holds up to | `2460 Pr^(−0.646)`, which is 1,160 at Pr 3.2 and 700 at Pr 7 | Wilke, in `[S24, Table 3]` `[VERIFIED]` |
| Fully turbulent | above 3,200 (Wilke, heat transfer); above 3,600 (Fulford, `Γ/μ > 900`) | `[S24, Table 3]`, `[S1, section 3.4]` `[VERIFIED]` |
| Transition for evaporating films | `Re_crit = 0.04/Ka'^0.37` with `Ka' = μ⁴ g/(ρ σ³)`; 1,672 for water at 100 °C | `[S15, Appendix B]` `[VERIFIED]` |

Meredith et al. note that the parabolic profile "remains valid even for wavy film flows" and that a film "can exhibit wavy behavior without necessarily being turbulent" `[S1, section 3.4]` `[VERIFIED]`.

Wave onset: a film on an incline is unstable to long waves above `Re_Γ = (5/6) cot β` (Benjamin 1957, Yih 1963) `[RECALLED]`, so vertical films are always unstable. Natural waves need a development length of order 0.1 m at dishwasher flow rates `[RECALLED]`; in a dishwasher the supply is pulsed and the film is rained on, so forced unsteadiness dominates. Pulses travel at about `3 u_m` (section 3.1).

Mean thickness in the wavy-laminar regime is below the Nusselt value, by up to about 20% (search summary `[RECALLED]`).

Turbulent mean-thickness correlations, all in the form `h (g/ν²)^(1/3) = a Re^b` with `Re = 4Γ/μ` `[S24, Table 2]` `[VERIFIED]`:

| Author | a | b | Stated range of Re |
|---|---|---|---|
| Brauer (1956) | 0.208 | 0.533 | upper limit 6,800 (lower limit garbled in my text extraction; Brauer's own transition is `Γ/μ = 400`, i.e. `Re = 1600` `[RECALLED]`) |
| Takahama and Kato (1980) | 0.228 | 0.526 | 426 to 997 as printed in `[S24]`; this looks like a `Γ/μ` range |
| Karapantsios and Karabelas (1995) | 0.217 | 0.538 | 370 to 11,020 |
| Ye et al. (2002) | 0.295 | 0.498 | 400 to 5,000 |
| Gimbutis (1974) | `h (g/ν²)^(1/3) = (0.0318 Re^0.92 + 8)^(2/3)` | | up to 100,000 |

Cross-check `[ESTIMATED]`: Brauer's original form `h = 0.302 (3ν²/g)^(1/3) (Γ/μ)^(8/15)` `[RECALLED]` converts to `a = 0.302 × 3^(1/3) × 4^(−8/15) = 0.208`, matching the verified table. A second Gimbutis form, `h = 0.136 (ν²/g)^(1/3) Re^0.583`, appears in `[S25]` `[VERIFIED]`.

### 3.3 Wall-friction closure for a depth-averaged solver

At steady state `τ_w = ρ g h sin β`, so any thickness correlation `h (g/ν²)^(1/3) = a Re^b` is equivalent to a friction law `f = 32 a³ Re^(3b−2)` `[ESTIMATED: substitute q = ν Re/4 into f = 2 g h³/q²]`:

```
laminar (a = 0.909, b = 1/3):         f = 24 / Re
Brauer (a = 0.208, b = 0.533):        f = 0.288 Re^(−0.40)
Takahama–Kato (a = 0.228, b = 0.526): f = 0.379 Re^(−0.42)
```

The laminar and Brauer laws cross at `Re = 1,608` `[ESTIMATED]`, which reproduces Brauer's transition. Independent check: the Blasius wall law used for turbulent wall-jet films, `τ_w/(ρ U_s²) = 0.0225 (ν/(U_s h))^(1/4)` with a 1/7-power profile (`U_s = (8/7) u_m`) `[S13, eqs 41 to 43]` `[VERIFIED]`, converts to `f = 0.080 Re^(−0.25)` `[ESTIMATED]`. At `Re = 5,000` Brauer gives `f = 0.0095` and Blasius gives 0.0096. One friction law therefore serves both gravity-driven films and decaying wall jets:

```
Re_loc = 4 |q| / ν
f      = max( 24 / Re_loc ,  0.288 Re_loc^(−0.40) )
τ_w    = ½ f ρ |u| u
```

Momentum-flux shape factor `β_m = ∫u² dy / (h u_m²)`: 6/5 for the parabolic profile `[RECALLED]`; 64/63 for the 1/7-power profile `[S13, eq. 51]` `[VERIFIED]`.

### 3.4 Wall shear stress available for cleaning

| Situation | Wall shear stress | Basis |
|---|---|---|
| Gravity-driven film, any orientation | `ρ g h sin β`; 0.4 to 5 Pa | section 1.2 `[ESTIMATED]` |
| Crest of a roll wave or a flow pulse | about 2 to 3 times the mean | `[RECALLED]` qualitative |
| Wall-jet zone of a 2 mm, 6 m/s jet at 55 °C, radius 4 to 20 mm | 25 to 120 Pa | section 3.6 `[ESTIMATED from S13]` |
| Same jet at radius 30 mm | 6 to 8 Pa | section 3.6 `[ESTIMATED from S13]` |

### 3.5 Films on the underside of surfaces

On an underside (`G_n < 0`) the hydrostatic term is destabilising (Rayleigh–Taylor). Verified results from Brun et al. `[S12]`:

- Lubrication equation for a film under a plane at angle `α` from the vertical (`α = 90°` is a horizontal ceiling): `∂h/∂t = −∂/∂x[(ρ g h³/(3μ))(sin α ∂h/∂x + l_c² ∂³h/∂x³)] − (ρ g h²/μ) cos α ∂h/∂x` `[VERIFIED]`.
- Horizontal ceiling: most-amplified wavelength `λ = 2π sqrt(2) l_c ≈ 8.89 l_c`; under an incline `λ_max = 2π sqrt(2) l_c / sqrt(sin α)` `[VERIFIED]`.
- The film drips only if the instability is absolute, not convected away by the mean flow. Criterion: `ũ = 3 l_c / (h sqrt(sin α) tan α) < ũ* = sqrt(34 + 14 sqrt 7)/sqrt 27 = 1.62208`. Equivalently the film drips when `h > h*`:

```
h* = 3 l_c cos α / (1.62208 · (sin α)^(3/2))
```

`[VERIFIED]`. Viscosity does not appear. Experiments (castor oil, `l_c = 1.91 mm`): drops at `h = 0.52 l_c`, `α = 81°`; no drops at `h = 0.55 l_c`, `α = 60.5°` `[VERIFIED]`. OpenFOAM's `BrunDrippingInjection` implements exactly this threshold (section 6.5).

Critical thickness for water-like liquids, expressed as tilt of the underside away from horizontal `[ESTIMATED from the verified formula]`:

| Tilt from horizontal | h*/l_c | h* for water at 55 °C (l_c 2.6 mm) | h* for σ = 35 mN/m (l_c 1.9 mm) |
|---|---|---|---|
| 0.5° | 0.016 | 42 µm | 31 µm |
| 1° | 0.032 | 84 µm | 61 µm |
| 2° | 0.065 | 168 µm | 123 µm |
| 3° | 0.097 | 252 µm | 184 µm |
| 5° | 0.16 | 422 µm | 308 µm |
| 10° | 0.33 | 854 µm | 624 µm |
| 30° | 1.15 | 3.0 mm | 2.2 mm |
| 45° | 2.2 | 5.7 mm | 4.2 mm |

Since dishwasher films are 70 to 500 µm thick, only undersides within about 2° to 5° of horizontal drip from their interior. Every other underside (the back of a leaning plate, the outside of an inverted bowl's wall, the inside wall of an inverted glass) carries its film to its lowest edge or point and drips there.

Caveats. The Brun criterion is an inertialess lubrication result validated with a viscous oil. A search summary of Scheid, Kofman and Rohlfs (2016) reports that with inertia the minimum critical angle is about 85° from vertical for water and that no fluid drips absolutely below 57.4° from vertical `[S33]` `[RECALLED]`, which supports the "within about 5° of horizontal" conclusion. Later work finds that the absolute-instability criterion gives an upper bound on the dripping onset, not always the onset itself (search summary) `[S33]` `[RECALLED]`.

### 3.6 Momentum-driven films: the wall jet and its decay into a gravity film

The jets sibling owns jet impingement. The film model needs the hand-off: the film state at the edge of the impingement zone and the distance over which jet momentum survives. Verified results for a coherent jet (diameter `d`, mean velocity `U_0`, flow `Q = π d² U_0/4`, `Re_j = ρ U_0 d/μ`) hitting a wall normally `[S13]`:

```
continuity in the radial film            r h U_av = d² U_0 / 8                               (eq. 25)

boundary-layer formation zone, r < r_b   δ_bl = 2.12 sqrt(μ r / (ρ U_0))                     (eq. 23)
                                         h/d = 0.125 (d/r) + (1.06/sqrt(Re_j)) (r/d)^(1/2)   (eq. 24)
                                         r_b/d = 0.24 Re_j^(1/3)                             (eq. 27)
laminar zone, r_b < r < r_t              h/d = (3.792/Re_j)(r/d)² + 0.1975 (d/r)             (eq. 34)
transition                               r_t/d = 0.2964 Re_j^(1/3)                           (eq. 40)
turbulent zone, r > r_t                  h/d = (0.0209/Re_j^(1/4))(r/d)^(5/4)
                                               + (0.296 − 0.001356 Re_j^(1/2))(d/r)          (eq. 49)
wall shear in the turbulent zone         τ_w/(ρ U²) = 0.0225 (μ/(ρ U h))^(1/4), U = surface velocity  (eq. 42)
```

All `[VERIFIED]`; equations 23 to 49 are for the horizontal direction on a vertical wall (gravity has no effect along that line) and equally for a horizontal plate. They hold for `6,300 < Re_j < 32,000`, 2 to 2.7 mm nozzles, water. The earlier Wilson et al. (2012) model assumes a Nusselt (parabolic) profile from the jet edge: `1/U_av − 1/U_0 = (10 π² μ/(3 ρ Q²)) [r³ − (d/2)³]` `[S13, eq. 32]` `[VERIFIED]`; Bhagat and Wilson conclude it "provides a reasonable engineering estimate" `[VERIFIED]`.

Edge of the radial flow zone (the "film jump"). The fast film stops where its momentum flux per unit width can no longer overcome surface tension:

```
Wilson et al. (2012):        (6/5) ρ U_av² h = γ (1 − cos β_c)
   gives                     R = 0.276 [ ṁ³ / (μ ρ γ (1 − cos β_c)) ]^(1/4),   ṁ = ρ Q
Bhagat and Wilson (2016):    M = ∫ρ u² dz = γ   at high flow rate, independent of wall material
```

The momentum balance and the `γ(1 − cos β)` term are stated in `[S13, section 2.2]` `[VERIFIED]`; the coefficient 0.276 is legible in the garbled equation text of `[S14]` and I re-derived it from equation 32 above (`R⁴ = 0.18 ρ² Q³/(π³ μ γ (1 − cos β))`, and `(0.18/π³)^(1/4) = 0.276`) `[ESTIMATED, consistent with VERIFIED fragments]`. Using `β_c = 90°` reproduces the high-flow-rate data on all materials `[S13, S14]` `[VERIFIED]`. Beyond the jump the liquid collects in a "rope" about 4 to 5 mm thick `[S14]` `[VERIFIED]` and drains as a gravity film bounded by ropes.

The same criterion describes a jet striking the underside of a horizontal plate: Button et al. (2010) found that the film leaves the surface where `M = γ`, independent of material, and falls as a water bell `[S13, section 2.2, eq. 50]` `[VERIFIED]`. This is the standard situation in a dishwasher, where jets come from below.

Worked numbers for water at 55 °C `[ESTIMATED from the verified formulas]`:

| Nozzle d, U_0 | Q, L/min | Re_j | r_b, mm | r_t, mm | R at β_c = 90°, mm | R at β_c = 36°, mm |
|---|---|---|---|---|---|---|
| 1.5 mm, 6 m/s | 0.64 | 17,700 | 9 | 12 | 21 | 32 |
| 2 mm, 6 m/s | 1.13 | 23,600 | 14 | 17 | 33 | 49 |
| 2 mm, 8 m/s | 1.51 | 31,500 | 15 | 19 | 40 | 61 |
| 3 mm, 6 m/s | 2.54 | 35,400 | 24 | 29 | 60 | 90 |

For the 2 mm, 6 m/s jet:

| r, mm | zone | h, µm | U_av, m/s | τ_w laminar estimate `2 μ U_av/h`, Pa | τ_w Blasius, Pa | We = ρ U_av² h/σ |
|---|---|---|---|---|---|---|
| 4 | boundary-layer | 145 | 5.2 | 36 | 122 | 57 |
| 6 | boundary-layer | 107 | 4.7 | 44 | 109 | 34 |
| 10 | boundary-layer | 81 | 3.7 | 46 | 78 | 16 |
| 15 | laminar | 71 | 2.8 | 40 | 50 | 8 |
| 20 | turbulent | 77 | 1.9 | 25 | 25 | 4 |
| 30 | turbulent | 111 | 0.9 | 8 | 6 | 1.3 |

So a stationary 2 mm jet carries more than 10 times gravity-film shear only out to about 20 to 25 mm, and its film Weber number falls to order 1 at about 30 mm, which is where it stops or leaves the surface.

Relaxation length. In a depth-averaged model the excess momentum of a film decays at the rate `π² ν/(4 h²)` (section 4.1, Roberts and Li). The time constant `4h²/(π² ν)` and the distance travelled are `[ESTIMATED]`:

| h, µm | u, m/s | time constant, ms | relaxation length, mm |
|---|---|---|---|
| 50 | 3 | 2 | 6 |
| 100 | 3 | 8 | 24 |
| 200 | 2 | 32 | 64 |
| 300 | 1 | 72 | 72 |

Jet momentum is forgotten within 1 to 7 cm of the impact point. Beyond that, the film is gravity-driven and knows only how much water arrived.

---

## 4. Depth-averaged film equations for a GPU solver on curved surfaces

### 4.1 Precedents with explicit equations

Meredith et al. (2011), the model in OpenFOAM's surface-film library `[S1, eqs 1 to 13]` `[VERIFIED]`:

```
∂(ρδ)/∂t + ∇_s·(ρ δ U) = S_ρδ                                              (mass)
∂(ρδU)/∂t + ∇_s·(ρ δ U U) = −δ ∇_s p + S_ρδU                               (momentum)
p      = p_σ + p_δ + p_g
p_σ    = −σ ∇_s² δ                         capillary; valid for slight curvature
p_δ    = −ρ (n·g) δ                        hydrostatic
S_ρδU  = τ_g + τ_w + ρ g_t δ + τ_θ
τ_w    = −3 μ U / δ                        from the parabolic profile
τ_θ    = β σ (1 − cos θ_E) n_cl / Δ_cl     contact-angle force, applied in cells on the contact line
```

The OpenFOAM-8 source confirms `p_σ = −fvc::laplacian(sigma, delta)` `[S9, line 150]` `[VERIFIED]`.

Ansys Fluent's Eulerian Wall Film model has the same structure: film height and momentum equations with gravity, hydrostatic and capillary pressure, a quadratic-profile wall friction `−3 μ V/h`, an interfacial shear term, spray momentum sources and the Meredith contact-line force `[RECALLED]`. Its theory-guide equations are images that I could not read; only the partial-wetting page text was verified (section 5.2).

Roberts and Li (2006), centre-manifold model on an arbitrarily curved substrate `[S16, eqs 4 and 5]` `[VERIFIED]`, in their non-dimensional form:

```
∂η/∂t ≈ −∇·(η ū)
R ∂ū/∂t ≈ −[ (π²/4) ū/η² + (2K + κ I)·ū/η ] + (π²/12)( W ∇κ̃ + G g_s )
κ̃ ≈ κ + ∇²η        free-surface mean curvature;  K = substrate curvature tensor;  κ = k_1 + k_2 (positive is concave)
```

with the advection terms on a flat substrate `R[1.5041 ū ∂ū/∂x + 1.3464 v̄ ∂ū/∂y + 0.1577 ū ∂v̄/∂y + 0.1483 (ū/η)(ū η_x + v̄ η_y)]` `[S16, eq. 60]` `[VERIFIED]`. The authors stress that the forcing coefficient is `π²/12 = 0.822` and not 1: "it must be 1/3 of the viscous decay rate π²/4 in order to match the leading 1/3 coefficient in the lubrication model" `[VERIFIED]`.

Roy, Roberts and Simpson (2002), lubrication limit on a curved substrate, as quoted in `[S16, eq. 1]` `[VERIFIED]`:

```
∂ζ/∂t ≈ −(W/3) ∇·[ η² ζ ∇κ̃ − ½ η⁴ (κ I − K)·∇κ ]
ζ = η − ½ κ η² + ⅓ k_1 k_2 η³       liquid volume per unit substrate area
```

Vantzos et al. (2017) use the equivalent form `∂u/∂t = div(M(u) ∇p)`, `M(u) = (u³/3) id + (ε u⁴/6)(H id − S)`, `p = −H − ε T u − ε Δu` `[S17, eq. 2]` `[VERIFIED]`.

Ruyer-Quil and Manneville (2000), first-order weighted-residual model for a film on an incline, in Shkadov scaling (search summary) `[S36]` `[RECALLED]`:

```
δ ∂q/∂t = (5/6) h − (5/2) q/h² + δ[ (9/7)(q²/h²) ∂h/∂x − (17/7)(q/h) ∂q/∂x ] + (5/6) h ∂³h/∂x³
∂h/∂t = −∂q/∂x
```

In dimensional terms the friction rate is `(5/2) ν/h²` and the forcing coefficient is 5/6. Shkadov (1967), Roberts–Li and Ruyer-Quil–Manneville share the same steady state (`q = g sin β h³/(3ν)`); they differ in the transient coefficients:

| Model | friction rate | forcing coefficient | advection |
|---|---|---|---|
| Shkadov / Meredith / OpenFOAM / Fluent | `3 ν/h²` | 1 | `∇·((6/5) q q/h)`, conservative |
| Ruyer-Quil–Manneville, first order | `2.5 ν/h²` | 5/6 = 0.833 | `(17/7)(q/h) q_x − (9/7)(q²/h²) h_x` |
| Roberts–Li | `(π²/4) ν/h² = 2.47 ν/h²` | π²/12 = 0.822 | coefficients 1.5041, 1.3464, 0.1577, 0.1483 |

The Shkadov form mis-predicts the onset of natural waves by 20% (`cot β` instead of `(5/6) cot β`) `[RECALLED]`. That is acceptable here because forced unsteadiness dominates (section 3.2), and its conservative form is what robust shallow-water finite-volume schemes need.

### 4.2 Recommended governing equations

State per surface cell: `h`, `q` (two tangential components), film temperature `T_f`, scalar concentrations `c_k` (detergent actives, dissolved and suspended soil), wet indicator `w`, and per-cell constants (normal `n`, curvature `κ_s`, metric, material, random contact-angle offset).

```
(1) mass
    ∂h/∂t + ∇_s·q = S_h
    S_h = (ṁ″_dep − ṁ″_splash − ṁ″_sep − ṁ″_drip − ṁ″_evap) / ρ

(2) momentum
    ∂q/∂t + ∇_s·(β_m q⊗q / h) = c_F [ h g_t − (h/ρ) ∇_s p ] − (τ_w − τ_g)/ρ + S_q + F_cl/ρ

(3) pressure (gauge, at the wall)
    p = ρ G_n h − σ (κ_s + ∇_s² h) + p_imp − Π(h)

(4) wall friction
    laminar:    τ_w/ρ = c_ν ν q / h²
    general:    τ_w/ρ = ½ f |u| u,   f = max(8 c_ν / Re_loc, 0.288 Re_loc^(−0.40)),   Re_loc = 4|q|/ν

(5) energy
    ∂(h T_f)/∂t + ∇_s·(q T_f) = S_h,dep T_dep − (α_fw/(ρ c_p))(T_f − T_w) − (q″_evap + q″_conv)/(ρ c_p)

(6) scalars
    ∂(h c_k)/∂t + ∇_s·(q c_k) = S_h,dep c_k,dep + j_k,wall + R_k h
```

Symbols not yet defined:

| Symbol | Definition | Default |
|---|---|---|
| `β_m` | momentum-flux shape factor | 1.2 laminar; 1.016 where the turbulent branch of `f` is active |
| `c_F` | forcing coefficient | 1 (Shkadov). Option: 5/6 with `c_ν = 5/2` |
| `c_ν` | laminar friction coefficient | 3 (Shkadov). Option: 5/2 |
| `τ_g` | gas shear on the film surface | 0 (quiescent tub air); the drying fan is the chemistry sibling's topic |
| `S_q` | tangential momentum from deposited parcels, `Σ (ṁ″_dep/ρ) η_t u_t,parcel` | `η_t` from the jets sibling |
| `p_imp` | normal momentum flux of deposited parcels, `Σ ṁ″_dep |u_n,parcel|` | from the jets sibling |
| `Π(h)` | disjoining pressure, if the precursor-film option is used | 0 (section 5.3) |
| `F_cl` | contact-line force per unit area | section 5.2 |
| `α_fw` | film-to-wall heat-transfer coefficient | `1.88 k/h` (section 9.1) |
| `j_k,wall` | soil or chemistry flux between wall and film | soils and chemistry siblings |

Notes for the implementer.

- The driving force must be discretised as the gradient of one free-surface potential, or pools will not come to rest. With constant `n` across a face: `h g_t − h ∇_s(G_n h) = −h ∇_s Φ`, where `Φ = −g·x_s + G_n h` is the gravitational potential of the free surface per unit mass. A lake at rest has `Φ` constant.
- On undersides `G_n < 0`. Together with the capillary term the equations then contain the Rayleigh–Taylor instability with the correct cut-off wavelength `2π sqrt(σ/(ρ|G_n|))`, so pendant ridges and drops form by themselves when the grid spacing is 2 mm or finer (the cut-off is 12 to 17 mm).
- Substrate curvature drives flow through `−σ ∇_s κ_s`: liquid thins on convex rims and collects in concave corners (plate foot rings, the junction of a mug handle). Where `h κ_s` is not small, use `ζ = h − ½ κ_s h² + ⅓ k_1 k_2 h³` as the conserved volume per unit area `[S16]`. Where `h |κ_s| > 0.3` the thin-film description is failing and the liquid belongs in a lumped pool or an edge reservoir (sections 6 and 7).
- The capillary term `∇_s² h` is only meaningful for small free-surface slopes. Near a contact line with a large contact angle it is wrong in detail; the contact-line force (section 5.2) carries the physics there.
- Lubrication limit: dropping the left-hand side of (2) gives `q = (h³/(3ν)) (g_t − ∇_s p/ρ)`. This is accurate when `(h/L)·(u h/ν) ≪ 1`, which holds for draining films after the spray stops but fails inside wall-jet zones and at film jumps. An explicit lubrication solver is also far stiffer (section 10.3). Keep inertia.

### 4.3 Sources from impinging jets and droplets

The deposition interface with the jets sibling should carry, per surface cell and time step: deposited mass flux `ṁ″_dep`, its tangential velocity, its normal velocity, its temperature and its scalar concentrations; and the mass flux removed by splashing. The film solver adds mass through `S_h`, tangential momentum through `S_q`, and normal momentum through `p_imp`, whose gradient pushes the film radially outward from the impact point. This is the same split that OpenFOAM uses (mass, tangential momentum and pressure sources transferred from the Lagrangian cloud to the film `[S9]` `[VERIFIED: source fields rhoSp, USp, pSp]`).

Directly under a coherent jet the film is thinner than a boundary layer can develop in (section 3.6), so a depth-averaged equation with developed-profile friction under-predicts shear there. Recommended split: inside `r < r_b ≈ 0.24 Re_j^(1/3) d` use the analytical boundary-layer solution (equations 23 and 24) for shear and thickness, owned by the jets sibling; hand the film solver the flux `Q/(2π r_b)` per unit arc at velocity `U_av(r_b) ≈ U_0/2` `[S13, text before eq. 29]` `[VERIFIED]`.

---

## 5. Wetting, partial wetting, rivulets and dry patches

### 5.1 One balance behind four classic results

Per unit length of contact line, the net surface force that resists spreading (or drives retraction) is `σ (1 − cos θ)` `[S1, eqs 10 to 12]` `[VERIFIED]`. Four results follow from balancing it against one other term:

| Phenomenon | Balance | Result | Source and tag |
|---|---|---|---|
| Static puddle on a horizontal surface | hydrostatic thrust `½ ρ g h²` | `h_p = 2 l_c sin(θ/2)` | de Gennes et al. `[S43]` `[RECALLED]` |
| Dry patch in a falling film (Hartley and Murgatroyd) | stagnation pressure `∫ ½ ρ u² dy` at the apex of the patch | `δ* = [15 μ² σ (1 − cos θ)/(ρ³ g²)]^(1/5)` | `[S15, eq. 1 and Appendix C]` `[VERIFIED]` |
| Outer edge of a jet's radial flow zone (Wilson et al.) | momentum flux `(6/5) ρ U² h` | `R = 0.276 [ṁ³/(μ ρ γ (1 − cos β))]^(1/4)` | section 3.6 |
| Inertial dewetting of a film of thickness `h` | momentum flux of the collected rim `ρ h V²` | `V = sqrt(σ (1 − cos θ_r)/(ρ h))` | Buguin et al. 1999 `[S43]` `[RECALLED]` |

A depth-averaged film model that (i) carries momentum flux correctly and (ii) applies a line force `σ (1 − cos θ)` at wet/dry boundaries reproduces all four without separate sub-models. That is the case for building the wetting model on the Meredith contact-line force.

### 5.2 The contact-line force model (Meredith et al. 2011) and its parameters

Model `[S1, section 3.5 to 3.7]` `[VERIFIED]`:

```
τ_θ = β σ (1 − cos θ_E) n_cl / Δ_cl
```

`n_cl` is the unit vector in the tangent plane normal to the contact line; `Δ_cl` is the cell width normal to the contact line; `β` is an empirical factor "to account for discrepancies between the theory and observed behavior of real surfaces", found by matching the measured critical flow rate.

Wet/dry indicator `ω` `[S1, section 3.6]` `[VERIFIED]`:

- Hydrophobic (non-absorbent) surfaces: wet where `δ > δ_c`, dry where `δ < δ_c`.
- Hydrophilic or micro-grooved surfaces: a memory flag; once wetted, the cell counts as wet until `δ < 0.001 δ_c`.
- Cells wetted by spray impingement use a relaxed threshold, for example `δ > ½ δ_c`.

Contact angle: sampled once per cell from a normal distribution and then frozen; mean 75°, standard deviation 10° for water on cast acrylic (observed value about 70°) `[S1, section 3.7]` `[VERIFIED]`. The random field is what breaks symmetry and creates rivulets.

Validation data `[S1, sections 4 and 5]` `[VERIFIED]`: cast-acrylic panel 0.61 m by 1.22 m, tap water at 43 °C, grid spacing 3.8 mm. Transition from rivulets to a continuous film between `Γ = 108` and `174 g/(m s)` at 5° inclination and between 125 and 212 g/(m s) at 90°; the simulation gave 150 to 300 g/(m s) at 90°. Wetted-area fraction in the rivulet regime 0.1 to 0.2 in both experiment and model. Best `β`: 1.0 at 45° and 90°, 0.4 at 5°. The model meandered less than the experiment.

Check `[ESTIMATED]`: the Hartley–Murgatroyd rate (section 5.4) for `θ = 70°` and water at 43 °C is `Γ* = 0.15 kg/(m s)`, inside the measured 0.125 to 0.212 window.

Implementations:

| Code | Form | Parameters seen | Source and tag |
|---|---|---|---|
| OpenFOAM-8 `contactAngleForce` | for each face where coverage crosses 0.5: `force += Ccf · n · σ (1 − cos θ)/invDx`, `n = ∇(coverage)/|∇(coverage)|`, then divide by cell volume; optional mask near named patches | `Ccf` | `[S2]` `[VERIFIED]` |
| OpenFOAM-8 tutorial `rivuletPanel` | `Ccf 1`; contact angle normal, expectation 75, variance 100, limits 50 to 100; laminar `Cf 0.001` | | `[S8]` `[VERIFIED]` |
| OpenFOAM-8 tutorial `hotBoxes` | `Ccf 0.085`; same distribution; `deltaWet 1e-4` m; `hydrophilic no`; laminar `Cf 0.005`; models `curvatureSeparation` and `drippingInjection` | | `[S8]` `[VERIFIED]` |
| OpenFOAM-8 `kinematicSingleLayer` | capillary pressure `−laplacian(σ, δ)`; default `deltaCoLimit 1e-4` | | `[S9]` `[VERIFIED]` |
| Ansys Fluent Eulerian Wall Film | Meredith model; surface force with an empirical parameter and the wet-area fraction; critical film thickness 1e-10 m; contact angle sampled from a Gaussian with a mean and a standard deviation, or user-defined | | `[S10]` `[VERIFIED]` (text only; equations not readable) |

The spread of `Ccf` from 0.085 to 1 between two tutorials of the same code shows that this parameter is tuned per case and grid, not predicted.

### 5.3 Precursor-film and disjoining-pressure alternative

Form (Schwartz and Eley 1998) `[S37]` `[RECALLED]`, coefficient re-derived:

```
Π(h) = B [ (h*/h)^n − (h*/h)^m ],   B = (n − 1)(m − 1) σ (1 − cos θ_e) / ((n − m) h*),   (n, m) = (3, 2)
```

The whole surface carries a precursor film of thickness `h*`; `Π` enters the pressure as `−Π(h)`. `B` is fixed by requiring `∫_{h*}^{∞} Π dh = σ (1 − cos θ_e)` `[ESTIMATED: integrate term by term]`. Reported practice (search summary of recent thin-film papers `[S37]`) `[RECALLED]`: non-dimensional `h*` about 10⁻³; the grid spacing must be close to `h*` for convergence; the apparent equilibrium angle comes out smaller than the input angle; the exponent pair has little macroscopic effect. Vantzos et al. also run with a precursor layer `[S17]` `[VERIFIED]`.

Assessment for Spotless: with cells of 0.5 to 1 mm and films of 0.1 mm, a converged precursor model would need `h*` and cell size near 1 to 10 µm. On affordable grids it gives the right qualitative patterns and the wrong contact angles and hysteresis. It is not recommended as the primary wetting model; it remains a fallback where a smooth, differentiable formulation is wanted.

### 5.4 Minimum wetting rate and dry-patch stability

Force-balance model (Hartley and Murgatroyd 1964) for a laminar film on a vertical wall `[S15, eq. 1]` `[VERIFIED]`:

```
δ* = (1 − cos θ)^(1/5) / Λ,   Λ = (ρ³ g² / (15 μ² σ))^(1/5)
Γ* = ρ² g δ*³/(3 μ) = 1.69 (μ ρ / g)^(1/5) [σ (1 − cos θ)]^(3/5)
```

The second line is the Nusselt flux at `δ*`; the coefficient `15^(3/5)/3 = 1.693` matches the literature value 1.69 (search summary) `[ESTIMATED]`. For an incline replace `g` by `g sin β`. A film thinner than `δ*` cannot re-wet a dry patch; a dry patch, once formed, persists.

Evidence on accuracy `[S15, introduction]` `[VERIFIED]`:

- Measured minimum wetting rates for water on vertical stainless steel: 0.222 kg/(m s) at 20 °C (Paramalingam et al.); 0.065 to 0.12 (Munakata et al.); 0.16 falling to 0.12 between 20 and 70 °C (Morison and Tandon); 0.104 at both 25 and 60 °C (Morison et al.).
- Against Morison's data (contact angles 64° to 98°) the force-balance thickness was always greater than the measured minimum thickness.
- The minimum-total-energy model of Mikielewicz and Moszynski predicted thicknesses that were "uniformly too low by a factor of 1.5" against Hobler's data (contact angles 35.8° to 56.8°).
- Wetting is hysteretic: the flow needed to wet a dry surface exceeds the flow at which an established film breaks (Dreiser and Bart).
- Turbulence changes the force-balance result by about 1% `[S15, Appendix C]` `[VERIFIED]`.

So the force-balance value is an upper estimate and the energy-minimum value a lower estimate, a factor of about 1.5 apart in thickness. El-Genk and Saber's (2001) energy-minimum correlations, as I remember them, are `Δ_min = (1 − cos θ_0)^0.22` and `Γ_min = 0.67 Δ_min^2.83 + 0.26 Δ_min^9.51` in units of `(15 μ² σ/(ρ³ g²))^(1/5)` and `(ρ μ σ³/g)^(1/5)` `[S35]` `[RECALLED]`; I could not read the equations in the copy I fetched and they should not be coded without checking the paper.

Hartley–Murgatroyd values `[ESTIMATED from the verified formula]`:

| θ | water 55 °C: δ*, µm | Γ*, kg/(m s) | σ = 35 mN/m, 55 °C: δ*, µm | Γ*, kg/(m s) | water 20 °C: Γ*, kg/(m s) |
|---|---|---|---|---|---|
| 5° | 101 | 0.007 | 89 | 0.004 | 0.008 |
| 10° | 133 | 0.015 | 117 | 0.010 | 0.018 |
| 20° | 175 | 0.034 | 154 | 0.023 | 0.041 |
| 36° | 221 | 0.068 | 194 | 0.046 | 0.082 |
| 50° | 250 | 0.099 | 220 | 0.067 | 0.120 |
| 70° | 283 | 0.143 | 248 | 0.097 | 0.173 |
| 90° | 307 | 0.184 | 270 | 0.125 | 0.223 |
| 102° | 319 | 0.206 | 280 | 0.140 | 0.249 |
| 110° | 326 | 0.220 | 286 | 0.149 | 0.266 |

Compare with the time-mean dishwasher supply of order 0.01 to 0.05 kg/(m s) (section 1.2):

- Glass and glazed ceramic in wash liquor (receding angle below 10°, `Γ* < 0.01`): the film stays continuous between spray passes.
- Stainless steel (30° to 70°): continuous during and just after a jet pass, breaking into rivulets between passes.
- Plastics, non-stick coatings and silicone (`Γ* ≈ 0.1 to 0.2`): never film-wetted by the time-mean flow. They are wetted only where spray lands directly and in the wake of jet passes, and the wake breaks into rivulets and beads at once. For these materials coverage is set by the spray pattern, not by drainage.

### 5.5 Dewetting speed

Static stability: a film thinner than `h_c = 2 l_c sin(θ/2)` is metastable and dewets once a dry spot is nucleated `[S43]` `[RECALLED; the same expression appears in a search summary of arXiv:2112.12896]`. `h_c` is 0.46 mm at 10°, 1.6 mm at 36°, 3.7 mm at 90° (water, 55 °C) `[ESTIMATED]`. Every dishwasher film is thinner than `h_c` on every material except perfectly wetted glass, so what decides whether a surface stays wet is the rate of dry-patch growth compared with the re-wetting interval.

Viscous regime (small angles): `V = k (σ/μ) θ_r³`, constant in time, with `k = 1/(12 sqrt(2) L)` and `L = ln(macroscopic/microscopic length) ≈ 10 to 15`, so `k ≈ 4 to 6 × 10⁻³` (de Gennes; Redon, Brochard-Wyart and Rondelez 1991) `[S43]` `[RECALLED]`. A search summary confirms the reported constant velocity, the inverse proportionality to viscosity and the strong sensitivity to contact angle for films thicker than 10 µm, but not the prefactor.

Inertial regime (large angles): `V = sqrt(σ (1 − cos θ_r)/(ρ h))` (section 5.1).

Numbers for water at 55 °C (`σ/μ = 134 m/s`) `[ESTIMATED]`:

| θ_r | viscous estimate, `k = 5 × 10⁻³` | inertial estimate, h = 200 µm | Governing | Time to open a 10 mm dry patch |
|---|---|---|---|---|
| 5° | 0.4 mm/s | 0.04 m/s | viscous | 10 s or more |
| 10° | 3.6 mm/s | 0.07 m/s | viscous | about 1.5 s |
| 20° | 28 mm/s | 0.14 m/s | viscous | 0.2 s |
| 30° | 96 mm/s | 0.21 m/s | viscous | 50 ms |
| 60° | 0.77 m/s | 0.41 m/s | inertial | 12 ms |
| 90° | - | 0.58 m/s | inertial | 9 ms |

The smaller of the two speeds governs. With an arm period of 1 to 3 s, surfaces with a receding angle below about 10° stay wet from pass to pass, and surfaces above about 20° de-wet between passes. This threshold behaviour is the main material effect the film model must capture, and it depends on the receding angle, which is the least certain property in section 2.3.

### 5.6 Rivulets

Regime sequence with increasing flow on a partially wetting incline (Le Grand-Piteira, Daerr and Limat 2006; search summary) `[S30]` `[RECALLED]`: drops, then a straight rivulet, then stationary meanders above a first critical flow rate, then an unsteady sweeping rivulet that sheds sub-rivulets, then a straight braided rivulet. Meanders appear when inertia exceeds the pinning force `σ (cos θ_r − cos θ_a)`; the critical flow rates scale as `(sin β)^(−3/5)`. Schmuki and Laso (1990) found meandering suppressed at high viscosity.

Narrow-rivulet geometry in the lubrication limit (width `w` below about `2 l_c`, parabolic cross-section `h(y) = (tan θ/w)((w/2)² − y²)`, flow down the line of greatest slope) `[ESTIMATED; the result equals the Duffy–Moffatt narrow-rivulet formula with coefficient 4/105 on the half-width, RECALLED]`:

```
centre height   h_0 = (w/4) tan θ
area            A = (2/3) w h_0
flow rate       Q = g sin β tan³θ w⁴ / (420 ν)
width for given Q:  w = [420 ν Q / (g sin β tan³θ)]^(1/4)
```

Derivation: `Q = (g sin β/(3ν)) ∫ h³ dy` and `∫_{−a}^{a} (a² − y²)³ dy = (32/35) a⁷`. For 1 mL/s of water at 55 °C on a vertical wall this gives `w = 2.5 mm`, `h_0 = 0.5 mm` at `θ = 40°`, and `w = 7.9 mm`, `h_0 = 0.35 mm` at `θ = 10°` `[ESTIMATED]`. Mean velocities come out near 1 m/s, so real rivulets at these flow rates are inertial and somewhat wider and slower than the lubrication estimate. Wider rivulets flatten to the puddle height `2 l_c sin(θ/2)`.

Grid implication: rivulets are 2 to 10 mm wide with edge ridges of width about `l_c`. A 0.5 mm grid resolves them; a 1 mm grid is marginal for plastics; a 2 mm grid cannot.

### 5.7 Hysteresis and retained drops

A drop of width `w` on a surface inclined at `β` stays put while (Furmidge 1962)

```
ρ g V sin β ≤ k w σ (cos θ_r − cos θ_a)
```

with `k ≈ 1`; measured values 0.76 to 0.98 for water (search summary) `[S42]` `[RECALLED]`. ElSherbini and Jacobi (2006) give a version in which critical drops share one Bond number per liquid–surface pair (search summary) `[S42]` `[RECALLED]`.

Largest drop retained on a vertical surface, taking the drop as a spherical cap at the mean of the two angles and `k = 1` `[ESTIMATED]`:

| Material | θ_a / θ_r assumed | σ = 67 mN/m: width, volume | σ = 30 mN/m with the same angles: width, volume |
|---|---|---|---|
| Glass | 36° / 12° | 5.3 mm, 6 µL | 3.5 mm, 2 µL |
| Glazed ceramic | 45° / 15° | 5.8 mm, 10 µL | 3.9 mm, 3 µL |
| Stainless steel | 75° / 30° | 6.3 mm, 27 µL | 4.2 mm, 8 µL |
| Polypropylene, low hysteresis | 95° / 60° | 4.6 mm, 19 µL | 3.1 mm, 6 µL |
| Polypropylene, high hysteresis `[S14]` | 90° / 32° | 6.8 mm, 40 µL | 4.5 mm, 12 µL |
| Melamine | 75° / 40° | 5.4 mm, 19 µL | 3.6 mm, 6 µL |
| PTFE | 110° / 90° | 2.6 mm, 6 µL | 1.8 mm, 2 µL |

A surfactant also lowers both angles, so the right-hand columns overstate retention with rinse aid; they show only the direct effect of `σ`. Retained drops are 2 to 7 mm wide. On a 0.5 mm grid the larger ones are resolvable; the smaller ones need a sub-grid bead store (section 12.4).

### 5.8 What the wetting model must reproduce

1. Continuous films on hydrophilic materials at supply rates down to about 0.01 kg/(m s), and their persistence between spray passes.
2. Break-up into rivulets with a wetted-area fraction of 0.1 to 0.2 on materials with contact angles near 70° when `Γ` is below about 0.1 to 0.2 kg/(m s) `[S1]`.
3. The outer radius of a jet's fast-film zone, about 20 to 60 mm for dishwasher nozzles, with weak material dependence at high flow (section 3.6).
4. Dry-patch growth at millimetres per second on glass and at tenths of a metre per second on plastics (section 5.5).
5. Retention of drops below the Furmidge limit and release above it.
6. Puddle heights of `2 l_c sin(θ/2)` on flat upward faces, raised at sharp edges (section 7.2).

---

## 6. Film leaving a surface

### 6.1 The possible outcomes at an edge

When a film reaches a convex edge (plate rim, glass lip, cutlery edge, rack wire) it does one of four things: (i) separates inertially as a sheet or ligaments; (ii) turns the corner and clings to the next face (the teapot effect); (iii) collects along a lower edge or at a low point as a pendant ridge and drips; (iv) on a near-horizontal underside, drips from the interior. Which one happens is decided by the film Weber number at the edge, the edge radius relative to the film thickness, the contact angle, and the direction of gravity on the two adjoining faces.

### 6.2 Published separation criteria

O'Rourke and Amsden (1996), sharp corner with turning angle `θ` `[S21, eq. 15]` `[VERIFIED]`:

```
c_sep ρ_l [(u_l − v_w)·t_1]² sin θ / (1 + cos θ) > p_gas,   c_sep = 3
```

The film separates when the wall-side pressure needed to turn it would be negative. The authors state that surface tension "can be shown to be a negligible effect" in their engine application and that the criterion "remains to be validated experimentally" `[VERIFIED]`. For a dishwasher film at 1 m/s on a 90° corner the left side is 3 kPa against an ambient pressure of 101 kPa, so this criterion never triggers. It is the wrong criterion for slow water films in which surface tension is the main restraint `[ESTIMATED]`.

Friedrich et al. (2008) force ratio, as documented for OpenFOAM's `FriedrichModel` `[S6]` `[VERIFIED]`:

```
F_ratio = ρ |u|² h sin θ / [ σ (1 + sin θ) + ρ g h L_b cos θ ]
L_b = 0.0388 h^0.5 Re^0.6 We_rel^(−0.5),   Re = h |u| ρ/μ,   We_rel = h ρ_gas (u_gas − u)²/(2σ)
separation when F_ratio > 1
partial separation (Zhang et al. 2018): separated mass fraction = 0.882 − 1.908 exp(−F_ratio/1.264)
```

The break-up length `L_b` is an empirical correlation for gas-sheared films. In still air `We_rel` is tiny and `L_b` becomes tens of centimetres (0.6 m for `h = 200 µm`, `u = 0.5 m/s`) `[ESTIMATED]`, which makes the gravity term dominate unphysically. Without the gravity term the criterion reduces to `We = ρ u² h/σ > (1 + sin θ)/sin θ`, which is 2 for a 90° corner.

Owen and Ryley (1985), rounded edge. Two versions exist in OpenFOAM:

```
documentation of OwenRyleyModel [S7] [VERIFIED]:
  F_net = F_inertial + F_body + F_surface;   separated when F_net < 0
  F_inertial = −(4/3) h ρ |u|² / R_1
  F_body     = −ρ |g| (R_1² − R_2²) cos θ / (2 R_1)
  F_surface  = σ / R_2,     R_2 = R_1 + h
  defaults: fThreshold 1e-8, minInvR1 5 (1/m), deltaByR1Min 0, definedPatchRadii 0

source of curvatureSeparation.C, OpenFOAM-8 [S3] [VERIFIED]:
  invR1 = UHat·(UHat·∇nHat), overridden on named patches by 1/max(1e-6, radius), ignored below 1e-6 1/m
  Fi = −δ ρ |U|² (72/60) invR1;  Fb = −0.5 ρ |g| invR1 (R1² − R2²) cosAngle;  Fs = σ/R2
  separated if Fi + Fb + Fs + 1e-10 < 0;  ejected mass = all available mass in the cell;  ejected diameter = δ
```

The code's 72/60 is the parabolic-profile momentum factor 6/5; the documentation's 4/3 differs. `θ` is the angle between gravity and the outflow direction. With gravity neglected and `h ≪ R_1` the criterion is `We > 5/6`, independent of the radius `[ESTIMATED]`. That is not credible for large radii (a film does not leave a 50 mm radius bowl at `We = 1`), which is why OpenFOAM exposes minimum-curvature and minimum-`δ/R_1` cut-offs, and why the documentation notes the model "suits round corners better than sharp corners" `[S7]` `[VERIFIED]`.

Teapot effect, Duez et al. (2010) `[S19]` `[VERIFIED]`: water sheets flowing over edges of radius 0.03 to 2 mm with contact angles from 10° to 175°. Below a threshold velocity the liquid "is not ejected from the impacter anymore but drips along the spout". The threshold Weber number `We_c = ρ U_c² e_0/γ` rises linearly with `(1 + cos θ_0)`, with a slope that grows strongly with edge radius; scaling `We_c ∝ (R r_i/e_0²)(1 + cos θ_0)`, `R = r_i + e_0/2`. Viscosity had no effect (water against a liquid of twice the viscosity). Superhydrophobic edges never drip, whatever their radius.

Bouwhuis and Snoeijer (2015) control-volume analysis `[S20, eqs 19 to 22]` `[VERIFIED]`:

```
We_c ≈ (r_i/h)(1 + cos θ_0)   for r_i/h ≫ 1;    We_c ≥ 2 always
```

The floor of 2 is the Taylor–Culick condition: a free sheet slower than `sqrt(2σ/(ρh))` retracts. The authors note that their model under-predicts the measured dependence on `r_i/h` (experiments are closer to quadratic in one data set and linear in another), so the prefactor is uncertain.

### 6.3 Where dishwasher films sit

Weber numbers of gravity-driven films, water at 55 °C `[ESTIMATED]`: 0.04 at `Γ = 0.02`; 0.19 at 0.05; 0.60 at 0.1; 1.9 at 0.2; 6.1 at 0.4 kg/(m s). With wash liquor (`σ = 40 mN/m`) multiply by 1.7.

- Time-mean gravity films (`We < 1`) never separate inertially. They cling round rims and edges and reach the underside or back face.
- Jet-pass pulses (`We` 2 to 6) separate at sharp edges and cling to rounded rims. A plate rim of 2 mm radius under a 0.3 mm film has `r_i/h ≈ 7`, so `We_c ≈ 13` for a wettable surface and about 6 for polypropylene.
- Wall-jet films (`We` 4 to 60 within 20 mm of the impact point, section 3.6) launch off any edge they reach as a sheet. This is the mechanism by which a jet striking near a rim throws water onward.

### 6.4 Dripping from lower edges and low points

Spacing of drip sites along a horizontal lower edge. Inviscid Taylor instability: critical wavelength `λ_c = 2π sqrt(σ/(g(ρ_l − ρ_v)))`, most dangerous `λ_D = sqrt(3) λ_c` `[S23, eq. 1]` `[VERIFIED]`. Thin viscous film: `λ = 2π sqrt(2) l_c` `[S12]` `[VERIFIED]`. Observations under horizontal tubes: `λ = sqrt(2) λ_c` for water, ethylene glycol and ammonia (Yung et al. 1980); 22 mm for water at 25 °C (Mitrovic 1986); spacing increases as flow falls and approaches `λ_D` as `Re` tends to zero (Hu and Jacobi 1998) `[S23]` `[VERIFIED]`.

| Liquid | l_c, mm | λ_c, mm | 2π√2 l_c, mm | λ_D, mm |
|---|---|---|---|---|
| Water, 20 °C | 2.73 | 17.1 | 24.2 | 29.7 |
| Water, 55 °C | 2.63 | 16.6 | 23.4 | 28.7 |
| σ = 35 mN/m, 55 °C | 1.90 | 12.0 | 16.9 | 20.7 |
| σ = 30 mN/m, 65 °C | 1.77 | 11.1 | 15.7 | 19.2 |

`[ESTIMATED from the verified formulas]`. The 24 mm prediction for water at 20 °C sits next to Mitrovic's measured 22 mm.

Drop size.

- OpenFOAM's Brun dripping model ejects drops of diameter `dCoeff × l_c` with default `dCoeff = 3.3` `[S4]` `[VERIFIED]`.
- Drops from horizontal tubes: `d ≈ 3 sqrt(σ/(ρ g))` (Yung et al. 1980) `[RECALLED]`.
- Largest pendant drop under a wetted horizontal ceiling: volume about `19 l_c³` (Pitts 1974) `[RECALLED]`. A sphere of diameter `3.3 l_c` has volume `18.8 l_c³`, so the OpenFOAM default and the pendant-drop limit agree `[ESTIMATED]`.
- From a tip or edge of wetted perimeter `P` (Tate's law with the Harkins–Brown factor): `m g = ψ σ P`, `ψ ≈ 0.6 to 0.75` `[RECALLED]`.

| Liquid | d = 3.3 l_c, mm | drop volume, µL | drop mass, g |
|---|---|---|---|
| Water, 20 °C | 9.0 | 381 | 0.38 |
| Water, 55 °C | 8.7 | 344 | 0.34 |
| σ = 35 mN/m, 55 °C | 6.3 | 130 | 0.13 |
| σ = 30 mN/m, 65 °C | 5.8 | 104 | 0.10 |

`[ESTIMATED]`. These are upper bounds for drops falling from broad, wetted lower edges. Drops from thin edges and points (fork tines, knife tips, rack wires) are smaller by Tate's law: a 2 mm wide tip gives about 25 µL with water `[ESTIMATED: ψ = 0.65, P = 6.3 mm]`.

Drip frequency at low flow is supply divided by drop volume: a site fed at 0.1 mL/s with water at 55 °C drips at 0.3 Hz `[ESTIMATED]`.

Transition from drops to columns to a sheet as the flow over a horizontal lower edge rises (Hu and Jacobi 1996, for liquid falling between horizontal tubes), as quoted in `[S22, eqs 6 to 9]` `[VERIFIED]`:

```
droplet / droplet-column boundary:   Re = 0.074 Ga^0.302
droplet-column / column boundary:    Re = 0.096 Ga^0.301
column / column-sheet boundary:      Re = 1.414 Ga^0.233
column-sheet / sheet boundary:       Re = 1.448 Ga^0.236
Ga = ρ σ³/(μ⁴ g),   Re = 2Γ/μ
```

`[S22]` describes `Γ` as the total flow on both sides of the tube; my recollection of the original is flow per unit length on each side `[RECALLED]`. The factor of 2 is unresolved. Taking `Γ` per side `[ESTIMATED]`:

| Liquid | Ga | drops only below Γ | columns from Γ | sheet above Γ |
|---|---|---|---|---|
| Water, 20 °C | 3.9 × 10¹⁰ | 0.059 | 0.074 | 0.23 |
| Water, 55 °C | 4.8 × 10¹¹ | 0.063 | 0.079 | 0.21 |
| σ = 35 mN/m, 55 °C | 6.8 × 10¹⁰ | 0.035 | 0.044 | 0.13 |

Units kg/(m s). The time-mean dishwasher film (0.01 to 0.05) drips as drops; jet-pass pulses reach the column regime; only wall-jet run-off forms a sheet.

Dripping to jetting from a single orifice or tip (Clanet and Lasheras 1999; search summary of the abstract) `[S31]` `[RECALLED]`: `We_c = 4 (Bo_o/Bo) [1 + K Bo_o Bo − ((1 + K Bo_o Bo)² − 1)^(1/2)]²`, `We = ρ V_0² D/σ`, Bond numbers on inner and outer diameter, `K = 0.37` for water. The transition is hysteretic.

### 6.5 Dripping models in OpenFOAM

`drippingInjection` (search summary of the source) `[S5]` `[RECALLED]`: where gravity has a component out of the wall, the mass above a user thickness `deltaStable` is removed, capped by the available mass; each cell draws a drop diameter from a user distribution once and reuses it; mass is ejected only when it exceeds `particlesPerParcel` drops' worth. Tutorial values: `deltaStable 0`, `particlesPerParcel 100`, Rosin–Rammler diameters 0.5 to 1.2 mm `[S8]` `[VERIFIED]`. This model has no physics for the threshold; the user supplies it.

`BrunDrippingInjection`, OpenFOAM-8 `[S4]` `[VERIFIED]`:

```
sinAlpha = (g/|g|)·nHat                       1 for a horizontal ceiling
candidate if sinAlpha > small and δ > deltaStable_
lc = sqrt(σ/(ρ |g|))
deltaStable = max(deltaStable_, 3 lc sqrt(1 − sinAlpha²) / (ubarStar sqrt(sinAlpha) sinAlpha))
if δ > deltaStable:  eject mass (δ − deltaStable) ρ A (capped), as drops of diameter dCoeff · lc
defaults: ubarStar 1.62208, dCoeff 3.3, deltaStable_ 0
```

This is the Brun criterion of section 3.5 applied cell by cell.

### 6.6 Edge separation in Ansys Fluent's Eulerian Wall Film model

From search summaries of the theory and user guides `[S11]` `[RECALLED]`: separation at an edge requires both an edge angle above a critical angle and a film Weber number above a user-set critical value; three options then set the diameter and number of shed droplets (Foucart: diameter from edge length and film height; O'Rourke; Friedrich); the shed mass rate equals the film mass flux across the edge; a zero critical Weber number converts all film reaching the edge to droplets; Lagrangian wall-film particles leave with a diameter equal to the larger of the film height and 10 µm. The equations themselves were not readable. These are user-tuned switches, not predictive criteria.

### 6.7 Sheets and ligaments

A film that separates at `We > 2` leaves as a sheet of thickness about `h` and velocity about `u`. Its free rim retracts at the Taylor–Culick speed `sqrt(2σ/(ρ h))`, 0.8 m/s for a 0.2 mm water sheet `[ESTIMATED]`, and the sheet breaks into ligaments and drops within a few centimetres. Break-up and the resulting drop sizes belong to the jets sibling. The film solver should hand over mass flux, velocity vector, sheet thickness and the edge segment.

---

## 7. Pooling

### 7.1 Where pools form and how deep they are

A loaded item holds a pool wherever its surface, in its loaded pose, has a closed basin with respect to gravity: the inside of an upright or tilted cup or bowl, the recessed base of an inverted mug or glass, a spoon bowl facing up, a container lid with a raised rim, the well of a plate lying flat. The geometry (basin volume as a function of water level, spill points) is a pure function of mesh and pose and should be computed once per placement by a priority-flood fill in the gravity direction; this belongs with the items sibling's geometry pipeline.

Two regimes need different treatment:

- Shallow pools (depth below about 3 mm or below 0.2 of the local radius of curvature). The film equations handle them directly, provided the scheme is well balanced (section 4.2), because `Φ = −g·x_s + G_n h` becomes uniform.
- Deep pools. A height field along the surface normal cannot represent them (normals cross, and volume is no longer `∫ h dA`). Use a lumped reservoir per basin: state = volume, temperature, scalar concentrations, settled solids. Inflow = film flux crossing the basin's waterline plus direct deposition onto the free surface; outflow = overflow at the spill point when the level exceeds the spill elevation, delivered to the film cells at the spill point.

### 7.2 Puddles on flat upward faces

On an unbounded horizontal face the equilibrium puddle height is `h_p = 2 l_c sin(θ/2)` (section 5.1). At a sharp edge the contact line is pinned until the local angle exceeds `θ_a + (180° − φ)`, where `φ` is the solid's edge angle (Gibbs condition) `[RECALLED]`, so a flat top bounded by a sharp 90° edge can hold a puddle up to `2 l_c sin((θ_a + 90°)/2)` high:

| Surface | θ_a | unbounded puddle, water 55 °C | puddle held by a sharp 90° edge, water | held by the edge, σ = 35 mN/m and θ_a = 10° |
|---|---|---|---|---|
| Glass, ceramic | 30° to 45° | 1.4 to 2.0 mm | 4.6 to 4.9 mm | 2.9 mm |
| Stainless steel | 75° | 3.2 mm | 5.2 mm | 2.9 mm |
| Polypropylene | 95° | 3.9 mm | 5.3 mm | 3.3 mm (θ_a = 30°) |

`[ESTIMATED]`. Flat tops and recessed bases therefore retain 3 to 5 mm of water whatever the material, which is 3 to 5 kg/m² and dwarfs every film and bead term in section 8. Tilting the face by a few degrees releases most of it. On a face of length `L` tilted at `β`, the lower edge can hold back a head of about the edge-held height `h_e` (the third column). Once `L sin β > h_e` the pool shrinks to a wedge at the lower edge of length `h_e/sin β`, and the mean retained depth over the face falls to about `h_e²/(2 L sin β)`: 0.9 mm for `h_e = 4.6 mm`, `L = 80 mm`, `β = 8°`, and 0.4 mm at 20° `[ESTIMATED]`. This is the physical content of the loading advice to tilt cups and bowls.

### 7.3 Exchange between a pool and the flow passing through it

Lumped model for a pool of volume `V` with through-flow `Q` and incoming concentration `c_in`:

```
V dc/dt = η_mix Q (c_in − c)
solution for constant Q and c_in:   c(t) = c_in + (c_0 − c_in) exp(−η_mix Q t / V)
```

`η_mix` is the fraction of the through-flow that mixes with the pool before leaving `[ESTIMATED model]`:

| Feeding mode | η_mix | Basis |
|---|---|---|
| Jet or dense spray plunging into the pool | 0.8 to 1 | jet momentum stirs the whole volume |
| Film entering down one wall and overflowing at the opposite lip | 0.3 to 0.7 | through-flow crosses the pool |
| Film entering and overflowing at the same lip (short-circuit) | 0.05 to 0.2 | analogous to side-cavity exchange |
| No through-flow | 0; diffusion and thermal convection only | time scale `depth²/D`, hours |

For the short-circuit case the nearest literature is the exchange between a stream and a side cavity or "dead zone", usually modelled as first-order exchange with a dimensionless exchange velocity of a few hundredths of the main-stream velocity (Valentine and Wood 1977; Uijttewaal et al. 2001; Weitbrecht et al. 2008) `[RECALLED; a search summary confirmed the first-order framework but not the number]`. No source specific to cups under spray was found. `η_mix` is a calibration parameter.

Scale: a 50 mL pool fed at 5 mL/s turns over every 10 s; with `η_mix = 0.3` its concentration follows the bulk liquor with a 30 s lag `[ESTIMATED]`. Pools therefore track the liquor within each phase. They matter at phase changes: a pool carries dirty main-wash liquor into the rinse and is diluted only by the rinse through-flow it receives; a shadowed pool that receives no through-flow keeps its dirty water to the end. Suspended solids also settle in pools (cross-link: chemistry, redeposition).

---

## 8. Drainage, residual water and the effect of rinse aid

### 8.1 Drainage of a wetted surface after spraying stops

For a continuous film on a plane inclined at `β`, a distance `s` below the upper edge of the wetted region and a time `t` after the supply stops (Jeffreys 1930):

```
h(s, t) = sqrt( μ s / (ρ g sin β t) )
mean over a length L:   h_mean = (2/3) h(L, t)
```

`[S32]` `[RECALLED; the form is quoted in a search summary of Xue and Stone 2020]`. Check `[ESTIMATED]`: substituting `h = A sqrt(s/t)` into `∂h/∂t + (ρ g sin β/(3μ)) ∂(h³)/∂s = 0` gives `A² = μ/(ρ g sin β)` exactly. The solution applies once the initial film has drained past, that is for `t` greater than about `L/(3 u_m)`, a second or so.

| Vertical surface, drained length | 1 s | 10 s | 60 s | 300 s | 1200 s |
|---|---|---|---|---|---|
| 65 °C, 0.05 m | 47 µm | 15 µm | 6.1 µm | 2.7 µm | 1.4 µm |
| 65 °C, 0.10 m | 67 µm | 21 µm | 8.6 µm | 3.9 µm | 1.9 µm |
| 65 °C, 0.25 m | 106 µm | 33 µm | 13.6 µm | 6.1 µm | 3.1 µm |
| 20 °C, 0.10 m | 101 µm | 32 µm | 13.1 µm | 5.8 µm | 2.9 µm |
| 20 °C, 0.25 m | 160 µm | 51 µm | 20.6 µm | 9.2 µm | 4.6 µm |

Thickness at the lower end `[ESTIMATED from the Jeffreys law]`. Mean water loading is two thirds of the tabulated thickness times density: 9 g/m² at 60 s and 2 g/m² at 20 min for a 0.25 m surface at 65 °C. The film solver reproduces this law by itself in its lubrication limit; it is a validation case, not a sub-model. On textured surfaces the law breaks down at long times and a residual film stays in the roughness (search summary) `[RECALLED]`.

Consequences: within the pause between two spray-arm passes (1 to 3 s) a hydrophilic surface keeps a film of 40 to 100 µm; within a 10 s pause between phases, 15 to 50 µm. A continuous film of a few micrometres evaporates from a hot item within seconds to a minute (section 9.3), so thin drained films do not cause wet dishes. What remains is the water that gravity drainage cannot remove.

### 8.2 Water that drainage cannot remove

| Reservoir | Where | Amount | Tag |
|---|---|---|---|
| Pools and edge-held puddles | upward concave regions and flat tops | 3 to 5 mm deep (section 7.2); tens of millilitres per badly placed item | `[ESTIMATED]` |
| Pendant ridge and last drops on lower edges | every lowest edge or point | up to one drop per drip site: 0.1 to 0.35 mL per 12 to 25 mm of horizontal lower edge; one drop at a single low point | `[ESTIMATED from section 6.4]` |
| Capillary bridges | contact points between items, and between items and rack wires | per contact, a meniscus of radius about `l_c`: of order 10 to 50 µL | `[ESTIMATED]` |
| Beads on partially wetting surfaces | plastics, non-stick, silicone, and steel without rinse aid | drops up to the Furmidge limit, 2 to 40 µL each (section 5.7); areal loading 10 to 60 g/m² | `[ESTIMATED]`, calibration parameter |
| Thin film on hydrophilic surfaces | glass, ceramic | Jeffreys: 2 to 10 g/m² after 1 to 5 min | `[ESTIMATED]` |

The bead loading is the weakest number here. It rests on the retained-drop sizes of section 5.7 and an assumed coverage of 0.5 to 2 drops per cm². My recollection of the condensate-retention literature for vertical plates is 30 to 130 g/m², higher for larger receding angles `[RECALLED, low confidence]`; a spray-wetted surface that has just de-wetted should hold less than a surface saturated by condensation.

### 8.3 Rinse aid

One patent gives directly comparable drying data from an institutional single-tank machine (wash 50 °C, final rinse 4 L at 80 °C, 8 s), counting droplets left on test coupons 5 min after the rinse `[S27, Tables 1 and 12]` `[VERIFIED]`:

| Final rinse | Stainless steel 304 | Glass | Plastic (cast nylon) |
|---|---|---|---|
| No additive | 21 droplets, not dry at 300 s | 5 droplets, not dry at 300 s | 24 droplets, not dry at 300 s |
| Conventional nonionic rinse aid, 90 ppm | 10 droplets, not dry at 300 s | 0 droplets, dry at 118 s | 3 droplets, dry at 299 s |
| Same, reverse-osmosis water | 9 droplets, not dry | 0 droplets, dry at 124 s | 5 droplets, not dry |

Rinse aid acts through three routes, all of which the film model captures if `σ` and the contact angles are functions of the liquor:

1. Lower contact angles (section 2.3.3) move plastics and steel from the bead regime towards the film regime; a film drains to micrometres (section 8.1) where beads would stay.
2. Lower `σ` reduces the capillary length by 25 to 35%, shrinking pendant drops by a factor of 2.5 to 3.5 in volume (section 6.4) and edge-held puddles by about a third in depth (section 7.2).
3. Lower `σ (cos θ_r − cos θ_a)` reduces the size of drops that hysteresis can hold (section 5.7).

The same patent shows that surface tension alone does not predict drying: polysaccharide additives that left `σ` above 60 mN/m dried steel and glass better than surfactant rinse aids by adsorbing and making the surface hydrophilic (steel contact angle 92° down to 66° to 81°) `[S27, Tables 3 and 4]` `[VERIFIED]`. The receding contact angle on the rinsed surface is the controlling variable.

### 8.4 Carry-over between phases

The liquor left on the load, tub and sump when a phase is drained dilutes into the next fill. No measured value was found; the search for one was not completed. The film model can compute the load's share: the sum of pools, edge and contact reservoirs, beads and the Jeffreys film at the moment the next fill starts. For a full load with 6 m² of item surface and a 30 s drain this is of order 60 mL of film (10 g/m²) plus whatever is pooled; pools can dominate `[ESTIMATED]`. The tub, filter and sump share belongs to the machine sibling.

---

## 9. Heat transfer between film and item; evaporation and condensation

### 9.1 Film-to-wall heat-transfer coefficient

Correlations for a falling film being heated or cooled by its wall, with `h*_H = α_fw ν^(2/3)/(k g^(1/3))` and `Re = 4Γ/μ` `[S24, Table 3]` `[VERIFIED]`:

| Author | Correlation | Range |
|---|---|---|
| Wilke (1962) | `h*_H = 2.07 Re^(−1/3)` | `Re < 2460 Pr^(−0.646)` |
| | `h*_H = 0.0323 Re^(1/5) Pr^0.344` | `2460 Pr^(−0.646) < Re < 1600` |
| | `h*_H = 0.00102 Re^(2/3) Pr^0.344` | `1600 < Re < 3200` |
| | `h*_H = 0.00871 Re^(2/5) Pr^0.344` | `Re > 3200`; `5.4 < Pr < 210` |
| Gimbutis (1974) | `h*_H = (0.165 Re^0.16 − 0.4) Pr^0.34 (Pr/Pr_w)^0.25` | `2800 ≤ Re ≤ 70,000`; `4.3 < Pr < 8.4` |
| Shmerler and Mudawar (1988) | `h*_H = 0.0106 Re^0.3 Pr^0.63` | `2500 ≤ Re ≤ 39,500`; `2.55 < Pr < 6.87` |

For evaporating turbulent films, Chun and Seban give `h* = 0.0038 Re^0.4 Pr^0.65` `[S25]` `[VERIFIED]`.

Wilke's laminar branch combined with the Nusselt thickness `h_N = 0.909 Re^(1/3) (ν²/g)^(1/3)` gives `α_fw h_N/k = 2.07 × 0.909 = 1.88` `[ESTIMATED]`, the fully developed laminar-film Nusselt number. Use

```
α_fw = 1.88 k / h                                         where the laminar branch of the friction law is active
α_fw = 0.0106 Re^0.3 Pr^0.63 · k (g/ν²)^(1/3)             where the turbulent branch is active
```

Values are 2,400 to 18,000 W/(m² K) (table in section 1.2). Wilke's Prandtl range starts at 5.4; hot wash liquor has `Pr ≈ 3`, slightly outside it.

### 9.2 Thermal properties of tableware materials

Handbook-typical values `[RECALLED]`; wall thickness is my assumption for a typical item; the last three columns are computed `[ESTIMATED]` with `α_fw = 6000 W/(m² K)` on both faces.

| Material | ρ, kg/m³ | c, J/(kg K) | k, W/(m K) | thermal diffusivity, m²/s | typical wall, mm | areal heat capacity, kJ/(m² K) | Biot number (half wall) | conduction time (half wall)²/diffusivity, s |
|---|---|---|---|---|---|---|---|---|
| Porcelain, stoneware | 2400 | 900 | 1.5 | 6.9 × 10⁻⁷ | 6 | 13.0 | 12 | 13 |
| Soda-lime glass | 2500 | 840 | 1.0 | 4.8 × 10⁻⁷ | 2.5 | 5.3 | 7.5 | 3.3 |
| Borosilicate glass | 2230 | 830 | 1.14 | 6.2 × 10⁻⁷ | 4.5 | 8.3 | 12 | 8.2 |
| Stainless steel 304 | 7900 | 500 | 16.2 | 4.1 × 10⁻⁶ | 1 | 4.0 | 0.19 | 0.06 |
| Polypropylene | 905 | 1900 | 0.22 | 1.3 × 10⁻⁷ | 1.5 | 2.6 | 20 | 4.4 |
| HDPE | 950 | 1900 | 0.48 | 2.7 × 10⁻⁷ | 1.5 | 2.7 | 9 | 2.1 |
| Melamine-formaldehyde | 1500 | 1500 | 0.45 | 2.0 × 10⁻⁷ | 3 | 6.8 | 20 | 11 |
| SAN | 1080 | 1350 | 0.17 | 1.2 × 10⁻⁷ | 2 | 2.9 | 35 | 8.5 |
| Copolyester (Tritan-type) | 1180 | 1500 | 0.20 | 1.1 × 10⁻⁷ | 2 | 3.5 | 30 | 8.8 |
| Silicone rubber | 1150 | 1250 | 0.25 | 1.7 × 10⁻⁷ | 2.5 | 3.6 | 30 | 9 |
| Aluminium pan body under a PTFE coating (coating about 30 µm) | 2700 | 900 | 200 | 8.2 × 10⁻⁵ | 3 | 7.3 | 0.05 | 0.03 |

What follows `[ESTIMATED]`:

- The film side is never the limiting resistance except for metals. For ceramics, glass and plastics the Biot number is 7 to 35: the surface under a film reaches the film temperature in about `k ρ c/α_fw²`, which is 0.1 s for porcelain and 0.01 s for polypropylene, while the interior follows over 3 to 13 s.
- The soil sits on the surface, so under a film the soil temperature is the local film temperature to within a fraction of a second.
- The film is cooled by a cold item. With a film heat-capacity rate `Γ c_p` of about 200 W/(m K) at `Γ = 0.05` and a conductance `α_fw L` of 1,500 W/(m K) over a 0.25 m plate, the film equilibrates with the wall surface within the first few centimetres. During warm-up the lower part of a cold item sees cooler liquid than the upper part.
- Under continuous wetting an item warms with a time constant of roughly its areal heat capacity divided by the heat-capacity flux of the water reaching it: 10 to 25 s for ceramics, 2 to 5 s for thin glass, steel and plastics, at a deposition of 0.14 kg/(m² s). This is short against the minutes over which the machine heats the liquor (machine sibling), so wetted surfaces track the liquor temperature quasi-steadily.
- Lateral conduction is slow: 50 mm along a porcelain plate takes an hour. Regions that spray never reaches are heated by the tub atmosphere.

Recommended representation: a film energy equation (equation 5 of section 4.2) coupled per surface cell to a one-dimensional wall with three nodes through the half-thickness for ceramic, glass and plastic, and one lumped node for metals.

### 9.3 Evaporation and condensation (brief; the chemistry sibling owns drying)

Mass flux by the heat and mass transfer analogy `[RECALLED]`:

```
ṁ″ = (α_c / (c_p,air Le^(2/3))) · (Y_s(T_s) − Y_∞) / (1 − Y_s(T_s))
```

`α_c` is the air-side convective coefficient (3 to 8 W/(m² K) in still air), `Y` the vapour mass fraction, `Le^(2/3) ≈ 0.9`. With `α_c = 5`, a 60 °C wet surface and 40 °C saturated tub air the flux is about 0.5 g/(m² s) `[ESTIMATED]`.

- A drained film of 5 g/m² on a hot ceramic surface evaporates in about 10 s, using 12 kJ/m² of the 260 kJ/m² the plate stores between 60 and 40 °C `[ESTIMATED]`.
- A 20 µL bead needs 47 J to evaporate. The polypropylene under its 5 mm footprint stores about 1 J over a 20 K drop, and lateral conduction is poor `[ESTIMATED]`. Beads on plastics cannot dry on stored heat. This, with the bead-forming contact angle, is why plastics come out wet.
- Condensation runs the other way when hot humid air meets an item colder than the dew point. Heating a 6 mm porcelain plate by 30 K by condensation alone deposits about 80 µm of condensate on each face (`13.0 kJ/(m² K) × 30 K ÷ 2.36 MJ/kg ÷ 2`) `[ESTIMATED]`. Surfaces that spray never reaches are therefore wetted and warmed, with zero shear. With an air-side coefficient of 20 to 100 W/(m² K) limited by non-condensable air, the time constant is a few minutes `[ESTIMATED]`.

### 9.4 Mass transfer between film and wall

For supply of detergent to the soil and removal of dissolved soil, the concentration boundary layer in the film is thin (Schmidt number of order 500), so the developed-film Sherwood number 1.88 is not reached. Use the Lévêque solution with the wall shear rate `γ̇_w = τ_w/μ` and distance `x` from the start of the soiled or wetted patch `[RECALLED]`:

```
k_m(x) = 0.538 (D² γ̇_w / x)^(1/3)
```

For `τ_w = 2 Pa`, 55 °C, `D = 10⁻⁹ m²/s`, `x = 50 mm`: `k_m = 2.3 × 10⁻⁵ m/s` `[ESTIMATED]`. This is the coupling the soils and chemistry siblings need from the film model; it depends on the film only through `τ_w`.

---

## 10. Numerical precedents

### 10.1 Industrial CFD

| Code | Method | Relevant features | Source and tag |
|---|---|---|---|
| OpenFOAM `surfaceFilmModels` (`kinematicSingleLayer`, `thermoSingleLayer`) | finite volume on a one-cell-thick region extruded from wall patches; depth-averaged mass, momentum and energy; coupled to Lagrangian parcels | Meredith contact-angle force; capillary pressure as `−∇·(σ∇δ)`; laminar wall friction with coefficient `Cf`; `deltaWet`; injection models `curvatureSeparation`, `drippingInjection`, `BrunDrippingInjection`; film Courant-number limit `deltaCoLimit` | `[S1, S2, S3, S4, S8, S9]` `[VERIFIED]` |
| OpenFOAM `regionFaModels::liquidFilm` | finite-area (surface-mesh) version of the same; newer separation models `OwenRyley` and `Friedrich` | | `[S6, S7]` `[VERIFIED]` |
| Ansys Fluent Eulerian Wall Film | surface finite volume; partial-wetting model after Meredith; edge separation by critical angle and Weber number; coupling to the discrete-phase model | | `[S10]` `[VERIFIED]`, `[S11]` `[RECALLED]` |
| KIVA-3 wall film (O'Rourke and Amsden) | Lagrangian film particles; inertia neglected in the film; inertial separation at sharp corners | "most of these assumptions are valid as long as film thicknesses are less than approximately 100 µm" | `[S21]` `[VERIFIED]` |

Meredith's own validation used a uniform 3.8 mm grid on a 0.61 m by 1.22 m panel `[S1]` `[VERIFIED]`. All of these precedents couple a two-dimensional film to a Lagrangian spray, which is architecture (a).

### 10.2 Computer graphics

- Stam (2003), "Flows on surfaces of arbitrary topology": stable-fluids solver on subdivision-surface patches with a parametric atlas and metric-corrected operators `[S39]` `[RECALLED]`. Precedent for solving in texture space with seam handling.
- Wang, Miller and Turk (2007), "Solving general shallow wave equations on surfaces" `[S18]` `[VERIFIED]`: height field built along surface normals; `u_t = −(u·∇)u − ∇P_ext/ρ + a_ext`, `h_t + ∇·((h − b)u) = 0`; the advective term is dropped ("we are targeting at slow water"); gravity and surface tension are treated implicitly in one linear system `(A_g + A_s + I − I_c) h_t = b − b_c` because "if we still use explicit solvers ... the system would require significantly smaller time steps"; friction is a damping factor `h/(h + d)`; planar regular grids or triangle meshes directly, no parametrisation. Not physically calibrated: friction, viscosity and surface-tension factors are tunable.
- Azencot et al. (2015) and Vantzos et al. (2017), "Functional thin films on surfaces" `[S17]` `[VERIFIED]`: lubrication equation on triangle meshes as a gradient flow; one sparse linear solve per step; exact volume conservation; precursor layer; van der Waals term for pearling. They state the reason for implicit stepping: for explicit schemes "the time step τ is on the order of (Δx)⁴".
- Vantzos, Raz and Ben-Chen (2018), "Real-time viscous thin films": gradient-flow scheme with local stencils computed on the GPU; mass preserved, discrete energy controlled, height non-negative (search summary) `[S39]` `[RECALLED]`.

The graphics methods target viscous, inertialess films and plausible appearance. None includes turbulent or inertial films, impinging-spray sources, contact-angle hysteresis with measured angles, or edge separation. They are useful for discretisation ideas (operators on meshes, positivity, GPU stencils), not as physical models.

### 10.3 Time-step limits

For water at 55 °C `[ESTIMATED]`. "Lubrication, explicit" is forward Euler on `h_t = −∇·((σ h³/(3μ)) ∇∇²h)`, `Δt ≤ 3 μ Δx⁴/(32 σ h³)`. "Inertial capillary" is the limit when inertia is retained and the capillary term is explicit: capillary waves have `ω² = σ h k⁴/ρ`, giving `Δt ≤ 0.35 Δx² sqrt(ρ/(σ h))`. "Advective" is `Δx/(|u| + sqrt(g h))` with `|u| = 1 m/s`.

| Δx | h | lubrication, explicit | inertial capillary | advective |
|---|---|---|---|---|
| 1 mm | 0.1 mm | 0.7 ms | 4.3 ms | 0.97 ms |
| 1 mm | 0.3 mm | 26 µs | 2.5 ms | 0.95 ms |
| 1 mm | 1 mm | 0.7 µs | 1.4 ms | 0.91 ms |
| 1 mm | 3 mm | 0.03 µs | 0.78 ms | 0.85 ms |
| 0.5 mm | 0.1 mm | 44 µs | 1.1 ms | 0.49 ms |
| 0.5 mm | 0.3 mm | 1.6 µs | 0.62 ms | 0.47 ms |
| 0.5 mm | 1 mm | 0.04 µs | 0.34 ms | 0.46 ms |
| 0.25 mm | 0.3 mm | 0.1 µs | 0.16 ms | 0.24 ms |

Retaining inertia changes the capillary stability limit from `Δx⁴` to `Δx²` and removes the `h³` stiffness. An explicit inertial solver runs at 0.2 to 1 ms steps on a 0.5 to 1 mm grid; an explicit lubrication solver would need microsecond steps wherever the film thickens (ridges, rivulets, puddles). This is a second reason, besides the physics of wall jets, to solve the inertial form. The wall-friction term has a rate `3ν/h²` (15,000 per second at `h = 10 µm`) and must be treated implicitly; it is local, so this costs nothing.

### 10.4 Wet/dry fronts, positivity, well-balancing

All `[RECALLED]` (standard shallow-water numerics; none opened this session):

- Kurganov and Petrova (2007): second-order central-upwind scheme for the Saint-Venant system, well balanced (lake at rest) and positivity preserving; velocity de-singularisation `u = sqrt(2) h q / sqrt(h⁴ + max(h⁴, ε⁴))`.
- Audusse et al. (2004): hydrostatic reconstruction, a general recipe for making any Riemann-solver flux well balanced and positive.
- Bollermann et al. (2011, 2013): "draining time step" limiter so that a cell never loses more liquid than it holds.
- Chertock et al. (2015): semi-implicit friction for central-upwind shallow-water schemes.
- Zhornitskaya and Bertozzi (2000); Grün and Rumpf (2000): positivity-preserving schemes for lubrication equations. Diez and Kondic (2002): thin-film flows with contact lines `[cited in S1]`.

Mass conservation is automatic in flux form provided every sink (separation, dripping, evaporation, transfer to the bead store or a pool) is limited by the mass in the cell; OpenFOAM does this through an `availableMass` field `[S3, S4]` `[VERIFIED]`.

### 10.5 Discretising on item surfaces

Two workable representations: (i) cells are the texels of a per-item atlas of low-distortion charts, with per-texel area, face lengths, normal, curvature and neighbour indices across seams (Stam's approach); (ii) cells are the triangles or dual cells of a fine surface mesh (Wang–Miller–Turk, Azencot, OpenFOAM finite-area). The atlas form maps directly onto GPU textures and compute shaders and shares its parameterisation with the soil fields and the renderer. Either way the film solver needs these precomputed per placement: `g_t`, `G_n`, `κ_s`, edge classification (dihedral angle, edge radius), basins and spill points, drip sites (local minima of height along edges), and contact pairs between items.

---

## 11. Evidence on the architecture candidates

### 11.1 Scale argument against resolving films in three dimensions

Films are 70 to 500 µm thick (section 1.2); their drainage speed scales as `h²`, their wall shear as `h`. A three-dimensional method must put at least 3 to 5 cells or particles across the film to get either right, which means a spacing of 20 to 100 µm. The liquid in play is of order 3 to 4 L (machine sibling); at 50 µm spacing that is 3 × 10¹⁰ particles `[ESTIMATED]`. At an affordable 1 mm spacing (about 4 × 10⁶ particles) a wall film is at best a single layer of particles whose thickness, speed and shear are set by the numerical wall model, not by the fluid mechanics. Candidate (b) therefore cannot deliver the film quantities the soil model needs; it has to carry a sub-grid wall-film model, which is the film layer of candidate (a).

Cost side `[ESTIMATED; the numerics sibling should check the throughput assumptions]`: weakly compressible SPH at 1 mm needs time steps of a few microseconds (sound speed 10 times a 10 m/s jet), far outside the budget. An incompressible or position-based scheme at 0.1 to 0.5 ms steps with 4 × 10⁶ particles and 2 × 10⁸ particle-updates per second costs 40 to 200 s of wall time per simulated second, so about 10 simulated seconds fit in 7 to 30 minutes. That buys a handful of arm revolutions with the wrong wall behaviour.

### 11.2 Evidence for candidate (a)

- Dishwasher measurements show a localised, intermittent jet zone and a slow, homogeneous downfall film covering the rest `[S28]` (section 1.1). The second is exactly what a depth-averaged film model describes well.
- A depth-averaged film coupled to Lagrangian spray is the established industrial approach (section 10.1) and has been validated for the partial-wetting transition on inclined panels `[S1]`.
- The wall-jet region has closed-form solutions validated against experiment for 2 to 2.7 mm water jets at 6,300 < Re_j < 32,000 `[S13]`, the dishwasher range.
- The phenomena that decide wet versus dry and sheared versus unsheared are contact-line phenomena at sub-millimetre scale (sections 5 and 6). They can be modelled on a surface grid of 0.5 to 1 mm and cannot be resolved by any affordable three-dimensional grid.
- Time-scale separation supports time-homogenisation: films respond in 0.2 to 5 s (section 1.2), jet momentum is forgotten in 1 to 7 cm (section 3.6), soil kinetics take minutes. The film is, however, unsteady within one arm period (drainage time is comparable to the period), so the periodic transient has to be simulated, not replaced by a steady state.

### 11.3 Where candidate (a) needs help: the case for a limited mixture (c)

- Liquid that is not a thin film: deep pools in cups and bowls (lumped reservoirs, section 7.1), the 4 to 5 mm rope at a film jump `[S14]`, pendant ridges on lower edges (edge reservoirs, section 12.5), sheets and ligaments leaving edges (hand-over to the droplet model).
- Transfer between items: drips, columns and sheets falling from one item onto another are a large part of the water supply to the lower rack and to shadowed surfaces. They must be emitted by the film layer and traced by the droplet layer.
- Impact kernels: the deposited fraction, splash fraction and tangential-momentum retention of drops and jets hitting a wet, moving film are inputs to the film model. A small, short, fully resolved simulation (or published correlations; jets sibling) is the right tool to calibrate them offline. That is the role I see for (b): an offline calibration instrument, not the run-time engine.

---

## 12. Recommended model and defaults

### 12.1 Summary

A two-dimensional, depth-averaged, inertial film model on each item's surface (and the tub walls and racks), with: a unified laminar/turbulent wall-friction law; hydrostatic, capillary and impact pressure; a hysteretic contact-line force with a frozen random contact-angle field; a sub-grid bead store; edge rules for separation, clinging and dripping; lumped pools and edge reservoirs; a film energy equation coupled to a thin-wall conduction model; passive scalars for liquor chemistry. Explicit finite volume on the GPU, well balanced and positivity preserving, run over a few spray-arm periods per cycle phase to obtain periodic statistics.

### 12.2 Equations

Equations (1) to (6) of section 4.2 with `β_m = 1.2`, `c_F = 1`, `c_ν = 3`, friction `f = max(24/Re_loc, 0.288 Re_loc^(−0.40))`, `β_m = 1.016` where the second branch is active, `Π = 0`, `τ_g = 0`.

### 12.3 Closures at a glance

| Closure | Formula | Section |
|---|---|---|
| Wall friction | `τ_w = ½ f ρ |u| u`, `f` as above | 3.3 |
| Wall shear reported to the soil model | `τ_w` from the friction law; inside `r < r_b` of a jet footprint, the jets sibling's boundary-layer value | 3.6, 4.3 |
| Heat transfer film to wall | `1.88 k/h` (laminar branch); `0.0106 Re^0.3 Pr^0.63 k (g/ν²)^(1/3)` (turbulent branch) | 9.1 |
| Mass transfer film to wall | `0.538 (D² τ_w/(μ x))^(1/3)` | 9.4 |
| Liquid properties | section 2.1 formulas for water; `σ` from the liquor table in 12.8 | 2 |
| Contact angles | per material and liquor from 12.7, mixed with soil coverage (2.3.4), plus a frozen random offset | 2.3, 12.4 |

### 12.4 Wetting model

Per cell: wet flag `w`, film thickness `h`, bead store `b` (equivalent thickness of immobile sub-grid drops), and frozen random offset `ξ` (normal, standard deviation 8°, correlation length 2 mm, seeded from the item identity so runs are reproducible).

Contact-line force. At every face between a wet cell and a dry cell, with `n_in` the unit vector pointing into the wet cell and `Δ` the cell width normal to the face:

```
F_a = β_cl σ (1 − cos(θ_a + ξ)) / Δ          resistance to advance (angle of the dry cell)
F_r = β_cl σ (1 − cos(θ_r + ξ)) / Δ          drive for retraction (angle of the wet cell)
F_hold = force per unit area along n_in that would make the wet cell's outward normal momentum zero at the end of the step
F_cl = clamp(F_hold, F_r, F_a) n_in
```

If `F_hold > F_a` the front advances against `F_a`; if `F_hold < F_r` the film retracts under the excess; otherwise the contact line is pinned and no flux crosses the face. This is Meredith's force `[S1]` with the hysteresis made explicit. `β_cl = 1` by default (Meredith's best value for steep surfaces).

Wetting of a dry cell. Liquid arriving in a dry cell by deposition goes to the bead store. The cell becomes film-wet when `h + b > δ_wet`, with

```
δ_wet = κ_w [15 μ² σ (1 − cos θ_a) / (ρ³ g_e²)]^(1/5),   g_e = g max(sin β, 0.1),   κ_w = 0.5
```

(half the Hartley–Murgatroyd thickness, following Meredith's relaxed threshold for spray-wetted cells), or when a neighbouring film front advances into it.

Drying of a wet cell. When `h` falls below `δ_dry = 2 µm`: if `θ_r < 5°` the cell stays wet and keeps its thin film (it drains by Jeffreys and evaporates); otherwise the remaining liquid moves to the bead store and the cell becomes dry.

Bead store. Beads are immobile up to a capacity

```
b_max = C_b l_c (cos θ_r − cos θ_a) / max(sin β, 0.1),   C_b = 0.03
```

which is 46 µm (46 g/m²) for polypropylene and 13 µm for glass on a vertical surface with water `[ESTIMATED]`. Excess above `b_max` is returned to the film as a wet cell (a running drop). Beads evaporate, are absorbed when a film front passes, and count as "wet, zero shear" for the soil model.

### 12.5 Edges, drips, pools

Edge classification (per placement): a face between cells whose normals differ by more than 30°, or a cell with `|κ_s| > 500 1/m`, is an edge with radius `r_e = max(1/|κ_s|, mesh edge radius)`.

Inertial separation at an edge. With `We_e = ρ |u·t|² h/σ` (`t` = direction across the edge):

```
We_c = max( 2 ,  C_tp (r_e/h)(1 + cos θ_a) ),   C_tp = 1
if We_e > We_c:  separated fraction  φ = clamp(0.882 − 1.908 exp(−(We_e/We_c)/1.264), 0, 1)
                 emit φ q·t as a sheet (thickness h, velocity u) to the droplet layer;  the rest continues round the edge
else:            all of the film continues round the edge
```

The threshold combines the Taylor–Culick floor and the teapot scaling `[S20]`; the partial-separation curve is Zhang et al.'s fit `[S6]` applied to `We_e/We_c` in place of the Friedrich force ratio, which is my adaptation `[ESTIMATED]`.

Edge reservoirs. Every edge segment, tip or boundary where the tangential gravity on all adjoining faces points towards it is a drip site with a line or point reservoir of mass `m_e`. Inflow is the film flux arriving. Sites along a horizontal edge are spaced at `λ_d = 2π sqrt(2) l_c`. Each site releases:

```
drop mode (site inflow below the column threshold):  when m_e ≥ m_d, emit one drop of mass m_d at rest
      broad wetted edge:          m_d = ρ (π/6)(3.3 l_c)³
      tip or thin edge, wetted perimeter P:   m_d = 0.65 σ P / g
column mode (edge loading above Γ_c = 0.048 μ Ga^0.301):  emit a continuous stream at the film velocity
sheet mode (edge loading above Γ_s = 0.72 μ Ga^0.236):    emit a sheet
Ga = ρ σ³/(μ⁴ g)
```

The thresholds are the Hu–Jacobi transitions `[S22]` with `Γ` taken per side. After spraying stops, each site keeps a last drop of up to `m_d`.

Undersides. Where `G_n < 0` the solver resolves pendant ridges and drops directly. A pendant bulge is cut off and emitted as a drop of diameter `3.3 sqrt(σ/(ρ|G_n|))` when its height exceeds `2.2 sqrt(σ/(ρ|G_n|))` `[RECALLED: maximum pendant-drop height]`. On grids coarser than 2 mm use the Brun rule instead: remove thickness above `h* = 3 l_c cos α/(1.62208 sin^(3/2) α)` `[S4, S12]`.

Wall-jet departure from undersides. A fast film on an underside leaves the surface where its momentum flux falls to `σ` (`β_m ρ u² h ≤ σ`) `[S13, eq. 50]`; emit it as a sheet. On upward and vertical faces the same condition marks the film jump and needs no rule: the contact-line force produces it.

Pools. Basins deeper than 3 mm are lumped reservoirs (section 7.1) with the mixing model of section 7.3, `η_mix` chosen by feeding mode. Flat tops hold puddles through the pinned-edge rule: at a convex edge bounding an upward-facing region, the contact line advances over the edge only when the local free-surface angle exceeds `θ_a + (180° − φ)`; in the height-field solver this is implemented by using `θ_a,edge = min(θ_a + 180° − φ, 175°)` in `F_a` for faces on such edges.

Contacts. Each item–item or item–rack contact holds a capillary bridge reservoir of 20 µL `[ESTIMATED]` that fills from either surface and never drains.

### 12.6 Numerical scheme

1. Grid: quadrilateral cells in a per-item atlas at three levels. 2 mm where the film stays continuous (`θ_r ≤ 10°` in the current liquor: glass and glazed ceramic in wash liquor, and the tub walls); 1 mm by default; 0.5 mm on rivulet-prone materials (`θ_r > 20°`) and on undersides within 10° of horizontal. Each item is its own domain with its own time step; items interact only through deposition and drips. Per-cell constants as listed in section 10.5.
2. Unknowns: `h`, `q` (2 components), `h T_f`, `h c_k`, `w`, `b`; per reservoir: mass, temperature, scalars.
3. Step (explicit, second-order strong-stability-preserving Runge–Kutta, or forward Euler at half the step):
   a. Add deposition and impact sources from the droplet layer (`S_h`, `S_q`, `p_imp`, heat, scalars).
   b. Reconstruct `h`, `q` and the potential `Φ = −g·x_s + G_n h` at faces with a minmod limiter; apply hydrostatic reconstruction so that uniform `Φ` gives zero flux.
   c. Compute HLL or central-upwind fluxes for mass, momentum and scalars with wave speeds `u_n ± sqrt(max(G_n, 0) h + 4 σ h/(ρ Δx²))`.
   d. At wet/dry faces apply the contact-line rule of 12.4; at edge faces apply 12.5.
   e. Limit outgoing fluxes so no cell loses more than it holds.
   f. Add the capillary source `(σ h/ρ) ∇_s(κ_s + ∇_s² h)` and, where `G_n < 0`, the destabilising hydrostatic source, using a five-point Laplacian; clamp `|∇_s h|` to 0.5 in the Laplacian near contact lines.
   g. Update `h`, `q`; apply wall friction implicitly: `q ← q / (1 + Δt f |u|/(2h))`.
   h. Update `w` and `b`; exchange with reservoirs; apply evaporation; update wall temperatures.
4. Time step: `Δt = 0.3 · min[Δx/(|u| + c)]` and `Δt ≤ 0.35 Δx² sqrt(ρ/(σ h_max))`; typically 0.5 to 1 ms at 2 mm, 0.2 to 0.5 ms at 1 mm, 0.1 to 0.3 ms at 0.5 mm, and less while a jet footprint is on the item.
5. Velocity from flux: `u = sqrt(2) h q / sqrt(h⁴ + max(h⁴, ε⁴))`, `ε = 1 µm`.
6. Only cells that are wet, hold beads, or received deposition this step need updating; keep an active-cell list per item.
7. Time-homogenisation: for each quasi-steady cycle phase, run 2 warm-up arm revolutions and 1 to 2 measured revolutions; pools and wall temperatures, which have longer memory, are advanced analytically between samples using the per-revolution net fluxes. Re-sample when liquor temperature, liquor surface tension or the soil state on a surface has changed enough to move a contact angle by more than about 5°.

Cost `[ESTIMATED; assumptions to be checked by the numerics sibling]`: 6 m² of item surface plus 2.5 m² of tub and rack at a uniform 1 mm is 8.5 × 10⁶ cells. At an assumed 1 × 10⁹ cell-updates per second on the M3 Pro GPU and `Δt = 0.4 ms` (2,500 steps per simulated second), one simulated second costs about 21 s of wall time with every cell active and about 7 s if a third are active, for a single-stage update; a two-stage scheme doubles both. Sampling 6 phases at 8 simulated seconds each is 48 simulated seconds: 6 to 17 minutes single-stage. That is a large share of the 30-minute budget. The three-level grid, per-item time steps and active-cell lists are what make it fit; a uniform 0.5 mm grid costs 8 times more than the uniform 1 mm grid and does not fit. The assumed throughput is the number to verify first.

### 12.7 Default parameters per material

Contact angles in degrees, advancing / receding. All are `[ESTIMATED]` defaults anchored to the measured values of section 2.3.1; the anchors are named. They are the first things to calibrate.

| Material | Clean water (pre-rinse, final rinse without rinse aid) | Main-wash liquor (σ ≈ 40 mN/m) | Final rinse with rinse aid (σ ≈ 45 dynamic) | Anchor |
|---|---|---|---|---|
| Soda-lime glass | 35 / 10 | 15 / 3 | 15 / 3 | 36.1 / 11.6 `[S14]` |
| Borosilicate glass | 40 / 15 | 15 / 3 | 15 / 3 | 42.0 / 15.2 (saliva) `[S29]` |
| Glazed ceramic, porcelain | 45 / 15 | 20 / 5 | 20 / 5 | tile glaze about 52 (search summary) |
| Stainless steel | 80 / 30 | 45 / 10 | 55 / 20 | 92 static; 66 to 81 after adsorbing polymers `[S27]`; droplets persist on steel with rinse aid `[S27]` |
| Polypropylene | 95 / 60 | 50 / 25 | 55 / 25 | 90.2 / 32.3 `[S14]`; 102.1 `[S26]`; 17 to 35 with rinse-aid surfactant at equilibrium `[S45]` |
| Polyethylene | 96 / 70 | 45 / 20 | 50 / 20 | 96 `[S26]` |
| Melamine | 75 / 40 | 35 / 10 | 40 / 12 | between steel and PTFE `[S29]` |
| SAN | 80 / 50 | 35 / 10 | 40 / 12 | PS 87.4, ABS 80.9 `[S26]` |
| Copolyester (Tritan-type) | 80 / 50 | 30 / 8 | 35 / 10 | PET 72.5, PC 82 `[S26]` |
| PTFE non-stick coating | 110 / 90 | 70 / 45 | 72 / 50 | 109.2 `[S26]`; 115.2 / 29.5 (saliva, rough sheet) `[S29]` |
| Silicone | 108 / 80 | 65 / 40 | 68 / 45 | 107.2 `[S26]` |
| Solid fat soil layer | 109 / 85 | 55 / 30 | - | paraffin 108.9 `[S26]` |
| Hydrated starch or protein soil | 40 / 10 | 20 / 5 | - | no anchor |

Thermal properties and wall thicknesses: table in section 9.2.

Model constants:

| Constant | Default | Range | Basis |
|---|---|---|---|
| `β_cl` contact-line force factor | 1.0 | 0.4 to 1.0 | `[S1]` |
| Random contact-angle standard deviation | 8° | 5° to 10° | `[S1]` used 10° |
| `κ_w` wetting threshold factor | 0.5 | 0.3 to 1 | `[S1]` |
| `δ_dry` | 2 µm | 1 to 10 µm | numerical |
| `C_b` bead capacity factor | 0.03 | 0.01 to 0.06 | section 8.2 |
| `C_tp` teapot factor | 1 | 0.5 to 3 | `[S20]`, prefactor uncertain |
| Drop diameter factor | 3.3 | 3.0 to 3.3 | `[S4]` |
| Drip-site spacing | `2π sqrt(2) l_c` | `2π l_c` to `2π sqrt(3) l_c` | `[S12, S23]` |
| `η_mix` | 0.9 jet-fed; 0.5 through-flow; 0.1 short-circuit | section 7.3 | estimate |
| Pool switch depth | 3 mm | 2 to 5 mm | section 7.1 |
| Contact-bridge volume | 20 µL | 5 to 50 µL | estimate |

### 12.8 Liquor defaults

| Phase | T, °C | σ, mN/m | μ and ρ |
|---|---|---|---|
| Pre-rinse | 15 to 30 | 60 | water at T |
| Main wash | 45 to 65 | 40 | water at T |
| Intermediate rinse | 30 to 50 | 55 | water at T |
| Final rinse with rinse aid | 50 to 70 | 45 | water at T |
| Final rinse without rinse aid | 50 to 70 | 65 | water at T |

Phase temperatures are placeholders; the machine sibling's cycle definition governs.

### 12.9 Outputs to the soil and scoring models

Per surface cell and per sampled phase: fraction of time film-wet, bead-wet and dry; longest dry interval; time-mean, 95th-percentile and peak wall shear stress; mean film thickness and velocity; mean and peak film temperature and the wall-surface temperature; mass-transfer coefficient; flux-weighted liquor concentrations (to distinguish fresh from run-off liquor); condensation flux. Per pool: submerged area, volume, concentration history, settled solids. At the end of the cycle: residual water per item as film, beads, edge drops, contact bridges and pools.

### 12.10 Validation cases with published targets

| Case | Target | Source |
|---|---|---|
| Steady film on an incline | Nusselt thickness, velocity and shear to 2% | 3.1 |
| Lake at rest in a bowl | zero velocity to round-off | 4.2 |
| Drainage of a plate | Jeffreys `h = sqrt(μ s/(ρ g t))` | 8.1 |
| Rivulet-to-film transition on acrylic, water 43 °C | transition at 0.125 to 0.21 kg/(m s) at 90° and 0.108 to 0.174 at 5°; wetted fraction 0.1 to 0.2 below it | `[S1]` |
| Radial flow zone of a 2 mm jet, 0.6 to 4 L/min | film-jump radius per equation 51 of `[S13]`; insensitive to material at high flow | `[S13, S14]` |
| Film under an inclined plane | drips at `h = 0.52 l_c`, 81° from vertical; none at `0.55 l_c`, 60.5° | `[S12]` |
| Pendant-drop spacing under a horizontal edge | 22 mm for water at 25 °C | `[S23]` |
| Puddle height | `2 l_c sin(θ/2)` | 5.1 |
| Drop on an incline | slides when `ρ g V sin β > w σ (cos θ_r − cos θ_a)` | 5.7 |
| Pouring over a rounded edge | clinging below `We_c ≈ (r_i/h)(1 + cos θ)`, never below 2 | `[S19, S20]` |

---

## 13. Calibration parameters

What real-world tests should measure, in order of expected influence on scores.

| # | Parameter | Expected range | How to measure |
|---|---|---|---|
| 1 | Receding and advancing contact angles of each tableware material in each liquor, at temperature, after repeated wash cycles | section 12.7; receding angle uncertain by ±20° on plastics and steel | tilting-plate or sessile-drop goniometry with liquor sampled from the machine; repeat on aged items |
| 2 | Dynamic surface tension of wash and rinse liquors at surface ages 0.01 to 1 s, 20 to 70 °C | 30 to 55 mN/m | bubble-pressure tensiometer |
| 3 | Wetted-area fraction and rivulet pattern on each material under known spray | 0.1 to 1 | high-speed or infrared imaging through a window, as in `[S1]` |
| 4 | `β_cl` and the random-angle spread | 0.4 to 1.0; 5° to 10° | fit to item 3 and to the rivulet-to-film transition flow rate |
| 5 | Residual water per item by material after the final rinse and after drying, as film, beads, edge drops and pools | beads 10 to 60 g/m²; edge drops 0.1 to 0.35 mL per site | weigh items; photograph; with and without rinse aid |
| 6 | `C_b` bead capacity | 0.01 to 0.06 | from item 5 |
| 7 | Film thickness and velocity on plates during a wash | 70 to 500 µm; 0.03 to 1.5 m/s | fluorescence or confocal-chromatic thickness probe; particle tracking |
| 8 | Edge behaviour at plate and glass rims: fraction separating versus clinging as a function of local flow | `C_tp` 0.5 to 3 | high-speed imaging of rims under controlled jets |
| 9 | Drip-site spacing, drop mass and mode transitions on lower edges of plates, glasses and cutlery | spacing 12 to 30 mm; drops 0.03 to 0.35 g | imaging and collection under controlled film flow |
| 10 | Pool mixing efficiency `η_mix` for cups, bowls, mug bases | 0.05 to 1 | dye or conductivity decay in pools during a rinse |
| 11 | Puddle retention on flat tops versus tilt angle | 0.3 to 5 mm | weigh at set tilts |
| 12 | Carry-over volume between phases, split into load, tub and sump | unknown; load share estimated 50 to 150 mL plus pools | tracer dilution between phases, with and without load |
| 13 | Wall-jet footprint on real items: film-jump radius and departure from undersides for the machine's nozzles | 20 to 60 mm | imaging on transparent items |
| 14 | Deposition, splash and tangential-momentum retention of spray on wet films | owned by the jets sibling | - |
| 15 | Item surface temperature history in wetted and shadowed positions | lag 1 to 30 s wetted; minutes shadowed | embedded thermocouples or thermal imaging |
| 16 | Condensation wetting of shadowed surfaces | up to about 80 µm per face per 30 K | weigh shielded cold items after a heated phase |
| 17 | Transition Reynolds number and friction of rained-on, pulsed films | `Re` 1,000 to 3,600 | from item 7 |

---

## 14. Sources

Tags here describe how each source was used. "Read" means text read this session; "summary" means seen only through a search-engine result summary; "recalled" means cited from memory.

| Key | Source | URL | Use |
|---|---|---|---|
| S1 | Meredith, Heather, de Vries, Xin (2011). A numerical model for partially-wetted flow of thin liquid films. WIT Trans. Eng. Sci. 70, 239-250 | https://www.witpress.com/Secure/elibrary/papers/MPF11/MPF11020FU1.pdf | read in full |
| S2 | OpenFOAM v8 `contactAngleForce.C` | https://cpp.openfoam.org/v8/contactAngleForce_8C_source.html | read |
| S3 | OpenFOAM v8 `curvatureSeparation.C` | https://cpp.openfoam.org/v8/curvatureSeparation_8C_source.html | read |
| S4 | OpenFOAM v8 `BrunDrippingInjection.C` | https://cpp.openfoam.org/v8/BrunDrippingInjection_8C_source.html | read |
| S5 | OpenFOAM `drippingInjection.C` | https://cpp.openfoam.org/v6/drippingInjection_8C_source.html | summary |
| S6 | OpenFOAM v2412 `filmSeparationModels::FriedrichModel` documentation (Friedrich et al. 2008, J. Fluids Eng. 130, 051301; Zhang et al. 2018, Int. J. Multiphase Flow 107, 67-81) | https://api.openfoam.com/2412/classFoam_1_1filmSeparationModels_1_1FriedrichModel.html | read |
| S7 | OpenFOAM v2512 `filmSeparationModels::OwenRyleyModel` documentation (Owen and Ryley 1985, Int. J. Multiphase Flow 11, 51-62) | https://api.openfoam.com/2512/classFoam_1_1filmSeparationModels_1_1OwenRyleyModel.html | read |
| S8 | OpenFOAM-8 tutorials `rivuletPanel` and `hotBoxes`, `constant/surfaceFilmProperties` | https://raw.githubusercontent.com/OpenFOAM/OpenFOAM-8/master/tutorials/lagrangian/reactingParcelFoam/rivuletPanel/constant/surfaceFilmProperties and https://raw.githubusercontent.com/OpenFOAM/OpenFOAM-8/master/tutorials/lagrangian/reactingParcelFoam/hotBoxes/constant/surfaceFilmProperties | read |
| S9 | OpenFOAM-8 `kinematicSingleLayer.C` | https://raw.githubusercontent.com/OpenFOAM/OpenFOAM-8/master/src/regionModels/surfaceFilmModels/kinematicSingleLayer/kinematicSingleLayer.C | read (selected lines) |
| S10 | Ansys Fluent Theory Guide 2024 R2, 17.2.2 Partial Wetting Effect | https://ansyshelp.ansys.com/public/Views/Secured/corp/v242/en/flu_th/flu_th_ewf_sec_wet.html | read (text; equations are images) |
| S11 | Ansys Fluent Theory Guide 17.2.1 Film Sub-Models; User's Guide 29.3 | https://ansyshelp.ansys.com/public/Views/Secured/corp/v242/en/flu_th/flu_th_ewf_sec_film_submodels.html | summary |
| S12 | Brun, Damiano, Rieu, Balestra, Gallaire (2015). Rayleigh-Taylor instability under an inclined plane. Phys. Fluids 27, 084107 | https://arxiv.org/abs/1503.02345 | read |
| S13 | Bhagat and Wilson (2016). Flow in the thin film created by a coherent turbulent water jet impinging on a vertical wall. Chem. Eng. Sci. (accepted manuscript) | https://www.repository.cam.ac.uk/bitstream/1810/256605/1/Bhagat_et_al-2016-Chemical_Engineering_Science-AM.pdf | read (sections 1 and 2, part of 4) |
| S14 | Aouad, Landel, Dalziel, Davidson, Wilson. Particle image velocimetry and modelling of horizontal coherent liquid jets impinging on and draining down a vertical wall | https://arxiv.org/abs/2407.14555 | read (text; equations partly garbled) |
| S15 | Hughes (2024). The effect of turbulence on the minimum thickness of a liquid film flowing down a vertical tube. Chem. Eng. Res. Des. 206, 210-225 | https://arxiv.org/abs/2403.06142 | read (introduction, appendices) |
| S16 | Roberts and Li (2006). An accurate and comprehensive model of thin fluid flows with inertia on curved substrates. J. Fluid Mech. 553, 33-73 | https://arxiv.org/abs/chao-dyn/9906011 | read (introduction, sections 5 and 6.1) |
| S17 | Vantzos, Azencot, Wardetzky, Rumpf, Ben-Chen (2017). Functional thin films on surfaces. IEEE TVCG 23(3) | https://ddg.math.uni-goettingen.de/pub/ftf_tvcg.pdf | read (sections 1 and 2) |
| S18 | Wang, Miller, Turk (2007). Solving general shallow wave equations on surfaces. Symp. Computer Animation | https://faculty.cc.gatech.edu/~turk/paper_pages/2007_shallow_waves/shallow_water.pdf | read (sections 1 to 3) |
| S19 | Duez, Ybert, Clanet, Bocquet (2010). Wetting controls separation of inertial flows from solid surfaces. Phys. Rev. Lett. 104, 084503 | https://arxiv.org/abs/0910.3306 | read |
| S20 | Bouwhuis and Snoeijer (2015). The effect of surface wettability on inertial pouring flows | https://arxiv.org/abs/1507.05931 | read |
| S21 | O'Rourke and Amsden (1996). A particle numerical model for wall film dynamics in port-injected engines. SAE 961961 | https://digital.library.unt.edu/ark:/67531/metadc687967/m2/1/high_res_d/373884.pdf | read |
| S22 | Jafar et al., 16th Australasian Fluid Mechanics Conference paper quoting the Hu and Jacobi (1996) mode-transition correlations | https://people.eng.unimelb.edu.au/imarusic/proceedings/16/Jafar.pdf | read |
| S23 | ENCIT 2006 paper CIT06-0254 on falling-film flow between horizontal tubes (Taylor wavelengths; Yung et al.; Mitrovic; Hu and Jacobi 1998) | https://abcm.org.br/app/webroot/anais/encit/2006/arquivos/Multiphase%20Systems/CIT06-0254.pdf | read |
| S24 | Mascarenhas and Mudawar (2013). Int. J. Heat Mass Transfer 64 (file 2013-06), Tables 2 and 3 | https://engineering.purdue.edu/mudawar/files/articles-all/2013/2013-06.pdf | read |
| S25 | Shmerler and Mudawar (1988). Local evaporative heat transfer coefficient in turbulent free-falling liquid films. Int. J. Heat Mass Transfer 31 | https://engineering.purdue.edu/mudawar/files/articles-all/1988/1988_3.pdf | read (parts) |
| S26 | Diversified Enterprises. Critical surface tension and contact angle with water for various polymers | https://www.accudynetest.com/polytable_03.html?sortby=contact_angle | read |
| S27 | US 8,277,568 B2, Rinse aid (Examples 1 to 6) | https://patents.google.com/patent/US8277568B2/en | read (first 100,000 characters) |
| S28 | Pérez-Mohedano (2016). Cleaning principles in automatic dishwashers. EngD thesis, University of Birmingham | https://etheses.bham.ac.uk/id/eprint/6590/ | read (chapters 2 to 4, searched) |
| S29 | Characteristics of respiratory microdroplet nuclei on common substrates | https://arxiv.org/abs/2105.10024 | read (contact-angle section) |
| S30 | Le Grand-Piteira, Daerr, Limat (2006). Meandering rivulets on a plane. Phys. Rev. Lett. 96, 254503; Schmuki and Laso (1990). J. Fluid Mech. 215, 125-143 | https://arxiv.org/abs/physics/0510089 | summary |
| S31 | Clanet and Lasheras (1999). Transition from dripping to jetting. J. Fluid Mech. 383, 307-326 | https://researchportal.ip-paris.fr/en/publications/transition-from-dripping-to-jetting/ | summary |
| S32 | Jeffreys (1930). The draining of a vertical plate. Proc. Camb. Phil. Soc. 26, 204-205; Xue and Stone (2020). Phys. Rev. Lett. 125, 064502 | https://par.nsf.gov/servlets/purl/10268476 | summary |
| S33 | Scheid, Kofman, Rohlfs (2016). Phys. Fluids 28, 044107; Kofman et al. (2018); Blyth, Lin, Tseluiko (2023). J. Fluid Mech. | https://bscheid.ulb.ac.be/wp-content/uploads/2016/12/2016_POF_28_044107.pdf | summary |
| S34 | Morison, Worth, O'Dea (2006), minimum wetting rates in falling-film evaporators, as quoted in S15; bibliographic details not checked | - | via S15 |
| S35 | El-Genk and Saber (2001). Int. J. Heat Mass Transfer 44, 2809-2825; Saber and El-Genk (2002), WIT | https://www.witpress.com/Secure/elibrary/papers/AFM02/AFM02022FU.pdf | fetched, equations unreadable; correlation recalled |
| S36 | Ruyer-Quil and Manneville (2000). Improved modeling of flows down inclined planes. Eur. Phys. J. B 15, 357-369 | https://epjb.epj.org/articles/epjb/abs/2000/10/b9591/b9591.html | summary |
| S37 | Schwartz and Eley (1998). J. Colloid Interface Sci. 202, 173-188; recent users | https://arxiv.org/abs/2310.05552 | summary |
| S38 | Kurganov and Petrova (2007). Commun. Math. Sci. 5, 133-160; Audusse et al. (2004). SIAM J. Sci. Comput. 25, 2050-2065; Bollermann et al. (2011, 2013); Chertock et al. (2015) | - | recalled |
| S39 | Stam (2003). Flows on surfaces of arbitrary topology. ACM TOG 22(3); Azencot et al. (2015); Vantzos, Raz, Ben-Chen (2018). Real-time viscous thin films. ACM TOG 37(6), 281 | https://history.siggraph.org/?p=198061 | summary and recalled |
| S40 | Film thickness and glycerol concentration mapping of falling films (definitions of Re and Ka) | https://pmc.ncbi.nlm.nih.gov/articles/PMC9785223/ | read (definitions) |
| S41 | IAPWS release on the surface tension of ordinary water substance (1994); Kell (1975) density fit; Vogel-type viscosity fit | - | recalled; table values computed from the formulas |
| S42 | Furmidge (1962). J. Colloid Sci. 17, 309-324; ElSherbini and Jacobi (2006). J. Colloid Interface Sci. 299, 841-849 | https://experts.illinois.edu/en/publications/retention-forces-and-contact-angles-for-critical-liquid-drops-on- | summary |
| S43 | de Gennes, Brochard-Wyart, Quéré (2003). Capillarity and Wetting Phenomena; Redon, Brochard-Wyart, Rondelez (1991). Phys. Rev. Lett. 66, 715; Buguin, Vovelle, Brochard-Wyart (1999). Phys. Rev. Lett. 83, 1183 | https://arxiv.org/abs/2112.12896 (quotes the critical thickness) | recalled; summary |
| S44 | Button et al. (2010), water bells, as quoted in S13 | - | via S13 |
| S45 | US 7,026,276; US 4,436,642; US 2005/0143280; supplier data sheets for low-foam alcohol alkoxylates | https://patents.google.com/patent/US4436642 | summary |
