"use client";

import { useMemo, useState } from "react";

import {
  loadCollectionEditProducts,
} from "@/lib/quitmed-retail-admin/collections/actions";

import styles from "@/app/components/dashboard.module.css";

export type ProductOption = {
  id: string;
  name: string;
  slug: string;
  brand: string;
};

type ProductPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type Props = {
  products: ProductOption[];
  productPagination?: ProductPagination;
  selected: string[];
  pending: boolean;
  onSelectionChange: (
    ids: string[],
  ) => void;
};

export default function ManualProductsField({
  products,
  productPagination,
  selected,
  pending,
  onSelectionChange,
}: Props) {
  const [query, setQuery] =
    useState("");

  const [availableProducts, setAvailableProducts] =
    useState<ProductOption[]>(products);

  const [productPage, setProductPage] =
    useState(
      productPagination?.page ?? 1,
    );

  const [productTotalPages, setProductTotalPages] =
    useState(
      productPagination?.totalPages ?? 1,
    );

  const [loadingMoreProducts, setLoadingMoreProducts] =
    useState(false);

  const [productLoadError, setProductLoadError] =
    useState("");

  const visibleProducts =
    useMemo(() => {
      const search = query
        .trim()
        .toLowerCase();

      return [...availableProducts]
        .filter((product) => {
          if (!search) {
            return true;
          }

          return `${product.name} ${product.slug} ${product.brand}`
            .toLowerCase()
            .includes(search);
        })
        .sort(
          (a, b) =>
            Number(
              selected.includes(b.id),
            ) -
              Number(
                selected.includes(a.id),
              ) ||
            a.name.localeCompare(
              b.name,
            ),
        );
    }, [
      availableProducts,
      query,
      selected,
    ]);

  async function handleLoadMoreProducts() {

    if (loadingMoreProducts) {
      return;
    }

    if (
      productPage >=
      productTotalPages
    ) {
      return;
    }

    const nextPage =
      productPage + 1;

    setLoadingMoreProducts(true);
    setProductLoadError("");

    try {
      const result =
        await loadCollectionEditProducts(
          nextPage,
          productPagination?.limit ?? 50,
        );

      const nextProducts: ProductOption[] =
        result.data
          .filter(
            (product) =>
              Boolean(product.id),
          )
          .map((product) => ({
            id: product.id,
            name: product.name,
            slug: product.slug,
            brand: "",
          }));

      setAvailableProducts(
        (current) => {
          const existingIds =
            new Set(
              current.map(
                (product) =>
                  product.id,
              ),
            );

          const uniqueProducts =
            nextProducts.filter(
              (product) =>
                !existingIds.has(
                  product.id,
                ),
            );

          return [
            ...current,
            ...uniqueProducts,
          ];
        },
      );

      setProductPage(
        result.pagination.page,
      );

      setProductTotalPages(
        result.pagination.totalPages,
      );
    } catch (error) {
      setProductLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load more products.",
      );
    } finally {
      setLoadingMoreProducts(
        false,
      );
    }
  }

  function toggleProduct(
    productId: string,
  ) {
    if (
      selected.includes(productId)
    ) {
      onSelectionChange(
        selected.filter(
          (id) =>
            id !== productId,
        ),
      );
      return;
    }

    onSelectionChange([
      ...selected,
      productId,
    ]);
  }

  return (
    <section
      className={
        styles.collectionProducts
      }
    >
      <label>
        Search products

        <input
          type="search"
          placeholder="Search name or slug"
          value={query}
          onChange={(event) =>
            setQuery(
              event.target.value,
            )
          }
          disabled={pending}
        />
      </label>

      <small>
        {selected.length}{" "}
        {selected.length === 1
          ? "product"
          : "products"}{" "}
        selected · selected products
        are shown first
      </small>

      <div
        className={
          styles.productChoices
        }
      >
        {visibleProducts.map(
          (product) => (
            <label
              key={product.id}
            >
              <input
                type="checkbox"
                checked={selected.includes(
                  product.id,
                )}
                onChange={() =>
                  toggleProduct(
                    product.id,
                  )
                }
                disabled={pending}
              />

              <span>
                {product.name}

                <small>
                  {[
                    product.brand,
                    product.slug,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </span>
            </label>
          ),
        )}

        {!visibleProducts.length && (
          <div>
            <strong>
              No products found
            </strong>

            <small>
              Try a different
              search.
            </small>
          </div>
        )}
      </div>

      {productPage <
          productTotalPages && (
          <div>
            <button
              type="button"
              className={
                styles.secondary
              }
              onClick={
                handleLoadMoreProducts
              }
              disabled={
                pending ||
                loadingMoreProducts
              }
            >
              {loadingMoreProducts
                ? "Loading products…"
                : "Load more products"}
            </button>

            <small style={{ marginLeft: 8 }}>
              Showing{" "}
              {availableProducts.length}{" "}
              of{" "}
              {productPagination?.total ??
                availableProducts.length}{" "}
              products
            </small>
          </div>
        )}

      {productLoadError && (
        <p role="alert">
          {productLoadError}
        </p>
      )}
    </section>
  );
}