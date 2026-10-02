# Revision 4 — plan (from the owner's notes on v3, 2026-10-01)

Goal: from first frame to last, every viewer stays hooked and thinks "this is what AGI-made motion
graphics look like". Reference bar: the pdoom video. Direction (night → door → liquid light → day,
caret, person, LINE Seed) is right; the problem is it is not *fun*: too few ideas per second.

Rule for every section: **one new visual idea per lyric line** (Vocaloid lyric-video density), and the
visual tells the line's meaning literally and beautifully (Apple-keynote clarity: a calendar flips, a
building falls). Keep: door scene, liquid AGI hero, cold open, caret concept, sync, LINE Seed.

## Owner's notes → fixes

1. **Intro / pre-hook 3 static lines (whisper.ts) — fail.** Rebuild as 4 shots, one per line, each its own
   motion idea, cut on the line's first syllable:
   - 사랑을 속삭이네: syllables typed by the caret, then the line *whispers*: the letters breathe apart
     on the vowel, camera slow push; small glints float up like breath.
   - 반짝이는 너와의 미래: each syllable flashes in on its time with a starburst; 미래 flies toward the
     camera in 3D (scale + perspective) and the frame fills with tiny gold points (future = sparkle field).
   - 느껴봐 새 시대: 느껴봐 big, letters vibrate with the voice (vocal envelope); a horizon line
     ignites left→right on 새 시대.
   - 새 시대 (repeat): giant, each syllable slams; the caret becomes the door slit (keep).
   Pre-hook version: same 4 ideas, bigger/brighter, kicks drive camera punches.

2. **"tell me now" is tiny → make it full-frame.** TELL / ME / NOW one word per frame, Archivo 900
   (or LINE Seed Bold), fills the width, slams on each word with shake + RGB split; NOW holds and the
   caret blinks after it; cut on the next downbeat.

3. **Verse: keep the *meaning*, change the *method* — concrete, Apple-like objects, not abstract lines.**
   One literal, beautiful object per line (night pass; day pass shows the changed outcome):
   1 다 끝났다고 말해줄래 내일 — a clean progress bar to 99 % (keep), then a **calendar page flips** to
     "내일" (tear-off calendar, 3D page curl). Day: flips to "오늘", bar hits 100 %.
   2 기다리고 있거든 매일 — **calendar pages flipping fast** on every 16th note (day numbers racing), the
     person sits waiting beside it. Day: the flipping stops, a single page reads 끝.
   3 더이상 찾기 싫어 새 일 — phone-style **notification cards** (no brand, no money amounts) piling
     up; 싫어 **swipes them all away** with a flick. Day: carets take them.
   4 새 일 자리 어디에 있지 — **rows of chairs, all occupied** (pictogram people sitting), the person walks
     along looking for a seat; 있지 = no seat. Day: a chair appears.
   5 하기싫어 시키는 일만은 — **task cards / arrows rain** onto the person who refuses (arms crossed),
     cards bounce off. Day: they stop mid-air.
   6 그 자식들은 아직도 기만을 — **smiling masks / badges** on faceless figures; on 기만을 the masks
     crack and fall, revealing empty outlines. Day: masks gone.
   7 나도 이제 밑에 agent — keep the doubling carets (liked) but as **an org chart that flips upside down**:
     the person moves from the bottom to the top, agents fan out below.
   8 시켜서 태업 아님 폐업 — 태업: all agents sit/stop (keep). 폐업: **an office building collapses**
     floor by floor on 폐 / 업 (liked the 폐업 idea; make it a literal building), dust settles.

4. **Second half — the liquid wipes are unnatural.** Remove the sweeping blob wipes in verse 2. Instead:
   liquid lives in the background as a **slow liquid-gold horizon / pool** under the daylight scenes
   (ground reflection), reacting to kicks; transitions are hard cuts or object-driven (page flips, etc.).

5. **AGI: all three letters gold.** In the hooks, A and G become liquid gold too (same material as I),
   not flat white; echoes stay glitched. Floating spheres more visible: bigger radius, more of them,
   brighter reflections, slower drift, placed around (not behind) the letters; in the climax camera
   framing that shows them.

6. **Fun / "feel the AGI" factor (whole video):**
   - camera motion in every section (push, orbit, whip on downbeats), not static frames;
   - beat-locked micro-events: every kick does something visible (punch, flash, particle burst);
   - 3D depth everywhere: type in perspective, parallax layers, liquid reflections;
   - more color moments (dawn gradient fields) in hooks;
   - each hook escalates visibly (hook 3 > hook 2 > hook 1).

## Work order (next session)
1. tell me now full-frame + gold AG (small, fast)
2. whisper.ts rebuild (4 shots) — intro and pre-hook
3. verse objects: calendar (1, 2), notifications swipe (3), chairs (4), raining tasks (5), masks (6),
   org chart flip (7), building collapse (8)
4. remove liquid wipes, add liquid horizon pool for verse 2; spheres bigger in climax
5. camera/beat micro-events pass over everything
6. segment render, review overview sheet, publish to the artifact page

Render: always `scripts/render-segments.sh` (one Chrome at a time; the Mac panicked once under two).

## Owner's additions (same day)

- **Objects in 3D.** Calendar, chairs, masks, building, notification cards etc. are real 3D (or read as
  3D): wireframe / hidden-line or lit chrome-gold solids, with camera moves around them. The point to
  make: work that used to cost a fortune in 3D is now one click — the viewer should think "this is AGI".
  Technique is up to Claude: three.js meshes rendered with LineBatch wireframes + the liquid-gold
  material, or ray-marched SDF objects (box calendar pages with page curl, chairs from boxes, cracked
  mask from Voronoi shards, building = stacked floor boxes that fall with simple rigid-body keyframes).
- **Tone: premium, not meme.** Remove anything with a cheap internet-meme / otaku / "loser" flavour:
  no "기본소득 입금 D-1", no "그동안 감사했습니다" notice, no jokey Korean UI copy. Labels, if any, are
  minimal, English mono or none. The feeling: a golden future opening up.
- **Keep the dawn countdown** (DAWN IN −01:00 → SINCE DAWN): the owner likes it; give it a more
  premium treatment (larger, a thin progress hairline, gold when it turns over).
