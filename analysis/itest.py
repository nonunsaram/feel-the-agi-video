import common, json, numpy as np, librosa
y,sr=common.load_stem("vocals",sr=16000)
S=np.abs(librosa.stft(y,n_fft=1024,hop_length=80))**2; fr=librosa.fft_frequencies(sr=sr,n_fft=1024)
hi=S[(fr>1800)&(fr<3200)].sum(0); lo=S[(fr>500)&(fr<1400)].sum(0)
ii=10*np.log10(hi+1e-9)-10*np.log10(lo+1e-9)
from scipy.ndimage import uniform_filter1d
ii=uniform_filter1d(ii,5); hop=80/sr
U=json.load(open('work/align_debug.json'))['units']
for k,u in enumerate(U):
    if u['part']=='G' and U[k-1]['part']=='A' and U[k+1]['part']=='I' and U[k+1]['li']==u['li']:
        g=u['start']; a=int((g+0.06)/hop); b=int((g+0.5)/hop)
        seg=ii[a:b]; pk=a+int(np.argmax(seg[:int(0.2/hop)])); top=ii[pk]
        j=pk
        while j<b and ii[j]>top-7: j+=1
        print(f"L{u['li']:02d} G {g:.2f}  I now {U[k+1]['start']:.2f}  i->a drop {j*hop:.2f}  (+{j*hop-g:.2f})")
