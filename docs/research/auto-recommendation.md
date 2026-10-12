# Auto 45-65 and protein soils: what the evidence supports changing

> **Record of the build, kept as written (10 October 2026).** A recommendation on the Auto 45-65
> programme, written when the game was to be scored on it. The game is scored on Eco 50 only
> (`docs/design/scope.md`); Auto remains in the machine data, uncalibrated. Working files this
> note cites are not in the repository. The index of the documents is `docs/README.md`.

Fact-checker's recommendation, 2026-10-10. For the engineers who own `packages/sim-liquor`, `packages/sim-soil` and `packages/machine`. No code or parameter file was edited. It rests on two dossiers, each now with a "Fact-check" section: `enzymes-at-temperature.md` and `auto-programme-evidence.md`.

Tags: [VERIFIED] read in an opened source; [ESTIMATED] derived, inputs given; [ASSUMED] no source.

## 1. In brief

1. **One change of a default is supported: the protease activity mid-point, `soil.enzymeTm`, from 63 to 75 C.** With a 30-minute half-life at 60 C beside it, the present value counts the same heat loss twice.
2. **No other default should move on desk evidence.** The protease half-life (30 min at 60 C) lies inside a verified bracket of 3 minutes to about 2 hours and nothing places it better. The wash target of the normal Auto branch is undetermined between 50 and 65 C.
3. **Neither unknown decides the verdict.** In whole washes with the repository's code, the enzyme and programme assumptions move the egg yolk left on Auto between 76 % and 1 %, and in every case all 17 egg items and all 7 milk glasses stay dirty. A wash of about an hour is too short for the soil model as anchored, whatever the enzyme does. The "do not use Auto verdicts for egg and milk" of `docs/calibration/anchoring.md` stands.
4. **Two measurements settle it:** one logged Auto run (power and temperature), and egg-yolk plates washed on Auto and on Eco 50 with the owner's capsule.

## 2. Recommended changes

| Parameter or setting | Current | Recommended default | Range | Tag | Reason |
|---|---|---|---|---|---|
| `soil.enzymeTm` (protease activity mid-point) | 63 C (50 to 90) | **75 C** | 63 to 85 | [ESTIMATED] | The half-life law already removes the enzyme above 60 C; a mid-point at 63 C halves its activity a second time at 65 C. Savinase with calcium keeps 69 % through 10 min at 70 C [VERIFIED, US 5,677,163]. The half-life law alone reproduces the published 5-minute optimum of 60 C [VERIFIED, Falkenberg et al. 2022]; with both it falls to 55 C |
| `liq.proteaseHalfLife` at 60 C, default | 1800 s | unchanged | | [ESTIMATED] | Savinase at pH 10: 2.8 to 3.0 min desalted without calcium, 83 to 135 min with 50 mM calcium [VERIFIED as buffer values]. A liquor lies between; nothing measured in a liquor was found |
| `liq.proteaseHalfLife`, registered range | 600 to 14400 s | default unchanged | **180 to 14400 s** | lower bound [VERIFIED] as a buffer value | The registry cannot express the calcium-free end today (a set with 180 s is rejected) |
| `liq.proteaseHalfLife`, owner's capsule | 1800 s or 7200 s in the two owner sets | no default; keep both sets as a bracket | 1800 to 14400 s | [ASSUMED] | No measurement. The household-machine study cited for stability cannot tell 30 from 90 minutes (a 28-minute wash peaking at 64 C leaves 40 to 53 % against 74 to 81 % of the enzyme) |
| `liq.proteaseEd` | 200 kJ/mol (100 to 300) | unchanged | unchanged | [ESTIMATED] | 142 to 188 kJ/mol from two temperatures; two points of error on one reading widen that to 142 to 238. The proposed 170 is not a supported change |
| Owner set `anchored-v2.owner-tablet.savinase.json` | mid-point 63 C | regenerate after the first row; it then differs from its sibling by the half-life only | | | Both owner sets carry 160 mg/L of protease (0.05 kg/kg, 12.9 g, 4.0 L), not the 80 mg/L the enzyme dossier computed with |
| `washTarget` of `BOSCH_AUTO_145_OPTIONS` | 65 C | unchanged until a run is logged | **50 to 65 C**, status unknown | [ESTIMATED] | For lower: the 2008 platform's 45 / 50 / 55 C variant [VERIFIED, sister]; a power trace of an unidentified machine (peak 48 to 58 C). For 65 C: the 2008 structure "65 C, two rinses" draws 11.5 L on this machine's volumes, the sisters' measured water [VERIFIED, sister; arithmetic mine]; the thermal model is 2 to 7 % under the sisters' energy at 65 C and 9 to 13 % under at 55 C; a relayed Bosch service statement ends the ramp at 65 C |
| Heat-up shape | one ramp | add an option for a plateau (default off); carry "staged to 55 C" as a named alternative programme beside `auto_145_keep` | plateau 30 to 45 C, 5 to 20 min | [ESTIMATED] | Three weak hints for a pause near 45 C (service hearsay, one owner's report, the unidentified trace), none against, no document. Course tested here: heat to 45 C, 10 min heater off, heat to 55 C, 42 min post-wash, rinse 10 min, final hold 1 min, drying 35.5 min: 144.7 min, 11.5 L, 0.96 kWh in the thermal model |
| `reheatBand` | undefined | unchanged | | mechanism [VERIFIED, BSH patent of 2010] | Heater off after the maximum |
| `finalTarget` | 69 C | unchanged | 63 to 72 C | [ESTIMATED] | 65 C for Auto on the 2008 platform; 69 C printed for this model's Intensive and Express |
| Declared energy of a 55 C course | | 0.96 kWh, not the 1.08 kWh of the programme dossier | | computed | Repository thermal model |

Not recommended, because the evidence does not carry them: a capsule half-life of 5400 s as a default; `liq.proteaseEd` 170 kJ/mol; a wash target of 55 C as the primary course; any numeric threshold for the branch rule (`auto.d1`, `auto.d2`, `auto.d3`, `auto.sensitivity`: the decision points are documented, every number is invented); a change of `liq.xProtease` for the capsule or of the amylase values.

## 3. What the changes do, in whole washes

Script: `rec/auto.ts` (a working file of the session, not in the repository), run from `packages/calibration`; cases `cases-main.json` and `cases-diag.json`, results `out-main.json` and `out-diag.json`. It calls the repository's `wash` (machine timeline and thermal model, `sim-liquor`, `sim-soil`, inspector) on the settled standard load of the anchoring: official tier, level seed 1, simulation seed 1, exposure from the anchoring's frozen water side (`97aa4d392843`, the hash of the sources on disk today; all exposure sets cached). Candidate courses are built in memory from `BOSCH_AUTO_145_OPTIONS`.

- **D**: `anchors/anchored-v2.json`, 20 g of reference detergent D.
- **Capsule**: `anchors/anchored-v2.owner-tablet.savinase.json` (the capsule's composition from `detergents/finish-powerball-ultimate.json`, protease level scaled as the anchoring does), 12.9 g.

Each cell: egg yolk left / milk left, as a share of the dry mass. **In every Auto cell no egg item (of 17) and no milk glass (of 7) is clean.**

| Parameter set | Auto as written (65 C, 46 min) | Staged to 65 C | Staged to 55 C | One ramp to 55 C | Eco 50, for scale (egg items, milk glasses clean) |
|---|---|---|---|---|---|
| D, today (30 min, 63 C) | 56.6 % / 77.9 % | 25.0 % / 56.9 % | 1.4 % / 17.8 % | 1.7 % / 18.8 % | 0.0 % / 7.2 % (12, 3) |
| **D, mid-point 75 C (recommended)** | **24.6 % / 56.2 %** | 10.3 % / 39.8 % | 1.4 % / 17.5 % | 1.6 % / 18.3 % | 0.0 % / 7.2 % (11, 3) |
| D, 75 C, half-life 10 min (registry minimum) | 76.3 % / 88.6 % | 40.1 % / 68.4 % | 2.8 % / 23.0 % | 4.0 % / 26.8 % | 0.1 % / 7.9 % (9, 0) |
| D, 75 C, half-life 2 h | 1.6 % / 18.4 % | 1.3 % / 17.3 % | 1.1 % / 16.4 % | 1.2 % / 16.8 % | 0.0 % / 7.0 % (13, 3) |
| Capsule, today (30 min, 63 C) | 49.8 % / 73.9 % | 26.9 % / 58.4 % | 3.5 % / 25.3 % | 3.8 % / 26.3 % | 0.1 % / 7.8 % (9, 0) |
| **Capsule, mid-point 75 C, half-life 30 min** | **17.8 % / 49.5 %** | 9.7 % / 38.8 % | 3.3 % / 24.9 % | 3.6 % / 25.6 % | 0.1 % / 7.9 % (9, 0) |
| Capsule, 75 C, half-life 90 min | 3.0 % / 23.9 % | 2.9 % / 23.4 % | 3.1 % / 24.1 % | 3.3 % / 24.7 % | 0.1 % / 7.8 % (9, 0) |
| **Capsule, 75 C, half-life 2 h** (the "heat-stable" owner set) | **2.7 % / 22.8 %** | 2.6 % / 22.6 % | 3.0 % / 24.0 % | 3.2 % / 24.6 % | 0.1 % / 7.8 % (9, 0) |

Reading:

- The recommended change alone (rows in bold against the rows above them) takes the egg yolk left on Auto as written from 57 % to 25 % with detergent D and from 50 % to 18 % with the capsule; milk from 78 % to 56 % and from 74 % to 50 %. Item verdicts do not change. Eco 50 is not disturbed (45 against 46 soiled items clean of 68, inside the seed scatter).
- With a 55 C wash the enzyme parameters hardly matter (1 to 4 % of the egg left under all of them): the two unknowns are one question, and it only exists if the wash exceeds about 60 C.
- The half-life is the largest lever on a 65 C wash: 2 % to 76 % of the egg left across its range.
- Two other seed pairs give the same masses within a point and the same zero verdicts.
- Minced meat follows the same pattern and does come clean in the favourable cases (3 of 3 items).
- Diagnostic, not a programme: the staged 55 C course with the post-wash lengthened by 30 and 60 minutes (main wash 95 and 125 min) gives 1 and 7 egg items clean of 17 with detergent D, 0 and 5 with the capsule, and no milk glass. In this model a clean egg plate needs a main wash of about two hours.
- The capsule does no better than detergent D in the model: its protease response saturates at 1.5 times the reference rate against 1.4 for detergent D at the anchored level, while published washes show a capsule clearing baked crème brûlée in a 30-minute cycle that detergent D only half-clears in a 197-minute one [VERIFIED, Tewes et al. 2024, TSD 61(5)].

Liquor in the main wash (same washes): as written, peak 65.0 C, 55 / 49 / 35 min at or above 45 / 55 / 60 C, protease 99 to 18 mg/L (D) and 160 to 29 mg/L (capsule) three minutes before the drain. Staged to 55 C: 47 / 0 / 0 min, 99 to 74 and 160 to 118 mg/L. Energy 1.038 and 0.963 kWh.

## 4. What remains unknown

1. The half-life of any protease in a real dishwashing liquor at 55 to 70 C. The one paper that measures it (Roldán-San Antonio et al. 2024, Chem. Eng. Sci. 287, 119767) could not be opened by either researcher or by me.
2. The owner's capsule: protease grade, activity and dose ("subtilisin, under 1 %").
3. The course of Auto on the 2021 platform: wash target, pauses, whether the pre-rinse water is exchanged, the final-rinse temperature, and every sensor threshold. No log of an identified BSH machine was found.
4. Why the model needs two hours for an egg plate when test institutes grade Auto as high as Eco on the sister machines ("sehr gut" in both, KONSUMENT 10/2021 [VERIFIED]) and Which? measures 83 % against 79 % [VERIFIED]. This is outside both dossiers. Candidates on the soil side, none checked here: the spread of the layer (the thickest places take about four times the mean), the reading of a thin residue as dirty, the fitted rate, and the unit of the protease level (detergent D's granulate may hold a fifth of the active enzyme the reference dose assumes; both contents unverified). The test institutes' soils are the standard's, dried as it prescribes, with a commercial tablet.
5. Milk: 7 to 8 % is left and at most 3 of 7 glasses are clean even on Eco 50.

## 5. The two measurements

1. **One ordinary Auto run, logged.** A metering plug at 10 s or faster, and a dishwasher-safe temperature logger in the upper basket. Read: minutes of heater before the long unheated stretch (about 11 means 45 C, 15 to 16 means 55 C, 19 to 21 means 65 C), whether they come in separate blocks, the logger's peak and its temperature at the wash drain, the final-rinse peak, total kWh. This fixes `washTarget`, the heat-up shape and `finalTarget`, and with them whether the enzyme question matters at all. `auto-programme-evidence.md` section 6 has the decision table.
2. **Egg-yolk plates on Auto and on Eco 50 with the owner's capsule**, prepared and dried the same way, photographed after each. Eco at 50 C fixes the rate and the dose response without any heat loss; Auto against it gives the loss at the logged temperature. If the Auto plates come out clean, the fault is on the soil side (item 4 above) and no enzyme parameter needs to move further.

## 6. Sources checked

Each dossier's "Fact-check" section lists every source re-opened and the result. Added by this check: Falkenberg et al. (2022), FEBS Open Bio 12, doi:10.1002/2211-5463.13457 (Savinase optimum in a 5-minute assay); Bosch operating manual 9000 460 846 (2009; three automatic programmes named by temperature range); Oeko-Test, 14 June 2024 (a maker's average figures for Auto). Derived figures: `rec/derive.py`, a working file that is not in the repository.
