from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class Setting(Base):
    """key/value 설정 (단골 할인 기준, 최소 출발 인원 등). 값은 문자열로 저장하고 서비스에서 형변환."""

    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
