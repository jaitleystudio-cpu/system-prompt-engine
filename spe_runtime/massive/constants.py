"""Frozen intake limits. Changing these changes custody bytes."""

IR_VERSION = "spe.massive-source-ir.v1"
SOURCE_MAP_VERSION = "spe.source-map.v1"
PROTOCOL = "spe.massive-ingest.v1"
WHITESPACE_VERSION = "spe.massive.whitespace.v1"
CHAIN_VERSION = "spe.massive.chain.v1"

# Longest prefix SPE will custody as one source. Crossing it refuses the body.
WORD_CAP = 1_000_000
TARGET_CHARS = 32_768
HARD_CHARS = 65_536
MAX_RESIDENT_CHARS = 65_536
EVIDENCE_LINE_MAX = 8_192

# Python str.split / str.isspace set. Kept explicit so JS matches byte-for-byte.
WHITESPACE_CODEPOINTS = frozenset(
    [
        0x09,
        0x0A,
        0x0B,
        0x0C,
        0x0D,
        0x1C,
        0x1D,
        0x1E,
        0x1F,
        0x20,
        0x85,
        0xA0,
        0x1680,
        *range(0x2000, 0x200B),
        0x2028,
        0x2029,
        0x202F,
        0x205F,
        0x3000,
    ]
)

STATUSES = frozenset(
    {
        "READY_FOR_F3E",
        "REFUSED",
        "INCOMPLETE",
        "RESUMABLE",
        "REFUSED_IN_PROGRESS",
        "CUSTODY_MISMATCH",
        "MEMORY_PRESSURE_HALTED",
    }
)

# Semantic pass is not a status this lane can emit.
assert "PASS" not in STATUSES
