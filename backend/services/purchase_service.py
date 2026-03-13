"""
purchase_service.py — Business logic for purchase orders.
"""

from fastapi import HTTPException
from repositories import purchase_repository as repo
from repositories import supplier_repository as supplier_repo
from repositories import product_repository as product_repo
from audit import log_audit
from websocket_manager import broadcast_event
from services.forecast_service import get_product_forecast

VALID_STATUSES = {"PENDING", "APPROVED", "DELIVERED", "CANCELLED"}


def _validate_status(raw: str) -> str:
    value = raw.strip().upper()
    if value not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed values: {', '.join(sorted(VALID_STATUSES))}",
        )
    return value


def list_purchase_orders() -> dict:
    orders = repo.get_all_purchase_orders()
    return {"purchase_orders": orders, "total": len(orders)}


def get_purchase_order_detail(order_id: int) -> dict:
    header = repo.get_purchase_order_header(order_id)
    if not header:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    items = repo.get_purchase_order_items(order_id)
    total_cost = round(sum(i["line_total"] for i in items), 2)
    total_quantity = sum(i["quantity"] for i in items)

    return {
        "id": header[0], "supplier_id": header[1], "supplier_name": header[2],
        "status": header[3],
        "created_at": header[4].isoformat() if header[4] else None,
        "items": items, "item_count": len(items),
        "total_quantity": total_quantity, "total_cost": total_cost,
    }


def create_purchase_order(supplier_id: int, items: list, client_host: str) -> dict:
    supplier = supplier_repo.get_supplier_by_id(supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    product_ids = [i["product_id"] for i in items]
    if len(product_ids) != len(set(product_ids)):
        raise HTTPException(status_code=400, detail="Duplicate product entries are not allowed in one order")

    found = product_repo.get_products_by_ids(product_ids)
    missing = [pid for pid in product_ids if pid not in found]
    if missing:
        raise HTTPException(status_code=404, detail=f"Products not found: {missing}")

    result = repo.create_purchase_order(supplier_id, items)

    log_audit(
        action="CREATE_PURCHASE_ORDER", table_name="purchase_orders",
        record_id=result["id"],
        details={"supplier_id": supplier_id, "items": items},
        ip_address=client_host,
    )

    return {
        "id": result["id"],
        "supplier_id": supplier_id,
        "supplier_name": supplier[1],
        "status": "PENDING",
        "created_at": result["created_at"].isoformat() if result["created_at"] else None,
    }


async def update_purchase_order_status(order_id: int, raw_status: str, client_host: str) -> dict:
    new_status = _validate_status(raw_status)

    try:
        updated, stock_updates = repo.update_order_status_and_deliver(order_id, new_status)
    except ValueError as exc:
        msg = str(exc)
        if "not found" in msg:
            raise HTTPException(status_code=404, detail=msg)
        raise HTTPException(status_code=400, detail=msg)

    log_audit(
        action="UPDATE_PURCHASE_ORDER_STATUS", table_name="purchase_orders",
        record_id=order_id,
        details={"new_status": new_status},
        ip_address=client_host,
    )

    if stock_updates:
        await broadcast_event("stock_updated", {
            "order_id": order_id, "status": new_status,
            "source": "purchase_order_delivery", "updates": stock_updates,
        })
        for update in stock_updates:
            try:
                forecast = get_product_forecast(update["product_id"])
                await broadcast_event("forecast_updated", {
                    "product_id": update["product_id"],
                    "trigger": "purchase_order_delivered",
                    "forecast_daily": forecast.get("forecast_daily"),
                    "reorder_point": forecast.get("reorder_point"),
                    "days_of_inventory": forecast.get("days_of_inventory"),
                })
            except Exception:
                pass  # Stock update must succeed even if forecast fails.

    return {
        "id": updated[0], "supplier_id": updated[1],
        "status": updated[2],
        "created_at": updated[3].isoformat() if updated[3] else None,
        "stock_updates": stock_updates,
    }
