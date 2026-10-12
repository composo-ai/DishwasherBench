# Spotless research notes: measuring the owner's Bosch SMV4HAX40G/13 from his photographs ("photos")

Author: photo-metrology specialist (one of four parallel researchers). Date: 2026-10-08.
Machine: Bosch Serie 4 SMV4HAX40G/13 (Type SD6PW1B, FD 0106), 60 cm fully integrated, 81.5 cm class. Programme of interest: Auto 45-65 (2:25).
Scope: a counted, measured, parametric reconstruction of the baskets, spray arms and tub floor of this exact appliance from the owner's five photographs, with uncertainties. Hydraulics, programme and thermal data are other researchers' angles; cross-links are in section 13.

## 0. How to read this file

### 0.1 Tags

| Tag | Meaning in this file |
|---|---|
| [VERIFIED] | Seen directly this session: either a count / presence / qualitative fact visible in a named owner photograph or fetched catalogue image, or a figure printed in fetched source text (source key given). |
| [ESTIMATED] | A length, angle or position that I derived: scaled from a photograph through a camera model and a reference dimension. The reference and the error are stated. Every metric number reconstructed from a photo is in this class, however carefully measured. |
| [RECALLED] | From memory, source not opened. Used only where flagged. |

Source keys [P80] to [P83] are the owner's photographs, [S1] to [S16] are in section 14.

### 0.2 Frames

- Machine frame (same as machine.md 0.3): origin on the lower spray arm axis, x to the right seen from the front, y from the door toward the back, z up. Units mm.
- Lower-basket frame (used for the two-view reconstruction): origin at the left rim joint of line B (the ball end of the third side upright from the back), X to the right, Y from back to front, "up" measured from the plane of the rim joints. Conversion to the machine frame with the basket pushed in is an assumption (basket centred on the arm axis): x = X - 254, y = 29 - Y. The lateral part is supported to +-10 mm (the arm axis sits at X = 248 in the pulled-out photos, sec. 6.1); the front-back part is not observable (the basket is pulled out in every photo) and must be measured.
- Upper-basket values are given relative to the upper-arm hub axis (assumed coaxial with the lower arm in plan, not observable).

### 0.3 The single most important caveat: absolute scale

No ruler is in any photograph. Every absolute length below hangs on one of four published reference dimensions (sec. 2.3). They agree with each other to about 2 %, so most lengths carry a floor of +-2 % (about +-10 mm on a basket width) before any pick error. Ratios, counts and pitches-as-fractions are much better than that. One phone photo with a ruler lying in each basket and beside each arm would remove this floor (sec. 12).

## 1. Evidence base

### 1.1 The owner's photographs

All taken 2026-10-08 with a phone's main camera (26 mm equivalent; the metadata was read before it was removed from the published files). Path: docs/reference/owner-photos/

| Key | File | Pixels | EXIF 35 mm-equivalent | Focal length used (px) | What it shows |
|---|---|---|---|---|---|
| [P79] | IMG_9079-rating-plate-and-control-panel.jpg | 4032 x 3024 | 52 mm | not used | rating plate, programme labels (not published: it shows the serial number) |
| [P80] | IMG_9080-front-view-lower-basket-pulled-out.jpg | 5712 x 4284 | 26 mm | 4290 | front view, lower basket out on the door, tub behind |
| [P81] | IMG_9081-lower-basket-from-above.jpg | 5712 x 4284 | 26 mm | 4290 | lower basket from above (taken 5 s after P80, basket not moved) |
| [P82] | IMG_9082-tub-floor-lower-spray-arm-and-filter.jpg | 5712 x 4284 | 35 mm (digital zoom 1.35) | 5775 | tub floor, lower arm, filter, salt cap |
| [P83] | IMG_9083-upper-basket-from-above.jpg | 5712 x 4284 | 35 mm (digital zoom 1.35) | 5775 | upper basket from above, upper arm through the grid |

Focal length in pixels = 5712 x (35 mm-equivalent) / 36. For P80 and P81 it was also fitted (sec. 2.1) and came out at 4340 +- 100 px, agreeing with the EXIF value 4290 [ESTIMATED].

### 1.2 Crops and tools

The crops and tools are working files, not in the repository; the pixel coordinates given in these notes are the durable record. Crops carry a grid labelled in full-resolution pixel coordinates (labels sit just right of / below their grid line). Files written this session start with P80_ to P83_ (region crops), Z80_ to Z83_ (zoom mosaics used to refine point picks) and REF_ (catalogue photos re-rendered). The earlier attempt's crops (9080_*, 9081_* and so on) were looked at only through its file list; none of its conclusions were reused except its rim-joint picks, which I re-checked and corrected (two of ten were off by 15 to 40 px).

| Crop | Used for |
|---|---|
| P81_b_R1_left/right, P81_c_R2_left/right, Z81_R1_tips_a, Z81_R2_tips_a, P81_c_R2_rightgroup_zoom, P81_b_R1_rightgroup_zoom | counting and locating the two rear tine rows from above |
| P80_a_rear_rows_left/right, Z80_R1_tips_a, Z80_R2_tips_a, P80_f_rear_left_detail, Z80_rails | the same rows from the front; rail and base welds |
| Z81_joints, Z81_joints_ZA, Z80_joints | rim joints used for the camera poses |
| P81_j_floor_leftcentre, P81_i_floor_grid, P80_j_floor_left, Z81_ML_FL_tips, P8x_n_right_rows | base grid, side tine rows |
| P81_g_left_rear/front, P81_g_right_rear/front, P80_e_left_upper/lower, P80_e_right_upper | side walls, wheels, chamfered corners, hinge bearings |
| P81_k_cutlery_top_small, P81_f_cutlery_top, P80_d_cutlery_front, Z81_cb, Z80_cb | cutlery basket |
| P83_whole_grid, P83_e_tines_left_rear/front, P83_f_tines_right_rear/front, P83_h_right_floor, P83_c_knife_rack, P83_d_cup_shelves, Z83_wires | upper basket |
| P82_b_arm_left/right, P82_c_hub, P82_a_arm_hub, P80_h_arm_left/right | lower spray arm |
| P83_a_arm_upperleft/lowerright, P83_b_feedtube, Z83_arm | upper spray arm and feed tube |
| P82_whole_grid_b, P82_d_filter, P82_f_left_wall/right_wall, P82_m_slots, P8x_m_slots, P80_g_tub_interior, P80_l_upper_region, P80_k_side_walls, P80_m_leftwall_disc | tub floor, walls, back wall |
| REF_sheet_lowerbasket_parts, REF_sheet_cutlery_lowerarm, REF_upper_arm_11010054_2_small, REF_upper_basket_20001992_a/b | Bosch catalogue photographs of the parts fitted to this E-Nr |

Scripts: photos/tools2/ (c.py crops, z.py zoom mosaics, geom.py + fitlow2.py + tv.py two-view fit and triangulation, sv.py single-view metrology, rows12.py, rails.py, rows_side.py, floor1.py, outline.py, cb.py, arm80.py, la1.py, tub82.py, slots.py, ub1.py, ub2.py, mesh.py). Raw picks: photos/work/obs_log.txt.

## 2. Method

### 2.1 Lower basket: two calibrated views

P80 (oblique front view) and P81 (near-vertical top view) show the same basket in the same position. The ball ends of five pairs of side uprights (rim joints, lines Z, A, B, C, D from back to front) are visible in both. Assuming only that the ten joints are coplanar, that left and right joints of a line share the same depth, and that the left-right joint distance is one unit W, I solved both camera poses and the four unknown line depths by least squares (16 unknowns, 40 observations).

- Fit quality: residuals at most 9 px (top view) and 11 px (front view); the residual is smallest at f = 4290 to 4400 px, which matches the EXIF focal length. So the basket really is a planar-rimmed, left-right symmetric frame and the cameras are well determined [ESTIMATED].
- Poses: top camera 1.059 W above the rim plane, tilted 3.7 deg from vertical; front camera 0.727 W above the rim plane, optical axis 51.6 deg from vertical [ESTIMATED].
- Any feature picked in both photos is then triangulated; the reprojection residual tells whether the two picks are the same physical point. Tine tips matched with residuals of 1 to 10 px.
- Features seen only as lines (rails, cross wires) were triangulated as a line in the front view against a point on the same line in the top view.

Everything from this step is in units of W. Internal precision: about 0.002 W (1 mm) in plan and 0.002 to 0.004 W (1 to 2 mm) in height for sharp features, 3 to 5 mm for rails and wires.

### 2.2 Tub floor (P82) and upper basket (P83): one calibrated view each

With the focal length known, two orthogonal vanishing points fix the camera orientation; a plane at a known distance then turns pixels into millimetres.

- P83: vanishing points from four front-back wires and two left-right wires of the upper basket; they came out orthogonal to 0.13 deg, camera tilted 12.8 deg from vertical. The distance to the upper-arm plane (741 mm) follows from the published arm span (460 mm). Checks: the feed tube then measures 270 to 296 mm (published 270 mm), the knife rack 116 mm wide (published 119 mm), the basket handle 203 mm (published 215 mm) [ESTIMATED].
- P82: vanishing points from the back-wall creases, the sump-cover edge and the feed duct; they are rougher (+-2 deg). Camera tilted 33.6 deg from vertical, 444 mm above the arm's top plane (from the 460 mm arm span). Checks: the arm's bearing stem appears where the model puts the mid-point of the arm (13 px, about 1 mm, off); the arm chord is rotated 12.4 deg from the tub's left-right axis in P82 and 11.8 deg in P80; the fine filter measures 262 mm wide (published 260 mm) [ESTIMATED]. Changing the vanishing points within their uncertainty moves nozzle positions along the arm by up to 8 mm near the hub and 1 mm at the tips.

### 2.3 Absolute scale: W = 508 +- 10 mm

| Reference (published) | Source | What it implies for W (rim-joint spacing of the lower basket) |
|---|---|---|
| Lower spray arm 00668148 span 460 mm (compatible part 463 mm) | [S5], [S6] | P80 looks at the arm under the basket. This gives a relation, not a value: W = 522, 512, 503, 495 mm if the arm's top face is 188, 195, 201, 208 mm below the basket's rim plane. A clearance of 15 to 40 mm under the basket floor wires (170 mm below the rim) means W = 495 to 525 |
| Cutlery basket 11057829 "Hoehe 128 mm" | [S7] | Triangulated rim of the cutlery basket is 0.24 to 0.255 W above the floor cross wires: 128 mm gives W = 502 to 533 |
| Cutlery basket 11057829 length 230 mm | [S7] | rim outline is 0.44 W long seen from above: W = 520 (rim only; lugs not included) |
| Sister lower basket 20002434 (same generation): 525 x 520 x 145 mm | [S9] | rim wire centres are 1.008 W apart, outer edge 1.02 W: 520 to 525 mm outer gives W = 510 to 515; front wall height comes out 147 mm at W = 508 (published 145) |

Adopted: W = 508 mm, uncertainty +-10 mm (2 %) [ESTIMATED]. All lower-basket millimetres below use it.

## 3. Lower basket (part 20007406; photos P80, P81)

### 3.1 Outline and walls

| Quantity | Value | Tag | Basis |
|---|---|---|---|
| Material and colour | silver-grey coated steel wire; the two rear tine rows are dark grey; clips, bearings, wheels and handle light grey plastic; handle with a red stripe | [VERIFIED] | P80, P81; Bosch title "Unterkorb silber ... Klappstacheln dunkelgrau" [S8] |
| Top rim, wire centre to wire centre, left to right | 512 mm (outer edge about 518) +-10 | [ESTIMATED] | rim wires lie 2 mm outside the joints: X = -2 and +510 at four depths each; W = 508 |
| Top rim, front to back | 500 mm centre to centre (rear rim at Y = -221, front rim at Y = +275 to +283), outer about 505, +-12 | [ESTIMATED] | top view on the rim plane; front rim is bowed forward by 5 to 8 mm in the middle |
| Side-rim height above the floor cross wires | 170 +-8 mm (floor cross wires 166 and 174 mm below the rim-joint plane) | [ESTIMATED] | line triangulation of the B and C cross wires |
| Front-rim height | 27 mm lower than the side rim, so about 143 +-8 mm above the floor wires | [ESTIMATED] | line triangulation of the front rim |
| Front corners | chamfered, not rounded: the side rim runs straight to 60 mm from the front, then cuts in 40 +-5 mm (left: from (X -5, Y 214) to (33, 274); right: from (519, 220) to (476, 275)); the two lower wall wires follow the same chamfer | [ESTIMATED] | P81 (P81_g_left_front, P81_g_right_front), P80 |
| Rear corners | small radius, about 15 to 20 mm | [ESTIMATED] | P80, P81 |
| Rear wall | 4 horizontal wires including the rim; the rim has a shallow dip in the middle third; 5 uprights, which are the 5 floor wires turned up | [VERIFIED] counts | P80 (P80_g_tub_interior), P82 foreground |
| Side walls | top rim plus 2 lower horizontal wires; uprights at 7 stations per side (the five fitted joints plus one behind and one in front) | [VERIFIED] counts | P81_g_* crops |
| Side-upright stations (Y, basket frame) | Z -153, A -97, B 0, C +70, D +93, E about +190 mm | [ESTIMATED] | pose fit (sd 0.5 to 0.7 mm in units of W, plus scale) |
| Wire thickness (coated) | rim about 5.5 +-1 mm; floor and wall wires 3.5 to 4.5 mm; tines about 4 +-0.7 mm | [ESTIMATED] | pixel widths at known scale; highlights make this unreliable, calipers needed |
| Handle | grey plastic bar with red stripe on the front rim, X = 146 to 362 (centred), top about 15 mm above the side rim; Bosch handle 12033368 is 215 x 52 x 47 mm | [ESTIMATED] position; [VERIFIED] size [S7] | right end triangulated at X = 359 |

### 3.2 Base grid

The floor is sparse, as on most BSH baskets.

| Quantity | Value | Tag | Basis |
|---|---|---|---|
| Front-back floor wires | 5 | [VERIFIED] | P81 (P81_i_floor_grid), P80 uprights |
| Their positions | X = 58, 169, 235, 351, 431 mm, that is x = -196, -85, -19, +97, +177 from the basket centre, +-10 | [ESTIMATED] | top view at floor depth; the wires are cranked sideways by 10 to 20 mm in three places each, so "position" is an average |
| Spacing | irregular: 111, 66, 116, 80 mm | [ESTIMATED] | same; the same irregular pattern appears in the rear-wall uprights in P80 |
| Structural left-right floor wires | at least 2 between the rear rows and the side rows: line B (Y = -3) and line C (Y = +71); plus the bottom wire of the rear wall and of the front wall | [VERIFIED] presence, [ESTIMATED] positions | P81_j_floor_leftcentre, P80_j_floor_left |
| Fixed tine rails acting as cross wires | 4: ML and MR at Y = +108, FL and FR at Y = +212 | [ESTIMATED] | line triangulation |
| Openings | up to about 110 x 100 mm: anything smaller than a saucer can fall through between rows | [ESTIMATED] | from the spacings above |

### 3.3 Tine rows

Six rows. All run left-right; plates therefore stand in front-back planes and lean sideways.

| Row | Where (Y basket frame; y machine frame, basket centred) | Tines | Pitch | Height above rail centre | Lean | Hinged? | State in photos | Tag |
|---|---|---|---|---|---|---|---|---|
| R1 (rearmost) | rail Y = -136 (y = +165) | 23 = 15 leaning left + 8 leaning right | 17.9 +-0.4 mm (0.0353 W); the last tine on the right sits 26 mm from its neighbour | 65 +-3 mm (tine length 67.5) | 15 +-1.5 deg, left group toward the left wall, right group toward the right wall | yes: dark rail in light-grey plastic bearings | up | counts [VERIFIED] P81, P80; lengths [ESTIMATED] |
| R2 | rail Y = -38 (y = +67), 98 +-3 mm in front of R1 | 23 = 15 + 8, same pattern | 17.9 mm; last gap 28 mm | 65 +-3 mm | 15.5 +-1.5 deg | yes | up | same |
| ML (mid left) | rail Y = +108 (y = -79) | 7 | 25.6 +-0.5 mm | 80 +-4 mm (length about 83) | 17 +-2 deg toward the left wall | no: silver, welded to a floor wire | fixed | count [VERIFIED] P81, P80; lengths [ESTIMATED] |
| MR (mid right) | mirror of ML | 6 seen, 7th hidden by the cutlery basket | 24 to 28 mm (rough picks) | tips at the same height as ML | toward the right wall | no | fixed | [VERIFIED] 6 seen; [ESTIMATED] 7 |
| FL (front left) | rail Y = +212 (y = -183), 104 mm in front of ML | 6 seen in P81 (5 in P80) | 25.1 +-1 mm | tips at the same height as ML | toward the left wall | no | fixed | [VERIFIED] 6; lengths [ESTIMATED] |
| FR (front right) | mirror of FL | 4 to 5 seen | 23 to 25 mm (rough picks) | as FL | toward the right wall | no | fixed | [VERIFIED] at least 4 |

Details behind the table (all [ESTIMATED], W = 508):

- Rear-row tine bases (machine x, basket centred): -205 to +173 at 17.9 mm pitch (22 tines), then +199. The lean reverses between the 15th and 16th tine (x = +46 and +65): their tips are 55 mm apart, a V-shaped gap for a pot or a large bowl.
- Rear-row tips are 91.5 mm below the rim plane (sd 0.5 mm over 20 tines per row), the rail centres 156 to 157 mm below it, the floor cross wires 166 to 174 mm below it. So the hinged rails sit 9 to 18 mm above the floor cross wires and the tine tips about 78 mm above them.
- Side-row tips: X = 27, 53, 80, 105, 130, 156, 181 mm (ML) and 32, 55, 82, 107, 133, about 158 (FL), all 75 to 77 mm below the rim plane, that is about 94 mm above the floor cross wires and 15 mm higher than the rear-row tips.
- Front-back lean of every row is zero within the measuring error (+-2 deg).
- Plate slots: each rear row has 22 gaps. Usable as plate slots: 14 gaps of 17.9 mm in the left group and 7 in the right group (6 of 17.9 mm and one of 26 mm), 21 in all, each plate held by R1 and R2 together (98 mm apart). At 17.9 mm pitch a 31 cm dinner plate with a 25 to 30 mm rim depth needs every second gap, so the practical dinner-plate count is about 10 to 11 in the rear zone; the front side rows add 6 gaps of 25.6 mm on each side (ML with FL, MR with FR).
- Hinge hardware seen: rail bearings clipped onto the first and third floor wires (X = 58 and 235), and two larger light-grey bearing-and-latch units with moulded curved arrows on the right side wall, one per rear row (Bosch "Lager fuer Klappstachelreihen" 10014124, 80 x 57 x 17 mm [S7]). The manual says "Push the lever forwards and fold down the prongs" [S1 sec. 8.5]. The fold direction cannot be seen (both rows are up).
- Catalogue check: the Bosch photo of flip tine 12033326, the only lower-basket tine part in this E-Nr's parts list, shows one rail with a cranked lever at one end, 8 tines leaning toward the lever end (the outermost one set off by a wider gap) and 15 tines leaning the other way, 23 in all [VERIFIED] (REF_fliptine_12033326_x2.jpg). That is exactly the pattern counted in the owner's basket, with the lever end at the right-hand wall. Each tine wire crosses the rail and ends in a stub about 10 mm below it.

### 3.4 Wheels and where the cutlery basket sits

| Quantity | Value | Tag | Basis |
|---|---|---|---|
| Wheels | 4 visible on the left side, 2 (front) visible on the right; 8 in all by symmetry | [VERIFIED] 6 seen | P81, P80; parts list has two wheel types 10014039 (35 x 38 x 22 mm, with stopper) and 10014040 (35 x 35 x 25 mm) [S7] |
| Wheel stations (Y, basket frame) | -189, -94, +91, +186 mm (two pairs; pair spacing 95, pairs 185 apart); machine y = +218, +123, -62, -157 | [ESTIMATED] | top view |
| Wheel track | wheel centres 6 to 8 mm outside the rim wire, so about 524 to 530 mm between wheel mid-planes | [ESTIMATED] | top view, rough |
| Wheel diameter | about 35 mm | [VERIFIED] as a part dimension [S7] | not measured in the photos |
| Cutlery basket position as photographed | rim outline X = 185 to 338, Y = +45 to +268: front centre, between the side rows, long axis front-back, its centre 8 mm right of the basket centre line | [ESTIMATED] | top view at rim height |

## 4. Cutlery basket (part 11057829, replaces 00668270; photos P80, P81)

| Quantity | Value | Tag | Basis |
|---|---|---|---|
| Type | free-standing plastic lattice basket in the lower rack ("Moveable cutlery basket in lower rack") | [VERIFIED] | P80, P81; [S2] |
| Rim outline | 223 x 147 mm +-6 (long axis front-back as placed) | [ESTIMATED] | top view at the triangulated rim height, W = 508 |
| Body height | 122 to 130 mm (rim 44.5 mm below the lower-basket rim plane, floor wires 166 to 174 mm below it) | [ESTIMATED] | two-view triangulation |
| Published size | Laenge 230 mm, Breite 220 mm, Hoehe 128 mm, 338 g, with the retailer's note that "Breite" is the article height and "Hoehe" the article depth | [VERIFIED] | [S7] |
| My reading of the published size | 230 long, 128 body height, 220 high with the handle up; the plan width (147 measured) is not published | [ESTIMATED] | see conflict 1 |
| Handle | one arch running along the long axis over the centre line, about 17 to 22 mm wide (150 to 190 px at about 8.7 px/mm), detachable (catalogue photo shows it unclipped) | [VERIFIED] P81, catalogue; width [ESTIMATED] | P81_k_cutlery_top_small, REF_sheet_cutlery_lowerarm |
| Lid grid | none in use: the cells are open from above in P81 and P80. The catalogue photo shows hinged lid flaps folded outward | [VERIFIED] | P81, P80, catalogue photo |
| Lengthwise sections | 4, of 58, 45, 50 and 69 mm (+-5) from back to front; the two thicker dividers have pins that protrude through the side walls | [VERIFIED] count; [ESTIMATED] sizes | P81_k_cutlery_top_small |
| Compartments | 8 if every section is split by a central wall under the handle (not visible); 6 to 8 is the honest range | [ESTIMATED] | handle hides the centre line; catalogue photo shows a central wall in the middle sections |
| Walls and floor | open lattice of vertical and horizontal ribs, openings roughly 6 to 8 mm wide and 12 to 20 mm tall; lattice floor; inner faces of the long walls carry comb ribs | [ESTIMATED] | catalogue photo scaled by the 230 mm length |
| Colour | medium grey (appears dark in the backlit top view) | [VERIFIED] | P80, catalogue |

## 5. Upper basket (part 20001992; photos P83, P80)

All millimetres are relative to the upper-arm hub axis, with the basket floor wires taken as 30 +-10 mm above the arm's top face (not observable; +-10 mm changes lengths by +-1.4 %). x to the right, y to the rear.

### 5.1 Outline, grid, fittings

| Quantity | Value | Tag | Basis |
|---|---|---|---|
| Outer width | 500 +-20 mm (left rim at x = -244, right rim at x = +256 if the rim is 120 mm above the floor; 517 if 100, 483 if 140) | [ESTIMATED] | P83; the unknown wall height is the main error |
| Depth | not measurable: the rear rim is outside the frame of P83. Floor cross wires span y = -187 to +215 (402 mm) and the walls lie beyond; sister upper baskets are 525 to 527 mm in their longest dimension [S9] | [ESTIMATED] | P83 |
| Left-right floor wires | 12 visible, pitch 36.5 +-1.5 mm, at y = +215, 178, 142, 105, 69, 36, -3, -40, -76, -112, -149, -187 | [VERIFIED] count; [ESTIMATED] positions | P83 |
| Front-back floor wires | 8 between the knife rack and the cup shelves, at x = -159, -108, -41, +47, +89, +123, +158, +191: wide gap (88 mm) over the arm hub and feed tube, about 34 mm pitch in the right-hand cup zone | [VERIFIED] count; [ESTIMATED] positions | P83 |
| Floor profile | not flat: every cross wire rises in a trapezoidal hump between x = +115 and +160 (right-hand cup zone) and has S-bends elsewhere; the catalogue photo shows a W-shaped section | [VERIFIED] | P83_h_right_floor, REF_upper_basket_20001992_a |
| Wire thickness (coated) | 3.4 to 3.6 mm | [ESTIMATED] | edge-to-edge pixel width at 8.1 px/mm |
| Knife shelf (part 11037806) | plastic tray along the whole left side, x = -279 to -163 (116 mm wide), front end at y = -109; published 389 x 119 x 57 mm, 150 g | [ESTIMATED] position; [VERIFIED] size [S7] and name [S1 sec. 8.2] | P83_c_knife_rack |
| Knife shelf details | lattice floor, one comb row of about 12 teeth one third of the way from the back, two rows of slanted fins (4 and 5) and a row of 6 pegs near the front | [VERIFIED] | P83_c_knife_rack |
| Cup shelves ("Etagere", parts 12005549 short and 12005548 long) | two pieces in line on the right side wall, both folded up (seen edge-on), each with about 5 scalloped stemware notches; front piece about 190 mm long in the photo, rear piece partly out of frame | [VERIFIED] presence and state; [ESTIMATED] length | P83_d_cup_shelves, P83_g_right_front |
| Cup shelf published sizes | short 200 x 100 x 18 mm, 43 g; long 252 x 97 x 22 mm | [VERIFIED] | [S7] |
| Handle and tablet collecting tray | grey plastic handle with red stripe at the front centre, x = -98 to +105 (203 mm; published 215); a dark ribbed plastic tray sits directly behind/below it | [ESTIMATED] position; [VERIFIED] presence | P83, P80_l_upper_region |
| What the tray is | The manual's name for it is "Tablet collecting tray": during the wash a tablet drops by itself from the detergent dispenser into this tray, which is where it is meant to dissolve completely | [VERIFIED] | [S1 sec. 5.1 and sec. 11] |
| Height adjustment | side levers left and right ("3 stage Rackmatic"); one grey lever is visible outside the right front corner in P80; no lever is identifiable in P83 | [VERIFIED] | [S1 sec. 8.1], [S2], P80_l_upper_region |
| Height levels | 3; largest item 22 / 24.5 / 27 cm in the top basket against 30-31 / 27.5 / 25 cm in the bottom basket, so the step is 25 mm | [VERIFIED] | [S1 sec. 8.8] |

### 5.2 Tine rows

| Row | Where | Tines | Pitch | Height | Lean | Hinged? | State | Tag |
|---|---|---|---|---|---|---|---|---|
| A (rear left) | x = -112, y = +31 to +210 | 6 | 36 +-1.5 mm | not measurable from one view; 95 +-20 mm by eye against the catalogue photo | slight, toward the centre | no (silver) | fixed | count [VERIFIED] P83; rest [ESTIMATED] |
| B (rear, left of centre) | x = -52, same y | 6 | 36 mm | as A | as A | no (silver) | fixed | same |
| A' (front left) | x = -112, y = -12 to -161 | 9 | 18.6 +-0.8 mm | not measurable (near the camera's nadir) | not measurable | yes (dark grey, grey latch at mid-depth) | up | count [VERIFIED]; rest [ESTIMATED] |
| B' (front, left of centre) | x = -51, same y | 9 | 18.6 mm | as A' | as A' | yes (dark grey) | up | same |
| C (right of centre, full depth) | bases at x = +60, y = +205 to -165 | 11 = 6 behind the latch + 5 in front | 37 +-1.5 mm (one tine per cross wire) | 85 to 94 mm above the base | 10 to 12 deg toward the right wall | yes (dark grey; grey plastic latch at y = 0) | up | count [VERIFIED]; rest [ESTIMATED] |
| Right-hand zone, x > +90 | no tines; humped cross wires for cups and glasses | | | | | | | [VERIFIED] P83_h_right_floor |

Rows A and A' lie on one line, as do B and B'. Row C height and lean come from the radial displacement of each tip from its base about the camera's nadir, assuming the lean is purely sideways.

## 6. Lower spray arm (part 00668148; photos P82, P80)

### 6.1 Body

| Quantity | Value | Tag | Basis |
|---|---|---|---|
| Span tip to tip | 460 mm (original part), 463 mm (compatible part) | [VERIFIED] | [S5], [S6] |
| Span as a fraction of the tub floor width | 0.85 +-0.03 (tub floor 540 +-15 mm wide at the level of the side-wall junctions) | [ESTIMATED] | P82, sec. 7 |
| Span as a fraction of the lower-basket rim width | 0.90 | [ESTIMATED] | 460 / 512 |
| Blades | two; in plan the top face reads as a shallow S (catalogue photo of the underside shows the curvature clearly); blade width at the tips 22 +-2 mm, widening to the hub | [ESTIMATED] | P82 corner picks; REF_sheet_cutlery_lowerarm |
| Symmetry | equal blade lengths: the bearing stem appears within about 1 mm of the mid-point of the tips in P82 and within 5 mm in P80 | [ESTIMATED] | P82_c_hub |
| Nozzle layout | not symmetric: 5 openings on one blade, 4 on the other, at interleaved radii | [VERIFIED] | P82 |
| Hub | raised dome about 40 mm across on the top face; bearing stem below about 27 mm in diameter, 35 to 38 mm of it visible between the sump cover and the arm | [ESTIMATED] | P82_c_hub at 10.4 px/mm and 5.8 px/mm vertical |
| Published overall height | 75 mm (original), 78 mm with a 60 mm stem and 58 mm maximum depth (compatible part) | [VERIFIED] | [S5], [S6] |
| Mass | 69 g (compatible part) | [VERIFIED] | [S6] |
| Top face above the fine-filter plane | 52 +-8 mm | [ESTIMATED] | stem height plus about 14 mm of body |
| Top face below the lower-basket floor wires | 28 mm at W = 508 (198 mm below the basket's rim plane against 170); anywhere from 15 to 45 mm over the scale uncertainty | [ESTIMATED] | P80; strongly coupled to the scale W (sec. 2.3), so this is a weak number |
| Axis position | on the tub centre line within +-10 mm; 248 mm from the lower basket's left joint line (centre is 254) | [ESTIMATED] | P80, P82 |
| Orientation when photographed | chord rotated 12 deg from the left-right axis, right tip toward the door | [ESTIMATED] | P80 and P82 agree (11.8 and 12.4 deg) |
| Colour and material | light grey plastic | [VERIFIED] | P82 |

### 6.2 Openings on the top face

"A" is the blade pointing left in P82, "B" the blade pointing right. R is the distance from the axis; the uncertainty is +-5 mm for the inner openings and +-2 mm near the tips. "Offset" is the distance from the tip-to-tip chord (sign: toward the trailing or leading edge is unknown because the rotation sense is unknown). Sizes are dark-opening sizes at 10.3 to 11.3 px/mm seen 34 deg off the vertical, good to about +-30 %. All rows [ESTIMATED] except the count and the boss shapes, which are [VERIFIED] in P82_b_arm_left, P82_b_arm_right, P82_c_hub.

| ID | Blade | R (mm) | R / 230 | Offset (mm) | Boss | Opening | Size (mm) | Direction evidence |
|---|---|---|---|---|---|---|---|---|
| A1 | A | 185 | 0.80 | 5 | none (flush or countersunk) | round | 3.9 | hole wall visible on one side: slight tilt, direction unclear |
| A2 | A | 141 | 0.61 | 5 | low raised ring | round to oval | 3.1 | rim shadow on the door side |
| A3 | A | 118 | 0.51 | 6 | squarish raised boss | short slot | 2.9 x 1.9 | slot long axis along the arm |
| A4 | A | 95 | 0.41 | 5 | raised ring | oval | 3.6 x 2.6 | none |
| A5 | A | 48 | 0.21 | 1 | conical boss | round | 3.3 | none |
| B1 | B | 67 | 0.29 | 17 | raised ring | round | 3.2 | none |
| B2 | B | 159 | 0.69 | 16 | crater-like boss | round | 2.7 | none |
| B3 | B | 205 | 0.89 | 11 | tall cylindrical turret, about 6 mm across | not resolved (2 to 3 assumed) | | turret: a directed jet, probably inclined outward |
| B4 | B | 224 | 0.975 | 5 | squarish boss at the very tip | rectangular | 3.1 x 2.6 | opening faces outward and upward: corner-reaching tip jet |

Rings covered, inside to outside: 48, 67, 95, 118, 141, 159, 185, 205, 224 mm, that is one ring every 16 to 26 mm with the two blades alternating. Sum of the visible opening areas: about 68 mm2 (+-40 %).

Not on the top face but known from the Bosch catalogue photo of this part's underside [VERIFIED] (REF_sheet_cutlery_lowerarm): one small rectangular duct-shaped outlet on the underside of one blade at roughly 0.8 of the blade length, and 6 short radial fins around the hub flange.

Which openings drive the rotation: nothing in the photographs settles it. Candidates are the underside outlet (a tangential jet there both drives the arm and sweeps the filter), the turret B3 and the tip opening B4. The rotation sense is unknown.

Cannot be seen: the whole underside in the owner's photos, both end faces (a light blob on the end of blade A may be a tip outlet or a moulding mark), the true orifice diameters below the visible countersinks, and every jet angle.

## 7. Upper spray arm, feed tube and what sprays the top (parts 11010054, 11003118, 00611388; photos P83, P80)

| Quantity | Value | Tag | Basis |
|---|---|---|---|
| Span | 460 mm | [VERIFIED] | [S4], [S5] "Breite 460 mm" |
| Shape | two slim blades, slightly S-shaped (openings near the hub lie 13 to 16 mm off the tip-to-tip chord), end faces cut at an angle | [ESTIMATED] | P83 |
| Position | hangs under the upper basket; hub under the wide wire gap at the basket centre | [VERIFIED] | P83, P80_l_upper_region |
| Hub | round cap about 45 mm across where the feed tube meets the arm; the catalogue photo shows a four-lobed retaining nut on the underside | [ESTIMATED] size; [VERIFIED] nut | P83, REF_upper_arm_11010054_2_small |
| Feed tube | straight, from the hub to the back, above the arm; about 17 +-3 mm wide; two collars at y = +43 and +121; clipped under the basket | [ESTIMATED] | P83_b_feedtube |
| Feed tube length | published 270 mm; measured 226 mm to the start of the docking funnel and 296 mm to its rear end | [VERIFIED] published [S4]; [ESTIMATED] measured | P83 |
| Docking | the tube ends in an upright oblong docking plate; the catalogue photo shows 5 ports in a vertical row, 4 with cone-shaped flap valves and 1 open, which is how one dock serves three basket heights | [VERIFIED] | REF_upper_arm_11010054_2_small |
| Supply | flat grey duct up the middle of the back wall, running from the sump cover behind the lower arm hub to above the upper basket | [VERIFIED] | P82, P80 |
| Mass of arm with tube and dock | 149 g | [VERIFIED] | [S5] |
| Third spray level | not in any photograph (the tub roof was not photographed). The parts list for this E-Nr has "Zufuehrrohr mit Dachkreisel fuer 81,5cm Geraete" (680 x 275 x 55 mm, 240 g) and "Brause Dachkreisel" (52 x 53 x 21 mm, 10 g): a small roof shower head on the end of the rear duct, not a third arm. The manual lists only a lower and an upper spray arm | [VERIFIED] | [S3], [S5], [S1 sec. 5.1] |
| Baking-sheet spray head | optional head that replaces the upper basket and plugs into the rear-wall holder (part 00612114, 90 x 81 x 32 mm, 28 g) | [VERIFIED] | [S1 sec. 8.7], [S5] |

Openings visible on the top face through the basket (P83; R from the hub axis; arm chord at -37 deg / 143 deg to the x axis when photographed). Rows [ESTIMATED]; count and shapes [VERIFIED] in Z83_arm, P83_h_right_floor.

| ID | Blade | R (mm) | R / 230 | Offset from chord (mm) | Opening | Size (mm) |
|---|---|---|---|---|---|---|
| U1 | rear-left | 225 | 0.98 | 8 | small slot at the tip | 3.2 x 1.5 |
| U2 | rear-left | 196 | 0.85 | 0 | slot in a raised oval boss | 5.4 x 2.5 |
| U3 | rear-left | 83 | 0.36 | 4 | slot in a raised oval boss | 5.4 x 2.5 |
| U4 | front-right | 44 | 0.19 | 13 | round hole in a round boss | 2.2 |
| U5 | front-right | 132 | 0.57 | 16 | slot in a raised oval boss | 5.4 x 2.5 |
| U6 | front-right | 162 | 0.70 | 13 | slot in a raised oval boss | 5.4 x 2.5 |
| U7 | front-right | 220 | 0.96 | 0 | small slot at the tip | 3.2 x 1.5 |

Slot long axes run along the arm. Sizes are good to +-30 %. Between R = 83 and 196 mm on the rear-left blade the arm is crossed by tine rows A and B and several wires, so one or two openings may be hidden there. The underside is not visible in the owner's photos, and the catalogue photo of the underside shows no obvious openings at its resolution.

## 8. Tub floor and walls (photos P82, P80, P81)

Positions are in the machine frame (x right, y back, from the lower-arm axis). Heights are above the plane of the flat fine filter, which is the lowest visible surface. The P82 calibration is the roughest of the three (sec. 2.2): positions +-10 mm near the filter, +-25 mm at the back of the floor.

| Feature | What the photos show | Value | Tag | Basis |
|---|---|---|---|---|
| Tub material | bright stainless steel floor, side walls and back wall; stainless inner door | | [VERIFIED] | P80, P82, P81; "Stainless steel interior" [S2] |
| Flat fine filter | stainless perforated plate with rounded corners in front of the arm | x = -132 to +129 (261 mm), visible y = -133 to -17 (116 to 121 mm); published 260 x 130 x 14 mm with a 54 mm opening for the cylinder | [ESTIMATED] position; [VERIFIED] size [S5] | P82_d_filter, tub82.py |
| Fine filter perforation | round holes on a hexagonal (60 deg) lattice | hole pitch 1.47 +-0.1 mm (row period 1.23 to 1.30 mm in three directions 60 deg apart); hole diameter not resolved | [ESTIMATED] | Fourier analysis of three patches of P82 (mesh.py) |
| Sump cover | grey plastic plate behind the fine filter, around the arm stem, with diagonal ribs and perforated fields, held by two Torx screws | x = -128 to +127 (255 mm); published 259 x 95 x 26 mm, 51 g; perforation hexagonal, pitch 2.05 +-0.15 mm, holes about 1.2 mm | [ESTIMATED]; [VERIFIED] size [S5] | P82_c_hub |
| Filter cylinder (coarse filter with micro filter under it) | grey plastic cylinder with a four-lug bayonet top, standing in the fine filter in front of the arm | top centre (-1, -66) +-6 mm; ring diameter 72 +-5 mm; compatible set published as 71 mm dia x 92 mm and 79 mm dia x 131 mm | [ESTIMATED]; [VERIFIED] published [S5] | P82_d_filter |
| Filter system | three parts: coarse filter, fine filter, micro filter; turn the coarse filter anticlockwise to remove | | [VERIFIED] | [S1 sec. 17.5]; "3 piece corrugated filter" [S2] |
| Salt cap | grey screw cap with moulded text ring and lugs, on the floor at the front left | centre (-187 +-8, -50 +-10), diameter 96 +-5 mm; published 92 x 90 x 19 mm | [ESTIMATED]; [VERIFIED] published [S7] | P82 |
| Lower-arm bearing stem | rises through the sump cover | 27 mm diameter, 35 to 38 mm visible | [ESTIMATED] | P82_c_hub |
| Floor beads ("slots") | two groups of three parallel slot-shaped pressings in the floor, in front of the filter, left and right. Located by two independent photographs (P82 directly, P81 through the basket-to-arm tie from P80) which agree to 10 to 20 mm. They are pressings in the floor, not openings, and they are not on the side walls | left group x = -235 to -180, right group x = +185 to +236 (+-15); y = -155 (rear bead) to -185 (front bead) (+-10); each bead 51 +-4 mm long, 13 +-1.5 mm apart | [ESTIMATED] | P82_m_slots, P8x_m_slots, slots.py |
| Rear-right floor dish | a round-to-teardrop embossed dish in the floor near the rear right corner | centre (+185 +-15, +160 +-20), about 75 mm across | [ESTIMATED] | P82, P80_g_tub_interior |
| Floor shape | the floor is a shallow stepped pan: one pressed step runs around it a few centimetres in from the walls (bright crease lines in P82), and the filter and sump cover sit in the lowest part | not measured | [VERIFIED] qualitative | P82_whole_grid_b |
| Rear edge of the floor | floor-to-back-wall crease | y = +230 +-25 | [ESTIMATED] | P82 |
| Tub interior width | bounded two ways: the lower basket's wheel faces are about 538 mm apart and must fit; floor-to-wall creases in P82 are 540 to 560 mm apart depending on which crease is taken | 545 +-10 mm | [ESTIMATED] | P81 wheels; P82 |
| Side walls | long front-to-back pressed ledges low on both walls (the tracks for the lower-basket wheels) and several vertical-plane creases; no slotted panels are visible on either side wall | | [VERIFIED] | P82_f_left_wall, P82_f_right_wall, P80_k_side_walls |
| Left wall | a round disc with openings (a vent or inlet grille) in the upper part of the visible wall, and two small light-coloured plastic fittings with rectangular openings low down toward the front | not measured | [VERIFIED] presence | P80_m_leftwall_disc |
| Right wall | one narrow oval pressing at about the height of the left-wall disc | not measured | [VERIFIED] presence | P80_m_leftwall_disc |
| Back wall | two embossed rectangular panels side by side, each about 190 +-15 mm wide and 155 +-15 mm tall, their lower edges about 70 mm above the filter plane, with dried water marks; between them the flat grey vertical feed duct | duct 70 +-5 mm wide on the wall (x = -38 to +31), about 50 mm wide where it crosses the floor from the sump cover | [ESTIMATED] | P80 back-wall plane taken 230 to 250 mm behind the arm axis (backwall.py) |
| Feed duct routing | flat two-channel duct from the sump cover, back across the floor, up the middle of the back wall, past the upper-basket dock and on upward behind the upper basket | | [VERIFIED] | P82, P80_l_upper_region |
| How the top is sprayed | not visible (no photo of the roof); parts list: roof shower head on the feed duct (sec. 7) | | [VERIFIED] from parts list only | [S3], [S5] |
| Door inner panel | bright stainless, flat where the pulled-out basket stands on it, with Torx screws near the edges; dispenser not in any photo | | [VERIFIED] | P81, P83 |

## 9. What the photographs settle about the configuration

| Question | Answer | Tag | Basis |
|---|---|---|---|
| Cutlery basket or cutlery drawer | cutlery basket in the lower rack; no drawer | [VERIFIED] | P80, P81; "Appliance height 81.5 cm with cutlery basket" [S1 sec. 8.8]; [S2] |
| Spray levels visible | two rotating arms: one on the tub floor, one under the upper basket | [VERIFIED] | P82, P83, P80 |
| Third level | a roof shower head on the rear duct, by the parts list; no third arm and no third rack | [VERIFIED] parts list; not photographed | [S3], [S5], [S1 sec. 5.1] |
| Basket colour and finish | silver-grey smooth coated wire, glossy; hinged tine rows dark grey; plastic fittings light grey; red stripe on both basket handles | [VERIFIED] | all photos |
| Coating type | not identifiable from photographs (smooth, thin, no visible drip beads at wire ends other than ball ends on the uprights) | | |
| Tub | stainless steel throughout, pressed panels, no visible plastic floor | [VERIFIED] | P82, P80 |
| Lower basket | 6 tine rows, 2 of them hinged (rear), 4 fixed (sides); 8 wheels; chamfered front corners | [VERIFIED] counts | P80, P81 |
| Upper basket | knife shelf left, 2 folding cup shelves right, 5 tine rows of which 3 lines are hinged (A', B' and the full-depth row C with a mid latch), handle with tablet collecting tray, 3 height levels | [VERIFIED] | P83, P80, [S1] |
| Detergent tab path | the tab is caught in a tray at the front centre of the upper basket, about 200 mm wide, not on the lower rack | [VERIFIED] [S1]; tray seen in P83 | the generic baseline drops the tab onto the front row of the lower rack; this machine does not |
| Largest lower-rack plate | 31 cm | [VERIFIED] | [S1 sec. 8.4] |
| Height of appliance | 81.5 cm class | [VERIFIED] | [S1 sec. 8.8], [S2] |

## 10. Parametric description

Style of machine.md 12.1. Values are this machine's; "+-" is my uncertainty; "?" marks what the photographs cannot give (keep the SPOT-60 value until measured). Lower-basket placement relative to the arm axis assumes a centred basket (sec. 0.2).

```yaml
machine: BOSCH-SMV4HAX40G-13      # SD6PW1B, 81.5 cm, 13 place settings, 2 arms + roof shower, cutlery basket, no third rack
frame:                             # mm; origin on lower-arm axis; x right, y back; z here = height above the fine-filter plane
  tub:
    width: 545                     # +-10; lower bound 540 from the basket wheel track
    floor_rear_edge_y: 230         # +-25
    floor_front_edge_y: "?"        # not visible; floor beads reach y = -185
    height: "?"                    # roof not photographed
    material: stainless
  floor_features:
    fine_filter_plate: {x: [-132, 129], y: [-133, -17], published_size: [260, 130, 14], hole_lattice: hex, hole_pitch: 1.47, hole_d: "?"}
    sump_cover:        {x: [-128, 127], y_front: -17, published_size: [259, 95, 26], hole_lattice: hex, hole_pitch: 2.05, hole_d: 1.2}
    filter_cylinder:   {center_xy: [-1, -66], ring_d: 72, published_coarse: {d: 71, h: 92}, published_micro: {d: 79, h: 131}}
    salt_cap:          {center_xy: [-187, -50], d: 96, published_size: [92, 90, 19]}
    floor_beads:       {groups: 2, per_group: 3, x_left: [-235, -180], x_right: [185, 236], y: [-185, -155], length: 51, pitch: 13}
    rear_right_dish:   {center_xy: [185, 160], d: 75}
  back_wall:
    feed_duct: {x: [-38, 31], width_on_floor: 50}
    embossed_panels: {count: 2, size_wh: [190, 155], bottom_z: 70}
racks:
  lower:
    part: 20007406
    rim_cc_xy: [512, 500]          # +-10, +-12 (outer about 518 x 505)
    rim_x: [-256, 256]
    rim_y: [-250, 250]             # basket assumed centred on the arm axis: measure
    front_chamfer: {dx: 40, dy: 58}
    rim_above_floor_wires: {sides_and_back: 170, front: 143}     # +-8
    wire_d_coated: {rim: 5.5, grid: 4.0, tine: 4.0}              # +-1, +-0.7, +-0.7: calipers needed
    floor_wires_front_back_x: [-196, -85, -19, 97, 177]          # +-10; each wire is cranked 10 to 20 mm
    floor_wires_left_right_y: [32, -42]                          # lines B and C, plus wall bottom wires
    tine_rows:
      - {id: R1, y: 165,  runs: x, n: 23, base_x: "-205 + 17.9*k for k = 0..21, then 199", lean_deg: 15, lean_dir: "-x for k <= 14, +x for k >= 15", height: 65, length: 67.5, rail_above_floor_wires: 13, hinged: true, state: up}
      - {id: R2, y: 67,   runs: x, n: 23, base_x: "as R1", lean_deg: 15.5, lean_dir: "as R1", height: 65, length: 68, rail_above_floor_wires: 13, hinged: true, state: up}
      - {id: ML, y: -79,  runs: x, n: 7,  base_x: [-203, -177, -150, -125, -100, -74, -49], pitch: 25.6, lean_deg: 17, lean_dir: -x, height: 80, hinged: false}
      - {id: MR, y: -79,  runs: x, n: 7,  base_x: [49, 74, 100, 125, 150, 177, 203], pitch: 25.6, lean_deg: 17, lean_dir: +x, height: 80, hinged: false}   # mirror of ML assumed; 6 seen
      - {id: FL, y: -183, runs: x, n: 6,  base_x: [-198, -175, -148, -123, -97, -72], pitch: 25.1, lean_deg: 17, lean_dir: -x, height: 80, hinged: false}  # a 7th is not excluded
      - {id: FR, y: -183, runs: x, n: 6,  base_x: [72, 97, 123, 148, 175, 198], pitch: 25.1, lean_deg: 17, lean_dir: +x, height: 80, hinged: false}       # mirror of FL assumed; 4 to 5 seen
    plate_slots: {rear_zone: 21, pitch: 17.9, held_by: [R1, R2], row_spacing: 98, side_zones: "6 per side at 25.6"}
    wheels: {count: 8, y: [218, 123, -62, -157], track: 527, d: 35}
    handle: {x: [-108, 108], y: -250, size: [215, 52, 47]}
  cutlery_basket:
    part: 11057829
    rim_size: [147, 223]           # +-6; published length 230
    body_height: 128               # published; 122 to 130 measured
    height_with_handle: 220        # my reading of the published "Breite 220"
    sections: 4                    # 58, 45, 50, 69 mm along the length
    cells: 8                       # 6 to 8; centre wall hidden by the handle
    lid: none_in_use
    mass_kg: 0.338                 # published
    as_photographed: {center_xy: [8, -128], long_axis: y}
  upper:
    part: 20001992                 # x, y relative to the upper-arm hub axis
    width_outer: 500               # +-20
    depth_outer: "?"               # rear rim out of frame; sister baskets 525 to 527
    floor_above_arm_top: "?"       # 30 assumed
    wire_d_coated: 3.5
    floor_wires_left_right_y: [215, 178, 142, 105, 69, 36, -3, -40, -76, -112, -149, -187]   # pitch 36.5
    floor_wires_front_back_x: [-159, -108, -41, 47, 89, 123, 158, 191]
    tine_rows:
      - {id: A,  x: -112, runs: y, n: 6,  y: [210, 175, 139, 103, 68, 31], pitch: 36, height: "? (about 95)", hinged: false}
      - {id: B,  x: -52,  runs: y, n: 6,  y: [207, 174, 137, 101, 70, 34], pitch: 36, height: "? (about 95)", hinged: false}
      - {id: A2, x: -112, runs: y, n: 9,  y: [-12, -31, -49, -68, -86, -104, -122, -141, -161], pitch: 18.6, height: "?", hinged: true, state: up}
      - {id: B2, x: -51,  runs: y, n: 9,  y: [-14, -32, -50, -68, -86, -104, -121, -143, -163], pitch: 18.6, height: "?", hinged: true, state: up}
      - {id: C,  x: 60,   runs: y, n: 11, y: [205, 166, 130, 93, 56, 19, -17, -52, -91, -127, -165], pitch: 37, height: 88, lean_deg: 11, lean_dir: +x, hinged: true, latch_y: 0, state: up}
    knife_shelf: {part: 11037806, x: [-279, -163], y: [-109, 280], published_size: [389, 119, 57], mass_kg: 0.150}
    cup_shelves: {side: right, count: 2, published_sizes: [[200, 100, 18], [252, 97, 22]], state: folded_up}
    handle_and_tab_tray: {x: [-98, 105], at: front_wall}
    levels: {count: 3, step: 25, max_item_upper_cm: [22, 24.5, 27], max_item_lower_cm: [31, 27.5, 25]}
arms:
  lower: {part: "00668148", axis_xy: [0, 0], tip_radius: 230, blade_width_tip: 22, top_z: 52, stem_d: 27, mass_kg: 0.069, sense: "?", nozzles: "table L below"}
  upper: {part: "11010054", axis_xy: "?", tip_radius: 230, feed_tube_length: 270, feed_tube_d: 17, dock_ports: 5, mass_with_tube_kg: 0.149, sense: "?", nozzles: "table U below"}
  roof:  {part: "00611388", type: shower_head_on_rear_duct, size: [52, 53, 21], mass_kg: 0.010, position: "?"}
```

Nozzle tables in the form of machine.md 3.2. R and shape are this machine's (sec. 6.2 and 7); theta and rho cannot be read from the photographs, so the angle columns say what the boss shape suggests and nothing more. Areas are from the apparent sizes and carry +-40 %.

Lower arm, table L (top face; blade A and blade B are the two halves):

| ID | Half | R (mm) | theta (deg) | rho (deg) | Shape | Size (mm) | A (mm2) | Role (guess) |
|---|---|---|---|---|---|---|---|---|
| A5 | A | 48 +-5 | ? | ? (near vertical) | round in conical boss | 3.3 | 8.6 | inner ring |
| B1 | B | 67 +-5 | ? | ? (near vertical) | round in raised ring | 3.2 | 8.0 | inner ring |
| A4 | A | 95 +-5 | ? | ? | oval in raised ring | 3.6 x 2.6 | 7.4 | |
| A3 | A | 118 +-4 | ? | ? | short slot in square boss | 2.9 x 1.9 | 5.5 | fan |
| A2 | A | 141 +-4 | ? | ? | round in low ring | 3.1 | 7.5 | |
| B2 | B | 159 +-3 | ? | ? | round in crater boss | 2.7 | 5.7 | |
| A1 | A | 185 +-3 | ? | ? (slightly tilted) | round, flush | 3.9 | 11.9 | outer ring, largest opening |
| B3 | B | 205 +-2 | ? (outward) | ? (inclined) | turret, orifice not resolved | 2.5 assumed | 4.9 | directed jet, possible drive |
| B4 | B | 224 +-2 | ? (outward) | ? (inclined) | rectangular in tip boss | 3.1 x 2.6 | 8.1 | corner reach, possible drive |
| LU1 | one blade, underside | about 185 (0.8 of the blade) | ? | negative | rectangular duct | ? | ? | filter sweep and drive; from the catalogue photo only |
| Sum of the nine top openings | | | | | | | 67.6 | SPOT-60 baseline total is 75.3 including two underside nozzles |

Upper arm, table U (top face as seen through the basket):

| ID | Half | R (mm) | theta | rho | Shape | Size (mm) | A (mm2) |
|---|---|---|---|---|---|---|---|
| U4 | front-right | 44 +-3 | ? | ? | round in boss | 2.2 | 3.8 |
| U3 | rear-left | 83 +-3 | ? | ? | slot, long axis radial | 5.4 x 2.5 | 13 |
| U5 | front-right | 132 +-3 | ? | ? | slot | 5.4 x 2.5 | 13 |
| U6 | front-right | 162 +-3 | ? | ? | slot | 5.4 x 2.5 | 13 |
| U2 | rear-left | 196 +-3 | ? | ? | slot | 5.4 x 2.5 | 13 |
| U7 | front-right | 220 +-3 | ? | ? | small tip slot | 3.2 x 1.5 | 4.8 |
| U1 | rear-left | 225 +-3 | ? | ? | small tip slot | 3.2 x 1.5 | 4.8 |
| Sum of the seven seen | | | | | | | 65 (SPOT-60 mid arm: 49.6) |

## 11. Conflicts

1. Cutlery basket size. The retailer lists 230 (Laenge) x 220 (Breite) x 128 (Hoehe) mm and says its width figure is the article height and its height figure the article depth [S7]. The photographs give a rim of 223 x 147 mm and a body 122 to 130 mm tall. Neither 220 nor 128 is the plan width. I read the published numbers as 230 long, 128 body height, 220 high with the handle; the 147 mm width has no published counterpart.
2. Number of folding tine rows. Bosch's own part titles say "6 Klappstacheln" for the lower basket 20007406 and "4 Klappstacheln" for the upper basket 20001992 [S8]; the UK spec sheet says "2 foldable plate racks in bottom basket" and "2 foldable plate racks in top basket" [S2]; the photographs show 2 hinged rows in the lower basket (each one rail with 23 tines) and, in the upper basket, hinged rows A', B' and C (C in two halves about a latch, which makes 4 units). The parts list for this E-Nr has one lower flip-tine part (12033326) and two upper ones (12033302 "rechts vorn", 12033291 "rechts hinten") [S3]. The lower-basket title does not match this appliance's basket as photographed.
3. Upper arm "Armlaenge 270 mm" against "Sprueharmbreite 460 mm" on the same retailer page [S5]. The photograph supports 460 mm span and a 270 mm feed tube; 270 mm is not the arm.
4. The research brief expected "slotted panels on the side walls". The slot-shaped features are six pressings in the floor (sec. 8); the side walls show wheel ledges, creases, a round grille (left) and an oval pressing (right).
5. Naming against machine.md: the parts list's "Spray arm top" (11010054) is the arm under the upper basket (machine.md "mid"); what machine.md calls the "top arm" is here a roof shower head (00611388).
6. Against the SPOT-60 baseline (machine.md 12.1), this machine differs as follows: no third rack; lower-arm tip radius 230 (SPOT-60 247) and upper 230 (232); lower-arm mass 0.069 kg for the compatible part (0.19); lower rack 6 rows (2 x 23 tines at 17.9 mm, hinged, leaning sideways 15 deg; 4 x 6-7 tines at 25.6 mm, fixed) against 8 rows at 25 mm leaning 8 deg; lower-rack floor 5 front-back wires at irregular 66 to 116 mm spacing against a 35 x 100 mm grid; rim 512 x 500 x 170 mm against 525 x 495 x 160; cutlery basket 223 x 147 x 128 against 240 x 135 x 215; fine filter 260 x 130 plus a separate 259 x 95 sump cover against one 260 x 220 plate; upper-rack cross-wire pitch 36.5 against 85 and front-back 34 to 88 against 30; cup shelves 2 on one side (200 and 252 mm long, 100 wide) against 4 of 225 x 85; detergent tab caught in an upper-basket tray instead of dropping onto the lower rack. Agreements: 3 upper-rack levels at 25 mm; 31 cm largest plate; 8 wheels.
7. Internal: the cutlery-basket length implies W = 520 mm from the top view alone but 563 to 568 mm when its front rim is triangulated from both views. The front rim is hidden behind the lower-basket handle in P80, so the two-view pick is on the wrong edge; I discarded it.

## 12. Further photographs and measurements (owner, a few minutes each, most valuable first)

1. Lower spray arm off the machine (it lifts off its stem): lay it on a table, ruler beside it, and photograph it square-on from above, then from below, then each tip end-on. Push a toothpick into each opening and photograph from the side so the jet direction shows. Try drill shanks or pins (1.5 to 5 mm) in each opening and note the largest that enters. This settles the nozzle table (radii to 1 mm, diameters, underside outlets, drive nozzles, rotation sense): calibration priority 1 in machine.md 13.
2. Upper spray arm the same way: pull the upper basket out, unscrew the arm from its hub, photograph top and bottom with a ruler, toothpick directions, pin sizes. Photograph the docking plate at the back of the feed tube.
3. Tape measure inside the tub: width wall to wall at lower-basket wheel height and at floor level; depth from the door seal plane to the back wall; height from the filter plate to the roof; height of the lower arm's top face above the filter plate and above the general floor; with the lower basket pushed in, the gap between the arm top and the basket floor wires and the distance from the basket's front rim to the arm axis.
4. Re-shoot the lower basket from directly above with a tape measure lying across the rim left-right and another front-back (this removes the 2 % scale uncertainty from everything in sec. 3). Then a photo from the side at rim height with a ruler standing vertically inside the basket (rim, rail and tine heights).
5. Fold both rear tine rows down and photograph from above and from the side (fold direction, folded height, what the lever does). One rear tine and one side tine with a ruler held behind it.
6. Calipers: rim wire, floor wire, tine, in both baskets (over the coating), and one bare spot if any exists.
7. Upper basket from above again, this time with the whole basket in frame including the rear rim, a tape across the rim both ways, and the cup shelves folded down. A side photo with a vertical ruler (wall height, heights of the tall rear-left tines). Measure the tablet collecting tray (width, depth front to back, height).
8. With the upper basket at each of its three levels: height of the upper arm's lower face above the lower basket's rim, and of the upper basket's floor wires above the tub floor.
9. The tub roof (roof shower head) and the inner door: one photo each with a ruler, showing where the detergent dispenser sits relative to the door edges and to the tablet collecting tray.
10. Cutlery basket on a table: count the compartments, measure length, width, body height and height with handle; one photo from above with the handle unclipped.
11. Filter set lifted out, on a table with a ruler: cylinder diameters and heights; a close-up of the fine filter plate and of the micro filter with the ruler in frame (hole and mesh size).
12. Kitchen scale: lower arm, upper arm with tube, lower basket empty, upper basket empty, cutlery basket.
13. Left tub wall: a close photo of the round grille and of the two small white fittings near the floor (other researchers need to know where fill water enters).

## 13. Not found, and cross-links

Not obtainable from these photographs (generic fallback from machine.md in brackets):

- Jet direction (theta, rho) of every nozzle on both arms, the rotation sense of each arm, and all underside outlets of the owner's arms [DU750 angles for L1 to L10; lower counter-clockwise, upper clockwise].
- True orifice diameters (only apparent openings, +-30 %) [2.4 to 3.0 mm round, 1.6-1.8 x 4.5-5 mm slots].
- Upper basket depth, wall height and the height of its floor above the upper arm [505 x 480 x 125; grid 10 mm above the nozzle plane].
- Heights of upper-basket tine rows A, B, A', B' [40 mm; this machine's rear-left tines are clearly much taller, about 95 mm].
- Tub height, roof, roof shower position, door liner, dispenser position and lid [650 mm; dispenser at x = -70, z = 300 on the liner].
- Where the lower basket sits front-to-back relative to the arm axis when pushed in [centred].
- Bare wire diameters, coating thickness and coating material [3.4 mm steel, 0.4 mm nylon].
- Fold direction and folded height of the hinged rows.
- Sump below the filter, fine-filter hole diameter, micro-filter mesh [0.8 mm holes, 0.20 mm mesh].
- Published dimensions for baskets 20007406 and 20001992: none found (a web search this session returned figures only for sister baskets).

Cross-links to the other three researchers:

- Hardware / parts: the catalogue photo of 11010054 shows a 5-port docking plate with 4 flap valves; the lower arm's compatible part weighs 69 g; feed tube with roof shower is 680 x 275 x 55 mm; the back-wall duct is about 70 mm wide and two-channelled in P82.
- Programme / hydraulics: only two reaction arms plus a roof shower take flow; visible top-face outlet areas are about 68 mm2 (lower) and 65 mm2 (upper), each +-40 %.
- Documents: manual [S1] sec. 8.8 table (levels), sec. 5.1 (tablet collecting tray), sec. 8.7 (baking-sheet spray head replaces the top basket and docks on the rear holder).
- Items / loading: plates in the lower rack stand in front-back planes leaning 15 deg sideways, in 17.9 mm gaps; the V-gap between the 15th and 16th rear tines is 55 mm wide at the tips; side rows have 25.6 mm gaps and taller tines; saucer rows in the upper basket have 18.6 mm gaps.

## 14. Sources

Owner's photographs (first-hand evidence), read and measured this session:

- [P79] to [P83]: docs/reference/owner-photos/IMG_9080 ... IMG_9083 (file names in sec. 1.1), and IMG_9079 (P79, the rating plate), which is not published because it shows the serial number. The metadata was read with PIL before it was removed from the published files.

Documents and pages (the copies read are working files, not in the repository; each source is given by its public address where one was recorded):

- [S1] Bosch user manual 9001937295_B for SMV4HAX40G, English. https://media3.bosch-home.com/Documents/9001937295_B.pdf . Downloaded again this session and found byte-identical to the copy saved earlier; read as extracted text. Used: sec. 5.1 appliance overview (pp. 12-13), sec. 8.1 to 8.8 (pp. 18-21), detergent section (tablet collecting tray), sec. 17.5 filter system (pp. 37-38).
- [S2] Bosch UK specification sheet SMV4HAX40G. https://media3.bosch-home.com/Documents/specsheet/en-GB/SMV4HAX40G.pdf (URL answered HTTP 200 this session; read as extracted text). Used: "Flexible design elements" list, "Stainless steel interior", 3 piece filter.
- [S3] BSH spare-parts list for E-Nr SMV4HAX40G/13 as saved by the earlier attempt (positions 0440 to 0862), https://www.bosch-home.co.uk/en/spare-parts-list/SMV4HAX40G-13 . Not re-fetched by me; the part numbers were cross-checked against the Bosch shop pages in [S4], [S8].
- [S4] Bosch DE shop, 11010054 "Sprueharm-Oben mit Einlaufrohr": https://www.bosch-home.com/de/de/product/11010054 ("Breite: 460 mm", "Rohrlaenge: 270 mm"); text extracted by me from a saved copy.
- [S5] ersatzteilshop.de product pages, properties extracted by me this session from saved copies:
  - lower arm original: https://www.ersatzteilshop.de/sprueharm-unten-kunststoff-00668148-668148-bosch-siemens-neff-kueppersbusch.html
  - upper arm with tube: https://www.ersatzteilshop.de/sprueharm-oben-bosch-11010054-mit-rohr-fuer-geschirrspueler.html
  - rear feed tube: https://www.ersatzteilshop.de/sprueharmrohr-bosch-11003118-senkrechtes-steigrohr-fuer-geschirrspueler.html
  - roof shower: https://www.ersatzteilshop.de/deckendusche-bosch-00611388-brause-oben-fuer-geschirrspueler.html
  - fine filter: https://www.ersatzteilshop.de/sieb-bosch-00645037-fuer-geschirrspueler.html
  - sump cover: https://www.ersatzteilshop.de/abdeckung-fuer-pumpentopf-12038407.html
  - filter set (compatible): https://www.ersatzteilshop.de/sieb-set-wie-bosch-00645038-2-teilig-fuer-geschirrspueler-10101031.html
  - baking-sheet spray head: https://www.ersatzteilshop.de/spruehkopf-fuer-backbleche-fettfilter-etc-00612114-612114-bosch-siemens-neff.html
- [S6] ersatzteilshop.de, compatible lower arm 10110265: https://www.ersatzteilshop.de/sprueharm-unten-passend-fuer-bosch-00668148-bluparts-in-geschirrspueler-10110265.html (463 mm, height 78, stem 60, depth 58, 69 g).
- [S7] ersatzteilshop.de pages for the basket fittings, read through the earlier attempt's extraction files (which list the URLs; the files are not in the repository); the cutlery-basket page was checked by me against its saved HTML: https://www.ersatzteilshop.de/besteckkorb-bosch-11057829-fuer-geschirrspueler.html . Others: knife shelf 11037806, cup racks 12005549 and 12005548, wheels 10014039 and 10014040, handle 12033368, bearing 10014124, salt cap 00611319.
- [S8] Bosch DE shop titles: https://www.bosch-home.com/de/de/product/20007406 ("Geschirrkorb unten Unterkorb silber, 6 Klappstacheln dunkelgrau") and https://www.bosch-home.com/de/de/product/20001992 ("Geschirrkorb oben Oberkorb silber, 4 Klappstacheln dunkelgrau, Rackmatik") (titles read by me from saved copies; the pages give no dimensions).
- [S9] Bosch DE shop, sister baskets: https://www.bosch-home.com/de/de/product/20002434 (lower, 525 x 520 x 145 mm), https://www.bosch-home.com/de/de/product/00770441 (upper, 525 x 475 x 190), https://www.bosch-home.com/de/de/product/00778368 (upper, 527 x 515 x 162); dimensions extracted by me from saved copies. These are not this appliance's baskets.
- [S10] BSH catalogue photographs of the parts (media3.bsh-group.com/Product_Shots/...), named here by position, part number and image number: 0465_00668148_MCSA01860096_00668148_2 (lower arm underside), 0470_11010054_MCSA01860196_11010054_2 (upper arm with dock), 0770_00668270_25130582 / 25130584_11057829 (cutlery basket), 0750_12033326_20018787 / 20018788 (flip tine), 0820_20001986_22207753_20001992 (upper basket), 0741_10014124 (bearing), 0721_10014039 (wheel). Viewed this session as re-rendered copies (the REF_ crops).
- [S11] docs/research/machine.md (generic dossier; sections 0.3, 2, 3, 12 read this session).
- [S12] Web search this session for published dimensions of 20007406 and 20001992: none found; results repeated the sister-basket figures in [S9].
