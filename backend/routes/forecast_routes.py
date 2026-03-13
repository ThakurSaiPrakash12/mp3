"""
forecast_routes.py — HTTP endpoints for demand forecasting.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict
from datetime import datetime, timedelta
from auth import get_current_user
from services.forecast_service import (
    get_product_forecast,
    get_all_products_forecast,
    get_critical_products,
)
from repositories.sales_repository import get_sales_history
from repositories.product_repository import get_product_by_id

router = APIRouter()


@router.get("/forecast/{product_id}", tags=["Forecasting"])
async def get_forecast(product_id: int, current_user: Dict = Depends(get_current_user)):
    """Get real-time demand forecast for a specific product."""
    try:
        return get_product_forecast(product_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Forecast calculation failed: {exc}")


@router.get("/forecast", tags=["Forecasting"])
async def get_all_forecasts(current_user: Dict = Depends(get_current_user)):
    """Get demand forecasts for all products."""
    try:
        forecasts = get_all_products_forecast()
        return {"forecasts": forecasts, "total_products": len(forecasts), "timestamp": datetime.now().isoformat()}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Batch forecast failed: {exc}")


@router.get("/forecast/critical/alerts", tags=["Forecasting"])
async def get_critical_alerts(current_user: Dict = Depends(get_current_user)):
    """Get products requiring immediate attention (OUT_OF_STOCK or CRITICAL)."""
    try:
        critical = get_critical_products()
        critical.sort(key=lambda x: (
            0 if x["status"] == "OUT_OF_STOCK" else 1,
            x["days_until_stockout"] if x["days_until_stockout"] is not None else 999,
        ))
        return {"critical_products": critical, "total_critical": len(critical), "timestamp": datetime.now().isoformat()}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Critical alerts fetch failed: {exc}")


@router.get("/forecast/{product_id}/history", tags=["Forecasting"])
async def get_forecast_history(
    product_id: int,
    days: int = Query(30, ge=7, le=90),
    current_user: Dict = Depends(get_current_user),
):
    """Get historical sales data for charting and analysis."""
    product = get_product_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    try:
        rows = get_sales_history(product_id, days)
        history_dict = {row[0].isoformat(): row[1] for row in rows}

        all_dates = []
        current_date = (datetime.now().date() - timedelta(days=days))
        end_date = datetime.now().date()
        while current_date <= end_date:
            date_str = current_date.isoformat()
            all_dates.append({"date": date_str, "quantity": history_dict.get(date_str, 0)})
            current_date += timedelta(days=1)

        return {
            "product_id": product_id,
            "product_name": product["name"],
            "days": days,
            "history": all_dates,
            "total_sales": sum(item["quantity"] for item in all_dates),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"History fetch failed: {exc}")
