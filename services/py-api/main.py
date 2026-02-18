import base64
import io
import imghdr
import logging
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from PIL import Image

app = FastAPI(title="LT316 Python Trace Service")
logger = logging.getLogger("py-api")


@app.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


def _embed_image_svg(image_bytes: bytes, mime_type: str, width: int, height: int) -> str:
    encoded = base64.b64encode(image_bytes).decode("ascii")
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}">'
        f'<image href="data:{mime_type};base64,{encoded}" width="{width}" height="{height}"/>'
        "</svg>"
    )


def _detect_mime(image_bytes: bytes) -> str:
    kind = imghdr.what(None, image_bytes)
    if kind == "png":
        return "image/png"
    if kind in {"jpeg", "jpg"}:
        return "image/jpeg"
    return "application/octet-stream"


def _trace_with_vtracer(image_bytes: bytes, mode: str, simplify: Optional[float]) -> Optional[str]:
    try:
        import vtracer  # type: ignore
    except Exception as exc:  # pragma: no cover - runtime fallback
        logger.warning("vtracer unavailable, using embed fallback: %s", exc)
        return None

    kwargs = {
        "mode": "spline" if mode == "trace" else "pixel",
    }
    if simplify is not None:
        kwargs["corner_threshold"] = max(0.0, min(180.0, float(simplify) * 100.0))

    try:
        if hasattr(vtracer, "convert_raw_image_to_svg"):
            return vtracer.convert_raw_image_to_svg(image_bytes, **kwargs)
        if hasattr(vtracer, "convert_image_to_svg_py"):
            with io.BytesIO(image_bytes) as input_buffer:
                return vtracer.convert_image_to_svg_py(input_buffer, **kwargs)
    except Exception as exc:  # pragma: no cover - runtime fallback
        logger.warning("vtracer failed, using embed fallback: %s", exc)
        return None

    logger.warning("No supported vtracer entrypoint found, using embed fallback")
    return None


@app.post("/trace")
async def trace(
    file: UploadFile = File(...),
    mode: Optional[str] = Form(default=None),
    simplify: Optional[float] = Form(default=None),
    mode_q: Optional[str] = Query(default=None, alias="mode"),
    simplify_q: Optional[float] = Query(default=None, alias="simplify"),
) -> Response:
    resolved_mode = mode or mode_q or "trace"
    resolved_simplify = simplify if simplify is not None else simplify_q

    if resolved_mode not in {"trace", "embed"}:
        raise HTTPException(status_code=400, detail="mode must be 'trace' or 'embed'")

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="file is empty")

    try:
        image = Image.open(io.BytesIO(image_bytes))
        width, height = image.size
    except Exception as exc:
        raise HTTPException(status_code=400, detail="invalid image") from exc

    mime_type = _detect_mime(image_bytes)
    if mime_type not in {"image/png", "image/jpeg"}:
        raise HTTPException(status_code=400, detail="file must be PNG or JPG")

    svg_text: Optional[str] = None
    if resolved_mode == "trace":
        svg_text = _trace_with_vtracer(image_bytes, resolved_mode, resolved_simplify)

    if not svg_text:
        svg_text = _embed_image_svg(image_bytes, mime_type, width, height)

    return Response(content=svg_text, media_type="image/svg+xml")
