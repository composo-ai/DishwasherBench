/**
 * Parameter sets of module M2 (docs/design/sim-core.md section M2; scope note, "Calibration is a
 * first-class feature"): the registry defaults with overrides from a plain JSON object, which is
 * how a calibration run or a level supplies values.
 *
 * A set is immutable and carries two hashes, one per group, of the canonical JSON of every
 * resolved value of the group (defaults included, so a changed default changes the hash).
 * Exposure is cached by the hydro hash only (section M2), so changing a soil parameter and
 * replaying a wash reuses it. The hashes do not depend on the order in which the registry was
 * composed or the overrides were written.
 */
import { canonicalHash, err, ok, type Result } from '@spotless/core';
import {
  checkParamValue,
  compareKeys,
  paramKind,
  type ParamRegistry,
  soilClassKey,
  SOIL_KEY_PREFIX,
} from './registry.ts';
import type { AnyParamDef, ParamGroup, ParamValue } from './types.ts';

/** One problem with an override or a parameter file. */
export interface ParamIssue {
  /** The key the problem concerns; empty for a problem with the file as a whole. */
  readonly key: string;
  /** What kind of problem it is. */
  readonly code:
    'unknown-key' | 'invalid-value' | 'bad-format' | 'hash-mismatch' | 'definition-changed';
  /** A sentence for a person. */
  readonly message: string;
}

/** Thrown by the throwing constructors when overrides do not validate. */
export class ParamSetError extends Error {
  override readonly name = 'ParamSetError';
  /** Every problem found. */
  readonly issues: readonly ParamIssue[];
  constructor(issues: readonly ParamIssue[]) {
    super(`invalid parameters:\n  ${issues.map((i) => `${i.key}: ${i.message}`).join('\n  ')}`);
    this.issues = issues;
  }
}

/**
 * Where a parameter set comes from. Free of meaning to the simulation and not part of either
 * hash; it travels with the set so that a result can say which calibration produced its values.
 */
export interface ParamProvenance {
  /** Short name of the set, for example `defaults` or `fit-2026-11-02-egg`. */
  readonly name: string;
  /** How the values were obtained. */
  readonly origin: 'defaults' | 'manual' | 'level' | 'calibration';
  /** Free text: the fitting tool and its settings, the wash records used, who edited it. */
  readonly note?: string;
  /** Ids of the wash records a calibration used. */
  readonly washRecords?: readonly string[];
  /** ISO 8601 time the set was written, supplied by the caller (the simulation reads no clock). */
  readonly createdAt?: string;
}

/** Provenance of a set made of registry defaults only. */
export const DEFAULT_PROVENANCE: ParamProvenance = { name: 'defaults', origin: 'defaults' };

/** Identifier of the parameter file format. */
export const PARAM_FILE_FORMAT = 'spotless.params';

/** Version of the parameter file format. */
export const PARAM_FILE_VERSION = 1;

/**
 * What a value means, as far as a parameter file depends on it: the part of a definition that,
 * if it changes, makes a stored value mean something else even though it still validates.
 */
export interface ParamDefShape {
  /** Kind of the definition. */
  readonly kind: 'scalar' | 'vector' | 'enum';
  /** Unit the value is written in. */
  readonly unit: string;
  /** Number of components, for a vector. */
  readonly length?: number;
  /** The names in order, for an enumeration (a kernel receives the position). */
  readonly options?: readonly string[];
}

/** The {@link ParamDefShape} of a definition. */
export function paramDefShape(def: AnyParamDef): ParamDefShape {
  if (def.kind === 'vector') return { kind: 'vector', unit: def.unit, length: def.default.length };
  if (def.kind === 'enum') return { kind: 'enum', unit: def.unit, options: [...def.options] };
  return { kind: paramKind(def), unit: def.unit };
}

/** A sentence saying how `now` differs from `then`, or `null` when they are the same. */
function shapeDifference(then: unknown, now: ParamDefShape): string | null {
  if (!isRecord(then)) return 'the file does not record the definition it was written against';
  if (then['kind'] !== now.kind) {
    return `kind was ${JSON.stringify(then['kind'])} and is now "${now.kind}"`;
  }
  if (then['unit'] !== now.unit) {
    return `unit was ${JSON.stringify(then['unit'])} and is now "${now.unit}"`;
  }
  if (now.length !== undefined && then['length'] !== now.length) {
    return `length was ${JSON.stringify(then['length'])} and is now ${now.length}`;
  }
  if (
    now.options !== undefined &&
    JSON.stringify(then['options']) !== JSON.stringify(now.options)
  ) {
    return `options were ${JSON.stringify(then['options'])} and are now ${JSON.stringify(now.options)}`;
  }
  return null;
}

/** A parameter set as a JSON document: overrides, provenance and the hashes they produced. */
export interface ParamSetJson {
  /** Always {@link PARAM_FILE_FORMAT}. */
  readonly format: typeof PARAM_FILE_FORMAT;
  /** Always {@link PARAM_FILE_VERSION}. */
  readonly version: typeof PARAM_FILE_VERSION;
  /** Where the values come from. */
  readonly provenance: ParamProvenance;
  /** The values that differ from the registry declaration, by key, keys sorted. */
  readonly overrides: Readonly<Record<string, ParamValue>>;
  /**
   * Kind, unit, vector length and enumeration options of every overridden key when the file was
   * written, keys sorted: what {@link readParamSet} compares with the current registry.
   */
  readonly definitions: Readonly<Record<string, ParamDefShape>>;
  /**
   * Hash of the registry the file was written against (`ParamRegistry.hash`). A record of
   * origin: it is not compared on read, because it changes with any edit of any definition
   * (a source text, a new parameter), which would invalidate every fitted file. The checks
   * that matter are the two value hashes and `definitions`.
   */
  readonly registryHash: string;
  /** Hydro hash of the set when written. */
  readonly hydroHash: string;
  /** Soil hash of the set when written. */
  readonly soilHash: string;
}

/** A resolved, immutable set of parameter values (section M2, widened beyond numbers). */
export interface ParamSet {
  /** The registry the set resolves against. */
  readonly registry: ParamRegistry;
  /** Where the values come from. */
  readonly provenance: ParamProvenance;
  /** The overrides the set was built with, keys sorted. */
  readonly overrides: Readonly<Record<string, ParamValue>>;
  /** `sha256:` hash of the canonical JSON of the `hydro` group; part of every exposure key. */
  readonly hydroHash: string;
  /** `sha256:` hash of the canonical JSON of the `soil` group. */
  readonly soilHash: string;
  /** Value of a scalar key in the unit of its definition. Throws on an unknown or non-scalar key. */
  get(key: string): number;
  /** Components of a vector key. Throws on an unknown or non-vector key. */
  getVector(key: string): readonly number[];
  /** Name held by an enumeration key. Throws on an unknown or non-enumeration key. */
  getEnum(key: string): string;
  /** Position of the name held by an enumeration key in its `options`: what a kernel receives. */
  enumIndex(key: string): number;
  /** Value of any key. Throws on an unknown key. */
  value(key: string): ParamValue;
  /**
   * Scalar soil parameter `name` for a soil class: `soil.<class>.<name>` when the class has a
   * declaration or an override of that key, else the global `soil.<name>` (section M2). Throws
   * on an unknown class or name.
   */
  soilClass(soilClass: string, name: string): number;
  /**
   * {@link ParamSet.soilClass} for each of `classes` in the given order (default: every class of
   * the registry, sorted): the per-class table a kernel or a rate table indexes by class code.
   */
  soilClassTable(name: string, classes?: readonly string[]): Float64Array;
  /** Every resolved value of one group, keys sorted: exactly what the group hash covers. */
  values(group: ParamGroup): Readonly<Record<string, ParamValue>>;
  /** A new set with further overrides applied on top of this one's. Throws `ParamSetError`. */
  with(overrides: Readonly<Record<string, ParamValue>>, provenance?: ParamProvenance): ParamSet;
  /** The set as a JSON document (see {@link readParamSet}). */
  toJSON(): ParamSetJson;
}

/**
 * Validates overrides against the registry: unknown keys, wrong types, wrong vector lengths,
 * unknown names, values outside the declared range, non-finite values and attempts to change a
 * fixed parameter. Returns every problem (empty when the overrides are acceptable).
 */
export function validateOverrides(
  registry: ParamRegistry,
  overrides: Readonly<Record<string, unknown>>,
): ParamIssue[] {
  const issues: ParamIssue[] = [];
  for (const key of Object.keys(overrides).sort(compareKeys)) {
    const def = registry.find(key);
    if (!def) {
      issues.push({ key, code: 'unknown-key', message: 'not a registry key' });
      continue;
    }
    const problem = checkParamValue(def, overrides[key]);
    if (problem) issues.push({ key, code: 'invalid-value', message: problem });
  }
  return issues;
}

function normalise(value: ParamValue): ParamValue {
  // Negative zero is stored as zero so that the value used equals the value hashed (canonical
  // JSON renders both as "0"; determinism rule 14).
  if (typeof value === 'number') return value === 0 ? 0 : value;
  if (typeof value === 'string') return value;
  return Object.freeze(value.map((v) => (v === 0 ? 0 : v)));
}

function build(
  registry: ParamRegistry,
  overrides: Readonly<Record<string, ParamValue>>,
  provenance: ParamProvenance,
): ParamSet {
  const sortedOverrides: Record<string, ParamValue> = {};
  const values = new Map<string, ParamValue>();
  const defs = new Map<string, AnyParamDef>();
  for (const def of registry.defs) {
    values.set(def.key, normalise(def.default));
    defs.set(def.key, def);
  }
  for (const key of Object.keys(overrides).sort(compareKeys)) {
    const value = normalise(overrides[key] as ParamValue);
    sortedOverrides[key] = value;
    values.set(key, value);
    defs.set(key, registry.def(key));
  }
  Object.freeze(sortedOverrides);

  const keys = [...values.keys()].sort(compareKeys);
  const groupValues = (group: ParamGroup): Record<string, ParamValue> => {
    const out: Record<string, ParamValue> = {};
    for (const key of keys) {
      if ((defs.get(key) as AnyParamDef).group === group) out[key] = values.get(key) as ParamValue;
    }
    return out;
  };
  const hydro = Object.freeze(groupValues('hydro'));
  const soil = Object.freeze(groupValues('soil'));
  const hydroHash = canonicalHash(hydro);
  const soilHash = canonicalHash(soil);

  const value = (key: string): ParamValue => {
    const v = values.get(key);
    if (v !== undefined) return v;
    // An undeclared per-class key without an override reads as the global value.
    const def = registry.def(key);
    const global = `${SOIL_KEY_PREFIX}.${key.split('.').slice(2).join('.')}`;
    const fallback = values.get(global);
    if (fallback === undefined) throw new Error(`parameter "${def.key}" has no value`);
    return fallback;
  };
  const expect = <T extends ParamValue>(
    key: string,
    kind: string,
    test: (v: ParamValue) => v is T,
  ): T => {
    const v = value(key);
    if (!test(v)) throw new TypeError(`parameter "${key}" is not ${kind}`);
    return v;
  };
  const isNumber = (v: ParamValue): v is number => typeof v === 'number';
  const isVector = (v: ParamValue): v is readonly number[] => Array.isArray(v);
  const isName = (v: ParamValue): v is string => typeof v === 'string';

  const soilClass = (cls: string, name: string): number => {
    if (!registry.soilClasses.includes(cls)) {
      throw new RangeError(`unknown soil class "${cls}"`);
    }
    return expect(soilClassKey(cls, name), 'a scalar', isNumber);
  };

  const set: ParamSet = {
    registry,
    provenance,
    overrides: sortedOverrides,
    hydroHash,
    soilHash,
    get: (key) => expect(key, 'a scalar', isNumber),
    getVector: (key) => expect(key, 'a vector', isVector),
    getEnum: (key) => expect(key, 'an enumeration', isName),
    enumIndex: (key) => {
      const def = registry.def(key);
      const name = expect(key, 'an enumeration', isName);
      return def.kind === 'enum' ? def.options.indexOf(name) : -1;
    },
    value,
    soilClass,
    soilClassTable: (name, classes = registry.soilClasses) =>
      Float64Array.from(classes, (cls) => soilClass(cls, name)),
    values: (group) => (group === 'hydro' ? hydro : soil),
    with: (more, newProvenance) =>
      createParamSet(registry, { ...sortedOverrides, ...more }, newProvenance ?? provenance),
    toJSON: () => ({
      format: PARAM_FILE_FORMAT,
      version: PARAM_FILE_VERSION,
      provenance,
      overrides: sortedOverrides,
      definitions: Object.fromEntries(
        Object.keys(sortedOverrides).map((key) => [key, paramDefShape(registry.def(key))]),
      ),
      registryHash: registry.hash,
      hydroHash,
      soilHash,
    }),
  };
  return Object.freeze(set);
}

/**
 * Builds a parameter set from registry defaults and overrides, or returns every validation
 * problem. Use this form for values that come from outside the program (a level, a calibration
 * file, a tool): bad input is a value, not an exception (platform.md section 2, "Errors").
 */
export function tryCreateParamSet(
  registry: ParamRegistry,
  overrides: Readonly<Record<string, unknown>> = {},
  provenance: ParamProvenance = DEFAULT_PROVENANCE,
): Result<ParamSet, readonly ParamIssue[]> {
  const issues = validateOverrides(registry, overrides);
  if (issues.length > 0) return err(issues);
  return ok(build(registry, overrides as Readonly<Record<string, ParamValue>>, provenance));
}

/**
 * As {@link tryCreateParamSet}, throwing `ParamSetError` when the overrides do not validate.
 * With no overrides this is the set of registry defaults.
 */
export function createParamSet(
  registry: ParamRegistry,
  overrides: Readonly<Record<string, unknown>> = {},
  provenance: ParamProvenance = DEFAULT_PROVENANCE,
): ParamSet {
  const result = tryCreateParamSet(registry, overrides, provenance);
  if (!result.ok) throw new ParamSetError(result.error);
  return result.value;
}

/** Options of {@link readParamSet}. */
export interface ReadParamSetOptions {
  /**
   * What to do when the file no longer means what it meant when it was written: a hash stored
   * in the document differs from that of the set rebuilt against the current registry (a
   * default or a class list has changed), or the unit, kind, length or options of an
   * overridden key have changed. `error` (default) reports it, `ignore` accepts the stored
   * values under the current definitions.
   */
  readonly onHashMismatch?: 'error' | 'ignore';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads a parameter set from a parsed JSON document written by `ParamSet.toJSON` (brief of M2,
 * item 2). The overrides are validated against the registry; the unit, kind, vector length and
 * enumeration options of every overridden key are compared with those the file records (issue
 * `definition-changed`, one per key); and the two hashes are recomputed and compared with the
 * stored ones (`hash-mismatch`). A file that no longer means what it meant when it was fitted
 * is thus reported, not silently reinterpreted: a value fitted in one unit is not accepted in
 * another.
 */
export function readParamSet(
  registry: ParamRegistry,
  json: unknown,
  options: ReadParamSetOptions = {},
): Result<ParamSet, readonly ParamIssue[]> {
  const bad = (message: string): Result<ParamSet, readonly ParamIssue[]> =>
    err([{ key: '', code: 'bad-format', message }]);
  if (!isRecord(json)) return bad('a parameter file is a JSON object');
  if (json['format'] !== PARAM_FILE_FORMAT) return bad(`format is not "${PARAM_FILE_FORMAT}"`);
  if (json['version'] !== PARAM_FILE_VERSION)
    return bad(`unsupported version ${String(json['version'])}`);
  const overrides = json['overrides'];
  if (!isRecord(overrides)) return bad('overrides is not an object');
  const provenance = json['provenance'];
  if (
    !isRecord(provenance) ||
    typeof provenance['name'] !== 'string' ||
    !['defaults', 'manual', 'level', 'calibration'].includes(provenance['origin'] as string)
  ) {
    return bad('provenance needs a name and an origin');
  }
  const definitions = json['definitions'];
  if (!isRecord(definitions)) return bad('definitions is not an object');
  const result = tryCreateParamSet(registry, overrides, provenance as unknown as ParamProvenance);
  if (!result.ok || options.onHashMismatch === 'ignore') return result;
  const issues: ParamIssue[] = [];
  for (const key of Object.keys(result.value.overrides)) {
    const difference = shapeDifference(
      Object.hasOwn(definitions, key) ? definitions[key] : undefined,
      paramDefShape(registry.def(key)),
    );
    if (difference) issues.push({ key, code: 'definition-changed', message: difference });
  }
  for (const field of ['hydroHash', 'soilHash'] as const) {
    if (json[field] !== result.value[field]) {
      issues.push({
        key: '',
        code: 'hash-mismatch',
        message: `${field} of the file is ${String(json[field])} but the current registry gives ${result.value[field]}`,
      });
    }
  }
  return issues.length > 0 ? err(issues) : result;
}
