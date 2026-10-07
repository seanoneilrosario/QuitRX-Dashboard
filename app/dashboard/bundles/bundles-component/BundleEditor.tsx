"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { Bundle } from "../../../../lib/quitmed-retail-admin/bundles/client";
import {
  searchProductVariantsAction,
  updateProductBundleAction,
} from "../../../../lib/quitmed-retail-admin/bundles/actions";

import style from "../../../components/dashboard.module.css";

type SelectedVariant = {
  componentVariantId: string;
  productName: string;
  variantName: string;
  sku: string;
  price: string | number;
};

type EditorDropdown = {
  id: string;
  name: string;
  options: SelectedVariant[];
};

function toSelectedVariant(value: unknown): SelectedVariant | null {
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
    record.product && typeof record.product === "object"
      ? (record.product as Record<string, unknown>)
      : null;

  return {
    componentVariantId: id,
    productName:
      product && typeof product.name === "string"
        ? product.name
        : "Unknown product",
    variantName:
      typeof record.name === "string" ? record.name : "Unnamed variant",
    sku: typeof record.sku === "string" ? record.sku : "",
    price:
      typeof record.price === "string" || typeof record.price === "number"
        ? record.price
        : "",
  };
}

function getSearchVariants(payload: unknown): SelectedVariant[] {
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

    const product = item as Record<string, unknown>;

    if (Array.isArray(product.variants)) {
      for (const variant of product.variants) {
        if (!variant || typeof variant !== "object") {
          continue;
        }

        const parsed = toSelectedVariant({
          ...(variant as Record<string, unknown>),
          product: {
            name:
              typeof product.name === "string"
                ? product.name
                : "Unknown product",
          },
        });

        if (parsed) {
          variants.push(parsed);
        }
      }
    } else {
      const parsed = toSelectedVariant(product);

      if (parsed) {
        variants.push(parsed);
      }
    }
  }

  return variants;
}

function mapBundleToEditor(bundle: Bundle): EditorDropdown[] {
  return [...bundle.bundleDropdowns]
    .sort((a, b) => a.position - b.position)
    .map((dropdown, index) => ({
      id: dropdown.id,
      name: dropdown.name || `Selection ${index + 1}`,
      options: dropdown.options
        .map((option) => toSelectedVariant(option.componentVariant))
        .filter((option): option is SelectedVariant => option !== null),
    }));
}

export default function BundleEditor({
  bundle,
}: {
  bundle: Bundle;
}) {
  const router = useRouter();

  const [dropdowns, setDropdowns] = useState<EditorDropdown[]>(() =>
    mapBundleToEditor(bundle),
  );

  const [pickerOpenFor, setPickerOpenFor] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SelectedVariant[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

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
    setDropdowns((current) => current.filter((_, i) => i !== index));
  }

  function updateDropdownName(index: number, name: string) {
    setDropdowns((current) =>
      current.map((dropdown, i) =>
        i === index ? { ...dropdown, name } : dropdown,
      ),
    );
  }

  function removeVariant(dropdownIndex: number, variantId: string) {
    setDropdowns((current) =>
      current.map((dropdown, index) =>
        index === dropdownIndex
          ? {
              ...dropdown,
              options: dropdown.options.filter(
                (option) => option.componentVariantId !== variantId,
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
        const result = await searchProductVariantsAction(search);

        const variants = getSearchVariants(result).filter(
        (variant) =>
            variant.componentVariantId !== bundle.id,
        );

        setSearchResults(variants);

      console.log("results", result)
    } catch (searchError) {
      console.error(searchError);
      setSearchResults([]);
      setError("Failed to search products.");
    } finally {
      setIsSearching(false);
    }
  }

  function addVariant(dropdownIndex: number, variant: SelectedVariant) {
    setDropdowns((current) =>
      current.map((dropdown, index) => {
        if (index !== dropdownIndex) {
          return dropdown;
        }

        const alreadyExists = dropdown.options.some(
          (option) => option.componentVariantId === variant.componentVariantId,
        );

        if (alreadyExists) {
          return dropdown;
        }

        return {
          ...dropdown,
          options: [...dropdown.options, variant],
        };
      }),
    );
  }

  async function saveBundle() {
    setError("");

    if (dropdowns.length === 0) {
      setError("A bundle must have at least one selection.");
      return;
    }

    for (let index = 0; index < dropdowns.length; index += 1) {
      const dropdown = dropdowns[index];

      if (!dropdown.name.trim()) {
        setError(`Selection ${index + 1} needs a name.`);
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
      const payload = dropdowns.map((dropdown, index) => ({
        // Backend DTO requires position >= 1.
        position: index + 1,
        name: dropdown.name.trim(),
        options: dropdown.options.map((option) => ({
          componentVariantId: option.componentVariantId,
        })),
      }));

      await updateProductBundleAction(
        bundle.productId,
        bundle.id,
        payload,
      );

      router.push(
        `/dashboard/bundles/view?id=${encodeURIComponent(
          bundle.id,
        )}`,
      );

    } catch (saveError) {
      console.error(saveError);
      setError("Failed to save bundle.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className={style.pageHeader}>
        <div>
          <div className={style.eyebrow}>Bundles</div>
          <h1>Edit bundle</h1>
          <p>
            {bundle.name} · {bundle.sku}
          </p>
        </div>
      </div>

      <div className={style.bundleMetaCard}>
        <div className={style.bundleMetaItem}>
          <span className={style.bundleMetaLabel}>
            Bundle name
          </span>

          <span className={style.bundleMetaValue}>
            {bundle.name}
          </span>
        </div>

        <div className={style.bundleMetaItem}>
          <span className={style.bundleMetaLabel}>
            SKU
          </span>

          <span className={style.bundleMetaValue}>
            {bundle.sku || "—"}
          </span>
        </div>

        <div className={style.bundleMetaItem}>
          <span className={style.bundleMetaLabel}>
            Price
          </span>

          <span className={style.bundleMetaValue}>
            {String(bundle.price)}
          </span>
        </div>
      </div>

      <div className={style.formCard}>
        <div className={style.pageHeader}>
          <div>
            <div className={style.eyebrow}>Bundle configuration</div>
            <h2>Selections</h2>
            <p>
              Each selection must contain at least one component variant.
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

        {dropdowns.map((dropdown, dropdownIndex) => {
          const pickerIsOpen = pickerOpenFor === dropdownIndex;

          return (
            <div
              key={dropdown.id}
              className={style.formCard}
            >
              <div className={style.selectionHeader}>
                <div className={style.selectionNameField}>
                  <label className={style.label}>
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

                <div className={style.selectionCount}>
                  <span className={style.label}>
                    Options
                  </span>

                  <span className={style.optionCount}>
                    {dropdown.options.length}
                  </span>
                </div>
              </div>

              {dropdown.options.length > 0 && (
                <div className={style.variantList}>
                    <div className={style.variantListHeader}>
                    <span>Product</span>
                    <span>Variant</span>
                    <span>SKU</span>
                    <span>Action</span>
                    </div>

                    {dropdown.options.map((option) => (
                    <div
                        key={option.componentVariantId}
                        className={style.variantListRow}
                    >
                        <div className={style.variantListValue}>
                        {option.productName}
                        </div>

                        <div className={style.variantListValue}>
                        {option.variantName}
                        </div>

                        <div className={style.variantListValue}>
                        {option.sku || "—"}
                        </div>

                        <div className={style.variantListAction}>
                        <button
                            type="button"
                            className={style.secondary}
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
                    ))}
                </div>
                )}

              {pickerIsOpen && (
                <div className={style.variantPicker}>
                    <div className={style.variantSearchRow}>
                    <div className={style.field}>
                        <label className={style.label}>
                        Search variants:
                        </label>

                        <input
                        className={style.input}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                            event.preventDefault();
                            void searchVariants();
                            }
                        }}
                        placeholder="Search product or variant"
                        />
                    </div>

                    <button
                        type="button"
                        className={style.primary}
                        onClick={() => void searchVariants()}
                        disabled={isSearching}
                    >
                        {isSearching ? "Searching..." : "Search"}
                    </button>
                    </div>

                    {searchResults.length > 0 && (
                    <div className={style.variantResults}>
                        {searchResults.map((variant) => {
                        const alreadySelected = dropdown.options.some(
                            (option) =>
                            option.componentVariantId ===
                            variant.componentVariantId,
                        );

                        return (
                            <div
                            key={variant.componentVariantId}
                            className={style.variantResult}
                            >
                            <div className={style.variantResultField}>
                                <span className={style.variantResultLabel}>
                                Product
                                </span>

                                <div className={style.variantResultValue}>
                                {variant.productName}
                                </div>
                            </div>

                            <div className={style.variantResultField}>
                                <span className={style.variantResultLabel}>
                                Variant
                                </span>

                                <div className={style.variantResultValue}>
                                {variant.variantName}
                                </div>
                            </div>

                            <div className={style.variantResultField}>
                                <span className={style.variantResultLabel}>
                                SKU
                                </span>

                                <div className={style.variantResultValue}>
                                {variant.sku || "—"}
                                </div>
                            </div>

                            <div className={style.variantResultAction}>
                                <button
                                type="button"
                                className={style.secondary}
                                disabled={alreadySelected}
                                onClick={() =>
                                    addVariant(
                                    dropdownIndex,
                                    variant,
                                    )
                                }
                                >
                                {alreadySelected ? "Added" : "Add"}
                                </button>
                            </div>
                            </div>
                        );
                        })}
                    </div>
                    )}

                    {!isSearching &&
                    search.length > 0 &&
                    searchResults.length === 0 && (
                        <div className={style.variantPickerEmpty}>
                        No variants found.
                        </div>
                    )}
                </div>
                )}

              <div className={style.formGrid}>
                <button
                  type="button"
                  className={style.secondary}
                  onClick={() => {
                    setPickerOpenFor(
                      pickerIsOpen ? null : dropdownIndex,
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
                  className={style.secondary}
                  onClick={() =>
                    removeDropdown(dropdownIndex)
                  }
                >
                  Remove selection
                </button>
              </div>
            </div>
          );
        })}

        {error && (
          <p role="alert">
            {error}
          </p>
        )}

        <div className={style.formGrid}>
          <button
            type="button"
            className={style.secondary}
            onClick={() =>
              router.push(
                `/dashboard/bundles/view?id=${encodeURIComponent(
                  bundle.id,
                )}`,
              )
            }
          >
            Cancel
          </button>

          <button
            type="button"
            className={style.primary}
            disabled={isSaving}
            onClick={() => void saveBundle()}
          >
            {isSaving ? "Saving..." : "Save bundle"}
          </button>
        </div>
      </div>
    </>
  );
}