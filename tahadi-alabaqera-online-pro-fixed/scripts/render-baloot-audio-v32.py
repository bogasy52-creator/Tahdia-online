"""Tahdia 32.0.0 — Baloot table sounds.
Card sounds (deal, play on felt, gather a trick, riffle shuffle, flip) and
three short cues (a bid tap, the contract chime, the double hit) plus a
sparkle for projects and Baloot. Deterministic; numpy + scipy.
"""
from pathlib import Path
import wave
import numpy as np
from scipy.signal import butter, sosfilt

SR = 22050
OUT = Path(__file__).resolve().parents[1] / 'public/assets/sounds/baloot-v32'
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(32000)


def tvec(d):
    return np.arange(int(d * SR)) / SR


def band(x, lo, hi, order=3):
    return sosfilt(butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)


def low(x, hi, order=3):
    return sosfilt(butter(order, hi, 'lowpass', fs=SR, output='sos'), x)


def high(x, lo, order=2):
    return sosfilt(butter(order, lo, 'highpass', fs=SR, output='sos'), x)


def place(dst, src, at):
    i = int(at * SR)
    n = min(len(src), len(dst) - i)
    if n > 0:
        dst[i:i + n] += src[:n]


def swish(d=.07, lo=1800, hi=7500, decay=.018):
    t = tvec(d)
    noise = band(rng.normal(size=len(t)), lo, hi)
    env = np.minimum(1, t / .004) * np.exp(-t / decay)
    return noise * env


def click(d=.012, lo=2500, hi=9000, decay=.0025):
    t = tvec(d)
    return band(rng.normal(size=len(t)), lo, hi) * np.exp(-t / decay)


def thump(d=.12, f0=150, f1=70, decay=.035):
    t = tvec(d)
    f = f1 + (f0 - f1) * np.exp(-t / .02)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / decay)


def bell(f, d=.6, decay=.22, ratio=2.76, index=1.6):
    t = tvec(d)
    mod = np.sin(2 * np.pi * f * ratio * t) * index * np.exp(-t / (decay * .6))
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t / decay) * np.minimum(1, t / .003)


def finish(x, peak=.82):
    x = x - np.mean(x)
    fade = int(.012 * SR)
    if len(x) > fade:
        x[-fade:] *= np.linspace(1, 0, fade)
    m = np.max(np.abs(x)) or 1
    return x / m * peak


def write(name, x, peak=.82):
    data = (finish(np.asarray(x, dtype=float), peak) * 32767).astype('<i2')
    with wave.open(str(OUT / name), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


# A card leaving the deck.
deal = swish(.075, 2200, 8000, .016)
place(deal, click(.01) * .5, 0)
write('deal.wav', deal, .6)

# A card landing on felt: paper flick, a soft felt thud.
play = np.zeros(int(.13 * SR))
place(play, click(.012, 3000, 9500, .002) * .8, 0)
place(play, low(rng.normal(size=int(.1 * SR)), 900) * np.exp(-tvec(.1) / .02) * .9, .004)
place(play, thump(.11, 180, 85, .03) * .7, .004)
write('play.wav', play, .78)

# Gathering a trick: a longer slide with a couple of paper ticks.
gather = np.zeros(int(.3 * SR))
t = tvec(.26)
slide = band(rng.normal(size=len(t)), 900, 5200) * np.sin(np.pi * np.clip(t / .26, 0, 1)) ** 1.5
place(gather, slide * .8, 0)
for at in (.02, .09, .17):
    place(gather, click(.01, 2000, 7000, .002) * .45, at)
write('trick.wav', gather, .55)

# A riffle shuffle: clicks speeding up, then the bridge.
shuffle = np.zeros(int(.78 * SR))
at = 0.0
gap = .028
while at < .55:
    place(shuffle, click(.008, 2400, 8500, .0016) * (0.5 + rng.random() * .5), at)
    at += gap
    gap = max(.007, gap * .93)
place(shuffle, swish(.2, 900, 5000, .06) * .7, .56)
write('shuffle.wav', shuffle, .62)

# Turning a card face up.
flip = np.zeros(int(.1 * SR))
place(flip, click(.01, 2000, 8000, .002) * .7, 0)
place(flip, swish(.06, 1500, 6000, .014) * .8, .018)
place(flip, click(.01, 2500, 9000, .002) * .6, .05)
write('flip.wav', flip, .6)

# A bid: a short wooden tap with a warm tone.
tap = np.zeros(int(.22 * SR))
place(tap, bell(784, .2, .06, 2.0, .6) * .7, 0)
place(tap, bell(1568, .2, .04, 2.0, .3) * .25, 0)
place(tap, thump(.08, 300, 160, .02) * .4, 0)
write('bid.wav', tap, .7)

# The contract: two bell notes rising a fifth.
buy = np.zeros(int(.7 * SR))
place(buy, bell(659.3, .45, .18) * .7, 0)
place(buy, bell(987.8, .55, .22) * .8, .11)
write('buy.wav', buy, .75)

# A double: a low hit with a brassy stab.
dbl = np.zeros(int(.7 * SR))
t = tvec(.6)
boom = np.sin(2 * np.pi * np.cumsum(55 + 60 * np.exp(-t / .05)) / SR) * np.exp(-t / .18)
place(dbl, boom, 0)
place(dbl, low(rng.normal(size=len(t)), 1800) * np.exp(-t / .05) * .6, 0)
stab = np.zeros(len(t))
for f in (146.8, 220.0, 293.7):
    saw = 2 * ((f * t) % 1) - 1
    stab += low(saw, 1400) * np.exp(-t / .16) * np.minimum(1, t / .01)
place(dbl, stab * .35, .01)
write('double.wav', dbl, .85)

# A sparkle for projects and Baloot.
chime = np.zeros(int(.9 * SR))
for i, f in enumerate((1046.5, 1318.5, 1568.0, 2093.0)):
    place(chime, bell(f, .6, .2, 3.1, 1.1) * (.55 - i * .06), i * .07)
shimmer = high(rng.normal(size=int(.5 * SR)), 6000) * np.exp(-tvec(.5) / .12) * .08
place(chime, shimmer, .05)
write('chime.wav', chime, .7)

print('baloot sounds written to', OUT)
