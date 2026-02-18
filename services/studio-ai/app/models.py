from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

BlockType = Literal["text", "image", "cylinder"]


class TextProps(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    align: Literal["left", "center", "right"] = "left"


class ImageProps(BaseModel):
    src: str = ""
    alt: str = Field(default="", max_length=200)


class CylinderProps(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    diameterMm: float = Field(ge=10, le=1000)
    heightMm: float = Field(ge=10, le=1000)


class Block(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=80)
    type: BlockType
    props: dict[str, Any]

    @model_validator(mode="after")
    def validate_props(self) -> "Block":
        if self.type == "text":
            TextProps.model_validate(self.props)
        elif self.type == "image":
            ImageProps.model_validate(self.props)
        elif self.type == "cylinder":
            CylinderProps.model_validate(self.props)
        return self


class Layout(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=120)
    blocks: list[Block] = Field(max_length=100)


class ProposeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    layout: Layout
    instruction: str = Field(min_length=1, max_length=800)
    context: dict[str, Any] | None = None

    @field_validator("context")
    @classmethod
    def limit_context(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        if value is None:
            return value
        if len(value) > 50:
            raise ValueError("context too large")
        return value


class JsonPatchOp(BaseModel):
    model_config = ConfigDict(extra="forbid")

    op: Literal["add", "remove", "replace", "move"]
    path: str
    value: Any | None = None


class ProposeResponse(BaseModel):
    proposal_id: str
    next_layout: Layout
    json_patch: list[JsonPatchOp] | None = None
    summary: str
    warnings: list[str]
