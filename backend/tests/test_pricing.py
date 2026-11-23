"""가격 공식(api-contract.md §3) 단위 테스트."""
import pytest
from fastapi import HTTPException

from app.services import pricing
from app.services.pricing import AddonLine, PricingInput, calculate


def _inp(**overrides) -> PricingInput:
    base = dict(
        style_code="grand",
        style_price=1_890_000,  # 발리 허니문 grand
        nights=3,
        days=5,
        travelers_count=2,
        theme_min_style_rank=2,
        theme_default_transport="sedan_2",
    )
    base.update(overrides)
    return PricingInput(**base)


def test_style_preset_no_changes():
    q = calculate(_inp())
    assert q.per_person == 1_890_000
    assert q.hotel_delta == 0 and q.meal_delta == 0
    assert q.subtotal == 3_780_000
    assert q.transport_total == 0 and q.addons_total == 0 and q.discount == 0
    assert q.total == 3_780_000
    assert q.deposit == 378_000
    assert q.resolved.hotel_grade == 4 and q.resolved.meal_code == "local" and q.resolved.transport_code == "sedan_2"


def test_hotel_and_meal_upgrade_deltas():
    # grand(4성, 현지식) -> 5성 + 고급 레스토랑: (150,000-60,000)*3박 + (90,000-25,000)*5일
    q = calculate(_inp(hotel_grade=5, meal_code="fine_dining"))
    assert q.hotel_delta == 90_000 * 3
    assert q.meal_delta == 65_000 * 5
    assert q.per_person == 1_890_000 + 270_000 + 325_000
    assert q.subtotal == q.per_person * 2


def test_downgrade_meal_gives_negative_delta():
    # 트레킹 클래식(도시락) 기준에서 grand 로 올린 뒤 도시락으로 내리면 음수 델타
    q = calculate(_inp(style_code="grand", style_price=590_000, nights=2, days=3, travelers_count=3, theme_min_style_rank=1, theme_default_transport="van_10", meal_code="lunchbox"))
    assert q.meal_delta == -25_000 * 3
    assert q.per_person == 590_000 - 75_000


def test_discounting_options_cannot_make_the_trip_price_negative():
    with pytest.raises(HTTPException) as exc:
        calculate(_inp(style_code="premium", style_price=1, theme_min_style_rank=1,
                       hotel_grade=3, meal_code="lunchbox"))
    assert exc.value.status_code == 400
    assert "음수" in exc.value.detail


def test_transport_addons_and_loyalty_discount_floor():
    q = calculate(
        _inp(
            style_code="classic",
            style_price=1_090_000,  # 다낭 골프 classic
            nights=3,
            days=5,
            travelers_count=3,
            theme_min_style_rank=1,
            theme_default_transport="van_10",
            transport_code="limousine",
            addons=(AddonLine(1, "샴페인 1병", 80_000, 1), AddonLine(2, "스페셜티 커피", 12_000, 2)),
            loyalty_rate=0.05,
        )
    )
    assert q.subtotal == 1_090_000 * 3
    assert q.transport_total == 300_000
    assert q.addons_total == (80_000 * 1 + 12_000 * 2) * 3  # 1인당·1회 × 인원
    gross = 3_270_000 + 300_000 + 312_000
    assert q.discount == int(gross * 0.05)  # floor
    assert q.total == gross - q.discount
    assert q.deposit == int(q.total * 0.1 // 1000) * 1000
    assert q.deposit % 1000 == 0
    assert q.discount_rate == 0.05
    assert any("단골 할인" in line.label for line in q.lines)


def test_deposit_rounds_down_to_thousand():
    q = calculate(_inp(style_price=1_234_567, travelers_count=1))
    assert q.total == 1_234_567
    assert q.deposit == 123_000


def test_honeymoon_rejects_classic():
    with pytest.raises(HTTPException) as exc:
        calculate(_inp(style_code="classic", style_price=1_000_000))
    assert exc.value.status_code == 400
    assert exc.value.detail == "이 테마는 그랜드 스타일 이상만 선택할 수 있어요"


def test_invalid_hotel_grade_and_meal():
    with pytest.raises(HTTPException):
        calculate(_inp(hotel_grade=2))
    with pytest.raises(HTTPException):
        calculate(_inp(meal_code="buffet"))


def test_catalog_tables_match_contract():
    assert {g.grade: g.surcharge for g in pricing.catalog_hotel_grades()} == {3: 0, 4: 60_000, 5: 150_000}
    assert {m.code: m.surcharge for m in pricing.catalog_meal_options()} == {"lunchbox": 0, "local": 25_000, "fine_dining": 90_000}
    assert {t.code: t.surcharge for t in pricing.catalog_transport_options()} == {"sedan_2": 0, "van_10": 0, "limousine": 300_000, "premium_bus_25": 500_000}
    assert [s.rank for s in pricing.catalog_styles()] == [1, 2, 3]


def test_theme_floor_blocks_hotel_and_meal_downgrade():
    """허니문(그랜드 이상)은 세부 변경으로도 3성 호텔·도시락을 고를 수 없다."""
    import pytest
    from fastapi import HTTPException
    from app.services.pricing import PricingInput, calculate

    base = dict(style_code="grand", style_price=1_890_000, nights=3, days=5, travelers_count=2,
                theme_min_style_rank=2, theme_default_transport="sedan_2")
    with pytest.raises(HTTPException) as e:
        calculate(PricingInput(**base, hotel_grade=3))
    assert "4성급 이상" in e.value.detail
    with pytest.raises(HTTPException) as e:
        calculate(PricingInput(**base, meal_code="lunchbox"))
    assert "현지식 레스토랑 이상" in e.value.detail
    # 그랜드 → 5성 / 고급 레스토랑 업그레이드는 가능
    q = calculate(PricingInput(**base, hotel_grade=5, meal_code="fine_dining"))
    assert q.resolved.hotel_grade == 5 and q.resolved.meal_code == "fine_dining"
    # 트레킹(클래식 허용)은 3성·도시락 가능
    q = calculate(PricingInput(**{**base, "style_code": "classic", "theme_min_style_rank": 1, "theme_default_transport": "van_10"}, hotel_grade=3, meal_code="lunchbox"))
    assert q.resolved.hotel_grade == 3


def test_transport_capacity_enforced():
    import pytest
    from fastapi import HTTPException
    from app.services.pricing import PricingInput, calculate

    base = dict(style_code="grand", style_price=1_000_000, nights=2, days=3, travelers_count=3,
                theme_min_style_rank=2, theme_default_transport="sedan_2")
    with pytest.raises(HTTPException) as e:
        calculate(PricingInput(**base))  # 허니문 기본 2인 세단에 3명
    assert "최대 2명" in e.value.detail
    assert calculate(PricingInput(**base, transport_code="van_10")).transport_total == 0
    with pytest.raises(HTTPException):
        calculate(PricingInput(**{**base, "travelers_count": 5}, transport_code="limousine"))  # 리무진 4명
