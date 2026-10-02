import common, numpy as np, analyze as A
SR=44100
d=common.load_stem("drums",sr=SR)[0]
kt,_=A.band_onsets(d,SR,None,120,win=0.012,min_gap=0.12,rel_db=10)
st,_=A.band_onsets(d,SR,1500,5000,win=0.010,min_gap=0.12,rel_db=10)
k=kt[(kt>101.2)&(kt<115.7)]
P0=0.3949; n=np.round((k-103.746)/P0)
A_=np.vstack([n,np.ones_like(n)]).T
(P,t0),res,_,_=np.linalg.lstsq(A_,k,rcond=None)
r=k-(t0+n*P)
print("grid B: P",P,"bpm",60/P,"t0 (downbeat, '끝')",t0,"resid sd ms",r.std()*1000, "max",np.abs(r).max()*1000, "n",len(k))
# how do all drum onsets 88..135 sit on grid B (8th positions)?
for name,ts in (("kick",kt),("snare",st)):
    m=(ts>88)&(ts<135.2)
    x=(ts[m]-t0)/(P/2); fr=x-np.round(x)
    print(name)
    for t,xx,f in zip(ts[m],x,fr):
        print(f"  {t:8.3f}  8th#{int(np.round(xx)):4d} (beat {np.round(xx)/2:6.1f}, bar {np.round(xx)/8:6.2f})  dev {f*P/2*1000:6.1f} ms")
