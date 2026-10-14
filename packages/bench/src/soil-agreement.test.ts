// The soil data of the catalogue and the soil records of every level of the game against the
// wash simulation's own table by soil id, and what the level card says is in the dispenser
// against what the wash runner puts there. The simulation's table is the reference
// (docs/calibration/soil-quantities.md); it is read here from its source by path, as the
// catalogue and the levels may not depend on the simulation and this package depends on it only
// through the wash runner.
import { getSoil, instantiate, listSoils } from '../../catalogue/src/index.ts';
import {
  allLevels,
  GAME_DETERGENTS,
  GAME_PROGRAMME_ID,
  generatedLevels,
  isSoakSensitiveSoil,
  isUnsettledSoil,
  levelCard,
  levelSoilFindings,
  SOAK_SENSITIVE_SOILS,
  soilRecordQuantities,
  unsettledItems,
  validateLevel,
} from '@spotless/levels';
import { MACHINE_WASH_DEFAULTS, washCaveatsFor } from '@spotless/wash-runner/contract';
import { describe, expect, it } from 'vitest';
import { SOIL_DATA, heatStepOf, soilData } from '../../sim-soil/src/soil-data.ts';

describe('the soils the levels keep off the table', () => {
  it('are the soils of the egg-yolk and starch classes of the simulation, and no others', () => {
    // The verdict of these two classes turns on the soak of Eco 50, which the anchoring has
    // not settled (docs/calibration/anchoring-v5.md section 3; docs/benchmark/levels.md
    // section 4): the levels of the game carry them on the pans only.
    const ofClass = Object.entries(SOIL_DATA)
      .filter(([, datum]) => datum.modelClass === 'egg_yolk' || datum.modelClass === 'starch')
      .map(([id]) => id)
      .sort();
    expect([...SOAK_SENSITIVE_SOILS].sort()).toEqual(ofClass);
    for (const id of Object.keys(SOIL_DATA)) {
      expect(isSoakSensitiveSoil(id), id).toBe(ofClass.includes(id));
    }
  });
});

describe('the catalogue against the soil table of the wash simulation', () => {
  it('has the same soils', () => {
    expect(listSoils().map((soil) => soil.id)).toEqual(Object.keys(SOIL_DATA).sort());
  });

  it('gives every soil the same basis, solids, loading, coverage, ageing and appearance', () => {
    for (const soil of listSoils()) {
      const datum = SOIL_DATA[soil.id];
      expect(datum, soil.id).toBeDefined();
      if (datum === undefined) continue;
      expect(
        {
          basis: soil.working.basis,
          solidsFraction: soil.working.solidsFraction,
          solidsSource: soil.working.solidsSource,
          gPerM2: soil.working.gPerM2,
          rangeGPerM2: [...soil.working.rangeGPerM2],
          coverage: soil.working.coverage,
          heatHistory: soil.working.heatHistory,
          ageH: soil.working.ageH,
          appearance: soil.working.appearance,
          laidOn: soil.working.laidOn,
        },
        soil.id,
      ).toEqual({
        basis: datum.basis,
        solidsFraction: datum.solidsFraction,
        solidsSource: datum.solidsSource,
        gPerM2: datum.loading,
        rangeGPerM2: [...datum.loadingRange],
        coverage: datum.coverage,
        heatHistory: datum.heatHistory,
        ageH: datum.ageH,
        appearance: datum.appearance,
        laidOn: datum.application,
      });
    }
  });

  it('calls unsettled exactly the soils the simulation models as a bleachable stain', () => {
    for (const soil of listSoils()) {
      expect(isUnsettledSoil(soil.id), soil.id).toBe(SOIL_DATA[soil.id]?.modelClass === 'tea');
    }
  });
});

describe('the soil records of every level against the soil table', () => {
  // The seven levels of the course and the six the generator draws, which are not listed.
  const levels = [...allLevels(), ...generatedLevels()];

  it('are those of thirteen valid levels: the seven of the course and six generated ones', () => {
    expect(allLevels().length).toBe(7);
    expect(levels.length).toBe(13);
    expect(levels.filter((level) => level.family !== undefined).length).toBe(6);
    for (const level of levels) expect(validateLevel(level), level.id).toEqual([]);
  });

  it('state an amount that lies in the range of the soil on the area it covers', () => {
    let records = 0;
    for (const level of levels) {
      // The level's own check, against the catalogue ...
      expect(levelSoilFindings(level), level.id).toEqual([]);
      // ... and the same arithmetic against the simulation's table, from the item's shape.
      for (const item of level.items) {
        const areas = instantiate(item.itemType).regionAreas;
        for (const soil of item.soils) {
          const datum = soilData(soil.type);
          expect(datum, `${level.id} ${item.id} ${soil.type}`).toBeDefined();
          if (datum === undefined) continue;
          let area = 0;
          for (const region of soil.regions) area += (areas[region.region] ?? 0) * region.coverage;
          expect(area, `${level.id} ${item.id}`).toBeGreaterThan(0);
          const loading = soil.amountG / area;
          const where = `${level.id} ${item.id} ${soil.type}: ${loading.toPrecision(3)} g/m2`;
          expect(loading, where).toBeGreaterThanOrEqual(datum.loadingRange[0] * 0.99);
          expect(loading, where).toBeLessThanOrEqual(datum.loadingRange[1] * 1.01);
          // The dry matter the wash will read from the record is what the level's check says.
          expect(soilRecordQuantities(item, soil).dryGPerM2).toBeCloseTo(
            loading * datum.solidsFraction,
            9,
          );
          records += 1;
        }
      }
    }
    expect(records).toBeGreaterThan(500);
  });

  it('carry a heat history the simulation reads as the level states it, or milder', () => {
    for (const level of levels) {
      for (const item of level.items) {
        for (const soil of item.soils) {
          expect(getSoil(soil.type).heatHistories, `${level.id} ${item.id}`).toContain(
            soil.heatHistory,
          );
          // No level soil is one whose heat history the model reads as another step.
          expect(heatStepOf(soil.type, soil.heatHistory), `${level.id} ${item.id}`).toBe(
            soil.heatHistory,
          );
        }
      }
    }
  });

  it('carry no soil whose verdict the simulation does not settle', () => {
    for (const level of levels) {
      expect(unsettledItems(level), level.id).toEqual([]);
      for (const item of level.items) {
        for (const soil of item.soils) {
          expect(SOIL_DATA[soil.type]?.modelClass, `${level.id} ${item.id}`).not.toBe('tea');
        }
      }
    }
  });
});

describe('the programme and the detergent of the game', () => {
  it('is Eco 50 on every level, and no level offers another programme', () => {
    expect(GAME_PROGRAMME_ID).toBe('eco_50');
    for (const level of allLevels()) {
      expect(level.programmeId, level.id).toBe('eco_50');
      const card = levelCard(level);
      expect(card.programme.programme_id).toBe('eco_50');
      expect(card.programme.status).toBe('scored');
      expect(card.secondary_programmes, level.id).toEqual([]);
    }
  });

  it('is washed with the parameters the calibration vouches for on the scored programme', () => {
    for (const level of allLevels()) {
      // No caveat on the scored programme: no verdict of a level is provisional by the set.
      expect(washCaveatsFor(level.machineId, level.programmeId), level.id).toEqual([]);
    }
  });

  it('names on the card the detergent and the dose the wash runner washes with', () => {
    for (const machineId of Object.keys(GAME_DETERGENTS)) {
      const card = GAME_DETERGENTS[machineId];
      const runner = MACHINE_WASH_DEFAULTS[machineId]?.detergent;
      expect(runner, machineId).toBeDefined();
      expect(card?.name).toBe(runner?.name);
      expect(card?.doseG).toBe(runner?.dose_g);
    }
    const card = levelCard(allLevels()[0] as ReturnType<typeof allLevels>[number]);
    expect(card.programme.detergent).toEqual({
      type: 'finish_powerball_ultimate',
      dose_g: 12.9,
      name: 'Finish Powerball Ultimate',
    });
  });
});
