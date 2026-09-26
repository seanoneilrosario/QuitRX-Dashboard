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

export async function findBundleSku(request: Request, sku: string): Promise<Record<string, unknown> | undefined> {
  for (let page = 1; page <= 100; page += 1) {
    const response = await request(`/product-variants?page=${page}&limit=100`, { cache: "no-store" });
    const wrapper = response && typeof response === "object" ? response as Record<string, unknown> : {};
    const rows = Array.isArray(response) ? response : wrapper.data ?? wrapper.items;
    if (!Array.isArray(rows)) throw new Error("Unable to check whether the bundle SKU is already in use.");
    const match = rows.find((row) => row && typeof row === "object" && typeof row.sku === "string" && row.sku.trim().toLowerCase() === sku.toLowerCase());
    if (match) return match;
    const pagination = wrapper.pagination && typeof wrapper.pagination === "object" ? wrapper.pagination as Record<string, unknown> : {};
    const totalPages = Number(pagination.totalPages);
    if (Array.isArray(response) || rows.length < 100 || (Number.isFinite(totalPages) && page >= totalPages)) return undefined;
  }
  throw new Error("Unable to finish checking the bundle SKU. Please try again.");
}

export async function assertBundleSkuAvailable(request: Request, sku: string, existingVariantId: string) {
  const match = await findBundleSku(request, sku);
  if (match && (!existingVariantId || match.id !== existingVariantId)) {
    throw new Error(`SKU "${sku}" is already used by another group or product variant. Enter a unique SKU.`);
  }
}

export async function persistBundleGroup(request: Request, productId: string, fields: { name: string; sku: string; price: number; selections: BundleSelection[] }, existingVariantId: string, onVariantSaved: (id: string) => void) {
  const body = { productId, name: fields.name, sku: fields.sku, price: fields.price };
  let variantId = existingVariantId;
  let saved: unknown;
  try {
    saved = await request(`/product-variants${variantId ? `/${encodeURIComponent(variantId)}` : ""}`, {
      method: variantId ? "PATCH" : "POST", body: JSON.stringify(body),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (variantId || !/^QuitHero API returned 5\d\d\b/.test(message)) throw error;
    // A 500 can follow a committed write. Read back before offering a retry.
    let recovered: Record<string, unknown> | undefined;
    try { recovered = await findBundleSku(request, fields.sku); } catch { /* Preserve the original failure. */ }
    if (recovered?.productId === productId && recovered.name === fields.name && Number(recovered.price) === fields.price && typeof recovered.id === "string") {
      saved = recovered;
    } else if (recovered) {
      throw new Error(`SKU "${fields.sku}" is already used by another variant. The bundle product exists; choose a unique SKU and retry to finish its group.`);
    } else {
      throw new Error(`The bundle product was saved, but its group could not be confirmed. Retry this form or use Complete bundle from the list. ${message}`);
    }
  }
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
