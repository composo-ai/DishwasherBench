/**
 * Byte-level plumbing for Jolt's saved state: a recorder that moves the state between the
 * WebAssembly heap and JavaScript, little-endian readers and writers, and the parser of the
 * contact-cache section of a saved state.
 *
 * The layout parsed here is that of Jolt Physics 5.6.0 (`ContactConstraintManager::SaveState`
 * with `EStateRecorderState::Contacts`), the version inside `jolt-physics` 1.1.0, which the
 * package pins exactly. The parser checks that it consumes the stream to the last byte and
 * throws otherwise, so a layout change in a future engine version cannot go unnoticed.
 */

import type { JoltModule } from './jolt-module.ts';

/** Growable little-endian byte sink. */
export class ByteWriter {
  private buffer = new Uint8Array(256);
  private view = new DataView(this.buffer.buffer);
  private length = 0;

  private reserve(extra: number): void {
    const needed = this.length + extra;
    if (needed <= this.buffer.length) return;
    const next = new Uint8Array(Math.max(needed, this.buffer.length * 2));
    next.set(this.buffer.subarray(0, this.length));
    this.buffer = next;
    this.view = new DataView(next.buffer);
  }

  /** Number of bytes written so far. */
  get size(): number {
    return this.length;
  }

  /** Discards everything written. */
  clear(): void {
    this.length = 0;
  }

  /** Appends raw bytes. */
  bytes(data: Uint8Array): void {
    this.reserve(data.length);
    this.buffer.set(data, this.length);
    this.length += data.length;
  }

  /** Appends one unsigned byte. */
  u8(value: number): void {
    this.reserve(1);
    this.view.setUint8(this.length, value);
    this.length += 1;
  }

  /** Appends an unsigned 16-bit integer. */
  u16(value: number): void {
    this.reserve(2);
    this.view.setUint16(this.length, value, true);
    this.length += 2;
  }

  /** Appends an unsigned 32-bit integer. */
  u32(value: number): void {
    this.reserve(4);
    this.view.setUint32(this.length, value, true);
    this.length += 4;
  }

  /** Appends a 32-bit float. */
  f32(value: number): void {
    this.reserve(4);
    this.view.setFloat32(this.length, value, true);
    this.length += 4;
  }

  /** Appends a 64-bit float. */
  f64(value: number): void {
    this.reserve(8);
    this.view.setFloat64(this.length, value, true);
    this.length += 8;
  }

  /** Appends a length-prefixed UTF-8 string (at most 65535 bytes). */
  text(value: string): void {
    const encoded = new TextEncoder().encode(value);
    if (encoded.length > 0xffff) throw new Error('physics: string too long to serialise');
    this.u16(encoded.length);
    this.bytes(encoded);
  }

  /** A copy of the bytes written so far. */
  toBytes(): Uint8Array {
    return this.buffer.slice(0, this.length);
  }
}

/** Little-endian reader over a byte array; throws on reading past the end. */
export class ByteReader {
  private readonly view: DataView;
  private offset = 0;

  constructor(private readonly data: Uint8Array) {
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  private take(count: number): number {
    const at = this.offset;
    if (at + count > this.data.length) throw new Error('physics: saved state is truncated');
    this.offset = at + count;
    return at;
  }

  /** Bytes not yet read. */
  get remaining(): number {
    return this.data.length - this.offset;
  }

  /** Reads one unsigned byte. */
  u8(): number {
    return this.view.getUint8(this.take(1));
  }

  /** Reads an unsigned 16-bit integer. */
  u16(): number {
    return this.view.getUint16(this.take(2), true);
  }

  /** Reads an unsigned 32-bit integer. */
  u32(): number {
    return this.view.getUint32(this.take(4), true);
  }

  /** Reads a 32-bit float. */
  f32(): number {
    return this.view.getFloat32(this.take(4), true);
  }

  /** Reads a 64-bit float. */
  f64(): number {
    return this.view.getFloat64(this.take(8), true);
  }

  /** Reads `count` raw bytes (a view, not a copy). */
  bytes(count: number): Uint8Array {
    const at = this.take(count);
    return this.data.subarray(at, at + count);
  }

  /** Reads a length-prefixed UTF-8 string. */
  text(): string {
    return new TextDecoder().decode(this.bytes(this.u16()));
  }
}

/**
 * A Jolt state recorder backed by a JavaScript buffer. One instance serves a world for its whole
 * life: `capture` runs a save into a fresh buffer and returns the bytes, `replay` feeds bytes to
 * a restore.
 */
export class StateRecorder {
  private readonly native: InstanceType<JoltModule['StateRecorderJS']>;
  private readonly writer = new ByteWriter();
  private source: Uint8Array = new Uint8Array(0);
  private cursor = 0;
  private overrun = false;

  constructor(private readonly jolt: JoltModule) {
    const native = new jolt.StateRecorderJS();
    native.WriteBytes = (pointer: number, count: number): void => {
      this.writer.bytes(jolt.HEAPU8.subarray(pointer, pointer + count));
    };
    native.ReadBytes = (pointer: number, count: number): void => {
      if (this.cursor + count > this.source.length) {
        // Reading past the end: hand back zeros and remember, the caller reports the failure.
        this.overrun = true;
        jolt.HEAPU8.fill(0, pointer, pointer + count);
        return;
      }
      jolt.HEAPU8.set(this.source.subarray(this.cursor, this.cursor + count), pointer);
      this.cursor += count;
    };
    native.IsEOF = (): boolean => this.cursor >= this.source.length;
    native.IsFailed = (): boolean => this.overrun;
    this.native = native;
  }

  /** Runs `save` against an empty recorder and returns what it wrote. */
  capture(save: (recorder: InstanceType<JoltModule['StateRecorderJS']>) => void): Uint8Array {
    this.writer.clear();
    save(this.native);
    return this.writer.toBytes();
  }

  /**
   * Runs `restore` with the recorder positioned at the start of `bytes`. Returns true when the
   * restore consumed exactly the bytes given.
   */
  replay(
    bytes: Uint8Array,
    restore: (recorder: InstanceType<JoltModule['StateRecorderJS']>) => void,
  ): boolean {
    this.source = bytes;
    this.cursor = 0;
    this.overrun = false;
    restore(this.native);
    const exact = !this.overrun && this.cursor === bytes.length;
    this.source = new Uint8Array(0);
    this.cursor = 0;
    return exact;
  }

  /** Frees the native recorder. */
  dispose(): void {
    this.jolt.destroy(this.native);
  }
}

/** One cached contact manifold: the contact between one piece of each of two bodies. */
export interface SavedManifold {
  /** Jolt body id (index and sequence number) of the first body. */
  readonly body1: number;
  /** Jolt sub-shape id of the piece of the first body. */
  readonly subShape1: number;
  readonly body2: number;
  readonly subShape2: number;
  /** Unit contact normal in the axes of body 2, pointing from body 1 to body 2. */
  readonly normal: readonly [number, number, number];
  /**
   * Contact points, seven numbers each: the point on body 1 relative to its centre of mass in
   * its own axes (3), the same for body 2 (3), and the normal impulse applied during the latest
   * step in N s (1).
   */
  readonly points: readonly number[];
}

/** Value of `EStateRecorderState::Contacts` in Jolt 5.6.0. */
export const STATE_CONTACTS = 4;

/** A saved contact state holding no contacts (used to clear the engine's contact cache). */
export function emptyContactState(): Uint8Array {
  const writer = new ByteWriter();
  writer.u8(STATE_CONTACTS);
  writer.u32(0); // body pairs
  writer.u32(0); // continuous-collision manifolds
  return writer.toBytes();
}

/**
 * Parses a state saved with `EStateRecorderState::Contacts` into its manifolds. Throws when the
 * bytes do not have the expected layout.
 */
export function parseContactState(bytes: Uint8Array): SavedManifold[] {
  const reader = new ByteReader(bytes);
  const flags = reader.u8();
  if (flags !== STATE_CONTACTS) {
    throw new Error(`physics: expected a contact state (flags ${STATE_CONTACTS}), got ${flags}`);
  }
  const manifolds: SavedManifold[] = [];
  const pairCount = reader.u32();
  for (let i = 0; i < pairCount; i++) {
    reader.u32(); // body A of the pair
    reader.u32(); // body B of the pair
    reader.bytes(24); // relative position and rotation of the pair when it was cached
    const manifoldCount = reader.u32();
    for (let j = 0; j < manifoldCount; j++) {
      const body1 = reader.u32();
      const subShape1 = reader.u32();
      const body2 = reader.u32();
      const subShape2 = reader.u32();
      const pointCount = reader.u16();
      const normal: [number, number, number] = [reader.f32(), reader.f32(), reader.f32()];
      reader.bytes(12); // friction impulses (two linear, one angular)
      const points: number[] = [];
      for (let k = 0; k < pointCount * 7; k++) points.push(reader.f32());
      manifolds.push({ body1, subShape1, body2, subShape2, normal, points });
    }
  }
  const ccdCount = reader.u32();
  reader.bytes(ccdCount * 16);
  if (reader.remaining !== 0) {
    throw new Error(
      `physics: contact state has ${reader.remaining} unread bytes; the engine's saved-state layout is not the one this package was written for`,
    );
  }
  return manifolds;
}
