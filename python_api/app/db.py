from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .config import settings


def _sqlalchemy_database_url(raw: str) -> str:
    parsed = urlparse(raw)

    scheme = parsed.scheme
    if scheme == "postgresql":
        scheme = "postgresql+psycopg"

    query_pairs = [(key, value) for key, value in parse_qsl(parsed.query, keep_blank_values=True) if key.lower() != "schema"]

    normalized = parsed._replace(scheme=scheme, query=urlencode(query_pairs))
    return urlunparse(normalized)


engine = create_engine(_sqlalchemy_database_url(settings.database_url), pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
