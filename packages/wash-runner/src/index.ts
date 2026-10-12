/**
 * @spotless/wash-runner. The real wash inside the game: the session's wash hook backed by the
 * wash simulation of `@spotless/sim-core`.
 *
 *  - `simWashRunner`: the `WashRunner` the server runs in its wash worker (`WASH_RUNNER` of
 *    `@spotless/server` names it); `runWash(manifest, options)` is the same with everything it
 *    produces returned (`runner.ts`).
 *  - `washInputOf(manifest, { tier })`: the load manifest as the simulation's input (machine,
 *    configuration, programme, every loaded item with catalogue shape, settled pose and soils,
 *    the seeds, a spray arm the load holds still, a dispenser it blocks); `manifestItemsOf`
 *    back; `poseDisagreement` checks the hand-over against the player-visible load
 *    (`input.ts`).
 *  - `washReportOf(manifest, result, options)`: the simulation's result as the wash report of
 *    the session contract, with the residue map of every washed item (`report.ts`).
 *  - `encodeResidueMap`, `decodeResidueMap`: the packing of residue maps (`residue-codec.ts`).
 *  - `ProgressTracker`, `estimateStageSeconds`: progress by stage with an estimate of the time
 *    remaining from the timings of earlier washes (`progress.ts`).
 *  - `contract.ts` (also `@spotless/wash-runner/contract`, which loads nothing of the
 *    simulation): what the server and the runner agree on beyond the session's hook.
 *
 * Scripts: `pnpm --filter @spotless/wash-runner measure` times the tutorial and full levels at
 * both tiers in a child process each; `wash-load <load>` washes a saved standard load; `repro
 * <load>` washes one several times in separate processes and says whether the result was the
 * same each time on unchanged source.
 */

export * from './contract.ts';
export * from './input.ts';
export * from './report.ts';
export * from './progress.ts';
export * from './runner.ts';
export type { CleanRule, WashDevice } from './sim.ts';
export { acquireWashDevice, cleanRule, SIM_STAGES, SIM_VERSION } from './sim.ts';
