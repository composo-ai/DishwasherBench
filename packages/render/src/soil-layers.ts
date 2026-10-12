/**
 * From what a level says about an item's soil, and from what a wash report says about its
 * residue, to the layers painted on the regions of its mesh. Pure functions, no Three.js.
 *
 * A layer covers a stated fraction of a region. The surface shader draws it as the part of a
 * procedural noise field that lies below a threshold; {@link coverageThreshold} is the quantile
 * of that field, so a layer of coverage 0.4 covers 40% of the region whatever the pattern.
 */

import { FALLBACK_SOIL, soilAppearance } from './appearance.ts';
import type { RegionLayers, Rgb, SoilInput, SoilLayer } from './types.ts';

/** Layers the shader draws per region. */
export const MAX_LAYERS_PER_REGION = 2;

function clamp01(x: number): number {
  return Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0;
}

/**
 * The layers of an item before the wash: every soil of the item on every region it names, with
 * the coverage the level states. Where more than two soils share a region the two that cover
 * most are drawn. Layers of zero coverage are left out.
 */
export function soilLayersByRegion(soils: readonly SoilInput[]): RegionLayers {
  const layers = new Map<string, SoilLayer[]>();
  for (const soil of soils) {
    const appearance = soilAppearance(soil.type);
    for (const { region, coverage } of soil.regions) {
      const c = clamp01(coverage);
      if (c === 0) continue;
      const list = layers.get(region) ?? [];
      list.push({ ...appearance, coverage: c });
      layers.set(region, list);
    }
  }
  for (const [region, list] of layers) {
    if (list.length > MAX_LAYERS_PER_REGION) {
      // Stable: equal coverages keep the order of the level.
      const ranked = list
        .map((layer, index) => ({ layer, index }))
        .sort((a, b) => b.layer.coverage - a.layer.coverage || a.index - b.index)
        .slice(0, MAX_LAYERS_PER_REGION)
        .sort((a, b) => a.index - b.index)
        .map((entry) => entry.layer);
      layers.set(region, ranked);
    }
  }
  return layers;
}

/** Colour of a region that came out with no residue, in report legends. */
export const RESIDUE_CLEAN_COLOUR: Rgb = [0.18, 0.62, 0.36];

const RESIDUE_RAMP: readonly (readonly [number, Rgb])[] = [
  [0, [0.98, 0.84, 0.25]],
  [0.35, [0.96, 0.5, 0.12]],
  [1, [0.84, 0.1, 0.12]],
];

/**
 * Colour that marks a region by how much of it is still soiled: yellow for a trace, through
 * orange, to red for a region that is soiled all over; green for none. `fraction` is clamped to
 * 0 to 1; anything that is not a number counts as 0.
 */
export function residueColour(fraction: number): Rgb {
  const f = clamp01(fraction);
  if (f === 0) return RESIDUE_CLEAN_COLOUR;
  if (f === 1) return (RESIDUE_RAMP[RESIDUE_RAMP.length - 1] as (typeof RESIDUE_RAMP)[number])[1];
  for (let i = 1; i < RESIDUE_RAMP.length; i++) {
    const [f1, c1] = RESIDUE_RAMP[i] as (typeof RESIDUE_RAMP)[number];
    const [f0, c0] = RESIDUE_RAMP[i - 1] as (typeof RESIDUE_RAMP)[number];
    if (f <= f1) {
      const t = (f - f0) / (f1 - f0);
      return [
        c0[0] + (c1[0] - c0[0]) * t,
        c0[1] + (c1[1] - c0[1]) * t,
        c0[2] + (c1[2] - c0[2]) * t,
      ];
    }
  }
  return (RESIDUE_RAMP[RESIDUE_RAMP.length - 1] as (typeof RESIDUE_RAMP)[number])[1];
}

/** One region of a report item: how much of it is still soiled. */
export interface ResidueRegion {
  readonly region: string;
  readonly fraction: number;
}

/**
 * The layers of an item after the wash, from the residue map of its report entry. A region
 * with residue gets a wash of the marker colour of {@link residueColour} all over, so that it
 * can be found at a glance, and on top of it the soil that is left, covering the reported
 * fraction and drawn as the soil the item carried there (or a neutral brown when the residue
 * is on a region the item was not soiled on, such as soil carried over from another item).
 * Regions without residue get no layer: they are drawn clean.
 */
export function residueLayersByRegion(
  soils: readonly SoilInput[],
  residue: readonly ResidueRegion[],
): RegionLayers {
  const layers = new Map<string, SoilLayer[]>();
  for (const { region, fraction } of residue) {
    const f = clamp01(fraction);
    if (f === 0) continue;
    const carried = soils.find((soil) => soil.regions.some((r) => r.region === region));
    const remnant = carried === undefined ? FALLBACK_SOIL : soilAppearance(carried.type);
    layers.set(region, [
      {
        colour: residueColour(f),
        frequency: 20,
        opacity: 0.35 + 0.3 * f,
        roughness: 0.6,
        softness: 1,
        coverage: 1,
      },
      { ...remnant, opacity: Math.max(remnant.opacity, 0.9), coverage: f },
    ]);
  }
  return layers;
}

// ---------------------------------------------------------------------------------------------
// The noise field of the surface shader, in TypeScript, and its quantiles
// ---------------------------------------------------------------------------------------------

function fract(x: number): number {
  return x - Math.floor(x);
}

/** The lattice hash of the shader (`soilHash` in `surface-material.ts`), in [0, 1). */
export function soilHash(x: number, y: number, z: number): number {
  let px = fract(x * 0.1031);
  let py = fract(y * 0.1031);
  let pz = fract(z * 0.1031);
  const d = px * (pz + 31.32) + py * (py + 31.32) + pz * (px + 31.32);
  px += d;
  py += d;
  pz += d;
  return fract((px + py) * pz);
}

function valueNoise(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const smooth = (t: number): number => t * t * (3 - 2 * t);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const fz = smooth(z - iz);
  const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
  const corner = (dx: number, dy: number, dz: number): number =>
    soilHash(ix + dx, iy + dy, iz + dz);
  return mix(
    mix(mix(corner(0, 0, 0), corner(1, 0, 0), fx), mix(corner(0, 1, 0), corner(1, 1, 0), fx), fy),
    mix(mix(corner(0, 0, 1), corner(1, 0, 1), fx), mix(corner(0, 1, 1), corner(1, 1, 1), fx), fy),
    fz,
  );
}

/**
 * The noise field of the surface shader (`soilField` in `surface-material.ts`) at a point given
 * in pattern units (item-frame metres times the layer's frequency). Two octaves of value noise,
 * in [0, 1].
 */
export function soilField(x: number, y: number, z: number): number {
  return (
    0.65 * valueNoise(x, y, z) +
    0.35 * valueNoise(2.03 * x + 11.5, 2.03 * y + 11.5, 2.03 * z + 11.5)
  );
}

/** Number of intervals of the quantile table. */
const QUANTILE_STEPS = 64;

let quantiles: Float64Array | null = null;

/** Quantiles of {@link soilField} at k / 64, from a fixed lattice of sample points. */
function fieldQuantiles(): Float64Array {
  if (quantiles !== null) return quantiles;
  const samples: number[] = [];
  // 24^3 points at an irrational stride: deterministic, and well spread over lattice cells.
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 24; j++) {
      for (let k = 0; k < 24; k++) {
        samples.push(soilField(3.7 + i * 0.6180339, 9.1 + j * 0.7548777, 5.3 + k * 0.5698403));
      }
    }
  }
  samples.sort((a, b) => a - b);
  const table = new Float64Array(QUANTILE_STEPS + 1);
  for (let q = 0; q <= QUANTILE_STEPS; q++) {
    const at = Math.min(
      samples.length - 1,
      Math.round((q / QUANTILE_STEPS) * (samples.length - 1)),
    );
    table[q] = samples[at] as number;
  }
  quantiles = table;
  return table;
}

/**
 * The threshold below which {@link soilField} lies on the stated fraction of a surface: the
 * shader paints a layer where the field is below it. Coverage 0 gives a threshold below the
 * whole field (nothing painted, -1), coverage 1 one above it (everything painted, 2).
 */
export function coverageThreshold(coverage: number): number {
  const c = clamp01(coverage);
  if (c <= 0) return -1;
  if (c >= 1) return 2;
  const table = fieldQuantiles();
  const at = c * QUANTILE_STEPS;
  const lower = Math.floor(at);
  const t = at - lower;
  const a = table[lower] as number;
  const b = table[Math.min(QUANTILE_STEPS, lower + 1)] as number;
  return a + (b - a) * t;
}

/** An sRGB component as the linear value shaders work in. */
export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
