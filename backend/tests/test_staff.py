"""직원 API: 권한(403), 테마·상품 CRUD, 창고 이동, 대시보드, 설정."""
from datetime import date, timedelta

from tests.conftest import signup


def test_customer_gets_403_on_staff_routes(client, demo_headers):
    for path in ("/api/v1/staff/dashboard", "/api/v1/staff/themes", "/api/v1/staff/packages", "/api/v1/staff/inventory/items", "/api/v1/staff/bookings", "/api/v1/staff/customers", "/api/v1/staff/notifications", "/api/v1/staff/settings"):
        res = client.get(path, headers=demo_headers)
        assert res.status_code == 403, path
    assert client.get("/api/v1/staff/dashboard").status_code == 401


def test_signup_is_always_customer_and_password_min_6(client):
    res = client.post("/api/v1/auth/signup", json={"email": "short@test.com", "password": "12345", "name": "짧음", "phone": "", "address": ""})
    assert res.status_code == 422
    res = client.post("/api/v1/auth/signup", json={"email": "role@test.com", "password": "123456", "name": "고객", "phone": "", "address": "", "role": "staff"})
    assert res.status_code == 201 and res.json()["user"]["role"] == "customer"
    assert client.post("/api/v1/auth/signup", json={"email": "role@test.com", "password": "123456", "name": "중복", "phone": "", "address": ""}).status_code == 400
    bad = client.post("/api/v1/auth/login", json={"email": "role@test.com", "password": "wrong!"})
    assert bad.status_code == 401
    refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": res.json()["refresh_token"]})
    assert refresh.status_code == 200 and refresh.json()["token_type"] == "bearer"
    # access 토큰을 refresh 로 쓰면 401
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": res.json()["access_token"]}).status_code == 401


def test_long_password_is_not_truncated_at_bcrypt_limit(client):
    password = "a" * 80 + "correct-tail"
    res = client.post("/api/v1/auth/signup", json={"email": "long-password@test.com", "password": password, "name": "긴 비밀번호"})
    assert res.status_code == 201, res.text
    assert client.post("/api/v1/auth/login", json={"email": "long-password@test.com", "password": password}).status_code == 200
    # The first 72 bytes are identical: legacy bcrypt alone accepted this too.
    assert client.post("/api/v1/auth/login", json={"email": "long-password@test.com", "password": "a" * 80 + "wrong-tail"}).status_code == 401


def test_theme_crud_and_reorder(client, staff_headers):
    items = client.get("/api/v1/staff/inventory/items", headers=staff_headers).json()
    payload = {
        "slug": "family", "name": "가족 여행", "tagline": "아이와 함께", "description": "온 가족이 편한 일정", "icon": "users",
        "hero_image": "/images/themes/family.jpg", "min_style_rank": 1, "min_travelers": 3, "vehicle_label": "10인승 밴",
        "default_transport": "van_10", "is_active": True,
        "perks": [{"label": "패밀리 키트", "inventory_item_id": items[0]["id"], "qty_per_booking": 1, "per_person": False}],
    }
    created = client.post("/api/v1/staff/themes", json=payload, headers=staff_headers)
    assert created.status_code == 201, created.text
    theme = created.json()
    assert theme["slug"] == "family" and len(theme["perks"]) == 1 and theme["sort_order"] == 5

    # 중복 슬러그
    assert client.post("/api/v1/staff/themes", json=payload, headers=staff_headers).status_code == 400

    updated = client.put(f"/api/v1/staff/themes/{theme['id']}", json={**payload, "name": "패밀리 투어", "perks": []}, headers=staff_headers).json()
    assert updated["name"] == "패밀리 투어" and updated["perks"] == []

    # 고객 목록은 활성 테마만, 직원 목록은 전체
    assert any(t["slug"] == "family" for t in client.get("/api/v1/themes").json())
    client.put(f"/api/v1/staff/themes/{theme['id']}", json={**payload, "is_active": False}, headers=staff_headers)
    assert all(t["slug"] != "family" for t in client.get("/api/v1/themes").json())
    assert any(t["slug"] == "family" for t in client.get("/api/v1/staff/themes", headers=staff_headers).json())

    # 순서 변경
    all_themes = client.get("/api/v1/staff/themes", headers=staff_headers).json()
    ids = [t["id"] for t in all_themes]
    reordered = client.put("/api/v1/staff/themes/reorder", json={"ids": list(reversed(ids))}, headers=staff_headers).json()
    assert [t["id"] for t in reordered] == list(reversed(ids))
    client.put("/api/v1/staff/themes/reorder", json={"ids": ids}, headers=staff_headers)

    # 패키지가 있는 테마는 삭제 불가, 빈 테마는 삭제 가능
    honeymoon = next(t for t in all_themes if t["slug"] == "honeymoon")
    assert client.delete(f"/api/v1/staff/themes/{honeymoon['id']}", headers=staff_headers).status_code == 400
    assert client.delete(f"/api/v1/staff/themes/{theme['id']}", headers=staff_headers).status_code == 204
    assert client.get("/api/v1/staff/themes", headers=staff_headers).json().__len__() == 4


def test_package_crud_publish_and_departures(client, staff_headers):
    golf = next(t for t in client.get("/api/v1/themes").json() if t["slug"] == "golf")
    payload = {
        "theme_id": golf["id"], "title": "테스트 골프 2일", "subtitle": "부제", "region": "경주", "country": "대한민국",
        "nights": 1, "days": 2, "hero_images": ["/images/packages/test-1.jpg"], "summary": "요약", "highlights": ["하이라이트"],
        "includes": ["전용 차량"], "excludes": ["개인 경비"], "notes": "", "badges": ["신규"],
        "style_prices": [{"style_code": "classic", "price": 300000}, {"style_code": "grand", "price": 400000}],
        "itinerary": [{"day_no": 1, "title": "1일차", "places": ["경주 CC"], "meals": {"breakfast": "-", "lunch": "클럽하우스", "dinner": "한정식"}, "lodging": "경주 호텔", "description": "라운딩"}],
        "is_published": False,
    }
    created = client.post("/api/v1/staff/packages", json=payload, headers=staff_headers)
    assert created.status_code == 201, created.text
    pkg = created.json()
    assert pkg["from_price"] == 300000 and pkg["from_style"] == "classic" and pkg["is_published"] is False
    assert pkg["style_prices"][0]["available"] is True
    assert pkg["itinerary"][0]["meals"]["lunch"] == "클럽하우스"

    # 비공개 상품은 고객에게 404
    assert client.get(f"/api/v1/packages/{pkg['id']}").status_code == 404

    # 스타일 가격 갱신 (제자리 갱신 + premium 추가)
    updated = client.put(
        f"/api/v1/staff/packages/{pkg['id']}",
        json={**payload, "style_prices": [{"style_code": "classic", "price": 350000}, {"style_code": "premium", "price": 700000}]},
        headers=staff_headers,
    )
    assert updated.status_code == 200, updated.text
    assert {sp["style_code"]: sp["price"] for sp in updated.json()["style_prices"]} == {"classic": 350000, "premium": 700000}

    # 허니문 테마에 classic 가격 → 400
    honeymoon = next(t for t in client.get("/api/v1/themes").json() if t["slug"] == "honeymoon")
    bad = client.put(f"/api/v1/staff/packages/{pkg['id']}", json={**payload, "theme_id": honeymoon["id"]}, headers=staff_headers)
    assert bad.status_code == 400

    # 출발일정 CRUD
    depart = date.today() + timedelta(days=30)
    dep = client.post(f"/api/v1/staff/packages/{pkg['id']}/departures", json={"depart_date": depart.isoformat(), "return_date": (depart + timedelta(days=1)).isoformat(), "capacity": 8, "status": "open"}, headers=staff_headers)
    assert dep.status_code == 201 and dep.json()["remaining"] == 8
    did = dep.json()["id"]
    upd = client.put(f"/api/v1/staff/packages/{pkg['id']}/departures/{did}", json={"depart_date": depart.isoformat(), "return_date": (depart + timedelta(days=1)).isoformat(), "capacity": 10, "status": "closed"}, headers=staff_headers)
    assert upd.json()["capacity"] == 10 and upd.json()["status"] == "closed"

    # 공개 → 고객 목록에 노출, 검색 필터
    published = client.post(f"/api/v1/staff/packages/{pkg['id']}/publish", json={"is_published": True}, headers=staff_headers).json()
    assert published["is_published"] is True
    assert any(c["id"] == pkg["id"] for c in client.get("/api/v1/packages?theme=golf&q=경주").json())
    assert all(c["id"] != pkg["id"] for c in client.get("/api/v1/packages?theme=honeymoon").json())
    assert client.get(f"/api/v1/packages/{pkg['id']}").json()["next_departure"] is None  # closed 만 있음

    assert client.delete(f"/api/v1/staff/packages/{pkg['id']}/departures/{did}", headers=staff_headers).status_code == 204
    assert client.delete(f"/api/v1/staff/packages/{pkg['id']}", headers=staff_headers).status_code == 204
    assert client.get(f"/api/v1/staff/packages/{pkg['id']}", headers=staff_headers).status_code == 404


def test_inventory_items_and_moves(client, staff_headers):
    created = client.post("/api/v1/staff/inventory/items", json={"sku": "TEST-ITEM", "name": "테스트 물품", "category": "기타", "unit": "개", "stock_qty": 5, "reorder_level": 10, "is_active": True}, headers=staff_headers)
    assert created.status_code == 201
    item = next(i for i in created.json() if i["sku"] == "TEST-ITEM")
    assert item["low_stock"] is True

    after_in = client.post(f"/api/v1/staff/inventory/items/{item['id']}/moves", json={"type": "in", "qty": 20, "memo": "입고"}, headers=staff_headers).json()
    assert after_in["stock_qty"] == 25 and after_in["low_stock"] is False
    after_out = client.post(f"/api/v1/staff/inventory/items/{item['id']}/moves", json={"type": "out", "qty": 5, "memo": "출고"}, headers=staff_headers).json()
    assert after_out["stock_qty"] == 20
    assert client.post(f"/api/v1/staff/inventory/items/{item['id']}/moves", json={"type": "out", "qty": 999, "memo": ""}, headers=staff_headers).status_code == 400
    after_adj = client.post(f"/api/v1/staff/inventory/items/{item['id']}/moves", json={"type": "adjust", "qty": -3, "memo": "실사"}, headers=staff_headers).json()
    assert after_adj["stock_qty"] == 17

    moves = client.get(f"/api/v1/staff/inventory/moves?item_id={item['id']}", headers=staff_headers).json()
    assert [m["type"] for m in moves] == ["adjust", "out", "in", "in"]
    assert moves[0]["created_by_name"] == "김운영" and moves[0]["item_name"] == "테스트 물품"

    updated = client.put(f"/api/v1/staff/inventory/items/{item['id']}", json={"sku": "TEST-ITEM", "name": "이름 변경", "category": "기타", "unit": "개", "stock_qty": 0, "reorder_level": 1, "is_active": False}, headers=staff_headers).json()
    assert updated["name"] == "이름 변경" and updated["stock_qty"] == 17  # 재고는 이력으로만 변경


def test_staff_bookings_confirm_cancel_and_customers(client, staff_headers):
    user = signup(client, "staffflow@test.com", name="직원흐름")
    package = next(p for p in client.get("/api/v1/packages?theme=trekking").json())
    departure = package["next_departure"]
    res = client.post("/api/v1/bookings", json={"package_id": package["id"], "departure_id": departure["id"], "style_code": "classic", "travelers_count": 1, "travelers": [{"name": "직원흐름", "phone": "", "is_representative": True}]}, headers=user)
    bid = res.json()["id"]

    listed = client.get("/api/v1/staff/bookings?status=pending&q=직원흐름", headers=staff_headers).json()
    assert any(b["id"] == bid for b in listed)

    confirmed = client.post(f"/api/v1/staff/bookings/{bid}/confirm", headers=staff_headers).json()
    assert confirmed["status"] == "confirmed" and confirmed["paid_at"] is not None
    assert client.post(f"/api/v1/staff/bookings/{bid}/confirm", headers=staff_headers).status_code == 400
    cancelled = client.post(f"/api/v1/staff/bookings/{bid}/cancel", headers=staff_headers).json()
    assert cancelled["status"] == "cancelled"
    assert client.post(f"/api/v1/staff/bookings/{bid}/complete", headers=staff_headers).status_code == 400

    notes = client.get("/api/v1/staff/notifications?limit=5", headers=staff_headers).json()
    assert notes[0]["template"] == "booking_cancelled" and notes[0]["user_name"] == "직원흐름"

    customers = client.get("/api/v1/staff/customers?q=직원흐름", headers=staff_headers).json()
    assert len(customers) == 1 and customers[0]["bookings_count"] == 0  # 취소는 제외
    detail = client.get(f"/api/v1/staff/customers/{customers[0]['id']}", headers=staff_headers).json()
    assert detail["user"]["email"] == "staffflow@test.com" and len(detail["bookings"]) == 1


def test_dashboard_and_settings(client, staff_headers):
    dash = client.get("/api/v1/staff/dashboard", headers=staff_headers).json()
    assert dash["gathering_bookings"] >= 1
    assert len(dash["upcoming_departures"]) > 0 and "package_title" in dash["upcoming_departures"][0]
    assert any(i["sku"] == "GLF-ACC" for i in dash["low_stock_items"])
    assert len(dash["recent_bookings"]) <= 10 and len(dash["recent_notifications"]) <= 10

    settings = client.get("/api/v1/staff/settings", headers=staff_headers).json()
    assert settings["loyalty_silver_trips"] == 3 and settings["deposit_rate"] == 0.1
    updated = client.put("/api/v1/staff/settings", json={"loyalty_silver_rate": 0.07}, headers=staff_headers).json()
    assert updated["loyalty_silver_rate"] == 0.07
    assert client.get("/api/v1/catalog").json()["settings"]["loyalty_silver_rate"] == 0.07
    client.put("/api/v1/staff/settings", json={"loyalty_silver_rate": 0.05}, headers=staff_headers)


def test_upload(client, staff_headers, demo_headers):
    files = {"file": ("photo.jpg", b"\xff\xd8\xff\xe0fakejpeg", "image/jpeg")}
    assert client.post("/api/v1/staff/upload", files=files, headers=demo_headers).status_code == 403
    res = client.post("/api/v1/staff/upload", files=files, headers=staff_headers)
    assert res.status_code == 200 and res.json()["url"].startswith("/media/") and res.json()["url"].endswith(".jpg")
    assert client.get(res.json()["url"]).status_code == 200
    assert client.post("/api/v1/staff/upload", files={"file": ("x.exe", b"MZ", "application/octet-stream")}, headers=staff_headers).status_code == 400


def test_upload_rejects_empty_and_mislabeled_images(client, staff_headers):
    for name, content, mime in [
        ("empty.png", b"", "image/png"),
        ("script.jpg", b"<script>alert('x')</script>", "image/jpeg"),
        ("renamed.webp", b"\x89PNG\r\n\x1a\n", "image/webp"),
    ]:
        response = client.post("/api/v1/staff/upload", files={"file": (name, content, mime)}, headers=staff_headers)
        assert response.status_code == 400, response.text
