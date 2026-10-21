import Link from "next/link";

import styles from "@/app/components/dashboard.module.css";

import type {
  RetailRecord,
} from "@/lib/quitmed-retail-admin/collections/client";

import {
  CollectionCreateForm,
} from "@/app/dashboard/collections/collection-component/collection-create-fields";

import CollectionDeleteButton from "./collection-delete-button";

type ProductOption = {
  id: string;
  name: string;
  slug: string;
  brand: string;
};

type Props = {
  item?: RetailRecord;
  products: RetailRecord[];
  productPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
  returnTo: string;
  selectedProductDetails: RetailRecord[];
};

export default function CollectionEdit({
  item,
  products,
  selectedProductDetails,
  productPagination,
  error,
  returnTo,
}: Props) {
  if (!item) {
    return (
      <>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>
              QuitRX operations
            </p>

            <h1>Collection not found</h1>

            <p>
              Choose a collection from the collections list.
            </p>
          </div>

          <Link
            href={returnTo}
            className={styles.primary}
          >
            Back to collections
          </Link>
        </header>

        {error ? (
          <div className={styles.notice}>
            <strong>API connection needed</strong>
            <span>{error}</span>
          </div>
        ) : null}
      </>
    );
  }

  const collectionId = String(item.id ?? "");

  const collectionName =
    typeof item.name === "string"
      ? item.name
      : "this collection";

  const viewHref =
    `/dashboard/collections/view?id=${encodeURIComponent(
      collectionId,
    )}&returnTo=${encodeURIComponent(returnTo)}`;

  // The page loader should provide the selected product IDs
  // and the corresponding product records.
  const rawProductIds = Array.isArray(item.productIds)
    ? item.productIds
    : Array.isArray(item.products)
      ? item.products
          .map((product) =>
            product &&
            typeof product === "object" &&
            "id" in product
              ? product.id
              : undefined,
          )
          .filter((id): id is string => typeof id === "string")
      : [];

  const selectedProductIds = rawProductIds.flatMap((value) => {
    if (typeof value === "string") {
      return [value];
    }

    if (
      value &&
      typeof value === "object" &&
      "id" in value &&
      typeof value.id === "string"
    ) {
      return [value.id];
    }

    return [];
  });

  const productOptions: ProductOption[] = products.flatMap(
    (product) => {
      if (typeof product.id !== "string") {
        return [];
      }

      return [
        {
          id: product.id,
          name:
            typeof product.name === "string"
              ? product.name
              : typeof product.slug === "string"
                ? product.slug
                : "Unnamed product",
          slug:
            typeof product.slug === "string"
              ? product.slug
              : "",
          brand:
            typeof product.brand === "string"
              ? product.brand
              : "",
        },
      ];
    },
  );

  // Preserve any product details already included in the collection
  // response, then merge in the products from the catalog page.
  const productMap = new Map<string, ProductOption>();

  if (Array.isArray(item.products)) {
    for (const product of item.products) {
      if (
        !product ||
        typeof product !== "object" ||
        !("id" in product)
      ) {
        continue;
      }

      const record = product as RetailRecord;

      // Ensure the ID is a valid string before using it.
      if (typeof record.id !== "string" || !record.id) {
        continue;
      }

      productMap.set(record.id, {
        id: record.id,
        name:
          typeof record.name === "string" && record.name.trim()
            ? record.name
            : typeof record.slug === "string"
              ? record.slug
              : "Unnamed product",
        slug:
          typeof record.slug === "string"
            ? record.slug
            : "",
        brand:
          typeof record.brand === "string"
            ? record.brand
            : "",
      });
    }
  }

  for (const product of productOptions) {
    const existing = productMap.get(product.id);

    productMap.set(product.id, {
      ...existing,
      ...product,
      name:
        product.name !== "Unnamed product"
          ? product.name
          : existing?.name ?? product.name,
    });
  }

  const initialProducts = selectedProductIds.flatMap((id) => {
    const product = productMap.get(id);
    return product ? [product] : [];
  });

  // Include selected products in the options passed to the form,
  // even when they are not on the first catalog page.
  const allProductOptions = [
    ...productOptions,
    ...initialProducts.filter(
      (selected) =>
        !productOptions.some((product) => product.id === selected.id),
    ),
  ];

  const initialItem: RetailRecord = {
    ...item,
    productIds: selectedProductIds,
  };

  const selectedProductOptions = selectedProductDetails.flatMap((product) =>
    typeof product.id === "string"
      ? [
          {
            id: product.id,
            name:
              typeof product.name === "string"
                ? product.name
                : "Unnamed product",
            slug: typeof product.slug === "string" ? product.slug : "",
            brand: typeof product.brand === "string" ? product.brand : "",
          },
        ]
      : []
  );

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>
            QuitRX operations
          </p>

          <h1>Edit {collectionName}</h1>

          <p>
            Update collection details and product membership.
          </p>
        </div>

        <div className={styles.collectionDeleteActions}>
          <Link
            href={returnTo}
            className={styles.secondary}
          >
            Back to collections
          </Link>

          <Link
            href={viewHref}
            className={styles.primary}
          >
            View collection
          </Link>

          <CollectionDeleteButton
            id={collectionId}
            name={collectionName}
          />
        </div>
      </header>

      {error ? (
        <div className={styles.notice}>
          <strong>API connection needed</strong>
          <span>{error}</span>
        </div>
      ) : null}

      <section className={styles.formCard}>
        <h2>Collection details</h2>

        <CollectionCreateForm
          products={productOptions}
          selectedProductDetails={selectedProductOptions}
          productPagination={productPagination}
          initial={initialItem}
        />
      </section>
    </>
  );
}
