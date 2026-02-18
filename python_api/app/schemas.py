from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class HealthChecks(BaseModel):
    app: str
    database: str


class HealthPayload(BaseModel):
    status: str
    checks: HealthChecks


class ApiSuccess(BaseModel):
    data: object


class ApiErrorBody(BaseModel):
    message: str
    code: str
    details: object | None = None


class ApiError(BaseModel):
    error: ApiErrorBody


class ProductProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    sku: str
    diameterMm: Decimal
    heightMm: Decimal
    engraveZoneWidthMm: Decimal
    engraveZoneHeightMm: Decimal
    seamReference: str
    toolOutlineSvgPath: str
    defaultSettingsProfile: dict
    createdAt: datetime
    updatedAt: datetime
