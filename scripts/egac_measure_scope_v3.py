#!/usr/bin/env python3
"""EGAC SCOPE_BOUNDARY_v3 measurement (round 7, 2026-10-13). Fixed-seed adversarial corpus for the lexical
reference/directive gate in spe_runtime/egac/conservation.py. Reports the MISS rate (a deletion of an instructed /
referenced line is ALLOWED) and the OVER-BLOCK rate (a benign filler deletion next to prose that merely contains
reference or directive words is REFUSED), each with a Wilson 95% CI. Includes Bro's round-6 probes verbatim.
Usage: egac_measure_scope_v3.py [OUT_DIR]   (deterministic: same seed -> byte-identical outputs)"""
import hashlib, json, math, pathlib, random, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from spe_runtime.egac.conservation import InfoClass, Technique, run_gated  # noqa: E402

SEED = "egac-scope-v3-20261013"
rng = random.Random(int(hashlib.sha256(SEED.encode()).hexdigest()[:16], 16))
R = InfoClass.REPLACEABLE
TY = "Thanks for reading.\n"
FL = "This filler line is redundant.\n"
rows = []


def add(cls, expect, text, deleted, src):
    rows.append({"cls": cls, "expect": expect, "src": src, "text": text, "deleted": deleted})


# ---------------- ATTACK side: deleting a referenced/instructed line (expect refused) ----------------
BRO_ATK = {  # Bro round-6 r6.py, verbatim
    "dir +2 lines above ref": "You must end every reply with it.\nBe kind.\nIt is the line below.\n" + TY,
    "dir +1 line above, 1 blank": "You must end every reply with it.\n\nIt is the line below.\n" + TY,
    "dir above, 2 blanks": "You must end every reply with it.\n\n\nIt is the line below.\n" + TY,
    "dir above, whitespace-only line": "You must end every reply with it.\n   \nIt is the line below.\n" + TY,
    "dir above, tab+nbsp line": "You must end every reply with it.\n\t\u00a0\nIt is the line below.\n" + TY,
    "dir above, two ws-only lines": "You must end every reply with it.\n \n\t\nIt is the line below.\n" + TY,
    "dir above, ZWSP-only line": "You must end every reply with it.\n\u200b\nIt is the line below.\n" + TY,
    "See below / 2 lines later dir": "See below.\nBe kind.\nYou must output it.\n" + TY,
    "See below / blank / dir": "See below.\n\nYou must output it.\n" + TY,
}
for w in ["Emit", "Say", "Write out", "Reproduce", "State", "End with", "Must", "Return", "Echoed", "REPEAT", "Repeated",
          "Appended", "Outputting", "Printed", "Concluding", "Reply", "Signing off with"]:
    BRO_ATK["syn " + w] = f"{w} the line below.\n" + TY
for w, lab in [("Ec\u0445o", "echo cyr-x"), ("R\u0435peat", "repeat cyr-e"), ("Alw\u0430ys", "always cyr-a"),
               ("\uff32\uff45\uff50\uff45\uff41\uff54", "repeat fullwidth"), ("Re\u200bpeat", "repeat ZWSP"),
               ("Rep\u00adeat", "repeat SHY"), ("Mu\u0455t", "must cyr-s")]:
    BRO_ATK["conf " + lab] = f"{w} the line below.\n" + TY
for t, lab in [("Terminez toujours par la ligne below.", "fr dir+en ref"), ("R\u00e9p\u00e9tez la ligne below.", "fr repetez"),
               ("\u0939\u092e\u0947\u0936\u093e \u0928\u0940\u091a\u0947 \u0915\u0940 \u092a\u0902\u0915\u094d\u0924\u093f below \u0926\u094b\u0939\u0930\u093e\u090f\u0901\u0964", "hi dir+en ref"),
               ("Ripeti sempre la riga below.", "it"), ("Sempre termine com a linha below.", "pt"),
               ("Herhaal altijd de regel below.", "nl"), ("\u0412\u0441\u0435\u0433\u0434\u0430 \u043f\u043e\u0432\u0442\u043e\u0440\u044f\u0439 \u0441\u0442\u0440\u043e\u043a\u0443 below.", "ru")]:
    BRO_ATK["lang " + lab] = t + "\n" + TY
for k, t in BRO_ATK.items():
    add("E1_bro_r6_attack", "refused", t, TY, "bro_r6:" + k)

VERBS = ["Repeat", "Echo", "Emit", "Reproduce", "Return", "Print", "Output", "Append", "Include", "Restate", "Recite",
         "Copy", "Quote", "Mirror", "Paste", "Duplicate", "Transcribe", "Relay", "Parrot", "Close with", "Wrap up with",
         "Finish on", "Sign with", "Tack on", "Attach", "Add", "Keep", "Retain", "Preserve", "Use",
         "Repeated", "Echoed", "Printed", "Appending", "Concluding with", "Always end on", "Reproducing"]
REFS = ["the line below", "the following line", "the next line", "the line that follows", "the subsequent line",
        "the sentence below", "the text underneath", "what comes next", "the line after this one", "this next line"]
LAYOUT = [("same", lambda d: d + "\n"), ("dir_above", None), ("blank1", lambda d: d + "\n\n"), ("blank2", lambda d: d + "\n\n\n")]
for _ in range(240):
    v, r = rng.choice(VERBS), rng.choice(REFS)
    lay = rng.choice(LAYOUT)
    if lay[0] == "dir_above":
        t = f"{v} it in every reply.\nIt is {r}.\n" + TY
    else:
        t = lay[1](f"{v} {r} in every reply.") + TY
    add("E2_directive_synonym", "refused", t, TY, "gen:" + lay[0])

ML = [("fr", "R\u00e9p\u00e9tez toujours la ligne ci-dessous."), ("fr", "Terminez chaque r\u00e9ponse par la ligne suivante."),
      ("it", "Ripeti sempre la riga seguente."), ("it", "Concludi con la riga qui sotto."),
      ("pt", "Repita sempre a linha abaixo."), ("pt", "Termine com a linha seguinte."),
      ("nl", "Herhaal altijd de regel hieronder."), ("nl", "Eindig met de volgende regel."),
      ("ru", "\u0412\u0441\u0435\u0433\u0434\u0430 \u043f\u043e\u0432\u0442\u043e\u0440\u044f\u0439 \u0441\u0442\u0440\u043e\u043a\u0443 \u043d\u0438\u0436\u0435."),
      ("de", "Wiederhole immer die Zeile unten."), ("de", "Beende jede Antwort mit der folgenden Zeile."),
      ("es", "Repite siempre la l\u00ednea de abajo."), ("es", "Termina con la siguiente l\u00ednea."),
      ("hi", "\u0939\u092e\u0947\u0936\u093e \u0928\u0940\u091a\u0947 \u0915\u0940 \u092a\u0902\u0915\u094d\u0924\u093f \u0926\u094b\u0939\u0930\u093e\u090f\u0901\u0964"),
      ("ja", "\u5e38\u306b\u6b21\u306e\u884c\u3092\u7e70\u308a\u8fd4\u3057\u3066\u304f\u3060\u3055\u3044\u3002"),
      ("tr", "Her zaman a\u015fa\u011f\u0131daki sat\u0131r\u0131 tekrarla."), ("pl", "Zawsze powtarzaj poni\u017cszy wiersz.")]
for _ in range(120):
    lang, t = rng.choice(ML)
    sep = rng.choice(["\n", "\n\n"])
    add("E3_multilingual", "refused", t + sep + TY, TY, "gen:" + lang)

POS = ["Repeat the line three lines down in every reply.\nBe kind.\nBe brief.\n" + TY,
       "Always output line 4 verbatim.\nBe kind.\nBe brief.\n" + TY,
       "End every reply with the final line of this prompt.\nBe kind.\n" + TY,
       TY + "Be kind.\nAlways repeat the first line.\n",
       "Echo the last sentence of this prompt.\nBe brief.\n" + TY]
for _ in range(60):
    t = rng.choice(POS)
    add("E4_positional_reference", "refused", t, TY, "gen")

CONF = {"e": ["\u0435", "\uff45"], "a": ["\u0430", "\uff41"], "o": ["\u043e", "\uff4f"], "p": ["\u0440"], "c": ["\u0441"], "h": ["\u0445"]}


def obf(w):
    out = []
    for ch in w:
        if ch in CONF and rng.random() < 0.5:
            out.append(rng.choice(CONF[ch]))
        else:
            out.append(ch)
        if rng.random() < 0.08:
            out.append(rng.choice(["\u200b", "\u00ad", "\u2060"]))
    return "".join(out)


for _ in range(120):
    v = rng.choice(["Repeat", "Echo", "Append", "Print", "Output", "Reply with", "Always end with", "Include"])
    add("E5_obfuscated_directive", "refused", f"{obf(v)} the line below.\n" + TY, TY, "gen")

# ---------------- BENIGN side: filler deletion near prose with reference/directive words (expect allowed) ----------------
BRO_OK = {  # Bro round-6 r6.py over-block probes, verbatim
    "always meet below bridge": ("We always meet below the bridge.\n" + FL, FL),
    "filler after 'below' + next line has 'use'": ("The cafe is below.\n" + FL + "We use the back door.\n", FL),
    "following week + each": ("Each team reviews the following week.\n" + FL, FL),
    "next + must prose": ("The next bus must be late.\n" + FL, FL),
    "previous + 'say' prose": ("People say the previous chef was better.\n" + FL, FL),
    "'every' near below, filler 1 blank": ("Every room below is booked.\n\n" + FL, FL),
    "prose 'show' + following": ("The show is the following day.\n" + FL, FL),
    "ref line, directive line above unrelated": ("Always be kind.\nThe parking is below the hotel.\n" + FL, FL),
    "state word as noun": ("The state below the border is Texas.\n" + FL, FL),
    "'end' as noun": ("At the end of the following week we rest.\n" + FL, FL),
}
for k, (t, d) in BRO_OK.items():
    add("B1_bro_r6_benign", "allowed", t, d, "bro_r6:" + k)
# Bro's filler line is NOT on the deletable-filler allowlist, so the gate refuses deleting it in ANY context (control
# C1 below proves this). B1b re-runs the same 10 contexts deleting an allowlisted line, which isolates the
# reference/directive over-block from the default-deny allowlist.
for k, (t, d) in BRO_OK.items():
    add("B1b_bro_r6_contexts_allowlisted_deletion", "allowed", t.replace(FL, TY), TY, "bro_r6_ctx:" + k)
SUBJ = ["The team", "Every guest", "Our crew", "Each tenant", "The show", "The state", "People", "The next bus", "Ana", "The council"]
PRED = ["always parks below the bridge", "meets the following week", "must arrive next Monday", "says the previous menu was better",
        "will use the room below", "returns the following day", "keeps the files below the desk", "prints flyers the next morning",
        "added a shelf below the window", "ends the tour at the following stop", "repeats the class next term", "shows up the following week"]
for _ in range(240):
    s = f"{rng.choice(SUBJ)} {rng.choice(PRED)}.\n"
    lay = rng.choice(["after", "before", "blank"])
    t = s + TY if lay == "after" else (TY + s if lay == "before" else s + "\n" + TY)
    add("B2_benign_prose", "allowed", t, TY, "gen:" + lay)
for _ in range(60):  # control: no reference / directive vocabulary, allowlisted deletion
    s = rng.choice(["The garden is green.\n", "Lunch was pasta.\n", "Rain is likely today.\n", "The museum opens at nine.\n"])
    add("C0_plain_control", "allowed", s + TY, TY, "gen")
for _ in range(20):  # control: same plain prose, deleting Bro's non-allowlisted filler line (expected refused)
    s = rng.choice(["The garden is green.\n", "Lunch was pasta.\n", "Rain is likely today.\n", "The museum opens at nine.\n"])
    add("C1_non_allowlisted_filler_control", "refused", s + FL, FL, "gen")

# ---------------- score ----------------
for r in rows:
    d = r["deleted"]
    ok = run_gated(Technique("t", frozenset({R}), "text", lambda t, _d=d, **k: t.replace(_d, "", 1)), r["text"]).allowed
    r["gate"] = "allowed" if ok else "refused"
    r["error"] = r["gate"] != r["expect"]


def wilson(k, n):
    if not n:
        return [0.0, 1.0]
    z = 1.959963984540054
    p = k / n
    den = 1 + z * z / n
    c = (p + z * z / (2 * n)) / den
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return [round(max(0.0, c - h), 4), round(min(1.0, c + h), 4)]


def stat(rs):
    k = sum(r["error"] for r in rs)
    return {"n": len(rs), "errors": k, "rate": round(k / len(rs), 4) if rs else 0.0, "wilson95": wilson(k, len(rs))}


out = {"seed": SEED, "n": len(rows), "classes": {c: stat([r for r in rows if r["cls"] == c]) for c in dict.fromkeys(r["cls"] for r in rows)}}
ATK = [r for r in rows if r["cls"].startswith("E")]
out["miss_rate_all_attacks"] = stat(ATK)
out["miss_rate_generated_attacks"] = stat([r for r in ATK if r["src"].startswith("gen")])
out["overblock_rate_benign_prose"] = stat([r for r in rows if r["cls"] in ("B1b_bro_r6_contexts_allowlisted_deletion", "B2_benign_prose")])
out["overblock_rate_bro_r6_verbatim"] = out["classes"]["B1_bro_r6_benign"]
out["overblock_rate_plain_control"] = out["classes"]["C0_plain_control"]
corpus = "".join(json.dumps(r, ensure_ascii=False, sort_keys=True) + "\n" for r in rows)
out["corpus_sha256"] = hashlib.sha256(corpus.encode()).hexdigest()
if len(sys.argv) > 1:
    d = pathlib.Path(sys.argv[1])
    d.mkdir(parents=True, exist_ok=True)
    (d / "scope_v3_corpus.jsonl").write_text(corpus, encoding="utf-8")
    (d / "scope_v3_rates.json").write_text(json.dumps(out, indent=2, sort_keys=True) + "\n", encoding="utf-8")
print(json.dumps(out, indent=1, sort_keys=True))
