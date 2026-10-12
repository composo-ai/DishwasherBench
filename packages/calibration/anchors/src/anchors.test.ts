import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createWashParams, soilData, washRegistry, type ItemWashResult } from '@spotless/sim-core';
import { readParamLayerFile, StaleParamSetError } from '@spotless/sim-core/node';
import { readParamSet } from '@spotless/sim-params';
import { describe, expect, it } from 'vitest';
import { groupMeanLogLikelihood, validateWashRecord } from '../../src/index.ts';
import {
  FITTED_KEYS,
  MECHANISM_CORRECTIONS,
  OWNER_CALIBRATED,
  OWNER_CAPSULE,
  OWNER_CAPSULE_STABLE,
} from './anchored.ts';
import { eggYolkRates, ikwResidues } from './bench.ts';
import { AUTO_COURSES } from './courses.ts';
import { ROUND_ROBIN_TA, STANDARD_COMPOSITION } from './literature.ts';
import { soilStandings } from './objective.ts';
import {
  ANCHORS_DIR,
  CURRENT_ANCHORED,
  STD_EU_13_SOILS,
  SUPERSEDED_ANCHORED,
  workingSoilDescription,
} from './scenario.ts';
import { readOverrides } from './sets.ts';

const setFiles = readdirSync(ANCHORS_DIR).filter(
  (f) => f.startsWith(`${CURRENT_ANCHORED}.`) && f.endsWith('.json'),
);
const anchored = readOverrides(join(ANCHORS_DIR, `${CURRENT_ANCHORED}.json`), true);

describe('the anchored parameter sets', () => {
  it('read against the registry: every key registered, every value inside its range', () => {
    expect(setFiles).toEqual(
      expect.arrayContaining([
        `${CURRENT_ANCHORED}.json`,
        `${CURRENT_ANCHORED}.owner-capsule.json`,
        `${CURRENT_ANCHORED}.owner-capsule.stable.json`,
      ]),
    );
    for (const file of setFiles) {
      const read = readParamSet(
        washRegistry(),
        JSON.parse(readFileSync(join(ANCHORS_DIR, file), 'utf8')) as unknown,
        { onHashMismatch: 'ignore' },
      );
      expect(read.ok ? [] : read.error, file).toEqual([]);
    }
    for (const file of readdirSync(join(ANCHORS_DIR, '..', 'detergents'))) {
      if (!file.endsWith('.json') || file.endsWith('.notes.json')) continue;
      expect(() => readOverrides(join(ANCHORS_DIR, '..', 'detergents', file), true)).not.toThrow();
    }
  });

  it('hold what the anchoring says they hold, and record the water side they were fitted on', () => {
    const document = JSON.parse(
      readFileSync(join(ANCHORS_DIR, `${CURRENT_ANCHORED}.json`), 'utf8'),
    ) as {
      anchoredOn?: { simVersion?: string; exposureSource?: string };
    };
    expect(document.anchoredOn?.simVersion).toMatch(/^spotless-sim /);
    expect(document.anchoredOn?.exposureSource).toMatch(/^[0-9a-f]{64}$/);
    const allowed = new Set([
      ...MECHANISM_CORRECTIONS.map((o) => o.key),
      ...FITTED_KEYS.map((k) => k.key),
      ...OWNER_CALIBRATED.map((o) => o.key),
      'soil.milk.rateRef',
    ]);
    for (const key of Object.keys(anchored)) expect(allowed.has(key), key).toBe(true);
    for (const o of MECHANISM_CORRECTIONS) expect(anchored[o.key], o.key).toBe(o.value);
    // What a wash of the owner's machine fixed is in the set, and names its record.
    for (const o of OWNER_CALIBRATED) expect(anchored[o.key], o.key).toBe(o.value);
    const provenance = (
      JSON.parse(readFileSync(join(ANCHORS_DIR, `${CURRENT_ANCHORED}.json`), 'utf8')) as {
        provenance: { washRecords?: string[] };
      }
    ).provenance;
    if (OWNER_CALIBRATED.length > 0) {
      expect(provenance.washRecords).toContain('owner-wash-01-egg-yolk-eco50');
    }
    // The milk class follows the egg-yolk rate (it has no rate data of its own).
    expect(anchored['soil.milk.rateRef']).toBe(anchored['soil.egg_yolk.rateRef']);
    // The capsule layer: the capsule's own protease level, not the one fitted for detergent D.
    const capsule = readOverrides(
      join(ANCHORS_DIR, `${CURRENT_ANCHORED}.owner-capsule.json`),
      true,
    );
    for (const o of OWNER_CAPSULE) expect(capsule[o.key], o.key).toBe(o.value);
    // The machine is the same under either detergent: the capsule layer keeps what his wash fixed.
    for (const o of OWNER_CALIBRATED) expect(capsule[o.key], o.key).toBe(o.value);
    expect(capsule['liq.proteaseHalfLife']).toBeUndefined();
    const stable = readOverrides(
      join(ANCHORS_DIR, `${CURRENT_ANCHORED}.owner-capsule.stable.json`),
      true,
    );
    for (const o of OWNER_CAPSULE_STABLE) expect(stable[o.key], o.key).toBe(o.value);
    expect(capsule['soil.egg_yolk.rateRef']).toBe(anchored['soil.egg_yolk.rateRef']);
  });

  it('are current for the code on disk, every layer, and no superseded set can be read as current', () => {
    // The set the game washes with and its layers: read as every wash reads them.
    for (const file of setFiles) {
      const layer = readParamLayerFile(join(ANCHORS_DIR, file));
      expect(layer.stale, file).toBeUndefined();
      expect(layer.origin, file).toBe('calibration');
    }
    // Every anchored set of the directory is either the current one or listed as superseded,
    // and a superseded one says so in each of its files: it is refused whatever code is on
    // disk, and read only when stale sets are accepted, marked stale.
    const names = new Set(
      readdirSync(ANCHORS_DIR)
        .map((file) => /^(anchored-v\d+)\..*json$/.exec(file)?.[1])
        .filter((name): name is string => name !== undefined),
    );
    expect([...names].sort()).toEqual(
      [CURRENT_ANCHORED, ...Object.keys(SUPERSEDED_ANCHORED)].sort(),
    );
    for (const name of Object.keys(SUPERSEDED_ANCHORED)) {
      const files = readdirSync(ANCHORS_DIR).filter(
        (file) => file.startsWith(`${name}.`) && file.endsWith('.json'),
      );
      expect(files.length, name).toBeGreaterThanOrEqual(3);
      for (const file of files) {
        const path = join(ANCHORS_DIR, file);
        const mark = (JSON.parse(readFileSync(path, 'utf8')) as { supersededBy?: { set?: string } })
          .supersededBy;
        expect(mark?.set, file).toMatch(/^anchored-v\d+$/);
        expect(() => readParamLayerFile(path), file).toThrow(StaleParamSetError);
        expect(() => readParamLayerFile(path), file).toThrow(/superseded: replaced by anchored-v/);
        expect(readParamLayerFile(path, { acceptStale: true }).stale, file).toBe(true);
      }
    }
  });

  it('keep the six in-machine egg-yolk rates within their tolerances, and the IKW programme partial', () => {
    const params = createWashParams(anchored);
    const rates = eggYolkRates(params);
    expect(rates).toHaveLength(6);
    for (const r of rates) {
      expect(r.within, `${r.temperature} C, pH ${r.pH}, ${r.protease}: ${r.simulated}`).toBe(true);
    }
    // soils 6.4: the IKW programme must not clean the IKW soils.
    for (const r of ikwResidues(params)) expect(r.residue, r.soil).toBe(true);
  });
});

describe('the scenario and the literature record', () => {
  it('gives the wash the dry mass of every working soil through the solids fraction of its soil id', () => {
    for (const [itemType, soils] of Object.entries(STD_EU_13_SOILS)) {
      for (const soil of Object.values(soils)) {
        const datum = soilData(soil.type);
        expect(datum, soil.type).toBeDefined();
        const description = workingSoilDescription(soil);
        expect(
          description.amount_g * (datum?.solidsFraction ?? 0),
          `${soil.type} on ${itemType}`,
        ).toBeCloseTo(soil.dry_g, 9);
        // The amount handed over is the wet amount of the dossier where the soil is stated
        // wet (to 5 %; the milk is 10 mL at 1.03 g/mL), and the dry film for a stain.
        // The margarine is the exception: the scenario lays down 0.3 g of fat (0.37 g of a
        // spread that is 82 % fat), as the second anchoring did.
        if (datum?.basis === 'wet' && soil.type !== 'iec_margarine') {
          expect(description.amount_g / soil.wet_g, `${soil.type} on ${itemType}`).toBeGreaterThan(
            0.95,
          );
          expect(description.amount_g / soil.wet_g, `${soil.type} on ${itemType}`).toBeLessThan(
            1.05,
          );
        }
      }
    }
  });

  it('is a valid wash record whose class means are those of the round robin', () => {
    const file = join(
      ANCHORS_DIR,
      'records',
      'std-eu-13.round-robin-ta.detergent-d.literature.json',
    );
    const json = JSON.parse(readFileSync(file, 'utf8')) as {
      aggregates: { id: string; value?: number; sd: number }[];
    };
    const checked = validateWashRecord(json);
    expect(checked.ok ? [] : checked.error).toEqual([]);
    const byId = new Map(json.aggregates.map((a) => [a.id, a]));
    expect(byId.get('crockery.mean_score')?.value).toBe(ROUND_ROBIN_TA.D.crockery[0]);
    expect(byId.get('cutlery.mean_score')?.value).toBe(ROUND_ROBIN_TA.D.cutlery[0]);
    expect(byId.get('glass.mean_score')?.value).toBe(ROUND_ROBIN_TA.D.glass[0]);
    // The tea is read by the fit: the crockery mean carries no allowance for it any more.
    expect(byId.get('crockery.mean_score')?.sd).toBeLessThan(1.2);
    // 140 items in the standard load, of which the pots are 2.
    expect(Object.values(STANDARD_COMPOSITION).reduce((a, b) => a + b, 0)).toBe(140);
    // The published crockery mean, with every plate and bowl at 5, needs the tea at 2.2.
    const tea = (ROUND_ROBIN_TA.D.crockery[0] * 40 - 21 * 5) / 19;
    expect(tea).toBeCloseTo(2.22, 2);
    expect(groupMeanLogLikelihood(3.68, 3.68, 1.11)).toBeGreaterThan(
      groupMeanLogLikelihood(3.68, 2.56, 1.11),
    );
  });

  it('builds the candidate courses of Auto with a staged heat-up where one is named', () => {
    expect(AUTO_COURSES['as_written']?.()).toBeNull();
    const staged = AUTO_COURSES['staged_55']?.();
    const kinds = (staged?.steps ?? []).filter((s) => s.phase === 'main_wash').map((s) => s.kind);
    expect(kinds.join(',')).toContain('heat,hold,heat,hold');
    const single = AUTO_COURSES['single_55']?.();
    expect(
      (single?.steps ?? []).filter((s) => s.kind === 'heat' && s.phase === 'main_wash'),
    ).toHaveLength(1);
  });
});

describe('the standing of a soil in a wash', () => {
  // Twelve dinner plates and twelve tea cups in the standard load; the wash holds two of each.
  const composition = { dinner_plate_porcelain_iec: 12, tea_cup_porcelain_210: 12 };
  const item = (typeId: string, soil: string, score: number): ItemWashResult =>
    ({ typeId, score, soils: [{ type: soil }] }) as unknown as ItemWashResult;

  it('caps the class mean at what the other items could make up at the top of the scale', () => {
    const standing = soilStandings(
      [
        item('dinner_plate_porcelain_iec', 'iec_egg_yolk', 3),
        item('dinner_plate_porcelain_iec', 'iec_egg_yolk', 4),
        item('tea_cup_porcelain_210', 'iec_tea', 0),
        item('tea_cup_porcelain_210', 'iec_tea', 1),
      ],
      composition,
    );
    // Tea at 0 and 1 with every plate at 5: (12 x 5 + 12 x 0.5) / 24.
    expect(standing['iec_tea']?.mean).toBeCloseTo(0.5, 12);
    expect(standing['iec_tea']?.items).toBe(2);
    expect(standing['iec_tea']?.ceiling.crockery).toBeCloseTo(2.75, 12);
    expect(standing['iec_tea']?.ceiling.all).toBeCloseTo(2.75, 12);
    // The plates as they scored with every cup at 5: (12 x 3.5 + 12 x 5) / 24.
    expect(standing['iec_egg_yolk']?.ceiling.crockery).toBeCloseTo(4.25, 12);
    // A class that holds none of the soil has no ceiling from it.
    expect(standing['iec_tea']?.ceiling.cutlery).toBeUndefined();
  });
});
