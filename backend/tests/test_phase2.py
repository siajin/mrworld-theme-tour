"""2단계: 음성 명령 의도 파서 + Solapi 문자 provider."""
import httpx

from app.services import notification as notif
from app.services.ai import detect_intent, parse_text


def _intent(text: str, context: str = "home"):
    return detect_intent(text, parse_text(text), context)


def test_voice_intents():
    assert _intent("부모님이랑 10월에 편하게 온천")[0] == "search"
    i, s = _intent("두 번째 상품", "search")
    assert i == "select_result" and s.index == 2
    i, s = _intent("마지막 거", "search")
    assert i == "select_result" and s.index == -1
    assert _intent("그랜드로 바꿔줘", "package")[0] == "set_style"
    assert _intent("인원 넷이서", "package")[0] == "set_travelers"
    i, s = _intent("10월 12일 출발로", "package")
    assert i == "set_departure" and s.depart_date is not None and s.depart_date.endswith("-10-12")
    i, s = _intent("호텔 5성으로 올려줘", "package")
    assert i == "set_hotel" and s.hotel_grade == 5
    i, s = _intent("식사는 스테이크랑 샴페인으로", "package")
    assert i == "set_meal" and s.meal_code == "fine_dining"
    assert _intent("예약해줘", "package")[0] == "book"
    assert _intent("내 예약 보여줘")[0] == "my_bookings"
    assert _intent("홈으로", "package")[0] == "go_home"
    assert _intent("안녕")[0] == "unknown"
    # 상세 화면이라도 테마/지역이 들어 있으면 검색으로 본다
    assert _intent("프리미엄 발리 허니문", "package")[0] == "search"


def test_parse_endpoint_returns_intent(client):
    res = client.post("/api/v1/ai/parse", json={"text": "그랜드로 바꿔", "context": "package"})
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "set_style" and data["style_code"] == "grand" and "그랜드" in data["reply"]

    res = client.post("/api/v1/ai/parse", json={"text": "둘이서 로맨틱하게 5일"})
    data = res.json()
    assert data["intent"] == "search" and data["theme_slug"] == "honeymoon" and data["matched_package_ids"]


def test_solapi_provider_success_and_failure(monkeypatch):
    captured: dict = {}

    class FakeResponse:
        def __init__(self, status_code: int, payload: dict):
            self.status_code = status_code
            self._payload = payload
            self.content = b"x"

        def json(self):
            return self._payload

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def post(self, url, headers=None, json=None):
            captured["url"], captured["headers"], captured["json"] = url, headers, json
            if json["message"]["to"] == "01000000000":
                return FakeResponse(400, {"errorCode": "ValidationError", "errorMessage": "발신번호 미등록"})
            return FakeResponse(200, {"messageId": "M1", "statusCode": "2000"})

    monkeypatch.setattr(httpx, "Client", FakeClient)
    provider = notif.SolapiSmsProvider("KEY", "SECRET", "010-1234-5678")

    ok = provider.send("010-9876-5432", "제목", "본문")
    assert ok.status == "sent" and ok.provider_message_id == "M1"
    assert captured["json"]["message"] == {"to": "01098765432", "from": "01012345678", "text": "본문"}  # 단문이면 subject 없음
    long_body = "가" * 60  # 120바이트 → LMS
    provider.send("010-9876-5432", "제목", long_body)
    assert captured["json"]["message"]["subject"] == "제목"
    auth = captured["headers"]["Authorization"]
    assert auth.startswith("HMAC-SHA256 apiKey=KEY, date=") and "signature=" in auth

    bad = provider.send("01000000000", "제목", "본문")
    assert bad.status == "failed" and "발신번호" in (bad.error or "")

    assert provider.send("", "제목", "본문").status == "failed"


def test_provider_status_default_console(client, staff_headers):
    res = client.get("/api/v1/staff/notifications/provider", headers=staff_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["provider"] == "console" and data["live"] is False


def test_sms_test_and_resend(client, staff_headers):
    res = client.post("/api/v1/staff/notifications/test", json={"phone": "010-1111-2222", "body": "테스트"}, headers=staff_headers)
    assert res.status_code == 200
    row = res.json()
    assert row["template"] == "test" and row["status"] == "sent" and row["provider"] == "console" and row["to"] == "01011112222"

    res = client.post(f"/api/v1/staff/notifications/{row['id']}/resend", headers=staff_headers)
    assert res.status_code == 200 and res.json()["to"] == "01011112222" and res.json()["id"] != row["id"]

    assert client.post("/api/v1/staff/notifications/test", json={"phone": "12", "body": "x"}, headers=staff_headers).status_code == 400


def test_sms_templates_fit_in_90_bytes():
    from app.services.notification import TEMPLATES, render_body, sms_bytes

    longest = {
        "package_title": "히말라야 푼힐 전망 트레킹 8일", "depart_md": "12/31", "code": "MW-2026-000999",
        "companion_name": "박동행이", "travelers_count": 9, "needed_more": 1, "invite_code": "MWJOIN01",
        "item_name": "안마·지압 이용권", "shortage": 12, "unit": "세트", "body": "미스터 월드 문자 발송 테스트입니다.",
    }
    for name, (_title, body_fmt) in TEMPLATES.items():
        body = render_body(body_fmt, longest)
        assert sms_bytes(body) <= 90, f"{name}: {sms_bytes(body)}B {body}"
        assert "MW-2026-000999" in body or name in ("test", "booking_received")  # 접수 문자는 초대코드를 우선 남긴다
