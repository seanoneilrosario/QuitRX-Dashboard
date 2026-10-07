import Link from "next/link";

import styles from "@/app/components/dashboard.module.css";

import CollectionHeader from "./collection-component/collectionHeader";
import CollectionsTable from "./collection-component/collectionsTable";

import {
  safeCollectionsPage,
} from "@/lib/quitmed-retail-admin/collections/collections";

type Props = {
  searchParams: Promise<{
    page?: string;
  }>;
};

export default async function CollectionsPage({
  searchParams,
}: Props) {
  const params = await searchParams;

  const page = Math.max(
    1,
    Number(params.page) || 1,
  );

  const result =
    await safeCollectionsPage(
      page,
      50,
    );

  return (
    <>
      <CollectionHeader />

      {result.error ? (
        <div className={styles.notice}>
          <strong>
            API connection needed
          </strong>

          <span>
            {result.error}
          </span>
        </div>
      ) : null}

      <CollectionsTable
        data={result.data}
      />

      {!result.data.length &&
      !result.error ? (
        <div className={styles.emptyState}>
          <strong>
            No collections found
          </strong>

          <span>
            Create your first collection
            to get started.
          </span>
        </div>
      ) : null}

      {result.pagination.totalPages >
      1 ? (
        <nav
          className={styles.pagination}
          aria-label="Collections pagination"
        >
          <span>
            Showing page{" "}
            {result.pagination.page} of{" "}
            {result.pagination.totalPages} ·{" "}
            {result.pagination.total.toLocaleString()}{" "}
            records
          </span>

          <div>
            {result.pagination.page >
            1 ? (
              <Link
                href={`/dashboard/collections?page=${
                  result.pagination.page - 1
                }`}
              >
                Previous
              </Link>
            ) : (
              <span>Previous</span>
            )}

            {result.pagination.page <
            result.pagination.totalPages ? (
              <Link
                href={`/dashboard/collections?page=${
                  result.pagination.page + 1
                }`}
              >
                Next
              </Link>
            ) : (
              <span>Next</span>
            )}
          </div>
        </nav>
      ) : null}
    </>
  );
}