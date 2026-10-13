#!/bin/bash
# The soundtrack: 'The Budding of Consciousness' (Yoiyami, CC0). The track has two big entries,
# at 55.05 s and, after a break, at 109.5 s; the video is cut so that the cut to the real test wash
# and the chapter 'The AI test' are as far apart, and the track is started so that they fall on
# them. The
# music sinks while the wash runs, as the game's does. Then the gain envelope, then a static gain
# to -16 LUFS integrated and a -1.5 dBTP limiter. Scene times come from the timeline itself.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$HERE/build"
OUT=${1:-$HERE/build/music.wav}
TRACK=${TRACK:-$HERE/../../../../apps/web/public/audio/budding-of-consciousness.mp3}
read T_REAL T_ENTRY T_WASH T_SCORE T_AI DUR < <(node --input-type=module -e "
import { pathToFileURL } from 'node:url';
const T = await import(pathToFileURL('$HERE/timeline.js').href);
const s = Object.fromEntries(T.SHOTS.map((x) => [x.name, x.start]));
console.log([s.real, s.realwash, s.wash, s.score, s.models, T.DURATION].map((v) => v.toFixed(3)).join(' '));")
[ -n "$DUR" ] || { echo "mix_audio: could not read the scene times of timeline.js (run manifest.py first)" >&2; exit 1; }
python3 -c "assert abs((109.5 - 55.05) - ($T_AI - $T_ENTRY)) < 0.05, 'the cuts no longer fall on the music'"
SS=$(python3 -c "print(round(55.05 - $T_ENTRY, 3))")
FADE=$(python3 -c "print(round($DUR - 2.5, 3))")
# +6 dB over the quiet opening of the track, down to 0 for its entry; -6 dB while the wash runs.
DB=$(python3 -c "
r, w, s, x = $T_ENTRY, $T_WASH, $T_SCORE, 1 / 3
print(f'if(lt(t,{r - 1.5:.3f}),6,if(lt(t,{r:.3f}),6-6*(t-{r - 1.5:.3f})/1.5,if(lt(t,{w:.3f}),0,if(lt(t,{w + x:.3f}),-6*(t-{w:.3f})/{x:.4f},if(lt(t,{s:.3f}),-6,if(lt(t,{s + x:.3f}),-6+6*(t-{s:.3f})/{x:.4f},0))))))')")
echo "track from $SS s, $DUR s; entries at video $T_ENTRY and $T_AI"
TMP=$(mktemp -d)
ffmpeg -y -loglevel error -ss $SS -t $DUR -i "$TRACK" -af "aresample=48000,volume='pow(10,($DB)/20)':eval=frame,afade=t=in:st=0:d=0.1333,afade=t=out:st=$FADE:d=2.5" -c:a pcm_s24le $TMP/env.wav
I=$(ffmpeg -hide_banner -i $TMP/env.wav -af loudnorm=print_format=json -f null - 2>&1 | python3 -c "import sys,json; t=sys.stdin.read(); j=json.loads(t[t.rindex('{'):]); print(j['input_i'])")
G=$(python3 -c "print(round(-16-($I),2))")
echo "measured $I LUFS, gain $G dB"
ffmpeg -y -loglevel error -i $TMP/env.wav -af "volume=${G}dB,alimiter=limit=0.84:attack=5:release=50:level=false" -c:a pcm_s24le "$OUT"
ffmpeg -hide_banner -i "$OUT" -af loudnorm=print_format=json -f null - 2>&1 | python3 -c "import sys,json; t=sys.stdin.read(); j=json.loads(t[t.rindex('{'):]); print('final', j['input_i'], 'LUFS, true peak', j['input_tp'], 'LRA', j['input_lra'])"
rm -rf $TMP
