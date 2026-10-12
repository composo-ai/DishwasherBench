/**
 * Fingerprints of the simulation's source: one mechanism for everything that must not outlive
 * the code that computed it.
 *
 * The packages of this workspace are consumed as TypeScript source, so the source that is
 * hashed is the code that runs. A fingerprint is the SHA-256 of a set of source files, each by
 * its path relative to the packages directory and its bytes, in path order. Two sets matter:
 *
 *  - {@link exposureFingerprint}: the sources an exposure set is a function of BEYOND what its
 *    cache key already hashes by content. The key hashes the geometry the scene is built from
 *    (every shape and pose, the materials), the spray state, the `hydro` parameters, the tier
 *    and the seed (`exposure-cache.ts`); the fingerprint adds the code that turns those into
 *    an exposure set: the shared mathematics, the geometry kernel, the parameter closures, the
 *    GPU wrapper, the scene, the hydraulics layer, the jets, the droplets, the film, and the
 *    two files of this package that prepare the scene and build the key. The disk cache
 *    (`createDiskExposureCache`) keeps its sets in a directory named after it, so exposure
 *    computed by other water code is never replayed, whether or not anyone raised
 *    `SIM_VERSION`. The machine, the catalogue, the soil side and the orchestration of the
 *    replay are deliberately NOT in it: what they contribute to an exposure set is hashed by
 *    content, and a change of soil code must not cost a recomputation of the water.
 *  - {@link simulationFingerprint}: the sources a wash RESULT is a function of (every `sim-*`
 *    package, the inspector, the machine, the catalogue, the geometry kernel, the shared
 *    mathematics and the game's wash runner). The game server keys its stored results by it.
 *
 * This module imports nothing but Node's own modules, so that a process which must not load
 * the simulation (the game server) can import it alone (`@spotless/sim-core/fingerprint`).
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The directory of the workspace's packages (`packages/`). */
export const WORKSPACE_PACKAGES_DIR = fileURLToPath(new URL('../../../', import.meta.url));

/** Files that are code or data of a package: sources, shaders and data, but no tests. */
function isSource(name: string): boolean {
  if (/\.test\.ts$/.test(name)) return false;
  return /\.(ts|json|wgsl)$/.test(name);
}

function sourceFiles(dir: string, out: string[]): void {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (name !== 'node_modules' && name !== 'testing') sourceFiles(path, out);
    } else if (stat.isFile() && isSource(name)) {
      out.push(path);
    }
  }
}

/** What a fingerprint covers: whole `src` trees of packages, and single files of others. */
export interface FingerprintScope {
  /** Packages whose whole `src` tree counts (tests and `testing/` left out). */
  readonly packages: readonly string[];
  /** Single files, as paths relative to the packages directory. */
  readonly files?: readonly string[];
}

/** A fingerprint with what it was taken over. */
export interface SourceFingerprint {
  /** SHA-256 of the files, hex. */
  readonly hash: string;
  /** Number of files hashed. */
  readonly files: number;
}

/**
 * The fingerprint of a scope: SHA-256 over every source file of it (relative path, a zero
 * byte, the content, a zero byte), packages in name order, files in path order, then the
 * single files in path order. A package or file that does not exist contributes nothing.
 */
export function sourceFingerprint(
  scope: FingerprintScope,
  packagesDir: string = WORKSPACE_PACKAGES_DIR,
): SourceFingerprint {
  const hash = createHash('sha256');
  let count = 0;
  const add = (file: string): void => {
    hash.update(relative(packagesDir, file));
    hash.update('\0');
    hash.update(readFileSync(file));
    hash.update('\0');
    count++;
  };
  for (const name of [...scope.packages].sort()) {
    const src = join(packagesDir, name, 'src');
    if (!existsSync(src)) continue;
    const files: string[] = [];
    sourceFiles(src, files);
    for (const file of files) add(file);
  }
  for (const path of [...(scope.files ?? [])].sort()) {
    const file = join(packagesDir, path);
    if (existsSync(file)) add(file);
  }
  return { hash: hash.digest('hex'), files: count };
}

/**
 * The sources an exposure set depends on beyond its cache key (see the file comment). The two
 * files of this package are the scene set-up of a wash and the cache key itself.
 */
export const EXPOSURE_SOURCE_SCOPE: FingerprintScope = {
  packages: [
    'core',
    'geometry',
    'sim-film',
    'sim-gpu',
    'sim-hydraulics',
    'sim-jets',
    'sim-params',
    'sim-scene',
    'sim-spray',
  ],
  files: ['sim-core/src/exposure-cache.ts', 'sim-core/src/scene-setup.ts'],
};

/**
 * The sources of the machine: its data (nozzles, baskets, programmes) and the geometry made
 * from them. An exposure set is safe against a change of these through its scene key; a
 * parameter set fitted to washes of the machine is not, so a calibrated set records this
 * fingerprint beside that of the exposure sources (`AnchoredOn.machineSource`).
 */
export const MACHINE_SOURCE_SCOPE: FingerprintScope = { packages: ['machine'] };

/** The fingerprint of the sources of the machine package, hex (see {@link MACHINE_SOURCE_SCOPE}). */
export function machineFingerprint(packagesDir: string = WORKSPACE_PACKAGES_DIR): string {
  return sourceFingerprint(MACHINE_SOURCE_SCOPE, packagesDir).hash;
}

/** The platform packages a wash result is a function of, beside every `sim-*` package. */
export const RESULT_PLATFORM_PACKAGES: readonly string[] = [
  'catalogue',
  'core',
  'geometry',
  'inspector',
  'machine',
  'wash-runner',
];

/**
 * The fingerprint of the sources of the exposure side, hex (see the file comment). Reads some
 * two hundred source files (tens of milliseconds) every time it is called: a caller that asks
 * often holds the value itself.
 */
export function exposureFingerprint(packagesDir: string = WORKSPACE_PACKAGES_DIR): string {
  return sourceFingerprint(EXPOSURE_SOURCE_SCOPE, packagesDir).hash;
}

/**
 * The fingerprint of the sources of everything a wash result depends on, hex: every source
 * file under `src` of the platform packages named above and of every `sim-*` package. Read
 * afresh on every call.
 */
export function simulationFingerprint(packagesDir: string = WORKSPACE_PACKAGES_DIR): string {
  const packages = readdirSync(packagesDir).filter(
    (name) => RESULT_PLATFORM_PACKAGES.includes(name) || name.startsWith('sim-'),
  );
  return sourceFingerprint({ packages }, packagesDir).hash;
}
