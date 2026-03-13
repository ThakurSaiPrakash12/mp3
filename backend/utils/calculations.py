"""
calculations.py — Pure business formula functions.

All inventory math lives here: forecast, reorder, safety stock, profit.
No HTTP handling, no DB access. Results are deterministic given the same inputs.
"""


def calculate_forecast_daily(
    sales_today: float,
    sales_yesterday: float,
    sales_two_days_ago: float,
    avg_7_day_sales: float,
) -> float:
    """Return forecast_daily using weighted recent demand with 7-day fallback.

    Formula (when recent signal exists):
        forecast = 0.5 × today + 0.3 × yesterday + 0.2 × two_days_ago

    Fallback (when all three recent days are zero):
        forecast = avg_7_day_sales
    """
    has_recent_signal = (sales_today + sales_yesterday + sales_two_days_ago) > 0

    if has_recent_signal:
        return (
            0.5 * sales_today
            + 0.3 * sales_yesterday
            + 0.2 * sales_two_days_ago
        )

    return avg_7_day_sales


def calculate_inventory_metrics(
    stock: int,
    forecast_daily: float,
    lead_time: int,
) -> dict:
    """Compute safety stock, reorder point, and days of inventory.

    Returns:
        dict with keys: forecast_daily, safety_stock, reorder_point,
                        days_of_inventory
    """
    safety_stock = 2 * forecast_daily
    reorder_point = (forecast_daily * lead_time) + safety_stock
    days_of_inventory = (stock / forecast_daily) if forecast_daily > 0 else None

    return {
        "forecast_daily": round(forecast_daily, 2),
        "safety_stock": round(safety_stock, 2),
        "reorder_point": round(reorder_point, 2),
        "days_of_inventory": round(days_of_inventory, 1) if days_of_inventory is not None else None,
    }


def calculate_reorder_status(
    stock: int,
    min_stock: int,
    avg_daily_sales: float,
    lead_time: int,
    forecast_daily: float | None = None,
    safety_stock: float | None = None,
    reorder_point: float | None = None,
    days_of_inventory: float | None = None,
) -> dict:
    """Forecast-driven reorder logic with backward-compatible response fields.

    Status rules (in priority order):
        1. OUT_OF_STOCK  →  stock == 0
        2. CRITICAL      →  stock <= reorder_point
        3. LOW           →  stock < min_stock (and not critical)
        4. OK            →  otherwise

    Returns:
        dict with keys: status, reorder_required, reorder_level,
                        forecast_daily, safety_stock, reorder_point,
                        days_of_inventory
    """
    if forecast_daily is None:
        forecast_daily = avg_daily_sales if avg_daily_sales > 0 else 0

    if safety_stock is None:
        safety_stock = 2 * forecast_daily

    if reorder_point is None:
        reorder_point = (forecast_daily * lead_time) + safety_stock

    if days_of_inventory is None:
        days_of_inventory = (stock / forecast_daily) if forecast_daily > 0 else None

    # Backward-compatible legacy field expected by existing clients.
    reorder_level = int(round(reorder_point)) if reorder_point > 0 else min_stock

    if stock == 0:
        status = "OUT_OF_STOCK"
        reorder_required = True
    elif stock <= reorder_point:
        status = "CRITICAL"
        reorder_required = True
    elif stock < min_stock:
        status = "LOW"
        reorder_required = False
    else:
        status = "OK"
        reorder_required = False

    return {
        "status": status,
        "reorder_required": reorder_required,
        "reorder_level": reorder_level,
        "forecast_daily": round(forecast_daily, 2),
        "safety_stock": round(safety_stock, 2),
        "reorder_point": round(reorder_point, 2),
        "days_of_inventory": round(days_of_inventory, 1) if days_of_inventory is not None else None,
    }
