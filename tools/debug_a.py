"""Debug why A-info is being skipped."""
import re, json, sys
from difflib import SequenceMatcher

def normalize(text):
    t = text.lower()
    for a, b in [('\u00e4','ae'),('\u00f6','oe'),('\u00fc','ue'),('\u00df','ss')]:
        t = t.replace(a, b)
    t = re.sub(r'[^a-z0-9\s]', '', t)
    return re.sub(r'\s+', ' ', t).strip()

with open('../public/audio/_transcript.json', encoding='utf-8') as f:
    words = json.load(f)

LOOKAHEAD = 80
MAX_JUMP_S = 25.0

def match_line(tokens, words, start_pos):
    n = len(tokens)
    target = ' '.join(tokens)
    best_score, best_i, best_j = 0.0, start_pos, start_pos + n
    limit = min(len(words), start_pos + LOOKAHEAD + n)
    for i in range(start_pos, limit):
        for delta in range(-2, 4):
            j = i + n + delta
            if j > len(words) or j <= i: continue
            cand = ' '.join(w['norm'] for w in words[i:j])
            s = SequenceMatcher(None, target, cand).ratio()
            if s > best_score:
                best_score, best_i, best_j = s, i, j
    return best_i, best_j, best_score

# Print transcript around 90-100s to see welches-wort-z and A-info
print("=== Transcript 90-100s ===")
for i, w in enumerate(words):
    if 90 <= w['start'] <= 101:
        print(f"[{i}] {w['start']:.2f}  norm={w['norm']!r}")

# Simulate welches-z match to get last_t_end
print()
wort_z_target = normalize("Welches Wort beginnt mit Z?").split()
print("wort_z_target:", wort_z_target)

# Find where welches-wort-z was in last matching run (based on transcript order)
# Search from around word 203
best_i, best_j, score = match_line(wort_z_target, words, 200)
print(f"welches-wort-z match: i={best_i} t={words[best_i]['start']:.2f} j={best_j} score={score:.3f}")
t_end_wz = words[min(best_j-1, len(words)-1)]['end']
print(f"t_end = {t_end_wz:.2f}s  (=last_t_end for A-info search)")

# Simulate A-info search
pos = best_i + 1
while pos < len(words) and words[pos]['start'] < t_end_wz:
    pos += 1
search_pos = pos
search_time = words[pos]['start'] if pos < len(words) else 0.0
print(f"\nA-info search: pos={pos}, search_time={search_time:.2f}s")

# Match A-info
a_target = normalize("A ist der 1. Buchstabe des Alphabets – und ein Vokal.").split()
print("a_target:", a_target)
best_i_a, best_j_a, score_a = match_line(a_target, words, search_pos)
match_time_a = words[best_i_a]['start'] if best_i_a < len(words) else float('inf')
jump_a = match_time_a - search_time
print(f"A match: best_i={best_i_a}, t={match_time_a:.2f}s, jump={jump_a:.2f}s, score={score_a:.3f}")
print(f"A first word: {words[best_i_a]['norm']!r}")
print(f"is_match (before single-letter): {score_a >= 0.52 and jump_a <= MAX_JUMP_S}")
min_match_a = 0.52  # 9 tokens
is_match_a = score_a >= min_match_a and jump_a <= MAX_JUMP_S
if is_match_a and len(a_target[0]) == 1 and a_target[0].isalpha():
    if words[best_i_a]['norm'] != a_target[0]:
        is_match_a = False
        print("Single-letter check FAILED!")
print(f"Final is_match: {is_match_a}")
print(f"Cand at best_i_a: {' '.join(w['norm'] for w in words[best_i_a:best_j_a])!r}")
