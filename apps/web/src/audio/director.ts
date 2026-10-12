/**
 * What the music and the sounds do about the game, as plain logic: the page's account of itself
 * goes in, a list of things for the mixer to do comes out. No Web Audio, no DOM.
 *
 *   - The list of levels has its own piece; a session has the mix of play.
 *   - While the wash runs the music drops and thins; when the report arrives it comes back up
 *     and opens out again. That swell of the music itself is what marks the report.
 *   - Placing a piece changes nothing in the music. If the game's own sounds are on, a piece
 *     that has come to rest clinks once, and the door thuds when it opens or shuts.
 */

/** What the director reads off the page each time it looks. */
export interface GameSnapshot {
  /** The list of levels is up, or no session is open. */
  readonly menu: boolean;
  /** 'loading', 'washing', 'finished', or null without a session. */
  readonly phase: string | null;
  /** The wash job, if one was started: 'queued', 'running', 'done' or 'failed'. */
  readonly washStatus: string | null;
  readonly hasReport: boolean;
  /** How many pieces are in the machine. */
  readonly placed: number;
  /** Whether the page is still playing a movement. */
  readonly animating: boolean;
  readonly doorShut: boolean;
}

export type Scene = 'menu' | 'play';

export type Cue =
  | { readonly do: 'scene'; readonly scene: Scene }
  | { readonly do: 'duck'; readonly on: boolean }
  | { readonly do: 'sound'; readonly sound: 'clink' | 'door' };

/** Whether the music should be held down: a wash is on its way or running and no report yet. */
export function washing(snapshot: GameSnapshot): boolean {
  if (snapshot.menu || snapshot.hasReport) return false;
  if (snapshot.phase === 'washing') return true;
  return snapshot.washStatus === 'queued' || snapshot.washStatus === 'running';
}

/** Turns successive snapshots into cues. The first snapshot sets the scene and nothing else. */
export class Director {
  private previous: GameSnapshot | null = null;
  private scene: Scene | null = null;
  private ducked = false;
  /** Pieces placed since the last clink that have not yet come to rest. */
  private settling = false;

  observe(snapshot: GameSnapshot): Cue[] {
    const cues: Cue[] = [];
    const previous = this.previous;
    this.previous = snapshot;

    const scene: Scene = snapshot.menu ? 'menu' : 'play';
    const sceneChanged = scene !== this.scene;
    if (sceneChanged) {
      this.scene = scene;
      cues.push({ do: 'scene', scene });
    }

    const duck = washing(snapshot);
    if (duck !== this.ducked) {
      this.ducked = duck;
      cues.push({ do: 'duck', on: duck });
    }

    // Only what happens while someone is watching makes a sound: not the state a session is
    // resumed in, and not the jump from one session to another.
    if (previous === null || sceneChanged || scene === 'menu') {
      this.settling = false;
      return cues;
    }

    if (snapshot.placed === previous.placed + 1) this.settling = true;
    else if (snapshot.placed !== previous.placed) this.settling = false;
    if (this.settling && !snapshot.animating) {
      this.settling = false;
      cues.push({ do: 'sound', sound: 'clink' });
    }
    if (snapshot.doorShut !== previous.doorShut) cues.push({ do: 'sound', sound: 'door' });
    return cues;
  }
}
