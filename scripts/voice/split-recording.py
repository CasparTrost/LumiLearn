#!/usr/bin/env python3
"""Cuts one recording of several of Lumi's sentences into one file per key.

The sentences were spoken in one go with a pause between them
(`<break time="1.4s" />`). The pauses are found with ffmpeg's silencedetect,
each part is cut to the speech, brought to the loudness of the other
recordings (-17 LUFS) and written as mono mp3, 96 kbit/s, 44.1 kHz:

  python3 scripts/voice/split-recording.py take.mp3 schrank/platz-top schrank/platz-bottom ...

writes public/audio/lumi/<key>.mp3 for every key and fails if the number of
parts found is not the number of keys.
"""
import re, subprocess, sys, os

src, keys = sys.argv[1], sys.argv[2:]
out = subprocess.run(['ffmpeg', '-hide_banner', '-i', src, '-af', 'silencedetect=noise=-38dB:d=0.7', '-f', 'null', '-'],
                     capture_output=True, text=True).stderr
dur = float(re.search(r'Duration: (\d+):(\d+):([\d.]+)', out).group(3)) + 60 * float(re.search(r'Duration: (\d+):(\d+):', out).group(2))
starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', out)]
ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', out)]
# speech lies between the silences
cuts, t = [], 0.0
for s, e in zip(starts, ends + [dur] * (len(starts) - len(ends))):
    if s - t > 0.15: cuts.append((t, s))
    t = e
if dur - t > 0.15: cuts.append((t, dur))
if len(cuts) != len(keys):
    sys.exit(f'{len(cuts)} parts found, {len(keys)} keys given: {cuts}')
for (a, b), key in zip(cuts, keys):
    dst = f'public/audio/lumi/{key}.mp3'
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    a, b = max(0, a - 0.06), min(dur, b + 0.12)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-i', src,
                    '-af', 'loudnorm=I=-17:TP=-1.5:LRA=11,afade=t=in:d=0.02', '-ac', '1', '-ar', '44100', '-b:a', '96k', dst], check=True)
    print(f'{key}: {b - a:.2f} s')
