"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { availableStock, records, RETAIL_CATALOG_TAG, type RetailRecord, retailRequest, safeRetailAll, safeRetailPage } from "@/lib/quithero-admin";
import { deleteStorefrontCollection, syncStorefrontCollection } from "@/lib/sanity-storefront";
import { auth } from "@/auth";
import { bundleComponentResponse, BundleSelection } from "@/lib/product-bundles";
import { bundleCreationFields, persistBundleGroup } from "@/lib/create-bundle";

const allowedResources = new Set([
  "products",
  "product-variants",
  "product-images",
  "product-options",
  "product-option-values",
  "tags",
  "collections",
  "customers",
]);


function newestCustomersFirst(items: RetailRecord[]) {
  return items
    .map((item, index) => ({
      item,
      index,
      createdAt: Date.parse(
        typeof item.createdAt === "string" ? item.createdAt : "",
      ),
    }))
    .sort((a, b) => {
      const aTime = Number.isNaN(a.createdAt)
        ? Number.NEGATIVE_INFINITY
        : a.createdAt;

      const bTime = Number.isNaN(b.createdAt)
        ? Number.NEGATIVE_INFINITY
        : b.createdAt;

      return bTime - aTime || a.index - b.index;
    })
    .map(({ item }) => item);
}

function payload(formData: FormData) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("_") || key.startsWith("$ACTION_") || typeof value !== "string") continue;
    if (key === "productIds" || key === "rules") {
      try {
        result[key] = JSON.parse(value);
      } catch {
        throw new Error(`Invalid ${key}.`);
      }
      continue;
    }
    if (key === "tags") {
      result[key] = value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      continue;
    }
    if (value === "") continue;
    if (
      [
        "price",
        "inventory",
        "allocatedInventory",
        "incomingInventory",
        "weight",
        "sortOrder",
      ].includes(key)
    ) {
      result[key] = Number(value);
    } else if (["requiresShipping", "isPrimary", "consultPurchase", "scriptActive"].includes(key)) {
      result[key] = value === "true" || value === "on";
    } else result[key] = value;
  }
  return result;
}

export type CollectionActionState = { message: string; success: boolean };

function collectionRecord(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const wrapper = payload as Record<string, unknown>;
  return wrapper.data && typeof wrapper.data === "object" && !Array.isArray(wrapper.data)
    ? wrapper.data as Record<string, unknown>
    : wrapper;
}

function validateCollection(body: Record<string, unknown>, editing = false) {
  if (typeof body.name !== "string" || !body.name.trim())
    throw new Error("Collection name is required.");
  if (body.type !== "MANUAL" && body.type !== "DYNAMIC")
    throw new Error("Choose a valid collection type.");
  if (body.match !== "ALL" && body.match !== "ANY")
    throw new Error("Choose whether all or any rules must match.");
  if (body.type === "MANUAL") {
    if (
      !Array.isArray(body.productIds) ||
      (!editing && !body.productIds.length) ||
      body.productIds.some((id) => typeof id !== "string" || !id)
    )
      throw new Error("Select at least one product.");
    delete body.rules;
  } else {
    if (
      !Array.isArray(body.rules) ||
      !body.rules.length ||
      body.rules.some((rule) => {
        if (!rule || typeof rule !== "object") return true;
        const value = rule as Record<string, unknown>;
        return (
          !["name", "brand", "tag"].includes(String(value.field)) ||
          !["equals", "contains"].includes(String(value.operator)) ||
          typeof value.value !== "string" ||
          !value.value.trim()
        );
      })
    )
      throw new Error("Complete at least one valid collection rule.");
    if (
      !Array.isArray(body.productIds) ||
      body.productIds.some((id) => typeof id !== "string" || !id)
    )
      throw new Error("Invalid dynamic collection products.");
  }
}

export async function createCollection(
  _previous: CollectionActionState,
  formData: FormData,
): Promise<CollectionActionState> {
  try {
    const session = await auth();
    const staffUser = session?.user as { isStaff?: boolean; accessToken?: string } | undefined;
    if (!staffUser?.isStaff)
      throw new Error("You must be signed in as staff to save collections.");
    const id = String(formData.get("_id") ?? "");
    const body = payload(formData);
    if (!body.slug && typeof body.name === "string") body.slug = slugify(body.name);
    validateCollection(body, Boolean(id));
    const retailBody = { ...body };
    if (retailBody.type === "DYNAMIC") delete retailBody.productIds;
    const saved = await retailRequest<unknown>(
      `/collections${id ? `/${encodeURIComponent(id)}` : ""}`,
      { method: id ? "PATCH" : "POST", body: JSON.stringify(retailBody) },
    );
    let data = collectionRecord(saved);
    const collectionId = id || (typeof data.id === "string" ? data.id : "");
    if (!collectionId)
      throw new Error(
        "Collection was saved, but the Retail API did not return its ID for storefront sync.",
      );
    const imageFile = formData.get("_imageFile");
    if (imageFile instanceof File && imageFile.size > 0) {
      if (!staffUser.accessToken)
        throw new Error("Your staff session does not include an access token. Please sign in again.");
      if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(imageFile.type))
        throw new Error("Choose a JPEG, PNG, WebP or GIF image.");
      if (imageFile.size > 4 * 1024 * 1024)
        throw new Error("Image must be 4 MB or smaller.");
      const upload = new FormData();
      upload.set("image", imageFile);
      await retailRequest(`/collections/${encodeURIComponent(collectionId)}/image`, {
        method: "POST",
        headers: { authorization: `Bearer ${staffUser.accessToken}` },
        body: upload,
      });
      data = collectionRecord(await retailRequest(`/collections/${encodeURIComponent(collectionId)}`, {
        cache: "no-store",
      }));
    }
    const collectionImage = typeof data.image === "string"
      ? data.image
      : String(formData.get("_currentImage") ?? "") || undefined;
    updateTag(RETAIL_CATALOG_TAG);
    revalidatePath("/dashboard/collections");
    try {
      await syncStorefrontCollection({
        id: collectionId,
        name: String(body.name),
        slug: String(body.slug),
        type: body.type as "MANUAL" | "DYNAMIC",
        match: body.match as "ALL" | "ANY",
        image: collectionImage,
        productIds: Array.isArray(body.productIds) ? (body.productIds as string[]) : undefined,
        rules: Array.isArray(body.rules)
          ? (body.rules as { field: string; operator: string; value: string }[])
          : undefined,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown storefront error.";
      return {
        message: `Collection was ${id ? "updated" : "created"} in the dashboard, but storefront sync failed: ${detail}`,
        success: true,
      };
    }
    return {
      message: `Collection “${String(body.name)}” was ${id ? "updated" : "created"}.`,
      success: true,
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Unable to create collection.",
      success: false,
    };
  }
}

export async function deleteCollection(
  _previous: CollectionActionState,
  formData: FormData,
): Promise<CollectionActionState> {
  const id = String(formData.get("_id") ?? "");
  if (!id) return { message: "Collection ID is required.", success: false };
  try {
    await retailRequest(`/collections/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ productIds: [] }),
    });
    await retailRequest(`/collections/${encodeURIComponent(id)}`, { method: "DELETE" });
    updateTag(RETAIL_CATALOG_TAG);
    revalidatePath("/dashboard/collections");
    try {
      await deleteStorefrontCollection(id);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown storefront error.";
      return {
        message: `Collection was deleted from the dashboard, but storefront cleanup failed: ${detail}`,
        success: true,
      };
    }
    return { message: "Collection deleted.", success: true };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Unable to delete collection.",
      success: false,
    };
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

type ExistingProductTag = { id: string; tagId: string };

function productTagSelection(formData: FormData) {
  const selected = String(formData.get("tags") ?? "")
    .split(",")
    .map((tagId) => tagId.trim())
    .filter(Boolean);
  let newTags: string[] = [];
  let existing: ExistingProductTag[] = [];
  try {
    const value = JSON.parse(String(formData.get("_existingProductTags") ?? "[]"));
    if (Array.isArray(value))
      existing = value.filter(
        (tag): tag is ExistingProductTag =>
          tag && typeof tag.id === "string" && typeof tag.tagId === "string",
      );
    const newValue = JSON.parse(String(formData.get("_newTags") ?? "[]"));
    if (Array.isArray(newValue))
      newTags = [
        ...new Set(
          newValue
            .filter((tag): tag is string => typeof tag === "string")
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ];
  } catch {
    throw new Error("Invalid existing product tags.");
  }
  return { selected, existing, newTags };
}

async function syncProductTags(
  productId: string,
  selected: string[],
  existing: ExistingProductTag[],
  newTags: string[],
) {
  const createdIds = await Promise.all(
    newTags.map(async (name) => {
      const response = await retailRequest<unknown>("/tags", {
        method: "POST",
        body: JSON.stringify({ name, slug: slugify(name) }),
      });
      const wrapper =
        response && typeof response === "object" ? (response as Record<string, unknown>) : {};
      const data =
        wrapper.data && typeof wrapper.data === "object"
          ? (wrapper.data as Record<string, unknown>)
          : wrapper;
      if (typeof data.id !== "string")
        throw new Error(`Tag "${name}" was created, but the Retail API did not return its ID.`);
      return data.id;
    }),
  );
  selected = [...selected, ...createdIds];
  const selectedIds = new Set(selected);
  const existingIds = new Set(existing.map((tag) => tag.tagId));
  await Promise.all([
    ...existing
      .filter((tag) => !selectedIds.has(tag.tagId))
      .map((tag) =>
        retailRequest(`/product-tags/${encodeURIComponent(tag.id)}`, { method: "DELETE" }),
      ),
    ...selected
      .filter((tagId) => !existingIds.has(tagId))
      .map((tagId) =>
        retailRequest("/product-tags", {
          method: "POST",
          body: JSON.stringify({ productId, tagId }),
        }),
      ),
  ]);
}

function productTagAssignmentUnsupported(error: unknown) {
  if (!(error instanceof Error) || !/^QuitHero API returned 400\b/.test(error.message)) {
    return false;
  }
  return error.message.includes("property productId should not exist")
    && error.message.includes("property tagId should not exist");
}

async function recoverCreatedProduct(body: Record<string, unknown>, error: unknown) {
  if (!(error instanceof Error) || !/^QuitHero API returned 5\d\d\b/.test(error.message))
    return undefined;
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!slug) return undefined;

  try {
    for (let page = 1; page <= 100; page += 1) {
      const response = await retailRequest<unknown>(`/products?page=${page}&limit=100`, {
        cache: "no-store",
      });
      const product = records(response).find(
        (item) => item.slug === slug && typeof item.id === "string",
      );
      if (product) return product;

      const wrapper =
        response && typeof response === "object" ? (response as Record<string, unknown>) : {};
      const pagination =
        wrapper.pagination && typeof wrapper.pagination === "object"
          ? (wrapper.pagination as Record<string, unknown>)
          : {};
      if (page >= (Number(pagination.totalPages) || 1)) break;
    }
    return undefined;
  } catch (recoveryError) {
    console.error("[QuitHero dashboard] Unable to verify whether product creation succeeded", {
      stage: "product-create-recovery",
      slug,
      recoveryError,
    });
    return undefined;
  }
}

async function persistResource(formData: FormData) {
  const resource = String(formData.get("_resource") ?? "");
  const id = String(formData.get("_id") ?? "");
  const returnTo = String(formData.get("_returnTo") ?? "/dashboard");
  if (!allowedResources.has(resource)) throw new Error("Unsupported resource.");
  const creatingBundle = resource === "products" && formData.has("_bundleSelections");
  if (creatingBundle) {
    const session = await auth();
    if (!(session?.user as { isStaff?: boolean } | undefined)?.isStaff) throw new Error("Please sign in as staff to create bundles.");
  }
  const bundleFields = creatingBundle ? bundleCreationFields(formData) : undefined;
  const body = payload(formData);
  if (bundleFields) {
    body.name = bundleFields.name;
    body.slug = slugify(`${bundleFields.name}-${bundleFields.sku}`);
    if (!id) body.status = "DRAFT";
    if (!body.brandId || !body.productTypeId) throw new Error("Select a vendor and type for the bundle.");
  }
  let customerAddress: Record<string, string> | undefined;
  if (resource === "customers") {
    const address = {
      address1: String(formData.get("_address1") ?? "").trim(),
      address2: String(formData.get("_address2") ?? "").trim(),
      city: String(formData.get("_city") ?? "").trim(),
      state: String(formData.get("_state") ?? "").trim(),
      postcode: String(formData.get("_postcode") ?? "").trim(),
      country: String(formData.get("_country") ?? "").trim(),
    };
    if (formData.get("_hasAddress") === "true" || Object.values(address).some(Boolean)) {
      const addressId = String(formData.get("_addressId") ?? "").trim();
      if (!id || !addressId)
        throw new Error("This saved address does not include an address ID and cannot be updated.");
      customerAddress = address;
    }
  }
  const productTags = resource === "products" ? productTagSelection(formData) : undefined;
  if (resource === "products") delete body.tags;
  if (resource === "collections" && !body.slug && typeof body.name === "string")
    body.slug = slugify(body.name);
  const method = id ? "PATCH" : "POST";
  const path = `/${resource}${id ? `/${encodeURIComponent(id)}` : ""}`;
  let saved: unknown;
  try {
    saved = await retailRequest<unknown>(path, { method, body: JSON.stringify(body) });
  } catch (error) {
    const recovered =
      resource === "products" && method === "POST"
        ? await recoverCreatedProduct(body, error)
        : undefined;
    if (recovered) {
      saved = recovered;
      console.warn(
        "[QuitHero dashboard] Product creation returned an error after being committed",
        {
          stage: "product-create-recovered",
          productId: recovered.id,
          slug: recovered.slug,
          error,
        },
      );
    } else {
      console.error("[QuitHero dashboard] Resource save request failed", {
        stage: "resource-save",
        resource,
        method,
        path,
        resourceId: id || undefined,
        fields: Object.keys(body),
        product:
          resource === "products"
            ? {
                name: body.name,
                slug: body.slug,
                brandId: body.brandId,
                productTypeId: body.productTypeId,
                status: body.status,
              }
            : undefined,
        error,
      });
      throw error;
    }
  }
  if (customerAddress) {
    const addressId = String(formData.get("_addressId"));
    await retailRequest(
      `/customers/${encodeURIComponent(id)}/addresses/${encodeURIComponent(addressId)}`,
      { method: "PATCH", body: JSON.stringify(customerAddress) },
    );
  }
  if (productTags) {
    const wrapper = saved && typeof saved === "object" ? (saved as Record<string, unknown>) : {};
    const data =
      wrapper.data && typeof wrapper.data === "object"
        ? (wrapper.data as Record<string, unknown>)
        : wrapper;
    const productId = id || (typeof data.id === "string" ? data.id : "");
    if (!productId)
      throw new Error("Product was saved, but the Retail API did not return its ID for tag sync.");
    if (bundleFields) formData.set("_bundleProductId", productId);
    try {
      if (!bundleFields || formData.get("_bundleTagsSaved") !== "true") await syncProductTags(
        productId,
        productTags.selected,
        productTags.existing,
        productTags.newTags,
      );
      if (bundleFields) formData.set("_bundleTagsSaved", "true");
    } catch (error) {
      if (!bundleFields && productTagAssignmentUnsupported(error)) {
        console.warn("[QuitHero dashboard] Product saved without tag assignments", {
          stage: "product-tag-sync-unsupported",
          productId,
          selectedTagIds: productTags.selected,
        });
      } else {
        console.error("[QuitHero dashboard] Product tag sync failed", {
          stage: "product-tag-sync",
          productId,
          selectedTagIds: productTags.selected,
          newTagNames: productTags.newTags,
          error,
        });
        throw error;
      }
    }
    if (bundleFields) {
      await persistBundleGroup(retailRequest, productId, bundleFields, String(formData.get("_bundleVariantId") ?? ""), (savedId) => formData.set("_bundleVariantId", savedId));
      updateTag(RETAIL_CATALOG_TAG);
      revalidatePath("/dashboard", "layout");
      return "/dashboard/bundles";
    }
  }
  updateTag(RETAIL_CATALOG_TAG);
  revalidatePath("/dashboard", "layout");
  return returnTo;
}

export async function saveResource(formData: FormData) {
  redirect(await persistResource(formData));
}

export type ResourceActionState = { message: string; success: boolean; bundleProductId?: string; bundleVariantId?: string; bundleTagsSaved?: boolean };

export type OrderActionState = { message: string; success: boolean };

export async function createOrder(
  _previous: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  try {
    const customerId = String(formData.get("customerId") ?? "").trim();
    const shipping = Number(formData.get("shipping"));
    if (!customerId) throw new Error("Select a customer.");
    if (!Number.isFinite(shipping) || shipping < 0) throw new Error("Enter a valid shipping cost.");

    const rawItems: unknown = JSON.parse(String(formData.get("items") ?? "[]"));
    if (!Array.isArray(rawItems) || !rawItems.length) throw new Error("Add at least one order item.");
    const items = rawItems.map((item) => {
      const value = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const variantId = String(value.variantId ?? "").trim();
      const quantity = Number(value.quantity);
      if (!variantId || !Number.isInteger(quantity) || quantity < 1) throw new Error("Choose a variant and enter a valid quantity for every item.");
      return { variantId, quantity };
    });
    if (new Set(items.map((item) => item.variantId)).size !== items.length) throw new Error("Each variant can only be added once.");

    const variantResult = await safeRetailAll("/product-variants");
    if (variantResult.error) throw new Error(variantResult.error);
    const variants = new Map(variantResult.data.flatMap((variant) => typeof variant.id === "string" ? [[variant.id, variant] as const] : []));
    let subtotal = 0;
    for (const item of items) {
      const variant = variants.get(item.variantId);
      if (!variant) throw new Error("One of the selected variants is no longer available.");
      const available = availableStock(variant);
      if (item.quantity > available) throw new Error(`${String(variant.name ?? variant.sku ?? "Variant")} only has ${available} available.`);
      const price = Number(variant.price);
      if (!Number.isFinite(price) || price < 0) throw new Error("One of the selected variants has an invalid price.");
      subtotal += price * item.quantity;
    }
    subtotal = Number(subtotal.toFixed(2));
    const total = Number((subtotal + Number(shipping.toFixed(2))).toFixed(2));
    await retailRequest("/orders", {
      method: "POST",
      body: JSON.stringify({ source: "NATIVE", currencyCode: "AUD", subtotal, total, customerId, items }),
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard/inventory");
    return { message: "Order created.", success: true };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "Unable to create order.", success: false };
  }
}

export async function cancelOrder(
  _previous: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  try {
    const orderId = String(formData.get("orderId") ?? "").trim();
    if (!orderId) throw new Error("Order ID is required.");

    const session = await auth();
    const staffUser = session?.user as { isStaff?: boolean } | undefined;
    if (!staffUser?.isStaff) throw new Error("You must be signed in as staff to cancel orders.");

    await retailRequest(`/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: "POST",
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard/orders/details");
    revalidatePath("/dashboard/inventory");
    return { message: "Order cancelled.", success: true };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Unable to cancel order.",
      success: false,
    };
  }
}

export async function saveResourceWithState(
  _previous: ResourceActionState,
  formData: FormData,
): Promise<ResourceActionState> {
  let returnTo: string;
  const creatingBundle = formData.get("_resource") === "products" && formData.has("_bundleSelections");
  if (creatingBundle) {
    if (_previous.bundleProductId) formData.set("_id", _previous.bundleProductId);
    if (_previous.bundleVariantId) formData.set("_bundleVariantId", _previous.bundleVariantId);
    if (_previous.bundleTagsSaved) formData.set("_bundleTagsSaved", "true");
  }
  try {
    returnTo = await persistResource(formData);
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Unable to save this resource.",
      success: false,
      ...(creatingBundle ? {
        bundleProductId: String(formData.get("_bundleProductId") ?? _previous.bundleProductId ?? ""),
        bundleVariantId: String(formData.get("_bundleVariantId") ?? ""),
        bundleTagsSaved: formData.get("_bundleTagsSaved") === "true",
      } : {}),
    };
  }
  redirect(returnTo);
}

export async function deleteResource(formData: FormData) {
  const resource = String(formData.get("_resource") ?? "");
  const id = String(formData.get("_id") ?? "");
  if (!allowedResources.has(resource) || !id) throw new Error("Unsupported delete request.");
  try {
    await retailRequest(`/${resource}/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (error) {
    const alreadyDeleted = error instanceof Error
      && /^QuitHero API returned 404\b/.test(error.message);
    if (!alreadyDeleted) throw error;

    console.info("[QuitHero dashboard] Delete target was already absent", {
      stage: "resource-delete-already-absent",
      resource,
      resourceId: id,
    });
  }
  updateTag(RETAIL_CATALOG_TAG);
  revalidatePath("/dashboard", "layout");
}


export async function getCustomers(
  query: string,
  page: number,
  limit = 20,
) {

  console.log("🔵 BACKEND FETCH: getCustomers()", {
    query,
    page,
    limit,
  });
  const customerPath = query
    ? `/customers?search=${encodeURIComponent(query)}`
    : "/customers";

  const separator = customerPath.includes("?") ? "&" : "?";

  const payload = await retailRequest<unknown>(
    `${customerPath}${separator}page=${page}&limit=${limit}`,
    {
      cache: "no-store",
    },
  );

  const wrapper =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};

  const rawPagination =
    wrapper.pagination && typeof wrapper.pagination === "object"
      ? (wrapper.pagination as Record<string, unknown>)
      : {};

  const data = records(payload);

  return {
    data,
    pagination: {
      page: Number(rawPagination.page) || page,
      limit: Number(rawPagination.limit) || limit,
      total: Number(rawPagination.total) || data.length,
      totalPages: Number(rawPagination.totalPages) || 1,
    },
  };
}

export async function getCustomerBatch(
  query = "",
  batch = 0,
) {
  console.log("🔵 BACKEND FETCH: getCustomerBatch()", {
    query,
    batch,
  });

  const apiLimit = 100;
  const batchSize = 500;

  const customerPath = query
    ? `/customers?search=${encodeURIComponent(query)}`
    : "/customers";

  // Get the total and total API pages.
  const firstPage = await safeRetailPage(
    customerPath,
    1,
    apiLimit,
  );

  if (firstPage.error) {
    return {
      data: [],
      total: firstPage.pagination.total ?? 0,
      totalPages: firstPage.pagination.totalPages ?? 0,
      error: firstPage.error,
    };
  }

  const total = firstPage.pagination.total;
  const totalApiPages = firstPage.pagination.totalPages;

  const batchStart = Math.max(
    0,
    total - (batch + 1) * batchSize,
  );

  const batchEnd = Math.max(
    0,
    total - batch * batchSize,
  );

  if (batchStart >= batchEnd) {
    return {
      data: [],
      total,
      totalPages: totalApiPages,
      error: undefined,
    };
  }

  // Find which API pages contain this 500-record batch.
  const startApiPage =
    Math.floor(batchStart / apiLimit) + 1;

  const endApiPage =
    Math.floor((batchEnd - 1) / apiLimit) + 1;

  const pageResults = [];

  for (
    let apiPage = startApiPage;
    apiPage <= endApiPage;
    apiPage++
  ) {
    if (apiPage === 1) {
      pageResults.push(firstPage);
    } else {
      pageResults.push(
        await safeRetailPage(
          customerPath,
          apiPage,
          apiLimit,
        ),
      );
    }
  }

  const error = pageResults.find(
    (result) => result.error,
  )?.error;

  const combinedData = pageResults.flatMap(
    (result) => result.data,
  );

  // Select the exact 500-record batch while the API
  // data is still in its original pagination order.
  const localStart =
    batchStart - (startApiPage - 1) * apiLimit;

  const batchCount = batchEnd - batchStart;

  const batchData = combinedData.slice(
    localStart,
    localStart + batchCount,
  );

  // The dashboard displays newest customers first.
  const data = newestCustomersFirst(batchData);

  return {
    data,
    total,
    totalPages: totalApiPages,
    error,
  };
}

export async function getProducts() {
  console.log("🔵 BACKEND FETCH: getProducts()");

  const payload = await retailRequest<unknown>("/products", {
    cache: "no-store",
  });

  return {
    data: records(payload),
  };
}

export async function getProductVariants() {
  console.log("🔵 BACKEND FETCH: getProductVariants()");

  const payload = await retailRequest<unknown>("/product-variants", {
    cache: "no-store",
  });

  const data = records(payload);

  return {
    data: data.map((variant) => ({
      ...variant,
      __availableStock: availableStock(variant),
    })),
  };
}

export async function getCustomer(id: string) {
  const payload = await retailRequest<unknown>(
    `/customers/${encodeURIComponent(id)}`,
    {
      cache: "no-store",
    },
  );

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }

  const wrapper = payload as Record<string, unknown>;
  const data = wrapper.data;

  return data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : wrapper;
}

export async function getOrders() {
  const payload = await retailRequest<unknown>("/orders", {
    cache: "no-store",
  });

  return {
    data: records(payload),
  };
}

export async function getOrderBatch(query = "", batch = 0) {
  console.log("🔵 BACKEND FETCH: getOrderBatch()", {
    query,
    batch,
  });

  const API_LIMIT = 100;
  const BATCH_SIZE = 500;

  const startApiPage =
    batch * (BATCH_SIZE / API_LIMIT) + 1;

  const orderPath = query
    ? `/orders?search=${encodeURIComponent(query)}`
    : "/orders";

  const firstPage = await safeRetailPage(
    orderPath,
    startApiPage,
    API_LIMIT,
  );

  const total = firstPage.pagination.total;
  const totalApiPages = firstPage.pagination.totalPages;

  if (firstPage.error) {
    return {
      data: firstPage.data,
      total,
      totalPages: Math.ceil(total / 50),
      error: firstPage.error,
    };
  }

  const endApiPage = Math.min(
    startApiPage + BATCH_SIZE / API_LIMIT - 1,
    totalApiPages,
  );

  const remainingPages =
    endApiPage >= startApiPage + 1
      ? await Promise.all(
          Array.from(
            {
              length:
                endApiPage - startApiPage,
            },
            (_, index) =>
              safeRetailPage(
                orderPath,
                startApiPage + index + 1,
                API_LIMIT,
              ),
          ),
        )
      : [];

  const pageResults = [
    firstPage,
    ...remainingPages,
  ];

  const error = pageResults.find(
    (result) => result.error,
  )?.error;

  const data = pageResults
    .flatMap((result) => result.data)
    .slice(0, BATCH_SIZE);

  return {
    data,
    total,
    totalPages: Math.max(
      1,
      Math.ceil(total / 50),
    ),
    error,
  };
}

export async function getBundleProducts() {
  console.log("🔵 BACKEND FETCH: getBundleProducts()");

  return safeRetailAll("/products?tags=bundle");
}

export async function getBundleProductsCatalog() {
  console.log("🔵 BACKEND FETCH: getBundleProductsCatalog()");

  return safeRetailAll("/products");
}

export async function getBundleVariants() {
  console.log("🔵 BACKEND FETCH: getBundleVariants()");

  return safeRetailAll("/product-variants");
}

export async function getBundleConfiguration(
  productId: string,
  variantId: string,
) {
  console.log("🔵 BACKEND FETCH: getBundleConfiguration()", {
    productId,
    variantId,
  });

  try {
    const payload = await retailRequest<unknown>(
      `/products/${encodeURIComponent(
        productId,
      )}/variants/${encodeURIComponent(
        variantId,
      )}/bundle`,
      {
        cache: "no-store",
      },
    );

    return {
      data: bundleComponentResponse(
        payload,
        variantId,
      ),
      error: undefined,
    };
  } catch (cause) {
    return {
      data: [] as BundleSelection[],
      error:
        cause instanceof Error
          ? cause.message
          : "Unable to load bundle group.",
    };
  }
}

export async function getBundleProductBatch(batch = 0) {
  const result = await safeRetailAll("/products?tags=bundle");
  // Sort the complete collection before slicing so new bundles reach page one.
  const products = result.data.map((product, index) => ({
    product,
    index,
    createdAt: Date.parse(typeof product.createdAt === "string" ? product.createdAt : ""),
  })).sort((a, b) => {
    const aTime = Number.isNaN(a.createdAt) ? Number.NEGATIVE_INFINITY : a.createdAt;
    const bTime = Number.isNaN(b.createdAt) ? Number.NEGATIVE_INFINITY : b.createdAt;
    return bTime - aTime || a.index - b.index;
  }).map(({ product }) => product);
  const start = Math.max(0, Math.floor(batch)) * 500;
  return {
    data: products.slice(start, start + 500),
    total: products.length,
    totalPages: Math.max(1, Math.ceil(products.length / 50)),
    error: result.error,
  };
}
export async function getStoreActivityBatch(batch = 0) {
  console.log(
    "🔵 BACKEND FETCH: getStoreActivityBatch()",
    { batch },
  );

  const session = await auth();

  const staffUser = session?.user as
    | {
        isStaff?: boolean;
        accessToken?: string;
      }
    | undefined;

  if (!staffUser?.isStaff) {
    return {
      data: [],
      total: 0,
      totalPages: 1,
      error:
        "You must be signed in as staff to view store activity.",
    };
  }

  if (!staffUser.accessToken) {
    return {
      data: [],
      total: 0,
      totalPages: 1,
      error:
        "Your staff session does not include an access token. Please sign in again.",
    };
  }

  const API_LIMIT = 100;
  const BATCH_SIZE = 500;

  const startApiPage =
    batch * (BATCH_SIZE / API_LIMIT) + 1;

  try {
    const payload = await retailRequest<unknown>(
      `/audit-logs?page=${startApiPage}&limit=${API_LIMIT}`,
      {
        cache: "no-store",
        headers: {
          authorization: `Bearer ${staffUser.accessToken}`,
        },
      },
    );

    const data = records(payload);

    const wrapper =
      payload &&
      typeof payload === "object" &&
      !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {};

    const pagination =
      wrapper.pagination &&
      typeof wrapper.pagination === "object" &&
      !Array.isArray(wrapper.pagination)
        ? (wrapper.pagination as Record<string, unknown>)
        : undefined;

    const apiTotal = Number(pagination?.total);
    const apiTotalPages = Number(
      pagination?.totalPages,
    );

    // The audit-log endpoint currently returns the records
    // without pagination metadata, so use the returned
    // record count as the total.
    const total =
      Number.isFinite(apiTotal) && apiTotal > 0
        ? apiTotal
        : data.length;

    return {
      data: data.slice(0, BATCH_SIZE),
      total,
      totalPages: Math.max(
        1,
        Math.ceil(total / 50),
      ),
      error: undefined,
    };
  } catch (cause) {
    return {
      data: [],
      total: 0,
      totalPages: 1,
      error:
        cause instanceof Error
          ? cause.message
          : "Unable to load store activity.",
    };
  }
}
