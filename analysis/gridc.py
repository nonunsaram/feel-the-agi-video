import common, numpy as np, analyze as A
SR=44100
d=common.load_stem("drums",sr=SR)[0]
kt,_=A.band_onsets(d,SR,None,120,win=0.012,min_gap=0.12,rel_db=10)
st,_=A.band_onsets(d,SR,1500,5000,win=0.010,min_gap=0.12,rel_db=10)
ht,_=A.band_onsets(d,SR,7000,None,win=0.006,min_gap=0.06,rel_db=9)
PA,OA=60/150.269,0.1437; PB,OB=0.39489036,103.74058
def dev(t,P,O):
    x=(t-O)/(P/2); return (x-np.round(x))*P/2*1000, np.round(x)
for name,ts in (("kick",kt),("snare",st),("hat",ht)):
    print(name)
    for t in ts[(ts>76)&(ts<91.2)]:
        da,na=dev(t,PA,OA); db,nb=dev(t,PB,OB)
        print(f"  {t:8.3f}  A: bar {na/8+1:6.2f} dev {da:6.1f} | B: dev {db:6.1f}")
