// The registry and parameter sets of module M2 against the properties the contract and the brief
// state: composition is order-independent and rejects duplicates, overrides are validated, the
// two hashes are those of the canonical JSON of each group, and per-class soil keys override the
// global of the same name.
import { sha256Hex } from '@spotless/core';
import { describe, expect, it } from 'vitest';
import {
  createParamSet,
  createRegistry,
  type AnyParamDef,
  ParamRegistryError,
  ParamSetError,
  paramScale,
  readParamSet,
  type ParamDef,
  tryCreateParamSet,
  validateOverrides,
} from './index.ts';

const scalar = (
  key: string,
  value: number,
  min: number,
  max: number,
  more: Partial<ParamDef> = {},
): ParamDef => ({
  key,
  unit: '1',
  default: value,
  min,
  max,
  tag: 'SYN',
  source: 'test',
  group: key.startsWith('soil.') || key.startsWith('liq.') ? 'soil' : 'hydro',
  ...more,
});

const FILM: AnyParamDef[] = [
  scalar('film.kDw', 5e-3, 4e-3, 6e-3, { calibration: 'wetting' }),
  scalar('film.lDw', 10e-3, 3e-3, 30e-3, { unit: 'm' }),
  {
    kind: 'vector',
    key: 'film.sigma',
    unit: 'N/m',
    default: [0.06, 0.04, 0.045],
    min: 0.03,
    max: 0.065,
    components: ['W', 'D', 'R'],
    tag: 'ESTIMATED',
    source: 'M7.9',
    group: 'hydro',
    calibration: 'wetting',
  },
];
const SOIL: AnyParamDef[] = [
  scalar('soil.JOHref', 2e-6, 1e-8, 1e-4),
  scalar('soil.lag', 60, 0, 600, { unit: 's' }),
  scalar('soil.egg_yolk_dried.lag', 540, 0, 600, { unit: 's' }),
  {
    kind: 'enum',
    key: 'soil.erosionLaw',
    unit: '1',
    default: 'mass',
    options: ['mass', 'thickness'],
    tag: 'SYN',
    source: 'D12',
    group: 'soil',
  },
];
const CLASSES = ['rice_starch', 'egg_yolk_dried'];

describe('createRegistry', () => {
  it('gives the same registry whatever the order of contributions and definitions', () => {
    const a = createRegistry({ contributions: [FILM, SOIL], soilClasses: CLASSES });
    const b = createRegistry({
      contributions: [[...SOIL].reverse(), [...FILM].reverse()],
      soilClasses: [...CLASSES].reverse(),
    });
    expect(a.defs.map((d) => d.key)).toEqual(b.defs.map((d) => d.key));
    expect(a.hash).toBe(b.hash);
    // Sorted by key: the order is that of an independent sort of the declared keys.
    const expected = [...FILM, ...SOIL].map((d) => d.key).sort();
    expect(a.defs.map((d) => d.key)).toEqual(expected);
    expect(a.soilClasses).toEqual(['egg_yolk_dried', 'rice_starch']);
  });

  it('rejects a key declared by two packages', () => {
    const again = [scalar('film.kDw', 5e-3, 4e-3, 6e-3)];
    expect(() => createRegistry({ contributions: [FILM, again] })).toThrow(ParamRegistryError);
    expect(() => createRegistry({ contributions: [FILM, again] })).toThrow(
      /film\.kDw: declared more than once/,
    );
  });

  it('rejects malformed definitions and names each problem', () => {
    const cases: [AnyParamDef, RegExp][] = [
      [scalar('film.x', 2, 0, 1), /outside the range/],
      [scalar('film.x', 0.5, 1, 0), /min exceeds max/],
      [scalar('Film', 0.5, 0, 1), /dot-separated/],
      [scalar('film.x', Number.NaN, 0, 1), /not finite/],
      [scalar('film.x', 0.5, 0, 1, { source: '' }), /source is empty/],
      [scalar('film.x', 0.5, 0, 1, { scale: 'log' }), /log scale needs min > 0/],
      // Section M2: film.* is read by stages A to G, so it belongs to the hydro hash.
      [scalar('film.x', 0.5, 0, 1, { group: 'soil' }), /belong to group hydro/],
      [scalar('liq.x', 0.5, 0, 1, { group: 'hydro' }), /belong to group soil/],
      [
        { ...(SOIL[3] as AnyParamDef), default: 'volume' } as AnyParamDef,
        /default is not one of the options/,
      ],
      [
        { ...(FILM[2] as AnyParamDef), components: ['W', 'D'] } as AnyParamDef,
        /components and default differ/,
      ],
    ];
    for (const [def, message] of cases) {
      expect(() => createRegistry({ contributions: [[def]] })).toThrow(message);
    }
  });

  it('requires a per-class soil definition to have a global of the same shape', () => {
    const orphan = [scalar('soil.egg_yolk_dried.kOx', 1, 0, 2)];
    expect(() => createRegistry({ contributions: [SOIL, orphan], soilClasses: CLASSES })).toThrow(
      /per-class key without the global soil\.kOx/,
    );
    const otherUnit = [scalar('soil.rice_starch.lag', 1, 0, 2, { unit: 'min' })];
    expect(() =>
      createRegistry({ contributions: [SOIL, otherUnit], soilClasses: CLASSES }),
    ).toThrow(/differs from soil\.lag/);
  });

  it('derives the definition of an undeclared per-class key from the global', () => {
    const registry = createRegistry({ contributions: [FILM, SOIL], soilClasses: CLASSES });
    expect(registry.declares('soil.rice_starch.lag')).toBe(false);
    expect(registry.def('soil.rice_starch.lag')).toMatchObject({
      key: 'soil.rice_starch.lag',
      default: 60,
      max: 600,
    });
    expect(registry.has('soil.custard.lag')).toBe(false);
    expect(() => registry.def('film.nope')).toThrow(ParamRegistryError);
  });

  it('lists calibration groups and picks a log scale beyond a decade', () => {
    const registry = createRegistry({ contributions: [FILM, SOIL], soilClasses: CLASSES });
    expect(registry.calibrationGroups()).toEqual(['wetting']);
    expect(registry.calibrationGroup('wetting').map((d) => d.key)).toEqual([
      'film.kDw',
      'film.sigma',
    ]);
    // 1e-8 to 1e-4 spans four decades; 3 to 30 mm spans exactly one, which is not "more than".
    expect(paramScale(SOIL[0] as ParamDef)).toBe('log');
    expect(paramScale(FILM[1] as ParamDef)).toBe('linear');
    // A range that includes zero cannot be logarithmic.
    expect(paramScale(SOIL[1] as ParamDef)).toBe('linear');
  });
});

describe('parameter sets', () => {
  const registry = createRegistry({ contributions: [FILM, SOIL], soilClasses: CLASSES });

  it('returns defaults, then overrides from a plain JSON object', () => {
    const defaults = createParamSet(registry);
    expect(defaults.get('film.kDw')).toBe(5e-3);
    expect(defaults.getVector('film.sigma')).toEqual([0.06, 0.04, 0.045]);
    expect(defaults.getEnum('soil.erosionLaw')).toBe('mass');
    const json: unknown = JSON.parse(
      '{"film.kDw": 0.0045, "film.sigma": [0.05, 0.035, 0.04], "soil.erosionLaw": "thickness"}',
    );
    const set = createParamSet(registry, json as Record<string, unknown>);
    expect(set.get('film.kDw')).toBe(0.0045);
    expect(set.getVector('film.sigma')).toEqual([0.05, 0.035, 0.04]);
    expect(set.enumIndex('soil.erosionLaw')).toBe(1);
    expect(set.get('film.lDw')).toBe(10e-3);
    expect(() => set.get('film.sigma')).toThrow(TypeError);
    expect(() => set.get('film.unknown')).toThrow(ParamRegistryError);
  });

  it('reports every invalid override as a value', () => {
    const issues = validateOverrides(registry, {
      'film.kDw': 0.1, // above 6e-3
      'film.sigma': [0.05, 0.04], // two components for three
      'soil.erosionLaw': 'volume',
      'film.lDw': '10 mm',
      'jets.cR': 0.3, // not declared
      'soil.lag': Number.POSITIVE_INFINITY,
      'soil.custard.lag': 5, // custard is not a soil class
    });
    expect(issues.map((i) => [i.key, i.code])).toEqual([
      ['film.kDw', 'invalid-value'],
      ['film.lDw', 'invalid-value'],
      ['film.sigma', 'invalid-value'],
      ['jets.cR', 'unknown-key'],
      ['soil.custard.lag', 'unknown-key'],
      ['soil.erosionLaw', 'invalid-value'],
      ['soil.lag', 'invalid-value'],
    ]);
    const result = tryCreateParamSet(registry, { 'film.kDw': 0.1 });
    expect(result.ok).toBe(false);
    expect(() => createParamSet(registry, { 'film.kDw': 0.1 })).toThrow(ParamSetError);
  });

  it('refuses to change a fixed parameter', () => {
    const fixed = createRegistry({
      contributions: [[scalar('phys.g', 9.80665, 9.80665, 9.80665)]],
    });
    expect(validateOverrides(fixed, { 'phys.g': 9.81 })[0]?.message).toMatch(/fixed at 9\.80665/);
    expect(validateOverrides(fixed, { 'phys.g': 9.80665 })).toEqual([]);
  });

  it('hashes the canonical JSON of each group, independent of insertion order', () => {
    const set = createParamSet(registry, { 'soil.lag': 90, 'film.kDw': 0.0045 });
    // Canonical JSON written by hand: keys in code-unit order, shortest round-trip numbers.
    const hydro = '{"film.kDw":0.0045,"film.lDw":0.01,"film.sigma":[0.06,0.04,0.045]}';
    const soil =
      '{"soil.JOHref":0.000002,"soil.egg_yolk_dried.lag":540,"soil.erosionLaw":"mass","soil.lag":90}';
    expect(set.hydroHash).toBe(`sha256:${sha256Hex(hydro)}`);
    expect(set.soilHash).toBe(`sha256:${sha256Hex(soil)}`);

    const reordered = createRegistry({
      contributions: [[...SOIL].reverse(), FILM],
      soilClasses: ['egg_yolk_dried', 'rice_starch'],
    });
    const other = createParamSet(reordered, { 'film.kDw': 0.0045, 'soil.lag': 90 });
    expect(other.hydroHash).toBe(set.hydroHash);
    expect(other.soilHash).toBe(set.soilHash);
  });

  it('keeps the hydro hash when only a soil parameter changes, and the reverse', () => {
    const base = createParamSet(registry);
    const soilChanged = base.with({ 'soil.JOHref': 3e-6, 'soil.erosionLaw': 'thickness' });
    expect(soilChanged.hydroHash).toBe(base.hydroHash);
    expect(soilChanged.soilHash).not.toBe(base.soilHash);
    const hydroChanged = base.with({ 'film.sigma': [0.06, 0.04, 0.05] });
    expect(hydroChanged.soilHash).toBe(base.soilHash);
    expect(hydroChanged.hydroHash).not.toBe(base.hydroHash);
    // An override equal to the default is the default.
    expect(base.with({ 'film.kDw': 5e-3 }).hydroHash).toBe(base.hydroHash);
    // Negative zero is stored and hashed as zero.
    const zero = base.with({ 'soil.lag': -0 });
    expect(Object.is(zero.get('soil.lag'), 0)).toBe(true);
    expect(zero.soilHash).toBe(base.with({ 'soil.lag': 0 }).soilHash);
  });

  it('looks soil parameters up per class and falls back to the global value', () => {
    const base = createParamSet(registry);
    // Declared per-class default; class without a row; both through the same call.
    expect(base.soilClass('egg_yolk_dried', 'lag')).toBe(540);
    expect(base.soilClass('rice_starch', 'lag')).toBe(60);
    expect(base.soilClass('egg_yolk_dried', 'JOHref')).toBe(2e-6);
    // An override of an undeclared per-class key takes effect for that class only.
    const fitted = base.with({ 'soil.rice_starch.JOHref': 5e-6, 'soil.JOHref': 3e-6 });
    expect(fitted.soilClass('rice_starch', 'JOHref')).toBe(5e-6);
    expect(fitted.soilClass('egg_yolk_dried', 'JOHref')).toBe(3e-6);
    expect(fitted.hydroHash).toBe(base.hydroHash);
    expect([...fitted.soilClassTable('JOHref')]).toEqual([3e-6, 5e-6]);
    expect([
      ...fitted.soilClassTable('lag', ['rice_starch', 'egg_yolk_dried', 'rice_starch']),
    ]).toEqual([60, 540, 60]);
    expect(() => base.soilClass('custard', 'lag')).toThrow(RangeError);
    expect(() => base.soilClass('rice_starch', 'nope')).toThrow(ParamRegistryError);
    // The per-class range is the range of the global.
    expect(validateOverrides(registry, { 'soil.rice_starch.JOHref': 1 })[0]?.code).toBe(
      'invalid-value',
    );
  });

  it('round-trips through JSON text with its provenance', () => {
    const provenance = {
      name: 'fit-egg-01',
      origin: 'calibration',
      note: 'Nelder-Mead, 3 wash records',
      washRecords: ['w-001', 'w-002', 'w-003'],
      createdAt: '2026-10-10T09:00:00Z',
    } as const;
    const set = createParamSet(
      registry,
      { 'soil.rice_starch.JOHref': 5e-6, 'film.kDw': 0.0045 },
      provenance,
    );
    const text = JSON.stringify(set);
    const back = readParamSet(registry, JSON.parse(text));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.value.provenance).toEqual(provenance);
    expect(back.value.overrides).toEqual(set.overrides);
    expect(back.value.hydroHash).toBe(set.hydroHash);
    expect(back.value.soilHash).toBe(set.soilHash);
    expect(back.value.soilClass('rice_starch', 'JOHref')).toBe(5e-6);
  });

  it('reports a file whose hashes no longer match the registry, and malformed files', () => {
    const set = createParamSet(registry, { 'film.kDw': 0.0045 });
    const text = JSON.stringify(set);
    // The same file read against a registry whose default of film.lDw has changed.
    const changed = createRegistry({
      contributions: [
        FILM.map((d) =>
          d.key === 'film.lDw' ? scalar('film.lDw', 12e-3, 3e-3, 30e-3, { unit: 'm' }) : d,
        ),
        SOIL,
      ],
      soilClasses: CLASSES,
    });
    const stale = readParamSet(changed, JSON.parse(text));
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.map((i) => i.code)).toEqual(['hash-mismatch']);
    expect(readParamSet(changed, JSON.parse(text), { onHashMismatch: 'ignore' }).ok).toBe(true);
    for (const bad of [
      null,
      [],
      { format: 'other' },
      { ...JSON.parse(text), version: 2 },
      { ...JSON.parse(text), overrides: 3 },
      { ...JSON.parse(text), provenance: {} },
    ]) {
      const result = readParamSet(registry, bad);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error[0]?.code).toBe('bad-format');
    }
    const outOfRange = readParamSet(registry, {
      ...JSON.parse(text),
      overrides: { 'film.kDw': 1 },
    });
    expect(outOfRange.ok).toBe(false);
  });
});

describe('review findings on the registry and parameter files', () => {
  it('treats a prefix named like an Object.prototype member as an ordinary free prefix', () => {
    for (const key of ['constructor.a', 'toString.a', 'hasOwnProperty.b']) {
      const reg = createRegistry({ contributions: [[scalar(key, 1, 0, 2)]] });
      expect(reg.def(key).group).toBe('hydro');
      expect(createParamSet(reg).get(key)).toBe(1);
    }
    // A fixed prefix is still enforced.
    expect(() =>
      createRegistry({ contributions: [[scalar('film.x', 1, 0, 2, { group: 'soil' })]] }),
    ).toThrow(/film\.\* belong to group hydro/);
  });

  it('derives a per-class definition without the calibration group of its global', () => {
    const reg = createRegistry({
      contributions: [[scalar('soil.k', 1, 0, 2, { calibration: 's' })]],
      soilClasses: ['starch'],
    });
    expect(reg.def('soil.k').calibration).toBe('s');
    const derived = reg.def('soil.starch.k');
    expect(derived.key).toBe('soil.starch.k');
    expect(derived.calibration).toBeUndefined();
    expect('calibration' in derived).toBe(false);
    expect(reg.calibrationGroup('s').map((d) => d.key)).toEqual(['soil.k']);
  });

  it('rejects a soil class that is also the middle segment of a global key', () => {
    expect(() =>
      createRegistry({
        contributions: [[scalar('soil.starch.k', 1, 0, 2)]],
        soilClasses: ['starch'],
      }),
    ).toThrow(/soil\.starch\.k: per-class key without the global soil\.k/);
  });

  it('reports a file whose overridden key changed unit, kind, length or options', () => {
    const defs = (unit: string): AnyParamDef[] => [
      scalar('jets.a', 1, 0, 10, { unit }),
      scalar('jets.b', 1, 0, 10),
      {
        kind: 'vector',
        key: 'jets.v',
        unit: 'm',
        default: [1, 2],
        min: 0,
        max: 10,
        tag: 'SYN',
        source: 't',
        group: 'hydro',
      },
      {
        kind: 'enum',
        key: 'jets.law',
        unit: '1',
        default: 'a',
        options: ['a', 'b'],
        tag: 'SYN',
        source: 't',
        group: 'hydro',
      },
    ];
    const written = createRegistry({ contributions: [defs('m')] });
    const file = JSON.parse(
      JSON.stringify(createParamSet(written, { 'jets.a': 2, 'jets.v': [3, 4], 'jets.law': 'b' })),
    );
    expect(file.definitions).toEqual({
      'jets.a': { kind: 'scalar', unit: 'm' },
      'jets.law': { kind: 'enum', unit: '1', options: ['a', 'b'] },
      'jets.v': { kind: 'vector', unit: 'm', length: 2 },
    });
    expect(readParamSet(written, file).ok).toBe(true);

    // The reviewer's case: the same registry with the unit of jets.a changed and every default
    // kept, so that the hydro and soil hashes are the same.
    const inMillimetres = createRegistry({ contributions: [defs('mm')] });
    expect(createParamSet(inMillimetres, file.overrides).hydroHash).toBe(file.hydroHash);
    const reread = readParamSet(inMillimetres, file);
    expect(reread.ok).toBe(false);
    if (!reread.ok) {
      expect(reread.error).toMatchObject([{ key: 'jets.a', code: 'definition-changed' }]);
      expect(reread.error[0]?.message).toMatch(/unit.*"m".*"mm"/);
    }
    expect(readParamSet(inMillimetres, file, { onHashMismatch: 'ignore' }).ok).toBe(true);

    // Reordered enumeration options: the name is still valid, the index a kernel sees is not.
    const reordered = createRegistry({
      contributions: [
        defs('m').map((d) => (d.kind === 'enum' ? { ...d, options: ['b', 'a'] } : d)),
      ],
    });
    const second = readParamSet(reordered, file);
    expect(second.ok).toBe(false);
    if (!second.ok)
      expect(second.error.map((i) => [i.key, i.code])).toEqual([
        ['jets.law', 'definition-changed'],
      ]);

    // A change to a key the file does not override (unit of jets.b), or to a source text, does
    // not invalidate the file, although the registry hash differs.
    const other = createRegistry({
      contributions: [defs('m').map((d) => (d.key === 'jets.b' ? { ...d, unit: 'kg' } : d))],
    });
    expect(other.hash).not.toBe(written.hash);
    expect(readParamSet(other, file).ok).toBe(true);

    // A file without the definitions of its overrides is malformed.
    const { definitions: _dropped, ...without } = file;
    const bad = readParamSet(written, without);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error[0]?.code).toBe('bad-format');
  });
});
