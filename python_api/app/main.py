from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from .auth import require_api_role
from .errors import AppError
from .routes.design_jobs import router as design_jobs_router
from .routes.health import router as health_router
from .routes.product_profiles import router as product_profiles_router

app = FastAPI(title="LT316 Python API", version="0.1.0")


@app.exception_handler(AppError)
async def app_error_handler(_, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "message": exc.message,
                "code": exc.code,
                "details": exc.details,
            }
        },
    )


app.include_router(health_router)
app.include_router(product_profiles_router)
app.include_router(design_jobs_router)


@app.get("/api/protected/ping", dependencies=[Depends(require_api_role)])
def protected_ping():
    return {"data": {"ok": True}}
