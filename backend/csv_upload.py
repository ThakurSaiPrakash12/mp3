"""
CSV Upload endpoint for bulk product uploads
"""
from fastapi import HTTPException, UploadFile, Query
from database import get_db_connection
from audit import log_audit
from psycopg2.extras import execute_values
import csv
import io

async def upload_csv_handler(
    file: UploadFile,
    mode: str = Query("skip", regex="^(skip|update_stock)$", description="Duplicate handling mode")
):
    """
    Handle CSV file upload for bulk product creation.
    Admin only. Validates each row and performs bulk insert.
    Supports duplicate handling with skip or update_stock modes.
    """
    # Check if file has .csv extension
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
    
    try:
        # Read file content
        contents = await file.read()
        stream = io.StringIO(contents.decode("utf-8-sig"), newline=None)
        csv_reader = csv.DictReader(stream)

        # Validate CSV headers (allow extra columns; require expected ones)
        expected_headers = {'name', 'stock', 'min_stock', 'lead_time'}
        normalized_headers = {
            (header or '').strip().lstrip('\ufeff')
            for header in (csv_reader.fieldnames or [])
        }
        if not csv_reader.fieldnames or not expected_headers.issubset(normalized_headers):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid CSV format. Required headers: name,stock,min_stock,lead_time. "
                    f"Found headers: {','.join(sorted(normalized_headers)) or 'none'}"
                )
            )
        
        # Lists to store valid rows, errors, and tracking
        valid_products = []
        errors = []
        row_number = 1  # Start from 1 (header is 0)
        
        # Validate each row
        for row in csv_reader:
            row_number += 1
            error_msg = None
            
            try:
                normalized_row = {
                    (key or '').strip().lstrip('\ufeff'): (value or '').strip()
                    for key, value in row.items()
                }

                # Validate name
                name = normalized_row.get('name', '')
                if not name:
                    error_msg = "Product name is required and cannot be empty"
                    errors.append({"row": row_number, "error": error_msg})
                    continue
                
                # Validate stock
                try:
                    stock = int(normalized_row.get('stock', ''))
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
                    min_stock = int(normalized_row.get('min_stock', ''))
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
                    lead_time = int(normalized_row.get('lead_time', ''))
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
        
        # Merge duplicate names inside CSV (case-insensitive) to reduce DB work.
        merged_products = {}
        for product in valid_products:
            key = product["name"].strip().lower()
            if key in merged_products:
                merged_products[key]["stock"] += product["stock"]
                merged_products[key]["min_stock"] = product["min_stock"]
                merged_products[key]["lead_time"] = product["lead_time"]
            else:
                merged_products[key] = dict(product)

        valid_products = list(merged_products.values())

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
                lower_names = [product["name"].strip().lower() for product in valid_products]

                cur.execute(
                    """
                    SELECT id, LOWER(name) AS name_key
                    FROM products
                    WHERE LOWER(name) = ANY(%s)
                    """,
                    (lower_names,),
                )
                existing_rows = cur.fetchall()
                existing_by_key = {row[1]: row[0] for row in existing_rows}

                insert_rows = []
                update_rows = []

                for product in valid_products:
                    key = product["name"].strip().lower()
                    existing_id = existing_by_key.get(key)

                    if existing_id is None:
                        insert_rows.append(
                            (product["name"], product["stock"], product["min_stock"], product["lead_time"])
                        )
                    elif mode == "update_stock":
                        update_rows.append(
                            (existing_id, product["stock"], product["min_stock"], product["lead_time"])
                        )
                    else:
                        skipped_count += 1

                if insert_rows:
                    execute_values(
                        cur,
                        """
                        INSERT INTO products (name, stock, min_stock, lead_time)
                        VALUES %s
                        """,
                        insert_rows,
                        page_size=1000,
                    )
                    inserted_count = len(insert_rows)

                if update_rows:
                    execute_values(
                        cur,
                        """
                        UPDATE products AS p
                        SET stock = p.stock + v.stock,
                            min_stock = v.min_stock,
                            lead_time = v.lead_time,
                            updated_at = CURRENT_TIMESTAMP
                        FROM (VALUES %s) AS v(id, stock, min_stock, lead_time)
                        WHERE p.id = v.id
                        """,
                        update_rows,
                        page_size=1000,
                    )
                    updated_count = len(update_rows)
                
                conn.commit()
                
            except Exception as e:
                conn.rollback()
                cur.close()
                conn.close()
                raise HTTPException(
                    status_code=500,
                    detail=f"Database error during processing: {str(e)}"
                )
            
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
                "mode": mode
            },
            ip_address="127.0.0.1"  # Default for CSV upload
        )
        
        return {
            "message": "CSV processed",
            "inserted": inserted_count,
            "skipped": skipped_count,
            "updated": updated_count,
            "failed": failed_count,
            "errors": errors
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process CSV file: {str(e)}"
        )
