/**
 * The page's music and sound. `startAudio()` is all the page calls.
 *
 * It finds out what the game is doing by asking the page for its own account of itself
 * (`window.spotless.debugState()`) four times a second and by looking for the list of levels in
 * the document; it never calls the game. Nothing sounds, and no audio context exists, before the
 * player's first click or key: browsers forbid it, and the first sound then rises over a few
 * seconds.
 *
 * What it costs while the page draws its scene: at most three `<audio>` elements decoding MP3
 * (two during a crossfade, a third only while a scene changes), a dozen gain nodes, and a timer
 * four times a second that reads a few fields.
 */

import './audio.css';
import { SoundControl } from './control.ts';
import { Director, type Cue, type GameSnapshot, type Scene } from './director.ts';
import { ElementSource } from './elements.ts';
import { Mixer, type MusicStatus } from './mixer.ts';
import { renderMix } from './offline.ts';
import { seededRandom } from './sequencer.ts';
import { loadSettings, saveSettings, type SoundSettings } from './settings.ts';
import { Sounds } from './sounds.ts';

/** Seconds ahead of the audio clock that voices are scheduled. */
const HORIZON = 12;
const TICK_MS = 250;

interface PageState {
  phase: string | null;
  placed: number;
  animating: boolean;
  hasReport: boolean;
  doorShut: boolean;
  wash: { status: string } | null;
}

function snapshot(): GameSnapshot | null {
  const page = (window as unknown as { spotless?: { debugState?: () => PageState } }).spotless;
  if (page === undefined || typeof page.debugState !== 'function') return null;
  let state: PageState;
  try {
    state = page.debugState();
  } catch {
    return null;
  }
  return {
    menu: state.phase === null || document.querySelector('#modal-root .levels') !== null,
    phase: state.phase,
    washStatus: state.wash?.status ?? null,
    hasReport: state.hasReport,
    placed: state.placed,
    animating: state.animating,
    doorShut: state.doorShut,
  };
}

interface Engine {
  readonly context: AudioContext;
  readonly mixer: Mixer;
  readonly source: ElementSource;
  readonly sounds: Sounds;
}

/** What the scripts and the checks may ask of the audio (`window.spotlessAudio`). */
export interface AudioDebug {
  state(): {
    unlocked: boolean;
    context: string | null;
    time: number;
    wanted: Scene | null;
    scene: Scene | null;
    ducked: boolean;
    settings: SoundSettings;
    playing: string | null;
    /** The `<audio>` elements in use: where each has got to in its file. */
    elements: { seconds: number; paused: boolean }[];
    scheduled: number;
    /** What the sound panel shows: playing, next and in how long, the changes heard. */
    music: {
      playing: string | null;
      next: { piece: string; seconds: number } | null;
      canSkip: boolean;
      heard: { ago: number; from: string; to: string }[];
    } | null;
  };
  /** Goes to the next piece now, as the panel's button does. */
  skip(): boolean;
  renderMix: typeof renderMix;
}

function statusWords(status: MusicStatus): NonNullable<ReturnType<AudioDebug['state']>['music']> {
  return {
    playing: status.playing?.id ?? null,
    next:
      status.next === null ? null : { piece: status.next.piece.id, seconds: status.next.seconds },
    canSkip: status.canSkip,
    heard: status.heard.map((h) => ({ ago: h.ago, from: h.from.id, to: h.to.id })),
  };
}

export function startAudio(): void {
  let settings = loadSettings();
  const director = new Director();
  let wanted: Scene | null = null;
  let ducked = false;
  let engine: Engine | null = null;

  /** Brings the mixer's scene into line with the game and with the music switch. */
  const align = (): void => {
    if (engine === null) return;
    const scene = settings.music ? wanted : null;
    if (engine.mixer.scene() !== scene) engine.mixer.setScene(scene, engine.context.currentTime);
  };

  const unlock = (): void => {
    if (engine !== null || (!settings.music && !settings.sounds)) return;
    const Context =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Context === undefined) return;
    const context = new Context({ latencyHint: 'playback' });
    void context.resume();
    const random = seededRandom((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);
    const source = new ElementSource(context);
    const mixer = new Mixer(context, source, random);
    engine = { context, mixer, source, sounds: new Sounds(context, mixer.soundsIn, random) };
    mixer.setVolume(settings.volume, 0);
    mixer.setMusic(settings.music, 0);
    mixer.setDuck(ducked, 0);
    align();
  };

  const control = new SoundControl(
    settings,
    () => {
      if (engine === null) return;
      const now = engine.context.currentTime;
      if (engine.mixer.skip(now)) control.showMusic(engine.mixer.status(now));
    },
    (next) => {
      settings = next;
      saveSettings(next);
      unlock();
      if (engine === null) return;
      const now = engine.context.currentTime;
      engine.mixer.setVolume(next.volume, now);
      engine.mixer.setMusic(next.music, now);
      align();
    },
  );
  const bar = document.getElementById('topbar');
  if (bar !== null) control.attach(bar);

  const perform = (cue: Cue): void => {
    if (cue.do === 'scene') wanted = cue.scene;
    if (cue.do === 'duck') ducked = cue.on;
    if (engine === null) return;
    const now = engine.context.currentTime;
    if (cue.do === 'scene') align();
    else if (cue.do === 'duck') engine.mixer.setDuck(cue.on, now);
    else if (settings.sounds) engine.sounds.play(cue.sound, now + 0.02);
  };

  window.setInterval(() => {
    const game = snapshot();
    if (game !== null) for (const cue of director.observe(game)) perform(cue);
    if (engine === null) return;
    const now = engine.context.currentTime;
    engine.mixer.fill(now + HORIZON);
    engine.mixer.tidy(now);
    control.showMusic(settings.music ? engine.mixer.status(now) : null);
  }, TICK_MS);

  // The first click or key anywhere on the page is what lets the browser play sound.
  for (const type of ['pointerdown', 'click', 'keydown'] as const) {
    document.addEventListener(type, unlock, { capture: true, passive: true });
  }

  const debug: AudioDebug = {
    state: () => ({
      unlocked: engine !== null,
      context: engine?.context.state ?? null,
      time: engine?.context.currentTime ?? 0,
      wanted,
      scene: engine?.mixer.scene() ?? null,
      ducked,
      settings,
      playing: engine?.mixer.playing(engine.context.currentTime)?.piece.id ?? null,
      elements: engine?.source.positions() ?? [],
      scheduled: engine?.mixer.log.length ?? 0,
      music: engine === null ? null : statusWords(engine.mixer.status(engine.context.currentTime)),
    }),
    skip: () => engine !== null && engine.mixer.skip(engine.context.currentTime),
    renderMix,
  };
  (window as unknown as { spotlessAudio: AudioDebug }).spotlessAudio = debug;
}
