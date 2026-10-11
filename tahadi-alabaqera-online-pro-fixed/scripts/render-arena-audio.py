"""Deterministic stereo sound design: filtered foley, resonances and short tails.
No external samples or music. Run with numpy/scipy to regenerate the WAV assets.
"""
from pathlib import Path
import wave
import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
OUT = Path(__file__).resolve().parents[1] / 'public/assets/sounds/arena-v9'
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(9011)

def filt(x, lo, hi):
    return sosfilt(butter(3, [lo, hi], 'bandpass', fs=SR, output='sos'), x)

def hit(duration=.2, weight=1):
    t = np.arange(int(duration*SR))/SR
    # Felt/stone contact: inharmonic resonances rather than an electronic beep.
    modes = sum(np.sin(2*np.pi*f*t)*np.exp(-t/d) * a for f, d, a in
                [(132, .044, .55), (319, .035, .26), (577, .019, .11), (1187, .013, .08)])
    noise = filt(rng.normal(size=len(t)), 320, 4800)*np.exp(-t/.014)
    attack = np.minimum(1, t/.0015)
    return weight*(modes + noise*.65)*attack

def wash(duration=.3, lo=800, hi=4800, strength=.7):
    t = np.arange(int(duration*SR))/SR
    env = np.sin(np.pi*np.minimum(1, t/duration))**1.7
    return filt(rng.normal(size=len(t)), lo, hi)*env*strength

def bell(duration=.45, f=660):
    t = np.arange(int(duration*SR))/SR
    return sum(np.sin(2*np.pi*f*k*t)*np.exp(-t/(.17/k)) / k**1.8 for k in [1, 2.67, 4.11])*np.minimum(1,t/.003)

def compose(duration, events):
    y = np.zeros(int(duration*SR))
    for at, sound, gain in events:
        i = int(at*SR);n = min(len(sound),len(y)-i)
        if n>0:y[i:i+n]+=sound[:n]*gain
    return y

def save(name, y):
    # Small early reflections and controlled peaks; leave headroom for overlap.
    y = y - np.mean(y)
    left=y.copy();right=y.copy()
    for delay, gain in [(.017,.09),(.031,.05),(.053,.025)]:
        n=int(delay*SR);left[n:]+=y[:-n]*gain;right[n+13:]+=y[:-(n+13)]*gain
    stereo=np.stack([left,right],axis=1)
    peak=np.max(np.abs(stereo));stereo*=.48/max(peak,1e-8)
    fade=min(400,len(stereo)//8);stereo[-fade:]*=np.linspace(1,0,fade)[:,None]
    with wave.open(str(OUT/(name+'.wav')),'wb') as wav:
        wav.setnchannels(2);wav.setsampwidth(2);wav.setframerate(SR)
        wav.writeframes((stereo*32767).astype('<i2').tobytes())

save('dice',compose(1.22,[(t,hit(.16,w),.75) for t,w in [(0,.5),(.13,.7),(.30,.45),(.50,.38),(.87,1),(.99,.38),(1.09,.13)]]))
save('diceImpact',hit(.19))
save('step',hit(.11,.3))
save('land',compose(.25,[(0,hit(.2),.7),(.09,bell(.15,1240),.06)]))
save('hiss',wash(.6,1800,7200))
save('bite',compose(.3,[(0,wash(.13,180,1400),.35),(.065,hit(.18),.7)]))
save('swallow',compose(.9,[(t,wash(.26,65,550),g) for t,g in [(0,.7),(.24,.8),(.50,.45)]]))
save('grow',wash(.95,50,280,.5))
save('release',compose(.4,[(0,wash(.23,700,3300),.4),(.16,hit(.18),.45)]))
save('ladder',compose(.8,[(t,bell(.3,f),.22) for t,f in [(0,490),(.12,620),(.26,780),(.43,990)]]))
save('rung',compose(.17,[(0,hit(.12),.4),(.018,bell(.15,940),.12)]))
save('reward',compose(.95,[(t,bell(.48,f),.24) for t,f in [(0,520),(.11,780),(.23,1040)]]))
save('win',compose(1.7,[(t,bell(.65,f),.22) for t,f in [(0,392),(.17,494),(.35,587),(.58,784),(.77,988)]]))
save('card',wash(.15,1400,7600))
save('shuffle',compose(.55,[(t,wash(.10,1700,6500),g) for t,g in [(0,.6),(.08,.85),(.18,.75),(.29,.5),(.38,.3)]]))
save('capture',compose(.45,[(0,hit(.22),.7),(.08,wash(.25,70,900),.4)]))
save('click',hit(.07,.25))
save('error',compose(.25,[(0,hit(.15),.4),(.11,hit(.13),.28)]))
save('connect',compose(.6,[(0,bell(.36,620),.2),(.09,bell(.4,930),.17)]))
save('disconnect',compose(.6,[(0,bell(.36,510),.2),(.09,bell(.4,340),.17)]))
print(f'Rendered {len(list(OUT.glob("*.wav")))} stereo effects')
