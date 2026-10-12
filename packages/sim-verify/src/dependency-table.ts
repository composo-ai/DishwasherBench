/**
 * The dependency table of the thirteen simulation modules (docs/design/sim-core.md section 4)
 * as data, and the check that the workspace equals it.
 *
 * How the table is read here, where it leaves room:
 * - A package lists exactly the packages of its row. `@spotless/core` may be added by any of
 *   them (the brief of the skeletons allows it "where it needs math types"; every platform
 *   package depends on it).
 * - `all`, for M12 and M13, is every package the table names (core, geometry, machine, physics)
 *   and every module below the row.
 * - M13 may also depend on `@spotless/catalogue`: the tests the contract assigns to it run over
 *   "every catalogue item" (section M3), its fixtures F0 and F1 are built from catalogue
 *   profiles (section 9), and docs/design/platform.md section 3 lets the simulation packages
 *   depend on the catalogue. Nothing depends on M13, so no cycle can come of it.
 * - A module reaches the modules its row does not name through the ones it does: every
 *   simulation package re-exports the entry points of the simulation packages it depends on.
 *   M7, for example, lists M3, M5 and M6 and takes `HydraulicPoint` of M4 from M5, and the
 *   `GpuContext` of M1 and the registry of M2 from M3. Two consequences: a name can be exported
 *   by one simulation package only (the same name from two of them is an ambiguity in every
 *   package above both), and a record is importable from the module the contract assigns it to
 *   even when it is declared in a lower one.
 *
 * Pure functions; reading `package.json` files is left to the caller.
 */

import type { ContractModuleRow } from './contract-document.ts';
import type { DependencyProblem, PackageManifest, SimModule } from './types.ts';

/** The module table of section 4. */
export const SIM_MODULES: readonly SimModule[] = [
  { id: 'M1', package: 'sim-gpu', dependsOn: ['core'] },
  { id: 'M2', package: 'sim-params', dependsOn: ['core'] },
  { id: 'M3', package: 'sim-scene', dependsOn: ['geometry', 'machine', 'M1', 'M2'] },
  { id: 'M4', package: 'sim-hydraulics', dependsOn: ['machine', 'M2'] },
  { id: 'M5', package: 'sim-jets', dependsOn: ['M2', 'M3', 'M4'] },
  { id: 'M6', package: 'sim-spray', dependsOn: ['M3', 'M5'] },
  { id: 'M7', package: 'sim-film', dependsOn: ['M3', 'M5', 'M6'] },
  { id: 'M8', package: 'sim-soil', dependsOn: ['M3', 'M2'] },
  { id: 'M9', package: 'sim-liquor', dependsOn: ['M2'] },
  { id: 'M10', package: 'sim-timeline', dependsOn: ['M4', 'M7', 'M8', 'M9'] },
  { id: 'M11', package: 'sim-rigid', dependsOn: ['physics', 'M3', 'M5'] },
  { id: 'M12', package: 'sim-core', dependsOn: 'all' },
  { id: 'M13', package: 'sim-verify', dependsOn: 'all' },
];

/** The platform packages the table names in its "Depends on" column. */
export const PLATFORM_PACKAGES_OF_THE_TABLE: readonly string[] = [
  'core',
  'geometry',
  'machine',
  'physics',
];

/** A dependency any simulation package may add to its row. */
export const ALWAYS_ALLOWED_DEPENDENCY = 'core';

/**
 * Dependencies allowed to single packages beyond their row.
 * - M13 and the catalogue: see the file comment.
 * - M3 and the catalogue: the tests and the full-load benchmark of the scene are specified over
 *   catalogue items (contract-issues.md entry 6); the scene builder itself takes shapes and a
 *   material lookup from its caller.
 * - M12, the catalogue and the inspector: the orchestrator of the first build
 *   (docs/design/scope.md) turns item type ids, material ids and soil ids into shapes, wetting
 *   data and soil classes, which only the catalogue holds, and returns the verdict per item,
 *   which the inspector gives. docs/design/platform.md section 3 lets the simulation packages
 *   depend on the catalogue; the inspector depends on M2 alone, so no cycle can come of it.
 */
export const EXTRA_ALLOWED_DEPENDENCIES: Readonly<Record<string, readonly string[]>> = {
  'sim-verify': ['catalogue', 'inspector'],
  'sim-scene': ['catalogue'],
  'sim-core': ['catalogue', 'inspector'],
};

/**
 * The packages each simulation package must depend on, by package name without the scope:
 * module ids resolved to packages and `all` expanded.
 */
export function requiredDependencies(
  modules: readonly SimModule[] = SIM_MODULES,
): Map<string, string[]> {
  const packageOf = new Map(modules.map((m) => [m.id, m.package]));
  const required = new Map<string, string[]>();
  modules.forEach((module, index) => {
    const names =
      module.dependsOn === 'all'
        ? [...PLATFORM_PACKAGES_OF_THE_TABLE, ...modules.slice(0, index).map((m) => m.package)]
        : module.dependsOn.map((dep) => packageOf.get(dep) ?? dep);
    required.set(module.package, [...new Set(names)].sort());
  });
  return required;
}

/**
 * A cycle in a dependency graph, as the list of packages along it with the first repeated at
 * the end, or `null` if the graph has none. `graph` maps each package to the packages it
 * depends on; packages are visited in sorted order so the answer does not depend on insertion
 * order.
 */
export function findCycle(graph: ReadonlyMap<string, readonly string[]>): string[] | null {
  const state = new Map<string, 'open' | 'done'>();
  const stack: string[] = [];
  const visit = (node: string): string[] | null => {
    const seen = state.get(node);
    if (seen === 'done') return null;
    if (seen === 'open') return [...stack.slice(stack.indexOf(node)), node];
    state.set(node, 'open');
    stack.push(node);
    for (const next of [...(graph.get(node) ?? [])].sort()) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    stack.pop();
    state.set(node, 'done');
    return null;
  };
  for (const node of [...graph.keys()].sort()) {
    const cycle = visit(node);
    if (cycle) return cycle;
  }
  return null;
}

/**
 * Compares the manifests of the workspace with the dependency table and returns every
 * disagreement; an empty list means the graph of the simulation packages is acyclic and equals
 * the table. `manifests` must hold every simulation package and should hold the platform
 * packages too, so that a cycle through one of them is found.
 */
export function checkDependencyGraph(
  manifests: readonly PackageManifest[],
  modules: readonly SimModule[] = SIM_MODULES,
): DependencyProblem[] {
  const problems: DependencyProblem[] = [];
  const byName = new Map(manifests.map((m) => [m.package, m]));
  const required = requiredDependencies(modules);

  for (const module of modules) {
    const manifest = byName.get(module.package);
    if (!manifest) {
      problems.push({
        package: module.package,
        kind: 'unknown-package',
        detail: 'no package.json',
      });
      continue;
    }
    const must = required.get(module.package) ?? [];
    const may = new Set([
      ...must,
      ALWAYS_ALLOWED_DEPENDENCY,
      ...(EXTRA_ALLOWED_DEPENDENCIES[module.package] ?? []),
    ]);
    for (const dep of must) {
      if (!manifest.workspaceDeps.includes(dep)) {
        problems.push({ package: module.package, kind: 'missing', detail: dep });
      }
    }
    for (const dep of [...manifest.workspaceDeps].sort()) {
      if (!may.has(dep)) problems.push({ package: module.package, kind: 'forbidden', detail: dep });
    }
  }

  const graph = new Map(manifests.map((m) => [m.package, m.workspaceDeps]));
  const cycle = findCycle(graph);
  if (cycle) {
    problems.push({ package: cycle[0] as string, kind: 'cycle', detail: cycle.join(' -> ') });
  }
  return problems;
}

/**
 * Compares the table as data with the rows read from the contract itself
 * (`extractModuleTable`) and returns every difference: a row missing on either side, another
 * package name, or another "Depends on" cell.
 */
export function tableProblems(
  rows: readonly ContractModuleRow[],
  modules: readonly SimModule[] = SIM_MODULES,
): DependencyProblem[] {
  const problems: DependencyProblem[] = [];
  const written = (m: SimModule): string =>
    m.dependsOn === 'all' ? 'all' : m.dependsOn.join(', ');
  for (const row of rows) {
    const mine = modules.find((m) => m.id === row.id);
    if (!mine) {
      problems.push({
        package: row.package,
        kind: 'table',
        detail: `${row.id} is not in the table as data`,
      });
    } else if (mine.package !== row.package || written(mine) !== row.dependsOn.join(', ')) {
      problems.push({
        package: row.package,
        kind: 'table',
        detail: `${row.id}: contract "${row.package}: ${row.dependsOn.join(', ')}", data "${mine.package}: ${written(mine)}"`,
      });
    }
  }
  for (const module of modules) {
    if (!rows.some((row) => row.id === module.id)) {
      problems.push({
        package: module.package,
        kind: 'table',
        detail: `${module.id} is not in the contract`,
      });
    }
  }
  return problems;
}
