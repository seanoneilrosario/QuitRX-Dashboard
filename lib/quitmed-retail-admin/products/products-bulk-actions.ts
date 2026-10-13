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
  | "tags"
  | `attribute:${string}`;

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
export type ProductBulkAttributeValue = { id: string; value: string };
export type ProductBulkAttribute = {
  id: string;
  name: string;
  description: string;
  type: string;
  values: ProductBulkAttributeValue[];
};
export type ProductBulkAttributeAssignment = {
  id: string;
  productId: string;
  attributeId: string;
  attributeValueId: string;
};
export type ProductBulkAttributeData = {
  attributes: ProductBulkAttribute[];
  assignments: ProductBulkAttributeAssignment[];
  /** Tag labels read from the same selected-product detail requests used for attributes. */
  tagNamesByProductId: Record<string, string[]>;
};

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


function productTagRows(product: ApiRecord): unknown[] {
  if (Array.isArray(product.tags) && product.tags.length > 0) return product.tags;
  if (Array.isArray(product.productTags)) return product.productTags;
  if (Array.isArray(product.tags)) return product.tags;
  return [];
}

function productTagNames(product: ApiRecord): string[] {
  return [...new Set(productTagRows(product).flatMap((value) => {
    if (typeof value === "string") {
      const name = value.trim();
      return name ? [name] : [];
    }
    if (!isRecord(value)) return [];

    const linkedTag = record(value.tag);
    const name = fieldString(
      linkedTag.name ?? value.name ?? value.tagName ?? value.value,
    ).trim();
    return name ? [name] : [];
  }))];
}

function existingProductTags(product: ApiRecord): ExistingProductTag[] {
  return productTagRows(product).flatMap((value) => {
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

async function loadAllRecords(path: string, collectionKeys: string[]): Promise<ApiRecord[]> {
  // The attributes endpoint is a non-paginated reference endpoint. Its DTO
  // rejects `page` and `limit`, so request it without query parameters.
  if (path === "/attributes") {
    const response = await retailRequest<unknown>(path, { cache: "no-store" });
    const attributeRecords = recordsFrom(response, collectionKeys);
    return [...new Map(attributeRecords.flatMap((item) => {
      const id = fieldString(item.id).trim();
      return id ? [[id, item] as const] : [];
    })).values()];
  }

  const all: ApiRecord[] = [];

  for (let page = 1; page <= 100; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const response = await retailRequest<unknown>(
      `${path}${separator}page=${page}&limit=100`,
      { cache: "no-store" },
    );
    const pageRecords = recordsFrom(response, collectionKeys);
    all.push(...pageRecords);

    const wrapper = isRecord(response) ? response : {};
    const unwrapped = isRecord(wrapper.data) ? wrapper.data : wrapper;
    const pagination = isRecord(unwrapped.pagination)
      ? unwrapped.pagination
      : isRecord(wrapper.pagination)
        ? wrapper.pagination
        : {};
    const totalPages = Number(pagination.totalPages) || 1;
    if (page >= totalPages || pageRecords.length === 0) break;
  }

  return [...new Map(all.flatMap((item) => {
    const id = fieldString(item.id).trim();
    return id ? [[id, item] as const] : [];
  })).values()];
}

function normalizeAttributeDefinitions(records: ApiRecord[]): ProductBulkAttribute[] {
  return records.flatMap((attribute) => {
    const id = fieldString(attribute.id).trim();
    const name = fieldString(attribute.name).trim();
    if (!id || !name) return [];

    const values = recordsFrom(attribute, ["values"]).flatMap((value) => {
      const valueId = fieldString(value.id).trim();
      const label = fieldString(value.value ?? value.name).trim();
      return valueId && label ? [{ id: valueId, value: label }] : [];
    });

    return [{
      id,
      name,
      description: fieldString(attribute.description),
      type: fieldString(attribute.type).toUpperCase(),
      values,
    }];
  });
}

function normalizeAttributeAssignments(
  records: ApiRecord[],
  fallbackProductId = "",
): ProductBulkAttributeAssignment[] {
  return records.flatMap((item) => {
    const product = record(item.product);
    const attribute = record(item.attribute);
    const attributeValue = record(item.attributeValue);
    const valueAttribute = record(attributeValue.attribute);
    const productId = fieldString(item.productId ?? product.id ?? fallbackProductId).trim();
    const attributeId = fieldString(
      item.attributeId ?? attribute.id ?? attributeValue.attributeId ?? valueAttribute.id,
    ).trim();
    const attributeValueId = fieldString(item.attributeValueId ?? attributeValue.id).trim();
    const id = fieldString(item.id).trim();
    return id && productId && attributeId && attributeValueId
      ? [{ id, productId, attributeId, attributeValueId }]
      : [];
  });
}

function attributeAssignmentsFromProduct(
  response: unknown,
  productId: string,
): ProductBulkAttributeAssignment[] {
  const product = unwrapRecord(response);
  // The Retail API does not expose GET /product-attributes. Read the relation
  // included by GET /products/:id instead. Keep multiple keys for API versions
  // that name this relation differently.
  for (const key of ["productAttributes", "attributes", "attributeAssignments"]) {
    if (Array.isArray(product[key])) {
      return normalizeAttributeAssignments(
        (product[key] as unknown[]).filter(isRecord),
        productId,
      );
    }
  }
  throw new Error(
    `The product details response for ${productId} did not include product attribute assignments. The Retail API must return the product's productAttributes/attributes relation to bulk-edit attributes safely.`,
  );
}

/** Load custom attribute definitions and current value assignments for selected products. */
export async function getProductBulkAttributeData(
  productIds: string[],
): Promise<ProductBulkAttributeData> {
  const ids = [...new Set(productIds.map((id) => String(id).trim()).filter(Boolean))];
  if (ids.length === 0) {
    return { attributes: [], assignments: [], tagNamesByProductId: {} };
  }
  if (ids.length > 50) throw new Error("Load attributes for at most 50 selected products.");

  async function loadSelectedProductDetails(): Promise<Array<{ id: string; response: unknown }>> {
    const loaded: Array<{ id: string; response: unknown } | undefined> = new Array(ids.length);
    let nextIndex = 0;

    async function worker(): Promise<void> {
      while (true) {
        const index = nextIndex++;
        if (index >= ids.length) return;
        const id = ids[index];
        const response = await retailRequest<unknown>(
          `/products/${encodeURIComponent(id)}`,
          { cache: "no-store" },
        );
        loaded[index] = { id, response };
      }
    }

    // At most two detail reads at a time, even if all 50 visible products are selected.
    await Promise.all(
      Array.from({ length: Math.min(2, ids.length) }, () => worker()),
    );

    return loaded.filter(
      (item): item is { id: string; response: unknown } => item !== undefined,
    );
  }

  const [attributeRecords, productDetails] = await Promise.all([
    loadAllRecords("/attributes", ["attributes", "items", "results"]),
    loadSelectedProductDetails(),
  ]);

  const assignments = productDetails.flatMap(({ id, response }) =>
    attributeAssignmentsFromProduct(response, id),
  );

  const tagNamesByProductId = Object.fromEntries(
    productDetails.map(({ id, response }) => [
      id,
      productTagNames(unwrapRecord(response)),
    ]),
  );

  return {
    attributes: normalizeAttributeDefinitions(attributeRecords),
    assignments,
    tagNamesByProductId,
  };
}

type PendingProductAttributeChange = {
  attribute: ProductBulkAttribute;
  rawValue: string;
};

/**
 * Replace the selected product's complete attribute assignment list through
 * PUT /products/:productId/attributes, matching the NestJS ProductsController.
 */
async function replaceProductAttributes(
  productId: string,
  changes: PendingProductAttributeChange[],
  currentAssignments: ProductBulkAttributeAssignment[],
): Promise<void> {
  const assignments = new Map<string, { attributeId: string; attributeValueId: string }>();

  // Start with the product's existing assignments so editing one attribute
  // doesn't remove other attributes that weren't changed in the grid.
  for (const item of currentAssignments) {
    if (item.productId !== productId) continue;
    assignments.set(`${item.attributeId}:${item.attributeValueId}`, {
      attributeId: item.attributeId,
      attributeValueId: item.attributeValueId,
    });
  }

  // Apply all changed attributes in memory, then send a single replacement
  // request because the API's replaceProductAttributes method deletes and
  // recreates the product's full assignment list.
  for (const change of changes) {
    const { attribute, rawValue } = change;
    const requestedLabels = [...new Set(
      rawValue.split(",").map((value) => value.trim()).filter(Boolean),
    )];

    if (attribute.type !== "MULTI_SELECT" && requestedLabels.length > 1) {
      throw new Error(`Attribute "${attribute.name}" accepts only one value.`);
    }

    const selectedValueIds = requestedLabels.map((requested) => {
      const match = attribute.values.find((option) =>
        option.id === requested || option.value.toLowerCase() === requested.toLowerCase(),
      );
      if (!match) {
        throw new Error(`Unknown value "${requested}" for attribute "${attribute.name}".`);
      }
      return match.id;
    });

    for (const [key, assignment] of assignments.entries()) {
      if (assignment.attributeId === attribute.id) assignments.delete(key);
    }

    for (const attributeValueId of selectedValueIds) {
      assignments.set(`${attribute.id}:${attributeValueId}`, {
        attributeId: attribute.id,
        attributeValueId,
      });
    }
  }

  await retailRequest(
    `/products/${encodeURIComponent(productId)}/attributes`,
    {
      method: "PUT",
      body: JSON.stringify([...assignments.values()]),
    },
  );
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
    const isAttributeField = rawKey.startsWith("attribute:") && rawKey.slice("attribute:".length).trim().length > 0;
    if (!EDITABLE_FIELDS.has(rawKey as ProductBulkField) && !isAttributeField) {
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
  const changedAttributeIds = [...new Set(normalized.flatMap((item) =>
    Object.keys(item.changes)
      .filter((key) => key.startsWith("attribute:"))
      .map((key) => key.slice("attribute:".length)),
  ))];
  const attributeProductIds = normalized
    .filter((item) => Object.keys(item.changes).some((key) => key.startsWith("attribute:")))
    .map((item) => item.id);
  const needsAttributes = changedAttributeIds.length > 0;

  const requestedTagNames = needsTags
    ? [...new Set(normalized.flatMap((item) => {
        const raw = item.changes.tags;
        return typeof raw === "string"
          ? raw.split(",").map((name) => name.trim()).filter(Boolean)
          : [];
      }))]
    : [];

  const [initialTags, availableVendors, availableProductTypes, attributeData] = await Promise.all([
    needsTags && requestedTagNames.length > 0
      ? loadAllTagOptions()
      : Promise.resolve([] as TagOption[]),
    needsVendors
      ? referenceOptions("/brands", ["brands", "items", "results"])
      : Promise.resolve([] as ReferenceOption[]),
    needsProductTypes
      ? referenceOptions("/product-type", ["productTypes", "product-types", "items", "results"])
      : Promise.resolve([] as ReferenceOption[]),
    needsAttributes
      ? getProductBulkAttributeData(attributeProductIds)
      : Promise.resolve({ attributes: [], assignments: [], tagNamesByProductId: {} } as ProductBulkAttributeData),
  ]);

  let availableTags = initialTags;
  let createdTagNames: string[] = [];

  if (needsTags) {
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
      const attributeChanges = Object.fromEntries(
        Object.entries(otherFields).filter(([key]) => key.startsWith("attribute:")),
      );
      const productFields: Record<string, string> = {};
      for (const [key, value] of Object.entries(otherFields)) {
        if (!key.startsWith("attribute:") && typeof value === "string") productFields[key] = value;
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

        const pendingAttributeChanges: PendingProductAttributeChange[] = [];
        for (const [key, value] of Object.entries(attributeChanges)) {
          if (typeof value !== "string") continue;
          const attributeId = key.slice("attribute:".length);
          const attribute = attributeData.attributes.find((candidate) => candidate.id === attributeId);
          if (!attribute) throw new Error(`Attribute "${attributeId}" is no longer available. Refresh and try again.`);
          pendingAttributeChanges.push({ attribute, rawValue: value });
        }
        if (pendingAttributeChanges.length > 0) {
          await replaceProductAttributes(item.id, pendingAttributeChanges, attributeData.assignments);
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

  // Keep API write concurrency deliberately low to avoid bursts against Retail API.
  await Promise.all(
    Array.from({ length: Math.min(2, normalized.length) }, () => worker()),
  );

  if (successIds.length > 0 || createdTagNames.length > 0) {
    updateTag(RETAIL_CATALOG_TAG);
    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/products/tags");
  }

  return { successIds, failures };
}
