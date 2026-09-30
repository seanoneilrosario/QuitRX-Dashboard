export function collectionProductIds(initial?: Record<string, unknown>) {
  if (Array.isArray(initial?.productIds) && initial.productIds.length)
    return initial.productIds.filter((id): id is string => typeof id === "string");
  if (Array.isArray(initial?.products))
    return initial.products.flatMap((product) => {
      if (!product || typeof product !== "object") return [];
      const record = product as Record<string, unknown>;
      const nested =
        record.product && typeof record.product === "object"
          ? (record.product as Record<string, unknown>)
          : undefined;
      const id =
        typeof record.productId === "string"
          ? record.productId
          : typeof nested?.id === "string"
            ? nested.id
            : typeof record.collectionId !== "string" && typeof record.id === "string"
              ? record.id
              : "";
      return id ? [id] : [];
    });
  return [];
}

<<<<<<< HEAD
export type CollectionProductOption = { id: string; name: string; slug: string; brand: string; tags: string[]; prices: number[]; inventory: number };
export type CollectionRule = { field: "name" | "brand" | "tag" | "price" | "inventory"; operator: "equals" | "contains" | "greaterThan" | "lessThan"; value: string };

export function productMatchesCollectionRule(product: CollectionProductOption, rule: CollectionRule) {
  if (rule.field === "price" || rule.field === "inventory") {
    const expected = Number(rule.value);
    if (!Number.isFinite(expected)) return false;
    const values = rule.field === "price" ? product.prices : [product.inventory];
    return values.some((value) => rule.operator === "greaterThan" ? value > expected : rule.operator === "lessThan" ? value < expected : value === expected);
  }
  if (rule.field === "tag" && rule.operator !== "equals") return false;
  const expected = rule.value.trim().toLocaleLowerCase();
  const values = rule.field === "tag" ? product.tags : [rule.field === "brand" ? product.brand : product.name];
  return Boolean(expected) && values.some((value) => rule.operator === "contains" ? value.trim().toLocaleLowerCase().includes(expected) : value.trim().toLocaleLowerCase() === expected);
=======
export const collectionRuleOperators = {
  name: ["contains", "equals"],
  description: ["contains"],
  sku: ["contains"],
  tags: ["contains"],
  brand: ["contains"],
  category: ["contains"],
  productType: ["contains"],
  vendor: ["contains"],
  price: ["greater_than", "less_than"],
  inventory: ["greater_than"],
} as const;

export const collectionRuleLabels = {
  name: "Name",
  description: "Description",
  sku: "SKU",
  tags: "Tags",
  brand: "Brand",
  category: "Category",
  productType: "Product type",
  vendor: "Vendor",
  price: "Price",
  inventory: "Inventory",
};

export type CollectionRuleField = keyof typeof collectionRuleOperators;
export type CollectionRule = {
  field: CollectionRuleField;
  operator: "equals" | "contains" | "greater_than" | "less_than";
  value: string | number;
};
export type CollectionProductOption = {
  id: string;
  name: string;
  slug: string;
  brand: string;
  tags: string[];
  description?: string;
  sku?: string;
  category?: string;
  productType?: string;
  vendor?: string;
  price?: number;
  inventory?: number;
};

export function isNumericCollectionField(field: string) {
  return field === "price" || field === "inventory";
>>>>>>> 2f268024cdb6fb21ed01f5dddbf8a1f9e43ae841
}

export function collectionRuleValue(field: string, value: string | number) {
  return isNumericCollectionField(field) && String(value).trim()
    ? Number(value)
    : String(value).trim();
}

export function isValidCollectionRule(rule: unknown): rule is CollectionRule {
  if (!rule || typeof rule !== "object") return false;
  const { field, operator, value } = rule as CollectionRule;
  if (
    !Object.prototype.hasOwnProperty.call(collectionRuleOperators, field) ||
    !(collectionRuleOperators[field] as readonly string[]).includes(operator)
  )
    return false;
  return isNumericCollectionField(field)
    ? typeof value === "number" && Number.isFinite(value)
    : typeof value === "string" && Boolean(value.trim());
}

export function productMatchesCollectionRule(
  product: CollectionProductOption,
  rule: CollectionRule,
) {
  const normalized = { ...rule, value: collectionRuleValue(rule.field, rule.value) };
  if (!isValidCollectionRule(normalized)) return false;
  if (isNumericCollectionField(rule.field)) {
    const actual = product[rule.field];
    if (typeof actual !== "number" || !Number.isFinite(actual)) return false;
    return rule.operator === "greater_than"
      ? actual > Number(rule.value)
      : actual < Number(rule.value);
  }
  const expected = String(rule.value).trim().toLocaleLowerCase();
  const values = rule.field === "tags" ? product.tags : [product[rule.field]];
  return values.some(
    (value) =>
      typeof value === "string" &&
      (rule.operator === "contains"
        ? value.trim().toLocaleLowerCase().includes(expected)
        : value.trim().toLocaleLowerCase() === expected),
  );
}

export function dynamicCollectionProductIds(
  products: CollectionProductOption[],
  rules: CollectionRule[],
  match: "ALL" | "ANY",
) {
  if (!rules.length) return [];
  return products
    .filter((product) =>
      match === "ANY"
        ? rules.some((rule) => productMatchesCollectionRule(product, rule))
        : rules.every((rule) => productMatchesCollectionRule(product, rule)),
    )
    .map((product) => product.id);
}
