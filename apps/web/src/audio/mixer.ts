/**
 * Plays what the sequencer plans, on the Web Audio API.
 *
 *   voices -> deck gain -> duck gain -> low-pass -> music gain -+-> master gain -> out
 *                                   the game's own sounds -------+
 *
 * A *deck* is one timeline of music (the opening piece, or the mix of play) with a gain of its
 * own; changing scene lets the old deck die away while the new one rises. A *voice* is one
 * segment of one file with its own gain, which carries the segment's fades, and its own
 * low-pass, which closes over it when the piece is left for another (see `sequencer.ts`). Every
 * change of every gain and corner is scheduled on the audio clock, never set from a timer, so
 * nothing steps.
 *
 * The report is marked by the music itself: held down and thinned while the wash runs, it comes
 * back up and opens out when the report arrives. There is no jingle.
 *
 * The mixer works on any `BaseAudioContext`: the page gives it the live one and voices that
 * stream from `<audio>` elements (so that nineteen minutes of music are never decoded into
 * memory at once); the offline check (`offline.ts`) gives it an `OfflineAudioContext` and voices
 * that play decoded buffers, and renders the same schedule faster than real time.
 */

import { OPENING, PLAY, type Piece } from './manifest.ts';
import type { Scene } from './director.ts';
import {
  LOWPASS_SHARE,
  Sequencer,
  fadeCurve,
  type Change,
  type Segment,
  type SequencerOptions,
} from './sequencer.ts';

/** Where the sound of the files comes from: decoded buffers, or streaming elements. */
export interface VoiceSource {
  /** Fetches (and decodes, if it must) a file ahead of its use. */
  prepare(file: string): Promise<void>;
  ready(file: string): boolean;
  /** Plays `duration` seconds of a file from `offset`, starting at `at` on the audio clock. */
  play(file: string, offset: number, at: number, duration: number, into: AudioNode): Voice;
}

export interface Voice {
  /** Stops the voice at a time on the audio clock (its gain is at silence by then). */
  stop(at: number): void;
}

/** One voice the mixer has scheduled, for the checks and for "now playing". */
export interface Scheduled {
  readonly scene: Scene;
  readonly segment: Segment;
  /** When the voice starts on the audio clock. */
  readonly at: number;
  /** When it ends, and how long its fade out is: as planned, or as "next change now" made them. */
  ends: number;
  fadeOut: number;
}

/** A voice with the nodes that shape it. */
interface Sounding {
  readonly voice: Voice;
  readonly entry: Scheduled;
  readonly gain: GainNode;
  readonly filter: BiquadFilterNode;
  /** The fade in as it was scheduled (a voice whose file came late has a shorter one). */
  readonly fadeIn: number;
  readonly starts: number;
}

/** What the sound panel shows of the music. */
export interface MusicStatus {
  readonly playing: Piece | null;
  /** The piece that comes next and the seconds until it starts to come in; null when unknown. */
  readonly next: { readonly piece: Piece; readonly seconds: number } | null;
  /** True when "next change now" would do something at this moment. */
  readonly canSkip: boolean;
  /** The last changes heard, the newest first: seconds ago, and the two pieces. */
  readonly heard: readonly { readonly ago: number; readonly from: Piece; readonly to: Piece }[];
}

interface Deck {
  readonly scene: Scene;
  readonly gain: GainNode;
  readonly level: Slide;
  readonly sequencer: Sequencer;
  /** When the deck's timeline starts on the audio clock; null until its first file is ready. */
  origin: number | null;
  readonly voices: Sounding[];
  dead: boolean;
}

/** Seconds a deck takes to rise or to die away. */
export const SCENE_FADE = 3.6;
/** While the wash runs: the level of the music and the corner of the low-pass over it. */
export const DUCK_GAIN = 0.35;
export const DUCK_CUTOFF_HZ = 1100;
const OPEN_CUTOFF_HZ = 18000;
/** Seconds the music takes to sink under the wash and to come back. */
export const DUCK_FADE = 3;
/** "Go to the next change": how long before its exit the piece is taken up, and the fade into that. */
export const SKIP_LEAD = 10;
export const SKIP_FADE = 1.5;
/** Seconds before a planned change within which going there at once would gain nothing. */
const SKIP_MARGIN = SKIP_LEAD + SKIP_FADE + 4;

/**
 * A parameter that is only ever moved by ramps of known length, so that where it is at any time
 * is known here without asking the context (an offline context cannot be asked). A new ramp
 * starts from wherever the last one had got to: nothing steps, even if the game changes its mind
 * half way.
 */
export class Slide {
  private from: number;
  private to: number;
  private start = 0;
  private end = 0;

  constructor(
    private readonly param: AudioParam,
    value: number,
    private readonly exponential = false,
  ) {
    this.from = value;
    this.to = value;
    param.value = value;
  }

  /** Where the parameter is at a time. */
  at(time: number): number {
    if (time >= this.end) return this.to;
    if (time <= this.start) return this.from;
    const part = (time - this.start) / (this.end - this.start);
    return this.exponential
      ? this.from * (this.to / this.from) ** part
      : this.from + (this.to - this.from) * part;
  }

  /** Moves the parameter to `target` over `seconds`, starting at `time`. */
  move(target: number, time: number, seconds: number): void {
    const value = this.at(time);
    const under = time > this.start && time < this.end;
    this.param.cancelScheduledValues(time);
    // Cancelling takes away the ramp that was under way; the part of it already due is put back.
    if (under && this.exponential) this.param.exponentialRampToValueAtTime(value, time);
    else if (under) this.param.linearRampToValueAtTime(value, time);
    else this.param.setValueAtTime(value, time);
    if (this.exponential) this.param.exponentialRampToValueAtTime(target, time + seconds);
    else this.param.linearRampToValueAtTime(target, time + seconds);
    this.from = value;
    this.to = target;
    this.start = time;
    this.end = time + seconds;
  }
}

export class Mixer {
  /** Everything scheduled so far; the page trims it, the offline check reads all of it. */
  readonly log: Scheduled[] = [];
  /** Where the game's own sounds connect. */
  readonly soundsIn: GainNode;
  private readonly duck: GainNode;
  private readonly filter: BiquadFilterNode;
  private readonly music: GainNode;
  private readonly master: GainNode;
  private readonly duckLevel: Slide;
  private readonly cutoff: Slide;
  private readonly musicLevel: Slide;
  private readonly volume: Slide;
  private readonly curveIn = fadeCurve('in');
  private readonly curveOut = fadeCurve('out');
  private deck: Deck | null = null;
  /** The changes from piece to piece that have been heard, oldest first: when, and what. */
  private readonly heard: { at: number; from: Piece; to: Piece }[] = [];
  private noted = 0;

  constructor(
    private readonly context: BaseAudioContext,
    private readonly source: VoiceSource,
    private readonly random: () => number,
    private readonly options?: SequencerOptions,
  ) {
    this.duck = context.createGain();
    this.filter = context.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 0.5;
    this.music = context.createGain();
    this.master = context.createGain();
    this.soundsIn = context.createGain();
    this.duckLevel = new Slide(this.duck.gain, 1);
    this.cutoff = new Slide(this.filter.frequency, OPEN_CUTOFF_HZ, true);
    this.musicLevel = new Slide(this.music.gain, 1);
    this.volume = new Slide(this.master.gain, 1);
    this.duck.connect(this.filter).connect(this.music).connect(this.master);
    this.soundsIn.connect(this.master);
    this.master.connect(context.destination);
  }

  /** The scene whose deck is sounding, if any. */
  scene(): Scene | null {
    return this.deck?.scene ?? null;
  }

  /** The piece that is loudest at a time on the audio clock, for "now playing". */
  playing(at: number): Segment | null {
    let best: Segment | null = null;
    for (const entry of this.log) {
      const into = at - entry.at;
      if (entry.scene !== this.deck?.scene || into < 0 || at > entry.ends) continue;
      if (best === null || into > entry.segment.fadeIn / 2) best = entry.segment;
    }
    return best;
  }

  /**
   * Starts the music of a scene at `at`, letting whatever was playing die away; null stops the
   * music. The new deck starts when its first file is ready.
   */
  setScene(scene: Scene | null, at: number): void {
    const old = this.deck;
    if (old !== null) {
      old.dead = true;
      old.level.move(0, at, SCENE_FADE);
      for (const { voice } of old.voices) voice.stop(at + SCENE_FADE + 0.1);
      this.noted = 0;
    }
    this.deck = null;
    if (scene === null) return;
    const gain = this.context.createGain();
    const level = new Slide(gain.gain, 0);
    gain.connect(this.duck);
    const pieces = scene === 'menu' ? [OPENING] : PLAY;
    this.noted = 0;
    const deck: Deck = {
      scene,
      gain,
      level,
      sequencer: new Sequencer(pieces, this.random, this.options),
      origin: null,
      voices: [],
      dead: false,
    };
    this.deck = deck;
    const first = deck.sequencer.peek().piece.file;
    const begin = (): void => {
      if (deck.dead) return;
      const origin = Math.max(at, this.context.currentTime + 0.05);
      deck.origin = origin;
      level.move(1, origin, SCENE_FADE);
    };
    if (this.source.ready(first)) begin();
    else void this.source.prepare(first).then(begin, () => undefined);
  }

  /**
   * Schedules every voice of the current deck that starts before `until` on the audio clock, and
   * has the file after those fetched. The page calls this a few times a second with a horizon a
   * few seconds off; the offline check calls it once with the end of the render.
   */
  fill(until: number): void {
    const deck = this.deck;
    if (deck === null || deck.origin === null) return;
    for (;;) {
      const upcoming = deck.sequencer.peek();
      if (!this.source.ready(upcoming.piece.file)) {
        void this.source.prepare(upcoming.piece.file).catch(() => undefined);
      }
      if (deck.origin + upcoming.start >= until) return;
      // A file that is still on its way is waited for, not skipped: the voice starts late.
      if (!this.source.ready(upcoming.piece.file)) return;
      this.schedule(deck, deck.sequencer.next(), deck.origin);
    }
  }

  private schedule(deck: Deck, segment: Segment, origin: number): void {
    const context = this.context;
    let at = origin + segment.start;
    let offset = segment.offset;
    let duration = segment.duration;
    // A voice whose file arrived late joins where it would have been by now.
    const late = context.currentTime + 0.02 - at;
    if (late > 0) {
      at += late;
      offset += late;
      duration -= late;
    }
    const fadeIn = Math.max(0, Math.min(segment.fadeIn, duration - segment.fadeOut - 0.01));
    if (duration <= segment.fadeOut + 0.05) return;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0;
    filter.frequency.value = OPEN_CUTOFF_HZ;
    const gain = context.createGain();
    const solo = this.options?.solo;
    const trim = solo !== undefined && solo !== segment.piece.id ? 0 : segment.piece.gain;
    if (trim !== undefined && trim !== 1) {
      const level = context.createGain();
      level.gain.value = trim;
      filter.connect(gain).connect(level).connect(deck.gain);
    } else {
      filter.connect(gain).connect(deck.gain);
    }
    if (fadeIn > 0) {
      gain.gain.value = 0;
      gain.gain.setValueAtTime(0, at);
      gain.gain.setValueCurveAtTime(this.curveIn, at, fadeIn);
    } else {
      gain.gain.value = 1;
    }
    const ends = at + duration;
    this.fadeOut(gain, filter, ends - segment.fadeOut, segment.fadeOut, segment.closeTo);
    const voice = this.source.play(segment.piece.file, offset, at, duration, filter);
    const entry: Scheduled = {
      scene: deck.scene,
      segment,
      at: origin + segment.start,
      ends,
      fadeOut: segment.fadeOut,
    };
    deck.voices.push({ voice, entry, gain, filter, fadeIn, starts: at });
    this.log.push(entry);
  }

  /** Schedules the fade out of a voice from full level, with the low-pass closing over it. */
  private fadeOut(
    gain: GainNode,
    filter: BiquadFilterNode,
    from: number,
    seconds: number,
    closeTo: number,
  ): void {
    gain.gain.setValueCurveAtTime(this.curveOut, from, seconds);
    if (closeTo > 0) {
      filter.frequency.setValueAtTime(OPEN_CUTOFF_HZ, from);
      filter.frequency.exponentialRampToValueAtTime(closeTo, from + seconds * LOWPASS_SHARE);
    }
  }

  /** The voice of the current deck that is at full level at a time, if one is. */
  private steady(now: number): Sounding | null {
    const deck = this.deck;
    if (deck === null) return null;
    let found: Sounding | null = null;
    for (const sounding of deck.voices) {
      const { entry, starts, fadeIn } = sounding;
      if (starts + fadeIn > now || now >= entry.ends - entry.fadeOut - 0.2) continue;
      if (found === null || starts > found.starts) found = sounding;
    }
    return found;
  }

  /** The change out of a visit of the current deck, on the audio clock; null when not planned. */
  private changeAfter(visit: number): { change: Change; at: number } | null {
    const deck = this.deck;
    if (deck === null || deck.origin === null) return null;
    const change = deck.sequencer.changes[visit];
    return change === undefined ? null : { change, at: deck.origin + change.at };
  }

  /** True when "go to the next change" would do something: one piece is sounding alone and steadily, and its change is not already near. */
  canSkip(now: number): boolean {
    const deck = this.deck;
    const steady = this.steady(now);
    if (deck === null || steady === null) return false;
    const visit = steady.entry.segment.visit;
    const planned = this.changeAfter(visit);
    if (planned === null) return false;
    if (planned.at - planned.change.join.delay - now < SKIP_MARGIN) return false;
    // Nothing of a later visit may be scheduled yet (what is scheduled cannot be moved), and
    // the piece before must have gone: a third voice is never brought in over two.
    return !deck.voices.some(
      (v) => v.entry.segment.visit > visit || (v.entry.segment.visit < visit && v.entry.ends > now),
    );
  }

  /**
   * Goes to the next change of piece: the piece sounding jumps to `SKIP_LEAD` seconds before
   * its exit (a short crossfade of the piece into itself), plays its ending from there and
   * hands over to the next piece exactly as it would have: the same exit, the same join. So
   * the changes can be heard one after another without waiting minutes for each. Whatever
   * was left of the piece (its repeats) is dropped. Returns false when there is nothing to do
   * (see `canSkip`).
   */
  skip(now: number): boolean {
    const deck = this.deck;
    const steady = this.steady(now);
    if (deck === null || deck.origin === null || steady === null || !this.canSkip(now)) {
      return false;
    }
    const segment = steady.entry.segment;
    const visit = segment.visit;
    const from = now + 0.05;
    // The ending starts under a short fade, and the piece reaches its exit SKIP_LEAD later.
    const leaves = from + SKIP_FADE + SKIP_LEAD;
    const change = deck.sequencer.skip(visit, leaves - deck.origin);
    if (change === null) return false;
    for (let i = deck.voices.length - 1; i >= 0; i--) {
      const sounding = deck.voices[i] as Sounding;
      if (sounding === steady || sounding.entry.segment.visit !== visit) continue;
      if (sounding.starts <= now) continue;
      // A repeat of the piece that was scheduled and has not started: it never sounds.
      sounding.gain.gain.cancelScheduledValues(0);
      sounding.gain.gain.value = 0;
      sounding.voice.stop(now);
      deck.voices.splice(i, 1);
      const logged = this.log.indexOf(sounding.entry);
      if (logged >= 0) this.log.splice(logged, 1);
    }
    const { gain, filter, entry, voice } = steady;
    // The voice is at full level: the fade out it had planned is taken away and a short one
    // from here put in its place, under which the piece's own ending starts.
    gain.gain.cancelScheduledValues(from);
    filter.frequency.cancelScheduledValues(from);
    gain.gain.setValueAtTime(1, from);
    this.fadeOut(gain, filter, from, SKIP_FADE, 0);
    entry.ends = from + SKIP_FADE;
    entry.fadeOut = SKIP_FADE;
    voice.stop(entry.ends + 0.1);
    const piece = segment.piece;
    this.schedule(
      deck,
      {
        piece,
        offset: piece.exit - SKIP_LEAD - SKIP_FADE,
        start: from - deck.origin,
        duration: SKIP_FADE + SKIP_LEAD + change.join.out,
        fadeIn: SKIP_FADE,
        fadeOut: change.join.out,
        closeTo: change.join.closeTo,
        kind: 'repeat',
        visit,
      },
      deck.origin,
    );
    this.fill(leaves + change.join.out + 1);
    return true;
  }

  /** What the sound panel shows: what is playing, what comes next and when, what was heard. */
  status(now: number): MusicStatus {
    const deck = this.deck;
    const playing = this.playing(now)?.piece ?? null;
    let next: MusicStatus['next'] = null;
    if (deck !== null && deck.origin !== null) {
      for (const change of deck.sequencer.changes) {
        const at = deck.origin + change.at;
        if (at > now) {
          next = { piece: change.to, seconds: at - now };
          break;
        }
      }
    }
    return {
      playing,
      next,
      canSkip: this.canSkip(now),
      heard: this.heard
        .slice(-5)
        .reverse()
        .map((h) => ({ ago: now - h.at, from: h.from, to: h.to })),
    };
  }

  /** Forgets voices that have ended and log entries nobody will ask about; notes the changes heard. */
  tidy(now: number): void {
    const deck = this.deck;
    if (deck !== null) {
      for (let i = deck.voices.length - 1; i >= 0; i--) {
        const entry = deck.voices[i];
        if (entry !== undefined && entry.entry.ends < now - 1) deck.voices.splice(i, 1);
      }
      if (deck.origin !== null) {
        const changes = deck.sequencer.changes;
        while (this.noted < changes.length) {
          const change = changes[this.noted] as Change;
          const at = deck.origin + change.at;
          if (at > now) break;
          this.heard.push({ at, from: change.from, to: change.to });
          this.noted += 1;
        }
        while (this.heard.length > 8) this.heard.shift();
      }
    }
    while (this.log.length > 24) this.log.shift();
  }

  /** Holds the music down and thins it while the wash runs, or lets it back. */
  setDuck(on: boolean, at: number): void {
    this.duckLevel.move(on ? DUCK_GAIN : 1, at, DUCK_FADE);
    this.cutoff.move(on ? DUCK_CUTOFF_HZ : OPEN_CUTOFF_HZ, at, DUCK_FADE);
  }

  /** Music on or off: a short slide, not a switch. */
  setMusic(on: boolean, at: number): void {
    this.musicLevel.move(on ? 1 : 0, at, 0.4);
  }

  /** The volume of everything, 0 to 1 on the slider, squared so that the middle is the middle. */
  setVolume(volume: number, at: number): void {
    const clamped = Math.min(1, Math.max(0, volume));
    this.volume.move(clamped * clamped, at, 0.06);
  }
}

/** Voices that play decoded buffers: the offline check, and anything short. */
export class BufferSource implements VoiceSource {
  private readonly buffers = new Map<string, AudioBuffer>();

  constructor(
    private readonly context: BaseAudioContext,
    private readonly load: (file: string) => Promise<AudioBuffer>,
  ) {}

  set(file: string, buffer: AudioBuffer): void {
    this.buffers.set(file, buffer);
  }

  async prepare(file: string): Promise<void> {
    if (!this.buffers.has(file)) this.buffers.set(file, await this.load(file));
  }

  ready(file: string): boolean {
    return this.buffers.has(file);
  }

  play(file: string, offset: number, at: number, duration: number, into: AudioNode): Voice {
    const node = this.context.createBufferSource();
    node.buffer = this.buffers.get(file) ?? null;
    node.connect(into);
    node.start(at, offset, duration);
    return { stop: (when) => node.stop(when) };
  }
}
