-- Stress-test dataset generator for Inventory Management System
-- Safe: does not drop or alter schema. Only truncates and inserts data.
-- Target sizes:
-- suppliers: 100
-- products: 2000
-- sales: 50000
-- purchase_orders: 500
-- purchase_items: 2000

BEGIN;

-- STEP 1: CLEAN DATABASE SAFELY (respecting FK dependencies)
TRUNCATE TABLE purchase_items RESTART IDENTITY CASCADE;
TRUNCATE TABLE purchase_orders RESTART IDENTITY CASCADE;
TRUNCATE TABLE sales RESTART IDENTITY CASCADE;
TRUNCATE TABLE products RESTART IDENTITY CASCADE;
TRUNCATE TABLE suppliers RESTART IDENTITY CASCADE;
TRUNCATE TABLE audit_log RESTART IDENTITY CASCADE;

-- STEP 2: GENERATE SUPPLIERS (100)
INSERT INTO suppliers (name, phone, email, address)
SELECT
    'Supplier ' || gs AS name,
    '9' || LPAD((FLOOR(RANDOM() * 1000000000))::TEXT, 9, '0') AS phone,
    'supplier' || gs || '@example.com' AS email,
    'Warehouse Zone ' || ((gs - 1) % 20 + 1) || ', City ' || ((gs - 1) % 10 + 1) AS address
FROM generate_series(1, 100) AS gs;

-- STEP 3: GENERATE PRODUCTS (2000)
WITH base_products AS (
    SELECT
        gs,
        ROUND((5 + RANDOM() * 95)::NUMERIC, 2) AS cost_price
    FROM generate_series(1, 2000) AS gs
)
INSERT INTO products (
    name,
    stock,
    min_stock,
    lead_time,
    supplier_id,
    cost_price,
    selling_price
)
SELECT
    'Product ' || bp.gs,
    (50 + FLOOR(RANDOM() * 451))::INT,                 -- 50..500
    (20 + FLOOR(RANDOM() * 61))::INT,                  -- 20..80
    (2 + FLOOR(RANDOM() * 9))::INT,                    -- 2..10
    (1 + FLOOR(RANDOM() * 100))::INT,                  -- existing supplier
    bp.cost_price,
    ROUND((bp.cost_price * (1.10 + RANDOM() * 0.50))::NUMERIC, 2)  -- margin 10%..60%
FROM base_products bp;

-- STEP 4: GENERATE SALES HISTORY (50000)
INSERT INTO sales (product_id, quantity, sale_date)
SELECT
    (1 + FLOOR(RANDOM() * 2000))::INT,
    (1 + FLOOR(RANDOM() * 10))::INT,                  -- 1..10
    (CURRENT_DATE - (FLOOR(RANDOM() * 30))::INT)      -- last 30 days
FROM generate_series(1, 50000);

-- STEP 5: GENERATE PURCHASE ORDERS (500)
INSERT INTO purchase_orders (supplier_id, status, created_at)
SELECT
    (1 + FLOOR(RANDOM() * 100))::INT,
    CASE
        WHEN RANDOM() < 0.35 THEN 'DELIVERED'
        ELSE 'PENDING'
    END,
    CURRENT_TIMESTAMP - ((FLOOR(RANDOM() * 60 * 24 * 60))::TEXT || ' minutes')::INTERVAL
FROM generate_series(1, 500);

-- STEP 6: GENERATE PURCHASE ITEMS (2000)
WITH sampled_products AS (
    SELECT (1 + FLOOR(RANDOM() * 2000))::INT AS product_id
    FROM generate_series(1, 2000)
)
INSERT INTO purchase_items (order_id, product_id, quantity, cost_price)
SELECT
    (1 + FLOOR(RANDOM() * 500))::INT AS order_id,
    sp.product_id,
    (10 + FLOOR(RANDOM() * 91))::INT AS quantity,      -- 10..100
    p.cost_price
FROM sampled_products sp
JOIN products p ON p.id = sp.product_id;

-- STEP 7: OPTIONAL STOCK UPDATE FOR DELIVERED ORDERS
WITH delivered_totals AS (
    SELECT
        pi.product_id,
        SUM(pi.quantity)::INT AS qty_to_add
    FROM purchase_items pi
    JOIN purchase_orders po ON po.id = pi.order_id
    WHERE po.status = 'DELIVERED'
    GROUP BY pi.product_id
)
UPDATE products pr
SET stock = pr.stock + dt.qty_to_add
FROM delivered_totals dt
WHERE pr.id = dt.product_id;

COMMIT;

-- STEP 8: VALIDATION CHECKS
SELECT COUNT(*) AS suppliers_count FROM suppliers;
SELECT COUNT(*) AS products_count FROM products;
SELECT COUNT(*) AS sales_count FROM sales;
SELECT COUNT(*) AS purchase_orders_count FROM purchase_orders;
SELECT COUNT(*) AS purchase_items_count FROM purchase_items;

-- Extra FK integrity checks (should all be 0)
SELECT COUNT(*) AS orphan_products_supplier_fk
FROM products p
LEFT JOIN suppliers s ON s.id = p.supplier_id
WHERE p.supplier_id IS NOT NULL AND s.id IS NULL;

SELECT COUNT(*) AS orphan_sales_product_fk
FROM sales sa
LEFT JOIN products p ON p.id = sa.product_id
WHERE p.id IS NULL;

SELECT COUNT(*) AS orphan_po_supplier_fk
FROM purchase_orders po
LEFT JOIN suppliers s ON s.id = po.supplier_id
WHERE s.id IS NULL;

SELECT COUNT(*) AS orphan_pi_order_fk
FROM purchase_items pi
LEFT JOIN purchase_orders po ON po.id = pi.order_id
WHERE po.id IS NULL;

SELECT COUNT(*) AS orphan_pi_product_fk
FROM purchase_items pi
LEFT JOIN products p ON p.id = pi.product_id
WHERE p.id IS NULL;
