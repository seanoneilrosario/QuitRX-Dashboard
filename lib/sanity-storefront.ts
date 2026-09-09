import "server-only";

type StorefrontRule = { field: string; operator: string; value: string };
type StorefrontCollection = {
  id: string;
  name: string;
  slug: string;
  type: "MANUAL" | "DYNAMIC";
  match: "ALL" | "ANY";
  image?: string;
  productIds?: string[];
  rules?: StorefrontRule[];
};

function config() {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim();
  const token = process.env.SANITY_WRITE_TOKEN?.trim();
  if (!projectId || !dataset || !token) throw new Error("Sanity storefront sync is not configured.");
  return { projectId, dataset, token };
}

function documentId(retailCollectionId: string) {
  return `retailCollection.${retailCollectionId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export async function syncStorefrontCollection(collection: StorefrontCollection) {
  const { projectId, dataset, token } = config();
  let image: { _type: "image"; asset: { _type: "reference"; _ref: string } } | undefined;
  if (collection.image) {
    const source = await fetch(collection.image, { cache: "no-store" });
    if (!source.ok) throw new Error(`Storefront image download failed (${source.status}).`);
    const asset = await fetch(`https://${projectId}.api.sanity.io/v2026-09-09/assets/images/${encodeURIComponent(dataset)}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": source.headers.get("content-type") ?? "application/octet-stream" },
      body: await source.arrayBuffer(),
      cache: "no-store",
    });
    const assetBody = await asset.json() as { document?: { _id?: string }; message?: string };
    if (!asset.ok || !assetBody.document?._id) throw new Error(assetBody.message ? `Storefront image upload failed: ${assetBody.message}` : `Storefront image upload failed (${asset.status}).`);
    image = { _type: "image", asset: { _type: "reference", _ref: assetBody.document._id } };
  }
  const document = {
    _id: documentId(collection.id),
    _type: "productCollection",
    retailCollectionId: collection.id,
    title: collection.name,
    slug: { _type: "slug", current: collection.slug },
    selectionMode: collection.type.toLowerCase(),
    ruleMatch: collection.match.toLowerCase(),
    productIds: collection.type === "MANUAL" ? collection.productIds ?? [] : [],
    ...(image ? { image } : {}),
    ...(collection.type === "DYNAMIC" ? { rules: (collection.rules ?? []).map((rule, index) => ({ _key: `rule-${index}`, ...rule })) } : {}),
  };
  const response = await fetch(`https://${projectId}.api.sanity.io/v2026-09-09/data/mutate/${encodeURIComponent(dataset)}?returnIds=true`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ mutations: [{ createOrReplace: document }] }),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(detail ? `Storefront sync failed (${response.status}): ${detail}` : `Storefront sync failed (${response.status}).`);
  }
}
