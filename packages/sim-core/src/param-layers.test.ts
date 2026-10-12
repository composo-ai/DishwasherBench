// Named parameter sets as layers of a wash: how a detergent is laid over a fitted set, and how
// a stale file fails.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { composeParamLayers, createWashParams, washRegistry } from './index.ts';
import {
  anchoredOnNow,
  composeParamFiles,
  ParamSetFileError,
  readParamLayerFile,
  StaleParamSetError,
} from './node/index.ts';

const registry = washRegistry();
const dir = mkdtempSync(join(tmpdir(), 'spotless-params-'));
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Writes a parameter set as `ParamSet.toJSON` gives it, optionally changed, and returns its path. */
function fileOf(
  name: string,
  overrides: Record<string, number>,
  origin: 'calibration' | 'manual' = 'manual',
  change: (json: Record<string, unknown>) => void = () => {},
): string {
  const json = JSON.parse(
    JSON.stringify(createWashParams(overrides, { name, origin }).toJSON()),
  ) as Record<string, unknown>;
  // A calibrated set says which water side it was fitted on.
  if (origin === 'calibration') json['anchoredOn'] = anchoredOnNow();
  change(json);
  const path = join(dir, `${name}.json`);
  writeFileSync(path, JSON.stringify(json));
  return path;
}

describe('layers of parameter sets', () => {
  const proteaseDefault = registry.def('liq.xProtease').default as number;

  it('lays later sets over earlier ones and records each', () => {
    const { params, records } = composeParamLayers(registry, [
      { name: 'first', role: 'set', overrides: { 'soil.subCellCv': 0.3, 'liq.xProtease': 0.02 } },
      { name: 'second', role: 'set', overrides: { 'soil.subCellCv': 0.2 }, origin: 'calibration' },
    ]);
    expect(params).toEqual({ 'soil.subCellCv': 0.2, 'liq.xProtease': 0.02 });
    expect(records.map((r) => [r.name, r.role, r.origin, r.keys, r.stale, r.scaled])).toEqual([
      ['first', 'set', 'manual', 2, false, []],
      ['second', 'set', 'calibration', 1, false, []],
    ]);
    expect(records[0]?.overridesHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(records[0]?.overridesHash).not.toBe(records[1]?.overridesHash);
    // The composed overrides are a valid parameter set.
    expect(() => createWashParams(params)).not.toThrow();
  });

  it('scales a key a fitted set moved by what the detergent states against the reference', () => {
    // The fit made the reference detergent worth twice its nominal protease; the capsule
    // states 2.5 times the reference level: 2 x 2.5 = 5 times the default, held to the range.
    const fitted = 2 * proteaseDefault;
    const stated = 2.5 * proteaseDefault;
    const max = (registry.def('liq.xProtease') as { max: number }).max;
    const { params, records } = composeParamLayers(registry, [
      { name: 'anchored', role: 'set', overrides: { 'liq.xProtease': fitted } },
      {
        name: 'capsule',
        role: 'detergent',
        overrides: { 'liq.xProtease': stated, 'liq.xSilicate': 0 },
      },
    ]);
    expect(params['liq.xProtease']).toBeCloseTo(Math.min(max, 5 * proteaseDefault), 12);
    // A key the fit did not touch is the detergent's own.
    expect(params['liq.xSilicate']).toBe(0);
    expect(records[1]?.scaled).toEqual(['liq.xProtease']);
    // Without a fitted value under it, the detergent's level is taken as stated; and a later
    // set (not a detergent) replaces.
    expect(
      composeParamLayers(registry, [
        { name: 'capsule', role: 'detergent', overrides: { 'liq.xProtease': stated } },
      ]).params['liq.xProtease'],
    ).toBe(stated);
    expect(
      composeParamLayers(registry, [
        { name: 'anchored', role: 'set', overrides: { 'liq.xProtease': fitted } },
        { name: 'other', role: 'set', overrides: { 'liq.xProtease': stated } },
      ]).params['liq.xProtease'],
    ).toBe(stated);
  });
});

describe('parameter-set files', () => {
  it('reads a file written against this registry', () => {
    const path = fileOf('fresh', { 'soil.subCellCv': 0.3 }, 'calibration');
    expect(readParamLayerFile(path)).toEqual({
      name: 'fresh',
      role: 'set',
      overrides: { 'soil.subCellCv': 0.3 },
      origin: 'calibration',
      file: path,
    });
  });

  it('fails loudly on a stale file, saying what does not match and what to do', () => {
    // Written when the soil side resolved to other values: the stored hash no longer matches.
    const path = fileOf('old-anchoring', { 'soil.subCellCv': 0.3 }, 'calibration', (json) => {
      json['soilHash'] = `sha256:${'0'.repeat(64)}`;
    });
    let thrown: unknown;
    try {
      readParamLayerFile(path);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(StaleParamSetError);
    const error = thrown as StaleParamSetError;
    expect(error.setName).toBe('old-anchoring');
    expect(error.issues.map((issue) => issue.code)).toEqual(['hash-mismatch']);
    expect(error.message).toContain(path);
    expect(error.message).toContain('soilHash');
    expect(error.message).toContain('What to do');
    expect(error.message).toContain('anchors/scripts/fit.ts');
    expect(error.message).toContain('--accept-stale-params');
    // A detergent set is told how a detergent set is made.
    const detergent = fileOf('old-capsule', { 'liq.xSilicate': 0 }, 'manual', (json) => {
      json['hydroHash'] = `sha256:${'1'.repeat(64)}`;
    });
    expect(() => readParamLayerFile(detergent, { role: 'detergent' })).toThrow(
      /hydroHash[\s\S]*write the detergent set again/,
    );
    // A unit that changed under an overridden key is as stale.
    const unit = fileOf('old-unit', { 'soil.subCellCv': 0.3 }, 'manual', (json) => {
      (json['definitions'] as Record<string, { unit: string }>)['soil.subCellCv'] = {
        ...(json['definitions'] as Record<string, { unit: string }>)['soil.subCellCv'],
        unit: 'percent',
      } as { unit: string };
    });
    expect(() => readParamLayerFile(unit)).toThrow(StaleParamSetError);
  });

  it('takes a calibrated set as stale when the water side it was fitted on is not the one on disk', () => {
    // The registry hashes are those of today (the file was written again without a fit), but
    // the set was fitted on another water side: the review's case of 10 October 2026.
    const version = fileOf('restamped', { 'soil.subCellCv': 0.3 }, 'calibration', (json) => {
      json['anchoredOn'] = { ...anchoredOnNow(), simVersion: 'spotless-sim 0.3.2 water-3' };
    });
    expect(() => readParamLayerFile(version)).toThrow(
      /water side: fitted on spotless-sim 0\.3\.2 water-3[\s\S]*revalidate\.ts/,
    );
    const sources = fileOf('other-sources', { 'soil.subCellCv': 0.3 }, 'calibration', (json) => {
      json['anchoredOn'] = { ...anchoredOnNow(), exposureSource: 'f'.repeat(64) };
    });
    expect(() => readParamLayerFile(sources)).toThrow(/fitted on exposure sources ffffffffffff/);
    // A calibrated set that does not say what it was fitted on is not taken on trust.
    const silent = fileOf('silent', { 'soil.subCellCv': 0.3 }, 'calibration', (json) => {
      delete json['anchoredOn'];
    });
    expect(() => readParamLayerFile(silent)).toThrow(StaleParamSetError);
    // Accepted knowingly, it is read and marked; a hand-made set carries no such record.
    expect(readParamLayerFile(sources, { acceptStale: true }).stale).toBe(true);
    expect(readParamLayerFile(fileOf('by-hand', { 'soil.subCellCv': 0.3 })).stale).toBeUndefined();
    expect(
      readParamLayerFile(fileOf('fresh', { 'soil.subCellCv': 0.3 }, 'calibration')).stale,
    ).toBeUndefined();
  });

  it('takes a calibrated set as stale when the machine it was fitted on has changed', () => {
    // The fourth anchoring went on reading as current after a basket was corrected under it:
    // a set records the sources of the machine too.
    expect(anchoredOnNow().machineSource).toMatch(/^[0-9a-f]{64}$/);
    const moved = fileOf('other-machine', { 'soil.subCellCv': 0.3 }, 'calibration', (json) => {
      json['anchoredOn'] = { ...anchoredOnNow(), machineSource: 'e'.repeat(64) };
    });
    expect(() => readParamLayerFile(moved)).toThrow(/fitted on machine data eeeeeeeeeeee/);
    // A set of before the fifth anchoring does not record the machine: that alone is no fault.
    const older = fileOf('before-v5', { 'soil.subCellCv': 0.3 }, 'calibration', (json) => {
      const { machineSource: _unused, ...rest } = anchoredOnNow();
      json['anchoredOn'] = rest;
    });
    expect(readParamLayerFile(older).stale).toBeUndefined();
  });

  it('never reads a set that says another one replaced it as current', () => {
    // Fitted on the code on disk, hashes of today: nothing but the mark is wrong with it (the
    // set with the soak the owner's first wash contradicted went on loading, 11 October 2026).
    const replaced = fileOf('replaced', { 'soil.subCellCv': 0.3 }, 'calibration', (json) => {
      json['supersededBy'] = {
        set: 'anchored-next',
        why: 'a wash contradicted it',
        on: '2026-10-11',
      };
    });
    expect(() => readParamLayerFile(replaced)).toThrow(StaleParamSetError);
    expect(() => readParamLayerFile(replaced)).toThrow(
      /superseded: replaced by anchored-next on 2026-10-11 \(a wash contradicted it\)[\s\S]*wash with the set that replaced it/,
    );
    expect(() => composeParamFiles({ paramSets: [replaced] })).toThrow(StaleParamSetError);
    // Accepted knowingly it is read and marked stale, so the result of the wash says so.
    const layer = readParamLayerFile(replaced, { acceptStale: true });
    expect(layer.stale).toBe(true);
    expect(layer.overrides).toEqual({ 'soil.subCellCv': 0.3 });
    // A set of any origin, and a mark of any shape: the mark is what counts.
    const byHand = fileOf('replaced-by-hand', { 'soil.subCellCv': 0.3 }, 'manual', (json) => {
      json['supersededBy'] = 'anchored-next';
    });
    expect(() => readParamLayerFile(byHand)).toThrow(/superseded: replaced by another set/);
  });

  it('reads a stale file when that is accepted, and marks it', () => {
    const path = fileOf('accepted', { 'soil.subCellCv': 0.3 }, 'calibration', (json) => {
      json['soilHash'] = `sha256:${'0'.repeat(64)}`;
    });
    const layer = readParamLayerFile(path, { acceptStale: true });
    expect(layer.stale).toBe(true);
    expect(layer.overrides).toEqual({ 'soil.subCellCv': 0.3 });
    const composed = composeParamFiles({ paramSets: [path], acceptStale: true });
    expect(composed.records[0]).toMatchObject({ name: 'accepted', stale: true });
    expect(() => composeParamFiles({ paramSets: [path] })).toThrow(StaleParamSetError);
  });

  it('refuses what is not a parameter set, stale or not', () => {
    const unknown = fileOf('unknown-key', {}, 'manual', (json) => {
      json['overrides'] = { 'soil.noSuchKey': 1 };
    });
    expect(() => readParamLayerFile(unknown)).toThrow(ParamSetFileError);
    // Accepting stale sets does not accept a value out of range.
    const range = fileOf('out-of-range', {}, 'manual', (json) => {
      json['overrides'] = { 'soil.subCellCv': -5 };
    });
    expect(() => readParamLayerFile(range, { acceptStale: true })).toThrow(ParamSetFileError);
    const text = join(dir, 'not-json.json');
    writeFileSync(text, 'not json');
    expect(() => readParamLayerFile(text)).toThrow(ParamSetFileError);
    expect(() => readParamLayerFile(join(dir, 'missing.json'))).toThrow(/cannot be read/);
  });

  it('lays a detergent file over the named sets', () => {
    const proteaseDefault = registry.def('liq.xProtease').default as number;
    const anchored = fileOf(
      'anchored-x',
      { 'liq.xProtease': 1.5 * proteaseDefault },
      'calibration',
    );
    const capsule = fileOf('capsule-x', {
      'liq.xProtease': 2 * proteaseDefault,
      'liq.xSilicate': 0,
    });
    const { params, records } = composeParamFiles({ paramSets: [anchored], detergent: capsule });
    expect(params['liq.xProtease']).toBeCloseTo(3 * proteaseDefault, 12);
    expect(records.map((r) => `${r.name}:${r.role}`)).toEqual([
      'anchored-x:set',
      'capsule-x:detergent',
    ]);
  });
});
