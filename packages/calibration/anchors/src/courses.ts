/**
 * Candidate courses of the owner's Auto 45-65 programme, built in memory from the options of
 * `@spotless/machine` (docs/research/auto-programme-evidence.md section 3.2 and
 * auto-recommendation.md section 2): the course as written (one ramp to 65 C, heater off
 * after it), a staged heat-up with a plateau, and other wash targets. The wash target of the
 * normal branch is undetermined between 50 and 65 C and a pause near 45 C is supported by
 * three weak hints, so the anchoring reports the owner's programme under more than one course.
 *
 * A course is only a programme definition: the exposure of a load does not depend on it
 * (pump speeds and diverter patterns are those of Auto as written).
 */

import {
  BOSCH_AUTO_145_OPTIONS,
  boschProgramme,
  type BoschProgrammeOptions,
  type ProgrammeDef,
} from '@spotless/machine';

/** A staged heat-up: heat to `plateau`, pause `pauseMin` with the heater off, heat to the target. */
export function stagedCourse(
  options: BoschProgrammeOptions,
  plateau: number,
  pauseMin: number,
): ProgrammeDef {
  const def = boschProgramme(options);
  const steps = [...def.steps];
  const at = steps.findIndex((step) => step.kind === 'heat' && step.phase === 'main_wash');
  const heat = steps[at];
  if (heat === undefined || heat.kind !== 'heat') {
    throw new RangeError('stagedCourse: the programme has no main-wash heat-up');
  }
  const first = {
    ...heat,
    id: `${heat.id}_a`,
    target: plateau,
    label: `heat-up to the ${plateau} C plateau`,
  };
  const pause: ProgrammeDef['steps'][number] = {
    id: `${heat.id}_pause`,
    row: heat.row,
    phase: heat.phase,
    label: 'plateau: heater off, pump on (turbidity read)',
    kind: 'hold',
    durationMin: pauseMin,
    target: plateau,
    pumpRpm: heat.pumpRpm,
    ...(heat.diverter === undefined ? {} : { diverter: heat.diverter }),
  };
  const second = {
    ...heat,
    id: `${heat.id}_b`,
    label: 'heat-up from the plateau to the target',
  };
  steps.splice(at, 1, first, pause, second);
  return { ...def, steps };
}

const A = BOSCH_AUTO_145_OPTIONS;

/** The appliance dossier's step lengths for a staged course that keeps 145 minutes. */
const STAGED_LENGTHS = { rinseMin: 10, finalHoldMin: 1, dryMin: 35.5 } as const;

/** Named courses of Auto 45-65; `null` is the programme as the machine package writes it. */
export const AUTO_COURSES: Readonly<Record<string, () => ProgrammeDef | null>> = {
  /** One ramp to 65 C, 46 min with the heater off: the machine package's `auto_145`. */
  as_written: () => null,
  /** One ramp to 55 C, the post-wash lengthened by the minutes the shorter ramp saves. */
  single_55: () => boschProgramme({ ...A, id: 'auto_single_55', washTarget: 55, holdMin: 50 }),
  /** Heat to 45 C, 10 min with the heater off, heat to 55 C, 42 min post-wash. */
  staged_55: () =>
    stagedCourse(
      { ...A, id: 'auto_staged_55', washTarget: 55, holdMin: 42, ...STAGED_LENGTHS },
      45,
      10,
    ),
  /** The same staging to 65 C. */
  staged_65: () =>
    stagedCourse(
      { ...A, id: 'auto_staged_65', washTarget: 65, holdMin: 38, ...STAGED_LENGTHS },
      45,
      10,
    ),
};
