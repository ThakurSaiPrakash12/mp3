"""
analytics_repository.py — DB queries for the profit analytics endpoint.
"""

from database import get_db_connection
from decimal import Decimal
from typing import Optional


def _decimal_to_float(value: Optional[Decimal]) -> float:
    return float(value) if value is not None else 0.0


def get_profit_totals() -> dict:
    """Return total revenue, cost, and profit across all sales."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
                COALESCE(SUM(COALESCE(p.selling_price, 0) * s.quantity), 0) AS total_revenue,
                COALESCE(SUM(COALESCE(p.cost_price, 0) * s.quantity), 0) AS total_cost,
                COALESCE(SUM((COALESCE(p.selling_price, 0) - COALESCE(p.cost_price, 0)) * s.quantity), 0) AS total_profit
            FROM sales s
            JOIN products p ON p.id = s.product_id
        """)
        row = cur.fetchone()
        return {
            "total_revenue": _decimal_to_float(row[0]),
            "total_cost": _decimal_to_float(row[1]),
            "total_profit": _decimal_to_float(row[2]),
        }
    finally:
        cur.close()
        conn.close()


def get_monthly_profit() -> list:
    """Return month-by-month revenue, cost, profit breakdown."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
                TO_CHAR(DATE_TRUNC('month', s.sale_date), 'YYYY-MM') AS month,
                COALESCE(SUM(COALESCE(p.selling_price, 0) * s.quantity), 0) AS revenue,
                COALESCE(SUM(COALESCE(p.cost_price, 0) * s.quantity), 0) AS cost,
                COALESCE(SUM((COALESCE(p.selling_price, 0) - COALESCE(p.cost_price, 0)) * s.quantity), 0) AS profit
            FROM sales s
            JOIN products p ON p.id = s.product_id
            GROUP BY DATE_TRUNC('month', s.sale_date)
            ORDER BY DATE_TRUNC('month', s.sale_date)
        """)
        return [
            {"month": r[0], "revenue": _decimal_to_float(r[1]),
             "cost": _decimal_to_float(r[2]), "profit": _decimal_to_float(r[3])}
            for r in cur.fetchall()
        ]
    finally:
        cur.close()
        conn.close()


def get_top_profitable_products(limit: int = 5) -> list:
    """Return top N products by profit."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT
                p.id, p.name,
                COALESCE(SUM(s.quantity), 0) AS quantity_sold,
                COALESCE(SUM(COALESCE(p.selling_price, 0) * s.quantity), 0) AS revenue,
                COALESCE(SUM((COALESCE(p.selling_price, 0) - COALESCE(p.cost_price, 0)) * s.quantity), 0) AS profit
            FROM sales s
            JOIN products p ON p.id = s.product_id
            GROUP BY p.id, p.name
            ORDER BY profit DESC, quantity_sold DESC
            LIMIT %s
        """, (limit,))
        return [
            {
                "product_id": r[0], "name": r[1], "quantity_sold": r[2],
                "revenue": _decimal_to_float(r[3]), "profit": _decimal_to_float(r[4]),
            }
            for r in cur.fetchall()
        ]
    finally:
        cur.close()
        conn.close()
