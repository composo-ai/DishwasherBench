# Test washes that would calibrate the simulation, and the measurements of the machine still open

This is a protocol for anyone who has a **Bosch SMV4HAX40G**, the one machine the simulation
models, and would like to help calibrate it. It lists three test washes, in the order that tells
the simulation most about the game as it is scored, and the measurements of the machine that are
still inferred. Each wash is written so that it can be done at home with what is in a kitchen, a
kitchen scale and a phone. The last sections say how to send a result in and what the project
still has to prepare on its side.

A wash on another model cannot be scored against the simulation today: a wash record names its
machine, and this is the only machine in the catalogue.

It was written on 11 October 2026, after the first test wash (four egg-yolk plates on Eco 50,
run by the machine's owner) was read and the simulation calibrated on it
(`owner-wash-01-calibration.md`), and put in a new order on 12 October, after loads built to
find where a verdict cannot be trusted had been washed (`docs/validation/README.md` section 8).
None of the three washes below has been run as written. The owner's second test wash
(taken as 14 October, `owner-wash-02-result.md`) stood two yolk plates in one slot, as wash 3
asks, without weighing the yolk.

**Two runs of the machine, three washes.**

| Run | Wash | Programme | Hands-on time | What it settles |
|---|---|---|---|---|
| A | 1. Glasses and mugs the right and the wrong way up, and tea in four mugs | Eco 50 | 30 minutes over two days | Whether a smoothie glass or a soup mug comes clean mouth down and stays dirty mouth up or on its side: about three quarters of what separates a careful from a careless load on every level rests on this, and no wash has tested it. And whether the capsule bleaches a tea stain |
| B | 2. Three porridge bowls, two nested | Eco 50 | 20 minutes the evening before | Whether a covered bowl stays dirty, and how dirty |
| B | 3. Spoons nested and apart, forks crowded and apart, two plates in one gap | Eco 50, the same run as wash 2 | 30 minutes | Whether pieces lying close come out dirty. Today the model says nearly all of them come clean. For cutlery nothing has measured whether the real machine agrees; for two plates in one slot the owner's second test wash is one reading (`owner-wash-02-result.md`) |

**Why this order.** The calibration tool's ranking of candidate washes (`spotless-fit rank`,
`docs/calibration/fitting.md` section 7) put tea in mugs first and the nested bowls third on
11 October. That ranking was made with an
earlier parameter set on the upper basket as it was then drawn, for the parameters the tool can
fit. It has **not been run again** on the current set, and it cannot see what the washes of
`docs/validation/README.md` section 8 found later that day: that the levels' margins rest on
hollow pieces with one untested kind of soil, and that plates and cutlery lying close come out
clean. Run A and run B answer those two; the order above is a judgement from those findings,
not the tool's. The tea mugs stay in run A because they cost nothing extra there.

**What the model says beforehand** is given for washes 1 to 3 from a wash of the catalogue's
stand-in pieces at the places below, on the simulation as it is on 12 October
(`spotless-sim 0.5.0 water-7`, `anchored-v7.owner-capsule`, official tier). It is a reading to
hold the result against, not a pre-registered prediction: the calibration tool's own record and
prediction for each wash still have to be made, in a file that is not edited afterwards, before
the wash is run (the last section says what is missing).

## For every wash

**The run.** One Finish Powerball Ultimate capsule in the dispenser (the detergent the game is
scored with; if you use another, say which), no options, rinse aid as usual. The simplest wash
to compare with is the test pieces alone in an otherwise empty machine.
If you would rather not spend a run on a few test pieces, wash them with your normal load, keep
the places below free of anything else, and photograph both loaded baskets from above before
you push them in.

**The pieces.** Use only pieces their maker says are dishwasher-safe, and nothing you would
mind chipping: several of the places below are deliberately bad ones.

**Weigh.** A kitchen scale that reads 0.1 g. Put the clean, dry piece on the scale, set it to
zero, put the soil on, read. Write the figure down per piece. In the first test wash the yolk
was not weighed, and that alone moved the fitted number from 0.7 to 1.

**Photograph.** Every test piece twice: after the soil has dried, before it goes in; and after
the wash, before you wipe or touch it.

- Straight on to the soiled face (for a mug or bowl, straight down into it).
- A coin or a ruler in every picture, lying in the same plane as the soil: on the rim of the
  plate, across the mouth of the mug. Say which coin.
- The same place and the same light for all pictures of a wash: daylight from a window or one
  lamp, flash off, no shadow of the phone on the piece.
- One picture of the loaded basket from above, so that where each piece stood is on record.
- A sticker or a pencil mark under each piece, and the piece's name in the first picture of it.

**Note.**

- The time the display shows when you press start.
- The clock time at the start and the clock time at the finish (when the display reads 0:00).
- Per piece after the wash: clean; a faint film; specks or patches, and where. Dried yolk and
  starch feel matt and rough under a fingertip; feel after you have photographed.
- Anything that moved, fell over or filled with water.

**Keep**: the pictures, the weights, the times, and a line on anything that went differently.
"How to send a result in", below, says what to do with them.

**Care.** Follow the manual of your machine and of your oven. Where a step here goes against
the manual, the manual wins: leave the step out. Raw egg: wash your hands, the
fork and the worktop, and wash every test piece again in a normal wash before you eat from it.
Use only plates that are safe in an oven. A plate at 80 C is hot enough to scald: take it out
with oven gloves and let it cool before you handle it. Do not open the door during a run: the
water and the steam are hot. You do these washes at your own risk.

**The places in the game.** Each wash below gives the places in words and, beside them, the
`place` requests that put the catalogue's stand-ins there in the game. Positions are in
millimetres in the basket's own frame (x from the left wall, y from the front, z up from the
basket floor). Every request below was sent through the game's own loading physics on 11 or 12
October, on the corrected upper basket: every piece was accepted and came to rest stable, the basket slid
in, both arms turn, the door closes and the tablet tray opens. The catalogue pieces are not your
pieces, so a place is good to a centimetre or two, not to the millimetre.

## Wash 1 (run A). Glasses and mugs the right and the wrong way up, and tea in four mugs, Eco 50

**Why.** In every level of the game, what separates a careful load from a careless one is
mostly a glass, mug or little pot with smoothie, tomato soup, ketchup or guacamole in it, put in
mouth up or on its side. The model says: mouth down on a rest it comes spotless; mouth up it
fills with dirty water and keeps nearly everything; on its side it keeps its soil. The soil
numbers behind that come from the literature on viscous food residues, and the rule for what
standing water leaves went in on 11 October with nothing measured behind it. Two models that
played the game never made this mistake, so the benchmark's ability to tell good loading from
bad hangs on a part of the model nobody has checked. This wash checks it.

The four tea mugs ride along. A tea stain goes by bleach, and the bleach rate in the model is
known from below only: the published average it was fitted to cannot tell 0.0009 from 0.001 in
the model's units, and between those two values the tea items of the standard load go from all
dirty to half clean.

**The soils.**

- **Smoothie**: half a ripe avocado and half a banana, blended with a little water until it
  pours slowly. Fill a glass to a third, swirl it up the inside to about half way, pour it out,
  do not rinse. Three glasses.
- **Tomato soup**: ordinary tinned cream of tomato soup, warmed. Fill a mug to a third, swirl,
  pour out, do not rinse. Two mugs.
- **Tea**: ordinary black tea bags and tap water, in two strengths, because a stain far from the
  threshold either way says nothing. One fill is: two tea bags in the mug, boiling water to half
  way up (about 150 mL), leave for one hour, lift the bags out, pour the tea away, do not rinse,
  stand the mug mouth up to dry for at least two hours. **Weak stain**: one fill. **Strong
  stain**: three fills, each dried before the next. Two mugs of each.
- Leave everything mouth up at room temperature: the tea mugs for 24 hours after the last fill,
  the smoothie glasses and soup mugs for 12 hours (overnight).

Nothing here can be weighed at home (a film weighs milligrams to a gram). Weigh the smoothie
glasses and the soup mugs empty and again after pouring out if your scale reads 0.1 g; the
photographs carry the rest.

**The pieces.** Six mugs of one kind, white or pale inside (four tea, two soup), and three tall
glasses of one kind. If you have only four mugs, leave the soup out and keep the tea.

**Where.** Upper basket, nothing in the lower basket. Fold the knife shelf up so that the left
side is free. "On a rest" means mouth down on the sloped strip of floor that runs along a side
wall, leaning towards that wall.

| Piece | Soil | Place | In the game |
|---|---|---|---|
| Mug A | tea, strong | right rest, at the front (its middle about 11 cm from the front of the basket) | `mug_ceramic_300`, frame `upper_rack`, position `[413, 110, 76]`, orientation `{"preset": "inverted", "roll_deg": 19, "yaw_deg": 90}` |
| Mug B | tea, weak | right rest, at the back (about 39 cm from the front) | position `[413, 390, 76]`, same orientation |
| Mug C | tea, weak | left rest, at the front | position `[61, 110, 72]`, orientation `{"preset": "inverted", "roll_deg": -17, "yaw_deg": 90}` |
| Mug D | tea, strong | left rest, at the back | position `[61, 390, 72]`, same orientation as C |
| Glass 1 | smoothie | right rest, in the middle between mugs A and B, **mouth down** | `tumbler_360`: position `[415, 250, 89]`, orientation as mug A |
| Mug E | soup | left rest, in the middle between mugs C and D, **mouth down** | position `[61, 250, 72]`, orientation as mug C |
| Glass 2 | smoothie | the middle of the basket towards the front, **standing mouth up** | position `[260, 160, 110]`, orientation `{"preset": "upright"}` |
| Mug F | soup | the middle of the basket towards the back, **standing mouth up** | position `[250, 340, 100]`, orientation `{"preset": "upright"}` |
| Glass 3 | smoothie | left of the middle, **lying on its side** across the tines, mouth to the front or the back | position `[160, 250, 120]`, orientation `{"preset": "on_side"}` |

In the game, first `set_rack` `upper_rack` `shelf_knife_shelf` `up`. The two sides are
`rest_right` and `rest_left` in `list_slots`. Every request was sent through the game's loading
physics on 12 October: all nine pieces were accepted and came to rest stable, the basket slid
in, both arms turn, the door closes and the tablet tray opens. Glass 2 came to rest leaning 19
degrees on the ridge down the middle of the basket; stand yours as upright as it will go and
say how it stood.

**Photograph** each piece straight down into its mouth, a coin lying across the rim, before and
after. Before you unload, photograph the basket from above, and **say how much water stood in
glass 2 and mug F** and what it looked like (pour each into a measuring jug or weigh it).

**What the model says beforehand.**

| Piece | The model today, official tier |
|---|---|
| Glass 1, smoothie, mouth down on the right rest | clean, nothing left |
| Mug E, soup, mouth down on the left rest | clean, nothing left |
| Glass 2, smoothie, mouth up | **not clean**, score 0: it holds 364 mL of water and keeps 97 % of its smoothie |
| Mug F, soup, mouth up | **not clean**, score 0: it holds 322 mL and keeps all of its soup |
| Glass 3, smoothie, on its side | **not clean**, score 3: a thousandth of the smoothie is left, as specks; it holds no water |
| Mugs A to D, tea | all four clean with about 4 % of the stain left; B and D are at the edge of clean |

Two things in that table are strong claims. A glass standing full keeps nearly all of what was
dried in it: in the model the soil under standing water hardly comes off. And the tea mugs come
clean on both rests, although the tea of the standard test load mostly does not: the stand-in
here is the catalogue's household tea stain at one strength, and nothing ties it to the weak
or the strong mug of this wash. (The wash: nine catalogue pieces placed as above,
`spotless-sim 0.5.0 water-7`, `anchored-v7.owner-capsule`, source `f58d4ed8ab930946`,
12 October.)

**What it will settle.**

- Glass 1 and mug E against glass 2, mug F and glass 3: whether the mistake every level's gate
  rests on costs what the model says. If the mouth-up glass comes out with clean walls and a
  puddle of clear water, the rule for standing water is too harsh. If the glass on its side
  comes clean, the levels need another soil in their hollow pieces.
- The tea mugs: `soil.bleachRate`, and with it whether tea-stained cups could be put on a
  level. Strong and weak together bound the rate from both sides if one comes clean and the
  other does not; left against right says whether the two rests wash alike (in the model,
  milk glasses come clean on the right rest and stay dirty along the left wall).

## Wash 2 (run B). Porridge bowls, two nested and one free, Eco 50

**Why.** A bowl put down over another is the plainest stacking mistake there is. The model says
the covered bowl stays dirty. It says so because of a correction to its geometry made on
10 October, not because anyone measured it, and how much it says is left has swung between a
twentieth and more than half of the porridge as the loads and the basket changed; the published
estimate asks for half.

**The soil.** Porridge made with water: 50 g of rolled oats in 350 mL of water, simmered for
5 minutes with stirring, left 10 minutes to thicken.

- **5 g** in each bowl, weighed in the bowl (to half a gram), spread with the back of a spoon
  over the lower half of the inside.
- Dry on the counter for 12 hours (overnight).

**The pieces.** Three cereal bowls of one kind, about 16 cm across, that sit into one another.

**Where.** Upper basket, all three mouth down.

| Bowl | Place | In the game |
|---|---|---|
| Under | the middle of the basket towards the back, leaning on the folding row of tines there | `cereal_bowl_vitrelle_159`, frame `upper_rack`, position `[330, 330, 150]`, orientation `{"preset": "inverted"}` |
| Over | let down onto the first so that it sits over it like a lid | position `[324.2, 332, 116.7]`, orientation `{"quat_wxyz": [0.0618, -0.9807, 0.0189, 0.1843]}` (the pose of the bowl under it, 35 mm higher) |
| Free | the middle of the basket towards the front, alone, nothing within a hand's width | position `[330, 140, 150]`, orientation `{"preset": "inverted"}` |

In the game the bowls came to rest at `[324.2, 332.0, 81.7]`, `[328.8, 330.9, 88.1]` (resting on
the bowl under it and on nothing else) and `[331.2, 156.3, 79.9]`.

The bowl that matters is **Over**: its soiled inside faces the back of the bowl under it. Under
and Free are both open to the arm below and should behave alike; Free is there to show what an
uncovered bowl does in the same wash.

**Photograph** each bowl straight down into it, a ruler across the mouth, before and after. After
the wash, lift Over off carefully and photograph it first. Say whether it had water standing on
it or in the gap.

**What it will settle.** Whether a covered bowl is dirty (the verdict), and roughly what share of
the porridge stays (the amount): a film over most of the inside, patches, or nothing. That fixes
how far the model's water reaches into a gap of a few millimetres, which decides nested bowls,
and plates two to a slot, in every level.

**What the model says beforehand.**

| Bowl | The model today, official tier |
|---|---|
| Over (covered) | **not clean**, score 0: 59 % of its porridge left |
| Under | **not clean**, score 3: two parts in ten thousand left, enough to show |
| Free | clean, score 4 |

That the bowl underneath should come out worse than the free one is the model's own claim and
worth looking for. (The wash: the three catalogue bowls placed as above with 5 g of porridge
each, together with the cutlery of wash 3; 12 October, the current set.)

## Wash 3 (run B). Spoons nested and apart, forks crowded and apart, two plates in one gap, Eco 50

**Why.** In the model a spoon lying in the bowl of another comes out clean, forks packed four
to a compartment come out no worse than forks standing alone, and plates that have fallen
against each other come out clean. A lower basket loaded that way on 11 October scored every
piece. If the real machine is less forgiving, this is the largest gap between the game and a
kitchen: for plates and cutlery the score does not show whether they were stacked well. The
checklist of loading phenomena estimates the opposite: a spoon shielded by another should score
0 to 1
(`docs/research/standards.md` section 9, P15 and P17). A mechanism for faces that lie within a
millimetre or two of another body was built on 11 October and is not in this repository: with
it on, crowded forks come out dirty (score 1 to 2), which contradicts the published cutlery
average, and the nested spoon still comes out clean. Its deciding parameter
(`soil.gapDrainShare`, how much of the water running past the mouth of a gap goes into it)
moves the nested spoon from clean to filthy across its range, and no measurement anywhere
constrains it. This wash is that measurement. It is not in the tool's ranking because the
mechanism is not in the model the tool ranks with.

**Two plates in one gap** are added because plates are where most of a level's points are. Take
three dinner plates with egg yolk as in the first test wash (3.0 g each, weighed on the plate,
air-dried for 2 hours). Stand one alone in a gap of the rear rows, eating face to the middle.
Push the other two together into one gap a few gaps along, both facing the middle, so that the
eating face of the one behind lies against the back of the one in front. The game refuses a
second plate in an occupied gap, so this cannot be placed there; in the phenomena suite, two
plates set by hand 4 to 5 mm apart leave the covered plate on the edge: not clean at the full
wash, clean at the quick one.

**The soil.**

- Spoons: the porridge of wash 2, from the same pan. A level quarter teaspoon in the bowl of each
  of four spoons, spread to the edge. It is about 0.3 g, too little to weigh singly: weigh the
  four spoons together before and after and note the total.
- Forks: raw egg yolk, whisked. Dip the tines of each of eight forks to their root, let it drip
  for ten seconds, lay the fork across a glass to dry. Weigh the eight forks together before and
  after dipping.
- Dry everything on the counter: the spoons with the bowls (12 hours), the forks for 2 hours.
  Dip the forks, and spread the yolk on the three plates, two hours before you start.

**The pieces.** Four spoons of one kind (soup or dessert spoons), eight forks of one kind and
three dinner plates.

**Where.** The cutlery basket, everything with the handle down. It has two rows of four
compartments. Fill both rows starting from the same end. The fork tines point up: take care
when you reach in to unload.

| Row | First compartment | Second | Third | Fourth |
|---|---|---|---|---|
| One | one fork | **two spoons, one lying in the bowl of the other**, facing the same way | one spoon | one spoon |
| Other | one fork | **four forks** | one fork | one fork |

In the game (`soup_spoon_190`, `dinner_fork_185`, frame `cutlery_basket`, orientation
`{"preset": "handle_down"}` unless given):

| Piece | Cell | Request |
|---|---|---|
| nested spoon, first | `cell_c01` | position `[14, 93, 111]` |
| nested spoon, second | `cell_c01` | position `[21, 93, 125.7]`, orientation `{"quat_wxyz": [0.6881, 0, -0.7256, 0]}` (the pose of the first as it came to rest, 12 mm to one side and 25 mm up) |
| single spoons | `cell_c02`, `cell_c03` | positions `[22, 138, 111]` and `[22, 203, 111]` |
| four forks together | `cell_c11` | positions `[88, 83, 109]`; `[112, 103, 109]` and `[88, 103, 109]` with `"yaw_deg": 90`; `[100, 93, 109]` |
| single forks | `cell_c10`, `cell_c12`, `cell_c13`, `cell_c00` | positions `[100, 34, 109]`, `[100, 138, 109]`, `[100, 203, 109]`, `[25, 34, 109]` |

All twelve came to rest stable; the second spoon rests on the first and on the floor of its cell;
the fourth fork of the crowded cell leans on two of the others.

**Photograph** each spoon's bowl and each fork's tines, front and back, before and after, on a
plain surface with a ruler beside them. Before you unload, photograph the cutlery basket from
above, and say whether the two nested spoons were still nested.

**What it will settle.** If the nested spoon is dirty and its single partners are clean, the
mechanism is needed and this fixes its main parameter. If the crowded forks are as clean as the
single ones, the mechanism as built is too harsh on forks and must change before it is used.
If everything is clean, the model as it stands is right about cutlery and the mechanism is not
needed. The pair of plates says whether a face a few millimetres from another keeps its soil, which
is what plates fallen against each other come down to. The owner's second test wash has given one
answer for air-dried yolk: the covered plate of a pair came out clean, as the model says it does
at about 2.5 g (`owner-wash-02-result.md`). Its yolk was not weighed and there are no
photographs of the plates before or after, so the weighed and photographed pair of this wash is
still wanted.

**What the model says beforehand.**

| Piece | The model today, official tier, without the mechanism |
|---|---|
| The two nested spoons | both clean, score 5 |
| The two single spoons | both clean, score 5 |
| The four forks in one compartment | three clean (score 5), one not (score 2, about 1 % of its yolk left) |
| The four single forks | three clean (scores 5, 5 and 4), one not (score 3; it turned in its compartment and leans on the carrying handle) |
| Two plates in one gap | not washed for this document; see above |

So the model says crowding costs nothing: one fork in four is dirty either way. With the
mechanism at the values it was built with (it is not in this repository): the nested spoon still
clean at the full wash, the crowded forks at score 1 to 2. (The wash: twelve catalogue pieces
placed as above, with the bowls of wash 2; 12 October, the current set.)

## What comes after

Ranked fourth to sixth by the tool on 11 October, and worth doing only after the three above:

- Not one of the washes asked for, because the manual forbids it: the weighed yolk plates on
  Eco 50 with the lower arm held still by a tall piece, to see what a held arm costs plates in
  the rear rows. The manual says not to block the spray arms. Do this only if you accept that,
  use a light piece that cannot be thrown or broken, and do not repeat it.
- Milk heated dry in four microwave-safe glasses (10 mL of semi-skimmed milk in each, heated in
  bursts of 20 seconds and stopped as soon as the milk is dry; the glass gets very hot, so use a
  cloth and let it cool), Eco 50: the milk rate, which no measurement stands behind. Its place
  in the ranking is unstable.
- A plain repeat of the first test wash with the yolk weighed. The tool ranks it last: it says
  again what that wash said.
- A frying pan with a fried egg stuck to it, left five hours (the top prize of the breakfast
  level, 18 points), face down in the lower basket on Eco 50. In the model it did not come
  clean in any placement tried by hand or by the two models, on a heat-ageing constant no wash
  has tested. It can ride in the lower basket of run A. Use a pan its maker says is
  dishwasher-safe.

Two variations that would separate what the first test wash could not, when there is a spare
run: a yolk layer put on with a pastry brush in place of a fork (the unevenness of a spread
layer), and an oven-dried and an air-dried plate side by side facing the same way (the oven
penalty by itself).

## What cannot be measured without an instrument

No run of this machine has been logged with a metering plug. Until one is, these stay
assumptions of the model:

- **How much of the long soak of Eco 50 the pump runs.** This is the number the first test wash
  moved (0.5 to 0.8, anywhere from 0.59 to 1). The washes above narrow it only indirectly,
  through how clean things come out.
- **The temperature course**: when the machine heats, to what, and how long it holds.
- **The energy and the water** of a run, which the model reports (0.90 kWh on Eco 50 against the
  label's 0.836) and nothing checks.

**A power log is the most useful single contribution after the washes.** A metering plug that
logs power against time (one reading a minute or better, rated for the full load on the
machine's rating plate, which the machine dossier reads as 2000 to 2400 W and 10 to 16 A) on
one Eco 50 run settles most of this:

- The heater is about two kilowatts and the pump a small fraction of that, so the log shows
  directly when the heater is on and, between heatings, when the pump runs. The soak duty would
  be read off, not fitted, and that one reading would remove the largest confounding in the
  calibration (duty against enzyme level against reaction rate).
- The heating phases and their lengths give the temperature course to within the model's own heat
  balance, and the total gives the energy.

It is an integrated machine, so its plug may be behind a cabinet; that is the difficulty. Use
only a plug-in meter between the machine's own plug and the socket. If the machine is wired to
a fused spur, or you cannot reach the plug without pulling the machine out of its housing,
leave it: never open, move or rewire fixed wiring, and do not run the machine on an extension
lead.

No other single instrument comes close. A thermometer that logs would add the water temperature
itself, and is second. Use only a self-contained logger made to go through a dishwasher; never
lead a cable through the door seal. A log goes into a wash record as the measured course of the
run (`power_log` and `temperature_log`, `wash-record.md` section 5).

## Measurements of the machine still open

Collected on 11 October, most valuable first. Each is a reading anyone
with this model can take. The first needs nothing taken out; of the others all but the third
need the upper basket out of the machine.

1. **The lower basket in the tub.** By tape: the clear width of the tub's opening at the height
   of the lower basket's rim, and the outer width of the lower basket at its rim. The model has a
   basket 525 mm wide in a tub of 545 mm, 9.5 mm from the left wall and 10.5 mm from the right,
   read from a photograph and good to about 6 mm a side. In the owner's load of 10 October a
   chopping board leaned out 7.7 mm in the model and passed untouched; the owner reports that the
   real tub pushed it upright. This reading decides at what lean a board, tray or plate at the
   side is pushed in, and it is two minutes' work.

2. **A cup shelf lowered.** With one of the folding cup shelves of the upper basket folded down:
   by tape, the height of its top surface above the floor wires straight under it, and the clear
   height from those wires up to its underside. The model has 93.5 and 97.5 mm to the top and
   75.5 mm clear, deduced from the folded shelf and never seen (it could be 10 mm more). Whether
   cups go under the shelves hangs on it, which is the largest open question about how much the
   upper basket holds. A photograph of the lowered shelf from the front of the basket, at the
   height of the shelf, would also show how far a folded shelf leans.
3. **The upper spray arm from the floor of the lower basket.** With the upper basket back in the
   machine and the lower basket pushed in: the tape from the floor wires of the lower basket up to
   the lowest point of the hub of the upper arm, and up to the underside of a blade, saying which
   is which. The owner's floor-level photograph puts the hub 44 mm below the upper basket's floor;
   the machine data has 55. One of the two is off by a centimetre.
4. **The outer width and the outer depth of the upper basket**, by tape, rail to rail. The model
   has a width of 500 mm give or take 20.
5. **A photograph straight down on the empty upper basket with the tape laid across it**, and one
   with the tape laid front to back. It fixes the scale that the model now takes from the lens of
   the phone, which wires run front to back near the left side and in the middle, how far the
   front wall is set back, and the shape of the tablet tray.
6. **The same floor-level photograph as IMG_9131, from one side** (or from the back), with a ruler
   stood upright at each end of the basket. It shows the ridge down the middle that the handle
   hides from the front, the height of the side walls, and the knife shelf and the tine rows at
   their true heights.

Also wanted, smaller: a photograph straight down on the lowered knife
shelf and one face on to a lowered cup shelf, to see how much of each is open to water. Two
readings concern the owner's own machine and load of 10 October, and only the owner can take
them: which of its three heights the upper basket is set at; and the short side of the dark
baking tray of that load by tape, with the gap between its top edge and the underside of the
upper basket when it stands on its long edge at the left wall (in the model it is 1.35 mm too
tall to pass).

A reading goes into the machine data (`packages/machine/src/data/bosch-smv4hax40g.ts`). That file
is part of the simulation's fingerprinted source, so a change to it makes the parameter set
stale and every saved load has to be settled again: send the reading as an issue ("A new test
wash or measurement") and the maintainers will try to carry it through. `CONTRIBUTING.md` at the root
of the repository explains the fingerprint.

## How to send a result in

1. **Before the wash**, open an issue ("A new test wash or measurement") saying which wash you
   mean to run, so that the planned record and the prediction for it can be made and frozen
   first (the next section). A result with a prediction written beforehand is worth far more
   than one without.
2. **Run the wash** as above and keep the photographs, the weights and the times.
3. **Prepare the photographs.** Remove all metadata (camera, date, position), and make sure no
   picture shows a face, a serial number or rating plate, a view out of a window, a label with
   an address, or anything else that locates a home. `CONTRIBUTING.md` has the rules, and
   `pnpm hygiene` fails on a picture that still carries metadata.
4. **Write the wash record**: one JSON file in the format of `wash-record.md`, of kind
   `measured`, starting from the planned record or from
   `packages/calibration/examples/plates-mugs-pan.measured-template.json`. In `provenance.by`
   write a description such as "a contributor", not a name, unless you want your name in the
   repository. Check it with

   ```sh
   pnpm --filter @spotless/calibration spotless-fit validate <your record>.json
   ```

5. **Open a pull request** with the record under `packages/calibration/records/`, the
   photographs under `docs/reference/calibration_runs/<date>_<what>/`, and a short note of what
   you saw. If writing the record is more than you want to do, attach the photographs, weights
   and times to the issue and say so; that is still useful.

The first test wash is the worked example: the plan (`owner-wash-01-egg-yolk.md`), the
prediction written before the result (`owner-wash-01-prediction.md`), the result
(`owner-wash-01-result.md`), the calibration on it (`owner-wash-01-calibration.md`), its two
records under `packages/calibration/records/owner/` and its photographs under
`docs/reference/calibration_runs/2026-10-10_egg_plates/`. The second was recorded after the
fact, with no prediction made beforehand: its record was made from one photograph of the loaded
basket and the owner's words (`owner-wash-02-result.md`, the record
`owner-wash-02-stacked-plates-eco50.measured.json`, the photograph under
`docs/reference/calibration_runs/2026-10-14_stacked_plates/`).

## What is missing before these washes are run

These are jobs for the project, not for whoever runs a wash; each can be picked up by a
contributor (the issues that `docs/ROADMAP.md` lists under "Calibration data").

- **The calibration tool's records and predictions.** The candidate records under
  `packages/calibration/records/owner/candidates/` still hold the mugs where they stood on the
  upper basket before its correction and one strength of stain; there is none for wash 1's
  glasses and soup mugs, for the cutlery or for two plates in a gap. They have to be made again
  with the places of this document (`packages/calibration/scripts/make-owner-candidates.ts`),
  and a prediction written for each wash from `spotless-fit predict <record> --params
  packages/calibration/anchors/anchored-v7.owner-capsule.json`, in a file of its own that is not
  edited afterwards.
- **The ranking** (`spotless-fit rank`, `docs/calibration/fitting.md` section 7) has not been
  run on the current set and the corrected basket.
- **Two plates in one gap** (wash 3) cannot be placed through the game: the session refuses a
  second plate in an occupied gap. What the model says of it comes from the phenomena suite's
  hand-set row (P03), and from the record of the owner's second test wash, whose second plate
  of the gap is set by hand (`packages/calibration/scripts/make-owner-wash-02-measured.ts`).
