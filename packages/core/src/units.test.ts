import { describe, expect, it } from 'vitest';
import {
  KELVIN_OFFSET,
  STANDARD_GRAVITY,
  barToPa,
  celsiusToKelvin,
  degToRad,
  gToKg,
  hoursToS,
  kPaToPa,
  kelvinToCelsius,
  kgToG,
  lPerMinToM3PerS,
  litresToM3,
  m2ToMm2,
  m3PerSToLPerMin,
  m3ToLitres,
  m3ToMl,
  mToMm,
  minutesToS,
  mlToM3,
  mm2ToM2,
  mmToM,
  paToBar,
  paToKPa,
  radPerSToRpm,
  radToDeg,
  rpmToRadPerS,
  v3MToMm,
  v3MmToM,
} from './units.ts';

/** Relative difference, for round-trip checks. */
function rel(a: number, b: number): number {
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), Number.MIN_VALUE);
}

describe('unit converters', () => {
  it('lengths: a 270 mm plate is 0.27 m; areas: 4 mm^2 is 4e-6 m^2 (exact doubles)', () => {
    expect(mmToM(270)).toBe(0.27);
    expect(mToMm(0.27)).toBe(270);
    expect(mm2ToM2(4)).toBe(4e-6);
    expect(m2ToMm2(4e-6)).toBe(4);
    expect(v3MmToM([212, 148, 61])).toEqual([0.212, 0.148, 0.061]);
    expect(v3MToMm([0.5, -0.25, 2])).toEqual([500, -250, 2000]);
  });

  it('mmToM of every whole millimetre is the correctly rounded decimal, as the parser reads it', () => {
    // Independent path: the decimal string "<k>e-3" parsed by the engine is correctly rounded.
    for (let k = -3000; k <= 3000; k++) {
      expect(mmToM(k)).toBe(Number(`${k}e-3`));
    }
  });

  it('masses: a 351 g mug is 0.351 kg (exact doubles)', () => {
    expect(gToKg(351)).toBe(0.351);
    expect(kgToG(0.351)).toBe(351);
  });

  it('angles: 180 degrees is pi, 90 is pi/2, 360 is 2 pi (exact doubles)', () => {
    expect(degToRad(180)).toBe(Math.PI);
    expect(degToRad(90)).toBe(Math.PI / 2);
    expect(degToRad(360)).toBe(2 * Math.PI);
    expect(degToRad(-45)).toBe(-Math.PI / 4);
    expect(radToDeg(Math.PI)).toBe(180);
    expect(radToDeg(Math.PI / 2)).toBe(90);
  });

  it('volumes: 1 L is 1e-3 m^3 and 300 ml is 3e-4 m^3 (1e-15 relative)', () => {
    expect(litresToM3(1)).toBe(0.001);
    expect(m3ToLitres(0.001)).toBe(1);
    expect(rel(mlToM3(300), 3e-4)).toBeLessThanOrEqual(1e-15);
    expect(rel(m3ToMl(3e-4), 300)).toBeLessThanOrEqual(1e-15);
  });

  it('flow: 60 L/min is 1e-3 m^3/s and 12 L/min is 2e-4 m^3/s (1e-15 relative)', () => {
    expect(lPerMinToM3PerS(60)).toBe(0.001);
    expect(rel(lPerMinToM3PerS(12), 2e-4)).toBeLessThanOrEqual(1e-15);
    expect(rel(m3PerSToLPerMin(2e-4), 12)).toBeLessThanOrEqual(1e-15);
  });

  it('temperature: 0 C is 273.15 K, 65 C is 338.15 K (1e-13 K)', () => {
    expect(KELVIN_OFFSET).toBe(273.15);
    expect(celsiusToKelvin(0)).toBe(273.15);
    expect(Math.abs(celsiusToKelvin(65) - 338.15)).toBeLessThanOrEqual(1e-13);
    expect(Math.abs(kelvinToCelsius(338.15) - 65)).toBeLessThanOrEqual(1e-13);
    expect(kelvinToCelsius(0)).toBe(-273.15);
  });

  it('pressure: 1 bar is 100 kPa is 1e5 Pa (exact doubles)', () => {
    expect(barToPa(1)).toBe(100000);
    expect(paToBar(100000)).toBe(1);
    expect(kPaToPa(100)).toBe(100000);
    expect(paToKPa(100000)).toBe(100);
    expect(rel(barToPa(0.35), 35000)).toBeLessThanOrEqual(1e-15);
  });

  it('rotation: 60 rpm is 2 pi rad/s; time: 2 min is 120 s, 1.5 h is 5400 s (1e-15 relative)', () => {
    expect(rel(rpmToRadPerS(60), 2 * Math.PI)).toBeLessThanOrEqual(1e-15);
    expect(rel(radPerSToRpm(2 * Math.PI), 60)).toBeLessThanOrEqual(1e-15);
    expect(minutesToS(2)).toBe(120);
    expect(hoursToS(1.5)).toBe(5400);
  });

  it('standard gravity is the defined 9.80665 m/s^2', () => {
    expect(STANDARD_GRAVITY).toBe(9.80665);
  });

  it('every pair of converters round-trips to 1e-15 relative over six decades', () => {
    const pairs: [(x: number) => number, (x: number) => number][] = [
      [mmToM, mToMm],
      [mm2ToM2, m2ToMm2],
      [gToKg, kgToG],
      [degToRad, radToDeg],
      [litresToM3, m3ToLitres],
      [mlToM3, m3ToMl],
      [lPerMinToM3PerS, m3PerSToLPerMin],
      [barToPa, paToBar],
      [kPaToPa, paToKPa],
      [rpmToRadPerS, radPerSToRpm],
    ];
    for (const [there, back] of pairs) {
      for (const x of [1e-3, 0.37, 1, 2.5, 123.456, 9876.5, 1e3]) {
        expect(rel(back(there(x)), x)).toBeLessThanOrEqual(1e-15);
        expect(rel(back(there(-x)), -x)).toBeLessThanOrEqual(1e-15);
      }
    }
  });
});
