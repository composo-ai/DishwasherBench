/**
 * The seven hand-written levels of the course, all on the owner's machine (Bosch SMV4HAX40G),
 * scored on Eco 50 with one capsule of the owner's detergent. `course.ts` puts them in order,
 * numbers them and works out the difficulty of each.
 *
 * They were drawn a third time on 11 October 2026, after the first play test, when the levels
 * were put in order of difficulty, and after the wash simulation had been calibrated on the
 * owner's first test wash (the soak of Eco 50 sprays four fifths of the time). On
 * that wash a careful load of the second drawing beat a careless one by only 8 to 19 per cent
 * of a level's points: the stronger soak takes yoghurt, chocolate, fats, jam and sugar off a
 * piece however it is put in, and those were most of every table. How the levels are designed
 * now (docs/benchmark/levels.md):
 *
 *  - A course. Each level adds one thing to what the player has met: more than fits (2),
 *    bowls and little pots in numbers (3), food that has dried on all morning (4), light and
 *    awkward pieces (5), big flat pieces and something burnt on, left overnight (6), all of
 *    it at once for six (7). `Level.newHere` says it in a line, which is also the last
 *    sentence of the summary a player reads.
 *  - A mistake costs points where the simulation makes it cost. The soil lab
 *    (`packages/bench/scripts/soil-lab.ts`) washed the careful and the careless loads of five
 *    levels with sixty soil records on their pieces, on the calibrated wash: a glass, a mug or
 *    a little pot that stands mouth up or lies on its side keeps a soil a jet must reach
 *    (avocado, tomato, mustard: clean in 36 of 36 carefully placed glasses, in none of 23
 *    that stood mouth up or lay on their side) and loses yoghurt, chocolate, milk, curry and
 *    sugar all the same; a bowl that lies in another keeps whatever it carries (0 of 2 clean
 *    with every soil tried), so the bowls carry what a careful hand gets clean every time
 *    (yoghurt, a film of starch: 20 of 20); a spoon another spoon lies in keeps tomato and
 *    avocado, but so does a spoon in a third of the careful places, so spoons carry yoghurt,
 *    cream or a thin film of porridge; a small plate with dried egg yolk comes clean facing
 *    the middle in 17 of 19 places and turned to the wall in 3 or 4 of 6, the one soil of
 *    those tried on plates that answers to the way a plate faces (the owner's own test wash
 *    is of this soil). So the hollow pieces carry smoothie, soup, gazpacho, ketchup and
 *    guacamole, and the small plates of the later levels dried egg.
 *  - Soils get more tenacious along the course: two hours old in the first level, overnight
 *    in the last; fats, sugar and yoghurt first, dried egg, starch and what was baked on later.
 *  - More is offered than fits from the second level on, and what does not fit is what the
 *    meal was cooked in: a level keeps its pans and dishes to about a fifth of its points, and
 *    one of them looks worth its place and is not (baked-on cheese, burnt sugar, baked-on fat).
 *  - The pieces of the table are ones a hand can seat in this machine as the loading physics
 *    has it on the corrected upper basket: dinner and dessert plates, the lighter bowls,
 *    tumblers, mugs and little pots.
 *  - No level's outcome rests on a verdict the simulation does not settle: no tea, coffee or
 *    red wine (`isUnsettledSoil`), no melted cheese, mashed potato or hummus in the layers the
 *    soil data give them (they read dirty wherever they stand), no thick porridge on the table.
 *
 * Points follow one scale: 2 for a piece of cutlery, 4 to 10 for a glass, mug, bowl or plate
 * (a glass or a mug with something dried in it is worth a dinner plate), 8 to 20 for cookware
 * and serving pieces. Items are listed in the order of priority a
 * reference policy is offered them: the table first, then what the meal was cooked in.
 */

import type { Level } from '../types.ts';
import { items, layer, soil, starterLevel } from './builder.ts';

type Draft = ReturnType<typeof soil>;

/** A thick smoothie in a glass: a soil a jet must reach. */
function smoothie(ageH: number, age: string): Draft {
  return soil(
    'avocado',
    { interior: 0.3 },
    ageH,
    `A thick smoothie of avocado and banana, dried in a band up the inside of the glass${age}`,
  );
}

/** Hot chocolate in a mug: a ring of chocolate and a skin of milk. Comes off however the mug stands. */
function hotChocolate(ageH: number): Draft[] {
  return [
    soil('chocolate', { interior: 0.3 }, ageH, 'Hot chocolate, set in a ring inside'),
    soil('milk_skin', { interior: 0.2 }, ageH, 'A skin of hot milk stuck near the top', 'warm'),
  ];
}

/** Tomato soup drunk from a mug: a soil a jet must reach. */
function mugOfSoup(ageH: number, age: string): Draft {
  return soil(
    'tomato_sauce',
    { interior: 0.3 },
    ageH,
    `Tomato soup dried in a band inside the mug${age}`,
  );
}

/** Level 1, the tutorial: lunch for two, twelve things that all fit. */
export function tutorialLevel(): Level {
  return starterLevel(
    'tutorial',
    'First load',
    'Lunch for two: pasta, muesli and yoghurt, a smoothie each and a mug of tomato soup, cleared two hours ago.',
    1001,
    [
      items('plate', 2, 'dinner_plate_porcelain_270', 10, [
        soil(
          'tomato_sauce',
          { well: 0.5 },
          2,
          'Tomato sauce from a plate of pasta, smeared over the eating face about 2 hours ago',
        ),
      ]),
      items('bowl', 1, 'cereal_bowl_porcelain_160', 8, [
        soil(
          'yoghurt',
          { interior: 0.4 },
          2,
          'Yoghurt left in the bottom and up one side, about 2 hours old',
        ),
      ]),
      items('soup_plate', 1, 'deep_plate_porcelain_220', 8, [
        soil(
          'yoghurt',
          { interior: 0.4 },
          2,
          'Muesli with yoghurt, left in the bottom of the deep plate about 2 hours ago',
        ),
      ]),
      items('glass', 2, 'tumbler_250', 6, [smoothie(2, ', about 2 hours old')]),
      items('mug', 1, 'mug_ceramic_300', 6, [mugOfSoup(2, ', about 2 hours old')]),
      items('fork', 2, 'dinner_fork_185', 2, [
        soil(
          'spinach_particles',
          { tines: 0.5 },
          2,
          'Shreds of salad leaf caught between the tines, about 2 hours old',
        ),
      ]),
      items('spoon', 2, 'dessert_spoon_160', 2, [
        soil('yoghurt', { bowl: 0.5 }, 2, 'Yoghurt in the bowl of the spoon, about 2 hours old'),
      ]),
      items('knife', 1, 'dinner_knife_210', 2, [
        soil('butter_margarine', { blade: 0.4 }, 2, 'Butter on the blade'),
      ]),
    ],
    'Twelve things, and all of them fit: find out how placing, leaning and the two baskets work.',
  );
}

/** Level 2: lunch for four and the two pans it was cooked in. */
export function lunchForFourLevel(): Level {
  return starterLevel(
    'lunch-for-four',
    'Lunch for four',
    'Pasta with a salad for four, soup in mugs, yoghurt and a smoothie each, squash for the children, cleared an hour after the meal, and the pan and the dish it was cooked in.',
    1502,
    [
      items('plate', 4, 'dinner_plate_porcelain_270', 8, [
        soil(
          'tomato_sauce',
          { well: 0.5 },
          1,
          'Tomato sauce over half the eating face, about an hour old',
        ),
      ]),
      items('side_plate', 4, 'dessert_plate_porcelain_190', 4, [
        soil('vegetable_oil', { well: 0.5 }, 1, 'Salad dressing: oil and a few herb leaves'),
        soil('spinach_particles', { well: 0.15 }, 1, 'Bits of salad leaf stuck in the dressing'),
      ]),
      items('yoghurt_bowl', 4, 'cereal_bowl_vitrelle_159', 6, [
        soil('yoghurt', { interior: 0.4 }, 1, 'Yoghurt up the inside of the bowl'),
      ]),
      items('smoothie_glass', 4, 'tumbler_250', 9, [smoothie(1, '')]),
      items('mug', 4, 'mug_ceramic_300', 9, [mugOfSoup(1, ', about an hour old')]),
      items('ketchup_pot', 2, 'ramekin_porcelain_89', 6, [
        soil(
          'tomato_sauce',
          { interior: 0.4 },
          1,
          'Ketchup smeared round the inside of the little pot',
        ),
      ]),
      items('squash_glass', 2, 'tumbler_360', 4, [
        soil(
          'avocado',
          { interior: 0.2 },
          1,
          'The same smoothie let down with squash for the children, dried in a band inside the tall glass',
        ),
      ]),
      items('fork', 4, 'dinner_fork_185', 2, [
        soil('spinach_particles', { tines: 0.5 }, 1, 'Shreds of salad leaf between the tines'),
      ]),
      items('knife', 4, 'dinner_knife_210', 2, [
        soil('butter_margarine', { blade: 0.4 }, 1, 'Butter on the blade'),
      ]),
      items('spoon', 4, 'dessert_spoon_160', 2, [
        soil('yoghurt', { bowl: 0.5 }, 1, 'Yoghurt in the bowl of the spoon'),
      ]),
      items('salad_bowl', 1, 'serving_bowl_vitrelle_216', 8, [
        soil('vegetable_oil', { interior: 0.6 }, 1, 'Dressing all round the inside'),
        soil('spinach_particles', { interior: 0.1 }, 1, 'Shreds of leaf'),
      ]),
      items('frying_pan', 1, 'skillet_steel_270', 18, [
        soil(
          'lard_tallow',
          { interior_base: 0.9, interior_wall: 0.4 },
          1.5,
          'Fat from browning the mince, set white',
          'cooked',
        ),
        soil('minced_meat', { interior_base: 0.2 }, 1.5, 'Crumbs of browned mince', 'cooked'),
      ]),
      items('oven_dish', 1, 'oven_dish_glass_3qt', 18, [
        soil(
          'tomato_sauce',
          { interior: 0.5 },
          1.5,
          'Tomato sauce cooked onto the bottom and up the sides of the dish the pasta was finished in',
          'cooked',
        ),
      ]),
    ],
    'New: more than the machine holds, so something stays on the counter.',
  );
}

/** Level 4: breakfast for four, found at noon. */
export function breakfastLevel(): Level {
  return starterLevel(
    'breakfast',
    'Breakfast, found at noon',
    'Fried eggs on toast, porridge, smoothies and tomato juice for four and hot chocolate for two, left on the table since seven, and the three pans.',
    4004,
    [
      items('egg_plate', 4, 'dessert_plate_porcelain_190', 7, [
        soil(
          'egg_yolk_dried',
          { well: 0.4 },
          5,
          'Egg yolk run over the plate and dried to a yellow skin, about 5 hours',
        ),
      ]),
      items('toast_plate', 4, 'bread_plate_vitrelle_170', 4, [
        soil('butter_margarine', { well: 0.3 }, 5, 'Butter and toast crumbs'),
        soil('jam', { well: 0.15 }, 5, 'A smear of jam'),
      ]),
      items('porridge_bowl', 4, 'cereal_bowl_vitrelle_159', 7, [
        layer(
          soil(
            'porridge',
            { interior: 0.4 },
            5,
            'A thin film of porridge dried up the inside of the bowl, about 5 hours',
            'warm',
          ),
          0.5,
        ),
      ]),
      items('smoothie_glass', 4, 'tumbler_360', 9, [smoothie(5, ', about 5 hours')]),
      items('juice_glass', 4, 'tumbler_250', 8, [
        layer(
          soil(
            'tomato_sauce',
            { interior: 0.3 },
            5,
            'Tomato juice dried in a ring and in the bottom of the glass, about 5 hours',
          ),
          0.5,
        ),
      ]),
      items('mug', 2, 'mug_ceramic_300', 5, hotChocolate(5)),
      items('knife', 4, 'dinner_knife_210', 2, [
        soil('butter_margarine', { blade: 0.4 }, 5, 'Butter on the blade'),
        soil('jam', { blade: 0.2 }, 5, 'Jam on the blade'),
      ]),
      items('fork', 4, 'dinner_fork_185', 2, [
        soil('egg_yolk_dried', { tines: 0.5 }, 5, 'Egg yolk dried on the tines, about 5 hours'),
      ]),
      items('spoon', 4, 'dessert_spoon_160', 2, [
        layer(
          soil(
            'porridge',
            { bowl: 0.5 },
            5,
            'A film of porridge dried in the bowl of the spoon',
            'warm',
          ),
          0.5,
        ),
      ]),
      items('frying_pan', 1, 'frying_pan_clad_254', 18, [
        soil(
          'egg_cooked',
          { interior_base: 0.5 },
          5,
          'Fried egg stuck to the bottom of the pan',
          'cooked',
        ),
        soil(
          'vegetable_oil',
          { interior_base: 0.4, interior_wall: 0.3 },
          5,
          'Frying oil left in the pan',
        ),
      ]),
      items('porridge_pan', 1, 'saucepan_clad_2qt', 12, [
        soil(
          'porridge',
          { interior_wall: 0.6, interior_base: 0.3 },
          5,
          'Porridge dried in a thick band around the wall of the pan and on the bottom, about 5 hours',
          'warm',
        ),
      ]),
      items('bacon_pan', 1, 'skillet_steel_270', 16, [
        soil(
          'lard_tallow',
          { interior_base: 0.8, interior_wall: 0.3 },
          5,
          'Bacon fat set white in the pan, with browned bits',
          'cooked',
        ),
      ]),
    ],
    'New: food that has had the whole morning to dry on.',
  );
}

/** Level 3: weeknight dinner for four, with every bowl and little pot of the meal. */
export function weeknightDinnerLevel(): Level {
  return starterLevel(
    'weeknight-dinner',
    'Weeknight dinner',
    'Soup in mugs, then a pasta bake for four in bowls with guacamole, ketchup and a salad, cleared two hours after the meal, with the dish and the pans it was cooked in.',
    2002,
    [
      items('plate', 4, 'dinner_plate_porcelain_270', 8, [
        soil(
          'tomato_sauce',
          { well: 0.5 },
          2,
          'Tomato sauce over half the eating face, about 2 hours old',
        ),
      ]),
      items('side_plate', 4, 'dessert_plate_porcelain_190', 4, [
        soil('vegetable_oil', { well: 0.5 }, 2, 'Salad dressing: oil and a few herb leaves'),
        soil('spinach_particles', { well: 0.15 }, 2, 'Bits of salad leaf stuck in the dressing'),
      ]),
      items('pasta_bowl', 4, 'cereal_bowl_vitrelle_159', 7, [
        soil(
          'pasta_starch',
          { interior: 0.4 },
          2,
          'A film of starch from the pasta, dried white up the inside of the bowl',
          'cooked',
        ),
      ]),
      items('smoothie_glass', 4, 'tumbler_250', 9, [smoothie(2, ', about 2 hours old')]),
      items('tumbler', 2, 'tumbler_360', 5, [
        soil('sugar_syrup', { interior: 0.3 }, 2, 'Dried drops of squash in the bottom'),
      ]),
      items('mug', 2, 'mug_ceramic_300', 9, [mugOfSoup(2, ', about 2 hours old')]),
      items('guacamole_pot', 3, 'ramekin_porcelain_89', 6, [
        soil(
          'avocado',
          { interior: 0.4 },
          2,
          'Guacamole smeared round the inside of the little pot, about 2 hours old',
        ),
      ]),
      items('ketchup_pot', 3, 'ramekin_porcelain_89', 6, [
        soil(
          'tomato_sauce',
          { interior: 0.4 },
          2,
          'Ketchup smeared round the inside of the little pot, about 2 hours old',
        ),
      ]),
      items('fork', 4, 'dinner_fork_185', 2, [
        soil('spinach_particles', { tines: 0.5 }, 2, 'Shreds of salad leaf between the tines'),
      ]),
      items('knife', 4, 'dinner_knife_210', 2, [
        soil('butter_margarine', { blade: 0.4 }, 2, 'Garlic butter on the blade'),
      ]),
      items('spoon', 4, 'dessert_spoon_160', 2, [
        soil('yoghurt', { bowl: 0.5 }, 2, 'Yoghurt in the bowl of the spoon'),
      ]),
      items('oven_dish', 1, 'oven_dish_glass_3qt', 18, [
        soil(
          'cheese_baked',
          { interior: 0.35, flange: 0.3 },
          2,
          'Baked-on cheese crust around the sides and on the rim of the dish, out of a 200 degree oven',
          'baked',
        ),
        soil('tomato_sauce', { interior: 0.4 }, 2, 'Sauce cooked onto the bottom', 'cooked'),
      ]),
      items('frying_pan', 1, 'skillet_steel_270', 12, [
        soil(
          'lard_tallow',
          { interior_base: 0.9, interior_wall: 0.4 },
          2.5,
          'Fat from browning the mince, set white',
          'cooked',
        ),
        soil('minced_meat', { interior_base: 0.2 }, 2.5, 'Crumbs of browned mince', 'cooked'),
      ]),
      items('saucepan', 1, 'saucepan_steel_170', 10, [
        soil(
          'tomato_sauce',
          { interior_wall: 0.5 },
          2.5,
          'Tomato sauce cooked on in a band around the wall',
          'cooked',
        ),
      ]),
      items('pasta_pot', 1, 'stockpot_steel_8qt', 12, [
        soil(
          'pasta_starch',
          { interior_wall: 0.4 },
          2.5,
          'Starch boiled onto the wall of the pot the pasta was cooked in',
          'cooked',
        ),
      ]),
      items('salad_bowl', 1, 'serving_bowl_vitrelle_216', 8, [
        soil('vegetable_oil', { interior: 0.6 }, 2, 'Dressing all round the inside'),
        soil('spinach_particles', { interior: 0.1 }, 2, 'Shreds of leaf'),
      ]),
      items('lid', 1, 'lid_steel_165', 4, [
        soil('tomato_sauce', { underside: 0.4 }, 2.5, 'Splashes of sauce under the lid', 'cooked'),
      ]),
      items('turner', 1, 'turner_nylon_279', 3, [
        soil('lard_tallow', { blade: 0.6 }, 2.5, 'Meat fat on the blade', 'cooked'),
      ]),
      items('serving_spoon', 1, 'serving_spoon_216', 2, [
        soil(
          'tomato_sauce',
          { bowl: 0.6, bowl_back: 0.3 },
          2,
          'Sauce from serving the bake',
          'cooked',
        ),
      ]),
    ],
    'New: bowls, mugs and little pots in numbers: more hollow pieces than there are easy places for.',
  );
}

/** Level 5: a day of a family of four with a baby. */
export function mixedFamilyLevel(): Level {
  return starterLevel(
    'mixed-family',
    'Everyday family load',
    "A day of a family of four with a baby, loaded in the evening: plates, bowls, mugs and glasses, yesterday's lasagne dish, a pan, a board, cutlery and cooking utensils.",
    4242,
    [
      items('plate', 4, 'dinner_plate_vitrelle_260', 8, [
        soil('tomato_sauce', { well: 0.5 }, 3, 'Tomato sauce from dinner, about 3 hours old'),
      ]),
      items('cereal_bowl', 4, 'cereal_bowl_vitrelle_159', 7, [
        soil(
          'yoghurt',
          { interior: 0.4 },
          10,
          'Yoghurt and muesli from breakfast, dried on since this morning',
        ),
      ]),
      items('side_plate', 4, 'bread_plate_vitrelle_170', 5, [
        soil(
          'egg_yolk_dried',
          { well: 0.3 },
          6,
          'Egg yolk from a boiled egg at lunch, dried on the plate for about 6 hours',
        ),
      ]),
      items('glass', 4, 'tumbler_250', 9, [smoothie(6, ', about 6 hours old')]),
      items('mug', 4, 'mug_ceramic_300', 9, [mugOfSoup(6, ', since lunch, about 6 hours')]),
      items('sippy_cup', 2, 'sippy_cup_240', 7, [
        soil(
          'avocado',
          { interior: 0.3 },
          6,
          'The smoothie of avocado and banana, dried up the inside of the cup',
        ),
      ]),
      items('fork', 4, 'dinner_fork_185', 2, [
        soil('spinach_particles', { tines: 0.5 }, 3, 'Shreds of salad leaf between the tines'),
      ]),
      items('knife', 4, 'dinner_knife_210', 2, [
        soil('butter_margarine', { blade: 0.4 }, 10, 'Butter on the blade'),
      ]),
      items('spoon', 4, 'dessert_spoon_160', 2, [
        soil('yoghurt', { bowl: 0.6 }, 10, 'Yoghurt dried in the bowl of the spoon'),
      ]),
      items('baby_bottle', 1, 'baby_bottle_pp_260', 6, [
        soil('milk_film', { interior: 0.8 }, 6, 'Formula milk film inside; needed tonight'),
      ]),
      items('bottle_teat', 1, 'bottle_teat_silicone', 3, [
        soil('milk_film', { inside: 0.8 }, 6, 'Formula milk inside the teat'),
      ]),
      items('serving_bowl', 1, 'serving_bowl_vitrelle_216', 8, [
        soil('vegetable_oil', { interior: 0.5 }, 3, 'Salad dressing'),
      ]),
      items('chopping_board', 1, 'chopping_board_pp_375', 8, [
        soil('spinach_particles', { top: 0.3 }, 3, 'Shreds of vegetables on the cutting side'),
      ]),
      items('lasagne_dish', 1, 'oven_dish_stoneware_320', 18, [
        soil(
          'cheese_baked',
          { interior: 0.3 },
          24,
          "Baked-on cheese round the sides of yesterday's lasagne dish, a day old",
          'baked',
        ),
        soil('tomato_sauce', { interior: 0.3 }, 24, 'Sauce cooked onto the bottom', 'cooked'),
      ]),
      items('frying_pan', 1, 'frying_pan_clad_254', 12, [
        soil(
          'egg_cooked',
          { interior_base: 0.5 },
          10,
          'Fried egg stuck to the bottom, since this morning',
          'cooked',
        ),
      ]),
      items('food_container', 3, 'food_container_600ml', 5, [
        soil(
          'curry',
          { interior: 0.5 },
          24,
          "Yesterday's curry from a packed lunch: an oily yellow film a day old",
        ),
      ]),
      items('turner', 1, 'turner_nylon_279', 3, [
        soil('lard_tallow', { blade: 0.5 }, 10, 'Fat from frying on the blade', 'cooked'),
      ]),
      items('spatula', 1, 'spatula_silicone_280', 3, [
        soil('butter_margarine', { head: 0.6 }, 3, 'Butter on the head of the spatula'),
      ]),
    ],
    'New: light and awkward pieces: a baby bottle and its teat, beakers with spouts, lunch tubs.',
  );
}

/** Level 6: baking day. */
export function bakingDayLevel(): Level {
  return starterLevel(
    'baking-day',
    'Baking day',
    'An afternoon of baking, left until the next morning: a sponge, a rice pudding, a tray of caramel that caught, and cake, soup and smoothies for six.',
    3003,
    [
      items('cake_plate', 6, 'dessert_plate_porcelain_190', 5, [
        soil(
          'egg_yolk_dried',
          { well: 0.3 },
          9,
          'Custard of egg yolk dried to a yellow skin on the plate, overnight',
        ),
        soil('jam', { well: 0.2 }, 9, 'Jam and sponge crumbs'),
      ]),
      items('pudding_bowl', 4, 'cereal_bowl_vitrelle_159', 6, [
        soil(
          'rice_starch',
          { interior: 0.3 },
          9,
          'Rice pudding dried in a film up the inside of the bowl, overnight',
          'cooked',
        ),
      ]),
      items('mug', 4, 'mug_ceramic_300', 9, [mugOfSoup(9, ', overnight')]),
      items('smoothie_glass', 6, 'tumbler_360', 9, [smoothie(9, ', overnight')]),
      items('curd_pot', 2, 'ramekin_porcelain_89', 6, [
        soil(
          'egg_yolk_dried',
          { interior: 0.3 },
          9,
          'Lemon curd of egg yolk, set in the little pot and dried overnight',
        ),
      ]),
      items('cake_fork', 6, 'salad_fork_156', 2, [
        soil('jam', { tines: 0.5 }, 9, 'Jam between the tines'),
      ]),
      items('dessert_spoon', 4, 'dessert_spoon_160', 2, [
        soil('cream', { bowl: 0.5 }, 9, 'Cream in the bowl of the spoon'),
      ]),
      items('knife', 2, 'dinner_knife_210', 2, [
        soil('butter_margarine', { blade: 0.5 }, 9, 'Butter along the blade'),
      ]),
      items('platter', 1, 'oval_platter_porcelain_320', 8, [
        soil('butter_margarine', { well: 0.4 }, 9, 'Buttery crumbs where the cake stood'),
      ]),
      items('board', 1, 'chopping_board_pp_375', 6, [
        soil('chocolate', { top: 0.2 }, 9, 'Chopped chocolate, smeared and set', 'warm'),
      ]),
      items('baking_tray', 1, 'baking_tray_half_sheet', 16, [
        soil(
          'burnt_sugar',
          { interior: 0.25 },
          9,
          'Caramel that ran off the tarts and burnt onto the tray, nearly black',
          'baked',
        ),
      ]),
      items('cake_tin', 1, 'roasting_tin_427', 12, [
        soil(
          'butter_margarine',
          { interior: 0.5 },
          9,
          'The tin the sponge was baked in: butter and crumbs up the sides',
        ),
      ]),
      items('muffin_tin', 1, 'muffin_tin_12', 10, [
        soil(
          'dough_batter',
          { top: 0.3 },
          9,
          'Batter baked onto the top of the muffin tin round its cups',
          'baked',
        ),
      ]),
      items('custard_pan', 1, 'saucepan_clad_2qt', 12, [
        soil(
          'egg_cooked',
          { interior_base: 0.5, interior_wall: 0.3 },
          9,
          'Custard cooked onto the bottom and the wall of the pan, overnight',
          'cooked',
        ),
      ]),
      items('mixing_bowl', 1, 'mixing_bowl_glass_4qt', 8, [
        soil(
          'butter_margarine',
          { interior: 0.5, rim: 0.2 },
          9,
          'Creamed butter and sugar smeared round the inside and the rim',
        ),
      ]),
      items('cooling_rack', 1, 'cooling_rack_half', 4, [
        soil('butter_margarine', { wire: 0.2 }, 9, 'Buttery crumbs on the wires of the rack'),
      ]),
      items('whisk', 1, 'balloon_whisk_292', 5, [
        soil('cream', { wires: 0.5 }, 9, 'Whipped cream dried on the wires'),
      ]),
      items('jug', 1, 'measuring_jug_glass_500', 5, [
        soil('milk_film', { interior: 0.6 }, 9, 'A film of milk inside the measuring jug'),
      ]),
      items('spatula', 2, 'spatula_silicone_280', 3, [
        soil('butter_margarine', { head: 0.6 }, 9, 'Creamed butter on the head of the spatula'),
      ]),
    ],
    'New: big flat pieces (a tray, a tin, a rack, a platter, a board), sugar burnt on, and a night to set.',
  );
}

/** Level 7: dinner party, three courses for six, found the next morning. */
export function dinnerPartyLevel(): Level {
  return starterLevel(
    'dinner-party',
    'Dinner party',
    'Three courses for six, found the next morning: gazpacho in glasses with guacamole, tomato juice, a roast with gravy and a gratin, a custard tart. The tin, the dish, the pans, the platter and the boards besides.',
    5005,
    [
      items('dinner_plate', 6, 'dinner_plate_porcelain_270', 9, [
        soil(
          'gravy',
          { well: 0.5, rim: 0.1 },
          10,
          'Gravy dried to a skin over the eating face, left overnight',
        ),
        soil('minced_meat', { well: 0.1 }, 10, 'Shreds of the roast dried on, overnight', 'cooked'),
      ]),
      items('gazpacho_glass', 6, 'tumbler_250', 9, [
        soil(
          'tomato_sauce',
          { interior: 0.3 },
          11,
          'Gazpacho dried in a band up the inside of the glass, overnight',
        ),
      ]),
      items('dessert_plate', 6, 'dessert_plate_porcelain_190', 6, [
        soil(
          'egg_yolk_dried',
          { well: 0.3 },
          9,
          'Custard of egg yolk from the tart, dried to a yellow skin overnight',
        ),
      ]),
      items('guacamole_pot', 4, 'ramekin_porcelain_89', 6, [
        soil(
          'avocado',
          { interior: 0.4 },
          11,
          'Guacamole dried brown round the inside of the little pot, overnight',
        ),
      ]),
      items('juice_glass', 6, 'tumbler_360', 8, [
        layer(
          soil(
            'tomato_sauce',
            { interior: 0.3 },
            11,
            'Tomato juice with pepper, dried in a ring and in the bottom of the glass, overnight',
          ),
          0.5,
        ),
      ]),
      items('knife', 6, 'dinner_knife_210', 2, [
        soil('butter_margarine', { blade: 0.3 }, 10, 'Butter and gravy on the blade'),
      ]),
      items('fork', 6, 'dinner_fork_185', 2, [
        soil('gravy', { tines: 0.5 }, 10, 'Gravy dried between the tines, overnight'),
      ]),
      items('dessert_spoon', 6, 'dessert_spoon_160', 2, [
        soil('cream', { bowl: 0.5 }, 9, 'Cream from the tart dried in the bowl of the spoon'),
      ]),
      items('platter', 1, 'oval_platter_porcelain_320', 10, [
        soil('lard_tallow', { well: 0.5 }, 10, 'Meat juices and fat, set', 'cooked'),
        soil('gravy', { well: 0.2, rim: 0.1 }, 10, 'Gravy dried at the edge'),
      ]),
      items('salad_bowl', 1, 'serving_bowl_vitrelle_216', 8, [
        soil('vegetable_oil', { interior: 0.6 }, 11, 'Salad dressing round the inside'),
      ]),
      items('board', 1, 'chopping_board_pp_375', 8, [
        soil('lard_tallow', { top: 0.4 }, 11, 'Fat and juices from carving the roast', 'cooked'),
      ]),
      items('roasting_tin', 1, 'roasting_tin_427', 20, [
        soil(
          'fat_polymerised',
          { interior: 0.3 },
          12,
          'Brown varnish of baked-on fat up the sides of the tin',
          'baked',
        ),
        soil(
          'lard_tallow',
          { interior: 0.6 },
          12,
          'Roasting fat set white in the bottom, overnight',
          'cooked',
        ),
      ]),
      items('gratin_dish', 1, 'oven_dish_stoneware_320', 14, [
        soil(
          'cheese_baked',
          { interior: 0.3 },
          12,
          'Baked-on cheese round the sides of the gratin dish, overnight',
          'baked',
        ),
        soil(
          'pasta_starch',
          { interior: 0.3 },
          12,
          'Potato starch baked onto the bottom of the dish',
          'baked',
        ),
      ]),
      items('gravy_pan', 1, 'saucepan_clad_2qt', 12, [
        soil(
          'gravy',
          { interior_wall: 0.4, interior_base: 0.3 },
          12,
          'Thick gravy dried to a skin inside the pan, overnight',
          'warm',
        ),
      ]),
      items('potato_pan', 1, 'saucepan_steel_170', 10, [
        soil(
          'pasta_starch',
          { interior_base: 0.6, interior_wall: 0.5 },
          12,
          'Potato starch dried white inside the pan, overnight',
          'cooked',
        ),
      ]),
      items('lid', 1, 'lid_steel_165', 4, [
        soil('gravy', { underside: 0.3 }, 12, 'Splashes of gravy under the lid, overnight', 'warm'),
      ]),
      items('glass_lid', 1, 'lid_glass_240', 3, [
        soil(
          'pasta_starch',
          { underside: 0.3 },
          12,
          'Starchy water boiled up under the lid of the potato pan and dried, overnight',
          'cooked',
        ),
      ]),
      items('gravy_jug', 1, 'measuring_jug_glass_500', 4, [
        soil('gravy', { interior: 0.4 }, 12, 'Gravy dried to a skin inside the jug, overnight', 'warm'),
      ]),
      items('cheese_board', 1, 'chopping_board_pe_340', 6, [
        soil('butter_margarine', { top: 0.2 }, 10, 'Butter and crumbs of cheese on the board'),
      ]),
      items('tongs', 1, 'tongs_steel_350', 3, [
        soil('lard_tallow', { head: 0.5 }, 12, 'Roasting fat set on the tongs', 'cooked'),
      ]),
      items('cheese_platter', 1, 'oval_platter_vitrelle_241', 6, [
        soil('butter_margarine', { well: 0.3 }, 10, 'Butter and crumbs of cheese on the small platter'),
      ]),
      items('ladle', 1, 'ladle_steel_311', 3, [
        soil('gravy', { bowl: 0.6, bowl_back: 0.2 }, 12, 'Gravy dried in the ladle, overnight', 'warm'),
      ]),
      items('serving_spoon', 2, 'serving_spoon_216', 2, [
        soil('gravy', { bowl: 0.7, bowl_back: 0.3 }, 10, 'Gravy dried on the serving spoon'),
      ]),
    ],
    'New: all of it at once, for six, and left overnight.',
  );
}
