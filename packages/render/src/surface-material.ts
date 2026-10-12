/**
 * The Three.js material of a surface: a standard physically based material built from a
 * {@link MaterialAppearance}, optionally extended to paint the soil layers that the geometry
 * carries per vertex (`mesh.ts`). The soil pattern is a procedural noise field evaluated in the
 * item frame, so it stays on the item as the item moves.
 */

import { Color, DoubleSide, FrontSide, MeshStandardMaterial, SRGBColorSpace } from 'three';
import type { MaterialAppearance } from './types.ts';

const SOIL_VERTEX_DECLARATIONS = /* glsl */ `
attribute vec4 soilA;
attribute vec4 soilAP;
attribute vec4 soilB;
attribute vec4 soilBP;
varying vec4 vSoilA;
varying vec4 vSoilAP;
varying vec4 vSoilB;
varying vec4 vSoilBP;
varying vec3 vSoilPosition;
`;

const SOIL_VERTEX_BODY = /* glsl */ `
vSoilA = soilA;
vSoilAP = soilAP;
vSoilB = soilB;
vSoilBP = soilBP;
vSoilPosition = position;
`;

// The same field as `soilField` of soil-layers.ts, whose quantiles give the thresholds.
const SOIL_FRAGMENT_DECLARATIONS = /* glsl */ `
varying vec4 vSoilA;
varying vec4 vSoilAP;
varying vec4 vSoilB;
varying vec4 vSoilBP;
varying vec3 vSoilPosition;
float soilMaskTotal = 0.0;
float soilRoughness = 0.5;
float soilHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float soilValueNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(soilHash(i), soilHash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(soilHash(i + vec3(0.0, 1.0, 0.0)), soilHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(soilHash(i + vec3(0.0, 0.0, 1.0)), soilHash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(soilHash(i + vec3(0.0, 1.0, 1.0)), soilHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
float soilField(vec3 p) {
  return 0.65 * soilValueNoise(p) + 0.35 * soilValueNoise(2.03 * p + 11.5);
}
// Share of the surface point covered by a layer: 1 inside a patch, 0 outside.
float soilLayerMask(vec4 layer, vec4 params, vec3 offset) {
  if (layer.a < 0.0) return 0.0;
  if (layer.a > 1.0) return 1.0;
  float field = soilField(vSoilPosition * params.x + offset);
  float width = max(0.004, 0.09 * params.w);
  return 1.0 - smoothstep(layer.a - width, layer.a + width, field);
}
`;

const SOIL_FRAGMENT_COLOUR = /* glsl */ `
{
  float maskA = soilLayerMask(vSoilA, vSoilAP, vec3(0.0)) * vSoilAP.y;
  float maskB = soilLayerMask(vSoilB, vSoilBP, vec3(37.7, 3.1, 19.4)) * vSoilBP.y;
  diffuseColor.rgb = mix(diffuseColor.rgb, vSoilA.rgb, maskA);
  diffuseColor.rgb = mix(diffuseColor.rgb, vSoilB.rgb, maskB);
  soilMaskTotal = max(maskA, maskB);
  soilRoughness = maskB > maskA ? vSoilBP.z : vSoilAP.z;
  // Soil is opaque even on glass.
  diffuseColor.a = max(diffuseColor.a, soilMaskTotal);
}
`;

const SOIL_FRAGMENT_ROUGHNESS = /* glsl */ `
roughnessFactor = mix(roughnessFactor, soilRoughness, soilMaskTotal);
`;

const SOIL_FRAGMENT_METALNESS = /* glsl */ `
metalnessFactor *= 1.0 - soilMaskTotal;
`;

/** Options of {@link createSurfaceMaterial}. */
export interface SurfaceMaterialOptions {
  /** Paint the soil layers carried by the geometry (needs the attributes of `mesh.ts`). */
  readonly soil?: boolean;
  /** Draw both faces: for thin open shells seen from inside. Default false. */
  readonly doubleSided?: boolean;
}

/** A Three.js material for an appearance. Dispose of it when it is no longer drawn. */
export function createSurfaceMaterial(
  appearance: MaterialAppearance,
  options: SurfaceMaterialOptions = {},
): MeshStandardMaterial {
  const transparent = appearance.opacity < 1;
  const material = new MeshStandardMaterial({
    color: new Color().setRGB(
      appearance.colour[0],
      appearance.colour[1],
      appearance.colour[2],
      SRGBColorSpace,
    ),
    metalness: appearance.metalness,
    roughness: appearance.roughness,
    envMapIntensity: appearance.envIntensity,
    transparent,
    opacity: appearance.opacity,
    // Glass is drawn after everything else and does not hide what is behind it.
    depthWrite: !transparent,
    side: options.doubleSided === true || transparent ? DoubleSide : FrontSide,
  });
  if (options.soil === true) {
    material.onBeforeCompile = (shader): void => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${SOIL_VERTEX_DECLARATIONS}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${SOIL_VERTEX_BODY}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${SOIL_FRAGMENT_DECLARATIONS}`)
        .replace('#include <color_fragment>', `#include <color_fragment>\n${SOIL_FRAGMENT_COLOUR}`)
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>\n${SOIL_FRAGMENT_ROUGHNESS}`,
        )
        .replace(
          '#include <metalnessmap_fragment>',
          `#include <metalnessmap_fragment>\n${SOIL_FRAGMENT_METALNESS}`,
        );
    };
    // One program for every soiled material, whatever its colour.
    material.customProgramCacheKey = (): string => 'spotless-soil-1';
  }
  return material;
}
