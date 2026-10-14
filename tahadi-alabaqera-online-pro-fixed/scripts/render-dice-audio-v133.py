"""Short, varied dice foley with controlled treble and comfortable headroom."""
from pathlib import Path
import wave
import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
OUT = Path(__file__).resolve().parents[1] / 'public/assets/sounds/dice-v133'
OUT.mkdir(parents=True, exist_ok=True)

def contact(rng, style, seconds=.16):
    t = np.arange(int(seconds * SR)) / SR
    base, decay, ceiling = {'soft': (148, .032, 1800), 'wood': (218, .023, 2400), 'crystal': (415, .038, 3300)}[style]
    base *= rng.uniform(.86, 1.12)
    modes = sum(np.sin(2 * np.pi * base * k * t) * np.exp(-t / (decay / k**.4)) * weight
                for k, weight in [(1, .55), (2.31, .21), (3.89, .09)])
    filtered = sosfilt(butter(2, [240, ceiling], 'bandpass', fs=SR, output='sos'), rng.normal(size=len(t)))
    y = (modes + filtered * .24 * np.exp(-t / .008)) * np.minimum(1, t / .003)
    return y

def save(name, y):
    y -= np.mean(y)
    right = y.copy()
    delay = 130
    right[delay:] += y[:-delay] * .035
    stereo = np.stack([y, right], axis=1)
    stereo *= .28 / max(np.max(np.abs(stereo)), 1e-9)
    fade = min(500, len(y) // 4)
    stereo[-fade:] *= np.linspace(1, 0, fade)[:, None]
    with wave.open(str(OUT / (name + '.wav')), 'wb') as f:
        f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR)
        f.writeframes((stereo * 32767).astype('<i2').tobytes())

for family_index, style in enumerate(['soft', 'wood', 'crystal']):
    for variant in range(2):
        rng = np.random.default_rng(13300 + family_index * 10 + variant)
        duration = .64 + variant * .07 + family_index * .025
        y = np.zeros(int(duration * SR))
        for index, at in enumerate([0, .09, .21, .36, .48]):
            at += rng.uniform(0, .019)
            hit = contact(rng, style)
            begin = int(at * SR); size = min(len(hit), len(y) - begin)
            y[begin:begin+size] += hit[:size] * [.34, .52, .43, .29, .14][index]
        save(style + '-' + str(variant + 1), y)
    rng = np.random.default_rng(13400 + family_index)
    save('land-' + style, contact(rng, style, .14))
print('Rendered six dice rolls and three short settling contacts')
