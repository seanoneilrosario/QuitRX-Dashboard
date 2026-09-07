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

export default function CollectionCreateFields({ initial }: { initial?: Record<string, unknown> }) {
  const [name, setName] = useState(typeof initial?.name === "string" ? initial.name : "");
  const [slug, setSlug] = useState(typeof initial?.slug === "string" ? initial.slug : "");
  const [slugEdited, setSlugEdited] = useState(Boolean(initial?.slug));

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
    <label>Description<input name="description" defaultValue={typeof initial?.description === "string" ? initial.description : ""}/></label>
    <label>Image URL<input type="url" name="image" defaultValue={typeof initial?.image === "string" ? initial.image : ""}/></label>
    <label>SEO title<input name="seoTitle" defaultValue={typeof initial?.seoTitle === "string" ? initial.seoTitle : ""}/></label>
    <label>SEO description<input name="seoDescription" defaultValue={typeof initial?.seoDescription === "string" ? initial.seoDescription : ""}/></label>
  </>;
}
