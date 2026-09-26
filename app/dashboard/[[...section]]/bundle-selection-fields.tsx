"use client";

import { useState } from "react";
import type { BundleSelection } from "@/lib/product-bundles";
import type { BundleProduct, BundleVariant } from "./bundle-editor";
import styles from "./dashboard.module.css";

export default function BundleSelectionFields({ products, variants, selections, onChange, excludedProductIds = [] }: {
  products: BundleProduct[];
  variants: BundleVariant[];
  selections: BundleSelection[];
  onChange: (selections: BundleSelection[]) => void;
  excludedProductIds?: string[];
}) {
  const [query, setQuery] = useState("");
  const search = query.trim().toLowerCase();
  const available = products.flatMap((product) => {
    if (excludedProductIds.includes(product.id)) return [];
    const options = variants.filter((variant) => variant.productId === product.id);
    return options.length && (!search || product.label.toLowerCase().includes(search) || options.some((variant) => `${variant.label} ${variant.sku}`.toLowerCase().includes(search)))
      ? [{ ...product, variants: options }] : [];
  });
  const update = (index: number, selection: BundleSelection) => onChange(selections.map((current, i) => i === index ? selection : current));
  const allowed = selections.reduce((count, selection) => count + selection.options.length, 0);

  return <>
    <div className={`${styles.bundleEditorHeader} ${styles.bundleSelectionHeader}`}>
      <h2>Bundle selections</h2>
      <strong>{selections.length} selections · {allowed} allowed</strong>
    </div>
    <p className={styles.bundleIntro}>Each selection becomes one storefront choice. Choose all product variants allowed for that selection; the same variant can be used in multiple selections.</p>
    <label className={styles.bundleSearch}>Search product variants
      <input type="search" placeholder="Search product, variant or SKU" value={query} onChange={(event) => setQuery(event.target.value)} />
    </label>
    <div className={styles.bundleSlots}>
      {selections.map((selection, index) => <section className={styles.bundleComponent} key={index}>
        <div className={styles.bundleSlotHeader}>
          <div><h3>Selection {index + 1}</h3><small>{selection.options.length} selected variants</small></div>
          <button type="button" className={styles.bundleRemove} onClick={() => onChange(selections.filter((_, i) => i !== index).map((item, position) => ({ ...item, position })))}>Remove selection</button>
        </div>
        <label className={styles.bundleSearch}>Selection name
          <input value={selection.name} placeholder={`Selection ${index + 1}`} onChange={(event) => update(index, { ...selection, name: event.target.value })} />
        </label>
        <div className={styles.bundleAvailable}>
          {available.map((product) => <article className={styles.bundleProduct} key={product.id}>
            <strong>{product.label}</strong><div>
              {product.variants.map((variant) => {
                const checked = selection.options.some((option) => option.componentVariantId === variant.id);
                return <label key={variant.id}>
                  <input type="checkbox" checked={checked} onChange={() => update(index, { ...selection, options: checked ? selection.options.filter((option) => option.componentVariantId !== variant.id) : [...selection.options, { componentVariantId: variant.id }] })} />
                  <span>{variant.label}{variant.sku && <small>SKU: {variant.sku}</small>}</span>
                </label>;
              })}
            </div>
          </article>)}
          {!available.length && <p className={styles.bundleEmpty}>No available variants match your search.</p>}
        </div>
        {!selection.options.length && <p className={styles.bundleSlotError}>Select at least one allowed variant for this selection.</p>}
      </section>)}
    </div>
    {!selections.length && <p className={styles.bundleEmpty}>No selections configured yet.</p>}
    <button type="button" className={styles.secondary} onClick={() => onChange([...selections, { position: selections.length, name: `Selection ${selections.length + 1}`, options: [] }])}>+ Add selection</button>
  </>;
}
