/**
 * Hashes of result bytes for determinism checks (docs/design/sim-core.md section 6). No units.
 */

/**
 * The hash the GPU spike printed for a result buffer: two interleaved 32-bit FNV-1a style
 * hashes of the bytes, as 16 hex digits (`hashBytes` of spikes/gpu-compute/lib.mjs). Kept
 * bit-compatible so that the spike's recorded hashes (the B1 stencil's `ba69c15a8d62ffc6`,
 * section M1 "Tests") can be compared with what this package computes. New golden hashes use
 * `sha256Hex` of `@spotless/core`.
 */
export function spikeHashHex(bytes: Uint8Array): string {
  let h1 = 0x811c9dc5 | 0;
  let h2 = 0x01000193 | 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] as number;
    h1 = Math.imul(h1 ^ b, 0x01000193);
    h2 = (Math.imul(h2 ^ b, 0x85ebca6b) + 0x7f4a7c15) | 0;
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

/**
 * Index of the first byte at which two buffers differ, or -1 if they are identical (a
 * difference in length counts at the end of the shorter). For the invariance tests of rule 18:
 * shuffle, workgroup size and batching must leave every byte unchanged.
 */
export function firstDifferentByte(
  a: ArrayBuffer | ArrayBufferView,
  b: ArrayBuffer | ArrayBufferView,
): number {
  const bytesOf = (x: ArrayBuffer | ArrayBufferView): Uint8Array =>
    ArrayBuffer.isView(x)
      ? new Uint8Array(x.buffer, x.byteOffset, x.byteLength)
      : new Uint8Array(x);
  const ua = bytesOf(a);
  const ub = bytesOf(b);
  const n = Math.min(ua.length, ub.length);
  for (let i = 0; i < n; i++) if (ua[i] !== ub[i]) return i;
  return ua.length === ub.length ? -1 : n;
}
