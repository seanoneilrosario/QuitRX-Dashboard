"use client";

import { useState } from "react";
import type { BundleVariant } from "./bundle-editor";
import styles from "./dashboard.module.css";

export default function BundleVariantPicker({ variants, variantId, disabled }: { variants: BundleVariant[]; variantId: string; disabled: boolean }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(variants.some((v) => v.id === variantId) ? variantId : "");
  const filtered = variants.filter((v) => v.label.toLowerCase().includes(query.trim().toLowerCase()));

  return <form action="/dashboard/bundles" className={styles.form}>
    <section className={styles.formCard}>
      <h2>Select a bundle variant</h2>
      <div className={styles.productPicker}>
        <label>Search variants<input type="search" placeholder="Search variant name or SKU" value={query} disabled={disabled} onChange={(event) => {
          const nextQuery = event.target.value;
          setQuery(nextQuery);
          if (!variants.some((v) => v.id === selectedId && v.label.toLowerCase().includes(nextQuery.trim().toLowerCase()))) setSelectedId("");
        }}/></label>
        <label>Product variant<select name="variantId" required value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={disabled || !filtered.length}>
          <option value="">{filtered.length ? "Select a variant" : "No matching variants"}</option>
          {filtered.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select></label>
        {!disabled && <small role="status">{filtered.length ? `${filtered.length} of ${variants.length} variants` : "No variants found. Try another name or SKU."}</small>}
      </div>
      <div className={styles.formActions}><button className={styles.primary} disabled={disabled || !selectedId}>Open bundle</button></div>
    </section>
  </form>;
}
