"""
validation.py — Reusable input validation helpers.
"""

from fastapi import HTTPException


def validate_pagination(page: int, limit: int) -> int:
    """Validate pagination parameters and return SQL OFFSET.

    Args:
        page:  1-based page number
        limit: items per page (1–100)

    Returns:
        SQL OFFSET integer

    Raises:
        HTTPException 400 on invalid values
    """
    if page < 1:
        raise HTTPException(status_code=400, detail="Page must be >= 1")
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=400, detail="Limit must be between 1 and 100")
    return (page - 1) * limit
