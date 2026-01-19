from flask import Blueprint, request, jsonify
from database import get_db_connection
from utils import calculate_reorder_status
from datetime import date, datetime, timedelta
from audit import log_audit
from auth import generate_token, USERS, token_required, admin_required
from csv_upload import upload_csv_handler

routes = Blueprint("routes", __name__)

# Validation Helpers
def validate_pagination(page, limit):
    """Validate and return pagination parameters"""
    if page < 1:
        return None, (jsonify({"error": "Page must be >= 1"}), 400)
    if limit < 1 or limit > 100:
        return None, (jsonify({"error": "Limit must be between 1 and 100"}), 400)
    return (page - 1) * limit, None

def validate_positive_int(value, field_name):
    """Validate positive integer field"""
    try:
        val = int(value)
        if val <= 0:
            return None, (jsonify({"error": f"{field_name} must be greater than 0"}), 400)
        return val, None
    except (ValueError, TypeError):
        return None, (jsonify({"error": f"{field_name} must be a valid integer"}), 400)

def validate_non_negative_int(value, field_name):
    """Validate non-negative integer field"""
    try:
        val = int(value)
        if val < 0:
            return None, (jsonify({"error": f"{field_name} cannot be negative"}), 400)
        return val, None
    except (ValueError, TypeError):
        return None, (jsonify({"error": f"{field_name} must be a valid integer"}), 400)

def get_product_reorder_info(cur, product_id, stock, min_stock, lead_time):
    """Calculate reorder info for a product (DRY principle)"""
    cur.execute("""
        SELECT COALESCE(SUM(quantity), 0) FROM sales
        WHERE product_id = %s AND sale_date >= CURRENT_DATE - INTERVAL '7 days'
    """, (product_id,))
    avg_sales = cur.fetchone()[0] / 7
    return calculate_reorder_status(stock, min_stock, avg_sales, lead_time)

# Login endpoint
@routes.route("/login", methods=["POST"])
def login():
    data = request.json
    
    if not data:
        return jsonify({"error": "Request body is required"}), 400
    
    username = data.get("username")
    password = data.get("password")
    
    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
    
    user = USERS.get(username)
    if not user or user["password"] != password:
        return jsonify({"error": "Invalid credentials"}), 401
    
    token = generate_token(username, user["role"])
    
    return jsonify({
        "token": token,
        "username": username,
        "role": user["role"]
    })

# Dashboard - Real data from database
@routes.route("/dashboard", methods=["GET"])
@token_required
def dashboard():
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
        stock_levels.append({"id": product_id, "name": name, "stock": stock, "min_stock": min_stock, "reorder_required": reorder_info["reorder_required"]})
    
    cur.execute("""
        SELECT sale_date::date, COALESCE(SUM(quantity), 0) as quantity
        FROM sales WHERE sale_date >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY sale_date::date ORDER BY sale_date::date
    """)
    sales_dict = {row[0]: row[1] for row in cur.fetchall()}
    
    sales_trend = [{"date": (datetime.now().date() - timedelta(days=6-i)).isoformat(), "quantity": sales_dict.get(datetime.now().date() - timedelta(days=6-i), 0)} for i in range(7)]
    
    cur.execute("SELECT COALESCE(SUM(quantity), 0) FROM sales WHERE sale_date >= CURRENT_DATE - INTERVAL '7 days'")
    total_sales = cur.fetchone()[0]
    
    cur.close()
    conn.close()
    
    return jsonify({
        "summary": {"total_products": len(products), "total_sales_last_7_days": total_sales, "low_stock_items": low_stock_count, "reorder_required_items": reorder_required_count},
        "sales_trend": sales_trend,
        "stock_distribution": {"well_stocked": len(products) - reorder_required_count, "reorder_required": reorder_required_count},
        "stock_levels": stock_levels[:10]
    })

@routes.route("/products", methods=["GET"])
@token_required
def get_products():
    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 10, type=int)
    search = request.args.get("search", "").strip()
    
    offset, error = validate_pagination(page, limit)
    if error:
        return error
    
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
        products.append({"id": product_id, "name": name, "stock": stock, "min_stock": min_stock, "lead_time": lead_time, "created_at": created.isoformat() if created else None, "updated_at": updated.isoformat() if updated else None, **reorder_info})
    
    cur.close()
    conn.close()
    
    return jsonify({
        "products": products,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        }
    })

@routes.route("/products", methods=["POST"])
@admin_required
def add_product():
    if not (data := request.json):
        return jsonify({"error": "Request body is required"}), 400
    
    if not (name := data.get("name", "").strip()):
        return jsonify({"error": "Product name is required and cannot be empty"}), 400
    
    stock, error = validate_non_negative_int(data.get("stock"), "Stock")
    if error:
        return error
    
    min_stock, error = validate_non_negative_int(data.get("min_stock"), "Minimum stock")
    if error:
        return error
    
    lead_time, error = validate_positive_int(data.get("lead_time", 5), "Lead time")
    if error:
        return error
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("SELECT id FROM products WHERE LOWER(name) = LOWER(%s)", (name,))
    if cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({"error": "Product with this name already exists"}), 409

    cur.execute("INSERT INTO products (name, stock, min_stock, lead_time) VALUES (%s, %s, %s, %s) RETURNING id", (name, stock, min_stock, lead_time))
    product_id = cur.fetchone()[0]
    conn.commit()
    
    log_audit(action="INSERT_PRODUCT", table_name="products", record_id=product_id, details={"name": name, "stock": stock, "min_stock": min_stock, "lead_time": lead_time}, ip_address=request.remote_addr)
    
    cur.close()
    conn.close()
    return jsonify({"message": "Product added successfully"})

@routes.route("/sales", methods=["GET"])
@token_required
def get_sales():
    product_id = request.args.get("product_id", type=int)
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 10, type=int)
    
    offset, error = validate_pagination(page, limit)
    if error:
        return error
    
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
    
    sales = [{"id": r[0], "product_id": r[1], "product_name": r[2], "quantity": r[3], "sale_date": r[4].isoformat() if r[4] else None, "created_at": r[5].isoformat() if r[5] else None} for r in cur.fetchall()]
    
    cur.close()
    conn.close()
    
    return jsonify({
        "sales": sales,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        },
        "filters": {
            "product_id": product_id,
            "start_date": start_date,
            "end_date": end_date
        }
    })

@routes.route("/sales", methods=["POST"])
@admin_required
def add_sale():
    if not (data := request.json):
        return jsonify({"error": "Request body is required"}), 400
    
    product_id, error = validate_positive_int(data.get("product_id"), "Product ID")
    if error:
        return error
    
    quantity, error = validate_positive_int(data.get("quantity"), "Quantity")
    if error:
        return error

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT stock FROM products WHERE id = %s", (product_id,))
        if not (result := cur.fetchone()):
            return jsonify({"error": f"Product with ID {product_id} does not exist"}), 404
        
        current_stock = result[0]
        if current_stock < quantity:
            return jsonify({"error": f"Insufficient stock. Available: {current_stock}, Requested: {quantity}"}), 400

        cur.execute("INSERT INTO sales (product_id, quantity, sale_date) VALUES (%s, %s, %s)", (product_id, quantity, date.today()))
        cur.execute("UPDATE products SET stock = stock - %s WHERE id = %s", (quantity, product_id))
        conn.commit()
        
        log_audit(action="RECORD_SALE", table_name="sales", record_id=product_id, details={"product_id": product_id, "quantity": quantity, "previous_stock": current_stock, "new_stock": current_stock - quantity}, ip_address=request.remote_addr)

        cur.execute("SELECT stock FROM products WHERE id = %s", (product_id,))
        return jsonify({"message": "Sale recorded", "updated_stock": cur.fetchone()[0]})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": "Transaction failed", "details": str(e)}), 500
    finally:
        cur.close()
        conn.close()

@routes.route("/reorder-check/<int:product_id>", methods=["GET"])
@token_required
def reorder_check(product_id):
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("SELECT stock, min_stock, lead_time FROM products WHERE id = %s", (product_id,))
    result = cur.fetchone()
    
    if not result:
        cur.close()
        conn.close()
        return jsonify({"error": "Product not found"}), 404
    
    stock, min_stock, lead_time = result
    reorder_info = get_product_reorder_info(cur, product_id, stock, min_stock, lead_time)
    
    cur.close()
    conn.close()

    return jsonify({
        "stock": stock, "min_stock": min_stock, "lead_time": lead_time,
        "average_daily_sales": reorder_info["reorder_level"] / lead_time if lead_time > 0 else 0,
        **reorder_info
    })

@routes.route("/products/<int:product_id>/reorder-reset", methods=["POST"])
@admin_required
def reorder_reset(product_id):
    if not (data := request.json):
        return jsonify({"error": "Request body is required"}), 400
    
    new_stock, error = validate_positive_int(data.get("new_stock"), "New stock")
    if error:
        return error
    
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT stock FROM products WHERE id = %s", (product_id,))
        if not (result := cur.fetchone()):
            cur.close()
            conn.close()
            return jsonify({"error": "Product not found"}), 404
        
        previous_stock = result[0]
        cur.execute("UPDATE products SET stock = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s", (new_stock, product_id))
        conn.commit()
        
        log_audit(action="REORDER_RESET", table_name="products", record_id=product_id, details={"previous_stock": previous_stock, "new_stock": new_stock, "difference": new_stock - previous_stock}, ip_address=request.remote_addr)
        
        return jsonify({"message": "Stock replenished successfully", "previous_stock": previous_stock, "current_stock": new_stock})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": "Transaction failed", "details": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# CSV Bulk Upload for Products
@routes.route("/products/upload-csv", methods=["POST"])
@admin_required
def upload_csv():
    return upload_csv_handler()
