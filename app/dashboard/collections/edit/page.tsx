import Link from "next/link";

import styles from "@/app/components/dashboard.module.css";

import {
  safeCollectionForEdit,
  getCollectionEditProducts,
  getAllCollectionProductIds,
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
    const url = new URL(
      candidate,
      "http://dashboard.local",
    );

    // Only allow navigation back to the collections list.
    // Preserve its query parameters, such as the current page.
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

        <Link
          href={returnTo}
          className={styles.primary}
        >
          Back to collections
        </Link>
      </div>
    );
  }

  const [
    collection,
    products,
    collectionProductIds,
  ] = await Promise.all([
    safeCollectionForEdit(id),
    getCollectionEditProducts(1, 50),
    getAllCollectionProductIds(id),
  ]);

  return (
    <CollectionEdit
      item={{
        ...collection.data,
        productIds: collectionProductIds,
      }}
      products={products.data}
      productPagination={products.pagination}
      error={collection.error}
      returnTo={returnTo}
    />
  );
}