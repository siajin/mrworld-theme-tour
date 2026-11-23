from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.core.deps import DbDep, StaffUser
from app.models import InventoryItem, Package, Theme, ThemePerk
from app.schemas.theme import ThemeIn, ThemeOut, ThemeReorderIn
from app.services.presenters import theme_out

router = APIRouter(prefix="/staff/themes", tags=["staff:themes"])


def _get(db: DbDep, theme_id: int) -> Theme:
    theme = db.get(Theme, theme_id)
    if theme is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "테마를 찾을 수 없어요")
    return theme


def _apply(db: DbDep, theme: Theme, payload: ThemeIn) -> None:
    dup = db.scalar(select(Theme).where(Theme.slug == payload.slug, Theme.id != (theme.id or 0)))
    if dup is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "이미 사용 중인 슬러그예요")
    for key in ("slug", "name", "tagline", "description", "icon", "hero_image", "min_style_rank", "min_travelers", "vehicle_label", "default_transport", "is_active"):
        setattr(theme, key, getattr(payload, key))
    for p in payload.perks:
        if p.inventory_item_id is not None and db.get(InventoryItem, p.inventory_item_id) is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"창고 물품 {p.inventory_item_id} 을 찾을 수 없어요")
    theme.perks = [
        ThemePerk(label=p.label, inventory_item_id=p.inventory_item_id, qty_per_booking=p.qty_per_booking, per_person=p.per_person)
        for p in payload.perks
    ]


@router.get("", response_model=list[ThemeOut])
def list_themes(db: DbDep, _: StaffUser) -> list[ThemeOut]:
    themes = db.scalars(select(Theme).order_by(Theme.sort_order, Theme.id)).all()
    return [theme_out(t, db, with_stats=True) for t in themes]


@router.post("", response_model=ThemeOut, status_code=status.HTTP_201_CREATED)
def create_theme(payload: ThemeIn, db: DbDep, _: StaffUser) -> ThemeOut:
    theme = Theme()
    _apply(db, theme, payload)
    theme.sort_order = (db.scalar(select(func.max(Theme.sort_order))) or 0) + 1
    db.add(theme)
    db.commit()
    db.refresh(theme)
    return theme_out(theme, db, with_stats=True)


@router.put("/reorder", response_model=list[ThemeOut])
def reorder(payload: ThemeReorderIn, db: DbDep, _: StaffUser) -> list[ThemeOut]:
    for order, theme_id in enumerate(payload.ids, start=1):
        _get(db, theme_id).sort_order = order
    db.commit()
    themes = db.scalars(select(Theme).order_by(Theme.sort_order, Theme.id)).all()
    return [theme_out(t, db, with_stats=True) for t in themes]


@router.put("/{theme_id}", response_model=ThemeOut)
def update_theme(theme_id: int, payload: ThemeIn, db: DbDep, _: StaffUser) -> ThemeOut:
    theme = _get(db, theme_id)
    _apply(db, theme, payload)
    db.commit()
    db.refresh(theme)
    return theme_out(theme, db, with_stats=True)


@router.delete("/{theme_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_theme(theme_id: int, db: DbDep, _: StaffUser) -> None:
    theme = _get(db, theme_id)
    if db.scalar(select(func.count(Package.id)).where(Package.theme_id == theme.id)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "이 테마에 속한 상품이 있어 삭제할 수 없어요. 대신 비활성화해 주세요")
    db.delete(theme)
    db.commit()
