"use client";

import { useEffect, useMemo, useState } from "react";
import { saveBundle, type BundleActionState } from "../bundle-actions";
import type { BundleComponent } from "@/lib/product-bundles";
import styles from "./dashboard.module.css";

export type BundleProduct = { id: string; label: string };
export type BundleVariant = { id: string; productId: string; productLabel: string; label: string; sku: string };

function normalized(components: BundleComponent[]) {
  return components.map((component, position) => ({ ...component, position }));
}

function signature(components: BundleComponent[]) {
  return JSON.stringify(normalized(components));
}

export default function BundleEditor({ parent, products, variants, bundleProductIds, initial }: { parent: BundleVariant; products: BundleProduct[]; variants: BundleVariant[]; bundleProductIds: string[]; initial: BundleComponent[] }) {
  const initialComponents = useMemo(() => normalized(initial), [initial]);
  const [components, setComponents] = useState(initialComponents);
  const [savedComponents, setSavedComponents] = useState(initialComponents);
  const [state, setState] = useState<BundleActionState>({ message: "", success: false });
  const [pending, setPending] = useState(false);
  const bundleIds = useMemo(() => new Set(bundleProductIds), [bundleProductIds]);
  const availableVariants = useMemo(() => variants.filter((variant) => variant.id !== parent.id && variant.productId !== parent.productId && !bundleIds.has(variant.productId)), [bundleIds, parent.id, parent.productId, variants]);
  const productGroups = useMemo(() => products.flatMap((product) => {
    const productVariants = availableVariants.filter((variant) => variant.productId === product.id);
    return productVariants.length ? [{ ...product, variants: productVariants }] : [];
  }), [availableVariants, products]);
  const dirty = signature(components) !== signature(savedComponents);
  const nextVariant = availableVariants.find((variant) => !components.some((component) => component.componentVariantId === variant.id));

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    const warnBeforeVariantChange = (event: Event) => {
      if (dirty && !window.confirm("Discard your unsaved bundle changes?")) event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    window.addEventListener("bundle-variant-change", warnBeforeVariantChange);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      window.removeEventListener("bundle-variant-change", warnBeforeVariantChange);
    };
  }, [dirty]);

  function addComponent() {
    if (!nextVariant) return;
    setComponents((current) => [...current, { componentVariantId: nextVariant.id, quantity: 1, position: current.length }]);
  }

  function updateVariant(index: number, componentVariantId: string) {
    setComponents((current) => current.map((component, componentIndex) => componentIndex === index ? { ...component, componentVariantId } : component));
  }

  function updateQuantity(index: number, quantity: number) {
    setComponents((current) => current.map((component, componentIndex) => componentIndex === index ? { ...component, quantity: Math.max(1, Math.floor(quantity || 1)) } : component));
  }

  async function submit(form: FormData) {
    setPending(true);
    const result = await saveBundle(state, form);
    setState(result);
    if (result.success && result.components) {
      const saved = normalized(result.components);
      setComponents(saved);
      setSavedComponents(saved);
    }
    setPending(false);
  }

  return <form action={submit} className={styles.form}>
    <input type="hidden" name="productId" value={parent.productId}/>
    <input type="hidden" name="variantId" value={parent.id}/>
    <input type="hidden" name="components" value={JSON.stringify(normalized(components))}/>
    <fieldset disabled={pending} className={styles.bundleFields}>
      <section className={styles.formCard}>
        <div className={styles.bundleEditorHeader}><div><h2>Components for {parent.label}</h2><p>{parent.productLabel}</p></div><strong>{components.length} fixed {components.length === 1 ? "component" : "components"}</strong></div>
        <p className={styles.bundleIntro}>This bundle option has fixed contents. Add each included product variant and set how many units the customer receives.</p>
        <div className={styles.bundleSlots}>
          {components.map((component, index) => {
            const selectedVariant = variants.find((variant) => variant.id === component.componentVariantId);
            return <section className={styles.bundleComponent} key={`${component.componentVariantId}-${index}`}>
              <h3>Component {index + 1}</h3>
              <div className={styles.bundleSlotFields}>
                <select aria-label={`Variant for component ${index + 1}`} value={component.componentVariantId} onChange={(event) => updateVariant(index, event.target.value)}>
                  {!selectedVariant && <option value={component.componentVariantId}>{component.componentVariantId}</option>}
                  {productGroups.map((product) => <optgroup key={product.id} label={product.label}>{product.variants.map((variant) => <option key={variant.id} value={variant.id} disabled={variant.id !== component.componentVariantId && components.some((item) => item.componentVariantId === variant.id)}>{variant.label}{variant.sku ? ` — ${variant.sku}` : ""}</option>)}</optgroup>)}
                </select>
                <label className={styles.bundleQuantity}>Quantity<input aria-label={`Quantity for component ${index + 1}`} type="number" min="1" step="1" value={component.quantity} onChange={(event) => updateQuantity(index, event.target.valueAsNumber)}/></label>
                <button type="button" className={styles.bundleRemove} onClick={() => setComponents((current) => current.filter((_, componentIndex) => componentIndex !== index))}>Remove</button>
              </div>
            </section>;
          })}
        </div>
        {!components.length && <p className={styles.bundleEmpty}>No fixed components have been added to this bundle option yet.</p>}
        <button type="button" className={styles.secondary} disabled={!nextVariant} onClick={addComponent}>+ Add component</button>
        <div className={styles.formActions}><button className={styles.primary} type="submit" disabled={!dirty || pending}>{pending ? "Saving…" : dirty ? "Save bundle" : "Saved"}</button></div>
      </section>
    </fieldset>
    {state.message && <p role={state.success ? "status" : "alert"} className={styles.notice}>{state.message}</p>}
  </form>;
}
