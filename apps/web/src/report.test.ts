import { RESIDUE_STEPS, residueStep } from '@spotless/render';
import type { LevelCard, WashReport, WashStageProgress } from '@spotless/session';
import { describe, expect, it } from 'vitest';
import {
  countingText,
  noteInPageWords,
  reportStatus,
  reportView,
  residueLegend,
  washProgressView,
} from './report.ts';

const stage: WashStageProgress = {
  stage: 'exposure',
  label: 'Tracing the jets, the splashing and the run-off (spray pattern 2 of 4)',
  index: 4,
  count: 7,
  fraction: 0.25,
  eta_s: 90,
  elapsed_s: 30,
};

describe('wash progress', () => {
  it('names the real stage and counts the estimate down between reports', () => {
    const fresh = washProgressView({ status: 'running', progress: 0.25, stage }, 0, 31);
    expect(fresh.title).toBe(stage.label);
    expect(fresh.step).toBe('Step 4 of 7, 25% done');
    expect(fresh.times).toContain('simulating for 0:30, about 1:30 to go');
    expect(fresh.times).toContain('estimate');
    expect(fresh.overdue).toBe(false);
    expect(fresh.fraction).toBeCloseTo(30 / 120, 9);
    // Forty seconds later nothing new has been reported: the same stage, less time to go.
    const later = washProgressView({ status: 'running', progress: 0.25, stage }, 40, 71);
    expect(later.title).toBe(stage.label);
    expect(later.times).toContain('simulating for 1:10, about 0:50 to go');
    expect(later.fraction).toBeCloseTo(70 / 120, 9);
    expect(later.fraction).toBeGreaterThan(fresh.fraction);
  });

  it('says so when a stage overruns its estimate, and does not invent a new one', () => {
    const over = washProgressView({ status: 'running', progress: 0.25, stage }, 150, 181);
    expect(over.overdue).toBe(true);
    expect(over.times).toBe(
      'simulating for 3:00; this step is taking 1:00 longer than estimated and is still running',
    );
    expect(over.times).not.toContain('to go');
    // The bar is never full before the report is there.
    expect(over.fraction).toBeLessThan(1);
    const late = washProgressView({ status: 'running', progress: 0.999, stage }, 100_000, 1);
    expect(late.fraction).toBeLessThanOrEqual(0.97);
  });

  it('never shows less than the server reported, nor a part-done step that is whole', () => {
    const ahead = washProgressView({ status: 'running', progress: 0.6, stage }, 0, 30);
    expect(ahead.fraction).toBe(0.6);
    const whole = washProgressView(
      { status: 'running', progress: 0.3, stage: { ...stage, fraction: 1 } },
      0,
      30,
    );
    expect(whole.step).toBe('Step 4 of 7');
    const unknown = washProgressView(
      { status: 'running', progress: 0.1, stage: { ...stage, eta_s: null } },
      5,
      40,
    );
    expect(unknown.times).toBe('simulating for 0:35; no estimate of the time remaining yet');
  });

  it('shows a queued wash as waiting and a wash without stages by its fraction alone', () => {
    const queued = washProgressView({ status: 'queued', progress: 0 }, 0, 12);
    expect(queued.title).toBe('Waiting for the wash to start');
    expect(queued.fraction).toBe(0);
    expect(queued.times).toBe('waiting for 0:12');
    const plain = washProgressView({ status: 'running', progress: 0.4 }, 0, 75);
    expect(plain).toMatchObject({ title: 'Washing', step: '', fraction: 0.4, overdue: false });
    expect(plain.times).toBe('simulating for 1:15');
    expect(washProgressView({ status: 'running', progress: Number.NaN }, 0, 1).fraction).toBe(0);
    expect(washProgressView({ status: 'running', progress: 7 }, 0, 1).fraction).toBe(0.97);
  });
});

describe('the report', () => {
  const card = {
    items: [
      { item_id: 'bowl_01', display_name: 'Cereal bowl', points: 8, soils: [] },
      { item_id: 'glass_01', display_name: 'Tumbler', points: 6, soils: [] },
      { item_id: 'mug_01', display_name: 'Mug', points: 6, soils: [] },
      { item_id: 'plate_01', display_name: 'Dinner plate', points: 10, soils: [] },
    ],
    programme: { programme_id: 'eco_50', display_name: 'Eco 50', status: 'scored' },
    secondary_programmes: [
      { programme_id: 'auto_145', display_name: 'Auto 45-65', status: 'uncalibrated' },
    ],
  } as unknown as LevelCard;
  const loaded = {
    loaded: true as const,
    graded_score: 0,
    moved_during_wash: false,
    holds_water: false,
  };
  const report: WashReport = {
    benchmark_version: 'spotless-0.1.0/levels-1',
    level_id: 'tutorial',
    state_hash: 'sha256:00',
    job: {
      status: 'done',
      runtime_s: 75,
      fidelity: 'fast',
      sim_version: 'spotless-sim 0.1.0',
      notes: ['The lower arm could not turn: bowl_01 held it still.'],
    },
    score: { points: 8, points_available: 30, graded_points: 11.5, points_loaded: 24 },
    items: [
      {
        ...loaded,
        item_id: 'bowl_01',
        clean: true,
        points_awarded: 8,
        graded_score: 1,
        score_iec: 5,
        residual_fraction_area: 0,
        residue_regions: [],
        retained_water_ml: 0.4,
        residue_cells: 0,
      },
      { item_id: 'glass_01', loaded: false },
      {
        ...loaded,
        item_id: 'mug_01',
        clean: false,
        points_awarded: 0,
        score_iec: 5,
        residual_fraction_area: 0,
        residue_regions: [],
        holds_water: true,
        retained_water_ml: 212.34,
        reason: 'Holds 212 ml of water.',
        residue_cells: 310,
        likely_moved: true,
      },
      {
        ...loaded,
        item_id: 'plate_01',
        clean: false,
        points_awarded: 0,
        graded_score: 0.2,
        score_iec: 1,
        residual_fraction_area: 0.02,
        reason: 'Tomato sauce left on the well (2131 mm2 visibly soiled).',
        residue_regions: [
          {
            region: 'rim',
            fraction: 0.004,
            visible_area_mm2: 12,
            specks: 3,
            soils: [{ type: 'egg_yolk_dried', residual_fraction: 0.12 }],
          },
          {
            region: 'well',
            fraction: 0.071,
            visible_area_mm2: 2131.4,
            specks: 0,
            soils: [
              { type: 'tomato_sauce+cheese_melted', residual_fraction: 0.61 },
              { type: 'vegetable_oil', residual_fraction: 0 },
            ],
          },
        ],
        moved_during_wash: true,
        residue_cells: 540,
      },
    ],
  };

  it('lists every item with its verdict, points, score and reason, and the totals', () => {
    const view = reportView(card, report);
    expect(view.rows.map((r) => [r.item_id, r.status, r.points_awarded, r.points])).toEqual([
      ['bowl_01', 'clean', 8, 8],
      ['glass_01', 'left_out', 0, 6],
      ['mug_01', 'not_clean', 0, 6],
      ['plate_01', 'not_clean', 0, 10],
    ]);
    expect(view.rows.map((r) => r.verdict)).toEqual([
      'Clean',
      'Left out',
      'Not clean',
      'Not clean',
    ]);
    expect(view.rows.map((r) => r.score_iec)).toEqual([5, null, 5, 1]);
    expect(view.rows.map((r) => r.reason)).toEqual([
      null,
      null,
      'Holds 212 ml of water.',
      'Tomato sauce left on the well (2131 mm2 visibly soiled).',
    ]);
    expect(view.points).toBe(8);
    expect(view.points_available).toBe(30);
    expect(view.points_loaded).toBe(24);
    expect(view.clean).toBe(1);
    expect(view.loaded).toBe(3);
    expect(view.items).toBe(4);
    expect(view.not_simulated).toBe(false);
    expect(view.notice).toBeNull();
    // Retained water: stated when the item holds some, flagged when it holds too much.
    expect(view.rows.map((r) => r.water)).toEqual([
      '0.4 ml of water left in it',
      null,
      'holds 212.3 ml of water',
      null,
    ]);
    expect(view.rows[3]?.notes).toEqual(['moved during the wash']);
    // An item the jets would have moved is said to be one; it was washed where it lay.
    expect(view.rows[2]?.notes).toEqual([
      'the jets pushed it hard enough to have moved it (it was washed where it lay)',
    ]);
    expect(view.rows[0]?.notes).toEqual([]);
    // What can be looked at closely, and whether there is residue to paint.
    expect(view.rows.map((r) => r.inspectable)).toEqual([true, false, true, true]);
    expect(view.rows.map((r) => r.residue_cells)).toEqual([0, 0, 310, 540]);
  });

  it('says which tier produced it, and passes on what the wash has to say', () => {
    const view = reportView(card, report);
    expect(view.fidelity).toBe('fast');
    expect(view.produced_by).toBe(
      'Simulated as a quick preview (coarser than the full wash, which gives the scored result; a few verdicts may differ) by spotless-sim 0.1.0 in 1:15.',
    );
    // A fast wash is labelled a preview on the total; an official one is not labelled.
    expect(view.preview).toBe(true);
    expect(view.label).toBe('Quick preview');
    expect(view.notes).toEqual(['The lower arm could not turn: bowl_01 held it still.']);
    const official = reportView(card, { ...report, job: { ...report.job, fidelity: 'official' } });
    expect(official.produced_by).toBe('Simulated as the full wash by spotless-sim 0.1.0 in 1:15.');
    expect(official.preview).toBe(false);
    expect(official.label).toBeNull();
    // Without a verdict summary nothing is said of how the points were counted.
    expect(official.counting).toBeNull();
    expect(official.programme).toBe('Eco 50');
    expect(official.rows.every((row) => row.flags.length === 0)).toBe(true);
  });

  it('shows which verdicts are at the edge of clean or provisional, and how they were counted', () => {
    const flagged: WashReport = {
      ...report,
      job: { ...report.job, fidelity: 'official' },
      verdicts: {
        counting: 'binary_on_verdict',
        programme_id: 'eco_50',
        programme_status: 'scored',
        preview: false,
        edge: [
          { item_id: 'mug_01', points: 6, clean: false },
          { item_id: 'plate_01', points: 10, clean: true },
        ],
        provisional: [{ item_id: 'bowl_01', points: 8, clean: true }],
        all_provisional: false,
        points_strict: report.score.points - 10,
        points_lenient: report.score.points + 6,
      },
    };
    const view = reportView(card, flagged);
    const flags = new Map(view.rows.map((row) => [row.item_id, row.flags]));
    expect(flags.get('mug_01')).toEqual(['at the edge of clean']);
    expect(flags.get('plate_01')).toEqual(['at the edge of clean']);
    expect(flags.get('bowl_01')).toEqual(['provisional']);
    expect(flags.get('glass_01')).toEqual([]);
    expect(view.label).toBeNull();
    expect(view.counting).toBe(
      `Every item counts by the verdict given. 2 items worth 16 points are at the edge of clean (seen by a sharp eye, not by a lenient one): read either way the load scores ${report.score.points - 10} to ${report.score.points + 6} points. 1 item worth 8 points carries a provisional verdict: no measurement stands behind it on this programme.`,
    );
    expect(countingText({ ...flagged.verdicts, edge: [], provisional: [] } as never)).toBe(
      'Every item counts by the verdict given.',
    );
  });

  it('labels a wash on a programme the level is not scored on, and every verdict of it', () => {
    const auto: WashReport = {
      ...report,
      verdicts: {
        counting: 'binary_on_verdict',
        programme_id: 'auto_145',
        programme_status: 'uncalibrated',
        preview: true,
        edge: [],
        provisional: [],
        all_provisional: true,
        points_strict: report.score.points,
        points_lenient: report.score.points,
      },
    };
    const view = reportView(card, auto);
    expect(view.uncalibrated).toBe(true);
    expect(view.programme).toBe('Auto 45-65');
    expect(view.label).toBe('Quick preview, uncalibrated programme');
    expect(view.counting).toBe(
      'Every item counts by the verdict given. Every verdict of this wash is provisional.',
    );
    // Every washed item carries the flag; one that was left out carries none.
    for (const row of view.rows) {
      expect(row.flags, row.item_id).toEqual(row.status === 'left_out' ? [] : ['provisional']);
    }
  });

  it('lists where residue remains, most first, marked on the scale the item is painted with', () => {
    const view = reportView(card, report);
    expect(view.rows[0]?.residue).toEqual([]);
    const plate = view.rows[3]?.residue ?? [];
    expect(plate.map((r) => r.region)).toEqual(['well', 'rim']);
    expect(plate[0]?.text).toBe(
      '2131.4 mm² visibly soiled · 7.1% of the region · tomato sauce and cheese melted 61% left',
    );
    expect(plate[1]?.text).toBe(
      '12 mm² visibly soiled · 0.4% of the region · 3 specks · egg yolk dried 12% left',
    );
    // The mark of a region is the step of the soil of which most is left there.
    expect(plate[0]?.step).toBe(residueStep(0.61));
    expect(plate[1]?.step).toBe(residueStep(0.12));
    expect(plate[0]?.step).not.toBe(plate[1]?.step);
    // The legend is the scale itself.
    expect(residueLegend().map((entry) => entry.css)).toEqual(
      RESIDUE_STEPS.map((step) => step.css),
    );
    expect(residueLegend()).toHaveLength(4);
  });

  it('reads an older report that names regions only', () => {
    const older: WashReport = {
      ...report,
      job: { status: 'done', runtime_s: 12, fidelity: 'official' },
      score: { points: 0, points_available: 30, graded_points: 0 },
      items: [
        {
          ...loaded,
          item_id: 'plate_01',
          clean: false,
          points_awarded: 0,
          residual_fraction_area: 0.2,
          residue_regions: [
            { region: 'rim', fraction: 0.05 },
            { region: 'well', fraction: 0.6 },
            { region: 'underside', fraction: 0 },
          ],
        },
        { item_id: 'bowl_01', loaded: false },
        { item_id: 'glass_01', loaded: false },
        { item_id: 'mug_01', loaded: false },
      ],
    };
    const view = reportView(card, older);
    const plate = view.rows[0]?.residue ?? [];
    expect(plate.map((r) => r.region)).toEqual(['well', 'rim']);
    expect(plate[0]?.text).toBe('60% of the region');
    expect(plate[0]?.step).toBe(residueStep(0.6));
    expect(view.rows[0]?.reason).toBeNull();
    expect(view.rows[0]?.score_iec).toBeNull();
    expect(view.points_loaded).toBe(10);
    expect(view.produced_by).toBe('Simulated as the full wash in 0:12.');
  });

  it('says plainly when the wash was not simulated', () => {
    const placeholder: WashReport = {
      ...report,
      job: { status: 'done', runtime_s: 0, fidelity: 'placeholder_not_simulated' },
      score: { points: 0, points_available: 30, graded_points: 0 },
      items: [
        {
          ...loaded,
          item_id: 'bowl_01',
          clean: false,
          points_awarded: 0,
          residual_fraction_area: 0,
          residue_regions: [],
          simulated: false,
        },
        { item_id: 'glass_01', loaded: false },
        { item_id: 'mug_01', loaded: false },
        { item_id: 'plate_01', loaded: false },
      ],
    };
    const view = reportView(card, placeholder);
    expect(view.not_simulated).toBe(true);
    expect(view.notice).toContain('NOT simulated');
    expect(view.produced_by).toBe('Not simulated (placeholder wash runner).');
    expect(view.rows[0]?.status).toBe('not_simulated');
    expect(view.rows[0]?.verdict).toBe('Not simulated');
    expect(view.rows[0]?.inspectable).toBe(false);
    // "Not clean" is never claimed for an item nobody washed.
    expect(view.rows.some((r) => r.status === 'not_clean')).toBe(false);
    expect(reportStatus({ item_id: 'x', loaded: false })).toBe('left_out');
    // A report whose items are all unsimulated is flagged whatever its fidelity says.
    expect(
      reportView(card, { ...placeholder, job: { ...placeholder.job, fidelity: 'official' } })
        .not_simulated,
    ).toBe(true);
  });
});

describe('a note of the wash in the words of the page', () => {
  it('names the two washes as the page does and changes nothing else', () => {
    expect(
      noteInPageWords(
        'This is a fast wash, a preview of the official one (coarser surfaces, fewer droplets). Measured on this programme, its verdict on a soiled item differs from the official wash in 8 of 100 cases. Scores are counted on the official wash.',
      ),
    ).toBe(
      'This is a quick preview of the full wash (coarser surfaces, fewer droplets). Measured on this programme, its verdict on a soiled item differs from the full wash in 8 of 100 cases. Scores are counted on the full wash.',
    );
    expect(
      noteInPageWords(
        'This is a preview: the wash was simulated at the fast tier, whose verdicts differ from those of the official tier on some items of a full load. Scores are published at the official tier.',
      ),
    ).toBe(
      'This is a preview: the wash was simulated as a quick preview, whose verdicts differ from those of the full wash on some items of a full load. Scores are published from the full wash.',
    );
    expect(noteInPageWords('The item moved during the wash.')).toBe(
      'The item moved during the wash.',
    );
  });
});
