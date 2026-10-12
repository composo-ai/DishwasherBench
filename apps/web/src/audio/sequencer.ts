/**
 * The order of the music, as plain data: which piece sounds when, from where in its file, for
 * how long, and how it fades in and out. Nothing here touches the Web Audio API, so the whole of
 * it runs in a test without a browser; the mixer (`mixer.ts`) plays what this plans.
 *
 * A piece is not played from top to bottom like a record. A *visit* to a piece enters it at its
 * beginning or (where the piece allows it) straight at its loop, plays its middle one to three
 * times, goes on to its exit point and hands over from there to the next piece. Which piece
 * comes next is drawn at random, never the one just heard, seldom the one before it, and by
 * preference one whose harmony sits well with the piece being left; it is drawn a visit ahead,
 * so the page can say what comes next.
 *
 * There are two kinds of join, and they are not alike:
 *
 *  - A piece repeating its own middle fades the end of its loop into the start of it with a
 *    short equal-power crossfade between two places measured to be alike in harmony and level.
 *  - One piece handing over to another does not hold the two at full level together: two
 *    unrelated harmonies sounding at once for eight seconds is what was heard as rough. The
 *    piece being left *recedes*: its gain falls over `out` seconds and a low-pass closes over
 *    it as it goes, so that what is left of it is a soft bed. The next piece comes in under it
 *    `delay` seconds into that, from silence, over `in` seconds. A pair that does agree in
 *    harmony may be given a plain equal-power crossfade instead (`delay` 0, no low-pass).
 *
 * Every fade is the sine or the cosine of a quarter turn, and each voice starts and ends at
 * gain zero.
 */

import { AGREEMENT, CLASH, CLASH_LIMIT, FIRST_CUES, type Piece } from './manifest.ts';

/** A stretch of one file played by one voice. Times in seconds. */
export interface Segment {
  readonly piece: Piece;
  /** Where in the file the voice starts. */
  readonly offset: number;
  /** When the voice starts, from the start of the timeline. */
  readonly start: number;
  readonly duration: number;
  /** Length of the fade from silence at the start, and of the fade to silence at the end. */
  readonly fadeIn: number;
  readonly fadeOut: number;
  /**
   * Where a low-pass over the voice closes to while it fades out, hertz; 0 for none. The corner
   * falls from the top of hearing to this over the first `LOWPASS_SHARE` of the fade.
   */
  readonly closeTo: number;
  /** Why the voice starts: a new piece is entered, or the piece repeats its middle. */
  readonly kind: 'enter' | 'repeat';
  /** Which visit of the timeline the segment belongs to, counted from 0. */
  readonly visit: number;
}

/** The share of a receding fade over which its low-pass closes. */
export const LOWPASS_SHARE = 0.6;

/** How one piece hands over to the next. Seconds; `closeTo` in hertz. */
export interface Join {
  /** How long the piece being left takes to die away. */
  readonly out: number;
  /** How far into that the next piece starts to come in. */
  readonly delay: number;
  /** How long the next piece takes to come up. */
  readonly in: number;
  /** Where the low-pass over the piece being left closes to; 0 for none. */
  readonly closeTo: number;
}

/** A change from one piece to another on the timeline. */
export interface Change {
  /** When the next piece starts to come in. */
  readonly at: number;
  readonly from: Piece;
  readonly to: Piece;
  readonly join: Join;
}

/** How the visits are drawn. */
export interface SequencerOptions {
  /** How a piece hands over to one whose harmony does not agree with it (the usual case). */
  readonly join: Join;
  /** How it hands over to one that does agree. */
  readonly agreeJoin: Join;
  /** Agreement in harmony (0 to 1, `AGREEMENT` of the manifest) from which a pair counts as agreeing. */
  readonly agreeFrom: number;
  /** Seconds of the crossfade of a piece into itself. */
  readonly loopCrossfade: number;
  /** Chance of playing the middle once, twice, three times… (weights, need not sum to one). */
  readonly passWeights: readonly number[];
  /** Chance that a visit other than the first enters at the loop, skipping the introduction. */
  readonly enterAtLoop: number;
  /** Seconds a visit may last: a long piece repeats its middle less often, or not at all. */
  readonly longestVisit: number;
  /**
   * For the checks: the first visits as given, not drawn. `from` starts the visit's first
   * voice at that place of the file (so that a join can be reached without playing the piece
   * through); `passes` and `atLoop` as a draw would give them.
   */
  readonly script?: readonly {
    readonly id: string;
    readonly atLoop?: boolean;
    readonly passes?: number;
    readonly from?: number;
  }[];
  /** For the checks: only the voices of this piece sound. */
  readonly solo?: string;
  /** For the checks: the cue points as they were on the first morning (`FIRST_CUES`). */
  readonly firstCues?: boolean;
}

/** A piece as these options play it: with its present cue points, or the first morning's. */
export function pieceFor(piece: Piece, options: SequencerOptions): Piece {
  const first = options.firstCues === true ? FIRST_CUES[piece.id] : undefined;
  if (first === undefined) return piece;
  // None of what was added since: the entry fade, the timing of the join, the trim.
  const {
    settle: _settle,
    lead: _lead,
    fadeIn: _fadeIn,
    midEntry: _midEntry,
    gain: _gain,
    loopFade: _loopFade,
    ...rest
  } = piece;
  return { ...rest, ...first };
}

export const DEFAULT_OPTIONS: SequencerOptions = {
  // Measured with `scripts/audio/analyse-joins.py`; the figures are in its output.
  join: { out: 10, delay: 2, in: 5, closeTo: 280 },
  agreeJoin: { out: 9, delay: 1, in: 6, closeTo: 700 },
  agreeFrom: 0.9,
  loopCrossfade: 3,
  passWeights: [0.4, 0.4, 0.2],
  enterAtLoop: 0.35,
  // A play session lasted 8 to 13 minutes: no piece should fill one.
  longestVisit: 480,
};

/**
 * The joins as they were on the morning of 11 October 2026, when the changes from piece to
 * piece were found rough: every join an eight-second equal-power crossfade. Kept so that the
 * same measurements can be made of both.
 */
export const FIRST_OPTIONS: SequencerOptions = {
  join: { out: 8, delay: 0, in: 8, closeTo: 0 },
  agreeJoin: { out: 8, delay: 0, in: 8, closeTo: 0 },
  agreeFrom: 2,
  loopCrossfade: 8,
  passWeights: [0.4, 0.4, 0.2],
  enterAtLoop: 0.35,
  longestVisit: 480,
  firstCues: true,
};

/** The longest fade out a join of these options can ask for. */
function longestOut(options: SequencerOptions): number {
  return Math.max(options.join.out, options.agreeJoin.out);
}

/** How well the harmony of the place a piece is left at sits with the place the next is entered at, 0 to 1. */
export function agreement(from: Piece, to: Piece, atLoop: boolean): number {
  return AGREEMENT[`${from.id}>${to.id}${atLoop ? '@loop' : ''}`] ?? 0.5;
}

/** The join for a pair. */
export function joinFor(
  from: Piece,
  to: Piece,
  atLoop: boolean,
  options: SequencerOptions = DEFAULT_OPTIONS,
): Join {
  const join = agreement(from, to, atLoop) >= options.agreeFrom ? options.agreeJoin : options.join;
  // The next piece is to be up `settle` seconds after the exit of the one being left, and takes
  // `lead` seconds to come up by itself: it starts that much sooner. Once it is up, the piece
  // being left has `AFTER_UP` seconds more to go: a longer tail only keeps two harmonies
  // sounding together.
  if (from.settle === undefined) return join;
  const delay = Math.max(0, from.settle - (atLoop ? 0 : (to.lead ?? 0)));
  const out = Math.min(join.out, Math.max(SHORTEST_OUT, from.settle + AFTER_UP));
  return { ...join, delay, out };
}

/** Seconds a piece being left still sounds after the next one is up, and its shortest fade. */
const AFTER_UP = 3.5;
const SHORTEST_OUT = 5;

/** A small seeded generator (mulberry32): the same seed gives the same music. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seconds of the crossfade of a piece into itself: its own, or the options'. */
export function loopFadeOf(piece: Piece, options: SequencerOptions = DEFAULT_OPTIONS): number {
  return piece.loopFade ?? options.loopCrossfade;
}

/** Says what is wrong with a piece's cue points for the given crossfades, or null. */
export function cueProblem(
  piece: Piece,
  options: SequencerOptions = DEFAULT_OPTIONS,
): string | null {
  const loopCrossfade = loopFadeOf(piece, options);
  const out = longestOut(options);
  if (!(piece.in >= 0 && piece.in < piece.loopStart)) return 'the loop starts before the piece';
  if (!(piece.loopEnd - piece.loopStart >= 3 * loopCrossfade)) return 'the loop is too short';
  if (!(piece.loopEnd < piece.exit)) return 'the exit is inside the loop';
  if (!(piece.loopEnd + loopCrossfade <= piece.end))
    return 'no room for the loop crossfade after the loop';
  if (!(piece.exit + out <= piece.end)) return 'no room for the fade out after the exit';
  if (!(piece.end <= piece.duration)) return 'the end is past the file';
  return null;
}

function weighted(random: () => number, weights: readonly number[]): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let at = random() * total;
  for (let i = 0; i < weights.length; i++) {
    at -= weights[i] ?? 0;
    if (at < 0) return i;
  }
  return weights.length - 1;
}

/** The seconds of clash left in the change from one piece to another as it is joined now. */
export function clashOf(from: Piece, to: Piece): number {
  return CLASH[`${from.id}>${to.id}`] ?? 1;
}

/**
 * Draws the next piece: never the last one; the one before it at a quarter of the others'
 * chance, so that A B A B does not take hold; the cleaner changes more often than the rougher
 * (in inverse proportion to the clash that is left in them); and never a pair whose change
 * cannot be made clean (over `CLASH_LIMIT`) while there is another to go to. With a single
 * piece there is nothing to draw. `lean` false draws as on the first morning, evenly.
 */
export function drawNext(
  pieces: readonly Piece[],
  history: readonly string[],
  random: () => number,
  lean = true,
): Piece {
  const last = history[history.length - 1];
  const before = history[history.length - 2];
  const candidates = pieces.filter((p) => p.id !== last);
  const from = lean ? pieces.find((p) => p.id === last) : undefined;
  const clean =
    from === undefined ? candidates : candidates.filter((p) => clashOf(from, p) <= CLASH_LIMIT);
  const pool = clean.length > 0 ? clean : candidates.length > 0 ? candidates : pieces;
  const weights = pool.map(
    (p) =>
      (p.id === before && pool.length > 1 ? 0.25 : 1) *
      (from === undefined ? 1 : 1 / (0.5 + clashOf(from, p))),
  );
  const piece = pool[weighted(random, weights)];
  if (piece === undefined) throw new Error('audio: no piece to play');
  return piece;
}

/**
 * The segments of one visit to a piece, the first starting at `start` with a fade of `fadeIn`.
 * The last of them fades out as `leave` says (the join into the next piece).
 */
export function planVisit(
  piece: Piece,
  start: number,
  fadeIn: number,
  passes: number,
  atLoop: boolean,
  options: SequencerOptions = DEFAULT_OPTIONS,
  leave: Join = options.join,
  visit = 0,
  from?: number,
): Segment[] {
  const loopCrossfade = loopFadeOf(piece, options);
  const segments: Segment[] = [];
  let offset = from ?? (atLoop ? piece.loopStart : piece.in);
  let at = start;
  let fade = fadeIn;
  for (let pass = 1; pass <= passes; pass++) {
    const last = pass === passes;
    // The last pass runs on to the exit and through its fade out, under which the next piece
    // comes in; the others stop a crossfade past the end of the loop, under which the middle
    // starts again.
    const until = last ? piece.exit + leave.out : piece.loopEnd + loopCrossfade;
    const fadeOut = last ? leave.out : loopCrossfade;
    const duration = until - offset;
    segments.push({
      piece,
      offset,
      start: at,
      duration,
      fadeIn: fade,
      fadeOut,
      closeTo: last ? leave.closeTo : 0,
      kind: pass === 1 ? 'enter' : 'repeat',
      visit,
    });
    at += duration - fadeOut;
    offset = piece.loopStart;
    fade = fadeOut;
  }
  return segments;
}

/** How long a visit lasts from its entry to the start of its fade into the next piece. */
export function visitSeconds(piece: Piece, passes: number, atLoop: boolean): number {
  const entry = atLoop ? piece.loopStart : piece.in;
  return piece.exit - entry + (passes - 1) * (piece.loopEnd - piece.loopStart);
}

/** When a segment begins to fade out. */
export function handover(segment: Segment): number {
  return segment.start + segment.duration - segment.fadeOut;
}

interface Drawn {
  readonly piece: Piece;
  readonly atLoop: boolean;
  readonly passes: number;
  readonly from?: number;
}

/**
 * An endless timeline of segments over a set of pieces. With one piece (the opening screen) the
 * piece is entered once and its middle repeats for as long as anyone listens.
 */
export class Sequencer {
  /** The changes from piece to piece planned so far, in order of time. */
  readonly changes: Change[] = [];
  private readonly history: string[] = [];
  private readonly queue: Segment[] = [];
  private at = 0;
  private fade = 0;
  private first = true;
  private visits = 0;
  /** The visit after the one planned last: drawn ahead, so that the join into it is known. */
  private upcoming: Drawn | null = null;
  private readonly pieces: readonly Piece[];

  constructor(
    pieces: readonly Piece[],
    private readonly random: () => number,
    private readonly options: SequencerOptions = DEFAULT_OPTIONS,
  ) {
    if (pieces.length === 0) throw new Error('audio: a sequencer needs at least one piece');
    this.pieces = pieces.map((piece) => pieceFor(piece, options));
    for (const piece of this.pieces) {
      const problem = cueProblem(piece, options);
      if (problem !== null) throw new Error(`audio: ${piece.id}: ${problem}`);
    }
  }

  /** The ids of the pieces visited so far, in order. */
  visited(): readonly string[] {
    return this.history;
  }

  /** The next segment of the timeline; they come in order of their start. */
  next(): Segment {
    if (this.queue.length === 0) this.plan();
    const segment = this.queue.shift();
    if (segment === undefined) throw new Error('audio: nothing planned');
    return segment;
  }

  /** The segment `next()` will return, without taking it. */
  peek(): Segment {
    if (this.queue.length === 0) this.plan();
    const segment = this.queue[0];
    if (segment === undefined) throw new Error('audio: nothing planned');
    return segment;
  }

  /**
   * Goes to the next piece now: whatever is left of visit `visit` is dropped, and the change
   * out of it is moved to `time` (the moment its fade out begins), with everything planned
   * after it. Returns that change, or null when there is none to move (a single piece, or the
   * change is not planned or is not after `time`).
   */
  skip(visit: number, time: number): Change | null {
    // One change is planned for every visit, so the change out of a visit has its number.
    const index = visit;
    const change = this.changes[index];
    if (change === undefined) return null;
    const starts = change.at - change.join.delay;
    if (!(starts > time)) return null;
    const shift = starts - time;
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const segment = this.queue[i] as Segment;
      if (segment.visit <= visit) this.queue.splice(i, 1);
      else this.queue[i] = { ...segment, start: segment.start - shift };
    }
    for (let i = index; i < this.changes.length; i++) {
      const later = this.changes[i] as Change;
      this.changes[i] = { ...later, at: later.at - shift };
    }
    this.at -= shift;
    return this.changes[index] as Change;
  }

  private draw(): Drawn {
    const { options, random } = this;
    const scripted = options.script?.[this.history.length];
    if (scripted !== undefined) {
      const piece = this.pieces.find((p) => p.id === scripted.id);
      if (piece === undefined) throw new Error(`audio: no piece ${scripted.id}`);
      this.history.push(piece.id);
      return {
        piece,
        atLoop: scripted.atLoop === true,
        passes: scripted.passes ?? 1,
        ...(scripted.from === undefined ? {} : { from: scripted.from }),
      };
    }
    const piece = drawNext(this.pieces, this.history, random, options.firstCues !== true);
    this.history.push(piece.id);
    const atLoop =
      this.history.length > 1 && piece.midEntry !== false && random() < options.enterAtLoop;
    let passes = 1 + weighted(random, options.passWeights);
    while (passes > 1 && visitSeconds(piece, passes, atLoop) > options.longestVisit) passes--;
    return { piece, atLoop, passes };
  }

  private plan(): void {
    const { options } = this;
    const only = this.pieces.length === 1 ? this.pieces[0] : undefined;
    if (only !== undefined) {
      // One piece: enter it once, then repeat its middle for ever.
      const offset = this.first ? only.in : only.loopStart;
      const loopCrossfade = loopFadeOf(only, options);
      const duration = only.loopEnd + loopCrossfade - offset;
      this.queue.push({
        piece: only,
        offset,
        start: this.at,
        duration,
        fadeIn: this.fade,
        fadeOut: loopCrossfade,
        closeTo: 0,
        kind: this.first ? 'enter' : 'repeat',
        visit: 0,
      });
      if (this.first) this.history.push(only.id);
      this.at += duration - loopCrossfade;
      this.fade = loopCrossfade;
      this.first = false;
      return;
    }
    const current = this.upcoming ?? this.draw();
    const next = this.draw();
    this.upcoming = next;
    const join = joinFor(current.piece, next.piece, next.atLoop, options);
    const visit = planVisit(
      current.piece,
      this.at,
      this.fade,
      current.passes,
      current.atLoop,
      options,
      join,
      this.visits,
      current.from,
    );
    const last = visit[visit.length - 1];
    if (last === undefined) throw new Error('audio: an empty visit');
    this.queue.push(...visit);
    this.at = handover(last) + join.delay;
    // A piece that begins from silence by itself is not faded in for long on top of that.
    this.fade = next.atLoop ? join.in : Math.min(join.in, next.piece.fadeIn ?? join.in);
    this.changes.push({ at: this.at, from: current.piece, to: next.piece, join });
    this.visits += 1;
    this.first = false;
  }
}

/** Points of an equal-power fade: the sine of a quarter turn (in) or the cosine (out). */
export function fadeCurve(direction: 'in' | 'out', points = 257): Float32Array {
  const curve = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const angle = (i / (points - 1)) * (Math.PI / 2);
    curve[i] = direction === 'in' ? Math.sin(angle) : Math.cos(angle);
  }
  // The ends are exact: a voice starts and stops at silence.
  curve[direction === 'in' ? 0 : points - 1] = 0;
  curve[direction === 'in' ? points - 1 : 0] = 1;
  return curve;
}

/** The gain of a segment's voice at a time on the timeline (what the mixer's curves amount to). */
export function gainAt(segment: Segment, time: number): number {
  const into = time - segment.start;
  if (into < 0 || into > segment.duration) return 0;
  if (into < segment.fadeIn) return Math.sin((into / segment.fadeIn) * (Math.PI / 2));
  const left = segment.duration - into;
  if (left < segment.fadeOut) return Math.sin((left / segment.fadeOut) * (Math.PI / 2));
  return 1;
}
