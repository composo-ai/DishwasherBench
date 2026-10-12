/**
 * The argument and result schemas of the tools: one tool per action and query of the session
 * contract (`@spotless/session`, `types.ts`), with the contract's names and fields.
 *
 * Arguments are strict: an unknown key or a wrong type is a tool error and never reaches the
 * game. Frames, racks, views and placement modes are the contract's enumerations, so a model
 * is told the legal values; whether an item, a preset or an option exists is left to the
 * game, which answers with its own reasons.
 *
 * Results are described loosely on purpose (unknown keys pass): the game's results may gain
 * fields, and a client that validates a result against its schema must not fail on a field
 * this file has not heard of. Every described field carries what it means and its unit.
 */

import { z } from 'zod';

const id = z.string().min(1).max(128);

/** Three numbers. Arrays of fixed length, not tuples: every client's JSON Schema reads them. */
const vec3 = (what: string): z.ZodType<number[]> => z.array(z.number()).length(3).describe(what);

const FRAMES = ['tub', 'lower_rack', 'upper_rack', 'third_rack', 'cutlery_basket'] as const;
const RACKS = ['lower_rack', 'upper_rack', 'third_rack', 'cutlery_basket'] as const;

/** The views the `render` tool draws. */
export const VIEWS = [
  'iso_lower',
  'iso_upper',
  'top_lower',
  'top_upper',
  'top_cutlery',
  'front',
  'left',
  'right',
  'custom',
  'item',
  'items',
] as const;

const frame = z
  .enum(FRAMES)
  .describe(
    'Frame the pose is given in. All frames are right-handed, z up, axes parallel to the tub. tub: origin on the lower spray-arm axis at the tub floor, +x right as you face the open machine, +y towards the back. A basket: origin at its front-left corner on top of its base grid; the frame moves with the basket.',
  );

const orientation = z
  .union([
    z
      .strictObject({
        quat_wxyz: z
          .array(z.number())
          .length(4)
          .describe('Unit quaternion (w, x, y, z) taking the item frame to the placement frame.'),
      })
      .describe('An orientation as a quaternion.'),
    z
      .strictObject({
        preset: id.describe(
          "Name of one of the item's orientation_presets (get_level / get_item), for example upright, inverted, on_edge.",
        ),
        yaw_deg: z
          .number()
          .optional()
          .describe('Then turn about +z (vertical) of the placement frame, degrees. Default 0.'),
        pitch_deg: z
          .number()
          .optional()
          .describe(
            'Turn about +y of the placement frame, degrees, applied before yaw. Default 0.',
          ),
        roll_deg: z
          .number()
          .optional()
          .describe('Turn about +x of the placement frame, degrees, applied first. Default 0.'),
      })
      .describe(
        'A preset of the item plus offsets in whole degrees: q = Rz(yaw) * Ry(pitch) * Rx(roll) * q_preset, axes fixed to the placement frame.',
      ),
  ])
  .describe(
    'Orientation of the item: a quaternion, or a named preset with yaw/pitch/roll offsets.',
  );

const pose = {
  item_id: id.describe('Id of an item of the level, for example plate_01.'),
  frame,
  position_mm: vec3(
    "Position of the item's reference point (the centre of its bounding box unless its record says otherwise) in the frame, millimetres [x, y, z]. Rounded to 1 mm.",
  ),
  orientation,
};

/**
 * The same pose for the tools that take one beside `place` (`preview`, the ghost of `render`):
 * the same shape with short descriptions, because `place` has said it all and every word of
 * a schema travels with every request of a model that plays.
 */
const poseAsForPlace = {
  item_id: id.describe('Id of an item of the level.'),
  frame: z.enum(FRAMES).describe('Frame of the pose, as for place.'),
  position_mm: vec3("Position of the item's reference point in the frame, millimetres."),
  orientation: z
    .union([
      z.strictObject({ quat_wxyz: z.array(z.number()).length(4) }),
      z.strictObject({
        preset: id,
        yaw_deg: z.number().optional(),
        pitch_deg: z.number().optional(),
        roll_deg: z.number().optional(),
      }),
    ])
    .describe('Orientation, as for place: a quaternion, or a preset with yaw, pitch and roll.'),
};

const empty = z.strictObject({});

/** Argument schemas by tool name. */
export const INPUT_SCHEMAS = {
  place: z.strictObject({
    ...pose,
    mode: z
      .enum(['drop', 'insert', 'set'])
      .optional()
      .describe(
        'How the item is let go. drop (default): it must reach the pose straight down from above; it is lowered to first contact and released. insert: it approaches along insert_dir over 300 mm, pushed with at most 15 N, and can nudge neighbours aside. set: put exactly at the pose; only in levels whose rules say exact_placement.',
      ),
    insert_dir: vec3(
      'For mode insert: direction of the push in the frame (need not be unit). Default straight down [0, 0, -1].',
    ).optional(),
  }),
  remove: z.strictObject({ item_id: pose.item_id }),
  reset: empty,
  set_rack: z.strictObject({
    rack: z.enum(RACKS).describe('The basket to change.'),
    option: z
      .strictObject({
        name: id.describe(
          'Option name from the rack card of get_level: position, height, tine_row_<id>, shelf_<id>.',
        ),
        value: id.describe('One of the values the option lists, for example in or out.'),
      })
      .describe('Which option to set, and to what.'),
  }),
  start_cycle: z.strictObject({
    programme: id
      .optional()
      .describe(
        'Programme id; default the programme the level is scored on (get_level: programme). The levels of the game accept no other (unknown_programme).',
      ),
  }),
  get_level: empty,
  get_item: z.strictObject({ item_id: pose.item_id }),
  get_state: z.strictObject({
    rack: z
      .enum(RACKS)
      .optional()
      .describe(
        'Only the items lying in this basket or placed in its frame. Default: every item in the machine.',
      ),
    items: z
      .array(id)
      .max(200)
      .optional()
      .describe('Only these items. Default: every item in the machine.'),
  }),
  render: z.strictObject({
    view: z
      .enum(VIEWS)
      .describe(
        'The view (the description says what each shows). front has x across and z up; left and right have y across and z up. custom needs options.camera, item needs options.item_id.',
      ),
    options: z
      .strictObject({
        labels: z
          .boolean()
          .optional()
          .describe('Write the item id on every item in the machine. Default false.'),
        grid: z
          .boolean()
          .optional()
          .describe('Draw a millimetre grid with axis values. Default false.'),
        racks: z
          .enum(['in', 'out'])
          .optional()
          .describe(
            'Draw every basket pushed in or pulled out, whatever its real position (the load is shown moved with it, not re-simulated). Default: as they are.',
          ),
        highlight: z.array(id).max(200).optional().describe('Item ids to mark in yellow.'),
        ghost: z
          .strictObject(poseAsForPlace)
          .optional()
          .describe('A candidate pose to draw as a translucent ghost without placing the item.'),
        size_px: z
          .number()
          .int()
          .min(64)
          .max(1024)
          .optional()
          .describe('Edge of the square image, pixels. Default 768, maximum 1024.'),
        camera: z
          .strictObject({
            azimuth_deg: z
              .number()
              .describe(
                'Where the camera stands, as an angle about +z from the front (-y): 0 front, 90 right side, 180 back, -90 left side.',
              ),
            elevation_deg: z
              .number()
              .describe('Angle of the camera above the horizontal, degrees.'),
            target_mm: vec3('Point looked at, tub frame, millimetres.'),
            distance_mm: z
              .number()
              .positive()
              .describe('Distance of the camera from the target, millimetres.'),
            fov_deg: z.number().positive().max(170).describe('Vertical field of view, degrees.'),
          })
          .optional()
          .describe(
            'Required for view custom. For view item: one picture from this azimuth and elevation instead of the four fixed sides (target and distance are fitted to the item).',
          ),
        item_id: id.optional().describe('Required for view item: which item to show.'),
        after_wash: z
          .boolean()
          .optional()
          .describe(
            'View item: show the item as it came out of the wash, with what is left on it painted magenta. Needs a finished report.',
          ),
        traces: z
          .boolean()
          .optional()
          .describe(
            'In a picture of the washed load or of a washed item: also draw, as small dots, the spots that carry a trace of soil too faint to count against the item. Default false.',
          ),
      })
      .optional(),
  }),
  preview: z.strictObject(poseAsForPlace),
  list_slots: z.strictObject({
    rack: z.enum(RACKS).describe('The basket whose tine rows and slots to list.'),
    item_id: id
      .optional()
      .describe(
        'The item in hand. With it the answer is the suggested places for this item, most useful first, each a position and orientation to pass to place. Without it: the tine rows and slots of the basket as geometry.',
      ),
    offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        'Skip this many entries of the list (next_offset of the answer before). Default 0. A further part of the list asked last costs nothing while the scene is unchanged.',
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(30)
      .optional()
      .describe('How many entries to give. Default 12, at most 30.'),
    row: id
      .optional()
      .describe('Only the places or slots of this tine row, for example tine_row_r1.'),
  }),
  check_load: empty,
  get_report: z.strictObject({
    wait_s: z
      .number()
      .min(0)
      .max(120)
      .optional()
      .describe(
        'Wait up to this many seconds for a running wash to end before answering (default 0: answer at once). The wait happens here, not in the game; it costs nothing.',
      ),
  }),
} as const;

/** Name of a tool: an action or a query of the session contract. */
export type ToolName = keyof typeof INPUT_SCHEMAS;

/** Every tool name: the five actions, then the eight queries. */
export const TOOL_NAMES: readonly ToolName[] = [
  'place',
  'remove',
  'reset',
  'set_rack',
  'start_cycle',
  'get_level',
  'get_item',
  'get_state',
  'render',
  'preview',
  'list_slots',
  'check_load',
  'get_report',
];

// ---------------------------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------------------------

const o = z.looseObject;
const n = z.number;
const s = z.string;
const b = z.boolean;
const mm3 = z.array(z.number()).length(3);

const programmeCard = o({
  programme_id: s(),
  display_name: s(),
  phases: z.array(o({ name: s(), temperature_c: n().nullable(), duration_s: n() })),
  detergent: o({
    type: s(),
    dose_g: n(),
    name: s().optional().describe('Name of the product, as on the pack.'),
  }).nullable(),
  status: s().describe('scored: the programme the level is scored on.'),
  note: s().describe('What the status means, in words.'),
});

const budget = o({
  actions: s().optional().describe('Accepted actions, used/allowed, for example 15/400.'),
  queries: s().optional().describe('Charged queries, used/allowed.'),
  washes: s().optional().describe('Washes, used/allowed.'),
}).describe('The budget counters as used/allowed.');

const table = (what: string): z.ZodType =>
  o({
    columns: z.array(s()).describe('The names of the fields of a row, in order.'),
    rows: z.array(z.array(z.unknown())).describe('One row an entry.'),
  }).describe(what);

const loadItem = o({
  item_id: s(),
  frame: s().describe('The frame the pose is in: the frame the item was placed in.'),
  position_mm: mm3.describe(
    "The item's reference point in that frame, millimetres (0.1 mm steps).",
  ),
  quat_wxyz: z
    .array(z.number())
    .length(4)
    .describe('Orientation (w, x, y, z), item frame to that frame.'),
  stable: b().describe('Whether it stayed put when nudged after it last settled.'),
  touches: z.array(s()).describe('What it touches: item ids and machine parts.'),
  location: s().describe(
    'Where it lies: lower_rack, upper_rack, tub_floor, or outside (on the open door: not washed).',
  ),
  moved_mm: n()
    .optional()
    .describe('For an item the action displaced by more than 1 mm or 1 degree: how far.'),
  turned_deg: n().optional().describe('And how far it turned, degrees.'),
});

const sceneState = o({
  state_hash: s().describe(
    "The first 12 hex digits of the sha256 of the scene (the episode's record has it in full).",
  ),
  phase: s().describe('loading, washing or finished.'),
  racks: z.record(z.string(), z.string()).describe('Position of every basket: in or out.'),
  rack_options: z
    .record(z.string(), z.string())
    .describe("Current value of every adjustable option, keyed '<rack>.<option>'."),
  placed: table(
    'The items in the machine (all, or the part asked for), one row an item: item_id, frame, position_mm, quat_wxyz, stable, touches, location.',
  ),
  placed_total: n().describe('Number of items in the machine, whatever part is listed.'),
  unplaced: z
    .array(s())
    .optional()
    .describe('Ids of the items on the counter (with the whole state, or of the items asked for).'),
  part: o({ rack: s().optional(), items: z.array(s()).optional() })
    .optional()
    .describe('Present when the answer is a part of the state: what was asked for.'),
  budget,
});

const changes = o({
  items: z
    .array(loadItem)
    .optional()
    .describe(
      'Every item whose entry in the scene state is new or different, with its whole new entry.',
    ),
  to_counter: z
    .array(s())
    .optional()
    .describe('Items that were in the machine and are back on the counter.'),
  racks: z.record(z.string(), z.string()).optional().describe('Baskets that moved: in or out.'),
  rack_options: z.record(z.string(), z.string()).optional().describe('Options that changed.'),
  phase: s().optional().describe('The phase, when it changed.'),
}).describe(
  'What the action changed in the scene state, completely; a key that changed nothing is absent.',
);

const loadSummary = o({
  placed: n().describe('Items in the machine.'),
  unplaced: n().describe('Items on the counter.'),
  by_location: z.record(z.string(), z.number()).describe('Items in the machine by where they lie.'),
  unstable: z.array(s()).optional().describe('The items in the machine that are not stable.'),
  racks: z.record(z.string(), z.string()).describe('Position of every basket: in or out.'),
}).describe('The whole load in a few numbers.');

/** What every accepted action returns beside its own fields. */
const afterAction = {
  changes: changes.optional(),
  state: sceneState
    .optional()
    .describe(
      'The whole scene after the action, in place of changes, when this client has not yet been given the whole scene (no get_state without rack or items, and no accepted action before).',
    ),
  load: loadSummary.optional(),
  budget: budget.optional(),
  state_hash: s().optional(),
};

const rejected = {
  accepted: b().describe(
    'False when the call was refused: nothing changed and nothing was charged.',
  ),
  reason: s().optional().describe('Why it was refused (when accepted is false).'),
  detail: s().optional().describe('The refusal in words, when there is more to say.'),
};

const loadCheck = {
  shifted: table(
    'Items that shifted by more than 1 mm or 1 degree as the baskets went in, one row an item: item_id, displacement_mm, rotation_deg, pushed_by (what pushed it: a part of the tub, the door; empty when it shifted by the motion of its basket alone).',
  ).optional(),
  fell_out: z
    .array(s())
    .optional()
    .describe(
      'Items that are neither in a basket nor inside the tub once the baskets are in. They will not be washed.',
    ),
  on_tub_floor: z
    .array(s())
    .optional()
    .describe('Items lying on the tub floor or standing on it through a basket.'),
  protruding: z
    .array(
      o({
        item_id: s(),
        rack: s(),
        beyond_mm: n().describe('How far beyond the envelope, millimetres.'),
        over: s()
          .optional()
          .describe(
            'Over which side of the envelope it reaches furthest: left or right as seen from the front of the machine, front (towards the door), rear, or top (above the height that is clear over the whole basket).',
          ),
        touching: z
          .array(s())
          .optional()
          .describe(
            'What it touches that is neither an item nor a part of its own basket (the tub, the door, the other basket). Empty: it is clear of them.',
          ),
      }),
    )
    .optional()
    .describe(
      "Items that reach out of their basket's loading envelope once the baskets are in and the door is shut. A fact and no fault in itself.",
    ),
  racks: z
    .array(o({ rack: s(), slides_in: b(), blocked_by: s().optional() }))
    .optional()
    .describe('Whether each basket slides fully in.'),
  spray_arms: z
    .array(
      o({
        arm: s(),
        full_rotation: b().describe(
          'True when the arm turns a full circle without touching anything.',
        ),
        first_contact_angle_deg: n().optional().describe('Arm angle at first contact, degrees.'),
        blocked_by: s().optional().describe('What it touches.'),
      }),
    )
    .optional()
    .describe('Each spray arm turned by hand through a full circle.'),
  door_closes: b().optional().describe('Whether the door closes on the load.'),
  door_blocked_by: z.array(s()).optional(),
  dispenser_opens: b()
    .optional()
    .describe('Whether the lid of the detergent dispenser can open fully.'),
  dispenser_blocked_by: z.array(s()).optional(),
  tablet_path_clear: b()
    .optional()
    .describe('Whether the detergent tablet can fall into its tray unhindered.'),
  tablet_blocked_by: z.array(s()).optional(),
};

const itemKind = {
  class: s().describe('Item class, for example dinner_plate.'),
  display_name: s(),
  material: s().describe('Material of the body.'),
  mass_kg: n(),
  bbox_mm: mm3.describe("Size of the bounding box in the item's own frame, millimetres."),
  reference_point_mm: mm3.describe(
    'The point of the item that position_mm refers to, item frame, millimetres.',
  ),
  dims: z.record(z.string(), z.number()).describe('Class-specific dimensions, millimetres.'),
  orientation_presets: z
    .array(o({ name: s(), quat_wxyz: z.array(z.number()).length(4), description: s().optional() }))
    .describe('Named orientations of the item, usable as orientation.preset.'),
};

/** What the pieces of one kind have in common (get_level: item_types). */
const itemType = o({
  ...itemKind,
  orientation_presets: z
    .array(
      z.union([
        s(),
        o({ name: s(), quat_wxyz: z.array(z.number()).length(4), description: s().optional() }),
      ]),
    )
    .describe(
      'The presets of the kind, usable as orientation.preset: a name of orientation_presets of the card, or the preset in full where this kind means something else by the name.',
    ),
});

const itemSoils = z
  .array(
    o({
      description: s().describe('What is on the item, in words.'),
      type: s().describe('Soil id.'),
      regions: z
        .record(z.string(), z.number())
        .describe(
          'The regions of the item the soil lies on, each with the fraction covered, 0 to 1.',
        ),
      amount_g: n(),
      age_h: n().describe('Hours since the meal.'),
      heat_history: s().describe('none, warm, cooked, baked or burnt.'),
    }),
  )
  .describe('The soils on the item; empty for a clean item.');

const itemRecord = o({
  item_id: s(),
  ...itemKind,
  soils: itemSoils,
  points: n().describe('Points scored if the item comes out clean.'),
  thumbnails: z
    .array(o({ mime_type: s(), width_px: n(), height_px: n(), view: s().optional() }))
    .optional()
    .describe('The pictures returned beside this result, in order (get_item only).'),
});

const image = o({
  mime_type: s(),
  width_px: n(),
  height_px: n(),
}).describe('The picture is returned as image content beside this result.');

const dropFields = {
  item_id: s().optional(),
  released_at: o({
    position_mm: mm3,
    quat_wxyz: z.array(z.number()).length(4),
  })
    .optional()
    .describe(
      'Where the item was let go, in the frame it was placed in: after lowering to first contact, or at the end of the insert. Its settled pose is its entry in changes.items.',
    ),
  displacement_mm: n().optional().describe('Distance from release to rest, millimetres.'),
  rotation_deg: n().optional().describe('Rotation from release to rest, degrees.'),
  settle_time_s: n().optional().describe('Simulated seconds until it was at rest.'),
  stable: b()
    .optional()
    .describe(
      'True when it came to rest and stayed within 4 mm and 3 degrees when nudged lightly (1 cm/s) from four sides. A light nudge only: it is not a test of the basket being pushed in, which can still shift or tip an item that passed (check_load tests that), and cutlery with play in its cell can fail it without being about to fall.',
    ),
  resting: o({
    lowest_point_mm: n().describe(
      "Height of the item's lowest point above the top of the base grid of the frame it was placed in (above the tub floor for the tub frame), millimetres.",
    ),
    on_base: b().describe(
      'True when the lowest point is within 10 mm of the base grid: the item stands on the floor of the basket. False: it is held up by tines, a shelf or other items.',
    ),
    force_over_weight: n().describe(
      'Sum of the contact forces on the item over its weight: about 1 when it simply rests, several when it is wedged between things.',
    ),
  })
    .optional()
    .describe('How the item rests after settling (absent when it left the basket).'),
  contact_forces_N: z
    .record(z.string(), z.number())
    .optional()
    .describe('What the item touches at rest, each with the normal force on it, newtons.'),
  fell_through: b()
    .optional()
    .describe(
      'Present and true when it dropped through the basket (onto the tub floor or the door).',
    ),
  fell_out: b().optional().describe("Present and true when it left the basket's envelope."),
  returned: z
    .array(s())
    .optional()
    .describe(
      'Items that ended on the kitchen floor and are back on the counter (the action is still charged). Absent when there is none.',
    ),
  penetration_mm: n()
    .optional()
    .describe('For collision_at_pose: how deep the requested pose overlaps, millimetres.'),
  colliding_with: z.array(s()).optional().describe('For collision_at_pose: what it overlaps.'),
  blocked_by: z
    .union([s(), z.array(s())])
    .optional()
    .describe('For not_insertable / blocked: what is in the way.'),
  ...afterAction,
};

const reportItem = o({
  item_id: s(),
  loaded: b().describe('False for an item that was not washed.'),
  clean: b()
    .optional()
    .describe(
      'The verdict that decides the points: at most 4 specks and at most 4 mm2 of visible soil on the whole item. Water left in it does not count.',
    ),
  points_awarded: n().optional().describe("The item's points when clean, else 0."),
  graded_score: n()
    .optional()
    .describe('score_iec over 5, 0 to 1; reported beside the points, does not count.'),
  score_iec: n()
    .optional()
    .describe(
      'Cleaning score 0 (heavily soiled) to 5 (spotless), in steps set by specks and visible area; 4 and 5 are clean.',
    ),
  reason: s().optional().describe('For an item that is not clean: why, as a statement of fact.'),
  visible_area_mm2: n()
    .optional()
    .describe(
      'Area of the whole item that still shows soil to the eye, mm2. Clean allows at most 4.',
    ),
  specks: n()
    .optional()
    .describe('Separate small specks of visible soil on the whole item. Clean allows at most 4.'),
  residual_fraction_area: n()
    .optional()
    .describe("visible_area_mm2 over the item's whole surface area, 0 to 1."),
  residual_mass_fraction: n()
    .optional()
    .describe(
      'Share of the dry mass of the soil that was on the item and is still on it, 0 to 1, visible or not. Information; clean is decided by what is visible.',
    ),
  residue_regions: z
    .array(
      o({
        region: s().describe("A region of the item, by the name the item's record uses."),
        fraction: n().describe(
          "visible_area_mm2 of the region over the region's whole surface, 0 to 1.",
        ),
        visible_area_mm2: n().optional().describe('Area of the region that still shows soil, mm2.'),
        soiled_area_mm2: n()
          .optional()
          .describe(
            'Area of the region that carried soil when it went in, mm2 (what could have been left at most).',
          ),
        specks: n().optional().describe('Specks of visible soil on the region.'),
        soils: z
          .array(
            o({
              type: s(),
              residual_fraction: n().describe(
                'Share of the dry mass of this soil on this region that is still there, 0 to 1.',
              ),
            }),
          )
          .optional(),
      }),
    )
    .optional()
    .describe('Where visible residue remains, by region of the item. Empty for a clean surface.'),
  residue_cells: n()
    .optional()
    .describe(
      'Number of small patches of the surface that still carry any soil, traces included: the ones a picture with after_wash paints.',
    ),
  moved_during_wash: b()
    .optional()
    .describe('Always false: the wash is simulated with every item where it was placed.'),
  likely_moved: b()
    .optional()
    .describe(
      'True when the jets pushed up on the item harder than its weight, so that a real one would probably have been lifted or turned. A warning only: it changes neither clean nor the points, and the item is washed where it was placed.',
    ),
  holds_water: b()
    .optional()
    .describe(
      'True when more than 1 ml of water is left standing in the item. Reported; does not decide clean.',
    ),
  retained_water_ml: n().optional().describe('Water standing in the item at the end, millilitres.'),
  surface_film_g: n()
    .optional()
    .describe(
      'Water left as a film on the surface at the end, grams (drying is not simulated). Reported; does not decide clean.',
    ),
  simulated: b()
    .optional()
    .describe('False when no wash was simulated for the item (a placeholder wash).'),
});

const report = o({
  benchmark_version: s(),
  level_id: s(),
  state_hash: s(),
  job: o({
    status: s(),
    runtime_s: n(),
    fidelity: s().describe('official, fast, or placeholder_not_simulated.'),
    sim_version: s().optional().describe('Version of the wash simulation.'),
    runner_version: s()
      .optional()
      .describe('The code that ran the wash, ending in a fingerprint of its source.'),
    result_hash: s().optional().describe('Hash of the result of the simulation.'),
    notes: z
      .array(s())
      .optional()
      .describe(
        'Things about this wash worth knowing: a spray arm the load held still, a dispenser that could not open.',
      ),
  }),
  score: o({
    points: n().describe('Sum of the points of the items that came out clean.'),
    points_available: n().describe('Sum of the points of every item of the level.'),
    graded_points: n().describe(
      'Sum over the washed items of points times graded_score; reported, does not count.',
    ),
    points_loaded: n().optional().describe('Sum of the points of the items that were washed.'),
  }),
  items: z.array(reportItem).describe('One entry per item of the level.'),
});

const rackCard = o({
  rack: s(),
  origin_in_mm: mm3.describe(
    'Origin of the basket frame in the tub frame when pushed in, millimetres.',
  ),
  origin_out_mm: mm3.describe('The same when pulled out.'),
  envelope_mm: mm3.describe(
    'Size of the loading envelope along the basket axes from its origin, millimetres.',
  ),
  tablet_tray: o({ min_mm: mm3, max_mm: mm3 })
    .optional()
    .describe(
      'The tray that catches the detergent tablet, where the basket has one: the corners of its box in the basket frame, millimetres. Keep it and the space over it free.',
    ),
  options: z
    .array(o({ name: s(), description: s(), values: z.array(s()) }))
    .describe('What set_rack can change.'),
});

/** Result schemas by tool name. */
export const OUTPUT_SCHEMAS = {
  place: o({ ...rejected, ...dropFields }),
  remove: o({
    ...rejected,
    item_id: s().optional(),
    returned: z.array(s()).optional(),
    ...afterAction,
  }),
  reset: o({
    ...rejected,
    removed: z.array(s()).optional().describe('Ids of the items taken out.'),
    ...afterAction,
  }),
  set_rack: o({
    ...rejected,
    returned: z.array(s()).optional(),
    blocked_by: z
      .union([s(), z.array(s())])
      .optional()
      .describe('For blocked: what is in the way.'),
    ...afterAction,
  }),
  start_cycle: o({
    ...rejected,
    job_id: s().optional().describe('The wash job; get_report reports on it.'),
    programme: s().optional(),
    phase: s().optional().describe('The phase after the call: washing.'),
    prechecks: o(loadCheck)
      .optional()
      .describe('What pushing the baskets in and closing the door found (mechanical facts).'),
    left_out: z
      .array(s())
      .optional()
      .describe(
        'Items that were neither in a basket nor in the tub when the door closed: not washed. Absent when there is none.',
      ),
    ...afterAction,
  }),
  get_level: o({
    benchmark_version: s().optional(),
    level_id: s().optional(),
    title: s().optional(),
    summary: s().optional(),
    machine: o({
      machine_id: s(),
      display_name: s(),
      tub_min_mm: mm3.describe('Corners of the tub interior in the tub frame, millimetres.'),
      tub_max_mm: mm3,
      racks: z.array(rackCard),
      spray_arms: z.array(
        o({
          arm: s(),
          hub_mm: mm3,
          radius_mm: n().describe('Radius of the disc the arm sweeps.'),
          sweep_z_mm: z
            .array(z.number())
            .length(2)
            .describe('Lowest and highest z of the swept volume, tub frame.'),
        }),
      ),
      dispenser: o({ lid_sweep_min_mm: mm3, lid_sweep_max_mm: mm3 }).nullable(),
    }).optional(),
    programme: programmeCard
      .optional()
      .describe('The programme the level is scored on; the default of start_cycle.'),
    secondary_programmes: z
      .array(programmeCard)
      .optional()
      .describe(
        'Other programmes start_cycle accepts by id: empty on every level of the game, which is washed on the scored programme only.',
      ),
    items_total: n().optional().describe('Number of items of the level.'),
    points_total: n().optional().describe('Sum of the points of every item.'),
    orientation_presets: z
      .record(
        z.string(),
        o({ quat_wxyz: z.array(z.number()).length(4), description: s().optional() }),
      )
      .optional()
      .describe(
        'The named orientations of the level, once: quaternion (item frame to placement frame) and meaning. An item type lists the names of its presets.',
      ),
    item_types: z
      .record(z.string(), itemType)
      .optional()
      .describe(
        'Every kind of piece of the level, once: what its pieces have in common. An item names its kind in type.',
      ),
    items: z
      .array(
        o({
          item_ids: z
            .array(s())
            .describe('The items of this entry: pieces of one kind with the same soil and points.'),
          type: s().describe('Their kind: a key of item_types.'),
          points: n().describe('Points each of them scores if it comes out clean.'),
          soils: itemSoils,
        }),
      )
      .optional()
      .describe('Every item of the level; items_total says how many there are.'),
    rules: o({
      track: s(),
      scoring: s().describe('The scoring rule, in words.'),
      clean_definition: s().describe('What clean means, in words.'),
      budgets: o({ actions_max: n(), queries_max: n(), washes_max: n() }),
      episode_end: s().describe('What ends the episode, in words.'),
      mechanical_checks: b().describe('Whether check_load is available.'),
      exact_placement: b().describe("Whether place accepts mode 'set'."),
    }).optional(),
    manual: s().nullable().optional().describe('How the game is played, in words.'),
    budget: budget.optional(),
    accepted: b().optional(),
    reason: s().optional(),
    detail: s().optional(),
  }),
  get_item: o({ ...rejected, item: itemRecord.optional(), budget: budget.optional() }),
  get_state: sceneState.partial().extend({
    accepted: b().optional(),
    reason: s().optional(),
    detail: s().optional(),
  }),
  render: o({
    ...rejected,
    view: s().optional(),
    image: image.optional(),
    budget: budget.optional(),
  }),
  preview: o({
    ...rejected,
    collision_free: b()
      .optional()
      .describe('True when the pose overlaps nothing by more than 0.5 mm.'),
    penetration_mm: n().optional().describe('Deepest overlap, millimetres; absent when none.'),
    colliding_with: z
      .array(s())
      .optional()
      .describe('What the pose overlaps; absent when nothing.'),
    insertable: b()
      .optional()
      .describe('True when the item can reach the pose straight down from above the basket.'),
    blocked_by: s()
      .optional()
      .describe(
        'When the pose is free but not insertable: what the item meets on its way straight down (an item, a basket such as the upper basket hanging over the lower one or the handle of the cutlery basket, or tub when the basket is pushed in).',
      ),
    blocked_above_mm: n()
      .optional()
      .describe('With blocked_by: how far above the requested pose the item is stopped.'),
    in_bounds: b().optional().describe('True when the pose is inside the envelope of its frame.'),
    lowered_position_mm: mm3
      .nullable()
      .optional()
      .describe(
        'Where the item would be let go after lowering to first contact (its orientation as asked); null if it cannot be placed there.',
      ),
  }),
  list_slots: o({
    ...rejected,
    rack: s().optional(),
    item_id: s().optional(),
    row: s().optional(),
    places_total: n()
      .optional()
      .describe('With item_id: how many suggested places the basket has for the item in all.'),
    free_seated: n()
      .optional()
      .describe('Of them: free now, and the item comes down into the slot or cell.'),
    free_above_tines: n()
      .optional()
      .describe('Of them: free now, but the item would only stand above the tine tips.'),
    not_free: n().optional().describe('Of them: taken, covered or out of reach now.'),
    offset: n().optional().describe('Where in the list this answer starts.'),
    next_offset: n()
      .optional()
      .describe('Present when the list goes on: the offset to ask for next.'),
    repeat: b()
      .optional()
      .describe(
        'Present and true when this answer is a part of the list the game already gave for the scene as it is: no query was charged.',
      ),
    places: table(
      'With item_id: the suggested places, most useful first, one row a place: slot (the slot, or for a pair of rows that hold a plate together both rows before the slot they share), position_mm and orientation (to pass to place as they are), drop_free (whether the pose passes the test of place in the scene as it is now), note (empty for a free place that seats the item; otherwise what is in the way, or that the item would only stand above the tine tips there).',
    ).optional(),
    note: s().optional(),
    tine_rows: table(
      'Without item_id: the tine rows of the basket, one row each: id, start_mm and end_mm (the bases of the first and last tine), tines, pitch_mm, height_mm, lean_deg, lean_toward, folded, partner (the row that holds a plate together with this one).',
    ).optional(),
    slots_total: n().optional().describe('Without item_id: how many slots the basket has in all.'),
    slots_by_kind: z.record(z.string(), z.number()).optional(),
    slots: table(
      'Without item_id: the slots as geometry, one row a slot: id, kind (plate_slot or wide_slot between two tines, basket_cell of the cutlery basket, and where the basket has them cup_rest, knife_shelf, and while a cup shelf is folded down cup_shelf and stemware_notch), centre_mm, width_mm, size_mm (the opening of a cell or a shelf along x and y, for a cup_rest from the wall to its ridge and its length along the wall, else null). A slot is a hint, never a constraint.',
    ).optional(),
    budget: budget.optional(),
  }),
  check_load: o({ ...rejected, ...loadCheck, budget: budget.optional() }),
  get_report: o({
    ...rejected,
    job_id: s().optional(),
    status: s().optional().describe('queued, running, done or failed.'),
    progress: n().optional().describe('For running: fraction complete, 0 to 1.'),
    stage: o({
      stage: s(),
      label: s().describe('What the wash is doing now.'),
      index: n(),
      count: n(),
      fraction: n(),
      eta_s: n().nullable().describe('Estimated seconds the wash still needs, when known.'),
      elapsed_s: n(),
      reported_ago_s: n().optional().describe('Seconds since the wash last reported its stage.'),
    })
      .optional()
      .describe('For running: the stage of the computation and an estimate of the time left.'),
    error: s()
      .optional()
      .describe(
        'For failed: the infrastructure failure, in words. Not a score: the wash is given back.',
      ),
    report: report.optional().describe('For done: the result of the wash.'),
  }),
} as const;
