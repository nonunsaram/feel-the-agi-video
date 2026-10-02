import common, numpy as np, librosa
SR=22050; hop=32
d=common.load_stem("drums",sr=SR)[0]; m,_=common.load_mix(SR)
def env(y):
    o=librosa.onset.onset_strength(y=y,sr=SR,hop_length=hop,lag=1,max_size=1); return o/(np.percentile(o,99.5)+1e-9)
od=env(d); om=env(m); fps=SR/hop
PA=60/150.269; OFFA=0.1437
def fit(o,t0,t1,bpms):
    best=(-1,0,0)
    i0,i1=int(t0*fps),int(t1*fps)
    for bpm in bpms:
        P=60/bpm/2  # 8th-note comb
        for off in np.arange(0,P,0.003):
            ts=np.arange(t0+off,t1,P); idx=np.round(ts*fps).astype(int); idx=idx[(idx>1)&(idx<len(o)-2)]
            s=np.maximum.reduce([o[idx-1],o[idx],o[idx+1]]).mean()
            if s>best[0]: best=(s,bpm,t0+off)
    return best
for c in np.arange(20,134,4.0):
    t0,t1=c-4,c+4
    s,bpm,ph=fit(od,t0,t1,np.arange(148,154.01,0.1))
    sA,_,phA=fit(od,t0,t1,[150.269])
    # phase of 8th grid vs grid A (in 8ths)
    dA=((phA-OFFA)/(PA/2))%1
    print(f"{t0:5.0f}-{t1:5.0f}  best bpm {bpm:6.2f} score {s:.3f} | at 150.27: score {sA:.3f} 8th-phase {dA:.2f}")
