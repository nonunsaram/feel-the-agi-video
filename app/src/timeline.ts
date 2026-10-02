// The edit: which scene plays when. Boundaries come from the analysed bar grid (data/audio.json,
// piecewise tempo) and the aligned lyrics (data/lyrics.json); nothing is hard-coded in seconds
// except where a cut sits on a drum hit that is looked up in the onset lists.
import type { TimelineEntry } from './engine/engine';
import type { SceneClass } from './engine/scene';
import type { Lyrics } from './engine/lyrics';
import type { AudioData } from './engine/audio';

// Scene modules are discovered lazily so a missing/broken scene never breaks the build.
const modules = import.meta.glob<{ default: SceneClass }>('./scenes/*.ts');
const scene = (name: string) => () => {
  const m = modules[`./scenes/${name}.ts`];
  return m ? m() : Promise.reject(new Error(`scene module not found: scenes/${name}.ts`));
};

/** Length of the silent end-credits card after the song (s). */
export const CREDITS = 8;

export function makeTimeline(ly: Lyrics, au: AudioData): TimelineEntry[] {
  /** Time of bar k (1-based) plus `beat` beats. */
  const bar = (k: number, beat = 0) => au.timeOfBeat((k - 1) * 4 + beat);
  /** The strongest onset of a kind in a window, or the fallback. */
  const hit = (kind: string, t0: number, t1: number, fallback: number) => {
    const ev = au.events(kind, t0, t1);
    return ev.length ? ev.reduce((a, b) => (b[1] > a[1] ? b : a))[0] : fallback;
  };
  const sec = (name: string) => ly.section(name);

  const b = {
    // the boom two beats before the first "A" of hook 1
    hook1: bar(9, 2),
    // verse 1 starts with the pickup "다" on the last beat of bar 17
    verse1: bar(17, 3),
    hook2: bar(34),
    hook3: bar(42),
    pre: bar(50),
    // the 808 that opens the build, as the pre-hook's last held note ends
    build: hit('bass', 90.0, 90.6, bar(57, 2)),
    // the last beat before verse 2's downbeat ("다" is its pickup)
    verse2: bar(65, 3),
    // the hit after "폐업"
    outro: hit('kick', 127.85, 128.15, bar(81, 1.5)),
    end: au.duration,
  };
  // sanity: the grid and the alignment must agree (a line sung in the wrong window means stale data)
  const near = (name: string, t: number, tol: number) => {
    const l = sec(name)[0];
    if (!l || Math.abs(l.start - t) > tol) console.warn(`timeline: section ${name} starts at ${l?.start}, expected about ${t}`);
  };
  near('hook1', bar(10), 0.4); near('verse1', bar(18), 0.5); near('hook2', bar(34), 0.4); near('hook3', bar(42), 0.4);
  near('prehook', bar(50), 0.7); near('verse2', bar(66), 0.5);

  const E = (id: string, file: string, start: number, end: number, extra: Partial<TimelineEntry> = {}): TimelineEntry =>
    ({ id, load: scene(file), start, end, ...extra });

  return [
    E('coldopen', 'coldopen', 0, 1.2),
    E('whisper1', 'whisper', 1.2, b.hook1, { params: { n: 1, section: 'intro' } }),
    E('litany1', 'litany', b.hook1, b.verse1, { params: { n: 1, section: 'hook1' } }),
    E('grind1', 'grind', b.verse1, b.hook2, { params: { pass: 1, section: 'verse1' } }),
    E('litany2', 'litany', b.hook2, b.hook3, { params: { n: 2, section: 'hook2' } }),
    E('litany3', 'litany', b.hook3, b.pre, { params: { n: 3, section: 'hook3' } }),
    E('whisper2', 'whisper', b.pre, b.build, { params: { n: 2, section: 'prehook' } }),
    E('door', 'door', b.build, b.verse2),
    E('grind2', 'grind', b.verse2, b.outro, { params: { pass: 2, section: 'verse2' } }),
    E('end', 'end', b.outro, b.end),
    // after the song: black, then the credits (a silent tail)
    E('credits', 'credits', b.end, b.end + CREDITS),
  ];
}
