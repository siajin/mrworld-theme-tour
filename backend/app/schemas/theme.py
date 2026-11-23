from pydantic import BaseModel, Field

from app.schemas.common import TransportCode


class ThemePerkIn(BaseModel):
    label: str = Field(min_length=1, max_length=100)
    inventory_item_id: int | None = None
    qty_per_booking: int = Field(default=1, ge=1)
    per_person: bool = False


class ThemePerkOut(ThemePerkIn):
    id: int
    unit: str = "회"


class ThemeIn(BaseModel):
    slug: str = Field(min_length=1, max_length=50, pattern=r"^[a-z0-9\-]+$")
    name: str = Field(min_length=1, max_length=100)
    tagline: str = ""
    description: str = ""
    icon: str = ""
    hero_image: str = ""
    min_style_rank: int = Field(default=1, ge=1, le=3)
    min_travelers: int = Field(default=3, ge=1)
    vehicle_label: str = ""
    default_transport: TransportCode = "van_10"
    is_active: bool = True
    perks: list[ThemePerkIn] = []


class ThemeOut(BaseModel):
    id: int
    slug: str
    name: str
    tagline: str
    description: str
    icon: str
    hero_image: str
    min_style_rank: int
    min_travelers: int
    vehicle_label: str
    default_transport: TransportCode
    sort_order: int
    is_active: bool
    perks: list[ThemePerkOut]
    package_count: int | None = None
    from_price: int | None = None


class ThemeReorderIn(BaseModel):
    ids: list[int]


class ThemeBrief(BaseModel):
    id: int
    slug: str
    name: str
