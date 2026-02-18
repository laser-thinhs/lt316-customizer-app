from typing import Any
from .errors import AppError


def create_default_placement_document() -> dict[str, Any]:
    return {
        "version": 2,
        "canvas": {"widthMm": 50, "heightMm": 50},
        "machine": {"strokeWidthWarningThresholdMm": 0.1},
        "objects": [],
    }


def _is_finite_number(value: Any) -> bool:
    return isinstance(value, (int, float))


def parse_placement_document(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise AppError("Invalid placement payload", 400, "INVALID_PLACEMENT")

    if raw.get("version") == 2 and isinstance(raw.get("canvas"), dict) and isinstance(raw.get("machine"), dict) and isinstance(raw.get("objects"), list):
        canvas = raw["canvas"]
        if not _is_finite_number(canvas.get("widthMm")) or not _is_finite_number(canvas.get("heightMm")):
            raise AppError("Invalid placement payload", 400, "INVALID_PLACEMENT")
        return raw

    legacy_keys = ("widthMm", "heightMm", "offsetXMm", "offsetYMm", "rotationDeg", "anchor")
    if all(key in raw for key in legacy_keys):
        if not _is_finite_number(raw.get("widthMm")) or not _is_finite_number(raw.get("heightMm")):
            raise AppError("Invalid placement payload", 400, "INVALID_PLACEMENT")
        return {
            "version": 2,
            "canvas": {
                "widthMm": raw["widthMm"],
                "heightMm": raw["heightMm"],
            },
            "machine": {"strokeWidthWarningThresholdMm": 0.1},
            "objects": [],
        }

    raise AppError("Invalid placement payload", 400, "INVALID_PLACEMENT")
