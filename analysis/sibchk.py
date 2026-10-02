import numpy as np, sys
f=dict(np.load('work/vocal_feats.npz')); hop=float(f['hop_s'])
from scipy.ndimage import uniform_filter1d
sib=uniform_filter1d(f['sib_ratio'],5); r=f['rms_db']; on=f['onset']
a,b=float(sys.argv[1]),float(sys.argv[2])
for i in range(int(a/hop),int(b/hop),6):
    print(f"{i*hop:6.2f} sib {sib[i]:6.1f} {'#'*int(max(0,sib[i]+20)/1.5)} rms {r[i]:6.1f} on {on[i]:.2f}")
