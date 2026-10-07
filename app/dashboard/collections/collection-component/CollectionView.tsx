import Link from "next/link";

import Table from "@/app/components/table";

import styles from "@/app/components/dashboard.module.css";

import type {
  RetailRecord,
  RetailPagination,
} from "@/lib/quitmed-retail-admin/collections/client";

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
    typeof value === "object"
    ? (value as RetailRecord)
    : undefined;
}

function Status({
  value,
}: {
  value: unknown;
}) {
  return (
    <span>
      {text(value)}
    </span>
  );
}

type Props = {
  id: string;
  item?: RetailRecord;
  products: RetailRecord[];
  pagination: RetailPagination;
  error?: string;
  status: string;
};

export default function CollectionView({
  id,
  item,
  products,
  pagination,
  error,
  status,
}: Props) {
  if (!item) {
    return (
      <>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>
              QuitRX operations
            </p>

            <h1>Collection not found</h1>

            <p>
              Choose a collection from the
              collections list.
            </p>
          </div>

          <Link
            className={styles.primary}
            href="/dashboard/collections"
          >
            Back to collections
          </Link>
        </header>

        {error ? (
          <div className={styles.notice}>
            <strong>
              API connection needed
            </strong>

            <span>{error}</span>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>
            QuitRX operations
          </p>

          <h1>
            {text(item.name, "Collection")}
          </h1>

          <p>
            {pagination.total.toLocaleString()}{" "}
            products in this collection.
          </p>
        </div>

        <div className={styles.actions}>
          <Link
            href="/dashboard/collections"
          >
            Back to collections
          </Link>

          <Link
            href={`/dashboard/collections/edit?id=${encodeURIComponent(
              id,
            )}`}
          >
            Edit
          </Link>
        </div>
      </header>

      {error ? (
        <div className={styles.notice}>
          <strong>
            API connection needed
          </strong>

          <span>{error}</span>
        </div>
      ) : null}

      <Table
        heads={[
          "Product",
          "Slug",
          "Status",
          "Brand",
          "Product type",
        ]}
      >
        {products.map(
          (product, index) => (
            <tr
              key={text(
                product.id,
                `product-${index}`,
              )}
            >
              <td>
                <strong>
                  {text(
                    product.name,
                    "Unnamed product",
                  )}
                </strong>
              </td>

              <td>
                {text(product.slug)}
              </td>

              <td>
                <Status
                  value={product.status}
                />
              </td>

              <td>
                {text(
                  nested(
                    product,
                    "brand",
                  )?.name ??
                    product.brand,
                )}
              </td>

              <td>
                {text(
                  nested(
                    product,
                    "productType",
                  )?.name ??
                    product.productType,
                )}
              </td>
            </tr>
          ),
        )}
      </Table>

      {pagination.totalPages > 1 ? (
        <nav
          className={styles.pagination}
          aria-label="Collection products pagination"
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
                href={`/dashboard/collections/view?id=${encodeURIComponent(
                  id,
                )}&page=${
                  pagination.page - 1
                }${
                  status
                    ? `&status=${encodeURIComponent(
                        status,
                      )}`
                    : ""
                }`}
              >
                Previous
              </Link>
            ) : (
              <span>Previous</span>
            )}

            {pagination.page <
            pagination.totalPages ? (
              <Link
                href={`/dashboard/collections/view?id=${encodeURIComponent(
                  id,
                )}&page=${
                  pagination.page + 1
                }${
                  status
                    ? `&status=${encodeURIComponent(
                        status,
                      )}`
                    : ""
                }`}
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