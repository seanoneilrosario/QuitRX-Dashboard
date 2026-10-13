
"use server";

import { revalidatePath } from "next/cache";
import { retailRequest } from "../../../lib/quitmed-retail-admin/collections/client";

type ExistingProductTag = {
  id: string;
  tagId: string;
};

type ProductAttributeInput = {
  attributeId: string;
  attributeValueId: string;
};

function parseJson<T>(
  value: FormDataEntryValue | null,
  fallback: T,
): T {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;

  if (
    record.data &&
    typeof record.data === "object" &&
    !Array.isArray(record.data)
  ) {
    return record.data as Record<string, unknown>;
  }

  return record;
}

export async function updateProductEditAction(
  productId: string,
  formData: FormData,
) {
  if (!productId.trim()) {
    throw new Error("A product ID is required.");
  }

  /*
   * 1. Update product descriptions.
   */
  const description = String(
    formData.get("description") ?? "",
  );

  const shortDescription = String(
    formData.get("shortDescription") ?? "",
  );

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
   * 2. Read selected existing tags and new tag names.
   */
  const rawSelectedTagIds = parseJson<unknown>(
    formData.get("tagIds"),
    [],
  );

  const selectedTagIds = (
    Array.isArray(rawSelectedTagIds)
      ? rawSelectedTagIds
      : []
  )
    .filter(
      (id): id is string => typeof id === "string",
    )
    .map((id) => id.trim())
    .filter(Boolean);

  const uniqueSelectedTagIds = [...new Set(selectedTagIds)];

  const rawNewTagNames = parseJson<unknown>(
    formData.get("newTagNames"),
    [],
  );

  const newTagNames = [
    ...new Set(
      (
        Array.isArray(rawNewTagNames)
          ? rawNewTagNames
          : []
      )
        .filter(
          (name): name is string =>
            typeof name === "string",
        )
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ];

  const rawExistingTags = parseJson<unknown>(
    formData.get("_existingProductTags"),
    [],
  );

  const existingProductTags: ExistingProductTag[] = (
    Array.isArray(rawExistingTags)
      ? rawExistingTags
      : []
  ).filter(
    (relation): relation is ExistingProductTag =>
      relation !== null &&
      typeof relation === "object" &&
      typeof relation.id === "string" &&
      typeof relation.tagId === "string",
  );

  /*
   * 3. Create new tags, or reuse an existing tag with
   *    the same slug. POST /tags returns the tag record.
   */
  const createdTagIds: string[] = [];

  for (const name of newTagNames) {
    const slug = slugify(name);

    if (!slug) {
      throw new Error(
        `The tag "${name}" does not produce a valid slug.`,
      );
    }

    const response = await retailRequest<unknown>(
      "/tags",
      {
        method: "POST",
        body: JSON.stringify({
          name,
          slug,
        }),
        cache: "no-store",
      },
    );

    const tag = extractRecord(response);

    if (typeof tag.id !== "string" || !tag.id) {
      throw new Error(
        `The API did not return an ID for tag "${name}".`,
      );
    }

    createdTagIds.push(tag.id);
  }

  /*
   * 4. Combine selected existing tags and newly created
   *    or reused tags.
   */
  const finalTagIds = [
    ...new Set([
      ...uniqueSelectedTagIds,
      ...createdTagIds,
    ]),
  ];

  const finalTagIdSet = new Set(finalTagIds);

  const existingTagIdSet = new Set(
    existingProductTags.map(
      (relation) => relation.tagId,
    ),
  );

  /*
   * 5. Remove only relationships for deselected tags.
   */
  for (const relation of existingProductTags) {
    if (finalTagIdSet.has(relation.tagId)) {
      continue;
    }

    await retailRequest(
      `/product-tags/${encodeURIComponent(relation.id)}`,
      {
        method: "DELETE",
        cache: "no-store",
      },
    );
  }

  /*
   * 6. Attach selected tags that are not already linked.
   */
  for (const tagId of finalTagIds) {
    if (existingTagIdSet.has(tagId)) {
      continue;
    }

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
   * 7. Collect selected metafield values.
   */
  const attributes: ProductAttributeInput[] = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("attribute_")) {
      continue;
    }

    if (typeof value !== "string") {
      continue;
    }

    const attributeId = key.slice(
      "attribute_".length,
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

  /*
   * 8. Replace product metafield selections.
   */
  await retailRequest(
    `/products/${encodeURIComponent(productId)}/attributes`,
    {
      method: "PUT",
      body: JSON.stringify(attributes),
      cache: "no-store",
    },
  );

  /*
   * 9. Refresh dashboard data.
   */
  revalidatePath("/dashboard/products/edit");
  revalidatePath("/dashboard/products");

  return {
    success: true,
  };
}
