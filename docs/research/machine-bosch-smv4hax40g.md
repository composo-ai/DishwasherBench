# Spotless machine dossier: Bosch SMV4HAX40G/13 (the owner's dishwasher) and its Auto 45-65 programme

> **Reference, kept as written (9 October 2026), and overridden in places.** Where this dossier
> and the first-hand measurements differ, `docs/reference/owner-measurements.md` and
> `machine-bosch-owner-update.md` take precedence. Two parts are history: the simulated
> programme is now Eco 50, not Auto 45-65 (`docs/design/scope.md`), and the checklist of
> section 6, written for the machine's owner, is replaced by the measurements still open in
> `docs/calibration/protocol.md`, which anyone with this model can take. The rating-plate
> photograph it cites is not published. The index of the documents is `docs/README.md`.

Author: machine specialist, merging four research angles (official documents, hardware and parts, programme behaviour, measurement from the owner's photographs). Date: 2026-10-09.
Scope: replaces the generic SPOT-60 baseline of `docs/research/machine.md` with this machine wherever a fact, a sister-model figure or a photo measurement exists, in the same parametric form (machine.md sections 3.2, 7.3, 12.1, 12.2). The simulated programme is Auto 45-65 as a 2 h 25 min run.

At a glance:

- The machine is a BSH GV640-platform dishwasher with three spray levels (lower arm, upper arm, a small roof spinner), a cutlery basket, no third rack, a sliding-lid dispenser that drops the tablet into a tray on the upper basket, and closed-door condensation drying against a water tank on the left wall.
- Counted on the owner's machine: 10 + 1 nozzles on the lower arm, 7 on the upper arm; 6 tine rows in the lower basket (2 hinged rows of 23 tines, 4 fixed rows of 6 to 7), running left-right so plates lean sideways; 5 tine rows in the upper basket (1 hinged), running front-back.
- Scaled from photographs: nozzle radii, every tine and wire position and the tub width (545 mm) to about 2 %; the height of each arm and basket to about 12 mm.
- Taken from sister sources (the platform's service manuals of 2008 and 2010 and BSH patents), not from documents for this machine: 2100 W heater at 2.5 K/min, a 3.1 L pre-fill tank, a rotary water switch with three outlets, pump duty of about 3 m at 25 to 30 L/min, the sensor's three decisions.
- Still estimated: every jet angle and bore, both arm speeds and senses, the pump curve, the roof outlet, the water switch's states and timing, and every step duration of Auto. Auto at 2:25 is reconstructed as 11.5 L and about 1.04 kWh with a wash heated to 65 C, no reheating afterwards, and a 69 C final rinse; two sister machines measured in a laboratory used 1.06 and 1.11 kWh.
- The printed plate limits are only just met by the measured heights: a 30 cm plate clears the upper arm by about 2 mm, and a 31 cm plate fits in one place only, astride the left middle row and the second rear row. Nothing in the vertical stack counts as validated until the owner has measured it.
- Section 6 is a 35-minute checklist for the owner that replaces most of the estimates; section 2.14 lists every disagreement between the four researchers and how it was settled.

## 0. How to read this dossier

### 0.1 Confidence tags

Every quantitative value carries exactly one tag.

| Tag | Meaning here |
|---|---|
| [VERIFIED] | Seen this session in the text of a fetched source, or counted or read off a fetched image, by me or by the researcher whose notes I merged. "(re-checked)" means I opened the source or the image again myself. |
| [RECALLED] | From memory, source not opened. |
| [ESTIMATED] | A derivation: a length scaled from a photograph, arithmetic on verified figures, or an engineering judgement. The reference dimension, the derivation and the likely error are given. Every [ESTIMATED] value is a calibration parameter. |

"Sister" means the figure comes from another BSH part, model or platform generation, or from a BSH patent; the source is named and the likely difference stated. On a row tagged "[VERIFIED] sister" the tag certifies that the source says so, not that this machine does: the two service manuals are eleven and thirteen years older than this machine, and a patent describes an embodiment, not a part. "Generic" means the SPOT-60 value of machine.md was kept because nothing better exists.

### 0.2 Source keys

Keys such as [B1], [K2], [O82] refer to section 9. In short: [O79] to [O83] are the owner's photographs; [B..] are Bosch documents for this model; [P..] are BSH part pages and part photographs for the parts listed against E-Nr. SMV4HAX40G/13; [K1], [K2] are two BSH-platform service manuals republished by Kueppersbusch (2008 and 2010); [PA..] are BSH patents; [T..] are laboratory tests; [F..] are forum posts; [M] is machine.md.

### 0.3 Coordinate frames

- Machine frame (as machine.md 0.3): origin on the lower spray arm axis, x to the right seen from the front, y from the door to the back, z up. Units mm.
- z = 0 is the top surface of the flat fine filter, the lowest visible surface of the tub floor. machine.md put z = 0 at "tub-floor level"; on this machine the floor is a stepped pan and the filter plate is the only well-defined datum.
- Lower-rack frame: origin at the centre of the rim in plan, same axes; the rack is taken as centred on the lower-arm axis when pushed in (section 2.3).
- Upper-rack frame: origin on the upper spray arm axis, which I place 30 mm in front of the lower-arm axis (section 2.1).

### 0.4 What I checked myself

The brief asked me to look at the owner's photographs wherever the photo measurements and the published figures disagree, and to verify every load-bearing claim against its primary source. Pixel coordinates are in the full-resolution originals in `docs/reference/owner-photos/` unless a BSH photograph is named, so each check can be repeated.

| # | Question | What I did | Result |
|---|---|---|---|
| 1 | Lower arm: 9 openings on top (photo researcher) or 10 (hardware researcher)? | IMG_9082, crop x 330-650, y 1580-1860 enlarged 5 times; compared with BSH part photographs 16260430 and MCSA01860095 | 10. The tip of the six-nozzle blade carries a hooded outlet: a raised hood centred at pixel (428, 1712) with its dark mouth at (410, 1692). The photo researcher logged it as "a light blob". Radius 225 mm. |
| 2 | Lower-arm nozzle radii | My own pixel picks in IMG_9082 put through the photo researcher's camera model (focal length from EXIF, their vanishing points, scale from the published 460 mm span) | 48, 94, 117, 140, 185, 225 mm on one blade; 65, 159, 206, 227 mm on the other. Within 4 mm of both researchers. |
| 3 | Which upper-basket tine rows are hinged? | IMG_9083, crops x 1500-2700, y 1300-3700 and x 3000-3800, y 300-3600; official product picture 16580356 [B11] | Only the row right of centre (black tines on a black rail, grey latch at mid-depth, 6 + 5 tines). The two short front-left rows are basket-coloured hairpin tines welded to the floor, with no latch. The photo researcher had them as hinged; the documents researcher was right. |
| 4 | Tub interior width: 545 mm, or about 500 mm as the hardware researcher's quick scaling suggested? | IMG_9080 with the photo researcher's solved camera pose; absolute scale from the 460 mm lower arm visible in the same picture | Back wall between its corners (pixels (1780, 900) and (3600, 900), or 20 px further out): 532 to 557 mm for a wall 230 to 260 mm behind the arm. Front opening between inner faces ((1250, 1000) and (4230, 1000)): 527 to 549 mm. So 545 +-12 mm; the 500 mm reading was a mis-pick. |
| 5 | Height of the upper arm above the lower arm | IMG_9080: the visible blade tip of the upper arm, end centre at pixel (2105, 468), intersected with a 230 mm circle about the arm axis | Top face of the upper arm 322 mm above the top face of the lower arm if the two arms are coaxial, 332 mm if the upper axis is 30 mm further forward. This does not depend on the basket scale. |
| 6 | Height of the lower arm above the filter | IMG_9082, hub crop x 2300-3300, y 1650-2500: visible stem 27.5 mm in diameter and about 36 mm long below a body about 14 mm thick | Top face about 50 mm above the cover and filter plate. The hardware researcher's 33 mm was a guess at how far the stem plugs in. |
| 7 | Filter cylinder position | IMG_9082 crop x 1300-4500, y 2000-3700 | The photo researcher's (-1, -66) is the top ring projected onto the floor plane without correcting for the ring's height; corrected it is about y = -80, and the published plate with a centred opening gives -85. |
| 8 | Rear tine rows of the lower basket | IMG_9081, crops x 1250-2850 and 2750-4400, y 1480-1900 | 15 tines leaning left and 8 leaning right in the second row, ball tips, a short stub below the rail, fold lever with a moulded arrow at the right-hand end. Confirms 23 tines at about 18 mm. |
| 9 | Rating plate | IMG_9079 read at 1500 x 2000 | As quoted in section 1.1. |
| 10 | Jet directions and rotation sense | BSH part photographs of the lower arm (two top views, two underside views) and of the upper arm | Section 2.6. The two hooded nozzles on the four-nozzle blade both point to the same side; that makes the lower arm turn clockwise seen from above. Low to moderate confidence. |
| 11 | Coarse filter 79 x 131 mm or 71 x 92 mm? | Re-read the Bosch shop text and looked at BSH photographs MCSA01868124 and 15856878 | The pleated micro filter is 71 x 92 mm; 79 x 131 mm is the coarse filter with its collar (the complete insert). |
| 12 | Cutlery basket compartments | BSH photograph 25130584 | Six compartments in a 2 x 3 layout, the two middle ones split again by thin removable dividers. |
| 13 | Do the printed plate limits fit the stack? | Thin-disc seating computed from the coordinates of section 2.3: rails, the rear and front rim wires, the floor cross wires | A 30 cm plate cannot sit on both rear rails; it rests on R2 and against the rear wall and tops out at 372 mm, 2 mm under the upper arm's blades at level 1. A 31 cm plate fits only astride ML and R2 (365 to 368 mm). Section 2.2. |
| 14 | Cutlery basket: a plain box? | BSH photograph 25130582 (900 x 907 px): arch centres at x = 213 and 572 px on a rim 780 px long; the retailer's key to its dimensions [P9]; IMG_9081, crop x 2230-3710, y 2000-4060 | No. Two arch-shaped tunnels cross it, 106 mm apart, and in the owner's photograph they sit over the two side-row rail lines. The published 128 mm is the depth in plan, not the height. Section 2.4. |
| 15 | Which way do the upper arm's tip outlets face? | BSH photograph MCSA01860195 (2024 x 640 px), crop x 1520-1780, y 405-540 enlarged 5.5 times; IMG_9083, crop x 1370-4400, y 1030-3370 | Each is a wedge-shaped hood whose mouth faces the blade tip: outward along the blade, at a low elevation. They cannot drive the arm. The blade axis at the tip is swept about 7 deg from the radial line. |
| 16 | Height of the tablet tray | IMG_9080, crop x 1200-4455, y 0-743; BSH photograph 22207753 of the upper basket | The handle's red top edge is level with the top wire of the basket's front wall, and that wall is low: about 55 mm. |
| 17 | Rear wall of the lower basket: does the rim dip? | IMG_9081, crop x 1600-4000, y 30-740; IMG_9080, crop x 1200-4285, y 1085-1830 | All four horizontal wires jog the same way over about 60 mm in the middle: the wall is set forward there by about 6 mm, a recess in plan for the feed-pipe riser. It is not a dip of the rim alone. |
| 18 | How far the riser stands proud of the rear wall | Silhouette of BSH's side view MCSA02588552 (992 x 2432 px) at 0.280 mm per pixel | 16.5 mm above the docking ports, 21 mm below them, 33 to 35 mm at the port block. |
| 19 | Heights of the coarse-filter crown and the salt cap | BSH photograph MCSA01868124 scaled by the 79 mm flange; IMG_9082 through a camera model, picks (2497, 2650), (3200, 2610), (2900, 2402) on the crown and (300, 2760), (1362, 2640), (880, 2372) on the cap | Crown top about 28 mm above the plate (20 to 34); cap top about 25 mm (15 to 33). Both poorly constrained; both must pass under the arm's underside at 36 mm. |
| 20 | Right-hand front tine row: 4, 5 or 6 tines? | IMG_9081, crop x 3284-4055, y 3113-3427 enlarged twice | 6: the tip of the innermost one is just clear of the cutlery basket. |

Repeatability. An independent analyst repeated the load-bearing measurements with their own pixel picks and camera fits. Lower-arm nozzle radii agree within 3.5 mm; lower-arm top face 52.7 mm above the filter (50 here); arm to arm 320 to 330 mm (322 to 332); tub width 538 to 566 mm (545); filter hole pitch 1.50 to 1.53 mm (1.47); docking ports 342 / 368 / 393 mm above the stub ends (345 / 371 / 398); lower-arm top 196 mm below the lower basket's rim plane (193). All counts agree. These differences are the honest size of the photo errors: 2 to 3 mm on a height, about 3 % on a width.

The scripts and crops behind these checks are working files, not in the repository (a hydraulic solve, the upper-arm drive, the energy balance, the plate seating, and the pixel-pick scripts for IMG_9080 and IMG_9082). The pixel coordinates above are the durable record.

### 0.5 Limits

- No ruler is in any photograph. Absolute scale rests on published part dimensions: the 460 mm span of both spray arms, the 260 x 130 mm filter plate, the 215 mm basket handle, the 230 mm cutlery basket, and the 525 mm width of four sister baskets. They agree to about 2 %.
- No source gives jet angles, nozzle bores, arm speeds, a pump curve, the water switch's position set or timing, or the step-by-step Auto sequence for this platform. Those parts of the specification are reconstructions; section 6 says how the owner can replace them.
- No document gives an interior dimension of the tub. Depth, height and both arm positions front to back are derived, they are mutually tight (section 2.1), and they stay on the owner's measuring list.
- Nothing here is validated. Where the text says a figure "is consistent with" or "reproduces" a printed value, it means only that one self-consistent set of estimates exists.
- Nearly everything rests on the four researchers' downloads, re-opened where the specification leans on them. One page was fetched new: Bosch's symbols guide [B14].

## 1. What the machine is

### 1.1 Identity

| Item | Value | Tag and source |
|---|---|---|
| Maker | Robert Bosch Hausgeraete GmbH, Carl-Wery-Strasse 34, 81739 Muenchen, Germany; "Made in Germany" | [VERIFIED] (re-checked) rating plate, [O79] |
| E-Nr. / FD / Type | SMV4HAX40G/13 / 0106 / SD6PW1B (serial number not reproduced) | [VERIFIED] (re-checked) [O79] |
| Electrical rating | 220-240 V, 50-60 Hz, 2000-2400 W, 10-16 A | [VERIFIED] (re-checked) [O79]; manual p. 48 [B1] |
| Production date | June 2021 (FD 0106: 01 + 20 = 2021, month 06) | [RECALLED] decoding rule; consistent with EPREL "on market from 2021-03-01" [VERIFIED] (re-checked) [B5] |
| Product | Bosch Serie 4 fully integrated dishwasher, 60 cm, 81.5 cm height class, UK market | [VERIFIED] [B4], [B8] |
| Rated capacity | 13 place settings | [VERIFIED] (re-checked) [B5]; [B1] p. 48 |
| Outer size H x W x D | 815 x 598 x 550 mm; niche 815-875 x 600 x 550 mm; depth with door open 1150 mm | [VERIFIED] (re-checked) spec sheet [B4] |
| Net / gross weight | 33.9 kg / 36.0 kg (product page: 33.6 kg) | [VERIFIED] [B4], [B8] |
| Energy label | class D, EEI 49.9; Eco 50: 0.836 kWh, 9.5 L, 295 min; cleaning index 1.121; drying index 1.061; 46 dB(A), noise class C | [VERIFIED] (re-checked) EPREL record 365247 [B5] |
| Control panel, left to right | Eco 50, Auto 45-65, Intensive 70, Express 65, Silence 50, Favourite | [VERIFIED] (re-checked) [O79] |
| Options | Remote Start, Extra Dry, Half Load, SpeedPerfect+, Machine Care | [VERIFIED] (re-checked) [B4] |
| The owner's programme | Auto 45-65, shown by the machine as 2:25 | owner's statement; the display itself is not in a photograph |

### 1.2 Platform

- The installation sheet shipped for this E-Nr. is headed "GV 640 Voll-I - 81,5 cm" [VERIFIED] [B6]. The spare-parts list for /13 uses the GV640 sump (00668102), water switch (00644996 with motor 00611329), lower spray arm (00668148), filters (00645037, 00645038), heat exchanger (00770952) and heat pump (12014980) [VERIFIED] [B9]. BSH therefore treats the machine as a member of its GV640 platform.
- The public 125-page Kueppersbusch service manual H7-71-07 (13.10.2010) says it describes "die Funktionsweise der Geraeteserie GV 640" [VERIFIED] (re-checked) [K2 p. 8]. Kueppersbusch sold BSH-built machines, and the parts retailer cross-references this machine's parts to Kueppersbusch numbers (lower arm 00668148 = Kueppersbusch 436713) [VERIFIED] (re-checked) [P1]. Hardware that keeps its part number can be taken as described there. Control software is eleven years newer: programme logic from [K1] and [K2] is the family pattern, not this machine's firmware.
- Type code SD6PW1B is the designation in the EU declaration of conformity (radio equipment, Home Connect) [VERIFIED] [B15]. Sisters with the same hardware: SMV4HAX48E (German market, 44 dB), SMS4HAI48E (free-standing), Siemens SN63HX.. [VERIFIED] [B12].

### 1.3 Features that matter to the simulation

| Feature | What it is on this machine | Tag and source |
|---|---|---|
| Spray levels | Three: a lower arm on the sump, an upper arm under the upper basket, and a small free-spinning roof rotor ("Dachkreisel", part 00611388) fed by its own channel of the rear feed pipe. No third arm | [VERIFIED] (re-checked) parts list [B9]; "Das Spruehsystem besteht aus 3 Spruehebenen: Dem unteren und oberen Sprueharm sowie einer Dachbrause" [K2 p. 102] |
| Cutlery | Six-compartment plastic basket standing in the lower basket; no third rack ("3rd Rack: N/A") | [VERIFIED] [B4], [B8]; (re-checked) [O80], [O81] |
| Upper basket | Rackmatic, three heights over a 5 cm range (so 25 mm apart, an inference); knife shelf left; two folding cup shelves right; one hinged tine line; tablet collecting tray in the front handle | [VERIFIED] [B1 p. 18-21], [B4], [B8]; (re-checked) [O83] |
| Lower basket | Two hinged rear tine rows, four fixed side rows, sparse floor, 8 wheels | [VERIFIED] (re-checked) [O80], [O81]; "2 foldable plate racks in bottom basket" [B4] |
| Alternating spray | A motor-driven disc ("Wasserweiche", part 00644996) on the sump selects the spray level; lower and upper arm normally run in turn. Which combinations of levels the production disc offers is not documented (section 2.8) | part [VERIFIED] [B9]; function [VERIFIED] sister (2010 platform manual) [K2 p. 99-100]; "If the upper and lower spray arms do not rotate alternately", replace the water switch [D1 p. 48] |
| Pump and heater | One "Heizpumpe" (part 12014980): brushless circulation pump with a heater on a tube in the same housing; 2100 W on the 2010 platform | part and "EcoSilence BLDC drive" [VERIFIED] [B9], [B4]; construction and wattage [VERIFIED] sister (2010 platform manual) (re-checked) [K2 p. 8, 66-69] |
| Drying | Condensation on the tub with a water-filled heat exchanger on the left wall; door stays closed; no fan, no zeolite, no automatic door opening | [VERIFIED] [B4], [B8] ("Door-opening sensor: no"); [B3] |
| Detergent | Sliding-lid dispenser at the top centre of the inner door; a tablet drops into the tray in the upper-basket handle ("DosageAssist") | [VERIFIED] [B1 p. 27-28]; "Tabs fallen in die Griffschale (Dosierassistent)" (re-checked) [K2 p. 79] |
| Soil sensing | Optical turbidity sensor in the sump ("AquaSensor III", part 00611323) | [VERIFIED] [B4], [B9], [B3] |
| Water softener | Ion exchanger with salt container under the floor, front left; regenerates every 6th cycle at the factory setting | [VERIFIED] (re-checked) [B1 p. 22-24] |
| Home Connect | WLAN; remaining time, phase and forecasts readable from the app | [VERIFIED] [B1 p. 34-35] |

### 1.4 How it differs from SPOT-60

| Topic | SPOT-60 (machine.md) | This machine | Evidence |
|---|---|---|---|
| Spray levels | lower arm, mid arm, top arm (135 mm radius), all rotating | lower arm, upper arm, roof spinner (52 mm rotor on a pipe outlet) | [B9], [K2 p. 102], section 2.6 |
| Arm radii | 247 and 232 mm | 230 mm both ("Sprueharmbreite: 460 mm") | (re-checked) [P1], [P2] |
| Upper arm nozzles | 8 up, 2 down | 7 up, none down: the lower rack gets nothing from above except run-off and the roof shower passing through the upper rack | BSH photo MCSA01860196 (re-checked), [O83] |
| Third rack | cutlery tray under the roof | none; cutlery basket in the lower rack | [B8], [O80] |
| Lower rack | 8 front-back tine rails, 25 mm pitch, 8 deg lean, 35 x 100 mm floor grid, 4 fold-down rows | 6 left-right rows: 2 hinged rows of 23 tines at 18 mm leaning 15 deg sideways, 4 fixed rows of 6 to 7 tines at 26 mm leaning 17 deg; floor of 5 front-back wires 67 to 117 mm apart | [O80], [O81], section 2.3 |
| Plates | lean front-back | stand in front-back planes and lean sideways | [O81]; manual drawings [B1 p. 19-20] |
| Upper rack | 4 cup shelves, 2 short tine rows per side | knife shelf left, 2 cup shelves right, 5 tine rows running front-back, 1 hinged line | [O83], [B4] |
| Stack-up | rack floors at 50 and 350/375/400; roof 650 | lower rack floor about 71; upper rack floor about 360/385/410; roof about 675 | section 2.2 |
| Dispenser | hinged lid swinging 110 deg into the tub; tablet falls onto the lower rack | sliding lid, nothing swings; tablet is caught in a tray on the upper rack and sprayed from below by the upper arm | [B1 p. 27], [K2 p. 79, 82] |
| Sump and filter | cylinder 60 x 105 mm, 40 mm in front of the axis; one 260 x 220 mm plate | cylinder 79 x 131 mm (micro filter 71 x 92 mm) about 85 mm in front of the axis; steel plate 260 x 130 mm in front, perforated plastic cover 259 x 95 mm around the arm stem | (re-checked) [P5], [P6], [O82] |
| Pump | H0 5.5 m at 3000 rpm (constructed) | about 3.1 m at 25 to 30 L/min (sister platform), 2000 to 3500 rpm and 200 to 400 mbar (BSH patent): jets about 7 m/s instead of 8.4 m/s | [K1 p. 63], [PA5], section 3.3 |
| Diverter | L, U (mid + top), A (all) | three outlets (lower arm, upper arm, roof spinner) on a rotary disc; single and combined supply are possible, but the production part's position set is not documented. A BSH patent embodiment has lower; upper; roof; lower + upper; upper + roof; closed, and nothing that feeds all three. The model alternates lower with upper + roof, which is an assumption | [K2 p. 99-100], [PA1] (re-checked), section 2.8 |
| Heater | 2000 W at 0.7 duty, 1.6 K/min | 2100 W at full duty, design rate 2.5 K/min (2010 platform manual; compatible with the rating plate) | (re-checked) [K2 p. 8, 67], [O79] |
| Fill | 3.0 L/min; 3.8 / 2.9 / 2.8 L | 2.5 L/min; 4.0 L first bath (printed for the pre-rinse programme); 2.5 L final rinse (2010 platform) and 2.5 L adopted for an intermediate rinse (2.9 L not excluded); next bath pre-stored in a 3.1 L wall tank | [K1 p. 29-30], [K2 p. 92, 120], [B2] |
| Drying | heat exchanger plus automatic door opening after 25 min | heat exchanger only, door closed | [B4], [B8] |
| Rinse aid | 3 mL | 1 mL per pulse on the 2010 platform, factory setting r05 here, so 5 mL if the rule still holds | [K2 p. 80], [B1 p. 25] |
| Programmes | ECO 50, AUTO 45-65, INTENSIVE 70, QUICK 60, GLASS 40, PRE-RINSE | Eco 50, Auto 45-65, Intensive 70, Express 65 (1 h), Silence 50, Favourite (pre-rinse), Machine Care | [B1 p. 16], [O79] |
| AUTO baseline | 13.0 L, 1.15 kWh, 135 min, final rinse 62 C | 11.5 L, about 1.04 kWh, 145 min, wash heated to 65 C and not reheated, final rinse 69 C | section 4 |

## 2. Evidence by subsystem

### 2.1 Tub and door

No BSH document, part page or patent states the interior dimensions. Everything dimensional in this table is derived and is on the owner's measuring list. The photographs fix the width; they cannot fix the depth, the height or where either arm stands front to back.

| Quantity | Value | Tag | Source and derivation |
|---|---|---|---|
| Tub and inner door material | stainless steel (floor, walls, inner door) | [VERIFIED] | "Stainless steel interior" [B4]; [O80], [O82] |
| Interior width | 545 mm (+-12) | [ESTIMATED] | My measurement in [O80] anchored on the 460 mm arm (check 4 in 0.4): 527 to 549 mm at the opening, 532 to 557 mm at the back wall. Supported by the lower basket: 525 mm outer width on sister baskets plus wheels and clearance. Generic: 546 |
| Interior depth, front flange plane to rear wall | 500 mm (+-15) | [ESTIMATED] | Carcass depth without door 515.5 mm in BSH's kitchen-planning model [B10] less the rear wall build-up. Generic: 500 |
| Lower-arm axis to rear wall | 265 mm (+-25) | [ESTIMATED] | Floor stubs of the feed pipe are 230 mm in front of the rear wall in BSH's scaled side view of part 11003118 [P3] (215 to 237 mm in an independent scaling) and sit 25 to 45 mm behind the arm hole in the sump cover [P6]. The floor-to-wall crease is 230 +-25 mm behind the axis in [O82] and 255 to 330 mm in [O80], depending on the floor height assumed at the crease, so the photographs do not settle it |
| Upper-arm axis to rear wall | 295 mm (+-20), so 30 mm in front of the lower-arm axis | [ESTIMATED] | Feed tube of the upper arm 270 mm long ("Rohrlaenge: 270 mm") (re-checked) [P2]; docking ports stand 34 mm proud of the rear wall in the scaled side view [P3]. A sister upper basket is 475 mm deep [P8], which centres it about 25 mm in front of the lower basket. The photographs cannot show this. Consequence: the upper arm then sweeps to y = -260, 25 mm beyond the flange plane, and fits only inside the door recess assumed in the next row; with a shallower recess the offset must be smaller |
| Door liner | recessed about 40 mm beyond the flange plane: both baskets and the upper arm's sweep reach into the recess | [ESTIMATED], at its upper limit | Inner door pressing 625 x 575 x 55 mm, 2903 g (re-checked) [P10]; lower basket 512 mm deep in a 500 mm tub. Depth budget: rear wall to liner is 265 + 275 = 540 mm as adopted, in an appliance 550 mm deep [B4] whose planning model has a 515.5 mm carcass and a 35 mm door (re-checked) [B10]. That leaves 10 mm in all for the rear wall's build-up and the door's outer skin, so the 265 mm, the 30 mm arm offset and the 40 mm recess cannot all be this large. Which gives way is for the tape measure (section 6, item 3) |
| Interior height, filter plate to roof | 675 mm (+-15) | [ESTIMATED] | Section 2.2. Generic: 650 |
| Opening height, sill to roof | about 625 mm | [ESTIMATED] | Inner door part 625 mm long [P10]; three-sided door seal 1800 mm [P11] |
| Floor shape | a shallow stepped pan: one pressed step a few centimetres in from the walls; filter and sump cover in the lowest part; raised ledges along both side walls for the basket wheels | [VERIFIED] qualitative | [O82] (re-checked) |
| Floor slope | 4 deg mean | generic | not measurable from the photographs |
| Floor pressings | two groups of three parallel beads in front of the filter, at x = -235 to -180 and +185 to +236, y = -155 to -185, each 51 mm long, 13 mm apart; a round dish about 75 mm across near the rear right corner at (+185, +160) | [ESTIMATED] +-15 mm | [O82], [O81] (photo researcher). They are pressings, not openings, and they are in the floor, not in the side walls |
| Salt container cap | grey screw cap with three lugs, front left of the filter; centre about (-187, -60); published 92 x 90 x 19 mm; top about 25 mm above the filter plate (15 to 33) | position [ESTIMATED] +-12; size [VERIFIED]; height [ESTIMATED] | [O82] corrected for the cap's height; [P12]. Height: the cap's 90 to 92 mm width fits the camera model of [O82] at 27 to 36 mm (check 19 in 0.4), a weak constraint. It lies 150 to 242 mm from the arm axis, under the sweep of the lower arm, whose underside is at 36 mm, so it cannot be higher than about 33 mm |
| Left wall | the heat exchanger lies against its outside; a round grille and two small plastic fittings (water inlet with splash cap, and the expansion opening) | [VERIFIED] presence | [O80]; [K2 p. 105-106] |
| Back wall | two embossed panels about 190 x 155 mm, and between them the flat two-channel feed pipe | [ESTIMATED] +-15 mm | [O80] |
| Rear feed pipe 11003118 | 680 x 275 x 55 mm, 240 g; riser on the rear wall, foot across the floor to two stubs in the sump cover, run under the roof to the roof spinner, three docking ports in a vertical row | [VERIFIED] (re-checked) | [P3]; BSH photos MCSA02588552, MCSA02588576 |
| Riser on the rear wall | stands 15 to 21 mm proud of the wall (16.5 mm above the docking ports, 21 mm below them); the port block 33 to 35 mm; front face 55 to 62 mm wide | [ESTIMATED] +-4 | silhouette of BSH's side view MCSA02588552 at 0.280 mm per pixel (check 18 in 0.4); width: 62 mm scaled in [O80], full-resolution x = 2580 to 2790 on a back wall 1820 px wide, against the published 55 mm envelope. The lower basket's rear wall is set forward in the middle to clear it (section 2.3) |
| Docking ports | 3, pitch 25 mm (26.7 mm scaled from the photo), centres 345 / 371 / 398 mm above the lower ends of the floor stubs (342 / 368 / 393 in an independent scaling) | count [VERIFIED]; heights [ESTIMATED] +-12 | hardware researcher's scaling of the side view at 0.280 mm per pixel |
| Roof | carries the forward run of the feed pipe and the roof spinner; nothing else | [VERIFIED] | [P3]; official picture 16580356 [B11] (re-checked) |
| Door hinge | axis along x near y = -250, z = +45 (+-30) | [ESTIMATED] | 1150 mm depth with the door open [B4] and the 813.5 mm high planning model [B10] give a hinge 178 to 213 mm above the kitchen floor; the filter plate is about 135 mm above it |
| Plan coverage | arm discs of 230 mm radius cover 61 % of the 545 x 500 mm plan; 39 % lies outside | [ESTIMATED] | 1 - pi 0.230^2 / (0.545 x 0.500) = 0.39 (SPOT-60: 0.30) |

### 2.2 Vertical stack-up

This is the part of the geometry where the researchers disagreed most (lower-arm top at 33 mm or 52 mm; lower-rack floor at 48 mm or 80 mm). I rebuilt it from five pieces of evidence, one piece of geometry and one inference.

1. Lower arm, from [O82]: stem 27.5 mm in diameter with 36 mm visible between the sump cover and the arm, body about 14 mm thick; the published part is 75 mm high overall with a 60 mm stem (re-checked) [P1], so 24 mm of stem is inside the bearing. Top face 50 mm above the cover. The photo researcher's independent check agrees: the filter plate measures 262 mm wide (published 260) only if it lies about 52 mm below the arm's top plane.
2. Arm to arm, from [O80]: top face of the upper arm 322 to 332 mm above the top face of the lower arm at the Rackmatic level in the photograph (check 5 in 0.4). The hardware researcher's independent figure from the scaled feed pipe is 339 mm at the top level.
3. Lower rack against the lower arm, from the two-view reconstruction of [O80] and [O81]: the arm's top face is 0.375 W below the plane of the rim joints (193 mm; 196 mm in the independent re-measurement) and the floor cross wires 0.335 W, where W is the distance between the left and right rim joints. Hidden assumption: in both photographs the basket stands pulled out on the open door. The 21 mm between arm and rack floor is therefore the value on the door's tracks, and it equals the value inside the tub only if those tracks are level with the tub's ledges. No source says they are. Everything that follows from the rack-floor height inherits this.
4. The scale W. The photo researcher fitted 508 +-10 mm. I use 515 mm: four sister baskets of the platform are 525 to 528 mm wide [P7] and must run on the same wheel tracks, which gives W = 515 to 518, and the cutlery basket then comes out 226 mm long against the published 230. All lower-rack lengths in this dossier are the photo researcher's values times 1.014.
5. The manual's table, [VERIFIED] (re-checked) [B1 p. 21]: largest item in the top basket 22 / 24.5 / 27 cm and in the bottom basket 30 (31 "as shown") / 27.5 / 25 cm at levels 1 / 2 / 3; level 1 is the highest position of the top basket.
6. Where a large plate sits. The basket's rear wall is 86 mm behind rail R1 and its front wall 68 mm in front of rail FL, so a large plate cannot sit centred on a pair of rails. In the rear rows a plate up to about 26 to 27 cm rests on R1 and R2; a larger one is pushed forward by the rear wall, rests on R2 alone and leans against the wall, which lifts it. A 30 cm plate leaning 15 deg then has its lowest point at 82 mm and its top at 372 mm above the filter (thin disc; check 13 in 0.4).
7. Inference: the photograph was taken with the upper basket at level 1, its highest position. Item 2 puts the underside of the upper arm's blades at 361 to 371 mm at the photographed level: at or just below the top of a 30 cm plate, within the measuring error. A basket level whose printed limit is 27.5 or 25 cm would leave 18 to 53 mm, so the photographed level is the one the 30 cm limit belongs to, and the true arm height is at or a little above the top of the measured band. If the photograph were at level 2, the arm at level 1 would be 25 mm higher still, the docking ports of the feed pipe would put its stub ends 20 mm above the filter plate and the roof near 700 mm, which the 625 mm door opening does not allow.

Adopted heights, z above the filter plate. Absolute values +-12 mm; differences between neighbouring rows +-8 mm. All [ESTIMATED].

| Level | z (mm) | Basis |
|---|---|---|
| Flat filter plate, sump cover | 0 | datum |
| Lower arm, underside outlet | 36 | body 14 mm thick |
| Lower arm, top face (nozzle exits 2 to 6 mm higher) | 50 | item 1 |
| Lower rack, floor cross wires (centres) | 71 | item 3 with W = 515: 0.040 W = 21 mm above the arm, measured with the basket on the open door |
| Lower rack, tine rails (centres) | 84 | 13 mm above the cross wires (photo researcher: 9 to 18 mm) |
| Lowest point of a plate standing in the rear rows | 76 to 77 up to 26 cm; 82 at 30 cm | on both rails (rail top 86) up to about 26 to 27 cm; on R2 and against the rear wall above that (item 6) |
| Lower rack, rear tine tips / side tine tips | 150 / 166 | tips 0.180 W and 0.150 W below the rim plane |
| Cutlery basket rim / top of its handle | 198 / about 290 | rim 0.088 W below the rack rim; 220 mm with handle [P9] |
| Lower rack, side rim / front rim (wire centres) | 243 / 216 | arm top 0.375 W below the rim; front rim 27 mm lower |
| Upper arm, blade underside, at Rackmatic level 3 / 2 / 1 | 324 / 349 / 374 | blade 11 mm thick; the hub is 30 mm deep [P2] |
| Upper arm, top face, at level 3 / 2 / 1 | 335 / 360 / 385 | item 2 gives 372 to 382 for level 1 (383 with the independent stem figure); the printed 30 cm limit needs at least 383 (items 6 and 7). 385 adopted: the lowest round value that admits the limit, with 2 mm to spare; 25 mm steps |
| Upper rack, floor wire tops, at level 3 / 2 / 1 | 360 / 385 / 410 | feed tube 17 mm in diameter runs between arm and floor |
| Roof spinner, lower face | 645 | 30 mm below the roof: pipe end plus the 21 mm cage [P4] |
| Roof | 675 | feed pipe 680 mm from the stub ends to its top; the top port is 393 to 398 mm above the stub ends and about 14 mm above the arm's top face at level 1, which would put the top of the pipe at 681 to 686. 675 is kept because the appliance is 815 mm high and the filter plate stands about 135 mm above the kitchen floor (section 2.1), which leaves no more. The 6 to 11 mm between the two figures is inside the scaling error of the port heights; it is one more sign that the stack is tight. The roof is hidden in every photograph |

What the stack does with the manual's table [ESTIMATED]. Plates are thin discs leaning at the tine angle; tops are in mm above the filter; the blade undersides are at 374 / 349 / 324 mm at level 1 / 2 / 3 (from the plate-seating script, a working file not in the repository).

| Where the plate stands | How it sits | Plate | Top | Clearance to the blades |
|---|---|---|---|---|
| Rear rows, level 3 | on R1 and R2 | 25 cm | 318 | 6 mm |
| Rear rows, level 2 | on R1 and R2, touching the rear wall | 27.5 cm | 343 | 6 mm |
| Rear rows, level 1 | on R2, leaning on the rear wall | 30 cm | 372 | 2 mm |
| Rear rows, level 1 | the same | 31 cm | 383 | fouls by 9 mm |
| Left side rows ML and FL, level 1 | on both rails only up to about 24 cm; above that on ML, leaning on the front wall | 30 cm | 371 | 3 mm |
| Left side rows, level 1 | the same | 31 cm | 381.5 | fouls by 7.5 mm |
| Astride ML and R2 (rails 148 mm apart), level 1 | on the two floor cross wires between them, about 8 mm lower than on the rear rails | 31 cm | 365 to 368 | 6 to 9 mm |
| Astride ML and R2, level 1 | the same | 32 cm | 375 to 378 | does not fit |

So in this geometry the largest plate that fits in the ordinary rows is 30 cm, and the largest that fits anywhere is 31 cm, standing astride the left middle row and the second rear row with its edges 93 mm behind the front rim and 103 mm in front of the rear rim. Those are the manual's two figures, and that position is my reading of its "as shown"; the drawing is compatible with it but too schematic to settle it (section 5.2). In the upper rack 22 / 24.5 / 27 cm items reach 630 mm at every level, 15 mm under the roof spinner. Two second-order effects on the 2 mm: over the 60 mm in the middle where the basket's rear wall is set forward for the riser, a 30 cm plate stands 1.5 mm higher still; and each degree of lean beyond 15 lowers its top by 1.5 mm.

None of this validates the stack. The arm height at level 1 was set to the lowest value that admits the printed 30 cm, and every absolute height carries +-12 mm. The exercise shows three things. One consistent set of heights exists. The 30 cm limit leaves almost no margin in it: the total slack between the printed limits of the two baskets and a 675 mm interior is about 17 mm, 2 mm under the upper arm and 15 mm under the roof spinner. And if a 31 cm plate is in fact meant to stand in the side rows or the rear rows, the upper arm is at least 10 mm higher than stated here. Real plates have depth and lean more than the tines, which lowers their tops by a few millimetres, so the thin disc is the worst case. The owner's tape measure, and one large plate tried in these positions (section 6, item 3), replace all of it.

### 2.3 Lower basket (part 20001979, now supplied as 20007406)

Lengths are from the two-view reconstruction of [O80] and [O81] by the photo researcher, rescaled to W = 515 mm (section 2.2 item 4); +-2 % for the scale plus the pick error shown. Rack-local coordinates: origin at the rim centre, x right, y back.

| Quantity | Value | Tag | Source |
|---|---|---|---|
| Construction | silver-grey coated steel wire; the two rear tine rows dark grey; bearings, wheels and handle light grey plastic; handle with red stripe | [VERIFIED] (re-checked) | [O80], [O81] |
| Rim, wire centres | 519 x 507 mm (outer about 525 x 512) | [ESTIMATED] +-8 | photo; sister baskets 525 x 520 x 145, 528 x 520 x 140, 528 x 515, 525 x 515 mm [VERIFIED] [P7]. No dimensions are published for this basket |
| Rim height above the floor cross wires | 172 mm at the sides and back, 145 mm at the front | [ESTIMATED] +-8 | photo; the sisters' published 145 mm matches the front |
| Front corners | chamfered: the side rim runs straight to 60 mm from the front, then cuts in 41 mm | [ESTIMATED] +-5 | [O81] |
| Rear wall | 4 horizontal wires including the rim; 5 uprights. Over about 60 mm in the middle (80 mm with the two ramps) all four wires are set forward by about 6 mm (5 to 8): a recess in plan for the feed-pipe riser | counts [VERIFIED] (re-checked); recess [ESTIMATED] | [O80], [O81] (check 17 in 0.4). The riser stands 15 to 21 mm proud of the tub's rear wall (section 2.1), so away from the recess the rim is at least 9 to 15 mm from that wall |
| Floor, front-back wires | 5, at x = -199, -86, -19, +98, +179 (gaps 113, 67, 117, 81 mm), each cranked sideways 10 to 20 mm in places | count [VERIFIED]; positions [ESTIMATED] +-10 | [O81] |
| Floor, left-right wires | 2 between the rear and side rows, at y = +32 and -43, plus the bottom wires of the front and rear walls; the four fixed tine rails also act as cross wires on their side | presence [VERIFIED]; positions [ESTIMATED] | [O81], [O80] |
| Largest floor opening | about 115 x 100 mm: anything smaller than a saucer can fall through between rows | [ESTIMATED] | from the two rows above |
| Tine rows | 6, all running left-right | [VERIFIED] (re-checked) | [O80], [O81] |
| Rear rows R1, R2 | rails at y = +167 and +68 (99 mm apart); each one rail with 23 tines: 15 leaning toward the left wall, then 8 leaning toward the right wall; pitch 18.25 mm with the last tine on the right 27 mm from its neighbour; tine bases at x = -208 + 18.25 k (k = 0 to 21) and +202; tines 66 mm high above the rail (68 mm long), leaning 15 deg; no front-back lean | counts [VERIFIED] (re-checked); lengths [ESTIMATED] +-3 mm, +-1.5 deg | [O80], [O81]. BSH's photo of flip tine 12033326, the only lower-rack tine part in the parts list, shows the same 15 + 8 pattern with the lever at the 8-tine end [VERIFIED] [P13] |
| V gap | the lean reverses between the 15th and 16th tine (x = +48 and +66): their tips are 53 mm apart (18.25 + 2 x 68 sin 15), a slot for a pot or large bowl | [ESTIMATED] | [O81] |
| Hinge | each rear rail turns in light-grey bearing plates (part 10014124, 80 x 57 x 17 mm) with a lever and moulded arrow at the right wall; "Push the lever forwards and fold down the prongs"; they click back up | [VERIFIED] | [O81] (re-checked); [B1 p. 20]; [P13]. Fold direction and folded height are not visible: both rows are up in every photograph |
| Side rows ML, MR | fixed, silver; rails at y = -80; 7 tines each at 26.0 mm pitch, bases at x = -+(206, 179, 152, 127, 101, 75, 50); 81 mm high; leaning 17 deg toward the nearer side wall | 7 counted on the left, 6 seen on the right (a seventh would be the innermost one, hidden where the rail passes through the cutlery basket's tunnel) [VERIFIED]; lengths [ESTIMATED] +-4 mm, +-2 deg; right-hand positions mirrored from the left, not measured | [O81], [O80] |
| Side rows FL, FR | fixed; rails at y = -186; 6 tines each at 25.4 mm, bases at x = -+(201, 177, 150, 125, 98, 73); same height and lean | 6 counted on the left and 6 on the right (re-checked: the tip of the innermost right-hand tine is just clear of the cutlery basket) [VERIFIED]; lengths [ESTIMATED]; right-hand positions mirrored from the left, not measured | [O81] (check 20 in 0.4) |
| Rails above the floor cross wires | 13 mm (centre to centre), hinged and fixed alike | [ESTIMATED] +-5 | line triangulation, photo researcher |
| Plate slots | rear zone: 21 usable gaps of 18.2 mm; a plate up to about 26 to 27 cm is held by R1 and R2 together, a larger one rests on R2 and leans on the basket's rear wall; a 26 cm dinner plate with a 25 to 30 mm deep profile needs every second gap, so about 10 to 11 dinner plates. Side zones: 6 gaps of 26 mm on each side between the middle and front rows, for plates up to about 24 cm on both rails; larger ones rest on the middle row and lean on the front wall. Largest plates: astride the left middle row and R2, resting on the two floor cross wires between them | [ESTIMATED] | from the rows above and section 2.2 |
| Wire thickness over the coating | rim about 5.5 mm, floor and wall wires about 4.0 mm, tines about 4.0 mm | [ESTIMATED] +-1 | pixel widths; highlights make this unreliable. Generic steel sizes 5.0 / 3.4 / 3.4 mm with 0.4 mm coating are compatible |
| Tine tips | ball ends | [VERIFIED] (re-checked) | [O81] |
| Wheels | 8 (4 seen on the left, 2 on the right); 35 mm diameter (parts 10014039 with stopper, 10014040 plain); stations y = +221, +125, -63, -159; wheel mid-planes about 534 mm apart | count 6 seen [VERIFIED], 8 [ESTIMATED]; size [VERIFIED] (re-checked) [P14]; positions [ESTIMATED] | [O81] |
| Handle | part 12033368, 215 x 52 x 47 mm, centred on the front rim | size [VERIFIED] (re-checked) [P15] | [O80] |
| Position in the tub | centred on the lower-arm axis within +-20 mm front-back and +-10 mm sideways | [ESTIMATED] | a 512 mm deep basket whose rear rim clears the riser (9 to 15 mm from a rear wall at +265) has its centre at y = 0 to -6; the pulled-out basket sits 6 mm right of the arm axis in [O80] |
| Empty mass | about 1.9 kg | [ESTIMATED] | sister baskets 1760 / 1942 / 2443 g [P7] |
| Largest plate | 30 cm; 31 cm "as shown", top basket at level 1 | the two figures [VERIFIED] (re-checked); where the 31 cm plates stand [ESTIMATED] | "Large plates up to a diameter of 31 cm can be arranged in the bottom basket as shown" [B1 p. 19-21]. The drawing shows four plates in front-back planes on the left, leaning left; it is a schematic of a basket with more tines per row than this one and does not name the rows, but it puts the plates' lowest point behind the middle row's rail line (section 5.2). In this basket's geometry a 31 cm plate fits only astride ML and R2 (section 2.2) |

### 2.4 Cutlery basket (part 11057829, formerly 00668270; accessory SMZ5100)

| Quantity | Value | Tag | Source |
|---|---|---|---|
| Type | free-standing grey plastic lattice basket with two hinged lid grids and a detachable carrying handle; "Moveable cutlery basket in lower rack" | [VERIFIED] | [B4]; [P9]; [O80], [O81] |
| Length x width | body 230 x 128 mm; about 149 mm wide over the two lid grids when they hang folded out, as in the owner's photographs | 230 and 128 [VERIFIED] (re-checked) [P9]; 149 [ESTIMATED] +-8 | [P9] prints "Breite: 220 mm, Hoehe: 128 mm, Laenge: 230 mm" under the key "Laengenangabe = Artikelbreite; Breitenangabe = Artikelhoehe; Hoehenangabe = Artikeltiefe": the 128 mm is the article's depth, the short side in plan, not its height. Photo rim 226 x 149 mm at W = 515. One retailer listing gives 231 x 210 x 158 mm for the same part, which I read as length, height with handle, and width over the lid lugs |
| Height | 220 mm with the handle up; body about 127 mm (+-6) | 220 [VERIFIED] (re-checked); body height [ESTIMATED], not published | [P9] (by the key above, the 220 mm is the article's height); body height triangulated from [O80] and [O81] at W = 515 |
| Mass | 338 g | [VERIFIED] (re-checked) | [P9] |
| Compartments | 6, in two rows of three ("sechs Besteckfaechern und Unterteilungen"); the two middle compartments are each split again by a thin divider, giving four sections of about 59, 46, 51 and 70 mm along the length in the owner's basket | count [VERIFIED] (re-checked) BSH photo 25130584 and [P9]; section lengths [ESTIMATED] +-5 | Bosch's accessory page for SMZ5100 says seven; the part fitted here has six |
| Walls and floor | open lattice, openings roughly 6 to 8 mm wide and 12 to 20 mm tall; the base is three separate feet with lattice floors | [ESTIMATED] | BSH photos 25130582, 25130584 scaled by the 230 mm length |
| Tunnels | two arch-shaped tunnels cross the full width between the feet, open below: centres 106 mm apart (+-5), about 60 and 64 mm from the two ends; clear width about 14 mm (arch outline 23 to 25 mm); they rise to about 0.8 of the body height, about 100 mm (+-8) | presence [VERIFIED] (re-checked) BSH photo 25130582 and [O81]; sizes [ESTIMATED] | arch centres 359 px apart on a rim 780 px long in BSH photo 25130582 (check 14 in 0.4). The spacing is that of the two side-row rail lines (106 mm); the tines there stand 81 mm above the rail, about 93 mm above the plane of the feet, so the tunnels clear them by only a few millimetres |
| Lid grids | present but folded out of use in the owner's photographs: each hangs down outside a long wall | [VERIFIED] | [O81] |
| Where it stands | as photographed: astride two parallel tine rails, which pass through the tunnels with their tines. It is at the front centre, long axis front-back, centre at rack-local (8, -133), over the ML/MR rail line (y = -80) and the FL/FR line (y = -186), where it covers the innermost tine of ML and of MR. A plain box at that position would intersect both rails and three or four tines. The same fit is available further left or right on those two lines, and probably on the rear rails R1 and R2 (99 mm apart, inside the play of the tunnels) | placement over the two rail lines [VERIFIED] (re-checked); position [ESTIMATED] +-6; the other positions [ESTIMATED] | [O81]; "Stellen Sie den Besteckkorb auf das Gitter der unteren Geschirrkoerbe" [P9] |

### 2.5 Upper basket (part 20001986, now supplied as 20001992)

Lengths are from the single calibrated view [O83], relative to the upper-arm axis, with the floor wires taken 25 mm above the arm's top face; +-2 % for that assumption plus pick error.

| Quantity | Value | Tag | Source |
|---|---|---|---|
| Outer width | 500 mm (+-20) | [ESTIMATED] | [O83]; sister baskets 520 to 527 mm over their roller plates [P8] |
| Outer depth | about 476 mm, spanning y = -228 to +248 from the arm axis | [ESTIMATED] +-25 | the rear rim is outside the frame of [O83]; sister 00770441 is 475 mm deep [P8]; floor wires span 402 mm |
| Wall height | about 120 mm at the sides and back; the front wall is low, about 55 mm (+-10) | [ESTIMATED] | sides and back not visible (generic-like). Front: in [O80] the handle, 47 mm tall [P15], hangs from the top front wire and nearly fills the wall (check 16 in 0.4); BSH photo 22207753 of the replacement basket shows the same low front |
| Floor, left-right wires | 12, pitch 36.5 mm, at y = +215, 178, 142, 105, 69, 36, -3, -40, -76, -112, -149, -187 | count [VERIFIED]; positions [ESTIMATED] +-4 | [O83] |
| Floor, front-back wires | 8 between knife shelf and cup shelves, at x = -159, -108, -41, +47, +89, +123, +158, +191: an 88 mm gap over the arm hub and feed tube, about 34 mm pitch in the right-hand cup zone | count [VERIFIED]; positions [ESTIMATED] | [O83] |
| Floor profile | not flat: every cross wire rises in a hump between x = +115 and +160 and has S-bends elsewhere; W-shaped in section | [VERIFIED] | [O83]; BSH photo 22207753 |
| Wire thickness over the coating | 3.5 mm | [ESTIMATED] +-0.5 | [O83] at 8.1 px/mm |
| Row A (rear left) and row B (rear, left of centre) | fixed, silver; at x = -112 and -52; 6 tall tines each at 36 mm pitch, y = +210 to +31; about 95 mm high | counts [VERIFIED] (re-checked); height [ESTIMATED] +-20 | [O83] |
| Rows A' and B' (front left) | fixed, silver hairpin tines (each a narrow wire loop with a ball tip); on the same lines as A and B; 9 tines each at 18.6 mm pitch, y = -12 to -163; short, about 45 mm | counts [VERIFIED] (re-checked); pitch [ESTIMATED] +-0.8; height [ESTIMATED] | [O83]. Saucers and small plates stand here in left-right planes, held by both rows 61 mm apart |
| Row C (right of centre) | hinged, black; bases at x = +60; 11 tines at 37 mm pitch, one per cross wire: 6 behind the latch at y = 0 and 5 in front, the two halves folding separately (parts 12033291 "rechts, hinten" and 12033302 "rechts, vorn"); 88 mm high, leaning 11 deg toward the right wall | counts [VERIFIED] (re-checked) and BSH photos of both parts; height and lean [ESTIMATED] +-6 mm, +-2 deg | [O83]; [B9]; "2 foldable plate racks in top basket" [B4] |
| Zone right of x = +90 | no tines; humped wires for cups and glasses under the cup shelves | [VERIFIED] | [O83] |
| Knife shelf (part 11037806) | grey plastic tray along the whole left side, 389 x 119 x 57 mm, 150 g; lattice floor, one comb row and two rows of slanted fins; folds up | size [VERIFIED] [P16]; presence (re-checked) | [O83]; [B1 p. 18-19] |
| Cup shelves (parts 12005549 short, 12005548 long) | two pieces in line on the right wall, 200 x 100 x 18 mm and 252 x 97 x 22 mm, each with about 5 stemware notches; fold up and can be lowered; folded up in the photograph | sizes [VERIFIED] [P16]; presence (re-checked) | [O83]; [B1 p. 19] |
| Handle and tablet collecting tray (part 12033368) | at the front centre, 215 x 52 x 47 mm, 77 g: a bar with red stripe and behind it an open-topped slotted trough | size [VERIFIED] (re-checked) [P15]; (re-checked) BSH photos 20018575, 20018499 | [O83], [O80]; "Children may get their fingers caught in the slots of the tablet collecting tray" [B1 p. 8]. Its top edge is level with the top wire of the front wall, about 55 mm above the floor wires (section 2.12) |
| Rackmatic | 3 levels ("Rackmatic 3-stage"), levers left and right outside the basket, adjustable loaded; "adjusted by up to 5cm"; can be set tilted, but the manual lists "Top baskets on right and left are not set to same height" as a cause of poor cleaning. Step 25 mm | levels and range [VERIFIED] (re-checked); step [ESTIMATED] | [B1 p. 18-19, 44]; [B8]. No document states the step: 5 cm over three stages gives 25 mm, the printed item limits step by 2.5 cm [B1 p. 21], and the feed pipe's ports scale to 26.7 mm |
| Guide rails | part 00668097, 460 mm long, 51 x 16 mm section, on both side walls | [VERIFIED] | [P16] |
| Docking | the arm's 270 mm feed tube is clipped under the floor by two hooks and ends at the rear in an upright plate with five positions: one open inlet in the middle and two closing cones above and two below, so that at each of the three heights the inlet meets one port of the rear pipe and the cones close the other two | count and arrangement [VERIFIED] (re-checked) BSH photo MCSA01860196; the closing function is a reading | [P2] |
| Empty mass | about 2.3 kg | [ESTIMATED] | sisters 2316 / 2364 g [P8] |
| Largest item | 22 / 24.5 / 27 cm at level 1 / 2 / 3 | [VERIFIED] (re-checked) | [B1 p. 21] |

### 2.6 Spray arms and nozzles

Lower arm, part 00668148.

| Quantity | Value | Tag | Source |
|---|---|---|---|
| Span | 460 mm, tip radius 230 mm | [VERIFIED] (re-checked) | "Sprueharmbreite: 460 mm" [P1]; pattern part 463 mm |
| Height, stem | 75 mm overall; stem 60 mm on the pattern part; stem 27.5 mm outside diameter | 75 and 60 [VERIFIED] (re-checked) [P1]; diameter [ESTIMATED] +-1.5 | [O82] |
| Mass, material | 69 g (pattern part); marked ">PP-TD20<" (polypropylene, 20 % talc) | [VERIFIED] (re-checked) | [P1]; BSH photos MCSA091315, MCSA01860097 |
| Shape | two blades, wider at the hub, slightly curved; domed hub cap about 40 mm across; six radial fins round the stem flange underneath | [VERIFIED] (re-checked) | BSH photos; [O82] |
| Mounting | plugged onto the sump bearing; pulls straight up, clicks back | [VERIFIED] | [B1 p. 39]; [K2 p. 102] |
| Top-face openings | 10: six on one blade, four on the other, at interleaved radii | [VERIFIED] (re-checked) | [O82]; BSH photos 16260430, MCSA01860095 |
| Radii, six-nozzle blade | 47, 93, 116, 140, 185, 225 mm | [ESTIMATED] +-4 | mean of three independent readings (hardware researcher on a BSH photo, photo researcher and my own picks on [O82]) |
| Radii, four-nozzle blade | 67, 159, 205, 226 mm | [ESTIMATED] +-3 | same |
| Pattern | sorted together the radii step by 20 to 26 mm from 47 to 226 mm with the two blades alternating: one nozzle per ring of equal width. No gap near 100 mm as on the Whirlpool DU750 | [ESTIMATED] reading | fit r = 44.5 + 22.7 k, residuals within 4 mm |
| Offset from the tip-to-tip line | six-nozzle blade 1 to 6 mm, four-nozzle blade 5 to 17 mm, on opposite sides (point-symmetric) | [ESTIMATED] +-3 | my picks in [O82] |
| Shapes | at 47, 67, 93, 140, 159 mm: round bores in raised rings (vertical); at 116 mm: a short slot in a square boss; at 185 mm: a larger round bore; at 205 mm: an oblong outlet in a hood ("chimney"); at both tips: oblong outlets in hoods | [VERIFIED] (re-checked) | [O82]; BSH photos |
| Sizes | round bores about 3.0 mm (2.7 to 3.3); the 185 mm bore about 3.8 mm; slots about 4 to 4.5 x 2 mm | [ESTIMATED] +-30 % | dark-opening sizes at 10.5 px/mm in [O82], seen 34 deg off the vertical; the true orifice may be smaller than the visible countersink |
| Hood directions | the tip hood of the six-nozzle blade opens along the blade, outward. The two hoods of the four-nozzle blade (205 and 226 mm) both open to the left-hand side seen walking from hub to tip, the tip one also outward | [VERIFIED] as an observation (re-checked) in BSH photos 16260430 and MCSA01860095; consistent with [O82] | angles cannot be measured |
| Underside | one outlet about 2.5 x 2.5 mm in the side of a small block set in a rectangular recess, near one tip at about 195 mm; it points sideways and slightly down | presence [VERIFIED] (re-checked) BSH photos MCSA01860096, MCSA091315; radius [ESTIMATED] +-12; which blade: not determined | "Er hat an der Unterseite eine Duese um das Flaechensieb zu reinigen und Schmutz ins Siebsystem zu spuelen" [K2 p. 102] |
| Rotation sense | clockwise seen from above | [ESTIMATED], low to moderate confidence | reaction to the two hooded jets of the four-nozzle blade. The hardware researcher read the same photographs as counter-clockwise; one look at the arm settles it |
| Rotation speed | not found | | section 3.4: about 32 rpm from the torque balance |

Upper arm, part 11010054 (replaces 11003122).

| Quantity | Value | Tag | Source |
|---|---|---|---|
| Span | 460 mm | [VERIFIED] (re-checked) | "Breite: 460 mm", "Sprueharmbreite: 460 mm" [P2] |
| Arm height, feed tube, assembly | 30 mm at the hub; tube 270 mm long, about 17 mm in diameter; whole assembly 495 x 460 x 75 mm, 149 g | [VERIFIED] (re-checked); tube diameter [ESTIMATED] +-3 | [P2]; [O83]. The same listing also prints "Armlaenge: 270 mm", which is the tube, not the arm |
| Mounting | hangs under the upper basket from the tube's elbow; held by a four-lobed nut; "Unscrew the upper spray arm and pull down to remove" | [VERIFIED] | [B1 p. 39]; BSH photo MCSA01860196 |
| Top-face openings | 7: on one blade a small round bore at 44 mm, slots at 132 and 162 mm and a tip outlet at 221 mm; on the other blade slots at 85 and 192 mm and a tip outlet at 221 mm | counts [VERIFIED] (re-checked) [O83], BSH photo MCSA01860195; radii [ESTIMATED] +-6 | mean of the hardware and photo researchers' readings |
| Sizes | slots about 5.0 x 2.2 mm in raised bosses, long axis along the arm; round bore about 2.2 mm; tip outlets about 3 mm long and 1.5 to 2.7 mm wide | [ESTIMATED] +-30 % | [O83] at 8.1 px/mm |
| Tip outlets | each sits in a wedge-shaped hood that rises toward the blade tip and has its mouth in the face turned to the tip: the jet leaves outward along the blade at a low elevation, toward the tub walls and corners; whether it also enters the tablet tray as the tip passes the front depends on an elevation that has not been measured. The blade axis at the tip is swept about 7 deg from the radial line | direction [VERIFIED] as an observation (re-checked); sweep [ESTIMATED] +-3 deg | BSH photo MCSA01860195 (check 15 in 0.4); [O83], hub at about (2800, 2090), outlets and slots along both blades |
| Underside | smooth except one small hole near the hub; no wash nozzles | [VERIFIED] (re-checked) | BSH photo MCSA01860196 |
| Drive, rotation sense and speed | not found. Nothing seen on the arm points sideways: the tip outlets face outward and the slots show no visible tilt | | the model tilts the four slots by 16 deg to obtain about 26 rpm, counter-clockwise. Tilt, speed and sense are placeholders (sections 3.2 and 3.4) |

Roof spinner, part 00611388, and the baking-sheet spray head.

| Quantity | Value | Tag | Source |
|---|---|---|---|
| Type | a white free-spinning rotor with 5 curved vanes in a clip-on cage at the front end of the roof run of the feed pipe; water from the pipe outlet strikes the vanes and is thrown out as a rotating shower. Not a spray arm | [VERIFIED] (re-checked) | BSH photos MCSA00748273, MCSA01886352; [K2 p. 102-103] |
| Size | 52 x 53 mm, 21 mm high, 10 g | [VERIFIED] (re-checked) | [P4] |
| Position | 245 mm in front of the rear wall, so about 20 mm behind the lower-arm axis; on the centre line | [ESTIMATED] +-20 | scaled side view of the feed pipe [P3] |
| Feed | its own channel of the feed pipe and its own outlet of the water switch | [VERIFIED] (re-checked) | "Das Zufuehrrohr hat 2 getrennte Wasserkanaele" [K2 p. 102] |
| Outlet bore, flow, droplet pattern | not found; the outlet is hidden by the rotor in every photograph | | assumed 6 mm, which gives about 9 L/min, a third of the upper level's flow; 4 to 9 mm would give 4 to 15 L/min while the upper arm's own flow stays within 15 to 17 L/min (section 3.3). The droplet speed and cone angle of section 3.2 are placeholders with no evidence behind them |
| Baking-sheet spray head (part 00612114) | 81 x 90 x 32 mm, 28 g, about 20 holes; replaces the upper basket, plugs into the middle docking port and turns to lock; at most 2 baking sheets and 2 grilles. "Check that the appliance is always operated with the top basket or the baking sheet spray head" | [VERIFIED] | [B1 p. 21]; [P4]. Not part of the baseline load cases |

### 2.7 Pump and heater ("Heizpumpe", part 12014980)

| Quantity | Value | Tag | Source |
|---|---|---|---|
| Construction | heater, two NTC sensors and pump in one housing, 135 x 90 x 90 mm; brushless DC motor; impeller and guide wheel that "leitet das Wasser gleichmaessig am Heizrohr entlang"; discharge to the water switch; inlet 35 mm, outlet 29 mm | size and label [VERIFIED] (re-checked); construction [VERIFIED] sister (2010 platform manual) (re-checked) | [P17], label "1BS3610-6AA"; [K2 p. 66-67] |
| Heater | heating tracks on a coated metal tube; 2100 W ("Verrohrtes Heizelement (2100 W)") | [VERIFIED] sister (2010 platform manual) (re-checked) | [K2 p. 8, 67]. A replacement heater for this pump family is sold as 2080 W [P17] |
| Heater resistance cold | 21 +-2 ohm between contacts 2 and 4 at 25 C | [VERIFIED] sister (2010 platform manual) (re-checked) | [K2 p. 68] |
| Reconciliation | 21 ohm cold would be 2519 W at 230 V; the rating plate (2000 W at 220 V, 2400 W at 240 V) behaves as 24.1 ohm for the whole appliance, about 2195 W at 230 V of which roughly 2100 W is heater. So the track resistance rises about 19 % when hot and the heater is 2100 W at 230 V, 2290 W at 240 V | [ESTIMATED] | arithmetic on this machine's rating plate [O79] and the two platform figures |
| Design heating rate | "Die Heizung soll das Wasser um 2,5 C / min erwaermen"; slower heating is treated as scaling | [VERIFIED] sister (2010 platform manual) (re-checked) | [K2 p. 67, 69] |
| Over-temperature | heater off when the inlet water is above 75 C | [VERIFIED] sister (2010 platform manual) (re-checked) | [K2 p. 67] |
| State detection | the motor current distinguishes no water, too little water, enough water and a blocked pump; water level is checked this way in pre-rinse and cleaning and topped up if needed | [VERIFIED] sister (2010 platform manual) (re-checked) | [K2 p. 67, 91] |
| Impeller speed in operation | "typisch 2000 bis 3500 Umdrehungen pro Minute" | [VERIFIED] sister (BSH patent) (re-checked) | [PA5]: a typical figure for the design, not a specification of this part |
| Pressure rise | "typically 200 to 400 mbar" between suction and discharge | [VERIFIED] sister (BSH patent) (re-checked) | [PA5] |
| Flow | "beispielsweise in einer Groessenordnung von 20 bis 30 l/min" | [VERIFIED] sister (BSH patent) (re-checked) | [PA4] |
| Sister platform (2008, single-phase pump) | head 3.1 m, delivery 25 to 30 L/min, running current 0.31 A; elsewhere in the same manual: head 3.0 to 4.0 m, delivery 17 to 63 L/min | [VERIFIED] sister (2008 platform manual) (re-checked) | [K1 p. 63, 42]. A different motor, but the same job: one spray level at a time through the same kind of arm |
| Spray pressure by programme | Silence: "an especially adapted Eco 50 C programme, a reduced spray pressure and extended cleaning phase". Intensive 70: "uses high temperatures and increased spray pressure" | [VERIFIED] (re-checked); the second is Bosch's wording for the range, not for this model | [B8] for Silence; Bosch's symbols guide [B14] for Intensive 70. Neither gives a figure |
| Pump curve, speed per programme, electrical power | not found | | section 3.3: curve anchored on the sister figures |

### 2.8 Water switch (diverter), part 00644996 with motor 00611329

| Quantity | Value | Tag | Source |
|---|---|---|---|
| Function | "Die Wasserweiche steuert den Wasserweg der 3 Spruehebenen": motor with cam disc, pulse switch and a closure disc on the sump; holes of different size open the way to each level; "Durch die Anordnung der 5 Oeffnungen in der Verschlussscheibe ist die gleichzeitige oder wechselseitige Ansteuerung mehrerer Ebenen moeglich" | [VERIFIED] sister (2010 platform manual) (re-checked) | [K2 p. 99-100]. Part 00644996 is in this machine's parts list [B9] |
| Outlets | three: lower arm, upper arm, roof spinner | [VERIFIED] | this machine's parts list has the two-channel feed pipe and the roof spinner [B9]; "3 Spruehebenen", two separate channels in the feed pipe (re-checked) [K2 p. 99, 102] |
| Positions of the production part | not documented. All that is on record is three outlets and that single and combined supply are possible | | [K2 p. 100] |
| Positions in a BSH patent embodiment | six, 60 deg apart: P1 closed; P2 lower + upper arm together; P3 roof spray only; P4 upper arm only; P5 lower arm only; P6 upper arm + roof spray; nothing feeds all three levels | [VERIFIED] sister (BSH patent) (re-checked) | [PA1], description of Fig. 6. That embodiment's disc has seven round openings (DO1 to DO7). The production disc has five according to [K2 p. 100] and six apertures in BSH's photo 15856104 of the part (one long oval, three round ones, a keyhole near the hub, one very small hole), so its position set may differ. The model takes the patent's six as the candidate set and uses two of them |
| Pressure loss | "beispielsweise lediglich 20 mbar" | [VERIFIED] sister (BSH patent) (re-checked) | [PA1] |
| Motor | synchronous, "220/240V~ 50/60Hz 4/4.8r/min 4W CCW" on the part's label | [VERIFIED] (re-checked) | BSH photo MCSA091270 [P20]. [K2 p. 100] prints 120 V, 5 W, 5/6 per minute for an older variant; the label on the part fitted here wins |
| Time per 60 deg step | about 2.5 s | [ESTIMATED], factor 2 | 4 rpm if the disc turns at motor speed; the gear ratio is not documented |
| Pump speed at change-over | reduced while the switch moves, to avoid noise | [VERIFIED] sister (BSH patent of 1999) | [PA9] |
| Sister platform (2008) | "Wechselspuelen": upper or lower basket, high pressure; "Zweikorb": both, medium pressure; for the fixed programmes only the lower basket is sprayed until the wash temperature is reached | [VERIFIED] sister (2008 platform manual) (re-checked) | [K1 p. 44, 8] |
| Sequence and dwell times in Auto | not found | | assumed lower 60 s, upper + roof 60 s. The dwell is generic and the pairing of the upper arm with the roof spinner is my choice; lower / upper with the roof fed separately, or not at all, is as defensible |

### 2.9 Fill, drain and softener

| Quantity | Value | Tag | Source |
|---|---|---|---|
| Supply | 0.5 to 10 bar; tap must deliver 10 L/min; cold fill is the factory setting, hot fill up to 60 C possible | [VERIFIED] (re-checked) | [B1 p. 48, 33] |
| Path | Aquastop valve, inlet channel of the heat exchanger with impeller flow sensor and air gap, softener, back into the heat exchanger, into the tub | [VERIFIED] sister (2010 platform manual) (re-checked) | [K2 p. 90] |
| Metering | by flow-sensor pulses only; no pressure switch in this machine's parts list; the quantity for the final rinse is filled during the intermediate rinse and held in the heat exchanger | metering rule and tank use [VERIFIED] sister (2010 platform manual) (re-checked); absence of a pressure switch [VERIFIED] | [K2 p. 91]; [B9] |
| Fill rate | 2.5 L/min | [ESTIMATED] | service step S:12 fills "1,5 l" in "ca. 36" s (re-checked) [K2 p. 120]; sister platform: valve 2.75 L/min, flow sensor nominal 2.5 L/min at 208 pulses per litre (re-checked) [K1 p. 29-30] |
| Heat exchanger content | 3.1 L ("Waermetauscher voll (enthaelt 3,1 l Wasser)"); "Fuer das Klarspuelen wird ein gefuellter Waermetauscher erwartet (2,5 l von 3,1 l Fuellmenge)" | [VERIFIED] sister (2010 platform manual) (re-checked) | [K2 p. 120, 92] |
| First bath | 4.0 L | [ESTIMATED] | the stand-alone pre-rinse programme uses 4.0 L in one bath [VERIFIED] (re-checked) [B2] |
| Later baths | 2.5 L for the final rinse; 2.5 L adopted for an intermediate rinse, with 2.9 L not excluded | [ESTIMATED] | the final-rinse quantity above; Intensive 70 is printed as 11.5 to 14.0 L, a step of exactly 2.5 L [B2]. A BSH patent example gives cleaning 3.9 L, intermediate rinse 2.9 L, final rinse 2.5 L [VERIFIED] sister (BSH patent) (re-checked) [PA6]. With 2.9 L and no separate filter flush, Eco comes to 9.4 L against the printed 9.5 and the 9.3 and 9.4 L measured on two sisters [T1]: as good a fit as 2.5 L plus a 0.5 L flush (section 4.2) |
| Water left after a drain | 160 to 180 mL in the sump after a normal drain; 60 to 100 mL after a drain with three extra 7 s pump bursts | [VERIFIED] sister (BSH patent) (re-checked) | [PA6] |
| Drain pump (part 00631200) | brushless, 70 x 70 x 70 mm, bayonet fixing under a removable cover beside the filter; detects idling, blockage and a kinked hose by motor current | part [VERIFIED] [B9]; description [VERIFIED] sister (2010 platform manual) | [K2 p. 71]; [B1 p. 45-46] |
| Drain time | a cancelled programme "ends after approx. 1 minute" of pumping | [VERIFIED] | [B1 p. 31] |
| Drain rate | not found for this pump; sister platform 10 L/min at 0.9 m | [VERIFIED] sister | [K1 p. 35]. Generic: 16 L/min |
| Filter flush at drain (sister platform) | "wird 3x im Wechsel fuer 5 Sekunden das Wasser umgewaelzt und abgepumpt": three times, 5 s of circulation alternating with 5 s of draining, so the filter is flushed in both directions (not at programme start) | [VERIFIED] sister (2008 platform manual) (re-checked) | [K1 p. 26, 35] |
| Softener | hardness settings H00 to H07, factory H04 (16 to 20 Clarke degrees); salt capacity about 1.3 kg | settings [VERIFIED]; salt capacity [VERIFIED] sister (2010 platform manual) | [B1 p. 22-23]; [K2 p. 84] |
| Regeneration | every 6 washing programmes at the factory setting; adds at most 7 min, 5 L and 0.05 kWh; "takes place before the end of the main rinse cycle in all programmes" | [VERIFIED] (re-checked) | [B1 p. 24] |

### 2.10 Filters

The manual names three parts: micro filter, fine filter, coarse filter [VERIFIED] [B1 p. 37-38]. In the parts list the flat sheet 00645037 is "Filter-fine" and the cylinder set 00645038 "Filter-micro".

| Stage | Value | Tag | Source |
|---|---|---|---|
| Flat fine filter 00645037 | perforated stainless sheet 260 x 130 x 14 mm with a turned-down rim and a 54 mm round opening, in front of the arm; x = -130 to +130, y = -150 to -20 | size [VERIFIED] (re-checked) [P5]; position [ESTIMATED] +-8 | [O82]: 261 mm wide, rear edge about 20 mm in front of the arm axis |
| Its perforation | round holes on a 60 deg lattice, pitch 1.47 mm; hole about 0.85 mm; open fraction about 0.30 (0.907 x (0.85 / 1.47)^2); open area about 88 cm2 over roughly 290 cm2 of perforated sheet | pitch [ESTIMATED] +-0.1 (Fourier analysis of [O82]; 1.5 mm from a BSH photo; 1.50 to 1.53 mm in the independent re-measurement); hole [ESTIMATED] +-0.15; open fraction 0.21 to 0.42 for a hole of 0.70 to 1.00 mm | photo and hardware researchers |
| Sump cover 12038407 | grey plastic plate 259 x 95 x 26 mm, straight front edge against the flat filter, arc-shaped rear edge; perforated fields between radial ribs, holes about 1.25 mm at about 2.1 mm pitch; a 30 mm hole for the arm stem and two sockets (about 21 and 16 mm) for the feed-pipe stubs; two Torx screws; y = -20 to +75 | size [VERIFIED] (re-checked) [P6]; rest [ESTIMATED] | [O82]; BSH photos 26144163, 26144165. Open area about 26 cm2 [ESTIMATED] |
| Coarse filter | grey plastic insert with vertical bars and two locking catches: a four-lug crown about 71 mm across, below it a 79 mm flange that rests on the plate, and a narrow body that passes down through the 54 mm opening and through the micro filter; 131 mm long overall; turned anticlockwise to lift the whole filter system out. The crown is a ring about 11 mm tall whose top stands about 28 mm above the plate (20 to 34) | sizes [VERIFIED] (re-checked); the reading of which figure is which part and the crown's height [ESTIMATED] from the photographs | "Grobsieb mit einem Durchmesser von 79 mm und einer Hoehe von 131 mm" [P5]; [B1 p. 38]; crown measured 72 +-5 mm in [O82]; proportions in BSH photo MCSA00479915. Height: 205 px from the flange to the crown's far end at 0.135 mm per pixel in BSH photo MCSA01868124; the camera model of [O82] allows 15 to 40 mm (check 19 in 0.4). The crown lies 47 to 123 mm from the arm axis, under the lower arm, whose underside is at 36 mm |
| Micro filter | pleated mesh cylinder 71 mm in diameter and 92 mm high, hanging below the plate around the coarse filter; pulled down off the assembly for cleaning | [VERIFIED] (re-checked) | "Feinsieb mit einem Durchmesser von 71 mm und einer Hoehe von 92 mm" [P5]; "gewellter Feinfilterzylinder" with "1,5 fache Filterflaeche" on the 2010 platform [K2 p. 73] |
| Micro mesh | not published for the part. BSH patent ranges: mesh 150 to 250 um, open share 35 to 45 %, area 14 to 28 cm2 per place setting (preferably 18 to 24) | [VERIFIED] sister (BSH patent) (re-checked) | [PA2] |
| Micro mesh adopted | 0.20 mm openings, open fraction 0.37, 230 cm2 (a 65 x 75 mm mesh band pleated 1.5 times; the patent's range for 13 place settings is 182 to 364 cm2) | [ESTIMATED] | |
| Cylinder position | axis at (0, -85) | [ESTIMATED] +-8 | check 7 in 0.4 |
| Flow paths | water falling into the coarse filter reaches the inside of the micro cylinder and leaves radially through the mesh to the circulation pump; a second stream passes the flat filter and the cover; what stays inside the cylinder goes to the drain pump | [VERIFIED] sister (BSH patent, 2010 platform manual) | [PA2]; [K2 p. 73] |
| Self-cleaning | the underside outlet of the lower arm washes the flat filter | [VERIFIED] sister (2010 platform manual) (re-checked); the outlet itself is on this machine's arm | [K2 p. 102]; section 2.6 |
| Blockage alarm | "E:92-40 ... Filters are soiled or blocked" | [VERIFIED] | [B1 p. 42] |

### 2.11 Sensors

| Sensor | What is known | Tag | Source |
|---|---|---|---|
| AquaSensor (part 00611323) | an infrared diode and a photodiode facing each other in a U-shaped translucent housing in the sump; the measurement is evaluated in turbidity ranges whose values are stored in the electronics; "Der Aquasensor ist im Vorspuelen, im Reinigen und am Ende des Reinigens aktiv"; calibrated in every run in which it is active; on a failed calibration the reading is set to "turbid" and the longest sequence runs | part and "AquaSensor III" [VERIFIED] [B9], [B4]; working [VERIFIED] sister (platform manuals of 2008 and 2010) (re-checked) | [K2 p. 82]; [K1 p. 19]; [B3] |
| Temperature | two NTCs (10 kohm at 25 C) in the heater tracks | [VERIFIED] sister (2010 platform manual) (re-checked) | [K2 p. 67-68] |
| Water quantity | impeller with magnet and reed switch in the inlet channel of the heat exchanger | [VERIFIED] sister (2010 platform manual) | [K2 p. 88] |
| Water level and load | no level sensor in the tub: the pump electronics judge the level from the motor current. Bosch's "LoadSensor" is described as "a rotary speed sensor, which recognises the water level"; it is not listed for this model, although the manual says running time depends on "the quantity of tableware" | method [VERIFIED] sister (2010 platform manual); the manual's wording [VERIFIED] | [K2 p. 67, 91]; [B13]; [B1 p. 15] |
| Leak, door, salt, rinse aid | float switch in the base pan; Hall sensor on the door; light barriers for salt and rinse-aid level | [VERIFIED] sister (2010 platform manual) | [K2 p. 75-84] |
| Thresholds, pulses per litre | not found | | |

### 2.12 Dispenser and tablet path

| Quantity | Value | Tag | Source |
|---|---|---|---|
| Unit (part 00755073) | one combined detergent and rinse-aid unit, 120 x 105 x 65 mm, 217 g; detergent chamber on the left, rinse-aid reservoir on the right | [VERIFIED] (re-checked) | [P18]; [B1 p. 12, 27] |
| Position | "in der Mitte der Tuere an der Tueroberseite": on the door centre line at the top of the inner door; cut-out about 133 x 90 mm with its centre about 138 mm below the top edge of the inner door | position [VERIFIED]; cut-out [ESTIMATED] +-10 | [K2 p. 82]; BSH photo of inner door 00680311; manual overview drawing [B1 p. 12] (re-checked): unit on the centre line, chamber centre about 22 mm left of it |
| Chamber centre in the machine frame | x = -22, on the door liner, z = 510 (+-30) | [ESTIMATED] | 138 mm below a roof at 675, chamber in the lower half of the unit |
| Fill marks | 15, 25 and 50 mL; "20 ml - 25 ml detergent is sufficient for normal soiling"; one tablet, laid flat | [VERIFIED] (re-checked) | [B1 p. 27-28] |
| Lid | a flat spring-loaded cover sliding in the plane of the door; with the door shut it slides upward and uncovers a chamber facing the tub; released by a coil through a lever | [VERIFIED] | [B1 p. 27] drawing (re-checked); [K2 p. 79] |
| Actuation | the first coil pulse releases the lid; the mechanism then switches over so that later pulses drive the rinse-aid pump; opening the door resets it | [VERIFIED] sister (2010 platform manual) | [K2 p. 79-80] |
| Rinse aid | reservoir 80 mL; "Bei jedem Impuls wird 1 ml Klarspueler zugegeben. Die Einstellstufe ... entspricht den Impulsen"; settings r00 to r06, factory r05 | reservoir and 1 mL per pulse [VERIFIED] sister (2010 platform manual) (re-checked); settings [VERIFIED] | [K2 p. 80]; [B1 p. 25, 32] |
| Rinse-aid dose | 5 mL at the factory setting, if the 2010 rule still holds | [ESTIMATED] | 5 pulses x 1 mL |
| Foam limit | some rinse aids foam strongly in liquor below about 35 C | [VERIFIED] sister (BSH patent) (re-checked) | [PA6] |
| Tablet path | "Tablets will fall into the tablet collecting tray and dissolve in the right dosage"; the upper arm sprays the tray from below; powder and liquid "spread around the washing tank" | [VERIFIED]; the spraying from below is from the 2010 platform manual | [B1 p. 28]; [K2 p. 79, 82]. Which jets do it is not known: at the front the tray lies over the outer 40 to 50 mm of the upper arm's sweep, above the slot at 192 mm radius and the two tip outlets at 221 mm (section 2.6) |
| Tray height | rim about 55 mm above the upper-rack floor wires (+-10), so at about 465 / 440 / 415 mm above the filter at level 1 / 2 / 3; a tablet falls about 30 to 80 mm from the chamber's lower lip (at about 492) to the rim | [ESTIMATED] | the handle's red top edge is level with the top wire of the basket's low front wall in [O80] (check 16 in 0.4); the part is 47 mm tall [P15]; an independent placement of that edge in [O80] gives 45 to 65 mm above the floor. Constraint: the rim must be below the lip at level 1, which holds here by 27 mm against a +-30 mm error on the chamber height |
| Release time | "at the optimum time during the programme"; not stated | | assumed 60 s after the start of the main-wash circulation |
| What blocks it | "Lid of the detergent dispenser is blocked by tableware items and will not open fully"; "Do not place tableware or fragrance dispensers in the tablet collecting tray"; a tablet stood on edge can jam the lid | [VERIFIED] | [B1 p. 43-45]; [B3] |

### 2.13 Drying: the heat exchanger

| Quantity | Value | Tag | Source |
|---|---|---|---|
| Part 00770952 | transparent plastic tank on the outside of the left side wall, 670 x 435 x 42 mm, 1246 g, held against the wall by three latches; holds 3.1 L | size and mass [VERIFIED] (re-checked); 3.1 L and the fixing [VERIFIED] sister (2010 platform manual) (re-checked) | [P19]; [K2 p. 116, 120]. A BSH patent describes such a tank as about 2 cm thick with "beispielsweise 3 bis 4 l" [PA3] |
| What the moulding contains | inlet channel with flow sensor and air gap, storage chamber, drain channel with float-operated vent, expansion opening to the tub, outlet valve at the bottom | [VERIFIED] sister (2010 platform manual) | [K2 p. 90, 104-109] |
| Use during the wash | "Waehrend des Reinigens wird der Waermetauscher befuellt. Die Fuellung soll vorgewaermt werden und fuer den Zwischenspuel- oder Klarspuelvorgang bereitstehen" | [VERIFIED] sister (2010 platform manual) (re-checked) | [K2 p. 92] |
| Use in drying | the tank is filled with cold water in at least three portions spread over the drying step; moisture condenses on the cooled wall, runs down and is pumped out; the tank stays full for the next run, whose first liquor it supplies | portioned filling and reuse [VERIFIED] sister (BSH patent, 2010 platform manual) (re-checked); condensation and pump-out [VERIFIED] | [PA7]; [B3]; "Der Waermetauscher muss auch nach laengerer Standzeit gefuellt sein" [K2 p. 115] |
| Door | closed throughout; no automatic opening, no fan | [VERIFIED] | [B4]; [B8] |
| Thermal contact | 25 W/K between tub wall and a full tank | [ESTIMATED] | programme researcher's model; a calibration parameter |
| Advice | "Only remove tableware 30 minutes after the programme has ended"; plastics dry poorly | [VERIFIED] | [B3] |

### 2.14 Conflicts between the researchers, and how I resolved them

| # | Conflict | Decision | Why |
|---|---|---|---|
| 1 | Lower arm: 9 top-face openings (photos) or 10 (hardware) | 10 | I looked: the tenth is the hooded outlet on the tip of the six-nozzle blade (0.4, check 1). Both BSH photographs show it too |
| 2 | Lower-arm top face 33 mm (hardware) or 52 mm (photos) above the filter | 50 mm | the stem is visibly 36 mm long in [O82]; 33 mm was an assumption about insertion depth |
| 3 | Lower-rack floor 48 mm or 80 mm | 71 mm | follows from decision 2 and the basket scale (2.2 items 3 and 4); measured with the basket on the open door |
| 4 | Basket scale: photo fit 508 mm, sister baskets imply 515 to 518 mm | 515 mm | the sister baskets' width and the cutlery basket's published length favour it; inside the photo researcher's +-10 mm |
| 5 | Tub width 545 mm, or 500 mm from a quick scaling of [O80] | 545 mm | my own measurement in [O80] against the 460 mm arm gives 527 to 549 mm |
| 6 | Upper-basket hinged rows: A', B' and C (photos) or only the right-hand line (documents) | only C, in two halves | I looked: A' and B' are basket-coloured and welded; the parts list has only "rechts, vorn" and "rechts, hinten" flip tines; the official picture shows one dark row |
| 7 | Replacement baskets sold with "6 Klappstacheln" (lower) and "4 Klappstacheln" (upper) against 2 and 2 on the spec sheet | 2 and 2 | the owner's baskets are the evidence; the replacement parts are a richer variant |
| 8 | Coarse filter 79 x 131 mm (documents) or 71 x 92 mm (hardware) | coarse 79 x 131 mm, micro 71 x 92 mm | the shop text says so literally and the two BSH photographs have those proportions |
| 9 | Filter cylinder axis y = -90 (hardware) or -66 (photos) | -85 | the photo value is the raised ring projected on the floor; corrected it is about -80 |
| 10 | Salt cap centre y = -110 or -50 | -60 | same correction applied to the photo value |
| 11 | Flat filter 300 +-40 mm wide (documents, from a photo) or 260 x 130 mm (published) | 260 x 130 mm | the published part size; the photo researcher measured 261 mm |
| 12 | Cutlery basket: 6 or 7 compartments; 230 x 128 x 220 or 231 x 210 x 158 mm; photo 223 x 147 mm | 6 compartments; body 230 x 128 mm in plan (149 mm over the folded-out lid grids), about 127 mm high, 220 mm with handle; two tunnels across the width | BSH photographs of the part fitted; the retailer's key ("Hoehenangabe = Artikeltiefe") makes the published 128 mm the depth in plan, not the height; the 147 mm of the photographs is the width over the lids |
| 13 | Lower-arm rotation: counter-clockwise (hardware, low confidence) or unknown (photos) | clockwise, low to moderate confidence | my reading of the two hooded jets in two BSH photographs and [O82]; flagged for the owner |
| 14 | Arm axis to rear wall: 230 to 255 mm from the floor stubs, 275 to 305 mm from the upper feed tube | both: lower axis 265 mm, upper axis 295 mm | the two routes measure two different arms; the upper basket sits further forward because of the docking plate |
| 15 | Auto at 2:25: about 1.3 kWh and 13 L (documents, interpolating the printed range) or about 1.0 kWh and 11.5 L (programme) | 11.5 L, about 1.04 kWh | two sister machines measured 11.2 to 11.9 L and 1.06 to 1.11 kWh in a laboratory; the model comes within 2 to 6 % of them only with a 65 C wash and a 69 C final rinse (section 4.5). The 11.5 L and 0.95 kWh that a same-generation Siemens shows in its app belong to Auto with the intensive-zone option at 2:40, on a machine whose Eco is 0.75 kWh, so they are not evidence for plain Auto here. Linear interpolation in a range has no physical basis |
| 16 | Normal branch: partial water exchange and one intermediate rinse, or no exchange and two rinses | the first as the table, the second as the named alternative | same water; section 4.6 |
| 17 | Programme researcher assumed two spray levels | three levels; pattern lower / upper + roof | three levels: parts list and [K2]. The pattern, including the pairing of upper arm and roof spinner, is an assumption |
| 18 | Heater 2000 W (generic), 2100 W [K2], 2150 W [K1], 2519 W from 21 ohm | 2100 W at 230 V, full duty | row "Reconciliation" in 2.7 |
| 19 | Fill rate 2.5 or 3.0 L/min | 2.5 L/min | two platform figures |
| 20 | Rinse aid 3 mL (generic) or 5 mL | 5 mL | 1 mL per pulse, setting r05 |
| 21 | Rackmatic step 25 mm or 26.7 mm (scaled photo) | 25 mm | inferred: "up to 5cm" over three stages [B8] and printed item limits that step by 2.5 cm [B1 p. 21]. No document states the step |
| 22 | Heat exchanger 3.1 L or 2.5 L | tank 3.1 L; a final rinse needs 2.5 L of it | both statements are in [K2] and are compatible |
| 23 | Water level by pressure switch [K2 p. 8] or by pump current [K2 p. 91] | pump current and flow meter | no pressure switch in this machine's parts list |
| 24 | Dispenser left of centre (documents) or on the centre line (hardware) | unit on the centre line, detergent chamber 22 mm left of it | manual drawing |
| 25 | Start display: last run's time [K1] or an average value (US manual of this generation) | unresolved | the owner can settle it in two minutes (section 6, item 6) |
| 26 | Net weight 33.9 or 33.6 kg; fuse 10 A or 10-16 A; hose 165 or 168 cm; height 815 or 813.5 mm | 33.9 kg; rating plate; immaterial | spec sheet PDF against web page |

## 3. Parametric specification

Same structure and units as machine.md section 12.1, and meant to be read by the same loader. Every field is filled. The comment on each line or group gives its provenance:

- V = verified for this machine (document, part page for a part in this E-Nr.'s list, or a count in the owner's photographs);
- S = sister model, sister part or platform document (named in section 2);
- P = scaled from a photograph (owner's or BSH's), with the error given in section 2;
- E = estimated (derivation in section 2 or 3);
- G = generic SPOT-60 value kept because nothing better exists.

### 3.1 Machine description (data)

```yaml
machine: BOSCH-SMV4HAX40G-13     # Bosch Serie 4, BSH platform GV640, type SD6PW1B, FD 0106, 13 place settings  (V)
                                 # lower arm + upper arm + roof spinner; cutlery basket; no third rack           (V)
frame:                           # mm; origin on the lower-arm axis; z = 0 at the flat filter plate; x right, y back, z up
  tub: {x: [-272, 273], y: [-235, 265], z: [0, 675],            # P +-12 ; E +-25 ; E +-15
        corner_radius_vertical: 30, floor_slope_deg: 4}          # G
  door: {flange_plane_y: -235, liner_plane_y: -275,              # E ; E at its upper limit (depth budget, section 2.1)
         hinge_axis: {y: -250, z: 45}}                           # E
  feed_pipe: {part: "11003118", riser_x: [-30, 30], riser_proud: 21, port_block_proud: 34,   # V ; P (55 to 62 wide) ; P (15 to 21) ; P
              port_z_above_stub_ends: [345, 371, 398], top_above_stub_ends: 680}           # P +-12 ; V
  sump: {filter_axis_xy: [0, -85], flange_diameter: 200,         # P +-8 ; P
         depth: 85, working_volume_L: 1.2,                       # G
         residue_after_drain_L: 0.17}                            # S (BSH patent: 0.16 to 0.18)
  filter:
    flat_plate: {size_xy: [260, 130], x: [-130, 130], y: [-150, -20], opening_d: 54,     # V ; P ; V
                 hole_d: 0.85, hole_pitch: 1.47, lattice: hex, open_fraction: 0.30}       # P (0.21 to 0.42)
    sump_cover: {size_xy: [259, 95], y: [-20, 75],                                        # V ; P
                 hole_d: 1.25, hole_pitch: 2.1, open_area_cm2: 26}                        # P ; E
    coarse:     {flange_d: 79, crown_d: 71, crown_top_z: 28, length: 131, through_opening_d: 54, opening: 5.0}   # V ; P ; E (20 to 34) ; V ; V ; G (slot width)
    micro:      {diameter: 71, height: 92, pleat_factor: 1.5,                             # V
                 mesh: 0.20, area_cm2: 230, open_fraction: 0.37}                          # E (inside BSH patent ranges)
  floor_features:
    salt_cap:   {center_xy: [-187, -60], diameter: 92, top_z: 25}                         # P ; V ; E (15 to 33)
    beads:      {groups: 2, per_group: 3, x_left: [-235, -180], x_right: [185, 236], y: [-185, -155], length: 51, pitch: 13}   # P
    rear_dish:  {center_xy: [185, 160], diameter: 75}                                     # P
  dispenser: {type: sliding_lid, unit_size: [120, 105, 65],                               # V
              chamber_center: [-22, -275, 510], chamber_wh: [50, 35],                     # E (z +-30)
              lid_travel: up_in_door_plane, keepout_depth: 0,                             # V
              marks_mL: [15, 25, 50], tablet_target: upper_rack_tray,                     # V
              rinse_aid_outlet: [25, -275, 510], rinse_aid_reservoir_mL: 80, rinse_aid_mL_per_pulse: 1}   # E ; S ; S
  heat_exchanger: {wall: left_outside, size_yz: [435, 670], thickness: 42, volume_L: 3.1,   # V
                   G_wall_W_per_K: 25}                                                      # E
racks:
  lower:                              # rack-local frame: origin at the rim centre; all lengths P unless marked
    part: "20001979 (now 20007406)"                                                        # V
    pose: {origin_xy: [0, 0], floor_wire_z: 71, rail_z: 84}                                # E +-20 in y ; E +-12, measured with the basket on the open door
    size: [525, 512, 172]             # outer W x D; rim height above the floor wires at the sides   # P +-8 (sister baskets 525 to 528 wide)
    rim_cc: [519, 507]                # wire centres                                         # P +-8
    rim_above_floor_wires: {sides_and_back: 172, front: 145}                               # P +-8
    front_chamfer: {dx: 41, dy: 59}
    rear_wall: {wires: 4, uprights: 5, recess_for_riser: {x: [-30, 30], set_forward: 6}}   # counts V ; P (5 to 8)
    wire_d_coated: {rim: 5.5, floor: 4.0, tine: 4.0}                                       # P +-1 (calipers needed)
    wire_d_steel: {rim: 5.0, floor: 3.4, tine: 3.4}                                        # G
    coating_mm: 0.4                                                                        # G
    floor_wires_front_back_x: [-199, -86, -19, 98, 179]                                    # count V ; P +-10
    floor_wires_left_right_y: [32, -43]                                                    # plus wall bottom wires and the fixed rails
    tine_rows:                        # all rows run along x; plates stand in y-z planes and lean sideways
      - {id: R1, y: 167, n: 23, base_x: "-208 + 18.25*k for k = 0..21, then 202", lean_deg: 15,
         lean_dir: "-x for k <= 14, +x for k >= 15", height: 66, hinged: true}             # counts V
      - {id: R2, y: 68,  n: 23, base_x: "as R1", lean_deg: 15, lean_dir: "as R1", height: 66, hinged: true}
      - {id: ML, y: -80,  n: 7, base_x: [-206, -179, -152, -127, -101, -75, -50], lean_deg: 17, lean_dir: -x, height: 81, hinged: false}
      - {id: MR, y: -80,  n: 7, base_x: [50, 75, 101, 127, 152, 179, 206],        lean_deg: 17, lean_dir: +x, height: 81, hinged: false}   # 6 seen, a 7th assumed hidden in the cutlery basket's tunnel; positions mirrored from ML
      - {id: FL, y: -186, n: 6, base_x: [-201, -177, -150, -125, -98, -73],       lean_deg: 17, lean_dir: -x, height: 81, hinged: false}
      - {id: FR, y: -186, n: 6, base_x: [73, 98, 125, 150, 177, 201],             lean_deg: 17, lean_dir: +x, height: 81, hinged: false}   # 6 seen; positions mirrored from FL
    rail_above_floor_wires: 13
    tine_tip: ball
    foldable_rows: [R1, R2]                                                                # V (spec sheet: 2; photographs: 2)
    wheels: {count: 8, diameter: 35, y: [221, 125, -63, -159], track: 534}                 # E (6 seen) ; V ; P
    handle: {size: [215, 52, 47], at: front_rim_centre}                                    # V
    mass_kg: 1.9                                                                           # S
    max_plate_by_upper_level: {1: 300, 2: 275, 3: 250}                                     # V (printed)
    max_plate_as_shown: {size: 310, upper_level: 1, position: astride_ML_and_R2}           # size V (printed) ; position E (the manual's drawing does not identify the rows)
    plate_seating: {on_both_rear_rails_up_to: 265, on_both_side_rails_up_to: 240}          # E : larger plates rest on one rail and lean on the rear or front wall (section 2.2)
  upper:                              # rack-local frame: origin on the upper-arm axis; lengths P unless marked
    part: "20001986 (now 20001992)"                                                        # V
    pose: {origin_xy: [0, -30], floor_z_by_level: {1: 410, 2: 385, 3: 360}}                # E +-20 ; E +-12 ; level 1 is the highest
    rackmatic: {levels: 3, step: 25}                                                       # V ; E (5 cm over three stages; no document states the step)
    size: [500, 476, 120]             # outer W x D x wall height at the sides and back     # P +-20 ; S +-25 ; E
    front_wall_height: 55                                                                  # P +-10
    rim_x: [-244, 256]
    rim_y: [-228, 248]                                                                     # E
    wire_d_coated: 3.5                                                                     # P +-0.5
    wire_d_steel: {floor: 3.2, tine: 3.0}                                                  # G
    floor_wires_left_right_y: [215, 178, 142, 105, 69, 36, -3, -40, -76, -112, -149, -187]   # count V
    floor_wires_front_back_x: [-159, -108, -41, 47, 89, 123, 158, 191]                     # count V
    floor_hump: {x: [115, 160], rise: 15}                                                  # presence V ; rise E
    tine_rows:                        # all rows run along y; saucers and plates stand in x-z planes
      - {id: A,  x: -112, n: 6,  y: [210, 175, 139, 103, 68, 31],   height: 95, hinged: false}          # height E +-20
      - {id: B,  x: -52,  n: 6,  y: [207, 174, 137, 101, 70, 34],   height: 95, hinged: false}
      - {id: A2, x: -112, n: 9,  y: [-12, -31, -49, -68, -86, -104, -122, -141, -161], height: 45, form: hairpin, hinged: false}   # height E
      - {id: B2, x: -51,  n: 9,  y: [-14, -32, -50, -68, -86, -104, -121, -143, -163], height: 45, form: hairpin, hinged: false}
      - {id: C,  x: 60,   n: 11, y: [205, 166, 130, 93, 56, 19, -17, -52, -91, -127, -165], height: 88, lean_deg: 11, lean_dir: +x,
         hinged: true, segments: [[205, 19], [-17, -165]]}                                 # counts V ; two parts, rear 6 and front 5
    foldable_rows: [C_rear, C_front]                                                       # V
    knife_shelf: {side: left, size: [389, 119, 57], inner_edge_x: -135, mass_kg: 0.150, folds_up: true}   # V size ; P position
    cup_shelves: {side: right, count: 2, sizes: [[200, 100, 18], [252, 97, 22]], height_above_floor: 75, fold: true}   # V ; G height
    tablet_tray: {at: front_wall_centre, size: [215, 52, 47], slotted: true, rim_above_floor: 55}       # V ; P +-10 (rim level with the top front wire)
    mass_kg: 2.3                                                                           # S
    max_item_by_level: {1: 220, 2: 245, 3: 270}                                            # V
  third: null                                                                              # V
  cutlery_basket: {part: "11057829", size: [230, 128, 127],       # body L x W x H: V ; V (the published 128 is the depth in plan) ; P +-6 (height not published)
                   width_over_folded_lids: 149, height_with_handle: 220, mass_kg: 0.338,   # P +-8 ; V ; V
                   cells: 6, layout: "2 x 3, middle pair split by thin dividers",          # V
                   sections_along_length: [59, 46, 51, 70],                                # P
                   base: three_feet,                                                       # V (BSH photos 25130582, 25130584)
                   tunnels: {count: 2, across: width, open_below: true,                    # V
                             centres_from_mid_length: [-53, 53],                           # P +-5 (106 apart)
                             clear_width: 14, height: 100},                                # P +-3 ; P +-8
                   wall_opening: [7, 16], floor_slot: [3.5, 14], lid_openings: [9, 26], lid_in_use: false,   # P ; G ; G ; V
                   default_pose: {center_xy_in_lower_rack: [8, -133], long_axis: "y",      # P +-6 (as photographed; it is movable)
                                  located_by: "tunnels over the rail lines y = -80 and y = -186"}}   # V (re-checked in the photograph)
arms:
  lower: {part: "00668148", axis_xy: [0, 0], tip_radius: 230,                              # V
          top_face_z: 50, nozzle_z_up: 52, nozzle_z_down: 36,                              # P +-8
          hub_d: 21, stem_od: 27.5, mass_kg: 0.069, weight_N: 0.68,                        # E ; P ; S (pattern part) ; S
          inertia_wet: 3.5e-3, sense: cw,                                                  # E ; E (low to moderate confidence)
          k_f: 0.0093, c_v: 0.002, thrust_sign: -1}                                        # G
  upper: {part: "11010054", axis_xy: [0, -30], tip_radius: 230,                            # V ; E ; V
          top_face_z: "UR_floor_z - 25", nozzle_z_up: "UR_floor_z - 23", nozzle_z_down: null,   # E ; V (no downward nozzles)
          blade_underside_z: "UR_floor_z - 36", hub_underside_z: "UR_floor_z - 55",        # E ; V (arm height 30)
          feed_tube: {length: 270, diameter: 17}, hub_d: 18,                               # V ; P ; G
          mass_kg: 0.065, weight_N: 0.64, inertia_wet: 2.7e-3, sense: ccw,                 # E ; E ; E ; E (no evidence)
          drive: "slots U2 to U5 tilted 16 deg (placeholder; tip outlets face outward)",   # E (tuned, section 3.4)
          k_f: 0.0038, c_v: 0.002, thrust_sign: +1}                                        # G
  roof:  {part: "00611388", type: free_spinning_rotor, axis_xy: [0, 20],                   # V ; P +-20
          outlet_z: 660, rotor_lower_face_z: 645, rotor_d: 52, rotor_height: 21, vanes: 5, # E ; E ; V ; V ; V
          outlet_d: 6.0,                                                                   # E (not found; 4 to 9 plausible; sets a third of the upper level's flow)
          spray: {pattern: rotating_shower, cone_half_angle_deg: 65, droplet_speed_m_s: 2.5}}   # E (placeholders, no evidence)
  nozzles: see tables in section 3.2    # id, half, R, theta, rho, shape, size, area, Cd
hydraulics:
  pump: {part: "12014980", type: BLDC_with_tube_heater,                                    # V
         N0_rpm: 3000, H0_m: 4.0, b_m_per_Lmin2: 1.19e-3,                                  # E, anchored on S (3.1 m at 25 to 30 L/min; 200 to 400 mbar)
         N_range: [2000, 3500],                                                            # S (BSH patent, "typically")
         eta_hyd: 0.40, eta_motor: 0.72, P0_W: 8}                                          # G
  branches:                         # static lift m above sump level, loss coefficient Pa s2/m6, pipe volume L, sum of Cd A in mm2
    lower: {z: 0.11, K: 2.0e+10, V_pipe: 0.25, CdA_mm2: 66.0}                               # E ; G ; G ; section 3.2
    upper: {z: 0.43, K: 8.0e+10, V_pipe: 0.40, CdA_mm2: 41.0}                               # E (level 2; +-0.025 per level) ; E ; G
    roof:  {z: 0.72, K: 1.4e+11, V_pipe: 0.10, CdA_mm2: 22.6}                               # E
  diverter: {positions: {CLOSED: [], LU: [lower, upper], R: [roof], U: [upper], L: [lower], UR: [upper, roof]},   # S (BSH patent embodiment with a seven-hole disc; the production disc's position set is not documented)
             step_deg: 60, transition_s: 2.5,                                              # S ; E
             default_pattern: [[L, 60], [UR, 60]]}                                         # G periods ; E choice of states, including the pairing of upper arm and roof
  nozzle: {C_v: 1.0}                                                                       # G
  inventory: {V_min_sump_L: 0.5, t_flight_s: 0.5, t_return_s: 1.5,                         # G
              carry_over_L: 0.4,                                                           # S 0.17 in the sump + G 0.25 on the load
              topup_L: 0.5, max_topups_per_phase: 1, level_check_in: [pre_rinse, wash]}    # G ; G ; S
  fill: {L_per_min: 2.5, first_bath_L: 4.0, later_bath_L: 2.5, flush_L: 0.5,               # S ; E (printed for the pre-rinse programme) ; E (final rinse S; intermediate rinse 2.5 to 2.9) ; E
         metering: flow_sensor_pulses, prestore_tank_L: 3.1}                               # S
  drain: {L_per_min: 16, pattern_s: [35, 10, 10]}                                          # G (sister platform pump: 10 L/min at 0.9 m)
thermal:
  heater_W: 2100                    # at 230 V; scales with voltage squared (2290 W at 240 V)   # S, reconciled with the rating plate
  heater_duty_ramp: 1.0                                                                    # S (design rate 2.5 K/min)
  C_machine_J_per_K: 14000                                                                 # G
  G_water_load_W_per_K: 600                                                                # G
  G_water_machine_W_per_K: 250                                                             # G
  UA_W_per_K: 3.0                                                                          # E (2.6 to 4)
  T_inlet_C: 15                                                                            # G (cold fill is the factory setting, V)
  T_ambient_C: 23                                                                          # G
dosing: {detergent_g: 20, detergent_marks_mL: [15, 25, 50],                                # G ; V
         release_after_wash_circulation_s: 60, tablet_lands_in: upper_rack_tray,           # E ; V
         rinse_aid_mL: 5, rinse_aid_at: "final rinse, about 1 min after circulation starts, liquor above 40 C"}   # E (S: 1 mL per pulse, setting r05) ; E
softener: {setting: H04, regenerate_every_cycles: 6, extra_L: 5, extra_min: 7, extra_kWh: 0.05}   # V
sensors: {turbidity: {part: "00611323", active_in: [pre_rinse, wash, end_of_wash], thresholds: unknown},   # V ; S ; not found
          water_level: pump_motor_current, water_quantity: impeller_pulses, load: not_listed_for_this_model}   # S ; S ; V
drying: {method: heat_exchanger_condensation, door: closed, auto_open: false,              # V
         duration_min: 40, tank_fill_L: 3.1, tank_fill_portions: 3}                        # E ; S ; S
programmes: see section 4          # Eco 50, Auto 45-65, Intensive 70, Express 65, Silence 50, Favourite (pre-rinse), Machine Care   (V)
```

### 3.2 Nozzle tables

Format of machine.md section 3.2. "Half" + is the blade with six top nozzles, - the blade with four. theta is in that blade's frame (0 = radially outward, 90 = trailing tangential); rho is the elevation (90 = straight up, negative = downward). R and Shape are this machine's ([VERIFIED] counts and shapes, [ESTIMATED] radii +-4 mm). Size, and therefore area and flow, are [ESTIMATED] from apparent openings, +-30 %. theta and rho are [ESTIMATED] from the shape of each boss: a plain raised ring is taken as vertical (rho 88), a hood as inclined in the direction its mouth faces. The one exception is the four slots of the upper arm, which are tilted by assumption because the arm needs a drive and nothing else on it could provide one (see the note under that table). No angle has been measured. C_d: 0.85 round, 0.78 to 0.80 slots, as in machine.md.

Lower arm, part 00668148, diverter state L at N = 3000 rpm: p_arm = 24.7 kPa, jet velocity 7.04 m/s, total 27.9 L/min.

| ID | Half | R (mm) | theta (deg) | rho (deg) | Shape | Size (mm) | A (mm2) | C_d | Q (L/min) | Role and evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| L1 | + | 47 | 0 | 88 | round in conical boss | 3.0 | 7.07 | 0.85 | 2.54 | innermost ring |
| L2 | - | 67 | 0 | 88 | round in raised ring | 3.0 | 7.07 | 0.85 | 2.54 | |
| L3 | + | 93 | 0 | 88 | round to oval in raised ring | 3.0 | 7.07 | 0.85 | 2.54 | |
| L4 | + | 116 | 0 | 88 | short slot in square boss, long axis along the arm | 3.0 x 2.0 | 5.14 | 0.80 | 1.74 | small radial fan |
| L5 | + | 140 | 0 | 88 | round in low ring | 3.0 | 7.07 | 0.85 | 2.54 | |
| L6 | - | 159 | 0 | 88 | round in crater-like boss | 2.8 | 6.16 | 0.85 | 2.21 | |
| L7 | + | 185 | 0 | 85 | round, the largest bore | 3.8 | 11.34 | 0.85 | 4.07 | strongest single jet (0.48 N) |
| L8 | - | 205 | 90 | 55 | oblong outlet in a hood ("chimney") | 4.0 x 2.0 | 7.14 | 0.78 | 2.35 | hood opens sideways: drive, and an oblique jet |
| L9 | + | 225 | 0 | 45 | oblong outlet in a tip hood | 4.5 x 2.0 | 8.14 | 0.78 | 2.68 | hood opens along the blade: corner reach, no drive |
| L10 | - | 226 | 45 | 45 | oblong outlet in a tip hood | 4.0 x 2.2 | 7.76 | 0.78 | 2.56 | hood opens outward and sideways: corner reach and drive |
| L11 | + (blade not determined) | 195 | 45 | -25 | square outlet in a block on the underside | 2.5 x 2.5 | 6.25 | 0.80 | 2.11 | sweeps the flat filter; assumed half tangential: drive |
| Sum | | | | | | | 80.2 | (C_d A = 66.0) | 27.9 | SPOT-60: 75.3, 61.2, 30.7 |

Upper arm, part 11010054, diverter state UR at N = 3000 rpm: p_arm = 21.7 kPa, jet velocity 6.60 m/s, total 16.2 L/min. "+" is the blade with the small round bore.

| ID | Half | R (mm) | theta (deg) | rho (deg) | Shape | Size (mm) | A (mm2) | C_d | Q (L/min) | Role and evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| U1 | + | 44 | 0 | 88 | round in round boss | 2.2 | 3.80 | 0.85 | 1.28 | centre |
| U2 | - | 85 | 90 | 74 | slot in raised oval boss, long axis along the arm | 5.0 x 2.2 | 9.96 | 0.78 | 3.07 | fan along the arm; tilt assumed, see note |
| U3 | + | 132 | 90 | 74 | slot | 5.0 x 2.2 | 9.96 | 0.78 | 3.07 | fan along the arm; tilt assumed |
| U4 | + | 162 | 90 | 74 | slot | 5.0 x 2.2 | 9.96 | 0.78 | 3.07 | fan along the arm; tilt assumed |
| U5 | - | 192 | 90 | 74 | slot | 5.0 x 2.2 | 9.96 | 0.78 | 3.07 | fan along the arm; tilt assumed; passes under the tablet tray |
| U6 | + | 221 | 0 | 35 | small outlet in a wedge hood, mouth toward the tip | 3.2 x 1.5 | 4.32 | 0.78 | 1.33 | outward along the blade (observed): walls and corners; no drive. Elevation not measured |
| U7 | - | 221 | 0 | 35 | small outlet in a wedge hood, mouth toward the tip | 3.2 x 1.5 | 4.32 | 0.78 | 1.33 | as U6 |
| Sum | | | | | | | 52.3 | (C_d A = 41.0) | 16.2 | SPOT-60 mid arm: 49.6, 40.4, 19.9 |

Note on the upper arm's drive: nothing seen on this arm points sideways. The two tip outlets face outward along the blade (BSH photo MCSA01860195; check 15 in 0.4); the blade is swept about 7 deg at the tip, which gives them 0.006 N m, a fifth of the static friction. The slots show no tilt in any photograph, but they carry three quarters of the flow and are the only openings that could turn the arm, so the table tilts all four by 16 deg from the vertical in the trailing direction (theta 90, rho 74). The 16 deg is tuned, not derived: it is the tilt at which the torque model with the generic friction gives a typical 26 rpm. Until the owner's cocktail-stick test (section 6, item 2), a simulator may as well prescribe the arm's speed and keep the slots vertical. Between R = 85 and 192 mm on the "-" blade the arm is crossed by tine rows in [O83], so one opening could be hidden there; BSH's photograph shows none.

Roof spinner, part 00611388, state UR at N = 3000 rpm: 8.9 L/min at 21.6 kPa.

| ID | Half | R (mm) | theta (deg) | rho (deg) | Shape | Size (mm) | A (mm2) | C_d | Q (L/min) | Role and evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| R1 | axis | 0 | n/a | -90 | pipe outlet onto a free-spinning 5-vane rotor, 52 mm | 6.0 (assumed) | 28.3 | 0.80 | 8.9 | rotating shower over the upper rack; emit as droplets at about 2.5 m/s inside a 65 deg half-angle cone, not as a coherent jet. Bore, droplet speed and cone angle are placeholders: none has been seen or measured |

Jet character [ESTIMATED]: Re = v d / nu = 7.04 x 0.003 / 1.0e-6 = 2.1e4 at 20 C and 4.5e4 at 60 C; ballistic rise v^2 / (2 g) = 2.5 m, far above the tub height, so jets reach the racks at more than 90 % of exit speed. Momentum flux per nozzle 0.14 to 0.48 N.

### 3.3 Hydraulic operating points, re-solved for this machine

Equations of machine.md 12.2 item 1, unchanged. Inputs:

- Pump: H(Q, N) = H_0 (N / N_0)^2 - b Q^2 with N_0 = 3000 rpm, H_0 = 4.0 m, b = 1.19e-3 m per (L/min)^2 [ESTIMATED]. Anchors: the sister platform's pump is specified at 3.1 m head and 25 to 30 L/min [VERIFIED] sister [K1 p. 63] and, in the same manual, 3.0 to 4.0 m and 17 to 63 L/min [K1 p. 42]; BSH's patent on the brushless pump gives 2000 to 3500 rpm and 200 to 400 mbar as typical [PA5]. The curve passes through 3.1 m at 27.5 L/min, has 4.0 m shut-off head and 58 L/min free delivery at N_0, and gives 4.1 m (400 mbar) at 3500 rpm on the lower arm. N_0 = 3000 rpm is a label for "normal wash speed": no document gives the real speed. SPOT-60 used H_0 = 5.5 m.
- Branch losses: K_L = 2.0e10 (generic; includes the 20 mbar the patent quotes for the water switch); K_U = 8.0e10 (9 kPa at 20 L/min: riser, docking port and a feed tube of about 13.5 mm bore, narrower than the generic 17 mm); K_R = 1.4e11 (2.5 kPa at 8 L/min in a channel of about 1.5 cm2) Pa s2/m6. All [ESTIMATED].
- Static lifts above a sump level 60 mm below the filter plate: 0.11, 0.43, 0.72 m [ESTIMATED].
- C_d A from section 3.2: 66.0, 41.0 and 22.6 mm2.

Results [ESTIMATED]. Q in L/min, p in kPa, v in m/s. P_el = P_hyd / (0.40 x 0.72) + 8 W.

| Diverter state | N (rpm) | p_pump (kPa) | Q total | Lower: Q / p / v | Upper: Q / p / v | Roof: Q / p / v | P_hyd (W) | P_el (W) |
|---|---|---|---|---|---|---|---|---|
| L (lower only) | 2400 | 19.4 | 22.1 | 22.1 / 15.6 / 5.59 | | | 7.1 | 33 |
| L | 2800 | 26.3 | 26.0 | 26.0 / 21.4 / 6.56 | | | 11.4 | 47 |
| L | 3000 | 30.1 | 27.9 | 27.9 / 24.7 / 7.04 | | | 14.0 | 57 |
| L | 3400 | 38.6 | 31.7 | 31.7 / 32.0 / 8.00 | | | 20.4 | 79 |
| UR (upper + roof) | 2400 | 20.8 | 19.2 | | 12.6 / 13.0 / 5.11 | 6.7 / 12.0 / 4.90 | 6.7 | 31 |
| UR | 2800 | 27.8 | 23.2 | | 15.0 / 18.6 / 6.10 | 8.2 / 18.2 / 6.03 | 10.8 | 45 |
| UR | 3000 | 31.8 | 25.2 | | 16.2 / 21.7 / 6.60 | 8.9 / 21.6 / 6.58 | 13.3 | 54 |
| UR | 3400 | 40.5 | 29.0 | | 18.6 / 28.6 / 7.57 | 10.4 / 29.2 / 7.66 | 19.6 | 76 |
| U (upper only) | 3000 | 35.7 | 17.3 | | 17.3 / 24.8 / 7.04 | | 10.3 | 44 |
| R (roof only) | 3000 | 38.0 | 10.0 | | | 10.0 / 27.1 / 7.36 | 6.3 | 30 |
| LU (lower + upper) | 3000 | 22.8 | 37.5 | 24.1 / 18.5 / 6.09 | 13.3 / 14.6 / 5.42 | | 14.2 | 57 |
| LU | 3400 | 29.0 | 42.7 | 27.3 / 23.8 / 6.90 | 15.4 / 19.5 / 6.26 | | 20.7 | 80 |

Reading:

- One level at a time at normal speed circulates 25 to 28 L/min at 3.1 to 3.3 m of head, which is the sister pump's specification and inside the patent's "20 to 30 L/min". Bosch's own claim of "over 4,000 litres" circulated per wash [B13] is 27 L/min for 150 minutes.
- Jets leave at about 7.0 m/s (lower) and 6.6 m/s (upper) at normal speed, against 8.4 and 8.2 m/s in SPOT-60; 8.0 m/s needs the top of the speed range. This sits inside the PEPT range quoted in machine.md (7.7 +-3.2 m/s).
- Feeding both arms at once (LU, the "Zweikorb" mode of the sister platform, used by its speed option) drops the jets to 6.1 and 5.4 m/s and needs 37.5 L/min.
- The roof velocity is the speed of the stream striking the rotor, not of the droplets leaving it.

Flow uncertainty: nozzle area is known to +-30 %, the pump curve is anchored on a sister pump, and the roof outlet is assumed. Expect 20 to 35 L/min for one active level. Jet speed is better constrained (6 to 8 m/s) because the pump's head is. The roof outlet matters mostly to the roof: a bore of 4 to 9 mm instead of 6 mm moves the roof shower's flow from 4 to 15 L/min (21 to 50 % of the level) but the upper arm's only from 16.9 to 15.2 L/min and its jets from 6.9 to 6.2 m/s. The states themselves are the larger unknown: if the production water switch has no upper + roof position, the upper arm runs alone at 17.3 L/min and 7.0 m/s (row U).

### 3.4 Arm rotation from the torque balance

Equation of machine.md 3.3 and 12.2 item 2, with this machine's nozzle tables. Inputs [ESTIMATED] unless marked: A_hub = 346 mm2 (21 mm bore, from the 27.5 mm stem) and 254 mm2; W = 0.68 N (69 g, [VERIFIED] for the pattern part) and 0.64 N; friction k_f = 9.3 mm and 3.8 mm and c_v = 0.002 N m s kept from SPOT-60, where they were fitted to a measured 35 rpm on a similar arm.

| Pump speed N (rpm) | Lower arm, state L: p (kPa) / v (m/s) / drive (N m) / T_f (N m) / speed (rpm) | Upper arm, state UR: p / v / drive / T_f / speed |
|---|---|---|
| 3400 | 32.0 / 8.00 / 0.125 / 0.072 / 36 | 28.6 / 7.57 / 0.070 / 0.045 / 31 |
| 3000 | 24.7 / 7.04 / 0.097 / 0.055 / 32 | 21.7 / 6.60 / 0.053 / 0.035 / 26 |
| 2800 | 21.4 / 6.56 / 0.084 / 0.047 / 30 | 18.6 / 6.10 / 0.045 / 0.030 / 23 |
| 2400 | 15.6 / 5.59 / 0.061 / 0.034 / 26 | 13.0 / 5.11 / 0.032 / 0.022 / 18 |

At 3000 rpm: lower arm sum(m_dot r^2) = 0.0125 kg m2/s, axial load 5.2 N, frictionless speed 74 rpm; upper arm 0.0067 kg m2/s, 7.8 N, 76 rpm. In state LU the arms turn at 28 and 19 rpm. Stall margin (drive less static friction) is 0.049 N m for the lower arm and 0.024 N m for the upper arm at 3000 rpm: 0.21 N and 0.10 N at the tip. A spoon handle or a pan handle resting on an arm stops it. Spin-up after a diverter change takes about 0.3 s.

How much of this is known: nothing but the arithmetic. The lower arm's speed follows from angles I assigned to its three hooded nozzles after looking at which way their mouths face. The upper arm's speed does not even have that: its 26 rpm is the number the slot tilt was tuned to give (section 3.2), so the column above is an input dressed as an output. Sensitivity of the lower arm at 3000 rpm: 27 to 37 rpm as the elevation of L8 goes from 65 to 45 deg; 10 to 12 rpm if either L10 or L11 gives no tangential thrust; 56 rpm if all three were fully tangential with L8 and L10 at 45 deg and L11 at -20 deg elevation. Upper arm: 12 rpm with the slots tilted 12 deg, 40 rpm at 20 deg, and no rotation below about 9 deg. So the model says "20 to 45 rpm, like most machines" and no more. Arm speed is measurable in ten minutes (section 6, item 7) and then fixes k_f.

Rotation sense: lower arm clockwise seen from above (section 2.6; low to moderate confidence); upper arm counter-clockwise by assumption, with no evidence either way.

Moments of inertia [ESTIMATED]: lower arm 1.2e-3 kg m2 dry (69 g over 460 mm as a thin rod) plus about 0.115 kg of water in the blades, 3.5e-3 kg m2 wet; upper arm about 2.7e-3 kg m2 wet.

### 3.5 Water inventory check

Water balance of machine.md 4.5 with t_flight + t_return = 2.0 s (generic) [ESTIMATED]:

| Bath | Water in the tub (L) | State | Q (L/min) | Pipes (L) | In flight and on surfaces (L) | Left in the sump (L) |
|---|---|---|---|---|---|---|
| Pre-rinse and wash | 4.0 + 0.4 carried over | L | 27.9 | 0.25 | 0.93 | 3.2 |
| | | UR | 25.2 | 0.50 | 0.84 | 3.1 |
| Rinses | 2.5 + 0.4 | L at 2800 rpm | 26.0 | 0.25 | 0.87 | 1.8 |
| | | UR at 2800 rpm | 23.2 | 0.50 | 0.77 | 1.6 |

The 2.5 L rinse baths leave about 1.6 L in the sump against a prime limit of 0.5 L: one litre trapped in upright bowls is survivable in the wash and marginal in the rinses, where the machine does no level check and no top-up [VERIFIED] sister [K2 p. 91]. Each rinse dilutes what the drain leaves behind by 0.4 / 2.9 = 0.14, so the wash liquor reaches the final rinse diluted about 50-fold through one intermediate rinse (SPOT-60: 30-fold through one rinse of 2.9 L after a 0.65 L carry-over).

Filter split by open area with equal loss coefficients [ESTIMATED]: flat plate 88 cm2 and sump cover 26 cm2 to the pump directly, micro filter 85 cm2 through the cylinder: 57 % / 43 %. Per-pass capture of particles between 0.2 mm and 0.85 mm is therefore about 0.43, with 27.9 / 4.4 = 6.3 passes per minute in the wash. Particles between 0.85 and 1.25 mm can still pass the cover's larger holes (13 % of the flow).

### 3.6 Fields added to the generic structure

- `frame.door` (flange and liner planes; both baskets and the upper arm's sweep reach into the door recess), `frame.feed_pipe` (the riser is an obstacle behind the lower basket), `frame.floor_features` (with the salt cap's height), `sump.residue_after_drain_L`.
- `frame.filter.sump_cover` and separate `coarse` and `micro` entries with the real part dimensions; `coarse.crown_top_z`, because the crown stands under the lower arm.
- `frame.dispenser.type: sliding_lid`, `tablet_target`, `rinse_aid_mL_per_pulse`: the release test is no longer a swept volume but "is the tray free and is the lid path clear".
- `frame.heat_exchanger`.
- `racks.*.pose`, explicit floor-wire lists, explicit `tine_rows` lists with per-row position, count, pitch, height, lean and `hinged`, wheel stations, `rear_wall.recess_for_riser`, `max_plate_by_upper_level`, `max_plate_as_shown`, `plate_seating`.
- `racks.upper.knife_shelf`, `cup_shelves` as a list, `tablet_tray`, `front_wall_height`, `floor_hump`, `rackmatic`.
- `racks.third: null`; `racks.cutlery_basket.layout`, `base`, `tunnels`, `width_over_folded_lids`, `default_pose` with `located_by`: the basket must be built with its two tunnels or it cannot be placed where it is photographed.
- `arms.upper.axis_xy` offset, `feed_tube`, undersides, `drive`; `arms.roof` replaces `arms.top`.
- Naming: this dossier says `upper` where machine.md says `mid` (the arm under the upper basket; BSH's parts list calls it "Spray arm top") and `roof` where machine.md says `top`, in `arms` and in `hydraulics.branches`. The dispenser block uses `chamber_center`, `chamber_wh` and `lid_travel` in place of `lid_center`, `lid_wh` and `swing_deg`.
- `hydraulics.diverter.positions` (the six of a patent embodiment, as candidates), `default_pattern`; `hydraulics.fill` block with the pre-stored tank; `branches.*.CdA_mm2`.
- `softener`, `sensors`, and the closed-door `drying` fields.

### 3.7 How much of each block is fact

Rough shares of the fields in each block, by how they were obtained. "Verified" includes counts made on the owner's photographs; "photo" is a length scaled from a photograph.

| Block | Verified | Sister or platform | Photo | Estimated or generic | What would move it |
|---|---|---|---|---|---|
| Tub and door | 10 % (materials, outer size) | 0 % | 30 % (width, floor features, riser) | 60 % (depth, height, both arm positions front to back, liner, slope, hinge, heights of the crown and the salt cap) | tape measure, checklist item 3 |
| Lower basket | 35 % (row, tine, wire and wheel counts; handle; printed plate limits) | 5 % (mass) | 50 % (every position, pitch, height, lean) | 10 % (pose in the tub, height inside the tub, fold behaviour, where the 31 cm plate stands, the right-hand rows' positions) | items 3, 4 |
| Upper basket | 35 % (counts, shelf and tray sizes, levels, item limits) | 5 % | 45 % (wire and tine positions, width, front wall and tray height) | 15 % (depth, side wall height, tine heights, Rackmatic step) | item 4 |
| Cutlery basket | 55 % (length, width, height with handle, mass, compartments, two tunnels) | 0 % | 35 % (body height, tunnel sizes, sections, position) | 10 % (slot sizes) | item 4 |
| Arms and nozzles | 30 % (spans, counts, shapes, no downward nozzles on the upper arm, outward tip outlets) | 0 % | 30 % (radii, apparent sizes, arm heights) | 40 % (all angles, the upper arm's drive, both rotation senses and speeds, roof outlet and its spray, friction) | items 1, 2, 5, 7 |
| Pump | 5 % (type) | 45 % (head, flow, speed range) | 0 % | 50 % (curve shape, efficiencies, speeds per phase) | bench test; item 7 |
| Diverter | 10 % (motor label, three outlets) | 30 % (a patent embodiment's six positions, loss) | 0 % | 60 % (the production part's position set, which positions are used, the pairing of levels, dwell, transition) | item 7 |
| Filters | 50 % (part sizes, three stages, flow paths) | 15 % (mesh ranges) | 20 % (perforation, positions) | 15 % (areas, split) | item 8 |
| Thermal | 10 % (appliance rating) | 30 % (heater power, heating rate, tank volume) | 0 % | 60 % (heat capacities, conductances, losses) | items 7, 8 |
| Dosing | 40 % (marks, sliding lid, tablet path, setting r05) | 25 % (1 mL per pulse, actuation) | 0 % | 35 % (release time, dose timing, chamber height) | items 5, 6 |
| Drying | 60 % (method, closed door, tank) | 25 % (portioned tank filling) | 0 % | 15 % (duration, wall coupling) | item 7 |
| Programme (Auto 2:25) | 20 % (envelope, total duration, phase names of the other programmes) | 30 % (water and energy totals of two measured sisters, sensor decisions, tank sequence, heating rate) | 0 % | 50 % (every step duration, both targets, whether the heat-up is staged or the wash held, exchange volume, pump speeds, diverter pattern) | item 7 |

## 4. The programme

### 4.1 The manual's printed programme table

Sequence column summarised from the user manual [B1 p. 16]; consumption values from the quick reference guide [B2 p. 1], whose two editions (2022 and 2024) print the same figures. The guide's header says the programme data were measured in the laboratory to European standard EN 60436. All rows [VERIFIED] (re-checked in the extracted text).

| Programme | For | Sequence (summarised; temperatures as printed) | Duration (h:min) | Energy (kWh) | Water (L) |
|---|---|---|---|---|---|
| Intensive 70 | pots and pans; stubborn, burnt-on or dried-on residues | pre-rinse; cleaning 70 C; intermediate rinse; final rinse 69 C; drying | 2:05 - 2:15 | 1.300 - 1.400 | 11.5 - 14.0 |
| Auto 45-65 | mixed tableware and cutlery; ordinary residues, lightly dried on | "Sensor-controlled: Optimised by sensors depending on the soiling of the washing water." | 1:40 - 2:45 | 0.900 - 1.500 | 7.0 - 15.5 |
| Eco 50 | as Auto | pre-rinse; cleaning 50 C; intermediate rinse; final rinse 61 C; drying | 4:55 | 0.836 | 9.5 |
| Silence 50 | as Auto | pre-rinse; cleaning 50 C; intermediate rinse; final rinse 63 C; drying | 4:00 | 1.050 | 11.0 |
| Express 65 - 1h | as Auto | cleaning 65 C; intermediate rinse; final rinse 69 C; drying | 1:00 | 1.300 | 10.5 |
| Machine Care | empty machine only | Machine Care at 70 C | 2:10 | 1.350 | 15.2 |
| Favourite (factory: pre-rinse) | all tableware | cold rinsing | 0:15 | 0.050 | 4.0 |

Printed notes, summarised [VERIFIED] [B1 p. 15-18, 24, 30-31]:

- The running time depends on four things: the option selected, how much tableware is loaded, how soiled it is, and the temperature of the water. Running time and energy consumption both rise when the rinse-aid system is switched off or needs refilling.
- Consumption values are stated for what the manual calls normal conditions, with water of 16 - 20 E hardness.
- Extra Dry raises the final-rinse temperature and extends the drying phase. Half Load shortens the running time and lowers water and energy consumption. SpeedPerfect+ shortens the run time "by 15% to 75%" and raises energy and water consumption. All three can be combined with Auto (interactive manual [B3]). No document gives the size of any option's effect on Auto.
- The display shows the remaining running time as soon as a programme is selected; the appliance switches off 1 minute after the end; a cancelled programme "ends after approx. 1 minute" of pumping.
- Softener regeneration: section 2.9.

### 4.2 What is known about Auto 45-65

| Evidence | Content | Tag | Source |
|---|---|---|---|
| This model | envelope 1:40 to 2:45, 0.900 to 1.500 kWh, 7.0 to 15.5 L; no phase list; no figure tied to a soil level | [VERIFIED] (re-checked) | [B1], [B2] |
| This model | With heavy soiling the rinsing water is drained and replaced by fresh water; with lighter soiling it is kept for the next wash phase, which saves 3 to 6 litres. Then, in the manual's words: "In the automatic programmes the temperature and run time are additionally adjusted to the level of soiling." | [VERIFIED] (re-checked) | interactive manual [B3]; absent from the PDF manual |
| This model | Of tableware pre-cleaned too thoroughly the manual says "The sensors chose a weaker programme", and that stubborn soiling then cannot be removed entirely | [VERIFIED] | [B1 p. 44] |
| The owner's machine | Auto shows 2:25 | owner's statement | 145 min is 45 min above the printed minimum and 20 min below the maximum |
| Platform, 2008 ("Auto 55/65") | "Im Automatikprogramm entscheidet der Aquasensor nicht nur ueber einen Wasserwechsel nach dem Vorspuelen, sondern er bestimmt auch die Reinigungstemperatur und die Anzahl der Zwischenspuelgaenge." Structures named: cleaning 50, one intermediate rinse, final rinse 65, drying; cleaning 65, two intermediate rinses, final rinse 65, drying; pre-rinse, cleaning 55, one intermediate rinse, final rinse 65, drying | [VERIFIED] sister (re-checked) | [K1 p. 9] |
| Platform, 2008 (variant with a 45 C minimum) | 1. in the pre-rinse: water exchanged (much soil) or kept. 2. in cleaning: end temperature 45 C (little soil) or 50 / 55 C; a water change after the pre-rinse raises it from 50 to 55 C; cleaning at 50 or 55 C is followed by a filter flush. 3. in the first intermediate rinse: a further intermediate rinse (much soil) or only a filter flush. "Im Automatik-Programm sind 48 Programmstrukturen moeglich." | [VERIFIED] sister (re-checked) | [K1 p. 19] |
| Platform, 2010 | sensor "im Vorspuelen, im Reinigen und am Ende des Reinigens aktiv"; values "in der Elektronik hinterlegt" | [VERIFIED] sister (re-checked) | [K2 p. 82] |
| Platform, start display | "Beim Programmstart wird die Restlaufzeit, die dieses Programm das letzte Mal benoetigt hat, angezeigt"; the time is recalculated at the end of the heating steps, with jumps of up to 50 to 60 minutes | [VERIFIED] sister (re-checked) | [K1 p. 46, 49] |
| Same generation, US manual | "The displayed cycle time indicates an average value." | [VERIFIED] sister | Bosch SHP78CM5N manual [B12] |
| Laboratory, two sisters of the same generation and label class (Constructa CG5VX00HCD and Siemens SN65EX57CE, both 14 place settings, class D), Auto at normal soiling | 1.06 and 1.11 kWh; 11.2 and 11.9 L; 2:13 and 2:14 | [VERIFIED] sister (re-checked in the saved table) | KONSUMENT 10/2021 [T1]. Difference likely: 14 place settings means a cutlery drawer, so a different top spray level and a load about 8 % heavier |
| Same test, their Eco and 1 h programmes | Eco 0.81 and 0.74 kWh, 9.3 and 9.4 L, 4:50 and 4:31; 1 h programme 1.11 and 1.19 kWh, 10.0 and 10.1 L | [VERIFIED] sister | [T1]. This model prints 1.300 kWh for Express 65: its printed non-Eco figures may be upper values |
| Same test, two zeolite sisters (Bosch SMV6ZCX49E, Siemens SN87YX01CE), Auto at normal soiling | 0.88 and 0.87 kWh; 10.7 and 11.6 L; 2:11 and 2:14 | [VERIFIED] sister (re-checked in the saved table) | [T1]. Zeolite machines dry by other means and are a different energy level (label classes C and B against D here); they serve only to place "normal soiling" inside a printed range (below) |
| A same-generation Siemens SN63EX14VE, figures read by its owner from the Home Connect app | Auto with the intensive-zone option 2:40, 11.5 L, 0.95 kWh; Auto with the speed option 1:52, 14 L, 1.15 kWh; Eco 4:55, 9.5 L, 0.75 kWh. The table has no row for plain Auto. Its display shows 2:30 for plain Auto | [VERIFIED] sister (re-checked: table image and post) | forum [F5]. A forecast, not a measurement, for a programme with an option, on a machine whose Eco uses 0.75 kWh against 0.836 here. Not evidence for plain Auto on this machine |
| Forum, a close observer of current BSH machines, speaking of a zeolite model | maximum: "warm prewash (Zeolite regeneration)", main wash 65 C at full duration, two unheated interim rinses, heated final rinse: "2:40h, 1.3kWh, 15.5l"; minimum: wash, rinse, heated rinse, dry: "1:40h, 0.68kWh, 7l". "The second interim rinse is barely ever triggered in my experience. The pre-wash can either be done or not." He has seen "partial drains ... between pre-rinse and main wash". The timer is updated at each stage transition | [VERIFIED] sister (re-checked) as a quotation; unverified as fact | [F1]. The same water and nearly the same times as this machine's printed range, but 0.22 and 0.20 kWh less energy; the warm pre-wash belongs to the zeolite, which this machine lacks |
| Forum, the owner of a 2010 Bosch with heat exchanger and no zeolite, writing in 2014 | The heat exchanger does its work in what he calls "the post-wash phase, when dishwashers typically continue to wash without reheating the water": about a quarter of an hour before the main wash is drained, cold water is let into the exchanger, and tub and exchanger come to the same temperature, at no cost in extra energy or time. Separately, on heating in stages: "I can hear the heater click on and off throughout the main wash" | [VERIFIED] sister (re-checked) as a summary with two quotations | [F2], posts 101 and 93. The second quotation is about a staged heat-up, not about holding a temperature |
| BSH patent on the tank | tank full from the previous cycle is emptied into the tub as the first liquor; in cleaning the heater is switched off at the target and the pump runs on ("Nachwaschphase"); final rinse heated to "between 60 C and 80 C"; in drying the tank is filled with cold water in at least three stages | [VERIFIED] sister (BSH patent) (re-checked) | [PA7] |

Reading: 2:25 is the controller's forecast for a middling path, shown before any sensing (the last run's time or a stored average; which, is unresolved). The only measurements of a normal-soil Auto run on this generation without zeolite are the two laboratory sisters: 11.2 to 11.9 L and 1.06 to 1.11 kWh in 2:13. A second line of reasoning lands in the same place: the two zeolite sisters measured 0.87 and 0.88 kWh, a third of the way up the 0.68 to 1.3 kWh that the forum observer gives for a zeolite machine, and a third of the way up this machine's printed 0.900 to 1.500 kWh is 1.09 kWh [ESTIMATED]. The documents researcher's linear interpolation of the printed range by duration (1.3 kWh, 13 L) is not supported by any measurement and I do not use it.

Water arithmetic [ESTIMATED]. Take a first bath of 4.0 L (the printed pre-rinse programme: this figure is the input, not a result), later baths of 2.5 L, a full replacement of the first bath of 4.0 L and a filter flush of 0.5 L. Of the other eight printed totals this reproduces five: Eco 4.0 + 0.5 + 2.5 + 2.5 = 9.5; Auto minimum 4.0 + 0.5 + 2.5 = 7.0; Auto maximum 4.0 + 4.0 + 3 x 2.5 = 15.5; Intensive 4.0 + 2 or 3 x 2.5 + 2.5 = 11.5 or 14.0. Express (10.5 L) fits only with a separate assumption, a 5.5 L first bath for both levels at once: 5.5 + 2.5 + 2.5. Silence 50 (11.0 L; the scheme gives Eco's 9.5) and Machine Care (15.2 L) are not reproduced. The normal branch of Auto is 4.0 + 3 x 2.5 = 11.5, inside the laboratory's 11.2 to 11.9 L. This is arithmetic that fits, not a measurement, and it is not unique: the BSH patent example of section 2.9 (3.9 / 2.9 / 2.5 L, no flush) gives Eco 9.3 L, exactly what one of the two sisters measured, so 2.5 L for an intermediate rinse is not established.

### 4.3 Sensor logic, as far as known

| # | When | What is sensed | Decision | Evidence |
|---|---|---|---|---|
| D0 | first fill, clean water | reference transmission of the turbidity sensor (needs about 0.4 L) | calibration fails: assume "turbid" and run the longest sequence | [K1 p. 19], [K2 p. 82] |
| D1 | end of the cold pre-rinse, about 12 min after the start | turbidity of the pre-rinse liquor | keep the water for the main wash, or replace it; the manual describes a full replacement, BSH marketing says the sensor "steuert Menge und Zeitpunkt der Frischwasserzugabe" | [B3], [K1 p. 19]; timing [ESTIMATED] |
| D2 | during the main wash | turbidity of the wash liquor | wash temperature within 45 to 65 C and the length of the wash; a water change at D1 pushes the temperature up | [B3], [K1 p. 19], [K2 p. 82] |
| D3 | end of the main wash and first intermediate rinse | turbidity | a second intermediate rinse, or only a filter flush | [K1 p. 19], [K2 p. 82] |
| D4 | pre-rinse and main wash | pump running smoothly or not (motor current) | top up water; a larger load holds more water in flight and on surfaces, which is the only "load sensing" documented | [K2 p. 91] |
| D5 | whole run | rinse-aid tank empty or system switched off | hotter final rinse and changed drying; "running time and energy consumption will increase" | [B1 p. 15]; sister platform [K1 p. 10]: final rinse +3 K |
| D6 | every 6th cycle at setting H04 | water counted against the hardness setting | regeneration in the main wash: +7 min, +5 L, +0.05 kWh | [B1 p. 24] |

Thresholds are not public. Recommendation for the simulator [ESTIMATED]: model the sensor as optical transmission across a 10 mm gap in the sump, tau = exp(-sum_k eps_k c_k L), with a separate eps for coloured dissolved soils (the 2008 sensor added a green LED for "Tee oder Spinat" [K1 p. 19]); two thresholds at D1, a monotone map from tau at D2 to a temperature step in {45, 50, 55, 60, 65} and a hold length, one threshold at D3. Calibrate so that the EN 60436 reference soil on a full load lands on the normal branch (11.5 L, as tabulated in 4.4), a pre-rinsed load on the light branch (7.0 L) and a heavily soiled load on the heavy branch (15.5 L). Report which branch a load triggered.

### 4.4 AUTO 45-65 as a 2 h 25 min run ("AUTO 2:25", normal branch)

Conventions as machine.md 7.3. Conditions: inlet 15 C, room 23 C, 230 V, full 13 place-setting load (23 kJ/K), heater 2100 W at full duty, carry-over 0.4 L. N is the nominal pump speed of section 3.3; "L/UR a/b" is the water-switch pattern in seconds, lower arm then upper arm plus roof spinner. Clock times are from the start.

What is anchored: the total duration (owner's statement); the total water and the energy level (two laboratory-measured sisters; the water arithmetic agrees); the first-bath volume (printed for the pre-rinse programme); the final-rinse volume, the heating rate and the tank mechanism (2010 platform manual); closed-door drying; the release of the tablet into the upper-rack tray. What is [ESTIMATED]: every step duration, both temperature targets, the partial exchange in A3, the pump speeds and the diverter pattern. The two targets were chosen together: with the documented pattern of no reheating after the target, the model comes within 2 to 6 % of the sisters' energy only at the top of the wash range and with the 69 C final rinse that this model prints for Intensive 70 and Express 65 (section 4.5). Liquor temperatures in the action column are outputs of the thermal model.

| Step | Clock (h:mm) | Action | Water in from the mains (L) | Target (C) | N (rpm), diverter | Duration (min) |
|---|---|---|---|---|---|---|
| A0 | 0:00 | pre-drain; inlet valve driven for 5 s and flow pulses checked [K2 p. 90] | | | | 0.5 |
| A1 | 0:00.5 | fill 1: the heat exchanger's 3.1 L left from the previous run plus 0.9 L of mains water; 4.0 L in the tub at about 21 C | 0.9 | | | 1 |
| A2 | 0:01.5 | cold pre-rinse: no detergent, no heating; turbidity sensor calibrated at the start and read near the end (D1); level check by pump current, top-up if needed | | none | 2800; L/UR 60/60 | 11.5 |
| A3 | 0:13 | D1 = "soiled": 2.5 L pumped out and replaced with 2.5 L of mains water; liquor about 18.5 C | 2.5 | | | 2 |
| A4 | 0:15 | main wash, heat-up: dispenser lid released about 60 s after circulation resumes, tablet drops into the upper-rack tray and is sprayed from below by the upper arm; heater on continuously, about 2.6 K/min; turbidity read on the way up, from 45 C (D2); target taken at the top of the range for this branch | | 65 (45 to 65 by soil) | 3000; L/UR 60/60 | 18 |
| A5 | 0:33 | main wash, post-wash phase: heater off, pump on; liquor drifts from 65 to 62 C; at 1:04 the heat exchanger takes 2.5 L of cold mains water and the liquor falls to about 55 C by the end; turbidity read at the end (D3) | 2.5 (into the heat exchanger) | | 3000; L/UR 60/60 | 46 |
| A6 | 1:19 | drain, with short circulate / drain alternation to flush the filter | | | | 1.5 |
| A7 | 1:20.5 | intermediate rinse: 2.5 L from the heat exchanger at about 48 C, unheated; the heat exchanger is refilled at once with 2.5 L of mains water for the final rinse; liquor about 49 C | 2.5 (into the heat exchanger) | none | 2800; L/UR 45/45 | 7.5 |
| A8 | 1:28 | drain | | | | 1.5 |
| A9 | 1:29.5 | final-rinse fill: 2.5 L from the heat exchanger at about 36 C; circulation; rinse aid 5 pulses of 1 mL at about 1:30.5; liquor about 45 C | | | 2800; L/UR 45/45 | 2 |
| A10 | 1:31.5 | final rinse, heat-up | | 69 (61 to 72) | 2800; L/UR 45/45 | 9 |
| A11 | 1:40.5 | final rinse, hold | | | 2800; L/UR 45/45 | 3 |
| A12 | 1:43.5 | drain; load at about 67 C | | | | 1.5 |
| A13 | 1:45 | drying: door closed, no fan; brief drain pulses for dripping liquor; the heat exchanger is filled with 3.1 L of cold mains water in three portions (at about 5, 30 and 55 % of the step) and stays full for the next run; moisture condenses on the cooled left wall; condensate pumped out at the end | 3.1 (into the heat exchanger) | | | 40 |
| end | 2:25 | "0:00" on the display; the machine switches itself off after 1 min | | | | |

Totals: 145 min; mains water 0.9 + 2.5 + 2.5 + 2.5 + 3.1 = 11.5 L; energy 1.04 kWh in the thermal model at the conditions above (0.96 to 1.15 over the sensitivity range of section 4.5). Baths seen by the load: 4.0 L pre-rinse; 4.0 L wash (1.5 L of pre-rinse liquor kept, 2.5 L fresh); 2.9 L intermediate rinse; 2.9 L final rinse. The liquor is above 55 C for 48 min and above 60 C for 35 min.

Evidence for each step:

| Step | Evidence | Tag |
|---|---|---|
| A1 | tank holds 3.1 L and must be full after a long standstill [K2 p. 115, 120]; tank content is the first liquor [PA7]; one stand-alone bath is 4.0 L [B2]; first fill larger "to wet the dry load" on the sister platform [K1 p. 22] | mechanism [VERIFIED] sister; 4.0 L [ESTIMATED] |
| A2 | pre-rinse cold and without detergent [B1 p. 16-17]; sensor active in the pre-rinse, level check there [K2 p. 82, 91]; the stand-alone pre-rinse takes 15 min in all [B2] | [VERIFIED], the sensing from the 2010 platform manual; 11.5 min [ESTIMATED] |
| A3 | water exchange after the pre-rinse is the first sensor decision [B3], [K1 p. 9]; a 2.5 L partial exchange is my choice to reach 11.5 L with one rinse (section 4.6) | decision [VERIFIED]; amount [ESTIMATED] |
| A4 | dispenser opens "at the optimum time"; a pre-rinse precedes it, since powder for the pre-rinse goes on the door [B1 p. 28]; tablet path [B1 p. 28], [K2 p. 82]; 2.5 K/min design rate [K2 p. 67]; a water change after the pre-rinse raises the cleaning temperature in one 2008 variant [K1 p. 19], while in the other the structure with a pre-rinse has the lower of two temperatures [K1 p. 9] | path [VERIFIED]; rate and the 2008 rules [VERIFIED] sister; 60 s and 65 C [ESTIMATED], the 65 C chosen for the energy level (section 4.5) |
| A5 | heater off after the target, pump on ("Nachwaschphase") [PA7]; "the post-wash phase, when dishwashers typically continue to wash without reheating the water" [F2]; tank filled during cleaning to pre-warm the next bath [K2 p. 92]; "roughly 15 minutes before the main wash drains" [F2] | mechanism [VERIFIED] sister; 46 min set by the 145 min total [ESTIMATED] |
| A6 | filter flush by alternating pumps on the sister platform [K1 p. 26] | [VERIFIED] sister |
| A7 | intermediate rinse unheated [PA7], [PA8]; "Die Fuellmenge fuer das Klarspuelen wird im Zwischenspuelen gefuellt und im Waermetauscher bevorratet" [K2 p. 91] | [VERIFIED] sister; 2.5 L and 7.5 min [ESTIMATED] |
| A9 | 2.5 L of the 3.1 L tank for the final rinse [K2 p. 92]; 1 mL per pulse, setting r05 [K2 p. 80], [B1 p. 32]; rinse aid foams below about 35 C [PA6] | quantity [VERIFIED] sister; dose and time [ESTIMATED] |
| A10 | Auto's final-rinse temperature is not printed. This model's fixed programmes print 61 C (Eco), 63 C (Silence), 69 C (Intensive 70) and 69 C (Express 65) [B1]; the 2008 Auto used 65 C in every structure [K1 p. 9]. 69 C is taken because this model prints it for both of its programmes that, like Auto, are neither label-optimised nor given a long drying time, and because the model needs it to come near the sisters' measured energy; with 65 C it gives 0.98 kWh | 69 C [ESTIMATED], weakly supported |
| A13 | heat exchanger only, no door opening [B4], [B8]; tank filled in at least three stages [PA7]; condensate "is pumped out" [B3] | mechanism [VERIFIED]; 40 min [ESTIMATED], range 30 to 50 |

### 4.5 Energy and water balance

Model: the three nodes of machine.md 6.2 (water, load, machine) plus a heat-exchanger water node on the left wall, 1 s steps, parameters of section 3.1 (C_load 23 kJ/K, C_machine 14 kJ/K, G_wl 600 W/K, G_wm 250 W/K, UA 3.0 W/K, tank coupling 25 W/K, heater 2100 W). Pump power from section 3.3: 57 W at 3000 rpm, 47 W at 2800 rpm. The script is a working file, not in the repository; a second analyst's independent implementation gives 1.035 kWh for this table and agrees to 0.01 kWh on every variant below. The programme researcher's script uses a 2150 W heater, a 70 W pump and a 4 W/K loss and comes out 0.04 kWh higher. All [ESTIMATED].

| Item | Value |
|---|---|
| Heater, main wash: 18.5 to 65 C in 18.0 min (2.6 K/min) | 0.631 kWh |
| Heater, final rinse: 45 to 69 C in 8.9 min | 0.310 kWh |
| Circulation pump, 97 min | 0.087 kWh |
| Drain pump and electronics | 0.010 kWh |
| Total | 1.04 kWh (heating 91 %) |
| Heater on-time | 26.9 min in two blocks |
| Liquor temperature | 23 (pre-rinse) / 18.5 (after exchange) / 65 at 0:33 / 62 at 1:04 / 55 at 1:19 / 49 (intermediate rinse) / 45 to 69 (final rinse) / 67 at the last drain |
| Load temperature | 64 at the end of the heat-up; 55 at the wash drain; 67 after the final rinse; 59 after 40 min of drying |
| Mains water | 11.5 L, of which 3.1 L is in the tank at the end |

Hand check: (4.0 x 4.186 + 23 + 14) kJ/K x 42 K = 2.26 MJ = 0.63 kWh for the wash and (2.9 x 4.186 + 23 + 14) x 22 K = 1.08 MJ = 0.30 kWh for the final rinse.

Sensitivity (total held at 145 min by adjusting the hold): wash target 55 / 60 C: 0.96 / 1.00 kWh; final rinse 65 / 72 C: 0.98 / 1.08; British winter (inlet 8 C, room 19 C, 240 V): 1.15; half load: 0.87; cabinet loss 2.6 / 4.0 W/K: 1.03 / 1.07; machine heat capacity 10 / 18 kJ/K: 0.99 / 1.09. So 1.04 kWh, 0.96 to 1.15.

Against the evidence:

- Inside the printed 0.900 to 1.500 kWh and 7.0 to 15.5 L.
- The two class-D sisters: run for their conditions (14 place settings, 2:13) the model gives 1.04 kWh against the measured 1.06 and 1.11, 2 and 6 % low. That gap is inside what the machine's heat capacity alone leaves open (+-0.05 kWh for 10 to 18 kJ/K). With a 60 C wash and a 65 C final rinse the same model gives 0.94 kWh, 11 to 15 % below the sisters, which is why the table has neither.
- The printed extremes of Auto are not reached: 0.76 kWh against 0.900 on the light branch and 1.15 against 1.500 on the heavy branch, 15 and 23 % low. The programme researcher's model, which is this one with slightly different constants, gives 1.06 to 1.10 kWh for Express 65 against the printed 1.300 (15 to 18 % low), 1.16 to 1.27 for Intensive 70 against 1.300, and 0.88 for Eco 50 against the label's 0.836. The laboratory measured the sisters' one-hour programme at 1.11 and 1.19 kWh. So this model's printed figures for everything but Eco sit above the laboratory's (by 9 to 17 % for the one-hour programme) and further above the reconstruction. Whether that is margin in the printed figures or heat the reconstruction lacks (a wash held at temperature, a warmed pre-rinse, more thermal mass) is open.
- A wash held at 65 C by the heater would add 0.08 kWh (1.11). Nothing documents it for this platform, and the two descriptions there are say the opposite (section 4.2), so it is an alternative, not the table.

One power log decides all of this (section 6, item 7).

### 4.6 Alternatives the evidence allows

| Name | Change from the table | Water (L) | Model energy (kWh) | When to prefer |
|---|---|---|---|---|
| N-keep | A3 removed (pre-rinse water kept); a second intermediate rinse (7.5 min plus 1.5 min drain); hold shortened to about 38 min | 11.5 | 1.09 | the only 11.5 L structure that is documented for the platform (2008: "Reinigen mit 65, zweimal Zwischenspuelen") and the one that fits the manual's all-or-nothing wording about the water exchange. Choose it if a logged run shows no drain before the first heating and two unheated rinses |
| N-full | A3 is a full drain and a 4.0 L refill | 13.0 | 1.05 | if the second fill measures about 4 L |
| Wash target 60 C | A4 stops at 60 C after 15.8 min; the liquor then drifts to 57 C and falls to 51 C after the heat exchanger fills | 11.5 | 1.00 (0.94 with a 65 C final rinse as well) | if the first heating block in the power log is about 2 min shorter than the table's. The middle of the 45 to 65 C range, but 6 to 10 % (11 to 15 %) below the sisters |
| Held wash | in A5 the heater comes back on whenever the liquor falls 1.5 K below the target: about 5 min of extra heating in short bursts, most of it after the heat exchanger fills | 11.5 | 1.11 (1.06 with a 60 C target) | if the power log shows heater bursts throughout the hold. Not documented for the platform: the patent and the one owner's description both have no reheating [PA7], [F2] |
| Staged heat-up | A4 pauses once or twice on the way up, for the sensor reading at 45 C or for the enzymes, before continuing to the target | 11.5 | 1.04 | if the power log shows several heating blocks in the wash; consistent with [K1 p. 19] and with the 2010 Bosch whose owner hears the heater "click on and off throughout the main wash" [F2]. Same energy, but more minutes between 45 and 55 C, which matters to enzymes |
| Lower-only heat-up | during A4 only the lower arm is fed | 11.5 | 1.04 | the 2008 manual says this of its fixed programmes ("bis zum Erreichen der Temperatur nur im unteren Korb gespuelt") [K1 p. 8]; unknown for Auto |
| L, light (1:40) | no A3; wash 45 C (8.7 min heat-up); hold about 17 min; A7 replaced by a 0.5 L flush | 7.0 | 0.76 (0.71 with a 65 C final rinse; 0.78 with the wash held or at 50 C; printed 0.900) | pre-rinsed or nearly clean load |
| H, heavy (2:45) | A3 a full exchange; wash 65 C; hold about 54 min; two intermediate rinses | 15.5 | 1.15 (1.10 with a 65 C final rinse; 1.25 with the wash held; 1.34 with a pre-rinse warmed to 40 C as well; printed 1.500) | heavily soiled load, or failed sensor calibration |
| + regeneration | about 7 min and 5 L added in the main wash | +5 | +0.05 | every sixth run at hardness H04 |

Why the table has a partial exchange and one rinse rather than N-keep: the forum observer of current machines reports partial drains between pre-rinse and main wash and a second rinse that "is barely ever triggered" [F1]. Why it might be wrong: the manual describes the exchange as all or nothing, and N-keep's 1.09 kWh is as close to the sisters' 1.06 and 1.11 as the table's 1.04. Both give the load the same total water and nearly the same thermal history; they differ in how much pre-rinse soil reaches the wash and in the dilution before the final rinse. The simulator should carry both as selectable branches.

### 4.7 The other programmes, in outline

Reconstructions from the same building blocks, all [ESTIMATED]; printed data in 4.1.

| Programme | Reconstruction |
|---|---|
| Eco 50 | 4.0 L first fill; cold pre-rinse about 15 min; same water kept; heat to 50 C; long soak with intermittent spraying ("longer soaking and drying times" [B1]); filter flush; one 2.5 L intermediate rinse; final rinse 2.5 L to 61 C; drying of the order of 90 min. Sensors not used |
| Intensive 70 | 4.0 L; pre-rinse about 10 min; heat to 70 C at "increased spray pressure" [B14] (about 3400 rpm assumed) and hold 30 to 40 min; two or three 2.5 L intermediate rinses (the third adds exactly the printed 10 min and 2.5 L); final rinse 69 C; drying about 35 min |
| Express 65 | no pre-rinse; about 5.5 L with lower and upper arm together (state LU, if the production water switch has it); heat to 65 C in about 20 min; short hold; one rinse; final rinse 69 C; about 5 min drying. The 5.5 L is an assumption made to reach the printed 10.5 L. "Tabs ... Dissolving time of the tab is not attained" in short programmes [B3] |
| Silence 50 | as Eco at "reduced spray pressure" [B8] (about 2400 rpm assumed) with a 63 C final rinse. Its extra 1.5 L and 0.21 kWh over Eco are not explained by the printed sequence, and the 4.0 / 2.5 / 0.5 L arithmetic gives it Eco's 9.5 L, not the printed 11.0. A 5.5 L first bath as assumed for Express would give exactly 11.0 L (both levels fed at once at low pressure), which is a conjecture |
| Machine Care | not reconstructed: the printed 15.2 L does not follow from the arithmetic |
| Pre-rinse | one 4.0 L cold fill, about 11 min of spraying, drain |

## 5. Loading facts specific to this machine

### 5.1 Largest items by Rackmatic level

Printed, "Appliance height 81.5 cm with cutlery basket" [VERIFIED] (re-checked) [B1 p. 21]; level 1 is the highest position of the top basket.

| Level | Top basket, largest diameter | Bottom basket, largest diameter | Clear height above the upper-rack floor to the roof spinner / roof (mm) | Clear height above the lower-rack floor wires to the upper-arm blades / hub (mm) |
|---|---|---|---|---|
| 1 | 22 cm | 30 cm; 31 cm "as shown" | 235 / 265 | 301 / 282 |
| 2 | 24.5 cm | 27.5 cm | 260 / 290 | 276 / 257 |
| 3 | 27 cm | 25 cm | 285 / 315 | 251 / 232 |

The last two columns are [ESTIMATED] from section 2.2 (+-12 mm). A plate in the bottom basket leans 15 to 17 deg and rests on rails 13 mm above the floor wires. Up to about 26 cm in the rear rows (24 cm in the side rows) it sits on two rails and needs about D cos 15 + 4 mm above the tops of the floor wires. A larger plate is pushed off centre by the basket's rear or front wall, rests on one rail and leans on the wall, and needs more: D cos 15 + 9 mm at 30 cm, which is 299 of the 301 mm available at level 1. The one place where a plate sits lower is astride the left middle row and the second rear row: D cos 16 - 5 mm, 293 mm for a 31 cm plate. A simulator should treat the three printed bottom-basket limits as constraints on its geometry: if a 30 cm plate in the rear rows, a 27.5 cm plate at level 2 or a 25 cm plate at level 3 touches the upper arm, the geometry is wrong, not the plate. The same generic BSH manual prints 16 / 18.5 / 21 cm for the top basket of machines with a cutlery drawer [B12]: figures from drawer models must not be used for this machine.

### 5.2 The manufacturer's loading pictures

The manual's and the leaflet's drawings are illustrations for the basket family, not rated loads. Described from the rendered pages [VERIFIED] (re-checked for the three manual pictures).

- Top basket, manual p. 18: knife shelf on the left carrying two knives and a ladle laid lengthwise; about eight saucers or small plates standing one behind another in the left-centre rows with a shallow bowl resting on top; four tall tumblers leaning in the centre; cups on and under the folded cup shelf on the right; small bowls and cups along the front; the tablet collecting tray at the front centre empty.
- Bottom basket, manual p. 19: a large pot, a casserole and a pan on the left; dinner plates and soup plates standing in the rear rows facing sideways; a serving bowl on the right; the cutlery basket at the front, right of centre, with cutlery standing unsorted, handles down.
- Large plates, manual p. 20: four large plates standing one behind another in front-back planes on the left of the basket, leaning left, the rest of the basket empty and no cutlery basket. The basket drawn is schematic and has more tines per row than the owner's, so the picture alone does not say which of his rows hold the plates. Two things point to the same place: in the drawing the lowest point of the plates lies behind the rail line of the left middle row, by something like 80 mm at the drawing's scale, with the front row standing free in front of it; and by the geometry of section 2.2 a 31 cm plate fits only astride the left middle row and the second rear row, 74 mm behind that rail.
- Baking sheets, manual p. 21: top basket removed, spray head in the middle docking port, two baking sheets and two grilles leaning against the sides of the bottom basket.
- Leaflet 9001459881 [B7]: top basket with rows folded holding a tall pot, a glass bowl, glasses and cups; top basket with saucers in the left-centre rows, mugs under the knife shelf, tumblers between rows, a stem glass leaning on the cup shelf; latch positions marked 1, 2, 3 from top to bottom. Its bottom baskets have four or more foldable rows and a fold-down rack that this machine does not have.

### 5.3 The manual's loading rules, and the faults it names

Rules [VERIFIED] [B1 p. 6, 19-20, 28-31], summarised from the manual; the one sentence the simulator relies on most is quoted:

- Cups, glasses and small items go in the top basket; pans and plates in the bottom basket. Heavily soiled items such as pans also belong in the bottom basket; the reason the manual gives is that a more powerful spray jet gives a better result.
- Items with curves or hollows stand at an angle so that water runs off; containers go in open side down.
- Cutlery goes in the cutlery basket unsorted, sharp points down; long and pointed items on the knife shelf.
- "Do not block the spray arms - make sure that they can turn freely."
- No small parts in the tablet collecting tray and no tableware blocking it, so that the lid of the detergent dispenser can open.
- Nothing may stick out of the baskets so far that it gets in the way of the closing door.
- Large food remnants are scraped off; pre-rinsing under the tap is discouraged.
- Not suitable: wood, decorated glass, heat-sensitive plastic, copper and tin, items soiled with ash, wax, grease or paint, very small items.

Causes of poor results that the manual itself lists [VERIFIED] [B1 p. 43-45], [B3], summarised. They are a ready-made list of faults the simulator should reproduce:

| Symptom | Cause the manual names (summarised) |
|---|---|
| Remnants of food | items standing too close together, or an overfilled basket: the jets have to reach the surfaces; the remedy given is "Avoid points of contact." |
| Remnants of food | spray arm unable to rotate; spray arm nozzles blocked; filters soiled; filters not engaged |
| Remnants of food | "Tall narrow receptacles in corner areas are not rinsed adequately." Remedy given: not at too steep an angle and not in the corners |
| Remnants of food | the right and left sides of the top basket set to different heights |
| Remnants of food | programme too weak; "The sensors chose a weaker programme" after pre-rinsing by hand |
| Detergent residue | dispenser lid blocked by tableware and unable to open fully; tableware or a fragrance dispenser in the tablet tray; tablet stood on edge; spray arms blocked, so that the detergent was not rinsed out; tablets in the short programme |
| Not dry | water collecting in recesses; plastic, which stores less heat; cutlery touching; unloading before 30 minutes |
| Knocking | a spray arm striking tableware; with a small load, jets hitting the tub directly; light items moving |
| Door | the top basket pressing against the inner door; projecting items |
| Tea or lipstick marks | washing temperature too low |
| Water left at the end | a blockage in the filter system or beneath the filters |

### 5.4 The test-institute load

- The machine is rated for 13 place settings under EN 60436 [VERIFIED] [B5]. Per `docs/research/standards.md` section 5.1 that is 7 type A and 6 type B place settings plus 10 serving pieces, 140 items: 40 crockery, 69 cutlery, 21 glass, 8 melamine and 2 pots (reconstruction, tagged there).
- The loading plan for it is not published. The manual says that test institutes can obtain the information for comparability tests (for example to EN 60436) by e-mail to dishwasher@test-appliances.com, stating both the E-Nr. (product number) and the FD (production number) [VERIFIED] [B1 p. 16-17]. The owner has both numbers.
- Fallback until then [ESTIMATED]: dinner plates and soup plates in the two rear rows of the bottom basket (21 slots at 18 mm, so at most every second slot for dinner plates), platter and oven pot on the left side rows, the small pot and glass bowl on the right, the cutlery basket at the front centre astride the two side-row rail lines, with the 69 pieces spread over its 6 compartments; dessert plates and saucers in the short front-left rows of the top basket, cups and mugs under and on the cup shelves, glasses between the tall rows and in the humped zone, melamine bowls at the rear left, serving cutlery on the knife shelf.

### 5.5 What must not be blocked: keep-out volumes

Machine frame, z above the filter plate; [ESTIMATED] from sections 2 and 3, +-12 mm.

| Volume | Extent | Consequence if entered |
|---|---|---|
| Lower-arm sweep | disc of radius 232 mm about (0, 0), z = 34 to 58. The lower-rack floor wires start at z = 69, so anything hanging more than about 11 mm below them (a spoon through the cutlery-basket floor, a pan handle, a skewer) is in it. The 11 mm was measured with the basket on the open door and holds inside the tub only if the door's tracks are level with the tub's ledges (section 2.2, item 3). Fixed parts already stand under the sweep: the coarse-filter crown (top at about 28 mm, 47 to 123 mm from the axis) and the salt cap (top at about 25 mm, 150 to 242 mm from the axis), each leaving the arm's underside of the order of 10 mm | arm stalls at 0.2 N on the tip (section 3.4); one sector washed |
| Upper-arm sweep | disc of radius 232 mm about (0, -30); from the hub underside at z = floor - 55 to the nozzle bosses at floor - 20, where floor = 410 / 385 / 360 at level 1 / 2 / 3. Items in the bottom basket taller than 301 / 276 / 251 mm above its floor wires reach the blades; a 30 cm plate in the rear rows reaches 299 mm, so the printed limit has about 2 mm in hand here (section 2.2). Items hanging more than about 15 mm through the top-basket floor reach it from above | arm stalls at 0.1 N on the tip |
| Roof spinner | 60 mm circle about (0, +20), z above 645 | rotor stops; little consequence for the bottom basket, loss of the shower for the top basket |
| Feed tube and dock | under the top-basket floor from the arm hub to the rear wall, 17 mm tube; three ports on the rear wall. Both basket latches must sit at the same level or the dock leaks | upper arm starved |
| Dispenser lid | the lid slides in the door plane; nothing swings into the tub. A tall item at the front of the top basket leaning against the door, or a tablet on edge, can hold it | detergent not released |
| Tablet tray | trough 215 x 52 x 47 mm at the front centre of the top basket, its rim about 55 mm above the basket floor (465 / 440 / 415 mm at level 1 / 2 / 3); must be empty; the path from the chamber at (-22, door, 510) down into it must be clear | tablet not caught, or not dissolved |
| Tray from below | the upper arm must be able to spray the tray's slotted floor: nothing large directly under the front centre of the top basket floor | slow dissolution |
| Filter and sump cover | x = -130 to +130, y = -150 to +75 on the floor; fallen items and labels blind it | pump starves; error E:92-40 |
| Riser | on the rear wall at x = -30 to +30, standing 15 to 21 mm proud from floor to roof, 34 mm at the docking ports; the lower basket's rear wall is recessed for it, so a plate or tray overhanging that wall in the middle meets the riser first | basket will not push home |
| Door plane | y = -275 (liner); both baskets and the upper arm's sweep already reach to within about 15 mm of it, and the liner may be up to 15 mm nearer than that (section 2.1) | door pushed open, leaks |
| Corners outside the arm discs | 39 % of the plan area lies outside both 230 mm discs; the lower arm's two tip nozzles and the upper arm's two tip nozzles are the only jets aimed there | the manual's "tall narrow receptacles in corner areas" warning |

## 6. Measurement checklist for the owner

About 35 minutes with a tape measure, a ruler or straightedge, a phone, kitchen scales, a set of drill bits (2 to 5 mm in 0.5 mm steps; their shanks serve as pin gauges), a few cocktail sticks, the largest plate in the house, and calipers if available. Then one unattended Auto run with a plug-in power meter. In order of effect on the cleaning prediction. Each item says what it replaces.

1. Lower spray arm, 5 minutes. Pull it straight up off its stem. Lay it on a sheet of paper beside a ruler and photograph it square-on from above, then from below. Push a cocktail stick into each of the 11 openings and photograph from the side and from the tip end, so each jet direction shows. For each opening note the largest drill shank that enters (for the slots, the two that fit across and along). Note which blade carries the underside outlet and which way it and the three hooded outlets point. Weigh the arm. Replaces: the whole of the lower nozzle table in section 3.2 (radii to 1 mm, bores, all angles), the rotation sense, C_d A and therefore flow.
2. Upper spray arm, 4 minutes. Pull out the top basket, unscrew the arm downward. Same photographs, cocktail sticks and drill shanks for its 7 openings. Above all: are the four slots cut square through the arm or at a slant, and to which side; and how steeply do the two tip outlets point. Photograph the underside and the docking plate at the back of the feed tube. Replaces: the upper nozzle table, the assumed 16 deg slant of the slots that drives the arm in the model, its rotation sense.
3. Heights and tub, 8 minutes with the tape. First note which of its three positions the top basket is in (top, middle or bottom). Then, baskets pushed in: (a) filter plate to the top face of the lower arm; (b) top face of the lower arm to the underside of the lower-basket floor wires, once with the basket pushed in and once with it pulled out onto the door; (c) lower-basket floor wires to the underside of the upper arm; (d) top-basket floor wires to the roof, and to the white roof spinner; (e) filter plate to roof; (f) width between the side walls at basket height; (g) back wall to the front edge of the tub, and how deep the door's inner panel is recessed (straightedge across the open door); (h) centre of the lower-arm hub to the back wall, and centre of the upper-arm hub to the back wall; (i) how far the pipe on the back wall stands proud of it, and the gap between the lower basket's rear rim and the back wall with the basket pushed home; (j) with a straightedge laid on the filter plate, the height of the filter's crown and of the salt cap, and the gap from each up to the underside of the lower arm; (k) the plate test: with the top basket in its top position, stand the largest plate in the house (or 30 cm and 31 cm discs cut from stiff card) first in the rear rows, then astride the left middle row and the second rear row; push both baskets in, turn the upper arm by hand and measure the gap between plate and arm. Replaces: the whole of section 2.2 and the tub box, including my inference about the Rackmatic level in the photograph, the 30 mm offset between the arm axes, the depth budget of section 2.1, and the assumption that the basket sits at the same height on the door as in the tub. (k) tests directly whether the printed 30 and 31 cm limits are met where the model says they are.
4. Baskets, 7 minutes. Lay a tape measure across each basket left to right and another front to back and photograph each basket from directly above with the whole rim in frame (for the top basket include the back rim and fold the cup shelves down). Calipers over the coating on a rim wire, a floor wire and a tine in each basket. Stand a ruler behind one rear tine, one side tine, one tall and one short tine of the top basket and photograph from the side. Count the tines of the two right-hand side rows of the bottom basket with the cutlery basket lifted out. Fold both rear rows of the bottom basket down and photograph from the side (fold direction, folded height). In the top basket measure the tablet tray (inside width, depth, height), the height of its rim above the basket floor and the height of the basket's front wall. Cutlery basket: count the compartments; measure the length, the width and height of the body, and the two tunnels underneath (width, height, distance apart and from each end); note over which rows it will stand. Replaces: the 2 % scale uncertainty on every basket dimension, all wire diameters, tine heights and leans, the mirrored right-hand rows, the folded state, the tray, the cutlery basket's shape.
5. Roof and door, 3 minutes. Photograph the roof spinner from below with a ruler; unclip its cage and try drill shanks in the outlet above it. On the open door measure from the top edge of the inner panel down to the lower lip of the detergent chamber, and from the left edge to its centre; measure the chamber opening. Replaces: the assumed 6 mm roof outlet (a third of the upper-level flow), the dispenser position, the tablet drop.
6. Display, 2 minutes, nothing started. Switch on, press each programme in turn and note the time shown; then Auto with Extra Dry, with Half Load, with SpeedPerfect+. Hold Setup for 3 s and note the settings H, r and d. Replaces: whether 2:25 is fixed or drifts, the option effects no document prints, the rinse-aid dose (r setting).
7. One logged Auto run, 5 minutes to set up. Plug-in power meter or smart plug logging every 10 s or faster, rated for 13 A. Leave a phone recording sound on the worktop above the machine. Note the display at the start and whenever you pass. Replaces: almost every [ESTIMATED] duration in section 4.4: the heater blocks give the wash and final-rinse targets, whether the heat-up is staged and whether the heater comes back on during the hold; 30 W blips are drains, so their count before the first heating settles the exchange question and their count afterwards the number of rinses; the last heater-off to the end is the drying time; heater watts and total kWh calibrate the thermal model. The sound gives the water-switch period (the pitch changes when the level changes), how many distinct states it cycles through, and the arm speeds (the rhythm of jets on the door); a waterproof action camera on the lower basket would show which levels spray together. If the machine is paired with Home Connect, screenshots of the remaining time through the run give the jumps.
8. If there is more time: a dishwasher-safe temperature logger in the cutlery basket for the same run; the drain hose into a bucket on the scales, weighing each discharge (bath volumes and carry-over); the weight of each empty basket; a macro photograph of the filter plate and of the micro filter against a ruler; a second Auto run with a heavily soiled load, and a third with clean dishes, to bracket the sensor.
9. One e-mail: to dishwasher@test-appliances.com with E-Nr. SMV4HAX40G/13 and FD 0106, asking for the EN 60436 comparability-test conditions and the loading plan for 13 place settings.

## 7. Calibration parameters

Value adopted, expected range, and the test that fixes it. Checklist item numbers refer to section 6.

| Parameter | Adopted | Expected range | Test |
|---|---|---|---|
| Tub interior W x D x H | 545 x 500 x 675 mm | 535 to 557 x 485 to 515 x 660 to 690 | item 3 |
| Lower-arm axis to rear wall; upper-arm axis offset | 265 mm; 30 mm toward the door | 240 to 290; 0 to 45 | item 3 (h) |
| Door-liner recess beyond the tub flange | 40 mm | 20 to 40 (the appliance's 550 mm depth leaves little room) | item 3 (g) |
| Riser proud of the rear wall; recess in the lower basket's rear wall | 21 mm; 6 mm | 15 to 21; 5 to 12 | item 3 (i) |
| Lower-arm top face above the filter | 50 mm | 42 to 58 | item 3 (a) |
| Filter crown top; salt cap top, above the filter plate | 28 mm; 25 mm | 20 to 34; 15 to 33 | item 3 (j) |
| Lower-rack floor wires above the lower arm | 21 mm (measured on the open door) | 12 to 32; in the tub possibly a few millimetres different | item 3 (b) |
| Upper-arm top face above the lower-arm top face at level 1 | 335 mm | 320 to 345 | item 3 (c) |
| Clearance of a 30 cm plate in the rear rows under the upper arm at level 1 | 2 mm | 0 to 15; the printed limit says it is positive | item 3 (k) |
| Upper-rack floor above the upper-arm top face | 25 mm | 20 to 40 | item 3 |
| Tablet tray rim above the upper-rack floor | 55 mm | 45 to 65 | item 4 |
| Cutlery basket: body width, body height; tunnel spacing, clear width, height | 128, 127 mm; 106, 14, 100 mm | published, 120 to 133; 101 to 111, 11 to 18, 92 to 108 | item 4 |
| Basket scale (lower-rack rim width between wire centres) | 519 mm | 505 to 525 | item 4 |
| Rear tine pitch, height, lean | 18.2 mm, 66 mm, 15 deg | 17.5 to 18.5, 62 to 70, 12 to 18 | item 4 |
| Side tine pitch, height, lean | 26.0 mm, 81 mm, 17 deg | 25 to 27, 75 to 86, 14 to 20 | item 4 |
| Wire diameters over the coating | rim 5.5, floor 4.0, tine 4.0, upper rack 3.5 mm | +-1 | item 4 |
| Upper-rack tine heights | 95 (rear rows), 45 (front hairpins), 88 (hinged row) mm | 75 to 115, 30 to 60, 80 to 95 | item 4 |
| Lower-arm nozzle radii | section 3.2 | +-4 mm | item 1 |
| Nozzle bores and slots | 3.0 mm round, 3.8 mm at 185 mm, slots 4 to 5 x 2 mm | areas +-30 % | items 1, 2 |
| Jet angles of every nozzle | lower arm: hoods 45 to 55 deg elevation, rings vertical; upper arm: tip outlets radial at 35 deg, slots slanted 16 deg (a placeholder for the drive) | unknown; slot slant 0 to 25 deg | items 1, 2 (cocktail sticks) |
| Rotation sense | lower clockwise, upper counter-clockwise | either | items 1, 2 (look at the hoods and slots) |
| Roof outlet bore; droplet speed; cone half-angle | 6 mm; 2.5 m/s; 65 deg | 4 to 9; 1.5 to 4.5; 45 to 80 | item 5 for the bore; a camera in the tub for the rest |
| Pump curve H_0, b at normal speed | 4.0 m; 1.19e-3 m/(L/min)^2 | H_0 3 to 6 m | bench test; or arm pressure by manometer over a nozzle |
| Pump speed per phase | 2800 / 3000 rpm nominal | 2000 to 3500 | pump tone in the recording of item 7 |
| Arm pressure, jet speed, flow at normal speed | 24.7 kPa, 7.0 m/s, 27.9 L/min lower; 21.7 kPa, 6.6 m/s, 16.2 + 8.9 L/min upper + roof | 15 to 35 kPa; 5.5 to 8.5 m/s; 20 to 35 L/min | jet reach through a clear door; capture and weigh |
| Branch losses K_L, K_U, K_R | 2.0e10, 8.0e10, 1.4e11 Pa s2/m6 | factor 0.5 to 2 | pressure at the hub |
| Arm speeds; friction k_f | 32 and 26 rpm (the second is tuned, not derived); 9.3 and 3.8 mm | 20 to 45 rpm | item 7 (sound), or a camera in the tub |
| Water-switch states, period, transition | L / UR, 60 s / 60 s (45 / 45 in rinses), 2.5 s | states: L / U, L / UR, or with separate roof phases; 20 to 120 s; 1 to 5 s | item 7 (sound, camera) |
| Bath volumes | 4.0 L first, 2.5 L later, 0.5 L flush | 3.5 to 4.2; 2.3 to 3.0 (an intermediate rinse may be 2.9 L with no separate flush) | item 8 (bucket) or water meter |
| Carry-over | 0.4 L (0.17 in the sump) | 0.25 to 0.5 | item 8 |
| Sump working volume, V_min, hold-up time | 1.2 L, 0.5 L, 2.0 s | 0.8 to 1.6; 0.3 to 0.8; 1 to 4 s | not accessible to the owner |
| Filter open areas and split | 88 + 26 cm2 plate and cover, 85 cm2 micro; 57 / 43 % | split 40 to 75 % through plate and cover | macro photographs (item 8) |
| Heater power; heating rate | 2100 W at 230 V; 2.6 K/min full load | 2000 to 2350 W; 2.2 to 3.0 | item 7 |
| C_machine, UA, G_wl, tank coupling | 14 kJ/K, 3.0 W/K, 600 W/K, 25 W/K | 10 to 18; 2 to 5; 300 to 1200; 10 to 50 | items 7 and 8 (temperature logger) |
| Auto: exchange after pre-rinse | 2.5 L | 0, 2.5 or 4.0 L | item 7 (drain count) |
| Auto: wash target; heat-up; hold | 65 C; one block of 18 min; 46 min with the heater off | 55 to 65; one block or staged; 34 to 55 min, heater off or holding | item 7 |
| Auto: number of intermediate rinses | 1 | flush only, 1 or 2 | item 7 |
| Auto: final-rinse target and hold | 69 C; 3 min | 61 to 72; 1 to 6 | item 7 |
| Auto: drying length | 40 min | 30 to 50 | item 7 |
| Auto: energy at laboratory conditions | 1.04 kWh | 0.96 to 1.15; two measured sisters 1.06 and 1.11 | item 7 |
| Detergent release time | 60 s into the main-wash circulation | 0 to 5 min | open the door briefly at 14, 16 and 18 min (water may be warm) |
| Rinse-aid dose and time | 5 mL at about 1:30.5 | 3 to 6 mL | item 6 (setting r) |
| Turbidity thresholds D1, D2, D3 | not set | | item 8 (clean and heavily soiled runs) |
| Start display: fixed or adaptive | unresolved | | item 6, repeated after differently soiled runs |

Priority: (1) nozzle tables and jet angles, including what drives the upper arm, (2) one logged Auto run, (3) the vertical stack with the plate test, the basket scale and the tub's depth, (4) arm speeds and the water switch's states and pattern, (5) bath volumes, (6) thermal constants, (7) dispenser timing and sensor thresholds.

## 8. Not found

Each with the fallback used.

- Published interior dimensions of the tub, floor slope and corner radii (545 x 500 x 675 mm estimated; 4 deg and 30 mm generic). Also not found: where either arm stands front to back, and how deep the door liner is recessed (265 mm, a 30 mm offset and 40 mm estimated, jointly at their upper limit).
- Published dimensions of this machine's own baskets; only sister baskets have them (photographs, scaled).
- Whether the lower basket stands at the same height inside the tub as on the open door, where it was photographed (assumed equal).
- Which rows the manual's "as shown" 31 cm plates stand in (astride the left middle row and the second rear row, by geometry and a reading of the drawing).
- The folded state of the lower basket's rear rows: fold direction and folded height (none; they are up in every photograph).
- The height of the coarse filter's crown and of the salt cap above the filter plate (28 and 25 mm estimated), and the cutlery basket's body height and tunnel dimensions (scaled from photographs).
- Bare wire diameters, coating thickness and material (generic 3.4 mm steel with 0.4 mm nylon; photo estimates over the coating).
- Any jet angle, any true orifice size, the blade carrying the underside outlet, what drives the upper arm, the rotation sense and speed of either arm (boss shapes; torque balance; an assumed slant of the upper arm's slots).
- The roof spinner's outlet bore, flow, rotor speed and spray pattern (6 mm assumed; droplet speed and cone angle invented).
- A pump curve, a speed schedule or an electrical power figure for the brushless pump 12014980 (curve anchored on the 2008 sister pump and a BSH patent).
- The position set of the production water switch 00644996 (a patent embodiment's six positions taken as candidates), and its sequence and dwell times in any programme, and its gear ratio (generic 60 s / 60 s; upper arm paired with the roof spinner by assumption).
- Sump working volume, pipe volumes, minimum level (generic).
- Drain rate of this drain pump (generic 16 L/min; sister 10 L/min).
- The micro filter's mesh and the coarse filter's slot width (BSH patent ranges; generic 5 mm).
- Turbidity thresholds and the map from reading to temperature and time ("in der Elektronik hinterlegt").
- A step-by-step sequence, a temperature trace or a power trace of Auto 45-65 on this platform; its wash temperature at normal soiling; whether its heat-up is staged or its wash held at temperature; its final-rinse temperature; its drying time; the dispenser release time; the rinse-aid dose per setting on the 2021 software.
- A measurement of plain Auto on this model. The two laboratory figures are for 14-place-setting sisters; the one app figure on file is for Auto with an option.
- The intermediate-rinse volume (2.5 L adopted; 2.9 L in a BSH patent example), and what makes Silence 50 use 11.0 L and Machine Care 15.2 L.
- What the start display's 2:25 assumes, and whether it adapts.
- The effect sizes of Extra Dry, Half Load and SpeedPerfect+ on Auto; how "AquaMix" glass protection works on this model.
- The official loading plan for 13 place settings (by e-mail from BSH only).
- The BSH document "GV640A dishwasher platform training" (69 pages), listed on a manuals site behind a captcha: the most likely home of the fill volumes and programme charts.

## 9. Sources

The copies of everything fetched are working files, not in the repository; each source is given below by its public address where one was recorded. "(re-opened)" marks what I opened again myself; the rest was opened this session by the researcher named in the notes. An independent analyst downloaded six of the BSH and Kueppersbusch documents afresh and found them byte-identical to the saved copies.

Owner's photographs (first-hand evidence), `docs/reference/owner-photos/`, all re-opened:

- [O79] IMG_9079, the rating plate and control panel (not published: it shows the serial number)
- [O80] IMG_9080-front-view-lower-basket-pulled-out.jpg
- [O81] IMG_9081-lower-basket-from-above.jpg
- [O82] IMG_9082-tub-floor-lower-spray-arm-and-filter.jpg
- [O83] IMG_9083-upper-basket-from-above.jpg

Bosch documents for SMV4HAX40G:

- [B1] User manual "Information for Use SMV4HAX40G", 9001937295_B, 52 pages. https://media3.bsh-group.com/Documents/9001937295_B.pdf . Pages 6, 8, 12-13, 15-21, 22-28, 29-34, 37-39, 40-46, 48. (re-opened as extracted text and rendered pages 12, 18, 19, 20, 27)
- [B2] Quick reference guides 9001643502_B (2022) and 9001937296_A (2024), page 1. https://media3.bsh-group.com/Documents/9001643502_B.pdf ; https://media3.bsh-group.com/Documents/9001937296_A.pdf (re-opened)
- [B3] Interactive user manuals 9001575819 and 9001937297. https://www.bosch-home.co.uk/manual/9001575819?productCode=SMV4HAX40G/13 ("Environmental protection and saving energy"; troubleshooting) (re-opened: AquaSensor paragraph)
- [B4] Product specification sheet, en-GB. https://media3.bsh-group.com/Documents/specsheet/en-GB/SMV4HAX40G.pdf (re-opened)
- [B5] EPREL record 365247. https://eprel.ec.europa.eu/qr/365247 ; https://eprel.ec.europa.eu/api/products/dishwashers2019/365247 (re-opened as saved JSON)
- [B6] Installation instructions 9001594147_C ("GV 640 Voll-I - 81,5 cm") and 9001902261_A. https://media3.bsh-group.com/Documents/9001594147_C.pdf
- [B7] Loading leaflet 9001459881_A. https://media3.bsh-group.com/Documents/9001459881_A.pdf
- [B8] Product page. https://www.bosch-home.co.uk/en/product/SMV4HAX40G (specification table embedded in the page)
- [B9] Spare-parts list for SMV4HAX40G/13. https://www.bosch-home.co.uk/en/spare-parts-list/SMV4HAX40G-13
- [B10] Kitchen-planning model. https://media3.bsh-group.com/3D_Asset/17013994_SMV4HAX40G_KPL.zip (vertex list of SMV4HAX40G.obj: body 598 x 813.5 x 515.5 mm, door from 519.9 to 550.4 mm, furniture door to 573.4 mm; re-opened)
- [B11] Official product photographs. https://media3.bsh-group.com/Product_Shots/16580356_SMV4HAX40G_STP_def.webp and 17757775, 17757776, 17757779 under the same path (re-opened)
- [B12] Sister and range documents: SMS4HAI48E manual https://media3.bsh-group.com/Documents/9001453806_C.pdf ; generic manual for the generation https://media3.bosch-home.com/Documents/9001442770_A.pdf (p. 27, basket-height tables for all variants) ; SMV4HAX48E spec sheet https://media3.bsh-group.com/Documents/specsheet/de-DE/SMV4HAX48E.pdf ; US manual SHP78CM5N https://media3.bosch-home.com/Documents/9001641455_C.pdf (p. 15)
- [B13] Bosch Australia dishwashing catalogue 2017 https://media3.bosch-home.com/Documents/MCDOC02269689_BH_3207_B_-_Dishwashing_Catalogue_Ed_1_2017_FA.pdf (p. 2, 8) ; Bosch New Zealand brochure 2021 https://media3.bosch-home.com/Documents/MCDOC02344627_Bosch_NZ_Dishwashing_Brochure.pdf (p. 2)
- [B14] Bosch Ireland, "Dishwasher symbols guide" (generic for the range, not for this model). https://www.bosch-home.ie/experience-bosch/using-your-appliance/dishwasher-symbols-guide-old ("Intensive 70": "This heavy-duty programme uses high temperatures and increased spray pressure"; fetched 2026-10-09)
- [B15] EU declaration of conformity for SD6PW1B. https://media3.bsh-group.com/Documents/18273715_EU%20DoC_Bosch_SD6PW1B_SI6PW1B_SL6PW1B.pdf

BSH part pages and part photographs (part photographs are under https://media3.bsh-group.com/Product_Shots/ with the file numbers given):

- [P1] Lower spray arm 00668148: https://www.ersatzteilshop.de/sprueharm-unten-kunststoff-00668148-668148-bosch-siemens-neff-kueppersbusch.html ; pattern part https://www.ersatzteilshop.de/sprueharm-unten-passend-fuer-bosch-00668148-bluparts-in-geschirrspueler-10110265.html ; photographs 16260430, MCSA01860095, MCSA01860096, MCSA01860097, MCSA091315, MCSA092356 (all re-opened)
- [P2] Upper spray arm 11010054: https://www.bosch-home.com/de/de/product/11010054 ; https://www.ersatzteilshop.de/sprueharm-oben-bosch-11010054-mit-rohr-fuer-geschirrspueler.html ; photographs MCSA01860195, MCSA01860196 (re-opened)
- [P3] Feed pipe 11003118: https://www.ersatzteilshop.de/sprueharmrohr-bosch-11003118-senkrechtes-steigrohr-fuer-geschirrspueler.html ; https://www.bosch-home.co.uk/en/product/11003118 ; photographs MCSA02588552, MCSA02588576 (re-opened)
- [P4] Roof spinner 00611388: https://www.ersatzteilshop.de/deckendusche-bosch-00611388-brause-oben-fuer-geschirrspueler.html ; photographs MCSA00748273, MCSA01886352 (re-opened). Baking-sheet spray head 00612114: https://www.ersatzteilshop.de/spruehkopf-fuer-backbleche-fettfilter-etc-00612114-612114-bosch-siemens-neff.html
- [P5] Filter set 00645038: https://www.bosch-home.com/de/de/product/00645038 (re-opened) ; https://www.ersatzteilshop.de/sieb-set-wie-bosch-00645038-2-teilig-fuer-geschirrspueler-10101031.html ; flat filter 00645037: https://www.ersatzteilshop.de/sieb-bosch-00645037-fuer-geschirrspueler.html ; photographs MCSA01868124, 15856878, MCSA01868138 (re-opened)
- [P6] Sump cover 12038407: https://www.ersatzteilshop.de/abdeckung-fuer-pumpentopf-12038407.html ; photographs 26144163, 26144165 ; sump 00668102, photograph 16228785
- [P7] Lower baskets: this machine's, without dimensions, https://www.bosch-home.com/de/de/product/20007406 ; sisters https://www.bosch-home.com/de/de/product/20002434 , https://www.ersatzteilshop.de/geschirrkorb-unten-neff-20002434-fuer-geschirrspueler.html , https://www.ersatzteilshop.de/geschirrkorb-unten-bosch-20002125-fuer-geschirrspueler.html , https://www.ersatzteilshop.de/geschirrkorb-unten-bosch-20003053-fuer-geschirrspueler.html , https://www.ersatzteilshop.de/geschirrkorb-unten-mit-besteckkorb-bosch-20006942-fuer-geschirrspueler-bosch.html
- [P8] Upper baskets: this machine's, without dimensions, https://www.bosch-home.com/de/de/product/20001992 (photographs 22207753, 22207763, re-opened) ; sisters https://www.bosch-home.com/de/de/product/00770441 , https://www.ersatzteilshop.de/geschirrkorb-bosch-00778368-oberkorb-mit-rackmatic-fuer-geschirrspueler-1.html , https://www.ersatzteilshop.de/geschirrkorb-20000272.html
- [P9] Cutlery basket 11057829: https://www.bosch-home.com/de/de/product/11057829 ; https://www.ersatzteilshop.de/besteckkorb-bosch-11057829-fuer-geschirrspueler.html (dimensions and the key "Bemassung-Messweise: Laengenangabe = Artikelbreite; Breitenangabe = Artikelhoehe; Hoehenangabe = Artikeltiefe"; re-opened) ; photographs 25130582, 25130584 and, for the earlier part 00668270, MCSA01856903 (re-opened) ; accessory page https://www.bosch-home.co.uk/en/product/dishwashers/dishwasher-accessories/baskets-and-holders/cutlery-baskets/SMZ5100
- [P10] Inner door 00680311: https://www.ersatzteilshop.de/tuere-innen-bosch-00680311-fuer-geschirrspueler.html ; photograph MCSA00955943
- [P11] Door seal 00263096: https://www.ersatzteilshop.de/tuerdichtung-wie-bosch-00263096-dreiseitig-fuer-geschirrspueler.html
- [P12] Salt container cap 00611319: https://www.ersatzteilshop.de/salzbehaelterdeckel-bosch-00611319-fuer-geschirrspueler.html
- [P13] Flip tines: https://www.ersatzteilshop.de/klappstachel-fuer-geschirrspueler-bosch-12033326-sprueharm.html (photographs 20018787, 20018788) ; https://www.ersatzteilshop.de/klappstachel-fuer-glashalter-bosch-12033302-haltemechanismus-glas.html (20018785) ; https://www.ersatzteilshop.de/klappstachel-fuer-glashalter-bosch-12033291-haltemechanismus.html (20018775) (photographs of the two upper parts re-opened) ; bearing https://www.ersatzteilshop.de/lager-fuer-klappstachelreihen-bosch-10014124-fuer-geschirrspueler.html
- [P14] Wheels: https://www.ersatzteilshop.de/rad-fuer-unterkorb-bosch-10014040-fuer-geschirrspueler.html ; https://www.ersatzteilshop.de/rad-fuer-unterkorb-bosch-10014039-fuer-geschirrspueler.html
- [P15] Basket handle and tablet tray 12033368: https://www.ersatzteilshop.de/griff-fuer-unter-und-oberkorb-bosch-12033368-fuer-geschirrspueler-2stk.html ; photographs 20018575, 20018499 (re-opened)
- [P16] Knife shelf https://www.ersatzteilshop.de/messerablage-fuer-oberkorb-bosch-11037806-in-geschirrspueler.html ; cup shelves https://www.ersatzteilshop.de/oberkorbeinsatz-bosch-12005548-tassenetagere-lang-fuer-geschirrkorb-oben-geschirr.html , https://www.ersatzteilshop.de/oberkorbeinsatz-vorne-bosch-12005549-fuer-geschirrspueler.html ; guide rails https://www.ersatzteilshop.de/korbfuehrungsschiene-bosch-00668097-set-rechts-links-fuer-oberkorb-geschirrspueler-1.html (re-opened as the saved extract)
- [P17] Heat pump 12014980: https://www.ersatzteilshop.de/heizpumpe-bosch-12014980-1bs3610-6aa-fuer-geschirrspueler.html ; replacement heater https://shop-wittlich.de/p/heizung-fuer-bosch-neff-siemens-heizpumpen-12014090-00755078-12019637
- [P18] Dispenser 00755073: https://www.ersatzteilshop.de/dosierkombination-bosch-00755073-fuer-geschirrspueler.html ; https://www.bosch-home.com/de/de/product/00755073
- [P19] Heat exchanger 00770952: https://www.ersatzteilshop.de/wassertasche-bosch-00770952-regenerierdosierung-fuer-geschirrspueler-1.html
- [P20] Water switch 00644996 and motor 00611329: https://www.ersatzteilshop.de/drehschieber-bosch-00644996-stellventil-fuer-heizpumpe-geschirrspueler.html ; https://www.ersatzteilshop.de/drehschiebermotor-an-heizpumpe-00611329-611329-bosch-siemens-neff-kueppersbusc.html ; photographs MCSA091270 (motor label), 15856104 (closure disc) and MCSA092262 (re-opened)

Service documentation for the platform:

- [K1] Kueppersbusch service manual H7-71-05, "Einbau-Geschirrspuelautomaten Baureihen 634 mit Automatikprogrammen", 6 April 2008. http://tds.kueppersbusch.de/kb-technik/service_manuals/Geschirr/DE/A7_014DE.pdf . Pages 8, 9, 10, 19, 22, 26, 29-30, 35, 36, 42, 44, 46, 49, 63. (re-opened as extracted text)
- [K2] Kueppersbusch service manual H7-71-07, "Einbau-Geschirrspuelautomaten Baureihe 640", 13 October 2010, 125 pages. http://tds.kueppersbusch.de/kb-technik/service_manuals/Geschirr/DE/A7_018DE.pdf . Pages 8, 66-69, 71-73, 75-84, 88-92, 99-110, 115-116, 120-123. (re-opened as extracted text)
- [D1] BSH "Repair Instructions - Dishwashers" DIS 840 (58300000176874), 2016, as hosted at https://www.manualslib.com/manual/1337144/Bosch-Sps40c12gb.html (pages 48-49; read as an automatic paraphrase of the pages, not their own text)

BSH patents:

- [PA1] WO2009068385A1, "Wasserfuehrendes Haushaltsgeraet mit einer Wasserweiche". https://patents.google.com/patent/WO2009068385A1/de (description of Fig. 6: a disc with seven through-openings DO1 to DO7 and six positions P1 to P6; re-opened)
- [PA2] DE102009027910A1, "Geschirrspuelmaschine mit einem optimierten Siebsystem". https://patents.google.com/patent/DE102009027910A1/de (re-opened)
- [PA3] DE102009026876A1, heat exchanger tank ("Behaeltervolumen von beispielsweise 3 bis 4 l"). https://patents.google.com/patent/DE102009026876A1/de (re-opened)
- [PA4] EP2482702B1, "Geschirrspuelmaschine mit einem Flottenspeicher" (re-opened)
- [PA5] EP2275017A2, "Geschirrspuelmaschine mit einer Umwaelzpumpe". https://patents.google.com/patent/EP2275017A2/de (re-opened)
- [PA6] DE102010039611A1, "Geschirrspuelmaschine mit einem manuell anpassbaren Spuelprogramm". https://patents.google.com/patent/DE102010039611A1/de (re-opened)
- [PA7] DE102009029039A1 (EP2289388B1), water tank for condensation drying and its filling method. https://patents.google.com/patent/DE102009029039A1/de (re-opened)
- [PA8] DE19651297A1, "Verfahren zum Betreiben einer Geschirrspuelmaschine", 1996. https://patents.google.com/patent/DE19651297A1/de
- [PA9] EP1029496B1, "Haushalt-Geschirrspuelmaschine" (EPO publication server)

Tests, forums, other:

- [T1] Verein fuer Konsumenteninformation, KONSUMENT dishwasher test 10/2021. https://www.konsument.at/test-geschirrspueler-102021 ; table https://archiv.vki.at/konsument/tabellen/318926318976_4.html (re-opened as the saved table: rows "Automatikprogramm" for energy, water and duration, seven machines)
- [F1] automaticwasher.org, "does Auto 45-65 on BSH dishwashers choose between two fixed degrees, or is it variable?", 2025. https://automaticwasher.org/threads/does-auto-45-65-on-bsh-dishwashers-choose-between-two-fixed-degrees-or-is-it-variable.97583/ (post 4, about a zeolite model; re-opened)
- [F2] automaticwasher.org, thread 52765, posts 93 and 101, 2014, by the owner of a 2010 Bosch with heat exchanger and no zeolite. https://automaticwasher.org/threads/europe-phosphate-regulations-all-stpp-out-within-2016-in-dw-products.52765/latest (re-opened)
- [F5] Kuechen-Forum, "Verbrauchsangaben Geschirrspueler Eco vs. Auto", 2024. https://www.kuechen-forum.de/forum/themen/verbrauchsangaben-geschirrspueler-eco-vs-auto.48928/ (re-opened: post and attached table; the table's Auto rows carry the options "I" IntensivZone and "V" VarioSpeedPlus, none is plain Auto)
- [M] `docs/research/machine.md` (sections 2, 3, 4, 6, 7, 12); `docs/research/standards.md` (section 5.1)

Researchers' notes merged here (`docs/research/machine-bosch-notes/`): `documents.md`, `hardware.md`, `programme.md`, `photos.md`. They hold further detail not repeated in this dossier: the control panel and basic settings, the installation data, the full error-code list, the softener table, the published masses of parts, the photo researcher's camera fits, and outlines of every forum thread.
