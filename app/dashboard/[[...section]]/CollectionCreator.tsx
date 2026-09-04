"use client";

import { useMemo, useState } from "react";
import { createCollection } from "../actions";
import styles from "./dashboard.module.css";

type ProductOption = { id: string; name: string; slug: string };
type RuleField = "tag" | "name" | "brand" | "productType" | "status" | "price" | "inventory";
type Rule = { id: string; field: RuleField; operator: string; value: string };

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CollectionCreator({ products }: { products: ProductOption[] }) {
  const [filter, setFilter] = useState("");
  const [name, setName] = useState("");
  const [selectionMode, setSelectionMode] = useState<"manual" | "dynamic">("manual");
  const [ruleMatch, setRuleMatch] = useState<"all" | "any">("all");
  const [rules, setRules] = useState<Rule[]>([{ id: "rule-1", field: "tag", operator: "equals", value: "" }]);
  const slug = slugify(name);
  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return query ? products.filter((product) => `${product.name} ${product.slug}`.toLowerCase().includes(query)) : products;
  }, [filter, products]);

  return (
    <details className={styles.creator}>
      <summary>+ Add collection</summary>
      <form action={createCollection}>
        <div className={styles.inlineForm}>
          <label>Collection name<input required name="name" value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Slug<input required readOnly name="slug" value={slug} /></label>
          <label>Image URL<input name="image" type="url" /></label>
          <label className={styles.full}>Description<input name="description" /></label>
          <label>SEO title<input name="seoTitle" /></label>
          <label>SEO description<input name="seoDescription" /></label>
        </div>
        <fieldset className={styles.collectionMode}>
          <legend>How should products be added?</legend>
          <label><input type="radio" name="selectionMode" value="manual" checked={selectionMode === "manual"} onChange={() => setSelectionMode("manual")}/><span><strong>Manual</strong><small>Select specific products.</small></span></label>
          <label><input type="radio" name="selectionMode" value="dynamic" checked={selectionMode === "dynamic"} onChange={() => setSelectionMode("dynamic")}/><span><strong>Dynamic</strong><small>Automatically include products matching a tag.</small></span></label>
        </fieldset>
        {selectionMode === "dynamic" ? <section className={styles.productPicker}>
          <div><strong>Collection conditions</strong><span>Products update automatically when they match these rules.</span></div>
          <input type="hidden" name="ruleMatch" value={ruleMatch}/>
          <input type="hidden" name="dynamicRules" value={JSON.stringify(rules.map(({ field, operator, value }) => ({ field, operator, value })))}/>
          <label>Products must match<select value={ruleMatch} onChange={(event) => setRuleMatch(event.target.value as "all" | "any")}><option value="all">All conditions</option><option value="any">Any condition</option></select></label>
          <div className={styles.ruleList}>{rules.map((rule) => {
            const numeric = rule.field === "price" || rule.field === "inventory";
            return <div className={styles.ruleRow} key={rule.id}>
              <select aria-label="Condition field" value={rule.field} onChange={(event) => setRules((current) => current.map((item) => item.id === rule.id ? { ...item, field: event.target.value as RuleField, operator: "equals" } : item))}>
                <option value="tag">Tag</option><option value="name">Product name</option><option value="brand">Brand</option><option value="productType">Product type</option><option value="status">Status</option><option value="price">Price</option><option value="inventory">Inventory</option>
              </select>
              <select aria-label="Condition operator" value={rule.operator} onChange={(event) => setRules((current) => current.map((item) => item.id === rule.id ? { ...item, operator: event.target.value } : item))}>
                <option value="equals">Equals</option><option value="notEquals">Does not equal</option>{numeric ? <><option value="greaterThan">Is greater than</option><option value="lessThan">Is less than</option></> : <><option value="contains">Contains</option><option value="notContains">Does not contain</option></>}
              </select>
              <input required aria-label="Condition value" type={numeric ? "number" : "text"} step={numeric ? "any" : undefined} placeholder={rule.field === "tag" ? "For example: mint" : "Value"} value={rule.value} onChange={(event) => setRules((current) => current.map((item) => item.id === rule.id ? { ...item, value: event.target.value } : item))}/>
              <button type="button" disabled={rules.length === 1} onClick={() => setRules((current) => current.filter((item) => item.id !== rule.id))}>Remove</button>
            </div>;
          })}</div>
          <button className={styles.secondary} type="button" onClick={() => setRules((current) => [...current, { id: `rule-${Date.now()}`, field: "tag", operator: "equals", value: "" }])}>+ Add condition</button>
          <small>Metafields and popularity are not available in the current QuitHero product API.</small>
        </section> :
        <section className={styles.productPicker}>
          <div><strong>Add products</strong><span>Select one or more products for this collection.</span></div>
          <input aria-label="Filter products" placeholder="Filter products by name or slug" value={filter} onChange={(event) => setFilter(event.target.value)} />
          <div className={styles.productChoices}>
            {filtered.map((product) => <label key={product.id}><input type="checkbox" name="productIds" value={product.id}/><span><strong>{product.name}</strong><small>{product.slug}</small></span></label>)}
            {!filtered.length ? <p>No products match this filter.</p> : null}
          </div>
        </section>}
        <button className={styles.primary}>Save collection</button>
      </form>
    </details>
  );
}
