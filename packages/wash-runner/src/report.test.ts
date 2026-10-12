import type { WashManifest } from '@spotless/session';
import { beforeAll, describe, expect, it } from 'vitest';
import { WASH_RUNNER_VERSION } from './contract.ts';
import { scoredProgrammeOf, washCaveatsFor, washTierNoteFor } from './defaults.ts';
import { washReportOf, WashResultError } from './report.ts';
import { decodeResidueMap } from './residue-codec.ts';
import { CLEAN_DEFINITION_TEXT } from '@spotless/levels';
import { fakeResult, manifestOf, TILTED_LOAD, tutorialLevel } from './test-util.ts';

let manifest: WashManifest;

beforeAll(async () => {
  manifest = await manifestOf(tutorialLevel(), TILTED_LOAD);
});

const RULE = { maxSpecks: 4, maxAreaMm2: 4, maxWaterMl: 1, liftWarnRatio: 1 };
const OPTIONS = { tier: 'fast', runtimeS: 12.5, rule: RULE, simVersion: 'fake-sim 1' } as const;

describe('simulation result to wash report', () => {
  it('reports every item of the level: washed ones with their verdict, the rest as not loaded', () => {
    const result = fakeResult(manifest, {
      bowl_01: {
        clean: false,
        score: 1,
        regions: [{ region: 'interior', cells: 40, visible: 25, trace: 0.05 }],
      },
      mug_01: { clean: true, score: 5, regions: [{ region: 'interior', cells: 30, visible: 0 }] },
    });
    const { report, residue } = washReportOf(manifest, result, OPTIONS);
    expect(report.level_id).toBe('tutorial');
    expect(report.state_hash).toBe(manifest.load.state_hash);
    expect(report.benchmark_version).toBe(manifest.load.benchmark_version);
    expect(report.job).toEqual({
      status: 'done',
      runtime_s: 12.5,
      fidelity: 'fast',
      // The version of the simulation with the parameter sets and the detergent it ran with.
      sim_version: 'fake-sim 1; parameters registry defaults; detergent machine default 20.0 g',
      runner_version: WASH_RUNNER_VERSION,
      result_hash: 'sha256:fake-result',
    });
    // One entry per item of the level, sorted by id.
    expect(report.items.map((item) => item.item_id)).toEqual(
      manifest.level.items.map((item) => item.id).sort(),
    );
    // What was not washed is named and nothing else is said about it.
    for (const item of report.items) {
      if (item.item_id === 'bowl_01' || item.item_id === 'mug_01') continue;
      expect(item).toEqual({ item_id: item.item_id, loaded: false });
    }
    const points = new Map(manifest.level.items.map((item) => [item.id, item.points]));
    const bowl = report.items.find((item) => item.item_id === 'bowl_01');
    const mug = report.items.find((item) => item.item_id === 'mug_01');
    if (bowl?.loaded !== true || mug?.loaded !== true) throw new Error('not loaded');

    // Clean is the simulation's verdict, and only a clean item scores.
    expect(mug).toMatchObject({
      clean: true,
      points_awarded: points.get('mug_01'),
      score_iec: 5,
      graded_score: 1,
      residue_regions: [],
      visible_area_mm2: 0,
      holds_water: false,
      retained_water_ml: 0,
      moved_during_wash: false,
      residue_cells: 0,
    });
    expect(mug.reason).toBeUndefined();
    expect(bowl).toMatchObject({
      clean: false,
      points_awarded: 0,
      score_iec: 1,
      graded_score: 0.2,
      visible_area_mm2: 100,
      specks: 0,
      residue_cells: 40,
    });
    // Where it remains: the region, the area, and which soil, by its catalogue id.
    expect(bowl.residue_regions).toHaveLength(1);
    const region = bowl.residue_regions[0];
    expect(region).toMatchObject({
      region: 'interior',
      visible_area_mm2: 100,
      soiled_area_mm2: 160,
      specks: 0,
    });
    expect(region?.soils).toHaveLength(1);
    expect(region?.soils?.[0]?.type).toBe('yoghurt');
    // 25 cells at 0.8 and 15 at 0.05 of 40 cells.
    expect(region?.soils?.[0]?.residual_fraction).toBeCloseTo((25 * 0.8 + 15 * 0.05) / 40, 6);
    expect(bowl.residual_mass_fraction).toBeCloseTo((25 * 0.8 + 15 * 0.05) / 40, 6);
    // Shares of whole surfaces: the region's and the item's.
    expect(region?.fraction).toBeGreaterThan(0);
    expect(region?.fraction).toBeLessThan(0.02);
    expect(bowl.residual_fraction_area).toBeGreaterThan(0);
    expect(bowl.residual_fraction_area).toBeLessThan(region?.fraction ?? 0);
    // The reason is a statement of fact in the catalogue's words.
    expect(bowl.reason).toBe('Yoghurt left on the interior (100 mm2 visibly soiled).');

    // The totals.
    expect(report.score).toEqual({
      points: points.get('mug_01'),
      points_available: [...points.values()].reduce((sum, p) => sum + p, 0),
      graded_points: (points.get('mug_01') ?? 0) + 0.2 * (points.get('bowl_01') ?? 0),
      points_loaded: (points.get('mug_01') ?? 0) + (points.get('bowl_01') ?? 0),
    });

    // The residue maps: one per washed item, only the cells that still carry soil.
    expect(residue.map((map) => map.item_id)).toEqual(['bowl_01', 'mug_01']);
    const bowlCells = decodeResidueMap(residue[0] as (typeof residue)[number]);
    expect(bowlCells.count).toBe(40);
    expect(bowlCells.soils).toEqual(['yoghurt']);
    expect([...bowlCells.visible].reduce((sum, v) => sum + v, 0)).toBe(25);
    expect(bowlCells.fraction[0]).toBeCloseTo(0.8, 2);
    expect(bowlCells.fraction[39]).toBeCloseTo(0.05, 2);
    expect(bowlCells.areaMm2[0]).toBeCloseTo(4, 2);
    // Positions and normals in the item frame, as the simulation gave them.
    expect(bowlCells.centre[3 * 7]).toBeCloseTo(0.014, 5);
    expect([...bowlCells.normal.subarray(0, 3)]).toEqual([0, 0, 1]);
    expect(decodeResidueMap(residue[1] as (typeof residue)[number]).count).toBe(0);
  });

  it('says why an item is not clean: soil, specks, water, or several of them', () => {
    const reasonOf = (
      outcome: Parameters<typeof fakeResult>[1][string],
      rule: typeof RULE | null = RULE,
    ): string | undefined => {
      const { report } = washReportOf(manifest, fakeResult(manifest, { bowl_01: outcome }), {
        ...OPTIONS,
        rule,
      });
      const bowl = report.items.find((item) => item.item_id === 'bowl_01');
      return bowl?.loaded === true ? bowl.reason : undefined;
    };
    // Water alone is no reason: the item is clean (the card: dryness does not count).
    expect(reasonOf({ clean: false, score: 5, pooled_mL: 212.4 })).toBeUndefined();
    expect(
      reasonOf({
        clean: false,
        score: 2,
        regions: [{ region: 'interior', cells: 10, visible: 6, specks: 6 }],
      }),
    ).toBe('Yoghurt left on the interior (24 mm2 visibly soiled, 6 specks).');
    expect(
      reasonOf({
        clean: false,
        score: 0,
        regions: [{ region: 'interior', cells: 10, visible: 10 }],
        pooled_mL: 3.26,
      }),
    ).toBe('Yoghurt left on the interior (40 mm2 visibly soiled).');
    // Soil within what a clean item may carry: clean, whatever water stands in it.
    expect(
      reasonOf({
        clean: false,
        score: 4,
        regions: [{ region: 'interior', cells: 10, visible: 1 }],
        pooled_mL: 40,
      }),
    ).toBeUndefined();
    // Without the rule's numbers every fact that could count is stated.
    expect(
      reasonOf(
        {
          clean: false,
          score: 4,
          regions: [{ region: 'interior', cells: 10, visible: 1 }],
          pooled_mL: 40,
        },
        null,
      ),
    ).toBe('Yoghurt left on the interior (4 mm2 visibly soiled); holds 40 ml of water.');
    // A clean item has no reason, whatever traces it carries.
    expect(
      reasonOf({ clean: true, score: 4, regions: [{ region: 'interior', cells: 10, visible: 1 }] }),
    ).toBeUndefined();
  });

  it('flags water by the rule and reports how much, and water does not decide clean', () => {
    // The inspector fails the mug for the water in it; the card every player reads says
    // "Whether the item is dry is reported and does not count", and the report keeps to it.
    expect(CLEAN_DEFINITION_TEXT).toContain(
      'Whether the item is dry is reported and does not count',
    );
    const { report } = washReportOf(
      manifest,
      fakeResult(manifest, {
        bowl_01: { clean: true, score: 5, pooled_mL: 0.4 },
        mug_01: { clean: false, score: 5, pooled_mL: 180 },
      }),
      OPTIONS,
    );
    const points = new Map(manifest.level.items.map((item) => [item.id, item.points]));
    const bowl = report.items.find((item) => item.item_id === 'bowl_01');
    const mug = report.items.find((item) => item.item_id === 'mug_01');
    expect(bowl).toMatchObject({ holds_water: false, retained_water_ml: 0.4, clean: true });
    // No soil at all on it: clean, with its points, and the two scores agree.
    expect(mug).toMatchObject({
      holds_water: true,
      retained_water_ml: 180,
      clean: true,
      points_awarded: points.get('mug_01'),
      graded_score: 1,
      visible_area_mm2: 0,
      specks: 0,
    });
    expect(mug?.loaded === true ? mug.reason : 'x').toBeUndefined();
    expect(mug).toMatchObject({ surface_film_g: 0.5 });
    // Soil over the card's limits is not clean, dry or not.
    const soiled = washReportOf(
      manifest,
      fakeResult(manifest, {
        mug_01: {
          clean: false,
          score: 3,
          regions: [{ region: 'interior', cells: 10, visible: 2 }],
          pooled_mL: 0,
        },
      }),
      OPTIONS,
    ).report.items.find((item) => item.item_id === 'mug_01');
    expect(soiled).toMatchObject({ clean: false, points_awarded: 0, holds_water: false });
  });

  it('counts what standing water left where it stood as soil, and says that it came from the water', () => {
    // Review of the measurement, 2026-10-11: a mug left standing mouth up came out "clean"
    // with 275 ml of wash water in it, although the card counts "residue left where dirty
    // water stood". The simulation now lays what that water held on the surface under it;
    // the report counts it like any visible soil and names the water as its cause.
    expect(CLEAN_DEFINITION_TEXT).toContain('residue left where dirty water stood');
    const of = (outcome: Parameters<typeof fakeResult>[1][string]) =>
      washReportOf(manifest, fakeResult(manifest, { mug_01: outcome }), OPTIONS).report.items.find(
        (item) => item.item_id === 'mug_01',
      );
    // A mug whose own soil has gone and which stood full of soiled water: not clean.
    const full = of({ clean: false, score: 0, pooled_mL: 275.4, standingVisibleAreaMm2: 11786 });
    expect(full).toMatchObject({
      clean: false,
      points_awarded: 0,
      holds_water: true,
      retained_water_ml: 275.4,
      visible_area_mm2: 11786,
    });
    expect(full?.loaded === true ? full.reason : '').toBe(
      'Soil left on the interior (11786 mm2 visibly soiled); 275 ml of water stood in it to the end of the cycle and left what it held where it stood (11786 mm2).',
    );
    // The same water with nothing visible in it decides nothing: water as such does not count.
    const rinsed = of({ clean: false, score: 5, pooled_mL: 6 });
    expect(rinsed).toMatchObject({ clean: true, holds_water: true });
    expect(rinsed?.loaded === true ? rinsed.reason : 'x').toBeUndefined();
    // Within what a clean item may carry (4 mm2), residue of standing water is no reason.
    const trace = of({ clean: false, score: 4, pooled_mL: 2, standingVisibleAreaMm2: 3 });
    expect(trace).toMatchObject({ clean: true });
  });

  it('notes what the load did to the machine', () => {
    const blocked: WashManifest = {
      ...manifest,
      prechecks: {
        shifted: [],
        fell_out: [],
        on_tub_floor: [],
        protruding: [],
        racks: [],
        spray_arms: [
          {
            arm: 'lower_arm',
            full_rotation: false,
            first_contact_angle_deg: 62.3,
            blocked_by: 'bowl_01',
          },
          { arm: 'upper_arm', full_rotation: true },
        ],
        door_closes: true,
        door_blocked_by: [],
        dispenser_opens: true,
        dispenser_blocked_by: [],
        tablet_path_clear: false,
        tablet_blocked_by: ['mug_01'],
      },
    };
    const remark =
      'placement: mug_01 is likely to be moved by the jets (peak upward jet force 1.73 of its weight)';
    const result = {
      ...fakeResult(blocked, { mug_01: { clean: true, score: 5, jetLiftRatio: 1.73 } }),
      problems: ['soil: no region "lid" on mug_01', remark],
    };
    const bundle = washReportOf(blocked, result, OPTIONS);
    expect(bundle.report.job.notes).toEqual([
      'The lower arm could not turn: bowl_01 held it still. It sprayed from where it stood for the whole wash.',
      'The detergent tablet could not fall into its tray (mug_01): the wash ran without detergent.',
      'mug_01 was pushed by the jets hard enough to have been moved. The wash is simulated with every item where it was placed.',
      'The simulation made 2 remarks on what it could not simulate as asked; they are in the log of the server.',
    ]);
    // The simulation's own words, with their numbers, are for the log and not for the player.
    expect(bundle.problems).toEqual(['soil: no region "lid" on mug_01', remark]);
    expect(JSON.stringify(bundle.report)).not.toContain('1.73');
    expect(JSON.stringify(bundle.report)).not.toContain('jet force');
    // The item is flagged, and still reported where it was washed: it was not moved.
    const mug = bundle.report.items.find((item) => item.item_id === 'mug_01');
    const bowl = bundle.report.items.find((item) => item.item_id === 'bowl_01');
    expect(mug).toMatchObject({ likely_moved: true, moved_during_wash: false });
    expect(bowl).toMatchObject({ moved_during_wash: false });
    expect(bowl).not.toHaveProperty('likely_moved');
    // Jets that push less than the item weighs flag nothing; nor does anything without the rule.
    const light = fakeResult(blocked, { mug_01: { clean: true, score: 5, jetLiftRatio: 0.6 } });
    expect(JSON.stringify(washReportOf(blocked, light, OPTIONS).report)).not.toContain('likely');
    const ruleless = washReportOf(blocked, result, { ...OPTIONS, rule: null }).report;
    expect(JSON.stringify(ruleless.items)).not.toContain('likely_moved');
  });

  it('says when the wash was traced on the CPU', () => {
    const result = fakeResult(manifest, {});
    const cpu = {
      ...result,
      provenance: { ...result.provenance, exposureBackend: 'cpu' as const },
    };
    expect(washReportOf(manifest, cpu, OPTIONS).report.job.notes?.[0]).toMatch(/traced on the CPU/);
    expect(washReportOf(manifest, result, OPTIONS).report.job.notes).toBeUndefined();
  });

  it('says which items are at the edge of clean: their verdict differs between the ends of the band of visibility', () => {
    const result = fakeResult(manifest, {});
    const band = (decided: boolean) => ({
      strictClean: !decided ? false : true,
      strictScore: decided ? 5 : 3,
      lenientClean: true,
      lenientScore: 5,
      decided,
    });
    const edged = {
      ...result,
      items: result.items.map((item, index) => ({ ...item, band: band(index !== 0) })),
    };
    const first = [...result.items.map((item) => item.itemId)][0] as string;
    const notes = washReportOf(manifest, edged, OPTIONS).report.job.notes ?? [];
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain(`${first} is at the edge of clean`);
    // Decided everywhere: no note.
    const decided = {
      ...result,
      items: result.items.map((item) => ({ ...item, band: band(true) })),
    };
    expect(washReportOf(manifest, decided, OPTIONS).report.job.notes).toBeUndefined();
  });

  it('says which verdicts the parameters of the wash do not vouch for on this programme', () => {
    const result = fakeResult(manifest, {});
    const soiled = result.items.find((item) => item.soils.length > 0);
    expect(soiled).toBeDefined();
    const cls = soiled?.soils[0]?.modelClass ?? '';
    const caveats = [
      { programmeId: 'auto_145', soilClasses: [cls], note: 'carry a soil that is not anchored.' },
    ];
    const notes = washReportOf(manifest, result, { ...OPTIONS, caveats }).report.job.notes ?? [];
    expect(notes.join(' ')).toContain(`${soiled?.itemId ?? ''}`);
    expect(notes.join(' ')).toContain('carry a soil that is not anchored.');
    // A caveat on a class no item carries says nothing.
    const other = [{ programmeId: 'auto_145', soilClasses: ['no_such_class'], note: 'x' }];
    expect(
      washReportOf(manifest, result, { ...OPTIONS, caveats: other }).report.job.notes,
    ).toBeUndefined();
    // The owner's machine: egg, milk and tea on Auto, nothing on Eco 50 or with other parameters.
    expect(washCaveatsFor('bosch_smv4hax40g', 'auto_145')[0]?.soilClasses).toEqual([
      'egg_yolk',
      'milk',
      'tea',
    ]);
    expect(washCaveatsFor('bosch_smv4hax40g', 'eco_50')).toEqual([]);
    expect(washCaveatsFor('bosch_smv4hax40g', 'auto_145', 'registry-defaults')).toEqual([]);
  });

  it('says what a fast wash is worth before anything else, and nothing of the tier for an official one', () => {
    const result = fakeResult(manifest, {});
    const fast = washTierNoteFor('bosch_smv4hax40g', 'eco_50', 'fast');
    expect(fast).toMatch(/^This is a fast wash, a preview of the official one/);
    const notes =
      washReportOf(manifest, result, { ...OPTIONS, tierNote: fast }).report.job.notes ?? [];
    expect(notes[0]).toBe(fast);
    expect(washTierNoteFor('bosch_smv4hax40g', 'eco_50', 'official')).toBeNull();
    expect(washReportOf(manifest, result, { ...OPTIONS, tierNote: null }).report.job.notes).toBe(
      washReportOf(manifest, result, OPTIONS).report.job.notes,
    );
    // A machine without measured parameters still says that a fast wash is a preview.
    expect(washTierNoteFor('no_such_machine', 'eco_50', 'fast')).toContain('has not been measured');
    // The game is scored on Eco 50 with the owner's machine.
    expect(scoredProgrammeOf('bosch_smv4hax40g')).toBe('eco_50');
  });

  it('records the parameter sets, the detergent and the source that produced it, and says when a set was stale', () => {
    const result = fakeResult(manifest, {});
    const set = {
      name: 'anchored-x',
      role: 'set' as const,
      origin: 'calibration',
      overridesHash: 'sha256:abc',
      keys: 9,
      stale: false,
      scaled: [],
    };
    const named = {
      ...result,
      provenance: {
        ...result.provenance,
        paramSets: [set, { ...set, name: 'capsule-y', role: 'detergent' as const }],
        detergent: { name: 'Capsule Y', dose_g: 12.9 },
        sourceFingerprint: '0123456789abcdef0123456789abcdef',
      },
    };
    const fresh = washReportOf(manifest, named, OPTIONS).report;
    expect(fresh.job.sim_version).toBe(
      'fake-sim 1; parameters anchored-x + capsule-y; detergent Capsule Y 12.9 g; source 0123456789abcdef',
    );
    expect(fresh.job.notes).toBeUndefined();
    // A set that was read although its stored hashes were stale: the report says so, in the
    // version line and in a note a player sees.
    const stale = {
      ...named,
      provenance: { ...named.provenance, paramSets: [{ ...set, stale: true }] },
    };
    const provisional = washReportOf(manifest, stale, OPTIONS).report;
    expect(provisional.job.sim_version).toContain('anchored-x (stale)');
    expect(provisional.job.notes?.join(' ')).toMatch(/anchored-x was made for another state/);
    expect(provisional.job.notes?.join(' ')).toMatch(/provisional/);
  });

  it('carries nothing of how the simulation got there', () => {
    const result = fakeResult(manifest, {
      bowl_01: { clean: false, score: 0, regions: [{ region: 'interior', cells: 8, visible: 8 }] },
    });
    const bundle = washReportOf(manifest, result, OPTIONS);
    const text = JSON.stringify(bundle);
    // No model classes, parameter hashes, seeds, exposure or liquor.
    for (const word of [
      'class_of_',
      'hydro',
      'soilHash',
      'inputHash',
      'exposure',
      'liquor',
      'seed',
    ]) {
      expect(text).not.toContain(word);
    }
    expect(text).not.toContain(String(manifest.seed));
    // The result carries an exposure summary per item and region (how long under a jet, how
    // long wet, how fast the liquor is renewed, how much water is kept): none of its numbers
    // reaches the report or the residue maps.
    const summary = result.items[0]?.exposure.regions[0];
    if (summary === undefined) throw new Error('the made-up result has no exposure summary');
    for (const value of [
      summary.areaMm2,
      summary.jetShare,
      summary.jetFilmShare,
      summary.jetArea,
      summary.jetShearPeak,
      summary.wetTime,
      summary.dryArea,
      summary.flux,
      summary.exchange,
      summary.renewal,
      summary.filmShear,
      summary.neverWetArea,
      summary.pooledArea,
      summary.retained_g,
    ]) {
      expect(text).not.toContain(String(value));
    }
    for (const word of ['jetShare', 'wetTime', 'neverWet', 'retained_g', 'renewal']) {
      expect(text).not.toContain(word);
    }
    // Nothing about the items that were not washed: neither their soils nor their points.
    const unwashed = bundle.report.items.filter((item) => !item.loaded);
    expect(unwashed.length).toBeGreaterThan(0);
    for (const item of unwashed) expect(Object.keys(item).sort()).toEqual(['item_id', 'loaded']);
    expect(bundle.residue.map((map) => map.item_id)).toEqual(['bowl_01', 'mug_01']);
  });

  it('is a pure function of the manifest and the result', () => {
    const outcome = {
      bowl_01: {
        clean: false,
        score: 2,
        regions: [{ region: 'interior', cells: 12, visible: 5, trace: 0.1 }],
      },
    };
    const a = washReportOf(manifest, fakeResult(manifest, outcome), OPTIONS);
    const b = washReportOf(manifest, fakeResult(manifest, outcome), OPTIONS);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('refuses a result that is not a result of this load, or holds a value that is no number', () => {
    const result = fakeResult(manifest, {});
    expect(() =>
      washReportOf(manifest, { ...result, items: result.items.slice(1) }, OPTIONS),
    ).toThrow(/no result for bowl_01/);
    const first = result.items[0];
    if (first === undefined) throw new Error('no items');
    for (const broken of [
      { ...first, score: Number.NaN },
      { ...first, visibleAreaMm2: Number.POSITIVE_INFINITY },
      { ...first, water: { ...first.water, pooled_mL: Number.NaN } },
    ]) {
      expect(() =>
        washReportOf(manifest, { ...result, items: [broken, ...result.items.slice(1)] }, OPTIONS),
      ).toThrow(WashResultError);
    }
  });
});
