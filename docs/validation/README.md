# What the simulation has been checked against, and how it did

Written at the close of the build, on 12 October 2026, for anyone
who wants to know how far to trust a verdict, and for an engineer new to the repository. It
collects the checks made so far, says plainly what a clean or not-clean verdict can be trusted
for today, and says where it falls short. What is out of scope is in
`docs/design/scope.md`. The open problems it names are tracked as issues that a
contributor could pick up; `docs/ROADMAP.md` is the map of them.

The reviewers and engineers named below are roles in the build (see `docs/README.md`).

**Which state the numbers describe.** The simulation as it is in this checkout:
`spotless-sim 0.5.0 water-7`, parameter set `anchored-v7.owner-capsule` (the owner's capsule,
12.9 g; the long soak of Eco 50 spraying 0.8 of the time), on the machine with its upper basket
corrected from the owner's photograph and the loads settled again on it. Late on 11 October one
more thing went into the wash: what the wash water held is left as residue where water stands on
an item at the end. Numbers measured before that change say so; it moves only items that hold
water (a glass or mug mouth up or on its side), not a careful load.

## 1. The short version

- **One test wash on the owner's machine.** Four egg-yolk plates on Eco 50. The prediction written
  before the result got the order of the plates and the form of the residue right and was ten to
  thirty times too optimistic on the amount left on the two oven-dried plates. The parameter set
  that was the game's default that night was rejected by the wash. The calibration moved one
  number, the share of the long soak during which the pump runs, from 0.5 to 0.8. A second test
  wash (four stacked plates, 14 October) is recorded and not yet fitted; what the set says for
  it, predicted after the result, is in `docs/calibration/owner-wash-02-result.md`.
- **Published class means of a sister machine** (Bosch SMV6ECX51E, Eco, reference detergent D):
  cutlery within 0.1, crockery 0.2 low, glass 0.1 to 0.5 low. This is a fit, not a prediction:
  the soil and chemistry defaults were anchored to these numbers.
- **46 loading phenomena** with evidence in the literature, 9 of them out of scope. Of the 37
  within scope 17 pass, 19 fail in size or sign and 1 is a faulty scenario.
- **Water is conserved exactly**; the same input gives the same result; the fast tier agrees
  with the official on 89 % of verdicts of the standard load and 97 % on the levels; a cold
  official wash of the largest level costs 4.9 minutes of the 30 (best of three), and 5 to 8.5
  minutes with another job beside it.
- **A verdict can be trusted for a hollow piece put in the wrong way up, for a blocked detergent
  tray on protein soils, and for a bowl or spoon that truly lies in another.** It cannot be
  trusted to show that plates and cutlery were stacked badly: two reviewers loaded plates
  fallen over, a stalled arm and crowded cutlery, and nearly everything came out clean. Nor for
  items near the threshold of clean, for tea, coffee and wine, for milk on glass, for fat, or
  for the many soils no wash has tested.
- **What a score means today**: "packed well and made no gross mistake with a hollow piece".
  Not yet "stacked so that it washes clean".

## 2. The owner's test wash

Sources: `docs/calibration/owner-wash-01-prediction.md` (written before the result; no number
in it edited since), `owner-wash-01-result.md`, `owner-wash-01-calibration.md`, `anchoring-v7.md`
section 3; his photographs are in `docs/reference/calibration_runs/2026-10-10_egg_plates/`.

**The wash.** Eco 50, one Finish Powerball Ultimate capsule, his evening load, four plates with
fork-spread raw egg yolk in the rear rows of the lower basket: two oven-dried for 2 hours at 80 C,
two air-dried for 2 hours; one of each kind facing the middle, one turned to the side wall. The
yolk was not weighed (about 3 g was asked for), and the clock times were not noted.

**The prediction** was committed at 22:50 on 10 October, before the owner looked at the plates.
That commit is in the private development history, which is not published, so the order cannot
be checked from this repository. It was made with the set of that evening
(`anchored-v4.owner-capsule`), in which the soak circulates throughout.

| Plate | Predicted | Seen (verdict by the owner by eye; area estimated from his photograph by counting yellower pixels) | |
|---|---|---|---|
| 9123, air-dried, facing the middle | spotless, score 5 | spotless | held |
| 9122, oven-dried, facing the middle | clean: 2 specks, 0.9 mm2, score 4 | not clean: four or five specks, about 25 mm2 (10 to 60) | right in kind and place; the clean verdict failed |
| 9121, oven-dried, turned to the wall | on the edge: 13 to 14 specks, 11 mm2, score 2, not clean | not clean: an arc of patches, about 100 mm2 (50 to 200) | right in kind and place, a tenth of the area |
| 9124, small, air-dried, turned | not clean with 3 g; spotless with a film as thin as the others | spotless; amount unknown | not tested |

What held:

- The order, which the prediction called its one sure statement: 9123 cleanest, then 9122, then
  9121.
- Both air-dried plates clean.
- The form of the residue: specks and small patches at the outer part of the well, more than 99 %
  of the yolk gone everywhere, never an even film.
- The turned oven-dried plate worse than its partner (about four times the area).
- Its own warning: that each of its five most influential parameters, at the ends of its range,
  turns all four plates clean or all four dirty, and so does halving or doubling the yolk.

What did not:

- The oven-dried plates kept ten to thirty times the predicted area.
- The set that had become the game's default during the night (`anchored-v5`, soak spraying half
  the time) reads all four plates as not clean. Two were spotless.

**What the calibration moved.**

| Parameter | Before | After | Moved by | How well it is known |
|---|---|---|---|---|
| `prog.soakDuty` (share of the long soak with the pump on) | 0.5 | 0.8 | the owner's wash, with the label's energy holding it below 1 | 95 % interval 0.59 to 1. One combination only: it cannot be told from the capsule's enzyme level, the reaction rate or the oven penalty, and it depends on the amount of yolk assumed (0.7 to 0.8 with a fifth less on every plate, 1 with a quarter more). On the corrected machine a five-point grid has its best at 0.9, by a margin the wash cannot see; 0.8 was kept |
| `soil.bleachRate` | 0.0009 | 0.001 in the morning, 0.0009 again in the evening | the refit of the published crockery mean, twice: at the new duty, then on the corrected upper basket, where the mugs of the standard load lean on a rest and get 2.5 to 27 times the water. Not the owner's wash | bounded from below only. Tea items of the standard load score 1.15 at 0.0009 and 2.75 at 0.001; the published mean asks for about 2.2 and cannot tell the two apart |
| Protease level of reference detergent D | 0.02 | 0.016 | the refit of the published cutlery and glass means | flat between 0.016 and 0.02 |
| Oven penalty, cost of turning a plate, unevenness of a spread layer | | not moved | | not identified by this wash |

The measured record has a log likelihood of -10.18 under the rejected default, -5.79 under the
set calibrated that morning and -5.55 under the regime of the prediction. So the wash rejects a
soak that sprays half the time; it does not tell 0.8 from continuous circulation. The label's
energy decides between those two, weakly.

**The four plates under the current set** (3 g on every large plate, 2.1 g on the small one;
`spotless-fit predict` on the final code, 12 October):

| Plate | Seen | Model, `anchored-v7.owner-capsule` |
|---|---|---|
| 9121, oven-dried, turned | about 100 mm2 (50 to 200), not clean | 59 mm2, 64 specks, score 1, not clean |
| 9122, oven-dried, facing | about 25 mm2 (10 to 60), not clean | 10.7 mm2, 9 specks, score 3, not clean; at the low edge of the range |
| 9123, air-dried, facing | nothing, clean | 0.2 mm2, 1 speck, score 4, clean |
| 9124, small, air-dried, turned | nothing, clean | 13 mm2, 13 specks, score 2, not clean |

Log likelihood of the measured record: -5.94. On the morning's set and the old upper basket
plate 9121 read 101 mm2; why it moved was not traced (the upper basket above it is lower along
the walls than it was drawn). It is inside its observed range either way.

Still wrong after calibration: the model leaves many specks of about 1 mm2 where the photographs
show seven patches of some 15 mm2 at the edge of the well, where the yolk had pooled. The area is
fitted; the form is not. And the small air-dried plate reads not clean where he saw it spotless,
unless it carried 1.6 g or less; its amount is unknown.

**How much this is worth.** It is one wash of four plates, judged from photographs, with the yolk
not weighed. It fixes one number to within a factor that still spans "sprays most of the time" to
"sprays all the time". It says nothing about tea, milk, starch, fat, the upper basket, cutlery
or hollow pieces.

## 3. Published class means of a sister machine

The record: a round robin on a Bosch SMV6ECX51E (a different model), eco programme, standard
13-place load, reference detergent D (`docs/research/standards.md` section 7.1). The simulation
washes the same standard load, loaded by the careful scripted player, on Eco 50 with detergent D;
official tier, four washes (`docs/calibration/anchoring-v7.md` section 4; washed before the
residue of standing water was added, which the careful load, holding 0.4 mL, does not feel).

| | Crockery | Cutlery | Glass | All | Items clean |
|---|---|---|---|---|---|
| Published | 3.68 | 4.67 | 3.43 | 4.17 | about 70 % (an estimate) |
| Simulation, `anchored-v7` | 3.43 to 3.49 | 4.58 to 4.70 | 2.97 to 3.29 | 4.10 to 4.12 | 91 or 92 of 114 (80 %) |

Read this as a fit. The reaction rate of egg yolk, the bleach rate and the enzyme level of
detergent D were set so that these means come out. Crockery is 0.2 low because no tea item comes
clean at a bleach rate of 0.0009 (at 0.001 half do and crockery is 0.36 high). Glass is low
because milk glasses along the left wall of the upper basket stay dirty (2 to 4 of 8 clean). The
published record gives class means only, so it cannot say which items the simulation gets wrong.
The model's load holds 114 of the rated 140 pieces, so it is also not the same load.

## 4. The in-machine bench rates

Six published removal rates of egg yolk from tiles inside a running machine against the
simulation's bench tile (% of the tile per minute, simulated / published;
`packages/calibration/anchors/scripts/check.ts`, run on 12 October): 0.84 / 0.85, 1.79 / 1.75,
0.17 / 0.17, 2.47 / 2.59, 0.68 / 0.69, 4.77 / 4.66. All within tolerance. Again a fit: the
reference rate of egg yolk was set on these six and on nothing else. They show that one rate
reproduces all six conditions, on a tile that is not heat-aged.

## 5. The loading phenomena

`docs/research/standards.md` section 9 lists 48 statements about how loading affects cleaning,
each with its evidence and an expected size. The suite holds 46 of them: P27 and P32 compared
programmes and were removed, and nine turn on mechanisms that are out of scope
(`docs/design/scope.md`) and are reported as out of scope. Each is an executable pair of washes
(`packages/sim-verify/src/phenomena/`). A verdict is that of the deciding check; "accepted" is the
checklist's range with a tolerance of a factor of two or one score point.

The table is the whole suite at the **fast tier** with the owner's capsule on Eco 50 (46
phenomena, 76 washes), run again on 14 October after P27 and P32 were removed; no verdict or
number of the 46 changed from the run on the final code of 12 October
(`packages/sim-verify/phenomena/reports/phenomena-fast-anchored-v7.owner-capsule.md`):
**of the 37 within scope, 17 pass, 15 are too small, 2 too large, 2 of the wrong sign and 1 is
an error; 9 are out of scope.** At the official tier only P03, P15 and P25 were washed on this
set (before the residue of standing water; `packages/calibration/anchors/reports/v7/phenomena/`);
where it differs the table says so.

"At fault" is a reading, not a measurement: it starts from the attribution the anchoring engineer
made for an earlier set (`docs/calibration/anchoring-v5.md` section 7) and is brought up to date
from the diagnostics of the runs since. **Water** is where the water goes; **soil** is the removal
laws, the chemistry and the inspection thresholds; **scenario** is the test as built for this
machine; **expectation** is the checklist's figure.

| | Phenomenon | Verdict | Measured against expected | At fault |
|---|---|---|---|---|
| P01 | Hollow item open side up holds water | pass | a mug holds 279 mL (125 to 600) | |
| P02 | Soiled face turned away from the spray | too large | direct-jet time falls to 0.38 of the facing plate's, expected under 0.1; the score does not change (2 against 2; the turned face keeps twice the residue) | water and scenario: the pair is two set poses of an upright plate in a wide gap, and the jets still reach part of the face turned away. Soil: both residues are far below a score step. The owner's turned plate kept about four times its partner's area |
| P03 | Plate pitch halved | pass | upper half of the covered plate 5 to 3 (5 to 2 at the official tier, where the plate is not clean; at the fast tier it is) | the row is set by hand with the tines folded down: two plates will not stand at half the pitch between the tines of this basket |
| P04 | Bowl nested in another | too small | the covered bowl scores 0, as expected; 18 % of its porridge is left, expected at least 50 % | expectation: the verdict is right, the checklist's amount is an estimate |
| P05 | Large flat item shadows what is behind it | error | -0.5 | scenario: the set pose cuts 2 mm into a plate. There is no clear place for a 32 cm platter inboard of the plates |
| P06 | Spray arm held by an item | pass | jet coverage of the plates 0.41 to 0; plates 4.71 to 4.00 | passes on coverage; the score moves little (section 8) |
| P07 | Corner against mid-radius | too small | 3 against 3, expected -0.5 to -1 | soil: the water differs and the egg yolk does not answer to it |
| P08 | Left against right | pass | 3 against 5, limit 2 | |
| P09 | Plate leaning away | too small | 2 against 2, expected about -0.5 | soil: jet time falls, the score does not move |
| P10 | Tall narrow vessel | too small | glass and bowl both come clean of milk; the glass was expected to keep more | expectation, as built: both residues are zero on Eco 50 |
| P11 | Upper against lower basket | pass | 3 against 2, limit 1 | |
| P12 | Alternating large and small plates | too small | 5 against 5, expected +0.3 to +0.5 | soil: nothing to gain, both clean |
| P13 | Glass over a tine | too small | jet time inside -4 %, floor -5 % | water, resolution: a miss by a hair at the fast tier |
| P14 | Soiled face against the tub wall | too small | 5 against 5, expected -1 to -2; jets fall to zero and renewal from 33 to 2 a second | soil, with the soak: at a duty of 0.8 the face cleans on old water alone. It read 2 against 1 at a duty of 0.5. Not known which is right |
| P15 | Spoon lying in another | pass | the shielded spoon scores 0, its partner 5 | passes on a pose set by hand (10 cm2 of the hollow within 1 mm). The spoons the loading physics lays into each other do not lie that close and come out clean |
| P16 | Heads up against heads down | pass | 2 against 2 | |
| P17 | Crowded cutlery cells | too small | spoons not scoring 5 rise by 4 points of 100 from one to four per cell, expected 15 or more | water in narrow gaps (section 9) |
| P18 | Spoons lying flat hold water | pass | 2 mL | |
| P19 | Loading beyond rated capacity | pass | load mean 4.27 to 3.91 | the loader refuses what does not hold, so this compares half a load with a full one, not a full one with an overfull one |
| P20 | Total soil load | too small | no change, expected a clear drop when everything is soiled | soil: the soil in the liquor does not use up enough of the chemistry to matter |
| P21 | Redeposition of particles | out of scope | | |
| P22 | Clean neighbours of soiled items | pass | 0 | passes because nothing is carried to an open face |
| P23 | End-of-cycle drips | out of scope | | |
| P24 | Arrangement does not matter for easy soils | pass | range 0.07, limit 0.2 | |
| P25 | Detergent tray blocked | too large | the score falls as it should (three pieces 3.67 to 0); but 27 % of the yolk and 40 % of the tea still go without detergent, limit 20 % | soil: too much removal in water alone |
| P26 | Tablet in a dead spot | out of scope | | |
| P28 | Bleachable stains do not depend on position | pass | 0, limit 1 | |
| P29 | Ageing of the soil | pass | | |
| P30 | Protein answers to chemistry, not jet strength | pass | | |
| P31 | Starch comes out clean or keeps a sheet | too small | every plate comes clean; none keeps a sheet | soil: the starch law has no second mode |
| P33 | Fat needs temperature | too small | margarine leaves completely at 35 C as at 55 C | soil: the melt law |
| P34 | Thick layers flake off | out of scope | | |
| P35 | Pot on its side | too small | no difference from mouth down | water (the attribution of an earlier set; not looked at again) |
| P36 | Water pools in the recess of an inverted mug | pass | 5.0 mL against 6.2 | |
| P37 | Tilt drains the recess | too small | 0.022 of the level volume left at 15 degrees, accepted from 0.023 | water: a miss by a hair |
| P38, P39, P42 | Plastic and pots stay wet; cutlery dries | out of scope | | |
| P40 | Liquid held at contact points | wrong sign | two glasses touching hold 2.3 g, apart 2.6 g | scenario on the corrected basket: the glasses lean on the rest now, and touching they hold a little less than apart |
| P41 | Light plastic moved by jets | out of scope | | |
| P43 | Spots and film on glass | out of scope | | |
| P44 | Cutlery comes out clean | too small | cutlery mean 3.55 with the loader's own soils, 1.05 under 4.6; the band ends at 1 under | the loader's soils on the new load; with the record's soils the class mean is 4.58 to 4.70 (section 3) |
| P45 | Class ranking of the standard test | wrong sign | cutlery 0.59 below crockery, expected above | the same: with the loader's soils crockery rose to 4.15 (the mugs on the rest) and cutlery fell to 3.55 |
| P46 | Run-to-run repeatability | too small | spread of the load mean over three seeds 0.034, real machines 0.08 to 0.10 | expectation: the model repeats better than a machine, which has variation the seeds do not carry |
| P47 | Everything wetted, jets rare | pass | largest item-mean jet time 2 % | |
| P48 | Detergent does not move the water | pass | holds by construction | |

What the pattern says:

- **The water side sees almost every arrangement.** Jet time, dwell, coverage and renewal change
  in the right direction in every pair where they are measured.
- **Egg yolk on an open face does not answer to them at a duty of 0.8.** It is removed by
  chemistry under a wet film, and nearly every face is wet. So position, lean and facing change
  the residue by a factor of two and the verdict not at all (P02, P07, P09, P12, P14). The
  checklist's score changes for these are estimates. The owner's own wash shows a factor of four
  for a turned plate. Which is right is open.
- **Narrow gaps are all or nothing, and the "all" needs a pose set by hand.** A bowl in a bowl
  fails; a spoon set exactly into another fails; cutlery as the loading physics leaves it does
  not fail at all.
- **Passing is not the same as deciding a verdict.** P06 passes on jet coverage while the plates
  above the held arm lose 0.7 of a score point; in the reviewers' loads a stalled arm spared the
  plates above it.

## 6. Conservation, repeatability, tiers

**Conservation.** Water is counted in whole units from the nozzles through jets, droplets and film
to the sump, and the count closes exactly in every spray state. Unit tests hold it
(`packages/sim-film/src/exposure.test.ts`, `cascade.test.ts`,
`packages/sim-verify/src/wash-end-to-end.test.ts`; in the root test run of 12 October): what
leaves the nozzles is 95 to 101 % of the pump's flow, and 95 to 102 % of it is back in the sump
within one revolution. Detergent dosed equals detergent dissolved. Soil mass is not checked
against an independent balance.

**Repeatability.** The same load, parameters and seeds give the same verdicts, points and result
hash, cold or from the cache (the measurement review re-washed seven reference loads to identical
hashes). Until the evening of 11 October a wash without a cache gave another hash than the same
wash with one, because the hash named the cache key only when a cache was configured; that is
corrected, and a different hash under the same wash code now fails verification.

Between seeds, on the careful standard load with the capsule, official tier
(`docs/calibration/anchoring-v7.md` section 8):

| | Verdicts of 86 soiled items that differ |
|---|---|
| Two simulation seeds (arm phase, droplets), official tier | 0 in twelve pairs of washes |
| Two simulation seeds, fast tier | 1.4 on average (two knives and a fork) |
| Two level seeds (another draw of where the soil lies) | 6 (two glasses, a knife, a saucer, two soup spoons) |

On the course, three simulation seeds at the official tier moved no verdict on the breakfast
(the measurement review), and three at the fast tier moved at most one verdict a load
(`docs/benchmark/course-robustness.md`).

**Fast against official**, the standard load, eight pairs of washes on Eco 50: 615 of 688
verdicts agree, 89 %. Crockery 100 %, melamine 100 %, glass 95 %, cutlery 77 %. The cutlery
disagreement is systematic: two forks and a knife are clean officially and dirty at the fast
tier in every pair, two forks the other way round. On the reference loads of the seven levels
the fast tier gives the same verdict on 486 of 499 pieces of the careful and careless loads
(97 %) and the same pass or fail on every gate; a load's points differ by at most 10 (16 on one
random load). Every fast report states its error; a fast wash is a preview and is never a score.

## 7. Cost against the 30-minute budget

One cold official wash on Eco 50 through the game's runner on the reference machine, a
MacBook Pro (Apple M3 Pro, 18 GB). Other jobs ran on the laptop at the time, so only the first
row was measured with nothing else of this build running.

| Load | Items | Whole wash | Peak memory | When, and what else ran |
|---|---|---|---|---|
| **dinner-party, careful (the largest level), best of three** | 49 | **294 s** (338, 294 and 295 s) | 1.5 to 2.0 GB | 12 October 01:18 to 01:34, `wash-load dinner-party-careful --tier official --no-cache` three times in a row, no other job of this build; one unrelated job ran on the laptop during the first |
| tutorial, careful | 12 | 353 s | 1.0 GB | 12 October 00:18, two other jobs of this build beside it |
| standard 13-place load, careful | 114 | 390 s | 1.5 GB | 11 October 18:50, one other official wash beside it |
| dinner-party, careful | 49 | 328 s | 1.2 GB | the same |
| the 21 reference loads of the course | 10 to 51 | 264 to 508 s | | 11 October, two washes side by side on a busy machine |
| three levels through the page | | 5.4 to 8.3 minutes | | the product review, one other job beside it |
| standard load careful / careless, the loader's own soils | 114 / 113 | 411 s / 399 s | 2.4 GB / 1.4 GB | 12 October, the demonstration washes (`packages/sim-verify/demos/SUMMARY.md`), one other job beside them |

Nearly all of a cold wash is working out where the water goes, and most of that is the machine
itself: a load of one plate cost 170 to 290 s cold. That part is kept (`.spotless/exposure-cache`
by default from the command line; the game server keeps its own), so a second wash of the same
load takes 12 to 70 s at the official tier. A cold fast wash takes 46 to 92 s, a cached one 5 to
16 s.

The budget is not at risk.

## 8. What a verdict can be trusted for today

A verdict is "clean" when the inspector finds at most 4 specks and 4 mm2 of visible soil, counting
since 11 October what dirty water left where it stood on the item.

Two reviewers washed loads built to break this on the evening of 11 October (28 loads in the
measurement review, most at the official tier; a lower basket loaded badly through the page in
the product review). What follows is theirs, the calibration's and the models' episodes, after
the corrections made since. The two review reports and their loads are not in this repository.

### By kind of mistake

| Mistake | What the model does | Trust |
|---|---|---|
| Glass, mug or pot left mouth up | Fills (77 to 385 mL), and what the wash water held is left in it: not clean, whatever its soil. All 26 such vessels in the careless reference loads fail | The outcome is what a kitchen shows. The mechanism is the design's pool equation with no parameter of its own and no measurement behind it; before 11 October such a vessel scored clean unless its soil was smoothie or tomato. A level, shallow puddle (a few mL in the base recess of a mug) stays clean unless the last rinse is still dirty |
| Glass, mug or pot on its side | Not clean when its soil is one a jet must reach (smoothie, tomato soup, ketchup, guacamole); clean with chocolate, milk, yoghurt | Right in direction. Rests on a soil class (viscous, adhesive soils) that no bench rate, published mean or wash of the owner's has tested. It carries about three quarters of every level's margin |
| Detergent tray blocked | Egg, yoghurt, porridge on a covered face, mince, milk and tea stay dirty. Fat, cream, tomato and smoothie still come clean: a level keeps 59 to 86 % of its score with no detergent | Good for protein. Wrong for fat (the soil dossier says an oil film never goes to nothing without surfactant; not corrected, because it needs a new parameter and a refit). Tomato and smoothie coming off in water alone is what the dossier says of viscous residues |
| Bowl nested in another | The covered bowl is dirty | Good on the verdict when the bowl truly nests. It rests on a geometric correction of 10 October, not on a measurement, and the scripted careless hand cannot make a bowl nest on the corrected upper basket, so no reference load has it |
| Spoon lying in another | Dirty when it lies fully in the other; clean as the loading physics usually leaves it | Poor: see the gap closure in section 9 |
| Cutlery of a kind crowded in a cell | Clean | Wrong by the checklist, which expects 20 to 50 % more pieces not clean. Costs 0 to 6 points a level |
| Two plates in one slot | The session refuses it (15 tries in the review); set by hand at half the pitch, the covered plate loses 2 or 3 score points on its upper half | Not measured in any load |
| Plate turned to face away or to the wall | Twice the residue, usually the same verdict; with dried egg about one turned plate in three loses its verdict, with an easy soil none | Poor. The owner's plates show a factor of four |
| Plates fallen over, leaning on each other | Clean. The product reviewer's lower basket, with plates tipped, one lying on the cutlery basket and the upper arm held still, scored every loaded point at both tiers | Wrong, most probably. This is the open blocker |
| A spray arm held by an item | Jet coverage of the plates above falls to nothing; their verdicts do not change | Wrong in size, most probably; nobody has measured it on this machine |
| A board or tray stood in front of the plates | Costs nothing when the plates carry an easy soil | Consistent with the checklist for easy soils only |
| Position in the basket, lean, large beside small | No change of verdict | Unknown; the checklist expects half a point to a point |
| Too much in the machine | Not testable: the loader refuses what does not hold | |

### By soil

| Soil | Evidence behind it | Trust |
|---|---|---|
| Egg yolk and other protein removed by enzyme | Six bench rates (fitted), the published class mean (fitted), the owner's four plates (one number calibrated) | The order of items is reliable. A verdict is reliable when the item is far from the threshold. Near it, the verdict turns on the amount of soil (in the model 1.5 g on a plate is clean everywhere and 6 g is dirty everywhere) and on the soak: at a duty of 0.59 the breakfast's careful load falls from 174 to 115 points. Heat-ageing is on an unverified constant: the cooked-egg frying pan of the breakfast, its top prize at 18 points, did not come clean in any placement the reviewer or the models tried |
| Smoothie, tomato soup, ketchup, guacamole in hollow pieces | Parameters from the soil dossier; no wash | Unknown, and it is what the levels are built on |
| Porridge, spinach, minced meat | The published crockery mean only | Come clean on any open face; porridge and spinach also without detergent |
| Tea, coffee, red wine | The published crockery mean bounds one rate from below | Low. Every such verdict turns on the fourth decimal of that rate. No level carries them |
| Milk dried on glass | No measurement behind the rate | Low. 2 to 4 of 8 standard milk glasses come clean; on the right rest they do, along the left wall they do not |
| Margarine and other fats | The published mean | Clean on Eco 50, and also with no detergent and at 35 C, both of which are wrong |
| The other soils of the levels (cheese, burnt sugar, baked-on fat, starch films and the rest) | Parameters from the research dossiers | Unknown. Melted cheese and porridge in a thick layer read dirty wherever they stand, so the levels keep them off the table |

### What a score means today

- **For the scripted players**, the gap between a careful and a careless load is 23 to 41 % of a
  level's points on levels 2 to 7 (`docs/benchmark/course-table.md`). About three quarters of it
  (369 of 485 points over the six levels) is hollow pieces mouth up or on their side. Half of the
  dinner party's gap is an accident: a glass on its side blocks the tablet's path in its
  careless load.
- **For a capable model, the wash decides almost nothing.** In six episodes of two models at the
  official tier neither stood a hollow piece mouth up or on its side; what they loaded came out
  84 to 100 % clean; both beat the careful reference load on both full levels by placing pans
  and boards the scripted hand never tries. Their scores differ by what they fitted in.
- So a score reads as "packed well and made no gross mistake with a hollow piece".

## 9. Known gaps

What is out of scope by decision is in
[docs/design/scope.md](../design/scope.md#out-of-scope). What the wash does at its end:

- **Water left standing** in an item is reported in millilitres and does not by itself decide
  "clean" (whether it should is an open question: `docs/benchmark/README.md` section 10); what
  that water held does. Soil that leaves an item goes into the wash water and comes back only
  where water stands on an item at the end. That residue is split among soil classes as the
  whole load gave them up, detergent salts are not counted, and it is not painted on the page's
  residue picture.
- **The load is washed where it was placed.** A lift ratio flags items the jets would probably
  lift.

The gaps within scope:

- **Faces lying within a millimetre or two of another body.** The water side works on blocks of
  2 mm (official) or 4 mm (fast) and treats such a face as open wherever water can reach it: its
  film is renewed and its soil goes. A closure for these gaps was built on 11 October in the soil
  stage, from the exact shapes. It was reviewed twice and **is not merged** (it is not in this
  repository), for these reasons:
    - Switched on, it breaks the cutlery control: the cutlery mean of the standard load fell from
      4.61 to 4.31 against a published 4.67, almost all through forks.
    - It does not do what it was built for: the one fully nested spoon of the suite as it then
      was still scored 5 at the official tier.
    - Between 1 and 3 mm of clearance it hands back the open-face values whatever the depth of the
      gap, which is where most nested area lies.
    - Its deciding parameter, the share of the film at the mouth that drains into the gap
      (`soil.gapDrainShare`), moves the nested spoon from 5 to 0 over its range, and no measurement
      constrains it.
    - Three tests of the calibration package fail with it in place.

  Until it is fitted and merged, nested spoons as the loader lays them, crowded cutlery and any
  two faces lying close come out too clean. The test washes that would constrain it are washes 2
  and 3 of `docs/calibration/protocol.md`.
- **A film that does not answer to how it is reached.** With the soak spraying 0.8 of the time
  every open face is wet throughout with water renewed 0.4 to 7 times a second, and the
  chemistry cleans it whether a jet is on it or not. Nothing in the model makes a face that is
  only dripped on clean worse than one that is sprayed, beyond a factor of about two in residue.
  This is why plates and cutlery do not answer to stacking (section 8).

Known limits of the machine model:

- The upper basket's lowered cup shelves are at an inferred height, not yet measured by tape
  (`docs/calibration/protocol.md`, "Measurements of the machine still open"). Seats on or under
  them rest on it; a model stood two mugs there in one episode (11 points).
- The 13-place load holds 114 of the rated 140 pieces. That is the scripted loader on this
  basket, not the capacity of the machine.
- The gap between the lower basket and the tub's side walls is 9.5 mm on the left and 10.5 mm on
  the right, read from a photograph and good to about 6 mm a side. A board leaning out further
  than that is pushed in by the wall as the basket goes in; one leaning out less passes
  untouched. The owner's board leaned out 7.7 mm in the model and the owner reports that the real
  tub pushed it upright, so the gap is probably drawn too wide.
- On the right wall a board leaning out about 16 mm sometimes stops the basket (4 of 8 poses
  tried): the wall is drawn as a sheet with a square front edge and no lead-in.
- The reported energy (0.90 kWh against the label's 0.836) does not follow the soak duty.

## 10. Where each number comes from

| What | From |
|---|---|
| The default set and its tables (sections 2 to 4, 6) | `docs/calibration/anchoring-v7.md`; `packages/calibration/anchors/reports/` |
| The owner's plates on the final code (section 2) | `pnpm --filter @spotless/calibration spotless-fit predict packages/calibration/records/owner/owner-wash-01-egg-yolk-eco50.measured.json --params packages/calibration/anchors/anchored-v7.owner-capsule.json` |
| The bench rates (section 4) | `packages/calibration/anchors/scripts/check.ts` |
| The phenomena (section 5) | From the root of the repository: `INIT_CWD=. pnpm exec tsx packages/sim-verify/src/phenomena/cli.ts --tier fast --params packages/calibration/anchors/anchored-v7.owner-capsule.json --dose-g 12.9 --detergent-name "Finish Powerball Ultimate" --out .spotless/phenomena`. Without `--out` the command overwrites the stored report under `packages/sim-verify/phenomena/reports/`; with an absolute `--params` it writes that path into the report |
| The levels (sections 6 and 8) | `docs/benchmark/levels.md`, `course-table.md`, `course-robustness.md` |
| The models' episodes (section 8) | `docs/benchmark/first-runs/course/` |
| The two reviews (section 8) | two internal review reports of 11 October; the reports, their loads and their wash summaries are not in the repository, so the loads of section 8 cannot be reproduced from it |
