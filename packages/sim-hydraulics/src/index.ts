/**
 * @spotless/sim-hydraulics. Module M4 of the wash simulation (docs/design/sim-core.md
 * section 4): operating points, spray arms, diverter, water inventory and the programme
 * controller. Depends on `@spotless/machine` and M2 (`sim-params`).
 *
 * The first build (docs/design/scope.md), which is what runs:
 *
 *  - `spray-states.ts`: `buildWashHydraulics`, a thin layer over `@spotless/machine` that
 *    returns the spray states of a programme (`SprayState` with its `SprayJet`s, `SprayArm`s
 *    and `SprayShower`s) and its schedule (`WashSchedule`: which state when, and the machine's
 *    own timeline); `jetLaunch` turns a jet to an arm angle, `washInstantAt` reads the schedule;
 *  - `params.ts`: `HYDRAULICS_PARAM_DEFS`, the registered parameters.
 *
 * Kept from the typed contract skeleton (the full design of section M4, not implemented; the
 * rigid-body skeleton and the contract checks of `@spotless/sim-verify` refer to it):
 *
 *  - `types.ts`: `MachineModel`, `HydraulicPoint`, `NozzleJet`, `ArmMotion`, `LiquorProps`,
 *    `ProgrammeController`, `ControllerFeedback`, and the constants of the time base;
 *  - `machine-boundary.ts`: what M4 takes from `@spotless/machine` (`MachineSpec`,
 *    `MachineConfig`, `ProgrammeSpec`).
 *
 * `ArmState`, `ComboId`, `PhaseEvent` and `MachineTick` are declared in M2 and re-exported here
 * with the rest of its entry point.
 */

export * from '@spotless/sim-params';

export * from './types.ts';
export * from './params.ts';
export * from './spray-states.ts';
export type { MachineConfig, MachineSpec, ProgrammeSpec } from './machine-boundary.ts';
export {
  findMachine,
  findProgramme,
  PRIMARY_MACHINE,
  primaryProgramme,
} from './machine-boundary.ts';
