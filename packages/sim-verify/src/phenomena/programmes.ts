/**
 * The programme the scenarios wash with: Eco 50 of the owner's machine, and variants of it
 * where a checklist entry changes one thing about it (the temperature of the main wash, the
 * speed of the pump). A variant is the programme's own step list with that one change;
 * nothing else is touched, so the comparison isolates it.
 */

import {
  findProgramme,
  PRIMARY_MACHINE,
  type ProgrammeSpec,
  type ProgrammeStep,
} from '@spotless/machine';
import type { ProgrammeEdit } from './types.ts';

/**
 * The programme the game is scored on and the suite runs on: Eco 50 (decision of 10 October
 * 2026, docs/reference/owner-measurements.md: fixed and printed, no sensor decisions, the one
 * regime with a published anchor on a sister machine), the only programme simulated.
 */
export const SCORED_PROGRAMME = 'eco_50';

/**
 * The programme with the given id on the owner's machine, with an edit applied to the steps
 * of its main wash. The id of an edited programme says what was changed. Throws a RangeError
 * for an unknown programme.
 */
export function programmeOf(id: string, edit?: ProgrammeEdit): ProgrammeSpec {
  const base = findProgramme(PRIMARY_MACHINE, id);
  if (base === undefined) throw new RangeError(`the machine has no programme '${id}'`);
  if (edit === undefined || (edit.washTarget_C === undefined && edit.pumpScale === undefined)) {
    return base;
  }
  const steps: ProgrammeStep[] = base.steps.map((step) => {
    if (step.phase !== 'main_wash') return step;
    if (step.kind !== 'heat' && step.kind !== 'hold' && step.kind !== 'circulate') return step;
    let out: ProgrammeStep = step;
    if (edit.pumpScale !== undefined) {
      out = { ...out, pumpRpm: Math.round(step.pumpRpm * edit.pumpScale) } as ProgrammeStep;
    }
    if (edit.washTarget_C !== undefined && (out.kind === 'heat' || out.kind === 'hold')) {
      if (out.kind === 'heat' || out.target !== null) out = { ...out, target: edit.washTarget_C };
    }
    return out;
  });
  const suffix =
    (edit.washTarget_C === undefined ? '' : `+wash${edit.washTarget_C}C`) +
    (edit.pumpScale === undefined ? '' : `+pump${Math.round(edit.pumpScale * 100)}pct`);
  return { ...base, id: `${base.id}${suffix}`, steps };
}
