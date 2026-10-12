/**
 * Node-only adapter: reads the manifests and sources of the workspace from disk, for the
 * checks of this package that compare the repository with the design contract. Not exported
 * from the package entry point, so that the rest of the package stays free of the file system.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PackageManifest } from '../types.ts';

/** Root of the repository: four directories above this file. */
export const REPOSITORY_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
);

/** The text of the design contract, docs/design/sim-core.md. */
export function readContract(): string {
  return readFileSync(join(REPOSITORY_ROOT, 'docs', 'design', 'sim-core.md'), 'utf8');
}

interface RawManifest {
  readonly name?: string;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
}

const SCOPE = '@spotless/';

/** The manifest of every package under `packages/`, sorted by name. */
export function readWorkspaceManifests(): PackageManifest[] {
  const packagesDir = join(REPOSITORY_ROOT, 'packages');
  const manifests: PackageManifest[] = [];
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    let text: string;
    try {
      text = readFileSync(join(packagesDir, entry.name, 'package.json'), 'utf8');
    } catch {
      continue;
    }
    const raw = JSON.parse(text) as RawManifest;
    const deps = Object.keys({ ...raw.dependencies, ...raw.devDependencies }).sort();
    manifests.push({
      package: (raw.name ?? entry.name).replace(SCOPE, ''),
      workspaceDeps: deps.filter((d) => d.startsWith(SCOPE)).map((d) => d.replace(SCOPE, '')),
      externalDeps: deps.filter((d) => !d.startsWith(SCOPE)),
    });
  }
  return manifests.sort((a, b) => (a.package < b.package ? -1 : a.package > b.package ? 1 : 0));
}

/** The TypeScript sources of a package that are not tests, as [file name, text], sorted. */
export function readPackageSources(packageName: string): [string, string][] {
  const dir = join(REPOSITORY_ROOT, 'packages', packageName, 'src');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .sort()
    .map((name) => [name, readFileSync(join(dir, name), 'utf8')]);
}
