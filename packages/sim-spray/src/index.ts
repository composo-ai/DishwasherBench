/**
 * @spotless/sim-spray. Module M6 of the wash simulation (docs/design/sim-core.md section 4):
 * droplet parcels, as Monte Carlo deposition tables and as time-coupled parcels. Depends on M3
 * (`sim-scene`) and M5 (`sim-jets`).
 *
 * The first build (docs/design/scope.md), which is what runs:
 *
 *  - `secondary-water.ts`: the stage interface. `SecondaryWaterStage` returns a `WaterArrival`
 *    (per block: water landing out of the air other than from a coherent jet), the deposits in
 *    integer units and the landing table of the drip sites;
 *  - `spray-stage.ts`: `secondaryWaterStage`, the real stage: Monte Carlo parcels from the
 *    splatter and the fans of the jets and from fixed sprayers, and `dripTransfer`, the
 *    landing table of the drops that leave the drip sites;
 *  - `flight.ts`: droplet drag, the flight step and the wall interaction;
 *  - `stand-in.ts`: `secondaryWaterStandIn`, the labelled STAND-IN the real stage replaced
 *    (showers of fixed sprayers only), kept for comparison;
 *  - `params.ts`: `SPRAY_PARAM_DEFS`, the registered parameters.
 *
 * Kept from the typed contract skeleton (the full design of section M6, not implemented):
 *
 *  - `types.ts`: `SprayStage`, `WallStateTable`, `ParcelPlan`, `DepositionTable`, `FilmBuffers`;
 *  - `layouts.ts`: `Parcel`, the Monte Carlo accumulator, the packed deposition table and the
 *    impact-duty counters, as data;
 *  - `film-interface.ts`: the layouts of the film-stage buffers that the spray kernels bind
 *    (deposit accumulators, `SFilm`, `KHot` with the regime codes, the pilot's wet bitset).
 *    They belong to M7 and are re-exported by `@spotless/sim-film`.
 *
 * The entry point also re-exports the entry points of M3 and M5.
 */

export * from '@spotless/sim-jets';
export * from '@spotless/sim-scene';

export * from './types.ts';
export * from './layouts.ts';
export * from './film-interface.ts';
export * from './params.ts';
export * from './secondary-water.ts';
export * from './stand-in.ts';
export * from './flight.ts';
export * from './landing-kernel.ts';
export * from './spray-stage.ts';
