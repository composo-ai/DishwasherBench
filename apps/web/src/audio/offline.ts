/**
 * Renders the mix faster than real time and measures it, for `scripts/audio-mix-check.ts`.
 *
 * The same mixer and the same sequencer as the page run on an `OfflineAudioContext`, with the
 * whole schedule laid out in advance. Two renders answer two questions:
 *
 *   - `tone`: every file is replaced by a constant 1. What comes out is then the sum of the
 *     gains of all the voices, sample by sample: the envelope the engine puts on the music. A
 *     click made by the engine is a step in it, a gap is a dip under 1.
 *   - otherwise the real files are mixed, and the result is searched for steps at the joins that
 *     the music around them does not have, and its level is measured in windows of three seconds.
 */

import type { Cue } from './director.ts';
import { AUDIO_BASE, OPENING, PLAY } from './manifest.ts';
import { BufferSource, Mixer } from './mixer.ts';
import { gainAt, seededRandom, type SequencerOptions } from './sequencer.ts';

export interface RenderRequest {
  readonly seconds: number;
  readonly seed: number;
  readonly sampleRate: number;
  readonly tone: boolean;
  /**
   * Things that happen during the render: the game's `scene` and `duck` cues, and the player
   * pressing "next change now" (`skip`), at given times.
   */
  readonly events: readonly { readonly at: number; readonly cue: Cue | { readonly do: 'skip' } }[];
  readonly options?: SequencerOptions;
  /** True to have the rendered sound returned: mono, 16 bit, base64 (`pcm`). */
  readonly pcm?: boolean;
}

export interface JoinReport {
  /** Seconds into the render, and what happens there. */
  readonly at: number;
  readonly what: string;
  /** The largest step between neighbouring samples within 20 ms of the join… */
  readonly step: number;
  /** …and in the two seconds either side of it, the join itself left out. */
  readonly around: number;
  /**
   * The largest step the files themselves make in those 20 ms, each under the gain its voice has
   * at that moment: what the mix would step by if the engine added nothing (music renders only).
   */
  readonly sources: number;
}

/** The level of the mix through one join: a voice coming in under another. */
export interface CrossfadeReport {
  /** When the incoming voice starts, and how long its fade in is. */
  readonly at: number;
  readonly seconds: number;
  readonly from: string;
  readonly to: string;
  /** 'change' from one piece to another, or 'repeat' of a piece's own middle. */
  readonly kind: 'change' | 'repeat';
  /** When the outgoing voice begins to fade and when it has gone. */
  readonly fadeFrom: number;
  readonly fadeTo: number;
  /** Level over the six seconds before the outgoing voice begins to fade, dB re full scale. */
  readonly beforeDb: number;
  /** Level over the six seconds after the join is over (both fades done). */
  readonly afterDb: number;
  /** The quietest and the loudest second in between (windows of one second, every quarter). */
  readonly minDb: number;
  readonly maxDb: number;
}

export interface RenderReport {
  readonly seconds: number;
  readonly sampleRate: number;
  readonly tone: boolean;
  readonly voices: {
    at: number;
    piece: string;
    offset: number;
    duration: number;
    kind: string;
    fadeIn: number;
    fadeOut: number;
    closeTo: number;
  }[];
  /** The rendered sound when it was asked for: mono, 16 bit, little-endian, base64. */
  readonly pcm?: string;
  /** The largest step between neighbouring samples anywhere, and where. */
  readonly largestStep: number;
  readonly largestStepAt: number;
  readonly peak: number;
  readonly joins: JoinReport[];
  /** Each crossfade of the first deck (music renders only). */
  readonly crossfades: CrossfadeReport[];
  /** Level of each window of `windowSeconds`, dB re full scale (RMS over both channels). */
  readonly windowSeconds: number;
  readonly levelsDb: number[];
  /** Smallest and largest sample of the first channel after the opening fade (tone renders). */
  readonly envelopeMin: number;
  readonly envelopeMax: number;
  readonly renderMs: number;
}

async function fetchBytes(file: string): Promise<ArrayBuffer> {
  const response = await fetch(AUDIO_BASE + file);
  if (!response.ok) throw new Error(`audio: ${file}: ${response.status}`);
  return response.arrayBuffer();
}

export async function renderMix(request: RenderRequest): Promise<RenderReport> {
  const { seconds, sampleRate, tone } = request;
  const started = performance.now();
  const context = new OfflineAudioContext(
    tone ? 1 : 2,
    Math.floor(seconds * sampleRate),
    sampleRate,
  );
  const source = new BufferSource(context, async (file) =>
    context.decodeAudioData(await fetchBytes(file)),
  );
  for (const piece of [OPENING, ...PLAY]) {
    if (!tone) continue;
    const buffer = context.createBuffer(1, Math.ceil(piece.duration * sampleRate), sampleRate);
    buffer.getChannelData(0).fill(1);
    source.set(piece.file, buffer);
  }
  const buffers = new Map<string, AudioBuffer>();
  if (!tone) {
    for (const piece of [OPENING, ...PLAY]) {
      buffers.set(piece.file, await context.decodeAudioData(await fetchBytes(piece.file)));
    }
    for (const [file, buffer] of buffers) source.set(file, buffer);
  }
  const mixer = new Mixer(context, source, seededRandom(request.seed), request.options);

  // The game's part, in order of time; the schedule is filled up to each event before it.
  const marks: { at: number; what: string }[] = [];
  const events = [...request.events].sort((a, b) => a.at - b.at);
  for (const { at, cue } of events) {
    mixer.fill(at);
    if (cue.do === 'scene') mixer.setScene(cue.scene, at);
    else if (cue.do === 'duck') mixer.setDuck(cue.on, at);
    else if (cue.do === 'skip') {
      const done = mixer.skip(at);
      marks.push({ at, what: done ? 'go to next change' : 'go to next change (refused)' });
      continue;
    }
    marks.push({ at, what: cue.do === 'scene' ? `scene ${cue.scene}` : cue.do });
  }
  mixer.fill(seconds);
  for (const { segment, at, ends, fadeOut } of mixer.log) {
    const name = `${segment.piece.id} (${segment.kind})`;
    marks.push({ at, what: `${name} starts` });
    if (segment.fadeIn > 0) marks.push({ at: at + segment.fadeIn, what: `${name} is up` });
    marks.push({ at: ends - fadeOut, what: `${name} begins to fade` });
    marks.push({ at: ends, what: `${name} ends` });
  }

  const rendered = await context.startRendering();
  const channels = Array.from({ length: rendered.numberOfChannels }, (_, c) =>
    rendered.getChannelData(c),
  );
  const length = rendered.length;

  // Steps between neighbouring samples, kept as the largest of each 10 ms block.
  const block = Math.max(1, Math.floor(sampleRate / 100));
  const blocks = new Float32Array(Math.ceil(length / block));
  let largestStep = 0;
  let largestStepAt = 0;
  let peak = 0;
  for (const data of channels) {
    for (let i = 1; i < length; i++) {
      const value = data[i] ?? 0;
      const step = Math.abs(value - (data[i - 1] ?? 0));
      const b = Math.floor(i / block);
      if (step > (blocks[b] ?? 0)) blocks[b] = step;
      if (step > largestStep) {
        largestStep = step;
        largestStepAt = i / sampleRate;
      }
      const magnitude = Math.abs(value);
      if (magnitude > peak) peak = magnitude;
    }
  }
  const joins: JoinReport[] = [];
  for (const mark of marks.sort((a, b) => a.at - b.at)) {
    if (mark.at < 0 || mark.at >= seconds) continue;
    const centre = Math.floor((mark.at * sampleRate) / block);
    let step = 0;
    let around = 0;
    for (let b = Math.max(0, centre - 200); b <= Math.min(blocks.length - 1, centre + 200); b++) {
      const value = blocks[b] ?? 0;
      if (Math.abs(b - centre) <= 2) step = Math.max(step, value);
      else around = Math.max(around, value);
    }
    let sources = 0;
    if (!tone) {
      const from = Math.max(1, (centre - 2) * block);
      const to = Math.min(length, (centre + 3) * block);
      const sum = new Float32Array(to - from);
      for (let c = 0; c < channels.length; c++) {
        sum.fill(0);
        for (const entry of mixer.log) {
          const at = entry.at;
          // The voice as it sounded: "next change now" may have cut it short.
          const segment = {
            ...entry.segment,
            duration: entry.ends - at,
            fadeOut: entry.fadeOut,
          };
          if (at > to / sampleRate || at + segment.duration < from / sampleRate) continue;
          const buffer = buffers.get(segment.piece.file);
          if (buffer === undefined) continue;
          const data = buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1));
          const shift = Math.round((segment.offset - at) * sampleRate);
          for (let i = from; i < to; i++) {
            const gain =
              gainAt(segment, segment.start + i / sampleRate - at) * (segment.piece.gain ?? 1);
            if (gain === 0) continue;
            const j = i + shift;
            sum[i - from] =
              (sum[i - from] ?? 0) + gain * Math.abs((data[j] ?? 0) - (data[j - 1] ?? 0));
          }
        }
        for (const value of sum) if (value > sources) sources = value;
      }
    }
    joins.push({ at: mark.at, what: mark.what, step, around, sources });
  }

  const windowSeconds = 3;
  const levelsDb: number[] = [];
  const span = Math.floor(windowSeconds * sampleRate);
  for (let start = 0; start + span <= length; start += span) {
    let sum = 0;
    for (const data of channels) {
      for (let i = start; i < start + span; i++) sum += (data[i] ?? 0) ** 2;
    }
    levelsDb.push(10 * Math.log10(Math.max(1e-12, sum / (span * channels.length))));
  }

  // The crossfades: the level of the mix against what the two voices bring to it.
  const levelOf = (from: number, to: number): number => {
    const a = Math.max(0, Math.floor(from * sampleRate));
    const b = Math.min(length, Math.floor(to * sampleRate));
    let sum = 0;
    for (const data of channels) for (let i = a; i < b; i++) sum += (data[i] ?? 0) ** 2;
    return 10 * Math.log10(Math.max(1e-12, sum / Math.max(1, (b - a) * channels.length)));
  };
  const crossfades: CrossfadeReport[] = [];
  const firstScene = mixer.log[0]?.scene;
  const deck = mixer.log.filter((entry) => entry.scene === firstScene);
  for (let v = 1; v < deck.length && !tone; v++) {
    const previous = deck[v - 1];
    const entry = deck[v];
    if (previous === undefined || entry === undefined) continue;
    const fadeFrom = previous.ends - previous.fadeOut;
    const over = Math.max(previous.ends, entry.at + entry.segment.fadeIn);
    if (entry.segment.fadeIn <= 0 || over + 6 > seconds || fadeFrom - 6 < 0) continue;
    let minDb = Infinity;
    let maxDb = -Infinity;
    for (let t = fadeFrom; t + 1 <= over; t += 0.25) {
      const level = levelOf(t, t + 1);
      minDb = Math.min(minDb, level);
      maxDb = Math.max(maxDb, level);
    }
    crossfades.push({
      at: entry.at,
      seconds: entry.segment.fadeIn,
      from: previous.segment.piece.id,
      to: entry.segment.piece.id,
      kind: entry.segment.kind === 'repeat' ? 'repeat' : 'change',
      fadeFrom,
      fadeTo: previous.ends,
      beforeDb: levelOf(fadeFrom - 6, fadeFrom),
      afterDb: levelOf(over, over + 6),
      minDb,
      maxDb,
    });
  }

  let pcm: string | undefined;
  if (request.pcm === true) {
    const mono = new Int16Array(length);
    for (let i = 0; i < length; i++) {
      let sum = 0;
      for (const data of channels) sum += data[i] ?? 0;
      mono[i] = Math.max(-32768, Math.min(32767, Math.round((sum / channels.length) * 32767)));
    }
    const bytes = new Uint8Array(mono.buffer);
    let text = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    pcm = btoa(text);
  }

  let envelopeMin = Infinity;
  let envelopeMax = -Infinity;
  const first = channels[0];
  if (first !== undefined) {
    for (let i = Math.floor(12 * sampleRate); i < length; i++) {
      const value = first[i] ?? 0;
      if (value < envelopeMin) envelopeMin = value;
      if (value > envelopeMax) envelopeMax = value;
    }
  }

  return {
    seconds,
    sampleRate,
    tone,
    voices: mixer.log.map(({ segment, at, ends, fadeOut }) => ({
      at,
      piece: segment.piece.id,
      offset: segment.offset,
      duration: ends - at,
      kind: segment.kind,
      fadeIn: segment.fadeIn,
      fadeOut,
      closeTo: segment.closeTo,
    })),
    ...(pcm === undefined ? {} : { pcm }),
    largestStep,
    largestStepAt,
    peak,
    joins,
    crossfades,
    windowSeconds,
    levelsDb,
    envelopeMin,
    envelopeMax,
    renderMs: performance.now() - started,
  };
}
