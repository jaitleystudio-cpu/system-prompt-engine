"""WebRecon R1 qualification tests.

These wrap the donor-foundation oracles. A failure is preserved evidence.
Do not weaken an assertion to make a donor defect pass.
"""

from __future__ import annotations

import pytest

from qualification.webrecon_r1.oracles import CHECKS


@pytest.mark.parametrize("name", list(CHECKS))
def test_webrecon_r1_obligation(name: str) -> None:
    failures = CHECKS[name]()
    assert not failures, "\n".join(failures)
