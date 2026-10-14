# The course's first measurements with models: 11 October 2026, evening

Six episodes of two models and the four reference policies on three levels of the course
(`docs/benchmark/levels.md`): the tutorial (level 1, difficulty 2.3), `breakfast` (level 4,
the middle, 6.3) and `dinner-party` (level 7, the hardest, 7.2). Benchmark mode, the standard
harness (`docs/benchmark/README.md` section 2), **official tier, Eco 50**, the default
parameter set: `spotless-sim 0.5.0 water-7`, `anchored-v7.owner-capsule`, wash code
`ee5fd167`. Every model episode ended in a wash the model started itself and was verified
three ways: the log replayed, the load checked against it, and the replayed load washed a
second time (`verify-rewash.json` beside each record; same verdicts and points every time).

**One episode a cell is an anecdote, not a measurement.** Nothing below is a ranking of the
two models, and section 4 says what the table cannot show.

`gpt-6.1-sol` and `gpt-6-astra` are the names of the two deployments on the Azure endpoint
used. The records hold the deployment name and the
reasoning effort the API reported (`medium` for both); no model version or snapshot date was
recorded.

**Since these episodes were played the wash has changed once** (late on 11 October, source
`f58d4ed8ab930946`): what the wash water held is now left as residue where water stands on an
item at the end, so a glass or mug left standing full is not clean whatever it carried.

- The six model episodes were washed again on that code from their own loads: the same points
  (64, 190, 188, 260, 175, 274) and every verdict the same. No model had stood a vessel mouth
  up.
- The reference policies' records under `reference/` and the reference columns of the tables
  below are of the wash as it was when the models played (wash code `ee5fd167`). On the code as
  it is, the saved reference loads score: tutorial 0 / 20 / 58 / 64 (unchanged), breakfast
  0 / 36 / 112 / 174 (random was 43, careless 117), dinner-party 0 / 88 / 100 / 250 (random
  was 99); `docs/benchmark/course-table.md` is the current table. The careful scores, which the
  models are compared with, did not move.
- The list of tools has changed again since (`check_load` now reports which wall pushed a piece
  and over which side a piece leans out).

## 1. The table

`results.md` and `results.json` are the harness's own table (`bench table`); `episodes.md`
and `episodes.json` are one line an episode with what it cost (`episode-table`, new).

Points, with the share of the level's points:

| # | Level | Difficulty | Points | Empty | Random | Careless | Careful | gpt-6.1-sol | gpt-6-astra |
|---|---|---|---|---|---|---|---|---|---|
| 1 | tutorial (12 pieces) | 2.3 | 64 | 0 | 20 (31.3 %) | 58 (90.6 %) | 64 (100 %) | **64 (100 %)** | not run |
| 4 | breakfast (37) | 6.3 | 220 | 0 | 43 (19.5 %) | 117 (53.2 %) | 174 (79.1 %) | **190 (86.4 %)**; again after the corrections of section 3: 188 (85.5 %) | **175 (79.5 %)** |
| 7 | dinner-party (62) | 7.2 | 367 | 0 | 99 (27.0 %) | 100 (27.2 %) | 250 (68.1 %) | **260 (70.8 %)** | **274 (74.7 %)** |

What was put in and what came out clean:

| Level | Player | Loaded of offered | Clean of loaded | Points loaded | Points left on the counter | Points loaded and not clean |
|---|---|---|---|---|---|---|
| tutorial | careful | 12 of 12 | 12 of 12 | 64 | 0 | 0 |
| tutorial | gpt-6.1-sol | 12 of 12 | 12 of 12 | 64 | 0 | 0 |
| breakfast | careful | 34 of 37 | 34 of 34 | 174 | 46 (all three pans) | 0 |
| breakfast | gpt-6.1-sol | 35 of 37 | 35 of 35 | 190 | 30 (frying pan, porridge pan) | 0 |
| breakfast | gpt-6.1-sol, again | 36 of 37 | 34 of 36 | 202 | 18 (frying pan) | 14 (porridge pan 12, a spoon 2) |
| breakfast | gpt-6-astra | 36 of 37 | 32 of 36 | 208 | 12 (porridge pan) | 33 (frying pan 18, a glass 8, a mug 5, a fork 2) |
| dinner-party | careful | 49 of 62 | 46 of 49 | 263 | 104 | 13 |
| dinner-party | gpt-6.1-sol | 51 of 62 | 50 of 51 | 269 | 98 (eleven big pieces) | 9 (a glass) |
| dinner-party | gpt-6-astra | 53 of 62 | 50 of 53 | 298 | 69 (nine pieces) | 24 (a board 8, two glasses 16) |

The reference policies played their saved loads through the harness and score exactly what
the stored table of the levels says (`packages/bench/reference/reference-official.json`:
0 / 20 / 58 / 64, 0 / 43 / 117 / 174, 0 / 99 / 100 / 250), which was washed separately
when the levels were made: that is their second wash. Their logs were verified against the
policy's own session, as the harness does for a scripted policy.

What the model episodes took:

| Level | Model | Turns | Tool calls | Refused | Folds (forced) | Pictures | Input: fresh | read from cache | written to cache | Input in all | Output | of it reasoning | Largest request | Loading | Wash |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| tutorial | gpt-6.1-sol | 32 | 32 | 0 | 1 (0) | 3 | 96 | 615,120 | 31,606 | 646,822 | 2,040 | 745 | 24,853 | 2 min 55 s | 7 min 55 s |
| breakfast | gpt-6.1-sol | 105 | 114 | 5 | 6 (0) | 22 | 315 | 2,380,134 | 122,160 | 2,502,609 | 12,765 | 8,004 | 28,732 | 13 min 20 s | 6 min 07 s |
| breakfast | gpt-6.1-sol, again | 119 | 124 | 3 | 6 (0) | 16 | 357 | 2,730,151 | 102,395 | 2,832,903 | 13,278 | 7,871 | 28,797 | 14 min 47 s | 4 min 49 s |
| breakfast | gpt-6-astra | 115 | 115 | 17 | 4 (0) | 11 | 345 | 2,672,275 | 83,676 | 2,756,296 | 8,902 | 3,969 | 30,697 | 12 min 06 s | 5 min 45 s |
| dinner-party | gpt-6.1-sol | 114 | 114 | 14 | 7 (0) | 7 | 342 | 2,880,194 | 140,160 | 3,020,696 | 11,440 | 6,233 | 33,612 | 14 min 00 s | 6 min 10 s |
| dinner-party | gpt-6-astra | 122 | 122 | 7 | 8 (0) | 16 | 366 | 3,084,136 | 135,030 | 3,219,532 | 9,497 | 4,107 | 32,487 | 12 min 29 s | 5 min 21 s |

All six together: **14,978,858 input tokens**,
of them 5,975,828 on `gpt-6-astra` in its two episodes, with 18,399 output tokens there.
No episode came near its `--max-input-tokens` (2, 12 and 20 million), none was ended by a
limit of the harness, no fold was forced, no request was retried and no turn was cut off.
Reasoning effort was each model's default (not sent; both reported `medium`). No cost is
recorded: no prices have been given for the two deployments.

Against what was expected beforehand: the tutorial 0.4 to 0.6
million (0.65); a level of 38 to 52 pieces 4.5 to 6.5 million for `gpt-6.1-sol` (2.5 and
2.8) and 4.5 to 13 million for `gpt-6-astra` (2.8); the largest level 6 to 9 million and 6
to 18 million (3.0 and 3.2). Both models took about three turns a piece on the breakfast
and two on the dinner party, half of what the estimate assumed from the one earlier episode
on a full level, and `gpt-6-astra` wrote 70 to 80 output tokens a turn, not the 400 to
1,500 assumed. The limits by level size can stay as they are.

## 2. How each model played

Both played the same way in outline: a plan view of the lower basket with grid and labels,
the whole scene once, slot advice for one piece of each kind, plates into the suggested
drops of the rear rows of the lower basket facing the middle, cutlery into the cells, the
lower basket pushed in, the upper pulled out, the knife shelf folded up to free the left
side rest, glasses mouth down on the two side rests at the poses `list_slots` gave, bowls
on edge in rows A and B of the upper basket, a mechanical check, the cycle. Neither wrote a
word between calls until one sentence before `start_cycle`. Both used the side rests the
corrected upper basket offers; neither stood a single hollow piece mouth up or laid one on
its side. That is the mistake the levels were designed around (31 to 40 % of each level's
points sit in hollow pieces that punish it), and no model made it once in six episodes.

**gpt-6.1-sol, tutorial (`sol-tutorial/`): 64 of 64.** 32 calls, none refused. Plates and
the deep plate at suggested drops, five pieces of cutlery one to a cell, the bowl mouth
down and tilted on the floor of the upper basket after folding row C, two glasses on the
right rest, the mug on the left rest after folding the knife shelf up (it previewed its own
pose along the rest first). Three pictures: a three-quarter view of the lower basket before
loading it, a plan of the upper basket before loading that, and a three-quarter view with
both baskets in before the check.

**gpt-6.1-sol, breakfast (`sol-breakfast/`): 190 of 220, 16 more than the careful
reference load.** Everything it loaded came out clean (35 of 35). It left the frying pan
and the porridge pan on the counter and said why in its one sentence: "rather than crowding
the dishes and blocking the spray". The 16 points over the reference are the bacon pan,
which the scripted careful hand never places: the model laid it face down and tilted over
the front left of the lower basket, its handle over the cutlery basket. It had first taken
the cutlery basket out of the machine to stand the frying pan there, found that the basket
could not come back while the pan stood (`blocked`, `blocked_by: frying_pan_01`), and took
the pan out again. 14 renders, mostly plan views with grid, each followed by placements at
coordinates the picture shows free;
two sets of `get_item` pictures (the two pans). Five refusals, each answered in one call.

**gpt-6.1-sol, breakfast again (`sol-breakfast-2/`): 188 of 220.** Run after the
corrections of section 3, to see that they broke nothing; it is on a line of its own in the
table because the tool descriptions differ. A different load from the first: rows R1 and R2
folded at the start and stood up again, four plates in the upper basket, the bacon pan and
the porridge pan both in (the porridge pan mouth down on top of the cutlery basket's
handle, 87 mm up: not clean, 12 points), 29 previews. Two points apart from the first
episode by a different road: the same model on the same level loads differently from one
run to the next.

**gpt-6-astra, breakfast (`astra-breakfast/`): 175 of 220.** It loaded 36 of 37 pieces
(208 points) and 32 of them came clean. It began with the
two pans, both on edge in the middle of the lower basket: the bacon pan came clean (16), the
frying pan did not (18: cooked egg left on the base, the pan leaning on the cutlery
basket's lid). With the upper basket's rests full it set the basket to height 2, folded the
knife shelf down again and stood the last glass and a bowl mouth down on top of the knife
shelf (the glass not clean, 8), and lowered the rear cup shelf and stood two mugs on it,
reading the shelf's place from the geometry list (one of the two not clean, 5). A fork kept
4.2 mm2 of dried egg where 4 is allowed (2). 17 refused calls: seven in the cutlery basket,
where it looked for a second and third place in a cell without asking for one, the rest
poses a few millimetres into a neighbour, a tine row or a shelf, or blocked from above.

**gpt-6.1-sol, dinner party (`sol-dinner-party/`): 260 of 367, 10 more than the careful
reference load.** It loaded the 51 pieces that have a made place (plates, the cheese
platter, a lid, all the cutlery, glasses, pots, the tongs) and left all eleven big pieces
on the counter, 98 points: both boards, the platter, the salad bowl, both pans, the gratin
dish, the roasting tin, the jug, the ladle and the glass lid. It tried: twelve previews
for the gravy jug (seven), the gravy pan, the salad bowl, the platter and the cheese board,
none of them free, and one refused placement of the jug, and it gave up without placing
one. 50 of 51 clean; the one glass not clean stands at the rear of the left rest (5.6 mm2,
4 specks). Eleven of its fourteen refusals are in the cutlery basket, ten of them knives:
it asked for the cells for a fork at the start and for a serving spoon at the end, and
found the place of every other piece of twenty by trying.

**gpt-6-astra, dinner party (`astra-dinner-party/`): 274 of 367, 24 more than the careful
reference load.** The same base load, and four big pieces more: the gravy pan mouth down
over the right of the lower basket (clean, 12), the platter on edge across the middle of
the upper basket at height 2 (clean, 10), the cheese board along the right wall of the
lower basket (clean, 6) and the chopping board on its long edge along the left wall
(`stable: false`; not clean, 8, at the edge of clean: lard left on its top). It left nine
pieces out (69 points). Two glasses at the rear of the two rests are not clean (16). It
asked for the cells of the cutlery basket five times as the basket filled and had five
refusals there. Twelve renders, among them a ghost of the pan's pose before placing it and
both elevations.

**Did they use the pictures.** Yes, as far as play can show it: every model asked for plan
views with grid and labels before loading a basket and again after filling one, and the
hand-chosen poses that followed (bowls and glasses on the open floor, pans, boards) are at
coordinates the picture shows free. Where a picture was wrong it cost the model calls
(section 3, the first item), which is the same evidence from the other side.

## 3. Where the interface, not the dishwasher, got in the way, and what was changed

Found in the transcripts of the five episodes of the first table; the sixth
(`sol-breakfast-2`) was run with the changes. A changed tool description changes the digest
of the tool list (`7bf26d30` for the five, `7f3a9b8d` after), and the table keeps the two
apart.

| # | What happened | Whose episode | What was changed |
|---|---|---|---|
| 1 | **The plan view of the lower basket drew the whole load of the upper basket over it.** With the upper basket set to height 2 or 3 its floor (395 or 370 mm) is lower than the top of the lower basket's envelope (413 mm); the test for "another basket hangs over this one" asked whether the floor was at or above the envelope, said no, and the cut was not made. The model was twice shown `top_lower` with twelve glasses, four pots and a platter of the upper basket drawn and labelled over the plates (`astra-dinner-party/images/0106-render.png`, `0116-render.png`), pushed the upper basket in to get a clear look (an action) and asked the picture again (a query). In the breakfast the labels of upper-basket pieces stand along the lower edge of its lower plan view | gpt-6-astra, both | `packages/render/src/views.ts`: a basket whose floor is above the floor of the one looked at and overlaps it in plan is cut away, at the top of the envelope as before or just under the upper basket when that reaches into it; the plan view of the upper basket no longer shows the lower one through its wires at heights 2 and 3. The page draws its plan views from the same function. Test in `views.test.ts` (heights 1, 2, 3; in and out); checked on a rendered picture |
| 2 | **`list_slots` said cups and glasses have no places.** The description still read "Cups and glasses have no places of their own on this machine" and listed no `cup_rest` among the slot kinds, while the tool has offered the two side rests since the upper basket was corrected. Both models asked for a glass anyway and used what came back, so nobody was misled; a model that believed the sentence would not have asked | carried over from the upper-basket work | `packages/mcp/src/descriptions.ts` and `schemas.ts`: the rests (`rest_left`, `rest_right`, one place a rest, the rearmost seat free now, ask again for the next), the seat on a cup shelf that is folded down, that a full rest is not listed and a rest under a lowered shelf is listed as not free, `cup_rest` among the kinds. Test: a mug on the tutorial is offered both rests, a lowered shelf adds a seat, and every kind the game answers with is named in the description |
| 3 | **A refusal names the part; the description said it does not.** `colliding_with` now reads `upper_rack.floor.y`, `lower_rack.wall`, `upper_rack_fittings.holder.knife_shelf.floor`, `tub.roof`; the description still explained `upper_rack` and `<basket>_fittings` and said "the name does not say which shelf, so look" | all | The paragraph "After collision_at_pose" rewritten to the names as they are, `tub.roof` among them. Test against the game: three poses and the names they are refused with |
| 4 | **"A rotation of 45 degrees or more means it tipped over" is not true of cutlery.** A fork let down at the place `list_slots` gives for the rear right cell reads `rotation_deg` 91 and stands in its cell leaning 14 degrees: it turned about its own length. Cutlery read 81 to 98 in five of the six episodes (forks, knives, a spoon; the fork is the one checked) and every model passed over it, rightly as it turned out; the note of this morning's first episodes that a fork "fell over in its cell" (`../README.md` section 0, item 3) was most likely this | all | Descriptions of `place` and `set_rack`: the number is the angle of the whole turn about any axis, most often a tip, and a piece of cutlery in a cell may only have spun; `resting`, `touches` and a picture say which. Test: that fork reads more than 45 and its length stays within 30 degrees of where it was let go |
| 5 | **Second and third pieces in a cell of the cutlery basket were found by trying.** Twenty pieces go into eight cells. The advice gives, for the piece in hand, a pose beside what a cell already holds, but nothing said so, and a model that asked once guessed the rest: 11 of gpt-6.1-sol's 14 refusals at the dinner party and 7 of gpt-6-astra's 17 at the breakfast are a knife or a spoon in the cutlery basket, mostly 1 to 4 mm into a neighbour, the divider, a foot or the handle of the basket | both | Description of `list_slots`: a cell takes several pieces, the place offered in a cell that holds some is free now, ask again rather than guess. Test: the same pose twice is refused, the list then gives another in the same cell and it is accepted |

Also corrected: `packages/mcp/src/results.test.ts` "get_state gives a part of the state"
cut the tutorial's careful load at 40 events and expected the second glass on the counter;
the regenerated load places it at event 34. The cut is now at 34.

Not changed, and whose it is:

- **A result does not say how far an item leans.** `rotation_deg` cannot tell a tip from a
  spin (item 4); a `tilt_deg` from the vertical in the result of `place` and in
  `changes.items` would. The session's.
- **`list_slots` for a cup with every rest full answers `places_total: 0`** with the note
  that the piece has no suggested place in this basket, which reads as "never" where it
  means "none left". The MCP server cannot tell the two apart from what the session
  returns. gpt-6-astra met it at the breakfast and went to the geometry list instead.
- **`set_rack` on the upper basket lists pieces of the lower basket among its changes**
  (plates that moved by a fraction of a millimetre). Nobody was misled; it costs tokens.

## 4. What the table shows and does not show

**It does not rank the two models.** One episode a cell: the two models are 15 and 14
points apart in opposite directions on the two levels, and each difference is two or three
pieces. The one repeat there is (the breakfast, 190 and 188) reached nearly
the same score with a different load, a pan more and two pieces not clean: the spread of a
model's own play on a level is not known from two runs, and the differences between the
models are of that size. A measurement needs several episodes a cell, as
`docs/research/benchmark.md` section 4 lays down.

**Does the order of the course show in the scores.** In the share of the points, yes, for
every player that loads sensibly: careful 100, 79, 68 %; `gpt-6.1-sol` 100, 86, 71 %;
`gpt-6-astra` 80, 75 % on the two it played. But three levels and one episode each cannot
tell an order from an accident, and what falls along the course is almost wholly what is
left on the counter, not what goes wrong in the machine: the models left 0, 5 to 14 % and
19 to 27 % of the points out, while of what they loaded 84 to 100 % of the points came out
clean, with no fall from the breakfast (84, 93, 100 %) to the dinner party (92, 97 %). The
course gets harder by having more that does not fit and more big pieces without a made
place; it does not yet get harder to wash what one has loaded.

**The careful reference load is not a ceiling.** Both models beat it on both full levels
they played (by 1 to 16 points on the breakfast, 10 and 24 on the dinner party), each time
by placing big pieces the scripted careful hand never tries: the reference policy places no
pan, dish, tin, tray or tub. A score normalised by the careful load
(`docs/research/benchmark.md` section 5.1) would put these episodes above 1. The levels
need a better reference before scores are normalised.

**The mistakes the levels are built on were not made.** The gates of the course hold a
level to "careful beats careless by a fifth", and that margin is carried by hollow pieces
stood mouth up or laid on their side (`docs/benchmark/levels.md`). Neither model did that
once. What cost them points was other things: a pan on edge whose base did not come clean,
a pan stood on top of the cutlery basket, a glass and a mug on top of a shelf, a board
along the wall, and at the dinner party three of the four glasses that stood at the rear
end of a side rest (two of gpt-6-astra's, one of gpt-6.1-sol's; 8 or 9 points each; the two
that stood there in the second breakfast came clean). Whether those verdicts are right is
a question for the wash and the next test wash, not for this table: the cup shelves' height
is inferred and has not been measured by tape, and the rear of the rests is where the
calibration note already found glasses staying dirty along the left wall.

**It says nothing about cost in money** (no prices), about people (no human episode), about
any Anthropic model (that path of the harness has still not met the real API), or about
levels 2, 3, 5 and 6.

## 5. Commands

```sh
# Run these from the root of the repository.
pnpm --filter @spotless/bench bench run --levels breakfast --policies openai:gpt-6.1-sol \
  --max-input-tokens 12000000 --out "$PWD/.spotless/bench/course/sol-breakfast"
pnpm --filter @spotless/bench bench run --levels tutorial,breakfast,dinner-party \
  --policies empty,careful,careless,random --no-render --out "$PWD/.spotless/bench/course/reference"
pnpm --filter @spotless/bench bench verify <dir>/record.json --rewash > <dir>/verify-rewash.json
pnpm --filter @spotless/bench bench table "$PWD/docs/benchmark/first-runs/course" \
  --md "$PWD/docs/benchmark/first-runs/course/results.md" --json "$PWD/docs/benchmark/first-runs/course/results.json"
pnpm --filter @spotless/bench episode-table docs/benchmark/first-runs/course \
  --md docs/benchmark/first-runs/course/episodes.md --json docs/benchmark/first-runs/course/episodes.json
```

Give `bench` absolute paths: under `pnpm --filter` a relative one is taken from
`packages/bench`. `bench verify --rewash` prints one line; kept as `verify-rewash.json`
beside the record it is what the table's "score" column shows (a run verifies the log and
the load only). An official wash takes 5 to 8 minutes on the reference machine and a second wash as
long: the harness and `verify` each wash in a directory of their own and do not share the
exposure cache. `tutorial`, `breakfast` and `dinner-party` take `--max-input-tokens`
2,000,000, 12,000,000 and 20,000,000.

Each episode directory holds `record.json`, `transcript.json`, `images/` and
`verify-rewash.json`; `reference/<level>__<policy>/record.json` are the scripted policies.
None holds the key or the address of the endpoint: a record says `endpoint: azure` and no
more. The tool-call identifiers in the transcripts are generated ones, put in place of the
provider's when the repository was published (`../README.md` section 0).
