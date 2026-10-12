"""Finds where each piece of music may be entered, looped and left.

    python3 -I analyse-music.py <file.mp3>...

For every file it prints one JSON object: the duration, the tempo (from the autocorrelation of
the spectral flux, with a confidence: these pieces have no percussion, so the pulse is weak and
the figure is a guide only), the bar length that tempo implies in 4/4, the quiet points (local
minima of the loudness), and the cue points the page's manifest (src/audio/manifest.ts) carries:

  in       where the piece starts sounding (leading silence skipped)
  loop     a pair of times [start, end] at least 40 s apart at which the music is alike in
           harmony (chroma) and in level over the length of a crossfade, so that fading from
           `end` back into `start` is hard to hear as a join; the end is then moved by up to
           half a second to where the note onsets of the two places fall together
  exit     the latest quiet point after the loop from which a full crossfade still fits before
           the piece's own ending
  end      where the piece's own last sound dies away

The file is decoded by ffmpeg and read as raw samples; only numpy is needed.
"""

import json
import subprocess
import sys

import numpy as np

SR = 22050
HOP = 512
NFFT = 2048
XF = 8.0  # the crossfade the cue points are scored for, seconds


def decode(path):
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', path, '-map', '0:a:0', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
        check=True,
        capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32)


def stft(x):
    n = 1 + (len(x) - NFFT) // HOP
    window = np.hanning(NFFT).astype(np.float32)
    out = np.empty((n, NFFT // 2 + 1), dtype=np.float32)
    for start in range(0, n, 4096):
        stop = min(n, start + 4096)
        idx = np.arange(start, stop)[:, None] * HOP + np.arange(NFFT)[None, :]
        out[start:stop] = np.abs(np.fft.rfft(x[idx] * window, axis=1))
    return out


def smooth(v, n):
    return np.convolve(v, np.ones(n) / n, mode='same')


def analyse(path):
    x = decode(path)
    duration = len(x) / SR
    mag = stft(x)
    fps = SR / HOP
    t = np.arange(len(mag)) * HOP / SR

    # Loudness: RMS per frame, smoothed over 2 s, in dB.
    frames = np.lib.stride_tricks.sliding_window_view(x, NFFT)[::HOP][: len(mag)]
    rms = np.sqrt(np.mean(frames.astype(np.float64) ** 2, axis=1))
    level = 20 * np.log10(np.maximum(smooth(rms, int(2 * fps)), 1e-6))
    sounding = np.nonzero(20 * np.log10(np.maximum(rms, 1e-6)) > -48)[0]
    t_in = max(0.0, float(t[sounding[0]]) - 0.1)
    t_end = min(duration, float(t[sounding[-1]]) + 0.3)
    body = level[(t > t_in + 5) & (t < t_end - 5)]
    median = float(np.median(body))

    # Tempo: autocorrelation of the spectral flux between 50 and 160 beats a minute.
    flux = np.maximum(0, np.diff(np.log1p(100 * mag), axis=0)).sum(axis=1)
    flux = flux - smooth(flux, int(fps))
    ac = np.correlate(flux, flux, mode='full')[len(flux) - 1 :]
    lo, hi = int(fps * 60 / 160), int(fps * 60 / 50)
    lag = lo + int(np.argmax(ac[lo:hi]))
    bpm = 60 * fps / lag
    confidence = float(ac[lag] / ac[0])

    # Quiet points: local minima of the loudness at least 2 dB under the median, 6 s apart.
    quiet = []
    reach = int(3 * fps)
    for i in range(reach, len(level) - reach):
        if t[i] < t_in + 8 or t[i] > t_end - 8:
            continue
        if level[i] == level[i - reach : i + reach + 1].min() and level[i] < median - 2:
            if not quiet or t[i] - quiet[-1][0] > 6:
                quiet.append((float(t[i]), float(level[i])))

    # Chroma, to compare the harmony of two places.
    freqs = np.fft.rfftfreq(NFFT, 1 / SR)
    keep = (freqs > 60) & (freqs < 4000)
    pitch = np.round(12 * np.log2(freqs[keep] / 440.0)).astype(int) % 12
    chroma = np.zeros((len(mag), 12), dtype=np.float64)
    power = mag[:, keep].astype(np.float64) ** 2
    for p in range(12):
        chroma[:, p] = power[:, pitch == p].sum(axis=1)

    def window(at, length=XF):
        a, b = int(at * fps), int((at + length) * fps)
        c = chroma[a:b].sum(axis=0)
        return c / (np.linalg.norm(c) + 1e-12), float(level[a:b].mean())

    # Loop: every pair (start, end) on a half-second grid; alike in harmony and level, both quiet.
    best = None
    grid = np.arange(t_in + 8, t_end - XF - 12, 0.5)
    windows = [window(g) for g in grid]
    for i, a in enumerate(grid):
        if a > t_in + 0.5 * (t_end - t_in):
            break
        for j in range(i + 1, len(grid)):
            b = grid[j]
            if b - a < max(40.0, 0.3 * (t_end - t_in)):
                continue
            (ca, la), (cb, lb) = windows[i], windows[j]
            likeness = float(ca @ cb)
            score = likeness - 0.02 * abs(la - lb) - 0.01 * max(0.0, max(la, lb) - median) + 0.0005 * (b - a)
            if best is None or score > best[0]:
                best = (score, float(a), float(b), likeness, la, lb)
    _, loop_start, loop_end, likeness, la, lb = best

    # Where there is a pulse, the two places should be in step: move the end by up to half a
    # second to where the note onsets of the two crossfade windows line up best.
    n = int(XF * fps)
    a0 = int(loop_start * fps)
    ref = flux[a0 : a0 + n]
    step, step_score = 0, -1.0
    for shift in range(-int(0.5 * fps), int(0.5 * fps) + 1):
        b0 = int(loop_end * fps) + shift
        other = flux[b0 : b0 + n]
        r = float(ref @ other / (np.linalg.norm(ref) * np.linalg.norm(other) + 1e-12))
        if r > step_score:
            step, step_score = shift, r
    loop_end += step / fps

    # Exit: the latest quiet point after the loop that leaves a whole crossfade before the end.
    after = [q for q in quiet if q[0] >= loop_end + XF and q[0] <= t_end - XF - 2]
    exit_at = after[-1][0] if after else max(loop_end + XF, t_end - XF - 6)

    return {
        'file': path.rsplit('/', 1)[-1],
        'duration': round(duration, 2),
        'bpm': round(bpm, 1),
        'tempo_confidence': round(confidence, 3),
        'bar_s': round(4 * 60 / bpm, 2),
        'median_level_db': round(median, 1),
        'level_p10_p90_db': [round(float(np.percentile(body, 10)), 1), round(float(np.percentile(body, 90)), 1)],
        'quiet': [[round(q[0], 1), round(q[1], 1)] for q in quiet],
        'in': round(t_in, 2),
        'loop': [round(loop_start, 2), round(loop_end, 2)],
        'loop_likeness': round(likeness, 3),
        'loop_onset_match': round(step_score, 3),
        'loop_levels_db': [round(la, 1), round(lb, 1)],
        'exit': round(exit_at, 2),
        'exit_level_db': round(window(exit_at)[1], 1),
        'end': round(t_end, 2),
        'level_first_10s_db': round(window(t_in, 10)[1], 1),
        'level_last_10s_db': round(window(max(0, t_end - 10), 10)[1], 1),
    }


for name in sys.argv[1:]:
    print(json.dumps(analyse(name)), flush=True)
