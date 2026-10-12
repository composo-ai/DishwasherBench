/**
 * Values the geometry generator supplies itself, because no machine specification gives them.
 *
 * Each is a named constant with what it is and why it has this value, and each is listed in
 * `MachineGeometry.assumptions`, so that calibration can see what the generated shapes rest on
 * besides the specification. SI units: metres and radians; ratios are plain numbers.
 */

import type { GeometryAssumption } from './types.ts';

/** Centre-line radius of a wire bend, as a multiple of the wire's diameter. */
export const BEND_RADIUS_RATIO = 3;
/** Centre-line radius of the bends of a floor wire that follows a floor relief, in wire diameters. */
export const RELIEF_BEND_RADIUS_RATIO = 1.5;
/** A bend sharper than this angle is rounded with short capsules; a shallower one is a plain joint. */
export const MIN_ROUNDED_BEND = (25 * Math.PI) / 180;
/** Angle one capsule of a bend turns through at most; a bend has 3 to 5 capsules. */
export const BEND_CAPSULE_ANGLE = (30 * Math.PI) / 180;
/** Diameter of the ball end of a tine as a multiple of its wire diameter. */
export const TINE_BALL_RATIO = 1.5;
/** Centre-to-centre distance of the two legs of a hairpin tine, as a multiple of its wire diameter. */
export const HAIRPIN_LEG_RATIO = 2;
/** Width of a basket wheel along its axle, metres. */
export const WHEEL_WIDTH = 0.008;
/** How far the handle of a basket stands in front of the basket's outer front line, metres. */
export const HANDLE_FRONT_OFFSET = 0;
/** How far the top of the handle stands above the top of the front rim wire, metres. */
export const HANDLE_ABOVE_RIM = 0.026;
/** Wall thickness of moulded plastic parts (trays, shelves, the cutlery basket), metres. */
export const PLASTIC_WALL = 0.002;
/** Open fraction of the slotted floor of the tablet collecting tray. */
export const TABLET_TRAY_FLOOR_OPEN_FRACTION = 0.4;
/** Open fraction of the lattice of cup shelves and holders. */
export const SHELF_OPEN_FRACTION = 0.5;
/** Thickness of the lattice floor of a holder, metres. */
export const HOLDER_FLOOR_THICKNESS = 0.004;
/** Height of the rim round a holder's floor, metres. */
export const HOLDER_RIM_HEIGHT = 0.018;
/** Floor of a holder below the top of the side rim wire when its height is not recorded, metres. */
export const HOLDER_FLOOR_BELOW_RIM = 0.02;
/** Width of the bars of the cutlery basket's lattice, metres. */
export const CUTLERY_LATTICE_BAR = 0.0025;
/** Open fraction of the cutlery basket's lid grids. */
export const CUTLERY_LID_OPEN_FRACTION = 0.5;
/** Section of the cutlery basket's carrying handle: width across the basket and thickness, metres. */
export const CUTLERY_HANDLE_SECTION: readonly [number, number] = [0.022, 0.006];
/** How far the posts of the cutlery basket's handle stand in from the ends of its body, metres. */
export const CUTLERY_HANDLE_POST_INSET = 0.016;
/** Top of the cutlery basket's cell floors above the plane of its feet, metres. */
export const CUTLERY_FLOOR_TOP = 0.006;
/** Height of the ridge of a tunnel roof of the cutlery basket above the tunnel's height, metres. */
export const CUTLERY_TUNNEL_RIDGE = 0.006;
/** Clearance kept between the opening of a cutlery cell and the carrying handle, metres. */
export const CUTLERY_CELL_HANDLE_CLEARANCE = 0.002;
/** Thickness of the sheet the tub, its floor and the door liner are drawn with, metres. */
export const TUB_SHEET = 0.002;
/** Width of the ledges the lower basket's wheels run on, metres. */
export const WHEEL_LEDGE_WIDTH = 0.022;
/** Height of the foot of the feed duct where it runs along the tub floor, metres. */
export const FEED_DUCT_FOOT_HEIGHT = 0.02;
/** Half height of the block of docking ports beyond the outermost port centres, metres. */
export const PORT_BLOCK_MARGIN = 0.013;
/** How far the dispenser unit and its lid stand proud of the door liner, metres. */
export const DISPENSER_PROUD = 0.002;
/** Rounding radius of the edges of a spray-arm blade, metres. */
export const ARM_EDGE_RADIUS = 0.003;
/** Gap between the nozzle exit plane of a hanging arm and the underside of its feed tube, metres. */
export const ARM_FEED_CLEARANCE = 0.003;
/** Radius of the boss a nozzle is drawn as, metres. */
export const NOZZLE_BOSS_RADIUS = 0.0035;
/** The list of every assumption above, as it is reported in `MachineGeometry.assumptions`. */
export const GEOMETRY_ASSUMPTIONS: readonly GeometryAssumption[] = [
  {
    id: 'bend_radius_ratio',
    value: BEND_RADIUS_RATIO,
    tag: 'estimated',
    note: 'Centre-line radius of every wire bend, in wire diameters. No dossier gives a bend radius; 3 is ordinary for 3 to 5 mm rack wire. Affects only the few millimetres round a bend.',
  },
  {
    id: 'relief_bend_radius_ratio',
    value: RELIEF_BEND_RADIUS_RATIO,
    tag: 'estimated',
    note: 'Centre-line radius of the bends of the floor wires that follow a floor relief, in wire diameters. The ridges of a pressed W-shaped floor are bent tighter than a wall wire; with the ordinary radius a steep ridge 36 mm high would be drawn 7 mm lower than its profile, with this one 3 to 4 mm lower.',
  },
  {
    id: 'tine_ball_ratio',
    value: TINE_BALL_RATIO,
    tag: 'estimated',
    note: 'Diameter of a ball-ended tine tip in wire diameters (6 mm on a 4 mm tine). The dossiers verify that the tips are balls but give no size.',
  },
  {
    id: 'hairpin_leg_ratio',
    value: HAIRPIN_LEG_RATIO,
    tag: 'estimated',
    note: 'Leg spacing of a hairpin tine in wire diameters (7 mm centre to centre for 3.5 mm wire); read off O83, not measured.',
  },
  {
    id: 'wheel_width',
    value: WHEEL_WIDTH,
    tag: 'estimated',
    note: 'Width of a basket wheel, metres. Diameter, stations and track are in the specification; the width is not.',
  },
  {
    id: 'handle_front_offset',
    value: HANDLE_FRONT_OFFSET,
    tag: 'photo',
    note: "A basket handle is a bar standing on the front rim, its front face on the basket's outer front line. Read from the owner's loaded photograph of 2026-10-10 through a camera fitted to the rim (4 chamfer corners and the rear rim, RMS 9 px, checked on six tine tips to 4 px): the bar's lower front edge spans its published 215 mm at y = -253 mm (dossier frame, front line at -256), its upper rear edge at y = -236. +-6 mm. Before this reading it was drawn 8 mm in front of the front line.",
  },
  {
    id: 'handle_above_rim',
    value: HANDLE_ABOVE_RIM,
    tag: 'photo',
    note: "Top of a basket handle above the top of the front rim wire. The same reading as `handle_front_offset`: the bar's lower front edge is 153 mm and its top 174 mm above the floor cross wires where the rim wire is at 145 mm, so the bar stands on the rim and its top is 26 mm above the top of the rim wire. +-5 mm. Before this reading it was drawn hanging in front of the rim with its top 5 mm above it.",
  },
  {
    id: 'plastic_wall',
    value: PLASTIC_WALL,
    tag: 'estimated',
    note: 'Wall thickness of the moulded parts: tablet tray, cutlery basket, holders.',
  },
  {
    id: 'tablet_tray_floor_open_fraction',
    value: TABLET_TRAY_FLOOR_OPEN_FRACTION,
    tag: 'estimated',
    note: 'The tray floor is slotted (verified); the open fraction of the slots is not known.',
  },
  {
    id: 'shelf_open_fraction',
    value: SHELF_OPEN_FRACTION,
    tag: 'estimated',
    note: 'Open fraction of the lattice of cup shelves and of the knife shelf floor (O83 shows square openings about as wide as two bars).',
  },
  {
    id: 'holder_floor_below_rim',
    value: HOLDER_FLOOR_BELOW_RIM,
    tag: 'estimated',
    note: 'Where a holder has no recorded floor height, the top of its floor is put this far below the top of the side rim: in O83 the knife shelf lies just under the left rim, and the leaflet shows mugs standing under it.',
  },
  {
    id: 'cutlery_lattice_bar',
    value: CUTLERY_LATTICE_BAR,
    tag: 'estimated',
    note: 'Bar width of the cutlery basket lattice, metres; with the specified openings it gives the open fractions of its walls and floor. Read off O81 (bars about a third of the 7 mm openings).',
  },
  {
    id: 'cutlery_floor_top',
    value: CUTLERY_FLOOR_TOP,
    tag: 'estimated',
    note: 'Top of the floors of the cutlery basket above the plane of its feet, metres: the ribs and raised arches of the moulded floor (IMG_9080 shows arched ribs standing up from the floor of the front cells) as one slab, closed for collision and porous for water. Not measured, +-3 mm. Before this the floor was drawn as a sheet 2 mm thick.',
  },
  {
    id: 'cutlery_handle_post_inset',
    value: CUTLERY_HANDLE_POST_INSET,
    tag: 'photo',
    note: "The posts of the cutlery basket's handle stand this far in from the ends of its body: 14 mm in IMG_9081 (the bar's front end against the front rim, corrected for the bar's height), 20 mm in the owner's loaded photograph. +-5 mm.",
  },
  {
    id: 'cutlery_tunnel_ridge',
    value: CUTLERY_TUNNEL_RIDGE,
    tag: 'estimated',
    note: 'A tunnel roof of the cutlery basket is drawn flat below and ridged above, this much higher under the cross wall than at its edges: the arch of the real tunnel is round on top (IMG_9081), so nothing stands on it.',
  },
  {
    id: 'cutlery_cell_handle_clearance',
    value: CUTLERY_CELL_HANDLE_CLEARANCE,
    tag: 'estimated',
    note: 'The opening of a cutlery cell listed for the loading layer stops this far short of the carrying handle.',
  },
  {
    id: 'cutlery_lid_open_fraction',
    value: CUTLERY_LID_OPEN_FRACTION,
    tag: 'estimated',
    note: 'Open fraction of the lid grids of the cutlery basket.',
  },
  {
    id: 'tub_sheet',
    value: TUB_SHEET,
    tag: 'estimated',
    note: 'Thickness the tub walls are drawn with, outside the inner faces the specification gives. Has no effect inside the tub.',
  },
  {
    id: 'wheel_ledge_width',
    value: WHEEL_LEDGE_WIDTH,
    tag: 'estimated',
    note: 'Width of the ledges along the side walls on which the lower basket runs; their height is in the specification.',
  },
  {
    id: 'feed_duct_foot_height',
    value: FEED_DUCT_FOOT_HEIGHT,
    tag: 'estimated',
    note: 'Height of the flat channel of the feed duct along the floor between the rear wall and the sump cover (O82). It must pass under the lower arm, whose underside is at 36 mm.',
  },
  {
    id: 'dispenser_proud',
    value: DISPENSER_PROUD,
    tag: 'estimated',
    note: 'The dispenser is let into the door; its face and lid are drawn this far proud of the liner so that they exist as surfaces.',
  },
  {
    id: 'arm_feed_clearance',
    value: ARM_FEED_CLEARANCE,
    tag: 'estimated',
    note: 'The feed tube of an arm that hangs under a basket is drawn just above the arm, this far above its nozzle exit plane: it ends in the elbow on top of the hub. Its height under the basket floor is not recorded.',
  },
  {
    id: 'nozzle_boss_radius',
    value: NOZZLE_BOSS_RADIUS,
    tag: 'photo',
    note: 'Nozzle rings and hoods are drawn as bosses of this radius from the blade face to the nozzle exit plane (rings 6.7 to 7 mm across on the lower arm, owner update section 6).',
  },
];
