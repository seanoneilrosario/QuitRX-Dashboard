import Link from "next/link";

import styles from "@/app/components/dashboard.module.css";

import { getCollectionEditProducts } from "@/lib/quitmed-retail-admin/collections/collections";

import { CollectionCreateForm } from "../collection-component/collection-create-fields";

type ProductOption = {
  id: string;
  name: string;
  slug: string;
  brand: string;
};

export default async function CollectionCreatePage() {
  let products: ProductOption[] = [];

  let productPagination = {
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  };

  let error: string | undefined;

  try {
    const result =
      await getCollectionEditProducts(1, 50);

    products = result.data.map(
      (product) => ({
        id:
          typeof product.id === "string"
            ? product.id
            : "",
        name:
          typeof product.name === "string"
            ? product.name
            : "Unnamed product",
        slug:
          typeof product.slug === "string"
            ? product.slug
            : "",
        brand: "",
      }),
    );

    productPagination =
      result.pagination;
  } catch (err) {
    error =
      err instanceof Error
        ? err.message
        : "Unable to load products.";
  }

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>
            QuitRX operations
          </p>

          <h1>Create collection</h1>

          <p>
            Create a new collection and
            choose how products should be
            included.
          </p>
        </div>

        <Link
          className={styles.secondary}
          href="/dashboard/collections"
        >
          Back to collections
        </Link>
      </header>

      {error && (
        <div className={styles.notice}>
          <strong>
            Unable to load products
          </strong>
          <span>{error}</span>
        </div>
      )}

      <section className={styles.formCard}>
        <h2>Collection details</h2>

        <CollectionCreateForm
          products={products}
          productPagination={
            productPagination
          }
        />
      </section>
    </>
  );
}