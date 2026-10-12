/**
 * Validation of request bodies. A schema checks the form of a request (the right keys with the
 * right JSON types, no unknown keys, finite numbers); what the values mean (whether the item
 * exists, the frame is one of the machine's, the preset one of the item's) is decided by the
 * session, which answers with the reasons of its contract. A request that fails here is
 * answered with HTTP 400 and `{ accepted: false, reason: 'invalid_argument', detail }`; it never
 * reaches the session and is not logged.
 */

import { z } from 'zod';

const id = z.string().min(1).max(128);
const vec3 = z.tuple([z.number(), z.number(), z.number()]);
const quat = z.tuple([z.number(), z.number(), z.number(), z.number()]);

const orientation = z.union([
  z.strictObject({ quat_wxyz: quat }),
  z.strictObject({
    preset: id,
    yaw_deg: z.number().optional(),
    pitch_deg: z.number().optional(),
    roll_deg: z.number().optional(),
  }),
]);

/** A player's name: a participant id or the name of a policy, 1 to 64 printable characters. */
const playerName = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[^\u0000-\u001f\u007f]+$/u, 'no control characters');

/** Who a session is for, as whoever creates it states it. */
export const playerSchema = z.strictObject({
  kind: z.enum(['human', 'agent', 'scripted']),
  name: playerName,
  interface: id.optional(),
});

/** Body of `POST /api/sessions`. */
export const createSessionSchema = z.strictObject({
  level_id: id,
  player: playerSchema.optional(),
});

/** Body of `POST /api/sessions/:id/player`: the name a player gives themselves. */
export const namePlayerSchema = z.strictObject({ name: playerName });

/** Body of `place`. */
export const placeSchema = z.strictObject({
  item_id: id,
  frame: id,
  position_mm: vec3,
  orientation,
  mode: id.optional(),
  insert_dir: vec3.optional(),
});

/** Body of `remove` and of `get_item`. */
export const itemSchema = z.strictObject({ item_id: id });

/** Body of the calls that take no parameters; an absent body is accepted. */
export const emptySchema = z.strictObject({});

/** Body of `set_rack`. */
export const setRackSchema = z.strictObject({
  rack: id,
  option: z.strictObject({ name: id, value: id }),
});

/** Body of `start_cycle`; an absent body is accepted. */
export const startCycleSchema = z.strictObject({ programme: id.optional() });

/** A tier of the wash simulation. */
export const washTierSchema = z.enum(['official', 'fast']);

/**
 * Query of `start_cycle`: the tier the page asks this wash to be run at. It is no part of the
 * session's request (the session knows nothing of tiers) and is not logged as one.
 */
export const startCycleQuerySchema = z.object({ wash_tier: washTierSchema.optional() });

/** Body of `rewash`; an absent body asks for the official tier. */
export const rewashSchema = z.strictObject({ wash_tier: washTierSchema.optional() });

/** Body of `preview`. */
export const previewSchema = z.strictObject({
  item_id: id,
  frame: id,
  position_mm: vec3,
  orientation,
});

/** Body of `list_slots`. */
export const listSlotsSchema = z.strictObject({ rack: id, item_id: id.optional() });

/** Body of `render`. */
export const renderSchema = z.strictObject({
  view: id,
  options: z
    .strictObject({
      labels: z.boolean().optional(),
      grid: z.boolean().optional(),
      racks: z.enum(['in', 'out']).optional(),
      highlight: z.array(id).max(200).optional(),
      ghost: previewSchema.optional(),
      size_px: z.number().int().min(16).max(1024).optional(),
      camera: z
        .strictObject({
          // A camera somewhere a kitchen could hold it: whole turns at most, and from a
          // millimetre to ten metres from what it looks at.
          azimuth_deg: z.number().min(-720).max(720),
          elevation_deg: z.number().min(-90).max(90),
          target_mm: z.tuple([
            z.number().min(-5000).max(5000),
            z.number().min(-5000).max(5000),
            z.number().min(-5000).max(5000),
          ]),
          distance_mm: z.number().min(1).max(10000),
          fov_deg: z.number().min(5).max(120),
        })
        .optional(),
      item_id: id.optional(),
      after_wash: z.boolean().optional(),
      traces: z.boolean().optional(),
    })
    .optional(),
});

/** What is wrong with a body, in one line, from a failed parse. */
export function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((issue) => {
      const path = issue.path.map(String).join('.');
      return path === '' ? issue.message : `${path}: ${issue.message}`;
    })
    .join('; ');
}
