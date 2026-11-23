"""Alembic / create_all 에서 모든 모델을 한 번에 불러오기 위한 모듈."""
import logging

from alembic import command
from alembic.config import Config
from sqlalchemy import Engine

from app.core.config import BASE_DIR
from app.models import (  # noqa: F401 — 모델 모듈을 모두 import 해 metadata 에 등록
    Base,
    booking,
    inventory,
    meal_addon,
    notification,
    package,
    setting,
    theme,
    user,
)

logger = logging.getLogger("mrworld.db")

__all__ = ["Base", "create_schema"]


def create_schema(engine: Engine) -> None:
    """alembic 없이도 뜨도록 테이블을 만들고, 이후 `alembic upgrade head` 와 충돌하지 않게 head 로 stamp 한다."""
    Base.metadata.create_all(bind=engine)
    try:
        cfg = Config(str(BASE_DIR / "alembic.ini"))
        cfg.set_main_option("script_location", str(BASE_DIR / "alembic"))
        cfg.set_main_option("sqlalchemy.url", str(engine.url.render_as_string(hide_password=False)))
        command.stamp(cfg, "head")
    except Exception as exc:  # noqa: BLE001 — stamp 실패는 서비스 기동을 막지 않는다
        logger.warning("alembic stamp 를 건너뜁니다: %s", exc)
