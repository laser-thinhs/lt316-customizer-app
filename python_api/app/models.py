from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, DateTime, Numeric, JSON, Enum


class Base(DeclarativeBase):
    pass


class ProductProfile(Base):
    __tablename__ = "ProductProfile"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    sku: Mapped[str] = mapped_column(String)
    diameterMm: Mapped[float] = mapped_column(Numeric(10, 3))
    heightMm: Mapped[float] = mapped_column(Numeric(10, 3))
    engraveZoneWidthMm: Mapped[float] = mapped_column(Numeric(10, 3))
    engraveZoneHeightMm: Mapped[float] = mapped_column(Numeric(10, 3))
    seamReference: Mapped[str] = mapped_column(String)
    toolOutlineSvgPath: Mapped[str] = mapped_column(String)
    defaultSettingsProfile: Mapped[dict] = mapped_column(JSON)
    createdAt: Mapped[DateTime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[DateTime] = mapped_column(DateTime(timezone=True))


class MachineProfile(Base):
    __tablename__ = "MachineProfile"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    laserType: Mapped[str] = mapped_column(String)
    lens: Mapped[str] = mapped_column(String)
    rotaryModeDefault: Mapped[str] = mapped_column(String)
    powerDefault: Mapped[float] = mapped_column(Numeric(10, 3))
    speedDefault: Mapped[float] = mapped_column(Numeric(10, 3))
    frequencyDefault: Mapped[float] = mapped_column(Numeric(10, 3))
    createdAt: Mapped[DateTime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[DateTime] = mapped_column(DateTime(timezone=True))


class DesignJob(Base):
    __tablename__ = "DesignJob"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    orderRef: Mapped[str | None] = mapped_column(String)
    productProfileId: Mapped[str] = mapped_column(String)
    machineProfileId: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(Enum("draft", "approved", "exported", "failed", name="DesignJobStatus"))
    placementJson: Mapped[dict] = mapped_column(JSON)
    previewImagePath: Mapped[str | None] = mapped_column(String)
    proofImagePath: Mapped[str | None] = mapped_column(String)
    placementHash: Mapped[str | None] = mapped_column(String)
    templateId: Mapped[str | None] = mapped_column(String)
    batchRunItemId: Mapped[str | None] = mapped_column(String)
    createdAt: Mapped[DateTime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[DateTime] = mapped_column(DateTime(timezone=True))


class Asset(Base):
    __tablename__ = "Asset"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    designJobId: Mapped[str] = mapped_column(String)
    kind: Mapped[str] = mapped_column(String)
    originalName: Mapped[str | None] = mapped_column(String)
    mimeType: Mapped[str] = mapped_column(String)
    byteSize: Mapped[int | None] = mapped_column()
    filePath: Mapped[str] = mapped_column(String)
    widthPx: Mapped[int | None] = mapped_column()
    heightPx: Mapped[int | None] = mapped_column()
    createdAt: Mapped[DateTime] = mapped_column(DateTime(timezone=True))


class ExportArtifact(Base):
    __tablename__ = "ExportArtifact"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    designJobId: Mapped[str] = mapped_column(String)
    kind: Mapped[str] = mapped_column(Enum("manifest", "svg", name="ExportArtifactKind"))
    version: Mapped[str] = mapped_column(String)
    preflightStatus: Mapped[str] = mapped_column(Enum("pass", "warn", "fail", name="ExportPreflightStatus"))
    payloadJson: Mapped[dict | None] = mapped_column(JSON)
    textContent: Mapped[str | None] = mapped_column(String)
    createdAt: Mapped[DateTime] = mapped_column(DateTime(timezone=True))
