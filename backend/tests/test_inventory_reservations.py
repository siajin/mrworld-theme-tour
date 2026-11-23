"""예약 재고를 실제 API·DB 이력과 대조한다. 외부 SMS는 conftest에서 차단한다."""
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.models import Booking, Departure, InventoryItem, InventoryMove, Package, Theme, ThemePerk
from app.services.inventory import InventoryService
from app.services.notification import ConsoleSmsProvider, NotificationService
from tests.conftest import signup


@pytest.fixture()
def offer(client, db):
    key = uuid4().hex[:12]
    item = InventoryItem(sku=key, name="검증 기념품", unit="장", stock_qty=12)
    fixed = InventoryItem(sku=key+"-fixed", name="검증 연출 키트", unit="세트", stock_qty=8)
    theme = Theme(slug=key, name="검증 테마", min_style_rank=1, min_travelers=3, default_transport="van_10", vehicle_label="10인승 고급 승합")
    db.add_all([item, fixed, theme]); db.flush()
    theme.perks = [ThemePerk(label="1인당 기념품", inventory_item_id=item.id, qty_per_booking=2, per_person=True),
                   ThemePerk(label="예약당 연출 키트", inventory_item_id=fixed.id, qty_per_booking=1, per_person=False),
                   ThemePerk(label="기본 체험 서비스", qty_per_booking=1, per_person=False)]
    package = Package(theme=theme, slug=key, title="기본 제공 검증", nights=1, days=2, is_published=True)
    package.set_style_prices({"classic": 100000})
    departure = Departure(package=package, depart_date=date.today()+timedelta(days=60), return_date=date.today()+timedelta(days=61), capacity=50)
    db.add(package); db.commit()
    headers = signup(client, key+"@test.com")
    ids = dict(item=item.id, fixed=fixed.id, theme=theme.id, package=package.id, departure=departure.id, headers=headers)
    try:
        yield ids
    finally:
        db.rollback()
        for booking in db.scalars(select(Booking).where(Booking.package_id == ids["package"])):
            db.delete(booking)
        db.flush()
        db.delete(db.get(Package, ids["package"])); db.flush()
        db.expire_all()
        db.delete(db.get(Theme, ids["theme"]))
        db.delete(db.get(InventoryItem, ids["item"]))
        db.delete(db.get(InventoryItem, ids["fixed"]))
        db.commit()


def create(client, offer, count=1):
    return client.post("/api/v1/bookings", headers=offer["headers"], json={
        "package_id": offer["package"], "departure_id": offer["departure"], "style_code": "classic", "travelers_count": count,
        "travelers": [{"name": f"여행자{i}", "phone": "", "is_representative": i == 0} for i in range(count)],
    })


def stock(db, item_id):
    db.expire_all()
    return db.get(InventoryItem, item_id).stock_qty


def pay(client, offer, bid):
    return client.post(f"/api/v1/bookings/{bid}/pay", headers=offer["headers"], json={"method": "card"})


@pytest.fixture()
def replenish(db):
    original = {}
    def ensure(perks, count):
        for p in perks:
            iid = p["inventory_item_id"]
            if iid is None:
                continue
            item = db.get(InventoryItem, iid, populate_existing=True)
            original[iid] = item.stock_qty
            item.stock_qty = max(item.stock_qty, p["qty_per_booking"]*(count if p["per_person"] else 1))
        db.commit()
    try:
        yield ensure
    finally:
        db.rollback()
        for iid, qty in original.items():db.get(InventoryItem, iid).stock_qty = qty
        db.commit()


def test_paid_gathering_add_remove_confirm_cancel_stock(client, db, offer, staff_headers):
    created = create(client, offer); assert created.status_code == 201
    booking = created.json(); bid = booking["id"]
    assert stock(db, offer["item"]) == 12  # 미결제는 선차감하지 않는다.
    assert booking["theme"]["perks"][0]["unit"] == "장"
    assert pay(client, offer, bid).json()["status"] == "gathering"
    assert (stock(db, offer["item"]), stock(db, offer["fixed"])) == (10, 7)
    staff = client.get("/api/v1/staff/inventory/items", headers=staff_headers).json()
    assert next(i["stock_qty"] for i in staff if i["id"] == offer["item"]) == 10
    assert pay(client, offer, bid).status_code == 400
    added = client.post(f"/api/v1/bookings/{bid}/travelers", headers=offer["headers"], json={"name": "동행A", "phone": ""}).json()
    assert stock(db, offer["item"]) == 8 and stock(db, offer["fixed"]) == 7
    traveler = next(t for t in added["travelers"] if not t["is_representative"])
    removed = client.delete(f"/api/v1/bookings/{bid}/travelers/{traveler['id']}", headers=offer["headers"])
    assert removed.status_code == 200 and stock(db, offer["item"]) == 10
    assert client.post(f"/api/v1/staff/bookings/{bid}/confirm", headers=staff_headers).status_code == 200
    assert stock(db, offer["item"]) == 10  # 이미 확보한 재고는 확정 때 다시 빼지 않는다.
    cancel = client.post(f"/api/v1/bookings/{bid}/cancel", headers=offer["headers"])
    assert cancel.status_code == 200 and (stock(db, offer["item"]), stock(db, offer["fixed"])) == (12, 8)
    assert client.post(f"/api/v1/bookings/{bid}/cancel", headers=offer["headers"]).status_code == 400
    assert stock(db, offer["item"]) == 12


def test_quote_create_shortage_and_inactive_stock_blocked(client, db, offer):
    db.get(InventoryItem, offer["item"]).stock_qty = 1; db.commit()
    assert create(client, offer).status_code == 400
    quoted = client.post("/api/v1/bookings/quote", json={"package_id": offer["package"], "departure_id": offer["departure"], "style_code": "classic", "travelers_count": 1})
    assert quoted.status_code == 400 and "재고" in quoted.json()["detail"]
    item = db.get(InventoryItem, offer["item"]); item.stock_qty = 12; item.is_active = False; db.commit()
    assert create(client, offer).status_code == 400


def test_multi_item_shortage_rolls_back_payment_and_all_moves(client, db, offer):
    bid = create(client, offer).json()["id"]
    db.get(InventoryItem, offer["fixed"]).stock_qty = 0; db.commit()
    res = pay(client, offer, bid)
    assert res.status_code == 400 and "재고" in res.json()["detail"]
    assert stock(db, offer["item"]) == 12
    saved = client.get(f"/api/v1/bookings/{bid}", headers=offer["headers"]).json()
    assert saved["status"] == "pending" and saved["paid_at"] is None
    assert not db.scalars(select(InventoryMove).where(InventoryMove.ref_booking_id == bid)).all()


def test_paid_traveler_add_shortage_does_not_change_count_quote_or_stock(client, db, offer):
    bid = create(client, offer).json()["id"]; assert pay(client, offer, bid).status_code == 200
    db.get(InventoryItem, offer["item"]).stock_qty = 0; db.commit()
    before = client.get(f"/api/v1/bookings/{bid}", headers=offer["headers"]).json()
    res = client.post(f"/api/v1/bookings/{bid}/travelers", headers=offer["headers"], json={"name": "재고부족 동행", "phone": ""})
    assert res.status_code == 400
    after = client.get(f"/api/v1/bookings/{bid}", headers=offer["headers"]).json()
    assert after["travelers_count"] == 1 and after["quote"] == before["quote"] and stock(db, offer["item"]) == 0


def test_snapshot_survives_theme_edit_and_traveler_repricing(client, db, offer):
    bid = create(client, offer).json()["id"]
    theme = db.get(Theme, offer["theme"])
    theme.perks[0].label = "나중에 바뀐 항목"; theme.perks[0].qty_per_booking = 9
    db.commit()
    assert pay(client, offer, bid).status_code == 200 and stock(db, offer["item"]) == 10
    added = client.post(f"/api/v1/bookings/{bid}/travelers", headers=offer["headers"], json={"name": "동행", "phone": ""})
    assert added.status_code == 200 and stock(db, offer["item"]) == 8
    perk = added.json()["theme"]["perks"][0]
    assert perk["label"] == "1인당 기념품" and perk["qty_per_booking"] == 2


def test_duplicate_item_perks_are_summed_and_cancel_restores_actual_allocation(client, db, offer):
    theme = db.get(Theme, offer["theme"])
    theme.perks.append(ThemePerk(label="동일 물품 추가 제공", inventory_item_id=offer["item"], qty_per_booking=3))
    db.commit()
    bid = create(client, offer).json()["id"]; assert pay(client, offer, bid).status_code == 200
    assert stock(db, offer["item"]) == 7
    assert client.post(f"/api/v1/bookings/{bid}/cancel", headers=offer["headers"]).status_code == 200
    assert stock(db, offer["item"]) == 12


def test_pending_cancel_does_not_add_stock_and_staff_confirm_checks_stock(client, db, offer, staff_headers):
    bid = create(client, offer).json()["id"]
    assert client.post(f"/api/v1/bookings/{bid}/cancel", headers=offer["headers"]).status_code == 200
    assert stock(db, offer["item"]) == 12
    bid = create(client, offer).json()["id"]
    db.get(InventoryItem, offer["fixed"]).stock_qty = 0; db.commit()
    assert client.post(f"/api/v1/staff/bookings/{bid}/confirm", headers=staff_headers).status_code == 400
    assert stock(db, offer["item"]) == 12


@pytest.mark.parametrize("same_booking", [False, True])
def test_concurrent_payments_cannot_double_spend_stock(client, db, offer, same_booking):
    first = create(client, offer).json()["id"]
    second = first if same_booking else create(client, offer).json()["id"]
    db.get(InventoryItem, offer["item"]).stock_qty = 2; db.commit()
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda bid: pay(client, offer, bid).status_code, [first, second]))
    assert sorted(results) == [200, 400]
    assert stock(db, offer["item"]) == 0
    moves = db.scalars(select(InventoryMove).where(InventoryMove.item_id == offer["item"])).all()
    assert sum(m.qty for m in moves if m.type == "out") == 2


def test_same_reservation_inventory_sync_is_idempotent(client, db, offer):
    bid = create(client, offer).json()["id"]; pay(client, offer, bid)
    booking = db.get(Booking, bid); service = InventoryService(db)
    service.reserve_theme_perks(booking, booking.package.theme, NotificationService(db, ConsoleSmsProvider()))
    db.commit()
    assert stock(db, offer["item"]) == 10


def test_manual_out_is_atomic_and_records_only_success(client, db, offer, staff_headers):
    url = f"/api/v1/staff/inventory/items/{offer['item']}/moves"
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: client.post(url, headers=staff_headers, json={"type": "out", "qty": 8}).status_code, range(2)))
    assert sorted(results) == [200, 400] and stock(db, offer["item"]) == 4
    assert len(db.scalars(select(InventoryMove).where(InventoryMove.item_id == offer["item"])).all()) == 1


def test_seed_preserves_staff_theme_perks_and_inventory_settings(db):
    from app.db.seed import _upsert_inventory, _upsert_themes
    from app.models import User

    admin = db.scalar(select(User).where(User.email == "admin@mrworld.com"))
    item = db.scalar(select(InventoryItem).where(InventoryItem.sku == "TRK-SCARF"))
    original_stock = item.stock_qty
    item.name = "직원이 바꾼 이름"; item.is_active = False
    theme = db.scalar(select(Theme).where(Theme.slug == "trekking"))
    theme.perks[0].label = "직원이 바꾼 제공 내용"
    items = _upsert_inventory(db, admin); _upsert_themes(db, items)
    assert item.stock_qty == original_stock and item.name == "직원이 바꾼 이름" and not item.is_active
    assert theme.perks[0].label == "직원이 바꾼 제공 내용"
    db.rollback()


@pytest.mark.parametrize("slug,labels", [
    ("honeymoon", {"커플 기념티", "로맨틱 스페셜 룸 데코"}),
    ("parents", {"건강 인삼 기념품", "안마·지압 서비스 이용권"}),
    ("golf", {"유명 골프 리조트 테마 연출", "골프공 세트"}),
    ("trekking", {"트레킹·산악 테마 어드벤처 연출", "아웃도어 기념 스카프"}),
])
def test_four_theme_benefits_round_trip_and_inventory(client, db, staff_headers, slug, labels, replenish):
    theme = client.get(f"/api/v1/themes/{slug}").json()
    assert labels <= {p["label"] for p in theme["perks"]}
    headers = signup(client, uuid4().hex[:12]+"@test.com")
    card = next(p for p in client.get("/api/v1/packages").json() if p["theme"]["slug"] == slug)
    package = client.get(f"/api/v1/packages/{card['id']}").json()
    n = theme["min_travelers"]
    replenish(theme["perks"], n)
    dep = next(d for d in package["departures"] if d["status"] == "open" and d["remaining"] >= n and d["depart_date"] >= date.today().isoformat())
    before = {p["inventory_item_id"]: stock(db, p["inventory_item_id"]) for p in theme["perks"] if p["inventory_item_id"] is not None}
    res = client.post("/api/v1/bookings", headers=headers, json={"package_id": card["id"], "departure_id": dep["id"], "style_code": "grand" if theme["min_style_rank"] == 2 else "classic", "travelers_count": n,
            "travelers": [{"name": f"여행자{i}", "phone": "", "is_representative": i == 0} for i in range(n)]})
    assert res.status_code == 201, res.text
    bid = res.json()["id"]
    paid = client.post(f"/api/v1/bookings/{bid}/pay", headers=headers, json={"method": "card"})
    assert paid.status_code == 200 and paid.json()["status"] == "confirmed", paid.text
    saved = client.get(f"/api/v1/bookings/{bid}", headers=headers).json()
    assert saved["theme"]["perks"] == theme["perks"]
    for p in theme["perks"]:
        iid = p["inventory_item_id"]
        if iid is not None:assert stock(db, iid) == before[iid] - p["qty_per_booking"]*(n if p["per_person"] else 1)
    assert client.post(f"/api/v1/bookings/{bid}/cancel", headers=headers).status_code == 200
    assert all(stock(db, iid) == qty for iid,qty in before.items())
