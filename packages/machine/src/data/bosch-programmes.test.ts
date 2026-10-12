import { describe, expect, it } from 'vitest';
import { BOSCH_SMV4HAX40G, expandProgramme, loadProgrammeSpec } from '../index.ts';
import {
  BOSCH_AUTO_145_OPTIONS,
  BOSCH_AUTO_145_STAGED_55_OPTIONS,
  BOSCH_AUTO_145_UNCERTAIN,
  BOSCH_PROGRAMMES,
  boschProgramme,
} from './bosch-programmes.ts';

const MIN = 60;

/** Liquor temperature (C) against time (s) of the main wash of a timeline, from its samples. */
function course(options: Parameters<typeof boschProgramme>[0]) {
  const programme = loadProgrammeSpec(boschProgramme(options));
  return expandProgramme(BOSCH_SMV4HAX40G, programme);
}

describe('the course of Auto 45-65 (auto-recommendation.md, fact-checked)', () => {
  it('keeps the course as written as the primary programme: one ramp to 65 C, heater off after it', () => {
    expect(BOSCH_PROGRAMMES[0]?.id).toBe('auto_145');
    expect(BOSCH_AUTO_145_OPTIONS.washTarget).toBe(BOSCH_AUTO_145_UNCERTAIN.washTarget.value);
    expect(BOSCH_AUTO_145_OPTIONS.heatPlateau).toBeUndefined();
    expect(BOSCH_AUTO_145_OPTIONS.reheatBand).toBeUndefined();
    expect(BOSCH_AUTO_145_OPTIONS.finalTarget).toBe(BOSCH_AUTO_145_UNCERTAIN.finalTarget.value);
    const steps = boschProgramme(BOSCH_AUTO_145_OPTIONS).steps;
    expect(steps.filter((s) => s.kind === 'heat' && s.phase === 'main_wash')).toHaveLength(1);
    // The registered ranges hold the values in use.
    const { washTarget, finalTarget, holdMin } = BOSCH_AUTO_145_UNCERTAIN;
    expect(washTarget.range[0]).toBeLessThanOrEqual(washTarget.value);
    expect(washTarget.range[1]).toBeGreaterThanOrEqual(washTarget.value);
    expect(finalTarget.range[0]).toBeLessThanOrEqual(finalTarget.value);
    expect(finalTarget.range[1]).toBeGreaterThanOrEqual(finalTarget.value);
    expect(holdMin.range[1]).toBeGreaterThanOrEqual(BOSCH_AUTO_145_OPTIONS.holdMin);
    // No rule for the branch: the thresholds are not public.
    expect(BOSCH_AUTO_145_UNCERTAIN.branchRule.value).toBeNull();
  });

  it('builds a staged heat-up as heat, plateau with the heater off, heat', () => {
    const steps = boschProgramme(BOSCH_AUTO_145_STAGED_55_OPTIONS).steps;
    const wash = steps.filter((s) => s.phase === 'main_wash' && s.kind !== 'dose_detergent');
    const kinds = wash.map((s) => s.kind);
    const at = kinds.indexOf('heat');
    expect(kinds.slice(at, at + 4)).toEqual(['heat', 'hold', 'heat', 'hold']);
    const [first, plateau, second, post] = wash.slice(at, at + 4);
    expect(first?.kind === 'heat' && first.target).toBe(45);
    expect(plateau?.kind === 'hold' && plateau.durationMin).toBe(10);
    expect(plateau?.kind === 'hold' && plateau.reheatBand).toBeUndefined();
    expect(second?.kind === 'heat' && second.target).toBe(55);
    expect(post?.kind === 'hold' && post.durationMin).toBe(42);
    // The alternative is not in the machine's programme list.
    expect(BOSCH_PROGRAMMES.some((p) => p.id === BOSCH_AUTO_145_STAGED_55_OPTIONS.id)).toBe(false);
  });

  it('runs the staged course in 2 h 25 min on 11.5 L, with less energy than the course as written', () => {
    const staged = course(BOSCH_AUTO_145_STAGED_55_OPTIONS);
    const written = course(BOSCH_AUTO_145_OPTIONS);
    expect(staged.problems).toEqual([]);
    // 144.7 min in the fact-check; within 2 min of the 145 the display shows.
    expect(Math.abs(staged.totals.duration / MIN - 145)).toBeLessThan(2);
    expect(staged.totals.mainsWater * 1000).toBeCloseTo(11.5, 6);
    // 0.96 kWh against 1.04 kWh in the thermal model (0.008 kWh per kelvin of wash target).
    const kWh = (t: typeof staged): number => t.totals.energy / 3.6e6;
    expect(Math.abs(kWh(staged) - 0.96)).toBeLessThan(0.04);
    expect(kWh(written) - kWh(staged)).toBeGreaterThan(0.03);
    expect(kWh(written) - kWh(staged)).toBeLessThan(0.13);
  });
});
