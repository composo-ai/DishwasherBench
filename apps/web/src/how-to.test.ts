import { describe, expect, it } from 'vitest';
import { DISCLAIMER, KEYS, manualForPage } from './how-to.ts';

describe('the manual as the page shows it', () => {
  it('leaves out the sentence on secondary programmes and nothing else', () => {
    const manual =
      'Baskets. A basket can be loaded only while it is pulled out.\n\nThe wash. start_cycle washes the load on the programme the level is scored on. The card may list secondary programmes; one of them can be named in start_cycle instead, and the wash is then reported as uncalibrated and is not a result on the scored programme. Rejected calls cost nothing.';
    expect(manualForPage(manual)).toBe(
      'Baskets. A basket can be loaded only while it is pulled out.\n\nThe wash. start_cycle washes the load on the programme the level is scored on. Rejected calls cost nothing.',
    );
  });

  it('names no programme in the keys', () => {
    for (const [key, what] of KEYS) expect(`${key} ${what}`).not.toMatch(/Auto|45-65|2:25/);
  });

  it('says in one line what the game is and what it is not', () => {
    expect(DISCLAIMER).toBe(
      'A simulation of one machine, with many estimated parameters. Not affiliated with or endorsed by the makers of the products named; a verdict here says nothing about a real product.',
    );
    expect(DISCLAIMER).not.toMatch(/\n/);
  });
});
