// The level format, its validation, the level card and the starter set.
import { getItemType, getSoil } from '@spotless/catalogue';
import { BOSCH_SMV4HAX40G, buildMachineGeometry } from '@spotless/machine';
import { describe, expect, it } from 'vitest';
import type { Level, LevelItem } from './index.ts';
import {
  BENCHMARK_VERSION,
  COOKED_BREAKFAST,
  GAME_PROGRAMME_ID,
  GENERATED_SEEDS,
  LEVEL_FAMILIES,
  OVERFULL_RATIO,
  PASTA_SUPPER,
  RATED_LOAD_RATIO,
  COURSE_LEVEL_IDS,
  DIFFICULTY_WEIGHTS,
  INTERFACE_MANUAL,
  RESEARCH_PROGRAMME_IDS,
  SCORED_PROGRAMME_NOTE,
  SECONDARY_PROGRAMME_IDS,
  SOAK_SENSITIVE_TABLE_SHARE_MAX,
  STARTER_LEVEL_IDS,
  UNCALIBRATED_PROGRAMME_NOTE,
  allLevels,
  applyRackOption,
  capacityEstimate,
  coveredAreaM2,
  familyOf,
  findLevel,
  generateLevel,
  generatedLevels,
  generatedWashSeed,
  isSoakSensitiveSoil,
  isUnsettledSoil,
  itemTenacity,
  levelCard,
  levelDifficulty,
  levelSoilFindings,
  listLevels,
  loadedFootprint,
  rackOptions,
  SOAK_SENSITIVE_SHARE_MAX,
  soakSensitiveItems,
  soakSensitiveShare,
  soilRecordQuantities,
  starterLevels,
  threeFigures,
  typicalAmountG,
  unsettledItems,
  validateLevel,
} from './index.ts';

const tutorial = (): Level => findLevel('tutorial') as Level;

describe('the starter levels', () => {
  it("are seven valid levels on the owner's machine, scored on Eco 50 and on nothing else", () => {
    const levels = starterLevels();
    expect(levels.map((l) => l.id)).toEqual(STARTER_LEVEL_IDS);
    expect(STARTER_LEVEL_IDS).toBe(COURSE_LEVEL_IDS);
    expect(levels).toHaveLength(7);
    expect(new Set(levels.map((l) => l.seed)).size).toBe(7);
    for (const level of levels) {
      expect(validateLevel(level), level.id).toEqual([]);
      expect(level.machineId).toBe('bosch_smv4hax40g');
      // The decision of 10 October 2026: the game is scored on Eco 50. Since 11 October no
      // level offers another programme (nothing of Auto is put in front of a player).
      expect(level.programmeId).toBe(GAME_PROGRAMME_ID);
      expect(level.programmeId).toBe('eco_50');
      expect(level.secondaryProgrammes).toBeUndefined();
      expect(SECONDARY_PROGRAMME_IDS).toEqual([]);
      expect(RESEARCH_PROGRAMME_IDS).toEqual(['auto_145']);
      expect(level.rules).toMatchObject({
        track: 'one_shot',
        washesMax: 1,
        mechanicalChecks: true,
      });
      // The benchmark dossier's provisional budget (section 4.4), and eight actions per item
      // on offer where that is more: the careful scripted loader makes up to 4.8 accepted
      // places per item it keeps, and the careless one goes on from the finished careful load.
      expect(level.rules.actionsMax).toBe(Math.max(400, 8 * level.items.length));
      // The manual describes the slot advice as it is given: the seat, not a drop from above,
      // as a list of places for the item in hand, and the geometry without one.
      expect(level.manual).toContain('in which a hand seats the item');
      expect(level.manual).toContain('most useful first and a screenful at a time');
      expect(level.manual).toContain('Without an item_id it gives the basket as geometry');
      expect(level.manual).not.toContain('upright above the gap');
      // Plain data: a level survives a JSON round trip.
      expect(JSON.parse(JSON.stringify(level))).toEqual(level);
    }
    expect(findLevel('no-such-level')).toBeUndefined();
    // Built once.
    expect(starterLevels()).toBe(levels);
  });

  it('the tutorial is a handful of items that fit; the others are of a size a person can play', () => {
    const tutorialEstimate = capacityEstimate(tutorial());
    expect(tutorial().items.length).toBeLessThanOrEqual(12);
    expect(tutorialEstimate.ratio).toBeLessThan(0.2);
    for (const level of starterLevels().slice(1)) {
      const estimate = capacityEstimate(level);
      // More room is asked for than the tutorial asks for, by this estimate too.
      expect(estimate.ratio, level.id).toBeGreaterThan(0.4);
      expect(estimate.availableArea).toBeCloseTo(0.525 * 0.512 + 0.5 * 0.498 - 0.23 * 0.128, 6);
      // The cutlery alone always fits its basket: the squeeze is in the racks.
      expect(estimate.cutlery).toBeLessThanOrEqual(estimate.cutleryCapacity);
      // benchmark.md section 5.7: 25 to 40 candidate items for a 20-minute level, cutlery
      // limited to about a dozen. The first build offered 57 to 136 with up to 54 of cutlery.
      // Whether a level offers more than fits is decided by its careful reference load
      // (`scripts/pack-levels.ts`, and the reference table of `@spotless/bench`), not here.
      // The course starts small: 37 to 39 pieces in its second and fourth level, 62 in its last.
      expect(level.items.length, level.id).toBeGreaterThanOrEqual(30);
      expect(level.items.length, level.id).toBeLessThanOrEqual(70);
      expect(estimate.cutlery, level.id).toBeLessThanOrEqual(20);
    }
  });

  it('the capacity estimate puts the rated 13 place settings just above 1', () => {
    // 13 each of dinner plates, soup plates, dessert plates, cups, saucers and glasses, with a
    // platter and two serving bowls (docs/research/standards.md section 5).
    const setting: [string, number][] = [
      ['dinner_plate_porcelain_iec', 13],
      ['soup_plate_porcelain_230', 13],
      ['dessert_plate_porcelain_190', 13],
      ['tea_cup_porcelain_210', 13],
      ['saucer_porcelain_140', 13],
      ['test_glass_borosilicate_250', 13],
      ['oval_platter_porcelain_320', 1],
      ['serving_bowl_vitrelle_216', 2],
    ];
    const items: LevelItem[] = setting.flatMap(([itemType, count]) =>
      Array.from({ length: count }, (_, i) => ({
        id: `${itemType}_${i}`,
        itemType,
        points: 1,
        soils: [],
      })),
    );
    const rated = capacityEstimate({ ...tutorial(), items });
    expect(rated.ratio).toBeGreaterThan(0.95);
    expect(rated.ratio).toBeLessThan(1.2);
    expect(Math.abs(rated.ratio - RATED_LOAD_RATIO)).toBeLessThan(0.1);
    expect(OVERFULL_RATIO).toBeGreaterThan(RATED_LOAD_RATIO);
    // A plate standing on edge takes its diameter times a tine pitch; cutlery takes nothing.
    expect(loadedFootprint('dinner_plate_porcelain_270')).toBeCloseTo(0.27 * 0.03, 4);
    expect(loadedFootprint('dinner_fork_185')).toBe(0);
  });

  it('give every item a soil that is described, and points on one scale', () => {
    for (const level of starterLevels()) {
      for (const item of level.items) {
        const type = getItemType(item.itemType);
        expect(type.flags.dishwasherSafe, `${level.id} ${item.id}`).toBe(true);
        expect(item.points).toBeGreaterThanOrEqual(2);
        expect(item.points).toBeLessThanOrEqual(40);
        expect(item.soils.length).toBeGreaterThanOrEqual(1);
        for (const soil of item.soils) {
          expect(soil.description?.length ?? 0, `${level.id} ${item.id}`).toBeGreaterThan(10);
          expect(soil.amountG).toBeGreaterThan(0);
          expect(soil.amountG).toBeLessThan(400);
          expect(soil.ageH).toBeGreaterThan(0);
          expect(getSoil(soil.type).heatHistories).toContain(soil.heatHistory);
        }
      }
      // Cutlery is cheap, cookware dear: leaving a pan out costs as much as several plates.
      const pointsOf = (tag: string): number[] =>
        level.items.filter((i) => getItemType(i.itemType).shapeTag === tag).map((i) => i.points);
      expect(Math.max(...pointsOf('cutlery'))).toBeLessThanOrEqual(3);
      if (level.id !== 'tutorial') {
        // A pan is worth about two plates, and what the meal was cooked in stays under three
        // tenths of the level's points: it is what does not fit, and a level whose points sat
        // on it would be decided by what is left on the counter (11 October 2026: the pans
        // and dishes of the second drawing were worth 18 to 34 each, three tenths of a level).
        const cooked = [...pointsOf('pan'), ...pointsOf('pot'), ...pointsOf('flat_dish')];
        expect(Math.max(...cooked), level.id).toBeGreaterThanOrEqual(14);
        expect(Math.max(...cooked), level.id).toBeLessThanOrEqual(20);
        expect(
          cooked.reduce((sum, points) => sum + points, 0) /
            level.items.reduce((sum, item) => sum + item.points, 0),
          level.id,
        ).toBeLessThan(0.3);
        // No single item dominates (benchmark.md 5.7, A8).
        const total = level.items.reduce((sum, item) => sum + item.points, 0);
        expect(Math.max(...level.items.map((item) => item.points)) / total).toBeLessThan(0.2);
      }
    }
  });

  it('keep the items the tests of the wash runner play the tutorial with', () => {
    // `@spotless/wash-runner` places bowl_01 (first soil yoghurt) and mug_01 (soil inside) of
    // the tutorial; the level may change around them.
    const level = tutorial();
    const bowl = level.items.find((item) => item.id === 'bowl_01');
    const mug = level.items.find((item) => item.id === 'mug_01');
    expect(bowl?.soils.map((soil) => soil.type)).toEqual(['yoghurt']);
    expect(mug?.soils[0]?.regions[0]?.region).toBe('interior');
    expect(level.items.some((item) => item.id === 'plate_01')).toBe(true);
  });

  it('work out the amount of a soil from its working loading and the area it covers', () => {
    const half = typicalAmountG('dinner_plate_porcelain_270', {
      type: 'tomato_sauce',
      regions: { well: 0.5 },
      ageH: 1,
    });
    const full = typicalAmountG('dinner_plate_porcelain_270', {
      type: 'tomato_sauce',
      regions: { well: 1 },
      ageH: 1,
    });
    expect(full).toBeCloseTo(2 * half, 1);
    // 150 g/m2 over a well of roughly 0.03 m2.
    expect(full).toBeGreaterThan(2);
    expect(full).toBeLessThan(8);
    // Three significant figures and no floor: a film of coffee in a mug is 0.15 g/m2 on
    // 120 cm2, a couple of milligrams. The first build wrote 0.01 g, nine times that.
    const coffee = typicalAmountG('mug_ceramic_300', {
      type: 'coffee',
      regions: { interior: 0.6 },
      ageH: 3,
    });
    const area = coveredAreaM2('mug_ceramic_300', { interior: 0.6 });
    expect(coffee).toBe(threeFigures(0.15 * area));
    expect(coffee).toBeLessThan(0.003);
    // A thin or a thick layer stays inside the range the soil's data allow (porridge: 300 to
    // 2000 g/m2 around a working 600).
    const bowl = { type: 'porridge', regions: { interior: 0.4 }, ageH: 4 };
    const usual = typicalAmountG('cereal_bowl_porcelain_160', bowl);
    expect(typicalAmountG('cereal_bowl_porcelain_160', bowl, 0.5)).toBeCloseTo(usual / 2, 2);
    expect(typicalAmountG('cereal_bowl_porcelain_160', bowl, 0.1)).toBeCloseTo(usual / 2, 2);
    expect(typicalAmountG('cereal_bowl_porcelain_160', bowl, 100)).toBeCloseTo(
      (usual * 2000) / 600,
      1,
    );
  });
});

describe('the soil records of the levels', () => {
  it('agree with the working quantities of their soils, in every level of the game', () => {
    expect(allLevels()).toHaveLength(7);
    for (const level of [...allLevels(), ...generatedLevels()]) {
      expect(levelSoilFindings(level), level.id).toEqual([]);
    }
  });

  it('are found wanting when an amount is outside the range of the soil on its area', () => {
    const level = tutorial();
    const plate = level.items[0] as LevelItem;
    const sauce = plate.soils[0] as LevelItem['soils'][number];
    const q = soilRecordQuantities(plate, sauce);
    // Half the well of a 27 cm plate, 150 g/m2 of sauce of which 30 % is dry matter.
    expect(q.coveredAreaM2 * 1e4).toBeGreaterThan(140);
    expect(q.coveredAreaM2 * 1e4).toBeLessThan(170);
    expect(q.loadingGPerM2).toBeCloseTo(150, 0);
    expect(q.dryGPerM2).toBeCloseTo(45, 0);
    expect(q.relative).toBeCloseTo(1, 2);
    const withSoil = (soil: LevelItem['soils'][number]): Level => ({
      ...level,
      items: [{ ...plate, soils: [soil] }, ...level.items.slice(1)],
    });
    // The first build's floor: 0.01 g of a stain that weighs 0.15 g/m2.
    const stain = withSoil({
      type: 'coffee',
      regions: [{ region: 'well', coverage: 0.2 }],
      amountG: 0.01,
      ageH: 3,
      heatHistory: 'none',
    });
    const found = levelSoilFindings(stain);
    expect(found).toHaveLength(1);
    expect(found[0]?.path).toBe('items.0.soils.0.amountG');
    expect(found[0]?.message).toMatch(/outside 0\.05 to 1 \(working 0\.15\)/);
    // Too little, and a region that is covered by nothing.
    expect(levelSoilFindings(withSoil({ ...sauce, amountG: sauce.amountG / 10 }))).toHaveLength(1);
  });

  it('are found wanting when the words say what the record does not', () => {
    const level = tutorial();
    const plate = level.items[0] as LevelItem;
    const sauce = plate.soils[0] as LevelItem['soils'][number];
    const says = (description: string, more: Partial<typeof sauce> = {}): string[] =>
      levelSoilFindings({
        ...level,
        items: [{ ...plate, soils: [{ ...sauce, ...more, description }] }, ...level.items.slice(1)],
      }).map((problem) => problem.path);
    expect(says('Tomato sauce, about 2 hours old')).toEqual([]);
    expect(says('Tomato sauce, about 6 hours old')).toEqual(['items.0.soils.0.description']);
    expect(says('Tomato sauce left overnight')).toEqual(['items.0.soils.0.description']);
    expect(says('Tomato sauce left overnight', { ageH: 11 })).toEqual([]);
    expect(says('Tomato sauce baked on')).toEqual(['items.0.soils.0.description']);
    expect(says('Tomato sauce baked on', { heatHistory: 'cooked' })).toEqual([]);
    expect(says('Tomato sauce since this morning')).toEqual(['items.0.soils.0.description']);
    expect(says("Yesterday's tomato sauce", { ageH: 26 })).toEqual([]);
  });

  it('carry no bleachable stain: the wash simulation does not settle its verdict', () => {
    expect(isUnsettledSoil('tea_tannin')).toBe(true);
    expect(isUnsettledSoil('coffee')).toBe(true);
    expect(isUnsettledSoil('red_wine')).toBe(true);
    expect(isUnsettledSoil('tomato_sauce')).toBe(false);
    expect(isUnsettledSoil('no_such_soil')).toBe(false);
    for (const level of allLevels()) expect(unsettledItems(level), level.id).toEqual([]);
    const level = tutorial();
    const mug = level.items.find((item) => item.id === 'mug_01') as LevelItem;
    const stained: Level = {
      ...level,
      items: level.items.map((item) =>
        item.id === 'mug_01'
          ? { ...mug, soils: [{ ...(mug.soils[0] as LevelItem['soils'][number]), type: 'coffee' }] }
          : item,
      ),
    };
    expect(unsettledItems(stained)).toEqual(['mug_01']);
  });
});

describe('soils whose verdict turns on the soak of Eco 50', () => {
  it('are the egg, meat, cheese and starch soils, and not what the table carries', () => {
    for (const id of ['egg_yolk_dried', 'egg_cooked', 'minced_meat', 'porridge', 'pasta_starch']) {
      expect(isSoakSensitiveSoil(id), id).toBe(true);
    }
    for (const id of ['tomato_sauce', 'avocado', 'yoghurt', 'milk_skin', 'gravy', 'jam']) {
      expect(isSoakSensitiveSoil(id), id).toBe(false);
    }
    expect(isSoakSensitiveSoil('no_such_soil')).toBe(false);
  });

  it('sit on the pans and dishes of a drawn level only, and on under three tenths of its points', () => {
    const drawn = LEVEL_FAMILIES.flatMap((family) =>
      Array.from({ length: 40 }, (_, seed) => generateLevel(family, seed)),
    );
    const onTheTable = (level: Level): LevelItem[] =>
      soakSensitiveItems(level)
        .map((id) => level.items.find((candidate) => candidate.id === id) as LevelItem)
        .filter(
          (item) =>
            !['cookware', 'bakeware', 'prep'].includes(getItemType(item.itemType).category),
        );
    for (const level of drawn) {
      expect(soakSensitiveShare(level), level.id).toBeLessThanOrEqual(SOAK_SENSITIVE_SHARE_MAX);
      // Nothing a person eats or drinks from, and no cutlery: what the meal was cooked in.
      expect(onTheTable(level).map((item) => item.id), level.id).toEqual([]);
    }
    // The course carries them on the table as well since the soak was calibrated on the
    // owner's first test wash, which was dried egg yolk on plates: they are the soils that sit
    // near the edge of clean when a piece is well placed and go over it when it is not. They
    // come in with the course (none in the tutorial, none on the table of the second level)
    // and stay under four tenths of a level's points on the table; the robustness study of
    // `@spotless/bench` washes such a level at both ends of the soak that calibration left.
    const course = allLevels();
    expect(soakSensitiveItems(course[0] as Level)).toEqual([]);
    expect(onTheTable(course[1] as Level)).toEqual([]);
    for (const level of course) {
      const total = level.items.reduce((sum, item) => sum + item.points, 0);
      const share = onTheTable(level).reduce((sum, item) => sum + item.points, 0) / total;
      expect(share, level.id).toBeLessThanOrEqual(SOAK_SENSITIVE_TABLE_SHARE_MAX);
      expect(soakSensitiveShare(level), level.id).toBeLessThanOrEqual(0.6);
    }
    // Every level but the tutorial has such a piece: egg, meat and starch are in every kitchen.
    for (const level of course.filter((candidate) => candidate.id !== 'tutorial')) {
      expect(soakSensitiveItems(level).length, level.id).toBeGreaterThanOrEqual(1);
    }
    // The share is of the points: a level with one such pan of 20 points in 80 has a quarter.
    const tutorialLevel = tutorial();
    const pan: LevelItem = {
      id: 'pan_01',
      itemType: 'saucepan_steel_170',
      points: 16,
      soils: [
        {
          type: 'porridge',
          regions: [{ region: 'interior_wall', coverage: 0.5 }],
          amountG: 14.8,
          ageH: 2,
          heatHistory: 'none',
        },
      ],
    };
    const withPan: Level = { ...tutorialLevel, items: [...tutorialLevel.items, pan] };
    expect(soakSensitiveItems(tutorialLevel)).toEqual([]);
    expect(soakSensitiveShare(tutorialLevel)).toBe(0);
    expect(soakSensitiveItems(withPan)).toEqual(['pan_01']);
    expect(soakSensitiveShare(withPan)).toBeCloseTo(16 / 80, 12);
  });
});

describe('the level generator', () => {
  it('draws the same level from the same family and seed, and another from another seed', () => {
    for (const family of LEVEL_FAMILIES) {
      const a = generateLevel(family, 7);
      expect(generateLevel(family, 7)).toEqual(a);
      const b = generateLevel(family, 8);
      expect(b).not.toEqual(a);
      expect(a.id).toBe(`${family.id}-7`);
      expect(a.family).toEqual({ id: family.id, seed: 7 });
      expect(a.seed).not.toBe(b.seed);
      expect(a.seed).toBe(generatedWashSeed(family.id, 7));
    }
    expect(() => generateLevel(PASTA_SUPPER, -1)).toThrow(RangeError);
    expect(() => generateLevel(PASTA_SUPPER, 1.5)).toThrow(RangeError);
  });

  it('draws valid levels with sound soil records over many seeds of every family', () => {
    for (const family of LEVEL_FAMILIES) {
      const sizes: number[] = [];
      const types = new Set<string>();
      for (let seed = 0; seed < 40; seed++) {
        const level = generateLevel(family, seed);
        expect(validateLevel(level), level.id).toEqual([]);
        expect(levelSoilFindings(level), level.id).toEqual([]);
        expect(unsettledItems(level), level.id).toEqual([]);
        expect(level.programmeId).toBe('eco_50');
        expect(level.rules.actionsMax).toBe(Math.max(400, 8 * level.items.length));
        // The words on the card are the catalogue's for the record: they cannot disagree.
        for (const item of level.items) {
          for (const soil of item.soils) expect(soil.description).toBeTruthy();
          expect(getItemType(item.itemType).flags.dishwasherSafe, item.itemType).toBe(true);
          types.add(item.itemType);
        }
        // A level of a size a person can play, with cutlery limited (benchmark.md 5.7).
        const cutlery = level.items.filter(
          (item) => getItemType(item.itemType).shapeTag === 'cutlery',
        ).length;
        expect(level.items.length, level.id).toBeGreaterThanOrEqual(30);
        expect(level.items.length, level.id).toBeLessThanOrEqual(65);
        expect(cutlery, level.id).toBeLessThanOrEqual(20);
        // No single item dominates (A8).
        const total = level.items.reduce((sum, item) => sum + item.points, 0);
        expect(Math.max(...level.items.map((item) => item.points)) / total).toBeLessThan(0.2);
        sizes.push(level.items.length);
      }
      // The seed changes what is on the counter, not only how much of it is covered.
      expect(new Set(sizes).size, family.id).toBeGreaterThan(5);
      const alternatives = new Set(family.groups.flatMap((group) => group.itemTypes));
      expect(types.size, family.id).toBeGreaterThan(alternatives.size * 0.8);
    }
  });

  it('keeps every drawn number inside the range its family gives', () => {
    const family = COOKED_BREAKFAST;
    for (let seed = 0; seed < 25; seed++) {
      const level = generateLevel(family, seed);
      for (const group of family.groups) {
        const items = level.items.filter((item) => item.id.startsWith(`${group.prefix}_`));
        if (items.length === 0) {
          // Only a group that may be absent is absent.
          expect(group.chance ?? 1, `${group.prefix} seed ${seed}`).toBeLessThan(1);
          continue;
        }
        expect(group.itemTypes).toContain(items[0]?.itemType);
        expect(new Set(items.map((item) => item.itemType)).size).toBe(1);
        for (const item of items) {
          expect(item.points).toBeGreaterThanOrEqual(group.points[0]);
          expect(item.points).toBeLessThanOrEqual(group.points[1]);
          item.soils.forEach((soil, k) => {
            const spec = group.soils[k];
            expect(soil.type).toBe(spec?.type);
            for (const region of soil.regions) {
              const range = spec?.regions[region.region] as readonly [number, number];
              expect(region.coverage).toBeGreaterThanOrEqual(range[0] - 0.026);
              expect(region.coverage).toBeLessThanOrEqual(range[1] + 0.026);
            }
            const relative = soilRecordQuantities(item, soil).relative;
            const [lo, hi] = spec?.relative ?? [0.8, 1.25];
            expect(relative, `${item.id} ${soil.type}`).toBeGreaterThanOrEqual(lo * 0.99);
            expect(relative, `${item.id} ${soil.type}`).toBeLessThanOrEqual(hi * 1.01);
          });
        }
      }
    }
  });

  it('gives the generated set: two seeds of each of three families, outside the course', () => {
    const generated = generatedLevels();
    expect(generated.map((level) => level.id)).toEqual([
      'pasta-supper-1',
      'pasta-supper-2',
      'roast-lunch-1',
      'roast-lunch-2',
      'cooked-breakfast-1',
      'cooked-breakfast-2',
    ]);
    expect(GENERATED_SEEDS).toEqual([1, 2]);
    expect(new Set(generated.map((level) => level.family?.id)).size).toBe(3);
    // The game lists the course and nothing else: a drawn level is listed only once its
    // reference loads pass the gates on the calibrated wash, and none has been washed on it.
    expect(allLevels().map((level) => level.id)).toEqual(STARTER_LEVEL_IDS);
    expect(findLevel('roast-lunch-2')).toBeUndefined();
    for (const level of generated) {
      expect(validateLevel(level), level.id).toEqual([]);
      expect(level.secondaryProgrammes, level.id).toBeUndefined();
      expect(level.number, level.id).toBeUndefined();
    }
    expect(familyOf(generated[0] as Level)).toBe(PASTA_SUPPER);
    expect(familyOf(tutorial())).toBeUndefined();
    expect(listLevels().map((l) => [l.id, l.items])).toEqual(
      allLevels().map((l) => [l.id, l.items.length]),
    );
    // Built once.
    expect(generatedLevels()).toBe(generated);
  });
});

describe('the course', () => {
  const course = allLevels();

  it('lists the levels in the order they are played, numbered from 1, the tutorial first', () => {
    expect(course.map((level) => level.id)).toEqual([
      'tutorial',
      'lunch-for-four',
      'weeknight-dinner',
      'breakfast',
      'mixed-family',
      'baking-day',
      'dinner-party',
    ]);
    expect(COURSE_LEVEL_IDS).toEqual(course.map((level) => level.id));
    expect(course.map((level) => level.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(new Set(course.map((level) => level.title)).size).toBe(course.length);
    // The list for menus is the course, with what the server's list and the page show.
    expect(listLevels()).toEqual(
      course.map((level) => ({
        number: level.number,
        id: level.id,
        title: level.title,
        summary: level.summary,
        difficulty: level.difficulty,
        newHere: level.newHere,
        items: level.items.length,
      })),
    );
  });

  it('gives every level a difficulty from 1 to 10 that rises with every level', () => {
    const weights = Object.values(DIFFICULTY_WEIGHTS);
    expect(weights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 12);
    let before = 0;
    for (const level of course) {
      // The field is the measure, worked out from the level's own pieces, soils and points.
      const measured = levelDifficulty(level);
      expect(level.difficulty, level.id).toBe(measured.difficulty);
      expect(typeof level.difficulty, level.id).toBe('number');
      expect(level.difficulty as number, level.id).toBeGreaterThanOrEqual(1);
      expect(level.difficulty as number, level.id).toBeLessThanOrEqual(10);
      expect(Math.round((level.difficulty as number) * 10), level.id).toBeCloseTo(
        (level.difficulty as number) * 10,
        9,
      );
      for (const part of [
        measured.choice,
        measured.punishing,
        measured.tenacity,
        measured.awkward,
      ]) {
        expect(part).toBeGreaterThanOrEqual(0);
        expect(part).toBeLessThanOrEqual(1);
      }
      // Harder than the level before it, by a step that shows at one decimal.
      expect(level.difficulty as number, `${level.id} after ${before}`).toBeGreaterThan(before);
      before = level.difficulty as number;
    }
    // The tutorial has nothing to choose: everything fits.
    expect(levelDifficulty(course[0] as Level).choice).toBe(0);
    expect((course[0] as Level).difficulty as number).toBeLessThan(3);
    expect((course[course.length - 1] as Level).difficulty as number).toBeGreaterThan(7);
  });

  it('measures what a player would recognise', () => {
    const level = tutorial();
    const base = levelDifficulty(level);
    const glass = level.items.find((item) => item.id === 'glass_01') as LevelItem;
    const smoothie = glass.soils[0] as LevelItem['soils'][number];
    // The same soil left overnight clings harder, and never less.
    const overnight: Level = {
      ...level,
      items: level.items.map((item) => ({
        ...item,
        soils: item.soils.map((soil) => ({ ...soil, ageH: 12 })),
      })),
    };
    expect(levelDifficulty(overnight).meanTenacity).toBeGreaterThan(base.meanTenacity);
    expect(levelDifficulty(overnight).difficulty).toBeGreaterThan(base.difficulty);
    // A film of milk in the glasses forgives a glass left mouth up; the smoothie does not.
    const milk: Level = {
      ...level,
      items: level.items.map((item) =>
        item.id.startsWith('glass')
          ? { ...item, soils: [{ ...smoothie, type: 'milk_film' }] }
          : item,
      ),
    };
    expect(itemTenacity(glass)).toBeGreaterThanOrEqual(4);
    expect(levelDifficulty(milk).punishingShare).toBeLessThan(base.punishingShare);
    // A pan on the counter is an awkward piece, and with enough of them a choice.
    const pan: LevelItem = {
      id: 'pan_01',
      itemType: 'saucepan_steel_170',
      points: 16,
      soils: [],
    };
    const withPans: Level = {
      ...level,
      items: [
        ...level.items,
        ...Array.from({ length: 8 }, (_, i) => ({ ...pan, id: `pan_${i}` })),
      ],
    };
    expect(levelDifficulty(withPans).awkwardShare).toBeGreaterThan(base.awkwardShare);
    expect(levelDifficulty(withPans).choice).toBeGreaterThan(0);
  });

  it('says in one line what each level adds, as the last sentence of its summary', () => {
    for (const level of course) {
      expect(level.newHere?.length ?? 0, level.id).toBeGreaterThan(20);
      expect(level.summary.endsWith(level.newHere as string), level.id).toBe(true);
      // One line, and what it names is on the counter: no advice on where to put anything.
      expect(level.newHere, level.id).not.toMatch(/\n/);
      expect(level.newHere, level.id).not.toMatch(
        /\b(mouth down|face(s|d|ing)? (the|to)|upper basket|lower basket|should|never|always)\b/i,
      );
    }
    for (const level of course.slice(1)) expect(level.newHere, level.id).toMatch(/^New: /);
    expect(new Set(course.map((level) => level.newHere)).size).toBe(course.length);
  });

  it('names Eco 50 and no other programme in every text a player reads', () => {
    expect(INTERFACE_MANUAL).not.toMatch(/secondary|auto|uncalibrated/i);
    expect(INTERFACE_MANUAL).toMatch(/Washing\. start_cycle pushes the baskets in/);
    for (const level of course) {
      expect(level.manual, level.id).toBe(INTERFACE_MANUAL);
      const card = levelCard(level);
      expect(card.programme.display_name, level.id).toBe('Eco 50');
      expect(card.secondary_programmes, level.id).toEqual([]);
      const read = [card.title, card.summary, card.manual, card.programme.note, card.rules.scoring]
        .concat(card.items.flatMap((item) => item.soils.map((soil) => soil.description)))
        .join('\n');
      expect(read, level.id).not.toMatch(/\bauto\b|auto_145|45-65|secondary programme/i);
    }
  });
});

describe('levelCard', () => {
  it('describes machine, programme, items and rules, and nothing about the outcome', () => {
    const level = findLevel('weeknight-dinner') as Level;
    const card = levelCard(level);
    expect(card).toMatchObject({
      benchmark_version: BENCHMARK_VERSION,
      level_id: 'weeknight-dinner',
      title: 'Weeknight dinner',
    });
    expect(card.benchmark_version).toMatch(/^spotless-\d+\.\d+\.\d+\/levels-/);
    expect(JSON.parse(JSON.stringify(card))).toEqual(card);

    // Machine: what a manual and an open door show.
    expect(card.machine.machine_id).toBe('bosch_smv4hax40g');
    expect(card.machine.tub_max_mm[2] - card.machine.tub_min_mm[2]).toBe(640);
    expect(card.machine.racks.map((r) => r.rack)).toEqual([
      'lower_rack',
      'cutlery_basket',
      'upper_rack',
    ]);
    const lower = card.machine.racks[0];
    expect(lower?.envelope_mm.slice(0, 2)).toEqual([525, 512]);
    expect(lower?.origin_in_mm).toEqual([-262.5, -262, 73]);
    expect(lower?.origin_out_mm).toEqual([-262.5, -762, 73]);
    expect(lower?.options.map((o) => o.name)).toEqual(['position', 'tine_row_r1', 'tine_row_r2']);
    const upper = card.machine.racks[2];
    expect(upper?.options.find((o) => o.name === 'height')?.values).toEqual(['1', '2', '3']);
    expect(card.machine.spray_arms.map((a) => a.arm)).toEqual(['lower_arm', 'upper_arm']);
    expect(card.machine.spray_arms[0]?.radius_mm).toBeGreaterThan(200);
    expect(card.machine.dispenser).not.toBeNull();

    // Programme: Eco 50 as printed, 4 h 55 min with a wash at 50 degrees, and the owner's
    // capsule in the dispenser.
    expect(card.programme.programme_id).toBe('eco_50');
    expect(card.programme.display_name).toBe('Eco 50');
    expect(card.programme.status).toBe('scored');
    expect(card.programme.note).toBe(SCORED_PROGRAMME_NOTE);
    const phases = card.programme.phases;
    expect(phases.map((p) => p.name)).toEqual([
      'pre_rinse',
      'main_wash',
      'intermediate_rinse',
      'final_rinse',
      'drying',
    ]);
    expect(phases.find((p) => p.name === 'main_wash')?.temperature_c).toBe(50);
    expect(phases.find((p) => p.name === 'pre_rinse')?.temperature_c).toBeNull();
    const total = phases.reduce((sum, p) => sum + p.duration_s, 0);
    expect(Math.abs(total - (4 * 3600 + 55 * 60))).toBeLessThan(300);
    expect(card.programme.detergent).toEqual({
      type: 'finish_powerball_ultimate',
      dose_g: 12.9,
      name: 'Finish Powerball Ultimate',
    });
    // No other programme is offered: the card lists none, and no text on it names one.
    expect(card.secondary_programmes).toEqual([]);
    const words = JSON.stringify(card);
    expect(words).not.toMatch(/auto_145|Auto 45|secondary programme|uncalibrated/i);
    // A research level may still name one, and its card then says what that means.
    const research = levelCard({ ...level, secondaryProgrammes: ['auto_145'] });
    expect(research.secondary_programmes).toHaveLength(1);
    const auto = research.secondary_programmes[0];
    expect(auto?.programme_id).toBe('auto_145');
    expect(auto?.status).toBe('uncalibrated');
    expect(auto?.note).toBe(UNCALIBRATED_PROGRAMME_NOTE);
    expect(auto?.note).toMatch(/provisional/);
    expect(auto?.phases.find((p) => p.name === 'main_wash')?.temperature_c).toBe(65);
    expect(auto?.detergent).toEqual(card.programme.detergent);

    // The tray that catches the tablet is on the card of the basket that carries it, in that
    // basket's frame: the guidance tells every player to keep it free, and an open door shows
    // where it is.
    // (Centred 2 mm right of the arm axis since IMG_9131, 246 mm in the basket's frame; it
    // was drawn 4 mm further right, 142.5 to 357.5, from the dossier's +6.)
    const upperCard = card.machine.racks.find((rack) => rack.rack === 'upper_rack');
    expect(upperCard?.tablet_tray).toEqual({ min_mm: [138.5, 0, 8], max_mm: [353.5, 52, 55] });
    expect(
      card.machine.racks.find((rack) => rack.rack === 'lower_rack')?.tablet_tray,
    ).toBeUndefined();

    // Items: sorted, with what a person handling them would know.
    expect(card.items.map((i) => i.item_id)).toEqual([...card.items.map((i) => i.item_id)].sort());
    expect(card.items).toHaveLength(level.items.length);
    const dish = card.items.find((i) => i.item_id === 'oven_dish_01');
    expect(dish).toMatchObject({ class: 'oven_dish', points: 18, material: 'glass_soda_lime' });
    expect(dish?.bbox_mm[0]).toBeCloseTo(401, 0);
    expect(dish?.mass_kg).toBeGreaterThan(1);
    expect(dish?.orientation_presets.map((p) => p.name)).toContain('on_long_edge');
    expect(dish?.orientation_presets[0]?.quat_wxyz).toEqual([1, 0, 0, 0]);
    expect(dish?.soils[0]).toMatchObject({ type: 'cheese_baked', heat_history: 'baked', age_h: 2 });
    expect(dish?.soils[0]?.description).toMatch(/Baked-on cheese/);
    expect(dish?.soils[0]?.regions).toEqual([
      { region: 'interior', coverage: 0.35 },
      { region: 'flange', coverage: 0.3 },
    ]);
    expect(dish?.thumbnails).toBeUndefined();

    // Rules.
    expect(card.rules.budgets).toEqual({
      actions_max: level.rules.actionsMax,
      queries_max: level.rules.queriesMax,
      washes_max: 1,
    });
    expect(card.rules.clean_definition).toMatch(/4 square millimetres/);
    expect(card.rules.scoring).toMatch(/clean scores its points/);
    expect(card.manual).toMatch(/Frames\./);

    // Nothing hidden leaks: no field carries a seed, a difficulty rank, a constant of the soil
    // model or an outcome.
    const keys = new Set<string>();
    const collect = (value: unknown): void => {
      if (Array.isArray(value)) value.forEach(collect);
      else if (typeof value === 'object' && value !== null) {
        for (const [key, inner] of Object.entries(value)) {
          keys.add(key.toLowerCase());
          collect(inner);
        }
      }
    };
    collect(card);
    for (const key of keys) {
      if (key === 'class') continue;
      expect(key).not.toMatch(
        /seed|difficulty|rank|adhesion|kinetic|class|residue|expected|score|standard/,
      );
    }
    expect(keys.has('class')).toBe(true);
    expect(card.items.every((i) => !('soil_class' in i))).toBe(true);
    expect(Object.keys(card.items[0]?.soils[0] ?? {}).sort()).toEqual([
      'age_h',
      'amount_g',
      'description',
      'heat_history',
      'regions',
      'type',
    ]);
  });

  it("describes a soil in the catalogue's words when the level gives none", () => {
    const level: Level = {
      ...tutorial(),
      items: [
        {
          id: 'bowl_01',
          itemType: 'cereal_bowl_porcelain_160',
          points: 5,
          soils: [
            {
              type: 'porridge',
              regions: [{ region: 'interior', coverage: 0.5 }],
              amountG: 12,
              ageH: 12,
              heatHistory: 'warm',
            },
          ],
        },
      ],
    };
    expect(validateLevel(level)).toEqual([]);
    const soil = levelCard(level).items[0]?.soils[0];
    expect(soil?.description).toMatch(/orridge/);
    expect(soil?.description).toMatch(/about 12 hours/);
    expect(soil?.amount_g).toBe(12);
  });

  it("follows the level's starting configuration", () => {
    const level: Level = {
      ...tutorial(),
      config: { ...BOSCH_SMV4HAX40G.defaultConfig, basketHeights: { upper: '3' } },
    };
    expect(validateLevel(level)).toEqual([]);
    const upper = levelCard(level).machine.racks.find((r) => r.rack === 'upper_rack');
    expect(upper?.origin_in_mm[2]).toBe(370);
  });
});

describe('validateLevel', () => {
  const broken = (change: (level: Level) => Level): string[] =>
    validateLevel(change(tutorial())).map((p) => p.path);
  const withItem = (item: Partial<LevelItem>): Level => {
    const base = tutorial();
    return {
      ...base,
      items: [{ ...(base.items[0] as LevelItem), ...item }, ...base.items.slice(1)],
    };
  };
  const withSoil = (soil: Partial<LevelItem['soils'][number]>): Level => {
    const first = tutorial().items[0] as LevelItem;
    return withItem({ soils: [{ ...(first.soils[0] as LevelItem['soils'][number]), ...soil }] });
  };

  it('reports what is wrong with the level itself', () => {
    expect(broken((l) => ({ ...l, id: 'Not An Id' }))).toEqual(['id']);
    expect(broken((l) => ({ ...l, title: ' ' }))).toEqual(['title']);
    expect(broken((l) => ({ ...l, machineId: 'miele_g7000' }))).toEqual(['machineId']);
    expect(broken((l) => ({ ...l, programmeId: 'turbo' }))).toEqual(['programmeId']);
    expect(broken((l) => ({ ...l, seed: -1 }))).toEqual(['seed']);
    expect(broken((l) => ({ ...l, seed: 1.5 }))).toEqual(['seed']);
    expect(broken((l) => ({ ...l, items: [] }))).toEqual(['items']);
    expect(
      broken((l) => ({
        ...l,
        rules: { ...l.rules, actionsMax: 0, queriesMax: 2.5, washesMax: -1 },
      })),
    ).toEqual(['rules.actionsMax', 'rules.queriesMax', 'rules.washesMax']);
    expect(broken((l) => ({ ...l, rules: { ...l.rules, track: 'speedrun' as never } }))).toEqual([
      'rules.track',
    ]);
    expect(broken((l) => ({ ...l, racks: { third_rack: 'out' } }))).toEqual(['racks.third_rack']);
    expect(broken((l) => ({ ...l, racks: { cutlery_basket: 'out' } }))).toEqual([
      'racks.cutlery_basket',
    ]);
    expect(broken((l) => ({ ...l, racks: { upper_rack: 'ajar' as never } }))).toEqual([
      'racks.upper_rack',
    ]);
    expect(broken((l) => ({ ...l, racks: { upper_rack: 'out', lower_rack: 'in' } }))).toEqual([]);
    expect(
      broken((l) => ({
        ...l,
        config: { ...BOSCH_SMV4HAX40G.defaultConfig, basketHeights: { upper: '7' } },
      })),
    ).toEqual(['config.basketHeights.upper']);
  });

  it('reports what is wrong with an item or a soil', () => {
    expect(validateLevel(withItem({ itemType: 'kettle' })).map((p) => p.path)).toEqual([
      'items.0.itemType',
    ]);
    expect(validateLevel(withItem({ points: 0 })).map((p) => p.path)).toEqual(['items.0.points']);
    expect(validateLevel(withItem({ points: 2.5 })).map((p) => p.path)).toEqual(['items.0.points']);
    expect(validateLevel(withItem({ id: 'plate_02' })).map((p) => p.path)).toEqual(['items.1.id']);
    expect(validateLevel(withItem({ id: 'Plate 1' })).map((p) => p.path)).toEqual(['items.0.id']);
    // A part of the machine or the floor would collide with a body of the loading world.
    for (const id of ['lower_rack', 'cutlery_basket', 'tub', 'upper_arm', 'kitchen_floor']) {
      expect(
        validateLevel(withItem({ id })).map((p) => p.path),
        id,
      ).toEqual(['items.0.id']);
    }
    expect(validateLevel(withSoil({ type: 'glitter' })).map((p) => p.path)).toEqual([
      'items.0.soils.0.type',
    ]);
    // Tomato sauce is never burnt in the catalogue.
    const burnt = validateLevel(withSoil({ heatHistory: 'burnt' }));
    expect(burnt.map((p) => p.path)).toEqual(['items.0.soils.0.heatHistory']);
    expect(burnt[0]?.message).toMatch(/none, warm, cooked/);
    expect(validateLevel(withSoil({ heatHistory: 'fried' as never })).map((p) => p.path)).toEqual([
      'items.0.soils.0.heatHistory',
    ]);
    expect(validateLevel(withSoil({ amountG: 0 })).map((p) => p.path)).toEqual([
      'items.0.soils.0.amountG',
    ]);
    expect(validateLevel(withSoil({ ageH: -1 })).map((p) => p.path)).toEqual([
      'items.0.soils.0.ageH',
    ]);
    expect(validateLevel(withSoil({ description: '' })).map((p) => p.path)).toEqual([
      'items.0.soils.0.description',
    ]);
    expect(validateLevel(withSoil({ regions: [] })).map((p) => p.path)).toEqual([
      'items.0.soils.0.regions',
    ]);
    // A plate has no handle.
    const handle = validateLevel(withSoil({ regions: [{ region: 'handle', coverage: 0.5 }] }));
    expect(handle.map((p) => p.path)).toEqual(['items.0.soils.0.regions.0']);
    expect(handle[0]?.message).toMatch(/rim, well, underside/);
    expect(
      validateLevel(withSoil({ regions: [{ region: 'well', coverage: 1.2 }] })).map((p) => p.path),
    ).toEqual(['items.0.soils.0.regions.0']);
    expect(
      validateLevel(
        withSoil({
          regions: [
            { region: 'well', coverage: 0.2 },
            { region: 'well', coverage: 0.3 },
          ],
        }),
      ).map((p) => p.path),
    ).toEqual(['items.0.soils.0.regions.1']);
  });
});

describe('rackOptions', () => {
  it("lists what the owner's machine can adjust, with the current values", () => {
    const options = rackOptions(BOSCH_SMV4HAX40G, BOSCH_SMV4HAX40G.defaultConfig);
    expect(options.map((o) => `${o.rack}.${o.name}=${o.value}`)).toEqual([
      'lower_rack.tine_row_r1=up',
      'lower_rack.tine_row_r2=up',
      'upper_rack.height=1',
      'upper_rack.tine_row_c_rear=up',
      'upper_rack.tine_row_c_front=up',
      'upper_rack.shelf_cup_front=up',
      'upper_rack.shelf_cup_rear=up',
      'upper_rack.shelf_knife_shelf=down',
      // The loose cutlery basket: where it stands (the machine's named places, or out).
      'cutlery_basket.position=front_centre',
    ]);
    expect(options.find((o) => o.name === 'height')?.description).toMatch(/420 mm.*395 mm.*370 mm/);
    const cutlery = options.find((o) => o.rack === 'cutlery_basket');
    expect(cutlery?.values).toEqual(['front_centre', 'front_right', 'front_left', 'out']);
    expect(cutlery?.description).toMatch(/front_right.*x 373 mm, y 123 mm/);
  });

  it('stands the cutlery basket elsewhere, takes it out and puts it back', () => {
    const spec = BOSCH_SMV4HAX40G;
    const option = (config: typeof spec.defaultConfig) =>
      rackOptions(spec, config).find((o) => o.rack === 'cutlery_basket') as NonNullable<
        ReturnType<typeof rackOptions>[number]
      >;
    const right = applyRackOption(spec.defaultConfig, option(spec.defaultConfig), 'front_right');
    expect(right.cutleryBasket?.centre[0]).toBeCloseTo(0.3725, 6);
    expect(option(right).value).toBe('front_right');
    // The geometry follows: the basket's part stands 102 mm further right.
    const before = buildMachineGeometry(spec).parts.find((p) => p.id === 'cutlery_basket');
    const after = buildMachineGeometry(spec, right).parts.find((p) => p.id === 'cutlery_basket');
    expect(((after?.pose.p[0] ?? 0) - (before?.pose.p[0] ?? 0)) * 1000).toBeCloseTo(102, 6);
    const out = applyRackOption(right, option(right), 'out');
    expect(out.cutleryBasket).toBeNull();
    expect(option(out).value).toBe('out');
    expect(buildMachineGeometry(spec, out).parts.some((p) => p.id === 'cutlery_basket')).toBe(
      false,
    );
    const back = applyRackOption(out, option(out), 'front_left');
    expect(option(back).value).toBe('front_left');
    expect(() => applyRackOption(back, option(back), 'rear')).toThrow(RangeError);
  });

  it('gives the level card the height clear over each basket and the discs under which it is less', () => {
    const card = levelCard(starterLevels()[0] as Level);
    const lower = card.machine.racks.find((r) => r.rack === 'lower_rack');
    const upper = card.machine.racks.find((r) => r.rack === 'upper_rack');
    // Lower basket: 340 mm to the floor of the upper basket at its top position; the upper
    // arm sweeps a circle of 230 mm radius 313 mm up, its hub hangs to 292 mm.
    expect(lower?.envelope_mm[2]).toBe(340);
    expect(lower?.low_spots?.map((s) => [s.under, s.clear_height_mm, s.radius_mm])).toEqual([
      ['upper_arm.hub', 292, 24.5],
      ['upper_arm.blades', 313, 230.2],
    ]);
    // Upper basket: 220 mm to the roof (the owner's tape), 190 mm under the roof sprayer.
    expect(upper?.envelope_mm[2]).toBe(220);
    expect(upper?.low_spots).toEqual([
      { under: 'roof_sprayer', clear_height_mm: 190, centre_mm: [244, 278], radius_mm: 26 },
    ]);
    // The cutlery basket is listed after the basket it stands in, with its one option.
    const racks = card.machine.racks.map((r) => r.rack);
    expect(racks).toEqual(['lower_rack', 'cutlery_basket', 'upper_rack']);
    const cutlery = card.machine.racks.find((r) => r.rack === 'cutlery_basket');
    expect(cutlery?.options.map((o) => o.name)).toEqual(['position']);
    expect(lower?.options.map((o) => o.name)).toEqual(['position', 'tine_row_r1', 'tine_row_r2']);
  });

  it('applies an option to a configuration the geometry accepts', () => {
    let config = BOSCH_SMV4HAX40G.defaultConfig;
    const set = (name: string, value: string): void => {
      const option = rackOptions(BOSCH_SMV4HAX40G, config).find((o) => o.name === name);
      expect(option).toBeDefined();
      if (option !== undefined) config = applyRackOption(config, option, value);
    };
    set('height', '3');
    set('tine_row_r1', 'folded');
    set('tine_row_r2', 'folded');
    set('tine_row_r1', 'up');
    set('shelf_cup_front', 'down');
    set('shelf_knife_shelf', 'up');
    const values = Object.fromEntries(
      rackOptions(BOSCH_SMV4HAX40G, config).map((o) => [o.name, o.value]),
    );
    expect(values).toMatchObject({
      height: '3',
      tine_row_r1: 'up',
      tine_row_r2: 'folded',
      shelf_cup_front: 'down',
      shelf_knife_shelf: 'up',
      shelf_cup_rear: 'up',
    });
    const geometry = buildMachineGeometry(BOSCH_SMV4HAX40G, config);
    expect(geometry.config.basketHeights).toEqual({ upper: '3' });
    expect(geometry.affordances.tineRows.find((r) => r.rowId === 'r2')?.state).toBe('folded');
    const height = rackOptions(BOSCH_SMV4HAX40G, config).find((o) => o.name === 'height');
    expect(() => applyRackOption(config, height as NonNullable<typeof height>, '9')).toThrow(
      RangeError,
    );
  });
});
