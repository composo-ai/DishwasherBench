# Roadmap: the open problems

This is the list of what is known to be wrong, missing or untested, written so that a
contributor can pick one up. Each item says what is wrong, where to look, and what would settle
it. The evidence for most of them is in [validation/README.md](validation/README.md); the
status against the original plan is at the end of [design/scope.md](design/scope.md).

Nothing here is scheduled. If you want to work on an item, open an issue (or comment on the one
that tracks it) so that two people do not do the same thing, and read
[CONTRIBUTING.md](../CONTRIBUTING.md) first: a change to the simulation's source has
consequences that a change elsewhere does not.

A rough guide to size: **small** is an afternoon to a few days; **medium** is a week or two;
**large** is research with no known answer. **Needs the machine** means a Bosch SMV4HAX40G.

## The simulation

### 1. Plates and cutlery do not answer to stacking (large; the open blocker)

*What is wrong.* The aim of the project is that how items are stacked decides how well they are
cleaned. For plates and cutlery it does not. With the long soak of Eco 50 spraying 0.8 of the
time, every open face stays wet with renewed water, and the chemistry cleans it whether or not
a jet reaches it. Plates fallen over, a plate turned to the wall, cutlery crowded into one cell
and a spray arm held still cost little or nothing. A real turned plate kept about four times
the residue of its partner in the one test wash, so the real effect is not zero. Moving the
soak back is not the fix: the test wash says the soak does spray that much.

*Where.* `packages/sim-soil` (removal laws), `packages/sim-film` (what a film that is only
dripped on delivers), `packages/sim-timeline` (the replay of the cycle). Evidence:
validation sections 5 (P02, P07, P09, P12, P14), 8 and 9; scope.md "Where the wash falls short".

*What would settle it.* A mechanism that makes a face that is only dripped on clean worse than
one that is sprayed, with a parameter that a test wash can fit, and that test wash: washes 2
and 3 of [calibration/protocol.md](calibration/protocol.md). The phenomena above are the test.

### 2. Faces lying within a millimetre or two of another body come out too clean (large)

*What is wrong.* The water side works on blocks of 2 mm (official tier) or 4 mm (fast tier) and
treats a face that lies close against another body as open wherever water can reach it. So
spoons as the loading physics nests them, cutlery crowded in a cell and any two faces lying
close come out clean. A closure for such gaps was built during the build and is not in this
repository, for reasons that a new attempt has to answer: switched on, it lowered the cutlery
mean of the standard load from 4.61 to 4.31 against a published 4.67, almost all through forks;
the one fully nested spoon of the suite still scored 5 at the official tier; between 1 and 3 mm
of clearance it handed back the open-face values whatever the depth of the gap; and its
deciding parameter (the share of the film at the mouth of a gap that drains into it) moved the
nested spoon from 5 to 0 over its range with no measurement to constrain it.

*Where.* The soil stage (`packages/sim-soil`), from the exact shapes of the scene
(`packages/sim-scene`). Phenomena P15 and P17 in `packages/sim-verify/src/phenomena`.
Validation section 9.

*What would settle it.* A closure that keeps the published cutlery mean, makes a truly nested
spoon dirty, and whose parameter is fitted on wash 3 of the protocol (nested and crowded
cutlery, two plates in one gap).

### 3. Fat comes clean with no detergent, and at 35 °C (medium)

*What is wrong.* Margarine leaves completely without surfactant and as well at 35 °C as at
55 °C. The soil dossier says an oil film never goes to nothing without surfactant. Phenomena
P33 and P25.

*Where.* The melt law in `packages/sim-soil`, the liquor in `packages/sim-liquor`, and the
parameter sets in `packages/calibration/anchors`. [research/soils.md](research/soils.md);
validation section 8, "By soil".

*What would settle it.* A dependence on surfactant and temperature with a new registered
parameter, and a refit of the published class means with it (the fat items of the standard
load must still come out as the published means say).

### 4. Starch always comes clean, and too much goes in water alone (medium)

*What is wrong.* Every starch plate comes clean and none keeps a sheet, although real starch
either comes off whole or keeps a film (P31). With the detergent tray blocked, 27 % of the egg
yolk and 40 % of the tea still go, against a limit of 20 % (P25).

*Where.* The removal laws of `packages/sim-soil`; P25 and P31 in
`packages/sim-verify/src/phenomena`.

*What would settle it.* A second mode for starch, and a lower removal in water alone, each
checked by its phenomenon without moving the bench rates of validation section 4.

### 5. Repair the faulty phenomenon scenarios (small; a good first issue)

*What is wrong.* Three scenarios test something other than what they mean to. P05 (a large flat
item shadows what is behind it) reports an error: its hand-set pose cuts 2 mm into a plate, and
there is no clear place for a 32 cm platter inboard of the plates. P40 (liquid held at contact
points) reads the wrong sign because the glasses now lean on the rest of the corrected upper
basket. P35 (a pot on its side) carries an attribution from an earlier parameter set that was
not looked at again.

*Where.* `packages/sim-verify/src/phenomena` (`scenarios-a.ts`, `scenarios-b.ts`,
`scenarios-c.ts`). These files are part of the fingerprinted source: see CONTRIBUTING.md.

*What would settle it.* Poses that the loading physics accepts and that isolate the effect, with
the report regenerated.

### 6. Run the whole phenomena suite at the official tier (small; computer time)

*What is wrong.* The published table of the 48 phenomena is the fast tier. On the current
parameter set only P03, P15 and P25 were washed at the official tier.

*Where.* `packages/sim-verify/src/phenomena/cli.ts` with `--tier official`, the current set and
`--dose-g 12.9` (the README has the form of the command). About 82 washes of several minutes.

*What would settle it.* The report, and section 5 of the validation document brought up to
date from it.

### 7. What is not modelled at all (large; each a project)

Drying and drips after the last drain; spots and film on glass; items moved by the jets (only a
lift ratio flags them); soil settling on clean neighbours; flaking of thick layers; where a
tablet lands if it does not dissolve in its tray. Nine phenomena are "not covered" for these
reasons (P21, P23, P26, P34, P38, P39, P41, P42, P43). Step 9 of scope.md; module M11 of
[design/sim-core.md](design/sim-core.md); `packages/sim-rigid` holds the interface for motion
during the wash and no more.

### 8. Other programmes are uncalibrated (large without a power log)

Only Eco 50 is scored. Auto 45-65 can be washed from the command line and every verdict on it
is labelled provisional; P27 and P32 fail on programmes other than Eco 50.
`packages/machine/src/programme.ts`, `packages/machine/src/data/bosch-programmes.ts`,
[research/auto-programme-evidence.md](research/auto-programme-evidence.md). Wash 4 of the
protocol and a power log of an Auto run (item 10) are what would calibrate it.

## Calibration data (needs the machine)

### 9. Test washes (medium; needs the machine and a kitchen scale)

*What is wrong.* One wash of four plates is all the calibration there is. The kind of soil that
carries about three quarters of every level's margin (smoothie, tomato soup, ketchup and
guacamole in hollow pieces) has never been in a real test wash.

*Where.* [calibration/protocol.md](calibration/protocol.md) has four washes written for a
kitchen: hollow pieces the right and the wrong way up with tea in mugs; porridge bowls nested
and free; nested and crowded cutlery; weighed yolk plates on Auto 45-65.
[calibration/wash-record.md](calibration/wash-record.md) is the format of a result.

*What would settle it.* Any one of them, sent in as the protocol describes.

*For a contributor without the machine:* the planned records and predictions for these washes
are not made yet (protocol, "What is missing before these washes are run"). The candidate
records under `packages/calibration/records/owner/candidates/` hold places on the upper basket
as it was drawn before its correction; they have to be made again
(`packages/calibration/scripts/make-owner-candidates.ts`), a prediction written for each with
`spotless-fit predict`, and the ranking run again (`spotless-fit rank`,
[calibration/fitting.md](calibration/fitting.md) section 7).

### 10. A power log of one Eco 50 run (small; needs the machine and a metering plug)

*What is wrong.* The share of the long soak during which the pump runs is fitted, not measured
(0.8, anywhere from 0.59 to 1), and it is confounded with the enzyme level of the capsule and
the reaction rate. The energy the model reports (0.90 kWh against the label's 0.836) does not
follow it.

*Where.* `prog.soakDuty` in the parameter registry; the programme in `packages/machine`;
protocol, "What cannot be measured without an instrument". A log goes into a wash record as
`course.power_log`.

*What would settle it.* One reading a minute of mains power over one Eco 50 run. The soak duty
would be read off instead of fitted.

*Caution.* Use only a plug-in meter, rated for the full load on the machine's rating plate,
between the machine's own plug and the socket. If the machine is wired to a fused spur, or the
plug cannot be reached without pulling the machine out of its housing, leave it: do not open,
move or rewire anything, and do not run the machine on an extension lead. The protocol says the
same at more length.

### 11. Tape measurements of the machine (small to take; medium to carry through)

*What is wrong.* Four dimensions are inferred from photographs: the height of a lowered cup
shelf, the height of the hub of the upper arm (44 mm from a photograph against 55 in the
data), the gap between the lower basket and the tub walls (9.5 and 10.5 mm, good to about
6 mm), and the outer size of the upper basket. The standard 13-place load holds only 114 of
140 pieces partly because of them.

*Where.* `packages/machine/src/data/bosch-smv4hax40g.ts`; protocol, "Measurements of the machine
still open".

*What would settle it.* The readings. Carrying one through means changing the machine data,
settling every saved load again and making the parameter set current again, which the
maintainers intend to do from a reading sent as an issue.

### 12. The tub's right wall sometimes stops the basket (medium)

A board leaning out about 16 mm stops the lower basket in 4 of 8 poses tried, because the wall
is drawn as a sheet with a square front edge and no lead-in. The geometry of the tub in
`packages/machine/src/geometry`; `packages/session/src/tub-clearance.test.ts`; platform.md,
"Deferred or open".

## The benchmark

### 13. Run a model through Anthropic's API (small; costs money)

*What is wrong.* That path of the harness has unit tests against a local stand-in and has never
met the live API. What folding a long conversation does to such a model's carried reasoning is
therefore unmeasured: a model on the Responses API keeps it across a fold, and, if the API
behaves as documented, an Anthropic model would lose it. That is a property of this harness,
not of the models.

*Where.* `packages/bench/src/anthropic.ts`, the context policy in
`packages/bench/src/context.ts`; [benchmark/README.md](benchmark/README.md) section 2 and
section 10.

*What would settle it.* One episode on the tutorial (about half a million input tokens), then
one on a full level (about three million) with folds, with the records sent as a pull request.

### 14. Repeat episodes, and decide what a result is (medium; costs money, and a design decision)

Every model cell is one episode. The two models are 14 and 15 points apart in opposite
directions on two levels, and both beat the careful reference player, so there is nothing to
normalise by. Open: how many episodes make a cell, whether every model is run at one reasoning
effort, and what a score is divided by. benchmark/README.md sections 9 and 10.

### 15. Collect a human baseline (medium; people and time, not code)

The links, the participant names and the records exist, and no person has played a scored
episode. benchmark/README.md section 4; `packages/server` (the `link` command); `apps/web`.

### 16. The tutorial fails its own gate (small to medium)

Its careless reference load loses 9.4 % of the points against a gate of 20 % (64 against 58),
because the scripted careless player cannot turn the tutorial's cups, which lean on a rest
under the knife shelf. `course-table --gates` exits 1 for it. `packages/levels` (the
tutorial), `packages/loader/src/mistakes.ts` and `policy.ts` (the careless player),
`packages/bench/scripts/course-table.ts`; [benchmark/levels.md](benchmark/levels.md)
sections 5 to 8. Three ways out are listed there: teach the careless player to fold the shelf
up, give the tutorial more cups (tests pin its 12 pieces), or exempt it as the level that
teaches the interface.

### 17. The scripted players are neither a ceiling nor a floor (medium)

The careful player places no pan, dish, tin, tray or board, and both models beat it. The
careless player cannot nest a bowl or put two plates in one slot on the present baskets, and
cannot block the tablet or stall an arm on purpose; the large margin of the dinner party is an
accident of a glass that fell across the tablet's path. `packages/loader/src` (`policy.ts`,
`posture.ts`, `mistakes.ts`); platform.md, "Deferred or open".

### 18. The course gets fuller, not harder to wash (medium to large; depends on items 1 and 2)

Neither model made the hollow-piece mistake that every gate rests on. 31 to 40 % of each
level's points sit in glasses, mugs and little pots. The cooked-egg frying pan of the breakfast
(18 points) did not come clean in any placement tried. A level about nesting, about the
tablet's path or about a stalled arm is not possible until the wash answers to those.
`packages/levels`; `packages/bench/scripts/mistake-study.ts`; benchmark/levels.md section 8.

## The game and the agent interface

### 19. Placing by pointing on the page (medium; a good issue for a front-end contributor)

A plate pointed at the gap beside a placed plate perches on its neighbour, and cups and glasses
cannot be leant on the side rests of the upper basket by pointing. Only "Suggest spots" finds
those seats. `apps/web/src` (`aim.ts`, `stance.ts`, `stage.ts`), `list_slots` in
`packages/session`.

### 20. Slow placements block the server (medium)

Placing onto an untidy pile takes seconds to a minute and blocks every other request while it
does; `list_slots` for a plate takes 2.5 to 4.8 s once the neighbouring slots are full.
`packages/physics`, `packages/session`, `packages/server`.

### 21. Rough edges of the agent interface (small; several separate issues)

- `rotation_deg` in the result of `place` cannot tell a fork that spun in its cell from one that
  fell; a lean from the vertical is wanted.
- `list_slots` for a cup when every rest is full answers with no places, which reads as "this
  never has a place".
- `set_rack` on the upper basket lists lower-basket plates among its changes, moved by fractions
  of a millimetre.
- The rims of the baskets and the box of the cutlery basket are not on the rack card, so an
  agent sees in a picture what the page has as free geometry.

`packages/session`, `packages/mcp/src/shape.ts`.

### 22. Open design questions

Whether taking up tine rows should cost an agent a query, whether water left standing should
fail an item by itself, whether a piece dropped out of the machine should cost an action, and
others are listed with what the code does today in benchmark/README.md section 10 and at the
end of [design/platform.md](design/platform.md). An issue that argues one of them is welcome.

## Platforms

### 23. Linux and Windows are untested (medium; the first step is small)

*What is wrong.* Every figure was measured on one Mac. The `webgpu` package carries Dawn
binaries for Linux and Windows, but nobody has run a wash there. The lookup of Chrome and the
browser flags for those systems are written and have not been run. Results depend bit for bit
on the GPU, the operating-system build and the Dawn version, so stored result hashes are not
expected to repeat on another machine; verdicts and points should.

*Where.* `packages/sim-gpu`; the GPU tests (`*.gpu.test.ts`, and
`packages/sim-params/src/gpu-parity.test.ts`), which skip themselves when no device opens (only
the last can be made to fail instead, with `SPOTLESS_REQUIRE_GPU=1`);
`packages/render/src/headless/chrome.ts`; the workflow **checks** (`.github/workflows/ci.yml`),
whose Linux job typechecks and runs the hygiene check, and washes nothing.

*What would settle it.* Run `pnpm install`, `pnpm typecheck`, `pnpm test` and one
`wash-load tutorial-careful --tier fast` on another system and report what happens, in an issue
with the output. That alone is a useful contribution.

### 24. The test suite has never passed on a hosted machine (small)

The whole suite runs on macOS in a workflow of its own, started by hand
(`.github/workflows/tests-macos.yml`). It has not yet been seen to pass on a hosted runner,
whose GPU is virtual. Once it has passed a few times, run it on every pull request and make it
required.

## The loading advice

### 25. The title of the in-game loading advice (small; waits for a decision)

*What is wrong.* The advice shown to every player is the project's own summary of the loading
section of the manufacturer's manual, and its first line says so ("in short"). Its title,
though, is "Loading the dishwasher: the manufacturer's advice", which reads as the
manufacturer's own words.

*Where.* `LOADING_GUIDANCE_TITLE` in `packages/server/src/guidance.ts`, and the title of the
resource in `packages/mcp/src/server.ts`.

*What would settle it.* A title such as "Loading the dishwasher: advice summarised from the
manufacturer's manual". The guidance is part of what every player is shown and its version is
written into every episode record (`versions.guidance_version`, now 2), so a new title means a
new guidance version beside the episodes already stored. That is why it waits for a decision
and was not changed in passing.

## Housekeeping

- **No package has a README.** The entry points most worth one are `packages/bench`,
  `packages/mcp`, `packages/wash-runner` and `packages/calibration`.
- **Pictures on disk are never pruned.** The render service keeps every picture under
  `<data>/renders/` and page scripts under the system's temporary directory
  (benchmark/README.md section 11).
- **Four screenshots show a placeholder wash.** `apps/web/screenshots/26-washing.png`,
  `27-report.png`, `31-preview-report.png` and
  `32-full-wash-report.png` were made by a script that uses a stand-in for the wash
  (`apps/web/scripts/play-tutorial.ts`); the reports in them say that nothing was simulated.
  They should be made again with a real wash. The pictures under `apps/web/screenshots/wash/`
  are of real washes.
- **"It is never possible to fit everything" is untrue of the first load.** The sentence opens
  the game for every player: the page says it (`apps/web/src/app.ts`, `how-to.ts`) and so does
  the prompt of the harness (`packages/bench/src/prompt.ts`). The first load is twelve things
  that all fit. The prompt's version is written into the record of every model episode
  (`PROMPT_VERSION`, now 3), so a new wording means a new prompt version beside the episodes
  already stored.
- **Small gaps in the command lines.** `serve` and the MCP command line accept an empty `--host`,
  which Node takes as every address, and `--allow-host` refuses a host name with an underscore.
  `wash-load` and the MCP command line answer `--help` with an error, not with their usage text.
  The hygiene check reads the working files, not what is staged.
- **One test and one script look for Chrome their own way.**
  `packages/server/src/render-service.test.ts` skips itself unless Chrome is at the macOS
  default path or `SPOTLESS_CHROME` is set, and `packages/machine/scripts/render-drawings.ts`
  reads a variable of its own, `CHROME_PATH`. Both could use the shared lookup in
  `packages/render/src/headless/chrome.ts`.
- **The formatter is not enforced.** Many stored reports and a few source files do not pass
  `pnpm format:check`. Bringing the simulation's source into line changes its fingerprint, so
  it is a job to do once, deliberately, with the parameter set made current afterwards.
