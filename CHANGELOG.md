# Changelog

## Unreleased

- Eco 50 is the only programme. The machine's other programmes, the SPOT-60 test machine and
  the `--programme` options of the command lines are gone, and the machine data names Eco 50 as
  its programme ([issue 42](https://github.com/composo-ai/DishwasherBench/issues/42)).
- Drying, spots and film on glass, items moved by the jets, soil settling on clean items,
  flaking of thick layers and where a tablet lands outside its tray are out of scope
  ([docs/design/scope.md](docs/design/scope.md#out-of-scope)).
- The phenomena suite drops P27 and P32, which compared programmes, and reports the nine
  phenomena that turn on those mechanisms as out of scope.
- The parameter set `anchored-v7.owner-capsule` was re-stamped for the changed machine data; no
  result changed.

## 0.1.0 (12 October 2026): first public release

- The game Spotless on a simulation of one Bosch SMV4HAX40G, scored on its Eco 50 programme: a
  course of seven levels, a page for people, an MCP server for agents and a harness that writes
  verifiable episode records.
- The wash simulation calibrated on one test wash of the real machine, with its checks and
  their results ([docs/validation/README.md](docs/validation/README.md)).
- The first six model episodes, with records and transcripts
  ([docs/benchmark/first-runs/course/](docs/benchmark/first-runs/course/README.md)).

The MCP tool interface and the harness carry their own version numbers (both 0.2.0 in this
release). They are written into every episode record and are independent of the release number.

What is known to be wrong, missing or untested is in [docs/ROADMAP.md](docs/ROADMAP.md).
