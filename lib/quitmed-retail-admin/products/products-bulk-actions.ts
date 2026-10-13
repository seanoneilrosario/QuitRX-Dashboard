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
export type ProductBulkTagAssignment = {
  id: string;
  productId: string;
  tagId: string;
  tagName: string;
};
export type ProductBulkTagOption = { id: string; name: string };
export type ProductBulkAttributeData = {
  attributes: ProductBulkAttribute[];
  assignments: ProductBulkAttributeAssignment[];
  tagAssignments: ProductBulkTagAssignment[];
  availableTagOptions: ProductBulkTagOption[];
  availableVendors: ReferenceOption[];
  availableProductTypes: ReferenceOption[];
  tagNamesByProductId: Record<string, string[]>;
};
export type ProductBulkAttributeDataOptions = {
  includeAttributes?: boolean;
  includeTags?: boolean;
  /** Resolve only these tag names; avoid downloading the whole tag catalog. */
  tagNames?: string[];
  /** Resolve only these vendor names/IDs; avoid downloading every brand page. */
  vendorNames?: string[];
  /** Resolve only these product-type names/IDs; avoid downloading every type page. */
  productTypeNames?: string[];
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


function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
      // Do not re-download the entire tag catalog after a failed create.
      // Surface the API error so the user can correct it or safely retry.
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
  currentTagAssignments: ProductBulkTagAssignment[],
): Promise<void> {
  // Reuse the tag rows returned by the narrow metadata endpoint instead of
  // fetching the full product record just to get its tag relationships.
  const existing: ExistingProductTag[] = currentTagAssignments
    .filter((tag) => tag.productId === productId)
    .map(({ id, tagId }) => ({ id, tagId }));
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

/**
 * Load only selected products' bulk-edit metadata from a narrowly scoped API
 * endpoint. Flags let the save flow request only the relation type it changes.
 */
export async function getProductBulkAttributeData(
  productIds: string[],
  options: ProductBulkAttributeDataOptions = {},
): Promise<ProductBulkAttributeData> {
  const ids = [...new Set(productIds.map((id) => String(id).trim()).filter(Boolean))];
  const tagNames = [...new Set((options.tagNames ?? []).map((name) => name.trim()).filter(Boolean))];
  const vendorNames = [...new Set((options.vendorNames ?? []).map((name) => name.trim()).filter(Boolean))];
  const productTypeNames = [...new Set((options.productTypeNames ?? []).map((name) => name.trim()).filter(Boolean))];
  const emptyData: ProductBulkAttributeData = {
    attributes: [],
    assignments: [],
    tagAssignments: [],
    availableTagOptions: [],
    availableVendors: [],
    availableProductTypes: [],
    tagNamesByProductId: {},
  };

  if (ids.length > 50) throw new Error("Load metadata for at most 50 selected products.");

  const includeAttributes = options.includeAttributes ?? true;
  const includeTags = options.includeTags ?? true;
  const needsReferences = vendorNames.length > 0 || productTypeNames.length > 0;
  if (ids.length === 0 && !needsReferences) return emptyData;
  if (!includeAttributes && !includeTags && !needsReferences) return emptyData;

  const response = await retailRequest<unknown>("/products/bulk-edit-data", {
    method: "POST",
    body: JSON.stringify({
      productIds: ids,
      includeAttributes,
      includeTags,
      ...(tagNames.length > 0 ? { tagNames } : {}),
      ...(vendorNames.length > 0 ? { vendorNames } : {}),
      ...(productTypeNames.length > 0 ? { productTypeNames } : {}),
    }),
    cache: "no-store",
  });
  const payload = unwrapRecord(response);

  const attributes = includeAttributes
    ? normalizeAttributeDefinitions(recordsFrom(payload, ["attributes", "items", "results"]))
    : [];
  const assignments = includeAttributes
    ? normalizeAttributeAssignments(recordsFrom(payload, ["assignments"]))
    : [];
  const tagAssignments: ProductBulkTagAssignment[] = includeTags
    ? recordsFrom(payload, ["tagAssignments"]).flatMap((item) => {
        const id = fieldString(item.id).trim();
        const productId = fieldString(item.productId).trim();
        const tagId = fieldString(item.tagId).trim();
        const tagName = fieldString(item.tagName).trim();
        return id && productId && tagId
          ? [{ id, productId, tagId, tagName }]
          : [];
      })
    : [];

  const availableTagOptions: ProductBulkTagOption[] = recordsFrom(payload, ["availableTagOptions", "matchingTags"]).flatMap((tag) => {
    const id = fieldString(tag.id).trim();
    const name = fieldString(tag.name).trim();
    return id && name ? [{ id, name }] : [];
  });
  const availableVendors: ReferenceOption[] = recordsFrom(payload, ["availableVendors", "vendors"]).flatMap((item) => {
    const id = fieldString(item.id).trim();
    const name = fieldString(item.name).trim();
    return id && name ? [{ id, name }] : [];
  });
  const availableProductTypes: ReferenceOption[] = recordsFrom(payload, ["availableProductTypes", "productTypes"]).flatMap((item) => {
    const id = fieldString(item.id).trim();
    const name = fieldString(item.name).trim();
    return id && name ? [{ id, name }] : [];
  });

  const tagNamesByProductId: Record<string, string[]> = {};
  if (includeTags) {
    for (const id of ids) tagNamesByProductId[id] = [];
    for (const assignment of tagAssignments) {
      const name = assignment.tagName.trim();
      if (!name || !tagNamesByProductId[assignment.productId]) continue;
      if (!tagNamesByProductId[assignment.productId].includes(name)) {
        tagNamesByProductId[assignment.productId].push(name);
      }
    }
  }

  return {
    attributes,
    assignments,
    tagAssignments,
    availableTagOptions,
    availableVendors,
    availableProductTypes,
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
  const tagProductIds = normalized
    .filter((item) => Object.prototype.hasOwnProperty.call(item.changes, "tags"))
    .map((item) => item.id);
  const needsAttributes = changedAttributeIds.length > 0;
  const metadataProductIds = [...new Set([...attributeProductIds, ...tagProductIds])];

  const requestedTagNames = needsTags
    ? [...new Set(normalized.flatMap((item) => {
        const raw = item.changes.tags;
        return typeof raw === "string"
          ? raw.split(",").map((name) => name.trim()).filter(Boolean)
          : [];
      }))]
    : [];
  const requestedVendorNames = needsVendors
    ? [...new Set(normalized.flatMap((item) => typeof item.changes.vendor === "string" ? [item.changes.vendor.trim()] : []).filter(Boolean))]
    : [];
  const requestedProductTypeNames = needsProductTypes
    ? [...new Set(normalized.flatMap((item) => typeof item.changes.productType === "string" ? [item.changes.productType.trim()] : []).filter(Boolean))]
    : [];

  const needsMetadata = needsAttributes || needsTags || needsVendors || needsProductTypes;
  const attributeData = needsMetadata
    ? await getProductBulkAttributeData(metadataProductIds, {
        includeAttributes: needsAttributes,
        includeTags: needsTags,
        ...(requestedTagNames.length > 0 ? { tagNames: requestedTagNames } : {}),
        ...(requestedVendorNames.length > 0 ? { vendorNames: requestedVendorNames } : {}),
        ...(requestedProductTypeNames.length > 0 ? { productTypeNames: requestedProductTypeNames } : {}),
      })
    : {
        attributes: [],
        assignments: [],
        tagAssignments: [],
        availableTagOptions: [],
        availableVendors: [],
        availableProductTypes: [],
        tagNamesByProductId: {},
      } as ProductBulkAttributeData;
  const availableVendors = attributeData.availableVendors;
  const availableProductTypes = attributeData.availableProductTypes;

  let availableTags = needsTags ? attributeData.availableTagOptions : [];
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
          await replaceProductTags(item.id, tags, availableTags, attributeData.tagAssignments);
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
