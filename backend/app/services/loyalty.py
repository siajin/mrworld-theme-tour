"""단골 등급 정책.

클래스
- LoyaltyPolicy: completed_trips ≥ gold_trips → gold, ≥ silver_trips → silver, 그 외 basic. 등급·할인율·Loyalty DTO 를 만든다.
기존 모듈 함수(loyalty_rate, loyalty_for)는 호환용 얇은 래퍼다.
"""
from app.models import User
from app.schemas.catalog import AppSettings
from app.schemas.user import Loyalty


class LoyaltyPolicy:
    """설정(AppSettings)의 임계값·할인율로 단골 등급을 판정한다. 직원·비로그인은 할인 없음."""

    def __init__(self, settings: AppSettings) -> None:
        self.settings = settings

    def tier_for(self, completed_trips: int) -> str:
        """완료 여행 횟수 → 등급(gold | silver | basic)."""
        if completed_trips >= self.settings.loyalty_gold_trips:
            return "gold"
        if completed_trips >= self.settings.loyalty_silver_trips:
            return "silver"
        return "basic"

    def rate_for_trips(self, completed_trips: int) -> float:
        """완료 여행 횟수 → 할인율 (basic 은 0)."""
        tier = self.tier_for(completed_trips)
        if tier == "gold":
            return self.settings.loyalty_gold_rate
        if tier == "silver":
            return self.settings.loyalty_silver_rate
        return 0.0

    def rate_for(self, user: User | None) -> float:
        """사용자에게 적용할 할인율. 비로그인·직원 계정은 0."""
        if user is None or user.is_staff:
            return 0.0
        return self.rate_for_trips(user.completed_trips)

    def loyalty_for_trips(self, completed_trips: int) -> Loyalty:
        """완료 여행 횟수 → 등급·횟수·할인율·다음 등급 임계값(gold 면 null) DTO."""
        tier = self.tier_for(completed_trips)
        next_trips = {"gold": None, "silver": self.settings.loyalty_gold_trips, "basic": self.settings.loyalty_silver_trips}[tier]
        return Loyalty(tier=tier, completed_trips=completed_trips, rate=self.rate_for_trips(completed_trips), next_tier_trips=next_trips)

    def loyalty_of(self, user: User) -> Loyalty:
        """사용자의 단골 정보 DTO (고객 계정 기준)."""
        return self.loyalty_for_trips(user.completed_trips)


# ---------- 호환 래퍼

def loyalty_rate(completed_trips: int, settings: AppSettings) -> float:
    return LoyaltyPolicy(settings).rate_for_trips(completed_trips)


def loyalty_for(completed_trips: int, settings: AppSettings) -> Loyalty:
    return LoyaltyPolicy(settings).loyalty_for_trips(completed_trips)
