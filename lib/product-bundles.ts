export type BundleComponent = { componentVariantId: string; quantity: number; position: number };

export function bundleComponentResponse(value: unknown, parentId: string): BundleComponent[] {
  if (value == null) return [];
  if (Array.isArray(value)) return bundleComponents(value, parentId);
  if (typeof value !== "object") throw new Error("Unexpected bundle response. The bundle was not loaded.");

  const response = value as Record<string, unknown>;
  for (const key of ["data", "components", "bundleComponents", "items"]) {
    if (key in response) return bundleComponentResponse(response[key], parentId);
  }
  throw new Error("Unexpected bundle response. The bundle was not loaded.");
}

export function bundleComponents(value: unknown, parentId: string): BundleComponent[] {
  if (!Array.isArray(value)) throw new Error("Unexpected bundle response. The bundle was not loaded.");
  const seen = new Set<string>();
  return value.map((item: unknown) => {
    if (!item || typeof item !== "object") throw new Error("Invalid bundle component.");
    const { componentVariantId, quantity, position } = item as Record<string, unknown>;
    if (typeof componentVariantId !== "string" || !componentVariantId.trim() || componentVariantId === parentId || seen.has(componentVariantId)) {
      throw new Error("Choose unique component variants different from the bundle variant.");
    }
    if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1) throw new Error("Component quantities must be positive whole numbers.");
    if (typeof position !== "number" || !Number.isSafeInteger(position) || position < 0) throw new Error("Invalid component position.");
    seen.add(componentVariantId);
    return { componentVariantId, quantity, position };
  }).sort((a, b) => a.position - b.position);
}
