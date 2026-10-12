/**
 * Groups E, F and G of the checklist (docs/research/standards.md sections 9.6 to 9.8):
 * soil-specific behaviour (P30 to P35), drainage, pooling and drying (P36 to P43), and the
 * system-level consistency checks (P44 to P48), on the owner's Bosch SMV4HAX40G.
 */

import { control, direction, outside, quantity, scoreChange, within } from './bands.ts';
import { band, byId, byPrefix, egg, margarine, milk, oats } from './kit.ts';
import { tilted } from './loads.ts';
import { ECO_PROGRAMME, OWNER_PROGRAMME } from './programmes.ts';
import {
  check,
  difference,
  film,
  futureField,
  meanOver,
  meanScore,
  pooled,
  ratio,
  regionResidual,
  residualFraction,
  score,
  single,
  spread,
} from './measures.ts';
import { classMean } from './scenarios-b.ts';
import type { CaseRun, CaseSpec, LoadItem, Scenario } from './types.ts';

const ids = (prefix: string, count: number): string[] =>
  Array.from({ length: count }, (_unused, i) => `${prefix}_${i + 1}`);

const DEG = Math.PI / 180;

const IEC = 'loader:iec-13-careful';

const isCutlery = (typeId: string): boolean => /fork|knife|spoon|ladle/.test(typeId);
const isGlass = (typeId: string): boolean => /glass/.test(typeId);
const isMelamine = (typeId: string): boolean => /melamine/.test(typeId);
const isCrockery = (typeId: string): boolean =>
  !isCutlery(typeId) && !isGlass(typeId) && !isMelamine(typeId);

/** The plate of `plate-facing` with oven-dried egg yolk on its eating face. */
const EGG_PLATE: Pick<CaseSpec, 'load' | 'soils' | 'surfaces'> = {
  load: 'plate-facing',
  soils: byId({ plate: [egg('well')] }),
  surfaces: [{ item: 'plate', regions: ['well'] }],
};

/** The mug of `mug-on-shelf` tilted about a horizontal axis, standing on the same support. */
const tiltMug =
  (degrees: number) =>
  (items: readonly LoadItem[]): readonly LoadItem[] =>
    items.map((item) => (item.itemId === 'mug' ? tilted(item, degrees * DEG, [0, 1, 0]) : item));

const MUG_CASE = (label: string, degrees: number): CaseSpec => ({
  label,
  what: degrees === 0 ? 'level, as it settled on the shelf' : `tilted ${degrees} degrees`,
  load: 'mug-on-shelf',
  ...(degrees === 0 ? {} : { edit: tiltMug(degrees) }),
  soils: () => [],
  surfaces: [{ item: 'mug', regions: ['foot'] }],
});

/**
 * The base recess of the catalogue's ceramic mug: the dish inside its foot ring (ring of 30 mm
 * mean radius, 4 mm wide and 2.5 mm high), and the checklist's formulas for it, in mL: full
 * when level, pi R^2 h; the wedge left at a tilt, (8/15) sqrt(2R) h^2.5 / tan^1.5(theta).
 */
const RECESS = { radius_mm: 28, depth_mm: 2.5 };
const recessLevel_mL = (Math.PI * RECESS.radius_mm ** 2 * RECESS.depth_mm) / 1000;
const recessWedge_mL = (degrees: number): number =>
  ((8 / 15) * Math.sqrt(2 * RECESS.radius_mm) * RECESS.depth_mm ** 2.5) /
  Math.tan(degrees * DEG) ** 1.5 /
  1000;
const wedgeShare = (degrees: number): number => recessWedge_mL(degrees) / recessLevel_mL;

/** Film water per area of an item at the end of the last rinse, g/m2. */
const filmPerArea = (run: CaseRun, itemId: string): number => {
  const area = run.exposure(itemId).area_cm2 / 1e4;
  return area > 0 ? film(run, itemId) / area : Number.NaN;
};

const MILK_GLASSES: Pick<CaseSpec, 'load' | 'soils' | 'surfaces'> = {
  load: 'glasses-milk',
  soils: byPrefix('glass', [{ ...milk('interior'), type: 'ikw_milk_microwaved' }]),
  surfaces: [{ item: 'glass_1', regions: ['interior'] }],
};

const FAT_PLATES = (label: string, target: number): CaseSpec => ({
  label,
  what: `main wash at ${target} C`,
  load: 'dplate-lower',
  programmeEdit: { washTarget_C: target },
  soils: byId({ plate: [margarine('well')], melamine: [margarine('well')] }),
  surfaces: [
    { item: 'plate', regions: ['well'] },
    { item: 'melamine', regions: ['well'] },
  ],
});

const POT_SOILS = byId({
  pot: [
    { type: 'milk_burnt', regions: { interior_base: 0.6 }, amount_g: 4, heat: 'cooked' },
    { type: 'milk_burnt', regions: { interior_wall: 0.4 }, amount_g: 4, heat: 'cooked' },
  ],
});

export const GROUPS_EFG: readonly Scenario[] = [
  {
    id: 'P30',
    title: 'Protein soil responds to hit frequency and chemistry, not to jet strength',
    group: 'E',
    mechanism: 'Swelling then enzymatic weakening; removal once a shear threshold is exceeded',
    test: 'A dessert plate with egg yolk at a fixed position in the lower basket: pump speed of the main wash -30 % (A) and +30 % (B); protease dose -50 % (C) and +50 % (D)',
    adapted:
      'A plate stands in for the tiles. The pump speed is changed in the steps of the main wash of the programme (3000 rpm to 2100 and 3900 rpm); the enzyme dose by `liq.xProtease`.',
    stages: 'soil: removal laws (reaction, jet assist), chemistry; water: hydraulics, jets',
    resolutionSensitive: false,
    cases: [
      { ...EGG_PLATE, label: 'A', what: 'pump -30 %', programmeEdit: { pumpScale: 0.7 } },
      { ...EGG_PLATE, label: 'B', what: 'pump +30 %', programmeEdit: { pumpScale: 1.3 } },
      { ...EGG_PLATE, label: 'C', what: 'protease -50 %', params: { 'liq.xProtease': 0.005 } },
      { ...EGG_PLATE, label: 'D', what: 'protease +50 %', params: { 'liq.xProtease': 0.015 } },
    ],
    checks: [
      check(
        'pump',
        'share of the egg yolk removed, pump +30 % minus pump -30 %',
        '1',
        true,
        control(0.1, 'doubling pump pressure changes egg-yolk removal little'),
        difference('A', 'B', (run) => 1 - residualFraction(run, 'plate')),
      ),
      check(
        'enzyme',
        'share of the egg yolk removed, protease +50 % minus protease -50 %',
        '1',
        true,
        band(
          1,
          0.05,
          1,
          'doubling enzyme level changes it clearly',
          'a rise of 5 points of removal or more',
        ),
        difference('C', 'D', (run) => 1 - residualFraction(run, 'plate')),
      ),
    ],
  },
  {
    id: 'P31',
    title: 'Starch is bimodal',
    group: 'E',
    mechanism: 'A gelatinised film either hydrates and lifts or stays as a sheet',
    test: 'Twelve soup plates with oat porridge in the lower basket; the histogram of their IEC scores',
    adapted:
      'Eleven in every second slot of the rear lane and one in the left front lane, settled by the loading physics.',
    stages: 'soil: hydration, removal laws (starch), inspection',
    resolutionSensitive: false,
    cases: [
      {
        label: 'A',
        what: 'twelve porridge plates',
        load: 'soup-12',
        soils: byPrefix('soup', [oats('well', 3)]),
        surfaces: [{ item: 'soup_6', regions: ['well'] }],
      },
    ],
    checks: [
      check(
        'clusters',
        'share of the plates scoring 5 or 0 to 1',
        '1',
        true,
        band(
          1,
          0.6,
          1,
          'porridge-plate scores cluster at 5 and at 0 to 1',
          'at least six in ten plates in the two clusters',
        ),
        single('A', (run) => {
          const scores = ids('soup', 12).map((id) => score(run, id));
          return scores.filter((s) => s === 5 || s <= 1).length / scores.length;
        }),
      ),
      check(
        'both',
        'share of the plates in the smaller of the two clusters',
        '1',
        true,
        direction(1, 'both clusters occur: some plates come clean, some keep a sheet', 0.01),
        single('A', (run) => {
          const scores = ids('soup', 12).map((id) => score(run, id));
          return (
            Math.min(scores.filter((s) => s === 5).length, scores.filter((s) => s <= 1).length) /
            scores.length
          );
        }),
      ),
    ],
  },
  {
    id: 'P32',
    title: 'Microwaved milk on glass is persistent',
    group: 'E',
    mechanism: 'Heat-denatured protein and mineral film on a smooth substrate; alkalinity-limited',
    test: 'Four test glasses with microwaved milk in the upper basket with detergent D on the Auto programme (A), on the long eco programme (B), and with a detergent of twice the enzyme and half the silicate (C)',
    adapted:
      'The registry defaults are IEC detergent D. The ingredient table of detergent E is not in the dossiers ("upgraded enzymes, less silicate"), so C is an assumed composition and decides nothing; the eco programme, which the entry names beside E, is the deciding comparison.',
    stages: 'soil: chemistry (alkalinity, enzyme), removal laws; water: jets into the glass',
    resolutionSensitive: false,
    cases: [
      { ...MILK_GLASSES, label: 'A', what: 'detergent D, Auto', programme: OWNER_PROGRAMME },
      { ...MILK_GLASSES, label: 'B', what: 'detergent D, Eco 50', programme: ECO_PROGRAMME },
      {
        ...MILK_GLASSES,
        label: 'C',
        what: 'assumed E-like detergent, Auto',
        programme: OWNER_PROGRAMME,
        params: { 'liq.xProtease': 0.02, 'liq.xAmylase': 0.01, 'liq.xSilicate': 0.275 },
      },
    ],
    checks: [
      check(
        'class',
        'mean IEC score of the glasses with detergent D, as a distance from 2.3 to 2.4 (A)',
        'score',
        true,
        within(1, 'glass class 2.3 to 2.4 with detergent D on the reference machines'),
        single('A', (run) => outside(meanOver(run, ids('glass', 4), score), 2.3, 2.4)),
      ),
      check(
        'eco',
        'mean IEC score of the glasses, eco minus Auto',
        'score',
        true,
        scoreChange(0.4, 1.7, '2.8 to 4.0 with detergent E or a long eco programme'),
        difference('A', 'B', (run) => meanOver(run, ids('glass', 4), score)),
      ),
      check(
        'e_like',
        'mean share of the milk left, E-like minus D',
        '1',
        false,
        direction(-1, 'upgraded enzymes remove more', 0.01),
        difference('A', 'C', (run) => meanOver(run, ids('glass', 4), residualFraction)),
      ),
    ],
  },
  {
    id: 'P33',
    title: 'Fat needs temperature and enough water',
    group: 'E',
    mechanism:
      'Solid fat below its melting range is only smeared; with little water the emulsion redeposits, most visibly on plastic',
    test: 'A porcelain and a melamine dessert plate with fresh margarine in the lower basket, with the main wash of the programme heated to 35 (A), 45 (B) and 55 C (C)',
    adapted:
      'The target of the main wash is changed in the steps of the programme; everything else of the programme stays.',
    stages: 'soil: removal laws (melt, roll-up by substrate), liquor (temperature course)',
    resolutionSensitive: false,
    cases: [FAT_PLATES('A', 35), FAT_PLATES('B', 45), FAT_PLATES('C', 55)],
    checks: [
      check(
        'warm',
        'IEC score of the porcelain plate at 55 C, as a distance from 4 to 5 (C)',
        'score',
        true,
        within(1, 'margarine platter cleans easily at 50 C'),
        single('C', (run) => outside(score(run, 'plate'), 4, 5)),
      ),
      check(
        'temperature',
        'share of the margarine left on the two plates, 35 C minus 55 C',
        '1',
        true,
        direction(
          1,
          'fat needs temperature: below its melting range solid fat is only smeared',
          0.05,
        ),
        difference('C', 'A', (run) => meanOver(run, ['plate', 'melamine'], residualFraction)),
      ),
      check(
        'plastic',
        'share of the margarine left at 45 C, melamine minus porcelain (B)',
        '1',
        false,
        direction(1, 'greasy residue most visibly on plastic', 0.01),
        single('B', (run) => residualFraction(run, 'melamine') - residualFraction(run, 'plate')),
      ),
    ],
  },
  {
    id: 'P34',
    title: 'Thick layers detach as flakes',
    group: 'E',
    mechanism: 'Under strong alkalinity a thick egg layer loses adhesion before it dissolves',
    test: 'A dessert plate with egg yolk at 5 (A) and 10 mg/cm2 dry (B)',
    adapted:
      'One plate; 5 and 10 mg/cm2 dry on 60 % of the well are 0.93 g and 1.85 g of yolk as applied.',
    requires: ['flaking'],
    stages: 'soil: removal laws (cohesive failure and flakes, not built)',
    resolutionSensitive: false,
    cases: [
      {
        ...EGG_PLATE,
        label: 'A',
        what: '5 mg/cm2 dry',
        soils: byId({ plate: [egg('well', 0.925)] }),
      },
      {
        ...EGG_PLATE,
        label: 'B',
        what: '10 mg/cm2 dry',
        soils: byId({ plate: [egg('well', 1.85)] }),
      },
    ],
    checks: [
      check(
        'flakes',
        'soil that left as flakes, thick minus thin',
        'mg',
        true,
        direction(1, 'thick egg yolk partly tended to flake off'),
        difference('A', 'B', (run) => {
          const soil = run.result.machine.soil as unknown as Record<string, unknown>;
          return typeof soil['flaked_mg'] === 'number' ? soil['flaked_mg'] : Number.NaN;
        }),
      ),
      check(
        'residue',
        'share of the egg yolk left, thick minus thin',
        '1',
        false,
        direction(1, 'the thicker layer takes longer', 0.01),
        difference('A', 'B', (run) => residualFraction(run, 'plate')),
      ),
    ],
  },
  {
    id: 'P35',
    title: 'Pot interiors',
    group: 'E',
    mechanism: 'Inverted, the bottom is hit directly; on its side, half the wall is shadowed',
    test: 'A 17 cm steel saucepan with burnt-on milk on its inner bottom and wall in the lower basket: mouth down on the rear rows (A) against lying on its side (B)',
    adapted:
      'Both poses are dropped and settled by the loading physics; the pan on its side rolls about 10 cm before it rests.',
    stages: 'water: jets (entry into a cavity), run-off; soil: removal laws',
    resolutionSensitive: true,
    cases: [
      {
        label: 'A',
        what: 'mouth down',
        load: 'pot-inverted',
        soils: POT_SOILS,
        surfaces: [
          { item: 'pot', regions: ['interior_base'] },
          { item: 'pot', regions: ['interior_wall'] },
        ],
      },
      {
        label: 'B',
        what: 'on its side',
        load: 'pot-on-side',
        soils: POT_SOILS,
        surfaces: [
          { item: 'pot', regions: ['interior_base'] },
          { item: 'pot', regions: ['interior_wall'] },
        ],
      },
    ],
    checks: [
      check(
        'class',
        'IEC score of the pot mouth down, as a distance from 2.5 to 4.0 (A)',
        'score',
        true,
        within(1, 'pots class 2.5 with detergent D to 4.0 with E'),
        single('A', (run) => outside(score(run, 'pot'), 2.5, 4.0)),
      ),
      check(
        'side',
        'share of the soil left in the pot, on its side minus mouth down',
        '1',
        true,
        direction(1, 'on its side, half the wall is shadowed', 0.01),
        difference('A', 'B', (run) => residualFraction(run, 'pot')),
      ),
      check(
        'ranking',
        'share left on the inner wall minus on the inner bottom, mouth down (A)',
        '1',
        false,
        direction(
          1,
          'inverted, the bottom is hit directly (the ranking is a calibration target)',
          0.01,
        ),
        single(
          'A',
          (run) =>
            regionResidual(run, 'pot', 'interior_wall') -
            regionResidual(run, 'pot', 'interior_base'),
        ),
      ),
    ],
  },
  {
    id: 'P36',
    title: 'Water pools in the base recess of inverted cups and mugs',
    group: 'F',
    mechanism: 'The foot ring forms a shallow dish',
    test: 'A ceramic mug mouth down on a level support: the rear cup shelf of the upper basket folded down',
    adapted:
      "The cup shelf of the Bosch is the level support; the mug is dropped onto it and settles. The expected volume is the checklist's formula for the recess of the catalogue's mug (28 mm radius, 2.5 mm deep).",
    stages: 'water: scene (basins), run-off, pools',
    resolutionSensitive: true,
    cases: [MUG_CASE('A', 0)],
    checks: [
      check(
        'pool',
        'water standing in the base recess at the end',
        'mL',
        true,
        quantity(
          recessLevel_mL,
          recessLevel_mL,
          'pi R^2 h: 5.9 mL for a recess of 25 mm radius and 3 mm depth; 6.2 mL for the recess of this mug (28 mm, 2.5 mm)',
        ),
        single('A', (run) => pooled(run, 'mug')),
      ),
      check(
        'drying',
        'drying score of the mug',
        'score',
        false,
        control(0.25, 'drying score 0'),
        single('A', (run) => futureField(run.item('mug'), 'drying', 'score')),
        ['drying'],
      ),
    ],
  },
  {
    id: 'P37',
    title: 'Tilt drains the recess',
    group: 'F',
    mechanism: 'Liquid spills over the low side; what remains is a wedge',
    test: 'The mug of P36 at 0 (A), 7 (B), 15 (C) and 30 degrees (D) of tilt',
    adapted:
      "The tilts are set, not settled: the mug is turned about a horizontal axis and kept standing on the height of its lowest point; the runner checks that it cuts into nothing. The checklist's volumes are for a recess of 25 mm radius and 3 mm depth; the expected values here are its formulas evaluated for the recess of the catalogue's mug (28 mm, 2.5 mm), as shares of the level volume.",
    stages: 'water: scene (basins, minimum basin volume), pools',
    resolutionSensitive: true,
    cases: [MUG_CASE('A', 0), MUG_CASE('B', 7), MUG_CASE('C', 15), MUG_CASE('D', 30)],
    checks: [
      check(
        'tilt7',
        'water in the recess at 7 degrees over level',
        '1',
        true,
        quantity(
          wedgeShare(7),
          wedgeShare(7),
          "the wedge formula: 1.4 of 5.9 mL at 7 degrees for the checklist's recess; 0.92 of 6.2 mL for this mug's",
        ),
        ratio('A', 'B', (run) => pooled(run, 'mug')),
      ),
      check(
        'tilt15',
        'water in the recess at 15 degrees over level',
        '1',
        true,
        quantity(
          wedgeShare(15),
          wedgeShare(15),
          "the wedge formula: 0.42 of 5.9 mL at 15 degrees for the checklist's recess; 0.28 of 6.2 mL for this mug's",
        ),
        ratio('A', 'C', (run) => pooled(run, 'mug')),
      ),
      check(
        'tilt30',
        'water in the recess at 30 degrees over level',
        '1',
        false,
        quantity(
          wedgeShare(30),
          wedgeShare(30),
          "the wedge formula: 0.13 of 5.9 mL at 30 degrees for the checklist's recess; 0.09 of 6.2 mL for this mug's",
        ),
        ratio('A', 'D', (run) => pooled(run, 'mug')),
      ),
    ],
  },
  {
    id: 'P38',
    title: 'Plastic stays wet',
    group: 'F',
    mechanism: 'Little stored heat to evaporate the film; water beads instead of sheeting',
    test: 'A melamine and a porcelain dessert plate of the same shape side by side in the lower basket',
    adapted: 'None.',
    requires: ['drying'],
    stages:
      'drying (not built); water: run-off (beads on plastic) gives the film it would start from',
    resolutionSensitive: false,
    cases: [
      {
        label: 'A',
        what: 'side by side',
        load: 'dplate-lower',
        soils: () => [],
        surfaces: [{ item: 'plate' }, { item: 'melamine' }],
      },
    ],
    checks: [
      check(
        'drying',
        'drying score (0 to 1 scale), melamine minus porcelain',
        '1',
        true,
        quantity(-0.07, -0.2, 'melamine dries to 0.47 to 0.76 against crockery 0.67 to 0.83'),
        single(
          'A',
          (run) =>
            (futureField(run.item('melamine'), 'drying', 'score') -
              futureField(run.item('plate'), 'drying', 'score')) /
            2,
        ),
      ),
      check(
        'film',
        'water left as film per area at the end of the last rinse, melamine over porcelain, minus one',
        '1',
        false,
        direction(1, 'water beads on plastic and stays', 0.05),
        single('A', (run) => filmPerArea(run, 'melamine') / filmPerArea(run, 'plate') - 1),
      ),
    ],
  },
  {
    id: 'P39',
    title: 'Pots and large hollow ware stay wet',
    group: 'F',
    mechanism: 'Sheltered interiors, rims that hold water, large wetted area',
    test: 'A saucepan mouth down in the lower basket (A) against a dessert plate on edge (B)',
    adapted: 'None.',
    requires: ['drying'],
    stages: 'drying (not built)',
    resolutionSensitive: false,
    cases: [
      {
        label: 'A',
        what: 'saucepan',
        load: 'pot-inverted',
        soils: () => [],
        surfaces: [{ item: 'pot' }],
      },
      {
        label: 'B',
        what: 'plate',
        load: 'dplate-lower',
        soils: () => [],
        surfaces: [{ item: 'plate' }],
      },
    ],
    checks: [
      check(
        'drying',
        'drying score (0 to 1 scale), pot minus plate',
        '1',
        true,
        quantity(-0.05, -0.3, 'pots dry to 0.45 to 0.79 against crockery 0.67 to 0.83'),
        (runs) => {
          const a = futureField((runs['A'] as CaseRun).item('pot'), 'drying', 'score') / 2;
          const b = futureField((runs['B'] as CaseRun).item('plate'), 'drying', 'score') / 2;
          return { a, b, value: a - b };
        },
      ),
      check(
        'water',
        'water the pot keeps at the end (pools and film) against the plate',
        'g',
        false,
        direction(1, 'rims that hold water, large wetted area'),
        (runs) => {
          const runA = runs['A'] as CaseRun;
          const runB = runs['B'] as CaseRun;
          const a = pooled(runA, 'pot') + film(runA, 'pot');
          const b = pooled(runB, 'plate') + film(runB, 'plate');
          return { a, b, value: a - b };
        },
      ),
    ],
  },
  {
    id: 'P40',
    title: 'Liquid held at contact points and in narrow gaps',
    group: 'F',
    mechanism: 'Capillary rise between surfaces a small distance apart',
    test: 'Two test glasses mouth down in the upper basket with a clear gap (A) against let down touching each other (B)',
    adapted:
      'Both pairs are settled by the loading physics; the gap of the separated pair is what they settle to (about 20 mm), not a set 10 mm.',
    stages: 'water: scene (contacts), run-off (bridges, retained water)',
    resolutionSensitive: true,
    cases: [
      {
        label: 'A',
        what: 'apart',
        load: 'glasses-apart',
        soils: () => [],
        surfaces: [
          { item: 'glass_1', regions: ['exterior'] },
          { item: 'glass_2', regions: ['exterior'] },
        ],
      },
      {
        label: 'B',
        what: 'touching',
        load: 'glasses-touching',
        soils: () => [],
        surfaces: [
          { item: 'glass_1', regions: ['exterior'] },
          { item: 'glass_2', regions: ['exterior'] },
        ],
      },
    ],
    checks: [
      check(
        'held',
        'water left on the two glasses at the end of the last rinse (film and pools), B - A',
        'g',
        true,
        direction(1, 'a wet mark at every touching pair'),
        difference(
          'A',
          'B',
          (run) =>
            film(run, 'glass_1') +
            film(run, 'glass_2') +
            pooled(run, 'glass_1') +
            pooled(run, 'glass_2'),
        ),
      ),
      check(
        'marks',
        'residue marks at the contact (B)',
        'marks',
        false,
        direction(1, 'a residue line at every touching pair'),
        single('B', (run) => futureField(run.item('glass_1'), 'spots', 'count')),
        ['spotting'],
      ),
    ],
  },
  {
    id: 'P41',
    title: 'Light plastic items are moved or flipped by jets',
    group: 'F',
    mechanism: 'Jet thrust on a concave underside against the weight of the item',
    test: 'A 20 g polypropylene container lid lying hollow side down in the lower basket (A) against the upper basket (B)',
    adapted:
      'The lightest lid of the catalogue weighs 20 g, not 15 g. In the lower basket it comes to rest on the cutlery basket and the left front tines.',
    requires: ['item_motion'],
    stages:
      'rigid-body coupling during the wash (not built); water: jets (the lift ratio is reported)',
    resolutionSensitive: false,
    cases: [
      {
        label: 'A',
        what: 'lower basket',
        load: 'lid-lower',
        soils: () => [],
        surfaces: [{ item: 'lid' }],
      },
      {
        label: 'B',
        what: 'upper basket',
        load: 'lid-upper',
        soils: () => [],
        surfaces: [{ item: 'lid' }],
      },
    ],
    checks: [
      check(
        'moved',
        'distance the jets move the lid in the lower basket',
        'mm',
        true,
        direction(
          1,
          'unrestrained items lighter than about 30 to 50 g can lift, turn over and then fill',
        ),
        single('A', (run) => futureField(run.item('lid'), 'moved', 'distance_mm')),
      ),
      check(
        'lift',
        'peak upward jet force on the lid over its weight, lower basket (A)',
        '1',
        false,
        quantity(0.4, 1.5, '0.08 to 0.30 N per jet against the weight of a 20 g lid'),
        single('A', (run) => run.item('lid').jetLiftRatio ?? 0),
      ),
      check(
        'upper',
        'that ratio, upper basket minus lower basket',
        '1',
        false,
        direction(-1, 'the advice is to put light plastics in the top rack', 0.01),
        difference('A', 'B', (run) => run.item('lid').jetLiftRatio ?? 0),
      ),
    ],
  },
  {
    id: 'P42',
    title: 'Cutlery dries almost completely (negative control)',
    group: 'F',
    mechanism: 'Thin metal, high conductivity, drains along its length',
    test: 'The cutlery of the IEC load',
    adapted: 'None.',
    requires: ['drying'],
    stages: 'drying (not built)',
    resolutionSensitive: false,
    cases: [{ label: 'A', what: 'IEC load', load: IEC, surfaces: [] }],
    checks: [
      check(
        'drying',
        'points of the 0 to 1 drying scale the cutlery loses',
        '1',
        true,
        control(0.02, 'drying 0.99'),
        single('A', (run) => {
          const cutlery = run.result.items.filter((item) => isCutlery(item.typeId));
          return (
            1 -
            cutlery.reduce((sum, item) => sum + futureField(item, 'drying', 'score') / 2, 0) /
              cutlery.length
          );
        }),
      ),
      check(
        'water',
        'water standing in a piece of cutlery at the end, mean',
        'mL',
        false,
        control(0.05, 'it drains along its length'),
        single('A', (run) => {
          const cutlery = run.result.items.filter((item) => isCutlery(item.typeId));
          return cutlery.reduce((sum, item) => sum + item.water.pooled_mL, 0) / cutlery.length;
        }),
      ),
    ],
  },
  {
    id: 'P43',
    title: 'Spots, film and tine marks on glass',
    group: 'F',
    mechanism: 'Evaporation of hard or poorly rinsed water leaves solids; contacts hold drops',
    test: 'A test glass in the upper basket with rinse aid (A) and without (B)',
    adapted:
      'The wash has no input for water hardness or for running without rinse aid; B is washed as A until it has, and the scenario is reported as not covered.',
    requires: ['spotting'],
    stages: 'drying and spotting (not built)',
    resolutionSensitive: false,
    cases: [
      {
        label: 'A',
        what: 'with rinse aid',
        load: 'glass-free',
        soils: () => [],
        surfaces: [{ item: 'glass' }],
      },
      {
        label: 'B',
        what: 'without rinse aid',
        load: 'glass-free',
        soils: () => [],
        surfaces: [{ item: 'glass' }],
      },
    ],
    checks: [
      check(
        'spots',
        'spots on the glass, without rinse aid minus with',
        'spots',
        true,
        direction(1, 'AHAM adds 1 point per small spot or streak, 3 per large one'),
        difference('A', 'B', (run) => futureField(run.item('glass'), 'spots', 'count')),
      ),
    ],
  },
  {
    id: 'P44',
    title: 'Cutlery comes out clean although it is the most shadowed class',
    group: 'G',
    mechanism:
      'Thin soil films, small soiled area, metal substrate, repeated wetting from all sides',
    test: 'The IEC load of 13 place settings, loaded carefully, on the scored programme; class mean of the soiled cutlery',
    adapted:
      'The pieces of the load that the careful loading policy fits into the machine as modelled (about 100 of 140).',
    stages: 'water: droplets, run-off in the cutlery basket; soil: removal laws',
    resolutionSensitive: false,
    cases: [{ label: 'A', what: 'IEC load', load: IEC, surfaces: [] }],
    checks: [
      check(
        'class',
        'mean IEC score of the soiled cutlery, as a distance from 4.6 to 4.8',
        'score',
        true,
        within(1, 'class mean 4.6 to 4.8'),
        single('A', (run) => outside(classMean(run, isCutlery), 4.6, 4.8)),
      ),
    ],
  },
  {
    id: 'P45',
    title: 'Class ranking in the standard test',
    group: 'G',
    mechanism: 'See section 7.1 of the standards dossier',
    test: 'The IEC load on the scored programme: mean scores of cutlery, melamine, glass and crockery, and overall',
    adapted:
      'The pieces that fit (about 100 of 140); the load has no pots (the loader left them out), so that class is not scored.',
    stages: 'the whole wash',
    resolutionSensitive: false,
    cases: [{ label: 'A', what: 'IEC load', load: IEC, surfaces: [] }],
    checks: [
      check(
        'overall',
        'load mean IEC score, as a distance from 3.5 to 4.2',
        'score',
        true,
        within(1, 'overall 3.5 to 4.2 on a 12 to 13 place-setting load'),
        single('A', (run) => outside(meanScore(run), 3.5, 4.2)),
      ),
      check(
        'crockery',
        'crockery mean, as a distance from 2.3 to 3.7',
        'score',
        true,
        within(1, 'crockery 2.3 to 3.7'),
        single('A', (run) => outside(classMean(run, isCrockery), 2.3, 3.7)),
      ),
      check(
        'glass',
        'glass mean, as a distance from 2.3 to 4.0',
        'score',
        true,
        within(1, 'glass 2.3 to 4.0'),
        single('A', (run) => outside(classMean(run, isGlass), 2.3, 4.0)),
      ),
      check(
        'ranking',
        'cutlery mean minus crockery mean',
        'score',
        true,
        direction(1, 'cutlery > melamine > (pots, glass, crockery)'),
        single('A', (run) => classMean(run, isCutlery) - classMean(run, isCrockery)),
      ),
      check(
        'melamine',
        'melamine mean minus crockery mean',
        'score',
        false,
        direction(1, 'melamine above crockery'),
        single('A', (run) => classMean(run, isMelamine) - classMean(run, isCrockery)),
      ),
    ],
  },
  {
    id: 'P46',
    title: 'Run-to-run repeatability',
    group: 'G',
    mechanism: 'Arm phase, soil variability, tablet release time, sensor decisions',
    test: 'The IEC load washed with three seeds (level seed and simulation seed 1, 2 and 3); standard deviation of the load mean score',
    adapted:
      'Three seeds. The seeds move the phase origin of the arms, the sampling of the droplets, and where on a region each soil lies and how thick; the tablet release time and the sensor decisions of the machine are fixed.',
    stages: 'the whole wash (seeded sampling)',
    resolutionSensitive: false,
    cases: [
      { label: 'A', what: 'seeds 1', load: IEC, surfaces: [] },
      { label: 'B', what: 'seeds 2', load: IEC, levelSeed: 2, simSeed: 2, surfaces: [] },
      { label: 'C', what: 'seeds 3', load: IEC, levelSeed: 3, simSeed: 3, surfaces: [] },
    ],
    checks: [
      check(
        'spread',
        'standard deviation of the load mean IEC score over the three seeds',
        'score',
        true,
        quantity(0.08, 0.1, 'about 0.08 to 0.10; not zero, not 0.5'),
        (runs) => ({
          value: spread(['A', 'B', 'C'].map((label) => meanScore(runs[label] as CaseRun))),
        }),
      ),
    ],
  },
  {
    id: 'P47',
    title: 'Everything is wetted within seconds; jets are rare events',
    group: 'G',
    mechanism: 'Splash and downfall reach surfaces that jets do not',
    test: 'The IEC load on the scored programme: the share of the surface of the load that is wetted, and the fraction of time under a direct jet',
    adapted:
      'The time-resolved first wetting is not recorded by the exposure (it stores the periodic state); what is checked is the wetted share in the periodic state and the water returning to the sump within a revolution.',
    stages: 'water: jets, droplets, run-off',
    resolutionSensitive: false,
    cases: [{ label: 'A', what: 'IEC load', load: IEC, surfaces: [] }],
    checks: [
      check(
        'f_jet',
        'largest fraction of time under a direct jet of any item of the load (mean over its surface)',
        '1',
        true,
        control(0.05, 'f_jet under 10 % almost everywhere'),
        single('A', (run) =>
          Math.max(...run.result.items.map((item) => run.exposure(item.itemId).fJet)),
        ),
      ),
      check(
        'wetted',
        'share of the surface of the load that no spray state wets',
        '1',
        true,
        control(0.1, 'everything is wetted'),
        single('A', (run) => {
          let area = 0;
          let wet = 0;
          for (const item of run.result.items) {
            const e = run.exposure(item.itemId);
            area += e.area_cm2;
            wet += e.area_cm2 * e.wettedAreaShare;
          }
          return area > 0 ? 1 - wet / area : Number.NaN;
        }),
      ),
      check(
        'circuit',
        'share of the nozzle outflow not back in the sump within one revolution of the arm (largest of the spray states)',
        '1',
        false,
        control(0.25, 'water circuit under 3 s (a revolution takes 1.4 to 2.2 s)'),
        single('A', (run) =>
          Math.max(
            ...run.result.machine.states.map(
              (s) => 1 - (s.exposure.water?.sumpReturnFraction ?? Number.NaN),
            ),
          ),
        ),
      ),
    ],
  },
  {
    id: 'P48',
    title: 'Detergent does not change where water goes',
    group: 'G',
    mechanism: 'Surfactant alters wetting and film behaviour, not jet paths',
    test: 'A dessert plate in the lower basket washed with detergent (A) and with the dispenser blocked, so without any (B); the exposure of the two washes',
    adapted:
      'The exposure of the simulation is computed for one liquor class and does not read the detergent at all, so this holds by construction: the check guards that it stays so.',
    stages: 'water: jets (the exposure key excludes the liquor)',
    resolutionSensitive: false,
    cases: [
      { ...EGG_PLATE, label: 'A', what: 'with detergent' },
      { ...EGG_PLATE, label: 'B', what: 'without detergent', dispenserBlocked: true },
    ],
    checks: [
      check(
        'jets',
        'spray states whose exposure differs between the two washes',
        'states',
        true,
        control(0, 'jet trajectories and velocity fields the same with and without detergent'),
        (runs) => {
          const a = (runs['A'] as CaseRun).result.machine.states;
          const b = (runs['B'] as CaseRun).result.machine.states;
          return { value: a.filter((state, i) => state.exposureKey !== b[i]?.exposureKey).length };
        },
      ),
    ],
  },
];
