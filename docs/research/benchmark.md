# Spotless research dossier: LLM benchmark and human-baseline design

Specialist topic: `benchmark`. Date of research: 2026-10-08. Author role: benchmark research specialist.

Sibling dossiers referenced (not duplicated here): `machine`, `standards`, `jets`, `films`, `soils`, `chemistry`, `numerics`, `items`.

---

## 0. Conventions used in this dossier

**Confidence tags** (exactly one per quantitative claim or per table row):

- **[VERIFIED]** I read the value in the text of a page or PDF fetched during this session. The source is named next to the tag.
- **[RECALLED]** From memory, or seen only in a search-result snippet and not in the fetched primary page. Where it was a snippet I say "(snippet only)". Treat these as candidates for independent checking.
- **[ESTIMATED]** My own derivation or engineering judgement. The derivation is shown, and the value is also listed in section 11 as a calibration parameter.

**Units.** Equations use SI. The agent/human API uses millimetres and degrees on the wire (integer-quantised, see 3.3); the conversion is 1 mm = 1e-3 m, 1 deg = pi/180 rad.

**Terms.**

| Term | Meaning |
|---|---|
| Level | One loading problem: a machine variant, a wash programme, a catalogue of soiled items with point values. One wash cycle decides the score. |
| Family | A level template (theme and trap archetype). Levels in one family differ by seed. |
| Load | The final settled arrangement of the items the player chose to put in. |
| Load manifest | Canonical JSON description of a load (item ids and settled poses) plus the action log that produced it. |
| Wash | One run of the full wash simulation on a load. Budget: up to 30 min wall-clock at p95 on the reference MacBook (project brief). |
| Agent | An LLM plus its harness (scaffold). |
| Reference score R_l | A frozen, best-known score for level l, used as the normalisation anchor. |

---

## 1. Summary of the position this dossier takes

1. **Scoring should be a pure function of the load.** `report = f(simulator_version, level, load_manifest, sim_seed)`. If the agent's episode ends when it presses start, then every 30-minute wash can be run later, in batch, on a reference machine, cached, replayed and audited. This one decision removes most of the practical difficulty of putting a 30-minute simulation inside an LLM evaluation.
2. **One action layer, two front-ends.** The human 3D game and the agent API must be two views of the same server-side session object and the same set of action reducers. Information parity is then a property that can be tested in CI, not a promise.
3. **More levels, fewer repeats.** Under any plausible variance split, between-level variance dominates. 60 test levels run once give a tighter comparison than 40 levels run three times, for half the washes (section 5.4).
4. **Normalise against a frozen simulator-computable reference, and report humans on the same scale.** ARC-AGI-3 changed its human-baseline definition (second-best human to median human) shortly after launch [VERIFIED that the change happened, ARC Prize blog; the date, about three weeks after launch, is RECALLED from a snippet]; a score that depends only on a frozen reference load does not move when human data are revised.
5. **Official results come from private or freshly generated levels, with a fixed minimal harness.** Public levels are for development and for the human baseline. Harness choice has been shown to move scores from 0% to 97% on a single environment elsewhere, so an open-harness track must be separate.
6. **The simulator must publish its own noise.** A thresholded outcome ("clean" or "not clean") amplifies simulation noise. The benchmark needs a measured seed-to-seed standard deviation of the score per level and a rule for levels whose reference load sits on the threshold.
7. **From the benchmark's side, architecture (a) or a mixture (c) with (a) as the scoring backbone is preferable to (b)** because time-homogenised statistics give a low-variance, cacheable, fidelity-scalable score. This is evidence from one topic only; section 7 gives the argument and its limits.

---

## 2. Survey of existing benchmarks

Each entry gives interface, episode structure, scoring, human baseline, reproducibility measures and known criticisms. Entries are grouped by kind. A cross-cutting list of lessons follows in 2.7.

### 2.1 Interactive game and simulation benchmarks for LLM agents

#### ARC-AGI-3 (ARC Prize Foundation, 2026)

Launch date 25 March 2026 [RECALLED] (snippet only). Sources: technical report PDF (`arcprize.org/media/ARC_AGI_3_Technical_Report.pdf`, text extracted locally this session), `docs.arcprize.org/methodology.md`, `arcprize.org/blog/arc-agi-3-human-dataset`.

| Aspect | Detail | Tag |
|---|---|---|
| Observation | 64x64 grid, each cell one of 16 colours; a turn returns a frame or a short frame sequence | [VERIFIED] report 2.3.1 |
| Actions | Per-environment subset of: five key actions, one Undo, one "select a cell by coordinates" | [VERIFIED] report 2.3.2 |
| Turn structure | Turn-based; state never changes asynchronously. Chosen so that "the core challenge is reasoning, rather than perception" | [VERIFIED] report 2.3, 3 |
| Instructions | None. Agent is never told the objective. Official system prompt is one short paragraph ("You are playing a game. Your goal is to win...") | [VERIFIED] report 4.3.1 |
| Episode | Environment = sequence of levels (at least six per environment); first level is an intentionally easy tutorial | [VERIFIED] report 3.3, 3.4 |
| Dataset | 25 public demo, 55 semi-private, 55 fully private environments (135 total). Private sets are deliberately out-of-distribution relative to public | [VERIFIED] report Table 1, 3.6 |
| Score | RHAE. Level score S = min(1.15, (h/a)^2), h = human baseline action count, a = agent action count. Environment score = weighted mean of level scores with weight = level index; unsolved levels score 0. Total = mean over environments | [VERIFIED] report 4.1, docs |
| What counts as an action | Only inputs that change environment state. Tool calls, reasoning steps and retries are free | [VERIFIED] report 2.3.2 |
| Action budget | Agent is terminated after 5x the human median action count per level, justified by cost ("tens of thousands of dollars in API costs") | [VERIFIED] report 4.3 |
| Human baseline | Exactly 10 members of the public per environment; in-person, San Francisco; 90-minute sessions; soft limit 20 min and hard cutoff 30 min per environment; single attempt per environment; fixed fee $115 to $140 plus $5 per environment solved; about nine environments per session; 486 unique participants, 414 candidate environments, 2,893 attempts, 427.9 hours | [VERIFIED] report 5.1 to 5.3 |
| Baseline statistic | Upper-median human action count per level (changed from second-best human on 14 April 2026 per third-party analysis; the blog confirms the move from second-best to median and the cap rising from 100% to 115%) | [VERIFIED] report 4.2, blog (change itself); date [RECALLED] (snippet only) |
| Inclusion rule | Environment kept only if at least 2 of 10 humans fully solved it on first exposure | [VERIFIED] report 5.1 |
| Automated validation | Random-play regimes of 50,000 and 1,000,000 steps; acceptance threshold that a random policy solves a level no more than 1 time in 10,000; recording-based playback of known-good traces to verify reproducibility | [VERIFIED] report 3.5 |
| Harness policy | Official leaderboard uses no harness and no tools, same system prompt for every model; public-set scores are never reported officially; a separate self-reported community leaderboard exists for harness work | [VERIFIED] report 4.3.1, 4.3.2 |
| Launch results | All four frontier models at or below 0.50% on the semi-private set | [VERIFIED] report Table 2 |
| Engine | Custom Python engine, minimum performance target 1,000 frames per second | [VERIFIED] report 3.3 |

Known criticisms and failure modes of the design:

- **The human baseline is a moving, small-sample quantity.** With about 10 players per environment the "second-best" statistic was dominated by luck, and the foundation replaced it with the median and raised the cap [VERIFIED, blog]. Scores published before and after are not comparable without the changelog.
- **Harness sensitivity is extreme.** On a variant of environment TR87, Opus 4.6 scored 0.0% with no harness and 97.1% with a university-built harness, while on BP35 it scored 0.0% under both [VERIFIED, report 4.3.1]. The foundation's answer is to rule harnesses out of the official board.
- **Public set can be replayed.** The foundation ships an open-source harness that scores 100% on every public environment by replaying human traces [VERIFIED, report 4.3.1].
- **Perception parity.** Commentators argue that human eyesight is itself a harness that the model does not get (snippet of a Hacker News discussion) [RECALLED] (snippet only).
- **Incentive artefact in human testing.** Some participants cycled rapidly through environments to collect per-environment payments; those sessions were excluded [VERIFIED, report 5.1].

Relevance to Spotless: closest precedent for "same game for humans and models, human-normalised score, private sets, replayable logs". Spotless differs in that every episode ends in an expensive simulation and the score is an outcome, not an action count.

#### VideoGameBench (Zhang, Griffiths, Narasimhan, Press; arXiv 2505.18134)

Source: arXiv HTML v2.

| Aspect | Detail | Tag |
|---|---|---|
| Games | 23 games: 13 dev, 10 test of which 3 are secret | [VERIFIED] |
| Observation | Raw screen frames only; no parsed state, no overlays, no intermediate reward | [VERIFIED] |
| Actions | Key presses, sequences, timed holds, mouse; default press 0.1 s | [VERIFIED] |
| Real time | Game runs in real time; "Lite" variant pauses the emulator while the model thinks | [VERIFIED] |
| Score | Fraction of game completed, by matching frames against checkpoint images from walkthrough videos with perceptual hashing | [VERIFIED] |
| Limits | Run ends at 20x the walkthrough length (for example Doom II 81 h 44 min) | [VERIFIED] |
| Human baseline | None scored. A human completed first levels through the same interface to show feasibility | [VERIFIED] |
| Results | Best model 0.48% of the test split; 1.6% on Lite | [VERIFIED] |
| Runs | One run per model per game "due to budget"; a small variance study on three games | [VERIFIED] |
| Practice games | Mouse dragging: best model 10%, all others 0%; 2D navigation: best 80% | [VERIFIED] Table 4 |

Criticisms (authors' own and evident): one run per game gives no confidence interval; checkpoint detection is coarse; walkthroughs of every game are online, so contamination cannot be excluded; scores near zero for all models mean the benchmark does not currently discriminate (floor effect).

Relevance: evidence that pixel-only, low-level motor interfaces put current models at the floor, and that dragging in particular is a weak skill. A computer-use track for Spotless would mostly measure this weakness.

#### BALROG (Paglieri et al., ICLR 2025; arXiv 2411.13543)

Source: arXiv HTML v1.

| Aspect | Detail | Tag |
|---|---|---|
| Environments | BabyAI, Crafter, TextWorld, Baba Is AI, MiniHack, NetHack | [VERIFIED] |
| Observation | Two modes: language-only description, or language plus one image of the current state (history stays text) | [VERIFIED] |
| Actions | Natural-language action string from a small named set; invalid action gives feedback and a fallback action is executed | [VERIFIED] |
| Seeds | BabyAI 25 seeds x 5 tasks; Crafter 10; TextWorld 20 x 3; Baba Is AI 5 x 40; MiniHack 5 per task | [VERIFIED] appendices |
| Score | Progression 0 to 100 per environment (binary for some, proportional for others, data-informed for NetHack); standard error from replicate seeds | [VERIFIED] |
| Contamination defence | All environments procedurally generated | [VERIFIED] |
| Human baseline | None | [VERIFIED] |
| Headline results | Best language-only average 32.34 +/- 1.49; best vision-language 29.08 +/- 2.21; NetHack about 1.5% | [VERIFIED] Tables 2, 3 |

Findings that matter here: several models score lower when given the image than with text alone, and the paper documents a "knowing-doing gap" (the model can state that an action is fatal and then takes it) [VERIFIED].

#### lmgame-Bench (Hu et al., ICLR 2026; arXiv 2505.15146)

Source: arXiv HTML v2.

| Aspect | Detail | Tag |
|---|---|---|
| Games | Super Mario Bros, Tetris, Sokoban, Candy Crush, 2048, Ace Attorney | [VERIFIED] |
| Interface | Unified Gym-style API; optional harness modules for perception (grid to text table), memory (recent states plus reflection) and reasoning | [VERIFIED] |
| Runs | Three runs per model per game, single run for the most expensive models | [VERIFIED] |
| Random-baseline finding | Without the harness, 40% of game runs fail to beat random play; with it, 86.7% beat random | [VERIFIED] |
| Harness effect | Example: Sokoban, one model goes from 1.3 +/- 0.6 to 5.3 +/- 1.2 with both modules | [VERIFIED] Table 2 |
| Prompt sensitivity | Variability across empirically tuned prompts can exceed one standard deviation; prompt optimisation cut variance on 2048 by 33.8% to 63.5% | [VERIFIED] |
| Contamination checks | Frame-ordering test for visual memorisation; entity masking and paraphrase for text | [VERIFIED] |
| Human baseline | None | [VERIFIED] |

Lesson: a benchmark must state which harness modules are allowed and report a random baseline, or scores are uninterpretable.

#### Factorio Learning Environment (Hopkins, Bakler, Khan; arXiv 2503.09617; NeurIPS 2025 D&B)

Source: arXiv HTML v1.

| Aspect | Detail | Tag |
|---|---|---|
| Interface | Agent writes Python against an API in a REPL; 10 observation methods and 13 action methods; output is stdout/stderr | [VERIFIED] |
| Step | One program submission; history older than 32 steps is summarised to 1,024 tokens | [VERIFIED] |
| Lab-play | 24 tasks, at most 128 steps, 4 runs per task; success if throughput beats a target over a 60 s holdout | [VERIFIED] |
| Open-play | Up to 5,000 steps, 8 runs, median reported; reward is a value-weighted production score, plus milestones | [VERIFIED] |
| Determinism | Map fixed by seed; game version pinned; model access dates listed | [VERIFIED] |
| Human baseline | None formal; authors say they out-performed agents in equivalent game time | [VERIFIED] |
| Results | Best model completes 7 of 24 lab tasks; 56% of steps in successful lab runs raised execution errors | [VERIFIED] |
| Throughput | Headless server about 218 operations per second, 68 through the Python layer | [VERIFIED] |

Authors' stated limitations: the code API differs from the mouse-and-screen interface of the game, so human comparability is unclear; agents occasionally triggered a reset of game state (a reward-hacking risk); weak spatial reasoning and repeated identical "fixes" [VERIFIED].

The current repository exposes an `fle eval` CLI, an optional MCP extra and a Postgres extra for trajectory storage [VERIFIED, GitHub README]; I could not confirm a Gymnasium registry or an Inspect integration from the README text I read.

#### Vending-Bench and Vending-Bench 2 (Andon Labs; arXiv 2502.15840)

Sources: arXiv HTML; `andonlabs.com/evals/vending-bench-2`.

| Aspect | Detail | Tag |
|---|---|---|
| Interface | Tool calling: memory tools, email, search, inventory, sub-agent tools, `wait_for_next_day`; built on Inspect AI | [VERIFIED] |
| Episode | 2,000 messages cap; about 25 million tokens and 5 to 10 real-world hours per run | [VERIFIED] |
| Score | Net worth at end | [VERIFIED] |
| Runs | 5 per model | [VERIFIED] |
| Human baseline | One person, five hours, through the same chat-and-tools interface, no prior knowledge | [VERIFIED] |
| Variance | Best model mean $2,217.93 with minimum $476.00; human single sample $844.05 | [VERIFIED] Table 1 |
| Vending-Bench 2 | One simulated year, score = final balance from a $500 start, 3,000 to 6,000 messages and 60 to 100 million output tokens per run; an analytical "good strategy" estimate of about $63k is published as a reference point | [VERIFIED] |

Criticisms: a single human sample cannot support any human-versus-model claim; the simulated counterparties are themselves LLM-generated; means hide a long tail of derailed runs. The useful idea to borrow is the published analytical reference strategy as an upper anchor.

#### TextArena (Guertler et al.; arXiv 2504.11442)

Source: arXiv HTML v1. 74 text games at time of writing (16 single-player, 47 two-player, 11 multi-player) [VERIFIED]; Gym-like API with wrappers [VERIFIED]; online model-versus-model and model-versus-human play with TrueSkill (start mu = 25, sigma = 25/3) [VERIFIED]; humans appear on the board as one pooled "Humanity" entry [VERIFIED]. Limitation noted by the authors: results reflect rule comprehension and output formatting as well as playing ability [VERIFIED]. A pooled, self-selected human entry is not a controlled baseline. Relative ratings do not suit Spotless, which is single-player with an absolute score.

#### SnakeBench (ARC Prize side project)

Source: `arcprize.org/blog/snakebench`. 2.8K head-to-head games across 50 models, 10x10 text grid plus explicit coordinates of every object, Elo rating [VERIFIED]. Finding: most models could not keep track of their own position from the text grid; models needed full coordinates and an explicit explanation of the axes before play became meaningful; restricting moves to legal ones would mask the failure being measured [VERIFIED].

#### Pokemon harnesses (Claude Plays Pokemon, Gemini Plays Pokemon)

Source: LessWrong analysis "Is Gemini now better than Claude at Pokemon?". Both harnesses give screenshots with overlays, selected RAM state, a notes store, a button tool and a pathfinding tool; the Gemini harness adds a textual minimap and a second model instance for pathfinding [VERIFIED]. The Gemini harness author wrote "Please don't consider this a benchmark" and said the two systems "have different tools and receive different information" [VERIFIED]. This is the canonical example of results that cannot be compared because the harness, the information given and the run conditions all differ.

#### Minecraft suites

Not opened in full this session. From search snippets: MineDojo defines 1,560 creative tasks and has been criticised by later authors as repetitive and hard to evaluate; MCU offers 3,452 composable atomic tasks with an automatic evaluator reported at 91.5% agreement with human raters; MineCollab reports up to a 15% drop when agents must communicate detailed plans [RECALLED] (snippets only). The general lesson (each paper evaluating on its own task set, reliance on judges for open-ended goals) is why Spotless should have one fully programmatic outcome measure.

### 2.2 Physical-reasoning suites

#### PHYRE (Bakhtin et al., 2019; arXiv 1908.05656)

Source: ar5iv HTML.

| Aspect | Detail | Tag |
|---|---|---|
| Task | 2D puzzles: place one ball (3 continuous parameters) or two balls (6 parameters), then physics runs | [VERIFIED] |
| Size | 25 templates per tier x 100 tasks, 5,000 tasks in total | [VERIFIED] |
| Determinism | Fully deterministic simulator | [VERIFIED] |
| Invalid actions | Placements that overlap bodies or leave the world are rejected and do not count as attempts | [VERIFIED] |
| Metric | AUCCESS = sum_k w_k s_k / sum_k w_k for k = 1..100, w_k = log(k+1) - log(k); the first 10 attempts carry about half the weight | [VERIFIED] |
| Generalisation | Within-template and cross-template splits, 10 folds | [VERIFIED] |
| Robust solutions | A solution is "stable" if it still solves the task when shifted by 0.5 pixel in 8 directions | [VERIFIED] appendix B |
| Baselines | Random agent AUCCESS 13.0 +/- 5.0 cross-template; best learned agent 56.2 +/- 10.5 | [VERIFIED] |

This is the closest structural analogue to Spotless: one placement action, then a simulation decides. The three ideas to borrow are the attempt-weighted metric, the rejection of invalid placements without penalty, and the perturbation test for knife-edge solutions.

#### I-PHYRE (Li et al.; arXiv 2312.03009)

Source: arXiv HTML. 40 games in four splits [VERIFIED]; action is the timing of block removals [VERIFIED]; human study with 46 participants, each playing all 40 games with up to 5 attempts and a 15-second limit per game, best score per participant recorded [VERIFIED]; human success 82.83% to 92.39% by split against an oracle at 100% [VERIFIED, Table 2]. The paper shows humans solving most games while remaining clearly below the oracle, which is the pattern Spotless should aim for: human median well above a naive policy and well below the reference.

#### Physion (Bear et al.; arXiv 2106.08261)

Source: arXiv HTML v3. Eight scenarios; 150 test stimuli per scenario; prediction of whether two cued objects will touch [VERIFIED]. Human baseline: 800 participants recruited on Prolific, 100 per scenario, paid $4.00, 10 familiarisation trials, 112 excluded by a preregistered attention check [VERIFIED]. Overall human accuracy 0.71 [VERIFIED]. Model-to-human agreement is reported with Cohen's kappa and correlation, and with a "human zone" (2.5th to 97.5th percentile of human-human agreement) [VERIFIED]. Borrow: preregistered exclusion criteria, familiarisation trials, and reporting the spread of humans, not only the centre.

#### DeepPHY (arXiv 2508.05405)

Source: arXiv HTML v1. Wraps PHYRE, I-PHYRE, Kinetix, Pooltool, Angry Birds and Cut the Rope for vision-language models [VERIFIED]. Continuous actions are discretised (PHYRE becomes 25 grid cells x 5 radii) and scenes are overlaid with grids or numbered ids [VERIFIED]. Best model on PHYRE reaches 23.1% after 10 attempts [VERIFIED]; on Angry Birds 41.18% against humans at 64.71% [VERIFIED]. The authors conclude that the models' physical understanding is "largely descriptive" and does not transfer to control [VERIFIED]. Lesson: how a continuous action space is presented to the model (grids, ids, discretisation) is itself a major design variable and must be fixed and published.

### 2.3 Embodied household benchmarks

| Benchmark | Interface and scoring | Human data | Notes for Spotless | Tag |
|---|---|---|---|---|
| EmbodiedBench (arXiv 2502.09560) | 1,128 tasks in four environments; high-level skill actions versus low-level 7-dimensional arm actions; egocentric image plus text feedback; success rate | None | Best model 64.0% and 68.0% on the two high-level suites but 28.9% on low-level manipulation; removing vision cuts low-level performance by 40% to 70% | [VERIFIED] arXiv HTML |
| BEHAVIOR-1K (arXiv 2403.09227) | 1,000 activities, 50 scenes, 9,000+ objects; goals as predicate logic (BDDL); OmniGibson on PhysX 5 with rigid bodies, deformables and fluids; success rate plus efficiency metrics | Activities chosen from a survey of 1,461 respondents; the 2025 challenge supplies 10,000 teleoperated demonstrations and gives partial credit as the fraction of satisfied goal predicates | Separate "standard" and "privileged information" tracks in the 2025 challenge is a direct precedent for vision-only versus state-access tracks | [VERIFIED] arXiv HTML and challenge page |
| ALFRED (arXiv 1912.01734) | Egocentric vision plus language to action sequences; 25k language directives | Expert demonstrations | Template-like tasks; original baselines "perform poorly" | [VERIFIED] abstract |
| VirtualHome (arXiv 1806.07011) | Household activities represented as programs of atomic actions executed in a Unity simulator; crowd-sourced programs | Crowd-sourced programs | Symbolic actions with no real physics; shows the cost of abstracting contact away | [VERIFIED] abstract |

BEHAVIOR-1K's simulated state includes "soaked" and "dirtiness" as object states [VERIFIED]; these are symbolic flags, not a cleaning model, which is the gap Spotless fills.

### 2.4 Planning: PlanBench and Blocksworld

Source: arXiv HTML v4 of 2206.10498. 600 Blocksworld instances; plans checked with the VAL validator; temperature 0 [VERIFIED]. GPT-4 produced correct plans for 206 of 600 (34.3%) in plain Blocksworld but 26 of 600 (4.3%) when the same problems were renamed with misleading words ("Mystery Blocksworld") and 12 of 600 with random strings [VERIFIED]. No human baseline [VERIFIED].

Lesson for Spotless: familiar surface form inflates scores. A model can recite dishwasher-loading advice; what the benchmark must measure is whether that advice survives contact with the simulator on unfamiliar items, racks and soils. Held-out item types and rack layouts play the role of the "mystery" renaming.

### 2.5 Packing and CAD benchmarks

| Benchmark | What it does | Relevance | Tag |
|---|---|---|---|
| PackLab (arXiv 2609.23784) | Closed-loop bin packing for multimodal LLMs. Observation: one top-down height map plus a text list of candidate objects with dimensions. Action: (object, orientation in {0, 90 deg}, x, y) on a 2.5 cm grid; height set by gravity. 60 test cases in three difficulty tiers. Metric: volume-weighted success ratio x compactness | The untuned base multimodal model scores 0.209 overall; the stronger packing heuristics score 0.534 to 0.602 (the weakest 0.333); the fine-tuned model 0.660 and still loses to heuristics on the hard tier (0.394 against 0.469). No general-purpose frontier model is evaluated | [VERIFIED] arXiv HTML |
| RoboBPP, BED-BPP | Robotic bin-packing benchmarks with a physics simulator for stability checking | Precedent for "placement must survive a rigid-body settle" | [RECALLED] (snippets only) |
| PolyComp (arXiv 2608.14741) | 120 polycube assembly problems for multimodal models; best model 50.0% against 25% chance | 3D composition remains near chance for most models | [RECALLED] (snippet only) |
| CAD-bench, Text2CAD-Bench, Parametric CAD Bench | Code-generating CAD tasks graded by executing the model's program and checking geometry; one reports that swapping only the harness moves scores by roughly 10% | Precedent for geometric grading by execution and for harness sensitivity | [RECALLED] (snippets only) |

I found no existing benchmark that combines selection under capacity, free 6-degree-of-freedom placement with rigid-body settling, and an outcome decided by a fluid and soil simulation. PackLab is the nearest, and it uses box-shaped objects, two orientations and a geometric metric.

### 2.6 Methodology sources on human baselines, long tasks and agent evaluation

| Source | Key content | Tag |
|---|---|---|
| METR, "Measuring AI Ability to Complete Long Tasks" (arXiv 2503.14499) | Over 800 human baselines totalling 2,529 hours; baseliners were skilled professionals working in the same environment as agents; bonuses for success and for speed; screens and audio recorded for manual review; attempts that used disallowed AI tools excluded; payment structure "incentivized contractors to make a quick guess or give up early"; confidence intervals from 10,000 samples of a three-level hierarchical bootstrap over task families, tasks and runs; tasks weighted by inverse square root of family size | [VERIFIED] arXiv HTML |
| RE-Bench (arXiv 2411.15114) | 7 environments; 61 experts, 71 attempts of 8 hours under the same conditions as agents; score normalised so the starting solution = 0 and the reference solution = 1, y_n = (y - y_s)/(y_r - y_s); agents and humans compared at equal time budget using best-of-k; authors warn that seven environments make results noisy | [VERIFIED] arXiv HTML |
| OSWorld (arXiv 2404.07972) | 369 tasks; observations as screenshot, accessibility tree, both, or set-of-mark; 134 execution-based checkers; step limit 15; human accuracy 72.36% by computer-science students unfamiliar with the tasks; best model at release 12.24% | [VERIFIED] arXiv HTML |
| Terminal-Bench 2.0 (arXiv 2601.11868) | 89 tasks selected from 229; about three reviewer-hours per task; oracle solution per task; an adversarial "exploit" agent told to cheat, with trajectories inspected by hand; at least five trials per model-agent pair, 32,155 trials; 95% confidence intervals; canary string in every file, described as "largely a symbolic safeguard" | [VERIFIED] arXiv HTML |
| Agentic Benchmark Checklist (arXiv 2507.02825) | Task validity (solvable if and only if the agent has the capability) and outcome validity (the grader is right). Flaws found: a do-nothing agent scores 38% on one benchmark, above a GPT-4o agent at 35%; another can be scored 100% by overwriting tests; misestimation "up to 100% in relative terms"; recommends oracle solvers, trivial-agent baselines, frozen environments, statistical significance | [VERIFIED] arXiv HTML |
| "AI Agents That Matter" (arXiv 2407.01502) | Cost-controlled evaluation and accuracy-cost Pareto plots; hold-out sets matched to the generality claimed (distribution-specific, task-specific, domain-general, fully general); of 17 benchmarks surveyed, 7 had no hold-out | [VERIFIED] arXiv HTML |
| Holistic Agent Leaderboard (arXiv 2510.11977) | 21,730 rollouts, 9 benchmarks, 9 models, about $40,000; in 21 of 36 cases higher reasoning effort gave equal or lower accuracy; log analysis found agents looking up gold answers online and hard-coding outputs; argues that systematic log analysis must be part of any leaderboard | [VERIFIED] arXiv HTML |
| "Human Baselines in Model Evaluations Need Rigor and Transparency" (arXiv 2506.13776) | Review of 115 human baselines: median sample size 8; 2% reported a power analysis; 88% had user-interface differences between humans and AI and 76% had instruction differences; 41% reported paying baseliners and 8% offered performance bonuses; 14% reported ethics review; 78% released no human responses; cites evidence that over a third of crowdworkers have used AI on tasks | [VERIFIED] arXiv HTML |
| Anthropic, "A statistical approach to model evaluations" | Report standard errors; cluster standard errors on the unit of randomisation (clustered errors can be over three times the naive ones); reduce within-question variance by resampling; analyse paired differences (score correlations between frontier models of about 0.3 to 0.7); run power analyses | [VERIFIED] anthropic.com |
| Agarwal et al., "Deep RL at the Edge of the Statistical Precipice" (arXiv 2108.13264) | Interquartile mean (drop top and bottom 25% of runs); stratified bootstrap (resample runs independently per task); performance profiles; probability of improvement; usable with 3 to 10 runs per task | [VERIFIED] arXiv HTML |
| Atari human-normalised score | 100 x (agent - random)/(human - random); the human was a professional tester given about two hours of practice per game | [RECALLED] (snippets only for the formula's primary source and the protocol); the 0 = random, 1 = average human convention is [VERIFIED] in Agarwal et al. |

### 2.7 Cross-cutting lessons

Numbered for reference from later sections.

- **L1. Harness and interface differences dominate model differences.** ARC-AGI-3 (0% to 97.1% on one environment), lmgame-Bench (40% of unharnessed runs lose to random), Pokemon (different tools, incomparable). Fix one official harness; put everything else in a separate track.
- **L2. Vision is neither sufficient nor reliably helpful.** BALROG models often do worse with the image; EmbodiedBench shows vision is essential for low-level control; SnakeBench shows text grids alone fail too. Offer both a structured state and images, and report ablations.
- **L3. Low-level motor control is at the floor.** VideoGameBench dragging 10% at best; EmbodiedBench manipulation 28.9%; PackLab base model far below heuristics. A benchmark that can only be played by pixel-level dragging will not discriminate between current models.
- **L4. Human baselines are usually too small and use a different interface.** Median n = 8; 88% with interface differences. ARC-AGI-3's 10 per environment and same prompt is the current best practice among game benchmarks, and it still had to revise its statistic.
- **L5. Public levels get replayed.** ARC-AGI-3 ships a 100% replay harness for its own public set. Official numbers need private or fresh levels.
- **L6. Procedural generation is the standard defence against memorisation** (BALROG, FLE maps), and surface-form changes expose pattern matching (PlanBench).
- **L7. Expensive episodes lead to single runs and no error bars** (VideoGameBench one run per game; Vending-Bench five runs with large spread; RE-Bench seven tasks). The protocol has to be designed around the compute budget from the start.
- **L8. Count only state-changing actions against the agent, and cap them relative to humans** (ARC-AGI-3: observations and reasoning are free; cap at 5x human median).
- **L9. Reject invalid placements without penalty and test solutions for robustness to small perturbations** (PHYRE).
- **L10. Weight early attempts when more than one attempt is allowed** (PHYRE AUCCESS; I-PHYRE five attempts).
- **L11. Validate every level automatically and with people before release**: random-policy bound, oracle solution, at least two humans succeeding, golden-trace replay (ARC-AGI-3, Terminal-Bench 2.0).
- **L12. Run an adversarial exploit agent and read the logs** (Terminal-Bench 2.0, HAL, FLE's accidental state resets).
- **L13. Report cost and wall-clock next to score** (ARC Prize, HAL, Kapoor et al.).
- **L14. Pay people for effort and outcome, not for the number of items attempted** (ARC-AGI-3 exclusions; METR's quick-guess incentive).

---

## 3. Interface recommendations for Spotless

### 3.1 Principles

- **P1. One action layer, two front-ends.** A server-side session object owns the scene. The human 3D client and the agent API both call the same reducers (`place`, `remove`, `reset`, `check_load`, `start_cycle`) and read the same state. No action exists in one front-end only.
- **P2. Information parity means equal availability at equal cost.** Anything a human can learn without changing the scene (by orbiting the camera, hovering over an item, reading a panel) the agent can learn through a query that does not consume its action budget, and the reverse. A parity matrix (one row per piece of information, columns "human UI element" and "API field") lives in the repository and is checked in CI.
- **P3. Presentation fits the player.** Humans get an interactive rendered scene; agents get rendered images on request plus a structured scene state. Humans also get the numeric read-outs (pose, dimensions) that the structured state contains.
- **P4. Nothing predictive of the wash outcome is shown to anyone.** No spray-coverage maps, no predicted cleanliness, no reference scores on test levels.
- **P5. Physical facts are free; functional checks cost one explicit query that a real user could perform.** "The mug fell over" is reported automatically. "The lower spray arm cannot rotate" is reported when the player asks for the equivalent of spinning the arm by hand.
- **P6. The interface tax is measured.** A small group of humans plays through the agent API (text tools and still images) so the score difference between the two interfaces is known (section 6.6). Vending-Bench and VideoGameBench both put a human through the agent interface for this reason [VERIFIED, section 2.1].

### 3.2 Observation design

Three layers, all available to both kinds of player.

**(a) Level card (static, delivered at the start).**

| Field group | Content |
|---|---|
| Machine | Tub interior dimensions; rack geometry (wire positions, tine rows, fold-down sections, cutlery basket or tray); spray-arm positions, lengths and sweep volumes; detergent-dispenser location and door swing; rack travel. This is the information in a user manual plus what is visible on opening the door. Source data: `machine`, `items`. |
| Programme | Name, phases, nominal temperatures and durations, detergent type and dose. Source: `machine`, `chemistry`. |
| Items | One record per item (below). |
| Rules | Scoring rule, what "clean" means in words, budgets, what ends the episode. |
| Manual | A fixed short text of generic loading guidance of the kind printed in appliance manuals, identical for humans and agents. Whether to include it is a decision for the maintainers (section 9). |

**Item record.**

| Field | Type | Notes |
|---|---|---|
| `item_id` | string | Stable within a level |
| `class`, `display_name` | string | For example `dinner_plate`, "Dinner plate, 27 cm" |
| `material` | enum | Glazed ceramic, soda-lime glass, stainless steel, polypropylene, and so on. Affects wetting, mass and thermal behaviour (`items`, `films`) |
| `mass_kg` | number | |
| `bbox_mm` | [x, y, z] | In the item's own frame |
| `dims` | object | Class-specific: diameter, height, depth, handle length |
| `orientation_presets` | list | Named orientations with quaternions (for example `upright`, `inverted`, `on_edge`), the same list that drives the rotate buttons in the human UI |
| `soil.description` | string | Natural language, for example "Porridge, dried on for about 12 hours, covering the inside base and lower wall" |
| `soil.type` | enum | Catalogue id from `soils` |
| `soil.regions` | list | Named regions of the item with coverage fraction |
| `soil.amount_g`, `soil.age_h`, `soil.heat_history` | numbers, enum | What a person who cooked and ate the meal would know |
| `points` | integer | v_i |
| `thumbnails` | images | Four fixed views, showing the soil |

Deliberately absent from the record: adhesion strengths, kinetic constants, any number from the soil model's internals.

**(b) Scene state (dynamic, structured JSON).** Returned by `get_state` and after every state-changing action.

```json
{
  "state_hash": "sha256:...",
  "racks": {"lower": "out", "upper": "out"},
  "placed": [
    {"item_id": "plate_03", "frame": "lower_rack",
     "position_mm": [212, 148, 61], "quaternion_wxyz": [0.707, 0.707, 0, 0],
     "stable": true,
     "contacts": [{"with": "lower_rack.tine_row_2", "points": 2},
                  {"with": "plate_02", "points": 1}]}
  ],
  "unplaced": ["pan_01", "mug_04"],
  "budget": {"actions_used": 37, "actions_max": 400,
             "queries_used": 122, "queries_max": 1500}
}
```

**(c) Images (on request).**

| View | Projection | Purpose |
|---|---|---|
| `iso_lower`, `iso_upper` | Perspective, three-quarter, rack pulled out | General impression, as a person standing at the machine sees it |
| `top_lower`, `top_upper` | Orthographic from above, optional millimetre grid and item-id labels | Layout planning. Labelled, gridded views are what DeepPHY and OSWorld's set-of-mark mode use to make scenes legible to models [VERIFIED, sections 2.2, 2.6] |
| `front`, `left`, `right` | Orthographic | Heights and clearances |
| `height_lower`, `height_upper` | Top-down height map, colour encodes height above rack floor | PackLab uses a top-down height map as its only visual input [VERIFIED, section 2.5] |
| `custom` | Free camera: azimuth, elevation, target point, field of view | Equivalent of the human orbit camera |
| `item` | Close-up of one item, before or after the wash | Reading soil and residue |

Options on every view: `labels` on or off, `grid` on or off, `racks` in or out, `highlight` item ids, `ghost` (draw a candidate pose without placing it), `size` up to 1024 px on the long edge. Default size 768 x 768.

Token cost, as a planning figure: one provider documents image cost as ceil(width/28) x ceil(height/28) visual tokens, so 1000 x 1000 costs 1,296 tokens [VERIFIED, platform.claude.com vision guide]. By the same formula a 768 x 768 view costs 28 x 28 = 784 tokens and a 1024 x 1024 view 37 x 37 = 1,369 [ESTIMATED from that formula]. Other providers count differently; measure per provider.

**Modes to report.** The official mode is structured state plus images. Two ablations should be run and published for every model: structured state only, and images only. The BEHAVIOR 2025 challenge runs "standard" and "privileged information" tracks on the same tasks [VERIFIED], and BALROG reports language-only and vision-language results side by side [VERIFIED].

### 3.3 Action design

**Frames and units.**

- Tub frame T: origin at the front-bottom-left interior corner as seen facing the open machine; +x to the right, +y towards the back, +z up. Right-handed.
- Rack frames (`lower_rack`, `upper_rack`, `cutlery`): fixed to each rack, axes parallel to T when the rack is pushed in. Poses are given in rack frames because racks are loaded while pulled out.
- Positions in millimetres, quantised to delta_p = 1 mm. Orientation as a unit quaternion (w, x, y, z), or as a preset name, or as preset plus yaw/pitch/roll offsets in degrees quantised to delta_theta = 1 deg. The position refers to the item's reference point defined in its record (centre of the bounding box unless stated).
- The human UI snaps to the same quanta and offers numeric entry. Quantisation limits precision abuse (section 4.7) and makes the two interfaces equally precise. delta_p and delta_theta are [ESTIMATED]; see section 11.

**State-changing actions (count against the action budget).**

| Action | Semantics |
|---|---|
| `place(item_id, frame, position_mm, orientation)` | 1. Reject if the requested pose penetrates anything by more than eps_pen. 2. Reject if the item cannot reach the pose by a collision-free straight vertical sweep from above the rack (insertability test). 3. Lower the item along -z until first contact (gap under 1 mm), then release with zero velocity. 4. Run the rigid-body settle. 5. Return a `DropResult`. Rejected calls do not consume budget, following PHYRE [VERIFIED]. |
| `remove(item_id)` | Take the item back to the counter. Re-settle whatever it was supporting. Return the list of items that moved. |
| `reset()` | Remove everything. |
| `set_rack(rack, option)` | Only if the machine variant has adjustable features (upper-rack height, fold-down tines). |
| `start_cycle()` | Push racks in (simulated, items may shift), close the door, run pre-checks, freeze the load, queue the wash. Ends the episode in the one-shot track. |

**Queries (free of action budget, counted against a separate query cap).**

| Query | Returns |
|---|---|
| `get_level()` | Level card |
| `get_item(item_id)` | Item record and thumbnails |
| `get_state()` | Scene state |
| `render(view, options)` | Image |
| `preview(item_id, frame, position_mm, orientation)` | Without changing the scene: whether the pose is collision-free, penetration depth and with what, whether it is insertable, and the pose after lowering to first contact. It does not run the settle. Human equivalent: the ghost item that turns red on collision while dragging. |
| `list_slots(rack)` | Tine rows and slot centres with pitch, as geometry. Human equivalent: looking at the rack. |
| `check_load()` | Simulates pushing the racks in and closing the door; reports items that shifted or fell, items protruding beyond the rack envelope, whether each spray arm completes a full rotation without touching anything, whether the detergent door can open fully. Human equivalent: pushing the rack in and spinning the arms by hand. Reports mechanical facts only. |

**Why this level of abstraction.** A 6-degree-of-freedom pose with physics is the honest action for a loading game. Evidence in section 2 says current models are weak at exactly this (L3), so the interface gives them, and humans, the same geometric helpers a rack physically provides (slots, presets, lowering to contact), without giving hints about cleaning. A pure slot-picking interface would remove the physical reasoning the brief asks for; a pure pixel-dragging interface would measure mouse control.

**Optional computer-use track.** The same game can be played by a model through screenshots and mouse events on the human client. This gives literal interface identity but is expected to be dominated by dragging and camera control (VideoGameBench dragging result, L3). Recommend offering it as a secondary track only.

### 3.4 Feedback after a drop

`DropResult`:

| Field | Meaning | Human UI equivalent |
|---|---|---|
| `accepted`, `reject_reason` | `collision_at_pose`, `not_insertable`, `out_of_bounds`, `already_placed`, `budget_exhausted` | Ghost turns red; tooltip |
| `requested_pose`, `release_pose`, `settled_pose` | Three poses in the rack frame | Visible motion; numeric panel |
| `displacement_mm`, `rotation_deg` | From release to settled | Visible motion |
| `settle_time_s`, `stable` | `stable` is true when every body satisfies the rest criterion (below) within the settle limit | Item stops moving, or keeps rocking |
| `fell_through`, `fell_out` | Item dropped through the rack or left it | Visible |
| `contacts` | List of `{with, points, normal_force_N}` | Visible contact; hover highlight |
| `moved_items` | Other items displaced by more than 1 mm or 1 deg, with amounts | Visible motion |
| `state_hash` | Hash of the canonical scene after the action | Shown in the debug panel |

Rest criterion: a body is at rest when its linear speed is below v_tol and its angular speed below omega_tol continuously for t_hold. Defaults v_tol = 5e-3 m/s, omega_tol = 5e-2 rad/s, t_hold = 0.5 s, settle limit 5 s of simulated time [ESTIMATED; calibration parameters, to be agreed with `items`].

Not included in drop feedback: any statement about spray access, drainage, or expected cleanliness.

### 3.5 What is visible and what is hidden

| Information | Humans | Agents | Rationale |
|---|---|---|---|
| Machine geometry, programme | Visible | Visible | A user can see and read these |
| Item geometry, mass, material | Visible | Visible | A user can handle the item |
| Soil type, extent, age, heat history (qualitative and coarse numbers) | Visible | Visible | A user knows what was cooked and when |
| Point values | Visible | Visible | Brief |
| Definition of "clean" in words | Visible | Visible | Brief |
| Settled poses, contacts, stability | Visible | Visible | Physical facts |
| Result of pushing racks in, arm rotation, dispenser door | On request | On request | P5 |
| Soil-model parameters, spray-coverage fields, predicted outcome | Hidden | Hidden | This is the skill being measured |
| Simulation seed | Hidden | Hidden | Prevents seed-specific tuning |
| Reference load and reference score on test levels | Hidden | Hidden | Would reveal the target |
| Other players' loads and scores | Hidden | Hidden | Independence |
| Wash report after the cycle: per-item clean flag, where residue remains, after-wash image, whether the item moved or holds water, points | Visible | Visible | What a person sees on unloading |
| Internal diagnostics of the wash (impingement maps, film thickness history) | Developer mode only | Developer mode only | Not observable in reality; would turn feedback into an oracle |

### 3.6 Delivery options and what evaluation frameworks expect

**Recommended layering.**

```
            +--------------------------------------------------+
            |  spotless-simd: native service on the host       |
            |  (rigid-body engine, renderer, wash simulator,   |
            |   job queue, cache). JSON over HTTP; WebSocket   |
            |   for streaming state to the human client.       |
            +-----------+----------------+---------------------+
                        |                |
        +---------------+--+   +---------+-----------+   +------------------+
        | Human 3D client  |   | MCP server (stdio   |   | Python client    |
        | (browser/native) |   | and streamable HTTP)|   | + Gymnasium env  |
        +------------------+   +---------+-----------+   +--------+---------+
                                         |                        |
                      +------------------+-----+        +---------+----------+
                      | Inspect AI task        |        | Reference policies |
                      | Harbor task directory  |        | optimiser, CLI     |
                      | METR TaskFamily        |        +--------------------+
                      | HAL wrapper            |
                      +------------------------+
```

The wash simulator is expected to need the host GPU (Metal on the reference MacBook). Every evaluation framework below assumes the task lives in a Linux container. The two are reconciled by keeping the simulator as a host service and making every framework adapter a thin network client. This is a hard constraint on the simulator's packaging: it must run headless as a service with no dependency on the game client.

| Framework | What it expects | Spotless adapter | Tag |
|---|---|---|---|
| Model Context Protocol | Server exposes tools via `tools/list` and `tools/call`; a result may contain text, image (`type: image`, base64 `data`, `mimeType`), and `structuredContent` validated by an `outputSchema`; `isError: true` for tool-level failures. Revision 2025-11-25 adds experimental "tasks" for long-running calls: `CreateTaskResult` with `taskId`, polling via `tasks/get` with `pollInterval`, result via `tasks/result`, statuses `working`, `input_required`, `completed`, `failed`, `cancelled` | Primary agent interface. Every action and query is one tool; images are returned as image content; structured results carry an output schema. Do not depend on MCP tasks (experimental); provide plain `start_cycle` and `get_report` polling tools and optionally advertise task support | [VERIFIED] modelcontextprotocol.io specification pages |
| Inspect AI (UK AI Security Institute) | A `Task` is a dataset, a solver and a scorer. Tools can come from MCP servers through `mcp_server_stdio()`, `mcp_server_http()` or `mcp_server_sandbox()`, filtered with `mcp_tools()`. Repeats via `Epochs(n, reducer)` with reducers `mean`, `median`, `mode`, `max`, `pass_at_k`, `at_least_k`. Limits: `time_limit`, `working_limit`, `message_limit`, `token_limit`, `cost_limit`; working time excludes waiting on shared resources such as subprocess execution. `stderr(cluster=...)` gives clustered standard errors and `bootstrap_stderr` defaults to 1,000 resamples. External coding agents (Claude Code, Codex CLI) run through `sandbox_agent_bridge()` and can be given host tools as bridged MCP servers | `inspect_spotless` package: dataset = levels; tools = the MCP server; scorer = fetch the report and return normalised score as a float; `Epochs` for repeats; `cluster="family"` | [VERIFIED] inspect.aisi.org.uk |
| Inspect `human_agent` | Human baselining for tasks solvable from a shell in a Linux container; commands `task start`, `task stop`, `task submit`, `task score`; terminal recorded | Not usable for the 3D game. Usable only for the "humans through the API" interface-tax study, if that is run from a terminal client | [VERIFIED] inspect.aisi.org.uk |
| METR Task Standard v0.5.0 | A task family is a directory with a Python `TaskFamily` class: `get_tasks`, `get_instructions`, optional `get_permissions`, `start`, `score`, `intermediate_score`, `aggregate_scores`; environment built from a Dockerfile; no internet unless `full_internet`, except an LLM API, an LLM API proxy or a hardened local web server; agent runs as user `agent`, not root | `TaskFamily` with one task per level; instructions = level card; `score` reads the report; the simulator is reached as the permitted local web server | [VERIFIED] METR/task-standard STANDARD.md |
| Harbor (Terminal-Bench 2.0 harness) | Task directory with `instruction.md`, `task.toml`, `environment/`, `solution/`, `tests/test.sh`; the verifier writes a number to `/logs/verifier/reward.txt` or labelled values to `/logs/verifier/reward.json`; multi-container tasks via docker-compose with sidecars reachable by service name, for example an `mcp-server` sidecar with a health check | One task directory per level; sidecar = MCP proxy to the host service; `solution/` replays the reference load; `test.sh` writes the normalised score | [VERIFIED] docs.harborframework.com |
| HAL (Holistic Agent Leaderboard) | Agent is a Python `run` function taking an input and returning a dict; benchmark supplies task data, evaluation logic and scoring; cost is tracked and plotted | Benchmark wrapper that hands the agent the MCP endpoint and collects the score and token cost | [VERIFIED] arXiv 2510.11977 |
| Gymnasium | `reset(*, seed, options) -> (observation, info)`; `step(action) -> (observation, reward, terminated, truncated, info)`; render modes declared in `metadata` | `SpotlessEnv` for reference policies, optimisers and reinforcement-learning users. `terminated` becomes true at `start_cycle`; reward is delivered when the report exists | [VERIFIED] gymnasium.farama.org |
| OpenAI Evals (hosted platform) | Announced deprecated 3 June 2026; read-only 31 October 2026; dashboard and API shut down 30 November 2026 | Do not target | [VERIFIED] developers.openai.com deprecations page |
| Command line | n/a | `spotless serve`, `spotless level list`, `spotless replay <log>`, `spotless score <manifest>`, `spotless verify <submission>` | Recommendation |

### 3.7 Report returned after a wash

```json
{
  "benchmark_version": "spotless-1.0/levels-2026a",
  "level_id": "fam07-seed3",
  "state_hash": "sha256:...",
  "job": {"status": "done", "runtime_s": 1312, "fidelity": "official"},
  "score": {"points": 46, "points_available": 88},
  "items": [
    {"item_id": "bowl_02", "loaded": true, "clean": false, "points_awarded": 0,
     "residual_fraction_area": 0.07,
     "residue_regions": [{"region": "inside_base", "fraction": 0.31}],
     "moved_during_wash": false, "holds_water": true,
     "image_after": "<image>"},
    {"item_id": "pan_01", "loaded": false}
  ]
}
```

The normalised score and the reference score are withheld from the player on test levels and added in the published results.

---

## 4. Protocol

### 4.1 Level sets

Levels are produced by a seeded generator from **families**. A family fixes the theme (for example "breakfast for six with dried porridge" or "roasting day with one burnt tray"), the machine variant, the programme, the trap archetype (section 5.7) and the distributions from which items, soils and point values are drawn. A seed picks one level from the family.

| Set | Size | Seeds | Use | Human baseline |
|---|---|---|---|---|
| `tutorial` | 4 levels | Public | Onboarding for humans and agents; full feedback including the reference score; never scored | n/a |
| `dev` | 24 levels = 12 families x 2 seeds | Public | Harness development; published human data and replays; reported but labelled as exposed | Yes, 10 people per level |
| `test` | 60 levels = 15 families x 4 seeds; 12 families shared with `dev`, 3 families never published | Private | Official results | Yes on a 24-level subset (2 seeds from each of 12 families), 10 people per level |
| `fresh` | Generated on demand from a secret generator seed | Never reused | Spot checks for memorisation; future rotations | No |

All counts are [ESTIMATED]; the derivation of 60 is in section 5.4 and the human-baseline cost in section 6.3. Following Kapoor et al.'s taxonomy [VERIFIED], Spotless is a task-specific benchmark, for which the hold-out should be out-of-distribution: the three unpublished families must differ from the public ones in item classes, soil types or rack layout, not just in seed. ARC-AGI-3 makes its private sets deliberately out-of-distribution relative to the public set for the same reason [VERIFIED].

### 4.2 Tracks, attempts and practice washes

| Track | Washes per level | Feedback | What it measures | Status |
|---|---|---|---|---|
| **A. One-shot** | 1 | None until the whole run is finished | Prior physical reasoning, selection and spatial planning | Official headline |
| **B. Adaptive** | 3 | Full wash report after each wash; the player may rearrange and wash again | Learning from feedback | Secondary; reported as first-wash score and an attempt-weighted score (5.1) |
| **C. Campaign** | 1 per level, levels in fixed order, reports visible before the next level | Reports carry over | Transfer across levels | Optional; statistics must treat a campaign as one cluster |

Reasons for making A the headline:

- It makes scoring a batch job (section 4.6).
- It gives humans and agents the same information regardless of wall-clock: a human cannot wait 30 minutes between levels, an agent can.
- It matches first-exposure practice in ARC-AGI-3 (single attempt per environment) [VERIFIED].
- Calibration to the simulator's physics is supplied instead by the tutorial pack: four tutorial levels each with several worked loads and their full reports, given identically to humans and agents.

Practice washes on the same level are a different skill (optimising with a simulator in the loop). They belong in track B, where each wash is expensive by construction and the metric weights the first attempt most, as PHYRE's AUCCESS does [VERIFIED].

A reduced-fidelity "preview wash" (seconds to a minute) would be attractive for human enjoyment but would act as an oracle. Recommend not offering it in any scored track. A decision for the maintainers, section 9.

### 4.3 Seeds, procedural generation and contamination

| Seed | Determines | Visibility |
|---|---|---|
| `level_seed` | Items drawn, parametric dimensions, soils and their spatial pattern on each item, point values | Public for `dev`, private for `test` |
| `sim_seed` | Every stochastic element of the wash simulation | Hidden; official value is a fixed function of (level id, simulator major.minor version) so identical loads give identical reports |
| `run_seed` | Passed to the harness for the model's sampling where the provider supports it | Logged |

Measures against memorisation and leakage:

1. Official numbers come only from `test` and `fresh` (L5).
2. Items are parametric (dimensions jittered within a class), so a memorised load from one seed does not fit another.
3. Three test families are never published in any form.
4. Published replays and human data exist only for `dev`.
5. Reports for `test` levels are returned to submitters without images and without per-region residue unless the submitter is running the private set under agreement, to limit reconstruction of private levels from reports. A decision for the maintainers, section 9.
6. Every public file carries a canary string. Terminal-Bench 2.0 calls this "largely a symbolic safeguard" [VERIFIED]; it costs nothing.
7. The `test` set is rotated at each major version.

### 4.4 Budgets

| Budget | Agents | Humans | Basis | Tag |
|---|---|---|---|---|
| State-changing actions per level | 5 x the human median for that level once human data exist; 400 before then | Unlimited within time | ARC-AGI-3 caps agents at 5x the human median action count. Provisional 400: about 30 placed items x 3 state changes each (place, remove, place again) is 90; a factor of 4 to 5 on top | 5x rule [VERIFIED] precedent; 400 [ESTIMATED] |
| Queries per level | 1,500 | Unlimited | About 4 queries per allowed action, to bound cost | [ESTIMATED] |
| Time per level | 60 min of working time, excluding simulator and API waiting | Soft limit 20 min, hard limit 30 min | ARC-AGI-3 uses 20 and 30 minutes per environment for humans | Human limits [VERIFIED] precedent, applicability [ESTIMATED]; agent 60 min [ESTIMATED] |
| Tokens and money | No hard cap in the official track; both reported per level. Optional `cost_limit` in Inspect | n/a | Report cost next to score (L13) | Recommendation |
| Washes | 1 (track A) or 3 (track B) | Same | Section 4.2 | Recommendation |

Hitting a cap ends the episode with whatever is loaded; the load is washed and scored as it stands. Inspect treats limit exhaustion the same way: the sample is ended and scored on its current output [VERIFIED].

### 4.5 Determinism and versioning

Three layers with different requirements.

| Layer | Requirement | How | Evidence |
|---|---|---|---|
| Interactive rigid-body layer (place, settle, rack push-in) | Bit-identical across machines and between browser and native builds, so that an action log replays to the same `state_hash` anywhere | Fixed time step; fixed solver iteration counts; a cross-platform deterministic engine build; bodies inserted in a canonical order | Rapier documents cross-platform determinism with its `enhanced-determinism` feature on IEEE 754-2008 compliant targets including WebAssembly, provided bodies are inserted in the same order and the same engine and compiler versions are used. Jolt documents a `CROSS_PLATFORM_DETERMINISTIC` build option, about 8% slower, tested on Windows, macOS and Linux across x86, ARM and WebAssembly, and notes that the feature "is less tested than other features" [VERIFIED, rapier.rs and Jolt documentation] |
| Wash simulation | Same report hash on repeated runs on the reference machine; across different GPUs, agreement within a stated tolerance | Fixed time steps and iteration counts; no adaptation of resolution to wall-clock; counter-based random numbers keyed by (seed, entity id, step) so results do not depend on thread or dispatch order; order-independent accumulation (integer or fixed-point scatter-add, or sorted reduction) | GPU shading languages do not in general promise bit-identical floating-point results across implementations; secondary sources state that WGSL permits reassociation and fusion of floating-point operations [RECALLED] (snippets only; I could not open the relevant section of the WGSL specification). Cross-link: `numerics` |
| Scoring layer (residue to clean flag to points) | Deterministic | CPU, double precision, canonical ordering | n/a |

Acceptance tests to add to CI [ESTIMATED targets]:

- `repro-5`: the same golden load washed five times on the reference machine gives five identical report hashes.
- `cross-device`: the golden set washed on a second GPU family gives the same clean flag for at least 99% of items and a level-score standard deviation no more than 1% of R_l.
- `golden-replay`: every stored action log replays to its stored `state_hash`. ARC-AGI-3 uses recording-based playback of known-good traces for the same purpose [VERIFIED].

**Version string.** `spotless-<MAJOR>.<MINOR>.<PATCH>/levels-<id>`.

- MAJOR changes when anything that can change a report changes (physics, soil model, thresholds, rack geometry). Leaderboard entries are not comparable across MAJOR versions; caches are invalidated.
- MINOR adds levels, tools or report fields without changing existing reports.
- PATCH is for changes proven neutral by `golden-replay` and `repro-5` on the full golden set.

Every report, log and leaderboard row carries the version string. Canonical official scores are those produced on the declared reference platform (hardware model, OS version, build hash), which is also stated in the row.

### 4.6 Living with a 30-minute scoring simulation

**Batch scoring (track A).** The agent's or human's episode ends at `start_cycle`. The harness stores the load manifest. Washes are then run by a queue, in any order, on reference hardware. Consequences:

- LLM API sessions never wait on the simulator.
- A submission is a set of load manifests plus action logs. A verifier replays each log in the deterministic rigid-body layer, checks the resulting `state_hash`, and washes the load. Nobody has to trust a submitter's reported score.
- Human participants finish their session without seeing results; reports are released afterwards.

**Asynchronous jobs (track B and interactive play).** `start_cycle` returns a `job_id` immediately. `get_report(job_id)` returns `queued`, `running` with a progress fraction, `done` with the report, or `failed`. The job survives client disconnects. The simulator checkpoints at phase boundaries so a crash does not lose the whole run. Time spent waiting is excluded from the agent's time budget; Inspect's `working_limit` already excludes waiting on shared resources [VERIFIED].

**Cache.** Key:

```
K = SHA-256( MAJOR.MINOR || machine_id || programme_id || level_id || sim_seed || fidelity
             || canonical(load) )
canonical(load) = list sorted by item_id of
                  ( item_id, frame, round(p / 0.1 mm), round(q' / 1e-4) )
q' = q if q.w >= 0 else -q
```

The canonical load uses the settled poses after the simulated rack push-in, rounded to 0.1 mm and 1e-4 in quaternion components [ESTIMATED]. Cache hits will be rare between independent players because poses are continuous; the cache earns its keep on re-scoring, replays, verification of submissions, the reference policies, and the empty-load case.

**Cheap deterministic pre-checks at `start_cycle`** (all under a few seconds, all part of the rigid-body layer):

1. Every loaded item is at rest and inside a rack envelope.
2. Rack push-in and door close are simulated; items that fall out of the racks are recorded as such.
3. Spray-arm sweep and dispenser-door swing are tested against the settled load. A blocked arm is not an error; it is passed to the wash as a boundary condition, because a blocked arm is a real and instructive outcome.
4. Maximum interpenetration after settling is below eps_pen (section 4.7); otherwise the engine resolves it and logs the event.
5. If no soiled item is loaded the score is zero without a wash.

**Failures.** A wash that times out (hard limit 60 min [ESTIMATED]) or produces non-finite values is an infrastructure failure. It is retried once and, if it fails again, the level is flagged and excluded for all agents until fixed. It is never scored as zero for the agent. The Agentic Benchmark Checklist treats grader failure as an outcome-validity defect of the benchmark [VERIFIED].

**Compute budget.** Let N be the number of washes, h the cache-hit fraction, E[T] the mean wash time and W the number of worker machines.

```
T_total = N * (1 - h) * E[T] / W
```

With p95 = 30 min from the brief, assume E[T] = 20 min [ESTIMATED: two thirds of p95; replace with a measured mean] and one wash at a time per 18 GB machine [ESTIMATED; depends on `numerics`].

| Activity | Washes | Hours on one machine | Notes |
|---|---|---|---|
| One model, track A, 60 test levels, 1 run | 60 | 20 | |
| Plus run-to-run variance subset: 12 levels x 2 extra runs | 24 | 8 | Section 5.4 |
| One model, total | 84 | 28 | |
| Ten models | 840 | 280 (11.7 days) | Parallelises across machines |
| One-off per MAJOR version: reference search, about 8 official washes on each of 84 levels | 672 | 224 | Inner loop of the search uses a reduced-fidelity run that is never exposed to players |
| One-off: greedy policy, 84 levels | 84 | 28 | |
| One-off: random policy, 3 runs x 84 levels | 252 | 84 | |
| One-off: simulator noise study, 5 seeds on 24 reference loads | 120 | 40 | Section 5.5 |
| One-off: human baseline, 48 levels x 10 people | 480 | 160 | Section 6 |
| One-off total | 1,608 | 536 (22 days) | |

All rows [ESTIMATED] from the stated assumptions. The one-off cost of a MAJOR version is about three weeks of one machine, or under a week on four. This argues for (i) keeping MAJOR versions rare, (ii) the simulator running headless on more than one machine from the start, and (iii) a reduced-fidelity mode for internal level design.

### 4.7 Anti-exploit measures

| Risk | Measure |
|---|---|
| Teleporting an item into a cavity it could not physically enter (a cup inside an inverted pot) | Insertability test in `place`: collision-free vertical sweep from above the rack to the requested pose. Strictness is a decision for the maintainers (section 9) |
| Interpenetration glitches | Reject requested poses with penetration above eps_pen = 0.5 mm [ESTIMATED]; after settling, check maximum penetration again; continuous collision detection for thin items such as cutlery and plate rims (`items`) |
| Dropping from a height to wedge or bounce items into place | `place` lowers to first contact before release; release velocity is zero |
| Knife-edge balancing that would not survive a real rack being pushed in | Rack push-in and door close are simulated at `start_cycle` with a fixed motion profile (peak speed 0.5 m/s, acceleration 2 m/s^2, end-stop deceleration 5 m/s^2 [ESTIMATED; calibrate against measured rack motion, `machine`]). The load that is washed is the load after this step. PHYRE's perturbation test for "stable solutions" is the precedent [VERIFIED] |
| Precision abuse (poses specified to micrometres to find numerical sweet spots) | Input quantisation to 1 mm and 1 deg; fixed hidden `sim_seed`; only 1 or 3 washes per level, so sweet spots cannot be searched |
| Out-of-bounds placement | Reject poses outside the rack envelope; items that leave the racks during settle or push-in are counted as not loaded and reported |
| Items on the tub floor, on the door, or hanging from the upper rack underside | Not rejected if physically reachable by the insertability rule and stable; the wash decides. Items on the tub floor are reported in `check_load`. The maintainers may prefer a hard rule (section 9) |
| State resets or undefined API sequences (FLE saw agents trigger game-state resets [VERIFIED]) | Server validates every call against a session state machine; all errors are tool-level errors with no side effects |
| Agent reads level files, reference loads or simulator internals from disk | Agent has network access to the MCP endpoint only; private levels live only on the scoring host; the official harness has no shell |
| Agent runs its own copy of the simulator to search (if the simulator is public) | Official track uses the standard harness with no code execution. An open track allows anything but must report compute. Whether the simulator is released at all is a decision for the maintainers |
| Looking up answers (HAL found agents retrieving gold answers online [VERIFIED]) | No internet in the official track; private levels |
| Stuffing every item in | No rule needed if the simulator is right: an overfilled machine cleans badly. The level generator certifies that not everything fits (section 5.7) |
| Fuzzing gaps | Before release run a random-action fuzzer for at least 1,000,000 actions across levels (ARC-AGI-3 practice [VERIFIED]) and an adversarial exploit agent whose transcripts are read by a person (Terminal-Bench 2.0 practice [VERIFIED]) |

### 4.8 Trajectory logging

One JSONL event stream per episode, identical for humans and agents at the action level.

| Record | Fields |
|---|---|
| Header | Benchmark version, level id, track, player type, harness id and version, model id and sampling settings (agents), anonymised participant id (humans), start time |
| Event | Sequence number, monotonic time, kind (action or query), name, arguments, result digest, `state_hash` after the event, budget counters |
| Model turn (agents) | Message ids, token counts in and out, cached tokens, cost, latency; full transcript stored in the evaluation framework's native log (Inspect `.eval`) |
| Footer | Load manifest, `state_hash`, pre-check results, job id |
| Report | Stored separately, keyed by cache key |

Images are not stored; they can be re-rendered from state. Human sessions store semantic actions and timings, not raw mouse traces or screen video; because the rigid-body layer is deterministic, the action log reproduces the whole session. METR recorded screens and audio to detect cheating [VERIFIED]; for a deterministic game the action log gives the same audit capability with less personal data.

A `spotless replay` tool renders any log as a video for audit. Published `dev` logs double as regression tests.

---

## 5. Scoring and statistics

### 5.1 Per-level score and derived metrics

Symbols for level l with item set I_l:

| Symbol | Meaning | Unit |
|---|---|---|
| v_i | Points for item i | points |
| x_i | 1 if item i is in the load that is washed, else 0 | - |
| r_i | Residual soil measure of item i after the wash, as defined by `standards` and `soils` (fraction of initially soiled area still soiled, or the standard's particle-count grade mapped to [0, 1]) | - |
| theta_c | Clean threshold | - |
| c_i | 1 if r_i <= theta_c, else 0 | - |
| R_l | Frozen reference score for level l (section 5.2) | points |
| H_l | Median first-attempt human score on level l | points |
| c_max | Cap on the per-level normalised score, default 1.15 | - |

**Raw score** (this is the score the brief defines):

```
S_l = sum over i in I_l of  v_i * x_i * c_i                                  (1)
```

**Normalised level score:**

```
N_l = min( c_max, S_l / R_l )                                                (2)
```

**Headline benchmark score** over L levels, with n_l runs of level l:

```
SP = (100 / L) * sum over l of  mean over runs of N_l                        (3)
```

**Decomposition** (diagnostic, always reported):

```
V_l = ( sum_i v_i x_i ) / R_l            value loaded, relative to reference   (4)
Y_l = ( sum_i v_i x_i c_i ) / ( sum_i v_i x_i )     yield of what was loaded   (5)
S_l / R_l = V_l * Y_l
```

A player who crams the machine has high V and low Y; an over-cautious one the reverse.

**Graded secondary score**, to reduce the information lost by thresholding:

```
S_l^g = sum_i v_i * x_i * g(r_i),   g(r) = max(0, 1 - r / theta_g)           (6)
```

with theta_g > theta_c chosen so that g(theta_c) is about 0.8 [ESTIMATED]; or g taken as the standard's 0-to-5 grade divided by 5 if `standards` supplies one.

**Human-relative score** on the human-calibrated subset L_H:

```
HR = 100 * ( mean over l in L_H of N_l(agent) ) / ( mean over l in L_H of H_l / R_l )   (7)
```

A ratio of means is used, not a mean of per-level ratios, so that a level on which the median human scored near zero cannot dominate. The Atari convention is a per-game ratio 100 x (agent - random)/(human - random) [RECALLED] (snippet only), and ARC-AGI-3 uses per-level ratios with a cap of 1.15 against outliers [VERIFIED]; both needed robust aggregates or caps to tame small denominators.

**Attempt-weighted score for track B** (K = 3 washes), after PHYRE's AUCCESS [VERIFIED]:

```
A_l = ( sum_{k=1..K} w_k * max_{j<=k} N_l^(j) ) / ( sum_{k=1..K} w_k ),  w_k = ln(k+1) - ln(k)   (8)
```

For K = 3 the normalised weights are 0.500, 0.292, 0.208 [ESTIMATED: ln 2, ln 1.5, ln 1.333 divided by ln 4].

**Why c_max.** If an agent beats the frozen reference, either it found a better load or it found an exploit. Capping at 1.15 follows ARC-AGI-3 [VERIFIED] and keeps one level from dominating; every N_l above 1.05 is flagged for a person to inspect [ESTIMATED threshold]. The uncapped value is published as well.

### 5.2 Reference policies

All are run through the public API so they double as integration tests. Each appears as a row on the leaderboard.

| Policy | Definition | Washes per level | Role |
|---|---|---|---|
| Empty | Load nothing | 0 | Natural zero |
| Random-valid | Random item order; for each item sample up to 20 candidate poses uniformly from slot centres x orientation presets and keep the first that is accepted and stable; stop after 10 consecutive items fail | 3 | Trivial-agent baseline. The Agentic Benchmark Checklist asks for trivial-agent baselines [VERIFIED]; lmgame-Bench shows why (40% of unharnessed runs below random [VERIFIED]) |
| Greedy value-density | Sort by v_i / A_i (points per footprint area in the item's default preset); place each in the first free slot of the conventional rack region for its class with the default preset; ignore soil | 1 | "Competent default" that knows nothing about cleaning physics |
| Manual-following | Greedy plus the generic manual rules as code (heavy soils low and central, open side down and inward, no nesting, check arms) | 1 | Tests whether the manual alone is enough; only meaningful if the manual is shown to players |
| Reference | Best known load: the maximum over (i) a search (simulated annealing or an evolution strategy over subset, slot, preset and small continuous offsets, using a reduced-fidelity wash internally, with the top 8 candidates re-washed at official fidelity), (ii) loads hand-built by the level designer, (iii) the best human in the pilot | About 8 official | Gives R_l. Frozen per MAJOR version |
| Human median, human best | From section 6 | n/a | Human anchors on the same scale |

The selection-and-placement problem contains 3D packing with interaction-dependent rewards and is NP-hard in general [RECALLED], so R_l is a best-known value, not a proven optimum. That is acceptable: RE-Bench normalises to a "reference solution" and reports that it has not observed normalised scores above 2 [VERIFIED]; Vending-Bench 2 publishes an analytical "good strategy" estimate of about $63k as an anchor [VERIFIED].

Zero is the empty machine, not the random policy, because an LLM can plausibly do worse than random-valid by producing unstable or shadowed loads, and that range should be visible.

### 5.3 Aggregation and uncertainty

- **Point estimate:** equation (3), equal weight per level. Also report the interquartile mean over levels (drop the top and bottom 25%, average the rest), which Agarwal et al. recommend for small numbers of runs [VERIFIED].
- **Interval:** 95% percentile interval from a hierarchical bootstrap with 10,000 resamples: resample families with replacement, then levels within each family, then runs within each level. METR uses the same three-level scheme over task families, tasks and runs [VERIFIED].
- **Comparing two agents:** paired differences on the same levels, bootstrap resampling levels jointly for both agents. Report the mean difference, its interval and the between-agent correlation of level scores. Anthropic's guidance gives the reasoning and reports correlations of 0.3 to 0.7 between frontier models on common question sets [VERIFIED].
- **Clustered errors:** levels in one family are correlated. Naive standard errors that ignore clustering can be several times too small [VERIFIED, Anthropic]. In Inspect use `stderr(cluster="family")`.
- **Distribution, not just mean:** publish a performance profile (fraction of levels with N_l above tau, for tau from 0 to 1.15) per agent [VERIFIED method, Agarwal et al.], and the per-family breakdown.

### 5.4 How many levels and runs

**Variance model.** Let s_F^2 + s_K^2 = s_L^2 be the between-level variance of the true normalised score for one agent, split into a between-family part s_F^2 = ICC * s_L^2 and a within-family part; let s_W^2 be the within-level run-to-run variance (model sampling plus any simulator noise). With F families, K levels per family and R runs per level:

```
Var[ mean N ]      = s_L^2 * ( ICC/F + (1-ICC)/(F*K) ) + s_W^2 / (F*K*R)                     (9)

Var[ difference ]  = 2*(1-rho) * s_L^2 * ( ICC/F + (1-ICC)/(F*K) ) + 2 * s_W^2 / (F*K*R)     (10)

MDE = ( z_{0.975} + z_{0.80} ) * sqrt( Var[difference] ) = 2.80 * SE_diff                    (11)
```

rho is the correlation between two agents' true level scores. MDE is the smallest true difference detected with 80% power at two-sided alpha = 0.05.

**Assumed values** (all [ESTIMATED]; to be replaced by pilot measurements, section 11): s_L = 0.20, rho = 0.5 (middle of the 0.3 to 0.7 range reported for other evaluations [VERIFIED]), s_W = 0.12, ICC between 0 and 0.5.

**Results** (computed from (9) to (11) this session):

| Design | Levels | Washes per agent | ICC | 95% CI half-width, one agent | MDE, two agents |
|---|---|---|---|---|---|
| 12 families x 2 seeds x 1 run | 24 | 24 | 0.3 | 0.103 | 0.163 |
| 12 x 2 x 3 runs | 24 | 72 | 0.3 | 0.095 | 0.142 |
| 10 x 4 x 3 runs | 40 | 120 | 0.3 | 0.088 | 0.130 |
| **15 x 4 x 1 run** | **60** | **60** | 0.0 | 0.059 | 0.095 |
| **15 x 4 x 1 run** | **60** | **60** | 0.3 | 0.076 | 0.117 |
| **15 x 4 x 1 run** | **60** | **60** | 0.5 | 0.086 | 0.130 |
| 15 x 4 x 3 runs | 60 | 180 | 0.3 | 0.072 | 0.106 |
| 20 x 3 x 1 run | 60 | 60 | 0.3 | 0.071 | 0.110 |
| 30 x 2 x 1 run | 60 | 60 | 0.3 | 0.065 | 0.103 |

Reading the table:

- **Repeating runs buys little.** Tripling the washes on 60 levels moves the MDE from 0.117 to 0.106. Spending the same washes on more levels, and especially on more families, buys more.
- **60 levels in 15 families resolves differences of roughly 0.10 to 0.13 on the 0-to-1 scale** (10 to 13 points of SP). Two models closer than that will be reported as not separated. Halving the MDE needs about four times the levels.
- **A 24-level set cannot rank close models** (MDE about 0.16). It is adequate for development and for the human baseline, not for a leaderboard.

**Recommendation.** 60 test levels, one run each, as the official design. In addition, run a 12-level subset (one per shared family) two more times per model, to estimate s_W for that model and to detect models with a heavy lower tail (Vending-Bench shows means hiding derailed runs [VERIFIED]). Report s_W per model. If the pilot shows s_W above about 0.2, raise the default to three runs on all levels.

### 5.5 Simulator noise and the clean threshold

A binary clean flag turns small numerical differences into whole points. For item i with residual r_i and simulator standard deviation sigma_r,i of that residual across `sim_seed` values, the probability that a different seed flips the flag is approximately

```
p_flip,i = Phi( - | r_i - theta_c | / sigma_r,i )                            (12)
```

| Margin in units of sigma_r | 0.5 | 1 | 1.5 | 2 | 3 |
|---|---|---|---|---|---|
| p_flip | 0.31 | 0.16 | 0.067 | 0.023 | 0.001 |

[ESTIMATED: normal approximation.] With n equally valued scored items and independent flips, the standard deviation of the normalised level score from this source is about sqrt(n p (1-p)) / n: for n = 20, 0.031 at p = 0.02, 0.049 at p = 0.05 and 0.067 at p = 0.10 [ESTIMATED].

Consequences and rules:

1. **Aggregate scores are robust to this.** A per-level simulator noise of 0.05 contributes 0.05 / sqrt(60) = 0.006 to the standard error of SP, small next to the 0.03 to 0.04 from level variance [ESTIMATED from (9)].
2. **Per-level fairness is not.** Human bonuses, per-level comparisons and the reference score R_l are all exposed. Hence: fixed `sim_seed` per level (identical loads always score identically), a published per-level sigma_sim from the noise study (5 seeds on each reference load), and the acceptance rule in 5.7 that the reference load is not on the threshold.
3. **Publish the graded score (6) alongside**, so close calls are visible.
4. **Ask the simulator team for sigma_r per item as a report field in developer mode.** If the wash simulation uses Monte Carlo parcels, sigma_r can be estimated from batch statistics within a single run at no extra cost. Cross-link: `numerics`, `jets`.

### 5.6 Cost and wall-clock reporting

Per level and in total, every leaderboard row reports:

- input tokens, cached input tokens, output tokens including reasoning tokens;
- money at list price on the run date, with the price table used;
- agent wall-clock excluding simulator time; number of actions and queries; number of rejected actions;
- simulator hours (identical across agents in track A; three times that in track B);
- harness id and version, model id, sampling settings, date.

Plot SP against cost per level. HAL found that the most expensive model was on the accuracy-cost Pareto frontier in only 1 of 9 benchmarks and that higher reasoning effort gave equal or lower accuracy in 21 of 36 cases [VERIFIED]; without the cost axis those facts are invisible.

### 5.7 Designing levels so that score discriminates skill

**The optimisation problem a level poses.**

```
maximise over x in {0,1}^n and poses q:   sum_i v_i * x_i * c_i(x, q)
subject to: (x, q) is a physically admissible settled load
```

It differs from a knapsack in that c_i depends on the whole load: one item can shadow, block, flip or drip onto another. The level designer controls four levers.

| Lever | How to set it | Skill it tests |
|---|---|---|
| Capacity pressure | Candidate items need 1.3 to 2.0 times the available rack capacity [ESTIMATED range] | Selection |
| Value versus space | Draw v_i so that points per footprint is not aligned with size; include a few large low-value and small high-value items, and the reverse | Knapsack reasoning |
| Value versus cleanability | Give some high-value items hard soils that need a good position, and at least one high-value item whose soil the programme cannot realistically remove (opportunity-cost decoy) | Knowing what the machine can do |
| Interaction traps | One archetype per family (below) | Physical reasoning beyond recited advice |

**Trap archetypes.** These come from general appliance loading guidance [RECALLED]; `standards` holds the authoritative list. Each is a hypothesis about what the simulator will show. None may be hard-coded as a rule: a family is accepted only if the simulator itself produces the effect at the size required below.

| # | Archetype | Naive behaviour | Expected consequence |
|---|---|---|---|
| 1 | Shadowing by a large flat item | Baking tray or chopping board placed where it screens a row of plates or the detergent dispenser | Screened items stay dirty; detergent released late |
| 2 | Blocked spray arm | Tall item in the lower rack, or a long utensil poking through the rack floor | Arm stalls; a whole rack is under-washed |
| 3 | Upward-facing or untilted concavities | Cups, bowls and containers upright or dead level when inverted | Dirty water pools; soil redeposits |
| 4 | Nested cutlery and stacked bowls | Spoons spooning; bowls nested tightly | Contact zones stay dirty |
| 5 | Light plastics | Light containers unsecured in the lower rack | Flipped by jets, fill with water |
| 6 | Facing the wrong way | Soiled faces turned to the wall or away from the arm centre | Reduced impingement on the soiled face |
| 7 | Over-packing | Plates in adjacent tines with no gap | Soil between them is not reached |
| 8 | Uncleanable decoy | Burnt-on dish with high points | Takes space, shadows others, still scores zero |
| 9 | Rack choice | Heavy soil in the upper rack; delicate light soil in the lower | Hard soil survives where the jets are weaker |
| 10 | Corners | High-value hard-soil item in a rack corner | Less coverage from a rotating arm in a rectangular tub |

**Guarantee that not everything fits.** The generator must emit a certificate for each level: a relaxed packing bound in which each item is replaced by its minimum physically possible nested pitch, exceeding rack capacity by at least 20% [ESTIMATED margin], plus a failed attempt by a maximum-fill search that ignores cleaning. Tight nesting can defeat naive area bounds, which is why the relaxed bound must use nested pitch.

**Level size.** A human needs perhaps 15 to 25 s per item in a mouse-driven 3D interface including camera moves [ESTIMATED; measure in pilot]. For the 20-minute soft limit, a level should offer 25 to 40 candidate items of which roughly 60 to 75% can fit. Cutlery should be limited to about a dozen individually placed pieces per level, or a `place_many` action offered to both kinds of player. A compact or slimline machine variant (`machine`) keeps counts manageable. A decision for the maintainers, section 9.

**Acceptance criteria for a level.** Borrowing the structure of ARC-AGI-3's automated and human gates [VERIFIED] and Terminal-Bench 2.0's oracle check [VERIFIED]. All thresholds [ESTIMATED]; G_l is the greedy score, B_l the mean random-valid score.

| # | Criterion | Threshold |
|---|---|---|
| A1 | Infeasibility certificate present | Required |
| A2 | Oracle: the reference load replays to its stored hash and scores R_l | Required |
| A3 | Headroom over greedy | (R_l - G_l) / R_l >= 0.15 for trap families, >= 0.05 for selection-only families |
| A4 | Greedy above random | G_l >= B_l on average over the family |
| A5 | Random cannot get lucky | Estimated P(random-valid >= 0.9 R_l) < 1% |
| A6 | Reference is not knife-edge | Three reduced-fidelity washes of the reference load with every item jittered by +/- 2 mm and +/- 2 deg change the score by at most 5% of R_l |
| A7 | Reference is not on the threshold | Standard deviation of the reference score over 5 values of `sim_seed` <= 3% of R_l |
| A8 | No single item dominates | max v_i <= 20% of total points |
| A9 | Humans can do it | At least 2 of 10 pilot participants reach >= 0.7 R_l |
| A10 | Not at floor or ceiling for current models | Across the set, the best pilot model's mean N lies between 0.2 and 0.8 |

**Difficulty tiers within the set.** T1 selection only (easy soils, capacity binding); T2 placement-sensitive soils; T3 one interaction trap; T4 combined traps on held-out item classes or rack layout. Aim for roughly equal numbers. Tiering also protects against the floor effect seen in VideoGameBench, where every model scored near zero [VERIFIED].

**Construct check.** Keep a "sanity suite" of paired loads (recommended practice against the corresponding malpractice, same items) in which the simulator must rank the pair in the expected order. It serves as a regression test for the simulator and as evidence that the benchmark rewards what it claims to. The Agentic Benchmark Checklist calls this outcome validity [VERIFIED].

---

## 6. Human-baseline collection

### 6.1 Purpose and population

The baseline answers one question: how well do ordinary competent adults do on these levels, through this interface, on first exposure? Recommended populations:

| Group | Who | n | Use |
|---|---|---|---|
| General | Adults who load a dishwasher at least weekly, screened by one question; no restriction on profession | 10 per level | H_l, the published human median and spread |
| Expert panel | People with professional knowledge of dishwasher testing or loading, or team members who have studied the simulator | 3 to 5 in total | "Expert human" row; candidates for R_l |
| API players | Technically comfortable volunteers playing through the agent API | 5 | Interface-tax study (6.6) |

ARC-AGI-3 tests exactly 10 members of the general public per environment [VERIFIED]; the median reviewed human baseline has 8 [VERIFIED].

### 6.2 Interface parity, tutorial and onboarding

- Humans see the same level card, the same item records, the same manual text and the same definition of "clean" as agents. ARC-AGI-3 gave humans the same prompt as models [VERIFIED]; 76% of reviewed baselines did not match instructions [VERIFIED].
- Humans get the numeric pose panel, the labelled and gridded orthographic views, and the `check_load` buttons, which are the counterparts of what the agent can query.
- Tutorial: four tutorial levels, 10 to 15 minutes, teaching camera, select, rotate, place, remove, check, start. Each tutorial level ends by showing a pre-computed wash report for the participant's own load if cached, otherwise for the nearest worked example, plus two or three worked loads with reports. The agent's prompt contains the same worked examples as text and images.
- A short comprehension check (what scores points, when the episode ends) before scored play. Physion used 10 familiarisation trials and a preregistered attention check that excluded 112 of 800 participants [VERIFIED].
- Scored play is first exposure: each participant sees each level once, as in ARC-AGI-3 [VERIFIED].
- No wash reports are shown during scored play (track A). Reports and bonus follow by message when the batch has run.

### 6.3 Numbers, design and cost

- Human-calibrated subset: 24 `dev` levels and 24 `test` levels, 10 participants each: 480 plays.
- Session: consent and tutorial 20 min, six scored levels with 20-minute soft and 30-minute hard limits, exit survey 5 min; plan for 2 hours. 480 / 6 = 80 sessions [ESTIMATED].
- Assignment: balanced incomplete block design so that each level is played exactly 10 times and its position within sessions is counterbalanced, to average out learning and fatigue.
- Precision: with a between-person standard deviation s_H of about 0.2 on the normalised scale [ESTIMATED], the standard error of one level's median is about 1.2533 x 0.2 / sqrt(10) = 0.079, and of the mean of 24 level medians about 0.016 [ESTIMATED]. This is adequate for (7) and too coarse for per-level human-versus-model claims, which should not be made.
- Simulator time: 480 washes, about 160 hours at 20 minutes each [ESTIMATED].
- Payment: ARC-AGI-3 paid $115 to $140 per 90-minute in-person session plus $5 per environment solved [VERIFIED]; at that rate 80 sessions cost about $12,000 [ESTIMATED]. Remote recruitment through a panel is cheaper: Prolific's stated minimum is 6 GBP per hour and its recommended rate 9 GBP per hour or more [RECALLED] (snippet only); at 12 GBP per hour for 2 hours plus a bonus averaging 5 GBP, 80 sessions cost about 2,300 GBP before platform fees [ESTIMATED].
- Remote play needs a hardware check at the start (the 3D client must run acceptably), which will bias the sample towards people with recent computers. In-person sessions avoid this and give better control; they cost more.

### 6.4 Incentives

- Pay for time, with a bonus that rises with the participant's mean normalised score (for example up to 30% of base pay [ESTIMATED]).
- Never pay per level attempted. ARC-AGI-3 had to exclude participants who raced through environments to collect per-environment payments [VERIFIED]; METR found its payment scheme encouraged quick guesses and early abandonment [VERIFIED].
- Only 8% of reviewed baselines offered any performance bonus [VERIFIED]; without one, effort is uncontrolled.

### 6.5 Recording, consent and data handling

- **Recorded:** semantic action log with timings (the same JSONL as agents), tutorial and comprehension results, exit survey (strategy in the participant's words; only 10% of reviewed baselines collected explanations [VERIFIED]), coarse covariates (age band, how often they load a dishwasher, experience with 3D games or software).
- **Not recorded:** video, audio, raw mouse traces, names in the research dataset.
- **Consent form covers:** purpose (comparison with AI systems), what is recorded, pseudonymisation, publication of anonymised action logs for `dev` levels, retention period, right to withdraw before publication, payment terms, the rule against using AI assistance during the session. METR excluded attempts that used disallowed AI tools [VERIFIED]; cited research suggests over a third of crowdworkers have used AI on tasks [VERIFIED].
- **Legal and ethical:** if participants are in the UK or EU, data-protection law applies to the payment and contact data even though the research dataset is pseudonymous; the lawful basis and retention must be written down. If results are to be published academically, seek ethics review or a documented exemption; only 14% of reviewed baselines reported one [VERIFIED]. The maintainers' jurisdiction and publication plans decide the route (section 9).
- **Preregister** the exclusion rules before collecting data: failed comprehension check; hardware failure; median time per level under 2 minutes or fewer than 5 items placed per level on average [ESTIMATED thresholds]; self-reported AI use.
- **Release** the `dev` human logs, the materials and the analysis code. 78% of reviewed baselines released no human responses [VERIFIED].

### 6.6 Interface-tax study

Five people play six `dev` levels through the agent API with a minimal chat client that shows the returned images. Compare with the GUI median on the same levels:

```
tau = mean N (humans via API) / mean N (humans via GUI)                      (13)
```

Report tau with an interval. If tau is well below 1 (say under 0.8 [ESTIMATED]), the API is handicapping its users and the helper set in 3.3 should be revisited before any human-versus-model claim is made. FLE's authors flag exactly this unmeasured gap in their own benchmark [VERIFIED].

### 6.7 What to publish about the baseline

Population definition and recruitment route, n per level, payment and bonus, instructions verbatim, time limits, exclusions with counts, the full distribution per level (median, quartiles, best), time and action counts per level, and the interface-tax result. This is the reporting checklist of the human-baselines position paper [VERIFIED] applied to this study.

---

## 7. Evidence on the architecture candidates, from the benchmark's point of view

This section does not assess physical accuracy; that belongs to `numerics`, `jets`, `films` and `soils`. It lists what a rigorous benchmark needs from the simulator and how each candidate serves those needs.

| Requirement from this dossier | (a) Hybrid multi-scale with time-homogenised forcing | (b) Fully resolved free-surface simulation of a few revolutions | (c) Mixture |
|---|---|---|---|
| Low score noise for identical or near-identical loads (5.5) | Favourable. Statistics averaged over many arm revolutions converge; residual noise is confined to items near the threshold | Unfavourable. A turbulent free-surface flow is chaotic; a few revolutions are one realisation, and thresholding amplifies the difference between realisations | Favourable if the scored quantity comes from the homogenised part |
| Reproducibility across machines (4.5) | Easier. Parcel tracing and surface models can use counter-based random numbers and order-independent accumulation; much of it can run in double precision on CPU if needed | Harder. Neighbour-search order, GPU scheduling and floating-point contraction all feed a chaotic system | Depends on which part decides the score |
| A fidelity ladder: instant checks, a reduced-fidelity run for internal level design and reference search, official run (4.6, 5.2) | Natural: parcel count, surface resolution and number of homogenisation samples are continuous knobs with graceful degradation | Poor: coarsening a free-surface solver changes the physics qualitatively (numerical surface tension, jet break-up), so a cheap run is not a faithful preview | The (a) part provides the ladder |
| Caching and incremental work | Per-item and per-surface-element quantities are explicit, so partial reuse and per-item diagnostics come for free | Monolithic | As (a) |
| Per-item uncertainty sigma_r as an output (5.5) | Available from batch statistics of parcels | Needs repeated runs | As (a) |
| Emergent "trap" behaviour without hand-built rules: pooling in concavities, light items flipped, water cascading from the upper rack, arm blockage (5.7) | Needs an explicit sub-model for each phenomenon; anything not modelled cannot be a trap, and a model might learn the sub-models' quirks | Favourable in principle: these arise from the solver | Use resolved simulation where emergence matters (item motion under jets, pooling), homogenised statistics for soil removal |
| Fixed, predictable run time so that p95 stays within 30 min and no adaptivity to wall-clock is needed (4.5) | Cost scales with surface area and parcel count, both known before the run | Cost scales with resolved volume and time; number of revolutions affordable is small | Mixed |
| Explaining a result to a human player in the report (3.7) | Direct: residue maps per surface element | Direct | Direct |

**Position.** For use as a benchmark, (a) or a mixture with (a) deciding the score is preferable, with resolved simulation used either offline to calibrate sub-models or online for the specific phenomena that create traps (rigid-body response of light items, pooling). The cost of (a) to the benchmark is construct coverage: every trap archetype in 5.7 must be backed by a sub-model, and the sanity suite must show each one working.

Limits of this evidence: it concerns variance, reproducibility and operability only. If `numerics` finds that (a) cannot represent a phenomenon that decides real cleaning outcomes, realism takes precedence under the brief, and the benchmark should then absorb the extra noise by using more levels and ensemble scoring.

---

## 8. Validity limits that should be stated publicly

1. **Outcome validity rests on an uncalibrated simulator.** Until real-world tests exist, a Spotless score measures skill at loading the Spotless simulator. The brief anticipates calibration later; the benchmark card should say so.
2. **Prior exposure differs.** Humans have years of physical experience with dishwashers; models have text about them. Neither is "unfair", but the human-relative score mixes interface, experience and reasoning.
3. **Interface parity is by information, not by modality.** The interface-tax study bounds this; it does not remove it.
4. **Reference scores are best-known, not optimal.**
5. **Resolution.** With 60 levels, differences smaller than about 10 points of SP are not resolved (5.4).
6. **Harness dependence.** Official numbers are for one fixed harness. Other harnesses may do much better or worse (L1).

---

## 9. Decisions that need the maintainers' confirmation

Each item states the recommendation and why it cannot be settled by research alone.

| # | Decision | Recommendation | Why research cannot settle it |
|---|---|---|---|
| 1 | Binary or graded scoring as the headline | Keep binary as the headline, as the brief says; publish the graded score beside it | Binary is simpler to explain and noisier; a manufacturer audience may prefer graded |
| 2 | What "clean" covers | Soil residue only | The brief says "comes out clean". Whether redeposited soil, water left in concavities, spotting or drying count changes the simulator scope (`standards`, `chemistry`) |
| 3 | One wash per level as the headline protocol, with no practice washes | Yes (track A), with a three-wash track B as secondary | Changes what skill is measured and multiplies compute by the number of washes |
| 4 | Whether any quick "preview wash" exists for players | Not in scored play; possibly in a casual game mode | Good for enjoyment, but it is an oracle and makes the game an optimisation exercise |
| 5 | Whether players are given generic loading guidance and worked examples | Yes to both, identical for humans and agents | With guidance the benchmark tests applying advice to new situations; without it, it also tests recalled knowledge |
| 6 | Functional checks on request (arm rotation, dispenser door, rack push-in) | Yes, as mechanical facts only | Reduces "gotcha" failures; arguably removes one trap |
| 7 | Strictness of physical plausibility rules (insertability sweep; items on the tub floor) | Insertability enforced; anything stable and reachable allowed | Trade-off between realism and freedom to find unconventional loads |
| 8 | Level size and machine variants | 25 to 40 candidate items per level; limited loose cutlery or a multi-place action; at least two rack layouts, one held out | Drives human session length, token cost and how many levels people will tolerate |
| 9 | Multi-load levels (several cycles from one pile of dishes) | Out of scope for version 1 | Not in the brief; would add scheduling to the skill measured and multiply compute |
| 10 | Release policy | Publish the API, tutorial and `dev` levels with human data; keep `test` seeds, three families and reference loads private; the maintainers run official scoring from submitted logs | Whether the simulator source or binary is public determines whether third parties can search with it and whether manufacturers can inspect it |
| 11 | Harness policy | One minimal official harness; a separate self-reported open track | Following ARC-AGI-3; some will argue that tool-building is part of capability |
| 12 | Human baseline scope and budget | General-public sample, 10 per level on 48 levels, roughly 2,300 GBP remote or 12,000 USD in person, plus about 160 simulator-hours; ethics route to be chosen | Money, time, jurisdiction, publication plans |
| 13 | Compute provision | A named reference platform; at least three or four worker machines, or acceptance of about three weeks on one machine per MAJOR version | Hardware spend against release cadence |
| 14 | How much of a wash report is returned for private test levels | Points and per-item clean flags only; images and residue regions withheld | Rich reports help submitters and leak private levels |

---

## 10. Recommended model and defaults

This is the specification I would implement. Numbers marked [E] are estimates listed again in section 11.

### 10.1 Interfaces

1. **Core:** headless host service `spotless-simd` (rigid-body layer, renderer, wash simulator, job queue, cache). JSON over HTTP for actions and queries; WebSocket for streaming scene state to the human client and job progress to any client.
2. **Human client:** 3D game using the same session object and reducers; snaps to 1 mm and 1 deg [E]; shows numeric pose panel, labelled and gridded orthographic views, and buttons for `check_load`.
3. **Agent interface:** MCP server (stdio and streamable HTTP) exposing
   - actions: `place`, `remove`, `reset`, `set_rack`, `start_cycle`;
   - queries: `get_level`, `get_item`, `get_state`, `render`, `preview`, `list_slots`, `check_load`, `get_report`;
   - image results as MCP image content, structured results with output schemas, tool-level errors with no side effects.
4. **Adapters:** Inspect AI task package (primary evaluation harness), Harbor task directories, METR `TaskFamily`, HAL wrapper, Gymnasium environment, CLI (`serve`, `replay`, `score`, `verify`). No adapter for the hosted OpenAI Evals platform.
5. **Coordinate conventions:** tub and rack frames as in 3.3; millimetres and degrees on the wire; unit quaternion (w, x, y, z) or preset name plus yaw, pitch, roll offsets.
6. **Placement semantics:** reject on penetration above 0.5 mm [E] or failed vertical insertability sweep; lower to first contact; release at rest; settle up to 5 s simulated [E]; rest when speed < 5e-3 m/s and angular speed < 5e-2 rad/s for 0.5 s [E]. Rejected calls are free.
7. **Observation modes:** official = structured state plus images; ablations = state only, images only. Default image 768 x 768, maximum 1024.
8. **Hidden from all players:** soil-model parameters, spray and coverage fields, predicted outcomes, `sim_seed`, reference loads and scores on test levels.

### 10.2 Episode protocol

1. **Level sets:** `tutorial` 4; `dev` 24 public (12 families x 2 seeds); `test` 60 private (15 families x 4 seeds, 3 families unpublished); `fresh` generated on demand. [E]
2. **Headline track A:** one episode per level, independent context per level, tutorial pack in the prompt, one wash, no feedback until all levels are done.
3. **Secondary track B:** three washes per level with full reports between them.
4. **Budgets:** actions = 5 x human median per level (400 until human data exist) [E]; queries 1,500 [E]; agent working time 60 min per level excluding waits [E]; humans 20 min soft, 30 min hard. Hitting a budget ends the episode and the current load is washed.
5. **Runs:** 1 per test level; 3 on a 12-level variance subset.
6. **End of episode:** `start_cycle` runs rack push-in, door close and pre-checks, freezes the load, writes the manifest and queues the wash.
7. **Scoring:** batch, on the declared reference platform, at official fidelity, `sim_seed` fixed per level and version; results cached by the key in 4.6; submissions verified by replaying action logs.
8. **Standard harness (official track):** one system prompt containing the rules, manual and tutorial pack; native tool calling against the MCP tools; no code execution, no internet, no memory across levels; a fixed, published context policy (full text history, only the most recent few images retained); model sampling settings as recommended by its developer, logged.
9. **Open track:** any harness; self-reported; must publish harness code or description, cost, and action logs; verified by replay if it is to be listed.
10. **Versioning:** `spotless-MAJOR.MINOR.PATCH/levels-id` on every artefact; rules in 4.5; `repro-5`, `cross-device` and `golden-replay` in CI.
11. **Pre-release gates per level:** A1 to A10 in 5.7. Pre-release gates for the environment: 1,000,000-action fuzz and an adversarial exploit agent with human review of its transcripts.
12. **Logging:** JSONL action stream per episode with state hashes; model transcripts in the Inspect log; reports keyed by cache key; `dev` logs published.

### 10.3 Metrics

| Metric | Definition | Status |
|---|---|---|
| Raw points per level | Equation (1) | Reported |
| SP | Equation (3) with cap 1.15 on N_l | Headline |
| 95% interval | Hierarchical bootstrap over families, levels, runs; 10,000 resamples | With every SP |
| Paired difference between agents | Paired bootstrap on shared levels, with correlation | For every comparison claimed |
| Interquartile mean of N_l | Robust aggregate | Reported |
| V and Y | Equations (4), (5) | Diagnostic |
| Graded score | Equation (6) | Secondary |
| HR | Equation (7) on the human-calibrated subset | Secondary |
| Track B: first-wash N and attempt-weighted A | Equation (8) | Secondary |
| Performance profile, per-family and per-tier breakdown | 5.3 | Reported |
| Ablations: state only, images only | 3.2 | Reported |
| Cost, tokens, wall-clock, actions, queries, rejected actions | 5.6 | Reported with every row |
| Reference rows | Empty, random-valid, greedy, manual-following, human median, human best, expert panel | On the leaderboard |
| Simulator noise per level | Standard deviation over 5 seeds on the reference load | In the benchmark card |
| Interface tax tau | Equation (13) | In the benchmark card |

### 10.4 Human baseline

General public screened for weekly dishwasher use; 10 per level on 24 `dev` and 24 `test` levels; about 80 two-hour sessions; first exposure; identical instructions and manual; tutorial and comprehension check; time pay plus score-linked bonus; action logs only; preregistered exclusions; consent and data handling as in 6.5; five additional API players for the interface tax; three to five experts as a separate row.

---

## 11. Calibration parameters

Values that are estimates today and should be measured in pilots or in the planned real-world tests. "Expected range" is my judgement of where the measured value will fall.

| Parameter | Symbol | Default | Expected range | How to measure |
|---|---|---|---|---|
| Mean wash wall-clock on the reference machine | E[T] | 20 min | 8 to 25 min given p95 = 30 min | Time 100 washes of varied loads |
| Concurrent washes per reference machine | - | 1 | 1 to 2 | Memory and GPU profiling (`numerics`) |
| Between-level standard deviation of normalised score | s_L | 0.20 | 0.12 to 0.30 | Pilot: 3 models and the reference policies on `dev` |
| Share of level variance between families | ICC | 0.3 | 0.1 to 0.6 | Same pilot, variance components |
| Within-level run-to-run standard deviation (model sampling) | s_W | 0.12 | 0.05 to 0.25 | 5 runs per level on 12 levels per model |
| Correlation of level scores between agents | rho | 0.5 | 0.3 to 0.7 | Same pilot |
| Simulator noise in level score | sigma_sim | <= 0.03 R_l target | 0.01 to 0.08 | 5 values of `sim_seed` on reference and greedy loads |
| Per-item residual noise | sigma_r | unknown | - | Batch statistics inside one wash, or repeated seeds |
| Clean threshold | theta_c | from `standards` | - | Align with the test standard's grading; later with real tests |
| Graded-score scale | theta_g | g(theta_c) about 0.8 | - | Choose after seeing the distribution of r |
| Cap on normalised level score | c_max | 1.15 | 1.05 to 1.25 | Review exceedances in pilot |
| Position quantum | delta_p | 1 mm | 0.5 to 2 mm | Check that humans and agents can still realise reference loads |
| Angle quantum | delta_theta | 1 deg | 1 to 5 deg | Same |
| Penetration tolerance | eps_pen | 0.5 mm | 0.1 to 1 mm | Tune with `items` against false rejections on tine contacts |
| Rest criterion | v_tol, omega_tol, t_hold | 5e-3 m/s, 5e-2 rad/s, 0.5 s | within a factor of 3 | Tune so that visibly settled items report `stable` |
| Settle limit | - | 5 s simulated | 3 to 10 s | 99th percentile of settle times |
| Rack push-in profile | - | 0.5 m/s peak, 2 m/s^2, 5 m/s^2 at end stop | 0.3 to 1.0 m/s; 1 to 10 m/s^2 | Accelerometer on a real rack (`machine`) |
| Action cap multiplier | - | 5 x human median | 3 to 10 | Fraction of agent episodes truncated in pilot (target under 5%) |
| Provisional action cap | - | 400 | 200 to 600 | Replace with the rule above once human data exist |
| Query cap | - | 1,500 | 500 to 3,000 | Cost per level in pilot |
| Agent working-time limit | - | 60 min | 30 to 120 min | Pilot latency |
| Human time per item | - | 20 s | 10 to 40 s | Pilot timings |
| Human soft and hard limits per level | - | 20 and 30 min | 15 to 30 and 25 to 45 min | Pilot completion times |
| Between-person standard deviation of normalised score | s_H | 0.2 | 0.1 to 0.3 | Human pilot, 10 people on 6 levels |
| Participants per level | n | 10 | 8 to 20 | Standard error of the median against cost |
| Levels per human session | - | 6 | 4 to 8 | Pilot fatigue and timing |
| Interface tax | tau | unknown | 0.6 to 1.0 | Study in 6.6 |
| Capacity pressure | - | 1.3 to 2.0 | - | Level generator tuning against A3 and A9 |
| Infeasibility margin | - | 20% | 10 to 30% | Maximum-fill search failures |
| Level acceptance thresholds A3, A5, A6, A7, A8, A9, A10 | - | as in 5.7 | - | Adjust after the first generated batch |
| Flag threshold for beating the reference | - | N_l > 1.05 | - | Review workload |
| Cross-device agreement | - | >= 99% of clean flags; score SD <= 1% R_l | - | Golden set on two GPU families |
| Cache rounding | - | 0.1 mm, 1e-4 | - | Check that rounding never merges loads with different reports |
| Image tokens per view | - | 784 at 768 px on one provider's documented formula | provider-specific | Count per provider |
| Tokens and cost per level | - | unknown | - | Pilot with the standard harness |
| Bonus size | - | up to 30% of base | 10 to 50% | Effort indicators in pilot |
| Wash hard timeout | - | 60 min | 45 to 90 min | Tail of wash-time distribution |

Calibration that depends on future real-world tests and affects this dossier: theta_c and the mapping from residual soil to "clean"; whether each trap archetype reproduces on real machines; whether the simulator's ranking of the sanity-suite pairs matches reality.

---

## 12. Sources

Fetched and read this session (basis for [VERIFIED] tags):

1. ARC Prize Foundation. ARC-AGI-3 technical report. https://arcprize.org/media/ARC_AGI_3_Technical_Report.pdf (sections 2.3, 3.3 to 3.6, 4.1 to 4.3, 5.1 to 5.3, Tables 1 and 2)
2. ARC Prize documentation, scoring methodology. https://docs.arcprize.org/methodology.md
3. ARC Prize blog, "Measuring Human Performance on ARC-AGI-3". https://arcprize.org/blog/arc-agi-3-human-dataset
4. ARC Prize blog, ARC-AGI-3 launch. https://arcprize.org/blog/arc-agi-3-launch
5. ARC Prize blog, "ARC Prize Side Quest: SnakeBench". https://arcprize.org/blog/snakebench
6. Zhang et al. VideoGameBench. https://arxiv.org/abs/2505.18134 (HTML v2: benchmark construction, Tables 2 to 4, limitations)
7. Paglieri et al. BALROG. https://arxiv.org/abs/2411.13543 (HTML v1: sections on environments, metric, Tables 2 and 3, appendices on seeds)
8. Hu et al. lmgame-Bench. https://arxiv.org/abs/2505.15146 (HTML v2: section 2.2, Tables 1 and 2)
9. Hopkins, Bakler, Khan. Factorio Learning Environment. https://arxiv.org/abs/2503.09617 (HTML v1: environment, lab-play, open-play, limitations)
10. Factorio Learning Environment repository README. https://github.com/JackHopkins/factorio-learning-environment
11. Backlund, Petersson. Vending-Bench. https://arxiv.org/abs/2502.15840 (HTML: tools, Table 1, human baseline)
12. Andon Labs. Vending-Bench 2. https://andonlabs.com/evals/vending-bench-2
13. Guertler et al. TextArena. https://arxiv.org/abs/2504.11442 (HTML v1)
14. Bradshaw. "Is Gemini now better than Claude at Pokemon?" https://www.lesswrong.com/posts/7mqp8uRnnPdbBzJZE/is-gemini-now-better-than-claude-at-pokemon
15. Bakhtin et al. PHYRE. https://arxiv.org/abs/1908.05656 (read via https://ar5iv.labs.arxiv.org/html/1908.05656: action tiers, AUCCESS, baselines, appendix B)
16. Li et al. I-PHYRE. https://arxiv.org/abs/2312.03009 (HTML: splits, human study, Table 2)
17. Bear et al. Physion. https://arxiv.org/abs/2106.08261 (HTML v3: human study, Table S1)
18. DeepPHY. https://arxiv.org/abs/2508.05405 (HTML v1)
19. Yang et al. EmbodiedBench. https://arxiv.org/abs/2502.09560 (HTML v3)
20. Li et al. BEHAVIOR-1K. https://arxiv.org/abs/2403.09227 (HTML v1)
21. 2025 BEHAVIOR Challenge. https://behavior.stanford.edu/challenge/archive/2025/index.html
22. Shridhar et al. ALFRED. https://arxiv.org/abs/1912.01734 (abstract)
23. Puig et al. VirtualHome. https://arxiv.org/abs/1806.07011 (abstract)
24. Valmeekam et al. PlanBench. https://arxiv.org/abs/2206.10498 (HTML v4)
25. PackLab. https://arxiv.org/abs/2609.23784 (HTML: Tables I and II)
26. METR. Measuring AI Ability to Complete Long Tasks. https://arxiv.org/abs/2503.14499 (HTML: sections 2.1, 2.2, 3.1, appendix C.1)
27. Wijk et al. RE-Bench. https://arxiv.org/abs/2411.15114 (HTML: sections 3.2, 3.4, 4.2, 6)
28. Xie et al. OSWorld. https://arxiv.org/abs/2404.07972 (HTML v2)
29. Terminal-Bench 2.0. https://arxiv.org/abs/2601.11868 (HTML v1: construction, verification, Table 2, appendix B)
30. Zhu et al. Establishing Best Practices for Building Rigorous Agentic Benchmarks. https://arxiv.org/abs/2507.02825
31. Kapoor et al. AI Agents That Matter. https://arxiv.org/abs/2407.01502
32. Holistic Agent Leaderboard. https://arxiv.org/abs/2510.11977
33. Wei et al. Position: Human Baselines in Model Evaluations Need Rigor and Transparency. https://arxiv.org/abs/2506.13776
34. Anthropic. A statistical approach to model evaluations. https://www.anthropic.com/research/statistical-approach-to-model-evals (paper: https://arxiv.org/abs/2411.00640, not opened)
35. Agarwal et al. Deep Reinforcement Learning at the Edge of the Statistical Precipice. https://arxiv.org/abs/2108.13264 (HTML)
36. Inspect AI documentation. https://inspect.aisi.org.uk/llms.txt ; tools-mcp, human-agent, scoring-policy, metrics, setting-limits, agent-bridge pages under https://inspect.aisi.org.uk/
37. METR Task Standard. https://raw.githubusercontent.com/METR/task-standard/main/STANDARD.md
38. Harbor documentation. https://docs.harborframework.com/core-concepts/tasks/overview.md ; https://docs.harborframework.com/tasks/multi-container
39. Model Context Protocol specification: tools (2025-06-18) https://modelcontextprotocol.io/specification/2025-06-18/server/tools ; changelog (2025-11-25) https://modelcontextprotocol.io/specification/2025-11-25/changelog ; tasks https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks
40. Gymnasium Env API. https://gymnasium.farama.org/api/env/
41. Rapier determinism guide. https://rapier.rs/docs/user_guides/rust/determinism/
42. Jolt Physics documentation, deterministic simulation. https://jrouwe.github.io/JoltPhysics/index.html
43. OpenAI API deprecations. https://developers.openai.com/api/docs/deprecations.md
44. Anthropic vision guide (image token accounting). https://platform.claude.com/docs/en/build-with-claude/vision

Seen only as search-result snippets, or not opened (basis for [RECALLED] tags; check before relying on them):

45. Prolific researcher help, payment guidance. https://researcher-help.prolific.com/en/articles/445266-how-much-should-i-pay-participants
46. Google Research blog on DQN (human-normalised score formula). https://research.google/blog/from-pixels-to-actions-human-level-control-through-deep-reinforcement-learning/ ; Mnih et al., Nature 2015, doi:10.1038/nature14236
47. MCU: An Evaluation Framework for Open-Ended Game Agents. https://arxiv.org/abs/2310.08367 ; MineCollab / MINDcraft. https://arxiv.org/abs/2504.17950
48. RoboBPP. https://arxiv.org/abs/2512.04415 ; PolyComp. https://arxiv.org/abs/2608.14741 ; Text2CAD-Bench. https://arxiv.org/abs/2605.18430
49. WebGPU Shading Language specification, floating-point evaluation section. https://www.w3.org/TR/WGSL/ (page fetched but the relevant section was beyond what I could read); WebGPU CTS floating-point primer, as mirrored at https://kdab.searchfox.org/firefox-main/source/dom/webgpu/tests/cts/checkout/docs/fp_primer.md
50. Hacker News discussion of ARC-AGI-3 scoring (mirror). https://hn.nuxt.dev/item/47521150

Gaps I could not close:

- The exact wording of the WGSL specification on floating-point reassociation and accuracy.
- Harbor's `task.toml` schema for declaring MCP servers and timeouts.
- The current Factorio Learning Environment release notes (Gymnasium and Inspect integration).
- Full texts of the Minecraft suites, RoboBPP and the CAD benchmarks.
- No published benchmark was found that scores an LLM's 3D loading by a fluid-and-soil simulation, so there is no direct precedent for the noise levels, level counts or human performance assumed in sections 5 and 6.
