"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { retailRequest } from "@/lib/quithero-admin";

const allowedResources = new Set([
  "products", "product-variants", "product-images", "product-options",
  "product-option-values", "tags", "collections", "customers",
]);

function payload(formData: FormData) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("_") || typeof value !== "string") continue;
    if (key === "tags") {
      result[key] = value.split(",").map((tag) => tag.trim()).filter(Boolean);
      continue;
    }
    if (value === "") continue;
    if (["price", "cost", "inventory", "allocatedInventory", "incomingInventory", "weight", "sortOrder"].includes(key)) {
      result[key] = Number(value);
    } else if (["requiresShipping", "isPrimary", "consultPurchase", "scriptActive"].includes(key)) {
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
