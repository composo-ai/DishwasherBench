/** What the player chose about sound, remembered between visits. */

export interface SoundSettings {
  readonly music: boolean;
  /** The game's own sounds (a clink, the door). Off until asked for. */
  readonly sounds: boolean;
  /** 0 to 1, the position of the slider. */
  readonly volume: number;
}

export const DEFAULT_SETTINGS: SoundSettings = { music: true, sounds: false, volume: 0.6 };

export const SETTINGS_KEY = 'spotless.sound';

/** Reads settings from what was stored; anything missing or malformed falls back to the default. */
export function parseSettings(stored: string | null): SoundSettings {
  if (stored === null) return DEFAULT_SETTINGS;
  try {
    const value = JSON.parse(stored) as Partial<Record<keyof SoundSettings, unknown>> | null;
    if (value === null || typeof value !== 'object') return DEFAULT_SETTINGS;
    const volume =
      typeof value.volume === 'number' && Number.isFinite(value.volume)
        ? Math.min(1, Math.max(0, value.volume))
        : DEFAULT_SETTINGS.volume;
    return {
      music: typeof value.music === 'boolean' ? value.music : DEFAULT_SETTINGS.music,
      sounds: typeof value.sounds === 'boolean' ? value.sounds : DEFAULT_SETTINGS.sounds,
      volume,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function loadSettings(): SoundSettings {
  try {
    return parseSettings(window.localStorage.getItem(SETTINGS_KEY));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: SoundSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // A browser that refuses storage still plays; it only forgets.
  }
}
