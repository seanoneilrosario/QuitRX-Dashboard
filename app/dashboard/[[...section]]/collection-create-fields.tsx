"use client";

import { useActionState, useMemo, useState } from "react";
import { createCollection } from "../actions";
import { collectionProductIds } from "@/lib/collection-products";
import styles from "./dashboard.module.css";

type ProductOption = { id: string; name: string; slug: string; brand: string; tags: string[] };
type Rule = { id: number; field: "name" | "brand" | "tag"; operator: "equals" | "contains"; value: string };

function slugify(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function CollectionCreateFields({ initial }: { initial?: Record<string, unknown> }) {
  const [name, setName] = useState(typeof initial?.name === "string" ? initial.name : "");
  const [slug, setSlug] = useState(typeof initial?.slug === "string" ? initial.slug : "");
  const [slugEdited, setSlugEdited] = useState(Boolean(initial?.slug));
  return <>
    <label>Collection name<input required name="name" value={name} onChange={(event) => { const nextName = event.target.value; setName(nextName); if (!slugEdited) setSlug(slugify(nextName)); }}/></label>
    <label>Slug<input required name="slug" value={slug} onChange={(event) => { setSlugEdited(true); setSlug(slugify(event.target.value)); }}/></label>
    <label className={styles.full}>Description<textarea name="description" defaultValue={typeof initial?.description === "string" ? initial.description : ""}/></label>
    <label>Image URL<input type="url" name="image" defaultValue={typeof initial?.image === "string" ? initial.image : ""}/></label>
    <label>SEO title<input name="seoTitle" defaultValue={typeof initial?.seoTitle === "string" ? initial.seoTitle : ""}/></label>
    <label>SEO description<input name="seoDescription" defaultValue={typeof initial?.seoDescription === "string" ? initial.seoDescription : ""}/></label>
  </>;
}

function initialRules(initial?: Record<string, unknown>): Rule[] {
  if (!Array.isArray(initial?.rules)) return [{ id: 0, field: "tag", operator: "equals", value: "" }];
  const rules = initial.rules.flatMap((rule, id) => {
    if (!rule || typeof rule !== "object") return [];
    const value = rule as Record<string, unknown>;
    if (!["name", "brand", "tag"].includes(String(value.field)) || !["equals", "contains"].includes(String(value.operator))) return [];
    return [{ id, field: value.field as Rule["field"], operator: value.operator as Rule["operator"], value: typeof value.value === "string" ? value.value : "" }];
  });
  return rules.length ? rules : [{ id: 0, field: "tag", operator: "equals", value: "" }];
}

function productMatchesRule(product: ProductOption, rule: Rule) {
  const expected = rule.value.trim().toLocaleLowerCase();
  const values = rule.field === "tag" ? product.tags : [rule.field === "brand" ? product.brand : product.name];
  return values.some((value) => rule.operator === "contains" ? value.toLocaleLowerCase().includes(expected) : value.toLocaleLowerCase() === expected);
}

export function CollectionCreateForm({ products, initial }: { products: ProductOption[]; initial?: Record<string, unknown> }) {
  const [state, action, pending] = useActionState(createCollection, { message: "", success: false });
  const editing = typeof initial?.id === "string";
  const [type, setType] = useState<"MANUAL" | "DYNAMIC">(initial?.type === "DYNAMIC" ? "DYNAMIC" : "MANUAL");
  const [match, setMatch] = useState<"ALL" | "ANY">(initial?.match === "ANY" ? "ANY" : "ALL");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>(() => collectionProductIds(initial));
  const [rules, setRules] = useState<Rule[]>(() => initialRules(initial));
  const [nextRuleId, setNextRuleId] = useState(() => initialRules(initial).length);
  const visibleProducts = useMemo(() => {
    const search = query.trim().toLowerCase();
    return products
      .filter((product) => !search || `${product.name} ${product.slug} ${product.brand} ${product.tags.join(" ")}`.toLowerCase().includes(search))
      .sort((a, b) => Number(selected.includes(b.id)) - Number(selected.includes(a.id)) || a.name.localeCompare(b.name));
  }, [products, query, selected]);
  const dynamicProductIds = useMemo(() => products.filter((product) => match === "ANY"
    ? rules.some((rule) => productMatchesRule(product, rule))
    : rules.every((rule) => productMatchesRule(product, rule))).map((product) => product.id), [match, products, rules]);
  const updateRule = (id: number, patch: Partial<Rule>) => setRules((current) => current.map((rule) => rule.id === id ? { ...rule, ...patch } : rule));

  return <form action={action} className={styles.form}>
    <input type="hidden" name="_id" value={editing ? String(initial.id) : ""}/>
    <div className={styles.inlineForm}><CollectionCreateFields initial={initial}/>
      <fieldset className={`${styles.collectionMode} ${styles.full}`} disabled={pending}>
        <legend>Collection type</legend>
        <label><input type="radio" name="type" value="MANUAL" checked={type === "MANUAL"} onChange={() => setType("MANUAL")}/><span>Manual<small>Select individual products.</small></span></label>
        <label><input type="radio" name="type" value="DYNAMIC" checked={type === "DYNAMIC"} onChange={() => setType("DYNAMIC")}/><span>Dynamic<small>Include products using rules.</small></span></label>
      </fieldset>
      <input type="hidden" name="match" value={match}/><input type="hidden" name="productIds" value={JSON.stringify(type === "DYNAMIC" ? dynamicProductIds : selected)}/><input type="hidden" name="rules" value={JSON.stringify(rules.map(({ field, operator, value }) => ({ field, operator, value: value.trim() })))}/>
      {type === "MANUAL" ? <section className={styles.collectionProducts}>
        <label>Search products<input type="search" placeholder="Search name, slug, brand or tag" value={query} onChange={(event) => setQuery(event.target.value)} disabled={pending}/></label>
        <small>{selected.length} {selected.length === 1 ? "product" : "products"} selected · selected products are shown first</small>
        <div className={styles.productChoices}>{visibleProducts.map((product) => <label key={product.id}><input type="checkbox" checked={selected.includes(product.id)} onChange={() => setSelected((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])} disabled={pending}/><span>{product.name}<small>{[product.brand, product.slug].filter(Boolean).join(" · ")}</small></span></label>)}{!visibleProducts.length && <div><strong>No products found</strong><small>Try a different search.</small></div>}</div>
      </section> : <section className={styles.collectionProducts}>
        <label>Products must match<select value={match} onChange={(event) => setMatch(event.target.value as "ALL" | "ANY")} disabled={pending}><option value="ALL">All rules</option><option value="ANY">Any rule</option></select></label>
        <small>{dynamicProductIds.length} matching {dynamicProductIds.length === 1 ? "product" : "products"}</small>
        <div className={styles.ruleList}>{rules.map((rule) => <div className={styles.ruleRow} key={rule.id}>
          <select aria-label="Rule field" value={rule.field} onChange={(event) => updateRule(rule.id, { field: event.target.value as Rule["field"] })} disabled={pending}><option value="name">Name</option><option value="brand">Brand</option><option value="tag">Tag</option></select>
          <select aria-label="Rule operator" value={rule.operator} onChange={(event) => updateRule(rule.id, { operator: event.target.value as Rule["operator"] })} disabled={pending}><option value="equals">Equals</option><option value="contains">Contains</option></select>
          <input required aria-label="Rule value" placeholder="Value" value={rule.value} onChange={(event) => updateRule(rule.id, { value: event.target.value })} disabled={pending}/>
          <button type="button" onClick={() => setRules((current) => current.filter((item) => item.id !== rule.id))} disabled={pending || rules.length === 1}>Remove</button>
        </div>)}</div>
        <button type="button" className={styles.secondary} disabled={pending} onClick={() => { setRules((current) => [...current, { id: nextRuleId, field: "tag", operator: "equals", value: "" }]); setNextRuleId((current) => current + 1); }}>+ Add rule</button>
      </section>}
    </div>
    <button className={styles.primary} disabled={pending || (type === "MANUAL" ? !editing && !selected.length : rules.some((rule) => !rule.value.trim()))}>{pending ? "Saving…" : editing ? "Save changes" : "Create collection"}</button>
    {state.message && <p role={state.success ? "status" : "alert"} className={`${styles.collectionFeedback} ${state.success ? styles.success : ""}`}>{state.message}</p>}
  </form>;
}
