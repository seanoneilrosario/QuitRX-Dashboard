"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  searchProductVariantsAction,
  updateProductBundleAction,
} from "../../../../lib/quitmed-retail-admin/bundles/actions";

import style from "../../../components/dashboard.module.css";

type SelectedVariant = {
  componentVariantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  price: string | number;
};

type CreateDropdown = {
  id: string;
  name: string;
  options: SelectedVariant[];
};

function toSelectedVariant(
  value: unknown,
): SelectedVariant | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  const id =
    typeof record.id === "string"
      ? record.id
      : typeof record.componentVariantId === "string"
        ? record.componentVariantId
        : "";

  if (!id) {
    return null;
  }

  const product =
    record.product &&
    typeof record.product === "object"
      ? (record.product as Record<string, unknown>)
      : null;

  const productId =
    product && typeof product.id === "string"
      ? product.id
      : typeof record.productId === "string"
        ? record.productId
        : "";

  return {
    componentVariantId: id,
    productId,
    productName:
      product && typeof product.name === "string"
        ? product.name
        : "Unknown product",
    variantName:
      typeof record.name === "string"
        ? record.name
        : "Unnamed variant",
    sku:
      typeof record.sku === "string"
        ? record.sku
        : "",
    price:
      typeof record.price === "string" ||
      typeof record.price === "number"
        ? record.price
        : "",
  };
}

function getSearchVariants(
  payload: unknown,
): SelectedVariant[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const data = (payload as { data?: unknown }).data;

  if (!Array.isArray(data)) {
    return [];
  }

  const variants: SelectedVariant[] = [];

  for (const item of data) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const parsed = toSelectedVariant(item);

    if (parsed) {
      variants.push(parsed);
    }
  }

  return variants;
}

export default function CreateBundle() {
  const router = useRouter();

  const [bundleVariant, setBundleVariant] =
    useState<SelectedVariant | null>(null);

  const [bundleSearch, setBundleSearch] =
    useState("");

  const [bundleSearchResults, setBundleSearchResults] =
    useState<SelectedVariant[]>([]);

  const [isSearchingBundle, setIsSearchingBundle] =
    useState(false);

  const [dropdowns, setDropdowns] =
    useState<CreateDropdown[]>([]);

  const [pickerOpenFor, setPickerOpenFor] =
    useState<number | null>(null);

  const [search, setSearch] = useState("");

  const [searchResults, setSearchResults] =
    useState<SelectedVariant[]>([]);

  const [isSearching, setIsSearching] =
    useState(false);

  const [isSaving, setIsSaving] =
    useState(false);

  const [error, setError] = useState("");

  function selectBundleVariant(
    variant: SelectedVariant,
  ) {
    setBundleVariant(variant);
    setBundleSearch("");
    setBundleSearchResults([]);
    setError("");
  }

  async function searchBundleVariants() {
    setIsSearchingBundle(true);
    setError("");

    try {
      const result =
        await searchProductVariantsAction(
          bundleSearch,
        );

      setBundleSearchResults(
        getSearchVariants(result),
      );
    } catch (searchError) {
      console.error(searchError);
      setBundleSearchResults([]);
      setError(
        "Failed to search product variants.",
      );
    } finally {
      setIsSearchingBundle(false);
    }
  }

  function addDropdown() {
    setDropdowns((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: `Selection ${current.length + 1}`,
        options: [],
      },
    ]);
  }

  function removeDropdown(index: number) {
    setDropdowns((current) =>
      current.filter((_, i) => i !== index),
    );
  }

  function updateDropdownName(
    index: number,
    name: string,
  ) {
    setDropdowns((current) =>
      current.map((dropdown, i) =>
        i === index
          ? {
              ...dropdown,
              name,
            }
          : dropdown,
      ),
    );
  }

  function removeVariant(
    dropdownIndex: number,
    variantId: string,
  ) {
    setDropdowns((current) =>
      current.map((dropdown, index) =>
        index === dropdownIndex
          ? {
              ...dropdown,
              options: dropdown.options.filter(
                (option) =>
                  option.componentVariantId !==
                  variantId,
              ),
            }
          : dropdown,
      ),
    );
  }

  async function searchVariants() {
    setIsSearching(true);
    setError("");

    try {
      const result =
        await searchProductVariantsAction(search);

      const variants = getSearchVariants(
        result,
      ).filter(
        (variant) =>
          variant.componentVariantId !==
          bundleVariant?.componentVariantId,
      );

      setSearchResults(variants);
    } catch (searchError) {
      console.error(searchError);
      setSearchResults([]);
      setError("Failed to search products.");
    } finally {
      setIsSearching(false);
    }
  }

  function addVariant(
    dropdownIndex: number,
    variant: SelectedVariant,
  ) {
    if (
      variant.componentVariantId ===
      bundleVariant?.componentVariantId
    ) {
      return;
    }

    setDropdowns((current) =>
      current.map((dropdown, index) => {
        if (index !== dropdownIndex) {
          return dropdown;
        }

        const alreadyExists =
          dropdown.options.some(
            (option) =>
              option.componentVariantId ===
              variant.componentVariantId,
          );

        if (alreadyExists) {
          return dropdown;
        }

        return {
          ...dropdown,
          options: [
            ...dropdown.options,
            variant,
          ],
        };
      }),
    );
  }

  async function createBundle() {
    setError("");

    if (!bundleVariant) {
      setError(
        "Please select a product variant for the bundle.",
      );
      return;
    }

    if (!bundleVariant.productId) {
      setError(
        "The selected variant is missing its product ID.",
      );
      return;
    }

    if (dropdowns.length === 0) {
      setError(
        "A bundle must have at least one selection.",
      );
      return;
    }

    for (
      let index = 0;
      index < dropdowns.length;
      index += 1
    ) {
      const dropdown = dropdowns[index];

      if (!dropdown.name.trim()) {
        setError(
          `Selection ${index + 1} needs a name.`,
        );
        return;
      }

      if (dropdown.options.length === 0) {
        setError(
          `"${dropdown.name}" must have at least one component variant.`,
        );
        return;
      }
    }

    setIsSaving(true);

    try {
      const payload = dropdowns.map(
        (dropdown, index) => ({
          position: index + 1,
          name: dropdown.name.trim(),
          options: dropdown.options.map(
            (option) => ({
              componentVariantId:
                option.componentVariantId,
            }),
          ),
        }),
      );

      await updateProductBundleAction(
        bundleVariant.productId,
        bundleVariant.componentVariantId,
        payload,
      );

      router.push(
        `/dashboard/bundles/view?id=${encodeURIComponent(
          bundleVariant.componentVariantId,
        )}`,
      );

      router.refresh();
    } catch (saveError) {
      console.error(saveError);
      setError("Failed to create bundle.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className={style.pageHeader}>
        <div>
          <div className={style.eyebrow}>
            Bundles
          </div>

          <h1>Create bundle</h1>

          <p>
            Select a product variant and configure
            its component selections.
          </p>
        </div>
      </div>

      <div className={style.formCard}>
        <div className={style.pageHeader}>
          <div>
            <div className={style.eyebrow}>
              Bundle product
            </div>

            <h2>
              {bundleVariant
                ? "Selected variant"
                : "Select a variant"}
            </h2>

            <p>
              The selected variant will become the
              bundle.
            </p>
          </div>
        </div>

        {bundleVariant ? (
          <>
            <div className={style.variantList}>
              <div
                className={
                  style.variantListHeader
                }
              >
                <span>Product</span>
                <span>Variant</span>
                <span>SKU</span>
                <span>Action</span>
              </div>

              <div
                className={
                  style.variantListRow
                }
              >
                <div
                  className={
                    style.variantListValue
                  }
                >
                  {bundleVariant.productName}
                </div>

                <div
                  className={
                    style.variantListValue
                  }
                >
                  {bundleVariant.variantName}
                </div>

                <div
                  className={
                    style.variantListValue
                  }
                >
                  {bundleVariant.sku || "—"}
                </div>

                <div
                  className={
                    style.variantListAction
                  }
                >
                  <button
                    type="button"
                    className={style.secondary}
                    onClick={() => {
                      setBundleVariant(null);
                      setDropdowns([]);
                    }}
                  >
                    Change
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div
              className={
                style.variantSearchRow
              }
            >
              <div className={style.field}>
                <label
                  className={style.label}
                >
                  Search variants
                </label>

                <input
                  className={style.input}
                  value={bundleSearch}
                  onChange={(event) =>
                    setBundleSearch(
                      event.target.value,
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter"
                    ) {
                      event.preventDefault();
                      void searchBundleVariants();
                    }
                  }}
                  placeholder="Search product or variant"
                />
              </div>

              <button
                type="button"
                className={style.primary}
                onClick={() =>
                  void searchBundleVariants()
                }
                disabled={isSearchingBundle}
              >
                {isSearchingBundle
                  ? "Searching..."
                  : "Search"}
              </button>
            </div>

            {bundleSearchResults.length > 0 && (
              <div
                className={
                  style.variantResults
                }
              >
                {bundleSearchResults.map(
                  (variant) => (
                    <div
                      key={
                        variant.componentVariantId
                      }
                      className={
                        style.variantResult
                      }
                    >
                      <div
                        className={
                          style.variantResultField
                        }
                      >
                        <span
                          className={
                            style.variantResultLabel
                          }
                        >
                          Product
                        </span>

                        <div
                          className={
                            style.variantResultValue
                          }
                        >
                          {variant.productName}
                        </div>
                      </div>

                      <div
                        className={
                          style.variantResultField
                        }
                      >
                        <span
                          className={
                            style.variantResultLabel
                          }
                        >
                          Variant
                        </span>

                        <div
                          className={
                            style.variantResultValue
                          }
                        >
                          {variant.variantName}
                        </div>
                      </div>

                      <div
                        className={
                          style.variantResultField
                        }
                      >
                        <span
                          className={
                            style.variantResultLabel
                          }
                        >
                          SKU
                        </span>

                        <div
                          className={
                            style.variantResultValue
                          }
                        >
                          {variant.sku || "—"}
                        </div>
                      </div>

                      <div
                        className={
                          style.variantResultAction
                        }
                      >
                        <button
                          type="button"
                          className={
                            style.secondary
                          }
                          onClick={() =>
                            selectBundleVariant(
                              variant,
                            )
                          }
                        >
                          Select
                        </button>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}

            {!isSearchingBundle &&
              bundleSearch.length > 0 &&
              bundleSearchResults.length ===
                0 && (
                <div
                  className={
                    style.variantPickerEmpty
                  }
                >
                  No variants found.
                </div>
              )}
          </>
        )}
      </div>

      {bundleVariant && (
        <div className={style.formCard}>
          <div className={style.pageHeader}>
            <div>
              <div className={style.eyebrow}>
                Bundle configuration
              </div>

              <h2>Selections</h2>

              <p>
                Each selection must contain at
                least one component variant.
              </p>
            </div>

            <button
              type="button"
              className={style.secondary}
              onClick={addDropdown}
            >
              Add selection
            </button>
          </div>

          {dropdowns.map(
            (dropdown, dropdownIndex) => {
              const pickerIsOpen =
                pickerOpenFor ===
                dropdownIndex;

              return (
                <div
                  key={dropdown.id}
                  className={style.formCard}
                >
                  <div
                    className={style.formGrid}
                  >
                    <div
                      className={style.field}
                    >
                      <label
                        className={style.label}
                      >
                        Selection name
                      </label>

                      <input
                        className={style.input}
                        value={dropdown.name}
                        onChange={(event) =>
                          updateDropdownName(
                            dropdownIndex,
                            event.target.value,
                          )
                        }
                      />
                    </div>

                    <div
                      className={style.field}
                    >
                      <label
                        className={style.label}
                      >
                        Options
                      </label>

                      <input
                        className={style.input}
                        value={String(
                          dropdown.options
                            .length,
                        )}
                        readOnly
                      />
                    </div>
                  </div>

                  {dropdown.options.length >
                    0 && (
                    <div
                      className={
                        style.variantList
                      }
                    >
                      <div
                        className={
                          style.variantListHeader
                        }
                      >
                        <span>Product</span>
                        <span>Variant</span>
                        <span>SKU</span>
                        <span>Action</span>
                      </div>

                      {dropdown.options.map(
                        (option) => (
                          <div
                            key={
                              option.componentVariantId
                            }
                            className={
                              style.variantListRow
                            }
                          >
                            <div
                              className={
                                style.variantListValue
                              }
                            >
                              {
                                option.productName
                              }
                            </div>

                            <div
                              className={
                                style.variantListValue
                              }
                            >
                              {
                                option.variantName
                              }
                            </div>

                            <div
                              className={
                                style.variantListValue
                              }
                            >
                              {option.sku ||
                                "—"}
                            </div>

                            <div
                              className={
                                style.variantListAction
                              }
                            >
                              <button
                                type="button"
                                className={
                                  style.secondary
                                }
                                onClick={() =>
                                  removeVariant(
                                    dropdownIndex,
                                    option.componentVariantId,
                                  )
                                }
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  )}

                  {pickerIsOpen && (
                    <div
                      className={
                        style.variantPicker
                      }
                    >
                      <div
                        className={
                          style.variantSearchRow
                        }
                      >
                        <div
                          className={style.field}
                        >
                          <label
                            className={
                              style.label
                            }
                          >
                            Search variants
                          </label>

                          <input
                            className={
                              style.input
                            }
                            value={search}
                            onChange={(
                              event,
                            ) =>
                              setSearch(
                                event.target
                                  .value,
                              )
                            }
                            onKeyDown={(
                              event,
                            ) => {
                              if (
                                event.key ===
                                "Enter"
                              ) {
                                event.preventDefault();
                                void searchVariants();
                              }
                            }}
                            placeholder="Search product or variant"
                          />
                        </div>

                        <button
                          type="button"
                          className={
                            style.primary
                          }
                          onClick={() =>
                            void searchVariants()
                          }
                          disabled={
                            isSearching
                          }
                        >
                          {isSearching
                            ? "Searching..."
                            : "Search"}
                        </button>
                      </div>

                      {searchResults.length >
                        0 && (
                        <div
                          className={
                            style.variantResults
                          }
                        >
                          {searchResults.map(
                            (variant) => {
                              const alreadySelected =
                                dropdown.options.some(
                                  (option) =>
                                    option.componentVariantId ===
                                    variant.componentVariantId,
                                );

                              return (
                                <div
                                  key={
                                    variant.componentVariantId
                                  }
                                  className={
                                    style.variantResult
                                  }
                                >
                                  <div
                                    className={
                                      style.variantResultField
                                    }
                                  >
                                    <span
                                      className={
                                        style.variantResultLabel
                                      }
                                    >
                                      Product
                                    </span>

                                    <div
                                      className={
                                        style.variantResultValue
                                      }
                                    >
                                      {
                                        variant.productName
                                      }
                                    </div>
                                  </div>

                                  <div
                                    className={
                                      style.variantResultField
                                    }
                                  >
                                    <span
                                      className={
                                        style.variantResultLabel
                                      }
                                    >
                                      Variant
                                    </span>

                                    <div
                                      className={
                                        style.variantResultValue
                                      }
                                    >
                                      {
                                        variant.variantName
                                      }
                                    </div>
                                  </div>

                                  <div
                                    className={
                                      style.variantResultField
                                    }
                                  >
                                    <span
                                      className={
                                        style.variantResultLabel
                                      }
                                    >
                                      SKU
                                    </span>

                                    <div
                                      className={
                                        style.variantResultValue
                                      }
                                    >
                                      {variant.sku ||
                                        "—"}
                                    </div>
                                  </div>

                                  <div
                                    className={
                                      style.variantResultAction
                                    }
                                  >
                                    <button
                                      type="button"
                                      className={
                                        style.secondary
                                      }
                                      disabled={
                                        alreadySelected
                                      }
                                      onClick={() =>
                                        addVariant(
                                          dropdownIndex,
                                          variant,
                                        )
                                      }
                                    >
                                      {alreadySelected
                                        ? "Added"
                                        : "Add"}
                                    </button>
                                  </div>
                                </div>
                              );
                            },
                          )}
                        </div>
                      )}

                      {!isSearching &&
                        search.length > 0 &&
                        searchResults.length ===
                          0 && (
                          <div
                            className={
                              style.variantPickerEmpty
                            }
                          >
                            No variants found.
                          </div>
                        )}
                    </div>
                  )}

                  <div
                    className={style.formGrid}
                  >
                    <button
                      type="button"
                      className={
                        style.secondary
                      }
                      onClick={() => {
                        setPickerOpenFor(
                          pickerIsOpen
                            ? null
                            : dropdownIndex,
                        );
                        setSearch("");
                        setSearchResults([]);
                      }}
                    >
                      {pickerIsOpen
                        ? "Close variant picker"
                        : "Add component variant"}
                    </button>

                    <button
                      type="button"
                      className={
                        style.secondary
                      }
                      onClick={() =>
                        removeDropdown(
                          dropdownIndex,
                        )
                      }
                    >
                      Remove selection
                    </button>
                  </div>
                </div>
              );
            },
          )}

          {error && (
            <p role="alert">{error}</p>
          )}

          <div className={style.formGrid}>
            <button
              type="button"
              className={style.secondary}
              onClick={() =>
                router.push(
                  "/dashboard/bundles",
                )
              }
            >
              Cancel
            </button>

            <button
              type="button"
              className={style.primary}
              disabled={isSaving}
              onClick={() =>
                void createBundle()
              }
            >
              {isSaving
                ? "Creating..."
                : "Create bundle"}
            </button>
          </div>
        </div>
      )}

      {!bundleVariant && error && (
        <p role="alert">{error}</p>
      )}
    </>
  );
}