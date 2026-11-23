from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from app.core.deps import DbDep, StaffUser
from app.models import Notification
from app.schemas.notification import NotificationOut, SmsProviderStatus, SmsTestIn
from app.services.notification import NotificationService, normalize_phone, provider_status
from app.services.presenters import notification_out

router = APIRouter(prefix="/staff/notifications", tags=["staff:notifications"])


@router.get("", response_model=list[NotificationOut])
def list_notifications(db: DbDep, _: StaffUser, limit: int = Query(default=50, ge=1, le=500)) -> list[NotificationOut]:
    rows = db.scalars(select(Notification).order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit)).all()
    return [notification_out(n) for n in rows]


@router.get("/provider", response_model=SmsProviderStatus)
def get_provider_status(_: StaffUser) -> SmsProviderStatus:
    return SmsProviderStatus(**provider_status())


@router.post("/test", response_model=NotificationOut)
def send_test(payload: SmsTestIn, db: DbDep, staff: StaffUser) -> NotificationOut:
    if len(normalize_phone(payload.phone)) < 9:
        raise HTTPException(status_code=400, detail="휴대폰 번호를 확인해 주세요")
    row = NotificationService(db).send_test(staff, payload.phone, payload.body.strip() or "미스터 월드 문자 발송 테스트입니다.")
    db.commit()
    db.refresh(row)
    return notification_out(row)


@router.post("/{notification_id}/resend", response_model=NotificationOut)
def resend(notification_id: int, db: DbDep, _: StaffUser) -> NotificationOut:
    original = db.get(Notification, notification_id)
    if not original:
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없어요")
    row = NotificationService(db).resend(original)
    db.commit()
    db.refresh(row)
    return notification_out(row)
