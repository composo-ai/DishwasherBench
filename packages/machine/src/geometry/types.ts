/**
 * What `buildMachineGeometry` returns: the machine as named shapes with their frames, and the
 * affordances the loading layer needs (docs/design/platform.md section 4.4).
 *
 * Units: SI (metres, radians). Frames (platform.md section 2), all right-handed with z up:
 * - `tub`: the tub frame T, origin on the lower spray-arm axis at the floor datum, +x right, +y
 *   back, +z up;
 * - `lower_rack`, `upper_rack`, `third_rack`: the rack frames, origin at the front-left corner of
 *   the basket's outer plan rectangle at the top surface of its base grid, axes parallel to T
 *   with the basket pushed in;
 * - `cutlery_basket`: origin at the front-left corner of the body of the free-standing cutlery
 *   basket in the plane of its feet, +y along its long side;
 * - `arm:<level id>`: origin on the rotation axis of a spray arm in the plane of the top face of
 *   its blades, +x along the "+" blade, +z up. At arm angle 0 its axes are parallel to T.
 *
 * Every part carries the pose that maps its frame to the tub frame in the reference state: the
 * baskets pushed in at their configured height, the arms at angle 0, the door closed.
 */

import type { Pose, Vec3 } from '@spotless/core';
import type { Shape } from '@spotless/geometry';
import type { ProvenanceTag } from '../provenance.ts';
import type {
  CutleryBasketPlacement,
  HorizontalAxis,
  HorizontalDirection,
  MachineConfig,
  RackFrameId,
  Range,
  Vec2,
} from '../types.ts';

// ---------------------------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------------------------

/**
 * What a part is to the wash simulation (the instance kinds of docs/design/sim-core.md section
 * 3.5): `wires` a group of capsule chains, `basket` panels and mouldings carried by a basket,
 * `tub` a fixed part of the wash chamber, `arm` a rotating spray arm.
 */
export type MachinePartRole = 'wires' | 'basket' | 'tub' | 'arm';

/** Which component of the machine a part belongs to. */
export type MachineComponent =
  | 'tub'
  | 'filter'
  | 'door'
  | 'dispenser'
  | 'feed_duct'
  | 'fixed_sprayer'
  | 'basket_wires'
  | 'basket_fittings'
  | 'tablet_tray'
  | 'cutlery_basket'
  | 'spray_arm'
  | 'arm_feed';

/** Name of the frame a part's shape is written in (see the file comment). */
export type MachineFrameId = 'tub' | RackFrameId | 'cutlery_basket' | `arm:${string}`;

/**
 * How a part can move.
 * - `static`: fixed in the tub frame.
 * - `revolute`: turns about an axis through `point` along the unit vector `axis`, both in the
 *   part's own frame. `sense` is +1 when it turns counter-clockwise about `axis` in operation
 *   and -1 when clockwise; `range` limits the angle (radians), null for a full turn.
 * - `prismatic`: slides along the unit vector `direction` (tub frame) by 0 to `travel` metres.
 * A part with `carriedBy` set also moves rigidly with that basket.
 */
export type PartMotion =
  | { readonly kind: 'static' }
  | {
      readonly kind: 'revolute';
      readonly point: Vec3;
      readonly axis: Vec3;
      readonly sense: 1 | -1;
      readonly range: Range | null;
    }
  | { readonly kind: 'prismatic'; readonly direction: Vec3; readonly travel: number };

/** One named shape of the machine. */
export interface MachinePart {
  /** Stable id, unique in the machine: `tub`, `lower_rack`, `lower_arm`, ... */
  readonly id: string;
  readonly role: MachinePartRole;
  readonly component: MachineComponent;
  /** The part as a rigid compound of analytic primitives, in the frame named by `frame`. */
  readonly shape: Shape;
  readonly frame: MachineFrameId;
  /** Part frame to tub frame in the reference state (see the file comment). */
  readonly pose: Pose;
  /** `static`, or `kinematic` when the part is driven (baskets, arms, the door). */
  readonly body: 'static' | 'kinematic';
  readonly motion: PartMotion;
  /** Id of the basket that carries the part, or null for a part fixed to the tub. */
  readonly carriedBy: string | null;
  /** Catalogue material id of most of the part; each `Part` of the shape carries its own. */
  readonly material: string;
  /**
   * For a spray arm: its place in the machine's list of rotating arms (the spray levels of kind
   * `arm`, in the order of `MachineSpec.sprayLevels`), the id of its spray level, and the hinge
   * it turns about (part frame). `senseSign` is +1 counter-clockwise seen from above.
   */
  readonly arm?: {
    readonly index: number;
    readonly levelId: string;
    readonly hingePoint: Vec3;
    readonly hingeAxis: Vec3;
    readonly senseSign: 1 | -1;
  };
}

// ---------------------------------------------------------------------------------------------
// Affordances
// ---------------------------------------------------------------------------------------------

/** The gap between two neighbouring tines of a row, where a plate or a lid can stand. */
export interface TineSlot {
  /** Index of the slot in the row: between tine `index` and tine `index + 1`. */
  readonly index: number;
  /** Midpoint between the two tine bases on the rail centre line, rack frame, metres. */
  readonly centre: Vec3;
  /** The same point in the tub frame with the basket pushed in. */
  readonly centreTub: Vec3;
  /** Centre-to-centre distance of the two tines, metres. */
  readonly pitch: number;
  /** Clear width between the two tine wires at the rail, metres. */
  readonly clearWidth: number;
  /**
   * Suggested lean of an item in the slot from the vertical, radians, and the direction its top
   * goes: that of the tines when they lean along the rail, 0 when they stand upright or lean
   * across the rail. Where the two tines lean apart (a V gap) the lean is 0.
   */
  readonly lean: number;
  readonly leanToward: HorizontalDirection;
  /**
   * Unit normal of the plane a plate stands in, rack frame: the rail direction turned by the
   * suggested lean, so that the plate is parallel to the tines on both sides of it.
   */
  readonly plateNormal: Vec3;
  /** True where the two tines lean apart: a wide slot for a pot or a large bowl. */
  readonly vGap: boolean;
  /**
   * What stands in the slot in this configuration, so that nothing can be stood there: the part
   * id `cutlery_basket` where the cutlery basket stands astride the row over it; null when the
   * slot is free. A blocked slot is still listed, so that slot indices do not depend on the
   * configuration.
   */
  readonly blockedBy: string | null;
}

/** One tine row as the loading layer sees it. Rack frame of `basketId`, metres. */
export interface TineRowAffordance {
  readonly basketId: string;
  readonly rowId: string;
  readonly label: string;
  readonly frame: RackFrameId;
  /** Axis the rail runs along. Plates stand across it. */
  readonly runs: HorizontalAxis;
  /** State in this configuration. A folded row offers no slots. */
  readonly state: 'up' | 'folded';
  /** The two ends of the rail centre line. */
  readonly rail: readonly [Vec3, Vec3];
  /** Height of the top of the rail wire above the rack-frame origin. */
  readonly railTopZ: number;
  /** Base (on the rail centre line) and tip (the highest point) of every tine, in rail order. */
  readonly tines: readonly { readonly base: Vec3; readonly tip: Vec3 }[];
  /** The slots between neighbouring tines; empty when the row is folded. */
  readonly slots: readonly TineSlot[];
  /**
   * The nearest parallel row whose rail overlaps this one, with which it holds a plate, and the
   * distance between the two rails; null when there is none within 0.2 m.
   */
  readonly partner: { readonly rowId: string; readonly railSpacing: number } | null;
}

/** An axis-aligned box in a named frame, metres. */
export interface FrameBox {
  readonly min: Vec3;
  readonly max: Vec3;
}

/** A folding cup shelf as the loading layer sees it. Rack frame of `basketId`. */
export interface CupShelfZone {
  readonly basketId: string;
  readonly shelfId: string;
  readonly state: 'up' | 'down';
  /** The shelf itself in this state. */
  readonly box: FrameBox;
  /**
   * With the shelf down: the surface cups stand on (z is the top of the shelf) as the plan
   * rectangle `x`, `y`. With the shelf up it is null.
   */
  readonly surface: { readonly x: Range; readonly y: Range; readonly z: number } | null;
  /** Clear height under the lowered shelf above the base grid, metres; null when it is up. */
  readonly clearBelow: number | null;
  /** Positions of the stemware notches along the free edge, rack frame (shelf down). */
  readonly stemwareNotches: readonly Vec3[];
}

/** A plastic holder (a knife shelf) as the loading layer sees it. Rack frame of `basketId`. */
export interface HolderZone {
  readonly basketId: string;
  readonly holderId: string;
  readonly kind: 'knife_shelf' | 'glass_holder' | 'clip' | 'other';
  readonly state: 'up' | 'down';
  /** The holder in this state. */
  readonly box: FrameBox;
  /** Top of its floor above the rack-frame origin with the holder down, metres. */
  readonly floorZ: number;
  /** How the floor height is known. */
  readonly floorZTag: ProvenanceTag;
}

/**
 * A sloped rest along a side wall of a basket: a stretch of the floor's relief that falls
 * straight from a ridge towards the wall, on which cups, mugs and glasses stand mouth down,
 * tilted by the slope so that the hollow of the base drains, their openings towards the middle
 * of the basket. Rack frame of `basketId`, metres and radians.
 */
export interface SideRestZone {
  readonly basketId: string;
  readonly frame: RackFrameId;
  /** The wall the rest falls towards: `'left'` (low x) or `'right'` (high x). */
  readonly restId: 'left' | 'right';
  /** Rack-frame direction in which the slope falls (towards its wall). */
  readonly fallsToward: '-x' | '+x';
  /** x of the top of the slope (the corner of the relief at the ridge). */
  readonly peakX: number;
  /** x where the slope meets the low floor by the wall. */
  readonly footX: number;
  /** x of the inside of the basket on that side: the low floor runs from `footX` to here. */
  readonly wallX: number;
  /** Rise of the floor (tops of the upper wires) at the ridge and at the foot, above z = 0. */
  readonly peakZ: number;
  readonly footZ: number;
  /** Angle of the slope from the horizontal. */
  readonly slope: number;
  /** The stretch along y over which the rest runs (the inside of the basket). */
  readonly y: Range;
}

/**
 * One cell of the cutlery basket: a compartment, or the half of one that a thin divider leaves.
 * The cells are those of the basket wherever the configuration has stood it.
 */
export interface CutleryCell {
  /**
   * `c<across><along>`, for example `c01`: column 0 across the width, cell 1 along the length
   * counted from the end of the basket at its frame's y = 0.
   */
  readonly id: string;
  /**
   * The opening of the cell, `cutlery_basket` frame: the part of its inside that is free from
   * the top of its floor (`box.min[2]`) to above the carrying handle, as plan extent and height
   * range up to the rim. The vertical line through its centre meets nothing of the basket.
   */
  readonly box: FrameBox;
  /** The whole inside of the cell between its walls; it reaches under the carrying handle. */
  readonly interior: FrameBox;
  /** Centre of the opening on the top of the cell's floor, tub frame, basket pushed in. */
  readonly floorCentreTub: Vec3;
  /**
   * Position along the long side of a thin removable divider that splits the cell, in the
   * `cutlery_basket` frame, or null. Null for every cell of a basket whose dividers are in
   * place: the two halves are then listed as cells of their own.
   */
  readonly dividerAt: number | null;
}

/** The cutlery basket where the configuration has stood it. */
export interface CutleryBasketAffordance {
  /** Id of the basket it stands in. */
  readonly basketId: string;
  /** Rack frame of that basket. */
  readonly frame: RackFrameId;
  /** Id of the named position it stands at, or null when it stands somewhere without a name. */
  readonly positionId: string | null;
  readonly placement: CutleryBasketPlacement;
  /** The `cutlery_basket` frame in the tub frame, basket pushed in. */
  readonly poseTub: Pose;
  /**
   * What it covers of the basket it stands in, rack frame: its body with the lid grids where
   * they hang outside it, from the base grid to the top of the handle.
   */
  readonly box: FrameBox;
  /** Height of its rim above the base grid of the basket it stands in, metres. */
  readonly rimZ: number;
}

/** Something above a basket that limits how tall its load can be. */
export interface OverheadObstacle {
  /** `upper_arm.blades`, `upper_arm.hub`, `roof`, `roof_spinner`, `upper_rack` ... */
  readonly id: string;
  /** Tub-frame z of its lowest surface, metres. */
  readonly zTub: number;
  /** Height of that surface above the rack-frame origin of the basket below, metres. */
  readonly clearHeight: number;
  /**
   * Where it is in plan, tub frame: everywhere over the basket, or a disc. An item clear of the
   * disc in plan is not limited by it.
   */
  readonly region:
    | { readonly kind: 'everywhere' }
    | { readonly kind: 'disc'; readonly centre: Vec2; readonly radius: number };
}

/** The usable interior of a basket. */
export interface BasketEnvelope {
  readonly basketId: string;
  readonly frame: RackFrameId;
  /** Id of the height position the basket is in. */
  readonly positionId: string;
  /** Rack-frame origin in the tub frame, basket pushed in, metres. */
  readonly originTub: Vec3;
  /**
   * The clear inside of the basket in its rack frame: in plan the rectangle inside the inner
   * faces of its rim wires (corners and recesses not taken off), in height from the top of the
   * base grid to `maxItemHeight`.
   */
  readonly interior: FrameBox;
  /** Heights of the top of the rim wire above the rack-frame origin, by side. */
  readonly rimTopZ: {
    readonly front: number;
    readonly rear: number;
    readonly left: number;
    readonly right: number;
  };
  /** Everything above the basket that limits the height of its load, lowest first. */
  readonly overhead: readonly OverheadObstacle[];
  /**
   * The greatest height above the top of the base grid that is clear over the whole basket: the
   * clear height of the lowest overhead obstacle, metres.
   */
  readonly maxItemHeight: number;
  /**
   * The same away from every obstacle that occupies only a disc in plan (the hub of the arm
   * above, the roof spinner), metres.
   */
  readonly maxItemHeightClearOfDiscs: number;
  /** Where the basket goes when it is pulled out. */
  readonly travel: { readonly direction: Vec3; readonly distance: number };
}

/** One ring of a swept volume: every point with `rMin <= r <= rMax` and `zMin <= z <= zMax`. */
export interface SweptRing {
  /** What sweeps it: `blades`, `hub`, `stem`, `nozzles`. */
  readonly id: string;
  /** Radial range about the axis, metres. */
  readonly rMin: number;
  readonly rMax: number;
  /** Height range in the tub frame, metres. */
  readonly zMin: number;
  readonly zMax: number;
}

/** The volume a spray arm passes through in one turn: a stack of rings about its axis. */
export interface ArmSweptVolume {
  /** Id of the spray level. */
  readonly levelId: string;
  /** Id of the part that sweeps it. */
  readonly partId: string;
  /** (x, y) of the rotation axis in the tub frame, metres. */
  readonly axis: Vec2;
  readonly rings: readonly SweptRing[];
  /** The largest radius and the height range of all rings together. */
  readonly radius: number;
  readonly zMin: number;
  readonly zMax: number;
}

/** The volume the dispenser lid passes through when the chamber opens. Tub frame. */
export interface LidSweptVolume {
  readonly kind: 'slides' | 'swings';
  /** The closed lid. */
  readonly closed: FrameBox;
  /** Everything the lid passes through, the closed and the open lid included. */
  readonly swept: FrameBox;
}

/** The tablet's way from the chamber to where it is caught. Tub frame, metres. */
export interface TabletPath {
  /** The points it passes: where it leaves the chamber, then straight down to the landing. */
  readonly points: readonly Vec3[];
  readonly caughtBy: 'tray' | 'basket';
  readonly basketId: string;
  /** Plan extent of the tray or basket that is to catch it. */
  readonly target: { readonly x: Range; readonly y: Range };
  /** Horizontal distance by which the drop line misses the target, metres (0: inside). */
  readonly miss: number;
}

/** Everything the loading layer can ask of the machine besides its shapes. */
export interface MachineAffordances {
  readonly tineRows: readonly TineRowAffordance[];
  readonly cupShelves: readonly CupShelfZone[];
  readonly holders: readonly HolderZone[];
  /** The sloped rests along the side walls of the baskets (none on a flat floor). */
  readonly sideRests: readonly SideRestZone[];
  readonly cutleryCells: readonly CutleryCell[];
  /** The cutlery basket as it stands, or null when the machine has none or it is taken out. */
  readonly cutleryBasket: CutleryBasketAffordance | null;
  readonly baskets: readonly BasketEnvelope[];
  readonly armSweeps: readonly ArmSweptVolume[];
  /** Null when the machine's lid needs no room (never the case: a sliding lid has its travel). */
  readonly dispenserLid: LidSweptVolume;
  readonly tabletPath: TabletPath;
}

// ---------------------------------------------------------------------------------------------
// The whole machine
// ---------------------------------------------------------------------------------------------

/** Open fractions and counts the water model and the loading physics need. */
export interface MachineGeometryProperties {
  /** Open fraction of the lattice walls of the cutlery basket, 0 to 1; null without a basket. */
  readonly cutleryBasketWallOpenFraction: number | null;
  /** Open fraction of its lattice floor. */
  readonly cutleryBasketFloorOpenFraction: number | null;
  /** How the two fractions are known. */
  readonly cutleryBasketOpenFractionTag: ProvenanceTag;
  /** Number of capsules of each basket's wire structure, by basket id. */
  readonly capsulesByBasket: Readonly<Record<string, number>>;
  /** Number of primitives of every part, by part id. */
  readonly primitivesByPart: Readonly<Record<string, number>>;
}

/** A value the generator had to supply because the specification does not give it. */
export interface GeometryAssumption {
  /** Short stable name, for example `tine_ball_ratio`. */
  readonly id: string;
  /** The value, in SI units or as a ratio. */
  readonly value: number;
  readonly tag: ProvenanceTag;
  /** What it is, why this value, and what it affects. */
  readonly note: string;
}

/**
 * The machine as geometry. Structurally a superset of the `MachineGeometry` stand-in of
 * `@spotless/sim-scene` (parts with id, role, shape, pose and the hinge of an arm).
 */
export interface MachineGeometry {
  /** Id of the machine the geometry was built from. */
  readonly machineId: string;
  /** The configuration it was built for, with every default filled in. */
  readonly config: MachineConfig;
  /** The parts in a fixed order: tub parts, then baskets from the lowest, then spray levels. */
  readonly parts: readonly MachinePart[];
  readonly affordances: MachineAffordances;
  readonly properties: MachineGeometryProperties;
  /** Values the generator supplied itself. */
  readonly assumptions: readonly GeometryAssumption[];
  /** What the generated geometry leaves out or simplifies, in words. */
  readonly simplifications: readonly string[];
}
