"use client";

import Link from "next/link";
import { useState } from "react";
import type {
  RetailPagination,
  RetailRecord,
} from "@/lib/quithero-admin";

import {
  getCollectionProductsPage,
} from "../actions";

import Table from "../[[...section]]/table";
import styles from "../[[...section]]/dashboard.module.css";
import { ActionButton } from "../[[...section]]/action-controls";

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

type Props = {
  collectionId: string;
  collection: RetailRecord;
  initialProducts: RetailRecord[];
  initialPagination: RetailPagination;
  initialError?: string;
  storefrontUrl?: string;
};

export default function CollectionViewClient({
  collectionId,
  collection,
  initialProducts,
  initialPagination,
  initialError,
  storefrontUrl,
}: Props) {
  const [products, setProducts] =
    useState<RetailRecord[]>(
      initialProducts,
    );

  const [pagination, setPagination] =
    useState<RetailPagination>(
      initialPagination,
    );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState(initialError);

  const hasNextPage =
    pagination.page <
    pagination.totalPages;

  async function loadMore() {
    if (loading || !hasNextPage) {
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      const nextPage =
        pagination.page + 1;

      const result =
        await getCollectionProductsPage(
          collectionId,
          nextPage,
          pagination.limit,
        );

      if (result.error) {
        setError(result.error);
        return;
      }

      setProducts((current) => [
        ...current,
        ...result.products,
      ]);

      setPagination(result.pagination);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load more products.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
            }}
            >
            <div>
                <h1>{text(collection.name, "Collection")}</h1>

                <p>
                {pagination.total}{" "}
                {pagination.total === 1
                    ? "product"
                    : "products"}{" "}
                in this collection.
                </p>
            </div>

            <div className={styles.collectionDeleteActions}>
                <Link
                className={styles.secondary}
                href="/dashboard/collections"
                >
                Back to collections
                </Link>

                {storefrontUrl ? (
                <a
                    className={styles.primary}
                    href={storefrontUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    View collections on store
                </a>
                ) : null}
            </div>
        </div>

        {error ? (
            <div className={styles.notice}>
            {error}
            </div>
        ) : null}

        {products.length ? (
            <>
            <Table
              heads={[
                "Product",
                "Slug",
                "Brand",
                "Product type",
                "Status",
              ]}
            >
                {products.map((product, index) => (
                <tr key={text(product.id, `product-${index}`)}>
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
                    {text(
                        nested(product, "brand")
                        ?.name ??
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

                    <td>
                    {text(product.status)}
                    </td>
                </tr>
                ))}
            </Table>

            {hasNextPage ? (
                <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    marginTop: "1.5rem",
                }}
                >
                <ActionButton
                    className={styles.secondary}
                    pendingLabel="Loading…"
                    onClick={loadMore}
                >
                    Load more products
                </ActionButton>
                </div>
            ) : null}
            </>
        ) : (
            <div className={styles.emptyState}>
            <strong>
                No products in this collection
            </strong>

            <span>
                This collection currently has
                no products.
            </span>
            </div>
        )}
    </>
  );
}