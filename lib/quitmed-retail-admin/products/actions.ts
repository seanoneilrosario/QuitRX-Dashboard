"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { retailRequest } from "../collections/client";
import { normalizeRichText } from "./utils";

export type ProductActionState = {
  message: string;
  success: boolean;
};

const PRODUCT_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "ARCHIVED",
] as const;

type ProductStatus =
  (typeof PRODUCT_STATUSES)[number];

function getString(
  formData: FormData,
  name: string,
): string {
  const value = formData.get(name);

  return typeof value === "string"
    ? value.trim()
    : "";
}

function getStatus(
  formData: FormData,
): ProductStatus {
  const status = getString(
    formData,
    "status",
  ).toUpperCase();

  return PRODUCT_STATUSES.includes(
    status as ProductStatus,
  )
    ? (status as ProductStatus)
    : "DRAFT";
}

function buildProductPayload(
  formData: FormData,
) {
  const name = getString(
    formData,
    "name",
  );

  const slug = getString(
    formData,
    "slug",
  );

  const brandId = getString(
    formData,
    "brandId",
  );

  const productTypeId = getString(
    formData,
    "productTypeId",
  );

  if (!name) {
    throw new Error(
      "Product name is required.",
    );
  }

  if (!slug) {
    throw new Error(
      "Product slug is required.",
    );
  }

  if (!brandId) {
    throw new Error(
      "Brand is required.",
    );
  }

  if (!productTypeId) {
    throw new Error(
      "Product type is required.",
    );
  }

  return {
    name,
    slug,

    shortDescription:
      getString(
        formData,
        "shortDescription",
      ) || null,

    description:
      normalizeRichText(
        getString(
          formData,
          "description",
        ),
      ) || null,

    brandId,
    productTypeId,

    status: getStatus(formData),

    seoTitle:
      getString(
        formData,
        "seoTitle",
      ) || null,

    seoDescription:
      normalizeRichText(
        getString(
          formData,
          "seoDescription",
        ),
      ) || null,
  };
}

type ProductResponse = {
  data?: Record<
    string,
    unknown
  >;
};

function getReturnedProductId(
  response: unknown,
): string {
  if (
    response &&
    typeof response === "object" &&
    !Array.isArray(response)
  ) {
    const wrapper =
      response as Record<
        string,
        unknown
      >;

    if (
      wrapper.data &&
      typeof wrapper.data === "object" &&
      !Array.isArray(wrapper.data)
    ) {
      const data =
        wrapper.data as Record<
          string,
          unknown
        >;

      if (
        typeof data.id === "string" &&
        data.id
      ) {
        return data.id;
      }
    }

    if (
      typeof wrapper.id === "string" &&
      wrapper.id
    ) {
      return wrapper.id;
    }
  }

  return "";
}

export async function createProduct(
  _previous: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  let productId = "";
  let editing = false;

  try {
    const id = getString(
      formData,
      "_id",
    );

    editing = Boolean(id);

    const body =
      buildProductPayload(formData);

    const path = id
      ? `/products/${encodeURIComponent(id)}`
      : "/products";

    const saved =
      await retailRequest<ProductResponse>(
        path,
        {
          method: editing
            ? "PATCH"
            : "POST",

          body: JSON.stringify(
            body,
          ),
        },
      );

    productId =
      id ||
      getReturnedProductId(saved);

    if (!productId) {
      throw new Error(
        "Product was saved but no product ID was returned.",
      );
    }

    revalidatePath(
      "/dashboard/products",
    );

    revalidatePath(
      `/dashboard/products/view?id=${encodeURIComponent(
        productId,
      )}`,
    );

    revalidatePath(
      `/dashboard/products/edit?id=${encodeURIComponent(
        productId,
      )}`,
    );
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Unable to save product.",
      success: false,
    };
  }

  redirect(
    editing
      ? `/dashboard/products/view?id=${encodeURIComponent(
          productId,
        )}`
      : "/dashboard/products",
  );
}