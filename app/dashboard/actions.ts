"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { records, RETAIL_CATALOG_TAG, retailRequest } from "@/lib/quithero-admin";
import { deleteStorefrontCollection, syncStorefrontCollection } from "@/lib/sanity-storefront";

const allowedResources = new Set([
  "products",
  "product-variants",
  "product-images",
  "product-options",
  "product-option-values",
  "tags",
  "collections",
  "customers",
]);

function payload(formData: FormData) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("_") || key.startsWith("$ACTION_") || typeof value !== "string") continue;
    if (key === "productIds" || key === "rules") {
      try {
        result[key] = JSON.parse(value);
      } catch {
        throw new Error(`Invalid ${key}.`);
      }
      continue;
    }
    if (key === "tags") {
      result[key] = value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      continue;
    }
    if (value === "") continue;
    if (
      [
        "price",
        "inventory",
        "allocatedInventory",
        "incomingInventory",
        "weight",
        "sortOrder",
      ].includes(key)
    ) {
      result[key] = Number(value);
    } else if (["requiresShipping", "isPrimary", "consultPurchase", "scriptActive"].includes(key)) {
      result[key] = value === "true" || value === "on";
    } else result[key] = value;
  }
  return result;
}

export type CollectionActionState = { message: string; success: boolean };

function validateCollection(body: Record<string, unknown>, editing = false) {
  if (typeof body.name !== "string" || !body.name.trim())
    throw new Error("Collection name is required.");
  if (body.type !== "MANUAL" && body.type !== "DYNAMIC")
    throw new Error("Choose a valid collection type.");
  if (body.match !== "ALL" && body.match !== "ANY")
    throw new Error("Choose whether all or any rules must match.");
  if (body.type === "MANUAL") {
    if (
      !Array.isArray(body.productIds) ||
      (!editing && !body.productIds.length) ||
      body.productIds.some((id) => typeof id !== "string" || !id)
    )
      throw new Error("Select at least one product.");
    delete body.rules;
  } else {
    if (
      !Array.isArray(body.rules) ||
      !body.rules.length ||
      body.rules.some((rule) => {
        if (!rule || typeof rule !== "object") return true;
        const value = rule as Record<string, unknown>;
        return (
          !["name", "brand", "tag"].includes(String(value.field)) ||
          !["equals", "contains"].includes(String(value.operator)) ||
          typeof value.value !== "string" ||
          !value.value.trim()
        );
      })
    )
      throw new Error("Complete at least one valid collection rule.");
    if (
      !Array.isArray(body.productIds) ||
      body.productIds.some((id) => typeof id !== "string" || !id)
    )
      throw new Error("Invalid dynamic collection products.");
  }
}

export async function createCollection(
  _previous: CollectionActionState,
  formData: FormData,
): Promise<CollectionActionState> {
  try {
    const id = String(formData.get("_id") ?? "");
    const body = payload(formData);
    if (!body.slug && typeof body.name === "string") body.slug = slugify(body.name);
    validateCollection(body, Boolean(id));
    const retailBody = { ...body };
    if (retailBody.type === "DYNAMIC") delete retailBody.productIds;
    const saved = await retailRequest<unknown>(
      `/collections${id ? `/${encodeURIComponent(id)}` : ""}`,
      { method: id ? "PATCH" : "POST", body: JSON.stringify(retailBody) },
    );
    const wrapper = saved && typeof saved === "object" ? (saved as Record<string, unknown>) : {};
    const data =
      wrapper.data && typeof wrapper.data === "object"
        ? (wrapper.data as Record<string, unknown>)
        : wrapper;
    const collectionId = id || (typeof data.id === "string" ? data.id : "");
    if (!collectionId)
      throw new Error(
        "Collection was saved, but the Retail API did not return its ID for storefront sync.",
      );
    updateTag(RETAIL_CATALOG_TAG);
    revalidatePath("/dashboard/collections");
    try {
      await syncStorefrontCollection({
        id: collectionId,
        name: String(body.name),
        slug: String(body.slug),
        type: body.type as "MANUAL" | "DYNAMIC",
        match: body.match as "ALL" | "ANY",
        image: typeof body.image === "string" ? body.image : undefined,
        productIds: Array.isArray(body.productIds) ? (body.productIds as string[]) : undefined,
        rules: Array.isArray(body.rules)
          ? (body.rules as { field: string; operator: string; value: string }[])
          : undefined,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown storefront error.";
      return {
        message: `Collection was ${id ? "updated" : "created"} in the dashboard, but storefront sync failed: ${detail}`,
        success: true,
      };
    }
    return {
      message: `Collection “${String(body.name)}” was ${id ? "updated" : "created"}.`,
      success: true,
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Unable to create collection.",
      success: false,
    };
  }
}

export async function deleteCollection(
  _previous: CollectionActionState,
  formData: FormData,
): Promise<CollectionActionState> {
  const id = String(formData.get("_id") ?? "");
  if (!id) return { message: "Collection ID is required.", success: false };
  try {
    await retailRequest(`/collections/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ productIds: [] }),
    });
    await retailRequest(`/collections/${encodeURIComponent(id)}`, { method: "DELETE" });
    updateTag(RETAIL_CATALOG_TAG);
    revalidatePath("/dashboard/collections");
    try {
      await deleteStorefrontCollection(id);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown storefront error.";
      return {
        message: `Collection was deleted from the dashboard, but storefront cleanup failed: ${detail}`,
        success: true,
      };
    }
    return { message: "Collection deleted.", success: true };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Unable to delete collection.",
      success: false,
    };
  }
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type ExistingProductTag = { id: string; tagId: string };

function productTagSelection(formData: FormData) {
  const selected = String(formData.get("tags") ?? "")
    .split(",")
    .map((tagId) => tagId.trim())
    .filter(Boolean);
  let newTags: string[] = [];
  let existing: ExistingProductTag[] = [];
  try {
    const value = JSON.parse(String(formData.get("_existingProductTags") ?? "[]"));
    if (Array.isArray(value))
      existing = value.filter(
        (tag): tag is ExistingProductTag =>
          tag && typeof tag.id === "string" && typeof tag.tagId === "string",
      );
    const newValue = JSON.parse(String(formData.get("_newTags") ?? "[]"));
    if (Array.isArray(newValue))
      newTags = [
        ...new Set(
          newValue
            .filter((tag): tag is string => typeof tag === "string")
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ];
  } catch {
    throw new Error("Invalid existing product tags.");
  }
  return { selected, existing, newTags };
}

async function syncProductTags(
  productId: string,
  selected: string[],
  existing: ExistingProductTag[],
  newTags: string[],
) {
  const createdIds = await Promise.all(
    newTags.map(async (name) => {
      const response = await retailRequest<unknown>("/tags", {
        method: "POST",
        body: JSON.stringify({ name, slug: slugify(name) }),
      });
      const wrapper =
        response && typeof response === "object" ? (response as Record<string, unknown>) : {};
      const data =
        wrapper.data && typeof wrapper.data === "object"
          ? (wrapper.data as Record<string, unknown>)
          : wrapper;
      if (typeof data.id !== "string")
        throw new Error(`Tag "${name}" was created, but the Retail API did not return its ID.`);
      return data.id;
    }),
  );
  selected = [...selected, ...createdIds];
  const selectedIds = new Set(selected);
  const existingIds = new Set(existing.map((tag) => tag.tagId));
  await Promise.all([
    ...existing
      .filter((tag) => !selectedIds.has(tag.tagId))
      .map((tag) =>
        retailRequest(`/product-tags/${encodeURIComponent(tag.id)}`, { method: "DELETE" }),
      ),
    ...selected
      .filter((tagId) => !existingIds.has(tagId))
      .map((tagId) =>
        retailRequest("/product-tags", {
          method: "POST",
          body: JSON.stringify({ productId, tagId }),
        }),
      ),
  ]);
}

function productTagAssignmentUnsupported(error: unknown) {
  if (!(error instanceof Error) || !/^QuitHero API returned 400\b/.test(error.message)) {
    return false;
  }
  return error.message.includes("property productId should not exist")
    && error.message.includes("property tagId should not exist");
}

async function recoverCreatedProduct(body: Record<string, unknown>, error: unknown) {
  if (!(error instanceof Error) || !/^QuitHero API returned 5\d\d\b/.test(error.message))
    return undefined;
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!slug) return undefined;

  try {
    for (let page = 1; page <= 100; page += 1) {
      const response = await retailRequest<unknown>(`/products?page=${page}&limit=100`, {
        cache: "no-store",
      });
      const product = records(response).find(
        (item) => item.slug === slug && typeof item.id === "string",
      );
      if (product) return product;

      const wrapper =
        response && typeof response === "object" ? (response as Record<string, unknown>) : {};
      const pagination =
        wrapper.pagination && typeof wrapper.pagination === "object"
          ? (wrapper.pagination as Record<string, unknown>)
          : {};
      if (page >= (Number(pagination.totalPages) || 1)) break;
    }
    return undefined;
  } catch (recoveryError) {
    console.error("[QuitHero dashboard] Unable to verify whether product creation succeeded", {
      stage: "product-create-recovery",
      slug,
      recoveryError,
    });
    return undefined;
  }
}

async function persistResource(formData: FormData) {
  const resource = String(formData.get("_resource") ?? "");
  const id = String(formData.get("_id") ?? "");
  const returnTo = String(formData.get("_returnTo") ?? "/dashboard");
  if (!allowedResources.has(resource)) throw new Error("Unsupported resource.");
  const body = payload(formData);
  const productTags = resource === "products" ? productTagSelection(formData) : undefined;
  if (resource === "products") delete body.tags;
  if (resource === "collections" && !body.slug && typeof body.name === "string")
    body.slug = slugify(body.name);
  const method = id ? "PATCH" : "POST";
  const path = `/${resource}${id ? `/${encodeURIComponent(id)}` : ""}`;
  let saved: unknown;
  try {
    saved = await retailRequest<unknown>(path, { method, body: JSON.stringify(body) });
  } catch (error) {
    const recovered =
      resource === "products" && method === "POST"
        ? await recoverCreatedProduct(body, error)
        : undefined;
    if (recovered) {
      saved = recovered;
      console.warn(
        "[QuitHero dashboard] Product creation returned an error after being committed",
        {
          stage: "product-create-recovered",
          productId: recovered.id,
          slug: recovered.slug,
          error,
        },
      );
    } else {
      console.error("[QuitHero dashboard] Resource save request failed", {
        stage: "resource-save",
        resource,
        method,
        path,
        resourceId: id || undefined,
        fields: Object.keys(body),
        product:
          resource === "products"
            ? {
                name: body.name,
                slug: body.slug,
                brandId: body.brandId,
                productTypeId: body.productTypeId,
                status: body.status,
              }
            : undefined,
        error,
      });
      throw error;
    }
  }
  if (productTags) {
    const wrapper = saved && typeof saved === "object" ? (saved as Record<string, unknown>) : {};
    const data =
      wrapper.data && typeof wrapper.data === "object"
        ? (wrapper.data as Record<string, unknown>)
        : wrapper;
    const productId = id || (typeof data.id === "string" ? data.id : "");
    if (!productId)
      throw new Error("Product was saved, but the Retail API did not return its ID for tag sync.");
    try {
      await syncProductTags(
        productId,
        productTags.selected,
        productTags.existing,
        productTags.newTags,
      );
    } catch (error) {
      if (productTagAssignmentUnsupported(error)) {
        console.warn("[QuitHero dashboard] Product saved without tag assignments", {
          stage: "product-tag-sync-unsupported",
          productId,
          selectedTagIds: productTags.selected,
        });
      } else {
        console.error("[QuitHero dashboard] Product tag sync failed", {
          stage: "product-tag-sync",
          productId,
          selectedTagIds: productTags.selected,
          newTagNames: productTags.newTags,
          error,
        });
        throw error;
      }
    }
  }
  updateTag(RETAIL_CATALOG_TAG);
  revalidatePath("/dashboard", "layout");
  return returnTo;
}

export async function saveResource(formData: FormData) {
  redirect(await persistResource(formData));
}

export type ResourceActionState = { message: string; success: boolean };

export async function saveResourceWithState(
  _previous: ResourceActionState,
  formData: FormData,
): Promise<ResourceActionState> {
  let returnTo: string;
  try {
    returnTo = await persistResource(formData);
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Unable to save this resource.",
      success: false,
    };
  }
  redirect(returnTo);
}

export async function deleteResource(formData: FormData) {
  const resource = String(formData.get("_resource") ?? "");
  const id = String(formData.get("_id") ?? "");
  if (!allowedResources.has(resource) || !id) throw new Error("Unsupported delete request.");
  try {
    await retailRequest(`/${resource}/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (error) {
    const alreadyDeleted = error instanceof Error
      && /^QuitHero API returned 404\b/.test(error.message);
    if (!alreadyDeleted) throw error;

    console.info("[QuitHero dashboard] Delete target was already absent", {
      stage: "resource-delete-already-absent",
      resource,
      resourceId: id,
    });
  }
  updateTag(RETAIL_CATALOG_TAG);
  revalidatePath("/dashboard", "layout");
}
