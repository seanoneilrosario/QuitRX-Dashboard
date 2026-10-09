export type CollectionRuleField =
  | "name"
  | "description"
  | "sku"
  | "tags"
  | "brand"
  | "productType"
  | "price"
  | "inventory";

export type CollectionRuleOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than";

export type CollectionRule = {
  field: CollectionRuleField;
  operator: CollectionRuleOperator;
  value: string | number;
};

type UnknownRecord = Record<string, unknown>;

export const collectionRuleLabels: Record<CollectionRuleField, string> = {
  name: "Name",
  description: "Description",
  sku: "SKU",
  tags: "Tags",
  brand: "Brand",
  productType: "Product Type",
  price: "Price",
  inventory: "Inventory",
};

export const collectionRuleOperators: Record<
  CollectionRuleField,
  CollectionRuleOperator[]
> = {
  name: [
    "contains",
    "not_contains",
    "equals",
    "not_equals",
  ],

  description: [
    "contains",
    "not_contains",
    "equals",
    "not_equals",
  ],

  sku: [
    "contains",
    "not_contains",
    "equals",
    "not_equals",
  ],

  tags: [
    "contains",
    "not_contains",
    "equals",
    "not_equals",
  ],

  brand: [
    "contains",
    "not_contains",
    "equals",
    "not_equals",
  ],

  productType: [
    "contains",
    "not_contains",
    "equals",
    "not_equals",
  ],

  price: [
    "equals",
    "not_equals",
    "greater_than",
    "less_than",
  ],

  inventory: [
    "greater_than",
  ],
};

export function isNumericCollectionField(
  field: CollectionRuleField,
): boolean {
  return field === "price" || field === "inventory";
}

export function collectionRuleValue(
  field: CollectionRuleField,
  value: string | number,
): string | number {
  if (isNumericCollectionField(field)) {
    const numericValue =
      typeof value === "number" ? value : Number(String(value).trim());

    return Number.isFinite(numericValue) ? numericValue : 0;
  }

  return String(value ?? "");
}

export function isValidCollectionRule(
  rule: Partial<CollectionRule> | null | undefined,
): rule is CollectionRule {
  if (!rule) {
    return false;
  }

  if (
    typeof rule.field !== "string" ||
    !(rule.field in collectionRuleLabels)
  ) {
    return false;
  }

  const field = rule.field as CollectionRuleField;

  if (
    typeof rule.operator !== "string" ||
    !collectionRuleOperators[field]?.includes(
      rule.operator as CollectionRuleOperator,
    )
  ) {
    return false;
  }

  if (isNumericCollectionField(field)) {
    const numericValue =
      typeof rule.value === "number"
        ? rule.value
        : Number(String(rule.value).trim());

    return Number.isFinite(numericValue);
  }

  return String(rule.value ?? "").trim().length > 0;
}

export function collectionProductIds(
  collection: unknown,
): string[] {
  if (!collection || typeof collection !== "object") {
    return [];
  }

  const record = collection as UnknownRecord;

  // Already provided directly as productIds.
  if (Array.isArray(record.productIds)) {
    return record.productIds
      .map((id) => String(id))
      .filter(Boolean);
  }

  // Collection may expose products directly.
  if (Array.isArray(record.products)) {
    return record.products
      .map((product) => {
        if (!product || typeof product !== "object") {
          return "";
        }

        const productRecord = product as UnknownRecord;

        // { id: "..." }
        if (productRecord.id != null) {
          return String(productRecord.id);
        }

        // { productId: "..." }
        if (productRecord.productId != null) {
          return String(productRecord.productId);
        }

        // Nested relation shape:
        // { product: { id: "..." } }
        if (
          productRecord.product &&
          typeof productRecord.product === "object"
        ) {
          const nestedProduct = productRecord.product as UnknownRecord;

          if (nestedProduct.id != null) {
            return String(nestedProduct.id);
          }
        }

        return "";
      })
      .filter(Boolean);
  }

  return [];
}