/**
 * Node-only adapters of `@spotless/sim-params` (file system access), kept out of the main entry
 * point so that the simulation code can run in a browser. Import from
 * `@spotless/sim-params/node`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertNoPhysicalLiterals,
  type KernelSource,
  type LiteralLintOptions,
} from './literal-lint.ts';

/** Options of {@link assertKernelFilesHaveNoPhysicalLiterals}. */
export interface KernelFileLintOptions extends LiteralLintOptions {
  /**
   * Which files of a directory are kernel sources. Default: names ending in `.wgsl`, `.wgsl.ts`,
   * `.kernel.ts` or `.ref.ts` (WGSL kernels and their f64 reference implementations).
   */
  readonly match?: (fileName: string) => boolean;
}

const DEFAULT_MATCH = (name: string): boolean =>
  /\.wgsl$|\.wgsl\.ts$|\.kernel\.ts$|\.ref\.ts$/.test(name);

/**
 * The kernel sources under the given paths: a file is taken as it is, a directory is walked
 * recursively (entries in name order, `node_modules` skipped) and filtered by `match`.
 */
export function readKernelSources(
  paths: readonly string[],
  match: (fileName: string) => boolean = DEFAULT_MATCH,
): KernelSource[] {
  const out: KernelSource[] = [];
  const visit = (path: string, explicit: boolean): void => {
    if (statSync(path).isDirectory()) {
      for (const name of readdirSync(path).sort()) {
        if (name !== 'node_modules') visit(join(path, name), false);
      }
    } else if (explicit || match(path)) {
      out.push({ name: path, text: readFileSync(path, 'utf8') });
    }
  };
  for (const path of paths) visit(path, true);
  return out;
}

/**
 * The literal lint of sim-core.md section 0 as a one-line test:
 *
 * `it('has no physical literals', () => assertKernelFilesHaveNoPhysicalLiterals([import.meta.dirname]))`
 *
 * Throws an `Error` listing every disallowed numeric literal in the kernel sources under the
 * paths, and also when the paths hold no kernel source at all (a lint that scans nothing must
 * not pass).
 */
export function assertKernelFilesHaveNoPhysicalLiterals(
  paths: readonly string[],
  options: KernelFileLintOptions = {},
): void {
  const sources = readKernelSources(paths, options.match);
  if (sources.length === 0) {
    throw new Error(`literal lint: no kernel source found under ${paths.join(', ')}`);
  }
  assertNoPhysicalLiterals(sources, options);
}
