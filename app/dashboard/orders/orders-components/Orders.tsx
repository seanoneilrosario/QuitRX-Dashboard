import Link from "next/link";

import type {
  GetOrdersParams,
  OrderListItem,
} from "../../../../lib/quitmed-retail-admin/orders/client";

import style from "../../../components/dashboard.module.css";

function displayValue(value: unknown, fallback = "—") {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).trim();

  return text || fallback;
}

function displayMoney(
  value: string | number,
  currency = "AUD",
) {
  const amount = Number(value);

  if (Number.isNaN(amount)) {
    return "—";
  }

  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
  }).format(amount);
}

function displayDate(value?: string) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function customerName(order: OrderListItem) {
  const firstName = order.customer?.firstName ?? "";
  const lastName = order.customer?.lastName ?? "";

  const name = `${firstName} ${lastName}`.trim();

  return name || "Guest customer";
}

function statusLabel(value?: string) {
  if (!value) {
    return "—";
  }

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function buildQuery(
  params: GetOrdersParams,
  page: number,
) {
  const query = new URLSearchParams();

  query.set("page", String(page));

  if (params.search) {
    query.set("search", params.search);
  }

  if (params.status) {
    query.set("status", params.status);
  }

  if (params.paymentStatus) {
    query.set("paymentStatus", params.paymentStatus);
  }

  if (params.fulfillmentStatus) {
    query.set(
      "fulfillmentStatus",
      params.fulfillmentStatus,
    );
  }

  if (params.source) {
    query.set("source", params.source);
  }

  return query.toString();
}

type OrdersProps = {
  orders: OrderListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  query: GetOrdersParams;
  error?: string;
};

export default function Orders({
  orders,
  pagination,
  query,
  error,
}: OrdersProps) {
  const previousQuery =
    pagination.page > 1
      ? buildQuery(query, pagination.page - 1)
      : null;

  const nextQuery =
    pagination.page < pagination.totalPages
      ? buildQuery(query, pagination.page + 1)
      : null;

  return (
    <>
      <div className={style.pageHeader}>
        <div>
          <div className={style.eyebrow}>
            QUITRX OPERATIONS
          </div>

          <h1>Orders</h1>

          <p>
            View and manage customer orders, payments and
            fulfillment.
          </p>
        </div>

        <div>
          <Link
            className={style.primary}
            href="/dashboard/orders/create"
          >
            Create order
          </Link>
        </div>
      </div>

      {error && (
        <section className={style.card}>
          <p>{error}</p>
        </section>
      )}

        <section className={style.ordersFilterBar}>
            <form method="GET" className={style.ordersFilterForm}>
                <div className={style.ordersSearchControl}>
                <span
                    className={style.ordersSearchIcon}
                    aria-hidden="true"
                >
                    ⌕
                </span>

                <input
                    type="search"
                    name="search"
                    defaultValue={query.search ?? ""}
                    placeholder="Search order number"
                />
                </div>

                <select
                className={style.ordersFilterSelect}
                name="status"
                defaultValue={query.status ?? ""}
                aria-label="Order status"
                >
                <option value="">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="PROCESSING">Processing</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="REFUNDED">Refunded</option>
                </select>

                <select
                className={style.ordersFilterSelect}
                name="paymentStatus"
                defaultValue={query.paymentStatus ?? ""}
                aria-label="Payment status"
                >
                <option value="">All payments</option>
                <option value="PENDING">Pending</option>
                <option value="PAID">Paid</option>
                <option value="PARTIALLY_PAID">
                    Partially paid
                </option>
                <option value="FAILED">Failed</option>
                <option value="REFUNDED">Refunded</option>
                </select>

                <select
                className={style.ordersFilterSelect}
                name="fulfillmentStatus"
                defaultValue={query.fulfillmentStatus ?? ""}
                aria-label="Fulfillment status"
                >
                <option value="">All fulfillment</option>
                <option value="UNFULFILLED">
                    Unfulfilled
                </option>
                <option value="PARTIALLY_FULFILLED">
                    Partially fulfilled
                </option>
                <option value="FULFILLED">Fulfilled</option>
                <option value="CANCELLED">Cancelled</option>
                </select>

                <select
                className={style.ordersFilterSelect}
                name="source"
                defaultValue={query.source ?? ""}
                aria-label="Order source"
                >
                <option value="">All sources</option>
                <option value="NATIVE">Native</option>
                <option value="SHOPIFY">Shopify</option>
                </select>

                <button
                type="submit"
                className={style.ordersFilterButton}
                >
                Apply
                </button>
            </form>
        </section>

      <section className={style.card}>
        <div className={style.pageHeader}>
          <div>
            <div className={style.eyebrow}>
              ORDER LIST
            </div>

            <h2>{pagination.total} orders</h2>
          </div>
        </div>

        {orders.length === 0 ? (
          <p>No orders found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>
                    Order
                  </th>
                  <th style={{ textAlign: "left" }}>
                    Customer
                  </th>
                  <th style={{ textAlign: "left" }}>
                    Items
                  </th>
                  <th style={{ textAlign: "left" }}>
                    Total
                  </th>
                  <th style={{ textAlign: "left" }}>
                    Payment
                  </th>
                  <th style={{ textAlign: "left" }}>
                    Fulfillment
                  </th>
                  <th style={{ textAlign: "left" }}>
                    Date
                  </th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>
                        {displayValue(order.orderNumber)}
                      </strong>

                      <small>
                        {displayValue(order.source)}
                      </small>
                    </td>

                    <td>
                      <strong>
                        {customerName(order)}
                      </strong>

                      <small>
                        {displayValue(
                          order.customer?.email,
                        )}
                      </small>
                    </td>

                    <td>
                      {(order.items ?? []).reduce(
                        (total, item) => total + item.quantity,
                        0,
                        )}
                    </td>

                    <td>
                      {displayMoney(order.total)}
                    </td>

                    <td>
                      {statusLabel(
                        order.paymentStatus,
                      )}
                    </td>

                    <td>
                      {statusLabel(
                        order.fulfillmentStatus,
                      )}
                    </td>

                    <td>
                      {displayDate(order.createdAt)}
                    </td>

                    <td>
                      <Link
                        href={`/dashboard/orders/view?id=${encodeURIComponent(
                          order.id,
                        )}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={style.formGrid}>
          <div>
            {previousQuery ? (
              <Link
                className={style.secondary}
                href={`/dashboard/orders?${previousQuery}`}
              >
                Previous
              </Link>
            ) : null}
          </div>

          <div>
            <p>
              Page {pagination.page} of{" "}
              {pagination.totalPages || 1}
            </p>
          </div>

          <div>
            {nextQuery ? (
              <Link
                className={style.secondary}
                href={`/dashboard/orders?${nextQuery}`}
              >
                Next
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}