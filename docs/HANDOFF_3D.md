# Handoff: improve the 3D vignettes (verse 1 / verse 2)

> 요약 (한국어): 이 문서는 다른 코딩 에이전트(Codex 등)가 **틀은 그대로 두고 3D 구간만** 개선하도록 쓴 인수인계서입니다. 대상은 1절(0:27–0:52)과 2절(1:43–2:08)의 3D 장면, 특히 에이전트 구간입니다. 타임라인·가사 싱크·타이포 그리드·후처리는 건드리지 않습니다.

This repo renders the music video for the song "Feel The AGI" (Korean hyperpop, 2:15) as code: a
TypeScript + three.js web app that draws any song time `t` deterministically and is exported to
1080p60 by headless Chrome + ffmpeg. Read `docs/ENGINE.md` for the engine API (scenes, frames,
audio/lyrics data, render commands). This file narrows that down to the one job you are here for.

## Your scope

**Improve the 3D staging of the verse scenes only.** The owner's verdict on the current state:
"the agent section still falls short, cuts feel unnatural, the building collapse lacks impact;
3D is the weakest part." Everything else in the video is close to final.

In scope (edit freely):
- `app/src/scenes/grind.ts` — the verse scene (both passes). The 3D parts: `build3D()`, the
  camera block in `render()` (`cams`, `CAM7`, `agentShot`), and the per-line functions `v1`…`v8`
  *except* their `this.put(...)` text calls.
- `app/src/scenes/_objects3d.ts` — the 3D props: `DeskCalendar`, `Camel`, `FigureSprite`, `Mask`,
  `Building`, `Agents`, cards, `contactShadow`.
- `app/src/scenes/_stage3d.ts` — `Stage3D` (studio env map, gold/paper/ink materials, lights,
  `look()`, `shiftX`). Change carefully: every 3D scene uses it.
- New helper files under `app/src/scenes/_*.ts` if you need them.

Out of scope (do not change):
- `app/src/timeline.ts` (scene windows), `data/*.json` (beat grid, lyric syllable timings),
  `analysis/` (the alignment pipeline).
- The typography: `layoutText()`, the grid (`this.X`, `this.Y`), `put()`/`set()`, fonts, sizes,
  colours. Verse type is white (night) / ink (day) with **no accent colours** — the owner asked
  for that explicitly.
- The other scenes (`whisper`, `litany`, `door`, `end`, `coldopen`), `engine/*`, post settings.
- The readouts drawn at the end of `render()` (top-left label, clock).

## Where the verse lives

| pass | timeline entry | window (s) | look |
|---|---|---|---|
| 1 (night) | `grind1` | 26.95 – 52.85 | paper type on ink, dark floor with faint gold grid, dawn sky behind |
| 2 (day, "after AGI") | `grind2` | ~103.3 – ~128.0 | ink type on paper, gold mirror floor |

Lines (both passes; times are when each line is sung — the scene cuts on the nearest downbeat
just before, see `this.cuts`):

| # | lyric | v1 night | v2 day | function / 3D now |
|---|---|---|---|---|
| 1 | 다 끝났다고 말해줄래 내일 | 27.06 | 103.52 | `v1`: night desk calendar turns 오늘→내일; day: a gold camel (pun "다 큰 낙타") walks in, turns its head to us on 내일 |
| 2 | 기다리고 있거든 매일 | 30.49 | 106.86 | `v2`: calendar pages race (8ths then 16ths); person sits on a chair. Day: countdown D-99→D-DAY, stops on 매일, pages fly off |
| 3 | 더 이상 찾기 싫어 새 일 | 33.70 | 110.08 | `v3`: notification cards stack; 싫어 flings them away (day: they drop into a gold tray) |
| 4 | 새 일자리 어디에 있지 | 36.80 | 113.12 | `v4`: rows of seated people, all seats taken; person walks past (day: a queue at an office building) |
| 5 | 하기 싫어 시키는 일만은 | 40.02 | 116.34 | `v5`: task cards rain down and glance off the person (arms crossed) |
| 6 | 그 자식들은 아직도 기만을 | 43.10 | 119.31 | `v6`: three people in gold smiling masks; masks shatter on 기·만·을 (day: thrown away to the left) |
| 7 | 나도 이제 밑에 agent | 46.42 | 122.63 | `v7`: **agents** — night: 나 on a gold plinth, round agents pop up below and double every 8th note from 밑; day: agents walk beside the person, doubling every 16th |
| 8 | 시켜서 태업 아님 폐업 | 49.60 | 125.76 | `v8`: night: agents freeze on 태, go dark one by one, a steel shutter drops half on 폐 and to the floor on 업. Day: a 9-floor building — top blown out on 폐, the rest pancakes on 업 |

Hard constraints from the song: the verse-2 scene ends ~0.4 s after 업 (the outro cuts on the
next kick), so anything that happens on 폐/업 must read within that time. Lines 5–8 of verse 2 are
a cappella (no kicks): no beat shake there.

## How the scene is built (read before editing)

- **Pure function of time.** `render(f)` must give the same frame for the same `f.t`, whatever was
  rendered before (the exporter seeks, renders sub-frames for motion blur, and renders segments
  in separate browser sessions). No accumulated state, no `Math.random()` — use `hash(i, k)` from
  `engine/util.ts` for per-object randomness, and compute every position from `t` directly
  (see `ballistic()` in `_stage3d.ts` for bounces).
- **Sync = syllable times, never seconds.** Use the helpers in `grind.ts`:
  `this.first('7b').t0`, `this.last('8d').t0`, `this.syl('8a', 3).t0` (syllable times from the
  aligned lyrics; the keys are the text rows from `layoutText()`), `this.beats(t, t0)`
  (beats elapsed), `this.beatT(t0, k)` (time of beat t0+k), `f.beat`, `beatPulse(f.beat)`,
  `pulse(t, tHit, halfLife)`, `burst(...)`. `this.cuts[v]` is when line v's shot starts.
- **One `Stage3D` per pass** (`this.st`), objects grouped per line in `this.grp[0..7]`; only the
  current line's group is visible. Night lines 7–8 share `this.stage7` (re-parented each frame).
  `st.shiftX = 520` shifts the projection so objects sit in the right ~60 % of the frame; the
  left column (x < ~900 px) belongs to the text — keep 3D clear of it.
- **Camera:** `cams[v] = [x, y, z, targetX, targetY, targetZ]`, slow orbit + push over the line,
  a tiny push on kicks. Day overrides for lines 1, 7, 8 are in the `if (this.day)` block. Night
  7–8 use one continuous shot (`agentShot`, `CAM7`).
- **People** are 2D pictograms on camera-facing sprites (`FigureSprite`, poses from `_figure.ts`
  `POSE` / `poseAt(t, keys)`), with a contact shadow. Night: paper outline on dark grey fill; day:
  ink outline on paper fill.
- **Agents** (`Agents` in `_objects3d.ts`): instanced (`AGENTS` = 1200 max) — white clearcoat
  capsule body, two ink dot eyes, small gold antenna, blob shadow; `set(x, y, z, scale, yaw, hop,
  lit, blink)` per agent between `begin()`/`end()`. Floor slots are precomputed in `build3D()`
  (`this.slots`, nearest first); counts come from `agentCount(t)` / `agentBorn(i, from)`.
- Materials: `st.gold` (polished, PMREM studio env), `st.goldRough`, `st.paper`, `st.ink`,
  `st.edges(geo)` for thin edge lines. Text on objects: `Stage3D.canvasTex(...)`.
- The 2D layer `c` (text, shutter) is composited **over** the 3D render; the light layer `lc` is
  added (glow) at night only.

## Creative rules (from the owner — keep them)

- The song is not AI worship. AI is a companion, the sum of human heritage. **No raised-arm /
  salute / arms-up poses.** Greeting = the `'wave'` key in `poseAt` (a hello). Arms-out "command"
  poses were replaced by `'cross'`.
- Premium, product-film feel: gold, paper, ink, soft studio light. No memes, no cute-for-cute's-sake
  stickers. The agents may be cute (round, two dot eyes) but must look designed.
- One idea per lyric line, staged readably in ~3 s. Cuts land on downbeats; motion lands on
  syllables.
- Avoid camera moves fast enough to smear under motion blur (the final render averages 8
  sub-frames over a 0.25-frame shutter): a fast whip turns into ghost double-images. This is why
  verse 2's long take was removed.

## Known weak spots to work on (owner + reviewer notes)

1. **Agents (line 7, both passes)** — read as a dense carpet of eggs; the doubling isn't legible
   as a story ("I now have agents under me"). Ideas: clearer formations (ranks forming under 나,
   a pyramid, conveyor of arrivals), better scale/variety, eye/antenna animation on beats, a
   camera that reveals the scale progressively. Night line 8 reuses them (freeze → lights out →
   shutter) — keep that beat structure.
2. **Day line 7** — the procession is OK but flat; make "walking together as equals" read better
   (side by side, same eye line, maybe the person and one agent in front).
3. **Day line 8 building collapse** — now fast enough, but still lacks weight: consider debris
   chunks, a dust shock-ring along the mirror floor, the camera reacting, light/emissive windows
   dying on 태업.
4. **Camel (day line 1)** — functional but stiff; gait and the head turn on 내일 could be better.
5. General 3D polish: lighting and shadows (props sometimes float — use `contactShadow`), depth
   cues, consistent scale between people and props, no props clipping the text column.

## Workflow

```sh
cd app
bunx tsc --noEmit -p .                                  # must stay clean
# stills / contact sheets — then LOOK at the PNGs
bun scripts/render.ts stills --t 47.5,48.6,49.4 --only grind1 --out ../out/wip/agents
bun scripts/render.ts sheet --from 46.4 --to 52.8 --n 16 --cols 4 --only grind1 --out ../out/wip/v7.png
bun scripts/render.ts sheet --from 122.6 --to 128.1 --n 16 --cols 4 --only grind2 --out ../out/wip/v7day.png
# a short clip to judge motion
bun scripts/render.ts video --from 46 --to 53 --only grind1 --samples 4 --shutter 0.25 --preset veryfast --out ../out/wip/v7.mp4
```

**Run only one render (one headless Chrome) at a time.** Two at once froze the render and once
kernel-panicked this Mac. Check `ps aux | grep render.ts` before starting one.

Final render (resumable 15 s segments; only re-render the segments you touched by deleting their
`.done` marker — verse 1 is segments `015`/`030`/`045`, verse 2 is `090`/`105`/`120`):

```sh
cd app
caffeinate -dimsu ./scripts/render-segments.sh feel-the-agi_v9_1080p60 --samples 8 --shutter 0.25 --crf 17 --preset medium
# 720p preview for review
ffmpeg -i "$MV_OUT/feel-the-agi_v9_1080p60.mp4" -vf scale=1280:-2 -r 30 -c:v libx264 -crf 27 -c:a aac -b:a 160k -movflags +faststart ../out/feel-the-agi_v9_720p_preview.mp4
```

Current reference cut: `$MV_OUT/feel-the-agi_v8.1_1080p60.mp4` (set `MV_OUT` to the folder that holds the renders).

Definition of done: typecheck clean; sheets of lines 7–8 (both passes) and line 1 (day) look
clearly better than v8.1 at the same times; nothing enters the text column; no ghosting in a
short motion-blurred clip; text, timing and every other scene unchanged.
