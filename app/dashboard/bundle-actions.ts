"use server";

import { auth } from "@/auth";
import { revalidatePath, updateTag } from "next/cache";
import { RETAIL_CATALOG_TAG, retailRequest } from "@/lib/quithero-admin";
import { bundleComponentResponse, bundleComponents, type BundleSelection } from "@/lib/product-bundles";

export type BundleActionState = { message: string; success: boolean; selections?: BundleSelection[] };

function withTimeout<T>(promise: Promise<T>, milliseconds: number) {
  let timeout: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error("The Retail API is taking too long to confirm the deletion.")), milliseconds);
    }),
  ]).finally(() => clearTimeout(timeout));
}

function refreshBundleCatalog() {
  updateTag(RETAIL_CATALOG_TAG);
  revalidatePath("/dashboard", "layout");
}

export async function deleteBundle(productId: string, tagRelationshipIds: string[]): Promise<BundleActionState> {
  const session = await auth();
  if (!(session?.user as { isStaff?: boolean } | undefined)?.isStaff) {
    return { message: "Please sign in as staff to delete bundles.", success: false };
  }
  const id = productId.trim();
  if (!id) return { message: "Select a bundle to delete.", success: false };
  try {
    await withTimeout(retailRequest(`/products/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "ARCHIVED" }),
    }), 12_000);
    await Promise.allSettled(
      [...new Set(tagRelationshipIds.map((relationshipId) => relationshipId.trim()).filter(Boolean))]
        .map((relationshipId) => retailRequest(`/product-tags/${encodeURIComponent(relationshipId)}`, { method: "DELETE" })),
    );
    refreshBundleCatalog();
    return { message: "Bundle deleted and removed from the product catalog.", success: true };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "Unable to delete bundle.", success: false };
  }
}

export async function saveBundle(_previous: BundleActionState, form: FormData): Promise<BundleActionState> {
  const session = await auth();
  if (!(session?.user as { isStaff?: boolean } | undefined)?.isStaff) {
    return { message: "Please sign in as staff to save bundles.", success: false };
  }
  try {
    const productId = String(form.get("productId") ?? "").trim();
    const variantId = String(form.get("variantId") ?? "").trim();
    if (!productId || !variantId) throw new Error("Select a bundle variant first.");
    const components = bundleComponents(JSON.parse(String(form.get("components") ?? "")), variantId);
    await retailRequest(`/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/bundle`, {
      method: "PATCH", body: JSON.stringify(components),
    });
    const saved = await retailRequest<unknown>(`/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/bundle`);
    return { message: "Bundle saved.", success: true, selections: bundleComponentResponse(saved, variantId) };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "Unable to save bundle.", success: false };
  }
}
