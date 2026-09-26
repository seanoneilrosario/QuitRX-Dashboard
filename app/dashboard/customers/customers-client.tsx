"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCustomerBatch } from "@/app/dashboard/actions";
import styles from "../[[...section]]/dashboard.module.css";
import { useEffect, useState  } from "react";

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
    return items.map((item, index) => ({
        item,
        index,
        createdAt: Date.parse(text(item.createdAt, "")),
    })).sort((a, b) => {
        const aTime = Number.isNaN(a.createdAt)
            ? Number.NEGATIVE_INFINITY
            : a.createdAt;
        const bTime = Number.isNaN(b.createdAt)
            ? Number.NEGATIVE_INFINITY
            : b.createdAt;
        return bTime - aTime || a.index - b.index;
    }).map(({ item }) => item);
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
        initialData: {
            data: Record<string, unknown>[];
            pagination: {
                page: number;
                limit: number;
                total: number;
                totalPages: number;
            };
        };
        initialError?: string;
    }) {
        const queryClient = useQueryClient();

        const [currentPage, setCurrentPage] = useState(page);

        const PAGE_SIZE = 50;
        const BATCH_SIZE = 500;
        const PAGES_PER_BATCH = BATCH_SIZE / PAGE_SIZE;

        const batch = Math.floor(
            (currentPage - 1) / PAGES_PER_BATCH,
        );

        useEffect(() => {
            const cachedCustomers = queryClient.getQueryData([
                "customers",
                { query, batch },
            ]);

            console.log("🟡 CUSTOMERS CACHE:", cachedCustomers);
        }, [query, batch, queryClient]);

        const customersQuery = useQuery({
            queryKey: ["customers", { query, batch }],
            queryFn: async () => {
                console.log("🟣 TANSTACK QUERY FN RUNNING: CUSTOMERS", {
                query,
                batch,
                });

                return getCustomerBatch(query, batch);
            },
            placeholderData: {
                data: initialData.data,
                total: initialData.pagination.total,
                totalPages: initialData.pagination.totalPages,
                error: initialError,
            },
            staleTime: 30_000,
        });

        const isLoadingBatch = customersQuery.isFetching;

        const batchData = customersQuery.data;

        const batchCustomers = newestCustomersFirst(
            customersQuery.data?.data ?? [],
        ).filter((customer) =>
            customerMatchesQuery(customer, query),
        );

        const pageWithinBatch =
            (currentPage - 1) % PAGES_PER_BATCH;

        const startIndex =
            pageWithinBatch * PAGE_SIZE;

        const items = batchCustomers.slice(
            startIndex,
            startIndex + PAGE_SIZE,
        );

        const pagination = {
            page: currentPage,
            limit: PAGE_SIZE,
            total: batchData?.total ?? initialData.pagination.total,
            totalPages:
                batchData?.totalPages ??
                initialData.pagination.totalPages,
        };

        const error = customersQuery.error instanceof Error
                ? customersQuery.error.message
                : customersQuery.data?.error ?? initialError;

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

            {isLoadingBatch ? (
                <div
                    aria-live="polite"
                    style={{
                        padding: "8px 0",
                        opacity: 0.7,
                    }}
                >
                    Loading customers…
                </div>
            ) : null}

            {isLoadingBatch ? (
                <div
                    className={styles.customerLoading}
                    aria-live="polite"
                    aria-busy="true"
                >
                    <div className={styles.customerSpinner} />
                    <span>Loading customers…</span>
                </div>
            ) : (
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
                                            {text(item.firstName)}{" "}
                                            {text(item.lastName, "")}
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
            )}

            {pagination.totalPages > 1 ? (
                <nav
                    className={styles.pagination}
                    aria-label="Pagination"
                    aria-busy={isLoadingBatch}
                >
                    <span>
                        Showing page {currentPage} of {pagination.totalPages} ·{" "}
                        {pagination.total.toLocaleString()} records
                    </span>

                    <div>
                        {currentPage > 1 ? (
                            <Link
                                href={`/dashboard/customers?page=${currentPage - 1}${
                                    query
                                        ? `&q=${encodeURIComponent(query)}`
                                        : ""
                                }`}
                                onClick={(event) => {
                                    event.preventDefault();
                                    if (!isLoadingBatch) {
                                        setCurrentPage(currentPage - 1);
                                    }
                                }}
                                aria-disabled={isLoadingBatch}
                            >
                                Previous
                            </Link>
                        ) : (
                            <span>Previous</span>
                        )}

                        {currentPage < pagination.totalPages ? (
                            <Link
                                href={`/dashboard/customers?page=${currentPage + 1}${
                                    query
                                        ? `&q=${encodeURIComponent(query)}`
                                        : ""
                                }`}
                                onClick={(event) => {
                                    event.preventDefault();
                                    if (!isLoadingBatch) {
                                        setCurrentPage(currentPage + 1);
                                    }
                                }}
                                aria-disabled={isLoadingBatch}
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