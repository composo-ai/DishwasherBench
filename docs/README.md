# The documents

This is the index of everything under `docs/`: what to read first for what you want to do, and
which documents describe the project as it is now and which are records of how it was built.

## How to read these documents

Most of these documents were written while the project was first built, in October 2026, and
are kept as they were written. That has three consequences for a reader.

- **They speak in the voices of the build.** "The owner" is the owner of the one dishwasher
  that is simulated, who photographed and measured it and ran the test wash. "The lead", "the
  engineer" (also "the levels engineer", "the harness engineer", "the calibration engineer" and
  the like), "the reviewer", "the specialist", "the researcher", "the architect", "the chief
  architect", "the judge", "the panel" and "the red team" are roles in the build, not people
  you can write to. "The brief" is the written instruction a role was given, "this session" is
  one working session, and "I" in a dossier is its author. [VERIFIED] in a research dossier
  means that its author read the value in the source while writing it; not every such tag has
  been checked a second time. To reach the maintainers, open an issue.
- **They are dated.** "Today", "this morning" and "tonight" in a document mean the date at its
  head. Where a later document replaced an earlier one, a note at the head of the earlier one
  says so and names its successor.
- **Some things they cite were never published.** The private development history, the working
  directories of the build, two internal review reports and one unmerged piece of work are not
  in this repository. A document that leans on one of them says so where it does.

Each document below carries one of four labels:

| Label | Meaning |
|---|---|
| **Current** | Describes the project as it is. Kept up to date |
| **Record** | A record of how the thing was built or what was found on a given day, kept as written. True of its date; not maintained |
| **Superseded** | Replaced by a later document, which its head note names. Kept because later documents cite it |
| **Reference** | A sourced review or dossier written before or during the build: the evidence behind the parameters. Kept as written; not revised when the code changes |

## Where to start

**If you have five minutes.** The [README](../README.md) at the root, then
[validation/README.md](validation/README.md) section 1 (what the simulation was checked
against) and section 8 (what a verdict can be trusted for).

**To play.** The README's "Play in the browser"; then [benchmark/levels.md](benchmark/levels.md)
section 1 (the seven levels) and section 4 (what a mistake costs). A tour of the page in
pictures, with a caption for each, is in `apps/web/screenshots/` (`captions.txt`).

**To benchmark a model or an agent.**
[benchmark/README.md](benchmark/README.md): sections 1 to 3 (the pieces, the harness, an MCP
client), 5 to 7 (what is recorded, how an episode is verified, what each kind of player sees),
10 (design decisions and open questions) and 11 (things to know before a long run). Then
[benchmark/first-runs/course/README.md](benchmark/first-runs/course/README.md) for the six
episodes played so far, and its section 4 for what they do not show. For a human baseline:
benchmark/README.md section 4.

**To work on the simulation.** [design/scope.md](design/scope.md) (the aim, what is built, where
the wash falls short), then [validation/README.md](validation/README.md) sections 5 and 9 (the
failing phenomena, what is not modelled) and [ROADMAP.md](ROADMAP.md). The physics as designed
is [design/sim-core.md](design/sim-core.md), a record of before the build: where it and
`scope.md` differ, `scope.md` wins. The parameter set the game washes with is described in
[calibration/anchoring-v7.md](calibration/anchoring-v7.md). The 48 phenomena are defined in
[research/standards.md](research/standards.md) section 9. Before you change any source file of
the simulation, read the fingerprint rule in [CONTRIBUTING.md](../CONTRIBUTING.md).

**To work on the game, the page or the agent interface.**
[design/platform.md](design/platform.md): section 2 (conventions that bind every package),
the sections on the session and its actions, and the status at its end ("Built", "Deferred or
open", "Open design questions").

**To bring calibration data: a test wash or a measurement of the machine.**
[calibration/protocol.md](calibration/protocol.md) (four washes anyone with this machine can
run, the measurements still open, and how to send a result in), and
[calibration/wash-record.md](calibration/wash-record.md) (the format of a record). The one wash
run so far is the worked example:
[the plan](calibration/owner-wash-01-egg-yolk.md),
[the prediction](calibration/owner-wash-01-prediction.md),
[the result](calibration/owner-wash-01-result.md) and
[the calibration](calibration/owner-wash-01-calibration.md).

## What is current

| What | Value | Where it is set |
|---|---|---|
| The machine | Bosch SMV4HAX40G, one privately owned machine | `packages/machine` |
| The scored programme and detergent | Eco 50; one capsule of Finish Powerball Ultimate, 12.9 g | `packages/wash-runner/src/defaults.ts` |
| The parameter set | `anchored-v7.owner-capsule` | `packages/calibration/anchors/`, named in `packages/wash-runner/src/defaults.ts` |
| The simulation | `spotless-sim 0.5.0 water-7` | `packages/sim-core/src/wash.ts` |
| The harness | `spotless-bench/0.2.0`, prompt version 3, context policy `standard-2` | `packages/bench/src` |
| The course | Seven levels | `packages/levels`, [benchmark/levels.md](benchmark/levels.md) |

## The documents, by directory

### `docs/` and `docs/validation/`

| Document | Label | What it is |
|---|---|---|
| [ROADMAP.md](ROADMAP.md) | Current | The map of the open problems, each of which is an issue a contributor could pick up |
| [validation/README.md](validation/README.md) | Current | What the simulation has been checked against, how it did, what a verdict can be trusted for, what is not modelled. Written on 12 October 2026 and the reference for every claim the README makes |

### `docs/benchmark/`

| Document | Label | What it is |
|---|---|---|
| [README.md](benchmark/README.md) | Current | Running a model, an MCP client or a human baseline; what is recorded and verified; what each player sees; first results; design decisions and open questions |
| [levels.md](benchmark/levels.md) | Current | The course of seven levels, the difficulty figure, the reference players, the gates, and what is not solved |
| [course-table.md](benchmark/course-table.md), [course-robustness.md](benchmark/course-robustness.md) | Current, generated | The reference players' scores on every level, and how far a score moves with the seed and the least certain parameters. Written by scripts of `packages/bench`; do not edit by hand |
| [first-runs/course/](benchmark/first-runs/course/README.md) | Current | The six episodes of two models on the finished course, with records, transcripts and pictures. The only model results there are |
| [first-runs/README.md](benchmark/first-runs/README.md) and the directories beside it | Record | The earlier episodes and token measurements that shaped the harness. Not results |

### `docs/calibration/`

| Document | Label | What it is |
|---|---|---|
| [protocol.md](calibration/protocol.md) | Current | Test washes that would calibrate the simulation, the measurements of the machine still open, and how to send a result in |
| [wash-record.md](calibration/wash-record.md) | Current | The format of a wash record |
| [fitting.md](calibration/fitting.md) | Current | The fitting tool: observation models, fitting, sensitivity, which wash to run next, the command line |
| [anchoring-v7.md](calibration/anchoring-v7.md) | Record | The parameter set the game washes with, which is still the current one, and its tables. Written on 11 October 2026 |
| [soil-quantities.md](calibration/soil-quantities.md) | Current, generated | The soil side's data for each soil. Written by a script; do not edit by hand |
| [owner-wash-01-egg-yolk.md](calibration/owner-wash-01-egg-yolk.md) | Record | The plan of the one test wash run so far |
| [owner-wash-01-prediction.md](calibration/owner-wash-01-prediction.md) | Record, frozen | What the simulation predicted, written before the result. Not to be edited. The proof of the order lies in the private development history, which is not published |
| [owner-wash-01-result.md](calibration/owner-wash-01-result.md) | Record | The result against the prediction |
| [owner-wash-01-calibration.md](calibration/owner-wash-01-calibration.md) | Superseded by `anchoring-v7.md` as the description of the set | The calibration on that wash. What it found about the wash stands |
| [anchoring.md](calibration/anchoring.md), [anchoring-v3.md](calibration/anchoring-v3.md), [anchoring-v4.md](calibration/anchoring-v4.md), [anchoring-v5.md](calibration/anchoring-v5.md) | Superseded by `anchoring-v7.md` | The earlier parameter sets, in order. `anchoring.md` is also where the method is described |

In the calibration notes, paths written as `anchors/...`, `scripts/...`, `src/...` and
`records/...` are relative to `packages/calibration`.

### `docs/design/`

| Document | Label | What it is |
|---|---|---|
| [scope.md](design/scope.md) | Current | The aim of the project, what links stacking to cleaning, what was built first and what is left out, the status, where the wash falls short |
| [platform.md](design/platform.md) | Current | The game side: conventions, repository layout, geometry, loading physics, the session and its actions, server, page and agent interface. The design as amended, with a status and the open design questions at its end |
| [sim-core.md](design/sim-core.md) | Record | The design contract of the wash simulation, from before it was built. `scope.md` overrides it. Tests still check the code against its tables and interfaces |
| [contract-issues.md](design/contract-issues.md) | Record | Defects found in `sim-core.md` and the first skeletons on 9 October 2026 |
| `proposals/` | Superseded by `sim-core.md` | The three competing designs and the panel's verdicts |
| [scripts/](design/scripts/README.md) | Record | Throwaway arithmetic behind `sim-core.md`. Not maintained code, and not run since |

### `docs/media/`

| Document | Label | What it is |
|---|---|---|
| [linkedin-demo/](media/linkedin-demo/README.md) | Record | A demo video of 2 minutes 11 seconds for social media, the source of everything on screen, and the scripts that filmed the game and built the video. Made on 13 October 2026 |

### `docs/reference/`

| Document | Label | What it is |
|---|---|---|
| [owner-measurements.md](reference/owner-measurements.md) | Current source record | First-hand tape readings and descriptions of the machine. Takes precedence over anything estimated |
| [REDACTIONS.md](reference/REDACTIONS.md) | Current | What was removed from or covered in the photographs before publication, and why |
| `owner-photos/` | Source record | Photographs of the machine and its parts. The rating-plate photograph is withheld |
| `calibration_runs/2026-10-10_egg_plates/` | Source record | Photographs of the test wash, with the owner's note |
| `machine-drawings/` | Current, generated | The machine model as drawn by scripts of `packages/machine`, and overlays of the model on a photograph |

### `docs/research/`

Sourced literature reviews written between 8 and 10 October 2026, before and during the build.
Every number in them carries a tag that says whether it was read in a source, recalled or
estimated. They are the evidence behind the parameters and are kept as written; they are not
revised when the code changes.

| Document | Label | What it is |
|---|---|---|
| [standards.md](research/standards.md) | Reference | Test standards, scoring, loading guidance. Section 9 defines the 48 loading phenomena the simulation is checked against |
| [jets.md](research/jets.md), [films.md](research/films.md), [soils.md](research/soils.md), [chemistry.md](research/chemistry.md), [enzymes-at-temperature.md](research/enzymes-at-temperature.md), [numerics.md](research/numerics.md), [items.md](research/items.md) | Reference | The physics and chemistry by topic, the numerical methods, and the tableware |
| [detergent-finish-ultimate.md](research/detergent-finish-ultimate.md) | Reference | The detergent the game is scored with |
| [benchmark.md](research/benchmark.md) | Reference | The design reasoning of the benchmark. Its section 9 lists the decisions that `benchmark/README.md` section 10 answers |
| [machine-bosch-smv4hax40g.md](research/machine-bosch-smv4hax40g.md), [machine-bosch-owner-update.md](research/machine-bosch-owner-update.md), `machine-bosch-notes/` | Reference, overridden in places | The dossier of the simulated machine, the update from first-hand measurements, and the four sets of research notes behind the dossier. They cite the manufacturer's documents by public address and page |
| [machine.md](research/machine.md) | Superseded as the machine model | A generic dishwasher, the baseline the project started from |
| [auto-programme-evidence.md](research/auto-programme-evidence.md), [auto-recommendation.md](research/auto-recommendation.md) | Record | Research on the Auto 45-65 programme, which the game no longer scores |
| [spike-gpu-compute.md](research/spike-gpu-compute.md), [spike-gpu-compute-macos27-recheck.md](research/spike-gpu-compute-macos27-recheck.md), [spike-rigid-body.md](research/spike-rigid-body.md) | Record | The two hardware trials that chose WebGPU through Dawn and the Jolt physics engine. Their code is under `spikes/` |

## Generated reports elsewhere in the repository

Documents cite stored reports that live beside the code that wrote them:

- `packages/calibration/anchors/reports/`: fits, tables and checks of each parameter set. Those
  of `v7` are current; the others belong to superseded sets.
- `packages/sim-verify/phenomena/reports/`: the phenomena suite on each parameter set.
  `phenomena-fast-anchored-v7.owner-capsule.md` is the current one.
- `packages/sim-verify/demos/` and `packages/sim-verify/levels/`: demonstration washes of the
  standard loads and the careful-against-careless contrast on the levels.
- `packages/bench/reference/`: the stored tables of the reference players that the tests read.
- `packages/loader/loads/`: the saved reference loads, each with a picture.
