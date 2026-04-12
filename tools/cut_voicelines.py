#!/usr/bin/env python3
"""
cut_voicelines.py – LumiLearn Voiceline Cutter
Whisper-Transkription + sequenzielles Fuzzy-Matching.
pos rueckt nach JEDEM Match vor (auch bei Skips), damit
kein Voiceline-Shift entsteht.
"""

import re, os, sys, json, subprocess
from difflib import SequenceMatcher

if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

# ── Konfiguration ─────────────────────────────────────────────────────────────

AUDIO_IN   = r"C:\Users\Caspar\Downloads\ElevenLabs_2026-04-01T22_28_36_Kinderlernapp Erzählerin_gen_sp100_s30_sb90_se0_b_m2.mp3"
VOICELINES = r"C:\Users\Caspar\lumilearn-web\tools\actual_voicelines.txt"
OUT_DIR    = r"C:\Users\Caspar\lumilearn-web\public\audio"

WHISPER_MODEL = "medium"
PAD_START     = 0.04
PAD_END       = 0.06
LOOKAHEAD     = 80   # Wort-Suchfenster pro Voiceline
MAX_JUMP_S    = 25.0 # Max. erlaubter Zeitsprung pro Match (verhindert Falsch-Matches)

# ── Hilfsfunktionen ───────────────────────────────────────────────────────────

def normalize(text):
    t = text.lower()
    t = t.replace('ä','ae').replace('ö','oe').replace('ü','ue').replace('ß','ss')
    t = re.sub(r"[^a-z0-9\s]", "", t)
    return re.sub(r"\s+", " ", t).strip()

def slugify(text):
    t = text.lower()
    for a, b in [('ä','ae'),('ö','oe'),('ü','ue'),('ß','ss'),(' ','-'),
                 ('!',''),('?',''),(',',''),('.',''),(':',''),
                 ('–','-'),('—','-'),('"',''),("'","")]:
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

# ── Transkription ─────────────────────────────────────────────────────────────

def transcribe(audio_path):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("FEHLER: faster-whisper nicht installiert."); sys.exit(1)
    print(f"Lade Whisper-Modell '{WHISPER_MODEL}' ...")
    model = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
    print("Transkribiere ... (einige Minuten)")
    segs, _ = model.transcribe(audio_path, language="de", word_timestamps=True,
                               vad_filter=True,
                               vad_parameters={"min_silence_duration_ms":200})
    words = []
    for seg in segs:
        if not seg.words:
            continue
        for w in seg.words:
            t = w.word.strip()
            if t:
                words.append({"word": t, "norm": normalize(t),
                              "start": round(w.start,3), "end": round(w.end,3)})
    print(f"Transkription fertig: {len(words)} Woerter erkannt.")
    return words

# ── Matching ──────────────────────────────────────────────────────────────────

def match_line(tokens, words, start_pos, time_limit_pos=None, start_letter=None):
    """Sucht ab start_pos den besten Span fuer tokens innerhalb des Zeitfensters.
    start_letter: wenn gesetzt, werden nur Positionen betrachtet, wo das erste Wort == start_letter.
    """
    n = len(tokens)
    if n == 0:
        return start_pos, start_pos, 0.0
    target = " ".join(tokens)
    best_score, best_i, best_j = 0.0, start_pos, start_pos + n
    limit = min(len(words), start_pos + LOOKAHEAD + n)
    if time_limit_pos is not None:
        limit = min(limit, time_limit_pos)  # strikt auf Zeitfenster begrenzen
    for i in range(start_pos, limit):
        if start_letter is not None and words[i]["norm"] != start_letter:
            continue  # nur Positionen mit dem erwarteten Anfangsbuchstaben
        # Fuer "X ist..." Voicelines: auch pruefen, dass folgendes Wort "ist" ist
        if (start_letter is not None and len(tokens) >= 2 and tokens[1] == "ist"
                and (i + 1 >= len(words) or words[i + 1]["norm"] != "ist")):
            continue  # "nach C kommt..." ablehnen, nur "C ist..." nehmen
        for delta in range(-2, 4):
            j = i + n + delta
            if j > len(words) or j <= i:
                continue
            cand = " ".join(w["norm"] for w in words[i:j])
            s = SequenceMatcher(None, target, cand).ratio()
            if s > best_score:
                best_score, best_i, best_j = s, i, j
    return best_i, best_j, best_score

# ── Schneiden ─────────────────────────────────────────────────────────────────

def cut(src, t_start, t_end, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    t0  = max(0.0, t_start - PAD_START)
    dur = (t_end + PAD_END) - t0
    if dur <= 0:
        return False
    cmd = ["ffmpeg", "-y", "-ss", f"{t0:.3f}", "-t", f"{dur:.3f}",
           "-i", src, "-acodec", "libmp3lame", "-q:a", "2", dst]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"    ffmpeg-Fehler: {r.stderr[-200:]}"); return False
    return True

# ── Hauptprogramm ─────────────────────────────────────────────────────────────

def main():
    print("=== LumiLearn Voiceline Cutter ===\n")

    entries = parse_voicelines(VOICELINES)
    print(f"Voicelines: {len(entries)}\n")

    os.makedirs(OUT_DIR, exist_ok=True)
    transcript_path = os.path.join(OUT_DIR, "_transcript.json")
    if os.path.exists(transcript_path):
        print(f"Transkript geladen: {transcript_path}")
        with open(transcript_path, encoding="utf-8") as f:
            words = json.load(f)
        print(f"  {len(words)} Woerter\n")
    else:
        words = transcribe(AUDIO_IN)
        with open(transcript_path, "w", encoding="utf-8") as f:
            json.dump(words, f, ensure_ascii=False, indent=2)
        print(f"Transkript gespeichert: {transcript_path}\n")

    pos = 0
    cut_count = 0
    skipped = []
    name_counter = {}
    last_t_end = 0.0       # Clips duerfen nicht rueckwaerts in der Zeit gehen
    last_compound_pos = -1 # Position des letzten Compound-Matches (Mond/Musik, Zahn/Zug)

    for game_sl, line in entries:
        tokens = normalize(line).split()
        if not tokens:
            continue

        # Suchstart hinter dem Ende des letzten Clips setzen
        while pos < len(words) and words[pos]["start"] < last_t_end:
            pos += 1
        search_pos = pos  # Startposition nach dem Zeitsprung-Guard

        n_tok = len(tokens)
        if n_tok == 1:
            min_match = 0.50
        elif n_tok <= 3:
            min_match = 0.75
        elif n_tok <= 6:
            min_match = 0.65
        else:
            min_match = 0.52

        # Nur Positionen im Zeitfenster durchsuchen (verhindert Falsch-Matches durch gleiches Template)
        search_time = words[search_pos]["start"] if search_pos < len(words) else 0.0
        time_limit_pos = search_pos
        while time_limit_pos < len(words) and words[time_limit_pos]["start"] <= search_time + MAX_JUMP_S:
            time_limit_pos += 1

        # Fuer Einzelbuchstaben-Voicelines (A ist..., B ist...) nur Positionen suchen,
        # die mit dem erwarteten Buchstaben beginnen
        start_letter = tokens[0] if (len(tokens[0]) == 1 and tokens[0].isalpha()) else None

        best_i, best_j, score = match_line(tokens, words, pos, time_limit_pos, start_letter)

        is_match = score >= min_match

        # Zusaetzlicher Einzelbuchstaben-Check (Sicherheitsnetz)
        if is_match and start_letter is not None:
            if best_i < len(words) and words[best_i]["norm"] != start_letter:
                is_match = False

        if not is_match:
            print(f"  SKIP  [{score:.2f}]  {game_sl}  |  {line!r}")
            skipped.append((game_sl, line, score))
            # pos NICHT vorrucken: naechste Suche startet vom selben Punkt.
            # last_t_end schützt davor, zu weit zurueckzugehen.
            pos = search_pos
            continue

        t_start = words[best_i]["start"]
        t_end   = words[min(best_j - 1, len(words) - 1)]["end"]

        # Compound-Match: z.B. "mond" trifft "mondmusik" oder "zahn" trifft "zahnzug".
        # In diesem Fall pos und last_t_end nicht voll vorrücken, damit das Folge-
        # Voiceline ("Musik"/"Zug") denselben Eintrag im Transkript nochmal nutzen kann.
        is_compound_head = (
            n_tok == 1 and
            score < 0.90 and
            best_j == best_i + 1 and  # single transcript word matched
            best_i < len(words) and
            len(tokens[0]) >= 3 and   # nicht einzelne Buchstaben
            words[best_i]["norm"].startswith(tokens[0]) and
            best_i != last_compound_pos  # noch nicht als Compound-Tail behandelt
        )

        if is_compound_head:
            pos = best_i          # bleibt am Compound-Wort
            next_last_t_end = words[best_i]["start"]  # erlaubt Re-Match an selber Position
            last_compound_pos = best_i
        else:
            pos = best_i + 1      # normaler Vorrueck
            next_last_t_end = t_end
            last_compound_pos = -1

        base = slugify(line)
        key  = (game_sl, base)
        if key in name_counter:
            name_counter[key] += 1
            filename = f"{base}-{name_counter[key]}.mp3"
        else:
            name_counter[key] = 0
            filename = f"{base}.mp3"

        dst = os.path.join(OUT_DIR, game_sl, filename)
        ok  = cut(AUDIO_IN, t_start, t_end, dst)
        marker = "OK" if ok else "XX"
        print(f"  {marker}  [{score:.2f}]  {game_sl}/{filename}  ({t_start:.2f}s-{t_end:.2f}s)")
        if ok:
            cut_count += 1
            last_t_end = next_last_t_end

    print(f"\n{'='*50}")
    print(f"Fertig!  {cut_count}/{len(entries)} Clips geschnitten,  {len(skipped)} uebersprungen.")
    print(f"Ausgabe: {OUT_DIR}")

    if skipped:
        skip_log = os.path.join(OUT_DIR, "_skipped.txt")
        with open(skip_log, "w", encoding="utf-8") as f:
            for gs, l, s in skipped:
                f.write(f"[{s:.2f}]  [{gs}]  {l}\n")
        print(f"Skipped: {skip_log}")


if __name__ == "__main__":
    main()