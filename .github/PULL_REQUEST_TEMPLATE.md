<!-- Thank you. CONTRIBUTING.md has the detail behind every line below. -->

## What this changes

<!-- What and why, in a few sentences. Link the issue if there is one. -->

## Checks

- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` passes on my machine, or I ran the tests of the packages I touched and say below which. My machine is:
- [ ] `pnpm hygiene` passes: no personal path, no metadata in a picture, no key, no compiled program, no file the check cannot look into.
- [ ] I did not run the formatter over files I did not write.

## The simulation's source

<!-- A wash refuses to run when the simulation's source or the machine data changes. See "The fingerprint rule" in CONTRIBUTING.md. Tick one. -->

- [ ] This does not touch a non-test `.ts`, `.json` or `.wgsl` file under `src/` of `catalogue`, `core`, `geometry`, `inspector`, `machine`, `wash-runner` or a `sim-*` package.
- [ ] It does, it does not change what a wash computes, and I ran `revalidate.ts` and committed the re-stamped parameter set.
- [ ] It does, and it changes what a wash computes. I say below which stored results are now out of date.

## Photographs, records and transcripts

- [ ] None added, or: they carry no metadata and show or name no face, no person, no serial number and nothing that locates a home; records and transcripts hold no key and no address of an endpoint.

## Notes for the reviewer

<!-- What you could not check, what you are unsure of, what is left undone. -->
