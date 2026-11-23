"""허니문 2인 전용은 차량 선택·직접 API 호출로 우회할 수 없다."""
from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.models import Booking, InventoryMove
from tests.conftest import signup


@pytest.fixture()
def honeymoon(client):
    card = client.get('/api/v1/packages?theme=honeymoon').json()[0]
    package = client.get(f"/api/v1/packages/{card['id']}").json()
    dep = next(d for d in package['departures'] if d['status'] == 'open' and d['remaining'] >= 4 and d['depart_date'] >= date.today().isoformat())
    return dict(package_id=package['id'], departure_id=dep['id'], style_code='grand', transport_code='van_10')


@pytest.mark.parametrize('vehicle', ['sedan_2', 'van_10', 'limousine', 'premium_bus_25'])
def test_three_honeymoon_travelers_rejected_for_every_vehicle(client, honeymoon, vehicle):
    owner = signup(client, uuid4().hex+'@test.com')
    req = {**honeymoon, 'transport_code': vehicle, 'travelers_count': 3}
    quote = client.post('/api/v1/bookings/quote', json=req)
    assert quote.status_code == 400 and '허니문' in quote.json()['detail']
    created = client.post('/api/v1/bookings', headers=owner, json={**req, 'travelers': [
        {'name': f'여행자{i}', 'is_representative': i == 0} for i in range(3)
    ]})
    assert created.status_code == 400 and '2인 전용' in created.json()['detail']
    assert client.get('/api/v1/me/bookings', headers=owner).json() == []


def test_pending_honeymoon_cannot_add_third_traveler_with_large_vehicle(client, honeymoon):
    owner = signup(client, uuid4().hex+'@test.com')
    made = client.post('/api/v1/bookings', headers=owner, json={**honeymoon, 'travelers_count': 1,
        'travelers': [{'name': '대표자', 'is_representative': True}]})
    assert made.status_code == 201, made.text
    bid = made.json()['id']
    assert client.post(f'/api/v1/bookings/{bid}/travelers', headers=owner, json={'name': '배우자'}).status_code == 200
    rejected = client.post(f'/api/v1/bookings/{bid}/travelers', headers=owner, json={'name': '세번째'})
    assert rejected.status_code == 400 and '2인 전용' in rejected.json()['detail']
    saved = client.get(f'/api/v1/bookings/{bid}', headers=owner).json()
    assert saved['travelers_count'] == len(saved['travelers']) == 2


@pytest.mark.parametrize('action', ['pay', 'confirm'])
def test_preexisting_oversized_honeymoon_cannot_pay_or_be_confirmed(client, db, honeymoon, staff_headers, action):
    owner = signup(client, uuid4().hex+'@test.com')
    made = client.post('/api/v1/bookings', headers=owner, json={**honeymoon, 'travelers_count': 2,
        'travelers': [{'name': '대표자', 'is_representative': True}, {'name': '배우자'}]})
    assert made.status_code == 201, made.text
    bid = made.json()['id']
    row = db.get(Booking, bid); row.travelers_count = 3; db.commit()
    if action == 'pay':res = client.post(f'/api/v1/bookings/{bid}/pay', headers=owner, json={'method': 'card'})
    else:res = client.post(f'/api/v1/staff/bookings/{bid}/confirm', headers=staff_headers)
    assert res.status_code == 400 and '2인 전용' in res.json()['detail']
    db.expire_all(); row = db.get(Booking, bid)
    assert row.status == 'pending' and row.paid_at is None
    assert not db.scalars(select(InventoryMove).where(InventoryMove.ref_booking_id == bid)).all()
    row.travelers_count = 2; db.commit()
