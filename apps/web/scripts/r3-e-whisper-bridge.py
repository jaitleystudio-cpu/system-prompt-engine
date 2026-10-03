"""Call the pinned LocalMediaSession. Not a second engine."""
import json
import sys
from pathlib import Path

MEDIA_ROOT = Path("/Volumes/4TB-WD/spe-worktrees/spe-lane-r3-b-media")
sys.path.insert(0, str(MEDIA_ROOT))

from spe_runtime.media_product.local_backend import (  # noqa: E402
    LocalMediaSession,
    discover_qualified_assets,
)

def main() -> None:
    wav = Path(sys.argv[1])
    session = LocalMediaSession.open(discover_qualified_assets())
    try:
        result = session.transcribe_path(wav)
    finally:
        session.close()
    json.dump(
        {
            "status": result.status,
            "text": result.text,
            "mode": result.mode,
            "errorCode": None,
            "neuralSessionRan": bool(result.neural_session_ran),
            "timestampsProven": False,
            "segments": [],
            "progressPercent": result.progress_percent,
            "egressAttempts": int(result.egress_attempts),
        },
        sys.stdout,
        ensure_ascii=False,
    )

if __name__ == "__main__":
    main()
