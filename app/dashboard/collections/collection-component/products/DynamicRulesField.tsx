"use client";

import {
  useEffect,
  useState,
} from "react";

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

export type DynamicRule =
  Omit<CollectionRule, "value"> & {
    id: number;
    value: string;
  };

type ProductOption = {
  id: string;
  name: string;
  slug: string;
  brand: string;
};

type Props = {
  rules: DynamicRule[];
  match: "ALL" | "ANY";
  pending: boolean;
  onRulesChange: (
    rules: DynamicRule[],
  ) => void;
  onMatchChange: (
    match: "ALL" | "ANY",
  ) => void;
};

export default function DynamicRulesField({
  rules,
  match,
  pending,
  onRulesChange,
  onMatchChange,
}: Props) {
  const [nextRuleId, setNextRuleId] =
    useState(
      rules.length,
    );

  const [
    previewProducts,
    setPreviewProducts,
  ] = useState<ProductOption[]>(
    [],
  );

  const [
    previewCount,
    setPreviewCount,
  ] = useState(0);

  const [
    previewPage,
    setPreviewPage,
  ] = useState(1);

  const [
    previewTotalPages,
    setPreviewTotalPages,
  ] = useState(1);

  const [
    previewLimit,
  ] = useState(50);

  const [
    previewLoading,
    setPreviewLoading,
  ] = useState(false);

  const [
    loadingMorePreview,
    setLoadingMorePreview,
  ] = useState(false);

  const [
    previewError,
    setPreviewError,
  ] = useState("");

  function updateRule(
    id: number,
    patch: Partial<DynamicRule>,
  ) {
    onRulesChange(
      rules.map((rule) =>
        rule.id === id
          ? {
              ...rule,
              ...patch,
            }
          : rule,
      ),
    );
  }

  function removeRule(
    id: number,
  ) {
    onRulesChange(
      rules.filter(
        (rule) =>
          rule.id !== id,
      ),
    );
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

    setNextRuleId(
      (current) =>
        current + 1,
    );
  }

  useEffect(() => {
    const normalizedRules =
      rules.map(
        ({
          field,
          operator,
          value,
        }) => ({
          field,
          operator,
          value:
            collectionRuleValue(
              field,
              value,
            ),
        }),
      );

    const valid =
      normalizedRules.length > 0 &&
      normalizedRules.every(
        (rule) =>
          isValidCollectionRule(
            rule,
          ),
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

    /*
     * Whenever the rules or match
     * changes, start again from
     * page 1.
     */
    setPreviewProducts([]);
    setPreviewCount(0);
    setPreviewPage(1);
    setPreviewTotalPages(1);
    setPreviewError("");

    const timer =
      window.setTimeout(
        async () => {
          setPreviewLoading(true);

          try {
            const result =
              await previewCollection(
                match,
                normalizedRules,
                1,
                previewLimit,
              );

            if (cancelled) {
              return;
            }

            setPreviewProducts(
              result.data,
            );

            setPreviewCount(
              result.count,
            );

            setPreviewPage(
              result.pagination.page,
            );

            setPreviewTotalPages(
              result.pagination.totalPages,
            );

            setPreviewError(
              result.error ??
                "",
            );
          } catch (error) {
            if (cancelled) {
              return;
            }

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
        },
        350,
      );

    return () => {
      window.clearTimeout(timer);
      cancelled = true;
    };
  }, [
    rules,
    match,
    previewLimit,
  ]);

  async function handleLoadMorePreview() {
    if (previewLoading) {
      return;
    }

    if (loadingMorePreview) {
      return;
    }

    if (
      previewPage >=
      previewTotalPages
    ) {
      return;
    }

    const nextPage =
      previewPage + 1;

    const normalizedRules =
      rules.map(
        ({
          field,
          operator,
          value,
        }) => ({
          field,
          operator,
          value:
            collectionRuleValue(
              field,
              value,
            ),
        }),
      );

    if (
      !normalizedRules.every(
        (rule) =>
          isValidCollectionRule(
            rule,
          ),
      )
    ) {
      return;
    }

    setLoadingMorePreview(
      true,
    );

    setPreviewError("");

    try {
      const result =
        await previewCollection(
          match,
          normalizedRules,
          nextPage,
          previewLimit,
        );

      const nextProducts: ProductOption[] =
        result.data.filter(
          (product) =>
            Boolean(product.id),
        );

      setPreviewProducts(
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

      setPreviewPage(
        result.pagination.page,
      );

      setPreviewTotalPages(
        result.pagination.totalPages,
      );

      setPreviewCount(
        result.count,
      );

      setPreviewError(
        result.error ?? "",
      );
    } catch (error) {
      setPreviewError(
        error instanceof Error
          ? error.message
          : "Unable to load more matching products.",
      );
    } finally {
      setLoadingMorePreview(
        false,
      );
    }
  }

  return (
    <section
      className={
        styles.collectionProducts
      }
    >
      <label>
        Products must match

        <select
          value={match}
          onChange={(event) =>
            onMatchChange(
              event.target
                .value as
                | "ALL"
                | "ANY",
            )
          }
          disabled={pending}
        >
          <option value="ALL">
            All rules
          </option>

          <option value="ANY">
            Any rule
          </option>
        </select>
      </label>

      <small>
        Products will be selected
        automatically from these
        rules when the collection
        is saved.
      </small>

      {previewLoading && (
        <small>
          Checking matching
          products…
        </small>
      )}

      {previewError && (
        <p role="alert">
          {previewError}
        </p>
      )}

      {!previewLoading &&
        !previewError &&
        previewCount > 0 && (
          <small>
            {previewCount} matching{" "}
            {previewCount === 1
              ? "product"
              : "products"}
          </small>
        )}

      <div
        className={
          styles.ruleList
        }
      >
        {rules.map(
          (rule) => (
            <div
              className={
                styles.ruleRow
              }
              key={rule.id}
            >
              <select
                aria-label="Rule field"
                value={rule.field}
                onChange={(event) => {
                  const field =
                    event.target
                      .value as DynamicRule["field"];

                  const operators =
                    collectionRuleOperators[
                      field
                    ];

                  const operator =
                    operators.includes(
                      rule.operator,
                    )
                      ? rule.operator
                      : operators[0];

                  updateRule(
                    rule.id,
                    {
                      field,
                      operator,
                      value: "",
                    },
                  );
                }}
                disabled={pending}
              >
                {Object.entries(
                  collectionRuleLabels,
                ).map(
                  ([
                    field,
                    label,
                  ]) => (
                    <option
                      key={field}
                      value={field}
                    >
                      {label}
                    </option>
                  ),
                )}
              </select>

              <select
                aria-label="Rule operator"
                value={rule.operator}
                onChange={(event) =>
                  updateRule(
                    rule.id,
                    {
                      operator:
                        event.target
                          .value as DynamicRule["operator"],
                    },
                  )
                }
                disabled={pending}
              >
                {collectionRuleOperators[
                  rule.field
                ].map(
                  (operator) => (
                    <option
                      key={operator}
                      value={operator}
                    >
                      {
                        {
                          contains:
                            "Contains",
                          not_contains: "Does not contain",
                          equals:
                            "Equals",
                          not_equals: "Not equals",
                          greater_than:
                            "Greater than",
                          less_than:
                            "Less than",
                        }[
                          operator
                        ]
                      }
                    </option>
                  ),
                )}
              </select>

              <input
                required
                aria-label="Rule value"
                type={
                  isNumericCollectionField(
                    rule.field,
                  )
                    ? "number"
                    : "text"
                }
                step="any"
                placeholder={
                  rule.field ===
                  "tags"
                    ? rule.operator ===
                      "contains" || 
                      rule.operator === "not_contains"
                      ? "Part of a tag name"
                      : "Exact tag name"
                    : "Value"
                }
                value={rule.value}
                onChange={(event) =>
                  updateRule(
                    rule.id,
                    {
                      value:
                        event.target
                          .value,
                    },
                  )
                }
                disabled={pending}
              />

              <button
                type="button"
                onClick={() =>
                  removeRule(
                    rule.id,
                  )
                }
                disabled={
                  pending ||
                  rules.length === 1
                }
              >
                Remove
              </button>
            </div>
          ),
        )}
      </div>

      <button
        type="button"
        className={
          styles.secondary
        }
        disabled={pending}
        onClick={addRule}
      >
        + Add rule
      </button>

      {previewProducts.length >
        0 && (
        <>
          <div
            className={
              styles.productChoices
            }
            aria-label="Matching products"
          >
            {previewProducts.map(
              (product) => (
                <label
                  key={product.id}
                >
                  <input
                    type="checkbox"
                    checked
                    readOnly
                    aria-label={`${product.name} matches the collection rules`}
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
          </div>

          {previewPage <
            previewTotalPages && (
            <div>
              <button
                type="button"
                className={
                  styles.secondary
                }
                onClick={
                  handleLoadMorePreview
                }
                disabled={
                  pending ||
                  loadingMorePreview
                }
              >
                {loadingMorePreview
                  ? "Loading products…"
                  : "Load more matching products"}
              </button>

              <small style={{ marginLeft: 8 }}>
                Showing{" "}
                {previewProducts.length}{" "}
                of{" "}
                {previewCount}{" "}
                matching products
              </small>
            </div>
          )}
        </>
      )}
    </section>
  );
}