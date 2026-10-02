import common, sys, numpy as np, torchaudio
from ctcalign import FRAME
P=60/150.269; BAR=4*P; OFF=0.1437
def dec(name, t0, t1):
    em=np.load(common.WORK/f"emission_{name}.npy")
    labs=list(torchaudio.pipelines.MMS_FA.get_labels(star=None)) if name.startswith("mms") else list(torchaudio.pipelines.WAV2VEC2_ASR_LARGE_LV60K_960H.get_labels())
    a,b=int(t0/FRAME),int(t1/FRAME)
    ids=em[a:b].argmax(1); out=[]; prev=-1
    for i,k in enumerate(ids):
        if k!=prev and labs[k] not in "-":
            out.append((labs[k], (a+i)*FRAME))
        prev=k
    # group by gaps
    s=""; last=None; line=[]
    for ch,t in out:
        if last is None or t-last>0.25:
            if s: line.append(s)
            bar=(t-OFF)/BAR+1
            s=f"[{t:.2f}|b{bar:.2f}]"
        s+=ch if ch!="|" else " "; last=t
    if s: line.append(s)
    print(name, " ".join(line))
t0,t1=float(sys.argv[1]),float(sys.argv[2])
for n in sys.argv[3:] or ["mms","mms_vocL","mms_vocR","lv60k"]:
    dec(n,t0,t1)
