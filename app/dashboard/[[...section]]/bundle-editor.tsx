"use client";

import { useActionState, useState } from "react";
import { saveBundle } from "../bundle-actions";
import type { BundleComponent } from "@/lib/product-bundles";
import styles from "./dashboard.module.css";

export type BundleVariant = { id: string; productId: string; label: string };

export default function BundleEditor({ parent, variants, initial }: { parent: BundleVariant; variants: BundleVariant[]; initial: BundleComponent[] }) {
  const [components, setComponents] = useState(initial);
  const [query, setQuery] = useState("");
  const [state, action, pending] = useActionState(saveBundle, { message: "", success: false });
  const choices = variants.filter((v) => v.id !== parent.id && !components.some((c) => c.componentVariantId === v.id) && v.label.toLowerCase().includes(query.toLowerCase()));
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
        <h2>Components for {parent.label}</h2>
        <p>Choose the variants included in this bundle. Saving an empty list removes all components.</p>
        <div className={styles.productPicker}>
          <label>Find component variants<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search variant name or SKU"/></label>
          <label>Add component<select value="" onChange={(e) => {
            if (e.target.value) setComponents([...components, { componentVariantId: e.target.value, quantity: 1, position: components.length }]);
          }}><option value="">Select a variant</option>{choices.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
          {!choices.length && <p>No matching variants available.</p>}
        </div>
        <ol className={styles.bundleList}>{components.map((component, index) => {
          const label = variants.find((v) => v.id === component.componentVariantId)?.label ?? component.componentVariantId;
          return <li key={component.componentVariantId} className={styles.bundleRow}>
            <strong>{label}</strong>
            <label>Quantity<input aria-label={`Quantity for ${label}`} type="number" min="1" step="1" required value={Number.isNaN(component.quantity) ? "" : component.quantity} onChange={(e) => setComponents(components.map((c, i) => i === index ? { ...c, quantity: e.target.valueAsNumber } : c))}/></label>
            <div className={styles.bundleControls}>
              <button type="button" className={styles.secondary} disabled={index === 0} aria-label={`Move ${label} up`} onClick={() => move(index, -1)}>Up</button>
              <button type="button" className={styles.secondary} disabled={index === components.length - 1} aria-label={`Move ${label} down`} onClick={() => move(index, 1)}>Down</button>
              <button type="button" className={styles.secondary} aria-label={`Remove ${label}`} onClick={() => setComponents(components.filter((_, i) => i !== index))}>Remove</button>
            </div>
          </li>;
        })}</ol>
        {!components.length && <p>No components selected.</p>}
        <div className={styles.formActions}><button className={styles.primary} type="submit">{pending ? "Saving…" : "Save bundle"}</button></div>
      </section>
    </fieldset>
    {state.message && <p role={state.success ? "status" : "alert"} className={styles.notice}>{state.message}</p>}
  </form>;
}
