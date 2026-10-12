import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { bytesToHex, createSha256, hexToBytes, sha256, sha256Hex, utf8Encode } from './sha256.ts';
import { testRandom } from './test-util.ts';

function nodeSha256(data: Uint8Array | string): string {
  return createHash('sha256').update(data).digest('hex');
}

function randomBytes(rnd: ReturnType<typeof testRandom>, n: number): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = rnd.u32() & 0xff;
  return out;
}

describe('SHA-256 known answers (FIPS 180-4 / NIST example vectors)', () => {
  it('empty message', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('"abc"', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('the 448-bit two-block message', () => {
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('one million repetitions of "a"', () => {
    expect(sha256Hex('a'.repeat(1_000_000))).toBe(
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
    );
  });
});

describe('SHA-256 against node:crypto', () => {
  it('agrees for every length from 0 to 300 bytes (all padding cases)', () => {
    const rnd = testRandom(201);
    for (let n = 0; n <= 300; n++) {
      const data = randomBytes(rnd, n);
      expect(sha256Hex(data)).toBe(nodeSha256(data));
    }
  });

  it('agrees on 200 random inputs of random length up to 20 kB', () => {
    const rnd = testRandom(202);
    for (let i = 0; i < 200; i++) {
      const data = randomBytes(rnd, rnd.u32() % 20000);
      expect(sha256Hex(data)).toBe(nodeSha256(data));
    }
  });

  it('agrees on a 3 MB input', () => {
    const data = randomBytes(testRandom(203), 3_000_001);
    expect(sha256Hex(data)).toBe(nodeSha256(data));
  });

  it('agrees on strings with multi-byte and astral characters, hashed as UTF-8', () => {
    const edges = String.fromCharCode(0, 0x7f, 0x80, 0x7ff, 0x800, 0xffff);
    for (const text of ['Spülmaschine', 'tasse à café', '皿洗い機', 'plate 🍽️ clean ✓', edges]) {
      expect(sha256Hex(text)).toBe(nodeSha256(text));
      expect(bytesToHex(utf8Encode(text))).toBe(Buffer.from(text, 'utf8').toString('hex'));
    }
  });

  it('returns 32 bytes that match the hex form', () => {
    const digest = sha256('abc');
    expect(digest).toBeInstanceOf(Uint8Array);
    expect(digest.length).toBe(32);
    expect(bytesToHex(digest)).toBe(sha256Hex('abc'));
  });

  it('does not modify its input and honours typed-array views with an offset', () => {
    const backing = randomBytes(testRandom(204), 500);
    const copy = backing.slice();
    const view = backing.subarray(123, 377);
    expect(sha256Hex(view)).toBe(nodeSha256(view));
    expect(backing).toEqual(copy);
  });
});

describe('incremental hashing', () => {
  it('any split of the message into chunks gives the one-shot digest', () => {
    const rnd = testRandom(205);
    for (let i = 0; i < 100; i++) {
      const data = randomBytes(rnd, rnd.u32() % 1000);
      const hasher = createSha256();
      let pos = 0;
      while (pos < data.length) {
        const take = 1 + (rnd.u32() % 130);
        hasher.update(data.subarray(pos, pos + take));
        pos += take;
      }
      expect(hasher.digestHex()).toBe(nodeSha256(data));
    }
  });

  it('mixes string and byte updates and chains', () => {
    const digest = createSha256()
      .update('ab')
      .update(new Uint8Array([0x63]))
      .digestHex();
    expect(digest).toBe(sha256Hex('abc'));
  });

  it('refuses to be used after the digest has been taken', () => {
    const hasher = createSha256().update('abc');
    hasher.digest();
    expect(() => hasher.digest()).toThrow();
    expect(() => hasher.update('more')).toThrow();
  });
});

describe('hex helpers', () => {
  it('bytesToHex renders two lower-case digits per byte', () => {
    expect(bytesToHex(new Uint8Array([0, 1, 15, 16, 171, 255]))).toBe('00010f10abff');
    expect(bytesToHex(new Uint8Array())).toBe('');
  });

  it('hexToBytes inverts bytesToHex and accepts upper case', () => {
    const data = randomBytes(testRandom(206), 257);
    expect(hexToBytes(bytesToHex(data))).toEqual(data);
    expect(hexToBytes('00ABff')).toEqual(new Uint8Array([0, 171, 255]));
  });

  it('hexToBytes rejects malformed input', () => {
    expect(() => hexToBytes('abc')).toThrow(RangeError);
    expect(() => hexToBytes('zz')).toThrow(RangeError);
    expect(() => hexToBytes('0x00')).toThrow(RangeError);
  });
});
