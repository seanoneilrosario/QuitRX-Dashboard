"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { RETAIL_CATALOG_TAG, retailRequest } from "@/lib/quithero-admin";
import { syncStorefrontCollection } from "@/lib/sanity-storefront";

const allowedResources = new Set([
  "products", "product-variants", "product-images", "product-options",
  "product-option-values", "tags", "collections", "customers",
]);

function payload(formData: FormData) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("_") || typeof value !== "string") continue;
    if (key === "productIds" || key === "rules") {
      try { result[key] = JSON.parse(value); } catch { throw new Error(`Invalid ${key}.`); }
      continue;
    }
    if (key === "tags") {
      result[key] = value.split(",").map((tag) => tag.trim()).filter(Boolean);
      continue;
    }
    if (value === "") continue;
    if (["price", "inventory", "allocatedInventory", "incomingInventory", "weight", "sortOrder"].includes(key)) {
      result[key] = Number(value);
    } else if (["requiresShipping", "isPrimary", "consultPurchase", "scriptActive"].includes(key)) {
      result[key] = value === "true" || value === "on";
    } else result[key] = value;
  }
  return result;
}

export type CollectionActionState = { message: string; success: boolean };

function validateCollection(body: Record<string, unknown>, editing = false) {
  if (typeof body.name !== "string" || !body.name.trim()) throw new Error("Collection name is required.");
  if (body.type !== "MANUAL" && body.type !== "DYNAMIC") throw new Error("Choose a valid collection type.");
  if (body.match !== "ALL" && body.match !== "ANY") throw new Error("Choose whether all or any rules must match.");
  if (body.type === "MANUAL") {
    if (!Array.isArray(body.productIds) || (!editing && !body.productIds.length) || body.productIds.some((id) => typeof id !== "string" || !id)) throw new Error("Select at least one product.");
    delete body.rules;
  } else {
    if (!Array.isArray(body.rules) || !body.rules.length || body.rules.some((rule) => {
      if (!rule || typeof rule !== "object") return true;
      const value = rule as Record<string, unknown>;
      return !["name", "brand", "tag"].includes(String(value.field)) || !["equals", "contains"].includes(String(value.operator)) || typeof value.value !== "string" || !value.value.trim();
    })) throw new Error("Complete at least one valid collection rule.");
    delete body.productIds;
  }
}

export async function createCollection(_previous: CollectionActionState, formData: FormData): Promise<CollectionActionState> {
  try {
    const id = String(formData.get("_id") ?? "");
    const body = payload(formData);
    if (!body.slug && typeof body.name === "string") body.slug = slugify(body.name);
    validateCollection(body, Boolean(id));
    const saved = await retailRequest<unknown>(`/collections${id ? `/${encodeURIComponent(id)}` : ""}`, { method: id ? "PATCH" : "POST", body: JSON.stringify(body) });
    const wrapper = saved && typeof saved === "object" ? saved as Record<string, unknown> : {};
    const data = wrapper.data && typeof wrapper.data === "object" ? wrapper.data as Record<string, unknown> : wrapper;
    const collectionId = id || (typeof data.id === "string" ? data.id : "");
    if (!collectionId) throw new Error("Collection was saved, but the Retail API did not return its ID for storefront sync.");
    await syncStorefrontCollection({
      id: collectionId,
      name: String(body.name),
      slug: String(body.slug),
      type: body.type as "MANUAL" | "DYNAMIC",
      match: body.match as "ALL" | "ANY",
      image: typeof body.image === "string" ? body.image : undefined,
      productIds: Array.isArray(body.productIds) ? body.productIds as string[] : undefined,
      rules: Array.isArray(body.rules) ? body.rules as { field: string; operator: string; value: string }[] : undefined,
    });
    updateTag(RETAIL_CATALOG_TAG);
    revalidatePath("/dashboard/collections");
    return { message: `Collection “${String(body.name)}” was ${id ? "updated" : "created"}.`, success: true };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "Unable to create collection.", success: false };
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

export async function saveResource(formData: FormData) {
  const resource = String(formData.get("_resource") ?? "");
  const id = String(formData.get("_id") ?? "");
  const returnTo = String(formData.get("_returnTo") ?? "/dashboard");
  if (!allowedResources.has(resource)) throw new Error("Unsupported resource.");
  const body = payload(formData);
  if (resource === "collections" && !body.slug && typeof body.name === "string") body.slug = slugify(body.name);
  await retailRequest(`/${resource}${id ? `/${encodeURIComponent(id)}` : ""}`, {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify(body),
  });
  updateTag(RETAIL_CATALOG_TAG);
  revalidatePath("/dashboard", "layout");
  redirect(returnTo);
}

export async function deleteResource(formData: FormData) {
  const resource = String(formData.get("_resource") ?? "");
  const id = String(formData.get("_id") ?? "");
  if (!allowedResources.has(resource) || !id) throw new Error("Unsupported delete request.");
  await retailRequest(`/${resource}/${encodeURIComponent(id)}`, { method: "DELETE" });
  updateTag(RETAIL_CATALOG_TAG);
  revalidatePath("/dashboard", "layout");
}
