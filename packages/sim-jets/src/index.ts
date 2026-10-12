/**
 * @spotless/sim-jets. Module M5 of the wash simulation (docs/design/sim-core.md section 4):
 * primary jet trace, footprints, impingement closures, exposure gather, emitters, item loads
 * and live wrenches. Depends on M2 (`sim-params`), M3 (`sim-scene`) and M4 (`sim-hydraulics`).
 *
 * The first build (docs/design/scope.md), which is what runs:
 *
 *  - `jet-exposure.ts`: the stage interface. `JetExposureTable` (per soil cell: duty, and peak
 *    and mean of wall shear, pressure and film momentum flux), `WaterArrival` (per block: water
 *    landing out of the air), `ExposureStageInput`, `JetExposureStage`;
 *  - `jet-stage.ts`: `jetStage`, the real jet stage: the trace of every jet at every arm
 *    angle, footprints, the gather onto soil cells, the hand-over to the film, droplet sources
 *    and the loads on items;
 *  - `jet-closures.ts`: the closed forms of the jets dossier as two-back-end closure functions
 *    (break-up, splatter, oblique flow split, pressure, shear and the zones of the radial
 *    film); `expr-fast.ts` compiles them for the CPU;
 *  - `trace-backend.ts`: where the exposure stages trace their rays (GPU kernel or f64
 *    reference tracer);
 *  - `closures.ts` and `stand-in.ts`: the normal-incidence closed forms and `jetStageStandIn`,
 *    the labelled STAND-IN the real stage replaced, kept for comparison;
 *  - `params.ts`: `JETS_PARAM_DEFS`, the registered parameters.
 *
 * Kept from the typed contract skeleton (the full design of section M5, not implemented; the
 * rigid-body skeleton and the contract checks of `@spotless/sim-verify` refer to it):
 *
 *  - `types.ts`: `JetStage`, `FootprintTable`, `ItemLoads`, `Wrench`, `EmitterTable`,
 *    `SourceTable`;
 *  - `layouts.ts`: `FootprintRecord`, `SectorRecord`, the emitter entry, the jet-wet table,
 *    `SourceRecord`, the emitter means and the pilot's residual-film estimate, as data.
 *
 * `JetRecordSet` and the `JetExposure` layout are declared in M3 and re-exported here with the
 * rest of its entry point, as are the entry points of M2 and M4.
 */

export * from '@spotless/sim-hydraulics';
export * from '@spotless/sim-params';
export * from '@spotless/sim-scene';

export * from './types.ts';
export * from './layouts.ts';
export * from './params.ts';
export * from './jet-exposure.ts';
export * from './closures.ts';
export * from './stand-in.ts';
export * from './expr-fast.ts';
export * from './jet-closures.ts';
export * from './sparse-sum.ts';
export * from './trace-backend.ts';
export * from './jet-stage.ts';
