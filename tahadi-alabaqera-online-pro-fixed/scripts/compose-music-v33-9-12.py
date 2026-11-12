"""Render original, circular instrumental scores for the game's music routes.

Build-only requirements: numpy, libfluidsynth, ffmpeg, a General MIDI SoundFont.
No synthesizer or extra dependency is needed by the shipped browser game.
"""
import argparse
import ctypes as C
import ctypes.util
import json
import math
from pathlib import Path
import random
import subprocess
import tempfile
import wave

import numpy as np

RATE = 44100
SCORES = {
    'lobby': ('After Hours', 74, 48, 'lounge', 24),
    'billiards': ('Velvet & Ivory', 82, 50, 'pool', 32),
    'carrom': ('Maple Room', 94, 50, 'acoustic', 32),
    'baloot': ('Quiet Majlis', 78, 45, 'acoustic', 24),
    'jackaroo': ('Four Corners', 88, 48, 'acoustic', 24),
    'chaos': ('Colour Club', 104, 50, 'groove', 24),
    'snakes': ('Easy Steps', 92, 48, 'groove', 24),
    'zahra': ('Evening Dice', 86, 45, 'lounge', 24),
    'dice': ('Amber Lounge', 90, 50, 'lounge', 24),
    'hockey': ('Clean Break', 112, 45, 'sport', 24),
    'focus': ('Still Water', 68, 48, 'focus', 24),
    'quiz': ('The Next Answer', 90, 50, 'focus', 24),
    'words': ('Between Lines', 80, 45, 'acoustic', 24),
    'arcade': ('Night Drive', 108, 48, 'sport', 24),
    'party': ('Good Company', 100, 50, 'groove', 24),
    'jewels': ('Cut Glass', 102, 48, 'groove', 24),
}
VOICINGS = {'m9': [3, 7, 10, 14], 'maj9': [4, 7, 11, 14],
            '13': [4, 9, 10, 14], '7': [4, 7, 10, 14]}
PROGRESSIONS = {
    'pool': [(0, 'm9'), (5, '13'), (-2, 'maj9'), (3, 'maj9'),
             (0, 'm9'), (5, '13'), (-2, 'maj9'), (-5, '7')],
    'acoustic': [(0, 'm9'), (-2, 'maj9'), (-4, 'maj9'), (-5, '7')],
    'lounge': [(0, 'maj9'), (-3, 'm9'), (2, 'm9'), (7, '13')],
    'focus': [(0, 'maj9'), (5, 'maj9'), (-3, 'm9'), (2, 'm9')],
    'groove': [(0, 'm9'), (3, 'maj9'), (-2, 'maj9'), (5, '13')],
    'sport': [(0, 'm9'), (-2, 'maj9'), (3, 'maj9'), (-5, '7')],
}


class Synth:
    def __init__(self, soundfont):
        lib = C.CDLL(ctypes.util.find_library('fluidsynth'))
        signatures = {
            'new_fluid_settings': (C.c_void_p, []),
            'fluid_settings_setnum': (C.c_int, [C.c_void_p, C.c_char_p, C.c_double]),
            'fluid_settings_setint': (C.c_int, [C.c_void_p, C.c_char_p, C.c_int]),
            'new_fluid_synth': (C.c_void_p, [C.c_void_p]),
            'fluid_synth_sfload': (C.c_int, [C.c_void_p, C.c_char_p, C.c_int]),
            'fluid_synth_program_change': (C.c_int, [C.c_void_p, C.c_int, C.c_int]),
            'fluid_synth_cc': (C.c_int, [C.c_void_p, C.c_int, C.c_int, C.c_int]),
            'fluid_synth_noteon': (C.c_int, [C.c_void_p, C.c_int, C.c_int, C.c_int]),
            'fluid_synth_noteoff': (C.c_int, [C.c_void_p, C.c_int, C.c_int]),
            'fluid_synth_write_float': (C.c_int, [C.c_void_p, C.c_int, C.c_void_p, C.c_int, C.c_int, C.c_void_p, C.c_int, C.c_int]),
            'delete_fluid_synth': (None, [C.c_void_p]),
            'delete_fluid_settings': (None, [C.c_void_p]),
        }
        for name, (result, args) in signatures.items():
            f = getattr(lib, name); f.restype = result; f.argtypes = args
        self.lib = lib; self.settings = lib.new_fluid_settings()
        for name, value in {'synth.sample-rate': RATE, 'synth.gain': .65,
                            'synth.reverb.room-size': .36, 'synth.reverb.damp': .62,
                            'synth.reverb.width': 36, 'synth.reverb.level': .20}.items():
            lib.fluid_settings_setnum(self.settings, name.encode(), value)
        lib.fluid_settings_setint(self.settings, b'synth.chorus.active', 0)
        lib.fluid_settings_setint(self.settings, b'synth.polyphony', 128)
        self.synth = lib.new_fluid_synth(self.settings)
        if lib.fluid_synth_sfload(self.synth, str(soundfont).encode(), 1) < 0:
            raise RuntimeError('Cannot load SoundFont')

    def channel(self, channel, program, volume, pan):
        self.lib.fluid_synth_program_change(self.synth, channel, program)
        self.lib.fluid_synth_cc(self.synth, channel, 7, volume)
        self.lib.fluid_synth_cc(self.synth, channel, 10, pan)

    def samples(self, count):
        left = np.empty(count, dtype=np.float32); right = np.empty_like(left)
        self.lib.fluid_synth_write_float(self.synth, count, left.ctypes.data, 0, 1, right.ctypes.data, 0, 1)
        return np.stack([left, right], axis=1)

    def close(self):
        self.lib.delete_fluid_synth(self.synth); self.lib.delete_fluid_settings(self.settings)


def compose(key, config):
    title, bpm, tonic, mood, bars = config
    rng = random.Random('busraj-original-score-2026-' + key)
    events = []; period = bars * 4

    def note(channel, pitch, beat, duration, velocity):
        # Small timing/velocity changes are repeated identically at every loop.
        at = max(0, beat + rng.uniform(-.012, .012))
        velocity = max(1, min(110, round(velocity + rng.uniform(-4, 4))))
        events.extend([(at, True, channel, int(pitch), velocity),
                       (at + duration, False, channel, int(pitch), 0)])

    progression = PROGRESSIONS[mood]
    for bar in range(bars):
        degree, quality = progression[bar % len(progression)]
        root = tonic + degree; chord = [root + step for step in VOICINGS[quality]]
        beat = bar * 4; section = (bar // 8) % 3
        if mood == 'acoustic':
            # Nylon guitar: broken voicings, small strums and breathing room.
            for step, index in enumerate([0, 2, 1, 3, 2, 1]):
                note(0, chord[index], beat + step * .5, .85, 56 if step % 2 else 63)
            if bar % 4 == 3:
                for i, pitch in enumerate(chord): note(0, pitch, beat + 3.1 + i * .025, .6, 47)
        else:
            for offset, length, strength in ([(0, 3.65, 48)] if mood == 'focus' else [(0, 1.6, 57), (2.55, 1.1, 43)]):
                for i, pitch in enumerate(chord): note(0, pitch, beat + offset + i * .013, length, strength)
        # A round, sparse bass anchors the harmony instead of a synthetic drone.
        note(1, root - 12, beat + .025, 1.65 if mood != 'sport' else .7, 67)
        if mood != 'focus':
            note(1, root - 5, beat + 2.05, .8, 48)
            if bar % 2: note(1, root - 10, beat + 3.5, .4, 42)
        # Call and response; half the phrase deliberately has no lead.
        if bar % 4 in (0, 1, 3) and (section != 0 or bar % 2 == 0):
            motif = [2, 3, 1] if bar % 4 == 0 else [3, 2, 0]
            for j, index in enumerate(motif):
                if j == 1 and mood == 'focus': continue
                pitch = chord[index] + (12 if mood in ('groove', 'sport') else 0)
                note(2, pitch, beat + [.7, 1.65, 3.1][j], [.55, .7, 1.1][j], 43 if mood == 'pool' else 39)
        if mood in ('lounge', 'focus') and bar % 2 == 0:
            for pitch in chord[1:3]: note(3, pitch, beat + .2, 7.1, 24)
        if mood != 'focus':
            for step in range(8):
                swing = .08 if mood in ('pool', 'lounge') and step % 2 else 0
                note(9, 70 if mood == 'acoustic' else 42, beat + step * .5 + swing, .12, 23 if step % 2 else 17)
            for offset in (1.0, 3.0): note(9, 37, beat + offset + .015, .1, 29 if mood != 'sport' else 38)
            note(9, 36, beat, .12, 34 if mood in ('pool', 'lounge') else 43)
            if mood in ('groove', 'sport'): note(9, 36, beat + 2.5, .12, 32)
            if mood == 'acoustic' and bar % 2: note(9, 64, beat + 3.5, .16, 26)
        if bar % 8 == 7 and mood not in ('focus', 'acoustic'):
            for offset in (3.0, 3.5, 3.75): note(9, 51, beat + offset, .3, 18)
    return sorted(events), period


def render(key, config, soundfont, output):
    title, bpm, tonic, mood, bars = config
    events, beats = compose(key, config)
    synth = Synth(soundfont)
    # Programs use General MIDI's zero-based numbering.
    programs = [24 if mood == 'acoustic' else 0 if mood == 'focus' else 4,
                33 if mood == 'acoustic' else 32, 11 if mood == 'pool' else 24 if mood == 'focus' else 12, 89]
    for channel, program, volume, pan in [(0, programs[0], 85, 53), (1, programs[1], 83, 64),
                                         (2, programs[2], 67, 78), (3, programs[3], 38, 66), (9, 0, 67, 64)]:
        synth.channel(channel, program, volume, pan)
    period = round(beats * 60 / bpm * RATE); lead = RATE
    end = period * 2 + lead; start = period - lead
    scheduled = []
    for cycle in range(3):
        for beat, on, channel, pitch, velocity in events:
            frame = round(beat * 60 / bpm * RATE) + cycle * period
            if frame < end: scheduled.append((frame, on, channel, pitch, velocity))
    scheduled.sort(key=lambda e: (e[0], e[1]))
    chunks = []; position = 0
    try:
        for frame, on, channel, pitch, velocity in scheduled:
            if frame > position:
                chunk = synth.samples(frame - position)
                if frame > start: chunks.append(chunk[max(0, start - position):])
                position = frame
            if on: synth.lib.fluid_synth_noteon(synth.synth, channel, pitch, velocity)
            else: synth.lib.fluid_synth_noteoff(synth.synth, channel, pitch)
        if position < end: chunks.append(synth.samples(end - position))
    finally: synth.close()
    data = np.concatenate(chunks)
    data -= np.mean(data, axis=0)
    peak = float(np.max(np.abs(data))); data *= .8 / max(peak, .001)
    with tempfile.NamedTemporaryFile(suffix='.wav') as temporary:
        with wave.open(temporary.name, 'wb') as wav:
            wav.setnchannels(2); wav.setsampwidth(2); wav.setframerate(RATE)
            wav.writeframes((np.clip(data, -1, 1) * 32767).astype('<i2').tobytes())
        result = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', temporary.name,
                                 '-af', 'loudnorm=I=-19:LRA=8:TP=-2', '-ar', str(RATE), '-codec:a', 'libmp3lame',
                                 '-b:a', '128k', '-metadata', 'title=' + title, '-metadata', 'artist=Busraj Original Scores',
                                 '-metadata', 'comment=Original composition; sampled instruments rendered using FluidSynth and TimGM6mb.',
                                 str(output)], capture_output=True, text=True)
        if result.returncode: raise RuntimeError(result.stderr)
    return {'title': title, 'bpm': bpm, 'mood': mood, 'bars': bars, 'lead': 1.0,
            'loop': period / RATE, 'file': output.name, 'bytes': output.stat().st_size,
            'sample_rate': RATE, 'integrated_target_lufs': -19, 'true_peak_ceiling_dbtp': -2,
            'programs': programs, 'composition': 'Original, deterministic arrangement'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--soundfont', type=Path, default=Path('/usr/share/sounds/sf2/TimGM6mb.sf2'))
    parser.add_argument('--tracks', nargs='*', default=list(SCORES))
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'public/assets/music/v33-9-12')
    args = parser.parse_args(); args.output.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for key in args.tracks:
        manifest[key] = render(key, SCORES[key], args.soundfont, args.output / (key + '.mp3'))
        print(key, manifest[key]['title'], round(manifest[key]['loop'], 2), 'seconds', flush=True)
    (args.output / 'scores.json').write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__': main()
