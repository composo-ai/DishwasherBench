import { describe, expect, it } from 'vitest';
import {
  contactKeyPair,
  contactPairLookup,
  frictionPair,
  PVC_RACK_FRICTION_FACTOR,
  RESTITUTION_VELOCITY_THRESHOLD,
  ROLLING_RESISTANCE_LENGTH_HARD,
  ROLLING_RESISTANCE_LENGTH_ON_WIRE,
  rollingResistanceLength,
  SPIN_FRICTION_LENGTH,
} from './contact.ts';
import { listMaterials } from './materials.ts';

const WIRE = 'rack_wire_pa11';

describe('friction against coated rack wire (items.md table 11.1)', () => {
  // [material, loading static, loading kinetic, wash static, wash kinetic].
  const table: readonly (readonly [string, number, number, number, number])[] = [
    ['porcelain_glazed', 0.3, 0.25, 0.2, 0.15],
    ['porcelain_unglazed', 0.5, 0.42, 0.4, 0.33],
    ['glass_soda_lime', 0.25, 0.2, 0.18, 0.13],
    ['stainless_steel', 0.28, 0.22, 0.18, 0.14],
    ['aluminium', 0.3, 0.25, 0.2, 0.15],
    ['aluminium_nonstick', 0.12, 0.1, 0.1, 0.08],
    ['cast_iron_seasoned', 0.35, 0.3, 0.25, 0.2],
    ['polypropylene', 0.25, 0.2, 0.2, 0.15],
    ['tritan', 0.3, 0.25, 0.22, 0.16],
    ['beech', 0.4, 0.3, 0.3, 0.25],
    ['silicone', 0.8, 0.7, 0.5, 0.4],
  ];

  it('returns the kinetic value as the engine coefficient, with the static value beside it', () => {
    for (const [material, dryStatic, dryKinetic, wetStatic, wetKinetic] of table) {
      const dry = frictionPair(material, WIRE, false);
      const wet = frictionPair(material, WIRE, true);
      expect(dry.friction, material).toBe(dryKinetic);
      expect(dry.staticFriction, material).toBe(dryStatic);
      expect(wet.friction, material).toBe(wetKinetic);
      expect(wet.staticFriction, material).toBe(wetStatic);
      expect(dry.standIn, material).toBe(false);
      expect(dry.tag, material).toBe('ESTIMATED');
    }
  });

  it('gives the quick-reference defaults of items.md section 13', () => {
    // "Friction, typical hard item on coated wire, loading / wash: 0.25 / 0.15".
    expect(frictionPair('porcelain_glazed', WIRE, false).friction).toBe(0.25);
    expect(frictionPair('porcelain_glazed', WIRE, true).friction).toBe(0.15);
  });

  it('multiplies by 1.5 for a PVC-coated rack', () => {
    expect(PVC_RACK_FRICTION_FACTOR).toBe(1.5);
    for (const [material] of table) {
      for (const wet of [false, true]) {
        const nylon = frictionPair(material, WIRE, wet);
        const pvc = frictionPair(material, 'rack_wire_pvc', wet);
        expect(pvc.friction, material).toBeCloseTo(1.5 * nylon.friction, 3);
        expect(pvc.staticFriction ?? 0, material).toBeCloseTo(1.5 * (nylon.staticFriction ?? 0), 3);
      }
    }
  });
});

describe('friction item against item (items.md table 11.2)', () => {
  // [a, b, loading, wash].
  const table: readonly (readonly [string, string, number, number])[] = [
    ['porcelain_glazed', 'stoneware_glazed', 0.22, 0.13],
    ['porcelain_unglazed', 'porcelain_glazed', 0.4, 0.3],
    ['glass_soda_lime', 'glass_borosilicate', 0.2, 0.1],
    ['glass_soda_lime', 'porcelain_glazed', 0.2, 0.12],
    ['stainless_steel', 'porcelain_glazed', 0.16, 0.11],
    ['stainless_steel', 'glass_soda_lime', 0.16, 0.11],
    ['stainless_steel', 'stainless_steel', 0.25, 0.15],
    ['polypropylene', 'porcelain_glazed', 0.25, 0.15],
    ['melamine', 'glass_soda_lime', 0.25, 0.15],
    ['tritan', 'stainless_steel', 0.25, 0.15],
    ['polypropylene', 'melamine', 0.22, 0.14],
    ['beech', 'porcelain_glazed', 0.3, 0.25],
    ['silicone', 'glass_soda_lime', 0.7, 0.4],
    ['aluminium_nonstick', 'porcelain_glazed', 0.1, 0.08],
  ];

  it('returns the table rows', () => {
    for (const [a, b, loading, wash] of table) {
      expect(frictionPair(a, b, false).friction, `${a}/${b}`).toBe(loading);
      expect(frictionPair(a, b, true).friction, `${a}/${b}`).toBe(wash);
      expect(frictionPair(a, b, false).staticFriction, `${a}/${b}`).toBeNull();
    }
  });

  it('brackets the measured dry friction of real tableware (items.md 3.2, verified)', () => {
    // Matheus and Dollar 2010: object on a test surface, peak push force over weight.
    const measured: readonly (readonly [string, string, number, string])[] = [
      ['porcelain_glazed', 'stainless_steel', 0.162, 'ceramic mug on stainless steel'],
      ['porcelain_glazed', 'glass_soda_lime', 0.217, 'ceramic mug on glass'],
      ['stainless_steel', 'glass_soda_lime', 0.158, 'steel can on glass'],
      ['stainless_steel', 'stainless_steel', 0.17, 'steel can on stainless steel'],
      ['polypropylene', 'glass_soda_lime', 0.255, 'plastic bottle on glass'],
      ['polypropylene', 'stainless_steel', 0.304, 'plastic bottle on stainless steel'],
      ['aluminium_nonstick', 'stoneware_glazed', 0.139, 'non-stick pan on granite'],
    ];
    for (const [a, b, mu, what] of measured) {
      const [lo, hi] = frictionPair(a, b, false).frictionRange;
      expect(mu, what).toBeGreaterThanOrEqual(lo);
      expect(mu, what).toBeLessThanOrEqual(hi);
    }
  });

  it('marks the pairs the dossier has no row for', () => {
    expect(frictionPair('aluminium', 'porcelain_glazed', false).standIn).toBe(true);
    expect(frictionPair('cast_iron_seasoned', 'glass_soda_lime', false).standIn).toBe(true);
    expect(frictionPair('porcelain_unglazed', 'stainless_steel', false).standIn).toBe(true);
    expect(frictionPair('beech', 'bamboo', false).standIn).toBe(true);
    expect(frictionPair('rack_wire_pa11', 'rack_wire_pa11', false).standIn).toBe(true);
    expect(frictionPair('stainless_steel', 'porcelain_glazed', false).standIn).toBe(false);
  });
});

describe('pair lookup as a whole', () => {
  const ids = listMaterials().map((m) => m.id);

  it('is symmetric and defined for every pair of catalogue materials, dry and wet', () => {
    for (const a of ids) {
      for (const b of ids) {
        for (const wet of [false, true]) {
          const ab = frictionPair(a, b, wet);
          const ba = frictionPair(b, a, wet);
          expect(ab, `${a}/${b}`).toEqual(ba);
          expect(ab.friction, `${a}/${b}`).toBeGreaterThan(0);
          expect(ab.friction, `${a}/${b}`).toBeLessThanOrEqual(1.5);
          expect(ab.restitution, `${a}/${b}`).toBeGreaterThanOrEqual(0);
          expect(ab.restitution, `${a}/${b}`).toBeLessThanOrEqual(1);
          expect(ab.friction, `${a}/${b}`).toBeGreaterThanOrEqual(ab.frictionRange[0]);
          expect(ab.friction, `${a}/${b}`).toBeLessThanOrEqual(ab.frictionRange[1]);
          if (ab.staticFriction !== null) {
            expect(ab.staticFriction, `${a}/${b}`).toBeGreaterThanOrEqual(ab.friction);
          }
        }
      }
    }
  });

  it('never has more friction wet with detergent than dry', () => {
    for (const a of ids) {
      for (const b of ids) {
        expect(frictionPair(a, b, true).friction, `${a}/${b}`).toBeLessThanOrEqual(
          frictionPair(a, b, false).friction,
        );
      }
    }
  });

  it('has the restitution values of items.md 3.5 and 11.3', () => {
    // Item on coated wire: 0.25 ceramic, 0.30 glass and steel, 0.35 plastic.
    expect(frictionPair('porcelain_glazed', WIRE, false).restitution).toBe(0.25);
    expect(frictionPair('glass_soda_lime', WIRE, false).restitution).toBe(0.3);
    expect(frictionPair('stainless_steel', WIRE, false).restitution).toBe(0.3);
    expect(frictionPair('polypropylene', WIRE, false).restitution).toBe(0.35);
    expect(frictionPair('melamine', WIRE, false).restitution).toBe(0.35);
    expect(frictionPair('beech', WIRE, false).restitution).toBe(0.4);
    // Item on item, like on like: 0.50 ceramic, 0.60 glass, 0.45 steel, 0.40 wood and silicone.
    expect(frictionPair('porcelain_glazed', 'porcelain_glazed', false).restitution).toBe(0.5);
    expect(frictionPair('glass_soda_lime', 'glass_soda_lime', false).restitution).toBe(0.6);
    expect(frictionPair('stainless_steel', 'stainless_steel', false).restitution).toBe(0.45);
    expect(frictionPair('beech', 'beech', false).restitution).toBe(0.4);
    expect(frictionPair('silicone', 'silicone', false).restitution).toBe(0.4);
    // Mixed pairs: the more dissipative partner governs.
    expect(frictionPair('glass_soda_lime', 'porcelain_glazed', false).restitution).toBe(0.5);
    expect(frictionPair('glass_soda_lime', 'stainless_steel', false).restitution).toBe(0.45);
    expect(frictionPair('glass_soda_lime', 'silicone', true).restitution).toBe(0.4);
    // One value for both states.
    expect(frictionPair('glass_soda_lime', WIRE, true).restitution).toBe(0.3);
    // Inside the dossier's range of 0.05 to 0.3 (its default is 0.1); 0.2 is what the loading
    // engine was verified with, and the physics package reads this constant.
    expect(RESTITUTION_VELOCITY_THRESHOLD).toBe(0.2);
    expect(RESTITUTION_VELOCITY_THRESHOLD).toBeGreaterThanOrEqual(0.05);
    expect(RESTITUTION_VELOCITY_THRESHOLD).toBeLessThanOrEqual(0.3);
  });

  it('offers a lookup with the state already chosen, as the physics world takes it', () => {
    const dry = contactPairLookup(false);
    const wet = contactPairLookup(true);
    // On coated wire the rolling resistance is the dossier's 0.2 mm, the spin length 1.5 mm
    // (items.md section 3.6 and table 11.3).
    expect(dry('porcelain_glazed', WIRE)).toEqual({
      friction: 0.25,
      restitution: 0.25,
      rollingResistance: 2e-4,
      spinResistance: 1.5e-3,
    });
    expect(wet(WIRE, 'porcelain_glazed')).toEqual({
      friction: 0.15,
      restitution: 0.25,
      rollingResistance: 2e-4,
      spinResistance: 1.5e-3,
    });
  });

  it('resists rolling more on coated wire than hard on hard', () => {
    // items.md table 11.3: c_rr 2e-4 m on coated wire, 5e-5 m hard on hard; symmetric.
    expect(rollingResistanceLength('glass_soda_lime', WIRE)).toBe(2e-4);
    expect(rollingResistanceLength(WIRE, 'glass_soda_lime')).toBe(2e-4);
    expect(rollingResistanceLength('glass_soda_lime', 'stainless_steel')).toBe(5e-5);
    expect(contactPairLookup(false)('glass_soda_lime', 'stainless_steel').rollingResistance).toBe(
      ROLLING_RESISTANCE_LENGTH_HARD,
    );
    expect(ROLLING_RESISTANCE_LENGTH_ON_WIRE).toBe(2e-4);
    expect(SPIN_FRICTION_LENGTH).toBe(1.5e-3);
    expect(() => rollingResistanceLength('glass_soda_lime', 'unobtainium')).toThrow(RangeError);
  });

  it('goes by contact key, so materials that share a key share their pairs', () => {
    expect(frictionPair('glass_vitrelle', 'crystal_lead', false)).toEqual(
      contactKeyPair('glass', 'glass', false),
    );
    expect(frictionPair('carbon_steel', 'stainless_clad', true)).toEqual(
      contactKeyPair('stainless_steel', 'stainless_steel', true),
    );
  });

  it('throws for an unknown material', () => {
    expect(() => frictionPair('porcelain_glazed', 'unobtainium', false)).toThrow(RangeError);
  });
});
