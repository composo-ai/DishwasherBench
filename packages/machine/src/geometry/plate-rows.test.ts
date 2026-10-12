/**
 * How plates rest in the tine rows of the Bosch's lower basket: every plate kind of the
 * catalogue seated by a hand's motion (`seatPlateByHand`) in the loading physics.
 *
 * WHAT THE REAL BASKET DOES (the evidence these bands rest on)
 *
 * The owner's photograph of 2026-10-10 shows two of his wide-rimmed earthenware plates in the
 * hinged rear rows. Measured through a camera fitted to the basket's rim in that photograph
 * (focal length 1935 px, RMS 9 px on four chamfer corners and the rear rim; the tips of tines 0,
 * 1, 3 and 5 of row R2 then fall within 4 px, 1.6 mm, of where this geometry puts them, which
 * confirms pitch, lean and height of the rear tines in a third view):
 * - the left plate (27 cm; published 27 x 3.2 cm) stands in the third gap from the left wall,
 *   between tines 2 and 3 of both rows, on the rails, its eating face to the middle. A 135 mm
 *   circle fitted to 28 points of its rim leans 3 degrees outwards, with the tines (RMS 4 px; 15
 *   degrees would miss the outline by 26 px RMS). +-3 degrees.
 * - the right plate (most likely the 22 cm size; half hidden by a frying pan) leans 6 degrees
 *   outwards, +-4.
 * So a real plate in these rows does not lie back at the 15 degrees of the tines: it stands
 * within a few degrees of upright, leaning the way the tines lean. The reason is geometry. The
 * tines are 66 mm high on rails 99 mm apart, so their tips reach the underside of a 25 to 27 cm
 * plate 70 to 78 mm from its centre: at or inside the foot. A plate whose lip stands in the 14
 * mm gap between two tines can lie back only until its underside meets the tine behind it:
 * tan(lean) = tan(15 deg) + (s - u) / h, where s (0 to 10 mm) is the room behind its lip, u the
 * depth of its underside behind the lip where the tine touches and h the height of that point.
 * For the standard dinner plate (u = 20 mm at the foot, h = 57 mm, s = 10 mm) that is 5.5
 * degrees; this physics gives 4.2.
 *
 * WHAT IS ASSERTED
 * - plates up to 24 mm deep rest leaning with the row, 3 to 20 degrees, on the rails, one in
 *   every gap;
 * - the 27 cm plates 30 mm deep stand within 6 degrees of upright (the owner's 32 mm plate:
 *   3 degrees with the row; these, with a steeper and narrower rim: 3.5 against);
 * - the 40 mm soup plate cannot lie back in the rear rows (its bowl meets the tine behind it
 *   while it still leans forward) and tips onto the tine in front, 10 to 16 degrees against the
 *   row; in the side rows, whose gap is 22 mm, it stands upright. NOT SETTLED BY A PHOTOGRAPH:
 *   no picture shows a deep plate in a rear gap of this basket.
 */

import { getItemType, instantiateItemType, listItemTypes } from '../../../catalogue/src/index.ts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BOSCH_SMV4HAX40G as B } from '../machines.ts';
import { machineWorld, seatPlateByHand } from '../test-physics.ts';
import type { SeatedPlate } from '../test-physics.ts';
import { must } from '../test-util.ts';
import { buildMachineGeometry } from './build.ts';

const geometry = buildMachineGeometry(B);

/** Overall depth of a plate of the catalogue, mm. */
function depthMm(id: string): number {
  return must(getItemType(id).dimensions.find((d) => d.name === 'height')).valueMm;
}

const PLATES = listItemTypes()
  .filter((t) => t.shapeTag === 'plate' || t.shapeTag === 'saucer')
  .map((t) => t.id)
  .sort();
const SHALLOW = PLATES.filter((id) => depthMm(id) <= 24);
const DEEP_DINNER = PLATES.filter((id) => depthMm(id) > 24 && depthMm(id) <= 32);
const SOUP = PLATES.filter((id) => depthMm(id) > 32);

/** One gap of the left-leaning part and one of the right-leaning part of a rear row. */
const REAR_SLOTS = [3, 18] as const;

function describeRest(r: SeatedPlate): string {
  return `lean ${r.leanDeg.toFixed(1)} deg, edge ${r.edgeFromSlotMm.toFixed(1)} mm, lowest ${r.lowestMm.toFixed(1)} mm, on ${r.restsOn.join('+')}`;
}

describe('the catalogue has the three kinds of plate the rows are judged with', () => {
  it('sorts every plate by its depth', () => {
    expect(SHALLOW).toEqual([
      'bread_plate_vitrelle_170',
      'dessert_plate_porcelain_190',
      'dinner_plate_porcelain_iec',
      'dinner_plate_vitrelle_260',
      'espresso_saucer_porcelain_120',
      'melamine_dessert_plate_iec_195',
      'melamine_plate_230',
      'saucer_porcelain_140',
    ]);
    expect(DEEP_DINNER).toEqual(['dinner_plate_porcelain_270', 'dinner_plate_stoneware_270']);
    expect(SOUP).toEqual(['soup_plate_porcelain_230']);
  });
});

describe('a plate seated by a hand in a gap of the rear rows', () => {
  it.each(SHALLOW)('%s (up to 24 mm deep) leans with the row, 3 to 20 degrees', async (id) => {
    for (const slot of REAR_SLOTS) {
      const r = await seatPlateByHand(geometry, 'lower', 'r1', slot, id);
      const what = `${id} in r1.${slot}: ${describeRest(r)}`;
      expect(r.atRest, what).toBe(true);
      // The hand got its edge down between the two tines, and it stayed there: its lowest rim
      // point is within the 18 mm gap about the slot's centre.
      expect(r.reachedRails, what).toBe(true);
      expect(Math.abs(r.edgeFromSlotMm), what).toBeLessThan(14);
      // On the two rails, held by tines, square in the slot, not jammed.
      expect(r.restsOn, what).toEqual(['rail', 'tine']);
      expect(Math.abs(r.yawDeg), what).toBeLessThan(6);
      expect(r.forceOverWeight, what).toBeLessThan(2);
      // Leaning back on the tine behind it, with the row, less than the tines' own 15 degrees
      // for the dinner plates and a little more for saucers, which lie on the tine tips.
      expect(r.leanDeg, what).toBeGreaterThan(3);
      expect(r.leanDeg, what).toBeLessThan(20);
    }
  });

  it('the standard dinner plate leans 4 degrees, where the hand calculation gives 5.5', async () => {
    const r = await seatPlateByHand(geometry, 'lower', 'r1', 3, 'dinner_plate_porcelain_iec');
    // tan(lean) = tan 15 + (s - u) / h with s = 14.25 - 4.15 = 10.1 mm of room behind the lip,
    // u = 19.85 mm to the foot ring, h = 57.1 mm up the tine: 5.5 degrees. The lip does not
    // slide all the way to the tine in front, which takes a degree off.
    const byHand =
      (Math.atan(Math.tan((15 * Math.PI) / 180) + (10.1 - 19.85) / 57.1) * 180) / Math.PI;
    expect(byHand).toBeGreaterThan(5.4);
    expect(byHand).toBeLessThan(5.7);
    expect(Math.abs(r.leanDeg - byHand), describeRest(r)).toBeLessThan(2.5);
  });

  it.each(DEEP_DINNER)('%s (27 cm, 30 mm deep) stands within 6 degrees of upright', async (id) => {
    for (const slot of REAR_SLOTS) {
      const r = await seatPlateByHand(geometry, 'lower', 'r1', slot, id);
      const what = `${id} in r1.${slot}: ${describeRest(r)}`;
      expect(r.atRest, what).toBe(true);
      expect(r.reachedRails, what).toBe(true);
      expect(r.restsOn, what).toEqual(['rail', 'tine']);
      expect(Math.abs(r.edgeFromSlotMm), what).toBeLessThan(14);
      expect(Math.abs(r.leanDeg), what).toBeLessThan(6);
    }
  });

  it.each(SOUP)('%s (40 mm deep) tips forward onto the tine in front of it', async (id) => {
    for (const slot of REAR_SLOTS) {
      const r = await seatPlateByHand(geometry, 'lower', 'r1', slot, id);
      const what = `${id} in r1.${slot}: ${describeRest(r)}`;
      expect(r.atRest, what).toBe(true);
      expect(r.restsOn, what).toEqual(['rail', 'tine']);
      expect(Math.abs(r.edgeFromSlotMm), what).toBeLessThan(14);
      expect(r.leanDeg, what).toBeLessThan(-10);
      expect(r.leanDeg, what).toBeGreaterThan(-16);
    }
  });
});

describe('a plate seated by a hand in a gap of the side rows (26 mm pitch, 81 mm tines)', () => {
  it.each([
    ['dinner_plate_porcelain_iec', 9, 16],
    ['dessert_plate_porcelain_190', 14, 21],
    ['dinner_plate_porcelain_270', 2, 9],
    ['soup_plate_porcelain_230', -3, 4],
  ] as const)('%s rests leaning %d to %d degrees with the row', async (id, low, high) => {
    for (const row of ['ml', 'mr'] as const) {
      const r = await seatPlateByHand(geometry, 'lower', row, 2, id);
      const what = `${id} in ${row}.2: ${describeRest(r)}`;
      expect(r.atRest, what).toBe(true);
      expect(r.reachedRails, what).toBe(true);
      expect(Math.abs(r.edgeFromSlotMm), what).toBeLessThan(20);
      expect(r.leanDeg, what).toBeGreaterThan(low);
      expect(r.leanDeg, what).toBeLessThan(high);
    }
  });
});

describe("a plate shaped like the owner's, where he stood it", () => {
  // His 10 1/2 inch earthenware plate: 27 cm across and 3.2 cm high as published by three
  // retailers; the profile is NOT measured. It is drawn here as the photograph shows the
  // kind: a body 6.5 mm thick with a small well and a broad rim rising at 18 degrees.
  const base = getItemType('dinner_plate_stoneware_270');
  if (base.geometry.class !== 'sor') throw new Error('the stoneware plate is not a shell');
  const plate = instantiateItemType({
    ...base,
    id: 'fixture_wide_rimmed_plate_270',
    geometry: {
      ...base.geometry,
      profileMm: [
        [0, 7.25, 6.5],
        [62, 7.25, 6.5],
        [75, 10.5, 6.5],
        [131.75, 28.75, 6.5],
      ],
      footRing: { rMm: 60, widthMm: 6, heightMm: 4, material: 'stoneware_unglazed' },
    },
  });

  it('is 270 mm across and 32 mm high', () => {
    expect(plate.bbox.max[1] * 2000).toBeCloseTo(270, 0);
    expect((plate.bbox.max[2] - plate.bbox.min[2]) * 1000).toBeCloseTo(32, 0);
  });

  it('stands in the third gap of the rear rows leaning 0 to 8 degrees outwards, as photographed', async () => {
    // Measured in the photograph: 3 degrees with the tines, +-3; on both rails.
    const r = await seatPlateByHand(geometry, 'lower', 'r2', 2, plate);
    expect(r.atRest, describeRest(r)).toBe(true);
    expect(r.reachedRails, describeRest(r)).toBe(true);
    expect(r.restsOn, describeRest(r)).toEqual(['rail', 'tine']);
    expect(r.leanDeg, describeRest(r)).toBeGreaterThan(0);
    expect(r.leanDeg, describeRest(r)).toBeLessThan(8);
    expect(Math.abs(r.edgeFromSlotMm), describeRest(r)).toBeLessThan(14);
  });
});

describe('thirteen dinner plates in the rear rows', () => {
  // THE EVIDENCE that the real basket takes them, one in every gap: (1) each rear row has 23
  // tines, 15 leaning left and 8 leaning right (counted in IMG_9080 and IMG_9081 and on BSH's
  // photograph of the part), so 14 gaps in the left part alone, at 18.25 mm (the tips of six
  // tines fall within 1.6 mm of that pitch in a third photograph); (2) the gap between two
  // tines is 14 mm and the lip of a dinner plate 4 to 6 mm, and a plate up to 24 mm deep lies
  // back in its gap without reaching into the next (see the file comment); two plates of one
  // shape standing 18 mm apart do not touch, as they stack 6 to 8 mm apart; (3) the machine is
  // rated for 13 place settings, and the dinner plates of that load, 25 cm across, are too
  // large for its upper basket (22 cm at level 1). NOT SETTLED BY A PHOTOGRAPH: no picture
  // shows more than one plate in a row of this basket; the dossier's "every second gap" was a
  // reading of the plate's overall depth against the pitch, without the plate's shape.
  let world: Awaited<ReturnType<typeof machineWorld>>;
  const rests: SeatedPlate[] = [];
  beforeAll(async () => {
    world = await machineWorld(geometry, (id) => id === 'lower_rack');
    // Loaded as a hand loads a row: from the wall inwards, each in the next gap.
    for (let k = 0; k < 13; k++) {
      rests.push(
        await seatPlateByHand(geometry, 'lower', 'r1', k, 'dinner_plate_porcelain_iec', {
          world,
          bodyId: `plate_${String(k).padStart(2, '0')}`,
        }),
      );
    }
  }, 120_000);
  afterAll(() => world.dispose());

  it('stand one in every gap, each on the rails leaning 2 to 10 degrees with the row', () => {
    expect(rests).toHaveLength(13);
    rests.forEach((r, k) => {
      const what = `plate ${k}: ${describeRest(r)}`;
      expect(r.atRest, what).toBe(true);
      expect(r.reachedRails, what).toBe(true);
      expect(Math.abs(r.edgeFromSlotMm), what).toBeLessThan(14);
      expect(r.leanDeg, what).toBeGreaterThan(2);
      expect(r.leanDeg, what).toBeLessThan(10);
    });
  });

  it('none of them touches another, and none has moved its neighbour', () => {
    const ids = rests.map((_, k) => `plate_${String(k).padStart(2, '0')}`);
    const touching = world
      .contacts()
      .filter((c) => ids.includes(c.a) && ids.includes(c.b))
      .map((c) => `${c.a}-${c.b}`);
    expect(touching).toEqual([]);
    // Each plate is still where it came to rest when it was put in: within 1 mm and 1 degree.
    rests.forEach((r, k) => {
      const now = world.getPose(must(ids[k]));
      const moved = Math.hypot(
        now.p[0] - r.pose.p[0],
        now.p[1] - r.pose.p[1],
        now.p[2] - r.pose.p[2],
      );
      expect(moved * 1000, `plate ${k}`).toBeLessThan(1);
    });
    // They stand 18.25 mm apart along the rail, as the tines do.
    for (let k = 1; k < 13; k++) {
      const step = (must(rests[k]).pose.p[0] - must(rests[k - 1]).pose.p[0]) * 1000;
      expect(step, `plates ${k - 1} and ${k}`).toBeGreaterThan(16);
      expect(step, `plates ${k - 1} and ${k}`).toBeLessThan(20.5);
    }
  });
});
