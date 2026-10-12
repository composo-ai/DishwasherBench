/**
 * @spotless/sim-timeline. Module M10 of the wash simulation (docs/design/sim-core.md
 * section 4): the replay loop, the slow-state layer, element temperatures, pools and local
 * stores, deposits and drying. Depends on M4 (`sim-hydraulics`), M7 (`sim-film`), M8
 * (`sim-soil`) and M9 (`sim-liquor`).
 *
 * The first build (docs/design/scope.md), which is what runs:
 *
 *  - `replay.ts`: `replayWash`, the whole programme in ticks of one master-arm revolution
 *    against cached exposure, with the liquor, the pools and the soil stepped every tick;
 *    `ReplayInput`, `ReplayResult`;
 *  - `params.ts`: `TIMELINE_PARAM_DEFS`, the registered parameters.
 *
 * Kept from the typed contract skeleton (the full design of section M10, not implemented):
 *
 *  - `types.ts`: `TimelineStage`, `TimelineContext`, `TimelineResult`, `PoolState`, `GapState`,
 *    `TimelineFlags`, `ContractExposureSet` (section 5.1), and the tick constants;
 *  - `rigid-boundary.ts`: `RigidCouplerPort`, the part of M11's `RigidCoupler` the timeline
 *    calls (M10 may not depend on M11).
 *
 * `TimelineBlock`, `EffectiveExposure` and `ReservoirLiquor` are declared in M8 and re-exported
 * here with the rest of the entry points of M4, M7, M8 and M9.
 */

export * from '@spotless/sim-film';
export * from '@spotless/sim-hydraulics';
export * from '@spotless/sim-liquor';
export * from '@spotless/sim-soil';

export * from './types.ts';
export type { RigidCouplerPort, RigidEpisodeResult } from './rigid-boundary.ts';
export * from './params.ts';
export * from './replay.ts';
