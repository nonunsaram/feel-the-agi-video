"""Syllable-level lyric alignment for "Feel The AGI" -> data/lyrics.json

Pipeline (adapted from pdoom's align.py for Korean + English code-switching):
  1. ctc_emissions.py : frame-wise CTC log-probs (20 ms) of the Demucs vocal stem
                        (mono, L, R) from MMS_FA (multilingual, uroman alphabet)
                        and wav2vec2 LV60K (English letters).
  2. whisper_ko.py    : mlx-whisper large-v3 word timestamps, language ko (cross-check).
  3. vocal_feats.py   : vocal-stem RMS / pitch / spectral-flux onsets (5 ms hop).
  4. this script      : every Hangul syllable is one alignment unit, romanized with
                        uroman (what MMS_FA was trained on); English tokens get phonetic
                        spellings.  One global constrained CTC Viterbi pass per section
                        window (a "star" garbage token between lines absorbs ad-libs),
                        then each unit start is snapped to the vocal onset next to it.

Run:  uv run python ko_align.py [--plots]
"""
import common
import json
import re
import sys

import numpy as np

from ctcalign import FRAME, ALPHA, AIDX, _viterbi, emissions

# ---------------------------------------------------------------------------
# tempo grid (from analyze.py / explore.py): bar k (1-based) starts at OFF + (k-1)*BAR
BPM = 150.269
P = 60 / BPM
OFF = 0.1437
BAR = 4 * P
bar_t = lambda k: OFF + (k - 1) * BAR

# Lines with their time windows in bars (1-based, fractional): (section, text, lo_bar, hi_bar).
# The vocals run one bar behind the arrangement's 8-bar sections (every line starts with or just
# after a downbeat of bars 2, 10, 18 ...), which these windows encode.
def hook(name, h):
    L = []
    for b in (1, 2):
        L += [(name, "AGI", h + b - 0.10, h + b + 0.52), (name, "AGI", h + b + 0.42, h + b + (1.03 if b == 1 else 0.80))]
    L += [(name, "ChatGPT Claude or Gemini", h + 2.76, h + 5.0)]
    for b in (5, 6):
        L += [(name, "AGI", h + b - 0.10, h + b + 0.52), (name, "AGI", h + b + 0.42, h + b + (1.03 if b == 5 else 0.92))]
    L += [(name, "다 왔다 말해줘", h + 6.75, h + 7.8), (name, "tell me now", h + 7.7, h + 8.7)]
    return L


VERSE = [
    "다 끝났다고 말해줄래 내일",
    "기다리고 있거든 매일",
    "더 이상 찾기 싫어 새 일",
    "새 일자리 어디에 있지",
    "하기 싫어 시키는 일만은",
    "그 자식들은 아직도 기만을",
    "나도 이제 밑에 agent",
    "시켜서 태업 아님 폐업",
]


def verse(name, v):
    return [(name, t, v + 1 + 2 * k - 0.45, v + 3 + 2 * k + 0.12) for k, t in enumerate(VERSE)]


def quad(name, b, third):
    return [(name, "사랑을 속삭이네", b + 0.8, b + 3.0), (name, "반짝이는 너와의 미래", b + 2.8, b + 5.0),
            (name, third, b + 4.8, b + 7.0), (name, "새 시대", b + 6.6, b + 9.0)]


SPEC = (quad("intro", 1, "느껴봐 새 시대") + hook("hook1", 9) + verse("verse1", 17) + hook("hook2", 33) + hook("hook3", 41)
        + quad("prehook", 49, "느껴봐라 새 시대")
        + [("build", "Feel The AGI", 57.7, 59.35), ("build", "Feel The AGI", 59.15, 60.1), ("build", "yah yah yah", 60.0, 61.5),
           ("build", "Feel The AGI", 61.6, 63.0), ("build", "Feel The AGI", 62.8, 64.1), ("build", "yah yah yah", 64.0, 65.4)]
        + verse("verse2", 65))

# English / acronym tokens: display parts and their spelling for the CTC models.
# (parts, mms spelling per part)
PRON = {
    "AGI": (["A", "G", "I"], ["ei", "ji", "ai"]),
    "ChatGPT": (["Chat", "G", "P", "T"], ["chaet", "ji", "pi", "ti"]),
    "Claude": (["Claude"], ["keullodeu"]),
    "or": (["or"], ["o"]),
    "Gemini": (["Ge", "mi", "ni"], ["je", "mi", "nai"]),
    "tell": (["tell"], ["tel"]),
    "me": (["me"], ["mi"]),
    "now": (["now"], ["nau"]),
    "agent": (["a", "gen", "t"], ["ei", "jeon", "teu"]),
    "Feel": (["Feel"], ["pil"]),
    "The": (["The"], ["deo"]),
    "yah": (["yah"], ["ya"]),
}
PRON_OVERRIDE = {}   # (li, ti) -> (parts, spellings), filled from trials below

# Per-line time windows (s) where the automatic path needs help; (li) -> (lo, hi)
LINE_WINDOWS = {}
# Manual corrections after inspection of the QA plots: (li, ti, si) -> start (s)
FIX = {
    # hook 1, bar 12 (a cappella): "Chat" starts on its ch- burst, G on the second sibilant; Gemini's
    # "ni" (나이) starts at the nasal dip, CTC only fires on the diphthong
    (2, 0, 0): 8.42,  # intro 느: an 8th before 껴, as in the pre-hook (8.25 was a breath)
    (8, 0, 0): 17.43, (8, 0, 1): 17.67, (8, 3, 2): 20.10,
    (27, 0, 1): 56.0, (27, 3, 2): 58.43, (38, 3, 2): 71.20,
    # Gemini's 나이 lands on the same beat in all three hooks (about 0.79 s after the downbeat of 제);
    # hook 2 was confirmed by ear, hooks 1 and 3 follow it.
    # verse 2 "더이상": 더 is the strong onset at 110.09 (an 8th before 이, as in verse 1)
    (57, 0, 0): 110.08,
    # echo AGIs with no sibilant G (sung softly under the lead): placed on the level dips / onsets,
    # checked against the hook-1 rhythm (A, G, I at about 0.8, 0.97, 1.23 s into the bar)
    (26, 0, 0): 55.13, (26, 0, 1): 55.33, (26, 0, 2): 55.66,
    (35, 0, 0): 66.63, (35, 0, 1): 66.77, (35, 0, 2): 66.95,
    (37, 0, 0): 68.04, (37, 0, 1): 68.19, (37, 0, 2): 68.45,
    (40, 0, 0): 72.95, (40, 0, 1): 73.13, (40, 0, 2): 73.43,
    # pre-hook: 껴 at its release; the last 시대: 시 is held, 대 re-articulated at 88.30
    (47, 0, 1): 84.92, (48, 1, 1): 88.30,
    # build-up (heavily processed chant; the CTC models are unsure): placed on the spectrogram.
    # Each "Feel The AGI" is one bar: F- frication before the downbeat, "The" at beat 2+, G = sibilant.
    (49, 0, 0): 91.02, (49, 1, 0): 91.64, (49, 2, 0): 91.86, (49, 2, 1): 92.04, (49, 2, 2): 92.30,
    (50, 0, 0): 92.62, (50, 1, 0): 93.22, (50, 2, 0): 93.44, (50, 2, 1): 93.62, (50, 2, 2): 93.90,
    (51, 0, 0): 94.60, (51, 1, 0): 95.40, (51, 2, 0): 96.20,
    (52, 0, 0): 97.32, (52, 1, 0): 97.98, (52, 2, 0): 98.22, (52, 2, 1): 98.37, (52, 2, 2): 98.58,
    (53, 0, 0): 98.97, (53, 1, 0): 99.57, (53, 2, 0): 99.80, (53, 2, 1): 99.95, (53, 2, 2): 100.24,
    (54, 0, 0): 100.96, (54, 1, 0): 101.76, (54, 2, 0): 102.52,
    # verse 2: "다" pickup burst; agent's final t is barely released
    (55, 0, 0): 103.52, (61, 3, 2): 124.98,
    # verse 2 "어디에 있지" (revision 8): the same rhythm as verse 1 (어디에 quick, 있 held, 지 late), read
    # off the vocal envelope's dips: 어 114.56, 디 114.68, 에 114.80, 있 115.26, 지 115.92
    (58, 2, 0): 114.56, (58, 2, 1): 114.68, (58, 2, 2): 114.80, (58, 3, 0): 115.26, (58, 3, 1): 115.92,
    # "그 자식들은": 그 is the strong onset, not the breath before it (verse 1 confirmed by ear)
    (20, 0, 0): 43.10, (60, 0, 0): 119.31,
    # verse 1 "새 일": 일 is the long note from 35.70 (an unlisted pickup syllable follows at 36.52)
    (17, 5, 0): 35.70,
}
# Manual end corrections: (li, ti) -> end
FIX_END = {(17, 5): 36.36, (49, 2): 92.60, (50, 2): 94.45, (51, 0): 94.92, (51, 1): 95.72, (51, 2): 96.55,
           (52, 2): 98.95, (53, 2): 100.78, (54, 0): 101.22, (54, 1): 102.05, (54, 2): 102.85, (61, 3): 125.12}

_ur = None


def romanize(ch):
    global _ur
    if _ur is None:
        import uroman as ur
        _ur = ur.Uroman()
    r = _ur.romanize_string(ch).lower()
    return re.sub(r"[^a-z']", "", r)


def is_hangul(ch):
    return "가" <= ch <= "힣"


def units_for(token, key=None):
    """-> (parts, spellings) for one display token."""
    if key in PRON_OVERRIDE:
        return PRON_OVERRIDE[key]
    if token in PRON:
        return PRON[token]
    if all(is_hangul(c) for c in token):
        return list(token), [romanize(c) for c in token]
    raise ValueError(f"no pronunciation for token {token!r}")


HOOK_LINES: set[int] = set()


def build_lines():
    """-> list of dict(li, section, text, tokens, lo, hi)"""
    out = [dict(li=i, section=name, text=text, tokens=text.split(" "), lo=bar_t(lo), hi=bar_t(hi))
            for i, (name, text, lo, hi) in enumerate(SPEC)]
    HOOK_LINES.update(L["li"] for L in out if L["section"].startswith("hook"))
    return out


def align(E, lines, margin=1.5):
    """Global Viterbi over the whole song.  Returns units: list of dict(li, ti, si, part, spell, start, end, p)."""
    T = E.shape[0]
    star_col = E.max(axis=1, keepdims=True) - margin
    Ex = np.concatenate([E, star_col], axis=1)
    star = len(ALPHA)
    tgt, index = [star], []
    lo_l, hi_l = [0], [T - 1]
    for L in lines:
        wl, wh = LINE_WINDOWS.get(L["li"], (L["lo"], L["hi"]))
        for ti, tok in enumerate(L["tokens"]):
            parts, spells = units_for(tok, (L["li"], ti))
            for si, (part, sp) in enumerate(zip(parts, spells)):
                a = len(tgt)
                tgt.extend(AIDX[c] for c in sp)
                lo_l.extend([int(wl / FRAME)] * len(sp))
                hi_l.extend([min(T - 1, int(wh / FRAME))] * len(sp))
                index.append((L["li"], ti, si, part, sp, a, len(tgt)))
        tgt.append(star)
        lo_l.append(0)
        hi_l.append(T - 1)
    tgt = np.array(tgt, np.int64)
    lo = np.maximum(np.array(lo_l, np.int64), 0)
    hi = np.array(hi_l, np.int64)
    path, score = _viterbi(Ex, tgt, lo, hi)
    tokpos = np.where(path % 2 == 1, (path - 1) // 2, -1)
    Pm = np.exp(Ex[np.arange(T), np.where(tokpos >= 0, tgt[np.maximum(tokpos, 0)], 0)])
    units = []
    for (li, ti, si, part, sp, a, b) in index:
        fr = np.where((tokpos >= a) & (tokpos < b))[0]
        units.append(dict(li=li, ti=ti, si=si, part=part, spell=sp, start=float(fr.min() * FRAME),
                          end=float((fr.max() + 1) * FRAME), p=float(Pm[fr].mean())))
    return units, float(score)


def load_feats():
    f = dict(np.load(common.WORK / "vocal_feats.npz"))
    f["hop"] = float(f.pop("hop_s"))
    return f


def refine(units, f):
    """Snap each unit start to the vocal onset it belongs to.

    CTC emits a character somewhere inside its phone (20 ms frames, often late on
    vowel-initial syllables), so a syllable's displayed start follows the acoustic
    onset: (1) after a rest (>= 60 ms of silence before the CTC start) the voice
    re-entry; (2) otherwise the strongest spectral-flux peak within -90..+40 ms
    (weighted toward the CTC time)."""
    from scipy.ndimage import maximum_filter1d, median_filter
    from scipy.signal import find_peaks
    hop = f["hop"]
    r = median_filter(f["rms_db"], 5)
    loc = maximum_filter1d(r, int(1.5 / hop))
    act = (r > -50) & (r > loc - 27)
    on = f["onset"]
    thr = 0.22 * np.percentile(on, 99)
    pk, _ = find_peaks(on, height=thr, distance=int(0.04 / hop))
    pk_t = pk * hop
    strong = 0.5 * np.percentile(on, 99)
    for k, u in enumerate(units):
        u["ctc_start"], u["ctc_end"] = u["start"], u["end"]
        u["rule"] = "ctc"
        key = (u["li"], u["ti"], u["si"])
        if key in FIX:
            u["start"], u["rule"] = FIX[key], "manual"
            continue
        s = u["ctc_start"]
        prev = units[k - 1] if k else None
        prev_end = prev["ctc_end"] if prev else 0.0
        prev_start = prev["start"] if prev else -1.0
        # (1) voice re-entry after a rest
        i0, i1 = int(max(prev_end, s - 1.2) / hop), int(s / hop)
        done = False
        if i1 - i0 > int(0.06 / hop):
            sil = ~act[i0:i1]
            # last silent run of >= 60 ms
            m = np.concatenate([[False], sil, [False]]).astype(np.int8)
            d = np.diff(m)
            runs = [(a, b) for a, b in zip(np.where(d == 1)[0], np.where(d == -1)[0]) if (b - a) * hop >= 0.06]
            if runs:
                onset = (i0 + runs[-1][1]) * hop
                if 0.03 < s - onset < 0.35:
                    u["start"], u["rule"] = onset, "rest"
                    done = True
                elif s - onset <= 0.03:
                    done = True
        if not done:
            # CTC fires a frame or two into the phone; a strong onset right next to it wins
            u["start"] = max(s - 0.02, prev_start + 0.04)
            cand = [(on[p], t) for p, t in zip(pk, pk_t) if s - 0.05 <= t <= s + 0.035 and on[p] >= strong and t > prev_start + 0.08]
            if cand:
                u["start"], u["rule"] = max(cand)[1] - 0.01, "onset"
    # Plosive closures: CTC puts a stop-initial syllable (껴, 끝, 태 ...) at the start of its closure,
    # which is silent; the syllable is heard at the release.  If the level dips >= 10 dB right at the
    # start and a clear onset follows within 0.2 s, move the start to that release.
    for k, u in enumerate(units):
        if u["rule"] in ("manual", "rest") or not re.match(r"(g|k|d|t|b|p|j|c)", u["spell"]):
            continue
        s = u["start"]
        i_s = int(s / hop)
        before = np.median(r[max(0, i_s - int(0.15 / hop)):max(1, i_s - int(0.03 / hop))])
        a, b = max(0, i_s - int(0.03 / hop)), i_s + int(0.16 / hop)
        imin = a + int(np.argmin(r[a:b]))
        if before - r[imin] < 10:
            continue
        c = [(on[p], t) for p, t in zip(pk, pk_t) if imin * hop - 0.01 <= t <= imin * hop + 0.14]
        if c:
            t_rel = max(c)[1] - 0.01
            nxt = units[k + 1]["ctc_start"] if k + 1 < len(units) else 1e9
            if s + 0.03 < t_rel < nxt - 0.06:
                u["start"], u["rule"] = t_rel, "release"
    # The hooks' vocoded "A G I" (one every half bar): the G (지) is a clear sibilant burst; A is the
    # onset an 8th before it, I the vowel change an 8th-and-a-bit after it.
    from scipy.ndimage import uniform_filter1d
    sib = uniform_filter1d(f["sib_ratio"], 5)
    wins = {L["li"]: (L["lo"], L["hi"]) for L in build_lines()}
    for k, u in enumerate(units):
        if not (u["part"] == "G" and k and units[k - 1]["part"] == "A" and units[k + 1]["part"] == "I" and u["li"] in wins):
            continue
        if any((x["li"], x["ti"], x["si"]) in FIX for x in units[k - 1:k + 2]):
            continue
        lo, hi = wins[u["li"]]
        if hi - lo > 1.2:
            continue  # only the half-bar hook AGIs
        a, b = int((lo + 0.12) / hop), int((hi - 0.2) / hop)
        pkk = a + int(np.argmax(sib[a:b]))
        base = np.median(sib[int(lo / hop):int(hi / hop)])
        if sib[pkk] < base + 6:
            # no audible G (a soft repeat under the lead): place the three letters on the 8th-note grid
            hb = OFF + round((units[k - 1]["ctc_start"] - 0.05 - OFF) / (BAR / 2)) * (BAR / 2)
            hb = min(max(hb, lo), hi - 0.6)
            for j, d in ((k - 1, 0.0), (k, 0.19), (k + 1, 0.45)):
                units[j]["start"], units[j]["rule"] = hb + d, "grid"
            continue
        thr = base + 0.35 * (sib[pkk] - base)
        j = pkk
        while j > a - int(0.1 / hop) and sib[j - 1] > thr:
            j -= 1
        g = j * hop
        def best(t0, t1, default):
            i0, i1 = int(t0 / hop), int(t1 / hop)
            i = i0 + int(np.argmax(on[i0:i1]))
            return i * hop - 0.01 if on[i] > 0.05 * np.percentile(on, 99) and i0 < i < i1 - 1 else default
        units[k]["start"], units[k]["rule"] = g, "sib"
        ca = units[k - 1]["ctc_start"] - 0.045  # CTC fires ~2 frames into the vowel
        units[k - 1]["start"], units[k - 1]["rule"] = (ca if g - 0.26 <= ca <= g - 0.12 else best(g - 0.30, g - 0.12, g - 0.2)), "agi"
        units[k + 1]["start"], units[k + 1]["rule"] = best(g + 0.20, g + 0.42, g + 0.27), "agi"
    # I of the hook AGIs: the moment the vowel turns from the i of 지 to the a of 아이 (the 1.8-3.2 kHz
    # band falls against 0.5-1.4 kHz). Where that change is not clear, I follows G by a typical 0.22 s.
    import librosa
    from scipy.ndimage import uniform_filter1d as _uf
    yv, sv = common.load_stem("vocals", sr=16000)
    Sv = np.abs(librosa.stft(yv, n_fft=1024, hop_length=80)) ** 2
    frq = librosa.fft_frequencies(sr=16000, n_fft=1024)
    ii = _uf(10 * np.log10(Sv[(frq > 1800) & (frq < 3200)].sum(0) + 1e-9) - 10 * np.log10(Sv[(frq > 500) & (frq < 1400)].sum(0) + 1e-9), 5)
    hv = 80 / 16000
    for k, u in enumerate(units):
        if not (u["part"] == "G" and k and units[k - 1]["part"] == "A" and k + 1 < len(units) and units[k + 1]["part"] == "I"):
            continue
        if not u["li"] in HOOK_LINES or (units[k + 1]["li"], units[k + 1]["ti"], units[k + 1]["si"]) in FIX:
            continue
        g = u["start"]
        a, b = int((g + 0.06) / hv), int((g + 0.5) / hv)
        pkk = a + int(np.argmax(ii[a:a + int(0.2 / hv)]))
        j = pkk
        while j < b and ii[j] > ii[pkk] - 7:
            j += 1
        d = j * hv - g
        units[k + 1]["start"] = j * hv if 0.15 <= d <= 0.32 else g + 0.22
        units[k + 1]["rule"] = "vowel" if 0.15 <= d <= 0.32 else "rhythm"
    for k in range(1, len(units)):
        if units[k]["start"] < units[k - 1]["start"] + 0.03:
            units[k]["start"] = units[k - 1]["start"] + 0.03
    # ends: next unit start when legato, else where the voice drops
    n = len(r)
    for k, u in enumerate(units):
        nxt = units[k + 1]["start"] if k + 1 < len(units) else n * hop
        e0 = max(u["ctc_end"], u["start"] + 0.08)
        j0, j1 = int(u["start"] / hop), int(e0 / hop)
        level = np.percentile(r[j0:max(j1, j0 + 1)], 90)
        low = r < level - 15.0
        need = int(0.06 / hop)
        q = None
        j = j1
        while j < min(int(nxt / hop), n - need):
            if low[j] and low[j:j + need].all():
                q = j * hop
                break
            j += 1
        end = min(q, nxt) if q is not None else nxt
        if nxt - end < 0.04:
            end = nxt
        u["end"] = max(end, u["start"] + 0.04)
    return units


def whisper_words(tag="large_prompt"):
    p = common.WORK / f"whisper_{tag}.json"
    if not p.exists():
        return []
    W = json.loads(p.read_text())
    return [(w["word"].strip(), w["start"], w["end"]) for s in W["segments"] for w in s.get("words", [])]


def main(plots=False, write=True):
    lines = build_lines()
    E = emissions(PRIMARY)
    units, score = align(E, lines)
    alts = {}
    for k in ALTS:
        alts[k], _ = align(emissions(k), lines)
    f = load_feats()
    units = refine(units, f)
    # agreement-based confidence
    for i, u in enumerate(units):
        ds = [abs(a[i]["start"] - u["ctc_start"]) for a in alts.values()]
        agree = float(np.mean([d <= 0.06 for d in ds])) if ds else 1.0
        u["conf"] = round(float(np.clip(0.3 + 0.45 * agree + 0.25 * min(1.0, u["p"] / 0.5), 0, 1)), 2)
        if u["rule"] == "manual":
            u["conf"] = max(u["conf"], 0.8)
    (common.WORK / "align_debug.json").write_text(json.dumps(dict(units=units, alts=alts), indent=1, ensure_ascii=False))
    out_lines = []
    for L in lines:
        words = []
        for ti, tok in enumerate(L["tokens"]):
            us = [u for u in units if u["li"] == L["li"] and u["ti"] == ti]
            end = FIX_END.get((L["li"], ti), us[-1]["end"])
            us[-1]["end"] = end
            d = dict(w=tok, start=round(us[0]["start"], 3), end=round(end, 3), conf=round(min(u["conf"] for u in us), 2))
            if len(us) > 1:
                d["syl"] = [[round(u["start"], 3), round(us[j + 1]["start"] if j + 1 < len(us) else end, 3)] for j, u in enumerate(us)]
                d["parts"] = [u["part"] for u in us]
            words.append(d)
        out_lines.append(dict(i=L["li"], section=L["section"], text=L["text"], start=words[0]["start"], end=words[-1]["end"], words=words))
    if write:
        doc = dict(lines=out_lines, notes=NOTES)
        (common.DATA / "lyrics.json").write_text(json.dumps(doc, indent=1, ensure_ascii=False))
        print("wrote", common.DATA / "lyrics.json", "score", round(score, 1))
    for L in out_lines:
        print(f"L{L['i']:02d} [{L['section']:7s}] {L['start']:7.2f}-{L['end']:7.2f}  " +
              "  ".join(f"{w['w']}@{w['start']:.2f}({w['conf']:.2f})" for w in L["words"]))
    if plots:
        make_plots(units, alts, lines)
    return units, alts, lines


def make_plots(units, alts, lines, only=None):
    from qa_plot import plot
    ww = whisper_words()
    for L in lines:
        if only and L["li"] not in only:
            continue
        us = [u for u in units if u["li"] == L["li"]]
        t0 = min(us[0]["start"], us[0]["ctc_start"]) - 0.6
        t1 = max(us[-1]["end"], us[-1]["ctc_end"]) + 0.5
        t1 = min(t1, t0 + 7)
        tracks = [
            ("final", [(u["part"], u["start"], u["end"]) for u in units]),
            ("ctc " + PRIMARY, [(u["spell"], u["ctc_start"], u["ctc_end"]) for u in units]),
        ] + [(k, [(u["spell"], u["start"], u["end"]) for u in a]) for k, a in alts.items()] + [("whisper", ww)]
        plot(t0, t1, tracks, common.QA / f"line_{L['li']:02d}.png", title=f"L{L['li']} [{L['section']}]: {L['text']}",
             grid=(P, OFF))


PRIMARY = "mms3"
ALTS = ("mms", "mms_vocL", "mms_vocR", "fused6")

NOTES = (
    "Timeline = the wav (48 kHz) as decoded by ffmpeg/browsers; Demucs htdemucs_ft stems need no offset. "
    "Method: CTC emissions (20 ms frames) of the vocal stem (mono sum, left, right) from torchaudio MMS_FA; "
    "every Hangul syllable is one alignment unit romanized with uroman, English tokens use phonetic spellings "
    "(AGI = ei ji ai, ChatGPT = chaet ji pi ti, Gemini = je mi nai ...); one global constrained Viterbi pass "
    "with a garbage token between lines and per-section time windows from the bar grid; each unit start is "
    "then snapped to the vocal onset next to it (voice re-entry after a rest, or the nearest spectral-flux "
    "peak); ends = next unit start when legato, else where the voice drops 15 dB. Cross-checked against "
    "mlx-whisper large-v3 (ko) word timestamps and per-channel alignments; verified on QA plots "
    "(analysis/qa/line_*.png). 'syl' = [start, end] of each Hangul syllable (or spelled letter) of the word, "
    "'parts' = the display piece of each."
)

if __name__ == "__main__":
    main(plots="--plots" in sys.argv)
