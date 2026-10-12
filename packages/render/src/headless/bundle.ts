/**
 * The script of the render page: `page-entry.ts` and everything it imports (the scene code of
 * this package, the geometry kernel, Three.js) as one file for headless Chrome, built with
 * Vite on first use and kept on disk under a fingerprint of its sources, so that a second
 * start finds it ready and a change of any source builds a new one.
 */

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The directory of the workspace's packages. */
const PACKAGES_DIR = fileURLToPath(new URL('../../../', import.meta.url));

/** The packages whose source goes into the page. */
const PAGE_PACKAGES = ['catalogue', 'core', 'geometry', 'machine', 'render'];

const ENTRY = fileURLToPath(new URL('./page-entry.ts', import.meta.url));

function sourceFiles(dir: string, out: string[]): void {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (name !== 'node_modules') sourceFiles(path, out);
    } else if (stat.isFile() && /\.(ts|json)$/.test(name) && !/\.test\.ts$/.test(name)) {
      out.push(path);
    }
  }
}

/**
 * SHA-256 (hex) of the source the page is built from: every non-test source file of the
 * packages that go into it, by relative path and content, and the versions of Three.js and
 * Vite. A picture is a function of this and of what it is asked to show, so it is also part
 * of the key pictures are cached under.
 */
export function pageFingerprint(): string {
  const hash = createHash('sha256');
  for (const name of PAGE_PACKAGES) {
    const src = join(PACKAGES_DIR, name, 'src');
    if (!existsSync(src)) continue;
    const files: string[] = [];
    sourceFiles(src, files);
    for (const file of files) {
      hash.update(relative(PACKAGES_DIR, file));
      hash.update('\0');
      hash.update(readFileSync(file));
      hash.update('\0');
    }
  }
  const manifest = JSON.parse(
    readFileSync(join(PACKAGES_DIR, 'render', 'package.json'), 'utf8'),
  ) as { dependencies?: Record<string, string> };
  hash.update(JSON.stringify([manifest.dependencies?.['three'], manifest.dependencies?.['vite']]));
  return hash.digest('hex');
}

/** A built page script. */
export interface PageBundle {
  /** Path of the script file. */
  readonly path: string;
  /** {@link pageFingerprint} of the sources it was built from. */
  readonly fingerprint: string;
  /** True when this call built it; false when it was found on disk. */
  readonly built: boolean;
  /** Wall-clock milliseconds the build took (0 when found on disk). */
  readonly buildMs: number;
}

/** Where page scripts are kept unless a directory is given. */
export function defaultBundleDir(): string {
  return join(tmpdir(), 'spotless-render-bundles');
}

/**
 * The page script for the sources as they are now: found in `cacheDir` under its fingerprint,
 * or built there. Concurrent callers may each build; the last rename wins and the files are
 * identical.
 */
export async function buildPageBundle(cacheDir: string = defaultBundleDir()): Promise<PageBundle> {
  const fingerprint = pageFingerprint();
  const name = `page-${fingerprint.slice(0, 20)}.js`;
  const path = join(cacheDir, name);
  if (existsSync(path)) return { path, fingerprint, built: false, buildMs: 0 };
  mkdirSync(cacheDir, { recursive: true });
  const started = performance.now();
  const outDir = join(cacheDir, `build-${process.pid}-${Date.now()}`);
  // Vite is loaded only when a script has to be built.
  const { build } = await import('vite');
  await build({
    configFile: false,
    logLevel: 'silent',
    root: fileURLToPath(new URL('../../', import.meta.url)),
    publicDir: false,
    build: {
      outDir,
      emptyOutDir: true,
      minify: false,
      sourcemap: false,
      target: 'es2022',
      lib: { entry: ENTRY, formats: ['iife'], name: 'SpotlessRenderPage', fileName: () => name },
    },
  });
  renameSync(join(outDir, name), path);
  rmSync(outDir, { recursive: true, force: true });
  return { path, fingerprint, built: true, buildMs: performance.now() - started };
}
