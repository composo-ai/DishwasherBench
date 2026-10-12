/**
 * What the wash panel says: the progress of a running wash by its real stages, and the report
 * of a finished one, each as plain data for the page to show. Pure functions of what the
 * server sent; nothing here judges a load.
 */

import type { ResidueStep } from '@spotless/render';
import { RESIDUE_STEPS, residueStep } from '@spotless/render';
import type {
  ItemRecord,
  JobStatus,
  LevelCard,
  ResidueRegion,
  WashReport,
  WashReportItem,
  WashStageProgress,
} from '@spotless/session';
import { clock, tidy } from './format.ts';

// ---------------------------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------------------------

/** A wash in hand as the client knows it. */
export interface WashInHand {
  readonly status: JobStatus;
  /** Fraction complete as last reported, 0 to 1. */
  readonly progress: number;
  /** The stage as last reported, when the runner reports stages. */
  readonly stage?: WashStageProgress;
}

/** Where a wash stands, for the page. */
export interface WashProgressView {
  /** What is going on, in a few words. */
  readonly title: string;
  /** Where in the wash that is: the step and how far it is; empty when not known. */
  readonly step: string;
  /** Width of the bar, 0 to 1. */
  readonly fraction: number;
  /** Time so far and the estimate of what remains, in words. */
  readonly times: string;
  /** True when the stage has run past its estimate: the page says so and does not guess. */
  readonly overdue: boolean;
}

/** The bar never reads as finished before the report is there. */
const BAR_MAX_RUNNING = 0.97;

/**
 * Where a wash stands. `sinceReportS` is the time since the stage was last reported: the
 * simulation reports its long stages rarely (a stage may say nothing for minutes), so the
 * estimate of the time remaining is counted down here from its value at the last report, and
 * when it runs out the view says that the stage is taking longer than estimated instead of
 * inventing a new figure. `sinceStartS` is the time since the page first saw the wash, used
 * only while no stage has been reported.
 */
export function washProgressView(
  wash: WashInHand,
  sinceReportS: number,
  sinceStartS: number,
): WashProgressView {
  const progress = Number.isFinite(wash.progress) ? Math.max(0, Math.min(1, wash.progress)) : 0;
  if (wash.status === 'queued') {
    return {
      title: 'Waiting for the wash to start',
      step: 'One wash is simulated at a time; this one is in the queue.',
      fraction: 0,
      times: `waiting for ${clock(sinceStartS)}`,
      overdue: false,
    };
  }
  const stage = wash.stage;
  if (stage === undefined) {
    return {
      title: 'Washing',
      step: '',
      fraction: Math.min(BAR_MAX_RUNNING, progress),
      times: `simulating for ${clock(sinceStartS)}`,
      overdue: false,
    };
  }
  const since = Math.max(0, sinceReportS);
  const elapsed = stage.elapsed_s + since;
  const part =
    stage.fraction > 0 && stage.fraction < 1 ? `, ${Math.round(stage.fraction * 100)}% done` : '';
  const step = `Step ${stage.index} of ${stage.count}${part}`;
  if (stage.eta_s === null) {
    return {
      title: stage.label,
      step,
      fraction: Math.min(BAR_MAX_RUNNING, progress),
      times: `simulating for ${clock(elapsed)}; no estimate of the time remaining yet`,
      overdue: false,
    };
  }
  const remaining = stage.eta_s - since;
  if (remaining > 0) {
    return {
      title: stage.label,
      step,
      // The share of the estimated time that has passed, never less than what was reported.
      fraction: Math.min(BAR_MAX_RUNNING, Math.max(progress, elapsed / (elapsed + remaining))),
      times:
        `simulating for ${clock(elapsed)}, about ${clock(remaining)} to go ` +
        '(an estimate from earlier washes; long steps report rarely)',
      overdue: false,
    };
  }
  return {
    title: stage.label,
    step,
    fraction: Math.min(BAR_MAX_RUNNING, Math.max(progress, elapsed / (elapsed + 1))),
    times:
      `simulating for ${clock(elapsed)}; this step is taking ${clock(-remaining)} longer than ` +
      'estimated and is still running',
    overdue: true,
  };
}

// ---------------------------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------------------------

/** How an item came out. */
export type ReportStatus = 'clean' | 'not_clean' | 'left_out' | 'not_simulated';

/** One region of an item that still shows soil, as the page lists it. */
export interface ReportRegion {
  readonly region: string;
  /** The region in words: `interior base`. */
  readonly label: string;
  /** Share of the region's surface that is visibly soiled. */
  readonly fraction: number;
  /** The step of the residue scale the region is marked with (most soil left on it). */
  readonly step: ResidueStep;
  /** What is left there, in words: area, specks, soils. */
  readonly text: string;
}

/** One row of the report. */
export interface ReportRow {
  readonly item_id: string;
  readonly display_name: string;
  readonly status: ReportStatus;
  /** Status in words. */
  readonly verdict: string;
  /** Points the item is worth and points it scored. */
  readonly points: number;
  readonly points_awarded: number;
  /** IEC-style score 0 to 5, when the report gives one. */
  readonly score_iec: number | null;
  /** Why the item is not clean, when it is not and the report says. */
  readonly reason: string | null;
  /** Where residue remains, most first. */
  readonly residue: readonly ReportRegion[];
  /** The water the item holds, in words, or null when it holds none worth a mention. */
  readonly water: string | null;
  /** Further facts of the report, in words. */
  readonly notes: readonly string[];
  /**
   * What the report says about how firm the verdict is, in words: "at the edge of clean",
   * "provisional". Empty for a verdict nothing is said about.
   */
  readonly flags: readonly string[];
  /** True when the item was washed and can be looked at closely. */
  readonly inspectable: boolean;
  /** Cells of the item's residue map: 0 when nothing is left on it, or none was made. */
  readonly residue_cells: number;
}

/** The report as the page shows it. */
export interface ReportView {
  readonly rows: readonly ReportRow[];
  readonly points: number;
  readonly points_available: number;
  /** Points of the items that were washed. */
  readonly points_loaded: number;
  readonly graded_points: number;
  readonly clean: number;
  readonly loaded: number;
  readonly items: number;
  /** True when no wash was simulated (the placeholder runner): the points mean nothing. */
  readonly not_simulated: boolean;
  /** One sentence saying so, or null. */
  readonly notice: string | null;
  readonly fidelity: string;
  /** Which simulation produced the report, in a sentence. */
  readonly produced_by: string;
  /** What the load did to the machine, and what else the wash has to say. */
  readonly notes: readonly string[];
  /** True for a wash at the fast tier: a preview, not a result. */
  readonly preview: boolean;
  /** The label the page puts on the total of a preview or of an uncalibrated programme, or null. */
  readonly label: string | null;
  /** The programme the load was washed on, and whether it is the one the level is scored on. */
  readonly programme: string;
  readonly uncalibrated: boolean;
  /**
   * How the points were counted, in a sentence: binary on the verdict, with how many items
   * were at the edge of clean or provisional and what the points would be with the edge items
   * read either way. Null when the report does not say.
   */
  readonly counting: string | null;
}

/** How one report item came out. */
export function reportStatus(item: WashReportItem): ReportStatus {
  if (!item.loaded) return 'left_out';
  if (item.simulated === false) return 'not_simulated';
  return item.clean ? 'clean' : 'not_clean';
}

const VERDICTS: { readonly [status in ReportStatus]: string } = {
  clean: 'Clean',
  not_clean: 'Not clean',
  left_out: 'Left out',
  not_simulated: 'Not simulated',
};

/** A soil id in words: `tomato_sauce+cheese_melted` is "tomato sauce and cheese melted". */
function soilWords(type: string): string {
  return type
    .split('+')
    .map((id) => id.replaceAll('_', ' '))
    .join(' and ');
}

function regionView(region: ResidueRegion): ReportRegion {
  const soils = (region.soils ?? []).filter((soil) => soil.residual_fraction > 0);
  const most = soils.reduce((max, soil) => Math.max(max, soil.residual_fraction), 0);
  const parts: string[] = [];
  if (region.visible_area_mm2 !== undefined) {
    parts.push(`${tidy(region.visible_area_mm2)} mm² visibly soiled`);
  }
  parts.push(`${tidy(region.fraction * 100)}% of the region`);
  if ((region.specks ?? 0) > 0) {
    parts.push(`${region.specks} speck${region.specks === 1 ? '' : 's'}`);
  }
  for (const soil of soils) {
    parts.push(`${soilWords(soil.type)} ${Math.round(soil.residual_fraction * 100)}% left`);
  }
  return {
    region: region.region,
    label: region.region.replaceAll('_', ' '),
    fraction: region.fraction,
    // The scale of the painting is the share of soil left on a spot; a report without soils
    // per region is marked by the share of the region that is soiled.
    step: residueStep(soils.length > 0 ? most : region.fraction),
    text: parts.join(' · '),
  };
}

/** The tier of a report in words. */
function producedBy(report: WashReport): string {
  const { fidelity, sim_version: version } = report.job;
  if (fidelity.includes('placeholder')) return 'Not simulated (placeholder wash runner).';
  const tier =
    fidelity === 'official'
      ? 'as the full wash'
      : fidelity === 'fast'
        ? 'as a quick preview (coarser than the full wash, which gives the scored result; a few verdicts may differ)'
        : `at fidelity "${fidelity}"`;
  return (
    `Simulated ${tier}` +
    (version === undefined ? '' : ` by ${version}`) +
    ` in ${clock(report.job.runtime_s)}.`
  );
}

/** The report as rows, in the order of the report's items, with the totals. */
export function reportView(card: LevelCard, report: WashReport): ReportView {
  const records = new Map<string, ItemRecord>(card.items.map((item) => [item.item_id, item]));
  const verdicts = report.verdicts;
  const edge = new Set((verdicts?.edge ?? []).map((item) => item.item_id));
  const provisional = new Set((verdicts?.provisional ?? []).map((item) => item.item_id));
  const allProvisional = verdicts?.all_provisional === true;
  const rows: ReportRow[] = report.items.map((item) => {
    const record = records.get(item.item_id);
    const status = reportStatus(item);
    const washed = item.loaded && status !== 'not_simulated';
    const residue =
      item.loaded && washed
        ? [...item.residue_regions]
            .filter((r) => r.fraction > 0 || (r.visible_area_mm2 ?? 0) > 0 || (r.specks ?? 0) > 0)
            .sort(
              (a, b) =>
                (b.visible_area_mm2 ?? b.fraction) - (a.visible_area_mm2 ?? a.fraction) ||
                a.region.localeCompare(b.region),
            )
            .map(regionView)
        : [];
    const notes: string[] = [];
    let water: string | null = null;
    if (item.loaded && washed) {
      if (item.moved_during_wash) notes.push('moved during the wash');
      if (item.likely_moved === true) {
        notes.push('the jets pushed it hard enough to have moved it (it was washed where it lay)');
      }
      const held = item.retained_water_ml;
      if (item.holds_water) {
        water = held === undefined ? 'holds water' : `holds ${tidy(held)} ml of water`;
      } else if (held !== undefined && held >= 0.05) {
        water = `${tidy(held)} ml of water left in it`;
      }
    }
    return {
      item_id: item.item_id,
      display_name: record?.display_name ?? item.item_id,
      status,
      verdict: VERDICTS[status],
      points: record?.points ?? 0,
      points_awarded: item.loaded ? item.points_awarded : 0,
      score_iec: item.loaded && washed ? (item.score_iec ?? null) : null,
      reason: item.loaded && washed && !item.clean ? (item.reason ?? null) : null,
      residue,
      water,
      notes,
      flags: [
        ...(edge.has(item.item_id) ? ['at the edge of clean'] : []),
        ...(item.loaded && washed && (allProvisional || provisional.has(item.item_id))
          ? ['provisional']
          : []),
      ],
      inspectable: washed,
      residue_cells: item.loaded && washed ? (item.residue_cells ?? 0) : 0,
    };
  });
  const loaded = report.items.filter((item) => item.loaded);
  const notSimulated =
    report.job.fidelity.includes('placeholder') ||
    (loaded.length > 0 && loaded.every((item) => item.loaded && item.simulated === false));
  return {
    rows,
    points: report.score.points,
    points_available: report.score.points_available,
    points_loaded:
      report.score.points_loaded ??
      loaded.reduce((sum, item) => sum + (records.get(item.item_id)?.points ?? 0), 0),
    graded_points: report.score.graded_points,
    clean: rows.filter((row) => row.status === 'clean').length,
    loaded: loaded.length,
    items: report.items.length,
    not_simulated: notSimulated,
    notice: notSimulated
      ? 'This wash was NOT simulated. The server ran its placeholder wash runner, which washes nothing: no item was judged, and the zero points say nothing about this load.'
      : null,
    fidelity: report.job.fidelity,
    produced_by: producedBy(report),
    notes: (report.job.notes ?? []).map(noteInPageWords),
    preview: report.job.fidelity === 'fast',
    label: totalLabel(report),
    programme: programmeName(card, verdicts?.programme_id ?? card.programme.programme_id),
    uncalibrated: verdicts?.programme_status === 'uncalibrated',
    counting: verdicts === undefined ? null : countingText(verdicts),
  };
}

/** The display name of a programme of the level card, or its id. */
function programmeName(card: LevelCard, id: string): string {
  return (
    [card.programme, ...card.secondary_programmes].find((p) => p.programme_id === id)
      ?.display_name ?? id
  );
}

/** What the total of a report is labelled with: a preview, an uncalibrated programme, or both. */
function totalLabel(report: WashReport): string | null {
  const parts = [
    ...(report.job.fidelity === 'fast' ? ['Quick preview'] : []),
    ...(report.verdicts?.programme_status === 'uncalibrated' ? ['uncalibrated programme'] : []),
  ];
  return parts.length === 0 ? null : parts.join(', ');
}

function itemsWorth(items: readonly { readonly points: number }[]): string {
  const points = items.reduce((sum, item) => sum + item.points, 0);
  return `${items.length} item${items.length === 1 ? '' : 's'} worth ${points} point${points === 1 ? '' : 's'}`;
}

/** How the points of a report were counted, in a sentence or two. */
export function countingText(verdicts: NonNullable<WashReport['verdicts']>): string {
  const parts = ['Every item counts by the verdict given.'];
  if (verdicts.edge.length > 0) {
    parts.push(
      `${itemsWorth(verdicts.edge)} ${verdicts.edge.length === 1 ? 'is' : 'are'} at the edge of clean (seen by a sharp eye, not by a lenient one): read either way the load scores ${verdicts.points_strict} to ${verdicts.points_lenient} points.`,
    );
  }
  if (verdicts.all_provisional) {
    parts.push('Every verdict of this wash is provisional.');
  } else if (verdicts.provisional.length > 0) {
    parts.push(
      `${itemsWorth(verdicts.provisional)} carr${verdicts.provisional.length === 1 ? 'ies' : 'y'} a provisional verdict: no measurement stands behind it on this programme.`,
    );
  }
  return parts.join(' ');
}

/** The legend of the residue scale: one entry per step, lightest first. */
export function residueLegend(): readonly { readonly css: string; readonly label: string }[] {
  return RESIDUE_STEPS.map((step) => ({ css: step.css, label: step.label }));
}

/**
 * A note of a wash in the words of this page. The wash runner calls its two washes the fast
 * and the official one (the names of the tiers, which a program uses); the page calls them the
 * quick preview and the full wash everywhere else, and a report that used both pairs read as
 * if there were four washes. Only those names are changed.
 */
export function noteInPageWords(note: string): string {
  return note
    .replace(/\ba fast wash, a preview of the official one\b/g, 'a quick preview of the full wash')
    .replace(/\bat the fast tier\b/g, 'as a quick preview')
    .replace(/\bat the official tier\b/g, 'from the full wash')
    .replace(/\b(the |a )?fast (wash|tier)\b/g, (_m, article: string | undefined) =>
      article === 'a ' ? 'a quick preview' : 'the quick preview',
    )
    .replace(/\b(the )?official (wash|tier|one)\b/g, 'the full wash')
    .replace(
      /(^|[.!?]\s+)the (quick preview|full wash)/g,
      (_m, lead: string, name: string) => `${lead}The ${name}`,
    );
}
