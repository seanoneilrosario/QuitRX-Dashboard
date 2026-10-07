import { retailRequest } from "../collections/client";

export type BundleProduct = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  shortDescription?: string | null;
  status?: string;
};

export type BundleComponentVariant = {
  id: string;
  productId: string;
  name: string;
  sku: string;
  supplierSku?: string | null;
  barcode?: string | null;
  price: string | number;
  cost?: string | number | null;
  inventory: number;
  allocatedInventory: number;
  incomingInventory: number;
  weight?: number | null;
  requiresShipping: boolean;
  imageId?: string | null;
  product?: BundleProduct;
};

export type BundleOption = {
  id: string;
  dropdownId: string;
  componentVariantId: string;
  createdAt?: string;
  componentVariant: BundleComponentVariant;
};

export type BundleDropdown = {
  id: string;
  bundleVariantId: string;
  position: number;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  options: BundleOption[];
};

export type Bundle = {
  id: string;
  productId: string;
  name: string;
  sku: string;
  supplierSku?: string | null;
  barcode?: string | null;
  price: string | number;
  cost?: string | number | null;
  inventory: number;
  allocatedInventory: number;
  incomingInventory: number;
  weight?: number | null;
  requiresShipping: boolean;
  imageId?: string | null;
  createdAt: string;
  updatedAt: string;
  sourceSystem?: string | null;
  sourceId?: string | null;
  lastSyncedAt?: string | null;
  bundleDropdowns: BundleDropdown[];
};

export async function getBundle(
  productId: string,
  variantId: string,
) {
  return retailRequest<Bundle>(
    `/products/${encodeURIComponent(
      productId,
    )}/variants/${encodeURIComponent(
      variantId,
    )}/bundle`,
    {
      method: "GET",
      cache: "no-store",
    },
  );
}

export async function getProductBundle(
  variantId: string,
): Promise<Bundle> {
  return retailRequest<Bundle>(
    `/products/variants/${encodeURIComponent(
      variantId,
    )}/bundle`,
    {
      method: "GET",
      cache: "no-store",
    },
  );
}

export type UpdateBundleDropdown = {
  position: number;
  name: string;
  options: {
    componentVariantId: string;
  }[];
};

export async function updateProductBundle(
  productId: string,
  variantId: string,
  dropdowns: UpdateBundleDropdown[],
): Promise<Bundle> {
  return retailRequest<Bundle>(
    `/products/${encodeURIComponent(
      productId,
    )}/variants/${encodeURIComponent(
      variantId,
    )}/bundle`,
    {
      method: "PATCH",
      body: JSON.stringify(dropdowns),
      cache: "no-store",
    },
  );
}

export async function deleteProductBundle(
  productId: string,
  variantId: string,
): Promise<{
  success: boolean;
  message: string;
}> {
  return retailRequest<{
    success: boolean;
    message: string;
  }>(
    `/products/${encodeURIComponent(
      productId,
    )}/variants/${encodeURIComponent(
      variantId,
    )}/bundle`,
    {
      method: "DELETE",
      cache: "no-store",
    },
  );
}