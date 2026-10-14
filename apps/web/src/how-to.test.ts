import { describe, expect, it } from 'vitest';
import { DISCLAIMER, KEYS } from './how-to.ts';

describe('the how-to panel', () => {
  it('names no programme in the keys', () => {
    for (const [key, what] of KEYS) expect(`${key} ${what}`).not.toMatch(/programme/i);
  });

  it('says in one line what the game is and what it is not', () => {
    expect(DISCLAIMER).toBe(
      'A simulation of one machine, with many estimated parameters. Not affiliated with or endorsed by the makers of the products named; a verdict here says nothing about a real product.',
    );
    expect(DISCLAIMER).not.toMatch(/\n/);
  });
});
