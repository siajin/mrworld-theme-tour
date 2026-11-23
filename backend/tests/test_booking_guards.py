"""Regression coverage for stale departures, premature completion and publication guards."""
from datetime import date, timedelta

import pytest

from tests.conftest import signup


def _new_pending(client, staff_headers, key: str, count: int = 1):
    owner = signup(client, f"guard-{key}@test.com", name="가드 대표자")
    package = client.get("/api/v1/packages?theme=golf").json()[0]
    depart = date.today() + timedelta(days=50)
    created_departure = client.post(
        f"/api/v1/staff/packages/{package['id']}/departures",
        json={"depart_date": depart.isoformat(), "return_date": (depart + timedelta(days=3)).isoformat(), "capacity": 10},
        headers=staff_headers,
    )
    assert created_departure.status_code == 201, created_departure.text
    departure = created_departure.json()
    booking = client.post(
        "/api/v1/bookings",
        json={"package_id": package["id"], "departure_id": departure["id"], "style_code": "classic",
              "travelers_count": count, "travelers": [
                  {"name": "가드 대표자", "is_representative": True},
                  *[{"name": f"동행{i}"} for i in range(1, count)],
              ]},
        headers=owner,
    )
    assert booking.status_code == 201, booking.text
    return owner, package, departure, booking.json()


def _close_or_expire(client, staff, package, departure, state):
    if state == "closed":
        payload = {**departure, "status": "closed"}
    else:
        past = date.today() - timedelta(days=5)
        payload = {**departure, "depart_date": past.isoformat(), "return_date": (past + timedelta(days=3)).isoformat()}
    result = client.put(f"/api/v1/staff/packages/{package['id']}/departures/{departure['id']}", json=payload, headers=staff)
    assert result.status_code == 200, result.text


@pytest.mark.parametrize("state", ["closed", "past"])
@pytest.mark.parametrize("action", ["pay", "confirm"])
def test_stale_pending_booking_cannot_be_paid_or_confirmed(client, staff_headers, state, action):
    owner, package, departure, booking = _new_pending(client, staff_headers, f"{action}-{state}")
    _close_or_expire(client, staff_headers, package, departure, state)
    if action == "pay":
        result = client.post(f"/api/v1/bookings/{booking['id']}/pay", json={"method": "card"}, headers=owner)
    else:
        result = client.post(f"/api/v1/staff/bookings/{booking['id']}/confirm", headers=staff_headers)
    assert result.status_code == 400, result.text
    after = client.get(f"/api/v1/bookings/{booking['id']}", headers=owner).json()
    assert after["status"] == "pending" and after["paid_at"] is None


@pytest.mark.parametrize("state", ["closed", "past"])
def test_stale_gathering_booking_rejects_travelers_and_invite_join(client, staff_headers, state):
    owner, package, departure, booking = _new_pending(client, staff_headers, f"join-{state}")
    paid = client.post(f"/api/v1/bookings/{booking['id']}/pay", json={"method": "card"}, headers=owner)
    assert paid.status_code == 200, paid.text
    invite = paid.json()["invite_code"]
    _close_or_expire(client, staff_headers, package, departure, state)
    assert client.post(f"/api/v1/bookings/{booking['id']}/travelers", json={"name": "직접 동행"}, headers=owner).status_code == 400
    friend = signup(client, f"guard-friend-{state}@test.com")
    assert client.post("/api/v1/bookings/join", json={"invite_code": invite}, headers=friend).status_code == 400
    after = client.get(f"/api/v1/bookings/{booking['id']}", headers=owner).json()
    assert after["status"] == "gathering" and after["travelers_count"] == 1


def test_another_customer_cannot_modify_booking(client, staff_headers):
    owner, _, _, booking = _new_pending(client, staff_headers, "ownership")
    stranger = signup(client, "guard-stranger@test.com")
    bid = booking["id"]
    for path, payload in [
        (f"/api/v1/bookings/{bid}/pay", {"method": "card"}),
        (f"/api/v1/bookings/{bid}/travelers", {"name": "무단 동행"}),
        (f"/api/v1/bookings/{bid}/cancel", None),
    ]:
        assert client.post(path, json=payload, headers=stranger).status_code == 403
    assert client.delete(f"/api/v1/bookings/{bid}/travelers/{booking['travelers'][0]['id']}", headers=stranger).status_code == 403
    after = client.get(f"/api/v1/bookings/{bid}", headers=owner).json()
    assert after["status"] == "pending" and after["travelers_count"] == 1


def test_direct_package_save_cannot_publish_without_style_prices(client, staff_headers):
    theme = client.get("/api/v1/themes").json()[0]
    payload = {"theme_id": theme["id"], "title": "가격 없는 상품", "nights": 1, "days": 2, "is_published": True, "style_prices": []}
    rejected = client.post("/api/v1/staff/packages", json=payload, headers=staff_headers)
    assert rejected.status_code == 400, rejected.text
    draft = client.post("/api/v1/staff/packages", json={**payload, "is_published": False}, headers=staff_headers)
    assert draft.status_code == 201, draft.text
    package_id = draft.json()["id"]
    rejected = client.put(f"/api/v1/staff/packages/{package_id}", json=payload, headers=staff_headers)
    assert rejected.status_code == 400, rejected.text
    assert client.get(f"/api/v1/packages/{package_id}").status_code == 404
    assert client.delete(f"/api/v1/staff/packages/{package_id}", headers=staff_headers).status_code == 204


def test_inactive_theme_packages_are_hidden_from_all_customer_entry_points(client, staff_headers, db):
    from app.models import Theme

    owner, package, departure, _ = _new_pending(client, staff_headers, "inactive-theme")
    theme_id = package["theme"]["id"]
    theme = db.get(Theme, theme_id)
    theme.is_active = False
    db.commit()
    try:
        cards = client.get("/api/v1/packages").json()
        assert all(p["theme"]["id"] != theme_id for p in cards)
        featured = client.get("/api/v1/packages/featured").json()
        assert all(p["theme"]["id"] != theme_id for p in featured["popular"] + featured["closing_soon"])
        assert client.get(f"/api/v1/packages/{package['id']}").status_code == 404
        assert client.get(f"/api/v1/packages/{package['id']}/departures").status_code == 404
        quote = client.post("/api/v1/bookings/quote", json={"package_id": package["id"], "departure_id": departure["id"], "style_code": "classic", "travelers_count": 1}, headers=owner)
        assert quote.status_code == 404
        parsed = client.post("/api/v1/ai/parse", json={"text": "골프 여행 추천"}).json()
        assert package["id"] not in parsed["matched_package_ids"]
        assert client.get(f"/api/v1/staff/packages/{package['id']}", headers=staff_headers).status_code == 200
    finally:
        db.refresh(theme)
        theme.is_active = True
        db.commit()
