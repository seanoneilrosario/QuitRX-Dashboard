"use client";

import { useActionState, useState } from "react";
import { saveBundle } from "../bundle-actions";
import type { BundleComponent } from "@/lib/product-bundles";
import styles from "./dashboard.module.css";

export type BundleProduct = { id: string; label: string };
export type BundleVariant = { id: string; productId: string; productLabel: string; label: string };

export default function BundleEditor({ parent, products, variants, initial }: { parent: BundleVariant; products: BundleProduct[]; variants: BundleVariant[]; initial: BundleComponent[] }) {
  const [components, setComponents] = useState(() => initial.map((component) => ({ ...component })));
  const [state, action, pending] = useActionState(saveBundle, { message: "", success: false });
  const availableVariants = variants.filter((variant) => variant.id !== parent.id);
  const productGroups = products.map((product) => ({ ...product, variants: availableVariants.filter((variant) => variant.productId === product.id) })).filter((product) => product.variants.length);
  const nextVariant = availableVariants.find((variant) => !components.some((component) => component.componentVariantId === variant.id));
  const componentGroups = components.reduce<Array<{ productId: string; productLabel: string; items: Array<{ component: BundleComponent; index: number }> }>>((groups, component, index) => {
    const variant = availableVariants.find((item) => item.id === component.componentVariantId);
    const productId = variant?.productId ?? component.componentVariantId;
    const group = groups.find((item) => item.productId === productId);
    if (group) group.items.push({ component, index });
    else groups.push({ productId, productLabel: variant?.productLabel ?? "Unknown product", items: [{ component, index }] });
    return groups;
  }, []);
  const saveComponents = componentGroups.flatMap((group) => group.items.map(({ component }) => component));

  function addComponent() {
    if (nextVariant) setComponents((current) => [...current, { componentVariantId: nextVariant.id, quantity: 1, position: current.length }]);
  }

  return <form action={action} className={styles.form}>
    <input type="hidden" name="productId" value={parent.productId}/>
    <input type="hidden" name="variantId" value={parent.id}/>
    <input type="hidden" name="components" value={JSON.stringify(saveComponents.map((component, position) => ({ ...component, position })))}/>
    <fieldset disabled={pending} className={styles.bundleFields}>
      <section className={styles.formCard}>
        <h2>Components for {parent.productLabel} · {parent.label}</h2>
        <p className={styles.bundleIntro}>Choose each variant included in this bundle and set how many units it contains.</p>
        <div className={styles.bundleSlots}>
          {componentGroups.map((group, groupIndex) => {
            const nextGroupVariant = availableVariants.find((variant) => variant.productId === group.productId && !components.some((component) => component.componentVariantId === variant.id));
            return <section className={styles.bundleComponent} key={group.productId}>
              <h3>Component {groupIndex + 1} — {group.productLabel}</h3>
              {group.items.map(({ component, index }, variantIndex) => {
                const selectedVariant = availableVariants.find((variant) => variant.id === component.componentVariantId);
                return <div className={styles.bundleSlot} key={component.componentVariantId}>
                  <label htmlFor={`bundle-component-${index}`}>Variant {variantIndex + 1}</label>
                  <div className={styles.bundleSlotFields}>
                    <select id={`bundle-component-${index}`} aria-label={`Variant ${variantIndex + 1} for component ${groupIndex + 1}`} value={component.componentVariantId} onChange={(event) => setComponents((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, componentVariantId: event.target.value } : item))}>
                      {!selectedVariant && <option value={component.componentVariantId}>{component.componentVariantId}</option>}
                      {productGroups.map((product) => <optgroup key={product.id} label={product.label}>{product.variants.map((variant) => <option key={variant.id} value={variant.id} disabled={variant.id !== component.componentVariantId && components.some((item) => item.componentVariantId === variant.id)}>{variant.label}</option>)}</optgroup>)}
                    </select>
                    <label className={styles.bundleQuantity}>Quantity<input type="number" min="1" step="1" value={component.quantity} onChange={(event) => setComponents((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Math.max(1, Math.floor(event.target.valueAsNumber || 1)) } : item))}/></label>
                    <button type="button" className={styles.bundleRemove} aria-label={`Remove variant ${variantIndex + 1} from component ${groupIndex + 1}`} onClick={() => setComponents((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
                  </div>
                </div>;
              })}
              <button type="button" className={styles.bundleAddVariant} disabled={!nextGroupVariant} onClick={() => nextGroupVariant && setComponents((current) => [...current, { componentVariantId: nextGroupVariant.id, quantity: 1, position: current.length }])}>+ Add variant</button>
            </section>;
          })}
        </div>
        {!components.length && <p className={styles.bundleEmpty}>No components selected. Add the first bundle component below.</p>}
        <button type="button" className={styles.secondary} disabled={!nextVariant} onClick={addComponent}>+ Add component</button>
        <div className={styles.formActions}><button className={styles.primary} type="submit">{pending ? "Saving…" : "Save bundle"}</button></div>
      </section>
    </fieldset>
    {state.message && <p role={state.success ? "status" : "alert"} className={styles.notice}>{state.message}</p>}
  </form>;
}
