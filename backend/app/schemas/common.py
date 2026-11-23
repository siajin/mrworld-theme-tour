from typing import Literal

Role = Literal["customer", "staff"]
StyleCode = Literal["classic", "grand", "premium"]
MealCode = Literal["lunchbox", "local", "fine_dining"]
TransportCode = Literal["sedan_2", "van_10", "limousine", "premium_bus_25"]
BookingStatus = Literal["pending", "gathering", "confirmed", "cancelled", "completed"]
DepartureStatus = Literal["open", "closed", "departed"]
HotelGrade = Literal[3, 4, 5]
LoyaltyTier = Literal["basic", "silver", "gold"]
