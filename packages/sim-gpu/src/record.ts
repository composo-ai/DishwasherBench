/**
 * Record helpers: from one {@link RecordLayout} (layout.ts), the typed CPU view that reads and
 * writes records in an `ArrayBuffer` and the WGSL text that reads and writes the same bytes in a
 * kernel (docs/design/sim-core.md sections 3, 4 and 5 define the layouts; section M1 puts the
 * helpers here). The two sides are generated from the same description, and the round-trip test
 * (record.gpu.test.ts) runs both against every layout of the repository.
 *
 * All offsets and sizes are bytes; records are little-endian. Values pass through in two forms:
 * the *stored* number (`raw`: the integer, the float, the log code) and the *value* in the
 * field's SI `unit` (stored times `scale`, or the decoded log code).
 */

import { F16_MAX, f16BitsToNumber, numberToF16Bits } from './f16.ts';
import {
  FIELD_BYTES,
  type BitFieldDef,
  type LayoutField,
  type RecordLayout,
  type RecordOf,
} from './layout.ts';
import type { FieldType } from './types.ts';

// ---------------------------------------------------------------------------------------------
// CPU view
// ---------------------------------------------------------------------------------------------

/** The names of the fields of a layout that are not padding. */
export type FieldNameOf<L extends RecordLayout> = Exclude<
  L['fields'][number],
  { readonly pad: true }
>['name'];

/** Smallest and largest stored number of each integer storage type (`log8` holds a code). */
const INTEGER_RANGE: Readonly<Partial<Record<FieldType, readonly [number, number]>>> = {
  u32: [0, 2 ** 32 - 1],
  i32: [-(2 ** 31), 2 ** 31 - 1],
  u16: [0, 2 ** 16 - 1],
  i16: [-(2 ** 15), 2 ** 15 - 1],
  u8: [0, 255],
  log8: [0, 255],
};

/**
 * Smallest magnitude that rounds to infinity as an f32: half way between the largest f32
 * (2^128 - 2^104) and 2^128; the tie goes to the even significand, which overflows.
 */
const F32_OVERFLOW = 2 ** 128 - 2 ** 103;

/**
 * A typed view of `count` records laid out back to back in an `ArrayBuffer`. `i` is the record
 * index, `k` the element index of a field with `count` elements (default 0). Every accessor
 * throws a `RangeError` for an index outside the view or the field.
 */
export interface RecordView<L extends RecordLayout> {
  /** The layout the view was made from. */
  readonly layout: L;
  /** Number of records in the view. */
  readonly count: number;
  /**
   * The stored number of one element: the integer of an integer field, the float of an `f32` or
   * `f16` field, the code (0 to 255) of a `log8` field. This is the accessor for ledger
   * quantities, which are exact integers.
   */
  raw(i: number, field: FieldNameOf<L>, k?: number): number;
  /**
   * Stores a number as it is. Throws a `RangeError` if an integer field is given a value that
   * is not an integer of its type, or a float field a value that is not finite in its type
   * (NaN, an infinity, magnitude of 65,520 or more for `f16` or beyond the largest `f32`);
   * otherwise an `f16` or `f32` field takes the nearest value of its precision.
   */
  setRaw(i: number, field: FieldNameOf<L>, stored: number, k?: number): void;
  /** The value of one element in the field's `unit`: stored times `scale`, or the log decode. */
  value(i: number, field: FieldNameOf<L>, k?: number): number;
  /**
   * Stores a value given in the field's `unit`: divided by `scale` and, for an integer field,
   * rounded to the nearest integer; a `log8` field takes the nearest code (a positive value
   * never becomes code 0, which means zero; one below the range becomes code 1). A result
   * outside the type (an integer out of range, an `f16` of magnitude 65,520 or more, a `log8`
   * value that is negative or above `max`, an `f32` beyond 3.4e38) is clamped if the field is
   * `saturating` and throws a `RangeError` otherwise (determinism rule 12). NaN always throws.
   */
  setValue(i: number, field: FieldNameOf<L>, value: number, k?: number): void;
  /** One bit sub-field of a packed element, as an unsigned integer. */
  bits(i: number, field: FieldNameOf<L>, sub: string, k?: number): number;
  /** Sets one bit sub-field of a packed element, leaving the others. */
  setBits(i: number, field: FieldNameOf<L>, sub: string, value: number, k?: number): void;
  /** The whole record `i` in decoded form ({@link RecordOf}): values in `unit`. */
  decode(i: number): RecordOf<L>;
  /** Writes a whole record from decoded form with `setValue`; padding is written as zero. */
  encode(i: number, record: RecordOf<L>): void;
}

/**
 * The value a `log8` code denotes: `min * (max / min)^(code / 255)`, and zero for code 0
 * (section 5.1).
 */
export function log8Decode(code: number, min: number, max: number): number {
  return code === 0 ? 0 : min * (max / min) ** (code / 255);
}

/**
 * The `log8` code nearest (in the logarithm) to a value: 0 for zero, otherwise 1 to 255, so
 * that something present is never recorded as nothing (a positive value below the range is
 * code 1). A value above `max` is clamped to code 255 and a negative value to code 0: this is
 * the saturating encoder; {@link log8EncodeChecked} is the one that fails. Throws a
 * `RangeError` for NaN, which no code denotes.
 */
export function log8Encode(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) throw new RangeError('NaN has no log8 code');
  if (!(value > 0)) return 0;
  const code = Math.round((255 * Math.log(value / min)) / Math.log(max / min));
  return Math.min(255, Math.max(1, code));
}

/**
 * As {@link log8Encode}, but throws a `RangeError` for a value the range cannot hold
 * (determinism rule 12, failure not truncation): a negative value, or one whose nearest code
 * would be above 255 (more than half a code step above `max`). A positive value below the
 * range is still code 1.
 */
export function log8EncodeChecked(value: number, min: number, max: number): number {
  if (value < 0) throw new RangeError(`${value} is negative and has no log8 code`);
  if (value > max && Math.round((255 * Math.log(value / min)) / Math.log(max / min)) > 255) {
    throw new RangeError(`${value} is above the log8 range ${min} to ${max}`);
  }
  return log8Encode(value, min, max);
}

/**
 * Makes a {@link RecordView} over `data` (the bytes of a buffer read back from the GPU, or to
 * be uploaded). `count` defaults to the number of whole records that fit.
 */
export function recordView<const L extends RecordLayout>(
  layout: L,
  data: ArrayBuffer | ArrayBufferView,
  count?: number,
): RecordView<L> {
  const view = ArrayBuffer.isView(data)
    ? new DataView(data.buffer, data.byteOffset, data.byteLength)
    : new DataView(data);
  const size = layout.byteSize;
  const records = count ?? Math.floor(view.byteLength / size);
  if (!Number.isInteger(records) || records < 0 || records * size > view.byteLength) {
    throw new RangeError(
      `${layout.name}: ${records} records of ${size} bytes do not fit ${view.byteLength} bytes`,
    );
  }
  const byName = new Map<string, LayoutField>();
  for (const field of layout.fields) if (!field.pad) byName.set(field.name, field);

  const locate = (i: number, name: string, k: number): [LayoutField, number] => {
    const field = byName.get(name);
    if (field === undefined) throw new RangeError(`${layout.name} has no field ${name}`);
    if (!Number.isInteger(i) || i < 0 || i >= records) {
      throw new RangeError(`${layout.name}: record ${i} is outside 0 to ${records - 1}`);
    }
    const n = field.count ?? 1;
    if (!Number.isInteger(k) || k < 0 || k >= n) {
      throw new RangeError(`${layout.name}.${name}: element ${k} is outside 0 to ${n - 1}`);
    }
    return [field, i * size + field.offset + k * (field.stride ?? FIELD_BYTES[field.type])];
  };

  const load = (type: FieldType, at: number): number => {
    switch (type) {
      case 'f32':
        return view.getFloat32(at, true);
      case 'u32':
        return view.getUint32(at, true);
      case 'i32':
        return view.getInt32(at, true);
      case 'f16':
        return f16BitsToNumber(view.getUint16(at, true));
      case 'u16':
        return view.getUint16(at, true);
      case 'i16':
        return view.getInt16(at, true);
      case 'u8':
      case 'log8':
        return view.getUint8(at);
    }
  };

  const store = (field: LayoutField, at: number, stored: number): void => {
    const range = INTEGER_RANGE[field.type];
    if (range !== undefined) {
      if (!Number.isInteger(stored) || stored < range[0] || stored > range[1]) {
        throw new RangeError(
          `${layout.name}.${field.name}: ${stored} is not a stored ${field.type} ` +
            `(${range[0]} to ${range[1]})`,
        );
      }
    }
    if (field.type === 'f32' || field.type === 'f16') {
      // Rule 12: a float field never receives NaN or an infinity through the view, whether
      // given as such or produced by rounding a finite number beyond the type.
      const limit = field.type === 'f16' ? 65520 : F32_OVERFLOW;
      if (!(Math.abs(stored) < limit)) {
        throw new RangeError(
          `${layout.name}.${field.name}: ${stored} is not a finite ${field.type} ` +
            `(magnitude below ${field.type === 'f16' ? '65,520' : '3.4028235677973366e38'})`,
        );
      }
    }
    switch (field.type) {
      case 'f32':
        view.setFloat32(at, stored, true);
        return;
      case 'u32':
        view.setUint32(at, stored, true);
        return;
      case 'i32':
        view.setInt32(at, stored, true);
        return;
      case 'f16':
        view.setUint16(at, numberToF16Bits(stored), true);
        return;
      case 'u16':
        view.setUint16(at, stored, true);
        return;
      case 'i16':
        view.setInt16(at, stored, true);
        return;
      case 'u8':
      case 'log8':
        view.setUint8(at, stored);
        return;
    }
  };

  const toValue = (field: LayoutField, stored: number): number =>
    field.type === 'log8'
      ? log8Decode(stored, field.log?.min ?? 1, field.log?.max ?? 1)
      : stored * (field.scale ?? 1);

  const toStored = (field: LayoutField, value: number): number => {
    const fail = (error: unknown): never => {
      throw new RangeError(
        `${layout.name}.${field.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    };
    if (field.type === 'log8') {
      const min = field.log?.min ?? 1;
      const max = field.log?.max ?? 1;
      try {
        return field.saturating === true
          ? log8Encode(value, min, max)
          : log8EncodeChecked(value, min, max);
      } catch (error) {
        return fail(error);
      }
    }
    const scaled = value / (field.scale ?? 1);
    if (field.type === 'f16') {
      // Clamped to the largest finite half only if the field says so; NaN is refused by `store`.
      if (field.saturating === true) return Math.min(F16_MAX, Math.max(-F16_MAX, scaled));
      return scaled;
    }
    const range = INTEGER_RANGE[field.type];
    if (range === undefined) return scaled;
    const rounded = Math.round(scaled);
    if (field.saturating === true) return Math.min(range[1], Math.max(range[0], rounded));
    return rounded;
  };

  const subField = (field: LayoutField, sub: string): BitFieldDef => {
    const found = field.bits?.find((b) => b.name === sub);
    if (found === undefined) {
      throw new RangeError(`${layout.name}.${field.name} has no bits named ${sub}`);
    }
    return found;
  };

  const self: RecordView<L> = {
    layout,
    count: records,
    raw(i, name, k = 0) {
      const [field, at] = locate(i, name, k);
      return load(field.type, at);
    },
    setRaw(i, name, stored, k = 0) {
      const [field, at] = locate(i, name, k);
      store(field, at, stored);
    },
    value(i, name, k = 0) {
      const [field, at] = locate(i, name, k);
      return toValue(field, load(field.type, at));
    },
    setValue(i, name, value, k = 0) {
      const [field, at] = locate(i, name, k);
      store(field, at, toStored(field, value));
    },
    bits(i, name, sub, k = 0) {
      const [field, at] = locate(i, name, k);
      const part = subField(field, sub);
      return Math.floor(load(field.type, at) / 2 ** part.lsb) % 2 ** part.width;
    },
    setBits(i, name, sub, value, k = 0) {
      const [field, at] = locate(i, name, k);
      const part = subField(field, sub);
      if (!Number.isInteger(value) || value < 0 || value >= 2 ** part.width) {
        throw new RangeError(
          `${layout.name}.${field.name}.${sub} = ${value} does not fit ${part.width} bits`,
        );
      }
      const old = load(field.type, at);
      const oldPart = Math.floor(old / 2 ** part.lsb) % 2 ** part.width;
      store(field, at, old + (value - oldPart) * 2 ** part.lsb);
    },
    decode(i) {
      const record: Record<string, number | number[]> = {};
      for (const field of layout.fields) {
        if (field.pad) continue;
        if (field.count === undefined) {
          record[field.name] = self.value(i, field.name as FieldNameOf<L>);
        } else {
          const list: number[] = [];
          for (let k = 0; k < field.count; k++) {
            list.push(self.value(i, field.name as FieldNameOf<L>, k));
          }
          record[field.name] = list;
        }
      }
      return record as RecordOf<L>;
    },
    encode(i, record) {
      if (!Number.isInteger(i) || i < 0 || i >= records) {
        throw new RangeError(`${layout.name}: record ${i} is outside 0 to ${records - 1}`);
      }
      new Uint8Array(view.buffer, view.byteOffset + i * size, size).fill(0);
      const given = record as Readonly<Record<string, number | readonly number[]>>;
      for (const field of layout.fields) {
        if (field.pad) continue;
        const entry = given[field.name];
        const n = field.count ?? 1;
        const list = typeof entry === 'number' ? [entry] : entry;
        if (list === undefined || list.length !== n) {
          throw new RangeError(`${layout.name}.${field.name}: expected ${n} value(s)`);
        }
        list.forEach((v, k) => self.setValue(i, field.name as FieldNameOf<L>, v, k));
      }
    },
  };
  return self;
}

/**
 * Bytes of a buffer that holds `count` records of a layout: a whole number of 32-bit words
 * (records of 1 or 2 bytes are packed 4 or 2 to a word and the last word is padded).
 */
export function recordBufferBytes(layout: RecordLayout, count: number): number {
  return Math.max(4, 4 * Math.ceil((layout.byteSize * count) / 4));
}

// ---------------------------------------------------------------------------------------------
// WGSL
// ---------------------------------------------------------------------------------------------

/**
 * WGSL keywords and reserved words (WGSL specification, "Keywords" and "Reserved words"): a
 * field with one of these names gets a trailing underscore in the generated source.
 */
const WGSL_RESERVED = new Set(
  (
    'alias break case const const_assert continue continuing default diagnostic discard else ' +
    'enable false fn for if let loop override requires return struct switch true var while ' +
    'NULL Self abstract active alignas alignof as asm asm_fragment async attribute auto await ' +
    'become cast catch class co_await co_return co_yield coherent column_major common compile ' +
    'compile_fragment concept const_cast consteval constexpr constinit crate debugger decltype ' +
    'delete demote demote_to_helper do dynamic_cast enum explicit export extends extern ' +
    'external fallthrough filter final finally friend from fxgroup get goto groupshared highp ' +
    'impl implements import inline instanceof interface layout lowp macro macro_rules match ' +
    'mediump meta mod module move mut mutable namespace new nil noexcept noinline ' +
    'nointerpolation non_coherent noncopyable noperspective null nullptr of operator package ' +
    'packoffset partition pass patch pixelfragment precise precision premerge priv protected ' +
    'pub public readonly ref regardless register reinterpret_cast require resource restrict ' +
    'self set shared sizeof smooth snorm static static_assert static_cast std subroutine super ' +
    'target template this thread_local throw trait try type typedef typeid typename typeof ' +
    'union unless unorm unsafe unsized use using varying virtual volatile wgsl where with ' +
    'writeonly yield'
  ).split(' '),
);

/** The WGSL identifier used for a field name: the name, or the name with `_` if it is reserved. */
export function wgslIdentifier(name: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`"${name}" cannot be used as a WGSL identifier`);
  }
  return WGSL_RESERVED.has(name) ? `${name}_` : name;
}

/** A float as a WGSL literal that denotes the same double (the compiler rounds it to f32). */
export function wgslFloat(x: number): string {
  if (!Number.isFinite(x)) throw new RangeError(`${x} has no WGSL literal`);
  const text = String(x);
  return /^-?\d+$/.test(text) ? `${text}.0` : text;
}

/** Options of {@link recordWgsl}. */
export interface RecordWgslOptions {
  /**
   * Names of 32-bit integer fields to declare `atomic<u32>` / `atomic<i32>` (deposit
   * accumulators, determinism rule 3). A struct with an atomic member cannot be copied, so no
   * narrow-field accessors are generated for it.
   */
  readonly atomic?: readonly string[];
}

/** WGSL scalar type of a 32-bit storage type. */
function wordType(type: FieldType): 'f32' | 'u32' | 'i32' {
  if (type === 'f32' || type === 'u32' || type === 'i32') return type;
  throw new Error(`${type} is not a 32-bit storage type`);
}

/** The type a narrow field is read as in WGSL, and the expressions that convert it. */
function narrowCodec(type: FieldType): {
  readonly wgsl: 'f32' | 'u32' | 'i32';
  readonly bitWidth: 8 | 16;
  /** From `x`, the field's bits in the low end of a u32, to the WGSL value. */
  readonly decode: string;
  /** From the WGSL value `v` to the field's bits in the low end of a u32. */
  readonly encode: string;
} {
  switch (type) {
    case 'u8':
    case 'log8':
      return { wgsl: 'u32', bitWidth: 8, decode: 'x', encode: 'v & 0xffu' };
    case 'u16':
      return { wgsl: 'u32', bitWidth: 16, decode: 'x', encode: 'v & 0xffffu' };
    case 'i16':
      return {
        wgsl: 'i32',
        bitWidth: 16,
        decode: 'bitcast<i32>(x << 16u) >> 16u',
        encode: 'bitcast<u32>(v) & 0xffffu',
      };
    case 'f16':
      return {
        wgsl: 'f32',
        bitWidth: 16,
        decode: 'unpack2x16float(x).x',
        encode: 'pack2x16float(vec2<f32>(v, 0.0)) & 0xffffu',
      };
    default:
      throw new Error(`${type} is not a narrow storage type`);
  }
}

function hexMask(width: number): string {
  return `0x${(2 ** width - 1).toString(16)}u`;
}

/** The bit accessors of one packed field: `Name_field_sub(x)` and `Name_field_with_sub(x, v)`. */
function bitFunctions(prefix: string, field: LayoutField): string[] {
  const lines: string[] = [];
  for (const sub of field.bits ?? []) {
    const id = `${prefix}_${field.name}`;
    const mask = hexMask(sub.width);
    lines.push(
      `fn ${id}_${sub.name}(x: u32) -> u32 { return (x >> ${sub.lsb}u) & ${mask}; }`,
      `fn ${id}_with_${sub.name}(x: u32, v: u32) -> u32 { ` +
        `return (x & ~(${mask} << ${sub.lsb}u)) | ((v & ${mask}) << ${sub.lsb}u); }`,
    );
  }
  return lines;
}

/** Constants that carry the scale and the log range of a field into the kernel. */
function fieldConstants(prefix: string, field: LayoutField): string[] {
  const id = `${prefix}_${field.name}`;
  const lines: string[] = [];
  if (field.scale !== undefined) {
    lines.push(`const ${id}_SCALE: f32 = ${wgslFloat(field.scale)};`);
  }
  if (field.log !== undefined) {
    lines.push(
      `const ${id}_LOG_MIN: f32 = ${wgslFloat(field.log.min)};`,
      `const ${id}_LOG_MAX: f32 = ${wgslFloat(field.log.max)};`,
    );
  }
  return lines;
}

/**
 * The WGSL of a record of 1 or 2 bytes: no struct, because such records are packed 4 or 2 to a
 * `u32` word of an `array<u32>`. Record `i` lives in word `i / Name_PER_WORD`; the accessors
 * take that word and `i`.
 */
function subWordRecordWgsl(layout: RecordLayout): string {
  const name = layout.name;
  const perWord = 4 / layout.byteSize;
  const lines: string[] = [
    `// ${name}: ${layout.byteSize} byte(s) per ${layout.per}, ${perWord} to a u32 word ` +
      `(section ${layout.section}).`,
    `const ${name}_BYTES: u32 = ${layout.byteSize}u;`,
    `const ${name}_PER_WORD: u32 = ${perWord}u;`,
  ];
  for (const field of layout.fields) {
    if (field.pad) continue;
    const codec = narrowCodec(field.type);
    const many = (field.count ?? 1) > 1;
    const stride = field.stride ?? FIELD_BYTES[field.type];
    const mask = hexMask(codec.bitWidth);
    const kParam = many ? ', k: u32' : '';
    const shift =
      `((i % ${perWord}u) * ${layout.byteSize}u + ${field.offset}u` +
      `${many ? ` + k * ${stride}u` : ''}) * 8u`;
    const id = `${name}_${field.name}`;
    lines.push(
      ...fieldConstants(name, field),
      `fn ${id}(word: u32, i: u32${kParam}) -> ${codec.wgsl} {`,
      `  let x = (word >> (${shift})) & ${mask};`,
      `  return ${codec.decode};`,
      `}`,
      `fn ${name}_with_${field.name}(word: u32, i: u32${kParam}, v: ${codec.wgsl}) -> u32 {`,
      `  let shift = ${shift};`,
      `  return (word & ~(${mask} << shift)) | ((${codec.encode}) << shift);`,
      `}`,
      ...bitFunctions(name, field),
    );
  }
  return `${lines.join('\n')}\n`;
}

/**
 * The WGSL text for one record layout.
 *
 * For a record of a whole number of words it declares `struct Name` with the same size and
 * byte layout as the record, made only of `u32`, `i32` and `f32` members and arrays of them
 * (never vectors, whose alignment the layouts do not respect):
 *
 * - a 32-bit field is a member of its own name and type; with `count` elements it is an
 *   `array` if they are consecutive, else members `name_0`, `name_1`, ...;
 * - each run of consecutive words that hold narrower fields is a member
 *   `packed_w<first word>: array<u32, n>`, and every narrow field gets a getter
 *   `Name_field(r: Name[, k: u32])` and a setter `Name_set_field(r: ptr<function, Name>[, k], v)`.
 *   `u8`, `u16` and `log8` are read as `u32` (the stored integer or code), `i16` as
 *   sign-extended `i32`, `f16` as `f32` (`unpack2x16float` / `pack2x16float`);
 * - padding is a member `pad_w<word>` or part of a packed run; setters leave it alone;
 * - each bit sub-field of a packed field gets `Name_field_sub(x: u32) -> u32` and
 *   `Name_field_with_sub(x: u32, v: u32) -> u32`, which act on one stored element;
 * - constants `Name_BYTES`, `Name_WORDS`, `Name_field_WORD` (word index of a 32-bit field, for
 *   kernels that bind the buffer as `array<u32>` or `array<atomic<u32>>`), `Name_field_SCALE`
 *   (stored unit in SI, when the layout gives a `scale`) and `Name_field_LOG_MIN` / `_LOG_MAX`.
 *
 * For a record of 1 or 2 bytes it declares no struct: accessors take the `u32` word and the
 * record index (see `Name_PER_WORD`).
 *
 * Getters return stored numbers; the kernel applies `Name_field_SCALE` where it wants SI.
 * Register the result with `WgslLibrary.define(recordInclude(layout), recordWgsl(layout))`.
 */
export function recordWgsl(layout: RecordLayout, options: RecordWgslOptions = {}): string {
  const name = layout.name;
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`record name "${name}" cannot be used as a WGSL identifier`);
  }
  for (const field of layout.fields) if (!field.pad) wgslIdentifier(field.name);
  if (layout.byteSize === 1 || layout.byteSize === 2) return subWordRecordWgsl(layout);
  if (layout.byteSize % 4 !== 0) {
    throw new Error(`${name}: ${layout.byteSize} bytes is not a whole number of words`);
  }
  const atomic = new Set(options.atomic ?? []);
  for (const fieldName of atomic) {
    const field = layout.fields.find((f) => f.name === fieldName && !f.pad);
    if (field === undefined || (field.type !== 'u32' && field.type !== 'i32')) {
      throw new Error(`${name}.${fieldName} cannot be atomic: not a u32 or i32 field`);
    }
  }

  // Which field element owns each word, or null for a word shared by narrow fields.
  const words = layout.byteSize / 4;
  const owner: ({ field: LayoutField; k: number } | null | undefined)[] = new Array(words);
  for (const field of layout.fields) {
    const bytes = FIELD_BYTES[field.type];
    const stride = field.stride ?? bytes;
    for (let k = 0; k < (field.count ?? 1); k++) {
      const word = (field.offset + k * stride) >> 2;
      owner[word] = bytes === 4 ? { field, k } : null;
    }
  }

  const members: string[] = [];
  const runs: { start: number; length: number }[] = [];
  const wordConstants: string[] = [];
  for (let w = 0; w < words;) {
    const o = owner[w];
    if (o === undefined) throw new Error(`${name}: word ${w} belongs to no field`);
    if (o === null) {
      let length = 1;
      while (w + length < words && owner[w + length] === null) length++;
      members.push(`  packed_w${w}: array<u32, ${length}>,`);
      runs.push({ start: w, length });
      w += length;
      continue;
    }
    const { field, k } = o;
    if (field.pad) {
      members.push(`  pad_w${w}: u32,`);
      w++;
      continue;
    }
    const id = wgslIdentifier(field.name);
    const scalar = wordType(field.type);
    const type = atomic.has(field.name) ? `atomic<${scalar}>` : scalar;
    const count = field.count ?? 1;
    if (k === 0) wordConstants.push(`const ${name}_${field.name}_WORD: u32 = ${w}u;`);
    if (count === 1) {
      members.push(`  ${id}: ${type},`);
      w++;
    } else if ((field.stride ?? 4) === 4) {
      members.push(`  ${id}: array<${type}, ${count}>,`);
      w += count;
    } else {
      members.push(`  ${id}_${k}: ${type},`);
      w++;
    }
  }

  const lines: string[] = [
    `// ${name}: ${layout.byteSize} bytes per ${layout.per} (section ${layout.section}).`,
    `const ${name}_BYTES: u32 = ${layout.byteSize}u;`,
    `const ${name}_WORDS: u32 = ${words}u;`,
    ...wordConstants,
    `struct ${name} {`,
    ...members,
    `}`,
  ];

  const runOf = (word: number): { start: number; length: number } => {
    const run = runs.find((r) => word >= r.start && word < r.start + r.length);
    if (run === undefined) throw new Error(`${name}: word ${word} is not in a packed run`);
    return run;
  };

  for (const field of layout.fields) {
    if (field.pad) continue;
    lines.push(...fieldConstants(name, field), ...bitFunctions(name, field));
    if (FIELD_BYTES[field.type] === 4) continue;
    if (atomic.size > 0) continue;
    const codec = narrowCodec(field.type);
    const mask = hexMask(codec.bitWidth);
    const count = field.count ?? 1;
    const stride = field.stride ?? FIELD_BYTES[field.type];
    const id = wgslIdentifier(field.name);
    const kParam = count > 1 ? ', k: u32' : '';
    // Where element k lives: the packed member, the index in it and the bit shift.
    const place = (k: number): { member: string; index: number; shift: number } => {
      const byte = field.offset + k * stride;
      const run = runOf(byte >> 2);
      return {
        member: `packed_w${run.start}`,
        index: (byte >> 2) - run.start,
        shift: 8 * (byte & 3),
      };
    };
    const first = place(0);
    const oneRun = Array.from({ length: count }, (_, k) => place(k).member).every(
      (m) => m === first.member,
    );
    const getter: string[] = [`fn ${name}_${id}(r: ${name}${kParam}) -> ${codec.wgsl} {`];
    const setter: string[] = [
      `fn ${name}_set_${id}(r: ptr<function, ${name}>${kParam}, v: ${codec.wgsl}) {`,
      `  let bits = ${codec.encode};`,
    ];
    if (count === 1) {
      getter.push(`  let x = (r.${first.member}[${first.index}] >> ${first.shift}u) & ${mask};`);
      setter.push(
        `  (*r).${first.member}[${first.index}] = ((*r).${first.member}[${first.index}] & ` +
          `~(${mask} << ${first.shift}u)) | (bits << ${first.shift}u);`,
      );
    } else if (oneRun) {
      const run = runOf(field.offset >> 2);
      getter.push(
        `  let byte = ${field.offset}u + k * ${stride}u;`,
        `  let x = (r.${first.member}[(byte >> 2u) - ${run.start}u] >> ((byte & 3u) * 8u)) & ${mask};`,
      );
      setter.push(
        `  let byte = ${field.offset}u + k * ${stride}u;`,
        `  let index = (byte >> 2u) - ${run.start}u;`,
        `  let shift = (byte & 3u) * 8u;`,
        `  (*r).${first.member}[index] = ((*r).${first.member}[index] & ~(${mask} << shift)) | ` +
          `(bits << shift);`,
      );
    } else {
      // The elements lie in different packed runs (a field of a repeated group that also holds
      // 32-bit members): one case per element.
      getter.push(`  var x = 0u;`, `  switch k {`);
      setter.push(`  switch k {`);
      for (let k = 0; k < count; k++) {
        const p = place(k);
        getter.push(
          `    case ${k}u: { x = (r.${p.member}[${p.index}] >> ${p.shift}u) & ${mask}; }`,
        );
        setter.push(
          `    case ${k}u: { (*r).${p.member}[${p.index}] = ((*r).${p.member}[${p.index}] & ` +
            `~(${mask} << ${p.shift}u)) | (bits << ${p.shift}u); }`,
        );
      }
      getter.push(`    default: {}`, `  }`);
      setter.push(`    default: {}`, `  }`);
    }
    getter.push(`  return ${codec.decode};`, `}`);
    setter.push(`}`);
    lines.push(...getter, ...setter);
  }
  return `${lines.join('\n')}\n`;
}

/** The include name a record's WGSL is registered under: `record/<Name>`. */
export function recordInclude(layout: RecordLayout): string {
  return `record/${layout.name}`;
}
