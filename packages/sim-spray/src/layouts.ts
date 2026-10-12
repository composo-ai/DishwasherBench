/**
 * Binary records of module M6 (docs/design/sim-core.md section M6), as data, in the conventions
 * of `layout.ts` of `@spotless/sim-gpu`. (`SourceRecord`, which that section also describes, is
 * written by M5 and declared in `@spotless/sim-jets`.)
 *
 * Choices the contract leaves open (the byte order of the packed table, the unit of the impact
 * duty counters, the frame of the mean velocity, the flag bits) are marked where they are made
 * and reported as contract issues.
 */

import type { RecordLayout, RecordOf } from '@spotless/sim-scene';

/**
 * Fixed-point unit of the momentum sums of the Monte Carlo accumulator, kg m/s per integer unit
 * (section M6): a statistic for the mean arrival velocity, with hashed stochastic rounding.
 */
export const MC_MOMENTUM_UNIT_KG_M_S = 1e-9;

/** Fixed-point unit of the split-half masses of the Monte Carlo accumulator, kg (section M6). */
export const SPLIT_HALF_MASS_UNIT_KG = 1e-10;

/**
 * Fixed-point unit of the impact-duty counters, m2 s per integer unit. The contract says the
 * counters accumulate "the area-time of impacts" and fixes no unit; this one resolves an
 * area-time fraction of 1e-6 on a 4 mm2 block over one revolution and holds a fraction of 1
 * over every recorded revolution.
 */
export const IMPACT_DUTY_UNIT_M2_S = 1e-12;

/**
 * Largest mass one bin of the Monte Carlo accumulator may hold, in units of 1e-12 kg
 * (section M6): the split-half sums bound every bin of their block, and a block whose bound
 * exceeds 2^31 units is counted as saturated and fails the run.
 */
export const MC_BIN_BOUND_UNITS = 2 ** 31;

/** Value range of the log-coded impact duties of the packed table: an area-time fraction. */
export const IMPACT_DUTY_LOG_RANGE = { min: 1e-6, max: 1 } as const;

// ---------------------------------------------------------------------------------------------
// Parcels
// ---------------------------------------------------------------------------------------------

/**
 * `Parcel`, 48 bytes per parcel slot (section M6). Mass is an integer from birth, so no step of
 * a parcel's life rounds it. A parcel that ends in the sump region, leaks or exceeds its
 * segment limit writes its fate and mass into its own slot.
 */
export const PARCEL_LAYOUT = {
  name: 'Parcel',
  section: 'M6',
  owner: 'M6',
  per: 'parcel',
  byteSize: 48,
  fields: [
    {
      name: 'position',
      type: 'f32',
      offset: 0,
      count: 3,
      role: 'state',
      unit: 'm',
      doc: 'Position in the tub frame.',
    },
    {
      name: 'velocity',
      type: 'f32',
      offset: 12,
      count: 3,
      role: 'state',
      unit: 'm/s',
      doc: 'Velocity in the tub frame.',
    },
    {
      name: 'mass',
      type: 'u32',
      offset: 24,
      role: 'state',
      unit: 'kg',
      scale: 1e-12,
      bound: 2 ** 32 - 1,
      doc: 'Mass in units of 1e-12 kg; in Monte Carlo mode the mass the parcel represents per revolution of its arm.',
    },
    {
      name: 'diameter',
      type: 'f32',
      offset: 28,
      role: 'state',
      unit: 'm',
      doc: 'Droplet diameter.',
    },
    {
      name: 'birthStep',
      type: 'u32',
      offset: 32,
      role: 'static',
      unit: 'base steps',
      doc: 'Base step at which the parcel was born.',
    },
    {
      name: 'lineage',
      type: 'u32',
      offset: 36,
      count: 2,
      role: 'static',
      unit: '-',
      doc: 'Lineage: the key of every random draw of the parcel and its children (determinism rule 8).',
    },
    {
      name: 'kindFlagsFate',
      type: 'u32',
      offset: 44,
      role: 'state',
      unit: '-',
      doc: 'Kind, flags and fate; the contract does not fix the bits.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link PARCEL_LAYOUT} record. */
export type Parcel = RecordOf<typeof PARCEL_LAYOUT>;

// ---------------------------------------------------------------------------------------------
// Monte Carlo tables
// ---------------------------------------------------------------------------------------------

/**
 * The Monte Carlo accumulator, 288 bytes per block (section M6; stage F only): integer sums
 * written with `atomicAdd`, binned by the phase of the arm that owns the sources at emission
 * plus flight time.
 */
export const MC_ACCUMULATOR_LAYOUT = {
  name: 'McAccumulator',
  section: 'M6',
  owner: 'M6',
  per: 'block',
  byteSize: 288,
  fields: [
    {
      name: 'mass',
      type: 'u32',
      offset: 0,
      count: 64,
      role: 'accumulator',
      unit: 'kg/revolution',
      scale: 1e-12,
      bound: MC_BIN_BOUND_UNITS,
      doc: 'Mass deposited on the block per revolution of the arm, by phase bin, in units of 1e-12 kg.',
    },
    {
      name: 'momentum',
      type: 'i32',
      offset: 256,
      count: 3,
      role: 'accumulator',
      unit: 'kg m/s',
      scale: MC_MOMENTUM_UNIT_KG_M_S,
      bound: 2 ** 31 - 1,
      doc: 'Momentum sum of the deposits in the tub frame, in units of 1e-9 kg m/s, with hashed stochastic rounding: a statistic for the mean arrival velocity, not a ledger.',
    },
    {
      name: 'parcels',
      type: 'u32',
      offset: 268,
      role: 'counter',
      unit: '1',
      bound: 2 ** 32 - 1,
      doc: 'Number of parcels that deposited on the block.',
    },
    {
      name: 'impactDuty',
      type: 'u32',
      offset: 272,
      count: 2,
      role: 'accumulator',
      unit: 'm2 s',
      scale: IMPACT_DUTY_UNIT_M2_S,
      bound: 2 ** 32 - 1,
      doc: 'Area-time of impacts whose stagnation shear exceeds 3 Pa and 10 Pa.',
    },
    {
      name: 'splitHalfMass',
      type: 'u32',
      offset: 280,
      count: 2,
      role: 'accumulator',
      unit: 'kg/revolution',
      scale: SPLIT_HALF_MASS_UNIT_KG,
      bound: 2 ** 32 - 1,
      doc: 'Mass deposited by the parcels with even and with odd sample index, in units of 1e-10 kg.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link MC_ACCUMULATOR_LAYOUT} record. */
export type McAccumulator = RecordOf<typeof MC_ACCUMULATOR_LAYOUT>;

/**
 * The packed deposition table for the film stage, 144 bytes per block (section M6). The mass of
 * bin b is `mantissa[b] << shift` in the accumulator's unit of 1e-12 kg per revolution, so the
 * hop from M6 to M7 is integer and exact. Packing carries the truncated low bits of each bin
 * into the next and books one last carry to the block's largest bin or to the ledger account
 * `packRemainder`.
 *
 * The contract lists the fields without offsets and in an order that cannot be aligned (an i16
 * after a single u8); the order here keeps every field aligned to its own size.
 */
export const PACKED_DEPOSITION_LAYOUT = {
  name: 'PackedDeposition',
  section: 'M6',
  owner: 'M6',
  per: 'block',
  byteSize: 144,
  fields: [
    {
      name: 'mantissa',
      type: 'u16',
      offset: 0,
      count: 64,
      role: 'statistic',
      unit: '-',
      doc: 'Mantissa of the mass of each phase bin; the mass is mantissa << shift units of 1e-12 kg per revolution.',
    },
    {
      name: 'meanFlux',
      type: 'f32',
      offset: 128,
      role: 'statistic',
      unit: 'kg/(m2 s)',
      doc: 'Smoothed mean flux onto the block (masked smoothing of section M6).',
    },
    {
      name: 'meanVelocity',
      type: 'i16',
      offset: 132,
      count: 3,
      role: 'statistic',
      unit: 'm/s',
      scale: 1e-3,
      doc: 'Mean arrival velocity in the tub frame, stored in mm/s.',
    },
    {
      name: 'shift',
      type: 'u8',
      offset: 138,
      role: 'statistic',
      unit: '-',
      doc: 'Left shift of every mantissa of the block.',
    },
    {
      name: 'smoothingLevel',
      type: 'u8',
      offset: 139,
      role: 'statistic',
      unit: '-',
      doc: 'Which of the three smoothing windows gave `meanFlux`: 0, 1 or 2.',
    },
    {
      name: 'flags',
      type: 'u8',
      offset: 140,
      role: 'statistic',
      unit: '-',
      bits: [
        {
          name: 'sparse',
          lsb: 0,
          width: 1,
          doc: 'Even the largest window holds fewer than 16 parcels.',
        },
        {
          name: 'sheetFed',
          lsb: 1,
          width: 1,
          doc: 'Dense deposit of a sheet or curtain landing; kept at block resolution.',
        },
        {
          name: 'gap',
          lsb: 2,
          width: 1,
          doc: 'Deposits were credited to the gap reservoir of the block.',
        },
      ],
      doc: 'sparse, sheet-fed, gap.',
    },
    {
      name: 'impactDuty',
      type: 'log8',
      offset: 141,
      count: 2,
      role: 'statistic',
      unit: '1',
      log: IMPACT_DUTY_LOG_RANGE,
      doc: 'Area-time fraction of the block under impacts above 3 Pa and above 10 Pa.',
    },
    { name: 'spare', type: 'u8', offset: 143, role: 'static', unit: '-', pad: true, doc: 'Spare.' },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link PACKED_DEPOSITION_LAYOUT} record. */
export type PackedDeposition = RecordOf<typeof PACKED_DEPOSITION_LAYOUT>;

/**
 * The impact-duty counters of time-coupled mode, 8 bytes per block (section M6, "Deposits";
 * `FilmBuffers.impactDuty`): the same two counters as in the Monte Carlo accumulator. The
 * contract says "two more counters per block" and fixes no layout.
 */
export const IMPACT_DUTY_LAYOUT = {
  name: 'ImpactDuty',
  section: 'M6',
  owner: 'M6',
  per: 'block',
  byteSize: 8,
  fields: [
    {
      name: 'areaTime',
      type: 'u32',
      offset: 0,
      count: 2,
      role: 'accumulator',
      unit: 'm2 s',
      scale: IMPACT_DUTY_UNIT_M2_S,
      bound: 2 ** 32 - 1,
      doc: 'Area-time of impacts whose stagnation shear exceeds 3 Pa and 10 Pa, over the recorded revolutions.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link IMPACT_DUTY_LAYOUT} record. */
export type ImpactDuty = RecordOf<typeof IMPACT_DUTY_LAYOUT>;
