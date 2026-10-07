import Link from "next/link";

import styles from "@/app/components/dashboard.module.css";
import type { RetailRecord } from "@/lib/quitmed-retail-admin/collections/client";

type Props = {
  item: RetailRecord;
};

function text(
  value: unknown,
  fallback = "—",
): string {
  return typeof value === "string" ||
    typeof value === "number"
    ? String(value)
    : fallback;
}

function nested(
  item: RetailRecord,
  key: string,
): RetailRecord | undefined {
  const value = item[key];

  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as RetailRecord)
    : undefined;
}

function statusClass(value: string) {
  return /draft|pending/i.test(value)
    ? styles.warning
    : "";
}

function availableStock(
  variant: RetailRecord,
): number {
  return Math.max(
    0,
    Number(variant.inventory ?? 0) -
      Number(variant.allocatedInventory ?? 0),
  );
}

function tagName(tag: unknown): string {
  if (typeof tag === "string") {
    return tag;
  }

  if (
    tag &&
    typeof tag === "object" &&
    !Array.isArray(tag)
  ) {
    const record = tag as RetailRecord;
    const linkedTag = nested(record, "tag");

    return text(
      linkedTag?.name ??
        record.name ??
        record.tagName,
      "",
    );
  }

  return "";
}

export default function ProductView({
  item,
}: Props) {
  const brand = nested(item, "brand");
  const productType = nested(
    item,
    "productType",
  );

  const variants = Array.isArray(
    item.variants,
  )
    ? item.variants.filter(
        (
          variant,
        ): variant is RetailRecord =>
          Boolean(
            variant &&
              typeof variant ===
                "object" &&
              !Array.isArray(
                variant,
              ),
          ),
      )
    : [];

  const images = Array.isArray(item.images)
    ? item.images.filter(
        (
          image,
        ): image is RetailRecord =>
          Boolean(
            image &&
              typeof image ===
                "object" &&
              !Array.isArray(image),
          ),
      )
    : [];

  const tags = Array.isArray(item.tags)
    ? item.tags
        .map(tagName)
        .filter(Boolean)
    : [];

  const options = Array.isArray(
    item.productOptions,
  )
    ? item.productOptions.filter(
        (
          option,
        ): option is RetailRecord =>
          Boolean(
            option &&
              typeof option ===
                "object" &&
              !Array.isArray(
                option,
              ),
          ),
      )
    : [];

  const totalInventory =
    variants.reduce(
      (total, variant) =>
        total + availableStock(variant),
      0,
    );

  const slug = text(
    item.slug,
    "",
  );

  const storefrontBaseUrl = (
    process.env.STOREFRONT_BASE_URL ??
    "https://quitrx-website-front-ecru.vercel.app"
  ).replace(/\/$/, "");

  const storefrontUrl = slug
    ? `${storefrontBaseUrl}/product/${encodeURIComponent(
        slug,
      )}`
    : "";

  console.log("VIEW ITEM DESCRIPTION:", item.description);

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>
            QuitRX operations
          </p>

          <h1>
            {text(
              item.name,
              "Product",
            )}
          </h1>

          <p>
            View product information,
            variants, images and
            merchandising data.
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

          {storefrontUrl && (
            <a
              className={styles.primary}
              href={storefrontUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on store
            </a>
          )}
        </div>
      </header>

      <section className={styles.formCard}>
        <div
          className={styles.cardTitle}
        >
          <div>
            <h2>
              Product details
            </h2>

            <p>
              {text(item.slug)}
            </p>
          </div>

          <span
            className={`${styles.status} ${statusClass(
              text(item.status, "UNKNOWN"),
            )}`}
          >
            {text(
              item.status,
              "UNKNOWN",
            ).replaceAll(
              "_",
              " ",
            )}
          </span>
        </div>

        <div
          className={styles.formGrid}
        >
          <div>
            <strong>Name</strong>
            <p>
              {text(item.name)}
            </p>
          </div>

          <div>
            <strong>Slug</strong>
            <p>
              {text(item.slug)}
            </p>
          </div>

          <div>
            <strong>Brand</strong>
            <p>
              {text(
                brand?.name ??
                  item.brandId,
              )}
            </p>
          </div>

          <div>
            <strong>Product type</strong>
            <p>
              {text(
                productType?.name ??
                  item.productTypeId,
              )}
            </p>
          </div>

          <div>
            <strong>Inventory</strong>
            <p>
              {totalInventory.toLocaleString()} units
            </p>
          </div>

          <div>
            <strong>Product ID</strong>
            <p>
              {text(item.id)}
            </p>
          </div>

          <div
            className={styles.full}
          >
            <strong>
              Short description
            </strong>
            <p>
              {text(
                item.shortDescription,
              )}
            </p>
          </div>

          <div className={styles.full}>
            <strong>Description</strong>

            {typeof item.description === "string" &&
            item.description.trim() ? (
              <div
                className={styles.richText}
                dangerouslySetInnerHTML={{
                  __html: item.description,
                }}
              />
            ) : (
              <p>No description available.</p>
            )}
          </div>
        </div>
      </section>

      <section className={styles.formCard}>
        <div
          className={styles.cardTitle}
        >
          <div>
            <h2>Tags</h2>
            <p>
              Product merchandising
              tags.
            </p>
          </div>
        </div>

        {tags.length ? (
          <div
            className={
              styles.organizationChips
            }
          >
            {tags.map(
              (tag, index) => (
                <span
                  className={
                    styles.tagChip
                  }
                  key={`${tag}-${index}`}
                >
                  {tag}
                </span>
              ),
            )}
          </div>
        ) : (
          <p>No tags assigned.</p>
        )}
      </section>

      <section className={styles.formCard}>
        <div
          className={styles.cardTitle}
        >
          <div>
            <h2>Options</h2>
            <p>
              Product options and
              attributes.
            </p>
          </div>
        </div>

        {options.length ? (
          <div
            className={
              styles.organizationChips
            }
          >
            {options.map(
              (option, index) => (
                <span
                  className={
                    styles.tagChip
                  }
                  key={text(
                    option.id,
                    String(index),
                  )}
                >
                  {text(
                    option.name ??
                      option.title ??
                      option.slug,
                  )}
                </span>
              ),
            )}
          </div>
        ) : (
          <p>No options assigned.</p>
        )}
      </section>

      <section className={styles.formCard}>
        <div
          className={styles.cardTitle}
        >
          <div>
            <h2>Variants</h2>
            <p>
              {variants.length}{" "}
              {variants.length === 1
                ? "variant"
                : "variants"}
            </p>
          </div>
        </div>

        {variants.length ? (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Variant</th>
                  <th>SKU</th>
                  <th>Price</th>
                  <th>Available</th>
                </tr>
              </thead>

              <tbody>
                {variants.map(
                  (
                    variant,
                    index,
                  ) => (
                    <tr
                      key={text(
                        variant.id,
                        String(index),
                      )}
                    >
                      <td>
                        {text(
                          variant.name,
                          "Unnamed variant",
                        )}
                      </td>

                      <td>
                        {text(
                          variant.sku,
                        )}
                      </td>

                      <td>
                        {variant.price !=
                        null
                          ? `$${Number(
                              variant.price,
                            ).toFixed(
                              2,
                            )}`
                          : "—"}
                      </td>

                      <td>
                        {availableStock(
                          variant,
                        ).toLocaleString()}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            No variants assigned.
          </p>
        )}
      </section>

      <section className={styles.formCard}>
        <div
          className={styles.cardTitle}
        >
          <div>
            <h2>Images</h2>
            <p>
              {images.length}{" "}
              {images.length === 1
                ? "image"
                : "images"}
            </p>
          </div>
        </div>

        {images.length ? (
          <div
            className={
              styles.organizationChips
            }
          >
            {images.map(
              (
                image,
                index,
              ) => (
                <div
                  key={text(
                    image.id,
                    String(index),
                  )}
                >
                  {text(
                    image.url,
                    "",
                  ) ? (
                    // API-hosted product images are displayed directly.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={text(
                        image.url,
                        "",
                      )}
                      alt={text(
                        image.altText,
                        "",
                      )}
                      style={{
                        width:
                          120,
                        height:
                          120,
                        objectFit:
                          "cover",
                      }}
                    />
                  ) : (
                    <span>
                      {text(
                        image.id,
                      )}
                    </span>
                  )}
                </div>
              ),
            )}
          </div>
        ) : (
          <p>No images assigned.</p>
        )}
      </section>
    </>
  );
}