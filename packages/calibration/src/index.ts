/**
 * @spotless/calibration. What turns real washes into better parameters of the wash simulation,
 * and what says which washes are worth running (docs/design/scope.md, "Calibration is a
 * first-class feature"; docs/calibration/wash-record.md and docs/calibration/fitting.md).
 *
 *  - `record.ts`: the wash record, one versioned JSON document per real wash, and its
 *    validation (`validateWashRecord`, `parseWashRecord`);
 *  - `setup.ts`: the machine of a record with its measured values (`machineOfRecord`) and the
 *    programme adapted to the measured course of the run (`programmeOfRecord`);
 *  - `load.ts`: the load of a record as wash items, and both ways to the game's load manifest
 *    (`recordFromManifest`, `washManifestFromRecord`);
 *  - `cal-params.ts`: the calibration's own registered parameters (`obs.*`, `cal.*`, `prog.*`)
 *    and the registry a calibration resolves against (`calibrationRegistry`);
 *  - `observation.ts`: the observation models and their noise models;
 *  - `evaluator.ts`: predictions of a record for many parameter sets by replay on cached
 *    exposure (`prepareRecord`, `EvaluatorPool`);
 *  - `objective.ts`: the log posterior, with transforms and priors from the registry;
 *  - `optimise.ts`: Nelder-Mead with restarts;
 *  - `fit.ts`: the fit, its uncertainty, profiles, predictive checks and report (`fitRecords`);
 *  - `sensitivity.ts`: sensitivity, Fisher information, identifiability, experiment ranking;
 *  - `outer.ts`: the outer loop over parameters that change the water, and the check that a
 *    scale can be applied at replay time;
 *  - `synthetic.ts`: test-tile records and synthetic records;
 *  - `mathx.ts`, `util.ts`: numerics and tables.
 *
 * Nothing here needs Node; reading and writing files and the exposure cache on disk are in
 * `@spotless/calibration/node`, the command in `scripts/spotless-fit.ts`.
 */

export * from './record.ts';
export * from './setup.ts';
export * from './load.ts';
export * from './cal-params.ts';
export * from './observation.ts';
export * from './evaluator.ts';
export * from './objective.ts';
export * from './optimise.ts';
export * from './fit.ts';
export * from './sensitivity.ts';
export * from './outer.ts';
export * from './synthetic.ts';
export * from './mathx.ts';
export { fmt, stringKey, textTable } from './util.ts';
