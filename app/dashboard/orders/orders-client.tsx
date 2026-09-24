"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrders } from "@/app/dashboard/actions";
import { socket } from "@/src/realtime/socket";
import styles from "../[[...section]]/dashboard.module.css";

type Order = Record<string, unknown>;

function text(value: unknown, fallback = "—") {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
}

function money(value: unknown) {
  const amount = Number(value);

  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "AUD",
      }).format(amount)
    : "—";
}

function nested(item: Order, key: string) {
  const value = item[key];

  return value && typeof value === "object"
    ? (value as Order)
    : undefined;
}

function orderItems(order: Order) {
  return Array.isArray(order.items)
    ? (order.items as Order[])
    : Array.isArray(order.lineItems)
      ? (order.lineItems as Order[])
      : [];
}

function customerName(order: Order) {
  const customer = nested(order, "customer");

  const firstName =
    customer?.firstName ??
    order.billingFirstName ??
    order.shippingFirstName;

  const lastName =
    customer?.lastName ??
    order.billingLastName ??
    order.shippingLastName;

  return (
    [text(firstName, ""), text(lastName, "")]
      .filter(Boolean)
      .join(" ") ||
    text(order.customerEmail ?? customer?.email)
  );
}

function orderDate(value: unknown) {
  const date = new Date(text(value, ""));

  return Number.isNaN(date.getTime())
    ? text(value)
    : new Intl.DateTimeFormat("en-AU", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function Status({ value }: { value: unknown }) {
  const label = text(value, "ACTIVE");

  return (
    <span
      className={`${styles.status} ${
        /draft|pending|low/i.test(label) ? styles.warning : ""
      }`}
    >
      {label.replaceAll("_", " ")}
    </span>
  );
}

export default function OrdersClient({
  query,
  initialData,
  initialError,
}: {
  query: string;
  initialData: Awaited<ReturnType<typeof getOrders>>;
  initialError?: string;
}) {
  const ordersQuery = useQuery({
    queryKey: ["orders", { query }],
    queryFn: () => getOrders(),
    initialData,
    });

    const queryClient = useQueryClient();

    useEffect(() => {
    const cachedOrders = queryClient.getQueryData([
        "orders",
        { query },
    ]);

    console.log("ORDERS CACHE:", cachedOrders);
    }, [query, queryClient]);

    useEffect(() => {

        const handleOrderUpdated = (data: unknown) => {
            console.log("Orders cache update:", data);

            if (!data || typeof data !== "object") return;

            const payload = data as {
            order?: Record<string, unknown>;
            };

            const updatedOrder = payload.order;

            if (!updatedOrder) return;

            const orderId = updatedOrder.id;

            if (typeof orderId !== "string") return;

            queryClient.setQueriesData<Awaited<ReturnType<typeof getOrders>>>(
            { queryKey: ["orders"] },
            (current) => {
                if (!current) return current;

                const exists = current.data.some(
                (order) => order.id === orderId,
                );

                if (!exists) return current;

                return {
                ...current,
                data: current.data.map((order) =>
                    order.id === orderId ? updatedOrder : order,
                ),
                };
            },
            );
        };

        socket.on("order.updated", handleOrderUpdated);

        return () => {
            socket.off("order.updated", handleOrderUpdated);
        };
    }, [queryClient]);

  const filtered = ordersQuery.data.data.filter(
    (item) =>
      !query ||
      JSON.stringify(item)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );

  const error =
    ordersQuery.error instanceof Error
      ? ordersQuery.error.message
      : initialError;

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>QuitRX operations</p>
          <h1>Orders</h1>
          <p>
            Review purchases, customers, items and fulfilment state.
          </p>
        </div>

        <Link
          className={styles.primary}
          href="/dashboard/orders/create"
        >
          + Create order
        </Link>
      </header>

      {error ? (
        <div className={styles.notice}>
          <strong>API connection needed</strong>
          <span>{error}</span>
        </div>
      ) : null}

      <div className={styles.toolbar}>
        <form className={styles.search}>
          <span>⌕</span>
          <input
            name="q"
            aria-label="Search"
            placeholder="Search order, customer or item"
            defaultValue={query}
          />
          <button type="submit">Search</button>
        </form>
      </div>

      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              {[
                "Order",
                "Customer",
                "Items",
                "Date",
                "Price",
                "Status",
                "",
              ].map((head) => (
                <th key={head}>{head}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filtered.map((item, index) => {
              const lines = orderItems(item);

              const quantity = lines.reduce(
                (sum, line) =>
                  sum + Number(line.quantity ?? 1),
                0,
              );

              return (
                <tr key={text(item.id, String(index))}>
                  <td>
                    <strong>
                      #{text(item.orderNumber ?? item.id)}
                    </strong>
                  </td>

                  <td>
                    <strong>{customerName(item)}</strong>
                    <small>
                      {text(
                        item.customerEmail ??
                          nested(item, "customer")?.email,
                        "",
                      )}
                    </small>
                  </td>

                  <td>
                    <strong>
                      {text(
                        lines[0]?.productName ?? lines[0]?.name,
                        "No items",
                      )}
                    </strong>

                    <small>
                      {lines.length
                        ? `${quantity} ${
                            quantity === 1 ? "item" : "items"
                          }${
                            lines.length > 1
                              ? ` across ${lines.length} products`
                              : ""
                          }`
                        : ""}
                    </small>
                  </td>

                  <td>{orderDate(item.createdAt)}</td>

                  <td>
                    {money(item.total ?? item.totalPrice)}
                  </td>

                  <td>
                    <Status value={item.status} />
                  </td>

                  <td>
                    <Link
                      href={`/dashboard/orders/details?id=${text(
                        item.id,
                      )}`}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}