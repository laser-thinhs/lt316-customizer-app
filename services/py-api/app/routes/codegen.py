from __future__ import annotations

import re
import uuid
from typing import List

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/v1/code", tags=["codegen"])


class RepoContext(BaseModel):
    block_registry_excerpt: str | None = None
    existing_blocks: List[str] = Field(default_factory=list)
    tree_hint: List[str] = Field(default_factory=list)


class CodeProposeRequest(BaseModel):
    instruction: str
    repo_context: RepoContext = Field(default_factory=RepoContext)


class CodeProposeResponse(BaseModel):
    proposal_id: str
    patch: str
    summary: str
    warnings: List[str]
    files: List[str]


def _sanitize_block_name(raw: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]", "", raw)
    if not cleaned:
      return "NewStudioBlock"
    if not cleaned[0].isalpha():
      cleaned = f"Block{cleaned}"
    if not cleaned.endswith("Block"):
      cleaned = f"{cleaned}Block"
    return cleaned


def _extract_block_name(instruction: str) -> str:
    match = re.search(r"(?:called|named)\s+([A-Za-z0-9_]+)", instruction, flags=re.IGNORECASE)
    if match:
        return _sanitize_block_name(match.group(1))

    alt = re.search(r"new block\s+([A-Za-z0-9_]+)", instruction, flags=re.IGNORECASE)
    if alt:
        return _sanitize_block_name(alt.group(1))

    return "NewStudioBlock"


def _fallback_patch_for_new_block(block_name: str) -> tuple[str, list[str], list[str], str]:
    file_name = f"src/studio/blocks/{block_name}.tsx"

    block_source = (
        f"export function {block_name}() {{\n"
        f"  return <div>{block_name}</div>;\n"
        "}\n"
    )
    registry_source = (
        "import { ExistingBlock } from \"./blocks/ExistingBlock\";\n"
        f"import {{ {block_name} }} from \"./blocks/{block_name}\";\n\n"
        "export const studioBlocks = {\n"
        "  ExistingBlock,\n"
        f"  {block_name},\n"
        "};\n"
    )

    patch = (
        f"diff --git a/{file_name} b/{file_name}\n"
        "new file mode 100644\n"
        "--- /dev/null\n"
        f"+++ b/{file_name}\n"
        "@@ -0,0 +1,3 @@\n"
        + "\n".join(f"+{line}" for line in block_source.strip("\n").split("\n"))
        + "\n"
        "diff --git a/src/studio/registry.ts b/src/studio/registry.ts\n"
        "--- a/src/studio/registry.ts\n"
        "+++ b/src/studio/registry.ts\n"
        "@@ -1,4 +1,6 @@\n"
        + "\n".join(f"+{line}" if i in {1, 5} else f" {line}" for i, line in enumerate(registry_source.split("\n"), start=1) if line)
        + "\n"
    )

    warnings = [
        "Deterministic fallback was used; verify registry import names align with your project.",
    ]
    files = [file_name, "src/studio/registry.ts"]
    summary = f"Adds {block_name} and registers it in src/studio/registry.ts."
    return patch, warnings, files, summary


@router.post("/propose", response_model=CodeProposeResponse)
def propose_code_diff(body: CodeProposeRequest) -> CodeProposeResponse:
    instruction = body.instruction.strip()
    proposal_id = f"proposal-{uuid.uuid4().hex[:12]}"

    if "new block" in instruction.lower() or "register" in instruction.lower():
        block_name = _extract_block_name(instruction)
        patch, warnings, files, summary = _fallback_patch_for_new_block(block_name)
    else:
        patch = ""
        warnings = ["No deterministic template matched this instruction."]
        files = []
        summary = "No patch generated."

    return CodeProposeResponse(
        proposal_id=proposal_id,
        patch=patch,
        summary=summary,
        warnings=warnings,
        files=files,
    )
