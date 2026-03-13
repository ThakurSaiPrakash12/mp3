-- Inventory Management System Database Schema
-- Safe, idempotent migration-style setup script.

-- Core tables
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 0,
    lead_time INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    sale_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Supplier management
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Purchase workflow
CREATE TABLE IF NOT EXISTS purchase_orders (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    cost_price NUMERIC(12, 2) NOT NULL CHECK (cost_price >= 0)
);

-- Safe product extensions
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES suppliers(id),
    ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS selling_price NUMERIC(12, 2);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sales_product_id ON sales(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_product_date ON sales(product_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_audit_table_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at ON purchase_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_purchase_items_order_id ON purchase_items(order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product_id ON purchase_items(product_id);

-- Trigger function to keep products.updated_at fresh
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'update_products_updated_at'
    ) THEN
        CREATE TRIGGER update_products_updated_at
        BEFORE UPDATE ON products
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;