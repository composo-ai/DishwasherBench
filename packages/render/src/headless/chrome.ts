/**
 * Which browser to run, and with which flags: one answer for the render service of this
 * package and for the scripts that play the game through the page (`apps/web/scripts`).
 *
 * The browser is the program named by the environment variable `SPOTLESS_CHROME`, or, without
 * it, the first Chrome or Chromium found in the usual places of the system.
 *
 * Tested on macOS only (Apple silicon, Google Chrome in /Applications). The places looked in
 * on Linux and Windows are the standard ones, and the flags there are Chrome's defaults; none
 * of that has been run. If the pictures do not draw on such a machine, start here.
 */

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join, win32 } from 'node:path';

/** The environment variable that names the browser to run. */
export const CHROME_ENV = 'SPOTLESS_CHROME';

/** Where Google Chrome is on macOS when it was installed for every user. */
export const DEFAULT_CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/** What {@link chromeCandidates} and {@link findChrome} read of the machine; for tests. */
export interface ChromeLookup {
  /** `process.platform`. */
  readonly platform?: NodeJS.Platform;
  /** `process.env`. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** The user's home directory. */
  readonly home?: string;
  /** Whether a file exists. */
  readonly exists?: (path: string) => boolean;
}

/** Thrown when no browser can be found; the message names the variable to set. */
export class ChromeNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChromeNotFoundError';
  }
}

/**
 * The usual places of Chrome and Chromium on a system, in the order they are tried. Google
 * Chrome comes before Chromium, an installation for every user before one for this user.
 */
export function chromeCandidates(lookup: ChromeLookup = {}): string[] {
  const platform = lookup.platform ?? process.platform;
  const env = lookup.env ?? process.env;
  const home = lookup.home ?? homedir();
  if (platform === 'darwin') {
    const inApp = (app: string, program: string): string[] =>
      ['/Applications', join(home, 'Applications')].map(
        (dir) => `${dir}/${app}.app/Contents/MacOS/${program}`,
      );
    return [...inApp('Google Chrome', 'Google Chrome'), ...inApp('Chromium', 'Chromium')];
  }
  if (platform === 'win32') {
    const roots = [env['PROGRAMFILES'], env['PROGRAMFILES(X86)'], env['LOCALAPPDATA']].filter(
      (root): root is string => root !== undefined && root !== '',
    );
    return [
      ...roots.map((root) => win32.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe')),
      ...roots.map((root) => win32.join(root, 'Chromium', 'Application', 'chrome.exe')),
    ];
  }
  // Linux and the other Unix systems: the names a package installs, on the PATH first.
  const names = ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'];
  const dirs = [
    ...(env['PATH'] ?? '').split(delimiter).filter((dir) => dir !== ''),
    '/usr/bin',
    '/usr/local/bin',
    '/snap/bin',
  ];
  const out: string[] = [];
  for (const name of names) {
    for (const dir of dirs) {
      const path = `${dir.replace(/\/+$/, '')}/${name}`;
      if (!out.includes(path)) out.push(path);
    }
  }
  out.push('/opt/google/chrome/chrome');
  return out;
}

/**
 * The browser to run: the program `SPOTLESS_CHROME` names, or the first of
 * {@link chromeCandidates} that exists. Throws a {@link ChromeNotFoundError} that names the
 * variable when the program it names is not there, or when it is not set and none of the
 * usual places has a browser.
 */
export function resolveChrome(lookup: ChromeLookup = {}): string {
  const env = lookup.env ?? process.env;
  const exists = lookup.exists ?? existsSync;
  const named = env[CHROME_ENV];
  if (named !== undefined && named !== '') {
    if (!exists(named)) {
      throw new ChromeNotFoundError(`no Chrome at '${named}', which ${CHROME_ENV} names`);
    }
    return named;
  }
  const candidates = chromeCandidates(lookup);
  const found = candidates.find((path) => exists(path));
  if (found === undefined) {
    const places =
      candidates.length <= 4
        ? candidates.join(', ')
        : `${candidates.slice(0, 3).join(', ')} and ${candidates.length - 3} more places`;
    throw new ChromeNotFoundError(
      `no Chrome or Chromium found (looked in ${places}): set ${CHROME_ENV} to the path of the program`,
    );
  }
  return found;
}

/** {@link resolveChrome}, or null where it would throw: for a test that skips without a browser. */
export function findChrome(lookup: ChromeLookup = {}): string | null {
  try {
    return resolveChrome(lookup);
  } catch {
    return null;
  }
}

/**
 * The flags every headless browser of the project is started with, before those of the
 * caller: WebGL on the GPU, and no sound (the page has music, and a headless browser would
 * play it aloud on the machine it runs on).
 *
 * `--use-angle=metal` picks Apple's Metal for WebGL and exists on macOS only; elsewhere the
 * browser chooses its own backend. Not tested on Linux or Windows.
 */
export function chromeFlags(platform: NodeJS.Platform = process.platform): string[] {
  return [
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    ...(platform === 'darwin' ? ['--use-angle=metal'] : []),
    '--mute-audio',
  ];
}
