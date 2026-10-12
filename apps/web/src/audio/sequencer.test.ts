import { describe, expect, it } from 'vitest';
import { CLASH, CLASH_LIMIT, FIRST_CUES, OPENING, PLAY, type Piece } from './manifest.ts';
import {
  DEFAULT_OPTIONS,
  FIRST_OPTIONS,
  Sequencer,
  clashOf,
  cueProblem,
  drawNext,
  joinFor,
  pieceFor,
  fadeCurve,
  gainAt,
  handover,
  planVisit,
  seededRandom,
  visitSeconds,
  type Segment,
} from './sequencer.ts';

function take(sequencer: Sequencer, count: number): Segment[] {
  return Array.from({ length: count }, () => sequencer.next());
}

/** The segments of a timeline up to a time, and the ones sounding at a time. */
function upTo(sequencer: Sequencer, seconds: number): Segment[] {
  const segments: Segment[] = [];
  while (sequencer.peek().start < seconds) segments.push(sequencer.next());
  return segments;
}

describe('the manifest', () => {
  it('gives every piece cue points that leave room for the crossfades', () => {
    for (const piece of [OPENING, ...PLAY]) expect(cueProblem(piece), piece.id).toBeNull();
  });

  it('has one opening piece and four to six pieces of play, none twice', () => {
    expect(PLAY.length).toBeGreaterThanOrEqual(4);
    expect(PLAY.length).toBeLessThanOrEqual(6);
    const ids = [OPENING, ...PLAY].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('refuses cue points that would cut a crossfade short', () => {
    const piece = PLAY[0] as Piece;
    expect(cueProblem({ ...piece, exit: piece.end - 1 })).toMatch(/no room/);
    expect(cueProblem({ ...piece, loopEnd: piece.exit + 1 })).toMatch(/exit/);
    expect(cueProblem({ ...piece, loopEnd: piece.end - 1, exit: piece.end })).toMatch(/loop/);
    expect(cueProblem({ ...piece, loopStart: piece.loopEnd - 5 })).toMatch(/too short/);
    // The cue points of the first morning fit the joins of the first morning.
    for (const p of PLAY) {
      expect(cueProblem({ ...p, ...FIRST_CUES[p.id] }, FIRST_OPTIONS), p.id).toBeNull();
    }
    expect(() => new Sequencer([{ ...piece, exit: piece.end }], seededRandom(1))).toThrow();
  });
});

describe('a visit to a piece', () => {
  const piece = PLAY[1] as Piece;
  const { loopCrossfade, join } = DEFAULT_OPTIONS;

  it('played once runs from the entry to the exit and through its fade out', () => {
    const [only, ...rest] = planVisit(piece, 100, 0.4, 1, false);
    expect(rest).toHaveLength(0);
    expect(only).toMatchObject({
      offset: piece.in,
      start: 100,
      fadeIn: 0.4,
      fadeOut: join.out,
      closeTo: join.closeTo,
    });
    expect((only as Segment).offset + (only as Segment).duration).toBeCloseTo(
      piece.exit + join.out,
    );
    expect(handover(only as Segment)).toBeCloseTo(100 + piece.exit - piece.in);
  });

  it('repeats its middle by a short fade of the end of the loop into its start', () => {
    const visit = planVisit(piece, 0, 0, 3, false);
    expect(visit.map((s) => s.kind)).toEqual(['enter', 'repeat', 'repeat']);
    const [first, second, third] = visit as [Segment, Segment, Segment];
    // The first voice plays on a crossfade past the end of the loop…
    expect(first.offset + first.duration).toBeCloseTo(piece.loopEnd + loopCrossfade);
    // …and the second starts at the loop's start exactly when the first reaches the loop's end.
    expect(second.offset).toBe(piece.loopStart);
    expect(second.start).toBeCloseTo(first.start + piece.loopEnd - piece.in);
    expect(second.fadeIn).toBe(loopCrossfade);
    expect(second.duration).toBeCloseTo(piece.loopEnd - piece.loopStart + loopCrossfade);
    // A piece into itself is not the long handover between pieces, and nothing closes over it.
    expect(loopCrossfade).toBeLessThanOrEqual(4);
    expect(first.closeTo).toBe(0);
    expect(second.closeTo).toBe(0);
    // The last pass goes on to the exit and recedes.
    expect(third.offset + third.duration).toBeCloseTo(piece.exit + join.out);
    expect(third.fadeOut).toBe(join.out);
    expect(third.closeTo).toBeGreaterThan(0);
  });

  it('may skip the introduction', () => {
    const [first] = planVisit(piece, 0, 8, 2, true);
    expect(first?.offset).toBe(piece.loopStart);
  });

  it('never plays past the last sound of the file', () => {
    for (const p of PLAY) {
      for (const passes of [1, 2, 3]) {
        for (const segment of planVisit(p, 0, 0.4, passes, false)) {
          expect(segment.offset + segment.duration).toBeLessThanOrEqual(p.end + 1e-9);
          expect(segment.fadeIn + segment.fadeOut).toBeLessThan(segment.duration);
        }
      }
    }
  });
});

describe('a change from one piece to another', () => {
  it('lets the piece being left recede and brings the next in under it, later and from silence', () => {
    for (const from of PLAY) {
      for (const to of PLAY) {
        if (from === to) continue;
        const j = joinFor(from, to, false);
        // The next piece does not start with the fade out: it starts into it, or with it for
        // a piece that takes seconds to come up by itself.
        expect(j.delay).toBeGreaterThanOrEqual(0);
        expect(j.delay).toBeLessThan(j.out);
        // A low-pass closes over the piece being left.
        expect(j.closeTo).toBeGreaterThan(100);
        expect(j.closeTo).toBeLessThan(600);
        // The piece being left is gone within a few seconds of the next being up.
        expect(j.out - (from.settle ?? j.delay)).toBeLessThanOrEqual(4);
        expect(from.exit + j.out).toBeLessThanOrEqual(from.end);
      }
    }
  });

  it('times the entry by how the first piece ends and how the second begins', () => {
    const [deep, budding, starfield, sunset] = PLAY as [Piece, Piece, Piece, Piece];
    // Sunset Plains holds its level past its exit: what follows waits longest…
    expect(joinFor(sunset, budding, false).delay).toBeGreaterThan(
      joinFor(starfield, budding, false).delay,
    );
    // …and Sunset Plains itself swells in slowly, so it starts soonest.
    expect(joinFor(deep, sunset, false).delay).toBeLessThan(joinFor(deep, budding, false).delay);
  });

  it('was an eight-second equal-power crossfade on the first morning, for every pair', () => {
    for (const from of PLAY) {
      for (const to of PLAY) {
        if (from === to) continue;
        const was = (piece: Piece): Piece => pieceFor(piece, FIRST_OPTIONS);
        expect(joinFor(was(from), was(to), false, FIRST_OPTIONS)).toEqual({
          out: 8,
          delay: 0,
          in: 8,
          closeTo: 0,
        });
      }
    }
  });
});

describe('the order of the pieces', () => {
  it('never plays a piece twice running, over two thousand visits', () => {
    const random = seededRandom(7);
    const history: string[] = [];
    for (let i = 0; i < 2000; i++) history.push(drawNext(PLAY, history, random).id);
    for (let i = 1; i < history.length; i++) expect(history[i]).not.toBe(history[i - 1]);
    for (const piece of PLAY) {
      const share = history.filter((id) => id === piece.id).length / history.length;
      expect(share, piece.id).toBeGreaterThan(0.12);
      expect(share, piece.id).toBeLessThan(0.4);
    }
  });

  it('seldom goes straight back to the piece before last', () => {
    const random = seededRandom(11);
    const history: string[] = [];
    for (let i = 0; i < 4000; i++) history.push(drawNext(PLAY, history, random).id);
    let back = 0;
    for (let i = 2; i < history.length; i++) if (history[i] === history[i - 2]) back++;
    // An even draw among the other three would go back a third of the time.
    expect(back / history.length).toBeLessThan(0.2);
    expect(back).toBeGreaterThan(0);
  });

  it('does not settle into a cycle', () => {
    const random = seededRandom(3);
    const history: string[] = [];
    for (let i = 0; i < 600; i++) history.push(drawNext(PLAY, history, random).id);
    for (let period = 2; period <= 24; period++) {
      let same = 0;
      for (let i = period; i < history.length; i++) if (history[i] === history[i - period]) same++;
      // A cycle of this period would make every one the same.
      expect(same / (history.length - period), `period ${period}`).toBeLessThan(0.6);
    }
    // Every piece is followed, sooner or later, by each of the others whose change is clean.
    const pairs = new Set(history.slice(1).map((id, i) => `${history[i]}>${id}`));
    const clean = Object.entries(CLASH).filter(([, clash]) => clash <= CLASH_LIMIT);
    expect(pairs).toEqual(new Set(clean.map(([pair]) => pair)));
  });

  it('never plays back to back a pair whose change cannot be made clean, and leans to the cleaner', () => {
    const random = seededRandom(17);
    const history: string[] = [];
    for (let i = 0; i < 6000; i++) history.push(drawNext(PLAY, history, random).id);
    const count = new Map<string, number>();
    for (let i = 1; i < history.length; i++) {
      const pair = `${history[i - 1]}>${history[i]}`;
      count.set(pair, (count.get(pair) ?? 0) + 1);
    }
    for (const [pair, clash] of Object.entries(CLASH)) {
      if (clash > CLASH_LIMIT) expect(count.get(pair) ?? 0, pair).toBe(0);
      else expect(count.get(pair) ?? 0, pair).toBeGreaterThan(0);
    }
    // Every ordered pair of the play pieces has a measured figure.
    expect(Object.keys(CLASH)).toHaveLength(PLAY.length * (PLAY.length - 1));
    for (const from of PLAY) {
      // From each piece there is somewhere clean to go.
      const ways = PLAY.filter((to) => to !== from && clashOf(from, to) <= CLASH_LIMIT);
      expect(ways.length, from.id).toBeGreaterThanOrEqual(2);
      // The cleanest change out of a piece is heard more often than the roughest allowed one.
      const sorted = [...ways].sort((a, b) => clashOf(from, a) - clashOf(from, b));
      const best = count.get(`${from.id}>${(sorted[0] as Piece).id}`) ?? 0;
      const worst = count.get(`${from.id}>${(sorted[sorted.length - 1] as Piece).id}`) ?? 0;
      expect(best, from.id).toBeGreaterThan(worst);
    }
    // Drawn as on the first morning, the pair is played like any other.
    const even: string[] = [];
    for (let i = 0; i < 2000; i++) even.push(drawNext(PLAY, even, random, false).id);
    const evenPairs = new Set(even.slice(1).map((id, i) => `${even[i]}>${id}`));
    expect(evenPairs.size).toBe(PLAY.length * (PLAY.length - 1));
  });

  it('is the same for the same seed and different for another', () => {
    const run = (seed: number): string =>
      take(new Sequencer(PLAY, seededRandom(seed)), 40)
        .map((s) => `${s.piece.id}@${s.offset}+${s.duration.toFixed(2)}`)
        .join(' ');
    expect(run(5)).toBe(run(5));
    expect(run(5)).not.toBe(run(6));
  });
});

describe('the timeline of play', () => {
  it('varies how often a middle is played: once, twice and three times all occur', () => {
    const sequencer = new Sequencer(PLAY, seededRandom(21));
    const segments = take(sequencer, 600);
    const lengths = new Map<number, number>();
    let run = 0;
    for (const segment of segments) {
      if (segment.kind === 'enter' && run > 0) {
        lengths.set(run, (lengths.get(run) ?? 0) + 1);
        run = 0;
      }
      run++;
    }
    expect([...lengths.keys()].sort()).toEqual([1, 2, 3]);
    const total = [...lengths.values()].reduce((a, b) => a + b, 0);
    expect((lengths.get(1) ?? 0) / total).toBeGreaterThan(0.3);
    expect((lengths.get(3) ?? 0) / total).toBeGreaterThan(0.1);
  });

  it('lets no piece hold the floor for more than eight minutes', () => {
    const segments = take(new Sequencer(PLAY, seededRandom(13)), 800);
    let entered = 0;
    let longest = 0;
    for (const segment of segments) {
      if (segment.kind === 'enter') entered = segment.start;
      longest = Math.max(longest, handover(segment) - entered);
    }
    expect(longest).toBeLessThanOrEqual(480);
    expect(longest).toBeGreaterThan(400);
    // The plan agrees with the sum it was limited by.
    const piece = PLAY[0] as Piece;
    const visit = planVisit(piece, 0, 0, 3, false);
    expect(handover(visit[2] as Segment)).toBeCloseTo(visitSeconds(piece, 3, false), 9);
  });

  it('starts at the beginning of a piece; no piece is now entered at its loop', () => {
    const segments = take(new Sequencer(PLAY, seededRandom(2)), 400);
    expect(segments[0]).toMatchObject({ start: 0, fadeIn: 0, kind: 'enter' });
    expect(segments[0]?.offset).toBe(segments[0]?.piece.in);
    const entries = segments.filter((s) => s.kind === 'enter');
    // Every loop of the present set starts in the middle of a phrase, or where the piece is
    // entered anyway: the entries "straight at the middle" are dropped.
    for (const piece of PLAY) expect(piece.midEntry, piece.id).toBe(false);
    for (const entry of entries) expect(entry.offset).toBe(entry.piece.in);
    // On the first morning about a third of the entries were at the loop.
    const first = take(new Sequencer(PLAY, seededRandom(2), FIRST_OPTIONS), 400)
      .filter((s) => s.kind === 'enter')
      .slice(1);
    const atLoop = first.filter((s) => s.offset === s.piece.loopStart).length;
    expect(atLoop / first.length).toBeGreaterThan(0.2);
    expect(atLoop / first.length).toBeLessThan(0.5);
  });

  it('joins every voice to the next: no gap, no hard start, never three at once', () => {
    const sequencer = new Sequencer(PLAY, seededRandom(9));
    const segments = take(sequencer, 300);
    for (let i = 1; i < segments.length; i++) {
      const previous = segments[i - 1] as Segment;
      const segment = segments[i] as Segment;
      if (segment.kind === 'repeat') {
        // A piece into itself: the voice starts exactly where the one before begins to fade,
        // and fades in as long.
        expect(segment.start).toBeCloseTo(handover(previous), 9);
        expect(segment.fadeIn).toBe(previous.fadeOut);
      } else {
        // A change of piece: the next starts into the fade of the one being left, before that
        // has gone, with the fade its own beginning needs.
        const j = joinFor(previous.piece, segment.piece, false);
        expect(segment.start).toBeCloseTo(handover(previous) + j.delay, 9);
        expect(segment.start).toBeLessThan(previous.start + previous.duration);
        expect(segment.fadeIn).toBe(Math.min(j.in, segment.piece.fadeIn ?? j.in));
        expect(previous.fadeOut).toBe(j.out);
        expect(segment.visit).toBe(previous.visit + 1);
      }
      expect(gainAt(segment, segment.start)).toBe(0);
      expect(gainAt(previous, previous.start + previous.duration)).toBeCloseTo(0, 9);
    }
    // The changes the sequencer says it planned are the ones in the segments.
    const entries = segments.filter((s) => s.kind === 'enter');
    for (let i = 1; i < entries.length; i++) {
      const change = sequencer.changes[i - 1];
      expect(change?.at).toBeCloseTo((entries[i] as Segment).start, 9);
      expect(change?.from.id).toBe((entries[i - 1] as Segment).piece.id);
      expect(change?.to.id).toBe((entries[i] as Segment).piece.id);
    }
  });

  it('keeps the sum of the gains in bounds through a quarter of an hour', () => {
    const segments = upTo(new Sequencer(PLAY, seededRandom(4)), 960);
    let most = 0;
    let least = Infinity;
    let highest = 0;
    for (let time = 0.5; time < 900; time += 0.05) {
      const gains = segments.map((s) => gainAt(s, time)).filter((g) => g > 0);
      const sum = gains.reduce((total, g) => total + g, 0);
      least = Math.min(least, sum);
      highest = Math.max(highest, sum);
      most = Math.max(most, gains.length);
    }
    // Never more than two voices at once, never silence, never two at full level.
    expect(most).toBe(2);
    expect(least).toBeGreaterThan(0.3);
    expect(highest).toBeLessThan(1.95);
  });

  it('on the first morning kept the power of the mix constant: every join an equal-power crossfade', () => {
    const segments = upTo(new Sequencer(PLAY, seededRandom(4), FIRST_OPTIONS), 960);
    for (let time = 0; time < 900; time += 0.05) {
      const gains = segments.map((s) => gainAt(s, time)).filter((g) => g > 0);
      expect(gains.reduce((sum, g) => sum + g * g, 0)).toBeCloseTo(1, 9);
    }
  });

  it('goes to the next piece at once when asked, with everything after it moved up', () => {
    const sequencer = new Sequencer(PLAY, seededRandom(6));
    const first = sequencer.next();
    sequencer.peek();
    const planned = sequencer.changes[0];
    expect(planned).toBeDefined();
    const before = (planned as { at: number }).at;
    const moved = sequencer.skip(first.visit, 30);
    expect(moved).not.toBeNull();
    // The fade out now starts at 30 s and the next piece comes in `delay` later.
    expect(moved?.at).toBeCloseTo(30 + (moved?.join.delay ?? 0), 9);
    expect(moved?.at).toBeLessThan(before);
    // What comes next is the piece that was promised, and it starts there.
    let next = sequencer.next();
    while (next.visit === first.visit) next = sequencer.next();
    expect(next.piece.id).toBe(moved?.to.id);
    expect(next.kind).toBe('enter');
    expect(next.start).toBeCloseTo(moved?.at ?? 0, 9);
    // A change that is already past cannot be moved.
    expect(sequencer.skip(first.visit, 1e6)).toBeNull();
  });

  it('moves on: a quarter of an hour of play hears at least two different pieces', () => {
    // The longest visit (the longest piece, its middle three times) is under twelve minutes.
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const sequencer = new Sequencer(PLAY, seededRandom(seed));
      upTo(sequencer, 900);
      expect(new Set(sequencer.visited()).size, `seed ${seed}`).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('the opening screen', () => {
  it('enters its piece once and repeats its middle for ever', () => {
    const sequencer = new Sequencer([OPENING], seededRandom(1));
    const segments = take(sequencer, 6);
    expect(segments.map((s) => s.kind)).toEqual(['enter', ...Array<string>(5).fill('repeat')]);
    expect(segments[0]?.offset).toBe(OPENING.in);
    for (let i = 1; i < segments.length; i++) {
      const previous = segments[i - 1] as Segment;
      const segment = segments[i] as Segment;
      expect(segment.offset).toBe(OPENING.loopStart);
      expect(segment.start).toBeCloseTo(handover(previous), 9);
      expect(segment.offset + segment.duration).toBeCloseTo(
        OPENING.loopEnd + DEFAULT_OPTIONS.loopCrossfade,
      );
    }
    expect(sequencer.visited()).toEqual([OPENING.id]);
  });
});

describe('the fades', () => {
  it('are the sine and the cosine of the same angle, exact at their ends', () => {
    const fadeIn = fadeCurve('in');
    const fadeOut = fadeCurve('out');
    expect(fadeIn[0]).toBe(0);
    expect(fadeIn[fadeIn.length - 1]).toBe(1);
    expect(fadeOut[0]).toBe(1);
    expect(fadeOut[fadeOut.length - 1]).toBe(0);
    for (let i = 0; i < fadeIn.length; i++) {
      expect((fadeIn[i] as number) ** 2 + (fadeOut[i] as number) ** 2).toBeCloseTo(1, 6);
      if (i > 0) expect(fadeIn[i] as number).toBeGreaterThan(fadeIn[i - 1] as number);
    }
  });
});
