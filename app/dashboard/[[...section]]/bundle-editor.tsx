"use client";

import { useEffect, useMemo, useState } from "react";
import { saveBundle, type BundleActionState } from "../bundle-actions";
import type { BundleComponent } from "@/lib/product-bundles";
import styles from "./dashboard.module.css";

export type BundleProduct = { id: string; label: string };
export type BundleVariant = { id: string; productId: string; productLabel: string; label: string; sku: string };
type BundleSelection = { key: number; components: Omit<BundleComponent, "position">[] };

function selectionsFromComponents(components: BundleComponent[]): BundleSelection[] {
  const selections = new Map<number, BundleSelection>();
  components.forEach(({ position, ...component }) => {
    const selection = selections.get(position);
    if (selection) selection.components.push(component);
    else selections.set(position, { key: position, components: [component] });
  });
  return [...selections.values()].sort((a, b) => a.key - b.key);
}

function componentsFromSelections(selections: BundleSelection[]) {
  return selections.flatMap((selection, position) => selection.components.map((component) => ({ ...component, position })));
}

function signature(selections: BundleSelection[]) {
  return JSON.stringify(componentsFromSelections(selections));
}

export default function BundleEditor({ parent, groupNumber, products, variants, bundleProductIds, initial }: { parent: BundleVariant; groupNumber: number; products: BundleProduct[]; variants: BundleVariant[]; bundleProductIds: string[]; initial: BundleComponent[] }) {
  const initialSelections = useMemo(() => selectionsFromComponents(initial), [initial]);
  const [selections, setSelections] = useState(initialSelections);
  const [savedSelections, setSavedSelections] = useState(initialSelections);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<BundleActionState>({ message: "", success: false });
  const [pending, setPending] = useState(false);
  const [nextSelectionKey, setNextSelectionKey] = useState(() => Math.max(-1, ...initialSelections.map((selection) => selection.key)) + 1);
  const bundleIds = useMemo(() => new Set(bundleProductIds), [bundleProductIds]);
  const dirty = signature(selections) !== signature(savedSelections);
  const hasEmptySelection = selections.some((selection) => !selection.components.length);

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

  function addSelection() {
    setSelections((current) => [...current, { key: nextSelectionKey, components: [] }]);
    setNextSelectionKey((current) => current + 1);
  }

  function removeSelection(key: number) {
    setSelections((current) => current.filter((selection) => selection.key !== key));
  }

  function toggleVariant(selectionKey: number, variantId: string) {
    setSelections((current) => current.map((selection) => {
      if (selection.key !== selectionKey) return selection;
      return {
        ...selection,
        components: [{ componentVariantId: variantId, quantity: 1 }],
      };
    }));
  }

  async function submit(form: FormData) {
    if (hasEmptySelection) return;
    setPending(true);
    const result = await saveBundle(state, form);
    setState(result);
    if (result.success && result.components) {
      const saved = selectionsFromComponents(result.components);
      setSelections(saved);
      setSavedSelections(saved);
      setNextSelectionKey(Math.max(-1, ...saved.map((selection) => selection.key)) + 1);
    }
    setPending(false);
  }

  const selectedCount = selections.reduce((total, selection) => total + selection.components.length, 0);

  return <form action={submit} className={styles.form}>
    <input type="hidden" name="productId" value={parent.productId}/>
    <input type="hidden" name="variantId" value={parent.id}/>
    <input type="hidden" name="components" value={JSON.stringify(componentsFromSelections(selections))}/>
    <fieldset disabled={pending} className={styles.bundleFields}>
      <section className={styles.formCard}>
        <div className={styles.bundleEditorHeader}><div><h2>Group {groupNumber}: {parent.label}</h2><p>{parent.productLabel}</p></div><strong>{selections.length} {selections.length === 1 ? "selection" : "selections"} · {selectedCount} allowed</strong></div>
        <p className={styles.bundleIntro}>Each selection becomes one storefront choice. Choose one product variant for each selection; the same variant can be used in multiple selections.</p>
        <label className={styles.bundleSearch}>Search product variants<input type="search" placeholder="Search product, variant or SKU" value={query} onChange={(event) => setQuery(event.target.value)}/></label>
        <div className={styles.bundleSlots}>
          {selections.map((selection, selectionIndex) => <section className={styles.bundleComponent} key={selection.key}>
            <div className={styles.bundleSlotHeader}><div><h3>Selection {selectionIndex + 1}</h3><small>{selection.components.length ? "1 selected variant" : "No variant selected"}</small></div><button type="button" className={styles.bundleRemove} onClick={() => removeSelection(selection.key)}>Remove selection</button></div>
            <div className={styles.bundleAvailable}>
              {availableProducts.map((product) => <article className={styles.bundleProduct} key={product.id}><strong>{product.label}</strong><div>
                {product.variants.map((variant) => { const checked = selection.components.some((component) => component.componentVariantId === variant.id); return <label key={variant.id}><input type="radio" name={`selection-${selection.key}`} checked={checked} onChange={() => toggleVariant(selection.key, variant.id)}/><span>{variant.label}{variant.sku && <small>SKU: {variant.sku}</small>}</span></label>; })}
              </div></article>)}
              {!availableProducts.length && <p className={styles.bundleEmpty}>No available variants match your search.</p>}
            </div>
            {!selection.components.length && <p className={styles.bundleSlotError}>Select at least one allowed variant for this selection.</p>}
          </section>)}
        </div>
        {!selections.length && <p className={styles.bundleEmpty}>No selections configured yet.</p>}
        <button type="button" className={styles.secondary} onClick={addSelection}>+ Add selection</button>
        <div className={styles.formActions}><button className={styles.primary} type="submit" disabled={!dirty || pending || hasEmptySelection}>{pending ? "Saving…" : dirty ? "Save bundle" : "Saved"}</button></div>
      </section>
    </fieldset>
    {state.message && <p role={state.success ? "status" : "alert"} className={styles.notice}>{state.message}</p>}
  </form>;
}
