/**
 * BOUNDARY TO `@spotless/machine`.
 *
 * Module M4 consumes the machine description, the programme tables and the lumped hydraulic
 * functions of `@spotless/machine` (docs/design/sim-core.md section M4; docs/design/platform.md
 * section 4.4). Nothing of them is declared here: this file only names the three types that M4
 * and the modules above it take from that package, so that there is one place to look, and the
 * entry point of this package re-exports them for the modules that reach `@spotless/machine`
 * only through M4 (M10 takes `ProgrammeSpec`; M12 takes all three in `WashInput`).
 *
 * - `MachineSpec`: the machine as data (dimensions, nozzle tables, pump curve, branch losses,
 *   diverter, thermal data, dosing, programmes).
 * - `MachineConfig`: what the player can adjust on the machine before loading it.
 * - `ProgrammeSpec`: a wash programme as a table of steps; what `MachineModel.controller` and
 *   `MachineModel.thermalPrePass` run.
 */

export type { MachineConfig, MachineSpec, ProgrammeSpec } from '@spotless/machine';

/**
 * The machines and programmes themselves, for the modules above that reach
 * `@spotless/machine` only through this one (the replay's tests run the owner's programme):
 * the primary machine, its primary programme, and the look-ups by id.
 */
export { findMachine, findProgramme, PRIMARY_MACHINE, primaryProgramme } from '@spotless/machine';
