/**
 * Sums of f64 values by integer key, for accumulators that are sparse over a large index space
 * (the hand-over of the jets by (phase bin, block); the landing table of drips by (site,
 * block)). An open-addressing table in typed arrays: about 20 ns per addition, no allocation
 * per entry.
 *
 * Keys are non-negative integers below 2^53 held in f64. Sums of whole numbers stay exact as
 * long as they stay below 2^53. The result does not depend on the order of additions when the
 * values are whole numbers (integer addition is associative).
 */
export class SparseSum {
  private keys: Float64Array;
  private values: Float64Array;
  private used = 0;
  private mask: number;

  constructor(capacity = 1 << 12) {
    let size = 16;
    while (size < 2 * capacity) size *= 2;
    this.keys = new Float64Array(size).fill(-1);
    this.values = new Float64Array(size);
    this.mask = size - 1;
  }

  /** Number of distinct keys. */
  get size(): number {
    return this.used;
  }

  private slot(key: number): number {
    // A multiplicative hash of the two halves of the key.
    const lo = key >>> 0;
    const hi = (key / 4294967296) >>> 0;
    let h = (Math.imul(lo, 0x9e3779b1) ^ Math.imul(hi + 0x7f4a7c15, 0x85ebca6b)) >>> 0;
    h = (h ^ (h >>> 15)) & this.mask;
    const keys = this.keys;
    for (;;) {
      const k = keys[h] as number;
      if (k === key || k === -1) return h;
      h = (h + 1) & this.mask;
    }
  }

  /** Adds `value` to the sum of `key`. */
  add(key: number, value: number): void {
    let h = this.slot(key);
    if ((this.keys[h] as number) === -1) {
      if (2 * (this.used + 1) > this.keys.length) {
        this.grow();
        h = this.slot(key);
      }
      this.keys[h] = key;
      this.used++;
    }
    this.values[h] = (this.values[h] as number) + value;
  }

  /** The sum of `key`, 0 if it was never added to. */
  get(key: number): number {
    const h = this.slot(key);
    return (this.keys[h] as number) === -1 ? 0 : (this.values[h] as number);
  }

  private grow(): void {
    const oldKeys = this.keys;
    const oldValues = this.values;
    const size = 2 * oldKeys.length;
    this.keys = new Float64Array(size).fill(-1);
    this.values = new Float64Array(size);
    this.mask = size - 1;
    for (let i = 0; i < oldKeys.length; i++) {
      const k = oldKeys[i] as number;
      if (k === -1) continue;
      const h = this.slot(k);
      this.keys[h] = k;
      this.values[h] = oldValues[i] as number;
    }
  }

  /** The keys in ascending order with their sums. */
  entries(): { readonly keys: Float64Array; readonly values: Float64Array } {
    const keys = new Float64Array(this.used);
    let n = 0;
    for (let i = 0; i < this.keys.length; i++) {
      const k = this.keys[i] as number;
      if (k !== -1) keys[n++] = k;
    }
    keys.sort();
    const values = new Float64Array(this.used);
    for (let i = 0; i < this.used; i++) values[i] = this.get(keys[i] as number);
    return { keys, values };
  }
}
