"""Overview plot of a time window: vocal-stem spectrogram (0-8k), mix spectrogram (0-8k), rms/onset/sib, bar+beat grid, optional unit labels.
   python ov.py t0 t1 name"""
import common, sys, json, numpy as np, librosa
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
font_manager.fontManager.addfont("/System/Library/Fonts/AppleSDGothicNeo.ttc"); plt.rcParams["font.family"]=["Apple SD Gothic Neo","sans-serif"]
P=60/150.269; BAR=4*P; OFF=0.1437
t0,t1=float(sys.argv[1]),float(sys.argv[2]); name=sys.argv[3] if len(sys.argv)>3 else f"ov_{t0:.0f}"
sr=22050
v,_=common.load_stem("vocals",sr=sr); m,_=common.load_mix(sr)
f=dict(np.load(common.WORK/"vocal_feats.npz")); ht=float(f["hop_s"])
fig,ax=plt.subplots(4,1,figsize=(22,13),sharex=True,gridspec_kw=dict(height_ratios=[2.4,1.6,1.1,0.9]))
hop=64
for a_,y in ((ax[0],v),(ax[1],m)):
    seg=y[int(t0*sr):int(t1*sr)]
    S=librosa.amplitude_to_db(np.abs(librosa.stft(seg,n_fft=1024,hop_length=hop)),ref=np.max)
    fr=librosa.fft_frequencies(sr=sr,n_fft=1024)
    a_.imshow(S[fr<=8000],origin="lower",aspect="auto",cmap="magma",vmin=-70,vmax=0,extent=[t0,t0+S.shape[1]*hop/sr,0,8000])
ax[0].set_ylabel("vocal stem"); ax[1].set_ylabel("mix")
i0,i1=int(t0/ht),int(t1/ht); tt=np.arange(i0,i1)*ht
ax[2].plot(tt,f["rms_db"][i0:i1],"k",lw=1,label="rms"); ax[2].plot(tt,np.clip(f["sib_ratio"][i0:i1],-60,10)-10,"tab:blue",lw=.8,label="sib")
ax[2].set_ylim(-70,5); axb=ax[2].twinx(); axb.fill_between(tt,0,f["onset"][i0:i1],color="tab:green",alpha=.35); ax[2].legend(loc="upper left",fontsize=7)
for n in range(int((t0-OFF)/P*2)-1,int((t1-OFF)/P*2)+2):
    tb=OFF+n*P/2
    if t0<=tb<=t1:
        for a_ in ax: a_.axvline(tb,color="w" if a_ in (ax[0],ax[1]) else "gray",lw=1.6 if n%8==0 else (0.7 if n%2==0 else 0.25),alpha=.9 if n%8==0 else .5)
        if n%8==0: ax[3].text(tb+0.01,1.45,f"bar {n//8+1}",fontsize=11,color="k")
p=common.WORK/"align_debug.json"
if p.exists():
    U=json.loads(p.read_text())["units"]
    for u in U:
        if u["end"]<t0 or u["start"]>t1: continue
        for a_ in ax[:3]: a_.axvline(u["start"],color="cyan" if a_ is not ax[2] else "r",lw=.9,ls="--")
        ax[3].plot([u["start"],u["end"]],[1,1],lw=6,alpha=.5,color="tab:red"); ax[3].text(u["start"],1.12,u["part"],fontsize=11,clip_on=True)
        ax[3].plot([u["ctc_start"],u["ctc_end"]],[0.6,0.6],lw=5,alpha=.5,color="tab:blue"); ax[3].text(u["ctc_start"],0.68,u["spell"],fontsize=8,clip_on=True,color="tab:blue")
ax[3].set_ylim(0.3,1.7); ax[3].set_yticks([]); ax[3].set_xlim(t0,t1)
ax[3].set_xticks(np.arange(np.ceil(t0*10)/10,t1,0.1),minor=True); ax[3].set_xticks(np.arange(np.ceil(t0*2)/2,t1,0.5))
for a_ in ax[2:]: a_.grid(True,which="both",axis="x",alpha=.25)
fig.tight_layout(); fig.savefig(common.QA/f"{name}.png",dpi=72); print(common.QA/f"{name}.png")
