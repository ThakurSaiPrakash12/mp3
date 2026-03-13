"""
sales_routes.py — HTTP endpoints for sales management.
"""

from fastapi import APIRouter, Depends, Request, Query
from pydantic import BaseModel, Field
from typing import Optional, Dict
from datetime import date
from auth import get_current_user, get_admin_user
from services.sales_service import record_sale, get_sales_page
from utils.validation import validate_pagination
from fastapi import status

router = APIRouter()


class SaleCreate(BaseModel):
    product_id: int = Field(..., gt=0)
    quantity: int = Field(..., gt=0)
    sale_date: Optional[date] = Field(None)


@router.get("/sales", tags=["Sales"])
async def get_sales(
    product_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    current_user: Dict = Depends(get_current_user),
):
    validate_pagination(page, limit)
    return get_sales_page(page, limit, product_id, start_date, end_date)


@router.post("/sales", tags=["Sales"], status_code=status.HTTP_201_CREATED)
async def add_sale(
    sale: SaleCreate,
    request: Request,
    current_user: Dict = Depends(get_admin_user),
):
    sale_date = sale.sale_date or date.today()
    return await record_sale(sale.product_id, sale.quantity, sale_date, request.client.host)
