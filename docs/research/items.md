# Spotless research dossier: ITEMS

Tableware/cookware catalogue, material and contact-mechanics data, jet-induced displacement, collision-modelling practice, prior art.

Author: "items" research specialist. Date: 2026-10-08.

---

## 0. How to read this dossier

### 0.1 Confidence tags

Every quantitative value carries exactly one tag.

| Tag | Short form in tables | Meaning |
|---|---|---|
| [VERIFIED] | V | Seen this session in source text. Two sub-cases, distinguished in the Sources list: "(page)" = I opened the page/PDF and read the text; "(se)" = seen as a quoted extract of the named page in a search result (page itself not opened). Retailer listings are still retailer listings: a [VERIFIED] retailer mass means "the listing says so", not "a metrologist weighed it". |
| [RECALLED] | R | From my own memory; source not opened this session. |
| [ESTIMATED] | E | My own derivation; the derivation is shown or referenced (Section 2.4 thin-shell estimator, Section 4 force estimates). |

### 0.2 Research limitations (read before relying on the numbers)

1. **IEC 60436 Annex A/B is not publicly readable.** I confirmed the table of contents of IEC 60436:2025 Ed.5 ("Annex A (normative) Place settings and serving pieces", "Annex B (informative) Tableware specifications", pp. 51-62) but the item table itself is paywalled. IEC load-item dimensions below are therefore [RECALLED] except where an open document (AHAM DW-2-2020, 10 CFR 430 App. C2, an Australian test-material factsheet) names the same physical article. Buying IEC 60436:2025 (about EUR 520) is recommended; it would turn roughly 15 rows of the catalogue from R to V and give official masses with tolerances.
2. **Two planned search batches could not be run** (wet/soapy friction literature; several product spec sheets). Affected values are flagged [RECALLED] or [ESTIMATED] and listed in "Calibration parameters".
3. **No source gives friction of tableware against nylon-coated rack wire, wet or dry.** The closest measured data are dry static friction of real tableware on household surfaces (Matheus and Dollar 2010, opened and read). Everything "wet/soapy" in this dossier is a reasoned estimate and is the single most important calibration gap in my topic.
4. Product masses from retailers sometimes include packaging. Where I could tell, I say so.

### 0.3 Cross-links to sibling dossiers

| Topic here | Sibling that owns the detail |
|---|---|
| Rack geometry, tine pitch, spray-arm sweep volume, pump curve | machine |
| IEC/AHAM soils, soil-to-item assignment, scoring, loading rules | standards |
| Jet velocity decay, breakup, impingement footprint | jets |
| Water retained in foot rings / flipped containers, drainage | films |
| Soil type per item, adhesion, soaking | soils |
| Damage to non-dishwasher-safe items (wood, cast iron, crystal etching), thermal softening of PP | chemistry |
| Solver cost, GPU boundary handling of thin shells | numerics |
| Action space, observation format, human-baseline protocol | benchmark |

---

## 1. Executive summary

1. **Almost all tableware is a thin shell of revolution plus optional add-ons (handle, stem, spout).** A single 2D profile polyline `(r, z, t)` per item is enough to generate (a) the render mesh, (b) the rigid-body collision proxy, (c) an exact analytic signed-distance field for the water simulation, and (d) mass, centre of mass and inertia. A thin-shell estimator built on this (Section 2.4) reproduced 20 masses verified this session with a median absolute error of 6 to 7% (range -12% to +39%; the outliers are a clad saucepan and a perforated colander).
2. **Wall thickness is 1 to 6 mm and rack wire is about 4 to 5 mm.** These are the smallest length scales in the whole game. They set the rigid-body time step (about 1 ms), force every engine's default tolerances to be overridden (Jolt default convex radius 0.05 m, penetration slop 0.02 m; Bullet margin 0.04 m; MuJoCo default contact time constant 0.02 s implies 3 to 4 mm of penetration for a 0.5 m/s impact), and are the main reason a fully resolved free-surface simulation cannot see the load geometry at affordable resolution.
3. **Real friction of tableware is low.** Measured dry static friction of real plates, mugs, glasses, cutlery and plastic containers on household surfaces is 0.10 to 0.35 (mean 0.30, median 0.255 over 65 objects x 3 surfaces), far below handbook "clean" values such as glass-on-glass 0.9 to 1.0. Recommended defaults are 0.25 to 0.30 as-loaded and 0.15 to 0.20 wet with detergent, with silicone and unglazed foot rings as high-friction exceptions.
4. **A single 2 mm jet at the measured mean ejection speed (7.69 m/s) carries about 0.19 N of momentum flux.** That equals the weight of a 19 g object. Container lids (10 to 40 g), teats, chopsticks, teaspoons lying flat, and light PP cups/tubs (40 to 60 g, which see up to twice the force because a concave interior reverses the jet) are at or above the tipping/lift threshold; glass, ceramic and steel items are 5 to 100 times too heavy to move. Manufacturer guidance and a patent describe exactly this behaviour. Once flipped concave-up, a 0.4 L container fills in roughly 0.5 to 2 minutes.
5. **Robotics simulation projects do not offer a ready answer.** They use convex decomposition (CoACD or V-HACD, typically 32 hulls of up to 64 vertices) for dishes, and at least one project had to switch to SDF collision at resolution 256 specifically for "plate in dish rack" because "the rack needs to be simulated very precisely". A 2024 paper shows Drake and Isaac Sim both producing plate-through-wire penetrations in this exact scene. None of them simulates the wash: BEHAVIOR-1K models cleaning with heuristic transition rules.
6. **Recommendation:** rack = static compound of capsules; items = compound of rounded mid-surface quads generated from the profile (phase 1) with an optional custom capsule-vs-surface-of-revolution SDF narrow phase (phase 2); fixed 1 ms step, speculative margin 2 mm, CCD on thin items, full Coulomb friction, restitution 0.2 to 0.4 with a 0.1 m/s threshold, deterministic single-binary stepping; an event-driven rigid-body re-solve during the wash for the small set of "jet-mobile" items.

---

## 2. Geometry and mass model for items

### 2.1 Shape classes

| Class | Items | Parametric description |
|---|---|---|
| SoR-open (shell of revolution, open top) | plates, bowls, saucers, ramekins, tumblers, pint glasses, mixing bowls, PP cups, colander, sieve bowl | profile polyline from axis outward and upward |
| SoR + handle | mugs, cups, espresso cups, jugs, measuring jug, saucepans, frying pans, stockpot, ladle bowl, travel mug, sippy cup | SoR + swept handle (capsule chain or torus arc) |
| SoR + stem | wine glasses, flutes | bowl SoR + stem capsule + foot disc |
| SoR-closed/necked | water bottle, baby bottle, blender jug | SoR with neck |
| Box-shell | oven dishes, roasting tin, baking tray, food containers, lunch box, muffin tin (plate + 12 SoR cups) | rounded-rectangle tray: floor + 4 walls + corner fillets + rim flange |
| Slab | chopping boards | box with edge radius, optional handle hole |
| Rod / blade | cutlery, chef's knife, chopsticks, wooden spoon, turner, peeler | swept section along a centreline (capsule chain or thin convex hulls) |
| Wire | whisk, cooling rack, tongs (spring arms) | capsule chains |
| Lid | pan lids, container lids | shallow SoR or flat rounded rectangle + lip + knob |

### 2.2 Profile convention

```
profile: [ {r: mm, z: mm, t: mm}, ... ]      // mid-surface of the wall, from axis (r=0) outward
```

- `z = 0` is the plane the item rests on when upright.
- `t` is the local wall thickness; the solid occupies all points within `t/2` of the mid-surface polyline (after revolution). The rim is therefore automatically a semicircle of radius `t/2`.
- A foot ring is an extra short profile branch (annulus) or an `extra_mass` term.

### 2.3 Mass, centre of mass and inertia (thin-shell formulas)

For a profile segment from `(r1, z1)` to `(r2, z2)` with slant length `L = sqrt((r2-r1)^2 + (z2-z1)^2)`, mean thickness `t` and density `rho` (SI units):

- Area: `A = pi (r1 + r2) L`
- Mass: `m = rho t A`
- Axial centroid: `z_c = z1 + (z2 - z1) (r1 + 2 r2) / (3 (r1 + r2))`
- Inertia about the axis: `I_zz = integral of r^2 dm`; transverse about the COM: `I_xx = I_yy = integral of (r^2/2 + z^2) dm - m z_c^2`

In code, sub-divide each segment (200 sub-steps is ample) and sum. Add-ons (handle, stem, foot, knob) are added as point or capsule masses with the parallel-axis theorem. Valid while `t << r` (error is order `t/(2r)`; under 5% for everything in the catalogue except chopsticks and cutlery, which are modelled as solids).

### 2.4 Validation of the estimator against masses verified this session

Profiles and thicknesses were chosen from product dimensions; the only fitted quantity is wall thickness. Densities from Section 3.1. [ESTIMATED] for all "model" columns; targets are [VERIFIED] (sources in Section 10).

| Item | Target mass (g) | Model mass (g) | Ratio | Fitted wall t (mm) | Model COM height z_c (mm) |
|---|---|---|---|---|---|
| IKEA 365+ plate 27 cm, feldspar porcelain | 770 | 792 | 1.03 | 5.2 | 11 |
| Corelle Winter Frost dinner plate 260 mm | 340 | 359 | 1.05 | 2.6 | 6 |
| IKEA 365+ bowl 16 cm | 440 | 466 | 1.06 | 5.0 | 31 |
| Duralex Picardie 250 ml | 220 | 211 | 0.96 | 3.0 side / 7 base | 38 |
| Libbey 1639HT pint (16 oz) | 440 | 422 | 0.96 | 3.6 side / 13 base | 63 |
| Lodge L8SK3 10.25 in skillet | 2427 | 2600 | 1.07 | 4.0 (+330 g handle) | 15 |
| Vollrath 47934 4 qt bowl (26 ga) | 254 | 292 | 1.15 | 0.40 | 43 |
| Vollrath 69040 4 qt bowl | 476 | 532 | 1.12 | 0.70 | 51 |
| Pyrex 4 qt glass bowl | 1602 | 1680 | 1.05 | 5.5 | 54 |
| Nalgene 32 oz Tritan | 177 | 193 | 1.09 | 2.2 (+25 g cap) | 97 |
| All-Clad D3 10 in fry pan | 1190 | 1296 | 1.09 | 2.6 (+250 g handle) | 16 |
| All-Clad D3 2 qt saucepan | 907 | 1264 | 1.39 | 2.6 (too thick: use 1.8) | 41 |
| Pasta bowl 23 cm (Maxwell and Williams) | 660 | 623 | 0.94 | 4.5 | 29 |
| Ramekin 6 oz (BIA) | 181 | 184 | 1.02 | 4.5 | 16 |
| IKEA 365+ deep plate 22 cm | 590 | 646 | 1.09 | 5.0 | 25 |
| Wine glass 540 ml (Zwiesel Pure) | 184 | 161 | 0.88 | 1.1 bowl | 114 (47% of height) |
| OXO 5 qt steel colander | 420 | 543 | 1.29 | 0.6 (perforated) | 49 |
| Ceramic mug D80 x H100 (Yale sample) | 351 | 336 | 0.96 | 4.2 (+45 g handle) | 43 |
| IKEA LEGITIM PE board 340 x 240 x 8 | 560-570 | 620 | 1.10 | solid slab, rho 950 | 4 |
| IKEA PROPPMATT beech board 380 x 270 x 22 | 1590 | 1580 | 0.99 | solid slab, rho 700 | 11 |

Conclusion [ESTIMATED]: wall thickness inferred from mass is a reliable way to complete an item definition; the catalogue's un-verified masses (tag E) carry roughly +/-10% uncertainty for monolithic ceramic/glass and +/-25% for multi-material cookware.

### 2.5 Representative wall thicknesses

| Material / item family | Wall thickness (mm) | Tag and basis |
|---|---|---|
| Vitrelle laminated glass (Corelle) plates/bowls | 2.6 | E, fitted to 340 g verified mass |
| Hotel/retail porcelain plates and bowls | 4.0 to 5.5 | E, fitted (IKEA 365+ 5.0 to 5.2; pasta bowl 4.5) |
| Porcelain cups | 3 to 4.5 | E |
| Barista espresso cups | 5 to 6 | E, fitted to roughly 150 g for 80 ml |
| Stoneware oven dishes | 6 to 8 | E, fitted to 2.3 kg for a 32 cm Le Creuset dish |
| Pressed tumblers (Duralex) | side 3.0, base 7 | E, fitted |
| Pint/mixing glass | side 3.4 to 3.6, base 13 | E, fitted |
| Stemware bowl | 0.9 to 1.6 (rim about 1) | E, fitted to 184 g |
| Borosilicate/soda-lime ovenware (Pyrex) | 5 to 6.5 | E, fitted to 1.60 kg bowl |
| Stainless mixing bowls | 0.4 to 0.7 | E, fitted; nominal 26 ga and 18 ga per listings (V) but deep drawing thins the wall |
| Stainless pot walls / encapsulated base | 0.8 / 4 to 6 | R |
| Tri-ply clad (All-Clad D3) | 2.6 nominal | R; fitted side wall nearer 1.8 |
| Cast iron skillet | 4.0 | E, fitted to 2.43 kg |
| Aluminium sheet pan | 1.0 to 1.4 | E, fitted to 748 g |
| Non-stick aluminium fry pan | 3.0 to 3.6 | E, fitted to 900 g for 28 cm |
| PP food containers, cups | 1.2 to 2.0 | E |
| Tritan bottle | 2.2 | E, fitted to 177 g |
| Melamine tableware, minimum by standard | 2.0 (100 ml vessel or 50 cm2 plate) to 4.0 (550 ml vessel or 800 cm2 plate); 2.5 at 250 cm2, 3.0 at 600 cm2; maintained over at least 70% of the area | V, DRS 562:2023 Tables 1 and 2 (the draft cites IS 9220:1979) |
| Melamine edge radius, minimum | 0.8 | V, DRS 562:2023 clause 4.5 |

---

## 3. Material data

### 3.1 Densities

| Material | Density (kg/m3) | Tag | Source |
|---|---|---|---|
| Porcelain | 2300 to 2500 (use 2400) | V | Engineering Toolbox density table |
| Stoneware / earthenware | 2100 to 2400 (use 2300) | R | general ceramics knowledge |
| Soda-lime glass ("glass, common") | 2400 to 2800 (use 2500) | V | Engineering Toolbox |
| Borosilicate ("Glass, Pyrex") | 2210 | V | Engineering Toolbox |
| Lead crystal | 3100 | V | Engineering Toolbox |
| Lead-free crystal (Tritan crystal etc.) | about 2550 | E | chosen between soda-lime and crystal |
| Vitrelle laminated glass | about 2500 | E | treated as soda-lime-like |
| Carbon steel | 7820 | V | Engineering Toolbox |
| Stainless 18/10 (304) | 7900 to 8000 (use 7900) | R | |
| Cast iron | 7200 (7000 to 7400) | V | Engineering Toolbox |
| Aluminium | 2700 | V | Engineering Toolbox |
| Copper | 8790 | V | Engineering Toolbox |
| Polypropylene | 910 to 940 (use 905 to 920) | V | Engineering Toolbox |
| HDPE / LDPE | 960 / 910 | V | Engineering Toolbox |
| Nylon 6 / 6,6 | 1120 to 1170 | V | Engineering Toolbox |
| PA11 rack coating (Rilsan T Silver 7537) | 1010 | V | Arkema TDS, "Coating density 1.01 g/cm3" |
| PVC | 1390 to 1420 | V | Engineering Toolbox |
| Polycarbonate | 1200 | V | Engineering Toolbox |
| Tritan copolyester | 1180 | R | |
| Melamine-formaldehyde, cellulose filled | 1450 to 1550 (use 1500) | R | |
| Silicone rubber | 1100 to 1200 | R | |
| Beech | 700 to 720 | E | back-calculated: 380 x 270 x 22 mm board listed at 1.55 to 1.59 kg gives 690 to 705 |
| Oak | 720 | V | Engineering Toolbox |
| Bamboo laminate | 650 to 750 | R | |
| Cork | 200 to 250 | V | Engineering Toolbox |
| Water at 20 / 60 C | 998 / 983 | R | |

**Flotation flag.** Any item whose bulk material density is below water floats when free in pooled water: PP, PE, wood, cork, hollow closed items (travel-mug lids, double-wall mugs). Glass, ceramic, metal, melamine, Tritan, silicone and PVC sink. In a correctly working machine the sump level is below the lower rack, so flotation matters only (i) inside a filled concave item (a PP lid floating in a water-filled bowl) and (ii) for items that fall to the tub floor.

### 3.2 Measured dry static friction of real tableware (primary data)

Matheus and Dollar, "Benchmarking Grasping and Manipulation: Properties of the Objects of Daily Living", IROS 2010 (PDF opened and text extracted). Method: object resting on its usual base on a test surface, pushed by a solenoid probe 7.5 mm above the surface, load cell 22 N range, five trials; coefficient = peak push force / weight. All values [VERIFIED].

Table II (seven objects on six surfaces):

| Object | Mass (g) | Wood veneer | Granite | Laminate ("linoleum") | Glass | Unfinished wood | Stainless steel |
|---|---|---|---|---|---|---|---|
| Ceramic mug, small | 351.1 | 0.287 +/- 0.022 | 0.209 +/- 0.011 | 0.210 +/- 0.019 | 0.217 +/- 0.016 | 0.360 +/- 0.008 | 0.162 +/- 0.010 |
| Disposable plastic bottle | 26.1 | 0.245 +/- 0.042 | 0.324 +/- 0.031 | 0.197 +/- 0.027 | 0.255 +/- 0.028 | 0.326 +/- 0.032 | 0.304 +/- 0.030 |
| Wooden hair brush | 100.3 | 0.404 +/- 0.046 | 0.342 +/- 0.018 | 0.317 +/- 0.031 | 0.250 +/- 0.031 | 0.570 +/- 0.047 | 0.251 +/- 0.021 |
| Steel aerosol can | 360.2 | 0.327 +/- 0.012 | 0.255 +/- 0.025 | 0.244 +/- 0.008 | 0.158 +/- 0.014 | 0.374 +/- 0.014 | 0.170 +/- 0.008 |
| Metal stapler, rubber base | 423.1 | 0.747 | 0.692 | 0.662 | 0.672 | 0.749 | 0.551 |

Table III (kitchen objects; veneer / granite / laminate):

| Object | Mass (g) | Dimensions (cm) | Veneer | Granite | Laminate |
|---|---|---|---|---|---|
| Dinner plate, ceramic | 798 | 27 x 3 | 0.350 | 0.222 | 0.349 |
| Bowl, ceramic | 479.3 | 13 x 8 | 0.236 | 0.111 | 0.266 |
| Mug, ceramic | 351.1 | 8 x 10 | 0.287 | 0.209 | 0.210 |
| Bowl, glass | 545.1 | 18 x 8 | 0.223 | 0.124 | 0.163 |
| Cup/glass, glass | 402.3 | 9 x 15 | 0.250 | 0.126 | 0.147 |
| Wine glass | 268.3 | 8 x 20 | 0.306 | 0.205 | 0.209 |
| Jar, glass | 289 | 7 x 16 | 0.173 | 0.113 | 0.184 |
| Measuring cup, glass | 824 | 15 x 11 | 0.140 | 0.103 | 0.119 |
| Eating utensil, stainless steel | 47.6 | 18 x 4 x 1 | 0.206 | 0.124 | 0.134 |
| Cooking pot with handle, steel | 503.6 | 17 x 10 | 0.238 | 0.124 | 0.173 |
| Skillet, metal | 987.5 | 27 x 5 | 0.187 | 0.112 | 0.179 |
| Baking pan, non-stick metal | 351.9 | 21 x 11 x 8 | 0.105 | 0.139 | 0.069 |
| Plastic container | 44.8 | 14 x 14 x 6 | 0.289 | 0.328 | 0.305 |
| Pitcher, plastic | 292.7 | 18 x 11 x 24 | 0.210 | 0.161 | 0.217 |
| Spatula, plastic | 89.7 | 33 x 5 x 2 | 0.297 | 0.310 | 0.290 |
| Water bottle, reusable plastic | 179.4 | 9 x 20 | 0.212 | 0.099 | 0.269 |

Paper-level statistics [VERIFIED]: mean 0.300 and median 0.255 over 65 objects x 3 surfaces; values "heavily cluttered between 0.15 and 0.35"; "the objects with the smallest coefficients tended to be glass or other smooth materials"; friction "changes little as mass is added" (full vs empty containers).

Why this matters: these are the only measurements I found of actual tableware bases (glazed or ground foot rings, pressed-glass bases, stamped steel) rather than polished laboratory coupons. They are 2 to 5 times lower than handbook "clean and dry" values.

### 3.3 Handbook friction values (for bounds)

Engineering Toolbox friction table (page opened). All [VERIFIED].

| Pair | Static, clean and dry | Kinetic, clean and dry | Static, lubricated/greasy | Kinetic, lubricated |
|---|---|---|---|---|
| Glass - glass | 0.9 to 1.0 | 0.4 | 0.1 to 0.6 | 0.09 to 0.12 |
| Glass - metal | 0.5 to 0.7 | - | 0.2 to 0.3 | - |
| Steel - steel | 0.5 to 0.8 | 0.42 | 0.16 | - |
| Aluminium - aluminium | 1.05 to 1.35 | 0.4 | 0.3 | - |
| Aluminium - mild steel | 0.61 | 0.47 | - | - |
| Cast iron - cast iron | 1.1 | 0.15 | 0.07 | - |
| Nylon - nylon | 0.15 to 0.25 | - | - | - |
| Nylon - steel | 0.4 | - | - | - |
| Polyethylene - steel | 0.2 | - | 0.2 | - |
| Polyethylene - polyethylene | 0.2 | - | - | - |
| Polystyrene - polystyrene | 0.5 | - | 0.5 | - |
| PTFE - steel | 0.05 to 0.2 | - | - | - |
| Wood - wood (clean / wet) | 0.25 to 0.5 / 0.2 | - | - | - |
| Wood - metal (clean / wet) | 0.2 to 0.6 / 0.2 | - | - | - |

PA11 (the rack-coating polymer) against steel: 0.25 to 0.35 (Weerg), 0.2 to 0.3 (Goodfellow rod), 0.35 (designerdata.nl), all without stated test conditions [VERIFIED] (se). Arkema's own datasheets say only "low coefficient of friction" with no number [VERIFIED] (se).

### 3.4 Rack-wire coating

| Property | Value | Tag | Source |
|---|---|---|---|
| Dishwasher-basket grade | Rilsan PA11 T Silver 7556 (applications: "Powder Coating - Dish Washer Basket; Wire Goods"; fluidized-bed dipping; heat stabilised). The property values below were read in the opened TDS of the sister fluidized-bed grade T Silver 7537 and match those quoted for 7556 in the search extract | V | Arkema TDS (7556 via se; 7537 PDF opened) |
| Hardness | Shore D 70 (ISO 868); Persoz 180 (ISO 1522) | V | Arkema TDS 7537 |
| Coating impact | at least 2 J (ASTM G14) | V | same |
| Abrasion (CS17 wheel, 1 kg, 1000 cycles) | 30 mg | V | same |
| Vicat softening / melting | 181 C / 183 to 188 C | V | same |
| Water absorption, 24 h at 23 C | at most 1% | V | same |
| Reference thickness for covering efficiency | 300 um (0.36 kg/m2) | V | same |
| Typical fluidized-bed PA11 film | 250 to 500 um; at least 250 um recommended for FB grade 1482 | V | Chempoint Rilsan page; Arkema 1482 TDS (se) |
| PA11 elastic modulus | about 1.2 GPa dry at 23 C, lower when hot and wet | R | |
| Alternative coating: PVC plastisol | 0.5 to 1.5 mm, Shore A 80 to 95, softer and grippier (mu about 0.4 to 0.6), softens further at 60 to 70 C | R | general knowledge of vinyl-coated racks; patents confirm "vinyl or nylon" jackets are the two standard options (V, se) |
| Rack construction | round steel wire bent, welded at each crossing, then PVC or nylon coated; tines are the same wire | V | patent extracts (se) |
| Wire diameters | frame 4.5 to 5.5 mm, grid and tines 3.0 to 4.0 mm bare, plus 2 x 0.3 mm coating | R | owner-level knowledge; machine sibling to confirm |
| Plate-tine pitch | lower rack 20 to 40 mm (often alternating), tine height 50 to 70 mm, rake 0 to 15 degrees | R | machine sibling to confirm |

Contact stiffness note [ESTIMATED]: a 0.3 mm PA11 layer on a 4 mm steel wire under a 5 N plate load indents by micrometres. The coating is mechanically "rigid" for stacking purposes. Its roles are friction, impact damping (it is why real restitution is low) and rolling resistance.

### 3.5 Restitution

| Pair | Measured coefficient of restitution | Conditions | Tag | Source |
|---|---|---|---|---|
| Glass ball on smooth granite | 0.93 to 0.97 (2 to 4 mm balls); velocity-independent within 0 to 2% | 1.74 to 2.43 m/s | V | Sandeep, Luo, Senetakis 2020, Materials 13(4):814, Table 2 |
| Glass ball on smooth brass | 0.75 to 0.80; falls about 2 to 5% from 1.74 to 2.43 m/s | same | V | same |
| Glass ball on rubber | 0.37 to 0.46 | same | V | same |
| Surface roughness effect | -6% (brass), -8% (granite) at 1.74 m/s for Sq = 387 nm | | V | same |
| Glass on glass, smooth | about 0.9 | reference table | V (se) | Stanford Advanced Materials page |
| Steel ball on steel | 0.6 to 0.7; about 0.65 at 1 m/s | reference table | V (se) | same |
| Glass spheres on hard ceramic plate (above 1800 HV) | velocity- and angle-independent ("fully elastic") | | V (se) | Estonian Acad. Sci. Eng. 1998 |

These are **material-level** values for compact spheres on massive targets. A plate, glass or pan dropped onto a coated wire rack loses far more energy: (i) the visco-elastic polymer coating, (ii) flexural vibration of the thin item (the "ring" of a plate or glass is radiated energy), (iii) flexing of the rack wire, (iv) simultaneous multi-point contact. Recommended body-level values [ESTIMATED], to be calibrated by drop tests with high-speed video:

| Pair | Effective restitution e | Plausible range |
|---|---|---|
| Ceramic on coated wire | 0.25 | 0.10 to 0.45 |
| Glass on coated wire | 0.30 | 0.15 to 0.50 |
| Steel item on coated wire | 0.30 | 0.15 to 0.50 |
| PP / melamine on coated wire | 0.35 | 0.20 to 0.50 |
| Ceramic on ceramic | 0.50 | 0.30 to 0.80 |
| Glass on glass | 0.60 | 0.40 to 0.90 |
| Steel on steel (cutlery) | 0.45 | 0.30 to 0.70 |
| Wood, silicone on anything | 0.40 | 0.20 to 0.60 |

Use a restitution velocity threshold of 0.1 m/s (below it, e = 0). Jolt's default threshold is 1.0 m/s [VERIFIED], which would switch restitution off for almost every contact in this game; that is acceptable for settling but should be an explicit choice.

### 3.6 Rolling and spinning resistance

- Glasses, bottles and cans laid on their side roll; plates stood on edge roll like wheels along a wire. Without rolling resistance a rigid-body engine lets them roll indefinitely on a level surface and creep on a 0.5 degree slope.
- Model: resisting moment `M_roll = c_rr * N` (rolling, about a tangent axis) and `M_spin = c_sp * N` (torsional, about the normal), with `c` in metres. This is MuJoCo's `condim=6` parameterisation, whose defaults are sliding 1, torsional 0.005 m, rolling 0.0001 m [VERIFIED] (se, MuJoCo `user_init.c` mirror); MuJoCo's docs interpret torsional as the contact-patch diameter and rolling as the depth of the local deformation [VERIFIED].
- Recommended [ESTIMATED]: `c_rr` = 2e-4 m on coated wire (range 1e-4 to 5e-4), 5e-5 m hard-on-hard; `c_sp` = 1.5e-3 m (range 0.5e-3 to 3e-3). Basis: dimensionless rolling coefficient `c_rr / R` of 0.003 to 0.01 for a hard cylinder on a thin Shore D 70 polymer layer, with R = 35 mm.
- If the chosen engine has no rolling friction (Rapier and Jolt do not expose it; [RECALLED]), emulate it with a small angular damping applied only while a body has contacts, or with a per-contact custom torque `-c_rr * N * omega_t / |omega_t|` capped so it cannot reverse the motion within a step.

---

## 4. Jet-induced displacement, flipping, flotation and filling

### 4.1 What the sources say

| Statement | Tag | Source |
|---|---|---|
| "Small lightweight items in the rack are sometimes dislodged from the rack, due to the force of the water sprays. In some cases these small items can become airborne and subsequently fall through openings in the rack." | V (se) | US 5,102,225 "Utensil bag for dishwashers" |
| "Plastic items and light dishes flip over or move around during the cycle" (troubleshooting entry; advice: use a lower-pressure cycle for light loads) | V (se) | techfaultfix.com Insignia page |
| "Place plastic dishes on the top rack, face down, to reduce heat exposure and to prevent the force of the water from flipping containers right-side-up during the cycle." | V (se) | Molly Maid loading guide |
| "Secure lightweight load items in the racks." | V (se) | Whirlpool owner's manual (third-party mirror) |
| "Ensure plastic items fit securely in your top dishwasher rack and are not small enough to fit through gaps. Plastic items that fall through can block one of the washer arms or land on your dishwasher's heating element." | V (se) | Whirlpool blog |
| "Don't put plastic items on the lower rack"; plastics deform less on the top rack; third-level rack is best for plastic cups, bowls, mugs | V (se) | Whirlpool product help |
| "To prevent water accumulation on your dishes, place bowls, glasses and pans upside down." | V (se) | Beko UK |
| Commercial warewashing vendors sell special solutions for reusable plastic crockery (titles only seen: Winterhalter "difficulty of cleaning plastic bowls", Miele Professional "special solutions for washing and drying reusable crockery") | V (se, titles only) | winterhalter.com, miele.de press |

### 4.2 Jet numbers used for the estimates

Perez-Mohedano, "Cleaning principles in automatic dishwashers", EngD thesis, University of Birmingham, 2016 (PDF opened; Whirlpool DU750 machine). All [VERIFIED]:

| Quantity | Value | Where in thesis |
|---|---|---|
| Mean jet ejection velocity, PEPT / CFD | 7.69 (std 3.16) / 7.24 (std 2.30) m/s | Table 4.1 |
| Mean velocity inside the spray arm | 1.60 m/s (PEPT); 1.67 / 1.17 / 0.71 m/s at high / medium / low pump speed | Tables 4.1, 4.2 |
| Mean downfall velocity | 5.05 (PEPT) / 3.31 (CFD) m/s | Table 4.1 |
| Most common nozzle diameter, lower arm | 2 mm | Chapter 3, Stokes-number calculation (text above Table 3.2) |
| Lower-arm nozzle count and radii | 10 nozzles at R = 89, 114, 145, 162, 182, 194, 223, 226, 238, 238 mm | Table 5.7 |
| Spray-arm rotation | about 35 rpm in the image-analysis cleaning tests; 30 rpm (one rotation = 2 s) used as typical in the design analysis | Chapters 3 and 5 |
| Water charge per fill in tests | 5 litres | Chapter 3, PEPT set-up (text below Table 3.1) |
| Jet paths | straight lines (coherent jets) | abstract of the companion CEJ 2015 paper |

One further number [VERIFIED] (se): a University of Louisville thesis reports a baseline circulation flow of about 8.5 US gal/min (32 L/min).

### 4.3 Force model (explicit)

For one coherent jet of cross-section `A_j = pi d^2 / 4`, speed `v`, water density `rho`:

- Volume flow `Q = A_j v`
- Momentum flux `J = rho Q v = rho A_j v^2` [N]
- Force on a surface that turns the jet through angle `theta_turn`: `F = J (1 - cos(theta_turn))` along the incoming jet axis.
  - Flat surface, normal incidence, water leaves radially: `theta_turn = 90 deg`, `F = J`.
  - Concave interior that returns the jet (inverted cup, tub, bowl): `theta_turn` up to 180 deg, `F` up to `2 J`.
  - Oblique incidence at angle `alpha` between jet and surface normal on a flat wall: normal force `F_n = J cos(alpha)`, tangential traction is small (thin-film shear only).
- Jet speed at height `h` above the nozzle: `v(h) = sqrt(v0^2 - 2 g h)` (7.69 m/s falls only to 7.3 m/s over 0.3 m).

Numbers [ESTIMATED] from the verified inputs (rho = 1000 kg/m3):

| Nozzle d (mm) | v (m/s) | Q (L/min) | J (N) | Equivalent mass J/g (g) |
|---|---|---|---|---|
| 2 | 4.5 (mean - 1 sigma) | 0.85 | 0.064 | 6.5 |
| 2 | 7.69 (mean) | 1.45 | 0.186 | 19 |
| 2 | 12.0 (about mean + 1.4 sigma, high pump speed) | 2.26 | 0.452 | 46 |
| 3 | 7.69 | 3.26 | 0.418 | 43 |
| 4 | 7.69 | 5.80 | 0.743 | 76 |

Sanity check: 10 nozzles x 1.45 L/min = 14.5 L/min for the lower arm, consistent with a machine circulating about 32 L/min through two or three arms.

### 4.4 Mobility criteria

Let `W = m g`, `F` the instantaneous total jet force on the item, `n` its direction.

1. **Lift-off** (item leaves its supports): `F_z > W + F_hold`, where `F_hold` is any wedging/clip force (zero for a loose item).
2. **Tipping** about a support edge: `F * a_F > W * a_g`, where `a_F` is the lever arm of the jet force about the edge and `a_g` the horizontal distance from the centre of mass to the edge. For an inverted cup of rim radius `R` hit at eccentricity `e` from its axis on the far side from the pivot: `F > W R / (R + e)`. In the limit `e -> R` the threshold is `F > W / 2`.
3. **Sliding**: `F_t > mu_s (W - F_z)`. Upward jets unload the contact, so sliding starts well before lift-off.
4. **Hop height** when `F_z > W` for a dwell time `t_d`: `v_up = (F_z / m - g) t_d`, `h = v_up^2 / (2 g) + (F_z / m - g) t_d^2 / 2`.
5. **Dwell time** of a nozzle at radius `R_nz` under an item of chord width `w`: `t_d = w / (omega R_nz)`. With `omega = pi rad/s` (30 rpm), `R_nz = 0.145 m`, `w = 0.085 m`: `t_d = 0.19 s`, repeating every 2 s.

Define the **jet mobility number**

`Pi_J = J (1 - cos(theta_turn)) / (m g)`

| Item (mass) | Weight W (N) | Pi_J, one 2 mm jet at 7.69 m/s, flat hit | Pi_J, concave capture (x2) or 3 mm nozzle | Expected behaviour |
|---|---|---|---|---|
| Chopstick, wood (6 g) | 0.06 | 3.2 | 6 to 7 | Ejected unless captured in a basket cell |
| Silicone teat (9 g) | 0.09 | 2.1 | 4 | Thrown around; needs a cage |
| PP container lid (20 g) | 0.20 | 0.95 | 1.9 to 2.1 | Lifts, flips, relocates; classic "lid on the heating element" |
| Teaspoon lying flat in a tray (25 g) | 0.25 | 0.76 | 1.5 | Shifts and nests against neighbours |
| PP cup 400 ml (41 g) | 0.40 | 0.46 | 0.93 to 1.0 | Tips for off-centre hits (threshold 0.5), hops when the jet is captured |
| Light PP tub (45 to 50 g) | 0.44 to 0.49 | 0.38 to 0.42 | 0.8 to 0.95 | Same; the usual item found right-side-up and full |
| Baby bottle PP (44 g) | 0.43 | 0.43 | 0.9 | Tips; narrow neck captures the jet poorly, so less lift |
| Sippy cup (62 g) | 0.61 | 0.31 | 0.6 to 0.7 | Tips occasionally |
| Wooden spoon (45 g) | 0.44 | 0.42 | - | Slides; floats if it reaches pooled water |
| Champagne flute (93 to 160 g) | 0.9 to 1.6 | 0.12 to 0.20 | 0.25 to 0.45 | Stable if supported at the bowl; can rock, chip against neighbours |
| Sistema 1 L base (about 95 g) | 0.93 | 0.20 | 0.4 to 0.45 | Marginal; slides on slick tines |
| Melamine bowl (136 g) | 1.33 | 0.14 | 0.28 to 0.31 | Normally stable |
| Tumbler (220 g) | 2.2 | 0.09 | 0.17 to 0.19 | Stable |
| Mug (340 g) | 3.3 | 0.06 | 0.11 to 0.13 | Stable |
| Dinner plate (340 to 800 g) | 3.3 to 7.8 | 0.02 to 0.06 | - | Stable |
| Cast-iron skillet (2.4 kg) | 23.8 | 0.008 | - | Immovable |

All `Pi_J` values [ESTIMATED]. The ordering reproduces household experience and the manufacturer statements in 4.1, which is the main evidence that the first-principles estimate is in the right range.

Worked hop example [ESTIMATED]: 20 g lid, flat hit, `F = 0.186 N` gives `F/m - g = -0.5 m/s2`, no lift; with a 3 mm nozzle (`F = 0.418 N`) `F/m - g = 11.1 m/s2`, `t_d = 0.19 s`, `v_up = 2.1 m/s`, ballistic rise 0.23 m plus 0.20 m during the push. The lid hits the rack above. With a 2 mm nozzle at 12 m/s the result is similar. Lids are therefore mobile for any above-average jet; this is not a marginal effect.

### 4.5 Filling of flipped or concave-up items

- Mean downward water flux over the tub plan area: `q'' = Q_pump / A_tub`. With 32 L/min and a 0.5 m x 0.5 m tub, `q'' = 2.1 mm/s` (equivalent to 7.7 m/h of "rain") [ESTIMATED from V inputs].
- Fill time of a concave-up item with opening area `A_o`, volume `V`, capture efficiency `eta` (fraction of the mean flux that actually arrives, lower under other items): `t_fill = V / (eta q'' A_o)`.
  - 400 ml cup, `A_o = 57 cm2`: 33 s at `eta = 1`, 1 to 3 min at `eta = 0.2 to 0.5`.
  - 1 L tub, `A_o = 200 cm2`: 24 s at `eta = 1`.
- Consequences to model: (i) weight increases, so the item stops moving; (ii) the item shadows whatever is below it; (iii) it retains its full volume of dirty wash liquor through the drain, diluting each rinse (carry-over; chemistry and films siblings); (iv) its interior is washed only by plunging jets into a pool (soils sibling); (v) it comes out "wet/dirty" in the report.
- Even correctly inverted items retain water in base recesses [ESTIMATED]: mug foot recess 55 mm diameter x 3 mm deep = 7 ml; bowl foot ring 80 mm x 4 mm = 20 ml; pint-glass punt 2 to 5 ml. This is why manufacturers recommend tilted placement and is a drying-score effect (films sibling).

### 4.6 What to simulate

1. At load time compute for each item `W`, its support polygon, and a conservative screening value `Pi_J,max = c_turn J_max / W`, where `J_max` is the largest single-nozzle momentum flux of the selected machine at its highest pump speed and `c_turn` is the worst-case turning factor (2 for any item with a concave face that a jet can enter, else 1).
2. Screening threshold: 0.25, i.e. half of the best-lever tipping threshold of 0.5 derived in 4.4 (safety factor 2) [ESTIMATED]. Items with `Pi_J,max < 0.25` are **frozen** for the wash (static geometry). For a machine like the thesis one (`J_max` about 0.45 N) this freezes everything heavier than about 370 g if concave-exposed and about 185 g otherwise: plates, bowls, cookware, boards, most mugs.
3. Items with `Pi_J,max >= 0.25` are **jet-mobile candidates**: all plastics, lids, glasses, cups, stemware, loose cutlery lying flat, chopsticks, teats. The screen is deliberately generous (a 220 g tumbler is a candidate although it will almost never move) because the cost is negligible: candidates stay as sleeping dynamic bodies and receive the actual per-pass jet force and torque from the jet model. Wake on force; integrate at 1 ms for the dwell plus settle time; if the pose changes by more than a tolerance (say 2 mm or 2 degrees), invalidate the cached spray statistics for the item and its shadow neighbours.
4. Add buoyancy and added weight of contained water (from the films model) to the rigid body.
5. Record flip/displacement events in the wash report ("lid L3 left the upper rack at 02:14 and blocked the lower arm").

---

## 5. Collision modelling for thin, concave objects and wire racks

### 5.1 The length scales that drive everything

| Feature | Size | Tag |
|---|---|---|
| Stemware rim | about 1 mm | E (Section 2.4) |
| Corelle plate | 2.6 mm | E |
| Porcelain plate | 4 to 5.5 mm | E |
| Coated rack wire, outer diameter | about 3.6 to 6 mm | R |
| Plate-tine pitch | 20 to 40 mm | R |
| Free-fall speed after a 10 / 20 / 30 / 50 / 100 mm drop | 0.44 / 0.63 / 0.77 / 0.99 / 1.40 m/s | E, `v = sqrt(2 g h)` |
| Travel per step at 1 m/s for dt = 1/60, 1/240, 1/1000 s | 16.7 / 4.2 / 1.0 mm | E |

A plate arriving at 1 m/s moves about four wire diameters per step at 60 Hz. Game-engine defaults (60 Hz, centimetre tolerances) are wrong by more than an order of magnitude for this problem.

### 5.2 Engine facts that matter (all from documentation or source opened this session unless tagged otherwise)

| Engine | Relevant facts | Tag |
|---|---|---|
| **Rapier** (Rust) | Defaults: `dt` 1/60 s; `num_solver_iterations` 4 ("8 to 12 for demanding scenes"); `normalized_allowed_linear_error` 0.005 and `normalized_prediction_distance` 0.02, both scaled by `length_unit` (default 1.0); `max_ccd_substeps` 1; 3D `friction_model` default `Simplified` (one Coulomb constraint per four contacts plus a twist constraint) with `Coulomb` (one per contact) available; `contact_clustering` on. Collider friction example default 0.5; combine rule default Average (options Average, Min, Multiply, Max, ClampedSum, GeometricMean); contact skin default 0. Shapes: ball, cuboid, capsule, round cuboid/cylinder/cone/convex polyhedron (`border_radius`), convex hull, trimesh, heightfield, voxels, compound; `convex_decomposition` uses VHACD. Trimesh is discouraged on dynamic bodies ("objects can get stuck inside"); compound of convex parts recommended. CCD is motion clamping, per body (`ccd_enabled`); `soft_ccd_prediction` is a cheaper alternative "for thin or moderately fast objects"; two CCD bodies can still tunnel through each other. Determinism: locally deterministic by default; cross-platform bit-level determinism with the `enhanced-determinism` feature on IEEE 754-2008 platforms including WASM; incompatible with `simd8`; `parallel` is compatible and independent of thread count. | V (page) |
| **Jolt** (C++) | Defaults (`PhysicsSettings.h`): `cDefaultConvexRadius` 0.05 m; `mPenetrationSlop` 0.02 m; `mSpeculativeContactDistance` 0.02 m; `mBaumgarte` 0.2; `mNumVelocitySteps` 10; `mNumPositionSteps` 2; `mMinVelocityForRestitution` 1.0 m/s; `mTimeBeforeSleep` 0.5 s; `mPointVelocitySleepThreshold` 0.03 m/s; `mLinearCastThreshold` 0.75 and `mLinearCastMaxPenetration` 0.25 (fractions of inner radius); `cDefaultCollisionTolerance` 1e-4 m; `mManifoldTolerance` 1e-3 m. Docs: dynamic objects "should be roughly 0.1 to 10 m"; a dynamic MeshShape must not collide with another mesh or heightfield (assert, collision ignored); meshes have no inside; compound shapes static (tree) or mutable (list); friction combine default geometric mean, restitution default max; CCD = LinearCast with "time stealing", long fast-rotating objects can still tunnel; stable at 60 Hz with one collision step; deterministic for the same binary and call order; `CROSS_PLATFORM_DETERMINISTIC` build option costs about 8% and has been verified across 14 compiler/OS/architecture combinations. | V (page, header) |
| **MuJoCo** (C) | Soft convex contact model. Defaults: `solref` "0.02 1" (time constant, damping ratio), time constant must be at least 2 x timestep; `solimp` "0.9 0.95 0.001 0.5 2". Geom friction default "1 0.005 0.0001" (sliding, torsional [m], rolling [m]). Mixing between geoms: higher `priority` wins, else element-wise max friction, max condim, weighted `solmix`. `condim` 1/3/4/6 = frictionless/sliding/+torsional/+rolling. Cones: pyramidal default, elliptic recommended; to suppress slip "use elliptic cones, large impratio, and the Newton algorithm with very small tolerance" (about 1e-10), then `noslip_iterations` if needed. Recommended integrator `implicitfast`. Collision is convex-only: non-convex meshes are replaced by their convex hull; decompose with a tool such as CoACD; SDF plugins are the exception; native capsules. Sleeping islands exist but are off by default. Negative `solref` gives direct stiffness/damping (use for system identification; zero damping gives elastic bounce). | V (page; friction default via se) |
| **Bullet** | `CONVEX_DISTANCE_MARGIN` 0.04; header comment: "when creating small objects, you need to make sure to set a smaller collision margin". | V (se) |
| **PhysX 5 / Isaac Sim** | Dynamic triangle meshes require a cooked SDF; SDF collision "is only available in the GPU collision detection pipeline"; "thin, shell-like structures with a thickness below about twice the grid spacing may not be represented accurately"; "a resolution of around 250 produces good results"; the dynamic-SDF example sets solver iterations (50, 1), contact offset 0.1, rest offset 0.02 at its scene scale. PhysX GPU features require NVIDIA CUDA and are unavailable on Apple Silicon. | V (page) for the first four; R for CUDA |
| **Drake hydroelastic** | Pressure-field contact patches; compliant (tetrahedral) vs rigid (surface mesh) geometry; rigid-rigid pairs fall back to point contact; non-convex compliant geometry needs a tetrahedral VTK mesh; hydroelastic modulus of 1e8 Pa or more "rarely used"; Hunt-Crossley dissipation typically 10 to 50 s/m; example time step 1 ms; suggested margin about 1e-4 m. | V (page) |
| **Box2D v3 "soft step"** (2D, but the clearest public solver comparison) | Eight Gauss-Seidel variants compared at 60 Hz with 4 primary (sub-step) and 2 secondary iterations; "Soft Step" = sub-stepping + soft constraints + warm starting + relaxation, chosen for Box2D v3; keep the soft-contact frequency well below the step rate; "strong friction" is what makes stacks stable. | V (page) |

Consequences for Spotless:

1. **Tolerances must be re-scaled.** Jolt's convex radius (50 mm), slop (20 mm) and speculative distance (20 mm) are larger than a mug handle. Either set every tolerance explicitly (convex radius = wall half-thickness, slop 0.1 to 0.2 mm, speculative distance 2 mm, restitution threshold 0.1 m/s, sleep threshold 3 mm/s) or simulate in scaled units (1 unit = 1 dm) so that defaults become 5 mm / 2 mm / 2 mm, still with explicit convex radii. Rapier makes this nearly a single knob: with metres as the unit set `length_unit = 0.1` (typical object size 0.1 m), which scales the allowed error to 0.5 mm and the prediction distance to 2 mm; then lower `normalized_allowed_linear_error` from 0.005 to 0.002 for a 0.2 mm slop [ESTIMATED configuration, to be confirmed by test].
2. **MuJoCo defaults are too soft.** With the default reference dynamics (time constant 0.02 s, critically damped) the peak penetration for an approach speed `v` is about `v * tau / e` = 0.5 x 0.02 / 2.72 = 3.7 mm at 0.5 m/s [ESTIMATED], more than a Corelle plate. Use `timestep` 0.5 to 1 ms and `solref` time constant 2 ms (peak penetration about 0.4 mm), `solimp` width 0.2 mm.
3. **PhysX SDF collision, the method robotics groups reach for when dish racks misbehave, is not available on the target Mac.** An equivalent has to be built (Section 5.4) or avoided (Section 5.3).
4. **No engine can use a raw triangle mesh for a dynamic thin shell against another mesh.** Convex pieces, primitives or SDFs are the only options.

### 5.3 Recommended phase-1 representation (engine-native)

**Rack and fixed interior: capsule chains.**

- Each wire is a centreline polyline plus a radius (bare wire radius + coating thickness). Each straight run is one capsule; each bend is 3 to 5 short capsules (bend radius about 8 to 10 mm [RECALLED]). Welded crossings are just overlapping capsules.
- One static compound per rack with a BVH. A full-size lower rack is of order 150 to 300 capsules, the upper rack similar [ESTIMATED]. Capsule-vs-convex is the cheapest and most robust narrow-phase pair there is (no edge-edge degeneracy, always a unique closest point).
- Plastic parts (cutlery basket, cup shelves, third-rack tray, tine caps, rollers) are boxes and convex hulls.
- Tub walls, door, sump: boxes/planes. Spray arms: kinematic convex hulls or capsules so that "item blocks the arm" is a detectable contact (see 8.4).

**Shells of revolution: rounded mid-surface quads generated from the profile.**

- For profile ring `k` and angular sector `j` of `N`: `P(k, j) = (r_k cos(phi_j), r_k sin(phi_j), z_k)`, `phi_j = 2 pi j / N`. The quad `{P(k,j), P(k,j+1), P(k+1,j+1), P(k+1,j)}` is planar (an isosceles trapezoid) and convex. Give it a rounding radius of `t_k / 2` (Rapier `round_convex_hull` / `border_radius`; Jolt convex radius; Bullet margin; in MuJoCo use an 8-vertex extruded hull). The union reproduces the wall with its true thickness and a semicircular rim, with 4 vertices per piece.
- Chord (sagitta) error of the polygonal approximation: `eps = R (1 - cos(pi / N))`.

| Radius R (mm) | N = 16 | N = 24 | N = 32 | N = 48 |
|---|---|---|---|---|
| 135 (dinner plate) | 2.59 mm | 1.16 | 0.65 | 0.29 |
| 75 (bowl) | - | 0.64 | 0.36 | - |
| 40 (cup, glass) | 0.77 | 0.34 | - | - |

  Choose `N = ceil(pi / acos(1 - eps / R))` with `eps` = 0.5 mm: N = 37 for a dinner plate, 28 for a bowl, 20 for a cup [ESTIMATED]. With 3 to 5 profile segments this is 60 to 190 pieces per item and about 5,000 to 10,000 pieces for a 60-item load, inside a compound BVH. This is comfortably real-time on one M3 performance core at 1 kHz [ESTIMATED; numerics sibling to confirm].
- Why not CoACD/V-HACD for these items: mesh-based decomposition of a thin bowl either fills the cavity (so cups cannot nest and jets cannot enter the collision proxy) or produces dozens of irregular, overlapping hulls whose seams create ghost contacts. The profile-based sectors are exact, regular, deterministic, and share one source of truth with the render mesh and the fluid SDF. Reserve CoACD (concavity threshold default 0.05, range 0.01 to 1; real-metric mode lets the threshold be given in metres [VERIFIED] (se)) for imported, irregular meshes.

**Add-ons.**

| Part | Proxy |
|---|---|
| Mug/cup/jug handle | 4 to 8 capsules along the handle centreline (a C-shaped chain), so a tine can pass through the handle loop |
| Pan handle | 1 to 3 capsules or a convex hull; include the hanging loop hole only if hooks exist in the rack |
| Stem and foot | capsule + rounded disc sectors |
| Cutlery | 2 to 4 thin convex hulls (handle, neck, bowl/tines/blade); fork tines as one hull; spoon bowl as 6 to 8 rounded triangles so spoons nest ("spooning" shadows soil, a real cleaning failure) |
| Chopsticks, wooden-spoon handle, whisk wires, cooling rack, tongs arms | capsules |
| Chopping board, flat lids, baking tray floor | boxes with rounding radius |
| Box-shell (oven dish, container, roasting tin) | floor box + 4 wall boxes + corner fillet sectors (rounded), rim flange boxes |
| Muffin tin | plate with 12 SoR cup shells (sectors) |
| Colander / sieve | bowl shell for contact; a `porosity` attribute tells the fluid model water passes through |
| Grater | 4 thin boxes + handle capsule |

### 5.4 Phase-2 representation (custom narrow phase on analytic SDFs)

Signed distance of a shell of revolution (exact for the rounded-polyline solid):

```
q      = ( sqrt(p.x^2 + p.y^2), p.z )                // item frame
(i, c) = closest segment i and closest point c on the profile polyline to q   // 2D point-segment distances, O(K)
sdf(p) = |q - c| - t(c) / 2
n2     = (q - c) / |q - c|                             // 2D outward normal (r, z)
n(p)   = ( n2.r * p.x / q.r, n2.r * p.y / q.r, n2.z )  // 3D gradient; on the axis use (0, 0, sign(n2.z))
```

Capsule (wire segment `a -> b`, radius `r_w`) against the shell:

1. `f(s) = sdf(a + s (b - a))`, `s` in [0, 1]. Sample at spacing 2 mm, find every local minimum with `f < r_w + margin`, refine each with 3 to 4 secant steps.
2. Emit one contact per minimum: point `x - n f`, normal `n`, depth `r_w - f`. A wire lying across a plate's concave face gives two contacts (on the two rim crossings), which is physically right and is exactly the case convex-decomposition seams get wrong.

Shell against shell (plate leaning on plate, cup inside bowl): test surface sample points of A (with normals, about 5 mm spacing, culled by AABB overlap) against `sdf_B` and vice versa; reduce to at most 8 contacts per pair (deepest plus extremal points). This is the same idea as PhysX SDF contact with contact reduction used for tight-tolerance assembly simulation [RECALLED: Narang et al., "Factory", RSS 2022].

Benefits: sub-0.1 mm geometric accuracy with no faceting, smooth rolling, exact rim contacts, and the same `sdf` function is what the jet and film models query on the GPU. Cost: a custom contact generator plugged into the engine's manifold/solver interface (Rapier, Jolt and MuJoCo all allow user contact generation; effort is moderate).

Recommendation: ship phase 1; build phase 2 for item-versus-wire first (highest value: leaning plates and glasses on tines), keep rounded quads for item-versus-item until validation shows a need.

### 5.5 Time step, margins, CCD

| Parameter | Recommended | Reasoning | Tag |
|---|---|---|---|
| Fixed time step | 1.0 ms (0.5 ms if stemware is present and fast) | per-step travel 1 mm at 1 m/s, below half the thinnest wall + wire | E |
| Release speed cap | UI lowers the item kinematically until the first contact is within 10 mm, then releases; impact speed at most 0.45 m/s | bounds energy to dissipate; realistic for a careful human | E |
| Speculative/prediction distance | 2 mm (at least `v_max * dt` = 1.4 mm for a 100 mm drop) | contacts exist before penetration | E |
| Allowed penetration (slop) | 0.1 to 0.2 mm | under 10% of the thinnest wall | E |
| CCD | on for items whose minimum wall is under 3 mm, for cutlery, lids and chopsticks; off for heavy thick items | Rapier/Jolt CCD is per body and costs extra | E |
| Maximum depenetration speed | 0.5 m/s | prevents "explosions" if a pose is released slightly overlapping | E |
| Contact softness (soft-constraint engines) | natural frequency 120 Hz, damping ratio at least 1; static sag `g / omega^2` = 0.017 mm (0.28 mm at 30 Hz, 0.07 mm at 60 Hz) | over-damped contacts kill chatter | E |
| Solver | sub-stepped soft-contact Gauss-Seidel (TGS-soft style) with warm starting; 8 to 12 iterations (Rapier), 10 velocity + 2 position (Jolt default) at 1 kHz; MuJoCo: Newton, tolerance 1e-10, elliptic cones, `impratio` 10 to 100 | Section 5.2 | E |
| Friction model | one Coulomb constraint per contact point (Rapier `friction_model = Coulomb`); torsional and rolling terms from Section 3.6 | thin items on wires have 2 to 4 point contacts; patch-friction shortcuts mis-estimate torque | E |

### 5.6 Stable leaning stacks, sleeping, and equilibrium checks

- **Geometry does most of the holding.** A plate in a rack sits with its rim in the valley between two base wires and leans against a tine; it is form-locked in two directions and friction-locked only against sliding along the wires. Free-form stacks (bowl leaning on a pan, lid wedged over cups) are friction-locked and are where solver creep shows.
- **Creep.** Iterative impulse solvers let friction-locked contacts drift by micrometres per step. Mitigations in order: small step with sub-stepping; warm starting; per-point Coulomb friction; position correction that does not inject energy; then sleeping.
- **Sleep criteria** (scaled from Jolt's verified 0.03 m/s and 0.5 s): linear speed below 3 mm/s and angular speed below 0.03 rad/s for 0.5 s for every body in the island [ESTIMATED]. Sleeping bodies must wake on new contact so that a newly inserted plate can push its neighbours.
- **Equilibrium test before accepting a "settled" state** (prevents scoring a pose that only exists because the solver went to sleep): wake the island, apply a small velocity perturbation (10 mm/s in four horizontal directions in turn), re-simulate 0.5 s, and require every item to return within 1 mm / 1 degree. Items that fail are reported as "unstable" to the player [ESTIMATED design].
- **Rack-slide and door-close test** before the wash starts: apply the rack push-in as a base acceleration pulse (about 2 to 3 m/s2 for 0.3 s, then a stop pulse of 5 to 10 m/s2 for 30 to 50 ms) [ESTIMATED; calibration parameter]. Real loads shift at this moment; a manufacturer-grade tool should reproduce it.
- **Mass and inertia ratios.** The catalogue spans 6 g (chopstick) to 3.6 kg (12 in cast-iron skillet), a 600:1 ratio; heavy-on-light stacks converge slowly in Gauss-Seidel solvers. Use sub-stepping, and clamp the smallest principal inertia of rod-like bodies to at least 1/50 of the largest (a chopstick's axial inertia is about 1000 times smaller than its transverse inertia [ESTIMATED]: `m r^2 / 2` = 2.7e-8 versus `m L^2 / 12` = 2.9e-5 kg m2) to avoid spin instabilities. This does not change resting poses.
- **Friction: one coefficient or two.** Rapier, Jolt and MuJoCo use a single coefficient per pair [RECALLED for Rapier and Jolt; V for MuJoCo]. Use the kinetic value (Section 11); a stack that would hold only on the static-kinetic difference would not survive the rack slide anyway.

### 5.7 Determinism

- Same binary + same action sequence must give bit-identical final poses; this is achievable with Rapier (documented, including a cross-platform mode and deterministic parallel solver) and Jolt (documented, including cross-platform builds) and with single-threaded MuJoCo [RECALLED for MuJoCo].
- Rules: fixed step count per action (no wall-clock coupling); bodies and colliders created in a canonical order; inputs quantised (position 1 mm, angles 1 degree or 5 degree presets) before they reach the engine; no engine callbacks whose order depends on threads feeding back into the state (Jolt lists contact listeners and broad-phase query order as non-deterministic [VERIFIED]); store a state hash after every action for replay verification.
- Scoring runs should execute on one reference build (the benchmark server or a pinned WASM/native binary); cross-platform determinism then becomes a convenience for local play rather than a requirement.

---

## 6. How robotics simulators model dishes and racks

| Project | What they do with dishes/racks | Lesson | Tag |
|---|---|---|---|
| RialTo (Torne et al. 2024, real-to-sim-to-real, Isaac Sim) | "we use convex decomposition with 64 hull vertices and 32 convex hulls as the collision mesh for all objects"; exception: "the dish on the rack task ... we used SDF mesh decomposition with 256 resolution which returns high-fidelity collision meshes" because "the rack needs to be simulated very precisely"; friction 0.5 static and dynamic for everything | Generic convex decomposition is not accurate enough for plate-in-rack; SDF at about 1/256 of the object size was needed | V (page, Sec. VIII-A) |
| Embedded IPC (2024) | Plate placed into a wire dish rack; "The tiny thickness of the wires and the plate" makes contact solving difficult; Drake shows penetrations "due to intensive contacts between the plate and the thin wires"; Isaac Sim shows "undesired penetration artifacts" attributed to non-convergence "in the tight time budget"; IPC barrier method is intersection-free | Two leading robotics simulators fail on exactly this scene at their usual settings. Spotless has the luxury of a small step and no real-time robot loop | V (page, Sec. IV-B) |
| BEHAVIOR (2021) / iGibson 2 | Collision meshes by V-HACD convex decomposition; box-like objects get a primitive box; objects annotated with mass, COM, inertia and stable orientations | Annotated stable orientations per object are useful metadata for placement presets | V (se) |
| BEHAVIOR-1K / OmniGibson (2024) | 9,000+ object instances in 1,900+ categories on PhysX 5; custom-object import defaults to CoACD with a 32-hull cap; includes a `loading_the_dishwasher` activity (bowls, plates, mugs, dishwasher); dirtiness, soaking and cleaning are "simulated with heuristics" and "transition rules" that "bypass the underlying physics" (particleRemover etc.) | The largest household benchmark does not simulate washing at all. Spotless's wash physics is new ground | V (page for paper; se for importer and task page) |
| RoboCasa / RoboCasa365 (MuJoCo) | 2,509 object assets in 153 categories converted to MJCF; composite tasks include dishwasher loading; fixtures use separate collision geoms from visual meshes | MuJoCo projects rely on hand-built primitive collision geoms for fixtures and convex hulls for objects | V (se) |
| GNN manipulation paper (arXiv 2102.13177) | Dishwasher-loading environment in Habitat Sim with bowls, plates and two racks; notes feasibility rules such as "a tray can only be loaded if it is open" | Loading has precedence constraints (rack out, door open) that the action API should make explicit | V (se) |
| R+X (2024) | Plate-in-rack success criterion: "the plate can stand in one of the slots of the rack without falling over" | A physical stability check is the accepted success test | V (se) |
| Jiang, Zheng, Lim, Saxena, "Learning to Place New Objects" (2011/2012) | Learns placements from point clouds with features for support, stability and preferred orientation (plates vertical in rack slots); 98% stable placements and 92% preferred placements for new objects in new placing areas | Stability + preference are separable; "preferred" encodes cleaning knowledge the game should reward through physics, not rules | V (page, abstract) |
| Cornell course project "Learn to Load the Dishwasher" (2011) | SVM proposes placing poses, then "point-based rigid-body simulation" of each candidate picks the best | Early example of simulate-to-verify placement | V (se) |
| Bogazici MSc thesis (2016) | Mugs on a dishwasher tray as 2D packing; packing heuristics + simulated annealing, genetic algorithm and two particle-swarm variants; simulation and a 5-DOF arm | Pure packing objective, no cleaning model | V (se) |
| Voysey, Thuruthel, Iida (Cambridge) | "Autonomous dishwasher loading from cluttered trays using pre-trained deep neural networks"; calls dishwasher loading a "benchmark problem in robotics"; 19 of 21 objects placed | Perception-limited; fixed slot assignments | V (se) |
| Toyota Research Institute | Dish loading used "as a means to develop the tools and algorithms"; stacked plates need a contact-rich under-plate grasp; Drake's hydroelastic model "evolved at Toyota Research Institute" | Hydroelastic contact was developed partly because point contact was inadequate for plates and mugs | V (se) |
| Figure "Helix loads the dishwasher"; WARA Robotics Challenge 2024; dexsuite pick-place-mug | Real-robot or simple single-item demos | No shared scoring of load quality exists | V (se) |

Synthesis: nobody has a validated, reusable rack-and-dishes contact model, and nobody scores a load by how clean it gets. The practices that transfer are (i) SDF-quality geometry for racks, (ii) per-object stable-orientation annotations, (iii) settle-then-check success tests, (iv) uniform friction around 0.5 as the default "we did not measure it" value, which Section 3.2 shows is roughly twice the measured dry value for real tableware.

---

## 7. Prior art: games, loading science, patents

### 7.1 Games and simulators

| Title | Platform / date | Mechanics | Relevance | Tag |
|---|---|---|---|---|
| Dishwasher (Beaver Games) | CrazyGames browser + Android, Unity, December 2024 | Drag dishes (plates, glasses, cutlery, pans) into a dishwasher with the left mouse button; WASD/arrows to move; "Realistic Physics"; zen mode without timer; home-decoration meta-game. Washing is not simulated | Closest existing game; confirms drag-and-settle is intuitive; no cleaning model, no scoring by cleanliness | V (page) |
| Tetris: Fully Loaded (Ecover x The Tetris Company) | browser, promotional | Stack dishes in a dishwasher grid, leaderboards | Grid abstraction, no physics | V (se) |
| Bosch dishwasher Tetris-style browser game | browser, promotional | Glasses, pots and plates drop; position to avoid wasted space; rows do not clear | Same | V (se) |
| Dishpig (itch.io) | Windows | Pack dishes into commercial trays as a restaurant dishwasher under time pressure | Tray packing | V (se) |
| Neverwash (Ludum Dare 50) | HTML5 | Drag-and-drop dishes into a sink; a dishwasher capsule cleans nearby items | Proximity-based "cleaning" | V (se) |
| Less Dishes is More (itch.io) | on hold | Spray-and-stack simulation feeding dishes to a machine; a commenter found the mechanics clunky | Warning about fiddly 3D placement | V (se) |
| Dishwashing Simulator (Steam) | PC | Hand-washing narrative horror, not loading | Not relevant | V (se) |

No existing game simulates water or soil. Spotless's differentiator is entirely on the wash side; on the loading side the bar is "at least as fluid as a Unity drag-and-drop game, but physically honest".

### 7.2 Science and advice on how to load

- University of Birmingham PEPT study (Perez-Mohedano et al., Chem. Eng. J. 2015; thesis 2016): water follows a cycle of spray-arm, coherent jets, impact, downfall; highest velocities at ejection; pump speed changes ejection speed but not downfall; in a full load the tracer moved slower in densely packed zones, with stagnant areas [VERIFIED] (se, abstract). Press coverage of the same work: load in a circular pattern because ejection is circular while racks are rectangular; carbohydrate soils nearer the centre (direct jet impact), protein soils nearer the edges (longer chemical contact) [VERIFIED] (se, IChemE blog and Reviewed.com; the placement-by-soil advice is from press summaries, not the abstract).
- The thesis quantifies per-plate jet coverage as a function of nozzle radius, plate spacing (20 mm in the worked example) and nozzle angles: for the Whirlpool DU750 lower arm only 2 of 10 jets hit a plate on the left side and 5 on the right, with impact durations of 0 to 27 ms per pass [VERIFIED] (Tables 5.7, 5.8). This is direct evidence that small changes in item position change which jets see it, which is what makes the game interesting.
- Capacity anchor for level design: a 60 cm machine rated 14 place settings takes, in the AS/NZS / EN 50242-style load, 14 dinner plates + 14 soup plates + 10 dessert plates in the lower basket; 14 cups, 14 saucers, 14 glasses and 4 dessert plates in the upper basket; 70 cutlery pieces (14 each of knives, forks, soup spoons, dessert spoons, teaspoons) [VERIFIED] (V-ZUG note for test institutes). That is 154 pieces in a tightly specified layout. Loading notes from the same document: plates oriented so the soiled (spinach) region is at the top; cups pushed inwards on the corner racks; cups not on the shelf rested "with their handles up against the wires"; cutlery arranged slightly diagonally in the drawer.
- IEC 60436 Ed.4 (2015) added stainless pots, coffee mugs, melamine items and a glass bowl because "the new load items provide different shapes which challenge a dishwasher water spray patterns"; Ed.5 (2025) replaced the pan and knives (out of production) and updated item masses and tolerances [VERIFIED] (se, IEC summaries).
- Consumer guidance converges on: plastics on the top rack and face down; hollow items inverted and tilted; no nesting; nothing protruding below the rack into the arm's path; small plastics must not fall through; knives and wood are often excluded (Section 4.1 sources).

### 7.3 Patents worth knowing

| Patent | Content | Tag |
|---|---|---|
| US 11,439,292 B2 "System and method for recommending object placement" | Appliance-side recommendation of where to place objects (title seen only) | V (se, title) |
| US 11,120,594 "Floor planning and placement of objects in a loading space" | Placement planning in a loading space (title seen only) | V (se, title) |
| US 5,102,225 "Utensil bag for dishwashers" | Small light items are dislodged and become airborne under spray; mesh bag as containment | V (se) |
| Rack patents (US 5,351,837 fold-down combs; US 8,540,085 and US 8,646,620 adjustable tines; US 11,612,300 configurable lower rack; EP 3123918 rotatable multi-sided tines) | Tine spacing is a design compromise: "The optimum spacing between adjacent tines for thin items like dishes is much less than for thick items like mixing bowls and pans"; quadrant-specific fixed spacings. The search extract did not say which of these patents each sentence came from | V (se) |

---

## 8. Interaction design lessons (select / rotate / position / drop / reset)

### 8.1 Principles

1. **One action set for humans and LLMs.** Every mouse gesture must reduce to the same primitive calls the API exposes, with the same quantisation, so the human baseline and the model are scored on identical physics.
2. **Kinematic while held, dynamic on release.** The held item is a kinematic ghost; collisions are previewed (overlap highlighted) but not resolved. On release it becomes dynamic and settles. This is what makes placement easy without modelling an arm, as the brief requires.
3. **Two release primitives.**
   - `drop`: release from a collision-free pose (clearance at least 0.5 mm). The UI lowers the item until the first contact would occur within 10 mm, so impact speed is at most about 0.45 m/s.
   - `insert`: guided straight-line motion along a chosen direction with a force limit (10 to 20 N) and speed 0.1 m/s, then release. Neighbours are pushed aside physically. This is how a person slides a plate between two others or pushes a mug onto tines; without it, tight slots are unreachable or require pixel-perfect ghost poses.
4. **Orientation by presets plus refinement.** Each item carries named stable poses (Section 9: `stable_poses`) such as "on edge, face to centre", "inverted", "inverted tilted 20 deg", "on side". The UI cycles presets with a key, then allows yaw in 15 degree steps and free tilt; the API accepts either a preset + yaw + tilt or a quaternion.
5. **Slots are affordances, not constraints.** Tine rows and cup shelves are exposed as snap targets (position + suggested orientation), but the item is still released into real physics. Snapping must never bypass the settle.
6. **Reset is per item and free.** `reset(item)` returns it to the staging tray and wakes its neighbours, which then re-settle (removing a support plate can topple what leaned on it; that consequence is part of the game).
7. **Report physical status after every action**: settled pose, contact list, `stable` (Section 5.6 perturbation test), `displaced_items`, `fell_through`, `outside_rack`, `blocks_spray_arm`, `blocks_rack_slide`, `touching_heater`.

### 8.2 Mouse and keyboard mapping (human baseline)

| Gesture | Primitive |
|---|---|
| Click item in tray | `select(item)` |
| Move mouse | translate ghost on the active plane (rack plane by default; hold a modifier for vertical) |
| Wheel / Q,E | yaw in 15 degree steps (hold Shift for 1 degree) |
| R / F | cycle stable-pose presets |
| W,S / A,D | tilt about the two horizontal axes |
| 1 / 2 / 3 / 4 | choose target zone: lower rack, upper rack, cutlery basket, third rack (also slides the rack out) |
| Left click | `drop` |
| Drag with right button along an arrow | `insert` |
| Backspace on a placed item | `reset(item)` |
| Space | run the stability / rack-slide test |

The only existing physics dishwasher game uses left-drag to place and WASD to move the view [VERIFIED]; keeping left-click-to-place matches player expectation.

### 8.3 API shape (for LLM play; details belong to the benchmark sibling)

```
list_items()                 -> catalogue entries for this level (dims, mass, material, soils, points, stable_poses)
get_rack_layout()            -> wires/tines as polylines, zones, slot affordances, arm sweep volumes
place(item, zone, position_mm[3], orientation {preset, yaw_deg, tilt_deg[2]} | quat, mode: "drop" | "insert", insert_dir?)
reset(item)
get_state()                  -> poses, contacts, status flags, per-item bounding boxes, free-volume estimate
check()                      -> perturbation + rack-slide + arm-sweep tests without committing
start_wash(program)          -> runs the cycle; returns the cleaning report
```

Positions quantised to 1 mm and angles to 1 degree at the API boundary. Each `place` advances the rigid-body simulation by a fixed number of steps (for example 2,000 steps = 2 s, extended in fixed 500-step blocks until asleep, capped at 10 s) so the state after an action is a pure function of the action log.

### 8.4 Things the loading simulation must detect because they change the wash

| Condition | Why it matters | How to detect |
|---|---|---|
| Item intersects a spray arm's swept volume | The arm stalls or is deflected; a whole rack level loses coverage. Do not forbid it: simulate the stalled arm | Sweep the kinematic arm through 360 degrees after loading; record first contact angle |
| Item hangs below the rack floor | Same, plus heater contact (plastics melt) | Lowest point of each item versus arm plane and heater ring |
| Item blocks the detergent dispenser door | Detergent released late or not at all | Volume test in front of the dispenser |
| Tall item in the lower rack under the upper arm or upper rack | Rack cannot slide; in reality the user would notice | Rack-slide test |
| Nested items (spoons spooning, bowls stacked) | Shadowed surfaces | Not a rigid-body status; falls out of the jet/film simulation, but a contact-area statistic is a cheap early warning |
| Item not supported by the rack (resting only on other items) | Likely to move when the neighbours are jet-mobile | Contact graph |

---

## 9. Recommended item data schema

One JSON (or RON/TOML) record per item type. Everything geometric derives from `geometry`; nothing else stores shape.

```json
{
  "id": "mug_porcelain_300",
  "name": "Mug, porcelain, 300 ml",
  "category": "drinkware",
  "reference": {"product": "generic ceramic mug (Matheus & Dollar 2010 sample)", "standard_item": null},
  "provenance": {"dims": "VERIFIED", "mass": "VERIFIED", "profile": "ESTIMATED"},

  "materials": [
    {"part": "body",   "material": "porcelain_glazed", "density": 2400},
    {"part": "foot",   "material": "porcelain_unglazed"}
  ],

  "geometry": {
    "class": "sor_handle",
    "units": "mm",
    "profile": [
      {"r": 0,  "z": 2.5, "t": 5.0},
      {"r": 36, "z": 2.5, "t": 5.0},
      {"r": 38, "z": 6,   "t": 4.2},
      {"r": 40, "z": 100, "t": 4.2}
    ],
    "foot_ring": {"r": 30, "width": 4, "height": 2.5},
    "addons": [
      {"type": "handle_loop", "attach_z": [25, 80], "reach": 30, "section": [12, 8], "mass_g": 45}
    ],
    "tessellation": {"chord_error_mm": 0.5, "min_sectors": 16}
  },

  "mass_properties": {
    "mass_g": 351,
    "com_mm": [7.4, 0, 43],
    "inertia_kg_m2": {"ixx": 4.9e-4, "iyy": 5.3e-4, "izz": 4.0e-4},
    "source": "computed_from_profile | measured"
  },

  "collision": {
    "body": "rounded_quads_from_profile",
    "addons": "capsule_chain",
    "ccd": false,
    "min_wall_mm": 4.2
  },

  "fluid": {
    "sdf": "analytic_sor_plus_capsules",
    "porosity": 0.0,
    "holds_water_when": [
      {"pose": "upright", "volume_ml": 300},
      {"pose": "inverted", "volume_ml": 7, "where": "foot recess"}
    ]
  },

  "surface_regions": [
    {"id": "interior",  "select": "inner side of profile, z > 5",  "area_cm2": 250, "score_weight": 0.6, "roughness": "glazed"},
    {"id": "rim",       "select": "within 10 mm of rim",           "area_cm2": 25,  "score_weight": 0.2, "roughness": "glazed"},
    {"id": "exterior",  "select": "outer side",                    "area_cm2": 270, "score_weight": 0.15, "roughness": "glazed"},
    {"id": "foot",      "select": "foot ring",                     "area_cm2": 8,   "score_weight": 0.05, "roughness": "unglazed"}
  ],
  "typical_soils": [
    {"region": "interior", "soil": "tea_tannin",  "pattern": "ring_and_film"},
    {"region": "interior", "soil": "coffee_dried", "pattern": "bottom_pool"},
    {"region": "rim",      "soil": "lipstick_grease", "pattern": "arc"}
  ],

  "contact": {"material_key": "ceramic_glazed", "foot_material_key": "ceramic_unglazed"},

  "placement": {
    "zones": ["upper_rack"],
    "stable_poses": [
      {"name": "inverted",        "rot_xyz_deg": [180, 0, 0]},
      {"name": "inverted_tilted", "rot_xyz_deg": [160, 0, 0]},
      {"name": "on_side",         "rot_xyz_deg": [90, 0, 0]},
      {"name": "upright",         "rot_xyz_deg": [0, 0, 0]}
    ],
    "recommended_pose": "inverted_tilted",
    "envelope_mm": [117, 80, 100]
  },

  "flags": {
    "floats": false,
    "jet_mobile": true,
    "pi_j_max": 0.26,
    "dishwasher_safe": true,
    "top_rack_only": false,
    "fragile": true,
    "max_temp_c": null
  },

  "game": {"default_points": 10}
}
```

Notes on fields:

- `provenance` keeps the confidence tag with the data so calibration can replace E/R values item by item.
- `surface_regions` is the bridge to the soils and scoring models: soil is assigned per region, cleanliness is scored per region, and the per-surface-element atlas (texels of about 2 mm; a dinner plate has about 1,100 cm2 of surface, so about 27,000 elements [ESTIMATED]) is generated from the same profile.
- `contact.foot_material_key` exists because unglazed foot rings are the main high-friction exception on ceramics.
- `flags.pi_j_max` is the screening value of Section 4.6 evaluated for the level's machine (in the example: 351 g mug, concave factor 2, `J_max` = 0.45 N gives 0.26, just above the threshold); `jet_mobile` is `pi_j_max >= 0.25`. Both are derived at load time, not authored.
- `holds_water_when` lets the films model start from known pool volumes instead of rediscovering them.
- Box-shell, slab, rod and wire classes replace `profile` with their own parameter blocks (`length, width, height, wall_t, corner_r, flange`; `centreline + section`; `wires: [{polyline, radius}]`).

---

## 10. Starter catalogue

Legend: V = [VERIFIED], R = [RECALLED], E = [ESTIMATED] (thin-shell estimator of Section 2 unless stated). Dimensions in mm (D = outer diameter, H = height, L = length), mass in g. Source keys refer to Section 14. "(pkg)" = listing weight may include packaging.

### 10.1 Dimensions, mass, material

| # | Item | Reference product / standard item | Dimensions (mm) | Mass (g) | Material | Source |
|---|---|---|---|---|---|---|
| 1 | Dinner plate, test-standard porcelain | IEC 60436 dinner plate (Arzberg 8500, per Australian factsheet V) | D 260 (R), H 24 (E) | 590 (E) | hard porcelain | S5, S3 |
| 2 | Dinner plate, heavy porcelain | IKEA 365+ plate 27 cm | D 270, H 30 (V) | 770 (V) | feldspar porcelain | P1 |
| 3 | Dinner plate, laminated glass | Corelle Winter Frost 10.25 in; AHAM DW-2 dinner plate "10 in (25.4 cm) Corelle" | D 260, H 19 (V) | 340 (V) | Vitrelle glass | P2, S1 |
| 4 | Dinner plate, stoneware (generic) | Yale "dinner plate, ceramic" | D 270, H 30 (V) | 798 (V) | glazed ceramic | S8 |
| 5 | Dessert / side plate, porcelain | IEC dessert plate (Arzberg 8500) | D 190 (R), H 18 (E) | 300 (E) | porcelain | S5 |
| 6 | Bread-and-butter plate, glass | AHAM DW-2 "6.7 in (17.0 cm) Corelle" | D 170 (V), H 15 (E) | 150 (E, area-scaled from #3) | Vitrelle glass | S1 |
| 7 | Soup plate, rimmed | IEC soup plate (Arzberg 1382, 23 cm) | D 230 (V), H 40 (E) | 490 (E) | porcelain | S5, P3 |
| 8 | Deep plate / bowl | IKEA 365+ deep plate 22 cm, 0.9 L | D 220, H about 60 (V) | 590 (V) | feldspar porcelain | P1 |
| 9 | Pasta bowl | Maxwell and Williams White Basics 23 cm, 1260 ml | D 230, H 65 (V) | 660 (V) | porcelain | P4 |
| 10 | Cereal bowl, porcelain | IKEA 365+ bowl 16 cm, 0.8 L | D 160, H 70 (V) | 440 (V) | feldspar porcelain | P1 |
| 11 | Cereal / soup bowl, glass | Corelle 18 oz bowl | D 159, H 51 (V) | 179 (V, City Block pattern) | Vitrelle glass | P2 |
| 12 | Cereal bowl, stoneware (generic) | Yale "bowl, ceramic" | D 130, H 80 (V) | 479 (V) | glazed ceramic | S8 |
| 13 | Fruit / dessert bowl | AHAM DW-2 "10 oz (296 ml) Corelle" | D 137, H 45 (E) | 120 (E) | Vitrelle glass | S1 |
| 14 | Ramekin 6 oz | BIA Cordon Bleu Stockholm | D 89, H 44 (V) | 181 (V) | porcelain | P5 |
| 15 | Saucer | Arzberg 1382 saucer (AHAM "5.5 in (14.0 cm)") | D 140 (V), H 17 (E) | 155 (E) | porcelain | S1 |
| 16 | Tea / coffee cup 0.2 L | Arzberg 1382 cup (AHAM "7 fl oz (207 ml)") | D 85, H 65 (E) | 155 (E) | porcelain | S1 |
| 17 | Mug, porcelain 240 ml | IKEA 365+ mug 24 cl | H 70 (V), D 85 (E) | 260 (E; 290 gross V) | feldspar porcelain | P1 |
| 18 | Mug, ceramic 300 ml (generic) | Yale "mug, ceramic" | D 80, H 100 (V) | 351 (V) | glazed ceramic | S8 |
| 19 | Mug, tempered glass | IKEA 365+ glass mug 24 cl | H 70 (V) | 250 (V, pkg) | tempered glass | P1 |
| 20 | Espresso cup 80 ml | Loveramics 80 ml | D 70, H 60 (V) | 150 (E; 160 to 169 pkg V) | porcelain | P6 |
| 21 | Espresso saucer | generic | D 120, H 15 (R) | 110 (E) | porcelain | - |
| 22 | Serving bowl 1 qt | AHAM DW-2 "1 qt (950 ml) Corelle" | D 216, H 65 (R) | 310 (E) | Vitrelle glass | S1 |
| 23 | Oval platter, small | AHAM DW-2 "9.5 in by 7.5 in (24.1 by 19.1 cm)" | 241 x 191 (V), H 20 (E) | 300 (E) | Vitrelle glass | S1 |
| 24 | Oval platter, large | IEC oval platter | L 320 (R), W 230 (E), H 28 (E) | 900 (E) | porcelain | - |
| 25 | Melamine plate | IEC Ed.4 melamine item class (V that the class exists) | D 230, H 18 (E); wall at least 3.0 (V) | 200 (E) | melamine-formaldehyde | S4, S7 |
| 26 | Melamine bowl | same | D 150, H 60 (E); wall at least 2.5 to 3.0 (V) | 136 (E) | melamine-formaldehyde | S4, S7 |
| 27 | Tumbler 250 ml | Duralex Picardie 25 cl | D 87, H 90 (V) | 220 (V) | tempered soda-lime | P7 |
| 28 | Tumbler 360 ml | Duralex Picardie 36 cl | D 88, H 124 (V) | 290 (E; 310 ml size is 250 V) | tempered soda-lime | P7 |
| 29 | Test glass 250 ml | IEC glass (Schott Duran beaker, per factsheet V) | D 70, H 95 (R) | 100 (R) | borosilicate | S5 |
| 30 | Iced-tea glass 355 ml | Libbey 551HT (AHAM DW-2 glass) | H 133, top D 70, base D 60, max D 73 (V) | 265 (E) | heat-treated soda-lime | S1, P8 |
| 31 | Highball 350 ml | generic | D 65, H 150 (R) | 270 (E) | soda-lime | - |
| 32 | Pint / mixing glass 473 ml | Libbey 1639HT | H 149, top D 89, base D 60 (V) | 440 (V, case weight / 24) | heat-treated soda-lime | P9 |
| 33 | Wine glass, large red 540 ml | Zwiesel Pure Cabernet | H 244, D 92 (V) | 184 (V) | lead-free crystal | P10 |
| 34 | Wine glass, generic | Yale "wine glass" | D 80, H 200 (V) | 268 (V) | glass | S8 |
| 35 | Wine glass, Bordeaux 610 ml | Riedel Vinum Bordeaux Grand Cru | H 265 (V), D 95 (E) | 230 (E) | crystal | P10 |
| 36 | Champagne flute 170 ml | WMF Smart 07 / Arcoroc Elegance | H 224, D 65 / H 175, D 55 (V) | 130 / 160 (V) | crystal / glass | P11 |
| 37 | Glass jug 1 L | generic | D 110, H 190, handle reach 45 (R) | 790 (E) | soda-lime | - |
| 38 | Plastic pitcher | Yale "pitcher, plastic" | 180 x 110 x 240 (V) | 293 (V) | SAN / PP | S8 |
| 39 | Measuring jug, glass 500 ml | Pyrex 2-cup | body D 107, with handle 165, H 107 to 114 (V) | 618 (V) | tempered soda-lime | P12 |
| 40 | Glass bowl (serving) | Yale "bowl, glass" (IEC Ed.4 has a glass-bowl item, V) | D 180, H 80 (V) | 545 (V) | glass | S8, S4 |
| 41 | Dinner knife | IKEA DRAGON 21 cm; hotel knives 224 to 248; AHAM knife is WMF 12.0803.6047 "solid handle" (V that it is specified; length not found) | L 210 to 248 (V) | 80 to 100 (R; 97 incl. pkg V) | 18/10 or 13Cr steel | P13, S1 |
| 42 | Dinner fork | WMF Signum 12.1905.6040 = AHAM dinner fork, 185; IKEA DRAGON 190; hotel forks 194 to 211 | L 185 to 211 (V) | 40 to 55 (R; Signum 185 mm is 40 gross V; Yale utensil 47.6 V) | 18/10 steel | P13, S1, S8 |
| 43 | Salad / cake fork | WMF Signum 12.1964.6040 = AHAM salad fork, 156; IKEA DRAGON 160 | L 156 to 160 (V) | 25 to 35 (R) | 18/10 steel | P13, S1 |
| 44 | Soup / table spoon | DRAGON 19 cm | L 190 (V) | 50 to 60 (R) | 18/10 steel | P13 |
| 45 | Dessert spoon | DRAGON 16 cm | L 160 (V) | 35 to 45 (R) | 18/10 steel | P13 |
| 46 | Teaspoon | DRAGON 13 cm; hotel 149 to 159 | L 130 to 159 (V) | 20 to 30 (R) | 18/10 steel | P13 |
| 47 | Steak knife | generic | L 230, blade 115 (R) | 60 to 90 (R) | steel + POM/wood handle | - |
| 48 | Chopsticks (each) | generic | L 230 to 240, 7 square tapering to 3 (R) | 6 wood / 13 melamine (E) | bamboo, wood, melamine | - |
| 49 | Serving spoon | Bon Chef 8.5 in table/serving spoon | L 216 (V) | 75 (E) | 18/10 steel | P13 |
| 50 | Serving fork | WMF Signum 12.1902.6040 = AHAM "serving cold meat fork" (sold as 8-1/4 in table fork) | L 210 (V) | 55 (E; 59 shipping weight V) | 18/10 steel | P13, S1 |
| 51 | Chef's knife 8 in | Victorinox Fibrox Pro | L 335, blade 200 x 48 to 53 (V) | 165 to 184 (V) | steel + TPE handle | P14 |
| 52 | Ladle | OXO steel ladle, 6 oz | L 311, bowl D 108 (V) | 180 (V) | steel | P15 |
| 53 | Turner, nylon | OXO nylon flexible turner | 279 x 84 (V) | 73 (V) | nylon | P15 |
| 54 | Spatula, plastic (generic) | Yale "spatula, plastic" | 330 x 50 x 20 (V) | 90 (V) | nylon / PP | S8 |
| 55 | Balloon whisk 11 in | OXO 11 in balloon whisk | L 292, head D about 67 (V: circumference 8.25 in) | 96 to 123 (V) | steel wires + TPE handle | P15 |
| 56 | Tongs 12 in | OXO 12 in locking tongs | 350 x 25 to 38 x 50 (V) | 150 to 204 (V) | steel + nylon/silicone heads | P15 |
| 57 | Wooden spoon 12 in | TableCraft / Browne beechwood | L 305, handle D 9.5 (V) | 41 to 59 (V) | beech | P15 |
| 58 | Swivel peeler | OXO Good Grips | 180 x 25 x 25 (V) | 57 to 70 (V) | steel + TPE | P15 |
| 59 | Box grater | OXO box grater | 300 x 114 x 75 (V) | 350 (E; 504 pkg V) | steel + plastic | P15 |
| 60 | Colander 5 qt | OXO 5 qt stainless | D 286, H 127 (V) | 420 (V) | perforated steel | P15 |
| 61 | Mesh sieve 20 cm | generic | D 200, depth 75, handle 180 (R) | 220 (E) | steel mesh | - |
| 62 | Chopping board, PE | IKEA LEGITIM | 340 x 240 x 8 (V) | 560 to 570 (V) | polyethylene | P16 |
| 63 | Chopping board, PP | OXO utility board | 375 x 267 x 8 to 13 (V) | 700 (V) | PP + TPE edges | P16 |
| 64 | Chopping board, beech | IKEA PROPPMATT | 380 x 270 x 22 (V) | 1550 to 1590 (V) | beech | P16 |
| 65 | Mixing bowl, glass 4 qt | Pyrex 4 qt | D 302 to 318, H 114 (V) | 1602 (V) | tempered soda-lime | P12 |
| 66 | Mixing bowl, steel 4 qt | Vollrath 69040 / 47934 | D 264, H 108 / D 271, H 95 (V) | 476 / 254 (V) | stainless | P17 |
| 67 | Mixing bowl, PP 3 L | generic | D 260, H 125 (R) | 240 (E) | PP | - |
| 68 | Saucepan 2 qt, clad | All-Clad D3 | top D 159, depth 108, overall L 318 (V) | 907; 1360 with lid (V) | tri-ply steel/aluminium | P18 |
| 69 | Saucepan, light steel | Yale "cooking pot w/handle, steel" | D 170, H 100 (V) | 504 (V) | stainless | S8 |
| 70 | Frying pan 10 in, clad | All-Clad D3 | top D 254, base D 190, depth 51, overall L 470 (V) | 1190 (V) | tri-ply | P18 |
| 71 | Frying pan 28 cm, non-stick | Nisbets aluminium non-stick | D 280, H 45 (V) | 900 (V) | aluminium + PTFE | P18 |
| 72 | Skillet, steel (generic) | Yale "skillet, metal" | D 270, H 50 (V) | 988 (V) | steel/aluminium | S8 |
| 73 | Skillet 10.25 in, cast iron | Lodge L8SK3 | D 260, overall L 409, H 51 (V) | 2427 (V) | cast iron | P19 |
| 74 | Skillet 12 in, cast iron | Lodge L10SK3 | W 319, L 457, H 57 (V) | 3580 (V; REI lists 3320) | cast iron | P19 |
| 75 | Stockpot 8 qt with lid | Cuisinart Chef's Classic 766-24 | D 260, H 195 (V) | 2180 incl. lid (V) | stainless, disc base | P20 |
| 76 | Lid, glass 24 cm | generic | D 240, dome 25 (R) | 600 (E) | tempered glass + steel rim | - |
| 77 | Lid, steel 16 to 18 cm | All-Clad 2 qt lid (difference of listed weights) | D 165 (E) | 450 (V, derived) | stainless | P18 |
| 78 | Oven dish, stoneware 32 cm | Le Creuset rectangular 4 L | 397 x 253 x 70 overall (V) | 2300 (V) | stoneware | P21 |
| 79 | Oven dish, glass 3 qt | Pyrex Basics oblong | inner 226 x 335; overall about 401 x 241 x 64 (V) | 1410 (V) | tempered soda-lime | P12 |
| 80 | Baking tray (half sheet) | Nordic Ware Naturals | 455 x 328 x 25 (V) | 748 (V) | aluminium, steel-wire rim | P22 |
| 81 | Roasting tin 16 in | Cuisinart 7117-16UR / ATK-tested tri-ply | 427 x 325 x 86 (V) | 2700 to 3200 with rack (V); 2980 tri-ply (V) | stainless | P22 |
| 82 | Muffin tin, 12-cup | Nordic Ware Naturals | 330 x 245 x 32, cavities D 64 (V) | 590 (V) | aluminium | P22 |
| 83 | Cooling rack | Vollrath 20248 / Fat Daddio's CR-HALF | 419 x 298 x 22 (V) | 400 (E) | stainless wire | P22 |
| 84 | Loaf pan, non-stick | Yale "baking pan (non-stick metal)" | 210 x 110 x 80 (V) | 352 (V) | coated steel | S8 |
| 85 | Food container 1 L, clip lid | Sistema Klip It Plus 1 L | 176 x 128 x 79 (V) | 123 to 130 with lid (V) | PP, silicone seal | P23 |
| 86 | Food container 1 L | IKEA 365+ 1.0 L | 210 x 150 x 70 (V) | 120 (V, pkg) | PP, silicone seal | P23 |
| 87 | Food container 0.6 L | IKEA PRUTA / Yale "plastic container" | 140 x 140 x 60 (V) | 50 (V, derived) / 44.8 (V) | PP | P23, S8 |
| 88 | Container lid | generic for #85 to #87 | 180 x 130 x 12 (E) | 15 to 40 (E) | PP / LDPE | - |
| 89 | Lunch box 2 L | generic bento | 215 x 165 x 70 (R) | 250 (E) | PP | - |
| 90 | Water bottle 1 L | Nalgene 32 oz wide mouth | D 89, H 215, mouth D 63 (V) | 177 (V) | Tritan copolyester | P24 |
| 91 | Water bottle (generic reusable) | Yale "water bottle, non-disp. plastic" | D 90, H 200 (V) | 179 (V) | plastic | S8 |
| 92 | Travel mug 470 ml | Contigo West Loop 16 oz | H 190 to 210, D 76 to 90 (V) | 249 to 354 (V) | double-wall steel + PP lid | P24 |
| 93 | Baby bottle 260 ml | Philips Avent Natural (V: PP bottle, silicone nipple, 260 ml) | D 68, H 145 (E) | 44 (E) + ring 10, cap 8 (E) | PP | P24 |
| 94 | Bottle teat | Avent Natural nipple | D 50, H 45 (E) | 9 (E) | silicone | P24 |
| 95 | Sippy cup 240 ml | generic | D 70, H 90 + lid (R) | 62 (E) | PP + TPE spout | - |
| 96 | PP drinking cup 400 ml | generic | D 85, H 120 (R) | 41 (E) | PP | - |
| 97 | Blender jug 2 L | Vitamix 64 oz low-profile | H 257, footprint about 203 x 203 (V) | 1190 (V) | Tritan + steel blade | P24 |
| 98 | Silicone spatula | generic | L 280, head 90 x 55 (R) | 60 (R) | silicone over nylon core | - |

98 rows. 74 rows contain at least one verified dimension; 55 have a verified mass as the primary figure (several are retailer weights, and four are derived from a case, set or with-lid weight), and 7 more have an estimated or recalled mass bounded by a verified packaged/gross figure. The remaining 36 masses are estimates or recalled values and are the first candidates for a kitchen-scale calibration pass.

### 10.2 Starting profiles (mid-surface polylines, mm: r, z, t)

All [ESTIMATED]: fitted to the outer dimensions and mass in 10.1; refine with calipers or 3D scans. `extra` = lumped add-on mass.

| Item (#) | Profile points (r, z, t) | Add-ons | Model mass (g) | z_c (mm) |
|---|---|---|---|---|
| Dinner plate IEC-type (1) | (0,3,4.2) (85,3,4.2) (98,9,4.2) (130,24,4.2) | foot ring r 80, 5 x 4 | 591 | 10 |
| IKEA 365+ plate (2) | (0,4,5.2) (88,4,5.2) (100,10,5.2) (135,27,5.2) | foot ring r 85, 6 x 4 | 792 | 11 |
| Corelle plate (3) | (0,1.3,2.6) (85,1.3,2.6) (100,6,2.6) (130,18,2.6) | none (no foot ring) | 359 | 6 |
| Dessert plate (5) | (0,3,4.0) (60,3,4.0) (70,7,4.0) (95,18,4.0) | foot ring r 55 | 303 | 8 |
| Soup plate (7) | (0,3,4.2) (60,3,4.2) (82,26,4.2) (115,38,4.2) | foot ring r 60 | 494 | 20 |
| Deep plate 22 cm (8) | (0,3,5) (55,3,5) (90,25,5) (110,58,5) | foot ring r 50 | 646 | 25 |
| Pasta bowl (9) | (0,3,4.5) (55,3,4.5) (85,25,4.5) (115,63,4.5) | foot ring r 50 | 623 | 29 |
| Cereal bowl 16 cm (10) | (0,3,5) (40,3,5) (62,20,5) (76,45,5) (80,68,5) | foot ring r 40 | 466 | 31 |
| Ramekin (14) | (0,2.5,5) (40,2.5,5) (42,6,4.5) (44.5,44,4.5) | fluted exterior ignored | 184 | 16 |
| Saucer (15) | (0,3,3.8) (30,3,3.8) (40,7,3.8) (70,17,3.8) | cup well: 2 mm recess r 22 | 155 | 10 |
| Tea cup (16) | (0,3,4) (24,3,4) (30,10,3.2) (40,45,3.2) (42.5,65,3.0) | handle loop 25 g | 156 | 31 |
| Mug (18) | (0,2.5,5) (36,2.5,5) (38,6,4.2) (40,100,4.2) | handle loop 45 g, reach 30 | 336 | 43 |
| Espresso cup (20) | (0,3,6) (20,3,6) (24,10,5) (31,58,5) | handle 15 g | 148 | 28 |
| Melamine plate (25) | (0,2,3) (80,2,3) (90,8,3) (115,18,3) | - | 197 | 7 |
| Melamine bowl (26) | (0,2,3) (35,2,3) (60,25,3) (75,60,3) | - | 136 | 28 |
| Picardie 250 (27) | (0,3.5,7) (27,3.5,7) (29,8,4) (40,60,3) (43.5,90,3) | facets ignored | 211 | 38 |
| Libbey 551HT (30) | (0,4.5,9) (28,4.5,9) (30,10,3.2) (36.5,110,2.8) (35,133,2.8) | - | 265 | 54 |
| Highball (31) | (0,5,10) (29,5,10) (30.5,12,3) (32.5,150,2.4) | - | 272 | 56 |
| Pint glass (32) | (0,6.5,13) (28,6.5,13) (30,14,4.5) (44.5,149,3.4) | - | 422 | 63 |
| Wine glass 540 ml (33) | bowl: (4,120,3) (30,128,1.6) (46,165,1.1) (44,200,1.0) (33,244,0.9) | stem D 8 x 105; foot D 85 x 3.2 | 161 | 114 |
| Flute (36) | bowl: (3.5,95,3) (18,105,1.5) (27,150,1.0) (24,224,0.9) | stem D 7 x 85; foot D 70 x 3 | 93 | 97 |
| Glass jug (37) | (0,3,6) (48,3,6) (52,10,3.5) (55,150,3.5) (50,190,3.5) | handle 120 g; spout | 787 | 80 |
| Measuring jug (39) | (0,3,7) (40,3,7) (46,12,5) (53.5,100,5) | handle 110 g; spout | 587 | 43 |
| Mixing bowl glass (65) | (0,3,6.5) (55,3,6.5) (110,40,5.5) (145,85,5.5) (153,114,5.5) | - | 1680 | 54 |
| Mixing bowl steel (66) | (0,0.3,0.7) (50,0.3,0.7) (97,35,0.7) (125,75,0.7) (132,108,0.7) | rolled rim r 2 | 532 | 51 |
| Mixing bowl PP (67) | (0,1.5,2.5) (60,1.5,2.5) (105,45,2.5) (125,95,2.5) (130,125,2.5) | - | 242 | 59 |
| Saucepan 18 cm disc base | (0,0.5,0.8) (85,0.5,0.8) (90,5,0.8) (90,95,0.8) | base disc 4 mm Al + 0.6 mm steel; handle 200 g, 180 long | 1001 | 33 |
| Frying pan clad 10 in (70) | (0,1.3,2.6) (95,1.3,2.6) (112,15,2.6) (127,51,2.6), rho 5600 | handle 250 g, 215 long | 1296 | 16 |
| Non-stick pan 28 cm (71) | (0,1.6,3.6) (105,1.6,3.6) (125,20,3.0) (140,48,3.0) | handle 220 g | 945 | 14 |
| Lodge 10.25 in (73) | (0,2,4) (108,2,4) (113,6,4.2) (130,51,4) | handle 330 g, 150 long; helper lip | 2600 | 15 |
| Lodge 12 in (74) | (0,2,4.2) (128,2,4.2) (133,6,4.4) (153,57,4.2) | handles 500 g | 3742 | 16 |
| Stockpot (75) | (0,0.5,0.8) (115,0.5,0.8) (120,5,0.8) (120,190,0.8) | disc base; two loop handles 250 g | 1964 | 73 |
| Glass lid (76) | (0,22,4) (60,18,4) (110,6,4) (118,2,4) | steel rim + knob 150 g | 602 | 12 |
| Colander (60) | (0,0,0.5) (70,0,0.5) (120,45,0.5) (143,110,0.5) | foot ring, two handles 90 g; porosity about 0.15 | 543 (over by 29%) | 49 |
| Nalgene (90) | (0,1,2.4) (40,1,2.4) (44.5,6,2.2) (44.5,170,2.2) (31.5,190,2.4) (31.5,215,2.6) | cap 25 g | 193 | 97 |
| Baby bottle (93) | (0,1,1.8) (28,1,1.8) (33,8,1.5) (33,115,1.5) (25,125,1.8) (25,140,2.0) | ring, cap, teat separate items | 44 | 64 |
| PP cup (96) | (0,1,1.8) (28,1,1.8) (30,5,1.5) (42.5,120,1.5) | - | 41 | 58 |
| Sippy cup (95) | (0,1,1.8) (30,1,1.8) (32,5,1.6) (35,90,1.6) | lid + spout 30 g | 62 | 39 |
| Blender jug (97) | (0,3,5) (50,3,5) (57,20,3.5) (75,250,3.5) (square section in reality) | blade/base 350 g, handle 120 g | 942 | 118 |

Centre-of-mass offsets caused by handles [ESTIMATED]: mug 7 mm toward the handle; saucepan 29 mm; clad fry pan 44 mm; Lodge skillet 25 mm. Pans therefore hang handle-down when supported near the rim centre, and a mug hung on a tine by its handle tilts.

Stemware COM is at 43 to 47% of total height [ESTIMATED], which is why stemware is stable inverted on a sloped shelf but tips easily when upright on wires.

### 10.3 Placement, soils and special behaviour by family

Placement and soil entries are common practice and standard assignments. AHAM soil assignments are [VERIFIED] (S1); IEC assignments are [RECALLED] (standards sibling owns them); the rest is domain knowledge [RECALLED].

| Family (rows) | Usual placement | Typical soils | Behaviour to capture |
|---|---|---|---|
| Dinner plates (1 to 4) | Lower rack, on edge between tines, eating face toward the centre/spray | AHAM: egg yolk, mashed potato, ground beef with tomato paste, raspberry preserves (V). IEC: minced meat, spinach, egg (R). Home: baked cheese, sauces, dried egg | Plates shadow each other when pitch is too small; rimmed plates trap a wedge of water at the lower rim |
| Side / dessert plates (5, 6) | Lower rack front rows or upper rack | AHAM: creamed corn, oatmeal (V). IEC: spinach, margarine (R) | Light glass plates (150 g) can rattle but do not move |
| Soup plates, deep plates, pasta bowls (7 to 9) | Lower rack, steeper lean, wider pitch | IEC: oat flakes porridge (R); pasta starch, soup rings | Deep well faces downward only if leaned enough; otherwise pools |
| Bowls (10 to 13, 22, 40) | Upper rack inclined between tines, or lower rack rear; never nested | AHAM: creamed corn, oatmeal (V); cereal, yoghurt, rice | Nesting is the classic failure; foot ring holds about 20 ml when inverted |
| Ramekins (14) | Upper rack, inverted and tilted | Baked egg, creme brulee caramel, cheese | Small, dense, stable; baked-on soil |
| Cups, mugs, espresso (16 to 20) | Upper rack, inverted on tines or cup shelf, handle outward | Tea tannin, coffee, milk skin, lipstick on rim | Foot recess retains about 7 ml; handles hook on tines |
| Saucers (15, 21) | Upper rack on edge | Tea / coffee drips | Easily shadowed by cups |
| Platters (23, 24) | Lower rack sides or rear, on edge | AHAM/IEC: meat, potato (V/R) | Tall; may block detergent door or upper arm |
| Melamine (25, 26) | Upper rack | IEC: margarine and others (R) | Low density (1500), poor heat capacity, dries badly |
| Tumblers, highballs, pints (27 to 32) | Upper rack, inverted between tines, slightly tilted | IEC: dried milk (R); AHAM: tomato juice, milk (R); smoothie, juice pulp | Tall glasses limit upper-rack height; punt holds water |
| Stemware (33 to 36) | Upper rack against stemware holders, inverted and leaning | Wine tannin, lipstick | Top-heavy when upright; rim about 1 mm thick; borderline jet-mobile; chips on glass-glass contact |
| Jugs, measuring jug (37 to 39) | Upper or lower rack, inverted, spout down | Milk, batter, oil | Handle and spout break symmetry; holds full volume if upright |
| Cutlery (41 to 46, 49, 50) | Cutlery basket (handles down for spoons/forks, mixed to avoid nesting) or flat in third-rack tray | AHAM: egg yolk on forks, creamed corn/oatmeal on spoons (V); IEC: egg, oat flakes (R) | Spoon nesting shadows soil; teaspoons lying flat in a tray are jet-mobile |
| Sharp knives (47, 51) | Third rack flat, or basket point-down | Fat, protein | Often "hand wash only"; edge damage is a chemistry/damage flag |
| Chopsticks (48) | Basket cell or third rack | Rice starch, sauce | Lightest item in the catalogue: jet-mobile, floats if wood, falls through rack |
| Long tools (52 to 59) | Upper rack lying flat, or third rack | Sauces, batter, starch, cheese (grater), peelings | Lying flat they shadow items below; whisk and grater have self-shadowing geometry; wooden spoon floats and is not dishwasher-safe |
| Colander, sieve (60, 61) | Lower rack on edge or inverted | Starch film, trapped particles in holes/mesh | Porous to jets; mesh traps redeposited soil |
| Chopping boards (62 to 64) | Lower rack outer rows on edge | Meat juice, vegetable stain, fat | Large flat shadow; can block detergent door; wood board not dishwasher-safe |
| Mixing bowls (65 to 67) | Lower rack, steeply inclined, opening toward the arm | Batter, dough, dressing | Big shadow; PP bowl is light for its size (jet mobility about 0.1 to 0.2) |
| Saucepans, stockpot (68, 69, 75) | Lower rack, inverted and tilted | Burnt starch, milk scale, sauce (IEC Ed.4 has stainless pots, V) | Tall; baked-on soil; blocks upper arm if upright |
| Frying pans, skillets (70 to 74) | Lower rack on edge or inverted | Polymerised fat, egg, fond | Handle-heavy; cast iron and non-stick are "not recommended" items |
| Lids (76, 77, 88) | Lower rack on edge (pan lids); upper rack wedged (container lids) | Condensed fat film, sauce splatter | Container lids are the most jet-mobile common item |
| Oven dishes, roasting tin, trays (78 to 84) | Lower rack on edge at the sides, or flat inverted | Baked-on cheese/lasagne, roast fat, caramelised sugar, muffin crumb | Largest shadows; muffin tin has 12 cavities that pool if upright; cooling rack wires trap residue |
| Food containers, lunch box (85 to 89) | Upper rack, inverted, wedged between tines | Tomato sauce stain, oil film, curry | Jet-mobile; fill when flipped; PP dries poorly; clip lids have seal grooves |
| Bottles (90, 91, 93) | Upper rack inverted over a tine or bottle jet | Protein shake, milk film | Narrow neck: interior reached only by a jet aligned with the axis |
| Travel mug (92) | Upper rack inverted; lid separately | Coffee oils, milk | Double wall traps water in lid mechanisms |
| Baby items (93 to 95) | Upper rack basket/cage | Milk film (protein + fat) | Teats and rings need containment; high-stakes cleanliness |
| Blender jug (97) | Lower rack on its side or inverted | Smoothie fibre under the blade | Blade assembly shadows the base |
| Silicone tools (98) | Upper rack | Batter, fat | High friction, floats partly, absorbs odours |

---

## 11. Recommended contact parameters

All values in this section are [ESTIMATED] syntheses of the verified data in Sections 3.2 to 3.5. Ranges are what a calibration campaign should expect to land in. "Loading" = room temperature, items dry to damp and lightly soiled. "Wash" = fully wet with detergent solution at 50 to 65 C (use for jet-displacement events and for the post-wash state).

Use a **pair table** looked up from the two `material_key`s (via the engine's contact-modification hook, MuJoCo `pair` elements, or equivalent), not a per-body coefficient with a combine rule: the measured data are pair-specific and no combine rule reproduces them.

### 11.1 Friction: item material against coated rack wire (PA11; for PVC-coated racks multiply by 1.5)

| Item material | Loading: mu_s | Loading: mu_k (use this as the single engine coefficient) | Range | Wash: mu_s | Wash: mu_k | Range |
|---|---|---|---|---|---|---|
| Glazed ceramic / porcelain | 0.30 | 0.25 | 0.20 to 0.40 | 0.20 | 0.15 | 0.10 to 0.30 |
| Unglazed foot ring | 0.50 | 0.42 | 0.35 to 0.65 | 0.40 | 0.33 | 0.25 to 0.55 |
| Glass (soda-lime, Vitrelle, borosilicate, crystal) | 0.25 | 0.20 | 0.15 to 0.35 | 0.18 | 0.13 | 0.08 to 0.28 |
| Stainless steel | 0.28 | 0.22 | 0.16 to 0.40 | 0.18 | 0.14 | 0.08 to 0.28 |
| Aluminium, bare or anodised | 0.30 | 0.25 | 0.20 to 0.45 | 0.20 | 0.15 | 0.10 to 0.30 |
| PTFE non-stick coating | 0.12 | 0.10 | 0.05 to 0.20 | 0.10 | 0.08 | 0.04 to 0.18 |
| Cast iron, seasoned | 0.35 | 0.30 | 0.25 to 0.50 | 0.25 | 0.20 | 0.15 to 0.40 |
| PP / PE | 0.25 | 0.20 | 0.15 to 0.35 | 0.20 | 0.15 | 0.08 to 0.30 |
| Tritan, SAN, PC, melamine | 0.30 | 0.25 | 0.18 to 0.40 | 0.22 | 0.16 | 0.10 to 0.30 |
| Wood (beech, bamboo) | 0.40 | 0.30 | 0.25 to 0.55 | 0.30 | 0.25 | 0.20 to 0.45 |
| Silicone rubber | 0.80 | 0.70 | 0.50 to 1.20 | 0.50 | 0.40 | 0.30 to 0.80 |

Anchors: ceramic mug on laminate 0.21 and on stainless 0.16; ceramic plate 0.22 to 0.35; glass items 0.10 to 0.31; steel utensil and pots 0.11 to 0.24; plastic container and spatula 0.29 to 0.33; plastic bottle 0.20 to 0.32; wooden brush 0.25 to 0.57; non-stick pan 0.07 to 0.14 (all Matheus and Dollar, V); nylon-nylon 0.15 to 0.25, nylon-steel 0.4, PE-steel 0.2, PTFE-steel 0.05 to 0.2 (Engineering Toolbox, V); PA11 on steel 0.2 to 0.35 (V, se).

### 11.2 Friction: item against item

| Pair | Loading: mu_k (engine value) | Range | Wash: mu_k | Range | Anchor |
|---|---|---|---|---|---|
| Glaze - glaze | 0.22 | 0.15 to 0.35 | 0.13 | 0.08 to 0.25 | no direct data; glass-like surfaces |
| Unglazed foot - glaze | 0.40 | 0.30 to 0.60 | 0.30 | 0.20 to 0.50 | rough bisque; no direct data |
| Glass - glass | 0.20 | 0.10 to 0.60 | 0.10 | 0.09 to 0.30 | handbook: clean dry 0.9 to 1.0 static / 0.4 kinetic; greasy 0.1 to 0.6 / 0.09 to 0.12 (V). Real tableware is never "clean" in the handbook sense until after the wash |
| Glass - ceramic | 0.20 | 0.12 to 0.30 | 0.12 | 0.08 to 0.25 | ceramic mug on glass 0.217 (V) |
| Steel - ceramic | 0.16 | 0.10 to 0.25 | 0.11 | 0.07 to 0.20 | ceramic mug on stainless 0.162; steel utensil on granite 0.124 (V) |
| Steel - glass | 0.16 | 0.10 to 0.30 | 0.11 | 0.07 to 0.25 | steel can on glass 0.158 (V); handbook greasy glass-metal 0.2 to 0.3 (V) |
| Steel - steel (cutlery in basket) | 0.25 | 0.15 to 0.60 | 0.15 | 0.10 to 0.30 | handbook dry 0.5 to 0.8 / 0.42 kinetic, greasy 0.16 (V); steel can on stainless 0.170 (V) |
| Plastic - ceramic / glass / steel | 0.25 | 0.15 to 0.35 | 0.15 | 0.08 to 0.30 | plastic bottle on glass 0.255, on stainless 0.304; container on hard surfaces 0.29 to 0.33 (V) |
| Plastic - plastic | 0.22 | 0.15 to 0.50 | 0.14 | 0.08 to 0.30 | PE-PE 0.2, nylon-nylon 0.15 to 0.25, PS-PS 0.5 (V) |
| Wood - hard surface | 0.30 | 0.20 to 0.55 | 0.25 | 0.20 to 0.45 | wooden brush 0.25 to 0.57 (V); wood-metal wet 0.2 (V) |
| Silicone - anything | 0.70 | 0.50 to 1.20 | 0.40 | 0.30 to 0.80 | rubber-based stapler 0.55 to 0.75 (V) |
| PTFE-coated - anything | 0.10 | 0.05 to 0.20 | 0.08 | 0.04 to 0.18 | non-stick pan 0.07 to 0.14 (V) |

After the wash and dry, glass and glaze surfaces are genuinely clean and their friction rises toward handbook values (the familiar "squeaky clean" effect). This matters only for unloading, which is not modelled.

### 11.3 Restitution, rolling, spinning

| Parameter | Default | Range | Reference |
|---|---|---|---|
| Restitution, item on coated wire | 0.25 ceramic, 0.30 glass and steel, 0.35 plastic | 0.10 to 0.50 | Section 3.5 |
| Restitution, item on item | 0.50 ceramic, 0.60 glass, 0.45 steel, 0.40 wood/silicone | 0.30 to 0.90 | Section 3.5 |
| Restitution velocity threshold | 0.1 m/s | 0.05 to 0.3 | |
| Rolling resistance length `c_rr` | 2e-4 m on coated wire; 5e-5 m hard on hard | 1e-4 to 5e-4 | Section 3.6 |
| Torsional (spin) friction length `c_sp` | 1.5e-3 m | 0.5e-3 to 3e-3 | Section 3.6 |

If simplicity is preferred for the first build: one restitution of 0.2 everywhere and friction from the tables. Settling is insensitive to restitution below about 0.4; resting poses are sensitive to friction.

### 11.4 Rigid-body solver settings (summary of Section 5)

| Setting | Value |
|---|---|
| Time step | fixed 1.0 ms |
| Gravity | 9.81 m/s2 |
| Prediction / speculative distance | 2 mm |
| Penetration slop | 0.1 to 0.2 mm |
| Max depenetration velocity | 0.5 m/s |
| Solver | sub-stepped soft-contact Gauss-Seidel with warm starting, 8 to 12 iterations; or MuJoCo Newton with elliptic cones, `impratio` 10 to 100, `solref` (0.002, 1), `solimp` width 2e-4 |
| Friction | per-contact Coulomb, pair table, kinetic values |
| CCD | on for walls under 3 mm, cutlery, lids, chopsticks |
| Sleep | linear below 3 mm/s and angular below 0.03 rad/s for 0.5 s; wake on contact or applied force |
| Minimum body mass / inertia clamp | 5 g; smallest principal inertia at least 1/50 of the largest |
| Settle budget per action | 2 s, extended in 0.5 s blocks to at most 10 s |
| Acceptance tests | perturbation test (10 mm/s kicks), rack-slide pulse, arm-sweep check |

---

## 12. Evidence on the architecture candidates (from the items perspective)

| Observation from this dossier | Bearing on (a) hybrid multi-scale | Bearing on (b) fully resolved free-surface | Bearing on (c) mixture |
|---|---|---|---|
| Jets are coherent, straight, about 2 mm in diameter (V) while the wash volume is about 5 L (V). Resolving a 2 mm jet with 4 particles/cells across needs 0.5 mm spacing: 5e-3 m3 / (0.5 mm)^3 = 4e10 particles [ESTIMATED]. At an affordable 2 mm spacing (6e8 particles for 5 L, still very large) a jet is one particle wide | For: Lagrangian jet parcels carry the correct momentum flux at any resolution | Against: jets cannot be resolved as jets tub-wide; they would have to be injected as sub-grid momentum sources, which is architecture (a) in disguise | A resolved solver is plausible only locally (pool inside a flipped container, sump) |
| Load geometry is thin: walls 1 to 5 mm, wires about 4 to 5 mm, plate-to-plate gaps about 20 mm (V) | For: parcels and films are traced against exact analytic SDFs (shell of revolution, capsules) with no resolution limit | Against: boundary handling must be two-sided and leak-proof for walls thinner than the particle spacing; wires are sub-grid | Same analytic SDFs serve both |
| Rack wires are wider than the jets | For: a capsule either blocks a 2 mm jet or not; exact shadowing by tines is cheap | Against: needs sub-grid wire drag/blocking models | - |
| Whether a specific jet hits a specific plate depends on nozzle radius, angle and plate position at the centimetre scale (thesis: 2 of 10 jets hit the left plate, 5 the right; per-pass contact 0 to 27 ms) (V) | For: per-item, per-surface-element impact statistics over a revolution are exactly what time-homogenisation needs, and they are deterministic geometry | For in principle; against in cost: many revolutions needed to converge per-element statistics | - |
| Light items move or flip under single jet passes (Section 4); events are rare, discrete, and change the geometry | Neutral: needs an event-driven rigid-body re-solve and re-tracing of spray statistics for affected items; the set of jet-mobile items is small and known at load time | For: two-way coupling is natural; against: a flip that happens at minute 12 is missed if only a few revolutions are simulated | Favoured: (a) for the cycle, rigid-body episodes on demand |
| Flipped containers and foot recesses hold pooled water (0.4 to 1 L, or 5 to 20 ml) | Needs a pooling model on concave regions (films sibling) fed by the capture flux | Natural | A local resolved or shallow-water solve per pool is a good use of (b)-style methods |
| Rigid-body loading costs almost nothing (about 100 bodies, up to 1e4 simple shapes, 1 kHz) | No conflict with the 30-minute budget | Same | Same |
| A manufacturer wants to vary tine pitch, wire diameter, arm nozzle layout | For: all are parameters of analytic geometry; re-tracing is fast, so design sweeps are feasible | Against: each design point is a full fluid run | - |

Net assessment from the items side: the geometry strongly favours (a), with (b)-style local solvers reserved for pools, i.e. (c). Whatever is chosen, the single shared analytic geometry (profiles + capsules) should be the source for rendering, rigid-body contact and fluid boundaries.

---

## 13. Recommended model and defaults

Exactly what I would implement.

**Data**

1. Item records in the schema of Section 9; start from the 98-row catalogue of Section 10 and the profiles of 10.2. Keep the per-field provenance tags.
2. A generator that turns a record into: render mesh; collision compound (rounded quads at chord error 0.5 mm, capsules for handles/wires, boxes for slabs and box-shells); analytic SDF description for the GPU; surface-element atlas at about 2 mm with region labels; mass, COM and inertia from the thin-shell integrals of Section 2.3 unless a measured value is supplied.
3. Material table with densities (3.1) and the friction/restitution pair tables (11.1 to 11.3), each in "loading" and "wash" states.

**Rigid-body loading simulation**

4. Engine: an impulse/soft-constraint engine with compound shapes, rounded convex pieces, capsules, per-contact friction, CCD and documented determinism. Rapier fits a Rust/wgpu stack directly (deterministic, including a cross-platform mode; `Coulomb` friction model; round convex shapes; `soft_ccd_prediction`). Jolt is the C++ equivalent (override every default tolerance). MuJoCo is a sound alternative when maximum solver accuracy matters more than raw speed (Newton solver, native capsules, rolling/torsional friction built in) with `solref` tightened as in 11.4. PhysX SDF collision is not an option on Apple Silicon.
5. Rack and machine interior as static capsule/box compounds; spray arms as kinematic bodies.
6. Settings of Section 11.4. Fixed 1 ms step; every action advances a fixed number of steps.
7. Interaction primitives `select`, `place(drop | insert)`, `reset`, `check`, `start_wash` (Section 8), identical for mouse and API, inputs quantised to 1 mm and 1 degree.
8. Status after every action: settled poses, contact graph, stability (perturbation test), displaced items, fell-through, arm-blocked, rack-slide-blocked, dispenser-blocked, heater contact.
9. Before the wash: rack-slide pulse and door-close settle; then freeze all items with `Pi_J,max < 0.25` (Section 4.6).

**Wash-time coupling**

10. Jet-mobile candidates (all plastics and lids, glasses, cups, stemware, loose cutlery lying flat, chopsticks, teats) remain dynamic and asleep. The jet model supplies per-pass force and torque with `F = rho A_j v^2 (1 - cos(theta_turn))`; friction switches to the "wash" table; contained water adds weight; buoyancy applies in pools. Wake, integrate, re-settle; on pose change beyond 2 mm or 2 degrees, invalidate and recompute spray statistics for the affected items.
11. Report displacement events and their consequences (filled container, blocked arm, item on heater).

**Phase 2**

12. Replace item-versus-wire contact with the analytic capsule-versus-shell-of-revolution narrow phase of Section 5.4; validate against high-speed video of plates and glasses dropped onto a real rack.

**Default constants (quick reference)**

| Constant | Default |
|---|---|
| Rigid-body dt | 1.0 ms |
| Chord error for sectors | 0.5 mm |
| Friction, typical hard item on coated wire, loading / wash | 0.25 / 0.15 |
| Restitution on wire / item-item | 0.25 to 0.35 / 0.45 to 0.60 |
| Rolling / spin lengths | 2e-4 m / 1.5e-3 m |
| Drop release height | at most 10 mm above first contact |
| Insert force limit / speed | 15 N / 0.1 m/s |
| Jet-mobile screening threshold | `Pi_J,max = c_turn J_max / W >= 0.25` |
| Reference jet for screening | d = 2 mm, v = 7.7 m/s, J = 0.19 N; conservative upper case J = 0.75 N |
| Concave turning factor | 2.0 |
| Mean tub flux for fill estimates | 2.1 mm/s (32 L/min over 0.25 m2) |
| Porcelain / glass / PP densities | 2400 / 2500 / 905 kg/m3 |

---

## 14. Calibration parameters

What real-world tests should measure, with expected ranges. Ordered by impact on results.

| # | Parameter | Expected range | Suggested measurement | Why it matters |
|---|---|---|---|---|
| 1 | Friction of each item material on the actual coated rack wire: dry, wet, wet with detergent, at 20 and 60 C | 0.08 to 0.45 for hard materials; 0.3 to 1.2 for silicone | Tilting-rack or pulled-sled test (ASTM D1894 style) with real items on real rack sections | Decides which leaning arrangements hold and when wet items slide under jets. No public data exists |
| 2 | Item-item friction, wet with detergent (glass-glass, glaze-glaze, steel-steel) | 0.08 to 0.30 | Same, item on item | Stack stability; cutlery nesting |
| 3 | Momentum flux per nozzle for each machine and program phase | 0.05 to 0.8 N | Small plate on a load cell above each nozzle; or flow per nozzle and exit speed | Sets every jet-mobility prediction (and much of the soil-removal model; jets sibling) |
| 4 | Turning factor for concave items | 1.0 to 2.0 | Load cell under an inverted cup versus a flat plate at the same nozzle | Doubles or halves the mobility of cups and tubs |
| 5 | Flip/displacement statistics for standard light items (PP lid 20 g, PP cup 40 g, 0.6 L tub 50 g, teat, chopstick) by rack position | Per-cycle flip probability 0 to 1; strongly position-dependent | Window-door machine or in-tub camera; 20+ cycles per position | Direct validation of Section 4; the most visible realism test for players |
| 6 | Fill time / capture efficiency of upturned containers by position | eta 0.1 to 1.0; fill 0.5 to 5 min | Stop the cycle at intervals and weigh | Carry-over and "came out full of dirty water" outcomes |
| 7 | Mass, COM and inertia of every catalogue item | corrections of 10 to 25% on estimated rows | Scale; knife-edge balance for COM; bifilar pendulum for inertia (or CAD from scans) | Replaces 36 estimated masses |
| 8 | Wall-thickness profiles | within 0.5 mm of the fitted values | Calipers at rim, ultrasonic gauge, or CT/3D scan | Geometry for collision and for the water model |
| 9 | Rack geometry: wire diameters, coating thickness, tine pitch, height, rake; arm sweep heights | wire outer diameter 3.5 to 6 mm; pitch 20 to 40 mm | Calipers / scan of each supported machine | Slot fit is millimetre-sensitive |
| 10 | Effective restitution of items on the rack and on each other | 0.1 to 0.5 on rack; 0.3 to 0.9 item-item | Drop tests from 10 to 100 mm with high-speed video | Settle time and bounce-out of light items |
| 11 | Rolling resistance of glasses and plates on wires | `c_rr` 1e-4 to 5e-4 m | Roll-down on an inclined rack section; measure the stall angle | Glasses creeping along tines |
| 12 | Rack slide-in and door-close acceleration profile | 1 to 3 m/s2 sustained; 5 to 10 m/s2 stop pulse for 30 to 50 ms | Accelerometer on the rack | Pre-wash shift test |
| 13 | Water retained in foot rings and base recesses after the final drain | 2 to 25 ml per item | Weigh before/after | Drying score; cross-check for the films model |
| 14 | Change of friction with soil (greasy or sugary plates) during loading | 0.1 to 0.6 | Sled test with standard soils applied | Loading realism for dirty stacks |
| 15 | Solver perturbation-test magnitudes | design choice: 5 to 20 mm/s | Tune so that poses humans judge stable pass and precarious ones fail | Fairness of the "stable" flag |

Not a calibration item but a decision needed from the maintainers: whether "not dishwasher-safe" items (wooden boards and spoons, cast iron, sharp knives, crystal, non-stick) carry a damage penalty. The catalogue flags them; the damage physics belongs to the chemistry sibling.

---

## 15. Sources

"(page)" = opened and read this session. "(se)" = values seen only as extracts quoted in search results; the page itself was not opened.

### Standards, test loads, regulation

- S1. AHAM DW-2-2020, Household Electric Dishwashers, Section 3.4 Tables 1 and 2 (place setting and serving pieces), Section 5 soils. https://law.resource.org/pub/us/cfr/ibr/inc/ansi/aham.dw-2.2020.pdf (page)
- S2. 10 CFR Part 430 Subpart B Appendix C2, test load table. https://www.customsmobile.com/regulations/title10_chapterII_part430_subpartB_appendixAppendixC2 (page)
- S3. IEC 60436:2025 Ed.5 preview (table of contents only). https://www.technickenormy.cz/publicdoc/iec_previews/4204007.pdf (page)
- S4. IEC webstore summaries of IEC 60436 Ed.4 and Ed.5 changes. https://webstore.iec.ch/en/publication/67116 ; https://webstore.iec.ch/en/publication/23625 ; https://genorma.com/en/standards/iec-60436-2025-ed5/amp (se)
- S5. Australian energy-rating factsheet "Sources of Test Materials" (WFK load item list: Arzberg 8500/1382, Schott Duran beaker). https://energyrating.gov.au/sites/default/files/2022-12/Test-materials-2019-06_V2.docx (se; direct fetch timed out)
- S6. V-ZUG, Note for testing institutes, AS/NZS 2007 load plans, 14 and 15 place settings. https://www.vzug.com/medias/sys_master/root/heb/h7c/10944809992222/1259434-Hinweis-f-r-Pr-finstitute-Produktfamilie-41145-41147-41149-41180-Norm-AUNZS-2007-und-ASNZS-6400.pdf (page). Also Miele comparison-test leaflet (EN/IEC 60436, 13 place settings, includes pots): https://media.miele.com/downloads/1b/6f/00_C7F128283AF01FD0B1D56AB7CE651B6F.pdf (page)
- S7. DRS 562:2023, Tableware - Melamine tableware - Specification (Rwanda draft standard; cites IS 9220:1979), Tables 1 and 2, clauses 4.3 to 4.6. https://www.rsb.gov.rw/fileadmin/user_upload/DRS_562_2023.pdf (page)

### Friction, restitution, materials

- S8. K. Matheus, A. M. Dollar, "Benchmarking Grasping and Manipulation: Properties of the Objects of Daily Living", IEEE/RSJ IROS 2010, Tables II and III. https://www.eng.yale.edu/grablab/pubs/Matheus_IROS2010.pdf (page)
- S9. Engineering Toolbox, friction coefficients. https://www.engineeringtoolbox.com/friction-coefficients-d_778.html (page)
- S10. Engineering Toolbox, densities of solids. https://www.engineeringtoolbox.com/density-solids-d_1265.html (page)
- S11. Arkema, TDS Rilsan PA11 T Silver 7537. https://hpp.arkema.com/assets/arkema/TDS_RILSAN® PA11 T SILVER 7537_en_WW.pdf (page). T Silver 7556 (dishwasher basket grade) and wire-goods page: https://hpp.arkema.com/en/markets-and-applications/powder-metal-coatings/wire-goods (se)
- S12. Chempoint, Rilsan fluidized-bed coatings. https://www.chempoint.com/insights/rilsan-coatings-fluidized-bed ; Rilsan 1482 White FB: https://www.chempoint.com/products/arkema/rilsan/rilsan-fine-powders/rilsan-1482-white-fb ; PA11 friction values: https://www.weerg.com/guides/coefficient-of-friction ; https://www.goodfellow.com/uk/nylon-11-rod-group ; https://designerdata.nl/materials/plastics/thermo-plastics/polyamide-11 (se)
- S13. C. S. Sandeep, L. Luo, K. Senetakis, "Effect of Grain Size and Surface Roughness on the Normal Coefficient of Restitution of Single Grains", Materials 13(4):814, 2020, Table 2. https://pmc.ncbi.nlm.nih.gov/articles/PMC7079616/ (page)
- S14. Stanford Advanced Materials, coefficient of restitution table. https://www.samaterials.com/content/coefficient-of-restitution.html ; Proc. Estonian Acad. Sci. Eng. 1998 (glass spheres on ceramic and steel targets). https://kirj.ee/wp-content/plugins/kirj/pub/eng-1-1998-18-25_20230201185556.pdf (se)

### Jets and displacement

- S15. R. Perez-Mohedano, "Cleaning principles in automatic dishwashers", EngD thesis, University of Birmingham, 2016, Tables 3.1, 4.1, 4.2, 5.7, 5.8. https://etheses.bham.ac.uk/id/eprint/6590/ (page; PDF text extracted)
- S16. Perez-Mohedano et al., "Positron Emission Particle Tracking (PEPT) for the analysis of water motion in a domestic dishwasher", Chem. Eng. J. 259 (2015) 724-736, abstract. https://research.birmingham.ac.uk/en/publications/positron-emission-particle-tracking-pept-for-the-analysis-of-wate ; IChemE blog: https://www.icheme.org/knowledge-networks/blog/how-to-best-load-a-dishwasher-by-a-chemical-engineer-day-243/ ; Reviewed: https://www.reviewed.com/dishwashers/news/scientists-conclude-we-dont-load-dishwashers-correctly (se)
- S17. University of Louisville thesis on dishwasher hydraulics (flow rates). https://ir.library.louisville.edu/etd/474 (se)
- S18. US 5,102,225 utensil bag: https://patents.google.com/patent/US5102225 ; Insignia troubleshooting: https://techfaultfix.com/dishwashers/insignia/plastic-items-and-light-dishes-flip-over-or-move-around-during-the-cycle ; Molly Maid: https://mollymaid.ca/?p=3272 ; Whirlpool: https://www.whirlpool.com/blog/kitchen/proper-way-to-load-a-dishwasher.html and https://producthelp.whirlpool.com/Dishwashers/Product_Info/Dishwasher_Tips_and_Tricks/Properly_Loading_a_Dishwasher ; Whirlpool manual mirror: https://manualsdump.com/en/manuals/whirlpool-960model/81471/7 ; Beko: https://www.beko.co.uk/support/faqs/dishwashers/how-to-load-a-dishwasher ; GE Profile UDT165 manual: https://www.manualslib.com/manual/3698788/Ge-Profile-Udt165-Series.html ; Winterhalter: https://www.winterhalter.com/uk-en/latest-news/news-details/say-goodbye-to-the-difficulty-of-cleaning-plastic-bowls-thanks-to-winterhalter/ ; Miele Professional: https://m.miele.de/media/ex/ce/presseartikel/2024/2024-011--miele-offers-special-solutions-for-washing-and-drying-reusable-crockery.pdf (all se)

### Physics engines and collision geometry

- S19. Rapier user guides: integration parameters, determinism, colliders, rigid bodies. https://rapier.rs/docs/user_guides/rust/integration_parameters ; https://rapier.rs/docs/user_guides/rust/determinism ; https://rapier.rs/docs/user_guides/rust/colliders ; https://rapier.rs/docs/user_guides/rust/rigid_bodies (page)
- S20. Jolt Physics architecture documentation and `PhysicsSettings.h`. https://jrouwe.github.io/JoltPhysics/ ; https://raw.githubusercontent.com/jrouwe/JoltPhysics/master/Jolt/Physics/PhysicsSettings.h (page)
- S21. MuJoCo documentation: Computation, Modeling. https://mujoco.readthedocs.io/en/stable/computation/index.html ; https://mujoco.readthedocs.io/en/stable/modeling.html (page). Default geom friction from a source mirror: https://huggingface.co/datasets/introvoyz041/mujoco/blob/main/data/src/user/user_init.c (se)
- S22. Bullet `btCollisionMargin.h`. https://www.staff.city.ac.uk/~andrey/INM377/bullet-2.82-html/html/btCollisionMargin_8h.html (se)
- S23. NVIDIA PhysX 5.4.1 Rigid Body Collision; Omniverse Collision Behavior Guide. https://nvidia-omniverse.github.io/PhysX/physx/5.4.1/docs/RigidBodyCollision.html ; https://docs.omniverse.nvidia.com/kit/docs/omni_physics/108.0/dev_guide/guides/collision_guide.html (page)
- S24. Drake hydroelastic contact user guide. https://drake.mit.edu/doxygen_cxx/group__hydroelastic__user__guide.html (page)
- S25. E. Catto, "Solver2D" (Box2D blog, 2024). https://box2d.org/posts/2024/02/solver2d/ (page)
- S26. CoACD: https://github.com/sarahweiii/CoACD ; OmniGibson custom-object import: https://behavior.stanford.edu/reference/examples/objects/import_custom_object.html ; obj2mjcf: https://pypi.org/project/obj2mjcf/0.0.17 (se)

### Robotics simulation and dishwasher loading

- S27. M. Torne et al., "Reconciling Reality through Simulation: A Real-to-Sim-to-Real Approach for Robust Manipulation" (RialTo), Sec. VIII-A. https://arxiv.org/abs/2403.03949 (page)
- S28. "Embedded IPC: Fast and Intersection-free Simulation in Reduced Subspace for Robot Manipulation", Sec. IV-B. https://arxiv.org/abs/2409.16385 (page)
- S29. BEHAVIOR-1K: https://arxiv.org/abs/2403.09227 (page); BEHAVIOR (2021): https://arxiv.org/pdf/2108.03332 (se); task page: https://behavior.stanford.edu/knowledgebase/tasks/loading_the_dishwasher-0.html (se)
- S30. RoboCasa: https://arxiv.org/pdf/2406.02523 ; RoboCasa365 in LeRobot docs: https://huggingface.co/docs/lerobot/robocasa.md (se)
- S31. GNN manipulation with a Habitat dishwasher environment: https://arxiv.org/pdf/2102.13177 (se); R+X: https://arxiv.org/pdf/2407.12957 (se); Jiang, Zheng, Lim, Saxena, "Learning to Place New Objects": https://arxiv.org/abs/1105.3107 (page, abstract); Cornell CS4758 project "Learn to Load the Dishwasher": https://cs.cornell.edu/courses/cs4758/2011sp/final%20project/zheng.pdf (se); Bogazici thesis: https://digitalarchive.library.bogazici.edu.tr/items/cd82410c-e643-4c4b-b4a8-4dba445b68a6/full (se); Voysey, Thuruthel, Iida: https://www.repository.cam.ac.uk/handle/1810/322986 (se); TRI: https://pressroom.toyota.com/tri-taking-on-the-hard-problems-in-manipulation-research-toward-making-human-assist-roberts-reliable-and-robust/ (se); Figure: https://figure.ai/news/helix-loads-the-dishwasher (se); WARA: https://wara-robotics.aass.oru.se/wara-challenge (se); dexsuite: https://dexsuite.readthedocs.io/en/latest/catalog/environment/pick_place_mug.html (se)

### Games and patents

- S32. Dishwasher (Beaver Games): https://www.crazygames.com/game/dishwasher (page); Tetris: Fully Loaded: https://www.marketing-beat.co.uk/?p=80313 ; Tetris article: https://tetris.com/article/73/organize-your-dishwasher-using-tetris ; Bosch game coverage: https://digitaltrends.com/?p=797694 ; Dishpig: https://ajunkalagames.itch.io/dishpig ; Neverwash: https://icutter.itch.io/neverwash ; Less Dishes is More: https://projectpaddy.itch.io/less-dishes-are-more-dishes ; Dishwashing Simulator: https://gg.deals/game/dishwashing-simulator/ (se)
- S33. US 11,439,292: https://patents.google.com/patent/US11439292 ; US 11,120,594: https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11120594 ; US 5,351,837: https://patents.google.com/patent/US5351837 ; US 8,540,085: https://patents.google.com/patent/US8540085 ; US 8,646,620: https://patents.google.com/patent/US8646620 ; US 11,612,300: https://patents.google.com/patent/US11612300 ; EP 3123918: https://data.epo.org/gpi/EP3123918A1 ; US 6,571,965: https://patents.google.com/patent/US6571965 ; US 10,694,921: https://patents.google.com/patent/US10694921 (se)

### Product data (all se: retailer or manufacturer listings quoted in search results)

- P1. IKEA 365+: plate https://www.ikea.com/cz/en/p/ikea-365-plate-white-70258949/ ; bowl https://www.ikea.com/cz/en/p/ikea-365-bowl-rounded-sides-white-20278351/ ; mug https://www.ikea.com/sg/en/p/ikea-365-mug-white-00282943/ ; glass mug https://www.ikea.com/ae/en/p/ikea-365-mug-clear-glass-10279723/ ; deep plate https://ikea.lv/en/products/eating/dining-and-serving/serving/ikea-365-deep-plate-bowl-art-90279700
- P2. Corelle listings (domain looked like a reseller mirror; treat as retailer data): https://www.corelleus.it.com/products/corelle-winter-frost-white-10-25-dinner-plate ; https://www.corelleus.it.com/products/corelle-winter-frost-white-18-ounce-cereal-bowls-6-pack ; https://www.corelleus.it.com/products/corelle-city-block-18-ounce-cereal-bowl ; https://www.acehardware.com/departments/home-and-decor/kitchen-utensils-and-gadgets/tableware/61079
- P3. Arzberg 1382 soup plate 23 cm: https://www.galaxus.ch/en/s2/product/arzberg-shape-1382-blue-flowers-23-cm-plates-12380543
- P4. Maxwell and Williams White Basics 23 cm pasta bowl: https://www.ebay.de/p/1005308351
- P5. BIA Cordon Bleu 6 oz ramekin: https://www.everythingkitchens.com/bia-cordon-bleu-6-oz-ramekin-stockholm.html
- P6. Loveramics 80 ml espresso cup: https://www.galaxus.ch/en/s2/product/loveramics-espresso-cup-80-ml-cups-17317537
- P7. Duralex Picardie: https://www.tingstad.com/se-en/table-setting/glassware/water--drinking-glasses/duralex-picardie-tumbler-25cl-dura1140c ; https://www.ggmgastro.com/en-de-eur/12-pcs-duralex-tumbler-picardie-310-ml-clear-dugpdw31t-12 ; https://eightouncecoffee.ca/products/duralex-le-picardie%C2%AE-glass-tumbler-360ml-12-2oz-6-pack
- P8. Libbey 551HT: https://bramainc.com/products/libbey-551ht-iced-tea-glass-12-1-2-oz-safedger-rim-guarantee-heat-treated-straight-sided ; https://restaurantsupply.com/libbey-551ht-12-1-2-oz-straight-sided-heat-treated-iced-tea-glass-with-safedge-rim
- P9. Libbey 1639HT: https://www.gofoodservice.com/p/libbey-1639ht ; https://www.restaurantsupply.com/libbey-1639ht-16-oz-restaurant-basics-heat-treated-duratuff-mixing-glass
- P10. Zwiesel Pure Cabernet: https://www.galaxus.nl/en/s2/product/zwiesel-pure-54-cl-1-glass-red-wine-glasses-wine-glass-22177117 ; https://vinumdesign.com/en/products/pure-cabernet-wine-glass-schott-zwiesel ; Riedel Vinum Bordeaux Grand Cru: https://riedel.com/en-us/shop/vinum/bordeaux-grand-cru-641600000
- P11. Flutes: https://www.ggmgastro.com/en-nl-eur/6-pieces-wmf-smart-champagne-flute-07-170-ml-58-0020-0107 ; https://www.esmeyer-shop.de/en/champagne-flute-elegance-volume-017-litre-height-175-mm-diameter-55-mm ; https://www.drinkstuff.com/products/ehint.asp?ID=15804
- P12. Pyrex: https://pyrexhome.com/products/pyrex-2-cup-measuring-cup ; https://www.everythingkitchens.com/pyrex-prepware-2-cup-measuring-cup.html ; https://pyrexhome.com/products/pyrex-4-quart-mixing-bowl ; https://www.shopabunda.com/products/pyrex-basics-3-quart-glass-oblong-baking-dish-clear-8-9-inch-x-13-2-inch-3-qt ; https://pyrexhome.com/products/pyrex-easy-grab-3-quart-glass-baking-dish-with-blue-lid
- P13. Cutlery: IKEA DRAGON https://www.ikea.com/my/en/cat/dragon-series-14886/ ; https://petrohub.borong.com/product/ikea-dragon-18-piece-cutlery-set-stainless-steel/173016 ; WMF Signum https://shop.boelter.com/tabletop-serving/silverware/bauscher-flatware/signum/bauscher-12-1902-6040-signum-8-1-4-table-fork-18-10-stainless-steel.html ; https://www.ggmgastro.com/en-de-eur/12-pieces-wmf-signum-starter-dessert-fork-18-10-stainless-steel-mirror-polished-185-mm-length-12-1905-6040 ; https://www.ggmgastro.com/en-gb-gbp/12-pieces-wmf-signum-cake-fork-18-10-stainless-steel-mirror-polished-156-mm-length-12-1964-6040 ; Walco https://www.walcostainless.com/products/hallmark-flatware/18-10/index.php?id=639 ; dinner knife https://www.webstaurantstore.com/abert-enrico-viii-9-case/552FP536.html ; serving spoon https://www.webstaurantstore.com/bon-chef-s4104-como-8-1-2-18-10-extra-heavy-weight-stainless-steel-table-serving-spoon-case/201S4104.html
- P14. Victorinox Fibrox Pro 8 in: https://cutleryandmore.com/products/victorinox-fibrox-chefs-knife-42192 ; https://drop.com/buy/victorinox-fibrox-8-inch-chefs-knife ; https://www.katom.com/037-40520.html
- P15. Tools: tongs https://www.everythingkitchens.com/oxo-good-grips-stainless-steel-tongs-silicone-heads-12-inch-1101980.html ; whisk https://www.americastestkitchen.com/equipment_reviews/1370-all-purpose-whisks and https://www.canadiantire.ca/en/pdp/oxo-gg-whisk-balloon-2420806p.2420806.html ; peeler https://www.advantage-catering-equipment.co.uk/products/oxo-swivel-peeler ; grater https://www.webstaurant.com/oxo-1057961-good-grips-11-13-16-4-sided-stainless-steel-box-grater-with-non-slip-handle/2971057961.html and https://www.galaxus.nl/en/s2/product/oxo-box-grater-graters-13408099 ; colander https://www.target.com/p/-/A-14039350 and https://webstaurant.com/oxo-1134700-good-grips-5-qt-stainless-steel-colander-with-handles/2971134700.html ; ladle https://webstaurant.com/oxo-good-grips-6-oz-one-piece-stainless-steel-ladle-with-two-pour-spouts-and-black-handle-11283400/29711283400.html ; turner https://www.target.com/p/-/A-13567820 ; wooden spoon https://www.webstaurantstore.com/12-beechwood-wooden-spoon/40712WOOD.html and https://www.katom.com/158-744562.html
- P16. Boards: https://www.ikea.cn/cn/en/p/legitim-chopping-board-white-30202266/ ; https://mgmt.ikea.gr/en/products/proppmatt-chopping-board/70233421 ; https://www.dimensions.com/element/ikea-proppmatt-chopping-board-large ; https://www.johnlewis.com/oxo-good-grips-large-plastic-utility-cutting-board-white/p4837200
- P17. Vollrath bowls: https://www.katom.com/175-69040.html ; https://www.katom.com/175-47934.html
- P18. All-Clad D3: https://cutleryandmore.com/collections/all-products/products/all-clad-d3-stainless-fry-pan-lid-31819 ; https://cutleryandmore.com/products/all-clad-d3-stainless-saucepan-21252 ; aluminium non-stick 28 cm pan: https://www.advantage-catering-equipment.co.uk/products/nisbets-essentials-aluminium-non-stick-teflon-frying-pan-28cm
- P19. Lodge: https://chefsupplies.ca/products/lodge-10-25-cast-iron-skillet ; https://www.chefsupplies.ca/products/lodge-12-cast-iron-skillet ; https://www.rei.com/product/714250
- P20. Cuisinart 8 qt stockpot: https://www.lowes.com/pd/Cuisinart-Chef-s-Classic-8-Quart-Stainless-Steel-Stock-Pot-Lid-s-Included/50377218 ; https://www.desertcart.ma/products/5360407
- P21. Le Creuset 32 cm stoneware dish: https://www.knivesandtools.com/en/pt/-le-creuset-rectangular-oven-dish-385-l-32-cm-green.htm
- P22. Bakeware: Nordic Ware half sheet https://walmart.com/ip/715076865 ; muffin pan https://www.heb.com/product-detail/nordic-ware-naturals-muffin-pan/15951730 and https://www.everythingkitchens.com/nordic-ware-muffin-pan-non-stick.html ; roasting pans https://www.americastestkitchen.com/equipment_reviews/1447 and https://www.katom.com/175-61250.html ; cooling racks https://webstaurant.com/vollrath-20248-super-pan-v-1-2-size-footed-cooling-rack-for-bun-sheet-pan/92220248.html and https://www.webstaurantstore.com/rack-cooling-stainless-st/627CRHALF.html
- P23. Containers: Sistema https://www.nisbets.ie/sistema-rectangle-klip-it-plus-food-storage-container-1ltr/ch245 and https://www.advantage-catering-equipment.co.uk/products/sistema-klip-it-plus-storage-containers-1ltr-pack-of-3 ; IKEA 365+ https://www.ikea.com/sg/en/p/ikea-365-food-container-with-lid-rectangular-plastic-s39269078/ ; PRUTA https://www.ikea.com/ma/en/p/pruta-food-container-with-lid-blue-10597103/ ; Rubbermaid TakeAlongs https://www.homehardware.ca/en/3-piece-take-along-rectangular-container-set/p/4423458
- P24. Bottles and jugs: Nalgene https://packhacker.com/travel-gear/nalgene/32-oz-wide-mouth-tritan-water-bottle and https://www.varusteleka.com/en/product/nalgene-wide-mouth-1-l-juomapullo/71589 ; Contigo https://www.decathlon.co.uk/p/mp/contigo-west-loop-autoseal-470ml-red-stainless-steel-travel-mug/7b77044d-f992-467d-94b0-532a3ac58180/c14 and https://www.macys.com/shop/product/contigo-west-loop-2.0-16-oz.-stainless-steel-travel-mug?ID=2361939 ; Philips Avent https://www.babyartikel.de/en/prod/philips-avent-pp-flasche-naturnah-260-ml-silikon-gr-2-scf03317 ; Vitamix https://www.vitamix.com/us/en_us/shop/accessories/low-profile-64-ounce-container
