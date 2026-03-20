"""
product_routes.py — HTTP endpoints for product management.
All business logic delegated to product_service.
"""

from fastapi import APIRouter, Depends, Request, Query, UploadFile, File
from pydantic import BaseModel, Field
from typing import Optional, Dict
from auth import get_current_user, get_admin_user
from services.product_service import (
    create_product,
    get_products_page,
    get_all_products_reorder_data,
    invalidate_reorder_cache,
    replenish_stock,
    get_reorder_check,
)
from csv_upload import upload_csv_handler
from utils.validation import validate_pagination
from fastapi import status

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1)
    stock: int = Field(..., ge=0)
    min_stock: int = Field(..., ge=0)
    lead_time: int = Field(5, gt=0)
    supplier_id: Optional[int] = Field(None, gt=0)
    cost_price: Optional[float] = Field(None, ge=0)
    selling_price: Optional[float] = Field(None, ge=0)


class StockUpdate(BaseModel):
    new_stock: int = Field(..., gt=0)


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/", tags=["General"])
async def root():
    return {
        "message": "Inventory Management System API",
        "status": "running",
        "docs": "/docs",
    }


@router.get("/products", tags=["Products"])
async def get_products(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None),
    current_user: Dict = Depends(get_current_user),
):
    validate_pagination(page, limit)
    return get_products_page(page, limit, search or "")


@router.get("/products/reorder-data", tags=["Products"])
async def get_products_reorder_data(current_user: Dict = Depends(get_current_user)):
    """Fast bulk endpoint for reorder screen, avoids paginated page-by-page fetch."""
    return {"products": get_all_products_reorder_data()}


@router.post("/products", tags=["Products"], status_code=status.HTTP_201_CREATED)
async def add_product(
    product: ProductCreate,
    request: Request,
    current_user: Dict = Depends(get_admin_user),
):
    return await create_product(
        name=product.name,
        stock=product.stock,
        min_stock=product.min_stock,
        lead_time=product.lead_time,
        supplier_id=product.supplier_id,
        cost_price=product.cost_price,
        selling_price=product.selling_price,
        client_host=request.client.host,
    )


@router.get("/reorder-check/{product_id}", tags=["Products"])
async def reorder_check(product_id: int, current_user: Dict = Depends(get_current_user)):
    return get_reorder_check(product_id)


@router.post("/products/{product_id}/reorder-reset", tags=["Products"])
async def reorder_reset(
    product_id: int,
    stock_update: StockUpdate,
    request: Request,
    current_user: Dict = Depends(get_admin_user),
):
    return await replenish_stock(product_id, stock_update.new_stock, request.client.host)


@router.post("/products/upload-csv", tags=["Products"])
async def upload_csv(
    file: UploadFile = File(...),
    mode: str = Query("skip", pattern="^(skip|update_stock)$"),
    current_user: Dict = Depends(get_admin_user),
):
    result = await upload_csv_handler(file, mode)
    invalidate_reorder_cache()
    return result
