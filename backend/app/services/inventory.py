"""기본 제공 재고의 검사·차감·복원과 수동 입출고. 커밋은 호출자가 한다."""
from collections import defaultdict

from fastapi import HTTPException, status
from sqlalchemy import case, func, select, update
from sqlalchemy.orm import Session

from app.models import Booking, InventoryItem, InventoryMove, Theme
from app.services.notification import NotificationService


class InventoryService:
    """조건부 UPDATE와 예약별 입출고 순수량으로 음수·중복 차감을 방지한다."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def move(self, item: InventoryItem, move_type: str, qty: int, memo: str = "", by: int | None = None) -> InventoryMove:
        if move_type not in ("in", "out", "adjust") or (move_type in ("in", "out") and qty < 1):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "입출고 종류와 수량을 확인해 주세요")
        delta = -qty if move_type == "out" else qty
        result = self.db.execute(update(InventoryItem).where(
            InventoryItem.id == item.id, InventoryItem.stock_qty + delta >= 0
        ).values(stock_qty=InventoryItem.stock_qty + delta).execution_options(synchronize_session=False))
        if result.rowcount != 1:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "재고가 부족해요. 현재 수량을 확인해 주세요")
        self.db.refresh(item)
        row = InventoryMove(item_id=item.id, type=move_type, qty=qty, memo=memo, created_by=by)
        self.db.add(row)
        return row

    def _requirements(self, perks: list[dict], count: int) -> dict[int, int]:
        totals: dict[int, int] = defaultdict(int)
        for perk in perks:
            if perk["inventory_item_id"] is not None:
                totals[perk["inventory_item_id"]] += perk["qty_per_booking"] * (count if perk["per_person"] else 1)
        return dict(totals)

    def _allocated(self, booking: Booking) -> dict[int, int]:
        self.db.flush()
        rows = self.db.execute(select(InventoryMove.item_id, func.sum(case(
            (InventoryMove.type == "out", InventoryMove.qty),
            (InventoryMove.type == "in", -InventoryMove.qty), else_=0,
        ))).where(InventoryMove.ref_booking_id == booking.id).group_by(InventoryMove.item_id)).all()
        return {item_id: max(0, qty) for item_id, qty in rows}

    def check_theme_perks(self, theme: Theme, count: int, booking: Booking | None = None) -> None:
        perks = booking.included_perks if booking else theme.perk_snapshot()
        allocated = self._allocated(booking) if booking else {}
        for item_id, requested in sorted(self._requirements(perks, count).items()):
            needed = requested - allocated.get(item_id, 0)
            if needed <= 0:
                continue
            item = self.db.get(InventoryItem, item_id, populate_existing=True)
            if item is None or not item.is_active:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "기본 제공 물품을 사용할 수 없어 예약할 수 없어요")
            if item.stock_qty < needed:
                raise HTTPException(status.HTTP_400_BAD_REQUEST,
                                    f"기본 제공 물품 '{item.name}' 재고가 부족해요 (추가 필요 {needed}{item.unit}, 현재 {item.stock_qty}{item.unit})")

    def _sync(self, booking: Booking, required: dict[int, int]) -> None:
        allocated = self._allocated(booking)
        # 일부 물품만 차감한 상태로 남지 않도록 전 품목을 하나의 저장점으로 처리한다.
        with self.db.begin_nested():
            for item_id in sorted(set(required) | set(allocated)):
                delta = required.get(item_id, 0) - allocated.get(item_id, 0)
                if delta == 0:
                    continue
                stmt = update(InventoryItem).where(InventoryItem.id == item_id)
                if delta > 0:
                    stmt = stmt.where(InventoryItem.is_active.is_(True), InventoryItem.stock_qty >= delta)
                result = self.db.execute(stmt.values(stock_qty=InventoryItem.stock_qty - delta).execution_options(synchronize_session=False))
                if result.rowcount != 1:
                    item = self.db.get(InventoryItem, item_id, populate_existing=True)
                    label = item.name if item else "삭제된 물품"
                    raise HTTPException(status.HTTP_400_BAD_REQUEST, f"기본 제공 물품 '{label}' 재고가 부족하거나 사용할 수 없어 예약을 진행할 수 없어요")
                self.db.add(InventoryMove(item_id=item_id, type="out" if delta > 0 else "in", qty=abs(delta),
                                          ref_booking_id=booking.id, memo="기본 제공 재고 차감" if delta > 0 else "기본 제공 재고 복원"))
            self.db.flush()
        self.db.expire_all()

    def reserve_theme_perks(self, booking: Booking, theme: Theme, notifier: NotificationService) -> None:
        """결제·직원 확정·유료 예약 인원 변경 시 아직 차감하지 않은 차이만 반영한다."""
        self._sync(booking, self._requirements(booking.included_perks, booking.travelers_count))

    def release_theme_perks(self, booking: Booking) -> None:
        """취소 시 이 예약에서 실제 차감한 순수량만 되돌린다."""
        self._sync(booking, {})


def apply_move(db: Session, item: InventoryItem, move_type: str, qty: int, memo: str = "", created_by: int | None = None) -> InventoryMove:
    return InventoryService(db).move(item, move_type, qty, memo, created_by)


def reserve_theme_perks(db: Session, booking: Booking, theme: Theme, notifier: NotificationService) -> None:
    InventoryService(db).reserve_theme_perks(booking, theme, notifier)
