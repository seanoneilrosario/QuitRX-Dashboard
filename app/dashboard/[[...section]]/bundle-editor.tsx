"use client";

import { useEffect, useMemo, useState } from "react";
import { saveBundle, type BundleActionState } from "../bundle-actions";
import type { BundleComponent } from "@/lib/product-bundles";
import styles from "./dashboard.module.css";

export type BundleProduct = { id: string; label: string };
export type BundleVariant = { id: string; productId: string; productLabel: string; label: string; sku: string };
type BundleSlot = { key: number; components: Omit<BundleComponent, "position">[] };

function slotsFromComponents(components: BundleComponent[]): BundleSlot[] {
  const slots = new Map<number, BundleSlot>();
  components.forEach(({ position, ...component }) => {
    const slot = slots.get(position);
    if (slot) slot.components.push(component);
    else slots.set(position, { key: position, components: [component] });
  });
  return [...slots.values()].sort((a, b) => a.key - b.key);
}

function componentsFromSlots(slots: BundleSlot[]) {
  return slots.flatMap((slot, position) => slot.components.map((component) => ({ ...component, position })));
}

function signature(slots: BundleSlot[]) {
  return JSON.stringify(componentsFromSlots(slots));
}

export default function BundleEditor({ parent, products, variants, bundleProductIds, initial }: { parent: BundleVariant; products: BundleProduct[]; variants: BundleVariant[]; bundleProductIds: string[]; initial: BundleComponent[] }) {
  const initialSlots = useMemo(() => slotsFromComponents(initial), [initial]);
  const [slots, setSlots] = useState(initialSlots);
  const [savedSlots, setSavedSlots] = useState(initialSlots);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<BundleActionState>({ message: "", success: false });
  const [pending, setPending] = useState(false);
  const [nextSlotKey, setNextSlotKey] = useState(() => Math.max(-1, ...initialSlots.map((slot) => slot.key)) + 1);
  const bundleIds = useMemo(() => new Set(bundleProductIds), [bundleProductIds]);
  const dirty = signature(slots) !== signature(savedSlots);
  const hasEmptySlot = slots.some((slot) => !slot.components.length);

  const availableProducts = useMemo(() => products.flatMap((product) => {
    if (product.id === parent.productId || bundleIds.has(product.id)) return [];
    const productVariants = variants.filter((variant) => variant.productId === product.id && variant.id !== parent.id);
    const search = query.trim().toLowerCase();
    const matches = !search || product.label.toLowerCase().includes(search) || productVariants.some((variant) => `${variant.label} ${variant.sku}`.toLowerCase().includes(search));
    return matches && productVariants.length ? [{ ...product, variants: productVariants }] : [];
  }), [bundleIds, parent.id, parent.productId, products, query, variants]);

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

  function addSlot() {
    setSlots((current) => [...current, { key: nextSlotKey, components: [] }]);
    setNextSlotKey((current) => current + 1);
  }

  function removeSlot(key: number) {
    setSlots((current) => current.filter((slot) => slot.key !== key));
  }

  function toggleVariant(slotKey: number, variantId: string) {
    setSlots((current) => current.map((slot) => {
      if (slot.key !== slotKey) return slot;
      const selected = slot.components.some((component) => component.componentVariantId === variantId);
      return {
        ...slot,
        components: selected
          ? slot.components.filter((component) => component.componentVariantId !== variantId)
          : [...slot.components, { componentVariantId: variantId, quantity: 1 }],
      };
    }));
  }

  async function submit(form: FormData) {
    if (hasEmptySlot) return;
    setPending(true);
    const result = await saveBundle(state, form);
    setState(result);
    if (result.success && result.components) {
      const saved = slotsFromComponents(result.components);
      setSlots(saved);
      setSavedSlots(saved);
      setNextSlotKey(Math.max(-1, ...saved.map((slot) => slot.key)) + 1);
    }
    setPending(false);
  }

  const selectedCount = slots.reduce((total, slot) => total + slot.components.length, 0);

  return <form action={submit} className={styles.form}>
    <input type="hidden" name="productId" value={parent.productId}/>
    <input type="hidden" name="variantId" value={parent.id}/>
    <input type="hidden" name="components" value={JSON.stringify(componentsFromSlots(slots))}/>
    <fieldset disabled={pending} className={styles.bundleFields}>
      <section className={styles.formCard}>
        <div className={styles.bundleEditorHeader}><div><h2>Bundle slots</h2><p>{parent.productLabel} · {parent.label}</p></div><strong>{slots.length} {slots.length === 1 ? "slot" : "slots"} · {selectedCount} allowed</strong></div>
        <p className={styles.bundleIntro}>Each slot becomes one storefront select. Choose every child variant the customer may select in that slot.</p>
        <label className={styles.bundleSearch}>Search product variants<input type="search" placeholder="Search product, variant or SKU" value={query} onChange={(event) => setQuery(event.target.value)}/></label>
        <div className={styles.bundleSlots}>
          {slots.map((slot, slotIndex) => <section className={styles.bundleComponent} key={slot.key}>
            <div className={styles.bundleSlotHeader}><div><h3>Bundle slot {slotIndex + 1}</h3><small>{slot.components.length} {slot.components.length === 1 ? "allowed variant" : "allowed variants"}</small></div><button type="button" className={styles.bundleRemove} onClick={() => removeSlot(slot.key)}>Remove slot</button></div>
            <div className={styles.bundleAvailable}>
              {availableProducts.map((product) => <article className={styles.bundleProduct} key={product.id}><strong>{product.label}</strong><div>
                {product.variants.map((variant) => { const checked = slot.components.some((component) => component.componentVariantId === variant.id); return <label key={variant.id}><input type="checkbox" checked={checked} onChange={() => toggleVariant(slot.key, variant.id)}/><span>{variant.label}{variant.sku && <small>SKU: {variant.sku}</small>}</span></label>; })}
              </div></article>)}
              {!availableProducts.length && <p className={styles.bundleEmpty}>No available variants match your search.</p>}
            </div>
            {!slot.components.length && <p className={styles.bundleSlotError}>Select at least one allowed variant for this slot.</p>}
          </section>)}
        </div>
        {!slots.length && <p className={styles.bundleEmpty}>No bundle slots configured yet.</p>}
        <button type="button" className={styles.secondary} onClick={addSlot}>+ Add bundle slot</button>
        <div className={styles.formActions}><button className={styles.primary} type="submit" disabled={!dirty || pending || hasEmptySlot}>{pending ? "Saving…" : dirty ? "Save bundle" : "Saved"}</button></div>
      </section>
    </fieldset>
    {state.message && <p role={state.success ? "status" : "alert"} className={styles.notice}>{state.message}</p>}
  </form>;
}
