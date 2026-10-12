import { describe, expect, it } from 'vitest';
import { Director, washing, type GameSnapshot } from './director.ts';
import { DEFAULT_SETTINGS, parseSettings } from './settings.ts';

const menu: GameSnapshot = {
  menu: true,
  phase: null,
  washStatus: null,
  hasReport: false,
  placed: 0,
  animating: false,
  doorShut: false,
};
const loading: GameSnapshot = { ...menu, menu: false, phase: 'loading' };

describe('the director', () => {
  it('gives the list of levels its own music and a session the music of play', () => {
    const director = new Director();
    expect(director.observe(menu)).toEqual([{ do: 'scene', scene: 'menu' }]);
    expect(director.observe(menu)).toEqual([]);
    expect(director.observe(loading)).toEqual([{ do: 'scene', scene: 'play' }]);
    expect(director.observe({ ...loading, menu: true })).toEqual([{ do: 'scene', scene: 'menu' }]);
  });

  it('does nothing to the music when a piece is placed, picked up or moved', () => {
    const director = new Director();
    director.observe(loading);
    const cues = [
      ...director.observe({ ...loading, placed: 1, animating: true }),
      ...director.observe({ ...loading, placed: 1 }),
      ...director.observe({ ...loading, placed: 0 }),
      ...director.observe({ ...loading, placed: 1, animating: true }),
      ...director.observe({ ...loading, placed: 1 }),
    ];
    expect(cues.filter((cue) => cue.do !== 'sound')).toEqual([]);
  });

  it('clinks once when a placed piece has come to rest, not while it is still moving', () => {
    const director = new Director();
    director.observe(loading);
    expect(director.observe({ ...loading, placed: 1, animating: true })).toEqual([]);
    expect(director.observe({ ...loading, placed: 1, animating: true })).toEqual([]);
    expect(director.observe({ ...loading, placed: 1 })).toEqual([{ do: 'sound', sound: 'clink' }]);
    expect(director.observe({ ...loading, placed: 1 })).toEqual([]);
    // Taking a piece out makes no sound.
    expect(director.observe({ ...loading, placed: 0 })).toEqual([]);
  });

  it('makes no sound for the state a session is opened in', () => {
    const director = new Director();
    director.observe(menu);
    const cues = director.observe({ ...loading, placed: 7, doorShut: true, hasReport: true });
    expect(cues).toEqual([{ do: 'scene', scene: 'play' }]);
    // Nor when several pieces appear at once (a session restored).
    expect(director.observe({ ...loading, placed: 12, doorShut: true, hasReport: true })).toEqual(
      [],
    );
  });

  it('thuds when the door moves', () => {
    const director = new Director();
    director.observe(loading);
    expect(director.observe({ ...loading, doorShut: true })).toEqual([
      { do: 'sound', sound: 'door' },
    ]);
  });

  it('holds the music down from the start of the wash to the report, then marks the report', () => {
    const director = new Director();
    director.observe({ ...loading, placed: 9 });
    const queued = { ...loading, placed: 9, doorShut: true, washStatus: 'queued' };
    expect(director.observe(queued)).toEqual([
      { do: 'duck', on: true },
      { do: 'sound', sound: 'door' },
    ]);
    const running = { ...queued, phase: 'washing', washStatus: 'running' };
    expect(director.observe(running)).toEqual([]);
    const done = { ...running, phase: 'finished', washStatus: 'done', hasReport: true };
    expect(director.observe(done)).toEqual([{ do: 'duck', on: false }]);
    expect(director.observe(done)).toEqual([]);
  });

  it('lets the music back if the wash fails', () => {
    const director = new Director();
    director.observe(loading);
    director.observe({ ...loading, washStatus: 'running' });
    expect(director.observe({ ...loading, washStatus: 'failed' })).toEqual([
      { do: 'duck', on: false },
    ]);
  });

  it('lets the music back when the player leaves a wash for the list of levels', () => {
    const director = new Director();
    director.observe(loading);
    director.observe({ ...loading, phase: 'washing', washStatus: 'running' });
    expect(director.observe({ ...menu, phase: 'washing', washStatus: 'running' })).toEqual([
      { do: 'scene', scene: 'menu' },
      { do: 'duck', on: false },
    ]);
  });

  it('knows a wash from its phase or from its job', () => {
    expect(washing(loading)).toBe(false);
    expect(washing({ ...loading, phase: 'washing' })).toBe(true);
    expect(washing({ ...loading, washStatus: 'queued' })).toBe(true);
    expect(washing({ ...loading, phase: 'finished', washStatus: 'done', hasReport: true })).toBe(
      false,
    );
  });
});

describe('the remembered settings', () => {
  it('start with music on, the game sounds off', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toMatchObject({ music: true, sounds: false });
  });

  it('survive a round trip and shrug off nonsense', () => {
    const chosen = { music: false, sounds: true, volume: 0.25 };
    expect(parseSettings(JSON.stringify(chosen))).toEqual(chosen);
    expect(parseSettings('not json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('null')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{"volume": 7, "music": "yes"}')).toEqual({
      ...DEFAULT_SETTINGS,
      volume: 1,
    });
  });
});
