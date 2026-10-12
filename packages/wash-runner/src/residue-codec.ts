/**
 * Packing of a residue map for the wire (`ResidueMap` of the session contract) and back. The
 * packed form is little-endian integers in base64, whatever the byte order of the machine, and
 * uses only what both Node and a browser have (`btoa`, `atob`, `DataView`).
 *
 * Rounding: positions to `position_quantum_mm` (0.02 mm unless the item is too large for
 * 16 bits at that step), normals to 1/127, areas to 0.01 mm2, fractions to 1/255 with a trace
 * rounded up to 1/255 so that a cell that still carries soil never reads as bare.
 */

import type { ResidueMap } from '@spotless/session';

/** The cells of one item that still carry soil, as plain arrays. */
export interface ResidueCells {
  /** Number of cells N. */
  readonly count: number;
  /** [N x 3] centre of each cell in the item frame, metres. */
  readonly centre: Float32Array;
  /** [N x 3] outward unit normal of the surface at each cell, item frame. */
  readonly normal: Float32Array;
  /** [N] area of each cell, mm2. */
  readonly areaMm2: Float32Array;
  /** The soils of the columns of `fraction`. */
  readonly soils: readonly string[];
  /** [N x soils.length] share of each soil that lay on the cell and is still there, 0 to 1. */
  readonly fraction: Float32Array;
  /** [N] 1 where the cell counts as visibly soiled. */
  readonly visible: Uint8Array;
}

/** Finest step of packed positions, millimetres. */
export const POSITION_QUANTUM_MM = 0.02;
/** Step of packed areas, mm2. */
export const AREA_QUANTUM_MM2 = 0.01;

const INT16_MAX = 32767;
const UINT16_MAX = 65535;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Packs the cells of an item into a residue map. Throws a RangeError for arrays that disagree. */
export function encodeResidueMap(itemId: string, cells: ResidueCells): ResidueMap {
  const n = cells.count;
  const k = cells.soils.length;
  if (
    cells.centre.length !== 3 * n ||
    cells.normal.length !== 3 * n ||
    cells.areaMm2.length !== n ||
    cells.fraction.length !== n * k ||
    cells.visible.length !== n
  ) {
    throw new RangeError('encodeResidueMap: the arrays do not have one entry per cell');
  }
  let reachMm = 0;
  for (let i = 0; i < 3 * n; i++) {
    const value = Math.abs(cells.centre[i] as number) * 1000;
    if (!Number.isFinite(value)) throw new RangeError('encodeResidueMap: a position is not finite');
    if (value > reachMm) reachMm = value;
  }
  // Rounded up to a whole micrometre, so that the quantum is a short decimal on the wire.
  const quantum = Math.max(POSITION_QUANTUM_MM, Math.ceil((reachMm / INT16_MAX) * 1000) / 1000);
  const positions = new DataView(new ArrayBuffer(6 * n));
  const normals = new Int8Array(3 * n);
  const areas = new DataView(new ArrayBuffer(2 * n));
  const fractions = new Uint8Array(n * k);
  for (let i = 0; i < 3 * n; i++) {
    positions.setInt16(2 * i, Math.round(((cells.centre[i] as number) * 1000) / quantum), true);
    normals[i] = Math.max(-127, Math.min(127, Math.round((cells.normal[i] as number) * 127)));
  }
  for (let i = 0; i < n; i++) {
    const area = Math.round((cells.areaMm2[i] as number) / AREA_QUANTUM_MM2);
    areas.setUint16(2 * i, Math.max(0, Math.min(UINT16_MAX, area)), true);
  }
  for (let i = 0; i < n * k; i++) {
    const f = cells.fraction[i] as number;
    fractions[i] = f > 0 ? Math.max(1, Math.min(255, Math.round(f * 255))) : 0;
  }
  return {
    item_id: itemId,
    soils: [...cells.soils],
    cells: n,
    position_quantum_mm: quantum,
    area_quantum_mm2: AREA_QUANTUM_MM2,
    positions: toBase64(new Uint8Array(positions.buffer)),
    normals: toBase64(new Uint8Array(normals.buffer)),
    areas: toBase64(new Uint8Array(areas.buffer)),
    fractions: toBase64(fractions),
    visible: toBase64(Uint8Array.from(cells.visible, (v) => (v === 0 ? 0 : 1))),
  };
}

/** Unpacks a residue map. Throws a RangeError for a map whose arrays do not fit its counts. */
export function decodeResidueMap(map: ResidueMap): ResidueCells {
  const n = map.cells;
  const k = map.soils.length;
  const positions = fromBase64(map.positions);
  const normals = fromBase64(map.normals);
  const areas = fromBase64(map.areas);
  const fractions = fromBase64(map.fractions);
  const visible = fromBase64(map.visible);
  if (
    positions.length !== 6 * n ||
    normals.length !== 3 * n ||
    areas.length !== 2 * n ||
    fractions.length !== n * k ||
    visible.length !== n
  ) {
    throw new RangeError(`decodeResidueMap: the arrays of ${map.item_id} do not fit its counts`);
  }
  const positionView = new DataView(positions.buffer, positions.byteOffset, positions.byteLength);
  const normalView = new DataView(normals.buffer, normals.byteOffset, normals.byteLength);
  const areaView = new DataView(areas.buffer, areas.byteOffset, areas.byteLength);
  const centre = new Float32Array(3 * n);
  const normal = new Float32Array(3 * n);
  const areaMm2 = new Float32Array(n);
  const fraction = new Float32Array(n * k);
  for (let i = 0; i < 3 * n; i++) {
    centre[i] = (positionView.getInt16(2 * i, true) * map.position_quantum_mm) / 1000;
    normal[i] = normalView.getInt8(i) / 127;
  }
  for (let i = 0; i < n; i++) areaMm2[i] = areaView.getUint16(2 * i, true) * map.area_quantum_mm2;
  for (let i = 0; i < n * k; i++) fraction[i] = (fractions[i] as number) / 255;
  return { count: n, centre, normal, areaMm2, soils: [...map.soils], fraction, visible };
}
