/**
 * Group A of the checklist (docs/research/standards.md section 9.2): spray access and
 * shadowing, P01 to P14, as washes of the owner's Bosch SMV4HAX40G on the scored programme (Eco 50) unless a run names another.
 *
 * Loads are those of `phenomena/builder/recipes.ts` (settled by the loading physics) unless a
 * scenario says the pose is set. Soils are the IEC soils oven-dried 2 h at 80 C.
 */

import { quatRotate, type Vec3 } from '@spotless/core';
import { buildMachineGeometry, PRIMARY_MACHINE, type MachineConfig } from '@spotless/machine';
import { control, direction, outside, quantity, scoreChange, within } from './bands.ts';
import { cleared, CLEAR_MARGIN, machineGap } from './clearance.ts';
import { band, byId, byPrefix, egg, milk, oats, tea } from './kit.ts';
import { armHeldAt, boxCentre, lowestPoint, readLoad, standing } from './loads.ts';
import {
  check,
  difference,
  fJet,
  futureField,
  meanOver,
  pooled,
  ratio,
  regionResidual,
  relative,
  residualFraction,
  score,
  single,
  zone,
} from './measures.ts';
import type { CaseRun, LoadItem, Scenario } from './types.ts';

/** The upper half of an item standing on edge: soil elements above the centre of its box. */
function upperHalf(run: CaseRun, itemId: string): (point: readonly number[]) => boolean {
  const item = run.items.find((i) => i.itemId === itemId);
  if (item === undefined) throw new Error(`no item ${itemId}`);
  const middle = boxCentre(item.typeId, item.pose)[2];
  return (point) => (point[2] as number) > middle;
}

const upperScore =
  (itemId: string) =>
  (run: CaseRun): number =>
    zone(run, itemId, upperHalf(run, itemId)).score;

/** The row of tall tines of the upper basket a glass is set over, and that row folded down. */
const TINE_ROW = { basketId: 'upper', rowId: 'c_rear' } as const;

const rowFolded = (config: MachineConfig): MachineConfig => ({
  ...config,
  foldedTineRows: [...config.foldedTineRows, TINE_ROW],
});

/**
 * A glass set exactly mouth down with its axis over the tip of a tine of row C (rear half) of
 * the upper basket, at the lowest height (from where its rim stood on the floor of the basket,
 * in steps of 1 mm) at which it is clear of the basket both with the row up (the tine stands
 * inside the glass) and with the row folded down (no tine): its rim then lies just above the
 * rail of the row.
 */
function overTine(items: readonly LoadItem[]): readonly LoadItem[] {
  const up = PRIMARY_MACHINE.defaultConfig;
  const geometry = buildMachineGeometry(PRIMARY_MACHINE, up);
  const row = geometry.affordances.tineRows.find((r) => r.rowId === TINE_ROW.rowId);
  const basket = geometry.affordances.baskets.find((b) => b.basketId === TINE_ROW.basketId);
  const tine = row?.tines[2];
  if (row === undefined || basket === undefined || tine === undefined) {
    throw new Error('the machine has no row c_rear in its upper basket');
  }
  return items.map((item) => {
    if (item.itemId !== 'glass') return item;
    const low = lowestPoint(item.typeId, item.pose);
    const upsideDown = { p: [0, 0, 0] as const, q: [1, 0, 0, 0] as const };
    const centre = boxCentre(item.typeId, upsideDown);
    const bottom = lowestPoint(item.typeId, upsideDown);
    // The rail of the row runs under the rim of the glass: the glass is lifted until it clears it.
    for (let lift = 0; lift <= 0.024; lift += 0.001) {
      const set: LoadItem = {
        ...item,
        pose: {
          p: [
            basket.originTub[0] + tine.tip[0] - centre[0],
            basket.originTub[1] + tine.tip[1] - centre[1],
            low - bottom + lift,
          ],
          q: [1, 0, 0, 0],
        },
        exact: true,
      };
      if (
        machineGap(set.typeId, set.pose, up).gap >= CLEAR_MARGIN &&
        machineGap(set.typeId, set.pose, rowFolded(up)).gap >= CLEAR_MARGIN
      ) {
        return set;
      }
    }
    throw new Error('the glass does not stand clear over the tine with the row up and folded');
  });
}

const DEG = Math.PI / 180;

/** Tub-frame position of the wide gap of rows R1/R2, where a plate can lean either way, metres. */
const WIDE_GAP = { x: 0.0565, y: 0.1115, railTop: 0.0895 };

function leaning(sign: 1 | -1): (items: readonly LoadItem[]) => readonly LoadItem[] {
  // The face looks towards the arm axis (-x); leaning towards the axis tips it down by 10
  // degrees (it presents its face to the jets from below), leaning away tips it up.
  const normal = [-Math.cos(10 * DEG), 0, -sign * Math.sin(10 * DEG)] as const;
  return (items) =>
    items.map((item) =>
      item.itemId === 'plate'
        ? cleared(standing(item, normal, WIDE_GAP.x, WIDE_GAP.y, WIDE_GAP.railTop), [1, 0, 0])
        : item,
    );
}

/** The plate standing exactly upright in the wide gap, its face along +x or -x. */
/** The horizontal direction an item on edge faces (across the rail it stands on), tub frame. */
function facing(item: LoadItem): Vec3 {
  const normal = quatRotate(item.pose.q, [0, 0, 1]);
  const flat = Math.hypot(normal[0], normal[1]);
  return [normal[0] / flat, normal[1] / flat, 0];
}

/**
 * The seated item `id` stood exactly upright `behind` metres behind where it stands (the
 * centre of its box, its lowest point; behind: against the way it faces), facing the way it
 * faces (`sign` 1) or the other way (-1), and moved by the smallest step at which it is clear
 * of the basket.
 */
function uprightBehindSeat(
  id: string,
  sign: 1 | -1,
  behind: number,
): (items: readonly LoadItem[]) => readonly LoadItem[] {
  return (items) =>
    items.map((item) => {
      if (item.itemId !== id) return item;
      const way = facing(item);
      const centre = boxCentre(item.typeId, item.pose);
      const low = lowestPoint(item.typeId, item.pose);
      return cleared(
        standing(
          item,
          [sign * way[0], sign * way[1], 0],
          centre[0] - behind * way[0],
          centre[1] - behind * way[1],
          low,
        ),
        way,
      );
    });
}

/**
 * How far behind its outermost seat the platter of P14 stands, metres: between the last tine
 * and the side wall of the basket, the one place on the present basket where it clears the
 * tines either way round.
 */
const PLATTER_AT_WALL = 0.03;

/**
 * The platter of P05 stood upright between the two plates and the arm axis: in line with the
 * plates, 19 mm inboard of the inner one, facing as the seated platter faces, at its height,
 * and moved by the smallest step at which it is clear of the basket. On the present basket
 * the loader finds no seat for a 32 cm platter inboard of the plates, and the seated platter
 * moved along the row cuts into the tines of the next rows.
 */
function platterInboard(items: readonly LoadItem[]): readonly LoadItem[] {
  const inner = items.find((item) => item.itemId === 'plate_2');
  if (inner === undefined) throw new Error('no plate_2');
  return items.map((item) => {
    if (item.itemId !== 'board') return item;
    const way = facing(item);
    const low = lowestPoint(item.typeId, item.pose);
    const x = inner.pose.p[0] + PLATTER_INBOARD * Math.sign(-inner.pose.p[0]);
    return cleared(standing(item, way, x, inner.pose.p[1], low), [1, 0, 0]);
  });
}

/** Distance of the upright platter of P05 B inboard of the inner plate, metres. */
const PLATTER_INBOARD = 0.019;

function upright(sign: 1 | -1): (items: readonly LoadItem[]) => readonly LoadItem[] {
  return (items) =>
    items.map((item) =>
      item.itemId === 'plate'
        ? cleared(standing(item, [sign, 0, 0], WIDE_GAP.x, WIDE_GAP.y, WIDE_GAP.railTop), [1, 0, 0])
        : item,
    );
}

/** Half the pitch of the tines of rows R1 and R2 (18.25 mm), metres. */
const HALF_PITCH = 0.009125;

/** The two rows of tines of the rear lane of the lower basket, which fold down. */
const REAR_ROWS = [
  { basketId: 'lower', rowId: 'r1' },
  { basketId: 'lower', rowId: 'r2' },
] as const;

/** The rear lane with its tines folded down: the rails with nothing standing on them. */
export const rearRowsFolded = (config: MachineConfig): MachineConfig => ({
  ...config,
  foldedTineRows: [...config.foldedTineRows, ...REAR_ROWS],
});

/** Heights by which the row is raised until it clears the folded tines, metres (1 mm steps). */
const PAIR_LIFTS = Array.from({ length: 13 }, (_unused, i) => i / 1000);

/** The pair of the crowded row whose covered plate the scenario scores, and its place in the row. */
const SCORED_PAIR = { odd: 'plate_5', even: 'plate_6', index: 2 } as const;

/** Distance from one pair of the crowded row to the next: two slots, metres. */
const PAIR_SPACING = 0.0365;

/**
 * The pairs of the crowded row of P03 B (`plates-9`: plate 2k+1 seated in a slot, plate 2k+2
 * pushed in beside it; pairs in slots 2, 4, 6 and 8) set half a pitch apart on the rear lane
 * with its tines folded down ({@link rearRowsFolded}).
 *
 * With the tines up no such row exists in this basket. A slot is 14 mm wide between its tines,
 * and the loading physics lets two of these plates in one slot nest: the well of the covered
 * one then lies 0.2 to 1 mm from the back of its partner over its whole area
 * (`scripts/pair-gap.ts`), a contact and not the narrow open gap the phenomenon is about
 * (found by the review of 11 October 2026); a plate set half a pitch in front of a seated one
 * stands in the next tine. So the tines are folded, as the owner folds them for pots, and the
 * row is set from one seat the physics found: that of the plate of the scored pair (slot 6)
 * that stood behind (against the way the pair faces). The even-numbered plate of every pair,
 * the covered one, stands at that seat moved two slots along the row per pair, with the same
 * lean; its partner stands parallel to it, half a pitch in front. The whole row is raised by
 * the smallest whole number of millimetres at which every plate is clear of the folded tines
 * that now lie under it (11 mm on the present basket). All eight are flagged `exact`. The
 * covered well then looks into a gap of 3.7 to 5 mm; neighbouring pairs, being parallel, stay
 * 27 mm apart. (Each pair keeping the lean the physics gave it, they do not: the pairs lean by
 * 4 to 12 degrees and one cuts into the next.)
 */
export function pairsAtHalfPitch(items: readonly LoadItem[]): readonly LoadItem[] {
  const folded = rearRowsFolded(readLoad('plates-9').config as MachineConfig);
  const byId = new Map(items.map((item) => [item.itemId, item]));
  const odd = byId.get(SCORED_PAIR.odd);
  const even = byId.get(SCORED_PAIR.even);
  if (odd === undefined || even === undefined) throw new Error('no scored pair of plates');
  const way = facing(odd);
  const along = (of: LoadItem): number => {
    const centre = boxCentre(of.typeId, of.pose);
    return centre[0] * way[0] + centre[1] * way[1];
  };
  const seat = along(odd) <= along(even) ? odd : even;
  const pairs = items
    .map((item) => Number(item.itemId.replace('plate_', '')))
    .filter((number) => Number.isInteger(number) && number % 2 === 1)
    .map((number) => ({
      odd: byId.get(`plate_${number}`),
      even: byId.get(`plate_${number + 1}`),
      index: (number - 1) / 2,
    }));
  for (const lift of PAIR_LIFTS) {
    const set = new Map<string, LoadItem>();
    let clear = true;
    for (const pair of pairs) {
      if (pair.odd === undefined || pair.even === undefined) continue;
      const shift = (pair.index - SCORED_PAIR.index) * PAIR_SPACING;
      const at = (ahead: number): { p: Vec3; q: typeof seat.pose.q } => ({
        p: [
          seat.pose.p[0] + (shift + ahead) * way[0],
          seat.pose.p[1] + (shift + ahead) * way[1],
          seat.pose.p[2] + lift,
        ],
        q: seat.pose.q,
      });
      const covered = at(0);
      const partner = at(HALF_PITCH);
      if (
        machineGap(pair.even.typeId, covered, folded).gap < CLEAR_MARGIN ||
        machineGap(pair.odd.typeId, partner, folded).gap < CLEAR_MARGIN
      ) {
        clear = false;
        break;
      }
      set.set(pair.even.itemId, { ...pair.even, pose: covered, exact: true });
      set.set(pair.odd.itemId, { ...pair.odd, pose: partner, exact: true });
    }
    if (clear) return items.map((item) => set.get(item.itemId) ?? item);
  }
  throw new Error(
    `the crowded row is not clear of the folded tines at any height within ${(PAIR_LIFTS.length - 1).toFixed(0)} mm`,
  );
}

export const GROUP_A: readonly Scenario[] = [
  {
    id: 'P01',
    title: 'Hollow item loaded open side up',
    group: 'A',
    mechanism:
      'Jets travel upward and cannot enter; the item fills from falling water and is never emptied',
    test: 'A mug with tea film and a cereal bowl with porridge on the floor of the upper basket: mouth down (A) against mouth up (B)',
    adapted:
      'Upper basket of the Bosch (served from below by the upper arm and from above by the roof sprayer). Both orientations are dropped at the same spots and settle on the wires; the upright bowl slides about 13 cm before it rests.',
    stages: 'water: scene (basins), jets, pools; soil: replay under a pool',
    resolutionSensitive: true,
    cases: [
      {
        label: 'A',
        what: 'mouth down',
        load: 'hollow-inverted',
        soils: byId({ mug: [tea('interior')], bowl: [oats('interior')] }),
        surfaces: [
          { item: 'mug', regions: ['interior'] },
          { item: 'bowl', regions: ['interior'] },
        ],
      },
      {
        label: 'B',
        what: 'mouth up',
        load: 'hollow-upright',
        soils: byId({ mug: [tea('interior')], bowl: [oats('interior')] }),
        surfaces: [
          { item: 'mug', regions: ['interior'] },
          { item: 'bowl', regions: ['interior'] },
        ],
      },
    ],
    checks: [
      check(
        'retained',
        'water the mug holds at the end, B - A',
        'mL',
        true,
        quantity(250, 300, 'retained liquid equals the brim volume, about 0.25 to 0.3 L for a mug'),
        difference('A', 'B', (run) => pooled(run, 'mug')),
      ),
      check(
        'f_jet',
        'fraction of time the inside of the upright mug is under a direct jet from below (B)',
        '1',
        true,
        control(0.001, 'f_jet inside = 0'),
        single('B', (run) => fJet(run, 'mug', ['interior'])),
      ),
      check(
        'bowl',
        'water the bowl holds at the end, B - A',
        'mL',
        false,
        direction(1, 'the bowl fills too'),
        difference('A', 'B', (run) => pooled(run, 'bowl')),
      ),
      check(
        'drying',
        'drying score of the upright mug (B)',
        'score',
        false,
        control(0.25, 'drying score 0'),
        single('B', (run) => futureField(run.item('mug'), 'drying', 'score')),
        ['drying'],
      ),
    ],
  },
  {
    id: 'P02',
    title: 'Soiled face turned away from the spray source',
    group: 'A',
    mechanism: 'No line of sight from any nozzle to the soiled face; splash and falling film only',
    test: 'A dessert plate with oven-dried egg yolk on its eating face standing upright in the wide gap of the rear rows of the lower basket: face to the arm axis (A) against turned round in the same place (B). Beside it, the plate as the loading physics seats it in R1 slot 5: facing the axis (C), and put in reversed and left to settle (D)',
    adapted:
      'A porcelain dessert plate stands in for the dinner plate. A and B are set poses: the plate stands exactly upright (no lean) about 56 mm right of the arm axis, where the tines lean apart and leave room for it either way round; the runner checks that it cuts into nothing. In a slot between tines the same plate cannot simply be turned round: the tines lean outwards, the seated plate faces the axis tipped up with the tines. The pair of the first build that compared the seated plate with one put in reversed is gone: on the present basket the loader does not seat a reversed plate in that slot, and the seated plate turned round in place cuts 2 mm into the tines.',
    stages:
      'water: jets (line of sight), droplets, run-off; soil: removal laws; load: physics (how a reversed plate sits)',
    resolutionSensitive: true,
    cases: [
      {
        label: 'A',
        what: 'upright, face to the arm axis (set pose)',
        load: 'plate-facing',
        edit: upright(-1),
        soils: byId({ plate: [egg('well')] }),
        surfaces: [{ item: 'plate', regions: ['well'] }],
      },
      {
        label: 'B',
        what: 'upright, face away from the arm axis (set pose)',
        load: 'plate-facing',
        edit: upright(1),
        soils: byId({ plate: [egg('well')] }),
        surfaces: [{ item: 'plate', regions: ['well'] }],
      },
    ],
    checks: [
      check(
        'f_jet',
        'fraction of time the soiled face is under a direct jet, B over A',
        '1',
        true,
        control(0.05, 'f_jet on the soiled face drops to about 0'),
        ratio('A', 'B', (run) => fJet(run, 'plate', ['well'])),
      ),
      check(
        'score',
        'change of the IEC score of the plate, B - A',
        'score',
        true,
        scoreChange(-1, -2, 'for oven-dried protein and starch, -1 to -2'),
        difference('A', 'B', (run) => score(run, 'plate')),
      ),
      check(
        'residue',
        'share of the egg yolk left on the face, B - A',
        '1',
        false,
        direction(1, 'removal depends on how often the spot is hit', 0.01),
        difference('A', 'B', (run) => residualFraction(run, 'plate')),
      ),
    ],
  },
  {
    id: 'P03',
    title: 'Plate pitch too small',
    group: 'A',
    mechanism:
      'The time a nozzle spends under a gap and the height an inclined jet reaches both scale with the gap',
    test: 'Rows of IEC dinner plates with egg yolk in the rear lane of the lower basket: two to a slot half a pitch apart (about 9 mm from plate to plate, B), one per slot (18.25 mm, A), every second slot (36.5 mm, C); the plate at slot 6 is scored on its upper half (in B the one of the pair whose face is covered by the other)',
    adapted:
      "The tines of the Bosch fix the pitch at 18.25 mm, so the checklist's 12, 20 and 30 mm become half a pitch, every slot and every second slot. Seven plates per row (eight when crowded). A and C are settled by the loading physics between the tines. B cannot be: a slot is 14 mm wide, two plates in it nest (the covered well under 1 mm from its partner's back over its whole area: a contact, not a narrow gap; found by the review of 11 October 2026), and a plate half a pitch in front of a seated one stands in the next tine. For B the tines of the rear lane are folded down and the row is set from the seat the physics gave the plate behind in slot 6: the covered plate of every pair stands at that seat, two slots along per pair, its partner parallel to it half a pitch (9.1 mm) in front, and the whole row is raised by the 11 mm at which it clears the folded tines; the covered well then looks into a gap of 3.7 to 5 mm. So B differs from A by the pitch, by 11 mm of height and by the tines, which in A stand in front of the foot of every plate.",
    stages: 'water: jets (gap geometry), run-off; soil: removal laws',
    resolutionSensitive: true,
    cases: [
      {
        label: 'A',
        what: 'one per slot, 18.25 mm',
        load: 'plates-18',
        soils: byPrefix('plate', [egg('well', 3)]),
        cells: true,
        surfaces: [{ item: 'plate_4', regions: ['well'] }],
      },
      {
        label: 'B',
        what: 'two to a slot, about 9 mm',
        load: 'plates-9',
        edit: pairsAtHalfPitch,
        config: rearRowsFolded,
        soils: byPrefix('plate', [egg('well', 3)]),
        cells: true,
        surfaces: [{ item: 'plate_6', regions: ['well'] }],
      },
      {
        label: 'C',
        what: 'every second slot, 36.5 mm',
        load: 'plates-36',
        soils: byPrefix('plate', [egg('well', 3)]),
        cells: true,
        surfaces: [{ item: 'plate_4', regions: ['well'] }],
      },
    ],
    checks: [
      check(
        'halving',
        'IEC score of the upper half of the plate at slot 6, 9 mm against 18 mm',
        'score',
        true,
        scoreChange(
          -0.5,
          -1.5,
          'halving the pitch: -0.5 to -1.5 on tenacious soil in the upper half',
        ),
        (runs) => {
          const a = upperScore('plate_4')(runs['A'] as CaseRun);
          const b = upperScore('plate_6')(runs['B'] as CaseRun);
          return { a, b, value: b - a };
        },
      ),
      check(
        'plateau',
        'IEC score of the upper half of the plate at slot 6, 36 mm against 18 mm',
        'score',
        true,
        control(0.5, 'above about 20 mm, more gap gains little'),
        (runs) => {
          const a = upperScore('plate_4')(runs['A'] as CaseRun);
          const c = upperScore('plate_4')(runs['C'] as CaseRun);
          return { a, b: c, value: c - a };
        },
      ),
      check(
        'dwell',
        'fraction of time the face is under a direct jet, 9 mm over 18 mm, minus one',
        '1',
        false,
        quantity(-0.5, -0.5, 'halving the gap halves the dwell'),
        (runs) => {
          const a = fJet(runs['A'] as CaseRun, 'plate_4', ['well']);
          const b = fJet(runs['B'] as CaseRun, 'plate_6', ['well']);
          return { a, b, value: a > 0 ? b / a - 1 : 0 };
        },
      ),
    ],
  },
  {
    id: 'P04',
    title: 'Nesting or "spooning" of like items',
    group: 'A',
    mechanism:
      'Overlapped surfaces have no line of sight; narrow gaps hold liquid that does not exchange',
    test: 'Two cereal bowls with porridge inside, mouth down in the upper basket: side by side (A) against the second dropped onto the first (B)',
    adapted:
      "The gap of the nested pair is what the bowls' own shape leaves when one settles on the other (not a set 2 mm); the separated pair stands side by side, not 25 mm apart on one axis, which nothing in the basket would hold.",
    stages: 'water: scene (contacts, gap field), jets, run-off; soil: supply factor',
    resolutionSensitive: true,
    cases: [
      {
        label: 'A',
        what: 'side by side',
        load: 'bowls-apart',
        soils: byPrefix('bowl', [oats('interior')]),
        surfaces: [{ item: 'bowl_over', regions: ['interior'] }],
      },
      {
        label: 'B',
        what: 'nested',
        load: 'bowls-nested',
        soils: byPrefix('bowl', [oats('interior')]),
        surfaces: [{ item: 'bowl_over', regions: ['interior'] }],
      },
    ],
    checks: [
      check(
        'residue',
        'share of the porridge left inside the covering bowl when nested (B)',
        '1',
        true,
        band(
          1,
          0.25,
          1,
          'residual soil in the overlapped zone at least 50 %',
          'half the stated share or more',
        ),
        single('B', (run) => residualFraction(run, 'bowl_over')),
      ),
      check(
        'score',
        'IEC score of the covering bowl when nested (B)',
        'score',
        true,
        control(0.5, 'if the overlapped soiled area exceeds 200 mm2 the item scores 0'),
        single('B', (run) => score(run, 'bowl_over')),
      ),
      check(
        'against',
        'share of the porridge left inside that bowl, B - A',
        '1',
        false,
        direction(1, 'nesting leaves more', 0.01),
        difference('A', 'B', (run) => residualFraction(run, 'bowl_over')),
      ),
      check(
        'f_jet',
        'fraction of time its inside is under a direct jet, B over A',
        '1',
        false,
        control(0.25, 'overlapped surfaces have no line of sight'),
        ratio('A', 'B', (run) => fJet(run, 'bowl_over', ['interior'])),
      ),
    ],
  },
  {
    id: 'P05',
    title: 'Large flat item shadows what is behind or above it',
    group: 'A',
    mechanism: 'A tray, board or platter intercepts every jet whose straight path crosses it',
    test: 'Two dessert plates with egg yolk in the left front lane of the lower basket, faces to the arm axis; a 32 cm oval platter on edge outboard of them at the side wall (A) against inboard of them, between the plates and the arm axis (B)',
    adapted:
      'A 32 cm platter on edge stands in for the baking tray, which is too tall to stand in the lower basket of this machine. Items above it in the upper basket are not scored: the upper basket has its own arm underneath, so the lower basket does not shadow it from its main spray.',
    stages: 'water: jets (line of sight), droplets; soil: removal laws',
    resolutionSensitive: true,
    cases: [
      {
        label: 'A',
        what: 'platter at the side wall',
        load: 'board-side',
        soils: byPrefix('plate', [egg('well')]),
        surfaces: [
          { item: 'plate_1', regions: ['well'] },
          { item: 'plate_2', regions: ['well'] },
        ],
      },
      {
        label: 'B',
        what: 'platter upright between the plates and the arm axis (set pose)',
        load: 'board-side',
        edit: platterInboard,
        soils: byPrefix('plate', [egg('well')]),
        surfaces: [
          { item: 'plate_1', regions: ['well'] },
          { item: 'plate_2', regions: ['well'] },
        ],
      },
    ],
    checks: [
      check(
        'score',
        'mean IEC score of the two plates, B - A',
        'score',
        true,
        scoreChange(-1, -3, '-1 to -3 for tenacious soils on faces served only by that arm'),
        difference('A', 'B', (run) => meanOver(run, ['plate_1', 'plate_2'], score)),
      ),
      check(
        'f_jet',
        'fraction of time their faces are under a direct jet, B over A, minus one',
        '1',
        true,
        direction(-1, 'items inside the shadow lose direct impingement from that arm', 0.05),
        relative('A', 'B', (run) =>
          meanOver(run, ['plate_1', 'plate_2'], (r, id) => fJet(r, id, ['well'])),
        ),
      ),
    ],
  },
  {
    id: 'P06',
    title: 'Spray arm stalled by an item',
    group: 'A',
    mechanism: "Something in the arm's path stops its rotation; the jets then hit fixed lines",
    test: 'Seven IEC dinner plates with egg yolk in every second slot of the rear lane (A); the same with a ladle let down through the floor of the lower basket until it hangs in the path of the lower arm (B)',
    adapted:
      "A ladle stands in for the fork: a fork slips through the floor grid of this basket and falls, a ladle hangs by its bowl. On the present basket the ladle no longer hangs through the floor, so the arm is held by the scenario at the angle the first build's check found (148 degrees round); the wash takes a held arm as it takes one a load stops.",
    stages: 'load: session (mechanical check); water: hydraulics (stalled arm), jets',
    resolutionSensitive: false,
    cases: [
      {
        label: 'A',
        what: 'arm free',
        load: 'plates-36',
        soils: byPrefix('plate', [egg('well', 3)]),
        surfaces: [{ item: 'plate_4', regions: ['well'] }],
      },
      {
        label: 'B',
        what: 'lower arm held 148 degrees round (set: where the hanging ladle of the first build stopped it)',
        load: 'plates-36',
        stall: armHeldAt('lower_arm', 148),
        soils: byPrefix('plate', [egg('well', 3)]),
        surfaces: [{ item: 'plate_4', regions: ['well'] }],
      },
    ],
    checks: [
      check(
        'coverage',
        "share of the plates' faces ever under a direct jet, B over A",
        '1',
        true,
        control(
          0.1,
          'direct coverage falls from the swept circle (about 70 % of the rack) to the jet footprints (about 1 %)',
        ),
        ratio('A', 'B', (run) =>
          meanOver(
            run,
            [1, 2, 3, 4, 5, 6, 7].map((k) => `plate_${k}`),
            (r, id) => r.exposure(id, ['well']).jetAreaShare,
          ),
        ),
      ),
      check(
        'score',
        'mean IEC score of the plates of that rack, B - A',
        'score',
        true,
        band(
          -1,
          0.5,
          5,
          'mean score of that rack -1.5 or more',
          'a third of the stated drop or more; the sign must be right',
        ),
        difference('A', 'B', (run) =>
          meanOver(
            run,
            [1, 2, 3, 4, 5, 6, 7].map((k) => `plate_${k}`),
            score,
          ),
        ),
      ),
    ],
  },
  {
    id: 'P07',
    title: 'Radial position: centre against corner',
    group: 'A',
    mechanism: 'Dwell per pass falls with radius; corners lie outside the swept circle',
    test: 'Soup plates with egg yolk in the lower basket at 112 mm from the arm axis (R1 slot 10), 155 mm (R1 slot 5) and 234 mm (ML slot 0, front left, outside the 230 mm swept circle)',
    adapted:
      'The cutlery basket stands at the centre of the lower basket of the Bosch, so the innermost seat is 112 mm out. The front-left seat is the nearest thing to a corner that holds a plate. The three plates are in one load, far enough apart not to shadow each other.',
    stages: 'water: hydraulics (nozzle positions), jets; soil: removal laws',
    resolutionSensitive: true,
    cases: [
      {
        label: 'A',
        what: 'four soup plates',
        load: 'soup-radial',
        soils: byPrefix('soup', [egg('well', 3)]),
        surfaces: [
          { item: 'soup_1', regions: ['well'] },
          { item: 'soup_2', regions: ['well'] },
          { item: 'soup_3', regions: ['well'] },
        ],
      },
    ],
    checks: [
      check(
        'score',
        'IEC score of the plate at the corner against the one at mid-radius',
        'score',
        true,
        scoreChange(-0.5, -1, '-0.5 to -1 for tenacious soil in a corner against mid-radius'),
        (runs) => {
          const run = runs['A'] as CaseRun;
          const a = score(run, 'soup_2');
          const b = score(run, 'soup_3');
          return { a, b, value: b - a };
        },
      ),
      check(
        'dwell',
        'fraction of time the face is under a direct jet, corner over mid-radius, minus one',
        '1',
        false,
        direction(-1, 'low radial locations are impacted for longer', 0.05),
        (runs) => {
          const run = runs['A'] as CaseRun;
          const a = fJet(run, 'soup_2', ['well']);
          const b = fJet(run, 'soup_3', ['well']);
          return { a, b, value: a > 0 ? b / a - 1 : 0 };
        },
      ),
    ],
  },
  {
    id: 'P08',
    title: 'Left/right asymmetry with rotation direction',
    group: 'A',
    mechanism:
      'Nozzle angles are fixed in the arm frame; a face meets approaching jets on one side and receding jets on the other',
    test: 'Two soup plates with egg yolk in mirror-image seats of the lower basket (ML slot 0, front left, and MR slot 4, front right), each facing the arm axis',
    adapted:
      'The two mirrored plates are washed in one load instead of mirroring a whole load: the lower basket of the Bosch is mirror-symmetric in these rows, so the pair isolates the sense of rotation.',
    stages: 'water: hydraulics (nozzle directions, sense of rotation), jets',
    resolutionSensitive: true,
    cases: [
      {
        label: 'A',
        what: 'mirrored plates',
        load: 'soup-radial',
        soils: byPrefix('soup', [egg('well', 3)]),
        surfaces: [
          { item: 'soup_3', regions: ['well'] },
          { item: 'soup_4', regions: ['well'] },
        ],
      },
    ],
    checks: [
      check(
        'score',
        'IEC score of the right-hand plate minus the left-hand one',
        'score',
        true,
        control(1, 'expect a change of up to 1 between mirrored positions'),
        (runs) => {
          const run = runs['A'] as CaseRun;
          const a = score(run, 'soup_3');
          const b = score(run, 'soup_4');
          return { a, b, value: b - a };
        },
      ),
      check(
        'jets',
        'fraction of time the face is under a direct jet, right over left, minus one',
        '1',
        false,
        control(
          1.5,
          'in one real arm a right-hand plate received five jets and its mirror image two',
        ),
        (runs) => {
          const run = runs['A'] as CaseRun;
          const a = fJet(run, 'soup_3', ['well']);
          const b = fJet(run, 'soup_4', ['well']);
          return { a, b, value: a > 0 ? b / a - 1 : 0 };
        },
      ),
    ],
  },
  {
    id: 'P09',
    title: 'Lean direction of plates',
    group: 'A',
    mechanism:
      'A plate leaning toward the oncoming jet presents its face; one leaning away presents its back',
    test: 'A dessert plate with egg yolk standing in the wide gap of the rear rows of the lower basket, soiled face to the arm axis: leaning 10 degrees toward the axis (A, face tipped down) against 10 degrees away (B, face tipped up)',
    adapted:
      'The pose is set, not settled: the tines of this basket hold a plate at 15 degrees one way only. The plate stands in the wide gap where the tines lean apart (about 56 mm right of the arm axis), moved by the smallest step that keeps it clear of rails and tines; the runner checks again that it cuts into nothing.',
    stages: 'water: jets (incidence), run-off; soil: removal laws',
    resolutionSensitive: true,
    cases: [
      {
        label: 'A',
        what: 'leaning toward the arm axis',
        load: 'plate-facing',
        edit: leaning(1),
        soils: byId({ plate: [egg('well')] }),
        surfaces: [{ item: 'plate', regions: ['well'] }],
      },
      {
        label: 'B',
        what: 'leaning away from the arm axis',
        load: 'plate-facing',
        edit: leaning(-1),
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
        scoreChange(-0.5, -0.5, 'same sign as P02 at smaller size: about 0.5 for a 10 degree lean'),
        difference('A', 'B', (run) => score(run, 'plate')),
      ),
      check(
        'f_jet',
        'fraction of time the soiled face is under a direct jet, B over A, minus one',
        '1',
        false,
        direction(-1, 'leaning away presents the back', 0.05),
        relative('A', 'B', (run) => fJet(run, 'plate', ['well'])),
      ),
    ],
  },
  {
    id: 'P10',
    title: 'Tall narrow vessel interior',
    group: 'A',
    mechanism:
      'A jet enters only while a near-vertical nozzle passes under the opening, and only steep jets reach the base',
    test: 'A 250 mL test glass (B) against a shallow dessert bowl (A), each with microwaved milk inside, mouth down at the same spot of the upper basket',
    adapted: 'Upper basket; both settle on the wires leaning on the same tine row.',
    stages: 'water: jets (entry into a cavity), run-off; soil: removal laws, chemistry',
    resolutionSensitive: true,
    cases: [
      {
        label: 'A',
        what: 'shallow bowl',
        load: 'bowl-same-spot',
        soils: byId({ bowl: [milk('interior')] }),
        surfaces: [{ item: 'bowl', regions: ['interior'] }],
      },
      {
        label: 'B',
        what: 'tall glass',
        load: 'glass-between',
        soils: byId({ glass: [milk('interior')] }),
        surfaces: [{ item: 'glass', regions: ['interior'] }],
      },
    ],
    checks: [
      check(
        'glass',
        'IEC score of the glass, as a distance from the range 2.3 to 4.0 (B)',
        'score',
        true,
        within(1, 'standard glass class (baked milk) scores 2.3 to 4.0'),
        single('B', (run) => outside(score(run, 'glass'), 2.3, 4.0)),
      ),
      check(
        'residue',
        'share of the milk left, glass minus bowl',
        '1',
        true,
        direction(1, 'the interior of the tall vessel is the last place to clean', 0.01),
        (runs) => {
          const a = residualFraction(runs['A'] as CaseRun, 'bowl');
          const b = residualFraction(runs['B'] as CaseRun, 'glass');
          return { a, b, value: b - a };
        },
      ),
      check(
        'f_jet',
        'fraction of time the inside is under a direct jet, glass over bowl, minus one',
        '1',
        false,
        direction(-1, 'a 60 mm opening is under a nozzle for about 6 % of a revolution', 0.05),
        (runs) => {
          const a = fJet(runs['A'] as CaseRun, 'bowl', ['interior']);
          const b = fJet(runs['B'] as CaseRun, 'glass', ['interior']);
          return { a, b, value: a > 0 ? b / a - 1 : 0 };
        },
      ),
    ],
  },
  {
    id: 'P11',
    title: 'Upper against lower rack for tenacious soil',
    group: 'A',
    mechanism: 'Which arm serves the surface, its share of flow, its distance',
    test: 'The same dessert plate with egg yolk standing in the rear lane of the lower basket (A) and in the rows of the upper basket (B)',
    adapted:
      'The dessert plate is the largest plate the upper basket takes. In the upper rows it does not stand as in the lower ones: the loading physics leaves it leaning about 50 degrees against the tines, which is the pose washed.',
    stages: 'water: hydraulics (flow per level), jets; soil: removal laws',
    resolutionSensitive: false,
    cases: [
      {
        label: 'A',
        what: 'lower basket',
        load: 'dplate-lower',
        soils: byId({ plate: [egg('well')] }),
        surfaces: [{ item: 'plate', regions: ['well'] }],
      },
      {
        label: 'B',
        what: 'upper basket',
        load: 'dplate-upper',
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
        control(0.5, 'in a three-level machine expect an absolute change of at most 0.5'),
        difference('A', 'B', (run) => score(run, 'plate')),
      ),
      check(
        'residue',
        'share of the egg yolk left, B - A',
        '1',
        false,
        control(0.2, 'little difference between the baskets'),
        difference('A', 'B', (run) => residualFraction(run, 'plate')),
      ),
    ],
  },
  {
    id: 'P12',
    title: 'Alternating large and small plates',
    group: 'A',
    mechanism: 'Above the rim of a small plate the gap seen by the large plates doubles',
    test: 'Dinner plates with egg yolk in neighbouring slots of the rear lane (A) against dinner and dessert plates alternating at the same 18.25 mm pitch (B); the dinner plate at slot 5 is scored on its upper half',
    adapted: 'Pitch 18.25 mm (the tines of the Bosch) instead of 15 mm.',
    stages: 'water: jets (gap geometry); soil: removal laws',
    resolutionSensitive: true,
    cases: [
      {
        label: 'A',
        what: 'large plates only',
        load: 'plates-18',
        soils: byPrefix('plate', [egg('well', 3)]),
        cells: true,
        surfaces: [{ item: 'plate_3', regions: ['well'] }],
      },
      {
        label: 'B',
        what: 'large and small alternating',
        load: 'plates-alt-18',
        soils: (item) => (item.itemId.startsWith('plate') ? [egg('well', 3)] : [egg('well', 2)]),
        cells: true,
        surfaces: [{ item: 'plate_2', regions: ['well'] }],
      },
    ],
    checks: [
      check(
        'score',
        'IEC score of the upper half of the large plate at slot 5, B - A',
        'score',
        true,
        scoreChange(0.3, 0.5, '+0.3 to +0.5 on the upper zone of the large plates'),
        (runs) => {
          const a = upperScore('plate_3')(runs['A'] as CaseRun);
          const b = upperScore('plate_2')(runs['B'] as CaseRun);
          return { a, b, value: b - a };
        },
      ),
      check(
        'residue',
        'share of the egg yolk left on the upper half of that plate, B - A',
        '1',
        false,
        direction(-1, 'the wider gap above the small plates lets more through', 0.01),
        (runs) => {
          const runA = runs['A'] as CaseRun;
          const runB = runs['B'] as CaseRun;
          const a = zone(runA, 'plate_3', upperHalf(runA, 'plate_3')).residual;
          const b = zone(runB, 'plate_2', upperHalf(runB, 'plate_2')).residual;
          return { a, b, value: b - a };
        },
      ),
    ],
  },
  {
    id: 'P13',
    title: 'Glass or cup placed over tines',
    group: 'A',
    mechanism: 'Tine tips touch the inside and sit in the jet path',
    test: 'A 250 mL test glass with milk inside, set mouth down over a tine of row C of the upper basket (B), against the same glass in the same place with that row of tines folded down (A)',
    adapted:
      'Row C of the upper basket of the Bosch folds, so the same pose is washed with and without the tine inside the glass and nothing else changes. The pose is set, not settled (dropped over a tine the glass topples in the loading physics): exactly upside down, its axis over the tine, clear of the basket in both configurations; the tine does not touch the glass.',
    stages: 'water: jets (tine in the path), droplets (fans off the tine), scene (contacts)',
    resolutionSensitive: true,
    cases: [
      {
        label: 'A',
        what: 'row folded down: no tine in the glass',
        load: 'glass-free',
        edit: overTine,
        config: rowFolded,
        soils: byId({ glass: [milk('interior')] }),
        surfaces: [{ item: 'glass', regions: ['interior'] }],
      },
      {
        label: 'B',
        what: 'over a tine',
        load: 'glass-free',
        edit: overTine,
        soils: byId({ glass: [milk('interior')] }),
        surfaces: [{ item: 'glass', regions: ['interior'] }],
      },
    ],
    checks: [
      check(
        'f_jet',
        'fraction of time the inside is under a direct jet, B over A, minus one',
        '1',
        true,
        direction(-1, 'interior f_jet reduced', 0.05),
        relative('A', 'B', (run) => fJet(run, 'glass', ['interior'])),
      ),
      check(
        'marks',
        'contact marks on the glass over the tine (B)',
        'marks',
        false,
        quantity(1, 3, 'AHAM adds 1 to 3 grade points per marked glass'),
        single('B', (run) => futureField(run.item('glass'), 'spots', 'count')),
        ['spotting'],
      ),
      check(
        'drying',
        'change of the drying score, B - A',
        'score',
        false,
        quantity(-1, -1, 'drying score -1'),
        difference('A', 'B', (run) => futureField(run.item('glass'), 'drying', 'score')),
        ['drying'],
      ),
    ],
  },
  {
    id: 'P14',
    title: 'Soiled face against the tub wall or door liner',
    group: 'A',
    mechanism: 'Gap too small for jets; the zone near the wall has the slowest water',
    test: 'An oval platter with egg yolk in the outermost slot of the rear lane of the lower basket (R1 slot 0, next to the left wall): face to the arm axis (A) against face to the wall (B)',
    adapted:
      'The outermost seat of the Bosch leaves several centimetres to the wall, not 8 mm; the loading physics seats the platter face inward and does not seat it reversed on the present basket, so both ways round are set poses: the platter exactly upright 30 mm outboard of its outermost seat, between the last tine and the side wall of the basket, the one place where it clears the tines either way round.',
    stages: 'water: jets (line of sight), run-off (renewal); soil: removal laws',
    resolutionSensitive: true,
    cases: [
      {
        label: 'A',
        what: 'face inward: upright between the last tine and the side wall (set pose)',
        load: 'platter-inward',
        edit: uprightBehindSeat('platter', 1, PLATTER_AT_WALL),
        soils: byId({ platter: [egg('well')] }),
        surfaces: [{ item: 'platter', regions: ['well'] }],
      },
      {
        label: 'B',
        what: 'face to the wall: upright between the last tine and the side wall (set pose)',
        load: 'platter-inward',
        edit: uprightBehindSeat('platter', -1, PLATTER_AT_WALL),
        soils: byId({ platter: [egg('well')] }),
        surfaces: [{ item: 'platter', regions: ['well'] }],
      },
    ],
    checks: [
      check(
        'f_jet',
        'fraction of time the soiled face is under a direct jet, B over A',
        '1',
        true,
        control(0.05, 'as P02: f_jet on the soiled face drops to about 0'),
        ratio('A', 'B', (run) => fJet(run, 'platter', ['well'])),
      ),
      check(
        'score',
        'change of the IEC score of the platter, B - A',
        'score',
        true,
        scoreChange(-1, -2, 'as P02: -1 to -2'),
        difference('A', 'B', (run) => score(run, 'platter')),
      ),
      check(
        'renewal',
        'rate the water on the soiled face is replaced, B over A, minus one',
        '1',
        false,
        direction(-1, 'slow exchange near the wall', 0.05),
        relative('A', 'B', (run) => run.exposure('platter', ['well']).renewal_per_s),
      ),
      check(
        'residue',
        'share of the egg yolk left on the well, B - A',
        '1',
        false,
        direction(1, 'the face to the wall keeps more', 0.01),
        difference('A', 'B', (run) => regionResidual(run, 'platter', 'well')),
      ),
    ],
  },
];
