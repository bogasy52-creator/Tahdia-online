"""Tahdia 31.1.0 — the snakes & ladders eating sound.
A crunchy bite followed by two gulps, so the moment a snake eats a stone is
unmistakable. Deterministic; run with numpy/scipy to regenerate the WAV.
"""
from pathlib import Path
import wave
import numpy as np
from scipy.signal import butter, sosfilt

SR = 22050
OUT = Path(__file__).resolve().parents[1] / 'public/assets/sounds/board-v31-1'
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(31110)


def band(x, lo, hi, order=3):
    return sosfilt(butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)


def low(x, hi, order=3):
    return sosfilt(butter(order, hi, 'lowpass', fs=SR, output='sos'), x)


def tvec(duration):
    return np.arange(int(duration * SR)) / SR


def snap(duration=.05):
    """The jaws closing: a bright transient and a short body thump."""
    t = tvec(duration)
    click = band(rng.normal(size=len(t)), 1800, 7000) * np.exp(-t / .004)
    f = 210 * np.exp(-t / .03) + 70
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .028)
    return click * .9 + thump * .8


def crunch(duration=.045, lo=1300, hi=5200):
    t = tvec(duration)
    grit = band(rng.normal(size=len(t)), lo, hi) * (rng.random(len(t)) > .45)
    env = np.minimum(1, t / .002) * np.exp(-t / .016)
    return grit * env * 1.3


def gulp(duration=.17, f0=430, f1=150, gain=1.):
    """A swallow: a falling, slightly hollow tone with a wet low layer."""
    t = tvec(duration)
    u = t / duration
    f = f0 * (f1 / f0) ** u
    phase = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(phase) + .35 * np.sin(2 * phase + .6) + .12 * np.sin(3 * phase)
    env = np.sin(np.pi * np.minimum(1, u * 1.05)) ** 1.4 * np.exp(-u * 1.6)
    wet = low(rng.normal(size=len(t)), 420) * env * .6
    return (tone * .75 + wet) * env * gain


def place(y, at, sound, gain=1.):
    i = int(at * SR)
    n = min(len(sound), len(y) - i)
    if n > 0:
        y[i:i + n] += sound[:n] * gain


y = np.zeros(int(.78 * SR))
place(y, 0.000, snap(), 1.0)
for at, g in [(.055, .55), (.098, .7), (.15, .45), (.19, .35)]:
    place(y, at, crunch(), g)
place(y, 0.30, gulp(.18, 440, 150), 1.0)
place(y, 0.52, gulp(.15, 330, 120, .8), .75)
y -= np.mean(y)
peak = np.max(np.abs(y))
y *= .82 / max(peak, 1e-8)
fade = 300
y[-fade:] *= np.linspace(1, 0, fade)
with wave.open(str(OUT / 'snake-eat.wav'), 'wb') as wav:
    wav.setnchannels(1)
    wav.setsampwidth(2)
    wav.setframerate(SR)
    wav.writeframes((y * 32767).astype('<i2').tobytes())
print('snake-eat.wav', len(y) / SR, 's')
