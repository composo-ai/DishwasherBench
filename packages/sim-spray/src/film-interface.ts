/**
 * The buffers of the film stage that the spray kernels bind (docs/design/sim-core.md
 * sections M7.1, M7.3 and M7.8; `FilmBuffers` and `WallStateTable` of section M6).
 *
 * These records belong to M7 by the contract. Live parcels write deposits into the film's
 * accumulators and read the wet state of the cell they land on, and the Monte Carlo reads the
 * pilot's wet estimate, but M6 may not depend on M7 (M7 depends on M6), so the layouts are
 * declared here, in the lowest module that needs them, and are re-exported under the same names
 * by `@spotless/sim-film`:
 *
 * | Record | Defined in | Written by | Read by M6 for |
 * |---|---|---|---|
 * | deposit accumulators (S cell, K block) | M7.1 | M5 emitters, M6 parcels, M7 | deposits |
 * | `SFilm` | M7.8 | M7 | wet flag and thickness at impact |
 * | `KHot`, the regime codes | M7.3, M7.8 | M7 | regime and film mass at impact |
 * | `SteadyWet` | M7.2 | M7 pilot | wall state of the Monte Carlo |
 *
 * Every state and accumulator field is f32, u32 or i32 (section M7.8). The narrow fields are a
 * pressure that is written whole every base step, flag and regime codes that are written whole,
 * a counter with a registered bound, and a width fraction that is recomputed every step.
 */

import type { RecordLayout, RecordOf } from '@spotless/sim-scene';

/**
 * Wetting regime of a cascade block (section M7.3), numbered in the order the contract lists
 * the regimes. The code is stored in `KHot.regime`, in bits 0 to 1 of `FilmExposure.flags` and
 * in `TimelineBlock.regime`.
 */
export const REGIME_CODES = { DRY: 0, BEAD: 1, RIVULET: 2, FILM: 3 } as const;

/** Name of a wetting regime of the cascade. */
export type Regime = keyof typeof REGIME_CODES;

// ---------------------------------------------------------------------------------------------
// Deposit accumulators (section M7.1)
// ---------------------------------------------------------------------------------------------

/**
 * Deposit accumulator of one S film cell, 20 bytes: five i32 words written with `atomicAdd`
 * (section M7.1). Double-buffered (`current` and `next`) and cleared every base step. An i32
 * holds +/- 2.1 g, or +/- 2.1e-3 kg m/s, per base step.
 */
export const S_DEPOSIT_LAYOUT = {
  name: 'SDeposit',
  section: 'M7.1',
  owner: 'M7',
  per: 'S film cell',
  byteSize: 20,
  fields: [
    {
      name: 'filmMass',
      type: 'i32',
      offset: 0,
      role: 'accumulator',
      unit: 'kg',
      scale: 1e-12,
      bound: 2 ** 31 - 1,
      doc: 'Liquid that arrives as a film (ring emitters, stitch and contact transfers, pool overflow, LINE outflow) and joins the film at once.',
    },
    {
      name: 'airborneMass',
      type: 'i32',
      offset: 4,
      role: 'accumulator',
      unit: 'kg',
      scale: 1e-12,
      bound: 2 ** 31 - 1,
      doc: 'Liquid that arrives through the air (parcels, Monte Carlo); goes to the bead store while the cell is not film-wet.',
    },
    {
      name: 'momentum',
      type: 'i32',
      offset: 8,
      count: 2,
      role: 'accumulator',
      unit: 'kg m/s',
      scale: 1e-12,
      bound: 2 ** 31 - 1,
      doc: 'Tangential momentum of the deposits in the cell frame (e_s, e_theta) or (u, v).',
    },
    {
      name: 'normalMomentum',
      type: 'i32',
      offset: 16,
      role: 'accumulator',
      unit: 'kg m/s',
      scale: 1e-12,
      bound: 2 ** 31 - 1,
      doc: 'Normal momentum of the deposits, from which the impact pressure p_imp follows.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link S_DEPOSIT_LAYOUT} record. */
export type SDeposit = RecordOf<typeof S_DEPOSIT_LAYOUT>;

/**
 * Deposit accumulator of one K block, 8 bytes: two i32 words (section M7.1). The cascade
 * ignores momentum.
 */
export const K_DEPOSIT_LAYOUT = {
  name: 'KDeposit',
  section: 'M7.1',
  owner: 'M7',
  per: 'K block',
  byteSize: 8,
  fields: [
    {
      name: 'filmMass',
      type: 'i32',
      offset: 0,
      role: 'accumulator',
      unit: 'kg',
      scale: 1e-12,
      bound: 2 ** 31 - 1,
      doc: 'Liquid that arrives as a film.',
    },
    {
      name: 'airborneMass',
      type: 'i32',
      offset: 4,
      role: 'accumulator',
      unit: 'kg',
      scale: 1e-12,
      bound: 2 ** 31 - 1,
      doc: 'Liquid that arrives through the air; joins the bead store unless the block is FILM or RIVULET.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link K_DEPOSIT_LAYOUT} record. */
export type KDeposit = RecordOf<typeof K_DEPOSIT_LAYOUT>;

// ---------------------------------------------------------------------------------------------
// Film state (section M7.8)
// ---------------------------------------------------------------------------------------------

/**
 * `SFilm`, 16 bytes per S film cell, two copies (section M7.8): the state of the inertial
 * shallow-film solver. Stage 1 reads copy A and writes B; stage 2 reads B and A and writes A.
 */
export const S_FILM_LAYOUT = {
  name: 'SFilm',
  section: 'M7.8',
  owner: 'M7',
  per: 'S film cell',
  byteSize: 16,
  fields: [
    { name: 'h', type: 'f32', offset: 0, role: 'state', unit: 'm', doc: 'Film thickness.' },
    {
      name: 'q1',
      type: 'f32',
      offset: 4,
      role: 'state',
      unit: 'm2/s',
      doc: 'Flux h u along the first axis of the cell frame (e_s or u).',
    },
    {
      name: 'q2',
      type: 'f32',
      offset: 8,
      role: 'state',
      unit: 'm2/s',
      doc: 'Flux along the second axis (e_theta or v).',
    },
    {
      name: 'pImp',
      type: 'f16',
      offset: 12,
      role: 'statistic',
      unit: 'Pa',
      doc: 'Normal-momentum pressure of the deposits of this base step; written whole by `s_apply` and constant during the step (low half of the state word).',
    },
    {
      name: 'flags',
      type: 'u16',
      offset: 14,
      role: 'statistic',
      unit: '-',
      bits: [
        {
          name: 'wet',
          lsb: 0,
          width: 1,
          doc: 'The cell is film-wet; updated by every stage from the h it writes.',
        },
        {
          name: 'immersed',
          lsb: 1,
          width: 1,
          doc: 'The cell lies below the level of a lumped basin or in a filled gap.',
        },
        { name: 'seam', lsb: 2, width: 1, doc: 'The cell borders a seam or stitch.' },
        { name: 'gutterRow', lsb: 3, width: 1, doc: 'The cell is in a gutter row.' },
        {
          name: 'edgePin',
          lsb: 4,
          width: 12,
          doc: 'Edge-pin code of the pinned-edge rule; the contract fixes neither its width nor its coding.',
        },
      ],
      doc: 'Flags, written whole (high half of the state word).',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link S_FILM_LAYOUT} record. */
export type SFilm = RecordOf<typeof S_FILM_LAYOUT>;

/**
 * `KHot`, 16 bytes per block, two copies (section M7.8): the state of the kinematic cascade.
 * Every block has one; S-class blocks hold the restriction of their S cells.
 */
export const K_HOT_LAYOUT = {
  name: 'KHot',
  section: 'M7.8',
  owner: 'M7',
  per: 'block',
  byteSize: 16,
  fields: [
    {
      name: 'm',
      type: 'u32',
      offset: 0,
      role: 'state',
      unit: 'kg',
      scale: 1e-12,
      bound: 2 ** 32 - 1,
      doc: 'Film mass m_u on the block; h = m / (rho A).',
    },
    {
      name: 'q',
      type: 'u32',
      offset: 4,
      role: 'state',
      unit: 'kg',
      scale: 1e-12,
      bound: 2 ** 32 - 1,
      doc: 'Outflow q_u of the last step: exactly what left the block.',
    },
    {
      name: 'b',
      type: 'u32',
      offset: 8,
      role: 'state',
      unit: 'kg',
      scale: 1e-12,
      bound: 2 ** 32 - 1,
      doc: 'Bead store b_u.',
    },
    {
      name: 'dewetCounter',
      type: 'u16',
      offset: 12,
      role: 'counter',
      unit: 'base steps',
      bound: 65535,
      saturating: true,
      doc: 'Base steps the block has stayed below the receding threshold; 65,535 is 128 s.',
    },
    {
      name: 'regime',
      type: 'u8',
      offset: 14,
      role: 'statistic',
      unit: '-',
      doc: 'REGIME_CODES; written whole by the regime machine.',
    },
    {
      name: 'f',
      type: 'u8',
      offset: 15,
      role: 'statistic',
      unit: '1',
      scale: 1 / 255,
      doc: 'Wetted width fraction f; recomputed every step.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link K_HOT_LAYOUT} record. */
export type KHot = RecordOf<typeof K_HOT_LAYOUT>;

// ---------------------------------------------------------------------------------------------
// The pilot's wet estimate (section M7.2)
// ---------------------------------------------------------------------------------------------

/**
 * One word of the `steadyWet` bitset (sections M7.2 and M6): 1 bit per block, 32 blocks per
 * word; block i is bit `i % 32` of word `i >> 5`. Set where the pilot classes the block as
 * film-wet in the time mean.
 */
export const STEADY_WET_LAYOUT = {
  name: 'SteadyWet',
  section: 'M7.2',
  owner: 'M7',
  per: '32 blocks',
  byteSize: 4,
  fields: [
    {
      name: 'bits',
      type: 'u32',
      offset: 0,
      role: 'statistic',
      unit: '-',
      doc: 'One bit per block, lowest bit first.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link STEADY_WET_LAYOUT} record. */
export type SteadyWet = RecordOf<typeof STEADY_WET_LAYOUT>;
