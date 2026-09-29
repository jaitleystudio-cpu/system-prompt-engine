# Protected intent

Quality comparison refuses `IMPROVED` when the canonical protected intent differs (`PROTECTED_INTENT_MISMATCH`).

Accepted reconstruction copies the protected intent through unchanged. Tests cover goal preservation, hard-constraint restoration from the existing constraint text, and refusal of `CHANGE_USER_GOAL`.

Repair does not rewrite user facts, budget, desired output, provenance, category, or preferences. Restoring a missing constraint uses the statement already on the protected intent.
