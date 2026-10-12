// Droplet flight and wall interaction against the jets dossier: the drag decelerations of
// section 3.7, terminal velocity as a force balance, a trajectory against a fine Runge-Kutta
// integration, and the wall regimes of sections 6.1 and 6.2.
import { describe, expect, it } from 'vitest';
import {
  bindSharedClosures,
  createParamSet,
  createRegistry,
  HYDRAULICS_PARAM_DEFS,
  JETS_PARAM_DEFS,
  SCENE_PARAM_DEFS,
  SHARED_PARAM_DEFS,
} from './index.ts';
import {
  createFlightStep,
  createWallImpact,
  dragCoefficient,
  dragRate,
  flightStep,
  resolveSprayParams,
  SPRAY_PARAM_DEFS,
  terminalSpeed,
  WALL_OUTCOME,
  wallImpact,
  type FlightMedium,
} from './index.ts';

const registry = createRegistry({
  contributions: [
    SHARED_PARAM_DEFS,
    SCENE_PARAM_DEFS,
    HYDRAULICS_PARAM_DEFS,
    JETS_PARAM_DEFS,
    SPRAY_PARAM_DEFS,
  ],
});
const params = createParamSet(registry);
const sp = resolveSprayParams(params);
const water = bindSharedClosures(params).water(50);
const medium: FlightMedium = {
  rho: water.rho,
  mu: water.mu,
  gamma: water.gammaW,
  gravity: params.get('phys.gravity'),
};

describe('droplet drag (jets 3.7)', () => {
  it('gives the decelerations the dossier quotes at 50 C', () => {
    // D = 2 mm at 8 m/s: 13 m/s2; 1 mm at 8 m/s: 32; 0.3 mm at 4 m/s: 59; 0.1 mm at 4 m/s: 320.
    const cases: [number, number, number][] = [
      [2e-3, 8, 13],
      [1e-3, 8, 32],
      [0.3e-3, 4, 59],
      [0.1e-3, 4, 320],
    ];
    for (const [diameter, speed, want] of cases) {
      const got = dragRate(sp, medium, speed, diameter) * speed;
      expect(got / want, `${diameter * 1000} mm at ${speed} m/s`).toBeGreaterThan(0.92);
      expect(got / want, `${diameter * 1000} mm at ${speed} m/s`).toBeLessThan(1.08);
    }
  });

  it('is the Schiller-Naumann law, continuous into the Stokes limit', () => {
    expect(dragCoefficient(sp, 1)).toBeCloseTo(24 * 1.15, 12);
    expect(dragCoefficient(sp, 2000)).toBe(0.44);
    // At rest the rate is finite: 18 mu_g / (rho D^2).
    const diameter = 0.2e-3;
    expect(dragRate(sp, medium, 0, diameter)).toBeCloseTo(
      (18 * sp.airViscosity) / (medium.rho * diameter * diameter),
      9,
    );
  });

  it('balances weight against drag at the terminal speed', () => {
    for (const diameter of [0.16e-3, 0.5e-3, 2e-3]) {
      const speed = terminalSpeed(sp, medium, diameter);
      const re = (sp.airDensity * speed * diameter) / sp.airViscosity;
      const drag =
        (Math.PI / 8) *
        dragCoefficient(sp, re) *
        sp.airDensity *
        speed *
        speed *
        diameter *
        diameter;
      const weight = (Math.PI / 6) * medium.rho * medium.gravity * diameter ** 3;
      expect(drag / weight, `${diameter * 1000} mm`).toBeCloseTo(1, 2);
    }
    // Mist settles at well under a metre a second; a 2 mm drop falls at several.
    expect(terminalSpeed(sp, medium, 0.16e-3)).toBeLessThan(0.8);
    expect(terminalSpeed(sp, medium, 2e-3)).toBeGreaterThan(5);
  });
});

describe('the flight step', () => {
  /** Position after `time` by fourth-order Runge-Kutta at 10 us. */
  function reference(
    diameter: number,
    u: [number, number, number],
    time: number,
  ): [number, number, number] {
    const h = 1e-5;
    const s = [0, 0, 0, u[0], u[1], u[2]];
    const rate = (y: number[]): number[] => {
      const speed = Math.hypot(y[3] as number, y[4] as number, y[5] as number);
      const k = dragRate(sp, medium, speed, diameter);
      return [
        y[3] as number,
        y[4] as number,
        y[5] as number,
        -k * (y[3] as number),
        -k * (y[4] as number),
        -medium.gravity - k * (y[5] as number),
      ];
    };
    const add = (y: number[], k: number[], f: number): number[] =>
      y.map((v, i) => v + f * (k[i] as number));
    for (let t = 0; t < time - 0.5 * h; t += h) {
      const k1 = rate(s);
      const k2 = rate(add(s, k1, h / 2));
      const k3 = rate(add(s, k2, h / 2));
      const k4 = rate(add(s, k3, h));
      for (let i = 0; i < 6; i++) {
        s[i] =
          (s[i] as number) +
          (h / 6) *
            ((k1[i] as number) + 2 * (k2[i] as number) + 2 * (k3[i] as number) + (k4[i] as number));
      }
    }
    return [s[0] as number, s[1] as number, s[2] as number];
  }

  it('follows a droplet with drag within 2 mm over half a metre', () => {
    // (sim-core M6 asks 0.2 mm of the full design; the first build takes segments of up to
    // 0.1 m with the drag rate frozen over each, which is half a fast-tier block off at most.)
    // 1 mm and 0.4 mm droplets thrown at 5 m/s, 20 degrees above the horizontal.
    for (const diameter of [1e-3, 0.4e-3]) {
      const step = createFlightStep();
      let p: [number, number, number] = [0, 0, 0];
      let u: [number, number, number] = [5 * Math.cos(0.35), 0, 5 * Math.sin(0.35)];
      const start = u;
      let time = 0;
      let path = 0;
      let steps = 0;
      while (path < 0.5 && steps < 200) {
        flightStep(sp, medium, u[0], u[1], u[2], diameter, step);
        if (step.terminal) break;
        // The chord stays within the sag tolerance of the path.
        path += Math.hypot(step.ex, step.ey, step.ez);
        p = [p[0] + step.ex, p[1] + step.ey, p[2] + step.ez];
        u = [step.ux, step.uy, step.uz];
        time += step.dt;
        steps++;
      }
      const want = reference(diameter, start, time);
      const error = Math.hypot(p[0] - want[0], p[1] - want[1], p[2] - want[2]);
      expect(error, `${diameter * 1000} mm after ${steps} steps`).toBeLessThan(2e-3);
      expect(steps).toBeLessThan(sp.maxSegments);
    }
  });

  it('lets a drop that starts at rest fall, and ends a settled droplet with one ray', () => {
    const step = createFlightStep();
    flightStep(sp, medium, 0, 0, 0, 6e-3, step);
    expect(step.terminal).toBe(false);
    // Free fall, less a few tenths of a per cent of drag.
    const free = -0.5 * medium.gravity * step.dt * step.dt;
    expect(step.ez / free).toBeGreaterThan(0.99);
    expect(step.ez / free).toBeLessThan(1);
    expect(step.uz).toBeLessThan(0);
    // A mist droplet at its terminal speed: one straight ray, straight down.
    const diameter = 0.16e-3;
    const fall = terminalSpeed(sp, medium, diameter);
    flightStep(sp, medium, 0, 0, -fall, diameter, step);
    expect(step.terminal).toBe(true);
    expect(Math.hypot(step.ex, step.ey, step.ez)).toBeCloseTo(sp.maxRange, 9);
    expect(step.ex).toBe(0);
  });
});

describe('a droplet at a wall (jets 6.1, 6.2)', () => {
  const impact = createWallImpact();
  const outcome = (diameter: number, normal: number, wet: boolean): number =>
    wallImpact(sp, medium, diameter, normal, 0, wet, impact).outcome;

  it('sorts the seven droplets of the dossier on a wetted wall', () => {
    // D (mm), V_n (m/s), outcome: jets 6.1.
    const table: [number, number, number][] = [
      [0.1, 1, WALL_OUTCOME.stick],
      [0.2, 2, WALL_OUTCOME.rebound],
      [0.3, 4, WALL_OUTCOME.deposit],
      [0.5, 8, WALL_OUTCOME.splash],
      [4, 2, WALL_OUTCOME.splash],
      [2, 4, WALL_OUTCOME.splash],
      [4, 8, WALL_OUTCOME.splash],
    ];
    for (const [mm, speed, want] of table) {
      expect(outcome(mm * 1e-3, speed, true), `${mm} mm at ${speed} m/s`).toBe(want);
    }
  });

  it('changes regime at the thresholds, to within 1 %', () => {
    const diameter = 1e-3;
    const speedAt = (we: number): number =>
      Math.sqrt((we * medium.gamma) / (medium.rho * diameter));
    const la = (medium.rho * medium.gamma * diameter) / (medium.mu * medium.mu);
    const wetSplash = 1320 * Math.pow(la, -0.183);
    const drySplash = 2630 * Math.pow(la, -0.183);
    expect(outcome(diameter, speedAt(2 * 0.99), true)).toBe(WALL_OUTCOME.stick);
    expect(outcome(diameter, speedAt(2 * 1.01), true)).toBe(WALL_OUTCOME.rebound);
    expect(outcome(diameter, speedAt(20 * 0.99), true)).toBe(WALL_OUTCOME.rebound);
    expect(outcome(diameter, speedAt(20 * 1.01), true)).toBe(WALL_OUTCOME.deposit);
    expect(outcome(diameter, speedAt(wetSplash * 0.99), true)).toBe(WALL_OUTCOME.deposit);
    expect(outcome(diameter, speedAt(wetSplash * 1.01), true)).toBe(WALL_OUTCOME.splash);
    // A dry wall takes everything below its own, higher, threshold.
    expect(outcome(diameter, speedAt(5), false)).toBe(WALL_OUTCOME.deposit);
    expect(outcome(diameter, speedAt(drySplash * 0.99), false)).toBe(WALL_OUTCOME.deposit);
    expect(outcome(diameter, speedAt(drySplash * 1.01), false)).toBe(WALL_OUTCOME.splash);
    // Minimum normal speed for splash of a 1 mm drop: 3.1 m/s wetted, 4.4 m/s dry (jets 6.2).
    expect(speedAt(wetSplash)).toBeCloseTo(3.1, 0);
    expect(speedAt(drySplash) / 4.4).toBeGreaterThan(0.93);
    expect(speedAt(drySplash) / 4.4).toBeLessThan(1.07);
  });

  it('splashes 0.1 (We / We_c - 1) of the mass, at most 30 %', () => {
    const diameter = 2e-3;
    const la = (medium.rho * medium.gamma * diameter) / (medium.mu * medium.mu);
    const critical = 1320 * Math.pow(la, -0.183);
    const speedAt = (we: number): number =>
      Math.sqrt((we * medium.gamma) / (medium.rho * diameter));
    expect(
      wallImpact(sp, medium, diameter, speedAt(2 * critical), 0, true, impact).splashed,
    ).toBeCloseTo(0.1, 6);
    expect(
      wallImpact(sp, medium, diameter, speedAt(3 * critical), 0, true, impact).splashed,
    ).toBeCloseTo(0.2, 6);
    expect(wallImpact(sp, medium, diameter, speedAt(20 * critical), 0, true, impact).splashed).toBe(
      0.3,
    );
  });

  it('rebounds with the restitution of the dossier', () => {
    // e = 0.993 - 1.76 a + 1.56 a^2 - 0.49 a^3 with a the angle from the wall: 0.30 head-on.
    const speed = Math.sqrt((10 * medium.gamma) / (medium.rho * 0.2e-3));
    wallImpact(sp, medium, 0.2e-3, speed, 0, true, impact);
    expect(impact.outcome).toBe(WALL_OUTCOME.rebound);
    const a = Math.PI / 2;
    expect(impact.restitution).toBeCloseTo(0.993 - 1.76 * a + 1.56 * a * a - 0.49 * a * a * a, 12);
    // Glancing: nearly elastic.
    wallImpact(sp, medium, 0.2e-3, speed, 100 * speed, true, impact);
    expect(impact.restitution).toBeGreaterThan(0.95);
  });
});
