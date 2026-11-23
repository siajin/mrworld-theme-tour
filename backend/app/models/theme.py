from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base
from app.services.pricing import Style, min_style_for_theme


class Theme(Base):
    """여행 테마. 허용 스타일 하한(min_style_rank)과 확정 최소 인원(min_travelers) 규칙을 가진다."""

    __tablename__ = "themes"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    tagline: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    icon: Mapped[str] = mapped_column(String(50), default="", nullable=False)  # lucide 아이콘명
    hero_image: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    # 선택 가능한 최소 스타일 등급(1=classic, 2=grand, 3=premium)
    min_style_rank: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    # 예약 1건(대표자+동행)이 확정되기 위한 최소 인원
    min_travelers: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    vehicle_label: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    default_transport: Mapped[str] = mapped_column(String(30), default="van_10", nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    perks: Mapped[list["ThemePerk"]] = relationship(
        back_populates="theme", cascade="all, delete-orphan", order_by="ThemePerk.id"
    )
    packages: Mapped[list["Package"]] = relationship(back_populates="theme")  # noqa: F821

    def allows_style(self, style_rank: int) -> bool:
        """해당 등급의 스타일을 이 테마에서 팔 수 있는가 (최소 등급 이상이면 허용)."""
        return style_rank >= self.min_style_rank

    def perk_snapshot(self) -> list[dict]:
        """예약 당시 제공 내용과 창고 연결·수량·단위를 보존한다."""
        return [dict(id=p.id, label=p.label, inventory_item_id=p.inventory_item_id,
                     qty_per_booking=p.qty_per_booking, per_person=p.per_person,
                     unit=p.inventory_item.unit if p.inventory_item else "회") for p in self.perks]

    @property
    def min_style(self) -> Style:
        """이 테마가 허용하는 가장 낮은 스타일 (호텔·식사 세부 변경의 하한 기준)."""
        return min_style_for_theme(self.min_style_rank)


class ThemePerk(Base):
    """테마 기본 제공 물품/서비스. 창고 물품은 결제 완료 시 자동 출고."""

    __tablename__ = "theme_perks"

    id: Mapped[int] = mapped_column(primary_key=True)
    theme_id: Mapped[int] = mapped_column(ForeignKey("themes.id", ondelete="CASCADE"), nullable=False, index=True)
    inventory_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="SET NULL"), nullable=True
    )
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    qty_per_booking: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    per_person: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    theme: Mapped[Theme] = relationship(back_populates="perks")
    inventory_item: Mapped["InventoryItem | None"] = relationship()  # noqa: F821
