"""
CSV Upload endpoint for bulk product uploads
"""
from flask import request, jsonify
from database import get_db_connection
from audit import log_audit
from auth import admin_required
import csv
import io

def upload_csv_handler():
    """
    Handle CSV file upload for bulk product creation.
    Admin only. Validates each row and performs bulk insert.
    Supports duplicate handling with skip or update_stock modes.
    """
    # Get mode parameter (skip or update_stock)
    mode = request.args.get('mode', 'skip')
    if mode not in ['skip', 'update_stock']:
        return jsonify({"error": "Invalid mode. Use 'skip' or 'update_stock'"}), 400
    
    # Check if file is present in the request
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    
    # Check if file is selected
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    # Check if file has .csv extension
    if not file.filename.endswith('.csv'):
        return jsonify({"error": "Only CSV files are allowed"}), 400
    
    try:
        # Read file content
        stream = io.StringIO(file.stream.read().decode("UTF-8"), newline=None)
        csv_reader = csv.DictReader(stream)
        
        # Validate CSV headers
        expected_headers = {'name', 'stock', 'min_stock', 'lead_time'}
        if not csv_reader.fieldnames or set(csv_reader.fieldnames) != expected_headers:
            return jsonify({
                "error": "Invalid CSV format. Expected headers: name,stock,min_stock,lead_time"
            }), 400
        
        # Lists to store valid rows, errors, and tracking
        valid_products = []
        errors = []
        skipped_products = []
        updated_products = []
        row_number = 1  # Start from 1 (header is 0)
        
        # Validate each row
        for row in csv_reader:
            row_number += 1
            error_msg = None
            
            try:
                # Validate name
                name = row.get('name', '').strip()
                if not name:
                    error_msg = "Product name is required and cannot be empty"
                    errors.append({"row": row_number, "error": error_msg})
                    continue
                
                # Validate stock
                try:
                    stock = int(row.get('stock', ''))
                    if stock < 0:
                        error_msg = "Stock cannot be negative"
                        errors.append({"row": row_number, "error": error_msg})
                        continue
                except (ValueError, TypeError):
                    error_msg = "Stock must be a valid integer"
                    errors.append({"row": row_number, "error": error_msg})
                    continue
                
                # Validate min_stock
                try:
                    min_stock = int(row.get('min_stock', ''))
                    if min_stock < 0:
                        error_msg = "Minimum stock cannot be negative"
                        errors.append({"row": row_number, "error": error_msg})
                        continue
                except (ValueError, TypeError):
                    error_msg = "Minimum stock must be a valid integer"
                    errors.append({"row": row_number, "error": error_msg})
                    continue
                
                # Validate lead_time
                try:
                    lead_time = int(row.get('lead_time', ''))
                    if lead_time <= 0:
                        error_msg = "Lead time must be greater than 0"
                        errors.append({"row": row_number, "error": error_msg})
                        continue
                except (ValueError, TypeError):
                    error_msg = "Lead time must be a valid integer"
                    errors.append({"row": row_number, "error": error_msg})
                    continue
                
                # If all validations pass, add to valid products list
                valid_products.append({
                    "name": name,
                    "stock": stock,
                    "min_stock": min_stock,
                    "lead_time": lead_time
                })
                
            except Exception as e:
                errors.append({"row": row_number, "error": f"Unexpected error: {str(e)}"})
                continue
        
        # Calculate totals
        total_rows = row_number - 1  # Exclude header row
        failed_count = len(errors)
        inserted_count = 0
        skipped_count = 0
        updated_count = 0
        
        # Process valid products with duplicate handling
        if valid_products:
            conn = get_db_connection()
            cur = conn.cursor()
            
            try:
                for product in valid_products:
                    name = product['name']
                    stock = product['stock']
                    min_stock = product['min_stock']
                    lead_time = product['lead_time']
                    
                    # Check if product exists (case-insensitive)
                    cur.execute(
                        "SELECT id, stock, min_stock, lead_time FROM products WHERE LOWER(name) = LOWER(%s)",
                        (name,)
                    )
                    existing = cur.fetchone()
                    
                    if existing:
                        if mode == 'skip':
                            # Skip duplicate
                            skipped_products.append(name)
                            skipped_count += 1
                            
                            # Log audit
                            log_audit(
                                action="DUPLICATE_SKIPPED",
                                table_name="products",
                                record_id=existing[0],
                                details={"name": name},
                                ip_address=request.remote_addr
                            )
                        elif mode == 'update_stock':
                            # Update existing product
                            product_id = existing[0]
                            previous_stock = existing[1]
                            new_stock = previous_stock + stock
                            
                            cur.execute(
                                """UPDATE products 
                                   SET stock = %s, min_stock = %s, lead_time = %s, updated_at = CURRENT_TIMESTAMP
                                   WHERE id = %s""",
                                (new_stock, min_stock, lead_time, product_id)
                            )
                            updated_products.append(name)
                            updated_count += 1
                            
                            # Log audit
                            log_audit(
                                action="DUPLICATE_UPDATED",
                                table_name="products",
                                record_id=product_id,
                                details={
                                    "name": name,
                                    "previous_stock": previous_stock,
                                    "new_stock": new_stock,
                                    "min_stock": min_stock,
                                    "lead_time": lead_time
                                },
                                ip_address=request.remote_addr
                            )
                    else:
                        # Insert new product
                        cur.execute(
                            """INSERT INTO products (name, stock, min_stock, lead_time)
                               VALUES (%s, %s, %s, %s)""",
                            (name, stock, min_stock, lead_time)
                        )
                        inserted_count += 1
                
                conn.commit()
                
            except Exception as e:
                conn.rollback()
                cur.close()
                conn.close()
                return jsonify({
                    "error": "Database error during processing",
                    "details": str(e)
                }), 500
            
            finally:
                cur.close()
                conn.close()
        
        # Log audit entry
        log_audit(
            action="BULK_UPLOAD_PRODUCTS",
            table_name="products",
            record_id=None,
            details={
                "total_rows": total_rows,
                "inserted": inserted_count,
                "skipped": skipped_count,
                "updated": updated_count,
                "failed": failed_count,
                "mode": mode,
                "uploader": request.user.get("username")
            },
            ip_address=request.remote_addr
        )
        
        return jsonify({
            "message": "CSV processed",
            "inserted": inserted_count,
            "skipped": skipped_count,
            "updated": updated_count,
            "failed": failed_count,
            "errors": errors
        }), 200
        
    except Exception as e:
        return jsonify({
            "error": "Failed to process CSV file",
            "details": str(e)
        }), 500
