"use client";

import { useState } from "react";

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function ProductNameSlugFields({
  initialName,
  initialSlug,
  autoGenerateSlug = false,
}: {
  initialName: string;
  initialSlug: string;
  autoGenerateSlug?: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);
  const [slugEdited, setSlugEdited] = useState(Boolean(initialSlug));

  return (
    <>
      <label>
        Name
        <input
          required
          name="name"
          value={name}
          onChange={(event) => {
            const nextName = event.target.value;
            setName(nextName);
            if (autoGenerateSlug && !slugEdited) setSlug(slugify(nextName));
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
            setSlug(slugify(event.target.value));
          }}
        />
      </label>
    </>
  );
}
