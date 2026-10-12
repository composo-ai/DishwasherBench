// The dependency graph of the simulation packages must be acyclic and equal the module table
// of docs/design/sim-core.md section 4. The table is read from the contract itself, so the test
// has no second copy of it to go stale; the checker is also tried on graphs that are wrong.
import { describe, expect, it } from 'vitest';
import { extractModuleTable } from './contract-document.ts';
import {
  checkDependencyGraph,
  findCycle,
  requiredDependencies,
  SIM_MODULES,
  tableProblems,
} from './dependency-table.ts';
import { readContract, readWorkspaceManifests } from './node/workspace.ts';
import type { PackageManifest, SimModule } from './types.ts';

const contractRows = extractModuleTable(readContract());
const manifests = readWorkspaceManifests();

describe('module table of section 4', () => {
  it('is read from the contract: thirteen modules, M1 to M13', () => {
    expect(contractRows.map((r) => r.id)).toEqual(
      Array.from({ length: 13 }, (_unused, i) => `M${i + 1}`),
    );
    // Spot checks against the table as printed.
    expect(contractRows[0]).toEqual({ id: 'M1', package: 'sim-gpu', dependsOn: ['core'] });
    expect(contractRows[10]).toEqual({
      id: 'M11',
      package: 'sim-rigid',
      dependsOn: ['physics', 'M3', 'M5'],
    });
    expect(contractRows[12]?.dependsOn).toEqual(['all']);
  });

  it('equals the table kept as data', () => {
    expect(tableProblems(contractRows)).toEqual([]);
  });
});

describe('dependency graph of the workspace', () => {
  it('equals the table and has no cycle', () => {
    expect(checkDependencyGraph(manifests)).toEqual([]);
  });

  it('gives every module a package', () => {
    const names = new Set(manifests.map((m) => m.package));
    for (const module of SIM_MODULES) expect(names.has(module.package), module.package).toBe(true);
  });

  it('keeps M1 on @spotless/core alone', () => {
    // "M1 | `@spotless/sim-gpu` | ... | core": the GPU foundation depends on no other package
    // of the workspace.
    const gpu = manifests.find((m) => m.package === 'sim-gpu');
    expect(gpu?.workspaceDeps).toEqual(['core']);
  });

  it('lets nothing depend on M13, and no platform package depend on the simulation', () => {
    for (const manifest of manifests) {
      expect(manifest.workspaceDeps, manifest.package).not.toContain('sim-verify');
      if (['core', 'geometry', 'machine', 'catalogue', 'physics'].includes(manifest.package)) {
        expect(
          manifest.workspaceDeps.filter((d) => d.startsWith('sim-')),
          manifest.package,
        ).toEqual([]);
      }
    }
  });
});

describe('the checker', () => {
  /** A workspace that satisfies the table exactly. */
  function conforming(): PackageManifest[] {
    const required = requiredDependencies();
    return SIM_MODULES.map((m) => ({
      package: m.package,
      workspaceDeps: required.get(m.package) ?? [],
      externalDeps: [],
    }));
  }

  it('accepts a workspace that lists exactly the rows of the table', () => {
    expect(checkDependencyGraph(conforming())).toEqual([]);
  });

  it('expands "all" to the platform packages of the table and every module below', () => {
    const required = requiredDependencies();
    expect(required.get('sim-core')).toEqual(
      [
        'core',
        'geometry',
        'machine',
        'physics',
        ...SIM_MODULES.slice(0, 11).map((m) => m.package),
      ].sort(),
    );
    expect(required.get('sim-verify')).toHaveLength(4 + 12);
    expect(required.get('sim-verify')).toContain('sim-core');
    // Module ids resolve to packages: M7 depends on M3, M5 and M6.
    expect(required.get('sim-film')).toEqual(['sim-jets', 'sim-scene', 'sim-spray']);
  });

  it('reports a missing and a forbidden dependency', () => {
    const broken = conforming().map((m) =>
      m.package === 'sim-soil'
        ? { ...m, workspaceDeps: ['sim-scene', 'sim-jets'] } // M8 may not depend on M5; M2 dropped
        : m,
    );
    expect(checkDependencyGraph(broken)).toEqual([
      { package: 'sim-soil', kind: 'missing', detail: 'sim-params' },
      { package: 'sim-soil', kind: 'forbidden', detail: 'sim-jets' },
    ]);
  });

  it('allows @spotless/core everywhere and the catalogue to M3, M12 and M13 only', () => {
    const withCore = conforming().map((m) => ({
      ...m,
      workspaceDeps: [...new Set([...m.workspaceDeps, 'core'])],
    }));
    expect(checkDependencyGraph(withCore)).toEqual([]);
    const withCatalogue = (name: string): PackageManifest[] =>
      conforming().map((m) =>
        m.package === name ? { ...m, workspaceDeps: [...m.workspaceDeps, 'catalogue'] } : m,
      );
    // The scene's tests, the orchestrator and the verification read catalogue items; the
    // stages between them take shapes, wetting data and soil classes from their caller.
    for (const allowed of ['sim-verify', 'sim-core', 'sim-scene']) {
      expect(checkDependencyGraph(withCatalogue(allowed))).toEqual([]);
    }
    expect(checkDependencyGraph(withCatalogue('sim-soil'))).toEqual([
      { package: 'sim-soil', kind: 'forbidden', detail: 'catalogue' },
    ]);
  });

  it('reports a module without a package', () => {
    const without = conforming().filter((m) => m.package !== 'sim-liquor');
    expect(checkDependencyGraph(without).map((p) => `${p.package} ${p.kind}`)).toContain(
      'sim-liquor unknown-package',
    );
  });

  it('finds a cycle, also one that runs through a platform package', () => {
    expect(
      findCycle(
        new Map([
          ['a', ['b']],
          ['b', ['c']],
          ['c', []],
        ]),
      ),
    ).toBeNull();
    expect(
      findCycle(
        new Map([
          ['a', ['b']],
          ['b', ['c']],
          ['c', ['a']],
        ]),
      ),
    ).toEqual(['a', 'b', 'c', 'a']);
    const cyclic: PackageManifest[] = [
      ...conforming(),
      {
        package: 'machine',
        workspaceDeps: ['core', 'geometry', 'sim-hydraulics'],
        externalDeps: [],
      },
    ];
    const problems = checkDependencyGraph(cyclic);
    expect(problems).toHaveLength(1);
    expect(problems[0]?.kind).toBe('cycle');
    expect(problems[0]?.detail).toContain('machine -> sim-hydraulics');
  });

  it('reports a table as data that differs from the contract', () => {
    const edited: SimModule[] = SIM_MODULES.map((m) =>
      m.id === 'M9' ? { ...m, dependsOn: ['M2', 'M4'] } : m,
    );
    const problems = tableProblems(contractRows, edited);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ package: 'sim-liquor', kind: 'table' });
  });
});
