# The levels of the game: a course, and how each level is held to measuring stacking

Written on 11 October 2026 and brought up to date on
12 October, after the wash began to count what standing water leaves in an item (section 4).
It follows the first play test of the page, after which the levels were put in order of
difficulty and the remnants of the Auto cycle were taken out of the interface, and after the
wash simulation had been calibrated on the owner's test wash and made current on the corrected
upper basket (`spotless-sim 0.5.0 water-7`, parameter set `anchored-v7.owner-capsule`). It
replaces an earlier note, which described twelve levels in no order of difficulty
(six hand-written, six drawn by the generator) and is not in this repository.

The tables of results are generated, not typed:

- `docs/benchmark/course-table.md`: every level with its difficulty, the four reference
  policies, what decides between the careful and the careless load, the verdicts at the edge of
  clean, the wall time of the wash, the fast tier's agreement, and the gates
  (`pnpm --filter @spotless/bench course-table --md docs/benchmark/course-table.md`);
- `docs/benchmark/course-robustness.md`: three levels at three seeds and at both ends of the
  two parameters calibration left least certain (`pnpm --filter @spotless/bench robustness`).

Section 7 says what they show.

## 1. The course

Seven hand-written levels, listed and numbered in the order they are meant to be played
(`allLevels()` of `@spotless/levels`, which is the order the server lists them in and the page
numbers them by). Each adds one thing to what a player has met, and each is harder than the
one before it by the measure of section 2.

| # | Level | Title | Pieces | Of them cutlery | Points | Difficulty | What is new |
|---|---|---|---|---|---|---|---|
| 1 | `tutorial` | First load | 12 | 5 | 64 | 2.3 | Twelve things, and all of them fit: placing, leaning and the two baskets |
| 2 | `lunch-for-four` | Lunch for four | 39 | 12 | 232 | 3.7 | More than the machine holds, so something stays on the counter |
| 3 | `weeknight-dinner` | Weeknight dinner | 46 | 13 | 269 | 5.5 | Bowls, mugs and little pots in numbers: more hollow pieces than there are easy places for |
| 4 | `breakfast` | Breakfast, found at noon | 37 | 12 | 220 | 6.3 | Food that has had the whole morning to dry on (egg, porridge) |
| 5 | `mixed-family` | Everyday family load | 45 | 12 | 266 | 6.9 | Light and awkward pieces: a baby bottle and its teat, beakers with spouts, lunch tubs |
| 6 | `baking-day` | Baking day | 46 | 12 | 272 | 7.1 | Big flat pieces (a tray, a tin, a rack, a platter, a board), sugar burnt on, and a night to set |
| 7 | `dinner-party` | Dinner party | 62 | 20 | 367 | 7.2 | All of it at once, for six, and left overnight |

A level carries its place and its difficulty as data (`Level.number`, `Level.difficulty`,
`Level.newHere`). The line that says what is new is the last sentence of the level's summary,
so a person reads it in the list of levels and an agent on the level card; it names what is on
the counter and never where to put it. The server's list passes `difficulty` through and the
page shows it after the points ("difficulty 5.5") with "The loads get harder as their numbers
rise".

The six levels the generator draws from its three families (`generatedLevels()`) are **not in
the course**. A level is listed only when its reference loads have been washed at the official
tier on the calibrated wash and pass the gates; the families were designed for an earlier
state of the wash (yoghurt, chocolate and fats on the table), on which a careless load now loses
almost nothing, and they have not been drawn again. The generator, its families and its tests
stand as they were; their eighteen saved loads were removed with the levels.

The tutorial keeps its twelve pieces and 64 points exactly: tests of the server, the MCP server
and the harness play it piece by piece.

## 2. What makes a level hard, as a number

`levelDifficulty(level)` (`packages/levels/src/course.ts`) works the difficulty out from the
level's own pieces, soils and points, nothing of the wash's outcome, in four parts a player
would recognise:

| Part | What it measures | From | Full marks at | Weight |
|---|---|---|---|---|
| Choice | How much more is on the counter than the machine holds, and how much of the level's points sits on big pieces, each of which takes the room of several others | `capacityEstimate` (room asked for over room there is: 0.3 counts nothing, 1.0 everything) and the share of the points on pieces that take more room than a dinner plate on edge, in equal parts; nothing when everything fits | room 1.0 and 45 % of the points on big pieces | 0.30 |
| Pieces that punish an easy mistake | The share of the points on pieces whose shape invites a mistake (a glass, mug, cup, pot or bottle mouth up or on its side; a bowl in another or face down flat; a spoon in another; a plate face to the wall or two to a slot) and whose soil then stays (tenacity 4 or more) | shape tags of the catalogue; soil tenacity as below | all of the points | 0.25 |
| Tenacity | How hard the soils cling: the mean over the points of each piece's most tenacious soil | the catalogue's scale of 1 to 10 (`SoilType.difficulty`, docs/research/soils.md 5.11): the low end of a soil's range when it is two hours old or less and never heated, the high end from eight hours or when it was cooked, baked or burnt on | a mean of 8 (2 counts nothing) | 0.30 |
| Awkward pieces | The share of the pieces, cutlery apart, that no row of tines, rest or cell was made for: pans, pots, tins, trays, boards, lids, tubs, bottles, teats, beakers, jugs, utensils, the big bowls | shape tags | 40 % of the pieces | 0.15 |

The weighted sum is put on a scale from 1 (nothing of any part) to 10 (full marks on all), to
one decimal. The weights and the full marks are a designer's estimates. What the measure is held
to: it is a pure function of the level, a test holds every level's `difficulty` field equal to
it and rising along the course, and the reference table can be read beside it (section 7).
It does not say how many points a policy scores: on this wash that depends almost wholly on how
many of a level's points sit in hollow pieces with a soil a jet must reach (section 4).

| # | Level | Room asked for | Points on big pieces | Points on punishing pieces | Mean tenacity | Awkward pieces | choice / punishing / tenacity / awkward | Difficulty |
|---|---|---|---|---|---|---|---|---|
| 1 | tutorial | 0.15 | 25 % | 19 % | 2.9 | 14 % | 0.00 / 0.19 / 0.16 / 0.36 | 2.3 |
| 2 | lunch-for-four | 0.53 | 29 % | 19 % | 3.4 | 11 % | 0.49 / 0.19 / 0.23 / 0.28 | 3.7 |
| 3 | weeknight-dinner | 0.75 | 33 % | 39 % | 4.4 | 21 % | 0.69 / 0.39 / 0.40 / 0.53 | 5.5 |
| 4 | breakfast | 0.53 | 34 % | 70 % | 6.1 | 12 % | 0.54 / 0.70 / 0.69 / 0.30 | 6.3 |
| 5 | mixed-family | 0.65 | 33 % | 65 % | 5.1 | 39 % | 0.62 / 0.65 / 0.52 / 0.98 | 6.9 |
| 6 | baking-day | 0.69 | 35 % | 71 % | 5.3 | 35 % | 0.67 / 0.71 / 0.55 / 0.88 | 7.1 |
| 7 | dinner-party | 0.80 | 26 % | 75 % | 5.7 | 33 % | 0.65 / 0.75 / 0.62 / 0.83 | 7.2 |

The last three levels are close by this measure (6.9, 7.1, 7.2): they differ in what is hard
about them more than in how hard they are. The fresh smoothie and the fresh tomato soup of the
first two levels count as tenacity 5 and 2 by the catalogue's scale (fresh tomato sauce is its
2), so most of their hollow pieces do not count as punishing here although the wash punishes
them (section 4): the measure follows the soil data, not the wash.

## 3. The programme and the detergent

Every level is scored on **Eco 50** with one capsule of the owner's detergent, Finish Powerball
Ultimate, 12.9 g. Since 11 October nothing else is put in front of a player or an agent:

- no level names a secondary programme, the level card's `secondary_programmes` is empty, and
  `start_cycle` with another programme is refused (`unknown_programme`);
- the interface manual says "start_cycle pushes the baskets in and washes what is loaded on the
  programme the level card names" and no longer speaks of secondary programmes; a test holds
  the manual, the summaries, the soil descriptions and the programme note of every level free
  of the words;
- Auto 45-65 stays a programme of the machine that the wash command line runs for research
  (`wash-load.ts --programme auto_145`, `reference-table --programme auto_145`;
  `RESEARCH_PROGRAMME_IDS`). The wash simulation is not calibrated for it and says so there.

The manual's paragraph on looking was reworded for what `list_slots` returns now: with an item,
the places suggested for it, most useful first and a screenful at a time, each with the
position and orientation in which a hand seats the item and whether it is free; without, the
basket as geometry.

The tool descriptions of `packages/mcp` and `docs/benchmark/README.md` name no other programme
either (a test of the MCP server holds its texts to that). Four saved loads that are not levels
(`iec-13-careful`, `iec-13-careless`, `half-careful`, `owner-2026-10-10`) still name `auto_145`
in their file, because the machine data's `primaryProgramme` does; `wash-load` washes them on
Eco 50 unless told otherwise.

## 4. Soils on the calibrated wash: what a mistake costs

The soil lab (`packages/bench/scripts/soil-lab.ts`) washed the careful and the careless
reference loads of five levels of the earlier set with sixty soil records on their plates,
bowls, glasses, mugs, little pots and cutlery, each soil in every place and under every mistake
(fast tier, the calibrated soak, the corrected upper basket; 160 washes on cached exposure,
seven seconds each). Clean of washed:

| Piece | Soil | Careful place | Mouth up | On its side | Lies in another (bowl, spoon) | Face to the wall |
|---|---|---|---|---|---|---|
| Glass | avocado, tomato, mustard (a soil a jet must reach) | 36 of 36 | 0 of 16 | 0 of 7 | | |
| Glass | chocolate, milk, yoghurt, curry, mayonnaise, peanut butter, a lip mark | 36 of 36 | 16 of 16 | 5 to 7 of 7 | | |
| Glass | dried egg yolk, a thin film of porridge | 36 of 36 | 16 of 16 (it fills and soaks) | 1 of 7 | | |
| Mug | tomato, avocado, thin porridge, dried egg | 10 of 10 | | 0 of 2 | | |
| Mug | hot chocolate, yoghurt, milk skin, curry, mayonnaise | 10 of 10 | | 2 of 2 | | |
| Little pot | tomato, avocado, mustard | 16 of 16 | | 2 of 4 | | |
| Bowl | yoghurt, starch from rice or pasta | 20 of 20 | | | 0 of 2 (the bowl that lies in the other) | |
| Bowl | tomato, avocado, dried egg, thin porridge | 15 to 17 of 20 | | | 0 of 2 | |
| Bowl | porridge in the working layer | 0 of 20 | | | 0 of 2 | |
| Small plate | dried egg yolk, 5 to 12 hours | 17 of 19 | | | | 3 or 4 of 6 |
| Small plate | gravy, mince, tomato, avocado, mustard, curry, mayonnaise, starch | 18 or 19 of 19 | | | | 6 of 6 |
| Dinner plate | dried egg yolk | 12 to 16 of 19 | | | | 0 of 1 |
| Spoon | tomato, avocado | 18 of 27 | | | 1 of 5 (the spoon underneath) | |
| Spoon | thin porridge, dried egg | 24 or 25 of 27 | | | 3 of 5 | |
| Spoon | yoghurt, gravy, curry, mayonnaise, peanut butter | 26 or 27 of 27 | | | 5 of 5 | |
| Any | melted cheese (half the working layer) | 0 of 57 | | | | |

**The column "Mouth up" is of the wash as it was when the levels were designed.** Late on
11 October the wash began to leave what its water held where water stands on an item at the
end: a glass, mug or pot left standing full is now not clean whatever it carries (all 26 such
vessels in the careless reference loads fail; before, 23 did). The lab was not run again. The
other columns are not touched by that change.

What the levels do with it:

- **Hollow pieces carry the soils a jet must reach**: a smoothie of avocado, tomato soup in
  mugs, gazpacho, tomato juice, ketchup and guacamole in little pots. A careful hand gets every
  one clean; mouth up or on its side none comes clean. A few hollow pieces in each level carry
  what forgives when the piece lies on its side (hot chocolate, squash, a film of milk), so
  that a player can find out which is which. Mouth up nothing forgives any more.
- **Bowls carry what a careful hand gets clean every time** (yoghurt, a film of starch): a bowl
  that lies in another stays dirty whatever it carries, and tomato or avocado in a bowl stays
  on in one careful place in five.
- **Small plates carry dried egg yolk from the fourth level on**: the one soil of those tried
  on plates that answers to the way a plate faces, and the soil of the owner's own test wash.
  It is weak evidence in a level's score (about one turned plate in three loses its verdict)
  and it sits near the edge: two careful places in nineteen stay dirty.
- **Spoons, forks and knives carry what comes off**: with tomato or avocado a spoon stays dirty
  in a third of the careful places, which is no measure of a mistake.
- **No melted cheese, mashed potato or porridge in the working layer on the table**: they read
  dirty wherever they stand. Baked-on cheese, burnt sugar, baked-on fat and the porridge pan
  are the pieces that look worth their place and are not; they are also what does not fit.
- **No tea, coffee or red wine** (`isUnsettledSoil`): their verdict turns on the bleach rate,
  which moved twice on 11 October.

Soils whose verdict turns on the soak of Eco 50 (`isSoakSensitiveSoil`: egg, meat, starch) used
to be kept to the pans and to under three tenths of a level's points. Since the soak was
calibrated on the owner's wash they are on the table too, from the third level on, and under
four tenths of a level's points there (a test). Section 7 washes such levels at both ends of
what calibration left open.

## 5. The reference policies

Four scripted policies (`@spotless/loader`), played by the harness through the same tools as an
agent: `empty`, `random`, `careless` and `careful`. What changed on 11 October:

- **Cutlery of a kind together in one cell** is a mistake the careless policy makes
  (`cutlery_bunched`): a seeded share of the forks, knives and spoons is taken from the cells
  the careful hand dealt them round and stood beside the first of their kind. It is in every
  careless load of the course (15 pieces in all), and spoons laid into each other
  (`spoons_nested`) in six of the seven (7 spoons). Together they cost 0 to 6 points a level
  (section 7): the model washes a face that lies against another body as an open face. No
  level's outcome rests on a cutlery mistake.
- **A share of the pieces is nested, not a share of the pairs**: of six spoons two are laid
  into another (before: one), and of eight bowls up to three would be dropped into another.
  On the corrected upper basket no bowl came to lie in another in any of the seven careless
  loads (the bowl slides off or stands too high), so the table says nothing of nested bowls.
- **Cups from under the knife shelf are tried too.** On the corrected upper basket the
  careful policy leans the first cups on the rest under the folded-down knife shelf, where a
  hand cannot put a cup back from above; the careless policy passed those cups over. Such a
  cup is now stood or laid wherever else the basket takes it; when that does not hold, the
  shelf is folded up, the cup goes back on its rest and the shelf comes down again. In the
  tutorial, whose three cups all stand on that rest, no attempt holds: its careless load has no
  cup the wrong way up (section 7).
- **A bowl whose nest does not hold and that will not go back into its seat** is put down at
  the nearest free spot instead of being left on the counter.
- **Two plates to a slot is attempted and has not held** in any load on the present lower
  basket (the pushed-in plate does not come to rest against its neighbour): no reference load
  has that mistake, and the table cannot say what it costs. A row is no longer closed to the
  other plate mistake by an attempt that failed.
- The mistakes that stop the machine (a blocked tablet, a stopped arm) are still made only when
  named, and no level of the course names them. On the corrected upper basket the policy's way
  of blocking the tablet no longer does, so a level "about" the tablet's path or a stalled arm
  is not in the course yet.

What is not as "the careful load with mistakes made on it" suggests, as before: a piece taken
out for a mistake that does not hold and that will not go back into its seat is left on the
counter, and the last check of the baskets takes out what sticks out. The table of section 7
lists the points such pieces lost as `left_out`, apart from what the mistakes cost in the wash.

## 6. The gates

A level passes (`REFERENCE_GATES` of `packages/bench/src/reference.ts`, judged on the official
tier; `course-table --gates` and `reference-table --gates` exit 1 when one does not) when

- careful beats careless by at least a fifth of the points the level offers, the careful load
  read by the strictest eye and the careless one by the most lenient;
- careless beats random, or is clearly different in kind (it holds at least 1.2 times the
  points);
- a careful load cleans at least two thirds of what it loads;
- no more than a tenth of the level's points rest on verdicts at the edge of clean;
- a level that is not meant to fit whole (all but the tutorial) leaves at least 15 % of its
  points on the counter in the careful load;

and the course as a whole when the difficulty rises from each level to the next.

## 7. What the reference washes show

Official tier, Eco 50, the default set (`anchored-v7.owner-capsule`), the saved reference loads
as they are. The full tables are in `docs/benchmark/course-table.md`; the stored ones the tests
read are `packages/bench/reference/reference-official.json` and `reference-fast.json`.

| # | Level | Difficulty | Random | Careless | Careful | Careful less careless | Careful cleans of what it loads | Left on the counter | At the edge, most | Gates |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | tutorial | 2.3 | 20 (31.3 %) | 58 (90.6 %) | 64 (100.0 %) | 6 (9.4 %) | 64 of 64 points, 12 of 12 pieces | 0.0 % | 0 points | careful_over_careless |
| 2 | lunch-for-four | 3.7 | 56 (24.1 %) | 134 (57.8 %) | 187 (80.6 %) | 53 (22.8 %) | 187 of 187 points, 36 of 36 pieces | 19.4 % | 10 points (random) | passes |
| 3 | weeknight-dinner | 5.5 | 75 (27.9 %) | 117 (43.5 %) | 200 (74.3 %) | 83 (30.9 %) | 200 of 206 points, 38 of 40 pieces | 23.4 % | 0 points | passes |
| 4 | breakfast | 6.3 | 36 (16.4 %) | 112 (50.9 %) | 174 (79.1 %) | 62 (28.2 %) | 174 of 174 points, 34 of 34 pieces | 20.9 % | 5 points (careless) | passes |
| 5 | mixed-family | 6.9 | 60 (22.6 %) | 148 (55.6 %) | 218 (82.0 %) | 70 (26.3 %) | 218 of 221 points, 39 of 40 pieces | 16.9 % | 15 points (random) | passes |
| 6 | baking-day | 7.1 | 59 (21.7 %) | 124 (45.6 %) | 191 (70.2 %) | 67 (24.6 %) | 191 of 203 points, 37 of 38 pieces | 25.4 % | 6 points (random) | passes |
| 7 | dinner-party | 7.2 | 88 (24.0 %) | 100 (27.2 %) | 250 (68.1 %) | 150 (40.9 %) | 250 of 263 points, 46 of 49 pieces | 28.3 % | 4 points (random) | passes |

These are the washes of the final code (source `f58d4ed8ab930946`). Against the table of the
evening before, the careful scores did not move; the careless loads lost 5 or 6 points at the
weeknight dinner, the breakfast and on baking day, and the random loads of levels 2 to 7 lost
5 to 25 points, each for vessels left standing full that used to read clean.

What the table says, level by level:

- **Six of the seven levels pass every gate.** Careful beats careless by 22.8 to 40.9 % of
  the points on offer; a careful load cleans 94 to 100 % of the points it loads; no verdict of
  a careful load sits at the edge of clean, and one of a careless load does (a mug at the
  breakfast with a few millilitres left in it, 5 points).
- **The tutorial does not pass**: careful 64, careless 58 (9.4 %). Its three cups all lean on
  the rest under the folded-down knife shelf, where the scripted careless hand cannot turn
  them (section 5), so its careless load has spoons in each other, forks together and a bowl
  face down flat, none of which costs anything, and loses only a mug that the last check takes
  out. Two of its three cups the wrong way up would be 12 points, 18.8 %: with these twelve
  pieces it cannot pass on cups unless all three are turned. Its twelve pieces and 64 points
  are pinned by tests of the server, the MCP server and the harness, so it was not given more
  cups. Either the careless policy learns to fold the shelf up and stand a cup mouth up on the
  rest, or those tests follow the level, or the tutorial is exempt as the level that teaches
  the interface: an open question (`docs/benchmark/README.md` section 10), not taken here.
- **What decides is the hollow pieces.** Cups, glasses, mugs and little pots mouth up or on
  their side cost the careless loads 56 points at the lunch, 60 at the weeknight dinner, 56
  at the breakfast, 61 in the family load, 66 on baking day and 70 at the dinner party: 369 of
  the 485 points between the careful and the careless loads of levels 2 to 7, about three
  quarters (the table "What decides" of `course-table.md`). The rest:
  a bowl or two the scripted hand took out for a nest that did not hold and could not put
  back (6, 14 and 7 points at the lunch, the weeknight dinner and in the family load, listed
  as `left_out`), a glass no mistake was made with (9, weeknight dinner), and the plates and
  the cutlery. Of nine plates turned to the wall three lost their verdict, all three with
  dried egg yolk (four such plates were turned). Spoons in each other and cutlery of a kind
  together cost nothing where the cutlery carries yoghurt, cream, butter or leaf, 6 points at
  the breakfast, where it carries dried egg and a film of porridge, and 4 on baking day. No
  bowl lies in another and no two plates share a slot in any load (section 5).
- **The dinner party's careless load blocks the tablet's path** by accident: a glass laid on
  its side lies in it, and the load is washed without detergent. Of the 150 points between
  the two loads, 76 are charged to mistakes made with the piece (70 to cups, 6 to a turned
  egg plate: 20.7 % of the level on their own, which is no margin) and 77 to pieces no mistake
  was made with (the dinner plates with their meat, the egg plates, three glasses). The policy
  leaves the tablet's path as it falls; this is the one careless load of the seven in which it
  fell shut.
- **Careless against random**: the careless load holds 1.36 to 1.63 times the points of the
  random load on levels 2 to 7 (1.12 times in the tutorial) and scores more than it on every
  level: tutorial 58 against 20, lunch-for-four 134 against 56, weeknight-dinner 117 against 75,
  breakfast 112 against 36, mixed-family 148 against 60, baking-day 124 against 59, dinner-party
  100 against 88. (Fast tier on the random loads: the same verdict on 151 of 156 pieces.)
- **The careful share does not fall along the course** (100, 81, 74, 79, 82, 70, 68 %): the
  difficulty of section 2 is a property of what is on the counter, and the scripted careful
  hand is not a player. What a level asks of a player (more pieces, more of them awkward,
  more choice) is not what makes this policy lose points; that it leaves every pan and dish on
  the counter is. Careful and careless order the levels differently, so no order of the
  course makes both scripted series fall.
- **Models do not make the mistake the gates rest on.** In six episodes of two models on
  levels 1, 4 and 7 no hollow piece was stood mouth up or laid on its side, and both models
  beat the careful load on both full levels (`docs/benchmark/first-runs/course/`). For a
  capable player the course measures packing; see `docs/validation/README.md` section 8.

Robustness (`docs/benchmark/course-robustness.md`), levels 2, 4 and 7, the careful and the
careless load:

- **Both ends of the two least certain parameters, official tier** (soak duty 0.59 and 1,
  where the set has 0.8; supply exchange 0.005 and 0.08, where it has 0.02; each a replay on
  the exposure of the reference wash): the ranking of careful over careless holds in all
  twelve cases, and the margin hardly moves: 53 to 53 points at the lunch, 58 to 62 at the
  breakfast, 148 to 155 at the dinner party.
- **The breakfast's own score is not robust, its margin is.** At a soak duty of 0.59 its
  careful load falls from 174 to 115 points (12 verdicts: the egg plates, porridge bowls,
  forks and spoons) and its careless load from 112 to 55; at a supply exchange of 0.08 to 144
  and 84. At the low end of the soak the careful load cleans 66 % of what it loads, a hair
  under the gate. A score on that level is good to about a third until the soak is measured
  better. The lunch does not move by one verdict in any case, the dinner party by 1 to 8
  (2 to 26 points).
- **Three seeds of the wash, fast tier** (at the official tier the twelve extra cold washes
  were not run; a reviewer washed the breakfast's careful load at three seeds at the official
  tier and no verdict moved): no verdict moves at the lunch, one at the
  breakfast (2 points, careless load) and one at the dinner party (2 points, careful load).
  The margins: 53 to 53, 58 to 60 and 149 to 151 points.
- **No level's ranking of careful against careless flips** in any of the 12 parameter cases or
  the 6 seed cases, and none comes near it: none is dropped for that.

The fast tier against the official one, the same loads: the same verdict on 486 of
499 washed pieces of the careful and careless loads (97.4 %); the points of a load differ
by at most 10 points (baking-day careless, 114 against 124), and by 16 on one random load. The
fast tier's table is `packages/bench/reference/reference-fast.json`.

## 8. What this rests on, and what is not solved

- **The score of a level is decided by its hollow pieces.** On the calibrated wash the soak
  takes yoghurt, chocolate, fats, jam, sugar and milk off a piece however it is put in, and
  the model washes a face that lies against another body as an open face. What is left to
  tell a careful load from a careless one is a glass, mug or pot that stands mouth up (which
  now fails whatever it carries) or lies on its side with a soil a jet must reach. The levels
  were designed on that (31 to 40 % of each level's points sit in such pieces, 28 % in the
  tutorial) and the gate is passed on it. A model that only ever learns "mouth down" gets most
  of what the reference policies' difference measures.
- **Nesting, doubling up and covering are not measured.** A bowl in another read dirty in the
  soil lab and clean in one load of the course; the scripted hand does not get a bowl to lie
  in another on the corrected upper basket (no nest held in the seven careless loads) and
  never gets two plates into one slot. Spoons in each other and cutlery of a kind together cost 0 to 6
  points a level. Until the closure for near-contact gaps is in (it was built and is not in
  this repository) no level should be read as measuring these.
- **Soils near the edge**: dried egg yolk on small plates (levels 4 to 7), thin porridge
  (level 4) and starch (levels 3 and 6) come clean from a careful load at the calibrated soak
  and not at its lower end (section 7). They are a quarter to a third of those levels' points.
- **Plates and cutlery do not answer to stacking.** Two reviews on the evening of 11 October
  loaded plates fallen over, a stalled arm and crowded cutlery, and nearly everything came out
  clean (`docs/validation/README.md` section 8). No level can be about those until the wash
  answers to them.
- **The careful policy is not a ceiling.** It leaves every frying pan, oven dish, tin and tray
  on the counter (none has a place by its rules on this machine) and most tubs. What a level
  "leaves on the counter" is therefore what that policy cannot place, 17 to 28 % of the
  points, and a player who can stand a pan somewhere it washes scores above it.
- **The tutorial does not pass the gate** (section 7).
- **The difficulty is a designer's measure** with estimated weights; the last three levels lie
  within 0.3 of each other on it. It has not been compared with how people or models fare.
- **Not built**: a level about the tablet's path or a stalled arm (the scripted ways of making
  those mistakes do not work on the corrected baskets); the generated families on the
  calibrated wash; the rims of the baskets and the box of the cutlery basket on the rack card
  (so that an agent sees what the page uses).

## 9. Running it

```sh
pnpm --filter @spotless/levels test                                    # the course: order, difficulty, texts
pnpm --filter @spotless/levels exec tsx scripts/summary.ts              # the levels, validated
pnpm --filter @spotless/loader exec tsx scripts/stale-loads.ts          # saved loads made for another definition
pnpm --filter @spotless/loader generate-loads --jobs 6 <names>          # after a change to a level or a policy
pnpm --filter @spotless/loader check-loads --jobs 4                     # replay, baskets travel, mistakes hold
pnpm --filter @spotless/bench reference-table --tier official --jobs 2 \
     --json packages/bench/reference/reference-official.json            # 21 washes, 5 to 8 minutes each cold
pnpm --filter @spotless/bench reference-table --tier fast \
     --json packages/bench/reference/reference-fast.json
pnpm --filter @spotless/bench course-table --gates --md docs/benchmark/course-table.md
pnpm --filter @spotless/bench robustness --levels lunch-for-four,breakfast,dinner-party --tier official --seeds 0
pnpm --filter @spotless/bench robustness --levels lunch-for-four,breakfast,dinner-party --tier fast --seeds 2 --only base,seed-2,seed-3
pnpm --filter @spotless/bench exec tsx scripts/soil-lab.ts --spec <spec.json> --loads a,b --shift 0 --out <dir>
```

After a change to a level's items or points: generate its three loads again, wash them and
write the stored tables again. After a change to its soils or its words only, the regenerated
loads have the same poses and the same state hashes, and a wash of them reuses the exposure
(about 15 seconds at the official tier). The tests say which load or table is stale.

A relative `--out` given through `pnpm --filter @spotless/bench exec` is taken from
`packages/bench`; without `--out` the scripts write to `.spotless/reference/<tier>` at the root.

