import { bundleComponents, bundleComponentResponse, type BundleSelection } from "./product-bundles";

export function bundleCreationFields(form: FormData) {
  const name = String(form.get("_bundleName") ?? "").trim();
  const sku = String(form.get("_bundleSku") ?? "").trim();
  const rawPrice = String(form.get("_bundlePrice") ?? "").trim();
  const price = Number(rawPrice);
  if (!name || !sku || !rawPrice || !Number.isFinite(price) || price < 0) {
    throw new Error("Enter a bundle group name, SKU and valid price.");
  }
  const selections = bundleComponents(JSON.parse(String(form.get("_bundleSelections") ?? "[]")), String(form.get("_bundleVariantId") ?? ""));
  if (!selections.length) throw new Error("Add at least one bundle selection.");
  return { name, sku, price, selections };
}

type Request = (path: string, init?: RequestInit) => Promise<unknown>;

export async function persistBundleGroup(request: Request, productId: string, fields: { name: string; sku: string; price: number; selections: BundleSelection[] }, existingVariantId: string, onVariantSaved: (id: string) => void) {
  const body = { productId, name: fields.name, sku: fields.sku, price: fields.price };
  let variantId = existingVariantId;
  const saved = await request(`/product-variants${variantId ? `/${encodeURIComponent(variantId)}` : ""}`, {
    method: variantId ? "PATCH" : "POST", body: JSON.stringify(body),
  });
  if (!variantId) {
    const wrapper = saved && typeof saved === "object" ? saved as Record<string, unknown> : {};
    const record = wrapper.data && typeof wrapper.data === "object" ? wrapper.data as Record<string, unknown> : wrapper;
    if (typeof record.id !== "string" || !record.id) throw new Error("The group was created, but the API did not return its ID. Open the bundle to check it before retrying.");
    variantId = record.id;
  }
  onVariantSaved(variantId);
  const selections = bundleComponents(fields.selections, variantId);
  const path = `/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/bundle`;
  await request(path, { method: "PATCH", body: JSON.stringify(selections) });
  const confirmed = bundleComponentResponse(await request(path, { cache: "no-store" }), variantId);
  const signature = (values: BundleSelection[]) => JSON.stringify(values.map((selection) => ({ ...selection, options: [...selection.options].sort((a, b) => a.componentVariantId.localeCompare(b.componentVariantId)) })));
  if (signature(confirmed) !== signature(selections)) throw new Error("The API did not return all saved bundle selections. Retry saving to finish configuring the bundle.");
  return variantId;
}
