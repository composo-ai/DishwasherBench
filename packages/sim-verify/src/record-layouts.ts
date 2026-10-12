/**
 * Every binary record layout of the wash simulation in one list, for the checks that run over
 * all of them: the rules of `layoutProblems`, the sizes and offset tables of the contract, and
 * the round trips of the record helpers of M1.
 *
 * The list is not maintained by hand: it is every export of the simulation packages whose name
 * ends in `_LAYOUT` (the entry point of `@spotless/sim-core` re-exports them all), so a layout
 * added to any package is checked as soon as its entry point exports it.
 */

import * as simulation from '@spotless/sim-core';
import type { RecordLayout } from '@spotless/sim-core';

/** A record layout with the name it is exported under. */
export interface ExportedLayout {
  /** Name of the exported constant, for example `FILM_EXPOSURE_LAYOUT`. */
  readonly exportName: string;
  /** The layout. */
  readonly layout: RecordLayout;
}

function isRecordLayout(value: unknown): value is RecordLayout {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<RecordLayout>;
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.byteSize === 'number' &&
    Array.isArray(candidate.fields)
  );
}

/**
 * Every record layout the simulation packages export, sorted by export name. Throws if an
 * export named `..._LAYOUT` is not a layout.
 */
export function allRecordLayouts(): ExportedLayout[] {
  const layouts: ExportedLayout[] = [];
  for (const exportName of Object.keys(simulation).sort()) {
    if (!exportName.endsWith('_LAYOUT')) continue;
    const value: unknown = (simulation as Readonly<Record<string, unknown>>)[exportName];
    if (!isRecordLayout(value)) {
      throw new Error(`allRecordLayouts: export ${exportName} is not a RecordLayout`);
    }
    layouts.push({ exportName, layout: value });
  }
  return layouts;
}

/** The module (`M1` to `M13`) each simulation package implements. */
export const MODULE_OF_PACKAGE: Readonly<Record<string, string>> = {
  'sim-gpu': 'M1',
  'sim-params': 'M2',
  'sim-scene': 'M3',
  'sim-hydraulics': 'M4',
  'sim-jets': 'M5',
  'sim-spray': 'M6',
  'sim-film': 'M7',
  'sim-soil': 'M8',
  'sim-liquor': 'M9',
  'sim-timeline': 'M10',
  'sim-rigid': 'M11',
  'sim-core': 'M12',
  'sim-verify': 'M13',
};
