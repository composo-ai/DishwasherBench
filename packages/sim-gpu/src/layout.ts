/**
 * Binary record layouts as data (docs/design/sim-core.md sections 3, 4 and 5; determinism
 * rule 7 of section 6).
 *
 * Every record whose byte layout the contract fixes (`FilmExposure`, `KHot`, `SoilCell`, ...) is
 * described by a {@link RecordLayout}: an ordered list of fields with storage type, byte offset,
 * unit, role and bound, in the `FieldDef` vocabulary of module M1. The layout is the single
 * source of truth for the record: the WGSL struct, the packing and unpacking functions and the
 * typed CPU view are derived from it, and {@link RecordOf} derives the TypeScript type of a
 * decoded record.
 *
 * Conventions shared by every layout:
 * - Little-endian. Offsets and sizes are bytes from the start of one record.
 * - A record whose size is a multiple of 4 is a sequence of 32-bit words; fields narrower than a
 *   word are packed into words at their byte offset (a 16-bit field at offset 6 is bits 16 to 31
 *   of word 1). A record of 1 or 2 bytes is packed 4 or 2 to a word in the same way, and the
 *   buffer is rounded up to a whole word.
 * - A field stores `count` elements (default 1), element `k` at `offset + k * stride`.
 * - The value of a field is its stored number times `scale` (default 1), in `unit`; `unit` is SI
 *   (or `1` for a pure number, `-` for a code, an index or flags), so `scale` carries every
 *   scaled storage unit of the contract (`f16` in micrometres is `scale: 1e-6, unit: 'm'`;
 *   `u8 / 255` is `scale: 1 / 255, unit: '1'`; water mass in 1e-12 kg is `scale: 1e-12`).
 * - A `log8` field stores `v = min * (max / min)^(code / 255)` with code 0 meaning zero
 *   (section 5.1); `log` gives `min` and `max` in `unit`. Code 255 is `max`; the smallest
 *   non-zero value a field can hold is that of code 1, `min * (max / min)^(1 / 255)`, a little
 *   above `min`.
 * - A record is a sequence of scalar words, never of WGSL vectors: `layoutProblems` checks that
 *   each element is aligned to its own size and nothing more, so three consecutive f32 (a
 *   velocity at byte 12, an origin at byte 4) are legal here although a `vec3<f32>` member,
 *   which WGSL aligns to 16 bytes, could not sit there. The struct that `recordWgsl`
 *   (record.ts) generates therefore has only `u32`, `i32` and `f32` members and arrays of them.
 * - A field with `bits` is a packed word. Its name names the whole word, whatever it is called:
 *   the parts are reached through `unpackBits` / `packBits` here and through the bit accessors
 *   of `recordView` and of the generated WGSL, never by comparing the word with a code.
 * - An integer field whose role is `state`, `accumulator` or `counter` is an exact ledger
 *   quantity ({@link isExactIntegerField}): arithmetic on it is done on the stored integer
 *   (`RecordView.raw`), and its scaled value in `unit` is for reports and tolerances only.
 * - Spare and reserved bytes are listed as fields with `pad: true`, so that the fields of every
 *   layout tile its record exactly.
 */

import type { FieldDef, FieldRole, FieldType } from './types.ts';

/** Size in bytes of one element of each {@link FieldType}. */
export const FIELD_BYTES: Readonly<Record<FieldType, number>> = {
  f32: 4,
  u32: 4,
  i32: 4,
  f16: 2,
  u16: 2,
  i16: 2,
  u8: 1,
  log8: 1,
};

/**
 * The storage types narrower than a 32-bit word. Determinism rule 7: no such field may
 * accumulate state across ticks or steps. (`i16` is not named by the rule, which predates its
 * use; it is narrow and is held to the same rule.)
 */
export const NARROW_FIELD_TYPES: readonly FieldType[] = ['f16', 'u16', 'i16', 'u8', 'log8'];

/**
 * The roles a narrow field may have (determinism rule 7 and the "Narrow fields" rule of M1):
 * static geometry and parameters; statistics that are written whole (maxima, snapshots, copies,
 * packed outputs); or a counter with a registered bound. Never `state` or `accumulator`.
 */
export const NARROW_FIELD_ROLES: readonly FieldRole[] = ['static', 'statistic', 'counter'];

/**
 * Largest value each integer {@link FieldType} can hold, in stored units; a registered `bound`
 * may not exceed it.
 */
export const INTEGER_FIELD_MAX: Readonly<Partial<Record<FieldType, number>>> = {
  u32: 2 ** 32 - 1,
  i32: 2 ** 31 - 1,
  u16: 2 ** 16 - 1,
  i16: 2 ** 15 - 1,
  u8: 2 ** 8 - 1,
};

/** A run of bits inside one element of an integer field. */
export interface BitFieldDef {
  /** Name of the sub-field, unique within its field. */
  readonly name: string;
  /** Index of its least significant bit within the element (0 is the lowest bit). */
  readonly lsb: number;
  /** Number of bits. */
  readonly width: number;
  /** Meaning, with the values of an enumeration or the unit of a number. */
  readonly doc: string;
}

/** One field of a {@link RecordLayout}: a registered field with its place in the record. */
export interface LayoutField extends FieldDef {
  /** Byte offset of the first element from the start of the record. */
  readonly offset: number;
  /** Number of elements; default 1. */
  readonly count?: number;
  /**
   * Bytes from one element to the next; default the size of the type. Larger for a field that
   * is one member of a repeated group (the four events of `JetExposure`).
   */
  readonly stride?: number;
  /**
   * Factor from the stored number to the value in `unit`; default 1. Not used by `log8` fields,
   * whose value comes from `log`.
   */
  readonly scale?: number;
  /**
   * For a `log8` field: `min` and `max` of `v = min * (max / min)^(code / 255)`, in `unit`.
   * `max` is the value of code 255; `min` is the value code 0 would have if it did not mean
   * zero.
   */
  readonly log?: { readonly min: number; readonly max: number };
  /**
   * True when the writer clamps at the largest value of the type instead of failing (for an
   * `f16` field at +/-65,504 stored units, for a `log8` field at code 255, its `max`). A field
   * that is not saturating and is given a value beyond its type fails (section 8.2; rule 12).
   * Not allowed on `f32` fields.
   */
  readonly saturating?: boolean;
  /** Sub-fields packed into each element of an unsigned integer field. */
  readonly bits?: readonly BitFieldDef[];
  /** True for spare, reserved and padding bytes: no meaning, written as zero. */
  readonly pad?: true;
  /** Meaning of the field and the contract section it comes from. */
  readonly doc: string;
}

/** The byte layout of one record type. */
export interface RecordLayout {
  /** The contract's name of the record, for example `FilmExposure`. */
  readonly name: string;
  /** Where the contract defines it, for example `5.2`. */
  readonly section: string;
  /** The module whose section of the contract defines the record, for example `M7`. */
  readonly owner: string;
  /** What one record is stored per, for example `film cell` or `soil cell`. */
  readonly per: string;
  /** Size of one record in bytes: a multiple of 4, or 1 or 2 for a record packed into words. */
  readonly byteSize: number;
  /** The fields, in order of increasing offset. */
  readonly fields: readonly LayoutField[];
}

/**
 * The decoded form of a record: one property per field that is not padding, a number for a
 * single element and an array for `count` elements. Values are in the field's `unit` (stored
 * number times `scale`, or the decoded value of a `log8` field). Declare a layout
 * `as const satisfies RecordLayout` so that the field names are known to the type checker.
 *
 * Two cautions. A field with `bits` decodes to its whole packed word, not to the sub-field it
 * may be named after: split it with {@link unpackBits}. And the decoded value of an exact
 * integer field ({@link isExactIntegerField}: water mass in 1e-12 kg, removed soil in
 * 1e-15 kg) is a rounded float; ledgers use the stored integers (`RecordView.raw` in
 * record.ts), never this form.
 */
export type RecordOf<L extends RecordLayout> = {
  readonly [
    F in L['fields'][number] as F extends { readonly pad: true } ? never : F['name']
  ]: F extends { readonly count: number } ? readonly number[] : number;
};

/** Size in bytes of one element of a field. */
export function fieldElementBytes(field: LayoutField): number {
  return FIELD_BYTES[field.type];
}

/**
 * Number of bytes a field covers in total: the sum over its elements, not counting any gaps
 * between them that a `stride` leaves for other fields.
 */
export function fieldBytes(field: LayoutField): number {
  return (field.count ?? 1) * FIELD_BYTES[field.type];
}

/**
 * True for a field that holds an exact integer quantity: an integer storage type whose role is
 * `state`, `accumulator` or `counter` (section 4, "Ledger boundaries"). Such a field is read
 * and written as its stored integer; its `scale` only says what one unit is worth.
 */
export function isExactIntegerField(field: FieldDef): boolean {
  return (
    INTEGER_FIELD_MAX[field.type] !== undefined &&
    (field.role === 'state' || field.role === 'accumulator' || field.role === 'counter')
  );
}

/**
 * Splits one stored element of a packed field into its bit sub-fields, by name. Throws if the
 * field has no `bits`.
 */
export function unpackBits(field: LayoutField, stored: number): Record<string, number> {
  if (field.bits === undefined) throw new Error(`field ${field.name} has no bit sub-fields`);
  const parts: Record<string, number> = {};
  for (const sub of field.bits) {
    // Division, not shifts: JavaScript shifts are 32-bit signed and a sub-field may be 32 wide.
    parts[sub.name] = Math.floor(stored / 2 ** sub.lsb) % 2 ** sub.width;
  }
  return parts;
}

/**
 * Builds one stored element of a packed field from its bit sub-fields; sub-fields not given are
 * zero. Throws if a name is not a sub-field or a value does not fit its width.
 */
export function packBits(field: LayoutField, parts: Readonly<Record<string, number>>): number {
  if (field.bits === undefined) throw new Error(`field ${field.name} has no bit sub-fields`);
  let stored = 0;
  for (const [name, value] of Object.entries(parts)) {
    const sub = field.bits.find((b) => b.name === name);
    if (sub === undefined) throw new Error(`field ${field.name} has no bits named ${name}`);
    if (!Number.isInteger(value) || value < 0 || value >= 2 ** sub.width) {
      throw new RangeError(
        `${field.name}.${name} = ${value} does not fit ${sub.width} bit${sub.width === 1 ? '' : 's'}`,
      );
    }
    stored += value * 2 ** sub.lsb;
  }
  return stored;
}

/**
 * The problems of one registered field under the rules that do not depend on its place in a
 * record, one sentence each (determinism rule 7; section M1, "Narrow fields"; section 4,
 * "Shared fixed-point units"):
 *
 * - a narrow field (`f16`, `u16`, `i16`, `u8`, `log8`) has a role of {@link NARROW_FIELD_ROLES};
 * - an integer accumulator or counter has a registered `bound`;
 * - a counter is stored as an integer, never as `f16`, `log8` or `f32`;
 * - a `bound` is on an integer field, positive, and no larger than the type can hold.
 *
 * Both registration paths use it: `layoutProblems` for a record layout and
 * `GpuContext.buffer` for a buffer registered with `fields` only.
 */
export function fieldRuleProblems(field: FieldDef): string[] {
  const problems: string[] = [];
  const label = `field ${field.name}`;
  const narrow = NARROW_FIELD_TYPES.includes(field.type);
  if (narrow && !NARROW_FIELD_ROLES.includes(field.role)) {
    problems.push(
      `${label} is a narrow ${field.type} with role ${field.role} (determinism rule 7)`,
    );
  }
  const integerMax = INTEGER_FIELD_MAX[field.type];
  if (field.role === 'accumulator' || field.role === 'counter') {
    if (integerMax !== undefined) {
      if (field.bound === undefined) {
        problems.push(`${label} is an integer ${field.role} without a registered bound`);
      }
    } else if (field.role === 'counter') {
      problems.push(`${label} is a counter stored as ${field.type}, not as an integer`);
    }
  }
  if (field.bound !== undefined) {
    if (integerMax === undefined) {
      problems.push(`${label} has a bound but is stored as ${field.type}`);
    } else if (!(field.bound > 0) || field.bound > integerMax) {
      problems.push(`${label} has bound ${field.bound}, outside 1 to ${integerMax}`);
    }
  }
  return problems;
}

function isWholeNumber(x: number): boolean {
  return Number.isInteger(x) && x >= 0;
}

/**
 * Checks a layout against the rules every record must obey and returns the problems found, one
 * sentence each; an empty list means the layout is sound.
 *
 * - Size: a positive multiple of 4 bytes, or 1 or 2 bytes (a sub-word record).
 * - Every element lies inside the record at an offset that is a multiple of its own size, so
 *   that 32-bit fields are whole WGSL words and no narrower field straddles two words.
 * - No two elements overlap, and the fields cover every byte of the record (padding is listed).
 * - Narrow fields (`f16`, `u16`, `i16`, `u8`, `log8`) have a role of
 *   {@link NARROW_FIELD_ROLES} only (determinism rule 7; section M1, "Narrow fields").
 * - An integer accumulator or counter has a positive `bound` no larger than its type can hold,
 *   and a counter is an integer ({@link fieldRuleProblems}, shared with `GpuContext.buffer`).
 * - `saturating` is not set on an `f32` field.
 * - A `log8` field has a `log` range with 0 < min < max and no `scale`; no other field has
 *   `log`.
 * - Bit sub-fields sit on unsigned integer fields, fit the element and do not overlap.
 * - Field names are unique apart from padding.
 */
export function layoutProblems(layout: RecordLayout): string[] {
  const problems: string[] = [];
  const say = (text: string): void => {
    problems.push(`${layout.name}: ${text}`);
  };

  const size = layout.byteSize;
  if (!Number.isInteger(size) || size <= 0) {
    say(`byteSize ${size} is not a positive whole number of bytes`);
    return problems;
  }
  if (size % 4 !== 0 && size !== 1 && size !== 2) {
    say(`byteSize ${size} is neither a multiple of 4 nor a sub-word record of 1 or 2 bytes`);
  }

  // Which field owns each byte of the record; -1 while unclaimed.
  const owner = new Int32Array(size).fill(-1);
  const names = new Set<string>();

  layout.fields.forEach((field, index) => {
    const bytes = FIELD_BYTES[field.type];
    const count = field.count ?? 1;
    const stride = field.stride ?? bytes;
    const label = `field ${field.name}`;

    if (!field.pad) {
      if (names.has(field.name)) say(`${label} is declared twice`);
      names.add(field.name);
    }
    if (!Number.isInteger(count) || count < 1) say(`${label} has count ${count}`);
    if (!isWholeNumber(field.offset)) say(`${label} has offset ${field.offset}`);
    if (!Number.isInteger(stride) || stride < bytes) {
      say(`${label} has stride ${stride}, smaller than its ${bytes}-byte elements`);
    }
    if (field.offset % bytes !== 0 || stride % bytes !== 0) {
      say(
        `${label} (${field.type}) at offset ${field.offset}, stride ${stride} is not aligned to ` +
          `${bytes} bytes`,
      );
    }

    if (isWholeNumber(field.offset) && Number.isInteger(count) && Number.isInteger(stride)) {
      for (let k = 0; k < count; k++) {
        const start = field.offset + k * stride;
        if (start + bytes > size) {
          say(`${label} element ${k} ends at byte ${start + bytes}, beyond the record`);
          break;
        }
        for (let b = start; b < start + bytes; b++) {
          const other = owner[b] as number;
          if (other !== -1 && other !== index) {
            say(
              `${label} overlaps field ${(layout.fields[other] as LayoutField).name} at byte ${b}`,
            );
            break;
          }
          if (other === index) {
            say(`${label} overlaps itself at byte ${b}`);
            break;
          }
          owner[b] = index;
        }
      }
    }

    for (const problem of fieldRuleProblems(field)) say(problem);
    if (field.saturating === true && field.type === 'f32') {
      say(`${label} is marked saturating but is stored as f32`);
    }

    if (field.type === 'log8') {
      if (field.log === undefined) {
        say(`${label} is log8 without a log range`);
      } else if (!(field.log.min > 0 && field.log.max > field.log.min)) {
        say(`${label} has log range ${field.log.min} to ${field.log.max}`);
      }
      if (field.scale !== undefined) say(`${label} is log8 and must not have a scale`);
    } else {
      if (field.log !== undefined) say(`${label} has a log range but is stored as ${field.type}`);
      if (field.scale !== undefined && !(Number.isFinite(field.scale) && field.scale > 0)) {
        say(`${label} has scale ${field.scale}`);
      }
    }

    if (field.bits !== undefined) {
      if (field.type !== 'u8' && field.type !== 'u16' && field.type !== 'u32') {
        say(`${label} has bit sub-fields but is stored as ${field.type}`);
      }
      const width = 8 * bytes;
      const taken = new Set<number>();
      const bitNames = new Set<string>();
      for (const sub of field.bits) {
        if (bitNames.has(sub.name)) say(`${label} declares bits ${sub.name} twice`);
        bitNames.add(sub.name);
        if (!isWholeNumber(sub.lsb) || !Number.isInteger(sub.width) || sub.width < 1) {
          say(`${label} bits ${sub.name} have lsb ${sub.lsb}, width ${sub.width}`);
          continue;
        }
        if (sub.lsb + sub.width > width) {
          say(
            `${label} bits ${sub.name} end at bit ${sub.lsb + sub.width} of a ${width}-bit element`,
          );
          continue;
        }
        for (let bit = sub.lsb; bit < sub.lsb + sub.width; bit++) {
          if (taken.has(bit)) {
            say(`${label} bits ${sub.name} overlap another sub-field at bit ${bit}`);
            break;
          }
          taken.add(bit);
        }
      }
    }
  });

  for (let b = 0; b < size; b++) {
    if (owner[b] === -1) {
      let end = b;
      while (end + 1 < size && owner[end + 1] === -1) end++;
      say(
        b === end
          ? `byte ${b} belongs to no field`
          : `bytes ${b} to ${end} belong to no field (list padding as a field)`,
      );
      b = end;
    }
  }

  for (let i = 1; i < layout.fields.length; i++) {
    const previous = layout.fields[i - 1] as LayoutField;
    const current = layout.fields[i] as LayoutField;
    if (current.offset < previous.offset) {
      say(`field ${current.name} is listed after ${previous.name} but starts before it`);
    }
  }

  return problems;
}
