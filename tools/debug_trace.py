"""Debug: trace pos and scores for alphabet info section."""
import json, re, os, sys
from difflib import SequenceMatcher

os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

VOICELINES = r"C:\Users\Caspar\lumilearn-web\tools\actual_voicelines.txt"
LOOKAHEAD = 80

def normalize(text):
    t = text.lower()
    t = t.replace('\u00e4','ae').replace('\u00f6','oe').replace('\u00fc','ue').replace('\u00df','ss')
    t = re.sub(r"[^a-z0-9\s]", "", t)
    return re.sub(r"\s+", " ", t).strip()

def slugify(text):
    t = text.lower()
    for a, b in [('\u00e4','ae'),('\u00f6','oe'),('\u00fc','ue'),('\u00df','ss'),(' ','-'),
                 ('!',''),('?',''),(',',''),('.',''),(':',''),
                 ('\u2013','-'),('\u2014','-'),('"',''),("'","")]:
        t = t.replace(a, b)
    t = re.sub(r"[^a-z0-9\-]", "", t)
    t = re.sub(r"-+", "-", t).strip("-")
    return t[:70]

def game_slug(name):
    return slugify(name.strip("=").strip())

def parse_voicelines(path):
    entries = []
    cur_slug = "allgemein"
    with open(path, encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line:
                continue
            m = re.match(r"^===\s*(.+?)\s*===$", line)
            if m:
                cur_slug = game_slug(m.group(1))
                continue
            entries.append((cur_slug, line))
    return entries

def match_line(tokens, words, start_pos):
    n = len(tokens)
    if n == 0:
        return start_pos, start_pos, 0.0
    target = " ".join(tokens)
    best_score, best_i, best_j = 0.0, start_pos, start_pos + n
    limit = min(len(words), start_pos + LOOKAHEAD + n)
    for i in range(start_pos, limit):
        for delta in range(-2, 4):
            j = i + n + delta
            if j > len(words) or j <= i:
                continue
            cand = " ".join(w["norm"] for w in words[i:j])
            s = SequenceMatcher(None, target, cand).ratio()
            if s > best_score:
                best_score, best_i, best_j = s, i, j
    return best_i, best_j, best_score

with open(r"C:\Users\Caspar\lumilearn-web\public\audio\_transcript.json", encoding="utf-8") as f:
    words = json.load(f)

entries = parse_voicelines(VOICELINES)

pos = 0
last_t_end = 0.0

for idx, (game_sl, line) in enumerate(entries):
    tokens = normalize(line).split()
    if not tokens:
        continue

    start_pos = pos
    while pos < len(words) and words[pos]["start"] < last_t_end:
        pos += 1
    advanced = pos - start_pos

    n_tok = len(tokens)
    if n_tok == 1:
        min_match = 0.65
    elif n_tok <= 3:
        min_match = 0.75
    elif n_tok <= 6:
        min_match = 0.65
    else:
        min_match = 0.52

    best_i, best_j, score = match_line(tokens, words, pos)

    # Print from just before alpha-info starts
    if idx >= 39:  # welches-wort-Z through all abc-abenteuer
        status = "OK" if score >= min_match else "SKIP"
        t_start = words[best_i]["start"] if best_i < len(words) else -1
        print(f"  [{idx:3d}] pos={pos:3d} adv={advanced:2d} last_t_end={last_t_end:.2f} | {status} [{score:.2f}] {line[:40]!r} -> best_i={best_i} t={t_start:.2f}s")

    if score >= min_match:
        pos = best_i + 1
        t_start = words[best_i]["start"]
        t_end = words[min(best_j - 1, len(words) - 1)]["end"]
        last_t_end = t_end
    else:
        pos = best_i + 1  # current behavior

    if game_sl == "gefuehlswelt":
        break  # stop at first gefuehlswelt entry
