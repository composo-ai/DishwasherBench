/**
 * @spotless/sim-verify. Module M13 of the wash simulation (docs/design/sim-core.md section 4):
 * reference implementations, conservation audits, the phenomena harness and the checks that
 * hold the code to the design contract. Depends on every module; nothing depends on it.
 *
 * What exists so far:
 *
 *  - `wash-end-to-end.test.ts`: whole washes of the first build on the owner's machine with
 *    catalogue items placed by hand (a plate facing the jets and one turned away, an upright
 *    and an inverted mug, a plate above a pan, a repeat, a changed soil parameter);
 *
 * and the contract checks, which hold the typed transcription of the full design to
 * docs/design/sim-core.md (types the first build replaced are kept as `Contract<Name>`):
 *
 *  - `dependency-table.ts`: the module table of section 4 as data, `checkDependencyGraph` and
 *    `findCycle` (also run by `scripts/check-dependency-graph.ts`);
 *  - `contract-document.ts`: readers of the contract itself (its module table, the record
 *    sizes it states, its offset tables, the declarations of its `ts` code blocks);
 *  - `record-layouts.ts`: every binary record layout of the simulation in one list.
 *
 * The reference implementations, the fixtures F0 to F6 and the audits belong to the
 * verification engineer.
 */

export * from './types.ts';
export * from './dependency-table.ts';
export * from './contract-document.ts';
export * from './record-layouts.ts';
