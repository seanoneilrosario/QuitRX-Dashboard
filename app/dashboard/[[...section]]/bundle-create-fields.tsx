"use client";

import { useState } from "react";
import type { BundleSelection } from "@/lib/product-bundles";
import type { BundleProduct, BundleVariant } from "./bundle-editor";
import BundleSelectionFields from "./bundle-selection-fields";
import styles from "./dashboard.module.css";

export default function BundleCreateFields({ products, variants, bundleProductIds, initialName = "" }: {
  initialName?: string;
  products: BundleProduct[];
  variants: BundleVariant[];
  bundleProductIds: string[];
}) {
  const [selections, setSelections] = useState<BundleSelection[]>([]);
  return <section className={styles.formCard}>
    <input type="hidden" name="_bundleSelections" value={JSON.stringify(selections)} />
    <h2>Bundle group</h2>
    <div className={styles.formGrid}>
      <label>Group name<input name="_bundleName" required placeholder="Group 1" defaultValue={initialName} /></label>
      <label>SKU<input name="_bundleSku" required /></label>
      <label>Price<input name="_bundlePrice" type="number" min="0" step="0.01" required /></label>
    </div>
    <BundleSelectionFields products={products} variants={variants} selections={selections} onChange={setSelections} excludedProductIds={bundleProductIds} />
  </section>;
}
