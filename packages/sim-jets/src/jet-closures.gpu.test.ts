// The WGSL twins of the jet closures against the f64 evaluator, on the GPU of this machine
// (docs/design/sim-core.md section M2, "Shared closure functions": one expression tree, two
// back ends). Skipped, visibly, on a machine without a WebGPU adapter. The device comes from
// the test harness of `@spotless/sim-params`, reached by a relative path.
import { hashU32, u32ToUnitFloat } from '@spotless/core';
import { afterAll, describe, expect, it } from 'vitest';
import {
  buildUniformLayout,
  createParamSet,
  createRegistry,
  emitExprWgsl,
  exprParamKeys,
  HYDRAULICS_PARAM_DEFS,
  packUniformBlock,
  SCENE_PARAM_DEFS,
  SHARED_PARAM_DEFS,
} from './index.ts';
import { bindJetClosures, JET_CLOSURE_FNS, JETS_PARAM_DEFS } from './index.ts';
import {
  destroyGpuDevice,
  gpuDevice,
  runMapKernel,
} from '../../sim-params/src/gpu-harness.test-util.ts';

afterAll(destroyGpuDevice);

const registry = createRegistry({
  contributions: [SHARED_PARAM_DEFS, SCENE_PARAM_DEFS, HYDRAULICS_PARAM_DEFS, JETS_PARAM_DEFS],
});
// Calibration scales away from 1, so that the uniform block is seen to carry them.
const params = createParamSet(registry, { 'jets.kStag': 1.3, 'jets.kFilm': 0.8, 'jets.kS': 0.7 });
const closures = bindJetClosures(params);

const uniform = (stream: number, i: number, lo: number, hi: number): number =>
  lo + (hi - lo) * u32ToUnitFloat(hashU32(20261010, stream, i));

describe('the jet closures in WGSL', () => {
  if (gpuDevice === null) {
    it('are SKIPPED: no WebGPU adapter', () => {
      console.warn('sim-jets: no WebGPU adapter available; the closure parity test is SKIPPED');
    });
    return;
  }
  const device = gpuDevice;

  it('give in f32 what the f64 evaluator gives, to five figures', async () => {
    const layout = buildUniformLayout(registry, 'JetClosureParams', exprParamKeys(JET_CLOSURE_FNS));
    const wgsl = emitExprWgsl(JET_CLOSURE_FNS, layout.target('params'));
    const n = 4096;
    const width = 11;
    const input = new Float32Array(width * n);
    for (let i = 0; i < n; i++) {
      const re = Math.exp(uniform(9, i, Math.log(1e3), Math.log(1e5)));
      // x away from the zone boundaries, where the film model has a corner (0.24 Re^(1/3)), a
      // jump (0.2964 Re^(1/3)) and the ramp of the momentum (0.55): a point that f32 puts on
      // the other side is another branch, not a rounding error.
      let x = Math.exp(uniform(10, i, Math.log(0.1), Math.log(60)));
      for (const edge of [0.24 * Math.cbrt(re), 0.2964 * Math.cbrt(re), 0.55]) {
        if (Math.abs(x / edge - 1) < 0.01) x = 1.02 * edge;
      }
      const phi = uniform(6, i, 0.06, Math.PI / 2);
      input.set(
        [
          uniform(1, i, 3, 10), // V
          uniform(2, i, 0.8e-3, 3.5e-3), // d
          uniform(3, i, 0, 0.5), // s
          uniform(4, i, 965, 1000), // rho
          uniform(5, i, 4e-7, 1e-6), // nu
          Math.sin(phi),
          Math.cos(phi),
          uniform(7, i, -1, 1), // cosPsi
          uniform(8, i, 0, 2.5), // X
          x,
          re,
        ],
        width * i,
      );
    }
    const gamma = 0.068;
    const body = `
  let V = inp[b]; let d = inp[b + 1u]; let s = inp[b + 2u]; let rho = inp[b + 3u];
  let nu = inp[b + 4u]; let sinPhi = inp[b + 5u]; let cosPhi = inp[b + 6u];
  let cosPsi = inp[b + 7u]; let X = inp[b + 8u]; let x = inp[b + 9u]; let re = inp[b + 10u];
  let gamma = ${gamma};
  let Lb = jet_breakup_length(V, d, rho, nu, gamma);
  let q = jet_flow_per_radian(V, 0.5 * d, sinPhi, cosPhi, cosPsi);
  outp[o] = Lb;
  outp[o + 1u] = jet_coherent_fraction(s, Lb);
  outp[o + 2u] = jet_splatter_fraction(V, d, s, rho, gamma, sinPhi);
  outp[o + 3u] = q;
  outp[o + 4u] = jet_footprint_edge(0.5 * d, sinPhi, cosPhi, cosPsi);
  outp[o + 5u] = jet_flow_integral(cosPhi, acos(cosPsi));
  outp[o + 6u] = jet_wall_pressure(V, rho, sinPhi, X);
  outp[o + 7u] = jet_stag_shear(V, d, rho, nu, sinPhi, X);
  outp[o + 8u] = jet_film_thickness(x, re);
  outp[o + 9u] = jet_film_speed(x, re);
  outp[o + 10u] = jet_film_shear(x, re);
  outp[o + 11u] = jet_film_momentum(x, re);
  outp[o + 12u] = jet_fan_radius(6.2831853 * q, rho, nu, gamma);`;
    const out = await runMapKernel(device, layout.wgsl + wgsl, body, input, width, 13, {
      uniform: { structName: layout.structName, data: packUniformBlock(layout, params).data },
    });
    const names = [
      'breakupLength',
      'coherentFraction',
      'splatterFraction',
      'flowPerRadian',
      'footprintEdge',
      'flowIntegral',
      'wallPressure',
      'stagShear',
      'filmThickness',
      'filmSpeed',
      'filmShear',
      'filmMomentum',
      'fanRadius',
    ];
    const worst = names.map(() => 0);
    for (let i = 0; i < n; i++) {
      const at = (k: number): number => input[width * i + k] as number;
      const args = {
        V: at(0),
        d: at(1),
        s: at(2),
        rho: at(3),
        nu: at(4),
        sinPhi: at(5),
        cosPhi: at(6),
        cosPsi: at(7),
        X: at(8),
        x: at(9),
        re: at(10),
      };
      const lb = closures.breakupLength(args.V, args.d, args.rho, args.nu, gamma);
      const q = closures.flowPerRadian(args.V, 0.5 * args.d, args.sinPhi, args.cosPhi, args.cosPsi);
      const reference = [
        lb,
        closures.coherentFraction(args.s, lb),
        closures.splatterFraction(args.V, args.d, args.s, args.rho, gamma, args.sinPhi),
        q,
        closures.footprintEdge(0.5 * args.d, args.sinPhi, args.cosPhi, args.cosPsi),
        closures.flowIntegral(args.cosPhi, Math.acos(args.cosPsi)),
        closures.wallPressure(args.V, args.rho, args.sinPhi, args.X),
        closures.stagShear(args.V, args.d, args.rho, args.nu, args.sinPhi, args.X),
        closures.filmThickness(args.x, args.re),
        closures.filmSpeed(args.x, args.re),
        closures.filmShear(args.x, args.re),
        closures.filmMomentum(args.x, args.re),
        closures.fanRadius(2 * Math.PI * q, args.rho, args.nu, gamma),
      ];
      reference.forEach((want, k) => {
        const got = out[13 * i + k] as number;
        // Relative, with an absolute floor for the clamped fractions and the far tail of the
        // pressure, which are zero or tiny.
        const scale = Math.max(Math.abs(want), k === 1 || k === 2 ? 1e-2 : k === 6 ? 1 : 1e-30);
        worst[k] = Math.max(worst[k] as number, Math.abs(got - want) / scale);
      });
    }
    console.info(
      `sim-jets GPU parity, worst relative difference: ${names.map((name, k) => `${name} ${(worst[k] as number).toExponential(1)}`).join(', ')}`,
    );
    // f32: a few ulps through powers, exponentials and the arctangent. The flow integral
    // divides by (1 - c^2)^(3/2), which costs figures near grazing incidence, and the film
    // forms at the far end of the turbulent zone subtract nearly equal terms.
    names.forEach((name, k) => {
      const tolerance = k === 5 ? 2e-3 : k >= 8 && k <= 11 ? 5e-4 : k === 2 ? 5e-4 : 1e-4;
      expect(worst[k], `${name}: ${worst[k]}`).toBeLessThan(tolerance);
    });
  });
});
