/**
 * @spotless/sim-params. Module M2 of the wash simulation (docs/design/sim-core.md section 4):
 * the parameter registry, the tiers, the closure tables and the shared closure functions.
 * Depends on `@spotless/core` only.
 *
 *  - `types.ts`: `ParamDef`, `VectorParamDef`, `EnumParamDef` (together `AnyParamDef`),
 *    `ClosureTable`, `TierParams`;
 *  - `registry.ts`: `createRegistry`, the composition of every package's definitions;
 *  - `param-set.ts`: `ParamSet` (defaults, JSON overrides, validation, hydro and soil hashes,
 *    JSON with provenance) and the per-class soil lookup;
 *  - `uniform-block.ts`: uniform blocks and per-class tables for kernels;
 *  - `closure-table.ts`: clamped multilinear tables, f64 and generated WGSL;
 *  - `expr.ts`: expression trees with an f64 evaluator and a WGSL emitter;
 *  - `closures.ts`: water properties and the wetting thresholds, and `SHARED_PARAM_DEFS`;
 *  - `literal-lint.ts`: the literal lint of section 0 (file reading is in `./node`);
 *  - `fit.ts`: calibration groups as normalised fit axes;
 *  - `tiers.ts`: the official and fast tiers;
 *  - `shared.ts`: records that cross between modules the dependency table keeps apart
 *    (`ArmState`, `ComboId`, `PhaseEvent`, `MachineTick` of M4; `SoilRelease` and the release
 *    classes of M8; `RateTables` of M9; `LiquorClassId`). The modules the contract assigns them
 *    to re-export them, so import them from there.
 *
 * Nothing here needs Node; the file-reading lint helper is `@spotless/sim-params/node`.
 */

export * from './types.ts';
export * from './shared.ts';
export * from './registry.ts';
export * from './param-set.ts';
export * from './uniform-block.ts';
export * from './closure-table.ts';
export * from './expr.ts';
export * from './closures.ts';
export * from './literal-lint.ts';
export * from './fit.ts';
export * from './tiers.ts';
