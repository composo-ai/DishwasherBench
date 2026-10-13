# Roadmap: the open problems

What is known to be wrong, missing or untested is tracked as
[issues](https://github.com/composo-ai/DishwasherBench/issues). Each issue says what is wrong, where
to look and what would settle it. This page is the map of them. The evidence for most of them is in
[validation/README.md](validation/README.md); the status against the original plan is at the end
of [design/scope.md](design/scope.md).

Nothing here is scheduled. If you want to work on one, say so in a comment on its issue so that
two people do not do the same thing, and read [CONTRIBUTING.md](../CONTRIBUTING.md) first: a
change to the simulation's source has consequences that a change elsewhere does not. Something
that is wrong and is not listed here deserves a new issue.

**Labels.** Every issue here carries its area (`simulation`, `calibration`, `benchmark`,
`interface`, `platforms` or `housekeeping`) and a size: `size: small` is an afternoon to a few
days, `size: medium` a week or two, `size: large` research with no known answer. `needs-machine`
means a Bosch SMV4HAX40G. `needs-decision` means the maintainers have to decide something before
the work can start. `good first issue` marks what a newcomer can do without knowing the
simulation.

When an issue is closed, take its row out of this page in the same pull request; when a new open
problem is filed, add its row.

## The simulation

| Issue                                                          | Open problem                                                                         | Size   | Notes             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------ | ----------------- |
| [#1](https://github.com/composo-ai/DishwasherBench/issues/1)   | Plates and cutlery do not answer to stacking (the open blocker)                      | large  |                   |
| [#2](https://github.com/composo-ai/DishwasherBench/issues/2)   | Faces lying within a millimetre or two of another body come out too clean            | large  |                   |
| [#3](https://github.com/composo-ai/DishwasherBench/issues/3)   | Fat comes clean with no detergent, and at 35 °C                                      | medium |                   |
| [#4](https://github.com/composo-ai/DishwasherBench/issues/4)   | Starch always comes clean, and too much goes in water alone                          | medium |                   |
| [#44](https://github.com/composo-ai/DishwasherBench/issues/44) | The total amount of soil in a load does not change how well it washes                | medium |                   |
| [#5](https://github.com/composo-ai/DishwasherBench/issues/5)   | Repair the faulty phenomenon scenarios (P05, P35, P40)                               | small  | good first issue  |
| [#6](https://github.com/composo-ai/DishwasherBench/issues/6)   | Run the whole phenomena suite at the official tier                                   | small  |                   |
| [#53](https://github.com/composo-ai/DishwasherBench/issues/53) | Phenomena reports record the parameter set by an absolute path                       | small  |                   |
| [#45](https://github.com/composo-ai/DishwasherBench/issues/45) | There are no saved loads that show the stacking mistakes behind the open blocker     | medium |                   |
| [#46](https://github.com/composo-ai/DishwasherBench/issues/46) | The fast tier gets the same forks and knife wrong in every wash of the standard load | medium |                   |
| [#7](https://github.com/composo-ai/DishwasherBench/issues/7)   | Not modelled at all: drying, spots on glass, items moved by jets, redeposition       | large  |                   |
| [#8](https://github.com/composo-ai/DishwasherBench/issues/8)   | Programmes other than Eco 50 are uncalibrated                                        | large  | needs the machine |
| [#42](https://github.com/composo-ai/DishwasherBench/issues/42) | The machine data still names Auto 45-65 as the machine's primary programme           | medium |                   |

## Calibration data

Most of these need the machine itself.

| Issue                                                          | Open problem                                                                  | Size   | Notes             |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------ | ----------------- |
| [#9](https://github.com/composo-ai/DishwasherBench/issues/9)   | Run the test washes of the calibration protocol                               | medium | needs the machine |
| [#10](https://github.com/composo-ai/DishwasherBench/issues/10) | Take a power log of one Eco 50 run                                            | small  | needs the machine |
| [#11](https://github.com/composo-ai/DishwasherBench/issues/11) | Take the four open tape measurements of the machine                           | small  | needs the machine |
| [#43](https://github.com/composo-ai/DishwasherBench/issues/43) | The bore of the lower arm's holes and the speed of both arms are not measured | small  | needs the machine |
| [#12](https://github.com/composo-ai/DishwasherBench/issues/12) | The tub's right wall sometimes stops the basket                               | medium | needs the machine |

## The benchmark

| Issue                                                          | Open problem                                                        | Size   | Notes            |
| -------------------------------------------------------------- | ------------------------------------------------------------------- | ------ | ---------------- |
| [#13](https://github.com/composo-ai/DishwasherBench/issues/13) | Run a model through Anthropic's API                                 | small  |                  |
| [#14](https://github.com/composo-ai/DishwasherBench/issues/14) | Repeat episodes, and decide what a result is                        | medium | needs a decision |
| [#15](https://github.com/composo-ai/DishwasherBench/issues/15) | Collect a human baseline                                            | medium |                  |
| [#16](https://github.com/composo-ai/DishwasherBench/issues/16) | The tutorial fails its own gate                                     | small  | needs a decision |
| [#17](https://github.com/composo-ai/DishwasherBench/issues/17) | The scripted players are neither a ceiling nor a floor              | medium |                  |
| [#18](https://github.com/composo-ai/DishwasherBench/issues/18) | The course gets fuller, not harder to wash                          | large  |                  |
| [#49](https://github.com/composo-ai/DishwasherBench/issues/49) | The soil lab's table is of an earlier wash and cannot be made again | small  |                  |
| [#50](https://github.com/composo-ai/DishwasherBench/issues/50) | Wash the robustness seeds at the official tier                      | small  |                  |
| [#25](https://github.com/composo-ai/DishwasherBench/issues/25) | Open design questions: the rules of an episode and the harness      | small  | needs a decision |
| [#26](https://github.com/composo-ai/DishwasherBench/issues/26) | Open design questions: the course and its gates                     | small  | needs a decision |

## The game and the agent interface

| Issue                                                          | Open problem                                                                          | Size   | Notes            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------ | ---------------- |
| [#19](https://github.com/composo-ai/DishwasherBench/issues/19) | Placing by pointing: plates perch on neighbours, cups cannot be leant on the rests    | medium |                  |
| [#20](https://github.com/composo-ai/DishwasherBench/issues/20) | Slow placements block the server                                                      | medium |                  |
| [#21](https://github.com/composo-ai/DishwasherBench/issues/21) | `rotation_deg` of `place` cannot tell a fork that spun in its cell from one that fell | small  |                  |
| [#22](https://github.com/composo-ai/DishwasherBench/issues/22) | `list_slots` for a cup answers with no places when every rest is full                 | small  |                  |
| [#23](https://github.com/composo-ai/DishwasherBench/issues/23) | `set_rack` on the upper basket lists lower-basket plates among its changes            | small  |                  |
| [#24](https://github.com/composo-ai/DishwasherBench/issues/24) | Basket rims and the box of the cutlery basket are missing from the rack card          | small  |                  |
| [#47](https://github.com/composo-ai/DishwasherBench/issues/47) | View names in the session contract differ from the views that are drawn               | small  | needs a decision |
| [#48](https://github.com/composo-ai/DishwasherBench/issues/48) | What standing water leaves behind is not shown on the residue picture                 | medium |                  |
| [#30](https://github.com/composo-ai/DishwasherBench/issues/30) | The title of the in-game loading advice reads as the manufacturer's own words         | small  | needs a decision |
| [#34](https://github.com/composo-ai/DishwasherBench/issues/34) | "It is never possible to fit everything" is untrue of the first load                  | small  | needs a decision |
| [#55](https://github.com/composo-ai/DishwasherBench/issues/55) | Host-check tests do not cover a server that listens on every address                  | small  | good first issue |
| [#56](https://github.com/composo-ai/DishwasherBench/issues/56) | Small hardening of the servers: framing header, token comparison, start-up line       | small  | good first issue |
| [#27](https://github.com/composo-ai/DishwasherBench/issues/27) | Open design questions: the page                                                       | small  | needs a decision |

## Platforms

| Issue                                                          | Open problem                                                                    | Size   | Notes |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------ | ----- |
| [#28](https://github.com/composo-ai/DishwasherBench/issues/28) | Linux and Windows are untested                                                  | medium |       |
| [#29](https://github.com/composo-ai/DishwasherBench/issues/29) | Get the whole test suite to pass on a hosted runner, then require it            | small  |       |
| [#51](https://github.com/composo-ai/DishwasherBench/issues/51) | Move from Node 20 to a current Node line and raise the three packages held back | medium |       |

## Housekeeping

| Issue                                                          | Open problem                                                                         | Size  | Notes            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----- | ---------------- |
| [#31](https://github.com/composo-ai/DishwasherBench/issues/31) | Write a README for each of the main packages                                         | small | good first issue |
| [#33](https://github.com/composo-ai/DishwasherBench/issues/33) | Remake the four screenshots that show a placeholder wash                             | small | good first issue |
| [#52](https://github.com/composo-ai/DishwasherBench/issues/52) | Two documents describe the manual and the harness as they were                       | small | good first issue |
| [#32](https://github.com/composo-ai/DishwasherBench/issues/32) | Rendered pictures and page scripts on disk are never pruned                          | small |                  |
| [#35](https://github.com/composo-ai/DishwasherBench/issues/35) | `--host` accepts an empty value, and `--allow-host` refuses an underscore            | small | good first issue |
| [#36](https://github.com/composo-ai/DishwasherBench/issues/36) | `wash-load` and the MCP command line answer `--help` with an error                   | small | good first issue |
| [#37](https://github.com/composo-ai/DishwasherBench/issues/37) | The hygiene check reads the working files, not what is staged                        | small | good first issue |
| [#38](https://github.com/composo-ai/DishwasherBench/issues/38) | Relative `--out` and `--data` are taken from the package directory, not the caller's | small | good first issue |
| [#39](https://github.com/composo-ai/DishwasherBench/issues/39) | `wash-load` shows a stale parameter set as a crash                                   | small | good first issue |
| [#41](https://github.com/composo-ai/DishwasherBench/issues/41) | The formatter is not enforced                                                        | small | needs a decision |
| [#54](https://github.com/composo-ai/DishwasherBench/issues/54) | Three forms of personal data pass the hygiene check                                  | small | good first issue |
| [#57](https://github.com/composo-ai/DishwasherBench/issues/57) | Repository settings still to switch on                                               | small |                  |
