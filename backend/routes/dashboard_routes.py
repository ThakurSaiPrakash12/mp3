"""
dashboard_routes.py — GET /dashboard endpoint.
"""

from fastapi import APIRouter, Depends
from typing import Dict
from auth import get_current_user
from services.sales_service import get_sales_trend_data, get_total_sales_7d
from utils.api_helpers import get_product_reorder_info
from repositories.product_repository import get_all_products_basic
from database import get_db_connection
from datetime import datetime, timedelta

router = APIRouter()


@router.get("/dashboard", tags=["Dashboard"])
async def dashboard(current_user: Dict = Depends(get_current_user)):
    """Get dashboard statistics and recent sales data."""
    products = get_all_products_basic()

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        low_stock_count = reorder_required_count = 0
        stock_levels = []
        reorder_attention = []

        for product_id, name, stock, min_stock, lead_time in products:
            reorder_info = get_product_reorder_info(cur, product_id, stock, min_stock, lead_time)
            low_stock_count += stock < min_stock
            reorder_required_count += reorder_info["reorder_required"]
            entry = {
                "id": product_id, "name": name, "stock": stock, "min_stock": min_stock,
                "reorder_required": reorder_info["reorder_required"],
                "forecast_daily": reorder_info["forecast_daily"],
                "safety_stock": reorder_info["safety_stock"],
                "reorder_point": reorder_info["reorder_point"],
                "days_of_inventory": reorder_info["days_of_inventory"],
                "reorder_recommendation": "Reorder recommended" if reorder_info["reorder_required"] else "No reorder needed",
            }
            stock_levels.append(entry)
            if reorder_info["reorder_required"]:
                reorder_attention.append(entry)
    finally:
        cur.close()
        conn.close()

    sales_trend = get_sales_trend_data()
    total_sales = get_total_sales_7d()

    return {
        "summary": {
            "total_products": len(products),
            "total_sales_last_7_days": total_sales,
            "low_stock_items": low_stock_count,
            "reorder_required_items": reorder_required_count,
        },
        "sales_trend": sales_trend,
        "stock_distribution": {
            "well_stocked": len(products) - reorder_required_count,
            "reorder_required": reorder_required_count,
        },
        "stock_levels": stock_levels[:10],
        "reorder_attention": reorder_attention,
        "stock_coverage_summary": {
            "days": round(
                min(
                    [i["days_of_inventory"] for i in stock_levels if i["days_of_inventory"] is not None],
                    default=0,
                ),
                1,
            ),
            "message": "Reorder recommended" if reorder_required_count > 0 else "No reorder needed",
        },
    }
