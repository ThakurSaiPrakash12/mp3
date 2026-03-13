"""
forecast_service.py — Demand forecasting business logic.

Replaces forecast_engine.py. All formulas are unchanged.
Uses forecast_repository for DB access, utils.calculations for math.
"""

from datetime import datetime
from typing import Any

from repositories.forecast_repository import get_product_for_forecast, get_sales_windows
from repositories.product_repository import get_all_product_ids
from utils.calculations import calculate_forecast_daily


# ── Constants ──────────────────────────────────────────────────────────────────
WEIGHT_TODAY = 0.5
WEIGHT_YESTERDAY = 0.3
WEIGHT_TWO_DAYS_AGO = 0.2
SAFETY_STOCK_DAYS = 2


# ── Private helpers ────────────────────────────────────────────────────────────

def _weighted_forecast(windows: dict) -> tuple[float, str]:
    """Return (forecast_value, method_name)."""
    today = windows["sales_today"]
    yesterday = windows["sales_yesterday"]
    two_ago = windows["sales_two_days_ago"]
    avg_7d = windows["avg_7d"]

    if (today + yesterday + two_ago) > 0:
        forecast = (
            WEIGHT_TODAY * today
            + WEIGHT_YESTERDAY * yesterday
            + WEIGHT_TWO_DAYS_AGO * two_ago
        )
        return forecast, "weighted_recent_3_days"

    return avg_7d, "avg_7_day_fallback"


def _detect_trend(windows: dict) -> str:
    """Detect demand trend using a 5 % threshold."""
    avg_3d = windows["avg_3d"]
    avg_7d = windows["avg_7d"]
    threshold = avg_7d * 0.05

    if avg_3d > avg_7d + threshold:
        return "increasing"
    elif avg_3d < avg_7d - threshold:
        return "decreasing"
    return "stable"


def _classify_status(stock: int, reorder_point: float, min_stock: int) -> str:
    if stock == 0:
        return "OUT_OF_STOCK"
    elif stock <= reorder_point:
        return "CRITICAL"
    elif stock < min_stock:
        return "LOW"
    return "OK"


# ── Public API ─────────────────────────────────────────────────────────────────

def get_product_forecast(product_id: int) -> dict[str, Any]:
    """Compute and return a full forecast dict for one product.

    Raises ValueError if the product is not found.
    """
    product = get_product_for_forecast(product_id)
    if not product:
        raise ValueError(f"Product {product_id} not found")

    windows = get_sales_windows(product_id)
    forecast_daily, forecast_method = _weighted_forecast(windows)
    trend = _detect_trend(windows)
    safety_stock = SAFETY_STOCK_DAYS * forecast_daily
    reorder_point = (forecast_daily * product["lead_time"]) + safety_stock
    status = _classify_status(product["stock"], reorder_point, product["min_stock"])

    days_of_inventory = (
        round(product["stock"] / forecast_daily, 1) if forecast_daily > 0 else None
    )
    days_until_stockout = (
        None if forecast_daily <= 0
        else (0 if product["stock"] <= 0 else int(product["stock"] / forecast_daily))
    )

    return {
        "product_id": product_id,
        "product_name": product["name"],
        "current_stock": product["stock"],
        "min_stock": product["min_stock"],
        "lead_time": product["lead_time"],
        # Sales windows
        "sales_3d": windows["total_3d"],
        "sales_7d": windows["total_7d"],
        "sales_30d": windows["total_30d"],
        # Averages
        "avg_daily_3d": windows["avg_3d"],
        "avg_daily_7d": windows["avg_7d"],
        "avg_daily_30d": windows["avg_30d"],
        "sales_today": windows["sales_today"],
        "sales_yesterday": windows["sales_yesterday"],
        "sales_two_days_ago": windows["sales_two_days_ago"],
        # Forecast
        "forecast_daily": round(forecast_daily, 2),
        "forecast_next_7_days": round(forecast_daily * 7, 2),
        "forecast_next_30_days": round(forecast_daily * 30, 2),
        "forecast_method": forecast_method,
        # Risk
        "trend": trend,
        "safety_stock": round(safety_stock, 2),
        "reorder_point": round(reorder_point, 2),
        "status": status,
        "reorder_required": status in ("OUT_OF_STOCK", "CRITICAL"),
        # Insights
        "days_until_stockout": days_until_stockout,
        "stock_coverage_days": days_of_inventory,
        "days_of_inventory": days_of_inventory,
        # Metadata
        "forecast_timestamp": datetime.now().isoformat(),
    }


def get_all_products_forecast() -> list:
    """Return forecast dicts for every product in the system."""
    product_ids = get_all_product_ids()
    forecasts = []
    for pid in product_ids:
        try:
            forecasts.append(get_product_forecast(pid))
        except Exception as exc:
            print(f"Error forecasting product {pid}: {exc}")
    return forecasts


def get_critical_products() -> list:
    """Return forecasts for products that are OUT_OF_STOCK or CRITICAL."""
    return [f for f in get_all_products_forecast() if f["status"] in ("OUT_OF_STOCK", "CRITICAL")]
