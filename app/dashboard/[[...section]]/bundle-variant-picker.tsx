"use client";

import { useEffect, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  BundleProduct,
  BundleVariant,
} from "./bundle-editor";
import styles from "./dashboard.module.css";
import { ActionButton, ActionLink } from "./action-controls";
import { getBundleConfiguration } from "@/app/dashboard/actions";

export default function BundleVariantPicker({
  products,
  variants,
  variantId,
  disabled,
  onVariantChange,
  page,
  totalPages,
  onPageChange,
  isLoadingPage,
  deletingVariantId,
}: {
  products: BundleProduct[];
  variants: BundleVariant[];
  variantId: string;
  disabled: boolean;
  onVariantChange: (variantId: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoadingPage: boolean;
  deletingVariantId: string;
}) {
  const queryClient = useQueryClient();

  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [activeVariantId, setActiveVariantId] =
    useState(variantId);

  const PAGE_SIZE = 50;
  const search = query.trim().toLowerCase();

  const filteredProducts = products.flatMap((product) => {
    const productVariants = variants.filter(
      (variant) =>
        variant.productId === product.id,
    );

    const matches =
      !search ||
      product.label
        .toLowerCase()
        .includes(search) ||
      productVariants.some((variant) =>
        `${variant.label} ${variant.sku}`
          .toLowerCase()
          .includes(search),
      );

    return matches
      ? [
          {
            ...product,
            variants: productVariants,
          },
        ]
      : [];
  });

  const visibleProducts = filteredProducts.slice(
    ((page - 1) % 10) * PAGE_SIZE,
    (((page - 1) % 10) + 1) * PAGE_SIZE,
  );

  useEffect(() => {
    const clearActiveBundle = () =>
      setActiveVariantId("");

    window.addEventListener(
      "bundle-editor-close",
      clearActiveBundle,
    );

    return () =>
      window.removeEventListener(
        "bundle-editor-close",
        clearActiveBundle,
      );
  }, []);

  function openVariant(nextId: string) {
    if (!nextId) return;

    const change = new Event(
      "bundle-variant-change",
      { cancelable: true },
    );

    if (!window.dispatchEvent(change)) return;

    setActiveVariantId(nextId);

    startTransition(() => {
      onVariantChange(nextId);

      window.dispatchEvent(
        new CustomEvent("bundle-editor-select", {
          detail: nextId,
        }),
      );

      const url = new URL(window.location.href);
      url.searchParams.set(
        "variantId",
        nextId,
      );

      window.history.replaceState(
        window.history.state,
        "",
        url.toString(),
      );
    });
  }

  function prefetchVariant(nextId: string) {
    const nextVariant = variants.find(
      (variant) =>
        variant.id === nextId,
    );

    if (!nextVariant) return;

    queryClient.prefetchQuery({
      queryKey: [
        "bundle-configuration",
        {
          productId: nextVariant.productId,
          variantId: nextVariant.id,
        },
      ],
      queryFn: () =>
        getBundleConfiguration(
          nextVariant.productId,
          nextVariant.id,
        ),
      staleTime: 30_000,
    });
  }

  return (
    <>
      <div className={styles.form}>
        <section className={styles.formCard}>
          <div
            className={
              styles.bundleListHeader
            }
          >
            <div>
              <h2>Bundle products</h2>

              <p>
                {products.length}{" "}
                {products.length === 1
                  ? "bundle"
                  : "bundles"}
              </p>
            </div>

            <label
              className={
                styles.bundleListSearch
              }
            >
              Search bundles

              <input
                type="search"
                placeholder="Search bundle, group or SKU"
                value={query}
                disabled={disabled}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
              />
            </label>
          </div>

          <div
            className={
              styles.bundleProductList
            }
          >
            {visibleProducts.map(
              (product) => (
                <article
                  key={product.id}
                  className={
                    styles.bundleListItem
                  }
                >
                  <div>
                    <strong>
                      {product.label}
                    </strong>

                    <small>
                      {
                        product.variants
                          .length
                      }{" "}
                      {product.variants.length ===
                      1
                        ? "group"
                        : "groups"}
                    </small>

                  </div>

                  <div
                    className={
                      styles.bundleGroupList
                    }
                  >
                    {product.variants.map(
                      (variant) => (
                        <div
                          key={variant.id}
                          className={
                            variant.id ===
                            activeVariantId
                              ? styles.bundleGroupActive
                              : undefined
                          }
                        >
                          <span>
                            <strong>
                              {
                                variant.label
                              }
                            </strong>

                            {variant.sku && (
                              <small>
                                SKU:{" "}
                                {
                                  variant.sku
                                }
                              </small>
                            )}
                          </span>

                          <div className={styles.bundleRowActions}>
                          {product.storefrontUrl && (
                            <a href={product.storefrontUrl} target="_blank" rel="noopener noreferrer">
                              View
                            </a>
                          )}
                          <ActionButton
                            type="button"
                            className={
                              styles.secondary
                            }
                            disabled={
                              disabled
                            }
                            pending={variant.id === deletingVariantId || (variant.id === activeVariantId && isPending)}
                            pendingLabel={variant.id === deletingVariantId ? "Deleting…" : "Loading…"}
                            onPointerEnter={() =>
                              prefetchVariant(
                                variant.id,
                              )
                            }
                            onFocus={() =>
                              prefetchVariant(
                                variant.id,
                              )
                            }
                            onClick={() =>
                              openVariant(
                                variant.id,
                              )
                            }
                          >
                            {variant.id ===
                            activeVariantId
                              ? "Editing"
                              : "Edit"}
                          </ActionButton>
                          </div>
                        </div>
                      ),
                    )}

                    {!product.variants
                      .length && (
                      <div
                        className={
                          styles.bundleEmpty
                        }
                      >
                        No bundle groups are
                        available for this
                        product.
                        {product.storefrontUrl && (
                          <a href={product.storefrontUrl} target="_blank" rel="noopener noreferrer">
                            View
                          </a>
                        )}
                        <ActionLink href={`/dashboard/bundles/create?id=${encodeURIComponent(product.id)}`} className={styles.secondary}>
                          Complete bundle
                        </ActionLink>
                      </div>
                    )}
                  </div>
                </article>
              ),
            )}

            {!disabled &&
              !filteredProducts.length && (
                <p
                  className={
                    styles.bundleEmpty
                  }
                >
                  {products.length
                    ? "No bundles match your search."
                    : "No products tagged bundle are available."}
                </p>
              )}
          </div>

          {totalPages > 1 && (
            <nav
              className={
                styles.bundlePagination
              }
              aria-label="Bundle pagination"
            >
              <div
                className={
                  styles.bundlePaginationInfo
                }
              >
                Showing page{" "}
                <strong>{page}</strong> of{" "}
                <strong>{totalPages}</strong>
              </div>

              <div
                className={
                  styles.bundlePaginationActions
                }
              >
                <button
                  type="button"
                  className={
                    styles.bundlePaginationButton
                  }
                  disabled={
                    page <= 1 ||
                    isLoadingPage
                  }
                  onClick={() =>
                    onPageChange(page - 1)
                  }
                >
                  <span aria-hidden="true">
                    ←
                  </span>
                  Previous
                </button>

                <button
                  type="button"
                  className={
                    styles.bundlePaginationButton
                  }
                  disabled={
                    page >= totalPages ||
                    isLoadingPage
                  }
                  onClick={() =>
                    onPageChange(page + 1)
                  }
                >
                  Next
                  <span aria-hidden="true">
                    →
                  </span>
                </button>
              </div>
            </nav>
          )}
        </section>
      </div>

      {isPending && (
        <div
          className={
            styles.bundleLoadingModal
          }
          role="status"
          aria-live="polite"
          aria-label="Loading bundle editor"
        >
          <div>
            <span
              className={
                styles.bundleLoadingSpinner
              }
            />

            <strong>
              Loading bundle…
            </strong>

            <small>
              Preparing the bundle editor
            </small>
          </div>
        </div>
      )}
    </>
  );
}
