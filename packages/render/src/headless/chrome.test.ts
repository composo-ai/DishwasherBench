import { describe, expect, it } from 'vitest';
import {
  CHROME_ENV,
  chromeCandidates,
  chromeFlags,
  ChromeNotFoundError,
  DEFAULT_CHROME_PATH,
  findChrome,
  resolveChrome,
} from './chrome.ts';

const only =
  (...paths: string[]) =>
  (path: string): boolean =>
    paths.includes(path);

describe('which browser is run', () => {
  it('is the one the variable names, before any usual place', () => {
    const chrome = resolveChrome({
      platform: 'darwin',
      env: { [CHROME_ENV]: '/opt/browser/chrome' },
      exists: only('/opt/browser/chrome', DEFAULT_CHROME_PATH),
    });
    expect(chrome).toBe('/opt/browser/chrome');
  });

  it('fails, naming the variable, when the program it names is not there', () => {
    const lookup = {
      platform: 'darwin' as const,
      env: { [CHROME_ENV]: '/opt/browser/chrome' },
      exists: only(DEFAULT_CHROME_PATH),
    };
    expect(() => resolveChrome(lookup)).toThrow(ChromeNotFoundError);
    expect(() => resolveChrome(lookup)).toThrow(
      /'\/opt\/browser\/chrome', which SPOTLESS_CHROME names/,
    );
    expect(findChrome(lookup)).toBeNull();
  });

  it('is found in the usual places of macOS, Chrome before Chromium', () => {
    const lookup = { platform: 'darwin' as const, env: {}, home: '/Users/you' };
    expect(chromeCandidates(lookup)[0]).toBe(DEFAULT_CHROME_PATH);
    const chromium = '/Users/you/Applications/Chromium.app/Contents/MacOS/Chromium';
    expect(resolveChrome({ ...lookup, exists: only(chromium) })).toBe(chromium);
    expect(resolveChrome({ ...lookup, exists: only(chromium, DEFAULT_CHROME_PATH) })).toBe(
      DEFAULT_CHROME_PATH,
    );
  });

  it('is found on the PATH and in the usual places of Linux', () => {
    const lookup = { platform: 'linux' as const, env: { PATH: '/opt/bin:/usr/bin' } };
    const candidates = chromeCandidates(lookup);
    expect(candidates[0]).toBe('/opt/bin/google-chrome-stable');
    expect(candidates).toContain('/usr/bin/chromium');
    expect(candidates).toContain('/snap/bin/chromium');
    expect(candidates).toContain('/opt/google/chrome/chrome');
    expect(new Set(candidates).size).toBe(candidates.length);
    expect(resolveChrome({ ...lookup, exists: only('/usr/bin/chromium-browser') })).toBe(
      '/usr/bin/chromium-browser',
    );
  });

  it('is found under the program folders of Windows', () => {
    const lookup = {
      platform: 'win32' as const,
      env: { PROGRAMFILES: 'C:\\Program Files', LOCALAPPDATA: 'D:\\Local' },
    };
    expect(chromeCandidates(lookup)).toEqual([
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'D:\\Local\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Chromium\\Application\\chrome.exe',
      'D:\\Local\\Chromium\\Application\\chrome.exe',
    ]);
  });

  it('fails, naming the variable, when no usual place has a browser', () => {
    for (const platform of ['darwin', 'linux', 'win32'] as const) {
      const lookup = { platform, env: { PATH: '/usr/bin' }, home: '/Users/you', exists: only() };
      expect(() => resolveChrome(lookup)).toThrow(/set SPOTLESS_CHROME to the path of the program/);
      expect(findChrome(lookup)).toBeNull();
    }
  });
});

describe('the flags of a headless browser', () => {
  it('ask for Metal on macOS only, and always mute the sound', () => {
    expect(chromeFlags('darwin')).toContain('--use-angle=metal');
    for (const platform of ['linux', 'win32'] as const) {
      expect(chromeFlags(platform).some((flag) => flag.startsWith('--use-angle'))).toBe(false);
    }
    for (const platform of ['darwin', 'linux', 'win32'] as const) {
      expect(chromeFlags(platform)).toContain('--mute-audio');
      expect(chromeFlags(platform)).toContain('--enable-webgl');
    }
  });
});
