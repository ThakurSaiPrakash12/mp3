# Inventory Management System

Comprehensive documentation for the full-stack Inventory Management System.

This README explains the project from setup to runtime behavior, including all formulas used for stock, reorder status, dashboard analytics, forecasting, and profit analysis.

## 1) Tech Stack

### Backend
- FastAPI
- PostgreSQL
- psycopg2
- WebSockets (native FastAPI WebSocket endpoint)

### Frontend
- React + TypeScript
- Vite
- TanStack Query
- Recharts
- Tailwind + UI components

## 2) Runtime Architecture

1. Frontend calls REST APIs hosted by FastAPI (default `http://127.0.0.1:5000`).
2. Backend reads/writes PostgreSQL and computes analytics/reorder/forecast data server-side.
3. Backend pushes real-time events to connected clients via `/ws`.
4. Frontend listens for events and refreshes relevant views.

Core app wiring:
- `backend/app.py`
  - includes `routes.py` and `business_routes.py`
  - exposes WebSocket endpoint `/ws`

## 3) Database Tables

- `suppliers`
- `products`
- `sales`
- `purchase_orders`
- `purchase_items`
- `audit_log`

Foreign key model:
- `products.supplier_id -> suppliers.id`
- `sales.product_id -> products.id`
- `purchase_orders.supplier_id -> suppliers.id`
- `purchase_items.order_id -> purchase_orders.id`
- `purchase_items.product_id -> products.id`

## 4) API Surface

### Core routes (`backend/routes.py`)
- `POST /login`
- `GET /dashboard`
- `GET /products`
- `POST /products`
- `GET /sales`
- `POST /sales`
- `GET /reorder-check/{product_id}`
- `POST /products/{product_id}/reorder-reset`
- `POST /products/upload-csv`
- `GET /forecast/{product_id}`
- `GET /forecast`
- `GET /forecast/critical/alerts`
- `GET /forecast/{product_id}/history`

### Business routes (`backend/business_routes.py`)
- Suppliers
  - `GET /suppliers`
  - `POST /suppliers`
  - `PUT /suppliers/{supplier_id}`
  - `DELETE /suppliers/{supplier_id}`
- Analytics
  - `GET /analytics/profit`
- Purchase Orders
  - `GET /purchase-orders`
  - `POST /purchase-orders`
  - `GET /purchase-orders/{order_id}`
  - `PUT /purchase-orders/{order_id}/status`

## 5) End-to-End Business Flows

### 5.1 Login and Authorization
1. User posts credentials to `POST /login`.
2. Backend verifies username/password and returns JWT.
3. Frontend stores token and sends `Authorization: Bearer <token>` on protected calls.

### 5.2 Product Lifecycle
1. Admin creates product via `POST /products`.
2. Product appears in `GET /products` with backend-calculated reorder fields.
3. Product creation triggers WebSocket `product_added` event.

### 5.3 Sale Lifecycle
1. Admin records sale via `POST /sales`.
2. Backend validates stock availability.
3. Backend inserts `sales` record and decrements `products.stock` in one transaction.
4. Backend emits WebSocket events (`sale_recorded`, `stock_updated`, `forecast_updated`).
5. Dashboard/reorder/forecast screens refresh via websocket callbacks.

### 5.4 Purchase Order Lifecycle
1. Admin creates PO (`POST /purchase-orders`) with supplier and items.
2. PO starts as `PENDING`.
3. Admin marks PO as `DELIVERED` using `PUT /purchase-orders/{order_id}/status`.
4. Backend increments product stock by delivered quantities.
5. Backend may update product cost price from purchase item cost price.
6. Backend emits `stock_updated` event for UI refresh.

## 6) Formulas and Analytics Logic

## 6.1 Reorder Status Formula (forecast-driven production logic)

Reorder status is now computed from forecasted daily demand, safety stock, and reorder point.

### Step A: Forecast daily demand

Primary model (recent weighted demand):

$$
forecast\_daily = 0.5\cdot sales\_today + 0.3\cdot sales\_yesterday + 0.2\cdot sales\_two\_days\_ago
$$

Fallback model when recent signal is unavailable:

$$
forecast\_daily = avg\_daily\_sales\_7d = \frac{\sum quantity\_over\_last\_7\_days}{7}
$$

### Step B: Safety stock

$$
safety\_stock = 2\cdot forecast\_daily
$$

### Step C: Reorder point

$$
reorder\_point = (forecast\_daily\cdot lead\_time) + safety\_stock
$$

### Step D: Inventory coverage

$$
days\_of\_inventory = \frac{stock}{forecast\_daily}
$$

If `forecast_daily = 0`, inventory coverage is reported as `null`.

### Step E: Status classification

Given `stock`, `min_stock`, and `reorder_point`:

1. `OUT_OF_STOCK` if `stock == 0` (reorder required = true)
2. `CRITICAL` if `stock <= reorder_point` (reorder required = true)
3. `LOW` if `stock < min_stock` but not critical (reorder required = false)
4. `OK` otherwise

Compatibility note:
- legacy field `reorder_level` is still returned for existing clients.
- new fields are additive: `forecast_daily`, `safety_stock`, `reorder_point`, `days_of_inventory`.

## 6.2 Dashboard Metrics Formula

Endpoint: `GET /dashboard`

### Summary
- `total_products`:

$$
\text{COUNT(products)}
$$

- `total_sales_last_7_days`:

$$
\sum \text{sales.quantity where sale\_date >= current\_date - 7 days}
$$

- `low_stock_items`:

$$
\text{COUNT(products where stock < min\_stock)}
$$

- `reorder_required_items`:

$$
\text{COUNT(products where reorder\_required = true per reorder logic)}
$$

### Sales trend
7-day time series (date + daily total quantity), filled day-by-day from DB aggregate.

### Stock distribution
- `well_stocked = total_products - reorder_required_items`
- `reorder_required = reorder_required_items`

### Stock lists in payload
- `stock_levels`: first 10 products snapshot for compact display
- `reorder_attention`: global list of reorder-required products (for accurate action card)
- `stock_coverage_summary`: optional dashboard-level coverage message and recommendation

## 6.3 Forecast Engine Formula

Forecast endpoints are served by `backend/forecast_engine.py`.

### Step A: rolling windows (supporting metrics)

$$
\text{avg\_3d} = \frac{\text{sales\_3d}}{3},\quad
\text{avg\_7d} = \frac{\text{sales\_7d}}{7},\quad
\text{avg\_30d} = \frac{\text{sales\_30d}}{30}
$$

### Step B: weighted recent-demand forecast

$$
forecast\_daily = 0.5\cdot sales\_today + 0.3\cdot sales\_yesterday + 0.2\cdot sales\_two\_days\_ago
$$

Fallback:

$$
forecast\_daily = avg\_7d \; \text{when recent 3-day signal is unavailable}
$$

### Step C: trend signal (informational)
- Trend is still exposed for UI context (`increasing`, `stable`, `decreasing`).
- Trend does not override the base forecast formula above.

### Step D: safety stock and forecast reorder point

$$
\text{safety\_stock} = 2 \cdot \text{forecast\_daily}
$$

$$
\text{forecast\_reorder\_point} = (\text{forecast\_daily} \cdot \text{lead\_time}) + \text{safety\_stock}
$$

### Step E: forecast projections

$$
\text{forecast\_next\_7\_days} = 7\cdot\text{forecast\_daily}
$$

$$
\text{forecast\_next\_30\_days} = 30\cdot\text{forecast\_daily}
$$

Note:
- Forecast and reorder APIs use the same forecast-driven reorder foundations.

## 6.4 Profit Analytics Formula

Endpoint: `GET /analytics/profit`

Using joined `sales` + `products`:

$$
\text{revenue} = \sum (\text{selling\_price} \cdot \text{quantity})
$$

$$
\text{cost} = \sum (\text{cost\_price} \cdot \text{quantity})
$$

$$
\text{profit} = \sum ((\text{selling\_price}-\text{cost\_price}) \cdot \text{quantity})
$$

$$
\text{profit\_margin\_pct} = \begin{cases}
\frac{\text{profit}}{\text{revenue}}\cdot100, & \text{if revenue} > 0\\
0, & \text{otherwise}
\end{cases}
$$

Also provided:
- month-wise revenue/cost/profit
- top profitable products (ranked by profit)

## 7) Pagination and Filtering

### Products (`GET /products`)
- query params: `page`, `limit`, `search`
- response includes pagination metadata (`total`, `pages`, current page)

### Sales (`GET /sales`)
- query params: `page`, `limit`, `product_id`, `start_date`, `end_date`
- response includes pagination metadata and applied filters

## 8) Real-Time Events

WebSocket endpoint: `/ws`

Events currently used by frontend pages:
- `connected`
- `product_added`
- `sale_recorded`
- `stock_updated`
- `products_imported`
- `forecast_updated`
- `pong` (heartbeat response)

## 9) Audit Logging

`audit_log` captures important write actions with metadata:
- action
- table_name
- record_id
- details
- ip_address
- created_at

Logged actions include product inserts, sales records, supplier CRUD, purchase order transitions, etc.

## 10) Setup and Run

### Backend

1. Create and activate venv
2. Install dependencies:

```bash
pip install -r backend/requirements.txt
```

3. Configure DB env in `backend/.env`:
- `DB_HOST`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_PORT`
- `JWT_SECRET_KEY`

4. Initialize schema:

```bash
psql -U postgres -d inventory_db -f backend/schema.sql
```

5. Run backend:

```bash
cd backend
python app.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## 11) Stress-Test Dataset

Scripts:
- SQL seed script: `backend/scripts/stress_test_seed.sql`
- Python generator: `backend/scripts/generate_stress_data.py`

Target dataset:
- suppliers: 100
- products: 2000
- sales: 50000
- purchase_orders: 500
- purchase_items: 2000

The generator truncates data safely (no schema changes), seeds realistic data, updates stock for delivered purchase orders, and validates FK integrity.

## 12) How to Validate System Correctness After Seeding

1. Row count checks:

```sql
SELECT COUNT(*) FROM suppliers;
SELECT COUNT(*) FROM products;
SELECT COUNT(*) FROM sales;
SELECT COUNT(*) FROM purchase_orders;
SELECT COUNT(*) FROM purchase_items;
```

2. FK integrity checks:

```sql
SELECT COUNT(*) FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.supplier_id IS NOT NULL AND s.id IS NULL;
SELECT COUNT(*) FROM sales sa LEFT JOIN products p ON p.id = sa.product_id WHERE p.id IS NULL;
SELECT COUNT(*) FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id WHERE s.id IS NULL;
SELECT COUNT(*) FROM purchase_items pi LEFT JOIN purchase_orders po ON po.id = pi.order_id WHERE po.id IS NULL;
SELECT COUNT(*) FROM purchase_items pi LEFT JOIN products p ON p.id = pi.product_id WHERE p.id IS NULL;
```

3. Reorder sanity checks:
- compare `summary.reorder_required_items` on dashboard with count of products where reorder status is CRITICAL/OUT_OF_STOCK.

4. Forecast sanity checks:
- call `/forecast/{product_id}` and verify weighted components (`avg_3d`, `avg_7d`, `avg_30d`) are coherent with recent sales.

## 13) Notes for Contributors

- Keep business formulas server-side as source of truth.
- If formulas change, update both implementation and this README section "Formulas and Analytics Logic".
- Preserve API backward compatibility when adding dashboard fields; add optional fields instead of removing existing ones.
