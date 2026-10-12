// What a report of a fast wash says about its tier, from a measured agreement file.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fastTierNote, readTierAgreement, type TierAgreementFile } from './node/tier-agreement.ts';

const measured: TierAgreementFile = {
  format: 'spotless.tier-agreement',
  paramSet: 'a-set',
  simVersion: 'spotless-sim test',
  createdAt: '2026-10-11T00:00:00.000Z',
  programmes: {
    eco_50: {
      basis: 'a load, 8 pairs of washes',
      washes: 8,
      all: { agree: 660, of: 720 },
      byClass: {
        crockery: { agree: 250, of: 256 },
        cutlery: { agree: 250, of: 288 },
        glass: { agree: 160, of: 176 },
      },
    },
  },
};

describe('the note of a fast wash', () => {
  it('gives the verdicts in a hundred that differ from the official tier, by class of item', () => {
    const note = fastTierNote(measured, 'eco_50');
    expect(note).toContain('on this programme');
    expect(note).toContain('8 of 100 cases');
    expect(note).toContain('2 in 100 for crockery');
    expect(note).toContain('13 in 100 for cutlery');
    expect(note).toContain('9 in 100 for glass');
    expect(note).toContain('a-set');
  });

  it('says so when the programme of the wash was not the one measured, or nothing was', () => {
    expect(fastTierNote(measured, 'auto_145')).toContain(
      'on eco_50 (this programme was not measured',
    );
    expect(fastTierNote(null, 'eco_50')).toContain('has not been measured');
  });

  it('reads the file the calibration side writes, and nothing else', () => {
    const dir = mkdtempSync(join(tmpdir(), 'spotless-tiers-'));
    const file = join(dir, 'a-set.tiers.json');
    writeFileSync(file, JSON.stringify(measured));
    expect(readTierAgreement(file)?.programmes['eco_50']?.all.of).toBe(720);
    writeFileSync(file, JSON.stringify({ format: 'something else' }));
    expect(readTierAgreement(file)).toBeNull();
    expect(readTierAgreement(join(dir, 'missing.json'))).toBeNull();
  });
});
