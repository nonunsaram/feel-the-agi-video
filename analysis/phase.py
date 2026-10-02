import common, numpy as np, analyze as A
SR=44100
P=60/150.269; BAR=4*P; OFF=0.1437
d=common.load_stem("drums",sr=SR)[0]; b=common.load_stem("bass",sr=SR)[0]
kt,kdb=A.band_onsets(d,SR,None,120,win=0.012,min_gap=0.12,rel_db=10)
st,sdb=A.band_onsets(d,SR,1500,5000,win=0.010,min_gap=0.12,rel_db=10)
ht,hdb=A.band_onsets(d,SR,7000,None,win=0.006,min_gap=0.06,rel_db=9)
def show(name,ts,db,a,bb):
    m=(ts>=a)&(ts<bb)
    print(name," ".join(f"{t:.3f}[{((t-OFF)/P)%4:.2f}]" for t in ts[m]))
for k in (57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,80,81,83,84,85):
    a=OFF+(k-1)*BAR; print(f"--- bar {k} ({a:.3f})")
    show(" kick",kt,kdb,a-0.02,a+BAR-0.02); show(" snare",st,sdb,a-0.02,a+BAR-0.02)
