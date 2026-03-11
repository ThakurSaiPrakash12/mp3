from fastapi import APIRouter, Depends, HTTPException, status, Request, Query, UploadFile, File
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from database import get_db_connection
from utils import calculate_reorder_status
from datetime import date, datetime, timedelta
from audit import log_audit
from auth import generate_token, USERS, get_current_user, get_admin_user
from csv_upload import upload_csv_handler
from websocket_manager import broadcast_event

router = APIRouter()

# Pydantic models
class LoginRequest(BaseModel):
    username: str = Field(..., description="Username")
    password: str = Field(..., description="Password")

class LoginResponse(BaseModel):
    token: str
    username: str
    role: str

class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, description="Product name")
    stock: int = Field(..., ge=0, description="Stock quantity")
    min_stock: int = Field(..., ge=0, description="Minimum stock level")
    lead_time: int = Field(5, gt=0, description="Lead time in days")

class SaleCreate(BaseModel):
    product_id: int = Field(..., gt=0, description="Product ID")
    quantity: int = Field(..., gt=0, description="Sale quantity")
    sale_date: Optional[date] = Field(None, description="Sale date (defaults to today)")

class StockUpdate(BaseModel):
    new_stock: int = Field(..., gt=0, description="Quantity to add to current stock")

class MessageResponse(BaseModel):
    message: str

# Helper functions
def validate_pagination(page: int, limit: int):
    """Validate and return pagination parameters"""
    if page < 1:
        raise HTTPException(status_code=400, detail="Page must be >= 1")
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=400, detail="Limit must be between 1 and 100")
    return (page - 1) * limit

def get_product_reorder_info(cur, product_id, stock, min_stock, lead_time):
    """Calculate reorder info for a product (DRY principle)"""
    cur.execute("""
        SELECT COALESCE(SUM(quantity), 0) FROM sales
        WHERE product_id = %s AND sale_date >= CURRENT_DATE - INTERVAL '7 days'
    """, (product_id,))
    avg_sales = cur.fetchone()[0] / 7
    return calculate_reorder_status(stock, min_stock, avg_sales, lead_time)

# Root endpoint
@router.get("/", tags=["General"])
async def root():
    """
    Root endpoint providing API information
    """
    return {
        "message": "Inventory Management System API",
        "status": "running",
        "docs": "/docs",
        "endpoints": {
            "POST /login": "Authenticate user",
            "GET /dashboard": "Get dashboard data",
            "GET /products": "List all products",
            "POST /products": "Add new product",
            "GET /sales": "List all sales",
            "POST /sales": "Record new sale",
            "GET /reorder-check/{id}": "Check reorder status",
            "POST /products/{id}/reorder-reset": "Reset reorder date",
            "POST /products/upload-csv": "Upload products via CSV"
        }
    }

# Login endpoint
@router.post("/login", response_model=LoginResponse, tags=["Authentication"])
async def login(credentials: LoginRequest):
    """
    Authenticate user and receive JWT token
    
    - **username**: User's username (admin or viewer)
    - **password**: User's password
    """
    user = USERS.get(credentials.username)
    if not user or user["password"] != credentials.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    token = generate_token(credentials.username, user["role"])
    
    return {
        "token": token,
        "username": credentials.username,
        "role": user["role"]
    }

# Dashboard - Real data from database
@router.get("/dashboard", tags=["Dashboard"])
async def dashboard(current_user: Dict = Depends(get_current_user)):
    """
    Get dashboard statistics and recent sales data
    
    Requires authentication token
    """
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("SELECT id, name, stock, min_stock, lead_time FROM products ORDER BY id")
    products = cur.fetchall()
    
    low_stock_count = reorder_required_count = 0
    stock_levels = []
    
    for product_id, name, stock, min_stock, lead_time in products:
        reorder_info = get_product_reorder_info(cur, product_id, stock, min_stock, lead_time)
        low_stock_count += (stock < min_stock)
        reorder_required_count += reorder_info["reorder_required"]
        stock_levels.append({
            "id": product_id,
            "name": name,
            "stock": stock,
            "min_stock": min_stock,
            "reorder_required": reorder_info["reorder_required"]
        })
    
    cur.execute("""
        SELECT sale_date::date, COALESCE(SUM(quantity), 0) as quantity
        FROM sales WHERE sale_date >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY sale_date::date ORDER BY sale_date::date
    """)
    sales_dict = {row[0]: row[1] for row in cur.fetchall()}
    
    sales_trend = [
        {
            "date": (datetime.now().date() - timedelta(days=6-i)).isoformat(),
            "quantity": sales_dict.get(datetime.now().date() - timedelta(days=6-i), 0)
        }
        for i in range(7)
    ]
    
    cur.execute("SELECT COALESCE(SUM(quantity), 0) FROM sales WHERE sale_date >= CURRENT_DATE - INTERVAL '7 days'")
    total_sales = cur.fetchone()[0]
    
    cur.close()
    conn.close()
    
    return {
        "summary": {
            "total_products": len(products),
            "total_sales_last_7_days": total_sales,
            "low_stock_items": low_stock_count,
            "reorder_required_items": reorder_required_count
        },
        "sales_trend": sales_trend,
        "stock_distribution": {
            "well_stocked": len(products) - reorder_required_count,
            "reorder_required": reorder_required_count
        },
        "stock_levels": stock_levels[:10]
    }

@router.get("/products", tags=["Products"])
async def get_products(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by product name"),
    current_user: Dict = Depends(get_current_user)
):
    """
    Get list of all products with pagination and filtering
    
    - **page**: Page number (default: 1)
    - **limit**: Items per page (default: 10, max: 100)
    - **search**: Search by product name (optional)
    """
    offset = validate_pagination(page, limit)
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Build search query
    where_clause = ""
    params = []
    
    if search:
        where_clause = "WHERE LOWER(name) LIKE LOWER(%s)"
        params.append(f"%{search}%")
    
    # Get total count with search
    count_query = f"SELECT COUNT(*) FROM products {where_clause}"
    cur.execute(count_query, params)
    total = cur.fetchone()[0]
    
    # Get paginated products with search
    products_query = f"""
        SELECT id, name, stock, min_stock, lead_time, created_at, updated_at
        FROM products
        {where_clause}
        ORDER BY id
        LIMIT %s OFFSET %s
    """
    cur.execute(products_query, params + [limit, offset])
    
    products = []
    for product_id, name, stock, min_stock, lead_time, created, updated in cur.fetchall():
        reorder_info = get_product_reorder_info(cur, product_id, stock, min_stock, lead_time)
        products.append({
            "id": product_id,
            "name": name,
            "stock": stock,
            "min_stock": min_stock,
            "lead_time": lead_time,
            "created_at": created.isoformat() if created else None,
            "updated_at": updated.isoformat() if updated else None,
            **reorder_info
        })
    
    cur.close()
    conn.close()
    
    return {
        "products": products,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        }
    }

@router.post("/products", tags=["Products"], status_code=status.HTTP_201_CREATED)
async def add_product(
    product: ProductCreate,
    request: Request,
    current_user: Dict = Depends(get_admin_user)
):
    """
    Add a new product (Admin only)
    
    - **name**: Product name (required)
    - **stock**: Stock quantity (required, >= 0)
    - **min_stock**: Minimum stock level (required, >= 0)
    - **lead_time**: Lead time in days (default: 5, must be > 0)
    """
    name = product.name.strip()
    
    if not name:
        raise HTTPException(status_code=400, detail="Product name is required and cannot be empty")
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("SELECT id FROM products WHERE LOWER(name) = LOWER(%s)", (name,))
    if cur.fetchone():
        cur.close()
        conn.close()
        raise HTTPException(status_code=409, detail="Product with this name already exists")

    cur.execute(
        "INSERT INTO products (name, stock, min_stock, lead_time) VALUES (%s, %s, %s, %s) RETURNING id",
        (name, product.stock, product.min_stock, product.lead_time)
    )
    product_id = cur.fetchone()[0]
    conn.commit()
    
    log_audit(
        action="INSERT_PRODUCT",
        table_name="products",
        record_id=product_id,
        details={"name": name, "stock": product.stock, "min_stock": product.min_stock, "lead_time": product.lead_time},
        ip_address=request.client.host
    )
    
    # Broadcast real-time event
    await broadcast_event("product_added", {
        "product_id": product_id,
        "name": name,
        "stock": product.stock,
        "min_stock": product.min_stock,
        "lead_time": product.lead_time
    })
    
    cur.close()
    conn.close()
    return {"message": "Product added successfully", "product_id": product_id}

@router.get("/sales", tags=["Sales"])
async def get_sales(
    product_id: Optional[int] = Query(None, description="Filter by product ID"),
    start_date: Optional[date] = Query(None, description="Start date filter"),
    end_date: Optional[date] = Query(None, description="End date filter"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    current_user: Dict = Depends(get_current_user)
):
    """
    Get list of all sales records with pagination
    
    - **product_id**: Filter by product ID (optional)
    - **start_date**: Start date filter (optional)
    - **end_date**: End date filter (optional)
    - **page**: Page number (default: 1)
    - **limit**: Items per page (default: 10, max: 100)
    """
    offset = validate_pagination(page, limit)
    
    # Build query dynamically
    conditions = []
    params = []
    
    if product_id:
        conditions.append("s.product_id = %s")
        params.append(product_id)
    
    if start_date:
        conditions.append("s.sale_date >= %s")
        params.append(start_date)
    
    if end_date:
        conditions.append("s.sale_date <= %s")
        params.append(end_date)
    
    where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Get total count
    count_query = f"SELECT COUNT(*) FROM sales s {where_clause}"
    cur.execute(count_query, params)
    total = cur.fetchone()[0]
    
    # Get paginated sales
    sales_query = f"""
        SELECT s.id, s.product_id, p.name, s.quantity, s.sale_date, s.created_at
        FROM sales s
        JOIN products p ON s.product_id = p.id
        {where_clause}
        ORDER BY s.sale_date DESC, s.id DESC
        LIMIT %s OFFSET %s
    """
    cur.execute(sales_query, params + [limit, offset])
    
    sales = [
        {
            "id": r[0],
            "product_id": r[1],
            "product_name": r[2],
            "quantity": r[3],
            "sale_date": r[4].isoformat() if r[4] else None,
            "created_at": r[5].isoformat() if r[5] else None
        }
        for r in cur.fetchall()
    ]
    
    cur.close()
    conn.close()
    
    return {
        "sales": sales,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        },
        "filters": {
            "product_id": product_id,
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None
        }
    }

@router.post("/sales", tags=["Sales"], status_code=status.HTTP_201_CREATED)
async def add_sale(
    sale: SaleCreate,
    request: Request,
    current_user: Dict = Depends(get_admin_user)
):
    """
    Record a new sale (Admin only)
    
    - **product_id**: Product ID (required)
    - **quantity**: Sale quantity (required, > 0)
    - **sale_date**: Sale date (optional, defaults to today)
    """
    sale_date = sale.sale_date or date.today()

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT stock FROM products WHERE id = %s", (sale.product_id,))
        result = cur.fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail=f"Product with ID {sale.product_id} does not exist")
        
        current_stock = result[0]
        if current_stock < sale.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock. Available: {current_stock}, Requested: {sale.quantity}"
            )

        cur.execute("INSERT INTO sales (product_id, quantity, sale_date) VALUES (%s, %s, %s)", 
                   (sale.product_id, sale.quantity, sale_date))
        cur.execute("UPDATE products SET stock = stock - %s WHERE id = %s", 
                   (sale.quantity, sale.product_id))
        conn.commit()
        
        log_audit(
            action="RECORD_SALE",
            table_name="sales",
            record_id=sale.product_id,
            details={
                "product_id": sale.product_id,
                "quantity": sale.quantity,
                "previous_stock": current_stock,
                "new_stock": current_stock - sale.quantity
            },
            ip_address=request.client.host
        )

        cur.execute("SELECT stock FROM products WHERE id = %s", (sale.product_id,))
        new_stock = cur.fetchone()[0]
        
        # Broadcast real-time event
        await broadcast_event("sale_recorded", {
            "product_id": sale.product_id,
            "quantity": sale.quantity,
            "previous_stock": current_stock,
            "new_stock": new_stock,
            "sale_date": str(sale_date)
        })
        
        return {"message": "Sale recorded", "updated_stock": new_stock}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Transaction failed: {str(e)}")
    finally:
        cur.close()
        conn.close()

@router.get("/reorder-check/{product_id}", tags=["Products"])
async def reorder_check(
    product_id: int,
    current_user: Dict = Depends(get_current_user)
):
    """
    Check reorder status for a specific product
    
    - **product_id**: Product ID
    """
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("SELECT stock, min_stock, lead_time FROM products WHERE id = %s", (product_id,))
    result = cur.fetchone()
    
    if not result:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Product not found")
    
    stock, min_stock, lead_time = result
    reorder_info = get_product_reorder_info(cur, product_id, stock, min_stock, lead_time)
    
    cur.close()
    conn.close()

    return {
        "stock": stock,
        "min_stock": min_stock,
        "lead_time": lead_time,
        "average_daily_sales": reorder_info["reorder_level"] / lead_time if lead_time > 0 else 0,
        **reorder_info
    }

@router.post("/products/{product_id}/reorder-reset", tags=["Products"])
async def reorder_reset(
    product_id: int,
    stock_update: StockUpdate,
    request: Request,
    current_user: Dict = Depends(get_admin_user)
):
    """
    Add stock to a product (Admin only)
    
    - **product_id**: Product ID
    - **new_stock**: Quantity to ADD to current stock (required, > 0)
    """
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT stock FROM products WHERE id = %s", (product_id,))
        result = cur.fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="Product not found")
        
        previous_stock = result[0]
        updated_stock = previous_stock + stock_update.new_stock
        
        cur.execute("UPDATE products SET stock = stock + %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                   (stock_update.new_stock, product_id))
        conn.commit()
        
        log_audit(
            action="REORDER_RESET",
            table_name="products",
            record_id=product_id,
            details={
                "previous_stock": previous_stock,
                "quantity_added": stock_update.new_stock,
                "new_stock": updated_stock
            },
            ip_address=request.client.host
        )
        
        # Broadcast real-time event
        await broadcast_event("stock_updated", {
            "product_id": product_id,
            "previous_stock": previous_stock,
            "quantity_added": stock_update.new_stock,
            "new_stock": updated_stock
        })
        
        return {
            "message": "Stock replenished successfully",
            "previous_stock": previous_stock,
            "current_stock": updated_stock
        }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Transaction failed: {str(e)}")
    finally:
        cur.close()
        conn.close()

# CSV Bulk Upload for Products
@router.post("/products/upload-csv", tags=["Products"])
async def upload_csv(
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_admin_user)
):
    """
    Bulk upload products via CSV file (Admin only)
    
    CSV format: name, sku, stock, min_stock, lead_time
    """
    return await upload_csv_handler(file)
