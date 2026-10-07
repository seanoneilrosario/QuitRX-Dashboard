import Link from "next/link";

import styles from "@/app/components/dashboard.module.css";

import type {
  RetailRecord,
} from "@/lib/quitmed-retail-admin/collections/client";

import {
  CollectionCreateForm
} from "@/app/dashboard/collections/collection-component/collection-create-fields";

import CollectionDeleteButton from "./collection-delete-button";

type Props = {
  item?: RetailRecord;
  products: RetailRecord[];
  error?: string;
};

export default function CollectionEdit({
  item,
  products,
  productPagination,
  error,
}: {
  item?: RetailRecord;
  products: RetailRecord[];
  productPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}) {
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
            Edit{" "}
            {typeof item.name === "string"
              ? item.name
              : "collection"}
          </h1>

          <p>
            Update collection details and
            product membership.
          </p>
        </div>

        <div
          className={
            styles.collectionDeleteActions
          }
        >
          <Link
            className={styles.secondary}
            href="/dashboard/collections"
          >
            Back to collections
          </Link>

          <Link
            className={styles.primary}
            href={`/dashboard/collections/view?id=${encodeURIComponent(
              String(item.id ?? ""),
            )}`}
          >
            View collection
          </Link>

          <CollectionDeleteButton
            id={String(item.id)}
            name={
              typeof item.name === "string"
                ? item.name
                : "this collection"
            }
          />
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

      <section className={styles.formCard}>
        <h2>Collection details</h2>

        <CollectionCreateForm
          products={products.flatMap((product) =>
            typeof product.id === "string"
              ? [
                  {
                    id: product.id,
                    name:
                      typeof product.name === "string"
                        ? product.name
                        : "Unnamed product",
                    slug:
                      typeof product.slug === "string"
                        ? product.slug
                        : "",
                    brand: "",
                  },
                ]
              : [],
          )}
          productPagination={productPagination}
          initial={item}
        />
      </section>
    </>
  );
}