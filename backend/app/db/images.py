"""시드용 이미지 URL 매핑.

1단계에서는 Unsplash 원본 URL을 그대로 쓴다(브라우저가 직접 로드).
오프라인 데모가 필요하면 frontend/scripts/fetch-images.mjs 로 내려받은 뒤
USE_LOCAL_IMAGES=1 환경변수로 시드를 다시 실행하면 /images/... 로컬 경로로 저장된다.
"""
from __future__ import annotations

import os

_U = "https://images.unsplash.com/{id}?auto=format&fit=crop&w={w}&q=80"


def _u(photo_id: str, w: int = 1400) -> str:
    return _U.format(id=photo_id, w=w)


# 패키지 slug → 사진 3장 (Unsplash photo id)
PACKAGE_PHOTOS: dict[str, list[str]] = {
    "bali-honeymoon": ["photo-1555400038-63f5ba517a47", "photo-1544644181-1484b3fdfc62", "photo-1592364395653-83e648b20cc2"],
    "santorini-honeymoon": ["photo-1672622851784-0dbd3df4c088", "photo-1509321528270-797a4f7c1485", "photo-1658780986409-a406f44bfc8d"],
    "jeju-honeymoon": ["photo-1729432530349-1e53f643e997", "photo-1628411848698-e3b3249a272a", "photo-1613186448181-7ba25cc0ff2a"],
    "kyushu-parents": ["photo-1752917868539-c4d8e3bc0804", "photo-1558869632-81053b328001", "photo-1752917870379-ed88be3c2050"],
    "zhangjiajie-parents": ["photo-1567266565245-c08dc046815f", "photo-1743093263638-845bee7205c0", "photo-1743093263841-37c2edb04ed2"],
    "gangwon-parents": ["photo-1720252741302-77213465eab2", "photo-1684042229029-8a899193a8e4", "photo-1669303375352-a71d05fa5342"],
    "danang-golf": ["photo-1603852452378-a4e8d84324a2", "photo-1783095260961-b85d8cee49ef", "photo-1741138327956-dfa75763b50d"],
    "jeju-golf": ["photo-1694720971856-a5fb5da97173", "photo-1612977512598-3b8d6a498bbb", "photo-1779418419321-9d11517114ea"],
    "chiangmai-golf": ["photo-1700667315305-ef2a027f9078", "photo-1714240230125-531572031bbf", "photo-1775686318424-9987122d8402"],
    "poonhill-trekking": ["photo-1676477766644-0fd84d688cde", "photo-1665394182736-a5fc0aabbcea", "photo-1652501836149-ab1b0f220a37"],
    "jirisan-trekking": ["photo-1704961254037-bb105fe556bf", "photo-1728478168078-58a14ad9dfb9", "photo-1728479503877-fe7a59bc02ee"],
    "hokkaido-trekking": ["photo-1694155011869-6ec870281cfa", "photo-1626923533342-6ebef8ff9080", "photo-1656339412007-c8959fdbd020"],
}

# 테마 slug → 대표 사진
THEME_PHOTOS: dict[str, str] = {
    "honeymoon": "photo-1759139757888-5a546427f90f",
    "parents": "photo-1508963493744-76fce69379c0",
    "golf": "photo-1593282153762-a41e3cceb06c",
    "trekking": "photo-1767756604614-615245c5e8f3",
}

# 홈 히어로 / 이벤트 배너 (프론트가 직접 쓰는 값과 동일하게 유지)
HERO_PHOTO = "photo-1780734790397-6dfa3329704c"

USE_LOCAL = os.environ.get("USE_LOCAL_IMAGES") == "1"


def package_images(slug: str) -> list[str]:
    if USE_LOCAL:
        return [f"/images/packages/{slug}-{i}.jpg" for i in (1, 2, 3)]
    ids = PACKAGE_PHOTOS.get(slug)
    if not ids:
        return [f"/images/packages/{slug}-{i}.jpg" for i in (1, 2, 3)]
    return [_u(i) for i in ids]


def theme_image(slug: str) -> str:
    if USE_LOCAL:
        return f"/images/themes/{slug}.jpg"
    pid = THEME_PHOTOS.get(slug)
    return _u(pid, 1600) if pid else f"/images/themes/{slug}.jpg"


def all_downloads() -> list[tuple[str, str]]:
    """(로컬 저장 경로, URL) 목록 — fetch 스크립트용."""
    out: list[tuple[str, str]] = []
    for slug, ids in PACKAGE_PHOTOS.items():
        for i, pid in enumerate(ids, 1):
            out.append((f"images/packages/{slug}-{i}.jpg", _u(pid)))
    for slug, pid in THEME_PHOTOS.items():
        out.append((f"images/themes/{slug}.jpg", _u(pid, 1600)))
    out.append(("images/hero.jpg", _u(HERO_PHOTO, 1800)))
    return out
