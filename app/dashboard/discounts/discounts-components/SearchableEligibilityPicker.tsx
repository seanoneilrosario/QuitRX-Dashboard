
"use client";

import { useEffect, useState } from "react";
import styles from "./discounts.module.css";

import {
  searchDiscountCustomersAction,
  searchDiscountSegmentsAction,
  type EligibilityOption,
} from "@/lib/quitmed-retail-admin/discounts/eligibility-actions";

type PickerKind = "customer" | "segment";

type Props = {
  kind: PickerKind;
  label: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  initialOptions?: EligibilityOption[];
  disabled?: boolean;
};

function mergeOptions(
  current: EligibilityOption[],
  incoming: EligibilityOption[],
): EligibilityOption[] {
  const map = new Map<string, EligibilityOption>();

  for (const option of [...current, ...incoming]) {
    map.set(option.id, option);
  }

  return Array.from(map.values());
}

export default function SearchableEligibilityPicker({
  kind,
  label,
  selectedIds,
  onChange,
  initialOptions = [],
  disabled = false,
}: Props) {
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<EligibilityOption[]>([]);
  const [knownOptions, setKnownOptions] =
    useState<EligibilityOption[]>(initialOptions);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pendingId, setPendingId] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setKnownOptions((current) =>
      mergeOptions(current, initialOptions),
    );
  }, [initialOptions]);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);
    setPage(1);
    setHasMore(false);

    const timer = window.setTimeout(async () => {
      try {
        const result =
          kind === "customer"
            ? await searchDiscountCustomersAction(search, 1)
            : await searchDiscountSegmentsAction(search, 1);

        if (cancelled) return;

        if (!result.success) {
          setOptions([]);
          setHasMore(false);
          setError(
            result.message ?? `Unable to load ${kind}s.`,
          );
          return;
        }

        setOptions(result.data);

        setKnownOptions((current) =>
          mergeOptions(current, result.data),
        );

        setPage(result.page);
        setHasMore(result.hasMore);
      } catch (requestError) {
        if (!cancelled) {
          setOptions([]);
          setHasMore(false);
          setError(
            requestError instanceof Error
              ? requestError.message
              : `Unable to load ${kind}s.`,
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [kind, search]);

  async function loadMore() {
    if (!hasMore || loadingMore || isLoading) return;

    setLoadingMore(true);
    setError(null);

    try {
      const result =
        kind === "customer"
          ? await searchDiscountCustomersAction(search, page + 1)
          : await searchDiscountSegmentsAction(search, page + 1);

      if (!result.success) {
        setError(
          result.message ?? `Unable to load more ${kind}s.`,
        );
        return;
      }

      setOptions((current) =>
        mergeOptions(current, result.data),
      );

      setKnownOptions((current) =>
        mergeOptions(current, result.data),
      );

      setPage(result.page);
      setHasMore(result.hasMore);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : `Unable to load more ${kind}s.`,
      );
    } finally {
      setLoadingMore(false);
    }
  }

  function getLabel(id: string) {
    return (
      [...options, ...knownOptions].find(
        (option) => option.id === id,
      )?.label ?? `${kind === "customer" ? "Customer" : "Segment"} ${id}`
    );
  }

  function addSelection() {
    if (!pendingId || selectedIds.includes(pendingId)) return;

    onChange([...selectedIds, pendingId]);
    setPendingId("");
  }

  const noun = kind === "customer" ? "customer" : "segment";

  return (
    <div
      className={`${styles.field} ${styles.fullWidth} ${styles.martop}`}
      onBlur={(event) => {
        const target = event.relatedTarget as Node | null;

        if (!target || !event.currentTarget.contains(target)) {
          setIsOpen(false);
        }
      }}
    >
      <label className={styles.label}>
        {label}
      </label>

      <div className={styles.pickerRow}>
        <div className={styles.pickerInputWrap}>
          <input
            className={styles.input}
            type="search"
            role="combobox"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            autoComplete="off"
            placeholder={`Search or select a ${noun}...`}
            value={search}
            disabled={disabled}
            onFocus={() => setIsOpen(true)}
            onClick={() => setIsOpen(true)}
            onChange={(event) => {
              setSearch(event.target.value);
              setPendingId("");
              setIsOpen(true);
            }}
          />

          {isOpen && !disabled && (
            <div
              role="listbox"
              className={styles.pickerDropdown}
            >
              {isLoading ? (
                <p className={styles.pickerMessage}>
                  Searching {kind}s…
                </p>
              ) : error ? (
                <p className={styles.pickerMessage} role="alert">
                  {error}
                </p>
              ) : options.length === 0 ? (
                <p className={styles.pickerMessage}>
                  No {kind}s found.
                </p>
              ) : (
                options.map((option) => {
                  const alreadySelected =
                    selectedIds.includes(option.id);

                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="option"
                      aria-selected={pendingId === option.id}
                      disabled={alreadySelected}
                      className={styles.pickerOption}
                      onClick={() => {
                        setPendingId(option.id);
                        setIsOpen(false);
                      }}
                    >
                      {option.label}
                      {alreadySelected ? " — Added" : ""}
                    </button>
                  );
                })
              )}

              {!isLoading && !error && hasMore && (
                <button
                type="button"
                className={styles.pickerLoadMore}
                disabled={loadingMore}
                onMouseDown={(event) => event.preventDefault()}
                onClick={loadMore}
                >
                {loadingMore ? "Loading more…" : `Load more ${kind}s`}
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
            !pendingId ||
            selectedIds.includes(pendingId)
          }
          onClick={addSelection}
        >
          Add {noun}
        </button>
      </div>

      {pendingId && (
        <p className={styles.help}>
          Selected to add: {getLabel(pendingId)}
        </p>
      )}

      
        <div className={styles.selectionHeader}>
            <span className={styles.selectionTitle}>
                Selected {kind === "customer" ? "customers" : "segments"}
            </span>

            <span className={styles.selectionCount}>
                {selectedIds.length} selected
            </span>
        </div>

        {selectedIds.length === 0 ? (
            <div className={styles.selectionEmpty}>
                No {kind}s selected yet. Search above to add one.
            </div>
        ) : (
            <div className={styles.selectionList}>
                {selectedIds.map((id) => (
                <div className={styles.selectionChip} key={id}>
                    <span className={styles.selectionChipIcon} aria-hidden="true">
                    {kind === "customer" ? "👤" : "👥"}
                    </span>

                    <span className={styles.selectionChipLabel}>
                    {getLabel(id)}
                    </span>

                    <button
                    className={styles.selectionRemoveButton}
                    type="button"
                    disabled={disabled}
                    aria-label={`Remove ${getLabel(id)}`}
                    onClick={() =>
                        onChange(
                        selectedIds.filter((selectedId) => selectedId !== id),
                        )
                    }
                    >
                    <span aria-hidden="true">×</span>
                    </button>
                </div>
                ))}
            </div>
        )}

    </div>
  );
}
