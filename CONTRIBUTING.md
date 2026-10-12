# Contributing to DishwasherBench

Thank you for looking. This is a small research project with one unusual property: its
simulation is tied to a calibrated parameter set by a fingerprint of the source, so a change to
the simulation has consequences that a change elsewhere does not. This page says how to set up,
what to check before a pull request, how that fingerprint works, what is welcome, and the
privacy rules for photographs and records.

By taking part you agree to the [code of conduct](CODE_OF_CONDUCT.md). Security problems, and
anything in the repository that should not be public, go to the address in
[SECURITY.md](SECURITY.md), not into a public issue.

## Setting up

The [README](README.md#quick-start) has the requirements and the quick start. In short:

```sh
git clone https://github.com/composo-ai/DishwasherBench.git
cd DishwasherBench
corepack enable
pnpm install --frozen-lockfile
```

The project has been run on one machine, a Mac with Apple silicon. If you are on Linux or
Windows you are on untested ground, and a report of what happens is itself a welcome
contribution.

There is no build step for the packages. They are TypeScript source run with `tsx`; packages
are named `@spotless/<name>` and each `package.json` points its `exports` at `src/index.ts`.

## Checks to run before a pull request

| Command             | What it checks                                                                                                                                        | How long, on the reference machine                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `pnpm typecheck`    | The root and every package                                                                                                                            | A few seconds                                                |
| `pnpm test`         | Every package's tests. Many of them run real washes on the GPU                                                                                        | 8 to 17 minutes, depending on what else the machine is doing |
| `pnpm hygiene`      | That no file to be published carries a personal path, metadata in a picture or an MP3, a key, a compiled program or a file the check cannot look into | About 5 seconds                                              |
| `pnpm hygiene:test` | The tests of the hygiene check itself; only needed if you changed it                                                                                  | Under a second                                               |

One package at a time is quicker while you work:

```sh
pnpm --filter @spotless/core test
```

One test is skipped by design. A Dawn validation message about an empty texture in the test
output comes from a test of failures and is not an error. The tests leave a cache of about
50 MB in `packages/sim-verify/phenomena/.spotless/`, which git ignores.

Continuous integration is two workflows under `.github/workflows/`. **checks** (`ci.yml`) runs
on Linux on every pull request, on every push to `main`, and when started by hand: the hygiene
check and its tests first, then install and typecheck. It runs no wash and no test but those of
the hygiene check. The whole test suite on macOS is a separate workflow, `tests-macos.yml`,
which is started by hand only and has a limit of 90 minutes: it has not yet been seen to pass
on a hosted machine, whose GPU is virtual. So please run `pnpm test` yourself and say in the pull
request on which machine.

## The fingerprint rule

**In plain words: if you change a source file of the simulation, the wash will refuse to run
until the parameter set has been checked against your change.**

### What it protects

The game washes with a calibrated parameter set (`anchored-v7.owner-capsule`, in
`packages/calibration/anchors/`). Its numbers were fitted against what the simulation's code
computed on the day. If the code that decides where the water goes changes afterwards, those
numbers may no longer mean what they meant, and a score would silently stop being comparable
with every score before it. So the set records a fingerprint of the code and of the machine
data it was made for, and nothing washes with it when the fingerprint on disk is different.

A fingerprint is a SHA-256 hash of the bytes of a set of source files
(`packages/sim-core/src/node/fingerprint.ts`). The bytes, not the meaning: a changed comment
changes it, and so would a different line ending, which is why `.gitattributes` keeps every text
file LF on every platform.

### Which files

Every non-test `.ts`, `.json` and `.wgsl` file under `src/` of these packages:

- `core`, `geometry`, `sim-film`, `sim-gpu`, `sim-hydraulics`, `sim-jets`, `sim-params`,
  `sim-scene`, `sim-spray`, and two files of `sim-core` (`exposure-cache.ts`, `scene-setup.ts`):
  the **water side**. The parameter set records this fingerprint.
- `machine`: the **machine data**. The parameter set records this fingerprint too.
- Those, plus `catalogue`, `inspector`, `wash-runner` and every other package whose name starts
  with `sim-` (`sim-core`, `sim-liquor`, `sim-soil`, `sim-timeline`, `sim-rigid`, `sim-verify`):
  everything a wash **result** depends on. This third fingerprint is part of the name of the
  wash code in every report and record (`wash-runner 2+src.f58d4ed8ab930946`) and keys the
  results the game server stores.

Test files (`*.test.ts`), `testing/` directories, scripts, reports, documents and every other
package (`session`, `levels`, `loader`, `physics`, `server`, `mcp`, `bench`, `render`,
`calibration`, `apps/web`) are outside all three.

### What happens when you change one

After a change to the water side or to the machine data (tried with one comment added to
`packages/core/src/index.ts`):

- every wash stops before it starts and says what differs, for example
  `water side: fitted on exposure sources 325c9602e385, those on disk are 83214936e0a2`. That
  is the game server, `wash-load`, the harness and the calibration tool alike;
- one test of `packages/wash-runner` fails ("washes the owner's machine out of the box");
- `pnpm --filter @spotless/calibration exec tsx anchors/scripts/check.ts` reports one failed
  check.

After a change to a file that is only in the third group (tried with one comment added to
`packages/sim-soil/src/index.ts`), the wash still runs and the whole test suite still passes.
What changes is the name of the wash code in every new report, so stored results made by the
old code are no longer reused, and `bench verify --rewash` on an older record says that it was
washed under other wash code.

**The guard does not cover everything.** A change to the soil, the wash water, the timeline or
the inspector that alters what a wash computes is not stopped by any fingerprint: the parameter
set records the water side and the machine data only. The duty is the same all the same (see
"If your change alters what a wash computes" below), and it rests on you to say so.

### What you must do

**If your change does not alter what a wash computes** (a comment, a rename, a refactoring, a
diagnostic), make the set current again:

```sh
cd packages/calibration && pnpm exec tsx anchors/scripts/revalidate.ts
```

This washes one reference load again at the fast tier (about a minute) and compares the result
with the one the set recorded, item by item, to a nanogram of residue. If it is the same, it
re-stamps three files, `anchored-v7.json`, `anchored-v7.owner-capsule.json` and
`anchored-v7.owner-capsule.stable.json`, with the fingerprints of the code on disk. Commit those
three files with your change, and say in the pull request that you did. Then

```sh
pnpm --filter @spotless/calibration exec tsx anchors/scripts/check.ts
```

passes again (2 seconds), the wash runs and the whole test suite passes. One stored report,
`packages/sim-verify/levels/level-contrast.json`, was made by the old water-side code; its test
stops judging it and prints a warning that says so, until the maintainers make the report
again. If the result of `revalidate.ts` is not the same, it writes nothing and says by how much
it differs: your change alters the wash, and the next paragraph applies.

**If your change alters what a wash computes** (a fix to the physics, a new mechanism, a
corrected dimension of the machine), the parameter set has to be fitted again under a new name
and the stored results made again. That is the work
[docs/calibration/anchoring-v7.md](docs/calibration/anchoring-v7.md) records for the last such
change, with its commands in section 12: the fit (`anchors/scripts/fit.ts`, then
`make-owner-set.ts`), the old set marked as replaced (`supersede.ts`), the saved loads settled
again if the machine changed, and the reference tables, the course table and the phenomena
report washed again ([docs/benchmark/levels.md](docs/benchmark/levels.md) section 9 has those
commands). It takes hours of washes, and it has only ever been done during the build. **Please
open an issue before you start**, so that the maintainers can agree the change with you and,
where they can, help with the refit. A pull request that changes the wash and leaves the set
stale cannot be merged as it is, but it is a fine way to show the change.

To try a change before any of that, the commands take `--accept-stale-params` (for example
`pnpm --filter @spotless/wash-runner wash-load tutorial-careful --tier fast --accept-stale-params`):
the wash then runs with the set's values, and its report carries a note that the set was made
for another state of the simulator and that the result is provisional.

**Do not run the formatter over the repository** (`pnpm format`): see "Style" below.

## What is welcome

- **Bug reports**, above all from machines other than the one this was built on. The issue form
  asks for what is needed.
- **Results that look physically wrong.** The simulation is known to be wrong in several ways
  ([docs/validation/README.md](docs/validation/README.md) section 8), and a concrete load that
  shows one is valuable. The issue form asks for the load and the report.
- **Test washes of a real machine.** If you have a Bosch SMV4HAX40G,
  [docs/calibration/protocol.md](docs/calibration/protocol.md) has four washes that can be done
  at home, the measurements of the machine that are still open, and how to send a result in. A
  result is a _wash record_ ([docs/calibration/wash-record.md](docs/calibration/wash-record.md)),
  checked with `pnpm --filter @spotless/calibration spotless-fit validate <record>.json`.
- **New levels.** A level lives in `packages/levels`; its three reference loads are generated
  and washed, and it joins the course only when it passes the gates
  ([docs/benchmark/levels.md](docs/benchmark/levels.md) sections 6 and 9).
- **Model results**, with their episode records. Run the harness as the README describes and
  send the whole output directory of each episode (`record.json`, the transcript, the
  pictures), not a table of numbers: a record can be verified by replay
  (`bench verify <record> --rewash`), and a number cannot. Say which model, which endpoint kind
  and which reasoning effort. One episode per cell is an anecdote; say how many you ran. The
  issue form "Model results" asks for these.
- **Questions.** There is an issue form for a question. The project is maintained at a small
  scale, so an answer may take a while.
- **Ports to other platforms**: Linux, Windows, other GPUs. See item 23 of the
  [roadmap](docs/ROADMAP.md).
- **Anything on the [roadmap](docs/ROADMAP.md).**

## Privacy rules for photographs, records and transcripts

Everything in this repository is public for good. Before you add a photograph, a wash record, an
episode record or a transcript, make sure of the following.

- **No metadata in pictures.** No camera, date, position or embedded preview. A JPEG may keep
  what a viewer needs to show it correctly (the orientation flag, the colour-sample position
  tag, the resolution and a colour profile) and nothing else; a PNG may hold no text chunks.
- **No faces and no people.** If a hand is in the picture, no readable fingerprints.
- **No serial numbers.** Not of the machine (do not photograph the rating plate; give the model
  number in words) and not of anything else.
- **Nothing that locates a home.** No view out of a window or door, no label with an address,
  no post, no screen.
- **No names** in records, unless you want yours there. In a wash record, `provenance.by` can be
  "a contributor".
- **No keys and no addresses of services.** The harness writes neither into a record. Read a
  transcript before you send it all the same: a provider may put identifiers of its own in a
  reply. The transcripts already here carry generated tool-call identifiers in place of the
  provider's ([docs/benchmark/first-runs/README.md](docs/benchmark/first-runs/README.md)).
- **No absolute paths of your machine.** Write paths relative to the root of the repository.

`pnpm hygiene` checks what a program can check: personal paths in the spellings they take in
logs and records (and in the names of files and directories), metadata in pictures and MP3
files, the common shapes of keys and named values that look like keys, a filled-in
`.env.example`, compiled programs, very large files, and files it cannot look into. It
runs in CI on every pull request. It **cannot** see what a photograph shows, or a name that is
not part of a path. That part is yours.
[docs/reference/REDACTIONS.md](docs/reference/REDACTIONS.md) shows how the photographs already
here were treated.

**Preparing a picture so that it passes.** A photograph straight from a phone and a screenshot
straight from the system both fail, because they carry metadata. When the check fails on a
picture it prints, for each file, the command that makes it pass. For a JPEG that is
`exiftool -all= -tagsfromfile @ -Orientation -icc_profile -overwrite_original <file>`, which
keeps which way up the picture is and its colour profile (without `-icc_profile` where the
check does not accept the profile); for a PNG it is `exiftool -all= -overwrite_original <file>`.
Both need [ExifTool](https://exiftool.org). Run the command and run `pnpm hygiene` again. Then
look at the picture itself: removing metadata does not remove what it shows.

A PDF, a film, an archive, a picture in another format than JPEG or PNG, or any other binary
file fails, because the check cannot look into it. Convert it if you can. If it has to be
published as it is, look into it by other means and add its path and SHA-256 to
`ALLOWED_UNINSPECTED` in `scripts/check-hygiene.mjs` in the same pull request; the failure
prints the line to add.

In documents, write an example path with a placeholder for the user (`/Users/you/...`,
`/home/you/...`), since the check fails on anything that looks like a real home directory.

## How changes get in

- Commits to `main` are made by the maintainers. Changes from anyone else come as pull requests
  from a fork or a branch.
- Keep a pull request to one thing. Fill in the template: it is the list of checks above.
- For anything larger than a small fix, open an issue first. It saves you work if the
  maintainers already know why something is as it is; much of that is written down in
  `docs/`, and [docs/README.md](docs/README.md) is the index.
- If your change makes a document wrong, change the document in the same pull request. The
  documents labelled as records of the build in [docs/README.md](docs/README.md) are kept as
  written: add to the current documents instead.
- Numbers in documents come from runs. If you state a figure, say which command produced it.

## Style

- TypeScript is strict, ESM only, named exports only. Write the `.ts` extension in relative
  imports.
- SI units inside; millimetres and degrees in catalogue files and on the wire. A value that is
  not SI carries its unit in its name (`diameterMm`, `yaw_deg`).
- Every physical constant of the wash is in the parameter registry with a default, a range and
  a source. Do not hard-code one.
- Dependency versions are pinned exactly. `vitest`, `puppeteer-core` and `@fastify/static` are
  deliberately behind the registry (later versions need Node 22). `webgpu` is pinned at 0.6.2,
  and its version is part of the string every result and cache key carries: do not raise it in
  passing.
- A browser started by a script must be muted (`--mute-audio`), because the page plays music.
  `launchChrome` in `apps/web/scripts/driver.ts` does it.
- Scripts that write screenshots or reports write into tracked directories by default. Give
  them `--out <a directory under .spotless/>` unless you mean to replace the stored ones.
- **The formatter is not enforced, and must not be run over the whole repository.** There is a
  Prettier configuration, and `pnpm format:check` currently reports more than 300 files: most
  are stored reports, saved loads and tables, and two are source files of the simulation.
  `pnpm format` would rewrite all of them. Rewriting a source file of the simulation changes its
  fingerprint and makes the parameter set stale, and rewriting stored results makes a diff that
  nobody can review. Format the files you wrote and no others:

  ```sh
  pnpm exec prettier --write path/to/your-file.ts
  ```

- Plain words and British spelling in documents and comments.

## Licence of contributions

DishwasherBench is under the [MIT licence](LICENSE). By sending a pull request you agree that
your contribution is released under that licence, and you confirm that you have the right to
release it: that photographs are your own, and that data is yours to publish.
