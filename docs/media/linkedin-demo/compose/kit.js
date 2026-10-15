// Where the video's inputs are, the base palette, and the monospace face for code.
export const REPO = new URL('../../../../', import.meta.url).href;
// Written by manifest.py: where the clips are, and how many frames each has.
const clips = await import('./build/clips.js');
export const CLIPS = clips.CLIPS_URL;
export const MANIFEST = clips.default; // { id: frames }

export const C = {
  peach: '#ecd0ad',
  peachDeep: '#e2bf93',
  cream: '#fbf6ef',
  ink: '#1c2430',
  muted: '#5f6b7a',
  blue: '#1560d4',
  green: '#1f8a4c',
  red: '#c62828',
  magenta: '#c2187a',
  amber: '#b26a00',
  terracotta: '#b3593a',
  white: '#ffffff',
};

export const MONO = "'DejaVu Sans Mono', 'Liberation Mono', monospace";
