import Link from "next/link";

import style from "../components/dashboard.module.css";

import { getOrders } from "../../lib/quitmed-retail-admin/orders/client";
import { retailRequest } from "../../lib/quitmed-retail-admin/collections/client";
import { auth } from "@/auth";

type RetailRecord = Record<string, unknown>;

function text(value: unknown, fallback = "—"): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return fallback;
}

function nested(
  value: RetailRecord,
  key: string,
): RetailRecord | undefined {
  const child = value[key];

  return child &&
    typeof child === "object" &&
    !Array.isArray(child)
    ? (child as RetailRecord)
    : undefined;
}

function money(value: unknown): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "—";
  }

  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(amount);
}

function availableStock(variant: RetailRecord): number {
  const inventory = Number(variant.inventory ?? 0);
  const allocated = Number(variant.allocatedInventory ?? 0);

  return Math.max(0, inventory - allocated);
}

function statusClass(value: unknown): string {
  const label = text(value, "").toUpperCase();

  if (/CANCELLED|COMPLETED|PAID|FULFILLED|ACTIVE/.test(label)) {
    return style.status;
  }

  return `${style.status} ${style.warning}`;
}

async function getPageData() {
  const [
    productsResponse,
    customersResponse,
    variantsResponse,
    ordersResponse,
  ] = await Promise.all([
    retailRequest<unknown>(
      "/products?page=1&limit=6",
      {
        method: "GET",
        cache: "no-store",
      },
    ),
    retailRequest<unknown>(
      "/customers?page=1&limit=1",
      {
        method: "GET",
        cache: "no-store",
      },
    ),
    retailRequest<unknown>(
      "/product-variants?page=1&limit=100",
      {
        method: "GET",
        cache: "no-store",
      },
    ),
    getOrders({
      page: 1,
      limit: 20,
      fields:
        "id,name,source,customerName,customerEmail,items,total,payment,fulfillment,date",
    }),
  ]);

  return {
    products: productsResponse,
    customers: customersResponse,
    variants: variantsResponse,
    orders: ordersResponse,
  };
}

function getPaginationTotal(payload: unknown): number {
  if (!payload || typeof payload !== "object") {
    return 0;
  }

  const record = payload as RetailRecord;
  const pagination = nested(record, "pagination");

  return Number(pagination?.total ?? 0) || 0;
}

function getRecords(payload: unknown): RetailRecord[] {
  if (Array.isArray(payload)) {
    return payload as RetailRecord[];
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as RetailRecord;

  for (const key of [
    "data",
    "items",
    "results",
    "products",
    "customers",
    "variants",
  ]) {
    const value = record[key];

    if (Array.isArray(value)) {
      return value as RetailRecord[];
    }
  }

  return [];
}

export default async function DashboardPage() {
  const session = await auth();
console.log(session)
  const adminEmail =
    session?.user?.name ?? "admin";

  const { products, customers, variants, orders } =
    await getPageData();

  const productTotal = getPaginationTotal(products);
  const customerTotal = getPaginationTotal(customers);

  const variantRecords = getRecords(variants);

  const productRecords = getRecords(products);

  const totalStock = variantRecords.reduce(
    (sum, variant) => sum + availableStock(variant),
    0,
  );

  const lowStockCount = variantRecords.filter(
    (variant) => availableStock(variant) <= 10,
  ).length;

  const totalSales = orders.data.reduce(
    (sum, order) => sum + Number(order.total ?? 0),
    0,
  );

  return (
    <div>
      <header className={style.pageHeader}>
        <div>
          <p className={style.eyebrow}>QUITRX OPERATIONS</p>

          <h1>Good morning, {adminEmail}</h1>

          <p>
            Here’s what’s happening across your store today.
          </p>
        </div>

        {/* <Link
          href="/dashboard/products/create"
          className={style.primary}
        >
          + Add product
        </Link> */}
      </header>

      <section className={style.metrics}>
        <article>
          <span>Total sales</span>
          <strong>{money(totalSales)}</strong>
          <small>Across loaded orders</small>
        </article>

        <article>
          <span>Orders</span>
          <strong>{orders.pagination.total}</strong>
          <small>Current API results</small>
        </article>

        <article>
          <span>Products</span>
          <strong>{productTotal.toLocaleString()}</strong>
          <small>Product records</small>
        </article>

        <article>
          <span>Customers</span>
          <strong>{customerTotal.toLocaleString()}</strong>
          <small>Customer records</small>
        </article>

        <article>
          <span>Units in stock</span>
          <strong>{totalStock.toLocaleString()}</strong>
          <small>
            {lowStockCount} low-stock variants
          </small>
        </article>
      </section>

      <div className={style.twoCols}>
        <section className={style.card}>
          <div className={style.cardTitle}>
            <div>
              <h2>Recent orders</h2>
              <p>Latest customer purchases</p>
            </div>

            <Link href="/dashboard/orders">
              View all
            </Link>
          </div>

          <div className={style.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {orders.data
                  .slice(0, 5)
                  .map((order, index) => (
                    <tr
                      key={
                        text(
                          order.id,
                          String(index),
                        )
                      }
                    >
                      <td>
                        <Link
                          href={`/dashboard/orders/view?id=${encodeURIComponent(
                            order.id,
                          )}`}
                        >
                          #{order.orderNumber}
                        </Link>
                      </td>

                      <td>
                        {order.customer?.email ?? "—"}
                      </td>

                      <td>
                        {money(order.total)}
                      </td>

                      <td>
                        <span
                          className={statusClass(
                            order.paymentStatus,
                          )}
                        >
                          {text(
                            order.paymentStatus,
                          ).replaceAll("_", " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={style.card}>
          <div className={style.cardTitle}>
            <div>
              <h2>Products</h2>
              <p>Latest products in your store</p>
            </div>

            <Link href="/dashboard/products">
              View all
            </Link>
          </div>

          <div className={style.stockList}>
            {productRecords
              .slice(0, 6)
              .map((product, index) => (
                <div
                  key={
                    text(
                      product.id,
                      String(index),
                    )
                  }
                >
                  <span>
                    <strong>
                      {text(product.name)}
                    </strong>

                    <small>
                      {text(product.slug)}
                    </small>
                  </span>

                  <b>
                    {text(product.status)}
                  </b>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}