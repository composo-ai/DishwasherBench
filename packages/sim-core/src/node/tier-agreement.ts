/**
 * How far the fast tier can be trusted, as measured: the share of verdicts on which a fast
 * wash agrees with the official wash of the same load and seeds, per class of item
 * (docs/design/scope.md, "Tiers": one official tier and one fast tier). The scored game runs
 * the official tier; local play and the scripted studies run the fast one, and every report
 * of a fast wash says what that costs.
 *
 * The measurement belongs to a parameter set and a programme: it is written beside the set as
 * `tiers.<set>.json` ({@link tierAgreementFileOf}) by the calibration side (`anchors/scripts/tier-agreement.ts`, from the
 * lines of the variance study) and read here by whoever writes a report.
 *
 * Units: counts of verdicts on soiled items.
 */

import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

/** Verdicts of the fast tier that agree with the official tier, of those compared. */
export interface TierAgreementCount {
  readonly agree: number;
  readonly of: number;
}

/** The agreement of the fast tier with the official tier on one programme. */
export interface TierAgreementOfProgramme {
  /** What was washed: the load, the pairs of washes, the seeds. */
  readonly basis: string;
  /** Pairs of washes (one fast, one official, same seeds). */
  readonly washes: number;
  /** All soiled items. */
  readonly all: TierAgreementCount;
  /** By class of item (crockery, cutlery, glass, melamine, pots), where the load holds soiled ones. */
  readonly byClass: Readonly<Record<string, TierAgreementCount>>;
}

/** The file `tiers.<set>.json`. */
export interface TierAgreementFile {
  readonly format: 'spotless.tier-agreement';
  /** Name of the parameter set the washes ran with, and the simulator. */
  readonly paramSet: string;
  readonly simVersion: string;
  readonly createdAt: string;
  /** By programme id. */
  readonly programmes: Readonly<Record<string, TierAgreementOfProgramme>>;
}

/**
 * Where the tier agreement of a parameter-set file is kept: beside it, as `tiers.<its name>`
 * (a name no tool takes for a parameter set of the same family).
 */
export function tierAgreementFileOf(paramSetFile: string): string {
  return join(dirname(paramSetFile), `tiers.${basename(paramSetFile)}`);
}

/** Reads a tier-agreement file; null when it is not there or is not one. */
export function readTierAgreement(file: string): TierAgreementFile | null {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(file, 'utf8')) as unknown;
  } catch {
    return null;
  }
  if (typeof json !== 'object' || json === null) return null;
  const candidate = json as Partial<TierAgreementFile>;
  if (candidate.format !== 'spotless.tier-agreement') return null;
  if (typeof candidate.programmes !== 'object' || candidate.programmes === null) return null;
  return candidate as TierAgreementFile;
}

const perHundred = (count: TierAgreementCount): number =>
  count.of > 0 ? Math.round((100 * (count.of - count.agree)) / count.of) : 0;

/**
 * What a report of a fast wash says about the tier: the verdicts in a hundred on which the
 * fast tier differs from the official one, per class of item, on the programme of the wash
 * (or, where that was not measured, on the programme that was, said as such). Without a
 * measurement it says that there is none.
 */
export function fastTierNote(agreement: TierAgreementFile | null, programmeId: string): string {
  const lead =
    'This is a fast wash, a preview of the official one (coarser surfaces, fewer droplets).';
  if (agreement === null) {
    return `${lead} How often its verdicts differ from the official wash has not been measured for these parameters.`;
  }
  const own = agreement.programmes[programmeId];
  const [otherId, other] = Object.entries(agreement.programmes)[0] ?? [];
  const measured = own ?? other;
  if (measured === undefined) {
    return `${lead} How often its verdicts differ from the official wash has not been measured for these parameters.`;
  }
  const classes = Object.entries(measured.byClass)
    .filter(([, count]) => count.of > 0)
    .map(([cls, count]) => `${perHundred(count)} in 100 for ${cls}`)
    .join(', ');
  const where =
    own !== undefined
      ? 'on this programme'
      : `on ${otherId} (this programme was not measured: take it as no better)`;
  return `${lead} Measured ${where} with ${agreement.paramSet} (${measured.basis}), its verdict on a soiled item differs from the official wash in ${perHundred(measured.all)} of 100 cases: ${classes}. Scores are counted on the official wash.`;
}
