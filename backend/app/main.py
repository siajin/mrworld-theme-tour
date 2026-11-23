import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.db.base import create_schema
from app.db.session import SessionLocal, engine
from app.services.app_settings import ensure_defaults

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    # alembic 없이도 바로 뜨도록 테이블을 만들어 둔다 (이미 있으면 no-op).
    create_schema(engine)
    with SessionLocal() as db:
        ensure_defaults(db)
    yield


app = FastAPI(title="미스터 월드 테마 투어 API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Vercel Functions 의 배포 파일시스템은 읽기 전용이다. Blob 이 연결된
# 배포 환경에서는 업로드 파일이 Blob URL 로 제공되므로 로컬 media 마운트가
# 필요하지 않다. 로컬 개발 환경에서만 기존 디스크 저장소를 유지한다.
if not os.environ.get("BLOB_READ_WRITE_TOKEN"):
    media_dir = Path(settings.media_dir)
    media_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/media", StaticFiles(directory=str(media_dir)), name="media")

app.include_router(api_router)


@app.get("/", include_in_schema=False)
def root() -> dict[str, str]:
    return {"service": "mrworld-api", "docs": "/docs"}
