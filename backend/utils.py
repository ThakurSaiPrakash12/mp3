def calculate_reorder(avg_daily_sales, lead_time, current_stock):
    reorder_point = avg_daily_sales * lead_time
    return current_stock <= reorder_point
