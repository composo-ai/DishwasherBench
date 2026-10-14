/**
 * The reports of the phenomena suite: Markdown for people, JSON for tools, and the comparison
 * of several runs (two tiers, or several seeds) check by check.
 *
 * Pure text building; `cli.ts` writes the files.
 */

import { bandText } from './bands.ts';
import type {
  CaseReport,
  CheckReport,
  ScenarioReport,
  SuiteReport,
  SurfaceDiagnostics,
  Verdict,
} from './types.ts';

/** A number for a table: three significant digits, no exponent for ordinary sizes. */
export function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (!Number.isFinite(value)) return Number.isNaN(value) ? 'n/a' : value > 0 ? 'inf' : '-inf';
  if (value === 0) return '0';
  const a = Math.abs(value);
  if (a >= 1000) return value.toFixed(0);
  if (a >= 0.001) return String(Number(value.toPrecision(3)));
  return value.toExponential(1);
}

const cell = (text: string): string => text.replace(/\|/g, '/').replace(/\n/g, ' ');

/** The check a scenario's headline shows: the first deciding check that is not a pass, else the first deciding one. */
export function headlineCheck(scenario: ScenarioReport): CheckReport | undefined {
  const deciding = scenario.checks.filter((c) => c.decides);
  return deciding.find((c) => c.verdict === scenario.verdict) ?? deciding[0];
}

function measuredText(c: CheckReport | undefined): string {
  if (c === undefined) return '';
  if (c.value === null) return c.note;
  const parts = c.a !== null && c.b !== null ? `${fmt(c.a)} -> ${fmt(c.b)}: ` : '';
  return `${parts}${fmt(c.value)} ${c.unit}`;
}

function surfaceRow(label: string, s: SurfaceDiagnostics): string {
  const e = s.exposure;
  const soils = s.soils
    .map((soil) => `${soil.type} (${soil.law}) ${fmt(soil.residual_mg)}/${fmt(soil.initial_mg)} mg`)
    .join('; ');
  const pools = s.pools
    .map((p) => `${fmt(p.capacity_mL)} mL, full for ${fmt(p.timeFull_s)} s`)
    .join('; ');
  return (
    `| ${label} | ${cell(s.item)}${s.regions.length > 0 ? ` (${s.regions.join(', ')})` : ''} | ` +
    `${fmt(e.fJet)} | ${fmt(e.jetAreaShare)} | ${fmt(e.shearPeakMax_Pa)} | ${fmt(e.shearMean_Pa)} | ` +
    `${fmt(e.wetTime)} | ${fmt(e.wettedAreaShare)} | ${fmt(e.flux_kg_m2_s)} | ${fmt(e.renewal_per_s)} | ` +
    `${fmt(e.filmShear_Pa)} | ${fmt(e.pooledAreaShare)} | ${cell(pools)} | ` +
    `${s.score} | ${fmt(s.visibleArea_mm2)} | ${fmt(s.pooled_mL)} | ${fmt(s.film_g)} | ${cell(soils)} |`
  );
}

function caseLines(c: CaseReport): string[] {
  const l = c.liquor;
  const lines = [
    `- **${c.label}**: ${c.what}. Load \`${c.load}\`, programme \`${c.programme}\`, ` +
      `${c.items} items (${c.cleanItems} clean${Number.isNaN(c.meanScore) ? '' : `, mean score of the soiled ${fmt(c.meanScore)}`}), ` +
      `seeds ${c.levelSeed}/${c.simSeed}` +
      `${c.dispenserBlocked ? ', dispenser blocked' : ''}` +
      `${Object.keys(c.stalledArms).length > 0 ? `, ${Object.keys(c.stalledArms).join(' and ')} arm stopped` : ''}` +
      `${Object.keys(c.params).length > 0 ? `, parameters ${JSON.stringify(c.params)}` : ''}. ` +
      `Liquor of the main wash: ${fmt(l.washTime_s / 60)} min with detergent, mean ${fmt(l.temperatureMean_C)} C (max ${fmt(l.temperatureMax_C)} C), ` +
      `pH ${fmt(l.pHMean)} (max ${fmt(l.pHMax)}), protease mean ${fmt(l.proteaseMean_g_L)} g/L (peak ${fmt(l.proteasePeak_g_L)}), ` +
      `peracid mean ${fmt(l.peracidMean_mmol_L)} mmol/L (peak ${fmt(l.peracidPeak_mmol_L)}). ` +
      `Result \`${c.resultHash.slice(0, 19)}\`, ${c.seconds} s${c.exposureCached ? ' (exposure cached)' : ''}.`,
  ];
  if (c.exactOverlap_mm > 0) {
    lines.push(
      `  - set pose: deepest overlap ${fmt(c.exactOverlap_mm)} mm (${c.exactOverlapWith})`,
    );
  }
  for (const problem of c.problems) lines.push(`  - wash: ${problem}`);
  for (const note of c.loadNotes) lines.push(`  - load: ${note}`);
  return lines;
}

function scenarioLines(s: ScenarioReport): string[] {
  const lines: string[] = [
    `### ${s.id} ${s.title}: ${s.verdict}`,
    '',
    `Test: ${s.test}.`,
    '',
    `Adapted: ${s.adapted}`,
    '',
    `Stages: ${s.stages}.${s.note === '' ? '' : ` Note: ${s.note}.`}`,
    '',
    '| Check | Quantity | A | B | Measured | Expected (checklist) | Accepted | Verdict |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const c of s.checks) {
    lines.push(
      `| ${c.id}${c.decides ? '' : ' (supporting)'} | ${cell(c.quantity)} | ${fmt(c.a)} | ${fmt(c.b)} | ` +
        `${c.value === null ? '' : `${fmt(c.value)} ${c.unit}`} | ${cell(c.expected.stated)} | ` +
        `${bandText(c.expected)} | ${c.verdict}${c.note === '' ? '' : `: ${cell(c.note)}`} |`,
    );
  }
  lines.push('');
  for (const c of s.cases) lines.push(...caseLines(c));
  const surfaces = s.cases.flatMap((c) =>
    c.surfaces.map((surface) => ({ label: c.label, surface })),
  );
  if (surfaces.length > 0) {
    lines.push(
      '',
      '| Wash | Surface | f_jet | jet area | peak shear Pa | mean shear Pa | wet time | wetted area | flux kg/m2/s | renewal 1/s | film shear Pa | pooled area | pools | score | visible mm2 | pooled mL | film g | soils left |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    );
    for (const { label, surface } of surfaces) lines.push(surfaceRow(label, surface));
  }
  lines.push('');
  return lines;
}

/** The Markdown report of a run. */
export function reportMarkdown(report: SuiteReport): string {
  const lines: string[] = [
    `# Phenomena suite: ${report.tier} tier, ${report.paramSet}`,
    '',
    `Checklist: docs/research/standards.md section 9 (P01 to P48). Machine \`${report.machineId}\`. ` +
      `Simulation \`${report.simVersion}\`; parameters ${report.paramSet} ` +
      `(hydro \`${report.hydroHash.slice(0, 19)}\`, soil \`${report.soilHash.slice(0, 19)}\`` +
      `${Object.keys(report.paramOverrides).length > 0 ? `, ${Object.keys(report.paramOverrides).length} overrides` : ''})` +
      `${(report.paramSetsStale ?? []).length > 0 ? ` **STALE, accepted knowingly: ${(report.paramSetsStale ?? []).join(', ')}**` : ''}. ` +
      `Detergent: ${report.detergent === undefined ? "the machine's own dose of the reference detergent" : `${report.detergent.name}, ${report.detergent.dose_g} g`}. ` +
      `${report.sourceFingerprint === undefined ? '' : `Source \`${report.sourceFingerprint.slice(0, 16)}\`. `}` +
      `Exposure traced on: ${report.exposureBackend}. ${report.scenarios.length} phenomena, ${report.washes} washes (${report.washesCached} with cached exposure), ${report.seconds} s.`,
    '',
    ...(report.tierNote === undefined ? [] : [`**Tier.** ${report.tierNote}`, '']),
    `Verdicts: ${(Object.keys(report.counts) as Verdict[])
      .filter((v) => report.counts[v] > 0)
      .map((v) => `${report.counts[v]} ${v}`)
      .join(', ')}.`,
    '',
    'A verdict is that of the deciding checks: the worst of them. Supporting checks are evidence and decide nothing. ' +
      '"Accepted" is the checklist\'s range with its tolerance (a factor of two, or one score point; a negative control may reach twice its limit).',
    '',
    '| ID | Phenomenon | Verdict | Measured | Expected | Accepted |',
    '|---|---|---|---|---|---|',
  ];
  for (const s of report.scenarios) {
    const c = headlineCheck(s);
    lines.push(
      `| ${s.id} | ${cell(s.title)} | ${s.verdict} | ${cell(c === undefined ? s.note : `${c.id}: ${measuredText(c)}`)} | ` +
        `${cell(c?.expected.stated ?? '')} | ${c === undefined ? '' : bandText(c.expected)} |`,
    );
  }
  lines.push('', '## Phenomena', '');
  for (const s of report.scenarios) lines.push(...scenarioLines(s));
  lines.push(
    '## Columns of the diagnostics',
    '',
    'Per affected surface, time-weighted over the circulation of the programme: `f_jet` fraction of time under a direct jet (wall shear above the first of `jets.shearLevels`), mean over the surface; ' +
      '`jet area` share of the surface ever under a jet; `peak shear` largest wall shear of a jet on it; `mean shear` mean wall shear while inside a footprint; ' +
      '`wet time` fraction of time there is water on it; `wetted area` share that is wet in at least one spray state; `flux` water received (what lands out of the air per area, plus what runs on per width over a 4 mm reference run: the same at both tiers); `renewal` rate the water on it is replaced; ' +
      '`film shear` wall shear of the draining film; `pooled area` share under a pool when the pool is full; `pools` capacity and the time each pool stands full. ' +
      'The soil model reports no removal by mechanism: `soils left` gives, per soil, the removal law of its model class and the dry mass left of the mass applied.',
    '',
  );
  return `${lines.join('\n')}\n`;
}

/** The JSON report of a run: the report object, with non-finite numbers as null. */
export function reportJson(report: SuiteReport): string {
  return `${JSON.stringify(
    report,
    (_key, value: unknown) => (typeof value === 'number' && !Number.isFinite(value) ? null : value),
    1,
  )}\n`;
}

/** One check across several runs. */
export interface ComparedCheck {
  readonly scenario: string;
  readonly check: string;
  readonly decides: boolean;
  readonly values: readonly (number | null)[];
  readonly verdicts: readonly Verdict[];
  /** Largest minus smallest value of the runs that have one. */
  readonly range: number;
  /** True when the verdicts are not all the same. */
  readonly disagree: boolean;
}

/** Compares runs check by check (scenarios and checks present in every run). */
export function compareReports(reports: readonly SuiteReport[]): ComparedCheck[] {
  const out: ComparedCheck[] = [];
  const first = reports[0];
  if (first === undefined) return out;
  for (const scenario of first.scenarios) {
    const others = reports.map((r) => r.scenarios.find((s) => s.id === scenario.id));
    if (others.some((s) => s === undefined)) continue;
    for (const c of scenario.checks) {
      const same = others.map((s) => s?.checks.find((x) => x.id === c.id));
      if (same.some((x) => x === undefined)) continue;
      const values = same.map((x) => x?.value ?? null);
      const verdicts = same.map((x) => x?.verdict ?? 'error');
      const finite = values.filter((v): v is number => v !== null && Number.isFinite(v));
      out.push({
        scenario: scenario.id,
        check: c.id,
        decides: c.decides,
        values,
        verdicts,
        range: finite.length > 0 ? Math.max(...finite) - Math.min(...finite) : 0,
        disagree: new Set(verdicts).size > 1,
      });
    }
  }
  return out;
}

/** The comparison of several runs as Markdown; `labels` name the runs. */
export function comparisonMarkdown(
  title: string,
  labels: readonly string[],
  reports: readonly SuiteReport[],
): string {
  const rows = compareReports(reports);
  const hashes = new Map<string, string[]>();
  reports.forEach((report) => {
    for (const s of report.scenarios) {
      for (const c of s.cases) {
        const key = `${s.id} ${c.label}`;
        const list = hashes.get(key) ?? [];
        list.push(c.resultHash);
        hashes.set(key, list);
      }
    }
  });
  const sameHash = [...hashes.values()].filter(
    (list) => list.length === reports.length && new Set(list).size === 1,
  ).length;
  const lines = [
    `# ${title}`,
    '',
    `Runs: ${labels.join(', ')}. ${rows.length} checks compared; ${rows.filter((r) => r.disagree).length} with differing verdicts ` +
      `(${rows.filter((r) => r.disagree && r.decides).length} of them deciding). ` +
      `${sameHash} of ${hashes.size} washes have the same result hash in every run.`,
    '',
    `| Phenomenon | Check | ${labels.join(' | ')} | Range | Verdicts |`,
    `|---|---|${labels.map(() => '---').join('|')}|---|---|`,
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.scenario} | ${r.check}${r.decides ? '' : ' (supporting)'} | ${r.values.map((v) => fmt(v)).join(' | ')} | ${fmt(r.range)} | ` +
        `${r.disagree ? `**${r.verdicts.join(' / ')}**` : (r.verdicts[0] ?? '')} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}
