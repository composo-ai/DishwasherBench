// Checks that the dependency graph of the simulation packages is acyclic and equals the table
// of docs/design/sim-core.md section 4, and prints the graph. Exits with status 1 on any
// disagreement. Run with `pnpm --filter @spotless/sim-verify run check-deps`.
import { extractModuleTable } from '../src/contract-document.ts';
import {
  checkDependencyGraph,
  requiredDependencies,
  SIM_MODULES,
  tableProblems,
} from '../src/dependency-table.ts';
import { readContract, readWorkspaceManifests } from '../src/node/workspace.ts';

const manifests = readWorkspaceManifests();
const required = requiredDependencies();
const fromContract = extractModuleTable(readContract());

console.log('module  package          depends on (package.json)');
for (const module of SIM_MODULES) {
  const manifest = manifests.find((m) => m.package === module.package);
  const deps = manifest ? manifest.workspaceDeps.join(', ') : '(no package.json)';
  console.log(`${module.id.padEnd(7)} ${module.package.padEnd(16)} ${deps}`);
}

const problems = [...tableProblems(fromContract), ...checkDependencyGraph(manifests)];

if (problems.length === 0) {
  const edges = [...required.values()].reduce((sum, deps) => sum + deps.length, 0);
  console.log(
    `\nacyclic and equal to the table of section 4 (${SIM_MODULES.length} modules, ${edges} required edges)`,
  );
} else {
  console.log('');
  for (const p of problems) console.log(`PROBLEM ${p.package}: ${p.kind} ${p.detail}`);
  process.exitCode = 1;
}
