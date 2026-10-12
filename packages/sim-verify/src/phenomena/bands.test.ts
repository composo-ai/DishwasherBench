// The checklist's tolerance (docs/research/standards.md section 9.1: correct sign, and
// magnitude within a factor of two or within one score point) as bands, and the verdicts of
// measured values against them.
import { describe, expect, it } from 'vitest';
import {
  bandText,
  control,
  direction,
  outside,
  quantity,
  scoreChange,
  signIsRight,
  verdictOf,
  within,
  worse,
} from './bands.ts';

describe('scoreChange', () => {
  // "-1 to -2": half of 1 or 1 less (so anything below zero), twice 2 or 2 plus 1 (so -4).
  const band = scoreChange(-1, -2, 'stated');

  it('accepts the stated range and its tolerance', () => {
    for (const value of [-0.25, -1, -1.5, -2, -3, -4]) expect(verdictOf(value, band)).toBe('pass');
  });

  it('calls no effect too small and the opposite effect a wrong sign', () => {
    expect(verdictOf(0, band)).toBe('too small');
    expect(verdictOf(0.5, band)).toBe('wrong sign');
    expect(verdictOf(-4.5, band)).toBe('too large');
  });

  it('keeps a lower bound where one score point does not reach zero', () => {
    // "-3 to -4": half of 3 is 1.5, one point less is 2: the smaller, 1.5, is the least accepted.
    const strong = scoreChange(-3, -4, 'stated');
    expect(strong.min).toBe(1.5);
    expect(verdictOf(-1, strong)).toBe('too small');
    expect(verdictOf(-1.5, strong)).toBe('pass');
  });

  it('handles a positive range', () => {
    const up = scoreChange(0.3, 0.5, 'stated');
    expect(up.sign).toBe(1);
    expect(verdictOf(0.4, up)).toBe('pass');
    expect(verdictOf(1.5, up)).toBe('pass'); // 0.5 + 1 point
    expect(verdictOf(1.6, up)).toBe('too large');
    expect(verdictOf(-0.1, up)).toBe('wrong sign');
  });
});

describe('quantity', () => {
  it('accepts a factor of two either way', () => {
    const band = quantity(250, 300, 'brim volume');
    expect(verdictOf(125, band)).toBe('pass');
    expect(verdictOf(600, band)).toBe('pass');
    expect(verdictOf(124, band)).toBe('too small');
    expect(verdictOf(601, band)).toBe('too large');
    expect(verdictOf(-200, band)).toBe('wrong sign');
  });
});

describe('control', () => {
  it('bounds the magnitude at twice the stated limit, whatever the sign', () => {
    const band = control(0.3, 'no effect');
    expect(verdictOf(0, band)).toBe('pass');
    expect(verdictOf(-0.6, band)).toBe('pass');
    expect(verdictOf(0.61, band)).toBe('too large');
    expect(verdictOf(-0.61, band)).toBe('too large');
  });

  it('with a limit of zero accepts only zero', () => {
    const band = control(0, 'identical');
    expect(verdictOf(0, band)).toBe('pass');
    expect(verdictOf(1, band)).toBe('too large');
  });
});

describe('within', () => {
  it('judges the distance from a range, with the side it lies on', () => {
    const band = within(1, '2.3 to 3.7');
    expect(outside(3, 2.3, 3.7)).toBe(0);
    expect(verdictOf(outside(3, 2.3, 3.7), band)).toBe('pass');
    expect(verdictOf(outside(1.5, 2.3, 3.7), band)).toBe('pass'); // 0.8 below
    expect(verdictOf(outside(0, 2.3, 3.7), band)).toBe('too small');
    expect(verdictOf(outside(5, 2.3, 3.7), band)).toBe('too large');
  });
});

describe('direction', () => {
  it('asks for the sign only', () => {
    const band = direction(1, 'more');
    expect(verdictOf(1e-3, band)).toBe('pass');
    expect(verdictOf(1e6, band)).toBe('pass');
    expect(verdictOf(0, band)).toBe('too small');
    expect(verdictOf(-1e-3, band)).toBe('wrong sign');
  });
});

describe('verdicts', () => {
  it('reports a value that is not a number as an error', () => {
    expect(verdictOf(Number.NaN, control(1, 'x'))).toBe('error');
  });

  it('ranks error above wrong sign above too large above too small above not covered above pass', () => {
    expect(worse('pass', 'too small')).toBe('too small');
    expect(worse('too large', 'too small')).toBe('too large');
    expect(worse('wrong sign', 'too large')).toBe('wrong sign');
    expect(worse('error', 'wrong sign')).toBe('error');
    expect(worse('not covered', 'pass')).toBe('not covered');
  });

  it('tells whether the sign is right, which is all the quick test asserts', () => {
    expect(signIsRight(-0.01, scoreChange(-1, -2, 'x'))).toBe(true);
    expect(signIsRight(0, scoreChange(-1, -2, 'x'))).toBe(false);
    expect(signIsRight(0.4, control(0.3, 'x'))).toBe(true);
    expect(signIsRight(0.7, control(0.3, 'x'))).toBe(false);
  });

  it('writes a band in words', () => {
    expect(bandText(scoreChange(-1, -2, 'x'))).toBe('-0 to -4');
    expect(bandText(control(0.3, 'x'))).toBe('|x| <= 0.6');
    expect(bandText(direction(1, 'x'))).toBe('+ (any size)');
    expect(bandText(within(1, 'x'))).toBe('within 1 of the range');
  });
});
