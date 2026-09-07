"use server";

import { auth } from "@/auth";
import { revalidatePath, updateTag } from "next/cache";
import { retailRequest, RETAIL_CATALOG_TAG } from "@/lib/quithero-admin";
import { bundleComponents } from "@/lib/product-bundles";

export async function saveBundle(_previous: { message: string; success: boolean }, form: FormData) {
  const session = await auth();
  if (!(session?.user as { isStaff?: boolean } | undefined)?.isStaff) {
    return { message: "Please sign in as staff to save bundles.", success: false };
  }
  try {
    const productId = String(form.get("productId") ?? "").trim();
    const variantId = String(form.get("variantId") ?? "").trim();
    if (!productId || !variantId) throw new Error("Select a bundle variant first.");
    const components = bundleComponents(JSON.parse(String(form.get("components") ?? "")), variantId)
      .map((item, position) => ({ ...item, position }));
    await retailRequest(`/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/bundle`, {
      method: "PATCH", body: JSON.stringify(components),
    });
    updateTag(RETAIL_CATALOG_TAG);
    revalidatePath("/dashboard/bundles");
    return { message: "Bundle saved.", success: true };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "Unable to save bundle.", success: false };
  }
}
