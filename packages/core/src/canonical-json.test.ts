import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canonicalHash, canonicalJson, type JsonValue } from './canonical-json.ts';
import { testRandom } from './test-util.ts';

/** Independent reference: rebuild the value with sorted keys, then use JSON.stringify. */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([k, v]) => [k, sortKeysDeep(v)]));
  }
  return value;
}

function randomJson(rnd: ReturnType<typeof testRandom>, depth: number): JsonValue {
  const pick = rnd.u32() % (depth > 0 ? 8 : 6);
  switch (pick) {
    case 0:
      return null;
    case 1:
      return rnd.u32() % 2 === 0;
    case 2:
      return rnd.u32() % 2000;
    case 3:
      return rnd.range(-1e6, 1e6);
    case 4:
      return rnd.range(-1, 1) * 10 ** ((rnd.u32() % 60) - 30);
    case 5:
      return ['', 'plate_03', 'a"b\\c', 'line\nbreak', 'é€😀', '\u0001'][rnd.u32() % 6] as string;
    case 6: {
      const n = rnd.u32() % 5;
      return Array.from({ length: n }, () => randomJson(rnd, depth - 1));
    }
    default: {
      const n = rnd.u32() % 6;
      const out: Record<string, JsonValue> = {};
      for (let i = 0; i < n; i++) {
        // Keys never look like array indices: JavaScript objects enumerate index-like keys in
        // numeric order whatever order they were inserted in, so the JSON.stringify reference
        // below could not represent code-unit order for them ("101" < "90"). That case is
        // covered by the hand-written ordering test.
        const key = ['z', 'a', 'item_id', 'Z', 'é', 'n10', 'n9', 'aa', '_'][
          rnd.u32() % 9
        ] as string;
        out[key + (rnd.u32() % 3)] = randomJson(rnd, depth - 1);
      }
      return out;
    }
  }
}

describe('canonicalJson', () => {
  it('sorts keys at every level and writes no whitespace', () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { z: 0, y: 1 }], c: null } })).toBe(
      '{"a":{"c":null,"d":[1,{"y":1,"z":0}]},"b":1}',
    );
  });

  it('orders keys by UTF-16 code unit: digits, upper case, underscore, lower case, non-ASCII', () => {
    const last = String.fromCharCode(0xffff);
    const value = {
      é: 1,
      a: 2,
      B: 3,
      _x: 4,
      '10': 5,
      '9': 6,
      '': 7,
      '😀': 8,
      [last]: 9,
      '101': 0,
    };
    // '' < '10' < '101' < '9' < 'B' < '_x' < 'a' < e-acute (U+00E9) < the emoji (a surrogate
    // pair starting U+D83D) < U+FFFF. Note "101" before "9": text order, not the numeric order
    // in which JavaScript objects enumerate index-like keys.
    expect(canonicalJson(value)).toBe(
      `{"":7,"10":5,"101":0,"9":6,"B":3,"_x":4,"a":2,"é":1,"😀":8,"${last}":9}`,
    );
  });

  it('reproduces the example of RFC 8785 (JSON Canonicalization Scheme), section 3.2', () => {
    // Recalled from the RFC; the expected text also follows directly from the rules.
    const input = JSON.parse(
      '{"numbers":[333333333.33333329,1E30,4.50,2e-3,0.000000000000000000000000001],' +
        '"string":"\\u20ac$\\u000F\\u000aA\'\\u0042\\u0022\\u005c\\\\\\"\\/",' +
        '"literals":[null,true,false]}',
    ) as unknown;
    expect(canonicalJson(input)).toBe(
      '{"literals":[null,true,false],' +
        '"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],' +
        '"string":"€$\\u000f\\nA\'B\\"\\\\\\\\\\"/"}',
    );
  });

  it('renders numbers in the shortest round-trip form, and negative zero as 0', () => {
    expect(canonicalJson([1, 1.5, -0, 0, 100, 1e21, 1e-7, 0.1 + 0.2, -2.5e-3, 123456789012])).toBe(
      '[1,1.5,0,0,100,1e+21,1e-7,0.30000000000000004,-0.0025,123456789012]',
    );
    expect(canonicalJson(5e-324)).toBe('5e-324');
    expect(canonicalJson(Number.MAX_VALUE)).toBe('1.7976931348623157e+308');
  });

  it('is independent of key insertion order', () => {
    const rnd = testRandom(301);
    for (let i = 0; i < 100; i++) {
      const entries: [string, number][] = Array.from({ length: 12 }, (_, k) => [
        `k${k}`,
        rnd.next(),
      ]);
      const shuffled = [...entries].sort(() => rnd.next() - 0.5);
      expect(canonicalJson(Object.fromEntries(shuffled))).toBe(
        canonicalJson(Object.fromEntries(entries)),
      );
    }
  });

  it('agrees with JSON.stringify of a key-sorted copy on 500 random documents, and round-trips', () => {
    const rnd = testRandom(302);
    for (let i = 0; i < 500; i++) {
      const doc = randomJson(rnd, 4);
      const text = canonicalJson(doc);
      expect(text).toBe(JSON.stringify(sortKeysDeep(doc)));
      expect(JSON.parse(text)).toEqual(JSON.parse(JSON.stringify(doc)));
      // Canonical form is a fixed point.
      expect(canonicalJson(JSON.parse(text))).toBe(text);
    }
  });

  it('omits undefined properties and accepts null-prototype objects and repeated references', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
    const bare = Object.assign(Object.create(null) as Record<string, number>, { y: 2, x: 1 });
    expect(canonicalJson(bare)).toBe('{"x":1,"y":2}');
    const shared = { p: [1, 2, 3] };
    expect(canonicalJson([shared, shared])).toBe('[{"p":[1,2,3]},{"p":[1,2,3]}]');
  });

  it('throws on values that JSON cannot carry faithfully, naming the path', () => {
    expect(() => canonicalJson({ a: { b: [1, Number.NaN] } })).toThrow(/\.a\.b\[1\]/);
    expect(() => canonicalJson(Number.POSITIVE_INFINITY)).toThrow(TypeError);
    expect(() => canonicalJson([undefined])).toThrow(/undefined array element/);
    expect(() => canonicalJson(undefined)).toThrow(TypeError);
    expect(() => canonicalJson({ n: 10n })).toThrow(/bigint/);
    expect(() => canonicalJson({ f: () => 1 })).toThrow(/function/);
    expect(() => canonicalJson(Symbol('s'))).toThrow(TypeError);
    expect(() => canonicalJson(new Date(0))).toThrow(/Date/);
    expect(() => canonicalJson(new Map())).toThrow(/Map/);
    expect(() => canonicalJson({ bytes: new Uint8Array(2) })).toThrow(/Uint8Array/);
  });

  it('throws on a cycle instead of recursing for ever', () => {
    const a: { self?: unknown } = {};
    a.self = a;
    expect(() => canonicalJson(a)).toThrow(/circular/);
    const list: unknown[] = [];
    list.push([list]);
    expect(() => canonicalJson(list)).toThrow(/circular/);
  });
});

describe('canonicalHash', () => {
  it('is sha256 of the canonical text, tagged, and independent of key order', () => {
    const expected = createHash('sha256').update('{"a":[1,2],"b":"x"}', 'utf8').digest('hex');
    expect(canonicalHash({ b: 'x', a: [1, 2] })).toBe(`sha256:${expected}`);
    expect(canonicalHash({ a: [1, 2], b: 'x' })).toBe(`sha256:${expected}`);
  });

  it('changes when any value changes', () => {
    const base = { placed: [{ item_id: 'plate_03', position_mm: [212, 148, 61] }] };
    const moved = { placed: [{ item_id: 'plate_03', position_mm: [212, 148, 62] }] };
    expect(canonicalHash(base)).not.toBe(canonicalHash(moved));
    expect(canonicalHash(base)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
