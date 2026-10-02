# AGENTS.md

Code-rendered music video for "Feel The AGI" (TypeScript + three.js in `app/`, deterministic in song
time, exported to 1080p60 with headless Chrome + ffmpeg).

- Engine guide: `docs/ENGINE.md`. Treatment: `docs/TREATMENT.md`.
- **Current task for outside agents: `docs/HANDOFF_3D.md`** — improve only the 3D vignettes of the
  verses (`app/src/scenes/grind.ts`, `_objects3d.ts`, `_stage3d.ts`). Do not change the timeline,
  lyric/beat data, typography or other scenes.
- Run only one render (one headless Chrome) at a time.
- `bunx tsc --noEmit -p .` in `app/` must stay clean.
