import os
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, status

from app.core.config import get_settings
from app.core.deps import StaffUser
from app.schemas.staff import UploadOut

router = APIRouter(prefix="/staff", tags=["staff:upload"])

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_BYTES = 10 * 1024 * 1024


def _matches_image_signature(ext: str, data: bytes) -> bool:
    """Reject obvious non-images without requiring an image-processing dependency."""
    if ext in (".jpg", ".jpeg"):
        return data.startswith(b"\xff\xd8\xff")
    if ext == ".png":
        return data.startswith(b"\x89PNG\r\n\x1a\n")
    if ext == ".gif":
        return data.startswith((b"GIF87a", b"GIF89a"))
    if ext == ".webp":
        return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    return False


def _has_blob() -> bool:
    """Vercel Blob 스토어가 연결돼 있으면 (배포 환경) 그쪽에 저장하고,
    아니면 (로컬 개발) 예전처럼 로컬 media/ 폴더에 저장한다."""
    return bool(os.environ.get("BLOB_READ_WRITE_TOKEN") or os.environ.get("VERCEL_OIDC_TOKEN"))


async def _save_to_blob(name: str, data: bytes) -> str:
    from vercel.blob import AsyncBlobClient  # 로컬엔 없어도 되게 지연 import

    client = AsyncBlobClient()
    blob = await client.put(f"staff-uploads/{name}", data, access="public", add_random_suffix=False)
    return blob.url


def _save_to_disk(name: str, data: bytes) -> str:
    media_dir = Path(get_settings().media_dir)
    media_dir.mkdir(parents=True, exist_ok=True)
    (media_dir / name).write_bytes(data)
    return f"/media/{name}"


@router.post("/upload", response_model=UploadOut)
async def upload(file: UploadFile, _: StaffUser) -> UploadOut:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "jpg, png, webp, gif 이미지만 올릴 수 있어요")
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "10MB 이하 이미지만 올릴 수 있어요")
    if not _matches_image_signature(ext, data):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "파일 내용이 올바른 이미지 형식인지 확인해 주세요")
    name = f"{uuid.uuid4().hex}{ext}"
    if _has_blob():
        url = await _save_to_blob(name, data)
    else:
        url = _save_to_disk(name, data)
    return UploadOut(url=url)
