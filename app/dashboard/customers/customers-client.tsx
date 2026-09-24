"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCustomers } from "@/app/dashboard/actions";
import styles from "../[[...section]]/dashboard.module.css";

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

function newestCustomersFirst(items: Record<string, unknown>[]) {
  return items
    .map((item, index) => ({
      item,
      index,
      createdAt: Date.parse(text(item.createdAt, "")),
    }))
    .sort((a, b) => {
      const aTime = Number.isNaN(a.createdAt)
        ? Number.NEGATIVE_INFINITY
        : a.createdAt;
      const bTime = Number.isNaN(b.createdAt)
        ? Number.NEGATIVE_INFINITY
        : b.createdAt;

      return bTime - aTime || a.index - b.index;
    })
    .map(({ item }) => item);
}

function customerMatchesQuery(
  item: Record<string, unknown>,
  query: string,
) {
  return (
    !query ||
    [
      item.firstName,
      item.lastName,
      item.email,
      item.phone,
      item.shopifyId,
    ]
      .map((value) => text(value, ""))
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase())
  );
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
export default function CustomersClient({
  query,
  page,
  initialData,
  initialError,
}: {
  query: string;
  page: number;
  initialData: Awaited<ReturnType<typeof getCustomers>>;
  initialError?: string;
}) {
  const queryClient = useQueryClient();

  const customersQuery = useQuery({
    queryKey: ["customers", { query, page }],
    queryFn: () => getCustomers(query, page),
    initialData,
  });

  console.log(
    "Customer cache keys:",
    queryClient.getQueryCache().getAll().map((query) => query.queryKey),
  );

  console.log("Customers Query:", {
    dataUpdatedAt: customersQuery.dataUpdatedAt,
    isStale: customersQuery.isStale,
    isFetched: customersQuery.isFetched,
    isFetchedAfterMount: customersQuery.isFetchedAfterMount,
    });

  const items = newestCustomersFirst(customersQuery.data.data).filter(
    (customer) => customerMatchesQuery(customer, query),
  );

  const pagination = customersQuery.data.pagination;
  const error =
    customersQuery.error instanceof Error
      ? customersQuery.error.message
      : initialError;

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>QuitRX operations</p>
          <h1>Customers</h1>
          <p>
            Search customer accounts, purchase history and prescription status.
          </p>
        </div>

        <Link
          className={styles.primary}
          href="/dashboard/customers/create"
        >
          Add customer
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
            placeholder="Search name, email, phone or Shopify ID"
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
                "Customer",
                "Contact",
                "Orders",
                "Total spent",
                "Status",
                "",
              ].map((head) => (
                <th key={head}>{head}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {items.map((item, index) => (
              <tr key={text(item.id, String(index))}>
                <td>
                  <strong>
                    {text(item.firstName)} {text(item.lastName, "")}
                  </strong>
                  <small>{text(item.id)}</small>
                </td>

                <td>
                  {text(item.email)}
                  <small>{text(item.phone)}</small>
                </td>

                <td>{text(item.numberOfOrders, "0")}</td>

                <td>{money(item.totalSpent)}</td>

                <td>
                  <Status value={item.state} />
                </td>

                <td>
                  <Link
                    href={`/dashboard/customers/details?id=${text(item.id)}`}
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 ? (
        <nav className={styles.pagination} aria-label="Pagination">
          <span>
            Showing page {pagination.page} of {pagination.totalPages} ·{" "}
            {pagination.total.toLocaleString()} records
          </span>

          <div>
            {pagination.page > 1 ? (
              <Link
                href={`/dashboard/customers?page=${pagination.page - 1}${
                  query ? `&q=${encodeURIComponent(query)}` : ""
                }#dashboard-top`}
              >
                Previous
              </Link>
            ) : (
              <span>Previous</span>
            )}

            {pagination.page < pagination.totalPages ? (
              <Link
                href={`/dashboard/customers?page=${pagination.page + 1}${
                  query ? `&q=${encodeURIComponent(query)}` : ""
                }#dashboard-top`}
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