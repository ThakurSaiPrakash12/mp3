"""
product_service.py — Business logic for product operations.
"""

from fastapi import HTTPException, status
from repositories import product_repository as repo
from audit import log_audit
from websocket_manager import broadcast_event
from utils.api_helpers import get_product_reorder_info, get_products_reorder_info_bulk
from database import get_db_connection
from typing import Optional


async def create_product(
    name: str,
    stock: int,
    min_stock: int,
    lead_time: int,
    supplier_id: Optional[int],
    cost_price: Optional[float],
    selling_price: Optional[float],
    client_host: str,
) -> dict:
    """Validate, insert, audit and broadcast a new product."""
    name = name.strip()

    if not name:
        raise HTTPException(status_code=400, detail="Product name is required and cannot be empty")

    if repo.product_name_exists(name):
        raise HTTPException(status_code=409, detail="Product with this name already exists")

    if supplier_id is not None and not repo.supplier_exists(supplier_id):
        raise HTTPException(status_code=404, detail="Supplier not found")

    product_id = repo.insert_product(name, stock, min_stock, lead_time, supplier_id, cost_price, selling_price)

    log_audit(
        action="INSERT_PRODUCT",
        table_name="products",
        record_id=product_id,
        details={"name": name, "stock": stock, "min_stock": min_stock,
                 "lead_time": lead_time, "supplier_id": supplier_id,
                 "cost_price": cost_price, "selling_price": selling_price},
        ip_address=client_host,
    )

    await broadcast_event("product_added", {
        "product_id": product_id, "name": name, "stock": stock,
        "min_stock": min_stock, "lead_time": lead_time,
        "supplier_id": supplier_id, "cost_price": cost_price, "selling_price": selling_price,
    })

    return {"message": "Product added successfully", "product_id": product_id}


def get_products_page(page: int, limit: int, search: str) -> dict:
    """Fetch paginated product list with reorder info."""
    rows, total = repo.get_products_paginated(page, limit, search)

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        reorder_map = get_products_reorder_info_bulk(
            cur,
            [(r[0], r[2], r[3], r[4]) for r in rows],
        )

        products = []
        for (product_id, name, stock, min_stock, lead_time, supplier_id,
             cost_price, selling_price, created, updated) in rows:
            reorder_info = reorder_map.get(
                product_id,
                {
                    "status": "OK",
                    "reorder_required": False,
                    "reorder_level": min_stock,
                    "forecast_daily": 0,
                    "safety_stock": 0,
                    "reorder_point": min_stock,
                    "days_of_inventory": None,
                    "average_daily_sales": 0,
                },
            )
            products.append({
                "id": product_id, "name": name, "stock": stock,
                "min_stock": min_stock, "lead_time": lead_time,
                "supplier_id": supplier_id,
                "cost_price": float(cost_price) if cost_price is not None else None,
                "selling_price": float(selling_price) if selling_price is not None else None,
                "created_at": created.isoformat() if created else None,
                "updated_at": updated.isoformat() if updated else None,
                **reorder_info,
            })
    finally:
        cur.close()
        conn.close()

    return {
        "products": products,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit},
    }


def get_all_products_reorder_data() -> list[dict]:
    """Return all products with reorder fields in one bulk computation."""
    rows = repo.get_all_products_basic()
    if not rows:
        return []

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        reorder_map = get_products_reorder_info_bulk(
            cur,
            [(r[0], r[2], r[3], r[4]) for r in rows],
        )
    finally:
        cur.close()
        conn.close()

    payload = []
    for product_id, name, stock, min_stock, lead_time in rows:
        reorder_info = reorder_map.get(
            product_id,
            {
                "status": "OK",
                "reorder_required": False,
                "reorder_level": min_stock,
                "forecast_daily": 0,
                "safety_stock": 0,
                "reorder_point": min_stock,
                "days_of_inventory": None,
                "average_daily_sales": 0,
            },
        )
        payload.append(
            {
                "id": product_id,
                "name": name,
                "stock": stock,
                "min_stock": min_stock,
                "lead_time": lead_time,
                **reorder_info,
            }
        )

    return payload


async def replenish_stock(product_id: int, quantity: int, client_host: str) -> dict:
    """Add stock, audit, and broadcast the update."""
    result = repo.add_stock(product_id, quantity)
    if result is None:
        raise HTTPException(status_code=404, detail="Product not found")

    log_audit(
        action="REORDER_RESET",
        table_name="products",
        record_id=product_id,
        details={"previous_stock": result["previous_stock"],
                 "quantity_added": quantity, "new_stock": result["new_stock"]},
        ip_address=client_host,
    )

    await broadcast_event("stock_updated", {
        "product_id": product_id,
        "previous_stock": result["previous_stock"],
        "quantity_added": quantity,
        "new_stock": result["new_stock"],
    })

    return {
        "message": "Stock replenished successfully",
        "previous_stock": result["previous_stock"],
        "current_stock": result["new_stock"],
    }


def get_reorder_check(product_id: int) -> dict:
    """Return reorder status for a single product."""
    fields = repo.get_product_reorder_fields(product_id)
    if not fields:
        raise HTTPException(status_code=404, detail="Product not found")

    stock, min_stock, lead_time = fields

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        reorder_info = get_product_reorder_info(cur, product_id, stock, min_stock, lead_time)
    finally:
        cur.close()
        conn.close()

    return {"stock": stock, "min_stock": min_stock, "lead_time": lead_time, **reorder_info}
