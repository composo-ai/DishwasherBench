/**
 * How long a wash will take, for the choice a player is given before the start: an estimate
 * per tier from the timings the wash runner keeps of earlier washes on this machine
 * (`<data>/wash-timings.json`), else from the figures measured on the reference machine.
 *
 * The wash runner has the same estimate per stage (`estimateStageSeconds` of
 * `packages/wash-runner/src/progress.ts`), but its package offers it only through the entry
 * that loads the simulation, which the server's process never does. This module reads the
 * runner's timings file and carries the sum of the runner's built-in figures; if the runner
 * offered its estimate beside its contract, this file would be three lines.
 */

import { existsSync, readFileSync } from 'node:fs';
import type { WashTier } from '@spotless/session';
import type { WashOption } from './types.ts';

/**
 * Seconds of a wash as `base + perItem * items`: the sums over the stages of the runner's
 * built-in figures (`STAGE_MODEL`, M3 Pro, 10 October 2026).
 */
export const WASH_SECONDS_MODEL: {
  readonly [tier in WashTier]: { readonly base: number; readonly perItem: number };
} = {
  fast: { base: 10.3, perItem: 0.27 },
  official: { base: 74.3, perItem: 1.71 },
};

/** Timings of the same tier an estimate looks at, newest first. */
const WINDOW = 8;

interface TimingRecord {
  readonly tier?: unknown;
  readonly items?: unknown;
  readonly stage_s?: unknown;
  readonly exposure_computed?: unknown;
}

function modelSeconds(tier: WashTier, items: number): number {
  const model = WASH_SECONDS_MODEL[tier];
  return model.base + model.perItem * Math.max(0, items);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/**
 * How much slower (above 1) or faster washes at a tier have run on this machine than the
 * built-in figures say: the median over its newest timings, or null when it has none. A wash
 * whose exposure came from the cache says nothing about computing it and is left out.
 */
function paceOf(tier: WashTier, records: readonly TimingRecord[]): number | null {
  const ratios: number[] = [];
  const own = records.filter((r) => r !== null && typeof r === 'object' && r.tier === tier);
  for (const record of own.slice(-WINDOW)) {
    if (typeof record.items !== 'number' || record.exposure_computed === 0) continue;
    if (typeof record.stage_s !== 'object' || record.stage_s === null) continue;
    const took = Object.values(record.stage_s as { [stage: string]: unknown })
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      .reduce((sum, value) => sum + value, 0);
    const expected = modelSeconds(tier, record.items);
    if (took > 0 && expected > 0) ratios.push(took / expected);
  }
  return ratios.length === 0 ? null : median(ratios);
}

/**
 * The estimate of a wash of `items` items at a tier from the text of a timings file (null or
 * unreadable text gives the built-in figure). A tier this machine has not washed at yet takes
 * the pace of the other tier, when that has timings: a machine that runs previews four times
 * slower than the reference machine will not run the full wash at the reference's speed.
 */
export function estimateWashSeconds(
  tier: WashTier,
  items: number,
  timingsText: string | null,
): { readonly seconds: number; readonly basis: 'history' | 'built-in' } {
  const builtIn = modelSeconds(tier, items);
  let records: TimingRecord[] = [];
  try {
    const parsed = timingsText === null ? null : (JSON.parse(timingsText) as { records?: unknown });
    if (parsed !== null && Array.isArray(parsed.records)) {
      records = parsed.records as TimingRecord[];
    }
  } catch {
    records = [];
  }
  const pace = paceOf(tier, records) ?? paceOf(tier === 'fast' ? 'official' : 'fast', records);
  if (pace === null) return { seconds: Math.round(builtIn), basis: 'built-in' };
  return { seconds: Math.round(builtIn * pace), basis: 'history' };
}

/** The two washes on offer for a load of `items` items, the preview first. */
export function washOptions(items: number, timingsFile: string): WashOption[] {
  let text: string | null = null;
  try {
    if (existsSync(timingsFile)) text = readFileSync(timingsFile, 'utf8');
  } catch {
    text = null;
  }
  return (['fast', 'official'] as const).map((tier) => ({
    tier,
    scored: tier === 'official',
    ...estimateWashSeconds(tier, items, text),
  }));
}
