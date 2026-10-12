import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { groupMeanLogLikelihood, validateWashRecord } from '../../src/index.ts';
import type { LiteratureRecord } from './literature.ts';
import {
  createLiteratureSurface,
  fittedAggregates,
  literatureAsGroupRecord,
  type SurfaceRow,
} from './literature-surface.ts';
import { ANCHORS_DIR } from './scenario.ts';
import { itemClassOf } from './summary.ts';

const record = JSON.parse(
  readFileSync(
    join(ANCHORS_DIR, 'records', 'std-eu-13.round-robin-ta.detergent-d.literature.json'),
    'utf8',
  ),
) as LiteratureRecord;

/** A wash of a made-up surface: the class means are plain functions of the point. */
function row(duty: number, bake: number, protease: number, levelSeed: number): SurfaceRow {
  const glass =
    2 + 2 * duty + 400 * (protease - 0.012) - 0.2 * Math.log(bake / 1e-5) + 0.1 * levelSeed;
  const means = { crockery: 3.5, cutlery: 4.6, glass, melamine: 5, pots: Number.NaN, all: 4 };
  return {
    id: `${duty}|${bake}|${protease}|${levelSeed}`,
    point: { 'prog.soakDuty': duty, 'soil.bakeRate': bake, 'liq.xProtease': protease },
    levelSeed,
    simSeed: 1,
    source: 'test',
    score: means,
    continuous: means,
    milkGlasses: glass - 1,
    teaItems: 1,
    crockeryWithoutTea: 5,
    cleanShare: 0.7,
    soiledClean: 60,
    soiledItems: 90,
    bySoil: { iec_milk: { records: 13, left: 0.01, meanScore: glass - 1, clean: 3 } },
  };
}
const rows: SurfaceRow[] = [];
for (const duty of [0.5, 0.75, 1]) {
  for (const bake of [1e-5, 1e-4]) {
    for (const protease of [0.012, 0.016, 0.02]) {
      for (const seed of [1, 2]) rows.push(row(duty, bake, protease, seed));
    }
  }
}

describe('the surface of the published class means', () => {
  const surface = createLiteratureSurface(record, rows, {
    nuisance: ['liq.xProtease'],
    fallback: { 'soil.bakeRate': 1e-5 },
  });

  it('reads its axes off the washes and averages over the seeds', () => {
    expect(surface.axes['prog.soakDuty']).toEqual([0.5, 0.75, 1]);
    expect(surface.nuisance).toEqual(['liq.xProtease']);
    expect(surface.seeds).toEqual(['L1S1', 'L2S1']);
    expect(surface.classes).toEqual(['crockery', 'cutlery', 'glass']);
    // At a grid point, with the protease the record likes best: the published glass mean is
    // 3.43, and glass = 3.15 + 400 (protease - 0.012) there, nearest at 0.012.
    const at = surface.at({ 'prog.soakDuty': 0.5, 'soil.bakeRate': 1e-5 });
    expect(at.nuisance['liq.xProtease']).toBe(0.012);
    expect(at.continuous['glass']).toBeCloseTo(3.15, 12);
    expect(at.clamped).toBe(false);
  });

  it('is linear between the grid values, in the logarithm of an axis that spans a factor of four', () => {
    const at = surface.at({ 'prog.soakDuty': 0.6, 'soil.bakeRate': Math.sqrt(1e-5 * 1e-4) });
    // glass is linear in the duty and in ln(bake), so the interpolation is exact; the protease
    // is chosen among its grid values.
    const glassAt = (protease: number): number =>
      2 + 1.2 + 400 * (protease - 0.012) - 0.2 * Math.log(Math.sqrt(10)) + 0.15;
    const published = fittedAggregates(record).find((a) => a.class === 'glass');
    if (published === undefined) throw new Error('no glass mean');
    const best = [0.012, 0.016, 0.02].reduce((a, b) =>
      Math.abs(glassAt(b) - published.value) < Math.abs(glassAt(a) - published.value) ? b : a,
    );
    expect(at.nuisance['liq.xProtease']).toBe(best);
    expect(at.continuous['glass']).toBeCloseTo(glassAt(best), 10);
    // The likelihood is that of the three fitted class means, relative to a perfect match.
    const expected = fittedAggregates(record).reduce(
      (sum, a) =>
        sum +
        groupMeanLogLikelihood(a.value, at.continuous[a.class] as number, a.sd) -
        groupMeanLogLikelihood(a.value, a.value, a.sd),
      0,
    );
    expect(at.logLikelihood).toBeCloseTo(expected, 12);
  });

  it('takes an axis the point does not name at the fallback, and says when it leaves the grid', () => {
    expect(surface.at({ 'prog.soakDuty': 0.75 }).continuous['glass']).toBeCloseTo(
      surface.at({ 'prog.soakDuty': 0.75, 'soil.bakeRate': 1e-5 }).continuous['glass'] as number,
      12,
    );
    const outside = surface.at({ 'prog.soakDuty': 0.3, 'soil.bakeRate': 1e-5 });
    expect(outside.clamped).toBe(true);
    expect(outside.continuous['glass']).toBeCloseTo(
      surface.at({ 'prog.soakDuty': 0.5, 'soil.bakeRate': 1e-5 }).continuous['glass'] as number,
      12,
    );
    const bare = createLiteratureSurface(record, rows, { nuisance: ['liq.xProtease'] });
    expect(() => bare.at({ 'prog.soakDuty': 0.75 })).toThrow(RangeError);
  });
});

describe('the literature record as group mean scores', () => {
  it('is a valid record whose groups are its fitted class means, weighted to the standard load', () => {
    const grouped = literatureAsGroupRecord(record);
    expect(validateWashRecord(JSON.parse(JSON.stringify(grouped))).ok).toBe(true);
    const groups = grouped.group_observations ?? [];
    expect(groups.map((g) => g.id)).toEqual([
      'crockery.mean_score',
      'cutlery.mean_score',
      'glass.mean_score',
    ]);
    for (const group of groups) {
      const aggregate = fittedAggregates(record).find((a) => a.id === group.id);
      expect(group.value).toBe(aggregate?.value);
      expect(group.sd).toBe(aggregate?.sd);
      // Every member is of the class, and the weights of a type add up to its number in the
      // standard load.
      const byType = new Map<string, number>();
      for (const member of group.items) {
        const item = record.load.items.find((each) => each.id === member.item);
        expect(itemClassOf(item?.type ?? '')).toBe(aggregate?.class);
        byType.set(item?.type ?? '', (byType.get(item?.type ?? '') ?? 0) + (member.weight ?? 1));
      }
      for (const [type, weight] of byType) {
        expect(weight).toBeCloseTo(record.standard_composition[type] as number, 10);
      }
    }
  });
});
