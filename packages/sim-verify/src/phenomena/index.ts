/**
 * The phenomena suite: the checklist of docs/research/standards.md section 9 (48 real-world
 * loading phenomena, P01 to P48) as executable A/B washes of the owner's Bosch SMV4HAX40G.
 *
 *  - `types.ts`: scenarios, washes, checks, bands, diagnostics, reports;
 *  - `bands.ts`: the checklist's tolerance as bands, and the verdict of a value against one;
 *  - `loads.ts`: the settled loads read as data, soils in the checklist's terms, set poses;
 *  - `clearance.ts`: whether a set pose cuts into the baskets, and the nearest pose that is clear;
 *  - `pair-gap.ts`: how close a region of one item lies to another item, by area (the check of
 *    a load that stands for a gap: the crowded plates of P03, the nested spoons of P15);
 *  - `programmes.ts`: the machine's programmes and one-change variants of them;
 *  - `harness.ts`: one wash with the shared exposure cache and its diagnostics;
 *  - `diagnostics.ts`: what the water did to each surface, the pools, the liquor;
 *  - `measures.ts`: the quantities checks compare; the probes for missing mechanisms;
 *  - `scenarios-a.ts`, `scenarios-b.ts`, `scenarios-c.ts`: the 48 scenarios;
 *  - `runner.ts`: `runPhenomena` (any subset, a tier, a parameter set) and `PHENOMENA`;
 *  - `report.ts`: Markdown and JSON reports and the comparison of runs;
 *  - `cli.ts`: the command.
 *
 * The loads are built by `packages/sim-verify/phenomena/builder/` through the session's
 * loading physics and saved under `packages/sim-verify/phenomena/loads/`; reports go to
 * `packages/sim-verify/phenomena/reports/`.
 *
 * Node only; not exported from the package entry point (it reads files).
 */

export * from './types.ts';
export * from './bands.ts';
export * from './loads.ts';
export * from './clearance.ts';
export * from './pair-gap.ts';
export * from './programmes.ts';
export * from './diagnostics.ts';
export * from './harness.ts';
export * from './measures.ts';
export * from './kit.ts';
export * from './runner.ts';
export * from './report.ts';
