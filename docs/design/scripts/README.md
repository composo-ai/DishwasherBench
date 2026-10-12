# Design check scripts

Throwaway arithmetic and numerical checks written by the design panel while producing
`../sim-core.md`. That document cites them by file name (for example `budget3.py`, `s1d.py`,
`checks.py`). They are kept as evidence and as the starting point for the reference
implementations and tests in `packages/sim-verify`; they are not maintained code.

- `synth/` : the chief architect's checks for the merged design.
- `revise/` : checks written while applying the red-team findings, including the one-dimensional
  reference for the inertial film scheme (`s1d.py`, `s1d_tests.py`, `s1d_puddle.py`) and the
  per-pass budget (`budget3.py`).
- `physics-audit/`, `engineering-audit/` : the two red-team reviewers' checks.

`../proposals/` holds the three competing architecture proposals and the panel's verdicts.
