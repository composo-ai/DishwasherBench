/**
 * The generic loading guidance: a fixed short text of the kind printed in an appliance manual,
 * shown to every player in the same words (docs/research/benchmark.md section 9, item 5).
 * The human client shows it beside the rules of the level, and the MCP server offers it as a
 * resource, both from `GET /api/guidance`.
 *
 * It is written from the loading advice in the manufacturer's manual for the machine of the
 * starter levels (docs/research/machine-bosch-smv4hax40g.md section 5.3, which summarises the
 * manual) and from what the manual and the energy label print about the programme the game is
 * scored on (the same dossier, sections 4.1 and 4.7: Eco 50, 4 h 55 min, a wash at 50 degrees
 * C, no sensor decisions). The text is the project's own summary; it is not a quotation of the
 * manual. It states that and nothing else: no word about how the game works out a wash, and
 * nothing a person with the manual in hand would not have. Version 2 (2026-10-11) added the
 * paragraph on the programme.
 */

/** Version of the guidance text; part of every episode record, so results name the text shown. */
export const LOADING_GUIDANCE_VERSION = '2';

/** Title of the guidance, for menus and resources. */
export const LOADING_GUIDANCE_TITLE = "Loading the dishwasher: the manufacturer's advice";

/** The guidance, one paragraph per point. Identical for people and for models. */
export const LOADING_GUIDANCE = [
  "This is the loading advice of the manufacturer's manual for this dishwasher, in short.",
  'Where things go. Arrange cups, glasses and small items of tableware in the top basket, and pans and plates in the bottom basket. Put heavily soiled tableware, such as pans, in the bottom basket: the spray jet is more powerful there.',
  'Which way up. Position containers with their openings facing down. Position items with curves or recesses at an angle, so that water can run off; water collects in recesses that face up.',
  'Space. The spray jets must reach the surfaces of the tableware. Do not place items too close together and do not overfill a basket; avoid points of contact between items.',
  'Cutlery. Arrange cutlery in the cutlery basket, unsorted, with the sharp points downwards. Lay long and pointed items flat on the knife shelf of the top basket.',
  'Tall, narrow receptacles are not rinsed adequately in the corner areas of a basket, or when they stand at too great an angle.',
  'Spray arms. Do not block the spray arms: make sure that they can turn freely and that nothing hangs or stands in their path. A spray arm that strikes tableware, or cannot turn, leaves remnants of food on the load.',
  'Detergent. The tablet falls from the dispenser in the door into the tablet collecting tray at the front of the top basket. Do not place anything in that tray, and do not block it or the lid of the dispenser with tableware: the lid must be able to open fully, or the detergent is not released.',
  'Door. Load the baskets so that no item projects and interferes with the closing of the door.',
  'Programme. The load is washed on Eco 50: a cold pre-rinse, a long wash at 50 degrees C, an intermediate rinse, a hot final rinse and drying, 4 hours 55 minutes in all, with one detergent tablet. The programme runs the same way whatever is loaded: it does not adjust itself to the load or to how dirty it is.',
  'Large plates. With the top basket at its highest level, the bottom basket takes plates up to 30 cm in diameter and the top basket up to 22 cm; at the middle level 27.5 cm and 24.5 cm; at the lowest level 25 cm and 27 cm.',
].join('\n\n');

/** Answer of `GET /api/guidance`. */
export interface GuidancePayload {
  readonly version: string;
  readonly title: string;
  readonly text: string;
}

/** The guidance as the server sends it. */
export function guidancePayload(): GuidancePayload {
  return {
    version: LOADING_GUIDANCE_VERSION,
    title: LOADING_GUIDANCE_TITLE,
    text: LOADING_GUIDANCE,
  };
}
