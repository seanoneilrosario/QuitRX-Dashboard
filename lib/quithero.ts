import "server-only";

export type QuitHeroProduct = {
  name?: string;
  status?: string;
  productType?: string | { name?: string; slug?: string };
  brand?: { name?: string; slug?: string };
  tags?: Array<string | { name?: string; slug?: string; tag?: { name?: string; slug?: string } }>;
  variants?: Array<{ price?: number | string; inventory?: number }>;
};

export type CollectionRule = {
  field: "tag" | "name" | "brand" | "productType" | "status" | "price" | "inventory";
  operator: "equals" | "notEquals" | "contains" | "notContains" | "greaterThan" | "lessThan";
  value: string;
};

function productHasTag(product: QuitHeroProduct, expectedTag: string) {
  const expected = expectedTag.trim().toLowerCase();
  return product.tags?.some((tag) => {
    if (typeof tag === "string") return tag.trim().toLowerCase() === expected;
    return [tag.name, tag.slug, tag.tag?.name, tag.tag?.slug]
      .some((value) => value?.trim().toLowerCase() === expected);
  }) ?? false;
}

function textCondition(actual: string, operator: CollectionRule["operator"], expected: string) {
  const left = actual.trim().toLowerCase();
  const right = expected.trim().toLowerCase();
  if (operator === "notEquals") return left !== right;
  if (operator === "contains") return left.includes(right);
  if (operator === "notContains") return !left.includes(right);
  return left === right;
}

function productMatchesCollectionRule(product: QuitHeroProduct, rule: CollectionRule) {
  if (rule.field === "tag") {
    const matches = productHasTag(product, rule.value);
    return rule.operator === "notEquals" || rule.operator === "notContains" ? !matches : matches;
  }
  if (rule.field === "price" || rule.field === "inventory") {
    const actual = rule.field === "price"
      ? Number(String(product.variants?.[0]?.price ?? 0).replace(/[^0-9.-]/g, ""))
      : (product.variants ?? []).reduce((sum, variant) => sum + Number(variant.inventory ?? 0), 0);
    const expected = Number(rule.value);
    if (!Number.isFinite(expected)) return false;
    if (rule.operator === "greaterThan") return actual > expected;
    if (rule.operator === "lessThan") return actual < expected;
    if (rule.operator === "notEquals") return actual !== expected;
    return actual === expected;
  }
  const productType = typeof product.productType === "string"
    ? product.productType
    : product.productType?.name ?? product.productType?.slug ?? "";
  const actual = rule.field === "name" ? product.name ?? ""
    : rule.field === "brand" ? product.brand?.name ?? product.brand?.slug ?? ""
    : rule.field === "productType" ? productType
    : product.status ?? "";
  return textCondition(actual, rule.operator, rule.value);
}

export function productMatchesCollectionRules(
  product: QuitHeroProduct,
  rules: CollectionRule[],
  match: "all" | "any",
) {
  if (!rules.length) return false;
  return match === "any"
    ? rules.some((rule) => productMatchesCollectionRule(product, rule))
    : rules.every((rule) => productMatchesCollectionRule(product, rule));
}
