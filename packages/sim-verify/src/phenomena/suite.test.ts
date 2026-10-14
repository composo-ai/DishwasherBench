// The suite as data: every phenomenon of the checklist has a scenario, every scenario can be
// resolved against the loads on disk, and the loads are what their recipes say (every item
// placed, nothing cutting into anything else beyond the loading physics' tolerance).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { instantiate } from '@spotless/catalogue';
import { quatRotate } from '@spotless/core';
import type { MachineConfig } from '@spotless/machine';
import { describe, expect, it } from 'vitest';
import { CLEAR_MARGIN, cleared, machineGap, machineOverlap } from './clearance.ts';
import {
  armHeldAt,
  boxCentre,
  BUILT_LOADS_DIR,
  lowestPoint,
  readLoad,
  soilRecord,
  standing,
  tilted,
  turnedRound,
} from './loads.ts';
import { areaWithin, regionClearance } from './pair-gap.ts';
import { programmeOf } from './programmes.ts';
import { PHENOMENA, QUICK_IDS } from './runner.ts';
import { pairsAtHalfPitch, rearRowsFolded } from './scenarios-a.ts';
import { spoonNested } from './scenarios-b.ts';

describe('the checklist as scenarios', () => {
  it('has one scenario per phenomenon, P01 to P48 less P27 and P32 (they compare programmes), in order', () => {
    expect(PHENOMENA.map((s) => s.id)).toEqual(
      Array.from({ length: 48 }, (_unused, i) => `P${String(i + 1).padStart(2, '0')}`).filter(
        (id) => id !== 'P27' && id !== 'P32',
      ),
    );
  });

  it('gives every scenario washes, a deciding check, and checks that name washes it has', () => {
    for (const scenario of PHENOMENA) {
      expect(scenario.cases.length, scenario.id).toBeGreaterThan(0);
      expect(
        scenario.checks.some((c) => c.decides),
        scenario.id,
      ).toBe(true);
      expect(new Set(scenario.cases.map((c) => c.label)).size, scenario.id).toBe(
        scenario.cases.length,
      );
      expect(new Set(scenario.checks.map((c) => c.id)).size, scenario.id).toBe(
        scenario.checks.length,
      );
      for (const c of scenario.checks) {
        expect(c.expected.max, `${scenario.id} ${c.id}`).toBeGreaterThanOrEqual(c.expected.min);
      }
    }
  });

  it('marks as not covered exactly the phenomena that need a mechanism out of scope', () => {
    const notCovered = PHENOMENA.filter((s) => s.requires !== undefined).map((s) => s.id);
    expect(notCovered).toEqual(['P21', 'P23', 'P26', 'P34', 'P38', 'P39', 'P41', 'P42', 'P43']);
  });

  it('names loads that are on disk, and soils on regions the items have', () => {
    for (const scenario of PHENOMENA) {
      for (const spec of scenario.cases) {
        const load = readLoad(spec.load);
        const items = spec.edit === undefined ? load.items : spec.edit(load.items);
        expect(items.length, `${scenario.id} ${spec.label}`).toBeGreaterThan(0);
        items.forEach((item, index) => {
          for (const soil of spec.soils?.(item, index) ?? []) {
            // Throws for a region the item type lacks.
            expect(soilRecord(soil, item.typeId).amount_g).toBeGreaterThan(0);
          }
        });
        for (const surface of spec.surfaces) {
          const item = items.find((i) => i.itemId === surface.item);
          expect(item, `${scenario.id} ${spec.label} ${surface.item}`).toBeDefined();
          const regions = Object.keys(instantiate(item?.typeId ?? '').regionAreas);
          for (const region of surface.regions ?? []) expect(regions).toContain(region);
        }
      }
    }
  });

  it('has a quick subset of six scenarios that are all covered', () => {
    expect(QUICK_IDS).toHaveLength(6);
    for (const id of QUICK_IDS) {
      expect(PHENOMENA.find((s) => s.id === id)?.requires, id).toBeUndefined();
    }
  });
});

describe('the settled loads', () => {
  it('are built, and stand clear of the baskets within the loading tolerance', () => {
    // The loading physics accepts overlaps of up to 0.5 mm; 1.5 mm allows for the chord error
    // of the meshes the check samples and for a wire a rim has sunk between.
    for (const name of ['plate-facing', 'plates-18', 'soup-radial', 'dplate-lower']) {
      expect(existsSync(join(BUILT_LOADS_DIR, `${name}.json`)), name).toBe(true);
      for (const item of readLoad(name).items) {
        const overlap = machineOverlap(item.typeId, item.pose);
        expect(overlap.depth, `${name} ${item.itemId} into ${overlap.with}`).toBeLessThan(0.0015);
      }
    }
  });

  it('seats the plates of a row one tine pitch apart', () => {
    const xs = readLoad('plates-18')
      .items.map((item) => item.pose.p[0])
      .sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      // Tine pitch of rows R1/R2: 18.25 mm; settled plates within 1.5 mm of it.
      expect(Math.abs((xs[i] as number) - (xs[i - 1] as number) - 0.01825)).toBeLessThan(0.0015);
    }
  });

  it('holds an arm at the angle a scenario sets, as a mechanical check would report it', () => {
    // No load of the suite stops an arm on the present basket (the ladle of the first build
    // no longer hangs through the floor): P06 holds the lower arm itself.
    const held = armHeldAt('lower_arm', 148);
    expect(Object.keys(held)).toEqual(['lower']);
    expect(Math.abs(held['lower'] as number)).toBeCloseTo((148 * Math.PI) / 180, 9);
    expect(readLoad('plates-36').stalledArms).toEqual({});
  });

  it('turns an item round in its seat without moving its box or its lean', () => {
    const plate = readLoad('plate-facing').items.find((item) => item.itemId === 'plate');
    if (plate === undefined) throw new Error('no plate');
    const turned = turnedRound(plate);
    const before = boxCentre(plate.typeId, plate.pose);
    const after = boxCentre(turned.typeId, turned.pose);
    // (The box of a dished plate is not quite that of its mirror image.)
    expect(Math.hypot(after[0] - before[0], after[1] - before[1])).toBeLessThan(1e-3);
    expect(lowestPoint(turned.typeId, turned.pose)).toBeCloseTo(
      lowestPoint(plate.typeId, plate.pose),
      6,
    );
    // The plate leans as it did, so its face looks exactly the other way: where it was tipped
    // up towards the middle it is now tipped down towards the wall.
    const n0 = quatRotate(plate.pose.q, [0, 0, 1]);
    const n1 = quatRotate(turned.pose.q, [0, 0, 1]);
    for (let i = 0; i < 3; i++) expect(n1[i]).toBeCloseTo(-(n0[i] as number), 6);
    expect(turned.exact).toBe(true);
  });
});

describe('set poses', () => {
  it('stands a plate in the wide gap either way round, clear of rails and tines', () => {
    const plate = readLoad('plate-facing').items[0];
    if (plate === undefined) throw new Error('no plate');
    for (const sign of [1, -1]) {
      const set = cleared(standing(plate, [sign, 0, 0], 0.0565, 0.1115, 0.0895), [1, 0, 0]);
      expect(set.exact).toBe(true);
      expect(machineGap(set.typeId, set.pose).gap).toBeGreaterThanOrEqual(CLEAR_MARGIN);
      // Upright: the face normal (the item's +z axis) is horizontal and along x (to 1e-9).
      const [x, y, z, w] = set.pose.q;
      expect(2 * (x * z + w * y)).toBeCloseTo(sign, 9);
      expect(1 - 2 * (x * x + y * y)).toBeCloseTo(0, 9);
      // Near the rails: its lowest point within 7 mm of the top of the rails (89.5 mm).
      expect(lowestPoint(set.typeId, set.pose) - 0.0895).toBeLessThan(0.007);
    }
  });

  it('tilts an item about its support: the lowest point keeps its height', () => {
    const mug = readLoad('mug-on-shelf').items[0];
    if (mug === undefined) throw new Error('no mug');
    const tipped = tilted(mug, (15 * Math.PI) / 180, [0, 1, 0]);
    expect(lowestPoint(tipped.typeId, tipped.pose)).toBeCloseTo(
      lowestPoint(mug.typeId, mug.pose),
      9,
    );
  });
});

describe('loads that stand for a gap', () => {
  // The review of 11 October 2026 found two loads that were not what their phenomenon
  // describes: the crowded plates of P03 nested (a contact), and the nested spoons of P15
  // lay across each other (a point).
  it('sets the crowded plates of P03 a narrow open gap apart, not into a nest', () => {
    const built = readLoad('plates-9').items;
    const byId = (items: typeof built, id: string): (typeof built)[number] => {
      const item = items.find((i) => i.itemId === id);
      if (item === undefined) throw new Error(`no ${id}`);
      return item;
    };
    // As the physics leaves the pair: the covered well within 1 mm of its partner all over.
    const nested = regionClearance(
      byId(built, 'plate_6').typeId,
      byId(built, 'plate_6').pose,
      'well',
      byId(built, 'plate_5').typeId,
      byId(built, 'plate_5').pose,
      16,
    );
    const whole = nested.reduce((sum, s) => sum + s.area, 0);
    expect(areaWithin(nested, 1.2) / whole).toBeGreaterThan(0.95);
    const set = pairsAtHalfPitch(built);
    const folded = rearRowsFolded(readLoad('plates-9').config as MachineConfig);
    for (const [odd, even] of [
      ['plate_1', 'plate_2'],
      ['plate_3', 'plate_4'],
      ['plate_5', 'plate_6'],
      ['plate_7', 'plate_8'],
    ] as const) {
      const covered = byId(set, even);
      const partner = byId(set, odd);
      expect(partner.exact, odd).toBe(true);
      expect(covered.exact, even).toBe(true);
      // Clear of the lane with its tines folded down, and no more than 12 mm above its seat.
      for (const plate of [partner, covered]) {
        expect(
          machineGap(plate.typeId, plate.pose, folded).gap,
          plate.itemId,
        ).toBeGreaterThanOrEqual(CLEAR_MARGIN);
      }
      const seat = Math.min(byId(built, 'plate_5').pose.p[2], byId(built, 'plate_6').pose.p[2]);
      expect(covered.pose.p[2] - seat, even).toBeLessThan(0.0125);
      expect(partner.pose.p[2], odd).toBe(covered.pose.p[2]);
      // Every plate of the row is parallel to every other: no pair leans into the next.
      expect(covered.pose.q, even).toEqual(byId(set, 'plate_6').pose.q);
      expect(partner.pose.q, odd).toEqual(byId(set, 'plate_6').pose.q);
      // From plate to plate along the row: half a pitch of the tines.
      const pitch = Math.hypot(
        partner.pose.p[0] - covered.pose.p[0],
        partner.pose.p[1] - covered.pose.p[1],
      );
      expect(pitch, `${odd} ${even}`).toBeCloseTo(0.009125, 6);
      // The covered well looks into an open gap of some millimetres everywhere, and the
      // partner's own face into the open slot.
      const gap = regionClearance(
        covered.typeId,
        covered.pose,
        'well',
        partner.typeId,
        partner.pose,
        16,
      );
      expect(gap[0]?.clearance, even).toBeGreaterThan(1.5);
      expect(gap[gap.length - 1]?.clearance, even).toBeLessThan(9);
      const open = regionClearance(
        partner.typeId,
        partner.pose,
        'well',
        covered.typeId,
        covered.pose,
        16,
      );
      expect(open[0]?.clearance, odd).toBeGreaterThan(4);
    }
    // No plate of the row cuts into another: each against every other, all regions.
    for (const a of set) {
      for (const b of set) {
        if (a === b) continue;
        for (const region of ['well', 'rim', 'underside', 'foot']) {
          const gap = regionClearance(a.typeId, a.pose, region, b.typeId, b.pose, 3);
          expect(gap[0]?.clearance, `${a.itemId} ${region} against ${b.itemId}`).toBeGreaterThan(1);
        }
      }
    }
  }, 300_000);

  it('lays the second spoon of P15 into a nest: under 1 mm over about 10 cm2, nowhere cutting', () => {
    const built = readLoad('spoons-nested').items;
    const first = built.find((i) => i.itemId === 'spoon_1');
    const slid = built.find((i) => i.itemId === 'spoon_2');
    const second = spoonNested(built).find((i) => i.itemId === 'spoon_2');
    if (first === undefined || slid === undefined || second === undefined) {
      throw new Error('no pair of spoons');
    }
    // As the physics leaves it, the second spoon touches the first at a point.
    const before = regionClearance(slid.typeId, slid.pose, 'bowl', first.typeId, first.pose, 3);
    expect(areaWithin(before, 1)).toBeLessThan(150);
    expect(second.exact).toBe(true);
    const hollow = regionClearance(second.typeId, second.pose, 'bowl', first.typeId, first.pose, 3);
    expect(areaWithin(hollow, 1)).toBeGreaterThan(800);
    expect(areaWithin(hollow, 1)).toBeLessThan(1300);
    for (const region of ['bowl', 'bowl_back', 'handle']) {
      const gap = regionClearance(second.typeId, second.pose, region, first.typeId, first.pose, 3);
      expect(gap[0]?.clearance, region).toBeGreaterThan(0.1);
    }
    expect(machineGap(second.typeId, second.pose).gap).toBeGreaterThanOrEqual(CLEAR_MARGIN);
  }, 120_000);
});

describe('programme variants', () => {
  it('change the main wash and nothing else', () => {
    const base = programmeOf('eco_50');
    const cool = programmeOf('eco_50', { washTarget_C: 45 });
    const slow = programmeOf('eco_50', { pumpScale: 0.7 });
    expect(cool.id).toBe('eco_50+wash45C');
    expect(cool.steps).toHaveLength(base.steps.length);
    base.steps.forEach((step, i) => {
      const changed = cool.steps[i];
      if (step.phase === 'main_wash' && (step.kind === 'heat' || step.kind === 'hold')) {
        expect(changed).toMatchObject({ kind: step.kind, target: 45 });
      } else expect(changed).toEqual(step);
      const slowed = slow.steps[i];
      if (step.phase === 'main_wash' && (step.kind === 'heat' || step.kind === 'hold')) {
        expect(slowed).toMatchObject({ pumpRpm: Math.round(step.pumpRpm * 0.7) });
      } else expect(slowed).toEqual(step);
    });
  });
});
