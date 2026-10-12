/**
 * Records that cross between modules the dependency table of docs/design/sim-core.md section 4
 * keeps apart.
 *
 * The contract defines each of these in the section of the module that produces it, but one of
 * its users may depend neither on that module nor on anything above this one:
 *
 * | Record | Defined in | Also used by | Why it is here |
 * |---|---|---|---|
 * | `ArmState`, `ComboId`, `PhaseEvent`, `MachineTick` | M4 | M9 (`LiquorModel.step`) | M9 depends on M2 only |
 * | `SoilRelease`, `RELEASE_CLASSES` | M8 | M9 (`LiquorModel.step`) | M9 depends on M2 only |
 * | `RateTables` | M9 | M8 (`SoilStage.tick`) | M8 depends on M3 and M2, not on M9 |
 * | `LiquorClassId` | section 0 | M4, M7, M9, M10 | the vocabulary of every module |
 *
 * They are declared here, in the lowest module all their users reach, and are re-exported under
 * the same names by the module the contract assigns them to (`@spotless/sim-hydraulics`,
 * `@spotless/sim-soil`, `@spotless/sim-liquor`). They are frozen interface records: the owner of
 * this package does not change them without the modules named above.
 *
 * Units are SI unless a field name says otherwise.
 */

// ---------------------------------------------------------------------------------------------
// Liquor classes (section 0)
// ---------------------------------------------------------------------------------------------

/**
 * Liquor class (section 0): `W` water-like, `D` main-wash liquor, `R` rinse-aid rinse. It fixes
 * the surface tension, the contact-angle column and the solve temperature of an exposure. The
 * contract writes the union out wherever it is used; this is the same union under a name.
 * The contact-angle columns of the catalogue are `clean_water` for `W`, `main_wash` for `D` and
 * `rinse_aid` for `R`.
 */
export type LiquorClassId = 'W' | 'D' | 'R';

/** Every {@link LiquorClassId}. */
export const LIQUOR_CLASS_IDS: readonly LiquorClassId[] = ['W', 'D', 'R'];

// ---------------------------------------------------------------------------------------------
// Combos and machine ticks (contract: section M4)
// ---------------------------------------------------------------------------------------------

/**
 * State of one spray arm fed in a diverter state (section M4): free; stalled at an angle
 * (zero speed sustained for 1 s, M11); or knocking, with a phase-time table of 256 knots over
 * its own period. The arm state is part of `ComboId` and of every cache key.
 */
export type ArmState =
  | {
      /** The arm turns freely at the speed of its torque balance. */
      readonly kind: 'free';
    }
  | {
      /** The arm stands still against the load. */
      readonly kind: 'stalled';
      /** Angle at which the arm stands, in units of 1/256 revolution (integer 0 to 255). */
      readonly angleQ: number;
    }
  | {
      /** The arm turns but is held back periodically by a contact. */
      readonly kind: 'knocking';
      /** Hash of the phase-time table, as returned by `MachineModel.registerArmProfile`. */
      readonly profile: string;
    };

/**
 * One combo (section 0): a diverter state, a pump class, a liquor class and the state of every
 * arm the diverter state feeds. All exposure records of one combo form an exposure set.
 */
export interface ComboId {
  /** Diverter state: `L` lower, `U` upper, `A` all; machine data may define others. */
  readonly diverter: string;
  /**
   * Pump class, named by its class-centre speed in rpm (2700 and 3000 in AUTO-145); speeds
   * within the class half-width of the centre share one exposure set.
   */
  readonly pumpClass: number;
  /** Liquor class. */
  readonly liquor: LiquorClassId;
  /**
   * One state per rotating spray arm fed in this diverter state, in the order of the machine's
   * spray levels of kind `arm`. A fixed sprayer (the roof spinner of the sizing machine) has no
   * arm state and no entry here: whether it is fed follows from `diverter` (contract-issues.md
   * R3).
   */
  readonly arms: readonly ArmState[];
}

/**
 * A programme event that takes effect in one tick. The contract uses this type in
 * `MachineTick.events` and never defines it; the members are the programme events that
 * section 5.5 lists for the CPU part of a tick (fill, drain, heater, dispenser, rinse aid,
 * diverter, pump speed), each with the smallest payload its consumers need, plus the events of
 * the machine package's programme timeline that have no counterpart there (pre-store fill,
 * softener regeneration, automatic door opening) and the source and temperature of a fill
 * (contract-issues.md R11). M9 may not import the machine's types, so the vocabulary is mirrored
 * here. Reported as a contract issue.
 */
export type PhaseEvent =
  | {
      /** Supply water is admitted. */
      readonly kind: 'fill';
      /** Volume of supply water added, m3. */
      readonly volume_m3: number;
      /**
       * Which fill this is: 0 pre-rinse, 1 main wash, 2 intermediate rinses, 3 final rinse (the
       * index of `LiquorModel.fillComposition` and of the fill fractions of `TimelineBlock`).
       */
      readonly fill: 0 | 1 | 2 | 3;
      /**
       * Volume of the fill that comes from the pre-store tank (the heat exchanger) instead of
       * the mains, m3; absent or 0 for a fill from the mains only. Added for contract-issues.md
       * R11: the sizing machine fills from its pre-store tank, whose water is not at supply
       * temperature.
       */
      readonly fromPrestore_m3?: number;
      /**
       * Temperature of the admitted water, kelvin, when the programme data gives it; absent for
       * water at the supply temperature of the wash input. M9 mixes with this temperature.
       */
      readonly temperature_K?: number;
    }
  | {
      /** Mains water is admitted to the pre-store tank, not to the sump (machine `prestore_fill`). */
      readonly kind: 'prestoreFill';
      /** Volume admitted to the tank, m3. */
      readonly volume_m3: number;
    }
  | {
      /** The softener regenerates (machine `regeneration`). */
      readonly kind: 'regeneration';
      /** Mains water used, m3. */
      readonly water_m3: number;
      /** Duration, seconds. */
      readonly duration_s: number;
    }
  | {
      /** The door opens automatically during drying (machine `door_open`). */
      readonly kind: 'doorOpen';
      /** Gap at the inside top edge of the door, metres. */
      readonly gap_m: number;
    }
  | {
      /** The liquor is pumped out, down to the carry-over. */
      readonly kind: 'drain';
    }
  | {
      /** The heater switches. */
      readonly kind: 'heater';
      /** True when the heater switches on, false when it switches off. */
      readonly on: boolean;
    }
  | {
      /** The detergent dispenser opens (the lid test and the tablet body follow, M11). */
      readonly kind: 'dispenser';
    }
  | {
      /** The rinse aid is dosed; the liquor is class R from here. */
      readonly kind: 'rinseAid';
    }
  | {
      /** The diverter switches to another state. */
      readonly kind: 'diverter';
      /** The diverter state switched to. */
      readonly state: string;
    }
  | {
      /** The circulation pump changes speed. */
      readonly kind: 'pumpSpeed';
      /** The new pump speed, rpm; 0 stops the pump. */
      readonly rpm: number;
    };

/**
 * The four fills of a programme, in the order of the fill fractions of `TimelineBlock`
 * (section M10): the index of a fill is the `fill` of a `PhaseEvent` and the argument of
 * `LiquorModel.fillComposition`.
 */
export const FILLS = ['preRinse', 'mainWash', 'intermediateRinse', 'finalRinse'] as const;

/**
 * The `kind` of every {@link PhaseEvent}: the seven of section 5.5 in its order, then the three
 * the machine package's programmes produce and the contract omits (contract-issues.md R11).
 */
export const PHASE_EVENT_KINDS: readonly PhaseEvent['kind'][] = [
  'fill',
  'drain',
  'heater',
  'dispenser',
  'rinseAid',
  'diverter',
  'pumpSpeed',
  'prestoreFill',
  'regeneration',
  'doorOpen',
];

/** Which exposure record, or which kind of pause, a tick replays (sections M4, M7.7 and M10). */
export type TickLabel = 'transient' | 'steady' | 'off' | 'drying';

/** Every {@link TickLabel}. */
export const TICK_LABELS: readonly TickLabel[] = ['transient', 'steady', 'off', 'drying'];

/**
 * One step of the whole-cycle replay, as issued by the programme controller (section M4;
 * "tick" in section 0): one master-arm revolution of the active state, 2 s with the pump off,
 * 10 s in drying.
 */
export interface MachineTick {
  /** Integer tick index n, counted from 0 (determinism rule 2). */
  readonly index: number;
  /** The active combo, or `null` while the pump is off and during drying. */
  readonly combo: ComboId | null;
  /**
   * `transient` for the first revolutions after a diverter switch in the main-wash class,
   * `steady` otherwise while circulating, `off` with the pump off, `drying` in the drying phase.
   */
  readonly label: TickLabel;
  /** Length of the tick, seconds. */
  readonly dt_s: number;
  /** Pump speed during the tick, rpm; 0 when the pump is off. */
  readonly pumpRpm: number;
  /**
   * Velocity scale of the tick against the exposure set of its combo:
   * s_V = (N / N_class) sqrt(f_H) (section M4, "Pump classes and similarity"); 1 at the class
   * centre with full prime.
   */
  readonly sV: number;
  /**
   * Flow scale of the tick against the exposure set of its combo (pass W scales loading and
   * deposition by it, section M10). The contract does not define it apart from s_V; by the
   * similarity rules of M4 flow scales as s_V.
   */
  readonly sQ: number;
  /** Head derating by air ingestion, f_H = max(1 - 2.5 alpha, 0): 1 at full prime. */
  readonly fH: number;
  /** True while the heater is on. */
  readonly heaterOn: boolean;
  /** Id of the programme step the tick belongs to, for example `P3`. */
  readonly step: string;
  /** The programme events that take effect at the start of this tick, in order. */
  readonly events: readonly PhaseEvent[];
}

// ---------------------------------------------------------------------------------------------
// Soil release (contract: section M8)
// ---------------------------------------------------------------------------------------------

/**
 * The 8 release classes of removed soil, in the order of the 8 words of `BlockRelease`
 * (section M8): the class index of every `...ByClass` array of {@link SoilRelease}.
 */
export const RELEASE_CLASSES = [
  'dissolvedProtein',
  'dissolvedCarbohydrate',
  'otherDissolved',
  'chromophore',
  'fat',
  'fines',
  'grit',
  'coarse',
] as const;

/** One of the {@link RELEASE_CLASSES}. */
export type ReleaseClass = (typeof RELEASE_CLASSES)[number];

/** Number of release classes: 8. */
export const RELEASE_CLASS_COUNT = RELEASE_CLASSES.length;

/**
 * Soil removed during one tick, reduced by sink (section M8): what the timeline hands to the
 * liquor model one tick later. Masses are exact integers in units of 1e-15 kg of dry soil
 * (`SOIL_MASS_UNIT_KG` of M1), summed in 64 bits; class indices are those of
 * {@link RELEASE_CLASSES}.
 */
export interface SoilRelease {
  /**
   * Removed mass by item and class, `[item][class]` row-major, items in the order of
   * `WashInput.items` (sorted by item id). Units of 1e-15 kg.
   */
  readonly byItemAndClass: BigInt64Array;
  /** Mass released into well-renewed films, which goes to the sump: `[class]`, 1e-15 kg. */
  readonly toSumpByClass: BigInt64Array;
  /**
   * Mass released under immersion, into the basin or gap reservoir of its block:
   * `[reservoir][class]` row-major, 1e-15 kg. Reservoir indices are those of the
   * `ReservoirLiquor` table: the basins of the scene in id order, then its gap reservoirs.
   */
  readonly toReservoirByClass: BigInt64Array;
  /** Mass released into slowly renewed films and beads (local stores): `[class]`, 1e-15 kg. */
  readonly toLocalStoreByClass: BigInt64Array;
  /** Water taken up by the soil of the whole load during the tick, kg. */
  readonly waterUptake_kg: number;
}

// ---------------------------------------------------------------------------------------------
// Rate tables (contract: section M9)
// ---------------------------------------------------------------------------------------------

/**
 * Functions of temperature alone, tabulated by the liquor model once per tick for the soil
 * kernel, and the pH table it builds once per run (sections M9 and M8 "Numerics"). The kernel
 * reads them with manual interpolation (determinism rule 10).
 */
export interface RateTables {
  /** Temperature of entry 0 of the temperature tables, kelvin. */
  readonly T0_K: number;
  /** Spacing of the temperature tables, kelvin; 64 entries cover the block temperatures present. */
  readonly dT_K: number;
  /** Protease temperature factor f_T (chemistry section 10.6), 64 entries, dimensionless. */
  readonly fTprotease: Float32Array;
  /** Amylase temperature factor f_T, 64 entries, dimensionless. */
  readonly fTamylase: Float32Array;
  /**
   * Arrhenius factor a_T per soil parameter class, 64 entries each, dimensionless. "Soil class"
   * here and in `sfc` is the parameter class of `soil.<class>.*` (one per catalogue soil id,
   * contract-issues.md R2), not the mechanism class and not the appearance class of the result.
   * The index is the position of the class in the ordered class list of the load, the same list
   * that is passed to `ParamSet.soilClassTable` and `packSoilClassTable` and that `SoilCell.class`
   * indexes.
   */
  readonly aT: readonly Float32Array[];
  /** Solid fat content SFC per soil class, 64 entries each, 0 to 1; indexed by soil class. */
  readonly sfc: readonly Float32Array[];
  /**
   * pH against (alkalinity / total carbonate, T): 64 x 32 entries, row-major with temperature
   * varying fastest. pH values are never averaged; the kernel mixes conserved quantities and
   * reads the pH of the mixture here. The contract gives no axis ranges for this table.
   */
  readonly pHTable: Float32Array;
}
