"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { retailRequest } from "@/lib/quithero-admin";
import type { CollectionRule } from "@/lib/quithero";
import { client } from "@/sanity/lib/client";

const allowedResources = new Set([
  "products", "product-variants", "product-images", "product-options",
  "product-option-values", "tags", "collections", "customers",
]);

function payload(formData: FormData) {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("_") || typeof value !== "string" || value === "") continue;
    if (["price", "cost", "inventory", "allocatedInventory", "incomingInventory", "weight", "sortOrder"].includes(key)) {
      result[key] = Number(value);
    } else if (["requiresShipping", "isPrimary", "scriptActive"].includes(key)) {
      result[key] = value === "true" || value === "on";
    } else result[key] = value;
  }
  return result;
}

export async function saveResource(formData: FormData) {
  const resource = String(formData.get("_resource") ?? "");
  const id = String(formData.get("_id") ?? "");
  const returnTo = String(formData.get("_returnTo") ?? "/dashboard");
  if (!allowedResources.has(resource)) throw new Error("Unsupported resource.");
  await retailRequest(`/${resource}${id ? `/${encodeURIComponent(id)}` : ""}`, {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify(payload(formData)),
  });
  revalidatePath("/dashboard", "layout");
  redirect(returnTo);
}

export async function deleteResource(formData: FormData) {
  const resource = String(formData.get("_resource") ?? "");
  const id = String(formData.get("_id") ?? "");
  if (!allowedResources.has(resource) || !id) throw new Error("Unsupported delete request.");
  await retailRequest(`/${resource}/${encodeURIComponent(id)}`, { method: "DELETE" });
  revalidatePath("/dashboard", "layout");
}

function responseRecord(payload: unknown) {
  if (!payload || typeof payload !== "object") return undefined;
  const wrapper = payload as Record<string, unknown>;
  const value = wrapper.data && typeof wrapper.data === "object" ? wrapper.data : wrapper;
  return value as Record<string, unknown>;
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

export async function createCollection(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim() || slugify(name);
  if (!name || !slug) throw new Error("Collection name and slug are required.");
  const selectionMode = formData.get("selectionMode") === "dynamic" ? "dynamic" : "manual";
  const ruleMatch = formData.get("ruleMatch") === "any" ? "any" : "all";
  const fields = new Set(["tag", "name", "brand", "productType", "status", "price", "inventory"]);
  const operators = new Set(["equals", "notEquals", "contains", "notContains", "greaterThan", "lessThan"]);
  let dynamicRules: CollectionRule[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("dynamicRules") ?? "[]")) as unknown;
    if (Array.isArray(parsed)) {
      dynamicRules = parsed.flatMap((rule) => {
        if (!rule || typeof rule !== "object") return [];
        const value = rule as Record<string, unknown>;
        const field = String(value.field ?? "");
        const operator = String(value.operator ?? "");
        const ruleValue = String(value.value ?? "").trim();
        return fields.has(field) && operators.has(operator) && ruleValue
          ? [{ field, operator, value: ruleValue } as CollectionRule]
          : [];
      });
    }
  } catch {
    throw new Error("Collection conditions are invalid.");
  }
  if (selectionMode === "dynamic" && !dynamicRules.length) throw new Error("At least one valid collection condition is required.");
  const productIds = selectionMode === "manual" ? [...new Set(formData.getAll("productIds").map(String).filter(Boolean))] : [];

  const collection = responseRecord(await retailRequest("/collections", {
    method: "POST",
    body: JSON.stringify({
      name,
      slug,
      description: String(formData.get("description") ?? "").trim() || undefined,
      image: String(formData.get("image") ?? "").trim() || undefined,
      seoTitle: String(formData.get("seoTitle") ?? "").trim() || undefined,
      seoDescription: String(formData.get("seoDescription") ?? "").trim() || undefined,
    }),
  }));
  const collectionId = typeof collection?.id === "string" ? collection.id : undefined;
  const documentId = `quithero-collection-${(collectionId ?? slug).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const featuredImageUrl = String(formData.get("image") ?? "").trim() || undefined;

  await client.withConfig({ useCdn: false }).createOrReplace({
    _id: documentId,
    _type: "productCollection",
    title: name,
    slug: { _type: "slug", current: slug },
    description: String(formData.get("description") ?? "").trim() || undefined,
    featuredImageUrl,
    quitHeroCollectionId: collectionId,
    productIds,
    selectionMode,
    ruleMatch,
    dynamicRules,
  });

  revalidatePath("/dashboard/collections");
  redirect("/dashboard/collections");
}
