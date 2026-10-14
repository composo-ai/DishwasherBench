/**
 * How firm the verdicts of a wash report are, and how its points were counted: the
 * `verdicts` section the game server adds to every report it delivers
 * (`WashVerdictSummary` of the session contract).
 *
 * The points of a report are binary on the verdict of the standard inspector: that is the
 * headline (docs/research/benchmark.md section 9, item 1; taken so here).
 * Beside it the report says which loaded items are at the edge of clean, which carry a verdict
 * the parameters of the wash do not vouch for, what the points would be if every item at the
 * edge were read the other way, and whether it was a preview (the fast tier).
 *
 * Where the facts come from. The wash runner knows the verdict of every item at both ends of
 * the band in which a residue becomes visible, and which soils its parameters do not vouch
 * for on a programme, and says both in the notes of the job, naming the items
 * (`packages/wash-runner/src/report.ts`: "a, b are at the edge of clean: ...", and one note
 * per caveat of the parameter set: "a, b carry ...: they are provisional."). The report has no
 * field per item for either, so this module reads the notes: a note that begins with a list
 * of ids of loaded items is about those items, and is an edge note when it says so and a
 * provisional note otherwise. A test of this package holds the phrases to the runner's source.
 * The runner carrying both per item would make the reading unnecessary (an open request to
 * the wash runner).
 */

import type { Level } from '@spotless/levels';
import type { FlaggedItem, WashManifest, WashReport, WashVerdictSummary } from '@spotless/session';

/** What the runner's note on items at the edge of clean says after the item ids. */
export const EDGE_NOTE_PHRASE = 'at the edge of clean';

/** What the runner's note on a wash with stale parameters says. */
export const STALE_NOTE_PHRASE = 'this result is provisional';

/** The tier whose reports are previews. */
export const PREVIEW_TIER = 'fast';

/**
 * The item ids a note begins with ("a, b, c carry ..."), when every one of them is a loaded
 * item of the report, and the rest of the note; null when the note is not about items.
 */
function leadingItems(
  note: string,
  loaded: ReadonlySet<string>,
): { items: string[]; rest: string } | null {
  const match = /^((?:[A-Za-z0-9_]+, )*[A-Za-z0-9_]+) (.+)$/s.exec(note);
  if (match === null) return null;
  const items = (match[1] as string).split(', ');
  if (!items.every((id) => loaded.has(id))) return null;
  return { items, rest: match[2] as string };
}

/** The loaded items the notes of a report flag, by what they are flagged for. */
export function flaggedByNotes(report: WashReport): {
  readonly edge: readonly string[];
  readonly provisional: readonly string[];
  readonly stale: boolean;
} {
  const loaded = new Set(report.items.filter((item) => item.loaded).map((item) => item.item_id));
  const edge = new Set<string>();
  const provisional = new Set<string>();
  let stale = false;
  for (const note of report.job.notes ?? []) {
    if (note.includes(STALE_NOTE_PHRASE)) stale = true;
    const about = leadingItems(note, loaded);
    if (about === null) continue;
    if (/^(?:is|are) at the edge of clean\b/.test(about.rest)) {
      for (const id of about.items) edge.add(id);
    } else if (/\bprovisional\b/.test(about.rest)) {
      for (const id of about.items) provisional.add(id);
    }
  }
  return { edge: [...edge].sort(), provisional: [...provisional].sort(), stale };
}

/**
 * The verdict summary of a report of a load: see the header. `level` is the level the load
 * was played on (its points and the programme it is scored on).
 */
export function verdictSummary(
  report: WashReport,
  level: Pick<Level, 'items' | 'programmeId'>,
  programmeId: string,
): WashVerdictSummary {
  const points = new Map(level.items.map((item) => [item.id, item.points]));
  const verdict = new Map(
    report.items.map((item) => [item.item_id, item.loaded ? item.clean : false]),
  );
  const flags = flaggedByNotes(report);
  const flagged = (ids: readonly string[]): FlaggedItem[] =>
    ids.map((id) => ({
      item_id: id,
      points: points.get(id) ?? 0,
      clean: verdict.get(id) ?? false,
    }));
  const edge = flagged(flags.edge);
  return {
    counting: 'binary_on_verdict',
    programme_id: programmeId,
    // The session starts a wash on the programme the level is scored on and on no other.
    programme_status: 'scored',
    preview: report.job.fidelity === PREVIEW_TIER,
    edge,
    provisional: flagged(flags.provisional),
    all_provisional: flags.stale,
    points_strict:
      report.score.points -
      edge.filter((item) => item.clean).reduce((sum, item) => sum + item.points, 0),
    points_lenient:
      report.score.points +
      edge.filter((item) => !item.clean).reduce((sum, item) => sum + item.points, 0),
  };
}

/** What a player is told about a report of the fast tier. */
export const PREVIEW_REPORT_NOTE =
  'This is a preview: the wash was simulated at the fast tier, whose verdicts differ from those of the official tier on some items of a full load. Scores are published at the official tier.';

/**
 * The report as the game server delivers it: with its verdict summary, and with a note for a
 * preview. A report of a wash that simulated nothing (an
 * empty machine, the placeholder runner) is returned as it is. Idempotent.
 *
 * The wash runner says of a fast wash itself that it is a preview, with the measured agreement
 * of the two tiers under the parameters of the wash (`washTierNoteFor`). The note of this
 * module is for a report that does not say so: two notes saying the same of one wash, one of
 * them without the measurement, would be read as two findings.
 */
export function withVerdicts(report: WashReport, manifest: WashManifest): WashReport {
  if (report.job.fidelity === 'placeholder_not_simulated') return report;
  if (!report.items.some((item) => item.loaded)) return report;
  const summary = verdictSummary(report, manifest.level, manifest.programme_id);
  const notes = [...(report.job.notes ?? [])];
  const saysPreview = notes.some((note) => /\bpreview\b/i.test(note));
  if (summary.preview && !saysPreview && !notes.includes(PREVIEW_REPORT_NOTE)) {
    notes.push(PREVIEW_REPORT_NOTE);
  }
  return {
    ...report,
    job: { ...report.job, ...(notes.length === 0 ? {} : { notes }) },
    verdicts: summary,
  };
}
