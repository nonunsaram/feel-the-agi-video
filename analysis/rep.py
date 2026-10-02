import common, numpy as np
from scipy.signal import correlate
y,sr=common.load_stem("vocals",sr=16000)
P=60/150.269; BAR=4*P; OFF=0.1437
bt=lambda k: OFF+(k-1)*BAR
def xc(a0,b0,dur,name):
    a=y[int(a0*sr):int((a0+dur)*sr)]; b=y[int((b0-0.2)*sr):int((b0+dur+0.2)*sr)]
    c=correlate(b,a,mode='valid'); 
    na=np.sqrt((a**2).sum()); 
    nb=np.sqrt(np.convolve(b**2,np.ones(len(a)),mode='valid'))
    r=c/(na*nb+1e-9); i=np.argmax(r)
    print(f"{name}: peak corr {r[i]:.3f} at lag {(i/sr-0.2)*1000:.1f} ms")
for b in range(9,17): xc(bt(b),bt(b+24),BAR,f"hook1 bar{b} vs hook2")
for b in range(9,17): xc(bt(b),bt(b+32),BAR,f"hook1 bar{b} vs hook3")
xc(bt(17),bt(17+48),BAR,"hook1 tail bar17 vs hook3 tail bar 49?")
xc(bt(17),bt(17+24),BAR,"bar17 vs bar41")
for b in range(1,9): xc(bt(b),bt(b+48),BAR,f"intro bar{b} vs prehook")
for b in range(17,34): xc(bt(b),bt(b+48),BAR,f"verse1 bar{b} vs verse2")
