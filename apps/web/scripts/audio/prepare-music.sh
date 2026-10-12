#!/bin/sh
# Converts the downloaded originals into the files the page ships.
#
#   prepare-music.sh <incoming directory> <apps/web/public/audio>
#
# Each original is measured (EBU R128 integrated loudness), given one fixed gain that brings it to
# TARGET LUFS (no compression: the dynamics of a piece are left as its author made them) and
# encoded as MP3, 128 kbit/s, 48 kHz joint stereo, with every tag and picture stripped. Nothing in
# the incoming directory is executed; ffmpeg only reads the files named here.
set -eu
IN="$1"; OUT="$2"; TARGET=-18.0
conv() { # <source> <name> [bitrate]
  src="$IN/$1"; dst="$OUT/$2.mp3"; rate="${3:-128k}"
  i=$(ffmpeg -hide_banner -nostats -i "$src" -map 0:a:0 -af ebur128 -f null - 2>&1 | awk '/I:/{v=$2} END{print v}')
  g=$(awk -v i="$i" -v t="$TARGET" 'BEGIN{printf "%.2f", t-i}')
  ffmpeg -hide_banner -loglevel error -y -i "$src" -map 0:a:0 -map_metadata -1 -af "volume=${g}dB" \
    -ar 48000 -ac 2 -c:a libmp3lame -b:a "$rate" "$dst"
  echo "$2: measured $i LUFS, gain $g dB"
}
conv yoiyami_core_theme_0/yoiyami_core_theme_0.wav deep-blue
conv first_light_particles_0/first_light_particles_0.wav first-light-particles
conv starfield_romance1/starfield_romance1.wav starfield-romance
conv sunset_plains/sunset_plains.wav sunset-plains
conv the_budding_of_consciousness/the_budding_of_consciousness.wav budding-of-consciousness
