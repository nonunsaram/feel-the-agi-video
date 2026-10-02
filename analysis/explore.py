import common, numpy as np, analyze as A
SR=44100
mix,_=common.load_mix(SR); dur=len(mix)/SR
st={n:common.load_stem(n,sr=SR)[0][:len(mix)] for n in ("vocals","drums","bass","other")}
bpm,P,off,res=A.fit_grid(st["drums"],mix,SR,dur)
print(f"bpm {bpm:.3f} P {P:.5f} off {off:.4f} resid sd {res.std()*1000:.1f}ms n {len(res)} dur {dur:.3f}")
kt,_=A.band_onsets(st["drums"],SR,None,120,win=0.012,min_gap=0.15,rel_db=12)
print("first kicks", np.round(kt[:12],3))
# drift check
n=np.round((kt-off)/P); r=kt-(off+n*P); ok=np.abs(r)<0.06
for a in range(0,135,15):
    m=ok&(kt>=a)&(kt<a+15)
    if m.sum(): print(f"{a:3d}-{a+15:3d}s kicks {m.sum():3d} median resid {np.median(r[m])*1000:6.1f} ms")
bar=4*P
def rms(x,a,b): 
    seg=x[int(max(a,0)*SR):int(b*SR)]; return 20*np.log10(np.sqrt((seg**2).mean())+1e-9)
print("bar start   voc  drums  bass other kicks(8th pos)")
for k in range(0,int((dur-off)/bar)+1):
    a=off+k*bar; b=a+bar
    kk=kt[(kt>=a-0.03)&(kt<b-0.03)]
    pos=np.round((kk-a)/(P/2)).astype(int)
    print(f"{k+1:3d} {a:7.3f} "+" ".join(f"{rms(st[n],a,b):6.1f}" for n in ("vocals","drums","bass","other")), list(pos))
