/**
 * Uniform blocks built from the registry (docs/design/sim-core.md section 0: "kernels receive
 * [constants] through uniform blocks built from the registry (module M2)").
 *
 * From a list of keys, `buildUniformLayout` produces a WGSL struct of f32 members and
 * `packUniformBlock` the matching `Float32Array`. A scalar is one member, a vector one member
 * per component, an enumeration one member holding the index of its name. Members are ordered by
 * key and the block is padded to a multiple of 16 bytes, so the layout depends on the set of keys
 * only. Every member is an f32, so the offset of member i is 4 i bytes under WGSL's layout rules.
 *
 * Per-class soil parameters reach a kernel as a storage buffer with one row per soil class:
 * `buildSoilClassLayout` and `packSoilClassTable`.
 */
import { bytesToHex, canonicalHash, sha256, utf8Encode } from '@spotless/core';
import type { ExprWgslTarget } from './expr.ts';
import type { ParamSet } from './param-set.ts';
import { compareKeys, type ParamRegistry, SOIL_KEY_PREFIX } from './registry.ts';
import type { AnyParamDef } from './types.ts';

/** One f32 member of a uniform block. */
export interface UniformField {
  /** WGSL member name, for example `film_kappaW` or `film_sigma_D`. */
  readonly name: string;
  /** Registry key the member holds; `null` for padding. */
  readonly key: string | null;
  /** Component of a vector parameter; `null` for a scalar, an enumeration or padding. */
  readonly index: number | null;
  /** Offset of the member in the block, bytes. */
  readonly offset: number;
}

/** A uniform block layout: the WGSL struct and how to fill it. */
export interface UniformLayout {
  /** Name of the WGSL struct. */
  readonly structName: string;
  /** The keys of the block, sorted. */
  readonly keys: readonly string[];
  /** The members in order, padding included. */
  readonly fields: readonly UniformField[];
  /** Size of the block, bytes: a multiple of 16. */
  readonly byteLength: number;
  /** WGSL declaration of the struct. */
  readonly wgsl: string;
  /** `sha256:` hash of the struct text: identifies the layout in a kernel's provenance. */
  readonly hash: string;
  /** Member name for a key (and component). Throws when the block does not hold it. */
  fieldName(key: string, index?: number | null): string;
  /**
   * An {@link ExprWgslTarget} that reads parameters as members of the uniform variable
   * `variable` (`params.film_kappaW`): pass it to `emitExprWgsl`.
   */
  target(variable: string): ExprWgslTarget;
}

/** Thrown for a key a layout cannot hold or a value an f32 cannot. */
export class UniformBlockError extends Error {
  override readonly name = 'UniformBlockError';
}

/** WGSL member name of a registry key: every character outside `[A-Za-z0-9]` becomes `_`. */
export function uniformFieldName(key: string, component?: string | number): string {
  const base = key.replace(/[^A-Za-z0-9]/g, '_');
  return component === undefined
    ? base
    : `${base}_${String(component).replace(/[^A-Za-z0-9]/g, '_')}`;
}

function fieldsOf(def: AnyParamDef): { name: string; index: number | null }[] {
  if (def.kind !== 'vector') return [{ name: uniformFieldName(def.key), index: null }];
  return def.default.map((_, i) => ({
    name: uniformFieldName(def.key, def.components?.[i] ?? i),
    index: i,
  }));
}

const STRUCT_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;

/**
 * Builds the layout of a uniform block that holds `keys` (brief of M2, item 4). The order and
 * repetition of `keys` do not matter. Throws `UniformBlockError` on an unknown key or when two
 * keys map to the same member name.
 */
export function buildUniformLayout(
  registry: ParamRegistry,
  structName: string,
  keys: readonly string[],
): UniformLayout {
  if (!STRUCT_NAME.test(structName)) {
    throw new UniformBlockError(`"${structName}" is not a WGSL identifier`);
  }
  const sorted = [...new Set(keys)].sort(compareKeys);
  const fields: UniformField[] = [];
  const names = new Map<string, string>();
  for (const key of sorted) {
    const def = registry.find(key);
    if (!def) throw new UniformBlockError(`unknown parameter "${key}"`);
    for (const f of fieldsOf(def)) {
      const clash = names.get(f.name);
      if (clash !== undefined) {
        throw new UniformBlockError(`${key} and ${clash} both map to member ${f.name}`);
      }
      names.set(f.name, key);
      fields.push({ name: f.name, key, index: f.index, offset: 4 * fields.length });
    }
  }
  for (let pad = 0; fields.length % 4 !== 0 || fields.length === 0; pad++) {
    fields.push({ name: `pad_${pad}_`, key: null, index: null, offset: 4 * fields.length });
  }
  const wgsl = `struct ${structName} {\n${fields.map((f) => `  ${f.name}: f32,`).join('\n')}\n}\n`;

  const fieldName = (key: string, index: number | null = null): string => {
    const field = fields.find((f) => f.key === key && f.index === index);
    if (!field) {
      throw new UniformBlockError(
        `${structName} holds no member for ${key}${index === null ? '' : `[${index}]`}`,
      );
    }
    return field.name;
  };
  return {
    structName,
    keys: sorted,
    fields,
    byteLength: 4 * fields.length,
    wgsl,
    hash: canonicalHash({ wgsl, keys: sorted }),
    fieldName,
    target: (variable) => ({
      paramRef: (key, index) => `${variable}.${fieldName(key, index)}`,
      enumOptionIndex: (key, option) => {
        const def = registry.def(key);
        const i = def.kind === 'enum' ? def.options.indexOf(option) : -1;
        if (i < 0) throw new UniformBlockError(`"${option}" is not an option of ${key}`);
        return i;
      },
    }),
  };
}

/** A filled block. */
export interface PackedBlock {
  /** The values as f32, in the member order of the layout. */
  readonly data: Float32Array;
  /**
   * `sha256:` hash of the layout hash and the little-endian bytes of `data`: two kernels given
   * blocks of equal hash received the same parameters.
   */
  readonly hash: string;
}

function toF32(value: number, what: string): number {
  const f = Math.fround(value);
  if (!Number.isFinite(f)) throw new UniformBlockError(`${what} = ${value} does not fit an f32`);
  if (value !== 0 && f === 0) throw new UniformBlockError(`${what} = ${value} underflows an f32`);
  return f;
}

function hashBlock(layoutHash: string, data: Float32Array): string {
  const head = utf8Encode(layoutHash);
  const bytes = new Uint8Array(head.length + data.byteLength);
  bytes.set(head, 0);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < data.length; i++)
    view.setFloat32(head.length + 4 * i, data[i] as number, true);
  return `sha256:${bytesToHex(sha256(bytes))}`;
}

/**
 * Fills a uniform block from a parameter set (brief of M2, item 4). Values are rounded to f32;
 * a value that overflows or underflows an f32 throws `UniformBlockError`. Padding is zero.
 */
export function packUniformBlock(layout: UniformLayout, params: ParamSet): PackedBlock {
  const data = new Float32Array(layout.fields.length);
  layout.fields.forEach((field, i) => {
    if (field.key === null) return;
    const def = params.registry.def(field.key);
    const value =
      def.kind === 'enum'
        ? params.enumIndex(field.key)
        : def.kind === 'vector'
          ? (params.getVector(field.key)[field.index ?? 0] as number)
          : params.get(field.key);
    data[i] = toF32(value, field.key);
  });
  return { data, hash: hashBlock(layout.hash, data) };
}

/** Layout of a per-class soil table: one struct of f32 members per soil class. */
export interface SoilClassLayout {
  /** Name of the WGSL struct of one row. */
  readonly structName: string;
  /** Names of the soil parameters (the `<name>` of `soil.<name>`), sorted: the member order. */
  readonly names: readonly string[];
  /** WGSL declaration of the row struct; bind the table as `array<structName>`. */
  readonly wgsl: string;
  /** Size of one row, bytes: 4 per name. */
  readonly rowByteLength: number;
  /** `sha256:` hash of the struct text. */
  readonly hash: string;
}

/**
 * Builds the row layout of a per-class soil table from soil parameter names (`JOHref`, not
 * `soil.JOHref`). Each must be a scalar global `soil.<name>` of the registry.
 */
export function buildSoilClassLayout(
  registry: ParamRegistry,
  structName: string,
  names: readonly string[],
): SoilClassLayout {
  if (!STRUCT_NAME.test(structName)) {
    throw new UniformBlockError(`"${structName}" is not a WGSL identifier`);
  }
  const sorted = [...new Set(names)].sort(compareKeys);
  if (sorted.length === 0)
    throw new UniformBlockError('a soil class table needs at least one name');
  for (const name of sorted) {
    const def = registry.find(`${SOIL_KEY_PREFIX}.${name}`);
    if (!def) throw new UniformBlockError(`unknown parameter "${SOIL_KEY_PREFIX}.${name}"`);
    if (def.kind === 'vector' || def.kind === 'enum') {
      throw new UniformBlockError(`${def.key} is not a scalar`);
    }
  }
  const wgsl = `struct ${structName} {\n${sorted.map((n) => `  ${uniformFieldName(n)}: f32,`).join('\n')}\n}\n`;
  return {
    structName,
    names: sorted,
    wgsl,
    rowByteLength: 4 * sorted.length,
    hash: canonicalHash({ wgsl, names: sorted }),
  };
}

/**
 * Fills a per-class soil table: row c holds the parameters of `classes[c]`, each resolved with
 * the per-class override rule of section M2 (`soil.<class>.<name>` over `soil.<name>`). The
 * order of `classes` is the class code the kernel indexes by, so it is part of the hash.
 */
export function packSoilClassTable(
  layout: SoilClassLayout,
  params: ParamSet,
  classes: readonly string[],
): PackedBlock {
  const n = layout.names.length;
  const data = new Float32Array(n * classes.length);
  classes.forEach((cls, c) => {
    layout.names.forEach((name, j) => {
      data[c * n + j] = toF32(params.soilClass(cls, name), `soil.${cls}.${name}`);
    });
  });
  return {
    data,
    hash: hashBlock(canonicalHash({ layout: layout.hash, classes: [...classes] }), data),
  };
}
