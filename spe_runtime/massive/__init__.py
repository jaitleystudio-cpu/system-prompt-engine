"""Large Paste / million-word intake. Stops at MassiveSourceIR.

This package custodies source text. It does not classify XCAT categories,
select K3 techniques, score quality, or judge prompt effects. Semantic
integration waits for the F3E freeze. READY_FOR_F3E is not a semantic PASS.
"""

from spe_runtime.massive.errors import MassiveError
from spe_runtime.massive.session import MassiveSession, open_session, resume_session

__all__ = [
    "MassiveError",
    "MassiveSession",
    "open_session",
    "resume_session",
]
