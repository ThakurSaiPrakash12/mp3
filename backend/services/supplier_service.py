"""
supplier_service.py — Business logic for supplier CRUD.
"""

from fastapi import HTTPException
from repositories import supplier_repository as repo
from audit import log_audit
from typing import Optional


def list_suppliers() -> dict:
    rows = repo.get_all_suppliers()
    suppliers = [
        {
            "id": r[0], "name": r[1], "phone": r[2], "email": r[3],
            "address": r[4],
            "created_at": r[5].isoformat() if r[5] else None,
            "products_supplied": r[6], "product_names": r[7],
        }
        for r in rows
    ]
    return {"suppliers": suppliers, "total": len(suppliers)}


def create_supplier(name: str, phone: Optional[str], email: Optional[str],
                    address: Optional[str], client_host: str) -> dict:
    name = name.strip()
    if repo.supplier_name_exists(name):
        raise HTTPException(status_code=409, detail="Supplier with this name already exists")

    supplier_id, created_at = repo.insert_supplier(name, phone, email, address)

    log_audit(
        action="INSERT_SUPPLIER", table_name="suppliers",
        record_id=supplier_id,
        details={"name": name, "phone": phone, "email": email, "address": address},
        ip_address=client_host,
    )

    return {
        "id": supplier_id, "name": name, "phone": phone, "email": email,
        "address": address,
        "created_at": created_at.isoformat() if created_at else None,
        "products_supplied": 0, "product_names": [],
    }


def update_supplier(supplier_id: int, payload: dict, client_host: str) -> dict:
    if not payload:
        raise HTTPException(status_code=400, detail="No supplier fields provided")

    existing = repo.get_supplier_by_id(supplier_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Supplier not found")

    if "name" in payload:
        payload["name"] = payload["name"].strip()
        if repo.supplier_name_exists(payload["name"], exclude_id=supplier_id):
            raise HTTPException(status_code=409, detail="Supplier with this name already exists")

    updated = repo.update_supplier(supplier_id, payload)

    log_audit(
        action="UPDATE_SUPPLIER", table_name="suppliers",
        record_id=supplier_id, details=payload, ip_address=client_host,
    )

    product_names = repo.get_products_for_supplier(supplier_id)
    products_count = repo.count_products_by_supplier(supplier_id)

    return {
        "id": updated[0], "name": updated[1], "phone": updated[2],
        "email": updated[3], "address": updated[4],
        "created_at": updated[5].isoformat() if updated[5] else None,
        "products_supplied": products_count, "product_names": product_names,
    }


def delete_supplier(supplier_id: int, client_host: str) -> dict:
    existing = repo.get_supplier_by_id(supplier_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Supplier not found")

    if repo.count_products_for_supplier(supplier_id) > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete supplier while products are still assigned to it",
        )

    if repo.count_purchase_orders_for_supplier(supplier_id) > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete supplier with existing purchase orders",
        )

    repo.delete_supplier(supplier_id)

    log_audit(
        action="DELETE_SUPPLIER", table_name="suppliers",
        record_id=supplier_id, details={"name": existing[1]}, ip_address=client_host,
    )

    return {"message": "Supplier deleted successfully"}
