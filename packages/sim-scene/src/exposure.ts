/**
 * Exposure records that cross between modules the dependency table of docs/design/sim-core.md
 * section 4 keeps apart.
 *
 * | Record | Defined in | Written by | Read by | Why it is here |
 * |---|---|---|---|---|
 * | `JetExposure`, `JetRecordSet`, the jet levels | 5.4, M5 | M5 (gather) | M8 (soil kernel) | M8 depends on M3 and M2, not on M5 |
 * | `WettingSummary` and its cell | M7 | M8 | M7 (`wetParams`) | neither of M7 and M8 depends on the other |
 *
 * They are declared here, in the lowest module both sides reach, and are re-exported under the
 * same names by `@spotless/sim-jets`, `@spotless/sim-film` and `@spotless/sim-soil`. The layouts
 * of section 5 are a versioned schema, the frozen interface between the hydrodynamics and soil
 * teams: the owner of this package does not change them alone.
 *
 * Section 5.1: little-endian; f16 is IEEE half precision in the scaled unit given; "log u8"
 * stores v = v_min (v_max / v_min)^(code / 255) with code 0 meaning zero. These records are
 * outputs written once from f32 or integer statistics; nothing accumulates in them, so every
 * field has the role `statistic`.
 */

import type { RecordLayout, RecordOf } from '@spotless/sim-gpu';

/** Version of the exposure record layouts of section 5 (`exposureSchema: 1`). */
export const EXPOSURE_SCHEMA = 1;

// ---------------------------------------------------------------------------------------------
// JetExposure (section 5.4; module M5)
// ---------------------------------------------------------------------------------------------

/**
 * Wall-shear levels of the jet exceedance curve, pascals (sections M5 and 5.4): `tExcTau[m]` is
 * the time with jet wall shear above level m. 10 Pa is the protein threshold tau*.
 */
export const JET_TAU_LEVELS_PA = [3, 5, 10, 20, 30, 50, 100, 200] as const;

/**
 * Momentum-flux levels of the jet exceedance curve, N/m (sections M5 and 5.4): `tExcM[m]` is
 * the time with film momentum flux per unit width above level m. The peel threshold M_Y is
 * 20 N/m and above for soaked sauces.
 */
export const JET_M_LEVELS_N_PER_M = [0.25, 0.5, 1, 2, 4, 8, 16, 32] as const;

/**
 * Value ranges of the log-coded peaks of the four events of `JetExposure`. The contract codes
 * them as log u8 and gives a range only for the time above 10 Pa; these two are chosen here to
 * hold the shear levels (3 to 200 Pa) and momentum-flux levels (0.25 to 32 N/m) with a decade
 * to spare on each side.
 */
export const JET_EVENT_TAU_LOG_RANGE = { min: 1, max: 1e4 } as const;
/** See {@link JET_EVENT_TAU_LOG_RANGE}; N/m. */
export const JET_EVENT_M_LOG_RANGE = { min: 1e-2, max: 1e3 } as const;

/**
 * `JetExposure`, 56 bytes per soil cell, per (diverter state, pump class, arm state, viscosity
 * point) (section 5.4). Allocated per 8 x 8 tile of soil cells touched by any fan; a u32 tile
 * table gives the offset of each tile's records, or 0xFFFFFFFF. Times are per master
 * revolution; an arm with a different period contributes its own revolution scaled by
 * T_master / T_arm. The record is that of the dry geometry: the soil kernel attenuates it by
 * the depth of water above the cell (section M8).
 */
export const JET_EXPOSURE_LAYOUT = {
  name: 'JetExposure',
  section: '5.4',
  owner: 'M5',
  per: 'soil cell',
  byteSize: 56,
  fields: [
    {
      name: 'tExcTau',
      type: 'u16',
      offset: 0,
      count: 8,
      role: 'statistic',
      unit: 'revolution',
      scale: 2 ** -16,
      saturating: true,
      doc: 'Time with jet wall shear above each of JET_TAU_LEVELS_PA, as a fraction of the master revolution in units of 2^-16; saturates at 65,535.',
    },
    {
      name: 'tExcM',
      type: 'u16',
      offset: 16,
      count: 8,
      role: 'statistic',
      unit: 'revolution',
      scale: 2 ** -16,
      saturating: true,
      doc: 'Time with film momentum flux per unit width above each of JET_M_LEVELS_N_PER_M, in the same unit.',
    },
    {
      name: 'tauPk',
      type: 'f16',
      offset: 32,
      role: 'statistic',
      unit: 'Pa',
      doc: 'Peak wall shear.',
    },
    {
      name: 'MPk',
      type: 'f16',
      offset: 34,
      role: 'statistic',
      unit: 'N/m',
      doc: 'Peak momentum flux per unit width.',
    },
    {
      name: 'pPk',
      type: 'log8',
      offset: 36,
      role: 'statistic',
      unit: 'Pa',
      log: { min: 10, max: 1e5 },
      doc: 'Peak wall pressure, 10 Pa to 100 kPa.',
    },
    {
      name: 'nPass',
      type: 'u8',
      offset: 37,
      role: 'statistic',
      unit: '1',
      saturating: true,
      doc: 'Passes per revolution that reach the cell.',
    },
    {
      name: 'restMax',
      type: 'u8',
      offset: 38,
      role: 'statistic',
      unit: 'revolution',
      scale: 1 / 256,
      doc: 'Longest interval between passes, in units of 1/256 revolution.',
    },
    {
      name: 'flags',
      type: 'u8',
      offset: 39,
      role: 'statistic',
      unit: '-',
      bits: [
        {
          name: 'dropTrainMajority',
          lsb: 0,
          width: 1,
          doc: 'Most of the exposure came from the droplet-train part of the jets.',
        },
        { name: 'prewetted', lsb: 1, width: 1, doc: 'The pre-wetted correction was applied.' },
        { name: 'edgeClipped', lsb: 2, width: 1, doc: 'The track was clipped by an edge.' },
        { name: 'foldCrossed', lsb: 3, width: 1, doc: 'A fold was crossed.' },
        {
          name: 'cappedZone',
          lsb: 4,
          width: 1,
          doc: 'The cell lies in a capped boundary-layer zone.',
        },
        { name: 'slotSubJet', lsb: 5, width: 1, doc: 'A slot sub-jet contributed.' },
      ],
      doc: 'Bits 0 to 5 as section 5.4 lists them.',
    },
    {
      name: 'eventPhase',
      type: 'u8',
      offset: 40,
      count: 4,
      stride: 4,
      role: 'statistic',
      unit: 'revolution',
      scale: 1 / 256,
      doc: 'Phase of each of the four strongest passes (by peak shear), in phase order, in units of 1/256 revolution.',
    },
    {
      name: 'eventTauPk',
      type: 'log8',
      offset: 41,
      count: 4,
      stride: 4,
      role: 'statistic',
      unit: 'Pa',
      log: JET_EVENT_TAU_LOG_RANGE,
      doc: 'Peak wall shear of each event.',
    },
    {
      name: 'eventMPk',
      type: 'log8',
      offset: 42,
      count: 4,
      stride: 4,
      role: 'statistic',
      unit: 'N/m',
      log: JET_EVENT_M_LOG_RANGE,
      doc: 'Peak momentum flux per unit width of each event.',
    },
    {
      name: 'eventT10',
      type: 'log8',
      offset: 43,
      count: 4,
      stride: 4,
      role: 'statistic',
      unit: 's',
      log: { min: 1e-5, max: 1 },
      doc: 'Time above 10 Pa of each event, 1e-5 to 1 s.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link JET_EXPOSURE_LAYOUT} record. */
export type JetExposure = RecordOf<typeof JET_EXPOSURE_LAYOUT>;

/**
 * The jet records of one combo at one viscosity point (section M5): the gather is repeated at
 * three viscosity points (20, 45 and 65 C) and the replay interpolates in ln(nu).
 */
export interface JetRecordSet {
  /** Kinematic viscosity the records were gathered at, m2/s. */
  readonly nu_m2_s: number;
  /** `JetExposure[]`: 64 records per allocated tile, in the soil-cell order of the tile. */
  readonly records: GPUBuffer;
  /**
   * One u32 per 8 x 8 tile of soil cells: the index of the tile's first record in `records`,
   * or 0xFFFFFFFF if no fan touches the tile.
   */
  readonly tiles: GPUBuffer;
}

// ---------------------------------------------------------------------------------------------
// WettingSummary (section M7; written by M8)
// ---------------------------------------------------------------------------------------------

/**
 * One cell of the wetting summary, 2 bytes per film cell (section M7, `WettingSummary`): the
 * soil cover and the soil's contact-angle class as the film solvers see them. Both are already
 * quantised, so the solver uses exactly what the exposure cache key hashes.
 */
export const WETTING_SUMMARY_CELL_LAYOUT = {
  name: 'WettingSummaryCell',
  section: 'M7',
  owner: 'M8',
  per: 'film cell',
  byteSize: 2,
  fields: [
    {
      name: 'cover',
      type: 'u8',
      offset: 0,
      role: 'statistic',
      unit: '1',
      scale: 1 / 16,
      doc: 'Soil-covered fraction of the film cell in sixteenths, 0 to 16.',
    },
    {
      name: 'angleClass',
      type: 'u8',
      offset: 1,
      role: 'statistic',
      unit: '-',
      doc: 'Contact-angle class of the soil on the cell: index into the soil angle table of the registry (the contract does not enumerate the classes).',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link WETTING_SUMMARY_CELL_LAYOUT} record. */
export type WettingSummaryCell = RecordOf<typeof WETTING_SUMMARY_CELL_LAYOUT>;

/**
 * The soil-dependent wetting summary handed from the soil model to the film solvers (sections
 * M7 and M8): what `FilmStage.wetParams` mixes with the material angles as a Cassie average.
 */
export interface WettingSummary {
  /** `WettingSummaryCell[]`: 2 x u8 per film cell of the grid it was made for; written by M8. */
  readonly perFilmCell: GPUBuffer;
  /** Hash of the quantised content; part of the exposure cache key (section M12). */
  readonly hash: string;
}
