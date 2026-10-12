import { sha256Hex } from './sha256.ts';

/** A value that survives a JSON round trip unchanged. */
export type JsonValue =
  null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

function fail(path: string, what: string): never {
  throw new TypeError(`canonicalJson: ${what} at ${path === '' ? '<root>' : path}`);
}

function write(value: unknown, path: string, ancestors: Set<object>): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) return fail(path, `non-finite number ${value}`);
      // Number-to-string conversion is fully specified by ECMA-262 (shortest digits that round
      // trip), so it is identical on every engine. Negative zero is rendered as "0".
      return value === 0 ? '0' : String(value);
    case 'string':
      return JSON.stringify(value);
    case 'object':
      break;
    default:
      return fail(path, `unsupported ${typeof value} value`);
  }
  const obj = value as object;
  if (ancestors.has(obj)) return fail(path, 'circular reference');
  ancestors.add(obj);
  let out: string;
  if (Array.isArray(obj)) {
    const parts: string[] = [];
    for (let i = 0; i < obj.length; i++) {
      const item: unknown = obj[i];
      if (item === undefined) return fail(`${path}[${i}]`, 'undefined array element');
      parts.push(write(item, `${path}[${i}]`, ancestors));
    }
    out = `[${parts.join(',')}]`;
  } else {
    const proto: unknown = Object.getPrototypeOf(obj);
    if (proto !== Object.prototype && proto !== null) {
      const name = (obj as { constructor?: { name?: string } }).constructor?.name ?? 'object';
      return fail(path, `unsupported ${name} instance (only plain objects and arrays)`);
    }
    const record = obj as Record<string, unknown>;
    // Default sort order is by UTF-16 code unit, the ordering RFC 8785 (JCS) prescribes.
    const keys = Object.keys(record).sort();
    const parts: string[] = [];
    for (const key of keys) {
      const item = record[key];
      if (item === undefined) continue;
      parts.push(`${JSON.stringify(key)}:${write(item, `${path}.${key}`, ancestors)}`);
    }
    out = `{${parts.join(',')}}`;
  }
  ancestors.delete(obj);
  return out;
}

/**
 * Canonical JSON text of a value: object keys sorted by UTF-16 code unit, no whitespace, numbers
 * in the shortest form that round-trips (as ECMA-262 specifies, so identical on every engine),
 * negative zero as `0`. Two values that are deeply equal as JSON always give the same string,
 * which makes the result suitable for state hashes and cache keys.
 *
 * Accepted: null, booleans, finite numbers, strings, arrays and plain objects. Object properties
 * whose value is `undefined` are omitted (as `JSON.stringify` does). Anything else (non-finite
 * numbers, `undefined` in an array, bigint, functions, symbols, typed arrays, Map, Set, Date,
 * class instances, cycles) throws a TypeError naming the offending path, because silently
 * dropping or coercing data would corrupt a hash.
 *
 * Floating-point values are rendered exactly as they are; quantise them first (see `quantise.ts`)
 * if the hash must be insensitive to rounding noise.
 */
export function canonicalJson(value: unknown): string {
  return write(value, '', new Set<object>());
}

/**
 * State hash of a JSON-compatible value: `'sha256:'` followed by the lower-case hexadecimal
 * SHA-256 of the UTF-8 bytes of {@link canonicalJson}. This is the format of every `state_hash`
 * field.
 */
export function canonicalHash(value: unknown): string {
  return `sha256:${sha256Hex(canonicalJson(value))}`;
}
