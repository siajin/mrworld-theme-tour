"""규칙 기반 AI 파서."""
from datetime import date

from app.services.ai import parse_text


def test_parse_honeymoon_bali_october_two():
    p = parse_text("10월에 발리로 둘이 허니문 가고 싶어요, 프리미엄으로 200만원 이하", today=date(2026, 9, 24))
    assert p.theme_slug == "honeymoon"
    assert p.region == "발리"
    assert (p.depart_from, p.depart_to) == (date(2026, 10, 1), date(2026, 10, 31))
    assert p.travelers_count == 2
    assert p.style_code == "premium"
    assert p.budget_max == 2_000_000
    assert "허니문" in p.keywords and "발리" in p.keywords


def test_parse_parents_next_month_and_autumn():
    p = parse_text("다음 달 부모님이랑 규슈 온천 가성비로", today=date(2026, 9, 24))
    assert p.theme_slug == "parents" and p.region == "규슈"
    assert (p.depart_from, p.depart_to) == (date(2026, 10, 1), date(2026, 10, 31))
    assert p.travelers_count == 3 and p.style_code == "classic"

    q = parse_text("가을 지리산 등산 4명", today=date(2026, 9, 24))
    assert q.theme_slug == "trekking" and q.region == "지리산"
    assert (q.depart_from, q.depart_to) == (date(2026, 9, 1), date(2026, 11, 30))
    assert q.travelers_count == 4


def test_parse_endpoint_and_chat(client):
    res = client.post("/api/v1/ai/parse", json={"text": "다낭 골프 3명 11월"})
    assert res.status_code == 200
    body = res.json()
    assert body["theme_slug"] == "golf" and body["region"] == "다낭" and body["travelers_count"] == 3
    assert body["summary"].startswith("골프 챌린지 투어")
    assert len(body["matched_package_ids"]) >= 1

    chat = client.post("/api/v1/ai/chat", json={"messages": [{"role": "user", "content": "부모님 모시고 온천 여행 추천해줘"}]})
    assert chat.status_code == 200
    assert chat.json()["packages"] and all(p["theme"]["slug"] == "parents" for p in chat.json()["packages"])
    assert "조건으로 찾아봤어요" in chat.json()["reply"]

    empty = client.post("/api/v1/ai/chat", json={"messages": [{"role": "user", "content": "안녕"}]})
    assert empty.status_code == 200 and isinstance(empty.json()["reply"], str)
