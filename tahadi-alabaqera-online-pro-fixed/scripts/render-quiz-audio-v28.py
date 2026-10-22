"""Deterministic, short and distinct quiz interface cues; no quiz answer clips."""
from pathlib import Path
import math, wave, struct

OUT = Path(__file__).resolve().parents[1] / 'public/assets/sounds/quiz-v28'
OUT.mkdir(parents=True, exist_ok=True)
RATE = 24000
SCORES = {
    'round': [(0, 440, .09), (.09, 660, .12)],
    'correct': [(0, 523.25, .13), (.1, 659.25, .13), (.2, 783.99, .24)],
    'wrong': [(0, 311.13, .14), (.14, 233.08, .24)],
    'reveal': [(0, 740, .09), (.07, 880, .16)],
    'buzzer': [(0, 880, .055), (.075, 1108.73, .09)],
    'timeout': [(0, 392, .09), (.12, 392, .09), (.24, 293.66, .18)],
    'relay': [(0, 523.25, .1), (.08, 783.99, .1), (.16, 1046.5, .18)],
}
for name, notes in SCORES.items():
    length = max(start + duration for start, _, duration in notes) + .03
    values = []
    for sample in range(round(length * RATE)):
        t, value = sample / RATE, 0.0
        for start, frequency, duration in notes:
            local = t - start
            if 0 <= local < duration:
                envelope = min(1, local / .008) * min(1, (duration - local) / .04)
                value += envelope * (math.sin(2 * math.pi * frequency * local) + .12 * math.sin(4 * math.pi * frequency * local))
        values.append(value)
    peak = max(map(abs, values), default=1)
    with wave.open(str(OUT / (name + '.wav')), 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(RATE)
        audio.writeframes(b''.join(struct.pack('<h', round(v / peak * 11000)) for v in values))
print(f'Rendered {len(SCORES)} distinct quiz cues.')
