"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  createCollection,
  previewCollection,
} from "../actions";

import {
  collectionProductIds,
  collectionRuleOperators,
  collectionRuleLabels,
  collectionRuleValue,
  isNumericCollectionField,
  isValidCollectionRule,
  type CollectionRule,
} from "@/lib/collection-products";

import styles from "./dashboard.module.css";
import { ActionButton } from "./action-controls";

type ProductOption = {
  id: string;
  name: string;
  slug: string;
  brand: string;
};

type Rule = Omit<CollectionRule, "value"> & {
  id: number;
  value: string;
};

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CollectionCreateFields({
  initial,
}: {
  initial?: Record<string, unknown>;
}) {
  const [name, setName] = useState(
    typeof initial?.name === "string" ? initial.name : "",
  );

  const [slug, setSlug] = useState(
    typeof initial?.slug === "string" ? initial.slug : "",
  );

  const [slugEdited, setSlugEdited] = useState(
    Boolean(initial?.slug),
  );

  const initialImage =
    typeof initial?.image === "string"
      ? initial.image
      : "";

  const [imagePreview, setImagePreview] = useState("");

  const imageInput = useRef<HTMLInputElement>(null);

  const previewUrl = useRef("");

  useEffect(() => {
    return () => {
      if (previewUrl.current) {
        URL.revokeObjectURL(previewUrl.current);
      }
    };
  }, []);

  return (
    <>
      <label>
        Collection name
        <input
          required
          name="name"
          value={name}
          onChange={(event) => {
            const nextName = event.target.value;

            setName(nextName);

            if (!slugEdited) {
              setSlug(slugify(nextName));
            }
          }}
        />
      </label>

      <label>
        Slug
        <input
          required
          name="slug"
          value={slug}
          onChange={(event) => {
            setSlugEdited(true);
            setSlug(slugify(event.target.value));
          }}
        />
      </label>

      <label className={styles.full}>
        Description
        <textarea
          name="description"
          defaultValue={
            typeof initial?.description === "string"
              ? initial.description
              : ""
          }
        />
      </label>

      <input
        type="hidden"
        name="_currentImage"
        value={initialImage}
      />

      <label className={styles.full}>
        Image

        <input
          ref={imageInput}
          type="file"
          name="_imageFile"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(event) => {
            if (previewUrl.current) {
              URL.revokeObjectURL(previewUrl.current);
            }

            const file = event.target.files?.[0];

            previewUrl.current = file
              ? URL.createObjectURL(file)
              : "";

            setImagePreview(previewUrl.current);
          }}
        />

        <small>
          JPEG, PNG, WebP or GIF, up to 4 MB.
          {initial?.image
            ? " Leave empty to keep the current image."
            : ""}
        </small>

        {(imagePreview || initialImage) && (
          // Local file previews use browser blob URLs without image optimization.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imagePreview || initialImage}
            alt={
              imagePreview
                ? "Selected collection image preview"
                : "Current collection image"
            }
            style={{
              display: "block",
              width: "100%",
              maxWidth: 280,
              height: 180,
              objectFit: "contain",
              borderRadius: 8,
            }}
          />
        )}
      </label>

      <label>
        SEO title
        <input
          name="seoTitle"
          defaultValue={
            typeof initial?.seoTitle === "string"
              ? initial.seoTitle
              : ""
          }
        />
      </label>

      <label>
        SEO description
        <input
          name="seoDescription"
          defaultValue={
            typeof initial?.seoDescription === "string"
              ? initial.seoDescription
              : ""
          }
        />
      </label>
    </>
  );
}

function initialRules(
  initial?: Record<string, unknown>,
): Rule[] {
  if (!Array.isArray(initial?.rules)) {
    return [
      {
        id: 0,
        field: "tags",
        operator: "equals",
        value: "",
      },
    ];
  }

  const rules = initial.rules.flatMap((rule, id) => {
    if (!rule || typeof rule !== "object") {
      return [];
    }

    const value = {
      ...rule,
    } as Record<string, unknown>;

    if (value.field === "tag") {
      value.field = "tags";
    }

    if (
      !Object.prototype.hasOwnProperty.call(
        collectionRuleOperators,
        String(value.field),
      ) ||
      ![
        "equals",
        "contains",
        "greater_than",
        "less_than",
      ].includes(String(value.operator))
    ) {
      return [];
    }

    return [
      {
        id,
        field: value.field as Rule["field"],
        operator: value.operator as Rule["operator"],
        value:
          typeof value.value === "string" ||
          typeof value.value === "number"
            ? String(value.value)
            : "",
      },
    ];
  });

  return rules.length
    ? rules
    : [
        {
          id: 0,
          field: "tags",
          operator: "equals",
          value: "",
        },
      ];
}

export function CollectionCreateForm({
  products,
  initial,
  onLoadMoreProducts,
  canLoadMoreProducts = false,
  loadingMoreProducts = false,
}: {
  products: ProductOption[];
  initial?: Record<string, unknown>;
  onLoadMoreProducts?: () => void | Promise<void>;
  canLoadMoreProducts?: boolean;
  loadingMoreProducts?: boolean;
}) {
  const [state, action, pending] = useActionState(
    createCollection,
    {
      message: "",
      success: false,
    },
  );

  const editing = typeof initial?.id === "string";

  const [type, setType] = useState<
    "MANUAL" | "DYNAMIC"
  >(
    initial?.type === "DYNAMIC"
      ? "DYNAMIC"
      : "MANUAL",
  );

  const [match, setMatch] = useState<
    "ALL" | "ANY"
  >(
    initial?.match === "ANY"
      ? "ANY"
      : "ALL",
  );

  const [query, setQuery] = useState("");

  const initialProductIds =
    collectionProductIds(initial);

  const [selected, setSelected] = useState<
    string[]
  >(() => initialProductIds);

  const [rules, setRules] = useState<Rule[]>(
    () => initialRules(initial),
  );

  const [nextRuleId, setNextRuleId] =
    useState(
      () => initialRules(initial).length,
    );

  // ----------------------------------------
  // Dynamic collection preview state
  // ----------------------------------------

  const [previewProducts, setPreviewProducts] =
    useState<ProductOption[]>([]);

  const [previewCount, setPreviewCount] =
    useState(0);

  const [previewPage, setPreviewPage] =
    useState(1);

  const [previewTotalPages, setPreviewTotalPages] =
    useState(0);

  const [previewLoading, setPreviewLoading] =
    useState(false);

  const [previewLoadingMore, setPreviewLoadingMore] =
    useState(false);

  const [previewError, setPreviewError] =
    useState("");

  // ----------------------------------------
  // Manual product search
  // ----------------------------------------

  async function loadMorePreviewProducts() {
    if (
      previewLoading ||
      previewLoadingMore ||
      previewPage >= previewTotalPages
    ) {
      return;
    }

    const nextPage =
      previewPage + 1;

    const normalizedRules = rules.map(
      ({ field, operator, value }) => ({
        field,
        operator,
        value: collectionRuleValue(
          field,
          value,
        ),
      }),
    );

    setPreviewLoadingMore(true);
    setPreviewError("");

    try {
      const result =
        await previewCollection(
          match,
          normalizedRules,
          nextPage,
          50,
        );

      setPreviewProducts(
        (current) => [
          ...current,
          ...result.data,
        ],
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
        result.error ?? "",
      );
    } catch (error) {
      setPreviewError(
        error instanceof Error
          ? error.message
          : "Unable to load more matching products.",
      );
    } finally {
      setPreviewLoadingMore(false);
    }
  }

  const visibleProducts = useMemo(() => {
    const search = query.trim().toLowerCase();

    return products
      .filter(
        (product) =>
          !search ||
          `${product.name} ${product.slug} ${product.brand}`
            .toLowerCase()
            .includes(search),
      )
      .sort(
        (a, b) =>
          Number(
            selected.includes(b.id),
          ) -
            Number(
              selected.includes(a.id),
            ) ||
          a.name.localeCompare(b.name),
      );
  }, [products, query, selected]);

  // ----------------------------------------
  // Dynamic preview
  // ----------------------------------------

  useEffect(() => {
    if (type !== "DYNAMIC") {
      setPreviewProducts([]);
      setPreviewCount(0);
      setPreviewPage(1);
      setPreviewTotalPages(0);
      setPreviewError("");
      setPreviewLoading(false);
      setPreviewLoadingMore(false);
      return;
    }

    const normalizedRules = rules.map(
      ({ field, operator, value }) => ({
        field,
        operator,
        value: collectionRuleValue(
          field,
          value,
        ),
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
      setPreviewTotalPages(0);
      setPreviewError("");
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(
      async () => {
        setPreviewLoading(true);
        setPreviewError("");

        try {
          const result =
            await previewCollection(
              match,
              normalizedRules,
              1,
              50,
            );

          if (cancelled) return;

          setPreviewProducts(result.data);
          setPreviewCount(result.count);

          setPreviewPage(
            result.pagination.page,
          );

          setPreviewTotalPages(
            result.pagination.totalPages,
          );

          setPreviewError(
            result.error ?? "",
          );
        } catch (error) {
          if (cancelled) return;

          setPreviewProducts([]);
          setPreviewCount(0);
          setPreviewPage(1);
          setPreviewTotalPages(0);

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
  }, [type, match, rules]);

  const updateRule = (
    id: number,
    patch: Partial<Rule>,
  ) => {
    setRules((current) =>
      current.map((rule) =>
        rule.id === id
          ? {
              ...rule,
              ...patch,
            }
          : rule,
      ),
    );
  };

  return (
    <form
      action={action}
      className={styles.form}
      // Prevent React from resetting the controlled fields.
      onReset={(event) =>
        event.preventDefault()
      }
    >
      <input
        type="hidden"
        name="_id"
        value={
          editing
            ? String(initial.id)
            : ""
        }
      />

      {editing &&
        initial?.type === "MANUAL" && (
          <input
            type="hidden"
            name="_initialProductIds"
            value={JSON.stringify(
              initialProductIds,
            )}
          />
        )}

      {Array.isArray(initial?.rules) &&
        initial.rules.some(
          (rule) =>
            rule &&
            typeof rule === "object" &&
            rule.field === "tag",
        ) && (
          <p role="status">
            This collection uses the old Tag
            field. Review the Tags rules and
            matching products, then save to
            update it. If an operator is
            unsupported, choose an available
            operator before saving.
          </p>
        )}

      <div className={styles.inlineForm}>
        <CollectionCreateFields
          initial={initial}
        />

        <fieldset
          className={`${styles.collectionMode} ${styles.full}`}
          disabled={pending}
        >
          <legend>Collection type</legend>

          <label>
            <input
              type="radio"
              name="type"
              value="MANUAL"
              checked={
                type === "MANUAL"
              }
              onChange={() =>
                setType("MANUAL")
              }
            />

            <span>
              Manual
              <small>
                Select individual products.
              </small>
            </span>
          </label>

          <label>
            <input
              type="radio"
              name="type"
              value="DYNAMIC"
              checked={
                type === "DYNAMIC"
              }
              onChange={() =>
                setType("DYNAMIC")
              }
            />

            <span>
              Dynamic
              <small>
                Include products using rules.
              </small>
            </span>
          </label>
        </fieldset>

        <input
          type="hidden"
          name="match"
          value={match}
        />

        <input
          type="hidden"
          name="productIds"
          value={JSON.stringify(
            type === "DYNAMIC"
              ? []
              : selected,
          )}
        />

        <input
          type="hidden"
          name="rules"
          value={JSON.stringify(
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
            ),
          )}
        />

        {type === "MANUAL" ? (
          <section
            className={
              styles.collectionProducts
            }
          >
            <label>
              Search products

              <input
                type="search"
                placeholder="Search name, slug or brand"
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
                  <label key={product.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(
                        product.id,
                      )}
                      onChange={() =>
                        setSelected(
                          (current) =>
                            current.includes(
                              product.id,
                            )
                              ? current.filter(
                                  (id) =>
                                    id !==
                                    product.id,
                                )
                              : [
                                  ...current,
                                  product.id,
                                ],
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
                    Try a different search.
                  </small>
                </div>
              )}
            </div>

            {canLoadMoreProducts && (
              <button
                type="button"
                className={styles.secondary}
                onClick={() => void onLoadMoreProducts?.()}
                disabled={
                  pending ||
                  loadingMoreProducts
                }
              >
                {loadingMoreProducts
                  ? "Loading…"
                  : "Load more products"}
              </button>
            )}
          </section>
        ) : (
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
                  setMatch(
                    event.target.value as
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
              {previewLoading
                ? "Checking matching products…"
                : `${previewCount} matching ${
                    previewCount === 1
                      ? "product"
                      : "products"
                  }`}
            </small>

            <div
              className={
                styles.ruleList
              }
            >
              {rules.map((rule) => (
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
                        event.target.value as Rule["field"];

                      const operators =
                        collectionRuleOperators[field] as readonly Rule["operator"][];

                      updateRule(rule.id, {
                        field,
                        operator: operators.includes(rule.operator)
                          ? rule.operator
                          : operators[0],
                        value: "",
                      });
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
                    value={
                      rule.operator
                    }
                    onChange={(event) =>
                      updateRule(
                        rule.id,
                        {
                          operator:
                            event.target
                              .value as Rule["operator"],
                        },
                      )
                    }
                    disabled={pending}
                  >
                    {!(
                      collectionRuleOperators[
                        rule.field
                      ] as readonly Rule["operator"][]
                    ).includes(rule.operator) && (
                      <option
                        value={
                          rule.operator
                        }
                        disabled
                      >
                        Unsupported operator:
                        choose another
                      </option>
                    )}

                    {(
                      collectionRuleOperators[
                        rule.field
                      ] as readonly Rule["operator"][]
                    ).map((operator) => (
                        <option
                          key={operator}
                          value={operator}
                        >
                          {
                            {
                              contains:
                                "Contains",
                              equals:
                                "Equals",
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
                    placeholder="Value"
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
                      setRules((current) =>
                        current.filter(
                          (item) =>
                            item.id !==
                            rule.id,
                        ),
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
              ))}
            </div>

            <button
              type="button"
              className={styles.secondary}
              disabled={pending}
              onClick={() => {
                setRules((current) => [
                  ...current,
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
              }}
            >
              + Add rule
            </button>

            {previewError && (
              <p role="alert">
                {previewError}
              </p>
            )}

            {!previewLoading &&
              !previewError && (
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
                              .filter(
                                Boolean,
                              )
                              .join(
                                " · ",
                              )}
                          </small>
                        </span>
                      </label>
                    ),
                  )}

                  {!previewProducts.length && (
                    <div>
                      <strong>
                        No matching
                        products
                      </strong>

                      <small>
                        Change the
                        rules to
                        include
                        products.
                      </small>
                    </div>
                  )}

                  {previewCount >
                    previewProducts.length && (
                    <small>
                      Showing {previewProducts.length} of{" "}
                      {previewCount} matching products.
                    </small>
                  )}

                  {previewPage < previewTotalPages && (
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={() =>
                        void loadMorePreviewProducts()
                      }
                      disabled={
                        pending ||
                        previewLoading ||
                        previewLoadingMore
                      }
                    >
                      {previewLoadingMore
                        ? "Loading…"
                        : "Load more products"}
                    </button>
                  )}
                </div>

                
              )}
          </section>
        )}
      </div>

      <ActionButton
        className={styles.primary}
        pending={pending}
        pendingLabel={
          editing
            ? "Updating…"
            : "Creating…"
        }
        disabled={
          type === "MANUAL"
            ? !editing &&
              !selected.length
            : rules.some(
                (rule) =>
                  !isValidCollectionRule(
                    {
                      ...rule,
                      value:
                        collectionRuleValue(
                          rule.field,
                          rule.value,
                        ),
                    },
                  ),
              )
        }
      >
        {editing
          ? "Save changes"
          : "Create collection"}
      </ActionButton>

      {state.message && (
        <p
          role={
            state.success
              ? "status"
              : "alert"
          }
          className={`${styles.collectionFeedback} ${
            state.success
              ? styles.success
              : ""
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}