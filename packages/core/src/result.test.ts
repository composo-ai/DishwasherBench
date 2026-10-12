import { describe, expect, it } from 'vitest';
import {
  accept,
  err,
  isErr,
  isOk,
  mapResult,
  ok,
  reject,
  unwrap,
  type Outcome,
  type Result,
} from './result.ts';

describe('Result', () => {
  it('ok and err build the two branches, discriminated by `ok`', () => {
    expect(ok(3)).toEqual({ ok: true, value: 3 });
    expect(err('bad')).toEqual({ ok: false, error: 'bad' });
    const r: Result<number> = ok(3);
    expect(isOk(r)).toBe(true);
    expect(isErr(r)).toBe(false);
    expect(isErr(err('bad'))).toBe(true);
  });

  it('mapResult transforms a value and passes an error through untouched', () => {
    expect(mapResult(ok(3), (x) => x * 2)).toEqual(ok(6));
    // The cast keeps the union type: an annotated `const` would be narrowed to `Err<string>` by
    // its initialiser, leaving the value type of `mapResult` with nothing to be inferred from.
    const failure = err('bad') as Result<number, string>;
    expect(mapResult(failure, (x) => x * 2)).toBe(failure);
  });

  it('a function returning a Result narrows on `ok` at the call site', () => {
    /** Integer square root of a perfect square, or an error naming the input. */
    const exactSqrt = (n: number): Result<number> => {
      const r = Math.round(Math.sqrt(n));
      return r * r === n ? ok(r) : err(`${n} is not a perfect square`);
    };
    const good = exactSqrt(49);
    const bad = exactSqrt(50);
    expect(good.ok ? good.value : good.error).toBe(7);
    expect(bad.ok ? bad.value : bad.error).toBe('50 is not a perfect square');
    expect(isOk(good) && isErr(bad)).toBe(true);
  });

  it('unwrap returns the value or throws for an error', () => {
    expect(unwrap(ok('v'))).toBe('v');
    expect(() => unwrap(err({ code: 7 }))).toThrow(/code/);
  });
});

describe('player-facing outcomes', () => {
  it('a rejection has exactly the wire shape { accepted: false, reason }', () => {
    expect(JSON.stringify(reject('collision_at_pose'))).toBe(
      '{"accepted":false,"reason":"collision_at_pose"}',
    );
    expect(reject('not_insertable', 'blocked by plate_02')).toEqual({
      accepted: false,
      reason: 'not_insertable',
      detail: 'blocked by plate_02',
    });
    // No `detail` key at all when none is given (exact optional properties).
    expect('detail' in reject('x')).toBe(false);
  });

  it('accept adds the discriminant and keeps the payload; an Outcome narrows on `accepted`', () => {
    /** A reducer in miniature: moves `n` items if the budget of 3 allows it. */
    const move = (n: number): Outcome<{ moved: number }, 'budget_exhausted'> =>
      n <= 3 ? accept({ moved: n }) : reject('budget_exhausted', `asked for ${n}, 3 left`);
    const describeOutcome = (outcome: Outcome<{ moved: number }, 'budget_exhausted'>): string =>
      outcome.accepted ? `moved ${outcome.moved}` : outcome.reason;

    const done = move(2);
    expect(done).toEqual({ accepted: true, moved: 2 });
    expect(describeOutcome(done)).toBe('moved 2');

    const refused = move(4);
    expect(refused).toEqual({
      accepted: false,
      reason: 'budget_exhausted',
      detail: 'asked for 4, 3 left',
    });
    expect(describeOutcome(refused)).toBe('budget_exhausted');
  });

  it('accept does not modify the payload it was given', () => {
    const payload = { moved: 2 };
    const outcome = accept(payload);
    expect(outcome).not.toBe(payload);
    expect(payload).toEqual({ moved: 2 });
    expect('accepted' in payload).toBe(false);
  });
});
