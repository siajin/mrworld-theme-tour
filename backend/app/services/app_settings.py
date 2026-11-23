"""settings 테이블(key/value) 읽기·쓰기.

클래스
- SettingsStore: 설정 키/값 저장소. 문자열로 저장하고 AppSettings 로 형변환해 돌려준다. 기본값(DEFAULTS)을 보장한다.
기존 모듈 함수(load_settings, update_settings, ensure_defaults)는 호환용 얇은 래퍼다.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Setting
from app.schemas.catalog import AppSettings, AppSettingsUpdate

DEFAULTS: dict[str, str] = {
    "min_travelers_default": "3",
    "loyalty_silver_trips": "3",
    "loyalty_silver_rate": "0.05",
    "loyalty_gold_trips": "5",
    "loyalty_gold_rate": "0.10",
    "deposit_rate": "0.1",
}


class SettingsStore:
    """설정 키/값 저장소 (세션을 생성자로 받는다)."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def load(self) -> AppSettings:
        """DB 값 위에 기본값을 겹쳐 AppSettings 로 변환한다."""
        rows = {s.key: s.value for s in self.db.scalars(select(Setting)).all()}
        merged = {**DEFAULTS, **rows}
        return AppSettings(
            min_travelers_default=int(merged["min_travelers_default"]),
            loyalty_silver_trips=int(merged["loyalty_silver_trips"]),
            loyalty_silver_rate=float(merged["loyalty_silver_rate"]),
            loyalty_gold_trips=int(merged["loyalty_gold_trips"]),
            loyalty_gold_rate=float(merged["loyalty_gold_rate"]),
            deposit_rate=float(merged["deposit_rate"]),
        )

    def update(self, patch: AppSettingsUpdate) -> AppSettings:
        """None 이 아닌 값만 갱신하고 커밋한 뒤 전체 설정을 돌려준다."""
        for key, value in patch.model_dump(exclude_none=True).items():
            row = self.db.get(Setting, key)
            if row is None:
                self.db.add(Setting(key=key, value=str(value)))
            else:
                row.value = str(value)
        self.db.commit()
        return self.load()

    def ensure_defaults(self) -> None:
        """없는 키를 기본값으로 채운다 (앱 시작·시드 시)."""
        for key, value in DEFAULTS.items():
            if self.db.get(Setting, key) is None:
                self.db.add(Setting(key=key, value=value))
        self.db.commit()


# ---------- 호환 래퍼

def load_settings(db: Session) -> AppSettings:
    return SettingsStore(db).load()


def update_settings(db: Session, patch: AppSettingsUpdate) -> AppSettings:
    return SettingsStore(db).update(patch)


def ensure_defaults(db: Session) -> None:
    SettingsStore(db).ensure_defaults()
