export type BundleOption = { componentVariantId: string };
export type BundleSelection = { position: number; name: string; options: BundleOption[] };

export function bundleComponentResponse(value: unknown, parentId: string): BundleSelection[] {
  if (value == null) return [];
  if (Array.isArray(value)) return bundleComponents(value, parentId);
  if (typeof value !== "object") throw new Error("Unexpected bundle response. The bundle was not loaded.");

  const response = value as Record<string, unknown>;
  for (const key of ["data", "components", "bundleComponents", "items"]) {
    if (key in response) return bundleComponentResponse(response[key], parentId);
  }
  throw new Error("Unexpected bundle response. The bundle was not loaded.");
}

export function bundleComponents(value: unknown, parentId: string): BundleSelection[] {
  if (!Array.isArray(value)) throw new Error("Unexpected bundle response. The bundle was not loaded.");
  const seenPositions = new Set<number>();
  return value.map((item: unknown, index) => {
    if (!item || typeof item !== "object") throw new Error("Invalid bundle component.");
    const { componentVariantId, name, options, position } = item as Record<string, unknown>;
    if (typeof position !== "number" || !Number.isSafeInteger(position) || position < 0) throw new Error("Invalid component position.");
    if (seenPositions.has(position)) throw new Error("Each bundle selection must have a unique position.");
    seenPositions.add(position);
    const rawOptions = Array.isArray(options) ? options : componentVariantId ? [{ componentVariantId }] : [];
    const parsedOptions = rawOptions.map((option) => {
      if (!option || typeof option !== "object") throw new Error("Invalid bundle option.");
      const optionId = (option as Record<string, unknown>).componentVariantId;
      if (typeof optionId !== "string" || !optionId.trim() || optionId === parentId) {
        throw new Error("Choose component variants different from the bundle variant.");
      }
      return { componentVariantId: optionId };
    });
    if (!parsedOptions.length) throw new Error("Each bundle selection must have at least one variant option.");
    if (new Set(parsedOptions.map((option) => option.componentVariantId)).size !== parsedOptions.length) {
      throw new Error("A variant can only be added once per bundle selection.");
    }
    return { position, name: typeof name === "string" && name.trim() ? name.trim() : `Selection ${index + 1}`, options: parsedOptions };
  }).sort((a, b) => a.position - b.position);
}
