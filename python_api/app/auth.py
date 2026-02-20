from fastapi import Header
from .config import settings, is_auth_required
from .errors import AppError

def require_api_role(
    x_api_key: str | None = Header(default=None),
    x_actor_role: str | None = Header(default=None),
) -> None:
    if not is_auth_required():
        return

    expected_api_key = settings.api_key
    if expected_api_key:
        if x_api_key != expected_api_key:
            raise AppError("Forbidden", 403, "FORBIDDEN")

    if not x_actor_role or x_actor_role not in ("admin", "operator"):
        raise AppError("Forbidden", 403, "FORBIDDEN")
