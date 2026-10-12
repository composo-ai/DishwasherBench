/**
 * @spotless/sim-soil. Module M8 of the wash simulation (docs/design/sim-core.md section 4):
 * soil state, ageing transform and the soil kernel. Depends on M3 (`sim-scene`) and M2
 * (`sim-params`).
 *
 * The first build (docs/design/scope.md), which is what runs:
 *
 *  - `params.ts`: the model soil classes (`SOIL_MODEL_CLASSES`: six laws' worth and the
 *    classes split from them by appearance and by melting), the law of each, the mapping from
 *    the catalogue's mechanism classes, `SOIL_PARAM_DEFS` and the visibility thresholds the
 *    inspector reads (`soilVisibility`);
 *  - `soil-data.ts`: what the soil side knows about every catalogue soil by its id (model
 *    class, appearance, how it is laid on, solids fraction, working loading, ageing);
 *  - `spread.ts`: the spread of the loading inside one deposit, which decides how a deposit
 *    ends (thin places bare first) and what share of it is still visibly soiled;
 *  - `kinetics.ts`: the rate laws as pure functions of the liquor (`SoilChemistry`) and class;
 *  - `soil.ts`: `SoilState` (one row per deposit: dry mass per area and hydration),
 *    `initSoil` (from the soil records of the items, with the seeded fields), `SoilForcing`
 *    (what the replay tells the soil about a tick) and `createWashSoil` (the per-tick update).
 *
 * Kept from the typed contract skeleton (the full design of section M8, not implemented):
 *
 *  - `types.ts`: `SoilStage`, the soil classes, the five wetness states, `ErosionLaw`,
 *    `KineticSet`;
 *  - `layouts.ts`: `SoilCell` and `BlockRelease`, as data;
 *  - `timeline-interface.ts`: the layouts of the timeline buffers that the soil kernel binds
 *    (`EffectiveExposure`, `TimelineBlock`, `ReservoirLiquor`). They belong to M10 and are
 *    re-exported by `@spotless/sim-timeline`.
 *
 * `SoilRelease`, the release classes and `RateTables` are declared in M2, `WettingSummary` and
 * `JetRecordSet` in M3; they are re-exported here with the rest of those entry points.
 */

export * from '@spotless/sim-params';
export * from '@spotless/sim-scene';

export * from './types.ts';
export * from './layouts.ts';
export * from './timeline-interface.ts';
export * from './spread.ts';
export * from './params.ts';
export * from './soil-data.ts';
export * from './kinetics.ts';
export * from './soil.ts';
