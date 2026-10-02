import Link from "next/link";

import type {
  RetailRecord,
} from "@/lib/quithero-admin";

import type {
  CollectionProductOption,
} from "@/lib/collection-products";

import styles from "../[[...section]]/dashboard.module.css";
import CollectionDeleteButton from "../[[...section]]/collection-delete-button";
import { CollectionCreateForm } from "../[[...section]]/collection-create-fields";

type CollectionEditSectionProps = {
  item?: RetailRecord;
  products: RetailRecord[];
  error?: string;
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
}

function nested(item: RetailRecord, key: string) {
  const value = item[key];

  return value && typeof value === "object"
    ? (value as RetailRecord)
    : undefined;
}

function collectionProductOptions(
  products: RetailRecord[],
): CollectionProductOption[] {
  return products.flatMap((product) => {
    if (typeof product.id !== "string") {
      return [];
    }

    return [
      {
        id: product.id,
        name: text(product.name, "Unnamed product"),
        slug: text(product.slug, ""),
        brand: text(
          nested(product, "brand")?.name ?? product.brand,
          "",
        ),
        description: text(product.description, ""),
        sku: text(product.sku, ""),
        category: text(
          nested(product, "category")?.name ?? product.category,
          "",
        ),
        productType: text(
          nested(product, "productType")?.name ?? product.productType,
          "",
        ),
        vendor: text(
          nested(product, "vendor")?.name ?? product.vendor,
          "",
        ),
        price:
          product.price != null &&
          String(product.price).trim() !== "" &&
          Number.isFinite(Number(product.price))
            ? Number(product.price)
            : undefined,
        inventory:
          product.inventory != null &&
          String(product.inventory).trim() !== "" &&
          Number.isFinite(Number(product.inventory))
            ? Number(product.inventory)
            : undefined,
        tags: Array.isArray(product.tags)
          ? product.tags
              .map((tag) => {
                if (typeof tag === "string") {
                  return tag;
                }

                return text(
                  nested(tag as RetailRecord, "tag")?.name ??
                    (tag as RetailRecord).name,
                  "",
                );
              })
              .filter(Boolean)
          : [],
      },
    ];
  });
}

export default function CollectionEditSection({
  item,
  products,
  error,
}: CollectionEditSectionProps) {
  if (!item) {
    return (
      <>
        <div className={styles.header}>
          <div>
            <h1>Collection not found</h1>
            <p>
              Choose a collection from the collections list.
            </p>
          </div>
        </div>

        {error && (
          <div className={styles.notice}>
            {error}
          </div>
        )}

        <Link
          className={styles.primary}
          href="/dashboard/collections"
        >
          Back to collections
        </Link>
      </>
    );
  }

  const productOptions = collectionProductOptions(products);

  return (
    <>
      {error && (
        <div className={styles.notice}>
          {error}
        </div>
      )}

      <section className={styles.formCard}>
        <CollectionCreateForm
          products={productOptions}
          initial={item}
        />
      </section>
    </>
  );
}