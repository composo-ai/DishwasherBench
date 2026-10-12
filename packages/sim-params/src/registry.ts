/**
 * The parameter registry of module M2 (docs/design/sim-core.md sections 0 and M2; scope note,
 * "Calibration is a first-class feature"): the one place a physical constant is defined.
 *
 * Each simulation package declares its `AnyParamDef`s next to the code that uses them and
 * contributes the list; `createRegistry` composes the contributions into one registry, rejecting
 * duplicate keys and malformed definitions. The result does not depend on the order of the
 * contributions: definitions are held sorted by key.
 *
 * Per-class soil parameters (section M2: "Per-class soil tables (`soil.<class>.*`) override the
 * global defaults of the same name"): the registry knows the soil parameter classes (smallest
 * reading of contract-issues.md R2: one per catalogue soil id). `soil.<class>.<name>` may be
 * declared explicitly (a class with its own default) or left undeclared, in which case its
 * definition is derived from the global `soil.<name>`.
 */
import { canonicalHash } from '@spotless/core';
import {
  BRACKET_GROUPS,
  MAX_PARAM_VECTOR_LENGTH,
  PARAM_GROUPS,
  PARAM_TAGS,
  type AnyParamDef,
  type ParamGroup,
  type ParamScale,
  type ParamDef,
  type VectorParamDef,
} from './types.ts';

/** First segment of the keys that may be overridden per soil class. */
export const SOIL_KEY_PREFIX = 'soil';

/**
 * Key prefixes whose hash group the contract fixes (section M2): stages A to G read the `hydro`
 * prefixes, the replay reads the `soil` ones. A definition with one of these prefixes and the
 * other group is rejected, because it would put a parameter outside the cache key that covers
 * it. Other prefixes (`water`, `phys`) choose their group.
 */
export const GROUP_OF_PREFIX: Readonly<Record<string, ParamGroup>> = {
  scene: 'hydro',
  hyd: 'hydro',
  jets: 'hydro',
  spray: 'hydro',
  film: 'hydro',
  soil: 'soil',
  liq: 'soil',
  tl: 'soil',
  dry: 'soil',
};

/** Thrown for a malformed or duplicate definition and for a lookup of an unknown key. */
export class ParamRegistryError extends Error {
  override readonly name = 'ParamRegistryError';
}

/** The composed registry. Immutable. */
export interface ParamRegistry {
  /** Every declared definition, sorted by key (UTF-16 code units). */
  readonly defs: readonly AnyParamDef[];
  /** The soil parameter classes, sorted; each is a middle segment of `soil.<class>.<name>`. */
  readonly soilClasses: readonly string[];
  /**
   * `sha256:` hash of the canonical JSON of the definitions and soil classes: identifies the
   * registry content (keys, defaults, ranges, sources) a parameter file was written against.
   */
  readonly hash: string;
  /** True when `key` is declared, or is an undeclared per-class key of a declared global. */
  has(key: string): boolean;
  /**
   * Definition of `key`. For an undeclared `soil.<class>.<name>` this is the definition of
   * `soil.<name>` under the per-class key and without its calibration group. Throws
   * `ParamRegistryError` on an unknown key.
   */
  def(key: string): AnyParamDef;
  /** As {@link ParamRegistry.def}, or `undefined` for an unknown key. */
  find(key: string): AnyParamDef | undefined;
  /** True when `key` has a declaration of its own (not derived from a global). */
  declares(key: string): boolean;
  /** Names of the calibration groups in use, sorted. */
  calibrationGroups(): readonly string[];
  /** The declared definitions of one calibration group, sorted by key. */
  calibrationGroup(name: string): readonly AnyParamDef[];
}

/** Input of {@link createRegistry}. */
export interface RegistryInput {
  /** One list of definitions per contributing package, in any order. */
  readonly contributions: readonly (readonly AnyParamDef[])[];
  /**
   * Soil parameter classes (catalogue soil ids such as `egg_yolk_dried`), in any order.
   * Default: none.
   */
  readonly soilClasses?: readonly string[];
}

const KEY_PATTERN = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9][A-Za-z0-9_-]*)+$/;
const SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/** Compares strings by UTF-16 code unit, the order of canonical JSON. */
export function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The kind of a definition: a definition without `kind` is a scalar. */
export function paramKind(def: AnyParamDef): 'scalar' | 'vector' | 'enum' {
  return def.kind ?? 'scalar';
}

/** True for a scalar or vector definition. */
export function isNumericDef(def: AnyParamDef): def is ParamDef | VectorParamDef {
  return def.kind !== 'enum';
}

/**
 * The scale on which a fitting tool traverses the range of a numeric definition: the declared
 * `scale`, else `log` when the range is positive and spans more than a decade, else `linear`
 * (brief of M2, item 8).
 */
export function paramScale(def: ParamDef | VectorParamDef): ParamScale {
  if (def.scale !== undefined) return def.scale;
  return def.min > 0 && def.max / def.min > 10 ? 'log' : 'linear';
}

/** True when a numeric definition admits one value only (`min === max`). */
export function isFixedDef(def: AnyParamDef): boolean {
  return isNumericDef(def) && def.min === def.max;
}

/**
 * Splits a per-class soil key `soil.<class>.<name>` into its class and the global key
 * `soil.<name>`; `null` when `key` is not of that form for one of `soilClasses`.
 */
export function splitSoilClassKey(
  key: string,
  soilClasses: readonly string[],
): { readonly soilClass: string; readonly name: string; readonly globalKey: string } | null {
  const parts = key.split('.');
  if (parts.length < 3 || parts[0] !== SOIL_KEY_PREFIX) return null;
  const soilClass = parts[1] as string;
  if (!soilClasses.includes(soilClass)) return null;
  const name = parts.slice(2).join('.');
  return { soilClass, name, globalKey: `${SOIL_KEY_PREFIX}.${name}` };
}

/** The key of soil parameter `name` for `soilClass`: `soil.<class>.<name>`. */
export function soilClassKey(soilClass: string, name: string): string {
  return `${SOIL_KEY_PREFIX}.${soilClass}.${name}`;
}

function defJson(def: AnyParamDef): Record<string, unknown> {
  // A plain copy with `kind` made explicit, so that `kind: undefined` and `kind: 'scalar'` hash
  // alike. Arrays are copied because canonical JSON takes plain arrays only.
  const out: Record<string, unknown> = { ...def, kind: paramKind(def) };
  if (def.kind === 'vector') {
    out['default'] = [...def.default];
    if (def.components) out['components'] = [...def.components];
  }
  if (def.kind === 'enum') out['options'] = [...def.options];
  return out;
}

function checkDef(def: AnyParamDef): string[] {
  const problems: string[] = [];
  if (!KEY_PATTERN.test(def.key)) problems.push('key must be dot-separated segments');
  if (typeof def.unit !== 'string' || def.unit === '') problems.push('unit is empty');
  if (typeof def.source !== 'string' || def.source === '') problems.push('source is empty');
  if (!PARAM_TAGS.includes(def.tag)) problems.push(`unknown tag ${String(def.tag)}`);
  if (!PARAM_GROUPS.includes(def.group)) problems.push(`unknown group ${String(def.group)}`);
  if (def.bracket !== undefined && !BRACKET_GROUPS.includes(def.bracket)) {
    problems.push(`unknown bracket group ${String(def.bracket)}`);
  }
  if (def.calibration !== undefined && def.calibration === '') {
    problems.push('calibration group is empty');
  }
  const prefix = def.key.split('.')[0] as string;
  // An own-property lookup: `constructor.x` and `toString.x` are ordinary free prefixes.
  const fixedGroup = Object.hasOwn(GROUP_OF_PREFIX, prefix) ? GROUP_OF_PREFIX[prefix] : undefined;
  if (fixedGroup !== undefined && fixedGroup !== def.group) {
    problems.push(`keys under ${prefix}.* belong to group ${fixedGroup}`);
  }
  if (def.kind === 'enum') {
    if (def.options.length === 0) problems.push('no options');
    if (new Set(def.options).size !== def.options.length) problems.push('duplicate options');
    if (def.options.some((o) => typeof o !== 'string' || !SEGMENT_PATTERN.test(o))) {
      problems.push('an option is not a plain name');
    }
    if (!def.options.includes(def.default)) problems.push('default is not one of the options');
    return problems;
  }
  if (!Number.isFinite(def.min) || !Number.isFinite(def.max)) problems.push('range is not finite');
  else if (def.min > def.max) problems.push('min exceeds max');
  if (def.scale === 'log' && !(def.min > 0)) problems.push('a log scale needs min > 0');
  const values = def.kind === 'vector' ? def.default : [def.default];
  if (def.kind === 'vector') {
    if (!Array.isArray(def.default)) problems.push('default is not an array');
    else if (def.default.length < 1 || def.default.length > MAX_PARAM_VECTOR_LENGTH) {
      problems.push(`a vector has 1 to ${MAX_PARAM_VECTOR_LENGTH} components`);
    }
    if (def.components !== undefined) {
      if (def.components.length !== def.default.length) {
        problems.push('components and default differ in length');
      }
      if (new Set(def.components).size !== def.components.length) {
        problems.push('duplicate component names');
      }
      if (def.components.some((c) => !SEGMENT_PATTERN.test(c))) {
        problems.push('a component name is not a plain name');
      }
    }
  }
  for (const v of Array.isArray(values) ? values : []) {
    if (typeof v !== 'number' || !Number.isFinite(v)) problems.push('default is not finite');
    else if (v < def.min || v > def.max) problems.push(`default ${v} is outside the range`);
  }
  return problems;
}

function sameShape(a: AnyParamDef, b: AnyParamDef): boolean {
  if (paramKind(a) !== paramKind(b) || a.unit !== b.unit || a.group !== b.group) return false;
  if (a.kind === 'vector' && b.kind === 'vector') return a.default.length === b.default.length;
  if (a.kind === 'enum' && b.kind === 'enum') {
    return a.options.length === b.options.length && a.options.every((o, i) => o === b.options[i]);
  }
  return true;
}

/**
 * Composes the contributions of the simulation packages into one registry (brief of M2, item 1).
 *
 * Throws `ParamRegistryError` listing every problem found: a malformed definition, a key
 * declared twice (within or across contributions), a `hydro`/`soil` group that contradicts the
 * key prefix, a per-class soil definition without a global of the same name or with a different
 * kind, unit or length. The order of the contributions and of the definitions inside them does
 * not affect the result.
 */
export function createRegistry(input: RegistryInput): ParamRegistry {
  const problems: string[] = [];
  const soilClasses = [...(input.soilClasses ?? [])].sort(compareKeys);
  for (let i = 0; i < soilClasses.length; i++) {
    const c = soilClasses[i] as string;
    if (!SEGMENT_PATTERN.test(c)) problems.push(`soil class "${c}" is not a plain name`);
    if (i > 0 && soilClasses[i - 1] === c) problems.push(`soil class "${c}" is listed twice`);
  }

  const byKey = new Map<string, AnyParamDef>();
  for (const contribution of input.contributions) {
    for (const def of contribution) {
      const issues = checkDef(def);
      for (const issue of issues) problems.push(`${def.key}: ${issue}`);
      if (byKey.has(def.key)) problems.push(`${def.key}: declared more than once`);
      else byKey.set(def.key, def);
    }
  }
  const defs = [...byKey.values()].sort((a, b) => compareKeys(a.key, b.key));

  for (const def of defs) {
    const split = splitSoilClassKey(def.key, soilClasses);
    if (!split) continue;
    const global = byKey.get(split.globalKey);
    if (!global) {
      problems.push(`${def.key}: per-class key without the global ${split.globalKey}`);
    } else if (!sameShape(def, global)) {
      problems.push(`${def.key}: kind, unit, group or length differs from ${split.globalKey}`);
    }
  }
  if (problems.length > 0) {
    throw new ParamRegistryError(`invalid parameter registry:\n  ${problems.join('\n  ')}`);
  }

  const find = (key: string): AnyParamDef | undefined => {
    const own = byKey.get(key);
    if (own) return own;
    const split = splitSoilClassKey(key, soilClasses);
    if (!split) return undefined;
    const global = byKey.get(split.globalKey);
    if (!global) return undefined;
    // A derived per-class definition never belongs to a calibration group of its own accord:
    // the group of the global would otherwise appear to hold one parameter per class.
    const { calibration: _ofTheGlobal, ...rest } = global;
    return { ...rest, key };
  };

  const groups = new Map<string, AnyParamDef[]>();
  for (const def of defs) {
    if (def.calibration === undefined) continue;
    const list = groups.get(def.calibration) ?? [];
    list.push(def);
    groups.set(def.calibration, list);
  }
  const groupNames = [...groups.keys()].sort(compareKeys);

  return {
    defs,
    soilClasses,
    hash: canonicalHash({ defs: defs.map(defJson), soilClasses }),
    has: (key) => find(key) !== undefined,
    find,
    def: (key) => {
      const def = find(key);
      if (!def) throw new ParamRegistryError(`unknown parameter "${key}"`);
      return def;
    },
    declares: (key) => byKey.has(key),
    calibrationGroups: () => groupNames,
    calibrationGroup: (name) => groups.get(name) ?? [],
  };
}

/**
 * Checks one value against a definition. Returns a description of what is wrong, or `null`.
 * Used by parameter sets for overrides; exported for tools that edit values interactively.
 */
export function checkParamValue(def: AnyParamDef, value: unknown): string | null {
  if (def.kind === 'enum') {
    if (typeof value !== 'string') return `expected one of ${def.options.join(', ')}`;
    return def.options.includes(value)
      ? null
      : `"${value}" is not one of ${def.options.join(', ')}`;
  }
  const check = (v: unknown): string | null => {
    if (typeof v !== 'number') return 'expected a number';
    if (!Number.isFinite(v)) return 'value is not finite';
    if (v < def.min || v > def.max) {
      return def.min === def.max
        ? `the parameter is fixed at ${def.min} ${def.unit}`
        : `${v} is outside ${def.min} to ${def.max} ${def.unit}`;
    }
    return null;
  };
  if (def.kind === 'vector') {
    if (!Array.isArray(value)) return `expected an array of ${def.default.length} numbers`;
    if (value.length !== def.default.length) {
      return `expected ${def.default.length} components, got ${value.length}`;
    }
    for (let i = 0; i < value.length; i++) {
      const problem = check(value[i]);
      if (problem) return `component ${i}: ${problem}`;
    }
    return null;
  }
  return check(value);
}
