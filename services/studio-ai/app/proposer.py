from __future__ import annotations

import copy
import uuid
from typing import cast

from .models import Block, Layout, ProposeResponse


def _text_block_index(layout: Layout) -> int | None:
    for idx, block in enumerate(layout.blocks):
        if block.type == "text":
            return idx
    return None


def propose_layout(layout: Layout, instruction: str) -> ProposeResponse:
    lowered = instruction.lower()
    next_layout = copy.deepcopy(layout)
    warnings: list[str] = []
    changes: list[dict[str, object]] = []

    if "add 3d" in lowered or "insert cylinder" in lowered or "add cylinder" in lowered:
        block = Block.model_validate(
            {
                "id": f"cylinder-{uuid.uuid4().hex[:8]}",
                "type": "cylinder",
                "props": {"label": "Cylinder", "diameterMm": 50, "heightMm": 120},
            }
        )
        next_layout.blocks.append(block)
        changes.append({"op": "add", "path": f"/blocks/{len(next_layout.blocks)-1}", "value": block.model_dump()})

    if "change text" in lowered or "update text" in lowered:
        idx = _text_block_index(next_layout)
        if idx is None:
            warnings.append("No text block found to update.")
        else:
            block = next_layout.blocks[idx]
            block.props["text"] = "Updated by Studio AI"
            changes.append({"op": "replace", "path": f"/blocks/{idx}/props/text", "value": block.props["text"]})

    if "move block" in lowered and len(next_layout.blocks) > 1:
        last = next_layout.blocks.pop()
        next_layout.blocks.insert(0, last)
        changes.append({"op": "move", "path": "/blocks/0", "value": {"from": "last"}})

    if not changes:
        warnings.append("No deterministic rule matched the instruction; layout unchanged.")

    # Safety guard: never change id/type for existing source blocks.
    original_types = {block.id: block.type for block in layout.blocks}
    for updated in next_layout.blocks:
        source_type = original_types.get(updated.id)
        if source_type is None:
            continue
        if source_type != updated.type:
            raise ValueError("reserved field mutation detected")

    summary = "Applied deterministic proposal rules." if changes else "No structural changes proposed."
    return ProposeResponse(
        proposal_id=f"proposal_{uuid.uuid4().hex[:12]}",
        next_layout=cast(Layout, next_layout),
        json_patch=changes,
        summary=summary,
        warnings=warnings,
    )
