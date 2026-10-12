import { listMaterials, listSoils } from '@spotless/catalogue';
import { describe, expect, it } from 'vitest';
import {
  FALLBACK_MATERIAL,
  FALLBACK_SOIL,
  hasMaterialAppearance,
  hasSoilAppearance,
  machinePartAppearance,
  materialAppearance,
  rgbToCss,
  soilAppearance,
} from './appearance.ts';

describe('material appearances', () => {
  it('knows every material of the catalogue', () => {
    const missing = listMaterials()
      .map((material) => material.id)
      .filter((id) => !hasMaterialAppearance(id));
    expect(missing).toEqual([]);
  });

  it('draws each family as what it is', () => {
    // Glass is see-through and smooth; steel is a metal; glazed ceramic is an opaque gloss.
    const glass = materialAppearance('glass_soda_lime');
    expect(glass.opacity).toBeLessThan(0.5);
    expect(glass.roughness).toBeLessThan(0.1);
    expect(glass.label).toBe('glass');
    const steel = materialAppearance('stainless_steel');
    // Mostly metal, but not a pure mirror: with nothing bright around it (down in the cutlery
    // basket) a mirror is black, and a knife blade must still read as steel.
    expect(steel.metalness).toBeGreaterThanOrEqual(0.5);
    expect(steel.metalness).toBeLessThan(0.8);
    expect(Math.min(...steel.colour)).toBeGreaterThan(0.75);
    expect(steel.opacity).toBe(1);
    const porcelain = materialAppearance('porcelain_glazed');
    expect(porcelain.metalness).toBe(0);
    expect(porcelain.opacity).toBe(1);
    expect(porcelain.roughness).toBeLessThan(0.3);
    expect(materialAppearance('polypropylene').label).toBe('plastic');
  });

  it('gives an unknown material a neutral fallback instead of failing', () => {
    expect(materialAppearance('unobtainium')).toBe(FALLBACK_MATERIAL);
  });

  it('draws the machine as the owner describes it: stainless tub, grey wire baskets', () => {
    const tub = machinePartAppearance('tub', 'tub', 'stainless_steel');
    expect(tub.metalness).toBe(1);
    const wire = machinePartAppearance('lower_rack', 'wires', 'rack_wire_pa11');
    expect(wire.metalness).toBe(0);
    const [r, g, b] = wire.colour;
    // Grey: the three channels within 0.1 of one another, neither white nor black.
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(0.1);
    expect(r).toBeGreaterThan(0.3);
    expect(r).toBeLessThan(0.8);
  });
});

describe('soil appearances', () => {
  it('has a rule for every soil of the catalogue', () => {
    const missing = listSoils()
      .map((soil) => soil.id)
      .filter((id) => !hasSoilAppearance(id));
    expect(missing).toEqual([]);
  });

  it('gives recognisable colours: tomato red, spinach green, burnt black, egg yolk yellow', () => {
    const [tr, tg, tb] = soilAppearance('tomato_sauce').colour;
    expect(tr).toBeGreaterThan(2 * tg);
    expect(tr).toBeGreaterThan(2 * tb);
    const [sr, sg, sb] = soilAppearance('spinach_particles').colour;
    expect(sg).toBeGreaterThan(sr);
    expect(sg).toBeGreaterThan(sb);
    expect(Math.max(...soilAppearance('burnt_carbonised').colour)).toBeLessThan(0.1);
    const [yr, yg, yb] = soilAppearance('egg_yolk_dried').colour;
    expect(yr).toBeGreaterThan(0.8);
    expect(yg).toBeGreaterThan(0.5);
    expect(yb).toBeLessThan(0.2);
  });

  it('draws laboratory soils like their kitchen counterparts', () => {
    expect(soilAppearance('iec_egg_yolk')).toBe(soilAppearance('egg_yolk_dried'));
    expect(soilAppearance('aham_oatmeal')).toBe(soilAppearance('porridge'));
    expect(soilAppearance('ikw_tea')).toBe(soilAppearance('tea_tannin'));
  });

  it('keeps every soil visible on white porcelain', () => {
    // A soil that is as light as the plate under it cannot be seen: every soil must differ
    // from glazed porcelain by at least 0.12 in some channel, at an opacity of at least 0.5.
    const plate = materialAppearance('porcelain_glazed').colour;
    for (const soil of listSoils()) {
      const a = soilAppearance(soil.id);
      const contrast = Math.max(...a.colour.map((c, i) => Math.abs(c - (plate[i] as number))));
      expect(contrast, soil.id).toBeGreaterThanOrEqual(0.12);
      expect(a.opacity, soil.id).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('gives an unknown soil the fallback, and CSS colours are well formed', () => {
    expect(soilAppearance('mystery')).toBe(FALLBACK_SOIL);
    expect(rgbToCss([1, 0.5, 0])).toBe('rgb(255, 128, 0)');
    expect(rgbToCss([2, -1, 0.2])).toBe('rgb(255, 0, 51)');
  });
});
