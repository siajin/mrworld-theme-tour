"""가입·내 정보 번호와 예약별 수신번호를 실제 외부 전송 없이 검증한다."""
import httpx
from sqlalchemy import select

from app.models import Booking, Notification, User
from app.services import notification as notif


def test_seed_does_not_overwrite_saved_profile(db):
    from app.db.seed import _upsert_users

    user = db.scalar(select(User).where(User.email == "demo@customer.com"))
    user.phone = "010-2222-3333"
    user.name = "수정한 이름"
    user.address = "수정한 주소"
    _upsert_users(db)
    db.refresh(user)
    assert (user.phone, user.name, user.address) == ("010-2222-3333", "수정한 이름", "수정한 주소")
    db.rollback()


def test_signup_profile_and_booking_sms_recipients(client, db, monkeypatch):
    calls = []

    class FakeSmsClient:
        def __init__(self, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def post(self, url, headers, json):
            calls.append(json["message"])
            assert url == notif.SolapiSmsProvider.endpoint
            return httpx.Response(200, json={"messageId": f"MOCK-{len(calls)}", "statusCode": "2000"})

    monkeypatch.setattr(notif.httpx, "Client", FakeSmsClient)
    monkeypatch.setattr(notif, "get_provider", lambda: notif.SolapiSmsProvider("test-key", "test-secret", "01055550000"))
    signed = client.post("/api/v1/auth/signup", json={
        "email": "sms-recipient@test.com", "password": "test1234", "name": "번호확인",
        "phone": "010-1111-2222", "address": "서울",
    })
    assert signed.status_code == 201, signed.text
    account = signed.json()
    headers = {"Authorization": f"Bearer {account['access_token']}"}
    assert account["user"]["phone"] == "010-1111-2222"
    package_id = next(p["id"] for p in client.get("/api/v1/packages").json() if p["title"].startswith("제주 명문"))
    package = client.get(f"/api/v1/packages/{package_id}").json()
    departure = next(d for d in package["departures"] if d["status"] == "open" and d["remaining"] >= 5)
    base = {"package_id": package_id, "departure_id": departure["id"], "style_code": "classic", "travelers_count": 1}
    created = client.post("/api/v1/bookings", headers=headers, json={**base, "travelers": [
        {"name": "번호확인", "phone": account["user"]["phone"], "is_representative": True},
    ]})
    assert created.status_code == 201, created.text
    booking_id = created.json()["id"]
    updated = client.put("/api/v1/me", headers=headers, json={"phone": "010-2222-3333"})
    assert updated.status_code == 200 and updated.json()["phone"] == "010-2222-3333"
    assert client.get("/api/v1/me", headers=headers).json()["phone"] == "010-2222-3333"
    paid = client.post(f"/api/v1/bookings/{booking_id}/pay", headers=headers, json={"method": "card"})
    assert paid.status_code == 200, paid.text
    # 기존 예약은 회원정보를 수정해도 당시 입력한 번호를 유지한다.
    assert calls[-1]["to"] == "01011112222"
    assert calls[-1]["from"] == "01055550000"
    db.expire_all()
    stored = db.scalar(select(Notification).where(Notification.template == "booking_received", Notification.user_id == account["user"]["id"]))
    assert stored.payload["to"] == "01011112222" and stored.payload["provider"] == "solapi"
    assert stored.payload["provider_message_id"].startswith("MOCK-")
    user = db.get(User, account["user"]["id"])
    service = notif.NotificationService(db)
    # 회원번호를 직접 사용하는 알림은 변경된 번호를 사용한다.
    service.send(user.id, "test", {"body": "회원번호 확인"})
    assert calls[-1]["to"] == "01022223333"
    booking = db.get(Booking, booking_id)
    # 확정 알림 역시 예약번호 우선. 빈 예약번호만 회원번호로 보완한다.
    service.send_to_booking(booking, "test", {"body": "예약번호 확인"})
    assert calls[-1]["to"] == "01011112222"
    booking.travelers[0].phone = ""
    service.send_to_booking(booking, "test", {"body": "회원번호 보완"})
    assert calls[-1]["to"] == "01022223333"
    db.rollback()
