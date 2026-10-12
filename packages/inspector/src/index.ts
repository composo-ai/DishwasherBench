/**
 * @spotless/inspector. End-of-cycle evaluation: per item and per region the residue, the area
 * still visibly soiled, the count of separate specks, the water it holds, the IEC cleaning
 * score and the verdict clean or not (docs/research/standards.md sections 6.1 and 10).
 *
 *  - `types.ts`: `InspectionItem` (what the inspector is shown: soil elements with areas,
 *    residue by soil class and surface neighbours, independent of how the simulation grids a
 *    surface) and `ItemInspection` (what it reports);
 *  - `inspect.ts`: `inspectItem`, `scoreBySpecks`, `scoreByArea`;
 *  - `params.ts`: `INSPECTOR_PARAM_DEFS`, the registered rule (at most 4 specks and 4 mm2, at
 *    most 1 mL of water) and score bands, and `inspectionRules`.
 */

export * from './types.ts';
export * from './params.ts';
export * from './inspect.ts';
