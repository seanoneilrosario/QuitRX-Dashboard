import Link from "next/link";

import styles from "@/app/components/dashboard.module.css";

import type {
  RetailRecord,
} from "@/lib/quitmed-retail-admin/collections/client";

import {
  CollectionCreateForm,
} from "@/app/dashboard/collections/collection-component/collection-create-fields";

import CollectionDeleteButton from "./collection-delete-button";

type Props = {
  item?: RetailRecord;
  products: RetailRecord[];
  productPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
  returnTo: string;
};

export default function CollectionEdit({
  item,
  products,
  productPagination,
  error,
  returnTo,
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
            href={returnTo}
            className={styles.primary}
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

  const collectionId = String(item.id ?? "");

  const collectionName =
    typeof item.name === "string"
      ? item.name
      : "this collection";

  const viewHref =
    `/dashboard/collections/view?id=${encodeURIComponent(
      collectionId,
    )}&returnTo=${encodeURIComponent(returnTo)}`;

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

        <div className={styles.collectionDeleteActions}>
          <Link
            href={returnTo}
            className={styles.secondary}
          >
            Back to collections
          </Link>

          <Link
            href={viewHref}
            className={styles.primary}
          >
            View collection
          </Link>

          <CollectionDeleteButton
            id={collectionId}
            name={collectionName}
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