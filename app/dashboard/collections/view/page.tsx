import styles from "@/app/components/dashboard.module.css";
import { safeCollectionPage } from "@/lib/quitmed-retail-admin/collections/collections";
import CollectionView from "../collection-component/CollectionView";

type Props = {
  searchParams: Promise<{
    id?: string;
    page?: string;
    status?: string;
  }>;
};

export default async function CollectionViewPage({
  searchParams,
}: Props) {
  const params = await searchParams;

  const id = params.id?.trim() ?? "";

  const page = Math.max(
    1,
    Number(params.page) || 1,
  );

  const status = params.status?.trim() ?? "";

  if (!id) {
    return (
      <div className={styles.notice}>
        <strong>Collection not found</strong>
        <span>
          No collection ID was provided.
        </span>
      </div>
    );
  }

  const result = await safeCollectionPage(
    id,
    page,
    24,
    status || undefined,
  );

  console.log("result:", result);

  return (
    <CollectionView
      id={id}
      item={result.data}
      products={result.products}
      pagination={result.pagination}
      error={result.error}
      status={status}
    />
  );
}