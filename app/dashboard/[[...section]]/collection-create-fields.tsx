"use client";

import { useState } from "react";
import styles from "./dashboard.module.css";

export type CollectionProduct = { id: string; label: string; tags: string[] };
export type CollectionTag = { id: string; label: string };

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CollectionCreateFields({ products, tags, initial }: { products: CollectionProduct[]; tags: CollectionTag[]; initial?: Record<string, unknown> }) {
  const [name, setName] = useState(typeof initial?.name === "string" ? initial.name : "");
  const [slug, setSlug] = useState(typeof initial?.slug === "string" ? initial.slug : "");
  const [slugEdited, setSlugEdited] = useState(Boolean(initial?.slug));
  const [query, setQuery] = useState("");
  const [tagId, setTagId] = useState("");
  const initialProducts = Array.isArray(initial?.products) ? initial.products : [];
  const [productIds, setProductIds] = useState<string[]>(initialProducts.flatMap((product) => {
    if (typeof product === "string") return [product];
    return product && typeof product === "object" && typeof (product as { id?: unknown }).id === "string" ? [(product as { id: string }).id] : [];
  }));
  const selectedTag = tags.find((tag) => tag.id === tagId);
  const filtered = products.filter((product) => product.label.toLowerCase().includes(query.trim().toLowerCase()) && (!selectedTag || product.tags.some((tag) => tag.toLowerCase() === selectedTag.id.toLowerCase() || tag.toLowerCase() === selectedTag.label.toLowerCase())));

  return <>
    <input type="hidden" name="productIds" value={JSON.stringify(productIds)}/>
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
    <div className={styles.collectionProducts}>
      <div className={styles.collectionProductFilters}>
        <label>Find products<input type="search" placeholder="Search product name" value={query} onChange={(event) => setQuery(event.target.value)}/></label>
        <label>Filter by tag<select value={tagId} onChange={(event) => setTagId(event.target.value)}><option value="">All tags</option>{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.label}</option>)}</select></label>
      </div>
      <div className={styles.productChoices} role="group" aria-label="Products in collection">
        {filtered.map((product) => <label key={product.id}><input type="checkbox" checked={productIds.includes(product.id)} onChange={(event) => setProductIds(event.target.checked ? [...productIds, product.id] : productIds.filter((id) => id !== product.id))}/><span><strong>{product.label}</strong><small>{product.id}</small></span></label>)}
      </div>
      <small>{productIds.length} product{productIds.length === 1 ? "" : "s"} selected · {filtered.length} shown</small>
    </div>
  </>;
}
