/**
 * The sound control: one button at the right of the top bar, a small panel under it (music on
 * or off, volume, the game's own sounds on or off, what is playing) and the credits.
 *
 * The page redraws its top bar from scratch whenever the game changes, so the button puts
 * itself back each time; the panels hang off the document and are not touched by that.
 */

import { CREDITS, type Piece } from './manifest.ts';
import type { MusicStatus } from './mixer.ts';
import type { SoundSettings } from './settings.ts';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Readonly<Record<string, string>> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  element.append(...children);
  return element;
}

export class SoundControl {
  private readonly button = el('button', { id: 'sound-control', type: 'button' });
  private readonly music = el('input', { type: 'checkbox', id: 'sound-music' });
  private readonly sounds = el('input', { type: 'checkbox', id: 'sound-sounds' });
  private readonly volume = el('input', {
    type: 'range',
    id: 'sound-volume',
    min: '0',
    max: '1',
    step: '0.01',
    'aria-label': 'Volume',
  });
  private readonly now = el('div', { class: 'now', id: 'sound-now' });
  private readonly next = el('div', { class: 'now', id: 'sound-next' });
  private readonly skip = el(
    'button',
    {
      type: 'button',
      id: 'sound-skip',
      title:
        'Jumps to ten seconds before the end of this piece, so that the change into the next one is heard as it comes of itself: for hearing the changes one after another.',
    },
    'Go to next change',
  );
  private readonly heard = el('ol', { id: 'sound-heard' });
  private readonly heardBox = el(
    'div',
    { id: 'sound-heard-box', hidden: '' },
    el('div', { class: 'now' }, 'Last changes (newest first):'),
    this.heard,
  );
  private readonly panel: HTMLElement;
  private readonly credits: HTMLElement;

  constructor(
    private settings: SoundSettings,
    skipNow: () => void,
    private readonly changed: (settings: SoundSettings) => void,
  ) {
    const creditsButton = el('button', { type: 'button', id: 'sound-credits-open' }, 'Credits');
    this.panel = el(
      'div',
      { id: 'sound-panel', hidden: '', role: 'dialog', 'aria-label': 'Sound' },
      el('label', {}, this.music, 'Music'),
      el('label', {}, 'Volume', this.volume),
      el('label', {}, this.sounds, 'Sounds of the machine'),
      this.now,
      el('div', { class: 'row' }, this.next, this.skip),
      this.heardBox,
      el('div', { class: 'row' }, el('span', {}), creditsButton),
    );
    this.skip.disabled = true;
    this.skip.addEventListener('click', skipNow);
    const close = el('button', { type: 'button' }, 'Close');
    this.credits = el(
      'div',
      { id: 'sound-credits', hidden: '', role: 'dialog', 'aria-label': 'Credits' },
      el('h2', {}, 'Music and sound'),
      el(
        'ul',
        {},
        ...CREDITS.map((credit) =>
          el(
            'li',
            {},
            el('a', { href: credit.source, target: '_blank', rel: 'noopener' }, credit.title),
            el(
              'span',
              {},
              `${credit.author} · ${credit.use} · `,
              el(
                'a',
                { href: credit.licenceUrl, target: '_blank', rel: 'noopener' },
                credit.licence,
              ),
            ),
          ),
        ),
      ),
      el(
        'p',
        { class: 'muted' },
        'All of it is in the public domain (CC0). The clink and the door are made by the page. Sources and checksums: ',
        el('a', { href: '/audio/LICENSES.md', target: '_blank', rel: 'noopener' }, 'LICENSES.md'),
        '.',
      ),
      el('p', {}, close),
    );
    document.body.append(this.panel, this.credits);

    this.button.addEventListener('click', () => this.toggle(this.panel));
    creditsButton.addEventListener('click', () => {
      this.panel.hidden = true;
      this.toggle(this.credits);
    });
    close.addEventListener('click', () => (this.credits.hidden = true));
    this.music.addEventListener('change', () => this.set({ music: this.music.checked }));
    this.sounds.addEventListener('change', () => this.set({ sounds: this.sounds.checked }));
    this.volume.addEventListener('input', () => this.set({ volume: Number(this.volume.value) }));
    document.addEventListener('pointerdown', (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (this.button.contains(target)) return;
      if (!this.panel.contains(target)) this.panel.hidden = true;
      if (!this.credits.contains(target) && !this.panel.contains(target))
        this.credits.hidden = true;
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      this.panel.hidden = true;
      this.credits.hidden = true;
    });
    this.show();
  }

  /** Keeps the button at the right of the page's top bar, however often the bar is redrawn. */
  attach(bar: HTMLElement): void {
    const place = (): void => {
      if (this.button.parentElement !== bar || bar.lastElementChild !== this.button) {
        bar.append(this.button);
      }
    };
    place();
    new MutationObserver(place).observe(bar, { childList: true });
  }

  /**
   * Says what is playing, what comes next and in how long, and which changes were heard last,
   * so that a change that sounded rough can be named ("that one"). Null: no music.
   */
  showMusic(status: MusicStatus | null): void {
    const short = (piece: Piece): string => piece.short ?? piece.title;
    const set = (element: HTMLElement, text: string): void => {
      if (element.textContent !== text) {
        element.textContent = text;
        element.title = text;
      }
    };
    const clock = (seconds: number): string => {
      const s = Math.max(0, Math.round(seconds));
      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    };
    const playing = status?.playing ?? null;
    set(this.now, playing === null ? '' : `Playing: ${short(playing)}`);
    const next = status?.next ?? null;
    set(this.next, next === null ? '' : `Next: ${short(next.piece)} in ${clock(next.seconds)}`);
    this.skip.disabled = status === null || !status.canSkip;
    const heard = status?.heard ?? [];
    this.heardBox.hidden = heard.length === 0;
    const lines = heard.map((h) => `${short(h.from)} → ${short(h.to)}, ${clock(h.ago)} ago`);
    const shown = [...this.heard.children].map((li) => li.textContent ?? '');
    if (lines.length !== shown.length || lines.some((line, i) => line !== shown[i])) {
      this.heard.replaceChildren(...lines.map((line) => el('li', {}, line)));
    }
  }

  private set(change: Partial<SoundSettings>): void {
    this.settings = { ...this.settings, ...change };
    this.show();
    this.changed(this.settings);
  }

  private show(): void {
    const { music, sounds, volume } = this.settings;
    this.music.checked = music;
    this.sounds.checked = sounds;
    if (Number(this.volume.value) !== volume) this.volume.value = String(volume);
    const off = !music && !sounds;
    this.button.textContent = off ? 'Sound: off' : 'Sound';
    this.button.classList.toggle('off', off);
    this.button.setAttribute('aria-haspopup', 'dialog');
  }

  private toggle(panel: HTMLElement): void {
    panel.hidden = !panel.hidden;
    if (panel.hidden) return;
    const box = this.button.getBoundingClientRect();
    panel.style.top = `${Math.round(box.bottom + 6)}px`;
    panel.style.right = `${Math.max(8, Math.round(window.innerWidth - box.right))}px`;
  }
}
