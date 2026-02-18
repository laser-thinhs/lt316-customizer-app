import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import uuid4
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
from sqlalchemy import select
from ..auth import require_api_role
from ..db import SessionLocal
from ..errors import AppError
from ..models import Asset, DesignJob, ExportArtifact, MachineProfile, ProductProfile
from ..placement import parse_placement_document

router = APIRouter(prefix="/api", tags=["design-jobs"])
SEAM_MARGIN_MM = 1.0


class UpdatePlacementRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    placementJson: dict

    @field_validator("placementJson")
    @classmethod
    def validate_placement_json(cls, value: dict):
        try:
            return parse_placement_document(value)
        except AppError as error:
            raise ValueError(error.message) from error


class CreateDesignJobRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    orderRef: str | None = Field(default=None, min_length=1, max_length=100)
    productProfileId: str = Field(min_length=1)
    machineProfileId: str = Field(min_length=1)
    placementJson: dict
    previewImagePath: str | None = None

    @field_validator("orderRef")
    @classmethod
    def normalize_order_ref(cls, value: str | None):
        if value is None:
            return None
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("String should have at least 1 character")
        return trimmed

    @field_validator("placementJson")
    @classmethod
    def validate_placement_json(cls, value: dict):
        try:
            return parse_placement_document(value)
        except AppError as error:
            raise ValueError(error.message) from error


def _serialize_product_profile(row: ProductProfile | None):
    if not row:
        return None

    return {
        "id": row.id,
        "name": row.name,
        "sku": row.sku,
        "diameterMm": row.diameterMm,
        "heightMm": row.heightMm,
        "engraveZoneWidthMm": row.engraveZoneWidthMm,
        "engraveZoneHeightMm": row.engraveZoneHeightMm,
        "seamReference": row.seamReference,
        "toolOutlineSvgPath": row.toolOutlineSvgPath,
        "defaultSettingsProfile": row.defaultSettingsProfile,
        "createdAt": row.createdAt,
        "updatedAt": row.updatedAt,
    }


def _serialize_machine_profile(row: MachineProfile | None):
    if not row:
        return None

    return {
        "id": row.id,
        "name": row.name,
        "laserType": row.laserType,
        "lens": row.lens,
        "rotaryModeDefault": row.rotaryModeDefault,
        "powerDefault": row.powerDefault,
        "speedDefault": row.speedDefault,
        "frequencyDefault": row.frequencyDefault,
        "createdAt": row.createdAt,
        "updatedAt": row.updatedAt,
    }


def _serialize_asset(row: Asset):
    return {
        "id": row.id,
        "designJobId": row.designJobId,
        "kind": row.kind,
        "filename": row.originalName or f"{row.id}.bin",
        "mime": row.mimeType,
        "bytes": row.byteSize,
        "originalName": row.originalName,
        "mimeType": row.mimeType,
        "byteSize": row.byteSize,
        "filePath": row.filePath,
        "url": f"/api/assets/{row.id}",
        "path": row.filePath,
        "widthPx": row.widthPx,
        "heightPx": row.heightPx,
        "createdAt": row.createdAt.isoformat() if row.createdAt else None,
    }


def _to_float(value: Any) -> float | None:
    if isinstance(value, (int, float, Decimal)):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_absolute_bounds(obj: dict[str, Any]) -> dict[str, float] | None:
    kind = obj.get("kind")
    if kind == "image":
        x = _to_float(obj.get("xMm"))
        y = _to_float(obj.get("yMm"))
        width = _to_float(obj.get("widthMm"))
        height = _to_float(obj.get("heightMm"))
        if x is None or y is None or width is None or height is None:
            return None
        return {"xMm": x, "yMm": y, "widthMm": width, "heightMm": height}

    offset_x = _to_float(obj.get("offsetXMm"))
    offset_y = _to_float(obj.get("offsetYMm"))
    width = _to_float(obj.get("boxWidthMm"))
    height = _to_float(obj.get("boxHeightMm"))
    if offset_x is None or offset_y is None or width is None or height is None:
        return None

    anchor = obj.get("anchor", "top-left")
    if anchor == "center":
        x, y = offset_x - width / 2, offset_y - height / 2
    elif anchor == "top-left":
        x, y = offset_x, offset_y
    elif anchor == "top-right":
        x, y = offset_x - width, offset_y
    elif anchor == "bottom-left":
        x, y = offset_x, offset_y - height
    elif anchor == "bottom-right":
        x, y = offset_x - width, offset_y - height
    else:
        x, y = offset_x, offset_y

    return {"xMm": x, "yMm": y, "widthMm": width, "heightMm": height}


def _intersects(bounds_a: dict[str, float], bounds_b: dict[str, float]) -> bool:
    return (
        bounds_a["xMm"] < bounds_b["xMm"] + bounds_b["widthMm"]
        and bounds_a["xMm"] + bounds_a["widthMm"] > bounds_b["xMm"]
        and bounds_a["yMm"] < bounds_b["yMm"] + bounds_b["heightMm"]
        and bounds_a["yMm"] + bounds_a["heightMm"] > bounds_b["yMm"]
    )


def _run_design_job_preflight(
    job: DesignJob,
    product: ProductProfile,
    assets: list[Asset],
) -> dict[str, Any]:
    issues: list[dict[str, Any]] = []

    try:
        placement = parse_placement_document(job.placementJson)
    except AppError:
        return {
            "status": "fail",
            "issues": [
                {
                    "code": "INVALID_PLACEMENT",
                    "severity": "error",
                    "message": "Placement payload is invalid and cannot be parsed.",
                    "suggestedFix": "Open the job editor and save placement again.",
                }
            ],
        }

    canvas = placement.get("canvas", {}) if isinstance(placement, dict) else {}
    canvas_width = _to_float(canvas.get("widthMm"))
    canvas_height = _to_float(canvas.get("heightMm"))
    zone_width = _to_float(product.engraveZoneWidthMm)
    zone_height = _to_float(product.engraveZoneHeightMm)

    if canvas_width is None or canvas_height is None:
        return {
            "status": "fail",
            "issues": [
                {
                    "code": "INVALID_PLACEMENT",
                    "severity": "error",
                    "message": "Placement payload is invalid and cannot be parsed.",
                    "suggestedFix": "Open the job editor and save placement again.",
                }
            ],
        }

    if zone_width is not None and zone_height is not None and (canvas_width > zone_width or canvas_height > zone_height):
        issues.append(
            {
                "code": "CANVAS_EXCEEDS_ENGRAVE_ZONE",
                "severity": "error",
                "message": "Canvas dimensions exceed product engrave zone.",
                "suggestedFix": "Resize canvas to fit within product profile engrave zone.",
            }
        )

    known_assets = set()
    for asset in assets:
        known_assets.add(asset.id)
        known_assets.add(asset.filePath)
        known_assets.add(f"/api/assets/{asset.id}")

    raw_objects = placement.get("objects", []) if isinstance(placement, dict) else []
    objects = [obj for obj in raw_objects if isinstance(obj, dict) and obj.get("visible", True) is not False]
    ordered_objects = sorted(objects, key=lambda obj: (obj.get("zIndex", 0), str(obj.get("id", ""))))

    machine = placement.get("machine", {}) if isinstance(placement, dict) else {}
    stroke_threshold = _to_float(machine.get("strokeWidthWarningThresholdMm"))
    if stroke_threshold is None:
        stroke_threshold = 0.1

    object_bounds: list[tuple[dict[str, Any], dict[str, float]]] = []

    for obj in ordered_objects:
        bounds = _to_absolute_bounds(obj)
        object_id = obj.get("id")
        if bounds is None:
            issues.append(
                {
                    "code": "INVALID_OBJECT_DATA",
                    "severity": "error",
                    "message": "Object has invalid geometry values.",
                    "objectId": object_id,
                    "suggestedFix": "Recreate this object in the editor.",
                }
            )
            continue

        object_bounds.append((obj, bounds))

        if (
            bounds["xMm"] < 0
            or bounds["yMm"] < 0
            or bounds["xMm"] + bounds["widthMm"] > canvas_width
            or bounds["yMm"] + bounds["heightMm"] > canvas_height
        ):
            issues.append(
                {
                    "code": "OBJECT_OUT_OF_CANVAS",
                    "severity": "error",
                    "message": "Object exceeds canvas bounds.",
                    "objectId": object_id,
                    "suggestedFix": "Move or resize object within canvas bounds.",
                }
            )

        if zone_width is not None and zone_height is not None:
            if (
                bounds["xMm"] < 0
                or bounds["yMm"] < 0
                or bounds["xMm"] + bounds["widthMm"] > zone_width
                or bounds["yMm"] + bounds["heightMm"] > zone_height
            ):
                issues.append(
                    {
                        "code": "OBJECT_OUT_OF_ENGRAVE_ZONE",
                        "severity": "error",
                        "message": "Object exceeds product engrave zone.",
                        "objectId": object_id,
                        "suggestedFix": "Clamp object to engrave zone before export.",
                    }
                )

        kind = obj.get("kind")
        if kind in {"text_line", "text_block", "text_arc"} and obj.get("fillMode") == "stroke":
            stroke_width = _to_float(obj.get("strokeWidthMm"))
            if stroke_width is not None and stroke_width < stroke_threshold:
                issues.append(
                    {
                        "code": "STROKE_TOO_THIN",
                        "severity": "warning",
                        "message": f"Stroke width {stroke_width}mm is below threshold {stroke_threshold}mm.",
                        "objectId": object_id,
                        "suggestedFix": "Increase stroke width or switch to fill mode.",
                    }
                )

        if kind == "image" and obj.get("assetId") not in known_assets:
            issues.append(
                {
                    "code": "MISSING_ASSET_REFERENCE",
                    "severity": "error",
                    "message": "Image object references a missing asset.",
                    "objectId": object_id,
                    "suggestedFix": "Upload/relink the image asset before export.",
                }
            )

        if bounds["xMm"] <= SEAM_MARGIN_MM or bounds["xMm"] + bounds["widthMm"] >= canvas_width - SEAM_MARGIN_MM:
            issues.append(
                {
                    "code": "SEAM_RISK",
                    "severity": "warning",
                    "message": "Object is very close to the seam boundary.",
                    "objectId": object_id,
                    "suggestedFix": "Offset object away from seam boundary.",
                }
            )

    for index in range(len(object_bounds)):
        left_obj, left_bounds = object_bounds[index]
        for compare_index in range(index + 1, len(object_bounds)):
            right_obj, right_bounds = object_bounds[compare_index]
            if _intersects(left_bounds, right_bounds):
                issues.append(
                    {
                        "code": "OBJECT_OVERLAP_RISK",
                        "severity": "warning",
                        "message": f"Objects {left_obj.get('id')} and {right_obj.get('id')} overlap and may over-burn.",
                        "objectId": left_obj.get("id"),
                        "suggestedFix": "Separate objects or tune operation order/power in LightBurn.",
                    }
                )

    has_error = any(issue.get("severity") == "error" for issue in issues)
    has_warning = any(issue.get("severity") == "warning" for issue in issues)
    status = "fail" if has_error else "warn" if has_warning else "pass"

    return {"status": status, "issues": issues}


def _round_mm(value: float) -> float:
    return round(float(value), 3)


def _escape_xml(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def _build_export_manifest(
    job: DesignJob,
    product: ProductProfile,
    machine: MachineProfile,
    preflight: dict[str, Any],
) -> dict[str, Any]:
    placement = parse_placement_document(job.placementJson)
    raw_objects = placement.get("objects", []) if isinstance(placement, dict) else []
    objects = [obj for obj in raw_objects if isinstance(obj, dict) and obj.get("visible", True) is not False]
    ordered_objects = sorted(objects, key=lambda obj: (obj.get("zIndex", 0), str(obj.get("id", ""))))

    manifest_objects: list[dict[str, Any]] = []
    for index, obj in enumerate(ordered_objects):
        kind = obj.get("kind")
        bounds = _to_absolute_bounds(obj)
        if bounds is None:
            continue

        if kind == "image":
            source = {
                "anchor": "top-left",
                "offsetXMm": _round_mm(bounds["xMm"]),
                "offsetYMm": _round_mm(bounds["yMm"]),
                "boxWidthMm": _round_mm(bounds["widthMm"]),
                "boxHeightMm": _round_mm(bounds["heightMm"]),
                "rotationDeg": _round_mm(_to_float(obj.get("rotationDeg")) or 0),
                "mirrorX": False,
                "mirrorY": False,
            }
        else:
            source = {
                "anchor": obj.get("anchor", "top-left"),
                "offsetXMm": _round_mm(_to_float(obj.get("offsetXMm")) or 0),
                "offsetYMm": _round_mm(_to_float(obj.get("offsetYMm")) or 0),
                "boxWidthMm": _round_mm(_to_float(obj.get("boxWidthMm")) or 0),
                "boxHeightMm": _round_mm(_to_float(obj.get("boxHeightMm")) or 0),
                "rotationDeg": _round_mm(_to_float(obj.get("rotationDeg")) or 0),
                "mirrorX": bool(obj.get("mirrorX", False)),
                "mirrorY": bool(obj.get("mirrorY", False)),
            }

        manifest_objects.append(
            {
                "id": obj.get("id"),
                "kind": kind,
                "zIndex": int(obj.get("zIndex", index)),
                "source": source,
                "absoluteBoundsMm": {
                    "xMm": _round_mm(bounds["xMm"]),
                    "yMm": _round_mm(bounds["yMm"]),
                    "widthMm": _round_mm(bounds["widthMm"]),
                    "heightMm": _round_mm(bounds["heightMm"]),
                },
            }
        )

    issues = preflight.get("issues", []) if isinstance(preflight, dict) else []
    return {
        "version": "1.0",
        "designJobId": job.id,
        "machineProfileId": machine.id,
        "placementVersion": int(placement.get("version", 2)),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "productProfile": {
            "id": product.id,
            "sku": product.sku,
            "name": product.name,
            "engraveZoneWidthMm": _to_float(product.engraveZoneWidthMm),
            "engraveZoneHeightMm": _to_float(product.engraveZoneHeightMm),
            "diameterMm": _to_float(product.diameterMm),
            "heightMm": _to_float(product.heightMm),
        },
        "objects": manifest_objects,
        "preflight": {
            "status": preflight.get("status", "fail"),
            "issueCount": len(issues),
            "errorCount": len([issue for issue in issues if issue.get("severity") == "error"]),
            "warningCount": len([issue for issue in issues if issue.get("severity") == "warning"]),
        },
    }


def _build_export_svg(job: DesignJob, product: ProductProfile) -> str:
    placement = parse_placement_document(job.placementJson)
    canvas = placement.get("canvas", {}) if isinstance(placement, dict) else {}
    canvas_width = _to_float(canvas.get("widthMm")) or 0
    canvas_height = _to_float(canvas.get("heightMm")) or 0

    raw_objects = placement.get("objects", []) if isinstance(placement, dict) else []
    objects = [obj for obj in raw_objects if isinstance(obj, dict) and obj.get("visible", True) is not False]
    ordered_objects = sorted(objects, key=lambda obj: (obj.get("zIndex", 0), str(obj.get("id", ""))))

    fragments: list[str] = []
    for obj in ordered_objects:
        kind = obj.get("kind")
        obj_id = _escape_xml(str(obj.get("id", "")))
        bounds = _to_absolute_bounds(obj)
        if bounds is None:
            continue

        if kind == "image":
            href = _escape_xml(f"/api/assets/{obj.get('assetId')}")
            opacity = _round_mm(_to_float(obj.get("opacity")) or 1)
            fragments.append(
                f'<image id="{obj_id}" x="{_round_mm(bounds["xMm"])}" y="{_round_mm(bounds["yMm"])}" width="{_round_mm(bounds["widthMm"])}" height="{_round_mm(bounds["heightMm"])}" href="{href}" opacity="{opacity}" preserveAspectRatio="none" />'
            )
            continue

        if kind == "vector":
            path_data = _escape_xml(str(obj.get("pathData", "")))
            fragments.append(f'<path id="{obj_id}" d="{path_data}" fill="none" stroke="black" stroke-width="0.1" />')
            continue

        content = _escape_xml(str(obj.get("content", "")))
        font_family = _escape_xml(str(obj.get("fontFamily", "Arial")))
        font_size = _round_mm(_to_float(obj.get("fontSizeMm")) or 1)
        y_text = _round_mm(bounds["yMm"] + font_size)
        fragments.append(
            f'<text id="{obj_id}" x="{_round_mm(bounds["xMm"])}" y="{y_text}" font-family="{font_family}" font-size="{font_size}">{content}</text>'
        )

    return (
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{_round_mm(canvas_width)}mm" height="{_round_mm(canvas_height)}mm" viewBox="0 0 {_round_mm(canvas_width)} {_round_mm(canvas_height)}" data-product-profile="{_escape_xml(product.id)}">\n'
        + "\n".join(fragments)
        + "\n</svg>"
    )


def _build_export_svg_route_svg(job: DesignJob, include_guides: bool) -> str:
    placement = parse_placement_document(job.placementJson)
    canvas = placement.get("canvas", {}) if isinstance(placement, dict) else {}
    canvas_width = _to_float(canvas.get("widthMm")) or 0
    canvas_height = _to_float(canvas.get("heightMm")) or 0

    wrap = placement.get("wrap", {}) if isinstance(placement, dict) else {}
    wrap_enabled = bool(wrap.get("enabled", False))
    wrap_width = _to_float(wrap.get("wrapWidthMm")) or canvas_width
    seam_x = _to_float(wrap.get("seamXmm")) or 0
    overlap = _to_float(wrap.get("microOverlapMm")) or 0

    raw_objects = placement.get("objects", []) if isinstance(placement, dict) else []
    objects = [obj for obj in raw_objects if isinstance(obj, dict) and obj.get("visible", True) is not False]
    ordered_objects = sorted(objects, key=lambda obj: (obj.get("zIndex", 0), str(obj.get("id", ""))))

    def object_svg_fragment(obj: dict[str, Any], translate_x: float = 0.0) -> str:
        obj_id = _escape_xml(str(obj.get("id", "")))
        bounds = _to_absolute_bounds(obj)
        if bounds is None:
            return ""

        kind = obj.get("kind")
        if kind == "vector":
            path_data = _escape_xml(str(obj.get("pathData", "")))
            base_x = _to_float(obj.get("offsetXMm")) or bounds["xMm"]
            base_y = _to_float(obj.get("offsetYMm")) or bounds["yMm"]
            rotation = _to_float(obj.get("rotationDeg")) or 0
            transform = f'translate({_round_mm(base_x + translate_x)} {_round_mm(base_y)}) rotate({_round_mm(rotation)})'
            return f'<path id="{obj_id}" d="{path_data}" transform="{transform}" fill="none" stroke="black" stroke-width="0.1" />'

        if kind == "image":
            return (
                f'<rect id="{obj_id}" x="{_round_mm(bounds["xMm"] + translate_x)}" y="{_round_mm(bounds["yMm"])}" '
                f'width="{_round_mm(bounds["widthMm"])}" height="{_round_mm(bounds["heightMm"])}" fill="none" stroke="black" stroke-width="0.1" />'
            )

        content = _escape_xml(str(obj.get("content", "")))
        font_family = _escape_xml(str(obj.get("fontFamily", "Arial")))
        font_size = _round_mm(_to_float(obj.get("fontSizeMm")) or 1)
        rotation = _round_mm(_to_float(obj.get("rotationDeg")) or 0)
        base_x = _to_float(obj.get("offsetXMm")) or bounds["xMm"]
        base_y = _to_float(obj.get("offsetYMm")) or bounds["yMm"]
        transform = f'translate({_round_mm(base_x + translate_x)} {_round_mm(base_y)}) rotate({rotation})'
        horizontal_align = str(obj.get("horizontalAlign", "left"))
        text_anchor = "middle" if horizontal_align == "center" else "end" if horizontal_align == "right" else "start"
        fill_mode = str(obj.get("fillMode", "fill"))
        fill = "none" if fill_mode == "stroke" else "black"
        stroke = "black" if fill_mode == "stroke" else "none"
        stroke_width = _round_mm(_to_float(obj.get("strokeWidthMm")) or 0)
        return (
            f'<text id="{obj_id}" transform="{transform}" font-family="{font_family}" font-size="{font_size}mm" '
            f'text-anchor="{text_anchor}" fill="{fill}" stroke="{stroke}" stroke-width="{stroke_width}">{content}</text>'
        )

    fragments: list[str] = []
    for obj in ordered_objects:
        base_fragment = object_svg_fragment(obj)
        if base_fragment:
            fragments.append(base_fragment)

        if wrap_enabled and overlap > 0 and wrap_width > 0:
            bounds = _to_absolute_bounds(obj)
            if bounds is not None:
                if bounds["xMm"] + bounds["widthMm"] >= wrap_width - overlap:
                    dup_left = object_svg_fragment(obj, -wrap_width)
                    if dup_left:
                        fragments.append(dup_left)
                if bounds["xMm"] <= overlap:
                    dup_right = object_svg_fragment(obj, wrap_width)
                    if dup_right:
                        fragments.append(dup_right)

    guides = ""
    if include_guides and wrap_enabled:
        guides = (
            f'<g id="guides">'
            f'<line x1="{_round_mm(seam_x)}" y1="0" x2="{_round_mm(seam_x)}" y2="{_round_mm(canvas_height)}" stroke="#ef4444" stroke-width="0.1" />'
            f'<line x1="{_round_mm(seam_x + wrap_width)}" y1="0" x2="{_round_mm(seam_x + wrap_width)}" y2="{_round_mm(canvas_height)}" stroke="#ef4444" stroke-width="0.1" />'
            f'</g>'
        )

    return (
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{_round_mm(canvas_width)}mm" height="{_round_mm(canvas_height)}mm" viewBox="0 0 {_round_mm(canvas_width)} {_round_mm(canvas_height)}">\n'
        f'  <g id="artwork">\n    {'\n    '.join(fragments)}\n  </g>\n'
        f'  {guides}\n'
        "</svg>"
    )


@router.get("/design-jobs/{id}")
def get_design_job_by_id(id: str):
    with SessionLocal() as db:
        job = db.get(DesignJob, id)
        if not job:
            raise AppError("DesignJob not found", 404, "NOT_FOUND")

        product = db.get(ProductProfile, job.productProfileId)
        machine = db.get(MachineProfile, job.machineProfileId)
        assets = db.scalars(select(Asset).where(Asset.designJobId == job.id).order_by(Asset.createdAt.asc())).all()

    return {
        "data": {
            "id": job.id,
            "orderRef": job.orderRef,
            "productProfileId": job.productProfileId,
            "machineProfileId": job.machineProfileId,
            "status": job.status,
            "placementJson": parse_placement_document(job.placementJson),
            "previewImagePath": job.previewImagePath,
            "proofImagePath": job.proofImagePath,
            "placementHash": job.placementHash,
            "templateId": job.templateId,
            "batchRunItemId": job.batchRunItemId,
            "createdAt": job.createdAt,
            "updatedAt": job.updatedAt,
            "productProfile": _serialize_product_profile(product),
            "machineProfile": _serialize_machine_profile(machine),
            "assets": [_serialize_asset(item) for item in assets],
        }
    }


@router.get("/design-jobs/{id}/proof")
def get_design_job_proof(id: str):
    with SessionLocal() as db:
        job = db.get(DesignJob, id)
        if not job:
            raise AppError("DesignJob not found", 404, "NOT_FOUND")

    return {
        "data": {
            "designJobId": job.id,
            "proofImagePath": job.proofImagePath or job.previewImagePath,
            "placementHash": job.placementHash if job.placementHash is not None else None,
        }
    }


@router.get("/design-jobs/{id}/assets")
def list_design_job_assets(id: str):
    with SessionLocal() as db:
        assets = db.scalars(select(Asset).where(Asset.designJobId == id).order_by(Asset.createdAt.asc())).all()

    return {"data": [_serialize_asset(item) for item in assets]}


@router.post("/design-jobs", dependencies=[Depends(require_api_role)], status_code=201)
async def create_design_job(request: Request):
    try:
        payload = CreateDesignJobRequest.model_validate(await request.json())
    except ValidationError as error:
        issues = json.loads(error.json())
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid request payload",
                    "issues": issues,
                }
            },
        )

    with SessionLocal() as db:
        product = db.get(ProductProfile, payload.productProfileId)
        machine = db.get(MachineProfile, payload.machineProfileId)

        if not product:
            raise AppError("Invalid productProfileId", 400, "INVALID_PRODUCT_PROFILE")
        if not machine:
            raise AppError("Invalid machineProfileId", 400, "INVALID_MACHINE_PROFILE")

        job = DesignJob(
            id=str(uuid4()),
            orderRef=payload.orderRef,
            productProfileId=payload.productProfileId,
            machineProfileId=payload.machineProfileId,
            placementJson=payload.placementJson,
            previewImagePath=payload.previewImagePath,
            proofImagePath=payload.previewImagePath,
            status="draft",
            createdAt=datetime.now(timezone.utc),
            updatedAt=datetime.now(timezone.utc),
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        product_data = _serialize_product_profile(product)
        machine_data = _serialize_machine_profile(machine)

    return {
        "data": {
            "id": job.id,
            "orderRef": job.orderRef,
            "productProfileId": job.productProfileId,
            "machineProfileId": job.machineProfileId,
            "status": job.status,
            "placementJson": parse_placement_document(job.placementJson),
            "previewImagePath": job.previewImagePath,
            "proofImagePath": job.proofImagePath,
            "placementHash": job.placementHash,
            "templateId": job.templateId,
            "batchRunItemId": job.batchRunItemId,
            "createdAt": job.createdAt,
            "updatedAt": job.updatedAt,
            "productProfile": product_data,
            "machineProfile": machine_data,
        }
    }


@router.patch("/design-jobs/{id}/placement", dependencies=[Depends(require_api_role)])
async def patch_design_job_placement_alias(id: str, request: Request):
    return await patch_design_job_placement(id, request)


@router.patch("/design-jobs/{id}", dependencies=[Depends(require_api_role)])
async def patch_design_job_placement(id: str, request: Request):
    try:
        payload = UpdatePlacementRequest.model_validate(await request.json())
    except ValidationError as error:
        issues = json.loads(error.json())
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid request payload",
                    "issues": issues,
                }
            },
        )

    with SessionLocal() as db:
        job = db.get(DesignJob, id)
        if not job:
            raise AppError("DesignJob not found", 404, "NOT_FOUND")

        job.placementJson = payload.placementJson
        db.add(job)
        db.commit()
        db.refresh(job)

        product = db.get(ProductProfile, job.productProfileId)
        machine = db.get(MachineProfile, job.machineProfileId)
        assets = db.scalars(select(Asset).where(Asset.designJobId == job.id).order_by(Asset.createdAt.asc())).all()

    return {
        "data": {
            "id": job.id,
            "orderRef": job.orderRef,
            "productProfileId": job.productProfileId,
            "machineProfileId": job.machineProfileId,
            "status": job.status,
            "placementJson": parse_placement_document(job.placementJson),
            "previewImagePath": job.previewImagePath,
            "proofImagePath": job.proofImagePath,
            "placementHash": job.placementHash,
            "templateId": job.templateId,
            "batchRunItemId": job.batchRunItemId,
            "createdAt": job.createdAt,
            "updatedAt": job.updatedAt,
            "productProfile": _serialize_product_profile(product),
            "machineProfile": _serialize_machine_profile(machine),
            "assets": [_serialize_asset(item) for item in assets],
        }
    }


@router.post("/design-jobs/{id}/preflight", dependencies=[Depends(require_api_role)])
def preflight_design_job(id: str):
    with SessionLocal() as db:
        job = db.get(DesignJob, id)
        if not job:
            raise AppError("DesignJob not found", 404, "NOT_FOUND")

        product = db.get(ProductProfile, job.productProfileId)
        if not product:
            raise AppError("ProductProfile not found", 404, "NOT_FOUND")

        assets = db.scalars(select(Asset).where(Asset.designJobId == job.id).order_by(Asset.createdAt.asc())).all()

    return {
        "data": _run_design_job_preflight(
            job=job,
            product=product,
            assets=assets,
        )
    }


@router.post("/design-jobs/{id}/export", dependencies=[Depends(require_api_role)])
def export_design_job(id: str):
    with SessionLocal() as db:
        job = db.get(DesignJob, id)
        if not job:
            raise AppError("DesignJob not found", 404, "NOT_FOUND")

        product = db.get(ProductProfile, job.productProfileId)
        machine = db.get(MachineProfile, job.machineProfileId)
        if not product or not machine:
            raise AppError("Design job dependencies not found", 404, "NOT_FOUND")

        assets = db.scalars(select(Asset).where(Asset.designJobId == job.id).order_by(Asset.createdAt.asc())).all()
        preflight = _run_design_job_preflight(job=job, product=product, assets=assets)

        if preflight.get("status") == "fail":
            raise AppError("Preflight failed", 422, "PREFLIGHT_FAILED", preflight)

        manifest = _build_export_manifest(job=job, product=product, machine=machine, preflight=preflight)
        svg = _build_export_svg(job=job, product=product)

        now = datetime.now(timezone.utc)
        db.add(
            ExportArtifact(
                id=str(uuid4()),
                designJobId=job.id,
                kind="manifest",
                version="1.0",
                preflightStatus=preflight.get("status", "fail"),
                payloadJson=manifest,
                textContent=None,
                createdAt=now,
            )
        )
        db.add(
            ExportArtifact(
                id=str(uuid4()),
                designJobId=job.id,
                kind="svg",
                version="1.0",
                preflightStatus=preflight.get("status", "fail"),
                payloadJson=None,
                textContent=svg,
                createdAt=now,
            )
        )
        db.commit()

    return {
        "data": {
            "manifest": manifest,
            "svg": svg,
            "metadata": {
                "preflightStatus": preflight.get("status", "fail"),
                "issueCount": len(preflight.get("issues", [])),
            },
        }
    }


@router.post("/design-jobs/{id}/export/svg", dependencies=[Depends(require_api_role)])
def export_design_job_svg(id: str, request: Request):
    with SessionLocal() as db:
        job = db.get(DesignJob, id)
        if not job:
            raise AppError("DesignJob not found", 404, "NOT_FOUND")

    include_guides = request.query_params.get("guides") == "1"
    svg = _build_export_svg_route_svg(job, include_guides=include_guides)
    return Response(
        content=svg,
        status_code=200,
        media_type="image/svg+xml; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="job-{id}.svg"',
        },
    )
