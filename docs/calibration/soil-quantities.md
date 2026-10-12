# Soil quantities: the soil side's data per soil, and the level records that disagree

Written by `packages/calibration/scripts/soil-quantities.ts` from `SOIL_DATA` (`packages/sim-soil/src/soil-data.ts`), the catalogue and the levels of the course. Do not edit by hand. Sources of the numbers: `docs/research/standards.md` sections 4.1, 4.3, 4.4, 10.3 and 13.3, `docs/research/soils.md` sections 5, 7.7 and 8.1, `docs/research/chemistry.md` sections 4.2, 7 and 8.6; the note of each row says which.

## 1. What the wash does with a soil record now

- **Model class, solids fraction and scatter come from the soil id** (`SOIL_DATA`), for every soil of the catalogue. The catalogue's mechanism class and solids fraction are used only for an id the table does not know.
- **An amount is on the basis the catalogue states for the soil**: wet (as applied) or dry. A soil stated dry (tea, coffee, tomato sauce, pasta film, burnt soils) is all dry matter; the first build multiplied it by the solids fraction of its class (a tea film by 0.01).
- **Heated milk is the protein and fat that has to be digested** (5 % of UHT milk with 1.5 % fat, 7 % of whole milk), not all its solids and not the 50 % of the egg-yolk class.
- **Microwaved milk is read as cooked dry (125 C, 30 min), not as "baked" (160 C, 1 h)**, which is the only heat history the catalogue allows it.

## 2. The data per catalogue soil

| Soil | Catalogue class | Model class | Appearance (standards 10.3) | Visible above (mg/cm2) | Laid on | Basis | Solids | Source of solids | Working loading (g/m2) | Range | Dry (mg/cm2) | Usual coverage | Usual ageing | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| aham_coffee | STAIN | tea | stain | 0.00375 | film | dry | 1 | dossier | 0.15 | 0.05 to 1 | 0.0150 | 0.6 | none, 2 h | as coffee |
| aham_creamed_corn | SWS | coloured_starch | coloured | 0.0350 | spread | wet | 0.25 | composition | 150 | 50 to 300 | 3.75 | 0.25 | none, 2 h | creamed corn is about a quarter solids, yellow |
| aham_egg_yolk | SWP | egg_yolk | coloured | 0.0350 | spread | wet | 0.5 | catalogue | 150 | 100 to 300 | 7.50 | 0.25 | none, 2 h | standards 4.2 |
| aham_ground_beef | SWP | egg_yolk | coloured | 0.0350 | spread | wet | 0.4 | catalogue | 120 | 60 to 300 | 4.80 | 0.25 | none, 2 h | standards 4.2 |
| aham_mashed_potato | SWS | starch | translucent | 0.100 | spread | wet | 0.22 | catalogue | 1500 | 500 to 3000 | 33.0 | 0.25 | none, 2 h | standards 4.2 |
| aham_oatmeal | SWS | starch | translucent | 0.100 | spread | wet | 0.16 | catalogue | 600 | 300 to 1000 | 9.60 | 0.25 | none, 2 h | standards 4.2 |
| aham_peanut_butter | FAT | fat_oil | fat | 0.100 | spread | wet | 0.98 | catalogue | 300 | 100 to 500 | 29.4 | 0.25 | none, 2 h | standards 4.2 |
| aham_raspberry_preserves | SOL | soluble_coloured | coloured | 0.0350 | spread | wet | 0.65 | catalogue | 100 | 30 to 300 | 6.50 | 0.25 | none, 2 h | standards 4.2 |
| aham_tomato_juice | SOL | soluble_coloured | coloured | 0.0350 | film | wet | 0.06 | composition | 30 | 10 to 60 | 0.180 | 0.6 | none, 2 h | tomato juice is about 6 % solids |
| avocado | PEEL | adhesive | coloured | 0.0350 | spread | wet | 0.27 | catalogue | 150 | 50 to 300 | 4.05 | 0.3 | none, 2 h | soils 5.10 |
| burnt_carbonised | BURN | egg_yolk | coloured | 0.0350 | spread | dry | 1 | dossier | 100 | 20 to 300 | 10.0 | 0.3 | burnt, 2 h | soils 8.1 (stated dry) |
| burnt_sugar | BURN | egg_yolk | coloured | 0.0350 | spread | dry | 1 | dossier | 100 | 20 to 300 | 10.0 | 0.3 | baked, 2 h | soils 5.6 (stated dry); a burnt soil |
| butter_margarine | FAT | fat | fat | 0.100 | spread | wet | 0.82 | composition | 10 | 5 to 150 | 0.820 | 0.3 | none, 1 h | butter and margarine are about 82 % fat and solids; the catalogue names both, the melting curve is butter's |
| caramel | SOL | soluble_coloured | coloured | 0.0350 | spread | wet | 0.85 | composition | 100 | 30 to 300 | 8.50 | 0.3 | cooked, 2 h | a caramel sauce is about 85 % solids |
| cheese_baked | BURN | egg_yolk | coloured | 0.0350 | spread | dry | 1 | dossier | 280 | 100 to 600 | 28.0 | 0.2 | baked, 2 h | soils 8.1 (baked complex soil, stated dry) |
| cheese_melted | SWP | egg_yolk | coloured | 0.0350 | spread | wet | 0.6 | catalogue | 800 | 300 to 2000 | 48.0 | 0.2 | warm, 2 h | soils 8.1 |
| chocolate | FAT | fat | fat | 0.100 | spread | wet | 0.99 | composition | 100 | 30 to 300 | 9.90 | 0.3 | none, 2 h | cocoa butter clears at 34 to 37 C, nearest to butter in chemistry 4.2, which does not list it |
| coffee | STAIN | tea | stain | 0.00375 | film | dry | 1 | dossier | 0.15 | 0.05 to 1 | 0.0150 | 0.6 | none, 12 h | soils 5.7: less tenacious than tea; a third of an IKW-level stain |
| cream | FAT | fat | fat | 0.100 | film | wet | 0.4 | composition | 50 | 20 to 150 | 2.00 | 0.4 | none, 2 h | whipping cream: 35 % milk fat and 5 % other solids; melts as butter (chemistry 4.2) |
| curry | FAT | fat | fat | 0.100 | spread | wet | 0.25 | composition | 150 | 50 to 300 | 3.75 | 0.3 | none, 2 h | a sauce of about a quarter fat and solids; the fat is ghee or oil |
| dough_batter | SWS | starch | translucent | 0.100 | spread | wet | 0.5 | composition | 300 | 100 to 500 | 15.0 | 0.3 | none, 2 h | dough about 60 % and batter about 40 % solids |
| egg_cooked | SWP | egg_yolk | coloured | 0.0350 | spread | wet | 0.5 | catalogue | 150 | 100 to 600 | 7.50 | 0.3 | cooked, 2 h | soils 8.1 |
| egg_white | SWP | milk | translucent | 0.200 | film | wet | 0.12 | catalogue | 150 | 50 to 300 | 1.80 | 0.3 | none, 2 h | soils 8.1 (a clear to white protein film) |
| egg_yolk_dried | SWP | egg_yolk | coloured | 0.0350 | spread | wet | 0.5 | catalogue | 150 | 100 to 600 | 7.50 | 0.3 | none, 2 h | soils 8.1 |
| fat_polymerised | BURN | egg_yolk | coloured | 0.0350 | film | dry | 1 | dossier | 100 | 20 to 300 | 10.0 | 0.4 | baked, 2 h | soils 8.1 (stated dry); a burnt soil, the protein law slowed by its bake index |
| gravy | SWS | coloured_starch | coloured | 0.0350 | film | wet | 0.1 | catalogue | 150 | 50 to 300 | 1.50 | 0.5 | warm, 2 h | soils 5.3: a brown starch-thickened film |
| hummus | SWS | coloured_starch | coloured | 0.0350 | spread | wet | 0.35 | catalogue | 300 | 100 to 500 | 10.5 | 0.3 | none, 2 h | a beige starch and protein paste |
| iec_egg_yolk | SWP | egg_yolk | coloured | 0.0350 | brushed | wet | 0.5 | catalogue | 113 | 100 to 170 | 5.65 | 1 | warm, 3 h | standards 13.3: 3 g on the well of a dinner plate, 2 g on a dessert plate (132), 0.3 g on the tines of a fork (165) |
| iec_margarine | FAT | fat_margarine | fat | 0.100 | spread | wet | 0.82 | composition | 154 | 100 to 160 | 12.6 | 0.5 | none, 0 h | standards 13.3: 0.3 g on half of a knife blade, 5 g on the platter; loaded fresh; margarine is about 82 % fat and solids |
| iec_milk | BURN | milk | translucent | 0.200 | film | wet | 0.05 | dossier | 1950 | 1500 to 3700 | 9.75 | 0.25 | baked (read as cooked), 3 h | standards 13.3: 10 mL (10.3 g) per glass on a quarter of the interior, 53 cm2 of the test glass; solids to digest 0.05 (soil.milk.solidsFraction); cooked dry in a microwave oven at about 100 C |
| iec_minced_meat | SWP | egg_yolk | coloured | 0.0350 | spread | wet | 0.21 | catalogue | 113 | 100 to 120 | 2.37 | 1 | warm, 3 h | standards 4.4, 13.3: 3 g on the well of a dinner plate (266 cm2) |
| iec_oat_flakes | SWS | starch | translucent | 0.100 | spread | wet | 0.08 | catalogue | 122 | 100 to 160 | 0.976 | 1 | warm, 3 h | standards 4.1 (verified: 3 g, 10.6 mg/cm2, brushed on with the rim free), 4.4 |
| iec_spinach | PART | coloured_starch | coloured | 0.0350 | spread | wet | 0.08 | composition | 120 | 100 to 135 | 0.960 | 1 | warm, 3 h | standards 13.3: 2 g on a dessert plate; minced frozen spinach is about 92 % water |
| iec_tea | STAIN | tea | stain | 0.00375 | film | dry | 1 | dossier | 0.25 | 0.1 to 1 | 0.0250 | 0.6 | warm, 3 h | standards 4.1, 13.3: half-filled once, 1 h at 80 C, emptied: taken as half the film of the IKW stain (two fills drawn down in steps, hard water with iron, stored 3 days), range 0.2 to 2 of it |
| ikw_creme_brulee | SWP | egg_yolk | coloured | 0.0350 | spread | wet | 0.33 | catalogue | 198 | 187 to 209 | 6.53 | 0.8 | baked, 4 h | standards 4.3 (verified: 19.8 mg/cm2, 2 cm rim free) |
| ikw_egg_yolk | SWP | egg_yolk | coloured | 0.0350 | brushed | wet | 0.5 | catalogue | 107 | 100 to 115 | 5.35 | 1 | cooked, 30 h | standards 4.3 (verified: 1.5 g on 140 cm2, 750 mg dry) |
| ikw_milk_microwaved | BURN | milk | translucent | 0.200 | film | wet | 0.05 | dossier | 1950 | 1500 to 3700 | 9.75 | 0.25 | baked (read as cooked), 3 h | standards 4.1: 10 mL baked 10 min at 450 W, then 2 h at 80 C |
| ikw_milk_skin | SWP | milk | translucent | 0.200 | film | wet | 0.25 | composition | 30 | 10 to 60 | 0.750 | 0.3 | warm, 3 h | as milk_skin |
| ikw_minced_meat | SWP | egg_yolk | coloured | 0.0350 | spread | wet | 0.21 | catalogue | 118 | 113 to 123 | 2.48 | 1 | baked, 3 h | standards 4.3 (verified: 11.8 mg/cm2) |
| ikw_pasta | SWS | starch | translucent | 0.100 | spread | wet | 0.15 | catalogue | 120 | 100 to 140 | 1.80 | 1 | baked, 3 h | standards 4.4 |
| ikw_starch_mix | SWS | starch | translucent | 0.100 | sprayed | dry | 1 | dossier | 37.5 | 35 to 40 | 3.75 | 1 | warm, 52 h | standards 4.3 (verified: 3.75 mg/cm2 dry; 48 h air and 4 h at 80 C) |
| ikw_tea | STAIN | tea | stain | 0.00375 | film | dry | 1 | dossier | 0.5 | 0.2 to 1 | 0.0500 | 0.9 | none, 72 h | standards 4.3, chemistry 3.4: the IKW-level stain, the nominal film of soil.tea.visibleMass |
| jam | SOL | soluble_coloured | coloured | 0.0350 | spread | wet | 0.65 | catalogue | 100 | 30 to 300 | 6.50 | 0.3 | none, 2 h | soils 8.1 |
| lard_tallow | FAT | fat_tallow | fat | 0.100 | film | wet | 1 | composition | 150 | 20 to 300 | 15.0 | 0.5 | cooked, 2 h | roast drippings: the catalogue names lard and tallow together; the harder of the two (a record of lard alone can name the class fat_lard) |
| lipstick | FAT | fat_tallow | fat | 0.100 | film | wet | 1 | composition | 5 | 1 to 20 | 0.500 | 0.1 | none, 2 h | waxes melt above every fat of chemistry 4.2; the hardest listed stands for them |
| mashed_potato | SWS | starch | translucent | 0.100 | spread | wet | 0.22 | catalogue | 1500 | 500 to 3000 | 33.0 | 0.3 | none, 2 h | soils 8.1 (white crusty patches; the starch threshold) |
| mayonnaise | FAT | fat_oil | fat | 0.100 | spread | wet | 0.8 | composition | 150 | 50 to 300 | 12.0 | 0.3 | none, 2 h | about 78 % oil with egg yolk |
| milk_burnt | BURN | milk | translucent | 0.200 | film | wet | 0.07 | composition | 200 | 100 to 3500 | 1.40 | 0.3 | cooked, 2 h | whole milk: protein 3.3 and fat 3.6 g per 100 g are the film to digest (soil.milk.solidsFraction) |
| milk_film | SOL | soluble | translucent | 0.200 | film | wet | 0.125 | catalogue | 30 | 10 to 60 | 0.375 | 0.6 | none, 2 h | soils 8.1: a cold-dried milk film redisperses |
| milk_skin | SWP | milk | translucent | 0.200 | film | wet | 0.25 | composition | 30 | 10 to 60 | 0.750 | 0.3 | warm, 2 h | a skin of milk protein and fat, about a quarter solids |
| minced_meat | SWP | egg_yolk | coloured | 0.0350 | spread | wet | 0.4 | catalogue | 120 | 60 to 300 | 4.80 | 0.3 | cooked, 2 h | soils 8.1 |
| mustard | PEEL | adhesive | coloured | 0.0350 | spread | wet | 0.3 | composition | 100 | 30 to 200 | 3.00 | 0.2 | none, 2 h | prepared mustard is 20 to 35 % solids |
| pasta_starch | SWS | starch | translucent | 0.100 | film | dry | 1 | dossier | 37.5 | 20 to 100 | 3.75 | 0.4 | cooked, 2 h | soils 8.1 (stated dry) |
| peanut_butter | FAT | fat_oil | fat | 0.100 | spread | wet | 0.98 | catalogue | 300 | 100 to 500 | 29.4 | 0.3 | none, 2 h | peanut oil is liquid |
| porridge | SWS | starch | translucent | 0.100 | spread | wet | 0.16 | catalogue | 600 | 300 to 2000 | 9.60 | 0.4 | none, 2 h | soils 8.1 |
| red_wine | STAIN | tea | stain | 0.00375 | film | dry | 1 | dossier | 0.15 | 0.05 to 1 | 0.0150 | 0.3 | none, 12 h | soils 5.7: a dried ring; a third of an IKW-level stain |
| rice_grains | PART | coloured_starch | coloured | 0.0350 | spread | wet | 0.31 | catalogue | 50 | 10 to 200 | 1.55 | 0.2 | cooked, 2 h | soils 5.4: discrete grains, seen as particles |
| rice_starch | SWS | starch | translucent | 0.100 | film | dry | 1 | dossier | 30 | 10 to 50 | 3.00 | 0.4 | cooked, 2 h | soils 5.4 (film of 10 to 50 g/m2, stated dry) |
| seeds | PART | coloured_starch | coloured | 0.0350 | spread | wet | 0.9 | composition | 30 | 10 to 100 | 2.70 | 0.2 | none, 2 h | dry seeds |
| spinach_particles | PART | coloured_starch | coloured | 0.0350 | spread | wet | 0.08 | composition | 100 | 30 to 300 | 0.800 | 0.3 | none, 2 h | chopped spinach is about 92 % water |
| sugar_syrup | SOL | soluble | translucent | 0.200 | film | wet | 0.8 | catalogue | 100 | 30 to 300 | 8.00 | 0.4 | none, 2 h | soils 8.1 |
| tea_tannin | STAIN | tea | stain | 0.00375 | film | dry | 1 | dossier | 0.25 | 0.05 to 1 | 0.0250 | 0.6 | none, 12 h | soils 5.7, 8.1 (under 1 g/m2); a cup left standing, half an IKW-level stain |
| tomato_sauce | PEEL | adhesive | coloured | 0.0350 | spread | wet | 0.3 | catalogue | 150 | 150 to 1000 | 4.50 | 0.3 | none, 2 h | soils 8.1 gives 50 to 300 g/m2 dry (278 in the test); the catalogue states a dry basis and a solids fraction of 0.3 together, and the wash has always multiplied by it: an amount is taken as wet sauce, so the catalogue's 150 g/m2 is 45 g/m2 dry, the low end of the dossier's range |
| vegetable_oil | FAT | fat_oil | fat | 0.100 | film | wet | 1 | composition | 15 | 5 to 50 | 1.50 | 0.6 | none, 1 h | chemistry 4.2: liquid at every wash temperature |
| wheat_biscuit_cereal | SWS | coloured_starch | coloured | 0.0350 | spread | wet | 0.3 | catalogue | 600 | 300 to 2000 | 18.0 | 0.3 | none, 2 h | soils 5.4: beige crusted patches with bran |
| yoghurt | SWP | milk | translucent | 0.200 | film | wet | 0.135 | catalogue | 150 | 50 to 300 | 2.02 | 0.4 | none, 2 h | soils 5.2 |

Every one of the 66 catalogue soils has an entry.

## 3. Soil records of the starter levels that disagree

327 soil records in 7 levels use 25 soils (avocado, burnt_sugar, butter_margarine, cheese_baked, chocolate, cream, curry, dough_batter, egg_cooked, egg_yolk_dried, fat_polymerised, gravy, jam, lard_tallow, milk_film, milk_skin, minced_meat, pasta_starch, porridge, rice_starch, spinach_particles, sugar_syrup, tomato_sauce, vegetable_oil, yoghurt). 111 records are listed; identical records of one level (the same item type, soil, amount and coverage) are merged into one row.

| Level | Items | Item type | Soil | Amount (g) | Covered (cm2) | Regions and coverage | Dry loading, first build (mg/cm2) | Dry loading as the wash reads it now | Working quantity (mg/cm2) | Now / working | What disagrees |
|---|---|---|---|---|---|---|---|---|---|---|---|
| tutorial | 2 (fork_01 ...) | dinner_fork_185 | spinach_particles | 0.0944 | 9.44 | tines 0.5 | 2.50 | 0.800 | 0.800 | 1.00 | solids fraction 0.250 in the first build, 0.0800 now: the dry mass changes by x 0.320 without any change of the record |
| tutorial | knife_01 | dinner_knife_210 | butter_margarine | 0.0163 | 16.3 | blade 0.4 | 1.00 | 0.821 | 0.820 | 1.00 | solids fraction 1.00 in the first build, 0.820 now: the dry mass changes by x 0.820 without any change of the record |
| lunch-for-four | 4 (side_plate_01 ...) | dessert_plate_porcelain_190 | spinach_particles | 0.230 | 23.0 | well 0.15 | 2.50 | 0.799 | 0.800 | 0.998 | solids fraction 0.250 in the first build, 0.0800 now: the dry mass changes by x 0.320 without any change of the record |
| lunch-for-four | 4 (fork_01 ...) | dinner_fork_185 | spinach_particles | 0.0944 | 9.44 | tines 0.5 | 2.50 | 0.800 | 0.800 | 1.00 | solids fraction 0.250 in the first build, 0.0800 now: the dry mass changes by x 0.320 without any change of the record |
| lunch-for-four | 4 (knife_01 ...) | dinner_knife_210 | butter_margarine | 0.0163 | 16.3 | blade 0.4 | 1.00 | 0.821 | 0.820 | 1.00 | solids fraction 1.00 in the first build, 0.820 now: the dry mass changes by x 0.820 without any change of the record |
| lunch-for-four | salad_bowl_01 | serving_bowl_vitrelle_216 | spinach_particles | 0.430 | 43.0 | interior 0.1 | 2.50 | 0.799 | 0.800 | 0.999 | mean coverage 0.100 against the usual 0.3; solids fraction 0.250 in the first build, 0.0800 now: the dry mass changes by x 0.320 without any change of the record |
| weeknight-dinner | 4 (side_plate_01 ...) | dessert_plate_porcelain_190 | spinach_particles | 0.230 | 23.0 | well 0.15 | 2.50 | 0.799 | 0.800 | 0.998 | solids fraction 0.250 in the first build, 0.0800 now: the dry mass changes by x 0.320 without any change of the record |
| weeknight-dinner | 4 (pasta_bowl_01 ...) | cereal_bowl_vitrelle_159 | pasta_starch | 0.363 | 96.8 | interior 0.4 | 0.938 | 3.75 | 3.75 | 1.00 | solids fraction 0.250 in the first build, 1.00 now: the dry mass changes by x 4.00 without any change of the record |
| weeknight-dinner | 4 (fork_01 ...) | dinner_fork_185 | spinach_particles | 0.0944 | 9.44 | tines 0.5 | 2.50 | 0.800 | 0.800 | 1.00 | solids fraction 0.250 in the first build, 0.0800 now: the dry mass changes by x 0.320 without any change of the record |
| weeknight-dinner | 4 (knife_01 ...) | dinner_knife_210 | butter_margarine | 0.0163 | 16.3 | blade 0.4 | 1.00 | 0.821 | 0.820 | 1.00 | solids fraction 1.00 in the first build, 0.820 now: the dry mass changes by x 0.820 without any change of the record |
| weeknight-dinner | oven_dish_01 | oven_dish_glass_3qt | cheese_baked | 15.9 | 568 | interior 0.35, flange 0.3 | 14.0 | 28.0 | 28.0 | 0.999 | solids fraction 0.500 in the first build, 1.00 now: the dry mass changes by x 2.00 without any change of the record |
| weeknight-dinner | pasta_pot_01 | stockpot_steel_8qt | pasta_starch | 2.23 | 595 | interior_wall 0.4 | 0.937 | 3.75 | 3.75 | 1.00 | solids fraction 0.250 in the first build, 1.00 now: the dry mass changes by x 4.00 without any change of the record |
| weeknight-dinner | salad_bowl_01 | serving_bowl_vitrelle_216 | spinach_particles | 0.430 | 43.0 | interior 0.1 | 2.50 | 0.799 | 0.800 | 0.999 | mean coverage 0.100 against the usual 0.3; solids fraction 0.250 in the first build, 0.0800 now: the dry mass changes by x 0.320 without any change of the record |
| breakfast | 4 (toast_plate_01 ...) | bread_plate_vitrelle_170 | butter_margarine | 0.0400 | 40.0 | well 0.3 | 1.00 | 0.821 | 0.820 | 1.00 | solids fraction 1.00 in the first build, 0.820 now: the dry mass changes by x 0.820 without any change of the record |
| breakfast | 4 (porridge_bowl_01 ...) | cereal_bowl_vitrelle_159 | porridge | 2.90 | 96.8 | interior 0.4 | 4.79 | 4.79 | 9.60 | 0.499 | stated 300 g/m2 on its wet basis, outside 300 to 2000 (working 600): amount x 2.00 to reach the working quantity |
| breakfast | 2 (mug_01 ...) | mug_ceramic_300 | chocolate | 0.601 | 60.1 | interior 0.3 | 10.0 | 9.90 | 9.90 | 1.00 | solids fraction 1.00 in the first build, 0.990 now: the dry mass changes by x 0.990 without any change of the record |
| breakfast | 2 (mug_01 ...) | mug_ceramic_300 | milk_skin | 0.120 | 40.1 | interior 0.2 | 1.50 | 0.749 | 0.750 | 0.998 | solids fraction 0.500 in the first build, 0.250 now: the dry mass changes by x 0.500 without any change of the record |
| breakfast | 4 (knife_01 ...) | dinner_knife_210 | butter_margarine | 0.0163 | 16.3 | blade 0.4 | 1.00 | 0.821 | 0.820 | 1.00 | solids fraction 1.00 in the first build, 0.820 now: the dry mass changes by x 0.820 without any change of the record |
| mixed-family | 4 (fork_01 ...) | dinner_fork_185 | spinach_particles | 0.0944 | 9.44 | tines 0.5 | 2.50 | 0.800 | 0.800 | 1.00 | solids fraction 0.250 in the first build, 0.0800 now: the dry mass changes by x 0.320 without any change of the record |
| mixed-family | 4 (knife_01 ...) | dinner_knife_210 | butter_margarine | 0.0163 | 16.3 | blade 0.4 | 1.00 | 0.821 | 0.820 | 1.00 | solids fraction 1.00 in the first build, 0.820 now: the dry mass changes by x 0.820 without any change of the record |
| mixed-family | chopping_board_01 | chopping_board_pp_375 | spinach_particles | 3.07 | 307 | top 0.3 | 2.50 | 0.800 | 0.800 | 1.00 | solids fraction 0.250 in the first build, 0.0800 now: the dry mass changes by x 0.320 without any change of the record |
| mixed-family | lasagne_dish_01 | oven_dish_stoneware_320 | cheese_baked | 13.1 | 466 | interior 0.3 | 14.1 | 28.1 | 28.0 | 1.00 | solids fraction 0.500 in the first build, 1.00 now: the dry mass changes by x 2.00 without any change of the record |
| mixed-family | 3 (food_container_01 ...) | food_container_600ml | curry | 3.36 | 224 | interior 0.5 | 15.0 | 3.74 | 3.75 | 0.999 | solids fraction 1.00 in the first build, 0.250 now: the dry mass changes by x 0.250 without any change of the record |
| mixed-family | spatula_01 | spatula_silicone_280 | butter_margarine | 0.0813 | 81.3 | head 0.6 | 1.00 | 0.820 | 0.820 | 1.00 | solids fraction 1.00 in the first build, 0.820 now: the dry mass changes by x 0.820 without any change of the record |
| baking-day | 4 (pudding_bowl_01 ...) | cereal_bowl_vitrelle_159 | rice_starch | 0.218 | 72.6 | interior 0.3 | 0.751 | 3.00 | 3.00 | 1.00 | solids fraction 0.250 in the first build, 1.00 now: the dry mass changes by x 4.00 without any change of the record |
| baking-day | 4 (dessert_spoon_01 ...) | dessert_spoon_160 | cream | 0.0442 | 8.84 | bowl 0.5 | 5.00 | 2.00 | 2.00 | 1.00 | solids fraction 1.00 in the first build, 0.400 now: the dry mass changes by x 0.400 without any change of the record |
| baking-day | 2 (knife_01 ...) | dinner_knife_210 | butter_margarine | 0.0203 | 20.3 | blade 0.5 | 0.998 | 0.818 | 0.820 | 0.998 | solids fraction 1.00 in the first build, 0.820 now: the dry mass changes by x 0.820 without any change of the record |
| baking-day | platter_01 | oval_platter_porcelain_320 | butter_margarine | 0.135 | 135 | well 0.4 | 1.00 | 0.822 | 0.820 | 1.00 | solids fraction 1.00 in the first build, 0.820 now: the dry mass changes by x 0.820 without any change of the record |
| baking-day | board_01 | chopping_board_pp_375 | chocolate | 2.05 | 205 | top 0.2 | 10.0 | 9.92 | 9.90 | 1.00 | solids fraction 1.00 in the first build, 0.990 now: the dry mass changes by x 0.990 without any change of the record |
| baking-day | baking_tray_01 | baking_tray_half_sheet | burnt_sugar | 4.39 | 439 | interior 0.25 | 5.00 | 10.0 | 10.0 | 1.00 | solids fraction 0.500 in the first build, 1.00 now: the dry mass changes by x 2.00 without any change of the record |
| baking-day | cake_tin_01 | roasting_tin_427 | butter_margarine | 1.13 | 1131 | interior 0.5 | 0.999 | 0.819 | 0.820 | 0.999 | solids fraction 1.00 in the first build, 0.820 now: the dry mass changes by x 0.820 without any change of the record |
| baking-day | muffin_tin_01 | muffin_tin_12 | dough_batter | 8.15 | 272 | top 0.3 | 7.50 | 15.0 | 15.0 | 1.00 | solids fraction 0.250 in the first build, 0.500 now: the dry mass changes by x 2.00 without any change of the record |
| baking-day | mixing_bowl_01 | mixing_bowl_glass_4qt | butter_margarine | 0.563 | 563 | interior 0.5, rim 0.2 | 1.00 | 0.821 | 0.820 | 1.00 | solids fraction 1.00 in the first build, 0.820 now: the dry mass changes by x 0.820 without any change of the record |
| baking-day | cooling_rack_01 | cooling_rack_half | butter_margarine | 0.169 | 169 | wire 0.2 | 0.999 | 0.819 | 0.820 | 0.999 | solids fraction 1.00 in the first build, 0.820 now: the dry mass changes by x 0.820 without any change of the record |
| baking-day | whisk_01 | balloon_whisk_292 | cream | 0.265 | 53.0 | wires 0.5 | 5.00 | 2.00 | 2.00 | 0.999 | solids fraction 1.00 in the first build, 0.400 now: the dry mass changes by x 0.400 without any change of the record |
| baking-day | 2 (spatula_01 ...) | spatula_silicone_280 | butter_margarine | 0.0813 | 81.3 | head 0.6 | 1.00 | 0.820 | 0.820 | 1.00 | solids fraction 1.00 in the first build, 0.820 now: the dry mass changes by x 0.820 without any change of the record |
| dinner-party | 6 (dinner_plate_01 ...) | dinner_plate_porcelain_270 | minced_meat | 0.378 | 31.5 | well 0.1 | 4.80 | 4.80 | 4.80 | 1.00 | mean coverage 0.100 against the usual 0.3 |
| dinner-party | 6 (knife_01 ...) | dinner_knife_210 | butter_margarine | 0.0122 | 12.2 | blade 0.3 | 1.00 | 0.820 | 0.820 | 1.00 | solids fraction 1.00 in the first build, 0.820 now: the dry mass changes by x 0.820 without any change of the record |
| dinner-party | 6 (dessert_spoon_01 ...) | dessert_spoon_160 | cream | 0.0442 | 8.84 | bowl 0.5 | 5.00 | 2.00 | 2.00 | 1.00 | solids fraction 1.00 in the first build, 0.400 now: the dry mass changes by x 0.400 without any change of the record |
| dinner-party | platter_01 | oval_platter_porcelain_320 | gravy | 1.44 | 95.7 | well 0.2, rim 0.1 | 1.50 | 1.50 | 1.50 | 1.00 | mean coverage 0.150 against the usual 0.5 |
| dinner-party | roasting_tin_01 | roasting_tin_427 | fat_polymerised | 6.79 | 679 | interior 0.3 | 5.00 | 10.0 | 10.0 | 1.00 | solids fraction 0.500 in the first build, 1.00 now: the dry mass changes by x 2.00 without any change of the record |
| dinner-party | gratin_dish_01 | oven_dish_stoneware_320 | cheese_baked | 13.1 | 466 | interior 0.3 | 14.1 | 28.1 | 28.0 | 1.00 | solids fraction 0.500 in the first build, 1.00 now: the dry mass changes by x 2.00 without any change of the record |
| dinner-party | gratin_dish_01 | oven_dish_stoneware_320 | pasta_starch | 1.75 | 466 | interior 0.3 | 0.939 | 3.75 | 3.75 | 1.00 | solids fraction 0.250 in the first build, 1.00 now: the dry mass changes by x 4.00 without any change of the record |
| dinner-party | potato_pan_01 | saucepan_steel_170 | pasta_starch | 1.46 | 389 | interior_base 0.6, interior_wall 0.5 | 0.939 | 3.76 | 3.75 | 1.00 | solids fraction 0.250 in the first build, 1.00 now: the dry mass changes by x 4.00 without any change of the record |
| dinner-party | glass_lid_01 | lid_glass_240 | pasta_starch | 0.528 | 141 | underside 0.3 | 0.937 | 3.75 | 3.75 | 0.999 | solids fraction 0.250 in the first build, 1.00 now: the dry mass changes by x 4.00 without any change of the record |
| dinner-party | cheese_board_01 | chopping_board_pe_340 | butter_margarine | 0.167 | 167 | top 0.2 | 0.999 | 0.819 | 0.820 | 0.999 | solids fraction 1.00 in the first build, 0.820 now: the dry mass changes by x 0.820 without any change of the record |
| dinner-party | cheese_platter_01 | oval_platter_vitrelle_241 | butter_margarine | 0.0649 | 64.9 | well 0.3 | 1.00 | 0.820 | 0.820 | 1.00 | solids fraction 1.00 in the first build, 0.820 now: the dry mass changes by x 0.820 without any change of the record |

## 4. What to do about a row

1. Where a row says "amount x k to reach the working quantity", the record lies outside the range of the soil data on the area it covers: multiply its amount by k, or change the coverage, or leave it and say why (a level may want a heavier or lighter soil than the usual one; the range is what the dossiers support).
2. A row that only says the solids fraction changed needs no edit: the wash now reads the record as the catalogue's basis says. Check that the dry loading in the column "as the wash reads it now" is what the level meant.
3. The standard soils on the standard items have fixed working quantities (standards 13.3): `STD_EU_13_SOILS` in `packages/calibration/anchors/src/scenario.ts`. The settled standard loads should carry those.
4. Open points for the catalogue: a solids fraction for every soil stated wet (22 have none), the basis respected for soils stated dry (`tomato_sauce` has both a dry basis and a solids fraction of 0.3), an appearance class per soil (standards 10.3), a heat history "cooked" for `iec_milk` and `ikw_milk_microwaved`, and separate ids for butter and margarine and for lard and tallow, which melt differently (chemistry 4.2).
