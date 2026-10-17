"""Local persistent store for Instruction System of Record."""

from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import Any

from .models import (
    ApprovalIdentity,
    ConstraintIdentity,
    DeploymentIdentity,
    InstructionIdentity,
    InstructionProject,
    InstructionVersion,
    PromptArtifactIdentity,
    ProtectedIntentSnapshot,
    RequirementIdentity,
)


class TamperError(Exception):
    """Raised when an instruction version digest does not match its contents."""


class VersionNotFoundError(Exception):
    """Raised when requesting a version that does not exist."""


class InstructionStore:
    def __init__(self, base_dir: Path | str) -> None:
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self._projects_file = self.base_dir / "projects.json"
        self._history_file = self.base_dir / "history.jsonl"
        self._ensure_storage()

    def _ensure_storage(self) -> None:
        if not self._projects_file.exists():
            self._projects_file.write_text("{}", encoding="utf-8")
        if not self._history_file.exists():
            self._history_file.touch()

    def create_project(self, project_id: str, name: str, description: str) -> InstructionProject:
        project = InstructionProject(project_id=project_id, name=name, description=description)
        self.save_project(project)
        return project

    def save_project(self, project: InstructionProject) -> None:
        projects = self._load_all_projects_dict()
        projects[project.project_id] = {
            "project_id": project.project_id,
            "name": project.name,
            "description": project.description,
            "created_at": project.created_at,
            "instructions": {iid: asdict(ident) for iid, ident in project.instructions.items()},
        }
        self._projects_file.write_text(json.dumps(projects, indent=2), encoding="utf-8")

    def get_project(self, project_id: str) -> InstructionProject | None:
        projects = self._load_all_projects_dict()
        data = projects.get(project_id)
        if not data:
            return None
        proj = InstructionProject(
            project_id=data["project_id"],
            name=data["name"],
            description=data["description"],
            created_at=data["created_at"],
        )
        for iid, idata in data.get("instructions", {}).items():
            proj.instructions[iid] = InstructionIdentity(**idata)
        # Load all versions for this project
        proj.versions = self.load_versions_for_project(project_id)
        return proj

    def record_version(self, project_id: str, version: InstructionVersion) -> None:
        # Verify tamper integrity before appending
        expected_digest = version.version_digest
        # Append-only to history log
        record = {
            "project_id": project_id,
            "version_id": version.version_id,
            "instruction_id": version.instruction_id,
            "version_number": version.version_number,
            "human_objective": version.human_objective,
            "intent_snapshot": asdict(version.intent_snapshot),
            "requirements": [asdict(r) for r in version.requirements],
            "constraints": [asdict(c) for c in version.constraints],
            "artifacts": [asdict(a) for a in version.artifacts],
            "parent_version_id": version.parent_version_id,
            "author": version.author,
            "created_at": version.created_at,
            "approval": asdict(version.approval) if version.approval else None,
            "deployment": asdict(version.deployment) if version.deployment else None,
            "version_digest": expected_digest,
        }
        with self._history_file.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")

    def load_versions_for_project(self, project_id: str) -> dict[str, list[InstructionVersion]]:
        versions_by_inst: dict[str, list[InstructionVersion]] = {}
        if not self._history_file.exists():
            return versions_by_inst

        with self._history_file.open("r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                row = json.loads(line)
                if row.get("project_id") != project_id:
                    continue
                v = self._deserialize_version(row)
                if v.version_digest != row["version_digest"]:
                    raise TamperError(
                        f"Tamper detected in version {v.version_id}: computed {v.version_digest} != stored {row['version_digest']}"
                    )
                inst_id = v.instruction_id
                versions_by_inst.setdefault(inst_id, []).append(v)
        return versions_by_inst

    def get_version(self, project_id: str, instruction_id: str, version_id: str) -> InstructionVersion:
        all_v = self.load_versions_for_project(project_id).get(instruction_id, [])
        for v in all_v:
            if v.version_id == version_id:
                return v
        raise VersionNotFoundError(f"Version {version_id} not found in instruction {instruction_id}")

    def rollback(self, project_id: str, instruction_id: str, target_version_id: str, author: str) -> InstructionVersion:
        target = self.get_version(project_id, instruction_id, target_version_id)
        all_v = self.load_versions_for_project(project_id).get(instruction_id, [])
        new_version_num = (all_v[-1].version_number + 1) if all_v else 1
        new_vid = f"{instruction_id}-v{new_version_num}-rollback-to-{target.version_id}"
        import datetime
        rolled = InstructionVersion(
            version_id=new_vid,
            instruction_id=instruction_id,
            version_number=new_version_num,
            human_objective=f"Rollback to {target.version_id}: {target.human_objective}",
            intent_snapshot=target.intent_snapshot,
            requirements=target.requirements,
            constraints=target.constraints,
            artifacts=target.artifacts,
            parent_version_id=all_v[-1].version_id if all_v else None,
            author=author,
            created_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        )
        self.record_version(project_id, rolled)
        return rolled

    def _deserialize_version(self, row: dict[str, Any]) -> InstructionVersion:
        intent_raw = row["intent_snapshot"]
        intent = ProtectedIntentSnapshot(
            goal=intent_raw["goal"],
            non_negotiables=tuple(intent_raw["non_negotiables"]),
            authority_scope=intent_raw["authority_scope"],
            invariants=tuple(intent_raw["invariants"]),
        )
        reqs = tuple(RequirementIdentity(**r) for r in row["requirements"])
        cons = tuple(ConstraintIdentity(**c) for c in row["constraints"])
        arts = tuple(
            PromptArtifactIdentity(
                artifact_id=a["artifact_id"],
                compiled_prompt=a["compiled_prompt"],
                target_provider=a["target_provider"],
                token_count_estimate=a["token_count_estimate"],
            )
            for a in row["artifacts"]
        )
        approval = ApprovalIdentity(**row["approval"]) if row.get("approval") else None
        deployment = DeploymentIdentity(**row["deployment"]) if row.get("deployment") else None

        return InstructionVersion(
            version_id=row["version_id"],
            instruction_id=row["instruction_id"],
            version_number=row["version_number"],
            human_objective=row["human_objective"],
            intent_snapshot=intent,
            requirements=reqs,
            constraints=cons,
            artifacts=arts,
            parent_version_id=row["parent_version_id"],
            author=row["author"],
            created_at=row["created_at"],
            approval=approval,
            deployment=deployment,
        )

    def _load_all_projects_dict(self) -> dict[str, Any]:
        if not self._projects_file.exists():
            return {}
        try:
            return json.loads(self._projects_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}
