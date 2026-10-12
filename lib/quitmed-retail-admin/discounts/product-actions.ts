
"use server";

import { safeRetailPage } from "@/lib/quitmed-retail-admin/products/client";

const PAGE_SIZE = 50;

export async function searchDiscountProductOptionsAction(
  search = "",
  page = 1,
): Promise<{
  success: boolean;
  data: { id: string; label: string }[];
  page: number;
  totalPages: number;
  hasMore: boolean;
  message?: string;
}> {
  const query = new URLSearchParams();

  const trimmedSearch = search.trim();

  if (trimmedSearch) {
    query.set("search", trimmedSearch);
  }

  // Request only the fields required by the dropdown.
  query.set("fields", "id,name");

  const result = await safeRetailPage(
    `/products?${query.toString()}`,
    page,
    PAGE_SIZE,
  );

  if (result.error) {
    return {
      success: false,
      data: [],
      page,
      totalPages: 1,
      hasMore: false,
      message: result.error,
    };
  }

  const data = result.data.flatMap((product) => {
    if (typeof product.id !== "string" || !product.id) {
      return [];
    }

    const name = [product.name, product.title].find(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    );

    return [
      {
        id: product.id,
        label: name?.trim() ?? `Product ${product.id}`,
      },
    ];
  });

  return {
    success: true,
    data,
    page: result.pagination.page,
    totalPages: result.pagination.totalPages,
    hasMore: result.pagination.page < result.pagination.totalPages,
  };
}


export async function searchDiscountVariantOptionsAction(
  search = "",
  page = 1,
): Promise<{
  success: boolean;
  data: { id: string; label: string }[];
  page: number;
  totalPages: number;
  hasMore: boolean;
  message?: string;
}> {
  const trimmedSearch = search.trim();

  // Search actual variant records, not parent products.
  const path = trimmedSearch
    ? `/product-variants?search=${encodeURIComponent(trimmedSearch)}`
    : "/product-variants";

  const result = await safeRetailPage(path, page, PAGE_SIZE);

  if (result.error) {
    return {
      success: false,
      data: [],
      page,
      totalPages: 1,
      hasMore: false,
      message: result.error,
    };
  }

  const data = result.data.flatMap((rawVariant) => {
    const variant = rawVariant as Record<string, unknown>;

    if (typeof variant.id !== "string" || !variant.id) {
      return [];
    }

    const rawProduct = variant.product;

    const product =
      rawProduct &&
      typeof rawProduct === "object" &&
      !Array.isArray(rawProduct)
        ? (rawProduct as Record<string, unknown>)
        : undefined;

    const productName =
      typeof product?.name === "string" && product.name.trim()
        ? product.name.trim()
        : typeof variant.productName === "string"
          ? variant.productName.trim()
          : "";

    const variantName =
      typeof variant.name === "string" && variant.name.trim()
        ? variant.name.trim()
        : `Variant ${variant.id}`;

    const sku =
      typeof variant.sku === "string" ? variant.sku.trim() : "";

    return [
      {
        // Must remain the individual variant ID.
        id: variant.id,
        label: [
          productName,
          variantName,
          sku ? `SKU: ${sku}` : "",
        ]
          .filter(Boolean)
          .join(" — "),
      },
    ];
  });

  return {
    success: true,
    data,
    page: result.pagination.page,
    totalPages: result.pagination.totalPages,
    hasMore: result.pagination.page < result.pagination.totalPages,
  };
}
