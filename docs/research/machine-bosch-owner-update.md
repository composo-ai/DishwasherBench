# Bosch SMV4HAX40G/13: what the owner's measurements of 2026-10-09 change

> **Reference, kept as written (10 October 2026).** Written by a specialist role of the build;
> requests to the owner in it are of that date. Sections 2 and 3.3 quote short phrases of the
> owner's descriptions of the spray arms as written; `docs/reference/owner-measurements.md`
> gives the same descriptions in reported speech, and the drill test of section 2.3 is given in
> reported speech here too. The index of the documents is `docs/README.md`.

This file is an overlay on `machine-bosch-smv4hax40g.md` (the dossier). It turns the owner's notes
(`docs/reference/owner-measurements.md`) and his photographs IMG_9086 to IMG_9112 into numbers, says
which dossier values they replace, and re-solves the hydraulics. The dossier itself is not edited.

Read section 0 first: one of the owner's figures (the 4.5 mm bore) is contradicted by his own
photograph with the tape in it, and the choice between the two decides the jet speed.

## 0. Headlines

1. **Counts.** Lower arm: 10 openings on top (8 round holes, 2 slots) and 1 on the underside. The
   wing with five holes has 4 vertical holes, 1 angled hole and a tip slot; the wing with three has
   2 vertical holes, 1 angled hole and a tip slot. His "7 holes" is a miscount; "5 on one wing, 3 on
   the other" is right. Upper arm: 7 openings on top (1 round hole and 6 rectangular slots, of which
   5 are in the top of a boss and 1 is in the side of a wedge) and 1 small round hole on the
   underside. His "four horizontal slots" should be five; "two on wing A, three on wing B" is right.
2. **Rotation.** The lower arm turns clockwise seen from above and the upper arm counter-clockwise.
   Both were guesses in the dossier and are now read off the photographs.
3. **The drive is not what the dossier assumed.** On the lower arm it is two angled round holes
   (one per wing, at about 183 and 207 mm) and one slightly tilted tip slot. On the upper arm it is
   the two tip outlets and the two outer slots; the dossier had the tip outlets pointing radially
   and tilted all four slots by a tuned 16 degrees.
4. **Bore size: two answers.** The owner's drill test says about 4.5 mm (a 4 mm bit loose, a 5 mm bit
   does not enter). His photograph IMG_9086, with the tape touching the arm, shows the black bore of
   two holes as 3.3 mm (35 to 36 pixels where one centimetre of tape is 105 to 110 pixels). The
   dossier's earlier, independent photo estimate was 3.0 mm. I could not reconcile the two. Section
   4 solves both. With 3.3 mm the dossier's pump curve reproduces the documented duty point without
   change; with 4.5 mm it does not. **This overlay uses 3.3 mm and carries 4.5 mm as the stated
   alternative.** One photograph of the drill bit lying on the tape settles it.
5. **Heights.** The roof is 640 mm above the filter plate (dossier 675). The top-basket floor is at
   420 mm in the highest setting (dossier 410). The lower-basket floor wires are 15 mm above the
   lower arm (dossier 21). His numbers close to the millimetre with the dossier's 50 mm for the
   lower arm if "underside of the upper arm" means the lowest point of its hub.
6. **Jet speed.** 7.0 m/s in the dossier becomes 6.65 m/s on the lower arm and 5.8 m/s on the upper
   arm with the tape-scaled openings, or 5.1 m/s on the lower arm if the drill test is right.

Tags used in this file: **M** measured by the owner (tape or drill); **C** counted or observed on
his photographs; **P** scaled from his photographs (the reference is named); **E** still estimated.

Pixel coordinates are in the full-resolution photographs after applying the EXIF rotation (4284 x
5712 portrait unless stated). The crops and the scripts (`t86.py`, `t86b.py`, `t99*.py`,
`t109.py`, `pose109.py`, `hyd2.ts`) were working files and are not in the repository; the
coordinates here are the record.

## 1. Nozzle-angle convention (restated)

As machine.md section 0.3 and the tables of its section 3.2. Each nozzle has two angles in the frame
of the blade that carries it:

- **theta**, the azimuth of the jet in the plane of the arm: 0 = radially outward along that blade,
  90 = tangential and trailing (opposite to the direction the blade travels), 180 = radially inward,
  270 = tangential and leading.
- **rho**, the elevation above the plane of the arm: 90 = straight up, 0 = horizontal, negative =
  downward.

The unit vector of the jet, in (radial outward, trailing, up) components, is
(cos rho cos theta, cos rho sin theta, sin rho). The term that turns the arm is t = cos rho sin
theta. The owner's "backwards" is trailing, theta = 90; his "outward" is theta = 0; "backwards and
outwards" lies between. For the lower arm, which turns clockwise seen from above, the trailing
direction is the counter-clockwise tangent; for the upper arm it is the clockwise tangent. "Half" +
is the blade with more round holes (lower arm: five; upper arm: the owner's wing A, which has the
round hole), - is the other.

## 2. Lower spray arm (part 00668148)

### 2.1 Count, and which photograph settles it

IMG_9109 (the arm in the tub, both blades in one frame) settles it. On the right-hand blade: four
ringed round holes at pixels (2761, 3714), (3095, 3622), (3264, 3584), (3432, 3556), a hooded hole
at (3764, 3510) and the tip hood. On the left-hand blade: ringed holes at (1819, 4050) and (840,
4277), a larger hooded hole at (294, 4384) and the tip slot at about (50, 4380). IMG_9111 shows the
five-hole wing from its tip (holes at y = 2787, 3085, 3275, 3512 with the drill in the last, the
angled hole at y = 4100, the tip slot at y = 4990) and IMG_9110 the three-hole wing's tip (slot
hood, angled hole with the drill in it, one vertical hole). The underside outlet is in IMG_9112.

So: 8 round holes and 2 slots on top, 1 outlet underneath. The dossier's count of 10 on top stands.
Two of its shapes do not: its L4 ("short slot in a square boss") is a plain round hole, and its L7
and L8 ("the largest bore" and "an oblong outlet in a chimney") are the two angled round holes.

### 2.2 Radii

What IMG_9086 gives directly (tape lying on the arm, zero at the tip of the three-hole wing).
Centimetre lines of the tape are at y = 513 (4 cm), 829 (7), 1783 (16), 2546 (23), 3320 (30), 4473
(40), 5063 (45), 5184 (46); 105 px/cm at the top, 118 px/cm at the bottom.

| Feature | Pixel | Tape reading (cm) | Distance from the - tip end (mm) |
|---|---|---|---|
| Tip end of the three-hole wing | y = 113 | 0.22 | 0 |
| Angled hole L8 (half hidden by the tape) | (2385, 345) | 2.41 | 21.9 |
| Round hole L6 | (2350, 820) | 6.87 | 66.5 |
| Round hole L2 | (2343, 1800) | 16.15 | 159.3 |
| Tip slot of the five-hole wing | (2415, 5140) | 45.65 | 454.3 |
| Tip end of the five-hole wing | y = 5178 | 45.98 | 457.6 |

Overall length 457.6 mm by the tape against the published 460 mm: the tape scale is good to 0.5 %.
Reading error +-1.5 mm (the tape is a few millimetres above the blade face away from the dome, which
shifts a reading by up to 2 mm at the ends).

The five holes of the other wing are under the tape in IMG_9086. They come from IMG_9111 through a
one-dimensional projective fit along the arm (reference points: that wing's tip and the two round
holes of the far wing): 42, 88, 111.5, 136 and 181 mm, tip slot 224.5 mm, +-5 mm because the far
reference points are strongly foreshortened.

The tape cannot say where the axis is along the arm, because the hub is under it. With the axis at
the mid-point of the two tips the three-hole wing has its holes at 70, 163 and 208 mm; the
dossier, which worked from the hub seen in IMG_9082, has 67, 159 and 205 mm on that wing and 47, 93,
116, 140, 185 mm on the other. The two sets differ by a shift of the axis of about 4 mm; hole to
hole they agree within 2 mm (for example L2 to L1 across the hub: 112 mm here, 114 mm in the
dossier). IMG_9109, where the stem is visible (axis at x = 2380 px), favours the dossier's side of
that shift but cannot fix it. I adopt the mean. Uncertainty +-4 mm on each radius, with the two
blades moving in opposite directions; spacing along one blade +-2 mm.

### 2.3 Sizes

- **Round holes, drill test [M]:** a 4 mm drill bit is fairly loose and a 5 mm bit does not fit;
  the owner's estimate is probably 4.5 mm.
- **Round holes, tape in the same frame [P]:** in IMG_9086 the bore of L2 is a sharp-edged black
  disc from x = 2326 to 2361 and y = 1783 to 1819 (35 by 36 px) where the tape runs 110 px/cm: 3.2
  to 3.3 mm. The bore of L6 is 36 to 38 px at 105 px/cm: 3.4 to 3.6 mm. The raised ring round each
  is 6.7 to 7.0 mm across. In IMG_9111 the drill's silhouette (62 px) is 0.93 of the dark opening it
  stands in (67 px) and half the ring's outer diameter (125 px), so the bit photographed is about
  3.1 to 3.4 mm across at that point if the ring is 6.7 mm.
- These cannot both be right, and the arm is 460 mm long against the same tape, so the tape scale is
  not the problem. Either the bit was not the size reported or the dark disc is not the bore. I use
  **3.3 mm +-0.3** and give every result for 4.5 mm as well.
- **Angled holes:** the same bore as the vertical ones as far as can be seen; not measured.
- **Tip slots:** the slot of the five-hole wing is 60 px long in IMG_9086 (5.1 mm at 11.8 px/mm) and
  seen foreshortened across; in IMG_9111 it is 140 x 50 px, 1.3 times the bore of the hole beside it
  after correcting for distance. Adopted 5.0 x 1.8 mm (+-0.7, +-0.4), long axis across the blade.
- **Underside outlet:** rectangular, about 3.0 x 2.2 mm (+-0.7), in a rectangular recess, 23 mm from
  the tip end (IMG_9112, hole at (2045, 2710), tip end at y = 2880; scale from the blade width).

### 2.4 Directions

- **Vertical holes** (six): the probe stands square to the face in IMG_9089 to IMG_9093. rho 90.
- **Angled holes** (one per wing): hooded, the mouth facing sideways. IMG_9094 (top face toward the
  camera, tip down, probe leaving the hood to the right), IMG_9111 (seen from the tip of the
  five-hole wing: ramp on the left, mouth on the right) and IMG_9110 (seen from the hub toward the
  tip of the three-hole wing: the drill leans left) agree: with the tip pointing south and seen from
  above, the jet goes east. Tangential; elevation about 45 degrees (the drill in IMG_9110 leans 50
  to 55 degrees from the vertical after allowing for the camera's pitch; a loose bit can lean
  further than the bore). theta 90, rho 45 +-10.
- **Tip slot of the five-hole wing:** "angled slightly radially outward" [M]. theta 0, rho 75 +-10.
- **Tip slot of the three-hole wing:** "angled slightly backward (same direction as the angled
  backwards hole)" [M]. theta 90, rho 75 +-10.
- **Underside outlet:** "slightly radially inward facing" [M]. theta 180, rho -70 +-15. It sweeps the
  filter plate and gives no drive; the dossier had assumed it was half tangential.

**Rotation.** The three tangential jets all point the same way round. A jet going east at the
southern tip pushes that tip west: the arm turns **clockwise seen from above** [C]. The dossier's
estimate (clockwise, low to moderate confidence) is confirmed.

### 2.5 Table

Flows are for diverter state L at 3000 rpm with the dossier's pump curve and 3.3 mm bores: p_arm =
22.1 kPa, jet velocity 6.65 m/s, total 30.5 L/min. In brackets: the same with 4.5 mm bores (12.8
kPa, 5.06 m/s, 38.4 L/min).

| ID | Half | R (mm) | theta | rho | Shape | Size (mm) | A (mm2) | C_d | Q (L/min) | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| L1 | + | 45 | 0 | 90 | round in raised ring | 3.3 [4.5] | 8.55 [15.9] | 0.85 | 2.90 [4.10] | vertical (probe) |
| L2 | - | 69 | 0 | 90 | round in raised ring | 3.3 [4.5] | 8.55 [15.9] | 0.85 | 2.90 [4.10] | tape 159.3 mm from the tip |
| L3 | + | 91 | 0 | 90 | round in raised ring | 3.3 [4.5] | 8.55 [15.9] | 0.85 | 2.90 [4.10] | |
| L4 | + | 114 | 0 | 90 | round in raised ring | 3.3 [4.5] | 8.55 [15.9] | 0.85 | 2.90 [4.10] | not a slot |
| L5 | + | 138 | 0 | 90 | round in raised ring | 3.3 [4.5] | 8.55 [15.9] | 0.85 | 2.90 [4.10] | the drill stands in it in IMG_9111 |
| L6 | - | 161 | 0 | 90 | round in raised ring | 3.3 [4.5] | 8.55 [15.9] | 0.85 | 2.90 [4.10] | tape 66.5 mm from the tip |
| L7 | + | 183 | 90 | 45 | round in a hood, mouth sideways | 3.3 [4.5] | 8.55 [15.9] | 0.85 | 2.90 [4.10] | **drive** |
| L8 | - | 207 | 90 | 45 | round in a hood, mouth sideways | 3.3 [4.5] | 8.55 [15.9] | 0.85 | 2.90 [4.10] | **drive**; tape 21.9 mm from the tip |
| L9 | + | 225 | 0 | 75 | slot in a tip hood, long axis across the blade | 5.0 x 1.8 | 8.30 | 0.78 | 2.59 [1.97] | slightly outward: corners, no drive |
| L10 | - | 225 | 90 | 75 | slot in a tip hood | 5.0 x 1.8 | 8.30 | 0.78 | 2.59 [1.97] | slightly backward: weak **drive** |
| L11 | not determined (listed +) | 207 | 180 | -70 | rectangular outlet in a recess, underside | 3.0 x 2.2 | 6.60 | 0.80 | 2.11 [1.60] | down and slightly inward: filter plate |
| Sum | | | | | | | 91.6 [150.4] | C_d A = 76.4 [126.4] | 30.5 [38.4] | dossier: 80.2, 66.0, 27.9 |

Radii +-4 mm; sizes as section 2.3; angles +-10 degrees. Area of a slot is a stadium, of the
rectangular outlet a rectangle (`nozzleArea` in packages/machine).

## 3. Upper spray arm (part 11010054)

### 3.1 Count and radii

IMG_9099, tape lying on the arm's edge, read from the tip of wing A (bottom of the frame). Tape
lines: 10 cm at y = 4575, 20 at 3563, 30 at 2497, 40 at 1339; 9.5 px/mm at the bottom, 12.4 px/mm
at the top. The hub socket is visible, centred at (2355, 3195): reading 23.51 cm.

| ID | Wing | Feature | Pixel | Reading (cm) | R from the hub centre (mm) | Dossier |
|---|---|---|---|---|---|---|
| U1 | A (+) | round hole | (2450, 3634) | 19.32 to 19.40 | 41 | 44 |
| U3 | A | slot in a low boss | (2540, 4521) | 10.52 | 130 | 132 |
| U4 | A | slot in a low boss | (2617, 4812) | 7.54 | 160 | 162 |
| U6 | A | "vertical slot": mouth in the side of a wedge at the tip | (2452, 5381) | 1.54 to 1.72 | 219 | 221 |
| U2 | B (-) | slot in a low boss | (2262, 2280) | 32.03 | 85 | 85 |
| U5 | B | slot in a tilted boss | (2137, 1003) | 42.84 | 193 | 192 |
| U7 | B | slot in a tilted boss at the tip | (2186, 633) | 45.87 | 223 | 221 |

Tip ends at 1.07 and 46.42 cm: 453 mm along the tape (the arm is bowed, so this is a chord of the
published 460 mm). Radii +-3 mm. The dossier's radii stand within 3 mm.

IMG_9108 (underside) shows one more opening: a small round hole in a raised ring about 38 mm (+-6)
from the hub centre, below the blade (pixel (2230, 2460); hub centre near (2230, 2880)). The dossier
recorded it as "one small hole near the hub; no wash nozzles". The arm is pressurised, so the hole
discharges whatever it is for; it is U8 below. Which wing it is under was not determined.

So: wing A has the hole, two slots and the side-facing tip slot (4 openings); wing B has three slots
(3 openings). 1 hole and 6 slots on top, 1 hole underneath.

### 3.2 Sizes (all scaled against the tape in IMG_9099, +-0.4 mm)

- U1: 25 x 26 px at 0.096 mm/px: 2.5 mm.
- Slots: rectangular with sharp corners, long axis along the arm. U3 is 2.55 x 5.10 mm (bounding
  box), U5 2.9 x 4.8 mm; the dark area of each is 9.1 to 9.2 mm2. Adopted 4.8 x 2.2 mm, 10.6 mm2.
- Tip outlets: U7 2.5 x 4.1 mm seen from above in a tilted boss; U6 4.4 x 2.7 mm seen from above
  with its mouth in a face tilted about 45 degrees. Adopted 4.3 x 2.3 mm, 9.9 mm2, +-30 %. The
  dossier had 3.2 x 1.5 mm.
- U8: about 2.7 mm (+-0.5), scaled from the blade width in IMG_9108.

### 3.3 Directions (owner's words, checked on IMG_9100, 9101, 9104, 9106, 9107)

| ID | Owner | theta | rho | Photograph |
|---|---|---|---|---|
| U1 | "the hole is vertical" | 0 | 90 | |
| U2 | wing B "the first slot is vertical" | 0 | 90 | upright boss in IMG_9104 and 9106 |
| U3 | wing A first slot, not mentioned | 0 | 90 | upright boss in IMG_9101 |
| U4 | wing A "the second slot is facing backwards slightly" | 90 | 78 | IMG_9100 |
| U5 | wing B second slot "facing backwards and slightly outwards" | 70 | 70 | boss tilted away from the camera and toward the tip in IMG_9104 |
| U6 | wing A "the vertical slot is facing backwards significantly maybe 45 degrees" | 90 | 45 | IMG_9100: the wedge's mouth faces the left edge of the blade, tip at the bottom; IMG_9101 |
| U7 | wing B final slot "backwards and outwards in the same directions but to a greater degree" | 60 | 50 | IMG_9104, 9106, 9107 |
| U8 | (not mentioned) | 0 | -90 | IMG_9108 |

Angles +-10 to 15 degrees; none was measured with a protractor.

**Rotation.** In IMG_9100 wing A is seen from above with its tip at the bottom and the mouth of U6
facing left: the jet goes west at the southern tip and pushes it east. In IMG_9104 the blade is
seen from the side with its tip to the left and the two outer bosses facing away from the camera;
in IMG_9106, from the other side, they face the camera. All three give **counter-clockwise seen
from above** [C]. The dossier had assumed this with no evidence.

### 3.4 Table

Diverter state UR at 3000 rpm, dossier pump curve: p_arm = 16.6 kPa, jet velocity 5.77 m/s, arm
19.8 L/min, roof 8.6 L/min. (State U, arm alone: 19.3 kPa, 6.22 m/s, 21.3 L/min.)

| ID | Half | R (mm) | theta | rho | Shape | Size (mm) | A (mm2) | C_d | Q (L/min) | Role |
|---|---|---|---|---|---|---|---|---|---|---|
| U1 | + (A) | 41 | 0 | 90 | round in a round boss | 2.5 | 4.91 | 0.85 | 1.45 | centre |
| U2 | - (B) | 85 | 0 | 90 | rectangular slot in a boss, long axis along the arm | 4.8 x 2.2 | 10.56 | 0.78 | 2.85 | vertical fan |
| U3 | + | 130 | 0 | 90 | rectangular slot | 4.8 x 2.2 | 10.56 | 0.78 | 2.85 | vertical fan |
| U4 | + | 160 | 90 | 78 | rectangular slot, boss tilted slightly | 4.8 x 2.2 | 10.56 | 0.78 | 2.85 | weak **drive** |
| U5 | - | 193 | 70 | 70 | rectangular slot, boss tilted | 4.8 x 2.2 | 10.56 | 0.78 | 2.85 | **drive**; passes under the tablet tray |
| U6 | + | 219 | 90 | 45 | rectangular mouth in the side of a tip wedge | 4.3 x 2.3 | 9.89 | 0.78 | 2.67 | **drive** |
| U7 | - | 223 | 60 | 50 | rectangular slot in a tilted tip boss | 4.3 x 2.3 | 9.89 | 0.78 | 2.67 | **drive**, walls and corners |
| U8 | not determined (listed +) | 38 | 0 | -90 | round in a ring, underside | 2.7 | 5.73 | 0.80 | 1.59 | downward onto the lower basket near the axis |
| Sum | | | | | | | 72.7 | C_d A = 57.1 | 19.8 | dossier: 52.3, 41.0, 16.2 |

The dossier's note that "nothing seen on this arm points sideways", its 16 degree slot tilt and its
remark that the tip outlets cannot drive the arm are all superseded.

## 4. The vertical stack

### 4.1 What was measured

| # | Reading | Value | Source |
|---|---|---|---|
| a | Top of the lower arm to the lower-basket floor wire | 15 mm | owner's tape [M] |
| b | Lower-basket floor wire to the underside of the upper arm | 300 mm | [M] |
| c | Top-basket floor to the roof | 220 mm | [M] |
| d | Filter plate to the roof | 640 mm | [M] |
| e | Filter plate to the underside of an upper-arm blade | 390 +-7 mm | IMG_9109, read here |
| f | Filter plate to the top of the lower arm | not measured | dossier: 50 +-8 mm |

Reading e. In IMG_9109 the tape hangs from its hook, which is pushed up under the upper arm beside
the hub (hook top at about (1975, 130), under the blade that runs to the upper left), and bends
where it meets the filter plate in front of the filter cylinder. Centimetre lines: 3 at y = 708, 10
at 1826, 20 at 3130, 30 at 4196, 33 at 4477; the bend is at the 39 (38.8 to 39.8 cm; the 15 inch
mark, 38.1 cm, is above it and the 16 inch mark, 40.6 cm, lies on the plate). The tape leans back
by 4 to 9 degrees (its foot is about 90 mm in front of the arm axis), which takes 1 to 5 mm off.

Readings to the centimetre are good to +-5 mm. The owner did not say whether a and b are taken to
the top, the middle or the underside of the 4 mm floor wire: +-2 mm more.

### 4.2 Reconciliation

d - c puts the top-basket floor at **420 mm**. f + a puts the lower-basket floor wire at 65 mm, and
adding b puts "the underside of the upper arm" at 365 mm, which is 55 mm below the top-basket
floor. The dossier's `hub_underside_z` is "UR_floor_z - 55" (the arm is 30 mm deep at the hub
[VERIFIED], under a 17 mm feed tube). So the owner's five readings and the dossier's two figures
close exactly, 50 + 15 + 300 + 55 + 220 = 640, **if his "underside of the upper arm" is the lowest
point of the hub**. Reading e then says the blade underside is 390 +-7 mm, against 365 + 19 = 384 mm
from the dossier's arm section (hub 30 mm deep, blade 11 mm): consistent.

The other reading of his words (b taken to a blade's underside, which is where the tape in
IMG_9109 is) gives lower-arm top = 390 - 315 = 75 mm and a blade only 30 mm below the basket floor.
A camera reconstruction of IMG_9109 (tape as a vertical ruler, the eight holes of the lower arm as
points of known spacing) puts the lower arm's top face 55 to 80 mm above the tape's foot, so it does
not exclude this; but the stem visible in the same photograph (270 px wide, 28.7 mm; 36 mm long
between the sump cover and the blade) supports the dossier's 50 mm above the sump cover, and three
earlier estimates gave 50 to 53 mm above the filter plate. I keep 50 mm. This is the weakest link
of the stack: everything between the lower arm and the upper arm's hub moves with it.

### 4.3 Heights above the filter plate (mm)

| Level | New | Dossier | Basis | Tag |
|---|---|---|---|---|
| Lower arm, underside outlet | 36 | 36 | not measured | E |
| Lower arm, top face | 50 (+-8; possibly up to 75) | 50 | f | E |
| Lower-basket floor wires: underside / centre / top | 65 / 67 / 69 | centre 71 | f + a | M on E |
| Lower-basket tine rails (centres) | 80 | 84 | 13 mm above the floor wires, as the dossier | P |
| Upper arm, lowest point of the hub, at level 1 / 2 / 3 | 365 / 340 / 315 | 355 / 330 / 305 | f + a + b | M on E |
| Upper arm, blade underside, at level 1 / 2 / 3 | 386 / 361 / 336 | 374 / 349 / 324 | 384 from the hub, 390 from IMG_9109; floor - 34 | M, P |
| Upper arm, top face, at level 1 / 2 / 3 | 397 / 372 / 347 | 385 / 360 / 335 | blade 11 mm thick; floor - 23, which leaves room for the 17 mm feed tube | E |
| Top-basket floor (wire tops), at level 1 / 2 / 3 | 420 / 395 / 370 | 410 / 385 / 360 | d - c; 25 mm steps as the dossier | M; step E |
| Roof spinner, lower face | 610 | 645 | roof - 30, as the dossier | E |
| Roof | 640 (+-5) | 675 | d | M |

**Which setting.** His c and b are the manual's two limits for the top basket in its highest
position (22 cm in the top basket, 30 cm in the bottom basket, level 1), and a floor at 420 mm is 10
mm above the dossier's level 1 and 35 mm above its level 2. So the basket was in its **highest
setting (level 1)**, as the note in `owner-measurements.md` already argues. The other two settings
are 25 mm and 50 mm lower; the 25 mm step is still the dossier's inference from "5 cm over three
stages".

**The roof is at 640 mm by his tape where the dossier estimated 675 mm.** The tub is 35 mm lower
than modelled and the space above the top basket is 220 mm, not 265 mm.

What follows from it:

- A 22 cm item standing upright in the top basket at level 1 reaches the roof (420 + 220 = 640); the
  dossier had 15 mm to spare under the roof spinner. Under the spinner (lower face about 610 mm)
  only 19 cm fits.
- A 30 cm plate in the rear rows of the lower basket tops out about 4 mm lower than in the dossier
  (near 368 mm): 18 mm clear of the blades (386 mm) but 3 mm above the lowest point of the hub (365
  mm), which the rear rows do not pass under. A 31 cm plate clears the blades by about 7 mm. The dossier's 2 mm margin becomes a
  comfortable one everywhere except under the hub.
- The feed pipe is published as 680 mm from its stub ends to its top. With the roof at 640 mm the
  stub ends are at least 40 mm below the filter plate, while the dossier's docking-port heights
  (345, 371, 398 mm above the stub ends, scaled from a photograph) put the top port about 13 mm
  above the plate's level when matched to the arm at level 1. One of those is wrong by about 50 mm.
  Not resolved here; it does not affect the spray model.

## 5. Hydraulic consequences

Solved with `hydraulicOperatingPoint` and `armSteadyState` of packages/machine on the Bosch
specification with only the nozzle tables replaced (script `hyd2.ts`; pump H_0 = 4.0 m at N_0 = 3000
rpm, b = 1.19e-3 m per (L/min)^2; branch losses, static lifts and the 6 mm roof outlet as in the
dossier; friction k_f = 9.3 and 3.8 mm, c_v = 0.002 N m s). With the unmodified package data the
script reproduces the dossier's section 3.3 (L at 3000 rpm: 27.9 L/min, 24.7 kPa, 7.04 m/s, 32 rpm).

The dossier assumed round bores of about 3.0 mm. The premise that the measured openings have
"several times" that area holds only for the drill-test figure and only per hole (15.9 against 7.07
mm2, 2.25 times). Summed over the arm: lower arm C_d A 66.0 mm2 in the dossier, 76.4 mm2 with
tape-scaled bores (1.16 times), 126.4 mm2 with drill-test bores (1.9 times); upper arm 41.0 to 57.1
mm2 (1.4 times, from the larger tip outlets and the underside hole).

### 5.1 Case P: tape-scaled openings (3.3 mm bores), dossier pump curve

Q in L/min, p in kPa, v in m/s. Arm speed with the dossier's friction; "free" is the frictionless
speed.

| State | N (rpm) | p_pump | Head (m) | Q total | Lower: Q / p / v | Upper: Q / p / v | Roof: Q / p / v | P_hyd (W) | P_el (W) | Arm speed (rpm), free |
|---|---|---|---|---|---|---|---|---|---|---|
| L | 2400 | 18.2 | 1.86 | 24.2 | 24.2 / 13.9 / 5.28 | | | 7.4 | 34 | 34, 61 |
| L | 2800 | 24.7 | 2.52 | 28.4 | 28.4 / 19.2 / 6.20 | | | 11.7 | 49 | 39, 72 |
| L | 3000 | 28.3 | 2.89 | 30.5 | 30.5 / 22.1 / 6.65 | | | 14.4 | 58 | 42, 77 |
| L | 3400 | 36.3 | 3.71 | 34.7 | 34.7 / 28.5 / 7.56 | | | 21.0 | 81 | 47, 87 |
| UR | 2400 | 19.6 | 2.00 | 21.7 | | 15.3 / 9.9 / 4.46 | 6.4 / 11.0 / 4.69 | 7.1 | 33 | 48, 84 |
| UR | 2800 | 26.1 | 2.67 | 26.2 | | 18.3 / 14.2 / 5.34 | 7.8 / 16.7 / 5.78 | 11.4 | 48 | 60, 101 |
| UR | 3000 | 29.8 | 3.04 | 28.4 | | 19.8 / 16.6 / 5.77 | 8.6 / 19.9 / 6.31 | 14.1 | 57 | 67, 109 |
| UR | 3400 | 37.8 | 3.87 | 32.7 | | 22.7 / 21.9 / 6.63 | 10.0 / 26.9 / 7.35 | 20.6 | 80 | 79, 125 |
| U | 2400 | 21.9 | 2.24 | 16.4 | | 16.4 / 11.5 / 4.79 | | 6.0 | 29 | 53, 91 |
| U | 2800 | 29.6 | 3.02 | 19.7 | | 19.7 / 16.5 / 5.75 | | 9.7 | 42 | 66, 109 |
| U | 3000 | 33.9 | 3.46 | 21.3 | | 21.3 / 19.3 / 6.22 | | 12.0 | 50 | 73, 118 |
| U | 3400 | 43.3 | 4.42 | 24.5 | | 24.5 / 25.5 / 7.15 | | 17.7 | 69 | 87, 135 |
| R | 2400 | 24.4 | 2.49 | 7.5 | | | 7.5 / 15.2 / 5.51 | 3.0 | 19 | |
| R | 2800 | 33.1 | 3.38 | 9.2 | | | 9.2 / 22.8 / 6.76 | 5.1 | 26 | |
| R | 3000 | 38.0 | 3.88 | 10.0 | | | 10.0 / 27.1 / 7.36 | 6.3 | 30 | |
| R | 3400 | 48.7 | 4.98 | 11.6 | | | 11.6 / 36.4 / 8.55 | 9.4 | 41 | |
| LU | 2400 | 13.2 | 1.35 | 31.9 | 20.3 / 9.8 / 4.43 | 11.6 / 5.7 / 3.39 | | 7.0 | 32 | 29 and 32 |
| LU | 2800 | 17.5 | 1.78 | 37.8 | 23.6 / 13.3 / 5.16 | 14.2 / 8.5 / 4.14 | | 11.0 | 46 | 33 and 43 |
| LU | 3000 | 19.8 | 2.03 | 40.7 | 25.3 / 15.2 / 5.52 | 15.4 / 10.1 / 4.50 | | 13.5 | 55 | 35 and 48 |
| LU | 3400 | 25.1 | 2.56 | 46.5 | 28.6 / 19.5 / 6.25 | 17.9 / 13.6 / 5.21 | | 19.5 | 76 | 39 and 59 |

State R does not involve the arms and is unchanged from the dossier.

### 5.2 Case D: drill-test bores (4.5 mm) on the lower arm, dossier pump curve

The upper arm, and so states UR, U and R, are as in case P.

| State | N (rpm) | p_pump | Head (m) | Q total | Lower: Q / p / v | Upper: Q / p / v | P_hyd (W) | P_el (W) | Arm speed (rpm), free |
|---|---|---|---|---|---|---|---|---|---|
| L | 2400 | 14.3 | 1.46 | 30.4 | 30.4 / 8.0 / 4.01 | | 7.2 | 33 | 44, 54 |
| L | 2800 | 19.2 | 1.97 | 35.7 | 35.7 / 11.1 / 4.71 | | 11.5 | 48 | 51, 64 |
| L | 3000 | 22.0 | 2.25 | 38.4 | 38.4 / 12.8 / 5.06 | | 14.1 | 57 | 55, 68 |
| L | 3400 | 28.1 | 2.88 | 43.6 | 43.6 / 16.5 / 5.75 | | 20.5 | 79 | 62, 78 |
| LU | 2400 | 10.5 | 1.07 | 35.4 | 25.7 / 5.7 / 3.39 | 9.7 / 4.0 / 2.82 | 6.2 | 29 | 38 and 24 |
| LU | 2800 | 13.7 | 1.40 | 41.8 | 29.8 / 7.7 / 3.93 | 12.0 / 6.1 / 3.50 | 9.6 | 41 | 43 and 34 |
| LU | 3000 | 15.6 | 1.59 | 45.0 | 31.9 / 8.8 / 4.21 | 13.1 / 7.3 / 3.82 | 11.7 | 49 | 46 and 39 |
| LU | 3400 | 19.6 | 2.00 | 51.3 | 36.1 / 11.3 / 4.75 | 15.3 / 9.9 / 4.46 | 16.8 | 66 | 52 and 48 |

To bring case D back to the documented head the pump would have to run faster than its documented
range: 3600 rpm gives 46 L/min at 3.2 m and 6.1 m/s for 92 W; 7.0 m/s needs 4150 rpm, 53 L/min and
137 W.

Intermediate bores, state L at 3000 rpm: 3.0 mm gives 28.0 L/min, 3.07 m, 7.03 m/s; 3.6 mm gives
32.8 L/min, 2.72 m, 6.26 m/s; 4.0 mm gives 35.6 L/min, 2.49 m, 5.72 m/s.

### 5.3 Judgement against what is documented for the platform

Documented (dossier 2.7 and 3.3): the sister pump delivers 25 to 30 L/min at 3.1 m; BSH's patents
give 20 to 30 L/min, 200 to 400 mbar and 2000 to 3500 rpm as typical.

- **Case P fits without touching the pump.** One level at a time at 3000 rpm: 30.5 L/min at 2.9 m
  (lower), 28.4 L/min at 3.0 m (upper with roof). The upper end of the documented flow, the
  documented head, mid-range speed.
- **Case D does not fit.** At 3000 rpm the lower arm takes 38.4 L/min at 2.25 m, 30 to 50 % more
  flow than documented at 70 % of the head, and matching the head needs a speed above the
  documented range. A pump with a flatter curve could do it, but nothing documented describes one.

That is a second, independent reason to prefer the tape-scaled bore. It is not proof: the pump
curve is itself anchored on a sister platform.

### 5.4 Recommendation

Use now:

- **Pump curve unchanged**: H_0 = 4.0 m at N_0 = 3000 rpm, b = 1.19e-3 m per (L/min)^2, speed range
  2000 to 3500 rpm.
- **Nozzle tables of sections 2.5 and 3.4 with 3.3 mm bores** (C_d A 76.4 and 57.1 mm2), and the
  operating points of section 5.1.
- Keep case D (C_d A 126.4 mm2 on the lower arm, section 5.2) as a named alternative in the
  parameter registry so that it can be switched in the moment the owner confirms 4.5 mm.

**Jet speed.** The dossier's 7.04 m/s on the lower arm becomes **6.65 m/s** (case P, 5 % lower) or
**5.06 m/s** (case D, 28 % lower). On the upper arm 6.60 m/s becomes 5.77 m/s when it shares the
pump with the roof spinner and 6.22 m/s alone. Honest ranges at normal pump speed: lower arm 5 to 7
m/s, upper arm 5.5 to 6.5 m/s. Impact pressure goes with the square: case D halves it.

**What would pin it down.** Two things are unknown, the nozzle area and the pump's head, and no
single observation gives both.

1. The area: lay the drill bit that was used on the tape and photograph it, or read the size
   stamped on its shank, or try 3.0 and 3.5 mm bits in a vertical hole. Two minutes, and it decides
   between 6.65 and 5.06 m/s.
2. The head, once the area is known: a plug-in power log of one cycle. In the plateaus where only
   the circulation pump runs, v = (2 P_hyd / (rho C_d A))^(1/3) with P_hyd = 0.29 (P_el - 8 W); the
   model expects about 57 W at normal speed. The cube root makes this forgiving: a 30 % error in
   the assumed efficiency moves v by 9 %. The same log gives the heater and the phase durations.
3. The arm's rotation rate from a sound recording fixes the bearing friction (below). It bounds the
   jet speed only loosely: the frictionless speed is 11.6 rpm per m/s on the lower arm and 18.9 rpm
   per m/s on the upper arm, so a measured rate R gives v >= R / 11.6.

### 5.5 Arm rotation

With measured drive nozzles the torque balance no longer needs a tuned slot tilt, but it still
needs the friction, which is generic.

- Lower arm, state L at 3000 rpm, case P: drive 0.105 N m, static friction 0.040 N m, 42 rpm (34 at
  2400 rpm, 47 at 3400); stall margin 0.066 N m, 0.29 N at the tip. With the drive holes at 35 or
  55 degrees of elevation: 50 or 31 rpm. Case D: 55 rpm, and the model's friction nearly vanishes
  (axial load 1 N) because the pressure thrust on the hub and the downward jet reaction cancel,
  which is an artefact of the friction law, not a prediction.
- Upper arm, state UR at 3000 rpm: drive 0.098 N m against 0.053 in the dossier, and with the
  generic k_f = 3.8 mm the model gives 67 rpm. That is two to three times what such arms do, so the
  generic friction is too low for this arm: k_f = 10 mm gives 31 rpm (20 rpm at 2400 rpm), k_f = 12
  mm gives 20 rpm.

Recommendation until the owner records the arms: prescribe 40 +-10 rpm for the lower arm and 30
+-10 rpm for the upper arm, by keeping k_f = 9.3 mm on the lower arm and setting k_f = 10 mm on the
upper arm as a placeholder. Senses: lower clockwise, upper counter-clockwise, seen from above. The
stall margins (0.066 and 0.035 N m with those values) are as uncertain as the friction.

## 6. Other things the photographs establish

- **Lower arm length:** 457.6 mm by the tape in IMG_9086; published 460 mm stands.
- **Lower arm hub and stem:** stem 270 px wide at 9.4 px/mm in IMG_9109: 28.7 mm (dossier 27.5
  +-1.5). Visible stem between the sump cover and the blade about 36 mm, as the dossier. In IMG_9112
  the bore of the stem is 0.63 of its outer diameter at the end: about 18 mm (+-2), where the dossier
  assumed a 21 mm hub bore. The stem has a collar at its end and the six fins the dossier describes.
  The domed cap is about 35 mm across in IMG_9086. The top face carries no other openings.
- **Lower arm blade:** about 39 mm wide 50 mm from the axis, about 30 mm at the tip, S-shaped in
  plan as the dossier says. Thickness cannot be scaled from the edge-on views (IMG_9097, 9098),
  which have no reference; the vertical holes stand in rings about 6.7 to 7 mm across and 1 to 2 mm
  high, the hoods 4 to 5 mm high.
- **Upper arm:** hub centre at 23.51 cm of 453 mm along the tape, so the two wings are 224 and 229
  mm from the hub centre along the tape (the arm is bowed in plan and the difference is within
  that). Blade about 37 mm wide at mid-length, 21 to 25 mm at the tips, 49 mm across the hub. The
  socket in the top of the hub has an inner tube about 16.5 mm outside and 14 mm inside (IMG_9099,
  pixel (2355, 3195)); the dossier's 18 mm hub bore is on the high side. Underside (IMG_9108,
  9102): the four-lobed nut over a cross-ribbed inlet, the marking ">PP-TD20<", and the hole U8.
- **Roof:** IMG_9109 does not show it. The top edge of the frame is the underside of the top basket
  and the upper arm; the roof is above them, out of view. The photograph does show the rear wall
  with the feed-pipe riser and its docking block behind the upper arm's hub, the left-hand wall's
  round vent, and a tub floor in which the sump cover appears to lie a few millimetres proud of the
  fine filter plate where they meet (not measured). No photograph in either set shows the roof or the roof spinner.

## 7. Overlay on the dossier's parametric specification

Only the fields that change. Layout and units as the dossier's section 3.1; the tag follows each
value (M, C, P, E as defined in section 0; V = the dossier's verified value, kept).

```yaml
frame:
  tub: {z: [0, 640]}                                             # M +-5 (was 675)
racks:
  lower:
    pose: {floor_wire_z: 67, rail_z: 80}                         # M 15 +-5 above the lower arm's top face, which is E 50 +-8 (was 71, 84)
  upper:
    pose: {floor_z_by_level: {1: 420, 2: 395, 3: 370}}           # M +-7 at level 1 (roof 640 less 220); the 25 mm step is E (was 410, 385, 360)
arms:
  lower: {tip_radius: 230,                                       # V ; tape 457.6 overall, M
          top_face_z: 50, nozzle_z_up: 52, nozzle_z_down: 36,    # E, unchanged: not measured by the owner
          hub_d: 18, stem_od: 28.5,                              # P +-2 (IMG_9112) ; P +-1 (IMG_9109) (was 21, 27.5)
          sense: cw,                                             # C (IMG_9094, 9110, 9111) (was E)
          drive: "L7 and L8, hooded round holes at theta 90 rho 45; L10, tip slot at theta 90 rho 75",   # C ; angles P +-10 (new field, as arms.upper.drive)
          k_f: 0.0093, c_v: 0.002, thrust_sign: -1}              # G, unchanged
  upper: {tip_radius: 230,                                       # V ; hub centre 224 and 229 from the tips along the tape, M
          top_face_z: "UR_floor_z - 23", nozzle_z_up: "UR_floor_z - 21",   # E (was - 25, - 23)
          nozzle_z_down: "UR_floor_z - 34",                      # C: one underside hole, U8 (was null)
          blade_underside_z: "UR_floor_z - 34",                  # P +-7 (IMG_9109: 390; from the hub: 384) (was - 36)
          hub_underside_z: "UR_floor_z - 55",                    # M on E: 365 at level 1 (unchanged offset)
          hub_d: 15,                                             # P +-2 (IMG_9099) (was 18)
          sense: ccw,                                            # C (IMG_9100, 9104, 9106) (was E, no evidence)
          drive: "U6 and U7 tip outlets, U5 and U4 slots; angles in the nozzle table",   # C ; angles P +-10 to 15 (was a tuned 16 deg tilt)
          k_f: 0.010, c_v: 0.002, thrust_sign: +1}               # E placeholder: gives about 30 rpm (was 0.0038)
  roof:  {outlet_z: 625, rotor_lower_face_z: 610}                # E: roof less 15 and less 30 (was 660, 645)
  nozzles: tables below
hydraulics:
  pump: {N0_rpm: 3000, H0_m: 4.0, b_m_per_Lmin2: 1.19e-3}        # E, unchanged (section 5.4)
  branches:
    lower: {z: 0.11, CdA_mm2: 76.4}                              # P (3.3 mm bores) ; alternative M 126.4 (4.5 mm bores) (was 66.0)
    upper: {z: 0.43, CdA_mm2: 57.1}                              # P ; lift at level 2 unchanged (nozzles at 374 + 60) (was 41.0)
    roof:  {z: 0.69, CdA_mm2: 22.6}                              # E: outlet 625 + 60 (was 0.72; section 5 was solved with 0.72, a difference of 0.3 kPa) ; outlet bore still assumed
```

Operating points to quote with it (dossier pump curve, 3000 rpm): L 30.5 L/min, 22.1 kPa in the
arm, 6.65 m/s, 42 rpm; UR 19.8 + 8.6 L/min, 16.6 kPa, 5.77 m/s, about 30 rpm with the placeholder
friction; U 21.3 L/min, 19.3 kPa, 6.22 m/s; R unchanged; LU 25.3 + 15.4 L/min, 5.52 and 4.50 m/s.

Lower arm, replaces the dossier's table in section 3.2 (clockwise seen from above):

| ID | Half | R (mm) | theta (deg) | rho (deg) | Shape | Size (mm) | A (mm2) | C_d | Tags: R / shape / size / angles |
|---|---|---|---|---|---|---|---|---|---|
| L1 | + | 45 | 0 | 90 | round | 3.3 | 8.55 | 0.85 | P +-4 / C / P +-0.3 (alt. M 4.5) / C |
| L2 | - | 69 | 0 | 90 | round | 3.3 | 8.55 | 0.85 | M on the tape +-4 / C / P / C |
| L3 | + | 91 | 0 | 90 | round | 3.3 | 8.55 | 0.85 | P +-4 / C / P / C |
| L4 | + | 114 | 0 | 90 | round | 3.3 | 8.55 | 0.85 | P +-4 / C / P / C |
| L5 | + | 138 | 0 | 90 | round | 3.3 | 8.55 | 0.85 | P +-4 / C / P / C |
| L6 | - | 161 | 0 | 90 | round | 3.3 | 8.55 | 0.85 | M +-4 / C / P / C |
| L7 | + | 183 | 90 | 45 | round, hooded | 3.3 | 8.55 | 0.85 | P +-4 / C / E / C direction, P +-10 elevation |
| L8 | - | 207 | 90 | 45 | round, hooded | 3.3 | 8.55 | 0.85 | M +-4 / C / E / C, P +-10 |
| L9 | + | 225 | 0 | 75 | slot, long axis tangential | 5.0 x 1.8 | 8.30 | 0.78 | M +-3 / C / P +-0.7, +-0.4 / M direction, E +-10 |
| L10 | - | 225 | 90 | 75 | slot, long axis tangential | 5.0 x 1.8 | 8.30 | 0.78 | E (hidden by the tape) / C / P / M, E +-10 |
| L11 | + (blade not determined) | 207 | 180 | -70 | rect, underside | 3.0 x 2.2 | 6.60 | 0.80 | P +-5 / C / P +-0.7 / M, E +-15 |

Upper arm, replaces the dossier's table (counter-clockwise seen from above; + is the owner's wing A):

| ID | Half | R (mm) | theta (deg) | rho (deg) | Shape | Size (mm) | A (mm2) | C_d | Tags: R / shape / size / angles |
|---|---|---|---|---|---|---|---|---|---|
| U1 | + | 41 | 0 | 90 | round | 2.5 | 4.91 | 0.85 | M on the tape +-3 / C / P +-0.3 / M |
| U2 | - | 85 | 0 | 90 | rect, long axis radial | 4.8 x 2.2 | 10.56 | 0.78 | M +-3 / C / P +-0.4 / M |
| U3 | + | 130 | 0 | 90 | rect, long axis radial | 4.8 x 2.2 | 10.56 | 0.78 | M +-3 / C / P / C (upright boss) |
| U4 | + | 160 | 90 | 78 | rect, long axis radial | 4.8 x 2.2 | 10.56 | 0.78 | M +-3 / C / P / M direction, E +-8 |
| U5 | - | 193 | 70 | 70 | rect, long axis radial | 4.8 x 2.2 | 10.56 | 0.78 | M +-3 / C / P / M, E +-12 |
| U6 | + | 219 | 90 | 45 | rect mouth in the side of a wedge | 4.3 x 2.3 | 9.89 | 0.78 | M +-3 / C / P +-30 % / M ("maybe 45 degrees") +-15 |
| U7 | - | 223 | 60 | 50 | rect in a tilted boss | 4.3 x 2.3 | 9.89 | 0.78 | M +-3 / C / P +-30 % / M, E +-15 |
| U8 | + (blade not determined) | 38 | 0 | -90 | round, underside | 2.7 | 5.73 | 0.80 | P +-6 / C / P +-0.5 / E |

The roof spinner's table is unchanged except for its height.

Dossier text this overlay supersedes: section 2.2 rows for the lower-rack floor, the upper arm, the
upper-rack floor, the roof spinner and the roof; section 2.6 rows "Shapes", "Sizes", "Hood
directions", "Underside" and "Rotation sense" of the lower arm and "Sizes", "Tip outlets",
"Underside" and "Drive, rotation sense and speed" of the upper arm; section 3.2 tables and the
note on the upper arm's drive; sections 3.3 and 3.4 results; section 3.5 flows (27.9 and 25.2 L/min
become 30.5 and 28.4, which changes the water in flight by under 0.1 L). All heights the dossier
expresses relative to the lower-rack floor wires (tine tips, rims, cutlery basket) move down 4 mm
with them.

## 8. Still unknown, and what to observe next

Still unknown:

1. The bore of the lower arm's round holes: 3.3 mm on the photograph, 4.5 mm by the drill test.
2. The height of the lower arm's top face above the filter plate (50 mm kept; 75 mm if his 30 cm
   was taken to a blade of the upper arm rather than to its hub).
3. Where the lower arm's axis lies along the arm, to better than +-4 mm; which blade carries the
   underside outlet L11; which wing the upper arm's underside hole U8 is under.
4. Every elevation angle: all are from words and from a loose probe, +-10 to 15 degrees.
5. The size of the angled holes and of the tip slot hidden under the tape; the slot sizes of the
   upper arm were scaled, not gauged.
6. Both arm speeds and the bearing friction; the pump's curve, speed and power.
7. The roof and the roof spinner: outlet bore, position, spray. Nothing in either photo set shows
   them.
8. The two lower settings of the top basket (the 25 mm step is inferred), and the feed pipe's
   vertical position, which no longer fits a 640 mm tub with the dossier's port heights.
9. The water switch's positions and timing, unchanged from the dossier.

The three observations that would matter most:

1. **The drill bit on the tape** (or 3.0 and 3.5 mm bits tried in a hole), in one photograph. It
   decides the jet speed between 6.65 and 5.06 m/s and whether the pump curve can stay.
2. **A power log of one Eco 50 cycle with a sound recording through the door.** The pump-only
   plateaus give the hydraulic power and so the jet speed; the recording gives both arm speeds, and
   the alternation between them gives the water switch's sequence and dwell times.
3. **One tape reading from the filter plate to the top face of the lower arm**, and a note of which
   surface the 30 cm was taken to. It fixes the lower basket and everything hanging from the stack
   between the two arms.
