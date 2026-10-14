# Fitting the wash simulation to real washes

How wash records (`wash-record.md`) become better parameters, and how to tell which wash is worth
running next. The code is `packages/calibration`; the numbers quoted here are the output of its
study scripts on the reference machine, a MacBook Pro (Apple M3 Pro, 18 GB), reported in
section 9. Paths written as `src/...`, `scripts/...`, `examples/...` and `anchors/...` are
relative to `packages/calibration`.

Every command below is run as `pnpm --filter @spotless/calibration spotless-fit <command> ...`
(section 8).

## 1. The loop

1. Place the load in the game client as you loaded the machine, start the cycle, and turn the
   manifest into a planned record (`from-manifest`). Or write the record by hand, or start from
   `examples/egg-tiles-interrupted.planned.json`.
2. Before running anything, ask what the wash can teach: `sensitivity` for one record, `rank` for
   several candidates. A wash whose predictions do not move with the parameters you care about is
   not worth two and a half hours.
3. Run the wash. Fill in the values, the dose, the course of the run. `validate`, then `predict`.
4. `fit` the parameters the records can identify. Read the report: what moved, what was returned
   to its prior, whether the predictive check passes.
5. Use the fitted set. `params.json` holds the keys of the wash simulation and is the `--params` of
   the next fit (the calibration keys in `calibration.json` beside it are read with it). Its
   `overrides` are the `params` of a wash description (`spotless-wash`) or of `WashInput` **only if
   no `prog.*` or `cal.*` key was fitted**: a fitted main-wash temperature is not a key of the wash
   simulation, and `params.json` alone then does not reproduce the fit (section 5.6). Go to 2 with
   the fitted set as the starting point.

## 2. Observation models

A fit compares observations with what the simulator predicts for them, so each kind of
observation needs a rule that turns the simulated residue into a predicted value, and a statement
of how far a real observation scatters about it. Both are in `src/observation.ts`. Each model has
one scalar prediction `eta` and a distribution of the observed value about it; its constants are
registered parameters (`obs.*`) and can be fitted like any other.

| Kind | Prediction `eta` | Distribution of the observation | Constants |
|---|---|---|---|
| `score` | the IEC score an observer is expected to give, `s*` (below) | ordered probit: `s*` plus normal noise, rounded to 0..5, the end classes taking the tails | `obs.scoreSd` 0.6, `obs.visibilityLogSd` 0.3 |
| `area_fraction` | expected visibly soiled area over the area soiled at the start | normal about `eta`, piled up at both ends: an observation within `obs.areaEndTolerance` of 0 or 1 is read as "nothing left" or "all left" and given the probability of the tail (a two-sided Tobit model) | `obs.areaModelSd` 0.05, `obs.areaEndTolerance` 0.01, `obs.visibilityLogSd` 0.3 |
| `visible_area` | expected visibly soiled area, mm2 | ln(observed + floor) is normal about ln(`eta` + floor), variance = stated sd^2 (of that logarithm, or what a stated range stands for) + `obs.areaLogModelSd`^2 | `obs.areaFloorMm2` 5 mm2, `obs.areaLogModelSd` 0.5, `obs.visibilityLogSd` 0.3 |
| `residual_mass` | dry residue, mg | normal, variance = stated sd^2 + (`obs.massModelRel` x `eta`)^2 + `obs.massModelAbs`^2 | 0.1, 0.5 mg |
| `mass_fraction` | dry residue over dry soil applied | normal, variance = stated sd^2 + `obs.massFractionModelSd`^2 | 0.05 |
| `specks` | count of separate visible specks | negative binomial, mean `eta` + `obs.speckFloor`, dispersion `obs.speckDispersion` | 0.2, 2 |
| `clean` | the margin of the inspector's verdict in standard deviations (below): positive exactly when the inspector says clean | Bernoulli: P(clean) = e + (1 - 2e) Phi(`eta`), e = `obs.cleanMisjudge` | 0.02 |
| `retained_water` | water standing in the item, mL | normal, variance = stated sd^2 + (`obs.waterModelRel` x `eta`)^2 + `obs.waterModelAbs`^2 | 0.3, 0.5 mL |

The stated sd of an observation is the instrument (the balance, the segmentation of the
photograph). The `obs.*Model*` terms are what the model does not explain even with perfect
instruments: uneven application, the difference between a seeded soil layout and the real one.
They keep a precise balance from dominating a fit, and they are what the posterior predictive
check tests (section 5.5).

**Visibility: verdicts and scores follow the inspector.** The inspector calls a soil cell visibly
soiled when its visibility index I (residue over visibility threshold) reaches 1, adds up the area
A of those cells, and compares A with the bands of the IEC table and with the limit of the clean
rule (4 mm2). A real observer's threshold is not exactly the inspector's. It is taken to be the
inspector's times a factor tau, **one factor for the whole target**, with ln tau normal of
deviation `obs.visibilityLogSd` (0.3: an observer sees a residue 30 % thinner, or needs one 30 %
thicker). The area such an observer sees, A(tau), falls as tau rises, so "A(tau) is within a limit
L" holds exactly for tau above a threshold tau*(L): the index of the cell at which the cells,
taken from the most soiled down, first cover more than L. With c(L) = ln tau*(L):

- the inspector finds the area within L exactly when c(L) < 0;
- an observer does with probability Phi(-c(L) / `obs.visibilityLogSd`).

The evaluator computes c(L) for each band and for the clean limit from the same element table the
inspector reads. From them: the **score by area** is the number of bands an observer is expected to
find the area within, `s_A = sum over the bands of Phi(-c / sd)`: the inspector's own score
wherever every band is passed or failed with a margin, and half way between two scores where the
inspector steps. The **score by specks** `s_n` is the table made continuous in the inspector's own
count (4.5 at half a speck, 3.5 at 4.5, 2.5 at 10.5, ending at 2), and `s* = min(s_A, s_n)`. The
**clean margin** is `min(-c(4 mm2) / obs.visibilityLogSd, (s_n(n) - s_n(4.5)) / obs.scoreSd)`, or
a large negative number when the item holds more water than the rule allows; P(clean) is above
one half exactly when the inspector says clean (tested on films of every kind and on a soiled
load, `observation.test.ts`, `evaluator.test.ts`).

An earlier version predicted verdicts and scores from a soft area in which every cell counted
with a weight between 0 and 1. For a thin uniform film just under the threshold (tea in a mug)
every cell then counted about half, so 14,000 mm2 that the inspector calls clean were predicted
not clean with near certainty, and a fit to clean flags would have driven the residue far below
the game's own threshold. That is what the single factor for the whole target avoids.

**The expected visible area** (for `area_fraction`, which a photograph measures) is the mean of
A(tau): a cell counts with weight Phi(ln I / `obs.visibilityLogSd`), one half at the inspector's
threshold. It is smooth in the parameters where the cells cross the threshold one after another.
The verdict and the score of a uniform film are not smooth, and should not be: the inspector's
are a cliff there. Speck counts and the `clean` and `score` fields of a prediction's state are the
inspector's own.

**Gross errors.** A mistyped weight, a tile that was shadowed by another, a photograph of the
wrong item: with a plain normal likelihood one such value drags the estimate and the interval
still says "identified" (one value of 1.0 among eight where 0.165 was true moved the estimated
rate from 3.0e-5 to 1.9e-5 with an interval that excluded the truth in 100 of 100 runs). Every
weighed, photographed or measured value (`residual_mass`, `mass_fraction`, `area_fraction`,
`retained_water`) therefore has, with probability `obs.outlierShare` (0.03), a density that is
uniform over the admissible range of the observation (1 for an area fraction, 1.5 for a mass
fraction, 1.5 times the dry soil applied for a weighed residue, `obs.waterSpan` = 250 mL for
water) in place of the model's. The likelihood is the mixture, so one wrong value costs at most
ln(0.03 / range) and does not pull; the fit reports for every observation the posterior
probability that it is such an error. With the allowance the same test gives a mean estimate of
3.00e-5, the truth inside the interval in 91 of 100 runs (96 of 100 without the wrong value), and
the wrong value named in 100 of 100. `obs.outlierShare` = 0 switches it off. Synthetic records
are drawn with it, as the model says.

**Small areas.** When a wash nearly succeeds, what is left of a soil that covered 200 cm2 is
some tens of square millimetres: an area fraction of a thousandth, which the model of
`area_fraction` (a deviation of 0.05, everything within 0.01 of the end read as "nothing left")
cannot tell from a spotless plate. `visible_area` compares the area itself, in ln(area + floor):
factors above the floor, nothing below it. `obs.areaLogModelSd` (0.5) is what the model does not
explain there: where the thick places of a soil lie. It was measured on the model, as the
standard deviation of ln(area + 5 mm2) over eight layout seeds of the four plates of owner wash
01 at one parameter set: 0.15 to 0.60.

**Inputs that were not measured.** A record may name scenarios of its inputs (`sim.scenarios`,
wash-record.md section 7a: amounts that were not weighed, where the thick places lay). Every
evaluation replays each scenario, and the likelihood of the fitted observations of an item is
the weighted mean of their joint likelihood over the scenarios:
`ln sum_k w_k prod_o p(y_o | eta_o,k)`. The table of a `predict` or of a fit shows the nominal
scenario; `perObservation` holds each observation integrated on its own. The derivatives of
section 5.2 are those of the nominal scenario, with the spread of ln(area + floor) over the
scenarios added to the stated uncertainty of a visible area; the profiles of section 5.5 use the
likelihood itself and are the intervals to rely on for such a record.

**Observations that are not fitted** (`"fitted": false`) are predicted and reported and enter
neither the likelihood nor the information nor the predictive check.

**Targets.** An observation is about a whole item, one region, or one soil (the patch or regions
it was applied to). The same element table and the same inspector as the wash itself are used for
each, restricted to the target.

**Times.** An observation with `at_s` is read off the soil state at the first tick at or after
that time in the same replay; one replay serves every time of a record.

## 3. The objective

`log posterior(z) = sum over records w_r sum over observations log p(y | eta(theta(z))) + sum over
parameters -1/2 ((z_j - m_j) / s_j)^2` (`src/objective.ts`).

**Transforms.** Each parameter is fitted in a coordinate `z` in which a normal prior is
reasonable: the **logit** for a fraction (a range of exactly 0 to 1); the **logarithm** for a
positive scale-like quantity (a registered logarithmic range, a positive range spanning a factor
of four or more, or a range that starts at 0 whose default lies a factor of four or more below
its upper end, such as `liq.xProtease`: the fit then keeps to a floor of the default over ten, or
the default squared over the upper end if that is lower, in place of 0); the value itself
otherwise.

**Priors from the registry.** The registered range is the statement of where a value may lie,
and the prior is made to agree with it: a normal in `z` centred on the registered default and cut
off at the ends of the range, whose deviation is the distance from the centre to the **farther**
end of the range times a factor set by the confidence tag: 1 for VERIFIED and MEASURED, 1.25 for
RECALLED, 1.5 for ESTIMATED, 2 for SYN. No end of a registered range is therefore more than one
prior deviation from the default: the prior is close to flat over the range (the far end of the
range of a VERIFIED default costs half a log unit against the default, of an ESTIMATED one a
quarter), and a default on an end of its range gives a half-normal. `spotless-fit params` lists
every parameter with its transform, range, centre and deviation. A prior can be replaced per
parameter (the `priors` option of `fitRecords`), which is how the result of one campaign becomes
the prior of the next.

Why so wide. The defaults are literature values for other machines, and the one literature
record in `examples/` already shows them to be far off for egg yolk on this class of machine. A
prior that is narrow against the range makes a truth far from the default nearly impossible
however many records say otherwise, and the stated intervals then miss it:

| Prior deviation | Farther end of the range at | What was measured (section 9.1) |
|---|---|---|
| first version: a quarter (VERIFIED) to three quarters (SYN) of half the range | about 4 deviations (up to 5.7) | truths near the ends of the ranges inside the stated 95 % interval in 9 and 10 of 18 cases; near the defaults 15 of 15 |
| a half (VERIFIED) to one (SYN) times the distance to the farther end | 2 deviations | truths at 10 % of three ranges at once: the lag inside its interval in 14 of 20 fits (5 of 20 for the normal interval); the other eight cells 19 or 20 of 20 |
| as it is now: 1 to 2 times that distance | 1 deviation | section 9.1 |

The tag now says only how hard the default pulls when the records say little. The price is that
the prior no longer steadies a weakly determined fit: along a direction the records leave open
the estimate goes where the noise puts it, and it is the interval, not the prior, that has to say
so (profiles, section 5.5).

What the tags do not do: a VERIFIED default with a generous registered range still gets a wider
prior than an ESTIMATED one with a narrow range. The range, not the tag, is where that should be
corrected (in the registry).

**Constants a standard defines** (`inspect.*`: the IEC bands, the area, specks and water of the
clean rule) are not fitted unless asked (`allowStandardKeys`, `--allow-standard`).

**Weights.** A record's log likelihood is multiplied by its `weight`: 1 for a measured record,
`obs.literatureWeight` (0.25) for a literature record that states none.

**A record's own parameters.** What a record states about its own wash (`sim.params`, the
temperature and time of its heat histories, the bicarbonate of its water) is applied on top of the
set being fitted, for that record only: it is data about that wash and the fit does not move it.

## 4. What one evaluation costs

### 4.1 Preparation and replay

`prepareRecord` (`src/evaluator.ts`) does once per record what does not depend on the parameters
being fitted: the machine with its measured values, the programme adapted to the measured course,
the scene, and the exposure of every spray state. The exposure is obtained by running the
simulator's own `wash()` on the load without soils against the exposure cache and reading the
sets back by the keys its result names; the evaluator does not know how exposure is computed and
did not change when the stand-in stages were replaced by the real ones during this work. A
summary of that wash is kept in the cache, so a load is washed once per set of water parameters,
however often it is prepared (also across runs of the command, with the cache on disk).

`evaluate(params)` then lays the soil down (`initSoil`), replays the programme (`createWashSoil`,
`createWashLiquor`, `replayWash`) and reads the predictions off the soil state. Only observation
constants changing (`obs.*`) costs no replay at all.

### 4.2 What a replay is restricted to, and what that ignores

| Restriction | What it does | Exact? | What it ignores |
|---|---|---|---|
| Observed items only (default) | Only the soils of items that have an observation are replayed | Exact for those items but for the liquor: deposits act on each other only through it | Soil washed off the other items no longer loads the liquor, where it consumes peracid (`liq.kSoil`) |
| ... with background (default) | The other soils are replayed once; what they release into the sump is fed to every later replay as a fixed history | Exact at the parameters the background was computed at (those of the first request to the pool, until it is moved), nearly so near them. Away from them: 3e-3 in a mass fraction and up to 0.04 in an area fraction on a settled 60-item load after six bleach, enzyme and rate keys were moved (half a deviation of an area observation) | The change of that history with the parameters being fitted. A fit therefore computes the background again at its estimate and minimises again (`refineBackground`, twice by default), leaves the background at the estimate, and compares the restricted with the full prediction there in its report (section 5.4). `PreparedRecord.backgroundAt()` says where the background stands; a shared pool gives predictions that depend, within that error, on what it was asked first |
| Patches | A soil on a described patch is laid on its region by the soil stage and cut down to the cells of the patch, with the weighed amount on them | Exact dry mass; the outline to one soil cell | Sub-cell shape of the outline |
| `thin: k` (off by default) | One soil cell in k is replayed; masses and areas are scaled back up | Mass and area fractions keep their expectation (tested: within 0.03) | Speck counts, scores and clean verdicts, which hang on single cells and their neighbours |
| One time per record | Observations during the run are snapshots of one replay | Exact to one tick (about 2 s) | The pause and the cooling of an open door |

### 4.3 Parameters that change the water

Anything in the `hydro` group (nozzle and jet closures, splatter, film, contacts) needs a new
exposure for each value. Three things keep that affordable:

- **`EvaluatorPool`** keeps one preparation per record and set of water parameters (a record is
  recognised by what a preparation depends on: its machine, programme, load and observation plan,
  not its id; the observed values are taken from the record a likelihood is asked about, so
  records that differ only in what was observed share a preparation and are each scored against
  their own values), shares the
  scene between preparations whose geometry and `scene.*` parameters agree, and the exposure
  cache keeps every set ever computed.
- **`fitWithWaterParameters`** (`spotless-fit fit --water key,key`) is the outer loop: a design of
  2m + 1 points around the current water parameters, the replay-time parameters re-fitted at each
  (a short Nelder-Mead from the centre's values), a parabola per water parameter through its three
  points, a step to the vertex, the step halved, twice by default. That is about 2 (2m + 2)
  exposures per record for m water parameters, against hundreds of replays.
- **Replay-time scales.** Where a scale of the water model multiplies a column of the exposure
  tables and nothing else, fitting it needs no new exposure: `cal.jetShearScale` multiplies the
  peak and mean wall shear of the jets, `cal.filmShearScale` the film shear, `cal.holdTimeScale`
  the time a surface stays wet after the spray stops, all applied to the cached tables at replay
  time. `spotless-fit check-scale record.json --scale cal.jetShearScale` computes the exposure at
  two values of the registry key the scale stands for (`jets.kStag`) and compares the tables
  column by column; where it reports "exact", the scale can be fitted as a replay-time parameter
  and folded into the key afterwards (`foldReplayScales`). The result of that check on the
  exposure code as it stands is in section 9.4, with the request it leads to.

The programme parameters (`prog.mainWashTargetShift`, `prog.mainWashHoldScale`,
`prog.finalRinseTargetShift`) rebuild the schedule, not the exposure, as long as the spray states
(pump speeds and water-switch positions) stay the same. They let a record without a measured
course carry a difference in temperature or hold as nuisance.

The soak of Eco 50 (`prog.soakDuty`, `prog.soakCycle`, `prog.soakFrom`) is of the same kind and belongs to
another package: these are keys of the wash simulation itself (`@spotless/sim-hydraulics`), which
lay the same spray states out over other times. A replay builds its schedule again when one of
them differs from the preparation's (`SCHEDULE_KEYS` of `evaluator.ts`), so they are fitted like
any soil-side key, and a fitted value is written into `params.json`, not into
`calibration.json`: `wash()` reads it. (Until 11 October 2026 the tool took every `prog.*` key
for one of its own: a fitted soak duty would have been left out of the parameter file and a
fit would not have moved the schedule.)

## 5. Fitting

`fitRecords(records, keys, options)` (`src/fit.ts`); `spotless-fit fit`.

### 5.1 The estimate

The maximum of the log posterior, by the **Nelder-Mead simplex with restarts** (`src/optimise.ts`)
in the transformed coordinates, bounds by clipping.

Why this method: the objective has few dimensions (2 to 10) and is expensive per evaluation (a
replay per record: 0.2 s for test tiles, tens of seconds for a full load); it is only piecewise
smooth (soil that is gone is gone, a jet exceeds a threshold or does not, a count steps); its
gradient is not available. A simplex search uses function values only, compares them and never
differences them, starts with n + 1 evaluations and takes one or two per step, and is
deterministic. Its known failures are a simplex that folds flat (against a bound, or along a
valley) and a stop at a kink. Both are met by restarting from the point reached with a fresh
simplex of half the size until a restart no longer improves, by starting from several points, and
by a check after the fact: the derivative evaluations around the optimum (section 5.2) also see
any neighbouring point that is better, and restart the search from it. A population method
(CMA-ES) is more robust on a rugged objective but needs hundreds of evaluations per parameter,
which a record with a full load cannot afford; a gradient method would need the gradient across
those kinks.

The search runs in this order:

1. **Starts**: the current values, and a seeded Latin hypercube over the ranges (`--starts`, 4). All are evaluated; the best `--polish` of them (3) are minimised too, one
   simplex each. With a load whose replay takes many seconds, `--polish 1` is the economical
   choice.
2. **Without the allowance for gross errors first.** Far from the data every observation looks
   like a gross error, and the log likelihood with the allowance is flat there. The first
   minimisations therefore use the plain normal likelihood, which has a slope everywhere; from
   every distinct point they reach, a second, short minimisation uses the log posterior itself.
3. **A scan for a second hump**: each parameter is walked across its whole range on 24 points
   (`--scan`), the others held. A hump separated from the estimate by a dip of half a log unit
   is minimised from as well.

**Other local optima.** Every distinct point a minimisation ended at (more than three posterior
deviations from the estimate in some parameter) and within 5 log units of it is listed in the
report with its log posterior, under a warning that the intervals describe the estimate's hump
alone. In the test with two exact optima (`fit.test.ts`) the second is found in every seed, by
the starts or, without starts, by the scan.

### 5.2 Uncertainty from the local curvature

At the optimum every prediction is differentiated to every parameter by central differences.
With the Fisher information of each observation model that gives
`F = sum w i (d eta/dz)(d eta/dz)^T`, and the covariance of the estimate is `C = (F + P)^-1` with
the prior precision P. This is the Gauss-Newton form of the curvature of the log posterior: 2n
evaluations instead of 2n^2, never indefinite, and it does not difference the objective twice
across its kinks. The second difference of the log posterior along each parameter comes free
with the same evaluations and is reported beside it (`curvatureSd`).

**The step is chosen from the answer.** Where soil is being removed a prediction can cross its
whole range within a fraction of a prior deviation (a score went from 1.5 to 5 over a quarter of
a prior deviation of `liq.xProtease`), and a fixed step of a tenth of a prior deviation then
averages the slope away: the reported deviation of `liq.xProtease` was 0.042, 0.157 or 0.016 of
the prior's with steps of 0.1, 0.01 and 0.5. The derivatives are therefore taken first with a
step of 0.1 prior deviations, the posterior deviations computed, and taken again with a step of
half the posterior deviation of each parameter (never above the first step, never below 0.005
prior deviations) until no posterior deviation changes by more than 10 %, at most four rounds.
The report prints the step used per parameter and says so if the deviations had not settled.

The report gives each parameter's estimate, its 95 % interval, how far it moved from its prior
centre (in prior deviations and as a share of its range), the ratio of posterior to prior
deviation, the step, and a verdict.

### 5.3 What the records cannot identify, and what they exclude

A parameter whose prior variance the records reduce by less than a quarter **at the optimum** is
a candidate to go back to its prior centre (between a quarter and three quarters it is **weak**).
That verdict is local, and it is not trusted alone. On a plateau, where soil barely comes off and
every prediction is near 1, nothing is locally sensitive, and yet the records may exclude the
prior centre outright: the first version put all three parameters of such a fit back at the
registry defaults, 237 log-likelihood units below the optimum it had found, and reported them as
"prior returned" with intervals that excluded the truth. The fit now:

1. puts the candidates back, minimises the others again, and **compares the log posterior** with
   that of the optimum. The reset is kept only if it costs less than 0.5 (`resetTolerance`);
2. otherwise tries the candidates one by one, the least informed first, and keeps those that cost
   nothing;
3. leaves what cannot go back at the optimum, with the verdict **"not locally identified, but
   the records exclude the prior centre"**.

For every parameter the report also gives the fall of the log posterior when that parameter
alone is put at its prior centre (`priorCentreDrop`). It sees one-sided information that the
derivatives do not: a value the records rule out without saying what the value is.

A returned parameter's interval is the prior's. Pairs whose posterior correlation is beyond 0.8
are listed as **confounded**: the records fix a combination of them (the identifiability table
shows which), not each. The parameter table and the identifiability table print the same verdict
per parameter.

**Prior against records.** The report states, per parameter, how far the prior holds the
estimate from where the records alone would put it (`priorPull`, in posterior deviations,
linearised: `F delta = P (z - m)`), and flags a pull beyond 2 as a prior-data conflict, with the
value the records alone point to and the log likelihood they could gain.

**An estimate on a bound** of its registered range, with the log posterior still rising towards
it, is reported as "at the upper (lower) bound of its range" in the table and in a warning at the
head of the report, with a one-sided interval from the profile on the inner side. It usually
means that the model, or a parameter that was held fixed, is wrong (a main wash 6 K cooler than
the programme says puts a fitted egg-yolk rate on its upper bound).

### 5.4 The background of a restricted replay

When only the observed items are replayed (section 4.2), what the other soils release into the
liquor is a history computed at one parameter set. After the minimisation the fit computes it
again at the estimate and minimises again from there, up to twice (`refineBackground`), and
leaves it at the estimate. It then replays every soil once at the estimate and reports the
largest difference between the restricted and the full prediction, in deviations of the
observation, and how much the log posterior moved the last time the background was moved; either
being large is flagged with the advice to fit with `--restrict all`.

### 5.5 Profiles and the predictive check

**Profiles** (`--profiles n`, default the three most informative parameters, and every parameter
on a bound): the log posterior maximised over **all** the other parameters (those returned to
their priors too) on a grid of the parameter, and the interval where 2 (L_max - L) <= 3.84. The
grid has four points 0.7 posterior deviations apart on each side and then goes on, each step
twice the one before, until the log posterior has fallen that far or the bound of the range is
reached; the end of the interval is then looked for between the last point inside and the first
outside, up to three times (next to a kink the log posterior can fall by many units within one
step). The re-fits start where the local covariance says the other parameters follow, with a
simplex of their posterior deviations. If a re-fit finds a point better than the estimate by a
quarter of a log unit, the fit is minimised again from there and the analysis repeated once; a
better point found even then is reported as "the optimum is not settled". It does not assume the posterior is normal: it shows a flat or one-sided parameter for
what it is, and it follows a curved ridge of equally good fits that the derivatives at the
optimum know nothing of.

**The interval of a profiled parameter is its profile's** (marked `(p)` in the table; an end the
profile does not find before the bound is the bound). The normal interval, z +- 1.96 sd, is
printed beside it, and a difference of more than 30 % on either side is flagged: there the
normal one is wrong. This matters in practice. With the soil barely coming off, several
combinations of rate, lag and enzyme life fit the same tiles; the optimum sits at the one the
priors prefer and the normal interval there can be a third of the width of the ridge (section
9.1, truths at 10 % of the ranges). Parameters that are not profiled keep the normal interval:
profile what you will rely on (`--profiles n` or the `profiles` option with names). A profile
costs up to 26 short re-fits of the other parameters, usually 8 to 12.

**Posterior predictive check** per record (`--draws n`, default 20, on by default in `fitRecords`
too): parameters are drawn from the normal approximation, replicated observations are drawn at
each from the observation models, and the deviance of the real observations is compared with
that of the replicated ones. A p near 0 says the record scatters more than the model allows (a
systematic misfit, or `obs.*Model*` constants that are too small). The observations beyond three
deviations are listed, and separately those more likely a gross error than not (section 2); the
table of observations gives that probability for each.

### 5.6 Output

`--out dir` writes:

- `params.json`: the fitted set **in the parameter registry's own format** (`spotless.params`
  version 1: overrides, the definitions they were written against, provenance with the wash
  records used, and the two hashes `hydroHash` and `soilHash`). `readParamSet` of `@spotless/sim-params` reads it
  back and checks the hashes. The hash of the document is printed.
- `calibration.json`: the calibration's own keys that moved (`obs.*`, `cal.*`, `prog.*`), which the
  wash simulation does not have.
- `programme-<record>.json` and `wash-input-<record>.json`, per record: the record's programme with
  the fitted `prog.*` applied (a `ProgrammeSpec`), and the whole input of `wash()` that reproduces
  the fit to that record (machine with its measured values, configuration, that programme, the
  load with its soils, the overrides).
- `fit.json`: every number of the report. `report.txt`: the report as printed.

**`params.json` alone is not the fit when a `prog.*` or `cal.*` key was fitted.** A fitted
main-wash temperature (`prog.mainWashTargetShift`) lives in the programme, not in the parameter
registry: `wash()` with the overrides of `params.json` and the programme as written does not
reproduce the fit. So that this cannot happen silently:

- the fit report, the provenance note inside `params.json`, and the command's last line say so;
- `--params fitted/params.json` reads `calibration.json` beside it (or `--calibration file`), and
  warns when there is none;
- `spotless-fit wash record.json --params fitted/params.json` runs `wash()` on a record as the fit
  left it (the programme adapted, the calibration keys applied);
- `wash-input-<record>.json` is that input as data, for `wash()` directly. `spotless-wash` cannot
  read it yet: its description names a programme by id (requested of the simulator).

A test fits a rate and a main-wash shift, writes the files, and checks that `wash()` from the
written input returns the fit's own predictions to 1e-6 (`evaluator.test.ts`). `wash()` cannot
reproduce a soil on a described patch (it lays the soil over the whole region) or a `cal.*` scale;
the report names the records for which that is so.

## 6. Sensitivity and identifiability

`spotless-fit sensitivity records... --fit keys` (`src/sensitivity.ts`) needs no observed values:
the Fisher information of a record is the information a run of it will have, so it works on
planned records.

It prints two tables. The first has one row per parameter:

| Column | Meaning |
|---|---|
| sensitivity | Root mean square over the observations of how far a prediction moves, in standard deviations of its noise, when the parameter moves by one prior deviation |
| information | Fisher information about the parameter alone, in units of its prior precision |
| post/prior sd | Deviation after the records over deviation before, the other parameters free |
| if others known | The same if every other parameter were known. Small here and near 1 in the column before: confounded |
| contraction | Share of the prior variance removed. Verdict: identified from 0.75, weak from 0.25, else not identified |
| confounded with | Parameters whose posterior correlation with this one is beyond 0.8 |

The second lists the combinations of parameters (eigenvectors of the information in prior units)
with the information the records hold about each: "fixed by the records", "constrained", or
"left to the prior". The scaled sensitivity of every predicted observation to every parameter
follows as a matrix (`--out` writes all of it as JSON).

Both tables are **local**: properties of the parameter values the derivatives were taken at
(`--params`, default the registry defaults), with the step chosen as in section 5.2 (`--step`,
`--no-adapt`) and printed. Where the soil does not come off at those values, nothing is
identified there, whatever the wash could say elsewhere.

## 7. Which wash to run: experiment ranking

`spotless-fit rank candidates... --fit keys [--interest keys] [--existing records] [--draws n]`

Each candidate is a planned record: a load with soils and an observation plan. At one parameter
set, its expected gain of information about the parameters of interest is the fall of the entropy
of their marginal posterior in the linear-Gaussian approximation,
`gain = 1/2 [ln det C_SS(before) - ln det C_SS(after)]`, where "before" holds the prior and the
records already run (`--existing`) and "after" adds the candidate. The other fitted parameters
are nuisance: they take up information without counting.

**That number is a property of the parameter set as much as of the wash.** At the registry
defaults egg yolk barely comes off, and a double-dose wash ranked first (6.3 bits) with scoring by
eye last (0.0 bits); at a set inside the registered ranges where the tiles do come clean,
scoring by eye was worth 8.7 bits and the double dose 0.0: first and last places swapped. The
gain is therefore **averaged over parameter sets drawn from what is currently believed**: the
current values (`--params`) and `--draws` further sets (8) drawn by Latin hypercube from the
priors of the fitted keys, or, with `--posterior fit.json`, from the posterior of an earlier fit
about its estimate. The table gives per candidate:

| Column | Meaning |
|---|---|
| gain, +- | mean and deviation of the gain over the parameter sets, bits |
| least .. most | the smallest and the largest gain over them |
| place, led in | best and worst place over the parameter sets, and the share of them in which the wash came first |
| run as, adds | place in the greedy order on the mean gain (the best first, then the best given the first, so that the second wash complements the first), and what it adds there |
| sd | posterior over prior deviation of each parameter of interest after the wash alone, mean over the sets |
| UNSTABLE | the place moves by three or more over the sets, or the leader leads in fewer than half: the recommendation hangs on parameters not yet known |

`--draws 0` gives the local ranking at the current values alone, and the table says so in
capitals. A candidate costs one preparation (its exposure) and, per parameter set, 2n replays for
each round of the derivative step (up to four).

After a first fit the draws should come from its posterior (`--params fitted/params.json
--posterior fitted/fit.json --existing wash1.json`): the question is then which wash helps most
given what the first one taught.

## 8. Command line

```
pnpm --filter @spotless/calibration spotless-fit <command> [files] [options]

validate     <record.json>...                check records; machine changes; course comparison
predict      <record.json>                   prediction for every observation
fit          <record.json>... --fit a,b      fit, report, parameter files
wash         <record.json> --params file     wash() on a record as a fit left it
sensitivity  <record.json>... --fit a,b      sensitivities, Fisher information, identifiability
rank         <candidate.json>... --fit a,b   order candidate experiments
check-scale  <record.json> --scale cal.x     can a scale be applied at replay time?
manifest     <record.json>                   the record as the game's wash manifest
from-manifest <manifest.json> --id <id>      a planned record of a load placed in the game
params       [--group name]                  what can be fitted, with transforms and priors
```

Options: `--fit a,b` or `--group <calibration group>`; `--water a,b` (fit: the outer loop);
`--params file` (the starting set; `calibration.json` beside it is read too, or `--calibration
file`) and `--set key=value`; `--restrict all`; `--thin k`; `--cache dir` (default
`.spotless/exposure-cache` where the command was started) or `--no-cache`; `--out path`; for fit
`--seed`, `--starts`, `--polish`, `--scan`, `--profiles`, `--draws`, `--name`, `--allow-standard`;
for rank `--interest`, `--existing`, `--draws`, `--seed`, `--posterior fit.json`; for fit,
sensitivity and rank `--step x` and `--no-adapt` (the derivative step); `--quiet`. Relative paths
are taken from the directory the command was started in.

The library entry points behind them are `validateWashRecord`, `prepareRecord`, `fitRecords`,
`fitWithWaterParameters`, `sensitivity`, `adaptiveJacobian`, `rankExperiments`, `checkReplayScale`,
`washManifestFromRecord` and `recordFromManifest` of `@spotless/calibration`.

## 9. Studies

The study scripts are in `packages/calibration/scripts/`; every number in this section is their
output on the reference machine, a MacBook Pro (Apple M3 Pro, 18 GB), on the night of
10 October 2026. Three things about that night belong with the numbers:

- **Other work was running** on the machine throughout (load average 11 in the first hours, 80
  to 170 while sections 9.1 and 9.3 were run again), so timings are the best of three and are
  higher than they will be on a quiet machine.
- **The water model was being replaced while the studies ran.** The exposure stages went from
  stand-ins to the real jets, droplets and film (exposure schema 2), and their parameters kept
  changing. A study is consistent in itself (truth and fit use the same exposure), but numbers of
  different studies differ by what changed in between. Run the scripts again once the stages are
  frozen. The exposure cache is not keyed by the exposure code: use a fresh directory
  (`SPOTLESS_STUDY_CACHE`) after it has changed.
- **Sections 9.1 and 9.3 were run again after a review of the inference** (priors widened to the
  registered ranges, the allowance for gross errors, verdicts and scores that follow the
  inspector, the derivative step chosen from the answer, profile intervals, the ranking averaged
  over parameter sets). Sections 9.2, 9.4 and 9.5 are from before it: their counts of clean items,
  exposure comparisons and timings do not depend on those changes, their posterior-over-prior
  ratios (section 9.4) were computed with the narrower priors and would be smaller now.

Loads: the test tiles are 100 mm glazed tiles standing or lying at ten places in both baskets,
placed by rule (`tileRecord`). The "full load" is the 114-item lattice of
`packages/sim-scene/src/testing/full-load.ts` with the typical soils of every item on half of each
typical region: about 13 place settings on a regular lattice **without the loading physics**. The
physically settled standard loads of `packages/loader/loads` appeared during the night;
`recordFromManifest` turns one into a record, and sections 9.2 and 9.5 should be run again on
them.

### 9.1 Recovery and coverage (`study:recovery`)

Synthetic records are drawn from the simulator at stated parameters with the noise of the
observation models (gross errors at their 3 % included), and fitted starting from the registry
defaults. The question is whether the stated 95 % interval of each fitted parameter holds the
truth about 19 times in 20, **wherever in its registered range the truth lies**.

**Coverage across the ranges** (`study:recovery cover`). Ten tiles with a 20 mm disc of dried egg
yolk, weighed and photographed at 25, 40 and 60 min and at the end (80 observations). Three
parameters are fitted (`soil.egg_yolk.rateRef`, `liq.proteaseHalfLife`, `soil.egg_yolk.tLag`), with
the truth of all three at 10 %, at 50 % and at 90 % of their ranges (in the coordinate each is
fitted in), 20 noise seeds each: 60 fits with the defaults of `fitRecords` (three polished starts,
three profiles; the scan and the predictive check off).

| Truth at | Parameter | Truth | Inside the reported 95 % interval | Inside the normal interval | Estimate on a bound | Returned to prior | Mean post/prior sd |
|---|---|---|---|---|---|---|---|
| 10 % of each range | soil.egg_yolk.rateRef | 1.259e-5 | 20 of 20 | 20 of 20 | 3 | 0 | 0.39 |
| 10 % of each range | liq.proteaseHalfLife | 824.5 | 20 of 20 | 16 of 20 | 11 | 0 | 0.48 |
| 10 % of each range | soil.egg_yolk.tLag | 45.18 | 19 of 20 | 14 of 20 | 0 | 0 | 0.44 |
| 50 % of each range | soil.egg_yolk.rateRef | 3.162e-5 | 19 of 20 | 18 of 20 | 0 | 0 | 0.07 |
| 50 % of each range | liq.proteaseHalfLife | 2939 | 20 of 20 | 20 of 20 | 0 | 0 | 0.04 |
| 50 % of each range | soil.egg_yolk.tLag | 232.4 | 20 of 20 | 19 of 20 | 0 | 0 | 0.05 |
| 90 % of each range | soil.egg_yolk.rateRef | 7.943e-5 | 20 of 20 | 20 of 20 | 0 | 0 | 0.19 |
| 90 % of each range | liq.proteaseHalfLife | 10480 | 20 of 20 | 20 of 20 | 5 | 0 | 0.17 |
| 90 % of each range | soil.egg_yolk.tLag | 1195 | 20 of 20 | 20 of 20 | 0 | 0 | 0.01 |

**178 of 180 intervals hold the truth, and every one of the nine cells 19 or 20 of 20.** The
reported interval is the profile's (all three parameters are profiled). The normal interval at
the optimum, printed beside it, holds the truth in 167 of 180: it is right in the middle and at the
upper end of the ranges and too narrow at the lower end (14 and 16 of 20), where the soil barely
comes off and rate, lag and enzyme life can stand in for one another; the report flags a normal
interval that differs from its profile by more than 30 %. Two misses in 180 where nine would be
expected say that the reported intervals are, if anything, a little wide. At the lower end the estimate of the enzyme's life
sits on its lower bound in 11 fits of 20 and is reported as such; the truth (824 s against a
bound of 600 s) is inside the one-sided interval in all of them.

How it got there is the reason for the changes described in sections 3 and 5 (rows two to four
are this design and these seeds):

| State of the tool | Truth at 10 % | at 50 % | at 90 % |
|---|---|---|---|
| First version: narrow priors, normal intervals, a local verdict that could return the defaults (review; 6 seeds; truths near the lower ends, near the defaults and near the upper ends, not exactly these) | 9 of 18 | 15 of 15 | 10 of 18 |
| Priors with the farther end at two deviations; one polished start, one restart, no profiles (9 to 11 seeds) | lag 1 of 9, the others 17 of 18 | 31 of 33 | 33 of 33 |
| The same priors; three polished starts and profile intervals (20 seeds) | lag 14 of 20 (5 of 20 by the normal interval), the others 39 of 40 | 59 of 60 | 59 of 60 |
| As it is now (20 seeds) | lag 19 of 20 (14 of 20 by the normal interval), the others 40 of 40 | 59 of 60 | 60 of 60 |

What failed at the low end, in order: (1) with every prediction near 1 the local verdict put the
fit back at the defaults although the records excluded them; (2) the prior, narrow against the
range, outweighed 80 observations; (3) a single simplex from the defaults stopped in a side
valley (log posterior 59.4 where 64.7 was to be had), which the three polished starts and the
restart from a better point found by a profile repair; (4) rate, lag and enzyme life trade off
along a curved ridge there, and the normal interval at the optimum is a third of its width:
the profile follows it.

**What it costs.** 1040 to 1130 replays per fit of three parameters with three profiles: about
three minutes on a quiet machine at 0.18 s per replay; that night, twelve processes side by side
under load, 4 to 8 minutes per fit.

**Earlier cases**, run before the review with the first version's priors and likelihood, kept for
what they show about designs; their intervals were normal ones under narrower priors, and the
truths were chosen within 1.8 prior deviations of the defaults. They were not run again.

**(a) One soil class on tiles, interrupted.** Ten tiles with a 30 mm disc of dried egg yolk,
weighed and photographed at 25, 40 and 60 min and at the end (80 observations). Three noise seeds.

**(b) End states only.** The same tiles and truth, weighed and photographed at the end only (20
observations), with a fourth parameter the tiles cannot see (`soil.bleachRate`, the bleaching of
tea). Two noise seeds.

| Case | Seed | Parameter | Default | Truth | Estimate | 95 % interval | Truth inside | Post/prior sd | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| a | 1 | soil.egg_yolk.rateRef | 3.0e-5 | 5.0e-5 | 4.64e-5 | 4.03e-5 .. 5.33e-5 | yes | 0.25 | identified |
| a | 1 | liq.proteaseHalfLife | 1800 | 3600 | 4079 | 3330 .. 5000 | yes | 0.13 | identified |
| a | 1 | soil.egg_yolk.tLag | 540 | 300 | 288 | 245 .. 338 | yes | 0.16 | identified |
| a | 2 | soil.egg_yolk.rateRef | 3.0e-5 | 5.0e-5 | 4.45e-5 | 3.86e-5 .. 5.14e-5 | yes | 0.25 | identified |
| a | 2 | liq.proteaseHalfLife | 1800 | 3600 | 4422 | 3570 .. 5480 | yes | 0.14 | identified |
| a | 2 | soil.egg_yolk.tLag | 540 | 300 | 291 | 246 .. 345 | yes | 0.17 | identified |
| a | 3 | soil.egg_yolk.rateRef | 3.0e-5 | 5.0e-5 | 4.81e-5 | 4.11e-5 .. 5.63e-5 | yes | 0.28 | identified |
| a | 3 | liq.proteaseHalfLife | 1800 | 3600 | 3828 | 3130 .. 4680 | yes | 0.13 | identified |
| a | 3 | soil.egg_yolk.tLag | 540 | 300 | 309 | 259 .. 369 | yes | 0.18 | identified |
| b | 1 | soil.egg_yolk.rateRef | 3.0e-5 | 5.0e-5 | 3.80e-5 | 2.51e-5 .. 5.74e-5 | yes | 0.73 | weak |
| b | 1 | liq.proteaseHalfLife | 1800 | 3600 | 6488 | 2420 .. 14400 | yes | 0.63 | weak |
| b | 1 | soil.egg_yolk.tLag | 540 | 300 | 342 | 149 .. 784 | yes | 0.83 | weak |
| b | 1 | soil.bleachRate | 8.0e-4 | 8.0e-4 | 8.0e-4 | 3.0e-4 .. 2.47e-3 | yes | 1.00 | not identified: prior returned |
| b | 2 | soil.egg_yolk.rateRef | 3.0e-5 | 5.0e-5 | 5.65e-5 | 3.76e-5 .. 8.49e-5 | yes | 0.72 | weak |
| b | 2 | liq.proteaseHalfLife | 1800 | 3600 | 4879 | 2030 .. 11700 | yes | 0.56 | weak |
| b | 2 | soil.egg_yolk.tLag | 540 | 300 | 537 | 230 .. 1250 | yes | 0.84 | weak |
| b | 2 | soil.bleachRate | 8.0e-4 | 8.0e-4 | 8.0e-4 | 3.0e-4 .. 2.47e-3 | yes | 1.00 | not identified: prior returned |

In all 15 fitted cases the truth is inside the stated 95 % interval. What the two cases show:

- **Looks during the run are worth far more than end states**, when they are weighings. With
  them every parameter is identified (posterior deviation 0.13 to 0.28 of the prior's); from end
  states only one combination of the three is fixed (information 224 prior precisions) and the
  other two directions are left to the prior (0.6 and 0.007), so each parameter alone is weak
  and the rate and the enzyme's life are confounded (correlation -0.82).
- **A parameter the data cannot see is reported and returned.** `soil.bleachRate` has
  sensitivity 0 to egg-yolk tiles: verdict "not identified: prior returned", estimate the
  registered default, interval the prior's.
- The profile intervals agree with the normal ones where the posterior is normal (case a:
  3340 .. 5080 against 3330 .. 5000 for the half-life) and show a one-sided parameter where it is
  not (case b: 2970 .. beyond the grid).
- The estimates of case a lean towards the prior along the confounded direction (rate a little
  low, life a little high in all three seeds): the VERIFIED prior on the rate is tight (one
  deviation is a factor 1.33) and the truth was put 1.8 deviations from it.
- Cost: case a took 272 to 868 replays (61 to 187 s; the larger figure includes three profiles
  and 20 predictive draws), case b 725 to 1113 replays (about 240 s): a weakly determined
  optimum takes the simplex longer.

**(c) A realistic mixed load.** The 114-item lattice with every typical soil of every item (the
simulator's own benchmark load), of which every tenth item (12 items: plates, cutlery, glasses, a
saucer) is scored by eye, photographed and weighed: 36 observations. Only those 12 items are
replayed, the other 102 as a fixed history in the liquor. Truth moved in two soil classes and in
the enzyme's life; one noise seed; the search was given a budget of 120 evaluations and one
restart, because a replay of this record took 10 s that night.

| Parameter | Default | Truth | Estimate | 95 % interval | Truth inside | Post/prior sd | Verdict |
|---|---|---|---|---|---|---|---|
| soil.egg_yolk.rateRef | 3.0e-5 | 6.0e-5 | 4.52e-5 | 2.86e-5 .. 7.13e-5 | yes | 0.81 | weak |
| soil.starch.rateRef | 2.0e-5 | 5.0e-5 | 5.13e-5 | 4.27e-5 .. 6.17e-5 | yes | 0.08 | identified |
| liq.proteaseHalfLife | 1800 | 5400 | 7642 | 2650 .. 14400 | yes | 0.68 | weak |

167 replays, 28 minutes. The starch rate comes back to 3 % with a tight interval (the load is full
of starch soils that are half gone, where a rate shows). The egg-yolk rate and the enzyme's life
are again fixed only as a combination (information 7 against 0.008 for the other direction): end
states of a mixed load say what end states of tiles said in case b. The scores of this load are 0 almost
without exception at the defaults and near the truth alike: the photographs and the balance
carried the fit.

Over the three cases, 18 of 18 fitted parameters had the truth inside their stated 95 %
interval, and both parameters the data could not see were returned to their priors: with truths
that near the defaults, as the coverage study above shows, that said little.

### 9.2 Which parameters decide clean or not clean (`study:which-matter`)

The load is the 114-item lattice with **one** typical soil on every item (the items of a type
take turns through the soils the catalogue lists for it) on 30 % of its region at the typical
loading: 96,223 deposits, 6 s per replay. (With every typical soil of every item at once, as the
simulator's own benchmark loads it, not one of 114 items comes clean at any single setting, and a
count of clean items says nothing.) At the registry defaults **25 of 114 items are clean**, and on
average 51.5 % of the soiled area is still visibly soiled and 36.6 % of the dry soil is left.

Every registered parameter that can be fitted at replay time (148 numbers: soil, liquor,
timeline, inspector, and the calibration's programme parameters and replay-time scales) was put
at the lower and at the upper end of its range, everything else at its default: first on a
thinned replay of every third item, ranked by how far the mean residue moves, then the top 20
exactly, counting clean items by the inspector's rule.

| Rank | Parameter | Tag | Default | Range | Clean at min | At default | At max | Moves | Area left, min .. max |
|---|---|---|---|---|---|---|---|---|---|
| 1 | soil.tea.visibleFraction | ESTIMATED | 0.1 | 0.02 .. 0.5 | 25 | 25 | 37 | 12 | 59 % .. 41 % |
| 2 | soil.bleachRate | ESTIMATED | 8.0e-4 m3/(mol s) | 3.0e-4 .. 3.0e-3 | 25 | 25 | 37 | 12 | 59 % .. 41 % |
| 3 | liq.xTaed | ESTIMATED | 0.088 mol/kg | 0 .. 0.3 | 25 | 25 | 36 | 11 | 59 % .. 42 % |
| 4 | soil.bleachPeroxideRatio | ESTIMATED | 0.02 | 0 .. 0.2 | 25 | 25 | 36 | 11 | 56 % .. 41 % |
| 5 | liq.kDec | ESTIMATED | 5.8e-4 1/s | 2.0e-4 .. 2.0e-3 | 35 | 25 | 25 | 10 | 42 % .. 59 % |
| 6 | soil.bleachChelant | ESTIMATED | 2 | 0 .. 5 | 25 | 25 | 34 | 9 | 59 % .. 42 % |
| 7 | soil.starch.rateRef | ESTIMATED | 2.0e-5 kg/(m2 s) | 2.0e-6 .. 2.0e-4 | 23 | 25 | 31 | 8 | 59 % .. 46 % |
| 8 | prog.mainWashHoldScale | ESTIMATED | 1 | 0.25 .. 2 | 22 | 25 | 29 | 7 | 59 % .. 47 % |
| 9 | liq.xPeroxide | ESTIMATED | 0.67 mol/kg | 0 .. 2 | 25 | 25 | 30 | 5 | 59 % .. 43 % |
| 10 | soil.betaMax | ESTIMATED | 750 kg/m3 | 300 .. 950 | 24 | 25 | 29 | 5 | 59 % .. 51 % |

The next ten: `soil.Cad` 23 .. 28, `soil.bleachEa` 25 .. 29, `liq.EDec` 29 .. 25, `liq.xAmylase`
23 .. 27, `soil.starch.enzymeRef` 27 .. 23, `liq.tabletTau` 29 .. 25, `liq.Kr` 28 .. 25,
`prog.mainWashTargetShift` 22 .. 24, `soil.tea.tLag` 28 .. 25, `soil.starch.enzymeFree` 24 .. 27.
Of the 148, 55 do not move the residue by 0.01 % anywhere in their range.

Reading:

- **The bleach decides more verdicts than anything else**: six of the first ten are the bleaching
  of stains (its rate, the TAED and peroxide of the detergent, the decay of the peracid, the
  chelant boost) or the threshold at which a tea stain is seen. A third of this load is cups,
  saucers and teaspoons with tea or coffee, which sit close to their visibility threshold; they
  are the items a parameter can tip.
- **The protein parameters the lead engineer named do not appear.** `liq.xProtease`,
  `liq.proteaseHalfLife`, `soil.hillN`, `soil.KE` and `soil.egg_yolk.rateRef` each move the dry
  protein soil by several percent of the load's total, but no single one of them, at either end
  of its range, brings an egg-yolk or meat item under 4 mm2: the protein soils are too far from
  clean for one parameter to carry them there. They are the first calibration targets all the
  same, for that reason: they are where the model is furthest from a real machine, which does
  clean egg yolk. Expect this table to change once they are fitted.
- No parameter moves more than 12 of 114 verdicts on its own. The verdicts of a load are decided
  by combinations, and by where the items stand.
- The screen ranks by residue, which the rule of the inspector does not change; the inspector's
  own thresholds and the visibility thresholds of the soils were therefore evaluated exactly as
  well, with eight parameters of the water model (each a new exposure of the load):

| Parameter | Range | Clean at min | At default | At max | Moves | Evaluated by |
|---|---|---|---|---|---|---|
| inspect.maxAreaMm2 (the clean rule's area) | 0 .. 200 mm2 | 25 | 25 | 34 | 9 | replay |
| hyd.slotFanAngle | 0 .. 1.57 rad | 27 | 25 | 22 | 5 | new exposure |
| inspect.maxWaterMl (the clean rule's water) | 0 .. 20 mL | 25 | 25 | 30 | 5 | replay |
| soil.visibleMass (default visibility threshold) | 2e-4 .. 0.02 kg/m2 | 25 | 25 | 29 | 4 | replay |
| film.rivuletF1 | 0.05 .. 1 | 25 | 25 | 26 | 1 | new exposure |
| scene.contactGap | 0.5 .. 10 mm | 24 | 25 | 25 | 1 | new exposure |
| jets.kS | 0 .. 1 | 24 | 25 | 25 | 1 | new exposure |
| soil.starch.visibleMass | 2e-4 .. 3e-3 kg/m2 | 24 | 25 | 25 | 1 | replay |
| jets.kStag, jets.kFilm, film.kappaW, spray.rmMax | their ranges | 25 | 25 | 25 | 0 | new exposure |
| inspect.maxSpecks, inspect.dotDiameterMm, soil.egg_yolk.visibleMass, soil.tea.visibleMass | their ranges | 25 | 25 | 25 | 0 | replay |

So the rule itself (how much area is allowed, how much standing water) is worth as much as the
strongest physical parameters, which is as it should be and is a reason to keep it fixed at the
standard's values while fitting. Of eight water parameters only the fan angle of the slot nozzles
moves more than one verdict (five); the stress closures of the jets move none. On this lattice,
where nothing is stacked against anything, the water is not what limits cleaning in the model as
it stands. Two cautions: the lattice is not a settled load (items do not lean on each other, so
there are few contacts and shadows for the water parameters to act through), and the sixty-odd
water parameters that were not tried include the splatter and droplet closures that decide how
much water reaches a shadowed face.

In one merged list, the ten parameters that move the most verdicts on this load are: the tea
visibility share and the bleach rate (12 each), the TAED content and the peroxide ratio of the
bleach (11 each), the peracid decay (10), the chelant boost and the area of the clean rule (9
each), the starch rate (8), the length of the main-wash hold (7), and then, at 5 each, the
peroxide content, the swelling limit of the adhesive soils, the water of the clean rule and the
slot fan angle.

### 9.3 Which test wash first (`study:rank`)

Eleven candidate washes of ten test tiles (30 mm discs), ranked for the five parameters the
simulation's lead engineer named as the first calibration targets (`liq.proteaseHalfLife`,
`liq.xProtease`, `soil.hillN`, `soil.KE`, `soil.egg_yolk.rateRef`). The gain of each wash was
computed at nine parameter sets: the registry defaults and eight drawn from the priors of the
five targets (seed 1), with the derivative step chosen at each (section 5.2). Run on the exposure
code of 10 October, 05:40, with a fresh cache; 9 minutes for both tables under load.

With the course of the run known (a power and temperature log in the record):

| Rank | Candidate wash | Obs | Gain, mean (bits) | +- | Least .. most | Place | Led in | Greedy place | Adds there (bits) | |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Ten egg-yolk tiles with twice the detergent (40 g), weighed and photographed at the end | 20 | 7.92 | 3.56 | 2.14 .. 14.55 | 1-9 | 67 % | 1 | 7.92 | unstable |
| 2 | Ten egg-yolk tiles, photographed every 10 min from 20 to 70 min, weighed at the end | 80 | 6.92 | 3.57 | 0.21 .. 13.27 | 1-5 | 33 % | 2 | 3.84 | unstable |
| 3 | Ten egg-yolk tiles, photographed at 25, 40 and 60 min, weighed at the end | 50 | 6.71 | 3.42 | 0.21 .. 13.00 | 2-4 | 0 % | 7 | 0.27 |  |
| 4 | Ten egg-yolk tiles, taken out and weighed dry: 3 at 25 min, 3 at 40 min, 2 at 60 min, 2 at the end | 10 | 6.60 | 2.96 | 0.14 .. 10.27 | 2-7 | 0 % | 4 | 1.07 | unstable |
| 5 | Ten egg-yolk tiles, weighed and photographed at the end | 20 | 6.46 | 3.11 | 0.21 .. 12.13 | 2-4 | 0 % | 5 | 0.46 |  |
| 6 | Ten tiles of five soils, photographed at 25, 40 and 60 min, weighed at the end | 50 | 5.29 | 2.25 | 1.22 .. 9.03 | 2-7 | 0 % | 6 | 0.34 | unstable |
| 7 | Ten egg-yolk tiles with half the detergent (10 g), weighed and photographed at the end | 20 | 4.93 | 3.12 | 0.00 .. 10.45 | 4-10 | 0 % | 3 | 1.38 | unstable |
| 8 | Ten tiles of five soils, weighed and photographed at the end | 20 | 4.89 | 2.41 | 0.09 .. 8.74 | 6-8 | 0 % | 9 | 0.09 |  |
| 9 | One egg-yolk tile, photographed at 25, 40 and 60 min, weighed at the end | 5 | 4.31 | 2.10 | 0.02 .. 6.95 | 8-10 | 0 % | 10 | 0.05 |  |
| 10 | Ten tiles of five soils, taken out and weighed dry: 3 at 25 min, 3 at 40 min, 2 at 60 min, 2 at the end | 10 | 3.83 | 1.46 | 0.72 .. 5.18 | 3-11 | 0 % | 8 | 0.11 | unstable |
| 11 | Ten egg-yolk tiles, scored by eye at the end | 10 | 1.23 | 2.31 | 0.00 .. 5.96 | 10-11 | 0 % | 11 | 0.04 |  |

The gain of four of them at each set (bits; the sets as half-life in s, protease dose, Hill
exponent, KE, rate):

| Parameter set | Double dose | Every 10 min | End only | By eye |
|---|---|---|---|---|
| defaults: 1800, 0.010, 3.0, 0.82, 3.0e-5 | **12.08** | 6.76 | 6.76 | 0.00 |
| 2010, 0.0031, 3.8, 0.42, 2.2e-5 | **6.43** | 4.10 | 4.10 | 0.00 |
| 5920, 0.026, 1.5, 0.31, 1.7e-5 | 7.04 | **7.08** | 6.24 | 0.00 |
| 10200, 0.0096, 1.9, 0.65, 4.2e-5 | 5.79 | **10.99** | 8.70 | 5.12 |
| 696, 0.031, 2.4, 0.51, 3.7e-5 | **10.51** | 7.42 | 7.52 | 0.00 |
| 1580, 0.0012, 2.8, 1.01, 2.6e-5 | **2.14** | 0.21 | 0.21 | 0.00 |
| 3390, 0.0022, 1.5, 1.13, 9.8e-5 | **14.55** | 7.62 | 7.62 | 0.00 |
| 951, 0.015, 2.9, 0.70, 1.1e-5 | **5.80** | 4.83 | 4.83 | 0.00 |
| 7980, 0.0052, 1.0, 1.46, 6.5e-5 | 6.92 | **13.27** | 12.13 | 5.96 |

At the defaults alone the tool prints, under "LOCAL RANKING": double dose 12.08, staggered
weighing 8.91, the three plain egg-tile washes 6.76 each, scoring by eye 0.00. That is the kind
of table an earlier version of this section recommended a first wash from, and the nine sets
show what it is worth: the double dose leads in six of the nine and is eighth or ninth of eleven
(5.8 and 6.9 bits against 11.0 and 13.3) in the two sets where the enzyme lives long enough to
clean the tiles at the normal dose, as the tile of the published record in `examples/` is
cleaned. Scoring by eye, worth nothing at the defaults, is worth 5 to 6 bits in those two.

What the nine sets agree on, and what can therefore be said before any wash has been run:

1. **No single wash is the best first wash whatever the parameters are.** The double dose leads
   on the mean (7.9 bits against 6.9) and in six sets of nine, and the tool flags it UNSTABLE:
   its place runs from first to ninth.
2. **The double dose and the normal dose with door openings complement each other.** In the
   greedy order they are the first two (the second adds 3.8 bits to the first), and each is
   strong where the other is weak: the pair is the robust start, in either order. A third wash
   at half the dose adds 1.4 bits, more than any repeat at the normal dose (0.3 to 1.1).
3. **Photographs at door openings cost nothing in information and sometimes add much.** The
   wash photographed every ten minutes gains what the same wash observed at the end gains at
   five sets, and 0.8 to 2.3 bits more at the three where the soil comes off during the main
   wash. (It is 0.1 bit below at one set: the derivative step is chosen per candidate, and
   differences of that size are within its accuracy.) At the defaults the photographs add
   nothing because the soil stays visible to the end; that was a property of the defaults.
4. **Scoring by eye alone is the weakest observation**: 0 bits at seven sets of nine (every tile
   scores 0, or every tile scores 5), and below weighing and photographing the same tiles at the
   other two (5.1 against 8.7, 6.0 against 12.1). Scores of tiles are worth taking only beside
   a balance and a camera.
5. **Ten tiles beat one** at every set (mean 6.7 against 4.3 bits for the same plan).
6. At one set of nine (a tenth of the default enzyme dose) the egg tiles at the normal dose
   hardly change and say 0.2 bits; the double dose (2.1 bits) and the five-soil tiles observed
   during the run (1.2) are the candidates that still say something there.
7. One wash leaves the mean posterior deviation of `liq.xProtease` at about half of its
   prior's (0.45 to 0.6 for the five leading washes) and the other four targets at 0.65 to 0.95: a single wash fixes one combination.
   Separating the targets takes washes at different doses and temperatures.

**When the temperature the main wash reached is not known** (no log; `prog.mainWashTargetShift`
fitted as a nuisance and drawn from its prior with the five targets, so the nine sets are not
those of the table above):

| Rank | Candidate wash | Obs | Gain, mean (bits) | +- | Least .. most | Place | Led in | Greedy place | Adds there (bits) | |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Ten tiles of five soils, photographed at 25, 40 and 60 min, weighed at the end | 50 | 5.88 | 2.40 | 1.02 .. 9.00 | 1-4 | 33 % | 1 | 5.88 | unstable |
| 2 | Ten tiles of five soils, weighed and photographed at the end | 20 | 4.59 | 2.11 | 0.11 .. 8.07 | 2-8 | 0 % | 8 | 0.21 | unstable |
| 3 | Ten egg-yolk tiles, photographed every 10 min from 20 to 70 min, weighed at the end | 80 | 4.47 | 3.77 | 0.19 .. 10.87 | 1-7 | 33 % | 4 | 1.25 | unstable |
| 4 | Ten egg-yolk tiles, photographed at 25, 40 and 60 min, weighed at the end | 50 | 4.11 | 3.35 | 0.19 .. 9.45 | 3-7 | 0 % | 7 | 0.27 | unstable |
| 5 | Ten egg-yolk tiles with twice the detergent (40 g), weighed and photographed at the end | 20 | 4.02 | 3.07 | 0.80 .. 9.02 | 1-11 | 22 % | 2 | 3.94 | unstable |
| 6 | Ten egg-yolk tiles, weighed and photographed at the end | 20 | 3.44 | 2.56 | 0.19 .. 7.79 | 4-9 | 0 % | 9 | 0.16 | unstable |
| 7 | Ten egg-yolk tiles, taken out and weighed dry: 3 at 25 min, 3 at 40 min, 2 at 60 min, 2 at the end | 10 | 3.41 | 1.51 | 0.21 .. 4.97 | 1-10 | 11 % | 5 | 0.52 | unstable |
| 8 | Ten tiles of five soils, taken out and weighed dry: 3 at 25 min, 3 at 40 min, 2 at 60 min, 2 at the end | 10 | 3.08 | 1.52 | 0.65 .. 4.75 | 3-9 | 0 % | 10 | 0.12 | unstable |
| 9 | Ten egg-yolk tiles with half the detergent (10 g), weighed and photographed at the end | 20 | 2.45 | 2.08 | 0.01 .. 6.46 | 6-10 | 0 % | 3 | 2.22 | unstable |
| 10 | One egg-yolk tile, photographed at 25, 40 and 60 min, weighed at the end | 5 | 2.11 | 1.87 | 0.05 .. 4.73 | 8-10 | 0 % | 11 | 0.03 |  |
| 11 | Ten egg-yolk tiles, scored by eye at the end | 10 | 1.99 | 3.74 | 0.00 .. 9.87 | 2-11 | 0 % | 6 | 0.36 | unstable |

Two more things follow:

8. **Log the run.** Averaged over the sets, the egg-tile wash with openings is worth 6.9 bits
   with the course known and 4.5 without; the same tiles observed at the end only fall from 6.5
   to 3.4, the double dose from 7.9 to 4.0. A plug with a power log (and a probe in the sump, if
   one can be had) is worth more than the choice among these washes.
9. **Without a log, tiles of several soils observed during the run are the better first wash**:
   first on the mean (5.9 bits), first to fourth at every set, never under 1 bit. Soils that
   leave by different chemistry at different temperatures pin the temperature that one soil
   alone confounds with its own rate. With the tile washes of one soil the place still runs
   over most of the table.

**A reasonable first pair, on this evidence:** ten egg-yolk tiles at the normal dose,
photographed at door openings and weighed dry at the end, and the same at twice the dose, both
with the run logged. After the first fit, rank again with draws from its posterior
(`rank --params fitted/params.json --posterior fitted/fit.json --existing wash1.json`): the
spread over parameter sets will be far smaller then, and the ranking will mean more.

These tables depend on the priors the sets are drawn from. With priors half as wide (an earlier
state of this work, and draws that piled up on the ends of the ranges) the wash with openings led
on the mean by 0.3 bits and the double dose in five sets of nine; the nine points above hold in
both.

### 9.4 Parameters of the water (`scripts/study-water.ts`, `check-scale`, `sensitivity`)

**Can a scale of the jets be applied at replay time?** `check-scale` on the tile load, with
`jets.kStag` multiplied by 1.5 (both exposures computed by the same code, in memory): the peak
shear of a jet cell changes by a factor between 1 and 1.5 (cells in the stagnation zone scale,
cells under the radial film do not), the footprint duty by 1 to 5 (the footprint is where the
shear exceeds the first of `jets.shearLevels`, so it grows), the mean shear by 0.33 to 1.5, and a
few tens of cells in 60,000 enter or leave the table. The water table does not change. So
`cal.jetShearScale` (a factor on peak and mean shear at replay time) is **not** equivalent to
`jets.kStag` in the exposure as it stands, and `jets.kStag` and `jets.kFilm` belong in the outer
loop. The same check for `film.standInHoldTime`: no column changes at all; the real film stage
no longer reads it. `cal.filmShearScale` and `cal.holdTimeScale` are therefore pure calibration
scales on columns of the water table, with no registry key behind them.

What would make the jet closures replay-time parameters is in the exposure table already in
part: it now holds the share of a revolution above four stress levels (`duty`, `shearDuty1..3`).
A scale c on the stress turns "duty above L" into "duty above L / c" of the stored curve, which is
exact where L / c is a stored level and an interpolation between levels otherwise. What is
missing is the split of each cell's stress into its stagnation-zone and film-zone parts (the two
closures scale different cells), or the unscaled stress with its duties at enough levels for
each. That is requested of the jets stage.

**Which water parameters do tiles see?** `sensitivity` on ten tiles of five soils weighed at three
openings and at the end, for ten parameters of the water model (each two new exposures):

| Parameter | Sensitivity | Post/prior sd | Verdict |
|---|---|---|---|
| jets.kS (share of a jet that splatters) | 0.18 | 0.67 | weak |
| hyd.slotFanAngle | 0.10 | 0.90 | not identified |
| jets.kFilm | 0.04 | 0.98 | not identified |
| spray.rmMax | 0.02 | 0.99 | not identified |
| jets.kStag | 7e-4 | 1.00 | not identified |
| film.kappaW, film.rivuletF1 | below 1e-5 | 1.00 | not identified |
| film.beadCover, film.thetaFilm, scene.contactGap | 0 | 1.00 | not identified |
| (for scale) soil.egg_yolk.rateRef | 0.37 | 0.42 | identified |

Tiles standing in the open are wet whatever the wetting closures say, and their soils leave by
chemistry, not by stress. **Tiles in the open calibrate the chemistry; they say almost nothing
about the water.** The water parameters need loads in which water is the limit: a tile close
behind another, a soiled face against a rack wire, a cup that pools, the far side of a stacked
plate. Those are also the cases in which stacking decides cleaning, which is what the game is
about, and they are the second campaign.

**The outer loop.** `study-water.ts` draws a record of those ten tiles with `jets.kS` at 0.85
(default 0.5) and the egg-yolk rate at 4.5e-5, and fits both: `jets.kS` in the outer loop, the rate
at replay time. Ten values of `jets.kS`, each a new exposure of the load, took 122 s. The rate came
back as 4.63e-5 (3.98e-5 .. 5.39e-5; truth inside). `jets.kS` stayed at its default with a
deviation of 1.75 in its logit against 2.3 for the prior (truth 1.0 deviations away): the record
barely constrains it, and the tool says so. The profiled log posterior moved by only 0.3 to 0.6
across the whole design, and by 0.27 between `jets.kS` = 0.5000 and 0.4995: the exposure is not a
smooth function of this parameter at that scale (sampling of the droplets, or whole water units),
so differences of the objective across small steps of a water parameter are noise. The outer
loop's steps are large (three quarters of a prior deviation at first) for that reason; a water
parameter whose effect is smaller than that noise cannot be fitted from such data, whatever the
method. The earlier run with `jets.kStag` (to which the tiles have no sensitivity at all) ended
where it started, with the prior's deviation, after seven exposures.

### 9.5 Cost of one evaluation (`study:cost`)

Fast tier (4 mm blocks, 2 mm soil cells), 3,971 ticks. Best of three evaluations at a new soil
parameter each.

| Record | Restriction | Items replayed | Deposits | Observations | Preparation, cold | ... from cache | One evaluation |
|---|---|---|---|---|---|---|---|
| Ten tiles, 50 mm discs | none needed | 10 of 10 | 4,840 | 50 | 17.9 s (exposure 15.1 s) | 2.2 s | **0.44 s** |
| Ten tiles, 50 mm discs | one soil cell in 4 | 10 of 10 | 1,210 | 50 | | 2.2 s | 0.21 s |
| Ten tiles, 20 mm discs | none needed | 10 of 10 | 760 | 50 | | 2.2 s | **0.18 s** |
| Full load, every item observed | none possible | 114 of 114 | 782,082 | 228 | 95.3 s (exposure 45.4 s, first replay 45.0 s) | 50 s | **42.7 s** |
| Full load, every item observed | one soil cell in 4 | 114 of 114 | 195,479 | 228 | | 18.8 s | 12.6 s |
| Full load, 10 items observed | observed items, the rest as background | 10 of 114 | 92,797 | 20 | | 49.3 s (background replay 38.9 s) | **5.1 s** |
| Full load, 10 items observed | none | 114 of 114 | 782,082 | 20 | | 49.7 s | 44.7 s |

Where the time goes (CPU profiles): a full-load evaluation is the soil kernel (`WashSoil.step`,
more than 95 %); laying the soil down, the element tables and the inspector together are under
2 %. A tile evaluation has a floor of about 0.13 s that does not depend on the soil: the liquor
chemistry (0.05 s, mostly the pH bisection in each of four sub-steps per tick), the soil kernel's
per-tick rate tables (0.04 s) and the replay loop (0.03 s). The evaluator adds nothing measurable
to either; lowering them further is the business of those stages (see the requests in the
engineer's report), or of replaying groups of items in parallel workers against a fixed liquor
history, which the "background" mechanism already makes exact at the parameters of the
preparation and which was not built.

A fit of three parameters to one tile record is 300 to 900 replays: one to three minutes. A fit
to a full load in which every item is observed is hours without thinning; observe a dozen items
closely instead (5 s per evaluation), or fit the mass and area fractions thinned (13 s).


### 9.6 A measured wash beside the published class means (11 October 2026)

The first fit to a wash of the owner's machine (`docs/calibration/owner-wash-01-calibration.md`)
is the tool's objective over two records: the measured wash through the evaluator, and the
literature record of the anchoring with its fitted class means as group mean scores. The
standard load is too large to wash at every evaluation, so its class means are washed once on a
grid of the parameters the two records share and read from that table
(`anchors/scripts/literature-surface.ts`, `anchors/src/literature-surface.ts`), through the
`pool` option of `createObjective` and `fitRecords` (`anchors/scripts/fit-owner.ts`). What that
fit cost: nine replays of four plates per evaluation (the amount scenarios), 20 to 27 s at the
official tier; 78 evaluations for one key with its profile (26 minutes), 80 for two keys
without profiles (34 minutes), 35 for a grid of two keys (15 minutes).

Two things it taught about the method:

- **Scenarios drawn at random make a bumpy likelihood.** A first design drew seven scenarios
  as a Latin hypercube over amount, layout seed and unevenness. The joint log posterior then
  rose and fell by half a log unit between neighbouring grid points, because a handful of
  scenarios whose predictions lie far apart is a mixture of separate humps. The record now
  lays one input, the amount, out on a regular grid whose step moves a prediction by less than
  its scatter; the surface is smooth to about 0.2.
- **An unknown input that every item shares is not integrated out per item.** It has to be
  checked on a scaled copy of the record (there: the best duty runs from 0.7 to 1 as every
  amount goes from 20 % less to 25 % more).


## 10. Limits

- The posterior is summarised by its maximum and a normal approximation; profiles go beyond that
  for three parameters by default, and other local optima that the starts and the scans find are
  listed. There is no sampler: an optimum in a basin no start or scan reaches is not found, and
  the scans move one parameter at a time.
- Intervals are Bayesian, with priors that are close to flat over the registered ranges. Where
  the records say little about a parameter its interval is most of its range, which is the
  honest answer; a truth outside the registered range cannot be found at all (the estimate is
  then reported on the bound). Section 9.1 has the coverage that was measured.
- The interval of a parameter that was not profiled is the normal approximation at the
  optimum, which can be far too narrow along a curved ridge of equally good fits. Three
  parameters are profiled by default; profile every parameter whose interval matters.
- Observations of one record are taken as independent given the parameters. Tiles of one wash
  share a liquor, a detergent tablet and a temperature course; an error in those moves them
  together. The `prog.*` parameters and a measured course take the largest of these out.
- The allowance for gross errors treats a wrong value as uniform over the admissible range. It
  protects against a few wrong values among many good ones; a record in which most values are
  wrong in the same direction is a misfit, which the predictive check reports, not an outlier.
  Scores, verdicts and speck counts have no such allowance (a verdict has `obs.cleanMisjudge`).
- The observer's visibility threshold is one factor per target and observation. It is not fitted
  per observer, and two observations of one item (a verdict and a score) are treated as
  independent draws of it.
- Input scenarios are integrated out item by item, as if the unknown inputs of different items
  were independent, and the derivatives behind the normal intervals are those of the nominal
  scenario: for a record with scenarios, rely on the profiles.
- A door opening is read as a snapshot; its pause and cooling are not simulated.
- Retained water is what stands in pools at the end of the last rinse; drying is out of scope.
- Identifiability verdicts, the uncertainty of a fit and the gain of an experiment at one
  parameter set are local linear approximations. The fit guards the verdict with the fall of the
  log posterior at the prior centre (section 5.3), and the ranking averages over drawn parameter
  sets (section 7); `sensitivity` alone is local and says so.
- The background of a restricted replay is exact at the estimate after a fit, not along the way
  to it; the report says how much it still moved. `--restrict all` removes the approximation at
  the cost of replaying every soil.
- `wash()` cannot reproduce a fit to soils on described patches or with a `cal.*` scale; the
  report names those records.
- The seeded layout of a soil within a region (which cells a coverage of 0.5 takes) is the
  simulator's, not the real one. Use a patch where the place matters.
- The exposure summary kept in the cache is keyed by the simulator version and the exposure
  schema. An exposure stage that changes without either changing leaves stale summaries: prepare
  with `refreshExposure`, or clear the cache directory.
