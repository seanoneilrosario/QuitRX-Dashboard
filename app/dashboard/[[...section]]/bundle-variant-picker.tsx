"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BundleProduct, BundleVariant } from "./bundle-editor";
import styles from "./dashboard.module.css";

export default function BundleVariantPicker({ products, variants, variantId, disabled }: { products: BundleProduct[]; variants: BundleVariant[]; variantId: string; disabled: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [productId, setProductId] = useState(variants.find((v) => v.id === variantId)?.productId ?? "");
  const filteredProducts = products.filter((product) => product.label.toLowerCase().includes(query.trim().toLowerCase()));

  function openProduct(nextProductId: string) {
    const change = new Event("bundle-variant-change", { cancelable: true });
    if (!window.dispatchEvent(change)) return;
    setProductId(nextProductId);
    const firstVariant = variants.find((variant) => variant.productId === nextProductId);
    router.replace(firstVariant ? `/dashboard/bundles?variantId=${encodeURIComponent(firstVariant.id)}` : "/dashboard/bundles");
  }

  return <div className={styles.form}>
    <section className={styles.formCard}>
      <h2>Select a bundle product</h2>
      <div className={styles.productPicker}>
        <label>Search products<input type="search" placeholder="Search product name" value={query} disabled={disabled} onChange={(event) => {
          const nextQuery = event.target.value;
          setQuery(nextQuery);
          if (!products.some((product) => product.id === productId && product.label.toLowerCase().includes(nextQuery.trim().toLowerCase()))) {
            setProductId("");
          }
        }}/></label>
        <label>Main product<select value={productId} onChange={(event) => openProduct(event.target.value)} disabled={disabled || !filteredProducts.length}>
          <option value="">{filteredProducts.length ? "Select a product" : "No matching products"}</option>
          {filteredProducts.map((product) => <option key={product.id} value={product.id}>{product.label}</option>)}
        </select></label>
        {!disabled && <small role="status">{filteredProducts.length ? `${filteredProducts.length} of ${products.length} bundle products` : "No tagged bundle products found. Try another name."}</small>}
      </div>
    </section>
  </div>;
}
