/**
 * Helpers for this package's tests only (not exported from the package entry point): a value
 * that must exist, comparisons with a stated tolerance, and the everyday units the dossiers'
 * tables are printed in.
 */

import { expect } from 'vitest';

/** The value, or an Error if it is undefined or null. */
export function must<T>(value: T | undefined | null, what = 'value'): T {
  if (value === undefined || value === null) throw new Error(`expected ${what} to exist`);
  return value;
}

/** Asserts |actual - expected| <= tolerance (an absolute tolerance in the unit of the values). */
export function expectNear(actual: number, expected: number, tolerance: number, what = ''): void {
  expect(
    Math.abs(actual - expected),
    `${what} ${actual} is not within ${tolerance} of ${expected}`,
  ).toBeLessThanOrEqual(tolerance);
}

/** Asserts |actual - expected| <= fraction * |expected| (a relative tolerance). */
export function expectWithin(actual: number, expected: number, fraction: number, what = ''): void {
  expectNear(actual, expected, Math.abs(expected) * fraction, what);
}

/** Cubic metres per second as litres per minute. */
export function toLPerMin(m3PerS: number): number {
  return m3PerS * 60000;
}

/** Pascals as kilopascals. */
export function toKPa(pa: number): number {
  return pa / 1000;
}

/** Radians per second as revolutions per minute. */
export function toRpm(radPerS: number): number {
  return (radPerS * 30) / Math.PI;
}

/** Metres as millimetres. */
export function toMm(m: number): number {
  return m * 1000;
}

/** Joules as kilowatt-hours. */
export function toKWh(joules: number): number {
  return joules / 3.6e6;
}

/** Cubic metres as litres. */
export function toLitres(m3: number): number {
  return m3 * 1000;
}

/** A deep copy of plain data that the test may then break. */
export function mutableCopy<T>(value: T): Mutable<T> {
  return structuredClone(value) as Mutable<T>;
}

/**
 * `T` with every `readonly` removed, recursively, so that a test can damage a copy. Tuples stay
 * tuples, so a damaged copy is still accepted where the read-only type is expected.
 */
export type Mutable<T> = T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
