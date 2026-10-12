# Phenomena suite: official tier, packages/calibration/anchors/anchored-v4.owner-capsule.json

Checklist: docs/research/standards.md section 9 (P01 to P48). Machine `bosch_smv4hax40g`. Simulation `spotless-sim 0.4.1 water-5`; parameters packages/calibration/anchors/anchored-v4.owner-capsule.json (hydro `sha256:ecdf6e077c2e`, soil `sha256:45173d348ccd`, 16 overrides). Detergent: Finish Powerball Ultimate, 12.9 g. Source `beaf25c1244cad08`. Exposure traced on: gpu. 2 phenomena, 4 washes (0 with cached exposure), 1249.4 s.

Verdicts: 2 too small.

A verdict is that of the deciding checks: the worst of them. Supporting checks are evidence and decide nothing. "Accepted" is the checklist's range with its tolerance (a factor of two, or one score point; a negative control may reach twice its limit).

| ID | Phenomenon | Verdict | Measured | Expected | Accepted |
|---|---|---|---|---|---|
| P05 | Large flat item shadows what is behind or above it | too small | score: 0 -> 0: 0 score | -1 to -3 for tenacious soils on faces served only by that arm | -0 to -6 |
| P14 | Soiled face against the tub wall or door liner | too small | score: 0 -> 0: 0 score | as P02: -1 to -2 | -0 to -4 |

## Phenomena

### P05 Large flat item shadows what is behind or above it: too small

Test: Two dessert plates with egg yolk in the left front lane of the lower basket, faces to the arm axis; a 32 cm oval platter on edge outboard of them at the side wall (A) against inboard of them, between the plates and the arm axis (B).

Adapted: A 32 cm platter on edge stands in for the baking tray, which is too tall to stand in the lower basket of this machine. Items above it in the upper basket are not scored: the upper basket has its own arm underneath, so the lower basket does not shadow it from its main spray.

Stages: water: jets (line of sight), droplets; soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| score | mean IEC score of the two plates, B - A | 0 | 0 | 0 score | -1 to -3 for tenacious soils on faces served only by that arm | -0 to -6 | too small |
| f_jet | fraction of time their faces are under a direct jet, B over A, minus one | 0.00179 | 1.4e-4 | -0.92 1 | items inside the shadow lose direct impingement from that arm | -0.05 or more | pass |

- **A**: platter at the side wall. Load `board-side`, programme `auto_145`, 3 items (1 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.97 (max 10.6), protease mean 0.0338 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:117d765cfe54`, 429.7 s.
- **B**: platter between the plates and the arm axis. Load `board-middle`, programme `auto_145`, 3 items (1 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.97 (max 10.6), protease mean 0.0338 g/L (peak 0.0958), peracid mean 0.0773 mmol/L (peak 0.449). Result `sha256:16fe0604c248`, 282.3 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | plate_1 (well) | 4.9e-4 | 0.16 | 278 | 20.3 | 1 | 1 | 1.1 | 11.3 | 0.784 | 0 |  | 0 | 9125 | 0 | 1.07 | iec_egg_yolk (reaction) 413/985 mg |
| A | plate_2 (well) | 0.00308 | 0.407 | 276 | 23.4 | 1 | 1 | 2.62 | 23.5 | 0.94 | 0 |  | 0 | 9088 | 0 | 0.992 | iec_egg_yolk (reaction) 373/969 mg |
| B | plate_1 (well) | 1.9e-4 | 0.111 | 452 | 30.3 | 1 | 1 | 1.96 | 16.6 | 0.931 | 0 |  | 0 | 9121 | 0 | 1.03 | iec_egg_yolk (reaction) 405/985 mg |
| B | plate_2 (well) | 9.4e-5 | 0.0933 | 382 | 30.6 | 1 | 1 | 2.61 | 19.5 | 1 | 0 |  | 0 | 9107 | 0 | 1.03 | iec_egg_yolk (reaction) 385/969 mg |

### P14 Soiled face against the tub wall or door liner: too small

Test: An oval platter with egg yolk in the outermost slot of the rear lane of the lower basket (R1 slot 0, next to the left wall): face to the arm axis (A) against face to the wall (B).

Adapted: The outermost seat of the Bosch leaves several centimetres to the wall, not 8 mm; the platter is seated by the loading physics both ways round.

Stages: water: jets (line of sight), run-off (renewal); soil: removal laws.

| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |
|---|---|---|---|---|---|---|---|
| f_jet | fraction of time the soiled face is under a direct jet, B over A | 0.00669 | 0 | 0 1 | as P02: f_jet on the soiled face drops to about 0 | |x| <= 0.1 | pass |
| score | change of the IEC score of the platter, B - A | 0 | 0 | 0 score | as P02: -1 to -2 | -0 to -4 | too small |
| renewal (supporting) | rate the water on the soiled face is replaced, B over A, minus one | 37.8 | 4.34 | -0.885 1 | slow exchange near the wall | -0.05 or more | pass |
| residue (supporting) | share of the egg yolk left on the well, B - A | 0.165 | 0.252 | 0.0869 1 | the face to the wall keeps more | +0.01 or more | pass |

- **A**: face inward. Load `platter-inward`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0338 g/L (peak 0.0958), peracid mean 0.0772 mmol/L (peak 0.449). Result `sha256:ea3ecb132733`, 267.6 s.
- **B**: face to the wall. Load `platter-to-wall`, programme `auto_145`, 1 items (0 clean, mean score of the soiled 0), seeds 1/1. Liquor of the main wash: 113 min with detergent, mean 54.3 C (max 66.8 C), pH 9.96 (max 10.6), protease mean 0.0338 g/L (peak 0.0958), peracid mean 0.0772 mmol/L (peak 0.449). Result `sha256:4708fa617ae5`, 269.7 s.

| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | platter (well) | 0.00669 | 0.509 | 415 | 30.2 | 1 | 1 | 6.35 | 37.8 | 1.26 | 0 |  | 0 | 10240 | 0 | 1.21 | iec_egg_yolk (reaction) 170/1026 mg |
| B | platter (well) | 0 | 0 | 0 | 0 | 1 | 1 | 0.279 | 4.34 | 0.489 | 0 |  | 0 | 12242 | 0 | 1.22 | iec_egg_yolk (reaction) 259/1026 mg |

## Columns of the diagnostics

Per affected surface, time-weighted over the circulation of the programme: `f_jet` fraction of time under a direct jet (wall shear above the first of `jets.shearLevels`), mean over the surface; `jet area` share of the surface ever under a jet; `peak shear` largest wall shear of a jet on it; `mean shear` mean wall shear while inside a footprint; `wet time` fraction of time there is water on it; `wetted area` share that is wet in at least one spray state; `flux` water received (what lands out of the air per area, plus what runs on per width over a 4 mm reference run: the same at both tiers); `renewal` rate the water on it is replaced; `film shear` wall shear of the draining film; `pooled area` share under a pool when the pool is full; `pools` capacity and the time each pool stands full. The soil model reports no removal by mechanism: `soils left` gives, per soil, the removal law of its model class and the dry mass left of the mass applied.

