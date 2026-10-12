/**
 * @spotless/sim-core. Module M12 of the wash simulation (docs/design/sim-core.md section 4):
 * the orchestrator. Stage graph, tiers, reserves, exposure cache, checkpoints and the wash
 * result. Depends on every module below it (M1 to M11) and on the platform packages they use.
 *
 * The first build (docs/design/scope.md), which is what runs:
 *
 *  - `wash.ts`: `wash(input, options)`, one wash from a loaded machine to a result per item
 *    (scene, hydraulics, exposure with its cache, soil, replay, inspection), with progress and
 *    timings per stage;
 *  - `input.ts`: `WashInput`, and `WashDescription` with `washInputFromDescription` for the
 *    JSON form of a wash;
 *  - `result.ts`: `WashResult`, `ItemWashResult`, `MachineWashResult`; `result-json.ts` writes
 *    it as plain JSON;
 *  - `exposure-cache.ts`: `ExposureCache`, the cache key (`exposureKey`, `sceneGeometryKey`)
 *    and the in-memory cache; the cache on disk and `runWashFile` are in
 *    `@spotless/sim-core/node`, the command in `scripts/spotless-wash.ts`;
 *  - `registry.ts`: `washRegistry`, every package's parameters composed, and
 *    `createWashParams`.
 *
 * Kept from the typed contract skeleton (the full design of sections M12 and 5.6, not
 * implemented), under names that leave `WashInput` and `WashResult` to the code that runs:
 *
 *  - `contract-types.ts`: `ContractWashInput`, `ContractWashEnv`, `ContractWash` (the type of
 *    the contract's entry point), `ContractExposureCache`, `ContractProgress`,
 *    `ContractExposureKeyInput`, the reserve policies and the failure classes;
 *  - `contract-result.ts`: the result contract of section 5.6 (`ContractWashResult`,
 *    `ContractProvenance`, `ContractItemWashResult`, `ContractMachineWashResult`,
 *    `ContractDiagnostics`).
 *
 * The entry point also re-exports the entry points of every simulation module, so the whole
 * simulation can be imported from here.
 */

export * from '@spotless/sim-film';
export * from '@spotless/sim-gpu';
export * from '@spotless/sim-hydraulics';
export * from '@spotless/sim-jets';
export * from '@spotless/sim-liquor';
export * from '@spotless/sim-params';
export * from '@spotless/sim-rigid';
export * from '@spotless/sim-scene';
export * from '@spotless/sim-soil';
export * from '@spotless/sim-spray';
export * from '@spotless/sim-timeline';

export * from './contract-types.ts';
export * from './contract-result.ts';
export * from './registry.ts';
export * from './input.ts';
export * from './result.ts';
export * from './result-json.ts';
export * from './exposure-cache.ts';
export * from './exposure-summary.ts';
export * from './param-layers.ts';
export * from './scene-setup.ts';
export * from './wash.ts';
