import Link from "next/link";

import styles from "@/app/components/dashboard.module.css";
import type { RetailRecord } from "@/lib/quitmed-retail-admin/collections/client";
import { retailRequest } from "@/lib/quitmed-retail-admin/collections/client";

import ProductView from "../products-component/ProductView";
import { normalizeRichText } from "@/lib/quitmed-retail-admin/products/utils";

type Props = {
  searchParams: Promise<{
    id?: string;
    returnTo?: string;
  }>;
};

type ProductResponse = {
  data?: RetailRecord;
};

function safeProductsReturnTo(value?: string): string {
  const fallback = "/dashboard/products";

  if (
    typeof value !== "string" ||
    !value.startsWith("/dashboard/products") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return fallback;
  }

  try {
    const url = new URL(
      value,
      "https://dashboard.invalid",
    );

    if (
      url.origin !== "https://dashboard.invalid" ||
      url.pathname !== "/dashboard/products"
    ) {
      return fallback;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

async function getProduct(
  id: string,
): Promise<RetailRecord> {
  const response =
    await retailRequest<ProductResponse>(
      `/products/${encodeURIComponent(id)}`,
      {
        cache: "no-store",
      },
    );

  if (
    !response.data ||
    typeof response.data !== "object"
  ) {
    throw new Error(
      "Product was not returned by the QuitHero API.",
    );
  }

  return {
    ...response.data,
    description: normalizeRichText(
      response.data.description,
    ),
    seoDescription: normalizeRichText(
      response.data.seoDescription,
    ),
    shortDescription:
      typeof response.data.shortDescription ===
      "string"
        ? response.data.shortDescription.trim()
        : response.data.shortDescription,
  };
}

export default async function ProductViewPage({
  searchParams,
}: Props) {
  const params = await searchParams;
  const id = params.id?.trim() ?? "";
  const returnTo = safeProductsReturnTo(
    params.returnTo,
  );

  if (!id) {
    return (
      <div className={styles.notice}>
        <strong>Product not found</strong>

        <span>
          No product ID was provided.
        </span>

        <Link
          href={returnTo}
          className={styles.primary}
        >
          Back to products
        </Link>
      </div>
    );
  }

  try {
    const product = await getProduct(id);

    return (
      <ProductView
        item={product}
        returnTo={returnTo}
      />
    );
  } catch (error) {
    return (
      <>
        <div className={styles.notice}>
          <strong>
            Unable to load product
          </strong>

          <span>
            {error instanceof Error
              ? error.message
              : "Unable to load product."}
          </span>
        </div>

        <Link
          href={returnTo}
          className={styles.primary}
        >
          Back to products
        </Link>
      </>
    );
  }
}