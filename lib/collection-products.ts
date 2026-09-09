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
