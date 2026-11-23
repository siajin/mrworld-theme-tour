"""예약 상태 기계 통합 테스트: 가입 → 견적 → 예약 → 결제 → gathering → 동행 합류 → confirmed → 알림·출고."""
from datetime import date, timedelta

from sqlalchemy import select

from app.models import Booking, InventoryItem, InventoryMove, Notification, Package
from tests.conftest import login, signup


def _package(client, slug: str) -> dict:
    for card in client.get("/api/v1/packages").json():
        if card["title"].startswith({"jeju-golf": "제주 명문", "bali-honeymoon": "발리", "jirisan-trekking": "지리산"}[slug]):
            return client.get(f"/api/v1/packages/{card['id']}").json()
    raise AssertionError(slug)


def _open_departure(package: dict, min_remaining: int = 5) -> dict:
    return next(d for d in package["departures"] if d["status"] == "open" and d["remaining"] >= min_remaining)


def test_full_gathering_to_confirmed_flow(client, db, monkeypatch):
    rep = signup(client, "flow-rep@test.com", name="대표자")
    friend = signup(client, "flow-friend@test.com", name="친구")
    staff = login(client, "admin@mrworld.com", "admin1234")

    package = _package(client, "jeju-golf")  # 골프: 최소 3명, classic 허용
    departure = _open_departure(package)
    req = {
        "package_id": package["id"],
        "departure_id": departure["id"],
        "style_code": "classic",
        "meal_code": "local",
        "addons": [{"meal_addon_id": 2, "qty": 1}],
        "travelers_count": 2,
    }

    # 비로그인 견적 (할인 0)
    quote = client.post("/api/v1/bookings/quote", json=req)
    assert quote.status_code == 200, quote.text
    q = quote.json()
    assert q["style_price"] == 690_000
    assert q["meal_delta"] == 25_000 * package["days"]
    assert q["addons_total"] == 12_000 * 2
    assert q["discount"] == 0
    assert q["resolved"] == {"hotel_grade": 3, "meal_code": "local", "transport_code": "van_10"}

    # 예약 생성 → pending
    created = client.post(
        "/api/v1/bookings",
        json={**req, "memo": "테스트", "travelers": [
            {"name": "대표자", "phone": "010-1", "is_representative": True},
            {"name": "동행1", "phone": "010-2"},
        ]},
        headers=rep,
    )
    assert created.status_code == 201, created.text
    booking = created.json()
    assert booking["status"] == "pending"
    assert booking["code"].startswith("MW-") and len(booking["code"]) == 14
    assert booking["invite_code"] is None
    assert booking["needed_more"] == 1
    assert booking["quote"]["total"] == q["total"]
    assert booking["travelers"][0]["user_id"] is not None and booking["travelers"][0]["is_representative"]
    bid = booking["id"]

    # 결제 → 인원 미달이므로 gathering + invite_code
    paid = client.post(f"/api/v1/bookings/{bid}/pay", json={"method": "card"}, headers=rep)
    assert paid.status_code == 200, paid.text
    assert paid.json()["status"] == "gathering"
    code = paid.json()["invite_code"]
    assert code and len(code) == 8 and code == code.upper()
    assert paid.json()["paid_at"] is not None

    # 두 번 결제 불가
    assert client.post(f"/api/v1/bookings/{bid}/pay", json={"method": "card"}, headers=rep).status_code == 400

    # 비로그인 초대 미리보기
    preview = client.get(f"/api/v1/bookings/invite/{code}")
    assert preview.status_code == 200
    assert preview.json()["needed_more"] == 1 and preview.json()["representative_name"] == "대표자"

    # 친구가 아직 예약을 볼 수 없음
    assert client.get(f"/api/v1/bookings/{bid}", headers=friend).status_code == 403

    stock_before = db.scalar(select(InventoryItem.stock_qty).where(InventoryItem.sku == "GLF-BALL"))

    # 친구 합류 → 3명 → confirmed
    joined = client.post("/api/v1/bookings/join", json={"invite_code": code}, headers=friend)
    assert joined.status_code == 200, joined.text
    j = joined.json()
    assert j["status"] == "confirmed"
    assert j["travelers_count"] == 3 and j["needed_more"] == 0
    assert j["confirmed_at"] is not None
    assert j["invite_code"] == code  # 확정 후에도 유지
    assert j["quote"]["travelers_count"] == 3 and j["quote"]["total"] > q["total"]
    joined_row = next(t for t in j["travelers"] if t["joined_via_code"])
    assert joined_row["name"] == "친구" and joined_row["user_id"] is not None

    # 친구도 이제 예약을 볼 수 있고, 내 여행 목록에 나온다
    assert client.get(f"/api/v1/bookings/{bid}", headers=friend).status_code == 200
    assert any(t["booking_id"] == bid for t in client.get("/api/v1/me/trips", headers=friend).json())

    # 알림: 여행자 전원(대표자 + 예약 때 번호를 적은 비회원 동행 + 코드로 합류한 회원) 에게 booking_confirmed
    db.expire_all()
    notes = db.scalars(select(Notification).where(Notification.template == "booking_confirmed")).all()
    mine = [n for n in notes if n.payload.get("code") == booking["code"]]
    assert len(mine) == 3
    assert all(n.status == "sent" and n.sent_at is not None and n.channel == "sms" for n in mine)
    assert {n.payload.get("recipient_name") for n in mine} == {t["name"] for t in j["travelers"]}
    # 결제 직후(동행 모집 중)에는 대표자에게 초대코드가 담긴 접수 문자가 갔다
    received = [n for n in db.scalars(select(Notification).where(Notification.template == "booking_received")).all() if n.payload.get("code") == booking["code"]]
    assert len(received) == 1 and received[0].payload.get("invite_code") == code and code in received[0].body
    assert "[미스터 월드]" in mine[0].title and booking["code"] in mine[0].body

    # 창고: 골프공 세트 per_person → 3개 출고
    moves = db.scalars(select(InventoryMove).where(InventoryMove.ref_booking_id == bid)).all()
    assert all(m.type == "out" for m in moves)
    assert {sku: sum(m.qty for m in moves if m.item.sku == sku) for sku in ("GLF-BALL", "GLF-ACC")} == {"GLF-BALL": 3, "GLF-ACC": 3}
    stock_after = db.scalar(select(InventoryItem.stock_qty).where(InventoryItem.sku == "GLF-BALL"))
    assert stock_after == stock_before - 1  # 결제 시 2명분, 합류 시 추가 1명분

    # 확정 후 인원 변경 불가, 코드 재사용 불가
    assert client.delete(f"/api/v1/bookings/{bid}/travelers/{joined_row['id']}", headers=rep).status_code == 400
    assert client.post("/api/v1/bookings/join", json={"invite_code": code}, headers=friend).status_code == 400

    # 출발일정 booked 반영
    dep_after = next(d for d in client.get(f"/api/v1/packages/{package['id']}/departures").json() if d["id"] == departure["id"])
    assert dep_after["booked"] == departure["booked"] + 3

    # 직원 완료 처리 → completed_trips +1 (대표자·회원 동행)
    assert client.post(f"/api/v1/staff/bookings/{bid}/complete", headers=staff).status_code == 400
    class AfterTrip(date):
        @classmethod
        def today(cls):
            return date.fromisoformat(departure["return_date"]) + timedelta(days=1)

    with monkeypatch.context() as clock:
        clock.setattr("app.services.booking.date", AfterTrip)
        assert client.post(f"/api/v1/staff/bookings/{bid}/complete", headers=staff).json()["status"] == "completed"
    assert client.get("/api/v1/me", headers=rep).json()["loyalty"]["completed_trips"] == 1
    assert client.get("/api/v1/me", headers=friend).json()["loyalty"]["completed_trips"] == 1


def test_honeymoon_two_travelers_confirms_on_pay_and_room_deco_once(client, db):
    couple = signup(client, "couple@test.com", name="신랑")
    package = _package(client, "bali-honeymoon")
    departure = _open_departure(package)
    base = {"package_id": package["id"], "departure_id": departure["id"], "travelers_count": 2}

    # 허니문 classic 은 400
    bad = client.post("/api/v1/bookings/quote", json={**base, "style_code": "classic"})
    assert bad.status_code == 400 and bad.json()["detail"] == "이 테마는 그랜드 스타일 이상만 선택할 수 있어요"

    couple_travelers = [{"name": "신랑", "phone": "", "is_representative": True}, {"name": "신부", "phone": ""}]

    # 세부 변경으로도 테마 하한(4성·현지식) 아래로는 내려갈 수 없다 → 예약 생성 400
    low_hotel = client.post("/api/v1/bookings", json={**base, "style_code": "grand", "hotel_grade": 3, "travelers": couple_travelers}, headers=couple)
    assert low_hotel.status_code == 400 and low_hotel.json()["detail"] == "이 테마는 4성급 이상 호텔만 선택할 수 있어요"
    low_meal = client.post("/api/v1/bookings", json={**base, "style_code": "grand", "meal_code": "lunchbox", "travelers": couple_travelers}, headers=couple)
    assert low_meal.status_code == 400 and low_meal.json()["detail"] == "이 테마는 현지식 레스토랑 이상 식사만 선택할 수 있어요"

    # 2인 전용 세단(허니문 기본 차량)에 3명 → 400
    too_many = client.post(
        "/api/v1/bookings",
        json={**base, "travelers_count": 3, "style_code": "grand", "transport_code": "sedan_2", "travelers": [*couple_travelers, {"name": "동행", "phone": ""}]},
        headers=couple,
    )
    assert too_many.status_code == 400 and too_many.json()["detail"].startswith("허니문 낭만 투어는 2인 전용")
    assert client.get("/api/v1/me/bookings", headers=couple).json() == []

    res = client.post("/api/v1/bookings", json={**base, "style_code": "grand", "travelers": couple_travelers}, headers=couple)
    assert res.status_code == 201, res.text
    bid = res.json()["id"]
    paid = client.post(f"/api/v1/bookings/{bid}/pay", json={"method": "transfer"}, headers=couple).json()
    assert paid["status"] == "confirmed" and paid["invite_code"] is None

    moves = {m.item.sku: m.qty for m in db.scalars(select(InventoryMove).where(InventoryMove.ref_booking_id == bid)).all()}
    assert moves == {"CPL-TEE": 2, "ROOM-DECO": 1}


def test_add_remove_travelers_and_cancel(client):
    rep = signup(client, "addrm@test.com", name="대표")
    package = _package(client, "jirisan-trekking")
    departure = _open_departure(package)
    res = client.post(
        "/api/v1/bookings",
        json={"package_id": package["id"], "departure_id": departure["id"], "style_code": "classic", "travelers_count": 1,
              "travelers": [{"name": "대표", "phone": "", "is_representative": True}]},
        headers=rep,
    )
    bid = res.json()["id"]
    one = res.json()["quote"]["total"]

    added = client.post(f"/api/v1/bookings/{bid}/travelers", json={"name": "친구A", "phone": ""}, headers=rep).json()
    assert added["travelers_count"] == 2 and added["quote"]["total"] == one * 2 and added["status"] == "pending"

    rep_row = next(t for t in added["travelers"] if t["is_representative"])
    assert client.delete(f"/api/v1/bookings/{bid}/travelers/{rep_row['id']}", headers=rep).status_code == 400
    friend_row = next(t for t in added["travelers"] if not t["is_representative"])
    removed = client.delete(f"/api/v1/bookings/{bid}/travelers/{friend_row['id']}", headers=rep).json()
    assert removed["travelers_count"] == 1 and removed["quote"]["total"] == one

    # 결제 후 gathering 상태에서 직접 2명 추가 → confirmed
    client.post(f"/api/v1/bookings/{bid}/pay", json={"method": "card"}, headers=rep)
    client.post(f"/api/v1/bookings/{bid}/travelers", json={"name": "친구B", "phone": ""}, headers=rep)
    done = client.post(f"/api/v1/bookings/{bid}/travelers", json={"name": "친구C", "phone": ""}, headers=rep).json()
    assert done["status"] == "confirmed" and done["travelers_count"] == 3

    cancelled = client.post(f"/api/v1/bookings/{bid}/cancel", headers=rep)
    assert cancelled.status_code == 200 and cancelled.json()["status"] == "cancelled"
    assert client.post(f"/api/v1/bookings/{bid}/cancel", headers=rep).status_code == 400
    assert all(t["booking_id"] != bid for t in client.get("/api/v1/me/trips", headers=rep).json())


def test_capacity_check(client, db):
    user = signup(client, "capacity@test.com")
    package = _package(client, "jirisan-trekking")
    departure = _open_departure(package)
    too_many = departure["remaining"] + 1
    res = client.post(
        "/api/v1/bookings",
        json={"package_id": package["id"], "departure_id": departure["id"], "style_code": "classic", "travelers_count": too_many,
              "travelers": [{"name": "대표", "phone": "", "is_representative": True}] + [{"name": f"동행{i}", "phone": ""} for i in range(too_many - 1)]},
        headers=user,
    )
    assert res.status_code == 400
    assert "잔여" in res.json()["detail"]


def test_confirmation_is_per_booking_not_per_departure(client, db):
    """같은 출발일정에 2명 + 1명 예약이 있어도 서로 합산해 확정되지 않는다."""
    a = signup(client, "party-a@test.com", name="A")
    b = signup(client, "party-b@test.com", name="B")
    package = _package(client, "jirisan-trekking")
    departure = _open_departure(package)
    common = {"package_id": package["id"], "departure_id": departure["id"], "style_code": "grand"}
    ra = client.post("/api/v1/bookings", json={**common, "travelers_count": 2, "travelers": [{"name": "A", "phone": "", "is_representative": True}, {"name": "A2", "phone": ""}]}, headers=a).json()
    rb = client.post("/api/v1/bookings", json={**common, "travelers_count": 1, "travelers": [{"name": "B", "phone": "", "is_representative": True}]}, headers=b).json()
    assert client.post(f"/api/v1/bookings/{ra['id']}/pay", json={"method": "card"}, headers=a).json()["status"] == "gathering"
    assert client.post(f"/api/v1/bookings/{rb['id']}/pay", json={"method": "card"}, headers=b).json()["status"] == "gathering"
    assert db.get(Booking, ra["id"]).status == "gathering"


def test_inventory_short_blocks_booking_without_deduction(client, db):
    staff = login(client, "admin@mrworld.com", "admin1234")
    user = signup(client, "short@test.com", name="재고부족")
    scarf = next(i for i in client.get("/api/v1/staff/inventory/items", headers=staff).json() if i["sku"] == "TRK-SCARF")
    # 스카프 재고를 1개만 남긴 뒤 3명 트레킹 예약을 확정한다
    client.post(f"/api/v1/staff/inventory/items/{scarf['id']}/moves", json={"type": "adjust", "qty": -(scarf["stock_qty"] - 1), "memo": "테스트"}, headers=staff)

    package = _package(client, "jirisan-trekking")
    departure = _open_departure(package)
    res = client.post(
        "/api/v1/bookings",
        json={"package_id": package["id"], "departure_id": departure["id"], "style_code": "classic", "travelers_count": 3,
              "travelers": [{"name": "재고부족", "phone": "", "is_representative": True}, {"name": "동행1", "phone": ""}, {"name": "동행2", "phone": ""}]},
        headers=user,
    )
    assert res.status_code == 400 and "재고" in res.json()["detail"]
    assert db.scalar(select(InventoryItem.stock_qty).where(InventoryItem.sku == "TRK-SCARF")) == 1
    assert client.get("/api/v1/me/bookings", headers=user).json() == []
    # 이후 테스트에 부족 재고를 남기지 않는다.
    client.post(f"/api/v1/staff/inventory/items/{scarf['id']}/moves", json={"type": "in", "qty": scarf["stock_qty"] - 1}, headers=staff)

    client.post(f"/api/v1/staff/inventory/items/{scarf['id']}/moves", json={"type": "in", "qty": scarf["stock_qty"] - 1, "memo": "복구"}, headers=staff)


def test_seeded_demo_account(client, demo_headers):
    me = client.get("/api/v1/me", headers=demo_headers).json()
    assert me["loyalty"] == {"tier": "silver", "completed_trips": 3, "rate": 0.05, "next_tier_trips": 5}
    trips = client.get("/api/v1/me/trips", headers=demo_headers).json()
    assert len(trips) >= 4 and trips[0]["status"] in ("gathering", "confirmed")  # 최근 출발일 순
    assert sum(1 for t in trips if t["status"] == "completed") == 3
    gathering = client.get("/api/v1/me/bookings?status=gathering", headers=demo_headers).json()
    assert len(gathering) == 1 and gathering[0]["invite_code"] == "MWJOIN01" and gathering[0]["needed_more"] == 1
    assert client.get("/api/v1/bookings/invite/MWJOIN01").status_code == 200
    published = db_count_published()
    assert published == 12


def db_count_published() -> int:
    from app.db.session import SessionLocal

    with SessionLocal() as s:
        return len(s.scalars(select(Package).where(Package.is_published.is_(True))).all())
