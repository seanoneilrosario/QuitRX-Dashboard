"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { getOrderBatch } from "@/app/dashboard/actions";
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
  page,
  initialData,
  initialError,
}: {
  query: string;
  page: number;
  initialData: Awaited<ReturnType<typeof getOrderBatch>>;
  initialError?: string;
}) {
    const PAGE_SIZE = 50;
    const PAGES_PER_BATCH = 10;

    const [currentPage, setCurrentPage] = useState(page);
    const [isPending, startTransition] = useTransition();

    const batch = Math.floor(
      (currentPage - 1) / PAGES_PER_BATCH,
    );

    const initialBatch = Math.floor(
      (page - 1) / PAGES_PER_BATCH,
    );

    const queryClient = useQueryClient();

    const ordersQuery = useQuery({
      queryKey: ["orders", { query, batch }],

      queryFn: async () => {
        console.log(
          "🟣 TANSTACK QUERY FN RUNNING: ORDERS",
          {
            query,
            batch,
          },
        );

        return getOrderBatch(query, batch);
      },

      initialData:
        batch === initialBatch
          ? initialData
          : undefined,

      placeholderData: keepPreviousData,

      staleTime: 30_000,
    });

    const isLoadingBatch =
      ordersQuery.isFetching &&
      ordersQuery.isPlaceholderData;

    useEffect(() => {
      setCurrentPage(1);
    }, [query]);

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

            queryClient.setQueriesData<Awaited<ReturnType<typeof getOrderBatch>>>(
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

  const orderData =
    ordersQuery.data ?? initialData;

  const filtered = orderData.data.filter(
    (item) =>
      !query ||
      JSON.stringify(item)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );

  const total = orderData.total;
  const totalPages = orderData.totalPages;

  const pageWithinBatch =
    (currentPage - 1) % PAGES_PER_BATCH;

  const startIndex =
    pageWithinBatch * PAGE_SIZE;

  const visibleOrders = filtered.slice(
    startIndex,
    startIndex + PAGE_SIZE,
  );

  const error =
    ordersQuery.error instanceof Error
      ? ordersQuery.error.message
      : initialError;

    const goToPage = (nextPage: number) => {
    startTransition(() => {
        setCurrentPage(nextPage);
    });
};

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

      {isPending || isLoadingBatch ? (
        <div
          className={styles.customerLoading}
          aria-live="polite"
          aria-busy="true"
        >
          <div className={styles.customerSpinner} />
          <span>Loading orders…</span>
        </div>
      ) : (
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
              {visibleOrders.map((item, index) => {
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
      )}

      {totalPages > 1 ? (
        <nav
          className={styles.pagination}
          aria-label="Pagination"
          aria-busy={isPending || isLoadingBatch}
        >
          <span>
            Showing page {currentPage} of {totalPages} ·{" "}
            {total.toLocaleString()} records
          </span>

          <div>
            {currentPage > 1 ? (
              <Link
                href="#"
                onClick={(event) => {
                  event.preventDefault();

                  if (!isPending && !isLoadingBatch) {
                    goToPage(currentPage - 1);
                  }
                }}
                aria-disabled={isPending || isLoadingBatch}
              >
                Previous
              </Link>
            ) : (
              <span>Previous</span>
            )}

            {currentPage < totalPages ? (
              <Link
                href="#"
                onClick={(event) => {
                  event.preventDefault();

                  if (!isPending && !isLoadingBatch) {
                    goToPage(currentPage + 1);
                  }
                }}
                aria-disabled={isPending || isLoadingBatch}
              >
                Next
              </Link>
            ) : (
              <span>Next</span>
            )}
          </div>
        </nav>
      ) : null}
    </>
  );
}