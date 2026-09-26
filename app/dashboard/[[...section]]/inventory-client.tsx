"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getInventoryBatch } from "../actions";
import Table from "./table";
import styles from "./dashboard.module.css";

type InventoryItem = {
  id?: string;
  name?: unknown;
  sku?: unknown;
  productId?: unknown;
  allocatedInventory?: unknown;
  incomingInventory?: unknown;
  _availableStock: number;
};

function text(value: unknown, fallback = "—") {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
}

function availableInventory(item: unknown) {
  if (!item || typeof item !== "object") {
    return 0;
  }

  return Number(
    (item as Record<string, unknown>)._availableStock ?? 0,
  );
}

function Status({ value }: { value: unknown }) {
  const label = text(value, "ACTIVE");

  return (
    <span
      className={`${styles.status} ${
        /draft|pending|low/i.test(label)
          ? styles.warning
          : ""
      }`}
    >
      {label.replaceAll("_", " ")}
    </span>
  );
}

export default function InventoryClient({
  initialData,
  initialPage,
  initialQuery,
  initialStockFilter,
  initialSort,
}: {
  initialData: Awaited<
    ReturnType<typeof getInventoryBatch>
  >;
  initialPage: number;
  initialQuery: string;
  initialStockFilter: string;
  initialSort: string;
}) {
  const PAGE_SIZE = 50;
  const PAGES_PER_BATCH = 10;

  const [page, setPage] = useState(initialPage);
  const [query, setQuery] = useState(initialQuery);
  const [stockFilter, setStockFilter] =
    useState(initialStockFilter);
  const [sort, setSort] = useState(initialSort);

  const [appliedQuery, setAppliedQuery] =
    useState(initialQuery);
  const [appliedStockFilter, setAppliedStockFilter] =
    useState(initialStockFilter);
  const [appliedSort, setAppliedSort] =
    useState(initialSort);

  const batch = Math.floor(
    (page - 1) / PAGES_PER_BATCH,
  );

  const inventoryQuery = useQuery({
    queryKey: ["inventory", { batch }],
    queryFn: () => {
      console.log(
        "🟣 TANSTACK QUERY FN RUNNING: INVENTORY BATCH",
        { batch },
      );

      return getInventoryBatch(batch);
    },
    initialData:
      batch === 0 ? initialData : undefined,
    staleTime: 30_000,
  });

  const variants =
  (inventoryQuery.data?.data ?? []) as InventoryItem[];

  const filtered = useMemo(() => {
    return [...variants]
      .filter((item) => {
        const available = availableInventory(item);

        const matchesQuery =
          !appliedQuery ||
          `${text(item.name, "")} ${text(item.sku, "")} ${text(
            item.productId,
            "",
          )}`
            .toLowerCase()
            .includes(appliedQuery.toLowerCase());

        const matchesStock =
          !appliedStockFilter ||
          (appliedStockFilter === "out"
            ? available <= 0
            : appliedStockFilter === "low"
              ? available > 0 && available <= 10
              : available > 0);

        return matchesQuery && matchesStock;
      })
      .sort((a, b) => {
        const [field = "product", direction = "asc"] =
          appliedSort.split("-");

        const multiplier =
          direction === "desc" ? -1 : 1;

        const fields: Record<string, keyof InventoryItem> = {
            product: "name",
            sku: "sku",
            allocated: "allocatedInventory",
            incoming: "incomingInventory",
        };

        if (field === "available") {
          return (
            (availableInventory(a) -
              availableInventory(b)) *
            multiplier
          );
        }

        const key = fields[field] ?? "name";

        if (
          [
            "inventory",
            "allocatedInventory",
            "incomingInventory",
          ].includes(key)
        ) {
          return (
            (Number(a[key] ?? 0) -
              Number(b[key] ?? 0)) *
            multiplier
          );
        }

        return (
          text(a[key], "").localeCompare(
            text(b[key], ""),
            undefined,
            {
              numeric: true,
              sensitivity: "base",
            },
          ) * multiplier
        );
      });
  }, [
    variants,
    appliedQuery,
    appliedStockFilter,
    appliedSort,
  ]);

  const totalPages =
    inventoryQuery.data?.totalPages ?? 1;

  const currentPageWithinBatch =
    (page - 1) % PAGES_PER_BATCH;

  const start =
    currentPageWithinBatch * PAGE_SIZE;

  const pageItems = filtered.slice(
    start,
    start + PAGE_SIZE,
  );

  function applyFilters(event: React.FormEvent) {
    event.preventDefault();

    setAppliedQuery(query);
    setAppliedStockFilter(stockFilter);
    setAppliedSort(sort);
    setPage(1);
  }

  const error =
    inventoryQuery.error instanceof Error
      ? inventoryQuery.error.message
      : inventoryQuery.data?.error;

  const isLoading = inventoryQuery.isPending;

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>
            QuitRX operations
          </p>

          <h1>Inventory</h1>

          <p>
            Manage available, allocated and incoming stock
            by product variant.
          </p>
        </div>

        <Link
          className={styles.secondary}
          href="/dashboard/inventory/history"
        >
          View history
        </Link>
      </header>

      {error ? (
        <div className={styles.notice}>
          <strong>API connection needed</strong>
          <span>{error}</span>
        </div>
      ) : null}

      <div className={styles.toolbar}>
        <form
          className={`${styles.search} ${styles.inventorySearch}`}
          onSubmit={applyFilters}
        >
          <span>⌕</span>

          <input
            name="q"
            aria-label="Search inventory"
            placeholder="Search product, SKU or product ID"
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
          />

          <select
            name="stock"
            aria-label="Filter by stock"
            value={stockFilter}
            onChange={(event) =>
              setStockFilter(event.target.value)
            }
          >
            <option value="">All stock</option>
            <option value="in">In stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </select>

          <select
            name="sort"
            aria-label="Sort inventory"
            value={sort}
            onChange={(event) =>
              setSort(event.target.value)
            }
          >
            <option value="product-asc">
              Product: A–Z
            </option>
            <option value="product-desc">
              Product: Z–A
            </option>
            <option value="sku-asc">
              SKU: A–Z
            </option>
            <option value="sku-desc">
              SKU: Z–A
            </option>
            <option value="available-desc">
              Available: high to low
            </option>
            <option value="available-asc">
              Available: low to high
            </option>
            <option value="allocated-desc">
              Allocated: high to low
            </option>
            <option value="incoming-desc">
              Incoming: high to low
            </option>
          </select>

          <button
            type="submit"
            className={styles.primary}
          >
            Apply
          </button>
        </form>
      </div>

      {isLoading ? (
        <div
          className={styles.customerLoading}
          aria-live="polite"
          aria-busy="true"
        >
          <div className={styles.customerSpinner} />
          <span>Loading inventory…</span>
        </div>
      ) : (
        <>
          <Table
            heads={[
              "Variant",
              "SKU",
              "Available",
              "Allocated",
              "Incoming",
              "Health",
            ]}
          >
            {pageItems.map((item, index) => (
              <tr
                key={text(
                  item.id,
                  String(index),
                )}
              >
                <td>
                  <strong>
                    {text(item.name)}
                  </strong>
                  <small>
                    {text(item.productId)}
                  </small>
                </td>

                <td>{text(item.sku)}</td>

                <td>
                  {availableInventory(item)}
                </td>

                <td>
                  {text(
                    item.allocatedInventory,
                    "0",
                  )}
                </td>

                <td>
                  {text(
                    item.incomingInventory,
                    "0",
                  )}
                </td>

                <td>
                  <Status
                    value={
                      availableInventory(item) <= 0
                        ? "OUT OF STOCK"
                        : availableInventory(item) <= 10
                          ? "LOW STOCK"
                          : "HEALTHY"
                    }
                  />
                </td>
              </tr>
            ))}
          </Table>

          {!pageItems.length ? (
            <div className={styles.notice}>
              <strong>No inventory found</strong>
              <span>
                Try changing the search, stock filter, or
                sort option.
              </span>
            </div>
          ) : null}

          {totalPages > 1 ? (
            <nav
            className={styles.inventoryPagination}
            aria-label="Pagination"
            >
            <span className={styles.inventoryPaginationInfo}>
                Showing page <strong>{page}</strong> of{" "}
                <strong>{totalPages}</strong> ·{" "}
                {(inventoryQuery.data?.total ?? 0).toLocaleString()}{" "}
                records
            </span>

            <div className={styles.inventoryPaginationActions}>
                <button
                type="button"
                className={styles.inventoryPaginationButton}
                disabled={page <= 1}
                onClick={() =>
                    setPage((current) =>
                    Math.max(1, current - 1),
                    )
                }
                >
                Previous
                </button>

                <button
                type="button"
                className={styles.inventoryPaginationButton}
                disabled={page >= totalPages}
                onClick={() =>
                    setPage((current) =>
                    Math.min(
                        totalPages,
                        current + 1,
                    ),
                    )
                }
                >
                Next
                </button>
            </div>
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}