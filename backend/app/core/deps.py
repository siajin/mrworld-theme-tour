from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models import User

bearer = HTTPBearer(auto_error=False)

DbDep = Annotated[Session, Depends(get_db)]


def _user_from_credentials(db: Session, credentials: HTTPAuthorizationCredentials | None) -> User | None:
    if credentials is None:
        return None
    user_id = decode_token(credentials.credentials, "access")
    if user_id is None:
        return None
    return db.get(User, user_id)


def get_optional_user(
    db: DbDep, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]
) -> User | None:
    """비로그인 허용 엔드포인트(견적 등). 토큰이 잘못돼도 401 대신 익명으로 처리."""
    return _user_from_credentials(db, credentials)


def get_current_user(
    db: DbDep, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]
) -> User:
    user = _user_from_credentials(db, credentials)
    if user is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "로그인이 필요해요", headers={"WWW-Authenticate": "Bearer"}
        )
    return user


def require_staff(user: Annotated[User, Depends(get_current_user)]) -> User:
    if not user.is_staff:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "직원만 사용할 수 있는 기능이에요")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]
StaffUser = Annotated[User, Depends(require_staff)]
