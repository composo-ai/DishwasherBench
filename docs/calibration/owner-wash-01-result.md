# Owner wash 01: the result against the prediction

> **Record of the build, kept as written (11 October 2026).** The roles it names are explained in
> `docs/README.md`.

Written on 11 October 2026, after the owner reported. The prediction it is compared with,
`owner-wash-01-prediction.md`, was committed at 22:50 on 10 October, before the wash finished, and no
number in it has been edited since. That commit is in the private development history, which is not
published (see the note at the head of the prediction). The owner's set-up, result and photographs
are in `docs/reference/calibration_runs/2026-10-10_egg_plates/`.

## What was run

Eco 50, one Finish Powerball Ultimate capsule, the owner's evening load, four plates with fork-spread
raw egg yolk in the rear rows of the lower basket:

| Plate (photo before / after) | Drying | Position and facing |
|---|---|---|
| 9121 / 9127 | oven, 2 h at 80 C | far left, eating face turned to the left wall |
| 9122 / 9128 | oven, 2 h at 80 C | left of the middle, facing the middle |
| 9123 / 9129 | air, 2 h | right of the middle, facing the middle |
| 9124 / 9130 (smaller plate) | air, 2 h | far right, eating face turned to the right wall |

The owner's README first said the second pair was "air fried for 2 hours"; he confirmed on 11 October
that they were air-dried on the counter and the README is corrected. The display time at the start and
the clock times of start and finish were not noted.

## What the owner found

> Both air dried plates are clean (9129 is RH middle and 9130 is RH)
> Both oven dried plates are mostly clean but with some egg residue. The outward facing plate (LHS)
> fares slightly worse (9127 is LHS and 9128 is LH middle)

## Reading of the photographs

A rough measurement by the lead, not the owner's: pixels inside the well that are yellower than their
surroundings (yellowness (R+G)/2 - B against a 61-pixel median background, at three thresholds), scaled
by the well's diameter (taken as 165 mm for the large plates and 125 mm for the small one). The two
clean plates give the noise floor of the method, about 5 mm2.

| Plate | What is visible | Yellow area at thresholds 6 / 9 / 12 (mm2) | Estimate | IEC score that would follow |
|---|---|---|---|---|
| 9121 (oven, turned) | an arc of six or so small patches along the upper right edge of the well, one speck at the left edge | 150 / 103 / 63 | about 100 mm2 (50 to 200) | 1 |
| 9122 (oven, facing in) | four or five specks of a few millimetres at the edge of the well, one on the rim | 51 / 28 / 18 | about 25 mm2 (10 to 60) | 2 (possibly 1 or 3) |
| 9123 (air, facing in) | nothing | 25 / 5 / 2 | 0 (under 5) | 5 |
| 9124 (air, turned, small) | nothing | 11 / 5 / 2 | 0 (under 5) | 5 |

## Prediction against result

The pre-registered headline (anchored-v4 with the owner's capsule, continuous soak, 3 g of yolk per
plate, his load around the plates):

| Plate | Predicted | Observed | Verdict on the prediction |
|---|---|---|---|
| 9123 (air, facing in) | spotless, score 5 | spotless | held |
| 9122 (oven, facing in) | clean, 2 specks, 0.9 mm2, score 4 | four or five specks, about 25 mm2 | right in kind and place, too optimistic in amount; the clean verdict failed |
| 9121 (oven, turned) | on the edge of clean: 13 to 14 specks, 11 mm2, outer part of the well, score 2 | an arc of patches at the edge of the well, about 100 mm2 | right in kind and place, too optimistic in amount; not clean, as predicted with the load in |
| 9124 (air, turned, small) | dirty only if it carried 3 g; spotless with a film as thin as the others | spotless | consistent with the thin-film branch; the amount on it was not weighed |

What held:
- The order, which the prediction called its one sure statement: 9123 cleanest, then 9122, then 9121.
- Both air-dried plates clean.
- The form of what is left: specks and small patches at the outer part of the well, more than 99 % of
  the yolk gone everywhere, never an even film.
- The turned oven-dried plate worse than its partner facing the middle.

What did not:
- The oven-dried plates carry roughly ten to thirty times the predicted residue area. Of the
  contradictions listed in advance, this is the first, in a mild form: "9122 with a film or patches over
  a visible part of the well ... If 9123 is clean at the same time it is the oven penalty, which slows
  2-hour yolk by only 16 % in the model." 9123 is clean, so the first suspect is the penalty the model
  gives to two hours at 80 C, and after it the spread of a fork-spread layer (thick ridges).

What the result says about choices made after the prediction:
- The parameter set that became the default during the night (anchored-v5, with the long soak spraying
  half the time) reads all four plates as not clean. Two are spotless. A soak duty of 0.5 with the other
  parameters as fitted is therefore contradicted by this wash; the regime of the prediction (soak
  circulated throughout, or the equivalent in rate) is close to right for air-dried yolk.
- Facing: the turned oven-dried plate has about four times the residue area of the one facing the
  middle. That is the sign the model has (a face turned to the wall gets less fresh liquor), and a real
  effect for a chemistry-limited soil, which the published tile work alone could not establish.

What it cannot tell:
- Rate, enzyme level and soak duty apart from one another: all three move the four plates together.
- Whether the small plate would have been dirty with more yolk on it.
- Anything about Auto.

The calibration that follows from this wash is recorded separately.
