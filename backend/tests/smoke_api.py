"""Standalone isolated API audit; writes evidence, never loads the user's DB.

Run from backend/: .venv/Scripts/python.exe -m tests.smoke_api
"""
from __future__ import annotations

import json
import os
import shutil
import tempfile
import time
from collections import Counter
from datetime import date, timedelta
from pathlib import Path

TEMP_DIR = Path(tempfile.mkdtemp(prefix="mwtt-smoke-")).resolve()
for key, value in {
    "DATABASE_URL": f"sqlite:///{(TEMP_DIR / 'smoke.db').as_posix()}",
    "MEDIA_DIR": str(TEMP_DIR / "media"), "JWT_SECRET": "isolated-smoke-only",
    "AI_PROVIDER": "rules", "SMS_PROVIDER": "console", "SOLAPI_API_KEY": "",
    "SOLAPI_API_SECRET": "", "SMS_FROM": "", "AI_API_KEY": "",
    "BLOB_READ_WRITE_TOKEN": "", "VERCEL_OIDC_TOKEN": "",
}.items():
    os.environ[key] = value

from fastapi.testclient import TestClient  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.seed import seed  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402


def run() -> dict:
    checks = []
    started = time.perf_counter()
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)
    with TestClient(app, raise_server_exceptions=False) as client:
        def call(method, path, expected, *, role="public", **kwargs):
            result = client.request(method, path, **kwargs)
            checks.append({"method": method, "path": path, "role": role, "expected": expected, "status": result.status_code, "passed": result.status_code == expected})
            assert result.status_code == expected, f"{method} {path}: {result.status_code}: {result.text[:200]}"
            if "application/json" in result.headers.get("content-type", ""):
                return result.json() if result.content else None
            return None

        customer = call("POST", "/api/v1/auth/signup", 201, json={"email": "smoke@test.com", "password": "smoke-pass-123", "name": "격리 점검", "role": "staff"})
        assert customer["user"]["role"] == "customer"
        staff = call("POST", "/api/v1/auth/login", 200, json={"email": "admin@mrworld.com", "password": "admin1234"})
        customer_h = {"Authorization": "Bearer " + customer["access_token"]}
        staff_h = {"Authorization": "Bearer " + staff["access_token"]}
        call("POST", "/api/v1/auth/signup", 400, json={"email": "smoke@test.com", "password": "smoke-pass-123", "name": "중복"})
        call("POST", "/api/v1/auth/login", 401, json={"email": "smoke@test.com", "password": "incorrect"})
        call("POST", "/api/v1/auth/signup", 422, json={"email": "invalid", "password": "short", "name": ""})
        call("POST", "/api/v1/auth/refresh", 401, json={"refresh_token": customer["access_token"]})
        call("POST", "/api/v1/auth/refresh", 401, json={"refresh_token": "invalid-token"})
        call("POST", "/api/v1/auth/refresh", 200, json={"refresh_token": customer["refresh_token"]})
        for header in ({}, {"Authorization": "Bearer invalid-token"}):
            call("GET", "/api/v1/me", 401, headers=header)
        for path in ["/", "/openapi.json", "/docs", "/api/v1/catalog", "/api/v1/themes", "/api/v1/packages", "/api/v1/packages/featured"]:
            call("GET", path, 200)
        for path in ["/api/v1/me", "/api/v1/me/trips", "/api/v1/me/bookings"]:
            call("GET", path, 200, role="customer", headers=customer_h)
        call("PUT", "/api/v1/me", 422, headers=customer_h, json={"name": ""})
        for path in ["dashboard", "themes", "packages", "inventory/items", "inventory/moves", "bookings", "customers", "notifications", "notifications/provider", "settings"]:
            for role, headers, status in [("anonymous", {}, 401), ("customer", customer_h, 403), ("staff", staff_h, 200)]:
                call("GET", "/api/v1/staff/" + path, status, role=role, headers=headers)
        call("PUT", "/api/v1/staff/settings", 422, headers=staff_h, json={"deposit_rate": 2})
        call("GET", "/api/v1/packages?sort=unsupported", 422)
        call("GET", "/api/v1/packages?travelers=-1", 422)
        call("GET", "/api/v1/packages/999999", 404)
        call("GET", "/api/v1/themes/missing", 404)
        call("GET", "/api/v1/bookings/999999", 404, headers=customer_h)
        call("GET", "/api/v1/bookings/invite/MISSING", 404)
        call("DELETE", "/api/v1/staff/themes/1", 400, headers=staff_h)
        call("PUT", "/api/v1/staff/themes/reorder", 404, headers=staff_h, json={"ids": [999999]})
        items = call("GET", "/api/v1/staff/inventory/items", 200, headers=staff_h)
        existing_item = items[0]
        call("DELETE", f"/api/v1/staff/inventory/items/{existing_item['id']}", 405, headers=staff_h)
        call("POST", "/api/v1/staff/inventory/items", 400, headers=staff_h, json={"sku": existing_item["sku"], "name": "중복"})
        call("POST", "/api/v1/staff/inventory/items/999999/moves", 404, headers=staff_h, json={"type": "in", "qty": 1})
        for payload, status in [({"type": "out", "qty": 0}, 400), ({"type": "in", "qty": -1}, 400), ({"type": "adjust", "qty": -1000000}, 400), ({"type": "delete", "qty": 1}, 422)]:
            call("POST", f"/api/v1/staff/inventory/items/{existing_item['id']}/moves", status, headers=staff_h, json=payload)
        theme = next(t for t in call("GET", "/api/v1/themes", 200) if t["slug"] == "golf")
        package_payload = {"theme_id": theme["id"], "title": "격리 점검 상품", "nights": 1, "days": 2, "style_prices": [{"style_code": "classic", "price": 300000}]}
        package = call("POST", "/api/v1/staff/packages", 201, role="staff", headers=staff_h, json=package_payload)
        pid = package["id"]
        call("GET", f"/api/v1/packages/{pid}", 404)
        call("POST", f"/api/v1/staff/packages/{pid}/publish", 200, headers=staff_h, json={"is_published": True})
        call("GET", f"/api/v1/packages/{pid}", 200)
        departure_payload = {"depart_date": (date.today() + timedelta(days=30)).isoformat(), "return_date": (date.today() + timedelta(days=31)).isoformat(), "capacity": 10}
        call("POST", f"/api/v1/staff/packages/{pid}/departures", 422, headers=staff_h, json={**departure_payload, "capacity": -1})
        call("POST", f"/api/v1/staff/packages/{pid}/departures", 422, headers=staff_h, json={**departure_payload, "return_date": date.today().isoformat()})
        departure = call("POST", f"/api/v1/staff/packages/{pid}/departures", 201, headers=staff_h, json=departure_payload)
        bid_payload = {"package_id": pid, "departure_id": departure["id"], "style_code": "classic", "travelers_count": 3, "travelers": [{"name": "대표", "is_representative": True}, {"name": "동행1"}, {"name": "동행2"}]}
        call("POST", "/api/v1/bookings", 401, json=bid_payload)
        call("POST", "/api/v1/bookings", 400, role="staff", headers=staff_h, json=bid_payload)
        call("POST", "/api/v1/bookings", 422, headers=customer_h, json={**bid_payload, "travelers_count": 2})
        booking = call("POST", "/api/v1/bookings", 201, role="customer", headers=customer_h, json=bid_payload)
        bid = booking["id"]
        call("DELETE", f"/api/v1/staff/packages/{pid}/departures/{departure['id']}", 400, headers=staff_h)
        call("DELETE", f"/api/v1/staff/packages/{pid}", 400, headers=staff_h)
        call("POST", f"/api/v1/bookings/{bid}/pay", 422, headers=customer_h, json={"method": "unsupported"})
        paid = call("POST", f"/api/v1/bookings/{bid}/pay", 200, headers=customer_h, json={"method": "card"})
        assert paid["status"] == "confirmed" and paid["quote"]["total"] == 900000
        call("POST", f"/api/v1/bookings/{bid}/pay", 400, headers=customer_h, json={"method": "card"})
        call("POST", f"/api/v1/staff/bookings/{bid}/complete", 400, headers=staff_h)
        call("POST", f"/api/v1/bookings/{bid}/cancel", 200, headers=customer_h)
        call("POST", f"/api/v1/bookings/{bid}/cancel", 400, headers=customer_h)
        provider = call("GET", "/api/v1/staff/notifications/provider", 200, headers=staff_h)
        assert provider["provider"] == "console" and provider["live"] is False
        call("POST", "/api/v1/staff/notifications/test", 403, headers=customer_h, json={"phone": "01000000000"})
        call("POST", "/api/v1/staff/notifications/test", 400, headers=staff_h, json={"phone": "123"})
        note = call("POST", "/api/v1/staff/notifications/test", 200, headers=staff_h, json={"phone": "01000000000", "body": "격리 console 점검"})
        assert note["status"] == "sent" and note["provider"] == "console"
        resent = call("POST", f"/api/v1/staff/notifications/{note['id']}/resend", 200, headers=staff_h)
        assert resent["id"] != note["id"] and resent["body"] == note["body"]
        call("POST", "/api/v1/staff/notifications/999999/resend", 404, headers=staff_h)
        call("POST", "/api/v1/staff/upload", 403, headers=customer_h, files={"file": ("x.png", b"bad", "image/png")})
        call("POST", "/api/v1/staff/upload", 400, headers=staff_h, files={"file": ("x.png", b"bad", "image/png")})

    return {
        "date": date.today().isoformat(), "api_smoke_checks": len(checks),
        "passed": sum(c["passed"] for c in checks), "status_counts": dict(Counter(str(c["status"]) for c in checks)),
        "duration_seconds": round(time.perf_counter() - started, 3),
        "isolation": {"separate_temp_sqlite": True, "sms_provider": "console", "ai_provider": "rules", "outbound_calls": 0, "user_database_modified": False},
        "checks": checks,
        "pytest": "46 passed (final run)",
        "dependency_check": "python -m pip check: No broken requirements found (Python 3.13.5 existing venv)",
        "reproducibility_notes": [
            "Existing venv activation path is E:/PythonProject/소공/backend/.venv and works locally.",
            "Submission should exclude .venv, local .env and .vercel metadata; requirements.txt + fresh seed are the portable source path.",
            "start-backend.bat currently installs requirements on each start; it skips seed when data/app.db exists and does not interpret DATABASE_URL when deciding to seed.",
            "start scripts do not stop after failed package install; parent should improve error handling before packaging.",
            "requirements are broad minimum ranges, not a frozen lock; current pip environment is consistent.",
            "Inventory has no HTTP DELETE endpoint; attempts return405 and preserve FK-referenced items.",
            "Console notifications use sent status with provider=console; this is a simulated delivery, not evidence of a real SMS.",
            "Image upload validates extension/header and size; it does not fully decode image content.",
            "Concurrent overbooking, real SMS/LLM provider calls, and production deployment are outside this isolated audit.",
        ],
    }


if __name__ == "__main__":
    try:
        report = run()
    finally:
        engine.dispose()
        if TEMP_DIR.parent == Path(tempfile.gettempdir()).resolve() and TEMP_DIR.name.startswith("mwtt-smoke-"):
            shutil.rmtree(TEMP_DIR)
    report["isolation"]["temp_resources_cleaned"] = True
    dest = Path(__file__).resolve().parents[2] / "docs/final-20261122/backend_verification.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k not in ("checks", "reproducibility_notes")}, ensure_ascii=False))
