/**
 * Small helpers for writing machine definitions: provenance records, arithmetic runs of
 * positions, and repeated values. They only build plain data.
 */

import type { Provenance, ProvenanceTag } from '../provenance.ts';
import type { HorizontalDirection } from '../types.ts';

/** A provenance record: tag, source, and optionally a note and per-field tags. */
export function prov(
  tag: ProvenanceTag,
  source: string,
  note?: string,
  fields?: Readonly<Record<string, ProvenanceTag>>,
): Provenance {
  return {
    tag,
    source,
    ...(fields === undefined ? {} : { fields }),
    ...(note === undefined ? {} : { note }),
  };
}

/**
 * `count` values starting at `first` and stepping by `pitch`: `first + pitch * k` for
 * k = 0 .. count - 1 (each is a single multiply and add, so the list is reproducible).
 */
export function arithmetic(first: number, pitch: number, count: number): number[] {
  const values: number[] = [];
  for (let k = 0; k < count; k++) values.push(first + pitch * k);
  return values;
}

/** `count` copies of a direction. */
export function repeatDirection(
  direction: HorizontalDirection,
  count: number,
): HorizontalDirection[] {
  const values: HorizontalDirection[] = [];
  for (let k = 0; k < count; k++) values.push(direction);
  return values;
}
