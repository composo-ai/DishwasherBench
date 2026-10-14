/**
 * The owner's dishwasher: Bosch Serie 4 SMV4HAX40G/13 (BSH platform GV640, type SD6PW1B).
 *
 * Transcribed from docs/research/machine-bosch-smv4hax40g.md: the parametric specification of
 * its section 3.1, the nozzle tables of section 3.2 and the evidence tables of section 2. Section
 * numbers in the provenance records refer to that dossier unless they name another document.
 * Authoring units as in the dossier: millimetres, degrees, litres, litres per minute.
 *
 * The owner measured the machine on 2026-10-09 (docs/reference/owner-measurements.md, photographs
 * IMG_9086 to IMG_9112). docs/research/machine-bosch-owner-update.md turns his notes into
 * numbers and lists, in its section 7, every value of the dossier's specification they replace:
 * both nozzle tables, both rotation senses, the roof height and the heights of both baskets and
 * of everything hung from them. Those values are applied here and outrank the dossier; their
 * provenance records name the update (`U`) and carry its tags: `measured` for the owner's tape
 * and drill (M), `verified` for what was counted or observed on his photographs (C), `photo` for
 * what was scaled from them (P), `estimated` for what is still estimated (E).
 *
 * Frames (dossier section 0.3): the machine frame is the tub frame, with z = 0 at the top
 * surface of the flat fine filter. The lower basket is written in the dossier's frame with its
 * origin at the rim centre and heights from the plane of the floor cross-wire centres; the upper
 * basket in the dossier's frame with its origin on the upper spray-arm axis and heights from the
 * tops of its front-back floor wires in the level trough left of its centre (the floor by the
 * walls and at the foot of the right-hand ridge lies 1 to 3 mm lower). `loadMachineSpec` moves
 * both into the platform's rack frames.
 *
 * Read from the owner's photographs after the dossier and the update were written (review of
 * the generated machine against IMG_9081, IMG_9082 and IMG_9083; pixel positions are in the
 * provenance notes): the relief of the upper basket's floor, the positions of its shelves and
 * its depth, a floor wire behind its front wall, the salt cap and the extent of the flat
 * filter. Tagged `photo`. On 2026-10-11 the owner photographed the upper basket out of the
 * machine, end-on at floor height (IMG_9131): the relief of its floor, its front wall, the
 * heights of its shelves and two of its tine rows are measured on that picture and replace the
 * earlier readings (docs/reference/owner-measurements.md has the reading and what it replaced).
 *
 * Where the dossier leaves a value open, or two of its values disagree, the choice made here is
 * marked "CHOICE" with its reason; each is tagged `estimated` (or `photo` where it is this
 * engineer's own reading of an owner photograph) so that it is not mistaken for dossier data.
 */

import type { BasketDef, CutleryBasketDef, MachineDef, NozzleDef, SprayLevelDef } from '../def.ts';
import { armTorqueTerms } from '../arm.ts';
import { hydraulicOperatingPoint } from '../hydraulics.ts';
import { loadMachineSpec, nozzleArea } from '../load.ts';
import { BOSCH_PROGRAMMES } from './bosch-programmes.ts';
import { arithmetic, prov, repeatDirection } from './helpers.ts';

const B = 'machine-bosch-smv4hax40g.md';

/** The owner update: the measurement specialist's reading of the owner's notes and photographs. */
const U = 'machine-bosch-owner-update.md';

/** The owner's own notes of 2026-10-09. */
const OM = 'docs/reference/owner-measurements.md';

// ---------------------------------------------------------------------------------------------
// Lower basket (part 20001979, now 20007406). Dossier frame: origin at the rim centre; z = 0 at
// the plane of the floor cross-wire centres (71 mm above the filter plate, see `pose`).
// ---------------------------------------------------------------------------------------------

/**
 * How far the lower basket comes out, mm, as measured in two of the owner's photographs: 425,
 * +-25. NOT APPLIED: `pose.travelMm` of the lower basket is still the dossier's estimate of 500.
 *
 * (1) Loaded photograph of 2026-10-10, through a camera fitted to the rim of the pulled-out lower
 * basket (see the cutlery basket's `front_right` position): the front top edge of the upper
 * basket's handle spans its published 215 mm at y = +161 mm in the lower basket's frame (rim
 * centre at 0, +-7), 368 mm above its floor cross wires. Pushed in, that edge is at y = -252 in
 * the same frame (the two baskets as this file places them in the tub, +-20 each), so the basket
 * is out by 413 mm. (2) IMG_9081, from above (scale 6.09 px/mm at the rails and 5.44 at the tub
 * floor with the dossier's camera height; nadir at the image centre): rail R1 is 174 mm behind
 * the nadir and the three floor beads, which are 170 mm in front of the lower arm's axis (+-15),
 * 285 mm behind it, which puts R1 at y = -281 in the tub: out by 442 mm. Both assume the basket
 * was pulled out as far as it goes.
 *
 * What it means: pulled out, the basket keeps its rear 85 to 95 mm in the tub, and its rear row
 * R1 stands under the front edge of the upper basket, as the loaded photograph shows. The
 * session lets an item down from straight above (docs/design/platform.md section 6), so with
 * this travel nothing could be let into the rear rows while the upper basket is in; a hand
 * reaches in at a slant. The estimate of 500 mm, which leaves 8 mm under the upper basket, is
 * kept until the session can do that.
 */
export const BOSCH_LOWER_BASKET_TRAVEL_PHOTO_MM = 425;

/** x of the five front-back floor wires of the lower basket, mm (section 2.3). */
const LOWER_FLOOR_WIRES_X = [-199, -86, -19, 98, 179];

/** x of the tine bases of the two hinged rear rows: -208 + 18.25 k for k = 0..21, then 202. */
const REAR_ROW_TINES_X = [...arithmetic(-208, 18.25, 22), 202];

/** The first 15 tines of a rear row lean towards the left wall, the last 8 towards the right. */
const REAR_ROW_LEAN = [...repeatDirection('-x', 15), ...repeatDirection('+x', 8)];

const REAR_ROW_PROVENANCE = prov(
  'photo',
  `${B} 2.3 (rear rows R1, R2), 3.1 (racks.lower.tine_rows)`,
  'Counts (23 tines: 15 + 8) verified in O80 and O81 and on BSH part photo 12033326; lengths +-3 mm, lean +-1.5 deg, scaled from the two-view reconstruction at W = 515 mm. The fold direction and folded position are not in the dossier (both rows are up in every photograph): CHOICE: the row turns 90 deg about its rail and lies flat towards the front, read from the curved arrows moulded on the bearing plates at the right wall (O80, O81) and the manual\'s "Push the lever forwards and fold down the prongs".',
  {
    tinePositions: 'photo',
    leanToward: 'verified',
    hinge: 'estimated',
    railSpan: 'estimated',
    defaultState: 'verified',
    tip: 'verified',
  },
);

const SIDE_ROW_PROVENANCE_LEFT = prov(
  'photo',
  `${B} 2.3 (side rows), 3.1 (racks.lower.tine_rows)`,
  'Tine counts verified in O81; lengths +-4 mm, lean +-2 deg. The rail is taken to run on across the middle of the basket: the cutlery basket stands with its tunnels over it.',
  { railSpan: 'estimated', tip: 'verified' },
);

const SIDE_ROW_PROVENANCE_RIGHT = prov(
  'estimated',
  `${B} 2.3 (side rows), 3.1 (racks.lower.tine_rows)`,
  "Positions mirrored from the left-hand row, not measured. MR: 6 tines seen, a 7th assumed hidden in the cutlery basket's tunnel. FR: 6 counted (check 20).",
  { height: 'photo', lean: 'photo', tip: 'verified' },
);

const REAR_HINGE = {
  foldsToward: '-y',
  foldAngleDeg: 90,
  release:
    'lever with a moulded arrow on the bearing plate (part 10014124) at the right wall: push it forwards and fold the prongs down; they click back up',
} as const;

const LOWER_BASKET: BasketDef = {
  id: 'lower',
  level: 'lower',
  frame: 'lower_rack',
  kind: 'wire',
  part: '20001979 (now 20007406)',
  material: 'rack_wire_pa11',
  local: {
    // CHOICE: the dossier's block has origin_xy [0, 0] with the riser 21 mm proud of a rear wall
    // at +265 and the basket's rear wall set forward 6 mm for it. A 512 mm deep basket centred
    // on the axis would then stand 6 mm inside the riser. Section 2.3 gives the centre as
    // "y = 0 to -6": -6 is the value at which the recessed rear rim just clears a 21 mm riser.
    originInTubMm: [0, -6],
    frontLeftMm: [-262.5, -256],
    // The cross wires (4.0 mm over the coating) lie on top of the front-back wires.
    gridTopZMm: 2.0,
  },
  outline: {
    sizeMm: [525, 512],
    rimCentresMm: [519, 507],
    corners: {
      frontLeft: { kind: 'chamfer', dxMm: 41, dyMm: 59 },
      frontRight: { kind: 'chamfer', dxMm: 41, dyMm: 59 },
      // CHOICE: the rear corners are not described in the dossier; O81 shows them rounded.
      rearLeft: { kind: 'round', radiusMm: 25 },
      rearRight: { kind: 'round', radiusMm: 25 },
    },
    recesses: [{ side: 'rear', spanMm: [-30, 30], depthMm: 6, rampMm: 10 }],
  },
  provenance: prov(
    'photo',
    `${B} 2.3, 3.1 (racks.lower: size, rim_cc, rim_above_floor_wires, front_chamfer, rear_wall)`,
    "Scaled from O80 and O81 at W = 515 mm, +-8 mm; sister baskets are 525 to 528 mm wide. Rear wall: 4 horizontal wires and 5 uprights counted (verified), recess 5 to 8 mm deep. Not in the dossier: the two wall wires under the rim at 92 and 46 mm, read by proportion along the front wall in the owner's loaded photograph of 2026-10-10 and in IMG_9080 (+-10 mm; 105 and 73 before, from a camera fit) and taken to run round the sides and the back (see `walls`); the positions of the side-wall uprights and the 25 mm radius of the rear corners, read from O80 and O81.",
    { walls: 'estimated' },
  ),
  pose: {
    // CHOICE: the owner's 15 mm from the top of the lower arm is taken to the underside of the
    // LOWEST floor wires, the five front-back wires that the arm passes under: underside 65,
    // centre 67, top 69 mm. The two left-right cross wires lie on top of them, 4 mm higher
    // (IMG_9081): centres at 71 mm, which is this datum, and the top of the grid at 73 mm.
    heightPositions: [{ id: 'fixed', label: 'fixed', datumZMm: 71 }],
    canTilt: false,
    travelDirection: [0, -1, 0],
    travelMm: 500,
    provenance: prov(
      'estimated',
      `${U} 4.1 (reading a), 4.3, 7 (racks.lower.pose); ${OM} (heights); ${B} 2.3 (position in the tub), 3.1 (racks.lower.pose)`,
      "Height measured by the owner on an estimated datum: his tape puts the floor wire 15 mm (+-5) above the top face of the lower arm, and that face is still the dossier's estimate of 50 mm above the filter plate (+-8; about 75 mm if his 30 cm was taken to a blade of the upper arm rather than to its hub). WHICH WIRE: the floor has two layers 4 mm apart (IMG_9081: the two left-right cross wires pass over the five front-back wires). CHOICE: his 15 mm is taken to the underside of the lowest wires, the front-back ones, which is the gap a tape held between arm and basket shows: front-back wires underside / centre / top 65 / 67 / 69 mm (the figures of the owner update 4.3, which did not know of the two layers), cross-wire centres 71 mm (the dossier's own figure, +-12), top of the grid 73 mm. His 30 cm to the underside of the upper arm closes with the same surface (65 + 300 = 365 mm, the hub at level 1). The other reading, 15 mm to the cross wires, puts everything 4 mm lower and the lowest wires 11 mm above the arm; it was what this file had before review. Everything the dossier gives relative to the cross wires (rails, tine tips, rims, the cutlery basket) keeps the dossier's heights. Front-back position +-20 mm (CHOICE: -6, see `local`). The travel is not in the dossier: CHOICE: 500 mm, the basket pulled out onto the door until its rear wall stands at the tub opening. MEASURED SINCE AND NOT APPLIED: 425 mm, +-25, in the owner's loaded photograph and in IMG_9081 (`BOSCH_LOWER_BASKET_TRAVEL_PHOTO_MM`, which says why it is not applied).",
    ),
  },
  wires: {
    rim: { coatedMm: 5.5, steelMm: 5.0 },
    floor: { coatedMm: 4.0, steelMm: 3.4 },
    tine: { coatedMm: 4.0, steelMm: 3.4 },
    coatingMm: 0.4,
    provenance: prov(
      'photo',
      `${B} 2.3 (wire thickness over the coating), 3.1 (wire_d_coated, wire_d_steel, coating_mm)`,
      'Coated diameters from pixel widths, +-1 mm (calipers needed). Steel diameters and coating thickness are the generic values; they do not add up to the coated diameters exactly.',
      {
        'rim.steel': 'generic',
        'floor.steel': 'generic',
        'tine.steel': 'generic',
        coating: 'generic',
      },
    ),
  },
  // The two wall wires under the rim: read from the owner's loaded photograph of 2026-10-10 and
  // from IMG_9080, by proportion along the front wall between the rim (145 mm, the dossier's)
  // and the feet of the uprights, where they turn into the front-back floor wires.
  // Loaded photograph, front wall at image x = 1800: rim, wire, wire, feet at image y = 1597,
  // 1672, 1735 and 1797 (gaps 75, 63, 62 px; a second reading of the same column gave 1584,
  // 1665, 1736, 1800). Taking the foot of the wall 12 % further from the camera than the rim
  // (camera about 1 m above and in front), the wires are 92 and 46 mm above the floor.
  // IMG_9080, front-left of the front wall (2000 px wide copy): 1245, 1320, 1374, 1433, which
  // is 87 and 46 mm by plain proportion. VALUES: 92 and 46 mm, +-10. In both pictures the gap
  // under the lowest wire is the smallest of the three. Until 2026-10-10 evening this file had
  // 105 and 73 mm (+-5) from the same pixel rows put through a camera fitted to the rim, which
  // made that gap the largest; the proportion along the wall needs no camera and is preferred.
  // A tape on the front wall (floor wire to each horizontal wire and to the rim) would settle
  // it. The wires run on round the front chamfers and are taken to run round the sides and the
  // back at the same heights, as the wires of such a basket are closed hoops; the rear wall
  // then has the four horizontal wires counted in the dossier (the rim, two hoops and the
  // bottom wire).
  walls: [
    { side: 'front', horizontalWireZMm: [0, 46, 92, 145], uprightsMm: LOWER_FLOOR_WIRES_X },
    { side: 'rear', horizontalWireZMm: [0, 46, 92, 172], uprightsMm: LOWER_FLOOR_WIRES_X },
    {
      side: 'left',
      horizontalWireZMm: [0, 46, 92, 172],
      uprightsMm: [-186, -80, -43, 32, 68, 167],
    },
    {
      side: 'right',
      horizontalWireZMm: [0, 46, 92, 172],
      uprightsMm: [-186, -80, -43, 32, 68, 167],
    },
  ],
  floor: {
    alongY: {
      positionsMm: LOWER_FLOOR_WIRES_X,
      pitchMm: null,
      // CHOICE: the dossier does not say which floor wires lie on top. In O81 the left-right
      // cross wires pass over the front-back wires, so these are one wire diameter lower.
      zMm: -4.0,
      spanMm: [-253.5, 253.5],
      humps: [],
      crankMm: 20,
    },
    alongX: {
      positionsMm: [32, -43],
      pitchMm: null,
      zMm: 0,
      spanMm: [-259.5, 259.5],
      humps: [],
      crankMm: 0,
    },
    upperLayer: 'alongX',
    largestOpeningMm: [115, 100],
    provenance: prov(
      'photo',
      `${B} 2.3 (floor wires), 3.1 (floor_wires_front_back_x, floor_wires_left_right_y)`,
      "Counts verified in O81 (5 front-back wires, 2 cross wires between the rear and side rows; the bottom wires of the front and rear walls and the fixed tine rails also act as cross wires). Positions +-10 mm. The front-back wires are cranked sideways 10 to 20 mm in places; the cranks are not located. Which family is on top is this engineer's reading of O81.",
      { upperLayer: 'photo', 'alongY.z': 'photo', largestOpening: 'estimated' },
    ),
  },
  tineRows: [
    {
      id: 'r1',
      label: 'R1',
      runs: 'x',
      railAtMm: 167,
      railZMm: 13,
      railSpanMm: [-255, 255],
      tinePositionsMm: REAR_ROW_TINES_X,
      leanToward: REAR_ROW_LEAN,
      pitchMm: 18.25,
      heightMm: 66,
      leanDeg: 15,
      wireDiameterMm: 4.0,
      tip: 'ball',
      form: 'straight',
      hinge: REAR_HINGE,
      defaultState: 'up',
      provenance: REAR_ROW_PROVENANCE,
    },
    {
      id: 'r2',
      label: 'R2',
      runs: 'x',
      railAtMm: 68,
      railZMm: 13,
      railSpanMm: [-255, 255],
      tinePositionsMm: REAR_ROW_TINES_X,
      leanToward: REAR_ROW_LEAN,
      pitchMm: 18.25,
      heightMm: 66,
      leanDeg: 15,
      wireDiameterMm: 4.0,
      tip: 'ball',
      form: 'straight',
      hinge: REAR_HINGE,
      defaultState: 'up',
      provenance: REAR_ROW_PROVENANCE,
    },
    {
      id: 'ml',
      label: 'ML',
      runs: 'x',
      railAtMm: -80,
      railZMm: 13,
      railSpanMm: [-259.5, 0],
      tinePositionsMm: [-206, -179, -152, -127, -101, -75, -50],
      leanToward: '-x',
      pitchMm: 26.0,
      heightMm: 81,
      leanDeg: 17,
      wireDiameterMm: 4.0,
      tip: 'ball',
      form: 'straight',
      hinge: null,
      defaultState: 'up',
      provenance: SIDE_ROW_PROVENANCE_LEFT,
    },
    {
      id: 'mr',
      label: 'MR',
      runs: 'x',
      railAtMm: -80,
      railZMm: 13,
      railSpanMm: [0, 259.5],
      tinePositionsMm: [50, 75, 101, 127, 152, 179, 206],
      leanToward: '+x',
      pitchMm: 26.0,
      heightMm: 81,
      leanDeg: 17,
      wireDiameterMm: 4.0,
      tip: 'ball',
      form: 'straight',
      hinge: null,
      defaultState: 'up',
      provenance: SIDE_ROW_PROVENANCE_RIGHT,
    },
    {
      id: 'fl',
      label: 'FL',
      runs: 'x',
      railAtMm: -186,
      railZMm: 13,
      railSpanMm: [-259.5, 0],
      tinePositionsMm: [-201, -177, -150, -125, -98, -73],
      leanToward: '-x',
      pitchMm: 25.4,
      heightMm: 81,
      leanDeg: 17,
      wireDiameterMm: 4.0,
      tip: 'ball',
      form: 'straight',
      hinge: null,
      defaultState: 'up',
      provenance: SIDE_ROW_PROVENANCE_LEFT,
    },
    {
      id: 'fr',
      label: 'FR',
      runs: 'x',
      railAtMm: -186,
      railZMm: 13,
      railSpanMm: [0, 259.5],
      tinePositionsMm: [73, 98, 125, 150, 177, 201],
      leanToward: '+x',
      pitchMm: 25.4,
      heightMm: 81,
      leanDeg: 17,
      wireDiameterMm: 4.0,
      tip: 'ball',
      form: 'straight',
      hinge: null,
      defaultState: 'up',
      provenance: SIDE_ROW_PROVENANCE_RIGHT,
    },
  ],
  wheels: {
    count: 8,
    diameterMm: 35,
    stationsYMm: [221, 125, -63, -159],
    trackMm: 534,
    // CHOICE: the axle height is not in the dossier. In O80 each wheel sits just below the end
    // of a side rail, about level with the floor cross wires.
    axleZMm: 0,
    provenance: prov(
      'photo',
      `${B} 2.3 (wheels), 3.1 (racks.lower.wheels)`,
      '6 wheels seen (4 left, 2 right), 8 estimated. Diameter verified (parts 10014039, 10014040). Stations and track scaled from O81. Axle height read from O80 by this engineer, +-10 mm.',
      { count: 'estimated', diameter: 'verified', axleZ: 'estimated' },
    ),
  },
  handle: {
    part: '12033368',
    // CHOICE (geometry engineer, from O80 and O81): the part page's 215 x 52 x 47 mm is the
    // moulding as fitted to the upper basket, a bar with the tablet trough behind it. On the
    // lower basket the photographs show a plain bar: 215 mm long (verified), about 20 mm deep in
    // plan and about 24 mm tall. A 52 mm deep block there would stand in the cutlery basket,
    // whose front wall is 8 mm behind the basket's front line. Where the bar is (standing on
    // the front rim, its top 26 mm above it, its front face on the front line) is read from the
    // owner's loaded photograph: geometry assumptions `handle_front_offset`, `handle_above_rim`.
    sizeMm: [215, 20, 24],
    centreXMm: 0,
    provenance: prov(
      'photo',
      `${B} 2.3 (handle), 3.1 (racks.lower.handle); photographs IMG_9080 and IMG_9081`,
      "Length 215 mm from the part page [P15] (the dossier gives the lower basket the same part number as the upper basket's handle and tablet tray); centred on the front rim (O80). Depth 20 +-5 mm and height 24 +-5 mm scaled from O80 and O81 against that length, and again in the owner's loaded photograph of 2026-10-10 (17 mm from its lower front edge to its upper rear edge in plan, 21 mm in height): on the lower basket only the bar is seen, standing on the rim, with no trough behind it. The dossier's 52 x 47 mm section is not used here.",
      { part: 'sister', 'size.0': 'verified' },
    ),
  },
  tabletTray: null,
  cupShelves: [],
  holders: [],
  tray: null,
  massKg: 1.9,
  limits: {
    maxDiameterByPositionMm: { '1': 300, '2': 275, '3': 250 },
    positionOfBasket: 'upper',
    maxDiameterAsShown: {
      diameterMm: 310,
      positionId: '1',
      where:
        'astride the left middle row (ML) and the second rear row (R2), resting on the two floor cross wires between them',
    },
    seating: [
      { where: 'on both rear rails (R1 and R2)', maxDiameterMm: 265 },
      { where: 'on both side rails (middle and front row)', maxDiameterMm: 240 },
    ],
    provenance: prov(
      'verified',
      `${B} 2.2 (item 5; plate table), 2.3 (largest plate), 3.1 (max_plate_by_upper_level, max_plate_as_shown, plate_seating), 5.1`,
      'The three limits and the 31 cm "as shown" are printed in the manual [B1 p. 19-21]. Where the 31 cm plates stand, and the seating limits, are the dossier\'s reading of its own geometry. The owner measured 30 cm from the floor wires to the underside of the upper arm with the top basket in its highest position, the first of the three limits (owner update 4.1, reading b).',
      { 'maxDiameterAsShown.where': 'estimated', seating: 'estimated' },
    ),
  },
};

// ---------------------------------------------------------------------------------------------
// Upper basket (part 20001986, now 20001992). Dossier frame: origin on the upper spray-arm
// axis; z = 0 at the tops of the floor wires.
// ---------------------------------------------------------------------------------------------

/** y of the twelve left-right floor wires of the upper basket, mm (section 2.5). */
const UPPER_FLOOR_WIRES_Y = [215, 178, 142, 105, 69, 36, -3, -40, -76, -112, -149, -187];

/**
 * y of a thirteenth left-right wire at floor level, the bottom wire of the front wall, mm. It is
 * not in the dossier. IMG_9083 (full resolution, 8.2 px/mm on the floor): the listed cross wires
 * are at image y = 2090 (the dossier's -3, under the arm hub at (2793, 2063)), 2380, 2660, 2960,
 * 3270 and 3590 (-187), and one more at 3930, about 41 mm in front of the last, ending where the
 * front wall is set back for the tablet tray. IMG_9131 (the basket end-on at floor height) shows
 * it sharply: it carries the whole relief of the floor, the uprights of the front wall are welded
 * to it, it runs on low into the corner frames, and it turns up behind the two ends of the
 * handle (x = -101 and about +110), which is where the recess of the outline cuts it here. The
 * perspective series of the first five wires in that picture puts it 37.2 mm (+-0.5) in front of
 * the wire at -187: -224, now +-1 relative to that wire (it was +-10).
 */
const UPPER_FRONT_FLOOR_WIRE_Y = -224;

/**
 * y of a fourteenth left-right wire, behind the twelve of the dossier, mm. CHOICE, NOT SEEN: the
 * rear of the basket is outside IMG_9083. With the rear rim at +270 the last listed wire
 * (+215) would leave a strip 53 mm deep without a floor; the 36.5 mm pitch is taken to go on
 * to the rim. Tagged `estimated`.
 */
const UPPER_REAR_FLOOR_WIRE_Y = 215 + 36.5;

/**
 * The relief of the upper basket's floor: `[x, rise]` in mm, x in the dossier's frame (origin on
 * the arm axis), rise of the CENTRE LINE of a left-right floor wire above its level in the left
 * trough (x = -137 to -30), which is the datum: there the tops of the left-right wires are at
 * z = -3.5 and the tops of the front-back wires lying on them at z = 0. The points are the
 * corners of the straight runs; the built wire rounds each one (`RELIEF_BEND_RADIUS_RATIO`), so
 * a built peak is lower than its corner: see the table below.
 *
 * SOURCE: IMG_9131 (2026-10-11), the basket out of the machine on a tiled floor, photographed
 * end-on from the front at floor height (iPhone 15 main camera, 4200 px focal length, no ruler).
 * The bottom wire of the front wall (`UPPER_FRONT_FLOOR_WIRE_Y`) is seen in true profile 385 mm
 * from the lens at 10.9 px/mm, and the next four floor wires behind it repeat its slopes and
 * steep faces within 0.5 mm. Two independent readings were made (one from the picture's own
 * perspective, 56 residuals on 18 unknowns; one by projecting this model into the picture) and
 * reconciled in docs/reference/owner-measurements.md, which has the whole table. From left to
 * right:
 *
 *   x       rise   what                                              built top above the datum top
 *   -199.6  -1.0   the outward slope meets the low run by the wall    (low to the wall)
 *   -152.3  30.1   left peak: slope 33.3 deg outside, 63.5 deg inside 27.7 at x = -154 (seen 28.0 at -153)
 *   -137.3   0     foot of the left steep face; trough to -30
 *   -30      0     base of the centre ridge
 *   -10     33.4   centre ridge: HIDDEN by the handle, see below      32.6 at x = -7.5
 *   138.4   -2.9   foot of the right steep face: a V, no flat trough
 *   143.8   37.6   right peak: 82.4 deg inside, slope 35.4 deg outside 33.5 at x = +148 (seen 33.0 at +148)
 *   198.9   -1.5   the outward slope meets the low run by the wall    (low to the wall)
 *
 * WHAT IT IS: two triangular ridges, each with its steep face towards the middle of the basket
 * and a long straight slope falling OUTWARDS to floor level about 200 mm from the axis, and low
 * floor from there to each side wall. Between them the floor is level on the left and, from a
 * ridge over the arm's feed tube, falls 13.7 degrees to the right all the way to the foot of the
 * right ridge. The ridges are not mirror images: the right one stands 36.4 mm above its own foot
 * and the left one 27.7, the right inner face is nearly vertical, and the right slope runs 55 mm
 * against 47.
 *
 * UNCERTAINTY. Heights +-1 mm between points of one side; left against right +-1.5 mm more,
 * because the roll of the camera is not known better than 0.3 degrees (the two rails of the
 * front wall, taken as level here, and the low runs of the floor wires by the two walls differ by
 * that much: with the floor wires taken as level the right-hand points would all stand 1.5 to
 * 3 mm higher, the foot at about 0 and the peak at 36). x +-4 mm at |x| = 150 for the scale and
 * +-4 mm for the origin, the hub of the arm seen blurred under the floor. Slope angles +-1 deg.
 * The right peak corner is put 0.5 mm below the crossing of the two measured centre lines, so
 * that with the builder's one bend radius (5.25 mm; the picture shows about 4.5 on the left and
 * 6.6 on the right) the built top is within 0.5 mm of the top seen.
 *
 * THE CENTRE RIDGE IS NOT SEEN: the handle and tablet tray hide x = -23 to +76. What is seen:
 * the ramp, straight and sharp from +76 to its foot at +138.4 (13.7 deg, +-1), and on the front
 * wire a face rising at 58 degrees from x = -29. The two lines cross at x = -10, 33.4 mm up,
 * which is the corner given here; IMG_9083 from above has the ridge at -9 to -11. +-4 mm in
 * height, +-5 in x; it assumes the ramp stays straight where it is hidden, as it looks from above.
 *
 * WHAT IT REPLACED, AND WHAT MISLED THE EARLIER READINGS. Until 2026-10-11 the relief was
 * [-155, 30], [-140, 0], [-27, 0], [-9, 30], [118, 0], [132, 32], [178, 0]: a raised strip of
 * 30 mm from x = -155 to the left wall, and the right ridge 16 mm nearer the middle. It was
 * read from IMG_9083 (from above) by the parallax of the cross wires and from the front wall
 * wire in the loaded photograph of 2026-10-10, +-10 mm in height and in x. Three things were
 * wrong with it:
 * - The left side was taken for a plateau because under the knife shelf, from above, only the
 *   rise at -155 was seen; the fall behind it to floor level at -200 was hidden by the shelf.
 * - The right ridge was put at +132 (and the other reading had it at +172). Neither: its inner
 *   face stands at +138 to +144, its top is at +148 and its slope ends at +199. IMG_9083 was
 *   converted at 8.2 px/mm, the scale near the front of that oblique picture (its nadir is at
 *   image y = 3600), but the profile was read on cross wires at image y = 1000 to 1300, about
 *   300 mm further back, where the same picture has about 7.4 px/mm: its "+133" is +147 there
 *   (the foot at image x = 3780 lies 90 px outside the front-back wire at 3690, which is the
 *   wire IMG_9131 puts at +128). The "+172" of the loaded photograph is the middle of the outer
 *   slope, which runs from +148 to +199: at 2.86 px/mm the nearly vertical inner face was not
 *   told from the slope.
 * - The heights (30 and 32, between readings of 23 and 41) are now 27.7 and 33.5 above the
 *   datum, 27.7 and 36.4 above the ridge's own foot.
 * The dossier's "W-shaped in section" with one 15 mm hump is older still.
 */
const UPPER_FLOOR_RELIEF_MM: readonly (readonly [number, number])[] = [
  [-199.6, -1.0],
  [-152.3, 30.1],
  [-137.3, 0],
  [-30, 0],
  [-10, 33.4],
  [138.4, -2.9],
  [143.8, 37.6],
  [198.9, -1.5],
];

/** Rise of the upper basket's floor at x (dossier frame), mm: `UPPER_FLOOR_RELIEF_MM` interpolated. */
function upperFloorRiseMm(xMm: number): number {
  const points = UPPER_FLOOR_RELIEF_MM;
  const first = points[0] as readonly [number, number];
  if (xMm <= first[0]) return first[1];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as readonly [number, number];
    const b = points[i] as readonly [number, number];
    if (xMm <= b[0]) return a[1] + ((b[1] - a[1]) * (xMm - a[0])) / (b[0] - a[0]);
  }
  return (points[points.length - 1] as readonly [number, number])[1];
}

/**
 * x of its twelve front-back floor wires, mm. They lie ON the left-right wires everywhere they
 * were seen (IMG_9083 from above; IMG_9131: the ball of the wire at -195 is 3.9 mm above the
 * centre of the slope wire under it, that at +196 4.8 mm, and the wires at -161 and +163 run
 * 2 to 4 mm above the centres of the slope wires they cross), so each is drawn at the height of
 * the relief at its x.
 *
 * - Eight are the dossier's (-159, -108, -41, 47, 89, 123, 158, 191; +-4 mm). IMG_9131 moves
 *   the three on the right outwards: +128 (+-5; the upright of the front wall right of the
 *   handle, whose foot turns back along the floor), +163 (+-3; the wire itself reads +164.6 at
 *   the second floor wire and the weld marks on four wires +161; at the front wall it is the
 *   bent-back foot of a short hooked upright standing at +169) and +196 (+-3; weld marks of
 *   six wires, and the ball of its free front end at +197). They were 123, 158 and 191. On the
 *   left -159 becomes -161 (the wire reads -161.8 at the second floor wire, the weld marks
 *   -157.5, its hooked upright -168) and -41 is confirmed (an upright under the handle at
 *   -40.6). 47 and 89 are hidden by the handle.
 * - -108 is NOT confirmed: the front wall has no upright there but one at -130 (+-5), whose
 *   foot turns back along the floor of the left trough; from above, in the rear half, there is
 *   one wire at about -110, which may be this one cranked, and may be the rail of rows A and A'
 *   (listed here as well, at -112). Kept until a picture from above settles it.
 * - One on the centre line, x = 0 (+-5), read from IMG_9083: image x = 2790 from the tablet
 *   tray back to the hub and 2780 behind it, where it runs over the top of the ridge and the
 *   arm's feed tube hangs under it in four clips.
 * - Two by the left wall, -195 and -212 (+-5). IMG_9083 has them at image x = 1190 and 1055 in
 *   front of the knife shelf: -195 and -212 on the floor scale. This file had them at -188 and
 *   -205, "brought in" for a raised strip that does not exist; IMG_9131 has the first at
 *   -195.2. It ends at the front wall wire in a ball, as its twin at +196 does: these two are
 *   the "free tips" the picture shows by the walls, lying on the low ends of the slopes. The
 *   second is the bent-back foot of the inner upright of the front left corner.
 * - One by the right wall, +214 (+-6), added: the bent-back foot of the inner upright of the
 *   front right corner in IMG_9131, and the outermost front-back wire of IMG_9083 on that side.
 */
const UPPER_FLOOR_WIRES_X = [-212, -195, -161, -108, -41, 0, 47, 89, 128, 163, 196, 214];

/**
 * x of the uprights of the rear wall of the upper basket, mm: the dossier's eight, at the
 * positions of the front-back wires as they are now. The rear wall is outside every photograph.
 */
const UPPER_REAR_WALL_UPRIGHTS_X = [-161, -108, -41, 47, 89, 128, 163, 196];

/**
 * x of the uprights of its front wall, mm, from IMG_9131: -161 and +163 (in the picture short
 * hooked uprights that stand 6 to 7 mm further out, at -168 and +169, and stop at the lower
 * rail; drawn here as the floor wire turned up to the rim), -130 and +128 (from the upper rail
 * to the floor; -130 has no floor wire listed under it, see `UPPER_FLOOR_WIRES_X`, and is drawn
 * from the lower rail up), -41 (under the handle). 47 and 89 are the dossier's, hidden behind
 * the handle. The wires at -195 and +196 end free in front and do not turn up; the dossier's
 * upright at -108 is not there.
 */
const UPPER_FRONT_WALL_UPRIGHTS_X = [-161, -130, -41, 47, 89, 128, 163];

const UPPER_FIXED_ROW_PROVENANCE = prov(
  'photo',
  `${B} 2.5 (rows A, B, A', B'), 3.1 (racks.upper.tine_rows)`,
  "Counts verified in O83; positions +-4 mm; heights estimated for the tall rows (95 +-20 mm). Hairpin rows 57 mm: the tip of the nearest tine of row A' is 57.5 mm (+-3) above the tops of the floor wires in IMG_9131, at x = -117.5 (+-5); the dossier's estimate was about 45. Row B' is hidden by the tablet tray in that picture and is given the same height by likeness. No lean is recorded for these rows.",
  { height: 'estimated', lean: 'estimated' },
);

const UPPER_HINGED_ROW_PROVENANCE = prov(
  'photo',
  `${B} 2.5 (row C), 3.1 (racks.upper.tine_rows, foldable_rows), 0.4 (check 3)`,
  'Counts verified in O83 and on BSH photos of parts 12033291 (rear) and 12033302 (front); lean +-2 deg. The rail lies on the floor wires on the ramp that falls to the right, 16.3 mm above the trough level at its x (`floor.relief`; 13.7 mm with the relief of before 2026-10-11). HEIGHT 76 mm (+-4), from IMG_9131: the rounded tips of the second and third tines of the front half and of the first tine of the rear half are all 93.5 mm above the tops of the floor wires (taking the tines at their listed y), 75.5 mm above the rail; the nearest tine ends behind the upper front rail and nothing shows above that rail, where a tip at the earlier height would stand 7 mm clear of it. The dossier had 88 +-6 mm, which with the rail where it now is put the tips at 104 mm. The same picture has the nearest tine leaning 10 degrees towards +x from a foot near x = +63 (+-5), which agrees with x = 60 and 11 degrees. The two halves fold separately. The fold direction is not in the dossier: CHOICE: towards the basket centre (-x), read from the latch in O83: the crank arms of both halves lie flat pointing +x under a tab of the latch, and can only rise, which lays the tines over towards -x.',
  { hinge: 'estimated', defaultState: 'verified' },
);

const UPPER_HINGE = {
  foldsToward: '-x',
  foldAngleDeg: 101,
  release: 'grey latch at mid-depth between the two halves; each half folds on its own',
} as const;

const UPPER_BASKET: BasketDef = {
  id: 'upper',
  level: 'upper',
  frame: 'upper_rack',
  kind: 'wire',
  part: '20001986 (now 20001992)',
  material: 'rack_wire_pa11',
  local: {
    originInTubMm: [0, -30],
    frontLeftMm: [-244, -228],
    gridTopZMm: 0,
  },
  outline: {
    // Depth 498 mm: front edge at y = -228, rear edge at +270 (see the provenance note).
    sizeMm: [500, 498],
    // The outer size less one rim wire, 5.1 mm (see `wires`); 496.5 x 494.5 with the 3.5 mm rim.
    rimCentresMm: [494.9, 492.9],
    corners: {
      // CHOICE: the corners and the set-back middle of the front wall are not in the dossier;
      // read from O83 by this engineer, +-15 mm. The rear corners are outside the photograph.
      frontLeft: { kind: 'chamfer', dxMm: 30, dyMm: 30 },
      frontRight: { kind: 'chamfer', dxMm: 30, dyMm: 30 },
      rearLeft: { kind: 'round', radiusMm: 20 },
      rearRight: { kind: 'round', radiusMm: 20 },
    },
    recesses: [
      { side: 'front', spanMm: [-69, 81], depthMm: 40, rampMm: 30 },
      // CHOICE, NOT SEEN IN ANY PHOTOGRAPH: with the rear rim at +270 the basket would stand
      // 9 mm inside the docking block of the feed duct (34 mm proud of the rear wall, 60 mm
      // wide). The rear wall is set forward 12 mm over the block, as the lower basket's is for
      // the riser. The rear of this basket is outside every photograph.
      { side: 'rear', spanMm: [-45, 45], depthMm: 12, rampMm: 10 },
    ],
  },
  provenance: prov(
    'estimated',
    `${B} 2.5, 3.1 (racks.upper: size, front_wall_height, rim_x, rim_y); photograph IMG_9083`,
    'Outer width 500 +-20 mm scaled from O83; IMG_9131 neither confirms nor contradicts it (the outer uprights of the front wall are 443 mm apart, which is the 500 mm less the two 30 mm chamfers within 3 mm; the ends of the lower front rail are 471 mm apart; the side walls read 473 mm if they are in the plane of the front wall and 510 mm if 30 mm behind it). Depth: the dossier took 476 +-25 mm from sister basket 00770441, the rear rim being outside the photograph. Raised to 498 mm (rear rim at y = +270 in the arm-axis frame, +-15) because the fittings at their published lengths need it: IMG_9083 puts the front lip of the 389 mm knife shelf at about y = -119 and the front end of the 200 + 252 mm of cup shelves at about -200, so both end near +268. An inference, not a reading; the outer depth by tape would settle it. The 12 mm recess of the rear wall over the docking block is assumed (see `recesses`). Wall height 120 mm at the sides and back estimated (IMG_9131: the top wires of the side walls at the front corners 122 and 126 mm, +-5). FRONT WALL, from IMG_9131: two rails, centres 38.5 mm (+-1.5) and 91 mm (+-2.5) above the tops of the floor wires in the left trough (42 and 94.5 mm above the tops of the left-right wires, which is where the picture was measured from). The upper one is the rim: it runs the whole width, set back in the middle behind the tablet tray (level there if set back 40 mm, as IMG_9083 shows it; it would dip 5 mm if it were not), and rises to the side walls at the corners. The lower one ends free at the corners and carries the handle; the "front wall 55 +-10 mm from O80" of the dossier was this rail, with the red edge of the handle level with it. Not in the dossier and read from O83 by this engineer: the chamfered front corners, the middle of the front wall set back about 40 mm behind the handle and tray, the wall wires and the uprights.',
    { 'outline.size': 'photo', 'outline.recesses': 'estimated', walls: 'estimated' },
  ),
  pose: {
    heightPositions: [
      { id: '1', label: '1', datumZMm: 420 },
      { id: '2', label: '2', datumZMm: 395 },
      { id: '3', label: '3', datumZMm: 370 },
    ],
    canTilt: true,
    travelDirection: [0, -1, 0],
    travelMm: 440,
    provenance: prov(
      'measured',
      `${U} 4.1 (readings c and d), 4.3, 7 (racks.upper.pose); ${OM} (heights); ${B} 2.5 (Rackmatic), 3.1 (rackmatic)`,
      "Level 1 measured by the owner: the roof is 640 mm above the filter plate and the basket floor 220 mm below the roof, both by his tape, so the floor wire tops are at 420 mm (+-7); the dossier had 410 +-12. WHICH LEVEL OF THE FLOOR: the floor has a relief of up to 34 mm (`floor.relief`). CHOICE: the 420 mm is the top of the wires in the left trough, where glasses and bowls stand and where a tape would be stood; over the ridges the clear height to the roof is about 190 mm. If he measured from a ridge, the whole basket and its arm are about 33 mm lower. The basket was in its highest position (level 1): his 22 cm and 30 cm are the manual's two limits for that position. Levels 2 and 3 are 25 and 50 mm lower (395 and 370 mm): three levels and a 5 cm range are printed, the 25 mm step is still inferred. Front-back position +-20 mm, estimated. The travel is not in the dossier: CHOICE: 440 mm on the 460 mm guide rails.",
      { canTilt: 'verified', originXY: 'estimated', travel: 'estimated' },
    ),
  },
  wires: {
    rim: { coatedMm: 5.1, steelMm: 4.8 },
    floor: { coatedMm: 3.5, steelMm: 3.2 },
    tine: { coatedMm: 3.5, steelMm: 3.0 },
    coatingMm: 0.4,
    provenance: prov(
      'photo',
      `${B} 2.5 (wire thickness), 3.1 (racks.upper.wire_d_coated, wire_d_steel); photograph IMG_9131`,
      'The dossier had 3.5 +-0.5 mm over the coating from O83 at 8.1 px/mm, one figure for every wire. IMG_9131 at 10.9 px/mm: the two rails of the front wall are 5.1 mm thick (+-0.3; 56 px between the edge gradients, 5.0 to 5.5 in the second reading), so the rim is 5.1 (it was 3.5); the floor wire in front is 3.6 mm (+-0.15), which confirms 3.5 and is not changed; an upright of the front wall is about 4.1 mm. The lower front rail and the uprights are drawn with the floor wire (3.5 mm): the rail is 1.6 mm thicker than drawn. That the rim keeps 5.1 mm round the sides and the back is assumed. Tines not measured. Steel diameters generic.',
      {
        'rim.steel': 'generic',
        'floor.steel': 'generic',
        'tine.steel': 'generic',
        coating: 'generic',
      },
    ),
  },
  walls: [
    // Front wall, IMG_9131: the lower rail and the upper rail, which is the rim on this side
    // (see the provenance of the outline). It was one wire at 55.
    { side: 'front', horizontalWireZMm: [38.5, 91], uprightsMm: UPPER_FRONT_WALL_UPRIGHTS_X },
    { side: 'rear', horizontalWireZMm: [60, 120], uprightsMm: UPPER_REAR_WALL_UPRIGHTS_X },
    { side: 'left', horizontalWireZMm: [60, 120], uprightsMm: UPPER_FLOOR_WIRES_Y },
    { side: 'right', horizontalWireZMm: [60, 120], uprightsMm: UPPER_FLOOR_WIRES_Y },
  ],
  floor: {
    alongY: {
      positionsMm: UPPER_FLOOR_WIRES_X,
      pitchMm: null,
      zMm: -1.75,
      spanMm: [-225.45, 267.45],
      humps: [],
      crankMm: 0,
    },
    alongX: {
      positionsMm: [...UPPER_FLOOR_WIRES_Y, UPPER_FRONT_FLOOR_WIRE_Y, UPPER_REAR_FLOOR_WIRE_Y],
      pitchMm: 36.5,
      // In O83 and in IMG_9131 the front-back wires pass over the left-right wires, which
      // therefore lie one wire diameter lower. The left-right wires carry the relief, bend for
      // bend; each front-back wire lies on them at the height of the relief at its x.
      zMm: -5.25,
      spanMm: [-241.45, 253.45],
      humps: [],
      crankMm: 0,
    },
    upperLayer: 'alongY',
    relief: { axis: 'x', pointsMm: UPPER_FLOOR_RELIEF_MM },
    largestOpeningMm: [67, 36.5],
    provenance: prov(
      'photo',
      `${B} 2.5 (floor wires, floor profile), 3.1 (floor_wires_left_right_y, floor_wires_front_back_x, floor_hump); photographs IMG_9083 and IMG_9131; ${OM} (the upper basket end-on)`,
      "Counts verified in O83 (12 left-right wires at 36.5 mm pitch, 8 front-back wires); positions +-4 mm. Four more front-back wires are read from the owner's photographs (see `UPPER_FLOOR_WIRES_X`): one on the centre line over the feed tube (IMG_9083, +-5 mm), two by the left wall and one by the right wall (IMG_9083 and IMG_9131, +-5 mm), 12 in all; IMG_9131 also moves the three on the right outwards by 5 mm. A thirteenth left-right wire is the bottom wire of the front wall (`UPPER_FRONT_FLOOR_WIRE_Y`; +-1 mm from the wire behind it, IMG_9131). A fourteenth is assumed behind the twelve, at the same pitch, because the basket is deeper than the dossier took it to be and its rear is outside every photograph (`UPPER_REAR_FLOOR_WIRE_Y`; estimated, not seen). THE RELIEF is measured on IMG_9131, the basket end-on at floor height (see `UPPER_FLOOR_RELIEF_MM` for the table, the uncertainties and what it replaced): two triangular ridges, 27.7 mm high at x = -154 and 33.5 mm at x = +148 (the right one 36.4 mm above its own foot), each steep towards the middle and falling outwards on a 33 to 35 degree slope to floor level 199 mm from the axis, with low floor from there to the side walls; a level trough from -137 to -30; a ridge of about 33 mm at x = -10 over the feed tube, hidden in that picture and placed where the two visible lines cross (+-4 mm, +-5 in x); and from it a 13.7 degree ramp down to the foot of the right ridge at +138, 2.9 mm below the left trough. Heights +-1 mm on one side, left against right +-1.5 mm more; x +-4 mm for the scale and +-4 for the origin. Read on the first five wires (to 147 mm behind the front wall): that it is the same further back is IMG_9083's evidence, not this picture's. Largest opening: the 67 mm gap between the wires at x = -108 and -41, by the cross-wire pitch (centre to centre). The front-back family is on top: O83, and IMG_9131 wherever a crossing is seen.",
      {
        upperLayer: 'photo',
        'alongX.z': 'photo',
        'alongX.positions': 'estimated',
        // Measured on IMG_9131 by its own perspective; no ruler in the picture, so `photo`.
        relief: 'photo',
        largestOpening: 'estimated',
      },
    ),
  },
  tineRows: [
    {
      id: 'a',
      label: 'A',
      runs: 'y',
      railAtMm: -112,
      railZMm: 0,
      railSpanMm: [31, 210],
      tinePositionsMm: [210, 175, 139, 103, 68, 31],
      leanToward: '+x',
      pitchMm: 36,
      heightMm: 95,
      leanDeg: 0,
      wireDiameterMm: 3.5,
      tip: 'round',
      form: 'straight',
      hinge: null,
      defaultState: 'up',
      provenance: UPPER_FIXED_ROW_PROVENANCE,
    },
    {
      id: 'b',
      label: 'B',
      runs: 'y',
      railAtMm: -52,
      railZMm: 0,
      railSpanMm: [34, 207],
      tinePositionsMm: [207, 174, 137, 101, 70, 34],
      leanToward: '+x',
      pitchMm: 36,
      heightMm: 95,
      leanDeg: 0,
      wireDiameterMm: 3.5,
      tip: 'round',
      form: 'straight',
      hinge: null,
      defaultState: 'up',
      provenance: UPPER_FIXED_ROW_PROVENANCE,
    },
    {
      id: 'a2',
      label: "A'",
      runs: 'y',
      railAtMm: -112,
      railZMm: 0,
      railSpanMm: [-161, -12],
      tinePositionsMm: [-12, -31, -49, -68, -86, -104, -122, -141, -161],
      leanToward: '+x',
      pitchMm: 18.6,
      heightMm: 57,
      leanDeg: 0,
      wireDiameterMm: 3.5,
      tip: 'ball',
      form: 'hairpin',
      hinge: null,
      defaultState: 'up',
      provenance: UPPER_FIXED_ROW_PROVENANCE,
    },
    {
      id: 'b2',
      label: "B'",
      runs: 'y',
      railAtMm: -51,
      railZMm: 0,
      railSpanMm: [-163, -14],
      tinePositionsMm: [-14, -32, -50, -68, -86, -104, -121, -143, -163],
      leanToward: '+x',
      pitchMm: 18.6,
      heightMm: 57,
      leanDeg: 0,
      wireDiameterMm: 3.5,
      tip: 'ball',
      form: 'hairpin',
      hinge: null,
      defaultState: 'up',
      provenance: UPPER_FIXED_ROW_PROVENANCE,
    },
    {
      id: 'c_rear',
      label: 'C (rear half, part 12033291)',
      runs: 'y',
      railAtMm: 60,
      // The rail lies on the floor wires, which stand 16.3 mm above the trough level at x = +60.
      railZMm: 1.75 + upperFloorRiseMm(60),
      railSpanMm: [19, 205],
      tinePositionsMm: [205, 166, 130, 93, 56, 19],
      leanToward: '+x',
      pitchMm: 37,
      heightMm: 76,
      leanDeg: 11,
      wireDiameterMm: 3.5,
      tip: 'round',
      form: 'straight',
      hinge: UPPER_HINGE,
      defaultState: 'up',
      provenance: UPPER_HINGED_ROW_PROVENANCE,
    },
    {
      id: 'c_front',
      label: 'C (front half, part 12033302)',
      runs: 'y',
      railAtMm: 60,
      railZMm: 1.75 + upperFloorRiseMm(60),
      railSpanMm: [-165, -17],
      tinePositionsMm: [-17, -52, -91, -127, -165],
      leanToward: '+x',
      pitchMm: 37,
      heightMm: 76,
      leanDeg: 11,
      wireDiameterMm: 3.5,
      tip: 'round',
      form: 'straight',
      hinge: UPPER_HINGE,
      defaultState: 'up',
      provenance: UPPER_HINGED_ROW_PROVENANCE,
    },
  ],
  wheels: null,
  // The handle of the upper basket is the front bar of the tablet tray: one part, see `tabletTray`.
  handle: null,
  tabletTray: {
    part: '12033368',
    sizeMm: [215, 52, 47],
    // CHOICE: "at: front_wall_centre". In O83 the trough fills the set-back middle of the front
    // wall with its front face on the basket's front line: centre 26 mm behind the front edge.
    // x from IMG_9131: the bar runs from -105.5 to +110.2 (it was centred at +6).
    centreMm: [2, -202],
    rimZMm: 55,
    // IMG_9131: the red top edge of the bar in front, which is the handle.
    frontRimZMm: 42.5,
    slotted: true,
    provenance: prov(
      'verified',
      `${B} 2.12 (tray height), 2.5 (handle and tablet collecting tray), 3.1 (racks.upper.tablet_tray); photograph IMG_9131`,
      'Handle and tray are one part, 215 x 52 x 47 mm [P15]: a bar with a red stripe and behind it an open-topped slotted trough. IMG_9131, both readings: the bar is 215.7 mm wide between its outer edges at the distance of the front wall wire (which is the check of that picture\'s scale, so not an independent width), centred at x = +2 (+-2, and +-4 for the origin; it was +6, "centred on the basket"); its front face is 34 mm high, its lower edge 7 mm and its red top edge 42.5 mm above the tops of the floor wires (+-2), level with the lower rail of the front wall, which carries it. The trough behind stands higher than the bar: its rear wall is seen over the bar at about 58 mm (+-5, taking the tray as 52 mm deep), so the rim stays at 55 and the bottom at 8, and only the front wall is lowered (`frontRimZMm`; the whole box stood to 55 before). Its front face is within 8 mm of the plane of the front wall wire.',
      { rimZ: 'photo', frontRimZ: 'photo', centre: 'photo' },
    ),
  },
  cupShelves: [
    {
      id: 'cup_front',
      part: '12005549',
      side: 'right',
      sizeMm: [200, 100, 18],
      // The two shelves lie in line along the right wall, the short "vorne" piece at the front.
      // IMG_9083: its front end is at image y = 3700, 13 mm in front of the cross wire at -187.
      yMm: [-200, 0],
      // IMG_9131 shows the shelf folded up: its pins at x = +222, 75.5 mm above the floor-wire
      // tops, on the ribbed underside, which faces the inside of the basket; its 18 mm of
      // thickness between the pins and the wall (x = +222 to +239); its front end from 48.5 to
      // 138.5 mm, 27 mm of it below the pins. Lowered about those pins it lies ABOVE them: its
      // underside at 75.5 mm and its top, 18 mm thick, at 93.5, with its edge 27 mm outside
      // the pins at the wall (x = +249). INFERRED from the folded shelf, +12 -6 mm; the lowered
      // shelf has not been photographed. It was 75 (generic), which left 57 mm under it.
      shelfZMm: 93.5,
      pivotInsetMm: 27,
      stemwareNotches: 5,
      defaultState: 'up',
      provenance: prov(
        'verified',
        `${B} 2.5 (cup shelves), 3.1 (racks.upper.cup_shelves)`,
        'Sizes verified [P16]; folded up in O83 and in IMG_9131. HEIGHT, from IMG_9131, where the shelf is folded up: its pins are 75.5 mm above the floor-wire tops (+-4; 79 mm above the tops of the left-right wires, their depth in the picture taken as 55 mm behind the front wall wire) at x = +222, on its ribbed underside, which faces the inside of the basket; the 18 mm of its thickness is between the pins and the wall (x = +222 to +239 at its front end); its front end stands from 48.5 to 138.5 mm (second reading 51.5 to 140.5), so 27 mm of its width is below the pins. A shelf that stands like that and turns a quarter turn about those pins lies above them when it is lowered, with its wall-side edge at x = +249, which is the wall: underside 75.5 mm, top 93.5 mm. That is the height now in use (it was a generic 75 mm for the top, 57 mm clear below). It is an inference from the folded shelf, not a reading of the lowered one, +12 -6 mm: a tape reading of a lowered shelf would settle it. (The upper bound was +8 until the geometry review of 11 October: if the hinge lug seen at pixel (5170, 1245) sits 40 mm behind the front end of the shelf, as its place on the rib grid suggests, it is at x = +232, z = 79.5, about 10 mm inboard of the rib face, and the lowered underside would be near 85 mm and the top near 100. Nothing should be made to depend on seats under or on the lowered shelves until the tape reading.) Folded up, the geometry stands it where the picture has it, between the pins and the wall from 48.5 to 148.5 mm (10 to 14 mm too tall and, at its top, about 9 mm too far out: the folded shelf leans, its top inwards of where it is drawn, by about 6 degrees, which is not drawn, so that the inner face is really near x = +215 at 135 mm where the drawing has +224; it stood flat against the wall from 75 to 175 mm before). Position along the wall from IMG_9083, +-10 mm (front end 13 mm in front of the cross wire at y = -187). About 5 stemware notches each (not counted in IMG_9131).',
        { heightAboveGrid: 'estimated', pivotInset: 'photo', y: 'photo', stemwareNotches: 'photo' },
      ),
    },
    {
      id: 'cup_rear',
      part: '12005548',
      side: 'right',
      sizeMm: [252, 97, 22],
      yMm: [2, 254],
      // As the front shelf, whose pins are on the same line (IMG_9131): underside at 75.5 mm,
      // top 22 mm above it. It was 75 (generic).
      shelfZMm: 97.5,
      pivotInsetMm: 27,
      stemwareNotches: 5,
      defaultState: 'up',
      provenance: prov(
        'verified',
        `${B} 2.5 (cup shelves), 3.1 (racks.upper.cup_shelves)`,
        'Sizes verified [P16]; folded up in O83 and in IMG_9131. Height as the front shelf, whose pins are seen 75.5 mm above the floor-wire tops in IMG_9131: this one is taken to hang on the same line of pins, so its underside is at 75.5 mm and its top, 22 mm thick, at 97.5 (inferred, +8 -6 mm; it was a generic 75 mm). It folds as the front shelf does (`pivotInsetMm`). Position along the wall: in line behind the front shelf, whose front end is read from IMG_9083 (+-10 mm). About 5 stemware notches each.',
        { heightAboveGrid: 'estimated', pivotInset: 'photo', y: 'photo', stemwareNotches: 'photo' },
      ),
    },
  ],
  holders: [
    {
      id: 'knife_shelf',
      kind: 'knife_shelf',
      part: '11037806',
      description:
        'grey plastic tray along the left side: lattice floor, one comb row and two rows of slanted fins; folds up',
      side: 'left',
      sizeMm: [389, 119, 57],
      // IMG_9131: the front lip runs from x = -242 to -144 and the underside behind it from
      // -228 to -148; IMG_9083 from above has the inner edge at about -141 and the tray about
      // 102 mm wide (read on a reduced copy, +-5).
      // The tray is therefore about 99 mm wide where things stand beside and under it, and its
      // inner edge is at -143 (+-5); the published 119 mm must include what holds it on the
      // wall. It was [-254, -135], 10 mm outside the basket's outline.
      xMm: [-242, -143],
      // IMG_9083: its front lip is at image y = 2940 at a height of about 120 mm, which is 3030
      // on the floor, 68 mm behind the cross wire at -187: y = -119 (the wire at -149 lies 40 mm
      // in front of the lip and the wire at -112 under it). It is 389 mm long, and is put 4 mm
      // further forward than that reading so that its rear end stops short of the rear rim wire.
      yMm: [-123, 266],
      // IMG_9131: the underside at its front edge is 147.5 mm (outer side) to 151.5 mm (inner
      // side) above the tops of the floor wires and the top of the lip 171.5 to 176.5 mm
      // (+-7, the lip taken 105 mm behind the front wall wire). The tray stands on brackets
      // ABOVE the side wall, whose top wire is at 120 mm. The floor is 4 mm thick in the
      // geometry, so its top is put at 153.5; with no height given it was drawn hanging
      // 20 mm below the rim, with its underside at 97.75 mm.
      floorZMm: 153.5,
      // CHOICE, NOT SEEN: how it folds. Turned up about its own floor at this height it would
      // stand to 249 mm, 29 mm through the roof with the basket at level 1 (220 mm of room).
      // It is carried on fins that reach down to the top wire of the side wall, so the folded
      // tray is stood on that wire (top at 122.5 mm) against the wall: it then reaches
      // 218.5 mm, 1.5 mm under the roof at level 1. The real hinge may swing it further out.
      foldHingeZMm: 122.5,
      massG: 150,
      folds: true,
      defaultState: 'down',
      provenance: prov(
        'verified',
        `${B} 2.5 (knife shelf), 3.1 (racks.upper.knife_shelf)`,
        'Size and mass verified [P16]. Front lip at about y = -119 +-10 mm in IMG_9083 (corrected for its height above the floor), placed at -123 so that the rear end, 389 mm behind it, stops inside the rear rim. Width in use and height from IMG_9131, where the tray is down (see `xMm` and `floorZMm`): inner edge at x = -143 (+-5; it was -135 scaled from O83), underside 149.5 mm above the tops of the floor wires at its front edge (+-7), which leaves 122 mm clear above the top of the left ridge under it; the height was not recorded before and the geometry hung the tray 52 mm lower. The fins and the comb stand on its upper side. Only the front edge is seen: that it is level from front to back is assumed. FOLDED UP it has not been photographed: it is stood on the top wire of the side wall (`foldHingeZMm`, a choice of this engineer, because turned up at its own height it would go through the roof at levels 1 and 2).',
        { x: 'photo', y: 'photo', floorZ: 'photo', foldHingeZ: 'estimated' },
      ),
    },
  ],
  tray: null,
  massKg: 2.3,
  limits: {
    maxDiameterByPositionMm: { '1': 220, '2': 245, '3': 270 },
    positionOfBasket: 'upper',
    maxDiameterAsShown: null,
    seating: [],
    provenance: prov(
      'verified',
      `${B} 2.5 (largest item), 3.1 (max_item_by_level), 5.1`,
      'Printed in the manual [B1 p. 21]. The 22 cm at level 1 is also what the owner measured from the basket floor to the roof (owner update 4.1, reading c): an item of that height reaches the roof, and under the roof spinner only about 19 cm fits.',
    ),
  },
};

const CUTLERY_BASKET: CutleryBasketDef = {
  part: '11057829',
  material: 'polypropylene',
  sizeMm: [230, 128, 127],
  widthOverLidsMm: 149,
  heightWithHandleMm: 220,
  massG: 338,
  cells: 6,
  cellGrid: [2, 3],
  sectionsAlongLengthMm: [59, 46, 51, 70],
  layout: '2 x 3, the middle pair split again by thin removable dividers',
  base: 'feet',
  tunnels: { count: 2, centresFromMidMm: [-53, 53], clearWidthMm: 14, heightMm: 100 },
  wallOpeningMm: [7, 16],
  floorSlotMm: [3.5, 14],
  lid: { openingsMm: [9, 26], inUse: false },
  defaultPlacement: { basketId: 'lower', centreMm: [8, -133], longAxis: 'y' },
  defaultPosition: {
    id: 'front_centre',
    label: 'front centre',
    note: "As in the owner's photographs of the empty machine (IMG_9080, IMG_9081): astride the two side-row rail lines at the front centre, 8 mm right of the centre line, +-6 mm.",
  },
  // The cutlery basket is a loose part. Along the two side-row rail lines (106 mm apart, the
  // spacing of its tunnels) it can stand anywhere from wall to wall: the tines of those rows
  // lean along the rails and pass through the tunnels. `validateMachineConfig` accepts any such
  // placement; these are the ones offered by name.
  positions: [
    {
      id: 'front_right',
      label: 'front right',
      basketId: 'lower',
      centreMm: [110, -133],
      longAxis: 'y',
      tag: 'photo',
      note: "Where the owner stands it when he loads the machine (photograph of 2026-10-10): astride the right-hand side rows MR and FR, a chopping board between it and the right wall. Through a camera fitted to the basket's rim in that photograph (focal length 1935 px, RMS 9 px on four chamfer corners and the rear rim; six tine tips of row R2 then fall within 4 px) its front face spans image x = 1560 to 2050 and its handle post stands at x = 1806 to 1876, which puts its centre line 104 to 123 mm right of the basket's centre: +110 mm, +-12. Front-to-back it is where the tunnels put it. Not settled: in that photograph its rim back-projects 35 to 40 mm higher than in the photographs of the empty machine, so it may not have been seated on the base grid.",
    },
    {
      id: 'front_left',
      label: 'front left',
      basketId: 'lower',
      centreMm: [-110, -133],
      longAxis: 'y',
      tag: 'estimated',
      note: 'The mirror image of the front-right position, astride the left-hand side rows ML and FL, which mirror MR and FR. Not photographed: allowed by the rows.',
    },
  ],
  locatedBy: 'its two tunnels stand over the rail lines y = -80 (ML/MR) and y = -186 (FL/FR)',
  provenance: prov(
    'verified',
    `${B} 2.4, 3.1 (racks.cutlery_basket)`,
    'Length 230 and width 128 mm, 220 mm with the handle, 338 g, 6 compartments and two tunnels verified [P9, BSH photos 25130582, 25130584, O81]. Body height 127 +-6 mm, width over the folded-out lids 149 +-8 mm, section lengths +-5 mm, tunnel spacing 106 +-5 mm, clear width 14 +-3 mm and height 100 +-8 mm scaled from photographs. Floor slots and lid openings generic. Default position +-6 mm, as photographed; it is movable (`positions`). The geometry (packages/machine/src/geometry/cutlery.ts) draws 2 x 4 cells in the 6 compartments: the two thick cross walls stand over the tunnels and a thin divider halves each middle compartment (IMG_9081).',
    {
      'size.2': 'photo',
      widthOverLids: 'photo',
      sectionsAlongLength: 'photo',
      tunnels: 'photo',
      wallOpening: 'photo',
      floorSlot: 'generic',
      'lid.openings': 'generic',
      defaultPlacement: 'photo',
    },
  ),
};

// ---------------------------------------------------------------------------------------------
// Spray levels and nozzle tables (section 3.2)
// ---------------------------------------------------------------------------------------------

/**
 * Bore of the eight round holes of the lower arm, mm: 3.3 +-0.3, scaled against the tape that
 * lies on the arm in IMG_9086 (owner update sections 0 item 4, 2.3 and 5.4). The owner's drill
 * test gives about 4.5 mm instead; the two are not reconciled, and
 * `BOSCH_LOWER_ARM_BORE_DRILL_TEST_MM` is carried as the named alternative.
 */
export const BOSCH_LOWER_ARM_BORE_TAPE_MM = 3.3;

/**
 * The alternative bore of the lower arm's round holes, mm: the owner's drill test ("4mm drill
 * bit fairly loose, 5mm does not fit. Probably 4.5mm", owner-measurements.md). Case D of the
 * owner update, section 5.2. Not used by `BOSCH_SMV4HAX40G_DEF`; see `boschWithLowerArmBore`.
 */
export const BOSCH_LOWER_ARM_BORE_DRILL_TEST_MM = 4.5;

/**
 * The lower arm's nozzle table (owner update sections 2.5 and 7) with round holes of the given
 * bore, mm. "+" is the blade with five round holes, "-" the blade with three.
 */
function lowerNozzles(boreMm: number): readonly NozzleDef[] {
  return [
    {
      id: 'l1',
      label: 'L1',
      blade: '+',
      radiusMm: 45,
      thetaDeg: 0,
      rhoDeg: 90,
      face: 'top',
      shape: 'round',
      sizeMm: [boreMm],
      cd: 0.85,
      drives: false,
      description: 'round hole in a raised ring, square to the top face: a vertical jet; innermost',
    },
    {
      id: 'l2',
      label: 'L2',
      blade: '-',
      radiusMm: 69,
      thetaDeg: 0,
      rhoDeg: 90,
      face: 'top',
      shape: 'round',
      sizeMm: [boreMm],
      cd: 0.85,
      drives: false,
      description:
        'round hole in a raised ring, square to the top face: a vertical jet; 159.3 mm from the tip on the tape',
    },
    {
      id: 'l3',
      label: 'L3',
      blade: '+',
      radiusMm: 91,
      thetaDeg: 0,
      rhoDeg: 90,
      face: 'top',
      shape: 'round',
      sizeMm: [boreMm],
      cd: 0.85,
      drives: false,
      description: 'round hole in a raised ring, square to the top face: a vertical jet',
    },
    {
      id: 'l4',
      label: 'L4',
      blade: '+',
      radiusMm: 114,
      thetaDeg: 0,
      rhoDeg: 90,
      face: 'top',
      shape: 'round',
      sizeMm: [boreMm],
      cd: 0.85,
      drives: false,
      description:
        'round hole in a raised ring, square to the top face: a vertical jet; not the short slot the dossier took it for',
    },
    {
      id: 'l5',
      label: 'L5',
      blade: '+',
      radiusMm: 138,
      thetaDeg: 0,
      rhoDeg: 90,
      face: 'top',
      shape: 'round',
      sizeMm: [boreMm],
      cd: 0.85,
      drives: false,
      description:
        'round hole in a raised ring, square to the top face: a vertical jet; the drill stands in it in IMG_9111',
    },
    {
      id: 'l6',
      label: 'L6',
      blade: '-',
      radiusMm: 161,
      thetaDeg: 0,
      rhoDeg: 90,
      face: 'top',
      shape: 'round',
      sizeMm: [boreMm],
      cd: 0.85,
      drives: false,
      description:
        'round hole in a raised ring, square to the top face: a vertical jet; 66.5 mm from the tip on the tape',
    },
    {
      id: 'l7',
      label: 'L7',
      blade: '+',
      radiusMm: 183,
      thetaDeg: 90,
      rhoDeg: 45,
      face: 'top',
      shape: 'round',
      sizeMm: [boreMm],
      cd: 0.85,
      drives: true,
      description:
        'round hole in a hood whose mouth faces sideways: a trailing jet at about 45 deg, drive',
    },
    {
      id: 'l8',
      label: 'L8',
      blade: '-',
      radiusMm: 207,
      thetaDeg: 90,
      rhoDeg: 45,
      face: 'top',
      shape: 'round',
      sizeMm: [boreMm],
      cd: 0.85,
      drives: true,
      description:
        'round hole in a hood whose mouth faces sideways: a trailing jet at about 45 deg, drive; 21.9 mm from the tip on the tape',
    },
    {
      id: 'l9',
      label: 'L9',
      blade: '+',
      radiusMm: 225,
      thetaDeg: 0,
      rhoDeg: 75,
      face: 'top',
      shape: 'slot',
      sizeMm: [5.0, 1.8],
      cd: 0.78,
      drives: false,
      slotAxis: 'tangential',
      description:
        'pill-shaped slot in a tip hood, long axis across the blade, angled slightly outward: corner reach, no drive',
    },
    {
      id: 'l10',
      label: 'L10',
      blade: '-',
      radiusMm: 225,
      thetaDeg: 90,
      rhoDeg: 75,
      face: 'top',
      shape: 'slot',
      sizeMm: [5.0, 1.8],
      cd: 0.78,
      drives: true,
      slotAxis: 'tangential',
      description:
        'pill-shaped slot in a tip hood, long axis across the blade, angled slightly backward: weak drive; hidden by the tape in IMG_9086',
    },
    {
      id: 'l11',
      label: 'L11',
      blade: '+',
      bladeAssumed: true,
      radiusMm: 207,
      thetaDeg: 180,
      rhoDeg: -70,
      face: 'underside',
      shape: 'rect',
      sizeMm: [3.0, 2.2],
      cd: 0.8,
      drives: false,
      description:
        'rectangular outlet in a recess on the underside, 23 mm from the tip end, down and slightly inward: sweeps the filter plate, no drive',
    },
    // The blade that carries the underside outlet was not determined (owner update 2.5 and 8
    // item 3); it is listed on "+", as in the update and the dossier.
  ];
}

/** The upper arm's nozzle table (owner update sections 3.4 and 7). "+" is the owner's wing A. */
const UPPER_NOZZLES: readonly NozzleDef[] = [
  {
    id: 'u1',
    label: 'U1',
    blade: '+',
    radiusMm: 41,
    thetaDeg: 0,
    rhoDeg: 90,
    face: 'top',
    shape: 'round',
    sizeMm: [2.5],
    cd: 0.85,
    drives: false,
    description: 'round hole in a round boss, vertical; centre',
  },
  {
    id: 'u2',
    label: 'U2',
    blade: '-',
    radiusMm: 85,
    thetaDeg: 0,
    rhoDeg: 90,
    face: 'top',
    shape: 'rect',
    sizeMm: [4.8, 2.2],
    cd: 0.78,
    drives: false,
    slotAxis: 'radial',
    description:
      'rectangular slot in the top of a low boss, long axis along the arm; upright boss: a vertical fan',
  },
  {
    id: 'u3',
    label: 'U3',
    blade: '+',
    radiusMm: 130,
    thetaDeg: 0,
    rhoDeg: 90,
    face: 'top',
    shape: 'rect',
    sizeMm: [4.8, 2.2],
    cd: 0.78,
    drives: false,
    slotAxis: 'radial',
    description:
      'rectangular slot in the top of a low boss, long axis along the arm; upright boss: a vertical fan',
  },
  {
    id: 'u4',
    label: 'U4',
    blade: '+',
    radiusMm: 160,
    thetaDeg: 90,
    rhoDeg: 78,
    face: 'top',
    shape: 'rect',
    sizeMm: [4.8, 2.2],
    cd: 0.78,
    drives: true,
    slotAxis: 'radial',
    description:
      'rectangular slot in the top of a low boss, long axis along the arm; boss tilted slightly backward: weak drive',
  },
  {
    id: 'u5',
    label: 'U5',
    blade: '-',
    radiusMm: 193,
    thetaDeg: 70,
    rhoDeg: 70,
    face: 'top',
    shape: 'rect',
    sizeMm: [4.8, 2.2],
    cd: 0.78,
    drives: true,
    slotAxis: 'radial',
    description:
      'rectangular slot in the top of a low boss, long axis along the arm; boss tilted backward and slightly outward: drive; passes under the tablet tray',
  },
  {
    id: 'u6',
    label: 'U6',
    blade: '+',
    radiusMm: 219,
    thetaDeg: 90,
    rhoDeg: 45,
    face: 'top',
    shape: 'rect',
    sizeMm: [4.3, 2.3],
    cd: 0.78,
    drives: true,
    description:
      'rectangular mouth in the side of a wedge at the tip (the owner\'s "vertical slot"), facing backward at about 45 deg: drive',
  },
  {
    id: 'u7',
    label: 'U7',
    blade: '-',
    radiusMm: 223,
    thetaDeg: 60,
    rhoDeg: 50,
    face: 'top',
    shape: 'rect',
    sizeMm: [4.3, 2.3],
    cd: 0.78,
    drives: true,
    description:
      'rectangular slot in a tilted boss at the tip, facing backward and outward: drive, walls and corners',
  },
  {
    id: 'u8',
    label: 'U8',
    blade: '+',
    bladeAssumed: true,
    radiusMm: 38,
    thetaDeg: 0,
    rhoDeg: -90,
    face: 'underside',
    shape: 'round',
    sizeMm: [2.7],
    cd: 0.8,
    drives: false,
    description:
      'small round hole in a raised ring on the underside near the hub, straight down onto the lower basket near the axis',
  },
  // Which wing the underside hole U8 is under was not determined (owner update 3.1); listed "+".
];

const ROOF_NOZZLES: readonly NozzleDef[] = [
  {
    id: 'r1',
    label: 'R1',
    blade: 'axis',
    radiusMm: 0,
    thetaDeg: 0,
    rhoDeg: -90,
    face: 'underside',
    shape: 'round',
    sizeMm: [6.0],
    cd: 0.8,
    drives: false,
    description:
      'pipe outlet onto a free-spinning 5-vane rotor, 52 mm; emit as droplets, not as a coherent jet',
  },
];

/**
 * Friction radius k_f of the lower arm's bearing, mm. A PLACEHOLDER, not a measurement: nobody
 * has measured the friction or the speed of this arm. It is chosen so that the torque balance
 * gives the speed the owner update quotes and recommends (42 rpm in diverter position L at
 * 3000 rpm; section 5.5: "prescribe 40 +-10 rpm").
 *
 * CHOICE: the update reached 42 rpm with the generic k_f = 9.3 mm and the dossier's 21 mm hub
 * bore, but its section 7 replaces the hub bore by the 18 mm scaled from IMG_9112, and with
 * that bore 9.3 mm gives 54 rpm, outside its own recommendation. The scaled bore is kept as
 * data and the friction, the quantity with no evidence, is what gives way: 17.5 mm restores
 * the update's static friction (0.040 N m) and stall margin (0.066 N m) at that point, and its
 * speeds at the other pump speeds within 2 rpm. The value has no physical meaning on its own
 * (the axial load of this arm is a small difference of two larger forces); it is to be
 * replaced by a fit to the arm speed heard in a recording of a wash.
 */
const LOWER_ARM_FRICTION_RADIUS_MM = 17.5;

/**
 * Friction radius k_f of the upper arm's bearing, mm. A PLACEHOLDER chosen to give about 30
 * rpm (31 rpm in position UR at 3000 rpm; owner update 5.5: "prescribe 30 +-10 rpm"). The
 * generic 3.8 mm gives 67 rpm with the measured drive nozzles, two to three times what such
 * arms do. CHOICE: the update's k_f = 10 mm belongs to the dossier's 18 mm hub bore; with the 15
 * mm socket its section 7 scales from IMG_9099 the same speed, static friction (0.063 N m) and
 * stall margin (0.035 N m) need 12.6 mm. See `LOWER_ARM_FRICTION_RADIUS_MM`.
 */
const UPPER_ARM_FRICTION_RADIUS_MM = 12.6;

const SPRAY_LEVELS: readonly SprayLevelDef[] = [
  {
    kind: 'arm',
    id: 'lower',
    name: 'lower spray arm',
    part: '00668148',
    mount: { kind: 'tub' },
    axisMm: [0, 0],
    tipRadiusMm: 230,
    topFaceZMm: 50,
    nozzleUpZMm: 52,
    nozzleDownZMm: 36,
    bladeUndersideZMm: 36,
    hubUndersideZMm: 36,
    shape: {
      blades: 2,
      bladeThicknessMm: 14,
      hubHeightMm: 14,
      hubDiameterMm: 35,
      stemDiameterMm: 28.5,
      bladeWidthMm: [39, 30],
      tipSweepDeg: 0,
      description:
        'two blades, S-shaped in plan, about 39 mm wide near the hub and 30 mm at the tips; domed hub cap about 35 mm across; the vertical holes stand in rings 6.7 to 7 mm across and 1 to 2 mm high, the angled holes and tip slots in hoods 4 to 5 mm high; six radial fins and a collar round the stem underneath; stem 28.5 mm in diameter with a bore of about 18 mm, about 36 mm of it visible between the sump cover and the arm; PP-TD20',
    },
    feedTubeMm: null,
    massG: 69,
    weight: 0.68,
    inertiaWet: 3.5e-3,
    sense: 'cw',
    bearing: {
      frictionRadiusMm: LOWER_ARM_FRICTION_RADIUS_MM,
      viscous: 0.002,
      thrustSign: -1,
      hubBoreMm: 18,
    },
    designSpeedRpm: 42,
    nozzles: lowerNozzles(BOSCH_LOWER_ARM_BORE_TAPE_MM),
    nozzleProvenance: prov(
      'photo',
      `${U} 2 (2.1 count, 2.2 radii, 2.3 sizes, 2.4 directions, 2.5 table), 7 (lower-arm table); ${OM} (lower spray arm); photographs IMG_9086 to IMG_9098 and IMG_9109 to IMG_9112`,
      'Measured on the owner\'s arm, removed and laid beside a tape; replaces the dossier\'s table. Count (8 round holes and 2 tip slots on top, 5 holes on the "+" blade and 3 on the "-" blade, 1 outlet underneath) counted on IMG_9109 to IMG_9112; his "7 holes" is a miscount. Radii: L2, L6 and L8 read on the tape lying on the arm in IMG_9086, L9 from the tape\'s overall length, the "+" blade through a projective fit to IMG_9111, L10 hidden under the tape and taken as L9; all +-4 mm because the hub is under the tape, the two blades moving in opposite directions, spacing along one blade +-2 mm. Bore of the round holes 3.3 +-0.3 mm scaled against the tape in IMG_9086; THE OWNER\'S DRILL TEST GIVES ABOUT 4.5 mm (a 4 mm bit loose, a 5 mm bit does not enter) and the two are not reconciled: 4.5 mm is carried as `BOSCH_LOWER_ARM_BORE_DRILL_TEST_MM` and `boschWithLowerArmBore`. The bore of the two angled holes is assumed the same (not measured); tip slots 5.0 x 1.8 mm (+-0.7, +-0.4) and the underside outlet 3.0 x 2.2 mm (+-0.7) scaled from IMG_9086, IMG_9111 and IMG_9112. Directions: the six plain holes are vertical (a probe stands square to the face, IMG_9089 to IMG_9093); the two hooded holes are tangential and trailing, observed on IMG_9094, IMG_9110 and IMG_9111, at an elevation of 45 +-10 deg read from a loose drill; the tip slots and the underside outlet are in the owner\'s words ("slightly radially outward", "slightly backward", "slightly radially inward"), their elevations 75 +-10 and -70 +-15 deg estimated. Drive: L7, L8 and, weakly, L10. Which blade carries the underside outlet L11 was not determined: it is listed on "+" and flagged `bladeAssumed`. C_d 0.85 round, 0.78 slot, 0.80 rectangular, as in machine.md.',
      {
        // Counted on the photographs for the ten openings of the top face; the blade of the
        // underside outlet L11 was not determined and is flagged `bladeAssumed`.
        blade: 'verified',
        bladeAssumed: 'verified',
        face: 'verified',
        shape: 'verified',
        drives: 'verified',
        // The direction words are observed or the owner's; the angle numbers put on them are
        // estimates (0, 90 and 180 deg for "outward", "backward" and "inward").
        theta: 'estimated',
        rho: 'estimated',
        slotAxis: 'verified',
        cd: 'generic',
        cv: 'generic',
      },
    ),
    provenance: prov(
      'verified',
      `${B} 2.6 (lower arm), 2.2 (item 1), 3.1 (arms.lower); ${U} 2.4 (rotation), 4.2, 5.5, 6, 7 (arms.lower)`,
      "Span 460 mm verified [P1]; 457.6 mm by the owner's tape (IMG_9086). Top face 50 mm above the filter plate: NOT measured by the owner, the dossier's estimate kept (+-8, from the 36 mm visible stem and the 14 mm body; about 75 mm if his 30 cm was taken to a blade of the upper arm rather than to its hub); the lower basket and everything up to the upper arm's hub move with it. Clockwise seen from above: observed, the three tangential jets (L7, L8, L10) all point the same way round (IMG_9094, IMG_9110, IMG_9111). Stem 28.5 +-1 mm (IMG_9109), its bore about 18 +-2 mm (IMG_9112), cap about 35 mm and blade widths scaled from IMG_9086. Mass 69 g is the pattern part's; wet inertia 3.5e-3 kg m^2 estimated; c_v generic. Bearing friction: see `LOWER_ARM_FRICTION_RADIUS_MM`; no rotation speed has been measured, the design speed of 42 rpm is the owner update's figure for diverter position L at 3000 rpm (recommended 40 +-10 rpm).",
      {
        topFaceZ: 'estimated',
        nozzleUpZ: 'estimated',
        nozzleDownZ: 'estimated',
        bladeUndersideZ: 'estimated',
        hubUndersideZ: 'estimated',
        shape: 'photo',
        mass: 'sister',
        weight: 'sister',
        inertiaWet: 'estimated',
        bearing: 'estimated',
        'bearing.frictionRadius': 'estimated',
        'bearing.viscous': 'generic',
        'bearing.hubBore': 'photo',
        designSpeed: 'estimated',
      },
    ),
  },
  {
    kind: 'arm',
    id: 'upper',
    name: 'upper spray arm (under the upper basket)',
    part: '11010054',
    mount: { kind: 'basket', basketId: 'upper' },
    axisMm: [0, -30],
    tipRadiusMm: 230,
    topFaceZMm: -23,
    nozzleUpZMm: -21,
    nozzleDownZMm: -34,
    bladeUndersideZMm: -34,
    hubUndersideZMm: -55,
    shape: {
      blades: 2,
      bladeThicknessMm: 11,
      hubHeightMm: 30,
      hubDiameterMm: 49,
      stemDiameterMm: null,
      bladeWidthMm: [37, 23],
      tipSweepDeg: 7,
      description:
        'two blades, 11 mm thick, bowed in plan, about 37 mm wide at mid-length and 21 to 25 mm at the tips, 49 mm across the hub; hub 30 mm deep with a socket in its top (inner tube about 16.5 mm outside, 14 mm inside); hangs under the upper basket from the elbow of its feed tube, held by a four-lobed nut over a cross-ribbed inlet; underside smooth except one small round hole in a raised ring about 38 mm from the axis; marked >PP-TD20<',
    },
    feedTubeMm: { length: 270, diameter: 17 },
    massG: 65,
    weight: 0.64,
    inertiaWet: 2.7e-3,
    sense: 'ccw',
    bearing: {
      frictionRadiusMm: UPPER_ARM_FRICTION_RADIUS_MM,
      viscous: 0.002,
      thrustSign: 1,
      hubBoreMm: 15,
    },
    designSpeedRpm: 31,
    nozzles: UPPER_NOZZLES,
    nozzleProvenance: prov(
      'photo',
      `${U} 3 (3.1 count and radii, 3.2 sizes, 3.3 directions, 3.4 table), 7 (upper-arm table); ${OM} (upper spray arm); photographs IMG_9099 to IMG_9108`,
      'Measured on the owner\'s arm, removed and laid beside a tape; replaces the dossier\'s table, its tuned 16 deg slot tilt and its radially pointing tip outlets. Count (1 round hole and 6 rectangular openings on top: hole, two slots and the side-facing tip slot on the "+" blade, the owner\'s wing A; three slots on the "-" blade, wing B; 1 small round hole underneath) counted on IMG_9099 and IMG_9108; his "four horizontal slots" should be five. Radii of U1 to U7 read on the tape lying on the arm in IMG_9099, from the visible hub socket, +-3 mm; U8 scaled from IMG_9108, +-6 mm, its wing not determined. Sizes scaled against the tape, not gauged: U1 2.5 +-0.3 mm, slots 4.8 x 2.2 mm (+-0.4), tip outlets 4.3 x 2.3 mm (area +-30 %), U8 2.7 +-0.5 mm. The group tag is `photo` because the sizes and U8 are scaled from photographs; the radii of U1 to U7 are `measured`. Directions are the owner\'s words checked on IMG_9100, IMG_9101, IMG_9104, IMG_9106 and IMG_9107 ("vertical", "backwards slightly", "backwards and slightly outwards", "backwards significantly maybe 45 degrees"); the angles put on those words are estimates, +-8 deg for U4, +-12 for U5, +-15 for U6 and U7, and U8 is taken as straight down. Drive: the tip outlets U6 and U7 and the outer slots U5 and, weakly, U4. C_d 0.85 round, 0.78 rectangular, 0.80 for the underside hole, as in machine.md.',
      {
        shape: 'verified',
        // The blade of the underside hole U8 was not determined: flagged `bladeAssumed`.
        blade: 'verified',
        bladeAssumed: 'verified',
        face: 'verified',
        drives: 'verified',
        slotAxis: 'verified',
        // U1 to U7 read on the tape lying on the arm (+-3 mm); U8 scaled from IMG_9108 (+-6).
        radius: 'measured',
        size: 'photo',
        // The owner's direction words are measured; the angles put on them are estimates
        // (+-8 to 15 deg), the azimuths 70 deg of U5 and 60 deg of U7 among them.
        theta: 'estimated',
        rho: 'estimated',
        cd: 'generic',
        cv: 'generic',
      },
    ),
    provenance: prov(
      'estimated',
      `${B} 2.6 (upper arm), 2.1 (upper-arm axis), 3.1 (arms.upper); ${U} 3.3 (rotation), 4.1 (readings b and e), 4.2, 4.3, 5.5, 6, 7 (arms.upper); ${OM} (heights)`,
      "Span 460 mm, hub height 30 mm and the 270 mm feed tube verified [P2]. Axis 30 mm in front of the lower-arm axis estimated (+-20). Heights relative to the upper-basket floor: the lowest point of the hub 55 mm below it, which is where the owner's tape readings close (50 + 15 + 300 + 55 + 220 = 640 mm, his 30 cm from the lower-basket floor to the underside of the arm taken to the hub: 365 mm above the filter plate at level 1); blade underside 34 mm below the floor (+-7: 390 mm on the tape standing in the tub in IMG_9109, 384 mm from the hub); top face 23 mm below it, the blade being 11 mm thick. IMG_9131 (the basket out of the machine, end-on at floor height, the arm seen under the floor at the depth this file has for its axis) confirms the blade: top face 24.6 mm and underside 33.7 mm below the floor-wire tops, +-4. It does NOT confirm the hub: its dark underside is seen about 8 mm below the underside of the blades, 44 mm below the floor, standing on the tiled floor, where this file has 55. Three readings of the picture agree (43.6, about 42.5 and, by the geometry review, 43.8 at the depth of the hub, which the arm confirms): THE PHOTOGRAPH'S VALUE IS -44 +-3. NOT APPLIED, and not because the 55 is better: the 55 closes the owner's tape readings (with 44 his 30 cm would read 31.1 cm), but that chain is four readings of +-5 to 7 mm each, so a gap of 11 mm is inside its own uncertainty and it cannot outweigh the picture. Either the hub is 11 mm higher than drawn, or the floor of the upper basket is 11 mm lower (409 mm, the dossier's original 410 +-12); which of the two decides the clear height over the middle of the lower basket by 11 mm, and it moves the whole upper level, so it waits for the owner's tape from the floor of the lower basket to the hub and to a blade (docs/reference/owner-measurements.md, the reading of IMG_9131, has the request that would settle it). Counter-clockwise seen from above: observed on IMG_9100, IMG_9104 and IMG_9106 (the dossier had assumed it with no evidence). One downward opening, U8 (IMG_9108). Hub socket about 15 +-2 mm, blade widths and hub width scaled from IMG_9099. Mass, weight and inertia estimated; c_v generic. Bearing friction: see `UPPER_ARM_FRICTION_RADIUS_MM`; no rotation speed has been measured, the design speed of 31 rpm is the owner update's figure for position UR at 3000 rpm (recommended 30 +-10 rpm).",
      {
        tipRadius: 'verified',
        feedTube: 'verified',
        sense: 'verified',
        // The owner's tape readings stacked on the lower arm's estimated 50 mm ("M on E").
        hubUndersideZ: 'estimated',
        bladeUndersideZ: 'photo',
        nozzleDownZ: 'photo',
        'shape.hubDiameter': 'photo',
        'shape.bladeWidth': 'photo',
        'shape.hubHeight': 'verified',
        'bearing.viscous': 'generic',
        'bearing.hubBore': 'photo',
      },
    ),
  },
  {
    kind: 'fixed',
    id: 'roof',
    name: 'roof spinner ("Dachkreisel")',
    part: '00611388',
    mount: { kind: 'tub' },
    axisMm: [0, 20],
    type: 'free_spinning_rotor',
    outletZMm: 625,
    lowerFaceZMm: 610,
    diameterMm: 52,
    heightMm: 21,
    vanes: 5,
    spray: { pattern: 'rotating_shower', coneHalfAngleDeg: 65, dropletSpeed: 2.5 },
    nozzles: ROOF_NOZZLES,
    nozzleProvenance: prov(
      'estimated',
      `${B} 3.2 (roof spinner), 2.6`,
      "The outlet bore was not found (hidden by the rotor in every photograph): 6 mm assumed, 4 to 9 mm plausible; it sets a third of the upper level's flow.",
    ),
    provenance: prov(
      'estimated',
      `${B} 2.6 (roof spinner), 3.1 (arms.roof); ${U} 4.3, 6 (roof), 7 (arms.roof)`,
      'Rotor 52 x 53 mm, 21 mm high, 5 vanes verified [P4]. Position 245 mm in front of the rear wall scaled from the side view of the feed pipe (+-20). Heights estimated as the dossier does, 15 mm (outlet) and 30 mm (lower face of the rotor) below the roof, which the owner measured at 640 mm: 625 and 610 mm (the dossier had 660 and 645 under a roof at 675). No photograph of either set shows the roof or the spinner. Droplet speed and cone angle are placeholders with no evidence.',
      {
        diameter: 'verified',
        height: 'verified',
        vanes: 'verified',
        type: 'verified',
        axis: 'photo',
      },
    ),
  },
];

// ---------------------------------------------------------------------------------------------
// The machine
// ---------------------------------------------------------------------------------------------

/** The Bosch SMV4HAX40G/13 in authoring units. Load it with `loadMachineSpec`. */
export const BOSCH_SMV4HAX40G_DEF: MachineDef = {
  id: 'bosch_smv4hax40g',
  name: 'Bosch Serie 4 SMV4HAX40G/13',
  description:
    "Bosch Serie 4 fully integrated 60 cm dishwasher, E-Nr. SMV4HAX40G/13 (BSH platform GV640, type SD6PW1B, FD 0106), 13 place settings: lower arm, upper arm and roof spinner; cutlery basket, no third rack; sliding-lid dispenser with a tablet tray on the upper basket; closed-door condensation drying against a water tank on the left wall. The owner's machine, from docs/research/machine-bosch-smv4hax40g.md, with his own measurements of 2026-10-09 (docs/research/machine-bosch-owner-update.md): both spray arms' nozzles, the rotation senses, the roof at 640 mm and the heights of both baskets.",
  identity: {
    maker: 'Robert Bosch Hausgeraete GmbH',
    model: 'SMV4HAX40G/13',
    variant:
      'Serie 4, fully integrated, 60 cm, 81.5 cm height class; type SD6PW1B; FD 0106 (June 2021); BSH platform GV640',
    placeSettings: 13,
    outerSizeMm: [598, 550, 815],
    ratedPower: [2000, 2400],
    ratedVoltage: [220, 240],
    nominalVoltage: 230,
    provenance: prov(
      'verified',
      `${B} 1.1`,
      'Rating plate [O79], specification sheet [B4], EPREL record [B5].',
    ),
  },
  tub: {
    xMm: [-272, 273],
    yMm: [-235, 265],
    zMm: [0, 640],
    floorDatum:
      'the top surface of the flat fine filter, the lowest visible surface of the stepped floor pan',
    verticalCornerRadiusMm: 30,
    floorSlopeDeg: 4,
    floorDescription:
      'a shallow stepped pan: one pressed step a few centimetres in from the walls; filter and sump cover in the lowest part; raised ledges along both side walls for the basket wheels',
    // CHOICE: not in the dossier. The wheels of the lower basket (35 mm, axles about level with
    // its floor cross wires at 71 mm) run on the ledges: 71 - 35 / 2.
    wheelLedgeZMm: 53.5,
    material: 'stainless_steel',
    provenance: prov(
      'estimated',
      `${B} 2.1, 2.2, 3.1 (frame.tub); ${U} 4.1 (reading d), 4.3, 7 (frame.tub); ${OM} (heights)`,
      "No document gives an interior dimension. Height: the owner's tape reads 64 cm from the filter plate to the roof (+-5 mm); the dossier's stack-up had 675 +-15. Width 545 +-12 mm measured in O80 against the 460 mm arm; depth 500 +-15 mm and the 265 mm from the lower-arm axis to the rear wall (+-25) derived. Corner radius and floor slope generic. Ledge height derived by this engineer from the wheels of the lower basket.",
      {
        z: 'measured',
        x: 'photo',
        verticalCornerRadius: 'generic',
        floorSlope: 'generic',
        material: 'verified',
        floorDescription: 'verified',
      },
    ),
  },
  door: {
    flangePlaneYMm: -235,
    linerPlaneYMm: -275,
    hingeAxisMm: { y: -250, z: 45 },
    openAngleDeg: 90,
    linerSizeMm: [575, 625],
    openingHeightMm: 625,
    provenance: prov(
      'estimated',
      `${B} 2.1 (door liner, door hinge, opening height), 3.1 (frame.door)`,
      "Liner recessed about 40 mm beyond the flange plane, at the upper limit of what the appliance's 550 mm depth allows (20 to 40). Hinge axis +-30 mm. Inner door pressing 625 x 575 mm verified [P10]. The door opens flat (1150 mm deep with the door open).",
      { linerSize: 'verified' },
    ),
  },
  sump: {
    centreMm: [0, -85],
    diameterMm: 200,
    depthMm: 85,
    workingVolumeL: 1.2,
    residueAfterDrainL: 0.17,
    provenance: prov(
      'generic',
      `${B} 3.1 (frame.sump), 2.9 (water left after a drain), 2.10 (cylinder position)`,
      'Filter axis +-8 mm and flange diameter scaled from O82; depth and working volume generic; residue after a normal drain 0.16 to 0.18 L from a BSH patent [PA6].',
      { centre: 'photo', diameter: 'photo', residueAfterDrain: 'sister' },
    ),
  },
  filter: {
    axisMm: [0, -85],
    flatPlate: {
      xMm: [-130, 130],
      // IMG_9082: the mesh runs from 59 to 62 mm behind the filter axis (y = -85) to 94 to 99 mm
      // in front of it, about 155 mm in all, where the part page gives 130 mm for the sheet.
      yMm: [-180, -20],
      openingDiameterMm: 54,
      holeDiameterMm: 0.85,
      holePitchMm: 1.47,
      lattice: 'hex',
      openFraction: 0.3,
      openAreaCm2: 88,
      provenance: prov(
        'photo',
        `${B} 2.10 (flat fine filter 00645037 and its perforation), 3.1 (frame.filter.flat_plate)`,
        'Sheet 260 x 130 mm with a 54 mm opening published [P5]; the 260 mm width is used. Front to back the visible mesh in IMG_9082 is about 155 mm, y = -180 to -20 (+-12): mesh from image x = 1475 to 4320 at the front (260 mm, 10.9 px/mm) and y = 2400 to 3640 at 7.2 to 8.4 px/mm front to back, the coarse-filter axis at about (2825, 2850); the published 130 mm appears not to be the visible mesh. Hole pitch 1.47 +-0.1 mm, hole 0.85 +-0.15 mm, open fraction 0.30 (0.21 to 0.42), open area about 88 cm2 over about 290 cm2 of perforated sheet: kept as the dossier has it, not rescaled to the larger extent.',
        { openingDiameter: 'verified', y: 'photo' },
      ),
    },
    sumpCover: {
      sizeMm: [259, 95],
      yMm: [-20, 75],
      holeDiameterMm: 1.25,
      holePitchMm: 2.1,
      openAreaCm2: 26,
      provenance: prov(
        'photo',
        `${B} 2.10 (sump cover 12038407), 3.1 (frame.filter.sump_cover)`,
        'Size verified [P6]; holes about 1.25 mm at about 2.1 mm pitch from photographs; open area estimated.',
        { size: 'verified', openArea: 'estimated' },
      ),
    },
    coarse: {
      diameterMm: 79,
      lengthMm: 131,
      openingMm: 5.0,
      crownDiameterMm: 71,
      crownTopZMm: 28,
      provenance: prov(
        'verified',
        `${B} 2.10 (coarse filter), 3.1 (frame.filter.coarse)`,
        'Flange 79 mm and length 131 mm verified [P5]. Crown about 71 mm across (measured 72 +-5 in O82); its top about 28 mm above the plate (20 to 34), under the lower arm whose underside is at 36 mm. Slot width generic.',
        { crownDiameter: 'photo', crownTopZ: 'estimated', opening: 'generic' },
      ),
    },
    micro: {
      diameterMm: 71,
      heightMm: 92,
      pleatFactor: 1.5,
      meshMm: 0.2,
      areaCm2: 230,
      openFraction: 0.37,
      provenance: prov(
        'estimated',
        `${B} 2.10 (micro filter, micro mesh adopted), 3.1 (frame.filter.micro)`,
        'Cylinder 71 x 92 mm verified [P5]; 1.5-fold pleating from the 2010 platform manual. Mesh 0.20 mm, open fraction 0.37 and 230 cm2 are estimates inside the ranges of BSH patent [PA2].',
        { diameter: 'verified', height: 'verified', pleatFactor: 'sister' },
      ),
    },
  },
  saltCap: {
    // IMG_9082: the cap is 980 px wide (92 mm); its right edge is 35 mm from the left edge of
    // the filter plate (x = -130), and the foot of its centre is about 13 mm in front of the
    // filter axis. x is taken 2 mm short of the photograph's -205 so that the cap stands clear
    // of the wheel ledge as it is drawn.
    centreMm: [-203, -85],
    diameterMm: 92,
    topZMm: 25,
    provenance: prov(
      'photo',
      `${B} 2.1 (salt container cap), 3.1 (frame.floor_features.salt_cap); photograph IMG_9082`,
      "Centre from IMG_9082 (full-resolution pixels: cap right edge at x = 1100 against the plate's left edge at 1475; top-face centre at (600, 2780), its foot at about y = 2955), +-12 mm: about (-205, -85); the dossier had (-187, -60). Size 92 x 90 x 19 mm verified [P12]; top about 25 mm above the filter plate (15 to 33), under the sweep of the lower arm.",
      { diameter: 'verified', topZ: 'estimated' },
    ),
  },
  floorFeatures: [
    {
      kind: 'beads',
      id: 'beads_left',
      xMm: [-235, -180],
      yMm: [-185, -155],
      count: 3,
      lengthMm: 51,
      pitchMm: 13,
      provenance: prov(
        'photo',
        `${B} 2.1 (floor pressings), 3.1 (frame.floor_features.beads)`,
        '+-15 mm, from O82 and O81. Pressings, not openings.',
      ),
    },
    {
      kind: 'beads',
      id: 'beads_right',
      xMm: [185, 236],
      yMm: [-185, -155],
      count: 3,
      lengthMm: 51,
      pitchMm: 13,
      provenance: prov(
        'photo',
        `${B} 2.1 (floor pressings), 3.1 (frame.floor_features.beads)`,
        '+-15 mm, from O82 and O81. Pressings, not openings.',
      ),
    },
    {
      kind: 'dish',
      id: 'rear_dish',
      centreMm: [185, 160],
      diameterMm: 75,
      provenance: prov(
        'photo',
        `${B} 2.1 (floor pressings), 3.1 (frame.floor_features.rear_dish)`,
        '+-15 mm, from O82.',
      ),
    },
  ],
  feedDuct: {
    part: '11003118',
    riserXMm: [-30, 30],
    riserProudMm: 21,
    portBlockProudMm: 34,
    // CHOICE: the dossier gives heights above the stub ends but not where the stub ends are.
    // The duct is made to end at the roof, as before: with the roof the owner measured at
    // 640 mm the stub ends of the 680 mm part are 40 mm below the filter plate (owner update
    // 4.3: "at least 40 mm"). UNRESOLVED: the port heights below are the dossier's, scaled from
    // a photograph of the part, and with these stub ends they stand at 305, 331 and 358 mm,
    // about 50 mm below where the feed tube of the upper arm docks (370, 395, 420 mm less about
    // 15). One of the two is wrong by about 50 mm; the owner update leaves it open, and so
    // does this file. It does not affect the spray model.
    stubEndZMm: -40,
    stubYMm: 35,
    portAboveStubEndsMm: [345, 371, 398],
    topAboveStubEndsMm: 680,
    channels: 2,
    provenance: prov(
      'photo',
      `${B} 2.1 (rear feed pipe, riser, docking ports), 3.1 (frame.feed_pipe); ${U} 4.3 (feed pipe), 8 item 8`,
      "Part 680 x 275 x 55 mm with two channels and three docking ports verified [P3]. Riser 15 to 21 mm proud of the rear wall (21 mm below the ports), port block 33 to 35 mm, front face 55 to 62 mm wide: scaled from BSH's side view, +-4 mm. Port heights above the stub ends +-12 mm. Floor stubs 230 mm in front of the rear wall. Stub-end height chosen by this engineer so that the duct ends at the roof the owner measured (640 mm): 40 mm below the filter plate. The published length and the port heights no longer fit one tub: the ports come out about 50 mm below the docking height of the upper arm's feed tube (owner update 4.3, not resolved).",
      {
        part: 'verified',
        channels: 'verified',
        topZ: 'verified',
        stubEndZ: 'estimated',
        stubY: 'photo',
      },
    ),
  },
  wallFeatures: [
    {
      id: 'left_grille',
      surface: 'left',
      kind: 'grille',
      description: 'round grille in the left wall, in front of the heat exchanger',
      sizeMm: null,
      proudMm: 0,
      count: 1,
      provenance: prov(
        'verified',
        `${B} 2.1 (left wall)`,
        'Presence verified in O80; neither size nor position is recorded.',
      ),
    },
    {
      id: 'left_fittings',
      surface: 'left',
      kind: 'fitting',
      description:
        'two small plastic fittings in the left wall: the water inlet with its splash cap, and the expansion opening',
      sizeMm: null,
      proudMm: 0,
      count: 2,
      provenance: prov(
        'verified',
        `${B} 2.1 (left wall)`,
        'Presence verified in O80; neither size nor position is recorded.',
      ),
    },
    {
      id: 'rear_panels',
      surface: 'rear',
      kind: 'embossed_panel',
      description: 'two embossed panels in the back wall, one each side of the feed pipe',
      sizeMm: [190, 155],
      proudMm: 0,
      count: 2,
      provenance: prov('photo', `${B} 2.1 (back wall)`, 'About 190 x 155 mm, +-15 mm, from O80.'),
    },
    {
      id: 'guide_rail_left',
      surface: 'left',
      kind: 'guide_rail',
      description: 'guide rail of the upper basket (part 00668097)',
      sizeMm: [460, 51],
      // CHOICE: neither end nor height is recorded. Along the wall the 460 mm rail is centred
      // in the 500 mm tub. In height it is put beside the upper basket: its lower edge level
      // with the basket floor at level 1 (the roller carriers ride at about floor height in
      // O80). +-40 mm.
      positionMm: { along: [-215, 245], z: [420, 471] },
      proudMm: 16,
      count: 1,
      provenance: prov(
        'verified',
        `${B} 2.5 (guide rails); photograph IMG_9080`,
        '460 mm long, 51 x 16 mm section [P16]. Its height on the wall is not recorded: placed by this engineer beside the upper basket (lower edge at 420 mm, +-40), from where the roller carriers are seen in O80.',
        { position: 'estimated' },
      ),
    },
    {
      id: 'guide_rail_right',
      surface: 'right',
      kind: 'guide_rail',
      description: 'guide rail of the upper basket (part 00668097)',
      sizeMm: [460, 51],
      // CHOICE: neither end nor height is recorded. Along the wall the 460 mm rail is centred
      // in the 500 mm tub. In height it is put beside the upper basket: its lower edge level
      // with the basket floor at level 1 (the roller carriers ride at about floor height in
      // O80). +-40 mm.
      positionMm: { along: [-215, 245], z: [420, 471] },
      proudMm: 16,
      count: 1,
      provenance: prov(
        'verified',
        `${B} 2.5 (guide rails); photograph IMG_9080`,
        '460 mm long, 51 x 16 mm section [P16]. Its height on the wall is not recorded: placed by this engineer beside the upper basket (lower edge at 420 mm, +-40), from where the roller carriers are seen in O80.',
        { position: 'estimated' },
      ),
    },
    {
      id: 'roof_feed_run',
      surface: 'roof',
      kind: 'other',
      description:
        'forward run of the feed pipe under the roof, from the riser to the roof spinner',
      sizeMm: null,
      proudMm: 0,
      count: 1,
      provenance: prov(
        'verified',
        `${B} 2.1 (roof)`,
        'Presence verified [P3, B11]; the roof is hidden in every photograph.',
      ),
    },
  ],
  dispenser: {
    part: '00755073',
    unitSizeMm: [120, 105, 65],
    chamberCentreMm: [-22, -275, 510],
    chamberSizeMm: [50, 35],
    lid: { kind: 'slides', direction: 'up' },
    keepOutDepthMm: 0,
    fillMarksMl: [15, 25, 50],
    // The lower lip of the chamber opening: 510 - 35 / 2 (section 2.12: "at about 492").
    tabletExitMm: [-22, -275, 492.5],
    tabletTarget: { kind: 'basket_tray', basketId: 'upper' },
    rinseAidOutletMm: [25, -275, 510],
    rinseAidReservoirMl: 80,
    rinseAidPerPulseMl: 1,
    provenance: prov(
      'estimated',
      `${B} 2.12, 3.1 (frame.dispenser)`,
      'Unit 120 x 105 x 65 mm, sliding lid, fill marks and the tablet path into the upper-basket tray verified [P18, B1 p. 27-28]. Chamber centre 22 mm left of the door centre line at z = 510 +-30 mm, on the liner plane; chamber opening 50 x 35 mm and the rinse-aid outlet estimated. Reservoir 80 mL and 1 mL per pulse from the 2010 platform manual.',
      {
        unitSize: 'verified',
        lid: 'verified',
        keepOutDepth: 'verified',
        fillMarks: 'verified',
        tabletTarget: 'verified',
        rinseAidReservoir: 'sister',
        rinseAidPerPulse: 'sister',
      },
    ),
  },
  drying: {
    method: 'heat_exchanger_condensation',
    heatExchanger: {
      part: '00770952',
      wall: 'left',
      sizeMm: [435, 670],
      thicknessMm: 42,
      volumeL: 3.1,
      wallConductance: 25,
      provenance: prov(
        'verified',
        `${B} 2.13, 3.1 (frame.heat_exchanger)`,
        "Tank 670 x 435 x 42 mm on the outside of the left wall verified [P19]; 3.1 L content from the 2010 platform manual. Thermal contact 25 W/K with a full tank is the programme researcher's estimate (10 to 50).",
        { volume: 'sister', wallConductance: 'estimated' },
      ),
    },
    autoOpen: null,
    fan: false,
    defaultDurationMin: 40,
    provenance: prov(
      'verified',
      `${B} 2.13, 3.1 (drying)`,
      'Condensation on the cooled left wall, door closed throughout, no fan, no zeolite, no automatic door opening [B4, B8]. The 40 min drying step is estimated (30 to 50).',
      { defaultDuration: 'estimated' },
    ),
  },
  baskets: [LOWER_BASKET, UPPER_BASKET],
  cutleryBasket: CUTLERY_BASKET,
  sprayLevels: SPRAY_LEVELS,
  hydraulics: {
    pump: {
      part: '12014980',
      type: 'brushless DC circulation pump with a tube heater in the same housing ("Heizpumpe")',
      ratedSpeedRpm: 3000,
      shutOffHead: 4.0,
      curveCoefficientPerLMin2: 1.19e-3,
      speedRangeRpm: [2000, 3500],
      hydraulicEfficiency: 0.4,
      motorEfficiency: 0.72,
      idlePower: 8,
      provenance: prov(
        'estimated',
        `${B} 2.7, 3.1 (hydraulics.pump), 3.3`,
        'No pump curve was found. H_0 = 4.0 m and b = 1.19e-3 m/(L/min)^2 are constructed to pass through the sister platform\'s 3.1 m at 27.5 L/min and to give 400 mbar at 3500 rpm. The owner update (5.3, 5.4) keeps the curve unchanged: with the nozzle openings scaled from the owner\'s photographs it still gives the documented duty (30.5 L/min at 2.9 m on the lower arm); with the 4.5 mm bores of his drill test it would not. 3000 rpm is a label for "normal wash speed". Speed range 2000 to 3500 rpm "typically" from a BSH patent [PA5]. Efficiencies and idle power generic.',
        {
          part: 'verified',
          type: 'verified',
          speedRangeRpm: 'sister',
          hydraulicEfficiency: 'generic',
          motorEfficiency: 'generic',
          idlePower: 'generic',
        },
      ),
    },
    branches: [
      {
        id: 'lower',
        staticLift: 0.11,
        liftAtPosition: null,
        lossCoefficient: 2.0e10,
        pipeVolumeL: 0.25,
        statedCdAMm2: 76.4,
        provenance: prov(
          'estimated',
          `${B} 3.1 (hydraulics.branches), 3.3; ${U} 2.5, 5.4, 7 (hydraulics.branches.lower)`,
          "Static lift estimated; K and pipe volume generic (K includes the 20 mbar a BSH patent quotes for the water switch). C_d A 76.4 mm2 is the sum of the owner update's nozzle table with 3.3 mm bores scaled from the owner's photograph (the dossier had 66.0); with the 4.5 mm of his drill test it is 126.4 mm2 (`BOSCH_LOWER_BRANCH_CDA_DRILL_TEST_MM2`).",
          { lossCoefficient: 'generic', pipeVolume: 'generic', statedCdA: 'photo' },
        ),
      },
      {
        id: 'upper',
        staticLift: 0.43,
        liftAtPosition: '2',
        lossCoefficient: 8.0e10,
        pipeVolumeL: 0.4,
        statedCdAMm2: 57.1,
        provenance: prov(
          'estimated',
          `${B} 3.1 (hydraulics.branches), 3.3; ${U} 3.4, 7 (hydraulics.branches.upper)`,
          "Static lift at Rackmatic level 2, +-0.025 m per level: unchanged, the nozzles now at 374 mm above the filter plate and the sump level 60 mm below it. K = 9 kPa at 20 L/min through the riser, the docking port and a feed tube of about 13.5 mm bore. Pipe volume generic. C_d A 57.1 mm2 is the sum of the owner update's nozzle table, its openings scaled from the owner's photograph IMG_9099 (the dossier had 41.0).",
          { pipeVolume: 'generic', statedCdA: 'photo' },
        ),
      },
      {
        id: 'roof',
        staticLift: 0.69,
        liftAtPosition: null,
        lossCoefficient: 1.4e11,
        pipeVolumeL: 0.1,
        statedCdAMm2: 22.6,
        provenance: prov(
          'estimated',
          `${B} 3.1 (hydraulics.branches), 3.3; ${U} 7 (hydraulics.branches.roof)`,
          "K = 2.5 kPa at 8 L/min in a channel of about 1.5 cm2. Static lift 0.69 m: the outlet 15 mm under the roof the owner measured at 640 mm, plus the 60 mm to the sump level (the dossier had 0.72 m under a roof at 675). The owner update's own operating points were solved with 0.72 m, 0.3 kPa more. The outlet bore is still assumed.",
        ),
      },
    ],
    diverter: {
      part: '00644996 (motor 00611329)',
      type: 'motor-driven rotary disc on the sump ("Wasserweiche") with three outlets',
      positions: [
        { id: 'closed', label: 'CLOSED', feeds: [] },
        { id: 'lu', label: 'LU', feeds: ['lower', 'upper'] },
        { id: 'r', label: 'R', feeds: ['roof'] },
        { id: 'u', label: 'U', feeds: ['upper'] },
        { id: 'l', label: 'L', feeds: ['lower'] },
        { id: 'ur', label: 'UR', feeds: ['upper', 'roof'] },
      ],
      transitionTime: 2.5,
      defaultPattern: [
        ['l', 60],
        ['ur', 60],
      ],
      provenance: prov(
        'sister',
        `${B} 2.8, 3.1 (hydraulics.diverter)`,
        'The part and its three outlets are verified; the position set of the production disc is not documented. The six positions are those of a BSH patent embodiment [PA1], 60 deg apart, in its order; nothing feeds all three levels. Transition 2.5 s per step estimated (factor 2). Which positions are used, the pairing of the upper arm with the roof spinner and the 60 s dwells are assumptions.',
        { transitionTime: 'estimated', defaultPattern: 'estimated' },
      ),
    },
    nozzleVelocityCoefficient: 1.0,
    sumpLevelBelowDatumMm: 60,
    inventory: {
      minSumpVolumeL: 0.5,
      flightTime: 0.5,
      returnTime: 1.5,
      carryOverL: 0.4,
      topUpVolumeL: 0.5,
      maxTopUpsPerPhase: 1,
      levelCheckIn: ['pre_rinse', 'main_wash'],
      provenance: prov(
        'generic',
        `${B} 3.1 (hydraulics.inventory), 3.5`,
        'Generic values. Carry-over 0.4 L: 0.17 L in the sump (BSH patent) plus the generic 0.25 L on the load. The level is checked by pump current in the pre-rinse and the wash only (2010 platform manual).',
        { carryOver: 'sister', levelCheckIn: 'sister' },
      ),
    },
    fill: {
      inletFlowLPerMin: 2.5,
      firstBathVolumeL: 4.0,
      laterBathVolumeL: 2.5,
      flushVolumeL: 0.5,
      metering: 'flow-sensor pulses; no pressure switch',
      prestoreVolumeL: 3.1,
      // CHOICE: not in the dossier. Its step A1 empties the 3.1 L tank within a one-minute fill,
      // so the tank delivers at least 3.1 L/min; 5 L/min empties 2.5 L in 30 s.
      prestoreDischargeFlowLPerMin: 5,
      provenance: prov(
        'sister',
        `${B} 2.9, 3.1 (hydraulics.fill)`,
        "Fill rate 2.5 L/min from two platform figures. First bath 4.0 L from the water arithmetic of the printed figures (section 4.2); later baths 2.5 L (final rinse from the 2010 platform; an intermediate rinse may be 2.9 L); flush 0.5 L estimated. The next bath is pre-stored in the 3.1 L heat exchanger. The discharge rate of the tank is this engineer's estimate.",
        {
          firstBathVolume: 'estimated',
          laterBathVolume: 'estimated',
          flushVolume: 'estimated',
          prestoreDischargeFlow: 'estimated',
        },
      ),
    },
    drain: {
      flowLPerMin: 16,
      pattern: [35, 10, 10],
      provenance: prov(
        'generic',
        `${B} 2.9 (drain rate), 3.1 (hydraulics.drain)`,
        "Not found for this pump; the sister platform's drain pump delivers 10 L/min at 0.9 m.",
      ),
    },
  },
  thermal: {
    heaterPower: 2100,
    heaterDuty: 1.0,
    machineHeatCapacity: 14000,
    liquorLoadConductance: 600,
    liquorMachineConductance: 250,
    // CHOICE: the two pump-off conductances are not in the dossier's text or its specification
    // block. They are the constants of the script behind its energy balance of section 4.5
    // (G_idle = 15 W/K, G_lm = 6 W/K), without which the balance cannot be reproduced.
    liquorMachineConductanceIdle: 15,
    loadMachineConductanceIdle: 6,
    cabinetConductance: 3.0,
    inletTemperature: 15,
    ambientTemperature: 23,
    heaterCutOut: 75,
    referenceLoadHeatCapacity: 23000,
    provenance: prov(
      'generic',
      `${B} 2.7 (heater), 3.1 (thermal), 4.5`,
      "Heater 2100 W at 230 V and full duty (design rate 2.5 K/min) from the 2010 platform manual, reconciled with the rating plate; it scales with the voltage squared (2290 W at 240 V). Heat capacities and conductances generic; UA 3.0 W/K estimated (2.6 to 4). Load 23 kJ/K is the full 13 place-setting load of the programme table. Heater off above 75 C from the 2010 platform manual. Pump-off conductances from the dossier's energy-balance script.",
      {
        heaterPower: 'sister',
        heaterDuty: 'sister',
        cabinetConductance: 'estimated',
        heaterCutOut: 'sister',
        liquorMachineConductanceIdle: 'estimated',
        loadMachineConductanceIdle: 'estimated',
      },
    ),
  },
  dosing: {
    detergentMassG: 20,
    detergentReleaseDelay: 60,
    rinseAidVolumeMl: 5,
    rinseAidDelay: 60,
    rinseAidMinTemperature: 40,
    provenance: prov(
      'estimated',
      `${B} 2.12, 3.1 (dosing)`,
      'Detergent 20 g generic. The release time is not stated ("at the optimum time"): 60 s after the main-wash circulation starts assumed (0 to 5 min). Rinse aid 5 mL: 5 pulses of 1 mL at the factory setting r05, if the 2010 rule still holds; dosed about 1 min after the final-rinse circulation starts, with the liquor above 40 C.',
      { detergentMass: 'generic' },
    ),
  },
  softener: {
    setting: 'H04',
    regenerateEveryCycles: 6,
    extraWaterL: 5,
    extraDurationMin: 7,
    extraEnergyKWh: 0.05,
    provenance: prov(
      'verified',
      `${B} 2.9 (softener, regeneration), 3.1 (softener)`,
      'Manual [B1 p. 22-24]: every 6 programmes at the factory setting; at most 7 min, 5 L and 0.05 kWh; before the end of the main wash.',
    ),
  },
  sensors: {
    turbidity: {
      part: '00611323',
      activeIn: ['pre_rinse', 'main_wash', 'end_of_main_wash'],
      decides:
        'nothing in Eco 50, which runs the same course whatever the load; thresholds are not public',
    },
    waterLevel: 'pump_motor_current',
    waterQuantity: 'impeller_pulses',
    load: 'no load sensor is listed for this model; a larger load is noticed only through the level check',
    provenance: prov(
      'sister',
      `${B} 2.11, 3.1 (sensors), 4.3`,
      'The AquaSensor part is verified; when it is read and what it decides are from the platform manuals of 2008 and 2010.',
      { 'turbidity.part': 'verified', load: 'verified' },
    ),
  },
  programmes: BOSCH_PROGRAMMES,
  primaryProgramme: 'eco_50',
  // The owner's photographs and his tape measurements show the upper basket at level 1, its
  // highest position (dossier section 2.2 item 7; owner update 4.3); that is the default.
  defaultBasketHeights: { upper: '1' },
};

// ---------------------------------------------------------------------------------------------
// The unresolved bore of the lower arm (owner update sections 0 item 4, 5.2 and 5.4)
// ---------------------------------------------------------------------------------------------

/**
 * C_d A of the lower arm with the 4.5 mm bores of the owner's drill test, mm^2, as the owner
 * update states it (section 5.2, case D); 76.4 mm^2 with the 3.3 mm bores used by default.
 */
export const BOSCH_LOWER_BRANCH_CDA_DRILL_TEST_MM2 = 126.4;

/**
 * The Bosch with another bore for the eight round holes of its lower arm, authoring units.
 * `boreMm` in millimetres; `id` and `name` identify the variant. Three things change: the lower
 * arm's nozzle table, the C_d A stated for the lower branch (the sum of the table, mm^2), and
 * the viscous coefficient c_v of the lower arm's bearing, which is re-fitted so that the arm
 * still turns at its design speed (42 rpm in diverter position L at the rated pump speed).
 * Everything else, the pump curve included, is `BOSCH_SMV4HAX40G_DEF`.
 *
 * Why the bearing is re-fitted: both bearing parameters are placeholders tuned to an arm speed
 * nobody has measured (`LOWER_ARM_FRICTION_RADIUS_MM`), so a variant that is about the jets
 * must not change the arm speed as a side effect. With larger bores the pressure thrust on the
 * hub and the downward jet reaction nearly cancel (axial load -0.18 N at 4.5 mm), the dry
 * friction k_f |F_ax| all but vanishes and the arm would run at 58 rpm, outside the 40 +-10 rpm
 * the owner update prescribes; it calls that "an artefact of the friction law, not a
 * prediction". The friction radius cannot absorb it (it multiplies a load that is nearly zero),
 * so c_v does: from drive - k_f |F_ax| = omega (brake + c_v). The stall margin of the variant
 * is therefore not meaningful. Use the function to switch to the drill-test bore, or to any
 * bore between, when the owner settles the question.
 */
export function boschWithLowerArmBore(boreMm: number, id: string, name: string): MachineDef {
  const nozzles = lowerNozzles(boreMm);
  const cdAMm2 = nozzles.reduce((sum, n) => sum + n.cd * nozzleArea(n.shape, n.sizeMm), 0);
  const withBore = (viscous: number | null): MachineDef => ({
    ...BOSCH_SMV4HAX40G_DEF,
    id,
    name,
    sprayLevels: BOSCH_SMV4HAX40G_DEF.sprayLevels.map((level) =>
      level.kind === 'arm' && level.id === 'lower'
        ? {
            ...level,
            nozzles,
            ...(viscous === null
              ? {}
              : {
                  bearing: { ...level.bearing, viscous },
                  provenance: {
                    ...level.provenance,
                    note: `${level.provenance.note ?? ''} VARIANT with ${boreMm} mm bores: the viscous coefficient is re-fitted to ${viscous.toPrecision(3)} N m s so that the arm keeps its design speed (see \`boschWithLowerArmBore\`).`,
                    fields: { ...level.provenance.fields, 'bearing.viscous': 'estimated' as const },
                  },
                }),
          }
        : level,
    ),
    hydraulics: {
      ...BOSCH_SMV4HAX40G_DEF.hydraulics,
      branches: BOSCH_SMV4HAX40G_DEF.hydraulics.branches.map((branch) =>
        branch.id === 'lower' ? { ...branch, statedCdAMm2: cdAMm2 } : branch,
      ),
    },
  });
  // The torque balance of the variant at the point the design speed refers to.
  const unfitted = withBore(null);
  const spec = loadMachineSpec(unfitted);
  const arm = spec.sprayLevels.find((level) => level.kind === 'arm' && level.id === 'lower');
  if (arm === undefined || arm.kind !== 'arm' || arm.designSpeed === null) return unfitted;
  const point = hydraulicOperatingPoint(spec, 'l', spec.hydraulics.pump.ratedSpeedRpm);
  const pressure = point.branches.find((branch) => branch.id === 'lower')?.armPressure;
  if (pressure === undefined) return unfitted;
  const terms = armTorqueTerms(arm, pressure);
  const viscous = (terms.drive - terms.staticFriction) / arm.designSpeed - terms.brake;
  // A bore small enough for the unchanged bearing to hold the arm below its design speed needs
  // no extra damping: the coefficient is never lowered below the default's.
  return withBore(Math.max(viscous, arm.bearing.viscous));
}

/**
 * The named alternative of the owner update (case D): the Bosch with the 4.5 mm bores of the
 * owner's drill test on the lower arm, where `BOSCH_SMV4HAX40G_DEF` has the 3.3 mm scaled from
 * his photograph. With the pump curve unchanged the lower arm then takes 38.4 L/min at 12.8
 * kPa and its jets leave at 5.06 m/s instead of 6.65 m/s. Not the default: the update prefers
 * 3.3 mm, which fits the documented pump duty; one photograph of the drill bit on the tape
 * decides.
 */
export const BOSCH_SMV4HAX40G_DRILL_BORE_DEF: MachineDef = boschWithLowerArmBore(
  BOSCH_LOWER_ARM_BORE_DRILL_TEST_MM,
  'bosch_smv4hax40g_drill_bore',
  'Bosch Serie 4 SMV4HAX40G/13, lower-arm bores 4.5 mm (drill test)',
);
