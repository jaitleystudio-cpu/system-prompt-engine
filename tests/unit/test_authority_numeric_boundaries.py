from dataclasses import replace
import pytest
from spe_runtime.authority.models import AuthorityGrant
from spe_runtime.authority.validate import validate_grant_compatibility, _check_args_against_constraints

@pytest.mark.parametrize('amount', [80.01, '80.01', float('nan'), float('inf'), True, {'value': '80.01'}])
def test_amount_cannot_truncate_or_accept_nonfinite(amount):
    assert not _check_args_against_constraints({'meta': {'amount': amount}}, {'amount_max': 80})

@pytest.mark.parametrize('amount', [79.99, '80', {'value': '80.00'}])
def test_exact_decimal_boundaries(amount):
    assert _check_args_against_constraints({'amount': amount}, {'amount_max': '80.00'})

def test_actual_content_length_overrides_small_declared_length():
    assert not _check_args_against_constraints({'content_b64': 'A'*20, 'content_b64_len_max': 1}, {'content_b64_len_max': 10})
    assert _check_args_against_constraints({'content_b64': 'A'*10}, {'content_b64_len_max': 10})

@pytest.mark.parametrize('expires', ['2030-01-01T00:00:00', None, 'bad'])
def test_invalid_or_naive_expiry_rejected(expires):
    grant = AuthorityGrant('g', 'p', 'c', 't', {}, 'purpose', '2025-01-01T00:00:00Z', '2030-01-01T00:00:00Z', 1)
    ok, reasons = validate_grant_compatibility(replace(grant, expires_at=expires), capability='c', target='t', arguments={}, now='2026-01-01T00:00:00Z')
    assert not ok and 'C07_AUTHORITY_EXPIRED' in reasons
