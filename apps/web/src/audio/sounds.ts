/**
 * The game's own sounds, made by synthesis when they are wanted: no files. They are off until
 * the player turns them on, and they are quiet: a clink is some 20 dB under the music's peaks.
 *
 *   clink   a piece has come to rest: two short high partials an inharmonic interval apart (as
 *           struck china rings) over a tick of filtered noise, a little different each time
 *   door    the door opens or shuts: a soft low thud of filtered noise
 */

export class Sounds {
  private noise: AudioBuffer | null = null;

  constructor(
    private readonly context: BaseAudioContext,
    private readonly out: AudioNode,
    private readonly random: () => number,
  ) {}

  play(sound: 'clink' | 'door', at: number): void {
    if (sound === 'clink') this.clink(at);
    else this.door(at);
  }

  private noiseBuffer(): AudioBuffer {
    if (this.noise === null) {
      const context = this.context;
      this.noise = context.createBuffer(
        1,
        Math.floor(context.sampleRate * 0.5),
        context.sampleRate,
      );
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = this.random() * 2 - 1;
    }
    return this.noise;
  }

  private clink(at: number): void {
    const context = this.context;
    const base = 1900 * (0.85 + 0.4 * this.random());
    for (const [ratio, level, decay] of [
      [1, 0.03, 0.16],
      [1.59, 0.018, 0.1],
      [2.71, 0.008, 0.06],
    ] as const) {
      const tone = context.createOscillator();
      tone.type = 'sine';
      tone.frequency.value = base * ratio;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(level, at + 0.003);
      gain.gain.setTargetAtTime(0, at + 0.003, decay / 3);
      tone.connect(gain).connect(this.out);
      tone.start(at);
      tone.stop(at + decay * 4);
    }
    const tick = context.createBufferSource();
    tick.buffer = this.noiseBuffer();
    const band = context.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 3200;
    band.Q.value = 1.2;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.02, at + 0.002);
    gain.gain.setTargetAtTime(0, at + 0.002, 0.008);
    tick.connect(band).connect(gain).connect(this.out);
    tick.start(at, this.random() * 0.3, 0.08);
  }

  private door(at: number): void {
    const context = this.context;
    const thud = context.createBufferSource();
    thud.buffer = this.noiseBuffer();
    const low = context.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 160;
    low.Q.value = 0.7;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.22, at + 0.012);
    gain.gain.setTargetAtTime(0, at + 0.012, 0.05);
    thud.connect(low).connect(gain).connect(this.out);
    thud.start(at, this.random() * 0.1, 0.4);
  }
}
