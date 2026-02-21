from __future__ import annotations

import json
import os
import uuid
from typing import Any

from .models import CodeProposeRequest, CodeProposeResponse

DEFAULT_MODEL = "gpt-4o-mini"
MAX_CONTEXT_CHARS = 12_000


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False)


def _repo_context_excerpt(repo_context: dict[str, Any] | None) -> str:
    if not repo_context:
        return "{}"
    as_text = json.dumps(repo_context, ensure_ascii=False)
    if len(as_text) <= MAX_CONTEXT_CHARS:
        return as_text
    return as_text[:MAX_CONTEXT_CHARS] + "\n...<truncated>"


def _extract_paths_from_patch(patch: str) -> list[str]:
    paths: list[str] = []
    for line in patch.splitlines():
        if line.startswith("+++ "):
            path = line[4:].strip()
            if path == "/dev/null":
                continue
            normalized = path.removeprefix("a/").removeprefix("b/").removeprefix("./")
            if normalized and normalized not in paths:
                paths.append(normalized)
    return paths


def _fallback_response(instruction: str, reason: str) -> CodeProposeResponse:
    proposal_id = f"proposal_{uuid.uuid4().hex[:12]}"
    safe_instruction = instruction.replace("\n", " ").strip()[:220]
    patch = (
        "diff --git a/src/studio/ai-proposals.md b/src/studio/ai-proposals.md\n"
        "new file mode 100644\n"
        "index 0000000..1111111\n"
        "--- /dev/null\n"
        "+++ b/src/studio/ai-proposals.md\n"
        "@@ -0,0 +1,3 @@\n"
        "+# Studio AI Proposal Placeholder\n"
        f"+- Instruction: {safe_instruction}\n"
        "+- OpenAI call unavailable; no code changes proposed.\n"
    )
    return CodeProposeResponse(
        proposal_id=proposal_id,
        patch=patch,
        summary="No code patch generated. Returning placeholder proposal.",
        warnings=[reason],
        files=_extract_paths_from_patch(patch),
    )


def propose_code(request: CodeProposeRequest) -> CodeProposeResponse:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return _fallback_response(request.instruction, "OPENAI_API_KEY is not set.")

    try:
        from openai import OpenAI
    except Exception as exc:  # noqa: BLE001
        return _fallback_response(request.instruction, f"OpenAI SDK import failed: {exc}")

    model = os.getenv("OPENAI_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    client = OpenAI(api_key=api_key)

    system_prompt = (
        "You generate git unified diffs only. "
        "Return strict JSON with keys: patch (string), summary (string), warnings (array of strings), files (array of strings). "
        "Patch constraints: only modify paths under src/studio/, src/components/, app/(studio)/, or src/app/(studio)/. "
        "Allowed extensions: .ts, .tsx, .css, .md, .json. "
        "Never include markdown fences. "
        "If unsure, return a minimal safe patch in src/studio/."
    )

    user_prompt = {
        "instruction": _normalize_text(request.instruction),
        "target": _normalize_text(request.target),
        "repo_context_excerpt": _repo_context_excerpt(request.repo_context),
    }

    try:
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(user_prompt, ensure_ascii=False)},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        content = completion.choices[0].message.content or "{}"
        parsed = json.loads(content)

        patch = _normalize_text(parsed.get("patch", "")).strip()
        summary = _normalize_text(parsed.get("summary", "Generated patch proposal.")).strip() or "Generated patch proposal."
        warnings_raw = parsed.get("warnings", [])
        warnings = [str(item) for item in warnings_raw] if isinstance(warnings_raw, list) else []

        if not patch.startswith("diff --git "):
            return _fallback_response(request.instruction, "OpenAI response did not contain a valid git patch.")

        files_raw = parsed.get("files", [])
        files = [str(item) for item in files_raw] if isinstance(files_raw, list) else []
        if not files:
            files = _extract_paths_from_patch(patch)

        return CodeProposeResponse(
            proposal_id=f"proposal_{uuid.uuid4().hex[:12]}",
            patch=patch,
            summary=summary,
            warnings=warnings,
            files=files,
        )
    except Exception as exc:  # noqa: BLE001
        return _fallback_response(request.instruction, f"OpenAI request failed: {exc}")
