"""
purchase_repository.py — All SQL queries for purchase_orders and purchase_items tables.
"""

from database import get_db_connection
from decimal import Decimal
from typing import Optional


def _decimal_to_float(value: Optional[Decimal]) -> Optional[float]:
    return float(value) if value is not None else None


def get_all_purchase_orders() -> list:
    """Return all purchase orders with aggregated item info."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
                po.id, po.supplier_id, s.name, po.status, po.created_at,
                COUNT(pi.id) AS item_count,
                COALESCE(SUM(pi.quantity), 0) AS total_quantity,
                COALESCE(SUM(pi.quantity * pi.cost_price), 0) AS total_cost
            FROM purchase_orders po
            JOIN suppliers s ON s.id = po.supplier_id
            LEFT JOIN purchase_items pi ON pi.order_id = po.id
            GROUP BY po.id, po.supplier_id, s.name, po.status, po.created_at
            ORDER BY po.created_at DESC, po.id DESC
        """)
        rows = cur.fetchall()
        return [
            {
                "id": r[0], "supplier_id": r[1], "supplier_name": r[2],
                "status": r[3],
                "created_at": r[4].isoformat() if r[4] else None,
                "item_count": r[5], "total_quantity": r[6],
                "total_cost": _decimal_to_float(r[7]) or 0.0,
            }
            for r in rows
        ]
    finally:
        cur.close()
        conn.close()


def get_purchase_order_header(order_id: int) -> Optional[tuple]:
    """Return (id, supplier_id, supplier_name, status, created_at) or None."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT po.id, po.supplier_id, s.name, po.status, po.created_at
            FROM purchase_orders po
            JOIN suppliers s ON s.id = po.supplier_id
            WHERE po.id = %s
        """, (order_id,))
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def get_purchase_order_items(order_id: int) -> list:
    """Return all line items for a purchase order."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT pi.id, pi.product_id, p.name, pi.quantity, pi.cost_price
            FROM purchase_items pi
            JOIN products p ON p.id = pi.product_id
            WHERE pi.order_id = %s
            ORDER BY pi.id
        """, (order_id,))
        rows = cur.fetchall()
        return [
            {
                "id": r[0], "product_id": r[1], "product_name": r[2],
                "quantity": r[3],
                "cost_price": _decimal_to_float(r[4]) or 0.0,
                "line_total": round(r[3] * (_decimal_to_float(r[4]) or 0.0), 2),
            }
            for r in rows
        ]
    finally:
        cur.close()
        conn.close()


def get_order_status(order_id: int) -> Optional[tuple]:
    """Return (supplier_id, status) for an order, or None."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT supplier_id, status FROM purchase_orders WHERE id = %s", (order_id,))
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def get_order_items_for_delivery(order_id: int) -> list:
    """Return [(product_id, quantity, cost_price)] for delivery processing."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT product_id, quantity, cost_price FROM purchase_items WHERE order_id = %s",
            (order_id,),
        )
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


def create_purchase_order(supplier_id: int, items: list) -> dict:
    """Insert a PO and its items. Returns {id, created_at}."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO purchase_orders (supplier_id, status) VALUES (%s, 'PENDING') RETURNING id, created_at",
            (supplier_id,),
        )
        order_id, created_at = cur.fetchone()
        for item in items:
            cur.execute(
                "INSERT INTO purchase_items (order_id, product_id, quantity, cost_price) VALUES (%s, %s, %s, %s)",
                (order_id, item["product_id"], item["quantity"], item["cost_price"]),
            )
        conn.commit()
        return {"id": order_id, "created_at": created_at}
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def update_order_status_and_deliver(order_id: int, new_status: str) -> tuple:
    """Update PO status. If DELIVERED, apply stock increments.

    Returns (updated_row, stock_updates_list).
    updated_row: (id, supplier_id, status, created_at)
    stock_updates_list: list of dicts with product_id, previous_stock, quantity_added, new_stock
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT supplier_id, status FROM purchase_orders WHERE id = %s", (order_id,))
        existing = cur.fetchone()
        if not existing:
            raise ValueError(f"Purchase order {order_id} not found")

        previous_status = existing[1]
        stock_updates = []

        if previous_status != "DELIVERED" and new_status == "DELIVERED":
            cur.execute(
                "SELECT product_id, quantity, cost_price FROM purchase_items WHERE order_id = %s",
                (order_id,),
            )
            items = cur.fetchall()
            if not items:
                raise ValueError("Cannot deliver an empty purchase order")

            for product_id, quantity, cost_price in items:
                cur.execute("SELECT stock, cost_price FROM products WHERE id = %s", (product_id,))
                product = cur.fetchone()
                if not product:
                    raise ValueError(f"Product {product_id} not found")

                previous_stock = product[0]
                cur.execute(
                    """
                    UPDATE products
                    SET stock = stock + %s,
                        cost_price = COALESCE(%s, cost_price),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    RETURNING stock
                    """,
                    (quantity, cost_price, product_id),
                )
                current_stock = cur.fetchone()[0]
                stock_updates.append({
                    "product_id": product_id,
                    "previous_stock": previous_stock,
                    "quantity_added": quantity,
                    "new_stock": current_stock,
                })

        cur.execute(
            "UPDATE purchase_orders SET status = %s WHERE id = %s RETURNING id, supplier_id, status, created_at",
            (new_status, order_id),
        )
        updated = cur.fetchone()
        conn.commit()
        return updated, stock_updates
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()
