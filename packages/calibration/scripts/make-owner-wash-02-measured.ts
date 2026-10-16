/**
 * Writes the measured record of the owner's test wash 02 (taken as the night of 14 to 15 October)
 * from what the owner reported (docs/reference/calibration_runs/2026-10-14_stacked_plates/) and
 * the owner's one photograph of the loaded basket (IMG_9141.JPG there).
 *
 *   cd packages/calibration
 *   pnpm exec tsx scripts/make-owner-wash-02-measured.ts
 *
 * There was no planned record and no prediction before the wash. The load is made here:
 *
 *  - three of the four plates are put into the game's machine through a session, by the
 *    `place` requests below, with the cutlery basket taken out (it is not in the photograph);
 *    the loading physics settles them and `recordFromManifest` takes the poses it left;
 *  - the fourth plate, the second of the two in one slot, is set by hand: the game refuses a
 *    second plate in an occupied slot. It is the plate under it moved along that plate's axis,
 *    towards its eating face, by {@link PAIR_OFFSET_MM}: the eating face of the plate under it
 *    then lies about 3 mm from the back of the other (the owner presumes a small gap; how
 *    small is not known, and about 3 mm is taken);
 *  - the soils, the observations and the scenarios of the amount, below.
 *
 * What was not measured is carried as input scenarios (`sim.scenarios`, docs/calibration/
 * wash-record.md section 7a), not as fact: the amount of yolk on each plate, half a teaspoon
 * in the owner's words, not weighed. The amount of a plate is a log-normal about the amount
 * taken with the stated uncertainty; the three scenarios are the three-point Gauss-Hermite
 * rule of its deviate (0 and plus and minus the square root of 3 deviations, weighted 2/3, 1/6
 * and 1/6), every plate moved together. The first scenario is the record as written.
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Level } from '@spotless/levels';
import { PRIMARY_MACHINE } from '@spotless/machine';
import {
  createSession,
  placeholderWashRunner,
  type PlaceRequest,
  type WashManifest,
} from '@spotless/session';
import { recordFromManifest, validateWashRecord } from '../src/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(
  here,
  '..',
  'records',
  'owner',
  'owner-wash-02-stacked-plates-eco50.measured.json',
);

const RECORD_ID = 'owner-wash-02-stacked-plates-eco50';

/** Grams of yolk taken per plate: half a teaspoon, about 2.5 mL. */
const AMOUNT_G = 2.5;
/** Its standard uncertainty: the scenarios run from about 1.2 g to about 5.2 g. */
const AMOUNT_SD_G = 1.1;

/**
 * How far the second plate of the slot stands from the first, along the first plate's axis,
 * mm. With the catalogue plate the rim of the first then lies 3.4 mm from the back of the
 * second and the flat of its well 4.6 mm; the foot ring of the second comes nearest, 3.2 mm
 * (`regionClearance` of the phenomena suite, `packages/sim-verify/src/phenomena/pair-gap.ts`).
 */
const PAIR_OFFSET_MM = 9.65;

/** The plate of every item: the catalogue dinner plate that stood in for wash 01's large plates. */
const PLATE = 'dinner_plate_porcelain_270';

const yolkOfLevel = {
  type: 'egg_yolk_dried',
  regions: [{ region: 'well', coverage: 0.67 }],
  amountG: AMOUNT_G,
  ageH: 2,
  heatHistory: 'none',
  description: 'raw egg yolk, no white',
} as const;

const level: Level = {
  id: 'owner-wash-02',
  title: 'Owner wash 02',
  summary: "Three of the four plates of the owner's second test wash, placed as photographed.",
  machineId: PRIMARY_MACHINE.id,
  config: null,
  racks: {},
  programmeId: PRIMARY_MACHINE.primaryProgramme,
  items: ['plate_pair_covered', 'plate_single', 'plate_flat'].map((id) => ({
    id,
    itemType: PLATE,
    points: 5,
    soils: [yolkOfLevel],
  })),
  rules: {
    track: 'one_shot',
    actionsMax: 100,
    queriesMax: 500,
    washesMax: 1,
    mechanicalChecks: true,
  },
  seed: 20261014,
  manual: null,
};

/**
 * The requests, in the order sent (lower basket frame: x from the left wall, y from the front,
 * z up from the basket floor, mm). The first plate of the pair is let go above the tines of
 * the fifth gap from the left wall of the left middle and front rows (the game's slot 4 of
 * rows ML and FL, where it offers that pose) and comes down into the gap; the plate a slot
 * behind goes into the fourth gap (slot 3, the pose the game offers there); both face the
 * middle of the basket. The flat plate is let down onto the tips of the two rear rows, right
 * of the middle, eating face up, as far back as a plate can be let down from above (2 mm
 * further back and the upper basket is in the way).
 */
const REQUESTS: readonly PlaceRequest[] = [
  {
    item_id: 'plate_pair_covered',
    frame: 'lower_rack',
    position_mm: [137, 144, 242],
    orientation: { preset: 'on_edge', roll_deg: 0, yaw_deg: 90 },
  },
  {
    item_id: 'plate_single',
    frame: 'lower_rack',
    position_mm: [133, 144, 145],
    orientation: { preset: 'on_edge', roll_deg: -3, yaw_deg: 90 },
  },
  {
    item_id: 'plate_flat',
    frame: 'lower_rack',
    position_mm: [378, 368, 100],
    orientation: { preset: 'upright' },
  },
];

// ---- the load: the game's loading physics for the three plates it accepts
let handed: WashManifest | undefined;
const session = await createSession({
  level,
  washRunner: (manifest, onProgress) => {
    handed = manifest;
    return placeholderWashRunner(manifest, onProgress);
  },
});
try {
  const cutlery = session.setRack({
    rack: 'cutlery_basket',
    option: { name: 'position', value: 'out' },
  });
  if (!cutlery.accepted) throw new Error(`cutlery basket: ${JSON.stringify(cutlery)}`);
  for (const request of REQUESTS) {
    const placed = session.place(request);
    if (!placed.accepted) throw new Error(`${request.item_id}: ${JSON.stringify(placed)}`);
    if (!placed.stable) throw new Error(`${request.item_id} did not come to rest stable`);
    console.log(
      `${request.item_id}: settled at ${placed.settled_pose.position_mm.join(', ')} mm (basket frame)`,
    );
  }
  const started = session.startCycle();
  if (!started.accepted) throw new Error(`start_cycle: ${JSON.stringify(started)}`);
  await session.washSettled();
} finally {
  session.dispose();
}
if (handed === undefined) throw new Error('the wash runner was not called');
const game = recordFromManifest(handed, { id: RECORD_ID });

// ---- the second plate of the slot, set by hand
type Quat = readonly [number, number, number, number];
const covered = game.load.items.find((item) => item.id === 'plate_pair_covered');
if (covered === undefined) throw new Error('no plate_pair_covered in the manifest');
const [w, x, y, z] = covered.quat_wxyz as Quat;
const norm = Math.hypot(w, x, y, z);
/** The item's +z axis (the eating face's normal) in the tub frame. */
const axis = [
  (2 * (x * z + w * y)) / norm ** 2,
  (2 * (y * z - w * x)) / norm ** 2,
  1 - (2 * (x * x + y * y)) / norm ** 2,
] as const;
const open = {
  id: 'plate_pair_open',
  type: PLATE,
  frame: 'tub' as const,
  position_mm: covered.position_mm.map((v, k) => v + PAIR_OFFSET_MM * (axis[k] as number)) as [
    number,
    number,
    number,
  ],
  quat_wxyz: covered.quat_wxyz,
  soils: covered.soils,
};

// ---- the soils
const yolk = {
  id: 'soil_1',
  type: 'egg_yolk_dried',
  recipe: 'raw egg yolk, no white',
  preparation:
    "half a teaspoon per plate, in the owner's words; how it was spread is not stated: taken as on wash 01 (about two thirds of the well covered, rim clean)",
  amount_g: AMOUNT_G,
  amount_method: 'teaspoon',
  amount_sd_g: AMOUNT_SD_G,
  where: { regions: [{ region: 'well', coverage: 0.67 }] },
  drying: {
    time_h: 2,
    conditions:
      '"Egg yolk air dried for 2 hours", in the owner\'s words: taken as 2 hours in the open air of the room, from the yolk going on to the start of the wash',
  },
  heat: { history: 'none' },
};

const POSES: Readonly<Record<string, string>> = {
  plate_single:
    'The plate "a slot behind" the pair: left middle and front rows (ML, FL), the fourth gap from the left wall (the game\'s slot 3), standing across both rows, eating face to the middle of the basket. Pose: the loading physics, from the request in the script. The photograph has its rim where the stand-in\'s is to about 5 mm, leaning back towards the left wall by about 15 degrees from upright where the stand-in leans 7, and its middle about 10 mm further back',
  plate_pair_covered:
    'The first of the "two plates in the same slot", nearer the left wall: left middle and front rows, the fifth gap from the left wall (the game\'s slot 4), eating face to the middle, covered by the back of plate_pair_open. Pose: the loading physics, from the request in the script; the photograph has its rim where the stand-in\'s is to about 5 mm',
  plate_pair_open:
    'The second of the "two plates in the same slot", nearer the middle, eating face to the middle and open; its back over the eating face of plate_pair_covered. Pose SET BY HAND (the game refuses a second plate in an occupied slot): the pose of plate_pair_covered moved 9.65 mm along that plate\'s axis towards its eating face, which puts the back of this plate about 3 mm from the other\'s eating face: 3.4 mm from its rim, 4.6 mm from the flat of its well, 3.2 mm at the nearest (the foot ring). The owner presumes "a small gap"; its size is not known, and about 3 mm is taken. The photograph has the rims of the two about 13 mm apart at mid-height, where the stand-ins\' are 9.7 mm: the real plates may nest otherwise than the catalogue plate, or the gap was wider than taken. The pose cuts about 2.7 mm into a plastic fitting of the lower basket (machineGap of the phenomena suite); no pose within 8 mm along the row or across it is clear',
  plate_flat:
    'The plate "facing up": lying flat on the tips of the two rear rows (R1, R2), right of the middle, eating face up. Pose: the loading physics, from the request in the script. In the photograph it lies about 5 mm further back than the stand-in; the game cannot let a plate down from above any further back with the upper basket in',
};

const items = [...game.load.items, open]
  .map((item) => ({
    ...item,
    soils: [yolk],
    notes: `${POSES[item.id] ?? ''}. Stand-in for the owner's wide-rimmed earthenware dinner plate, the catalogue plate of wash 01's large plates (the flat plate measures about 27 cm in the photograph)`,
  }))
  .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

// ---- the scenarios: the three-point Gauss-Hermite rule of the amount
const sigma = Math.sqrt(Math.log(1 + (AMOUNT_SD_G / AMOUNT_G) ** 2));
const round = (v: number, digits: number): number => Number(v.toFixed(digits));
const RULE: readonly { deviate: number; weight: number }[] = [
  { deviate: 0, weight: 2 / 3 },
  { deviate: -Math.sqrt(3), weight: 1 / 6 },
  { deviate: Math.sqrt(3), weight: 1 / 6 },
];
const plates = items.map((item) => item.id);
const scenarios = RULE.map(({ deviate, weight }) => ({
  weight: round(weight, 5),
  ...(deviate === 0
    ? {}
    : {
        amount_factors: Object.fromEntries(
          plates.map((id) => [id, round(Math.exp(sigma * deviate), 4)]),
        ),
      }),
  notes:
    deviate === 0
      ? `nominal: the record as written (${AMOUNT_G} g of yolk on every plate)`
      : `every amount ${deviate > 0 ? '+' : '-'}1.73 standard deviations of its logarithm from the amount taken (${round(AMOUNT_G * Math.exp(sigma * deviate), 2)} g per plate)`,
}));

// ---- the observations
const OWNER_CLEAN = 'Unbelievably every one came out clean.';
const standing = ['plate_single', 'plate_pair_covered', 'plate_pair_open'].map((item) => ({
  id: `${item}.clean`,
  item,
  kind: 'clean' as const,
  value: true,
  method: 'eye',
  notes: `The owner's words: "${OWNER_CLEAN}" No egg seen; nothing was said of water on the standing plates. Fitted: the only reading of this plate`,
}));
const flat = {
  id: 'plate_flat.score',
  item: 'plate_flat',
  target: { soil: 'soil_1' },
  kind: 'score' as const,
  value: 5,
  fitted: false,
  method: 'eye_rinsed',
  notes:
    'The owner\'s words: "The one facing up had dirty water on it, but once lightly rinsed there was no egg." Score 5 (no soil) of the yolk, read after a light rinse. NOT a clean verdict: the game\'s clean verdict also asks for no standing water, and the plate had dirty water standing on it at the end of the wash; how much was not measured, so there is no retained_water observation. Not fitted: the rinse came between the end of the wash and the look, and the simulation has no rinse, so yolk the wash loosened and left would have gone with the rinse and the reading bounds the wash from one side only',
};
const observations = [...standing, flat];

const measured = {
  ...game,
  kind: 'measured' as const,
  title:
    'Owner wash 02, as run and as seen: four air-dried egg-yolk dinner plates, two in one slot, one a slot behind them, one lying flat face up; Eco 50, one Finish Powerball Ultimate capsule',
  provenance: {
    date: '2026-10-14',
    by: "The machine's owner ran the wash and looked at the plates by eye after it; there are no photographs of the plates before or after. The load is a reconstruction from the owner's one photograph of the loaded basket and the owner's words (notes)",
    methods: {
      eye: {
        description:
          "the owner's verdict by eye on the plate after the wash, in the owner's words (README.md of the run); no photograph",
      },
      eye_rinsed: {
        description:
          "the owner's look at the flat plate after a light rinse, in the owner's words; how it was rinsed is not stated; no photograph",
      },
      teaspoon: {
        description:
          'no weighing: "each plate had half a teaspoon" of yolk, in the owner\'s words, measured with a teaspoon. Half a teaspoon is about 2.5 mL, about 2.5 g of yolk; how full the spoon was is not known. The amount is an uncertain input (amount_sd_g) carried by the input scenarios of the record, not a measurement',
      },
      owner_stated: {
        description:
          'stated by the owner when asked after the wash: "yep eco50 and finish powerball ultimate"',
      },
    },
    notes:
      "Measured record of owner wash 02, written by scripts/make-owner-wash-02-measured.ts. The owner's note and photograph: docs/reference/calibration_runs/2026-10-14_stacked_plates/ (README.md, IMG_9141.JPG). There was no planned record and no prediction before the wash; the prediction made after the result is anchors/reports/v7/owner-wash-02.predict.txt. STATED BY THE OWNER when asked after the wash (\"yep eco50 and finish powerball ultimate\"): the programme, Eco 50, and the detergent, Finish Powerball Ultimate. TAKEN, NOT STATED: the machine (the owner's Bosch SMV4HAX40G of wash 01); no programme options; one capsule in the dispenser at 12.9 g, as wash 01 took it; the date of the run (2026-10-14: the photograph was taken on the morning of 15 October, after the run of the night before); that the upper basket was empty (it is not in the photograph); how the yolk was spread (taken as on wash 01). NOT MEASURED, and carried as input scenarios (sim.scenarios), not as fact: the amount of yolk per plate (half a teaspoon, not weighed). NOT REPORTED: the clock times and the display time of the run. THE LOAD, from the photograph, which was taken after the wash (there is no yolk on the flat plate) and is taken to show the plates as they stood during it: the lower basket holds the four plates and nothing else, and no cutlery basket (taken out in the game). The three standing plates stand in the left middle and front rows; the photograph was matched by a pinhole camera fitted to ten points of the basket (rms 8 px), and the stand-ins' rims project onto the plates' rims to about 5 mm. Which way they face is read from the photograph: on the plate a slot behind and on the first plate of the pair the back of the well (base and foot ring) shows beyond the rim on the side of the left wall, and nothing shows beyond the second plate of the pair on the side of the middle, so all three have their backs to the left wall and their eating faces to the middle, as wash 3 of docs/calibration/protocol.md asks for its pair. The black lettering on the rims cannot be told from reflections in the glaze at that angle. The real plates lean back further than the stand-ins (the single plate about 15 degrees from upright, the stand-in 7). The size of the gap between the two plates of the slot is not known (about 3 mm taken). One wash, judged by eye.",
  },
  machine: {
    ...game.machine,
    notes:
      "Taken: the owner's Bosch SMV4HAX40G, the machine of wash 01. The configuration is the game's default with the cutlery basket out, as in the photograph",
  },
  programme: {
    ...game.programme,
    options: [],
    notes:
      'Eco 50, as the owner stated when asked after the wash ("yep eco50 and finish powerball ultimate"). No options: taken',
  },
  consumables: {
    detergent: {
      product: 'Finish Powerball Ultimate',
      form: 'pouch',
      dose_g: 12.9,
      placement: 'dispenser',
      method: 'owner_stated',
      notes:
        "Finish Powerball Ultimate, as the owner stated when asked after the wash. One capsule in the dispenser, at wash 01's 12.9 g: taken",
    },
  },
  load: { ...game.load, items },
  observations,
  sim: { tier: 'official' as const, level_seed: level.seed, sim_seed: 1, scenarios },
};

const checked = validateWashRecord(JSON.parse(JSON.stringify(measured)) as unknown);
if (!checked.ok) {
  throw new Error(checked.error.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
}
writeFileSync(out, `${JSON.stringify(measured, null, 1)}\n`);
console.log(
  `wrote ${out}: ${items.length} plates, ${observations.length} observations, ${scenarios.length} scenarios`,
);
for (const scenario of scenarios) {
  console.log(`  weight ${scenario.weight}: ${scenario.notes}`);
}
