import common, numpy as np, ko_align as K
from ctcalign import emissions
lines=[L for L in K.build_lines() if L["section"]=="build"]
for i,L in enumerate(lines): L["li"]=i
alts={
 "A": {"AGI": (["A","G","I"],["a","g","i"]), "Feel": (["Feel"],["feel"]), "The": (["The"],["the"]), "yah": (["yah"],["yah"])},
 "B": {"AGI": (["A","G","I"],["ay","gee","i"]), "Feel": (["Feel"],["feel"]), "The": (["The"],["the"]), "yah": (["yah"],["yeah"])},
 "C": {"AGI": (["A","G","I"],["a","jee","eye"]), "Feel": (["Feel"],["fil"]), "The": (["The"],["da"]), "yah": (["yah"],["ya"])},
}
for emn in ("lv60k","lv60k_vocL","lv60k_vocR","fused6"):
    E=emissions(emn)
    for name,pr in alts.items():
        old=dict(K.PRON); K.PRON.update(pr)
        K.LINE_WINDOWS.clear()
        u,score=K.align(E,lines)
        K.PRON.clear(); K.PRON.update(old)
        print(emn,name,round(score,1)," ".join(f"{x['part']}@{x['start']:.2f}({x['p']:.2f})" for x in u))
