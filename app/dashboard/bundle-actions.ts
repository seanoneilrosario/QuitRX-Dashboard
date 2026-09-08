"use server";

import { auth } from "@/auth";
import { retailRequest } from "@/lib/quithero-admin";
import { bundleComponentResponse, bundleComponents, type BundleSelection } from "@/lib/product-bundles";

export type BundleActionState = { message: string; success: boolean; selections?: BundleSelection[] };

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
