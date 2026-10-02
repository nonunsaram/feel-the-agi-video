# Feel The AGI — code-rendered music video

A music video for the song **"Feel The AGI"** (Korean hyperpop, 2:15) in which every frame is code: a
deterministic function of song time, synced to the sung syllables, rendered offline to 4K60.
Humans are special and not special; AI is a companion and the sum of human heritage — the video tells
that story with a pictogram person, liquid-gold type, a prism, a door of light and a legion of
small agents.

**Watch:** _TODO — link to the final video_

## Credits

| Role | Credit |
|---|---|
| **MUSIC** |  |
| Lyrics | 노는사람 (nonunsaram) |
| Topline melody | 노는사람 (nonunsaram) |
| Vocals · arrangement | Suno |
| **MUSIC VIDEO** |  |
| Creative direction · review | 노는사람 (nonunsaram) |
| Concept · treatment | Claude Opus 5.5 |
| Lyric & beat sync | Claude Opus 5.5 |
| Typography | Claude Opus 5.5 |
| 3D design · modeling | Claude Opus 5.5 |
| Shaders | Claude Opus 5.5 |
| Motion · camera | Claude Opus 5.5 |
| Rendering pipeline | Claude Opus 5.5 |
| Edit | Claude Opus 5.5 |
| **BUILT WITH** |  |
| Video engine | [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video) (MIT) |
| Rendering | three.js |
| Vocal alignment | Demucs · MMS-FA (torchaudio) · Whisper |
| Typefaces | LINE Seed KR · Noto Serif KR · Archivo · IBM Plex Mono · Cormorant Garamond |

The renderer core (`app/src/engine`), the render script and the analysis approach come from
pdoom-video; the song, timing data, treatment, timeline and every scene here are new. Made over 15
review rounds between the artist and Claude — `docs/` keeps the treatment and the plans.

## Layout

- `audio/feeltheagi.wav` — the song.
- `data/lyrics.json` — per-syllable lyric timings (63 lines). `data/audio.json` — beat grid
  (piecewise tempo: 150.27 BPM until 1:18, ~150.8 in the pre-hook, 151.94 from the build-up on),
  sections, drum/bass/vocal onsets, loudness envelopes.
- `analysis/` — Python (uv) tools that made the timing data:
  `ko_align.py` (Demucs vocal stem → MMS_FA CTC forced alignment of uroman-romanized Hangul
  syllables, cross-checked with Whisper, with the manual fixes listed at the top of the file),
  `analyze_ft.py` (beat grid, envelopes, onsets), `ov.py` (QA plots).
- `app/` — the renderer (TypeScript + three.js, bun + Vite).
  - `src/scenes/` — `whisper` (intro, pre-hook), `litany` (the three hooks), `grind` (the two verses),
    `door` (the build-up), `end` (outro), plus `_kit.ts` (syllable layout, caret/light layer, glitch
    compositor, sky) and `_clock.ts` (the countdown to dawn).
  - `src/timeline.ts` — the edit.
  - `scripts/render.ts` — offline renderer (headless Chrome → raw frames → ffmpeg).
- `out/` — renders and previews (not in the repo).

## Requirements

[bun](https://bun.sh), Google Chrome, ffmpeg with libx264. The analysis tools need
[uv](https://docs.astral.sh/uv/); the renderer doesn't.

## Preview

```sh
cd app
bun install
bunx vite
```

Open http://localhost:5173 (space = play/pause, ←/→ = ±1 s, `[`/`]` = previous/next scene, `l` = loop
the scene, `h` = hide the UI, `?t=90` starts at a time).

## Render

```sh
cd app
# final: 15 s segments, one headless Chrome at a time (resumable), muxed with the song.
# MV_OUT picks the output folder (default ../out); --scale 2 renders 3840×2160
MV_OUT=../out ./scripts/render-segments.sh feel-the-agi_2160p60 --scale 2 --samples 8 --shutter 0.25 --crf 16 --preset medium
bun scripts/render.ts video --samples auto --shutter 0.2 --out ../out/feel-the-agi.mp4   # single pass, 1080p60
bun scripts/render.ts video --samples 1 --preset veryfast --crf 22 --out ../out/draft.mp4 # quick draft
bun scripts/render.ts sheet --from 90 --to 103 --n 16 --cols 4 --out ../out/wip/door.png  # contact sheet
```

## Regenerate the timing data

```sh
cd analysis
uv sync
uv run python -m demucs -n htdemucs_ft -d mps -o stems ../audio/feeltheagi.wav
uv run python ctc_emissions.py && uv run python vocal_feats.py && uv run python whisper_ko.py
uv run python ko_align.py --plots    # data/lyrics.json + analysis/qa/line_*.png
uv run python analyze_ft.py --plots  # data/audio.json
```

## Licenses

- **Code**: MIT (see `LICENSE`; the original copyright of pdoom-video is kept).
- **The song** — `audio/feeltheagi.wav`, the lyrics and the melody — is **not** covered by the MIT
  license: © 노는사람 (nonunsaram), all rights reserved. It is included so the video can be rendered
  from this repository; please don't reuse or redistribute it.
- **Fonts** keep their own licenses (SIL Open Font License): Archivo, IBM Plex Mono, Cormorant
  Garamond, LINE Seed KR, Noto Serif KR, Pretendard, Hahmlet, Black Han Sans, Galmuri. The Korean fonts are
  subsets made by `analysis/make_kr_fonts.py`.
