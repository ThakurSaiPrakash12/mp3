"""
Audit logging utilities for tracking all database changes.
Used for compliance, debugging, and accountability.
"""

from database import get_db_connection
import json

def log_audit(action, table_name, record_id=None, details=None, ip_address=None):
    """
    Log an audit entry for database changes.
    
    Args:
        action: Type of action (INSERT, UPDATE, DELETE, etc.)
        table_name: Name of the table being modified
        record_id: ID of the affected record (if applicable)
        details: Additional information (JSON string or dict)
        ip_address: IP address of the client making the request
    """
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Convert details to JSON string if it's a dict
        if isinstance(details, dict):
            details = json.dumps(details)
        
        cur.execute("""
            INSERT INTO audit_log (action, table_name, record_id, details, ip_address)
            VALUES (%s, %s, %s, %s, %s)
        """, (action, table_name, record_id, details, ip_address))
        
        conn.commit()
    except Exception as e:
        conn.rollback()
        # Don't fail the main operation if audit logging fails
        print(f"Audit log warning: {str(e)}")
    finally:
        cur.close()
        conn.close()
