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

export default function CollectionCreateFields() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  return <>
    <label>Collection name<input required name="name" value={name} onChange={(event) => {
      const nextName = event.target.value;
      setName(nextName);
      if (!slugEdited) setSlug(slugify(nextName));
    }}/></label>
    <label>Slug<input required name="slug" value={slug} onChange={(event) => {
      setSlugEdited(true);
      setSlug(slugify(event.target.value));
    }}/></label>
    <label>Description<input name="description"/></label>
    <label>Image URL<input type="url" name="image"/></label>
    <label>SEO title<input name="seoTitle"/></label>
  </>;
}
