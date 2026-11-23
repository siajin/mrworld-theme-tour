from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.deps import DbDep, StaffUser
from app.models import InventoryItem, InventoryMove
from app.schemas.inventory import InventoryItemIn, InventoryItemOut, InventoryMoveIn, InventoryMoveOut
from app.services.inventory import InventoryService
from app.services.presenters import inventory_item_out, inventory_move_out

router = APIRouter(prefix="/staff/inventory", tags=["staff:inventory"])


def _get(db: DbDep, item_id: int) -> InventoryItem:
    item = db.get(InventoryItem, item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "물품을 찾을 수 없어요")
    return item


@router.get("/items", response_model=list[InventoryItemOut])
def list_items(db: DbDep, _: StaffUser) -> list[InventoryItemOut]:
    return [inventory_item_out(i) for i in db.scalars(select(InventoryItem).order_by(InventoryItem.id)).all()]


@router.post("/items", response_model=list[InventoryItemOut], status_code=status.HTTP_201_CREATED)
def create_item(payload: InventoryItemIn, db: DbDep, staff: StaffUser) -> list[InventoryItemOut]:
    if db.scalar(select(InventoryItem).where(InventoryItem.sku == payload.sku)) is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "이미 등록된 SKU 예요")
    item = InventoryItem(**payload.model_dump())
    db.add(item)
    db.flush()
    if item.stock_qty > 0:
        db.add(InventoryMove(item_id=item.id, type="in", qty=item.stock_qty, memo="신규 등록 초기 재고", created_by=staff.id))
    db.commit()
    return [inventory_item_out(i) for i in db.scalars(select(InventoryItem).order_by(InventoryItem.id)).all()]


@router.put("/items/{item_id}", response_model=InventoryItemOut)
def update_item(item_id: int, payload: InventoryItemIn, db: DbDep, _: StaffUser) -> InventoryItemOut:
    item = _get(db, item_id)
    dup = db.scalar(select(InventoryItem).where(InventoryItem.sku == payload.sku, InventoryItem.id != item.id))
    if dup is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "이미 등록된 SKU 예요")
    # 재고 수량은 입출고 이력으로만 바꾼다 (PUT 에서는 무시)
    for key in ("sku", "name", "category", "unit", "reorder_level", "is_active"):
        setattr(item, key, getattr(payload, key))
    db.commit()
    db.refresh(item)
    return inventory_item_out(item)


@router.post("/items/{item_id}/moves", response_model=InventoryItemOut)
def create_move(item_id: int, payload: InventoryMoveIn, db: DbDep, staff: StaffUser) -> InventoryItemOut:
    item = _get(db, item_id)
    InventoryService(db).move(item, payload.type, payload.qty, payload.memo, staff.id)
    db.commit()
    db.refresh(item)
    return inventory_item_out(item)


@router.get("/moves", response_model=list[InventoryMoveOut])
def list_moves(db: DbDep, _: StaffUser, item_id: int | None = None) -> list[InventoryMoveOut]:
    stmt = select(InventoryMove).order_by(InventoryMove.created_at.desc(), InventoryMove.id.desc())
    if item_id is not None:
        stmt = stmt.where(InventoryMove.item_id == item_id)
    return [inventory_move_out(m) for m in db.scalars(stmt.limit(500)).all()]
