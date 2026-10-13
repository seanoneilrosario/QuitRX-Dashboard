"use server";

import { revalidatePath, updateTag } from "next/cache";
import {
  retailRequest,
  RETAIL_CATALOG_TAG,
} from "@/lib/quitmed-retail-admin/collections/client";

export type ProductBulkStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";

export type BulkProductUpdateResult = {
  successIds: string[];
  failures: Array<{ id: string; message: string }>;
};

const ALLOWED_STATUSES = new Set<ProductBulkStatus>([
  "ACTIVE",
  "DRAFT",
  "ARCHIVED",
]);

/**
 * Updates the status field only. It deliberately does not send the full product
 * object, so unrelated product fields are left unchanged.
 */
export async function bulkUpdateProductsStatus(
  productIds: string[],
  status: ProductBulkStatus,
): Promise<BulkProductUpdateResult> {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    throw new Error("Select at least one product.");
  }

  // Current product list pages contain up to 50 products.
  if (productIds.length > 50) {
    throw new Error("You can bulk edit up to 50 products from the current page.");
  }

  if (!ALLOWED_STATUSES.has(status)) {
    throw new Error("Choose a valid product status.");
  }

  const ids = [...new Set(
    productIds
      .filter((id): id is string => typeof id === "string")
      .map((id) => id.trim())
      .filter(Boolean),
  )];

  if (ids.length === 0) {
    throw new Error("No valid product IDs were supplied.");
  }

  if (ids.length !== productIds.length) {
    throw new Error("The selected products contain duplicate or invalid IDs. Refresh the page and try again.");
  }

  const successIds: string[] = [];
  const failures: Array<{ id: string; message: string }> = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < ids.length) {
      const index = nextIndex++;
      const id = ids[index];

      try {
        await retailRequest(
          `/products/${encodeURIComponent(id)}`,
          {
            method: "PATCH",
            body: JSON.stringify({ status }),
          },
        );
        successIds.push(id);
      } catch (error) {
        failures.push({
          id,
          message: error instanceof Error ? error.message : "Unknown API error.",
        });
      }
    }
  }

  // Keep concurrency modest to avoid overwhelming the Retail API.
  const workerCount = Math.min(5, ids.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  if (successIds.length > 0) {
    updateTag(RETAIL_CATALOG_TAG);
    revalidatePath("/dashboard/products");
  }

  return { successIds, failures };
}
