"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStoreActivityBatch } from "../actions";
import Table from "../[[...section]]/table";
import styles from "../[[...section]]/dashboard.module.css";

export default function InventoryHistory() {
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 50;
  const PAGES_PER_BATCH = 10;

  const batch = Math.floor((page - 1) / PAGES_PER_BATCH);

  const historyQuery = useQuery({
    queryKey: ["inventory-history", { batch }],
    queryFn: () => getStoreActivityBatch(batch),
    staleTime: 30_000,
  });

  const allHistory = historyQuery.data?.data ?? [];

  const pageWithinBatch =
    (page - 1) % PAGES_PER_BATCH;

  const start =
    pageWithinBatch * PAGE_SIZE;

  const history = allHistory.slice(
    start,
    start + PAGE_SIZE,
  );

  const totalPages =
    historyQuery.data?.totalPages ?? 1;

  const error =
    historyQuery.error instanceof Error
      ? historyQuery.error.message
      : historyQuery.data?.error;

  const isLoading = historyQuery.isPending;

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>
            QuitRX operations
          </p>

          <h1>Inventory history</h1>

          <p>
            Audit activity returned by QuitHero.
          </p>
        </div>

        <Link
          className={styles.secondary}
          href="/dashboard/inventory"
        >
          Back to inventory
        </Link>
      </header>

      {error ? (
        <div className={styles.notice}>
          <strong>API connection needed</strong>
          <span>{error}</span>
        </div>
      ) : isLoading ? (
        <div
          className={styles.customerLoading}
          aria-live="polite"
          aria-busy="true"
        >
          <div className={styles.customerSpinner} />
          <span>Loading inventory history…</span>
        </div>
      ) : (
        <>
          <Table heads={["Event", "Resource", "Staff", "Date"]}>
            {history.map((item, index) => (
              <tr
                key={
                  typeof item.id === "string"
                    ? item.id
                    : String(index)
                }
              >
                <td>
                  {String(
                    item.action ??
                      item.event ??
                      "",
                  )}
                </td>

                <td>
                  {String(
                    item.resource ??
                      item.entity ??
                      "",
                  )}
                </td>

                <td>
                  {String(
                    item.user ??
                      item.staffEmail ??
                      "",
                  )}
                </td>

                <td>
                  {String(item.createdAt ?? "")}
                </td>
              </tr>
            ))}
          </Table>

          {totalPages > 1 && (
            <nav
              className={styles.pagination}
              aria-label="Pagination"
            >
              <span>
                Showing page {page} of {totalPages} ·{" "}
                {(
                  historyQuery.data?.total ?? 0
                ).toLocaleString()}{" "}
                records
              </span>

              <div>
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={page === 1}
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
                  className={styles.secondary}
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
          )}
        </>
      )}
    </>
  );
}