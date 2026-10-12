
"use client";

import styles from "./discounts.module.css";
import ProductPicker, {
  type ProductOption,
} from "./ProductPicker";

type Props = {
  isBuyXGetY: boolean;
  applyToAllProducts: boolean;
  onApplyToAllProductsChange: (checked: boolean) => void;

  selectedProductIds: string[];
  onSelectedProductIdsChange: (ids: string[]) => void;

  selectedBuyProductIds: string[];
  onSelectedBuyProductIdsChange: (ids: string[]) => void;

  selectedGetProductIds: string[];
  onSelectedGetProductIdsChange: (ids: string[]) => void;

  productOptions: ProductOption[];
  knownProductOptions: ProductOption[];

  productSearch: string;
  onProductSearchChange: (value: string) => void;

  productsLoading: boolean;
  productHasMore: boolean;
  loadingMoreProducts: boolean;
  productOptionsError: string | null;

  onLoadMoreProducts: () => void;
  disabled: boolean;
};

export default function ProductEligibilitySection({
  isBuyXGetY,
  applyToAllProducts,
  onApplyToAllProductsChange,
  selectedProductIds,
  onSelectedProductIdsChange,
  selectedBuyProductIds,
  onSelectedBuyProductIdsChange,
  selectedGetProductIds,
  onSelectedGetProductIdsChange,
  productOptions,
  knownProductOptions,
  productSearch,
  onProductSearchChange,
  productsLoading,
  productHasMore,
  loadingMoreProducts,
  productOptionsError,
  onLoadMoreProducts,
  disabled,
}: Props) {
  return (
    <section className={styles.formSection}>
      <h2 className={styles.sectionTitle}>Product eligibility</h2>

      <p className={styles.sectionDescription}>
        Choose which products this discount targets.
      </p>

      {!isBuyXGetY && (
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={applyToAllProducts}
            disabled={productsLoading || Boolean(productOptionsError)}
            onChange={(event) =>
              onApplyToAllProductsChange(event.target.checked)
            }
          />

          <span>
            <strong>Apply to all products</strong>
            <br />
            When enabled, no specific product restriction is applied.
          </span>
        </label>
      )}

      {(!applyToAllProducts || isBuyXGetY) && (
        <>
          {!isBuyXGetY ? (
            <ProductPicker
              id="discount-products"
              label="Eligible products"
              selectedIds={selectedProductIds}
              options={productOptions}
              knownOptions={knownProductOptions}
              search={productSearch}
              onSearchChange={onProductSearchChange}
              disabled={disabled}
              isLoading={productsLoading}
              hasMore={productHasMore}
              loadingMore={loadingMoreProducts}
              error={productOptionsError}
              onLoadMore={onLoadMoreProducts}
              onChange={onSelectedProductIdsChange}
            />
          ) : (
            <>
              <ProductPicker
                id="buy-products"
                label="Buy products"
                selectedIds={selectedBuyProductIds}
                options={productOptions}
                knownOptions={knownProductOptions}
                search={productSearch}
                onSearchChange={onProductSearchChange}
                disabled={disabled}
                isLoading={productsLoading}
                hasMore={productHasMore}
                loadingMore={loadingMoreProducts}
                error={productOptionsError}
                onLoadMore={onLoadMoreProducts}
                onChange={onSelectedBuyProductIdsChange}
              />

              <ProductPicker
                id="get-products"
                label="Get products"
                selectedIds={selectedGetProductIds}
                options={productOptions}
                knownOptions={knownProductOptions}
                search={productSearch}
                onSearchChange={onProductSearchChange}
                disabled={disabled}
                isLoading={productsLoading}
                hasMore={productHasMore}
                loadingMore={loadingMoreProducts}
                error={productOptionsError}
                onLoadMore={onLoadMoreProducts}
                onChange={onSelectedGetProductIdsChange}
              />
            </>
          )}
        </>
      )}

      <p className={styles.help}>
        Saving a product-scope discount replaces its existing product and
        variant assignments with the selections above.
      </p>
    </section>
  );
}
