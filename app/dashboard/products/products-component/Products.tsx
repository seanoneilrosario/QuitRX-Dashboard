"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

import styles from "@/app/components/dashboard.module.css";
import bulkStyles from "./products-bulk-editor.module.css";
import type { RetailRecord } from "@/lib/quitmed-retail-admin/collections/client";
import {
  bulkUpdateProducts,
  getProductBulkAttributeData,
  type ProductBulkAttribute,
  type ProductBulkAttributeAssignment,
  type ProductBulkField,
  type ProductBulkUpdate,
} from "@/lib/quitmed-retail-admin/products/products-bulk-actions";

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type Props = {
  products: RetailRecord[];
  pagination: Pagination;
  query: string;
  status: string;
  error?: string;
};

type ProductFieldColumn = {
  key: ProductBulkField;
  label: string;
  editor: "text" | "textarea" | "status" | "tags" | "attribute-single" | "attribute-multi";
  hint?: string;
  attribute?: ProductBulkAttribute;
};

type ProductDrafts = Record<string, Partial<Record<ProductBulkField, string>>>;

type UpdateFailure = { id: string; message: string };

const PRODUCT_COLUMNS: ProductFieldColumn[] = [
  { key: "name", label: "Title", editor: "text" },
  { key: "slug", label: "Handle", editor: "text" },
  { key: "status", label: "Status", editor: "status" },
  { key: "vendor", label: "Vendor", editor: "text", hint: "Choose an existing vendor by name" },
  { key: "productType", label: "Product type", editor: "text", hint: "Choose an existing product type by name" },
  { key: "shortDescription", label: "Short description", editor: "textarea" },
  { key: "description", label: "Description (HTML/text)", editor: "textarea" },
  { key: "imageId", label: "Primary image ID", editor: "text" },
  { key: "seoTitle", label: "SEO title", editor: "text" },
  { key: "seoDescription", label: "SEO description", editor: "textarea" },
  { key: "tags", label: "Tags", editor: "tags", hint: "Comma-separated names; missing tags are created automatically" },
];

const ALLOWED_STATUSES = ["ACTIVE", "DRAFT", "ARCHIVED"] as const;

type ProductStatusValue = (typeof ALLOWED_STATUSES)[number];

function text(value: unknown, fallback = "—"): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
}

function nested(item: RetailRecord, key: string): RetailRecord | undefined {
  const value = item[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RetailRecord)
    : undefined;
}

function tagNames(value: unknown): string {
  if (!Array.isArray(value)) return typeof value === "string" ? value : "";

  return value
    .flatMap((item) => {
      if (typeof item === "string") return [item];
      if (!item || typeof item !== "object") return [];
      const tagRecord = item as RetailRecord;
      const linkedTag = nested(tagRecord, "tag");
      const name = linkedTag?.name ?? tagRecord.name;
      return typeof name === "string" && name.trim() ? [name.trim()] : [];
    })
    .join(", ");
}

function originalFieldValue(
  product: RetailRecord,
  field: ProductBulkField,
  attributes: ProductBulkAttribute[] = [],
  assignments: ProductBulkAttributeAssignment[] = [],
  tagNamesByProductId: Record<string, string[]> = {},
): string {
  if (field.startsWith("attribute:")) {
    const attributeId = field.slice("attribute:".length);
    const productId = text(product.id, "");
    const attribute = attributes.find((item) => item.id === attributeId);
    const selected = assignments.filter(
      (item) => item.productId === productId && item.attributeId === attributeId,
    );
    if (!attribute) return "";
    if (attribute.type === "MULTI_SELECT") {
      // Store selected value IDs in the grid draft so the editor can use a
      // real multi-select control instead of accepting arbitrary free text.
      return selected.map((item) => item.attributeValueId).filter(Boolean).join(",");
    }
    return selected[0]?.attributeValueId ?? "";
  }

  switch (field) {
    case "vendor":
      return text(nested(product, "brand")?.name ?? product.brandName ?? product.brandId, "");
    case "productType":
      return text(nested(product, "productType")?.name ?? product.productTypeName ?? product.productTypeId, "");
    case "tags": {
      const productId = text(product.id, "");
      // Prefer tags read from the selected product's detail response. The
      // paginated product list may omit the tags relation altogether.
      if (Object.prototype.hasOwnProperty.call(tagNamesByProductId, productId)) {
        return tagNamesByProductId[productId].join(", ");
      }
      return tagNames(product.tags);
    }
    case "status":
      return text(product.status, "DRAFT").toUpperCase();
    default:
      return text(product[field], "");
  }
}

function ProductStatus({ value }: { value: unknown }) {
  const label = text(value, "UNKNOWN");
  return (
    <span
      className={`${styles.status} ${/draft|archived/i.test(label) ? styles.warning : ""}`}
    >
      {label.replaceAll("_", " ")}
    </span>
  );
}

function PaginationLinks({
  pagination,
  query,
  status,
}: {
  pagination: Pagination;
  query: string;
  status: string;
}) {
  if (pagination.totalPages <= 1) return null;

  function href(page: number) {
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (query) params.set("q", query);
    if (status) params.set("status", status);
    return `/dashboard/products?${params.toString()}`;
  }

  return (
    <nav className={styles.pagination} aria-label="Products pagination">
      <span>
        Showing page {pagination.page} of {pagination.totalPages} ·{" "}
        {pagination.total.toLocaleString()} products
      </span>
      <div>
        {pagination.page > 1 ? (
          <Link href={href(pagination.page - 1)}>Previous</Link>
        ) : (
          <span>Previous</span>
        )}
        {pagination.page < pagination.totalPages ? (
          <Link href={href(pagination.page + 1)}>Next</Link>
        ) : (
          <span>Next</span>
        )}
      </div>
    </nav>
  );
}

export default function Products({
  products,
  pagination,
  query,
  status,
  error,
}: Props) {
  const router = useRouter();
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Preserve the current product-list state when opening a product. The view
  // and edit pages can send the user back to the same filtered/paginated list.
  const returnToParams = new URLSearchParams();
  if (pagination.page > 1) returnToParams.set("page", String(pagination.page));
  if (query) returnToParams.set("q", query);
  if (status) returnToParams.set("status", status);
  const returnTo = `/dashboard/products${returnToParams.toString() ? `?${returnToParams.toString()}` : ""}`;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkEditorOpen, setBulkEditorOpen] = useState(false);
  const [loadingBulkData, setLoadingBulkData] = useState(false);
  const [bulkAttributes, setBulkAttributes] = useState<ProductBulkAttribute[]>([]);
  const [bulkAttributeAssignments, setBulkAttributeAssignments] = useState<ProductBulkAttributeAssignment[]>([]);
  const [bulkProductTagNames, setBulkProductTagNames] = useState<Record<string, string[]>>({});
  const [drafts, setDrafts] = useState<ProductDrafts>({});
  const [saving, setSaving] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkResult, setBulkResult] = useState("");
  const [failures, setFailures] = useState<UpdateFailure[]>([]);

  const visibleProductIds = useMemo(
    () => products.map((product) => text(product.id, "")).filter(Boolean),
    [products],
  );
  const pageKey = visibleProductIds.join("\u001f");
  const visibleIdSet = useMemo(() => new Set(visibleProductIds), [visibleProductIds]);
  const selectedOnThisPage = selectedIds.filter((id) => visibleIdSet.has(id));
  const selectedProducts = products.filter((product) => {
    const id = text(product.id, "");
    return id && selectedOnThisPage.includes(id);
  });
  const allVisibleSelected =
    visibleProductIds.length > 0 &&
    visibleProductIds.every((id) => selectedIds.includes(id));
  const someVisibleSelected = selectedOnThisPage.length > 0;
  const changedCellCount = Object.values(drafts).reduce(
    (total, fields) => total + Object.keys(fields).length,
    0,
  );
  const changesForSelectedCount = selectedProducts.reduce(
    (total, product) => total + Object.keys(drafts[text(product.id, "")] ?? {}).length,
    0,
  );
  const editorColumns = useMemo<ProductFieldColumn[]>(
    () => [
      ...PRODUCT_COLUMNS,
      ...bulkAttributes.map((attribute) => ({
        key: `attribute:${attribute.id}` as ProductBulkField,
        label: attribute.name,
        editor: attribute.type === "MULTI_SELECT" ? "attribute-multi" as const : "attribute-single" as const,
        hint: attribute.description || (attribute.type === "MULTI_SELECT" ? "Choose one or more existing values" : "Choose one existing value"),
        attribute,
      })),
    ],
    [bulkAttributes],
  );

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        someVisibleSelected && !allVisibleSelected;
    }
  }, [someVisibleSelected, allVisibleSelected]);

  // Never carry a selection or unsaved edits between pages, searches, or status filters.
  useEffect(() => {
    setSelectedIds([]);
    setBulkEditorOpen(false);
    setBulkAttributes([]);
    setBulkAttributeAssignments([]);
    setBulkProductTagNames({});
    setDrafts({});
    setBulkError("");
    setBulkResult("");
    setFailures([]);
  }, [pageKey, pagination.page, query, status]);

  function toggleProduct(id: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) return current.includes(id) ? current : [...current, id];
      return current.filter((selectedId) => selectedId !== id);
    });
    setBulkError("");
  }

  function toggleVisibleProducts(checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        return [...new Set([...current.filter((id) => !visibleIdSet.has(id)), ...visibleProductIds])];
      }
      return current.filter((id) => !visibleIdSet.has(id));
    });
    setBulkError("");
  }

  async function openBulkEditor() {
    if (selectedProducts.length === 0) return;
    setLoadingBulkData(true);
    setBulkError("");
    setBulkResult("");
    setFailures([]);
    setDrafts({});

    try {
      const data = await getProductBulkAttributeData(
        selectedProducts.map((product) => text(product.id, "")).filter(Boolean),
      );
      setBulkAttributes(data.attributes);
      setBulkAttributeAssignments(data.assignments);
      setBulkProductTagNames(data.tagNamesByProductId);
      setBulkEditorOpen(true);
    } catch (loadError) {
      // Keep the standard product fields usable if the attribute endpoints are unavailable.
      setBulkAttributes([]);
      setBulkAttributeAssignments([]);
      setBulkProductTagNames({});
      setBulkEditorOpen(true);
      setBulkError(
        `Product attributes could not be loaded, so only standard fields are available: ${loadError instanceof Error ? loadError.message : "Unknown API error."}`,
      );
    } finally {
      setLoadingBulkData(false);
    }
  }

  function changeCell(productId: string, field: ProductBulkField, value: string) {
    const product = products.find((item) => text(item.id, "") === productId);
    if (!product) return;
    const initialValue = originalFieldValue(
      product,
      field,
      bulkAttributes,
      bulkAttributeAssignments,
      bulkProductTagNames,
    );

    setDrafts((current) => {
      const next = { ...current };
      const productDraft = { ...(next[productId] ?? {}) };

      if (value === initialValue) {
        delete productDraft[field];
      } else {
        productDraft[field] = value;
      }

      if (Object.keys(productDraft).length === 0) {
        delete next[productId];
      } else {
        next[productId] = productDraft;
      }

      return next;
    });

    setBulkError("");
    setBulkResult("");
    setFailures([]);
  }

  function cancelBulkEdit() {
    const hasChanges = changedCellCount > 0;
    if (hasChanges && !window.confirm("Discard your unsaved bulk edits?")) return;
    setDrafts({});
    setBulkEditorOpen(false);
    setBulkProductTagNames({});
    setBulkError("");
    setBulkResult("");
    setFailures([]);
  }

  async function saveBulkEdit() {
    const updates: ProductBulkUpdate[] = selectedProducts.flatMap((product) => {
      const id = text(product.id, "");
      const changes = drafts[id];
      if (!id || !changes || Object.keys(changes).length === 0) return [];
      return [{ id, changes }];
    });

    if (updates.length === 0) {
      setBulkError("Change at least one cell before saving.");
      return;
    }

    const changedProducts = updates.length;
    const changedFields = updates.reduce(
      (total, update) => total + Object.keys(update.changes).length,
      0,
    );
    const confirmed = window.confirm(
      `Save ${changedFields} field change${changedFields === 1 ? "" : "s"} across ${changedProducts} product${changedProducts === 1 ? "" : "s"}? Product IDs cannot be changed.`,
    );
    if (!confirmed) return;

    setSaving(true);
    setBulkError("");
    setBulkResult("");
    setFailures([]);

    try {
      const result = await bulkUpdateProducts(updates);
      setFailures(result.failures);
      setBulkResult(
        `${result.successIds.length} product${result.successIds.length === 1 ? "" : "s"} saved; ${result.failures.length} failed.`,
      );

      const failedIds = result.failures.map((failure) => failure.id);
      setSelectedIds(failedIds);
      setDrafts((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([id]) => failedIds.includes(id)),
        ),
      );

      if (result.successIds.length > 0) {
        router.refresh();
      }

      if (failedIds.length === 0) {
        setBulkEditorOpen(false);
      }
    } catch (saveError) {
      setBulkError(
        saveError instanceof Error
          ? saveError.message
          : "Bulk edit failed. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  function renderEditorCell(product: RetailRecord, column: ProductFieldColumn) {
    const id = text(product.id, "");
    const initialValue = originalFieldValue(
      product,
      column.key,
      bulkAttributes,
      bulkAttributeAssignments,
      bulkProductTagNames,
    );
    const value = drafts[id]?.[column.key] ?? initialValue;
    const commonProps = {
      disabled: saving,
      value,
      "aria-label": `${column.label} for ${text(product.name, "product")}`,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        changeCell(id, column.key, event.target.value),
    };

    if (column.editor === "status") {
      return (
        <select
          {...commonProps}
          value={ALLOWED_STATUSES.includes(value as ProductStatusValue) ? value : "DRAFT"}
          className={bulkStyles.cellInput}
        >
          {ALLOWED_STATUSES.map((option) => (
            <option key={option} value={option}>
              {option.charAt(0) + option.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      );
    }

    if (column.editor === "attribute-single") {
      return (
        <select {...commonProps} className={bulkStyles.cellInput}>
          <option value="">No value</option>
          {(column.attribute?.values ?? []).map((option) => (
            <option key={option.id} value={option.id}>
              {option.value}
            </option>
          ))}
        </select>
      );
    }

    if (column.editor === "attribute-multi") {
      const selectedValueIds = value ? value.split(",").filter(Boolean) : [];
      const options = column.attribute?.values ?? [];
      return (
        <div
          className={bulkStyles.multiOptionList}
          role="group"
          aria-label={`${column.label} for ${text(product.name, "product")}`}
          aria-describedby={`${id}-${column.key.replace(/[^a-zA-Z0-9_-]/g, "-")}-hint`}
        >
          {options.length ? options.map((option) => {
            const isSelected = selectedValueIds.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                disabled={saving}
                className={`${bulkStyles.multiOption} ${isSelected ? bulkStyles.multiOptionSelected : ""}`}
                aria-pressed={isSelected}
                onClick={() => {
                  const nextSelected = isSelected
                    ? selectedValueIds.filter((selectedId) => selectedId !== option.id)
                    : [...selectedValueIds, option.id];
                  changeCell(id, column.key, nextSelected.join(","));
                }}
                title={isSelected ? `Unselect ${option.value}` : `Select ${option.value}`}
              >
                <span className={bulkStyles.radioIndicator} aria-hidden="true">
                  {isSelected ? <span className={bulkStyles.radioIndicatorDot} /> : null}
                </span>
                <span className={bulkStyles.multiOptionLabel}>{option.value}</span>
              </button>
            );
          }) : (
            <span className={bulkStyles.noAttributeOptions}>No existing values configured.</span>
          )}
          <span
            id={`${id}-${column.key.replace(/[^a-zA-Z0-9_-]/g, "-")}-hint`}
            className={bulkStyles.multiOptionHint}
          >
            Click to select; click again to unselect. You can select multiple values.
          </span>
        </div>
      );
    }

    if (column.editor === "textarea") {
      return (
        <textarea
          {...commonProps}
          rows={2}
          className={`${bulkStyles.cellInput} ${bulkStyles.cellTextarea}`}
        />
      );
    }

    return (
      <input
        {...commonProps}
        type="text"
        className={bulkStyles.cellInput}
        placeholder={column.key === "tags" ? "tag one, tag two" : "—"}
      />
    );
  }

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>QuitRX operations</p>
          <h1>Products</h1>
          <p>Manage products and everything customers see in your store.</p>
        </div>
      </header>

      {error && (
        <div className={styles.notice}>
          <strong>Unable to load products</strong>
          <span>{error}</span>
        </div>
      )}

      <div className={styles.toolbar}>
        <form className={styles.search} method="get">
          <span aria-hidden="true">⌕</span>
          <input
            name="q"
            aria-label="Search products"
            placeholder="Search name, slug, brand or type"
            defaultValue={query}
          />
          <select name="status" aria-label="Filter by status" defaultValue={status}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <button type="submit" className={styles.secondary}>
            Apply
          </button>
        </form>
      </div>

      {bulkResult && (
        <div className={styles.notice} role="status">
          <strong>Bulk edit results</strong>
          <span>{bulkResult}</span>
          {failures.length > 0 && (
            <ul>
              {failures.map((failure) => (
                <li key={failure.id}>
                  Product {failure.id}: {failure.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {bulkError && (
        <div className={styles.notice} role="alert">
          <strong>Unable to save bulk edits</strong>
          <span>{bulkError}</span>
        </div>
      )}

      <section className={styles.formCard}>
        <div className={styles.cardTitle}>
          <div>
            <h2>Products</h2>
            <p>{pagination.total.toLocaleString()} total products</p>
          </div>
          {someVisibleSelected && (
            <div className={bulkStyles.selectionToolbar}>
              <strong>{selectedOnThisPage.length} selected on this page</strong>
              <button
                type="button"
                className={styles.primary}
                onClick={() => {
                  void openBulkEditor();
                }}
                disabled={saving || loadingBulkData}
              >
                {loadingBulkData ? "Loading editor…" : "Bulk edit"}
              </button>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => {
                  if (changesForSelectedCount > 0 && !window.confirm("Discard your unsaved bulk edits and clear selection?")) return;
                  setSelectedIds([]);
                  setDrafts({});
                  setBulkEditorOpen(false);
                  setBulkAttributes([]);
                  setBulkAttributeAssignments([]);
                  setBulkProductTagNames({});
                  setBulkError("");
                  setBulkResult("");
                  setFailures([]);
                }}
                disabled={saving}
              >
                Clear selection
              </button>
            </div>
          )}
        </div>

        {bulkEditorOpen && someVisibleSelected && (
          <section className={bulkStyles.editor} aria-label="Bulk product editor">
            <div className={bulkStyles.editorHeader}>
              <div>
                <h3>Bulk edit products</h3>
                <p>
                  Editing {selectedProducts.length} selected product{selectedProducts.length === 1 ? "" : "s"} from page {pagination.page}. Edit each cell like a spreadsheet, then save your changes.
                </p>
                <p className={bulkStyles.helperText}>
                  Product ID is excluded and cannot be changed. Vendor and product type are resolved by name. Tags are comma-separated names and missing tags are created automatically. Custom attributes are included as their own columns; multi-select values use comma-separated names.
                </p>
              </div>
              <div className={bulkStyles.editorButtons}>
                <button type="button" className={styles.secondary} onClick={cancelBulkEdit} disabled={saving}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.primary}
                  onClick={saveBulkEdit}
                  disabled={saving || changesForSelectedCount === 0}
                >
                  {saving ? "Saving changes…" : `Save ${changesForSelectedCount} change${changesForSelectedCount === 1 ? "" : "s"}`}
                </button>
              </div>
            </div>

            <div className={bulkStyles.gridScroller}>
              <table className={bulkStyles.grid}>
                <thead>
                  <tr>
                    {editorColumns.map((column, index) => (
                      <th
                        key={column.key}
                        className={index === 0 ? bulkStyles.stickyProductColumn : undefined}
                        title={column.hint}
                      >
                        {column.label}
                        {column.hint && <small>{column.hint}</small>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedProducts.map((product) => {
                    const id = text(product.id, "");
                    return (
                      <tr key={id}>
                        {editorColumns.map((column, index) => {
                          const changed = Object.prototype.hasOwnProperty.call(drafts[id] ?? {}, column.key);
                          return (
                            <td
                              key={column.key}
                              className={`${index === 0 ? bulkStyles.stickyProductColumn : ""} ${changed ? bulkStyles.changedCell : ""}`}
                            >
                              {renderEditorCell(product, column)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className={bulkStyles.editorFooter}>
              <span>{changesForSelectedCount} edited cells · {changedCellCount} total unsaved cell changes</span>
              <button
                type="button"
                className={styles.primary}
                onClick={saveBulkEdit}
                disabled={saving || changesForSelectedCount === 0}
              >
                {saving ? "Saving changes…" : "Save changes"}
              </button>
            </div>
          </section>
        )}

        {products.length > 0 ? (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      aria-label="Select all products on this page"
                      checked={allVisibleSelected}
                      disabled={saving || bulkEditorOpen}
                      onChange={(event) => toggleVisibleProducts(event.target.checked)}
                    />
                  </th>
                  <th>Product</th>
                  <th>Brand</th>
                  <th>Type</th>
                  <th>Inventory</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product, index) => {
                  const id = text(product.id, "");
                  const brand = nested(product, "brand");
                  const productType = nested(product, "productType");
                  const checked = id !== "" && selectedIds.includes(id);

                  return (
                    <tr key={id || `product-${index}`}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${text(product.name, "product")}`}
                          checked={checked}
                          disabled={!id || saving || bulkEditorOpen}
                          onChange={(event) => toggleProduct(id, event.target.checked)}
                        />
                      </td>
                      <td>
                        <strong>{text(product.name)}</strong>
                        <small>{text(product.slug)}</small>
                      </td>
                      <td>{text(brand?.name ?? product.brandId)}</td>
                      <td>{text(productType?.name ?? product.productTypeId)}</td>
                      <td>{text(product.inventory, "0")}</td>
                      <td><ProductStatus value={product.status} /></td>
                      <td>
                        <div className={styles.actions}>
                          <Link
                            href={`/dashboard/products/view?id=${encodeURIComponent(id)}&returnTo=${encodeURIComponent(returnTo)}`}
                          >
                            View
                          </Link>
                          <Link
                            href={`/dashboard/products/edit?id=${encodeURIComponent(id)}&returnTo=${encodeURIComponent(returnTo)}`}
                          >
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.notice}>
            <strong>No products found</strong>
            <span>
              {query || status
                ? "Try changing your search or status filter."
                : "No products are available yet."}
            </span>
          </div>
        )}
      </section>

      <PaginationLinks pagination={pagination} query={query} status={status} />
    </>
  );
}
