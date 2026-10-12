/**
 * Voices that stream from `<audio>` elements, for the live page.
 *
 * Decoding the whole set into buffers would hold some 400 MB of samples; an element decodes as
 * it plays and holds a few seconds. Each file is fetched once as its compressed bytes (a blob,
 * 2 to 5 MB) so that any place in it can be reached at once, whatever the server does about
 * byte ranges. An element cannot be started on an exact sample, and does not need to be: it is
 * started up to a second and a half early, under a gain that is still at silence, and the fade
 * that follows is scheduled on the audio clock.
 */

import { AUDIO_BASE } from './manifest.ts';
import type { Voice, VoiceSource } from './mixer.ts';

/** Seconds before its fade that an element starts playing, in silence. */
const LEAD = 1.5;

interface Channel {
  readonly element: HTMLAudioElement;
  readonly node: MediaElementAudioSourceNode;
}

export class ElementSource implements VoiceSource {
  private readonly urls = new Map<string, string>();
  private readonly fetching = new Map<string, Promise<void>>();
  private readonly idle: Channel[] = [];
  private readonly busy = new Set<HTMLAudioElement>();

  /** Where each element in use has got to in its file, for the page's account of itself. */
  positions(): { seconds: number; paused: boolean }[] {
    return [...this.busy].map((e) => ({ seconds: e.currentTime, paused: e.paused }));
  }

  constructor(private readonly context: AudioContext) {}

  prepare(file: string): Promise<void> {
    if (this.urls.has(file)) return Promise.resolve();
    let pending = this.fetching.get(file);
    if (pending === undefined) {
      pending = fetch(AUDIO_BASE + file)
        .then((response) => {
          if (!response.ok) throw new Error(`audio: ${file}: ${response.status}`);
          return response.arrayBuffer();
        })
        .then((bytes) => {
          this.urls.set(file, URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' })));
        })
        .finally(() => this.fetching.delete(file));
      this.fetching.set(file, pending);
    }
    return pending;
  }

  ready(file: string): boolean {
    return this.urls.has(file);
  }

  play(file: string, offset: number, at: number, duration: number, into: AudioNode): Voice {
    const context = this.context;
    const channel = this.idle.pop() ?? this.create();
    const { element, node } = channel;
    const lead = Math.min(LEAD, offset);
    element.src = this.urls.get(file) ?? '';
    element.currentTime = offset - lead;
    node.connect(into);
    this.busy.add(element);

    let released = false;
    let stopTimer = 0;
    const release = (): void => {
      if (released) return;
      released = true;
      window.clearTimeout(startTimer);
      window.clearTimeout(stopTimer);
      element.pause();
      node.disconnect();
      element.removeAttribute('src');
      element.load();
      this.busy.delete(element);
      this.idle.push(channel);
    };
    const startTimer = window.setTimeout(
      () => {
        if (released) return;
        // Where the file should be by now, however late the timer fired.
        const position = Math.max(0, offset + (context.currentTime - at));
        if (Math.abs(element.currentTime - position) > 0.05) element.currentTime = position;
        void element.play().catch(() => undefined);
      },
      Math.max(0, (at - lead - context.currentTime) * 1000),
    );
    const stopAt = (when: number): void => {
      window.clearTimeout(stopTimer);
      stopTimer = window.setTimeout(
        release,
        Math.max(0, (when - context.currentTime) * 1000) + 250,
      );
    };
    stopAt(at + duration);
    return { stop: stopAt };
  }

  private create(): Channel {
    const element = new Audio();
    element.preload = 'auto';
    return { element, node: this.context.createMediaElementSource(element) };
  }
}
