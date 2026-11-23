from datetime import date
from uuid import uuid4

from sqlalchemy import select

from app.models import InventoryItem, MealAddon
from app.schemas.ai import ConversationIn
from app.services.voice_conversation import VoiceConversationService
from tests.conftest import signup


def turn(client, text, previous=None, **kwargs):
    response = client.post('/api/v1/ai/conversation', json={'text': text, 'state': previous['state'] if previous else None}, **kwargs)
    assert response.status_code == 200, response.text
    return response.json()


def test_professor_conversation_keeps_selections_and_actual_quote(client, demo_headers):
    state = turn(client, '', headers=demo_headers)
    assert '시아진' in state['reply']
    state = turn(client, '멋진 여행 상품 추천해 주세요', state)
    assert state['state']['stage'] == 'occasion'
    state = turn(client, '다음달 오늘 결혼해요', state)
    assert state['state']['theme_slug'] == 'honeymoon' and state['state']['desired_date']
    state = turn(client, '허니문 낭만 투어 좋겠어요', state)
    assert state['state']['stage'] == 'style'
    state = turn(client, '네 프리미엄 스타일 좋아요', state, headers=demo_headers)
    assert state['booking_options']['style_code'] == 'premium'
    assert '예약금' in state['reply'] and str(state['state']['departure_id'])
    state = turn(client, '그리고 식사시 커피 1포트 샴페인 1병 추가해요', state, headers=demo_headers)
    assert len(state['booking_options']['addons']) == 2
    assert all(a['qty'] == 1 for a in state['booking_options']['addons'])
    state = turn(client, '맞아요', state, headers=demo_headers)
    assert state['state']['stage'] == 'additional' and not state['ready_to_book']
    state = turn(client, '없어요', state, headers=demo_headers)
    assert state['ready_to_book'] and state['booking_options']['travelers_count'] == 2
    quote = client.post('/api/v1/bookings/quote', headers=demo_headers, json=state['booking_options'])
    assert quote.status_code == 200 and quote.json()['total'] == state['state']['quoted_total']


def test_changes_and_no_do_not_finalize_early(client):
    state = turn(client, '허니문 프리미엄 2명')
    state = turn(client, '아니요 그랜드로 바꿔줘', state)
    assert state['booking_options']['style_code'] == 'grand' and not state['ready_to_book']
    state = turn(client, '3명으로 바꿔', state)
    assert '2명' in state['reply'] and not state['ready_to_book']
    state = turn(client, '맞아요', state)
    state = turn(client, '커피 2포트 추가', state)
    assert state['state']['stage'] == 'confirm'
    state = turn(client, '커피 빼줘', state)
    assert state['state']['addons'] == []


def test_relative_date_month_end_and_invalid_dates(db):
    service = VoiceConversationService(db)
    result = service.respond(ConversationIn(text='다음달 오늘 결혼해요'), today=date(2026, 1, 31))
    assert result.state.desired_date == '2026-02-28'
    invalid = service.respond(ConversationIn(text='2월 31일 허니문 예약'), today=date(2026, 1, 1))
    assert '날짜' in invalid.reply and not invalid.ready_to_book


def test_unrecognized_and_reset_are_recoverable(client):
    first = turn(client, '허니문 프리미엄 2명')
    unknown = turn(client, '아무말 아무말', first)
    assert not unknown['ready_to_book'] and unknown['booking_options']
    reset = turn(client, '처음부터 다시 시작', unknown)
    assert reset['state']['stage'] == 'greeting' and reset['booking_options'] is None
    cancelled = turn(client, '취소해', first)
    assert cancelled['state']['package_id'] is None and not cancelled['ready_to_book']


def test_unknown_and_excessive_addons_do_not_break_request(client):
    first = turn(client, '허니문 프리미엄 2명')
    excessive = turn(client, '커피 999포트 추가', first)
    assert '20개' in excessive['reply'] and not excessive['ready_to_book']
    repeated = turn(client, '커피 1포트 추가', first)
    again = turn(client, '커피 1포트 추가', repeated)
    assert again['state']['addons'] == repeated['state']['addons']


def test_disabled_addon_and_tampered_state_reask(client, db):
    first = turn(client, '허니문 프리미엄 2명')
    row = db.scalar(select(MealAddon).where(MealAddon.label.contains('커피')))
    was_active = row.is_active
    try:
        row.is_active = False
        db.commit()
        result = turn(client, '커피 1포트 추가', first)
        assert '선택할 수 없' in result['reply'] and not result['ready_to_book']
    finally:
        row.is_active = was_active
        db.commit()
    first['state']['package_id'] = 999999
    first['state']['departure_id'] = 999999
    result = turn(client, '맞아요', first)
    assert result['state']['package_id'] != 999999 and not result['ready_to_book']


def test_conversation_to_real_booking_payment_and_inventory(client, db):
    """교수 대화의 최종 옵션을 기존 예약·결제 API에 전달해 실제 DB 차감을 확인한다."""
    headers = signup(client, uuid4().hex + '@voice-test.com', name='대화 검증 고객')
    items = {sku: db.scalar(select(InventoryItem).where(InventoryItem.sku == sku)) for sku in ['CPL-TEE', 'ROOM-DECO']}
    before = {sku: item.stock_qty for sku, item in items.items()}
    state = None
    for said in ['', '멋진 여행 상품 추천해 주세요', '다음달 오늘 결혼해요', '허니문 낭만 투어 좋겠어요',
                 '네 프리미엄 스타일 좋아요', '커피 1포트 샴페인 1병 추가해요', '맞아요', '없어요']:
        state = turn(client, said, state, headers=headers)
    assert state['ready_to_book']
    options = state['booking_options']
    assert options['style_code'] == 'premium' and options['travelers_count'] == 2
    assert len(options['addons']) == 2 and all(a['qty'] == 1 for a in options['addons'])
    created = client.post('/api/v1/bookings', headers=headers, json={**options, 'travelers': [
        {'name': '대화 검증 고객', 'phone': '', 'is_representative': True},
        {'name': '동행 1', 'phone': '', 'is_representative': False},
    ]})
    assert created.status_code == 201, created.text
    booking = created.json()
    assert booking['departure']['id'] == options['departure_id']
    assert booking['style_code'] == 'premium'
    paid = client.post(f"/api/v1/bookings/{booking['id']}/pay", headers=headers, json={'method': 'card'})
    assert paid.status_code == 200, paid.text
    saved = paid.json()
    assert saved['status'] == 'confirmed' and saved['quote']['total'] == state['state']['quoted_total']
    assert sorted((a['meal_addon_id'], a['qty']) for a in saved['addons']) == sorted((a['meal_addon_id'], a['qty']) for a in options['addons'])
    db.expire_all()
    assert db.get(InventoryItem, items['CPL-TEE'].id).stock_qty == before['CPL-TEE'] - 2
    assert db.get(InventoryItem, items['ROOM-DECO'].id).stock_qty == before['ROOM-DECO'] - 1
