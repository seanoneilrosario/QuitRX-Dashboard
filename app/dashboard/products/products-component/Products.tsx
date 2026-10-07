import Link from "next/link";

import styles from "@/app/components/dashboard.module.css";

import type { RetailRecord } from "@/lib/quitmed-retail-admin/collections/client";

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type Props = {
  products: RetailRecord[];
  pagination: Pagination;
  query: string;
  status: string;
  error?: string;
};

function text(
  value: unknown,
  fallback = "—",
) {
  return typeof value === "string" ||
    typeof value === "number"
    ? String(value)
    : fallback;
}

function nested(
  item: RetailRecord,
  key: string,
) {
  const value = item[key];

  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as RetailRecord)
    : undefined;
}

function ProductStatus({
  value,
}: {
  value: unknown;
}) {
  const label = text(value, "UNKNOWN");

  return (
    <span
      className={`${styles.status} ${
        /draft/i.test(label)
          ? styles.warning
          : ""
      }`}
    >
      {label.replaceAll("_", " ")}
    </span>
  );
}

function Pagination({
  pagination,
  query,
  status,
}: {
  pagination: Pagination;
  query: string;
  status: string;
}) {
  if (pagination.totalPages <= 1) {
    return null;
  }

  function href(page: number) {
    const params = new URLSearchParams();

    params.set("page", String(page));

    if (query) {
      params.set("q", query);
    }

    if (status) {
      params.set("status", status);
    }

    return `/dashboard/products?${params.toString()}`;
  }

  return (
    <nav
      className={styles.pagination}
      aria-label="Products pagination"
    >
      <span>
        Showing page{" "}
        {pagination.page} of{" "}
        {pagination.totalPages} ·{" "}
        {pagination.total.toLocaleString()}{" "}
        products
      </span>

      <div>
        {pagination.page > 1 ? (
          <Link
            href={href(
              pagination.page - 1,
            )}
          >
            Previous
          </Link>
        ) : (
          <span>Previous</span>
        )}

        {pagination.page <
        pagination.totalPages ? (
          <Link
            href={href(
              pagination.page + 1,
            )}
          >
            Next
          </Link>
        ) : (
          <span>Next</span>
        )}
      </div>
    </nav>
  );
}

export default function Products({
  products,
  pagination,
  query,
  status,
  error,
}: Props) {
  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>
            QuitRX operations
          </p>

          <h1>Products</h1>

          <p>
            Manage products and everything
            customers see in your store.
          </p>
        </div>

        {/* <Link
          className={styles.primary}
          href="/dashboard/products/create"
        >
          + Create product
        </Link> */}
      </header>

      {error && (
        <div className={styles.notice}>
          <strong>
            Unable to load products
          </strong>

          <span>{error}</span>
        </div>
      )}

      <div className={styles.toolbar}>
        <form className={styles.search}>
          <span>⌕</span>

          <input
            name="q"
            aria-label="Search products"
            placeholder="Search name, slug, brand or type"
            defaultValue={query}
          />

          <select
            name="status"
            aria-label="Filter by status"
            defaultValue={status}
          >
            <option value="">
              All statuses
            </option>

            <option value="ACTIVE">
              Active
            </option>

            <option value="DRAFT">
              Draft
            </option>

            <option value="ARCHIVED">
              Archived
            </option>
          </select>

          <button
            type="submit"
            className={styles.secondary}
          >
            Apply
          </button>
        </form>
      </div>

      <section className={styles.formCard}>
        <div className={styles.cardTitle}>
          <div>
            <h2>Products</h2>

            <p>
              {pagination.total.toLocaleString()}{" "}
              total products
            </p>
          </div>
        </div>

        {products.length > 0 ? (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Brand</th>
                  <th>Type</th>
                  <th>Inventory</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {products.map(
                  (product) => {
                    const brand =
                      nested(
                        product,
                        "brand",
                      );

                    const productType =
                      nested(
                        product,
                        "productType",
                      );

                    return (
                      <tr
                        key={text(
                          product.id,
                        )}
                      >
                        <td>
                          <strong>
                            {text(
                              product.name,
                            )}
                          </strong>

                          <small>
                            {text(
                              product.slug,
                            )}
                          </small>
                        </td>

                        <td>
                          {text(
                            brand?.name ??
                              product.brandId,
                          )}
                        </td>

                        <td>
                          {text(
                            productType?.name ??
                              product.productTypeId,
                          )}
                        </td>

                        <td>
                          {text(
                            product.inventory,
                            "0",
                          )}
                        </td>

                        <td>
                          <ProductStatus
                            value={
                              product.status
                            }
                          />
                        </td>

                        <td>
                          <div
                            className={
                              styles.actions
                            }
                          >

                            <Link
                                href={`/dashboard/products/view?id=${encodeURIComponent(
                                    text(product.id, ""),
                                )}`}
                                >
                                View
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.notice}>
            <strong>
              No products found
            </strong>

            <span>
              {query || status
                ? "Try changing your search or status filter."
                : "No products are available yet."}
            </span>
          </div>
        )}
      </section>

      <Pagination
        pagination={pagination}
        query={query}
        status={status}
      />
    </>
  );
}