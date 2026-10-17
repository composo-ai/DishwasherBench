# Owner wash 02: four stacked plates

Written on 16 October 2026, after the owner reported. The machine's owner ran the wash before
the morning of 15 October, when the photograph was taken; the night of 14 to 15 October is
taken. Nothing was registered for it beforehand: there is no planned record and no prediction
frozen before the wash. The prediction below was made after the result was known and is
labelled so. The owner's note and photograph are in
`docs/reference/calibration_runs/2026-10-14_stacked_plates/`. The record is
`packages/calibration/records/owner/owner-wash-02-stacked-plates-eco50.measured.json`, written by
`packages/calibration/scripts/make-owner-wash-02-measured.ts`.

> **Fitted on 17 October 2026** together with wash 01: `anchoring-v8.md`. "The current set" and
> "the current model" below are `anchored-v7`, the set of 16 October; the last section says what
> the new set gives.

## What was run

Four dinner plates of the wide-rimmed lettered earthenware of wash 01, each with egg yolk
air-dried for 2 hours, in the lower basket:

| Plate (record id) | Where it stood | Facing |
|---|---|---|
| `plate_single` | left middle and front rows, the fourth gap from the left wall: "one plate a slot behind" | eating face to the middle |
| `plate_pair_covered` | the fifth gap, nearer the left wall: the first of "two plates in the same slot" | eating face to the middle, under the back of the other |
| `plate_pair_open` | the same gap, nearer the middle | eating face to the middle, open |
| `plate_flat` | lying on the tips of the two rear rows, right of the middle: "facing up" | eating face up |

Where the plates stood and which way they faced is read from the photograph (below). The owner
said nothing about the facing.

The yolk: "each plate had half a teaspoon", in the owner's words when asked afterwards. Half a
teaspoon is about 2.5 mL, about 2.5 g of yolk. It was measured with the spoon and not weighed;
how full the spoon was is not known.

The programme and the detergent, asked afterwards: "yep eco50 and finish powerball ultimate". So Eco 50 and a
Finish Powerball Ultimate capsule.

Taken, not stated by the owner:

- The machine: the owner's Bosch SMV4HAX40G of wash 01.
- No programme options, and one capsule in the dispenser at wash 01's 12.9 g.
- The date: 14 October, the day before the photograph, which was taken on the morning of the
  15th.
- The yolk: raw yolk with no white, over about two thirds of the well, as on wash 01. How it
  was spread was not said. "Air dried for 2 hours" is taken as 2 hours from the yolk going on
  to the start of the wash.
- The rest of the load: the lower basket held the four plates and nothing else, and no cutlery
  basket (photograph). The upper basket is not in the photograph and is taken as empty.

The display time and the clock times of the run were not reported.

## What the owner found

> I tested two plates in the same slot, one plate a slot behind, and one plate facing up. Egg
> yolk air dried for 2 hours. Unbelievably every one came out clean. The one facing up had dirty
> water on it, but once lightly rinsed there was no egg. I presume there must have been a small
> gap between the two plates in the same slot, enough for water to drop/channel through - they
> can't have been completely pressed together. Crazy result, but that's why we do these! I
> didn't take before/after plate pictures, but I did take a picture of how they were stacked.

## The photograph

`IMG_9141.JPG` shows the lower basket from above, from over its front left corner. It was
taken after the wash: there is no yolk on the flat plate, and drops of water lie on the door.
The plates are taken to stand in it as they stood during the wash, the owner's "a picture of
how they were stacked". It was read with a pinhole camera fitted to ten points of the basket
model (the ends of the handle and the crossings of four tine rails with two floor wires in the
left half; 8 px rms). The model basket drawn through that camera lies on the real one. The
outline of the catalogue plate was then drawn at the poses the game gives and compared with
the plates.

- **The standing plates** are in the left half, across the middle and front rows on the left
  (ML and FL), not in the rear rows. Two stand close together; the third is about 30 mm nearer
  the left wall. With the plate a slot behind in the fourth gap from the left wall and the pair
  in the fifth, the stand-ins' rims fall on the plates' rims to about 5 mm. One gap either way
  is about 25 mm off.
- **The facing.** On the plate a slot behind and on the first plate of the pair, the back of
  the well (the base and foot ring, about 19 cm across) shows beyond the rim on the side of the
  left wall. Beyond the second plate of the pair, on the side of the middle, the floor of the
  basket shows. A plate bulges on the side of its back, so all three have their backs to the
  left wall and their eating faces to the middle. The pair is then as wash 3 of `protocol.md`
  asks: the eating face of one against the back of the other. The black lettering on the rims
  could not be used: at that angle the glaze reflects the tines and the tub.
- **The flat plate** lies on the tips of the two rear rows, right of the middle, eating face up.
  It measures about 27 cm.
- **Where the stand-ins differ.** The real plates lean back further: the plate a slot behind
  about 15 degrees from upright, its stand-in 7. That plate also stands about 10 mm further back
  than its stand-in. The rims of the pair are about 13 mm apart at mid-height; those of the
  stand-ins, set about 3 mm apart (below), are 9.7 mm apart.
- **Also seen, not used.** With the cutlery basket out, the middle and front rows on the left
  carry tines on towards the middle of the basket, beyond the last tine the machine data has
  there. Nothing in the reconstruction depends on it.

Nothing in the picture identifies a person or locates the home. The metadata was removed but for
the orientation and the colour profile.

## The load in the game

Three of the plates were placed in the game, with the cutlery basket taken out, and settled by
the loading physics (the requests are in the script). The first plate of the pair was let go
above the fifth gap and came down into it; the plate a slot behind went into the fourth. The
flat plate was let down onto the rear rows as far back as the upper basket allows, about 5 mm
short of where the photograph has it.

The game refuses a second plate in an occupied gap, so the second plate of the pair is set by
hand, as the phenomena suite sets its pairs (P03). It is the first plate moved 9.65 mm along that
plate's axis, towards its eating face. The covered plate's rim then lies 3.4 mm from the back of
the other, the flat of its well 4.6 mm, and the foot ring of the other comes nearest at 3.2 mm.
The owner presumes "a small gap"; how small is not known, and about 3 mm is taken. No plate
cuts into another. The hand-set plate cuts about 2.7 mm into a plastic fitting of the lower
basket (the phenomena suite's clearance check, `machineGap`); no pose within 8 mm along the
row or across it is clear, and the prediction below was made with it so.

## What the current model says, predicted after the result

`spotless-fit predict` on the record, official tier, `anchored-v7.owner-capsule` with the
capsule's 12.9 g (`packages/calibration/anchors/reports/v7/owner-wash-02.predict.txt`). This is
a prediction made after the result, not a test of one made before.

The record carries three scenarios of the amount, all plates together: 2.5 g (weight 2/3),
1.2 g and 5.2 g (1/6 each). The 2.5 g column is the record as written; the flat plate's reading
is not fitted and the tool gives no scenarios for it.

| Plate | Observed | Model at 2.5 g | Model at 1.2 g | Model at 5.2 g | P(clean), amounts integrated |
|---|---|---|---|---|---|
| `plate_single` | clean | clean, nothing visible (score 5) | clean | not clean: 146 mm2, 129 specks | 0.82 |
| `plate_pair_covered` | clean | clean, nothing visible (score 5) | clean | not clean: 174 mm2, 132 specks | 0.82 |
| `plate_pair_open` | clean | clean, nothing visible (score 5) | clean | not clean: 94 mm2, 90 specks | 0.82 |
| `plate_flat` | dirty water on it; no egg after a light rinse (not fitted) | no yolk left (score 5), not clean: water stands on it | - | - | - |

The log likelihood of the record at the current set is -0.61, from the three standing plates,
nearly all of it from the heaped-spoon scenario.

## What the wash says

- **Two plates in one slot came out clean, the covered one too.** It is the first reading on
  the real machine of a face lying close against the back of another plate. The model agrees at
  the amount taken: the covered plate keeps more yolk than its partner, but far below anything
  visible.
- **The flat plate held dirty water, and after a light rinse no egg was left.** The model has
  water standing on the plate at the end and no yolk left. The rinse means the real plate's
  yolk is known only after it.
- **The amount decides the model's verdict more than the stacking.** At a heaped half
  teaspoon the model leaves every standing plate not clean, the covered one the most (174 mm2
  against 146 for the plate alone and 94 for the open one). If the spoon was heaped, the model
  is too pessimistic for a thick layer of air-dried yolk; if it was level, the model is right.
  The wash cannot say which.
- **Wash 01 points the same way.** Its small air-dried plate, turned to the wall, came out clean
  where the current set leaves 13 mm2 with 2.1 g on it (`anchoring-v7.md` section 3). On
  air-dried yolk the model has so far been right or too pessimistic, never too optimistic.

## What it cannot tell

- **No photographs of the plates before or after.** The one photograph shows the basket after
  the wash, not the faces of the standing plates. The verdicts are the owner's by eye: there is
  no area, no count of specks and no picture of what went in.
- **The yolk was measured by the spoon, not weighed.** A level half teaspoon (2.5 g) and a
  heaped one (taken as about 5 g) give opposite verdicts in the model.
- **The gap in the slot is not known.** The model's pair is set about 3 mm apart by hand; the
  photograph has their rims further apart than the stand-ins' (about 13 mm against 9.7 at
  mid-height).
- **One wash**, with air-dried yolk only. Whether a covered face keeps oven-dried yolk, which
  wash 01 showed to be the harder soil, is not tested.
- **The flat plate was judged for egg only after a light rinse.** Yolk the wash loosened and
  left would have gone with the rinse, and how much water stood on it was not measured. Its
  reading is in the record and is not fitted.

## What follows

The record was fitted together with wash 01 on 17 October 2026: `anchoring-v8.md`
([issue 65](https://github.com/composo-ai/DishwasherBench/issues/65)). On the set of that note,
`anchored-v8.owner-capsule`, the three standing plates are clean at 2.5 g as before, and at a
heaped half teaspoon (5.2 g) they keep 28, 34 and 13 mm2 where this note's set kept 146, 174
and 94 (`packages/calibration/anchors/reports/v8/owner-wash-02.predict.txt`).
