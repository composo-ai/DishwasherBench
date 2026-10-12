/**
 * Binary records of module M7 (docs/design/sim-core.md sections M7.1, M7.8, 5.2 and 5.3), as
 * data, in the conventions of `layout.ts` of `@spotless/sim-gpu`.
 *
 * The exposure records `FilmExposure` and `DrainDown` are outputs written once from f32 or
 * integer statistics; nothing accumulates in them (section 5.1), so every field of theirs has
 * the role `statistic`. In `FilmStats` the sums are f32 state, peaks and snapshots are
 * statistics and the sample counters are u16 with a registered bound (section M7.8).
 *
 * The contract gives no scaled units for the f16 fields of `KParams` and `FilmStats`; those of
 * the matching fields of `FilmExposure` are used, micrometres for thicknesses, and the choice
 * is reported as a contract issue, as are the types of the tile monitor's four values.
 */

import { GAP_LOG_RANGE, type RecordLayout, type RecordOf } from '@spotless/sim-scene';
import { FILM_STATS_COUNTER_BOUND } from './types.ts';

// ---------------------------------------------------------------------------------------------
// Solver state and parameters (section M7.8)
// ---------------------------------------------------------------------------------------------

/**
 * `SSlow`, 8 bytes per S film cell (section M7.8): the bead store of the S solver. Read and
 * written by `s_apply` only, once per base step.
 */
export const S_SLOW_LAYOUT = {
  name: 'SSlow',
  section: 'M7.8',
  owner: 'M7',
  per: 'S film cell',
  byteSize: 8,
  fields: [
    {
      name: 'b',
      type: 'f32',
      offset: 0,
      role: 'state',
      unit: 'm',
      doc: 'Bead store b as an equivalent thickness.',
    },
    { name: 'spare', type: 'u32', offset: 4, role: 'static', unit: '-', pad: true, doc: 'Spare.' },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link S_SLOW_LAYOUT} record. */
export type SSlow = RecordOf<typeof S_SLOW_LAYOUT>;

/**
 * `SStatic`, 8 bytes per S film cell (section M7.8): the wetting parameters of a cell, rebuilt
 * by `wetParams` at every exposure. The contact-line resistances are
 * R = beta_cl sigma (1 - cos(theta + xi)), with the soil mix and the frozen offset field xi
 * already in the stored values.
 */
export const S_STATIC_LAYOUT = {
  name: 'SStatic',
  section: 'M7.8',
  owner: 'M7',
  per: 'S film cell',
  byteSize: 8,
  fields: [
    {
      name: 'oneMinusCosAdvancing',
      type: 'u16',
      offset: 0,
      role: 'static',
      unit: '1',
      scale: 2 / 65535,
      doc: '1 - cos(theta_a + xi) with the soil mix, 0 to 2.',
    },
    {
      name: 'oneMinusCosReceding',
      type: 'u16',
      offset: 2,
      role: 'static',
      unit: '1',
      scale: 2 / 65535,
      doc: '1 - cos(theta_r + xi) with the soil mix, 0 to 2.',
    },
    {
      name: 'gap',
      type: 'log8',
      offset: 4,
      role: 'static',
      unit: 'm',
      log: GAP_LOG_RANGE,
      doc: "Gap of the cell's block, the code of `BlockStatic.gap`.",
    },
    {
      name: 'deltaOn',
      type: 'log8',
      offset: 5,
      role: 'static',
      unit: 'm',
      log: { min: 1e-6, max: 1e-3 },
      doc: 'Onset thickness delta_on = m_on / rho, 1 um to 1 mm: the cell becomes wet above it.',
    },
    {
      name: 'element',
      type: 'u16',
      offset: 6,
      role: 'static',
      unit: '-',
      doc: 'Gutter or link element of the cell, or 0xFFFF.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link S_STATIC_LAYOUT} record. */
export type SStatic = RecordOf<typeof S_STATIC_LAYOUT>;

/**
 * `KParams`, 32 bytes per block (section M7.8): geometry and wetting thresholds of the cascade
 * for one liquor class, rebuilt by `wetParams` at every exposure.
 */
export const K_PARAMS_LAYOUT = {
  name: 'KParams',
  section: 'M7.8',
  owner: 'M7',
  per: 'block',
  byteSize: 32,
  fields: [
    {
      name: 'area',
      type: 'f32',
      offset: 0,
      role: 'static',
      unit: 'm2',
      doc: 'Area A of the block.',
    },
    {
      name: 'W',
      type: 'f16',
      offset: 4,
      role: 'static',
      unit: 'm',
      scale: 1e-3,
      doc: 'Width of the block across the flow, stored in mm.',
    },
    {
      name: 'gS',
      type: 'f16',
      offset: 6,
      role: 'static',
      unit: 'm/s2',
      doc: 'Gravity along the surface, g_s = g sin(beta).',
    },
    {
      name: 'donorMask',
      type: 'u8',
      offset: 8,
      role: 'static',
      unit: '-',
      doc: 'One bit per surrounding block of the patch: set where that neighbour drains into this block.',
    },
    {
      name: 'flags',
      type: 'u8',
      offset: 9,
      role: 'static',
      unit: '-',
      bits: [
        {
          name: 'chosenReceiver',
          lsb: 0,
          width: 1,
          doc: "Which of the block's two receivers takes its whole flow in the RIVULET regime: 0 receiver A, 1 receiver B.",
        },
        { name: 'gutter', lsb: 1, width: 1, doc: 'The block hands liquid to a gutter.' },
        { name: 'pit', lsb: 2, width: 1, doc: 'The block is a basin pit.' },
        { name: 'dripSite', lsb: 3, width: 1, doc: 'The block is a drip site.' },
      ],
      doc: 'chosen receiver, gutter, pit, drip site.',
    },
    {
      name: 'donorWeight',
      type: 'u8',
      offset: 10,
      count: 8,
      role: 'static',
      unit: '1',
      scale: 1 / 255,
      doc: "Share of each masked neighbour's outflow that reaches this block; the two weights of a donor sum to exactly 255.",
    },
    {
      name: 'gammaStarA',
      type: 'f16',
      offset: 18,
      role: 'static',
      unit: 'kg/(m s)',
      scale: 1e-3,
      doc: 'Advancing wetting threshold Gamma*_a, stored in g/(m s).',
    },
    {
      name: 'gammaStarR',
      type: 'f16',
      offset: 20,
      role: 'static',
      unit: 'kg/(m s)',
      scale: 1e-3,
      doc: 'Receding wetting threshold Gamma*_r, stored in g/(m s).',
    },
    {
      name: 'mOn',
      type: 'f16',
      offset: 22,
      role: 'static',
      unit: 'kg/m2',
      scale: 1e-3,
      doc: 'Onset mass per area m_on, stored in g/m2.',
    },
    {
      name: 'bMax',
      type: 'f16',
      offset: 24,
      role: 'static',
      unit: 'm',
      scale: 1e-6,
      doc: 'Largest immobile bead load b_max as an equivalent thickness, stored in um.',
    },
    {
      name: 'deltaWet',
      type: 'f16',
      offset: 26,
      role: 'static',
      unit: 'm',
      scale: 1e-6,
      doc: 'Thickness delta_wet at which spray-collected liquid forms a film, stored in um.',
    },
    {
      name: 'tDw',
      type: 'u16',
      offset: 28,
      role: 'static',
      unit: 'base steps',
      doc: 'Dewetting time t_dw = l_dw / V_dw in base steps.',
    },
    { name: 'spare', type: 'u16', offset: 30, role: 'static', unit: '-', pad: true, doc: 'Spare.' },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link K_PARAMS_LAYOUT} record. */
export type KParams = RecordOf<typeof K_PARAMS_LAYOUT>;

// ---------------------------------------------------------------------------------------------
// Statistics and monitors (sections M7.1 and M7.8)
// ---------------------------------------------------------------------------------------------

/**
 * `FilmStats`, 80 bytes per film cell, over the recorded revolutions (section M7.8). Sampled
 * every `film.statStride` = 2 base steps, at the end of the step, so a sample is 4 ms and
 * counts are numbers of samples. A `bin_close` pass at the end of each phase bin of the master
 * arm turns the bin sums into bin means, updates the peaks and zeroes them.
 */
export const FILM_STATS_LAYOUT = {
  name: 'FilmStats',
  section: 'M7.8',
  owner: 'M7',
  per: 'film cell',
  byteSize: 80,
  fields: [
    {
      name: 'sumGamma',
      type: 'f32',
      offset: 0,
      role: 'state',
      unit: 'kg/(m s)',
      doc: 'Sum over samples of the mass flow per width leaving the cell.',
    },
    {
      name: 'sumH',
      type: 'f32',
      offset: 4,
      role: 'state',
      unit: 'm',
      doc: 'Sum of h over flowing samples.',
    },
    {
      name: 'sumTau',
      type: 'f32',
      offset: 8,
      role: 'state',
      unit: 'Pa',
      doc: 'Sum of the wall shear over flowing samples.',
    },
    {
      name: 'sumM',
      type: 'f32',
      offset: 12,
      role: 'state',
      unit: 'N/m',
      doc: 'Sum of the film momentum flux per width over flowing samples.',
    },
    {
      name: 'sumDep',
      type: 'f32',
      offset: 16,
      role: 'state',
      unit: 'kg/m2',
      doc: 'Deposited airborne mass per area.',
    },
    {
      name: 'sumBead',
      type: 'f32',
      offset: 20,
      role: 'state',
      unit: '1',
      doc: 'Sum of b / b_max over samples that are not film-wet.',
    },
    {
      name: 'sumWidth',
      type: 'f32',
      offset: 24,
      role: 'state',
      unit: '1',
      doc: 'Sum of the wetted width fraction over wet samples (1 per sample for S).',
    },
    {
      name: 'binGamma',
      type: 'f32',
      offset: 28,
      role: 'state',
      unit: 'kg/(m s)',
      doc: 'Sum of the mass flow per width within the current phase bin of the master arm.',
    },
    {
      name: 'binTau',
      type: 'f32',
      offset: 32,
      role: 'state',
      unit: 'Pa',
      doc: 'Sum of the wall shear within the current phase bin.',
    },
    {
      name: 'binM',
      type: 'f32',
      offset: 36,
      role: 'state',
      unit: 'N/m',
      doc: 'Sum of the momentum flux within the current phase bin.',
    },
    {
      name: 'snapGamma',
      type: 'f32',
      offset: 40,
      role: 'statistic',
      unit: 'kg/(m s)',
      doc: 'sumGamma after the first recorded revolution.',
    },
    {
      name: 'peakGamma',
      type: 'f16',
      offset: 44,
      role: 'statistic',
      unit: 'kg/(m s)',
      scale: 1e-3,
      doc: 'Largest bin mean of the mass flow per width, stored in g/(m s).',
    },
    {
      name: 'peakTau',
      type: 'f16',
      offset: 46,
      role: 'statistic',
      unit: 'Pa',
      doc: 'Largest bin mean of the wall shear.',
    },
    {
      name: 'peakM',
      type: 'f16',
      offset: 48,
      role: 'statistic',
      unit: 'N/m',
      doc: 'Largest bin mean of the momentum flux.',
    },
    {
      name: 'tauMaxSample',
      type: 'f16',
      offset: 50,
      role: 'statistic',
      unit: 'Pa',
      doc: 'Largest single sample of the wall shear.',
    },
    {
      name: 'nFlow',
      type: 'u16',
      offset: 52,
      role: 'counter',
      unit: 'samples',
      bound: FILM_STATS_COUNTER_BOUND,
      doc: 'Samples with h above the flow threshold.',
    },
    {
      name: 'nWet',
      type: 'u16',
      offset: 54,
      role: 'counter',
      unit: 'samples',
      bound: FILM_STATS_COUNTER_BOUND,
      doc: 'Film-wet samples.',
    },
    {
      name: 'nImm',
      type: 'u16',
      offset: 56,
      role: 'counter',
      unit: 'samples',
      bound: FILM_STATS_COUNTER_BOUND,
      doc: 'Immersed samples.',
    },
    {
      name: 'nBin',
      type: 'u16',
      offset: 58,
      role: 'counter',
      unit: 'samples',
      bound: FILM_STATS_COUNTER_BOUND,
      doc: 'Samples in the current phase bin.',
    },
    {
      name: 'nTau',
      type: 'u16',
      offset: 60,
      count: 5,
      role: 'counter',
      unit: 'samples',
      bound: FILM_STATS_COUNTER_BOUND,
      doc: 'Samples with film shear above each of FILM_TAU_LEVELS_PA: 0.5, 1, 2, 4 and 10 Pa.',
    },
    {
      name: 'dryRun',
      type: 'u16',
      offset: 70,
      role: 'counter',
      unit: 'samples',
      bound: FILM_STATS_COUNTER_BOUND,
      doc: 'Current run of samples that are not wet.',
    },
    {
      name: 'dryMax',
      type: 'u16',
      offset: 72,
      role: 'statistic',
      unit: 'samples',
      doc: 'Longest run of samples that are not wet.',
    },
    {
      name: 'snapWet',
      type: 'u16',
      offset: 74,
      role: 'statistic',
      unit: 'samples',
      doc: 'nWet after the first recorded revolution.',
    },
    { name: 'spare', type: 'u32', offset: 76, role: 'static', unit: '-', pad: true, doc: 'Spare.' },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link FILM_STATS_LAYOUT} record. */
export type FilmStats = RecordOf<typeof FILM_STATS_LAYOUT>;

/**
 * The tile monitor, 16 bytes per 8 x 8 tile of film cells (section M7.1, pass 7): written by
 * one invocation per tile once per half phase bin and read back once per phase bin. The
 * contract names the four values and the size; one 32-bit word each is the reading taken here.
 */
export const TILE_MONITOR_LAYOUT = {
  name: 'TileMonitor',
  section: 'M7.1',
  owner: 'M7',
  per: 'tile of 8 x 8 film cells',
  byteSize: 16,
  fields: [
    {
      name: 'waveRate',
      type: 'f32',
      offset: 0,
      role: 'statistic',
      unit: '1/s',
      doc: 'Largest wave rate lambda = (|u| + c) / Delta over the tile.',
    },
    {
      name: 'anyWet',
      type: 'u32',
      offset: 4,
      role: 'statistic',
      unit: '-',
      doc: 'Non-zero when any cell of the tile is wet or holds beads.',
    },
    {
      name: 'nonFinite',
      type: 'u32',
      offset: 8,
      role: 'statistic',
      unit: '1',
      doc: 'Number of float words of the tile whose exponent bits are all ones.',
    },
    {
      name: 'parcelHighWater',
      type: 'u32',
      offset: 12,
      role: 'statistic',
      unit: '1',
      doc: 'Parcel slot high-water mark.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link TILE_MONITOR_LAYOUT} record. */
export type TileMonitor = RecordOf<typeof TILE_MONITOR_LAYOUT>;

// ---------------------------------------------------------------------------------------------
// Exposure records (sections 5.2 and 5.3)
// ---------------------------------------------------------------------------------------------

/**
 * `FilmExposure`, 32 bytes per film cell, per combo and label (section 5.2): what the film did
 * on a cell over the recorded revolutions of one periodic solve. Duties are numbers of 4 ms
 * samples over the samples recorded.
 */
export const FILM_EXPOSURE_LAYOUT = {
  name: 'FilmExposure',
  section: '5.2',
  owner: 'M7',
  per: 'film cell',
  byteSize: 32,
  fields: [
    {
      name: 'gammaMean',
      type: 'f16',
      offset: 0,
      role: 'statistic',
      unit: 'kg/(m s)',
      scale: 1e-3,
      doc: 'Time-mean mass flow per unit width leaving the cell, stored in g/(m s).',
    },
    {
      name: 'gammaPeak',
      type: 'f16',
      offset: 2,
      role: 'statistic',
      unit: 'kg/(m s)',
      scale: 1e-3,
      doc: 'Largest phase-bin mean (64 bins of the master arm), stored in g/(m s).',
    },
    {
      name: 'hMean',
      type: 'f16',
      offset: 4,
      role: 'statistic',
      unit: 'm',
      scale: 1e-6,
      doc: 'Time-mean film thickness while flowing (inside the wetted width for the cascade), stored in um.',
    },
    {
      name: 'tauMean',
      type: 'f16',
      offset: 6,
      role: 'statistic',
      unit: 'Pa',
      doc: 'Time-mean wall shear while flowing.',
    },
    {
      name: 'tauPeak',
      type: 'f16',
      offset: 8,
      role: 'statistic',
      unit: 'Pa',
      doc: 'Largest phase-bin mean of the wall shear.',
    },
    {
      name: 'depFlux',
      type: 'f16',
      offset: 10,
      role: 'statistic',
      unit: 'kg/(m2 s)',
      scale: 1e-3,
      doc: 'Time-mean mass arriving from the air (smoothed where sparse), stored in g/(m2 s).',
    },
    {
      name: 'renew',
      type: 'f16',
      offset: 12,
      role: 'statistic',
      unit: '1/s',
      doc: 'Time-mean renewal rate, catchment-based: (Gamma W + depFlux A) / (rho h A_up).',
    },
    {
      name: 'mfMean',
      type: 'log8',
      offset: 14,
      role: 'statistic',
      unit: 'N/m',
      log: { min: 1e-4, max: 10 },
      doc: 'Film momentum flux per unit width while flowing, mean.',
    },
    {
      name: 'mfPeak',
      type: 'log8',
      offset: 15,
      role: 'statistic',
      unit: 'N/m',
      log: { min: 1e-4, max: 10 },
      doc: 'Film momentum flux per unit width, largest bin mean.',
    },
    {
      name: 'flowDuty',
      type: 'u8',
      offset: 16,
      role: 'statistic',
      unit: '1',
      scale: 1 / 255,
      doc: 'Fraction of the period with h above the flow threshold (30 um).',
    },
    {
      name: 'wetDuty',
      type: 'u8',
      offset: 17,
      role: 'statistic',
      unit: '1',
      scale: 1 / 255,
      doc: 'Fraction of the period film-wet.',
    },
    {
      name: 'beadFrac',
      type: 'u8',
      offset: 18,
      role: 'statistic',
      unit: '1',
      scale: 1 / 255,
      doc: 'Time-mean b / b_max while not film-wet.',
    },
    {
      name: 'widthFrac',
      type: 'u8',
      offset: 19,
      role: 'statistic',
      unit: '1',
      scale: 1 / 255,
      doc: 'Time-mean wetted width fraction while wet (255 for S-solved cells).',
    },
    {
      name: 'tauDuty',
      type: 'u8',
      offset: 20,
      count: 4,
      role: 'statistic',
      unit: '1',
      scale: 1 / 255,
      doc: 'Fraction of the period with film shear above 0.5, 1, 2 and 4 Pa.',
    },
    {
      name: 'dropDuty3',
      type: 'log8',
      offset: 24,
      role: 'statistic',
      unit: '1',
      log: { min: 1e-6, max: 1 },
      doc: 'Area-time fraction under droplet impacts with stagnation shear above 3 Pa.',
    },
    {
      name: 'dropDuty10',
      type: 'log8',
      offset: 25,
      role: 'statistic',
      unit: '1',
      log: { min: 1e-6, max: 1 },
      doc: 'Area-time fraction under droplet impacts with stagnation shear above 10 Pa.',
    },
    {
      name: 'immersed',
      type: 'u8',
      offset: 26,
      role: 'statistic',
      unit: '1',
      scale: 1 / 255,
      doc: 'Fraction of the period submerged in a pool resolved by the S solver, in a lumped basin taken as full, or in a filled gap.',
    },
    {
      name: 'dryMax',
      type: 'u8',
      offset: 27,
      role: 'statistic',
      unit: '1',
      scale: 1 / 255,
      doc: 'Longest dry interval, as a fraction of the period.',
    },
    {
      name: 'srcSplit',
      type: 'u8',
      offset: 28,
      role: 'statistic',
      unit: '-',
      bits: [
        {
          name: 'jetHandover',
          lsb: 0,
          width: 2,
          doc: 'Share of the arriving liquid from jet hand-over, in thirds (0 to 3).',
        },
        { name: 'airborne', lsb: 2, width: 2, doc: 'Share from airborne droplets, in thirds.' },
        { name: 'drips', lsb: 4, width: 2, doc: 'Share from drips, in thirds.' },
        { name: 'filmInflow', lsb: 6, width: 2, doc: 'Share from film inflow, in thirds.' },
      ],
      doc: 'Two bits each: share of arriving liquid from jet hand-over, airborne droplets, drips, film inflow.',
    },
    {
      name: 'spread',
      type: 'log8',
      offset: 29,
      role: 'statistic',
      unit: '1',
      log: { min: 1e-3, max: 10 },
      doc: 'Relative difference of gammaMean between the two recorded revolutions.',
    },
    {
      name: 'flags',
      type: 'u8',
      offset: 30,
      role: 'statistic',
      unit: '-',
      bits: [
        { name: 'regime', lsb: 0, width: 2, doc: 'REGIME_CODES at the end of the period.' },
        {
          name: 'jetHandover',
          lsb: 2,
          width: 1,
          doc: 'The cell receives jet hand-over in this state.',
        },
        { name: 'inPool', lsb: 3, width: 1, doc: 'The cell is in a pool.' },
        { name: 'stagnantGap', lsb: 4, width: 1, doc: 'The cell is in a stagnant gap.' },
        { name: 'gutterOrDrip', lsb: 5, width: 1, doc: 'Gutter row or drip site.' },
        {
          name: 'sparse',
          lsb: 6,
          width: 1,
          doc: 'Sparse deposition: the smoothed flux rests on fewer than 16 parcels.',
        },
        { name: 'sSolved', lsb: 7, width: 1, doc: 'The cell is S-solved.' },
      ],
      doc: 'Bits 0 to 7 as section 5.2 lists them.',
    },
    {
      name: 'tauDuty10',
      type: 'log8',
      offset: 31,
      role: 'statistic',
      unit: '1',
      log: { min: 1e-4, max: 1 },
      doc: 'Fraction of the period with film shear above tau* = 10 Pa.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link FILM_EXPOSURE_LAYOUT} record. */
export type FilmExposure = RecordOf<typeof FILM_EXPOSURE_LAYOUT>;

/**
 * `DrainDown`, 8 bytes per block, per combo (section 5.3): the film after the sources stop,
 * from the 60 s drain-down of the cascade.
 */
export const DRAIN_DOWN_LAYOUT = {
  name: 'DrainDown',
  section: '5.3',
  owner: 'M7',
  per: 'block',
  byteSize: 8,
  fields: [
    {
      name: 'h2',
      type: 'f16',
      offset: 0,
      role: 'statistic',
      unit: 'm',
      scale: 1e-6,
      doc: 'Film thickness 2 s after the sources stop, stored in um.',
    },
    {
      name: 'h10',
      type: 'f16',
      offset: 2,
      role: 'statistic',
      unit: 'm',
      scale: 1e-6,
      doc: 'Film thickness after 10 s, stored in um.',
    },
    {
      name: 'h60',
      type: 'f16',
      offset: 4,
      role: 'statistic',
      unit: 'm',
      scale: 1e-6,
      doc: 'Film thickness after 60 s, stored in um.',
    },
    {
      name: 'tDewet',
      type: 'log8',
      offset: 6,
      role: 'statistic',
      unit: 's',
      log: { min: 0.01, max: 60 },
      doc: 'Time at which the block leaves the wet regimes, 0.01 to 60 s; code 255 (60 s) means it stays wet.',
    },
    {
      name: 'endState',
      type: 'u8',
      offset: 7,
      role: 'statistic',
      unit: '-',
      bits: [
        {
          name: 'beadLoad',
          lsb: 0,
          width: 4,
          doc: 'Final bead load in sixteenths of b_max (0 to 15).',
        },
        { name: 'edgeDrop', lsb: 4, width: 1, doc: 'An edge drop remains.' },
        { name: 'bridge', lsb: 5, width: 1, doc: 'A capillary bridge remains.' },
        { name: 'inPool', lsb: 6, width: 1, doc: 'The block is in a pool.' },
        {
          name: 'lateDrips',
          lsb: 7,
          width: 1,
          doc: 'The block received drips after the sources stopped.',
        },
      ],
      doc: 'Bits 0 to 7 as section 5.3 lists them.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link DRAIN_DOWN_LAYOUT} record. */
export type DrainDown = RecordOf<typeof DRAIN_DOWN_LAYOUT>;

/**
 * One element of the onset-time field, 4 bytes per block (sections 5.1 and M10): the time a
 * block needs to become film-wet in this state, computed once per exposure set by a min-plus
 * accumulation over the cell graph.
 */
export const ONSET_LAYOUT = {
  name: 'Onset',
  section: '5.1',
  owner: 'M7',
  per: 'block',
  byteSize: 4,
  fields: [
    {
      name: 'tOn',
      type: 'f32',
      offset: 0,
      role: 'statistic',
      unit: 's',
      doc: 'Onset time t_on: 0 where the block receives jet hand-over in this state.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link ONSET_LAYOUT} record. */
export type Onset = RecordOf<typeof ONSET_LAYOUT>;
