/**
 * Groups B, C and D of the checklist (docs/research/standards.md sections 9.3 to 9.5):
 * cutlery (P15 to P18), whole-load effects (P19 to P24), chemistry delivery and programme
 * (P25 to P29), on the owner's Bosch SMV4HAX40G.
 *
 * The whole-load scenarios wash the loader's settled IEC load of 13 place settings
 * (`loader:iec-13-careful`: the pieces of its 140, about 100, that a careful policy fits into
 * the machine as modelled) with the IEC soils the loader's level puts on it.
 */

import { poseCompose, quatFromAxisAngle, quatRotate, type Vec3 } from '@spotless/core';
import { control, direction, outside, quantity, scoreChange, within } from './bands.ts';
import { band, byId, byPrefix, egg, oats, tea } from './kit.ts';
import { ECO_PROGRAMME } from './programmes.ts';
import {
  check,
  difference,
  fJet,
  film,
  futureField,
  meanOver,
  meanScore,
  pooled,
  residualFraction,
  score,
  single,
} from './measures.ts';
import type { CaseRun, CaseSpec, LoadItem, Scenario, SoilSpec } from './types.ts';

const ids = (prefix: string, count: number): string[] =>
  Array.from({ length: count }, (_unused, i) => `${prefix}_${i + 1}`);

/** Share of some items that do not score 5. */
const notFive = (run: CaseRun, itemIds: readonly string[]): number =>
  itemIds.filter((id) => score(run, id) < 5).length / itemIds.length;

const IEC = 'loader:iec-13-careful';

/** A stable pick of a share of the items of a load, by position: the same items every time. */
const pick = (index: number, modulus: number, residue = 0): boolean => index % modulus === residue;

/** The IEC load as the loader soiled it. */
const IEC_BASE: CaseSpec = {
  label: 'A',
  what: 'IEC load of 13 place settings, loaded carefully, IEC soils',
  load: IEC,
  surfaces: [],
};

/** The soils of an item of a loader load replaced by a lightly adhering, air-dried one. */
function easySoils(item: LoadItem): readonly SoilSpec[] {
  return item.soils.map((soil) => ({
    type: 'jam',
    regions: Object.fromEntries(soil.regions.map((r) => [r.region, r.coverage])),
    age_h: 15,
    heat: 'none' as const,
  }));
}

const isCutlery = (typeId: string): boolean => /fork|knife|spoon|ladle/.test(typeId);
const isGlass = (typeId: string): boolean => /glass/.test(typeId);
const isMelamine = (typeId: string): boolean => /melamine/.test(typeId);
const isCrockery = (typeId: string): boolean =>
  !isCutlery(typeId) && !isGlass(typeId) && !isMelamine(typeId);

/** Mean IEC score of the soiled items of a wash whose type passes a test. */
export function classMean(run: CaseRun, of: (typeId: string) => boolean): number {
  const items = run.result.items.filter((item) => item.initialMass_mg > 0 && of(item.typeId));
  if (items.length === 0) return Number.NaN;
  return items.reduce((sum, item) => sum + item.score, 0) / items.length;
}

/**
 * How the second soup spoon of P15 B lies against the first, in the frame of the first (x from
 * the end of the handle to the tip of the bowl, z out of the hollow of the bowl): behind it by
 * `lift` along z, and turned by `tilt` about the transverse axis through the neck (`neck`), so
 * that the back of the first spoon lies in the hollow of the second. With these values 10 cm2
 * of the hollow of the second spoon is within 1 mm of the first, nowhere nearer than 0.5 mm,
 * the handles are 0.3 mm apart at their nearest and the pair is clear of the cutlery basket
 * (`scripts/pair-gap.ts`): what the evidence describes ("under 1 mm over about 10 cm2").
 * Lying in front of the first spoon instead, the second would cut into the wall of the cell.
 */
const SPOON_NEST = { lift: -0.0032, tilt: (-1 * Math.PI) / 180, neck: [0.127, 0, 0.0097] } as const;

/**
 * The second spoon of P15 B set into its nest ({@link SPOON_NEST}; flagged `exact`). The
 * loading physics does not hold one spoon in another: laid into the first, the second slides
 * off and comes to rest across it, touching at a point (0.5 cm2 of it within 1 mm, found by
 * the review of 11 October 2026).
 */
export function spoonNested(items: readonly LoadItem[]): readonly LoadItem[] {
  const first = items.find((item) => item.itemId === 'spoon_1');
  if (first === undefined) throw new Error('no spoon_1');
  const turn = quatFromAxisAngle([0, 1, 0], SPOON_NEST.tilt);
  const neck: Vec3 = [...SPOON_NEST.neck];
  const arm = quatRotate(turn, [-neck[0], -neck[1], -neck[2]]);
  const local = {
    p: [neck[0] + arm[0], neck[1] + arm[1], neck[2] + arm[2] + SPOON_NEST.lift] as Vec3,
    q: turn,
  };
  return items.map((item) =>
    item.itemId === 'spoon_2'
      ? { ...item, pose: poseCompose(first.pose, local), exact: true }
      : item,
  );
}

export const GROUPS_BCD: readonly Scenario[] = [
  {
    id: 'P15',
    title: 'Nested spoons',
    group: 'B',
    mechanism: 'A bowl-to-bowl gap under 1 mm over about 10 cm2 traps soil and liquid',
    test: 'Two soup spoons with porridge in their bowls, handles down in one cell of the cutlery basket: bowls turned away from each other (A) against the second laid into the bowl of the first (B)',
    adapted:
      'Cell c01 of the cutlery basket of the Bosch. The opposed pair and the first spoon of the nested pair are settled by the loading physics; the second spoon of the nested pair is set (the physics lets it slide off and rest across the first, touching at a point): it lies behind the first, the back of the first in its hollow, 10 cm2 of the hollow within 1 mm and nowhere nearer than 0.5 mm.',
    stages: 'water: scene (contacts, gap field), jets, run-off; soil: supply factor',
    resolutionSensitive: true,
    cases: [
      {
        label: 'A',
        what: 'opposed',
        load: 'spoons-opposed',
        soils: byPrefix('spoon', [oats('bowl', 0.3)]),
        surfaces: [
          { item: 'spoon_1', regions: ['bowl'] },
          { item: 'spoon_2', regions: ['bowl'] },
        ],
      },
      {
        label: 'B',
        what: 'nested',
        load: 'spoons-nested',
        edit: spoonNested,
        soils: byPrefix('spoon', [oats('bowl', 0.3)]),
        surfaces: [
          { item: 'spoon_1', regions: ['bowl'] },
          { item: 'spoon_2', regions: ['bowl'] },
        ],
      },
    ],
    checks: [
      check(
        'shielded',
        'IEC score of the shielded spoon when nested (the one that keeps more), as a distance from the range 0 to 1',
        'score',
        true,
        within(1, 'shielded spoon scores 0 to 1 with porridge or egg'),
        single('B', (run) => {
          const shielded =
            residualFraction(run, 'spoon_1') >= residualFraction(run, 'spoon_2')
              ? 'spoon_1'
              : 'spoon_2';
          return outside(score(run, shielded), 0, 1);
        }),
      ),
      check(
        'partner',
        'IEC score of the other spoon, nested minus opposed',
        'score',
        true,
        control(0.5, 'partner unaffected'),
        (runs) => {
          const runA = runs['A'] as CaseRun;
          const runB = runs['B'] as CaseRun;
          const partner =
            residualFraction(runB, 'spoon_1') >= residualFraction(runB, 'spoon_2')
              ? 'spoon_2'
              : 'spoon_1';
          const a = score(runA, partner);
          const b = score(runB, partner);
          return { a, b, value: b - a };
        },
      ),
      check(
        'residue',
        'largest share of porridge left on a spoon, nested minus opposed',
        '1',
        false,
        direction(1, 'when spoons spoon, they trap food', 0.01),
        difference('A', 'B', (run) =>
          Math.max(residualFraction(run, 'spoon_1'), residualFraction(run, 'spoon_2')),
        ),
      ),
    ],
  },
  {
    id: 'P16',
    title: 'Heads up against heads down (not nested)',
    group: 'B',
    mechanism:
      'Basket walls shadow the lower 60 to 100 mm; heads-down ends sit where drainage collects',
    test: 'Six dinner forks with egg yolk on the tines, one per cell of the cutlery basket: handles down (A) against handles up (B)',
    adapted: 'Six forks, one per cell: the cutlery basket of the Bosch has six cells, not twelve.',
    stages: 'water: jets (basket walls), run-off; soil: removal laws',
    resolutionSensitive: false,
    cases: [
      {
        label: 'A',
        what: 'heads up',
        load: 'forks-heads-up',
        soils: byPrefix('fork', [egg('tines', 0.3)]),
        surfaces: [{ item: 'fork_1', regions: ['tines'] }],
      },
      {
        label: 'B',
        what: 'heads down',
        load: 'forks-heads-down',
        soils: byPrefix('fork', [egg('tines', 0.3)]),
        surfaces: [{ item: 'fork_1', regions: ['tines'] }],
      },
    ],
    checks: [
      check(
        'score',
        'mean IEC score of the forks, B - A',
        'score',
        true,
        control(0.3, 'negative control: absolute change at most 0.3'),
        difference('A', 'B', (run) => meanOver(run, ids('fork', 6), score)),
      ),
      check(
        'residue',
        'mean share of the egg yolk left on the forks, B - A',
        '1',
        false,
        control(0.1, 'an informal test found no difference'),
        difference('A', 'B', (run) => meanOver(run, ids('fork', 6), residualFraction)),
      ),
    ],
  },
  {
    id: 'P17',
    title: 'Crowded basket cells',
    group: 'B',
    mechanism: 'Contact probability rises with pieces per cell',
    test: 'Dessert spoons with porridge in their bowls, handles down in the six cells of the cutlery basket: one (A), two (B) and four (C) per cell',
    adapted:
      'Six, twelve and twenty-four spoons in the six cells of the Bosch; each load is settled by the loading physics.',
    stages: 'load: physics (contacts); water: scene (contacts), jets; soil: removal laws',
    resolutionSensitive: false,
    cases: [
      {
        label: 'A',
        what: 'one per cell',
        load: 'spoons-1',
        soils: byPrefix('spoon', [oats('bowl', 0.3)]),
        surfaces: [{ item: 'spoon_1', regions: ['bowl'] }],
      },
      {
        label: 'B',
        what: 'two per cell',
        load: 'spoons-2',
        soils: byPrefix('spoon', [oats('bowl', 0.3)]),
        surfaces: [{ item: 'spoon_1', regions: ['bowl'] }],
      },
      {
        label: 'C',
        what: 'four per cell',
        load: 'spoons-4',
        soils: byPrefix('spoon', [oats('bowl', 0.3)]),
        surfaces: [{ item: 'spoon_1', regions: ['bowl'] }],
      },
    ],
    checks: [
      check(
        'crowding',
        'share of spoons not scoring 5, four per cell minus one per cell',
        '1',
        true,
        band(
          1,
          0.15,
          1,
          'from about 20 % to above 50 % with three or more like pieces per cell',
          'half the stated rise or more',
        ),
        (runs) => {
          const a = notFive(runs['A'] as CaseRun, ids('spoon', 6));
          const c = notFive(runs['C'] as CaseRun, ids('spoon', 24));
          return { a, b: c, value: c - a };
        },
      ),
      check(
        'single',
        'share of spoons not scoring 5 at one per cell, as a distance from 10 to 40 %',
        '1',
        false,
        within(0.1, 'about 20 % of cutlery not scoring 5 in the standard load'),
        single('A', (run) => outside(notFive(run, ids('spoon', 6)), 0.1, 0.4)),
      ),
      check(
        'residue',
        'mean share of porridge left, four per cell minus one per cell',
        '1',
        false,
        direction(1, 'crowding leaves more', 0.05),
        (runs) => {
          const a = meanOver(runs['A'] as CaseRun, ids('spoon', 6), residualFraction);
          const c = meanOver(runs['C'] as CaseRun, ids('spoon', 24), residualFraction);
          return { a, b: c, value: c - a };
        },
      ),
    ],
  },
  {
    id: 'P18',
    title: 'Cutlery tray against basket',
    group: 'B',
    mechanism: 'Pieces lying nearly flat do not nest, but spoon bowls facing up hold water',
    test: 'Six dessert spoons with porridge in their bowls: standing in the cutlery basket (A) against lying flat, bowls up, on the knife shelf of the upper basket (B)',
    adapted:
      "The owner's machine has no cutlery drawer; the knife shelf of the upper basket is where pieces lie flat, so it stands in for the tray.",
    stages: 'water: scene (basins of small hollows), pools; soil: replay under a pool',
    resolutionSensitive: false,
    cases: [
      {
        label: 'A',
        what: 'standing in the basket',
        load: 'spoons-1',
        soils: byPrefix('spoon', [oats('bowl', 0.3)]),
        surfaces: [{ item: 'spoon_1', regions: ['bowl'] }],
      },
      {
        label: 'B',
        what: 'lying on the knife shelf',
        load: 'spoons-shelf',
        soils: byPrefix('spoon', [oats('bowl', 0.3)]),
        surfaces: [{ item: 'spoon_1', regions: ['bowl'] }],
      },
    ],
    checks: [
      check(
        'water',
        'water standing in a spoon at the end, mean, B - A',
        'mL',
        true,
        direction(1, 'spoon bowls facing up hold water'),
        difference('A', 'B', (run) => meanOver(run, ids('spoon', 6), pooled)),
      ),
      check(
        'drying',
        'drying score of the spoons lying bowl up (B)',
        'score',
        false,
        control(0.25, 'drying score on face-up spoon bowls 0'),
        single('B', (run) =>
          meanOver(run, ids('spoon', 6), (r, id) => futureField(r.item(id), 'drying', 'score')),
        ),
        ['drying'],
      ),
    ],
  },
  {
    id: 'P19',
    title: 'Loading beyond rated capacity',
    group: 'C',
    mechanism: 'Smaller gaps, more shadowing, more soil per litre',
    test: 'Six place settings well spaced (A) against the full IEC load one piece to a slot (B, nearly twice the pieces), both settled by the careful loading policy; mean IEC score of the soiled pieces',
    adapted:
      'The machine as modelled does not take the rated 140 pieces: the careful loader fits about 100. A load "beyond what fits" cannot be built by a loader that refuses what does not hold, so the contrast run here is half load against full load (about 80 % more pieces), not rated against rated + 30 %.',
    stages: 'load: loader; water: jets (shadowing), run-off; soil: liquor (soil load)',
    resolutionSensitive: false,
    cases: [
      { label: 'A', what: 'half load, well spaced', load: 'loader:half-careful', surfaces: [] },
      { ...IEC_BASE, label: 'B', what: 'full load, one piece to a slot' },
    ],
    checks: [
      check(
        'mean',
        'mean IEC score of the soiled pieces, B - A',
        'score',
        true,
        scoreChange(-0.5, -1, 'load mean -0.5 to -1 when 30 % more items are forced in'),
        difference('A', 'B', (run) => meanScore(run)),
      ),
    ],
  },
  {
    id: 'P20',
    title: 'Total soil load',
    group: 'C',
    mechanism: 'Chemistry is consumed, the liquor carries more suspended soil, the filter loads',
    test: 'The IEC load in one geometry with a quarter (A), half (B) and all (C) of its pieces soiled; mean IEC score of the pieces that are soiled in all three',
    adapted:
      'Every fourth piece of the load (by position in its list) is the quarter; every second the half.',
    stages: 'soil: liquor (consumption of oxidant and enzyme by soil), chemistry',
    resolutionSensitive: false,
    cases: [
      {
        ...IEC_BASE,
        label: 'A',
        what: 'a quarter of the pieces soiled',
        soils: (item, index) => (pick(index, 4) ? undefined : []),
      },
      {
        ...IEC_BASE,
        label: 'B',
        what: 'half of the pieces soiled',
        soils: (item, index) => (pick(index, 2) ? undefined : []),
      },
      { ...IEC_BASE, label: 'C', what: 'all pieces soiled' },
    ],
    checks: [
      check(
        'mean',
        'mean IEC score of the always-soiled quarter, all soiled minus a quarter soiled',
        'score',
        true,
        quantity(
          -0.5,
          -2.5,
          'US index 95 to 98 at light soil, 25 to 85 with everything soiled: a drop of 10 to 50 points of 100',
        ),
        (runs) => {
          const quarter = (run: CaseRun): number => {
            const items = (runs['A'] as CaseRun).result.items
              .filter((item) => item.initialMass_mg > 0)
              .map((item) => item.itemId);
            return meanOver(run, items, score);
          };
          const a = quarter(runs['A'] as CaseRun);
          const c = quarter(runs['C'] as CaseRun);
          return { a, b: c, value: c - a };
        },
      ),
    ],
  },
  {
    id: 'P21',
    title: 'Redeposition of particulates',
    group: 'C',
    mechanism:
      'Fibrous and granular soils circulate and settle on surfaces that face up or sit in slow zones',
    test: 'Seven clean dinner plates (A) against the same with 20 g of minced spinach on one of them (B); specks on the plates that started clean',
    adapted: 'A row of plates in the lower basket instead of a whole load.',
    requires: ['redeposition'],
    stages: 'soil: redeposition (not built)',
    resolutionSensitive: false,
    cases: [
      { label: 'A', what: 'no spinach', load: 'plates-18', soils: () => [], surfaces: [] },
      {
        label: 'B',
        what: '20 g of spinach on one plate',
        load: 'plates-18',
        soils: byId({ plate_4: [{ type: 'iec_spinach', regions: { well: 0.6 }, amount_g: 20 }] }),
        surfaces: [{ item: 'plate_3' }],
      },
    ],
    checks: [
      check(
        'specks',
        'share of the plates that started clean and carry 1 to 4 specks, B - A',
        '1',
        true,
        band(
          1,
          0.25,
          1,
          'more than half of otherwise clean items carry 1 to 4 specks',
          'half the stated share or more',
        ),
        difference('A', 'B', (run) => {
          const clean = ['plate_1', 'plate_2', 'plate_3', 'plate_5', 'plate_6', 'plate_7'];
          return (
            clean.filter((id) => run.item(id).specks >= 1 && run.item(id).specks <= 4).length /
            clean.length
          );
        }),
      ),
    ],
  },
  {
    id: 'P22',
    title: 'Clean neighbours of soiled items',
    group: 'C',
    mechanism: 'Transfer by splash and by contaminated liquor only',
    test: 'Seven dinner plates in neighbouring slots, every second one with egg yolk; the clean ones are scored',
    adapted: 'A row of plates in the lower basket instead of a whole load.',
    stages: 'soil: liquor, redeposition (not built: the clean plates cannot pick anything up)',
    resolutionSensitive: false,
    cases: [
      {
        label: 'A',
        what: 'clean and soiled alternating',
        load: 'plates-18',
        soils: byId({
          plate_1: [egg('well', 3)],
          plate_3: [egg('well', 3)],
          plate_5: [egg('well', 3)],
          plate_7: [egg('well', 3)],
        }),
        surfaces: [{ item: 'plate_4' }],
      },
    ],
    checks: [
      check(
        'clean',
        'points the clean plates lose (5 minus their mean IEC score)',
        'score',
        true,
        control(0.25, 'small: the index stays 95 to 98 at lighter soil'),
        single('A', (run) => 5 - meanOver(run, ['plate_2', 'plate_4', 'plate_6'], score)),
      ),
    ],
  },
  {
    id: 'P23',
    title: 'End-of-cycle drips from the upper rack',
    group: 'C',
    mechanism:
      'Water retained on upper-rack items and the rack drips onto lower items after the last drain',
    test: 'Seven dinner plates in the lower basket with an empty upper basket (A) against three mugs mouth down in the upper basket (B)',
    adapted: 'Three mugs stand for the loaded upper basket.',
    requires: ['drying'],
    stages: 'water: drain-down after the last rinse and drying (not built)',
    resolutionSensitive: false,
    cases: [
      {
        label: 'A',
        what: 'upper basket empty',
        load: 'plates-18',
        soils: () => [],
        surfaces: [{ item: 'plate_4' }],
      },
      {
        label: 'B',
        what: 'upper basket loaded',
        load: 'plates-18-upper',
        soils: () => [],
        surfaces: [{ item: 'plate_4' }],
      },
    ],
    checks: [
      check(
        'drying',
        'drying score (0 to 1 scale) of the lower plates, B - A',
        '1',
        true,
        quantity(
          -0.1,
          -0.2,
          'lowers the drying score of upper faces in the lower rack by about 0.1 to 0.2',
        ),
        difference(
          'A',
          'B',
          (run) =>
            meanOver(run, ids('plate', 7), (r, id) => futureField(r.item(id), 'drying', 'score')) /
            2,
        ),
      ),
      check(
        'film',
        'water left as film on the lower plates at the end of the last rinse, mean, B - A',
        'g',
        false,
        direction(1, 'drips from above add water'),
        difference('A', 'B', (run) => meanOver(run, ids('plate', 7), film)),
      ),
    ],
  },
  {
    id: 'P24',
    title: 'Arrangement does not matter for easy soils (negative control)',
    group: 'C',
    mechanism: 'Air-dried, lightly adhering soils leave with the first wetting wherever they are',
    test: 'The IEC load with half of its pieces carrying an air-dried, lightly adhering soil (jam, 15 h) and half clean, in three different soiled/clean orders',
    adapted:
      'The three orders are three different halves of the pieces of one settled load; the soil lies where the IEC soil of each piece lies.',
    stages: 'soil: removal laws (dissolve), hydration',
    resolutionSensitive: false,
    cases: [
      {
        ...IEC_BASE,
        label: 'A',
        what: 'first order',
        soils: (item, index) => (pick(index, 2, 0) ? easySoils(item) : []),
      },
      {
        ...IEC_BASE,
        label: 'B',
        what: 'second order',
        soils: (item, index) => (pick(index, 2, 1) ? easySoils(item) : []),
      },
      {
        ...IEC_BASE,
        label: 'C',
        what: 'third order',
        soils: (item, index) => (pick(index, 4, 0) || pick(index, 4, 1) ? easySoils(item) : []),
      },
    ],
    checks: [
      check(
        'range',
        'largest minus smallest load mean IEC score of the three orders',
        'score',
        true,
        control(0.1, 'changes the load index by less than run-to-run noise (0.08 to 0.10)'),
        (runs) => {
          const means = ['A', 'B', 'C'].map((label) => meanScore(runs[label] as CaseRun));
          return { value: Math.max(...means) - Math.min(...means) };
        },
      ),
    ],
  },
  {
    id: 'P25',
    title: 'Detergent dispenser blocked',
    group: 'D',
    mechanism: 'The tablet cannot fall, so the main wash runs without detergent',
    test: 'A dessert plate with egg yolk in the lower basket and two tea cups with tea film in the upper basket, washed with the dispenser free (A, C) and blocked (B, D)',
    adapted:
      "The blocked dispenser is given to the wash as the session's mechanical check reports it (the tablet tray of the Bosch is on the upper basket; the loader's careless loads block it with a real item). Here the same loads are washed twice so that nothing else changes.",
    stages: 'load: session (mechanical check); soil: liquor (dosing), chemistry',
    resolutionSensitive: false,
    cases: [
      {
        label: 'A',
        what: 'plate, dispenser free',
        load: 'plate-facing',
        soils: byId({ plate: [egg('well')] }),
        surfaces: [{ item: 'plate', regions: ['well'] }],
      },
      {
        label: 'B',
        what: 'plate, dispenser blocked',
        load: 'plate-facing',
        soils: byId({ plate: [egg('well')] }),
        dispenserBlocked: true,
        surfaces: [{ item: 'plate', regions: ['well'] }],
      },
      {
        label: 'C',
        what: 'tea cups, dispenser free',
        load: 'cups-centre-corner',
        soils: byPrefix('cup', [tea('interior')]),
        surfaces: [{ item: 'cup_1', regions: ['interior'] }],
      },
      {
        label: 'D',
        what: 'tea cups, dispenser blocked',
        load: 'cups-centre-corner',
        soils: byPrefix('cup', [tea('interior')]),
        dispenserBlocked: true,
        surfaces: [{ item: 'cup_1', regions: ['interior'] }],
      },
    ],
    checks: [
      check(
        'protein',
        'share of the egg yolk removed without detergent (B)',
        '1',
        true,
        control(0.1, 'protein soils: removal near zero unless the enzyme is present'),
        single('B', (run) => 1 - residualFraction(run, 'plate')),
      ),
      check(
        'tea',
        'share of the tea film removed without detergent (D)',
        '1',
        true,
        control(0.1, 'tea stays'),
        single('D', (run) => 1 - meanOver(run, ['cup_1', 'cup_2'], residualFraction)),
      ),
      check(
        'score',
        'mean IEC score of the three pieces, blocked minus free',
        'score',
        true,
        band(
          -1,
          0.5,
          5,
          'load mean -1.5 or more',
          'a third of the stated drop or more; the sign must be right',
        ),
        (runs) => {
          const free =
            (score(runs['A'] as CaseRun, 'plate') +
              2 * meanOver(runs['C'] as CaseRun, ['cup_1', 'cup_2'], score)) /
            3;
          const blocked =
            (score(runs['B'] as CaseRun, 'plate') +
              2 * meanOver(runs['D'] as CaseRun, ['cup_1', 'cup_2'], score)) /
            3;
          return { a: free, b: blocked, value: blocked - free };
        },
      ),
    ],
  },
  {
    id: 'P26',
    title: 'Tablet trapped or dissolving in a dead spot',
    group: 'D',
    mechanism:
      'A tablet that lands in a cutlery basket, an upright bowl or a rack corner dissolves slowly and locally',
    test: 'A dessert plate with egg yolk washed with the tablet released into its tray (A) against a tablet that lands in an upright bowl (B)',
    adapted:
      'The wash has no input for where the tablet lands; B is washed as A until it has one, and the scenario is reported as not covered.',
    requires: ['tablet_transport'],
    stages: 'soil: liquor (tablet transport and local dissolution, not built)',
    resolutionSensitive: false,
    cases: [
      {
        label: 'A',
        what: 'tablet in its tray',
        load: 'plate-facing',
        soils: byId({ plate: [egg('well')] }),
        surfaces: [{ item: 'plate', regions: ['well'] }],
      },
      {
        label: 'B',
        what: 'tablet in an upright bowl',
        load: 'plate-facing',
        soils: byId({ plate: [egg('well')] }),
        surfaces: [{ item: 'plate', regions: ['well'] }],
      },
    ],
    checks: [
      check(
        'score',
        'change of the IEC score of the plate, B - A',
        'score',
        true,
        direction(-1, 'similar to under-dosing; size unknown: calibration parameter'),
        difference('A', 'B', (run) => score(run, 'plate')),
      ),
    ],
  },
  {
    id: 'P27',
    title: 'Time and temperature trade',
    group: 'D',
    mechanism: 'Hydration, enzymatic and bleach reactions need time; fat needs temperature',
    test: 'A dessert plate with egg yolk (well) and porridge (rim) in the lower basket on the short programme (A, Express 65, 1 h), the eco programme (B, Eco 50, 4 h 55 min) and the intensive programme (C, Intensive 70)',
    adapted:
      "The three programmes are those of the owner's machine as the machine package models them.",
    stages:
      'soil: liquor (temperature course, enzyme life), hydration, chemistry; machine: programme timeline',
    resolutionSensitive: false,
    cases: [
      {
        label: 'A',
        what: 'Express 65',
        load: 'plate-facing',
        programme: 'express_65',
        soils: byId({ plate: [egg('well'), oats('rim')] }),
        surfaces: [{ item: 'plate', regions: ['well', 'rim'] }],
      },
      {
        label: 'B',
        what: 'Eco 50',
        load: 'plate-facing',
        programme: ECO_PROGRAMME,
        soils: byId({ plate: [egg('well'), oats('rim')] }),
        surfaces: [{ item: 'plate', regions: ['well', 'rim'] }],
      },
      {
        label: 'C',
        what: 'Intensive 70',
        load: 'plate-facing',
        programme: 'intensive_70',
        soils: byId({ plate: [egg('well'), oats('rim')] }),
        surfaces: [{ item: 'plate', regions: ['well', 'rim'] }],
      },
    ],
    checks: [
      check(
        'score',
        'IEC score of the plate, eco minus short',
        'score',
        true,
        scoreChange(0.45, 0.65, '270 min at 54 C gave 4.15; 97 min at 50 C gave 3.5 to 3.7'),
        difference('A', 'B', (run) => score(run, 'plate')),
      ),
      check(
        'residue',
        'share of the soil left on the plate, eco minus short',
        '1',
        false,
        direction(-1, 'short programmes fail on starch and protein', 0.01),
        difference('A', 'B', (run) => residualFraction(run, 'plate')),
      ),
      check(
        'intensive',
        'share of the soil left on the plate, intensive minus short',
        '1',
        false,
        direction(-1, 'more time and temperature remove more', 0.01),
        difference('A', 'C', (run) => residualFraction(run, 'plate')),
      ),
    ],
  },
  {
    id: 'P28',
    title: 'Bleachable stains are position-insensitive (negative control)',
    group: 'D',
    mechanism: 'Tea film needs oxidant, temperature and time; any wetted position gets them',
    test: 'Two tea cups with tea film mouth down in the upper basket, one near the axis of the upper arm and one in a corner outside the swept circle, with the standard detergent (A) and with a bleach-free one (B)',
    adapted:
      'The corner cup stands on the knife shelf at the rear left. Bleach-free: the detergent without percarbonate and TAED (`liq.xPeroxide`, `liq.xTaed` = 0).',
    stages: 'water: droplets, run-off (wetting); soil: chemistry (bleach), supply factor',
    resolutionSensitive: false,
    cases: [
      {
        label: 'A',
        what: 'with bleach',
        load: 'cups-centre-corner',
        soils: byPrefix('cup', [tea('interior')]),
        surfaces: [
          { item: 'cup_1', regions: ['interior'] },
          { item: 'cup_2', regions: ['interior'] },
        ],
      },
      {
        label: 'B',
        what: 'bleach-free detergent',
        load: 'cups-centre-corner',
        soils: byPrefix('cup', [tea('interior')]),
        params: { 'liq.xPeroxide': 0, 'liq.xTaed': 0 },
        surfaces: [
          { item: 'cup_1', regions: ['interior'] },
          { item: 'cup_2', regions: ['interior'] },
        ],
      },
    ],
    checks: [
      check(
        'position',
        'IEC score of the corner cup minus the centre cup (A)',
        'score',
        true,
        control(0.5, 'tea cups in the best and worst spray positions differ by at most 0.5'),
        single('A', (run) => score(run, 'cup_2') - score(run, 'cup_1')),
      ),
      check(
        'bleach',
        'share of the tea film removed without bleach (B)',
        '1',
        true,
        control(0.1, 'without bleach all fail'),
        single('B', (run) => 1 - meanOver(run, ['cup_1', 'cup_2'], residualFraction)),
      ),
      check(
        'with',
        'share of the tea film removed with bleach, mean of the two cups (A)',
        '1',
        false,
        band(1, 0.5, 1, 'with oxidant, temperature and time the film goes', 'at least half'),
        single('A', (run) => 1 - meanOver(run, ['cup_1', 'cup_2'], residualFraction)),
      ),
      check(
        'f_jet',
        'fraction of time the inside is under a direct jet, corner over centre, minus one (A)',
        '1',
        false,
        direction(-1, 'the corner is the worst spray position', 0.05),
        single('A', (run) => {
          const centre = fJet(run, 'cup_1', ['interior']);
          return centre > 0 ? fJet(run, 'cup_2', ['interior']) / centre - 1 : 0;
        }),
      ),
    ],
  },
  {
    id: 'P29',
    title: 'Ageing of the soil before the wash',
    group: 'D',
    mechanism: 'Drying raises cohesion and adhesion; heat denatures and cross-links',
    test: 'A dessert plate with egg yolk in the lower basket at three ageing levels: fresh (A, 15 min), oven-dried 2 h at 80 C (B), baked on at 125 C (C)',
    adapted:
      'One plate instead of a load; the baked level is the heat history `cooked` of the soil model (125 C), the nearest to 130 to 140 C.',
    stages: 'soil: hydration (lag), bake index, removal laws',
    resolutionSensitive: false,
    cases: [
      {
        label: 'A',
        what: 'fresh',
        load: 'plate-facing',
        soils: byId({ plate: [{ ...egg('well'), age_h: 0.25, heat: 'none' }] }),
        surfaces: [{ item: 'plate', regions: ['well'] }],
      },
      {
        label: 'B',
        what: 'oven-dried 2 h at 80 C',
        load: 'plate-facing',
        soils: byId({ plate: [egg('well')] }),
        surfaces: [{ item: 'plate', regions: ['well'] }],
      },
      {
        label: 'C',
        what: 'baked on at 125 C',
        load: 'plate-facing',
        soils: byId({ plate: [{ ...egg('well'), heat: 'cooked' }] }),
        surfaces: [{ item: 'plate', regions: ['well'] }],
      },
    ],
    checks: [
      check(
        'fresh',
        'IEC score of the fresh plate, as a distance from 4.5 to 5 (A)',
        'score',
        true,
        within(1, 'crockery mean at least 4.5 fresh'),
        single('A', (run) => outside(score(run, 'plate'), 4.5, 5)),
      ),
      check(
        'dried',
        'IEC score of the oven-dried plate, as a distance from 2.3 to 3.7 (B)',
        'score',
        true,
        within(1, 'crockery 2.3 to 3.7 oven-dried'),
        single('B', (run) => outside(score(run, 'plate'), 2.3, 3.7)),
      ),
      check(
        'baked',
        'IEC score, baked minus oven-dried',
        'score',
        true,
        band(
          -1,
          0,
          5,
          'at least 1 point lower again for 130 to 140 C baking',
          'lower by any amount; the sign must be right',
        ),
        difference('B', 'C', (run) => score(run, 'plate')),
      ),
      check(
        'order',
        'share of the egg yolk left, baked minus fresh',
        '1',
        false,
        direction(1, 'ageing leaves more', 0.01),
        difference('A', 'C', (run) => residualFraction(run, 'plate')),
      ),
    ],
  },
];
