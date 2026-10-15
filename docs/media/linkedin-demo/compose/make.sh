#!/bin/sh
# Builds the video from the clips: stills, clip manifest, soundtrack, then every frame.
#   ./make.sh [<clips directory>]       (default: $SPOTLESS_VIDEO_CLIPS, else .spotless/video/clips at
#                                        the repository root)
# Writes build/dishwasherbench-linkedin.mp4. About ten minutes on four cores.
set -e
# A relative clips directory is taken from where the script is run, before it changes directory.
if [ $# -gt 0 ]; then CLIPS=$(cd "$1" && pwd); set -- "$CLIPS"
elif [ -n "${SPOTLESS_VIDEO_CLIPS:-}" ]; then CLIPS=$(cd "$SPOTLESS_VIDEO_CLIPS" && pwd); set -- "$CLIPS"; fi
cd "$(dirname "$0")"
python3 prep.py
python3 manifest.py "$@"
./mix_audio.sh
node render.mjs --workers 3 --mux build/music.wav
