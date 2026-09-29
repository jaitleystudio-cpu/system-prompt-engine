"""Identity normalization for DOI, PMID, PMCID, and arXiv."""

from spe_runtime.scholarly.identity import (
    make_identity,
    merge_identities,
    normalize_arxiv,
    normalize_doi,
    normalize_pmcid,
    normalize_pmid,
)


def test_doi_strips_resolver_and_lowercases():
    assert normalize_doi("https://doi.org/10.1000/EXAMPLE.2018") == "10.1000/example.2018"
    assert normalize_doi("doi:10.1000/Example.2018.") == "10.1000/example.2018"
    assert normalize_doi("not-a-doi") is None
    assert normalize_doi("10.1000/has space") is None


def test_pmid_and_pmcid_accept_urls_and_reject_junk():
    assert normalize_pmid("https://pubmed.ncbi.nlm.nih.gov/12345678/") == "12345678"
    assert normalize_pmid("PMID:00012") == "12"
    assert normalize_pmid("PMC123") is None
    assert normalize_pmcid("https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7654321/") == "PMC7654321"
    assert normalize_pmcid("7654321") == "PMC7654321"
    assert normalize_pmcid("pmid:12") is None


def test_arxiv_drops_version_from_canonical_id():
    assert normalize_arxiv("https://arxiv.org/abs/2401.00001v2") == ("2401.00001", "2")
    assert normalize_arxiv("arXiv:hep-th/9901001v3") == ("hep-th/9901001", "3")
    assert normalize_arxiv("not-an-id") == (None, None)


def test_canonical_key_prefers_doi_and_unknown_has_no_key():
    resolved = make_identity(
        doi="10.1000/example.2018",
        pmid="12345678",
        pmcid="PMC7654321",
        arxiv="2401.00001v2",
    )
    assert resolved.status.value == "RESOLVED"
    assert resolved.canonical_key == "doi:10.1000/example.2018"
    assert resolved.arxiv_version == "2"
    unknown = make_identity(doi="nope")
    assert unknown.status.value == "UNKNOWN"
    assert unknown.canonical_key == ""


def test_merge_keeps_highest_arxiv_version_and_doi_key():
    merged = merge_identities(
        (
            make_identity(pmid="12345678", arxiv="2401.00001v1"),
            make_identity(doi="10.1000/example.2018", arxiv="2401.00001v4"),
        )
    )
    assert merged.canonical_key == "doi:10.1000/example.2018"
    assert merged.pmid == "12345678"
    assert merged.arxiv_version == "4"
