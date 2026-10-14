// How firm the verdicts of a report are: read from the notes the wash runner writes, counted,
// and carried into the episode's score.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Level } from '@spotless/levels';
import { findLevel } from '@spotless/levels';
import type { WashManifest, WashReport, WashReportItem } from '@spotless/session';
import { describe, expect, it } from 'vitest';
import { scoreOf } from './episode.ts';
import {
  EDGE_NOTE_PHRASE,
  PREVIEW_REPORT_NOTE,
  STALE_NOTE_PHRASE,
  flaggedByNotes,
  verdictSummary,
  withVerdicts,
} from './verdicts.ts';

const level = findLevel('tutorial') as Level;
const points = new Map(level.items.map((item) => [item.id, item.points]));

function loaded(id: string, clean: boolean): WashReportItem {
  return {
    item_id: id,
    loaded: true,
    clean,
    points_awarded: clean ? (points.get(id) ?? 0) : 0,
    graded_score: clean ? 1 : 0,
    residual_fraction_area: 0,
    residue_regions: [],
    moved_during_wash: false,
    holds_water: false,
  };
}

/** A report of the tutorial: everything loaded but the knife, the mug and a fork not clean. */
function report(notes: readonly string[], fidelity = 'official'): WashReport {
  const items = [...level.items]
    .map((item) => item.id)
    .sort()
    .map((id): WashReportItem =>
      id === 'knife_01'
        ? { item_id: id, loaded: false }
        : loaded(id, id !== 'mug_01' && id !== 'fork_02'),
    );
  const scored = items.reduce((sum, item) => sum + (item.loaded ? item.points_awarded : 0), 0);
  return {
    benchmark_version: 'test',
    level_id: level.id,
    state_hash: 'sha256:00',
    job: { status: 'done', runtime_s: 1, fidelity, notes },
    score: {
      points: scored,
      points_available: 64,
      graded_points: scored,
      points_loaded: 62,
    },
    items,
  };
}

const manifest = (programme = level.programmeId): WashManifest =>
  ({ level, programme_id: programme }) as unknown as WashManifest;

const EDGE =
  'mug_01, plate_02 are at the edge of clean: what is left on them is seen by a sharp eye and not by a lenient one. The verdict given is that of the standard inspector.';
const CAVEAT =
  'bowl_01, spoon_01 carry a protein soil (egg, meat, cheese, heated milk, yoghurt) or a stain (tea, coffee, wine). On this programme the verdicts on these soils are not yet backed by a measurement on this machine: they are provisional.';

describe('the notes of the wash runner', () => {
  it('are still worded the way this package reads them', () => {
    // The phrases are the runner's (`packages/wash-runner/src/report.ts` and its defaults):
    // when it rewords a note this fails, and the reading here is brought in line.
    const runner = readFileSync(
      fileURLToPath(new URL('../../wash-runner/src/report.ts', import.meta.url)),
      'utf8',
    );
    expect(runner).toContain(`${EDGE_NOTE_PHRASE}: what is left on`);
    expect(runner).toContain("${edge.join(', ')} ${edge.length === 1 ? 'is' : 'are'} at the edge");
    expect(runner).toContain(STALE_NOTE_PHRASE);
    // A caveat's note is the parameter set's own words (none on the owner's machine).
    expect(runner).toContain("notes.push(`${concerned.join(', ')} ${caveat.note}`)");
  });

  it('name the items at the edge of clean and the items with a provisional verdict', () => {
    const flags = flaggedByNotes(
      report([
        'The lower arm could not turn: bowl_01 held it still. It sprayed from where it stood for the whole wash.',
        CAVEAT,
        EDGE,
        'glass_01 was pushed by the jets hard enough to have been moved. The wash is simulated with every item where it was placed.',
      ]),
    );
    expect(flags).toEqual({
      edge: ['mug_01', 'plate_02'],
      provisional: ['bowl_01', 'spoon_01'],
      stale: false,
    });
    // One item, and the singular the runner then writes.
    expect(
      flaggedByNotes(
        report(['fork_01 is at the edge of clean: what is left on it is seen by a sharp eye.']),
      ).edge,
    ).toEqual(['fork_01']);
  });

  it('read nothing into a note that is not about loaded items', () => {
    expect(
      flaggedByNotes(
        report([
          'knife_01 is at the edge of clean: it was not loaded, so this is no note of the runner.',
          'nothing here is provisional at all',
          'plate_09 carry something provisional',
        ]),
      ),
    ).toEqual({ edge: [], provisional: [], stale: false });
    expect(
      flaggedByNotes(
        report([
          'The parameter set anchored-x was made for another state of the simulator and was used all the same: this result is provisional.',
        ]),
      ).stale,
    ).toBe(true);
  });
});

describe('the verdict summary of a report', () => {
  it('counts binary on the verdict and says what the edge items are worth either way', () => {
    const base = report([CAVEAT, EDGE]);
    const summary = verdictSummary(base, level, level.programmeId);
    expect(summary).toEqual({
      counting: 'binary_on_verdict',
      programme_id: 'eco_50',
      programme_status: 'scored',
      preview: false,
      edge: [
        { item_id: 'mug_01', points: 6, clean: false },
        { item_id: 'plate_02', points: 10, clean: true },
      ],
      provisional: [
        { item_id: 'bowl_01', points: 8, clean: true },
        { item_id: 'spoon_01', points: 2, clean: true },
      ],
      all_provisional: false,
      // The plate at the edge read not clean; the mug at the edge read clean.
      points_strict: base.score.points - 10,
      points_lenient: base.score.points + 6,
    });
  });

  it('is added to a delivered report once, with a note for a preview', () => {
    const fast = withVerdicts(report([EDGE], 'fast'), manifest());
    expect(fast.verdicts?.preview).toBe(true);
    expect(fast.job.notes).toEqual([EDGE, PREVIEW_REPORT_NOTE]);
    // Idempotent: a report taken from the store and delivered again is not annotated twice.
    expect(withVerdicts(fast, manifest())).toEqual(fast);

    // The wash runner says of a fast wash itself that it is a preview, with the measured
    // agreement of the tiers: the report is not told so a second time.
    const TIER =
      'This is a fast wash, a preview of the official one (coarser surfaces, fewer droplets). How often its verdicts differ from the official wash has not been measured for these parameters.';
    const told = withVerdicts(report([TIER, EDGE], 'fast'), manifest());
    expect(told.verdicts?.preview).toBe(true);
    expect(told.job.notes).toEqual([TIER, EDGE]);

    const official = withVerdicts(report([]), manifest());
    expect(official.job.notes ?? []).toEqual([]);
    expect(official.verdicts).toMatchObject({
      edge: [],
      provisional: [],
      all_provisional: false,
      points_strict: official.score.points,
      points_lenient: official.score.points,
    });
  });

  it('leaves a report alone that judged nothing', () => {
    const placeholder = report([], 'placeholder_not_simulated');
    expect(withVerdicts(placeholder, manifest())).toBe(placeholder);
    const empty: WashReport = {
      ...report([]),
      items: level.items.map((item) => ({ item_id: item.id, loaded: false as const })),
    };
    expect(withVerdicts(empty, manifest())).toBe(empty);
  });
});

describe('the score of an episode', () => {
  it('carries the counting, the band and the labels of its report', () => {
    const delivered = withVerdicts(report([CAVEAT, EDGE], 'fast'), manifest());
    expect(scoreOf(delivered)).toMatchObject({
      points: delivered.score.points,
      counting: 'binary_on_verdict',
      points_strict: delivered.score.points - 10,
      points_lenient: delivered.score.points + 6,
      edge_items: 2,
      edge_points: 16,
      provisional_items: 2,
      provisional_points: 10,
      preview: true,
      programme_id: 'eco_50',
      programme_status: 'scored',
    });
    // A report without a summary gives the score it always gave.
    expect(Object.keys(scoreOf(report([]))).sort()).toEqual([
      'graded_points',
      'items_clean',
      'items_loaded',
      'items_total',
      'points',
      'points_available',
      'points_loaded',
      'share',
      'simulated',
    ]);
  });
});
