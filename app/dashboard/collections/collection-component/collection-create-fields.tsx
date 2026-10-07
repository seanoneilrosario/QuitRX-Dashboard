"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  createCollection,
} from "@/lib/quitmed-retail-admin/collections/actions";

import {
  collectionProductIds,
  collectionRuleOperators,
  collectionRuleValue,
  isValidCollectionRule,
  type CollectionRule,
} from "@/lib/quitmed-retail-admin/collections/collection-products";

import ManualProductsField, {
  type ProductOption,
} from "./products/ManualProductsField";

import DynamicRulesField, {
  type DynamicRule,
} from "./products/DynamicRulesField";

import styles from "@/app/components/dashboard.module.css";
import { ActionButton } from "@/app/components/action-controls";

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function initialRules(
  initial?: Record<string, unknown>,
): DynamicRule[] {
  if (!Array.isArray(initial?.rules)) {
    return [
      {
        id: 0,
        field: "tags",
        operator: "equals",
        value: "",
      },
    ];
  }

  const rules = initial.rules.flatMap(
    (rule, id): DynamicRule[] => {
      if (
        !rule ||
        typeof rule !== "object" ||
        Array.isArray(rule)
      ) {
        return [];
      }

      const value =
        rule as Record<string, unknown>;

      let field = String(
        value.field ?? "",
      );

      const operator = String(
        value.operator ?? "",
      );

      if (field === "tag") {
        field = "tags";
      }

      if (
        !Object.prototype.hasOwnProperty.call(
          collectionRuleOperators,
          field,
        )
      ) {
        return [];
      }

      const validOperators =
        collectionRuleOperators[
          field as keyof typeof collectionRuleOperators
        ];

      if (
        !validOperators.includes(
          operator as CollectionRule["operator"],
        )
      ) {
        return [];
      }

      return [
        {
          id,
          field:
            field as DynamicRule["field"],
          operator:
            operator as DynamicRule["operator"],
          value:
            typeof value.value === "string" ||
            typeof value.value === "number"
              ? String(value.value)
              : "",
        },
      ];
    },
  );

  return rules.length
    ? rules
    : [
        {
          id: 0,
          field: "tags",
          operator: "equals",
          value: "",
        },
      ];
}

function CollectionCreateFields({
  initial,
}: {
  initial?: Record<string, unknown>;
}) {
  const [name, setName] = useState(
    typeof initial?.name === "string"
      ? initial.name
      : "",
  );

  const [slug, setSlug] = useState(
    typeof initial?.slug === "string"
      ? initial.slug
      : "",
  );

  const [slugEdited, setSlugEdited] =
    useState(
      Boolean(initial?.slug),
    );

  const initialImage =
    typeof initial?.image === "string"
      ? initial.image
      : "";

  const [
    imagePreview,
    setImagePreview,
  ] = useState("");

  const imageInput =
    useRef<HTMLInputElement>(null);

  const previewUrl = useRef("");

  useEffect(() => {
    return () => {
      if (previewUrl.current) {
        URL.revokeObjectURL(
          previewUrl.current,
        );
      }
    };
  }, []);

  return (
    <>
      <label>
        Collection name

        <input
          required
          name="name"
          value={name}
          onChange={(event) => {
            const nextName =
              event.target.value;

            setName(nextName);

            if (!slugEdited) {
              setSlug(
                slugify(nextName),
              );
            }
          }}
        />
      </label>

      <label>
        Slug

        <input
          required
          name="slug"
          value={slug}
          onChange={(event) => {
            setSlugEdited(true);

            setSlug(
              slugify(
                event.target.value,
              ),
            );
          }}
        />
      </label>

      <label className={styles.full}>
        Description

        <textarea
          name="description"
          defaultValue={
            typeof initial?.description ===
            "string"
              ? initial.description
              : ""
          }
        />
      </label>

      <input
        type="hidden"
        name="_currentImage"
        value={initialImage}
      />

      <label className={styles.full}>
        Image

        <input
          ref={imageInput}
          type="file"
          name="_imageFile"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(event) => {
            if (previewUrl.current) {
              URL.revokeObjectURL(
                previewUrl.current,
              );
            }

            const file =
              event.target.files?.[0];

            previewUrl.current = file
              ? URL.createObjectURL(file)
              : "";

            setImagePreview(
              previewUrl.current,
            );
          }}
        />

        <small>
          JPEG, PNG, WebP or GIF,
          up to 4 MB.
          {initialImage
            ? " Leave empty to keep the current image."
            : ""}
        </small>

        {(imagePreview ||
          initialImage) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={
              imagePreview ||
              initialImage
            }
            alt={
              imagePreview
                ? "Selected collection image preview"
                : "Current collection image"
            }
            style={{
              display: "block",
              width: "100%",
              maxWidth: 280,
              height: 180,
              objectFit: "contain",
              borderRadius: 8,
            }}
          />
        )}
      </label>

      <label>
        SEO title

        <input
          name="seoTitle"
          defaultValue={
            typeof initial?.seoTitle ===
            "string"
              ? initial.seoTitle
              : ""
          }
        />
      </label>

      <label>
        SEO description

        <input
          name="seoDescription"
          defaultValue={
            typeof initial?.seoDescription ===
            "string"
              ? initial.seoDescription
              : ""
          }
        />
      </label>
    </>
  );
}

export function CollectionCreateForm({
  products,
  productPagination,
  initial,
}: {
  products: ProductOption[];
  productPagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  initial?: Record<string, unknown>;
}) {
  const [
    state,
    action,
    pending,
  ] = useActionState(
    createCollection,
    {
      message: "",
      success: false,
    },
  );

  const editing =
    typeof initial?.id === "string";

  const [
    type,
    setType,
  ] = useState<
    "MANUAL" | "DYNAMIC"
  >(
    initial?.type === "DYNAMIC"
      ? "DYNAMIC"
      : "MANUAL",
  );

  const [
    match,
    setMatch,
  ] = useState<
    "ALL" | "ANY"
  >(
    initial?.match === "ANY"
      ? "ANY"
      : "ALL",
  );

  const initialProductIds =
    collectionProductIds(initial);

  const [
    selected,
    setSelected,
  ] = useState<string[]>(
    () => initialProductIds,
  );

  const [
    rules,
    setRules,
  ] = useState<DynamicRule[]>(
    () => initialRules(initial),
  );

  return (
    <form
      action={action}
      className={styles.form}
      onReset={(event) =>
        event.preventDefault()
      }
    >
      <input
        type="hidden"
        name="_id"
        value={
          editing
            ? String(initial?.id ?? "")
            : ""
        }
      />

      {editing &&
        initial?.type === "MANUAL" && (
          <input
            type="hidden"
            name="_initialProductIds"
            value={JSON.stringify(
              initialProductIds,
            )}
          />
        )}

      {Array.isArray(initial?.rules) &&
        initial.rules.some(
          (rule) =>
            rule &&
            typeof rule === "object" &&
            !Array.isArray(rule) &&
            (
              rule as Record<
                string,
                unknown
              >
            ).field === "tag",
        ) && (
          <p role="status">
            This collection uses
            the old Tag field. Review
            the Tags rules and matching
            products, then save to
            update it.
          </p>
        )}

      <div className={styles.inlineForm}>
        <CollectionCreateFields
          initial={initial}
        />

        <fieldset
          className={`${styles.collectionMode} ${styles.full}`}
          disabled={pending}
        >
          <legend>
            Collection type
          </legend>

          <label>
            <input
              type="radio"
              name="type"
              value="MANUAL"
              checked={
                type === "MANUAL"
              }
              onChange={() =>
                setType("MANUAL")
              }
            />

            <span>
              Manual

              <small>
                Select individual
                products.
              </small>
            </span>
          </label>

          <label>
            <input
              type="radio"
              name="type"
              value="DYNAMIC"
              checked={
                type === "DYNAMIC"
              }
              onChange={() =>
                setType("DYNAMIC")
              }
            />

            <span>
              Dynamic

              <small>
                Include products
                using rules.
              </small>
            </span>
          </label>
        </fieldset>

        <input
          type="hidden"
          name="match"
          value={match}
        />

        <input
          type="hidden"
          name="productIds"
          value={JSON.stringify(
            type === "DYNAMIC"
              ? []
              : selected,
          )}
        />

        <input
          type="hidden"
          name="rules"
          value={JSON.stringify(
            rules.map(
              ({
                field,
                operator,
                value,
              }) => ({
                field,
                operator,
                value:
                  collectionRuleValue(
                    field,
                    value,
                  ),
              }),
            ),
          )}
        />

        {type === "MANUAL" ? (
          <ManualProductsField
            products={products}
            productPagination={productPagination}
            selected={selected}
            pending={pending}
            onSelectionChange={setSelected}
          />
        ) : (
          <DynamicRulesField
            rules={rules}
            match={match}
            pending={pending}
            onRulesChange={
              setRules
            }
            onMatchChange={
              setMatch
            }
          />
        )}
      </div>

      <ActionButton
        className={styles.primary}
        pending={pending}
        pendingLabel={
          editing
            ? "Updating…"
            : "Creating…"
        }
        disabled={
          type === "MANUAL"
            ? !editing &&
              !selected.length
            : rules.some(
                (rule) =>
                  !isValidCollectionRule(
                    {
                      field:
                        rule.field,
                      operator:
                        rule.operator,
                      value:
                        collectionRuleValue(
                          rule.field,
                          rule.value,
                        ),
                    },
                  ),
              )
        }
      >
        {editing
          ? "Save changes"
          : "Create collection"}
      </ActionButton>

      {state.message && (
        <p
          role={
            state.success
              ? "status"
              : "alert"
          }
          className={`${styles.collectionFeedback} ${
            state.success
              ? styles.success
              : ""
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

export default CollectionCreateFields;