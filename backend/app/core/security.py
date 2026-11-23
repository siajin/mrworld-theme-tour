from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

# bcrypt alone ignores bytes after the first 72. Signup accepts up to 128
# characters, so hash the complete password with bcrypt_sha256 for new accounts.
# Keep bcrypt verification for existing seeded/local accounts.
pwd_context = CryptContext(schemes=["bcrypt_sha256", "bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_token(subject: int, token_type: str, expires: timedelta) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + expires).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: int) -> str:
    return _create_token(user_id, "access", timedelta(minutes=get_settings().access_token_expire_minutes))


def create_refresh_token(user_id: int) -> str:
    return _create_token(user_id, "refresh", timedelta(days=get_settings().refresh_token_expire_days))


def decode_token(token: str, expected_type: str) -> int | None:
    """토큰을 검증하고 user_id를 돌려준다. 실패하면 None."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
    if payload.get("type") != expected_type:
        return None
    try:
        return int(payload["sub"])
    except (KeyError, ValueError):
        return None
