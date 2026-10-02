// GRIND ×2 — the verse, twice (revision 4). One line, one 3D object, told as plainly and as
// beautifully as a product film: the lyric is set in the left column (LINE Seed, the key word Bold), the
// object stands in the right half of the frame in a small studio and the camera moves around it.
//   1 다 끝났다고 말해줄래 내일   a bar fills to 99 %; a desk calendar turns its page to 내일 (day: 오늘)
//   2 기다리고 있거든 매일        the calendar's days race by; the person sits and waits (day: it stops at 끝)
//   3 더이상 찾기 싫어 새 일      notifications stack up in depth; 싫어 swipes them away (day: carets take them)
//   4 새 일 자리 어디에 있지      rows of chairs, all taken; the person walks along looking (day: a gold chair)
//   5 하기싫어 시키는 일만은      tasks rain down and glance off the person, arms crossed (day: they hang still)
//   6 그 자식들은 아직도 기만을   three faceless people in smiling gold masks; on 기 만 을 the masks shatter
//   7 나도 이제 밑에 agent       나 on a gold plinth; small round agents pop up below and keep doubling (day: they walk beside us)
//   8 시켜서 태업 아님 폐업       night: the agents stop and go dark; the shutter comes down. day: the building collapses
// pass 1 = night (paper type on ink, gold objects). pass 2 = day (ink on paper, a gold mirror floor).
import * as THREE from 'three';
import { BOLD } from '../engine/scale';

import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import type { Line, Word } from '../engine/lyrics';
import { clamp, ease, hash, lerp, noise1, pulse } from '../engine/util';
import { Glitch, Light, M, burst, hline, layoutWords, seedMix, wordSyls, type LineLayout } from './_kit';
import { beatPulse, dawnLevel, drawClock } from './_clock';
import { Sky } from './_kit';
import { POSE, drawFigure, poseAt, setFigureFill } from './_figure';
import { Stage3D, ballistic } from './_stage3d';
import { AGENT_H, Agents, Building, Camel, DeskCalendar, FigureSprite, Mask, cardFace, cardGeometry, contactShadow } from './_objects3d';
import { camAt, type CamKey } from './_camrig';

const GOLD = '#B8740C';
const COLW = 820; // the text column's width (x from M)
const AGENTS = 4200; // most agents drawn at once
// night, lines 7-8 (revision 9): 나 stands on top of a stepped gold ziggurat; the agents fill its treads
// rank by rank (front first, centre out), then square ranks spread across the floor around it
const PL: [number, number] = [0.3, -1.0]; // the ziggurat's centre on the floor
const TIERS: [number, number][] = [[0.55, 0.9], [1.1, 0.6], [1.65, 0.3]]; // [half size, height], top first
const AG_N = 1.15; // night agent scale (≈ 0.55 m)
const AG_D = 2.35; // day: companion-sized agents (≈ 1.1 m)
const WALK_V = 1.05; // day line 7: walking speed (m/s; they walk right to left, the way the pictogram faces when mirrored)

export default class Grind extends Scene {
  pass = 1;
  L = new Layer2D();
  light = new Light();
  glitch = new Glitch();
  lines: Line[] = [];
  cuts: number[] = [];
  lay: Record<string, LineLayout> = {};
  day = false;
  sky = new Sky();
  scratch = new Layer2D(64, 64, 1);
  textAlpha = 1;
  st!: Stage3D;
  grp: THREE.Group[] = [];
  cal1!: DeskCalendar; cal2!: DeskCalendar; camel!: Camel;
  cards: THREE.Mesh[] = []; cardCarets: THREE.Mesh[] = [];
  tasks: THREE.Mesh[] = [];
  masks: Mask[] = []; maskPeople: FigureSprite[] = [];
  agents!: Agents;
  /** everything of the agents' scene (night: lines 7 and 8 share it) */
  stage7 = new THREE.Group();
  building!: Building;
  me: FigureSprite[] = [];
  /** night: the agents' places (on the ziggurat's treads, then the floor ranks), in order of arrival;
   * d = distance from 나 (for ripples), yaw = facing */
  slots: { x: number; y: number; z: number; d: number; yaw: number }[] = [];
  /** day: the procession behind the leading pair — a person and an agent side by side, in arrival order */
  pairs: { x: number; hz: number; az: number; d: number; ph: number }[] = [];
  /** night: a thin gold square on the floor under each squad, drawn in when its first agent lands */
  pads: { line: THREE.LineSegments; first: number; d: number }[] = [];
  figs: FigureSprite[] = [];
  dday = 12;

  override init() {
    const { lyrics, audio: au, params, start, end } = this.ctx;
    this.pass = Number(params.pass ?? 1);
    this.day = this.pass === 2;
    this.lines = lyrics.section(String(params.section ?? 'verse1'));
    if (this.lines.length !== 8) throw new Error('grind: expected 8 verse lines');
    this.cuts = this.lines.map((l, i) => {
      if (i === 0) return start;
      const db = au.downbeats.reduce((b, d) => (Math.abs(d - l.start) < Math.abs(b - l.start) ? d : b), au.downbeats[0]!);
      return Math.min(db, l.start - 0.04);
    });
    this.cuts.push(end);
    this.layoutText();
    this.build3D();
  }

  // ------------------------------------------------------------------ text
  private layoutText() {
    const W_ = (i: number, a: number, b?: number) => this.lines[i]!.words.slice(a, b);
    const D = seedMix(['끝났다고', '매일', '싫어', '새', '일', '어디에', '있지', '하기', '기만을', '나도', '태업', '폐업']);
    const T = F.seed(400);
    // set at `size`, shrunk until the line fits the text column
    const L_ = (k: string, words: Word[], fam: string | ((w: Word) => string), size: number, gap = 0.26) => {
      let lay = layoutWords(words, fam, size, gap);
      if (lay.width > COLW) lay = layoutWords(words, fam, (size * COLW) / lay.width, gap);
      this.lay[k] = lay;
    };
    L_('1a', W_(0, 0, 2), D, 170); L_('1b', W_(0, 2, 3), T, 92); L_('1c', W_(0, 3), F.seed(700), 210);
    L_('2a', W_(1, 0, 2), T, 92); L_('2b', W_(1, 2), D, 330);
    L_('3a', W_(2, 0, 3), T, 92); L_('3b', W_(2, 3, 4), D, 300); L_('3c', W_(2, 4), D, 150, 0.2);
    L_('4a', W_(3, 0, 2), T, 92, 0.22); L_('4b', W_(3, 2), D, 200);
    L_('5a', W_(4, 0, 2), D, 240); L_('5b', W_(4, 2), T, 92);
    L_('6a', W_(5, 0, 2), T, 92); L_('6b', W_(5, 2, 3), T, 92); L_('6c', W_(5, 3), D, 300);
    L_('7a', W_(6, 0, 1), D, 260); L_('7b', W_(6, 1, 3), T, 92); L_('7c', W_(6, 3), F.mono(300), 72, 0);
    L_('8a', W_(7, 0, 2), D, 120); L_('8b', W_(7, 2, 3), T, 92); L_('8d', W_(7, 3), D, 300);
    // 'agent' lands as one word, not a / gen / t
    const ag = this.lay['7c']!;
    ag.syls = [{ ...ag.syls[0]!, ch: ag.syls.map((x) => x.ch).join(''), w: ag.width }];
    // one grid for every line: each row's ink starts exactly on the left margin, and the rows of a
    // line are stacked with the same air between their ink, the block centred on the frame
    const mc = document.createElement('canvas').getContext('2d')!;
    const ink = (k: string) => {
      const lay = this.lay[k]!;
      let asc = 0, desc = 0;
      for (const x of lay.syls) { mc.font = font(x.fam, lay.size); const m = mc.measureText(x.ch); asc = Math.max(asc, m.actualBoundingBoxAscent); desc = Math.max(desc, m.actualBoundingBoxDescent); }
      const f0 = lay.syls[0]!; mc.font = font(f0.fam, lay.size);
      // optical left edge (revision 15b): where the first letter's mass begins, not its outermost tip —
      // render it and take the first column whose ink covers a fifth of the letter's height, so a
      // diagonal ㅅ and a straight ㄷ line up the way the eye sees them
      const size = lay.size, cw = Math.ceil(size * 1.6), ch = Math.ceil(size * 1.4);
      const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      const g = cv.getContext('2d', { willReadFrequently: true })!;
      g.font = font(f0.fam, size); g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
      const ox = Math.ceil(size * 0.3), oy = Math.ceil(size * 1.1);
      g.fillText(f0.ch, ox, oy);
      const img = g.getImageData(0, 0, cw, ch).data;
      let top = ch, bot = 0;
      const colInk = new Array(cw).fill(0);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (img[(y * cw + x) * 4 + 3]! > 128) { colInk[x]++; top = Math.min(top, y); bot = Math.max(bot, y); }
      const need = Math.max(1, (bot - top) * 0.2);
      let vx = colInk.findIndex((n) => n >= need);
      if (vx < 0) vx = ox;
      return { asc, desc, left: ox - vx };
    };
    const rows = [['1a', '1b', '1c'], ['2a', '2b'], ['3a', '3b', '3c'], ['4a', '4b'], ['5a', '5b'], ['6a', '6b', '6c'], ['7a', '7b', '7c'], ['8a', '8b', '8d']];
    for (const keys of rows) {
      const m = keys.map(ink), sz = keys.map((k) => this.lay[k]!.size);
      const gaps = keys.slice(1).map((_, i) => 30 + 0.1 * (sz[i]! + sz[i + 1]!) / 2);
      const total = m.reduce((a, x) => a + x.asc + x.desc, 0) + gaps.reduce((a, g) => a + g, 0);
      let y = 1080 * 0.5 - total / 2 + (keys[0] === '1a' ? -40 : 0);
      keys.forEach((k, i) => {
        y += m[i]!.asc;
        this.Y[k] = Math.round(y); this.X[k] = Math.round(M + m[i]!.left);
        y += m[i]!.desc + (gaps[i] ?? 0);
      });
    }
  }
  X: Record<string, number> = {}; Y: Record<string, number> = {};
  /** Set row `k` on the grid. */
  private put(c: CanvasRenderingContext2D, k: string, t: number, o: { col?: string; hot?: string; amt?: number } = {}) {
    this.set(c, this.lay[k]!, this.X[k]!, this.Y[k]!, t, o);
  }

  // ------------------------------------------------------------------ 3D
  private build3D() {
    const st = (this.st = new Stage3D(this.ctx, this.day));
    st.shiftX = 520;
    const S = st.scene, day = this.day;
    // the floor: a gold mirror by day; at night ink with a faint gold grid
    const floorGeo = new THREE.PlaneGeometry(140, 60);
    floorGeo.translate(day ? 14 : 0, 0, 0);
    floorGeo.rotateX(-Math.PI / 2);
    S.add(new THREE.Mesh(floorGeo, day
      ? new THREE.MeshStandardMaterial({ color: new THREE.Color(1, 0.78, 0.45), metalness: 1, roughness: 0.22, envMapIntensity: 0.9 })
      : new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...LIN.ink), metalness: 0.0, roughness: 0.8, envMapIntensity: 0.03 })));
    if (!day) {
      const grid = new THREE.GridHelper(40, 80, new THREE.Color(0.5, 0.33, 0.12), new THREE.Color(0.18, 0.12, 0.06));
      grid.position.y = 0.002;
      (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.35;
      S.add(grid);
    }
    for (let i = 0; i < 8; i++) { const g = new THREE.Group(); g.visible = false; this.grp.push(g); S.add(g); }
    const FILL = day ? '#E9E3D7' : '#23262E';
    const fig = (col: string, h = 1.75) => { const f = new FigureSprite(h, col, 'line', FILL); this.figs.push(f); return f; };
    const me = (i: number) => { const f = fig(day ? '#0B0C10' : '#F1EEE6'); this.me[i] = f; this.grp[i]!.add(f.sprite, f.shadow); return f; };

    // 1, 2: calendars
    this.cal1 = new DeskCalendar(st, [{ label: '오늘', sub: 'TODAY' }, { label: '내일', sub: 'TOMORROW' }]);
    this.cal1.group.scale.setScalar(1.25);
    this.camel = new Camel(st);
    if (day) this.grp[0]!.add(this.camel.group);
    else this.grp[0]!.add(this.cal1.group, contactShadow(1.5, 0.7));
    // night: enough days that the pages never run out before the cut. day: a countdown, D-99 racing down
    // to D-DAY, which it reaches on 매일 and stops at
    const nNight = Math.ceil(this.flips(this.cuts[2]!)) + 4;
    const days = Array.from({ length: nNight }, (_, i) => ({ label: String(((i * 7 + 3) % 28) + 1), sub: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'][i % 7]! }));
    if (day) {
      const iD = this.dday = Math.max(2, Math.floor(this.flips(this.first('2b').t0)));
      days.length = 0;
      let prev = 100;
      for (let i = 0; i < iD; i++) { const d = Math.min(prev - 1, Math.max(iD - i, Math.round(99 * Math.pow(1 - i / iD, 1.6)))); days.push({ label: `D-${d}`, sub: 'COUNTDOWN' }); prev = d; }
      days.push({ label: 'D-DAY', sub: 'COUNTDOWN' }, { label: '', sub: '' });
    }
    this.cal2 = new DeskCalendar(st, days);
    this.cal2.group.scale.setScalar(1.25);
    this.grp[1]!.add(this.cal2.group, contactShadow(1.5, 0.7));
    me(1).sprite.position.set(-1.75, 0, 0.6);
    this.me[1]!.chair = true;

    // 3: notification cards
    const cg = cardGeometry(1.9, 0.6, 0.12, 0.05);
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(cg, [new THREE.MeshStandardMaterial({ map: cardFace(i, day ? GOLD : '#FF3D6E'), roughness: 0.35, metalness: 0.1 }), st.gold]);
      this.cards.push(m); this.grp[2]!.add(m);
      const car = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.05), st.gold);
      car.position.set(0.85, 0, 0.06); car.visible = false; m.add(car); this.cardCarets.push(car);
    }
    me(2).sprite.position.set(-1.9, 0, 0.4);
    if (day) {
      const tray = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.7), st.gold); base.position.y = 0.02;
      const wallF = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 0.03), st.gold); wallF.position.set(0, 0.1, 0.34);
      const wallB = wallF.clone(); wallB.position.z = -0.34;
      const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.7), st.gold); wallL.position.set(-0.69, 0.1, 0);
      const wallR = wallL.clone(); wallR.position.x = 0.69;
      tray.add(base, wallF, wallB, wallL, wallR, contactShadow(0.8, 0.5));
      tray.position.set(0.3, 0, 1.2);
      this.grp[2]!.add(tray);
    }

    // 4: night: rows of chairs, all taken. day: applicants queueing at an office door
    if (!day) {
      // the seats are drawn with their sitters (one picture each): every place taken, all sitting upright
      for (let r = 0; r < 2; r++) for (let q = 0; q < 5; q++) {
        const sitter = fig('#8E919B');
        sitter.chair = true;
        sitter.pose(POSE.sitUp!);
        sitter.sprite.position.set(-2.2 + q * 1.15 + r * 0.55, 0, -r * 1.7);
        this.grp[3]!.add(sitter.sprite, sitter.shadow);
      }
    } else {
      const office = new Building(st, 5);
      office.group.position.set(2.15, 0, -2.4); office.group.scale.setScalar(0.8);
      this.grp[3]!.add(office.group);
      for (let q = 0; q < 6; q++) {
        const p = fig('#4A4D57');
        p.pose(q % 3 === 1 ? POSE.wait! : POSE.stand!);
        p.sprite.position.set(1.05 - q * 0.72, 0, -1.6 + q * 0.12);
        this.grp[3]!.add(p.sprite, p.shadow);
      }
    }
    me(3);
    if (day) this.grp[3]!.position.x = -0.4; // (revision 9: clear of the text column)

    // 5: tasks raining
    const tg = cardGeometry(0.5, 0.32, 0.05, 0.04);
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(tg, [new THREE.MeshStandardMaterial({ map: cardFace(i + 20, day ? GOLD : '#FFB648'), roughness: 0.4 }), st.gold]);
      this.tasks.push(m); this.grp[4]!.add(m);
    }
    me(4).sprite.position.set(0, 0, 0.3);

    // 6: three faceless people in gold masks
    for (let i = 0; i < 3; i++) {
      const p = fig(day ? '#0B0C10' : '#F1EEE6', 1.9);
      p.pose(POSE.stand!);
      p.sprite.position.set(-0.8 + i * 1.15, 0, 0);
      this.maskPeople.push(p); this.grp[5]!.add(p.sprite, p.shadow);
      const mk = new Mask(st, i + 1);
      mk.group.scale.setScalar(0.42);
      mk.group.position.set(-0.8 + i * 1.15, 1.72, 0.2);
      this.masks.push(mk); this.grp[5]!.add(mk.group);
    }

    // 7 (revision 9): the agents. Night: 나 stands on top of a stepped gold ziggurat. From 밑 the agents
    // arrive (the count doubles on every 8th note), filling its treads rank by rank, front first and from
    // the centre out, then square ranks spread out over the floor; the camera cranes up and back to
    // reveal how many. On 태업 they freeze, slump and go dark from the far ranks in; the shutter comes
    // down on 폐업. Day: a procession walks toward us — the person and one companion-sized agent in
    // front, side by side, and behind them rows of people and agents walking together.
    this.agents = new Agents(st, AGENTS);
    this.stage7.add(this.agents.group);
    this.grp[6]!.add(this.stage7);
    {
      const f = fig(day ? '#0B0C10' : '#F1EEE6');
      this.me[6] = f;
      this.stage7.add(f.sprite);
      // (revision 11b: day reuses the night's staging — the ziggurat and the squads — and only the person's
      // gesture differs: at night 나 crosses their arms over the agents; by day they wave hello to them)
      f.sprite.position.set(PL[0], TIERS[0]![1], PL[1] + 0.05);
      const s = contactShadow(0.3, 0.7); s.position.set(PL[0], TIERS[0]![1] + 0.004, PL[1] + 0.05);
      this.stage7.add(s);
    }
    this.buildZiggurat(st);

    // 8: the building
    this.building = new Building(st, 9);
    this.building.group.scale.setScalar(1.1);
    if (day) {
      this.grp[7]!.add(this.building.group, contactShadow(1.6, 0.75));
      me(7).sprite.position.set(-2.0, 0, 1.0);
    }
    // day, lines 5-8 (a cappella): one continuous take — the four objects stand in a row along the gold
    // floor and the camera travels from one to the next instead of cutting
    // (revision 8b: verse 2's a cappella lines cut like the others — the long take's camera travel
    // smeared into ghost images under motion blur)
  }

  // ------------------------------------------------------------------ 7: agents' stages
  /** Night lines 7-8: one continuous camera move — close on 나, then up and back as the ranks fill;
   * it comes to rest on 태 (when everything freezes). */
  private keysNight(): CamKey[] {
    const P = (x: number, y: number, z: number): [number, number, number] => [PL[0] + x, y, PL[1] + z];
    const t7 = this.cuts[6]!, mit = this.syl('7b', 2).t0, e = this.syl('7b', 3).t0, ag = this.first('7c').t0;
    const tae = this.syl('8a', 3).t0;
    return [
      { t: t7, pos: P(0.75, 2.05, 8.2), tgt: P(-0.3, 1.4, 0) },
      { t: mit, pos: P(1.0, 2.45, 8.9), tgt: P(-0.25, 1.2, 0) },
      { t: e, pos: P(1.9, 3.9, 9.4), tgt: P(0.1, 0.8, -0.2) },
      { t: ag + 0.6, pos: P(2.6, 7.2, 12.4), tgt: P(0.3, 0.3, -1.4) },
      { t: tae, pos: P(2.9, 8.6, 13.9), tgt: P(0.35, 0.2, -2.0) },
    ];
  }
  /** Day line 7: the camera tracks sideways with the procession (positions relative to the leader). */
  private keysDay7(): CamKey[] {
    const t7 = this.cuts[6]!, mit = this.syl('7b', 2).t0, ag = this.first('7c').t0, t8 = this.cuts[7]!;
    return [
      // (walking right to left: the camera leads a little on the left and rises to show the legion behind)
      { t: t7, pos: [-2.6, 1.4, 5.3], tgt: [-0.2, 0.95, -0.5] },
      { t: mit, pos: [-3.2, 2.0, 7.2], tgt: [-0.1, 0.9, -1.4] },
      { t: ag, pos: [-2.6, 5.4, 11.6], tgt: [1.8, 0.4, -5.6] },
      { t: t8, pos: [-2.3, 6.8, 13.2], tgt: [2.4, 0.3, -7.8] },
    ];
  }
  /** Day line 7: how far the procession has walked (to the right, +x). */
  private leadX(t: number) { return -WALK_V * (t - this.cuts[6]!); }

  private buildZiggurat(st: Stage3D) {
    const S = this.stage7;
    // the ziggurat: three stacked blocks of dark lacquer with gold treads and gold wire edges
    const brass = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.95, 0.6, 0.22), metalness: 0.65, roughness: 0.36, envMapIntensity: 0.55 });
    for (const [h, y] of TIERS) {
      const g = new THREE.BoxGeometry(2 * h, y, 2 * h);
      const m = new THREE.Mesh(g, [st.ink, st.ink, brass, st.ink, st.ink, st.ink]); m.position.set(PL[0], y / 2, PL[1]);
      const e = st.edges(g, 0.85); e.position.copy(m.position);
      S.add(m, e);
    }
    const sh = contactShadow(TIERS[2]![0] * 1.75, 0.75); sh.position.set(PL[0], 0.004, PL[1]); S.add(sh);
    // places: square ranks on the two treads (each side a straight row, corners left open), then
    // squads of 4 × 4 on the floor in a grid with aisles, ring by ring around the ziggurat
    const sp = 0.47;
    type Sl = { x: number; y: number; z: number; d: number; yaw: number; key: number; sq?: number };
    const out: Sl[] = [];
    const ring = (r: number, y: number, ri: number) => {
      const m = Math.max(1, Math.round((2 * r) / sp));
      for (let j = 0; j < m; j++) {
        const u = -r + ((j + 0.5) * 2 * r) / m;
        // perimeter distance from the front centre: front, then both sides (front to back), then the back
        const sides: [number, number, number][] = [[u, r, Math.abs(u)], [-r, -u, r + (r + u)], [r, -u, r + (r + u)], [u, -r, 3 * r + (r - Math.abs(u))]];
        for (const [x, z, per] of sides) out.push({ x: PL[0] + x, y, z: PL[1] + z, d: 0, yaw: 0, key: ri * 1000 + per + (x < 0 ? 0.001 : 0) });
      }
    };
    ring((TIERS[0]![0] + TIERS[1]![0]) / 2, TIERS[1]![1], 0);
    ring((TIERS[1]![0] + TIERS[2]![0]) / 2, TIERS[2]![1], 1);
    const pitch = 2.95;
    for (let i = -7; i <= 11; i++) for (let j = -11; j <= 7; j++) {
      const rI = Math.max(Math.abs(i), Math.abs(j));
      if (rI === 0) continue;
      // squads in front first, then the sides, then behind; within a ring, centre out
      const per = j >= rI ? Math.abs(i) : j <= -rI ? 3 * rI + (rI - Math.abs(i)) : rI + (rI - j);
      for (let q = 0; q < 16; q++) {
        const qx = (q % 4) - 1.5, qz = Math.floor(q / 4) - 1.5;
        out.push({ x: PL[0] + i * pitch + qx * sp, y: 0, z: PL[1] + j * pitch + qz * sp, d: 0, yaw: 0, key: (1 + rI) * 1000 + per * 20 + (i < 0 ? 10 : 0) + (qz * 4 + qx) * 0.01, sq: (i + 7) * 19 + (j + 11) });
      }
    }
    out.sort((a, b) => a.key - b.key);
    // keep the left text column clear: drop floor places that any later frame of the shot would project
    // left of x ≈ 930 px (the ranks' outer edge then runs along a straight line on the floor)
    const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 200);
    cam.setViewOffset(1920, 1080, -this.st.shiftX, 0, 1920, 1080);
    const keys = this.keysNight(), v = new THREE.Vector3();
    const tA = this.first('7c').t0 - 0.3, tB = keys[keys.length - 1]!.t;
    const cams: THREE.PerspectiveCamera[] = [];
    for (let t = tA; t <= tB + 1e-6; t += 0.1) {
      const c = cam.clone(); const k = camAt(t, keys);
      c.position.set(...k.pos); c.lookAt(...k.tgt); c.fov = k.fov; c.updateProjectionMatrix(); c.updateMatrixWorld(); cams.push(c);
    }
    const fin = cams[cams.length - 1]!;
    // a squad stays whole or goes: drop it if any of its places would cross into the text column or sit
    // under the clock / off the top or right of the frame
    const badSq = new Set<number>();
    // (revision 9b) the field may reach into the left half wherever there is no type: a squad goes only
    // if some frame would put it on a text row of lines 7-8 (with a margin) or under the clock
    const rects = ['7a', '7b', '7c', '8a', '8b', '8d'].map((k) => {
      const lay = this.lay[k]!, extra = k === '7c' ? 300 : 40;
      return [this.X[k]! - 40, this.Y[k]! - lay.size * 0.9 - 30, this.X[k]! + lay.width + extra, this.Y[k]! + lay.size * 0.2 + 30] as const;
    });
    // (the clock in the top-right corner may sit over the far ranks: the field runs to the frame's edges)
    const onText = (px: number, py: number) => rects.some(([x0, y0, x1, y1]) => px > x0 && px < x1 && py > y0 && py < y1) || px < 30;
    for (const s of out) {
      if (s.sq === undefined || badSq.has(s.sq)) continue;
      for (const c of cams) {
        let hit = false;
        for (const [dx, dy] of [[-0.22, 0.05], [0.22, 0.05], [-0.22, 0.45], [0.22, 0.45]] as const) {
          v.set(s.x + dx, s.y + dy, s.z).project(c);
          if (v.z < 1 && onText((v.x + 1) * 960, (1 - v.y) * 540)) { hit = true; break; }
        }
        if (hit) { badSq.add(s.sq); break; }
      }
    }
    for (const s of out) {
      if (s.sq !== undefined && badSq.has(s.sq)) continue;
      s.d = Math.hypot(s.x - PL[0], s.z - PL[1]);
      s.yaw = Math.atan2(fin.position.x - s.x, fin.position.z - s.z) * 0.55;
      this.slots.push(s);
    }
    // squad pads
    const seen = new Map<number, number>();
    this.slots.forEach((s, i) => { const q = (s as Sl).sq; if (q !== undefined && !seen.has(q)) seen.set(q, i); });
    const hs = 1.5 * sp + 0.34;
    const padGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(2 * hs, 2 * hs).rotateX(-Math.PI / 2));
    for (const [q, first] of seen) {
      const i = Math.floor(q / 19) - 7, j = (q % 19) - 11;
      const line = new THREE.LineSegments(padGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(1.6, 0.95, 0.42), transparent: true, opacity: 0, depthWrite: false }));
      line.position.set(PL[0] + i * pitch, 0.006, PL[1] + j * pitch);
      this.pads.push({ line, first, d: Math.hypot(i * pitch, j * pitch) });
      S.add(line);
    }
  }

  private buildProcession(day: boolean) {
    void day;
    // everyone walks to the right (the pictogram's walk is a side view; right = ahead). Each place is a
    // pair — a person and, on their far side, an agent — in ranks that recede in depth behind the
    // leading pair; the ranks also open further columns behind as they go back
    // the camera moves with the leader, so one check against its path keeps the crowd clear of the text
    // column and the clock
    const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 200);
    cam.setViewOffset(1920, 1080, -this.st.shiftX, 0, 1920, 1080);
    const keys = this.keysDay7(), v = new THREE.Vector3(), cams: THREE.PerspectiveCamera[] = [];
    for (let t = this.syl('7b', 2).t0; t <= keys[keys.length - 1]!.t + 1e-6; t += 0.1) {
      const c = cam.clone(); const k = camAt(t, keys);
      c.position.set(...k.pos); c.lookAt(...k.tgt); c.fov = k.fov; c.updateProjectionMatrix(); c.updateMatrixWorld(); cams.push(c);
    }
    const ok = (x: number, z: number) => cams.every((c) => {
      for (const [dx, y] of [[-0.45, 1.85], [-0.45, 0], [0.6, 1.85]] as const) {
        v.set(x + dx, y, z).project(c);
        const px = (v.x + 1) * 960, py = (1 - v.y) * 540;
        if (px < 930 || (px > 1460 && py < 230 && v.z < 1)) return false;
      }
      return true;
    });
    // (revision 10b) the person and the companion walk right to left past a legion of agents standing in
    // ranks that stretch far back; it grows as the count climbs — front ranks first, then deeper and
    // deeper (every 16th), each agent popping up in place; the near ones turn their heads as they pass
    const tMit = this.lay['7b']!.syls.find((q) => q.ch === '밑')?.t0 ?? this.cuts[6]! + 1;
    const xs = [this.leadX(this.cuts[6]!), this.leadX(this.cuts[7]!)];
    const x0 = Math.min(...xs) - 8, x1 = Math.max(...xs) + 6;
    for (let r = 0; r < 18; r++) for (let x = x0 + (r % 2) * 0.42; x <= x1; x += 0.84) {
      const z = -1.95 - r * 0.9;
      if (!ok(x, z)) continue;
      // birth order: rank by rank from the front, and along a rank outward from where the person is
      const xb = this.leadX(tMit + r * 0.12);
      this.pairs.push({ x, hz: z, az: z, d: r * 6 + Math.abs(x - xb) * 0.5, ph: r % 2 });
    }
    this.pairs.sort((a, b) => a.d - b.d);
    mirror(this.me[6]!);
  }

  /** The night agents at time t (lines 7 and 8 share the shot). */
  private nightAgents(t: number) {
    const au = this.ctx.audio;
    const tae = this.syl('8a', 3).t0, pye = this.first('8d').t0;
    const tm = Math.min(t, tae); // everything freezes on 태
    const { from, total } = this.agentCount(tm);
    const shown = Math.min(AGENTS, total, this.slots.length);
    const beat = au.beatAt(tm);
    const agentSyl = wordSyls(this.lines[6]!.words[3]!).map((s) => s.t0);
    const t8 = this.cuts[7]!;
    const dMax = this.slots.length ? this.slots[Math.min(shown, this.slots.length) - 1]?.d ?? 1 : 1;
    const A = this.agents;
    A.begin();
    for (let i = 0; i < shown; i++) {
      const s = this.slots[i]!;
      const age = t - this.agentBorn(i, from);
      const g = AG_N * ease.outBack(clamp(age / 0.24), 2.2);
      // the eyes open just after they land
      const blink = 1 - clamp((age - 0.1) / 0.06);
      // on the beat they all bob together; on 시켜서 they work (8ths, in a checkerboard)
      let hop = 0;
      if (age > 0.24) {
        if (tm < t8) { const fr = ((beat % 1) + 1) % 1; hop = fr < 0.3 ? fr / 0.3 : 0; }
        else { const par = (Math.round((s.x - PL[0]) / 0.47) + Math.round((s.z - PL[1]) / 0.47)) & 1; const fr = (((beat * 2 + par * 0.5) % 1) + 1) % 1; hop = fr < 0.45 ? fr / 0.45 : 0; }
      }
      // a ripple of light from 나 outward on a · gen · t
      let glow = 0;
      for (const ts of agentSyl) glow += 1.4 * pulse(t, ts + s.d * 0.035, 0.09);
      // 태: they freeze (eyes flash once), then from the far ranks in, slump and go dark before 폐
      glow += 1.2 * pulse(t, tae, 0.07);
      const tOff = tae + 0.14 + (1 - s.d / Math.max(1, dMax)) * (pye - tae - 0.42) + hash(i, 9) * 0.1;
      const off = clamp((t - tOff) / 0.07);
      A.set(s.x, s.y, s.z, g, s.yaw, hop, 1 - off, Math.max(blink, off * 0.6), glow * (1 - off), 0.22 * ease.outCubic(off));
    }
    A.end();
    for (const p of this.pads) {
      const on = p.first < shown ? clamp((t - this.agentBorn(p.first, from)) / 0.18) : 0;
      const tOff = tae + 0.14 + (1 - p.d / Math.max(1, dMax)) * (pye - tae - 0.42);
      let gl = 0;
      for (const ts of agentSyl) gl += 0.5 * pulse(t, ts + p.d * 0.035, 0.1);
      (p.line.material as THREE.LineBasicMaterial).opacity = on * (0.45 + gl) * (1 - 0.8 * clamp((t - tOff) / 0.1));
    }
    return total;
  }

  // ------------------------------------------------------------------ theme + type
  private fg(a = 1) { return rgba(this.day ? 'ink' : 'paper', a); }
  private dimc(a = 1) { return rgba(this.day ? 'graphite' : 'ash', a); }
  private neg(a = 1) { return rgba('rose', a); }
  private acc(a = 1) { return this.day ? hexA(GOLD, a) : rgba('dawn', a); }

  /** Set a layout syllable by syllable: each lands at its sung time from slightly larger, warm for a moment. */
  private set(c: CanvasRenderingContext2D, lay: LineLayout, x: number, y: number, t: number, o: { col?: string; hot?: string; amt?: number } = {}) {
    const col = o.col ?? this.fg(), hot = o.hot ?? col, amt = o.amt ?? 0.07;
    c.textBaseline = 'alphabetic';
    for (const s of lay.syls) {
      if (t < s.t0) continue;
      c.font = font(s.fam, lay.size);
      const k = ease.outExpo(clamp((t - s.t0) / 0.2));
      const sc = lerp(1 + amt, 1, k);
      c.save();
      c.translate(x + s.x + s.w / 2, y - lay.size * 0.36);
      c.scale(sc, sc);
      c.globalAlpha = clamp((t - s.t0) / 0.035) * this.textAlpha;
      c.fillStyle = t < s.t0 + 0.12 ? hot : col;
      c.fillText(s.ch, -s.w / 2, lay.size * 0.36);
      c.restore();
    }
  }
  /** Pages turned on line 2's calendar by time t: one per 8th note for two beats, then one per 16th. */
  private flips(t: number) { const b = Math.max(0, this.beats(t, this.cuts[1]!)); return b < 2 ? b * 2 : 4 + (b - 2) * 4; }
  private first(k: string) { return this.lay[k]!.syls[0]!; }
  private last(k: string) { const s = this.lay[k]!.syls; return s[s.length - 1]!; }
  private syl(k: string, i: number) { const s = this.lay[k]!.syls; return s[Math.min(i, s.length - 1)]!; }
  private beatT(t0: number, k: number) { const au = this.ctx.audio; return au.timeOfBeat(au.beatAt(t0) + k); }
  private beats(t: number, t0: number) { const au = this.ctx.audio; return au.beatAt(t) - au.beatAt(t0); }
  private mono(c: CanvasRenderingContext2D, s: string, x: number, y: number, size = 15, col = this.dimc(), align: CanvasTextAlign = 'left', track = 0) {
    c.font = font(F.mono(400), size);
    c.letterSpacing = `${track}px`;
    c.textAlign = align; c.fillStyle = col; c.fillText(s, x, y);
    c.textAlign = 'left'; c.letterSpacing = '0px';
  }

  // ------------------------------------------------------------------ render
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, { lyrics } = this.ctx;
    const c = this.L.ctx; this.L.clear();
    const lc = this.light.ctx; this.light.clear();
    if (this.day) clearRT(this.ctx.renderer, out, LIN.paper);
    else this.sky.render(this.ctx, out, { level: dawnLevel(this.ctx.lyrics, t), horizon: 0.42 });
    let v = 0;
    for (let i = 0; i < 8; i++) if (t >= this.cuts[i]!) v = i;
    const t0 = this.cuts[v]!, t1 = this.cuts[v + 1]!;
    this.textAlpha = 1;
    this.grp.forEach((g, i) => (g.visible = i === v));

    // camera: each vignette has its own slow move; kicks push in a touch
    const lt = t - t0, dur = t1 - t0;
    const kick = this.day && v >= 4 ? 0 : beatPulse(f.beat);
    const cams: [number, number, number, number, number, number][] = [
      [2.6, 2.0, 5.8, 0, 0.9, 0], [-2.8, 2.6, 9.6, -0.6, 1.6, 0], [3.0, 2.3, 8.2, 0.4, 1.3, 0], [3.6, 3.4, 7.4, 0.2, 0.6, -0.8],
      [0.0, 1.6, 7.0, 0, 1.5, 0], [-1.2, 1.6, 8.6, 0.35, 1.3, 0], [1.4, 2.1, 6.6, 0, 0.9, -0.6], [4.8, 2.9, 12.6, 0, 2.2, 0],
    ];
    if (this.day) {
      // day framings: the whole camel in frame; the building low and whole, with air above it for its fall
      cams[0] = [3.0, 1.75, 7.2, 0.45, 1.3, 0];
      cams[7] = [4.0, 1.3, 13.2, 0.95, 2.0, 0];
    }
    if ((!this.day && v >= 6) || (this.day && v === 6)) {
      // night, lines 7-8: one continuous move over the agents (no cut between the lines)
      const k = camAt(t, this.keysNight());
      this.st.look(k.pos, k.tgt, k.fov);
    } else if (this.day && v === 6) {
      // day line 7: the camera walks backwards ahead of the procession
      const k = camAt(t, this.keysDay7()), x = this.leadX(t);
      this.st.look([k.pos[0] + x, k.pos[1], k.pos[2]], [k.tgt[0] + x, k.tgt[1], k.tgt[2]], k.fov);
    } else {
      const cm = cams[v]!;
      const orbit = lerp(-0.12, 0.12, lt / dur) * (v % 2 ? -1 : 1);
      let dist = 1 - 0.07 * (lt / dur) - 0.025 * kick;
      let dy = 0;
      if (this.day && v === 7) {
        // the collapse: the camera takes the hits — a dip and a push on 폐, a heavier one on 업
        const a = this.first('8d').t0, b = this.last('8d').t0;
        const hit = (t0_: number, amp: number) => { const s = t - t0_; return s <= 0 ? 0 : amp * Math.sin(Math.min(1, s / 0.09) * Math.PI / 2) * Math.exp(-Math.max(0, s - 0.09) / 0.22); };
        dy -= hit(a, 0.05) + hit(b + 0.06, 0.09);
        dist -= hit(a, 0.012) + hit(b + 0.06, 0.03);
      }
      const cx = cm[0] * Math.cos(orbit) - cm[2] * Math.sin(orbit), cz = cm[0] * Math.sin(orbit) + cm[2] * Math.cos(orbit);
      this.st.look([cx * dist + cm[3], cm[1] + dy, cz * dist], [cm[3], cm[4] + dy * 0.6, cm[5]], 30);
    }

    const fn = [this.v1, this.v2, this.v3, this.v4, this.v5, this.v6, this.v7, this.v8][v]!;
    setFigureFill(this.day ? '#E9E3D7' : '#23262E');
    (fn as (this: Grind, ...a: any[]) => void).call(this, c, lc, f, t0, t1);
    this.figs.forEach((x) => x.sync());
    this.st.render(out);

    this.mono(c, 'FEEL THE AGI', M, M + 6, 13, this.dimc(0.7), 'left', 3);
    this.mono(c, `${this.pass === 1 ? '02' : '07'}  ${String(v + 1).padStart(2, '0')}/08`, M, M + 28, 13, rgba('graphite', this.day ? 0.7 : 1));
    drawClock(c, lyrics, t, this.day ? 'day' : 'night', 1, true);

    // verse 1 opens out of the gold the caret left behind at the end of hook 1
    if (this.pass === 1) { const g = 1 - ease.outCubic(clamp((t - this.ctx.start) / 0.22)); if (g > 0) { c.fillStyle = rgba('dawn', g); c.fillRect(0, 0, 1920, 1080); } }
    const cutK = !this.day ? burst(t, t0, 2) : 0;
    this.glitch.draw(this.ctx, this.L.upload(), out, t, { split: 6 * cutK, slice: 0.25 * cutK });
    if (!this.day) this.light.draw(this.ctx, out, 2.4, 'dawn');

    let shake = (this.day && v >= 4 ? 0 : this.day ? 1.0 : 1.6) * beatPulse(f.beat, 0.06);
    if (v === 7) { const a = this.first('8d').t0, b = this.last('8d').t0; shake += 16 * pulse(t, a, 0.06) + 22 * pulse(t, b, 0.07); }
    const o: PostOverrides = this.day
      ? { bloom: 0.25, bloomThreshold: 1.1, halation: 0.06, vignette: 0.18, grain: 0.05, ca: 0.4 }
      : { bloom: 0.75, bloomThreshold: 0.95, bloomKnee: 0.25, bloomRadius: 0.8, halation: 0.3, vignette: 0.45, grain: 0.05, ca: 0.5 };
    if (shake > 0.05) o.shake = [noise1(t * 60, 1) * shake, noise1(t * 60, 2) * shake];
    if (this.day && v === 7) {
      // the collapse lands: a punch-in and a white hit on 업
      const a = this.first('8d').t0, b = this.last('8d').t0;
      o.flash = 0.35 * pulse(t, b, 0.07) + 0.15 * pulse(t, a, 0.06);
      o.zoom = 1 + 0.04 * pulse(t, a, 0.12) + 0.06 * pulse(t, b, 0.15);
    }
    if (BOLD) {
      // experimental cut: every line arrives on a 4-frame light smear; the night's kicks smear too
      o.smear = this.day ? 0 : 200 * burst(t, t0, 3);
    }
    return o;
  }

  // ------------------------------------------------------------------ 1 다 끝났다고 말해줄래 내일
  private v1(c: CanvasRenderingContext2D, _lc: CanvasRenderingContext2D, f: Frame, t0: number) {
    const t = f.t, day = this.day;
    this.put(c, '1a', t);
    this.put(c, '1b', t);
    this.put(c, '1c', t, { amt: 0.12 });
    // the bar under the words: a step per syllable, stuck at 99 % (day: 100 % on 내일)
    const syls = [...this.lay['1a']!.syls, ...this.lay['1b']!.syls];
    const n = syls.filter((s) => t >= s.t0).length;
    const lastS = syls[Math.max(0, n - 1)]!;
    const target = (k: number) => Math.min(0.99, (k / syls.length) * 0.99);
    let p = n === 0 ? 0 : lerp(target(n - 1), target(n), ease.outExpo(clamp((t - lastS.t0) / 0.14)));
    const tNe = this.first('1c').t0;
    const done = day && t >= tNe;
    if (done) p = lerp(0.99, 1, ease.outExpo(clamp((t - tNe) / 0.25)));
    const bx = M, bw = COLW, by = this.Y['1c']! + 120;
    hline(c, bx, bx + bw, by, this.fg(0.18));
    c.fillStyle = done ? this.acc() : this.fg(0.92);
    c.fillRect(bx, by - 1, bw * p, 3);
    if (n > 0) this.mono(c, `${Math.round(p * 100)}%`, bx + bw, by + 40, 22, done ? this.acc() : this.dimc(), 'right');
    if (n > 0) {
      const keys: [number, string][] = syls.map((s, i) => [s.t0, i % 2 ? 'walkA' : 'walkB']);
      keys.push([syls[syls.length - 1]!.t1, 'wait']);
      drawFigure(c, bx + bw * p - 34, by - 3, 130, poseAt(t, keys), { col: this.fg(0.95), lw: 2.5 });
    }
    if (!day) {
      // the calendar turns its page on 내일
      this.cal1.pose(clamp((t - (tNe - 0.06)) / 0.42));
      this.cal1.group.rotation.y = -0.35;
    } else {
      // day: "다 끝났다" — a big gold camel (다 큰 낙타) paces in over the line and comes to rest on 래; on
      // 내일 it turns its head to us (a touch of anticipation, a soft overshoot), and nods on 일
      const tIn = t0, tStop = this.syl('1b', 3).t0, dec = 0.6, D = 3.9;
      const vC = D / (tStop - tIn - dec / 2);
      const u = clamp(t - tIn, 0, tStop - tIn), tD = tStop - tIn - dec;
      const dist = u < tD ? vC * u : vC * tD + vC * (u - tD) - (vC / (2 * dec)) * (u - tD) ** 2;
      const speed = u < tD ? 1 : clamp(1 - (u - tD) / dec);
      const look = ease.outBack(clamp((t - (tNe - 0.04)) / 0.5), 1.3);
      const tIl = this.syl('1c', 1).t0;
      const nod = Math.sin(Math.PI * clamp((t - tIl) / 0.34));
      this.camel.pose(t, dist / 0.72, speed, look, nod);
      this.camel.group.position.set(4.1 - dist, 0, -0.2);
    }
    void t0;
  }

  // ------------------------------------------------------------------ 2 기다리고 있거든 매일
  private v2(c: CanvasRenderingContext2D, _lc: CanvasRenderingContext2D, f: Frame, t0: number) {
    const t = f.t, day = this.day;
    this.put(c, '2a', t);
    this.put(c, '2b', t);
    // night: the days race by, one page per 8th note, then per 16th, and they wait.
    // day: the same pages tear off and drift away like leaves; on 매일 the person gets up and leaves
    // (day: the countdown stops on D-DAY)
    const flip = day ? Math.min(this.flips(t), this.dday) : this.flips(t);
    this.cal2.pose(flip, day, this.flips(t));
    this.cal2.group.rotation.y = 0.3;
    const tM = this.first('2b').t0;
    if (day) {
      this.me[1]!.chair = t < tM;
      const keys: [number, string][] = [[t0, 'sitUp'], [tM, 'stand']];
      for (let i = 0; i < 10; i++) keys.push([tM + 0.3 + i * 0.2, i % 2 ? 'walkA' : 'walkB']);
      this.me[1]!.pose(poseAt(t, keys));
      this.me[1]!.sprite.position.set(-1.7 - Math.max(0, t - tM - 0.3) * 1.2, 0, 0.6 + Math.max(0, t - tM - 0.3) * 0.6);
    } else { this.me[1]!.chair = true; this.me[1]!.pose(POSE.sitUp!); }
  }

  // ------------------------------------------------------------------ 3 더이상 찾기 싫어 새 일
  private v3(c: CanvasRenderingContext2D, _lc: CanvasRenderingContext2D, f: Frame, t0: number) {
    const t = f.t, day = this.day;
    this.put(c, '3a', t);
    const no = this.first('3b').t0;
    this.put(c, '3b', t);
    this.put(c, '3c', t);
    this.cards.forEach((m, i) => {
      const born = this.beatT(t0, i * 0.75);
      const k = ease.outExpo(clamp((t - born) / 0.35));
      m.visible = t >= born;
      const y = 1.0 + i * 0.3, z = -0.6 + i * 0.12;
      m.position.set(lerp(1.5, 0.4, k), y, z);
      m.rotation.set(-0.08, -0.25, 0);
      m.scale.setScalar(lerp(0.9, 1.3, k));
      const go = t - no - i * 0.035;
      if (go > 0) {
        if (!day) {
          m.position.x += go * go * 30 + go * 6;
          m.position.y += go * 1.2;
          m.rotation.z = -go * 4; m.rotation.y = -0.25 - go * 3;
        } else {
          // day: the cards drop one by one into the gold tray on the floor — handled, not by them
          const k2 = ease.inOutCubic(clamp(go / 0.5));
          m.position.set(lerp(m.position.x, 0.3, k2), lerp(m.position.y, 0.22 + i * 0.012, k2), lerp(m.position.z, 1.2, k2));
          m.rotation.set(lerp(-0.08, -Math.PI / 2, k2), lerp(-0.25, 0, k2), 0);
          m.scale.setScalar(lerp(1.3, 0.62, k2));
        }
      }
    });
    this.me[2]!.pose(poseAt(t, [[t0, 'stand'], [no, day ? 'shrug' : 'refuse']]));
  }

  // ------------------------------------------------------------------ 4 새 일 자리 어디에 있지
  private v4(c: CanvasRenderingContext2D, lc: CanvasRenderingContext2D, f: Frame, t0: number) {
    const t = f.t, day = this.day;
    const lay = this.lay['4a']!;
    const tx = this.X['4a']!, ty = this.Y['4a']!;
    c.textBaseline = 'alphabetic';
    let endX = tx, typing = false;
    for (const s of lay.syls) {
      if (t < s.t0) continue;
      c.font = font(s.fam, lay.size);
      c.fillStyle = this.fg(); c.fillText(s.ch, tx + s.x, ty);
      endX = tx + s.x + s.w; typing = t < s.t1 + 0.2;
    }
    const blink = typing || f.beatPhase < 0.5 ? 1 : 0;
    if (day) { c.fillStyle = hexA(GOLD, blink); c.fillRect(endX + 12, ty - 84, 5, 96); }
    else { lc.fillStyle = `rgba(255,255,255,${blink})`; lc.fillRect(endX + 12, ty - 84, 5, 96); }
    this.put(c, '4b', t);
    const tEnd = this.last('4b').t0;
    const walkK = clamp((t - t0) / (tEnd - t0 + (day ? 0.8 : 0)));
    const keys: [number, string][] = [];
    for (let i = 0; i < 18; i++) keys.push([this.beatT(t0, i * 0.5), i % 2 ? 'walkA' : 'walkB']);
    if (day) {
      // passing the queue: one glance at the line (a beat with the head turned), then on
      const tG = this.syl('4b', 1).t0;
      const kept = keys.filter(([k]) => k < tG || k > tG + 0.5);
      keys.length = 0; keys.push(...kept, [tG, 'glance']);
      keys.sort((a, b) => a[0] - b[0]);
      this.me[3]!.pose(poseAt(t, keys));
      // a half-step pause while looking
      const pause = clamp((t - tG) / 0.5) * 0.12;
      this.me[3]!.sprite.position.set(lerp(-0.5, 3.0, walkK) - (t > tG ? Math.min(pause, 0.12) : 0), 0, 1.9);
    } else {
      keys.push([tEnd, 'shrug']);
      this.me[3]!.pose(poseAt(t, keys));
      this.me[3]!.sprite.position.set(lerp(-1.25, 2.1, ease.inOutQuad(walkK)), 0, 1.3);
    }
  }

  // ------------------------------------------------------------------ 5 하기싫어 시키는 일만은
  private v5(c: CanvasRenderingContext2D, _lc: CanvasRenderingContext2D, f: Frame, t0: number) {
    const t = f.t, day = this.day;
    this.put(c, '5a', t, { amt: 0.05 });
    this.put(c, '5b', t);
    this.me[4]!.pose(poseAt(t, [[t0, 'stand'], [this.first('5a').t0, 'cross']]));
    this.tasks.forEach((m, i) => {
      const born = this.beatT(t0, i * 0.25 - 0.5);
      const s = t - born;
      const x0 = (hash(i, 1) - 0.5) * 2.4, z0 = (hash(i, 2) - 0.5) * 1.6;
      m.visible = s > 0;
      if (s <= 0) return;
      const hitsHead = Math.abs(x0) < 0.7 && Math.abs(z0) < 0.6;
      const yStop = hitsHead ? 2.05 : 0.03;
      const tHit = Math.sqrt((2 * (4.4 - yStop)) / 9.8);
      let x = x0, yy = ballistic(4.4, 0, 9.8, s, yStop, 0.3);
      if (hitsHead && s > tHit) {
        const u = s - tHit;
        x = x0 + Math.sign(x0 || 1) * (1.6 * u);
        yy = ballistic(2.05, 1.2, 9.8, u, 0.03, 0.25);
      }
      m.position.set(x, yy, z0);
      m.rotation.set(-Math.PI / 2 + (hitsHead ? Math.min(1, s * 2) * 1.2 : 0), i * 0.7, (hash(i, 3) - 0.5) * (s < tHit ? s * 6 : 1.5));
    });
  }

  // ------------------------------------------------------------------ 6 그 자식들은 아직도 기만을
  private v6(c: CanvasRenderingContext2D, _lc: CanvasRenderingContext2D, f: Frame) {
    const t = f.t, day = this.day;
    this.put(c, '6a', t);
    this.put(c, '6b', t);
    this.put(c, '6c', t);
    const cracks = this.lay['6c']!.syls.map((s) => s.t0);
    if (!day) {
      this.masks.forEach((mk, i) => mk.pose(t - (cracks[i] ?? 1e9)));
      this.maskPeople.forEach((p, i) => p.pose(t >= (cracks[i] ?? 1e9) ? POSE.lookUp! : POSE.stand!));
    } else {
      // day: no one needs them any more — each takes the mask off and throws it away to the left
      this.masks.forEach((mk, i) => {
        mk.pose(-1);
        const tc = cracks[i] ?? 1e9;
        const lift = ease.inOutCubic(clamp((t - tc) / 0.22));
        const fly = Math.max(0, t - tc - 0.22);
        const x0 = -0.8 + i * 1.15;
        mk.group.position.set(x0 + 0.25 * lift - 3.2 * fly, Math.max(0.06, 1.72 + 0.15 * lift + 1.6 * fly - 4.9 * fly * fly), 0.2 + 0.6 * fly);
        mk.group.rotation.set(fly * 2, lift * 0.6 + fly * 5, fly * 3);
        mk.group.visible = fly < 1.4;
      });
      this.maskPeople.forEach((p, i) => { const tc = cracks[i] ?? 1e9; p.pose(t >= tc + 0.22 ? (t < tc + 0.7 ? POSE.throwL! : POSE.lookUp!) : t >= tc ? POSE.reach! : POSE.stand!); });
    }
  }

  // ------------------------------------------------------------------ 7 나도 이제 밑에 agent
  /** The agents' births: from 밑 the count doubles on every 8th note (night) or 16th (day). */
  private agentCount(t: number) {
    const from = this.lay['7b']!.syls.find((s) => s.ch === '밑')?.t0 ?? this.cuts[6]! + 1;
    const steps = t < from ? -1 : this.beats(t, from) * (this.day ? 4 : 2);
    return { from, total: steps < 0 ? 0 : Math.floor(2 ** (1 + steps)) };
  }
  private agentBorn(i: number, from: number) { return this.ctx.audio.timeOfBeat(this.ctx.audio.beatAt(from) + Math.max(0, Math.log2(i + 1) - 1) / (this.day ? 4 : 2)); }

  private v7(c: CanvasRenderingContext2D, _lc: CanvasRenderingContext2D, f: Frame, t0: number) {
    const t = f.t, day = this.day;
    this.grp[6]!.add(this.stage7);
    this.put(c, '7a', t);
    this.put(c, '7b', t);
    this.put(c, '7c', t);
    const { from, total } = this.agentCount(t);
    this.nightAgents(t);
    this.me[6]!.pose(poseAt(t, day ? [[t0, 'stand'], [from, 'wave']] : [[t0, 'stand'], [from, 'cross']]));
    if (total > 1) this.mono(c, `× ${total.toLocaleString('en-US')}`, this.X['7c']! + this.lay['7c']!.width + 30, this.Y['7c']!, 30, this.dimc(this.textAlpha));
  }

  /** Day line 7: the person and a companion agent walk toward us side by side; from 밑, rows of people
   * and agents walking together fill in behind them, front to back (one more pair-generation every 16th). */
  private dayProcession(t: number, t0: number, from: number) {
    const au = this.ctx.audio, X = this.leadX(t);
    const keys: [number, string][] = [];
    for (let i = 0; i < 24; i++) keys.push([this.beatT(t0, i * 0.5), i % 2 ? 'walkA' : 'walkB']);
    const tA = this.first('7c').t0;
    // on 'agent' the person glances over at the companion for a step
    const kMe = keys.filter(([k]) => k < tA || k > tA + 0.36).concat([[tA, 'glance']] as [number, string][]).sort((p, q) => p[0] - q[0]);
    this.me[6]!.pose(poseAt(t, kMe));
    this.me[6]!.sprite.position.set(X, 0, 0);
    // agents glide with a small hop on every step (8ths); a pair's agent steps with its person
    const step = (ph: number) => { const fr = (((au.beatAt(t) * 2 + ph * 0.5) % 1) + 1) % 1; return fr < 0.5 ? fr / 0.5 : 0; };
    const A = this.agents;
    A.begin();
    // the companion walks on the person's far side; on 도 it turns to look at them, then back ahead, and
    // again when they glance over on 'agent'; it blinks on 이제
    const tDo = this.syl('7a', 1).t0, tI = this.first('7b').t0;
    const look = ease.inOutCubic(clamp((t - tDo) / 0.18)) * (1 - ease.inOutCubic(clamp((t - tDo - 0.62) / 0.25)));
    const look2 = ease.inOutCubic(clamp((t - tA) / 0.15)) * (1 - ease.inOutCubic(clamp((t - tA - 0.45) / 0.2)));
    const blink = Math.max(0, 1 - Math.abs(t - tI - 0.06) / 0.06);
    const fwd = -(Math.PI / 2 - 0.45); // ahead (to the left), turned a little toward us so the visor reads
    A.set(X - 0.05, 0, -0.72, AG_D, fwd + 0.85 * Math.max(look, look2), step(1) * 0.7, 1, blink, 0, 0);
    this.pairs.forEach((p, i) => {
      const age = t - this.agentBorn(i, from);
      if (age <= 0) return;
      const near = Math.exp(-Math.pow((p.x - X) / 2.2, 2));
      const yaw = near * Math.atan2(X - p.x, -p.az) * 0.8;
      A.set(p.x, 0, p.az, AG_D * 0.86 * ease.outBack(clamp(age / 0.22), 1.4), yaw, 0, clamp(age / 0.1), 1 - clamp((age - 0.1) / 0.08), 0.5 * near, 0);
    });
    A.end();
  }

  // ------------------------------------------------------------------ 8 시켜서 태업 아님 폐업
  private v8(c: CanvasRenderingContext2D, _lc: CanvasRenderingContext2D, f: Frame, t0: number) {
    const t = f.t;
    const a = this.first('8d').t0, b = this.last('8d').t0;
    const tSlow = this.syl('8a', 3).t0;
    if (!this.day) {
      // night: the same agents, the same shot. On 태 they freeze; then, from the far ranks in, they slump
      // and go dark. 폐 brings the shutter half down, 업 slams it to the floor
      this.grp[7]!.add(this.stage7);
      this.nightAgents(t);
      this.me[6]!.pose(poseAt(t, [[t0, 'cross'], [tSlow, 'stand'], [a, 'lookUp']]));
      this.shutter(c, t, a, b);
      this.put(c, '8a', t);
      this.put(c, '8b', t);
      this.put(c, '8d', t);
      return;
    }
    this.put(c, '8a', t);
    this.put(c, '8b', t);
    this.put(c, '8d', t);
    // 태: the lights die floor by floor from the top; 아: the top shears with a jolt; 폐: it topples;
    // 업: the rest pancakes and the dust rolls out over the mirror floor
    const n = this.building.floors.length, tAh = this.syl('8b', 0).t0;
    this.building.lights((i) => 1 - clamp((t - (tSlow + (n - 1 - i) * 0.045)) / 0.05));
    this.building.collapse(t - tAh, t - a, t - b);
    this.me[7]!.pose(poseAt(t, [[t0, 'cross'], [tSlow, 'stand'], [a, 'lookUp']]));
  }

  /** A rolling steel shutter in front of everything: half down on 폐, to the floor on 업. */
  private shutter(c: CanvasRenderingContext2D, t: number, a: number, b: number) {
    if (t < a) return;
    const k1 = ease.outBounce(clamp((t - a) / 0.16)) * 0.56;
    const k2 = t < b ? 0 : ease.outBounce(clamp((t - b) / 0.14));
    const yb = Math.round(lerp(k1, 1.0, k2) * 1080);
    const slat = 44;
    for (let y = yb - slat; y > -slat; y -= slat) {
      const g = c.createLinearGradient(0, y, 0, y + slat);
      g.addColorStop(0, '#2A2C33'); g.addColorStop(0.45, '#17181D'); g.addColorStop(0.55, '#121317'); g.addColorStop(1, '#1E2026');
      c.fillStyle = g; c.fillRect(0, y, 1920, slat);
      c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(0, y + 1, 1920, 1);
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(0, y + slat - 2, 1920, 2);
    }
    // the bottom rail, gold, with its handle
    c.fillStyle = '#8A5A12'; c.fillRect(0, yb - 16, 1920, 16);
    c.fillStyle = 'rgba(255,214,140,0.55)'; c.fillRect(0, yb - 16, 1920, 2);
    c.fillStyle = '#C9922E'; c.fillRect(1920 * 0.5 + 260 - 70, yb - 12, 140, 8);
  }
}

/** Draw a figure sprite mirrored (walking to the right). */
function mirror(f: FigureSprite) { f.tex.repeat.set(-1, 1); f.tex.offset.set(1, 0); f.tex.needsUpdate = true; }

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
