"""
analytics_service.py — Profit analytics business logic.
"""

from repositories.analytics_repository import (
    get_profit_totals,
    get_monthly_profit,
    get_top_profitable_products,
)


def get_profit_analytics() -> dict:
    """Return comprehensive profit analytics payload."""
    totals = get_profit_totals()
    revenue = totals["total_revenue"]
    profit = totals["total_profit"]

    profit_margin = round((profit / revenue) * 100, 2) if revenue > 0 else 0.0

    return {
        "total_revenue": revenue,
        "total_cost": totals["total_cost"],
        "total_profit": profit,
        "profit_margin": profit_margin,
        "monthly_profit": get_monthly_profit(),
        "top_profitable_products": get_top_profitable_products(limit=5),
    }
