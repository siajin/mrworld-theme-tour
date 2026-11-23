from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, TimestampMixin


class User(Base, TimestampMixin):
    """회원 계정 (고객·직원). 역할 판별 규칙을 가진다."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="customer", nullable=False)  # customer | staff
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), default="", nullable=False)
    address: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    # 완료된 여행 횟수 — 단골 등급(loyalty) 산정 기준. 직원 계정은 항상 0.
    completed_trips: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    @property
    def is_staff(self) -> bool:
        """직원 계정인가 (직원은 예약·동행 합류 불가, 직원 화면 접근 가능)."""
        return self.role == "staff"
