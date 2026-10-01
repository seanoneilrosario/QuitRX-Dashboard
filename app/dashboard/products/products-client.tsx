"use client";

import Link from "next/link";
import { ActionButton, ActionLink } from "../[[...section]]/action-controls";
import styles from "../[[...section]]/dashboard.module.css";

type RetailRecord = Record<string, unknown>;

type ProductVariant = RetailRecord & {
  __availableStock?: number;
};

type RetailPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ProductPageData = {
  data: RetailRecord[];
  pagination: RetailPagination;
  error?: string;
};

type ProductVariantsData = {
  data: ProductVariant[];
};

function text(value: unknown, fallback = "—") {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
}

function nested(item: RetailRecord, key: string) {
  const value = item[key];

  return value && typeof value === "object"
    ? (value as RetailRecord)
    : undefined;
}

function storefrontUrl(
  baseUrl: string,
  resource: "product" | "collections",
  item: RetailRecord,
) {
  return `${baseUrl}/${resource}/${encodeURIComponent(
    text(item.slug, ""),
  )}`;
}

function Header({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <p className={styles.eyebrow}>QuitRX operations</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

function Notice({ message }: { message?: string }) {
  return message ? (
    <div className={styles.notice}>
      <strong>API connection needed</strong>
      <span>{message}</span>
    </div>
  ) : null;
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

function Table({
  heads,
  children,
}: {
  heads: string[];
  children: React.ReactNode;
}) {
  return (
    <div className={styles.tableWrap}>
      <table>
        <thead>
          <tr>
            {heads.map((head) => (
              <th key={head}>{head}</th>
            ))}
          </tr>
        </thead>

        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Pagination({
  page,
  total,
  totalPages,
  query,
  status,
}: {
  page: number;
  total: number;
  totalPages: number;
  query: string;
  status: string;
}) {
  if (totalPages <= 1) return null;

  const href = (nextPage: number) => {
    const params = new URLSearchParams();

    params.set("page", String(nextPage));

    if (query) {
      params.set("q", query);
    }

    if (status) {
      params.set("status", status);
    }

    return `/dashboard/products?${params.toString()}`;
  };

  return (
    <nav
      className={styles.pagination}
      aria-label="Pagination"
    >
      <span>
        Showing page {page} of {totalPages} ·{" "}
        {total.toLocaleString()} records
      </span>

      <div>
        {page > 1 ? (
          <Link href={href(page - 1)}>
            Previous
          </Link>
        ) : (
          <span>Previous</span>
        )}

        {page < totalPages ? (
          <Link href={href(page + 1)}>
            Next
          </Link>
        ) : (
          <span>Next</span>
        )}
      </div>
    </nav>
  );
}

export default function ProductsClient({
  query,
  status,
  page,
  storefrontBaseUrl,
  initialData,
  initialVariants,
  initialError,
}: {
  query: string;
  status: string;
  page: number;
  storefrontBaseUrl: string;
  initialData: ProductPageData;
  initialVariants: ProductVariantsData;
  initialError?: string;
}) {
  
  const items = initialData.data;
  const variants = initialVariants.data as ProductVariant[];

  const total = initialData.pagination.total;
  const totalPages = initialData.pagination.totalPages;

  const safeCurrentPage = Math.min(
    page,
    Math.max(1, totalPages),
  );

  const visibleItems = items;

  return (
    <>
      <Header
        title="Products"
        description="Manage products and everything customers see in your store."
        action={
          <ActionLink
            className={styles.primary}
            href="/dashboard/products/create"
            pendingLabel="Loading…"
          >
            + Create product
          </ActionLink>
        }
      />

      <Notice message={initialError} />

      <div className={styles.toolbar}>
        <form className={styles.search}>
          <span>⌕</span>

          <input
            name="q"
            aria-label="Search products"
            placeholder="Search name, handle, brand or type"
            defaultValue={query}
          />

          <select
            name="status"
            aria-label="Filter by status"
            defaultValue={status}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          <ActionButton pendingLabel="Applying…">
            Apply
          </ActionButton>
        </form>

        <div className={styles.subnav}>
          {[
            ["Frequently Bought", "frequently-bought"],
            ["Variants", "variants"],
            ["Images", "images"],
            ["Options", "options"],
            ["Tags", "tags"],
          ].map(([label, path]) => (
            <Link key={path} href={`/dashboard/products/${path}`}>
              {label}
            </Link>
          ))}
        </div>
      </div>

      <Table
        heads={[
          "Product",
          "Brand",
          "Type",
          "Inventory",
          "Status",
          "Actions",
        ]}
      >
        {visibleItems.map((item, index) => {
          const productVariants = variants.filter(
            (variant) =>
            text(variant.productId, "") === text(item.id, ""),
          );

          const inventory = productVariants.reduce(
              (total, variant) =>
              total + Number(variant.__availableStock ?? 0),
              0,
          );

          return (
              <tr key={text(item.id, String(index))}>
              <td>
                  <strong>{text(item.name)}</strong>
                  <small>{text(item.slug)}</small>
              </td>

              <td>
                  {text(
                  nested(item, "brand")?.name ?? item.brandId,
                  )}
              </td>

              <td>
                  {text(
                  nested(item, "productType")?.name ??
                      item.productTypeId,
                  )}
              </td>

              <td>
                  {inventory} in stock for {productVariants.length}{" "}
                  {productVariants.length === 1 ? "variant" : "variants"}
              </td>

              <td>
                  <Status value={item.status} />
              </td>

              <td>
                  <div className={styles.actions}>
                  <a
                      href={storefrontUrl(
                      storefrontBaseUrl,
                      "product",
                      item,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                  >
                      View
                  </a>
                  </div>
              </td>
              </tr>
          );
        })}
      </Table>

      {!visibleItems.length ? (
        <div className={styles.notice}>
          <strong>No products found</strong>
          <span>
            Try changing the search text or status filter.
          </span>
        </div>
      ) : null}

      <Pagination
        page={safeCurrentPage}
        total={total}
        totalPages={totalPages}
        query={query}
        status={status}
      />
    </>
  );
}
