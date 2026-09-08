"use client";

import { useEffect, useMemo, useState } from "react";
import { saveBundle, type BundleActionState } from "../bundle-actions";
import type { BundleComponent } from "@/lib/product-bundles";
import styles from "./dashboard.module.css";

export type BundleProduct = { id: string; label: string };
export type BundleVariant = { id: string; productId: string; productLabel: string; label: string; sku: string };

function normalized(components: BundleComponent[]) {
  return components.map(({ componentVariantId, quantity }, position) => ({ componentVariantId, quantity, position }));
}

function signature(components: BundleComponent[]) {
  return JSON.stringify(normalized(components));
}

export default function BundleEditor({ parent, products, variants, bundleProductIds, initial }: { parent: BundleVariant; products: BundleProduct[]; variants: BundleVariant[]; bundleProductIds: string[]; initial: BundleComponent[] }) {
  const initialComponents = useMemo(() => normalized(initial), [initial]);
  const [components, setComponents] = useState(initialComponents);
  const [savedComponents, setSavedComponents] = useState(initialComponents);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<BundleActionState>({ message: "", success: false });
  const [pending, setPending] = useState(false);
  const bundleIds = useMemo(() => new Set(bundleProductIds), [bundleProductIds]);
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const variantMap = useMemo(() => new Map(variants.map((variant) => [variant.id, variant])), [variants]);
  const dirty = signature(components) !== signature(savedComponents);

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

  function toggleVariant(variantId: string) {
    setComponents((current) => current.some((item) => item.componentVariantId === variantId)
      ? normalized(current.filter((item) => item.componentVariantId !== variantId))
      : normalized([...current, { componentVariantId: variantId, quantity: 1, position: current.length }]));
  }

  function setQuantity(variantId: string, quantity: number) {
    setComponents((current) => current.map((item) => item.componentVariantId === variantId ? { ...item, quantity: Math.max(1, Math.floor(quantity || 1)) } : item));
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

  const selectedGroups = components.reduce<Array<{ productId: string; label: string; items: BundleComponent[] }>>((groups, component) => {
    const variant = variantMap.get(component.componentVariantId);
    const productId = variant?.productId ?? `unavailable-${component.componentVariantId}`;
    const group = groups.find((item) => item.productId === productId);
    if (group) group.items.push(component);
    else groups.push({ productId, label: productMap.get(productId)?.label ?? variant?.productLabel ?? "Unavailable product", items: [component] });
    return groups;
  }, []);

  return <form action={submit} className={styles.form}>
    <input type="hidden" name="productId" value={parent.productId}/>
    <input type="hidden" name="variantId" value={parent.id}/>
    <input type="hidden" name="components" value={JSON.stringify(normalized(components))}/>
    <fieldset disabled={pending} className={styles.bundleFields}>
      <section className={styles.formCard}>
        <div className={styles.bundleEditorHeader}><div><h2>Bundle contents</h2><p>{parent.productLabel} · {parent.label}</p></div><strong>{components.length} {components.length === 1 ? "variant" : "variants"} selected</strong></div>
        <label className={styles.bundleSearch}>Search available products<input type="search" placeholder="Search product, variant or SKU" value={query} onChange={(event) => setQuery(event.target.value)}/></label>
        <div className={styles.bundleManagement}>
          <section><h3>Available products</h3><div className={styles.bundleAvailable}>
            {availableProducts.map((product) => <article className={styles.bundleProduct} key={product.id}><strong>{product.label}</strong><div>
              {product.variants.map((variant) => { const checked = components.some((item) => item.componentVariantId === variant.id); return <label key={variant.id}><input type="checkbox" checked={checked} onChange={() => toggleVariant(variant.id)}/><span>{variant.label}{variant.sku && <small>SKU: {variant.sku}</small>}</span></label>; })}
            </div></article>)}
            {!availableProducts.length && <p className={styles.bundleEmpty}>No available products match your search.</p>}
          </div></section>
          <section><h3>Selected bundle items</h3><div className={styles.bundleSelected}>
            {selectedGroups.map((group) => <article key={group.productId}><strong>{group.label}</strong>{group.items.map((component) => { const variant = variantMap.get(component.componentVariantId); return <div key={component.componentVariantId}><span>{variant?.label ?? component.componentVariantId}{variant?.sku && <small>SKU: {variant.sku}</small>}</span><label>Qty<input aria-label={`Quantity for ${variant?.label ?? component.componentVariantId}`} type="number" min="1" step="1" value={component.quantity} onChange={(event) => setQuantity(component.componentVariantId, event.target.valueAsNumber)}/></label><button type="button" onClick={() => toggleVariant(component.componentVariantId)}>Remove</button></div>; })}</article>)}
            {!components.length && <p className={styles.bundleEmpty}>No variants selected yet.</p>}
          </div></section>
        </div>
        <div className={styles.formActions}><button className={styles.primary} type="submit" disabled={!dirty || pending}>{pending ? "Saving…" : dirty ? "Save bundle" : "Saved"}</button></div>
      </section>
    </fieldset>
    {state.message && <p role={state.success ? "status" : "alert"} className={styles.notice}>{state.message}</p>}
  </form>;
}
