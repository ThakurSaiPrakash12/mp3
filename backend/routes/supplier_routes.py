"""
supplier_routes.py — HTTP endpoints for supplier CRUD.
"""

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel, Field
from typing import Optional, Dict
from auth import get_current_user, get_admin_user
from services import supplier_service as svc

router = APIRouter()


class SupplierCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    address: Optional[str] = None


class SupplierUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    address: Optional[str] = None


@router.get("/suppliers", tags=["Suppliers"])
async def get_suppliers(current_user: Dict = Depends(get_current_user)):
    return svc.list_suppliers()


@router.post("/suppliers", tags=["Suppliers"], status_code=status.HTTP_201_CREATED)
async def create_supplier(
    supplier: SupplierCreate,
    request: Request,
    current_user: Dict = Depends(get_admin_user),
):
    return svc.create_supplier(
        name=supplier.name,
        phone=supplier.phone,
        email=supplier.email,
        address=supplier.address,
        client_host=request.client.host,
    )


@router.put("/suppliers/{supplier_id}", tags=["Suppliers"])
async def update_supplier(
    supplier_id: int,
    supplier: SupplierUpdate,
    request: Request,
    current_user: Dict = Depends(get_admin_user),
):
    payload = {k: v for k, v in supplier.model_dump().items() if v is not None}
    return svc.update_supplier(supplier_id, payload, request.client.host)


@router.delete("/suppliers/{supplier_id}", tags=["Suppliers"])
async def delete_supplier(
    supplier_id: int,
    request: Request,
    current_user: Dict = Depends(get_admin_user),
):
    return svc.delete_supplier(supplier_id, request.client.host)
