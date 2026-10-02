"use client";

import { useRef, useState } from "react";
import { getCollectionProductOptions } from "../actions";
import { CollectionCreateForm } from "../[[...section]]/collection-create-fields";
import styles from "../[[...section]]/dashboard.module.css";

import type { RetailRecord } from "@/lib/quithero-admin";

type CollectionCreateSectionProps = {
  initial?: RetailRecord;
};

type ProductOption = {
  id: string;
  name: string;
  slug: string;
  brand: string;
};

const PAGE_SIZE = 100;

export function CollectionCreateSection({
  initial,
}: CollectionCreateSectionProps) {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const loadedRef = useRef(false);
  const loadingRef = useRef(false);

  async function loadProducts(nextPage: number) {
    if (loadingRef.current) return;

    loadingRef.current = true;
    setError("");

    if (nextPage === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const result = await getCollectionProductOptions(
        nextPage,
        PAGE_SIZE,
      );

      if (result.error) {
        setError(result.error);
        return;
      }

      setProducts((current) =>
        nextPage === 1
          ? result.data
          : [...current, ...result.data],
      );

      setPage(result.pagination.page);
      setTotalPages(result.pagination.totalPages);
      loadedRef.current = true;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load products.",
      );
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  }

  async function handleToggle(
    event: React.SyntheticEvent<HTMLDetailsElement>,
  ) {
    if (!event.currentTarget.open) return;
    if (loadedRef.current) return;

    await loadProducts(1);
  }

  return (
    <details
      className={styles.creator}
      onToggle={handleToggle}
    >
      <summary>+ Add collection</summary>

      {loading && (
        <div className={styles.loadingState} role="status">
          <span
            className={styles.loadingSpinner}
            aria-hidden="true"
          />
          <strong>Loading products…</strong>
        </div>
      )}

      {error && (
        <p role="alert">
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          {!loading && !error && (
            <CollectionCreateForm
                products={products}
                onLoadMoreProducts={() =>
                loadProducts(page + 1)
                }
                canLoadMoreProducts={
                page < totalPages
                }
                loadingMoreProducts={loadingMore}
            />
            )}
        </>
      )}
    </details>
  );
}