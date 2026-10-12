/**
 * IEEE 754 half precision on the CPU, for the `f16` fields of record layouts
 * (docs/design/sim-core.md section 5.1: "f16 is IEEE half precision in the scaled unit given").
 * Node 20 has neither `Float16Array` nor `DataView.getFloat16`, and the simulation must also
 * run in browsers that lack them, so the two conversions are written out here.
 *
 * Both functions are exact: decoding returns the value the 16 bits denote, and encoding rounds
 * to the nearest representable value, ties to even, overflowing to infinity, as IEEE 754
 * `roundTiesToEven` does. No units.
 */

/** Largest finite half-precision value, 65504. */
export const F16_MAX = 65504;

/** Smallest positive normal half-precision value, 2^-14 (about 6.1e-5; section 5.1). */
export const F16_MIN_NORMAL = 2 ** -14;

/** The value denoted by the 16 bits `bits` (0 to 65535) as an IEEE half. */
export function f16BitsToNumber(bits: number): number {
  const sign = bits & 0x8000 ? -1 : 1;
  const exponent = (bits >> 10) & 0x1f;
  const fraction = bits & 0x3ff;
  if (exponent === 0) return sign * fraction * 2 ** -24;
  if (exponent === 31) return fraction === 0 ? sign * Infinity : NaN;
  return sign * (1 + fraction / 1024) * 2 ** (exponent - 15);
}

function roundHalfEven(q: number): number {
  const floor = Math.floor(q);
  const rest = q - floor;
  if (rest > 0.5) return floor + 1;
  if (rest < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

/**
 * The 16 bits of the IEEE half nearest to `x` (ties to even). Values of magnitude 65520 or more
 * become infinity; NaN becomes the quiet NaN 0x7e00.
 */
export function numberToF16Bits(x: number): number {
  if (Number.isNaN(x)) return 0x7e00;
  const sign = x < 0 || Object.is(x, -0) ? 0x8000 : 0;
  const a = Math.abs(x);
  if (a === 0) return sign;
  // 65520 is half way between the largest half (65504) and 2^16; the tie goes to the even
  // significand, which is the one that overflows.
  if (a >= 65520) return sign | 0x7c00;
  if (a < F16_MIN_NORMAL) {
    // Subnormal range: a whole number of units of 2^-24. Scaling by a power of two is exact.
    // A result of 1024 is the smallest normal number, whose bit pattern is exactly 0x0400.
    return sign | roundHalfEven(a * 2 ** 24);
  }
  let exponent = Math.floor(Math.log2(a));
  // Math.log2 may be off by one at powers of two; correct it exactly.
  if (2 ** exponent > a) exponent--;
  else if (2 ** (exponent + 1) <= a) exponent++;
  // (a / 2^e - 1) * 1024 is exact in double precision: a scaling and a subtraction of nearby
  // values. A rounded fraction of 1024 carries into the exponent, which is the right answer.
  const fraction = roundHalfEven((a / 2 ** exponent - 1) * 1024);
  return sign | (((exponent + 15) << 10) + fraction);
}
