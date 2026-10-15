#!/bin/sh
# Films every clip the video uses, from the game server at $SPOTLESS_SERVER (default
# http://127.0.0.1:8787), into $SPOTLESS_VIDEO_CLIPS (default .spotless/video/clips at the root of
# the repository). About two hours on four CPU cores with software WebGL, washes included.
set -e
# A relative clips directory is taken from where the script is run, before it changes directory.
if [ -n "$SPOTLESS_VIDEO_CLIPS" ]; then mkdir -p "$SPOTLESS_VIDEO_CLIPS"; SPOTLESS_VIDEO_CLIPS=$(cd "$SPOTLESS_VIDEO_CLIPS" && pwd); fi
cd "$(dirname "$0")"
OUT=${SPOTLESS_VIDEO_CLIPS:-../../../../.spotless/video/clips}
mkdir -p "$OUT"

# The seven tutorial items of apps/web/scripts/play-wash.ts, loaded badly and well, each then
# washed at the quick-preview tier. The bad load was filmed without following the lower basket in.
# (Each run's output goes to a log first, so that a failure stops the script.)
node play.mjs --plan bad --follow 0 --out "$OUT/bad-load" --hold 10 --wash fast > "$OUT/bad-load.log"
node play.mjs --plan good --out "$OUT/good-load" --hold 10 --wash fast > "$OUT/good-load.log"
BAD=$(awk '/^session/ {print $2}' "$OUT/bad-load.log")
GOOD=$(awk '/^session/ {print $2}' "$OUT/good-load.log")
[ -n "$BAD" ] && [ -n "$GOOD" ]

# Level 7 as the scripted careful player loaded it, replayed from its saved log.
DP=$(node replay.mjs dinner-party-careful)
node shoot.mjs --sid "$DP" --mode orbit --out "$OUT/dp-hero" --frames 165 \
  --path '[{"view":"orbit","zoom":0.84,"az":-74,"el":31,"shift":[0,0.05,0]},{"view":"orbit","zoom":0.66,"az":-36,"el":40,"shift":[0,0.08,0.02]}]'

# The mug of each load after its wash, in the page's "Look closely" inspector, on the same path
# (the bad load's mug in more frames: it is on screen longer, and footage plays one frame a frame).
node wait-wash.mjs "$BAD" "$GOOD"
for S in "mug-turntable-slow:216:$BAD" "good-mug-turntable:150:$GOOD"; do
  ID=${S%%:*}; REST=${S#*:}
  node shoot.mjs --sid "${REST#*:}" --mode inspect --item mug_01 --out "$OUT/$ID" --frames "${REST%%:*}" \
    --turn 300 --az -110 --el 58 --el-end 30 --bg '#ecd0ad'
done
echo "clips in $OUT"
