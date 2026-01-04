from flask import Blueprint, request, jsonify
from database import get_db_connection
from utils import calculate_reorder
from datetime import date
from audit import log_audit

routes = Blueprint("routes", __name__)

#  Add Product
@routes.route("/products", methods=["POST"])
def add_product():
    data = request.json
    
    # Input Validation
    if not data:
        return jsonify({"error": "Request body is required"}), 400
    
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Product name is required and cannot be empty"}), 400
    
    try:
        stock = int(data["stock"])
        min_stock = int(data["min_stock"])
    except (KeyError, ValueError, TypeError):
        return jsonify({"error": "Stock and min_stock must be valid integers"}), 400
    
    if stock < 0:
        return jsonify({"error": "Stock cannot be negative"}), 400
    
    if min_stock < 0:
        return jsonify({"error": "Minimum stock cannot be negative"}), 400
    
    # Get lead_time from request or use default (5 days)
    lead_time = data.get("lead_time", 5)
    try:
        lead_time = int(lead_time)
    except (ValueError, TypeError):
        return jsonify({"error": "Lead time must be a valid integer"}), 400
    
    if lead_time <= 0:
        return jsonify({"error": "Lead time must be greater than 0"}), 400
    
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute(
        "INSERT INTO products (name, stock, min_stock, lead_time) VALUES (%s, %s, %s, %s) RETURNING id",
        (name, stock, min_stock, lead_time)
    )
    
    product_id = cur.fetchone()[0]
    conn.commit()
    
    # Audit log
    log_audit(
        action="INSERT_PRODUCT",
        table_name="products",
        record_id=product_id,
        details={
            "name": name,
            "stock": stock,
            "min_stock": min_stock,
            "lead_time": lead_time
        },
        ip_address=request.remote_addr
    )
    
    cur.close()
    conn.close()

    return jsonify({"message": "Product added successfully"})

@routes.route("/sales", methods=["POST"])
def add_sale():
    data = request.json
    
    # Input Validation
    if not data:
        return jsonify({"error": "Request body is required"}), 400
    
    try:
        product_id = int(data["product_id"])
        quantity = int(data["quantity"])
    except (KeyError, ValueError, TypeError):
        return jsonify({"error": "product_id and quantity must be valid integers"}), 400
    
    if quantity <= 0:
        return jsonify({"error": "Sale quantity must be greater than 0"}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Check if product exists and has sufficient stock
        cur.execute("SELECT stock FROM products WHERE id = %s", (product_id,))
        result = cur.fetchone()
        
        if not result:
            return jsonify({"error": f"Product with ID {product_id} does not exist"}), 404
        
        current_stock = result[0]
        if current_stock < quantity:
            return jsonify({
                "error": f"Insufficient stock. Available: {current_stock}, Requested: {quantity}"
            }), 400

        # Insert sale
        cur.execute(
            "INSERT INTO sales (product_id, quantity, sale_date) VALUES (%s, %s, %s)",
            (product_id, quantity, date.today())
        )

        # Update stock
        cur.execute(
            "UPDATE products SET stock = stock - %s WHERE id = %s",
            (quantity, product_id)
        )

        # Commit both operations atomically
        conn.commit()
        
        # Audit log
        log_audit(
            action="RECORD_SALE",
            table_name="sales",
            record_id=product_id,
            details={
                "product_id": product_id,
                "quantity": quantity,
                "previous_stock": current_stock,
                "new_stock": current_stock - quantity
            },
            ip_address=request.remote_addr
        )

        # Get updated stock
        cur.execute(
            "SELECT stock FROM products WHERE id = %s",
            (product_id,)
        )
        stock = cur.fetchone()[0]

        return jsonify({
            "message": "Sale recorded",
            "updated_stock": stock
        })

    except Exception as e:
        # Rollback on any failure
        conn.rollback()
        return jsonify({"error": "Transaction failed", "details": str(e)}), 500

    finally:
        cur.close()
        conn.close()
@routes.route("/reorder-check/<int:product_id>", methods=["GET"])
def reorder_check(product_id):
    conn = get_db_connection()
    cur = conn.cursor()

    # Get stock and lead_time from database
    cur.execute("SELECT stock, lead_time FROM products WHERE id = %s", (product_id,))
    result = cur.fetchone()
    
    if not result:
        cur.close()
        conn.close()
        return jsonify({"error": "Product not found"}), 404
    
    stock = result[0]
    lead_time = result[1]

    # Calculate avg daily sales (last 7 days)
    cur.execute("""
        SELECT COALESCE(SUM(quantity), 0) FROM sales
        WHERE product_id = %s
        AND sale_date >= CURRENT_DATE - INTERVAL '7 days'
    """, (product_id,))
    total_sales = cur.fetchone()[0]

    avg_sales = total_sales / 7 if total_sales > 0 else 0

    reorder_needed = calculate_reorder(avg_sales, lead_time, stock)

    cur.close()
    conn.close()

    return jsonify({
        "average_daily_sales": avg_sales,
        "current_stock": stock,
        "reorder_required": reorder_needed
    })
