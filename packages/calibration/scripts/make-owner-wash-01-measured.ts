/**
 * Writes the measured record of the owner's test wash 01 from its planned record and what he
 * reported (docs/reference/calibration_runs/2026-10-10_egg_plates/README.md) as the lead read
 * it off his photographs (docs/calibration/owner-wash-01-result.md).
 *
 *   cd packages/calibration
 *   pnpm exec tsx scripts/make-owner-wash-01-measured.ts
 *
 * The load, the poses, the programme and the capsule are those of the planned record, which is
 * not changed. What this adds:
 *
 *  - the observations: per plate the visibly soiled area with the range of the comparison (the
 *    lead's reading of the photographs, fitted), the owner's verdict by eye and a count of the
 *    patches (both recorded and reported, not fitted: they are second readings of the same
 *    residue);
 *  - what was not measured, as input scenarios (`sim.scenarios`, docs/calibration/wash-record.md
 *    section 7a) and not as fact: the amount of yolk on each plate (about 3 g was asked for and
 *    not weighed; nothing is known of the small plate's). The amount of a plate is a
 *    log-normal about the amount taken with the stated uncertainty; the scenarios are nine
 *    equally spaced values of its deviate, from -2.4 to +2.4 deviations, each weighted with the
 *    normal density there (a quadrature of the amount: with the scatter the model allows a
 *    visible area, the likelihood of a plate is smooth in every fitted parameter). The first
 *    scenario is the record as written.
 *
 * Not carried here: where the ridges and pools of a fork-spread layer lay is the model term of
 * a visible area (`obs.areaLogModelSd`, measured as the scatter over layout seeds); how uneven
 * such a layer is, is a parameter of the model (`soil.applicationCv[spread]`), which a fit
 * holds at its registered value or fits, and says which.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normPdf, validateWashRecord, type WashRecord } from '../src/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', 'records', 'owner');
const planned = JSON.parse(
  readFileSync(join(dir, 'owner-wash-01-egg-yolk-eco50.planned.json'), 'utf8'),
) as WashRecord;

/**
 * The deviates of the amount at which the wash is replayed, in standard deviations of its
 * logarithm: the nominal amount first, then pairs outwards. Half a step of 0.6 deviations
 * moves the logarithm of a visible area by less than the scatter the model allows it, so the
 * sum over the scenarios is a smooth integral.
 */
const DEVIATES = [0, -0.6, 0.6, -1.2, 1.2, -1.8, 1.8, -2.4, 2.4];

/** What is taken for the amount of yolk on each plate: grams, and its standard uncertainty. */
const AMOUNTS: Readonly<Record<string, { amount_g: number; sd_g: number; why: string }>> = {
  plate_9121: { amount_g: 3, sd_g: 1, why: 'about 3 g asked for, not weighed' },
  plate_9122: { amount_g: 3, sd_g: 1, why: 'about 3 g asked for, not weighed' },
  plate_9123: { amount_g: 3, sd_g: 1, why: 'about 3 g asked for, not weighed' },
  plate_9124: {
    amount_g: 2.1,
    sd_g: 0.9,
    why: 'unknown: between a film as thin as on the large plates (3 g on their 211 cm2 is 1.45 g on its 102 cm2) and the 3 g asked for per plate; the middle of the two in the logarithm, with both about 0.9 deviations away',
  },
};

/** What was seen, per plate: the reading of docs/calibration/owner-wash-01-result.md. */
const SEEN: Readonly<
  Record<
    string,
    {
      before: string;
      after: string;
      area_mm2: number;
      range_mm2: readonly [number, number];
      thresholds: string;
      patches: number;
      clean: boolean;
      seen: string;
      owner: string;
    }
  >
> = {
  plate_9121: {
    before: 'IMG_9121.JPG',
    after: 'IMG_9127.JPG',
    area_mm2: 100,
    range_mm2: [50, 200],
    thresholds: '150 / 103 / 63',
    patches: 7,
    clean: false,
    seen: 'an arc of six or so small patches along the upper right edge of the well, one speck at the left edge',
    owner:
      'Both oven dried plates are mostly clean but with some egg residue. The outward facing plate (LHS) fares slightly worse (9127 is LHS and 9128 is LH middle)',
  },
  plate_9122: {
    before: 'IMG_9122.JPG',
    after: 'IMG_9128.JPG',
    area_mm2: 25,
    range_mm2: [10, 60],
    thresholds: '51 / 28 / 18',
    patches: 5,
    clean: false,
    seen: 'four or five specks of a few millimetres at the edge of the well, one on the rim',
    owner:
      'Both oven dried plates are mostly clean but with some egg residue. The outward facing plate (LHS) fares slightly worse (9127 is LHS and 9128 is LH middle)',
  },
  plate_9123: {
    before: 'IMG_9123.JPG',
    after: 'IMG_9129.JPG',
    area_mm2: 0,
    range_mm2: [0, 5],
    thresholds: '25 / 5 / 2',
    patches: 0,
    clean: true,
    seen: 'nothing',
    owner: 'Both air dried plates are clean (9129 is RH middle and 9130 is RH)',
  },
  plate_9124: {
    before: 'IMG_9124.JPG',
    after: 'IMG_9130.JPG',
    area_mm2: 0,
    range_mm2: [0, 5],
    thresholds: '11 / 5 / 2',
    patches: 0,
    clean: true,
    seen: 'nothing',
    owner: 'Both air dried plates are clean (9129 is RH middle and 9130 is RH)',
  },
};

// ---- the soils: the amount as an uncertain input
const items = planned.load.items.map((item) => {
  const amount = AMOUNTS[item.id];
  if (amount === undefined) {
    // The rest of the evening load: stand-ins whose soils nobody measured.
    return {
      ...item,
      soils: item.soils.map((soil) => ({ ...soil, amount_method: 'assumed' })),
    };
  }
  return {
    ...item,
    soils: item.soils.map((soil) => ({
      ...soil,
      amount_g: amount.amount_g,
      amount_method: 'asked',
      amount_sd_g: amount.sd_g,
      preparation: `spread with a fork over the well in streaks (thick ridges, pools at the edge of the well and bare stripes, about two thirds of the well covered, rim clean); amount: ${amount.why}`,
      ...(soil.heat.history === 'none'
        ? {
            drying: {
              ...soil.drying,
              conditions:
                'on the counter for as long as the other pair was in the oven; still glossy in the photographs. His README says "air fried for 2 hours" and his result calls them air dried: read as air-dried on the counter, to be confirmed with him',
            },
          }
        : {}),
    })),
  };
});

// ---- the scenarios: a quadrature of the amount of every plate
const sigmaOf = (id: string): number => {
  const a = AMOUNTS[id] as { amount_g: number; sd_g: number };
  return Math.sqrt(Math.log(1 + (a.sd_g / a.amount_g) ** 2));
};
const plates = Object.keys(AMOUNTS);
const round = (v: number, digits: number): number => Number(v.toFixed(digits));
const density = DEVIATES.map((x) => normPdf(x));
const total = density.reduce((a, b) => a + b, 0);
const scenarios = DEVIATES.map((x, k) => ({
  weight: round((density[k] as number) / total, 5),
  ...(x === 0
    ? {}
    : {
        amount_factors: Object.fromEntries(
          plates.map((id) => [id, round(Math.exp(sigmaOf(id) * x), 4)]),
        ),
      }),
  notes:
    x === 0
      ? 'nominal: the record as written (the amounts taken)'
      : `every amount ${x > 0 ? '+' : ''}${x} standard deviations of its logarithm from the amount taken`,
}));

// ---- the observations
const observations = plates.flatMap((id) => {
  const s = SEEN[id] as (typeof SEEN)[string];
  const photos = [s.before, s.after];
  return [
    {
      id: `${id}.visible_area`,
      item: id,
      kind: 'visible_area' as const,
      value: s.area_mm2,
      range: s.range_mm2,
      method: 'photo_area',
      photos,
      notes: `${s.seen}. Yellow area at the thresholds 6 / 9 / 12: ${s.thresholds} mm2`,
    },
    {
      id: `${id}.clean`,
      item: id,
      kind: 'clean' as const,
      value: s.clean,
      fitted: false,
      method: 'eye',
      photos,
      notes: `The owner's words: "${s.owner}". Not fitted: the same residue as the area`,
    },
    {
      id: `${id}.specks`,
      item: id,
      kind: 'specks' as const,
      value: s.patches,
      fitted: false,
      method: 'photo_area',
      photos,
      notes: `Separate patches counted on the photograph after the wash (${s.seen}). Not fitted: a patch of the photograph is several square millimetres, a speck of the model one`,
    },
  ];
});

const measured = {
  ...planned,
  kind: 'measured' as const,
  title:
    'Owner wash 01, as run and as seen: four egg-yolk plates (two oven-dried, two air-dried, one of each turned to the wall), Eco 50, one Finish Powerball Ultimate capsule',
  provenance: {
    date: '2026-10-10',
    by: "The owner ran the wash, judged the plates by eye and photographed them before and after; the areas and counts are the lead's reading of his photographs (docs/calibration/owner-wash-01-result.md), not his and not a laboratory measurement; the load is the simulation side's reconstruction from his photographs",
    methods: {
      eye: {
        description:
          "the owner's verdict on the unwiped plate after the wash, in his words (README.md of the run)",
      },
      photo_area: {
        description:
          'reading of the photograph taken after the wash by the lead: pixels inside the well that are yellower than their surroundings (yellowness (R+G)/2 - B against a 61-pixel median background, at the thresholds 6, 9 and 12), scaled by the diameter of the well (taken as 165 mm for the large plates and 125 mm for the small one). The two spotless plates give the noise floor of the method, about 5 mm2. The range is that of the comparison (wider than the three thresholds span) and is read as the central 90 % of the error of ln(area + 5 mm2)',
      },
      assumed: {
        description:
          'no measurement: the rest of the evening load is made of catalogue stand-ins placed from his photograph IMG_9126, with soils and amounts assumed by the simulation side. They are not observed; what they release into the liquor is the background of the four plates',
      },
      asked: {
        description:
          'no weighing: the plan asked for about 3 g of raw yolk per plate; what was put on is not known. The amount is an uncertain input (amount_sd_g) carried by the input scenarios of the record, not a measurement',
      },
    },
    notes:
      'Measured record of owner wash 01, made from the planned record (owner-wash-01-egg-yolk-eco50.planned.json, which the prediction docs/calibration/owner-wash-01-prediction.md was registered on and which is not changed) by scripts/make-owner-wash-01-measured.ts. The owner\'s set-up, result and photographs: docs/reference/calibration_runs/2026-10-10_egg_plates/ (README.md, IMG_9120 to IMG_9130; IMG_9121 to IMG_9124 the plates before, IMG_9125 and IMG_9126 the load, IMG_9127 to IMG_9130 the plates after). NOT MEASURED, and carried as input scenarios (sim.scenarios), not as fact: the amount of yolk per plate (a log-normal about the amount taken with the stated uncertainty: nine equally spaced deviates from -2.4 to +2.4 standard deviations, weighted with the normal density). Where the ridges and pools of a fork-spread layer lay is the model term of a visible area (obs.areaLogModelSd); how uneven such a layer is, is the model\'s soil.applicationCv[spread], which a fit holds at its registered value or fits. NOT REPORTED: the display time at the start and the clock times of start and finish, so the course of the run is the programme as written (the pattern of the spraying in the long soak is a parameter, prog.soakDuty). The plates and the rest of the load are catalogue stand-ins at poses the loading physics gave them. The oven pair had 2 hours at 80 C (his README first said "20 hours"; corrected to 2 hours, which he confirmed); the other pair is read as air-dried on the counter. One wash, judged by eye and from photographs.',
  },
  load: { ...planned.load, items },
  observations,
  sim: { ...planned.sim, scenarios },
};

const checked = validateWashRecord(JSON.parse(JSON.stringify(measured)) as unknown);
if (!checked.ok) {
  throw new Error(checked.error.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
}
const out = join(dir, 'owner-wash-01-egg-yolk-eco50.measured.json');
writeFileSync(out, `${JSON.stringify(measured, null, 1)}\n`);
console.log(`wrote ${out}: ${observations.length} observations, ${scenarios.length} scenarios`);
for (const scenario of scenarios) {
  console.log(
    `  weight ${scenario.weight}: ${
      scenario.amount_factors === undefined
        ? 'the amounts taken'
        : plates
            .map((id) => `${id.replace('plate_', '')} x${scenario.amount_factors?.[id]}`)
            .join(', ')
    }`,
  );
}
