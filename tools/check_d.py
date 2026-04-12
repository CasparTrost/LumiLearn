import json
with open('../public/audio/_transcript.json', encoding='utf-8') as f:
    words = json.load(f)
print('Total words:', len(words))
for i, w in enumerate(words):
    if 100 <= w['start'] <= 115:
        print(f"[{i}] {w['start']:.2f}  {w['norm']}")
