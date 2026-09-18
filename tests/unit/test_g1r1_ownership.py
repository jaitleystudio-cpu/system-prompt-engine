"""G1R-1 ownership repair — ErrorCode unification + X10 single writer + contract hash."""

from __future__ import annotations

import pytest

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.portability.reasons import PortabilityReason
from spe_runtime.spec_binding import (
    EXPECTED_SHA256,
    WORKING_CONTRACT_PATH,
    load_working_contract,
    verify_working_contract_hash,
    working_contract_sha256,
)
from spe_runtime.xcat import invariants
from spe_runtime.categories import _common
from spe_runtime.xcat.reasons import ReasonCode


def test_reason_code_is_error_code():
    assert ReasonCode is ErrorCode


def test_portability_reason_is_error_code():
    assert PortabilityReason is ErrorCode
    assert ReasonCode is PortabilityReason is ErrorCode


def test_failures_not_laundered_single_writer_identity():
    assert _common.failures_not_laundered is invariants.failures_not_laundered
    assert invariants.failures_not_laundered is not None


def test_working_contract_hash_matches_binding():
    assert WORKING_CONTRACT_PATH.is_file()
    digest = working_contract_sha256()
    assert digest == EXPECTED_SHA256
    assert verify_working_contract_hash() == EXPECTED_SHA256
    contract = load_working_contract()
    assert contract["custody"]["status"] == "WORKING_CONTRACT_BOUND"


def test_spe_typed_error_carries_code():
    err = SpeTypedError(ErrorCode.FAILURE_LAUNDERED)
    assert err.code is ErrorCode.FAILURE_LAUNDERED
    assert err.code.value == "X10_FAILURE_LAUNDERED"
    with pytest.raises(SpeTypedError) as ei:
        raise SpeTypedError(ErrorCode.GENERIC_AUTHORITY_MUTATION, "nope")
    assert ei.value.code.value == "K4_GENERIC_AUTHORITY_MUTATION"
