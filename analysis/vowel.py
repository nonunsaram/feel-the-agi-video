import common, sys, numpy as np, librosa
y,sr=common.load_stem("vocals",sr=16000)
def track(t0,t1):
    seg=y[int(t0*sr):int(t1*sr)]
    S=np.abs(librosa.stft(seg,n_fft=1024,hop_length=160))**2
    fr=librosa.fft_frequencies(sr=sr,n_fft=1024)
    hi=S[(fr>1700)&(fr<3200)].sum(0); lo=S[(fr>500)&(fr<1500)].sum(0)
    r=10*np.log10(hi+1e-9)-10*np.log10(lo+1e-9)
    rms=10*np.log10(S.sum(0)+1e-9)
    for i in range(0,len(r),3):
        t=t0+i*0.01
        print(f"{t:6.2f} i-ness {r[i]:6.1f} {'#'*int(max(0,r[i]+25))}  lvl {rms[i]-rms.max():5.1f}")
track(float(sys.argv[1]),float(sys.argv[2]))
