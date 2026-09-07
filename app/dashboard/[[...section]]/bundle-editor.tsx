"use client";

import { useActionState, useState } from "react";
import { saveBundle } from "../bundle-actions";
import type { BundleComponent } from "@/lib/product-bundles";
import styles from "./dashboard.module.css";

export type BundleProduct = { id: string; label: string };
export type BundleVariant = { id: string; productId: string; productLabel: string; label: string };

export default function BundleEditor({ parent, products, variants, initial }: { parent: BundleVariant; products: BundleProduct[]; variants: BundleVariant[]; initial: BundleComponent[] }) {
  const [components, setComponents] = useState(initial);
  const [query, setQuery] = useState("");
  const [productId, setProductId] = useState("");
  const [state, action, pending] = useActionState(saveBundle, { message: "", success: false });
  const selectedProductIds = new Set(components.flatMap((component) => {
    const productId = variants.find((variant) => variant.id === component.componentVariantId)?.productId;
    return productId ? [productId] : [];
  }));
  const productChoices = products.filter((product) => product.id !== parent.productId && !selectedProductIds.has(product.id) && product.label.toLowerCase().includes(query.trim().toLowerCase()));
  const grouped = [...selectedProductIds].map((id) => ({
    id,
    label: products.find((product) => product.id === id)?.label ?? variants.find((variant) => variant.productId === id)?.productLabel ?? id,
    variants: variants.filter((variant) => variant.productId === id),
  }));
  function move(index: number, offset: number) {
    setComponents((current) => {
      const next = [...current];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });
  }
  return <form action={action} className={styles.form}>
    <input type="hidden" name="productId" value={parent.productId}/>
    <input type="hidden" name="variantId" value={parent.id}/>
    <input type="hidden" name="components" value={JSON.stringify(components.map((c, position) => ({ ...c, position })))}/>
    <fieldset disabled={pending} className={styles.bundleFields}>
      <section className={styles.formCard}>
        <h2>Components for {parent.productLabel} · {parent.label}</h2>
        <p>Add products, then select one or more variants from each product. Saving an empty list removes all components.</p>
        <div className={styles.productPicker}>
          <label>Find products<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search product name"/></label>
          <label>Add product<select value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">Select a product</option>{productChoices.map((product) => <option key={product.id} value={product.id}>{product.label}</option>)}</select></label>
          <button type="button" className={styles.secondary} disabled={!productId} onClick={() => {
            const firstVariant = variants.find((variant) => variant.productId === productId && variant.id !== parent.id);
            if (firstVariant) setComponents([...components, { componentVariantId: firstVariant.id, quantity: 1, position: components.length }]);
            setProductId("");
          }}>Add product</button>
          {!productChoices.length && <p>No matching products available.</p>}
        </div>
        <div className={styles.bundleProducts}>{grouped.map((product) => <section key={product.id} className={styles.bundleProduct}>
          <div className={styles.bundleProductHeader}><div><strong>{product.label}</strong><small>{product.id}</small></div><button type="button" className={styles.secondary} onClick={() => setComponents(components.filter((component) => variants.find((variant) => variant.id === component.componentVariantId)?.productId !== product.id))}>Remove product</button></div>
          <div className={styles.productChoices}>{product.variants.map((variant) => {
            const component = components.find((item) => item.componentVariantId === variant.id);
            return <label key={variant.id}><input type="checkbox" checked={Boolean(component)} onChange={(event) => setComponents(event.target.checked ? [...components, { componentVariantId: variant.id, quantity: 1, position: components.length }] : components.filter((item) => item.componentVariantId !== variant.id))}/><span><strong>{variant.label}</strong><small>{variant.id}</small></span></label>;
          })}</div>
          <ol className={styles.bundleList}>{components.map((component, index) => ({ component, index, variant: variants.find((variant) => variant.id === component.componentVariantId) })).filter(({ variant }) => variant?.productId === product.id).map(({ component, index, variant }) => {
            const label = variant?.label ?? component.componentVariantId;
            return <li key={component.componentVariantId} className={styles.bundleRow}><strong>{label}</strong><label>Quantity<input aria-label={`Quantity for ${label}`} type="number" min="1" step="1" required value={Number.isNaN(component.quantity) ? "" : component.quantity} onChange={(e) => setComponents(components.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: e.target.valueAsNumber } : item))}/></label><div className={styles.bundleControls}><button type="button" className={styles.secondary} disabled={index === 0} aria-label={`Move ${label} up`} onClick={() => move(index, -1)}>Up</button><button type="button" className={styles.secondary} disabled={index === components.length - 1} aria-label={`Move ${label} down`} onClick={() => move(index, 1)}>Down</button><button type="button" className={styles.secondary} aria-label={`Remove ${label}`} onClick={() => setComponents(components.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div></li>;
          })}</ol>
        </section>)}</div>
        {!components.length && <p>No components selected.</p>}
        <div className={styles.formActions}><button className={styles.primary} type="submit">{pending ? "Saving…" : "Save bundle"}</button></div>
      </section>
    </fieldset>
    {state.message && <p role={state.success ? "status" : "alert"} className={styles.notice}>{state.message}</p>}
  </form>;
}
