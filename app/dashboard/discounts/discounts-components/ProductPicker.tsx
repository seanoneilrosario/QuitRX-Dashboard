
"use client";

import { useState } from "react";
import styles from "./discounts.module.css";

export type ProductOption = {
  id: string;
  label: string;
};

type ProductPickerProps = {
  id: string;
  label: string;
  selectedIds: string[];
  options: ProductOption[];
  knownOptions: ProductOption[];
  search: string;
  onSearchChange: (value: string) => void;
  disabled: boolean;
  isLoading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  error: string | null;
  onLoadMore: () => void;
  onChange: (ids: string[]) => void;
};

export default function ProductPicker({
  id,
  label,
  selectedIds,
  options,
  knownOptions,
  search,
  onSearchChange,
  disabled,
  isLoading,
  hasMore,
  loadingMore,
  error,
  onLoadMore,
  onChange,
}: ProductPickerProps) {
  const [pendingProductId, setPendingProductId] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  function getProductLabel(productId: string) {
    return (
      [...options, ...knownOptions].find(
        (product) => product.id === productId,
      )?.label ?? `Product ${productId}`
    );
  }

  function addSelectedProduct() {
    if (
      !pendingProductId ||
      selectedIds.includes(pendingProductId)
    ) {
      return;
    }

    onChange([...selectedIds, pendingProductId]);
    setPendingProductId("");
  }

  return (
    <div
      className={`${styles.field} ${styles.fullWidth} ${styles.martop}`}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget as Node | null;

        if (
          !nextTarget ||
          !event.currentTarget.contains(nextTarget)
        ) {
          setIsOpen(false);
        }
      }}
    >
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>

      <div className={styles.pickerRow}>
        <div className={styles.pickerInputWrap}>
          <input
            id={id}
            className={styles.input}
            type="search"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={`${id}-options`}
            aria-autocomplete="list"
            autoComplete="off"
            placeholder="Search or select a product..."
            value={search}
            disabled={disabled}
            onFocus={() => setIsOpen(true)}
            onClick={() => setIsOpen(true)}
            onChange={(event) => {
              onSearchChange(event.target.value);
              setIsOpen(true);
              setPendingProductId("");
            }}
          />

          {isOpen && !disabled && (
            <div
              id={`${id}-options`}
              role="listbox"
              className={styles.pickerDropdown}
            >
              {isLoading ? (
                <p className={styles.pickerMessage}>
                  Searching products…
                </p>
              ) : error ? (
                <p className={styles.pickerMessage} role="alert">
                  {error}
                </p>
              ) : options.length === 0 ? (
                <p className={styles.pickerMessage}>
                  No products found.
                </p>
              ) : (
                options.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    role="option"
                    aria-selected={pendingProductId === product.id}
                    disabled={selectedIds.includes(product.id)}
                    className={styles.pickerOption}
                    onClick={() => {
                      setPendingProductId(product.id);
                      setIsOpen(false);
                    }}
                  >
                    {product.label}
                    {selectedIds.includes(product.id)
                      ? " — Added"
                      : ""}
                  </button>
                ))
              )}

              {!isLoading && !error && hasMore && (
                <button
                  type="button"
                  className={styles.pickerLoadMore}
                  onMouseDown={(event) => event.preventDefault()}
                  disabled={loadingMore}
                  onClick={onLoadMore}
                >
                  {loadingMore
                    ? "Loading more…"
                    : "Load more products"}
                </button>
              )}
            </div>
          )}
        </div>

        <button
          className={styles.secondaryButton}
          type="button"
          disabled={
            disabled ||
            isLoading ||
            !pendingProductId ||
            selectedIds.includes(pendingProductId)
          }
          onClick={addSelectedProduct}
        >
          Add product
        </button>
      </div>

      
        {pendingProductId && (
        <p className={styles.help}>
            Selected to add: {getProductLabel(pendingProductId)}
        </p>
        )}

        <div className={styles.selectionHeader}>
        <span className={styles.selectionTitle}>
            Selected products
        </span>

        <span className={styles.selectionCount}>
            {selectedIds.length} selected
        </span>
        </div>

        {selectedIds.length === 0 ? (
        <div className={styles.selectionEmpty}>
            No products selected yet. Search above to add one.
        </div>
        ) : (
        <div className={styles.selectionList}>
            {selectedIds.map((productId) => {
            const label = getProductLabel(productId);

            return (
                <div className={styles.selectionChip} key={productId}>
                <span
                    className={styles.selectionChipIcon}
                    aria-hidden="true"
                >
                    ▦
                </span>

                <span className={styles.selectionChipLabel}>
                    {label}
                </span>

                <button
                    className={styles.selectionRemoveButton}
                    type="button"
                    disabled={disabled}
                    aria-label={`Remove ${label}`}
                    onClick={() =>
                    onChange(
                        selectedIds.filter((id) => id !== productId),
                    )
                    }
                >
                    <span aria-hidden="true">×</span>
                </button>
                </div>
            );
            })}
        </div>
        )}

    </div>
  );
}
