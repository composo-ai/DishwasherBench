/**
 * The machines this package carries, loaded into SI specifications.
 *
 * - `BOSCH_SMV4HAX40G`: the owner's dishwasher, the primary machine of the simulation, from
 *   docs/research/machine-bosch-smv4hax40g.md with the owner's measurements of
 *   docs/research/machine-bosch-owner-update.md.
 * - `BOSCH_SMV4HAX40G_DRILL_BORE`: the same machine with the one figure of the owner's that is
 *   not reconciled, the 4.5 mm bore of the lower arm's round holes by his drill test (3.3 mm on
 *   his photograph is the default). A named alternative, not a second machine.
 */

import { BOSCH_SMV4HAX40G_DEF, BOSCH_SMV4HAX40G_DRILL_BORE_DEF } from './data/bosch-smv4hax40g.ts';
import { loadMachineSpec } from './load.ts';
import type { ProgrammeSpec } from './programme-types.ts';
import type { MachineSpec } from './types.ts';

/** The Bosch Serie 4 SMV4HAX40G/13: the primary machine. SI units, platform frames. */
export const BOSCH_SMV4HAX40G: MachineSpec = loadMachineSpec(BOSCH_SMV4HAX40G_DEF);

/**
 * The Bosch with the 4.5 mm lower-arm bores of the owner's drill test (owner update, case D).
 * SI units, platform frames. Differs from `BOSCH_SMV4HAX40G` only in the lower arm's round
 * nozzles and the lower branch's stated C_d A.
 */
export const BOSCH_SMV4HAX40G_DRILL_BORE: MachineSpec = loadMachineSpec(
  BOSCH_SMV4HAX40G_DRILL_BORE_DEF,
);

/** Every machine of this package, the primary one first. */
export const MACHINES: readonly MachineSpec[] = [BOSCH_SMV4HAX40G];

/** The machine the simulation is based on. */
export const PRIMARY_MACHINE: MachineSpec = BOSCH_SMV4HAX40G;

/**
 * Named alternatives of the machines above: the same machine with one unresolved value taken
 * the other way. They are not offered as machines to play, but can be named in a wash record
 * or a calibration run.
 */
export const MACHINE_VARIANTS: readonly MachineSpec[] = [BOSCH_SMV4HAX40G_DRILL_BORE];

/** The machine or named variant with the given catalogue id, or undefined. */
export function findMachine(machineId: string): MachineSpec | undefined {
  return (
    MACHINES.find((m) => m.id === machineId) ?? MACHINE_VARIANTS.find((m) => m.id === machineId)
  );
}

/** The programme of a machine with the given id, or undefined. */
export function findProgramme(spec: MachineSpec, programmeId: string): ProgrammeSpec | undefined {
  return spec.programmes.find((p) => p.id === programmeId);
}

/**
 * The programme a machine runs by default (`MachineSpec.primaryProgramme`). Throws a RangeError
 * if the specification names a programme it does not contain; `validateMachineSpec` reports
 * that as a problem.
 */
export function primaryProgramme(spec: MachineSpec): ProgrammeSpec {
  const programme = findProgramme(spec, spec.primaryProgramme);
  if (programme === undefined) {
    throw new RangeError(
      `primaryProgramme: machine ${spec.id} has no programme "${spec.primaryProgramme}"`,
    );
  }
  return programme;
}
