"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import style from "../../../components/dashboard.module.css";

import {
    removeAttributeAction,
  updateAttributeAction,
} from "../../../../lib/quitmed-retail-admin/attributes/metafield-actions";

import type {
  Attribute,
  AttributeType,
} from "../../../../lib/quitmed-retail-admin/attributes/client";

const attributeTypes: {
  value: AttributeType;
  label: string;
}[] = [
  {
    value: "TEXT",
    label: "Text",
  },
  {
    value: "NUMBER",
    label: "Number",
  },
  {
    value: "BOOLEAN",
    label: "Boolean",
  },
  {
    value: "SELECT",
    label: "Select",
  },
  {
    value: "MULTI_SELECT",
    label: "Multi-select",
  },
];

type EditMetafieldProps = {
  attribute: Attribute;
};

function generateSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function EditMetafield({
  attribute,
}: EditMetafieldProps) {
  const router = useRouter();

  const [name, setName] = useState(
    attribute.name,
  );

  const [slug, setSlug] = useState(
    attribute.slug,
  );

  const [description, setDescription] =
    useState(attribute.description ?? "");

  const [type, setType] =
    useState<AttributeType>(attribute.type);

  const [filterable, setFilterable] =
    useState(attribute.filterable);

  const [searchable, setSearchable] =
    useState(attribute.searchable);

  const [active, setActive] =
    useState(attribute.active);

  const [position, setPosition] =
    useState(attribute.position);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [deleting, setDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleDelete() {
    const confirmed = window.confirm(
        `Are you sure you want to delete "${attribute.name}"? This cannot be undone.`,
    );

    if (!confirmed) {
        return;
    }

    setDeleting(true);
    setDeleteError("");

    try {
        const result = await removeAttributeAction(
        String(attribute.id),
        );

        if (!result.success) {
        throw new Error("Failed to delete metafield.");
        }

        setDeleteSuccess(true);

        setTimeout(() => {
        router.push("/dashboard/metafields");
        }, 1000);
    } catch (error) {
        console.error(
        "[EditMetafield] Failed to delete metafield:",
        error,
        );

        setDeleteError(
        error instanceof Error
            ? error.message
            : "Failed to delete metafield.",
        );

        setDeleting(false);
    }
    }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");

    const cleanName = name.trim();
    const cleanSlug =
      slug.trim() || generateSlug(cleanName);

    if (!cleanName) {
      setError("Metafield name is required.");
      return;
    }

    if (!cleanSlug) {
      setError("Metafield slug is required.");
      return;
    }

    try {
      setSaving(true);

      await updateAttributeAction(
        String(attribute.id),
        {
          name: cleanName,
          slug: cleanSlug,
          description:
            description.trim() || undefined,
          type,
          filterable,
          searchable,
          active,
          position,
        },
      );

      router.push(
        "/dashboard/metafields?updated=1",
      );
    } catch (error) {
      console.error(
        "[EditMetafield] Failed to update metafield:",
        error,
      );

      setError(
        error instanceof Error
          ? error.message
          : "Failed to update metafield.",
      );

      setSaving(false);
    }
  }

  return (
    <>
        {deleteSuccess && (
            <div
                className={style.deleteSuccessPopup}
                role="status"
            >
                Metafield deleted successfully.
            </div>
            )}

            {deleteError && (
            <div
                className={style.notice}
                role="alert"
            >
                {deleteError}
            </div>
        )}
        <section className={style.card}>
            <form
                onSubmit={handleSubmit}
                className={style.metafieldFormGrid}
            >
                <div className={style.metafieldField}>
                <label htmlFor="name">Name</label>

                <input
                    id="name"
                    value={name}
                    onChange={(event) =>
                    setName(event.target.value)
                    }
                    disabled={saving}
                    required
                />
                </div>

                <div className={style.metafieldField}>
                <label htmlFor="slug">Slug</label>

                <input
                    id="slug"
                    value={slug}
                    onChange={(event) =>
                    setSlug(
                        generateSlug(
                        event.target.value,
                        ),
                    )
                    }
                    disabled={saving}
                    required
                />
                </div>

                <div className={style.metafieldField}>
                <label htmlFor="type">Type</label>

                <select
                    id="type"
                    value={type}
                    onChange={(event) =>
                    setType(
                        event.target
                        .value as AttributeType,
                    )
                    }
                    disabled={saving}
                >
                    {attributeTypes.map((item) => (
                    <option
                        key={item.value}
                        value={item.value}
                    >
                        {item.label}
                    </option>
                    ))}
                </select>
                </div>

                <div className={style.metafieldField}>
                <label htmlFor="position">
                    Position
                </label>

                <input
                    id="position"
                    type="number"
                    min="0"
                    value={position}
                    onChange={(event) =>
                    setPosition(
                        Number(event.target.value) || 0,
                    )
                    }
                    disabled={saving}
                />
                </div>

                <div
                className={`${style.metafieldField} ${style.metafieldFieldFull}`}
                >
                <label htmlFor="description">
                    Description
                </label>

                <textarea
                    id="description"
                    value={description}
                    onChange={(event) =>
                    setDescription(
                        event.target.value,
                    )
                    }
                    rows={4}
                    disabled={saving}
                />
                </div>

                <div className={style.metafieldCheckboxGroup}>
                <label className={style.metafieldCheckbox}>
                    <input
                    type="checkbox"
                    checked={filterable}
                    onChange={(event) =>
                        setFilterable(
                        event.target.checked,
                        )
                    }
                    disabled={saving}
                    />
                    <span>
                    Available as a storefront filter
                    </span>
                </label>

                <label className={style.metafieldCheckbox}>
                    <input
                    type="checkbox"
                    checked={searchable}
                    onChange={(event) =>
                        setSearchable(
                        event.target.checked,
                        )
                    }
                    disabled={saving}
                    />
                    <span>Searchable</span>
                </label>

                <label className={style.metafieldCheckbox}>
                    <input
                    type="checkbox"
                    checked={active}
                    onChange={(event) =>
                        setActive(
                        event.target.checked,
                        )
                    }
                    disabled={saving}
                    />
                    <span>Active</span>
                </label>
                </div>

                {error && (
                <p className={style.notice}>
                    {error}
                </p>
                )}

                <div
                className={style.metafieldActions}
                >
                    <button
                        type="button"
                        className={style.customerDeleteButton}
                        onClick={handleDelete}
                        disabled={saving || deleting}
                    >
                        {deleting
                        ? "Deleting…"
                        : "Delete metafield"}
                    </button>

                    <button
                        type="submit"
                        className={style.primary}
                        disabled={saving || deleting}
                    >
                        {saving
                        ? "Saving…"
                        : "Save changes"}
                    </button>
                </div>
            </form>
        </section>
    </>
  );
}