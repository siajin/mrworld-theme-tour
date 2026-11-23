from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.deps import DbDep
from app.core.security import create_access_token, create_refresh_token, decode_token, hash_password, verify_password
from app.models import User
from app.schemas.user import AuthOut, LoginIn, RefreshIn, SignupIn, TokenPair
from app.services.presenters import user_out

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue(db: DbDep, user: User) -> AuthOut:
    return AuthOut(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user=user_out(user, db),
    )


@router.post("/signup", response_model=AuthOut, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupIn, db: DbDep) -> AuthOut:
    email = payload.email.lower()
    if db.scalar(select(User).where(User.email == email)) is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "이미 가입된 이메일이에요")
    # 가입은 항상 고객. 직원 계정은 시드/직원 화면에서만 만든다.
    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        role="customer",
        name=payload.name,
        phone=payload.phone,
        address=payload.address,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _issue(db, user)


@router.post("/login", response_model=AuthOut)
def login(payload: LoginIn, db: DbDep) -> AuthOut:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "이메일 또는 비밀번호가 올바르지 않아요")
    return _issue(db, user)


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshIn, db: DbDep) -> TokenPair:
    user_id = decode_token(payload.refresh_token, "refresh")
    user = db.get(User, user_id) if user_id is not None else None
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "다시 로그인해 주세요")
    return TokenPair(access_token=create_access_token(user.id), refresh_token=create_refresh_token(user.id))
