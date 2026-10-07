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
  }>;
};

export default async function CollectionEditPage({
  searchParams,
}: Props) {
  const params = await searchParams;
  const id = params.id?.trim() ?? "";

  if (!id) {
    return (
      <div className={styles.notice}>
        <strong>Collection not found</strong>
        <span>No collection ID was provided.</span>
        <Link
          href="/dashboard/collections"
          className={styles.primary}
        >
          Back to collections
        </Link>
      </div>
    );
  }

  const [collection, products, collectionProductIds] =
  await Promise.all([
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
    />
  );
}