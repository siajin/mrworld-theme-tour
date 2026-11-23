from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class MealAddon(Base):
    """식사 추가옵션 (샴페인, 커피 등). 1인당·1회 가격."""

    __tablename__ = "meal_addons"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    price: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
