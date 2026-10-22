
"use client";

import { useEffect, useRef, useState } from "react";

import {
  previewCollection,
} from "@/lib/quitmed-retail-admin/collections/actions";

import {
  collectionRuleLabels,
  collectionRuleOperators,
  collectionRuleValue,
  isNumericCollectionField,
  isValidCollectionRule,
  type CollectionRule,
} from "@/lib/quitmed-retail-admin/collections/collection-products";

import styles from "@/app/components/dashboard.module.css";

export type DynamicRule = Omit<CollectionRule, "value"> & {
  id: number;
  value: string;
};

type ProductOption = {
  id: string;
  name: string;
  slug: string;
  brand: string;
};

type PreviewSort =
  | "RELEVANCE"
  | "MANUAL"
  | "BEST_SELLING"
  | "TITLE_ASC"
  | "TITLE_DESC"
  | "PRICE_ASC"
  | "PRICE_DESC"
  | "NEWEST"
  | "OLDEST";

type Props = {
  rules: DynamicRule[];
  match: "ALL" | "ANY";
  pending: boolean;
  onRulesChange: (rules: DynamicRule[]) => void;
  onMatchChange: (match: "ALL" | "ANY") => void;
};

export default function DynamicRulesField({
  rules,
  match,
  pending,
  onRulesChange,
  onMatchChange,
}: Props) {
  const [sortBy, setSortBy] =
    useState<PreviewSort>("MANUAL");

  const [draggedProductId, setDraggedProductId] =
    useState<string | null>(null);

  const [dragOverProductId, setDragOverProductId] =
    useState<string | null>(null);

  const [nextRuleId, setNextRuleId] =
    useState(rules.length);

  const [previewProducts, setPreviewProducts] =
    useState<ProductOption[]>([]);

  const previewListRef = useRef<HTMLDivElement | null>(null);

  async function loadAllMatchingProducts() {
    const normalizedRules = rules.map(
      ({ field, operator, value }) => ({
        field,
        operator,
        value: collectionRuleValue(field, value),
      }),
    );

    if (
      normalizedRules.length === 0 ||
      !normalizedRules.every(isValidCollectionRule)
    ) {
      return;
    }

    setPreviewLoading(true);
    setPreviewError("");

    try {
      const allProducts: ProductOption[] = [];
      const seenIds = new Set<string>();

      let page = 1;
      let totalPages = 1;

      do {
        const result = await previewCollection(
          match,
          normalizedRules,
          page,
          100,
          sortBy === "MANUAL" ? "TITLE_ASC" : sortBy,
        );

        for (const product of result.data) {
          if (product.id && !seenIds.has(product.id)) {
            seenIds.add(product.id);
            allProducts.push(product);
          }
        }

        totalPages = result.pagination.totalPages;
        page++;
      } while (page <= totalPages);

      setPreviewProducts(allProducts);
      setPreviewCount(allProducts.length);
      setPreviewPage(totalPages);
      setPreviewTotalPages(totalPages);
    } catch (error) {
      setPreviewError(
        error instanceof Error
          ? error.message
          : "Unable to load all matching products.",
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  function handlePreviewDragOver(
    event: React.DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault();

    if (!draggedProductId || sortBy !== "MANUAL") {
      return;
    }

    const container = previewListRef.current;

    if (!container) return;

    const rect = container.getBoundingClientRect();
    const pointerY = event.clientY;

    // Start scrolling when the pointer is within 80px
    // of the top or bottom edge of the list.
    const edgeSize = 80;
    const scrollSpeed = 18;

    if (pointerY < rect.top + edgeSize) {
      container.scrollTop -= scrollSpeed;
    } else if (pointerY > rect.bottom - edgeSize) {
      container.scrollTop += scrollSpeed;
    }
  }
    

  const [previewCount, setPreviewCount] = useState(0);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewTotalPages, setPreviewTotalPages] = useState(1);
  const [previewLimit] = useState(50);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loadingMorePreview, setLoadingMorePreview] = useState(false);
  const [previewError, setPreviewError] = useState("");

  function updateRule(
    id: number,
    patch: Partial<DynamicRule>,
  ) {
    onRulesChange(
      rules.map((rule) =>
        rule.id === id ? { ...rule, ...patch } : rule,
      ),
    );
  }

  function removeRule(id: number) {
    onRulesChange(rules.filter((rule) => rule.id !== id));
  }

  function addRule() {
    onRulesChange([
      ...rules,
      {
        id: nextRuleId,
        field: "tags",
        operator: "equals",
        value: "",
      },
    ]);

    setNextRuleId((current) => current + 1);
  }

  function movePreviewProduct(
    draggedId: string,
    targetId: string,
  ) {
    setPreviewProducts((current) => {
      const from = current.findIndex((p) => p.id === draggedId);
      const to = current.findIndex((p) => p.id === targetId);

      if (from < 0 || to < 0 || from === to) {
        return current;
      }

      const reordered = [...current];
      const [moved] = reordered.splice(from, 1);
      reordered.splice(to, 0, moved);

      return reordered;
    });
  }

  useEffect(() => {
    const normalizedRules = rules.map(
      ({ field, operator, value }) => ({
        field,
        operator,
        value: collectionRuleValue(field, value),
      }),
    );

    const valid =
      normalizedRules.length > 0 &&
      normalizedRules.every((rule) =>
        isValidCollectionRule(rule),
      );

    if (!valid) {
      setPreviewProducts([]);
      setPreviewCount(0);
      setPreviewPage(1);
      setPreviewTotalPages(1);
      setPreviewError("");
      setPreviewLoading(false);
      setLoadingMorePreview(false);
      return;
    }

    let cancelled = false;

    setPreviewProducts([]);
    setPreviewCount(0);
    setPreviewPage(1);
    setPreviewTotalPages(1);
    setPreviewError("");

    const timer = window.setTimeout(async () => {
      setPreviewLoading(true);

      try {
        // Manual order is applied locally. Fetch the default order
        // from the API rather than sending MANUAL as a backend sort.
        const apiSortBy =
          sortBy === "MANUAL" ? "RELEVANCE" : sortBy;

        const result = await previewCollection(
          match,
          normalizedRules,
          1,
          previewLimit,
          apiSortBy,
        );

        if (cancelled) return;

        setPreviewProducts(result.data);
        setPreviewCount(result.count);
        setPreviewPage(result.pagination.page);
        setPreviewTotalPages(result.pagination.totalPages);
        setPreviewError(result.error ?? "");
      } catch (error) {
        if (cancelled) return;

        setPreviewProducts([]);
        setPreviewCount(0);
        setPreviewPage(1);
        setPreviewTotalPages(1);

        setPreviewError(
          error instanceof Error
            ? error.message
            : "Unable to preview collection products.",
        );
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      cancelled = true;
    };
  }, [rules, match, previewLimit]);

  async function handleLoadMorePreview() {
    if (
      previewLoading ||
      loadingMorePreview ||
      previewPage >= previewTotalPages
    ) {
      return;
    }

    const normalizedRules = rules.map(
      ({ field, operator, value }) => ({
        field,
        operator,
        value: collectionRuleValue(field, value),
      }),
    );

    if (
      !normalizedRules.every((rule) =>
        isValidCollectionRule(rule),
      )
    ) {
      return;
    }

    setLoadingMorePreview(true);
    setPreviewError("");

    try {
      const apiSortBy =
        sortBy === "MANUAL" ? "RELEVANCE" : sortBy;

      const result = await previewCollection(
        match,
        normalizedRules,
        previewPage + 1,
        previewLimit,
        apiSortBy,
      );

      const nextProducts: ProductOption[] =
        result.data.filter((product) => Boolean(product.id));

      setPreviewProducts((current) => {
        const existingIds = new Set(
          current.map((product) => product.id),
        );

        return [
          ...current,
          ...nextProducts.filter(
            (product) => !existingIds.has(product.id),
          ),
        ];
      });

      setPreviewPage(result.pagination.page);
      setPreviewTotalPages(result.pagination.totalPages);
      setPreviewCount(result.count);
      setPreviewError(result.error ?? "");
    } catch (error) {
      setPreviewError(
        error instanceof Error
          ? error.message
          : "Unable to load more matching products.",
      );
    } finally {
      setLoadingMorePreview(false);
    }
  }

  return (
    <section className={styles.collectionProducts}>
      {/* Submit these values with the existing collection form. */}
      <input
        type="hidden"
        name="sortBy"
        value={sortBy}
      />

      <input
        type="hidden"
        name="manualProductIds"
        value={JSON.stringify(
          sortBy === "MANUAL"
            ? previewProducts.map((product) => product.id)
            : []
        )}
      />

      <label>
        Products must match

        <select
          value={match}
          onChange={(event) =>
            onMatchChange(
              event.target.value as "ALL" | "ANY",
            )
          }
          disabled={pending}
        >
          <option value="ALL">All rules</option>
          <option value="ANY">Any rule</option>
        </select>
      </label>

      <small>
        Products will be selected automatically from these rules
        when the collection is saved.
      </small>

      <div className={styles.ruleList}>
        {rules.map((rule) => (
          <div className={styles.ruleRow} key={rule.id}>
            <select
              aria-label="Rule field"
              value={rule.field}
              onChange={(event) => {
                const field =
                  event.target.value as DynamicRule["field"];

                const operators = collectionRuleOperators[field];

                const operator = operators.includes(rule.operator)
                  ? rule.operator
                  : operators[0];

                updateRule(rule.id, {
                  field,
                  operator,
                  value: "",
                });
              }}
              disabled={pending}
            >
              {Object.entries(collectionRuleLabels).map(
                ([field, label]) => (
                  <option key={field} value={field}>
                    {label}
                  </option>
                ),
              )}
            </select>

            <select
              aria-label="Rule operator"
              value={rule.operator}
              onChange={(event) =>
                updateRule(rule.id, {
                  operator:
                    event.target.value as DynamicRule["operator"],
                })
              }
              disabled={pending}
            >
              {collectionRuleOperators[rule.field].map(
                (operator) => (
                  <option key={operator} value={operator}>
                    {{
                      contains: "Contains",
                      not_contains: "Does not contain",
                      equals: "Equals",
                      not_equals: "Not equals",
                      greater_than: "Greater than",
                      less_than: "Less than",
                    }[operator]}
                  </option>
                ),
              )}
            </select>

            <input
              required
              aria-label="Rule value"
              type={
                isNumericCollectionField(rule.field)
                  ? "number"
                  : "text"
              }
              step="any"
              placeholder={
                rule.field === "tags"
                  ? rule.operator === "contains" ||
                    rule.operator === "not_contains"
                    ? "Part of a tag name"
                    : "Exact tag name"
                  : "Value"
              }
              value={rule.value}
              onChange={(event) =>
                updateRule(rule.id, {
                  value: event.target.value,
                })
              }
              disabled={pending}
            />

            <button
              type="button"
              onClick={() => removeRule(rule.id)}
              disabled={pending || rules.length === 1}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className={styles.secondary}
        disabled={pending}
        onClick={addRule}
      >
        + Add rule
      </button>

      {previewLoading && (
        <small>Checking matching products…</small>
      )}

      {previewError && (
        <p role="alert">{previewError}</p>
      )}

      {!previewLoading && !previewError && (
        <small>
          {previewCount} matching{" "}
          {previewCount === 1 ? "product" : "products"}
        </small>
      )}

      <div>
        <label htmlFor="dynamic-preview-sort">
          Sort matching products
        </label>

        <select
          id="dynamic-preview-sort"
          value={sortBy}
          onChange={async (event) => {
            const nextSort = event.target.value as PreviewSort;

            setSortBy(nextSort);

            if (nextSort === "MANUAL") {
              await loadAllMatchingProducts();
            }
          }}
          disabled={pending || previewLoading || loadingMorePreview}
        >
          <option value="RELEVANCE">Default (A–Z)</option>
          <option value="MANUAL">Manual (drag and drop)</option>
          <option value="BEST_SELLING">Best-selling</option>
          <option value="TITLE_ASC">Title: A–Z</option>
          <option value="TITLE_DESC">Title: Z–A</option>
          <option value="PRICE_ASC">Price: low to high</option>
          <option value="PRICE_DESC">Price: high to low</option>
          <option value="NEWEST">Newest</option>
          <option value="OLDEST">Oldest</option>
        </select>
      </div>

      {sortBy === "MANUAL" && (
        <small>
          Drag products to change their order. Load more products
          to include additional products in the preview.
        </small>
      )}

      {previewProducts.length > 0 && (
        <>
          <div
            ref={previewListRef}
            className={styles.productChoices}
            aria-label="Matching products"
            onDragOver={handlePreviewDragOver}
            style={{
              maxHeight: sortBy === "MANUAL" ? 620 : undefined,
              overflowY: sortBy === "MANUAL" ? "auto" : undefined,
              padding: sortBy === "MANUAL" ? 8 : undefined,
              border:
                sortBy === "MANUAL"
                  ? "1px solid #ddd"
                  : undefined,
              borderRadius: sortBy === "MANUAL" ? 8 : undefined,
            }}
          >
            {previewProducts.map((product, index) =>
                sortBy === "MANUAL" ? (
                <div
                  key={product.id}
                  draggable={!pending}
                  onDragStart={(event) => {
                    setDraggedProductId(product.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", product.id);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";

                    if (
                      draggedProductId &&
                      draggedProductId !== product.id
                    ) {
                      setDragOverProductId(product.id);

                      // Move the product immediately as the dragged item
                      // crosses another product.
                      movePreviewProduct(
                        draggedProductId,
                        product.id,
                      );
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDraggedProductId(null);
                    setDragOverProductId(null);
                  }}
                  onDragEnd={() => {
                    setDraggedProductId(null);
                    setDragOverProductId(null);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px",
                    marginBottom: 6,
                    border: "1px solid #ddd",
                    borderRadius: 6,
                    background:
                      dragOverProductId === product.id
                        ? "#eef6ff"
                        : "#fff",
                    cursor: pending ? "default" : "grab",
                    opacity:
                      draggedProductId === product.id ? 0.45 : 1,
                    transition: "background 120ms ease, opacity 120ms ease",
                  }}
                >
                  <span
                    style={{
                      minWidth: 24,
                      fontWeight: 600,
                      color: "#666",
                    }}
                  >
                    {index + 1}.
                  </span>

                  <span
                    aria-hidden="true"
                    style={{
                      cursor: "grab",
                      fontSize: 22,
                      color: "#64748b",
                      flexShrink: 0,
                      userSelect: "none",
                    }}
                  >
                    ⠿
                  </span>

                  <span>
                    {product.name}

                    <small style={{ display: "block" }}>
                      {[product.brand, product.slug]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                </div>
              ) : (
                <label key={product.id}>
                  <input
                    type="checkbox"
                    checked
                    readOnly
                    aria-label={`${product.name} matches the collection rules`}
                  />

                  <span>
                    {product.name}

                    <small>
                      {[product.brand, product.slug]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                </label>
              ),
            )}
          </div>

          {previewPage < previewTotalPages && (
            <div>
              <button
                type="button"
                className={styles.secondary}
                onClick={handleLoadMorePreview}
                disabled={
                  pending ||
                  previewLoading ||
                  loadingMorePreview
                }
              >
                {loadingMorePreview
                  ? "Loading products…"
                  : "Load more matching products"}
              </button>

              <small style={{ marginLeft: 8 }}>
                Showing {previewProducts.length} of {previewCount}{" "}
                matching products
              </small>
            </div>
          )}
        </>
      )}
    </section>
  );
}
