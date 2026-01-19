def calculate_reorder(avg_daily_sales, lead_time, current_stock):
    """
    Legacy function - kept for backward compatibility.
    Use calculate_reorder_status() for new implementations.
    """
    reorder_point = avg_daily_sales * lead_time
    return current_stock <= reorder_point


def calculate_reorder_status(stock, min_stock, avg_daily_sales, lead_time):
    """
    PRODUCTION-GRADE REORDER LOGIC - Single source of truth with 4-state classification.
    
    States:
    1. OK - Stock is healthy (>= min_stock)
    2. LOW - Stock below min_stock but available (no immediate reorder)
    3. CRITICAL - Stock below demand-based reorder level (reorder required)
    4. OUT_OF_STOCK - Stock is zero (urgent reorder)
    
    Key Insight:
    - min_stock is a SAFETY BUFFER, NOT a reorder trigger
    - Shopkeepers may partially restock, so stock < min_stock doesn't mean critical
    - reorder_level (demand-based) is the TRUE reorder trigger
    
    Args:
        stock: Current stock quantity
        min_stock: Minimum safety stock threshold (buffer, not trigger)
        avg_daily_sales: Average daily sales from history
        lead_time: Supplier lead time in days
    
    Returns:
        dict: {
            "status": str ("OK" | "LOW" | "CRITICAL" | "OUT_OF_STOCK"),
            "reorder_required": bool (True for CRITICAL or OUT_OF_STOCK),
            "reorder_level": int (demand-based reorder point)
        }
    
    Examples:
        # Out of stock - urgent
        >>> calculate_reorder_status(0, 100, 10, 5)
        {"status": "OUT_OF_STOCK", "reorder_required": True, "reorder_level": 50}
        
        # Critical - below demand reorder point
        >>> calculate_reorder_status(40, 100, 10, 5)
        {"status": "CRITICAL", "reorder_required": True, "reorder_level": 50}
        
        # Low - partial restock, below min_stock but above reorder level
        >>> calculate_reorder_status(80, 100, 10, 5)
        {"status": "LOW", "reorder_required": False, "reorder_level": 50}
        
        # OK - healthy stock
        >>> calculate_reorder_status(150, 100, 10, 5)
        {"status": "OK", "reorder_required": False, "reorder_level": 50}
        
        # New product with no sales - fallback to min_stock
        >>> calculate_reorder_status(80, 100, 0, 5)
        {"status": "LOW", "reorder_required": False, "reorder_level": 100}
    """
    # Calculate demand-based reorder level
    # Fallback to min_stock if no sales history
    if avg_daily_sales > 0:
        reorder_level = int(avg_daily_sales * lead_time)
    else:
        # For new products, don't use min_stock as reorder_level
        # This prevents marking them as CRITICAL just because stock < min_stock
        reorder_level = 0
    
    # State 1: OUT_OF_STOCK - Stock is zero
    if stock == 0:
        return {
            "status": "OUT_OF_STOCK",
            "reorder_required": True,
            "reorder_level": reorder_level if reorder_level > 0 else min_stock
        }
    
    # State 2: CRITICAL - Stock below demand-based reorder level (only if we have sales data)
    if avg_daily_sales > 0 and stock <= reorder_level:
        return {
            "status": "CRITICAL",
            "reorder_required": True,
            "reorder_level": reorder_level
        }
    
    # State 3: LOW - Stock below min_stock but above reorder level (partial restock scenario)
    # This also covers new products with no sales (avg_daily_sales == 0)
    if stock < min_stock:
        return {
            "status": "LOW",
            "reorder_required": False,
            "reorder_level": reorder_level if reorder_level > 0 else min_stock
        }
    
    # State 4: OK - Stock is healthy
    return {
        "status": "OK",
        "reorder_required": False,
        "reorder_level": reorder_level if reorder_level > 0 else min_stock
    }
