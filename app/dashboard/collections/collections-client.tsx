import Link from "next/link";

import {
  deleteResource,
  saveResource,
} from "../actions";

import styles from "../[[...section]]/dashboard.module.css";
import Table from "../[[...section]]/table";

import type { RetailPagination, RetailRecord } from "@/lib/quithero-admin";

import { ActionButton } from "../[[...section]]/action-controls";

import {
  Header,
  Notice,
  text,
} from "../[[...section]]/page";
import { CollectionCreateSection } from "./collection-create-section";

const resourceConfig: Record<
  string,
  {
    title: string;
    description: string;
    resource: string;
    heads: string[];
    fields: [string, string, string?][];
  }
> = {
  variants: {
    title: "Product variants",
    description: "Manage pricing, SKUs and inventory by variant.",
    resource: "product-variants",
    heads: ["Variant", "SKU", "Price", "Available", "Actions"],
    fields: [
      ["productId", "Product ID"],
      ["name", "Variant name"],
      ["sku", "SKU"],
      ["price", "Price", "number"],
      ["inventory", "Inventory", "number"],
    ],
  },

  images: {
    title: "Product images",
    description: "Add image URLs, alt text and display order.",
    resource: "product-images",
    heads: ["Image URL", "Product", "Alt text", "Order", "Actions"],
    fields: [
      ["productId", "Product ID"],
      ["url", "Image URL", "url"],
      ["altText", "Alt text"],
      ["sortOrder", "Sort order", "number"],
    ],
  },

  options: {
    title: "Options & attributes",
    description:
      "Create reusable options such as strength, flavour or size.",
    resource: "product-options",
    heads: ["Option", "Slug", "ID", "", "Actions"],
    fields: [
      ["name", "Option name"],
      ["slug", "Slug"],
    ],
  },

  tags: {
    title: "Tags",
    description: "Organise and merchandise products with tags.",
    resource: "tags",
    heads: ["Tag", "Slug", "SEO title", "", "Actions"],
    fields: [
      ["name", "Tag name"],
      ["slug", "Slug"],
      ["image", "Image URL", "url"],
      ["seoTitle", "SEO title"],
    ],
  },

  collections: {
    title: "Collections",
    description: "Group products into storefront collections.",
    resource: "collections",
    heads: ["Collection", "Slug", "SEO title", "", "Actions"],
    fields: [
      ["name", "Collection name"],
      ["slug", "Slug"],
      ["description", "Description"],
      ["image", "Image URL", "url"],
      ["seoTitle", "SEO title"],
    ],
  },
};

export default function ResourcePage({
  kind,
  items,
  error,
  path = `/dashboard/products/${kind}`,
  pagination,
}: {
  kind: string;
  items: RetailRecord[];
  error?: string;
  path?: string;
  pagination: RetailPagination;
}) {
  const config = resourceConfig[kind];

  if (!config) {
    return null;
  }

  return (
    <>
      <Header
        title={config.title}
        description={config.description}
      />

      <Notice message={error} />

      {kind === "collections" ? (
        <CollectionCreateSection />
      ) : (
        <details className={styles.creator}>
          <summary>
            + Add {config.title.toLowerCase().replace(/s$/, "")}
          </summary>

          <form action={saveResource}>
            <input
                type="hidden"
                name="_resource"
                value={config.resource}
            />

            <input
                type="hidden"
                name="_returnTo"
                value={path}
            />

            <div className={styles.inlineForm}>
                {config.fields.map(
                ([name, label, type]) => (
                    <label key={name}>
                    {label}

                    <input
                        required={[
                        "productId",
                        "name",
                        "sku",
                        "price",
                        "url",
                        "slug",
                        ].includes(name)}
                        type={type ?? "text"}
                        step={
                        type === "number"
                            ? "any"
                            : undefined
                        }
                        name={name}
                    />
                    </label>
                ),
                )}
            </div>

            <ActionButton
                className={styles.primary}
                pendingLabel="Saving…"
            >
                Save
            </ActionButton>
            </form>
        </details>
      )}

      <Table heads={config.heads}>
        {items.map((item, index) => (
          <tr
            key={text(item.id, String(index))}
          >
            <td>
              <div
                className={
                  kind === "collections"
                    ? styles.collectionCell
                    : undefined
                }
              >
                {kind === "collections" &&
                  typeof item.image === "string" &&
                  item.image && (
                    <img
                      className={
                        styles.collectionThumbnail
                      }
                      src={item.image}
                      alt=""
                    />
                  )}

                <div>
                  <strong>
                    {text(
                      item.name ?? item.url,
                    )}
                  </strong>

                  <small>
                    {kind === "collections"
                        ? `${text(item.productCount, "0")} products`
                        : text(item.productId)}
                    </small>
                </div>
              </div>
            </td>

            <td>
              {text(
                item.sku ??
                  item.slug ??
                  item.productId,
              )}
            </td>

            <td>
              {kind === "variants"
                ? text(item.price)
                : text(
                    item.altText ??
                      item.seoTitle ??
                      item.slug,
                  )}
            </td>

            <td>
              {kind === "variants"
                ? text(item.inventory, "0")
                : text(
                    item.sortOrder,
                    "",
                  )}
            </td>

            <td>
              <div className={styles.actions}>
                {kind === "collections" && (
                  <>
                    <Link
                      href={`/dashboard/collections/edit?id=${encodeURIComponent(
                        text(item.id),
                      )}`}
                    >
                      Edit
                    </Link>

                    <Link
                      href={`/dashboard/collections/view?id=${encodeURIComponent(
                        text(item.id),
                      )}`}
                    >
                      View
                    </Link>
                  </>
                )}

                {kind !== "collections" && (
                  <form action={deleteResource}>
                    <input
                      type="hidden"
                      name="_resource"
                      value={config.resource}
                    />

                    <input
                      type="hidden"
                      name="_id"
                      value={text(item.id)}
                    />

                    <ActionButton pendingLabel="Deleting…">
                      Delete
                    </ActionButton>
                  </form>
                )}
              </div>
            </td>
          </tr>
        ))}
      </Table>

      {pagination && pagination.totalPages > 1 && (
        <nav
          className={styles.pagination}
          aria-label="Pagination"
        >
          <span>
            Page {pagination.page} of{" "}
            {pagination.totalPages} ·{" "}
            {pagination.total.toLocaleString()} records
          </span>

          <div>
            {pagination.page > 1 ? (
              <Link
                href={`${path}?page=${
                  pagination.page - 1
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
                href={`${path}?page=${
                  pagination.page + 1
                }`}
              >
                Next
              </Link>
            ) : (
              <span>Next</span>
            )}
          </div>
        </nav>
      )}
    </>
  );
}