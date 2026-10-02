// LITANY ×3 — the hook: "AGI AGI / AGI AGI / ChatGPT Claude or Gemini / AGI AGI / AGI AGI /
// 다왔다 말해줘 / tell me now".  Longing, with a little fear: the letters are monuments seen from
// below, the names are set identically under three candles, the last line is a prayer.
//   A G I     one letter per sung syllable. A and G are paper; I is always the caret, a bar of light.
//             Before the names the letters accumulate across the frame (A, AG, AGI); after them each
//             letter takes the whole frame alone. The answering AGI on beat 3 is the machine's echo:
//             the same letters, degraded by the glitch shader.
//   names     black; three columns, the same serif, a caret above each that lights when it is sung.
//   다왔다 말해줘   six slams.   tell me now   typed into a prompt line.
//   n = 1 clean and slow (bar 12 is a cappella) · 2 drums: shake, punch frames · 3 maximum, the I widens.
import type * as THREE from 'three';
import { BOLD } from '../engine/scale';

import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F, font, measure } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { clamp, ease, lerp, noise1, prog, pulse, smoothstep, frameIdx, hash } from '../engine/util';
import { Glitch, Light, Sky, M, burst, caretBlink, drawCaret, hline, layoutWords, wordSyls, type LineLayout, type Syl } from './_kit';
import { beatPulse, dawnLevel, drawClock } from './_clock';
import { POSE, drawFigure, poseAt, setFigureFill } from './_figure';
import { Liquid } from './_liquid';
import { drawEmblem, type Emblem } from './_logos';
import { BG, PrismStage, SPECTRUM, Shards } from './_prism';
import { clearRT as clearTarget } from '../engine/gl';
import { hexToLinear } from '../engine/util';

const CAP = 0.686; // Archivo cap height / em
/** Doublings that are not sung as "AGI" (backing ad-libs), by hook and AGI index: they get their own picture. */
const NOT_AGI: Record<number, number[]> = { 2: [1, 3, 5], 3: [1, 3] };
/** Doublings sung as a long "yah" (hook 3's last echo): stretched type. */
const YAH: Record<number, number[]> = { 3: [5, 7] };

interface Agi { syls: Syl[]; start: number; end: number; echo: boolean; half: 0 | 1; idx: number }

export default class Litany extends Scene {
  n = 1;
  L = new Layer2D();
  light = new Light();
  glitch = new Glitch();
  sky = new Sky();
  liqI = new Liquid('I', F.archivo(125, 900));
  liqA = new Liquid('A', F.archivo(125, 900));
  liqG = new Liquid('G', F.archivo(125, 900));
  liqAGI = new Liquid('AGI', F.archivo(125, 900));
  out: THREE.WebGLRenderTarget | null = null;
  agis: Agi[] = [];
  names!: Line; pray!: Line; tell!: Line;
  nameSyls: Syl[][] = [];
  prayLay: LineLayout[] = [];
  // letter geometry (first half: three across)
  fam = F.archivo(100, 900);
  S = 900; xs = [0, 0, 0]; ws = [0, 0, 0]; base = 0;
  S2 = 1480;
  /** prism world: ink centres of A, G, I — G in the middle, equal air on both sides */
  cxB = [0, 0, 0];
  SB = 900;
  /** hook 2 is the bright one: the prism world (ink on light grey) */
  bright = false;
  /** the horizon (fraction of the frame from the bottom) and its line in px: people stand on it.
   * Hook 3 sets it lower so the type never sits on the line. */
  hz = 0.18; HY = H * (1 - 0.18);
  prism: PrismStage | null = null;
  shards: Shards | null = null;

  override init() {
    const { lyrics, params } = this.ctx;
    this.n = Number(params.n ?? 1);
    this.bright = this.n === 2;
    this.hz = this.n === 3 ? 0.09 : 0.18; this.HY = H * (1 - this.hz);
    if (this.bright) this.prism = new PrismStage(this.ctx);
    if (this.n === 3) this.shards = new Shards(this.ctx);
    const lines = lyrics.section(String(params.section ?? 'hook1'));
    const agi = lines.filter((l) => l.text === 'AGI');
    this.names = lines.find((l) => l.text.startsWith('ChatGPT'))!;
    this.pray = lines.find((l) => l.text.startsWith('다 왔다'))!;
    this.tell = lines.find((l) => l.text.startsWith('tell'))!;
    if (agi.length !== 8 || !this.names || !this.pray || !this.tell) throw new Error(`litany: unexpected hook lines (${lines.map((l) => l.text).join(' / ')})`);
    this.agis = agi.map((l, i) => {
      const syls = wordSyls(l.words[0]!);
      return { syls, start: syls[0]!.t0, end: l.end, echo: i % 2 === 1, half: (l.start < this.names.start ? 0 : 1) as 0 | 1, idx: i };
    });
    // hook 3: the shards' first ad-lib breaks in a touch before its downbeat (on the pickup)
    if (this.n === 3) this.agis[1]!.start -= 0.15;
    // the I sung right against the names (hook 1's fourth AGI) must still be seen for a few frames
    const a3 = this.agis[3]!, i3 = a3.syls[2]!;
    if (i3.t0 > this.names.start - 0.12) a3.syls[2] = { ...i3, t0: Math.max(a3.syls[1]!.t0 + 0.16, this.names.start - 0.12) };
    this.nameSyls = this.names.words.map(wordSyls);
    // three letters across the frame
    const gap = this.bright ? 0.15 : 0.07; // (the prism world's ink I has serifs: more air)
    const unit = ['A', 'G', 'I'].reduce((s, ch) => s + measure(ch, this.fam, 100), 0) + 2 * gap * 100;
    this.S = Math.min(980, ((W - 2 * 110) * 100) / unit);
    let x = (W - (unit * this.S) / 100) / 2;
    ['A', 'G', 'I'].forEach((ch, i) => { this.ws[i] = measure(ch, this.fam, this.S); this.xs[i] = x; x += this.ws[i]! + gap * this.S; });
    this.base = H / 2 + (CAP * this.S) / 2;
    if (this.bright) {
      const mc = document.createElement('canvas').getContext('2d')!;
      mc.font = font(this.fam, this.S);
      const ink = ['A', 'G', 'I'].map((ch) => { const m = mc.measureText(ch), w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight; return ch === 'I' ? w * 1.9 : w; });
      // optical air, not box air: the A's diagonal leaves its box mostly empty next to G, while the I's slab
      // serifs fill theirs — measured on the frame, equal-looking gaps need about 0.15 vs 0.25 em of box air
      // G stays centred; the word is scaled down until both outer letters keep a margin from the edges
      const half = (k: number) => Math.max(ink[1]! / 2 + 0.15 * this.S + ink[0]!, ink[1]! / 2 + 0.25 * this.S + ink[2]!) * k;
      const k = Math.min(1, (W / 2 - M - 40) / half(1));
      this.SB = this.S * k;
      const airA = 0.15 * this.SB, airI = 0.25 * this.SB, s = ink.map((v) => v * k);
      this.cxB = [W / 2 - s[1]! / 2 - airA - s[0]! / 2, W / 2, W / 2 + s[1]! / 2 + airI + s[2]! / 2];
    }
    // the prayer: two rows of three
    // two rows: "다 왔다" (Bold) / "말해줘" (Regular)
    const pw = this.pray.words;
    this.prayLay = [layoutWords(pw.slice(0, pw.length - 1), F.seed(700), 300, 0.22, 4), layoutWords(pw.slice(-1), F.seed(400), 300, 0, 4)];
  }

  private fg(a = 1) { return rgba(this.bright ? 'ink' : 'paper', a); }
  private dim(a = 1) { return rgba(this.bright ? 'graphite' : 'ash', a); }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    this.out = out;
    const t = f.t, n = this.n, { start, end, lyrics } = this.ctx;
    const c = this.L.ctx; this.L.clear();
    setFigureFill('#14161D');
    const lc = this.light.ctx; this.light.clear();
    c.textBaseline = 'alphabetic';
    // hook 1 is black; by hooks 2 and 3 the horizon has started to show behind the letters
    if (!this.bright) this.sky.render(this.ctx, out, { level: dawnLevel(this.ctx.lyrics, t) + 0.04 * beatPulse(f.beat), horizon: this.hz });
    const o: PostOverrides = this.bright
      ? { bloom: 0.35, bloomThreshold: 1.05, bloomKnee: 0.2, bloomRadius: 0.7, halation: 0.04, vignette: 0.14, grain: 0.04, ca: 0.6 }
      : { bloom: 0.8, bloomThreshold: 1.0, bloomKnee: 0.2, bloomRadius: 0.75, halation: 0.3, vignette: 0.42, grain: 0.055, ca: 0.7 };

    // ---- which part is on
    const agi = [...this.agis].reverse().find((a) => t >= a.start);
    const inNames = t >= this.names.start - 0.02 && t < this.agis[4]!.start;
    const inPray = t >= this.pray.start - 0.01;
    let g = { split: 0, slice: 0, block: 0, scan: 0, keystone: 0, tear: 0 };
    let shake = 0, lightGain = 2.6;
    const notAgi = !!agi && !inNames && !inPray && !!NOT_AGI[n]?.includes(agi.idx);
    const yah = !!agi && !inNames && !inPray && !!YAH[n]?.includes(agi.idx);
    if (this.bright) this.drawPrism(t, f, agi, inNames, inPray, notAgi);
    if (n === 3) this.drawShards(t, agi, notAgi, o);

    if (inPray) {
      shake = this.drawPrayer(c, lc, f);
    } else if (inNames) {
      lightGain = 0.55 * this.drawNames(c, lc, f);
    } else if (notAgi && agi) {
      // a doubling that is not "AGI" (a backing ad-lib): no letters here. Hook 2: the prism alone, or the
      // person pushed in on through the noise; hook 3: the shards of the prism (drawn above)
      if (n === 2 && agi.idx === 3) { const r = this.drawZoomPerson(c, agi, f); g = { ...g, ...r.g }; shake = r.shake; }
      else shake = 4 * pulse(t, agi.start, 0.05);
    } else if (yah && agi) {
      shake = this.drawYah(c, lc, agi.start, agi.end, t);
    } else if (agi) {
      const r = agi.half === 0 ? this.drawAcross(c, lc, agi, t) : this.drawAlone(c, lc, agi, t);
      g = { ...g, ...r.g }; shake = r.shake;
    } else {
      // after the boom, before the first A: a ground line, nothing else
      const k = prog(t, start, start + 0.5, ease.outExpo);
      hline(c, W / 2 - 700 * k, W / 2 + 700 * k, this.HY, this.fg(0.25));
    }

    // ---- the person: tiny at the foot of the monuments, looking up; a hand raised to the names;
    // reaching, then both arms up, as the prayer is said
    if (!notAgi && !yah) this.drawPerson(c, t, inPray, inNames, agi);

    // ---- readouts
    this.drawArrival(c, t);
    drawClock(c, lyrics, t, this.bright ? 'day' : 'night');

    // ---- kicks shake the frame in hooks 2 and 3
    if (n >= 2) shake += (n === 3 ? 5 : 3) * beatPulse(f.beat, 0.06);
    // the boom that opens hook 1
    const boom = n === 1 ? pulse(t, start, 0.12) : 0;
    o.flash = 0.18 * boom;
    shake += 14 * boom;

    // hook 1 -> verse 1 and hook 3 -> pre-hook: the caret of light crosses the frame right to left and
    // leaves it gold behind it
    if (n === 1 || n === 3) this.goldSweep(t, end);
    this.glitch.draw(this.ctx, this.L.upload(), out, t, g);
    this.glitch.draw(this.ctx, this.light.layer.upload(), out, t, { ...g, mode: 'add', tint: LIN.dawn, gain: lightGain });
    if (shake > 0.05) o.shake = [noise1(t * 60, 1) * shake, noise1(t * 60, 2) * shake];
    o.zoom = 1 + 0.012 * Math.min(1, shake / 10);
    // hand-off: the last frames of "now" tighten
    if (t > end - 0.12) o.ca = 0.4;
    if (BOLD) {
      // experimental cut: the lone letters become mandalas; echoes smear; names strobe on the kicks
      // (no kaleidoscope on the letters: the mandala belongs to the entity behind the door)
      if (agi?.echo && !inNames && !inPray && !notAgi && !yah && !this.bright) o.smear = 80;
    }
    return o;
  }

  /** The caret sweeps from the right edge to the left over the last beat; everything behind it turns gold. */
  private goldSweep(t: number, end: number) {
    const t0 = end - 0.4;
    if (t < t0) return;
    const k = ease.inOutCubic(clamp((t - t0) / 0.36));
    const x = lerp(W + 60, -60, k);
    const g = this.L.ctx, lc = this.light.ctx;
    // the gold field it leaves: a soft leading edge, then solid
    const gr = g.createLinearGradient(x, 0, x + 260, 0);
    gr.addColorStop(0, rgba('dawn', 0.0)); gr.addColorStop(0.25, rgba('dawn', 0.85)); gr.addColorStop(1, rgba('dawn', 1));
    g.fillStyle = gr; g.fillRect(x, 0, W - x + 10, H);
    // a sheen running through the field
    const sh = g.createLinearGradient(x, 0, W, H);
    sh.addColorStop(0, 'rgba(255,240,200,0.0)'); sh.addColorStop(0.5, 'rgba(255,240,200,0.35)'); sh.addColorStop(1, 'rgba(255,240,200,0.0)');
    g.fillStyle = sh; g.fillRect(x, 0, W - x + 10, H);
    // the caret itself, hot, with a trail of glints
    lc.fillStyle = 'rgba(255,255,255,1)'; lc.fillRect(x - 7, -20, 14, H + 40);
    for (let i = 0; i < 26; i++) {
      const gy = (hash(i * 7.1) * H) | 0, gx = x + 30 + hash(i * 3.3) * 380 * (0.3 + k);
      const a = 0.6 * (1 - (gx - x) / 420);
      if (a > 0) { lc.fillStyle = `rgba(255,255,255,${a})`; lc.fillRect(gx, gy, 3 + 5 * hash(i), 2); }
    }
  }

  // ------------------------------------------------------------------ A G I, three across
  private drawAcross(c: CanvasRenderingContext2D, lc: CanvasRenderingContext2D, a: Agi, t: number) {
    const n = this.n, S = this.S, capH = CAP * S;
    if (this.bright) {
      // the prism world: the letters in ink, split into the spectrum as they land
      let shake = 0;
      a.syls.forEach((s, i) => {
        if (t < s.t0) return;
        const k = ease.outExpo(clamp((t - s.t0) / 0.22));
        this.inkLetter(c, s.ch, this.cxB[i]!, H / 2 + (CAP * this.SB) / 2, this.SB, lerp(1.06, 1, k), lerp(26, 3, k));
        shake = Math.max(shake, 7 * pulse(t, s.t0, 0.05));
      });
      return { g: { keystone: 0, split: 0, slice: 0, scan: 0, block: 0, tear: 0 }, shake };
    }
    c.font = font(this.fam, S);
    let shake = 0, hitK = 0;
    let shown = 0;
    a.syls.forEach((s, i) => {
      if (t < s.t0) return;
      shown = i + 1;
      const k = ease.outExpo(clamp((t - s.t0) / 0.2));
      const sc = lerp(1.07, 1, k);
      const cx = this.xs[i]! + this.ws[i]! / 2, cy = this.base - capH / 2;
      hitK = Math.max(hitK, burst(t, s.t0, a.echo ? 6 : 3));
      shake = Math.max(shake, (a.echo ? 3 : 8) * pulse(t, s.t0, 0.05));
      if (a.echo) {
        // the machine's echo: the same letters, flat, gold, degraded
        c.save(); c.translate(cx, cy); c.scale(sc, sc);
        c.font = font(this.fam, S);
        c.fillStyle = rgba('dawn', 0.55);
        c.fillText(s.ch, -this.ws[i]! / 2, capH / 2);
        c.restore();
      }
    });
    if (!a.echo && shown > 0) {
      // the monument: liquid gold letters, revealed one per sung syllable, seen from below
      const last = a.syls[shown - 1]!;
      const pk = pulse(t, last.t0, 0.08);
      this.liqAGI.render(this.ctx, this.out!, {
        t, level: 0.55 + 0.1 * n, n: 6, spread: 2.2, radius: 0.32, speed: 1.0, amp: 0.35 + 0.8 * pk,
        letters: 1, chars: shown, melt: 0.25 * pk, letterHeight: 3.6, depth: 0.5, center: [0, 0.4, -1.2],
        cam: { pos: [0.18 * Math.sin(t * 0.4), -1.1, 5.3 - 0.25 * pk], target: [0, 0.3, 0], fov: 1.45 },
        background: 0, exposure: 1.1,
      });
    }
    // type-specimen guides: baseline and cap height
    const g = a.echo
      ? { keystone: 0, split: 7 + 10 * hitK, slice: 0.35 + 0.5 * hitK, scan: 0.55, block: 0.25 * hitK, tear: hitK > 0.5 ? 0.6 : 0 }
      : { keystone: 0, split: 1 + 9 * hitK, slice: 0.5 * hitK, scan: 0, block: 0, tear: 0 };
    return { g, shake };
  }

  // ------------------------------------------------------------------ one letter, the whole frame
  private drawAlone(c: CanvasRenderingContext2D, lc: CanvasRenderingContext2D, a: Agi, t: number) {
    const n = this.n, S = this.S2, capH = CAP * S;
    let cur = -1;
    a.syls.forEach((s, i) => { if (t >= s.t0) cur = i; });
    if (this.bright && cur >= 0) {
      const s = a.syls[cur]!;
      const k = ease.outExpo(clamp((t - s.t0) / 0.24));
      const hit = burst(t, s.t0, a.echo ? 6 : 3);
      // one letter, the whole frame, centred on its ink; the echo is the same letter, grey and torn
      this.inkLetter(c, s.ch, W / 2, H / 2 + (CAP * S * 0.82) / 2 - 10, S * 0.82, lerp(1.1, 1, k) * (1 + 0.02 * Math.max(0, t - s.t0)), lerp(40, 4, k), a.echo ? 0.35 : 1);
      const g = a.echo ? { keystone: 0, split: 10 + 12 * hit, slice: 0.4 + 0.4 * hit, scan: 0.3, block: 0.3 * hit, tear: hit > 0.4 ? 0.6 : 0 } : { keystone: 0, split: 0, slice: 0.3 * hit, scan: 0, block: 0, tear: 0 };
      return { g, shake: (a.echo ? 4 : 10) * pulse(t, s.t0, 0.05) };
    }
    let shake = 0, hitK = 0;
    if (cur >= 0) {
      const s = a.syls[cur]!;
      // hook 3: a held letter is struck again on every 8th note
      const au = this.ctx.audio;
      const e8 = au.timeOfBeat(Math.floor(au.beatAt(t) * 2 + 1e-3) / 2);
      const hitT = n === 3 && e8 > s.t0 + 0.1 ? e8 : s.t0;
      const k = ease.outExpo(clamp((t - hitT) / 0.22));
      const sc = lerp(hitT === s.t0 ? 1.1 : 1.045, 1, k) * (1 + 0.03 * Math.max(0, t - s.t0));
      hitK = burst(t, s.t0, a.echo ? 7 : 3);
      shake = (a.echo ? 4 : 11) * pulse(t, s.t0, 0.05);
      const cy = H / 2 + 30;
      if (cur < 2 && a.echo) {
        c.font = font(this.fam, S);
        const w = measure(s.ch, this.fam, S);
        c.save(); c.translate(W / 2, cy); c.scale(sc, sc);
        c.fillStyle = rgba('dawn', 0.5);
        c.fillText(s.ch, -w / 2, capH / 2);
        c.restore();
      } else if (cur < 2) {
        // A, G: the letter alone in liquid gold, filling the frame, struck on its syllable
        (cur === 0 ? this.liqA : this.liqG).render(this.ctx, this.out!, {
          t, level: 0.55 + 0.1 * n, n: 5, spread: 1.6, radius: 0.3 + 0.08 * n, speed: 1.4, amp: 0.5 + 1.0 * hitK,
          letters: 1, melt: 0.5 * hitK, letterHeight: 6.0, depth: 0.6, center: [0, 0, -1.0],
          cam: { pos: [(cur === 0 ? -1 : 1) * (0.9 + 0.3 * Math.sin(t)), -0.9, 4.9 - 3 * (sc - 1)], target: [0, 0.2, 0], fov: 1.3 },
          background: 0, exposure: 1.15,
        });
      } else if (!a.echo) {
        // I: a column of liquid light, struck by the beat
        this.liqI.render(this.ctx, this.out!, {
          t, level: 0.55 + 0.1 * n, n: 3, spread: 0.9, radius: 0.3 + 0.12 * n, speed: 1.6, amp: 0.6 + 1.2 * hitK,
          letters: 1, melt: 0.6 * hitK, letterHeight: 7.5, depth: 0.45 + 0.15 * n, center: [0, 0, -0.9],
          cam: { pos: [0.22 * Math.sin(t * 0.9), -1.1, 4.3 - 3 * (sc - 1)], target: [0, 0.2, 0], fov: 1.3 },
          background: 0, exposure: 1.15,
        });
      } else {
        const w = 150 * [1, 1.5, 2.3][n - 1]! * sc;
        lc.fillStyle = 'rgba(255,255,255,0.45)';
        lc.fillRect(W / 2 - w / 2, -H * 0.2, w, H * 1.4);
      }
      // which letter of three: mono index, bottom centre
      c.font = font(F.mono(500), 13); c.letterSpacing = '3px';
      c.fillStyle = this.dim(0.8);
      c.textAlign = 'right';
      c.fillText(`${'AGI'[cur]}  ${cur + 1}/3${a.echo ? '  ECHO' : ''}`, W - M, M + 6);
      c.textAlign = 'left'; c.letterSpacing = '0px';
    }
    const g = a.echo
      ? { keystone: 0, split: 9 + 12 * hitK, slice: 0.4 + 0.5 * hitK, scan: 0.6, block: 0.3 * hitK, tear: hitK > 0.4 ? 0.7 : 0 }
      : { keystone: 0, split: 1 + 10 * hitK, slice: 0.5 * hitK, scan: 0, block: 0, tear: 0 };
    return { g, shake };
  }

  // ------------------------------------------------------------------ the doublings that are not AGI
  /** Hook 2: the person, close, through the glitch — they push in on the voice. */
  private drawZoomPerson(c: CanvasRenderingContext2D, a: Agi, f: Frame) {
    const t = f.t, u = t - a.start, len = Math.max(0.3, a.end - a.start);
    const k = ease.outCubic(clamp(u / len));
    const h = lerp(700, 1500, k);
    drawFigure(c, W / 2 + 40, H * 0.5 + h * 0.62, h, POSE.lookUp!, this.bright ? { col: rgba('ink', 1), style: 'fill' } : { col: rgba('paper', 1), lw: lerp(6, 11, k), fill: '#14161D' });
    const hit = burst(t, a.start, 5);
    return { g: { split: 6 + 14 * hit, slice: 0.25 + 0.5 * hit, scan: 0.45, block: 0.2 * hit, tear: hit > 0.5 ? 0.5 : 0 }, shake: 5 * pulse(t, a.start, 0.05) };
  }
  // ------------------------------------------------------------------ the prism world (hook 2)
  /** A letter in ink with the spectrum split off its edges (`split` px), centred on its ink at (cx, base). */
  private inkLetter(c: CanvasRenderingContext2D, ch: string, cx: number, base: number, size: number, sc: number, split: number, alpha = 1) {
    c.save();
    c.font = font(this.fam, size);
    const m = c.measureText(ch), w = m.actualBoundingBoxRight + m.actualBoundingBoxLeft;
    const capH = CAP * size;
    c.translate(cx, base - capH / 2); c.scale(sc, sc);
    const x = -w / 2 + m.actualBoundingBoxLeft, y = capH / 2;
    c.globalAlpha = alpha;
    // the I gets slab serifs (as in the liquid letters) so it reads as a letter, not a bar
    const glyph = (dx: number) => {
      c.fillText(ch, x + dx, y);
      if (ch === 'I') { const sw = w * 1.9, sh = size * 0.1; c.fillRect(dx - sw / 2, y - capH, sw, sh); c.fillRect(dx - sw / 2, y - sh, sw, sh); }
    };
    c.globalCompositeOperation = 'multiply';
    SPECTRUM.forEach((col, i) => { c.fillStyle = col; c.globalAlpha = alpha * 0.85; glyph((i - 2.5) / 2.5 * split); });
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = alpha;
    c.fillStyle = rgba('ink', 1); glyph(0);
    c.restore();
  }

  /** The studio: where the prism stands and how it turns, per part of the hook. */
  private drawPrism(t: number, f: Frame, agi: Agi | undefined, inNames: boolean, inPray: boolean, notAgi: boolean) {
    const P = this.prism!, out = this.out!;
    clearTarget(this.ctx.renderer, out, hexToLinear(BG));
    // every sung unit turns the prism a step (a snap, eased), and flares the spectrum
    const hits = [...this.agis.flatMap((a) => a.syls.map((s) => s.t0)), ...this.nameSyls.flat().map((s) => s.t0), ...this.pray.words.map((w) => w.start), ...this.tell.words.map((w) => w.start)].filter((h) => h <= t);
    let turn = 0;
    for (const h of hits) turn += 0.42 * ease.outExpo(clamp((t - h) / 0.25));
    const last = hits.length ? Math.max(...hits) : this.ctx.start;
    const glow = 0.75 + 0.5 * pulse(t, last, 0.12);
    const sway = 0.15 * Math.sin(t * 0.7);
    if (notAgi && agi && agi.idx !== 3) {
      // no letters: the prism close, turning fast, the spectrum sweeping the frame
      const u = t - agi.start;
      const side = agi.idx === 1 ? 1 : -1;
      P.render(out, { turn: turn + side * u * 2.2, fan: 1, glow: 1.1, pos: [0, 0.1, 0], scale: 1.15,
        cam: { pos: [side * (1.4 - u * 0.8), 0.35 - 0.2 * side, 5.6 - u * 0.6], target: [0.6, 0, 0], fov: 30 } });
      return;
    }
    if (inNames) { P.render(out, { turn: turn + t * 0.3, fan: 0.55, glow: 0.8, pos: [2.6, -0.6, -3], scale: 0.9, cam: { pos: [sway, 0.5, 10], target: [0, 0, 0] } }); return; }
    if (inPray) { P.render(out, { turn, fan: 0.9, glow, pos: [3.4, -0.75, -1], scale: 0.6, cam: { pos: [sway, 0.4, 10], target: [0, 0, 0] } }); return; }
    if (agi && agi.idx === 3) { P.render(out, { turn: turn + t, fan: 0.3, glow: 0.6, pos: [-3.5, -0.8, -4], scale: 0.7, cam: { pos: [0, 0.4, 10], target: [0, 0, 0] } }); return; }
    if (agi && agi.half === 1) { P.render(out, { turn, fan: 0.8, glow, pos: [-3.3, -0.3, -2.0], scale: 1.0, cam: { pos: [sway, 0.2, 9], target: [0, 0, 0] } }); return; }
    // the letters across: the prism small, low in front of them, its spectrum running out under the type
    P.render(out, { turn, fan: agi ? 0.7 : 0.15, glow, pos: [-0.2, -0.95, 1.4], scale: 0.42, cam: { pos: [sway, 0.25, 9.5], target: [0, 0, 0] } });
    void f;
  }

  // ------------------------------------------------------------------ hook 3: the prism, broken
  private drawShards(t: number, agi: Agi | undefined, notAgi: boolean, o: PostOverrides) {
    const S = this.shards!, start = this.ctx.start;
    // the opening burst runs straight on into the first ad-lib's shards: same pieces, same camera, no
    // fading out and in again (that dip read as the shards fading in)
    const opening = t < this.agis[1]!.start;
    if (!opening && !notAgi) return;
    if (opening) {
      // the first A breaks the prism: a white frame, then its pieces fly out through the dawn
      const k = ease.outExpo(clamp((t - start) / 0.7));
      S.render(this.out!, { t, burst: 0.15 + 0.85 * k, mode: 0, k: 0, cam: [0, 0.2, 7] });
      o.flash = Math.max(o.flash ?? 0, 0.9 * pulse(t, start, 0.06));
      return;
    }
    const u = t - agi!.start;
    const mode = agi!.idx === 1 ? 0 : 1;
    // the first ad-lib breaks the glass again, from the middle of the frame, with a hit of light
    // (revision 11b: no fading or growing in — they are simply there on the beat, already flying apart)
    const burst = 1;
    if (agi!.idx === 1) o.flash = Math.max(o.flash ?? 0, 0.85 * pulse(t, agi!.start, 0.07)); // the letters go in a burst of light
    // the first ad-lib: the camera swings round the burst (a quarter turn, rising), so the pieces stream
    // past it — the letters are gone because we have moved, not because they were switched off
    let cam: [number, number, number] = [0, 0.2, 7 - u * 1.0];
    let bur = burst;
    if (agi!.idx === 1) {
      // it keeps turning (and closing in) right up to the hard cut into the next letters — no settling
      const run = u - 0.075 + 0.075 * Math.exp(-u / 0.075); // eases in, then constant speed
      const a = 1.55 * run, R = 7 - 2.2 * run;
      cam = [R * Math.sin(a), 0.2 + 1.4 * Math.sin(a), R * Math.cos(a) - 1];
      bur = 1 + 0.35 * ease.outCubic(clamp(u / 0.6));
    }
    S.render(this.out!, { t, burst: bur, mode, grow: false, k: ease.inOutCubic(clamp(u / 0.35)), cam });
  }

  /** "YAAAAAH": the word runs out from the left, the A repeating, longer and longer. */
  private drawYah(c: CanvasRenderingContext2D, lc: CanvasRenderingContext2D, t0: number, t1: number, t: number) {
    if (t < t0) return 0;
    const p = clamp((t - t0) / Math.max(0.3, (t1 - t0) * 0.85));
    const nA = 1 + Math.floor(ease.outCubic(p) * 9);
    const word = 'Y' + 'A'.repeat(nA) + 'H';
    const fam = F.archivo(125, 900);
    const size = Math.min(380, ((W - 2 * M) * 100) / measure('Y' + 'A'.repeat(10) + 'H', fam, 100));
    c.font = font(fam, size);
    const x0 = M + 10, y = H / 2 + size * 0.343;
    const w = measure(word, fam, size);
    // (it keeps stretching to the very end — the last A's and the H arrive late; no exit move)
    c.fillStyle = this.fg(1);
    c.fillText(word, x0, y);
    void w; void lc;
    return 8 * pulse(t, t0, 0.05);
  }

  // ------------------------------------------------------------------ ChatGPT Claude or Gemini
  private drawNames(c: CanvasRenderingContext2D, lc: CanvasRenderingContext2D, f: Frame) {
    // the doubled "제미나이~": a huge hairline GEMINI across the whole frame, behind everything
    const gm = this.nameSyls[3]!, tni = gm[gm.length - 1]!.t0;
    if (this.n === 3 && f.t >= tni) {
      // hook 3: the doubling under Gemini is a long "yah" — the carousel gives way and the word stretches
      this.drawYah(c, lc, tni, this.agis[4]!.start, f.t);
      return 1.2;
    }
    if (f.t >= tni) {
      // the doubled "제미나이~": GEMINI lands across the whole frame from a little larger; a band of light
      // runs through it (in the prism world: the spectrum splits off it), then it stays as a backdrop
      const fam = F.archivo(125, 900), size = ((W - 80) * 100) / measure('GEMINI', fam, 100);
      const u = f.t - tni, k = ease.outCubic(clamp(u / 0.4));
      const sc = lerp(1.14, 1, ease.outExpo(clamp(u / 0.5)));
      const y = size * 0.343 + (1 - k) * 30;
      const at = (g: CanvasRenderingContext2D) => { g.translate(W / 2, H / 2); g.scale(sc, sc); g.font = font(fam, size); g.textAlign = 'center'; };
      c.save(); at(c);
      if (this.bright) {
        c.globalCompositeOperation = 'multiply';
        const sp = lerp(36, 7, k);
        SPECTRUM.forEach((col, i) => { c.fillStyle = col; c.globalAlpha = 0.28 * k; c.fillText('GEMINI', (i - 2.5) / 2.5 * sp, y); });
        c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
        c.fillStyle = rgba('ink', 0.2 * k); c.fillText('GEMINI', 0, y);
      } else {
        c.fillStyle = this.fg(0.1 * k); c.fillText('GEMINI', 0, y);
      }
      c.restore();
      if (!this.bright) {
        lc.save(); at(lc);
        const sx = lerp(-W * 0.75, W * 0.75, ease.inOutCubic(clamp(u / 0.75)));
        const gr = lc.createLinearGradient(sx - 300, 0, sx + 300, 0);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${0.75 * (1 - clamp((u - 0.75) / 0.3))})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
        lc.fillStyle = gr; lc.fillText('GEMINI', 0, y);
        lc.fillStyle = `rgba(255,255,255,${0.05 * k})`; lc.fillText('GEMINI', 0, y);
        lc.restore();
      }
    }
    // three stagings, one per hook, so the names are never shown the same way twice
    return [this.namesColumns, this.namesSolo, this.namesCarousel][this.n - 1]!.call(this, c, lc, f);
  }

  /** The three names and their parts' times (word indices 0, 1, 3; 2 is "or"). */
  private nameInfo() {
    const em: Emblem[] = ['chatgpt', 'claude', 'gemini'];
    return [0, 1, 3].map((wi, ci) => ({ syls: this.nameSyls[wi]!, emblem: em[ci]!, ci }));
  }
  private nameText(c: CanvasRenderingContext2D, syls0: Syl[], cx: number, y: number, size: number, t: number, fam = F.serif(600)) {
    // Gemini appears whole on its first syllable (its 나이 is sung long after; per-part reads as late)
    const syls = syls0.length === 3 && syls0[0]!.ch === 'Ge' ? [{ ...syls0[0]!, ch: 'Gemini' }] : syls0;
    const full = syls.map((s) => s.ch).join('');
    const x0 = cx - measure(full, fam, size) / 2;
    c.font = font(fam, size);
    let prefix = '';
    for (const s of syls) {
      prefix += s.ch;
      if (t < s.t0) continue;
      const px = x0 + measure(prefix, fam, size) - measure(s.ch, fam, size);
      const fresh = 1 - prog(t, s.t0, s.t0 + 0.35, ease.outCubic);
      c.fillStyle = this.bright ? rgba('ink', 1) : fresh > 0.02 ? mixPaper(fresh) : rgba('paper', 1);
      c.fillText(s.ch, px, y + 8 * (1 - ease.outExpo(clamp((t - s.t0) / 0.2))));
    }
  }
  private orWord(c: CanvasRenderingContext2D, t: number, x: number, y: number, size = 72) {
    const or = this.nameSyls[2]![0]!;
    if (t < or.t0) return;
    c.font = font(F.serif(400, true), size);
    c.fillStyle = this.dim(1);
    c.textAlign = 'center'; c.fillText('or', x, y); c.textAlign = 'left';
  }

  /** Hook 1 (a cappella): three columns; above each name its emblem draws itself as the name is sung. */
  private namesColumns(c: CanvasRenderingContext2D, lc: CanvasRenderingContext2D, f: Frame) {
    const t = f.t, cols = [W * 0.2, W * 0.5, W * 0.8], y = H * 0.74;
    for (const { syls, emblem, ci } of this.nameInfo()) {
      this.nameText(c, syls, cols[ci]!, y, 120, t);
      const t0 = syls[0]!.t0;
      if (t < t0) { c.fillStyle = rgba('graphite', 0.9); c.fillRect(Math.round(cols[ci]!) - 1, y - 470, 1, 300); continue; }
      const k = ease.outCubic(clamp((t - t0) / 0.55));
      drawEmblem(lc, emblem, { x: cols[ci]!, y: y - 330, size: 150, yaw: 0.3 * Math.sin(t * 0.8 + ci) + (1 - k) * 0.9, pitch: 0.25, draw: k, lw: 1.6 });
    }
    this.orWord(c, t, W * 0.655, y - 6);
    hline(c, M, W - M, y + 36, rgba('paper', 0.14));
    return 2.6 + 2.2 * f.a.snare;
  }

  /** Hook 2: one name at a time, the whole frame — its emblem huge and turning behind it; cut on each name. */
  private namesSolo(c: CanvasRenderingContext2D, lc: CanvasRenderingContext2D, f: Frame) {
    const t = f.t, info = this.nameInfo();
    const cur = [...info].reverse().find((x) => t >= x.syls[0]!.t0) ?? info[0]!;
    const t0 = cur.syls[0]!.t0, u = t - t0;
    const k = ease.outExpo(clamp(u / 0.3));
    drawEmblem(this.bright ? c : lc, cur.emblem, { x: W / 2, y: H * 0.46, size: lerp(520, 440, k), yaw: 0.5 - u * 0.45, pitch: 0.2 - u * 0.1, roll: 0.1 * Math.sin(u), draw: ease.outCubic(clamp(u / 0.35)), lw: this.bright ? 2.4 : 2, persp: 0.35, col: this.bright ? rgba('ink', 0.85) : undefined });
    if (t >= t0) this.nameText(c, cur.syls, W / 2, H * 0.86, 150, t);
    const or = this.nameSyls[2]![0]!;
    if (cur.ci === 1 && t >= or.t0) this.orWord(c, t, W / 2 + measure('Claude', F.serif(600), 150) / 2 + 80, H * 0.86, 90);
    c.font = font(F.mono(500), 14); c.letterSpacing = '4px'; c.fillStyle = this.dim(0.85);
    c.fillText(`0${cur.ci + 1} / 03`, M, H * 0.86 - 110); c.letterSpacing = '0px';
    return 2.8 + 3.5 * pulse(t, t0, 0.15);
  }

  /** Hook 3: the three emblems on a ring in space; it turns to bring the one being sung to the front. */
  private namesCarousel(c: CanvasRenderingContext2D, lc: CanvasRenderingContext2D, f: Frame) {
    const t = f.t, info = this.nameInfo();
    let target = 0;
    info.forEach((x) => { if (t >= x.syls[0]!.t0) target = x.ci; });
    // the ring's angle eases to the current name (front = angle 0)
    let ang = 0;
    info.forEach((x) => { const t0 = x.syls[0]!.t0; ang = lerp(ang, -x.ci * (Math.PI * 2 / 3), ease.inOutCubic(clamp((t - t0 + 0.12) / 0.4))); });
    const items = info.map((x) => {
      const a = ang + x.ci * (Math.PI * 2 / 3);
      return { ...x, a, z: Math.cos(a), sx: Math.sin(a) };
    }).sort((p, q) => p.z - q.z);
    const lastNi = this.nameSyls[3]![this.nameSyls[3]!.length - 1]!.t0;
    const all = t >= lastNi ? pulse(t, lastNi, 0.25) : 0;
    for (const it of items) {
      const depth = (it.z + 1) / 2; // 0 back .. 1 front
      const x = W / 2 + it.sx * 640, y = H * 0.44 - (1 - depth) * 60, size = lerp(130, 300, depth);
      const lit = t >= it.syls[0]!.t0;
      drawEmblem(lc, it.emblem, { x, y, size, yaw: -it.a * 0.6, pitch: 0.25, draw: 1, lw: lerp(1, 2, depth), col: `rgba(255,255,255,${(lit ? lerp(0.35, 1, depth) : 0.18) + all * 0.6})` });
      if (lit && depth > 0.55) {
        c.save(); c.globalAlpha = clamp((depth - 0.55) / 0.3);
        this.nameText(c, it.syls, x, y + size + 95, lerp(80, 130, depth), t);
        c.restore();
      }
    }
    void target;
    this.orWord(c, t, W / 2, H * 0.885, 56);
    return 2.6 + 3.0 * all + 1.5 * f.a.snare;
  }

  // ------------------------------------------------------------------ 다왔다 말해줘 / tell me now
  private drawPrayer(c: CanvasRenderingContext2D, lc: CanvasRenderingContext2D, f: Frame) {
    const t = f.t, n = this.n;
    let shake = 0;
    const rowY = [H * 0.385, H * 0.685];
    const inTell = t >= this.tell.start;
    this.prayLay.forEach((lay, r) => {
      if (inTell) return;
      const x = M + 48 + r * 190;
      c.font = font(lay.family, lay.size); // (one face per row)
      for (const s of lay.syls) {
        if (t < s.t0) continue;
        const k = ease.outExpo(clamp((t - s.t0) / 0.18));
        const sc = lerp(1.08, 1, k);
        const cx = x + s.x + s.w / 2, cy = rowY[r]! - lay.size * 0.36;
        c.save(); c.translate(cx, cy); c.scale(sc, sc);
        c.fillStyle = this.fg(1);
        c.fillText(s.ch, -s.w / 2, lay.size * 0.36);
        c.restore();
        shake = Math.max(shake, (n === 1 ? 7 : 11) * pulse(t, s.t0, 0.05));
      }
    });
    // tell / me / now: one word per hit, filling the frame; the caret waits after NOW
    const tw = this.tell.words;
    const cur = [...tw].reverse().find((w) => t >= w.start);
    if (cur) {
      const word = cur.w.toUpperCase();
      const fam = F.archivo(125, 900);
      const size = Math.min(900, ((W - 2 * M) * 100) / measure(word, fam, 100));
      const k = ease.outExpo(clamp((t - cur.start) / 0.16));
      const sc = lerp(1.18, 1, k);
      const w = measure(word, fam, size);
      c.font = font(fam, size);
      c.save(); c.translate(W / 2, H / 2); c.scale(sc, sc);
      c.fillStyle = cur === tw[tw.length - 1] && !this.bright ? rgba('glow', 1) : this.fg(1);
      c.fillText(word, -w / 2, size * 0.343);
      c.restore();
      shake = Math.max(shake, 14 * pulse(t, cur.start, 0.06));
      if (cur === tw[tw.length - 1] && t > cur.start + 0.15) drawCaret(lc, W / 2 + w / 2 + 30, H / 2 + size * 0.343, size * 0.72, 18, caretBlink(f.beat * 2));
    }
    return shake;
  }

  private drawPerson(c: CanvasRenderingContext2D, t: number, inPray: boolean, inNames: boolean, agi: Agi | undefined) {
    const col = this.fg(1);
    if (inPray && t >= this.tell.start) return;
    if (inPray) {
      const keys: [number, string][] = [[this.pray.start, 'lookUp']];
      drawFigure(c, W * 0.74, this.HY, 230, poseAt(t, keys), { col, lw: 3 });
    } else if (inNames) {
      // (no figure under the names in hook 1, nor once the "yah" starts in hook 3)
      const gm = this.nameSyls[3]!;
      if (this.n === 1 || (this.n === 3 && t >= gm[gm.length - 1]!.t0)) return;
      const ws = this.names.words;
      const keys: [number, string][] = [[ws[0]!.start, 'wait'], [ws[1]!.start, 'lookUp'], [ws[3]!.start, 'glance']];
      drawFigure(c, W * 0.76, this.HY, 150, poseAt(t, keys), { col, lw: 2.5 });
    } else if (agi && agi.half === 0) {
      drawFigure(c, W / 2 + 6, this.HY, 96, POSE.lookUp!, { col, lw: 2 });
    } else if (agi) {
      // (no figure while one letter fills the frame: the bottom corners belong to the readouts)
    } else {
      drawFigure(c, W / 2 + 6, this.HY, 96, POSE.stand!, { col, lw: 2, alpha: prog(t, this.ctx.start, this.ctx.start + 0.4) });
    }
  }

  /** Bottom-left: how close we are, according to the hook. */
  private drawArrival(c: CanvasRenderingContext2D, t: number) {
    const n = this.n, { start, end } = this.ctx;
    const from = [97.2, 99.0, 99.9][n - 1]!, to = [99.0, 99.9, 99.99][n - 1]!;
    // climbs a step on every sung AGI
    const done = this.agis.filter((a) => t >= a.start).length / this.agis.length;
    const v = lerp(from, to, done);
    const digits = n === 3 ? 3 : 2;
    const a = smoothstep(start, start + 0.4, t);
    c.font = font(F.mono(500), 13); c.letterSpacing = '3px';
    c.fillStyle = this.dim(0.8 * a);
    c.fillText('ARRIVAL', M, H - M - 24);
    c.letterSpacing = '0px';
    c.font = font(F.mono(400), 22);
    const flick = t >= this.pray.start && frameIdx(t) % 8 < 4 && t < end;
    c.fillStyle = flick ? rgba('dawn', 0.85 * a) : this.fg(0.85 * a);
    c.fillText(`${v.toFixed(digits)} %`, M, H - M);
    // jitter in the last digit while we wait
    void hash;
  }
}

function mixPaper(fresh: number) {
  const p = [241, 238, 230], g = [255, 214, 140];
  const m = p.map((v, i) => Math.round(v + (g[i]! - v) * fresh));
  return `rgb(${m[0]},${m[1]},${m[2]})`;
}
