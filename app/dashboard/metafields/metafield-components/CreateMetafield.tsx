"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import style from "../../../components/dashboard.module.css";
import { createAttributeAction } from "../../../../lib/quitmed-retail-admin/attributes/metafield-actions";
import type { AttributeType } from "../../../../lib/quitmed-retail-admin/attributes/client";

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

export default function CreateMetafield() {
    const router = useRouter();

    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [description, setDescription] = useState("");
    const [type, setType] =
        useState<AttributeType>("TEXT");
    const [filterable, setFilterable] = useState(false);
    const [searchable, setSearchable] = useState(false);
    const [active, setActive] = useState(true);
    const [position, setPosition] = useState(0);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    function generateSlug(value: string) {
        return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
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

            const data = {
            name: cleanName,
            slug: cleanSlug,
            description: description.trim() || undefined,
            type,
            filterable,
            searchable,
            active,
            position,
            };

            await createAttributeAction(data);

            router.push("/dashboard/metafields");
        } catch (error) {
            console.error(
            "[CreateMetafield] Failed to create metafield:",
            error,
            );

            setError(
            error instanceof Error
                ? error.message
                : "Failed to create metafield.",
            );

            setSaving(false);
        }
        }

    return (
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
                onChange={(event) => {
                    const value = event.target.value;

                    setName(value);

                    if (!slug) {
                    setSlug(generateSlug(value));
                    }
                }}
                placeholder="Flavour"
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
                    generateSlug(event.target.value),
                    )
                }
                placeholder="flavour"
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
                    event.target.value as AttributeType,
                    )
                }
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
                <label htmlFor="position">Position</label>
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
                    setDescription(event.target.value)
                }
                rows={4}
                placeholder="Describe this metafield."
                />
            </div>

            <div className={style.metafieldCheckboxGroup}>
                <label className={style.metafieldCheckbox}>
                <input
                    type="checkbox"
                    checked={filterable}
                    onChange={(event) =>
                    setFilterable(event.target.checked)
                    }
                />
                <span>Available as a storefront filter</span>
                </label>

                <label className={style.metafieldCheckbox}>
                <input
                    type="checkbox"
                    checked={searchable}
                    onChange={(event) =>
                    setSearchable(event.target.checked)
                    }
                />
                <span>Searchable</span>
                </label>

                <label className={style.metafieldCheckbox}>
                <input
                    type="checkbox"
                    checked={active}
                    onChange={(event) =>
                    setActive(event.target.checked)
                    }
                />
                <span>Active</span>
                </label>
            </div>

            {error && (
                <p className={style.notice}>
                {error}
                </p>
            )}

            <div className={style.metafieldActions}>
                <button
                type="submit"
                className={style.primary}
                disabled={saving}
                >
                {saving
                    ? "Creating…"
                    : "Create metafield"}
                </button>
            </div>
            </form>
        </section>
        );
}