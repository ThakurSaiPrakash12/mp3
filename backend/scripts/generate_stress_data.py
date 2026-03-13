import json
import random
from datetime import date, datetime, timedelta

import psycopg2
from psycopg2.extras import execute_values

from config import DB_CONFIG

SUPPLIERS = 100
PRODUCTS = 2000
SALES = 50000
PURCHASE_ORDERS = 500
PURCHASE_ITEMS = 2000


def rand_phone() -> str:
    return "9" + "".join(random.choices("0123456789", k=9))


def random_sale_date() -> date:
    return date.today() - timedelta(days=random.randint(0, 29))


def random_timestamp_last_days(days: int = 60) -> datetime:
    return datetime.now() - timedelta(minutes=random.randint(0, days * 24 * 60))


def main() -> None:
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = False

    try:
        with conn.cursor() as cur:
            # STEP 1: clean data safely
            cur.execute("TRUNCATE TABLE purchase_items RESTART IDENTITY CASCADE;")
            cur.execute("TRUNCATE TABLE purchase_orders RESTART IDENTITY CASCADE;")
            cur.execute("TRUNCATE TABLE sales RESTART IDENTITY CASCADE;")
            cur.execute("TRUNCATE TABLE products RESTART IDENTITY CASCADE;")
            cur.execute("TRUNCATE TABLE suppliers RESTART IDENTITY CASCADE;")
            cur.execute("TRUNCATE TABLE audit_log RESTART IDENTITY CASCADE;")

            # STEP 2: suppliers
            suppliers_rows = [
                (
                    f"Supplier {i}",
                    rand_phone(),
                    f"supplier{i}@example.com",
                    f"Warehouse Zone {(i - 1) % 20 + 1}, City {(i - 1) % 10 + 1}",
                )
                for i in range(1, SUPPLIERS + 1)
            ]
            execute_values(
                cur,
                """
                INSERT INTO suppliers (name, phone, email, address)
                VALUES %s
                """,
                suppliers_rows,
                page_size=1000,
            )

            # STEP 3: products
            products_rows = []
            for i in range(1, PRODUCTS + 1):
                cost = round(random.uniform(5, 100), 2)
                selling = round(cost * random.uniform(1.10, 1.60), 2)
                products_rows.append(
                    (
                        f"Product {i}",
                        random.randint(50, 500),
                        random.randint(20, 80),
                        random.randint(2, 10),
                        random.randint(1, SUPPLIERS),
                        cost,
                        selling,
                    )
                )
            execute_values(
                cur,
                """
                INSERT INTO products
                    (name, stock, min_stock, lead_time, supplier_id, cost_price, selling_price)
                VALUES %s
                """,
                products_rows,
                page_size=2000,
            )

            # STEP 4: sales
            sales_rows = [
                (
                    random.randint(1, PRODUCTS),
                    random.randint(1, 10),
                    random_sale_date(),
                )
                for _ in range(SALES)
            ]
            execute_values(
                cur,
                """
                INSERT INTO sales (product_id, quantity, sale_date)
                VALUES %s
                """,
                sales_rows,
                page_size=5000,
            )

            # STEP 5: purchase orders
            po_rows = [
                (
                    random.randint(1, SUPPLIERS),
                    "DELIVERED" if random.random() < 0.35 else "PENDING",
                    random_timestamp_last_days(60),
                )
                for _ in range(PURCHASE_ORDERS)
            ]
            execute_values(
                cur,
                """
                INSERT INTO purchase_orders (supplier_id, status, created_at)
                VALUES %s
                """,
                po_rows,
                page_size=1000,
            )

            # Load product cost map for purchase items
            cur.execute("SELECT id, cost_price FROM products")
            product_cost = {row[0]: row[1] for row in cur.fetchall()}

            # STEP 6: purchase items
            pi_rows = []
            for _ in range(PURCHASE_ITEMS):
                pid = random.randint(1, PRODUCTS)
                pi_rows.append(
                    (
                        random.randint(1, PURCHASE_ORDERS),
                        pid,
                        random.randint(10, 100),
                        product_cost[pid],
                    )
                )
            execute_values(
                cur,
                """
                INSERT INTO purchase_items (order_id, product_id, quantity, cost_price)
                VALUES %s
                """,
                pi_rows,
                page_size=2000,
            )

            # STEP 7: stock update for delivered orders
            cur.execute(
                """
                WITH delivered_totals AS (
                    SELECT pi.product_id, SUM(pi.quantity)::INT AS qty_to_add
                    FROM purchase_items pi
                    JOIN purchase_orders po ON po.id = pi.order_id
                    WHERE po.status = 'DELIVERED'
                    GROUP BY pi.product_id
                )
                UPDATE products pr
                SET stock = pr.stock + dt.qty_to_add
                FROM delivered_totals dt
                WHERE pr.id = dt.product_id
                """
            )

            conn.commit()

            # STEP 8: validation checks
            checks = {}
            for table in ["suppliers", "products", "sales", "purchase_orders", "purchase_items"]:
                cur.execute(f"SELECT COUNT(*) FROM {table}")
                checks[table] = cur.fetchone()[0]

            # FK validity checks
            cur.execute(
                """
                SELECT COUNT(*)
                FROM products p
                LEFT JOIN suppliers s ON s.id = p.supplier_id
                WHERE p.supplier_id IS NOT NULL AND s.id IS NULL
                """
            )
            checks["orphan_products_supplier_fk"] = cur.fetchone()[0]

            cur.execute(
                """
                SELECT COUNT(*)
                FROM sales sa
                LEFT JOIN products p ON p.id = sa.product_id
                WHERE p.id IS NULL
                """
            )
            checks["orphan_sales_product_fk"] = cur.fetchone()[0]

            cur.execute(
                """
                SELECT COUNT(*)
                FROM purchase_orders po
                LEFT JOIN suppliers s ON s.id = po.supplier_id
                WHERE s.id IS NULL
                """
            )
            checks["orphan_po_supplier_fk"] = cur.fetchone()[0]

            cur.execute(
                """
                SELECT COUNT(*)
                FROM purchase_items pi
                LEFT JOIN purchase_orders po ON po.id = pi.order_id
                WHERE po.id IS NULL
                """
            )
            checks["orphan_pi_order_fk"] = cur.fetchone()[0]

            cur.execute(
                """
                SELECT COUNT(*)
                FROM purchase_items pi
                LEFT JOIN products p ON p.id = pi.product_id
                WHERE p.id IS NULL
                """
            )
            checks["orphan_pi_product_fk"] = cur.fetchone()[0]

            print(json.dumps(checks, indent=2))

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
