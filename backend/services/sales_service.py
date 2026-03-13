"""
sales_service.py — Business logic for sales operations.
"""

from fastapi import HTTPException
from datetime import date
from repositories import sales_repository as repo
from audit import log_audit
from websocket_manager import broadcast_event
from datetime import datetime, timedelta


async def record_sale(product_id: int, quantity: int, sale_date: date, client_host: str) -> dict:
    """Validate stock, record sale, audit, and broadcast events."""
    try:
        result = repo.insert_sale(product_id, quantity, sale_date)
    except ValueError as exc:
        msg = str(exc)
        if "not found" in msg:
            raise HTTPException(status_code=404, detail=msg)
        raise HTTPException(status_code=400, detail=msg)

    log_audit(
        action="RECORD_SALE",
        table_name="sales",
        record_id=product_id,
        details={
            "product_id": product_id,
            "quantity": quantity,
            "previous_stock": result["previous_stock"],
            "new_stock": result["new_stock"],
        },
        ip_address=client_host,
    )

    await broadcast_event("sale_recorded", {
        "product_id": product_id,
        "quantity": quantity,
        "previous_stock": result["previous_stock"],
        "new_stock": result["new_stock"],
        "sale_date": str(sale_date),
    })

    await broadcast_event("forecast_updated", {
        "product_id": product_id,
        "trigger": "sale_recorded",
    })

    return {"message": "Sale recorded", "updated_stock": result["new_stock"]}


def get_sales_page(
    page: int,
    limit: int,
    product_id=None,
    start_date=None,
    end_date=None,
) -> dict:
    """Fetch paginated, filtered sales list."""
    rows, total = repo.get_sales_paginated(page, limit, product_id, start_date, end_date)
    sales = [
        {
            "id": r[0], "product_id": r[1], "product_name": r[2],
            "quantity": r[3],
            "sale_date": r[4].isoformat() if r[4] else None,
            "created_at": r[5].isoformat() if r[5] else None,
        }
        for r in rows
    ]
    return {
        "sales": sales,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit},
        "filters": {
            "product_id": product_id,
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None,
        },
    }


def get_sales_trend_data() -> list:
    """Return 7-day sales trend for the dashboard."""
    sales_dict = repo.get_sales_trend_7d()
    return [
        {
            "date": (datetime.now().date() - timedelta(days=6 - i)).isoformat(),
            "quantity": sales_dict.get(datetime.now().date() - timedelta(days=6 - i), 0),
        }
        for i in range(7)
    ]


def get_total_sales_7d() -> int:
    return repo.get_total_sales_last_7d()
