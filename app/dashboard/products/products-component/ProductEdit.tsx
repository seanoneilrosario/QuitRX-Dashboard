"use client";

import { useState } from "react";

import style from "../../../components/dashboard.module.css";
import { updateProductEditAction } from "@/lib/quitmed-retail-admin/products/products-actions";

type RetailRecord = Record<string, unknown>;

type ProductEditProps = {
  product: RetailRecord;
  attributes: RetailRecord[];
  productAttributes: RetailRecord[];
  tags: RetailRecord[];
};

function text(
  value: unknown,
  fallback = "",
): string {
  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return String(value);
  }

  return fallback;
}

function nested(
  value: RetailRecord,
  key: string,
): RetailRecord | undefined {
  const child = value[key];

  return child &&
    typeof child === "object" &&
    !Array.isArray(child)
    ? (child as RetailRecord)
    : undefined;
}

export default function ProductEdit({
  product,
  attributes,
  productAttributes,
  tags,
}: ProductEditProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const productTags = Array.isArray(product.tags)
    ? product.tags
    : [];

  return (
    <>
      {error && (
        <div
          className={style.notice}
          role="alert"
        >
          {error}
        </div>
      )}

      <form
        className={style.form}
        action={async (formData) => {
            setSaving(true);
            setError("");

            try {
            await updateProductEditAction(
                text(product.id),
                formData,
            );

            window.location.reload();
            } catch (error) {
            console.error(
                "[ProductEdit] save failed",
                error,
            );

            setError(
                error instanceof Error
                ? error.message
                : "Failed to save product.",
            );

            setSaving(false);
            }
        }}
        >
            <section
            className={style.formCard}
            >
            <h2>
                Product descriptions
            </h2>

            <div
                className={style.formGrid}
            >
                <label
                className={style.full}
                >
                Short description

                <textarea
                    name="shortDescription"
                    defaultValue={text(
                    product.shortDescription,
                    )}
                    rows={4}
                />
                </label>

                <div className={`${style.full} ${style.productEditField}`}>
                    <label>Description</label>
                    <RichTextField
                        name="description"
                        initialValue={text(product.description)}
                    />
                </div>
            </div>
            </section>

            <section className={style.formCard}>
                <h2>Tags</h2>

                <p>
                    Add tags to help organise and manage this product.
                </p>

                <TagPicker
                    tags={tags}
                    productTags={productTags}
                />
            </section>

            <section
            className={style.formCard}
            >
            <h2>
                Metafields
            </h2>

            <p>
                Manage the custom product
                attributes configured in Metafields.
            </p>

            {!attributes.length && (
                <div className={style.notice}>
                No metafields have been created yet.
                </div>
            )}

            {attributes.map((attribute) => {
                const attributeId =
                text(attribute.id);

                const currentValues =
                productAttributes.filter(
                    (item) =>
                    text(
                        item.attributeId,
                    ) === attributeId,
                );

                const attributeValues =
                Array.isArray(attribute.values)
                    ? (attribute.values as RetailRecord[])
                    : [];

                return (
                <div
                    key={attributeId}
                    className={
                    style.metafieldProductField
                    }
                >
                    <label>
                    {text(
                        attribute.name,
                        "Metafield",
                    )}
                    </label>

                    {text(attribute.description) && (
                    <small>
                        {text(
                        attribute.description,
                        )}
                    </small>
                    )}

                    <select
                    name={`attribute_${attributeId}`}
                    defaultValue={
                        text(
                        currentValues[0]
                            ?.attributeValueId,
                        )
                    }
                    >
                    <option value="">
                        No value
                    </option>

                    {attributeValues.map(
                        (value) => (
                        <option
                            key={text(value.id)}
                            value={text(value.id)}
                        >
                            {text(value.value)}
                        </option>
                        ),
                    )}
                    </select>
                </div>
                );
            })}
            </section>

            <div
            className={style.formActions}
            >
            <button
                type="submit"
                className={style.primary}
                disabled={saving}
            >
                {saving
                ? "Saving…"
                : "Save changes"}
            </button>
            </div>

            <input
            type="hidden"
            name="_existingProductTags"
            value={JSON.stringify(
                productTags.flatMap((tag) => {
                if (
                    !tag ||
                    typeof tag !== "object"
                ) {
                    return [];
                }

                const record =
                    tag as RetailRecord;

                const linkedTag = nested(
                    record,
                    "tag",
                );

                const id = text(
                    record.id,
                    "",
                );

                const tagId = text(
                    record.tagId ??
                    linkedTag?.id,
                    "",
                );

                return id && tagId
                    ? [{ id, tagId }]
                    : [];
                }),
            )}
            />
      </form>
    </>
  );
}

function RichTextField({
  name,
  initialValue,
}: {
  name: string;
  initialValue: string;
}) {
  return (
    <div className={style.richTextField}>
      <div
        className={style.richTextEditor}
        contentEditable
        suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: initialValue }}
        onInput={(event) => {
          const html = event.currentTarget.innerHTML;

          const form = event.currentTarget.closest("form");

          if (!form) return;

          const input = form.elements.namedItem(name);

          if (input instanceof HTMLInputElement) {
            input.value = html;
          }
        }}
      />

      <input type="hidden" name={name} defaultValue={initialValue} />
    </div>
  );
}

function TagPicker({
  tags,
  productTags,
}: {
  tags: RetailRecord[];
  productTags: unknown[];
}) {
  const tagOptions = tags
    .map((tag) => ({
      id: text(tag.id, ""),
      name: text(
        nested(tag, "tag")?.name ?? tag.name,
        "",
      ),
    }))
    .filter((tag) => tag.id && tag.name);

  const initialSelected = productTags.flatMap((productTag) => {
    if (typeof productTag === "string") {
      const match = tagOptions.find(
        (tag) =>
          tag.id === productTag ||
          tag.name.toLowerCase() === productTag.toLowerCase(),
      );

      return match
        ? [match]
        : [
            {
              id: "",
              name: productTag,
            },
          ];
    }

    if (
      !productTag ||
      typeof productTag !== "object"
    ) {
      return [];
    }

    const record = productTag as RetailRecord;
    const linkedTag = nested(record, "tag");

    const id = text(
      record.tagId ??
        linkedTag?.id ??
        record.id,
      "",
    );

    const name = text(
      linkedTag?.name ??
        record.name ??
        tagOptions.find(
          (tag) => tag.id === id,
        )?.name,
      "",
    );

    return name ? [{ id, name }] : [];
  });

  const [selected, setSelected] =
    useState<
      { id: string; name: string }[]
    >(initialSelected);

  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);

  const search = input.trim().toLowerCase();

  const filteredTags = tagOptions
    .filter((tag) => {
      if (!search) return true;

      return tag.name
        .toLowerCase()
        .includes(search);
    })
    .filter(
      (tag) =>
        !selected.some(
          (selectedTag) =>
            selectedTag.id === tag.id,
        ),
    )
    .slice(0, 12);

  const exactMatch = tagOptions.some(
    (tag) =>
      tag.name.toLowerCase() === search,
  );

  const alreadySelected = selected.some(
    (tag) =>
      tag.name.toLowerCase() === search,
  );

  function addTag(tag: {
    id: string;
    name: string;
  }) {
    if (
      selected.some(
        (selectedTag) =>
          selectedTag.name.toLowerCase() ===
          tag.name.toLowerCase(),
      )
    ) {
      return;
    }

    setSelected((current) => [
      ...current,
      tag,
    ]);

    setInput("");
    setOpen(false);
  }

  function createTag() {
    const name = input.trim();

    if (!name) return;

    if (exactMatch) {
      const existing = tagOptions.find(
        (tag) =>
          tag.name.toLowerCase() ===
          name.toLowerCase(),
      );

      if (existing) {
        addTag(existing);
      }

      return;
    }

    if (alreadySelected) {
      setInput("");
      return;
    }

    addTag({
      id: "",
      name,
    });
  }

  function removeTag(name: string) {
    setSelected((current) =>
      current.filter(
        (tag) => tag.name !== name,
      ),
    );
  }

  return (
    <div className={style.tagPicker}>
      <div className={style.tagPickerBox}>
        {selected.map((tag) => (
          <span
            key={`${tag.id}-${tag.name}`}
            className={style.tagChip}
          >
            {tag.name}

            <button
              type="button"
              onClick={() =>
                removeTag(tag.name)
              }
              aria-label={`Remove ${tag.name}`}
            >
              ×
            </button>
          </span>
        ))}

        <input
          type="text"
          value={input}
          placeholder={
            selected.length
              ? "Add another tag..."
              : "Search or add a tag..."
          }
          onChange={(event) => {
            setInput(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              createTag();
            }

            if (
              event.key === "Backspace" &&
              !input &&
              selected.length
            ) {
              removeTag(
                selected[selected.length - 1].name,
              );
            }
          }}
        />
      </div>

      {open && input.trim() && (
        <div className={style.tagPickerDropdown}>
          {filteredTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={style.tagPickerOption}
              onClick={() =>
                addTag(tag)
              }
            >
              {tag.name}
            </button>
          ))}

          {!exactMatch &&
            !alreadySelected && (
              <button
                type="button"
                className={
                  style.tagPickerCreate
                }
                onClick={createTag}
              >
                + Create "{input.trim()}"
              </button>
            )}

          {!filteredTags.length &&
            exactMatch && (
              <div
                className={
                  style.tagPickerEmpty
                }
              >
                Tag already selected
              </div>
            )}
        </div>
      )}

      <input
        type="hidden"
        name="tagIds"
        value={JSON.stringify(
          selected
            .filter((tag) => tag.id)
            .map((tag) => tag.id),
        )}
      />

      <input
        type="hidden"
        name="newTagNames"
        value={JSON.stringify(
          selected
            .filter((tag) => !tag.id)
            .map((tag) => tag.name),
        )}
      />

      {open && (
        <button
          type="button"
          className={style.tagPickerBackdrop}
          aria-label="Close tag suggestions"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}