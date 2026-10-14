# Protease parameters: what the evidence supports changing

> **Record of the build (10 October 2026).** A fact-checked recommendation on the protease
> parameters of the wash simulation, kept to what bears on Eco 50, the one programme the
> simulation washes on (`docs/design/scope.md`). Working files this note cites are not in the
> repository. The index of the documents is `docs/README.md`.

Fact-checker's recommendation, 2026-10-10. For the engineers who own `packages/sim-liquor` and `packages/sim-soil`. No code or parameter file was edited. It rests on the dossier `enzymes-at-temperature.md` and its "Fact-check" section.

Tags: [VERIFIED] read in an opened source; [ESTIMATED] derived, inputs given; [ASSUMED] no source.

## 1. In brief

1. **One change of a default is supported: the protease activity mid-point, `soil.enzymeTm`, from 63 to 75 C.** With a 30-minute half-life at 60 C beside it, the present value counts the same heat loss twice.
2. **No other default should move on desk evidence.** The protease half-life (30 min at 60 C) lies inside a verified bracket of 3 minutes to about 2 hours and nothing places it better.
3. **On Eco 50 the two unknowns move the amounts little.** Its main wash runs at 50 C. Across every value tried, 0.0 to 0.1 % of the egg yolk and 7.0 to 7.9 % of the milk are left on the standard load, while 9 to 13 of 17 egg items and 0 to 3 of 7 milk glasses come out clean (section 3).
4. **One measurement settles the rate and the dose response:** egg-yolk plates washed on Eco 50 with the owner's capsule.

## 2. Recommended changes

| Parameter or setting | Current | Recommended default | Range | Tag | Reason |
|---|---|---|---|---|---|
| `soil.enzymeTm` (protease activity mid-point) | 63 C (50 to 90) | **75 C** | 63 to 85 | [ESTIMATED] | The half-life law already removes the enzyme above 60 C; a mid-point at 63 C halves its activity a second time at 65 C. Savinase with calcium keeps 69 % through 10 min at 70 C [VERIFIED, US 5,677,163]. The half-life law alone reproduces the published 5-minute optimum of 60 C [VERIFIED, Falkenberg et al. 2022]; with both it falls to 55 C |
| `liq.proteaseHalfLife` at 60 C, default | 1800 s | unchanged | | [ESTIMATED] | Savinase at pH 10: 2.8 to 3.0 min desalted without calcium, 83 to 135 min with 50 mM calcium [VERIFIED as buffer values]. A liquor lies between; nothing measured in a liquor was found |
| `liq.proteaseHalfLife`, registered range | 600 to 14400 s | default unchanged | **180 to 14400 s** | lower bound [VERIFIED] as a buffer value | The registry cannot express the calcium-free end today (a set with 180 s is rejected) |
| `liq.proteaseHalfLife`, owner's capsule | 1800 s or 7200 s in the two owner sets | no default; keep both sets as a bracket | 1800 to 14400 s | [ASSUMED] | No measurement. The household-machine study cited for stability cannot tell 30 from 90 minutes (a 28-minute wash peaking at 64 C leaves 40 to 53 % against 74 to 81 % of the enzyme) |
| `liq.proteaseEd` | 200 kJ/mol (100 to 300) | unchanged | unchanged | [ESTIMATED] | 142 to 188 kJ/mol from two temperatures; two points of error on one reading widen that to 142 to 238. The proposed 170 is not a supported change |
| Owner set `anchored-v2.owner-tablet.savinase.json` | mid-point 63 C | regenerate after the first row; it then differs from its sibling by the half-life only | | | Both owner sets carry 160 mg/L of protease (0.05 kg/kg, 12.9 g, 4.0 L), not the 80 mg/L the enzyme dossier computed with |

Not recommended, because the evidence does not carry them: a capsule half-life of 5400 s as a default; `liq.proteaseEd` 170 kJ/mol; a change of `liq.xProtease` for the capsule or of the amylase values.

## 3. What the changes do on Eco 50, in whole washes

Script: `rec/auto.ts` (a working file of the session, not in the repository), run from `packages/calibration`. It calls the repository's `wash` (machine timeline and thermal model, `sim-liquor`, `sim-soil`, inspector) on the settled standard load of the anchoring: official tier, level seed 1, simulation seed 1, exposure from the anchoring's frozen water side (`97aa4d392843`; all exposure sets cached).

- **D**: `anchors/anchored-v2.json`, 20 g of reference detergent D.
- **Capsule**: `anchors/anchored-v2.owner-tablet.savinase.json` (the capsule's composition from `detergents/finish-powerball-ultimate.json`, protease level scaled as the anchoring does), 12.9 g.

Each cell: egg yolk left / milk left, as a share of the dry mass, and in brackets the egg items (of 17) and milk glasses (of 7) clean.

| Parameter set | Eco 50 |
|---|---|
| D, today (30 min, 63 C) | 0.0 % / 7.2 % (12, 3) |
| **D, mid-point 75 C (recommended)** | 0.0 % / 7.2 % (11, 3) |
| D, 75 C, half-life 10 min (registry minimum) | 0.1 % / 7.9 % (9, 0) |
| D, 75 C, half-life 2 h | 0.0 % / 7.0 % (13, 3) |
| Capsule, today (30 min, 63 C) | 0.1 % / 7.8 % (9, 0) |
| **Capsule, mid-point 75 C, half-life 30 min** | 0.1 % / 7.9 % (9, 0) |
| Capsule, 75 C, half-life 90 min | 0.1 % / 7.8 % (9, 0) |
| **Capsule, 75 C, half-life 2 h** (the "heat-stable" owner set) | 0.1 % / 7.8 % (9, 0) |

Reading:

- The recommended change does not disturb Eco 50 (45 against 46 soiled items clean of 68, inside the seed scatter).
- The capsule does no better than detergent D in the model: its protease response saturates at 1.5 times the reference rate against 1.4 for detergent D at the anchored level, while published washes show a capsule clearing baked crème brûlée in a 30-minute cycle that detergent D only half-clears in a 197-minute one [VERIFIED, Tewes et al. 2024, TSD 61(5)].

## 4. What remains unknown

1. The half-life of any protease in a real dishwashing liquor at 55 to 70 C. The one paper that measures it (Roldán-San Antonio et al. 2024, Chem. Eng. Sci. 287, 119767) could not be opened by either researcher or by me.
2. The owner's capsule: protease grade, activity and dose ("subtilisin, under 1 %").
3. Milk: 7 to 8 % is left and at most 3 of 7 glasses are clean on Eco 50.

## 5. The measurement

**Egg-yolk plates on Eco 50 with the owner's capsule**, prepared and dried the same way, photographed after the wash. Eco at 50 C fixes the rate and the dose response without any heat loss. (Run on 10 October as the owner's wash 01: `docs/calibration/owner-wash-01-egg-yolk.md`.)

## 6. Sources checked

The "Fact-check" section of `enzymes-at-temperature.md` lists every source re-opened and the result. Added by this check: Falkenberg et al. (2022), FEBS Open Bio 12, doi:10.1002/2211-5463.13457 (Savinase optimum in a 5-minute assay). Derived figures: `rec/derive.py`, a working file that is not in the repository.
