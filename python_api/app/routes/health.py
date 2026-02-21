from fastapi import APIRouter
from sqlalchemy import text
from ..config import settings
from ..db import SessionLocal
from ..errors import AppError

router = APIRouter(prefix="/api", tags=["health"])


def assert_database_url() -> None:
    if not settings.database_url:
        raise AppError("Database configuration missing. Set DATABASE_URL.", 500, "DATABASE_URL_MISSING")


def assert_database_connectivity() -> None:
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception as error:
        raise AppError(
            "Database connectivity check failed. Verify DATABASE_URL points to a reachable database.",
            503,
            "DATABASE_CONNECTIVITY_ERROR",
            {"reason": str(error)},
        )


@router.get("/health")
def get_health():
    assert_database_url()
    assert_database_connectivity()
    return {"data": {"status": "ok", "checks": {"app": "ok", "database": "ok"}}}
