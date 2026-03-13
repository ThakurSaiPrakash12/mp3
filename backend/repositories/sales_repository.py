"""
sales_repository.py — All SQL queries for the sales table.
"""

from database import get_db_connection
from datetime import date, datetime, timedelta
from typing import Optional


def insert_sale(product_id: int, quantity: int, sale_date: date) -> None:
    """Insert a sale and decrement product stock atomically."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Validate stock
        cur.execute("SELECT stock FROM products WHERE id = %s", (product_id,))
        row = cur.fetchone()
        if not row:
            raise ValueError(f"Product {product_id} not found")
        current_stock = row[0]
        if current_stock < quantity:
            raise ValueError(f"Insufficient stock. Available: {current_stock}, Requested: {quantity}")

        cur.execute(
            "INSERT INTO sales (product_id, quantity, sale_date) VALUES (%s, %s, %s)",
            (product_id, quantity, sale_date),
        )
        cur.execute(
            "UPDATE products SET stock = stock - %s WHERE id = %s",
            (quantity, product_id),
        )
        conn.commit()

        # Return new stock
        cur.execute("SELECT stock FROM products WHERE id = %s", (product_id,))
        return {
            "previous_stock": current_stock,
            "new_stock": cur.fetchone()[0],
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def get_sales_paginated(
    page: int,
    limit: int,
    product_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> tuple:
    """Return (rows, total_count) for paginated + filtered sales."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        offset = (page - 1) * limit
        conditions: list = []
        params: list = []

        if product_id:
            conditions.append("s.product_id = %s")
            params.append(product_id)
        if start_date:
            conditions.append("s.sale_date >= %s")
            params.append(start_date)
        if end_date:
            conditions.append("s.sale_date <= %s")
            params.append(end_date)

        where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        cur.execute(f"SELECT COUNT(*) FROM sales s {where_clause}", params)
        total = cur.fetchone()[0]

        cur.execute(
            f"""
            SELECT s.id, s.product_id, p.name, s.quantity, s.sale_date, s.created_at
            FROM sales s
            JOIN products p ON s.product_id = p.id
            {where_clause}
            ORDER BY s.sale_date DESC, s.id DESC
            LIMIT %s OFFSET %s
            """,
            params + [limit, offset],
        )
        rows = cur.fetchall()
        return rows, total
    finally:
        cur.close()
        conn.close()


def get_sales_trend_7d() -> dict:
    """Return a dict of {date: quantity} for the last 7 days."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT sale_date::date, COALESCE(SUM(quantity), 0) as quantity
            FROM sales WHERE sale_date >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY sale_date::date ORDER BY sale_date::date
        """)
        return {row[0]: row[1] for row in cur.fetchall()}
    finally:
        cur.close()
        conn.close()


def get_total_sales_last_7d() -> int:
    """Return total quantity sold in the last 7 days."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT COALESCE(SUM(quantity), 0) FROM sales WHERE sale_date >= CURRENT_DATE - INTERVAL '7 days'"
        )
        return cur.fetchone()[0]
    finally:
        cur.close()
        conn.close()


def get_sales_history(product_id: int, days: int) -> list:
    """Return daily sales history rows for a product over `days` days."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        start = datetime.now().date() - timedelta(days=days)
        cur.execute(
            """
            SELECT sale_date, COALESCE(SUM(quantity), 0) as quantity
            FROM sales
            WHERE product_id = %s AND sale_date >= %s
            GROUP BY sale_date
            ORDER BY sale_date
            """,
            (product_id, start),
        )
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()
