/**
 * @spotless/sim-film. Module M7 of the wash simulation (docs/design/sim-core.md section 4):
 * surface water (R0, K, S, LINE), reservoirs, wetting parameters and the exposure writer.
 * Depends on M3 (`sim-scene`), M5 (`sim-jets`) and M6 (`sim-spray`).
 *
 * The first build (docs/design/scope.md), which is what runs:
 *
 *  - `surface-water.ts`: the stage interface. `SurfaceWaterTable` (per block: wet fraction,
 *    flux, film thickness and shear, renewal, pool depth, what stays after the spray) and the
 *    inflow of every basin; `SurfaceWaterStage`;
 *  - `cascade.ts`: the kinematic cascade on the cell graph (`buildCascadeStatic`,
 *    `marchCascade`): implicit-outflow reservoirs in integer mass units, the regime machine,
 *    wires, drip sites, puddles, basins, contacts, the pilot, the recorded revolutions and the
 *    drain-down;
 *  - `surface-stage.ts`: `surfaceWaterStage`, the real stage: the cascade under the forcing of
 *    one spray state, written out as the surface-water table;
 *  - `stand-in.ts`: `surfaceWaterStandIn`, the labelled STAND-IN the real stage replaced
 *    (marks wet whatever lies downhill of where water lands), kept for comparison;
 *  - `exposure-set.ts`: `ExposureSet`, the output of the whole exposure side for one spray
 *    state; `computeExposureSet` (jets, secondary water, surface water in order; the real
 *    stages by default), the water balance from nozzle to sump, the binary encoding for the
 *    cache and its hash;
 *  - `params.ts`: `FILM_PARAM_DEFS`, the registered parameters.
 *
 * Kept from the typed contract skeleton (the full design of section M7, not implemented):
 *
 *  - `types.ts`: `FilmStage`, `SolvePlan`, `WetParams`, `FilmState`, `PilotResult`,
 *    `PeriodicResult`, `DrainDownResult`, `StateSummary`, and the levels of the film statistics;
 *  - `layouts.ts`: `SSlow`, `SStatic`, `KParams`, `FilmStats`, the tile monitor, `FilmExposure`,
 *    `DrainDown` and the onset field, as data.
 *
 * `SFilm`, `KHot`, the deposit accumulators and the regime codes are declared in M6, `HRes` in
 * M5 and `WettingSummary` in M3 (each is read by a module that may not depend on this one);
 * they are re-exported here with the rest of those entry points.
 */

export * from '@spotless/sim-jets';
export * from '@spotless/sim-scene';
export * from '@spotless/sim-spray';

export * from './types.ts';
export * from './layouts.ts';
export * from './params.ts';
export * from './surface-water.ts';
export * from './stand-in.ts';
export * from './cascade.ts';
export * from './surface-stage.ts';
export * from './exposure-set.ts';
