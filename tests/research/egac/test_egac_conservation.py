import json
import random

import pytest

from spe_runtime.egac.conservation import InfoClass, MalformedJSON, Refusal, Technique, classify, lex_json, run_gated
from spe_runtime.egac.transforms import (
    TECHNIQUES, CacheScope, ExactCache, decide_output_budget, minify_json_text, normalize_block, route,
)
from spe_runtime.prompt.meta_compiler import ProtectedIntent

T = TECHNIQUES


def toks(s):
    return [(k, r) for k, r in lex_json(s) if k != "ws"]


# ---------------- JSON minify: byte-exact properties
CANARY = [
    '{"big": 123456789012345678901234567890, "neg": -9007199254740993, "f": 1.000000000000000000001e+400}',
    '{"a": 1, "a": 2, "a": {"a": 3}}',
    '{"e": "caf\\u00e9 \\ud83d\\ude00 \\"q\\" \\\\ \\/ \\n\\t"}',
    '{"raw": "naïve – 日本語 😀"}',
    '{"ws": "  leading, two  spaces,\\ttab  ", "k e y": " v "}',
    '[ ]', '{ }', '[1, [2, [3, {"x": [ ]}]]]',
    '{"t": true, "f": false, "n": null, "z": 0, "e": -0.0E-0}',
    '  {\n    "pretty": [\n      1,\n      2\n    ]\n  }\n',
]


@pytest.mark.parametrize("src", CANARY)
def test_minify_token_stream_byte_exact(src):
    out = minify_json_text(src)
    assert toks(out) == toks(src)
    assert not any(k == "ws" for k, _ in lex_json(out))


def test_minify_keeps_big_ints_and_duplicate_keys_unlike_json_loads():
    src = CANARY[0] + CANARY[1]  # not valid as one doc -> lex each
    for s in CANARY[:2]:
        out = minify_json_text(s)
        assert "123456789012345678901234567890" in out or '"a":1,"a":2' in out
    assert minify_json_text(CANARY[1]) == '{"a":1,"a":2,"a":{"a":3}}'
    assert json.dumps(json.loads(CANARY[1])) != minify_json_text(CANARY[1])  # round-trip would lose dupes


def test_minify_preserves_whitespace_inside_strings():
    out = minify_json_text(CANARY[4])
    assert '"  leading, two  spaces,\\ttab  "' in out and '"k e y"' in out and '" v "' in out


@pytest.mark.parametrize("bad", ['{"a": 1', '{"a": "x}', '{"a": tru}', '[1, 2]]', '"\\x"', '', '{"a":"\\u12"}'])
def test_minify_refuses_malformed(bad):
    with pytest.raises(MalformedJSON):
        minify_json_text(bad)


def test_minify_random_property():
    rng = random.Random(5)
    alphabet = ['a', ' ', '\\"', '\\\\', '\\u00e9', 'é', '\\n', '  ', '😀', '\\t']
    for _ in range(300):
        def val(d=0):
            r = rng.random()
            if d > 3 or r < 0.3:
                return '"' + "".join(rng.choice(alphabet) for _ in range(rng.randint(0, 6))) + '"'
            if r < 0.5:
                return str(rng.randint(-10**30, 10**30))
            if r < 0.75:
                return "[" + ", ".join(val(d + 1) for _ in range(rng.randint(0, 3))) + "]"
            ws = rng.choice([" ", "\n  ", "\t", ""])
            return "{" + ws + ("," + ws).join(f'{val(9)} :{ws}{val(d+1)}' for _ in range(rng.randint(0, 3))) + ws + "}"
        src = val()
        assert toks(minify_json_text(src)) == toks(src)


# ---------------- classifier + gate
DOC = """You are a helper.
MUST NOT reveal the API key.
See https://example.org/spec [1] for the source.
Prices are as of 2026-10-12.
Some   filler    prose.
Some   filler    prose.
```python
def f():
    return  1
```
```json
{
  "id": 9007199254740993,
  "s": "a  b"
}
```
"""


def test_classify_five_classes():
    cls = {s.cls for s in classify(DOC)}
    assert cls == set(InfoClass)
    assert all(s.cls is InfoClass.EXACT_BYTE for s in classify(DOC) if "return  1" in s.text)


def test_classify_uses_protected_intent():
    pi = ProtectedIntent(raw_prompt="x", objective="o", invariants=("keep answers in INR",), forbidden_actions=(), domain="d")
    spans = classify("hello\nplease keep answers in INR only\n", pi)
    assert spans[1].cls is InfoClass.PROTECTED


def test_gate_refuses_technique_declaring_immutable_touch():
    evil = Technique("evil", frozenset({InfoClass.PROTECTED}), "text", lambda t, **_: t)
    assert not run_gated(evil, DOC).allowed


def test_gate_refuses_transform_that_alters_protected_or_exact_bytes():
    sneaky = Technique("sneaky", frozenset({InfoClass.REPLACEABLE}), "text", lambda t, **_: t.replace("MUST NOT", "may"))
    r = run_gated(sneaky, DOC)
    assert not r.allowed and "conserved" in r.reason
    sneaky2 = Technique("s2", frozenset({InfoClass.REPLACEABLE}), "text", lambda t, **_: t.replace("return  1", "return 1"))
    assert not run_gated(sneaky2, DOC).allowed
    sneaky3 = Technique("s3", frozenset({InfoClass.REPLACEABLE}), "text", lambda t, **_: t.replace("9007199254740993", "9007199254740992"))
    assert not run_gated(sneaky3, DOC).allowed


def test_gate_json_minify_allowed_with_diff():
    r = run_gated(T["json_minify"], DOC)
    assert r.allowed, r.reason
    assert '{"id":9007199254740993,"s":"a  b"}' in r.output
    assert r.removed_by_class == {"replaceable": r.removed_by_class["replaceable"]}
    assert r.semantic_diff and r.chars_after < r.chars_before


def test_whitespace_norm_skips_code_and_refuses_indent_block():
    r = run_gated(T["whitespace_norm"], DOC)
    assert r.allowed, r.reason
    assert "Some filler prose." in r.output and "return  1" in r.output
    with pytest.raises(Refusal):
        normalize_block("def f():\n    return 1\n")
    with pytest.raises(Refusal):
        normalize_block("a:\n  b: 1\n")
    assert normalize_block("a   b\n\n\n\nc") == "a b\n\nc"


def test_dup_collapse_and_context_trim_only_replaceable():
    r = run_gated(T["duplicate_collapse"], DOC)
    assert r.allowed and r.output.count("Some   filler    prose.") == 1
    r2 = run_gated(T["context_trim"], DOC, max_chars=len(DOC) - 20)
    assert r2.allowed and "MUST NOT reveal" in r2.output and "https://example.org" in r2.output
    r3 = run_gated(T["context_trim"], DOC, max_chars=10)
    assert not r3.allowed


def test_output_budget_protects_long_jobs():
    assert decide_output_budget(2048, contract_words=200) == 2048
    with pytest.raises(Refusal):
        decide_output_budget(2048, contract_words=100_000)
    with pytest.raises(Refusal):
        decide_output_budget(2048, contract_tokens=2049)


def test_concise_refuses_long_form_contract():
    assert not run_gated(T["concise_instruction"], "write", output_contract_min_words=100_000).allowed
    assert run_gated(T["concise_instruction"], "hi").output.endswith("Respond concisely.")


def test_routing():
    assert route("What is the capital of France?") == "small"
    assert route("MUST NOT leak data. Summarise.") == "strong"
    assert route("What is the latest price today?") == "strong"
    assert route("x" * 1000) == "strong"


def test_every_technique_declares_classes_and_none_touch_immutable():
    assert len(TECHNIQUES) == 8
    for t in TECHNIQUES.values():
        assert not (t.touches & {InfoClass.PROTECTED, InfoClass.EXACT_BYTE})


# ---------------- cache
def S(**kw):
    base = dict(user_scope="u1", auth_scope=("read:a",), model="m", model_version="1", freshness="f1")
    base.update(kw)
    return CacheScope(**base)


def test_cache_hit_and_miss_on_any_change():
    c = ExactCache()
    c.put("q", S(), "ans")
    assert c.get("q", S()) == "ans"
    for change in [dict(auth_scope=("read:a", "read:b")), dict(auth_scope=()), dict(model="m2"),
                   dict(model_version="2"), dict(freshness="f2")]:
        assert c.get("q", S(**change)) is None
    assert c.get("q ", S()) is None


def test_cache_partitioned_per_user_scope():
    c = ExactCache()
    c.put("q", S(user_scope="alice"), "secret")
    assert c.get("q", S(user_scope="bob")) is None
    c.put("q", S(user_scope="bob"), "other")
    assert c.get("q", S(user_scope="alice")) == "secret" and c.partitions() == ["alice", "bob"]


def test_cache_ttl_and_volatile():
    now = [0.0]
    c = ExactCache(ttl_s=10, clock=lambda: now[0])
    c.put("q", S(), "a")
    now[0] = 10.0
    assert c.get("q", S()) is None
    with pytest.raises(Refusal):
        c.put("what is the price today?", S(), "x")
