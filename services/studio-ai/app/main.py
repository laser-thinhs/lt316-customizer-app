from __future__ import annotations

import json

from fastapi import FastAPI, HTTPException, Request

from .models import ProposeRequest
from .proposer import propose_layout

MAX_BODY_BYTES = 64_000

app = FastAPI(title="studio-ai", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/layout/propose")
async def propose(request: Request) -> dict:
    raw = await request.body()
    if len(raw) > MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail="payload too large")

    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="invalid json") from exc

    try:
        parsed = ProposeRequest.model_validate(payload)
        response = propose_layout(parsed.layout, parsed.instruction)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return response.model_dump()
