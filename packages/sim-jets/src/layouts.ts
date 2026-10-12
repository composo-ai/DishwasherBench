/**
 * Binary records of module M5 (docs/design/sim-core.md section M5, and `SourceRecord` of
 * section M6, which M5 writes), as data, in the conventions of `layout.ts` of
 * `@spotless/sim-gpu`.
 *
 * Also declared here, because M5 reads it and may not depend on the module that writes it:
 * `HRes`, the residual-film estimate of the pilot of M7 (`PilotResult.hRes`).
 *
 * Choices the contract leaves open (bit positions, enumeration codes, the size of
 * `SourceRecord`, the formats of `EmitterMean` and `JetWet`) are marked where they are made and
 * reported as contract issues.
 */

import type { RecordLayout, RecordOf } from '@spotless/sim-scene';

// ---------------------------------------------------------------------------------------------
// Enumerations stored in the records
// ---------------------------------------------------------------------------------------------

/**
 * Where a fan sector ends (4 bits per azimuth of `SectorRecord`; section M5, "Validity bound
 * and sector walk"): the smallest of the limits listed there, numbered in the order listed.
 * `rjUnderside` is the fast-film radius reached on an underside (G_n < 0), where part of the
 * film leaves as a curtain.
 */
export const SECTOR_END_CODES = {
  rj: 0,
  rStar: 1,
  convexEdge: 2,
  secondFold: 3,
  gaussBound: 4,
  wrapCollision: 5,
  partBoundary: 6,
  rjUnderside: 7,
} as const;

/**
 * Kind of a source of secondary droplets (`SourceRecord.kind`; section M6), numbered in the
 * order listed.
 */
export const SOURCE_KIND_CODES = {
  splatter: 0,
  wireFan: 1,
  edgeSheet: 2,
  curtain: 3,
  dropTrain: 4,
  shedDrops: 5,
} as const;

// ---------------------------------------------------------------------------------------------
// Footprints and sectors
// ---------------------------------------------------------------------------------------------

/**
 * `FootprintRecord`, 56 bytes per (sub-jet, phase) (section M5). The first 48 bytes are the
 * trace part, written by stage C; the last 8 the film part, written by stage D.
 */
export const FOOTPRINT_RECORD_LAYOUT = {
  name: 'FootprintRecord',
  section: 'M5',
  owner: 'M5',
  per: '(sub-jet, phase)',
  byteSize: 56,
  fields: [
    {
      name: 'source',
      type: 'f32',
      offset: 0,
      count: 2,
      role: 'statistic',
      unit: 'm or rad',
      doc: 'Source point S of the fan in patch coordinates: (s, theta) on a REV patch, (u, v) on a CART patch.',
    },
    {
      name: 'sourceOffset',
      type: 'f32',
      offset: 8,
      role: 'statistic',
      unit: 'm',
      doc: 'Offset r0 cot(phi) of the source point behind the centroid hit, along the forward tangent.',
    },
    {
      name: 'tangentAngle',
      type: 'f32',
      offset: 12,
      role: 'statistic',
      unit: 'rad',
      doc: 'Angle of the forward tangent e_t in the patch tangent frame, from the first tangent axis towards the second.',
    },
    {
      name: 'sinPhi',
      type: 'f32',
      offset: 16,
      role: 'statistic',
      unit: '1',
      doc: 'Sine of the incidence angle phi, measured from the wall plane.',
    },
    {
      name: 'V',
      type: 'f32',
      offset: 20,
      role: 'statistic',
      unit: 'm/s',
      doc: 'Jet speed at the wall.',
    },
    { name: 'd', type: 'f32', offset: 24, role: 'statistic', unit: 'm', doc: 'Jet diameter.' },
    {
      name: 'Qhit',
      type: 'f32',
      offset: 28,
      role: 'statistic',
      unit: 'm3/s',
      doc: 'Volume flow that hits: (n_hit / n_rays) Q; 0 where the sub-jet misses.',
    },
    {
      name: 'sweepVelocity',
      type: 'f32',
      offset: 32,
      count: 2,
      role: 'statistic',
      unit: 'm/s',
      doc: 'Sweep velocity v_s of the footprint in the patch tangent frame.',
    },
    {
      name: 'flightTime',
      type: 'f32',
      offset: 40,
      role: 'statistic',
      unit: 's',
      doc: 'Time of flight from the nozzle to the wall.',
    },
    {
      name: 'patch',
      type: 'u32',
      offset: 44,
      role: 'statistic',
      unit: '-',
      doc: 'Patch id of the footprint, or 0xFFFFFFFF for a miss.',
    },
    {
      name: 'fc',
      type: 'f16',
      offset: 48,
      role: 'statistic',
      unit: '1',
      doc: 'Coherent fraction f_c at the wall, with rain interference (film part).',
    },
    {
      name: 'xi',
      type: 'f16',
      offset: 50,
      role: 'statistic',
      unit: '1',
      doc: 'Splattered mass fraction xi (film part).',
    },
    {
      name: 'zone',
      type: 'u16',
      offset: 52,
      role: 'statistic',
      unit: '-',
      doc: 'Id of the developable zone of the source point.',
    },
    {
      name: 'flags',
      type: 'u16',
      offset: 54,
      role: 'statistic',
      unit: '-',
      doc: 'Flags; the contract does not enumerate them.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link FOOTPRINT_RECORD_LAYOUT} record. */
export type FootprintRecord = RecordOf<typeof FOOTPRINT_RECORD_LAYOUT>;

/**
 * `SectorRecord`, 176 bytes per (sub-jet, walked phase) (section M5): the fan limit along 32
 * azimuths about the source point (azimuth 0 forward), from the sector walk of stage D.
 */
export const SECTOR_RECORD_LAYOUT = {
  name: 'SectorRecord',
  section: 'M5',
  owner: 'M5',
  per: '(sub-jet, walked phase)',
  byteSize: 176,
  fields: [
    {
      name: 'rLim',
      type: 'f16',
      offset: 0,
      count: 32,
      role: 'statistic',
      unit: 'm',
      scale: 1e-3,
      doc: 'Fan limit r_lim at each azimuth, stored in mm.',
    },
    {
      name: 'travelTime',
      type: 'f16',
      offset: 64,
      count: 32,
      role: 'statistic',
      unit: 's',
      scale: 1e-3,
      doc: 'Travel time T(r_lim) of the film front to the limit, stored in ms.',
    },
    {
      name: 'leftFraction',
      type: 'u8',
      offset: 128,
      count: 32,
      role: 'statistic',
      unit: '1',
      scale: 1 / 255,
      doc: 'Fraction of the sector flux that separates at an edge or departs from an underside.',
    },
    {
      name: 'endType',
      type: 'u8',
      offset: 160,
      count: 16,
      role: 'statistic',
      unit: '-',
      bits: [
        { name: 'even', lsb: 0, width: 4, doc: 'SECTOR_END_CODES of azimuth 2k, for byte k.' },
        { name: 'odd', lsb: 4, width: 4, doc: 'SECTOR_END_CODES of azimuth 2k + 1.' },
      ],
      doc: 'End type of each azimuth, 4 bits each, two azimuths per byte.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link SECTOR_RECORD_LAYOUT} record. */
export type SectorRecord = RecordOf<typeof SECTOR_RECORD_LAYOUT>;

// ---------------------------------------------------------------------------------------------
// Hand-over to the film
// ---------------------------------------------------------------------------------------------

/**
 * One emitter entry, 16 bytes (section M5, "Hand-over"): an integer mass with its velocity for
 * one film cell, added to the deposit accumulators of M7 when the phase of the emitting arm
 * crosses the entry's bucket. Written on the CPU at stage D and not changed afterwards.
 */
export const EMITTER_ENTRY_LAYOUT = {
  name: 'EmitterEntry',
  section: 'M5',
  owner: 'M5',
  per: 'emitter entry',
  byteSize: 16,
  fields: [
    {
      name: 'filmCell',
      type: 'u32',
      offset: 0,
      role: 'static',
      unit: '-',
      doc: 'Film cell that receives the mass, on the grid the table was rasterised for.',
    },
    {
      name: 'mass',
      type: 'i32',
      offset: 4,
      role: 'static',
      unit: 'kg',
      scale: 1e-12,
      doc: 'Mass of the emission event, added once per revolution of the arm, in units of 1e-12 kg.',
    },
    {
      name: 'velocity',
      type: 'i16',
      offset: 8,
      count: 2,
      role: 'static',
      unit: 'm/s',
      scale: 1e-3,
      doc: "Tangential velocity of the liquid in the receiving cell's frame, stored in mm/s; already capped at `film.handoverCap`.",
    },
    { name: 'spare', type: 'u32', offset: 12, role: 'static', unit: '-', pad: true, doc: 'Spare.' },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link EMITTER_ENTRY_LAYOUT} record. */
export type EmitterEntry = RecordOf<typeof EMITTER_ENTRY_LAYOUT>;

/**
 * One element of a jet-wet table, 8 bytes per block and arm (section M5, `EmitterTable.jetWet`):
 * bit b of the 64 is set when the block lies inside a fan during phase bin b of that arm.
 */
export const JET_WET_LAYOUT = {
  name: 'JetWet',
  section: 'M5',
  owner: 'M5',
  per: 'block',
  byteSize: 8,
  fields: [
    {
      name: 'bins',
      type: 'u32',
      offset: 0,
      count: 2,
      role: 'statistic',
      unit: '-',
      doc: 'Word 0 holds phase bins 0 to 31 (bin b at bit b), word 1 bins 32 to 63.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link JET_WET_LAYOUT} record. */
export type JetWet = RecordOf<typeof JET_WET_LAYOUT>;

/**
 * One element of the buffer `JetStage.emitterMeans` returns: the time-mean hand-over to a block
 * with fan limits at h_res = 0. The contract says "time-mean hand-over flux per block" and
 * fixes no format; it is read here as one f32 mass rate per block.
 */
export const EMITTER_MEAN_LAYOUT = {
  name: 'EmitterMean',
  section: 'M5',
  owner: 'M5',
  per: 'block',
  byteSize: 4,
  fields: [
    {
      name: 'massRate',
      type: 'f32',
      offset: 0,
      role: 'statistic',
      unit: 'kg/s',
      doc: 'Time-mean mass handed over to the block by all fans of the state.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link EMITTER_MEAN_LAYOUT} record. */
export type EmitterMean = RecordOf<typeof EMITTER_MEAN_LAYOUT>;

/**
 * One element of the residual-film estimate of the pilot, 2 bytes per block (section M7,
 * `PilotResult.hRes`: "f16 um per block"): the thickness a film of the mean loading drains to
 * over the mean interval between jet passes; 0 where the block is not wet. Belongs to M7;
 * declared here because `JetStage.completeFootprints` reads it.
 */
export const H_RES_LAYOUT = {
  name: 'HRes',
  section: 'M7',
  owner: 'M7',
  per: 'block',
  byteSize: 2,
  fields: [
    {
      name: 'hRes',
      type: 'f16',
      offset: 0,
      role: 'statistic',
      unit: 'm',
      scale: 1e-6,
      doc: 'Residual film thickness, stored in um.',
    },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link H_RES_LAYOUT} record. */
export type HRes = RecordOf<typeof H_RES_LAYOUT>;

// ---------------------------------------------------------------------------------------------
// Sources of secondary droplets
// ---------------------------------------------------------------------------------------------

/**
 * `SourceRecord` (section M6; written by M5): one diffuse primary source of droplets for the
 * Monte Carlo. The contract states 32 bytes, but the fields it lists need 34; the record is
 * 36 bytes here, with the listed "spare" as the last 2.
 */
export const SOURCE_RECORD_LAYOUT = {
  name: 'SourceRecord',
  section: 'M6',
  owner: 'M5',
  per: 'source',
  byteSize: 36,
  fields: [
    { name: 'kind', type: 'u8', offset: 0, role: 'static', unit: '-', doc: 'SOURCE_KIND_CODES.' },
    {
      name: 'subJet',
      type: 'u8',
      offset: 1,
      role: 'static',
      unit: '-',
      doc: 'Index of the sub-jet the source comes from.',
    },
    {
      name: 'phase',
      type: 'u16',
      offset: 2,
      role: 'static',
      unit: '-',
      doc: 'Phase index of the owning arm at emission, in the phases of the trace.',
    },
    {
      name: 'origin',
      type: 'f32',
      offset: 4,
      count: 3,
      role: 'static',
      unit: 'm',
      doc: 'Origin of the source in the tub frame.',
    },
    {
      name: 'normal',
      type: 'i16',
      offset: 16,
      count: 2,
      role: 'static',
      unit: '1',
      scale: 1 / 32767,
      doc: 'Normal of the direction frame, tub frame, octahedral as in `BlockStatic.normal`.',
    },
    {
      name: 'tangentAngle',
      type: 'i16',
      offset: 20,
      role: 'static',
      unit: 'rad',
      scale: Math.PI / 32768,
      doc: 'Angle of the mean direction about the normal.',
    },
    {
      name: 'spread',
      type: 'u16',
      offset: 22,
      role: 'static',
      unit: '-',
      doc: 'Spread code of the source (elevation and in-plane spread); the contract does not fix the coding.',
    },
    {
      name: 'massRate',
      type: 'f32',
      offset: 24,
      role: 'static',
      unit: 'kg/s',
      doc: 'Mass rate of the source while its arm is in this phase.',
    },
    {
      name: 'speed',
      type: 'f16',
      offset: 28,
      role: 'static',
      unit: 'm/s',
      doc: 'Mean launch speed.',
    },
    {
      name: 'diameter',
      type: 'f16',
      offset: 30,
      role: 'static',
      unit: 'm',
      scale: 1e-3,
      doc: 'Mass-median droplet diameter, stored in mm.',
    },
    {
      name: 'flightTimeOffset',
      type: 'f16',
      offset: 32,
      role: 'static',
      unit: 's',
      scale: 1e-3,
      doc: 'Flight time of the jet before the source, stored in ms; added to the emission phase when binning.',
    },
    { name: 'spare', type: 'u16', offset: 34, role: 'static', unit: '-', pad: true, doc: 'Spare.' },
  ],
} as const satisfies RecordLayout;

/** A decoded {@link SOURCE_RECORD_LAYOUT} record. */
export type SourceRecord = RecordOf<typeof SOURCE_RECORD_LAYOUT>;
