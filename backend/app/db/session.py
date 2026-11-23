from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()


def _normalize_db_url(url: str) -> str:
    """Neon/Vercel Postgres 는 postgres:// 또는 postgresql:// 로 URL 을 주는데,
    SQLAlchemy 가 psycopg(v3) 드라이버를 쓰게 하려면 postgresql+psycopg:// 가 필요하다."""
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


db_url = _normalize_db_url(settings.database_url)

connect_args: dict = {}
if db_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False
    db_path = db_url.replace("sqlite:///", "", 1)
    if db_path and db_path != ":memory:":
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(db_url, connect_args=connect_args, future=True)

if db_url.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, _record) -> None:  # noqa: ANN001
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False, future=True)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
