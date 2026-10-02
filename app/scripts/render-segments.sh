#!/bin/zsh
# Render the video in short segments (one Chrome at a time; a crash loses one segment, not the whole
# render), then concatenate and mux the song.
#   scripts/render-segments.sh <name> [render.ts video options...]
#   e.g. scripts/render-segments.sh draft --samples 1 --preset veryfast --crf 22
set -e
name=$1; shift
SEG=15
DUR=143 # the song (135 s) + the silent credit card (src/timeline.ts CREDITS)
# where the segments and the final file go (set MV_OUT to put big renders on another disk)
OUT=${MV_OUT:-../out}
[[ -d "$OUT" ]] || { echo "render output folder not found: $OUT"; exit 1; }
dir="$OUT/seg-$name"
mkdir -p "$dir"
: > "$dir/list.txt"
for ((a = 0; a < DUR; a += SEG)); do
  b=$((a + SEG > DUR ? DUR : a + SEG))
  f=$(printf "%s/%03d.mp4" "$dir" $a)
  if [[ ! -s "$f.done" ]]; then
    echo "segment $a-$b"
    bun scripts/render.ts video --from $a --to $b --noaudio "$@" --out "$f" 2>&1 | tr '\r' '\n' | grep -E "wrote|ERROR|error" || true
    [[ -s "$f" ]] && echo ok > "$f.done"
  fi
  echo "file '$(basename "$f")'" >> "$dir/list.txt"
done
ffmpeg -y -loglevel error -f concat -safe 0 -i "$dir/list.txt" -i ../audio/feeltheagi.wav -map 0:v -map 1:a -c:v copy -af apad -c:a aac -b:a 320k -shortest -movflags +faststart "$OUT/$name.mp4"
echo "wrote $OUT/$name.mp4"
