import { describe, expect, it } from 'vitest';
import { hydraulicOperatingPoint } from './hydraulics.ts';
import {
  airFractionFromSump,
  carryOverFraction,
  filterFlowSplit,
  MAX_AIR_FRACTION,
  primedOperatingPoint,
  waterInventory,
} from './inventory.ts';
import { BOSCH_SMV4HAX40G, SPOT_60 } from './machines.ts';
import { expectNear, expectWithin, toLitres, toLPerMin } from './test-util.ts';

const L = 1e-3;

describe('the water inventory of the Bosch (dossier section 3.5 with the flows of the owner update, section 5.1)', () => {
  // The dossier's table of section 3.5 with its flows replaced by those of the owner update
  // (section 7: "27.9 and 25.2 L/min become 30.5 and 28.4, which changes the water in flight by
  // under 0.1 L"; 26.0 and 23.2 L/min at 2800 rpm become 28.4 and 26.2). The hold-up is the flow
  // times t_flight + t_return = 2.0 s and the sump is what is left of the bath, by hand:
  //   30.5 L/min x 2 s = 1.02 L; 4.4 - 0.25 - 1.02 = 3.13 L   (dossier 0.93 and 3.2)
  //   28.4 L/min x 2 s = 0.95 L; 4.4 - 0.50 - 0.95 = 2.95 L   (dossier 0.84 and 3.1)
  //   28.4 L/min x 2 s = 0.95 L; 2.9 - 0.25 - 0.95 = 1.70 L   (dossier 0.87 and 1.8)
  //   26.2 L/min x 2 s = 0.87 L; 2.9 - 0.50 - 0.87 = 1.53 L   (dossier 0.77 and 1.6)
  // [water in the tub L, state, pump rpm, Q L/min, pipes L, in flight and on surfaces L, sump L].
  const table = [
    [4.4, 'l', 3000, 30.5, 0.25, 1.02, 3.13],
    [4.4, 'ur', 3000, 28.4, 0.5, 0.95, 2.95],
    [2.9, 'l', 2800, 28.4, 0.25, 0.95, 1.7],
    [2.9, 'ur', 2800, 26.2, 0.5, 0.87, 1.53],
  ] as const;

  it.each(table)('%f L in state %s at %i rpm', (water, state, rpm, flow, pipes, holdUp, sump) => {
    const point = hydraulicOperatingPoint(BOSCH_SMV4HAX40G, state, rpm);
    const feeds = point.branches.map((b) => b.id);
    const inventory = waterInventory(BOSCH_SMV4HAX40G, water * L, point.flow, feeds);
    expectNear(toLPerMin(point.flow), flow, 0.06);
    expectNear(toLitres(inventory.pipes), pipes, 1e-9);
    expectNear(toLitres(inventory.inFlight + inventory.onSurfaces), holdUp, 0.006);
    expectNear(toLitres(inventory.sump), sump, 0.012);
    // t_flight 0.5 s and t_return 1.5 s: a quarter in the air, three quarters on surfaces.
    expectWithin(inventory.inFlight, point.flow * 0.5, 1e-12);
    expectWithin(inventory.onSurfaces, point.flow * 1.5, 1e-12);
    expect(inventory.primed).toBe(true);
    expect(inventory.airFraction).toBe(0);
    expect(inventory.headFactor).toBe(1);
    // The parts add up to the water in the machine.
    expectWithin(
      inventory.sump + inventory.pipes + inventory.inFlight + inventory.onSurfaces,
      water * L,
      1e-12,
    );
  });

  it('a rinse bath leaves about 1.5 L in the sump: one trapped litre is marginal', () => {
    // Dossier: "The 2.5 L rinse baths leave about 1.6 L in the sump against a prime limit of
    // 0.5 L: one litre trapped in upright bowls is survivable in the wash and marginal in the
    // rinses." With the larger measured nozzles the upper level takes 26.2 L/min at 2800 rpm
    // and the sump keeps 1.53 L: one trapped litre leaves 0.53 L, 0.03 L above the limit
    // (the dossier had 0.63 L).
    const point = hydraulicOperatingPoint(BOSCH_SMV4HAX40G, 'ur', 2800);
    const rinse = waterInventory(BOSCH_SMV4HAX40G, 2.9 * L, point.flow, ['upper', 'roof'], {
      trapped: 1.0 * L,
    });
    expectNear(toLitres(rinse.sump), 1.53 - 1.0, 0.012);
    expect(rinse.sump).toBeGreaterThan(BOSCH_SMV4HAX40G.hydraulics.inventory.minSumpVolume);
    expect(rinse.primed).toBe(true);
    const more = waterInventory(BOSCH_SMV4HAX40G, 2.9 * L, point.flow, ['upper', 'roof'], {
      trapped: 1.2 * L,
    });
    expect(more.primed).toBe(false);
    const wash = hydraulicOperatingPoint(BOSCH_SMV4HAX40G, 'l', 3000);
    expect(
      waterInventory(BOSCH_SMV4HAX40G, 4.4 * L, wash.flow, ['lower'], { trapped: 1.0 * L }).sump,
    ).toBeGreaterThan(2 * L);
  });

  it('takes measured hold-up in place of the flight and return times when it is given', () => {
    const inventory = waterInventory(BOSCH_SMV4HAX40G, 4.4 * L, 27.9 / 60000, ['lower'], {
      inFlight: 0.1 * L,
      onSurfaces: 0.6 * L,
      filterHeld: 0.3 * L,
      absorbed: 0.05 * L,
    });
    // 4.4 - 0.25 - 0.1 - 0.6 - 0.3 - 0.05 = 3.1 L.
    expectNear(toLitres(inventory.sump), 3.1, 1e-9);
  });
});

describe('loss of prime (machine.md section 4.5)', () => {
  it('alpha = clamp(1 - V_sump / V_min, 0, 0.6)', () => {
    expect(airFractionFromSump(0.5 * L, 0.5 * L)).toBe(0);
    expect(airFractionFromSump(2 * L, 0.5 * L)).toBe(0);
    expectNear(airFractionFromSump(0.4 * L, 0.5 * L), 0.2, 1e-12);
    expectNear(airFractionFromSump(0.25 * L, 0.5 * L), 0.5, 1e-12);
    expect(airFractionFromSump(0, 0.5 * L)).toBe(MAX_AIR_FRACTION);
    expect(airFractionFromSump(-1 * L, 0.5 * L)).toBe(0.6);
  });

  it('reports a dry sump as zero volume with no head left', () => {
    const inventory = waterInventory(SPOT_60, 0.5 * L, 30 / 60000, ['lower']);
    expect(inventory.sump).toBe(0);
    expect(inventory.airFraction).toBe(0.6);
    expect(inventory.headFactor).toBe(0);
    expect(inventory.primed).toBe(false);
  });

  it('finds the self-consistent operating point when the sump runs low', () => {
    // SPOT-60, lower arm at 3000 rpm with only 1.6 L in the machine: at full prime the pump
    // would circulate 30.7 L/min and hold 1.02 L in the air and on the load, leaving
    // 1.6 - 0.25 - 1.02 = 0.33 L in the sump, below the 0.5 L it needs.
    const full = hydraulicOperatingPoint(SPOT_60, 'l', 3000);
    expectNear(toLitres(waterInventory(SPOT_60, 1.6 * L, full.flow, ['lower']).sump), 0.33, 0.01);
    const { point, inventory } = primedOperatingPoint(SPOT_60, 'l', 3000, 1.6 * L);
    // The head factor used in the solve is the one the resulting sump volume gives.
    expectNear(point.headFactor, inventory.headFactor, 1e-9);
    expect(point.headFactor).toBeLessThan(1);
    expect(point.headFactor).toBeGreaterThan(0);
    expect(point.flow).toBeLessThan(full.flow);
    // Less flow, less water held up, so more left in the sump than at full prime.
    expect(inventory.sump).toBeGreaterThan(0.33 * L);
    expect(inventory.sump).toBeLessThan(0.5 * L);
    // alpha = 1 - V_sump / V_min and f_H = 1 - 2.5 alpha, on the returned numbers.
    expectNear(inventory.airFraction, 1 - inventory.sump / (0.5 * L), 1e-12);
    expectNear(inventory.headFactor, 1 - 2.5 * inventory.airFraction, 1e-12);
  });

  it('is the full-prime point when there is water enough', () => {
    const { point, inventory } = primedOperatingPoint(BOSCH_SMV4HAX40G, 'l', 3000, 4.4 * L);
    expect(inventory.primed).toBe(true);
    expect(point.headFactor).toBe(1);
    expect(point.flow).toBe(hydraulicOperatingPoint(BOSCH_SMV4HAX40G, 'l', 3000).flow);
  });

  it('with almost no water the pump moves almost nothing', () => {
    const { point, inventory } = primedOperatingPoint(SPOT_60, 'l', 3000, 0.45 * L);
    // Even at rest the sump would hold 0.45 - 0.25 = 0.2 L: alpha 0.6, no head at all.
    expect(inventory.headFactor).toBe(0);
    expect(point.flow).toBe(0);
  });
});

describe('carry-over and filters', () => {
  it('each Bosch rinse dilutes what the drain leaves by 0.14: about 50-fold to the final rinse', () => {
    // Section 3.5: "0.4 / 2.9 = 0.14 ... diluted about 50-fold through one intermediate rinse".
    const f = carryOverFraction(0.4 * L, 2.5 * L);
    expectNear(f, 0.14, 0.005);
    expectNear(1 / (f * f), 50, 3);
  });

  it('the generic baseline: 0.18 per rinse, about 30-fold through two (machine.md 4.6)', () => {
    const f = carryOverFraction(0.65 * L, 2.9 * L);
    expectNear(f, 0.18, 0.005);
    expectNear(1 / (f * f), 30, 1);
    expect(carryOverFraction(0, 0)).toBe(0);
  });

  it('splits the Bosch return flow 57 % / 43 % between plate and cover and the micro filter', () => {
    // Section 3.5: "flat plate 88 cm2 and sump cover 26 cm2 to the pump directly, micro filter
    // 85 cm2 through the cylinder: 57 % / 43 %".
    const split = filterFlowSplit(BOSCH_SMV4HAX40G.filter);
    expectNear(split.directOpenArea * 1e4, 88 + 26, 1e-9);
    expectNear(split.microOpenArea * 1e4, 85, 0.2);
    expectNear(split.direct, 0.57, 0.005);
    expectNear(split.micro, 0.43, 0.005);
    expectNear(split.direct + split.micro, 1, 1e-12);
    // The dossier's "27.9 / 4.4 = 6.3 passes per minute in the wash" becomes 30.5 / 4.4 = 6.9
    // with the flow of the owner update.
    const point = hydraulicOperatingPoint(BOSCH_SMV4HAX40G, 'l', 3000);
    expectNear(toLPerMin(point.flow) / 4.4, 30.5 / 4.4, 0.02);
    expectNear(toLPerMin(point.flow) / 4.4, 6.9, 0.05);
  });

  it('splits the SPOT-60 return flow 51 % / 49 % (machine.md 5.2)', () => {
    const split = filterFlowSplit(SPOT_60.filter);
    expectNear(split.directOpenArea * 1e4, 80, 1e-9);
    expectNear(split.microOpenArea * 1e4, 76, 1e-9);
    expectNear(split.direct, 0.51, 0.005);
    expectNear(split.micro, 0.49, 0.005);
  });

  it('the Bosch flat filter has the open fraction of its hole pattern', () => {
    // Section 2.10: round holes on a 60 deg lattice, 0.907 x (0.85 / 1.47)^2 = 0.30.
    const plate = BOSCH_SMV4HAX40G.filter.flatPlate;
    const pitch = plate.holePitch ?? Number.NaN;
    expectNear(
      (Math.PI / (2 * Math.sqrt(3))) * (plate.holeDiameter / pitch) ** 2,
      plate.openFraction,
      0.005,
    );
    // The micro filter: 230 cm2 of mesh at 0.37 open.
    expectNear(
      BOSCH_SMV4HAX40G.filter.micro.area * BOSCH_SMV4HAX40G.filter.micro.openFraction * 1e4,
      85.1,
      0.05,
    );
  });
});
