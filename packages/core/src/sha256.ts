/**
 * Synchronous SHA-256 (FIPS 180-4) in plain TypeScript. It uses only typed arrays and 32-bit
 * integer operations, so it runs unchanged in Node and in browsers and gives the same digest
 * everywhere. Used for state hashes, cache keys and action-log digests.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const INITIAL_STATE: readonly number[] = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

const HEX_DIGITS = '0123456789abcdef';

/** Processes one 64-byte block starting at `offset` in `data`, updating `state` in place. */
function compress(state: Uint32Array, w: Uint32Array, data: Uint8Array, offset: number): void {
  for (let i = 0; i < 16; i++) {
    const j = offset + 4 * i;
    w[i] =
      ((data[j] as number) << 24) |
      ((data[j + 1] as number) << 16) |
      ((data[j + 2] as number) << 8) |
      (data[j + 3] as number);
  }
  for (let i = 16; i < 64; i++) {
    const w15 = w[i - 15] as number;
    const w2 = w[i - 2] as number;
    const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
    const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
    w[i] = ((w[i - 16] as number) + s0 + (w[i - 7] as number) + s1) | 0;
  }
  let a = state[0] as number;
  let b = state[1] as number;
  let c = state[2] as number;
  let d = state[3] as number;
  let e = state[4] as number;
  let f = state[5] as number;
  let g = state[6] as number;
  let h = state[7] as number;
  for (let i = 0; i < 64; i++) {
    const big1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const ch = (e & f) ^ (~e & g);
    const t1 = (h + big1 + ch + (K[i] as number) + (w[i] as number)) | 0;
    const big0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const t2 = (big0 + maj) | 0;
    h = g;
    g = f;
    f = e;
    e = (d + t1) | 0;
    d = c;
    c = b;
    b = a;
    a = (t1 + t2) | 0;
  }
  state[0] = ((state[0] as number) + a) | 0;
  state[1] = ((state[1] as number) + b) | 0;
  state[2] = ((state[2] as number) + c) | 0;
  state[3] = ((state[3] as number) + d) | 0;
  state[4] = ((state[4] as number) + e) | 0;
  state[5] = ((state[5] as number) + f) | 0;
  state[6] = ((state[6] as number) + g) | 0;
  state[7] = ((state[7] as number) + h) | 0;
}

/** Incremental SHA-256 hasher returned by {@link createSha256}. */
export interface Sha256Hasher {
  /**
   * Appends bytes (or the UTF-8 encoding of a string) to the message. Returns the hasher so
   * calls can be chained. Throws if called after `digest`.
   */
  update(data: Uint8Array | string): Sha256Hasher;
  /** Finishes the hash and returns the 32-byte digest. May be called once. */
  digest(): Uint8Array;
  /** Finishes the hash and returns the digest as 64 lower-case hexadecimal digits. */
  digestHex(): string;
}

/** Creates an incremental SHA-256 hasher, for hashing a message supplied in pieces. */
export function createSha256(): Sha256Hasher {
  const state = new Uint32Array(INITIAL_STATE);
  const w = new Uint32Array(64);
  const buffer = new Uint8Array(64);
  let buffered = 0;
  let totalBytes = 0;
  let finished = false;

  const hasher: Sha256Hasher = {
    update(data: Uint8Array | string): Sha256Hasher {
      if (finished) throw new Error('Sha256Hasher.update: digest has already been taken');
      const bytes = typeof data === 'string' ? utf8Encode(data) : data;
      let pos = 0;
      const n = bytes.length;
      totalBytes += n;
      if (buffered > 0) {
        const take = Math.min(64 - buffered, n);
        buffer.set(bytes.subarray(0, take), buffered);
        buffered += take;
        pos = take;
        if (buffered < 64) return hasher;
        compress(state, w, buffer, 0);
        buffered = 0;
      }
      for (; pos + 64 <= n; pos += 64) compress(state, w, bytes, pos);
      if (pos < n) {
        buffer.set(bytes.subarray(pos), 0);
        buffered = n - pos;
      }
      return hasher;
    },
    digest(): Uint8Array {
      if (finished) throw new Error('Sha256Hasher.digest: digest has already been taken');
      finished = true;
      // Padding: 0x80, zeros, then the message length in bits as a 64-bit big-endian integer.
      const bitsHigh = Math.floor(totalBytes / 0x20000000);
      const bitsLow = (totalBytes << 3) >>> 0;
      buffer[buffered++] = 0x80;
      if (buffered > 56) {
        buffer.fill(0, buffered);
        compress(state, w, buffer, 0);
        buffered = 0;
      }
      buffer.fill(0, buffered, 56);
      buffer[56] = (bitsHigh >>> 24) & 0xff;
      buffer[57] = (bitsHigh >>> 16) & 0xff;
      buffer[58] = (bitsHigh >>> 8) & 0xff;
      buffer[59] = bitsHigh & 0xff;
      buffer[60] = (bitsLow >>> 24) & 0xff;
      buffer[61] = (bitsLow >>> 16) & 0xff;
      buffer[62] = (bitsLow >>> 8) & 0xff;
      buffer[63] = bitsLow & 0xff;
      compress(state, w, buffer, 0);
      const out = new Uint8Array(32);
      for (let i = 0; i < 8; i++) {
        const word = state[i] as number;
        out[4 * i] = (word >>> 24) & 0xff;
        out[4 * i + 1] = (word >>> 16) & 0xff;
        out[4 * i + 2] = (word >>> 8) & 0xff;
        out[4 * i + 3] = word & 0xff;
      }
      return out;
    },
    digestHex(): string {
      return bytesToHex(hasher.digest());
    },
  };
  return hasher;
}

/** SHA-256 digest (32 bytes) of a byte array, or of the UTF-8 encoding of a string. */
export function sha256(data: Uint8Array | string): Uint8Array {
  return createSha256().update(data).digest();
}

/** SHA-256 digest as 64 lower-case hexadecimal digits. */
export function sha256Hex(data: Uint8Array | string): string {
  return bytesToHex(sha256(data));
}

/** UTF-8 encoding of a string. Unpaired surrogates become U+FFFD, as the WHATWG encoder does. */
export function utf8Encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Lower-case hexadecimal rendering of a byte array, two digits per byte. */
export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] as number;
    out += HEX_DIGITS.charAt(b >>> 4) + HEX_DIGITS.charAt(b & 15);
  }
  return out;
}

/**
 * Parses a hexadecimal string (either case, even length, no prefix) into bytes. Throws a
 * RangeError on malformed input.
 */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    throw new RangeError('hexToBytes: expected an even number of hexadecimal digits');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  }
  return out;
}
