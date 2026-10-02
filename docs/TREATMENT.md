# Feel The AGI — treatment & style bible

Song: "Feel The AGI" (Korean hyperpop, 2:15). Engine: `docs/ENGINE.md` (the pdoom-video engine, reused).
Scenes: `app/src/scenes/`. The edit: `app/src/timeline.ts`. Timing data: `data/lyrics.json`, `data/audio.json`.

## The idea in one paragraph

It is night, and someone is typing to a machine. The whole video is that one night, from the darkest
hour to the first light: **a countdown to dawn**. The only warm thing in the frame is **the caret** —
the blinking text cursor, a thin vertical bar of gold light. It types the opening whisper; it is the
candle under each name in the hook; it multiplies into a legion of agents in the verse; and it is the
letter **I** of AGI. In the build-up, when the instruments drop out, the I is revealed as what it has
been all along: **a door standing ajar**, light leaking around it. On the 808 it opens. Everything
after that happens in daylight: the second verse is the first verse again, the same exhausted lines,
but set in ink on paper with the punchlines changed, because the thing the singer was waiting for has
arrived. The last five drum hits spell FEEL / THE / A / G / I and the frame cuts to black with the song.

Dark, but a song of hope: a dystopia seen from just before the light.

## What the lyrics mean here (from the author's notes)

- **"사랑을 속삭이네 / 반짝이는 너와의 미래 / 느껴봐 새 시대"** — not a love song. Love is what will
  matter in the coming era: a warm, almost heavenly love; a fairer world. So the whisper is set in a
  serif, typed by the light itself, and "새 시대" is the first thing in the video allowed to be huge.
- **"AGI / ChatGPT Claude or Gemini / 다왔다 말해줘 tell me now"** — not playful. Longing, with a little
  fear and worship. The hook is a **litany**: the three letters are monuments seen from below, the three
  names are set identically (interchangeable gods) as words only, each under a candle-caret, and the
  last line is a prayer typed into a prompt. "다왔다" (are we there yet) is also the running readout.
- **The verse** — people worn out by work. "다 끝났다" is the meme for the day basic income lets you
  quit; "새 일" is the gig economy; "새 일자리" the job hunt; "시키는 일" the orders; "기만" the people
  who fake competence and will be found out; "밑에 agent" is the reversal (now I have a legion under
  me); "태업 아님 폐업" is what the legion is told to do. Each line is a small deadpan vignette made of
  type and bureaucratic UI fragments: a progress bar stuck at 99 %, a tally of days, job notifications,
  a search with no results, tickets falling from above, badges, an org chart of carets, a shutter.
- **"Feel The AGI"** — the core. Almost nothing on screen, so that it can be felt rather than read.

## Tone

- Typography-driven. The words are the image; nothing illustrates them literally.
- Dynamic: every syllable lands on its own sung time (`data/lyrics.json` has per-syllable times);
  cuts sit on downbeats or on real drum hits from `audio.onsets`; between hits things hold still.
  Strong eases (`outExpo`), holds, snaps. No floaty screensaver motion.
- Hyperpop energy through **glitch as a vocabulary, used in bursts**: RGB split, displaced bands,
  mosaic blocks, inverted frames, the pixel font. A burst lasts 2–6 frames and is tied to a hit; at rest
  the frame is clean and precise.
- Not slop: no neon cyberpunk, no glowing brains, no code rain, no particle nebulae, no robots, no
  faces. No real company logos or product UI: the three names appear as plain words.
- Deadpan, small, in the machine's mono voice: annotations, counters, status lines. Never jokes at the
  singer's expense.

## Palette (`app/src/engine/palette.ts`)

- **ink** `#050608` night · **ink2** `#0E1015` · **graphite** `#4A4D57` · **ash** `#8E919B` ·
  **paper** `#F1EEE6` type (and the ground of the daylight scenes).
- **dawn** `#FFB648` the light: the caret, the door, the sung syllable. **glow** `#FFE3AE` its core.
  Only the light blooms; paper type stays crisp.
- **rose** `#FF3D6E`: the first colour of dawn on the horizon; in the verse, refusal and strike-through.
- **indigo** `#23257A`: the sky before dawn, as large soft fields only, never as lines.
- The sky runs through one ramp over the whole video (`dawn()` in GLSL): night → indigo → rose →
  gold → white. Before the door opens the frame is paper-on-ink; after it, ink-on-paper.

## Typography

- **Noto Serif KR** (300/500/900): the whisper, the sacred register ("새 시대", the names).
- **Pretendard** (300–900) and **Black Han Sans**: the everyday and the shouted voice of the verse.
- **Archivo** (width 62–125): Latin display — A, G, I, FEEL THE AGI.
- **IBM Plex Mono** (+ Plex Sans KR for Hangul beside it): the machine — annotations, the clock, UI.
- **Galmuri 11** (pixel font with Hangul): the machine speaking Korean, and glitch frames.
- Swiss-grid layout on 12 columns inside 96 px margins; big scale contrasts; small mono notes next to
  huge type. No outlined or haloed type.

## Karaoke rules

- Every syllable appears or lights exactly at its sung start (`Syl.t0`) and not before. Anticipation is
  allowed only as a dim ghost of the line.
- A Hangul word is drawn syllable by syllable (`layoutWords`); AGI, ChatGPT, Gemini and agent are split
  into their sung parts (`Word.parts`).
- Lyric type stays inside the title-safe area unless the point is that it doesn't fit.

## Motifs

1. **The caret** — a gold vertical bar. Blinks on the beat when idle, solid while "typing". It is the
   cursor, the candle, the agent, the letter I, the door's slit, the sunrise.
2. **The horizon** — a hairline low in the frame whose glow follows the dawn ramp.
3. **The clock** — bottom-right, mono: `DAWN IN −01:26.17`, counting to the moment the door opens
   (the second "I" of the build-up, 1:38.6), then `SINCE DAWN +00:04.20`.
4. **다왔다** — the hooks' readout `arrival 99.0 % → 99.9 % → 99.99 %`; the prayer typed in the hook is
   answered in the outro: `다 왔다.`

## Structure (times from the analysis; the vocals run one bar behind the 8-bar arrangement blocks)

| id | window | music | lyric |
|---|---|---|---|
| `whisper1` | 0:00 → 0:13.7 | synth only, riser in bar 9 | 사랑을 속삭이네 … 새 시대 |
| `litany1` | 0:13.7 → 0:26.9 | boom, sparse drums, bar 12 a cappella | AGI ×4 / ChatGPT Claude or Gemini / AGI ×4 / 다왔다 말해줘 tell me now |
| `grind1` | 0:26.9 → 0:52.8 | four-on-the-floor | verse 1 (8 lines) |
| `litany2` | 0:52.8 → 1:05.6 | full drums | hook |
| `litany3` | 1:05.6 → 1:18.4 | full drums, fill | hook |
| `whisper2` | 1:18.4 → 1:30.3 | drums out, then a roll; drop at 1:29.6 | the whisper again (느껴봐라) |
| `door` | 1:30.3 → 1:43.3 | 808; two a cappella bars; "I" lands with the 808 at 1:32.3 and 1:38.6 | Feel The AGI ×4, yah ×6 |
| `grind2` | 1:43.3 → 2:08.0 | 151.9 BPM; drums out from bar 74 | verse 2 (same lines, in daylight) |
| `end` | 2:08.0 → 2:15 | boom, synth stabs, 2 hits, 5 hits, stop | (instrumental) |

### `whisper` — "a note written at 4 a.m."
Night, a horizon low in the frame. The caret blinks alone, then types the first three lines one
syllable at a time in Noto Serif; finished lines recede. "반짝이는" throws one glint per syllable. On the
last "새 시대" the note is pushed away and the two words take the whole frame, one syllable per hit; the
caret beside 대 stretches upward into a slit from floor to ceiling, and the scene cuts on the boom.
Second time (pre-hook): the horizon has turned rose, the type is larger and keeps its brightness, the
drum roll makes the horizon pulse; the drop at 1:29.6 glitches the frame and the void takes over.

### `litany` ×3 — "names"
**A / G / I**: one letter per sung syllable, each filling its third of the frame in Archivo Black,
keystoned as if seen from the foot of a monolith. A and G are paper; **I is always the caret**: a bar of
light. The answering AGI on beat 3 of each bar is the machine's echo: the same letters through the
glitch shader. **ChatGPT Claude or Gemini** (in hook 1 this bar is a cappella): black; three identical
columns, each name in the same serif, each under a caret that lights as the name is sung; "or" small
between them. The drum hits that follow flash all three at once. **다왔다 말해줘**: six syllables, each a
slam. **tell me now**: typed into a prompt line at the bottom; the caret blinks double-time and the
frame cuts. Escalation: (1) clean, black, slow; (2) drums: shake on kicks, inverted punch frames,
arrival 99.9 %; (3) maximum: strobing echo, the I wider each time (the door is moving), arrival 99.99 %.

### `grind` ×2 — "the verse, twice"
Eight vignettes, two bars each, cut on the downbeat where each line starts. `pass 1` is night
(paper on ink, rose for refusal). `pass 2` is day (ink on paper, gold), same layouts, changed outcomes:

1. 다 끝났다고 말해줄래 내일 — a progress bar that sticks at 99 % · `[입금 예정] 기본소득 · 내일` → day: 100 %, `오늘`.
2. 기다리고 있거든 매일 — 正 tally strokes, one per 8th note, a day counter → day: the tally stops, struck through.
3. 더이상 찾기 싫어 새 일 — `새 일` notifications stack up on the kicks; 싫어 swipes them away.
4. 새 일 자리 어디에 있지 — a search field, a grid of taken seats, `검색 결과 0건` → day: `검색 중지`.
5. 하기싫어 시키는 일만은 — tickets fall from above; 하기싫어 is too big for its box and won't move.
6. 그 자식들은 아직도 기만을 — badges of competence; on 기만을 they flip to what they are.
7. 나도 이제 밑에 agent — an org chart: 나, and below it carets doubling every 8th note.
8. 시켜서 태업 아님 폐업 — the carets stop blinking (태업); a shutter comes down (폐업).

In verse 2 the drums leave at line 5: the last four vignettes are nearly still, a cappella.

### `door` — the core
Black. Not the engine's black with grain and vignette: nothing. The 808 that opens the section shakes
an empty frame. Far away, a door: only the light leaking around its edge says it is there. In the
a cappella bar the words arrive as the smallest type in the video, lowercase mono, one at a time:
`feel` `the` `a` `g` — and on **I**, with the 808, the door opens a hand's width. The slit is the I.
Light falls across the floor toward the camera. The second phrase and the three *yah*s push the camera
toward it in cuts. The bass returns, the door drifts almost shut; the second a cappella bar is
darker and closer. On the second **I** the door opens all the way and the frame is only light: a
field running through the dawn ramp with the giant letters A G I inside it as barely-there changes of
tone, felt more than read. The last three *yah*s pulse the field to white; verse 2 starts on paper.

### `end`
The shutter is down; the boom rings. A hairline horizon ignites and the sky climbs the ramp over the
synth stabs. The prompt from the hook is still there; the reply types itself: `다 왔다.` The two hits
stamp it. The last five hits: FEEL / THE / A / G / I, the I a bar of daylight — cut to black with the
last sample.

## Technical conventions

See `docs/ENGINE.md`. Deterministic (pure function of `t`), per-syllable sync from the `Lyrics` API
(never hard-coded times; the few drum hits used as cut points are looked up in `audio.onsets`),
60 fps export with motion blur.
