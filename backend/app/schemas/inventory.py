from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class InventoryItemIn(BaseModel):
    sku: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=100)
    category: str = ""
    unit: str = "개"
    stock_qty: int = Field(default=0, ge=0)
    reorder_level: int = Field(default=0, ge=0)
    is_active: bool = True


class InventoryItemOut(BaseModel):
    id: int
    sku: str
    name: str
    category: str
    unit: str
    stock_qty: int
    reorder_level: int
    is_active: bool
    low_stock: bool


class InventoryMoveIn(BaseModel):
    type: Literal["in", "out", "adjust"]
    # adjust 는 음수 허용(재고 실사 보정), in/out 은 1 이상
    qty: int
    memo: str = ""


class InventoryMoveOut(BaseModel):
    id: int
    item_id: int
    item_name: str
    type: Literal["in", "out", "adjust"]
    qty: int
    ref_booking_id: int | None
    memo: str
    created_by_name: str
    created_at: datetime
