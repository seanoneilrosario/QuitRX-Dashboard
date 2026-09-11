"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BundleProduct, BundleVariant } from "./bundle-editor";
import styles from "./dashboard.module.css";

export default function BundleVariantPicker({ products, variants, variantId, disabled }: { products: BundleProduct[]; variants: BundleVariant[]; variantId: string; disabled: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeVariantId, setActiveVariantId] = useState(variantId);
  const search = query.trim().toLowerCase();
  const filteredProducts = products.flatMap((product) => {
    const productVariants = variants.filter((variant) => variant.productId === product.id);
    const matches = !search
      || product.label.toLowerCase().includes(search)
      || productVariants.some((variant) => `${variant.label} ${variant.sku}`.toLowerCase().includes(search));
    return matches ? [{ ...product, variants: productVariants }] : [];
  });

  function openVariant(nextId: string) {
    if (!nextId) return;
    const change = new Event("bundle-variant-change", { cancelable: true });
    if (!window.dispatchEvent(change)) return;
    setActiveVariantId(nextId);
    window.dispatchEvent(new CustomEvent("bundle-editor-select", { detail: nextId }));
    if (nextId === variantId) return;
    router.replace(`/dashboard/bundles?variantId=${encodeURIComponent(nextId)}`, { scroll: false });
  }

  function prefetchVariant(nextId: string) {
    if (nextId !== variantId) router.prefetch(`/dashboard/bundles?variantId=${encodeURIComponent(nextId)}`);
  }

  return <div className={styles.form}>
    <section className={styles.formCard}>
      <div className={styles.bundleListHeader}>
        <div><h2>Bundle products</h2><p>{products.length} {products.length === 1 ? "bundle" : "bundles"}</p></div>
        <label className={styles.bundleListSearch}>Search bundles<input type="search" placeholder="Search bundle, group or SKU" value={query} disabled={disabled} onChange={(event) => setQuery(event.target.value)}/></label>
      </div>
      <div className={styles.bundleProductList}>
        {filteredProducts.map((product) => <article key={product.id} className={styles.bundleListItem}>
          <div><strong>{product.label}</strong><small>{product.variants.length} {product.variants.length === 1 ? "group" : "groups"}</small></div>
          <div className={styles.bundleGroupList}>
            {product.variants.map((variant) => <div key={variant.id} className={variant.id === activeVariantId ? styles.bundleGroupActive : undefined}>
              <span><strong>{variant.label}</strong>{variant.sku && <small>SKU: {variant.sku}</small>}</span>
              <button type="button" className={styles.secondary} disabled={disabled} onPointerEnter={() => prefetchVariant(variant.id)} onFocus={() => prefetchVariant(variant.id)} onClick={() => openVariant(variant.id)}>{variant.id === activeVariantId ? "Editing" : "Edit"}</button>
            </div>)}
            {!product.variants.length && <p className={styles.bundleEmpty}>No bundle groups are available for this product.</p>}
          </div>
        </article>)}
        {!disabled && !filteredProducts.length && <p className={styles.bundleEmpty}>{products.length ? "No bundles match your search." : "No products tagged bundle are available."}</p>}
      </div>
    </section>
  </div>;
}
