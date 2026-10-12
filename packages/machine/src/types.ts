/**
 * The machine specification: a complete, serialisable description of one dishwasher.
 *
 * `MachineSpec` is data, following docs/research/machine.md section 12.1 and the fields that
 * docs/research/machine-bosch-smv4hax40g.md section 3.6 adds to it. It is what
 * `loadMachineSpec` returns from an authoring definition (`MachineDef`, `def.ts`), and it is
 * what the geometry generator, the lumped hydraulics and the programme expansion consume.
 *
 * Units. SI throughout (docs/design/platform.md section 2): metres, kilograms, seconds, radians,
 * newtons, pascals, watts, joules, cubic metres, cubic metres per second, degrees Celsius. A
 * field that is not SI says so in its name; the only such fields are pump speeds in revolutions
 * per minute (`...Rpm`), because only the ratio to the rated speed enters the model.
 *
 * Frames (platform.md section 2), all right-handed with z up:
 * - Tub frame `T`: origin on the lower spray-arm axis at tub-floor level, +x to the right seen
 *   facing the open machine, +y towards the back, +z up; the door is at negative y. Each machine
 *   says in `tub.floorDatum` which surface its z = 0 is.
 * - Rack frames (`lower_rack`, `upper_rack`, `third_rack`): origin at the front-left corner of
 *   the basket's outer plan rectangle, at the top surface of the base grid; axes parallel to `T`
 *   when the basket is pushed in. Every basket-local coordinate in a `BasketSpec` is in its rack
 *   frame, so x runs from 0 to the outer width and y from 0 (front) to the outer depth.
 * - Arm frame: the "+" blade of a spray arm points along the arm angle; see `kinematics.ts`.
 *
 * Every group of values carries a `provenance` record (`provenance.ts`). All types are plain
 * read-only data and survive `JSON.stringify` / `JSON.parse` unchanged.
 */

import type { Vec3 } from '@spotless/core';
import type { ProgrammeSpec } from './programme-types.ts';
import type { Provenance, ProvenanceTag } from './provenance.ts';

// ---------------------------------------------------------------------------------------------
// Small shared types
// ---------------------------------------------------------------------------------------------

/** A closed interval `[min, max]`; the unit is that of the field holding it. */
export type Range = readonly [min: number, max: number];

/** A point or size in the horizontal plane `[x, y]`, metres unless the field says otherwise. */
export type Vec2 = readonly [x: number, y: number];

/** One of the four horizontal axis directions of a frame. */
export type HorizontalDirection = '+x' | '-x' | '+y' | '-y';

/** One of the two horizontal axes of a frame. */
export type HorizontalAxis = 'x' | 'y';

/** A side of a basket or of the tub seen from the front: the door is at the front. */
export type Side = 'front' | 'rear' | 'left' | 'right';

/** Name of a rack frame (platform.md section 2). */
export type RackFrameId = 'lower_rack' | 'upper_rack' | 'third_rack';

// ---------------------------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------------------------

/** What the machine is: maker, model and the rated figures printed for it. */
export interface MachineIdentity {
  /** Maker, for example `Robert Bosch Hausgeraete GmbH`. */
  readonly maker: string;
  /** Model designation as sold (E-Nr. for BSH machines). */
  readonly model: string;
  /** Type code, platform and production data as far as known; free text. */
  readonly variant: string;
  /** Rated capacity in place settings (EN 60436). */
  readonly placeSettings: number;
  /** Outer size of the appliance: width (x), depth (y), height (z), metres. */
  readonly outerSize: Vec3;
  /** Rated electrical power range `[min, max]` over the rated voltage range, watts. */
  readonly ratedPower: Range;
  /** Rated voltage range `[min, max]`, volts. */
  readonly ratedVoltage: Range;
  /** Voltage the heater power of `ThermalSpec` refers to, volts. */
  readonly nominalVoltage: number;
  readonly provenance: Provenance;
}

// ---------------------------------------------------------------------------------------------
// Tub, door, sump, filters, floor and wall features
// ---------------------------------------------------------------------------------------------

/** The wash chamber: an open-fronted box closed by the door liner. Tub frame, metres. */
export interface TubSpec {
  /** Inner faces of the left and right walls, x. */
  readonly x: Range;
  /** Front flange plane (where the door seals) and inner face of the rear wall, y. */
  readonly y: Range;
  /** Floor datum and roof, z. */
  readonly z: Range;
  /** Which surface z = 0 is on this machine (the frame convention says "tub-floor level"). */
  readonly floorDatum: string;
  /** Radius of the vertical corners between walls, metres. */
  readonly verticalCornerRadius: number;
  /** Mean slope of the floor towards the sump, radians. */
  readonly floorSlope: number;
  /** Shape of the floor pressing in words, where no dimensions are known. */
  readonly floorDescription: string;
  /**
   * Height of the ledges along the side walls on which the wheels of the lowest basket run,
   * z in the tub frame, metres; null when the machine has none or it is not known.
   */
  readonly wheelLedgeZ: number | null;
  /** Catalogue material id of the tub and the inner door. */
  readonly material: string;
  readonly provenance: Provenance;
}

/** The door and its inner liner. Tub frame, door closed unless stated. Metres and radians. */
export interface DoorSpec {
  /** y of the plane of the tub's front flange. */
  readonly flangePlaneY: number;
  /**
   * y of the inner face of the door liner with the door closed. At or in front of the flange
   * plane: the liner may be recessed, and baskets and spray arms may reach into the recess.
   */
  readonly linerPlaneY: number;
  /** The hinge axis is parallel to x; its y and z in the tub frame. */
  readonly hingeAxis: { readonly y: number; readonly z: number };
  /** Angle the door turns through from closed to fully open, radians. */
  readonly openAngle: number;
  /** Width (x) and height (z) of the inner door pressing, metres; null if not known. */
  readonly linerSize: Vec2 | null;
  /** Height of the door opening from the sill to the roof, metres; null if not known. */
  readonly openingHeight: number | null;
  readonly provenance: Provenance;
}

/** The sump well under the floor from which both pumps draw. Tub frame, SI. */
export interface SumpSpec {
  /** (x, y) of the axis of the sump well, which is the axis of the filter cylinder. */
  readonly centre: Vec2;
  /** Diameter of the well (of its flange where that is what is known), metres. */
  readonly diameter: number;
  /** Depth of the well below the floor datum, metres. */
  readonly depth: number;
  /** Volume of water the well holds in normal operation, m^3. */
  readonly workingVolume: number;
  /** Water left in the sump, pump and hoses after a normal drain, m^3. */
  readonly residueAfterDrain: number;
  readonly provenance: Provenance;
}

/** Arrangement of the perforations of a filter sheet. */
export type PerforationLattice = 'hex' | 'square';

/** The flat fine filter: a perforated sheet in the tub floor. Tub frame, SI. */
export interface FlatFilterSpec {
  /** Extent of the plate along x. */
  readonly x: Range;
  /** Extent of the plate along y. */
  readonly y: Range;
  /** Diameter of the round opening the filter cylinder passes through, metres; null if none. */
  readonly openingDiameter: number | null;
  /** Diameter of one perforation, metres. */
  readonly holeDiameter: number;
  /** Centre-to-centre pitch of the perforations, metres; null if not known. */
  readonly holePitch: number | null;
  /** Lattice of the perforations; null if not known. */
  readonly lattice: PerforationLattice | null;
  /** Open fraction of the perforated sheet, 0 to 1. */
  readonly openFraction: number;
  /** Total open area of the plate, m^2. */
  readonly openArea: number;
  readonly provenance: Provenance;
}

/** A perforated cover over the sump around the lower-arm stem, in parallel with the flat filter. */
export interface SumpCoverSpec {
  /** Overall size of the cover: width (x) and depth (y), metres. */
  readonly size: Vec2;
  /** Extent of the cover along y in the tub frame. */
  readonly y: Range;
  /** Diameter of one perforation, metres. */
  readonly holeDiameter: number;
  /** Centre-to-centre pitch of the perforations, metres. */
  readonly holePitch: number;
  /** Total open area, m^2. */
  readonly openArea: number;
  readonly provenance: Provenance;
}

/** The coarse filter: the removable insert that catches large debris. SI. */
export interface CoarseFilterSpec {
  /** Largest outer diameter of the insert (its flange where it has one), metres. */
  readonly diameter: number;
  /** Overall length of the insert along its axis, metres. */
  readonly length: number;
  /** Width of its openings, metres: what is larger stays on top. */
  readonly opening: number;
  /** Diameter of the crown that stands above the floor, metres; null if it has none. */
  readonly crownDiameter: number | null;
  /** Tub-frame z of the top of the crown, metres; null if it has none. */
  readonly crownTopZ: number | null;
  readonly provenance: Provenance;
}

/** The micro filter: the fine mesh around the coarse filter. SI. */
export interface MicroFilterSpec {
  /** Diameter of the mesh cylinder, metres; null if not known. */
  readonly diameter: number | null;
  /** Height of the mesh cylinder, metres; null if not known. */
  readonly height: number | null;
  /** Ratio of mesh area to the area of the plain cylinder (1 for an unpleated mesh). */
  readonly pleatFactor: number;
  /** Mesh opening, metres. */
  readonly mesh: number;
  /** Mesh area, m^2. */
  readonly area: number;
  /** Open fraction of the mesh, 0 to 1. */
  readonly openFraction: number;
  readonly provenance: Provenance;
}

/**
 * The three-part filter combination under the lower arm (machine.md section 5.2): flat fine
 * filter, coarse filter and micro filter, plus the perforated sump cover where the machine has
 * one. Water returning to the pump passes the flat filter or the cover directly, or passes
 * through the micro filter; what stays inside the micro cylinder goes to the drain.
 */
export interface FilterSpec {
  /** (x, y) of the axis of the filter cylinder in the tub frame, metres. */
  readonly axis: Vec2;
  readonly flatPlate: FlatFilterSpec;
  readonly sumpCover: SumpCoverSpec | null;
  readonly coarse: CoarseFilterSpec;
  readonly micro: MicroFilterSpec;
}

/** The screw cap of the salt container in the tub floor. Tub frame, metres. */
export interface SaltCapSpec {
  /** (x, y) of the centre of the cap. */
  readonly centre: Vec2;
  /** Diameter of the cap. */
  readonly diameter: number;
  /** z of the top of the cap. */
  readonly topZ: number;
  readonly provenance: Provenance;
}

/** A pressing in the tub floor that is not an opening. Tub frame, metres. */
export type FloorFeatureSpec =
  | {
      /** Parallel beads pressed into the floor. */
      readonly kind: 'beads';
      readonly id: string;
      /** Extent of the group along x. */
      readonly x: Range;
      /** Extent of the group along y. */
      readonly y: Range;
      /** Number of beads in the group. */
      readonly count: number;
      /** Length of one bead. */
      readonly length: number;
      /** Centre-to-centre pitch of the beads. */
      readonly pitch: number;
      readonly provenance: Provenance;
    }
  | {
      /** A round dish pressed into the floor. */
      readonly kind: 'dish';
      readonly id: string;
      readonly centre: Vec2;
      readonly diameter: number;
      readonly provenance: Provenance;
    };

/**
 * The vertical feed duct on the rear wall that carries water from the sump to the upper spray
 * levels. It stands proud of the wall, so it is an obstacle behind the baskets. Tub frame,
 * metres.
 */
export interface FeedDuctSpec {
  /** Part number, where known. */
  readonly part: string | null;
  /** Extent of the riser's front face along x. */
  readonly riserX: Range;
  /** How far the riser stands proud of the rear wall. */
  readonly riserProud: number;
  /** How far the block of docking ports stands proud of the rear wall. */
  readonly portBlockProud: number;
  /** z of the lower ends of the stubs that plug into the sump cover. */
  readonly stubEndZ: number;
  /** y of the floor stubs, where the foot of the duct meets the sump cover; null if not known. */
  readonly stubY: number | null;
  /** z of the centres of the docking ports for the upper arm, lowest first. */
  readonly portZ: readonly number[];
  /** z of the top of the duct, where it turns under the roof. */
  readonly topZ: number;
  /** Number of separate water channels in the duct. */
  readonly channels: number;
  readonly provenance: Provenance;
}

/** A wall or the roof of the tub. */
export type TubSurface = 'left' | 'right' | 'rear' | 'roof' | 'floor';

/**
 * Something on or in a wall of the tub: a grille, a fitting, an embossed panel, a guide rail.
 * Sizes and positions are given where they are known; `description` always says what it is.
 */
export interface WallFeatureSpec {
  readonly id: string;
  readonly surface: TubSurface;
  readonly kind: 'grille' | 'fitting' | 'embossed_panel' | 'guide_rail' | 'other';
  readonly description: string;
  /** Size in the plane of the surface (first along y or x, then along z or y), metres. */
  readonly size: Vec2 | null;
  /**
   * Where it is on its surface, tub frame, metres: its extent along the wall (y for a side
   * wall, x for the rear wall) and in height. Null when its position is not recorded; such a
   * feature is not drawn. Only side-wall and rear-wall features can be placed.
   */
  readonly position: { readonly along: Range; readonly z: Range } | null;
  /** How far it stands proud of the surface, metres; 0 for a pressing. */
  readonly proud: number;
  /** Number of such features on the surface. */
  readonly count: number;
  readonly provenance: Provenance;
}

// ---------------------------------------------------------------------------------------------
// Dispenser and drying hardware
// ---------------------------------------------------------------------------------------------

/**
 * How the lid of the detergent chamber opens:
 * - `slides`: a flat cover sliding in the plane of the door; nothing swings into the tub;
 * - `swings`: a lid hinged at one edge that swings into the tub through `angle`, sweeping a
 *   volume `keepOutDepth` deep in front of the liner.
 */
export type DispenserLidSpec =
  | {
      readonly kind: 'slides';
      /** Direction the lid slides to open, door closed. */
      readonly direction: 'up' | 'down' | 'left' | 'right';
    }
  | {
      readonly kind: 'swings';
      /** Edge of the lid that carries the hinge. */
      readonly hingeEdge: 'bottom' | 'top' | 'left' | 'right';
      /** Angle the lid swings through, radians. */
      readonly angle: number;
    };

/** Where a tablet goes when the chamber opens. */
export type TabletTarget =
  | {
      /** It is caught by the collecting tray of a basket. */
      readonly kind: 'basket_tray';
      readonly basketId: string;
    }
  | {
      /** It falls into a basket (onto its load or its floor). */
      readonly kind: 'basket';
      readonly basketId: string;
    };

/** The combined detergent and rinse-aid dispenser on the inner door. Tub frame, door closed. */
export interface DispenserSpec {
  /** Part number, where known. */
  readonly part: string | null;
  /** Size of the unit: width (x), height (z), depth (y), metres; null if not known. */
  readonly unitSize: Vec3 | null;
  /** Centre of the opening of the detergent chamber on the liner plane, metres. */
  readonly chamberCentre: Vec3;
  /** Width (x) and height (z) of the chamber opening, metres. */
  readonly chamberSize: Vec2;
  readonly lid: DispenserLidSpec;
  /** Depth in front of the liner that the opening lid sweeps, metres (0 for a sliding lid). */
  readonly keepOutDepth: number;
  /** Fill marks of the detergent chamber, m^3. */
  readonly fillMarks: readonly number[];
  /**
   * Where a tablet leaves the chamber when the lid opens (the lower lip of the chamber
   * opening), tub frame, metres. From there it falls.
   */
  readonly tabletExit: Vec3;
  readonly tabletTarget: TabletTarget;
  /** Rinse-aid outlet on the liner plane, tub frame, metres. */
  readonly rinseAidOutlet: Vec3;
  /** Capacity of the rinse-aid reservoir, m^3; null if not known. */
  readonly rinseAidReservoir: number | null;
  /** Volume of rinse aid delivered per actuation pulse, m^3; null if dosed in one go. */
  readonly rinseAidPerPulse: number | null;
  readonly provenance: Provenance;
}

/**
 * A water tank against the outside of a side wall. It chills the wall to condense moisture in
 * drying, and on some machines pre-stores and pre-warms the next bath. A field is null when
 * the dossier of the machine does not give it.
 */
export interface HeatExchangerSpec {
  /** Part number, where known. */
  readonly part: string | null;
  /** The side wall it lies against. */
  readonly wall: 'left' | 'right';
  /** Extent along y and along z, metres. */
  readonly size: Vec2 | null;
  /** Thickness perpendicular to the wall, metres. */
  readonly thickness: number | null;
  /** Water content when full, m^3. */
  readonly volume: number | null;
  /** Thermal conductance between the tub wall (machine node) and a full tank, W/K. */
  readonly wallConductance: number | null;
  readonly provenance: Provenance;
}

/** How the machine dries the load. */
export type DryingMethod =
  | 'residual_heat'
  | 'heat_exchanger_condensation'
  | 'heat_exchanger_plus_auto_open'
  | 'auto_open'
  | 'fan'
  | 'zeolite'
  | 'heat_pump'
  | 'heated';

/** The drying hardware and its fixed behaviour. SI. */
export interface DryingSpec {
  readonly method: DryingMethod;
  readonly heatExchanger: HeatExchangerSpec | null;
  /** Automatic door opening, or null when the door stays closed throughout. */
  readonly autoOpen: {
    /** Time into the drying step at which the door opens, seconds. */
    readonly after: number;
    /** Gap at the inside top edge of the door, metres. */
    readonly gap: number;
  } | null;
  /** Whether a fan moves tub air. */
  readonly fan: boolean;
  /** Length of a drying step whose `duration` is null, seconds. */
  readonly defaultDuration: number;
  readonly provenance: Provenance;
}

// ---------------------------------------------------------------------------------------------
// Baskets
// ---------------------------------------------------------------------------------------------

/** Diameter of a wire with and without its coating, metres. */
export interface WireSize {
  /** Finished diameter over the coating: the size the geometry is built with. */
  readonly coated: number;
  /** Diameter of the bare steel wire. */
  readonly steel: number;
}

/** The wire sizes of a basket. Metres. */
export interface BasketWiresSpec {
  /** Rim and frame wires. */
  readonly rim: WireSize;
  /** Floor and wall wires. */
  readonly floor: WireSize;
  /** Tines. */
  readonly tine: WireSize;
  /** Thickness of the coating, metres. */
  readonly coating: number;
  readonly provenance: Provenance;
}

/** Shape of one corner of a basket outline in plan. Metres. */
export type CornerSpec =
  | { readonly kind: 'square' }
  | {
      readonly kind: 'round';
      /** Radius of the rim centre line at the corner. */
      readonly radius: number;
    }
  | {
      /**
       * A straight cut across the corner: the outline leaves the side `dy` from the corner
       * (along y) and joins the front or rear edge `dx` from the corner (along x).
       */
      readonly kind: 'chamfer';
      readonly dx: number;
      readonly dy: number;
    };

/** A stretch of one side of the outline that is set inward (for example to clear the riser). */
export interface OutlineRecessSpec {
  readonly side: Side;
  /**
   * Extent of the fully set-in stretch along the side: x for the front and rear sides, y for
   * the left and right sides, rack frame, metres.
   */
  readonly span: Range;
  /** How far the stretch is set towards the inside of the basket, metres. */
  readonly depth: number;
  /** Length of the ramp at each end of the stretch, along the side, metres. */
  readonly ramp: number;
}

/** The plan outline of a basket. Rack frame, metres. */
export interface BasketOutlineSpec {
  /** Outer size over the rim wires: width along x and depth along y. */
  readonly size: Vec2;
  /** Size of the rectangle of rim wire centre lines: width and depth. */
  readonly rimCentres: Vec2;
  readonly corners: {
    readonly frontLeft: CornerSpec;
    readonly frontRight: CornerSpec;
    readonly rearLeft: CornerSpec;
    readonly rearRight: CornerSpec;
  };
  readonly recesses: readonly OutlineRecessSpec[];
}

/** One height position of a basket. */
export interface BasketHeightPosition {
  /** Id used in `MachineConfig.basketHeights`. */
  readonly id: string;
  /** The maker's name for the position (`1` is the highest on the Bosch). */
  readonly label: string;
  /** Tub-frame z of the rack-frame origin (the top surface of the base grid), metres. */
  readonly originZ: number;
}

/** Where a basket sits in the tub and how it moves. */
export interface BasketPoseSpec {
  /** Tub-frame (x, y) of the rack-frame origin with the basket pushed in, metres. */
  readonly originXY: Vec2;
  /** The height positions; one entry for a basket that cannot be adjusted, highest first. */
  readonly heightPositions: readonly BasketHeightPosition[];
  /** Whether the two sides can be set to different positions (a tilted basket). */
  readonly canTilt: boolean;
  /** Unit direction in the tub frame along which the basket is pulled out. */
  readonly travelDirection: Vec3;
  /** How far it can be pulled out from the pushed-in position, metres. */
  readonly travel: number;
  readonly provenance: Provenance;
}

/** One wall of a basket: its horizontal wires and its uprights. Rack frame, metres. */
export interface BasketWallSpec {
  readonly side: Side;
  /**
   * Centre heights of the horizontal wires of the wall above the rack-frame origin, lowest
   * first. The last one is the rim on that side.
   */
  readonly horizontalWireZ: readonly number[];
  /**
   * Position of each upright along the wall: x for the front and rear walls, y for the side
   * walls. Each runs from the lowest horizontal wire to the rim.
   */
  readonly uprights: readonly number[];
}

/** One family of parallel floor wires of a basket. Rack frame, metres. */
export interface FloorWireFamilySpec {
  /** Coordinate of each wire across its run (x for wires running along y), ascending. */
  readonly positions: readonly number[];
  /** Nominal centre-to-centre pitch where the wires are evenly spaced; null otherwise. */
  readonly pitch: number | null;
  /** Height of the wire centres relative to the rack-frame origin (negative: below the top). */
  readonly z: number;
  /** Extent of the wires along their run. */
  readonly span: Range;
  /**
   * Raised stretches: between `from` and `to` along the run every wire of the family rises by
   * `rise` (a hump for cups).
   */
  readonly humps: readonly { readonly from: number; readonly to: number; readonly rise: number }[];
  /**
   * Largest sideways crank of a wire of this family, metres; 0 for straight wires. The cranks
   * are not located: the wires are drawn straight at `positions`.
   */
  readonly crank: number;
}

/**
 * The relief of a basket floor that is not flat: the whole base grid is raised by a height that
 * varies along one horizontal axis of the rack frame (troughs and ridges running the length of
 * the basket). Metres.
 */
export interface FloorReliefSpec {
  /** The axis along which the height varies: `x` for ridges that run front to back. */
  readonly axis: HorizontalAxis;
  /**
   * The profile: the rise above the datum (trough) level at ascending positions along `axis`,
   * linear between them and constant beyond the first and the last. At least one point has a
   * rise of 0: that level is the datum the heights of the basket are given from. A part of the
   * floor that lies below it has a negative rise.
   */
  readonly points: readonly { readonly at: number; readonly rise: number }[];
}

/** The base grid of a basket: two families of crossing wires. */
export interface BasketFloorSpec {
  /** Wires running front to back (along y), listed by their x. */
  readonly alongY: FloorWireFamilySpec;
  /** Wires running left to right (along x), listed by their y. */
  readonly alongX: FloorWireFamilySpec;
  /**
   * Which family lies on top; its upper surface, where the relief is zero, is the rack frame's
   * z = 0.
   */
  readonly upperLayer: 'alongX' | 'alongY';
  /**
   * The relief of the floor, or null for a flat one. The wires of the family that runs along
   * its axis follow the profile; each wire of the other family is raised by the profile's value
   * at its position. `FloorWireFamilySpec.z` is the height where the relief is zero. Use
   * `floorRiseAt` for the rise at a point.
   */
  readonly relief: FloorReliefSpec | null;
  /** Largest opening of the floor, (x, y), metres: what is smaller can fall through. */
  readonly largestOpening: Vec2;
  readonly provenance: Provenance;
}

/** How a hinged tine row folds. */
export interface TineRowHingeSpec {
  /** Direction the tine tips move towards when the row is folded down, rack frame. */
  readonly foldsToward: HorizontalDirection;
  /** Angle the row turns about its rail from upright to folded, radians. */
  readonly foldAngle: number;
  /** Where the release is and how it is worked, in words. */
  readonly release: string;
}

/**
 * One row of tines: a rail with tines standing on it. Rack frame, metres and radians.
 *
 * A tine of this row whose base is at `tinePositions[i]` along the run stands on the rail at
 * height `railZ` and ends at `base + (height / cos(lean)) * (sin(lean) * d + cos(lean) * z)`,
 * where `d` is the unit vector of `leanToward[i]`.
 */
export interface TineRowSpec {
  /** Id unique within the basket, a valid lower-case identifier (`r1`). */
  readonly id: string;
  /** The dossier's name for the row (`R1`). */
  readonly label: string;
  /** Axis along which the rail runs. Plates stand across it. */
  readonly runs: HorizontalAxis;
  /** Coordinate of the rail on the other horizontal axis (y for a row running along x). */
  readonly railAt: number;
  /** Height of the rail centre above the rack-frame origin. */
  readonly railZ: number;
  /** The two ends of the rail along its run. */
  readonly railSpan: Range;
  /** Position of each tine base along the run, ascending. */
  readonly tinePositions: readonly number[];
  /** For each tine, the horizontal direction it leans towards (ignored where `lean` is 0). */
  readonly leanToward: readonly HorizontalDirection[];
  /** Nominal centre-to-centre pitch of the tines. */
  readonly pitch: number;
  /** Vertical height of the tine tips above the rail centre. */
  readonly height: number;
  /** Lean of the tines from the vertical, radians. */
  readonly lean: number;
  /** Finished diameter of the tine wire. */
  readonly wireDiameter: number;
  /** `ball`: a ball end larger than the wire; `round`: a hemispherical end. */
  readonly tip: 'ball' | 'round';
  /** `straight`: one wire per tine; `hairpin`: a narrow wire loop per tine. */
  readonly form: 'straight' | 'hairpin';
  /** The hinge, or null for a fixed row. */
  readonly hinge: TineRowHingeSpec | null;
  /** State of the row in the default configuration. Always `up` for a fixed row. */
  readonly defaultState: 'up' | 'folded';
  readonly provenance: Provenance;
}

/** The wheels or rollers a basket runs on. Rack frame, metres. */
export interface WheelSetSpec {
  /** Total number of wheels (half on each side). */
  readonly count: number;
  readonly diameter: number;
  /** y of each wheel station; the same stations on both sides. */
  readonly stationsY: readonly number[];
  /** Distance between the mid-planes of the left and right wheels. */
  readonly track: number;
  /** Height of the wheel axles above the rack-frame origin (negative: below). */
  readonly axleZ: number;
  readonly provenance: Provenance;
}

/** A handle on the front of a basket. Rack frame, metres. */
export interface BasketHandleSpec {
  /** Part number, where known. */
  readonly part: string | null;
  /** Size: width (x), depth (y), height (z). */
  readonly size: Vec3;
  /** x of its centre; it hangs on the front rim. */
  readonly centreX: number;
  readonly provenance: Provenance;
}

/**
 * The tablet collecting tray on a basket: an open-topped slotted trough that catches the tablet
 * falling from the dispenser and is sprayed from below. Rack frame, metres.
 */
export interface TabletTraySpec {
  /** Part number, where known. */
  readonly part: string | null;
  /** Size: width (x), depth (y), height (z). */
  readonly size: Vec3;
  /** (x, y) of the centre of the trough. */
  readonly centre: Vec2;
  /** Height of its rim above the rack-frame origin. */
  readonly rimZ: number;
  /**
   * Height of the top of its front wall above the rack-frame origin, where that wall (the bar
   * that is the basket's handle) stands lower than the rim; absent when it is as high as the rim.
   */
  readonly frontRimZ?: number;
  /** Whether its floor is slotted, so that it drains and can be sprayed from below. */
  readonly slotted: boolean;
  readonly provenance: Provenance;
}

/** A folding shelf for cups along a side wall of a basket. Rack frame, metres. */
export interface CupShelfSpec {
  /** Id unique within the basket. */
  readonly id: string;
  /** Part number, where known. */
  readonly part: string | null;
  /** The wall it hangs on. */
  readonly side: 'left' | 'right';
  /** Size: length along y, width towards the inside of the basket (x), thickness (z). */
  readonly size: Vec3;
  /** y of the front and rear end of the shelf. */
  readonly y: Range;
  /** Height of the shelf plane above the rack-frame origin when it is lowered into use. */
  readonly heightAboveGrid: number;
  /**
   * How far the pins it turns about lie from its edge at the wall, towards the inside of the
   * basket, metres; they are under its underside. Folded up, its underside stands that far
   * from the wall, facing the inside of the basket, with that much of its width hanging below
   * the underside of the lowered shelf. Absent: it turns about the edge of its top surface at
   * the wall and stands flat against the wall.
   */
  readonly pivotInset?: number;
  /** Number of notches for stemware along its free edge. */
  readonly stemwareNotches: number;
  /**
   * State in the default configuration: `down` lowered into use (horizontal), `up` folded up
   * against the wall out of the way.
   */
  readonly defaultState: 'up' | 'down';
  readonly provenance: Provenance;
}

/** A plastic holder fixed to a basket (a knife shelf, a glass holder). Rack frame, metres. */
export interface HolderSpec {
  /** Id unique within the basket. */
  readonly id: string;
  readonly kind: 'knife_shelf' | 'glass_holder' | 'clip' | 'other';
  /** Part number, where known. */
  readonly part: string | null;
  readonly description: string;
  /** The wall it lies along. */
  readonly side: Side;
  /** Size: length along the wall, width towards the inside of the basket, height. */
  readonly size: Vec3;
  /** Extent along x. */
  readonly x: Range;
  /** Extent along y. */
  readonly y: Range;
  /** Height of its floor above the rack-frame origin; null if not known. */
  readonly floorZ: number | null;
  /** Mass, kg. */
  readonly mass: number;
  /**
   * Height above the rack-frame origin of the line a folding holder turns about, where the
   * folded holder does not turn about the top of its own floor: folded up, it stands with the
   * wall-side edge of its floor at this height. Absent: it turns about the top of its floor.
   */
  readonly foldHingeZ?: number;
  /** Whether it folds up out of the way. */
  readonly folds: boolean;
  /** State in the default configuration (`down`: in use). */
  readonly defaultState: 'up' | 'down';
  readonly provenance: Provenance;
}

/**
 * The cutlery tray form of a top-level basket (machine.md section 2.4.2, "third rack"): shallow
 * side sections with tine combs and a lowered centre section. Metres and radians.
 */
export interface CutleryTraySpec {
  /** Depth of the side sections below the top edge. */
  readonly sideDepth: number;
  /** Depth of the deepest point of the centre section below the top edge. */
  readonly centreDepth: number;
  /** Tilt of the centre section. */
  readonly centreTilt: number;
  /** Gaps between the tines of the combs, widest first. */
  readonly combGaps: readonly number[];
}

/** The manufacturer's printed loading limits of a basket. Metres. */
export interface BasketLimitsSpec {
  /**
   * Largest plate or item diameter, keyed by the id of the height position of the adjustable
   * basket (for a basket that is itself adjustable: its own position).
   */
  readonly maxDiameterByPosition: Readonly<Record<string, number>>;
  /** Basket whose height position the keys refer to. */
  readonly positionOfBasket: string;
  /** A larger size that fits in one stated arrangement only, or null. */
  readonly maxDiameterAsShown: {
    readonly diameter: number;
    readonly positionId: string;
    readonly where: string;
  } | null;
  /**
   * How large a plate can stand in a stated way, by the dossier's reading of the geometry: up
   * to `maxDiameter` it stands as `where` says, above that it stands differently.
   */
  readonly seating: readonly { readonly where: string; readonly maxDiameter: number }[];
  readonly provenance: Provenance;
}

/**
 * One basket (rack). Every coordinate is in the basket's rack frame: origin at the front-left
 * corner of its outer plan rectangle at the top surface of the base grid, metres.
 */
export interface BasketSpec {
  /** Id unique within the machine (`lower`, `upper`, `third`). */
  readonly id: string;
  readonly level: 'lower' | 'upper' | 'third';
  /** Name of its rack frame. */
  readonly frame: RackFrameId;
  /** `wire`: an ordinary wire basket; `cutlery_tray`: a shallow tray under the roof. */
  readonly kind: 'wire' | 'cutlery_tray';
  /** Part number, where known. */
  readonly part: string | null;
  /** Catalogue material id of its wires. */
  readonly material: string;
  readonly outline: BasketOutlineSpec;
  /** Provenance of the outline and of the walls (rim heights, wall wires, uprights). */
  readonly provenance: Provenance;
  readonly pose: BasketPoseSpec;
  readonly wires: BasketWiresSpec;
  /** The four walls. */
  readonly walls: readonly BasketWallSpec[];
  readonly floor: BasketFloorSpec;
  readonly tineRows: readonly TineRowSpec[];
  readonly wheels: WheelSetSpec | null;
  readonly handle: BasketHandleSpec | null;
  readonly tabletTray: TabletTraySpec | null;
  readonly cupShelves: readonly CupShelfSpec[];
  readonly holders: readonly HolderSpec[];
  readonly tray: CutleryTraySpec | null;
  /** Mass of the empty basket, kg. */
  readonly mass: number;
  readonly limits: BasketLimitsSpec | null;
}

/** Where the cutlery basket stands. Rack frame of the basket it stands in. */
export interface CutleryBasketPlacement {
  /** Id of the basket it stands in. */
  readonly basketId: string;
  /** (x, y) of the centre of its body, metres. */
  readonly centre: Vec2;
  /** Axis of the rack frame its long side lies along. */
  readonly longAxis: HorizontalAxis;
}

/**
 * One place the loose cutlery basket can be stood in the machine: a named placement, how it is
 * known and why it is allowed there.
 */
export interface CutleryBasketPosition {
  /** Id unique within the machine, a valid lower-case identifier (`front_centre`). */
  readonly id: string;
  /** Name for display. */
  readonly label: string;
  readonly placement: CutleryBasketPlacement;
  /** `photo` for a position seen in a photograph of the machine, `estimated` otherwise. */
  readonly tag: ProvenanceTag;
  /** Where the position comes from and what holds the basket there, in words. */
  readonly note: string;
}

/** The free-standing cutlery basket. Its own dimensions are in metres. */
export interface CutleryBasketSpec {
  /** Part number, where known. */
  readonly part: string | null;
  /** Catalogue material id. */
  readonly material: string;
  /** Body size: length (long side), width, height. */
  readonly size: Vec3;
  /** Width over the lid grids when they hang folded out; equal to the body width if no lids. */
  readonly widthOverLids: number;
  /** Height with the carrying handle up. */
  readonly heightWithHandle: number;
  /** Mass, kg. */
  readonly mass: number;
  /** Number of compartments. */
  readonly cells: number;
  /** Compartments across the width and along the length. */
  readonly cellGrid: readonly [across: number, along: number];
  /** Lengths of the sections along the long side, in order, where they are not equal. */
  readonly sectionsAlongLength: readonly number[];
  /** How the compartments are laid out, in words. */
  readonly layout: string;
  /** `flat`: one floor; `feet`: separate feet with tunnels between them. */
  readonly base: 'flat' | 'feet';
  /**
   * Tunnels across the basket between its feet, open below, through which tine rails pass; null
   * for a flat-based basket.
   */
  readonly tunnels: {
    readonly count: number;
    /** Offsets of the tunnel centres from the middle of the long side. */
    readonly centresFromMid: readonly number[];
    /** Clear width of a tunnel. */
    readonly clearWidth: number;
    /** Height of a tunnel above the plane of the feet. */
    readonly height: number;
  } | null;
  /** Openings of the lattice walls: width and height. */
  readonly wallOpening: Vec2;
  /** Slots of the lattice floor: width and length. Anything thinner pokes through. */
  readonly floorSlot: Vec2;
  /** The hinged lid grids, or null if none are fitted. */
  readonly lid: {
    /** Openings of the grid: round hole diameter and slot length. */
    readonly openings: Vec2;
    /** Whether the grids are folded over the compartments in the default configuration. */
    readonly inUse: boolean;
  } | null;
  /** Where it stands in the default configuration. */
  readonly defaultPlacement: CutleryBasketPlacement;
  /**
   * The named places it can be stood, the default one first. It is a loose part: any other
   * placement that `cutleryBasketPlacementProblems` accepts is as good; these are the ones a
   * player is offered by name.
   */
  readonly positions: readonly CutleryBasketPosition[];
  /** What locates it there, in words. */
  readonly locatedBy: string;
  readonly provenance: Provenance;
}

// ---------------------------------------------------------------------------------------------
// Spray levels
// ---------------------------------------------------------------------------------------------

/** Shape of a nozzle opening and the meaning of its `size`. */
export type NozzleShape =
  /** A round bore: `size` is `[diameter]`. */
  | 'round'
  /** A slot with semicircular ends (a stadium): `size` is `[length, width]`. */
  | 'slot'
  /** A rectangular opening: `size` is `[length, width]`. */
  | 'rect';

/**
 * One nozzle of a spray level (machine.md section 3.2). Lengths in metres, angles in radians.
 *
 * Directions are in the frame of the blade that carries the nozzle: `theta` is the azimuth of
 * the jet in the plane of the arm, 0 radially outward and +pi/2 trailing tangential (opposite
 * to the blade's direction of travel); `rho` is its elevation above that plane, +pi/2 straight
 * up and negative downward.
 */
export interface NozzleSpec {
  /** Id unique within the spray level, a valid lower-case identifier (`l8`). */
  readonly id: string;
  /** The dossier's name for the nozzle (`L8`). */
  readonly label: string;
  /** The blade that carries it: `+` the reference blade, `-` the opposite one, `axis` on the axis. */
  readonly blade: '+' | '-' | 'axis';
  /**
   * True when which blade carries the nozzle was not determined and `blade` is an assumption
   * (an opening on the underside, seen only from below).
   */
  readonly bladeAssumed: boolean;
  /** Distance from the rotation axis, metres. */
  readonly radius: number;
  readonly theta: number;
  readonly rho: number;
  /** The face of the arm the opening is in. */
  readonly face: 'top' | 'underside';
  readonly shape: NozzleShape;
  /** `[diameter]` for a round bore, `[length, width]` otherwise, metres. */
  readonly size: readonly number[];
  /** Geometric area of the opening, m^2 (derived from `shape` and `size`). */
  readonly area: number;
  /** Discharge coefficient C_d. */
  readonly cd: number;
  /** Velocity coefficient C_v: jet speed over the ideal speed sqrt(2 p / rho). */
  readonly cv: number;
  /** Whether its tangential thrust is what turns the arm. */
  readonly drives: boolean;
  /**
   * For an oblong opening (a slot or a rectangle): direction of its long axis in the plane of
   * the arm; the fan spreads along it. Null for a round bore, and for an oblong outlet whose
   * orientation is not recorded.
   */
  readonly slotAxis: 'radial' | 'tangential' | null;
  /**
   * For a slot whose fan has been characterised: the included fan angle (radians) and the
   * number of round sub-jets that represent it (docs/research/jets.md section 2.5). Null when
   * the machine's dossier gives neither; the jet model then applies its own defaults.
   */
  readonly fan: { readonly angle: number; readonly subJets: number } | null;
  /** What the opening looks like and what the jet is for (the dossier's wording). */
  readonly description: string;
}

/** What a spray level is fixed to, which decides what its heights are relative to. */
export type SprayMount =
  | {
      /** Fixed to the tub: its heights are z in the tub frame. */
      readonly kind: 'tub';
    }
  | {
      /**
       * Hangs under (or sits on) a basket and moves with its height position: its heights are
       * relative to that basket's rack-frame origin (negative below the base grid).
       */
      readonly kind: 'basket';
      readonly basketId: string;
    };

/** Fields common to every spray level. */
export interface SprayLevelBase {
  /** Id unique within the machine (`lower`, `upper`, `roof`); also the id of its branch. */
  readonly id: string;
  /** Name in words. */
  readonly name: string;
  /** Part number, where known. */
  readonly part: string | null;
  readonly mount: SprayMount;
  /** Tub-frame (x, y) of its rotation axis or outlet, with any carrying basket pushed in. */
  readonly axis: Vec2;
  readonly nozzles: readonly NozzleSpec[];
  /** Provenance of the nozzle table. */
  readonly nozzleProvenance: Provenance;
  readonly provenance: Provenance;
}

/** Bearing friction of a spray arm (machine.md section 3.3): T_f = k_f |F_ax| + c_v omega. */
export interface ArmBearingSpec {
  /** Effective friction radius times friction coefficient k_f, metres. */
  readonly frictionRadius: number;
  /** Viscous coefficient c_v, N m s. */
  readonly viscous: number;
  /**
   * Sign s of the jet reaction and the weight in the axial load
   * F_ax = p A_hub + s (F_jz + W): -1 for an arm standing on its bearing, which the pressure
   * lifts against its retainer; +1 for a hanging arm.
   */
  readonly thrustSign: -1 | 1;
  /** Bore of the hub on which the supply pressure acts, metres. */
  readonly hubBore: number;
}

/** The body of a spray arm as far as it is known. Metres and radians. */
export interface ArmShapeSpec {
  /** Number of blades. */
  readonly blades: number;
  /** Thickness of a blade, top face to underside. */
  readonly bladeThickness: number;
  /** Height of the hub, top face to its underside; null if not known. */
  readonly hubHeight: number | null;
  /** Diameter of the hub or its cap; null if not known. */
  readonly hubDiameter: number | null;
  /** Outer diameter of the stem; null if the arm has none or it is not known. */
  readonly stemDiameter: number | null;
  /** Width of a blade at the hub and at the tip; null if not known. */
  readonly bladeWidth: Range | null;
  /** Angle between the blade axis at the tip and the radial line, radians; 0 for a straight arm. */
  readonly tipSweep: number;
  /** The body in words. */
  readonly description: string;
}

/**
 * A rotating, reaction-driven spray arm. Heights (`...Z`) are tub-frame z, or relative to the
 * carrying basket's rack-frame origin, as `mount` says.
 */
export interface SprayArmSpec extends SprayLevelBase {
  readonly kind: 'arm';
  /** Radius swept by the blade tips, metres. */
  readonly tipRadius: number;
  /** z of the top face of the blades. */
  readonly topFaceZ: number;
  /** z of the exits of the upward nozzles; null if it has none. */
  readonly nozzleUpZ: number | null;
  /** z of the exits of the downward nozzles; null if it has none. */
  readonly nozzleDownZ: number | null;
  /** z of the underside of the blades. */
  readonly bladeUndersideZ: number;
  /** z of the lowest point of the hub. */
  readonly hubUndersideZ: number;
  readonly shape: ArmShapeSpec;
  /** The feed tube that carries water to a basket-mounted arm, or null. */
  readonly feedTube: { readonly length: number; readonly diameter: number } | null;
  /** Mass of the dry arm, kg. */
  readonly mass: number;
  /** Weight W used in the axial load of the friction model, newtons. */
  readonly weight: number;
  /** Moment of inertia about the axis with the blades full of water, kg m^2. */
  readonly inertiaWet: number;
  /** Rotation sense seen from above: `ccw` is counter-clockwise (+z by the right-hand rule). */
  readonly sense: 'cw' | 'ccw';
  readonly bearing: ArmBearingSpec;
  /** Speed the friction was tuned to give at the rated pump speed, rad/s; null if none. */
  readonly designSpeed: number | null;
}

/**
 * A sprayer that is not a reaction-driven arm: a pipe outlet, a spray head, or an outlet onto
 * a free-spinning rotor. Its `nozzles` describe the outlets for the hydraulics; its spray is
 * described by `spray`, not by coherent jets.
 */
export interface FixedSprayerSpec extends SprayLevelBase {
  readonly kind: 'fixed';
  readonly type: 'free_spinning_rotor' | 'spray_head';
  /** z of the outlet. */
  readonly outletZ: number;
  /** z of the lowest face of the sprayer. */
  readonly lowerFaceZ: number;
  /** Diameter of the rotor or head, metres. */
  readonly diameter: number;
  /** Height of the rotor or head, metres. */
  readonly height: number;
  /** Number of vanes of a rotor; 0 for a head. */
  readonly vanes: number;
  /** The spray it throws. */
  readonly spray: {
    readonly pattern: 'rotating_shower' | 'fixed_jets';
    /** Half-angle of the cone the droplets leave in, about -z, radians. */
    readonly coneHalfAngle: number;
    /** Speed of the droplets leaving the sprayer, m/s. */
    readonly dropletSpeed: number;
  };
}

/** One spray level of the machine. */
export type SprayLevelSpec = SprayArmSpec | FixedSprayerSpec;

// ---------------------------------------------------------------------------------------------
// Hydraulics
// ---------------------------------------------------------------------------------------------

/**
 * The circulation pump (machine.md section 4.2): H(Q, N) = H_0 (N / N_0)^2 f_H - b Q^2, and
 * P_el = p Q / (eta_h eta_m) + P_0.
 */
export interface PumpSpec {
  /** Part number, where known. */
  readonly part: string | null;
  /** Kind of pump and drive, in words. */
  readonly type: string;
  /** Rated speed N_0, revolutions per minute. */
  readonly ratedSpeedRpm: number;
  /** Shut-off head H_0 at the rated speed, metres of water. */
  readonly shutOffHead: number;
  /** Curve coefficient b, metres per (m^3/s)^2. */
  readonly curveCoefficient: number;
  /** Lowest and highest speed in operation, revolutions per minute. */
  readonly speedRangeRpm: Range;
  /** Wet-end efficiency eta_h. */
  readonly hydraulicEfficiency: number;
  /** Motor-plus-inverter efficiency eta_m. */
  readonly motorEfficiency: number;
  /** Fixed electrical power P_0, watts. */
  readonly idlePower: number;
  readonly provenance: Provenance;
}

/**
 * One branch of the spray network, from the diverter to a spray level (machine.md section 4.3):
 * p_pump = rho g z + K Q^2 + p_arm.
 */
export interface BranchSpec {
  /** Id of the spray level it feeds. */
  readonly id: string;
  /**
   * Static lift z of the nozzles above the sump level, metres. For a level carried by a
   * height-adjustable basket it holds at `liftAtPosition` and moves with the basket.
   */
  readonly staticLift: number;
  /** Height position of the carrying basket at which `staticLift` holds; null for a fixed level. */
  readonly liftAtPosition: string | null;
  /** Loss coefficient K of the feed, Pa s^2 / m^6. */
  readonly lossCoefficient: number;
  /** Volume of water the branch holds when it is fed, m^3. */
  readonly pipeVolume: number;
  /** Sum of C_d A over its nozzles as the dossier states it, m^2 (a check on the nozzle table). */
  readonly statedCdA: number;
  readonly provenance: Provenance;
}

/** One position of the water diverter and the branches it feeds. */
export interface DiverterPositionSpec {
  /** Id, a valid lower-case identifier (`ur`). */
  readonly id: string;
  /** The dossier's name for the position (`UR`). */
  readonly label: string;
  /** Ids of the branches that are open; empty for a closed position. */
  readonly feeds: readonly string[];
}

/** One phase of an alternation pattern. */
export interface DiverterPhaseSpec {
  /** Id of the diverter position. */
  readonly position: string;
  /** How long the position is held, seconds. */
  readonly duration: number;
}

/**
 * How the diverter alternates while the pump runs: the phases in order, repeating. A pattern
 * of one phase holds that position for as long as the pump runs.
 */
export interface DiverterPatternSpec {
  readonly phases: readonly DiverterPhaseSpec[];
}

/** The water diverter at the pump discharge. */
export interface DiverterSpec {
  /** Part number, where known. */
  readonly part: string | null;
  /** Kind of diverter, in words. */
  readonly type: string;
  readonly positions: readonly DiverterPositionSpec[];
  /**
   * Time the diverter takes to move from one position to the next, seconds. While it moves the
   * branches of the new position open linearly from closed to fully open (`expandProgramme`).
   */
  readonly transitionTime: number;
  /** Pattern used when a programme step gives none. */
  readonly defaultPattern: DiverterPatternSpec;
  readonly provenance: Provenance;
}

/** Water inventory parameters (machine.md section 4.5). SI. */
export interface InventorySpec {
  /** Sump volume V_min below which the pump ingests air, m^3. */
  readonly minSumpVolume: number;
  /** Time a parcel of water spends in flight, seconds. */
  readonly flightTime: number;
  /** Time it spends on the load and the walls on its way back to the sump, seconds. */
  readonly returnTime: number;
  /**
   * Water that stays in the machine through a drain and mixes into the next bath (in the sump
   * and on the load), m^3.
   */
  readonly carryOver: number;
  /**
   * Volume of mains water admitted in one top-up, m^3: what `expandProgramme` lets in when the
   * sump falls below `minSumpVolume` during circulation in a phase listed in `levelCheckIn`.
   */
  readonly topUpVolume: number;
  /** Top-ups allowed per programme phase. */
  readonly maxTopUpsPerPhase: number;
  /**
   * Programme phases (`ProgrammePhase`) in which the level is checked and topped up. In every
   * other phase a short sump starves the pump.
   */
  readonly levelCheckIn: readonly string[];
  readonly provenance: Provenance;
}

/**
 * How water gets into the machine. SI.
 *
 * `inletFlow` and `prestoreDischargeFlow` set how long every fill takes. The three bath volumes
 * are the machine's nominal quantities: each programme step carries its own volume, and
 * `validateMachineSpec` holds the primary programme to them (`bath_volume_differs`). To change
 * a bath, change the fill steps of the programme and these figures together.
 */
export interface FillSpec {
  /** Flow of the inlet valve, m^3/s. */
  readonly inletFlow: number;
  /** Nominal volume of the first bath of a programme, m^3. */
  readonly firstBathVolume: number;
  /** Nominal volume of a later bath, m^3. */
  readonly laterBathVolume: number;
  /** Nominal volume of a filter flush, m^3. Descriptive: no check uses it. */
  readonly flushVolume: number;
  /** How the quantity is metered, in words. */
  readonly metering: string;
  /**
   * Capacity of the tank in which the next bath is pre-stored (the heat exchanger), m^3; null
   * when every bath comes straight from the mains.
   */
  readonly prestoreVolume: number | null;
  /** Flow from the pre-store tank into the tub, m^3/s; null without a tank. */
  readonly prestoreDischargeFlow: number | null;
  readonly provenance: Provenance;
}

/** The drain pump. SI. */
export interface DrainSpec {
  /** Flow of the drain pump, m^3/s: a drain step lasts at least its volume over this flow. */
  readonly flow: number;
  /**
   * One drain event: pump, run-down pause, pump, ... seconds, starting with the pump on.
   * Descriptive: the programme steps carry their own durations and `expandProgramme` does not
   * read it.
   */
  readonly pattern: readonly number[];
  readonly provenance: Provenance;
}

/** The lumped hydraulic model of the machine (machine.md sections 4 and 12.2). */
export interface HydraulicsSpec {
  readonly pump: PumpSpec;
  /** One branch per spray level. */
  readonly branches: readonly BranchSpec[];
  readonly diverter: DiverterSpec;
  /** Depth of the sump water level below the floor datum from which lifts are counted, metres. */
  readonly sumpLevelBelowDatum: number;
  readonly inventory: InventorySpec;
  readonly fill: FillSpec;
  readonly drain: DrainSpec;
}

// ---------------------------------------------------------------------------------------------
// Thermal, dosing, softener, sensors
// ---------------------------------------------------------------------------------------------

/**
 * The lumped thermal model (machine.md section 6.2): liquor, load and machine nodes, plus the
 * heat-exchanger tank where the machine has one. Watts, joules per kelvin, watts per kelvin,
 * degrees Celsius.
 */
export interface ThermalSpec {
  /** Heater power at the nominal voltage, W. It scales with the voltage squared. */
  readonly heaterPower: number;
  /** Fraction of the time the heater is on while it is heating to a target, 0 to 1. */
  readonly heaterDuty: number;
  /** Heat capacity C_m of the machine: tub, racks, sump, wetted plastic, J/K. */
  readonly machineHeatCapacity: number;
  /** Conductance G_wl between liquor and load while the pump circulates, W/K. */
  readonly liquorLoadConductance: number;
  /** Conductance G_wm between liquor and machine while the pump circulates, W/K. */
  readonly liquorMachineConductance: number;
  /** Conductance between what water is left in the tub and the machine with the pump off, W/K. */
  readonly liquorMachineConductanceIdle: number;
  /** Conductance between the load and the machine (through the tub air) with the pump off, W/K. */
  readonly loadMachineConductanceIdle: number;
  /** Conductance UA of the cabinet to the room, W/K. */
  readonly cabinetConductance: number;
  /** Temperature of the cold supply, degrees C. */
  readonly inletTemperature: number;
  /** Temperature of the room, degrees C. */
  readonly ambientTemperature: number;
  /**
   * Liquor temperature at and above which the heater is off, degrees C; null if none is known.
   * `expandProgramme` never heats beyond it, whatever a step's target.
   */
  readonly heaterCutOut: number | null;
  /** Heat capacity of the load the programme tables assume (a full rated load), J/K. */
  readonly referenceLoadHeatCapacity: number;
  readonly provenance: Provenance;
}

/**
 * Detergent and rinse-aid dosing as the machine does it. SI. These are what `expandProgramme`
 * doses with: a programme only says in which bath the detergent and the rinse aid go.
 */
export interface DosingSpec {
  /** Mass of detergent in one dose (one tablet), kg. */
  readonly detergentMass: number;
  /** Delay of the dispenser release after the main-wash circulation starts, seconds. */
  readonly detergentReleaseDelay: number;
  /** Volume of rinse aid dosed in the final rinse, m^3. */
  readonly rinseAidVolume: number;
  /** Delay of the rinse-aid dose after the final-rinse circulation starts, seconds; null if tied to a temperature only. */
  readonly rinseAidDelay: number | null;
  /** Liquor temperature at or above which rinse aid is dosed, degrees C; null if none. */
  readonly rinseAidMinTemperature: number | null;
  readonly provenance: Provenance;
}

/** The water softener as far as it affects a programme. SI. */
export interface SoftenerSpec {
  /** The hardness setting, as the machine names it. */
  readonly setting: string;
  /** A regeneration is added every this many programmes; null if not known. */
  readonly regenerateEveryCycles: number | null;
  /** Extra water of a regeneration, m^3. */
  readonly extraWater: number;
  /** Extra running time of a regeneration, seconds. */
  readonly extraDuration: number;
  /** Extra energy of a regeneration, joules. */
  readonly extraEnergy: number;
  readonly provenance: Provenance;
}

/** The sensors that decide how a programme runs. */
export interface SensorsSpec {
  /** The turbidity sensor, or null if the machine has none. */
  readonly turbidity: {
    /** Part number, where known. */
    readonly part: string | null;
    /** Programme phases in which it is read. */
    readonly activeIn: readonly string[];
    /** What the readings decide, in words. Thresholds are not public. */
    readonly decides: string;
  } | null;
  /** How the water level is judged. */
  readonly waterLevel: 'pump_motor_current' | 'pressure_switch' | 'none';
  /** How the fill quantity is metered. */
  readonly waterQuantity: 'impeller_pulses' | 'timed' | 'pressure_switch';
  /** How the load is sensed, in words. */
  readonly load: string;
  readonly provenance: Provenance;
}

// ---------------------------------------------------------------------------------------------
// Player-adjustable configuration
// ---------------------------------------------------------------------------------------------

/** Names one tine row of one basket. */
export interface TineRowRef {
  readonly basketId: string;
  readonly rowId: string;
}

/** The state of one folding shelf or holder of one basket. */
export interface ShelfState {
  readonly basketId: string;
  /** Id of a cup shelf or of a folding holder of that basket. */
  readonly shelfId: string;
  /** `down`: lowered into use; `up`: folded up out of the way. */
  readonly state: 'up' | 'down';
}

/**
 * What the player can adjust on the machine before loading it. Separate from `MachineSpec`: the
 * specification says what can be adjusted, a configuration says how it is set.
 */
export interface MachineConfig {
  /** Height position of each height-adjustable basket: basket id to position id. */
  readonly basketHeights: Readonly<Record<string, string>>;
  /** The hinged tine rows that are folded down. Every other row is up. */
  readonly foldedTineRows: readonly TineRowRef[];
  /** State of every folding cup shelf and holder. One not listed is in its default state. */
  readonly shelves: readonly ShelfState[];
  /** Where the cutlery basket stands, or null when it is taken out of the machine. */
  readonly cutleryBasket: CutleryBasketPlacement | null;
}

// ---------------------------------------------------------------------------------------------
// The machine
// ---------------------------------------------------------------------------------------------

/** A complete description of one dishwasher. See the file comment for units and frames. */
export interface MachineSpec {
  /** Catalogue id of the machine, a valid lower-case identifier (`bosch_smv4hax40g`). */
  readonly id: string;
  /** Name for display. */
  readonly name: string;
  /** What the machine is and where the description comes from. */
  readonly description: string;
  readonly identity: MachineIdentity;
  readonly tub: TubSpec;
  readonly door: DoorSpec;
  readonly sump: SumpSpec;
  readonly filter: FilterSpec;
  readonly saltCap: SaltCapSpec | null;
  readonly floorFeatures: readonly FloorFeatureSpec[];
  readonly feedDuct: FeedDuctSpec | null;
  readonly wallFeatures: readonly WallFeatureSpec[];
  readonly dispenser: DispenserSpec;
  readonly drying: DryingSpec;
  /** The baskets, lowest first. */
  readonly baskets: readonly BasketSpec[];
  readonly cutleryBasket: CutleryBasketSpec | null;
  /** The spray levels, lowest first. */
  readonly sprayLevels: readonly SprayLevelSpec[];
  readonly hydraulics: HydraulicsSpec;
  readonly thermal: ThermalSpec;
  readonly dosing: DosingSpec;
  readonly softener: SoftenerSpec | null;
  readonly sensors: SensorsSpec;
  readonly programmes: readonly ProgrammeSpec[];
  /** Id of the programme the simulation runs by default. */
  readonly primaryProgramme: string;
  readonly defaultConfig: MachineConfig;
}
