/**
 * @spotless/machine. The machine specification, its lumped physics and its geometry
 * (docs/design/platform.md section 4.4; docs/research/machine.md section 12;
 * docs/research/machine-bosch-smv4hax40g.md; docs/research/machine-bosch-owner-update.md, which
 * outranks the dossier where they differ; docs/reference/owner-measurements.md, which outranks
 * both).
 *
 * Data
 *  - `MachineSpec` and its parts (`types.ts`): a complete, serialisable description of a
 *    dishwasher in SI units and platform frames, every group of values with its provenance;
 *    `MachineConfig`: what the player can adjust.
 *  - `MachineDef` (`def.ts`): the same description in authoring units (millimetres, degrees,
 *    litres, minutes); `loadMachineSpec` converts it, in one place.
 *  - `ProgrammeSpec`, the step types and the timeline types (`programme-types.ts`).
 *  - `BOSCH_SMV4HAX40G` (the owner's machine with his own measurements, primary) with its nine
 *    programmes, its named alternative `BOSCH_SMV4HAX40G_DRILL_BORE`, and `SPOT_60` (the generic
 *    baseline). SPOT-60 CARRIES ONE PROGRAMME, AUTO 45-65: the five others that machine.md
 *    section 7.3 tabulates (ECO 50, INTENSIVE 70, QUICK 60, GLASS 40, PRE-RINSE) are not
 *    transcribed. They need what the step types do not have (a pump speed per diverter
 *    position, a heater duty and a ramp limit per step), and SPOT-60 is only the fallback
 *    behind the owner's machine.
 *
 * The machine is the single source of what every programme shares: dosing delays and amounts,
 * inlet, tank and drain flows, the default diverter pattern and its transition time, the
 * heater's cut-out, the default drying time and the level check with its top-up. Change one of
 * them in a `MachineSpec` and every expanded programme follows; `validateMachineSpec` reports
 * what a change breaks.
 *
 * Lumped physics, all pure functions
 *  - `hydraulicOperatingPoint`: pump against the open branches by bisection;
 *  - `armSteadyState`, `armAngularAcceleration`, `advanceArmSpeed`, `armStalls`: spray-arm
 *    rotation from the torque balance;
 *  - `nozzleState`: position, direction and absolute exit velocity of a nozzle;
 *  - `stepThermal` and the thermal model; `waterInventory` and `primedOperatingPoint`;
 *  - `expandProgramme`: a programme as a timeline of segments and events, with the water the
 *    load holds back (`ExpandOptions.heldWater`) deciding whether the pump keeps its prime.
 *
 * Geometry (`geometry/`)
 *  - `buildMachineGeometry`: the machine in a configuration as named shapes with frames,
 *    poses and motions, and the affordances of the loading layer;
 *  - `standingPlates`, `maxStandingPlate`, `baseGridOpenings`: what fits where;
 *  - `machineDrawings`, `renderSvg`, `machineObj`: drawings and exports for inspection.
 *
 * Checking
 *  - `validateMachineSpec`, `validateMachineConfig`.
 */

export * from './provenance.ts';
export * from './problems.ts';
export * from './types.ts';
export * from './programme-types.ts';
export * from './def.ts';
export * from './load.ts';
export * from './water.ts';
export * from './config.ts';
export * from './cutlery-placement.ts';
export * from './hydraulics.ts';
export * from './arm.ts';
export * from './kinematics.ts';
export * from './thermal.ts';
export * from './inventory.ts';
export * from './programme.ts';
export * from './programme-tools.ts';
export * from './dispenser.ts';
export * from './outline.ts';
export * from './validate.ts';
export * from './machines.ts';
export * from './geometry/index.ts';
export {
  BOSCH_LOWER_ARM_BORE_DRILL_TEST_MM,
  BOSCH_LOWER_ARM_BORE_TAPE_MM,
  BOSCH_LOWER_BASKET_TRAVEL_PHOTO_MM,
  BOSCH_LOWER_BRANCH_CDA_DRILL_TEST_MM2,
  BOSCH_SMV4HAX40G_DEF,
  BOSCH_SMV4HAX40G_DRILL_BORE_DEF,
  boschWithLowerArmBore,
} from './data/bosch-smv4hax40g.ts';
export {
  BOSCH_AUTO_145_OPTIONS,
  BOSCH_PATTERN_45,
  BOSCH_PATTERN_60,
  BOSCH_PATTERN_BOTH,
  BOSCH_PROGRAMMES,
  boschProgramme,
  type BoschProgrammeOptions,
} from './data/bosch-programmes.ts';
export { SPOT60_DEF } from './data/spot60.ts';
export { SPOT60_AUTO_135, SPOT60_PATTERN_60, SPOT60_PROGRAMMES } from './data/spot60-programmes.ts';
