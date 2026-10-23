"use server";

import {
  revalidatePath,
  updateTag,
} from "next/cache";

import {
  retailRequest,
  RETAIL_CATALOG_TAG,
} from "./client";
import { getCollectionEditProducts, safeCollectionPage } from "./collections";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

export type CollectionActionState = {
  message: string;
  success: boolean;
};

export type CollectionRule = {
  field:
    | "name"
    | "description"
    | "sku"
    | "tags"
    | "brand"
    | "productType"
    | "price"
    | "inventory";

  operator:
    | "contains"
    | "not_contains"
    | "equals"
    | "not_equals"
    | "greater_than"
    | "less_than";

  value: string | number;
};

type CollectionSortBy =
  | "RELEVANCE"
  | "MANUAL"
  | "BEST_SELLING"
  | "TITLE_ASC"
  | "TITLE_DESC"
  | "PRICE_ASC"
  | "PRICE_DESC"
  | "NEWEST"
  | "OLDEST";

type CollectionPayload = {
  name: string;
  slug: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  type: "MANUAL" | "DYNAMIC";
  match: "ALL" | "ANY";
  sortBy: CollectionSortBy;
  productIds: string[];
  rules: CollectionRule[];
};

function getString(
  formData: FormData,
  key: string,
) {
  const value = formData.get(key);

  return typeof value === "string"
    ? value.trim()
    : "";
}

function parseJson<T>(
  value: FormDataEntryValue | null,
  fallback: T,
): T {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(
      `Invalid ${String(value)}.`,
    );
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

function collectionRecord(
  payload: unknown,
) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return {};
  }

  const wrapper =
    payload as Record<string, unknown>;

  if (
    wrapper.data &&
    typeof wrapper.data === "object" &&
    !Array.isArray(wrapper.data)
  ) {
    return wrapper.data as Record<
      string,
      unknown
    >;
  }

  return wrapper;
}

function buildCollectionPayload(
  formData: FormData,
): CollectionPayload {
  const name = getString(
    formData,
    "name",
  );

  const manualProductIds =
  parseJson<string[]>(
    formData.get("manualProductIds"),
    [],
  );

  const slug =
    getString(formData, "slug") ||
    slugify(name);

  const type =
    getString(formData, "type") as
      | "MANUAL"
      | "DYNAMIC";

  const match =
    getString(formData, "match") as
      | "ALL"
      | "ANY";

  const sortBy = getString(formData, "sortBy") as CollectionSortBy;

  const productIds =
    parseJson<string[]>(
      formData.get("productIds"),
      [],
    );

  const rules =
    parseJson<CollectionRule[]>(
      formData.get("rules"),
      [],
    );

  return {
    name,
    slug,
    description:
      getString(formData, "description") || undefined,
    seoTitle:
      getString(formData, "seoTitle") || undefined,
    seoDescription:
      getString(formData, "seoDescription") || undefined,
    type,
    match,
    sortBy,
    productIds,
    rules,
  };
}

function validateCollection(
  body: CollectionPayload,
  editing: boolean,
) {
  if (!body.name) {
    throw new Error(
      "Collection name is required.",
    );
  }

  if (
    body.type !== "MANUAL" &&
    body.type !== "DYNAMIC"
  ) {
    throw new Error(
      "Choose a valid collection type.",
    );
  }

  if (
    body.match !== "ALL" &&
    body.match !== "ANY"
  ) {
    throw new Error(
      "Choose whether all or any rules must match.",
    );
  }

    if (
    body.match !== "ALL" &&
    body.match !== "ANY"
  ) {
    throw new Error(
      "Choose whether all or any rules must match.",
    );
  }

  // Validate the selected collection sort option.
  const validSortOptions: CollectionSortBy[] = [
    "RELEVANCE",
    "MANUAL",
    "BEST_SELLING",
    "TITLE_ASC",
    "TITLE_DESC",
    "PRICE_ASC",
    "PRICE_DESC",
    "NEWEST",
    "OLDEST",
  ];

  if (!validSortOptions.includes(body.sortBy)) {
    throw new Error(
      "Choose a valid collection sort option.",
    );
  }

  if (body.type === "MANUAL") {
    if (
      !editing &&
      body.productIds.length === 0
    ) {
      throw new Error(
        "Select at least one product.",
      );
    }

    if (
      body.productIds.some(
        (id) =>
          typeof id !== "string" ||
          !id.trim(),
      )
    ) {
      throw new Error(
        "Invalid collection product IDs.",
      );
    }

    return;
  }

  if (body.rules.length === 0) {
    throw new Error(
      "Add at least one collection rule.",
    );
  }

  for (const rule of body.rules) {
    if (
      !rule ||
      typeof rule !== "object"
    ) {
      throw new Error(
        "Invalid collection rule.",
      );
    }

    if (!rule.field) {
      throw new Error(
        "Each collection rule needs a field.",
      );
    }

    if (!rule.operator) {
      throw new Error(
        "Each collection rule needs an operator.",
      );
    }

    if (
      rule.value === undefined ||
      String(rule.value).trim() === ""
    ) {
      throw new Error(
        "Each collection rule needs a value.",
      );
    }
  }

  // Dynamic collections are calculated
  // from rules by the backend.
  body.productIds = [];
}

export async function createCollection(
  _previous: CollectionActionState,
  formData: FormData,
): Promise<CollectionActionState> {
  try {
    console.log("[Collection Save] Action started");

    const session = await auth();
    console.log("[Collection Save] Session checked");

    const staffUser = session?.user as
      | {
          isStaff?: boolean;
          accessToken?: string;
        }
      | undefined;

    if (!staffUser?.isStaff) {
      throw new Error("You must be signed in as staff to save collections.");
    }

    if (!staffUser.accessToken) {
      throw new Error(
        "Your staff session does not include an access token. Please sign in again.",
      );
    }

    const id = getString(
      formData,
      "_id",
    );
    console.log("[Collection Save] Collection ID:", id);

    const editing = Boolean(id);

    const body =
      buildCollectionPayload(formData);
    console.log("[Collection Save] Payload:", {
      type: body.type,
      productCount: body.productIds.length,
      productIds: body.productIds,
    });

    validateCollection(
      body,
      editing,
    );
    console.log("[Collection Save] Validation passed");

    console.log("[Collection Save] Before API request", {
      id,
      type: body.type,
      rules: body.rules,
    });
    const path = id
      ? `/collections/${encodeURIComponent(id)}`
      : "/collections";
    console.log("[Collection Save] Request path:", path);

    const saved =
      await retailRequest<unknown>(
        path,
        {
          method: id
            ? "PATCH"
            : "POST",
          body: JSON.stringify(
            body,
          ),
        },
      );
    console.log("[Collection Save] API response:", saved);

    const savedRecord =
      collectionRecord(saved);

    const collectionId =
      id ||
      (typeof savedRecord.id ===
      "string"
        ? savedRecord.id
        : "");

    if (!collectionId) {
      throw new Error(
        "Collection was saved but no collection ID was returned.",
      );
    }

    const manualProductIdsRaw = formData.get("manualProductIds");

    const orderedProductIds =
      body.type === "DYNAMIC"
        ? parseJson<string[]>(manualProductIdsRaw, [])
        : body.productIds;

    console.log("[Collection Reorder Debug]", {
      collectionId,
      collectionType: body.type,
      rules: body.rules,
      match: body.match,
      rawManualProductIdsType: typeof manualProductIdsRaw,
      rawManualProductIdsLength:
        typeof manualProductIdsRaw === "string"
          ? manualProductIdsRaw.length
          : null,
      submittedCount: orderedProductIds.length,
      uniqueCount: new Set(orderedProductIds).size,
      duplicateIds: orderedProductIds.filter(
        (id, index, ids) => ids.indexOf(id) !== index,
      ),
      submittedIds: orderedProductIds,
    });

    if (orderedProductIds.length > 0) {
      await reorderCollectionProducts(collectionId, orderedProductIds);
    }

    const imageFile =
      formData.get("_imageFile");

    if (
      imageFile instanceof File &&
      imageFile.size > 0
    ) {
      if (
        ![
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
        ].includes(imageFile.type)
      ) {
        throw new Error(
          "Choose a JPEG, PNG, WebP or GIF image.",
        );
      }

      if (
        imageFile.size >
        4 * 1024 * 1024
      ) {
        throw new Error(
          "Image must be 4 MB or smaller.",
        );
      }

      const upload =
        new FormData();

      upload.set(
        "image",
        imageFile,
      );

      console.log(upload, `/collections/${encodeURIComponent(collectionId)}/image`)

      await retailRequest(
        `/collections/${encodeURIComponent(collectionId)}/image`,
        {
          method: "POST",
          body: upload,
          cache: "no-store",
        },
      );
    }

    updateTag(
      RETAIL_CATALOG_TAG,
    );

    revalidatePath(
      "/dashboard/collections",
    );

    revalidatePath(
      `/dashboard/collections/edit?id=${encodeURIComponent(
        collectionId,
      )}`,
    );

  } catch (error) {
    console.error("[Collection Save] FAILED:", error);

    return {
      message:
        error instanceof Error
          ? error.message
          : "Unable to save collection.",
      success: false,
    };
  }

  redirect("/dashboard/collections");
}

type PreviewSort =
  | "RELEVANCE"
  | "MANUAL"
  | "BEST_SELLING"
  | "TITLE_ASC"
  | "TITLE_DESC"
  | "PRICE_ASC"
  | "PRICE_DESC"
  | "NEWEST"
  | "OLDEST";

type ApiPreviewSort =
  | "relevance"
  | "manual"
  | "best_selling"
  | "title_asc"
  | "title_desc"
  | "price_asc"
  | "price_desc"
  | "newest"
  | "oldest";

function toApiPreviewSort(sortBy: PreviewSort): ApiPreviewSort {
  const sortMap: Record<PreviewSort, ApiPreviewSort> = {
    RELEVANCE: "relevance",
    MANUAL: "manual",
    BEST_SELLING: "best_selling",
    TITLE_ASC: "title_asc",
    TITLE_DESC: "title_desc",
    PRICE_ASC: "price_asc",
    PRICE_DESC: "price_desc",
    NEWEST: "newest",
    OLDEST: "oldest",
  };

  return sortMap[sortBy];
}

export async function previewCollection(
  match: "ALL" | "ANY",
  rules: CollectionRule[],
  page = 1,
  limit = 50,
  sortBy: PreviewSort = "RELEVANCE",
  collectionId?: string,
) {
const safePage = Math.max(1, Math.floor(page));

const safeLimit = Math.min(
100,
Math.max(1, Math.floor(limit)),
);

try {
const payload = await retailRequest<unknown>(
'/collections/preview',
{
method: 'POST',
body: JSON.stringify({
  match,
  rules,
  page: safePage,
  limit: safeLimit,
  sortBy: toApiPreviewSort(sortBy),
  ...(collectionId ? { collectionId } : {}),
}),
cache: 'no-store',
},
);

if (
  !payload ||
  typeof payload !== 'object' ||
  Array.isArray(payload)
) {
  return {
    data: [],
    count: 0,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: 0,
      totalPages: 1,
    },
    error: undefined,
  };
}

const wrapper = payload as Record<string, unknown>;

const rawData = Array.isArray(wrapper.data)
  ? wrapper.data
  : [];

const data = rawData.flatMap((item) => {
  if (
    !item ||
    typeof item !== 'object' ||
    Array.isArray(item)
  ) {
    return [];
  }

  const product = item as Record<string, unknown>;
  const brand = product.brand;

  return [
    {
      id: typeof product.id === 'string' ? product.id : '',
      name:
        typeof product.name === 'string'
          ? product.name
          : 'Unnamed product',
      slug: typeof product.slug === 'string' ? product.slug : '',
      brand:
        brand && typeof brand === 'object'
          ? String(
              (brand as Record<string, unknown>).name ?? '',
            )
          : typeof brand === 'string'
            ? brand
            : '',
    },
  ];
});

const rawPagination =
  wrapper.pagination &&
  typeof wrapper.pagination === 'object' &&
  !Array.isArray(wrapper.pagination)
    ? (wrapper.pagination as Record<string, unknown>)
    : {};

const total =
  Number(rawPagination.total) ||
  Number(wrapper.count) ||
  data.length;

const paginationLimit =
  Number(rawPagination.limit) || safeLimit;

const totalPagesFromApi = Number(rawPagination.totalPages);

const totalPages =
  Number.isFinite(totalPagesFromApi) && totalPagesFromApi > 0
    ? totalPagesFromApi
    : Math.max(1, Math.ceil(total / paginationLimit));

return {
  data,
  count: total,
  pagination: {
    page: Number(rawPagination.page) || safePage,
    limit: paginationLimit,
    total,
    totalPages,
  },
  error: undefined,
};

} catch (error) {
return {
data: [],
count: 0,
pagination: {
page: safePage,
limit: safeLimit,
total: 0,
totalPages: 1,
},
error:
error instanceof Error
? error.message
: 'Unable to preview collection products.',
};
}
}



export async function loadCollectionEditProducts(
  page: number,
  limit = 50,
) {
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));

  const result = await getCollectionEditProducts(
    safePage,
    safeLimit,
  );

  return {
    data: result.data.map((product) => ({
      id: typeof product.id === "string" ? product.id : "",
      name:
        typeof product.name === "string"
          ? product.name
          : "Unnamed product",
      slug:
        typeof product.slug === "string"
          ? product.slug
          : "",
    })),
    pagination: result.pagination,
  };
}




export async function deleteCollection(
  _previousState: {
    message: string;
    success: boolean;
  },
  formData: FormData,
) {
  const id = String(formData.get("_id") ?? "").trim();

  if (!id) {
    return {
      message: "Collection ID is required.",
      success: false,
    };
  }

  try {
    // Remove all product associations first.
    await retailRequest(
      `/collections/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          productIds: [],
        }),
      },
    );

    // Now delete the collection itself.
    await retailRequest(
      `/collections/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      },
    );
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Unable to delete collection.",
      success: false,
    };
  }

  revalidatePath("/dashboard/collections");

  redirect("/dashboard/collections");
}



export async function loadCollectionProductsByIds(ids: string[]) {
  const selectedIds = new Set(ids);

  if (selectedIds.size === 0) {
    return {
      data: [],
      missingIds: [],
    };
  }

  const firstPage = await loadCollectionEditProducts(1, 100);
  const allProducts = [...firstPage.data];

  for (let page = 2; page <= firstPage.pagination.totalPages; page++) {
    const result = await loadCollectionEditProducts(page, 100);
    allProducts.push(...result.data);
  }

  const matchingProducts = allProducts.filter((product) =>
    selectedIds.has(product.id),
  );

  const foundIds = new Set(matchingProducts.map((product) => product.id));

  return {
    data: matchingProducts,
    missingIds: ids.filter((id) => !foundIds.has(id)),
  };
}



export async function reorderCollectionProducts(
  collectionId: string,
  productIds: string[],
) {
  if (!collectionId) {
    throw new Error('Collection ID is required.');
  }

  if (!Array.isArray(productIds)) {
    throw new Error('Product IDs must be an array.');
  }

  if (new Set(productIds).size !== productIds.length) {
    throw new Error('Duplicate product IDs are not allowed.');
  }

  const session = await auth();

  const staffUser = session?.user as
    | {
        isStaff?: boolean;
        accessToken?: string;
      }
    | undefined;

  if (!staffUser?.isStaff || !staffUser.accessToken) {
    throw new Error(
      'You must be signed in as staff to reorder collection products.',
    );
  }

  return retailRequest(
    `/collections/${encodeURIComponent(collectionId)}/products/reorder`,
    {
      method: 'PATCH',
      body: JSON.stringify({ productIds }),
      cache: 'no-store',
    },
  );
}
