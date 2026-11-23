from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, TimestampMixin


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(50), default="", nullable=False)
    unit: Mapped[str] = mapped_column(String(20), default="개", nullable=False)
    stock_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reorder_level: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    moves: Mapped[list["InventoryMove"]] = relationship(back_populates="item", cascade="all, delete-orphan")

    @property
    def low_stock(self) -> bool:
        return self.stock_qty <= self.reorder_level


class InventoryMove(Base, TimestampMixin):
    __tablename__ = "inventory_moves"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(10), nullable=False)  # in | out | adjust
    qty: Mapped[int] = mapped_column(Integer, nullable=False)
    ref_booking_id: Mapped[int | None] = mapped_column(ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True)
    memo: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    item: Mapped[InventoryItem] = relationship(back_populates="moves")
    creator: Mapped["User | None"] = relationship()  # noqa: F821
