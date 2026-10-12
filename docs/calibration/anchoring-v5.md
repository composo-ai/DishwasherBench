# The fifth anchoring: `anchored-v5` on water-6, Eco 50 as the scored programme

> **Superseded as the game's default on 11 October 2026.** The owner's first test wash
> contradicts the soak duty of 0.5 that this anchoring kept: under `anchored-v5.owner-capsule`
> all four of his plates read not clean, and two came out spotless. The default is now
> `anchored-v6.owner-capsule` (duty 0.8, the published means refitted with it held):
> `owner-wash-01-calibration.md`. Everything below describes `anchored-v5` as it was made; the
> water side, the machine, the loads and the method are unchanged, the tables of sections 4 to
> 7 have their successors in sections 7 and 8 of that note. The `anchored-v5*` files are kept
> (the calibration starts from them) and are not to be washed with. Since the evening of
> 11 October the default is `anchored-v7.owner-capsule` (`anchoring-v7.md`: the machine with
> its corrected upper basket), and the `anchored-v5*` and `anchored-v6*` files say in
> themselves that they are superseded: no wash reads them as current.

11 October 2026, night. This note replaces `anchoring-v4.md` as the description of the sets the
game washes with. It is still **a provisional anchoring to another machine's published results**:
the owner's first test wash (egg yolk on plates, Eco 50, 10 October) was running while this was
made and nothing here was fitted to it. Its prediction (`owner-wash-01-prediction.md`) was made
with `anchored-v4.owner-capsule` on water-5 and is not changed; the v4 sets stay in
`packages/calibration/anchors/` for that reason and are stale on the present water side.
Paths written as `anchors/...`, `scripts/...` and `src/...` are relative to
`packages/calibration`.

**Which simulator.** `spotless-sim 0.5.0 water-6`, exposure sources `3ae47724f847`, machine data
`b647c5746839` (the Bosch as corrected on the evening of 10 October), the standard loads as
regenerated then (careful and careless: 118 of 140 items placed, 90 soiled; the careless load
blocks the tablet tray). Official tier unless stated.

## 1. What changed in the model

| Mechanism | Before | Now | Evidence |
|---|---|---|---|
| Where a splattered droplet is born (`sim-spray`, `fly`) | on a ring 4.5 jet diameters from the source point, laid out in the plane of the wall at that point: on the inside of a bowl or a glass the ring lies behind the wall, and the droplet started on the far side of it | the parcel starts where its jet strikes and is sent straight to its place on the ring: born there if the way is free; where the wall it stands on turns into the way the film follows the wall and the droplet leaves it there; anything else in the way takes it | geometry. A unit test with a jet glancing off the inside of a cup: before, two thirds of the splatter started outside the cup |
| The size of a droplet at a gap: `spray.outlineRays` (new, 4) | a point everywhere | a droplet whose centre line ends on a face of a gap the scene resolves (up to `scene.contactGap`, 4 mm) is flown again from its last event as a sphere of its own diameter (four rays a radius off the centre line) and lands where the first strikes | jets 6 (droplets of 0.2 to 2 mm); a unit test with 1.5 mm drops over a 1 mm slot |
| The soak of Eco 50: `prog.soakDuty` (new, 0.5), `prog.soakCycle` (600 s), `prog.soakFrom` (3600 s) | circulated for all of its 149 min | a hold of the main wash of an hour or more is sprayed for `soakDuty` of every cycle and rests for the remainder (the diverter goes on where it stood); the spray states are the same, so cached exposure is reused | section 3 |
| A calibrated set and the machine | recorded the water sources only: the v4 sets read as current after a basket was corrected | records the sources of `packages/machine` too (`anchoredOn.machineSource`) and is stale when they differ | the staleness of 10 October |
| The fitting rule | a parameter returns to its default when that costs under 0.5 log units | the same, unless the default leaves a soil on the floor of the scale under a published class mean that cannot then be met (the floor rule, section 2) | section 2 |

**What the first row does.** Two cereal bowls nested mouth down in the upper basket (P04): the
inside of the covering bowl received droplets at 0.03 to 0.09 kg/(m2 s) on every block, as much
as an open face, because the splatter of jets on the lower bowl was born in the gap between
the two (three quarters of the first-flight parcels landing more than 30 mm deep were born on
the covered face itself). Now it receives 0.0001 kg/(m2 s), its water is 50 s to an hour old
(exchange 0.0003 to 0.02 1/s against 0.3 to 0.6) and the supply factor of its soil is 0.03 to
0.35 against 0.95. The same bowls side by side are unchanged (droplets on the open inside
+10 %, film and exchange the same). The droplet outline alone moves little here (the gap is 2
to 12 mm and the droplets 0.3 to 0.8 mm); it closes gaps narrower than a droplet.

## 2. The fit (`anchors/scripts/fit.ts`, report `anchors/reports/fit.anchored-v5.md`)

Record: round robin 2022/2023, test appliance, detergent D at 20 g, Eco 50 with the main wash
at 54 C, on the settled careful load; four washes per point.

| Parameter | Fitted to | Result |
|---|---|---|
| `soil.egg_yolk.rateRef` (and milk) | the six in-machine rates, bench tile | **3.4e-5** kg/(m2 s); 0.84 / 1.79 / 0.17 / 2.47 / 0.68 / 4.77 against 0.85 / 1.75 / 0.17 / 2.59 / 0.69 / 4.66: all within tolerance |
| `liq.xProtease` | crockery, cutlery and glass means | best **0.02**, the upper bound of its search (the range of the bench data); the default 0.010 costs 0.73 |
| `soil.bleachRate` | the same | best **0.0009** (tea 1.90, crockery 3.66); the default 0.0008 costs 0.019 and is **not** returned: floor rule |

**The floor rule.** At 0.0008 every tea item reads dirty (mean 0.40). With those items there and
every other item of the crockery class at 5, the class mean can reach 3.21 at most; the record
publishes 3.68. That is a contradiction in a known direction which the likelihood of a wide
class mean (sd 1.1, weight 0.25) does not weigh, so the best point of the scan is kept. The
record bounds the rate from below only: tea is off the floor from 0.0009; up to 0.002 (tea
4.55, crockery 4.77) the likelihood stays within 0.25 log units. **Honest range: 0.0009 to
0.002**, and what is identified is the rate over the film of the IEC tea, which is itself known
to a factor of ten. The tea verdict turns on 12 % of this rate (0.40 at 0.0008, 1.90 at 0.0009,
2.93 at 0.0010).

## 3. The soak of Eco 50

No document gives a pattern: the machine dossier writes "long soak with intermittent spraying"
from the manual's "longer soaking and drying times"; the one published power trace of an
automatic programme of a comparable machine shows the pump on throughout its wash phases.
Two weak quantitative hints:

- **The label.** With the pump on throughout, the machine model puts Eco 50 at 0.90 kWh (heater
  0.71, pump 0.18 of which 0.137 in the soak) against the printed 0.836. If the soak's pump
  accounts for the 0.065 kWh, it runs 53 % of the time; the model's own energy error (0.05 kWh)
  spans 0.15 to 0.9. This is the registered default, 0.5.
- **The published class means** (detergent D, record course, protease scanned, bleach 0.0009):

| Duty | Best protease | Crockery | Cutlery | Glass (milk glasses) | All | -(log likelihood) |
|---|---|---|---|---|---|---|
| 1.0 | 0.016 | 3.28 | 4.49 | 3.65 (2.92) | 4.06 | 0.039 |
| 0.75 | 0.02 (bound) | 3.43 | 4.64 | 3.65 (2.92) | 4.18 | 0.014 |
| **0.5** | 0.02 (bound) | 3.66 | 4.51 | 2.38 (0.96) | 3.97 | 0.170 |
| Published | | 3.68 | 4.67 | 3.43 | 4.17 | |

Together (label as a normal about 0.53 with sd 0.36): 0.5 scores 0.17, 0.75 scores 0.20, 1.0
scores 0.89 log units. **0.5 to 0.75 are equally supported; continuous circulation is mildly
disfavoured.** The set keeps the default 0.5. What it costs: on Eco 50 the glass class reads
2.4 against 3.43 (1.1 sd low) and nearly every milk glass dirty; at 0.75 the published table
is reproduced almost exactly with the protease at its bound.

What the duty does to the verdicts (owner's capsule, careful load, one wash each):

| Duty | All | Soiled items clean, of 90 | Egg yolk items clean, of 20 | Milk glasses clean, of 13 | Tea items clean, of 10 |
|---|---|---|---|---|---|
| 1.0 | 4.12 | 65 | 10 | 5 | 4 |
| 0.75 | 4.08 | 64 | 12 | 2 | 4 |
| **0.5** | 3.75 | 57 | 6 | 0 | 6 |
| 0.25 | 3.27 | 46 | 0 | 0 | 6 |
| 0.5, cycle 150 s | 3.85 | 60 | 7 | 0 | 6 |
| 0.5, cycle 2400 s | 3.71 | 56 | 6 | 0 | 5 |

The cycle length matters little; the duty decides the egg forks and the milk glasses. **The
owner's wash 01 measures it**: egg-yolk plates on Eco 50 with his capsule. To set another
duty, add `"prog.soakDuty": 0.75` to the overrides of the set (no exposure is recomputed) or
fit it once a record of his exists.

## 4. Eco 50 against published (detergent D, 20 g, record course)

| Case | Crockery | Plates / tea | Cutlery | Glass | Milk glasses | Melamine | All | Items clean | Soiled items clean |
|---|---|---|---|---|---|---|---|---|---|
| Published (Bosch SMV6ECX51E eco, D) | 3.68 | not published | 4.67 | 3.43 | | 4.21 | 4.17 | about 70 % | |
| **anchored-v5, careful** (4 washes) | 3.62 to 3.70 | 5.00 / 1.8 to 2.0 | 4.46 to 4.55 | 2.35 to 2.40 | 0.92 to 1.00 | 5.00 | 3.93 to 4.01 | 89 to 90 of 118 (76 %) | 61 to 62 of 90 |
| registry defaults, careful | 1.68 | 2.38 / 0.70 | 4.00 | 1.75 | 0.00 | 2.50 | 2.96 | 68 of 118 | 40 of 90 |
| anchored-v5, careless (tablet blocked) | 0.15 | 0.24 / 0.00 | 2.96 | 0.00 | 0.00 | 0.00 | 1.61 | 39 of 118 | 11 of 90 |

By soil, careful (share of dry mass left; mean score; items clean): egg yolk 0.2 %, 3.5, 10 or
11 of 20 (plates all, forks 2 or 3 of 12); margarine 0.0 %, 4.8 to 5.0, 13 or 14 of 14; milk
2.7 to 3.4 %, 0.9 to 1.0, 0 or 1 of 13; minced meat 5.0, 6 of 6; porridge 5.0, 20 of 20;
spinach 5.0, 7 of 7; tea 10.3 %, 1.8 to 2.0, 4 of 10.

## 5. The owner's capsule (12.9 g) on Eco 50 as written: careful against careless

| Case | Crockery | Plates / tea | Cutlery | Glass | Milk glasses | Melamine | All | Items clean | Soiled items clean |
|---|---|---|---|---|---|---|---|---|---|
| **careful** (4 washes) | 3.73 to 3.86 | 4.57 to 4.62 / 3.0 to 3.2 | 4.22 to 4.25 | 1.80 | 0.08 | 5.00 | 3.75 to 3.80 | 85 to 88 of 118 | **57 to 60 of 90** |
| **careless** (tablet tray blocked; 2 washes) | 0.15 | 0.24 / 0.00 | 2.94 to 3.01 | 0.00 to 0.17 | 0.00 | 0.00 to 0.17 | 1.63 to 1.65 | 38 to 40 of 118 | **10 to 12 of 90** |
| careless with the tablet freed (2 washes) | 3.00 to 3.12 | 3.71 to 3.81 / 2.4 to 2.6 | 4.18 to 4.21 | 1.85 | 1.23 | 5.00 | 3.54 to 3.59 | 74 to 77 of 118 | 46 to 49 of 90 |
| Auto 45-65 as written, careful (secondary) | 2.50 | 2.81 / 2.60 | 3.94 | 1.75 | 0.00 | 4.33 | 3.23 | 73 of 118 | 45 of 90 |
| Auto 45-65, careless | 0.15 | 0.24 / 0.00 | 3.00 | 0.00 | 0.00 | 0.00 | 1.63 | 40 of 118 | 12 of 90 |

By soil, careful / careless / careless with the tablet freed (items clean): egg yolk 6 or 7 of
20 / 0 / 3 or 4; milk 0 of 13 / 0 / 0; tea 6 of 10 / 0 / 4 or 5; margarine 12 to 14 of 14 / 10
to 12 / 11 or 12; minced meat 6 of 6 / 0 / 6; porridge 20 of 20 / 0 / 20; spinach 7 of 7 / 0 / 7.
Dry soil left: 1.7 % careful, 58 % careless. With the capsule the liquor is at pH 10.4 to 10.5
against 10.8 with detergent D, which is why egg does worse than in section 4 at a higher
protease level.

The stacking mistakes of the careless load taken one by one (tablet freed, so that only the
stacking differs; score careful against careless, official tier, fast tier in brackets):

| Mistake | Items | Careful | Careless |
|---|---|---|---|
| plate turned away | dessert_plate_01, saucer_02 | 4, 5 | 1, 2 (fast 1, 0) |
| bowl face down flat | dessert_bowl_02 | 5 | 1 (fast 3) |
| spoon lying in another | soup_spoon_12, soup_spoon_13 and their partners | 5 | 5 (fast 5) |
| plate over another | melamine_plate_02 over melamine_plate_01 | 5 | 5 (fast 5) |
| cup on its side (6) | mean | 0.3 | 0.0 |
| cup upright (5) | mean | 0.0 | 3.0 (fast 2.8) |

A turned plate and a bowl laid flat now lose their verdict; a spoon lying in another and a
plate over another still come out clean (their porridge and spinach go wherever a film runs).
An upright cup does better than the same cup mouth down, because it fills with liquor and its
milk or tea soaks in it all through the wash: the model has no penalty for standing dirty
water (redeposition and drying are not built).

## 6. Seeds, tiers, untouched items (owner's capsule, careful load, 8 washes per tier)

| | Eco 50, official | Eco 50, fast | Auto, official | Auto, fast |
|---|---|---|---|---|
| Load mean, standard weights (sd over 8) | 3.81 (0.022) | 3.75 (0.012) | 3.24 (0.014) | 3.22 (0.013) |
| Soiled items clean, of 90 | 56 to 60 | 53 to 55 | 44 or 45 | 42 to 45 |
| Verdicts that differ between two simulation seeds (12 pairs) | **0.6, 0 or 1** | 1.2, 0 to 4 | 0.9, 0 to 2 | 0.2, 0 or 1 |
| Distinct items that ever flip | 1 (a knife) | 4 | 2 | 1 |
| Verdicts that differ between two level seeds | 3.2 | 4.2 | 7.8 | 5.8 |
| Largest spread of residue over seeds | 1.7 % (a glass) | | | |

| Fast against official, same seeds | Eco 50 | Auto |
|---|---|---|
| Verdicts that agree, of 90 | 83 to 86: **92 to 96 %, mean 94 %** (was 88 %) | 93 to 97 %, mean 95 % |
| By class: crockery / cutlery / glass / melamine | 92 % / 93 % / 100 % / 100 % | 95 % / 93 % / 100 % / 88 % |
| Largest class-mean difference | 0.05 to 0.19 | |
| What flips | dessert plates 2 or 3, knives 2 or 3, a dinner plate, a soup spoon | |

The glass class agrees because every milk glass reads dirty at both tiers. The file
`anchors/tiers.anchored-v5.owner-capsule.json` holds these counts; the report of every fast
wash (game, phenomena suite, demonstration washes) quotes them per class of item.

**Untouched items** (two dessert plates turned half a turn; 88 untouched soiled items; level
seeds 1 and 2): one untouched verdict changes at the official tier at each level seed and one
residue moves by more than 2 % of the initial soil; at the fast tier one verdict and none. With
droplets born on the side of a wall their jet struck, what a turned plate throws at its
neighbours changes with it; before, no untouched verdict changed.

## 7. Stacking mistakes: the phenomena suite

The suite runs on Eco 50 unless a run names another programme (`--programme auto_145` for the
secondary report). Its loads were built again on the present machine (36 by the loading
physics). Four recipes of the first build no longer seat on the present basket and are gone:
a reversed plate and a reversed platter in a rear slot (P02's supporting pair is dropped; P14
stands the platter upright between the last tine and the side wall, both ways round), the
platter inboard of two plates (P05, a set pose that cuts 2 mm into a plate: an error of the
scenario), and the ladle hanging through the basket floor (P06 holds the lower arm itself at
the angle the first build found, 148 degrees).

| Run (owner's capsule, 12.9 g) | Pass | Too small | Too large | Wrong sign | Not covered | Error |
|---|---|---|---|---|---|---|
| Fast, anchored-v4, Eco 50, detergent D (last round) | 14 | 16 | 8 | 1 | 9 | |
| **Fast, anchored-v5.owner-capsule, Eco 50** (84 washes) | 15 | 17 | 4 | 2 | 9 | 1 |
| Fast, the same with `prog.soakDuty` 0.75 | 16 | 15 | 6 | 1 | 9 | 1 |
| Fast, anchored-v5.owner-capsule, Auto 45-65 (secondary) | 12 | 18 | 5 | 3 | 9 | 1 |
| Official, anchored-v5.owner-capsule, Eco 50: P01 to P09, P13 to P15, P40 (27 washes) | 5 | 5 | 2 | 0 | | 1 |

The official tier gives the fast tier's verdict on every one of these but P13 (pass at the
official tier, too small at the fast). Of the 17 resolution-sensitive phenomena, P10, P12, P35,
P36 and P37 were not run at the official tier: a small official wash takes 4.5 to 6 minutes
and the night ran out.

| Pair | Fast, Eco 50 | Official, Eco 50 | Verdict |
|---|---|---|---|
| P04 bowl nested in another | 9 % of the porridge left, score 0 (apart: 0 %, score 5) | 12 % left, score 0 | score as expected; the share left is under the 25 % the checklist names |
| P15 spoon lying in another | shielded spoon 4, partner 5 | 4, 5 | too large (expected 0 to 1) |
| P40 touching glasses | 0.48 g more held water | 0.42 g | pass |
| P13 glass over tines | direct-jet time -3 % | -5 % | too small at fast, pass at official |
| P14 platter face to the wall | score 2 against 0; renewal 33 to 2.5 1/s | 2 against 1; 34 to 4.8 | pass |
| P01 upright vessel | 253 g retained, bowl 148 g | the same | pass |
| P02 plate turned away | 5.0 % against 6.0 % of the yolk left, 0 against 0 | 3.6 % against 4.8 %, 0 against 0 | no score change: both dirty |
| P06 lower arm held | plates under a jet 41 % to 0 %; 0.14 against 0.14 | the same | no score change: both dirty |

Who is at fault where the fast run on Eco 50 fails:

| Phenomena | Fault | Why |
|---|---|---|
| P02, P03, P06, P07, P09, P12, P27, P44 | soil side, with the soak | the egg-yolk plate of the suite (2 g on a dessert plate, oven-dried 2 h at 80 C) and the egg forks read dirty with the capsule on Eco 50 at a duty of 0.5 on both sides of the pair; the water side sees every one (direct-jet time, dwell, coverage pass). At a duty of 0.75 the same plates score 2 against 2, P03 5 against 0 and P06 4.6 against 3.4 |
| P04 | expectation | the nested bowl reads dirty as expected; 9 to 12 % of its porridge is left where the checklist's estimate asks for 50 % |
| P15 | water side or expectation, not settled | 0.3 g of porridge on the shielded spoon goes wherever a film runs, and a film runs through the gap from the handle above; the owner's test of nested spoons decides |
| P05 | scenario | no clear place for a 32 cm platter inboard of the plates on the present basket |
| P13 | water side (resolution) | passes at the official tier |
| P17, P20, P25, P29, P31, P32, P33 | soil side | crowding, total soil load, ageing, starch, milk and fat laws as the last round left them |
| P35, P37 | water side | a pot on its side; a recess tilted 15 and 30 degrees still holds water |
| P10, P19, P46 | expectation | differences of 0.0001 to 0.004 against a tolerance; the model repeats better than a machine |

## 8. What the game does with it

- `packages/wash-runner/src/defaults.ts` points the owner's machine at
  `anchored-v5.owner-capsule.json` with 12.9 g and names Eco 50 as the scored programme
  (`scoredProgrammeOf`). The set is current: **the default wash runs** (since 02:02 on 11
  October).
- Verdicts on protein soils and stains on Auto 45-65 stay flagged provisional; Eco 50 carries
  no flag.
- The report of every fast wash begins with what the fast tier costs, per class of item.

## 9. Commands

```
cd packages/calibration
pnpm exec tsx anchors/scripts/check.ts            # version, water side, machine, ranges, bench anchors
pnpm exec tsx anchors/scripts/fit.ts              # the fit; writes anchors/anchored-v5.json
pnpm exec tsx anchors/scripts/make-owner-set.ts   # the owner-capsule layers
pnpm exec tsx anchors/scripts/revalidate.ts       # after a change of sources that should not change results
pnpm exec tsx anchors/scripts/study.ts anchors/reports/tables.v5.cases.json out.json
pnpm exec tsx anchors/scripts/tier-agreement.ts --set anchored-v5.owner-capsule eco_50=<official.jsonl>,<fast.jsonl>
cd ../sim-verify
pnpm exec tsx phenomena/builder/build-loads.ts --force
pnpm exec tsx src/phenomena/cli.ts --tier fast --params ../calibration/anchors/anchored-v5.owner-capsule.json --dose-g 12.9 --detergent-name "Finish Powerball Ultimate"
```

## 10. Cost of one cold official wash on Eco 50

Through the game's runner (`packages/wash-runner/scripts/wash-load.ts`, default set), one wash at
a time, the careful load of each level as the loader had saved it at 04:30 on 11 October, load
average 3.3 to 3.9. One run each: the night did not leave time for three.

| Load | Items | Blocks | scene | exposure | soil | replay | result | Total (s) | Peak RSS |
|---|---|---|---|---|---|---|---|---|---|
| tutorial | 12 | 378,550 | 5.2 | 259.1 | 0.3 | 0.6 | 0.4 | 266 | 1.5 GB |
| breakfast | 38 | 698,328 | 6.9 | 269.7 | 1.1 | 3.0 | 1.2 | 282 | 2.1 GB |
| weeknight dinner | 32 | 652,201 | 7.1 | 261.2 | 1.1 | 2.1 | 1.0 | 273 | 2.0 GB |
| dinner party | 48 | 740,380 | 7.2 | 290.5 | 1.2 | 3.0 | 1.1 | 303 | 2.0 GB |
| baking day | 34 | 571,012 | 6.5 | 259.1 | 0.7 | 1.9 | 0.8 | 269 | 1.8 GB |
| mixed family | 38 | 680,956 | 6.8 | 269.9 | 1.1 | 2.9 | 1.2 | 282 | 1.9 GB |
| standard load (careful) | 118 | 1,165,254 | 11.2 | 313.7 | 1.3 | 9.1 | 3.5 | **339** | 2.6 GB |

Every load is between 4.4 and 5.7 minutes against a budget of 30. About four minutes do not
depend on the load: the jets and droplets on the baskets and the tub themselves. The standard
load costs what it did on water-5 (336 s). A wash whose exposure is cached takes 25 to 70 s
(up to 170 s for a load that keeps most of its soil: the replay steps every deposit that is
left). With a second official wash running beside it, an official wash took 320 to 450 s.

## 11. Demonstration washes (now in `packages/sim-verify/demos/v5-old-basket/`; the level's own soils, capsule, Eco 50)

| | careful | the same items loaded badly | half load | careless |
|---|---|---|---|---|
| Items clean | 78 of 118 | 28 of 118 | 41 of 62 | 40 of 118 |
| Mean score | 3.42 | 1.19 | 3.40 | 1.72 |
| Dry soil left | 1.6 % | 78 % | 1.2 % | 61 % |

The washes of the fourth anchoring (Auto 45-65) are kept in `demos/v4-auto/`.

## 12. The planned record of the owner's wash 01 under this set (for information)

The prediction of that wash is `owner-wash-01-prediction.md`, made on water-5 with
`anchored-v4.owner-capsule` (the soak circulated throughout). It stands. For the comparison
only, and before his result is known: the same planned record on the delivered set
(`spotless-fit predict`, 04:13 on 11 October) reads **all four plates not clean**: 9121 (oven,
turned) 2.9 % of the yolk left, score 0; 9122 (oven, facing) 0.8 %, score 0; 9123 (air, facing)
0.12 %, score 1; 9124 (small, turned) 8.6 %, score 0. The registered prediction has the two
plates facing the middle clean. The difference is the soak: at a duty of 1 these plates come
clean, at 0.5 they do not. His plates therefore measure the duty directly.

## 13. What can and cannot be trusted

Can:
- Whole-load loading quality on Eco 50: careful 57 to 60 of 90 soiled items clean against 10
  to 12 careless (46 to 49 with the tablet freed); the same items loaded badly 28 of 118
  against 78.
- A turned plate, a bowl laid flat, a platter face to the wall, a bowl nested in another, a
  blocked tablet, an upright vessel: each now changes a score at the official tier.
- Repeatability: 0.6 verdicts in 90 change with the simulation seed; the fast tier agrees with
  the official on 94 %.
- Porridge, spinach, minced meat, margarine: clean where water reaches them.

Cannot:
- Egg forks and milk glasses on Eco 50. They turn on the soak's duty (0.5 by the label's
  energy, 0.75 by the published table): 6 or 7 of 20 egg items and 0 of 13 milk glasses clean
  at 0.5; 12 and 2 at 0.75; 10 and 5 at 1.
- A spoon lying in another and a plate lying over another: still clean.
- An upright cup: it scores better than the same cup mouth down.
- Tea: the verdict turns on 12 % of the bleach rate; the record bounds it from below only.
- Auto 45-65 for protein soils and stains (flagged in every report).
