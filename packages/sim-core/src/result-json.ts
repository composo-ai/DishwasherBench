/**
 * A wash result as plain JSON: typed arrays become number lists, and the liquor trace is
 * thinned to about one row a minute unless all of it is asked for.
 */

import type { WashResult } from './result.ts';

/** Options of {@link washResultToJson}. */
export interface ResultJsonOptions {
  /**
   * Seconds between the rows of the liquor trace that are kept; 0 keeps every tick. Default 60.
   */
  readonly traceInterval?: number;
}

/** Rounds to six significant digits, so that the file is readable and not long. */
function tidy(value: number): number {
  return Number.isFinite(value) ? Number(value.toPrecision(6)) : value;
}

/** The result as a value `JSON.stringify` writes as it is. */
export function washResultToJson(result: WashResult, options: ResultJsonOptions = {}): unknown {
  const interval = options.traceInterval ?? 60;
  const { liquor } = result.machine;
  const fields = liquor.fields.length;
  const times: number[] = [];
  const rows: number[][] = [];
  let next = -Infinity;
  for (let i = 0; i < liquor.tickTime_s.length; i++) {
    const t = liquor.tickTime_s[i] as number;
    if (interval > 0 && t < next && i !== liquor.tickTime_s.length - 1) continue;
    next = t + interval;
    times.push(tidy(t));
    rows.push(Array.from(liquor.values.subarray(fields * i, fields * (i + 1)), tidy));
  }
  return {
    ...result,
    items: result.items.map((item) => {
      if (item.cells === undefined) return item;
      const c = item.cells;
      return {
        ...item,
        cells: {
          count: c.count,
          region: Array.from(c.region),
          centre: Array.from(c.centre, tidy),
          normal: Array.from(c.normal, tidy),
          areaMm2: Array.from(c.areaMm2, tidy),
          initial_mg_cm2: Array.from(c.initial_mg_cm2, tidy),
          residual_mg_cm2: Array.from(c.residual_mg_cm2, tidy),
          visible: Array.from(c.visible),
        },
      };
    }),
    machine: {
      ...result.machine,
      liquor: { fields: liquor.fields, tickTime_s: times, values: rows },
    },
  };
}
