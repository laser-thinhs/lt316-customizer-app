from fastapi import APIRouter
from sqlalchemy import select
from ..db import SessionLocal
from ..models import ProductProfile
from ..errors import AppError

router = APIRouter(prefix="/api", tags=["product-profiles"])


@router.get("/product-profiles")
def list_product_profiles():
    with SessionLocal() as db:
        rows = db.scalars(select(ProductProfile).order_by(ProductProfile.createdAt.desc())).all()

    data = [
        {
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
        for row in rows
    ]

    return {"data": data}


@router.get("/product-profiles/{id}")
def get_product_profile_by_id(id: str):
    with SessionLocal() as db:
        row = db.get(ProductProfile, id)

    if not row:
        raise AppError("ProductProfile not found", 404, "NOT_FOUND")

    return {
        "data": {
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
    }
