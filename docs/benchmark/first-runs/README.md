# First runs: 11 October 2026

> **Record of the build, kept as written.** The first episodes of a model and the measurements
> that shaped the harness, on levels, parameter sets and tool descriptions that have since
> changed, mostly at the fast tier. They are not results. The episodes on the finished course are
> in [`course/`](course/README.md), and how to run the benchmark today is in
> `docs/benchmark/README.md`. The index of the documents is `docs/README.md`.

**Evening of 11 October: the first measurements on the finished course are in
[`course/`](course/README.md)**: `gpt-6.1-sol` on the tutorial, the breakfast and the dinner
party, `gpt-6-astra` on the breakfast and the dinner party, and the four reference policies
on all three, at the official tier on Eco 50 with `anchored-v7.owner-capsule`; every model
episode verified by replay and by a second wash. Everything below this paragraph is of
earlier in the day, on earlier levels, parameter sets and tool descriptions, and mostly at
the fast tier.

Three things are here. **The first episodes of a real model** (section 0): the tutorial played
twice by `gpt-6.1-sol` through an OpenAI-compatible endpoint, with the standard harness as it
then was. **A full level
within a model's context** (section 6, later the same day): what those episodes showed could
not scale, what was changed (results that say what changed, slot advice that fits in a
screen, a conversation that stays short), the measurements before and after, and the first
episode of a model on a level of 44 items; section 7 is what an independent review of that
work found and what was done about it. And, from earlier the same day, what was done
**before any model could be called** (sections 1 to 5). The Anthropic path of the harness is
still untested against the live API.

## 0. The first model episodes: gpt-6.1-sol on the tutorial

```sh
pnpm --filter @spotless/bench bench run --levels tutorial --policies openai:gpt-6.1-sol \
  --tier fast --max-input-tokens 2000000 --out <dir>
```

Benchmark mode, the standard loop (`docs/benchmark/README.md` section 2), the Responses API,
reasoning effort left at the model's default (the API reported `medium`), **fast tier: a
preview, not a benchmark result**. Washed with `spotless-sim 0.5.0 water-6`, parameters
`anchored-v5.owner-capsule`, wash code `19cbd2f2`. `gpt-6-astra` was not run.

| | `sol-tutorial-1/` (07:30 UTC) | `sol-tutorial-2/` (07:37 UTC, after the corrections below) |
|---|---|---|
| Episode | `546ea72a` | `bdd62ee0` |
| Score (fast tier, preview) | 64 of 64 points, 12 of 12 items loaded and clean | 64 of 64 points, 12 of 12 |
| Model turns, each one tool call | 34 | 24 |
| Tool calls | 19 `place`, 4 `list_slots`, 3 `render`, 3 `set_rack`, `get_level`, `get_state`, `preview`, `check_load`, `start_cycle` | 13 `place`, 3 `list_slots`, 2 `render`, 2 `set_rack`, `get_level`, `get_state`, `check_load`, `start_cycle` |
| Refused calls | 7, all `place` with `collision_at_pose` | 1, `place` with `collision_at_pose` |
| Budget used | 15 actions of 400, 10 queries of 300 | 14 actions, 8 queries |
| Pictures sent to the model | 3 (768 px; none was pruned) | 2 |
| Input tokens, all requests | 1,182,274: 1,133,629 read from the cache, 48,543 written to it, 102 neither | 756,379: 711,097 read, 45,210 written, 72 neither |
| Largest request | 48,546 tokens | 45,213 tokens |
| Output tokens | 1,959, of them 631 reasoning | 1,031, of them 157 reasoning |
| Cost | not recorded: no prices were supplied | not recorded |
| Requests, retries, cut-off turns | 34, 0, 0 | 24, 0, 0 |
| Wall time | loading 2 min 49 s, wash 45 s, 219 s in all | loading 2 min 03 s, wash 48 s, 176 s in all |
| Verified | by replay in the run (log, load); again with `bench verify --rewash`: log, load and score (same verdicts and points; the result hash of the second wash differs) | the same |

Each directory holds `record.json` (the episode record), `transcript.json` (the system prompt,
every turn with its tool calls and results as text, tokens per turn), `images/` (the pictures
the tools returned) and `results.md` (the table the run printed). None holds the key or the
address of the endpoint: the record says `endpoint: azure` and no more. When the repository was
published (12 October 2026) the provider's tool-call identifiers in the transcripts here and
under `course/` (`call_` and 24 characters) were replaced by generated ones of the same length,
the same identifier for the same call within a file; nothing else in a transcript was changed.

**Before the first call: the estimate, and what was done about it.** The rehearsal of section 1
(68 requests, the careful scripted load with a preview before every placement) estimates 3.97
million input tokens read from the cache and 0.10 million written: 4.07 million for one
tutorial episode, twice the two million at which an episode was to stop. The episode
was run all the same, **with the limit enforced instead of estimated**: `--max-input-tokens
2000000` (added for this; `docs/benchmark/README.md` section 2) ends an episode before its
requests can add up to more. The limit was not reached: the model used 1.18 and 0.76
million. The rehearsal overestimates twice over. It takes 3.2 characters for a token; the endpoint counted the system
prompt and the thirteen tools (41,000 characters) as 8,700 tokens, 4.7 characters a token. And
it makes 68 requests where the model made 34 and 24: the model asked slot advice once per kind
of piece, previewed once in two episodes and took nothing out again.

**One thing the first request showed.** The deployment refuses function tools on chat
completions unless reasoning is off ("Function tools with reasoning_effort are not supported
for gpt-6.1-sol in /v1/chat/completions. To use function tools, use /v1/responses or set
reasoning_effort to 'none'"). The provider therefore speaks the Responses API by default;
chat completions stays as `--api chat`. That first request failed before any token was
counted; five tiny requests to the Responses API followed (about 1,500 tokens in all), to learn
its shapes and to check that a picture inside a function output is really seen (the model read
two axis values off a grid picture).

### How the model played

It read the level card, the scene and a plan view of the lower basket with grid and labels,
asked slot advice for a dinner plate, and seated both dinner plates at suggested drops in the
rear rows, facing each other. It asked the cutlery basket's cells once per kind of piece and
put the five pieces of cutlery one to a cell, forks and spoons handle down, the knife handle
up. It pushed the lower basket in, pulled the upper one out, looked at its plan view, and
stood the glasses, the mug and the bowl mouth down and tilted on the floor of the upper
basket. It ran the mechanical check and started the cycle. It wrote no words at all between
its calls, and almost no reasoning (631 and 157 tokens in an episode).

Where it stumbled, in the first episode:

1. **A pose refused for touching the basket (two times; once in the second episode).** The
   glass and the mug were asked for at a height where, tilted, they cut 3 and 5 mm into the
   floor of the upper basket: `collision_at_pose`, `colliding_with: ["upper_rack"]`. The model
   asked again 20 to 30 mm higher and was accepted: it recovered each time in one call, but by
   guessing; nothing told it that height is free because the item is lowered to first contact.
2. **A pose refused for touching "the fittings" (five refusals in a row on the deep plate).**
   The deep plate, flat and mouth down near the right wall of the upper basket, was refused
   with `colliding_with: ["upper_rack_fittings"]`, 23 mm deep. Nothing says what the fittings
   are or which of them was met. The model took it for the knife shelf, folded that up
   (`set_rack shelf_knife_shelf up`, an action spent), and sent the identical pose again: the
   identical refusal: by elimination what it had met was a cup shelf folded up against the
   right wall, where the plate was (the refusal does not say). The
   plan view it had looked at draws the shelves and names none. Three more poses were refused
   before one a few centimetres further from the wall was taken.
3. **Feedback passed over (second episode).** Pushing the lower basket in reported `fork_02`
   moved by 6.6 mm and turned by 90 degrees: it fell over in its cell. The model went on
   without a look. The description of `place` says what a large rotation means; that of
   `set_rack` did not.

Nothing else in the play was a matter of the interface. It never got into a loop, and it
misread no schema: no call was malformed. There is no sign of a picture it could not use (the
placements after each plan view are at coordinates the picture shows free), though a model
that writes no words leaves little to judge that by. In the second episode it stood the deep
plate in the lower basket instead.

### What was changed

| What | Where |
|---|---|
| After `collision_at_pose`: what the names in `colliding_with` mean (an item; a basket by its name: floor, walls and tine rows; `<basket>_fittings`: the folding shelves; `tub`), that a pose touching the basket is most often too low and that height costs nothing because the item is lowered anyway, that the same call in the same scene gets the same answer, and that `preview` tests for free | description of `place` (and a pointer from `preview`), `packages/mcp/src/descriptions.ts` |
| The plan view of a basket with labels now names each folding shelf where it is, with its state (`shelf_cup_front (up)`, `shelf_knife_shelf (down)`), as it names the tine rows; `sol-tutorial-2/images/0016-render.png` shows it | `shelfNotes` in `packages/server/src/render-service.ts`, descriptions of `render` and `set_rack`; pictures are cached under a key that now carries the version of this writing |
| `set_rack`: an item of `moved_items` that turned by 45 degrees or more has tipped over and is worth a look | description of `set_rack`. Made after the second episode; no episode has been run since |

The second episode was run with the first two. It had one refusal where the first had seven
and ten turns fewer, and answered its one refusal (the bowl, 0.9 mm into the floor) by asking
20 mm higher. **That is one episode against one, of a model whose play varies from run to
run, and this time it put the deep plate in the lower basket and never came near a shelf: the
second episode shows that nothing broke, not that the corrections caused the difference.**

Not changed, because it is the session's to change (item 5 of section 3 below, now met by a
model): a refusal names the body (`upper_rack_fittings`) where a contact names the part
(`upper_rack_fittings.shelf.cup_rear`). Naming the part in `colliding_with` would have ended
the model's five refusals at the first.

## Before a model could be called

What is here instead, each of it done without a model's API:

| File | What it is |
|---|---|
| `cost-estimate.json`, section 1 below | The estimate made before the first call, from a rehearsal of the standard loop |
| `walkthrough/` | One episode of the tutorial played by hand through the MCP tools, call by call, by the engineer agent of this stage (Claude Opus 5.5 in Claude Code). Not a benchmark episode: section 2 |
| section 3 | Where the interface, and not dishwashers, would make a player go wrong, and what was changed |
| `reference/` | The four reference policies played through the harness on the two levels the models were to play, at the official tier, verified by replay: section 4 |
| section 5 | The commands for the model episodes on Anthropic's API, which have not been run |

## 1. What an episode would cost

*This is the estimate as it was made before any model had played, with the results and the
script of then (the whole scene in every action's result, 3.2 characters a token). Section 6
has the measurement since, and `measurements/episode-cost.md` the same table from it: the
weeknight dinner as rehearsed on `claude-sonnet-5-5` is 1.63 dollars there, not 15.30.*

> Estimates, not measurements. No Anthropic model was run. The prices are what the script
> assumed on 6 October 2026 and may be wrong or out of date; check the provider's price list.
> The two models that have played were not priced, so no comparison of cost can be read from
> these tables.

`pnpm --filter @spotless/bench episode-cost --level tutorial --level weeknight-dinner`
(`packages/bench/scripts/episode-cost.ts`). The standard loop of the harness (the same system
prompt, the same thirteen tools with their descriptions and schemas, the same policy for old
pictures) is played by a scripted provider that makes the calls of the level's careful
reference load and looks the way a player without eyes must: the level card, the sheet of
items, slot advice once for every kind of piece and basket, a free preview before every
placement, a picture every four placements, the mechanical check. Every request the provider
is sent is measured as a model's API would be sent it.

| Level | Requests | Tool calls | System prompt and tools | Conversation at the end | Pictures | Largest request | Read from the cache, in all | Written to the cache |
|---|---|---|---|---|---|---|---|---|
| tutorial (12 items) | 68 | 16 place, 16 preview, 14 set_rack, 8 list_slots, 7 render, 4 remove, get_level, check_load | 41,000 characters | 294,000 characters | 7 | 97,000 tokens | 3.97 million tokens | 0.10 million |
| weeknight-dinner (44 items) | 265 | 80 place, 80 preview, 41 remove, 23 render, 19 list_slots, 19 set_rack, get_level, check_load | 41,000 characters | 1,605,000 characters | 23 | 508,000 tokens | 59.3 million tokens | 0.95 million |

Tokens are **estimated**: 3.2 characters a token for text (it is mostly JSON with numbers) and
750 pixels a token for a picture. Counting them exactly needs the API. Prices are what the
script assumed on 6 October 2026, per million tokens: `claude-haiku-5-5` 0.10 in, 0.50 out
(five times that for a prompt over 100,000 tokens); `claude-sonnet-5-5` 2 in, 10 out, 0.20 read from the cache,
2.50 written to it; `claude-opus-5-5` 4 in, 20 out, 0.20 read, 5 written.

What a rehearsal cannot know is how a model plays. Three scenarios (US dollars an episode; cost
grows with the square of the turns, because every turn is sent the whole conversation):

| Level | Model | As rehearsed, 400 tokens out a turn | Twice the turns, 1,200 tokens out a turn | Four times the turns, 2,500 tokens out a turn |
|---|---|---|---|---|
| tutorial | claude-haiku-5-5 | 0.07 | 1.00 | 5.01 |
| tutorial | claude-sonnet-5-5 | 1.31 | 5.33 | 20.70 |
| tutorial | claude-opus-5-5 | 1.82 | 7.45 | 28.48 |
| weeknight-dinner | claude-haiku-5-5 | 3.58 | 14.59 | 56.99 |
| weeknight-dinner | claude-sonnet-5-5 | 15.30 | 58.96 | 228.16 |
| weeknight-dinner | claude-opus-5-5 | 18.73 | 70.06 | 264.15 |

**The four episodes planned** (tutorial with Haiku and Sonnet, a full level with Sonnet
and Opus) come to about 35 dollars as rehearsed and to about 135 in the middle scenario, so
the order planned was: the two tutorial episodes first, their real token counts put in place of the estimate, and the
full level only with a limit of turns that the measured cost per turn allows.

A model that asks slot advice once for each kind of plate and places every piece once would be
cheaper than the rehearsal, which follows the careful scripted loader: that loader places 80
times and takes pieces out again 41 times.

**Where the tokens go.** On the full level, 76 % of the 1.54 million characters of tool
results are the whole scene (`state`: every placed item with pose and contacts) that `place`
(8,100 characters a call on average), `remove` and `set_rack` return every time; 18 % are
`list_slots` (14,400 a call; 28,000 for the lower basket with an item); the level card is 3 %.
On the tutorial `list_slots` is 38 %. Leaving the item list out of the results of actions
(`moved_items` already says what moved, `get_state` gives the scene for a query) would cut a
full-level conversation to about a third and its cost to about a fifth. That is a change of the
session's contract and was not made here; it is the first thing to decide before models are
run (section 3, items 6 and 7).

## 2. The walkthrough by hand

`walkthrough/transcript.txt` (every call and its result as the MCP server sent it then, long
results cut) and four of the pictures. The episode record the server wrote was not kept. The
results in the transcript are in the shape of before 11 October (the whole scene with every
action, slot advice of 28,000 characters): section 0 says what they are now.

Who played: the engineer agent of this stage, by hand, one MCP call at a time
(`packages/mcp/scripts/call.ts` against the MCP server of an episode created in benchmark
mode), without the harness's prompt, limits or context policy, and knowing how the levels are
drawn. It is a reading of the interface, **not a benchmark episode**, and its score is no
result of any model.

How it went: 14 accepted actions (12 placements, 2 basket moves), 15 charged queries, two placements
refused as collisions, and two calls the schema rejected.

1. The level card (21,000 characters), the sheet of items and a plan view of the lower basket
   with grid and labels: all readable; the tine rows are named in the picture, a point of the
   picture reads as the x and y to give to `place`.
2. Slot advice for a plate: 28,061 characters, 66 slots. Both dinner plates were seated at
   suggested drops in the rear rows, each facing the middle; they settled by 6 mm and 3 degrees.
3. The deep plate, and then the bowl, were first sent to slots guessed from the plates' and
   refused (collisions with `lower_rack`, 7.6 and 6.5 mm deep, the part not named). A second answer of slot advice (29,331
   characters) offered 30 free drops of which 5 seat; it was seated in a front row.
4. The bowl is offered 35 free drops in the lower basket and none seats (all perch on the tine
   tips). It went into the upper basket with the preset `inclined`, leaning on the tines.
5. The five pieces of cutlery, one to a cell, from 2,067 characters of cell advice.
6. The lower basket pushed in, the upper pulled out; the two smoothie glasses and the mug put
   mouth down on the floor of the upper basket by reading its plan view. They settled leaning
   21 to 33 degrees. Where the tablet tray is had to be guessed from the picture.
7. The mechanical check: arms turn, door closes, the tablet's path is clear. A three-quarter
   view with labels could not show how the glasses stood; the elevation from the right could.
8. The wash: not kept. The transcript ends at the last look before the cycle, and the
   episode's record was not saved with it, so no score of the walkthrough is given here.

The two calls the schema rejected were the player's own error (the pose wrapped in an object
the schema does not have; the rejection named every field). Nothing in the play needed knowledge of dishwashers
beyond the loading guidance: plates face the middle, hollow pieces go in mouth down, nothing
in the tablet's way.

## 3. Where the interface would mislead, and what was done

Found in the walkthrough and in the rehearsal. "Fixed" means changed in this stage; the rest
is asked of whoever owns the part.

| # | What a player meets | Why it matters | Done |
|---|---|---|---|
| 1 | `list_slots` lists the slots of both rows of a pair, and a plate stands across the pair: `tine_row_r1.slot_03` and `tine_row_r2.slot_03` are the same place with the same `suggested_drop`. The lower basket reads as 66 slots, 43 of them free, where it has about 21 places for a plate | A second plate sent to the "other" slot is refused as a collision; a model counts twice the room it has | **Fixed** in the tool description (`packages/mcp/src/descriptions.ts`): the first thing it says now. Asked of the session: list a pair's place once |
| 2 | For a bowl or a deep plate nearly every suggestion is `drop_free: true` with `drop_seats: false`: a pose above the tine tips where the piece would only perch (bowl: 35 free, none seats; deep plate: 30 free, 5 seat) | `drop_free` reads as "a good place"; the piece tips over | **Fixed** in the description: use a suggestion only where `drop_free` and `drop_seats` are both true |
| 3 | The loading guidance tells every player to keep the tablet tray free, and nothing said where it is: the level card gave the lid of the dispenser only, and the pictures draw the tray without naming it | 8 of the 12 random reference loads block the tablet's path; one careless load of the first drawing did by accident and lost half its score | **Fixed**: the card of the basket that carries it has `tablet_tray` (its box in the basket's frame; `packages/levels/src/card.ts`, the MCP schema, the descriptions of `get_level` and `render`). Asked of the renderer: name it in the picture |
| 4 | A three-quarter view with labels names every item of both baskets; with the upper basket pulled out over the lower the labels pile up and a glass cannot be told from the cutlery behind it (`walkthrough/03-iso-upper-labels.png`) | The picture cannot be used to check how a glass stands | **Fixed** in the description of `render`: which view for what (plan view for where, elevation for how a hollow piece stands). Asked of the renderer: label only the basket the view is of |
| 5 | A pose that overlaps the basket is refused with `colliding_with: ["lower_rack"]`; a settled item's contacts name the part (`lower_rack.tine_row_r1`) | The player cannot tell a tine from the wall, so not which way to move | Asked of the session: name the part in a refusal as in a contact |
| 6 | Every result of `place`, `remove` and `set_rack` carries the whole scene | No error, but most of what a model is sent (section 1) | Asked of the session and the lead: leave the item list out of action results |
| 7 | `list_slots` with an item answers with 28,000 characters for the lower basket; `suggested_orientation` repeats `suggested_drop.orientation` in every slot, and numbers of the report carry 13 decimals | The same | **Fixed** in the description: the answer is long and holds for every item of the type, ask once for each kind of piece. Asked of the session: a shorter answer |
| 8 | The rule of the card says an item is clean "counting ... residue left where dirty water stood"; the simulation does not model what standing water leaves, and a mug of hot chocolate stood mouth up comes out clean | The rule promises a cost the wash does not charge (the open decision on retained water) | Not changed: which of the two gives way is an open design decision |

None of these was found by a model (what a model then met is in section 0; it met item 5).
They are what the same model family, playing by hand,
stumbled over or would have: items 1, 2 and 4 in play, 3 by looking for the tray, 5 by a
refusal, 6 and 7 by counting.

## 4. The reference policies through the harness

`pnpm --filter @spotless/bench bench run --levels tutorial,weeknight-dinner --policies
empty,careful,careless,random --verify replay --no-render` at 06:11 to 06:35 on 11 October:
8 episodes in 1,439 s, each played through the MCP tools of its own episode in benchmark mode,
washed at the official tier on Eco 50 (`spotless-sim 0.5.0 water-6`, `anchored-v5.owner-capsule`,
wash code `19cbd2f2`), and verified by a fresh replay of its log. The records are in
`reference/` (the two full careful and careless records are 4.7 MB each: the careful loader
makes some 5,000 calls, most of them free previews, and every one is in the log); the table is
`reference/results.md` and `reference/results.json`.

| Level | Player | Tier | Points | Share of points | Strict to lenient | At the edge | Value loaded | Yield | Clean of loaded | Loaded of offered | Actions | Queries | Refused calls | Verified (log / load / score) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| tutorial | careful | official | 64 of 64 | 100.0 % | 64 to 64 | 0 | 100.0 % | 100.0 % | 12 of 12 | 12 of 12 | 34 | 18 | 0 | 1 / 1 / 0 of 1 |
| tutorial | careless | official | 52 of 64 | 81.3 % | 52 to 52 | 0 | 100.0 % | 81.3 % | 10 of 12 | 12 of 12 | 70 | 20 | 30 | 1 / 1 / 0 of 1 |
| tutorial | random | official | 18 of 64 | 28.1 % | 18 to 18 | 0 | 78.1 % | 36.0 % | 3 of 8 | 8 of 12 | 35 | 6 | 19 | 1 / 1 / 0 of 1 |
| tutorial | empty | official | 0 of 64 | 0.0 % | - | - | 0.0 % | - | 0 of 0 | 0 of 12 | 0 | 0 | 0 | 1 / 1 / 0 of 1 |
| weeknight-dinner | careful | official | 178 of 283 | 62.9 % | 178 to 178 | 0 | 66.1 % | 95.2 % | 35 of 37 | 37 of 44 | 140 | 46 | 3 | 1 / 1 / 0 of 1 |
| weeknight-dinner | careless | official | 147 of 283 | 51.9 % | 147 to 147 | 0 | 64.0 % | 81.2 % | 29 of 36 | 36 of 44 | 207 | 49 | 117 | 1 / 1 / 0 of 1 |
| weeknight-dinner | random | official | 50 of 283 | 17.7 % | 50 to 50 | 0 | 47.3 % | 37.3 % | 10 of 23 | 23 of 44 | 87 | 6 | 240 | 1 / 1 / 0 of 1 |
| weeknight-dinner | empty | official | 0 of 283 | 0.0 % | - | - | 0.0 % | - | 0 of 0 | 0 of 44 | 0 | 0 | 0 | 1 / 1 / 0 of 1 |

Every episode was verified in the run by a fresh replay of its log (`log` and `load`). None of
these eight records carries a second wash (`replay.checks.score` is null in each, "0 of 1" in
the last column): the score itself is covered only by `bench verify <record.json> --rewash`,
which is not recorded here.

**What the table shows.**

- The harness plays the saved reference loads and the game server scores them as the
  reference table does (`docs/benchmark/levels.md` section 7): 64, 52 and 18 on the tutorial,
  178, 147 and 50 on the weeknight dinner. The whole chain an agent uses (MCP server, HTTP API,
  session, wash worker, record, replay) gives the numbers of the direct washes.
- The order careful, careless, random, empty holds on both levels at the official tier, with
  no item at the edge of clean and no provisional verdict.
- On the tutorial the careless load loses its two smoothie glasses (one mouth up, one on its
  side) and nothing else. On the weeknight dinner it loses 31 points: two smoothie glasses on
  their side, a ketchup pot mouth up, the lid laid over other pieces, a spoon another lies
  in, and a mug it no longer holds.

**What it does not show.**

- Anything about a model or a person: every line is a scripted policy. No model was run.
- That the careful policy is the best load. It leaves the oven dish, the pans and the tubs on
  the counter (it loads 66 % of the points of the weeknight dinner); a player who seats a pan
  can score more than "careful", and the normalised score N of `benchmark.md` 5.1 has no
  reference yet.
- That every kind of mistake costs. Careful is ahead of careless by 18.8 % of the tutorial's
  points and 11.0 % of the weeknight dinner's, nearly all of it from hollow pieces put in
  wrongly (`docs/benchmark/levels.md` sections 4 and 7): a plate turned to the wall costs
  nothing on either level.
- More than one seed: one episode a line. How far a score moves with the seed of the wash and
  with the unsettled parameters is `docs/benchmark/levels.md` section 9.


## 5. To run the model episodes

These episodes have not been run, so `docs/benchmark/first-runs/models` does not exist yet.
With a key in `ANTHROPIC_API_KEY`, from the root of the repository:

```sh
# 1. the tutorial, cheapest model first; read tokens and cost from the record before going on
pnpm --filter @spotless/bench bench run --levels tutorial \
  --policies anthropic:claude-haiku-5-5 --max-turns 150 --out docs/benchmark/first-runs/models
pnpm --filter @spotless/bench bench run --levels tutorial \
  --policies anthropic:claude-sonnet-5-5 --max-turns 150 --out docs/benchmark/first-runs/models
# 2. one full starter level, with a limit of turns set from the cost per turn measured in 1
pnpm --filter @spotless/bench bench run --levels weeknight-dinner \
  --policies anthropic:claude-sonnet-5-5 --max-turns 200 --out docs/benchmark/first-runs/models
pnpm --filter @spotless/bench bench run --levels weeknight-dinner \
  --policies anthropic:claude-opus-5-5 --max-turns 200 --out docs/benchmark/first-runs/models
# 3. every record: the log, the load, and the score by a second wash
pnpm --filter @spotless/bench bench verify <record.json> --rewash
pnpm --filter @spotless/bench bench table docs/benchmark/first-runs
```

Washes are at the official tier unless `--tier fast` is given. The records hold the tokens of
every turn (`agent.usage`); the results table gives tokens in and out per episode. Dollars are
not computed by the harness: multiply by the prices of the day.

## 6. A full level within a model's context (11 October, later)

The two episodes of section 0 took 1.18 and 0.76 million input tokens for twelve items, and
their largest request was 48,546 tokens. Most of it was the whole scene repeated in every
action's result and a slot list of 28,000 characters, in a conversation kept whole. The
levels the benchmark is for have 40 to 120 items. Section 6.1 measures what that would have
come to and what it comes to now; 6.2 says what was changed; 6.3 and 6.4 are the two
episodes a model has played since.

### 6.1 Measured before and after: the careful reference load's calls through the standard loop

`pnpm --filter @spotless/bench measure-episode --load <level>-careful`
(`packages/bench/scripts/measure-episode.ts`, `docs/benchmark/README.md` section 2). The calls
of the saved careful load of a level are played, one a turn, through the real MCP tools by the
standard loop with a scripted provider in place of a model: every call the careful policy
made, accepted or refused, **but for its `preview` calls** (4,909 on the weeknight dinner,
3,207 on cooked-breakfast-2, 439 on the load of 140 items: the tests of a search, which no
model makes one turn at a time), plus a look after every tenth accepted placement (by turns a
labelled plan view with its grid and the scene state). Every result and every request is
sized as the loop sends it.

Four loads: the tutorial; `weeknight-dinner` (44 items); `cooked-breakfast-2` (57 items, the
largest of the twelve levels of the game today); and `iec-13`, the standard test load of 13
place settings with its serving pieces (140 items, 118 of them placed: more than the largest
level the benchmark plans, and not a level of the game).

Tokens are estimated. The estimate is fitted to what the endpoint counted in the first three
tutorial episodes of this page (0.16 tokens a letter, 1.2 a digit, 0.34 any other character,
703 a picture of 768 pixels square: prose runs at 4.7 characters a token, the JSON of a
result at about 2.8) and holds for the two episodes it was not fitted to: within 0.3 per
cent over what the turns of the episode of section 6.4 added (`measure-episode --check`:
112,822 estimated, 112,507 counted), and within 0.1 per cent over the whole of
`sol-tutorial-4`. The figures "before" were measured with the same script before anything
was changed, and re-estimated with that fit from the transcripts kept then; their fixed part
(system prompt and tools) is the 9,021 tokens the endpoint counted for the first request of
`sol-tutorial-2`.

| | tutorial (12 items): before | after | weeknight-dinner (44 items): before | after | cooked-breakfast-2 (57 items): before | after | iec-13 (140 items): before | after |
|---|---|---|---|---|---|---|---|---|
| Calls (one a request) | 54 | 54 | 198 | 198 | 314 | 314 | 548 | 548 |
| Result of `place`, median | 3678 chars, 1305 tokens (largest 1784) | 811 chars, 283 tokens (largest 375) | 7325 chars, 2609 tokens (largest 4630) | 1056 chars, 385 tokens (largest 1185) | 12 k chars, 4208 tokens (largest 5499) | 1145 chars, 411 tokens (largest 1584) | 33 k chars, 12 k tokens (largest 15 k) | 2525 chars, 921 tokens (largest 7323) |
| Result of `remove`, median | 3403 chars, 1193 tokens (largest 1413) | 294 chars, 98 tokens (largest 100) | 4377 chars, 1590 tokens (largest 4197) | 819 chars, 283 tokens (largest 1082) | 14 k chars, 4845 tokens (largest 5025) | 1096 chars, 388 tokens (largest 1340) | 39 k chars, 14 k tokens (largest 14 k) | 2247 chars, 826 tokens (largest 6590) |
| Result of `set_rack`, median | 3795 chars, 1333 tokens (largest 1634) | 1116 chars, 406 tokens (largest 874) | 12 k chars, 4304 tokens (largest 4473) | 3433 chars, 1227 tokens (largest 2373) | 15 k chars, 5200 tokens (largest 5473) | 4718 chars, 1678 tokens (largest 2738) | 41 k chars, 14 k tokens (largest 15 k) | 6656 chars, 2408 tokens (largest 9336) |
| Result of `list_slots`, median | 11 k chars, 3493 tokens (largest 9575) | 1534 chars, 568 tokens (largest 729) | 15 k chars, 4920 tokens (largest 9860) | 1581 chars, 575 tokens (largest 729) | 15 k chars, 4905 tokens (largest 9924) | 1529 chars, 560 tokens (largest 729) | 1906 chars, 622 tokens (largest 10 k) | 671 chars, 244 tokens (largest 730) |
| Result of `get_state`, median | 2476 chars, 852 tokens (largest 1456) | 1698 chars, 623 tokens (largest 1030) | 8841 chars, 3116 tokens (largest 4174) | 5353 chars, 2206 tokens (largest 2903) | 13 k chars, 4456 tokens (largest 5072) | 7483 chars, 3111 tokens (largest 3486) | 35 k chars, 12 k tokens (largest 14 k) | 20 k chars, 8381 tokens (largest 9600) |
| Result of `get_level`, median | 21 k chars, 5919 tokens (largest 5919) | 15 k chars, 4121 tokens (largest 4121) | 52 k chars, 15 k tokens (largest 15 k) | 23 k chars, 6273 tokens (largest 6273) | 67 k chars, 20 k tokens (largest 20 k) | 33 k chars, 8943 tokens (largest 8943) | 138 k chars, 42 k tokens (largest 42 k) | 24 k chars, 6933 tokens (largest 6934) |
| All results of the episode | 300 k chars, 101 k tokens | 65 k chars, 22 k tokens | 1.86 M chars, 644 k tokens | 315 k chars, 112 k tokens | 3.43 M chars, 1.20 M tokens | 510 k chars, 184 k tokens | 13.81 M chars, 4.86 M tokens | 2.59 M chars, 956 k tokens |
| System prompt and tools, in every request | 9021 tokens | 13 k tokens | 9021 tokens | 15 k tokens | 9021 tokens | 18 k tokens | 9021 tokens | 16 k tokens |
| Largest request | 113 k tokens | 25 k tokens | 665 k tokens | 30 k tokens | 1.23 M tokens | 34 k tokens | 4.90 M tokens | 54 k tokens |
| Conversation at its largest | 104 k tokens | 12 k tokens | 656 k tokens | 15 k tokens | 1.22 M tokens | 16 k tokens | 4.89 M tokens | 38 k tokens |
| Input tokens of the episode | 3.88 M | 1.14 M | 66.11 M | 4.95 M | 174.66 M | 8.89 M | 1001.56 M | 17.72 M |
| of them read from the cache | 3.77 M | 1.09 M | 65.45 M | 4.73 M | 173.43 M | 8.51 M | 994.58 M | 16.06 M |
| Folds (forced) | - | 2 (0) | - | 15 (0) | - | 24 (0) | - | 71 (0) |
| The harness's copy of the load exact at the end | - | yes | - | yes | - | yes | - | yes |

In words, for the largest level of the game (57 items): 314 requests, of which the last
would have been 1.23 million tokens and all together 175 million; now no request is above
34,000 tokens and all together they are 8.9 million. For the load of 140 items: 548
requests; a last request of 4.9 million tokens and a thousand million in all, now 54,000 at
most and 17.7 million in all. The files are in `measurements/` (`before.json`,
`after-<load>.json` with every call and every request, `episode-cost.md` with the same in
dollars at the prices the script assumed, which its head note qualifies).

**Against the working figure** (the largest level, the careful sequence with a look every
tenth placement: no request above 100,000 tokens, the episode under 10 million):

| | Largest request | Episode | |
|---|---|---|---|
| The largest level of the game (57 items, 314 requests) | 34,000 | 8.9 million | both met |
| A load of 140 items (548 requests) | 54,000 | 17.7 million | the first met, the second not |

**What limits it now is the part of a request that never changes, times the number of
requests.** The system prompt and the tools are 13,000 to 18,000 tokens (the tools 7,600 as
estimated, 7,300 as the endpoint counted them; the rules, manual and guidance 2,000; the
level card 3,300 to 8,200), sent and read from the cache with every request: 5.5 of the 8.9
million tokens of the 57-item episode, 8.6 of the 17.7 million of the 140-item one. The
conversation itself is 8,000 to 17,000 tokens on average. An episode of 548 one-call
requests cannot come under 10 million while a request cannot come under 18,000. What would
move it: a model that makes several calls a turn (the loop runs them in order;
`gpt-6.1-sol` made 231 calls in 174 turns in section 6.4); shorter
tool descriptions (they are 21,000 characters, and each paragraph of them answers a mistake
some player made); the level card's items as a table. None of these was done here.

**With the policy's own previews** the sequences are 72, 5,101, 3,509 and 964 calls. Not
measured: at some 25,000 tokens a request the weeknight dinner's would be about 130 million
tokens. That is the loader's search, not the interface's cost; a model that previews as
freely would pay for it in turns.

### 6.2 What was changed

| What | Before | Now |
|---|---|---|
| The result of an action (`place`, `remove`, `reset`, `set_rack`, `start_cycle`) | The whole scene every time: every placed item with pose and contacts (12,000 characters a placement on a load of 46 items; 33,000 on one of 118) | What the action changed, completely (`changes`: the whole new entry of every item that is new or different, what went back to the counter, the baskets and options that changed), the load in a few numbers (`load`), the budgets. 1,100 characters a placement on a load of 46 items. A client that applies every result to its own copy has what `get_state` returns: tested after every call of an episode, and checked at the end of each of the four measured loads |
| `get_state` | The whole scene, an object an item | The whole scene or a part (`rack`, `items`), a table with a row an item; one query either way |
| `get_level` | Every item with its full record: 67,000 characters for 57 items, 138,000 for 140 | Every named orientation, every kind of piece and every item said once (pieces of one kind with the same soil and points share an entry): 33,000 and 24,000 characters. In the standard harness the card stands in the system prompt (it is a free resource) and a model need not ask for it |
| `list_slots` with an item | Every slot of the basket with its geometry and a suggested drop: 28,000 characters for the lower basket, each place of a pair of rows listed twice | The suggested places for the item as one ranked list: free and seating first, then free above the tine tips, then taken; 12 unless `limit` says otherwise (at most 30), with the counts of all; the rest by `offset` or `row`, free while the scene is unchanged. 1,500 characters. The page's "Suggest spots" list is the same list in the same order (one function, `slotAdvice` of `@spotless/server`) |
| Numbers | As the game computes them in places (13 decimals in a report) | Positions to 0.1 mm and quaternions to four decimals, as the page shows them; nothing else finer than four decimals |
| The conversation (standard harness) | Kept whole; the 4 most recent pictures | Policy `standard-2`: the oldest turns that an accepted action has since followed are folded, in batches, into a note with the scene as it stood (kept by the harness from the results alone), the slot advice asked last and the sheet of items; the 4 most recent pictures. Stated in full in `docs/benchmark/README.md` section 2; its version is in every record |
| Turn limit (standard harness) | 400 | The level's action budget, at least 400 (`max(400, 8 x items)`) |
| The cost script | 3.2 characters a token; Anthropic's models only | The fitted estimate; both deployments of the endpoint priced when prices are given (`--price`, or variables with the deployment's name) |

What this does to the comparison with a person, who sees the whole load for nothing, is in
`docs/benchmark/README.md` section 7: a change is free and complete, the standard harness
keeps track for every model and gives the scene again whenever it folds, and looking again
costs what it cost before.

### 6.3 The tutorial again: `sol-tutorial-3/` and `sol-tutorial-4/`

```sh
pnpm --filter @spotless/bench bench run --levels tutorial --policies openai:gpt-6.1-sol \
  --tier fast --max-input-tokens 2000000 --out <dir>
```

The same command as in section 0, after the changes. Fast tier: **a preview, not a benchmark
result.** Washed with `spotless-sim 0.5.0 water-6`, parameters `anchored-v6.owner-capsule`,
wash code `302cf1ea`.

| | `sol-tutorial-1/` | `sol-tutorial-2/` | `sol-tutorial-3/` (episode `241c0185`) | `sol-tutorial-4/` (episode `9339ed65`) |
|---|---|---|---|---|
| Score (fast tier, preview) | 64 of 64 | 64 of 64 | 64 of 64, 12 of 12 items loaded and clean | 64 of 64, 12 of 12 |
| Model turns | 34 | 24 | 22 | 25 |
| Tool calls | 34 | 24 | 28: 13 `place`, 5 `list_slots`, 3 `render`, 3 `set_rack`, `get_state`, `remove`, `check_load`, `start_cycle` | 30: 12 `place`, 5 `list_slots`, 5 `preview`, 3 `render`, 2 `set_rack`, `get_state`, `check_load`, `start_cycle` |
| Refused calls | 7 | 1 | 0 | 0 |
| Input tokens, all requests | 1,182,274 | 756,379 | 406,565: 382,852 read from the cache, 23,647 written to it, 66 neither | 483,069: 459,484 read, 23,510 written, 75 neither |
| Largest request | 48,546 | 45,213 | 23,650 (the first: 12,784) | 23,513 (the first: 12,822) |
| Output tokens | 1,959 (631 reasoning) | 1,031 (157) | 1,685 (609) | 1,933 (664) |
| Folds of the conversation | - | - | none: it never grew past the room for recent turns | none |
| Wall time | 219 s | 176 s | loading 99 s, wash 51 s, 158 s in all | loading 136 s, wash 66 s |
| Verified | log, load, score | log, load, score | by replay in the run (log, load); again with `bench verify --rewash`: log, load and score (same verdicts and points, another result hash under the same wash code) | the same |

`sol-tutorial-3` was run as soon as the changes stood, `sol-tutorial-4` at the end of the
work, after the episode of section 6.4 and the changes that followed it (a description, the
transcript, the room for recent turns growing with a large note). One thing was added after
it: the bound on a single turn (`docs/benchmark/README.md` section 2), which no turn of
these episodes comes near. Its transcript says what the system prompt and the
tools were made of, so the estimate can be held against the whole episode, first request
included: 23,493 tokens estimated, 23,513 counted.

Nothing broke. The model made several calls in a turn where it could (a look, slot advice and
the scene in its first; two slot lists at once), did not ask for the level card (it is in the
prompt), and copied positions and orientations out of the slot table without a slip. What
each turn added to the request was counted by the endpoint as 10,866 tokens and estimated as
10,752. It asked slot advice for a plate, a deep plate, a fork, a knife and a spoon: 5,605
characters in all, where the one answer for a plate was 28,050 before.

Passed over again, as in section 0: `fork_02` and `knife_01` each turned by 90 degrees as
they settled in their cells of the cutlery basket (`rotation_deg` 91.3 and 90), and the
model went on. Whether that is a fork fallen over or one turned about its own length the
number does not say, and nothing was changed for it.

### 6.4 A level of 44 items: `sol-weeknight-1/`

```sh
pnpm --filter @spotless/bench bench run --levels weeknight-dinner --policies openai:gpt-6.1-sol \
  --tier fast --max-input-tokens 12000000 --out <dir>
```

The first episode of a model on a full level, played through to the wash. Fast tier: **a
preview, not a benchmark result**; one episode of a model whose play varies from run to run.

| | `sol-weeknight-1/` (episode `ac306b21`) |
|---|---|
| Score (fast tier, preview) | 195 of 283 points; 40 of 44 items loaded, 35 of them clean |
| Model turns | 174 of 400 allowed |
| Tool calls | 231: 78 `preview`, 62 `place`, 28 `render`, 23 `set_rack`, 17 `list_slots`, 11 `remove`, 9 `check_load`, `get_state`, `get_item`, `start_cycle` |
| Refused calls | 11, all `place` with `collision_at_pose` |
| Budget used | 85 actions of 400, 56 queries of 660 |
| Pictures sent to the model | 32 (28 views of 768 px, the four of one `get_item`) |
| Input tokens, all requests | 4,454,116: 4,239,179 read from the cache (95 %), 214,415 written to it, 522 neither |
| Largest request | 31,791 tokens; the first 15,062; the mean 25,598 |
| Output tokens | 23,974, of them 14,221 reasoning |
| Folds of the conversation | 13, none forced, 229 of the 231 calls folded by the end; pictures never had to be pruned (the folds took old ones with their turns) |
| Requests, retries, cut-off turns | 174, 0, 0 |
| Wall time | loading 23 min 00 s, wash 55 s, 1,475 s in all |
| Cost | not recorded: no prices were supplied |
| Verified | by replay in the run (log, load); again with `bench verify --rewash`: log, load and score (same verdicts and points, another result hash under the same wash code) |

The measurement of section 6.1 for this level, made before the episode: 198 requests, a
largest request of 30,000 tokens, a mean of 25,000, 4.95 million in all.

**How it played.** Two plan views, the scene and slot advice for a dinner plate in its first
turn. Three dinner plates at suggested places; the frying pan tried on edge (it fell over by
65 degrees and came to lie on the tines: taken out again) and then mouth down; a plate taken
out to make room for the saucepan and put back in another place. Fourteen pieces of cutlery,
one kind to a column of cells. The upper basket: two rows of tines folded flat, bowls, tall
glasses and mugs mouth down and tilted, four side plates between the rows, then a long
search for room for a tumbler and a ketchup pot among them. It moved the baskets in and out 20
times (the upper one pulled out hangs over the lower), looked 28 times, ran the mechanical
check 9 times, and left the oven dish, both tubs and one dinner plate on the counter. It
asked for the scene once, in its first turn: after that the changes of each result and, 13
times, the note of a fold were what it had, and its play does not show a turn where it had
lost the load (no placement of an item already placed, no removal of one on the counter). It
wrote no words between its calls.

**Where it went wrong for reasons of the interface, and what was done.**

1. *Slot advice for a piece that gets none.* `list_slots` for the chopping board answered
   with no place at all (`places_total: 0`): the board has the presets `on_long_edge` and
   `on_short_edge`, and the game suggests drops only for `on_edge` and `handle_down`. The
   description of `list_slots` said a board is among the pieces that get places. The model
   spent six previews and two placements on guesses and left the board standing on its long
   edge on the open floor of the basket, reported not stable to the end. **Changed:** the
   description now says which pieces are offered no place and what to do then. Asked of the
   session: suggest drops for a board. A person pressing "Suggest spots" is told the same
   nothing.
2. *A list of taken places, five times.* Looking for room for the fourth dinner plate it
   asked slot advice for it five times as the basket filled, and the last four answers
   (`limit: 30`) were thirty rows of places that were not free. The counts above the rows say
   so in a line. Not changed; a first answer that stopped at the last free place would be
   shorter.
3. *A basket move names every item in it.* Each of the 20 basket moves shifted nearly every
   item of the basket by a fraction of a millimetre, and the result names each with its new
   entry (14 to 22 items, some 4,300 characters): the longest results of the episode, 87,000
   characters of its 225,000. That is the price of a change being complete at
   the precision of the page. Not changed.
4. *Refusals among neighbours.* Seven of the eleven refusals were poses for the tumbler and
   the ketchup pot overlapping side plates by 2 to 9 mm; each named the plate. Three more
   were single misses. One named `upper_rack_fittings`, and the model asked 35 mm higher and
   upright, and was accepted: the paragraph added to `place` after section 0 did its work here.
   These are matters of fitting things in, not of the interface.
5. *Feedback passed over.* Pulling the lower basket out late in the episode turned
   `knife_04` by 88 degrees (`turned_deg` in the result). The model looked at the basket and
   ran the check, and left the knife. As in section 6.3, nothing was changed.

### 6.5 What the model episodes have used

Input tokens of the three episodes of this section together: 5,343,750 (406,565 + 4,454,116
+ 483,069). `gpt-6-astra` was not run.


## 7. After the review (11 October, afternoon)

An independent reviewer ran the work of section 6 and found one defect on an edge path, one
provider path nobody has exercised, and smaller things. What was done about each is here;
`docs/benchmark/README.md` sections 2, 7 and 10 say what is now true.

### 7.1 What was found and what was done

1. **A part of the scene asked first left the harness without the scene** (the blocker).
   The MCP server counted any `get_state`, also one of a basket or of named items, as having
   given its client the scene. The first action then answered with changes only, the
   harness's copy never became whole, and the first fold replaced the model's placements
   with a note saying that no action had been accepted. Reproduced before anything was
   changed, with two tests that failed: on the MCP server (`results.test.ts`: the first
   action after two partial looks had `changes` and no `state`) and through the whole loop
   with a scripted model (`harness.test.ts`: `get_state {rack}`, a placement, then looks and
   basket moves until a fold). Corrected at the cause: only a `get_state` of the whole
   scene, or an action, makes a client one that has the scene, so an action after partial
   looks carries it whole. And in the harness: a note can no longer say that nothing was
   placed when something was; while its copy has no whole scene, turns with accepted actions
   are not folded for size, and a fold that is forced then says that it has no scene to give
   (`context.test.ts`).
2. **The Anthropic path has not met the real API.** Not run here either: this work called
   one deployment of the OpenAI-compatible endpoint only. What a fold does there
   is documented by the API: a reasoning block is bound to everything sent before it, so the
   reasoning of every kept turn is dropped at each fold, where the Responses API keeps it.
   Stated in section 2 (point 8) of the main README, with the run that has to come before
   any comparison; the transcript now says per turn how many reasoning blocks the provider
   dropped. Whether to drop carried reasoning at a fold for every provider is an open
   question (section 10 there).
3. **The sentence in the description of `place`** said the first action of an episode
   carries the whole scene. It now says what the server does: an action carries it only when
   the client has not yet been given the whole scene.
4. **The manual's paragraph on `list_slots`** (in `packages/levels`, not changed here) still
   describes every slot. The system prompt (version 3) and the MCP server's instructions now
   say that a tool's description holds where the manual differs.
5. **Records could not be told apart by their harness.** The harness is
   `spotless-bench/0.2.0`; a record names the MCP server's version and a digest of its tool
   list (`versions.interface`); the results table has a column "Run with" and never puts
   episodes of different harness versions, tool lists, prompt versions or context policies on
   one line (`results.test.ts`).
6. **"Keeps the 4 most recent pictures"** overstated what a model keeps. The main README
   now says that a picture stays only while its turn is among the recent turns, and that 4
   to 8 is an upper bound. The behaviour is unchanged.
7. **Small things the agent no longer gets** are listed in section 7 of the main README. The
   MCP server now keeps one slot list, the one asked last, as the page does; it kept every
   list of the unchanged scene.
8. **The "before" column** cannot be measured again in this checkout (it was measured on the
   code before the change). It stays labelled as it was.

### 7.2 The measurements again, on the code as it is

`pnpm --filter @spotless/bench measure-episode --load <level>-careful --label final --json
measurements/final-<level>.json`, the same sequences as section 6.1. "Before" is the column
of section 6.1; "after" is the code as it is now.

| | tutorial (12 items) | weeknight-dinner (44) | cooked-breakfast-2 (57, the largest level today) | iec-13 (140, larger than any planned level) |
|---|---|---|---|---|
| Calls (one a request) | 54 | 198 | 314 | 548 |
| Result of `place`, median tokens | 1,305 → 283 | 2,609 → 385 | 4,208 → 411 | 11,745 → 921 |
| Result of `remove` | 1,193 → 98 | 1,590 → 283 | 4,845 → 388 | 13,803 → 826 |
| Result of `set_rack` | 1,333 → 406 | 4,304 → 1,227 | 5,200 → 1,678 | 14,286 → 2,408 |
| Result of `list_slots` (largest) | 3,493 (9,575) → 568 (729) | 4,920 (9,860) → 575 (729) | 4,905 (9,924) → 560 (729) | 622 (10,430) → 244 (730) |
| Result of `get_state` | 852 → 623 | 3,116 → 2,206 | 4,456 → 3,111 | 12,397 → 8,381 |
| Result of `get_level` | 5,919 → 4,121 | 15,204 → 6,273 | 19,663 → 8,943 | 41,952 → 6,933 |
| All results of the episode | 101 k → 22 k | 644 k → 112 k | 1.20 M → 184 k | 4.86 M → 956 k |
| System prompt and tools, in every request | 9,021 → 12,963 | 9,021 → 15,101 | 9,021 → 17,779 | 9,021 → 15,767 |
| Largest request | 113,280 → 25,152 | 665,105 → 30,596 | 1,228,447 → 33,960 | 4,897,720 → 54,020 |
| Conversation at its largest | 104 k → 12,189 | 656 k → 15,495 | 1.22 M → 16,181 | 4.89 M → 38,254 |
| Input tokens of the episode | 3,883,798 → 1,150,522 | 66,110,130 → 4,979,468 | 174,655,913 → 8,932,171 | 1,001,559,569 → 17,801,088 |
| of them read from the cache | 1,102,626 | 4,754,994 | 8,558,601 | 16,139,856 |
| Folds (forced) | 2 (0) | 15 (0) | 24 (0) | 71 (0) |
| Times the picture rule fired | 0 | 0 | 0 | 0 |
| The harness's copy of the load exact at the end | yes | yes | yes | yes |

Against section 6.1 nothing about a result or a fold has moved: the results are the same
characters to the last one (65,048, 315,008, 510,427 and 2,587,340), the folds fall at the
same calls, and the conversation is as large. What moved is the fixed part of a request, by
147 tokens (the corrected sentence of `place`, the sentence on the slot list kept, the
sentence on the manual in the system prompt and in the server's instructions), which over
the requests of an episode is 8,000 to 81,000 tokens: 0.5 to 0.7 per cent. The corrections
of 7.1 act on paths these sequences do not take (they ask for the whole scene, or act,
before any part of it; they never go back to an older slot list).

The files: `measurements/final-<load>.json`, and `measurements/episode-cost.md` and `.json`
priced again from them.

### 7.3 The tutorial once more: `sol-tutorial-5/`

```sh
pnpm --filter @spotless/bench bench run --levels tutorial --policies openai:gpt-6.1-sol \
  --tier fast --max-input-tokens 2000000 --out .spotless/bench/sol-close-1
pnpm --filter @spotless/bench bench verify <dir>/record.json --rewash
```

`gpt-6.1-sol`, the Responses API, effort at the model's default (reported `medium`), **fast
tier: a preview, not a benchmark result**; `spotless-sim 0.5.0 water-6`, parameters
`anchored-v6.owner-capsule`, wash code `302cf1ea`.

| | `sol-tutorial-5/` (`3e300b49`) |
|---|---|
| Run with | harness 0.2.0, MCP server 0.2.0 (tools `e264ec6a`), prompt 3, context `standard-2` |
| Score (preview) | 64 of 64; 12 of 12 loaded and clean |
| Turns / tool calls | 31 / 31 |
| Calls | 13 `place`, 5 `list_slots`, 3 `render`, 3 `set_rack`, 3 `preview`, and one each of `get_state`, `remove`, `check_load`, `start_cycle` |
| Refused calls | 0 |
| Budget used | 17 actions, 10 queries |
| Pictures | 3 |
| Input tokens | 607,102: 576,335 read from the cache, 30,674 written, 93 neither |
| Output tokens | 1,569, of them 364 reasoning |
| Largest request | 24,262 (the first: 12,939) |
| Folds | 1, at call 29: 15 calls taken out, about 12,039 to 6,153 tokens of conversation; not forced |
| Wall time | loading 135 s, wash 48 s, 190 s in all |
| Verified | by replay in the run (log, load); again with `bench verify --rewash`: log, load and score (same verdicts and points; the result hash of the second wash differs) |
| Estimate against the endpoint's count | what the turns added: 24,462 counted, 24,396 estimated (0.997) |

It looked at the plan view, asked for the whole scene, and placed; so its first action
answered with changes, as before. It made one call a turn this time. The corrected path (a
part of the scene asked first) was not taken by the model; the tests of 7.1 take it.

### 7.4 What the model episodes have used

Since the results were shaped: 406,565 + 4,454,116 + 483,069 (section 6), 580,064 (the
reviewer's tutorial episode, kept with the review and not here) and 607,102 (7.3):
**6,530,916 input tokens**. `gpt-6-astra` has not been called.
