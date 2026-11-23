from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ 디렉터리 (app/core/config.py 기준 두 단계 위)
BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "mrworld-api"
    database_url: str = f"sqlite:///{(BASE_DIR / 'data' / 'app.db').as_posix()}"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    media_dir: str = (BASE_DIR / "media").as_posix()

    # 문자: console(기록만) | solapi(CoolSMS). solapi 는 키 3개가 모두 있어야 실제 발송한다.
    sms_provider: str = "console"
    solapi_api_key: str = ""
    solapi_api_secret: str = ""
    sms_from: str = ""  # Solapi 콘솔에 등록한 발신번호 (예: 01012345678)
    ai_provider: str = "rules"  # rules | openai | anthropic
    ai_api_key: str = ""
    ai_model: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
