/**
 * The music the page ships: what each file is, whose it is, and where it may be entered, looped
 * and left.
 *
 * The cue points are measured, not guessed: `scripts/audio/analyse-music.py` decodes each file
 * and finds its tempo, its quiet points and the pair of places most alike in harmony and level
 * (the loop). The figures of the run of 11 October 2026 are kept beside each piece. None of the
 * pieces has percussion; the tempo is the pulse of the piano and is a guide only.
 *
 * Every file's source, licence and checksum is in `public/audio/LICENSES.md`.
 */

/** Where one piece may be entered, looped and left; times in seconds from the start of the file. */
export interface Piece {
  readonly id: string;
  readonly file: string;
  readonly title: string;
  /** The title as the sound panel says it, where the full one is long. */
  readonly short?: string;
  readonly author: string;
  readonly source: string;
  readonly licence: string;
  readonly licenceUrl: string;
  /** Length of the file. */
  readonly duration: number;
  /** Where the piece starts sounding. */
  readonly in: number;
  /** Two places alike in harmony and level: fading from `loopEnd` into `loopStart` repeats the middle. */
  readonly loopStart: number;
  readonly loopEnd: number;
  /** Where to begin fading into the next piece: a quiet point near the piece's own ending. */
  readonly exit: number;
  /** Where the piece's own last sound dies away; nothing is played past it. */
  readonly end: number;
  /** Tempo in beats a minute, the share of the onset energy that repeats at it, and a 4/4 bar. */
  readonly bpm: number;
  readonly tempoConfidence: number;
  readonly barSeconds: number;
  /**
   * False when the piece is never entered straight at its loop: its `loopStart` falls in the
   * middle of a phrase, which a repeat of the piece hides (the same phrase is ending under it)
   * and an entry from another piece does not.
   */
  readonly midEntry?: boolean;
  /**
   * Seconds of the fade the piece comes in with when it follows another. Short where the file
   * itself begins from silence at `in` (a first note, a swell of its own): a long fade from
   * nothing would swallow that beginning and leave a hole in the join. The join's own length
   * when absent.
   */
  readonly fadeIn?: number;
  /**
   * Seconds from `in` until the piece has come up by itself (its first phrase after a breath,
   * the top of its own swell); 0 when absent.
   */
  readonly lead?: number;
  /**
   * Seconds after `exit` by which the next piece should be up. Short for a piece that dies away
   * by itself straight after its exit (waiting longer leaves a silence); longer for one that
   * holds its level to the end (coming in sooner puts two full textures on top of each other).
   * The join's own delay when absent.
   */
  readonly settle?: number;
  /**
   * Seconds of the crossfade of the piece into itself, where the usual short one does not do:
   * a loop that starts in a hush needs the end of the loop to carry over it.
   */
  readonly loopFade?: number;
  /** A gain for the whole file, where the file as shipped would clip at full volume; 1 when absent. */
  readonly gain?: number;
}

const CC0 = 'CC0 1.0';
const CC0_URL = 'https://creativecommons.org/publicdomain/zero/1.0/';
const YOIYAMI = 'Yoiyami';

/** The piece of the opening screen (the list of levels). */
export const OPENING: Piece = {
  id: 'first-light-particles',
  file: 'first-light-particles.mp3',
  title: 'First Light Particles',
  author: YOIYAMI,
  source:
    'https://opengameart.org/content/first-light-particles-%E2%80%93-cc0-atmospheric-pianoambient-track',
  licence: CC0,
  licenceUrl: CC0_URL,
  duration: 131.72,
  in: 0,
  // Harmony alike 0.972, both places at -19.4 dB.
  loopStart: 14.5,
  loopEnd: 82.44,
  exit: 117.72,
  end: 131.72,
  bpm: 63.0,
  tempoConfidence: 0.26,
  barSeconds: 3.81,
};

/** The pieces of play, which follow one another in an order that is drawn, not fixed. */
export const PLAY: readonly Piece[] = [
  {
    id: 'deep-blue',
    file: 'deep-blue.mp3',
    title: 'Yoiyami Core Theme – Deep Blue Ambient Piano',
    short: 'Deep Blue',
    author: YOIYAMI,
    source: 'https://opengameart.org/content/yoiyami-core-theme-%E2%80%93-deep-blue-ambient-piano',
    licence: CC0,
    licenceUrl: CC0_URL,
    duration: 234.96,
    // The first 15 s are an introduction at -25 to -44 dB with a near silence at its end; as an
    // opening that is a breath, in a join it is a hole. The piece is entered on the breath
    // before its first full phrase, which starts at 15.2 s (a rise of 23 dB in half a second).
    in: 14.6,
    // The place is a near silence (-41 dB) and the phrase starts 0.6 s later by itself.
    fadeIn: 0.4,
    lead: 0.6,
    // After the exit the piece falls by itself: -19, -23, -27, -31 dB second by second.
    settle: 2.5,
    // The loop starts at that same phrase: an entry "at the loop" would be this one again.
    midEntry: false,
    // Harmony alike 0.990, both places at -20.6 dB, onsets in step 0.54.
    loopStart: 14.73,
    loopEnd: 127.2,
    // The analysis offered the quiet point at 161.4 s; the one at 224 s is too near the end for
    // a whole crossfade, so the piece is left as its own ending begins.
    exit: 219.8,
    end: 232.82,
    bpm: 129.2,
    tempoConfidence: 0.61,
    barSeconds: 1.86,
  },
  {
    id: 'budding-of-consciousness',
    file: 'budding-of-consciousness.mp3',
    title: 'The Budding of Consciousness',
    author: YOIYAMI,
    source:
      'https://opengameart.org/content/the-budding-of-consciousness-%E2%80%93-cc0-ambient-minimalist-theme-yoiyami-blue-series-%E2%80%93-no4',
    licence: CC0,
    licenceUrl: CC0_URL,
    duration: 223.96,
    in: 0.09,
    // The file begins with a single note out of silence.
    fadeIn: 0.08,
    // After the exit comes the coda of single notes, 8 to 15 dB under the body.
    settle: 2.0,
    // Harmony alike 0.988, places at -16.1 and -16.2 dB, onsets in step 0.77.
    loopStart: 61.09,
    loopEnd: 182.56,
    // The body of the piece ends at 202 s (-18 dB); what follows is a coda of single notes
    // (204.9, 207.2, 210.6 s) with near silences between them. The piece was left in the
    // middle of that coda, at its quietest point (-34 dB), which made a hole of every join out
    // of it. It is left as the body ends, and the coda sounds under the fade.
    exit: 201.6,
    // Its loop is entered in the middle of a phrase (-15 dB on both sides of the place).
    midEntry: false,
    // The file as shipped peaks at 1.05 of full scale when decoded: 0.5 dB off.
    gain: 0.944,
    end: 222.77,
    bpm: 69.8,
    tempoConfidence: 0.67,
    barSeconds: 3.44,
  },
  {
    id: 'starfield-romance',
    file: 'starfield-romance.mp3',
    title: 'Starfield Romance',
    author: YOIYAMI,
    source:
      'https://opengameart.org/content/starfield-romance-%E2%80%93-cc0-ambient-emotional-space-theme-yoiyami-blue-series-%E2%80%93-no3',
    licence: CC0,
    licenceUrl: CC0_URL,
    duration: 218.96,
    in: 0.46,
    // The file rises out of silence over its first two seconds by itself.
    fadeIn: 0.4,
    lead: 1.5,
    // After the exit the piece falls to -35 dB within three seconds.
    settle: 1.5,
    // Harmony alike 0.956, places at -21.6 and -21.5 dB.
    loopStart: 61.46,
    loopEnd: 182.74,
    // The body ends at 187 s (-18 dB) and falls to -35 dB by 190 s, where a long hushed ending
    // begins. The piece was left at that quiet point; it is left as the body ends, so that its
    // own fall is the start of the fade and not a silence before it.
    exit: 186.4,
    // Its loop is entered in the middle of a phrase (-24 dB before the place, -28 after).
    midEntry: false,
    // The loop starts in a hush (-24 to -28 dB for three seconds) and ends at -17 dB: with the
    // short fade the repeat fell 7.6 dB for those seconds. The end of the loop is carried over
    // them.
    loopFade: 6,
    end: 214.43,
    bpm: 92.3,
    tempoConfidence: 0.14,
    barSeconds: 2.6,
  },
  {
    id: 'sunset-plains',
    file: 'sunset-plains.mp3',
    title: 'Sunset Plains',
    author: YOIYAMI,
    source: 'https://opengameart.org/content/sunset-plains',
    licence: CC0,
    licenceUrl: CC0_URL,
    duration: 329.68,
    // The file swells from nothing over its first seven seconds (-54 dB to -18 dB); it is
    // entered at -25 dB, two seconds before it is up.
    in: 5.0,
    fadeIn: 2.5,
    lead: 2.0,
    // The piece holds its full level for six seconds past the exit.
    settle: 5.5,
    // Its loop is entered in the middle of a phrase (-17 dB before the place, -19 after).
    midEntry: false,
    // Harmony alike 0.974, places at -19.0 and -19.3 dB.
    loopStart: 45.47,
    loopEnd: 241.81,
    // The piece has no quiet point near its end: it plays at full level to 322 s and dies away
    // in its last eight. It is left just before that, so that its own ending is the fade.
    exit: 316.0,
    end: 329.68,
    bpm: 80.7,
    tempoConfidence: 0.71,
    barSeconds: 2.97,
  },
];

/** Everything that is credited on the page. */
export const CREDITS: readonly {
  readonly title: string;
  readonly author: string;
  readonly source: string;
  readonly licence: string;
  readonly licenceUrl: string;
  readonly use: string;
}[] = [
  { ...OPENING, use: 'Opening screen' },
  ...PLAY.map((piece) => ({ ...piece, use: 'While loading' })),
];

/**
 * How well the harmony of the place one piece is left at sits with the place another is entered
 * at, 0 to 1: the cosine of their pitch-class profiles over the ten seconds from the exit and
 * from the entry, measured by `scripts/audio-joins.ts` on 11 October 2026. No pair of these
 * pieces agrees (they are in different keys), which is why none is crossfaded: a pair would
 * have to reach `agreeFrom` of the sequencer's options for that.
 */
export const AGREEMENT: { readonly [pair: string]: number } = {
  'deep-blue>budding-of-consciousness': 0.128,
  'deep-blue>starfield-romance': 0.574,
  'deep-blue>sunset-plains': 0.02,
  'budding-of-consciousness>deep-blue': 0.339,
  'budding-of-consciousness>starfield-romance': 0.131,
  'budding-of-consciousness>sunset-plains': 0.185,
  'starfield-romance>deep-blue': 0.66,
  'starfield-romance>budding-of-consciousness': 0.417,
  'starfield-romance>sunset-plains': 0.032,
  'sunset-plains>deep-blue': 0.305,
  'sunset-plains>budding-of-consciousness': 0.772,
  'sunset-plains>starfield-romance': 0.183,
};

/**
 * What is left of two unrelated harmonies sounding together in each change of piece as it is
 * now joined, in seconds ("clash" of `scripts/audio/../audio-joins.ts`: the seconds both pieces
 * sound within 9 dB of each other, times one less their agreement), measured on 11 October
 * 2026. The order of the pieces leans to the cleaner changes, and a pair over `CLASH_LIMIT` is
 * not played back to back.
 */
export const CLASH: { readonly [pair: string]: number } = {
  'deep-blue>budding-of-consciousness': 1.09,
  'deep-blue>starfield-romance': 0.74,
  'deep-blue>sunset-plains': 0.98,
  'budding-of-consciousness>deep-blue': 0.5,
  'budding-of-consciousness>starfield-romance': 1.09,
  'budding-of-consciousness>sunset-plains': 0.82,
  'starfield-romance>deep-blue': 0.43,
  'starfield-romance>budding-of-consciousness': 1.17,
  'starfield-romance>sunset-plains': 0.97,
  'sunset-plains>deep-blue': 1.39,
  'sunset-plains>budding-of-consciousness': 0.51,
  'sunset-plains>starfield-romance': 1.84,
};
export const CLASH_LIMIT = 1.5;

/**
 * The cue points that differed on the morning of 11 October 2026, when every piece was left at
 * a quiet point near its ending and entered from as early as it sounded. Kept so that the joins
 * of that morning can be measured beside the present ones (`FIRST_OPTIONS` of the sequencer).
 */
export const FIRST_CUES: { readonly [id: string]: { readonly in: number; readonly exit: number } } =
  {
    'deep-blue': { in: 12.0, exit: 219.8 },
    'budding-of-consciousness': { in: 0.09, exit: 209.07 },
    'starfield-romance': { in: 0.46, exit: 191.0 },
    'sunset-plains': { in: 4.0, exit: 316.0 },
  };

/** Where the files are served from. */
export const AUDIO_BASE = '/audio/';
