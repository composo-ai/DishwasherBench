/**
 * The buffers of the timeline that the soil kernel binds (docs/design/sim-core.md section M10;
 * `SoilStage.tick` of section M8).
 *
 * These records belong to M10 by the contract. The soil kernel reads all three every tick, but
 * M8 may not depend on M10 (M10 depends on M8), so the layouts are declared here, in the lowest
 * module that needs them, and are re-exported under the same names by `@spotless/sim-timeline`:
 *
 * | Record | Defined in | Written by | Read by the soil kernel for |
 * |---|---|---|---|
 * | `EffectiveExposure` | M10 | pass W, every tick | wetness shares and the quantities of each state |
 * | `TimelineBlock` | M10 | pass T, every tick | block temperatures, fill fractions, the liquor mixture |
 * | `ReservoirLiquor` | M10 | the CPU, every tick | liquor and depth of the immersed share |
 *
 * `EffectiveExposure` is written whole by pass W every tick, so every field of it has the role
 * `statistic`; fixture F3 holds one record of it for each of the five wetness states, and it is
 * frozen before the soil and timeline tracks write kernels (section 9).
 */

import type { RecordLayout, RecordOf } from '@spotless/sim-scene';

/**
 * `EffectiveExposure`, 40 bytes per film cell and tick (section M10): the shares of the tick
 * the cell spends in each wetness state and the quantities of each state, after rescaling the
 * exposure records of the active combo to the tick. Written by pass W, read by pass T and by
 * the soil kernel.
 *
 * The contract gives no ranges for the two pairs of log-coded fields here; those of the fields
 * of `FilmExposure` they are rescaled from are used.
 */
export const EFFECTIVE_EXPOSURE_LAYOUT = {
  name: 'EffectiveExposure',
  section: 'M10',
  owner: 'M10',
  per: 'film cell',
  byteSize: 40,
  fields: [
    {
      name: 'sFlow',
      type: 'u8',
      offset: 0,
      role: 'statistic',
      unit: '1',
      scale: 1 / 255,
      doc: 'Share of the tick under a flowing film (s_F).',
    },
    {
      name: 'sRes',
      type: 'u8',
      offset: 1,
      role: 'statistic',
      unit: '1',
      scale: 1 / 255,
      doc: 'Share under a residual film (s_R).',
    },
    {
      name: 'sSparse',
      type: 'u8',
      offset: 2,
      role: 'statistic',
      unit: '1',
      scale: 1 / 255,
      doc: 'Share in the sparse state: beads or absorbed rain (s_B).',
    },
    {
      name: 'sImm',
      type: 'u8',
      offset: 3,
      role: 'statistic',
      unit: '1',
      scale: 1 / 255,
      doc: 'Share immersed (s_I). The dry share is the remainder to 1.',
    },
    {
      name: 'hFlow',
      type: 'f16',
      offset: 4,
      role: 'statistic',
      unit: 'm',
      scale: 1e-6,
      doc: 'Film thickness of the flowing state after rescaling, stored in um.',
    },
    {
      name: 'tauFlow',
      type: 'f16',
      offset: 6,
      role: 'statistic',
      unit: 'Pa',
      doc: 'Mean film shear of the flowing state after rescaling.',
    },
    {
      name: 'tauPeak',
      type: 'f16',
      offset: 8,
      role: 'statistic',
      unit: 'Pa',
      doc: 'Peak film shear after rescaling.',
    },
    {
      name: 'mfMean',
      type: 'log8',
      offset: 10,
      role: 'statistic',
      unit: 'N/m',
      log: { min: 1e-4, max: 10 },
      doc: 'Film momentum flux per unit width, mean.',
    },
    {
      name: 'mfPeak',
      type: 'log8',
      offset: 11,
      role: 'statistic',
      unit: 'N/m',
      log: { min: 1e-4, max: 10 },
      doc: 'Film momentum flux per unit width, peak.',
    },
    {
      name: 'jSupFlow',
      type: 'f16',
      offset: 12,
      role: 'statistic',
      unit: 'kg/(m2 s)',
      scale: 1e-3,
      doc: 'Water supply J_sup of the flowing state, stored in g/(m2 s).',
    },
    {
      name: 'jSupRes',
      type: 'f16',
      offset: 14,
      role: 'statistic',
      unit: 'kg/(m2 s)',
      scale: 1e-3,
      doc: 'Water supply of the residual state, stored in g/(m2 s).',
    },
    {
      name: 'depFlux',
      type: 'f16',
      offset: 16,
      role: 'statistic',
      unit: 'kg/(m2 s)',
      scale: 1e-3,
      doc: 'Arrival from the air, condensate included, stored in g/(m2 s).',
    },
    {
      name: 'hRes',
      type: 'f16',
      offset: 18,
      role: 'statistic',
      unit: 'm',
      scale: 1e-6,
      doc: 'Thickness of the residual film: max(h_dd, record thickness below the flow threshold), stored in um.',
    },
    {
      name: 'hBead',
      type: 'f16',
      offset: 20,
      role: 'statistic',
      unit: 'm',
      scale: 1e-6,
      doc: 'Bead height: bead mass / (rho beadArea), stored in um.',
    },
    {
      name: 'tauDuty',
      type: 'u8',
      offset: 22,
      count: 5,
      role: 'statistic',
      unit: '1',
      scale: 1 / 255,
      doc: 'Shares of the tick with film shear above 0.5, 1, 2, 4 and 10 Pa.',
    },
    {
      name: 'beadArea',
      type: 'u8',
      offset: 27,
      role: 'statistic',
      unit: '1',
      scale: 1 / 255,
      doc: 'Bead-covered area fraction: a_beadMax x bead load / b_max.',
    },
    {
      name: 'dropDuty3',
      type: 'log8',
      offset: 28,
      role: 'statistic',
      unit: '1',
      log: { min: 1e-6, max: 1 },
      doc: 'Area-time fraction under droplet impacts with stagnation shear above 3 Pa.',
    },
    {
      name: 'dropDuty10',
      type: 'log8',
      offset: 29,
      role: 'statistic',
      unit: '1',
      log: { min: 1e-6, max: 1 },
      doc: 'Area-time fraction under droplet impacts with stagnation shear above 10 Pa.',
    },
    {
      name: 'depthImm',
      type: 'f16',
      offset: 30,
      role: 'statistic',
      unit: 'm',
      scale: 1e-3,
      doc: 'Depth of water above the cell while immersed, stored in mm.',
    },
    {
      name: 'reservoir',
      type: 'u16',
      offset: 32,
      role: 'statistic',
      unit: '-',
      doc: 'Reservoir index (basins in id order, then gaps) whose liquor the immersed share sees; 0xFFFF none.',
    },
    {
      name: 'renew',
      type: 'f16',
      offset: 34,
      role: 'statistic',
      unit: '1/s',
      doc: 'Renewal rate, catchment-based: (Gamma W + depFlux A) / (rho h A_up).',
    },
    {
      name: 'flags',
      type: 'u16',
      offset: 36,
      role: 'statistic',
      unit: '-',
      doc: 'Flags; the contract does not enumerate them.',
    },
    {
      name: 'widthFrac',
      type: 'u8',
      offset: 38,
      role: 'statistic',
      unit: '1',
      scale: 1 / 255,
      doc: 'Wetted width fraction of a RIVULET block, compared with the coverage rank of each soil cell.',
    },
    { name: 'spare', type: 'u8', offset: 39, role: 'static', unit: '-', pad: true, doc: 'Spare.' },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link EFFECTIVE_EXPOSURE_LAYOUT} record. */
export type EffectiveExposure = RecordOf<typeof EFFECTIVE_EXPOSURE_LAYOUT>;

/**
 * `TimelineBlock`, 64 bytes per block (section M10): the slow state of a block that the
 * periodic solves cannot hold. Every evolving field is f32 except the fill fractions, which
 * are u16 that are renormalised every tick so that the four sum to exactly 65,535.
 *
 * Determinism rule 7 allows no narrow field to accumulate state; the fill fractions are the
 * contract's own exception. They are registered here as counters with the bound 65,535, which
 * the renormalisation cannot exceed, and the exception is reported as a contract issue.
 */
export const TIMELINE_BLOCK_LAYOUT = {
  name: 'TimelineBlock',
  section: 'M10',
  owner: 'M10',
  per: 'block',
  byteSize: 64,
  fields: [
    {
      name: 'Ts',
      type: 'f32',
      offset: 0,
      role: 'state',
      unit: 'K',
      doc: 'Surface temperature T_s of the block.',
    },
    {
      name: 'Tmid',
      type: 'f32',
      offset: 4,
      role: 'state',
      unit: 'K',
      doc: 'Temperature T_mid of the mid node of the wall (the lumped node for metals).',
    },
    {
      name: 'filmMass',
      type: 'f32',
      offset: 8,
      role: 'state',
      unit: 'kg/m2',
      doc: 'Effective film mass per area.',
    },
    {
      name: 'beadMass',
      type: 'f32',
      offset: 12,
      role: 'state',
      unit: 'kg/m2',
      doc: 'Bead mass per area.',
    },
    {
      name: 'deposition',
      type: 'f32',
      offset: 16,
      role: 'state',
      unit: 'kg/m2',
      doc: 'Cumulative deposition from the air.',
    },
    {
      name: 'onsetProgress',
      type: 'f32',
      offset: 20,
      role: 'state',
      unit: '1',
      doc: 'Onset progress P of the wetting-onset gate; the block is film-wet from P = 1.',
    },
    {
      name: 'fill',
      type: 'u16',
      offset: 24,
      count: 4,
      role: 'counter',
      unit: '1',
      scale: 1 / 65535,
      bound: 65535,
      doc: 'Fill fractions of the film: pre-rinse, main wash, intermediate rinses, final rinse; they sum to 65,535.',
    },
    {
      name: 'storeDissolved',
      type: 'f32',
      offset: 32,
      role: 'state',
      unit: 'kg/m2',
      doc: 'Local store of dissolved soil.',
    },
    {
      name: 'storeFat',
      type: 'f32',
      offset: 36,
      role: 'state',
      unit: 'kg/m2',
      doc: 'Local store of fat.',
    },
    {
      name: 'speckFines',
      type: 'f32',
      offset: 40,
      role: 'state',
      unit: '1/m2',
      scale: 1e6,
      doc: 'Expected speck intensity of fines, stored per mm2.',
    },
    {
      name: 'speckGrit',
      type: 'f32',
      offset: 44,
      role: 'state',
      unit: '1/m2',
      scale: 1e6,
      doc: 'Expected speck intensity of grit, stored per mm2.',
    },
    {
      name: 'residue',
      type: 'f32',
      offset: 48,
      role: 'state',
      unit: 'kg/m2',
      doc: 'Deposit: dried dissolved residue.',
    },
    {
      name: 'fatFilm',
      type: 'f32',
      offset: 52,
      role: 'state',
      unit: 'kg/m2',
      doc: 'Deposit: fat and soap film.',
    },
    {
      name: 'pigment',
      type: 'f32',
      offset: 56,
      role: 'state',
      unit: '1',
      doc: 'Deposit: pigment taken up.',
    },
    {
      name: 'regime',
      type: 'u8',
      offset: 60,
      role: 'statistic',
      unit: '-',
      doc: 'Regime now, written whole every tick: 0 DRY, 1 BEAD, 2 RIVULET, 3 FILM (the regime codes of the cascade, section M7.3).',
    },
    {
      name: 'cover',
      type: 'u8',
      offset: 61,
      role: 'statistic',
      unit: '1',
      scale: 1 / 16,
      doc: 'Cover summary: soil-covered fraction of the block in sixteenths, as in the wetting summary (the contract does not fix the coding).',
    },
    {
      name: 'flags',
      type: 'u16',
      offset: 62,
      role: 'statistic',
      unit: '-',
      doc: 'Flags; the contract does not enumerate them.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link TIMELINE_BLOCK_LAYOUT} record. */
export type TimelineBlock = RecordOf<typeof TIMELINE_BLOCK_LAYOUT>;

/**
 * `ReservoirLiquor`, 32 bytes per basin and gap (section M10): the liquor of each lumped
 * reservoir, uploaded each tick from the CPU. Indexed by reservoir index: the basins of the
 * scene in id order, then its gap reservoirs.
 */
export const RESERVOIR_LIQUOR_LAYOUT = {
  name: 'ReservoirLiquor',
  section: 'M10',
  owner: 'M10',
  per: 'reservoir',
  byteSize: 32,
  fields: [
    {
      name: 'level',
      type: 'f32',
      offset: 0,
      role: 'static',
      unit: 'm',
      doc: 'Level of the liquid above the lowest point of the basin.',
    },
    {
      name: 'temperature',
      type: 'f32',
      offset: 4,
      role: 'static',
      unit: 'K',
      doc: 'Temperature of the reservoir.',
    },
    {
      name: 'alkalinity',
      type: 'f32',
      offset: 8,
      role: 'static',
      unit: 'eq/m3',
      doc: 'Alkalinity; mixed linearly, the pH is read from the table of M9.',
    },
    {
      name: 'totalCarbonate',
      type: 'f32',
      offset: 12,
      role: 'static',
      unit: 'mol/m3',
      doc: 'Total carbonate.',
    },
    {
      name: 'protease',
      type: 'f32',
      offset: 16,
      role: 'static',
      unit: 'kg/m3',
      doc: 'Active protease.',
    },
    {
      name: 'amylase',
      type: 'f32',
      offset: 20,
      role: 'static',
      unit: 'kg/m3',
      doc: 'Active amylase.',
    },
    { name: 'oxidant', type: 'f32', offset: 24, role: 'static', unit: 'mol/m3', doc: 'Oxidant.' },
    {
      name: 'filled',
      type: 'f32',
      offset: 28,
      role: 'static',
      unit: '1',
      doc: 'Filled flag: 1 when a gap reservoir is filled or a basin holds liquid, else 0.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link RESERVOIR_LIQUOR_LAYOUT} record. */
export type ReservoirLiquor = RecordOf<typeof RESERVOIR_LIQUOR_LAYOUT>;
