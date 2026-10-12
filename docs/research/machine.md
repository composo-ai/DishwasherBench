# Spotless research dossier: domestic dishwasher machine engineering data ("machine")

> **Superseded as the machine model.** This dossier describes a generic 60 cm dishwasher
> ("SPOT-60"), the baseline the project started from on 8 October 2026. The machine that is
> simulated is one real Bosch: `machine-bosch-smv4hax40g.md`, and above it the first-hand
> measurements in `docs/reference/owner-measurements.md`. This dossier is still the source for
> what is generic (nozzle data, hydraulics, failure modes). The index of the documents is
> `docs/README.md`.

Author: machine research specialist. Date: 2026-10-08.
Scope: geometry, spray arms, hydraulics, filters, cycle programmes, energy/water figures and loading-related failure modes of a generic modern 60 cm European-layout built-in dishwasher, plus a complete parametric baseline machine ("SPOT-60") that can be implemented directly.

## 0. How to read this dossier

### 0.1 Confidence tags

Every quantitative value carries exactly one tag.

| Tag | Meaning |
|---|---|
| [VERIFIED] | I saw the value in source text fetched and read this session (PDF text extraction or fetched page). Where the suffix "(snippet)" follows the source key, the value was seen only as a quoted extract in a search-result summary and the page itself could not be opened (HTTP 403 or similar); treat those as weaker. |
| [RECALLED] | From my own memory; the source was not opened this session. Treat as a hypothesis to check. |
| [ESTIMATED] | My own derivation or engineering judgement; the derivation is shown or referenced. All such values are calibration parameters. |

Source keys such as [S1] refer to the "Sources" section at the end.

### 0.2 Research limits (read this before trusting the gaps)

- The session's shared web-search budget ran out roughly half-way through this work. After that I could only fetch URLs I already knew. Consequences: I could not find a manufacturer drawing or teardown with rack wire diameters, tine pitch and tine heights; I could not open a Bosch/Siemens programme table; I could not open EUR-Lex (it returned an empty page), IEC/EN 60436 text, or any published pump Q-H curve for a European household circulation pump.
- No public source I found gives a complete nozzle table (position, diameter, angles) for any European arm. The only complete nozzle direction table in the open literature is for the lower arm of a Whirlpool DU750 (US machine) [S1]. It has positions and angles but no diameters.
- The ASKO spray-arm thesis [S3] masks every rpm and kPa value ("masked rpm") for confidentiality.
- So the baseline machine in section 11 is a self-consistent engineering reconstruction anchored on a modest number of verified numbers. Its hydraulic flow rate, the rack tine geometry and the phase-by-phase programme timings are the three areas with the weakest evidence.

### 0.3 Coordinate system and symbols (used throughout)

- Origin O: on the lower spray arm rotation axis at tub-floor level (the same convention as the PEPT thesis, which puts the origin "at the bottom centre of the dishwasher, in line with the rotational axis of the spray arm" [S1]).
- x: left to right seen from the front, y: front (door) to back, z: up. Units mm unless stated.
- Nozzle direction angles follow [S1]: theta_jet is the jet direction angle in the x-y plane, rho_jet is the elevation above the x-y plane (90 deg = vertical up). The thesis code uses v_z = v sin(rho), v_y = v cos(rho) sin(theta), v_x = v cos(rho) cos(theta) [VERIFIED] [S1, appendix code]. In this dossier theta is expressed in the arm-fixed frame: theta = 0 deg points radially outward along the arm half that carries the nozzle, theta = 90 deg is tangential (trailing, i.e. opposite to the arm's direction of travel) [ESTIMATED interpretation; the thesis does not state which arm half each nozzle is on].
- SI symbols: rho_w water density (kg/m3), g = 9.81 m/s2, p gauge pressure (Pa), Q volumetric flow (m3/s; tables in L/min), N pump speed (rpm), omega arm angular speed (rad/s), C_d discharge coefficient, C_v velocity coefficient, A nozzle area (m2).

## 1. Evidence base at a glance

| Key | Source | What it gives | Quality |
|---|---|---|---|
| S1 | Perez-Mohedano, EngD thesis, Univ. Birmingham 2016 (P&G / Whirlpool) | Whirlpool DU750: interior dimensions, lower-arm nozzle table (R, theta, rho), 35 rpm, arm height, jet velocities by PEPT and CFD, 5 L fill, drain carry-over, CFD cost | Primary, best single source |
| S2 | JRC preparatory study for the EU ecodesign/label revision (Boyano et al. 2017) | Programme phases, water per intake, typical temperatures, programme energy/water/time table, drying technologies, pump power, bill of materials | Primary, EU-wide |
| S3 | Tsouknidas and Zhang, MSc thesis, Chalmers 2010 (ASKO) | Effect of arm speed and pressure on cleaning (direction only; values masked), arm torque bound, hub diameter | Primary, numbers masked |
| S4 | Galban, MSc thesis, Univ. Louisville 2014 (GE) | Mid-arm flow in GPM and minimum rpm | Abstract page only |
| S5 | Michigan State ME481 poster (Whirlpool mid arm) | 42 L/min at 35 kPa | Student poster |
| S6, S7 | Zhu et al. 2021; Ning et al. 2022 (Jiangsu Univ. / FOTILE) | Dishwasher pump design point 55 L/min, 2 m, 3000 rpm | Peer-reviewed, sink-type machine |
| S8 to S24 | Patents (Whirlpool, Electrolux, GE, BSH, Miele, Samsung) | Arm rpm ranges, pump rpm, nozzle diameters, filter meshes, third-rack clearances, zeolite parameters, heater power | Primary but ranges, not designs |
| S25 to S30 | Manufacturer manuals, data sheets, service tech sheets | Programme temperatures, water, energy, duration, rinse-aid dose, US service specs | Primary |
| S31 | Hoak, Parker, Hermelink, ACEEE 2008 | Measured US cycles: fills, heater, energy | Peer-reviewed conference |

## 2. Geometry

### 2.1 Cabinet and tub

| Quantity | Value | Tag | Source and location |
|---|---|---|---|
| Full-size appliance class | width 60 cm, depth 55 to 60 cm, height 81 to 87 cm adjustable, 12 to 14 place settings (15 appearing) | [VERIFIED] | S2 sec. 4.2.1.2 |
| Slim-line class | width about 45 cm, 8 to 10 place settings | [VERIFIED] | S2 sec. 4.2.1.2 |
| Example appliance outer size (Miele G 7281 SCVi, 14 ps) | 598 W x 805 H x 550 D mm, niche height 805 to 870 mm, net weight 48.0 kg, depth with door open 1165 mm | [VERIFIED] | S26 technical data |
| Appliance heights offered (Miele) | standard 81.5 cm, XXL 85.5 cm | [VERIFIED] | S25 p. "Guide to the appliance" |
| Interior loading volume, Whirlpool DU750 (US, 3 arms, used for PEPT) | 560 x 500 x 620 mm (W x D x H) | [VERIFIED] | S1 sec. 3.2 |
| Interior used in the same author's geometric jet model | 540 x 500 x 620 mm | [VERIFIED] | S1 Table 5.4 |
| Average machine mass, 13 ps base case | 49.1 kg | [VERIFIED] | S2 Table 5.12 |
| Stainless steel mass in a 12 ps machine (tub, door liner, etc.) | 8.69 kg (9 ps: 6.87 kg) | [VERIFIED] | S2 Table 4.8 (Lot 14 data) |
| Bitumen damping mass, 12 ps | 6.09 kg | [VERIFIED] | S2 Table 4.8 |
| Polypropylene mass, 12 ps (sump, base, arms, etc.) | 4.95 kg | [VERIFIED] | S2 Table 4.8 |
| Baseline tub interior for SPOT-60 (81.5 cm class, with third rack) | W_t = 546 mm (range 540 to 560), D_t = 500 mm (range 490 to 520), H_t = 650 mm (range 600 to 710) | [ESTIMATED] | Width and depth bracket S1; height from the stack-up in sec. 2.6 |
| Tub material and wall | austenitic stainless steel sheet 0.4 to 0.5 mm, bitumen pads and fleece outside | [RECALLED] | general construction knowledge; consistent with S2 Table 4.8 masses |
| Tub corner radii | vertical corners 25 to 40 mm, floor-to-wall 15 to 30 mm | [ESTIMATED] | deep-drawn tub practice |
| Floor slope to sump | 3 to 6 deg toward the sump | [ESTIMATED] | needed for drainage; calibrate |

Cross-check on the stainless mass: tub shell area for 546 x 500 x 650 mm (five faces plus door liner) is about 2 x (0.546 x 0.65) + 2 x (0.5 x 0.65) + 2 x (0.546 x 0.5) = 1.91 m2; at 0.45 mm and 7900 kg/m3 this is 6.8 kg, leaving about 1.9 kg for brackets and rails. Consistent with 8.69 kg [ESTIMATED check against S2].

### 2.2 Door and detergent dispenser

| Quantity | Value | Tag | Source |
|---|---|---|---|
| Dispenser location | on the inner door liner ("detergent is placed in a dispenser compartment found at the door") | [VERIFIED] | S1 sec. 2.1 |
| Dispenser construction (US service sheet) | one-piece unit: moulded detergent cup with spring-loaded cover plus built-in rinse-aid dispenser; released by an electrical actuator | [VERIFIED] | S30 |
| Detergent compartment capacity (Miele) | marks at 20 and 30 ml, maximum 3.5 tablespoons (about 50 ml) | [VERIFIED] | S25 "Detergent dispensing" |
| Rinse-aid reservoir capacity (Miele) | about 110 ml | [VERIFIED] | S25 "Adding rinse aid" |
| Rinse-aid dose per cycle (Miele) | adjustable 0 to 6 ml, factory default 3 ml | [VERIFIED] | S25 "Settings, Rinse aid" |
| Rinse-aid dose (EU survey) | default setting is typically 3 or 4 ml; base case 3 ml per cycle | [VERIFIED] | S2 sec. 5.1 (detergent assumptions) |
| US rinse-aid dial | 4 settings | [VERIFIED] | S30 |
| Pre-wash detergent | a small amount may be put on the inner door panel for programmes with a pre-wash | [VERIFIED] | S25 |
| Auto-open door gap | 100 to 125 mm measured at the inside top edge (Fisher and Paykel) | [VERIFIED] | S27 p. 2 to 3 |
| Baseline dispenser box position (SPOT-60) | lid centre at x = -70, z = 300 on the door liner plane y = -250; lid 95 W x 60 H mm; hinge at lid bottom edge, lid swings into the tub through 110 deg; swept keep-out volume 95 x 60 x 62 mm in front of the liner | [ESTIMATED] | typical layout: dispenser faces the gap between the lower-rack front row and the upper rack; calibrate from a real machine |
| Baseline rinse-aid outlet | 2 mm orifice beside the detergent lid, x = +10, z = 300 | [ESTIMATED] | |
| Door liner | recessed 15 to 25 mm beyond the tub flange; door hinge axis at floor level front edge | [ESTIMATED] | |

Dispenser obstruction evidence: "Detergent cover held closed or blocked by large dishes" is a listed cause of detergent left in the dispenser [VERIFIED] [S30]; Electrolux states the lid may open only partly because "it is stopped by the upper basket" [VERIFIED] [S44 (snippet)]; Whirlpool states dishes, utensils or racks blocking the door stop it opening [VERIFIED] [S44 (snippet)].

### 2.3 Sump and filter location

| Quantity | Value | Tag | Source |
|---|---|---|---|
| Hydraulic circuit | sump, circulation pump, spray arms, over the load, filter system, back to sump; drain pump empties the sump at phase ends | [VERIFIED] | S2 sec. 4.2.1 |
| Filter combination position | at the tub floor ("temperature was measured at the bottom, next to the filter combination") under the lower arm; the Miele lower arm must be removed to reach the filters | [VERIFIED] | S1 sec. 2.1; S25 "Cleaning the filters" |
| Residual water after a drain (carry-over) | typically 0.3 to 0.5 L | [VERIFIED] | S1 sec. 1.3 (Letzelter, personal communication) |
| Pump connections (BSH heat pump 00755078) | inlet 35/31 mm (outer/inner), outlet 30/25 mm, height 131 mm | [VERIFIED] | S33 |
| Baseline sump (SPOT-60) | cylindrical well, centre at (x, y) = (0, -40), diameter 150 mm, depth 85 mm below floor, working volume 1.2 L (range 0.8 to 1.6) | [ESTIMATED] | sized so that 3.8 L fill covers pipes (0.7 L) + airborne and film hold-up (1.2 L) + sump (1.2 L) + margin; see sec. 4.5 |
| Baseline flat fine filter | stainless plate 260 x 220 mm centred on the sump, around the cylinder | [ESTIMATED] | |
| Baseline cylinder (coarse + micro) | outer coarse cup diameter 60 mm x 105 mm tall; microfilter cylinder inside or around it, 190 cm2 | [ESTIMATED] | area from S15 range |

### 2.4 Racks

#### 2.4.1 What the sources give

| Quantity | Value | Tag | Source |
|---|---|---|---|
| Layout | two baskets (lower: large and heavy items; upper: glassware and small items); cutlery in a top tray, a door basket or a basket in the lower rack | [VERIFIED] | S1 sec. 2.1 |
| Rack construction | steel wire welded into a basket, then coated with nylon or PVC | [VERIFIED] | S45 (snippet: US5351837, US11272828) |
| Replacement lower rack overall size (US, Whirlpool W10728159 type) | 22 in x 20.5 in (559 x 521 mm), height 6 in without wheels and 7 in with wheels (152 / 178 mm) | [VERIFIED] | S45 (snippet) |
| Lower rack rollers | 8 rollers in pairs | [VERIFIED] | S20 |
| Tine rows in a configurable lower rack (BSH) | 8 tine rows, 2 per quadrant, 4 fixed tine-slot spacings (small to extra-large; values not given), tines fold flat | [VERIFIED] | S20 |
| Maximum vertical plate size | "about 33 to 35 cm" customary maximum | [VERIFIED] | S19 |
| Lower rack plate limit (Miele) | plates up to 35 cm when tilted | [VERIFIED] | S25 "Lower basket" |
| Upper rack height adjustment (Miele) | 3 levels, 2 cm between levels; can be set at an angle | [VERIFIED] | S25 "Adjusting the upper basket" |
| Middle (upper) rack position spacing (BSH) | positions about 25 mm apart | [VERIFIED] | S18 |
| Max plate, Bosch 81.5 cm class with cutlery drawer | upper rack 21 cm, lower rack 30 to 31 cm | [VERIFIED] | S38 (snippet) |
| Max plate, Bosch 86.5 cm class with cutlery drawer | upper rack 23 cm, lower rack 33 cm | [VERIFIED] | S38 (snippet) |
| User report: mid arm strikes plates above 27 cm although the manual says 28.5 cm | 27 cm practical limit (Bosch Serie 8, one user) | [VERIFIED] | S38 (snippet) |
| Third rack top-edge clearance to tub ceiling (BSH) | 9.0 to 10.5 mm (preferred 9.85) | [VERIFIED] | S18 |
| Third rack deepest point below ceiling (BSH) | 79.0 to 83.0 mm (preferred 81.08) | [VERIFIED] | S18 |
| Third rack bowl zones (BSH) | angled portions tilted 3 to 5 deg; sized for 6 in bowls | [VERIFIED] | S18 |
| Third-rack cutlery tine blocks (Samsung) | tine gaps 10, 7 and 3 mm; blocks of 5, 6 and 8 tines; block footprint 64 x 44 mm, equal to the span of four wires one way and three wires the other | [VERIFIED] | S21 |
| Cutlery basket (Bosch SMZ5100) | 7 compartments with dividers, hinged lid with grid, 0.243 kg | [VERIFIED] | S34 |
| Wire diameter example | about 4 mm chrome-plated steel in a free-standing dish rack patent (not a dishwasher) | [VERIFIED] | S45 (snippet: US6364130) |
| Plate spacing used as "typical" in the Whirlpool jet model | 20 mm gap between neighbouring plates; studied range 10 to 100 mm | [VERIFIED] | S1 Table 5.3, sec. 5.6 |
| Test load items (AHAM) | dinner plate 270 mm, dessert plate 160 mm, teacup 70 dia x 60 mm, glass 65 dia x 120 mm, bowl 120 mm | [VERIFIED] | S1 sec. 3.4 |

No source gave wire diameters, base-grid pitch, tine height or tine pitch for a dishwasher rack. Everything in 2.4.2 that is not in the table above is an estimate to be replaced by caliper measurements of a real rack (cross-link: items and standards specialists).

#### 2.4.2 Baseline rack specification (SPOT-60)

All values [ESTIMATED] unless a source key is given. "Pitch" is centre to centre.

Lower rack (LR)

| Parameter | Baseline | Range | Notes |
|---|---|---|---|
| Outer size | 525 W x 495 D x 160 H mm | W 515 to 560, D 485 to 525, H 150 to 180 | US snippet 559 x 521 x 152 [S45] |
| Base grid top surface height | z = 50 | 45 to 60 | from 30 mm arm plane + 20 mm gap [VERIFIED] [S1 sec. 5.2.3] |
| Frame (rim) wire | 5.0 mm steel + coating | 4.5 to 6.0 | |
| Base grid wires | 3.4 mm steel + coating; front-back wires at 35 mm pitch, left-right wires at 100 mm pitch | 30 to 45; 80 to 120 | opening about 31 x 96 mm: teaspoons, lids and chopsticks fall through |
| Tine wires | 3.4 mm steel + coating, 4.2 mm finished, hemispherical tip | 3.0 to 4.0 steel | |
| Coating | PA11/PA12 nylon powder 0.3 to 0.5 mm (premium) or PVC dip 0.6 to 1.0 mm (economy) | | friction: cross-link items specialist |
| Plate tine rows | 8 rows, 2 per quadrant [S20]; each row is a front-back rail with upright tines | | |
| Plate tine pitch along a row | 25 mm | 18 to 35 | S1 uses a 20 mm plate gap as typical; "small/medium/large/XL" spacings exist [S20] |
| Plate tine height above grid | 62 mm front rows, 75 mm rear rows | 50 to 90 | |
| Tine lean from vertical | 8 deg toward the tub centre | 0 to 15 | plates lean so that the soiled face looks at the arm |
| Fold-down rows | rear 4 rows fold flat (lever at the hinge rail) | | Miele: both right-hand rows lower [S25] |
| Wheels | 8 wheels, 40 mm diameter, on the door liner / tub rails | | [S20] count verified |
| Cutlery basket footprint | 240 x 135 mm, placed front-right or front-centre on folded tines | | |

Upper rack (UR)

| Parameter | Baseline | Range | Notes |
|---|---|---|---|
| Outer size | 505 W x 480 D x 125 H mm | H 110 to 150 | on telescopic side rails |
| Height positions (base grid top) | z = 350 / 375 / 400 | step 20 to 25 mm, 2 or 3 positions | 25 mm [VERIFIED] [S18]; 20 mm [VERIFIED] [S25] |
| Base grid | 3.2 mm wires; front-back at 30 mm pitch, left-right at 85 mm pitch | | |
| Tines | 3.0 mm steel, 40 mm tall, 22 mm pitch, 2 rows per side, lean 10 to 20 deg outward to tilt cups | | |
| Cup shelves | 2 per side, 225 x 85 mm, fold-down, shelf plane 75 mm above grid, with stemware notches 12 mm wide at 55 mm pitch | | Miele FlexCare cup rack adjustable in height and depth [S25] |
| Stemware holders | silicone-padded notches on the cup-shelf edge; supports glasses up to 240 mm when UR is low | | BSH third rack sized for 9 in stemware under it [S18] |
| Mid-arm docking | arm hub hangs under the UR centre; feed manifold runs under the UR to a docking port on the rear wall at each height position | | Miele: "middle spray arm" removed from under the UR [S25] |

Third rack / cutlery tray (TR)

| Parameter | Baseline | Range | Notes |
|---|---|---|---|
| Outer size | 500 W x 470 D mm | | |
| Top edge below ceiling | 10 mm | 9.0 to 10.5 | [VERIFIED] [S18] |
| Deepest point below ceiling | 81 mm | 79 to 83 | [VERIFIED] [S18] |
| Side sections | 45 mm deep, cutlery laid flat on edge between tine combs; comb tine gaps 10 / 7 / 3 mm | | gaps [VERIFIED] [S21] |
| Centre section | lowered V or step for ladles and small bowls, 70 mm deep, tilted 3 to 5 deg | | tilt [VERIFIED] [S18] |
| Grid | 2.5 mm wire, 16 to 22 mm pitch | | pitch derived from the 64 mm / four-wire and 44 mm / three-wire statement in S21 |

Cutlery basket (CB) for machines without a tray

| Parameter | Baseline | Range | Notes |
|---|---|---|---|
| Outer size | 240 L x 135 W x 215 H mm (245 with handle) | | |
| Compartments | 7 [VERIFIED] [S34]: six cells about 62 x 55 mm plus one long cell 125 x 55 mm | | |
| Wall and floor | PP lattice 2 mm thick; floor slots 3.5 x 14 mm | slots 3 to 5 mm | anything thinner than the slot pokes through and can stop the lower arm |
| Lid | hinged grid: round holes 9 mm and slots 9 x 26 mm at about 16 mm pitch, one item per opening | | keeps spoons from nesting |

### 2.5 Spray-arm and sprayer positions (geometry only; hydraulics in sec. 3 and 4)

| Quantity | Value | Tag | Source |
|---|---|---|---|
| Number of arms, Whirlpool DU750 | three (lower, medium, upper) | [VERIFIED] | S1 sec. 3.2 |
| Arms named by Miele | top spray arm, middle spray arm, bottom spray arm | [VERIFIED] | S25 "Guide to the appliance" |
| Lower arm nozzle plane height | 30 mm above the floor | [VERIFIED] | S1 sec. 5.2.3 and 5.6 |
| Gap from lower arm to the bottom of a plate | 20 mm | [VERIFIED] | S1 sec. 5.2.3 |
| Outermost lower-arm nozzle radius (DU750) | 238 mm, so the arm is about 490 to 500 mm long in a 560 mm tub | [VERIFIED] | S1 Table 5.7 |
| Lower-arm duct section assumed in the thesis | rectangular 10 x 35 mm | [VERIFIED] | S1 sec. 3.4.1 |
| Lower-arm hub (holder) inner diameter, ASKO | 21 mm | [VERIFIED] | S3 sec. 3.3.4 |
| Bosch upper arm with feed pipe 11010055 | 520 x 204 x 60 mm overall (arm plus rear feed pipe), 187 g, plastic | [VERIFIED] | S33 |
| PEPT coverage gap | "a small gap in coverage at around 100 mm radial position" caused by the arm design | [VERIFIED] | S1 sec. 4.4.1 |

### 2.6 Vertical stack-up and maximum item sizes (baseline)

Derivation of H_t = 650 mm [ESTIMATED], built from the verified pieces:

| Level | z (mm), UR low | z (mm), UR high | Basis |
|---|---|---|---|
| Tub floor / filter top | 0 | 0 | datum |
| Lower arm body | 8 to 30 | 8 to 30 | nozzle plane 30 [S1] |
| LR base grid top | 50 | 50 | 20 mm gap [S1] |
| Top of tallest LR item (7 mm clearance to mid arm) | 310 | 360 | |
| Mid arm body (23 mm thick), underside | 317 | 367 | |
| Mid arm upward nozzle plane | 340 | 390 | |
| UR base grid top | 350 | 400 | 50 mm travel in two 25 mm steps [S18] |
| Top of tallest UR item (4 mm clearance) | 565 | 565 | |
| TR deepest point | 569 | 569 | 81 mm below ceiling [S18] |
| Tub ceiling | 650 | 650 | |

Resulting limits: lower rack item height 260 / 285 / 310 mm and upper rack item height 215 / 190 / 165 mm for UR low / mid / high. A plate leaning 8 deg stands at D cos(8 deg) + small foot offset, so the 310 mm limit admits a plate of about 31 cm, which reproduces the Bosch 81.5 cm class figures (21 cm upper, 31 cm lower) [S38 (snippet)]. An XXL tub is the same stack plus 40 to 50 mm (33 cm lower, 23 cm upper) [S38 (snippet)]. Without a third rack the upper rack gains about 60 mm.

Plan-view limits: the lower arm sweeps a disc of radius 247 mm and the mid arm 232 mm inside a 546 x 500 mm rectangle. The tub corners are 370 mm from the axis, and about 30 % of the floor area lies outside the lower-arm disc (1 - pi 0.247^2 / (0.546 x 0.5) = 0.30); those regions are reached only by inclined jets, splash and run-off [ESTIMATED]. This is the "rectangular load, circular water distribution" problem described in S1 sec. 2.1.

## 3. Spray arms

### 3.1 What the literature gives

#### 3.1.1 The only published nozzle table: Whirlpool DU750 lower arm

Values from S1 Table 5.7 ("design parameters were measured externally"; arm at z = 30 mm; arm "assumed to rotate at 35 rpm", elsewhere "measured at 35 rpm (1.71 seconds per revolution)"). All ten rows [VERIFIED] [S1 Table 5.7, sec. 5.6 and 7.3.1.1].

| # | R_NZ (mm) | theta_jet (deg) | rho_jet (deg) | Reading (mine) |
|---|---|---|---|---|
| 1 | 238 | 90 | 55 | tip nozzle, tilted 35 deg off vertical in the tangential direction: a drive nozzle |
| 2 | 226 | 359 | 89 | vertical |
| 3 | 182 | 160 | 60 | tilted 30 deg, pointing inward |
| 4 | 145 | 305 | 70 | tilted 20 deg, outward and leading |
| 5 | 114 | 90 | 89 | vertical |
| 6 | 89 | 179 | 89 | vertical |
| 7 | 162 | 65 | 70 | tilted 20 deg, trailing and outward |
| 8 | 194 | 43 | 62 | tilted 28 deg, outward and trailing |
| 9 | 223 | 90 | 89 | vertical |
| 10 | 238 | 60 | 55 | tip nozzle, tilted 35 deg, trailing and outward: a drive nozzle |

Further facts from the same source, all [VERIFIED] [S1]:

- "The most common nozzle diameter (0.002 m) in the design of the lower spray arm" (sec. 3.4.1). Individual diameters are not tabulated.
- For the two test plates at x = +/-125 mm only jets 2 and 4 reach the left plate; on the right, jets 5, 6 and 9 cover well, 3 and 7 a little, and 1, 8 and 10 miss. "No global efficiency higher than 0.3 is achieved" (sec. 5.6). So coverage by direct jet impact is sparse and strongly position-dependent.
- For a soil tile in the lower rack the best jet hits it for 0.0272 s per revolution, 1.59 % of the 1.71 s period; a vertical jet (rho = 89 deg) hits it for 0.0013 s, 0.07 % (Table 7.5). Direct impingement is a brief periodic event.
- Jets leave the nozzle as coherent jets and travel in straight lines; fitted straight-line error is mostly below 2 mm, and "the rotational inertia given can be disregarded" (sec. 4.3). High-speed photographs through a Perspex side wall show the same.
- A whole water round trip (pump, arm, ejection, impact, downfall, sump) takes "typically less than 3 seconds" (sec. 4.2).

#### 3.1.2 Rotation speed

| Quantity | Value | Tag | Source |
|---|---|---|---|
| Lower arm, Whirlpool DU750, measured | 35 rpm (1.71 s per revolution) | [VERIFIED] | S1 sec. 7.3.1.1 |
| "Within the values typically found in commercially available" machines | 30 rpm (2 s per revolution) | [VERIFIED] | S1 sec. 5.2.3 |
| Typical range | about 25 to 45 rpm; example arm at about 38 rpm (driving-jet wall impacts 1.6 s apart) | [VERIFIED] | S9 |
| Minimum to avoid stalling | at least 15 rpm; target 40 rpm when the manifold supplies 20 to 40 L/min (claim: 20 to 60 L/min) | [VERIFIED] | S8 |
| Mid arm (GE) | minimum 20 rpm "for proper cleaning"; redesigned system 25 rpm | [VERIFIED] | S4 abstract page |
| Small upper (top) wash arm (GE) | 60 rpm, with a drive jet and six wash holes | [VERIFIED] | S32 |
| Volute/arm speeds studied for a sink-type machine | 0, 30 and 60 rpm | [VERIFIED] | S7 |
| Effect on cleaning (ASKO) | cleaning improves with higher pressure and lower rotation speed; the worst rotation speed lies between the "middle" and "high" levels; cost of higher pressure is noise | [VERIFIED] | S3 abstract, sec. 5 |
| Arm stall torque bound (ASKO) | a force gauge on a thread 0.2 m from the centre read less than 2 N for both arms, so less than 0.4 N m per arm | [VERIFIED] | S3 sec. 3.3.2 |
| "Rotation rate is a consequence of the total torque generated", produced by "one or more driving nozzles at the bottom of a spray arm" by reaction | qualitative | [VERIFIED] | S1 sec. 2.2.1 |

#### 3.1.3 Nozzle sizes, shapes and angles

| Quantity | Value | Tag | Source |
|---|---|---|---|
| Most common nozzle diameter, Whirlpool lower arm | 2 mm | [VERIFIED] | S1 sec. 3.4.1 |
| Special large openings with guide vanes (BSH) | at least 3.5 mm; 2 to 4 such openings; nozzle axis 10 to 90 deg to the arm plane; jet breaks up "a few centimeters" from the opening | [VERIFIED] | S12 |
| Valve-controlled large outlet nozzles (BSH) | larger than 3 mm, preferably 4 to 7 mm (5 to 6 mm); inclination 10 to 45 deg; valve opens at a pressure threshold "between 0.5 and 0 bar" | [VERIFIED] | S13 |
| Fan nozzles | fan plane at 90 +/- 45 deg to the rotation plane; the same nozzle may also drive the arm | [VERIFIED] | S43 (snippet: EP2789285) |
| Nozzle clogging / velocity trade-off | too small clogs with food, too large loses jet velocity | [VERIFIED] | S43 (snippet: US9010345) |
| Jet holes quoted on a consumer wiki | 1/16 to 1/8 in (1.6 to 3.2 mm) | [VERIFIED] | S46 (snippet; low reliability) |
| GE lower arm | "7 huge holes", also sprays downward to clean the filter | [VERIFIED] | S32 |
| Ranges studied in the Birmingham jet model | R 10 to 240 mm; theta 1 to 179 deg; rho 10 to 89 deg; nozzle 2 mm; 30 rpm | [VERIFIED] | S1 Tables 5.3, 5.4 |

#### 3.1.4 Pressure and jet velocity

| Quantity | Value | Tag | Source |
|---|---|---|---|
| Jet (ejection) velocity, PEPT, high pump speed, lower arm | mean 7.69 m/s, standard deviation 3.16 m/s | [VERIFIED] | S1 Table 4.1 |
| Same, manufacturer CFD (STAR-CCM+ VOF) | mean 7.24 m/s, standard deviation 2.30 m/s | [VERIFIED] | S1 Table 4.1 |
| Jet velocity used in the thesis's geometric model code | 9 m/s | [VERIFIED] | S1 appendix code ("veljet = 9") |
| Velocity inside the arm duct, PEPT | 1.67 / 1.17 to 1.18 / 0.71 to 0.79 m/s at high / medium / low pump speed | [VERIFIED] | S1 Table 4.2 |
| Free-fall return velocity, PEPT / CFD | mean 5.05 / 3.31 m/s | [VERIFIED] | S1 Table 4.1 |
| Maximum jet velocities implied by the thesis's Stokes numbers (39.1 / 26.1 / 13.0 with a 400 um, 1100 kg/m3 tracer and 2 mm nozzle) | 8.0 / 5.3 / 2.7 m/s at high / medium / low pump speed | [ESTIMATED] | St = tau_p v / d_c with tau_p = rho_p d_p^2 / (18 mu) = 9.78 ms, so v = St x 0.002 / 0.00978; inputs [VERIFIED] [S1 Table 3.2] |
| Mid-arm supply (Whirlpool student project) | 42 L/min at 35 000 Pa with drive nozzles, 34 L/min without (19 % less) | [VERIFIED] | S5 |
| Domestic spray pressure, patent background | 2 to 8 psi (14 to 55 kPa) | [VERIFIED] | S47 (snippet; patent not identified) |
| Lower / upper arm pressure, patent | 50 to 130 mbar lower, 20 to 75 mbar upper | [VERIFIED] | S47 (snippet; patent not identified, could not re-find) |
| Pressure sensor range used on a sink-type dishwasher pump | 0 to 20 kPa | [VERIFIED] | S6 |
| Consumer wiki figure of 20 to 25 psi at the hub | 138 to 172 kPa | [VERIFIED] | S46 (snippet); I judge this implausible, it would give 17 m/s jets and conflicts with every other source |

Consistency check [ESTIMATED]: Bernoulli gives v = sqrt(2 p / rho_w). 7.7 m/s corresponds to 30 kPa, 8.4 m/s to 35 kPa, 9 m/s to 40 kPa. The PEPT velocities, the code value and the 35 kPa student measurement agree. The 5 to 13 kPa patent range would give only 3.2 to 5.1 m/s, which matches the low and medium pump-speed PEPT velocities, so machines evidently span 5 to 45 kPa depending on programme and arm.

### 3.2 Baseline arms (SPOT-60)

Geometry, all [ESTIMATED] except where a source key is given.

| Parameter | Lower arm (L) | Mid arm (M) | Top arm (T) |
|---|---|---|---|
| Axis position (x, y) | (0, 0) | (0, 0) | (0, +20) |
| Tip radius | 247 mm (nozzle at 238 [S1]) | 232 mm | 135 mm |
| Nozzle plane z | 30 (up) [S1], 8 (down) | UR base - 10 (up), UR base - 33 (down) | 632 (down) |
| Body | PP, 2 lobes, duct 10 x 35 mm at root [S1] tapering to 8 x 20 mm at the tip, wall 1.5 mm | same, duct 9 x 30 to 7 x 18 mm | duct 8 x 20 mm |
| Mass | 0.19 kg | 0.16 kg (Bosch arm with feed pipe 0.187 kg [S33]) | 0.06 kg |
| Moment of inertia about axis (dry / water-filled) | 3.9e-3 / 6.3e-3 kg m2 | 2.9e-3 / 4.5e-3 kg m2 | 0.4e-3 / 0.5e-3 kg m2 |
| Hub inner diameter | 21 mm [S3] | 18 mm | 12 mm |
| Feed | directly from the pump discharge through the sump cover | rear riser (17 mm bore, 0.55 m) to a docking port, then a manifold under the UR | continuation of the riser to the ceiling |
| Design speed | 35 rpm [S1] | 30 rpm [S1 typical] | 60 rpm [S32] |
| Rotation sense seen from above | counter-clockwise | clockwise | clockwise |

Moment of inertia estimate: thin rod, I = m L^2 / 12 with L = 2 R_tip; water in the duct adds roughly 0.12 kg (lower) at the same distribution [ESTIMATED].

Baseline nozzle tables. R, theta and rho for L1 to L10 are the DU750 values [VERIFIED] [S1 Table 5.7]; everything else (which arm half, shapes, sizes, C_d, underside nozzles, and the whole of the M and T tables) is [ESTIMATED]. "Half" + or - says which lobe carries the nozzle; theta is in that lobe's frame (0 = radially outward, 90 = trailing tangential). Negative rho means the jet points downward. Flows are at N = 3000 rpm with only that branch active (sec. 4.3).

Lower arm, p_arm = 34.9 kPa, jet velocity 8.36 m/s, total 30.7 L/min:

| ID | Half | R (mm) | theta (deg) | rho (deg) | Shape | Size (mm) | A (mm2) | C_d | Q (L/min) | Role |
|---|---|---|---|---|---|---|---|---|---|---|
| L1 | + | 238 | 90 | 55 | round | 3.0 | 7.07 | 0.85 | 3.01 | drive + outer ring, reaches upward and backward |
| L2 | - | 226 | 359 | 89 | slot (fan along radius) | 1.8 x 5.0 | 8.30 | 0.78 | 3.25 | outer ring, vertical sheet |
| L3 | + | 182 | 160 | 60 | round | 2.4 | 4.52 | 0.85 | 1.93 | inward-inclined, hits faces looking outward |
| L4 | - | 145 | 305 | 70 | round | 2.4 | 4.52 | 0.85 | 1.93 | leading and outward |
| L5 | + | 114 | 90 | 89 | slot | 1.8 x 5.0 | 8.30 | 0.78 | 3.25 | vertical |
| L6 | - | 89 | 179 | 89 | slot | 1.8 x 5.0 | 8.30 | 0.78 | 3.25 | vertical, inner |
| L7 | + | 162 | 65 | 70 | round | 2.4 | 4.52 | 0.85 | 1.93 | trailing and outward |
| L8 | - | 194 | 43 | 62 | round | 2.4 | 4.52 | 0.85 | 1.93 | outward and trailing, reaches toward the walls |
| L9 | + | 223 | 90 | 89 | slot | 1.8 x 5.0 | 8.30 | 0.78 | 3.25 | vertical, outer |
| L10 | - | 238 | 60 | 55 | round | 3.0 | 7.07 | 0.85 | 3.01 | drive + corner reach |
| L11 | + | 150 | 180 | -55 | round | 2.5 | 4.91 | 0.80 | 1.97 | underside, flushes the flat filter toward the cylinder |
| L12 | - | 75 | 180 | -70 | round | 2.5 | 4.91 | 0.80 | 1.97 | underside, flushes the filter |
| Sum | | | | | | | 75.3 | (C_d A = 61.2) | 30.7 | |

Mid arm, p_arm = 33.6 kPa, jet velocity 8.20 m/s, total 19.9 L/min:

| ID | Half | R (mm) | theta (deg) | rho (deg) | Shape | Size (mm) | A (mm2) | C_d | Q (L/min) | Role |
|---|---|---|---|---|---|---|---|---|---|---|
| M1 | + | 222 | 90 | 60 | round | 2.6 | 5.31 | 0.85 | 2.22 | drive, outer ring |
| M2 | - | 205 | 0 | 85 | slot | 1.6 x 4.5 | 6.65 | 0.78 | 2.55 | near-vertical, slightly outward |
| M3 | + | 170 | 70 | 72 | round | 2.2 | 3.80 | 0.85 | 1.59 | trailing |
| M4 | - | 140 | 180 | 80 | round | 2.2 | 3.80 | 0.85 | 1.59 | slightly inward |
| M5 | + | 105 | 90 | 88 | slot | 1.6 x 4.5 | 6.65 | 0.78 | 2.55 | vertical |
| M6 | - | 70 | 0 | 88 | slot | 1.6 x 4.5 | 6.65 | 0.78 | 2.55 | vertical |
| M7 | + | 40 | 90 | 80 | round | 2.2 | 3.80 | 0.85 | 1.59 | centre |
| M8 | - | 222 | 60 | 58 | round | 2.6 | 5.31 | 0.85 | 2.22 | drive, corner reach |
| M9 | + | 190 | 0 | -75 | round | 2.2 | 3.80 | 0.80 | 1.50 | downward onto the tops of lower-rack items |
| M10 | - | 110 | 180 | -80 | round | 2.2 | 3.80 | 0.80 | 1.50 | downward |
| Sum | | | | | | | 49.6 | (C_d A = 40.4) | 19.9 | |

Top arm, p = 24.9 kPa, jet velocity 7.07 m/s, total 6.4 L/min. The nozzle count (six wash holes plus drive) and 60 rpm are [VERIFIED] for a GE top arm [S32]; positions, sizes and angles are [ESTIMATED]:

| ID | Half | R (mm) | theta (deg) | rho (deg) | Shape | Size (mm) | A (mm2) | C_d | Q (L/min) | Role |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | + | 35 | 90 | -80 | round | 2.0 | 3.14 | 0.80 | 1.07 | downward |
| T2 | + | 60 | 90 | -80 | round | 2.0 | 3.14 | 0.80 | 1.07 | downward |
| T3 | + | 85 | 90 | -55 | round | 2.0 | 3.14 | 0.80 | 1.07 | downward, drive |
| T4 | - | 48 | 90 | -80 | round | 2.0 | 3.14 | 0.80 | 1.07 | downward |
| T5 | - | 72 | 90 | -80 | round | 2.0 | 3.14 | 0.80 | 1.07 | downward |
| T6 | - | 125 | 90 | -55 | round | 2.0 | 3.14 | 0.80 | 1.07 | downward, drive, reaches the tray edges |
| Sum | | | | | | | 18.8 | (C_d A = 15.1) | 6.4 | |

Top-arm torque check with the model of sec. 3.3 [ESTIMATED]: drive 0.020 N m, sum(m_dot r^2) = 6.2e-4 kg m2/s; with k_f,T = 5.0 mm on a 12 mm hub (axial load about 2.5 N) and c_v = 0.0005 N m s the arm turns at about 60 rpm at 3000 rpm pump speed.

Jet character at the nozzle [ESTIMATED]: Re = v d / nu = 8.36 x 0.0024 / 1.0e-6 = 2.0e4 at 20 C and 3.6e4 at 50 C (nu = 0.55e-6 m2/s), i.e. fully turbulent short-nozzle jets; ballistic rise height v^2 / (2 g) = 3.6 m, far more than the tub height, so jets reach the racks at more than 90 % of exit speed (7.6 m/s at z = 600 mm). Per-nozzle momentum flux rho_w Q v = 0.27 to 0.45 N. Breakup, impingement and splash are the jets specialist's topic.

### 3.3 Rotation speed from the torque balance

Angular momentum balance on a reaction-driven arm about its vertical axis, steady state:

  sum_i m_dot_i r_i (v_i t_i - omega r_i) = T_f

- m_dot_i = rho_w C_d,i A_i sqrt(2 p_arm / rho_w): mass flow of nozzle i (kg/s).
- v_i = C_v sqrt(2 p_arm / rho_w): jet speed relative to the arm (m/s). Default C_v = 1.0 (calibrate 0.92 to 1.0).
- t_i = cos(rho_i) sin(theta_i): trailing-tangential direction cosine of nozzle i.
- r_i: nozzle radius (m). omega: arm speed (rad/s).
- The term m_dot_i omega r_i^2 is the torque needed to spin up water that enters on the axis with no angular momentum. It acts as a speed-proportional brake and is why even vertical nozzles slow the arm.
- T_f: bearing friction torque (N m). Model: T_f = k_f |F_ax| + c_v omega, with F_ax = p_arm A_hub + s (F_jz + W), F_jz = sum_i m_dot_i v_i sin(rho_i) the net vertical jet reaction, W the arm weight, s = -1 for the lower arm (pressure lifts the arm against its retainer, jet reaction and weight push it down) and s = +1 for the hanging mid arm. k_f is an effective friction radius times friction coefficient (m); c_v a viscous term (N m s).

Solution: omega = (sum_i m_dot_i v_i r_i t_i - k_f |F_ax|) / (sum_i m_dot_i r_i^2 + c_v), clipped at zero (stall).

Transient: (I_arm + I_water) d(omega)/dt = drive - brake - T_f - T_contact. With I = 6.3e-3 kg m2 and net torque 0.07 N m, spin-up takes about 0.3 s, so the arm follows diverter switching within one revolution [ESTIMATED]. T_contact is the torque from any item touching the arm (sec. 9); the arm stalls when T_contact exceeds drive - T_f(omega = 0), about 0.07 N m for the lower arm, equivalent to only 0.3 N at the tip.

Check against the DU750 [ESTIMATED]: ten 2 mm nozzles (C_d 0.9) at 9 m/s with the Table 5.7 angles give a stall torque of 0.083 N m and sum(m_dot r^2) = 8.97e-3 kg m2/s. Frictionless speed would be 88 rpm; the measured 35 rpm needs T_f = 0.049 N m. Both numbers are compatible with the ASKO bound of less than 0.4 N m [S3] and with a thrust-collar friction estimate (12 N pressure thrust on a 21 mm hub at 35 kPa, friction coefficient 0.3, radius 14 mm gives 0.05 N m).

Baseline results [ESTIMATED], with A_hub = 346 mm2 (lower) and 254 mm2 (mid), W = 1.8 N and 1.5 N, c_v = 0.002 N m s, and k_f tuned to hit the design speeds at 3000 rpm: k_f,L = 9.3 mm, k_f,M = 3.8 mm.

| Pump speed N (rpm) | Lower arm: p (kPa) / v (m/s) / drive (N m) / T_f (N m) / speed (rpm) | Mid arm: p / v / drive / T_f / speed |
|---|---|---|
| 3400 | 45.1 / 9.50 / 0.177 / 0.092 / 38 | 44.1 / 9.40 / 0.102 / 0.057 / 36 |
| 3000 | 34.9 / 8.36 / 0.137 / 0.068 / 35 | 33.6 / 8.20 / 0.078 / 0.045 / 30 |
| 2600 | 25.9 / 7.21 / 0.102 / 0.046 / 32 | 24.4 / 6.99 / 0.057 / 0.034 / 23 |
| 2200 | 18.3 / 6.06 / 0.072 / 0.028 / 30 | 16.5 / 5.75 / 0.038 / 0.025 / 16 |
| 1800 | 11.9 / 4.89 / 0.047 / 0.012 / 28 | 9.9 / 4.46 / 0.023 / 0.017 / 8 |
| 1400 | 6.8 / 3.70 / 0.027 / 0.000 / 27 | 4.7 / 3.06 / 0.011 / 0.011 / 0 (stalls) |

The model reproduces three documented behaviours: arm speed rises with pressure (S3, S43), there is a stall floor (S8), and shutting off drive nozzles cuts flow at constant pressure (S5: 19 %; here L1 + L10 carry 20 % of the lower-arm flow). The weak speed dependence of the lower arm at low pump speed is an artefact of the friction law (pressure thrust and weight cancel near 7 kPa) and is a calibration item.

### 3.4 Variants (mention only; not in the baseline)

| Variant | Description | Tag | Source |
|---|---|---|---|
| Satellite arm | a small reaction-driven satellite spinning on the end of the main arm (orbital pattern); BSH describes a motor-driven extension piece carrying a reaction-driven satellite | [VERIFIED] | S43 (snippet: US11826000) |
| Double rotating arm (Frigidaire) | a circular arm spinning on its own axis while orbiting; "four times better coverage" claimed | [VERIFIED] | S1 sec. 2.1 |
| Geared two-arm heads (GE, Whirlpool) | first arm 2.5 rpm driving a spray head at 60 rpm through a 24:1 gear; or second arm below 7 rpm through a 40:1 reduction | [VERIFIED] | S8; S47 (snippet for the GE figure) |
| Linear "water wall" (Samsung) | a bar of jets sweeping back and forth across the tub floor with a reflector; 10.7 L and 0.937 kWh for 14 ps | [VERIFIED] | S2 sec. 4.3.7 |
| Rear-wall high-pressure zone (Bauknecht PowerClean) | 32 high-pressure nozzles in the rear wall for pots in the back of the lower rack | [VERIFIED] | S2 sec. 4.3.7 |
| Corner nozzles | separately fed corner nozzles active only at defined rotation angles (prior art EP 0 974 302 cited by Miele) | [VERIFIED] | S55 |
| Motor-driven arm | arm speed and direction set by a motor rather than by reaction | [VERIFIED] | S5; S43 (snippet: US9220393) |
| Fixed auxiliary jets | two extra spray holes in the tub bottom (ASKO), bottle-wash jets (GE, 6.5 to 7.3 GPM) | [VERIFIED] | S3 sec. 3.3.5; S4 |
| Open pump with rotating volute as the arm (sink-type machines) | impeller under a rotating double-tongue volute that is itself the spray arm; 55 L/min, 2 m, 3000 rpm | [VERIFIED] | S6, S7 |

## 4. Hydraulics

### 4.1 What the literature gives

| Quantity | Value | Tag | Source |
|---|---|---|---|
| Circulation pump continuous electrical load | "around 50 W to 150 W" | [VERIFIED] | S2 sec. 4.3.5 |
| Motor types and efficiency | universal up to 50 %; inverter asynchronous 50 to 60 % (in most dishwashers at the time); permanent-magnet synchronous 65 to 80 %, about 3.5 kg, ferrite magnets | [VERIFIED] | S2 sec. 4.3.5 |
| Nominal circulation pump speed, variable-speed BLDC machine (Electrolux) | about 3000 rpm in a normal wash; lowered to about 1800 rpm and raised to about 3200 rpm for diagnostics | [VERIFIED] | S10 |
| US fixed-speed pump | synchronous motor at 3600 rpm (another model: 1/12 HP, 3.4 A at 120 V), "approximately 12 GPM to one spray arm at a time" (45 L/min), 100 % filtered | [VERIFIED] | S30 |
| Arm alternation, US fixed-speed machine | "the spray arm's operation is alternated by small pauses of the motor" | [VERIFIED] | S30 |
| Older US machines with both arms fed together | 30 to 40 GPM typical (114 to 151 L/min), reducible to about 20 GPM (76 L/min) by feeding zones in sequence; six fills per cycle | [VERIFIED] | S11 (1985) |
| Mid arm (GE) | 9.88 GPM (37 L/min) to the mid arm and 7.32 GPM to the bottle jets; whole system about 12 GPM with and 8.5 GPM without bottle jets | [VERIFIED] | S4 abstract page |
| Mid arm (Whirlpool) | 42 L/min at 35 kPa | [VERIFIED] | S5 |
| Arm supply (Whirlpool patent) | 20 to 40 L/min (claim 20 to 60) | [VERIFIED] | S8 |
| Swiss appliance-technology course notes | about 4 L fill, about 50 L/min circulated, "filtered 12.5 times per minute" | [VERIFIED] | S37 (snippet) |
| Sink-type dishwasher pump design point | Q = 55 L/min, H = 2 m, n = 3000 rpm, 8 blades, impeller outlet diameter 43.3 mm, inlet pipe 33 mm | [VERIFIED] | S6, S7 Table 1 |
| Industrial circulation pump with heater (Hanning CPE 16) | 80 W input, up to 140 L/min at 3000 rpm | [VERIFIED] | S52 (snippet); probably a commercial machine pump |
| Diverter ("water switch") | a changeover valve at the pump discharge opens the path to the upper or lower arm on a timed cycle; during a short transition both arms turn | [VERIFIED] | S37 (snippet) |
| Diverter construction (Beko/Grundig) | motor-driven perforated disc below the sump feeding lower and upper arm alternately | [VERIFIED] | S53 (snippet) |
| Diverter integrated in the pump (Miele) | three discharge ports, one per arm; arms can be fed in turn, two at a time, or a lower arm shut off when its rack is empty | [VERIFIED] | S24 |
| Reason for alternating | "if the spray arms are used alternatingly the amount of water needed to maintain the necessary water pressure can be reduced" | [VERIFIED] | S2 sec. 4.3.11.1 |
| Water per intake, modern EU machine | "around 3 to 4 litres for each water intake", about 10 L for the cycle | [VERIFIED] | S2 sec. 4.3.3 |
| Cleaning-phase water with an optimised filter | "typically halved from 8 liters to 4 liters" | [VERIFIED] | S15 |
| Fill used in the PEPT tests (Whirlpool DU750) | 5 L | [VERIFIED] | S1 sec. 3.4 |
| Measured US fills | about 1.65 gal (6.25 L) per fill, 3 to 4 fills; other units 1.3 to 1.5 gal (4.9 to 5.7 L) | [VERIFIED] | S31 |
| US service sheet fill | inlet valve 0.83 GPM (3.1 L/min), fill time 87 s, so 4.6 L per fill | [VERIFIED] | S30 (the product is my arithmetic) |
| Reference cycle in a Bonn model paper | fill level about 5 L, total 14.25 L, 0.83 kWh, 82 min, 45 C held 8 min | [VERIFIED] | S50 (snippet) |
| Heat-pump prototype (HSLU / V-ZUG) | 4.4 kg of water filled into the sump | [VERIFIED] | S48 (snippet) |
| Film hold-up estimate | 0.9 mm mean film if the airborne water were spread over all wetted surfaces | [VERIFIED] | S1 sec. 3.4.1 |
| Foam | foam "can cause a malfunction of the spray arms as bubbles are displaced to the pump, reducing the flow rate and decreasing the wash efficiency" | [VERIFIED] | S1 sec. 2.2.3 |
| Detergent effect on flow | negligible on in-arm and jet velocities (3.4 g/L powder, low pump speed) | [VERIFIED] | S1 sec. 4.6.1 |
| Cavitation at low fill | a current low-water machine "can't feed both arms at the same pressure without cavitating" | [VERIFIED] | S54 (snippet, hobbyist forum) |
| Pump-state detection | BLDC controller infers air ingestion, extra spray zones or overfill from motor current at test speeds | [VERIFIED] | S10 |

No published Q-H curve for a European household circulation pump was found. The curve below is constructed.

### 4.2 Pump model

Centrifugal pump with affinity scaling:

  H(Q, N) = H_0 (N / N_0)^2 - b Q^2,   p_pump = rho_w g H

- N_0 = 3000 rpm [VERIFIED nominal, S10]; H_0 = 5.5 m shut-off head; b = 1.333e-3 m per (L/min)^2 = 4.80e6 m per (m3/s)^2. H_0 and b are [ESTIMATED], chosen so that the pump delivers 30 L/min at 4.3 m (42 kPa) and about 55 L/min at 1.5 m, bracketing the verified points (35 kPa at the arm with 34 to 42 L/min [S5]; 55 L/min at 2 m [S6]; 45 L/min per arm in US machines [S30]).
- Range: N = 1400 to 3400 rpm [ESTIMATED; 1800 to 3200 VERIFIED as used values, S10].
- Hydraulic power P_hyd = p_pump Q. Electrical power P_el = P_hyd / (eta_h eta_m) + P_0 with wet-end efficiency eta_h = 0.40, motor-plus-inverter efficiency eta_m = 0.72 [S2 gives 65 to 80 %], and P_0 = 8 W [ESTIMATED]. At 3000 rpm, lower branch: 21.3 W hydraulic, 82 W electrical, inside the 50 to 150 W band of S2.

Pump curve table [ESTIMATED], head in m:

| Q (L/min) | 1800 rpm | 2200 rpm | 2600 rpm | 3000 rpm | 3400 rpm |
|---|---|---|---|---|---|
| 0 | 1.98 | 2.96 | 4.13 | 5.50 | 7.06 |
| 10 | 1.85 | 2.82 | 4.00 | 5.37 | 6.93 |
| 20 | 1.45 | 2.42 | 3.60 | 4.97 | 6.53 |
| 30 | 0.78 | 1.76 | 2.93 | 4.30 | 5.86 |
| 40 | 0 | 0.82 | 2.00 | 3.37 | 4.93 |
| 50 | 0 | 0 | 0.80 | 2.17 | 3.73 |
| 60 | 0 | 0 | 0 | 0.70 | 2.27 |

### 4.3 Network model and operating points

Each active branch j (lower arm, mid arm, top arm) satisfies

  p_pump = rho_w g z_j + K_j Q_j^2 + p_arm,j,   Q_j = (C_d A)_j sqrt(2 p_arm,j / rho_w)

so Q_j = sqrt( (p_pump - rho_w g z_j) / (K_j + rho_w / (2 (C_d A)_j^2)) ), and p_pump is found from sum_j Q_j = Q_pump(p_pump, N) (one-dimensional root find; bisection converges in under 50 iterations).

Defaults [ESTIMATED]: static lifts above sump level z_L = 0.15 m, z_M = 0.52 m, z_T = 0.80 m; feed loss coefficients K_L = 2.0e10, K_M = 5.6e10, K_T = 1.07e12 Pa s2/m6 (5 kPa at 30 L/min, 9 kPa at 24 L/min, 6 kPa at 4.5 L/min); (C_d A) = 61.2, 40.4 and 15.1 mm2 from the nozzle tables. A centrifugal correction 0.5 rho_w omega^2 r^2 (0.4 kPa at the tip at 35 rpm) is neglected.

Operating points [ESTIMATED]:

| Diverter state | N (rpm) | p_pump (kPa) | Q total (L/min) | Lower: Q / p / v | Mid: Q / p / v | Top: Q / p / v | P_hyd (W) |
|---|---|---|---|---|---|---|---|
| Lower only | 3400 | 53.3 | 34.9 | 34.9 / 45.1 / 9.50 | | | 31.0 |
| Lower only | 3000 | 41.6 | 30.7 | 30.7 / 34.9 / 8.36 | | | 21.3 |
| Lower only | 2600 | 31.3 | 26.5 | 26.5 / 25.9 / 7.21 | | | 13.8 |
| Lower only | 2200 | 22.5 | 22.2 | 22.2 / 18.3 / 6.06 | | | 8.3 |
| Lower only | 1800 | 15.2 | 17.9 | 17.9 / 11.9 / 4.89 | | | 4.5 |
| Upper (mid + top) | 3400 | 57.3 | 30.2 | | 22.8 / 44.1 / 9.40 | 7.4 / 33.3 / 8.17 | 28.8 |
| Upper (mid + top) | 3000 | 44.8 | 26.3 | | 19.9 / 33.6 / 8.20 | 6.4 / 24.9 / 7.07 | 19.6 |
| Upper (mid + top) | 2600 | 34.0 | 22.3 | | 16.9 / 24.4 / 6.99 | 5.4 / 17.6 / 5.94 | 12.6 |
| Upper (mid + top) | 2200 | 24.6 | 18.2 | | 13.9 / 16.5 / 5.75 | 4.3 / 11.3 / 4.76 | 7.5 |
| Upper (mid + top) | 1800 | 16.8 | 14.0 | | 10.8 / 9.9 / 4.46 | 3.2 / 6.1 / 3.49 | 3.9 |
| All arms | 3000 | 27.9 | 44.6 | 24.9 / 22.9 / 6.78 | 15.0 / 19.2 / 6.21 | 4.7 / 13.5 / 5.20 | 20.7 |
| All arms | 3400 | 35.3 | 51.0 | 28.2 / 29.4 / 7.67 | 17.3 / 25.5 / 7.15 | 5.5 / 18.5 / 6.08 | 30.0 |

(Units: Q in L/min, p in kPa, v in m/s.) Feeding all arms at once drops the jet velocity from 8.4 to 6.8 m/s and jet momentum flux by about a third at the same pump speed, and needs 45 L/min of circulating water. This is the quantitative reason low-fill machines alternate.

Flow uncertainty: the plausible range for one active arm is 15 to 45 L/min [ESTIMATED]. The low end follows from the DU750 statement that 2 mm nozzles are the most common (ten 2 mm nozzles pass only 15 L/min at 40 kPa); the high end from the US figures (42 to 45 L/min) [S5, S30]. PEPT in-arm velocities of up to 1.75 m/s in a nominal 10 x 35 mm duct [S1] would imply up to 37 L/min per lobe, which favours the high end for the DU750. Jet velocity (7 to 9 m/s at full speed) is far better constrained than flow. Nozzle area is therefore the first hydraulic quantity to calibrate.

### 4.4 Diverter valve and duty cycles

Baseline [ESTIMATED]: three-position rotary disc diverter at the pump discharge with states L (lower only), U (mid + top), A (all); 1.5 s transition during which both branches are partially open (the opening area ramps linearly). Default pattern in wash and rinse phases: L 60 s, U 60 s, repeating; intensive lower-rack emphasis: L 80 s, U 40 s at 3400 rpm on L; glass programme: L 45 s, U 75 s at 2200 rpm. State A is used only during the first 20 s after a fill (to wet everything and prime both branches) and in the final 30 s of the final rinse. Evidence for the mechanism is in the table above (S24, S30, S37, S53); the switching periods are not documented in any source I could open and are calibration parameters (expected 20 to 120 s per state).

Consequence for a surface element: it sees jets from a given arm only during that arm's share of the period, so the impact frequency factor of S1 (best case 1.59 % of the time for a direct jet) must be multiplied by the diverter duty (about 0.5).

### 4.5 Water inventory, sump level and loss of prime

Water balance at any instant (volumes in L):

  V_fill = V_sump + V_pipes + V_air + V_film + V_trap + V_filter + V_absorbed

| Term | Meaning | Baseline | Tag |
|---|---|---|---|
| V_fill | water admitted this phase plus carry-over from the last drain | 3.8 + 0.4 (main wash) | [ESTIMATED]; carry-over [VERIFIED] 0.3 to 0.5 L [S1] |
| V_pipes | pump housing, heater, diverter, riser, manifolds, arm ducts | 0.70 (lower branch 0.25, upper branch 0.45) | [ESTIMATED] |
| V_air | jets and droplets in flight: Q x t_flight | 30 L/min x 0.5 s = 0.25 | [ESTIMATED]; total loop time under 3 s [VERIFIED] [S1] |
| V_film | films, rivulets and drips on the load, racks and walls: Q x t_return | 30 L/min x 1.5 s = 0.75 (range 0.4 to 1.5) | [ESTIMATED]; the 0.9 mm mean-film figure of S1 over about 1 m2 gives the same order |
| V_trap | water captured by upward-facing concavities (upright cups, bowls, pan lids, the undersides of mugs with deep foot rings) | 0 for a correct load; an upright 300 ml mug traps 0.3 | computed from the loaded geometry (films specialist) |
| V_filter | water held above a partly clogged filter | 0 clean; up to 1.0 when clogged | [ESTIMATED] |
| V_absorbed | water taken up by swelling soils and porous items | below 0.05 | [ESTIMATED] |
| V_sump | what is left for the pump | 4.2 - 0.70 - 0.25 - 0.75 = 2.5 with one branch active | [ESTIMATED] |

Loss of prime: the pump needs V_sump >= V_min (0.5 L, calibrate 0.3 to 0.8) to keep its inlet flooded [ESTIMATED]. Below that, air is ingested. Suggested model: air fraction alpha = clamp(1 - V_sump / V_min, 0, 0.6); head multiplier f_H = 1 - 2.5 alpha (zero above alpha = 0.4); the pump then surges with a period of about 2 to 5 s as the returning film refills the sump [ESTIMATED; the degradation law is the usual rule of thumb that centrifugal pumps lose most of their head between 5 and 15 % gas fraction, and must be calibrated].

Practical consequences that the simulator should reproduce:
- With all arms open at 3400 rpm, V_air + V_film roughly doubles and V_pipes rises to 0.95 L, leaving about 1.5 L in the sump; add one trapped litre (three upright bowls) and the pump surges. With alternating arms the same mis-loading still leaves about 1.5 L and the machine keeps washing. [ESTIMATED]
- Machines meter the fill (flow meter or pressure switch), so trapped water is not automatically replaced in the baseline. Whether the controller tops up on detecting surging [S10 describes current-based detection] is a design decision; baseline: one top-up of 0.5 L allowed per phase.

Foam: treat foam as a second source of air at the pump inlet, alpha_foam supplied by the chemistry specialist as a function of surfactant type, protein load, temperature and rinse-aid spills. Verified qualitatively by S1 sec. 2.2.3.

Filter clogging: sec. 5.3.

### 4.6 Fill and drain

| Quantity | Value | Tag | Source |
|---|---|---|---|
| Inlet valve flow (US) | 0.83 GPM = 3.1 L/min, 87 s per fill; supply pressure 20 to 120 psi | [VERIFIED] | S30 |
| Baseline inlet flow (EU, flow-limited valve) | 3.0 L/min (range 2.5 to 4.5) | [ESTIMATED] | |
| Cold supply temperature for EU tests | 15 C (IEC); Australia/NZ 20 C | [VERIFIED] | S2 sec. 1.2 (standards comparison); S28 quotes 15 C |
| Water softener regeneration | not every cycle; takes about 3 to 4 minutes; salt about 19 g per cycle on average | [VERIFIED] | S2 sec. 4.2.3 and 5.1 |
| Drain pump | separate small synchronous pump on the side of the sump with a check valve; drain hose loop at least 32 in (0.81 m) high | [VERIFIED] | S30 |
| Drain pump rating | about 30 W, 15 to 20 L/min against 0.8 to 1.0 m | [RECALLED] | typical wet-rotor drain pumps; not opened |
| Baseline drain event | 35 s at 16 L/min nominal, often two bursts with a 5 s pause to let films run down | [ESTIMATED] | |
| Carry-over after drain | 0.4 L (range 0.3 to 0.5) left in sump, pump and hoses, plus water still on the load (about 0.2 to 0.3 kg, sec. 7.6) | [VERIFIED] range | S1 sec. 1.3; S22 for the load water |
| Partial drain / water reuse | only part of the wash water may be drained and replaced; not possible under standard test soil | [VERIFIED] | S2 sec. 4.3.11.2 |
| Final-rinse storage tank | final rinse water stored up to 36 h and reused for the next pre-rinse, bringing consumption to about 6 L per cycle (V-ZUG) | [VERIFIED] | S2 sec. 4.3.11.4 |
| Turbidity sensor (BSH AquaSensor, 1996) | decides whether pre-rinse water is clean enough to keep; about 20 % water saved | [VERIFIED] | S39 (snippet) |

Dilution by carry-over: after a drain, the fraction of dissolved soil and detergent carried into the next fill is f_co = (V_carry + V_load) / (V_carry + V_load + V_fill,next) = (0.4 + 0.25) / (0.65 + 2.9) = 0.18 for the baseline intermediate rinse [ESTIMATED]. Two rinses therefore dilute main-wash liquor by a factor of about 30. This is the mechanism behind the EU statement that all machines keep an intermediate rinse to avoid redeposition and carry-over of cleaning agent [VERIFIED] [S2 sec. 4.2.3 and 4.3.11.3]. Cross-link: chemistry specialist.

## 5. Filters

### 5.1 Mesh sizes

| Stage | Opening | Tag | Source |
|---|---|---|---|
| Coarse | "large meshes of the order of 5 millimeters" | [VERIFIED] | S17 (snippet: EP0150147) |
| Fine (BSH description of a common arrangement) | mesh diameter 0.9 to 1.1 mm | [VERIFIED] | S14 |
| Fine, punched plate (Whirlpool) | holes 0.7 to 0.9 mm (preferably 0.8); open area 8 to 20 % (preferably 13 to 18 %) in the centre zone and 20 to 40 % (27 to 35 %) in the side zones | [VERIFIED] | S16 |
| Medium (older French patent) | "of the order of one millimeter" | [VERIFIED] | S17 (snippet) |
| Micro (BSH description) | about 0.3 mm | [VERIFIED] | S14 |
| Micro (optimised filter patent) | 150 to 250 um mesh; opening area 0.025 to 0.06 mm2 (preferably 0.035 to 0.045); open fraction 25 to 50 % (preferably 35 to 45 %); area 14 to 28 cm2, "more than 14 cm2 per set place" | [VERIFIED] | S15 |
| Micro (older patent) | "a few tenths of a millimeter, for example two tenths" | [VERIFIED] | S17 (snippet) |
| Very fine US screen that tended to clog | 0.0049 in (0.12 mm) | [VERIFIED] | S17 (snippet: US5779812) |
| US machine | "100 percent filtered water" to the arms; glass trap, filter, soil director in the sump | [VERIFIED] | S30 |

### 5.2 Baseline filter system and what it does to soil

Three-stage combination under the lower arm, all [ESTIMATED] except the mesh sizes (from 5.1):

1. Flat fine filter: stainless plate around the sump, 572 cm2 gross (260 x 220 mm) minus the cylinder opening, holes 0.8 mm, 15 % open area, so 80 cm2 open. All water returning to the sump passes either this plate or the cylinder.
2. Coarse cup: removable cylinder in the centre of the plate, openings 5 x 5 mm, catches bones, pips, labels, glass.
3. Microfilter: 0.2 mm mesh sleeve inside the cup, 190 cm2, 40 % open, so 76 cm2 open. The inside of the cup connects to the drain pump inlet; the outside to the circulation pump.

Flow split: parallel paths with orifice-like losses, dp = 0.5 rho_w (Q_k / (C_f A_open,k))^2. With equal loss coefficients C_f = 0.6 the split follows the open areas: 51 % through the flat plate and 49 % through the microfilter when both are clean [ESTIMATED]. The underside arm nozzles L11 and L12 and the floor slope push debris sitting on the flat plate toward the cup.

Removal model per particle size class d (cross-link soils and chemistry specialists for the size distributions):

- d > 5 mm: stays in the tub on the load, the racks or the flat plate; not circulated. Stays until the user clears it.
- 0.8 mm < d <= 5 mm: cannot pass the plate. A fraction s_cup (0.5 per pass over the plate, calibrate) is swept into the cup; the rest lies on the plate and blinds it.
- 0.2 mm < d <= 0.8 mm: passes the plate with the 51 % of the flow that goes that way and is recirculated to the arms; the 49 % going into the cup is retained by the microfilter. Per-pass capture efficiency eta = 0.49. With n_pass = Q / V_circ = 30.7 / 4.2 = 7.3 passes per minute (the Swiss notes quote 12.5 per minute [S37 (snippet)]), the suspended concentration decays as C(t) = C_0 exp(-eta n_pass t), time constant 17 s, until re-suspension from the load balances it.
- d <= 0.2 mm and dissolved or emulsified soil: not filtered; stays in the liquor and leaves only with a drain (dilution factor in sec. 4.6). This is the redeposition stock. S2 notes that long main washes make soil particles "too small to be filtered out" [VERIFIED] [S2 sec. 4.3.3].

Where retained soil goes: material inside the cup is flushed out by the drain pump at each drain, apart from pieces larger than the drain passage (about 8 to 10 mm, [ESTIMATED]) which stay in the cup until the user empties it. Material lying on the flat plate stays in the tub across phases and re-enters suspension when a strong jet hits it.

### 5.3 Clogging and its effect on flow

- Blinding: each retained particle of projected area a_p removes a_p from the open area of the stage it sits on. Track the open fraction phi_k(t) = phi_k,0 - (sum a_p) / A_k for plate and microfilter.
- Hydraulics: as the open fraction phi falls, the head needed to pass Q rises as phi^-2; the water level above the plate rises (V_filter in sec. 4.5) and V_sump falls. Level above the plate: h = (Q / (C_f A_open))^2 / (2 g). Clean (156 cm2 open, C_f = 0.6, 30.7 L/min): h = 0.15 mm, negligible. With 78 % of the open area blinded: h = 3 mm, which over the 0.27 m2 floor holds 0.8 L out of the sump. With 90 % blinded: h = 15 mm, which would need 4 L, more than the whole fill, so the sump runs dry first. The practical failure threshold is therefore roughly 75 to 85 % loss of open area [ESTIMATED].
- Outcome: pump surging and loss of pressure exactly as in sec. 4.5; in the limit the lower arm stalls in standing water. S14 describes the same symptom chain (pressure falls in the pump suction and delivery, motor speed rises slightly) and uses it to start a filter-cleaning step [VERIFIED] [S14]. The Miele and ASKO sources both stress cleaning filters regularly [S25, S3].


## 6. Heating and thermal masses

### 6.1 What the sources give

| Quantity | Value | Tag | Source |
|---|---|---|---|
| Heating phases per cycle | usually two: main wash and hot (final) rinse | [VERIFIED] | S2 sec. 4.2.3 |
| Heater type, EU | flow-through (instantaneous) heater in the circulation path; BSH moved from a tub-floor element to an instantaneous heater in 1987; S2 lists "moving the heater from the tub to the water sump" as a past improvement | [VERIFIED] | S14; S2 sec. 2.2; S39 (snippet) |
| Heater power, EU | "about 2 to 3 kW" for most machines; example 2 kW heater plus 0.6 kW heat pump | [VERIFIED] | S23 |
| Total rated load of a current 14 ps machine | 2.00 kW at 230 V, 10 A fuse | [VERIFIED] | S26 |
| BSH heat-pump spare part rating | 2000 W | [VERIFIED] | S33 (snippet, marketplace listing) |
| Heater power, US | exposed 900 W element in the tub base, also used for heated drying; high-limit thermostat 93 C | [VERIFIED] | S30, S31 |
| Time to heat the main wash (EU) | 45 C "reached after about 20 minutes", then the temperature falls to about 40 C during the holding time | [VERIFIED] | S23 |
| Heating phases with cold fill, US 900 W machine | 27 and 25 minutes for wash and rinse | [VERIFIED] | S31 |
| Heat-pump dishwasher (Arcelik, 16 ps) | 9.9 L, 0.47 kWh, 190 min | [VERIFIED] | S36 Table 1 |
| Heat-pump dishwasher (V-ZUG Adora SL WP, 13 ps) | 0.49 kWh, 8.7 L, 160 min in Eco; ice-water latent store needs up to 12 h to recover | [VERIFIED] | S2 sec. 4.2.4, 4.3.4.1 |

### 6.2 Lumped thermal model (recommended)

Three heat capacities and two conductances:

  C_w dT_w/dt = P_h(t) + P_pump,diss - G_wl (T_w - T_l) - G_wm (T_w - T_m)
  C_l dT_l/dt = G_wl (T_w - T_l) - G_la (T_l - T_tub_air)
  C_m dT_m/dt = G_wm (T_w - T_m) - UA (T_m - T_amb)

| Symbol | Meaning | Baseline | Range | Tag |
|---|---|---|---|---|
| C_w | circulating water, m_w x 4186 J/(kg K) | 15.9 kJ/K at 3.8 kg | | physical constant |
| C_l | load: about 26 kg ceramic and glass at 0.84 kJ/(kg K) plus 2.5 kg steel cutlery at 0.50 | 23 kJ/K for a full 13 ps load | 0 to 30 | [ESTIMATED]; replace with the per-item sum from the items specialist |
| C_m | machine: 8.7 kg stainless at 0.50 [mass VERIFIED S2], 3.5 kg racks at 0.50, about 3 kg wetted polypropylene at 1.9, 30 % of 6.1 kg bitumen at 1.3 | 14 kJ/K | 10 to 20 | [ESTIMATED] |
| P_h | heater power while the pump runs | 2000 W | 1800 to 2400 | [VERIFIED] order, S23, S26 |
| P_pump,diss | pump electrical power ends up as heat in the water | 50 to 110 W | | [ESTIMATED] from sec. 4.2 |
| G_wl | water to wetted load, eps x m_dot x c_p with eps about 0.3 | 600 W/K while sprayed, 0 when not circulating | 300 to 1200 | [ESTIMATED]; should come out of the film model per surface element |
| G_wm | water to tub and racks | 250 W/K | 100 to 500 | [ESTIMATED] |
| UA | cabinet loss to the kitchen | 2.6 W/K | 1.5 to 4 | [ESTIMATED] so that the main wash drifts about 4 K in an unheated hour, in line with the 45 to 40 C fall quoted in S23 |
| T_amb, T_in | ambient and cold inlet | 23 C, 15 C | | inlet [VERIFIED] S2, S28; ambient [RECALLED] from the IEC test conditions |

Heating rate with everything well coupled: dT/dt = (P_h - UA (T - T_amb)) / (C_w + C_l + C_m) = 2000 / 52 900 = 0.038 K/s = 2.3 K/min for a full load and 4.0 K/min for an empty machine (C = 30 kJ/K) [ESTIMATED]. The verified "45 C after about 20 minutes" [S23] corresponds to 1.3 to 1.5 K/min from a 15 to 19 C start, so real controllers either pulse the heater or the slow thermal mass is larger than assumed. Baseline: heater duty 0.7 during heat-up, giving 1.6 K/min full load. Calibrate against a logged temperature trace.

Shadowed items lag: an item that receives no direct spray is heated only by run-off and tub air, so G_wl for it is an order of magnitude smaller and it may be 10 to 20 K colder than the sump water at the end of a short heat-up [ESTIMATED]. This matters for soils (soak and enzyme kinetics) and for drying, and should fall out of the per-element film model.

## 7. Cycle programmes

### 7.1 Phase structure

Typical phases [VERIFIED] [S2 sec. 4.2.3]: (1) pre-rinse with cold or warm water to remove loose dirt; (2) main cleaning phase with warm to hot water, "usually between 40 and 70 C", and detergent; (3) intermediate rinse with tepid water to avoid carry-over of cleaning agent into the hot rinse; (4) hot rinse with rinse agent, which also heats the load for hygiene and drying; (5) drying. Plus an occasional softener regeneration of 3 to 4 minutes. Programmes differ "mainly in the length of the different phases, the reached temperatures and the water pressure", and some phases are omitted in some programmes.

Other verified structural facts:

- About 40 % of models (Lot 14 era) omit or shorten the cold pre-rinse; all machines today are assumed to keep an intermediate rinse [S2 sec. 4.3.11.3].
- The Eco programme does not use the soil or load sensors (for repeatability); the automatic programme does [S2 sec. 4.3.6.3].
- "Drain stages are frequent during typical wash cycles, thus chemistry added is eliminated to a large degree"; all detergent chemistry is released together when the tablet dispenser opens [S1 sec. 1.3].
- The temperature shown to the user is reached either in the main wash or in the last rinse [S2 sec. 4.3.3].
- A second intermediate rinse can be selected to improve results (Miele setting) [S25].
- ASKO quick wash (2010): about 12 minutes; first fill heated to 30 C while spraying, drained; then two unheated fills each sprayed for a couple of minutes [S3 sec. 3.2].

### 7.2 Verified programme data

EU fleet averages, 13 place settings, full load (S2 Table 5.3) [VERIFIED]:

| Programme | Real-life usage share | Energy (kWh) | Water (L) | Time (min) |
|---|---|---|---|---|
| Eco (label programme) | 20.5 % | 0.96 | 9.8 | 196 |
| Normal 45 to 55 C | 19.9 % | 1.15 | 13.1 | 124 |
| Normal 60 to 65 C | 15.6 % | 1.34 | 13.0 | 136 |
| Intensive 70 to 75 C | 9.1 % | 1.53 | 12.9 | 148 |
| Automatic (average) | 9.9 % | 1.18 | 10.6 | 133 |
| Glass / gentle / light | 5.9 % | 0.92 | 11.4 | 102 |
| Short | 12.0 % | 0.76 | 9.2 | 30 |
| Rinse and hold | 7.1 % | 0.06 | 4.0 | 13 |
| Usage-weighted average | 100 % | 1.04 | 10.9 | 124 |

Miele G 7266 SCVi SF (US market), programme overview [VERIFIED] [S25 pp. 64 to 67]; energy and time for a 10 C cold fill:

| Programme | Main wash (C) | Final rinse (C) | Energy (kWh) | Water (L) | Time (h:min) |
|---|---|---|---|---|---|
| Normal (label programme) | 50 to 75 | 56 to 65 | 0.97 | 12.1 | 3:01 |
| Pots and Pans | 75 | 55 to 70 | 1.40 | 13.0 | 3:29 |
| China and Crystal | 45 | 55 to 70 | 0.85 | 12.5 | 2:51 |
| QuickIntenseWash | 55 | 60 | 1.00 | 10.5 | 1:18 |
| SaniWash | 75 | 75 | 1.45 | 9.0 | 2:43 |
| Extra Quiet | 50 | 55 to 70 | 0.95 | 9.0 | 4:16 |
| Rinse and Hold | none | none | 0.01 | 4.0 | 0:21 |
| Clean Machine | 75 | 70 | 1.75 | 19.0 | 2:37 |

Fisher and Paykel DW60U4EI3 (60 cm, 15 place settings, AU/NZ; times for 20 C inlet) [VERIFIED] [S27]:

| Phase | Auto | Heavy | Medium | Light | Eco (label) | 60 min | Glassware | Quiet |
|---|---|---|---|---|---|---|---|---|
| Pre-wash | none | 45 C | yes | none | yes | none | none | none |
| Main wash | 45 to 68 C | 68 C | 55 C | 45 C | 45 C | 60 C | 45 C | 55 C |
| Post rinse | 35 C | yes | yes | 55 C | yes | 45 C | 55 C | 55 C |
| Final rinse | 60 C | 60 C | 60 C | 55 C | 38 C | 55 C | 60 C | 60 C |
| Drying | yes | yes | yes | yes | yes (door auto-opens 100 to 125 mm) | yes | yes | yes |

(The sister model DW60FC3 has a 40 C Eco final rinse.) Test detergent split: 5 g pre-wash plus 8 g main wash.

Fisher and Paykel DishDrawer DD60 single drawer (6 place settings, EU label; 15 C inlet) [VERIFIED] [S28]:

| | Heavy | Medium | Eco (label) | Fast | Delicate | Rinse |
|---|---|---|---|---|---|---|
| Time (min) | 198 | 185 | 280 | 35 | 147 | 15 |
| Pre-wash | 60 C | no | no | no | no | yes |
| Main wash | 65 C | 55 C | 48 C | 48 C | 50 C | no |
| Post rinse | yes | yes | yes | yes | yes | no |
| Final rinse | 65 C | 60 C | 59 C | 40 C | 55 C | no |
| Water (L) | 10.0 | 8.3 | 7.9 | 6.8 | 9.9 | 2.6 |
| Energy (kWh) | 1.00 | 0.65 | 0.61 | 0.34 | 0.56 | n/a |

(Double-drawer variant: Eco 243 min, main 50 C, final rinse 51 C, 7.8 L, 0.54 kWh.)

Other verified points:

| Machine / source | Data | Tag | Source |
|---|---|---|---|
| Miele G 7281 SCVi (14 ps, class A, AutoOpen) | Eco: 8.2 L, 0.43 kWh (0.30 with hot fill), 388 min; Automatic from 6.0 L | [VERIFIED] | S26 |
| OEM 60 cm machine (EU 2019/2022 table) | Eco 45 C: 3:25, 0.923 kWh, 12.0 L; Intensive 65 C: 1:57, 1.70 kWh, 17.2 L; Hygiene 70 C: 2:07, 1.90 kWh, 16.0 L; 65 C 50 min: 1.10 kWh, 12.0 L; Glass 40 C 30 min: 0.74 kWh, 12.4 L; pre-rinse 15 min: 0.02 kWh, 4.5 L; detergent 25 cm3; short programmes have no drying step | [VERIFIED] | S29 |
| V-ZUG Adora SL (13 ps, no heat pump), energy only | Automatic 0.7 to 1.2; Daily quick 1.05; Sprint 0.75; Glass 0.75; Intensive 1.15 to 1.25; Fondue/Raclette 1.35 to 1.45; Hygiene 1.6; Pre-rinse 0.05; Eco 0.69 to 0.73 kWh | [VERIFIED] | S2 Table 4.5 |
| Eco durations of A++ machines tested in 2015 | 179 to 252 minutes | [VERIFIED] | S2 sec. 2.2.4 |
| Popular programmes relative to Eco (12 manuals) | automatic worst case 24 % shorter; rapid at least 13.5 % more energy; normal 20.3 % more water | [VERIFIED] | S2 sec. 2.2.4 |
| Eco temperature practice | main wash around 50 C in most models; A-rated cleaning not reachable below 45 C; final rinse was 65 C in 2007 and is now lower depending on the drying technology; zeolite machines "usually not heated during the hot rinse phase at all"; hygiene options 60 to 70 C | [VERIFIED] | S2 sec. 4.3.3 |
| Hot-rinse water | "only 3 to 4 litres" | [VERIFIED] | S2 sec. 4.3.2.5 |
| Clear-rinse temperature | "between 60 and 70 C are commonly used" | [VERIFIED] | S23 |
| Eco programmes from product listings | AEG 9.9 L, 4:00; LORD 9.5 L, 3:45; Smeg 50 C wash, 55 C rinse, about 180 min; Siemens SN25D800GC 210 min, about 11 L; Privileg 3:35 | [VERIFIED] | S51 (snippets) |
| US "Normal", Kenmore, 54 C inlet | three fills plus a partial fill, 25.4 L, 83 min, heater on twice (wash and heated rinse), 0.74 kWh of which 0.43 kWh heater; with machine drying 0.94 kWh; cold fill: 108 to 112 min, 1.24 to 1.27 kWh | [VERIFIED] | S31 |
| US Bosch, normal cycle, lightly soiled | 8.7 L; 0.35 kWh at the machine with 49 C inlet; heavier soil 11 L and 1.22 kWh | [VERIFIED] | S31 |
| US service sheet | normal cycle 22.7 L (older) or 18.5 to 36.7 L (soil-sensing) | [VERIFIED] | S30 |

### 7.3 Baseline programmes (SPOT-60)

Conventions: T_in = 15 C, T_amb = 23 C, full 13 ps load, 2000 W heater at 0.7 duty during ramps, drain = 35 s pump + 10 s run-down + 10 s pump, carry-over 0.4 L. N is circulation pump speed; "L/U a/b" is the diverter pattern in seconds. Totals (water, energy, duration) are anchored to the verified tables in 7.2; the split into steps, the durations of individual steps, pump speeds and diverter patterns are [ESTIMATED] and are calibration parameters. Energy figures are from the model of sec. 6.2.

ECO 50 (label programme): 9.5 L, 0.79 kWh, 210 min. EEI = 0.79 / 1.675 = 47, class D under the 2021 label (sec. 8).

| Step | Action | Water in (L) | Target (C) | N (rpm), diverter | Duration (min) |
|---|---|---|---|---|---|
| E1 | pre-drain | | | | 0.3 |
| E2 | fill 1 | 3.8 | | | 1.3 |
| E3 | wetting; detergent dispenser opens 60 s after circulation starts | | no heating | 2600; A for 20 s, then L/U 60/60 | 4 |
| E4 | heat-up | | 47 | 2800; L/U 60/60 | 18 |
| E5 | main wash hold, heater off, 50 s spray / 10 s pause; liquor drifts to about 43 C | | | 2800; L/U 60/60 | 58 |
| E6 | drain | | | | 1 |
| E7 | fill 2 and intermediate rinse, unheated (mixes to about 36 C) | 2.9 | | 2600; L/U 45/45 | 8 |
| E8 | drain | | | | 1 |
| E9 | fill 3 and final rinse heat-up; rinse aid 3 ml dosed when the liquor reaches 40 C | 2.8 | 50 | 2600; L/U 45/45; A for the last 30 s | 14 |
| E10 | final rinse hold | | | 2600 | 3 |
| E11 | drain (double) | | | | 1 |
| E12 | drying: door closed 25 min, then auto-open and passive drying | | | | 100 |

AUTO 45 to 65 (soil-sensing; values for normal soil): 13.0 L, 1.15 kWh, 135 min.

| Step | Action | Water in (L) | Target (C) | N, diverter | Duration (min) |
|---|---|---|---|---|---|
| A1 | fill and cold pre-rinse; turbidity check; drain (kept if clear, then A2 adds only 0.4 L) | 3.4 | | 2600; L/U 60/60 | 10 |
| A2 | fill, dispenser opens at 60 s, heat-up | 3.6 | 55 (45 to 65 by soil level) | 3000; L/U 60/60 | 24 |
| A3 | main wash hold | | | 3000 | 25 (10 to 40 by soil level) |
| A4 | drain, fill, intermediate rinse, drain | 3.0 | | 2600 | 9 |
| A5 | fill, final rinse heat-up, rinse aid at 40 C, hold 3 min, drain | 3.0 | 62 | 2800 | 22 |
| A6 | drying, door closed; auto-open at the end | | | | 45 |

INTENSIVE 70: 13.0 L, 1.50 kWh, 145 min.

| Step | Action | Water in (L) | Target (C) | N, diverter | Duration (min) |
|---|---|---|---|---|---|
| I1 | fill, heated pre-wash (optional door-smear detergent), drain | 3.4 | 45 | 3200; L/U 80/40 | 20 |
| I2 | fill, dispenser at 60 s, heat-up | 3.6 | 70 | 3400 on L, 3000 on U; L/U 80/40 | 22 |
| I3 | main wash hold with reheating to stay above 66 C | | | same | 25 |
| I4 | drain, fill, intermediate rinse, drain | 3.0 | | 3000 | 9 |
| I5 | fill, final rinse heat-up, rinse aid, hold 5 min, drain | 3.0 | 67 | 3000 | 22 |
| I6 | drying | | | | 47 |

QUICK 60 (one hour, 65 C class): 10.5 L, 1.05 kWh, 60 min.

| Step | Action | Water in (L) | Target (C) | N, diverter | Duration (min) |
|---|---|---|---|---|---|
| Q1 | fill, dispenser at 30 s, heat-up at full heater duty | 3.8 | 62 | 3200; L/U 40/40 | 23 |
| Q2 | main wash hold | | | 3200 | 8 |
| Q3 | drain, fill, intermediate rinse, drain | 3.2 | | 3000 | 6 |
| Q4 | fill, final rinse heat-up, rinse aid, hold 2 min, drain | 3.5 | 60 | 3000 | 14 |
| Q5 | short drying, auto-open at the end | | | | 9 |

GLASS 40: 11.4 L, 0.90 kWh, 100 min. Reduced spray pressure and limited temperature gradients (ramp at most 1.5 K/min).

| Step | Action | Water in (L) | Target (C) | N, diverter | Duration (min) |
|---|---|---|---|---|---|
| G1 | fill, dispenser at 60 s, slow heat-up | 4.0 | 40 | 2200; L/U 45/75 | 18 |
| G2 | main wash hold | | | 2200 | 15 |
| G3 | drain, fill, intermediate rinse, drain | 3.6 | | 2200 | 8 |
| G4 | fill, slow final rinse heat-up, rinse aid, hold 3 min, drain | 3.8 | 55 | 2200 | 26 |
| G5 | drying, auto-open at the end | | | | 33 |

PRE-RINSE (rinse and hold): 4.0 L cold, 10 min spraying at 2600 rpm L/U 60/60, drain; 13 min, 0.05 kWh.

Variability to expose as machine parameters: main-wash temperature (40 to 75 C), final-rinse temperature (none, or 38 to 75 C), hold times, number of rinses (1 to 3), presence of pre-rinse, water per fill (2.6 to 5 L), pump speed per phase, diverter pattern, drying method.

### 7.4 Detergent dispenser: timing, mechanism and release path

| Quantity | Value | Tag | Source |
|---|---|---|---|
| Mechanism | spring-loaded cover held by a latch; an electrical actuator (wax motor, solenoid or, per Wikipedia, a bimetal) releases it during the wash | [VERIFIED] | S30; S42 (the Wikipedia statement is itself marked "citation needed") |
| Release time in the cycle, US machines with a pre-wash | about 8 to 10 minutes into a Normal cycle (GE repair guide); "about 10 minutes into a 30+ minute cycle" (forum); another page says about 15 minutes | [VERIFIED] | S44 (snippets, low reliability) |
| Tech-sheet cycle chart | the step legend of a US soil-sensing machine includes "Fill/Det. Dispenser" and "Wash/Heat/Det.Disp." entries, so dispenser actuation is tied to specific fill and wash steps (my reading: the open pre-wash cup is flushed at the first fill and the covered cup is released in the main wash) | [VERIFIED] legend text | S30 (ajmadison sheet) |
| Wax-motor delay | wax melts and extends the piston over 30 to 45 s | [VERIFIED] | S44 (snippet, unverified repair blog) |
| Tablet placement guidance | tablets go in the main compartment with the lid closed; detergent placed loose in the tub dissolves in the pre-wash and is drained away | [VERIFIED] | S44 (snippets: Whirlpool, repair pages) |
| Detergent amounts | 20 g per cycle typical (tablet); Miele 20 to 30 ml powder or one tab; OEM manual 25 cm3; DishDrawer test 14 g per 6 ps drawer; F&P AU test 5 g + 8 g; powder concentration 3.4 g/L "typical" in a 5 L fill | [VERIFIED] | S2 sec. 5.1; S25; S29; S28; S27; S1 sec. 3.4 |
| Baseline release | at the start of the main wash, 60 s after circulation starts (30 s in QUICK); lid latch releases within 1 s; lid swing 0.3 s | [ESTIMATED] | |
| Baseline tablet path | 20 g tab, 36 x 26 x 15 mm, slides out of the cup when the lid opens (door is vertical), falls 250 to 300 mm into the front row of the lower rack or into a catch tray on the upper-rack front edge if fitted; it must then be reached by spray or sit in pooled liquor to dissolve | [ESTIMATED] | tab dimensions are typical values, not measured |

Requirement to model: the lid's swept volume (sec. 2.2) and the drop path below it must be free. Three outcomes [ESTIMATED]: (a) free: tab released, dissolution governed by local wetting (chemistry specialist); (b) lid blocked by a tall item in the lower-rack front row or by a handle hanging from the upper rack: tab stays in the cup, only the water that splashes through the gap dissolves it (release 0 to 30 % over the main wash); (c) lid opens but the tab lands inside a dry, shadowed pocket or a container that drains away from the sump: slow or incomplete release. Verified qualitative support: S30 and S44 as cited in sec. 2.2.

### 7.5 Rinse aid and softener

- Dose: 3 ml default, adjustable 0 to 6 ml [VERIFIED] [S25]; 3 or 4 ml default across machines [VERIFIED] [S2]. In 2.8 L of final rinse, 3 ml is 1.07 ml/L [ESTIMATED arithmetic].
- Timing: during the final (hot) rinse; baseline at 40 C on the way up [ESTIMATED]. Machines may raise the final-rinse temperature when the rinse-aid tank is empty (multi-tab mode) [VERIFIED] [S2 sec. 4.3.6].
- Function: lowers surface tension so that films sheet off (cross-link films and chemistry specialists).
- Softener: ion exchanger regenerated with brine for 3 to 4 minutes, not every cycle; 19 g salt per cycle on average [VERIFIED] [S2].

### 7.6 Drying by method

| Method | How it works | Typical parameters | Tag | Source |
|---|---|---|---|---|
| Residual-heat condensation (baseline principle) | load heated in the final rinse; after the drain, water evaporates from hot items and condenses on the cooler stainless walls and runs to the sump | final rinse historically 65 C with no heated drying; heated drying was dropped in the 1990s, saving 40 Wh per cycle but lengthening drying | [VERIFIED] | S2 sec. 4.3.2 |
| Water-tank heat exchanger on the side wall | a tank beside the tub is filled with cold water after the hot rinse and chills the wall to speed condensation; the same tank pre-warms the next fill (saves about 30 Wh per cycle) | fitted to about 25 % of models (Lot 14 era) | [VERIFIED] | S2 sec. 4.3.1.3, 4.3.2.1 |
| Automatic door opening | door opens at the end (or during drying) so humid air leaves; allows a cooler final rinse | door gap 100 to 125 mm (F&P); saving about 0.08 to 0.09 kWh, about 9 % | [VERIFIED] | S27; S2 sec. 6.1 (design option D2; the same tables give heat exchanger -0.05 kWh, fan -0.09 kWh, adsorption -0.12 kWh with 1.3 kg zeolite, heat pump -0.3 kWh for the 13 ps base case) |
| Fan-assisted | fan moves tub air through a condenser or out of the machine; Bauknecht PowerDry uses an air-air cross-flow heat exchanger | fan energy about 4 Wh per cycle | [VERIFIED] | S2 sec. 4.3.2.4 |
| Zeolite adsorption (BSH) | 1.0 to 1.5 kg of zeolite in the base; a fan pushes humid tub air through the bed, which adsorbs water and releases heat back to the tub; the bed is regenerated by an air heater at the start of the next cycle, the hot humid air helping to heat the wash | sorbent 0.2 to 5 kg (range), grains 2.4 to 4.8 mm, bed 4 to 6 cm deep; desorption 80 to 450 C, especially 220 to 250 C; air heater 250 to 2500 W, preferably 1200 to 1500 W; fan 2 to 15 L/s, especially 4 to 7 L/s; water taken up 150 to 400 ml, especially 200 to 300 ml; about 14 % energy saving; final rinse typically unheated | [VERIFIED] | S2 sec. 4.3.2.3; S22 |
| Heat pump | condenser heats the wash water; evaporator draws from a water/ice store or room air; also dries by condensing on the cold store | 0.47 to 0.49 kWh per Eco cycle | [VERIFIED] | S2 sec. 4.3.4.1; S36 |
| Heated dry (US) | the exposed element cycles on and off during the whole drying period while a vent opens through the console; optional blower | 900 W element; avoiding machine drying saves about 0.2 kWh per cycle | [VERIFIED] | S30; S31 |

Derived quantities [ESTIMATED]:

- Water left on the load after the final drain is 0.2 to 0.3 kg; this is the amount the BSH zeolite bed is sized to take up (200 to 300 ml [S22]). It gives the drying model its initial condition; the distribution over items comes from the film model.
- Energy to evaporate it: 0.25 kg x 2.4 MJ/kg = 0.60 MJ = 0.17 kWh. Heat stored in a full load cooled from 58 C to 35 C: 23 kJ/K x 23 K = 0.53 MJ. So residual-heat drying of a full ceramic load is marginal at 58 C and comfortable at 65 C, while plastics (low mass, low conductivity) stay wet: a standard observation that the model reproduces without special rules.
- Baseline SPOT-60: side-wall heat exchanger plus auto-open at 25 min into drying, 100 mm gap at the top edge. Tub air and wall temperatures then follow from the lumped model with an added tub-air node and an air-exchange rate of about 2 to 4 tub volumes per minute after opening (calibrate).

## 8. Energy and water figures for sanity checks

| Quantity | Value | Tag | Source |
|---|---|---|---|
| EU fleet-average water per cycle | 19.14 L in 1998, 10.72 L in 2013; about 15 L in 2005 for 12 ps | [VERIFIED] | S2 sec. 4.1, 4.3.11 |
| EU base case 13 ps (2014 data) | Eco 0.96 kWh, 9.8 L, 196 min; 268 kWh and 2731 L per year at 280 cycles; real-life mix 292 kWh and 3057 L | [VERIFIED] | S2 Tables 5.3, 5.4 |
| EU base case 10 ps slim-line | Eco 0.87 kWh, 10.3 L, 185 min | [VERIFIED] | S2 Table 5.5 |
| EU market averages by capacity, 2014 (CECED database) | per cycle: 6 ps 0.68 kWh and 7.90 L; 9 ps 0.81 and 9.66; 10 ps 0.88 and 10.30; 12 ps 1.00 and 11.51; 13 ps 0.96 and 9.76; 14 ps 0.93 and 10.09; 15 ps 0.97 and 10.85; 13 ps average noise 45.2 dB(A) | [VERIFIED] | S2 Tables 2.12, 2.13 |
| Best available 2014 (Topten) | Eco 0.49 to 0.84 kWh, 6.0 to 10.0 L, 40 to 45 dB(A) | [VERIFIED] | S2 Table 4.2 |
| Old EU label (Reg. 1059/2010) reference energy | SAEc = 7.0 ps + 378 kWh/year for ps >= 10 and width > 50 cm; SAEc = 25.2 ps + 126 for ps <= 9 and width <= 50 cm; 280 cycles per year; ecodesign minimum cleaning index above 1.12 and drying index above 1.08 (8 ps or more) | [VERIFIED] | S2 sec. 1.2.1 (Equations 1.4, 1.5; Table 1.5) |
| Current EU rules (Reg. 2019/2022 and 2019/2017) | EEI = 100 x EPEC / SPEC, SPEC = 0.025 ps + 1.350 kWh per cycle for ps >= 10 and width > 50 cm (1.675 kWh at 13 ps); minimum EEI below 63 from March 2021 and below 56 from March 2024 for ps >= 10; classes A below 32, B 32 to 38, C 38 to 44, D 44 to 50, E 50 to 56, F 56 to 62, G 62 and above; cleaning performance index above 1.12; drying performance index above 1.06 | [RECALLED] | S40; EUR-Lex could not be opened this session. The SPEC formula is corroborated: it equals the verified old SAEc formula divided by 280 cycles (7.0 / 280 = 0.025, 378 / 280 = 1.35). Class limits and dates are not corroborated |
| Implied Eco energy at 13 ps | class A below 0.54 kWh; class C 0.64 to 0.74 kWh; class E 0.84 to 0.94 kWh | [ESTIMATED] | arithmetic on the recalled formula |
| Current class A product | 14 ps, 0.43 kWh, 8.2 L, 388 min Eco | [VERIFIED] | S26 |
| Hand washing vs machine, 12 ps EN 50242 load | hand 49.2 (+/-27.9) L and 1.7 (+/-1.0) kWh; machine 13.2 (+/-1.7) L and 1.3 (+/-0.1) kWh | [VERIFIED] | S1 sec. 1.1 (citing Berkholz et al.) |
| Energy split, minimally compliant 2003 US machine (2.17 kWh per cycle by the standard) | about 0.49 kWh pumps, controls and machine drying; 0.39 kWh resistance heat inside the machine; 1.37 kWh external water heating to 49 C | [VERIFIED] | S31 |
| US shipment-weighted averages | 1993: about 2.6 kWh and 38 L per cycle; 2004: about 1.8 kWh and 23 L | [VERIFIED] | S31 |
| ENERGY STAR (effective 19 July 2023), standard size | at most 240 kWh/year and 3.2 gallons (12.1 L) per cycle | [VERIFIED] | S35 |
| US federal standard, standard size | 307 kWh/year and 5.0 gallons per cycle (2013 rule) | [RECALLED] | DOE 10 CFR 430.32(f), not opened |
| Standby electronics | about 2 W on 2008 US machines; 0.3 W on a current Miele | [VERIFIED] | S31; S26 |
| Pump energy share | pump is the second-largest consumer after heating; 50 to 150 W continuous | [VERIFIED] | S2 sec. 4.3.5 |

Model sanity targets for SPOT-60 (full 13 ps load, 15 C inlet): Eco 9 to 10 L, 0.70 to 0.95 kWh, 180 to 240 min; Auto 10 to 14 L, 0.9 to 1.3 kWh; Intensive 12 to 16 L, 1.4 to 1.7 kWh; Quick 9 to 12 L, 0.75 to 1.1 kWh. Heating should be 80 to 90 % of cycle energy.

## 9. Loading-related engineering failure modes

Each row gives the mechanism, the evidence, and a geometric predicate the simulator can evaluate after the rigid-body settle and again during the wash (items can move).

| # | Failure | Mechanism and consequence | Evidence | Predicate / model hook |
|---|---|---|---|---|
| F1 | Lower arm blocked from above | an item hangs through the lower-rack grid (pan handle, long utensil, cutlery through the basket floor) into the arm's swept volume; the arm stalls and washes only one sector | "The spray arms must not be blocked by items which are too tall or hang through the baskets. Test for free movement by manually rotating"; fault table "Items are blocking the path of the spray arms" [VERIFIED] [S25] | any item geometry inside the annulus r < 250 mm, 6 < z < 34 mm; contact torque T_contact in sec. 3.3 (stall above about 0.07 N m, i.e. 0.3 N at the tip) |
| F2 | Mid arm blocked from below | a tall plate, tray or board in the lower rack reaches the mid arm; worse when the upper rack is lowered | "make sure that tall plates in the lower basket do not block the middle spray arm" [VERIFIED] [S25]; user report of 27 cm practical limit [S38 (snippet)] | item top above z_UR - 33 mm within r < 235 mm |
| F3 | Mid arm blocked from above | an item hanging through the upper rack (stemware foot, utensil, tall handle) | "obstruct the middle spray arm" warnings for the upper basket [VERIFIED] [S25] | geometry inside r < 235 mm, z_UR - 35 < z < z_UR - 8 |
| F4 | Top arm blocked | tall items in the third rack or upper rack (cake server, long knives) | "so that they do not block the upper spray arm" [VERIFIED] [S25] | geometry inside r < 138 mm about (0, 20), z > 618 |
| F5 | Arm knocks an item | partial contact: arm slows each revolution, noise, item may be pushed until clear | fault table "A spray arm is knocking against a wash item" [VERIFIED] [S25] | T_contact below stall; apply impulse to the item |
| F6 | Dispenser lid blocked | tall item in the lower-rack front row or something hanging off the upper rack prevents the lid from opening or the tab from leaving | S30, S44 as cited in sec. 2.2 | intersection with the lid swept volume or the drop path (sec. 7.4) |
| F7 | Tab lands in a dead zone | tab falls into a pocket that is not sprayed and does not drain to the sump, or is caught in a container | inference from F6 sources and the requirement that all chemistry is released at dispenser opening [S1] | wetting rate at the tab's rest position |
| F8 | Nesting | spoons or bowls stacked into one another so that faces are sealed off from water | "Do not place dishes and utensils inside other items where they will cover one another" [VERIFIED] [S25] | face-to-face gap below about 3 mm over most of a soiled area (films specialist for the threshold) |
| F9 | Shadowing | a large item between the nozzle paths and a soiled face; jets travel in straight lines so shadowed faces receive only splash and run-off | straight-line jets and sparse direct coverage (jets 1, 8, 10 miss; best case 1.59 % impact time) [VERIFIED] [S1] | ray visibility from the swept nozzle positions (the Birmingham "vision area" method [S1 ch. 5]) |
| F10 | Wrong orientation of hollow ware | cups, glasses and pans not inverted collect water; concave bases pool; water trapped starves the pump (sec. 4.5) and leaves the inside unwashed and wet | "Hollow items ... must be inverted"; "Concave items ... placed at an angle so that the water can run off" [VERIFIED] [S25] | trapped volume V_trap from the film / pooling model |
| F11 | Tall narrow items in corners | champagne flutes in the corners are not reached | "should be placed in the center of the basket rather than in the corners" [VERIFIED] [S25] | coverage falls outside the arm discs (sec. 2.6) |
| F12 | Small items fall through | lids, teaspoons, small bowls drop through the grid onto the floor, the filter or the lower arm | "Make sure that small items cannot fall through the holders in the baskets" [VERIFIED] [S25] | smallest projected dimension below the grid opening (about 31 x 96 mm in LR) during settle or under jet load |
| F13 | Lightweight items flip or fly | plastic boxes and lids are lifted or overturned by jets, then fill with water or land on an arm | "Secure light items to the MultiClips" [VERIFIED] [S25] | jet force on the item (0.3 to 0.45 N per nozzle, several nozzles in sequence) versus weight minus restraint; a 30 g lid weighs 0.29 N |
| F14 | Cutlery pokes through the basket | thin handles or knife tips through the floor slots reach the lower arm | basket lids and grids exist to hold items [S34]; arm-blocking guidance [S25] | item cross-section below 3.5 x 14 mm slot and protrusion beyond 16 mm below the grid |
| F15 | Filter overload | heavy particulate soil blinds the plate and microfilter; the floor floods and the pump surges | S14 symptom chain; S25, S3 on filter cleaning | open-area tracking in sec. 5.3 |
| F16 | Too little circulating water | many upright concavities or absorbent items lower the sump level; pump ingests air, pressure pulsates | forum report of cavitation in low-fill machines when both arms run [S54 (snippet)]; current-based detection [S10] | V_sump below V_min (sec. 4.5) |
| F17 | Foam | protein soils, hand dishwashing liquid, spilled rinse aid; pump loses pressure, arms slow or stop | [VERIFIED] [S1 sec. 2.2.3]; Miele warns that spilled rinse aid causes excess foam [S25] | alpha_foam from chemistry |
| F18 | Items shift during the wash | unstable items tip under jet load or when a neighbouring item moves, changing F1 to F13 mid-cycle | "Make sure that all items are securely positioned" [VERIFIED] [S25] | keep the rigid-body solver live (at low rate) during the wash with jet forces applied |
| F19 | Rack not seated / mid-arm dock missed | upper rack at an angle or between height positions so the docking port does not seal; mid arm gets little flow | Miele allows angled setting but requires smooth sliding [S25]; pressure loss at the supply-to-arm interface reduces spray effectiveness [S47 (snippet)] | leakage area at the dock as a function of rack pose |
| F20 | Over-height item stops the upper rack or third rack sliding in | the load physically does not fit; the door cannot close | plate limits in sec. 2.6 | collision with the rack above or the ceiling during rack insertion |
| F21 | Discolouration and damage (not cleaning, but reportable) | plastics stained by carotenoid soils; silver discolours plastics | [VERIFIED] [S25] | chemistry specialist |

## 10. Evidence bearing on the architecture candidates

Evidence from this topic, for and against.

For (a), the hybrid multi-scale approach:

- Jets are coherent and ballistic over the distances that matter. PEPT shows straight-line trajectories with fitted errors of 1 to 2 mm and negligible influence of arm rotation on the path; high-speed photography agrees [VERIFIED] [S1 sec. 4.3]. A nozzle is therefore a ray source with known origin, direction, flow and speed, exactly what a Lagrangian parcel tracer needs.
- The forcing is strictly periodic and fast compared with the cycle: arm period 1.7 to 2.4 s (25 to 35 rpm) [VERIFIED], diverter period of order 1 to 2 minutes [ESTIMATED], phases of 5 to 60 minutes. A given surface point is hit directly for only about 0.1 to 1.6 % of the time [VERIFIED] [S1 Table 7.5], and the whole water round trip takes less than 3 s [VERIFIED] [S1]. Time-homogenised impingement statistics per surface element (impact count per revolution, dwell, shear impulse, wetting flux) are a natural reduction. The Birmingham group did precisely this: a geometric jet-vector model for impact location and frequency, fed into a swelling/removal soil model, reproduced full-scale cleaning of egg-yolk tiles [VERIFIED] [S1 ch. 7]; the related paper reports good prediction under standard and high-removal conditions and over-prediction under low-removal conditions [VERIFIED] [S56 (snippet)].
- The machine side is cheap to model: pump curve, branch network, nozzle orifice law and an arm torque balance are algebraic and reproduce the verified velocity, rpm and flow magnitudes (sec. 3 and 4).
- Most of the load is cleaned by something other than direct jets. PEPT with a load shows very low tracer velocities inside packed crockery and concludes that the mechanical input there is low and coverage by high-velocity jets is small [VERIFIED] [S1 sec. 4.7]. That puts the weight on film drainage, run-off from items above, soaking, temperature and chemistry, which a thin-film-plus-soil model handles at far lower cost than a volumetric free-surface solver.

Against (a), or limits it must respect:

- Secondary water is hard: splash after impact, break-up of jets on rack wires, water cascading from the upper rack, and ceiling drip are "hardly quantifiable" [VERIFIED] [S1 sec. 2.2.1] and were excluded from the Birmingham model. The coverage gap at about 100 mm radius is filled only by splash and downfall [VERIFIED] [S1]. A parcel model needs calibrated splash and re-emission closures (jets specialist).
- PEPT free-fall velocities exceed the CFD prediction (5.05 vs 3.31 m/s) with an unexplained "energy carry-over" after ceiling impact [VERIFIED] [S1 Table 4.1]; ballistic secondary droplets need care.
- Pump-starvation, sump level and filter flooding (sec. 4.5, 5.3) couple the whole tub; they need a global water inventory even in a parcel/film architecture.

For (b), fully resolved free-surface simulation, and its cost:

- The manufacturer CFD used to compare with PEPT (STAR-CCM+, unsteady Eulerian VOF with a dynamic fluid-body interaction for the free-spinning arm, 5 million polyhedral cells, time step 1e-4 s) ran "on a cluster with 96 processors for 48 hrs" to produce two arm rotations for the lower arm alone in an empty tub with no racks, followed by Lagrangian tracking of 106 particles [VERIFIED] [S1 sec. 3.5]. That is about 4600 core-hours for about 3.4 s of physical time [ESTIMATED arithmetic]. It matched in-arm and jet velocities well (1.43 vs 1.60 and 7.24 vs 7.69 m/s) but not the downfall.
- A wash phase has of order 1000 to 2500 arm revolutions (60 min at 30 rpm = 1800). Resolving even a few revolutions with a loaded tub at film-resolving resolution (films are about 0.1 to 1 mm thick: 0.9 mm mean hold-up estimate in S1) is far outside a 30-minute laptop budget; a particle method at 2 to 3 mm resolution cannot represent the films or the 2 to 3 mm jets faithfully.
- Value of (b): it is the only way to obtain splash, cascade and pooling statistics without closures, and jets, films and pooling interact with the actual load geometry.

For (c), a mixture: the evidence supports using (a) as the production path and reserving a resolved free-surface solve for what the reduced model cannot close: (i) offline or cached generation of splash/re-emission and rack-wire break-up closures; (ii) a coarse tub-scale solve of one or two arm revolutions per diverter state for the actual load, used only to obtain the secondary-water distribution (where run-off, cascades and pools go) and the sump return time, then homogenised. Vendor material found in passing (AVL, FIFTY2 PreonLab) makes the same point that one arm revolution may suffice for nozzle-direction studies [VERIFIED] [S57 (snippet)]; details belong to the numerics specialist.

Design consequences of the machine data for any architecture are listed in the structured summary and in sec. 11.


## 11. Gaps I could not close

1. Rack metrology. No source gave dishwasher rack wire diameters, base-grid pitch, tine pitch, tine height or tine angle. Section 2.4.2 is estimated. One afternoon with calipers on a real 60 cm machine (and a 3D scan of both racks) removes this gap.
2. European nozzle tables. Only the Whirlpool DU750 lower arm has published positions and angles, and no arm has published nozzle diameters or shapes. The mid and top arm tables and all nozzle sizes are estimated.
3. Flow rate. Verified values span 20 to 45 L/min per arm (US machines), "about 50 L/min" in Swiss course notes for a 4 L fill, and 55 L/min design flow for a sink-type pump. No measured Q-H curve for a European BLDC circulation pump was found. Baseline 30.7 L/min (lower) and 26.3 L/min (upper) is a mid-range choice.
4. Arm pressure in European machines. ASKO measured it but masked the numbers. A patent range of 5 to 13 kPa (lower) and 2 to 7.5 kPa (upper) seen in a search extract conflicts with the 30 to 40 kPa implied by PEPT jet velocities and the 35 kPa student measurement; I could not re-open that patent to see its context.
5. Diverter timing. Mechanisms are documented, switching periods and pump-speed schedules per programme are not.
6. Phase-level programme timing. Totals (water, energy, duration) and phase temperatures are verified for several machines; durations of individual steps, the exact number of fills in a 9.5 L Eco programme and the dispenser release time are estimated. A logged run (temperature, mains power, inlet flow, drain events, vibration for arm rpm) of one real machine fixes all of these at once.
7. Dispenser geometry. Position, lid kinematics and tab drop path are estimated; manufacturers differ (hinged lid, sliding lid, tab tray on the upper rack).
8. EU regulation numbers in sec. 8 are recalled, not read this session (EUR-Lex returned an empty page). EN/IEC 60436 was not opened (standards specialist).
9. Sump volume, pipe volumes and minimum submergence: estimated from a water-inventory argument only.
10. Filter flow split and capture efficiencies: estimated from open areas; no measurement found.
11. Arm bearing friction: fitted to reproduce the verified 35 rpm; the pressure dependence is a hypothesis.
12. Two sources seen only in search extracts could not be opened and are flagged "(snippet)": the Swiss course notes (4 L, 50 L/min) and the retailer plate-size listings. The Bonn modelling paper (Tenside Surfactants Detergents 2024) and the Bengtsson heat-pump papers probably contain phase-level data but were not accessible.

## 12. Recommended model and defaults

This is what I would implement. Everything is parametric; the defaults below define the baseline machine SPOT-60. Tags: geometry and hydraulic defaults are [ESTIMATED] unless listed as verified in sections 2 to 7.

### 12.1 Machine description (data)

```yaml
machine: SPOT-60            # generic 60 cm EU built-in, 13 place settings, 3 arms, third rack
frame:                       # mm; origin on lower-arm axis at tub floor; x right, y back, z up
  tub: {x: [-273, 273], y: [-250, 250], z: [0, 650], corner_radius_vertical: 30, floor_slope_deg: 4}
  door_liner_plane_y: -250   # door closed; hinge axis along x at (y=-262, z=-20)
  sump: {center_xy: [0, -40], diameter: 150, depth: 85, working_volume_L: 1.2}
  filter:
    flat_plate: {size_xy: [260, 220], hole_d: 0.8, open_fraction: 0.15}
    coarse_cup: {diameter: 60, height: 105, opening: 5.0}
    micro: {mesh: 0.20, area_cm2: 190, open_fraction: 0.40}
  dispenser: {lid_center: [-70, -250, 300], lid_wh: [95, 60], swing_deg: 110, keepout_depth: 62,
              rinse_aid_outlet: [10, -250, 300]}
racks:
  lower:  {size: [525, 495, 160], grid_top_z: 50, rim_wire: 5.0, grid_wire: 3.4, tine_wire: 3.4,
           coating_mm: 0.4, grid_pitch_xy: [35, 100], tine_rows: 8, tine_pitch: 25,
           tine_height: [62, 75], tine_lean_deg: 8, foldable_rows: [5, 6, 7, 8], wheels: 8}
  upper:  {size: [505, 480, 125], grid_top_z_options: [350, 375, 400], grid_wire: 3.2,
           grid_pitch_xy: [30, 85], tine_wire: 3.0, tine_height: 40, tine_pitch: 22,
           cup_shelves: {count: 4, size: [225, 85], height_above_grid: 75}}
  third:  {size: [500, 470], top_edge_below_ceiling: 10, deepest_below_ceiling: 81,
           side_depth: 45, centre_tilt_deg: 4, comb_gaps: [10, 7, 3], grid_pitch: 19}
  cutlery_basket: {size: [240, 135, 215], cells: 7, floor_slot: [3.5, 14], lid_openings: [9, 26]}
arms:
  lower: {axis_xy: [0, 0],  tip_radius: 247, nozzle_z_up: 30, nozzle_z_down: 8,  hub_d: 21,
          inertia_wet: 6.3e-3, weight_N: 1.8, sense: ccw, k_f: 0.0093, c_v: 0.002, thrust_sign: -1}
  mid:   {axis_xy: [0, 0],  tip_radius: 232, nozzle_z_up: "UR_grid_z - 10", nozzle_z_down: "UR_grid_z - 33",
          hub_d: 18, inertia_wet: 4.5e-3, weight_N: 1.5, sense: cw, k_f: 0.0038, c_v: 0.002, thrust_sign: +1}
  top:   {axis_xy: [0, 20], tip_radius: 135, nozzle_z_down: 632, hub_d: 12, inertia_wet: 0.5e-3, weight_N: 0.6,
          sense: cw, k_f: 0.0050, c_v: 0.0005, thrust_sign: -1}
  nozzles: see tables in section 3.2   # id, half, R, theta, rho, shape, size, area, Cd
hydraulics:
  pump: {N0_rpm: 3000, H0_m: 5.5, b_m_per_Lmin2: 1.333e-3, N_range: [1400, 3400],
         eta_hyd: 0.40, eta_motor: 0.72, P0_W: 8}
  branches:                 # static lift m, loss coefficient Pa s2/m6, pipe volume L
    lower: {z: 0.15, K: 2.0e10,  V_pipe: 0.25}
    mid:   {z: 0.52, K: 5.6e10,  V_pipe: 0.40}
    top:   {z: 0.80, K: 1.07e12, V_pipe: 0.05}
  diverter: {states: {L: [lower], U: [mid, top], A: [lower, mid, top]}, transition_s: 1.5}
  nozzle: {C_v: 1.0}
  inventory: {V_min_sump_L: 0.5, t_flight_s: 0.5, t_return_s: 1.5, carry_over_L: 0.4,
              topup_L: 0.5, max_topups_per_phase: 1}
  fill_L_per_min: 3.0
  drain: {L_per_min: 16, pattern_s: [35, 10, 10]}
thermal:
  heater_W: 2000
  heater_duty_ramp: 0.7
  C_machine_J_per_K: 14000
  G_water_load_W_per_K: 600      # replace by the per-element film model when available
  G_water_machine_W_per_K: 250
  UA_W_per_K: 2.6
  T_inlet_C: 15
  T_ambient_C: 23
dosing: {detergent_g: 20, release_after_circulation_s: 60, rinse_aid_ml: 3, rinse_aid_at_C: 40}
drying: {method: heat_exchanger_plus_auto_open, auto_open_after_min: 25, door_gap_mm: 100}
programmes: see section 7.3      # ECO 50, AUTO 45-65, INTENSIVE 70, QUICK 60, GLASS 40, PRE-RINSE
```

### 12.2 Equations to implement

1. Hydraulic operating point, re-solved whenever pump speed, diverter state, nozzle blockage, filter state or air fraction changes:
   - Q_j(p) = sqrt( max(p - rho_w g z_j, 0) / (K_j + rho_w / (2 (C_d A)_j^2)) ) for each open branch j.
   - Pump: Q_pump(p) = sqrt( max(H_0 (N/N_0)^2 f_H - p / (rho_w g), 0) / b ), with b in m per (m3/s)^2 (4.80e6) and f_H the air-ingestion derating (sec. 4.5).
   - Solve sum_j Q_j(p) = Q_pump(p) for p by bisection on [0, rho_w g H_0 (N/N_0)^2].
   - Arm pressure p_arm,j = p - rho_w g z_j - K_j Q_j^2; per-nozzle flow Q_i = C_d,i A_i sqrt(2 p_arm / rho_w); jet speed v_i = C_v sqrt(2 p_arm / rho_w).
   - A blocked or partly blocked nozzle is handled by scaling A_i; during a diverter transition scale each branch's (C_d A) by its opening fraction.
2. Arm rotation: I d(omega)/dt = sum_i m_dot_i r_i (v_i t_i - omega r_i) - (k_f |p_arm A_hub + s (F_jz + W)| + c_v omega) sgn(omega) - T_contact; arm angle phi(t) integrates omega. With no contact use the steady solution of sec. 3.3 and phi = phi_0 + omega t per diverter state.
3. Nozzle kinematics for the jet module. For nozzle i on lobe h (h = 0 for "+", pi for "-") with arm angle phi and rotation sense sigma (+1 counter-clockwise, -1 clockwise):
   - e_r = (cos(phi + h), sin(phi + h), 0); e_lead = sigma (-sin(phi + h), cos(phi + h), 0); e_trail = -e_lead.
   - position x_i = (x_axis, y_axis, z_nozzle) + R_i e_r.
   - direction in the arm frame d_i = cos(rho_i) (cos(theta_i) e_r + sin(theta_i) e_trail) + sin(rho_i) e_z.
   - absolute exit velocity u_i = v_i d_i + omega R_i e_lead (the nozzle's own motion; up to 0.9 m/s, a deflection of up to 6 deg for a vertical jet).
   - emitted state per nozzle: (x_i, u_i, Q_i, equivalent diameter sqrt(4 C_d,i A_i / pi) or slot dimensions, T_w, liquor composition).
4. Water inventory each machine step: V_sump = V_total - V_pipes(open branches) - Q (t_flight + t_return) - V_trap - V_filter. Replace Q (t_flight + t_return) by the actual airborne and film volumes when the jet and film modules provide them. Compute alpha and f_H, feed back to 1.
5. Filters: track suspended particle mass by size class in the liquor; per time step dt remove eta_k Q dt / V_circ of each class at its capturing stage, add captured area to that stage, update open fractions and V_filter = A_floor h with h = (Q_k / (C_f A_open,k))^2 / (2 g).
6. Thermal: three-node model of sec. 6.2 at 1 s steps; heater enabled only when the pump runs and V_sump > V_min; stop at target temperature.
7. Programme sequencer: a table-driven state machine over the steps of sec. 7.3 (fill, circulate with pump speed and diverter pattern, heat-to-target, hold, dose, drain, dry). Fill adds water at T_in and mixes with carry-over; drain removes all free water except carry-over and the water on the load.
8. Dispenser: at release time test the lid swept volume and the drop path against the settled load; spawn the tablet as a rigid body if free.
9. Drying: after the final drain initialise per-item water from the film module; evaporate with item temperatures from the thermal model; condensation sink on the walls (and heat-exchanger wall); after auto-open add air exchange.

### 12.3 Rates and cost

- The machine model is negligible in cost: a hydraulic re-solve takes microseconds and is needed only at events; arm angles are analytic between events. Budget it at under 0.1 % of the 30-minute allowance.
- Sample the periodic forcing by arm angle, not by time: for each diverter state and pump speed, tabulate impingement over one revolution in 360 to 720 angular steps (0.5 to 1 deg; at R = 240 mm one degree is 4.2 mm of nozzle travel, comparable to the jet diameter), then weight by the number of revolutions in each programme step. Recompute a state's table when the load moves, the arm speed changes by more than a few percent, or a nozzle or filter state changes.
- Because the lower and mid arms have different, incommensurate periods (1.71 s and 2.0 s here), their forcings can be treated as statistically independent between diverter states; within state A (both on) the cascade from the upper rack onto the lower rack should be sampled over the joint phase.

### 12.4 Outputs the machine model owes other modules

| To | Quantity |
|---|---|
| jets | per-nozzle emission state over arm angle; arm angular speed; nozzle shape |
| films | water temperature and composition; phase timeline; drain events; tub wall temperatures |
| soils / chemistry | liquor temperature history, detergent release time and mass, dilution at each drain (carry-over fraction), suspended soil by size class (redeposition stock), rinse-aid dose and time |
| items / rigid body | rack geometry, arm swept volumes, dispenser keep-out and drop path, contact torques on arms, jet forces on light items |
| scoring / report | arm stall and knock events, pump starvation time, filter state, energy, water, cycle duration, per-phase temperatures reached |

## 13. Calibration parameters

What real-world tests should measure, with the range I expect. "Test" names the cheapest adequate measurement.

| Parameter | Baseline | Expected range | Test |
|---|---|---|---|
| Tub interior W x D x H | 546 x 500 x 650 mm | 540 to 560 x 490 to 520 x 600 to 710 | tape, 3D scan |
| Rack grid pitch, wire diameters, tine pitch / height / lean, fold-down kinematics | sec. 2.4.2 | pitch 18 to 35 mm, tine 50 to 90 mm, wire 3 to 6 mm | calipers, scan |
| Upper rack positions; mid-arm clearance to tallest lower item | 350 / 375 / 400; 7 mm | step 20 to 25 mm; 3 to 15 mm | tape |
| Nozzle positions, shapes, areas, angles for each arm | sec. 3.2 | diameters 1.6 to 3.5 mm (special nozzles to 7 mm); 8 to 14 nozzles per arm | microscope / pin gauges; jet direction by laser sheet or by photographing jets through a clear door |
| Discharge and velocity coefficients C_d, C_v | 0.78 to 0.85; 1.0 | 0.6 to 0.95; 0.9 to 1.0 | bench: arm on a pressure-regulated supply, flow meter, jet reach |
| Arm pressure vs pump speed | 34.9 kPa lower, 33.6 kPa mid at 3000 rpm | 5 to 50 kPa | pressure tap at the hub (as ASKO did with a manometer over a nozzle) |
| Flow per branch | 30.7 and 26.3 L/min | 15 to 45 L/min per active branch | inline flow meter or capture-and-weigh |
| Pump curve H_0, b; speed schedule per programme | 5.5 m; 1.333e-3 m/(L/min)^2; 2200 to 3400 rpm | H_0 3 to 8 m | pump bench test; tachometer or current-frequency logging |
| Feed loss coefficients K_j; dock leakage | sec. 4.3 | factor 0.5 to 3 | pressure at pump outlet and at hub |
| Arm speed vs pressure; friction k_f, c_v; stall torque | 35 and 30 rpm; 9.3 and 3.8 mm; 0.002 N m s; 0.07 N m margin | 20 to 60 rpm; stall margin 0.02 to 0.15 N m | optical or vibration pickup (driving-jet wall impacts); force gauge at the tip |
| Diverter pattern and transition time | 60/60 s; 1.5 s | 20 to 120 s per state; 0.5 to 3 s | microphone / vibration log, clear door video |
| Fill volume per phase; number of fills per programme | 3.8 / 2.9 / 2.8 L (Eco) | 2.6 to 5 L per fill; 3 to 6 fills | inlet flow meter |
| Carry-over after drain; water left on the load | 0.4 L; 0.25 kg | 0.3 to 0.5 L; 0.15 to 0.4 kg | weigh machine and load before and after |
| Sump working volume, pipe volumes, V_min | 1.2 L; 0.70 L; 0.5 L | 0.8 to 1.6; 0.5 to 1.0; 0.3 to 0.8 | fill-and-measure; add water until surging stops |
| Airborne + film hold-up time t_flight + t_return | 2.0 s | 1 to 4 s | sump level sensor step response when the pump starts |
| Air-ingestion derating law (alpha, f_H), foam sensitivity | sec. 4.5 | to be measured | pressure trace while removing water in 0.1 L steps |
| Filter open areas, split, capture efficiency, blinding per gram of soil | 51 / 49 % split; eta 0.49 | split 30 to 80 % through the plate | particle dosing by size class; turbidity decay |
| Heater power and duty; C_m; UA; G_wl | 2000 W, 0.7; 14 kJ/K; 2.6 W/K; 600 W/K | 1800 to 2400 W; 10 to 20; 1.5 to 4; 300 to 1200 | power meter plus thermocouples in sump, on items, on walls; empty versus loaded runs |
| Programme timeline (every step of sec. 7.3) | sec. 7.3 | Eco 180 to 390 min, etc. | one logged cycle per programme |
| Dispenser release time, lid kinematics, tab landing zone | 60 s; 110 deg; front row of LR | 0 to 20 min after start depending on pre-wash | camera in the tub |
| Rinse-aid dose and timing | 3 ml at 40 C | 1 to 6 ml | conductivity or surface tension of the final rinse |
| Drying: door-open time and gap, wall temperatures, air exchange | 25 min; 100 mm | 0 to 60 min; 70 to 125 mm | humidity and temperature loggers, residual water by weighing |
| Jet force on light items; arm contact behaviour | 0.3 to 0.45 N per nozzle | 0.1 to 0.6 N | force plate above the arm |

Priority order for calibration effort: (1) nozzle tables and arm pressure, (2) rack metrology, (3) logged programme timelines, (4) flow rate and water inventory, (5) filter behaviour, (6) thermal constants, (7) dispenser and drying details.

## 14. Sources

Opened and read this session unless marked "(snippet)" (seen only as a search-result extract) or "(recalled)" (not opened).

- S1. Perez-Mohedano, R. (2016). Cleaning principles in automatic dishwashers. EngD thesis, University of Birmingham. https://etheses.bham.ac.uk/id/eprint/6590/ (PDF: https://etheses.bham.ac.uk/id/eprint/6590/9/PerezMohedano16EngD_sizereduced.pdf). Sections 2.1, 3.2, 3.4, 3.5, 4.2 to 4.7, 5.2 to 5.6 (Tables 5.3, 5.4, 5.7, 5.8), 7.3 (Tables 7.4, 7.5), appendix Matlab code.
- S2. Boyano, A., Moons, H., Villanueva, A., Graulich, K., Ruedenauer, I., Alborzi, F., Hook, I., Stamminger, R. (2017). Ecodesign and Energy Label for Household Dishwashers: Preparatory study, final report. JRC106993, EUR 28645 EN. https://susproc.jrc.ec.europa.eu/product-bureau/sites/default/files/contentype/product_group_documents/1581682730/JRC106993_Prepstudy_DW_%2020171116%20%283%29.pdf . Sections 1.2, 2.2, 4.2, 4.3, 5.1 (Tables 4.2, 4.5, 4.7, 4.8, 5.3 to 5.6, 5.12), 6.1.
- S3. Tsouknidas, P., Zhang, X. (2010). Dishwasher improvement at ASKO: developing a simplified test method to determine the influence of spray arm speed and pressure. MSc thesis, Chalmers University of Technology. https://odr.chalmers.se/items/5532c44e-4bed-49cb-a84d-b5f16e1643cf (https://hdl.handle.net/20.500.12380/124430).
- S4. Galban, L. (2014). Hydraulic switch for dishwashers with bottle blaster system. MSc thesis, University of Louisville. https://ir.library.louisville.edu/etd/474 (abstract page only; the PDF was blocked).
- S5. Baker, D., Curtis, T., Michalik, T. et al. Controlled rotation spray system for the middle arm of a dishwasher (ME481 poster). https://www.slideshare.net/slideshow/me481postercompressed/48281398
- S6. Zhu, Y., Zhang, J., Li, Y., Huang, P., Xu, H., Zheng, F. (2021). Experimental investigation of unsteady pressure pulsation in new type dishwasher pump with special double-tongue volute. Machines 9(11), 288. https://www.mdpi.com/2075-1702/9/11/288
- S7. Ning, C. et al. (2022). Numerical analysis of a new type of dishwasher pump for different rotation speeds of the volute. Frontiers in Energy Research 9, 825159. https://www.frontiersin.org/journals/energy-research/articles/10.3389/fenrg.2021.825159/pdf
- S8. Whirlpool Corp. US10154772B2, Spray arm for a dish treating appliance. https://patents.google.com/patent/US10154772B2/en
- S9. Electrolux Home Products. WO2013104700A1, Method for detecting rotation of a dishwasher spray arm. https://patents.google.com/patent/WO2013104700A1/en
- S10. Electrolux Home Products. US10244919B2 (also EP2916707B1), Detecting operational state of a dishwasher. https://patents.google.com/patent/US10244919B2/en
- S11. General Electric. US4509687A, Multiple spray distribution system for a domestic dishwasher (1985). https://patents.google.com/patent/US4509687A/en
- S12. BSH Hausgeraete. US10058226B2, Dishwasher comprising at least one dishwasher spray arm. https://patents.google.com/patent/US10058226B2/en
- S13. BSH Hausgeraete. US10568488B2, Spray arm and dishwasher. https://patents.google.com/patent/US10568488B2/en
- S14. BSH. US8603255B2, Dishwasher, in particular domestic dishwasher, and method for operating said dishwasher. https://patents.google.com/patent/US8603255B2/en
- S15. EP2277430A1, Dishwasher with an optimised filter system (applicant not captured). https://patents.google.com/patent/EP2277430A1/en
- S16. Whirlpool Corp. US7261111B2, Dishwasher (fine filter with zoned open area). https://patents.google.com/patent/US7261111B2/en
- S17. (snippet) EP0150147A2, Dishwasher with microfilter, https://patents.google.com/patent/EP0150147A2/en ; Whirlpool US5779812A, Multi-mesh mechanical filter screen system, https://patents.google.com/patent/US5779812
- S18. BSH. US10694921B2, Wire dishware and cutlery rack for dishwasher. https://patents.google.com/patent/US10694921B2/en
- S19. BSH. US9265403B2, Dishwasher having an adjustable upper basket. https://patents.google.com/patent/US9265403B2/en
- S20. BSH. US11612300B2, Configurable lower rack for dishwasher. https://patents.google.com/patent/US11612300B2/en
- S21. Samsung Electronics. US11969130B2, Rack assembly and dish washer comprising the same. https://patents.google.com/patent/US11969130B2/en
- S22. BSH. US8888928B2, Dishwasher comprising a sorption drying unit. https://patents.google.com/patent/US8888928B2/en
- S23. Miele. US20120167920A1, Method for carrying out a dishwashing program. https://patents.google.com/patent/US20120167920A1/en
- S24. Miele. US7100623B2, Dishwasher having spray arms and a circulation pump. https://patents.google.com/patent/US7100623B2/en
- S25. Miele. Operating instructions, dishwasher G 7266 SCVi SF (US). https://static.pcrichard.com/docs/G7266SCVISF_Owners-Manual_01.pdf
- S26. Miele. Product fiche G 7281 SCVi (GB). https://media.miele.com/downloads/n-/gb/FS_13184010_GBE_GB-en-GB.pdf
- S27. Fisher and Paykel. Wash programme data and standards test, DW60U4EI3 and DW60FC3. https://dam.fisherpaykel.com/KZ3PKN00/at/2xkxkxfx53w966n5f2w5nh3/FP-StandardsTest-en-DW60U4EI3-Dishwasher-0-433855A-NZ-AU.pdf ; https://dam.fisherpaykel.com/KZ3PKN00/at/kzjxfxkqj6wbbb5x96t6h82w/FP-StandardsTest-en-DW60FC3B3-DW60FC3X3-Dishwasher-0-433854A-NZ-AU-SG.pdf
- S28. Fisher and Paykel. Wash program data, DishDrawer DD60 (UK and Ireland). https://www.fisherpaykel.com/on/demandware.static/-/Sites-fpa-master-catalog/default/dw215d57f7/GeneralFiles-FisherPaykelEU/FP-WashProgramData-en-DD60DHI9-DD60SHTI9-DD60SHI9-DD60DHI9-DD60SHTI9-DD60SHI9-DishDrawer-0-592833B-BI-EU.pdf
- S29. OEM 60 cm dishwasher instruction manual (programme table per EU 2019/2022). https://www.lockeliving.com/getattachment/de55ae02-68af-41c1-bcba-9db2c746ee4c/Instructions-manual-Dishwasher.pdf?lang=en-GB
- S30. Frigidaire/Electrolux-type service tech sheets. https://www.fix.com/assets/manuals/560C34F8E918ACA33EC6B0261F7A8EAC90CC32DF.pdf ; https://www.fix.com/assets/manuals/AFFDEED6D1390A8DA111704C9170DE737707D5DB.pdf ; https://assets.ajmadison.com/ajmadison/itemdocs/A13762001B.pdf
- S31. Hoak, D. E., Parker, D. S., Hermelink, A. H. (2008). How energy efficient are modern dishwashers? ACEEE Summer Study. https://www.aceee.org/files/proceedings/2008/data/papers/1_123.pdf
- S32. GE Appliances support: Dishwasher, levels of wash action. https://products.geappliances.com/appliance/gea-support-search-content?contentId=22172
- S33. Spare-part listings: Bosch upper spray arm with feed pipe 11010055, https://www.ersatzteilshop.de/sprueharm-oben-mit-zufuehrrohr-bosch-11010055-fuer-geschirrspueler.html ; Bosch heat pump 00755078, https://www.ersatzteilshop.de/heizpumpe-bosch-00755078-730-60010-09-fuer-geschirrspueler.html ; (snippet) marketplace listing for heat pump 12019637 rated 2000 W, https://www.ebay.de/p/5030787077
- S34. Bosch. Cutlery basket SMZ5100. https://www.bosch-home.co.uk/en/product/dishwashers/dishwasher-accessories/baskets-and-holders/cutlery-baskets/SMZ5100
- S35. ENERGY STAR. Dishwashers key product criteria. https://www.energystar.gov/products/dishwashers/key_product_criteria
- S36. Seren, E. M., Ipek, M. (2023). Dynamic modeling and experimental validation of dishwasher with heat pump system. Modelica Conference. https://ecp.ep.liu.se/index.php/modelica/article/view/943
- S37. (snippet) Swiss appliance-technology flashcards "Geraetetechnik". https://card2brain.ch/box/20220110_geraetetechnik
- S38. (snippet) Retailer listings and a user review for Bosch models SMS8YCI03E, SPS6YMW14E, SBV4EVX08E, SMU8EDS01A. https://www.coolblue.nl/en/product/905883/bosch-sms8yci03e-freestanding.html ; https://www.coolblue.nl/en/product/960331/bosch-sps6ymw14e.html ; https://www.productreview.com.au/listings/bosch-serie-8-smu8eds01a
- S39. (snippet) BSH Wiki: AquaSensor; Siemens LADY PLUS 45; Zeolite drying. https://wiki.bsh-group.com/en/wiki/Zeolite_drying
- S40. (recalled) Commission Regulation (EU) 2019/2022 (ecodesign, household dishwashers) and Delegated Regulation (EU) 2019/2017 (energy label). https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32019R2022
- S41. Whirlpool. EP2292134B1, Dishwasher with moving water nozzles. https://data.epo.org/publication-server/rest/v1.2/patents/EP2292134NWB1/document.html (no numbers; consulted)
- S42. Wikipedia, "Dishwasher". https://en.wikipedia.org/wiki/Dishwasher
- S43. (snippet) Spray-arm patents: EP2789285A1 (fan nozzle), https://patents.google.com/patent/EP2789285 ; US9010345B2 (nozzle outlet sizing), https://patents.google.com/patent/US9010345 ; US9211051B2 ; BSH US11826000B2 (satellite arm), https://patents.google.com/patent/US11826000 ; US9220393B2 (controlled rotation), https://patents.google.com/patent/US9220393B2/en
- S44. (snippet) Manufacturer support and repair pages on dispensers: https://support.electrolux.co.uk/support-articles/article/dishwasher-detergent-dispenser-does-not-fully-open-does-not-open ; https://producthelp.whirlpool.com/Dishwashers/Dishwasher_Product_Assistance/Detergent_dispenser_is_not_opening ; https://forum.appliancepartspros.com/t/soap-dispenser/269854 ; https://easybear-appliancerepair.com/blog/ge-dishwasher-will-not-dispense-detergent
- S45. (snippet) Rack sources: US5351837A, https://patents.google.com/patent/US5351837 ; US11272828B2, https://patents.google.com/patent/US11272828 ; US6364130B2, https://patents.google.com/patent/US6364130B2/en ; replacement-rack listings, https://www.fix.com/parts/appliance/dishwasher/racks/
- S46. (snippet) Consumer wiki on spray arms (low reliability). https://www.jaspector.com/wiki/dishwasher-spray-arm/
- S47. (snippet) Patent extracts returned by search that I could not re-identify afterwards: domestic spray pressure 2 to 8 psi; lower/upper arm pressure 50 to 130 / 20 to 75 mbar; GE geared spray head (236 mm, 24:1, 2.5 to 60 rpm); pressure loss at the supply-to-arm interface. Candidate documents in those result lists: https://patents.google.com/patent/US8905053B2/en ; https://patents.google.com/patent/US20080271765A1/en ; https://data.epo.org/gpi/EP3970593B1 ; https://patents.google.com/patent/US4418868
- S48. (snippet) Flueck, S., Kleingries, M., Dober, E., Wellig, B. (2017). Dishwasher with integrated heat pump. HPT Magazine. https://heatpumpingtechnologies.org/?p=52893
- S50. (snippet) Stamminger et al. (2024), dishwasher cycle modelling paper, Tenside Surfactants Detergents. https://www.degruyterbrill.com/document/doi/10.1515/tsd-2024-2634/html
- S51. (snippet) Product listings and EPREL entries for Eco programmes (AEG, LORD, Smeg, Siemens SN25D800GC, Privileg). https://eprel.ec.europa.eu/qr/1425813 ; https://kbbfocus.com/news/5372-dishwasher-eco-modes-a-key-selling-point-for-energy-conscious-buyers ; https://www.libble.eu/privileg-pv2uc10bs7a0s/online-manual-1081004/
- S52. (snippet) Hanning CPE 16 circulation pump with integrated heating. https://www.directindustry.com/prod/hanning/product-13764-1449075.html
- S53. (snippet) Repair forum thread on a Grundig/Beko water switch. https://forum.electronicwerkstatt.de/phpBB/Ersatzteile_Reparatur_Geschirrspueler/spuema_grundig_beko_gnvp4620c_sprueharm_unten_dreht_nicht-t163026f58_bs0.html
- S54. (snippet) Hobbyist forum thread on alternating wash. https://automaticwasher.org/threads/dishwashers-alternating-wash.46117/
- S55. Miele. EP1586264B1, dishwasher spray arm with elastic nozzle elements (cites corner-nozzle prior art EP 0 974 302). https://patents.google.com/patent/EP1586264B1/en
- S56. (snippet) Perez-Mohedano, R., Letzelter, N., Bakalis, S. (2017). Integrated model for the prediction of cleaning profiles inside an automatic dishwasher. Journal of Food Engineering. https://research.birmingham.ac.uk/portal/en/publications/integrated-model-for-the-prediction-of-cleaning-profiles-inside-an-automatic-dishwasher(63f83dc3-f04b-418e-b89e-8f6e51a2c084).html
- S57. (snippet) Vendor articles on particle-based dishwasher simulation: https://www.fifty2.eu/innovation/dishwasher-simulation-in-preonlab/ ; https://avl.com/en/blog/particle-based-simulation-optimize-dishwasher-design
