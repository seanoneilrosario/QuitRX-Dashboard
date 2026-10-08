"use server";

import { revalidatePath } from "next/cache";
import { retailRequest } from "../../../lib/quitmed-retail-admin/collections/client";

type ExistingProductTag = {
  id: string;
  tagId: string;
};

function parseJson<T>(value: FormDataEntryValue | null, fallback: T): T {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function updateProductEditAction(
  productId: string,
  formData: FormData,
) {
  const description = String(
    formData.get("description") ?? "",
  );

  const shortDescription = String(
    formData.get("shortDescription") ?? "",
  );

  /*
   * 1. Update descriptions
   */
  await retailRequest(
    `/products/${encodeURIComponent(productId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        description: description || null,
        shortDescription: shortDescription || null,
      }),
      cache: "no-store",
    },
  );

  /*
   * 2. Read selected tags
   */
  const selectedTagIds = parseJson<string[]>(
    formData.get("tagIds"),
    [],
  );

  const newTagNames = parseJson<string[]>(
    formData.get("newTagNames"),
    [],
  );

  const existingProductTags =
    parseJson<ExistingProductTag[]>(
      formData.get("_existingProductTags"),
      [],
    );

  /*
   * 3. Create any new tags
   */
  const createdTagIds: string[] = [];

  for (const name of newTagNames) {
    const cleanName = name.trim();

    if (!cleanName) continue;

    const created = await retailRequest<{
      id: string;
    }>("/tags", {
      method: "POST",
      body: JSON.stringify({
        name: cleanName,
        slug: cleanName
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, ""),
      }),
      cache: "no-store",
    });

    if (created?.id) {
      createdTagIds.push(created.id);
    }
  }

  /*
   * 4. Build final tag list
   */
  const finalTagIds = Array.from(
    new Set([
      ...selectedTagIds,
      ...createdTagIds,
    ]),
  );

  /*
   * 5. Remove existing product-tag relationships
   */
  for (const relation of existingProductTags) {
    if (!relation.id) continue;

    await retailRequest(
      `/product-tags/${encodeURIComponent(
        relation.id,
      )}`,
      {
        method: "DELETE",
        cache: "no-store",
      },
    );
  }

  /*
   * 6. Add the new product-tag relationships
   */
  for (const tagId of finalTagIds) {
    await retailRequest("/product-tags", {
      method: "POST",
      body: JSON.stringify({
        productId,
        tagId,
      }),
      cache: "no-store",
    });
  }

  /*
   * 7. Replace product metafields
   */
  const attributes: {
    attributeId: string;
    attributeValueId: string;
  }[] = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("attribute_")) {
      continue;
    }

    if (typeof value !== "string") {
      continue;
    }

    const attributeId = key.replace(
      "attribute_",
      "",
    );

    const attributeValueId = value.trim();

    if (!attributeId || !attributeValueId) {
      continue;
    }

    attributes.push({
      attributeId,
      attributeValueId,
    });
  }

  await retailRequest(
    `/products/${encodeURIComponent(
      productId,
    )}/attributes`,
    {
      method: "PUT",
      body: JSON.stringify(attributes),
      cache: "no-store",
    },
  );

  revalidatePath(
    `/dashboard/products/edit?id=${encodeURIComponent(
      productId,
    )}`,
  );

  revalidatePath("/dashboard/products");

  return {
    success: true,
  };
}