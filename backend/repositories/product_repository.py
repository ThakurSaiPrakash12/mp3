"""
product_repository.py — All SQL queries for the products table.
"""

from database import get_db_connection
from typing import Optional


def get_product_by_id(product_id: int) -> Optional[dict]:
    """Fetch a single product by ID. Returns None if not found."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT id, name, stock, min_stock, lead_time, supplier_id, cost_price, selling_price, created_at, updated_at "
            "FROM products WHERE id = %s",
            (product_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        return {
            "id": row[0], "name": row[1], "stock": row[2], "min_stock": row[3],
            "lead_time": row[4], "supplier_id": row[5],
            "cost_price": float(row[6]) if row[6] is not None else None,
            "selling_price": float(row[7]) if row[7] is not None else None,
            "created_at": row[8].isoformat() if row[8] else None,
            "updated_at": row[9].isoformat() if row[9] else None,
        }
    finally:
        cur.close()
        conn.close()


def get_product_stock(product_id: int) -> Optional[int]:
    """Return only the stock of a product, or None if not found."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT stock FROM products WHERE id = %s", (product_id,))
        row = cur.fetchone()
        return row[0] if row else None
    finally:
        cur.close()
        conn.close()


def get_product_reorder_fields(product_id: int) -> Optional[tuple]:
    """Return (stock, min_stock, lead_time) or None."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT stock, min_stock, lead_time FROM products WHERE id = %s", (product_id,))
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def product_name_exists(name: str, exclude_id: Optional[int] = None) -> bool:
    """Check if a product with the given name already exists (case-insensitive)."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        if exclude_id is None:
            cur.execute("SELECT id FROM products WHERE LOWER(name) = LOWER(%s)", (name,))
        else:
            cur.execute(
                "SELECT id FROM products WHERE LOWER(name) = LOWER(%s) AND id <> %s",
                (name, exclude_id),
            )
        return cur.fetchone() is not None
    finally:
        cur.close()
        conn.close()


def supplier_exists(supplier_id: int) -> bool:
    """Check if a supplier ID exists."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM suppliers WHERE id = %s", (supplier_id,))
        return cur.fetchone() is not None
    finally:
        cur.close()
        conn.close()


def insert_product(name: str, stock: int, min_stock: int, lead_time: int,
                   supplier_id: Optional[int], cost_price: Optional[float],
                   selling_price: Optional[float]) -> int:
    """Insert a new product and return its ID."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO products (name, stock, min_stock, lead_time, supplier_id, cost_price, selling_price)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (name, stock, min_stock, lead_time, supplier_id, cost_price, selling_price),
        )
        product_id = cur.fetchone()[0]
        conn.commit()
        return product_id
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def add_stock(product_id: int, quantity: int) -> dict:
    """Increment product stock by quantity. Returns previous and new stock."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT stock FROM products WHERE id = %s", (product_id,))
        row = cur.fetchone()
        if not row:
            raise ValueError(f"Product {product_id} not found")
        previous_stock = row[0]
        cur.execute(
            "UPDATE products SET stock = stock + %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
            (quantity, product_id),
        )
        conn.commit()
        return {"previous_stock": previous_stock, "new_stock": previous_stock + quantity}
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def get_all_products_basic() -> list:
    """Return all products with id, name, stock, min_stock, lead_time (for dashboard)."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id, name, stock, min_stock, lead_time FROM products ORDER BY id")
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


def get_all_product_ids() -> list:
    """Return a sorted list of all product IDs."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM products ORDER BY id")
        return [row[0] for row in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


def get_products_paginated(page: int, limit: int, search: str = "") -> tuple:
    """Return (rows, total_count) for paginated + searchable product listing."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        offset = (page - 1) * limit
        where_clause = ""
        params: list = []

        if search:
            where_clause = "WHERE LOWER(name) LIKE LOWER(%s)"
            params.append(f"%{search}%")

        cur.execute(f"SELECT COUNT(*) FROM products {where_clause}", params)
        total = cur.fetchone()[0]

        cur.execute(
            f"""
            SELECT id, name, stock, min_stock, lead_time, supplier_id, cost_price, selling_price, created_at, updated_at
            FROM products
            {where_clause}
            ORDER BY id
            LIMIT %s OFFSET %s
            """,
            params + [limit, offset],
        )
        rows = cur.fetchall()
        return rows, total
    finally:
        cur.close()
        conn.close()


def get_products_by_ids(product_ids: list) -> dict:
    """Return {id: name} for a list of product IDs."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id, name FROM products WHERE id = ANY(%s)", (product_ids,))
        return {row[0]: row[1] for row in cur.fetchall()}
    finally:
        cur.close()
        conn.close()
