/** Small shared helpers of the calibration package. */

import { hashU32 } from '@spotless/core';

/** A u32 key of a string, by folding its characters through the counter-based generator. */
export function stringKey(text: string): number {
  let key = text.length >>> 0;
  for (let i = 0; i < text.length; i++) key = hashU32(key, text.charCodeAt(i));
  return key;
}

/** A number in a table: `digits` significant figures, plain notation where that is short. */
export function fmt(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return '0';
  const magnitude = Math.abs(value);
  if (magnitude >= 1e5 || magnitude < 1e-3) return value.toExponential(Math.max(0, digits - 1));
  return String(Number(value.toPrecision(digits)));
}

/** A text table with columns padded to their widest cell; the first row is the header. */
export function textTable(
  rows: readonly (readonly string[])[],
  right: readonly number[] = [],
): string {
  const width: number[] = [];
  for (const row of rows)
    row.forEach((cell, i) => (width[i] = Math.max(width[i] ?? 0, cell.length)));
  const line = (row: readonly string[]): string =>
    row
      .map((cell, i) =>
        right.includes(i) ? cell.padStart(width[i] as number) : cell.padEnd(width[i] as number),
      )
      .join('  ')
      .trimEnd();
  const out = rows.map(line);
  out.splice(1, 0, width.map((w) => '-'.repeat(w)).join('  '));
  return out.join('\n');
}
