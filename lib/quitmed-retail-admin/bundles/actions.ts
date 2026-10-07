"use server";

import {
  deleteProductBundle,
  getProductBundle,
  updateProductBundle,
  type Bundle,
  type UpdateBundleDropdown,
} from "./client";

import {
  searchProductVariants,
} from "../products/client";

export async function getProductBundleAction(
  variantId: string,
): Promise<Bundle> {
  return getProductBundle(variantId);
}

export async function updateProductBundleAction(
  productId: string,
  variantId: string,
  dropdowns: UpdateBundleDropdown[],
): Promise<Bundle> {
  return updateProductBundle(
    productId,
    variantId,
    dropdowns,
  );
}

export async function searchProductVariantsAction(
  search: string,
) {
  return searchProductVariants(
    search,
    1,
    50,
  );
}

export async function deleteProductBundleAction(
  productId: string,
  variantId: string,
) {
  return deleteProductBundle(
    productId,
    variantId,
  );
}