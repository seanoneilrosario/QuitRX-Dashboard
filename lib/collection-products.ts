export function collectionProductIds(initial?: Record<string, unknown>) {
  if (Array.isArray(initial?.productIds) && initial.productIds.length) return initial.productIds.filter((id): id is string => typeof id === "string");
  if (Array.isArray(initial?.products)) return initial.products.flatMap((product) => {
    if (!product || typeof product !== "object") return [];
    const record = product as Record<string, unknown>;
    const nested = record.product && typeof record.product === "object" ? record.product as Record<string, unknown> : undefined;
    const id = typeof record.productId === "string" ? record.productId : typeof nested?.id === "string" ? nested.id : typeof record.collectionId !== "string" && typeof record.id === "string" ? record.id : "";
    return id ? [id] : [];
  });
  return [];
}

export type CollectionProductOption = { id: string; name: string; slug: string; brand: string; tags: string[] };
export type CollectionRule = { field: "name" | "brand" | "tag"; operator: "equals" | "contains"; value: string };

export function productMatchesCollectionRule(product: CollectionProductOption, rule: CollectionRule) {
  const expected = rule.value.trim().toLocaleLowerCase();
  const values = rule.field === "tag" ? product.tags : [rule.field === "brand" ? product.brand : product.name];
  return Boolean(expected) && values.some((value) => rule.operator === "contains" ? value.toLocaleLowerCase().includes(expected) : value.toLocaleLowerCase() === expected);
}

export function dynamicCollectionProductIds(products: CollectionProductOption[], rules: CollectionRule[], match: "ALL" | "ANY") {
  if (!rules.length) return [];
  return products.filter((product) => match === "ANY"
    ? rules.some((rule) => productMatchesCollectionRule(product, rule))
    : rules.every((rule) => productMatchesCollectionRule(product, rule))).map((product) => product.id);
}
