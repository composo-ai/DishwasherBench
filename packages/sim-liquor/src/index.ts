/**
 * @spotless/sim-liquor. Module M9 of the wash simulation (docs/design/sim-core.md section 4):
 * liquor chemistry, rate tables, machine thermal nodes and drying air. Depends on M2
 * (`sim-params`).
 *
 * The first build (docs/design/scope.md), which is what runs:
 *
 *  - `liquor.ts`: `createWashLiquor`, the lumped liquor chemistry (detergent release with the
 *    blocked-dispenser case, dilution at water changes, pH, peracid, enzyme activity, soil in
 *    the liquor); `LiquorSample`, the liquor at one instant and the row of the per-tick liquor
 *    table (`LIQUOR_FIELDS`); `LiquorEvent`;
 *  - `params.ts`: `LIQUOR_PARAM_DEFS`, the registered parameters.
 *
 * Kept from the typed contract skeleton (the full design of section M9, not implemented;
 * `types.ts`): `LiquorModel`, `LiquorState`, `TabletSupply`, `DepositSinks`, and
 * `DetergentSpec`, `RinseAidSpec` and `SupplySpec`, which the contract names and never defines.
 *
 * `RateTables` is declared in M2, with `MachineTick` and `SoilRelease`, and re-exported here
 * with the rest of its entry point.
 */

export * from '@spotless/sim-params';

export * from './types.ts';
export * from './params.ts';
export * from './liquor.ts';
