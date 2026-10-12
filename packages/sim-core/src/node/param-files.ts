/**
 * Named parameter-set files of a wash: read from disk, checked, and laid over the registry
 * defaults (`param-layers.ts`).
 *
 * A parameter-set file (`spotless.params`, written by `ParamSet.toJSON`) stores, beside its
 * overrides, the hashes of both parameter groups as they resolved when it was written, with
 * every default in them, and the unit and kind of every key it overrides. When the registry
 * has changed since (a default moved, a parameter was added or removed, a unit changed), the
 * stored hashes no longer match: the file is STALE. Its numbers were fitted or chosen against
 * other defaults, and for a set anchored to a water side, against another water side. A stale
 * file is not read silently: {@link readParamLayerFile} throws a {@link StaleParamSetError}
 * that says what does not match and what to do. A caller who knows what that means may accept
 * it (`acceptStale`); the layer is then marked stale and the result of the wash records it.
 *
 * The registry hashes do not see a change of CODE. A set of origin `calibration` was fitted to
 * what the water side gives every deposit, so it also says which water side that was
 * (`anchoredOn`: the version string of the simulator and the fingerprint of the exposure
 * sources, `exposureFingerprint`), and it is stale as well when either differs from the code
 * that is about to run, or when it does not say (review of 10 October 2026: a set anchored on
 * water-3 and written again against the registry of water-4 was read as fresh).
 *
 * A set that another set has REPLACED says so itself (`supersededBy`, written by the
 * calibration side when it delivers the replacement) and is stale for that reason alone,
 * whatever its hashes and its water side: a set whose values a measurement has contradicted
 * must not read as current again because the code it was fitted on happens to be on disk
 * (11 October 2026: the set with the soak the owner's first wash contradicted went on loading).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readParamSet, type ParamIssue } from '@spotless/sim-params';
import { composeParamLayers, type ComposedParams, type ParamLayer } from '../param-layers.ts';
import { washRegistry } from '../registry.ts';
import { SIM_VERSION } from '../wash.ts';
import { exposureFingerprint, machineFingerprint } from './fingerprint.ts';

/**
 * Which water side a calibrated set was fitted on, as its file records it beside the
 * parameters (`anchoredOn`). Written by {@link anchoredOnNow}.
 */
export interface AnchoredOn {
  /** `SIM_VERSION` of the simulator the set was fitted on. */
  readonly simVersion: string;
  /** `exposureFingerprint()` of the sources it was fitted on, hex. */
  readonly exposureSource: string;
  /**
   * `machineFingerprint()` of the machine data it was fitted on, hex. Recorded by sets fitted
   * since the fifth anchoring (11 October 2026: a basket was corrected under the fourth and
   * its sets went on reading as current); a set that records it is stale when it differs.
   */
  readonly machineSource?: string;
}

/** The water side of the code on disk now: what a set fitted now records as `anchoredOn`. */
export function anchoredOnNow(): AnchoredOn {
  return {
    simVersion: SIM_VERSION,
    exposureSource: exposureFingerprint(),
    machineSource: machineFingerprint(),
  };
}

/** Hex digits of a fingerprint shown in a message. */
const SHOWN_DIGITS = 12;

/**
 * What is stale about the water side a calibrated set records, against the code on disk:
 * nothing for a set of another origin.
 */
export function waterSideIssues(
  json: unknown,
  current: AnchoredOn = anchoredOnNow(),
): ParamIssue[] {
  if (typeof json !== 'object' || json === null) return [];
  const document = json as { provenance?: { origin?: unknown }; anchoredOn?: unknown };
  if (document.provenance?.origin !== 'calibration') return [];
  const anchored =
    typeof document.anchoredOn === 'object' && document.anchoredOn !== null
      ? (document.anchoredOn as {
          simVersion?: unknown;
          exposureSource?: unknown;
          machineSource?: unknown;
        })
      : undefined;
  const issues: ParamIssue[] = [];
  if (anchored === undefined || typeof anchored.exposureSource !== 'string') {
    issues.push({
      key: '',
      code: 'hash-mismatch',
      message:
        'water side: the set is a calibrated one and does not record the exposure sources it was fitted on (anchoredOn.exposureSource)',
    });
    return issues;
  }
  if (anchored.simVersion !== current.simVersion) {
    issues.push({
      key: '',
      code: 'hash-mismatch',
      message: `water side: fitted on ${String(anchored.simVersion)}, the simulator on disk is ${current.simVersion}`,
    });
  }
  if (anchored.exposureSource !== current.exposureSource) {
    issues.push({
      key: '',
      code: 'hash-mismatch',
      message: `water side: fitted on exposure sources ${anchored.exposureSource.slice(0, SHOWN_DIGITS)}, those on disk are ${current.exposureSource.slice(0, SHOWN_DIGITS)} (the code that computes what water reaches a deposit changed)`,
    });
  }
  if (
    typeof anchored.machineSource === 'string' &&
    current.machineSource !== undefined &&
    anchored.machineSource !== current.machineSource
  ) {
    issues.push({
      key: '',
      code: 'hash-mismatch',
      message: `machine: fitted on machine data ${anchored.machineSource.slice(0, SHOWN_DIGITS)}, those on disk are ${current.machineSource.slice(0, SHOWN_DIGITS)} (packages/machine/src changed)`,
    });
  }
  return issues;
}

/**
 * What a set records when another set has replaced it: which one, when and why. A file that
 * carries it is never read as current ({@link supersededIssues}).
 */
export interface SupersededBy {
  /** Name of the set that replaced it. */
  readonly set: string;
  /** Why it was replaced, in a sentence. */
  readonly why: string;
  /** ISO 8601 date of the replacement. */
  readonly on?: string;
}

/**
 * What is stale about a set that says another one has replaced it (`supersededBy`): one issue
 * naming the replacement, or nothing for a set that does not say so. A `supersededBy` that is
 * not an object with the name of a set counts as well: the mark is there, whatever it holds.
 */
export function supersededIssues(json: unknown): ParamIssue[] {
  if (typeof json !== 'object' || json === null) return [];
  const mark = (json as { supersededBy?: unknown }).supersededBy;
  if (mark === undefined || mark === null) return [];
  const by =
    typeof mark === 'object' ? (mark as { set?: unknown; why?: unknown; on?: unknown }) : {};
  const set = typeof by.set === 'string' ? by.set : 'another set';
  return [
    {
      key: '',
      code: 'hash-mismatch',
      message: `superseded: replaced by ${set}${typeof by.on === 'string' ? ` on ${by.on}` : ''}${typeof by.why === 'string' ? ` (${by.why})` : ''}`,
    },
  ];
}

/** Thrown for a parameter-set file whose stored hashes or definitions are stale. */
export class StaleParamSetError extends Error {
  override readonly name = 'StaleParamSetError';
  /** The file, and the name of the set in it. */
  readonly file: string;
  readonly setName: string;
  /** What does not match. */
  readonly issues: readonly ParamIssue[];
  constructor(file: string, setName: string, issues: readonly ParamIssue[], remedy: string) {
    super(
      `parameter set "${setName}" (${file}) is stale: it was written against another state of the parameter registry or of the water side, or another set has replaced it.\n` +
        issues
          .map((issue) => `  - ${issue.key === '' ? '' : `${issue.key}: `}${issue.message}`)
          .join('\n') +
        `\nIts values were fitted or chosen with other defaults under them (hydroHash: the water side; soilHash: the soil, liquor and inspection side), so a wash with it would not be the wash it was made for.\nWhat to do: ${remedy}`,
    );
    this.file = file;
    this.setName = setName;
    this.issues = issues;
  }
}

/** Thrown for a file that is not a parameter set, or whose values do not validate. */
export class ParamSetFileError extends Error {
  override readonly name = 'ParamSetFileError';
}

/** Options of {@link readParamLayerFile}. */
export interface ReadParamLayerOptions {
  /** `set` (default) or `detergent`: how the layer is laid over the ones below it. */
  readonly role?: ParamLayer['role'];
  /**
   * True to read a stale file all the same, under the current definitions. The layer is
   * marked stale and the result of a wash with it says so.
   */
  readonly acceptStale?: boolean;
}

/** What to do about a stale file, by where it comes from. */
function remedyFor(origin: string, role: ParamLayer['role'], superseded = false): string {
  if (superseded) {
    return 'wash with the set that replaced it (for the default of a machine: MACHINE_WASH_DEFAULTS of packages/wash-runner/src/defaults.ts), or, to reproduce an old result knowingly, accept stale sets (`--accept-stale-params` on the commands, `acceptStale` in code): the result then records the set as stale.';
  }
  const accept =
    'or, to wash with its values under the current definitions knowingly, accept stale sets (`--accept-stale-params` on the commands, `acceptStale` in code): the result then records the set as stale.';
  if (role === 'detergent') {
    return `write the detergent set again against the current registry (createWashParams(overrides, provenance).toJSON(), as packages/calibration/detergents/ are made), ${accept}`;
  }
  if (origin === 'calibration') {
    return `make the set again on the current simulator (for an anchored set: packages/calibration, \`pnpm exec tsx anchors/scripts/fit.ts\` and \`anchors/scripts/make-owner-set.ts\`; when only the sources changed and not what a wash computes, \`anchors/scripts/revalidate.ts\` washes the set's reference load again and re-stamps the set if the result is the one it recorded), ${accept}`;
  }
  return `write the set again against the current registry (createWashParams(overrides, provenance).toJSON()), ${accept}`;
}

/**
 * Reads one parameter-set file as a layer. Throws {@link ParamSetFileError} for a file that
 * is not a parameter set or holds an unknown key or a value out of range, and
 * {@link StaleParamSetError} for a stale one unless `acceptStale` is set.
 */
export function readParamLayerFile(file: string, options: ReadParamLayerOptions = {}): ParamLayer {
  const path = resolve(file);
  const role = options.role ?? 'set';
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch (error) {
    throw new ParamSetFileError(
      `${path}: cannot be read as JSON (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  const registry = washRegistry();
  const strict = readParamSet(registry, json);
  const superseded = supersededIssues(json);
  const water = [...superseded, ...waterSideIssues(json)];
  if (strict.ok && water.length === 0) {
    return {
      name: strict.value.provenance.name,
      role,
      overrides: strict.value.overrides,
      origin: strict.value.provenance.origin,
      file,
    };
  }
  const staleCodes: readonly ParamIssue['code'][] = ['hash-mismatch', 'definition-changed'];
  const found = strict.ok ? [] : strict.error;
  const stale = [...found.filter((issue) => staleCodes.includes(issue.code)), ...water];
  const other = found.filter((issue) => !staleCodes.includes(issue.code));
  if (other.length > 0) {
    throw new ParamSetFileError(
      `${path}: ${other.map((issue) => `${issue.key === '' ? '' : `${issue.key}: `}${issue.message}`).join('; ')}`,
    );
  }
  // Only staleness is wrong with it: the values validate under the current definitions.
  const lenient = readParamSet(registry, json, { onHashMismatch: 'ignore' });
  if (!lenient.ok) {
    throw new ParamSetFileError(
      `${path}: ${lenient.error.map((issue) => `${issue.key}: ${issue.message}`).join('; ')}`,
    );
  }
  const name = lenient.value.provenance.name;
  const origin = lenient.value.provenance.origin;
  if (options.acceptStale !== true) {
    throw new StaleParamSetError(path, name, stale, remedyFor(origin, role, superseded.length > 0));
  }
  return { name, role, overrides: lenient.value.overrides, origin, file, stale: true };
}

/** The named sets and the detergent of a wash, as files. */
export interface WashParamFiles {
  /** Parameter-set files laid over the registry defaults, in order. */
  readonly paramSets?: readonly string[];
  /** The parameter-set file of the detergent's composition, laid over them. */
  readonly detergent?: string;
  /** True to read stale files all the same (see {@link ReadParamLayerOptions.acceptStale}). */
  readonly acceptStale?: boolean;
}

/**
 * Reads the files and lays them over the registry defaults: the overrides for
 * `WashInput.params` and the records for `WashInput.paramSets`. Throws as
 * {@link readParamLayerFile} does.
 */
export function composeParamFiles(files: WashParamFiles): ComposedParams {
  const layers: ParamLayer[] = (files.paramSets ?? []).map((file) =>
    readParamLayerFile(file, { ...(files.acceptStale === true ? { acceptStale: true } : {}) }),
  );
  if (files.detergent !== undefined) {
    layers.push(
      readParamLayerFile(files.detergent, {
        role: 'detergent',
        ...(files.acceptStale === true ? { acceptStale: true } : {}),
      }),
    );
  }
  return composeParamLayers(washRegistry(), layers);
}
