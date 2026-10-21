"use client";

import { useEffect, useMemo, useState } from "react";
import { loadCollectionEditProducts } from "@/lib/quitmed-retail-admin/collections/actions";
import styles from "../../../../components/dashboard.module.css";

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
  onSelectionChange: (ids: string[]) => void;

  // Pass all selected product records from the parent when available.
  selectedProductDetails?: ProductOption[];
};

type SelectedSort = "MANUAL" | "TITLE_ASC" | "TITLE_DESC";

export default function ManualProductsField({
  products,
  productPagination,
  selected,
  pending,
  onSelectionChange,
  selectedProductDetails = [],
}: Props) {
  const [query, setQuery] = useState("");
  const [selectedSort, setSelectedSort] =
    useState<SelectedSort>("MANUAL");
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const [availableProducts, setAvailableProducts] =
    useState<ProductOption[]>(() => [
      ...new Map(
        [...products, ...selectedProductDetails].map((p) => [
          p.id,
          p,
        ]),
      ).values(),
    ]);

  const [productPage, setProductPage] = useState(
    productPagination?.page ?? 1,
  );

  const [productTotalPages, setProductTotalPages] = useState(
    productPagination?.totalPages ?? 1,
  );

  const [loadingMoreProducts, setLoadingMoreProducts] =
    useState(false);

  const [productLoadError, setProductLoadError] = useState("");

  // Merge records supplied by the parent without discarding loaded pages.
  // Merge records supplied by the parent without discarding loaded pages.
  useEffect(() => {
    const incomingProducts = [
      ...products,
      ...selectedProductDetails,
    ];

    setAvailableProducts((current) => {
      const merged = new Map(
        current.map((product) => [product.id, product]),
      );

      let changed = false;

      for (const product of incomingProducts) {
        if (!product.id) continue;

        const existing = merged.get(product.id);

        // Don't replace an existing record with identical data.
        if (
          existing &&
          existing.name === product.name &&
          existing.slug === product.slug &&
          existing.brand === product.brand
        ) {
          continue;
        }

        merged.set(product.id, product);
        changed = true;
      }

      // Returning the same array reference prevents another render.
      if (!changed) {
        return current;
      }

      return Array.from(merged.values());
    });
  }, [products, selectedProductDetails]);

  const productMap = useMemo(
    () => new Map(availableProducts.map((p) => [p.id, p])),
    [availableProducts],
  );

  const selectedProducts = useMemo(() => {
    const ordered = selected.map(
      (id) =>
        productMap.get(id) ?? {
          id,
          name: "Product name unavailable",
          slug: "",
          brand: "",
        },
    );

    if (selectedSort === "TITLE_ASC") {
      return [...ordered].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    }

    if (selectedSort === "TITLE_DESC") {
      return [...ordered].sort((a, b) =>
        b.name.localeCompare(a.name),
      );
    }

    return ordered;
  }, [selected, productMap, selectedSort]);

  const visibleProducts = useMemo(() => {
    const search = query.trim().toLowerCase();

    return availableProducts
      .filter(
        (p) =>
          !search ||
          `${p.name} ${p.slug} ${p.brand}`
            .toLowerCase()
            .includes(search),
      )
      .filter((p) => !selected.includes(p.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [availableProducts, query, selected]);

  async function handleLoadMoreProducts() {
    if (
      loadingMoreProducts ||
      productPage >= productTotalPages
    ) {
      return;
    }

    setLoadingMoreProducts(true);
    setProductLoadError("");

    try {
      const result = await loadCollectionEditProducts(
        productPage + 1,
        productPagination?.limit ?? 50,
      );

      const nextProducts: ProductOption[] = result.data
        .filter((p) => Boolean(p.id))
        .map((p) => ({
          id: p.id,
          name: p.name || p.slug || "",
          slug: p.slug || "",
          brand: "",
        }));

      setAvailableProducts((current) => {
        const merged = new Map(current.map((p) => [p.id, p]));

        for (const product of nextProducts) {
          const existing = merged.get(product.id);

          merged.set(product.id, {
            ...existing,
            ...product,
            name: product.name || existing?.name || "",
            slug: product.slug || existing?.slug || "",
          });
        }

        return [...merged.values()];
      });

      setProductPage(result.pagination.page);
      setProductTotalPages(result.pagination.totalPages);
    } catch (error) {
      setProductLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load more products.",
      );
    } finally {
      setLoadingMoreProducts(false);
    }
  }

  function toggleProduct(id: string) {
    if (pending) return;

    if (selected.includes(id)) {
      onSelectionChange(selected.filter((item) => item !== id));
    } else {
      onSelectionChange([...selected, id]);
      setSelectedSort("MANUAL");
    }
  }

  function moveProduct(dragged: string, target: string) {
    if (
      pending ||
      dragged === target ||
      selectedSort !== "MANUAL"
    ) {
      return;
    }

    const next = [...selected];
    const from = next.indexOf(dragged);
    const to = next.indexOf(target);

    if (from < 0 || to < 0) return;

    next.splice(from, 1);
    next.splice(to, 0, dragged);
    onSelectionChange(next);
  }

  return (
    <div className={styles.manualProductsField}>
      <section className={styles.manualProductsSection}>
        <div className={styles.manualProductsHeader}>
          <div>
            <h3>Products in collection</h3>
            <p>{selected.length} selected</p>
          </div>

          <label className={styles.manualProductsSort}>
            <span>Sort selected:</span>
            <select
              value={selectedSort}
              onChange={(event) =>
                setSelectedSort(event.target.value as SelectedSort)
              }
              disabled={pending}
            >
              <option value="MANUAL">Manual order</option>
              <option value="TITLE_ASC">Name A–Z</option>
              <option value="TITLE_DESC">Name Z–A</option>
            </select>
          </label>
        </div>

        {selectedSort === "MANUAL" && (
          <p className={styles.manualProductsHint}>
            Drag and drop products to change their order. Save the
            collection to apply your changes.
          </p>
        )}

        {selected.length === 0 ? (
          <div className={styles.manualProductsEmpty}>
            No products selected yet. Add products below.
          </div>
        ) : (
          <div className={styles.manualProductsScroll}>
            <div className={styles.manualProductsGrid}>
              {selectedProducts.map((product, index) => (
                <div
                  key={product.id}
                  className={styles.manualProductCard}
                  draggable={!pending && selectedSort === "MANUAL"}
                  onDragStart={(event) => {
                    setDraggedId(product.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData(
                      "text/plain",
                      product.id,
                    );
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();

                    if (
                      draggedId &&
                      draggedId !== product.id &&
                      selectedSort === "MANUAL"
                    ) {
                      moveProduct(draggedId, product.id);
                    }
                  }}
                  onDrop={(event) => event.preventDefault()}
                  onDragEnd={() => setDraggedId(null)}
                >
                  <span className={styles.manualProductDragHandle}>
                    {selectedSort === "MANUAL" ? "⠿" : ""}
                  </span>

                  <div className={styles.manualProductDetails}>
                    <span className={styles.manualProductIndex}>
                      {index + 1}.
                    </span>

                    <span className={styles.manualProductName}>
                      {product.name}
                    </span>

                    {product.slug && (
                      <span className={styles.manualProductSlug}>
                        {product.slug}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    className={styles.manualProductAction}
                    onClick={() => toggleProduct(product.id)}
                    disabled={pending}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className={styles.manualProductsSection}>
        <div className={styles.manualProductsHeader}>
          <div>
            <h3>Add products</h3>
            <p>Search the catalog and add products to this collection.</p>
          </div>
        </div>

        <input
          className={styles.manualProductsSearch}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search products by name or slug..."
          disabled={pending}
        />

        <div className={styles.manualProductsScroll}>
          {visibleProducts.length === 0 ? (
            <div className={styles.manualProductsEmpty}>
              {query
                ? "No matching products on the loaded pages."
                : "No more available products on the loaded pages."}
            </div>
          ) : (
            <div className={styles.manualProductsGrid}>
              {visibleProducts.map((product) => (
                <div
                  key={product.id}
                  className={styles.manualProductCard}
                >
                  <div className={styles.manualProductDetails}>
                    <span className={styles.manualProductName}>
                      {product.name || product.slug || "Unnamed product"}
                    </span>

                    {product.slug && (
                      <span className={styles.manualProductSlug}>
                        {product.slug}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    className={styles.manualProductAction}
                    onClick={() => toggleProduct(product.id)}
                    disabled={pending}
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {productLoadError && (
          <p role="alert">{productLoadError}</p>
        )}

        {productPage < productTotalPages && (
          <button
            type="button"
            className={styles.manualProductsLoadMore}
            onClick={handleLoadMoreProducts}
            disabled={loadingMoreProducts || pending}
          >
            {loadingMoreProducts
              ? "Loading products..."
              : "Load more products"}
          </button>
        )}
      </section>
    </div>
  );
}
