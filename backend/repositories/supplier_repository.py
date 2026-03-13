"""
supplier_repository.py — All SQL queries for the suppliers table.
"""

from database import get_db_connection
from typing import Optional


def get_all_suppliers() -> list:
    """Return all suppliers with product counts and product name arrays."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
                s.id, s.name, s.phone, s.email, s.address, s.created_at,
                COUNT(p.id) AS products_supplied,
                COALESCE(ARRAY_AGG(p.name ORDER BY p.name) FILTER (WHERE p.id IS NOT NULL), '{}') AS product_names
            FROM suppliers s
            LEFT JOIN products p ON p.supplier_id = s.id
            GROUP BY s.id, s.name, s.phone, s.email, s.address, s.created_at
            ORDER BY s.name
        """)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


def get_supplier_by_id(supplier_id: int) -> Optional[tuple]:
    """Return (id, name) for the given supplier, or None."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id, name FROM suppliers WHERE id = %s", (supplier_id,))
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def supplier_name_exists(name: str, exclude_id: Optional[int] = None) -> bool:
    """Check uniqueness of supplier name (case-insensitive)."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        if exclude_id is None:
            cur.execute("SELECT id FROM suppliers WHERE LOWER(name) = LOWER(%s)", (name,))
        else:
            cur.execute(
                "SELECT id FROM suppliers WHERE LOWER(name) = LOWER(%s) AND id <> %s",
                (name, exclude_id),
            )
        return cur.fetchone() is not None
    finally:
        cur.close()
        conn.close()


def count_products_for_supplier(supplier_id: int) -> int:
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT COUNT(*) FROM products WHERE supplier_id = %s", (supplier_id,))
        return cur.fetchone()[0]
    finally:
        cur.close()
        conn.close()


def count_purchase_orders_for_supplier(supplier_id: int) -> int:
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT COUNT(*) FROM purchase_orders WHERE supplier_id = %s", (supplier_id,))
        return cur.fetchone()[0]
    finally:
        cur.close()
        conn.close()


def insert_supplier(name: str, phone: Optional[str], email: Optional[str], address: Optional[str]) -> tuple:
    """Insert a new supplier. Returns (id, created_at)."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO suppliers (name, phone, email, address) VALUES (%s, %s, %s, %s) RETURNING id, created_at",
            (name, phone, email, address),
        )
        result = cur.fetchone()
        conn.commit()
        return result
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def update_supplier(supplier_id: int, payload: dict) -> tuple:
    """Update supplier fields (dynamic columns). Returns updated row."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        columns = ", ".join(f"{col} = %s" for col in payload.keys())
        values = list(payload.values()) + [supplier_id]
        cur.execute(
            f"UPDATE suppliers SET {columns} WHERE id = %s RETURNING id, name, phone, email, address, created_at",
            values,
        )
        updated = cur.fetchone()
        conn.commit()
        return updated
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def delete_supplier(supplier_id: int) -> None:
    """Delete a supplier by ID."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM suppliers WHERE id = %s", (supplier_id,))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def get_products_for_supplier(supplier_id: int) -> list:
    """Return list of product names for a supplier."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT name FROM products WHERE supplier_id = %s ORDER BY name", (supplier_id,))
        return [row[0] for row in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


def count_products_by_supplier(supplier_id: int) -> int:
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT COUNT(*) FROM products WHERE supplier_id = %s", (supplier_id,))
        return cur.fetchone()[0]
    finally:
        cur.close()
        conn.close()
