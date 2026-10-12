/**
 * Node-only side of `@spotless/calibration`: wash records and parameter sets on disk, and the
 * exposure cache on disk of `@spotless/sim-core/node`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readParamSet, type ExposureCache, type ParamSet } from '@spotless/sim-core';
import { createDiskExposureCache } from '@spotless/sim-core/node';
import { calibrationRegistry, createCalibrationParams } from '../cal-params.ts';
import { parseWashRecord, type WashRecord } from '../record.ts';

/** Thrown for a file that cannot be read as what it should be; the message names the file. */
export class CalibrationFileError extends Error {
  override readonly name = 'CalibrationFileError';
}

/** Parses a JSON file. Throws {@link CalibrationFileError} naming the file. */
export function readJsonFile(path: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    throw new CalibrationFileError(
      `${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new CalibrationFileError(
      `${path}: not JSON (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

/** Reads and validates a wash record. Throws `WashRecordError` with every problem. */
export function readWashRecordFile(path: string): WashRecord {
  return parseWashRecord(readJsonFile(path));
}

/** Writes a value as indented JSON, creating the directory. */
export function writeJsonFile(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

/** Writes text to a file, creating the directory. */
export function writeTextFile(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text.endsWith('\n') ? text : `${text}\n`);
}

/**
 * A calibration parameter set from files: a parameter file of the wash registry
 * (`spotless.params`, as a fit writes it) and, optionally, a JSON object of further overrides
 * (calibration keys included). Either may be absent.
 */
export function readCalibrationParams(paramFile?: string, overridesFile?: string): ParamSet {
  let overrides: Record<string, unknown> = {};
  if (paramFile !== undefined) {
    const json = readJsonFile(paramFile);
    const read = readParamSet(calibrationRegistry(), json, { onHashMismatch: 'ignore' });
    if (!read.ok) {
      throw new CalibrationFileError(
        `${paramFile}: ${read.error.map((issue) => `${issue.key}: ${issue.message}`).join('; ')}`,
      );
    }
    overrides = { ...read.value.overrides };
  }
  if (overridesFile !== undefined) {
    const json = readJsonFile(overridesFile);
    if (typeof json !== 'object' || json === null || Array.isArray(json)) {
      throw new CalibrationFileError(`${overridesFile}: must be a JSON object of key to value`);
    }
    overrides = { ...overrides, ...(json as Record<string, unknown>) };
  }
  return createCalibrationParams(overrides);
}

/** Name of the file of calibration keys a fit writes beside its parameter file. */
export const CALIBRATION_FILE = 'calibration.json';

/**
 * A fitted set as `spotless-fit fit --out` writes it: the parameter file and the calibration
 * keys in `calibration.json` beside it (or in `calibrationFile`). `missing` is true when there
 * is no such file: the set is then the parameter file alone, which is not the fit if a `prog.*`
 * or `cal.*` key was fitted (the provenance note of the parameter file says so: `warning`).
 */
export function readFittedParams(
  paramFile: string,
  calibrationFile?: string,
): { readonly params: ParamSet; readonly missing: boolean; readonly warning: string | null } {
  const beside = calibrationFile ?? join(dirname(paramFile), CALIBRATION_FILE);
  const found = existsSync(beside);
  if (calibrationFile !== undefined && !found) {
    throw new CalibrationFileError(`${calibrationFile}: no such file`);
  }
  const params = readCalibrationParams(paramFile, found ? beside : undefined);
  let warning: string | null = null;
  if (!found) {
    const json = readJsonFile(paramFile) as { provenance?: { note?: unknown } };
    const note = typeof json.provenance?.note === 'string' ? json.provenance.note : '';
    warning = note.includes('NOT THE WHOLE FIT')
      ? `${paramFile} is not the whole fit and ${beside} is missing: ${note.slice(note.indexOf('NOT THE WHOLE FIT'))}`
      : `no ${CALIBRATION_FILE} beside ${paramFile}: the calibration's own keys (obs.*, cal.*, prog.*) are at their defaults`;
  }
  return { params, missing: !found, warning };
}

/** The exposure cache on disk in `directory`, shared with `spotless-wash`. */
export function diskExposureCache(directory: string): ExposureCache {
  return createDiskExposureCache(directory);
}

/** The default directory of the exposure cache of the calibration, under the repository's `.spotless`. */
export function defaultCacheDirectory(repositoryRoot: string): string {
  return join(repositoryRoot, '.spotless', 'exposure-cache');
}
