/**
 * Converters between authoring / wire units and SI.
 *
 * Internally everything is SI: metres, kilograms, seconds, radians, newtons, pascals, with
 * temperatures in degrees Celsius. Catalogue files are authored in millimetres, grams and degrees;
 * the wire API uses millimetres and degrees. A value that is not SI carries its unit in its name
 * (`diameterMm`, `yawDeg`).
 *
 * Every converter is a single IEEE-754 operation (one multiply, divide, add or subtract) so that
 * results are bit-identical on every platform. Lengths divide by 1000 rather than multiplying by
 * 0.001 because `k / 1000` is the correctly rounded value of the decimal number that was written.
 */

import type { Vec3 } from './math/types.ts';

/**
 * Offset between the Celsius and Kelvin scales, kelvin: 0 degrees Celsius = 273.15 K (exact by
 * definition).
 */
export const KELVIN_OFFSET = 273.15;

/** Standard acceleration of gravity, m/s^2 (exact by definition, CGPM 1901). */
export const STANDARD_GRAVITY = 9.80665;

const RAD_PER_DEG = Math.PI / 180;
const DEG_PER_RAD = 180 / Math.PI;

/** Millimetres to metres. */
export function mmToM(mm: number): number {
  return mm / 1000;
}

/** Metres to millimetres. */
export function mToMm(m: number): number {
  return m * 1000;
}

/** A vector in millimetres to metres. */
export function v3MmToM(mm: Vec3): Vec3 {
  return [mm[0] / 1000, mm[1] / 1000, mm[2] / 1000];
}

/** A vector in metres to millimetres. */
export function v3MToMm(m: Vec3): Vec3 {
  return [m[0] * 1000, m[1] * 1000, m[2] * 1000];
}

/** Square millimetres to square metres. */
export function mm2ToM2(mm2: number): number {
  return mm2 / 1e6;
}

/** Square metres to square millimetres. */
export function m2ToMm2(m2: number): number {
  return m2 * 1e6;
}

/** Grams to kilograms. */
export function gToKg(g: number): number {
  return g / 1000;
}

/** Kilograms to grams. */
export function kgToG(kg: number): number {
  return kg * 1000;
}

/** Degrees to radians. */
export function degToRad(deg: number): number {
  return deg * RAD_PER_DEG;
}

/** Radians to degrees. */
export function radToDeg(rad: number): number {
  return rad * DEG_PER_RAD;
}

/** Litres to cubic metres. */
export function litresToM3(litres: number): number {
  return litres / 1000;
}

/** Cubic metres to litres. */
export function m3ToLitres(m3: number): number {
  return m3 * 1000;
}

/** Millilitres to cubic metres. */
export function mlToM3(ml: number): number {
  return ml / 1e6;
}

/** Cubic metres to millilitres. */
export function m3ToMl(m3: number): number {
  return m3 * 1e6;
}

/** Volume flow rate, litres per minute to cubic metres per second (1 L/min = 1/60000 m^3/s). */
export function lPerMinToM3PerS(lPerMin: number): number {
  return lPerMin / 60000;
}

/** Volume flow rate, cubic metres per second to litres per minute. */
export function m3PerSToLPerMin(m3PerS: number): number {
  return m3PerS * 60000;
}

/** Degrees Celsius to kelvin. */
export function celsiusToKelvin(celsius: number): number {
  return celsius + KELVIN_OFFSET;
}

/** Kelvin to degrees Celsius. */
export function kelvinToCelsius(kelvin: number): number {
  return kelvin - KELVIN_OFFSET;
}

/** Pressure, bar to pascals (1 bar = 100 000 Pa exactly). */
export function barToPa(bar: number): number {
  return bar * 1e5;
}

/** Pressure, pascals to bar. */
export function paToBar(pa: number): number {
  return pa / 1e5;
}

/** Pressure, kilopascals to pascals. */
export function kPaToPa(kPa: number): number {
  return kPa * 1000;
}

/** Pressure, pascals to kilopascals. */
export function paToKPa(pa: number): number {
  return pa / 1000;
}

/** Rotational speed, revolutions per minute to radians per second. */
export function rpmToRadPerS(rpm: number): number {
  return rpm * (Math.PI / 30);
}

/** Rotational speed, radians per second to revolutions per minute. */
export function radPerSToRpm(radPerS: number): number {
  return radPerS * (30 / Math.PI);
}

/** Minutes to seconds. */
export function minutesToS(minutes: number): number {
  return minutes * 60;
}

/** Hours to seconds. */
export function hoursToS(hours: number): number {
  return hours * 3600;
}
