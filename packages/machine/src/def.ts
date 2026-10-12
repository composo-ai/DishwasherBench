/**
 * Authoring definitions: a machine written the way the dossiers write it.
 *
 * `MachineDef` holds the same information as `MachineSpec` (`types.ts`) in the units of
 * docs/research/machine.md section 12.1 and docs/research/machine-bosch-smv4hax40g.md section
 * 3.1: millimetres, degrees, litres, litres per minute, grams, minutes, kilowatt-hours. Every
 * field that is not SI carries its unit in its name (`tipRadiusMm`, `leanDeg`,
 * `inletFlowLPerMin`), so a definition cannot be mistaken for a specification; a field without
 * a unit suffix is SI or has no unit and means exactly what the field of the same name in
 * `types.ts` means. `loadMachineSpec` (`load.ts`) is the one place where units are converted.
 *
 * The meaning of every field is documented on the SI type it converts to; the comments here
 * state the unit and whatever is specific to the authoring form. Two things are:
 *
 * - Basket coordinates. A `BasketDef` is written in the dossier's own basket frame, any frame
 *   parallel to the tub frame; `local` says where its origin is. The loader moves every
 *   coordinate into the platform's rack frame (origin at the front-left corner of the outer
 *   plan rectangle, at the top surface of the base grid).
 * - Defaults. The default configuration is not written out: it follows from the default state
 *   of each row and shelf, the default placement of the cutlery basket and
 *   `defaultBasketHeights`.
 */

import type { Vec3 } from '@spotless/core';
import type { ProgrammePhase, PumpPulse } from './programme-types.ts';
import type { Provenance, ProvenanceTag } from './provenance.ts';
import type {
  ArmShapeSpec,
  BasketSpec,
  CutleryBasketSpec,
  DispenserSpec,
  DiverterPositionSpec,
  DryingMethod,
  FixedSprayerSpec,
  HolderSpec,
  HorizontalAxis,
  HorizontalDirection,
  MachineIdentity,
  NozzleShape,
  PerforationLattice,
  Range,
  SensorsSpec,
  Side,
  SprayMount,
  TabletTarget,
  ThermalSpec,
  TineRowSpec,
  TubSurface,
  Vec2,
} from './types.ts';

// ---------------------------------------------------------------------------------------------
// Tub, door, sump, filters, features
// ---------------------------------------------------------------------------------------------

/** `MachineIdentity` with the outer size in millimetres. */
export type MachineIdentityDef = Omit<MachineIdentity, 'outerSize'> & {
  /** Width (x), depth (y), height (z), mm. */
  readonly outerSizeMm: Vec3;
};

/** `TubSpec` in millimetres and degrees. */
export interface TubDef {
  readonly xMm: Range;
  readonly yMm: Range;
  readonly zMm: Range;
  readonly floorDatum: string;
  readonly verticalCornerRadiusMm: number;
  readonly floorSlopeDeg: number;
  readonly floorDescription: string;
  readonly wheelLedgeZMm: number | null;
  readonly material: string;
  readonly provenance: Provenance;
}

/** `DoorSpec` in millimetres and degrees. */
export interface DoorDef {
  readonly flangePlaneYMm: number;
  readonly linerPlaneYMm: number;
  /** y and z of the hinge axis, mm. */
  readonly hingeAxisMm: { readonly y: number; readonly z: number };
  readonly openAngleDeg: number;
  readonly linerSizeMm: Vec2 | null;
  readonly openingHeightMm: number | null;
  readonly provenance: Provenance;
}

/** `SumpSpec` in millimetres and litres. */
export interface SumpDef {
  readonly centreMm: Vec2;
  readonly diameterMm: number;
  readonly depthMm: number;
  readonly workingVolumeL: number;
  readonly residueAfterDrainL: number;
  readonly provenance: Provenance;
}

/** `FilterSpec` in millimetres and square centimetres. */
export interface FilterDef {
  readonly axisMm: Vec2;
  readonly flatPlate: {
    readonly xMm: Range;
    readonly yMm: Range;
    readonly openingDiameterMm: number | null;
    readonly holeDiameterMm: number;
    readonly holePitchMm: number | null;
    readonly lattice: PerforationLattice | null;
    readonly openFraction: number;
    readonly openAreaCm2: number;
    readonly provenance: Provenance;
  };
  readonly sumpCover: {
    readonly sizeMm: Vec2;
    readonly yMm: Range;
    readonly holeDiameterMm: number;
    readonly holePitchMm: number;
    readonly openAreaCm2: number;
    readonly provenance: Provenance;
  } | null;
  readonly coarse: {
    readonly diameterMm: number;
    readonly lengthMm: number;
    readonly openingMm: number;
    readonly crownDiameterMm: number | null;
    readonly crownTopZMm: number | null;
    readonly provenance: Provenance;
  };
  readonly micro: {
    readonly diameterMm: number | null;
    readonly heightMm: number | null;
    readonly pleatFactor: number;
    readonly meshMm: number;
    readonly areaCm2: number;
    readonly openFraction: number;
    readonly provenance: Provenance;
  };
}

/** `SaltCapSpec` in millimetres. */
export interface SaltCapDef {
  readonly centreMm: Vec2;
  readonly diameterMm: number;
  readonly topZMm: number;
  readonly provenance: Provenance;
}

/** `FloorFeatureSpec` in millimetres. */
export type FloorFeatureDef =
  | {
      readonly kind: 'beads';
      readonly id: string;
      readonly xMm: Range;
      readonly yMm: Range;
      readonly count: number;
      readonly lengthMm: number;
      readonly pitchMm: number;
      readonly provenance: Provenance;
    }
  | {
      readonly kind: 'dish';
      readonly id: string;
      readonly centreMm: Vec2;
      readonly diameterMm: number;
      readonly provenance: Provenance;
    };

/**
 * `FeedDuctSpec` in millimetres. The heights of the docking ports and of the top are written as
 * the part drawing gives them, above the lower ends of the floor stubs; the loader adds
 * `stubEndZMm`.
 */
export interface FeedDuctDef {
  readonly part: string | null;
  readonly riserXMm: Range;
  readonly riserProudMm: number;
  readonly portBlockProudMm: number;
  readonly stubEndZMm: number;
  readonly stubYMm: number | null;
  /** Heights of the port centres above the stub ends, lowest first, mm. */
  readonly portAboveStubEndsMm: readonly number[];
  /** Height of the top of the duct above the stub ends, mm. */
  readonly topAboveStubEndsMm: number;
  readonly channels: number;
  readonly provenance: Provenance;
}

/** `WallFeatureSpec` in millimetres. */
export interface WallFeatureDef {
  readonly id: string;
  readonly surface: TubSurface;
  readonly kind: 'grille' | 'fitting' | 'embossed_panel' | 'guide_rail' | 'other';
  readonly description: string;
  readonly sizeMm: Vec2 | null;
  /** Extent along the wall and in height, tub frame, mm; omitted when not recorded. */
  readonly positionMm?: { readonly along: Range; readonly z: Range };
  readonly proudMm: number;
  readonly count: number;
  readonly provenance: Provenance;
}

/** `DispenserLidSpec` with the swing angle in degrees. */
export type DispenserLidDef =
  | { readonly kind: 'slides'; readonly direction: 'up' | 'down' | 'left' | 'right' }
  | {
      readonly kind: 'swings';
      readonly hingeEdge: 'bottom' | 'top' | 'left' | 'right';
      readonly angleDeg: number;
    };

/** `DispenserSpec` in millimetres and millilitres. Positions in the tub frame, door closed. */
export interface DispenserDef {
  readonly part: DispenserSpec['part'];
  /** Width (x), height (z), depth (y), mm. */
  readonly unitSizeMm: Vec3 | null;
  readonly chamberCentreMm: Vec3;
  /** Width (x) and height (z) of the chamber opening, mm. */
  readonly chamberSizeMm: Vec2;
  readonly lid: DispenserLidDef;
  readonly keepOutDepthMm: number;
  readonly fillMarksMl: readonly number[];
  readonly tabletExitMm: Vec3;
  readonly tabletTarget: TabletTarget;
  readonly rinseAidOutletMm: Vec3;
  readonly rinseAidReservoirMl: number | null;
  readonly rinseAidPerPulseMl: number | null;
  readonly provenance: Provenance;
}

/** `DryingSpec` in millimetres, litres and minutes. */
export interface DryingDef {
  readonly method: DryingMethod;
  readonly heatExchanger: {
    readonly part: string | null;
    readonly wall: 'left' | 'right';
    /** Extent along y and along z, mm. */
    readonly sizeMm: Vec2 | null;
    readonly thicknessMm: number | null;
    readonly volumeL: number | null;
    /** W/K. */
    readonly wallConductance: number | null;
    readonly provenance: Provenance;
  } | null;
  readonly autoOpen: { readonly afterMin: number; readonly gapMm: number } | null;
  readonly fan: boolean;
  readonly defaultDurationMin: number;
  readonly provenance: Provenance;
}

// ---------------------------------------------------------------------------------------------
// Baskets
// ---------------------------------------------------------------------------------------------

/** Coated and bare diameter of a wire, mm. */
export interface WireSizeDef {
  readonly coatedMm: number;
  readonly steelMm: number;
}

/** `CornerSpec` in millimetres. */
export type CornerDef =
  | { readonly kind: 'square' }
  | { readonly kind: 'round'; readonly radiusMm: number }
  | { readonly kind: 'chamfer'; readonly dxMm: number; readonly dyMm: number };

/** `FloorWireFamilySpec` in millimetres, in the basket's authoring frame. */
export interface FloorWireFamilyDef {
  readonly positionsMm: readonly number[];
  readonly pitchMm: number | null;
  /** Height of the wire centres in the authoring frame, mm. */
  readonly zMm: number;
  readonly spanMm: Range;
  readonly humps: readonly {
    readonly fromMm: number;
    readonly toMm: number;
    readonly riseMm: number;
  }[];
  readonly crankMm: number;
}

/** `TineRowSpec` in millimetres and degrees, in the basket's authoring frame. */
export interface TineRowDef {
  readonly id: string;
  readonly label: string;
  readonly runs: HorizontalAxis;
  readonly railAtMm: number;
  /** Height of the rail centre in the authoring frame, mm. */
  readonly railZMm: number;
  readonly railSpanMm: Range;
  readonly tinePositionsMm: readonly number[];
  /** One direction for the whole row, or one per tine. */
  readonly leanToward: HorizontalDirection | readonly HorizontalDirection[];
  readonly pitchMm: number;
  readonly heightMm: number;
  readonly leanDeg: number;
  readonly wireDiameterMm: number;
  readonly tip: TineRowSpec['tip'];
  readonly form: TineRowSpec['form'];
  readonly hinge: {
    readonly foldsToward: HorizontalDirection;
    readonly foldAngleDeg: number;
    readonly release: string;
  } | null;
  readonly defaultState: TineRowSpec['defaultState'];
  readonly provenance: Provenance;
}

/**
 * `BasketSpec` in millimetres, degrees and grams, written in the dossier's own basket frame.
 * Every x, y and z below that is not a size is in that frame; `local` ties it to the tub.
 */
export interface BasketDef {
  readonly id: string;
  readonly level: BasketSpec['level'];
  readonly frame: BasketSpec['frame'];
  readonly kind: BasketSpec['kind'];
  readonly part: string | null;
  readonly material: string;
  /** The authoring frame of this basket: parallel to the tub frame. */
  readonly local: {
    /** Tub-frame (x, y) of its origin with the basket pushed in, mm. */
    readonly originInTubMm: Vec2;
    /** (x, y) of the front-left corner of the basket's outer plan rectangle, mm. */
    readonly frontLeftMm: Vec2;
    /** z of the top surface of the base grid, mm (0 when heights are given from the grid top). */
    readonly gridTopZMm: number;
  };
  readonly outline: {
    readonly sizeMm: Vec2;
    readonly rimCentresMm: Vec2;
    readonly corners: {
      readonly frontLeft: CornerDef;
      readonly frontRight: CornerDef;
      readonly rearLeft: CornerDef;
      readonly rearRight: CornerDef;
    };
    readonly recesses: readonly {
      readonly side: Side;
      readonly spanMm: Range;
      readonly depthMm: number;
      readonly rampMm: number;
    }[];
  };
  readonly provenance: Provenance;
  readonly pose: {
    /** Tub-frame z of the authoring frame's z = 0 at each height position, highest first, mm. */
    readonly heightPositions: readonly {
      readonly id: string;
      readonly label: string;
      readonly datumZMm: number;
    }[];
    readonly canTilt: boolean;
    readonly travelDirection: Vec3;
    readonly travelMm: number;
    readonly provenance: Provenance;
  };
  readonly wires: {
    readonly rim: WireSizeDef;
    readonly floor: WireSizeDef;
    readonly tine: WireSizeDef;
    readonly coatingMm: number;
    readonly provenance: Provenance;
  };
  readonly walls: readonly {
    readonly side: Side;
    readonly horizontalWireZMm: readonly number[];
    readonly uprightsMm: readonly number[];
  }[];
  readonly floor: {
    readonly alongY: FloorWireFamilyDef;
    readonly alongX: FloorWireFamilyDef;
    readonly upperLayer: 'alongX' | 'alongY';
    /**
     * `FloorReliefSpec` as `[position, rise]` pairs in mm, positions in the authoring frame;
     * omitted for a flat floor.
     */
    readonly relief?: {
      readonly axis: HorizontalAxis;
      readonly pointsMm: readonly (readonly [atMm: number, riseMm: number])[];
    };
    readonly largestOpeningMm: Vec2;
    readonly provenance: Provenance;
  };
  readonly tineRows: readonly TineRowDef[];
  readonly wheels: {
    readonly count: number;
    readonly diameterMm: number;
    readonly stationsYMm: readonly number[];
    readonly trackMm: number;
    readonly axleZMm: number;
    readonly provenance: Provenance;
  } | null;
  readonly handle: {
    readonly part: string | null;
    readonly sizeMm: Vec3;
    readonly centreXMm: number;
    readonly provenance: Provenance;
  } | null;
  readonly tabletTray: {
    readonly part: string | null;
    readonly sizeMm: Vec3;
    readonly centreMm: Vec2;
    readonly rimZMm: number;
    /** Top of the front wall where it is lower than the rim (`TabletTraySpec.frontRimZ`), mm. */
    readonly frontRimZMm?: number;
    readonly slotted: boolean;
    readonly provenance: Provenance;
  } | null;
  readonly cupShelves: readonly {
    readonly id: string;
    readonly part: string | null;
    readonly side: 'left' | 'right';
    /** Length along y, width (x), thickness (z), mm. */
    readonly sizeMm: Vec3;
    readonly yMm: Range;
    /** z of the lowered shelf plane in the authoring frame, mm. */
    readonly shelfZMm: number;
    /** `CupShelfSpec.pivotInset`, mm; omitted for a shelf that turns about its edge at the wall. */
    readonly pivotInsetMm?: number;
    readonly stemwareNotches: number;
    readonly defaultState: 'up' | 'down';
    readonly provenance: Provenance;
  }[];
  readonly holders: readonly {
    readonly id: string;
    readonly kind: HolderSpec['kind'];
    readonly part: string | null;
    readonly description: string;
    readonly side: Side;
    /** Length along the wall, width, height, mm. */
    readonly sizeMm: Vec3;
    readonly xMm: Range;
    readonly yMm: Range;
    readonly floorZMm: number | null;
    /** `HolderSpec.foldHingeZ` in the authoring frame, mm; omitted for the top of its floor. */
    readonly foldHingeZMm?: number;
    readonly massG: number;
    readonly folds: boolean;
    readonly defaultState: 'up' | 'down';
    readonly provenance: Provenance;
  }[];
  readonly tray: {
    readonly sideDepthMm: number;
    readonly centreDepthMm: number;
    readonly centreTiltDeg: number;
    readonly combGapsMm: readonly number[];
  } | null;
  readonly massKg: number;
  readonly limits: {
    readonly maxDiameterByPositionMm: Readonly<Record<string, number>>;
    readonly positionOfBasket: string;
    readonly maxDiameterAsShown: {
      readonly diameterMm: number;
      readonly positionId: string;
      readonly where: string;
    } | null;
    readonly seating: readonly { readonly where: string; readonly maxDiameterMm: number }[];
    readonly provenance: Provenance;
  } | null;
}

/** `CutleryBasketSpec` in millimetres and grams. */
export interface CutleryBasketDef {
  readonly part: string | null;
  readonly material: string;
  /** Length, width, height of the body, mm. */
  readonly sizeMm: Vec3;
  readonly widthOverLidsMm: number;
  readonly heightWithHandleMm: number;
  readonly massG: number;
  readonly cells: number;
  readonly cellGrid: CutleryBasketSpec['cellGrid'];
  readonly sectionsAlongLengthMm: readonly number[];
  readonly layout: string;
  readonly base: CutleryBasketSpec['base'];
  readonly tunnels: {
    readonly count: number;
    readonly centresFromMidMm: readonly number[];
    readonly clearWidthMm: number;
    readonly heightMm: number;
  } | null;
  readonly wallOpeningMm: Vec2;
  readonly floorSlotMm: Vec2;
  readonly lid: { readonly openingsMm: Vec2; readonly inUse: boolean } | null;
  /** Where it stands by default: its centre in the authoring frame of that basket, mm. */
  readonly defaultPlacement: {
    readonly basketId: string;
    readonly centreMm: Vec2;
    readonly longAxis: HorizontalAxis;
  };
  /**
   * Further named places it can be stood, after the default one (which is listed first under
   * the id `defaultPositionId`): centres in the authoring frame of their basket, mm.
   */
  readonly positions?: readonly {
    readonly id: string;
    readonly label: string;
    readonly basketId: string;
    readonly centreMm: Vec2;
    readonly longAxis: HorizontalAxis;
    readonly tag: ProvenanceTag;
    readonly note: string;
  }[];
  /** Id and label of the default placement as a named position; default `default`. */
  readonly defaultPosition?: { readonly id: string; readonly label: string; readonly note: string };
  readonly locatedBy: string;
  readonly provenance: Provenance;
}

// ---------------------------------------------------------------------------------------------
// Spray levels
// ---------------------------------------------------------------------------------------------

/** `NozzleSpec` in millimetres and degrees. The area is derived from the shape and size. */
export interface NozzleDef {
  readonly id: string;
  readonly label: string;
  readonly blade: '+' | '-' | 'axis';
  /** True when which blade carries it was not determined; default false. */
  readonly bladeAssumed?: boolean;
  readonly radiusMm: number;
  readonly thetaDeg: number;
  readonly rhoDeg: number;
  readonly face: 'top' | 'underside';
  readonly shape: NozzleShape;
  /** `[diameter]` for a round bore, `[length, width]` otherwise, mm. */
  readonly sizeMm: readonly number[];
  readonly cd: number;
  /** Velocity coefficient; default: the machine's `nozzleVelocityCoefficient`. */
  readonly cv?: number;
  readonly drives: boolean;
  /** For a slot or a rectangle: direction of its long axis; omitted where it is not recorded. */
  readonly slotAxis?: 'radial' | 'tangential';
  /** Fan of a slot, where characterised. */
  readonly fan?: { readonly angleDeg: number; readonly subJets: number };
  readonly description: string;
}

/**
 * `SprayArmSpec` in millimetres, degrees and grams. Heights (`...ZMm`) are tub-frame z for an
 * arm fixed to the tub, and relative to the top surface of the carrying basket's base grid for
 * an arm that hangs under a basket.
 */
export interface SprayArmDef {
  readonly kind: 'arm';
  readonly id: string;
  readonly name: string;
  readonly part: string | null;
  readonly mount: SprayMount;
  readonly axisMm: Vec2;
  readonly tipRadiusMm: number;
  readonly topFaceZMm: number;
  readonly nozzleUpZMm: number | null;
  readonly nozzleDownZMm: number | null;
  readonly bladeUndersideZMm: number;
  readonly hubUndersideZMm: number;
  readonly shape: {
    readonly blades: number;
    readonly bladeThicknessMm: number;
    readonly hubHeightMm: number | null;
    readonly hubDiameterMm: number | null;
    readonly stemDiameterMm: number | null;
    readonly bladeWidthMm: Range | null;
    readonly tipSweepDeg: number;
    readonly description: ArmShapeSpec['description'];
  };
  readonly feedTubeMm: { readonly length: number; readonly diameter: number } | null;
  readonly massG: number;
  /** Weight used in the friction model, N. */
  readonly weight: number;
  /** kg m^2. */
  readonly inertiaWet: number;
  readonly sense: 'cw' | 'ccw';
  readonly bearing: {
    readonly frictionRadiusMm: number;
    /** N m s. */
    readonly viscous: number;
    readonly thrustSign: -1 | 1;
    readonly hubBoreMm: number;
  };
  readonly designSpeedRpm: number | null;
  readonly nozzles: readonly NozzleDef[];
  readonly nozzleProvenance: Provenance;
  readonly provenance: Provenance;
}

/** `FixedSprayerSpec` in millimetres and degrees; heights as for `SprayArmDef`. */
export interface FixedSprayerDef {
  readonly kind: 'fixed';
  readonly id: string;
  readonly name: string;
  readonly part: string | null;
  readonly mount: SprayMount;
  readonly axisMm: Vec2;
  readonly type: FixedSprayerSpec['type'];
  readonly outletZMm: number;
  readonly lowerFaceZMm: number;
  readonly diameterMm: number;
  readonly heightMm: number;
  readonly vanes: number;
  readonly spray: {
    readonly pattern: FixedSprayerSpec['spray']['pattern'];
    readonly coneHalfAngleDeg: number;
    /** m/s. */
    readonly dropletSpeed: number;
  };
  readonly nozzles: readonly NozzleDef[];
  readonly nozzleProvenance: Provenance;
  readonly provenance: Provenance;
}

/** One spray level, authoring units. */
export type SprayLevelDef = SprayArmDef | FixedSprayerDef;

// ---------------------------------------------------------------------------------------------
// Hydraulics, dosing, softener
// ---------------------------------------------------------------------------------------------

/** A diverter pattern as the dossiers write it: `[[position, seconds], ...]`, repeating. */
export type DiverterPatternDef = readonly (readonly [position: string, seconds: number])[];

/** `HydraulicsSpec` in litres, litres per minute, millimetres and square millimetres. */
export interface HydraulicsDef {
  readonly pump: {
    readonly part: string | null;
    readonly type: string;
    readonly ratedSpeedRpm: number;
    /** Metres of water. */
    readonly shutOffHead: number;
    /** Curve coefficient b in metres per (L/min)^2, as the dossiers give it. */
    readonly curveCoefficientPerLMin2: number;
    readonly speedRangeRpm: Range;
    readonly hydraulicEfficiency: number;
    readonly motorEfficiency: number;
    /** W. */
    readonly idlePower: number;
    readonly provenance: Provenance;
  };
  readonly branches: readonly {
    readonly id: string;
    /** Metres. */
    readonly staticLift: number;
    readonly liftAtPosition: string | null;
    /** Pa s^2 / m^6. */
    readonly lossCoefficient: number;
    readonly pipeVolumeL: number;
    readonly statedCdAMm2: number;
    readonly provenance: Provenance;
  }[];
  readonly diverter: {
    readonly part: string | null;
    readonly type: string;
    readonly positions: readonly DiverterPositionSpec[];
    /** Seconds. */
    readonly transitionTime: number;
    readonly defaultPattern: DiverterPatternDef;
    readonly provenance: Provenance;
  };
  /** Velocity coefficient C_v of every nozzle that does not give its own. */
  readonly nozzleVelocityCoefficient: number;
  readonly sumpLevelBelowDatumMm: number;
  readonly inventory: {
    readonly minSumpVolumeL: number;
    /** Seconds. */
    readonly flightTime: number;
    /** Seconds. */
    readonly returnTime: number;
    readonly carryOverL: number;
    readonly topUpVolumeL: number;
    readonly maxTopUpsPerPhase: number;
    readonly levelCheckIn: readonly string[];
    readonly provenance: Provenance;
  };
  readonly fill: {
    readonly inletFlowLPerMin: number;
    readonly firstBathVolumeL: number;
    readonly laterBathVolumeL: number;
    readonly flushVolumeL: number;
    readonly metering: string;
    readonly prestoreVolumeL: number | null;
    readonly prestoreDischargeFlowLPerMin: number | null;
    readonly provenance: Provenance;
  };
  readonly drain: {
    readonly flowLPerMin: number;
    /** Seconds. */
    readonly pattern: readonly number[];
    readonly provenance: Provenance;
  };
}

/** `DosingSpec` in grams and millilitres. */
export interface DosingDef {
  readonly detergentMassG: number;
  /** Seconds. */
  readonly detergentReleaseDelay: number;
  readonly rinseAidVolumeMl: number;
  /** Seconds. */
  readonly rinseAidDelay: number | null;
  /** Degrees C. */
  readonly rinseAidMinTemperature: number | null;
  readonly provenance: Provenance;
}

/** `SoftenerSpec` in litres, minutes and kilowatt-hours. */
export interface SoftenerDef {
  readonly setting: string;
  readonly regenerateEveryCycles: number | null;
  readonly extraWaterL: number;
  readonly extraDurationMin: number;
  readonly extraEnergyKWh: number;
  readonly provenance: Provenance;
}

// ---------------------------------------------------------------------------------------------
// Programmes
// ---------------------------------------------------------------------------------------------

/**
 * `PrestoreFill` in minutes and litres: `atMin` minutes into the step, or `atFraction` of its
 * duration (give one of the two).
 */
export interface PrestoreFillDef {
  readonly atMin?: number;
  readonly atFraction?: number;
  readonly volumeL: number;
}

/** Fields of every authoring step. */
export interface StepDefBase {
  readonly id: string;
  readonly row: string;
  readonly phase: ProgrammePhase;
  readonly label: string;
}

/** Fields of every authoring step during which the circulation pump runs. */
export interface PumpedStepDefBase extends StepDefBase {
  readonly pumpRpm: number;
  /** Default: the machine's default pattern. */
  readonly diverter?: DiverterPatternDef;
  /** Intermittent spraying, seconds on and off; default continuous. */
  readonly pulse?: PumpPulse;
  readonly prestoreFills?: readonly PrestoreFillDef[];
}

/**
 * `ProgrammeStep` in minutes, litres, millilitres and kilowatt-hours; temperatures in degrees
 * C and pump speeds in rev/min as in the SI type.
 */
export type ProgrammeStepDef =
  | (StepDefBase & {
      readonly kind: 'drain';
      readonly durationMin: number;
      /** Partial drain volume; default: a full drain. */
      readonly volumeL?: number;
      /** Default false. */
      readonly filterFlush?: boolean;
    })
  | (StepDefBase & {
      readonly kind: 'fill';
      /** Shortest duration; the step lasts as long as the sources need, and at least this. */
      readonly durationMin?: number;
      readonly sources: readonly {
        readonly from: 'mains' | 'prestore';
        readonly volumeL: number;
      }[];
      readonly prestoreFills?: readonly PrestoreFillDef[];
    })
  | (PumpedStepDefBase & { readonly kind: 'circulate'; readonly durationMin: number })
  | (PumpedStepDefBase & {
      readonly kind: 'heat';
      /** Degrees C. */
      readonly target: number;
      /** Default: until the target is reached. */
      readonly durationMin?: number;
      /** Default 120 min. */
      readonly timeoutMin?: number;
    })
  | (PumpedStepDefBase & {
      readonly kind: 'hold';
      readonly durationMin: number;
      /** Degrees C; default none. */
      readonly target?: number;
      /** Kelvin; default: heater off. */
      readonly reheatBand?: number;
    })
  | (StepDefBase & { readonly kind: 'dose_detergent' })
  | (StepDefBase & {
      readonly kind: 'dose_rinse_aid';
      /** Default: the machine's `dosing.rinseAidVolume`. */
      readonly volumeMl?: number;
    })
  | (StepDefBase & {
      readonly kind: 'regenerate';
      readonly durationMin: number;
      readonly waterL: number;
      readonly energyKWh: number;
      /** Default: pump off. */
      readonly pumpRpm?: number;
      readonly diverter?: DiverterPatternDef;
    })
  | (StepDefBase & {
      readonly kind: 'dry';
      /** Default: the machine's `drying.defaultDuration`. */
      readonly durationMin?: number;
      readonly prestoreFills?: readonly PrestoreFillDef[];
    });

/** `ProgrammeSpec` in minutes, litres and kilowatt-hours. */
export interface ProgrammeDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly steps: readonly ProgrammeStepDef[];
  readonly conditions: {
    /** J/K. */
    readonly loadHeatCapacity: number;
    readonly prestoreInitialVolumeL: number;
    readonly otherEnergyKWh: number;
  };
  readonly declared: {
    readonly durationMin: number;
    readonly mainsWaterL: number;
    readonly energyKWh: number | null;
    readonly durationToleranceMin: number;
    readonly waterToleranceL: number;
    /** Relative. */
    readonly energyTolerance: number;
    readonly printed: {
      readonly durationMin: Range | null;
      readonly energyKWh: Range | null;
      readonly mainsWaterL: Range | null;
    } | null;
  };
  readonly provenance: Provenance;
}

// ---------------------------------------------------------------------------------------------
// The machine
// ---------------------------------------------------------------------------------------------

/** A complete machine in authoring units: what `loadMachineSpec` takes. */
export interface MachineDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly identity: MachineIdentityDef;
  readonly tub: TubDef;
  readonly door: DoorDef;
  readonly sump: SumpDef;
  readonly filter: FilterDef;
  readonly saltCap: SaltCapDef | null;
  readonly floorFeatures: readonly FloorFeatureDef[];
  readonly feedDuct: FeedDuctDef | null;
  readonly wallFeatures: readonly WallFeatureDef[];
  readonly dispenser: DispenserDef;
  readonly drying: DryingDef;
  readonly baskets: readonly BasketDef[];
  readonly cutleryBasket: CutleryBasketDef | null;
  readonly sprayLevels: readonly SprayLevelDef[];
  readonly hydraulics: HydraulicsDef;
  /** Already in SI units (W, J/K, W/K, degrees C). */
  readonly thermal: ThermalSpec;
  readonly dosing: DosingDef;
  readonly softener: SoftenerDef | null;
  readonly sensors: SensorsSpec;
  readonly programmes: readonly ProgrammeDef[];
  readonly primaryProgramme: string;
  /** Default height position of each height-adjustable basket: basket id to position id. */
  readonly defaultBasketHeights: Readonly<Record<string, string>>;
}
