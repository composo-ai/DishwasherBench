/**
 * Node-only adapter: the WebGPU entry object from the Dawn bindings (npm package `webgpu`) and
 * the environment's part of the stack string (docs/design/sim-core.md section M1: "Bindings:
 * webgpu 0.6.2 in Node 20"). Everything else in the package takes a `GpuEntry` and never
 * imports the bindings, so that a browser can pass `navigator.gpu` instead.
 *
 * Not exported from the package entry point; import it from `@spotless/sim-gpu/node`.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { release, type } from 'node:os';
import { dirname, join } from 'node:path';
import { create } from 'webgpu';
import { createGpuContext, GpuInfrastructureError, type GpuEntry } from '../context.ts';
import type { GpuContext } from '../types.ts';

/**
 * The Dawn instances of this process, one per distinct list of flags, held for the life of the
 * process: if the object returned by `create()` is garbage-collected, Dawn drops the instance
 * and every later call rejects with "Instance dropped" (spike report section 3). Every context
 * made with the same flags shares one instance, so that making contexts does not make
 * instances.
 */
const instances = new Map<string, GPU>();

/** Operating-system name and build: `macOS 27.0.1 (26A434)` on a Mac, else type and release. */
export function operatingSystemBuild(): string {
  if (process.platform === 'darwin') {
    try {
      const version = execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim();
      const build = execFileSync('sw_vers', ['-buildVersion'], { encoding: 'utf8' }).trim();
      return `macOS ${version} (${build})`;
    } catch {
      // Fall through to the generic form.
    }
  }
  return `${type()} ${release()}`;
}

/** Version of the installed `webgpu` package, for example `0.6.2`. */
export function webgpuBindingsVersion(): string {
  const require = createRequire(import.meta.url);
  const manifest = join(dirname(require.resolve('webgpu')), 'package.json');
  return (JSON.parse(readFileSync(manifest, 'utf8')) as { version: string }).version;
}

/**
 * The Dawn instance of this process for the given flags (created at the first call) and the
 * description of the environment. `flags` are Dawn toggles as the bindings take them (for
 * example `enable-dawn-features=...`); none are needed, and any flag that changes code
 * generation makes a different stack.
 */
export function nodeGpuEntry(flags: readonly string[] = []): GpuEntry {
  const key = JSON.stringify(flags);
  let gpu = instances.get(key);
  if (gpu === undefined) {
    gpu = create([...flags]);
    instances.set(key, gpu);
  }
  return {
    gpu,
    os: operatingSystemBuild(),
    webgpu: `webgpu ${webgpuBindingsVersion()}${flags.length > 0 ? ` [${flags.join(' ')}]` : ''}`,
    runtime: `node ${process.versions.node}`,
  };
}

/** Options of {@link createNodeGpuContext}. */
export interface NodeGpuContextOptions {
  /** Simulator version for the stack string; default `0.0.0-dev`. */
  readonly sim?: string;
  /** Rigid-body engine for the stack string; default `none`. */
  readonly physics?: string;
  /** Ceiling on live buffer bytes; default 4 GiB. */
  readonly maxLiveBytes?: number;
}

/**
 * Creates a context on the Dawn bindings. Rejects if there is no adapter.
 *
 * A process should create one context and reuse it for every wash: the bindings keep about
 * 0.5 MB of resident memory per device created, even after `destroy()` (measured over 200
 * create-and-destroy cycles), so a long-lived process that makes a context per wash grows
 * without bound.
 */
export function createNodeGpuContext(options: NodeGpuContextOptions = {}): Promise<GpuContext> {
  return createGpuContext({
    entry: nodeGpuEntry(),
    sim: options.sim ?? '0.0.0-dev',
    physics: options.physics ?? 'none',
    ...(options.maxLiveBytes !== undefined ? { maxLiveBytes: options.maxLiveBytes } : {}),
  });
}

/**
 * As {@link createNodeGpuContext}, but resolves to null where there is no WebGPU adapter (a
 * machine without a GPU), after saying so on stderr. For tests, which then skip visibly.
 */
export async function tryCreateNodeGpuContext(
  options: NodeGpuContextOptions = {},
): Promise<GpuContext | null> {
  try {
    return await createNodeGpuContext(options);
  } catch (error) {
    if (error instanceof GpuInfrastructureError && /no WebGPU adapter/.test(error.message)) {
      console.warn('sim-gpu: no WebGPU adapter available; GPU tests are SKIPPED');
      return null;
    }
    throw error;
  }
}
