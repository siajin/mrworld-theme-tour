"""테스트는 임시 SQLite 파일을 쓴다. app 모듈을 불러오기 전에 DATABASE_URL 을 덮어써야 한다."""
import os
import shutil
import tempfile
from collections.abc import Iterator
from pathlib import Path

_TMP_DIR = tempfile.mkdtemp(prefix="mrworld-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_TMP_DIR, 'test.db').as_posix()}"
os.environ["MEDIA_DIR"] = str(Path(_TMP_DIR, "media"))
os.environ["JWT_SECRET"] = "test-secret"
os.environ["AI_PROVIDER"] = "rules"
# 테스트는 절대 실제 문자를 보내지 않는다 (.env 에 solapi 키가 있어도 무시)
os.environ["SMS_PROVIDER"] = "console"
os.environ["SOLAPI_API_KEY"] = ""
os.environ["SOLAPI_API_SECRET"] = ""
os.environ["SMS_FROM"] = ""

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.db.base import Base  # noqa: E402
from app.db.seed import seed  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def seeded_db() -> Iterator[None]:
    try:
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as db:
            seed(db)
        yield
    finally:
        engine.dispose()
        # This exact directory is created by mkdtemp above, never the user DB.
        test_dir = Path(_TMP_DIR).resolve()
        if test_dir.parent == Path(tempfile.gettempdir()).resolve() and test_dir.name.startswith("mrworld-test-"):
            shutil.rmtree(test_dir)


@pytest.fixture(scope="session")
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def db() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def login(client: TestClient, email: str, password: str) -> dict[str, str]:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def signup(client: TestClient, email: str, name: str = "테스터", password: str = "test1234") -> dict[str, str]:
    res = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": password, "name": name, "phone": "010-0000-0000", "address": "서울"},
    )
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@pytest.fixture(scope="session")
def staff_headers(client: TestClient) -> dict[str, str]:
    return login(client, "admin@mrworld.com", "admin1234")


@pytest.fixture(scope="session")
def demo_headers(client: TestClient) -> dict[str, str]:
    return login(client, "demo@customer.com", "demo1234")
