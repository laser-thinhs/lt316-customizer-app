import json
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
from sqlalchemy import select
from ..auth import require_api_role
from ..db import SessionLocal
from ..errors import AppError
from ..models import Asset, DesignJob, MachineProfile, ProductProfile
from ..placement import parse_placement_document

router = APIRouter(prefix="/api", tags=["design-jobs"])


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
        "originalName": row.originalName,
        "mimeType": row.mimeType,
        "byteSize": row.byteSize,
        "filePath": row.filePath,
        "widthPx": row.widthPx,
        "heightPx": row.heightPx,
        "createdAt": row.createdAt,
    }


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
