
import Link from "next/link";

import styles from "@/app/components/dashboard.module.css";

import {
  safeCollectionForEdit,
  getCollectionEditProducts,
  getCollectionProductsForEdit,
} from "@/lib/quitmed-retail-admin/collections/collections";

import CollectionEdit from "../collection-component/CollectionEdit";

type Props = {
  searchParams: Promise<{
    id?: string;
    returnTo?: string;
  }>;
};

const COLLECTIONS_PATH = "/dashboard/collections";

function getSafeReturnTo(value?: string): string {
  const fallback = COLLECTIONS_PATH;
  const candidate = value?.trim();

  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//")
  ) {
    return fallback;
  }

  try {
    const url = new URL(candidate, "http://dashboard.local");

    if (
      url.origin !== "http://dashboard.local" ||
      url.pathname !== COLLECTIONS_PATH
    ) {
      return fallback;
    }

    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

export default async function CollectionEditPage({
  searchParams,
}: Props) {
  const params = await searchParams;

  const id = params.id?.trim() ?? "";
  const returnTo = getSafeReturnTo(params.returnTo);

  if (!id) {
    return (
      <div className={styles.notice}>
        <strong>Collection not found</strong>

        <span>No collection ID was provided.</span>

        <Link href={returnTo} className={styles.primary}>
          Back to collections
        </Link>
      </div>
    );
  }

  // Fetch the collection to get its saved sort preference.
  const collection = await safeCollectionForEdit(id);

  const sortBy =
    typeof collection.data?.sortBy === "string"
      ? collection.data.sortBy
      : "RELEVANCE";

  // Fetch the collection products in the saved sort order.
  const sortedCollection = await getCollectionProductsForEdit(
    id,
    sortBy,
    1,
    50,
  );

  // Fetch the general product catalogue for the product selector.
  const products = await getCollectionEditProducts(1, 50);

  // Map the returned products into the format required by the UI.
  const selectedProductDetails = sortedCollection.data.flatMap(
    (item) => {
      if (typeof item.id !== "string" || !item.id) {
        return [];
      }

      return [
        {
          id: item.id,
          name:
            typeof item.name === "string"
              ? item.name
              : "Unnamed product",
          slug:
            typeof item.slug === "string"
              ? item.slug
              : "",
          brand:
            typeof item.brand === "string"
              ? item.brand
              : "",
        },
      ];
    },
  );

  const collectionProductIds = selectedProductDetails.map(
    (product) => product.id,
  );

  return (
    <CollectionEdit
      item={{
        ...collection.data,
        productIds: collectionProductIds,
      }}
      products={products.data}
      selectedProductDetails={selectedProductDetails}
      productPagination={products.pagination}
      error={collection.error}
      returnTo={returnTo}
    />
  );
}
