"use server";

import { revalidatePath, updateTag } from "next/cache";
import {
  retailRequest,
  RETAIL_CATALOG_TAG,
} from "@/lib/quitmed-retail-admin/collections/client";

export type ProductBulkField =
  | "name"
  | "slug"
  | "shortDescription"
  | "description"
  | "status"
  | "imageId"
  | "seoTitle"
  | "seoDescription"
  | "productType"
  | "vendor"
  | "tags";

export type ProductBulkChanges = Partial<Record<ProductBulkField, string>>;

export type ProductBulkUpdate = {
  id: string;
  changes: ProductBulkChanges;
};

export type BulkProductUpdateResult = {
  successIds: string[];
  failures: Array<{ id: string; message: string }>;
};

const EDITABLE_FIELDS = new Set<ProductBulkField>([
  "name",
  "slug",
  "shortDescription",
  "description",
  "status",
  "imageId",
  "seoTitle",
  "seoDescription",
  "productType",
  "vendor",
  "tags",
]);

const ALLOWED_STATUSES = new Set(["ACTIVE", "DRAFT", "ARCHIVED"]);

type ApiRecord = Record<string, unknown>;
type ExistingProductTag = { id: string; tagId: string };
type TagOption = { id: string; name: string };
type ReferenceOption = { id: string; name: string };

function isRecord(value: unknown): value is ApiRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function record(value: unknown): ApiRecord {
  return isRecord(value) ? value : {};
}

function unwrapRecord(value: unknown): ApiRecord {
  let current: unknown = value;

  for (let depth = 0; depth < 4; depth += 1) {
    if (!isRecord(current)) break;

    if (isRecord(current.data)) {
      current = current.data;
      continue;
    }

    if (isRecord(current.product)) {
      current = current.product;
      continue;
    }

    return current;
  }

  return record(current);
}

function recordsFrom(value: unknown, keys: string[] = []): ApiRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];

  for (const key of keys) {
    if (Array.isArray(value[key])) {
      return (value[key] as unknown[]).filter(isRecord);
    }
  }

  // The Retail API commonly wraps lists as { data: [...] }.
  if (Array.isArray(value.data)) {
    return (value.data as unknown[]).filter(isRecord);
  }

  if (isRecord(value.data)) {
    return recordsFrom(value.data, keys);
  }

  return [];
}

function fieldString(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return "";
}


function existingProductTags(product: ApiRecord): ExistingProductTag[] {
  if (!Array.isArray(product.tags)) return [];

  return product.tags.flatMap((value) => {
    if (!isRecord(value)) return [];
    const linkedTag = record(value.tag);
    const id = fieldString(value.id).trim();
    const tagId = fieldString(value.tagId ?? linkedTag.id).trim();
    return id && tagId ? [{ id, tagId }] : [];
  });
}

function tagOptionsFrom(value: unknown): TagOption[] {
  return recordsFrom(value, ["tags", "items", "results"]).flatMap((tag) => {
    const nested = record(tag.tag);
    const id = fieldString(tag.id ?? nested.id).trim();
    const name = fieldString(tag.name ?? nested.name).trim();
    return id && name ? [{ id, name }] : [];
  });
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function loadAllTagOptions(): Promise<TagOption[]> {
  const all: TagOption[] = [];

  // The tags endpoint can be paginated. Load all pages before deciding a tag
  // is new, avoiding duplicate creation when it exists beyond page one.
  for (let page = 1; page <= 100; page += 1) {
    const response = await retailRequest<unknown>(
      `/tags?page=${page}&limit=100`,
      { cache: "no-store" },
    );
    const pageTags = tagOptionsFrom(response);
    all.push(...pageTags);

    const wrapper = isRecord(response) ? response : {};
    const unwrapped = isRecord(wrapper.data) ? wrapper.data : wrapper;
    const pagination = isRecord(unwrapped.pagination)
      ? unwrapped.pagination
      : isRecord(wrapper.pagination)
        ? wrapper.pagination
        : {};
    const totalPages = Number(pagination.totalPages) || 1;

    if (page >= totalPages || pageTags.length === 0) break;
  }

  return [...new Map(all.map((tag) => [tag.id, tag])).values()];
}

async function ensureTagsExist(
  requestedNames: string[],
  availableTags: TagOption[],
): Promise<{ tags: TagOption[]; createdNames: string[] }> {
  const byName = new Map(
    availableTags.map((tag) => [tag.name.toLowerCase(), tag]),
  );
  const createdNames: string[] = [];

  for (const rawName of requestedNames) {
    const name = rawName.trim();
    if (!name || byName.has(name.toLowerCase())) continue;

    try {
      const response = await retailRequest<unknown>("/tags", {
        method: "POST",
        body: JSON.stringify({ name, slug: slugify(name) }),
      });
      const wrapper = record(response);
      const data = isRecord(wrapper.data) ? wrapper.data : wrapper;
      const nestedTag = record(data.tag);
      const id = fieldString(data.id ?? nestedTag.id).trim();
      const savedName = fieldString(data.name ?? nestedTag.name).trim() || name;

      if (!id) {
        throw new Error(`Tag "${name}" was created, but the API did not return its ID.`);
      }

      const savedTag = { id, name: savedName };
      byName.set(savedName.toLowerCase(), savedTag);
      // Also key by the requested name if the API normalized the label.
      byName.set(name.toLowerCase(), savedTag);
      createdNames.push(savedName);
    } catch (createError) {
      // A tag may have been created concurrently. Re-read the list and accept
      // it if the same name now exists; otherwise surface the real API error.
      const refreshed = await loadAllTagOptions();
      const existing = refreshed.find(
        (tag) => tag.name.toLowerCase() === name.toLowerCase(),
      );

      if (existing) {
        byName.set(existing.name.toLowerCase(), existing);
        byName.set(name.toLowerCase(), existing);
        continue;
      }

      throw new Error(
        `Unable to create tag "${name}": ${createError instanceof Error ? createError.message : "Unknown API error."}`,
      );
    }
  }

  return {
    tags: [...new Map([...byName.values()].map((tag) => [tag.id, tag])).values()],
    createdNames,
  };
}

async function replaceProductTags(
  productId: string,
  tagNamesValue: string,
  availableTags: TagOption[],
): Promise<void> {
  const productResponse = await retailRequest<unknown>(
    `/products/${encodeURIComponent(productId)}`,
    { cache: "no-store" },
  );

  const product = unwrapRecord(productResponse);
  const existing = existingProductTags(product);
  const requestedNames = [
    ...new Set(
      tagNamesValue
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ];

  const missingNames = requestedNames.filter(
    (name) => !availableTags.some((tag) => tag.name.toLowerCase() === name.toLowerCase()),
  );

  // bulkUpdateProducts creates missing tag records before updating products.
  // Keep a defensive check here in case a tag could not be resolved.
  if (missingNames.length > 0) {
    throw new Error(
      `Could not resolve tag${missingNames.length === 1 ? "" : "s"}: ${missingNames.join(", ")}.`,
    );
  }

  const selectedIds = requestedNames.map((name) => {
    const match = availableTags.find(
      (tag) => tag.name.toLowerCase() === name.toLowerCase(),
    );
    if (!match) throw new Error(`Could not find tag "${name}".`);
    return match.id;
  });

  const selected = new Set(selectedIds);
  const currentIds = new Set(existing.map((tag) => tag.tagId));

  await Promise.all([
    ...existing
      .filter((tag) => !selected.has(tag.tagId))
      .map((tag) =>
        retailRequest(`/product-tags/${encodeURIComponent(tag.id)}`, {
          method: "DELETE",
        }),
      ),
    ...selectedIds
      .filter((tagId) => !currentIds.has(tagId))
      .map((tagId) =>
        retailRequest("/product-tags", {
          method: "POST",
          body: JSON.stringify({ productId, tagId }),
        }),
      ),
  ]);
}

async function referenceOptions(path: string, collectionKeys: string[]): Promise<ReferenceOption[]> {
  const all: ReferenceOption[] = [];

  // Product setup pages load these reference lists too. Fetch pages explicitly
  // so large vendor/type catalogs can be resolved by their human-readable names.
  for (let page = 1; page <= 100; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const response = await retailRequest<unknown>(
      `${path}${separator}page=${page}&limit=100`,
      { cache: "no-store" },
    );
    const data = recordsFrom(response, collectionKeys);

    all.push(
      ...data.flatMap((item) => {
        const id = fieldString(item.id).trim();
        const name = fieldString(item.name).trim();
        return id && name ? [{ id, name }] : [];
      }),
    );

    const wrapper = isRecord(response) ? response : {};
    const unwrapped = isRecord(wrapper.data) ? wrapper.data : wrapper;
    const pagination = isRecord(unwrapped.pagination)
      ? unwrapped.pagination
      : isRecord(wrapper.pagination)
        ? wrapper.pagination
        : {};
    const totalPages = Number(pagination.totalPages) || 1;
    if (page >= totalPages || data.length === 0) break;
  }

  return [...new Map(all.map((item) => [item.id, item])).values()];
}

function resolveReferenceId(
  value: string,
  options: ReferenceOption[],
  fieldLabel: string,
): string {
  const normalized = value.trim().toLowerCase();
  const match = options.find(
    (option) =>
      option.id === value.trim() || option.name.toLowerCase() === normalized,
  );

  if (!match) {
    throw new Error(`Could not find an existing ${fieldLabel} named or identified by "${value}".`);
  }

  return match.id;
}

function validateChanges(input: unknown): ProductBulkChanges {
  if (!isRecord(input)) {
    throw new Error("Invalid bulk-edit changes were supplied.");
  }

  const entries = Object.entries(input);
  if (entries.length === 0) {
    throw new Error("There are no changed fields to save.");
  }

  const changes: ProductBulkChanges = {};

  for (const [rawKey, rawValue] of entries) {
    // Explicitly reject ID or any field not enabled in this editor.
    if (!EDITABLE_FIELDS.has(rawKey as ProductBulkField)) {
      throw new Error(`The field "${rawKey}" cannot be edited in bulk.`);
    }

    if (typeof rawValue !== "string") {
      throw new Error(`The value for "${rawKey}" must be text.`);
    }

    if (rawKey === "status" && !ALLOWED_STATUSES.has(rawValue)) {
      throw new Error("Status must be ACTIVE, DRAFT, or ARCHIVED.");
    }

    if (rawKey === "name" && !rawValue.trim()) {
      throw new Error("Product title cannot be empty.");
    }

    if (rawKey === "slug" && !rawValue.trim()) {
      throw new Error("Product handle cannot be empty.");
    }

    if (rawKey === "vendor" && !rawValue.trim()) {
      throw new Error("Vendor cannot be empty.");
    }

    if (rawKey === "productType" && !rawValue.trim()) {
      throw new Error("Product type cannot be empty.");
    }

    changes[rawKey as ProductBulkField] = rawValue;
  }

  return changes;
}

/**
 * Bulk-edits selected products using small PATCH payloads containing only the
 * changed fields. Product IDs are routing keys, never editable payload fields.
 */
export async function bulkUpdateProducts(
  updates: ProductBulkUpdate[],
): Promise<BulkProductUpdateResult> {
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new Error("Select at least one product and change a field.");
  }

  if (updates.length > 50) {
    throw new Error("You can bulk edit up to 50 products from the current page.");
  }

  const normalized = updates.map((update) => {
    if (!isRecord(update)) throw new Error("Invalid product update row.");
    const id = fieldString(update.id).trim();
    if (!id) throw new Error("Every selected product must have a valid ID.");

    return {
      id,
      changes: validateChanges(update.changes),
    };
  });

  const ids = normalized.map((item) => item.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("A product was included more than once. Refresh the page and try again.");
  }

  const needsTags = normalized.some((item) =>
    Object.prototype.hasOwnProperty.call(item.changes, "tags"),
  );
  const needsVendors = normalized.some((item) =>
    Object.prototype.hasOwnProperty.call(item.changes, "vendor"),
  );
  const needsProductTypes = normalized.some((item) =>
    Object.prototype.hasOwnProperty.call(item.changes, "productType"),
  );

  const [initialTags, availableVendors, availableProductTypes] = await Promise.all([
    needsTags ? loadAllTagOptions() : Promise.resolve([] as TagOption[]),
    needsVendors
      ? referenceOptions("/brands", ["brands", "items", "results"])
      : Promise.resolve([] as ReferenceOption[]),
    needsProductTypes
      ? referenceOptions("/product-type", ["productTypes", "product-types", "items", "results"])
      : Promise.resolve([] as ReferenceOption[]),
  ]);

  let availableTags = initialTags;
  let createdTagNames: string[] = [];

  if (needsTags) {
    const requestedTagNames = [
      ...new Set(
        normalized.flatMap((item) => {
          const raw = item.changes.tags;
          return typeof raw === "string"
            ? raw.split(",").map((name) => name.trim()).filter(Boolean)
            : [];
        }),
      ),
    ];

    const ensured = await ensureTagsExist(requestedTagNames, availableTags);
    availableTags = ensured.tags;
    createdTagNames = ensured.createdNames;
  }

  const successIds: string[] = [];
  const failures: Array<{ id: string; message: string }> = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < normalized.length) {
      const item = normalized[nextIndex++];
      const { tags, vendor, productType, ...otherFields } = item.changes;
      const productFields: Record<string, string> = {};
      for (const [key, value] of Object.entries(otherFields)) {
        if (typeof value === "string") productFields[key] = value;
      }

      try {
        if (typeof vendor === "string") {
          productFields.brandId = resolveReferenceId(vendor, availableVendors, "vendor");
        }
        if (typeof productType === "string") {
          productFields.productTypeId = resolveReferenceId(productType, availableProductTypes, "product type");
        }

        if (Object.keys(productFields).length > 0) {
          await retailRequest(
            `/products/${encodeURIComponent(item.id)}`,
            {
              method: "PATCH",
              body: JSON.stringify(productFields),
            },
          );
        }

        if (typeof tags === "string") {
          await replaceProductTags(item.id, tags, availableTags);
        }

        successIds.push(item.id);
      } catch (error) {
        failures.push({
          id: item.id,
          message:
            error instanceof Error
              ? error.message
              : "Unknown API error.",
        });
      }
    }
  }

  // Limit concurrency so bulk edits don't overwhelm the retail API.
  await Promise.all(
    Array.from({ length: Math.min(5, normalized.length) }, () => worker()),
  );

  if (successIds.length > 0 || createdTagNames.length > 0) {
    updateTag(RETAIL_CATALOG_TAG);
    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/products/tags");
  }

  return { successIds, failures };
}
