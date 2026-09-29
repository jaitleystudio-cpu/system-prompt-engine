# C-R1 privacy query minimization

Recorded with the offline mutant `C-R1-02` in `tests/unit/test_scholarly_mutations.py`. The live qualification sent only the non-sensitive topics named in `C_R1_LIVE_SOURCE_QUALIFICATION.md`. It did not send a private prompt.

## Contract

`minimize_scholarly_query` runs before any scholarly URL is built.

Allowed outbound text: the `TOPIC` section, after whitespace collapse and redaction of SSN, email, and MRN patterns.

Withheld, and not stored on the package: `PRIVATE`, `PROFILE`, `DOCUMENT`, `CONTEXT`, `CONSTRAINT`, `UPLOAD`, unlabeled text that sits beside those labels, and the `private_context` argument. The package keeps the labels only.

Unlabeled scientific text with no private labels stays the topic, so existing fixtures keep matching `claim_text`.

## Proof that the private prompt is not the outbound query

Input:

```
TOPIC: metformin cardiovascular outcomes
PRIVATE: patient Jane Q. Private MRN 884211 SSN 123-45-6789 lives at 9 Secret Lane
UPLOAD: full clinic note about the same patient
```

Plus `private_context` set to the same private sentence.

Observed:

- `outbound_query` = `metformin cardiovascular outcomes`
- `outbound_query` is not the raw prompt
- `private_withheld` = true
- OpenAlex and ID-converter URLs contain `metformin` and do not contain `Jane`, `123-45-6789`, `Secret Lane`, or `clinic note`

## Outbound field shape

| Source | Fields that leave SPE |
| --- | --- |
| PubMed, PMC | `term` (quoted phrase) |
| Europe PMC | `query` (quoted phrase) |
| Crossref | `query.bibliographic` |
| DOAJ | path segment |
| arXiv | `search_query` |
| OpenAlex | `search` |
| NCBI ID Converter | `ids`, `idtype` |

The ID converter receives normalized identifiers only. Mutant `C-R1-09` checks that the topic token `zephyrprivate topic token` is absent from every ID-converter URL, and that a DOI batch does not also carry a PMID.
