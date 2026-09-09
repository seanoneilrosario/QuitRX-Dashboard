"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { syncFrequentlyBoughtTogether } from "@/lib/sanity-storefront";

export type RecommendationActionState = { message: string; success: boolean };

export async function saveFrequentlyBoughtTogether(
  _previous: RecommendationActionState,
  formData: FormData,
): Promise<RecommendationActionState> {
  const session = await auth();
  if (!(session?.user as { isStaff?: boolean } | undefined)?.isStaff) {
    return { message: "Please sign in as staff to save recommendations.", success: false };
  }

  try {
    const productId = String(formData.get("productId") ?? "").trim();
    if (!productId) throw new Error("Product ID is required.");
    const value: unknown = JSON.parse(String(formData.get("relatedProductIds") ?? "[]"));
    if (!Array.isArray(value) || value.some((id) => typeof id !== "string" || !id.trim())) {
      throw new Error("The recommendation list is invalid.");
    }
    const relatedProductIds = [...new Set(value as string[])];
    if (relatedProductIds.includes(productId)) throw new Error("A product cannot recommend itself.");
    if (relatedProductIds.length > 12) throw new Error("Choose no more than 12 recommendations.");

    await syncFrequentlyBoughtTogether(productId, relatedProductIds);
    revalidatePath(`/dashboard/products/edit?id=${encodeURIComponent(productId)}`);
    return { message: relatedProductIds.length ? "Frequently Bought Together products saved." : "Frequently Bought Together products cleared.", success: true };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "Unable to save recommendations.", success: false };
  }
}
