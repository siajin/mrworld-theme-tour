from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.deps import DbDep
from app.models import Theme
from app.schemas.theme import ThemeOut
from app.services.presenters import theme_out

router = APIRouter(prefix="/themes", tags=["themes"])


@router.get("", response_model=list[ThemeOut])
def list_themes(db: DbDep) -> list[ThemeOut]:
    themes = db.scalars(select(Theme).where(Theme.is_active.is_(True)).order_by(Theme.sort_order, Theme.id)).all()
    return [theme_out(t, db, with_stats=True) for t in themes]


@router.get("/{slug}", response_model=ThemeOut)
def get_theme(slug: str, db: DbDep) -> ThemeOut:
    theme = db.scalar(select(Theme).where(Theme.slug == slug, Theme.is_active.is_(True)))
    if theme is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "테마를 찾을 수 없어요")
    return theme_out(theme, db, with_stats=True)
