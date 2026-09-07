"use client";

import { useActionState, useState } from "react";
import { saveBundle } from "../bundle-actions";
import type { BundleComponent } from "@/lib/product-bundles";
import styles from "./dashboard.module.css";

export type BundleProduct = { id: string; label: string };
export type BundleVariant = { id: string; productId: string; productLabel: string; label: string };

export default function BundleEditor({ parent, products, variants, initial }: { parent: BundleVariant; products: BundleProduct[]; variants: BundleVariant[]; initial: BundleComponent[] }) {
  const [slots, setSlots] = useState(() => initial.flatMap((component) => Array.from({ length: component.quantity }, () => component.componentVariantId)));
  const [state, action, pending] = useActionState(saveBundle, { message: "", success: false });
  const availableVariants = variants.filter((variant) => variant.id !== parent.id && variant.productId !== parent.productId);
  const productGroups = products.map((product) => ({ ...product, variants: availableVariants.filter((variant) => variant.productId === product.id) })).filter((product) => product.variants.length);
  const components = slots.reduce<BundleComponent[]>((items, componentVariantId) => {
    const existing = items.find((item) => item.componentVariantId === componentVariantId);
    if (existing) existing.quantity += 1;
    else items.push({ componentVariantId, quantity: 1, position: items.length });
    return items;
  }, []);

  function addComponent() {
    if (availableVariants[0]) setSlots((current) => [...current, availableVariants[0].id]);
  }

  return <form action={action} className={styles.form}>
    <input type="hidden" name="productId" value={parent.productId}/>
    <input type="hidden" name="variantId" value={parent.id}/>
    <input type="hidden" name="components" value={JSON.stringify(components.map((component, position) => ({ ...component, position })))}/>
    <fieldset disabled={pending} className={styles.bundleFields}>
      <section className={styles.formCard}>
        <h2>Components for {parent.productLabel} · {parent.label}</h2>
        <p className={styles.bundleIntro}>Choose each variant included in this bundle and set how many units it contains.</p>
        <div className={styles.bundleSlots}>
          {slots.map((componentVariantId, index) => {
            const selectedVariant = availableVariants.find((variant) => variant.id === componentVariantId);
            return <div className={styles.bundleSlot} key={index}>
              <label htmlFor={`bundle-component-${index}`}>{parent.productLabel} — {index + 1}</label>
              <div className={styles.bundleSlotFields}>
                <select id={`bundle-component-${index}`} aria-label={`Variant for ${parent.productLabel} ${index + 1}`} value={componentVariantId} onChange={(event) => setSlots((current) => current.map((slot, slotIndex) => slotIndex === index ? event.target.value : slot))}>
                  {!selectedVariant && <option value={componentVariantId}>{componentVariantId}</option>}
                  {productGroups.map((product) => <optgroup key={product.id} label={product.label}>{product.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label}</option>)}</optgroup>)}
                </select>
                <button type="button" className={styles.bundleRemove} aria-label={`Remove bundle component ${index + 1}`} onClick={() => setSlots((current) => current.filter((_, slotIndex) => slotIndex !== index))}>Remove</button>
              </div>
            </div>;
          })}
        </div>
        {!slots.length && <p className={styles.bundleEmpty}>No components selected. Add the first bundle component below.</p>}
        <button type="button" className={styles.secondary} disabled={!availableVariants.length} onClick={addComponent}>+ Add component</button>
        <div className={styles.formActions}><button className={styles.primary} type="submit">{pending ? "Saving…" : "Save bundle"}</button></div>
      </section>
    </fieldset>
    {state.message && <p role={state.success ? "status" : "alert"} className={styles.notice}>{state.message}</p>}
  </form>;
}
