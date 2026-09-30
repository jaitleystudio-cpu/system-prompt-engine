"""Source mutants MR1-01 through MR1-20.

Patches are applied only to an in-memory copy of the donor. They never write
spe_runtime/media. Scoring is withheld while the qualification baseline is red.
"""

from __future__ import annotations

from typing import TypedDict


class Edit(TypedDict):
    path: str
    old: str
    new: str


class Mutant(TypedDict):
    id: str
    fault: str
    edits: list[Edit]


MUTANTS: list[Mutant] = [
    {
        "id": "MR1-01",
        "fault": "raw audio retained",
        "edits": [
            {
                "path": "spe_runtime/media/privacy.py",
                "old": (
                    "        if retention is not RawRetention.OFF:\n"
                    "            raise ValueError(\"raw audio retention is OFF\")\n"
                    "        object.__setattr__(self, \"retention\", retention)\n"
                ),
                "new": "        object.__setattr__(self, \"retention\", retention)\n",
            }
        ],
    },
    {
        "id": "MR1-02",
        "fault": "raw video default",
        "edits": [
            {
                "path": "spe_runtime/media/privacy.py",
                "old": (
                    "    retention: RawRetention = RawRetention.OFF\n"
                    "    explicitly_needed: bool = False\n"
                ),
                "new": (
                    "    retention: RawRetention = RawRetention.ON\n"
                    "    explicitly_needed: bool = True\n"
                ),
            }
        ],
    },
    {
        "id": "MR1-03",
        "fault": "speaker identity",
        "edits": [
            {
                "path": "spe_runtime/media/audio.py",
                "old": (
                    "        if bool(self.identity_retained):\n"
                    "            raise ValueError(\"speaker-neutral custody does not retain identity\")\n"
                    "        object.__setattr__(self, \"custody_mode\", mode)\n"
                    "        object.__setattr__(self, \"identity_retained\", False)\n"
                ),
                "new": (
                    "        object.__setattr__(self, \"custody_mode\", mode)\n"
                    "        object.__setattr__(self, \"identity_retained\", True)\n"
                ),
            }
        ],
    },
    {
        "id": "MR1-04",
        "fault": "voice biometric",
        "edits": [
            {
                "path": "spe_runtime/media/_validate.py",
                "old": (
                    "        \"speaker_name\",\n"
                    "        \"voiceprint\",\n"
                    "    }\n"
                ),
                "new": (
                    "        \"speaker_name\",\n"
                    "    }\n"
                ),
            },
            {
                "path": "spe_runtime/media/audio.py",
                "old": (
                    "        \"start_ms\",\n"
                    "        \"text\",\n"
                    "    }\n"
                    ")\n"
                ),
                "new": (
                    "        \"start_ms\",\n"
                    "        \"text\",\n"
                    "        \"voiceprint\",\n"
                    "    }\n"
                    ")\n"
                ),
            },
            {
                "path": "spe_runtime/media/audio.py",
                "old": (
                    "    speaker_slot: str | None = None\n"
                    "    observation_status: ObservationStatus = ObservationStatus.UNVERIFIED\n"
                ),
                "new": (
                    "    speaker_slot: str | None = None\n"
                    "    voiceprint: str | None = None\n"
                    "    observation_status: ObservationStatus = ObservationStatus.UNVERIFIED\n"
                ),
            },
            {
                "path": "spe_runtime/media/audio.py",
                "old": (
                    "            \"speaker_slot\": self.speaker_slot,\n"
                    "            \"start_ms\": self.start_ms,\n"
                ),
                "new": (
                    "            \"speaker_slot\": self.speaker_slot,\n"
                    "            \"start_ms\": self.start_ms,\n"
                    "            \"voiceprint\": self.voiceprint,\n"
                ),
            },
            {
                "path": "spe_runtime/media/audio.py",
                "old": (
                    "        speaker_slot=mapping.get(\"speaker_slot\"),\n"
                    "        observation_status=mapping.get(\"observation_status\", ObservationStatus.UNVERIFIED),\n"
                ),
                "new": (
                    "        speaker_slot=mapping.get(\"speaker_slot\"),\n"
                    "        voiceprint=mapping.get(\"voiceprint\"),\n"
                    "        observation_status=mapping.get(\"observation_status\", ObservationStatus.UNVERIFIED),\n"
                ),
            },
        ],
    },
    {
        "id": "MR1-05",
        "fault": "cloud endpoint",
        "edits": [
            {
                "path": "spe_runtime/media/audio.py",
                "old": (
                    "        \"raw_audio_retention\",\n"
                    "        \"sample_rate_hz\",\n"
                    "    }\n"
                    ")\n"
                ),
                "new": (
                    "        \"raw_audio_retention\",\n"
                    "        \"sample_rate_hz\",\n"
                    "        \"stt_endpoint\",\n"
                    "    }\n"
                    ")\n"
                ),
            },
            {
                "path": "spe_runtime/media/audio.py",
                "old": "    declared_byte_length: int | None = None\n",
                "new": (
                    "    declared_byte_length: int | None = None\n"
                    "    stt_endpoint: str | None = None\n"
                ),
            },
            {
                "path": "spe_runtime/media/audio.py",
                "old": (
                    "            \"raw_audio_retention\": self.raw_audio_retention.to_dict(),\n"
                    "            \"sample_rate_hz\": self.sample_rate_hz,\n"
                    "        }\n"
                ),
                "new": (
                    "            \"raw_audio_retention\": self.raw_audio_retention.to_dict(),\n"
                    "            \"sample_rate_hz\": self.sample_rate_hz,\n"
                    "            \"stt_endpoint\": self.stt_endpoint,\n"
                    "        }\n"
                ),
            },
            {
                "path": "spe_runtime/media/audio.py",
                "old": (
                    "        sample_rate_hz=mapping.get(\"sample_rate_hz\"),\n"
                    "        channel_count=mapping.get(\"channel_count\"),\n"
                    "        declared_byte_length=mapping.get(\"declared_byte_length\"),\n"
                ),
                "new": (
                    "        sample_rate_hz=mapping.get(\"sample_rate_hz\"),\n"
                    "        channel_count=mapping.get(\"channel_count\"),\n"
                    "        declared_byte_length=mapping.get(\"declared_byte_length\"),\n"
                    "        stt_endpoint=mapping.get(\"stt_endpoint\"),\n"
                ),
            },
        ],
    },
    {
        "id": "MR1-06",
        "fault": "negative timestamp",
        "edits": [
            {
                "path": "spe_runtime/media/_validate.py",
                "old": (
                    "    if value < 0:\n"
                    "        raise ValueError(f\"{field_name} must be >= 0\")\n"
                    "    return value\n"
                ),
                "new": "    return value\n",
            }
        ],
    },
    {
        "id": "MR1-07",
        "fault": "reversed timestamp",
        "edits": [
            {
                "path": "spe_runtime/media/_validate.py",
                "old": (
                    "    if end <= start:\n"
                    "        raise ValueError(\"end_ms must be greater than start_ms\")\n"
                    "    return start, end\n"
                ),
                "new": "    return start, end\n",
            }
        ],
    },
    {
        "id": "MR1-08",
        "fault": "scene overlap",
        "edits": [
            {
                "path": "spe_runtime/media/contract.py",
                "old": (
                    "    ordered = scenes.scenes\n"
                    "    assert_non_overlapping(\n"
                    "        [(item.start_ms, item.end_ms, item.scene_id) for item in ordered],\n"
                    "        \"scene\",\n"
                    "    )\n"
                ),
                "new": "    ordered = scenes.scenes\n",
            }
        ],
    },
    {
        "id": "MR1-09",
        "fault": "invalid keyframe",
        "edits": [
            {
                "path": "spe_runtime/media/contract.py",
                "old": (
                    "            if keyframe.timestamp_ms > video.duration_ms:\n"
                    "                raise ValueError(\"keyframe falls outside the video duration\")\n"
                ),
                "new": "",
            }
        ],
    },
    {
        "id": "MR1-10",
        "fault": "unknown duration becomes zero",
        "edits": [
            {
                "path": "spe_runtime/media/audio.py",
                "old": "        required=frozenset({\"content_digest\", \"duration_ms\", \"envelope_id\", \"media_type\"}),\n",
                "new": "        required=frozenset({\"content_digest\", \"envelope_id\", \"media_type\"}),\n",
            },
            {
                "path": "spe_runtime/media/audio.py",
                "old": "        duration_ms=mapping[\"duration_ms\"],\n",
                "new": "        duration_ms=mapping.get(\"duration_ms\") or 0,\n",
            },
        ],
    },
    {
        "id": "MR1-11",
        "fault": "missing transcript becomes empty-proof",
        "edits": [
            {
                "path": "spe_runtime/media/contract.py",
                "old": "            \"transcript\": None if self.transcript is None else self.transcript.to_dict(),\n",
                "new": (
                    "            \"transcript\": (\n"
                    "                {\n"
                    "                    \"observation_status\": \"VERIFIED\",\n"
                    "                    \"proof\": \"empty\",\n"
                    "                    \"segments\": [],\n"
                    "                }\n"
                    "                if self.transcript is None\n"
                    "                else self.transcript.to_dict()\n"
                    "            ),\n"
                ),
            }
        ],
    },
    {
        "id": "MR1-12",
        "fault": "unverified becomes verified",
        "edits": [
            {
                "path": "spe_runtime/media/audio.py",
                "old": "    UNVERIFIED = \"UNVERIFIED\"\n",
                "new": "    UNVERIFIED = \"VERIFIED\"\n",
            }
        ],
    },
    {
        "id": "MR1-13",
        "fault": "confidence fabricated",
        "edits": [
            {
                "path": "spe_runtime/media/audio.py",
                "old": (
                    "            \"start_ms\": self.start_ms,\n"
                    "            \"text\": self.text,\n"
                    "        }\n"
                ),
                "new": (
                    "            \"confidence\": 0.99,\n"
                    "            \"start_ms\": self.start_ms,\n"
                    "            \"text\": self.text,\n"
                    "        }\n"
                ),
            }
        ],
    },
    {
        "id": "MR1-14",
        "fault": "language fabricated",
        "edits": [
            {
                "path": "spe_runtime/media/audio.py",
                "old": (
                    "        if tag == \"und\" and basis is not LanguageBasis.UNSPECIFIED:\n"
                    "            raise ValueError(\"language tag 'und' requires language_basis UNSPECIFIED\")\n"
                    "        if basis is LanguageBasis.UNSPECIFIED and tag != \"und\":\n"
                    "            raise ValueError(\"UNSPECIFIED language_basis requires language_tag 'und'\")\n"
                    "        object.__setattr__(self, \"language_tag\", tag)\n"
                    "        object.__setattr__(self, \"language_basis\", basis)\n"
                ),
                "new": (
                    "        if basis is LanguageBasis.UNSPECIFIED or tag == \"und\":\n"
                    "            tag = \"en\"\n"
                    "            basis = LanguageBasis.DECLARED\n"
                    "        object.__setattr__(self, \"language_tag\", tag)\n"
                    "        object.__setattr__(self, \"language_basis\", basis)\n"
                ),
            }
        ],
    },
    {
        "id": "MR1-15",
        "fault": "bad MIME accepted",
        "edits": [
            {
                "path": "spe_runtime/media/audio.py",
                "old": (
                    "        if not media_type.startswith(\"audio/\") or len(media_type) <= len(\"audio/\"):\n"
                    "            raise ValueError(\"media_type must be an audio type\")\n"
                ),
                "new": "",
            }
        ],
    },
    {
        "id": "MR1-16",
        "fault": "scene label becomes fact",
        "edits": [
            {
                "path": "spe_runtime/media/video.py",
                "old": (
                    "            \"boundary_basis\": self.boundary_basis.value,\n"
                    "            \"end_ms\": self.end_ms,\n"
                    "            \"observation_status\": self.observation_status.value,\n"
                    "            \"ordinal\": self.ordinal,\n"
                    "            \"scene_id\": self.scene_id,\n"
                    "            \"start_ms\": self.start_ms,\n"
                ),
                "new": (
                    "            \"boundary_basis\": self.boundary_basis.value,\n"
                    "            \"end_ms\": self.end_ms,\n"
                    "            \"fact\": self.scene_id,\n"
                    "            \"observation_status\": self.observation_status.value,\n"
                    "            \"ordinal\": self.ordinal,\n"
                    "            \"scene_id\": self.scene_id,\n"
                    "            \"start_ms\": self.start_ms,\n"
                ),
            }
        ],
    },
    {
        "id": "MR1-17",
        "fault": "transcript becomes identity",
        "edits": [
            {
                "path": "spe_runtime/media/audio.py",
                "old": (
                    "            \"speaker_slot\": self.speaker_slot,\n"
                    "            \"start_ms\": self.start_ms,\n"
                ),
                "new": (
                    "            \"speaker_name\": self.text,\n"
                    "            \"speaker_slot\": self.speaker_slot,\n"
                    "            \"start_ms\": self.start_ms,\n"
                ),
            }
        ],
    },
    {
        "id": "MR1-18",
        "fault": "network upload",
        "edits": [
            {
                "path": "spe_runtime/media/contract.py",
                "old": (
                    "            \"network_authority\": self.network_authority.to_dict(),\n"
                    "            \"output_kind\": self.output_kind,\n"
                ),
                "new": (
                    "            \"network_authority\": self.network_authority.to_dict(),\n"
                    "            \"output_kind\": self.output_kind,\n"
                    "            \"upload_url\": \"https://uploads.example/media\",\n"
                ),
            }
        ],
    },
    {
        "id": "MR1-19",
        "fault": "gap removed",
        "edits": [
            {
                "path": "spe_runtime/media/audio.py",
                "old": "        ordered = tuple(sorted(segments, key=lambda item: (item.start_ms, item.end_ms, item.segment_id)))\n",
                "new": (
                    "        sequenced = sorted(segments, key=lambda item: (item.start_ms, item.end_ms, item.segment_id))\n"
                    "        collapsed: list[TranscriptSegment] = []\n"
                    "        cursor = sequenced[0].start_ms if sequenced else 0\n"
                    "        for segment in sequenced:\n"
                    "            span = segment.end_ms - segment.start_ms\n"
                    "            collapsed.append(\n"
                    "                TranscriptSegment(\n"
                    "                    segment_id=segment.segment_id,\n"
                    "                    start_ms=cursor,\n"
                    "                    end_ms=cursor + span,\n"
                    "                    text=segment.text,\n"
                    "                    speaker_slot=segment.speaker_slot,\n"
                    "                    observation_status=segment.observation_status,\n"
                    "                )\n"
                    "            )\n"
                    "            cursor += span\n"
                    "        ordered = tuple(collapsed)\n"
                ),
            }
        ],
    },
    {
        "id": "MR1-20",
        "fault": "semantic authority elevated",
        "edits": [
            {
                "path": "spe_runtime/media/contract.py",
                "old": "SEMANTIC_AUTHORITY = \"NONE\"\n",
                "new": "SEMANTIC_AUTHORITY = \"ELEVATED\"\n",
            }
        ],
    },
]
