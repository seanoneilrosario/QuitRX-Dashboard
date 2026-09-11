"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { saveBundle, type BundleActionState } from "../bundle-actions";
import type { BundleSelection } from "@/lib/product-bundles";
import styles from "./dashboard.module.css";

export type BundleProduct = { id: string; label: string };
export type BundleVariant = { id: string; productId: string; productLabel: string; label: string; sku: string };
type EditorSelection = BundleSelection & { key: number };

function selectionsFromComponents(selections: BundleSelection[]): EditorSelection[] {
  return selections.map((selection) => ({ ...selection, key: selection.position }));
}

function componentsFromSelections(selections: EditorSelection[]): BundleSelection[] {
  return selections.map((selection, position) => ({ position, name: selection.name.trim() || `Selection ${position + 1}`, options: selection.options }));
}

function signature(selections: EditorSelection[]) {
  return JSON.stringify(componentsFromSelections(selections));
}

export default function BundleEditor({ parent, groupNumber, products, variants, bundleProductIds, initial }: { parent: BundleVariant; groupNumber: number; products: BundleProduct[]; variants: BundleVariant[]; bundleProductIds: string[]; initial: BundleSelection[] }) {
  const router = useRouter();
  const initialSelections = useMemo(() => selectionsFromComponents(initial), [initial]);
  const [selections, setSelections] = useState(initialSelections);
  const [savedSelections, setSavedSelections] = useState(initialSelections);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<BundleActionState>({ message: "", success: false });
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(true);
  const [nextSelectionKey, setNextSelectionKey] = useState(() => Math.max(-1, ...initialSelections.map((selection) => selection.key)) + 1);
  const bundleIds = useMemo(() => new Set(bundleProductIds), [bundleProductIds]);
  const dirty = signature(selections) !== signature(savedSelections);
  const hasEmptySelection = selections.some((selection) => !selection.options.length);

  const closeModal = useCallback(() => {
    setOpen(false);
    window.dispatchEvent(new Event("bundle-editor-close"));
    router.replace("/dashboard/bundles", { scroll: false });
  }, [router]);

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

  useEffect(() => {
    const selectBundle = (event: Event) => setOpen((event as CustomEvent<string>).detail === parent.id);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
    };
    window.addEventListener("bundle-editor-select", selectBundle);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("bundle-editor-select", selectBundle);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [closeModal, parent.id]);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add(styles.modalOpen);
    return () => document.body.classList.remove(styles.modalOpen);
  }, [open]);

  function addSelection() {
    setSelections((current) => [...current, { key: nextSelectionKey, position: current.length, name: `Selection ${current.length + 1}`, options: [] }]);
    setNextSelectionKey((current) => current + 1);
  }

  function removeSelection(key: number) {
    setSelections((current) => current.filter((selection) => selection.key !== key));
  }

  function toggleVariant(selectionKey: number, variantId: string) {
    setSelections((current) => current.map((selection) => {
      if (selection.key !== selectionKey) return selection;
      const selected = selection.options.some((option) => option.componentVariantId === variantId);
      return {
        ...selection,
        options: selected
          ? selection.options.filter((option) => option.componentVariantId !== variantId)
          : [...selection.options, { componentVariantId: variantId }],
      };
    }));
  }

  function renameSelection(selectionKey: number, name: string) {
    setSelections((current) => current.map((selection) => selection.key === selectionKey ? { ...selection, name } : selection));
  }

  async function submit(form: FormData) {
    if (hasEmptySelection) return;
    setPending(true);
    const result = await saveBundle(state, form);
    setState(result);
    if (result.success && result.selections) {
      const saved = selectionsFromComponents(result.selections);
      setSelections(saved);
      setSavedSelections(saved);
      setNextSelectionKey(Math.max(-1, ...saved.map((selection) => selection.key)) + 1);
    }
    setPending(false);
  }

  const selectedCount = selections.reduce((total, selection) => total + selection.options.length, 0);

  if (!open) return null;

  return <div className={styles.bundleModal} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
    <form id="bundle-editor" action={submit} className={`${styles.form} ${styles.bundleModalPanel}`} role="dialog" aria-modal="true" aria-labelledby="bundle-editor-title">
    <input type="hidden" name="productId" value={parent.productId}/>
    <input type="hidden" name="variantId" value={parent.id}/>
    <input type="hidden" name="components" value={JSON.stringify(componentsFromSelections(selections))}/>
    <fieldset disabled={pending} className={styles.bundleFields}>
      <section className={styles.formCard}>
        <div className={styles.bundleEditorHeader}><div><h2 id="bundle-editor-title">Edit Bundle — Group {groupNumber}: {parent.label}</h2><p>{parent.productLabel}</p></div><div className={styles.bundleModalHeaderActions}><strong>{selections.length} {selections.length === 1 ? "selection" : "selections"} · {selectedCount} allowed</strong><button type="button" className={styles.bundleModalClose} aria-label="Close edit bundle" onClick={closeModal}>×</button></div></div>
        <p className={styles.bundleIntro}>Each selection becomes one storefront choice. Choose all product variants allowed for that selection; the same variant can be used in multiple selections.</p>
        <label className={styles.bundleSearch}>Search product variants<input type="search" placeholder="Search product, variant or SKU" value={query} onChange={(event) => setQuery(event.target.value)}/></label>
        <div className={styles.bundleSlots}>
          {selections.map((selection, selectionIndex) => <section className={styles.bundleComponent} key={selection.key}>
            <div className={styles.bundleSlotHeader}><div><h3>Selection {selectionIndex + 1}</h3><small>{selection.options.length ? `${selection.options.length} selected ${selection.options.length === 1 ? "variant" : "variants"}` : "No variants selected"}</small></div><button type="button" className={styles.bundleRemove} onClick={() => removeSelection(selection.key)}>Remove selection</button></div>
            <label className={styles.bundleSearch}>Selection name<input type="text" value={selection.name} onChange={(event) => renameSelection(selection.key, event.target.value)} placeholder={`Selection ${selectionIndex + 1}`}/></label>
            <div className={styles.bundleAvailable}>
              {availableProducts.map((product) => <article className={styles.bundleProduct} key={product.id}><strong>{product.label}</strong><div>
                {product.variants.map((variant) => { const checked = selection.options.some((option) => option.componentVariantId === variant.id); return <label key={variant.id}><input type="checkbox" checked={checked} onChange={() => toggleVariant(selection.key, variant.id)}/><span>{variant.label}{variant.sku && <small>SKU: {variant.sku}</small>}</span></label>; })}
              </div></article>)}
              {!availableProducts.length && <p className={styles.bundleEmpty}>No available variants match your search.</p>}
            </div>
            {!selection.options.length && <p className={styles.bundleSlotError}>Select at least one allowed variant for this selection.</p>}
          </section>)}
        </div>
        {!selections.length && <p className={styles.bundleEmpty}>No selections configured yet.</p>}
        <button type="button" className={styles.secondary} onClick={addSelection}>+ Add selection</button>
        <div className={styles.formActions}><button type="button" className={styles.secondary} onClick={closeModal}>Cancel</button><button className={styles.primary} type="submit" disabled={!dirty || pending || hasEmptySelection}>{pending ? "Saving…" : dirty ? "Save bundle" : "Saved"}</button></div>
      </section>
    </fieldset>
    {state.message && <p role={state.success ? "status" : "alert"} className={styles.notice}>{state.message}</p>}
    </form>
  </div>;
}
