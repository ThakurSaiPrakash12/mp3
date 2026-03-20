"""
api_helpers.py — Shared helper functions used across multiple route modules.

These depend on DB cursors but contain no HTTP logic.
"""

from utils.calculations import calculate_forecast_daily, calculate_reorder_status


def get_product_reorder_info(cur, product_id: int, stock: int, min_stock: int, lead_time: int) -> dict:
    """Calculate reorder info for a single product.

    Runs a sales aggregation query and applies the forecast-driven reorder
    formula. Returns the full reorder dict from calculate_reorder_status().

    Args:
        cur:        Active psycopg2 cursor (caller manages connection lifecycle)
        product_id: Product ID to query sales for
        stock:      Current stock level
        min_stock:  Minimum stock threshold
        lead_time:  Supplier lead time in days

    Returns:
        dict with keys: status, reorder_required, reorder_level,
                        forecast_daily, safety_stock, reorder_point,
                        days_of_inventory, average_daily_sales
    """
    cur.execute("""
        SELECT
            COALESCE(SUM(CASE WHEN sale_date = CURRENT_DATE THEN quantity ELSE 0 END), 0) AS sales_today,
            COALESCE(SUM(CASE WHEN sale_date = CURRENT_DATE - INTERVAL '1 day' THEN quantity ELSE 0 END), 0) AS sales_yesterday,
            COALESCE(SUM(CASE WHEN sale_date = CURRENT_DATE - INTERVAL '2 days' THEN quantity ELSE 0 END), 0) AS sales_two_days_ago,
            COALESCE(SUM(CASE WHEN sale_date >= CURRENT_DATE - INTERVAL '7 days' THEN quantity ELSE 0 END), 0) AS sales_7d
        FROM sales
        WHERE product_id = %s
    """, (product_id,))
    sales_today, sales_yesterday, sales_two_days_ago, sales_7d = cur.fetchone()
    avg_sales_7d = sales_7d / 7
    forecast_daily = calculate_forecast_daily(
        sales_today,
        sales_yesterday,
        sales_two_days_ago,
        avg_sales_7d,
    )
    reorder_info = calculate_reorder_status(
        stock,
        min_stock,
        avg_sales_7d,
        lead_time,
        forecast_daily=forecast_daily,
    )
    reorder_info["average_daily_sales"] = round(avg_sales_7d, 2)
    return reorder_info


def get_products_reorder_info_bulk(cur, products: list[tuple]) -> dict[int, dict]:
    """Calculate reorder info for many products using one sales aggregation query.

    Args:
        cur: Active psycopg2 cursor
        products: list of tuples (product_id, stock, min_stock, lead_time)

    Returns:
        dict keyed by product_id with reorder info payload.
    """
    if not products:
        return {}

    product_ids = [p[0] for p in products]
    cur.execute(
        """
        SELECT
            product_id,
            COALESCE(SUM(CASE WHEN sale_date = CURRENT_DATE THEN quantity ELSE 0 END), 0) AS sales_today,
            COALESCE(SUM(CASE WHEN sale_date = CURRENT_DATE - INTERVAL '1 day' THEN quantity ELSE 0 END), 0) AS sales_yesterday,
            COALESCE(SUM(CASE WHEN sale_date = CURRENT_DATE - INTERVAL '2 days' THEN quantity ELSE 0 END), 0) AS sales_two_days_ago,
            COALESCE(SUM(CASE WHEN sale_date >= CURRENT_DATE - INTERVAL '7 days' THEN quantity ELSE 0 END), 0) AS sales_7d
        FROM sales
        WHERE product_id = ANY(%s)
        GROUP BY product_id
        """,
        (product_ids,),
    )

    sales_map = {
        row[0]: {
            "sales_today": row[1],
            "sales_yesterday": row[2],
            "sales_two_days_ago": row[3],
            "sales_7d": row[4],
        }
        for row in cur.fetchall()
    }

    reorder_map = {}
    for product_id, stock, min_stock, lead_time in products:
        sales = sales_map.get(
            product_id,
            {"sales_today": 0, "sales_yesterday": 0, "sales_two_days_ago": 0, "sales_7d": 0},
        )
        avg_sales_7d = sales["sales_7d"] / 7
        forecast_daily = calculate_forecast_daily(
            sales["sales_today"],
            sales["sales_yesterday"],
            sales["sales_two_days_ago"],
            avg_sales_7d,
        )
        reorder_info = calculate_reorder_status(
            stock,
            min_stock,
            avg_sales_7d,
            lead_time,
            forecast_daily=forecast_daily,
        )
        reorder_info["average_daily_sales"] = round(avg_sales_7d, 2)
        reorder_map[product_id] = reorder_info

    return reorder_map
