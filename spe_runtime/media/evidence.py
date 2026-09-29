"""VideoEvidenceGraph — structural citations among media observations.

Edges record containment, time order, and citation. They do not grant
semantic authority.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Sequence

from spe_runtime.media.audio import AudioInputEnvelope, TranscriptIR
from spe_runtime.media.privacy import (
    NetworkAuthorityPolicy,
    RawAudioRetentionPolicy,
    RawRetention,
    RawVideoRetentionPolicy,
)
from spe_runtime.media.video import (
    Keyframe,
    SceneSegmentationIR,
    TemporalEvent,
    TemporalEventKind,
    TranscriptAlignmentIR,
    VideoInputEnvelope,
)


class EvidenceNodeKind(str, Enum):
    AUDIO_ENVELOPE = "AUDIO_ENVELOPE"
    TRANSCRIPT = "TRANSCRIPT"
    TRANSCRIPT_SEGMENT = "TRANSCRIPT_SEGMENT"
    VIDEO_ENVELOPE = "VIDEO_ENVELOPE"
    SCENE = "SCENE"
    KEYFRAME = "KEYFRAME"
    ALIGNMENT = "ALIGNMENT"
    ALIGNMENT_LINK = "ALIGNMENT_LINK"
    TEMPORAL_EVENT = "TEMPORAL_EVENT"


class EvidenceEdgeKind(str, Enum):
    AUDIO_HAS_TRANSCRIPT = "AUDIO_HAS_TRANSCRIPT"
    TRANSCRIPT_HAS_SEGMENT = "TRANSCRIPT_HAS_SEGMENT"
    SEGMENT_TEMPORAL_NEXT = "SEGMENT_TEMPORAL_NEXT"
    VIDEO_HAS_SCENE = "VIDEO_HAS_SCENE"
    SCENE_TEMPORAL_NEXT = "SCENE_TEMPORAL_NEXT"
    VIDEO_HAS_KEYFRAME = "VIDEO_HAS_KEYFRAME"
    SCENE_HAS_KEYFRAME = "SCENE_HAS_KEYFRAME"
    VIDEO_HAS_ALIGNMENT = "VIDEO_HAS_ALIGNMENT"
    ALIGNMENT_HAS_LINK = "ALIGNMENT_HAS_LINK"
    LINK_CITES_SEGMENT = "LINK_CITES_SEGMENT"
    LINK_CITES_SCENE = "LINK_CITES_SCENE"
    LINK_CITES_KEYFRAME = "LINK_CITES_KEYFRAME"
    CLOCK_HAS_EVENT = "CLOCK_HAS_EVENT"
    EVENT_CITES = "EVENT_CITES"


def node_id(kind: EvidenceNodeKind, ref_id: str) -> str:
    return f"{kind.value}:{ref_id}"


@dataclass(frozen=True)
class EvidenceNode:
    node_id: str
    kind: EvidenceNodeKind
    ref_id: str

    def to_dict(self) -> dict[str, str]:
        return {
            "kind": self.kind.value,
            "node_id": self.node_id,
            "ref_id": self.ref_id,
        }


@dataclass(frozen=True)
class EvidenceEdge:
    edge_id: str
    kind: EvidenceEdgeKind
    source_id: str
    target_id: str

    def to_dict(self) -> dict[str, str]:
        return {
            "edge_id": self.edge_id,
            "kind": self.kind.value,
            "source_id": self.source_id,
            "target_id": self.target_id,
        }


def _edge(kind: EvidenceEdgeKind, source_id: str, target_id: str) -> EvidenceEdge:
    return EvidenceEdge(
        edge_id=f"{kind.value}:{source_id}->{target_id}",
        kind=kind,
        source_id=source_id,
        target_id=target_id,
    )


@dataclass(frozen=True)
class VideoEvidenceGraph:
    """Frozen citation graph. semantic_authority stays NONE."""

    graph_id: str
    nodes: tuple[EvidenceNode, ...]
    edges: tuple[EvidenceEdge, ...]
    raw_audio_retention: RawAudioRetentionPolicy
    raw_video_retention: RawVideoRetentionPolicy
    network_authority: NetworkAuthorityPolicy
    semantic_authority: str = "NONE"

    def __post_init__(self) -> None:
        if self.semantic_authority != "NONE":
            raise ValueError("video evidence graph semantic_authority is NONE")
        nodes = tuple(sorted(self.nodes, key=lambda item: item.node_id))
        edges = tuple(sorted(self.edges, key=lambda item: item.edge_id))
        known = {item.node_id for item in nodes}
        if len(known) != len(nodes):
            raise ValueError("duplicate evidence node_id")
        for edge in edges:
            if edge.source_id not in known or edge.target_id not in known:
                raise ValueError(f"evidence edge {edge.edge_id} cites an unknown node")
            if edge.source_id == edge.target_id:
                raise ValueError(f"evidence edge {edge.edge_id} is a self-loop")
        object.__setattr__(self, "nodes", nodes)
        object.__setattr__(self, "edges", edges)
        if not isinstance(self.raw_audio_retention, RawAudioRetentionPolicy):
            raise ValueError("raw_audio_retention policy is required")
        if not isinstance(self.raw_video_retention, RawVideoRetentionPolicy):
            raise ValueError("raw_video_retention policy is required")
        if not isinstance(self.network_authority, NetworkAuthorityPolicy):
            raise ValueError("network_authority policy is required")
        if self.raw_audio_retention.retention is not RawRetention.OFF:
            raise ValueError("raw audio retention is OFF")
        if self.network_authority.authority.value != "NONE":
            raise ValueError("network authority is NONE")

    def to_dict(self) -> dict[str, object]:
        video_policy = self.raw_video_retention.to_dict()
        return {
            "edges": [edge.to_dict() for edge in self.edges],
            "graph_id": self.graph_id,
            "network_authority": self.network_authority.to_dict(),
            "nodes": [node.to_dict() for node in self.nodes],
            "raw_audio_retention": self.raw_audio_retention.to_dict(),
            "raw_video_retention": video_policy["retention"],
            "raw_video_retention_explicitly_needed": video_policy["explicitly_needed"],
            "semantic_authority": self.semantic_authority,
        }


def build_video_evidence_graph(
    *,
    graph_id: str,
    audio: AudioInputEnvelope | None,
    transcript: TranscriptIR | None,
    video: VideoInputEnvelope | None,
    scenes: SceneSegmentationIR | None,
    keyframes: Sequence[Keyframe],
    alignment: TranscriptAlignmentIR | None,
    temporal_events: Sequence[TemporalEvent],
    raw_audio_retention: RawAudioRetentionPolicy,
    raw_video_retention: RawVideoRetentionPolicy,
    network_authority: NetworkAuthorityPolicy,
) -> VideoEvidenceGraph:
    """Derive a citation graph from already validated media observations."""
    nodes: list[EvidenceNode] = []
    edges: list[EvidenceEdge] = []

    def add_node(kind: EvidenceNodeKind, ref: str) -> str:
        identifier = node_id(kind, ref)
        nodes.append(EvidenceNode(node_id=identifier, kind=kind, ref_id=ref))
        return identifier

    audio_node = None
    if audio is not None:
        audio_node = add_node(EvidenceNodeKind.AUDIO_ENVELOPE, audio.envelope_id)
    video_node = None
    if video is not None:
        video_node = add_node(EvidenceNodeKind.VIDEO_ENVELOPE, video.envelope_id)

    segment_nodes: dict[str, str] = {}
    if transcript is not None:
        transcript_node = add_node(EvidenceNodeKind.TRANSCRIPT, transcript.transcript_id)
        if audio_node is not None:
            edges.append(_edge(EvidenceEdgeKind.AUDIO_HAS_TRANSCRIPT, audio_node, transcript_node))
        previous = None
        for segment in transcript.segments:
            segment_node = add_node(EvidenceNodeKind.TRANSCRIPT_SEGMENT, segment.segment_id)
            segment_nodes[segment.segment_id] = segment_node
            edges.append(
                _edge(EvidenceEdgeKind.TRANSCRIPT_HAS_SEGMENT, transcript_node, segment_node)
            )
            if previous is not None:
                edges.append(_edge(EvidenceEdgeKind.SEGMENT_TEMPORAL_NEXT, previous, segment_node))
            previous = segment_node

    scene_nodes: dict[str, str] = {}
    if scenes is not None and video_node is not None:
        previous_scene = None
        for scene in scenes.scenes:
            scene_node = add_node(EvidenceNodeKind.SCENE, scene.scene_id)
            scene_nodes[scene.scene_id] = scene_node
            edges.append(_edge(EvidenceEdgeKind.VIDEO_HAS_SCENE, video_node, scene_node))
            if previous_scene is not None:
                edges.append(
                    _edge(EvidenceEdgeKind.SCENE_TEMPORAL_NEXT, previous_scene, scene_node)
                )
            previous_scene = scene_node

    keyframe_nodes: dict[str, str] = {}
    if video_node is not None:
        for keyframe in keyframes:
            keyframe_node = add_node(EvidenceNodeKind.KEYFRAME, keyframe.keyframe_id)
            keyframe_nodes[keyframe.keyframe_id] = keyframe_node
            edges.append(_edge(EvidenceEdgeKind.VIDEO_HAS_KEYFRAME, video_node, keyframe_node))
            if keyframe.scene_id is not None:
                edges.append(
                    _edge(
                        EvidenceEdgeKind.SCENE_HAS_KEYFRAME,
                        scene_nodes[keyframe.scene_id],
                        keyframe_node,
                    )
                )

    if alignment is not None and video_node is not None:
        alignment_node = add_node(EvidenceNodeKind.ALIGNMENT, alignment.alignment_id)
        edges.append(_edge(EvidenceEdgeKind.VIDEO_HAS_ALIGNMENT, video_node, alignment_node))
        for link in alignment.links:
            link_node = add_node(EvidenceNodeKind.ALIGNMENT_LINK, link.link_id)
            edges.append(_edge(EvidenceEdgeKind.ALIGNMENT_HAS_LINK, alignment_node, link_node))
            edges.append(
                _edge(
                    EvidenceEdgeKind.LINK_CITES_SEGMENT,
                    link_node,
                    segment_nodes[link.transcript_segment_id],
                )
            )
            if link.scene_id is not None:
                edges.append(
                    _edge(
                        EvidenceEdgeKind.LINK_CITES_SCENE,
                        link_node,
                        scene_nodes[link.scene_id],
                    )
                )
            if link.keyframe_id is not None:
                edges.append(
                    _edge(
                        EvidenceEdgeKind.LINK_CITES_KEYFRAME,
                        link_node,
                        keyframe_nodes[link.keyframe_id],
                    )
                )

    for event in temporal_events:
        event_node = add_node(EvidenceNodeKind.TEMPORAL_EVENT, event.event_id)
        clock = _event_clock(event.kind, audio_node, video_node)
        edges.append(_edge(EvidenceEdgeKind.CLOCK_HAS_EVENT, clock, event_node))
        if event.ref_id is None:
            continue
        target = _event_target(event, segment_nodes, scene_nodes, keyframe_nodes)
        edges.append(_edge(EvidenceEdgeKind.EVENT_CITES, event_node, target))

    return VideoEvidenceGraph(
        graph_id=graph_id,
        nodes=tuple(nodes),
        edges=tuple(edges),
        raw_audio_retention=raw_audio_retention,
        raw_video_retention=raw_video_retention,
        network_authority=network_authority,
        semantic_authority="NONE",
    )


def _event_clock(
    kind: TemporalEventKind,
    audio_node: str | None,
    video_node: str | None,
) -> str:
    if kind in (TemporalEventKind.SCENE_SPAN, TemporalEventKind.KEYFRAME_MARK):
        if video_node is None:
            raise ValueError(f"{kind.value} requires a video envelope")
        return video_node
    if kind in (TemporalEventKind.SPEECH_SPAN, TemporalEventKind.SILENCE):
        if audio_node is not None:
            return audio_node
        if video_node is not None:
            return video_node
        raise ValueError(f"{kind.value} requires an audio or video envelope")
    if video_node is not None:
        return video_node
    if audio_node is not None:
        return audio_node
    raise ValueError("DECLARED event requires an audio or video envelope")


def _event_target(
    event: TemporalEvent,
    segment_nodes: dict[str, str],
    scene_nodes: dict[str, str],
    keyframe_nodes: dict[str, str],
) -> str:
    ref_id = event.ref_id
    if ref_id is None:
        raise ValueError("event citation requires ref_id")
    if event.kind is TemporalEventKind.SPEECH_SPAN:
        return segment_nodes[ref_id]
    if event.kind is TemporalEventKind.SCENE_SPAN:
        return scene_nodes[ref_id]
    if event.kind is TemporalEventKind.KEYFRAME_MARK:
        return keyframe_nodes[ref_id]
    raise ValueError(f"{event.kind.value} does not cite an object")


__all__ = [
    "EvidenceEdge",
    "EvidenceEdgeKind",
    "EvidenceNode",
    "EvidenceNodeKind",
    "VideoEvidenceGraph",
    "build_video_evidence_graph",
    "node_id",
]
