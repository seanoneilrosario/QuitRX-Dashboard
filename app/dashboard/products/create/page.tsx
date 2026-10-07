import Link from "next/link";

import {
  safeRetailAll,
  safeRetailList,
} from "@/lib/quitmed-retail-admin/products/client";

import styles from "@/app/components/dashboard.module.css";

import { ProductCreateForm } from "../products-component/product-create-fields";

export default async function ProductCreatePage() {
  const [
    brands,
    productTypes,
    collections,
    tags,
  ] = await Promise.all([
    safeRetailList("/brands"),
    safeRetailList("/product-type"),
    safeRetailList("/collections"),
    safeRetailAll("/tags"),
  ]);

  const error =
    brands.error ??
    productTypes.error ??
    collections.error ??
    tags.error;

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>
            QuitRX operations
          </p>

          <h1>Create product</h1>

          <p>
            Add a new product to your QuitHero
            retail catalogue.
          </p>
        </div>

        <div
          className={
            styles.collectionDeleteActions
          }
        >
          <Link
            className={styles.secondary}
            href="/dashboard/products"
          >
            Back to products
          </Link>
        </div>
      </header>

      {error ? (
        <div
          className={styles.notice}
          role="alert"
        >
          <strong>
            Unable to load product options
          </strong>

          <span>{error}</span>
        </div>
      ) : null}

      <ProductCreateForm
        brands={brands.data}
        productTypes={productTypes.data}
        collections={collections.data}
        availableTags={tags.data}
      />
    </>
  );
}