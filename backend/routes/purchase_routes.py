"""
purchase_routes.py — HTTP endpoints for purchase orders + profit analytics.
"""

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel, Field
from typing import List, Dict
from auth import get_current_user, get_admin_user
from services import purchase_service as po_svc
from services.analytics_service import get_profit_analytics

router = APIRouter()


class PurchaseOrderItemCreate(BaseModel):
    product_id: int = Field(..., gt=0)
    quantity: int = Field(..., gt=0)
    cost_price: float = Field(..., ge=0)


class PurchaseOrderCreate(BaseModel):
    supplier_id: int = Field(..., gt=0)
    items: List[PurchaseOrderItemCreate] = Field(..., min_length=1)


class PurchaseOrderStatusUpdate(BaseModel):
    status: str = Field(..., min_length=1, max_length=50)


@router.get("/analytics/profit", tags=["Analytics"])
async def get_profit_analytics_endpoint(current_user: Dict = Depends(get_current_user)):
    return get_profit_analytics()


@router.get("/purchase-orders", tags=["Purchase Orders"])
async def get_purchase_orders(current_user: Dict = Depends(get_current_user)):
    return po_svc.list_purchase_orders()


@router.post("/purchase-orders", tags=["Purchase Orders"], status_code=status.HTTP_201_CREATED)
async def create_purchase_order(
    order: PurchaseOrderCreate,
    request: Request,
    current_user: Dict = Depends(get_admin_user),
):
    items = [i.model_dump() for i in order.items]
    return po_svc.create_purchase_order(order.supplier_id, items, request.client.host)


@router.get("/purchase-orders/{order_id}", tags=["Purchase Orders"])
async def get_purchase_order(order_id: int, current_user: Dict = Depends(get_current_user)):
    return po_svc.get_purchase_order_detail(order_id)


@router.put("/purchase-orders/{order_id}/status", tags=["Purchase Orders"])
async def update_purchase_order_status(
    order_id: int,
    payload: PurchaseOrderStatusUpdate,
    request: Request,
    current_user: Dict = Depends(get_admin_user),
):
    return await po_svc.update_purchase_order_status(order_id, payload.status, request.client.host)
