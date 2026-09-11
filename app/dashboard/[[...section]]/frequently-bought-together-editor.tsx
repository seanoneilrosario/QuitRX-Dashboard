"use client";

import { useActionState, useMemo, useState } from "react";
import { saveFrequentlyBoughtTogether } from "../recommendation-actions";
import styles from "./dashboard.module.css";
import { ActionButton } from "./action-controls";

export type RecommendationProduct = { id: string; name: string; slug: string; brand: string };

export default function FrequentlyBoughtTogetherEditor({
  productId,
  products,
  initialIds,
}: {
  productId: string;
  products: RecommendationProduct[];
  initialIds: string[];
}) {
  const [state, action, pending] = useActionState(saveFrequentlyBoughtTogether, { message: "", success: false });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => initialIds.filter((id) => id !== productId));
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const available = useMemo(() => {
    const search = query.trim().toLowerCase();
    return products.filter((product) => product.id !== productId && !selected.includes(product.id) && (!search || `${product.name} ${product.slug} ${product.brand}`.toLowerCase().includes(search)));
  }, [productId, products, query, selected]);
  const move = (index: number, direction: -1 | 1) => setSelected((current) => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  return <section className={styles.formCard}>
    <h2>Frequently Bought Together</h2>
    <p className={styles.bundleIntro}>Manually choose and order the optional products shown with this product on the storefront.</p>
    <form action={action} className={styles.recommendationEditor}>
      <input type="hidden" name="productId" value={productId}/>
      <input type="hidden" name="relatedProductIds" value={JSON.stringify(selected)}/>
      <label>Search products<input type="search" placeholder="Search name, slug or brand" value={query} onChange={(event) => setQuery(event.target.value)} disabled={pending}/></label>
      <div className={styles.recommendationColumns}>
        <div><h3>Available products</h3><div className={styles.recommendationList}>
          {available.map((product) => <button type="button" key={product.id} onClick={() => setSelected((current) => [...current, product.id])} disabled={pending || selected.length >= 12}><span><strong>{product.name}</strong><small>{[product.brand, product.slug].filter(Boolean).join(" · ")}</small></span><b>Add</b></button>)}
          {!available.length && <p className={styles.bundleEmpty}>No matching products available.</p>}
        </div></div>
        <div><h3>Selected ({selected.length}/12)</h3><div className={styles.recommendationList}>
          {selected.map((id, index) => { const product = productById.get(id); return <article key={id}><span><strong>{product?.name ?? id}</strong><small>{product ? [product.brand, product.slug].filter(Boolean).join(" · ") : "Product is no longer available"}</small></span><div><button type="button" aria-label={`Move ${product?.name ?? id} up`} onClick={() => move(index, -1)} disabled={pending || index === 0}>↑</button><button type="button" aria-label={`Move ${product?.name ?? id} down`} onClick={() => move(index, 1)} disabled={pending || index === selected.length - 1}>↓</button><button type="button" onClick={() => setSelected((current) => current.filter((value) => value !== id))} disabled={pending}>Remove</button></div></article>; })}
          {!selected.length && <p className={styles.bundleEmpty}>No recommendations selected.</p>}
        </div></div>
      </div>
      <div className={styles.formActions}><ActionButton className={styles.primary} pending={pending} pendingLabel="Saving…">Save recommendations</ActionButton></div>
      {state.message && <p role={state.success ? "status" : "alert"} className={`${styles.collectionFeedback} ${state.success ? styles.success : ""}`}>{state.message}</p>}
    </form>
  </section>;
}
