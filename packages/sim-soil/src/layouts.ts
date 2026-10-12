/**
 * Binary records of module M8 (docs/design/sim-core.md section M8), as data, in the conventions
 * of `layout.ts` of `@spotless/sim-gpu`.
 *
 * Every evolving field of the soil state is f32 or an integer: with f16 a backward-Euler
 * hydration update stalls and cumulative wet time stops (section M8). The narrow fields are
 * static codes, a count of layers remaining with a registered bound, copies of the previous
 * tick, and diagnostics.
 */

import type { RecordLayout, RecordOf } from '@spotless/sim-scene';
import { SOIL_CELL_LAYERS } from './types.ts';

/**
 * `SoilCell`, 136 bytes per soil cell (section M8, "State"); the four soil cells of a block are
 * contiguous. Dry mass per layer is not stored: layers are graded geometrically (ratio 1.3,
 * thinnest at the free surface) and a layer is present or removed, so m_j = m0 g_j with a fixed
 * table g. Deposits received during the wash are not soil state: they are per block and belong
 * to M10. The coverage rank and the parent block are in `SoilStatic`.
 */
export const SOIL_CELL_LAYOUT = {
  name: 'SoilCell',
  section: 'M8',
  owner: 'M8',
  per: 'soil cell',
  byteSize: 136,
  fields: [
    {
      name: 'w',
      type: 'f32',
      offset: 0,
      count: SOIL_CELL_LAYERS,
      role: 'state',
      unit: 'kg/m2',
      doc: 'Water mass of each layer per covered area; layer 1 (index 0) is at the wall.',
    },
    {
      name: 'm0',
      type: 'f32',
      offset: 48,
      role: 'static',
      unit: 'kg/m2',
      doc: 'Initial dry loading per covered area, including the heterogeneity multiplier.',
    },
    {
      name: 'Er',
      type: 'f32',
      offset: 52,
      role: 'state',
      unit: 'kg/m2',
      doc: 'Reaction-erosion carry-over, as dry mass not yet converted into a removed layer.',
    },
    {
      name: 'loose',
      type: 'f32',
      offset: 56,
      role: 'state',
      unit: 'kg/m2',
      doc: 'Loosened inventory (optional loosened-layer law; unused by default).',
    },
    {
      name: 'lagProg',
      type: 'f32',
      offset: 60,
      role: 'state',
      unit: '1',
      doc: 'Progress of the reaction lag; 1 means the lag is over.',
    },
    {
      name: 'hFat',
      type: 'f32',
      offset: 64,
      role: 'state',
      unit: 'm',
      doc: 'Liquid or soft fat film thickness.',
    },
    {
      name: 'removed',
      type: 'f32',
      offset: 68,
      role: 'state',
      unit: 'kg/m2',
      doc: 'Cumulative removed dry mass.',
    },
    {
      name: 'cover',
      type: 'f32',
      offset: 72,
      role: 'state',
      unit: '1',
      doc: 'Covered area fraction c.',
    },
    {
      name: 'Xad',
      type: 'f32',
      offset: 76,
      role: 'state',
      unit: '1',
      doc: 'Integrity of the bond to the substrate.',
    },
    {
      name: 'tWet',
      type: 'u32',
      offset: 80,
      role: 'counter',
      unit: 's',
      scale: 1e-3,
      bound: 2 ** 32 - 1,
      doc: 'Cumulative wetted time in milliseconds (a diagnostic; an integer by determinism rule 2).',
    },
    {
      name: 'stain',
      type: 'f32',
      offset: 84,
      role: 'state',
      unit: '1',
      doc: 'Remaining chromophore fraction.',
    },
    {
      name: 'particles',
      type: 'f32',
      offset: 88,
      role: 'state',
      unit: '1/m2',
      scale: 1e4,
      doc: 'Attached particles, stored per cm2.',
    },
    {
      name: 'class',
      type: 'u8',
      offset: 92,
      role: 'static',
      unit: '-',
      doc: 'Soil class: position in SOIL_CLASS_IDS.',
    },
    {
      name: 'bake',
      type: 'u8',
      offset: 93,
      role: 'static',
      unit: '1',
      scale: 1 / 255,
      doc: 'Bake index B, stored as B x 255.',
    },
    {
      name: 'nLayers',
      type: 'u8',
      offset: 94,
      role: 'counter',
      unit: 'layers',
      bound: SOIL_CELL_LAYERS,
      doc: 'Layers remaining; only ever counts down from the number the cell started with.',
    },
    {
      name: 'edgeDensity',
      type: 'u8',
      offset: 95,
      role: 'static',
      unit: '-',
      doc: 'Crack edge density code; the contract does not fix the coding (0 none, 1,000 1/m when B > 0.5).',
    },
    {
      name: 'nbCover',
      type: 'u8',
      offset: 96,
      count: 4,
      role: 'statistic',
      unit: '1',
      scale: 1 / 255,
      doc: 'Cover of the four edge neighbours at the previous tick (a copy, not an accumulator), in the order -a, +a, -b, +b of the patch coordinates.',
    },
    {
      name: 'tauCohTop',
      type: 'f16',
      offset: 100,
      role: 'statistic',
      unit: 'Pa',
      doc: 'Cohesive strength of the top layer at the end of the last tick (diagnostic).',
    },
    {
      name: 'tauAd',
      type: 'f16',
      offset: 102,
      role: 'statistic',
      unit: 'Pa',
      doc: 'Adhesive strength at the end of the last tick (diagnostic).',
    },
    {
      name: 'flags',
      type: 'u16',
      offset: 104,
      role: 'statistic',
      unit: '-',
      doc: 'Flags; the contract does not enumerate them.',
    },
    {
      name: 'pad',
      type: 'u16',
      offset: 106,
      role: 'static',
      unit: '-',
      pad: true,
      doc: 'Padding.',
    },
    {
      name: 'reserved',
      type: 'u32',
      offset: 108,
      count: 7,
      role: 'static',
      unit: '-',
      pad: true,
      doc: 'Reserved for the second component of composite soils (28 bytes).',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link SOIL_CELL_LAYOUT} record. */
export type SoilCell = RecordOf<typeof SOIL_CELL_LAYOUT>;

/**
 * `BlockRelease`, 32 bytes per soiled block and tick (section M8): the removed dry mass of the
 * block's four soil cells in the 8 release classes (`RELEASE_CLASSES`), exact integers in units
 * of 1e-15 kg. The timeline routes it to a sink and reduces it into `SoilRelease`.
 */
export const BLOCK_RELEASE_LAYOUT = {
  name: 'BlockRelease',
  section: 'M8',
  owner: 'M8',
  per: 'soiled block',
  byteSize: 32,
  fields: [
    {
      name: 'mass',
      type: 'u32',
      offset: 0,
      count: 8,
      role: 'accumulator',
      unit: 'kg',
      scale: 1e-15,
      bound: 2 ** 32 - 1,
      doc: 'Dry mass removed during the tick, by release class, in units of 1e-15 kg.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link BLOCK_RELEASE_LAYOUT} record. */
export type BlockRelease = RecordOf<typeof BLOCK_RELEASE_LAYOUT>;
