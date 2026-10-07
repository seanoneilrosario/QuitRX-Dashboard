"use client";

import Link from "next/link";
import {
  useActionState,
} from "react";

import styles from "@/app/components/dashboard.module.css";
import type { RetailRecord } from "@/lib/quitmed-retail-admin/collections/client";
import {
  createProduct,
  type ProductActionState,
} from "@/lib/quitmed-retail-admin/products/actions";

type Props = {
  initial?: RetailRecord;
  brands: RetailRecord[];
  productTypes: RetailRecord[];
  collections: RetailRecord[];
  availableTags: RetailRecord[];
};

const initialState: ProductActionState = {
  message: "",
  success: false,
};

function text(
  value: unknown,
  fallback = "",
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

function getProductTagIds(
  item?: RetailRecord,
): string[] {
  if (!Array.isArray(item?.tags)) {
    return [];
  }

  return item.tags.flatMap((tag) => {
    if (
      typeof tag === "string" &&
      tag.trim()
    ) {
      return [tag];
    }

    if (
      !tag ||
      typeof tag !== "object" ||
      Array.isArray(tag)
    ) {
      return [];
    }

    const record =
      tag as RetailRecord;

    const linkedTag =
      nested(record, "tag");

    const id = text(
      record.tagId ??
        linkedTag?.id ??
        record.id,
      "",
    );

    return id ? [id] : [];
  });
}

function getProductCollections(
  item: RetailRecord | undefined,
  collections: RetailRecord[],
): RetailRecord[] {
  const productId = text(
    item?.id,
    "",
  );

  if (!productId) {
    return [];
  }

  return collections.filter(
    (collection) => {
      if (
        !Array.isArray(
          collection.products,
        )
      ) {
        return false;
      }

      return (
        collection.products as RetailRecord[]
      ).some((product) => {
        return (
          text(
            product.productId,
            "",
          ) === productId ||
          text(
            nested(
              product,
              "product",
            )?.id,
            "",
          ) === productId
        );
      });
    },
  );
}

export function ProductCreateForm({
  initial,
  brands,
  productTypes,
  collections,
  availableTags,
}: Props) {
  const [
    state,
    action,
    pending,
  ] = useActionState(
    createProduct,
    initialState,
  );

  const editing =
    typeof initial?.id ===
    "string" &&
    initial.id.length > 0;

  const selectedTagIds =
    new Set(
      getProductTagIds(initial),
    );

  const productCollections =
    getProductCollections(
      initial,
      collections,
    );

  return (
    <form
      action={action}
      className={styles.form}
    >
      <input
        type="hidden"
        name="_id"
        value={text(initial?.id)}
      />

      {state.message && (
        <div
          className={styles.notice}
          role={
            state.success
              ? "status"
              : "alert"
          }
        >
          <strong>
            {state.success
              ? "Product saved"
              : "Unable to save product"}
          </strong>

          <span>
            {state.message}
          </span>
        </div>
      )}

      <section
        className={styles.formCard}
      >
        <h2>Product details</h2>

        <div
          className={styles.formGrid}
        >
          <label>
            Product name

            <input
              required
              name="name"
              type="text"
              defaultValue={text(
                initial?.name,
              )}
              disabled={pending}
            />
          </label>

          <label>
            Slug

            <input
              required
              name="slug"
              type="text"
              defaultValue={text(
                initial?.slug,
              )}
              disabled={pending}
            />
          </label>

          <label
            className={styles.full}
          >
            Short description

            <textarea
              name="shortDescription"
              rows={3}
              defaultValue={text(
                initial?.shortDescription,
              )}
              disabled={pending}
            />
          </label>

          <label
            className={styles.full}
          >
            Description

            <textarea
              name="description"
              rows={16}
              defaultValue={text(
                initial?.description,
              )}
              disabled={pending}
            />

            <small>
              HTML content from the
              product catalogue is
              preserved here.
            </small>
          </label>
        </div>
      </section>

      <section
        className={styles.formCard}
      >
        <h2>Publishing & SEO</h2>

        <div
          className={styles.formGrid}
        >
          <label>
            Status

            <select
              name="status"
              defaultValue={text(
                initial?.status,
                "DRAFT",
              )}
              disabled={pending}
            >
              <option value="DRAFT">
                Draft
              </option>

              <option value="ACTIVE">
                Active
              </option>

              <option value="ARCHIVED">
                Archived
              </option>
            </select>
          </label>

          <label>
            Primary image ID

            <input
              name="imageId"
              type="text"
              defaultValue={text(
                initial?.imageId,
              )}
              disabled={pending}
            />
          </label>

          <label>
            SEO title

            <input
              name="seoTitle"
              type="text"
              defaultValue={text(
                initial?.seoTitle,
              )}
              disabled={pending}
            />
          </label>

          <label
            className={styles.full}
          >
            SEO description

            <textarea
              name="seoDescription"
              rows={8}
              defaultValue={text(
                initial?.seoDescription,
              )}
              disabled={pending}
            />
          </label>
        </div>
      </section>

      <section
        className={styles.formCard}
      >
        <h2>Product organization</h2>

        <div
          className={
            styles.organizationGrid
          }
        >
          <label>
            Product type

            <select
              required
              name="productTypeId"
              defaultValue={text(
                initial?.productTypeId ??
                  nested(
                    initial ?? {},
                    "productType",
                  )?.id,
                "",
              )}
              disabled={pending}
            >
              <option
                value=""
                disabled
              >
                Select a product type
              </option>

              {productTypes.map(
                (type) => (
                  <option
                    key={text(
                      type.id,
                    )}
                    value={text(
                      type.id,
                    )}
                  >
                    {text(
                      type.name,
                    )}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            Brand

            <select
              required
              name="brandId"
              defaultValue={text(
                initial?.brandId ??
                  nested(
                    initial ?? {},
                    "brand",
                  )?.id,
                "",
              )}
              disabled={pending}
            >
              <option
                value=""
                disabled
              >
                Select a brand
              </option>

              {brands.map(
                (brand) => (
                  <option
                    key={text(
                      brand.id,
                    )}
                    value={text(
                      brand.id,
                    )}
                  >
                    {text(
                      brand.name,
                    )}
                  </option>
                ),
              )}
            </select>
          </label>

          <div
            className={
              styles.organizationField
            }
          >
            <div>
              <span>
                Collections
              </span>

              <Link
                href="/dashboard/collections"
                aria-label="Manage collections"
              >
                +
              </Link>
            </div>

            <div
              className={
                styles.organizationChips
              }
            >
              {productCollections.length >
              0 ? (
                productCollections.map(
                  (collection) => (
                    <span
                      className={
                        styles.tagChip
                      }
                      key={text(
                        collection.id,
                      )}
                    >
                      {text(
                        collection.name,
                      )}
                    </span>
                  ),
                )
              ) : (
                <small>
                  No collections
                  assigned
                </small>
              )}
            </div>

            <small>
              Collection membership
              is managed from the
              Collections section.
            </small>
          </div>

          <div
            className={
              styles.organizationField
            }
          >
            <div>
              <span>Tags</span>

              <Link
                href="/dashboard/products/tags"
                aria-label="Manage tags"
              >
                +
              </Link>
            </div>

            {availableTags.length >
            0 ? (
              <select
                name="tags"
                multiple
                defaultValue={
                  getProductTagIds(
                    initial,
                  )
                }
                disabled={pending}
                size={Math.min(
                  8,
                  Math.max(
                    4,
                    availableTags.length,
                  ),
                )}
              >
                {availableTags.map(
                  (tag) => (
                    <option
                      key={text(
                        tag.id,
                      )}
                      value={text(
                        tag.id,
                      )}
                    >
                      {text(
                        tag.name,
                      )}
                    </option>
                  ),
                )}
              </select>
            ) : (
              <small>
                No tags available.
              </small>
            )}

            {selectedTagIds.size >
              0 && (
              <small>
                {selectedTagIds.size}{" "}
                {selectedTagIds.size ===
                1
                  ? "tag"
                  : "tags"}{" "}
                currently assigned.
              </small>
            )}
          </div>
        </div>
      </section>

      <section
        className={styles.formCard}
      >
        <div
          className={styles.cardTitle}
        >
          <div>
            <h2>
              Catalogue information
            </h2>

            <p>
              Product information
              maintained by QuitHero
              and Qoblex.
            </p>
          </div>
        </div>

        <div
          className={styles.formGrid}
        >
          <div>
            <strong>
              Product ID
            </strong>

            <p>
              {text(
                initial?.id,
                "—",
              )}
            </p>
          </div>

          <div>
            <strong>
              Source system
            </strong>

            <p>
              {text(
                initial?.sourceSystem,
                "—",
              )}
            </p>
          </div>

          <div>
            <strong>
              Source ID
            </strong>

            <p>
              {text(
                initial?.sourceId,
                "—",
              )}
            </p>
          </div>

          <div>
            <strong>
              Last synced
            </strong>

            <p>
              {text(
                initial?.lastSyncedAt,
                "—",
              )}
            </p>
          </div>
        </div>
      </section>

      <div
        className={styles.formActions}
      >
        <Link href="/dashboard/products">
          Cancel
        </Link>

        <button
          type="submit"
          className={
            styles.primary
          }
          disabled={pending}
        >
          {pending
            ? "Saving…"
            : editing
              ? "Save changes"
              : "Create product"}
        </button>
      </div>
    </form>
  );
}