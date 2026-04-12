import json
with open('../public/audio/_transcript.json', encoding='utf-8') as f:
    words = json.load(f)
for i, w in enumerate(words):
    if 85 <= w['start'] <= 100:
        print(f"[{i}] {w['start']:.2f}-{w['end']:.2f}  {w['norm']}")
