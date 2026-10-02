"""Music analysis for "Feel The AGI" -> data/audio.json  (pdoom's format)

The song is an arrangement of several generated clips whose tempi differ slightly, so the beat grid is
piecewise:
  A  bars 1-49  (0 .. 78.36 s)   150.269 BPM, first downbeat 0.1437 s (fit on the verse-1 / hook kicks)
  R  bars 50-57 (78.36 .. 91.10) 150.82 BPM, fit on the pre-hook's drum build (kicks 84.7 .. 87.1 s)
  B  bars 58-   (91.10 .. end)   151.941 BPM, fit on the verse-2 kicks; downbeat 103.741 s = "끝났다고"
Bars are numbered continuously (bar k = downbeats[k-1]).  Envelopes and onsets as in pdoom's analyze.py,
plus 'bass' onsets (808 hits).

Run:  uv run python analyze_ft.py [--plots]
"""
import common
import json
import math
import sys
import numpy as np
import analyze as A

SR = 44100
FPS = 100
PA, OFFA = 60 / 150.269, 0.1437
BARA = 4 * PA
R_ANCHOR, R_BAR = 84.715, 4 * 0.39783          # bar 54 downbeat, bar length
B_ANCHOR, B_BAR = 103.74058, 4 * 0.39489036    # bar 66 downbeat, bar length

SECTIONS = [  # (name, first bar, last bar exclusive)
    ("intro", 1, 9), ("hook1", 9, 17), ("verse1", 17, 33), ("hook2", 33, 41), ("hook3", 41, 49),
    ("prehook", 49, 57), ("build", 57, 65), ("verse2", 65, 81), ("outro", 81, None),
]


def downbeats(duration):
    d = [OFFA + k * BARA for k in range(49)]                      # bars 1..49
    d += [R_ANCHOR + (k - 54) * R_BAR for k in range(50, 58)]      # bars 50..57
    k = 58
    while True:
        t = B_ANCHOR + (k - 66) * B_BAR
        if t > duration + B_BAR:
            break
        d.append(t)
        k += 1
    return np.array(d)


def main(plots=False):
    mix, _ = common.load_mix(SR)
    duration = len(mix) / SR
    stems = {n: common.load_stem(n, sr=SR)[0][: len(mix)] for n in ("vocals", "drums", "bass", "other")}
    for n in stems:
        if len(stems[n]) < len(mix):
            stems[n] = np.pad(stems[n], (0, len(mix) - len(stems[n])))
    db = downbeats(duration)
    beats = np.concatenate([np.linspace(db[i], db[i + 1], 5)[:4] for i in range(len(db) - 1)])
    beats = beats[beats <= duration + 1e-6]
    db = db[db <= duration + 1e-6]
    bar_t = lambda k: float(db[k - 1])

    n = int(math.ceil(duration * FPS))
    env = {}
    env["rms"] = A.frame_rms(mix, SR)[:n]
    for name, (lo, hi) in {"low": (None, 150), "mid": (150, 2000), "high": (4000, None)}.items():
        env[name] = A.frame_rms(A.sosfiltfilt(A.band_sos(lo, hi, SR), mix), SR)[:n]
    for s in ("vocal", "drums", "bass", "other"):
        env[s] = A.frame_rms(stems["vocals" if s == "vocal" else s], SR)[:n]
    for k in env:
        e = A.smooth_env(env[k])
        env[k] = [round(float(x), 3) for x in A.norm01(e)]

    (kt, kdb), (st, sdb), (ht, hdb), _ = A.drum_onsets(stems["drums"], SR, PA, OFFA)
    bt, bdb = A.band_onsets(stems["bass"], SR, None, 150, win=0.015, min_gap=0.18, rel_db=9)
    onsets = {
        "kick": [[round(float(t), 3), round(float(s), 3)] for t, s in zip(kt, A.strength01(kdb))],
        "snare": [[round(float(t), 3), round(float(s), 3)] for t, s in zip(st, A.strength01(sdb))],
        "hat": [[round(float(t), 3), round(float(s), 3)] for t, s in zip(ht, A.strength01(hdb))],
        "bass": [[round(float(t), 3), round(float(s), 3)] for t, s in zip(bt, A.strength01(bdb))],
        "vocal": [[round(t, 3), round(s, 3)] for t, s in A.vocal_onsets(stems["vocals"], SR)],
    }
    sections = [dict(name=nm, start=0.0 if a == 1 else round(bar_t(a), 3), end=round(duration if b is None else bar_t(b), 3))
                for nm, a, b in SECTIONS]
    doc = dict(duration=round(duration, 3), bpm=150.269, beat_period=round(PA, 5), time_signature=4,
               beats=[round(float(t), 3) for t in beats], downbeats=[round(float(t), 3) for t in db],
               sections=sections, fps=FPS, **env, onsets=onsets, notes=__doc__)
    (common.DATA / "audio.json").write_text(json.dumps(doc, separators=(",", ":"), ensure_ascii=False))
    print("wrote audio.json:", len(beats), "beats", len(db), "bars;", {k: len(v) for k, v in onsets.items()})
    for s in sections:
        print(f"  {s['name']:8s} {s['start']:8.3f} - {s['end']:8.3f}")
    if plots:
        A.make_plots.__globals__["FPS"] = FPS
        make_plots(doc, stems)
    return doc


def make_plots(doc, stems):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import librosa
    t = np.arange(len(doc["rms"])) / FPS
    wins = [(a, a + 13.0) for a in np.arange(0, 135, 12.8)]
    for (t0, t1) in wins:
        fig, ax = plt.subplots(3, 1, figsize=(22, 10), sharex=True, gridspec_kw=dict(height_ratios=[2, 1.4, 1.4]))
        d = stems["drums"][int(t0 * SR):int(t1 * SR)]
        S = librosa.amplitude_to_db(np.abs(librosa.stft(d, n_fft=1024, hop_length=128)), ref=np.max)
        ax[0].imshow(S, origin="lower", aspect="auto", cmap="magma", vmin=-60, vmax=0, extent=[t0, t0 + S.shape[1] * 128 / SR, 0, SR / 2])
        ax[0].set_ylim(0, 12000)
        m = (t >= t0) & (t <= t1)
        for k, c in [("rms", "k"), ("low", "tab:red"), ("mid", "tab:green"), ("high", "tab:blue")]:
            ax[1].plot(t[m], np.array(doc[k])[m], color=c, lw=1, label=k)
        for k, c in [("vocal", "tab:purple"), ("drums", "tab:orange"), ("bass", "tab:brown"), ("other", "tab:olive")]:
            ax[2].plot(t[m], np.array(doc[k])[m], color=c, lw=1, label=k)
        ax[1].legend(loc="upper left", fontsize=8); ax[2].legend(loc="upper left", fontsize=8)
        for b in doc["beats"]:
            if t0 <= b <= t1:
                for a_ in ax: a_.axvline(b, color="gray", lw=0.6, alpha=0.6)
        for i, b in enumerate(doc["downbeats"]):
            if t0 <= b <= t1:
                for a_ in ax: a_.axvline(b, color="c" if a_ is ax[0] else "k", lw=1.8)
                ax[0].text(b + 0.02, 11000, str(i + 1), color="w", fontsize=12)
        for name, y, c in [("kick", 1500, "tab:red"), ("snare", 5000, "w"), ("hat", 9500, "yellow")]:
            for (ot, s) in doc["onsets"][name]:
                if t0 <= ot <= t1: ax[0].plot([ot], [y], marker="v", color=c, ms=4 + 8 * s)
        for (ot, s) in doc["onsets"]["bass"]:
            if t0 <= ot <= t1: ax[2].plot([ot], [1.02], marker="v", color="tab:brown", ms=3 + 6 * s)
        for s in doc["sections"]:
            if t0 <= s["start"] <= t1: ax[1].text(s["start"], 1.02, s["name"], fontsize=14, color="tab:red")
        ax[2].set_xlim(t0, t1)
        fig.tight_layout(); fig.savefig(common.QA / f"audio_{int(t0):03d}.png", dpi=60); plt.close(fig)


if __name__ == "__main__":
    main(plots="--plots" in sys.argv)
