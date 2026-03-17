# 📦 Inventory Management System — Full README & Codebase Deep Dive

> This document maps every concept in the README to the actual file, function, and SQL query that implements it.

---

## 🏗️ 1. Tech Stack Map

| Layer | Technology | Entry Point |
|---|---|---|
| Backend server | FastAPI (Python) | [backend/app.py](file:///c:/Users/thaku/Desktop/all/mp3/backend/app.py) |
| Database driver | psycopg2 → PostgreSQL | [backend/database.py](file:///c:/Users/thaku/Desktop/all/mp3/backend/database.py) |
| Real-time push | FastAPI WebSocket (`/ws`) | [backend/websocket_manager.py](file:///c:/Users/thaku/Desktop/all/mp3/backend/websocket_manager.py) |
| Frontend | React + TypeScript + Vite | `frontend/` |
| Data fetching | TanStack Query | React components |
| Charts | Recharts | Analytics / dashboard pages |
| Styling | Tailwind + Radix UI | `frontend/` |

---

## 🗄️ 2. Database Schema ([backend/schema.sql](file:///c:/Users/thaku/Desktop/all/mp3/backend/schema.sql))

```
suppliers
  id, name, contact_name, email, phone, address, lead_time_days, created_at

products
  id, name, stock, min_stock, lead_time, supplier_id → suppliers.id
  cost_price, selling_price, created_at, updated_at

sales
  id, product_id → products.id, quantity, sale_date, created_at

purchase_orders
  id, supplier_id → suppliers.id, status (PENDING/APPROVED/DELIVERED/CANCELLED), created_at

purchase_items
  id, order_id → purchase_orders.id, product_id → products.id
  quantity, unit_cost, line_total

audit_log
  id, action, table_name, record_id, details (JSONB), ip_address, created_at
```

### Foreign Key Chain
```
products.supplier_id ──► suppliers.id
sales.product_id ────────► products.id
purchase_orders.supplier_id ─► suppliers.id
purchase_items.order_id ────► purchase_orders.id
purchase_items.product_id ──► products.id
```

---

## 🌐 3. API Surface — Route → Service → Repository Chain

### Core Routes (`backend/routes/`)

| Endpoint | Route File | Service File | Repository File |
|---|---|---|---|
| `GET /dashboard` | `dashboard_routes.py` | `sales_service.py` | `product_repository.py` |
| `GET /products` | `product_routes.py` | `product_service.py` | `product_repository.py` |
| `POST /products` | `product_routes.py` | `product_service.py` | `product_repository.py` |
| `POST /sales` | `sales_routes.py` | `sales_service.py` | `sales_repository.py` |
| `GET /reorder-check/{id}` | `product_routes.py` | `product_service.py` | `product_repository.py` |
| `GET /forecast/{id}` | `forecast_routes.py` | `forecast_service.py` | `forecast_repository.py` |
| `GET /forecast` | `forecast_routes.py` | `forecast_service.py` | `forecast_repository.py` |
| `GET /forecast/critical/alerts` | `forecast_routes.py` | `forecast_service.py` | `forecast_repository.py` |
| `GET /analytics/profit` | `supplier_routes.py` (business) | `analytics_service.py` | `analytics_repository.py` |
| `GET /purchase-orders` | `purchase_routes.py` | `purchase_service.py` | `purchase_repository.py` |
| `PUT /purchase-orders/{id}/status` | `purchase_routes.py` | `purchase_service.py` | `purchase_repository.py` |

---

## 🧮 4. ALL FORMULAS — Mapped to Exact Files & Lines

### 4.1 Forecast Daily Demand

> **File: `backend/utils/calculations.py` → `calculate_forecast_daily()` (lines 9–32)**
> **Also: `backend/services/forecast_service.py` → `_weighted_forecast()` (lines 25–40)**

**Primary formula (when any of today/yesterday/2daysago > 0):**
```
forecast_daily = 0.5 × sales_today
               + 0.3 × sales_yesterday
               + 0.2 × sales_two_days_ago
```

**Fallback formula (when all three recent days are zero):**
```
forecast_daily = avg_7d = SUM(sales last 7 days) / 7
```

**Constants defined in `forecast_service.py`:**
```python
WEIGHT_TODAY       = 0.5
WEIGHT_YESTERDAY   = 0.3
WEIGHT_TWO_DAYS_AGO = 0.2
SAFETY_STOCK_DAYS  = 2
```

**How daily sales data is fetched:**
- `forecast_repository.py → get_sales_windows()` runs a single SQL `SELECT` with multiple `CASE WHEN` branches for each time window (today, yesterday, 2 days ago, 3d, 7d, 30d).
- `api_helpers.py → get_product_reorder_info()` runs its own inline SQL for the same purpose but for bulk product listing (dashboard, product list).

---

### 4.2 Safety Stock

> **File: `backend/utils/calculations.py` → `calculate_inventory_metrics()` (line 46)**
> **Also: `backend/services/forecast_service.py` (line 80)**

```
safety_stock = 2 × forecast_daily
```

The multiplier `2` is the `SAFETY_STOCK_DAYS` constant — meaning you always want to keep 2 extra days of demand as a buffer.

---

### 4.3 Reorder Point

> **File: `backend/utils/calculations.py` → `calculate_inventory_metrics()` (line 47)**
> **Also: `backend/services/forecast_service.py` (line 81)**

```
reorder_point = (forecast_daily × lead_time) + safety_stock
```

`lead_time` comes from `products.lead_time` (days). This represents how far in advance you need to trigger a reorder to account for delivery time plus buffer.

---

### 4.4 Days of Inventory (Stock Coverage)

> **File: `backend/utils/calculations.py` → `calculate_inventory_metrics()` (line 48)**
> **Also: `backend/services/forecast_service.py` (lines 84–90)**

```
days_of_inventory = stock / forecast_daily
                  = null  (if forecast_daily == 0)
```

`days_until_stockout` in the forecast response is the integer version of the same formula:
```
days_until_stockout = 0                     (if stock <= 0)
                    = int(stock / forecast_daily)  (otherwise)
                    = null                   (if forecast_daily <= 0)
```

---

### 4.5 Reorder Status Classification

> **File: `backend/utils/calculations.py` → `calculate_reorder_status()` (lines 96–107)**
> **Also: `backend/services/forecast_service.py` → `_classify_status()` (lines 56–63)**

Priority order (first match wins):

| Priority | Status | Condition | `reorder_required` |
|---|---|---|---|
| 1 | `OUT_OF_STOCK` | `stock == 0` | `True` |
| 2 | `CRITICAL` | `stock <= reorder_point` | `True` |
| 3 | `LOW` | `stock < min_stock` | `False` |
| 4 | `OK` | otherwise | `False` |

**Legacy backward-compat field:**
```python
reorder_level = int(round(reorder_point))  # if reorder_point > 0
              = min_stock                   # fallback
```

---

### 4.6 Rolling Sales Window Averages (Forecast supporting metrics)

> **File: `backend/repositories/forecast_repository.py` → `get_sales_windows()` (lines 28–62)**

```
avg_3d  = total_3d / 3     (sales summed over last 3 days)
avg_7d  = total_7d / 7     (sales summed over last 7 days)
avg_30d = total_30d / 30   (sales summed over last 30 days)
```

These are **informational** — only `avg_7d` is used as the fallback for `forecast_daily`.

---

### 4.7 Trend Signal

> **File: `backend/services/forecast_service.py` → `_detect_trend()` (lines 43–53)**

```
threshold = avg_7d × 0.05     (5% band)

if avg_3d > avg_7d + threshold  → "increasing"
if avg_3d < avg_7d - threshold  → "decreasing"
else                            → "stable"
```

> [!NOTE]
> Trend is **informational only**. It does not change the `forecast_daily` value.

---

### 4.8 Forecast Projections

> **File: `backend/services/forecast_service.py` → `get_product_forecast()` (lines 111–112)**

```
forecast_next_7_days  = forecast_daily × 7
forecast_next_30_days = forecast_daily × 30
```

---

### 4.9 Profit Analytics Formulas

> **File: `backend/repositories/analytics_repository.py`**
> **File: `backend/services/analytics_service.py` → `get_profit_analytics()` (line 18)**

All formulas run as SQL aggregations on `sales JOIN products`:

```sql
revenue = SUM(selling_price × quantity)
cost    = SUM(cost_price    × quantity)
profit  = SUM((selling_price - cost_price) × quantity)
```

```
profit_margin_pct = (profit / revenue) × 100    if revenue > 0
                  = 0                            otherwise
```

**Monthly breakdown:** same SQL but grouped by `DATE_TRUNC('month', sale_date)`.

**Top profitable products:** same SQL grouped by `p.id, p.name`, ordered by `profit DESC, quantity_sold DESC`, limited to top 5.

---

### 4.10 Dashboard Summary Metrics

> **File: `backend/routes/dashboard_routes.py` → `dashboard()` (lines 17–76)**

| Field | Formula |
|---|---|
| `total_products` | `COUNT(products)` — length of the products list |
| `total_sales_last_7_days` | `SUM(sales.quantity WHERE sale_date >= NOW() - 7 days)` |
| `low_stock_items` | `COUNT(products WHERE stock < min_stock)` |
| `reorder_required_items` | `COUNT(products WHERE reorder_required == True)` |
| `well_stocked` | `total_products - reorder_required_items` |
| `reorder_required` (distribution) | `reorder_required_items` |
| `stock_coverage_summary.days` | `MIN(days_of_inventory)` across all products with non-null coverage |

**Sales Trend (7-day time series):**
> **File: `backend/services/sales_service.py` → `get_sales_trend_data()`**
- Returns date + total daily quantity sold for each of the last 7 days (filled in even if 0).

---

## 🔁 5. How Each Formula Travels Through the Layers

```
HTTP Request
    │
    ▼
routes/[x]_routes.py        ← HTTP handling only (FastAPI routers)
    │
    ▼
services/[x]_service.py     ← Business logic orchestration
    │            │
    │            ▼
    │       utils/calculations.py   ← PURE MATH (no DB, no HTTP)
    │            • calculate_forecast_daily()
    │            • calculate_inventory_metrics()
    │            • calculate_reorder_status()
    │
    ▼
repositories/[x]_repository.py  ← All DB queries (raw SQL via psycopg2)
    │
    ▼
PostgreSQL database
```

### The "glue" helper
`utils/api_helpers.py → get_product_reorder_info()` is a shared helper called from:
- `dashboard_routes.py` (for every product in the dashboard loop)
- `product_service.py` (for the product list and reorder-check endpoint)

It runs the sales aggregation SQL inline then calls `utils/calculations.py` functions to do the math.

---

## ⚡ 6. Real-Time WebSocket Events

> **File: `backend/websocket_manager.py`**

| Event | Triggered By | What Refreshes |
|---|---|---|
| `connected` | Client connects to `/ws` | — |
| `product_added` | `POST /products` | Product list |
| `sale_recorded` | `POST /sales` | Sales list |
| `stock_updated` | `POST /sales` or PO delivery | Dashboard, product list |
| `forecast_updated` | `POST /sales` or PO delivery | Forecast screens |
| `products_imported` | `POST /products/upload-csv` | Product list |
| `pong` | Client sends `ping` heartbeat | Keep-alive |

---

## 📋 7. Business Flow Logic

### Sale Flow (`POST /sales`)
1. Validate stock availability
2. Insert into `sales` table
3. Decrement `products.stock`
4. Emit: `sale_recorded`, `stock_updated`, `forecast_updated`

### Purchase Order Delivery (`PUT /purchase-orders/{id}/status` → DELIVERED)
1. Validate status transition
2. `purchase_repository.py → update_order_status_and_deliver()`:
   - Updates PO status to DELIVERED
   - Loops over `purchase_items` → increments `products.stock` by item quantities
   - Optionally updates `products.cost_price` from item unit cost
3. Emit: `stock_updated`
4. For each updated product: call `forecast_service.get_product_forecast()` → emit `forecast_updated`

### Product Reorder Reset (`POST /products/{id}/reorder-reset`)
1. `product_service.replenish_stock()` → `product_repository.add_stock()` increments stock
2. Audit logged as `REORDER_RESET`
3. Emit: `stock_updated`

---

## 🗂️ 8. File-by-File Summary

| File | Purpose | Key Logic |
|---|---|---|
| `backend/utils/calculations.py` | **Pure math — single source of truth** | All 3 core formulas: `calculate_forecast_daily`, `calculate_inventory_metrics`, `calculate_reorder_status` |
| `backend/utils/api_helpers.py` | Shared glue helper | Runs inline SQL + calls calculations.py; used by dashboard and product list |
| `backend/services/forecast_service.py` | Forecast business logic | Assembles full forecast payload, trend detection, critical product filter |
| `backend/repositories/forecast_repository.py` | Forecast DB queries | Rolling window sales aggregation (3d/7d/30d + per-day) |
| `backend/services/analytics_service.py` | Profit analytics orchestration | Computes `profit_margin_pct` |
| `backend/repositories/analytics_repository.py` | Profit DB queries | Revenue/cost/profit SQL, monthly breakdown, top products |
| `backend/routes/dashboard_routes.py` | `GET /dashboard` handler | Assembles summary, trend, stock distribution payload |
| `backend/services/product_service.py` | Product CRUD logic | Pagination, validation, stock replenishment |
| `backend/repositories/product_repository.py` | Product DB queries | CRUD, paginated list, stock add/set |
| `backend/services/sales_service.py` | Sales logic | Stock deduction, 7-day trend, total calc |
| `backend/repositories/sales_repository.py` | Sales DB queries | Insert sale, trend queries |
| `backend/services/purchase_service.py` | PO business logic | Status transitions, delivery → stock update |
| `backend/repositories/purchase_repository.py` | PO DB queries | PO CRUD, delivery stock increment |
| `backend/services/supplier_service.py` | Supplier CRUD logic | Validation, audit |
| `backend/repositories/supplier_repository.py` | Supplier DB queries | CRUD |
| `backend/websocket_manager.py` | Real-time push | `broadcast_event()` to all connected clients |
| `backend/audit.py` | Audit logging | `log_audit()` — writes to `audit_log` table |
| `backend/auth.py` | JWT auth | `get_current_user()` dependency for protected routes |
| `backend/app.py` | App wiring | Mounts all routers, registers `/ws` |
| `backend/schema.sql` | DB schema | All table DDL + indexes |
| `backend/csv_upload.py` | CSV import | Parses CSV, bulk inserts products |

---

## ✅ 9. Key Design Rules (from Section 13 of README)

> [!IMPORTANT]
> **All business formulas must remain server-side.** The frontend never re-calculates reorder status, forecast, or profit — it only **displays** what the backend returns.

> [!TIP]
> When adding new dashboard fields, **add optional fields only** — never remove or rename existing fields to preserve API backward compatibility for old frontend versions.

> [!NOTE]
> The legacy field `reorder_level` is still returned alongside the new forecast-driven fields (`forecast_daily`, `safety_stock`, `reorder_point`, `days_of_inventory`) so older frontends don't break.

