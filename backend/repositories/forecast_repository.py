"""
forecast_repository.py — DB queries needed exclusively by the forecast engine.
"""

from database import get_db_connection
from datetime import datetime, timedelta
from typing import Optional


def get_product_for_forecast(product_id: int) -> Optional[dict]:
    """Return product fields needed for forecasting, or None."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT id, name, stock, min_stock, lead_time FROM products WHERE id = %s",
            (product_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        return {"id": row[0], "name": row[1], "stock": row[2], "min_stock": row[3], "lead_time": row[4]}
    finally:
        cur.close()
        conn.close()


def get_sales_windows(product_id: int) -> dict:
    """Compute sales totals and per-day values for multiple rolling windows."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        today = datetime.now().date()
        date_3d = today - timedelta(days=3)
        date_7d = today - timedelta(days=7)
        date_30d = today - timedelta(days=30)

        cur.execute("""
            SELECT
                COALESCE(SUM(CASE WHEN sale_date >= %s THEN quantity ELSE 0 END), 0) as total_3d,
                COALESCE(SUM(CASE WHEN sale_date >= %s THEN quantity ELSE 0 END), 0) as total_7d,
                COALESCE(SUM(CASE WHEN sale_date >= %s THEN quantity ELSE 0 END), 0) as total_30d,
                COALESCE(SUM(CASE WHEN sale_date = %s THEN quantity ELSE 0 END), 0) as sales_today,
                COALESCE(SUM(CASE WHEN sale_date = %s THEN quantity ELSE 0 END), 0) as sales_yesterday,
                COALESCE(SUM(CASE WHEN sale_date = %s THEN quantity ELSE 0 END), 0) as sales_two_days_ago
            FROM sales
            WHERE product_id = %s AND sale_date >= %s
        """, (
            date_3d, date_7d, date_30d,
            today, today - timedelta(days=1), today - timedelta(days=2),
            product_id, date_30d,
        ))
        r = cur.fetchone()
        total_3d, total_7d, total_30d = r[0], r[1], r[2]
        return {
            "total_3d": total_3d, "total_7d": total_7d, "total_30d": total_30d,
            "avg_3d": total_3d / 3, "avg_7d": total_7d / 7, "avg_30d": total_30d / 30,
            "sales_today": r[3], "sales_yesterday": r[4], "sales_two_days_ago": r[5],
        }
    finally:
        cur.close()
        conn.close()
